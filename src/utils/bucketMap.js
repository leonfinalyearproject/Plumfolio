// Shared bucket → child category mapping (Budgets, predictions, cross-ref).
export const BUCKET_MAP = {
  Needs: ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education'],
  Wants: ['Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions'],
  Savings: ['Savings', 'Investments'],
  Giving: ['Gifts & Donations'],
  Expenses: ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions', 'Other'],
  Spending: ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions', 'Other'],
};

/** Categories a budget row tracks (bucket or single category). */
export function categoriesForBudget(budgetCategory) {
  return BUCKET_MAP[budgetCategory] || [budgetCategory];
}

/** Sum spending for a budget category (handles buckets). */
export function calcSpentForBudget(budgetCategory, spendingMap) {
  const tracks = categoriesForBudget(budgetCategory);
  return tracks.reduce((sum, cat) => sum + (spendingMap[cat] || 0), 0);
}

/** Resolve spending-pattern / anomaly category to matching budget warnings. */
export function patternMatchesBudget(patternCategory, budgetCategory) {
  if (patternCategory === budgetCategory) return true;
  const tracks = categoriesForBudget(budgetCategory);
  return tracks.includes(patternCategory);
}

/** Aggregate category forecasts for a bucket budget. */
export function forecastForBudget(budgetCategory, categoryForecasts) {
  const tracks = categoriesForBudget(budgetCategory);
  if (!BUCKET_MAP[budgetCategory]) {
    return categoryForecasts[budgetCategory] || null;
  }
  let total = 0;
  let hasData = false;
  tracks.forEach(cat => {
    const fc = categoryForecasts[cat];
    if (fc?.predicted > 0) {
      total += fc.predicted;
      hasData = true;
    }
  });
  return hasData ? { predicted: total } : null;
}
