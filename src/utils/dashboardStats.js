import { BUCKET_MAP } from './bucketMap';

function spentForBudgetCategory(category, spendByCat) {
  const tracks = BUCKET_MAP[category] || [category];
  return tracks.reduce((s, c) => s + (spendByCat[c] || 0), 0);
}

export function computeDashboardFromData(allTransactions = [], budgetsData = []) {
  const income = allTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const expenses = allTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const now = new Date();
  const thisMonthKey = now.toISOString().slice(0, 7);
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonthKey = prev.toISOString().slice(0, 7);

  const sumBy = (txns, type, key) => txns
    .filter(t => t.type === type && (t.date || '').slice(0, 7) === key)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  const thisMonthIncome = sumBy(allTransactions, 'income', thisMonthKey);
  const lastMonthIncome = sumBy(allTransactions, 'income', lastMonthKey);
  const thisMonthExpenses = sumBy(allTransactions, 'expense', thisMonthKey);
  const lastMonthExpenses = sumBy(allTransactions, 'expense', lastMonthKey);

  const thisMonthSpendByCat = allTransactions
    .filter(t => t.type === 'expense' && (t.date || '').slice(0, 7) === thisMonthKey)
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0);
      return acc;
    }, {});

  const thisMonthBudgets = (budgetsData || []).filter(b => b.month_year === thisMonthKey);
  const totalAllocated = thisMonthBudgets.reduce((s, b) => s + parseFloat(b.allocated || 0), 0);

  const plannedSpending = thisMonthBudgets.reduce((s, b) => {
    const spent = spentForBudgetCategory(b.category, thisMonthSpendByCat);
    const cap = parseFloat(b.allocated || 0);
    return s + Math.min(spent, cap);
  }, 0);

  const remainingInBudgets = Math.max(0, totalAllocated - plannedSpending);
  const unallocated = Math.max(0, thisMonthIncome - totalAllocated);
  const unplannedSpending = Math.max(0, thisMonthExpenses - plannedSpending);
  const hasBudgetsThisMonth = thisMonthBudgets.length > 0;
  const savedThisMonth = thisMonthSpendByCat['Savings'] || 0;

  const categoryTotals = allTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0);
      return acc;
    }, {});

  const spentByCategory = allTransactions
    .filter(t => t.type === 'expense' && (t.date || '').slice(0, 7) === thisMonthKey)
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0);
      return acc;
    }, {});

  const budgetsWithSpent = thisMonthBudgets.map(b => ({
    ...b,
    spent: spentForBudgetCategory(b.category, spentByCategory),
  }));

  const recentTransactions = [...allTransactions]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  return {
    stats: {
      balance: income - expenses,
      income,
      expenses,
      thisMonthIncome,
      lastMonthIncome,
      thisMonthExpenses,
      lastMonthExpenses,
      remainingInBudgets,
      unallocated,
      unplannedSpending,
      savedThisMonth,
      hasBudgetsThisMonth,
    },
    expensesByCategory: categoryTotals,
    recentTransactions,
    budgetsWithSpent,
  };
}
