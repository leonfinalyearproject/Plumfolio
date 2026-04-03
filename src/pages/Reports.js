import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import {
  FileText, Download, Calendar, TrendingUp, TrendingDown,
  PieChart, BarChart3, ArrowUpCircle, ArrowDownCircle, Wallet
} from 'lucide-react';
import './Reports.css';

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

  // Category breakdown
  const categoryTotals = filtered.filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount); return acc; }, {});
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0];

  // Income sources
  const incomeSources = filtered.filter(t => t.type === 'income')
    .reduce((acc, t) => { acc[t.description] = (acc[t.description] || 0) + parseFloat(t.amount); return acc; }, {});
  const sortedIncome = Object.entries(incomeSources).sort((a, b) => b[1] - a[1]);

  // Daily average
  const daysInPeriod = period === 'month' ? 30 : period === 'year' ? 365 : Math.max(1, Math.ceil((new Date() - new Date(filtered[filtered.length - 1]?.date || new Date())) / 86400000));
  const dailyAvg = expenses / Math.max(daysInPeriod, 1);

  // Top 5 transactions
  const topExpenses = [...filtered].filter(t => t.type === 'expense').sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 5);

  const periodLabel = period === 'month'
    ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : period === 'year' ? selectedYear : 'All Time';

  // PDF Export
  const exportPDF = () => {
    const content = reportRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head><title>Plumfolio Report - ${periodLabel}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1a1a2e; background: white; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin: 24px 0 12px; color: #6b21a8; border-bottom: 2px solid #6b21a8; padding-bottom: 4px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat { padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; }
        .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
        .green { color: #16a34a; } .red { color: #dc2626; } .purple { color: #6b21a8; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 8px 12px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; color: #888; }
        td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
        .right { text-align: right; }
        .bar-container { height: 8px; background: #f3f4f6; border-radius: 4px; margin-top: 4px; }
        .bar-fill { height: 100%; border-radius: 4px; background: #6b21a8; }
        .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; }
      </style></head><body>
        <h1>Plumfolio Financial Report</h1>
        <p class="subtitle">${periodLabel} • Generated ${new Date().toLocaleDateString()}</p>
        <div class="stats">
          <div class="stat"><div class="stat-label">Income</div><div class="stat-value green">${formatCurrency(income)}</div></div>
          <div class="stat"><div class="stat-label">Expenses</div><div class="stat-value red">${formatCurrency(expenses)}</div></div>
          <div class="stat"><div class="stat-label">Net Savings</div><div class="stat-value ${net >= 0 ? 'green' : 'red'}">${formatCurrency(net)}</div></div>
          <div class="stat"><div class="stat-label">Savings Rate</div><div class="stat-value purple">${savingsRate}%</div></div>
        </div>
        <h2>Expense Breakdown by Category</h2>
        <table>
          <thead><tr><th>Category</th><th class="right">Amount</th><th class="right">% of Total</th></tr></thead>
          <tbody>
            ${sortedCategories.map(([cat, amt]) => `<tr><td>${cat}<div class="bar-container"><div class="bar-fill" style="width:${(amt/expenses*100).toFixed(0)}%"></div></div></td><td class="right">${formatCurrency(amt)}</td><td class="right">${(amt/expenses*100).toFixed(1)}%</td></tr>`).join('')}
          </tbody>
        </table>
        ${sortedIncome.length > 0 ? `
          <h2>Income Sources</h2>
          <table><thead><tr><th>Source</th><th class="right">Amount</th></tr></thead>
          <tbody>${sortedIncome.map(([desc, amt]) => `<tr><td>${desc}</td><td class="right">${formatCurrency(amt)}</td></tr>`).join('')}</tbody></table>
        ` : ''}
        <h2>Top 5 Expenses</h2>
        <table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="right">Amount</th></tr></thead>
        <tbody>${topExpenses.map(t => `<tr><td>${t.date}</td><td>${t.description}</td><td>${t.category}</td><td class="right">${formatCurrency(t.amount)}</td></tr>`).join('')}</tbody></table>
        <div class="footer">Generated by Plumfolio • ${new Date().toLocaleDateString()}</div>
      </body></html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
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
              <div><span className="report-stat-label">Income</span><span className="report-stat-value income">{formatCurrency(income)}</span></div>
            </div>
            <div className="report-stat">
              <div className="report-stat-icon expense"><ArrowDownCircle size={20} /></div>
              <div><span className="report-stat-label">Expenses</span><span className="report-stat-value expense">{formatCurrency(expenses)}</span></div>
            </div>
            <div className="report-stat">
              <div className="report-stat-icon net"><Wallet size={20} /></div>
              <div><span className="report-stat-label">Net Savings</span><span className={`report-stat-value ${net >= 0 ? 'income' : 'expense'}`}>{formatCurrency(net)}</span></div>
            </div>
            <div className="report-stat">
              <div className="report-stat-icon rate"><TrendingUp size={20} /></div>
              <div><span className="report-stat-label">Savings Rate</span><span className="report-stat-value">{savingsRate}%</span></div>
            </div>
          </div>

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
