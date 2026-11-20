// Loading + normalizing event data so every screen works with user IDs.
// Rows written before the ID migration (or by older app builds) only have
// names, so we fall back to matching names against the event's members.
import { toDateKey } from "./format";
import { supabase } from "./supabase";

const PROFILE_FIELDS =
  "id, username, display_name, email, paypal_username, avatar_url";

function asObject(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) || {};
    } catch {
      return {};
    }
  }
  return value;
}

export async function loadMembers(eventId) {
  const { data: rows } = await supabase
    .from("event_members")
    .select("user_id")
    .eq("event_id", eventId);
  const ids = [...new Set((rows || []).map((r) => r.user_id))];
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .in("id", ids);
  return data || [];
}

export async function loadEventData(eventId) {
  const [members, expensesRes, paymentsRes] = await Promise.all([
    loadMembers(eventId),
    supabase.from("expenses").select("*").eq("event_id", eventId),
    supabase
      .from("payments")
      .select("*")
      .eq("event_id", eventId)
      .eq("status", "paid"),
  ]);
  const byName = nameLookup(members);
  return {
    members,
    expenses: (expensesRes.data || []).map((e) => normalizeExpense(e, byName)),
    payments: (paymentsRes.data || []).map((p) => normalizePayment(p, byName)),
  };
}

// display name / email -> user id. A name shared by two members is left out,
// since there's no way to tell them apart from the name alone.
export function nameLookup(members) {
  const counts = {};
  members.forEach((m) => {
    if (m.display_name) counts[m.display_name] = (counts[m.display_name] || 0) + 1;
  });
  const byName = {};
  members.forEach((m) => {
    if (m.email) byName[m.email] = m.id;
  });
  members.forEach((m) => {
    if (m.display_name && counts[m.display_name] === 1) byName[m.display_name] = m.id;
  });
  return byName;
}

export function normalizeExpense(e, byName) {
  let customById = asObject(e.custom_split_ids);
  if (Object.keys(customById).length === 0) {
    customById = {};
    Object.entries(asObject(e.custom_splits)).forEach(([name, amt]) => {
      const id = byName[name];
      if (id) customById[id] = amt;
    });
  }
  return {
    ...e,
    amount: Number(e.amount) || 0,
    paidById: e.paid_by_id || byName[e.paid_by] || null,
    splitIds: Array.isArray(e.split_member_ids) ? e.split_member_ids : [],
    customById,
    // the day it happened (falls back to when it was added)
    dateKey: e.expense_date || (e.created_at ? toDateKey(e.created_at) : null),
  };
}

export function normalizePayment(p, byName) {
  return {
    ...p,
    amount: Number(p.amount) || 0,
    fromId: p.from_id || byName[p.from_name] || null,
    toId: p.to_id || byName[p.to_name] || null,
    dateKey: p.created_at ? toDateKey(p.created_at) : null,
  };
}

// Display name for a user ID, falling back to a stored name (e.g. someone who
// has left the event).
export function nameFor(id, members, fallback = "Unknown") {
  return members.find((m) => m.id === id)?.display_name || fallback;
}

// Custom amounts in both formats: by ID (current) and by name (read by
// older app builds that are still installed on people's phones).
export function customSplitFields(customById, members) {
  const custom_split_ids = {};
  const custom_splits = {};
  Object.entries(customById).forEach(([id, amt]) => {
    const value = Math.round(parseFloat(amt) * 100) / 100;
    if (!(value > 0)) return;
    custom_split_ids[id] = value;
    const name = members.find((m) => m.id === id)?.display_name;
    if (name) custom_splits[name] = value;
  });
  return { custom_split_ids, custom_splits };
}

const money = (n) => `$${n.toFixed(2)}`;

// Returns an error message, or "" if the expense is OK to save.
export function validateExpense({ name, amount, selectedIds, customById }) {
  if (!name.trim()) return "Give the expense a name.";
  const total = Number(amount);
  if (!amount || !Number.isFinite(total) || total <= 0)
    return "Enter a valid amount, like 12.50.";
  if (selectedIds.length === 0) return "Pick at least one person to split with.";

  const entered = selectedIds
    .filter((id) => customById[id] !== undefined && customById[id] !== "")
    .map((id) => Number(customById[id]));
  if (entered.some((v) => !Number.isFinite(v) || v < 0))
    return "One of the custom amounts isn't a valid number.";
  // 0 means "auto" (an even share), same as leaving it blank.
  const customs = entered.filter((v) => v > 0);

  const toCents = (v) => Math.round(v * 100);
  const customCents = customs.reduce((s, v) => s + toCents(v), 0);
  const totalCents = toCents(total);
  if (customCents > totalCents)
    return `Custom amounts add up to ${money(customCents / 100)}, which is more than the ${money(total)} total.`;
  if (customs.length === selectedIds.length && customCents !== totalCents)
    return `Everyone has a custom amount, but they add up to ${money(customCents / 100)} instead of ${money(total)}.`;
  return "";
}
