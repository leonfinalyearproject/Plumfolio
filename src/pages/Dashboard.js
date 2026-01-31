import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  ShoppingCart,
  Home,
  Car,
  Zap,
  GraduationCap,
  Coffee
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import './Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    balance: 0,
    income: 0,
    expenses: 0,
    savings: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch transactions
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);

      // Fetch budgets
      const { data: budgetsData } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id);

      if (transactionsData) {
        setTransactions(transactionsData);
        
        // Calculate stats from all transactions
        const { data: allTransactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id);

        if (allTransactions) {
          const income = allTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
          
          const expenses = allTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);

          setStats({
            balance: income - expenses,
            income,
            expenses,
            savings: income - expenses,
          });
        }
      }

      if (budgetsData) {
        setBudgets(budgetsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Demo data for when there's no real data
  const demoStats = {
    balance: 24567.89,
    income: 6325.50,
    expenses: 2209.21,
    savings: 4116.29,
  };

  const demoTransactions = [
    { id: 1, description: 'Salary Deposit', category: 'Income', type: 'income', amount: 5200, date: '2026-01-30' },
    { id: 2, description: 'Groceries', category: 'Food & Dining', type: 'expense', amount: 156.32, date: '2026-01-29' },
    { id: 3, description: 'Electric Bill', category: 'Utilities', type: 'expense', amount: 89.00, date: '2026-01-28' },
    { id: 4, description: 'Freelance Work', category: 'Income', type: 'income', amount: 750, date: '2026-01-27' },
    { id: 5, description: 'Coffee Shop', category: 'Food & Dining', type: 'expense', amount: 24.50, date: '2026-01-26' },
  ];

  const demoBudgets = [
    { category: 'Food & Dining', allocated: 500, spent: 240 },
    { category: 'Housing', allocated: 1200, spent: 1200 },
    { category: 'Transportation', allocated: 300, spent: 52 },
    { category: 'Utilities', allocated: 200, spent: 154 },
  ];

  const displayStats = transactions.length > 0 ? stats : demoStats;
  const displayTransactions = transactions.length > 0 ? transactions : demoTransactions;
  const displayBudgets = budgets.length > 0 ? budgets : demoBudgets;

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Dining': Coffee,
      'Housing': Home,
      'Transportation': Car,
      'Utilities': Zap,
      'Education': GraduationCap,
      'Income': Wallet,
      'Shopping': ShoppingCart,
    };
    return icons[category] || ShoppingCart;
  };

  const chartData = {
    labels: ['Housing', 'Food & Dining', 'Utilities', 'Education'],
    datasets: [{
      data: [45, 25, 15, 15],
      backgroundColor: [
        'rgba(157, 78, 221, 0.8)',
        'rgba(76, 175, 80, 0.8)',
        'rgba(255, 179, 0, 0.8)',
        'rgba(59, 130, 246, 0.8)',
      ],
      borderColor: [
        'rgba(157, 78, 221, 1)',
        'rgba(76, 175, 80, 1)',
        'rgba(255, 179, 0, 1)',
        'rgba(59, 130, 246, 1)',
      ],
      borderWidth: 2,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#A1A1AA',
          padding: 16,
          usePointStyle: true,
          font: {
            family: "'DM Sans', sans-serif",
            size: 12,
          },
        },
      },
    },
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-BW', {
      style: 'currency',
      currency: 'BWP',
      minimumFractionDigits: 2,
    }).format(amount).replace('BWP', 'P');
  };

  const getBudgetProgress = (spent, allocated) => {
    const percentage = (spent / allocated) * 100;
    return Math.min(percentage, 100);
  };

  const getBudgetColor = (spent, allocated) => {
    const percentage = (spent / allocated) * 100;
    if (percentage >= 100) return 'var(--error)';
    if (percentage >= 75) return 'var(--warning)';
    return 'var(--success)';
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="welcome-section">
        <h2>Welcome back, {userName}</h2>
        <p>Here's what's happening with your finances today.</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Balance</span>
            <div className="stat-icon balance">
              <Wallet size={20} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(displayStats.balance)}</div>
          <div className="stat-change positive">
            <ArrowUpRight size={14} />
            <span>12.5% from last month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Monthly Income</span>
            <div className="stat-icon income">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(displayStats.income)}</div>
          <div className="stat-change positive">
            <ArrowUpRight size={14} />
            <span>8.2% from last month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Monthly Expenses</span>
            <div className="stat-icon expenses">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(displayStats.expenses)}</div>
          <div className="stat-change negative">
            <ArrowDownRight size={14} />
            <span>3.1% from last month</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Monthly Savings</span>
            <div className="stat-icon savings">
              <Wallet size={20} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(displayStats.savings)}</div>
          <div className="stat-change positive">
            <ArrowUpRight size={14} />
            <span>15.7% from last month</span>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* Recent Transactions */}
        <div className="card transactions-card">
          <div className="card-header">
            <h3>Recent Transactions</h3>
            <a href="/transactions" className="view-all">View All</a>
          </div>
          <div className="transactions-list">
            {displayTransactions.map((transaction) => {
              const Icon = getCategoryIcon(transaction.category);
              return (
                <div key={transaction.id} className="transaction-item">
                  <div className="transaction-icon">
                    <Icon size={18} />
                  </div>
                  <div className="transaction-info">
                    <span className="transaction-desc">{transaction.description}</span>
                    <span className="transaction-category">{transaction.category}</span>
                  </div>
                  <span className={`transaction-amount ${transaction.type}`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="card chart-card">
          <div className="card-header">
            <h3>Expense Breakdown</h3>
          </div>
          <div className="chart-container">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Budget Overview */}
        <div className="card budget-card">
          <div className="card-header">
            <h3>Budget Overview</h3>
            <a href="/budgets" className="view-all">Manage</a>
          </div>
          <div className="budget-list">
            {displayBudgets.map((budget, index) => {
              const progress = getBudgetProgress(budget.spent, budget.allocated);
              const color = getBudgetColor(budget.spent, budget.allocated);
              return (
                <div key={index} className="budget-item">
                  <div className="budget-info">
                    <span className="budget-category">{budget.category}</span>
                    <span className="budget-amounts">
                      {formatCurrency(budget.spent)} / {formatCurrency(budget.allocated)}
                    </span>
                  </div>
                  <div className="budget-progress">
                    <div 
                      className="budget-bar" 
                      style={{ width: `${progress}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
