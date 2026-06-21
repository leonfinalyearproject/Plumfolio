import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useInsights } from '../context/InsightsContext';
import { computeDashboardFromData } from '../utils/dashboardStats';
import ScrollReveal, { StaggerReveal } from '../components/ScrollReveal';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Coffee,
  Home,
  Car,
  Zap,
  ShoppingBag,
  ChevronRight,
  Plus,
  PiggyBank,
  Target, Plane, Laptop, Smartphone, GraduationCap, Dumbbell,
  Gamepad2, Baby, Gem, Umbrella, Music, Award, Sparkles,
  RefreshCw, Heart, Briefcase, MoreHorizontal, Film, ShoppingCart,
  SlidersHorizontal
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import './Dashboard.css';

// Goal icon registry (mirrors Budgets.js) — Lucide icon keys
const GOAL_ICONS = {
  target: Target, home: Home, car: Car, plane: Plane, laptop: Laptop,
  phone: Smartphone, grad: GraduationCap, wallet: Wallet, gym: Dumbbell,
  game: Gamepad2, baby: Baby, ring: Gem, beach: Umbrella, music: Music,
};
const EMOJI_TO_KEY = {
  '🎯': 'target', '🏠': 'home', '🚗': 'car', '✈️': 'plane', '💻': 'laptop',
  '📱': 'phone', '🎓': 'grad', '💰': 'wallet', '🏋️': 'gym', '🎮': 'game',
  '👶': 'baby', '💍': 'ring', '🏖️': 'beach', '🎸': 'music',
};
const getGoalIcon = (icon) => GOAL_ICONS[icon] || GOAL_ICONS[EMOJI_TO_KEY[icon]] || Target;

ChartJS.register(ArcElement, Tooltip, Legend);

// Small badge for "vs previous period" comparisons.
// `positiveIsGood`=true → income (more is better); false → expenses (less is better)
const DeltaBadge = ({ current, previous, positiveIsGood, formatCurrency }) => {
  if (!previous && !current) {
    return <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>No data last month</span>;
  }
  if (!previous) {
    return <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>New this month</span>;
  }
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  const up = diff > 0;
  const isGood = positiveIsGood ? up : !up;
  const color = Math.abs(pct) < 0.5 ? 'var(--text-secondary)' : (isGood ? '#22C55E' : '#EF4444');
  const arrow = Math.abs(pct) < 0.5 ? '→' : (up ? '▲' : '▼');
  return (
    <span style={{ fontSize: '0.72rem', color, marginTop: 4, display: 'block' }}>
      {arrow} {Math.abs(pct).toFixed(1)}% vs last month ({formatCurrency(Math.abs(diff))})
    </span>
  );
};

