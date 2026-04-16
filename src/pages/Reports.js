import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import {
  FileText, Download, Calendar, TrendingUp, TrendingDown,
  PieChart, BarChart3, ArrowUpCircle, ArrowDownCircle, Wallet
} from 'lucide-react';
import './Reports.css';

// Delta line shown beneath each report summary metric
const DeltaLine = ({ label, delta, positiveIsGood }) => {
  if (!delta || !label) return null;
  if (delta.text === 'new') {
    return <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginTop: 2 }}>No data {label}</span>;
  }
  const up = delta.value > 0;
  const flat = Math.abs(delta.value) < 0.5;
  const isGood = positiveIsGood ? up : !up;
  const color = flat ? 'var(--text-secondary)' : (isGood ? '#22C55E' : '#EF4444');
  return (
    <span style={{ fontSize: '0.7rem', color, display: 'block', marginTop: 2 }}>
      {delta.text} {label}
    </span>
  );
};

const Reports = () => {
  const { user } = useAuth();
  const { formatCurrency, symbol } = useCurrency();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const reportRef = useRef(null);

  useEffect(() => {
    if (user) fetchTransactions();
    else setLoading(false);
  }, [user?.id]);

  const fetchTransactions = async () => {
    try {
      const { data } = await supabase.from('transactions').select('*')
        .eq('user_id', user.id).order('date', { ascending: false });
      setTransactions(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Filter by period
  const filtered = transactions.filter(t => {
    if (period === 'month') return t.date?.startsWith(selectedMonth);
    if (period === 'year') return t.date?.startsWith(selectedYear);
    return true;
  });

  const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const net = income - expenses;
  const savingsRate = income > 0 ? ((net / income) * 100).toFixed(1) : '0.0';

  // --- COMPARISON: previous period + same-period-last-year ---
  // For "month" view → compare to previous month AND same month last year.
  // For "year"  view → compare to previous year.
  // For "all"   view → no comparison (nothing to compare against).
  const prevPeriodKey = (() => {
    if (period === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const prev = new Date(y, m - 2, 1); // m-1 is current, m-2 is previous
      return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    }
    if (period === 'year') return String(parseInt(selectedYear, 10) - 1);
    return null;
  })();
  const yoyPeriodKey = period === 'month'
    ? `${parseInt(selectedMonth.slice(0, 4), 10) - 1}${selectedMonth.slice(4)}`
    : null;

  const sumFor = (key, type) => transactions
    .filter(t => t.type === type && t.date && t.date.startsWith(key))
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  const prevIncome   = prevPeriodKey ? sumFor(prevPeriodKey, 'income')  : 0;
  const prevExpenses = prevPeriodKey ? sumFor(prevPeriodKey, 'expense') : 0;
  const prevNet      = prevIncome - prevExpenses;
  const prevSavingsRate = prevIncome > 0 ? (prevNet / prevIncome) * 100 : 0;

  const yoyIncome   = yoyPeriodKey ? sumFor(yoyPeriodKey, 'income')  : 0;
  const yoyExpenses = yoyPeriodKey ? sumFor(yoyPeriodKey, 'expense') : 0;

  // --- All-time totals (ignores the period filter) ---
  // Shown in a dedicated summary below the period stats. When the user is
  // already viewing "All time", we skip this section to avoid duplication.
  const allTimeIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const allTimeExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const allTimeNet      = allTimeIncome - allTimeExpenses;
  const allTimeSavingsRate = allTimeIncome > 0 ? ((allTimeNet / allTimeIncome) * 100).toFixed(1) : '0.0';

  const pctDelta = (curr, prev) => {
    if (!prev && !curr) return null;
    if (!prev) return { text: 'new', good: null };
    const d = ((curr - prev) / prev) * 100;
    return { text: `${d > 0 ? '▲' : d < 0 ? '▼' : '→'} ${Math.abs(d).toFixed(1)}%`, value: d };
  };

  // Category breakdown
  const categoryTotals = filtered.filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount); return acc; }, {});
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0];

  // Income sources
  const incomeSources = filtered.filter(t => t.type === 'income')
    .reduce((acc, t) => { acc[t.description] = (acc[t.description] || 0) + parseFloat(t.amount); return acc; }, {});
  const sortedIncome = Object.entries(incomeSources).sort((a, b) => b[1] - a[1]);

  // Daily average — use the actual number of days in the selected period,
  // not a hardcoded 30/365 (which was wrong for e.g. February or partial months).
  const daysInPeriod = (() => {
    if (period === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number);
      return new Date(y, m, 0).getDate(); // last day of that month
    }
    if (period === 'year') {
      const y = parseInt(selectedYear, 10);
      // leap year check
      return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
    }
    // 'all' → span from first to last transaction date
    if (filtered.length === 0) return 1;
    const sortedDates = [...filtered].map(t => t.date).filter(Boolean).sort();
    const span = Math.ceil((new Date(sortedDates[sortedDates.length - 1]) - new Date(sortedDates[0])) / 86400000) + 1;
    return Math.max(span, 1);
  })();
  const dailyAvg = expenses / Math.max(daysInPeriod, 1);

  // Top 5 transactions
  const topExpenses = [...filtered].filter(t => t.type === 'expense').sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 5);

  const periodLabel = period === 'month'
    ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : period === 'year' ? selectedYear : 'All Time';

  // PDF Export
  const exportPDF = () => {
    const allTxns = filtered.map(t => `
      <tr>
        <td>${new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${t.description}</td>
        <td><span class="cat-pill">${t.category}</span></td>
        <td class="r ${t.type === 'income' ? 'green' : ''}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
      </tr>`).join('');

    const catRows = sortedCategories.map(([cat, amt], i) => {
      const pct = expenses > 0 ? (amt / expenses * 100) : 0;
      const colors = ['#7B2D8E', '#2563EB', '#D97706', '#059669', '#DC2626', '#8B5CF6', '#EC4899', '#14B8A6'];
      return `<tr>
        <td><span class="cat-dot" style="background:${colors[i % colors.length]}"></span>${cat}</td>
        <td><div class="pbar"><div class="pfill" style="width:${pct}%;background:${colors[i % colors.length]}"></div></div></td>
        <td class="r">${pct.toFixed(1)}%</td>
        <td class="r b">${formatCurrency(amt)}</td>
      </tr>`;
    }).join('');

    const incRows = sortedIncome.map(([desc, amt]) =>
      `<tr><td>${desc}</td><td class="r b green">${formatCurrency(amt)}</td></tr>`
    ).join('');

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Plumfolio Report — ${periodLabel}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#1e1b2e;background:#fff;padding:0}
.page{max-width:800px;margin:0 auto;padding:48px 40px}

/* Header */
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #7B2D8E}
.hdr-left h1{font-size:22px;font-weight:800;color:#7B2D8E;letter-spacing:-0.5px}
.hdr-left p{font-size:12px;color:#888;margin-top:3px}
.hdr-right{text-align:right}
.hdr-right .period{font-size:16px;font-weight:700;color:#1e1b2e}
.hdr-right .date{font-size:11px;color:#aaa;margin-top:2px}

/* Summary strip */
.strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
.sbox{padding:16px;border-radius:10px;text-align:center}
.sbox.inc{background:#f0fdf4;border:1px solid #bbf7d0}
.sbox.exp{background:#fef2f2;border:1px solid #fecaca}
.sbox.sav{background:#eff6ff;border:1px solid #bfdbfe}
.sbox.rate{background:#faf5ff;border:1px solid #e9d5ff}
.sbox .sl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:4px}
.sbox .sv{font-size:19px;font-weight:800}
.sbox.inc .sv{color:#16a34a}.sbox.exp .sv{color:#dc2626}
.sbox.sav .sv{color:#2563eb}.sbox.rate .sv{color:#7B2D8E}

/* Section */
.sec{margin-bottom:24px}
.sec-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#7B2D8E;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.sec-title:before{content:'';display:inline-block;width:4px;height:16px;background:#7B2D8E;border-radius:2px}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
th{text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#999;border-bottom:2px solid #eee}
td{padding:8px 10px;border-bottom:1px solid #f5f5f5;vertical-align:middle}
tr:last-child td{border-bottom:none}
.r{text-align:right}.b{font-weight:700}
.green{color:#16a34a}.red{color:#dc2626}

/* Category pills & dots */
.cat-pill{display:inline-block;padding:2px 8px;background:#f3f0ff;color:#7B2D8E;border-radius:10px;font-size:10px;font-weight:600}
.cat-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}

/* Progress bars */
.pbar{height:6px;background:#f3f3f3;border-radius:3px;overflow:hidden;min-width:120px}
.pfill{height:100%;border-radius:3px;transition:width 0.3s}

/* Two column layout */
.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
.col{background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px}
.col h3{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#666;margin-bottom:10px}

/* Stats grid */
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sitem{padding:10px;background:#fff;border:1px solid #eee;border-radius:8px}
.sitem .sl2{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.05em}
.sitem .sv2{font-size:14px;font-weight:700;color:#1e1b2e;margin-top:2px}

/* Footer */
.ftr{margin-top:32px;padding-top:16px;border-top:2px solid #f3f3f3;display:flex;justify-content:space-between;align-items:center}
.ftr-left{font-size:10px;color:#bbb}
.ftr-right{font-size:10px;color:#bbb}
.ftr-logo{font-weight:800;color:#7B2D8E;font-size:12px}

@media print{
  body{padding:0}
  .page{padding:24px 20px}
  .strip{gap:8px}
  .sbox .sv{font-size:16px}
}
</style></head><body>
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <h1>Plumfolio</h1>
      <p>Personal Finance Report</p>
    </div>
    <div class="hdr-right">
      <div class="period">${periodLabel}</div>
      <div class="date">Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>

  <div class="strip">
    <div class="sbox inc"><div class="sl">Total Income</div><div class="sv">${formatCurrency(income)}</div></div>
    <div class="sbox exp"><div class="sl">Total Expenses</div><div class="sv">${formatCurrency(expenses)}</div></div>
    <div class="sbox sav"><div class="sl">Net Savings</div><div class="sv">${formatCurrency(net)}</div></div>
    <div class="sbox rate"><div class="sl">Savings Rate</div><div class="sv">${savingsRate}%</div></div>
  </div>

  <div class="cols">
    <div class="col">
      <h3>Expense Breakdown</h3>
      <table>${catRows || '<tr><td colspan="4" style="color:#ccc;text-align:center">No expenses</td></tr>'}</table>
    </div>
    <div class="col">
      <h3>Income Sources</h3>
      ${incRows ? `<table>${incRows}</table>` : '<p style="color:#ccc;text-align:center;font-size:12px">No income</p>'}
      <div style="margin-top:16px">
        <h3>Quick Stats</h3>
        <div class="sgrid">
          <div class="sitem"><div class="sl2">Transactions</div><div class="sv2">${filtered.length}</div></div>
          <div class="sitem"><div class="sl2">Daily Average</div><div class="sv2">${formatCurrency(dailyAvg)}</div></div>
          <div class="sitem"><div class="sl2">Largest Expense</div><div class="sv2">${topExpenses.length > 0 ? formatCurrency(topExpenses[0].amount) : 'N/A'}</div></div>
          <div class="sitem"><div class="sl2">Top Category</div><div class="sv2">${topCategory ? topCategory[0] : 'N/A'}</div></div>
        </div>
      </div>
    </div>
  </div>

  ${topExpenses.length > 0 ? `
  <div class="sec">
    <div class="sec-title">Top 5 Largest Expenses</div>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="r">Amount</th></tr></thead>
      <tbody>${topExpenses.map(t => `<tr><td>${new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td><td>${t.description}</td><td><span class="cat-pill">${t.category}</span></td><td class="r b">${formatCurrency(t.amount)}</td></tr>`).join('')}</tbody>
    </table>
  </div>` : ''}

  <div class="sec">
    <div class="sec-title">All Transactions (${filtered.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="r">Amount</th></tr></thead>
      <tbody>${allTxns}</tbody>
    </table>
  </div>

  <div class="ftr">
    <div class="ftr-left"><span class="ftr-logo">Plumfolio</span> — Personal Finance Report</div>
    <div class="ftr-right">Report generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>
</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  if (loading) return <div className="reports-loading"><div className="spinner" /></div>;

  return (
    <div className="reports-page" ref={reportRef}>
      {/* Controls */}
      <div className="reports-controls">
        <div className="period-tabs">
          {['month', 'year', 'all'].map(p => (
            <button key={p} className={`period-tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
              {p === 'month' ? 'Monthly' : p === 'year' ? 'Yearly' : 'All Time'}
            </button>
          ))}
        </div>
        <div className="period-selector">
          {period === 'month' && (
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          )}
          {period === 'year' && (
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>
        <button className="export-pdf-btn" onClick={exportPDF} disabled={filtered.length === 0}>
          <Download size={16} /> Export PDF
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state-container">
          <div className="empty-state">
            <FileText size={64} strokeWidth={1} />
            <h3>No data for {periodLabel}</h3>
            <p>Add transactions to generate a report</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="report-summary">
            <div className="report-stat">
              <div className="report-stat-icon income"><ArrowUpCircle size={20} /></div>
              <div>
                <span className="report-stat-label">Income</span>
                <span className="report-stat-value income">{formatCurrency(income)}</span>
                <DeltaLine label={period === 'month' ? 'vs last month' : period === 'year' ? 'vs last year' : null}
                  delta={pctDelta(income, prevIncome)} positiveIsGood={true} />
              </div>
            </div>
            <div className="report-stat">
              <div className="report-stat-icon expense"><ArrowDownCircle size={20} /></div>
              <div>
                <span className="report-stat-label">Expenses</span>
                <span className="report-stat-value expense">{formatCurrency(expenses)}</span>
                <DeltaLine label={period === 'month' ? 'vs last month' : period === 'year' ? 'vs last year' : null}
                  delta={pctDelta(expenses, prevExpenses)} positiveIsGood={false} />
              </div>
            </div>
            <div className="report-stat">
              <div className="report-stat-icon net"><Wallet size={20} /></div>
              <div>
                <span className="report-stat-label">Net Savings</span>
                <span className={`report-stat-value ${net >= 0 ? 'income' : 'expense'}`}>{formatCurrency(net)}</span>
                <DeltaLine label={period === 'month' ? 'vs last month' : period === 'year' ? 'vs last year' : null}
                  delta={pctDelta(net, prevNet)} positiveIsGood={true} />
              </div>
            </div>
            <div className="report-stat">
              <div className="report-stat-icon rate"><TrendingUp size={20} /></div>
              <div>
                <span className="report-stat-label">Savings Rate</span>
                <span className="report-stat-value">{savingsRate}%</span>
                <DeltaLine label={period === 'month' ? 'vs last month' : period === 'year' ? 'vs last year' : null}
                  delta={pctDelta(parseFloat(savingsRate), prevSavingsRate)} positiveIsGood={true} />
              </div>
            </div>
          </div>

          {/* Month-view also shows year-over-year comparison in a separate row */}
          {period === 'month' && (yoyIncome > 0 || yoyExpenses > 0) && (
            <div className="report-summary" style={{ marginTop: -8, opacity: 0.9 }}>
              <div className="report-stat" style={{ gridColumn: '1 / -1', background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.15)' }}>
                <div className="report-stat-icon rate"><Calendar size={18} /></div>
                <div>
                  <span className="report-stat-label">Same month last year ({yoyPeriodKey})</span>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 4 }}>
                    <span style={{ fontSize: '0.85rem' }}>Income <strong style={{ color: '#22C55E' }}>{formatCurrency(yoyIncome)}</strong>
                      {yoyIncome > 0 && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        ({income > yoyIncome ? '▲' : income < yoyIncome ? '▼' : '→'} {Math.abs(((income - yoyIncome) / yoyIncome) * 100).toFixed(1)}%)
                      </span>}
                    </span>
                    <span style={{ fontSize: '0.85rem' }}>Expenses <strong style={{ color: '#EF4444' }}>{formatCurrency(yoyExpenses)}</strong>
                      {yoyExpenses > 0 && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        ({expenses > yoyExpenses ? '▲' : expenses < yoyExpenses ? '▼' : '→'} {Math.abs(((expenses - yoyExpenses) / yoyExpenses) * 100).toFixed(1)}%)
                      </span>}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All-time summary (independent of the selected period). Skipped
              when the user is already viewing "All time" to avoid duplication. */}
          {period !== 'all' && transactions.length > 0 && (
            <div className="report-summary all-time-summary">
              <div className="all-time-header">
                <Wallet size={14} />
                <span>All-time summary</span>
                <span className="all-time-count">{transactions.length} total transactions</span>
              </div>
              <div className="all-time-row">
                <div className="all-time-stat">
                  <span className="all-time-label">Total Income</span>
                  <span className="all-time-value income">{formatCurrency(allTimeIncome)}</span>
                </div>
                <div className="all-time-stat">
                  <span className="all-time-label">Total Expenses</span>
                  <span className="all-time-value expense">{formatCurrency(allTimeExpenses)}</span>
                </div>
                <div className="all-time-stat">
                  <span className="all-time-label">Net</span>
                  <span className={'all-time-value ' + (allTimeNet >= 0 ? 'income' : 'expense')}>{formatCurrency(allTimeNet)}</span>
                </div>
                <div className="all-time-stat">
                  <span className="all-time-label">Savings Rate</span>
                  <span className="all-time-value">{allTimeSavingsRate}%</span>
                </div>
              </div>
            </div>
          )}

          <div className="report-grid">
            {/* Category Breakdown */}
            <div className="report-card">
              <h3><PieChart size={16} /> Expense Breakdown</h3>
              <div className="category-breakdown">
                {sortedCategories.map(([cat, amt], i) => (
                  <div key={cat} className="breakdown-item">
                    <div className="breakdown-header">
                      <span className="breakdown-name">{cat}</span>
                      <span className="breakdown-amount">{formatCurrency(amt)}</span>
                    </div>
                    <div className="breakdown-bar">
                      <div className="breakdown-fill" style={{ width: `${(amt / expenses * 100)}%`, background: ['#A855F7', '#22C55E', '#F59E0B', '#3B82F6', '#EF4444', '#EC4899', '#14B8A6', '#F97316'][i % 8] }} />
                    </div>
                    <span className="breakdown-pct">{(amt / expenses * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="report-card">
              <h3><BarChart3 size={16} /> Quick Stats</h3>
              <div className="quick-stats">
                <div className="quick-stat">
                  <span className="qs-label">Total Transactions</span>
                  <span className="qs-value">{filtered.length}</span>
                </div>
                <div className="quick-stat">
                  <span className="qs-label">Daily Average Spend</span>
                  <span className="qs-value">{formatCurrency(dailyAvg)}</span>
                </div>
                <div className="quick-stat">
                  <span className="qs-label">Largest Expense</span>
                  <span className="qs-value">{topExpenses[0] ? formatCurrency(topExpenses[0].amount) : '-'}</span>
                </div>
                <div className="quick-stat">
                  <span className="qs-label">Top Category</span>
                  <span className="qs-value">{topCategory ? topCategory[0] : '-'}</span>
                </div>
                <div className="quick-stat">
                  <span className="qs-label">Income Sources</span>
                  <span className="qs-value">{sortedIncome.length}</span>
                </div>
                <div className="quick-stat">
                  <span className="qs-label">Expense Categories</span>
                  <span className="qs-value">{sortedCategories.length}</span>
                </div>
              </div>
            </div>

            {/* Top Expenses */}
            <div className="report-card wide">
              <h3><TrendingDown size={16} /> Top 5 Expenses</h3>
              <table className="report-table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {topExpenses.map(t => (
                    <tr key={t.id}>
                      <td>{new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                      <td>{t.description}</td>
                      <td><span className="cat-badge">{t.category}</span></td>
                      <td className="expense-amount">{formatCurrency(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Income Sources */}
            {sortedIncome.length > 0 && (
              <div className="report-card wide">
                <h3><TrendingUp size={16} /> Income Sources</h3>
                <table className="report-table">
                  <thead><tr><th>Source</th><th>Amount</th><th>% of Income</th></tr></thead>
                  <tbody>
                    {sortedIncome.map(([desc, amt]) => (
                      <tr key={desc}>
                        <td>{desc}</td>
                        <td className="income-amount">{formatCurrency(amt)}</td>
                        <td>{(amt / income * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
