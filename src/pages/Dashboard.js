import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  ChevronRight
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
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);

      const { data: budgetsData } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id);

      if (transactionsData) {
        setTransactions(transactionsData);
        
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

  // Demo data
  const demoStats = {
    balance: 24567.89,
    income: 6325.50,
    expenses: 2209.21,
  };

  const demoTransactions = [
    { id: 1, description: 'Salary', category: 'Income', type: 'income', amount: 5200, date: '2026-01-30' },
    { id: 2, description: 'Groceries', category: 'Food', type: 'expense', amount: 156.32, date: '2026-01-29' },
    { id: 3, description: 'Electricity', category: 'Utilities', type: 'expense', amount: 89.00, date: '2026-01-28' },
    { id: 4, description: 'Freelance', category: 'Income', type: 'income', amount: 750, date: '2026-01-27' },
    { id: 5, description: 'Transport', category: 'Transport', type: 'expense', amount: 45.50, date: '2026-01-26' },
  ];

  const demoBudgets = [
    { category: 'Food', allocated: 500, spent: 240 },
    { category: 'Housing', allocated: 1200, spent: 1200 },
    { category: 'Transport', allocated: 300, spent: 52 },
  ];

  const displayStats = transactions.length > 0 ? stats : demoStats;
  const displayTransactions = transactions.length > 0 ? transactions : demoTransactions;
  const displayBudgets = budgets.length > 0 ? budgets : demoBudgets;

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

  const formatCurrency = (amount) => {
    return 'P' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const chartData = {
    labels: ['Housing', 'Food', 'Transport', 'Other'],
    datasets: [{
      data: [45, 25, 15, 15],
      backgroundColor: [
        '#7B2D8E',
        '#4CAF50',
        '#FFB300',
        '#3B82F6',
      ],
      borderWidth: 0,
      spacing: 2,
    }],
  };

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
        <h1>Hey, {userName}</h1>
        <p>Here's your financial overview</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card main">
          <div className="stat-top">
            <span className="stat-label">Balance</span>
            <Wallet size={20} />
          </div>
          <span className="stat-amount">{formatCurrency(displayStats.balance)}</span>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Income</span>
            <div className="stat-badge up">
              <ArrowUpRight size={14} />
            </div>
          </div>
          <span className="stat-amount">{formatCurrency(displayStats.income)}</span>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">Expenses</span>
            <div className="stat-badge down">
              <ArrowDownRight size={14} />
            </div>
          </div>
          <span className="stat-amount">{formatCurrency(displayStats.expenses)}</span>
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
          <div className="transactions-list">
            {displayTransactions.map((t) => {
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
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <div className="card-top">
            <h2>Spending</h2>
          </div>
          <div className="chart-area">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
          <div className="chart-legend">
            <div className="legend-item"><span style={{ background: '#7B2D8E' }} />Housing</div>
            <div className="legend-item"><span style={{ background: '#4CAF50' }} />Food</div>
            <div className="legend-item"><span style={{ background: '#FFB300' }} />Transport</div>
            <div className="legend-item"><span style={{ background: '#3B82F6' }} />Other</div>
          </div>
        </div>

        {/* Budgets */}
        <div className="card wide">
          <div className="card-top">
            <h2>Budgets</h2>
            <Link to="/budgets" className="card-link">
              Manage <ChevronRight size={16} />
            </Link>
          </div>
          <div className="budgets-list">
            {displayBudgets.map((b, i) => {
              const pct = Math.min((b.spent / b.allocated) * 100, 100);
              const over = pct >= 100;
              return (
                <div key={i} className="budget-row">
                  <div className="budget-info">
                    <span className="budget-name">{b.category}</span>
                    <span className="budget-nums">{formatCurrency(b.spent)} of {formatCurrency(b.allocated)}</span>
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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
