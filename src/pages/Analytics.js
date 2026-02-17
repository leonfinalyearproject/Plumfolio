import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, Calendar, BarChart3, Plus } from 'lucide-react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import './Analytics.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Analytics = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-BW', {
      style: 'currency',
      currency: 'BWP',
      minimumFractionDigits: 0,
    }).format(amount).replace('BWP', 'P');
  };

  // Get last 6 months dynamically
  const getLastSixMonths = () => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      });
    }
    return months;
  };

  const months = getLastSixMonths();

  // Process data for charts
  const monthlyData = months.map(({ label, key }) => {
    const monthTransactions = transactions.filter(t => t.date && t.date.startsWith(key));
    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    return { month: label, income, expenses, savings: income - expenses };
  });

  // Category breakdown
  const categoryTotals = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);
  
  // Calculate months with data for accurate average
  const monthsWithData = monthlyData.filter(m => m.income > 0 || m.expenses > 0).length;
  const avgMonthlyIncome = monthsWithData > 0 ? totalIncome / monthsWithData : 0;
  const avgMonthlyExpenses = monthsWithData > 0 ? totalExpenses / monthsWithData : 0;

  // Chart configs
  const lineChartData = {
    labels: months.map(m => m.label),
    datasets: [
      {
        label: 'Income',
        data: monthlyData.map(d => d.income),
        borderColor: 'rgba(76, 175, 80, 1)',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Expenses',
        data: monthlyData.map(d => d.expenses),
        borderColor: 'rgba(157, 78, 221, 1)',
        backgroundColor: 'rgba(157, 78, 221, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#A1A1AA',
          usePointStyle: true,
          font: { family: "'DM Sans', sans-serif" },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#71717A' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { 
          color: '#71717A',
          callback: (value) => 'P' + value.toLocaleString(),
        },
      },
    },
  };

  const doughnutData = {
    labels: sortedCategories.map(([cat]) => cat),
    datasets: [{
      data: sortedCategories.map(([, amount]) => amount),
      backgroundColor: [
        'rgba(157, 78, 221, 0.8)',
        'rgba(76, 175, 80, 0.8)',
        'rgba(255, 179, 0, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(239, 68, 68, 0.8)',
      ],
      borderWidth: 0,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#A1A1AA',
          padding: 16,
          usePointStyle: true,
          font: { family: "'DM Sans', sans-serif", size: 11 },
        },
      },
    },
  };

  const barChartData = {
    labels: months.map(m => m.label),
    datasets: [{
      label: 'Net Savings',
      data: monthlyData.map(d => d.savings),
      backgroundColor: monthlyData.map(d => 
        d.savings >= 0 ? 'rgba(76, 175, 80, 0.8)' : 'rgba(239, 68, 68, 0.8)'
      ),
      borderRadius: 6,
    }],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#71717A' },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { 
          color: '#71717A',
          callback: (value) => 'P' + value.toLocaleString(),
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="spinner" />
      </div>
    );
  }

  // Empty state if no transactions
  if (transactions.length === 0) {
    return (
      <div className="analytics-page">
        <div className="empty-state-container">
          <div className="empty-state">
            <BarChart3 size={64} strokeWidth={1} />
            <h3>No data to analyze yet</h3>
            <p>Start adding transactions to see your spending trends, category breakdowns, and savings patterns</p>
            <Link to="/transactions" className="empty-action-btn">
              <Plus size={18} />
              Add Your First Transaction
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      {/* Summary Stats */}
      <div className="analytics-summary">
        <div className="summary-stat">
          <div className="stat-icon income">
            <TrendingUp size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Avg. Monthly Income</span>
            <span className="stat-value">{formatCurrency(avgMonthlyIncome)}</span>
          </div>
        </div>
        <div className="summary-stat">
          <div className="stat-icon expense">
            <TrendingDown size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Avg. Monthly Expenses</span>
            <span className="stat-value">{formatCurrency(avgMonthlyExpenses)}</span>
          </div>
        </div>
        <div className="summary-stat">
          <div className="stat-icon period">
            <Calendar size={20} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Analysis Period</span>
            <span className="stat-value">Last 6 Months</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Income vs Expenses Trend */}
        <div className="chart-card wide">
          <h3>Income vs Expenses Trend</h3>
          <div className="chart-wrapper">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="chart-card">
          <h3>Expense Breakdown</h3>
          {sortedCategories.length > 0 ? (
            <div className="chart-wrapper doughnut">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          ) : (
            <div className="chart-empty">
              <p>No expenses recorded yet</p>
            </div>
          )}
        </div>

        {/* Monthly Savings */}
        <div className="chart-card">
          <h3>Monthly Net Savings</h3>
          <div className="chart-wrapper">
            <Bar data={barChartData} options={barChartOptions} />
          </div>
        </div>

        {/* Top Spending Categories */}
        <div className="chart-card">
          <h3>Top Spending Categories</h3>
          {sortedCategories.length > 0 ? (
            <div className="category-list">
              {sortedCategories.map(([category, amount], idx) => (
                <div key={category} className="category-item">
                  <div className="category-rank">{idx + 1}</div>
                  <div className="category-info">
                    <span className="category-name">{category}</span>
                    <div className="category-bar">
                      <div 
                        className="category-fill"
                        style={{ 
                          width: `${(amount / sortedCategories[0][1]) * 100}%`,
                          backgroundColor: ['#9D4EDD', '#4CAF50', '#FFB300', '#3B82F6', '#EF4444'][idx]
                        }}
                      />
                    </div>
                  </div>
                  <span className="category-amount">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="chart-empty">
              <p>No expense categories yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
