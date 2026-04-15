// src/utils/insightsEngine.js
// FR-5: AI-Powered Spending Insights Engine
// Analyses transaction history to generate personalised financial insights

/**
 * Calculate the mean of an array of numbers
 */
function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squareDiffs = arr.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

/**
 * Group transactions by month (YYYY-MM format)
 */
function groupByMonth(transactions) {
  const grouped = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });
  return grouped;
}

/**
 * Group transactions by category
 */
function groupByCategory(transactions) {
  const grouped = {};
  transactions.forEach(t => {
    const cat = t.category || 'Uncategorised';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });
  return grouped;
}

/**
 * Get the last N months as YYYY-MM strings
 */
function getLastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/**
 * FR-5.1: Compare current month spending to 3-month rolling average per category
 */
export function analyseSpendingPatterns(transactions) {
  const expenses = transactions.filter(t => t.type === 'expense');
  const byMonth = groupByMonth(expenses);
  const months = getLastNMonths(4); // current + 3 previous
  const currentMonth = months[0];
  const previousMonths = months.slice(1, 4);

  const byCategory = groupByCategory(expenses);
  const insights = [];

  Object.keys(byCategory).forEach(category => {
    const catExpenses = byCategory[category];
    
    // Current month total for this category
    const currentTotal = catExpenses
      .filter(t => {
        const d = new Date(t.date);
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return m === currentMonth;
      })
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    // 3-month average for this category
    const prevTotals = previousMonths.map(month => {
      return catExpenses
        .filter(t => {
          const d = new Date(t.date);
          const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          return m === month;
        })
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    });

    const avg3Month = mean(prevTotals.filter(v => v > 0));
    
    if (avg3Month > 0 && currentTotal > 0) {
      const percentChange = ((currentTotal - avg3Month) / avg3Month) * 100;
      
      if (percentChange > 20) {
        insights.push({
          type: 'spending_increase',
          category,
          severity: percentChange > 50 ? 'high' : 'medium',
          message: `Your ${category} spending is ${Math.round(percentChange)}% above your 3-month average this month.`,
          currentAmount: currentTotal,
          averageAmount: avg3Month,
          percentChange: Math.round(percentChange),
        });
      } else if (percentChange < -20) {
        insights.push({
          type: 'spending_decrease',
          category,
          severity: 'positive',
          message: `Great job! Your ${category} spending is ${Math.abs(Math.round(percentChange))}% below your 3-month average.`,
          currentAmount: currentTotal,
          averageAmount: avg3Month,
          percentChange: Math.round(percentChange),
        });
      }
    }
  });

  return insights;
}

/**
 * FR-5.2: Detect anomalous transactions using standard deviation
 * Flags transactions that are more than 2 standard deviations from the category mean
 */
