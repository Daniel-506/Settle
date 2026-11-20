-- =====================================================================
-- Settle: friends, activity feed, invites, receipts, notifications
-- =====================================================================
-- Run AFTER 2026-11-19-use-user-ids.sql.
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again.
--
-- Adds:
--   expenses: category, expense_date, note, receipt_path, created_by, created_at
--   events:   icon, color, invite_code (6 letters, for invite links/QR)
--   friendships table + send_friend_request()
--   activity table, filled automatically by triggers (powers the Activity
--     tab and push notifications)
--   push_tokens table + register/unregister functions
--   join_event(code) for invite links
--   a private "receipts" storage bucket that only event members can read
-- =====================================================================

begin;

-- 1. New columns ---------------------------------------------------------
alter table public.expenses add column if not exists category text;
alter table public.expenses add column if not exists expense_date date;
alter table public.expenses add column if not exists note text;
alter table public.expenses add column if not exists receipt_path text;
alter table public.expenses add column if not exists created_by uuid;
alter table public.expenses add column if not exists created_at timestamptz not null default now();
alter table public.payments add column if not exists created_at timestamptz not null default now();
alter table public.event_members add column if not exists created_at timestamptz not null default now();

alter table public.events add column if not exists icon text;
alter table public.events add column if not exists color text;
alter table public.events add column if not exists invite_code text;

-- From the first migration; repeated here so join_event() can rely on it
create unique index if not exists event_members_event_user_key
  on public.event_members (event_id, user_id);

-- 2. Invite codes ---------------------------------------------------------
create or replace function public.settle_new_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.events where invite_code = code);
  end loop;
  return code;
end;
$$;

update public.events set invite_code = public.settle_new_invite_code()
where invite_code is null;
alter table public.events alter column invite_code set default public.settle_new_invite_code();
create unique index if not exists events_invite_code_key on public.events (invite_code);

create or replace function public.join_event(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id into ev from public.events where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'That invite code doesn''t match any event';
  end if;
  insert into public.event_members (event_id, user_id, status)
  values (ev.id, auth.uid(), 'active')
  on conflict (event_id, user_id) do nothing;
  return ev.id::text;
end;
$$;
revoke all on function public.join_event(text) from public, anon;
grant execute on function public.join_event(text) to authenticated;

-- 3. Friends --------------------------------------------------------------
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_key on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table public.friendships enable row level security;

drop policy if exists "friendships: see your own" on public.friendships;
create policy "friendships: see your own" on public.friendships
  for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "friendships: send requests" on public.friendships;
create policy "friendships: send requests" on public.friendships
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists "friendships: accept requests sent to you" on public.friendships;
create policy "friendships: accept requests sent to you" on public.friendships
  for update to authenticated
  using (addressee_id = auth.uid())
  with check (addressee_id = auth.uid() and status = 'accepted');

drop policy if exists "friendships: remove your own" on public.friendships;
create policy "friendships: remove your own" on public.friendships
  for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));

-- Sends a request, or accepts theirs if they already asked you.
-- Returns 'pending' or 'friends'.
create or replace function public.send_friend_request(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing record;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if p_user = me then
    raise exception 'You can''t add yourself';
  end if;

  select * into existing from public.friendships
  where least(requester_id, addressee_id) = least(me, p_user)
    and greatest(requester_id, addressee_id) = greatest(me, p_user);

  if found then
    if existing.status = 'accepted' then
      return 'friends';
    end if;
    if existing.addressee_id = me then
      update public.friendships set status = 'accepted' where id = existing.id;
      return 'friends';
    end if;
    return 'pending';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (me, p_user);
  return 'pending';
end;
$$;
revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

-- 4. Activity feed ----------------------------------------------------------
-- event_id uses whatever type events.id already is
do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
  from pg_attribute a
  where a.attrelid = 'public.events'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.activity (
      id bigint generated always as identity primary key,
      event_id %s references public.events (id) on delete cascade,
      actor_id uuid,
      target_user_id uuid,
      type text not null,
      data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )$f$, id_type);