const Dashboard = () => {
  const { formatCurrency, symbol } = useCurrency();
  const { user } = useAuth();
  const { transactions: allTransactions, budgets: allBudgets, goals, loading, dataVersion } = useInsights();

  const dashboardData = useMemo(
    () => computeDashboardFromData(allTransactions, allBudgets),
    [allTransactions, allBudgets, dataVersion]
  );

  const { stats, expensesByCategory, recentTransactions: transactions, budgetsWithSpent: budgets } = dashboardData;

  // Read the "show all-time net" preference set from Settings → Dashboard.
  // Stored in localStorage (scoped per user). Default: off.
  const [showAllTimeNet, setShowAllTimeNet] = useState(false);
  const [syncFlash, setSyncFlash] = useState(false);

  useEffect(() => {
    if (dataVersion <= 1) return;
    setSyncFlash(true);
    const t = setTimeout(() => setSyncFlash(false), 600);
    return () => clearTimeout(t);
  }, [dataVersion]);
  useEffect(() => {
    if (!user?.id) { setShowAllTimeNet(false); return; }
    try {
      const raw = localStorage.getItem(`plumfolio:dashboardPrefs:${user.id}`);
      if (raw) setShowAllTimeNet(!!JSON.parse(raw).showAllTimeNet);
      else setShowAllTimeNet(false);
    } catch (_) {
      setShowAllTimeNet(false);
    }
  }, [user?.id]);

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  const getCategoryIcon = (category) => {
    const icons = {
      'Food': Coffee,
      'Food & Dining': Coffee,
      'Groceries': ShoppingCart,
      'Housing': Home,
      'Transport': Car,
      'Transportation': Car,
      'Utilities': Zap,
      'Entertainment': Film,
      'Shopping': ShoppingBag,
      'Health & Fitness': Heart,
      'Healthcare': Heart,
      'Education': GraduationCap,
      'Subscriptions': RefreshCw,
      'Personal Care': Sparkles,
      'Travel': Plane,
      'Savings': PiggyBank,
      'Investments': Briefcase,
      'Gifts & Donations': Gem,
      'Income': Wallet,
      'Other': MoreHorizontal,
    };
    return icons[category] || ShoppingBag;
  };


  // Generate chart data from real expenses
  const generateChartData = () => {
    const categories = Object.keys(expensesByCategory);
    const amounts = Object.values(expensesByCategory);
    
    if (categories.length === 0) {
      return null;
    }

    const colors = [
      '#7B2D8E', '#4CAF50', '#FFB300', '#3B82F6', 
      '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'
    ];

    return {
      labels: categories,
      datasets: [{
        data: amounts,
        backgroundColor: colors.slice(0, categories.length),
        borderWidth: 0,
        spacing: 2,
      }],
    };
  };

  const chartData = generateChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#FFFFFF',
        titleColor: '#0F172A',
        bodyColor: '#475569',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${symbol}${value.toFixed(2)} (${percentage}%)`;
          }
        }
      },
    },
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className={`dashboard ${syncFlash ? 'data-sync-flash' : ''}`} key={dataVersion}>
      <ScrollReveal animation="up" duration={0.7}>
        <div className="dashboard-greeting">
          <h1>Hey, {userName}!</h1>
          <p>Here's your financial overview</p>
        </div>
      </ScrollReveal>

      <StaggerReveal className="stats-row" animation="up" stagger={90}>
        <div className="stat-card main">
          <div className="stat-top">
            <span className="stat-label">Balance (this month)</span>
            <Wallet size={20} />
          </div>
          <div className="stat-amount-row">
            <span className="stat-amount">{formatCurrency(stats.thisMonthIncome - stats.thisMonthExpenses)}</span>
            {showAllTimeNet && (
              <span className="stat-inline-sub">All-time net: {formatCurrency(stats.balance)}</span>
            )}
          </div>
          {stats.savedThisMonth > 0 && (
            <span className="balance-breakdown">
              <span className="balance-breakdown-item saved" title="Money moved into savings goals this month. Already counted as a Savings expense in the totals above.">
                {formatCurrency(stats.savedThisMonth)} saved this month
              </span>
            </span>
          )}
          <DeltaBadge current={stats.thisMonthIncome - stats.thisMonthExpenses} previous={stats.lastMonthIncome - stats.lastMonthExpenses} positiveIsGood={true} formatCurrency={formatCurrency} />
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Income (this month)</span>
            <div className="stat-badge up">
              <ArrowUpRight size={14} />
            </div>
          </div>
          <span className="stat-amount">{formatCurrency(stats.thisMonthIncome)}</span>
          <DeltaBadge current={stats.thisMonthIncome} previous={stats.lastMonthIncome} positiveIsGood={true} formatCurrency={formatCurrency} />
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Expenses (this month)</span>
            <div className="stat-badge down">
              <ArrowDownRight size={14} />
            </div>
          </div>
          <span className="stat-amount">{formatCurrency(stats.thisMonthExpenses)}</span>
          <DeltaBadge current={stats.thisMonthExpenses} previous={stats.lastMonthExpenses} positiveIsGood={false} formatCurrency={formatCurrency} />
        </div>
      </StaggerReveal>

      <div className="dashboard-grid">
        <ScrollReveal animation="up" delay={100}>
        {/* Transactions */}
        <div className="card">
          <div className="card-top">
            <h2>Recent Transactions</h2>
            <Link to="/transactions" className="card-link">
              View all <ChevronRight size={16} />
            </Link>
          </div>
          
          {transactions.length > 0 ? (
            <div className="transactions-list">
              {transactions.map((t) => {
                const Icon = getCategoryIcon(t.category);
                return (
                  <div key={t.id} className="transaction-row">
                    <div className="transaction-icon">
                      <Icon size={16} />
                    </div>
                    <div className="transaction-info">
                      <span className="transaction-name">{t.description}</span>
                      <span className="transaction-cat">{t.category}</span>
                    </div>
                    <span className={`transaction-amt ${t.type}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(parseFloat(t.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <PiggyBank size={48} strokeWidth={1} />
              <p>No transactions yet</p>
              <Link to="/transactions" className="empty-action">
                <Plus size={16} />
                Add your first transaction
              </Link>
            </div>
          )}
        </div>
        </ScrollReveal>

        <ScrollReveal animation="up" delay={160}>
        {/* Chart */}
        <div className="card">
          <div className="card-top">
            <h2>Spending Breakdown</h2>
          </div>
          
          {chartData ? (
            <>
              <div className="chart-area">
                <Doughnut data={chartData} options={chartOptions} />
              </div>
              <div className="chart-legend">
                {chartData.labels.map((label, i) => (
                  <div key={label} className="legend-item">
                    <span style={{ background: chartData.datasets[0].backgroundColor[i] }} />
                    {label}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <TrendingDown size={48} strokeWidth={1} />
              <p>No expense data yet</p>
              <span className="empty-hint">Add expenses to see your spending breakdown</span>
            </div>
          )}
        </div>
        </ScrollReveal>

        <ScrollReveal animation="up" delay={220}>
        {/* Budgets */}
        <div className="card wide">
          <div className="card-top">
            <h2>Budget Progress</h2>
            <Link to="/budgets" className="card-link">
              Manage <ChevronRight size={16} />
            </Link>
          </div>

          {budgets.length > 0 ? (() => {
            /* Build a sorted, annotated list so the card shows the most
               urgent budgets first. Ordering: over-budget (highest % first),
               then near-limit (80–100%), then on-track. Capped at 5 rows to
               keep the dashboard digestible; the full list lives on /budgets. */
            const MAX_ROWS = 5;
            const annotated = budgets.map(b => {
              const allocated = parseFloat(b.allocated) || 0;
              const spent = parseFloat(b.spent) || 0;
              const rawPct = allocated > 0 ? (spent / allocated) * 100 : 0;
              const status = rawPct > 100 ? 'over' : rawPct >= 80 ? 'near' : 'ok';
              return { ...b, allocated, spent, rawPct, status };
            }).sort((a, b) => {
              const rank = { over: 0, near: 1, ok: 2 };
              if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
              return b.rawPct - a.rawPct;
            });

            const overCount = annotated.filter(b => b.status === 'over').length;
            const nearCount = annotated.filter(b => b.status === 'near').length;
            const okCount = annotated.filter(b => b.status === 'ok').length;
            const visible = annotated.slice(0, MAX_ROWS);
            const hiddenCount = annotated.length - visible.length;

            return (
              <>
                {/* Summary pills — at-a-glance health check. */}
                <div className="budget-summary">
                  <div className={'budget-summary-pill status-over' + (overCount === 0 ? ' dim' : '')}>
                    <span className="pill-label">Over</span>
                    <span className="pill-value">{overCount}</span>
                  </div>
                  <div className={'budget-summary-pill status-near' + (nearCount === 0 ? ' dim' : '')}>
                    <span className="pill-label">Near limit</span>
                    <span className="pill-value">{nearCount}</span>
                  </div>
                  <div className={'budget-summary-pill status-ok' + (okCount === 0 ? ' dim' : '')}>
                    <span className="pill-label">On track</span>
                    <span className="pill-value">{okCount}</span>
                  </div>
                </div>

                <div className="budgets-list">
                  {visible.map((b) => {
                    const displayPct = Math.min(b.rawPct, 100);
                    return (
                      <div key={b.id} className={`budget-row status-${b.status}`}>
                        <div className="budget-info">
                          <div className="budget-info-left">
                            <span className="budget-name">{b.category}</span>
                            <span className={`budget-pct-pill status-${b.status}`}>
                              {Math.round(b.rawPct)}%
                            </span>
                          </div>
                          <div className="budget-info-right">
                            <span className="budget-nums">
                              {formatCurrency(b.spent)} of {formatCurrency(b.allocated)}
                            </span>
                            {/* Only show the Adjust shortcut on over-budget rows — that's
                                where raising the cap (or reviewing the category) is
                                actually actionable. For near/ok rows we stay quiet. */}
                            {b.status === 'over' && (
                              <Link
                                to={`/budgets?edit=${b.id}`}
                                className="budget-adjust-btn"
                                title="Adjust this budget"
                                aria-label={`Adjust ${b.category} budget`}
                              >
                                <SlidersHorizontal size={12} />
                                <span>Adjust</span>
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="budget-bar">
                          <div
                            className={`budget-fill status-${b.status}`}
                            style={{ width: `${displayPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hiddenCount > 0 && (
                  <Link to="/budgets" className="budget-view-more">
                    + {hiddenCount} more {hiddenCount === 1 ? 'budget' : 'budgets'} · view all
                    <ChevronRight size={14} />
                  </Link>
                )}
              </>
            );
          })() : (
            <div className="empty-state horizontal">
              <Wallet size={40} strokeWidth={1} />
              <div>
                <p>No budgets set up yet</p>
                <Link to="/budgets" className="empty-action">
                  <Plus size={16} />
                  Create your first budget
                </Link>
              </div>
            </div>
          )}
        </div>
        </ScrollReveal>

        <ScrollReveal animation="up" delay={280}>
        {/* Savings Goals */}
        <div className="card wide">
          <div className="card-top">
            <h2>Savings Goals</h2>
            <Link to="/budgets" className="card-link">
              Manage <ChevronRight size={16} />
            </Link>
          </div>

          {goals.length > 0 ? (() => {
            const completed = goals.filter(g => g.saved >= g.target);
            const inProgress = goals.filter(g => g.saved < g.target);
            // Sort: recently created first (assuming id is timestamp)
            const recent = [...inProgress].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 3);
            const recentCompleted = [...completed].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 3);

            return (
              <div className="goals-dashboard">
                {recentCompleted.length > 0 && (
                  <div className="goals-dashboard-group">
                    <div className="goals-dashboard-label">
                      <Award size={13} /> Completed ({completed.length})
                    </div>
                    <div className="goals-dashboard-list">
                      {recentCompleted.map(g => {
                        const Ico = getGoalIcon(g.icon);
                        return (
                          <div key={g.id} className="goal-chip complete">
                            <div className="goal-chip-icon"><Ico size={16} /></div>
                            <div className="goal-chip-info">
                              <span className="goal-chip-name">{g.name}</span>
                              <span className="goal-chip-amount">{formatCurrency(g.target)}</span>
                            </div>
                            <Award size={14} className="goal-chip-badge" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {recent.length > 0 && (
                  <div className="goals-dashboard-group">
                    <div className="goals-dashboard-label">
                      <Sparkles size={13} /> In Progress ({inProgress.length})
                    </div>
                    <div className="goals-dashboard-list">
                      {recent.map(g => {
                        const Ico = getGoalIcon(g.icon);
                        const pct = Math.min((g.saved / g.target) * 100, 100);
                        return (
                          <div key={g.id} className="goal-chip">
                            <div className="goal-chip-icon"><Ico size={16} /></div>
                            <div className="goal-chip-info">
                              <div className="goal-chip-row">
                                <span className="goal-chip-name">{g.name}</span>
                                <span className="goal-chip-pct">{pct.toFixed(0)}%</span>
                              </div>
                              <div className="goal-chip-bar">
                                <div className="goal-chip-fill" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="goal-chip-amount">
                                {formatCurrency(Math.min(g.saved, g.target))} of {formatCurrency(g.target)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="empty-state horizontal">
              <Target size={40} strokeWidth={1} />
              <div>
                <p>No savings goals yet</p>
                <Link to="/budgets" className="empty-action">
                  <Plus size={16} />
                  Create your first goal
                </Link>
              </div>
            </div>
          )}
        </div>
        </ScrollReveal>
      </div>
    </div>
  );
};

export default Dashboard;