export function detectAnomalies(transactions) {
  const expenses = transactions.filter(t => t.type === 'expense');
  const byCategory = groupByCategory(expenses);
  const anomalies = [];

  Object.keys(byCategory).forEach(category => {
    const amounts = byCategory[category].map(t => Math.abs(parseFloat(t.amount)));
    
    if (amounts.length < 3) return; // Need at least 3 data points
    
    const avg = mean(amounts);
    const sd = stdDev(amounts);
    
    if (sd === 0) return; // All same amount, no anomalies possible
    
    byCategory[category].forEach(t => {
      const amount = Math.abs(parseFloat(t.amount));
      const zScore = (amount - avg) / sd;
      
      if (zScore > 2) {
        anomalies.push({
          type: 'anomaly',
          transaction: t,
          category,
          severity: zScore > 3 ? 'high' : 'medium',
          message: `Unusual ${category} transaction: ¤${amount.toFixed(2)} is significantly higher than your average of ¤${avg.toFixed(2)}.`,
          amount,
          average: avg,
          zScore: Math.round(zScore * 10) / 10,
        });
      }
    });
  });

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

/**
 * FR-5.3: Identify recurring transactions based on amount and frequency patterns
 * Looks for transactions with similar amounts appearing at regular intervals
 */
export function detectRecurringTransactions(transactions) {
  const recurring = [];
  const checked = new Set();

  transactions.forEach(t1 => {
    if (checked.has(t1.id)) return;
    
    const amount1 = Math.abs(parseFloat(t1.amount));
    const tolerance = amount1 * 0.05; // 5% tolerance
    
    // Find similar transactions (same category, similar amount)
    const similar = transactions.filter(t2 => 
      t2.id !== t1.id &&
      t2.category === t1.category &&
      Math.abs(Math.abs(parseFloat(t2.amount)) - amount1) <= tolerance
    );

    if (similar.length >= 1) {
      // Check if they occur at regular intervals
      const allDates = [t1, ...similar]
        .map(t => new Date(t.date))
        .sort((a, b) => a - b);

      if (allDates.length >= 2) {
        const intervals = [];
        for (let i = 1; i < allDates.length; i++) {
          const daysDiff = Math.round((allDates[i] - allDates[i-1]) / (1000 * 60 * 60 * 24));
          intervals.push(daysDiff);
        }

        const avgInterval = mean(intervals);
        const intervalSD = stdDev(intervals);

        // If intervals are roughly consistent (SD < 30% of mean)
        let frequency = null;
        if (avgInterval >= 25 && avgInterval <= 35) frequency = 'monthly';
        else if (avgInterval >= 12 && avgInterval <= 17) frequency = 'bi-weekly';
        else if (avgInterval >= 5 && avgInterval <= 9) frequency = 'weekly';

        if (frequency && (intervalSD < avgInterval * 0.3 || intervals.length === 1)) {
          const ids = [t1.id, ...similar.map(s => s.id)];
          ids.forEach(id => checked.add(id));
          
          recurring.push({
            type: 'recurring',
            description: t1.description || t1.category,
            category: t1.category,
            amount: amount1,
            frequency,
            occurrences: allDates.length,
            message: `Recurring ${frequency} ${t1.type}: ${t1.description || t1.category} (¤${amount1.toFixed(2)})`,
            nextExpected: new Date(allDates[allDates.length - 1].getTime() + avgInterval * 24 * 60 * 60 * 1000),
          });
        }
      }
    }
  });

  return recurring;
}

/**
 * Analyse savings goals for deadline risk, pace, and progress.
 * @param {Array} goals - [{ id, name, target, saved, deadline, icon }]
 * @param {Array} transactions - used for context (monthly savings rate)
 * @returns {Array} insights
 */
export function analyseGoals(goals, transactions) {
  if (!Array.isArray(goals) || goals.length === 0) return [];

  const insights = [];
  const now = new Date();
  const todayMs = now.getTime();

  // Estimate monthly net savings from last 90 days
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);
  const recent = (transactions || []).filter(t => new Date(t.date) >= ninetyDaysAgo);
  const recentExpenses = recent.filter(t => t.type === 'expense')
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
  const recentIncome = recent.filter(t => t.type === 'income')
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
  const monthlyNet = Math.max(0, (recentIncome - recentExpenses) / 3);

  goals.forEach(g => {
    const target = parseFloat(g.target) || 0;
    const saved = parseFloat(g.saved) || 0;
    if (target <= 0) return;

    const remaining = Math.max(0, target - saved);
    const progress = saved / target;

    if (saved >= target) {
      insights.push({
        type: 'goal_completed',
        severity: 'positive',
        goalId: g.id,
        goalName: g.name,
        message: `"${g.name}" reached — target of ¤${target.toFixed(2)} saved.`,
      });
      return;
    }

    if (!g.deadline) {
      if (progress < 0.1 && saved < 10) {
        insights.push({
          type: 'goal_progress',
          severity: 'info',
          goalId: g.id,
          goalName: g.name,
          message: `Haven't started on "${g.name}" yet. Add a Savings transaction with "${g.name}" in the description to contribute automatically.`,
        });
      }
      return;
    }

    const deadline = new Date(g.deadline);
    if (isNaN(deadline.getTime())) return;
    const daysLeft = Math.ceil((deadline.getTime() - todayMs) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      insights.push({
        type: 'goal_overdue',
        severity: 'high',
        goalId: g.id,
        goalName: g.name,
        message: `"${g.name}" deadline passed ${Math.abs(daysLeft)} days ago — ¤${remaining.toFixed(2)} still needed. Extend the deadline or adjust the target.`,
      });
      return;
    }

    if (daysLeft <= 7) {
      insights.push({
        type: 'goal_deadline_urgent',
        severity: 'high',
        goalId: g.id,
        goalName: g.name,
        daysLeft,
        message: `"${g.name}" deadline in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — ¤${remaining.toFixed(2)} left to save.`,
      });
    } else if (daysLeft <= 14) {
      insights.push({
        type: 'goal_deadline_soon',
        severity: 'medium',
        goalId: g.id,
        goalName: g.name,
        daysLeft,
        message: `"${g.name}" deadline in ${daysLeft} days — ¤${remaining.toFixed(2)} left to save.`,
      });
    } else if (daysLeft <= 30) {
      insights.push({
        type: 'goal_deadline_approaching',
        severity: 'info',
        goalId: g.id,
        goalName: g.name,
        daysLeft,
        message: `"${g.name}" deadline in ${daysLeft} days.`,
      });
    }

    if (daysLeft > 0 && remaining > 0) {
      const monthsLeft = Math.max(1, daysLeft / 30);
      const neededPerMonth = remaining / monthsLeft;

      if (monthlyNet > 0 && neededPerMonth > monthlyNet * 1.5) {
        insights.push({
          type: 'goal_behind_pace',
          severity: 'medium',
          goalId: g.id,
          goalName: g.name,
          message: `To hit "${g.name}" on time you'd need ¤${neededPerMonth.toFixed(0)}/month. You're averaging ¤${monthlyNet.toFixed(0)}/month — consider cutting spending or extending the deadline.`,
        });
      } else if (monthlyNet > 0 && neededPerMonth < monthlyNet * 0.5 && progress > 0.3) {
        insights.push({
          type: 'goal_ahead_of_pace',
          severity: 'positive',
          goalId: g.id,
          goalName: g.name,
          message: `You're on track for "${g.name}" — only ¤${neededPerMonth.toFixed(0)}/month needed, well within your savings rate.`,
        });
      }
    }
  });

  return insights;
}

