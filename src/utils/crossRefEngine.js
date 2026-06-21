// src/utils/crossRefEngine.js
// Cross-references insights with predictions for compound signals.

import { patternMatchesBudget, forecastForBudget } from './bucketMap';

function byCategory(arr, key = 'category') {
  const m = new Map();
  (arr || []).forEach(item => {
    const c = item[key];
    if (!c) return;
    if (!m.has(c)) m.set(c, []);
    m.get(c).push(item);
  });
  return m;
}

function findIncreasingPattern(patternsByCat, budgetCategory) {
  for (const [cat, pats] of patternsByCat.entries()) {
    if (!patternMatchesBudget(cat, budgetCategory)) continue;
    const increasing = pats.find(p => p.type === 'spending_increase');
    if (increasing) return increasing;
  }
  return null;
}

function findAnomaliesForBudget(anomaliesByCat, budgetCategory) {
  const matches = [];
  for (const [cat, anoms] of anomaliesByCat.entries()) {
    if (patternMatchesBudget(cat, budgetCategory)) matches.push(...anoms);
  }
  return matches;
}

export function generateCrossReferenceSignals(insights, predictions, { transactions = [], budgets = [] } = {}) {
  const signals = [];
  if (!insights || !predictions) return signals;

  const patterns = insights.spendingPatterns || insights.patterns || [];
  const anomalies = insights.anomalies || [];
  const recurring = insights.recurring || [];
  const warnings = predictions.budgetWarnings || [];
  const catForecasts = predictions.categoryForecasts || {};

  const patternsByCat = byCategory(patterns);
  const anomaliesByCat = byCategory(anomalies);
  const savingsInsight = (insights.insights || []).find(i => i.type === 'savings_rate');

  // ---- 1. Budget warning + spending trend up (bucket-aware) ----
  warnings.forEach(w => {
    const increasing = findIncreasingPattern(patternsByCat, w.category);
    if (!increasing) return;

    if (w.type === 'exceeded') {
      signals.push({
        id: `cx_exceeded_up_${w.category}`,
        type: 'compound_budget_trend',
        severity: 'high',
        category: w.category,
        title: 'Budget Exceeded & Still Climbing',
        message: `${w.category} is over budget (${Math.round((w.spent / w.allocated) * 100)}%) and related spending is ${increasing.percentChange}% above your 3-month average.`,
      });
    } else if (w.type === 'projected_exceed' || w.type === 'approaching') {
      signals.push({
        id: `cx_approach_up_${w.category}`,
        type: 'compound_budget_trend',
        severity: 'high',
        category: w.category,
        title: 'Budget At Risk — Trend Is Up',
        message: `${w.category} is at ${Math.round((w.spent / w.allocated) * 100)}% of budget and related spending is trending up. At this rate you may exceed ¤${w.allocated.toFixed(0)} before month-end.`,
      });
    }
  });

  // ---- 2. Anomaly inside tight budget (bucket-aware) ----
  warnings.forEach(w => {
    if (w.type !== 'exceeded' && w.type !== 'projected_exceed') return;
    const anoms = findAnomaliesForBudget(anomaliesByCat, w.category);
    if (anoms.length === 0) return;
    const biggest = anoms.reduce((a, b) => (b.amount > a.amount ? b : a), anoms[0]);
    signals.push({
      id: `cx_anom_budget_${w.category}_${biggest.transaction?.id || biggest.transaction?.date || 'x'}`,
      type: 'compound_anomaly_budget',
      severity: w.type === 'exceeded' ? 'high' : 'medium',
      category: w.category,
      title: 'Unusual Expense In Tight Budget',
      message: `An unusually large ${biggest.category || w.category} expense of ¤${Number(biggest.amount).toFixed(2)} landed while ${w.category} is ${Math.round((w.spent / w.allocated) * 100)}% used.`,
    });
  });

  // ---- 3. Forecast vs budget (bucket-aware aggregation) ----
  budgets.forEach(b => {
    const fc = forecastForBudget(b.category, catForecasts);
    if (!fc?.predicted) return;
    const allocated = parseFloat(b.allocated);
    if (!allocated || allocated <= 0) return;
    if (fc.predicted <= allocated * 1.1) return;
    const alreadyExceeded = warnings.some(x => x.category === b.category && x.type === 'exceeded');
    if (alreadyExceeded) return;
    signals.push({
      id: `cx_forecast_over_${b.category}_${b.month_year || 'x'}`,
      type: 'forecast_vs_budget',
      severity: fc.predicted > allocated * 1.3 ? 'medium' : 'low',
      category: b.category,
      title: 'Forecast Exceeds Budget',
      message: `${b.category} is forecast at ¤${Math.round(fc.predicted)} next month — ${Math.round(((fc.predicted - allocated) / allocated) * 100)}% over your ¤${allocated.toFixed(0)} budget.`,
    });
  });

  // ---- 4. Recurring charges in over-budget category ----
  warnings.forEach(w => {
    if (w.type !== 'exceeded') return;
    const recs = recurring.filter(r => patternMatchesBudget(r.category, w.category));
    if (recs.length === 0) return;
    const total = recs.reduce((s, r) => s + Number(r.averageAmount || r.amount || 0), 0);
    if (total <= 0) return;
    signals.push({
      id: `cx_recurring_${w.category}`,
      type: 'recurring_vs_budget',
      severity: 'medium',
      category: w.category,
      title: 'Recurring Charges In Over-Budget Category',
      message: `${recs.length} recurring charge${recs.length > 1 ? 's' : ''} (~¤${total.toFixed(0)}/mo) sit in ${w.category}, which is already over budget.`,
    });
  });

  // ---- 5. Low savings + rising expenses ----
  const totalFc = predictions.totalForecast;
  if (savingsInsight?.severity === 'high' && totalFc && (totalFc.trend || 0) > 0) {
    signals.push({
      id: 'cx_savings_trend',
      type: 'savings_and_trend',
      severity: 'high',
      title: 'Savings Thin & Expenses Rising',
      message: `Your savings rate is low and expenses are trending up (forecast ¤${Math.round(totalFc.predicted)} next month). Review your top spending categories.`,
    });
  }

  // Skip noisy backdated info toasts — surfaced on Insights page instead.

  const order = { high: 0, medium: 1, low: 2, info: 3 };
  return signals.sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
}

export default generateCrossReferenceSignals;
