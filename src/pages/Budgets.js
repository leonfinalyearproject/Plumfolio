import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { useInsights } from '../context/InsightsContext';
import { validateBudgetForm, validateGoalForm } from '../utils/validation';
import {
  Plus, Edit, Trash2, X, AlertTriangle, CheckCircle, Target,
  TrendingUp, PiggyBank, Repeat, Zap, Award, ArrowRight,
  Home, Car, Plane, Laptop, Smartphone, GraduationCap, Wallet,
  Dumbbell, Gamepad2, Baby, Gem, Umbrella, Music
} from 'lucide-react';

// Goal icon registry (key → component). Stored as string keys in DB.
const GOAL_ICONS = {
  target: Target, home: Home, car: Car, plane: Plane, laptop: Laptop,
  phone: Smartphone, grad: GraduationCap, wallet: Wallet, gym: Dumbbell,
  game: Gamepad2, baby: Baby, ring: Gem, beach: Umbrella, music: Music,
};
const GOAL_ICON_KEYS = Object.keys(GOAL_ICONS);
// Backward-compat for saved emoji values
const EMOJI_TO_KEY = {
  '🎯': 'target', '🏠': 'home', '🚗': 'car', '✈️': 'plane', '💻': 'laptop',
  '📱': 'phone', '🎓': 'grad', '💰': 'wallet', '🏋️': 'gym', '🎮': 'game',
  '👶': 'baby', '💍': 'ring', '🏖️': 'beach', '🎸': 'music',
};
const getGoalIconComponent = (icon) => {
  if (!icon) return Target;
  if (GOAL_ICONS[icon]) return GOAL_ICONS[icon];
  if (EMOJI_TO_KEY[icon]) return GOAL_ICONS[EMOJI_TO_KEY[icon]];
  return Target;
};
import './Budgets.css';