/**
 * FR-5.5: Detect recently-added backdated transactions
 * Flags transactions whose date is significantly older than when they were
 * likely added (detected by comparing transaction date to the current month).
 * This helps users and the forecast engine understand that past-period data
 * has changed and totals for those periods have been retroactively updated.
 */
export function detectBackdatedTransactions(transactions) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const insights = [];

  // Group transactions by their month
  const byMonth = groupByMonth(transactions);

  // Look for months (other than current) that have transactions and check
  // if any of those months got significantly more data recently. We detect
  // this by finding transactions whose `created_at` (if available) is much
  // newer than their `date`. If `created_at` isn't available, we look for
  // transactions dated more than 60 days in the past — these are likely
  // backdated entries from receipt scans.
  const pastExpenses = transactions.filter(t => {
    if (t.type !== 'expense') return false;
    const txDate = new Date(t.date);
    const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    if (txMonthKey === currentMonthKey) return false;

    // Check if created_at is significantly newer than the transaction date
    if (t.created_at) {
      const createdDate = new Date(t.created_at);
      const daysBetween = Math.floor((createdDate - txDate) / (1000 * 60 * 60 * 24));
      return daysBetween > 30; // Added more than 30 days after the transaction date
    }

    // Fallback: flag transactions dated more than 60 days ago
    const daysAgo = Math.floor((now - txDate) / (1000 * 60 * 60 * 24));
    return daysAgo > 60;
  });

  if (pastExpenses.length === 0) return insights;

  // Group backdated transactions by their target month
  const backdatedByMonth = {};
  pastExpenses.forEach(t => {
    const txDate = new Date(t.date);
    const monthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}`;
    if (!backdatedByMonth[monthKey]) backdatedByMonth[monthKey] = [];
    backdatedByMonth[monthKey].push(t);
  });

  // Only surface months where backdated entries are significant
  Object.entries(backdatedByMonth).forEach(([monthKey, txns]) => {
    const total = txns.reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
    const allMonthTxns = byMonth[monthKey] || [];
    const monthTotal = allMonthTxns
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);

    // Only flag if backdated amounts are meaningful (>10% of the month's total or >0)
    if (total > 0 && monthTotal > 0) {
      const pct = Math.round((total / monthTotal) * 100);
      const monthLabel = new Date(monthKey + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

      if (pct >= 10) {
        insights.push({
          type: 'backdated_entries',
          severity: 'info',
          category: null,
          message: `${txns.length} backdated transaction${txns.length > 1 ? 's' : ''} (¤${total.toFixed(2)}) ${txns.length > 1 ? 'were' : 'was'} added to ${monthLabel}, accounting for ${pct}% of that month's expenses. Historical trends and forecasts have been updated to reflect this.`,
          monthKey,
          backdatedCount: txns.length,
          backdatedTotal: total,
        });
      }
    }
  });

  return insights;
}

