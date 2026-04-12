// src/utils/crossRefEngine.js
// Cross-references insights (trends, anomalies, recurring) with predictions
// (budget warnings, category forecasts) to produce compound signals that no
// single engine would surface on its own.
//
// Output shape: [{ id, type, severity, title, message, category?, meta? }]

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

  // Helper: savings rate from raw insights list (if present)
  const savingsInsight = (insights.insights || []).find(i => i.type === 'savings_rate');

  // ---- 1. Compound: budget approaching/exceeded AND spending trend up ----
  warnings.forEach(w => {
    const cat = w.category;
    const pats = patternsByCat.get(cat) || [];
    const increasing = pats.find(p => p.type === 'spending_increase');

    if (w.type === 'exceeded' && increasing) {
      signals.push({
        id: `cx_exceeded_up_${cat}`,
        type: 'compound_budget_trend',
        severity: 'high',
        category: cat,
        title: 'Budget Exceeded & Still Climbing',
        message: `${cat} is already over budget (${Math.round((w.spent / w.allocated) * 100)}%) and spending is ${increasing.percentChange}% above your 3-month average. Consider pausing new ${cat} expenses this month.`,
      });
    } else if ((w.type === 'projected_exceed' || w.type === 'approaching') && increasing) {
      signals.push({
        id: `cx_approach_up_${cat}`,
        type: 'compound_budget_trend',
        severity: 'high',
        category: cat,
        title: 'Budget At Risk — Trend Is Up',
        message: `${cat} is at ${Math.round((w.spent / w.allocated) * 100)}% of budget AND spending is ${increasing.percentChange}% above your 3-month average. At this rate you'll blow past ¤${w.allocated.toFixed(0)} before month-end.`,
      });
    }
  });

  // ---- 2. Compound: anomaly inside a category that's already at/over budget ----
  warnings.forEach(w => {
    if (w.type !== 'exceeded' && w.type !== 'projected_exceed' && w.type !== 'approaching') return;
    const anoms = anomaliesByCat.get(w.category) || [];
    if (anoms.length === 0) return;
    const biggest = anoms.reduce((a, b) => (b.amount > a.amount ? b : a), anoms[0]);
    signals.push({
      id: `cx_anom_budget_${w.category}_${biggest.transaction?.id || biggest.transaction?.date || 'x'}`,
      type: 'compound_anomaly_budget',
      severity: w.type === 'exceeded' ? 'high' : 'medium',
      category: w.category,
      title: 'Unusual Expense Inside Tight Budget',
      message: `An unusually large ${w.category} expense of ¤${Number(biggest.amount).toFixed(2)} landed while the ${w.category} budget is ${Math.round((w.spent / w.allocated) * 100)}% used. This single transaction is driving the overrun.`,
    });
  });

  // ---- 3. Forecast vs budget — predicted to exceed even if current spend is low ----
  budgets.forEach(b => {
    const fc = catForecasts[b.category];
    if (!fc || !fc.predicted) return;
    const allocated = parseFloat(b.allocated);
    if (!allocated || allocated <= 0) return;
    if (fc.predicted > allocated * 1.1) {
      const w = warnings.find(x => x.category === b.category && x.type === 'exceeded');
      if (w) return; // already covered by stronger signal
      signals.push({
        id: `cx_forecast_over_${b.category}`,
        type: 'forecast_vs_budget',
        severity: fc.predicted > allocated * 1.3 ? 'medium' : 'low',
        category: b.category,
        title: 'Forecast Exceeds Budget',
        message: `Based on your 6-month trend, ${b.category} is forecast at ¤${Math.round(fc.predicted)} next month — ${Math.round(((fc.predicted - allocated) / allocated) * 100)}% over your ¤${allocated.toFixed(0)} budget. Consider raising the cap or trimming the category.`,
      });
    }
  });

  // ---- 4. Recurring subscription inside an over-budget category ----
  warnings.forEach(w => {
    if (w.type !== 'exceeded') return;
    const recs = recurring.filter(r => r.category === w.category);
    if (recs.length === 0) return;
    const total = recs.reduce((s, r) => s + Number(r.averageAmount || r.amount || 0), 0);
    if (total <= 0) return;
    signals.push({
      id: `cx_recurring_${w.category}`,
      type: 'recurring_vs_budget',
      severity: 'medium',
      category: w.category,
      title: 'Recurring Charges In Over-Budget Category',
      message: `${recs.length} recurring charge${recs.length > 1 ? 's' : ''} (~¤${total.toFixed(0)}/mo) sit inside ${w.category}, which is already over budget. Cancelling even one could bring you back under.`,
    });
  });

  // ---- 5. Low savings rate + overall expense trend rising ----
  const totalFc = predictions.totalForecast;
  if (savingsInsight && savingsInsight.severity === 'high' && totalFc && (totalFc.trend || 0) > 0) {
    signals.push({
      id: 'cx_savings_trend',
      type: 'savings_and_trend',
      severity: 'high',
      title: 'Savings Thin & Expenses Rising',
      message: `Your savings rate is low and total expenses are trending up (forecast ¤${Math.round(totalFc.predicted)} next month). This combination shrinks your buffer fast — prioritise cutting the categories flagged above.`,
    });
  }

  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  return signals.sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
}

export default generateCrossReferenceSignals;