const Budgets = () => {
  const { formatCurrency } = useCurrency();
  const { addToast, refreshInsights, monthlyIncome, typicalMonthlyIncome, incomeBreakdown } = useInsights();
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [activeTab, setActiveTab] = useState('budgets');
  const [formData, setFormData] = useState({
    category: 'Food & Dining',
    allocated: '',
    month_year: new Date().toISOString().slice(0, 7),
  });
  const [formErrors, setFormErrors] = useState({});
  // Which month the Budgets view is currently showing. Defaults to current.
  // Users flip between months to see historical plans vs future plans.
  const [viewMonth, setViewMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Savings goals (stored in localStorage since no DB table)
  const [goals, setGoals] = useState([]);
  const [goalModal, setGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({
    name: '', target: '', saved: '', deadline: '', icon: 'target',
  });
  const [goalErrors, setGoalErrors] = useState({});

  const categories = [
    'Food & Dining', 'Transportation', 'Housing', 'Utilities',
    'Entertainment', 'Shopping', 'Health & Fitness', 'Education',
    'Groceries', 'Subscriptions', 'Personal Care', 'Travel',
    'Savings', 'Investments', 'Gifts & Donations', 'Other',
  ];

  // Bucket → child categories mapping for formula-based budgets.
  // When a budget's category is one of these bucket names, its "spent" total
  // sums every transaction whose category falls in the bucket.
  const BUCKET_MAP = {
    'Needs':     ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education'],
    'Wants':     ['Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions'],
    'Savings':   ['Savings', 'Investments'],
    'Giving':    ['Gifts & Donations'],
    'Expenses':  ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions', 'Other'],
    'Spending':  ['Food & Dining', 'Groceries', 'Transportation', 'Housing', 'Utilities', 'Health & Fitness', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'Personal Care', 'Travel', 'Subscriptions', 'Other'],
  };

  // Given a budget category and spendingMap, return total spent (handles buckets)
  const calcSpent = (budgetCategory, spendingMap) => {
    if (BUCKET_MAP[budgetCategory]) {
      return BUCKET_MAP[budgetCategory].reduce((sum, cat) => sum + (spendingMap[cat] || 0), 0);
    }
    return spendingMap[budgetCategory] || 0;
  };

  // Goal icons now come from GOAL_ICONS registry above (Lucide icons)

  // Budget rules/formulas
  const budgetRules = [
    { name: '50/30/20 Rule', desc: '50% needs, 30% wants, 20% savings', split: [50, 30, 20], labels: ['Needs', 'Wants', 'Savings'] },
    { name: '70/20/10 Rule', desc: '70% expenses, 20% savings, 10% giving', split: [70, 20, 10], labels: ['Expenses', 'Savings', 'Giving'] },
    { name: '80/20 Rule', desc: '80% spending, 20% savings', split: [80, 20], labels: ['Spending', 'Savings'] },
  ];
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [ruleIncome, setRuleIncome] = useState('');

  useEffect(() => {
    if (user) { fetchBudgets(); fetchGoals(); }
    else setLoading(false);
  }, [user?.id]);

  const fetchGoals = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      // Normalise numeric fields (Supabase returns numerics as strings)
      const normalised = (data || []).map(g => ({
        ...g,
        target: parseFloat(g.target),
        saved: parseFloat(g.saved),
      }));
      setGoals(normalised);
    } catch (e) {
      // Fall back to localStorage if table doesn't exist yet (migration not run)
      const stored = localStorage.getItem('plumfolio_goals_' + (user?.id || ''));
      if (stored) setGoals(JSON.parse(stored));
    }
  };

  const fetchBudgets = async () => {
    try {
      const [budgetsRes, txnRes] = await Promise.all([
        supabase.from('budgets').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('*').eq('user_id', user.id).eq('type', 'expense'),
      ]);
      const allExpenses = txnRes.data || [];
      
      // Calculate spent per budget, filtered by that budget's month_year
      const budgetsWithSpent = (budgetsRes.data || []).map(b => {
        // Filter transactions to only those matching this budget's month
        const monthExpenses = allExpenses.filter(t => {
          const txnMonth = t.date ? t.date.slice(0, 7) : null; // Extract YYYY-MM from date
          return txnMonth === b.month_year;
        });
        
        // Build spending map for this month only
        const spentByCategory = monthExpenses.reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
          return acc;
        }, {});
        
        return { ...b, spent: calcSpent(b.category, spentByCategory) };
      });
      setBudgets(budgetsWithSpent);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // =============================================================
  // FINANCIAL-LOGIC GUARDS FOR BUDGET CREATION
  // Policy: a budget is a PLAN. You can't plan for the past, and you
  // can't set a ceiling below what you've already spent this month.
  // =============================================================

  // Cache all expense transactions so we can check "already spent" in real time
  // while the user types in the budget modal. Pull from InsightsContext so
  // we stay in sync with the rest of the app (no extra network call, no drift).
  const { transactions: ctxTransactions } = useInsights();
  const allExpenses = (ctxTransactions || []).filter(t => t.type === 'expense');

  // How much has already been spent for the (category, month) combo the user
  // is currently configuring? Handles bucket categories (Needs, Wants, etc).
  const getAlreadySpent = (category, monthYear) => {
    if (!category || !monthYear) return 0;
    const catsToCount = BUCKET_MAP[category] || [category];
    return allExpenses
      .filter(t => (t.date || '').slice(0, 7) === monthYear && catsToCount.includes(t.category))
      .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  };

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const isPastMonth = (my) => my && my < currentMonthKey;

  // =============================================================
  // AVAILABLE TO BUDGET — per-month rule
  // =============================================================
  // Rule: you can only budget what you ACTUALLY received that month.
  // If April brought in P18,500 of income, you can budget up to P18,500 for
  // April. That's it. No running balances, no cross-month earmarks, no
  // forecasts, no averages. Paycheck-to-paycheck, month-by-month.

  // Income received IN a specific month (pulled from transactions).
  const incomeForMonth = (monthKey) => (ctxTransactions || [])
    .filter(t => t.type === 'income' && (t.date || '').slice(0, 7) === monthKey)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  // Budgets already allocated IN a specific month (respecting buckets).
  const allocatedForMonth = (monthKey) => budgets
    .filter(b => b.month_year === monthKey)
    .filter(b => {
      if (!BUCKET_MAP[b.category]) {
        const monthBuckets = budgets
          .filter(x => x.month_year === monthKey && BUCKET_MAP[x.category])
          .map(x => x.category);
        if (monthBuckets.some(bn => BUCKET_MAP[bn].includes(b.category))) return false;
      }
      return true;
    })
    .reduce((s, b) => s + parseFloat(b.allocated || 0), 0);

  // Live modal values
  const modalMonthIncome = incomeForMonth(formData.month_year);
  const modalAlreadySpent = getAlreadySpent(formData.category, formData.month_year);
  const modalAllocatedNum = parseFloat(formData.allocated) || 0;
  const modalIsPast = isPastMonth(formData.month_year);
  const modalBelowSpent = modalAllocatedNum > 0 && modalAllocatedNum < modalAlreadySpent;
  const modalDuplicate = !editingBudget && budgets.some(b =>
    b.category === formData.category && b.month_year === formData.month_year
  );

  // Amount already allocated to this month, excluding the budget being edited
  const existingThisMonthAllocated = budgets
    .filter(b => b.month_year === formData.month_year && (!editingBudget || b.id !== editingBudget.id))
    .filter(b => {
      if (!BUCKET_MAP[b.category]) {
        const monthBuckets = budgets
          .filter(x => x.month_year === b.month_year && BUCKET_MAP[x.category])
          .map(x => x.category);
        if (monthBuckets.some(bn => BUCKET_MAP[bn].includes(b.category))) return false;
      }
      return true;
    })
    .reduce((s, b) => s + parseFloat(b.allocated || 0), 0);

  const modalTotalAfter = existingThisMonthAllocated + modalAllocatedNum;
  // The only ceiling is this month's income
  const modalExceedsFunds = modalAllocatedNum > 0 && modalTotalAfter > modalMonthIncome + 0.01;
  // What's left in this month's income after existing allocations
  const modalRoomLeft = Math.max(0, modalMonthIncome - existingThisMonthAllocated);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { isValid, errors } = validateBudgetForm(formData, categories);
    if (!isValid) {
      setFormErrors(errors);
      return;
    }

    // Guard 1: no NEW budgets for past months. (Editing is fine so users
    // can correct historical records, but new ones must be current/future.)
    if (!editingBudget && modalIsPast) {
      setFormErrors({ month_year: `Cannot create a budget for a past month. Budgets are plans, not records — use Reports to review ${formData.month_year}.` });
      return;
    }

    // Guard 2: budget ≥ already-spent in that month/category.
    if (modalBelowSpent) {
      setFormErrors({
        allocated: `You've already spent ${formatCurrency(modalAlreadySpent)} in ${formData.category} this month. A budget below that would already be exceeded — set at least ${formatCurrency(modalAlreadySpent)}.`
      });
      return;
    }

    // Guard 3: one budget per (category, month). Prevents silent duplicates.
    if (modalDuplicate) {
      setFormErrors({
        category: `A budget for ${formData.category} already exists for ${formData.month_year}. Edit the existing budget instead.`
      });
      return;
    }

    if (modalExceedsFunds) {
      setFormErrors({
        allocated: `Too much. You only received ${formatCurrency(modalMonthIncome)} in ${formData.month_year}${existingThisMonthAllocated > 0 ? ` and have already allocated ${formatCurrency(existingThisMonthAllocated)}` : ''}. Max is ${formatCurrency(modalRoomLeft)}.`
      });
      return;
    }

    setFormErrors({});
    try {
      const payload = { category: formData.category, allocated: parseFloat(formData.allocated), month_year: formData.month_year };
      const wasEdit = !!editingBudget;
      if (editingBudget) {
        await supabase.from('budgets').update(payload).eq('id', editingBudget.id);
      } else {
        await supabase.from('budgets').insert({ ...payload, user_id: user.id });
      }
      setModalOpen(false); setEditingBudget(null);
      setFormData({ category: 'Food & Dining', allocated: '', month_year: new Date().toISOString().slice(0, 7) });
      fetchBudgets();
      if (addToast) addToast({
        type: 'success',
        title: wasEdit ? 'Budget Updated' : 'Budget Created',
        message: `${payload.category} — ${formatCurrency(payload.allocated)} allocated.`
      });
      if (refreshInsights) refreshInsights();
    } catch (error) { console.error('Save error:', error); if (addToast) addToast({ type: 'warning', title: 'Save Failed', message: error.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget?')) return;
    await supabase.from('budgets').delete().eq('id', id);
    fetchBudgets();
    if (addToast) addToast({ type: 'info', title: 'Budget Deleted', message: 'The budget has been removed.' });
    if (refreshInsights) refreshInsights();
  };

  const handleEdit = (b) => {
    setEditingBudget(b);
    setFormData({ category: b.category, allocated: b.allocated.toString(), month_year: b.month_year });
    setFormErrors({});
    setModalOpen(true);
  };

  // Savings Goals
  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    const { isValid, errors } = validateGoalForm(goalForm);
    if (!isValid) {
      setGoalErrors(errors);
      return;
    }
    setGoalErrors({});
    const rawTarget = parseFloat(goalForm.target);
    const rawSaved = parseFloat(goalForm.saved) || 0;
    if (!rawTarget || rawTarget <= 0) {
      setGoalErrors({ ...errors, target: 'Target must be greater than 0' });
      return;
    }
    if (rawSaved < 0) {
      setGoalErrors({ ...errors, saved: 'Saved amount cannot be negative' });
      return;
    }
    const payload = {
      user_id: user.id,
      name: goalForm.name.trim(),
      target: rawTarget,
      saved: Math.min(rawSaved, rawTarget),
      deadline: goalForm.deadline || null,
      icon: GOAL_ICON_KEYS.includes(goalForm.icon) ? goalForm.icon : 'target',
    };
    const wasEditGoal = !!editingGoal;
    try {
      if (editingGoal) {
        const { error } = await supabase
          .from('savings_goals')
          .update({
            name: payload.name, target: payload.target, saved: payload.saved,
            deadline: payload.deadline, icon: payload.icon,
          })
          .eq('id', editingGoal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('savings_goals').insert(payload);
        if (error) throw error;
      }
      await fetchGoals();
      setGoalModal(false); setEditingGoal(null);
      setGoalForm({ name: '', target: '', saved: '', deadline: '', icon: 'target' });
      if (addToast) addToast({
        type: 'success',
        title: wasEditGoal ? 'Goal Updated' : 'Goal Created',
        message: `${payload.name} — target ${formatCurrency(payload.target)}.`
      });
    } catch (err) {
      if (addToast) addToast({ type: 'warning', title: 'Save Failed', message: err.message });
    }
  };

  const deleteGoal = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    try {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id);
      if (error) throw error;
      await fetchGoals();
      if (addToast) addToast({ type: 'info', title: 'Goal Deleted', message: 'The savings goal has been removed.' });
    } catch (err) {
      if (addToast) addToast({ type: 'warning', title: 'Delete Failed', message: err.message });
    }
  };

  const addToGoal = async (id, amount) => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || !isFinite(parsed)) return;
    const g = goals.find(x => x.id === id);
    if (!g) return;
    const newSaved = Math.min(g.saved + parsed, g.target);
    const actuallyAdded = newSaved - g.saved;
    if (actuallyAdded <= 0) return;
    try {
      const { error } = await supabase
        .from('savings_goals')
        .update({ saved: newSaved })
        .eq('id', id);
      if (error) throw error;
      await fetchGoals();
      if (addToast) {
        const hit = newSaved >= g.target && g.saved < g.target;
        addToast({
          type: hit ? 'success' : 'info',
          title: hit ? 'Goal Reached!' : 'Contribution Added',
          message: hit
            ? `You've hit your ${g.name} target of ${formatCurrency(g.target)}.`
            : `${formatCurrency(actuallyAdded)} added to ${g.name}.`
        });
      }
    } catch (err) {
      if (addToast) addToast({ type: 'warning', title: 'Save Failed', message: err.message });
    }
  };

  // Budget Rules
  const applyRule = async () => {
    if (selectedRule === null || !ruleIncome) return;
    const income = parseFloat(ruleIncome);
    const rule = budgetRules[selectedRule];
    // Always apply formulas to the current month (you can't plan the past).
    const monthYear = new Date().toISOString().slice(0, 7);

    // Hard block: can only allocate what came in this month, minus what's
    // already been budgeted for this month.
    const thisMonthIncome = incomeForMonth(monthYear);
    const existingForThisMonth = allocatedForMonth(monthYear);
    const room = thisMonthIncome - existingForThisMonth;

    if (thisMonthIncome === 0) {
      if (addToast) addToast({
        type: 'warning',
        title: 'No income yet',
        message: `No income received in ${monthYear}. Add income transactions before budgeting.`,
      });
      return;
    }

    if (income > room + 0.01) {
      if (addToast) addToast({
        type: 'warning',
        title: 'Too much',
        message: `Max for ${monthYear} is ${formatCurrency(Math.max(0, room))}.`,
      });
      return;
    }

    // Skip labels that already have a budget this month — no silent duplicates.
    const existingLabelsThisMonth = new Set(
      budgets.filter(b => b.month_year === monthYear).map(b => b.category)
    );
    const inserts = rule.split
      .map((pct, i) => ({
        user_id: user.id,
        category: rule.labels[i],
        allocated: (income * pct / 100),
        month_year: monthYear,
      }))
      .filter(b => !existingLabelsThisMonth.has(b.category));

    if (inserts.length === 0) {
      if (addToast) addToast({
        type: 'info',
        title: 'Nothing to create',
        message: `Budgets for ${rule.labels.join(', ')} already exist this month. Edit them individually.`
      });
      return;
    }

    try {
      await supabase.from('budgets').insert(inserts);
      setShowRuleModal(false); setSelectedRule(null); setRuleIncome('');
      fetchBudgets();
      if (addToast) addToast({
        type: 'success',
        title: 'Budget Rule Applied',
        message: `${inserts.length} budget${inserts.length > 1 ? 's' : ''} created from ${formatCurrency(income)}.`
      });
      if (refreshInsights) refreshInsights();
    } catch (e) { console.error('Rule error:', e); if (addToast) addToast({ type: 'warning', title: 'Rule Failed', message: e.message }); }
  };

  const getProgress = (spent, allocated) => Math.min((spent / allocated) * 100, 100);
  const getStatus = (spent, allocated) => {
    const pct = (spent / allocated) * 100;
    if (pct >= 100) return 'exceeded';
    if (pct >= 75) return 'warning';
    return 'good';
  };

  if (loading) return <div className="budgets-loading"><div className="spinner" /></div>;

  // Only show budgets for the currently-selected month. This prevents the
  // summary totals from adding up April + May + … which was confusing users.
  const visibleBudgets = budgets.filter(b => b.month_year === viewMonth);

  // Hierarchical totals: bucket budgets "own" their child categories so we don't
  // double-count. For each individual-category budget, if a bucket that contains
  // that category exists, the individual budget is a sub-limit (already counted
  // by its parent bucket). Only orphan categories (no parent bucket) add to totals.
  const bucketBudgetCategories = visibleBudgets
    .filter(b => BUCKET_MAP[b.category])
    .map(b => b.category);

  // Find which bucket (if any) owns a given individual category
  const parentBucketOf = (category) => {
    for (const bucketName of bucketBudgetCategories) {
      if (BUCKET_MAP[bucketName].includes(category)) return bucketName;
    }
    return null;
  };

  const countsInTotal = (b) => {
    // Bucket budgets always count
    if (BUCKET_MAP[b.category]) return true;
    // Individual budgets only count if no bucket already covers them
    return parentBucketOf(b.category) === null;
  };

  const totalAllocated = visibleBudgets.filter(countsInTotal).reduce((s, b) => s + parseFloat(b.allocated), 0);
  const totalSpent     = visibleBudgets.filter(countsInTotal).reduce((s, b) => s + b.spent, 0);
  const remaining = totalAllocated - totalSpent;

  // Human-friendly label for the selected month
  const viewMonthLabel = new Date(viewMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Actual income received during the selected month (pulled from transactions
  // in InsightsContext). For historical months this is a fact; for current
  // months it's partial; for future months it's zero until money lands.
  const viewMonthIncome = (ctxTransactions || [])
    .filter(t => t.type === 'income' && (t.date || '').slice(0, 7) === viewMonth)
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  // What income figure SHOULD we use as the reference when judging this
  // month's budgets? Current/future months → typical (3-month average).
  // Historical months → what actually came in that month.
  const referenceIncome = viewMonth >= currentMonthKey ? typicalMonthlyIncome : viewMonthIncome;

  // List of months that actually have budgets, for the month picker
  const availableMonths = Array.from(new Set(budgets.map(b => b.month_year))).sort();
  // Always include the current month even if no budgets exist yet
  if (!availableMonths.includes(currentMonthKey)) availableMonths.push(currentMonthKey);
  availableMonths.sort();

  return (
    <div className="budgets-page">
      {/* Tabs */}
      <div className="budgets-tabs">
        <button className={`budgets-tab ${activeTab === 'budgets' ? 'active' : ''}`} onClick={() => setActiveTab('budgets')}>
          <Target size={16} /> Budgets
        </button>
        <button className={`budgets-tab ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')}>
          <PiggyBank size={16} /> Savings Goals
        </button>
      </div>

      {/* =================== BUDGETS TAB =================== */}
      {activeTab === 'budgets' && (
        <>
          {/* Month selector — makes it unambiguous WHICH month you're viewing */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Viewing:</span>
            <input
              type="month"
              value={viewMonth}
              onChange={e => setViewMonth(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '6px 10px',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
              }}
            />
            {viewMonth === currentMonthKey && (
              <span style={{ fontSize: '0.7rem', color: '#22C55E', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                Current month
              </span>
            )}
            {viewMonth < currentMonthKey && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 6 }}>
                Historical
              </span>
            )}
            {viewMonth > currentMonthKey && (
              <span style={{ fontSize: '0.7rem', color: 'var(--plum-glow)', background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                Future plan
              </span>
            )}
          </div>

          {visibleBudgets.length > 0 && (
            <div className="budget-summary">
              <div className="summary-card">
                <span className="summary-label">Budget · {viewMonthLabel}</span>
                <span className="summary-value">{formatCurrency(totalAllocated)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Spent · {viewMonthLabel}</span>
                <span className="summary-value spent">{formatCurrency(totalSpent)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Remaining · {viewMonthLabel}</span>
                <span className={`summary-value ${remaining >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(remaining)}
                </span>
              </div>
            </div>
          )}

          {/* FUNDS SUMMARY — shows this month's income as the ceiling,
              how much of it has been budgeted, and what's left. */}
          {visibleBudgets.length > 0 && (() => {
            const monthIncome = incomeForMonth(viewMonth);
            const monthAllocated = allocatedForMonth(viewMonth);
            const leftToBudget = monthIncome - monthAllocated;
            const overBudgeted = leftToBudget < 0;
            const noIncomeYet = monthIncome === 0;

            return (
              <div style={{
                background: overBudgeted ? 'rgba(239,68,68,0.06)' : noIncomeYet ? 'rgba(245,158,11,0.06)' : 'rgba(168,85,247,0.04)',
                border: `1px solid ${overBudgeted ? 'rgba(239,68,68,0.3)' : noIncomeYet ? 'rgba(245,158,11,0.25)' : 'rgba(168,85,247,0.15)'}`,
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                      {noIncomeYet ? `No income received in ${viewMonthLabel} yet` :
                       overBudgeted ? 'Over-budgeted by' : 'Left to budget'}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: overBudgeted ? '#EF4444' : noIncomeYet ? '#F59E0B' : 'var(--text-primary)' }}>
                      {noIncomeYet ? 'P0' : formatCurrency(Math.abs(leftToBudget))}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right', maxWidth: 440 }}>
                    {noIncomeYet ? (
                      <>Add income transactions for {viewMonthLabel} before creating budgets — you can only budget money you've actually received.</>
                    ) : (
                      <>
                        {viewMonthLabel} income: <strong style={{ color: '#22C55E' }}>{formatCurrency(monthIncome)}</strong>
                        {' · '}Budgeted: <strong style={{ color: overBudgeted ? '#EF4444' : 'var(--text-primary)' }}>{formatCurrency(monthAllocated)}</strong>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="budgets-header">
            <h2>Your Budgets — {viewMonthLabel}</h2>
            <div className="budgets-header-actions">
              <button className="rule-btn" onClick={() => { const avail = Math.max(0, incomeForMonth(currentMonthKey) - allocatedForMonth(currentMonthKey)); setRuleIncome(avail > 0 ? avail.toFixed(0) : ''); setShowRuleModal(true); }}>
                <Zap size={16} /> Budget Formula
              </button>
              <button className="add-budget-btn" onClick={() => { setFormData({ category: 'Food & Dining', allocated: '', month_year: viewMonth >= currentMonthKey ? viewMonth : currentMonthKey }); setFormErrors({}); setEditingBudget(null); setModalOpen(true); }}>
                <Plus size={18} /> Add Budget
              </button>
            </div>
          </div>

          {visibleBudgets.length > 0 ? (
            <div className="budget-grid">
              {visibleBudgets.map(budget => {
                const progress = getProgress(budget.spent, budget.allocated);
                const status = getStatus(budget.spent, budget.allocated);
                return (
                  <div key={budget.id} className={`budget-card ${status}`}>
                    <div className="budget-card-header">
                      <h3>{budget.category}</h3>
                      <div className="budget-actions">
                        <button onClick={() => handleEdit(budget)}><Edit size={16} /></button>
                        <button onClick={() => handleDelete(budget.id)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                    {BUCKET_MAP[budget.category] && (
                      <div className="budget-bucket-hint">
                        Tracks: {BUCKET_MAP[budget.category].slice(0, 3).join(', ')}
                        {BUCKET_MAP[budget.category].length > 3 ? ` +${BUCKET_MAP[budget.category].length - 3} more` : ''}
                      </div>
                    )}
                    {!BUCKET_MAP[budget.category] && parentBucketOf(budget.category) && (
                      <div className="budget-sublimit-hint">
                        Sub-limit within {parentBucketOf(budget.category)}
                      </div>
                    )}
                    <div className="budget-amounts">
                      <span className="spent">{formatCurrency(budget.spent)}</span>
                      <span className="separator">/</span>
                      <span className="allocated">{formatCurrency(budget.allocated)}</span>
                    </div>
                    <div className="budget-progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="budget-footer">
                      <span className="percentage">{progress.toFixed(0)}% used</span>
                      <span className={`status-badge ${status}`}>
                        {status === 'exceeded' ? <><AlertTriangle size={12} /> Over budget</> :
                         status === 'warning' ? <><AlertTriangle size={12} /> Almost there</> :
                         <><CheckCircle size={12} /> On track</>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-container">
              <div className="empty-state">
                <Target size={64} strokeWidth={1} />
                <h3>No budgets for {viewMonthLabel}</h3>
                <p>
                  {viewMonth < currentMonthKey
                    ? `You didn't set any budgets for ${viewMonthLabel}. Switch to the current month to start planning.`
                    : budgets.length === 0
                      ? 'Set budgets to track spending, or use a formula to get started quickly'
                      : `No budgets for this month yet. You have budgets in ${availableMonths.filter(m => m !== viewMonth).join(', ')}.`}
                </p>
                {viewMonth >= currentMonthKey && (
                  <div className="empty-state-actions">
                    <button className="empty-action-btn" onClick={() => { const avail = Math.max(0, incomeForMonth(currentMonthKey) - allocatedForMonth(currentMonthKey)); setRuleIncome(avail > 0 ? avail.toFixed(0) : ''); setShowRuleModal(true); }}>
                      <Zap size={18} /> Use a Formula
                    </button>
                    <button className="empty-action-btn primary" onClick={() => { setFormData({ category: 'Food & Dining', allocated: '', month_year: viewMonth }); setFormErrors({}); setEditingBudget(null); setModalOpen(true); }}>
                      <Plus size={18} /> Create Budget
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* =================== SAVINGS GOALS TAB =================== */}
      {activeTab === 'goals' && (
        <>
          <div className="budgets-header">
            <h2>Savings Goals</h2>
            <button className="add-budget-btn" onClick={() => setGoalModal(true)}>
              <Plus size={18} /> New Goal
            </button>
          </div>

          {goals.length > 0 ? (
            <div className="goals-grid">
              {goals.map(goal => {
                const pct = Math.min((goal.saved / goal.target) * 100, 100);
                const isComplete = goal.saved >= goal.target;
                const daysLeft = goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)) : null;
                const monthlyNeeded = daysLeft && daysLeft > 0 ? ((goal.target - goal.saved) / (daysLeft / 30)).toFixed(0) : null;

                return (
                  <div key={goal.id} className={`goal-card ${isComplete ? 'complete' : ''}`}>
                    <div className="goal-card-header">
                      <div className="goal-icon">
                        {(() => { const Ico = getGoalIconComponent(goal.icon); return <Ico size={22} />; })()}
                      </div>
                      <div className="goal-info">
                        <h3>{goal.name}</h3>
                        {daysLeft !== null && !isComplete && (
                          <span className="goal-deadline">{daysLeft} days left</span>
                        )}
                        {isComplete && <span className="goal-complete-badge"><Award size={12} /> Complete!</span>}
                      </div>
                      <div className="budget-actions">
                        <button onClick={() => { setEditingGoal(goal); setGoalForm({ name: goal.name, target: goal.target.toString(), saved: goal.saved.toString(), deadline: goal.deadline, icon: goal.icon }); setGoalModal(true); }}><Edit size={16} /></button>
                        <button onClick={() => deleteGoal(goal.id)}><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <div className="goal-amounts">
                      <span className="goal-saved">{formatCurrency(Math.min(goal.saved, goal.target))}</span>
                      <span className="goal-target">of {formatCurrency(goal.target)}</span>
                    </div>

                    <div className="budget-progress-bar goal-bar">
                      <div className={`progress-fill ${isComplete ? 'complete' : ''}`} style={{ width: `${pct}%` }} />
                    </div>

                    <div className="goal-footer">
                      <span className="percentage">{pct.toFixed(0)}% saved</span>
                      {monthlyNeeded && !isComplete && (
                        <span className="goal-monthly">Save {formatCurrency(monthlyNeeded)}/mo to reach goal</span>
                      )}
                    </div>

                    {!isComplete && (
                      <div className="goal-add-funds">
                        <input type="number" placeholder="Add amount..." min="0" step="0.01"
                          max={goal.target - goal.saved}
                          onKeyDown={(e) => { if (e.key === 'Enter') { addToGoal(goal.id, e.target.value); e.target.value = ''; }}}
                        />
                        <button onClick={(e) => {
                          const input = e.target.closest('.goal-add-funds').querySelector('input');
                          addToGoal(goal.id, input.value); input.value = '';
                        }}>
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-container">
              <div className="empty-state">
                <PiggyBank size={64} strokeWidth={1} />
                <h3>No savings goals yet</h3>
                <p>Set goals for things like emergency fund, vacation, or a new car</p>
                <button className="empty-action-btn primary" onClick={() => setGoalModal(true)}>
                  <Plus size={18} /> Create Your First Goal
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* =================== BUDGET MODAL =================== */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => { setModalOpen(false); setEditingBudget(null); setFormErrors({}); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBudget ? 'Edit Budget' : 'Create Budget'}</h2>
              <button className="modal-close" onClick={() => { setModalOpen(false); setEditingBudget(null); setFormErrors({}); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form" noValidate>
              {/* Live financial-logic guidance so users see WHY constraints exist */}
              {!editingBudget && modalIsPast && (
                <div className="validation-summary" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  You can't create a budget for a past month. Pick {currentMonthKey} or later — budgets are forward-looking plans.
                </div>
              )}
              {modalDuplicate && (
                <div className="validation-summary" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  A budget for <strong>{formData.category}</strong> already exists for {formData.month_year}. Edit it from the list instead.
                </div>
              )}

              {/* Available-funds hint — one line, using THIS month's income */}
              {!modalIsPast && !modalExceedsFunds && modalMonthIncome > 0 && (
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginBottom: 10,
                  padding: '8px 12px',
                  background: 'rgba(168,85,247,0.05)',
                  borderRadius: 8,
                }}>
                  {formData.month_year} income: <strong style={{ color: '#22C55E' }}>{formatCurrency(modalMonthIncome)}</strong>
                  {existingThisMonthAllocated > 0 && <> · Already budgeted: {formatCurrency(existingThisMonthAllocated)}</>}
                  {' · '}Max for this budget: <strong style={{ color: '#22C55E' }}>{formatCurrency(modalRoomLeft)}</strong>
                </div>
              )}
              {!modalIsPast && modalMonthIncome === 0 && (
                <div style={{
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 10,
                  fontSize: '0.8rem',
                  color: '#F59E0B',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <AlertTriangle size={14} />
                  No income received in {formData.month_year} yet. Add income first.
                </div>
              )}
              {!modalIsPast && modalExceedsFunds && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  marginBottom: 10,
                  fontSize: '0.8rem',
                  color: '#EF4444',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <AlertTriangle size={14} />
                  Too much. Max is {formatCurrency(modalRoomLeft)}.
                </div>
              )}

              {!modalIsPast && !modalDuplicate && modalAlreadySpent > 0 && (
                <div className="validation-summary" style={{
                  background: modalBelowSpent ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                  borderColor: modalBelowSpent ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                  color: modalBelowSpent ? '#EF4444' : '#F59E0B'
                }}>
                  <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  You've already spent <strong>{formatCurrency(modalAlreadySpent)}</strong> in {formData.category} during {formData.month_year}.
                  {modalBelowSpent
                    ? ` Your budget must be at least ${formatCurrency(modalAlreadySpent)} or it'll be over-budget from day one.`
                    : ' Your budget needs to cover this plus whatever you plan to spend for the rest of the month.'}
                </div>
              )}
              <div className={`form-group ${formErrors.category ? 'has-error' : ''}`}>
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {formErrors.category ? <span className="field-error">{formErrors.category}</span> : <span className="field-hint">The spending category this budget tracks</span>}
              </div>
              <div className={`form-group ${formErrors.allocated ? 'has-error' : ''}`}>
                <label>Budget Amount (P)</label>
                <input type="number" value={formData.allocated} onChange={e => { setFormData({ ...formData, allocated: e.target.value }); if (formErrors.allocated) setFormErrors({...formErrors, allocated: ''}); }} placeholder="0.00" min={modalAlreadySpent || 0} step="0.01" />
                {formErrors.allocated
                  ? <span className="field-error">{formErrors.allocated}</span>
                  : <span className="field-hint">
                      {modalAlreadySpent > 0 && `Already spent ${formatCurrency(modalAlreadySpent)}. `}
                      Max {formatCurrency(modalRoomLeft)}
                    </span>}
              </div>
              <div className={`form-group ${formErrors.month_year ? 'has-error' : ''}`}>
                <label>Month</label>
                <input type="month" value={formData.month_year} min={editingBudget ? undefined : currentMonthKey} onChange={e => { setFormData({ ...formData, month_year: e.target.value }); if (formErrors.month_year) setFormErrors({...formErrors, month_year: ''}); }} />
                {formErrors.month_year ? <span className="field-error">{formErrors.month_year}</span> : <span className="field-hint">{editingBudget ? 'The month this budget applies to' : `Current month or later (you can't budget the past)`}</span>}
              </div>
              <button type="submit" className="submit-btn" disabled={modalIsPast || modalDuplicate || modalBelowSpent || modalExceedsFunds}>
                {editingBudget ? 'Save Changes' : 'Create Budget'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =================== GOAL MODAL =================== */}
      {goalModal && (
        <div className="modal-overlay" onClick={() => { setGoalModal(false); setEditingGoal(null); setGoalErrors({}); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGoal ? 'Edit Goal' : 'New Savings Goal'}</h2>
              <button className="modal-close" onClick={() => { setGoalModal(false); setEditingGoal(null); setGoalErrors({}); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleGoalSubmit} className="modal-form" noValidate>
              <div className="form-group">
                <label>Icon</label>
                <div className="icon-picker">
                  {GOAL_ICON_KEYS.map(key => {
                    const Ico = GOAL_ICONS[key];
                    return (
                      <button type="button" key={key}
                        className={`icon-option ${goalForm.icon === key ? 'active' : ''}`}
                        onClick={() => setGoalForm({ ...goalForm, icon: key })}
                        aria-label={key}
                      ><Ico size={18} /></button>
                    );
                  })}
                </div>
              </div>
              <div className={`form-group ${goalErrors.name ? 'has-error' : ''}`}>
                <label>Goal Name</label>
                <input type="text" value={goalForm.name} onChange={e => { setGoalForm({ ...goalForm, name: e.target.value }); if (goalErrors.name) setGoalErrors({...goalErrors, name: ''}); }} placeholder="e.g. Emergency Fund, Vacation, New Car" maxLength={50} />
                {goalErrors.name ? <span className="field-error">{goalErrors.name}</span> : <span className="field-hint">2-50 characters describing what you're saving for</span>}
              </div>
              <div className="form-row">
                <div className={`form-group ${goalErrors.target ? 'has-error' : ''}`}>
                  <label>Target Amount (P)</label>
                  <input type="number" value={goalForm.target} onChange={e => { setGoalForm({ ...goalForm, target: e.target.value }); if (goalErrors.target) setGoalErrors({...goalErrors, target: ''}); }} placeholder="0.00" min="0" step="0.01" />
                  {goalErrors.target ? <span className="field-error">{goalErrors.target}</span> : <span className="field-hint">Min P10, realistic target</span>}
                </div>
                <div className={`form-group ${goalErrors.saved ? 'has-error' : ''}`}>
                  <label>Already Saved (P)</label>
                  <input type="number" value={goalForm.saved} onChange={e => { setGoalForm({ ...goalForm, saved: e.target.value }); if (goalErrors.saved) setGoalErrors({...goalErrors, saved: ''}); }} placeholder="0.00" min="0" step="0.01" />
                  {goalErrors.saved ? <span className="field-error">{goalErrors.saved}</span> : <span className="field-hint">Optional, can't exceed target</span>}
                </div>
              </div>
              <div className={`form-group ${goalErrors.deadline ? 'has-error' : ''}`}>
                <label>Target Date (optional)</label>
                <div className="date-picker-trio">
                  <select
                    value={goalForm.deadline ? goalForm.deadline.slice(8, 10) : ''}
                    onChange={e => {
                      const parts = (goalForm.deadline || '----').split('-');
                      const y = parts[0] && parts[0] !== '----' ? parts[0] : String(new Date().getFullYear());
                      const m = parts[1] || '01';
                      const d = e.target.value;
                      const newDate = d ? `${y}-${m}-${d}` : '';
                      setGoalForm({ ...goalForm, deadline: newDate });
                      if (goalErrors.deadline) setGoalErrors({ ...goalErrors, deadline: '' });
                    }}
                    className="date-select"
                  >
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => {
                      const d = String(i + 1).padStart(2, '0');
                      return <option key={d} value={d}>{d}</option>;
                    })}
                  </select>
                  <select
                    value={goalForm.deadline ? goalForm.deadline.slice(5, 7) : ''}
                    onChange={e => {
                      const parts = (goalForm.deadline || '----').split('-');
                      const y = parts[0] && parts[0] !== '----' ? parts[0] : String(new Date().getFullYear());
                      const d = parts[2] || '01';
                      const m = e.target.value;
                      const newDate = m ? `${y}-${m}-${d}` : '';
                      setGoalForm({ ...goalForm, deadline: newDate });
                      if (goalErrors.deadline) setGoalErrors({ ...goalErrors, deadline: '' });
                    }}
                    className="date-select"
                  >
                    <option value="">Month</option>
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((n, i) => {
                      const m = String(i + 1).padStart(2, '0');
                      return <option key={m} value={m}>{n}</option>;
                    })}
                  </select>
                  <select
                    value={goalForm.deadline ? goalForm.deadline.slice(0, 4) : ''}
                    onChange={e => {
                      const parts = (goalForm.deadline || '----').split('-');
                      const m = parts[1] || '01';
                      const d = parts[2] || '01';
                      const y = e.target.value;
                      const newDate = y ? `${y}-${m}-${d}` : '';
                      setGoalForm({ ...goalForm, deadline: newDate });
                      if (goalErrors.deadline) setGoalErrors({ ...goalErrors, deadline: '' });
                    }}
                    className="date-select"
                  >
                    <option value="">Year</option>
                    {Array.from({ length: 11 }, (_, i) => {
                      const y = String(new Date().getFullYear() + i);
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                {goalErrors.deadline ? <span className="field-error">{goalErrors.deadline}</span> : <span className="field-hint">When you want to reach this goal</span>}
              </div>
              <button type="submit" className="submit-btn">{editingGoal ? 'Save Changes' : 'Create Goal'}</button>
            </form>
          </div>
        </div>
      )}

      {/* =================== BUDGET FORMULA MODAL =================== */}
      {showRuleModal && (
        <div className="modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="modal rule-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Zap size={18} /> Budget Formula</h2>
              <button className="modal-close" onClick={() => setShowRuleModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-form">
              <p className="rule-desc">
                Pick a formula. It splits what you have into budget buckets for <strong>{currentMonthKey}</strong>.
              </p>

              {/* One big number — how much can this formula allocate? */}
              {(() => {
                const availableForFormula = Math.max(0, incomeForMonth(currentMonthKey) - allocatedForMonth(currentMonthKey));
                return (
                  <div style={{
                    background: availableForFormula > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${availableForFormula > 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    borderRadius: 12,
                    padding: '14px 18px',
                    marginBottom: 16,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      Available right now
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: availableForFormula > 0 ? '#22C55E' : '#EF4444' }}>
                      {formatCurrency(availableForFormula)}
                    </div>
                    {availableForFormula === 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: 6 }}>
                        Add income or free up an existing budget to continue.
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="rule-options">
                {budgetRules.map((rule, i) => (
                  <button key={i} type="button"
                    className={`rule-option ${selectedRule === i ? 'active' : ''}`}
                    onClick={() => setSelectedRule(i)}
                  >
                    <div className="rule-option-header">
                      <strong>{rule.name}</strong>
                      <span>{rule.desc}</span>
                    </div>
                    <div className="rule-splits">
                      {rule.split.map((pct, j) => (
                        <div key={j} className="rule-split">
                          <span className="rule-split-pct">{pct}%</span>
                          <span className="rule-split-label">{rule.labels[j]}</span>
                        </div>
                      ))}
                    </div>
                    {selectedRule === i && ruleIncome && (
                      <div className="rule-preview">
                        {rule.split.map((pct, j) => (
                          <div key={j} className="rule-preview-item">
                            <span>{rule.labels[j]}</span>
                            <span>{formatCurrency(parseFloat(ruleIncome) * pct / 100)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {selectedRule !== null && (() => {
                const availableForFormula = Math.max(0, incomeForMonth(currentMonthKey) - allocatedForMonth(currentMonthKey));
                const ruleTotal = parseFloat(ruleIncome || 0);
                const exceeds = ruleTotal > availableForFormula + 0.01;
                return (
                  <div className="form-group">
                    <label>Amount to allocate</label>
                    <input
                      type="number"
                      value={ruleIncome}
                      onChange={e => setRuleIncome(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      max={availableForFormula}
                      step="0.01"
                    />
                    {exceeds
                      ? <span className="field-error">Too much. Max is {formatCurrency(availableForFormula)}.</span>
                      : <span className="field-hint">Max {formatCurrency(availableForFormula)}</span>}
                  </div>
                );
              })()}
              <button
                className="submit-btn"
                onClick={applyRule}
                disabled={(() => {
                  if (selectedRule === null || !ruleIncome) return true;
                  const availableForFormula = incomeForMonth(currentMonthKey) - allocatedForMonth(currentMonthKey);
                  return parseFloat(ruleIncome) > availableForFormula + 0.01;
                })()}
              >
                <Zap size={16} /> Apply Formula
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budgets;
