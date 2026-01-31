import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, X, AlertTriangle, CheckCircle } from 'lucide-react';
import './Budgets.css';

const Budgets = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({
    category: 'Food & Dining',
    allocated: '',
    month_year: new Date().toISOString().slice(0, 7),
  });

  const categories = [
    'Food & Dining',
    'Transportation',
    'Housing',
    'Utilities',
    'Entertainment',
    'Shopping',
    'Health & Fitness',
    'Education',
    'Other',
  ];

  useEffect(() => {
    fetchBudgets();
  }, [user]);

  const fetchBudgets = async () => {
    try {
      // Fetch budgets
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id);

      if (budgetsError) throw budgetsError;

      // Fetch transactions to calculate spent amounts
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense');

      // Calculate spent per category
      const spentByCategory = (transactionsData || []).reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
        return acc;
      }, {});

      // Merge budgets with spent amounts
      const budgetsWithSpent = (budgetsData || []).map(b => ({
        ...b,
        spent: spentByCategory[b.category] || 0,
      }));

      setBudgets(budgetsWithSpent);
    } catch (error) {
      console.error('Error fetching budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingBudget) {
        const { error } = await supabase
          .from('budgets')
          .update({
            category: formData.category,
            allocated: parseFloat(formData.allocated),
            month_year: formData.month_year,
          })
          .eq('id', editingBudget.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('budgets')
          .insert({
            user_id: user.id,
            category: formData.category,
            allocated: parseFloat(formData.allocated),
            month_year: formData.month_year,
          });

        if (error) throw error;
      }

      setModalOpen(false);
      setEditingBudget(null);
      setFormData({
        category: 'Food & Dining',
        allocated: '',
        month_year: new Date().toISOString().slice(0, 7),
      });
      fetchBudgets();
    } catch (error) {
      console.error('Error saving budget:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this budget?')) return;
    
    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
    }
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category,
      allocated: budget.allocated.toString(),
      month_year: budget.month_year,
    });
    setModalOpen(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-BW', {
      style: 'currency',
      currency: 'BWP',
      minimumFractionDigits: 2,
    }).format(amount).replace('BWP', 'P');
  };

  const getProgress = (spent, allocated) => {
    return Math.min((spent / allocated) * 100, 100);
  };

  const getStatus = (spent, allocated) => {
    const percentage = (spent / allocated) * 100;
    if (percentage >= 100) return 'exceeded';
    if (percentage >= 75) return 'warning';
    return 'good';
  };

  // Demo budgets
  const demoBudgets = [
    { id: 1, category: 'Food & Dining', allocated: 1500, spent: 720, month_year: '2026-01' },
    { id: 2, category: 'Housing', allocated: 3000, spent: 3000, month_year: '2026-01' },
    { id: 3, category: 'Transportation', allocated: 800, spent: 136, month_year: '2026-01' },
    { id: 4, category: 'Utilities', allocated: 600, spent: 462, month_year: '2026-01' },
    { id: 5, category: 'Entertainment', allocated: 400, spent: 120, month_year: '2026-01' },
    { id: 6, category: 'Education', allocated: 1000, spent: 650, month_year: '2026-01' },
  ];

  const displayBudgets = budgets.length > 0 ? budgets : demoBudgets;

  const totalAllocated = displayBudgets.reduce((sum, b) => sum + b.allocated, 0);
  const totalSpent = displayBudgets.reduce((sum, b) => sum + b.spent, 0);
  const remaining = totalAllocated - totalSpent;

  return (
    <div className="budgets-page">
      {/* Summary Cards */}
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

      {/* Actions */}
      <div className="budgets-header">
        <h2>Your Budgets</h2>
        <button className="add-budget-btn" onClick={() => setModalOpen(true)}>
          <Plus size={18} />
          Add Budget
        </button>
      </div>

      {/* Budget Grid */}
      <div className="budget-grid">
        {displayBudgets.map((budget) => {
          const progress = getProgress(budget.spent, budget.allocated);
          const status = getStatus(budget.spent, budget.allocated);
          
          return (
            <div key={budget.id} className={`budget-card ${status}`}>
              <div className="budget-card-header">
                <h3>{budget.category}</h3>
                <div className="budget-actions">
                  <button onClick={() => handleEdit(budget)}>
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(budget.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="budget-amounts">
                <span className="spent">{formatCurrency(budget.spent)}</span>
                <span className="separator">/</span>
                <span className="allocated">{formatCurrency(budget.allocated)}</span>
              </div>
              
              <div className="budget-progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="budget-footer">
                <span className="percentage">{progress.toFixed(0)}% used</span>
                <span className={`status-badge ${status}`}>
                  {status === 'exceeded' && <AlertTriangle size={12} />}
                  {status === 'warning' && <AlertTriangle size={12} />}
                  {status === 'good' && <CheckCircle size={12} />}
                  {status === 'exceeded' ? 'Over budget' : status === 'warning' ? 'Almost there' : 'On track'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => { setModalOpen(false); setEditingBudget(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBudget ? 'Edit Budget' : 'Create Budget'}</h2>
              <button className="modal-close" onClick={() => { setModalOpen(false); setEditingBudget(null); }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="allocated">Budget Amount (P)</label>
                <input
                  type="number"
                  id="allocated"
                  value={formData.allocated}
                  onChange={(e) => setFormData({ ...formData, allocated: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="month_year">Month</label>
                <input
                  type="month"
                  id="month_year"
                  value={formData.month_year}
                  onChange={(e) => setFormData({ ...formData, month_year: e.target.value })}
                  required
                />
              </div>
              
              <button type="submit" className="submit-btn">
                {editingBudget ? 'Save Changes' : 'Create Budget'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budgets;
