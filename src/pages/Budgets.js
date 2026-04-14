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
  const { addToast, refreshInsights } = useInsights();
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
      const spentByCategory = (txnRes.data || []).reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
        return acc;
      }, {});
      const budgetsWithSpent = (budgetsRes.data || []).map(b => ({
        ...b, spent: calcSpent(b.category, spentByCategory),
      }));
      setBudgets(budgetsWithSpent);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { isValid, errors } = validateBudgetForm(formData, categories);
    if (!isValid) {
      setFormErrors(errors);
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
    const monthYear = new Date().toISOString().slice(0, 7);
    const inserts = rule.split.map((pct, i) => ({
      user_id: user.id,
      category: rule.labels[i],
      allocated: (income * pct / 100),
      month_year: monthYear,
    }));
    try {
      await supabase.from('budgets').insert(inserts);
      setShowRuleModal(false); setSelectedRule(null); setRuleIncome('');
      fetchBudgets();
      if (addToast) addToast({
        type: 'success',
        title: 'Budget Rule Applied',
        message: `${rule.labels.length} budgets created from ${formatCurrency(income)} income.`
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

  // Hierarchical totals: bucket budgets "own" their child categories so we don't
  // double-count. For each individual-category budget, if a bucket that contains
  // that category exists, the individual budget is a sub-limit (already counted
  // by its parent bucket). Only orphan categories (no parent bucket) add to totals.
  const bucketBudgetCategories = budgets
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

  const totalAllocated = budgets.filter(countsInTotal).reduce((s, b) => s + parseFloat(b.allocated), 0);
  const totalSpent     = budgets.filter(countsInTotal).reduce((s, b) => s + b.spent, 0);
  const remaining = totalAllocated - totalSpent;

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
          {budgets.length > 0 && (
            <div className="budget-summary">
              <div className="summary-card">
                <span className="summary-label">Total Budget</span>
                <span className="summary-value">{formatCurrency(totalAllocated)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Total Spent</span>
                <span className="summary-value spent">{formatCurrency(totalSpent)}</span>
              </div>
              <div className="summary-card">
                <span className="summary-label">Remaining</span>
                <span className={`summary-value ${remaining >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(remaining)}
                </span>
              </div>
            </div>
          )}

          <div className="budgets-header">
            <h2>Your Budgets</h2>
            <div className="budgets-header-actions">
              <button className="rule-btn" onClick={() => setShowRuleModal(true)}>
                <Zap size={16} /> Budget Formula
              </button>
              <button className="add-budget-btn" onClick={() => setModalOpen(true)}>
                <Plus size={18} /> Add Budget
              </button>
            </div>
          </div>

          {budgets.length > 0 ? (
            <div className="budget-grid">
              {budgets.map(budget => {
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
                <h3>No budgets yet</h3>
                <p>Set budgets to track spending, or use a formula to get started quickly</p>
                <div className="empty-state-actions">
                  <button className="empty-action-btn" onClick={() => setShowRuleModal(true)}>
                    <Zap size={18} /> Use a Formula
                  </button>
                  <button className="empty-action-btn primary" onClick={() => setModalOpen(true)}>
                    <Plus size={18} /> Create Budget
                  </button>
                </div>
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
              <div className={`form-group ${formErrors.category ? 'has-error' : ''}`}>
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {formErrors.category ? <span className="field-error">{formErrors.category}</span> : <span className="field-hint">The spending category this budget tracks</span>}
              </div>
              <div className={`form-group ${formErrors.allocated ? 'has-error' : ''}`}>
                <label>Budget Amount (P)</label>
                <input type="number" value={formData.allocated} onChange={e => { setFormData({ ...formData, allocated: e.target.value }); if (formErrors.allocated) setFormErrors({...formErrors, allocated: ''}); }} placeholder="0.00" min="0" step="0.01" />
                {formErrors.allocated ? <span className="field-error">{formErrors.allocated}</span> : <span className="field-hint">Minimum P10, up to P10,000,000</span>}
              </div>
              <div className={`form-group ${formErrors.month_year ? 'has-error' : ''}`}>
                <label>Month</label>
                <input type="month" value={formData.month_year} onChange={e => { setFormData({ ...formData, month_year: e.target.value }); if (formErrors.month_year) setFormErrors({...formErrors, month_year: ''}); }} />
                {formErrors.month_year ? <span className="field-error">{formErrors.month_year}</span> : <span className="field-hint">The month this budget applies to</span>}
              </div>
              <button type="submit" className="submit-btn">{editingBudget ? 'Save Changes' : 'Create Budget'}</button>
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
              <p className="rule-desc">Choose a formula and enter your monthly income to auto-create budgets.</p>
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
              {selectedRule !== null && (
                <div className="form-group">
                  <label>Monthly Income (P)</label>
                  <input type="number" value={ruleIncome} onChange={e => setRuleIncome(e.target.value)} placeholder="Enter your monthly income" min="0" step="0.01" />
                </div>
              )}
              <button className="submit-btn" onClick={applyRule} disabled={selectedRule === null || !ruleIncome}>
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
