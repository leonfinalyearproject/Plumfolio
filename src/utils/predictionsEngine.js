// src/utils/predictionsEngine.js
// FR-6: Predictive Budgeting Engine
// Forecasts future expenses using weighted moving averages and trend analysis

/**
 * Calculate weighted moving average
 * More recent months have higher weights
 */
function weightedMovingAverage(values) {
  if (values.length === 0) return 0;
  
  // Weights: most recent gets highest weight
  // e.g., for 6 months: [1, 2, 3, 4, 5, 6] - most recent = 6
  const weights = values.map((_, i) => i + 1);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  
  let weightedSum = 0;
  values.forEach((val, i) => {
    weightedSum += val * weights[i];
  });
  
  return weightedSum / totalWeight;
}

/**
 * Calculate linear trend (slope) using least squares regression
 */
function calculateTrend(values) {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const x = values.map((_, i) => i);
  const y = values;
  
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  return slope;
}

/**
 * Get monthly totals for the last N months
 */
function getMonthlyTotals(transactions, type, months) {
  const totals = [];
  const now = new Date();
  
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    const monthTotal = transactions
      .filter(t => {
        if (t.type !== type) return false;
        const td = new Date(t.date);
        const tKey = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}`;
        return tKey === monthKey;
      })
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    
    totals.push({ month: monthKey, total: monthTotal });
  }
  
  return totals;
}

/**
 * Get monthly totals per category
 */
function getCategoryMonthlyTotals(transactions, months) {
  const categories = {};
  const expenses = transactions.filter(t => t.type === 'expense');
  
  // Get unique categories
  const uniqueCats = [...new Set(expenses.map(t => t.category || 'Uncategorised'))];
  
  uniqueCats.forEach(cat => {
    const catTransactions = expenses.filter(t => (t.category || 'Uncategorised') === cat);
    categories[cat] = getMonthlyTotals(catTransactions, 'expense', months);
  });
  
  return categories;
}

/**
 * FR-6.1: Forecast total expenses for next month
 */
export function forecastTotalExpenses(transactions, lookbackMonths = 6) {
  const monthlyTotals = getMonthlyTotals(transactions, 'expense', lookbackMonths);
  const values = monthlyTotals.map(m => m.total);
  const nonZeroValues = values.filter(v => v > 0);
  
  if (nonZeroValues.length < 2) {
    return {
      predicted: 0,
      confidence: 'low',
      method: 'insufficient_data',
      message: 'Not enough transaction history to make a prediction.',
    };
  }
  
  // Weighted moving average (primary method)
  const wma = weightedMovingAverage(nonZeroValues);
  
  // Trend adjustment
  const trend = calculateTrend(nonZeroValues);
  const trendAdjusted = wma + trend;
  
  // Final prediction (average of WMA and trend-adjusted)
  const predicted = Math.max(0, (wma + trendAdjusted) / 2);
  
  // Confidence based on data consistency
  const mean = nonZeroValues.reduce((s, v) => s + v, 0) / nonZeroValues.length;
  const variance = nonZeroValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / nonZeroValues.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 1; // Coefficient of variation
  
  let confidence = 'high';
  if (cv > 0.5) confidence = 'low';
  else if (cv > 0.25) confidence = 'medium';
  
  // Next month name
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthName = nextMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  
  return {
    predicted: Math.round(predicted * 100) / 100,
    confidence,
    method: 'weighted_moving_average_with_trend',
    monthlyData: monthlyTotals,
    trend: Math.round(trend * 100) / 100,
    wma: Math.round(wma * 100) / 100,
    nextMonth: monthName,
    message: `Predicted total expenses for ${monthName}: ¤${predicted.toFixed(2)} (${confidence} confidence)`,
  };
}

/**
 * FR-6.2: Predict spending per category
 */
export function forecastByCategory(transactions, lookbackMonths = 6) {
  const categoryTotals = getCategoryMonthlyTotals(transactions, lookbackMonths);
  const predictions = {};
  
  Object.keys(categoryTotals).forEach(cat => {
    const values = categoryTotals[cat].map(m => m.total);
    const nonZero = values.filter(v => v > 0);
    
    if (nonZero.length < 2) {
      predictions[cat] = {
        predicted: nonZero.length === 1 ? nonZero[0] : 0,
        confidence: 'low',
        trend: 'stable',
      };
      return;
    }
    
    const wma = weightedMovingAverage(nonZero);
    const trend = calculateTrend(nonZero);
    const predicted = Math.max(0, (wma + (wma + trend)) / 2);
    
    let trendDirection = 'stable';
    const meanVal = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
    if (meanVal > 0) {
      const trendPct = (trend / meanVal) * 100;
      if (trendPct > 10) trendDirection = 'increasing';
      else if (trendPct < -10) trendDirection = 'decreasing';
    }
    
    predictions[cat] = {
      predicted: Math.round(predicted * 100) / 100,
      confidence: nonZero.length >= 4 ? 'high' : nonZero.length >= 2 ? 'medium' : 'low',
      trend: trendDirection,
      monthlyData: categoryTotals[cat],
    };
  });
  
  return predictions;
}

/**
 * FR-6.3: Generate suggested budget allocations
 */
export function suggestBudgetAllocations(transactions, lookbackMonths = 6) {
  const categoryPredictions = forecastByCategory(transactions, lookbackMonths);
  const suggestions = [];
  
  Object.entries(categoryPredictions).forEach(([category, pred]) => {
    if (pred.predicted <= 0) return;
    
    // Suggest 10% buffer above predicted spending
    const suggested = Math.round(pred.predicted * 1.1 * 100) / 100;
    
    suggestions.push({
      category,
      suggestedAmount: suggested,
      predictedSpend: pred.predicted,
      confidence: pred.confidence,
      trend: pred.trend,
      buffer: Math.round(suggested - pred.predicted),
      message: `Suggested budget for ${category}: ¤${suggested.toFixed(2)} (based on predicted spend of ¤${pred.predicted.toFixed(2)} + 10% buffer)`,
    });
  });
  
  return suggestions.sort((a, b) => b.suggestedAmount - a.suggestedAmount);
}

/**
 * FR-6.4: Check if projected spending will exceed budgets
 */
export function checkBudgetWarnings(transactions, budgets) {
  if (!budgets || budgets.length === 0) return [];

  // Bucket → child categories mapping (must match Budgets.js).
  // A budget for "Needs" should sum spending across ALL need-y categories,
  // not just transactions literally tagged "Needs".
  const BUCKET_MAP = {
    'Needs':    ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education'],
    'Wants':    ['Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions'],
    'Savings':  ['Savings', 'Investments'],
    'Giving':   ['Gifts & Donations'],
    'Expenses': ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions', 'Other'],
    'Spending': ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions', 'Other'],
  };

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  const warnings = [];

  budgets.forEach(budget => {
    // Only warn on budgets for the CURRENT month. Past-month budgets are
    // historical records; future-month budgets haven't started yet.
    if (budget.month_year && budget.month_year !== currentMonthKey) return;

    // Categories this budget tracks (bucket budgets track multiple).
    const tracks = BUCKET_MAP[budget.category] || [budget.category];

    const spent = transactions
      .filter(t => {
        if (t.type !== 'expense') return false;
        const td = new Date(t.date);
        const tKey = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}`;
        return tKey === currentMonthKey && tracks.includes(t.category || 'Uncategorised');
      })
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    const allocated = parseFloat(budget.allocated);
    if (allocated <= 0) return;

    const spentRatio = spent / allocated;

    // Project spending to end of month based on current rate
    const projectedTotal = monthProgress > 0 ? spent / monthProgress : spent;
    const projectedRatio = projectedTotal / allocated;

    if (spentRatio >= 1) {
      warnings.push({
        type: 'exceeded',
        severity: 'high',
        category: budget.category,
        spent,
        allocated,
        message: `${budget.category} budget exceeded! You've spent ¤${spent.toFixed(2)} of ¤${allocated.toFixed(2)} (${Math.round(spentRatio * 100)}%).`,
      });
    } else if (projectedRatio > 1 && spentRatio < 1) {
      warnings.push({
        type: 'projected_exceed',
        severity: 'medium',
        category: budget.category,
        spent,
        allocated,
        projected: Math.round(projectedTotal),
        message: `At your current pace, ${budget.category} spending will reach ~¤${Math.round(projectedTotal)} by month end, exceeding your ¤${allocated.toFixed(2)} budget.`,
      });
    } else if (spentRatio > 0.8) {
      warnings.push({
        type: 'approaching',
        severity: 'low',
        category: budget.category,
        spent,
        allocated,
        message: `${budget.category} is at ${Math.round(spentRatio * 100)}% of budget (¤${spent.toFixed(2)} of ¤${allocated.toFixed(2)}).`,
      });
    }
  });

  return warnings.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] || 3) - (order[b.severity] || 3);
  });
}

/**
 * Master function: Generate all predictions
 */
export function generatePredictions(transactions, budgets = []) {
  if (!transactions || transactions.length === 0) {
    return {
      totalForecast: { predicted: 0, confidence: 'low', message: 'No data available.' },
      categoryForecasts: {},
      budgetSuggestions: [],
      budgetWarnings: [],
    };
  }
  
  return {
    totalForecast: forecastTotalExpenses(transactions),
    categoryForecasts: forecastByCategory(transactions),
    budgetSuggestions: suggestBudgetAllocations(transactions),
    budgetWarnings: checkBudgetWarnings(transactions, budgets),
  };
}

export default generatePredictions;
