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
  PiggyBank
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import './Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = () => {
  const { formatCurrency, symbol } = useCurrency();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    balance: 0,
    income: 0,
    expenses: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [expensesByCategory, setExpensesByCategory] = useState({});
  const [loading, setLoading] = useState(true);

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 6000);
    if (user) {
      fetchData().catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => clearTimeout(t);
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch recent transactions
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);

      // Fetch all transactions for stats
      const { data: allTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);

      // Fetch budgets
      const { data: budgetsData } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id);

      // Calculate stats
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

      // Calculate spent per category for budgets
      const spentByCategory = (allTransactions || [])
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
          return acc;
        }, {});

      const budgetsWithSpent = (budgetsData || []).map(b => ({
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
      'Housing': Home,
      'Transport': Car,
      'Transportation': Car,
      'Utilities': Zap,
      'Shopping': ShoppingBag,
      'Income': Wallet,
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
            <span className="stat-label">Balance</span>
            <Wallet size={20} />
          </div>
          <span className="stat-amount">{formatCurrency(stats.balance)}</span>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Income</span>
            <div className="stat-badge up">
              <ArrowUpRight size={14} />
            </div>
          </div>
          <span className="stat-amount">{formatCurrency(stats.income)}</span>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Expenses</span>
            <div className="stat-badge down">
              <ArrowDownRight size={14} />
            </div>
          </div>
          <span className="stat-amount">{formatCurrency(stats.expenses)}</span>
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
          
          {budgets.length > 0 ? (
            <div className="budgets-list">
              {budgets.map((b) => {
                const pct = Math.min((b.spent / b.allocated) * 100, 100);
                const over = b.spent > b.allocated;
                return (
                  <div key={b.id} className="budget-row">
                    <div className="budget-info">
                      <span className="budget-name">{b.category}</span>
                      <span className="budget-nums">
                        {formatCurrency(b.spent)} of {formatCurrency(parseFloat(b.allocated))}
                      </span>
                    </div>
                    <div className="budget-bar">
                      <div 
                        className={`budget-fill ${over ? 'over' : ''}`} 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
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
      </div>
    </div>
  );
};

export default Dashboard;
