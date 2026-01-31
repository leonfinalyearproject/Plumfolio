import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
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
  const [period, setPeriod] = useState('6months');

  useEffect(() => {
    fetchTransactions();
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

  // Demo data
  const demoTransactions = [
    { type: 'income', amount: 5200, category: 'Income', date: '2025-08-01' },
    { type: 'expense', amount: 1200, category: 'Housing', date: '2025-08-05' },
    { type: 'expense', amount: 450, category: 'Food & Dining', date: '2025-08-10' },
    { type: 'income', amount: 5200, category: 'Income', date: '2025-09-01' },
    { type: 'expense', amount: 1200, category: 'Housing', date: '2025-09-05' },
    { type: 'expense', amount: 380, category: 'Food & Dining', date: '2025-09-12' },
    { type: 'expense', amount: 200, category: 'Transportation', date: '2025-09-15' },
    { type: 'income', amount: 5700, category: 'Income', date: '2025-10-01' },
    { type: 'expense', amount: 1200, category: 'Housing', date: '2025-10-05' },
    { type: 'expense', amount: 520, category: 'Food & Dining', date: '2025-10-08' },
    { type: 'expense', amount: 150, category: 'Entertainment', date: '2025-10-20' },
    { type: 'income', amount: 5700, category: 'Income', date: '2025-11-01' },
    { type: 'income', amount: 800, category: 'Income', date: '2025-11-10' },
    { type: 'expense', amount: 1200, category: 'Housing', date: '2025-11-05' },
    { type: 'expense', amount: 480, category: 'Food & Dining', date: '2025-11-15' },
    { type: 'expense', amount: 300, category: 'Utilities', date: '2025-11-18' },
    { type: 'income', amount: 5700, category: 'Income', date: '2025-12-01' },
    { type: 'expense', amount: 1200, category: 'Housing', date: '2025-12-05' },
    { type: 'expense', amount: 650, category: 'Food & Dining', date: '2025-12-10' },
    { type: 'expense', amount: 400, category: 'Shopping', date: '2025-12-20' },
    { type: 'income', amount: 5700, category: 'Income', date: '2026-01-01' },
    { type: 'income', amount: 1750, category: 'Income', date: '2026-01-15' },
    { type: 'expense', amount: 1200, category: 'Housing', date: '2026-01-05' },
    { type: 'expense', amount: 720, category: 'Food & Dining', date: '2026-01-20' },
    { type: 'expense', amount: 350, category: 'Utilities', date: '2026-01-25' },
  ];

  const data = transactions.length > 0 ? transactions : demoTransactions;

  // Process data for charts
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  
  const monthlyData = months.map((month, idx) => {
    const monthNum = (8 + idx) % 12 || 12;
    const year = monthNum >= 8 ? 2025 : 2026;
    const monthStr = `${year}-${monthNum.toString().padStart(2, '0')}`;
    
    const monthTransactions = data.filter(t => t.date.startsWith(monthStr));
    const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    return { month, income, expenses, savings: income - expenses };
  });

  // Category breakdown
  const categoryTotals = data
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalIncome = data.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = data.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const avgMonthlyIncome = totalIncome / 6;
  const avgMonthlyExpenses = totalExpenses / 6;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-BW', {
      style: 'currency',
      currency: 'BWP',
      minimumFractionDigits: 0,
    }).format(amount).replace('BWP', 'P');
  };

  // Chart configs
  const lineChartData = {
    labels: months,
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
    labels: months,
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
          <div className="chart-wrapper doughnut">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
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
        </div>
      </div>
    </div>
  );
};

export default Analytics;
