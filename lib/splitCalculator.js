export function calculateSplit(expenses, members, memberIdsByName = {}) {
  // Step 1: total spent
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Step 2: how much each person should pay
  const shouldPay = {};
  members.forEach((m) => (shouldPay[m] = 0));

  expenses.forEach((expense) => {
    const includedMembers = expense.splitMembers || members;
    const customSplits = expense.customSplits || {};

    // First subtract custom amounts from the total
    let customTotal = 0;
    const customMembers = [];
    for (const [name, amount] of Object.entries(customSplits)) {
      if (includedMembers.includes(name)) {
        shouldPay[name] = (shouldPay[name] || 0) + amount;
        customTotal += amount;
        customMembers.push(name);
      }
    }

    // Then split the remaining amount evenly among non-custom members
    const remaining = expense.amount - customTotal;
    const evenMembers = includedMembers.filter(
      (m) => !customMembers.includes(m),
    );

    if (evenMembers.length > 0 && remaining > 0) {
      const evenShare = remaining / evenMembers.length;
      evenMembers.forEach((m) => {
        shouldPay[m] = (shouldPay[m] || 0) + evenShare;
      });
    }
  });

  // Step 3: how much each person actually paid
  const spent = {};
  members.forEach((m) => (spent[m] = 0));
  expenses.forEach((e) => {
    spent[e.paidBy] = (spent[e.paidBy] || 0) + e.amount;
  });

  // Step 4: balance per person (positive = overpaid, negative = underpaid)
  const balances = {};
  members.forEach((m) => {
    balances[m] = spent[m] - shouldPay[m];
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

  // fairShare is now just the average (for display purposes)
  const fairShare = members.length > 0 ? total / members.length : 0;

  return {
    total: Math.round(total * 100) / 100,
    fairShare: Math.round(fairShare * 100) / 100,
    payments,
    shouldPay,
    spent,
    balances,
  };
}
