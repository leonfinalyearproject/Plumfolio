import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import {
  Plus, Edit, Trash2, X, AlertTriangle, CheckCircle, Target,
  TrendingUp, PiggyBank, Repeat, Zap, Award, ArrowRight
} from 'lucide-react';
import './Budgets.css';

const Budgets = () => {
  const { formatCurrency } = useCurrency();
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

  // Savings goals (stored in localStorage since no DB table)
  const [goals, setGoals] = useState([]);
  const [goalModal, setGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({
    name: '', target: '', saved: '', deadline: '', icon: '🎯',
  });

  const categories = [
    'Food & Dining', 'Transportation', 'Housing', 'Utilities',
    'Entertainment', 'Shopping', 'Health & Fitness', 'Education',
    'Groceries', 'Subscriptions', 'Personal Care', 'Travel',
    'Savings', 'Investments', 'Gifts & Donations', 'Other',
  ];

  const goalIcons = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '🎓', '💰', '🏋️', '🎮', '👶', '💍', '🏖️', '🎸'];

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
    if (user) fetchBudgets();
    else setLoading(false);
    // Load goals from localStorage
    const stored = localStorage.getItem('plumfolio_goals_' + (user?.id || ''));
    if (stored) setGoals(JSON.parse(stored));
  }, [user?.id]);

  const saveGoals = (updated) => {
    setGoals(updated);
    localStorage.setItem('plumfolio_goals_' + (user?.id || ''), JSON.stringify(updated));
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
        ...b, spent: spentByCategory[b.category] || 0,
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
    try {
      const payload = { category: formData.category, allocated: parseFloat(formData.allocated), month_year: formData.month_year };
      if (editingBudget) {
        await supabase.from('budgets').update(payload).eq('id', editingBudget.id);
      } else {
        await supabase.from('budgets').insert({ ...payload, user_id: user.id });
      }
      setModalOpen(false); setEditingBudget(null);
      setFormData({ category: 'Food & Dining', allocated: '', month_year: new Date().toISOString().slice(0, 7) });
      fetchBudgets();
    } catch (error) { console.error('Save error:', error); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget?')) return;
    await supabase.from('budgets').delete().eq('id', id);
    fetchBudgets();
  };

  const handleEdit = (b) => {
    setEditingBudget(b);
    setFormData({ category: b.category, allocated: b.allocated.toString(), month_year: b.month_year });
    setModalOpen(true);
  };

  // Savings Goals
  const handleGoalSubmit = (e) => {
    e.preventDefault();
    const goal = {
      id: editingGoal ? editingGoal.id : Date.now().toString(),
      name: goalForm.name,
      target: parseFloat(goalForm.target),
      saved: parseFloat(goalForm.saved) || 0,
      deadline: goalForm.deadline,
      icon: goalForm.icon,
    };
    if (editingGoal) {
      saveGoals(goals.map(g => g.id === goal.id ? goal : g));
    } else {
      saveGoals([...goals, goal]);
    }
    setGoalModal(false); setEditingGoal(null);
    setGoalForm({ name: '', target: '', saved: '', deadline: '', icon: '🎯' });
  };

  const deleteGoal = (id) => {
    if (!window.confirm('Delete this goal?')) return;
    saveGoals(goals.filter(g => g.id !== id));
  };

  const addToGoal = (id, amount) => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;
    saveGoals(goals.map(g => g.id === id ? { ...g, saved: g.saved + parsed } : g));
  };

  // Budget Rules
  const applyRule = async () => {
    if (!selectedRule || !ruleIncome) return;
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
    } catch (e) { console.error('Rule error:', e); }
  };

  const getProgress = (spent, allocated) => Math.min((spent / allocated) * 100, 100);
  const getStatus = (spent, allocated) => {
    const pct = (spent / allocated) * 100;
    if (pct >= 100) return 'exceeded';
    if (pct >= 75) return 'warning';
    return 'good';
  };

  if (loading) return <div className="budgets-loading"><div className="spinner" /></div>;

  const totalAllocated = budgets.reduce((s, b) => s + parseFloat(b.allocated), 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
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
                      <div className="goal-icon">{goal.icon}</div>
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
                      <span className="goal-saved">{formatCurrency(goal.saved)}</span>
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
        <div className="modal-overlay" onClick={() => { setModalOpen(false); setEditingBudget(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBudget ? 'Edit Budget' : 'Create Budget'}</h2>
              <button className="modal-close" onClick={() => { setModalOpen(false); setEditingBudget(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Budget Amount (P)</label>
                <input type="number" value={formData.allocated} onChange={e => setFormData({ ...formData, allocated: e.target.value })} placeholder="0.00" min="0" step="0.01" required />
              </div>
              <div className="form-group">
                <label>Month</label>
                <input type="month" value={formData.month_year} onChange={e => setFormData({ ...formData, month_year: e.target.value })} required />
              </div>
              <button type="submit" className="submit-btn">{editingBudget ? 'Save Changes' : 'Create Budget'}</button>
            </form>
          </div>
        </div>
      )}

      {/* =================== GOAL MODAL =================== */}
      {goalModal && (
        <div className="modal-overlay" onClick={() => { setGoalModal(false); setEditingGoal(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGoal ? 'Edit Goal' : 'New Savings Goal'}</h2>
              <button className="modal-close" onClick={() => { setGoalModal(false); setEditingGoal(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleGoalSubmit} className="modal-form">
              <div className="form-group">
                <label>Icon</label>
                <div className="icon-picker">
                  {goalIcons.map(icon => (
                    <button type="button" key={icon}
                      className={`icon-option ${goalForm.icon === icon ? 'active' : ''}`}
                      onClick={() => setGoalForm({ ...goalForm, icon })}
                    >{icon}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Goal Name</label>
                <input type="text" value={goalForm.name} onChange={e => setGoalForm({ ...goalForm, name: e.target.value })} placeholder="e.g. Emergency Fund, Vacation, New Car" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Target Amount (P)</label>
                  <input type="number" value={goalForm.target} onChange={e => setGoalForm({ ...goalForm, target: e.target.value })} placeholder="0.00" min="0" step="0.01" required />
                </div>
                <div className="form-group">
                  <label>Already Saved (P)</label>
                  <input type="number" value={goalForm.saved} onChange={e => setGoalForm({ ...goalForm, saved: e.target.value })} placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>
              <div className="form-group">
                <label>Target Date (optional)</label>
                <input type="date" value={goalForm.deadline} onChange={e => setGoalForm({ ...goalForm, deadline: e.target.value })} />
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
