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
          message: `Unusual ${category} transaction: P${amount.toFixed(2)} is significantly higher than your average of P${avg.toFixed(2)}.`,
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
            message: `Recurring ${frequency} ${t1.type}: ${t1.description || t1.category} (P${amount1.toFixed(2)})`,
            nextExpected: new Date(allDates[allDates.length - 1].getTime() + avgInterval * 24 * 60 * 60 * 1000),
          });
        }
      }
    }
  });

  return recurring;
}

/**
 * FR-5.4: Generate personalised dashboard insights
 * Combines all analysis into a prioritised list of insights
 */
export function generateInsights(transactions) {
  if (!transactions || transactions.length === 0) {
    return {
      insights: [],
      summary: { totalInsights: 0, hasAnomalies: false, hasRecurring: false },
    };
  }

  const spendingPatterns = analyseSpendingPatterns(transactions);
  const anomalies = detectAnomalies(transactions);
  const recurring = detectRecurringTransactions(transactions);

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
        message: `You're spending more than you earn this period. Your expenses exceed income by P${Math.abs(totalIncome - totalExpenses).toFixed(2)}.`,
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
      message: `${topCat.category} is your top spending category at P${topCat.total.toFixed(2)} (${pct}% of total expenses).`,
      category: topCat.category,
      amount: topCat.total,
      percentage: pct,
    });
  }

  // Combine all insights, sorted by severity
  const severityOrder = { high: 0, medium: 1, positive: 2, info: 3 };
  const allInsights = [
    ...summaryInsights,
    ...spendingPatterns,
    ...anomalies.slice(0, 3), // Top 3 anomalies only
    ...recurring,
  ].sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  return {
    insights: allInsights,
    spendingPatterns,
    anomalies,
    recurring,
    summary: {
      totalInsights: allInsights.length,
      hasAnomalies: anomalies.length > 0,
      hasRecurring: recurring.length > 0,
      savingsRate: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0,
    },
  };
}

export default generateInsights;
