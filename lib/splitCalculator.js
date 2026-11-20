// Split engine. Everyone is identified by user ID, and all math is done in
// whole cents so balances always add up to exactly zero.
//
// expense: { amount, paidById, splitIds: [userId], customById: { userId: dollars } }
// settlement (a recorded "Paid"): { fromId, toId, amount }

const toCents = (dollars) => Math.round((Number(dollars) || 0) * 100);
const toDollars = (cents) => cents / 100;

// Split `cents` into `count` parts that differ by at most 1 cent and add up exactly.
function spread(cents, count) {
  const base = Math.floor(cents / count);
  let extra = cents - base * count;
  return Array.from({ length: count }, () => {
    if (extra > 0) {
      extra -= 1;
      return base + 1;
    }
    return base;
  });
}

// Scale `weights` (cents) so they add up to exactly `targetCents`.
function scaleTo(weights, targetCents) {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return spread(targetCents, weights.length);
  const raw = weights.map((w) => (w * targetCents) / total);
  const floored = raw.map(Math.floor);
  let left = targetCents - floored.reduce((s, v) => s + v, 0);
  const order = raw
    .map((v, i) => [v - floored[i], i])
    .sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floored[i] += 1;
    left -= 1;
  }
  return floored;
}

// Who owes what for ONE expense. Returns { userId: cents }.
// memberIds = everyone currently in the event.
export function splitExpense(expense, memberIds) {
  const amountCents = toCents(expense.amount);
  const members = new Set(memberIds);

  let included = (expense.splitIds || []).filter((id) => members.has(id));
  if (included.length === 0) included = [...memberIds];
  included = [...new Set(included)].sort();
  if (included.length === 0 || amountCents <= 0) return {};

  const custom = included
    .map((id) => [id, toCents(expense.customById?.[id])])
    .filter(([, c]) => c > 0);
  const customIds = new Set(custom.map(([id]) => id));
  const evenIds = included.filter((id) => !customIds.has(id));
  const customTotal = custom.reduce((s, [, c]) => s + c, 0);

  const shares = {};
  if (customTotal > amountCents) {
    // Custom amounts add up to more than the bill: scale them down to fit.
    const scaled = scaleTo(
      custom.map(([, c]) => c),
      amountCents,
    );
    custom.forEach(([id], i) => (shares[id] = scaled[i]));
    evenIds.forEach((id) => (shares[id] = 0));
    return shares;
  }

  custom.forEach(([id, c]) => (shares[id] = c));
  const remaining = amountCents - customTotal;
  if (remaining > 0) {
    // Everyone has a custom amount but it's short of the bill: spread the
    // rest across everyone on the expense so no money goes missing.
    const takers = evenIds.length > 0 ? evenIds : included;
    spread(remaining, takers.length).forEach((c, i) => {
      shares[takers[i]] = (shares[takers[i]] || 0) + c;
    });
  } else {
    evenIds.forEach((id) => (shares[id] = 0));
  }
  return shares;
}

// Fewest-ish transfers: repeatedly match the biggest debtor with the biggest creditor.
function minimizeTransfers(balanceCents) {
  const creditors = [];
  const debtors = [];
  for (const [id, c] of Object.entries(balanceCents)) {
    if (c > 0) creditors.push({ id, c });
    if (c < 0) debtors.push({ id, c: -c });
  }
  const transfers = [];
  while (creditors.length && debtors.length) {
    creditors.sort((a, b) => b.c - a.c || a.id.localeCompare(b.id));
    debtors.sort((a, b) => b.c - a.c || a.id.localeCompare(b.id));
    const cr = creditors[0];
    const db = debtors[0];
    const pay = Math.min(cr.c, db.c);
    transfers.push({ fromId: db.id, toId: cr.id, amount: toDollars(pay) });
    cr.c -= pay;
    db.c -= pay;
    if (cr.c === 0) creditors.shift();
    if (db.c === 0) debtors.shift();
  }
  return transfers;
}

// Whole-event math.
// Returns dollars: total, shareById (what each person consumed), paidById,
// balanceById (+ = is owed money, - = owes money, after recorded payments),
// and transfers still left to make.
export function calculateSplit(expenses, memberIds, settlements = []) {
  const share = {};
  const paid = {};
  const balance = {};
  const touch = (id) => {
    if (!id) return;
    share[id] ??= 0;
    paid[id] ??= 0;
    balance[id] ??= 0;
  };
  memberIds.forEach(touch);

  let totalCents = 0;
  for (const e of expenses) {
    const cents = toCents(e.amount);
    const shares = splitExpense(e, memberIds);
    if (Object.keys(shares).length === 0) continue;
    totalCents += cents;
    // A payer who has left the event still gets paid back.
    touch(e.paidById);
    if (e.paidById) {
      paid[e.paidById] += cents;
      balance[e.paidById] += cents;
    }
    for (const [id, c] of Object.entries(shares)) {
      share[id] += c;
      balance[id] -= c;
    }
  }

  for (const s of settlements) {
    if (!s.fromId || !s.toId) continue;
    touch(s.fromId);
    touch(s.toId);
    const c = toCents(s.amount);
    balance[s.fromId] += c;
    balance[s.toId] -= c;
  }

  const dollars = (obj) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toDollars(v)]));

  return {
    total: toDollars(totalCents),
    shareById: dollars(share),
    paidById: dollars(paid),
    balanceById: dollars(balance),
    transfers: minimizeTransfers(balance),
  };
}
