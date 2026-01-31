import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Filter, 
  Download, 
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  Coffee,
  Home,
  Car,
  Zap,
  GraduationCap,
  ShoppingCart,
  Wallet,
  Briefcase,
  Heart,
  Film,
  MoreHorizontal,
  Trash2,
  Edit
} from 'lucide-react';
import './Transactions.css';

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    description: '',
    category: 'Food & Dining',
    date: new Date().toISOString().split('T')[0],
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
    'Income',
    'Other',
  ];

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTransaction) {
        const { error } = await supabase
          .from('transactions')
          .update({
            type: formData.type,
            amount: parseFloat(formData.amount),
            description: formData.description,
            category: formData.category,
            date: formData.date,
          })
          .eq('id', editingTransaction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: formData.type,
            amount: parseFloat(formData.amount),
            description: formData.description,
            category: formData.category,
            date: formData.date,
          });

        if (error) throw error;
      }

      setModalOpen(false);
      setEditingTransaction(null);
      setFormData({
        type: 'expense',
        amount: '',
        description: '',
        category: 'Food & Dining',
        date: new Date().toISOString().split('T')[0],
      });
      fetchTransactions();
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      category: transaction.category,
      date: transaction.date,
    });
    setModalOpen(true);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Dining': Coffee,
      'Housing': Home,
      'Transportation': Car,
      'Utilities': Zap,
      'Education': GraduationCap,
      'Income': Wallet,
      'Shopping': ShoppingCart,
      'Health & Fitness': Heart,
      'Entertainment': Film,
      'Other': MoreHorizontal,
    };
    return icons[category] || ShoppingCart;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-BW', {
      style: 'currency',
      currency: 'BWP',
      minimumFractionDigits: 2,
    }).format(amount).replace('BWP', 'P');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  // Demo transactions if no real data
  const demoTransactions = [
    { id: 1, description: 'Salary Deposit', category: 'Income', type: 'income', amount: 5200, date: '2026-01-30' },
    { id: 2, description: 'Groceries at Choppies', category: 'Food & Dining', type: 'expense', amount: 156.32, date: '2026-01-29' },
    { id: 3, description: 'Electric Bill - BPC', category: 'Utilities', type: 'expense', amount: 289.00, date: '2026-01-28' },
    { id: 4, description: 'Freelance Web Design', category: 'Income', type: 'income', amount: 1750, date: '2026-01-27' },
    { id: 5, description: 'Coffee & Snacks', category: 'Food & Dining', type: 'expense', amount: 84.50, date: '2026-01-26' },
    { id: 6, description: 'Fuel - Shell', category: 'Transportation', type: 'expense', amount: 450.00, date: '2026-01-25' },
    { id: 7, description: 'Internet - BTCL', category: 'Utilities', type: 'expense', amount: 399.00, date: '2026-01-24' },
    { id: 8, description: 'Gym Membership', category: 'Health & Fitness', type: 'expense', amount: 350.00, date: '2026-01-23' },
    { id: 9, description: 'Movie Tickets', category: 'Entertainment', type: 'expense', amount: 120.00, date: '2026-01-22' },
    { id: 10, description: 'Textbooks', category: 'Education', type: 'expense', amount: 650.00, date: '2026-01-21' },
    { id: 11, description: 'Part-time Job', category: 'Income', type: 'income', amount: 800, date: '2026-01-20' },
    { id: 12, description: 'Rent Payment', category: 'Housing', type: 'expense', amount: 2500.00, date: '2026-01-15' },
  ];

  const displayTransactions = transactions.length > 0 
    ? filteredTransactions 
    : demoTransactions.filter((t) => filter === 'all' || t.type === filter);

  return (
    <div className="transactions-page">
      {/* Actions Bar */}
      <div className="actions-bar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-tab ${filter === 'income' ? 'active' : ''}`}
            onClick={() => setFilter('income')}
          >
            Income
          </button>
          <button 
            className={`filter-tab ${filter === 'expense' ? 'active' : ''}`}
            onClick={() => setFilter('expense')}
          >
            Expenses
          </button>
        </div>
        
        <div className="action-buttons">
          <button className="action-btn secondary">
            <Filter size={18} />
            <span>Filter</span>
          </button>
          <button className="action-btn secondary">
            <Download size={18} />
            <span>Export</span>
          </button>
          <button className="action-btn primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="transactions-table-wrapper">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Type</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayTransactions.map((transaction) => {
              const Icon = getCategoryIcon(transaction.category);
              return (
                <tr key={transaction.id}>
                  <td className="date-cell">{formatDate(transaction.date)}</td>
                  <td className="desc-cell">
                    <div className="desc-wrapper">
                      <div className="transaction-icon">
                        <Icon size={16} />
                      </div>
                      <span>{transaction.description}</span>
                    </div>
                  </td>
                  <td>
                    <span className="category-badge">{transaction.category}</span>
                  </td>
                  <td>
                    <span className={`type-badge ${transaction.type}`}>
                      {transaction.type === 'income' ? (
                        <ArrowUpCircle size={14} />
                      ) : (
                        <ArrowDownCircle size={14} />
                      )}
                      {transaction.type}
                    </span>
                  </td>
                  <td className={`amount-cell ${transaction.type}`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="row-action edit"
                      onClick={() => handleEdit(transaction)}
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      className="row-action delete"
                      onClick={() => handleDelete(transaction.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile FAB */}
      <button className="fab" onClick={() => setModalOpen(true)}>
        <Plus size={24} />
      </button>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => { setModalOpen(false); setEditingTransaction(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
              <button className="modal-close" onClick={() => { setModalOpen(false); setEditingTransaction(null); }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="type-selector">
                <button
                  type="button"
                  className={`type-btn ${formData.type === 'income' ? 'active income' : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                >
                  <ArrowUpCircle size={20} />
                  Income
                </button>
                <button
                  type="button"
                  className={`type-btn ${formData.type === 'expense' ? 'active expense' : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'expense' })}
                >
                  <ArrowDownCircle size={20} />
                  Expense
                </button>
              </div>
              
              <div className="form-group">
                <label htmlFor="amount">Amount (P)</label>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                  required
                />
              </div>
              
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
                <label htmlFor="date">Date</label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              
              <button type="submit" className="submit-btn">
                {editingTransaction ? 'Save Changes' : 'Add Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
