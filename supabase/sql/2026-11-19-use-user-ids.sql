-- =====================================================================
-- Settle: track people by user ID instead of display name
-- =====================================================================
-- Run ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run again (everything is "if not exists" / "or replace").
--
-- What it does:
--   1. Adds ID columns next to the old name columns:
--        expenses.paid_by_id, expenses.custom_split_ids,
--        payments.from_id, payments.to_id
--   2. Fills them in for all existing rows by matching names to event members
--   3. Adds triggers so rows written by older app builds (still name-only)
--      get their IDs filled in automatically
--   4. Removes duplicate event_members rows and blocks new duplicates
--   5. Replaces delete_user() so it only deletes the caller's own data
--      (the old version matched by display name across every event)
--   6. Turns on realtime for payments so "Paid" shows up live
--
-- The old name columns (paid_by, custom_splits, from_name, to_name) are kept
-- and still written, so the build currently on the App Store keeps working.
-- =====================================================================

begin;

-- 1. New ID columns ----------------------------------------------------
alter table public.expenses add column if not exists paid_by_id uuid;
alter table public.expenses add column if not exists custom_split_ids jsonb;
alter table public.payments add column if not exists from_id uuid;
alter table public.payments add column if not exists to_id uuid;

-- 2. Backfill existing rows --------------------------------------------

-- 2a. Who paid: match the name to a member of the same event
update public.expenses e
set paid_by_id = (
  select p.id
  from public.event_members em
  join public.profiles p on p.id = em.user_id
  where em.event_id = e.event_id
    and (p.display_name = e.paid_by or p.email = e.paid_by)
  order by (p.display_name = e.paid_by) desc
  limit 1
)
where e.paid_by_id is null and e.paid_by is not null;

-- 2b. Payer no longer in the event: use the profile if the name is unique
update public.expenses e
set paid_by_id = u.id
from (
  select display_name, (array_agg(id))[1] as id
  from public.profiles
  group by display_name
  having count(*) = 1
) u
where e.paid_by_id is null and e.paid_by = u.display_name;

-- 2c. Custom amounts: {"Danny": 12.5} -> {"<user id>": 12.5}
update public.expenses e
set custom_split_ids = coalesce((
  select jsonb_object_agg(m.id::text, kv.value)
  from jsonb_each(e.custom_splits::jsonb) kv
  join lateral (
    select p.id
    from public.event_members em
    join public.profiles p on p.id = em.user_id
    where em.event_id = e.event_id and p.display_name = kv.key
    limit 1
  ) m on true
), '{}'::jsonb)
where e.custom_split_ids is null;

-- 2d. Payments
update public.payments pay
set from_id = (
  select p.id from public.event_members em
  join public.profiles p on p.id = em.user_id
  where em.event_id = pay.event_id
    and (p.display_name = pay.from_name or p.email = pay.from_name)
  order by (p.display_name = pay.from_name) desc
  limit 1
)
where pay.from_id is null and pay.from_name is not null;

update public.payments pay
set to_id = (
  select p.id from public.event_members em
  join public.profiles p on p.id = em.user_id
  where em.event_id = pay.event_id
    and (p.display_name = pay.to_name or p.email = pay.to_name)
  order by (p.display_name = pay.to_name) desc
  limit 1
)
where pay.to_id is null and pay.to_name is not null;

-- 3. Triggers: fill IDs for rows written by older app builds ------------
create or replace function public.settle_fill_expense_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recompute_custom boolean := new.custom_split_ids is null;
begin
  if new.paid_by_id is null and new.paid_by is not null then
    select p.id into new.paid_by_id
    from public.event_members em
    join public.profiles p on p.id = em.user_id
    where em.event_id = new.event_id
      and (p.display_name = new.paid_by or p.email = new.paid_by)
    order by (p.display_name = new.paid_by) desc
    limit 1;
  end if;

  -- An older build edited the name-based custom amounts but not the ID ones
  if tg_op = 'UPDATE' then
    if new.custom_splits::jsonb is distinct from old.custom_splits::jsonb
       and new.custom_split_ids is not distinct from old.custom_split_ids then
      recompute_custom := true;
    end if;
  end if;

  if recompute_custom then
    select coalesce(jsonb_object_agg(m.id::text, kv.value), '{}'::jsonb)
    into new.custom_split_ids
    from jsonb_each(coalesce(new.custom_splits::jsonb, '{}'::jsonb)) kv
    join lateral (
      select p.id
      from public.event_members em
      join public.profiles p on p.id = em.user_id
      where em.event_id = new.event_id and p.display_name = kv.key
      limit 1
    ) m on true;
  end if;

  return new;
end;
$$;

drop trigger if exists settle_fill_expense_ids on public.expenses;
create trigger settle_fill_expense_ids
before insert or update on public.expenses
for each row execute function public.settle_fill_expense_ids();

create or replace function public.settle_fill_payment_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.from_id is null and new.from_name is not null then
    select p.id into new.from_id
    from public.event_members em
    join public.profiles p on p.id = em.user_id
    where em.event_id = new.event_id
      and (p.display_name = new.from_name or p.email = new.from_name)
    order by (p.display_name = new.from_name) desc
    limit 1;
  end if;
  if new.to_id is null and new.to_name is not null then
    select p.id into new.to_id
    from public.event_members em
    join public.profiles p on p.id = em.user_id
    where em.event_id = new.event_id
      and (p.display_name = new.to_name or p.email = new.to_name)
    order by (p.display_name = new.to_name) desc
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists settle_fill_payment_ids on public.payments;
create trigger settle_fill_payment_ids
before insert or update on public.payments
for each row execute function public.settle_fill_payment_ids();

-- 4. No duplicate members in an event ------------------------------------
delete from public.event_members a
using public.event_members b
where a.ctid > b.ctid
  and a.event_id = b.event_id
  and a.user_id = b.user_id;

create unique index if not exists event_members_event_user_key
  on public.event_members (event_id, user_id);

-- 5. Account deletion: only the caller's own data ------------------------
drop function if exists public.delete_user();

create function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  -- Events you created that still have other people: hand them to another member
  update public.events ev
  set created_by = (
    select em.user_id from public.event_members em
    where em.event_id = ev.id and em.user_id <> me
    limit 1
  )
  where ev.created_by = me
    and exists (
      select 1 from public.event_members em
      where em.event_id = ev.id and em.user_id <> me
    );

  -- Events where you were the only person: remove them completely
  delete from public.payments where event_id in (select id from public.events where created_by = me);
  delete from public.expenses where event_id in (select id from public.events where created_by = me);
  delete from public.event_members where event_id in (select id from public.events where created_by = me);
  delete from public.events where created_by = me;

  -- Your own rows inside shared events
  delete from public.payments where from_id = me or to_id = me;
  delete from public.expenses where paid_by_id = me;
  delete from public.event_members where user_id = me;
  delete from public.profiles where id = me;

  -- The login itself
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

-- 6. Realtime for payments ------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.payments;
exception when others then
  null; -- already added
end;
$$;

commit;

-- Quick check after running (optional): rows the backfill couldn't match.
-- These are usually expenses paid by someone who left the event and shares
-- a display name with another user.
-- select id, event_id, paid_by from public.expenses where paid_by_id is null;
