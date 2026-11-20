// Everything the home screen needs in one go: your events, who's in them,
// and your balance in each.
import { nameLookup, normalizeExpense, normalizePayment } from "./eventData";
import { calculateSplit } from "./splitCalculator";
import { supabase } from "./supabase";

const PROFILE_FIELDS = "id, username, display_name, email, paypal_username, avatar_url";
const unique = (arr) => [...new Set(arr.filter((x) => x !== null && x !== undefined))];

export async function loadOverview(userId) {
  const [memberRes, createdRes] = await Promise.all([
    supabase.from("event_members").select("event_id").eq("user_id", userId),
    supabase.from("events").select("id").eq("created_by", userId),
  ]);
  const ids = unique([
    ...(memberRes.data || []).map((r) => r.event_id),
    ...(createdRes.data || []).map((e) => e.id),
  ]);
  if (ids.length === 0) {
    return { events: [], totals: { owed: 0, owe: 0 }, profilesById: {} };
  }

  const [eventsRes, membersRes, expensesRes, paymentsRes] = await Promise.all([
    supabase.from("events").select("*").in("id", ids),
    supabase.from("event_members").select("event_id, user_id").in("event_id", ids),
    supabase.from("expenses").select("*").in("event_id", ids),
    supabase.from("payments").select("*").in("event_id", ids).eq("status", "paid"),
  ]);

  const memberRows = membersRes.data || [];
  const userIds = unique(memberRows.map((m) => m.user_id));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select(PROFILE_FIELDS).in("id", userIds)
    : { data: [] };
  const profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const totals = { owed: 0, owe: 0 };
  const events = (eventsRes.data || []).map((event) => {
    const members = unique(
      memberRows.filter((m) => m.event_id === event.id).map((m) => m.user_id),
    )
      .map((id) => profilesById[id])
      .filter(Boolean);
    const byName = nameLookup(members);
    const expenses = (expensesRes.data || [])
      .filter((e) => e.event_id === event.id)
      .map((e) => normalizeExpense(e, byName));
    const payments = (paymentsRes.data || [])
      .filter((p) => p.event_id === event.id)
      .map((p) => normalizePayment(p, byName));
    const calc = calculateSplit(
      expenses,
      members.map((m) => m.id),
      payments,
    );
    const myBalance = calc.balanceById[userId] || 0;
    if (myBalance > 0.004) totals.owed += myBalance;
    if (myBalance < -0.004) totals.owe += -myBalance;
    return {
      ...event,
      members,
      total: calc.total,
      myBalance,
      expenseCount: expenses.length,
    };
  });

  events.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return { events, totals, profilesById };
}
