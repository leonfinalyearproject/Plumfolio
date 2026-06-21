import { calcSpentForBudget } from './bucketMap';

/** Attach month-scoped spent totals to budget rows. */
export function attachSpentToBudgets(budgetList, expenseTransactions) {
  return (budgetList || []).map(b => {
    const monthExpenses = (expenseTransactions || []).filter(t => {
      const txnMonth = (t.date || '').slice(0, 7);
      return txnMonth === b.month_year;
    });
    const spentByCategory = monthExpenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0);
      return acc;
    }, {});
    return { ...b, spent: calcSpentForBudget(b.category, spentByCategory) };
  });
}