/**
 * FR-5.4: Generate personalised dashboard insights
 * Combines all analysis into a prioritised list of insights
 */
export function generateInsights(transactions, goals) {
  if (!transactions || transactions.length === 0) {
    return {
      insights: [],
      summary: { totalInsights: 0, hasAnomalies: false, hasRecurring: false },
    };
  }

  const spendingPatterns = analyseSpendingPatterns(transactions);
  const anomalies = detectAnomalies(transactions);
  const recurring = detectRecurringTransactions(transactions);
  const backdated = detectBackdatedTransactions(transactions);

  // Additional summary insights
  const expenses = transactions.filter(t => t.type === 'expense');
  const income = transactions.filter(t => t.type === 'income');
  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
  const totalIncome = income.reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);

  const summaryInsights = [];

  // Savings rate insight
  if (totalIncome > 0) {
    const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
    if (savingsRate > 30) {
      summaryInsights.push({
        type: 'savings_rate',
        severity: 'positive',
        message: `Excellent savings rate of ${Math.round(savingsRate)}%! You're saving well.`,
        value: Math.round(savingsRate),
      });
    } else if (savingsRate < 10 && savingsRate >= 0) {
      summaryInsights.push({
        type: 'savings_rate',
        severity: 'medium',
        message: `Your savings rate is ${Math.round(savingsRate)}%. Consider reducing expenses to save more.`,
        value: Math.round(savingsRate),
      });
    } else if (savingsRate < 0) {
      summaryInsights.push({
        type: 'savings_rate',
        severity: 'high',
        message: `You're spending more than you earn this period. Your expenses exceed income by ¤${Math.abs(totalIncome - totalExpenses).toFixed(2)}.`,
        value: Math.round(savingsRate),
      });
    }
  }

  // Top spending category
  const byCategory = groupByCategory(expenses);
  const catTotals = Object.entries(byCategory).map(([cat, txns]) => ({
    category: cat,
    total: txns.reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0),
  })).sort((a, b) => b.total - a.total);

  if (catTotals.length > 0) {
    const topCat = catTotals[0];
    const pct = totalExpenses > 0 ? Math.round((topCat.total / totalExpenses) * 100) : 0;
    summaryInsights.push({
      type: 'top_category',
      severity: pct > 60 ? 'medium' : 'info',
      message: `${topCat.category} is your top spending category at ¤${topCat.total.toFixed(2)} (${pct}% of total expenses).`,
      category: topCat.category,
      amount: topCat.total,
      percentage: pct,
    });
  }

  const goalInsights = analyseGoals(goals, transactions);

  // Combine all insights, sorted by severity
  const severityOrder = { high: 0, medium: 1, positive: 2, info: 3 };
  const allInsights = [
    ...goalInsights,
    ...summaryInsights,
    ...spendingPatterns,
    ...anomalies.slice(0, 3), // Top 3 anomalies only
    ...recurring,
    ...backdated,
  ].sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  return {
    insights: allInsights,
    spendingPatterns,
    anomalies,
    recurring,
    backdated,
    goalInsights,
    summary: {
      totalInsights: allInsights.length,
      hasAnomalies: anomalies.length > 0,
      hasRecurring: recurring.length > 0,
      hasBackdated: backdated.length > 0,
      hasGoalAlerts: goalInsights.some(g => g.severity === 'high' || g.severity === 'medium'),
      savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
    },
  };
}

export default generateInsights;