end;
$$;

create index if not exists activity_event_idx on public.activity (event_id, created_at desc);
create index if not exists activity_target_idx on public.activity (target_user_id, created_at desc);

alter table public.activity enable row level security;
drop policy if exists "activity: your events and you" on public.activity;
create policy "activity: your events and you" on public.activity
  for select to authenticated
  using (
    target_user_id = auth.uid()
    or actor_id = auth.uid()
    or (
      event_id is not null
      and exists (
        select 1 from public.event_members em
        where em.event_id = activity.event_id and em.user_id = auth.uid()
      )
    )
  );

create or replace function public.settle_log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if tg_table_name = 'expenses' then
    insert into public.activity (event_id, actor_id, type, data)
    values (
      new.event_id,
      coalesce(me, new.created_by, new.paid_by_id),
      'expense_added',
      jsonb_build_object(
        'expense_id', new.id::text,
        'name', new.name,
        'amount', new.amount,
        'paid_by_id', new.paid_by_id,
        'category', new.category
      )
    );

  elsif tg_table_name = 'payments' then
    insert into public.activity (event_id, actor_id, target_user_id, type, data)
    values (
      new.event_id,
      coalesce(me, new.from_id),
      case when me = new.to_id then new.from_id else new.to_id end,
      'payment',
      jsonb_build_object('from_id', new.from_id, 'to_id', new.to_id, 'amount', new.amount)
    );

  elsif tg_table_name = 'event_members' then
    if new.user_id = me then
      insert into public.activity (event_id, actor_id, type)
      values (
        new.event_id,
        me,
        case when exists (
          select 1 from public.events ev
          where ev.id = new.event_id and ev.created_by = me
        ) then 'event_created' else 'member_joined' end
      );
    else
      insert into public.activity (event_id, actor_id, target_user_id, type)
      values (new.event_id, me, new.user_id, 'member_added');
    end if;

  elsif tg_table_name = 'friendships' then
    if tg_op = 'INSERT' then
      insert into public.activity (actor_id, target_user_id, type)
      values (new.requester_id, new.addressee_id, 'friend_request');
    elsif new.status = 'accepted' and old.status <> 'accepted' then
      insert into public.activity (actor_id, target_user_id, type)
      values (new.addressee_id, new.requester_id, 'friend_accepted');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists settle_activity_expenses on public.expenses;
create trigger settle_activity_expenses
after insert on public.expenses
for each row execute function public.settle_log_activity();

drop trigger if exists settle_activity_payments on public.payments;
create trigger settle_activity_payments
after insert on public.payments
for each row execute function public.settle_log_activity();

drop trigger if exists settle_activity_members on public.event_members;
create trigger settle_activity_members
after insert on public.event_members
for each row execute function public.settle_log_activity();

drop trigger if exists settle_activity_friendships on public.friendships;
create trigger settle_activity_friendships
after insert or update on public.friendships
for each row execute function public.settle_log_activity();

-- 5. Push notification tokens -------------------------------------------------
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens: see your own" on public.push_tokens;
create policy "push_tokens: see your own" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

-- A phone's token moves to whoever signs in on it
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- 6. Receipt photos (private; only members of the event can see them) -----------
-- Files are stored as receipts/<event id>/<file name>
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "settle receipts: members read" on storage.objects;
create policy "settle receipts: members read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.event_members em
      where em.event_id::text = (storage.foldername(name))[1]
        and em.user_id = auth.uid()
    )
  );

drop policy if exists "settle receipts: members upload" on storage.objects;
create policy "settle receipts: members upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.event_members em
      where em.event_id::text = (storage.foldername(name))[1]
        and em.user_id = auth.uid()
    )
  );

drop policy if exists "settle receipts: members delete" on storage.objects;
create policy "settle receipts: members delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.event_members em
      where em.event_id::text = (storage.foldername(name))[1]
        and em.user_id = auth.uid()
    )
  );

-- 7. Live updates for the new tables ---------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.activity;
exception when others then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.friendships;
exception when others then null;
end;
$$;

commit;
