export function calculateSplit(expenses, members) {
  // Step 1: total spent
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Step 2: fair share per person
  const fairShare = total / members.length;

  // Step 3: how much each person actually spent
  const spent = {};
  members.forEach((m) => (spent[m] = 0));
  expenses.forEach((e) => {
    spent[e.paidBy] += e.amount;
  });

  // Step 4: balance per person
  // positive = overpaid (owed money)
  // negative = underpaid (owes money)
  const balances = {};
  members.forEach((m) => {
    balances[m] = spent[m] - fairShare;
  });

  // Step 5: separate creditors and debtors
  const creditors = [];
  const debtors = [];
  Object.entries(balances).forEach(([member, balance]) => {
    if (balance > 0.01) creditors.push({ member, amount: balance });
    if (balance < -0.01) debtors.push({ member, amount: Math.abs(balance) });
  });

  // Step 6: proportional payments
  const totalOwed = creditors.reduce((s, c) => s + c.amount, 0);
  const payments = [];
  debtors.forEach((debtor) => {
    creditors.forEach((creditor) => {
      const proportion = creditor.amount / totalOwed;
      const payment = debtor.amount * proportion;
      if (payment > 0.01) {
        payments.push({
          from: debtor.member,
          to: creditor.member,
          amount: Math.round(payment * 100) / 100,
        });
      }
    });
  });

  return {
    total: Math.round(total * 100) / 100,
    fairShare: Math.round(fairShare * 100) / 100,
    payments,
  };
}
