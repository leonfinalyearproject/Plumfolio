import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { supabase } from '../lib/supabase';
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
  const [stats, setStats] = useState({
    balance: 0,
    income: 0,
    expenses: 0,
    thisMonthIncome: 0,
    lastMonthIncome: 0,
    thisMonthExpenses: 0,
    lastMonthExpenses: 0,
    remainingInBudgets: 0,
    unallocated: 0,
    unplannedSpending: 0,
    savedThisMonth: 0,
    hasBudgetsThisMonth: false,
  });
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState({});
  const [loading, setLoading] = useState(true);

  // Read the "show all-time net" preference set from Settings → Dashboard.
  // Stored in localStorage (scoped per user). Default: off.
  const [showAllTimeNet, setShowAllTimeNet] = useState(false);
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

  // Load goals from Supabase (with localStorage fallback if migration not applied)
  useEffect(() => {
    if (!user?.id) { setGoals([]); return; }

    const loadGoals = async () => {
      try {
        const { data, error } = await supabase
          .from('savings_goals')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        const normalised = (data || []).map(g => ({
          ...g,
          target: parseFloat(g.target),
          saved: parseFloat(g.saved),
        }));
        setGoals(normalised);
      } catch (e) {
        // Fall back to localStorage if table doesn't exist yet
        try {
          const raw = localStorage.getItem('plumfolio_goals_' + user.id);
          setGoals(raw ? JSON.parse(raw) : []);
        } catch { setGoals([]); }
      }
    };

    loadGoals();
    // Re-read when window regains focus (in case Budgets page updated them)
    const onFocus = () => loadGoals();
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); };
  }, [user?.id]);

  useEffect(() => {
    console.log("[EFFECT] user:", user?.id, "user obj:", !!user);
    if (user) {
      fetchData();
    }
  }, [user?.id]);

  const fetchData = async () => {
    try {
      const userId = user.id;
      console.log('[FETCH] using user.id:', userId);
      // Fetch recent transactions
      const { data: recentTransactions, error: e1 } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(5);
      console.log('[FETCH] recent:', recentTransactions?.length, 'err:', e1?.message || 'none');

      // Fetch all transactions for stats
      const { data: allTransactions, error: e2 } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId);
      console.log('[FETCH] all:', allTransactions?.length, 'err:', e2?.message || 'none');

      // Fetch budgets
      const { data: budgetsData, error: e3 } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId);
      console.log('[FETCH] budgets:', budgetsData?.length, 'err:', e3?.message || 'none');

      // Calculate stats
      if (allTransactions) {
        // --- All-time totals (shown as sub-label on balance card) ---
        const income = allTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        const expenses = allTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0);

        // --- This month vs last month deltas ---
        // Use UTC month keys so they match how transactions are stored
        // (`new Date().toISOString()` is UTC) and how Budgets.js / Transactions.js
        // compute "this month". Mixing local and UTC caused off-by-one-month
        // mismatches at day boundaries for timezones far from UTC.
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

        // --- Balance breakdown: in budgets / unallocated / unplanned ---
        // A budget is a PLAN. Given that, balance decomposes into three pools:
        //
        //   remainingInBudgets = money still reserved inside this month's plans
        //                        (sum of allocated minus sum of planned-spending,
        //                         where planned-spending caps each budget at its
        //                         allocated ceiling — overspend isn't "planned")
        //   unallocated        = income you earned but never assigned to a plan
        //                        (income minus total allocated, floored at 0)
        //   unplannedSpending  = money spent OUTSIDE the plan: either in a
        //                        category with no budget, or past a budget's cap
        //
        // Identity: balance = remainingInBudgets + unallocated − unplannedSpending
        // So the three pills always reconcile to the headline balance.
        //
        // Buckets ("Needs", "Wants", etc.) span multiple categories — must be
        // handled the same way Budgets.js does it so numbers match across pages.
        const BUCKET_MAP = {
          'Needs':    ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education'],
          'Wants':    ['Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions'],
          'Savings':  ['Savings', 'Investments'],
          'Giving':   ['Gifts & Donations'],
          'Expenses': ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions', 'Other'],
          'Spending': ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions', 'Other'],
        };

        const thisMonthSpendByCat = (allTransactions || [])
          .filter(t => t.type === 'expense' && (t.date || '').slice(0, 7) === thisMonthKey)
          .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0); return acc; }, {});

        const spentForBudget = (cat) => BUCKET_MAP[cat]
          ? BUCKET_MAP[cat].reduce((s, c) => s + (thisMonthSpendByCat[c] || 0), 0)
          : (thisMonthSpendByCat[cat] || 0);

        const thisMonthBudgets = (budgetsData || []).filter(b => b.month_year === thisMonthKey);
        const totalAllocated = thisMonthBudgets.reduce((s, b) => s + parseFloat(b.allocated || 0), 0);

        // Planned spending: for each budget, sum actual spend capped at allocated.
        // Anything above the cap is unplanned (overspend). Anything in a category
        // with no budget is unplanned too — not counted here, captured below.
        const plannedSpending = thisMonthBudgets.reduce((s, b) => {
          const spent = spentForBudget(b.category);
          const cap = parseFloat(b.allocated || 0);
          return s + Math.min(spent, cap);
        }, 0);

        const remainingInBudgets = Math.max(0, totalAllocated - plannedSpending);
        const unallocated = Math.max(0, thisMonthIncome - totalAllocated);
        const unplannedSpending = Math.max(0, thisMonthExpenses - plannedSpending);
        const hasBudgetsThisMonth = thisMonthBudgets.length > 0;

        // Savings actually moved INTO goals this month: sum of expenses in the
        // Savings category for the current month. These are real transactions
        // created when the user adds to a goal, so this number reconciles
        // exactly with goal contribution activity on the Budgets page.
        const savedThisMonth = (thisMonthSpendByCat['Savings'] || 0);

        setStats({
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
        });

        // Calculate expenses by category for pie chart
        const categoryTotals = allTransactions
          .filter(t => t.type === 'expense')
          .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
            return acc;
          }, {});
        
        setExpensesByCategory(categoryTotals);
      }

      // Compute this month's key in the outer scope so we can both filter
      // budgets by month_year and compute this-month-only spend below.
      // (The inner if-block has its own `thisMonthKey` but isn't in scope here.)
      const outerNow = new Date();
      const outerThisMonthKey = outerNow.toISOString().slice(0, 7);

      /* Spent per category — MONTHLY. Using all-time spend against a monthly
         budget caused absurd percentages (e.g. P39,000 all-time Housing
         spend against a P5,500 April budget = 709%). Budgets reset monthly,
         so progress should compare month-to-date spend against the cap. */
      const spentByCategory = (allTransactions || [])
        .filter(t => t.type === 'expense' && (t.date || '').slice(0, 7) === outerThisMonthKey)
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
          return acc;
        }, {});

      const budgetsWithSpent = (budgetsData || [])
        /* Only include budgets for the current month. Without this filter,
           categories that carry budgets across multiple months (e.g. Shopping,
           Subscriptions) show up multiple times in the Budget Progress list —
           once per month_year row in the database. */
        .filter(b => b.month_year === outerThisMonthKey)
        .map(b => ({
          ...b,
          spent: spentByCategory[b.category] || 0,
        }));

      setTransactions(recentTransactions || []);
      setBudgets(budgetsWithSpent);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

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
        backgroundColor: '#1a1a24',
        titleColor: '#f5f5f7',
        bodyColor: '#a1a1aa',
        borderColor: 'rgba(255,255,255,0.1)',
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
    <div className="dashboard">
      <div className="dashboard-greeting">
        <h1>Hey, {userName}!</h1>
        <p>Here's your financial overview</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
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
          {(stats.hasBudgetsThisMonth || stats.savedThisMonth > 0) && (
            <span className="balance-breakdown">
              {stats.hasBudgetsThisMonth && (
                <>
                  <span className="balance-breakdown-item in-budgets">{formatCurrency(stats.remainingInBudgets)} in budgets</span>
                  <span className="balance-breakdown-sep">+</span>
                  <span className="balance-breakdown-item unallocated">{formatCurrency(stats.unallocated)} unallocated</span>
                  {stats.unplannedSpending > 0 && (
                    <>
                      <span className="balance-breakdown-sep">−</span>
                      <span className="balance-breakdown-item unplanned" title="Money spent outside your plan: either on a category with no budget, or past a budget's cap.">
                        {formatCurrency(stats.unplannedSpending)} unplanned
                      </span>
                    </>
                  )}
                </>
              )}
              {stats.savedThisMonth > 0 && (
                <>
                  <span className="balance-breakdown-sep">·</span>
                  <span className="balance-breakdown-item saved" title="Money moved into savings goals this month. Already counted as a Savings expense in the totals above.">
                    {formatCurrency(stats.savedThisMonth)} saved
                  </span>
                </>
              )}
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
      </div>

      {/* Content */}
      <div className="dashboard-grid">
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
      </div>
    </div>
  );
};

export default Dashboard;
