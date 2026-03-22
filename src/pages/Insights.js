// src/pages/Insights.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateInsights } from '../utils/insightsEngine';
import { generatePredictions } from '../utils/predictionsEngine';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
  ArrowUpRight, ArrowDownRight, Repeat, Lightbulb, Target,
  BarChart3, DollarSign, Calendar, Shield, ChevronRight
} from 'lucide-react';
import './Insights.css';

const Insights = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [insights, setInsights] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('insights');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: txnData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id);

      const txns = txnData || [];
      const budgs = budgetData || [];
      
      setTransactions(txns);
      setBudgets(budgs);
      setInsights(generateInsights(txns));
      setPredictions(generatePredictions(txns, budgs));
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return <AlertTriangle size={18} />;
      case 'medium': return <TrendingUp size={18} />;
      case 'positive': return <TrendingDown size={18} />;
      default: return <Lightbulb size={18} />;
    }
  };

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'high': return 'severity-high';
      case 'medium': return 'severity-medium';
      case 'positive': return 'severity-positive';
      default: return 'severity-info';
    }
  };

  const getConfidenceClass = (confidence) => {
    switch (confidence) {
      case 'high': return 'confidence-high';
      case 'medium': return 'confidence-medium';
      default: return 'confidence-low';
    }
  };

  if (loading) {
    return (
      <div className="insights-loading">
        <Brain size={40} className="loading-icon" />
        <p>Analysing your financial data...</p>
      </div>
    );
  }

  return (
    <div className="insights-page">
      {/* Header */}
      <div className="insights-header">
        <div className="insights-header-left">
          <Brain size={24} />
          <div>
            <h2>AI Insights & Predictions</h2>
            <p>Powered by spending pattern analysis and statistical forecasting</p>
          </div>
        </div>
        <button className="refresh-btn" onClick={fetchData}>
          <RefreshCw size={16} />
          Refresh Analysis
        </button>
      </div>

      {/* Summary Cards */}
      {insights && predictions && (
        <div className="insights-summary-cards">
          <div className="summary-card">
            <div className="summary-icon insights-icon">
              <Lightbulb size={20} />
            </div>
            <div className="summary-content">
              <span className="summary-value">{insights.summary.totalInsights}</span>
              <span className="summary-label">Active Insights</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon prediction-icon">
              <Target size={20} />
            </div>
            <div className="summary-content">
              <span className="summary-value">
                P{predictions.totalForecast.predicted?.toFixed(0) || '0'}
              </span>
              <span className="summary-label">Predicted Next Month</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon savings-icon">
              <DollarSign size={20} />
            </div>
            <div className="summary-content">
              <span className="summary-value">{insights.summary.savingsRate}%</span>
              <span className="summary-label">Savings Rate</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon recurring-icon">
              <Repeat size={20} />
            </div>
            <div className="summary-content">
              <span className="summary-value">{insights.recurring?.length || 0}</span>
              <span className="summary-label">Recurring Detected</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="insights-tabs">
        <button
          className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          <Lightbulb size={16} />
          Spending Insights
        </button>
        <button
          className={`tab-btn ${activeTab === 'predictions' ? 'active' : ''}`}
          onClick={() => setActiveTab('predictions')}
        >
          <BarChart3 size={16} />
          Predictions
        </button>
        <button
          className={`tab-btn ${activeTab === 'recurring' ? 'active' : ''}`}
          onClick={() => setActiveTab('recurring')}
        >
          <Repeat size={16} />
          Recurring
        </button>
        <button
          className={`tab-btn ${activeTab === 'warnings' ? 'active' : ''}`}
          onClick={() => setActiveTab('warnings')}
        >
          <Shield size={16} />
          Budget Warnings
        </button>
      </div>

      {/* Tab Content */}
      <div className="insights-content">
        {/* INSIGHTS TAB */}
        {activeTab === 'insights' && insights && (
          <div className="insights-list">
            {insights.insights.length === 0 ? (
              <div className="empty-state">
                <Lightbulb size={48} />
                <h3>No insights yet</h3>
                <p>Add more transactions to start receiving AI-powered spending insights.</p>
              </div>
            ) : (
              insights.insights.map((insight, i) => (
                <div key={i} className={`insight-card ${getSeverityClass(insight.severity)}`}>
                  <div className="insight-icon">
                    {getSeverityIcon(insight.severity)}
                  </div>
                  <div className="insight-body">
                    <p className="insight-message">{insight.message}</p>
                    {insight.category && (
                      <span className="insight-tag">{insight.category}</span>
                    )}
                    {insight.percentChange && (
                      <span className={`insight-badge ${insight.percentChange > 0 ? 'badge-up' : 'badge-down'}`}>
                        {insight.percentChange > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(insight.percentChange)}%
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PREDICTIONS TAB */}
        {activeTab === 'predictions' && predictions && (
          <div className="predictions-section">
            {/* Total Forecast */}
            <div className="forecast-card main-forecast">
              <div className="forecast-header">
                <Target size={20} />
                <h3>Total Expense Forecast</h3>
                <span className={`confidence-badge ${getConfidenceClass(predictions.totalForecast.confidence)}`}>
                  {predictions.totalForecast.confidence} confidence
                </span>
              </div>
              <div className="forecast-value">
                P{predictions.totalForecast.predicted?.toFixed(2) || '0.00'}
              </div>
              <p className="forecast-detail">
                Predicted expenses for {predictions.totalForecast.nextMonth || 'next month'}
              </p>
              {predictions.totalForecast.trend !== undefined && (
                <p className="forecast-method">
                  Method: Weighted Moving Average with Trend Analysis
                  {predictions.totalForecast.trend > 0 ? ' (upward trend)' : predictions.totalForecast.trend < 0 ? ' (downward trend)' : ' (stable)'}
                </p>
              )}
            </div>

            {/* Category Forecasts */}
            <h3 className="section-title">Predicted Spending by Category</h3>
            <div className="category-forecasts">
              {Object.entries(predictions.categoryForecasts).map(([cat, pred]) => (
                <div key={cat} className="category-forecast-card">
                  <div className="cat-forecast-header">
                    <span className="cat-name">{cat}</span>
                    <span className={`trend-badge trend-${pred.trend}`}>
                      {pred.trend === 'increasing' && <ArrowUpRight size={12} />}
                      {pred.trend === 'decreasing' && <ArrowDownRight size={12} />}
                      {pred.trend}
                    </span>
                  </div>
                  <div className="cat-forecast-value">
                    P{pred.predicted.toFixed(2)}
                  </div>
                  <span className={`confidence-badge small ${getConfidenceClass(pred.confidence)}`}>
                    {pred.confidence}
                  </span>
                </div>
              ))}
            </div>

            {/* Suggested Budgets */}
            {predictions.budgetSuggestions.length > 0 && (
              <>
                <h3 className="section-title">Suggested Budget Allocations</h3>
                <div className="budget-suggestions">
                  {predictions.budgetSuggestions.map((sug, i) => (
                    <div key={i} className="suggestion-card">
                      <div className="suggestion-header">
                        <span>{sug.category}</span>
                        <span className="suggested-amount">P{sug.suggestedAmount.toFixed(2)}</span>
                      </div>
                      <p className="suggestion-detail">
                        Based on predicted spend of P{sug.predictedSpend.toFixed(2)} + 10% buffer (P{sug.buffer})
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* RECURRING TAB */}
        {activeTab === 'recurring' && insights && (
          <div className="recurring-section">
            {(!insights.recurring || insights.recurring.length === 0) ? (
              <div className="empty-state">
                <Repeat size={48} />
                <h3>No recurring transactions detected</h3>
                <p>Recurring patterns will be identified as you add more transactions over time.</p>
              </div>
            ) : (
              <div className="recurring-list">
                {insights.recurring.map((rec, i) => (
                  <div key={i} className="recurring-card">
                    <div className="recurring-icon">
                      <Repeat size={18} />
                    </div>
                    <div className="recurring-body">
                      <h4>{rec.description}</h4>
                      <p>{rec.message}</p>
                      <div className="recurring-meta">
                        <span className="recurring-freq">{rec.frequency}</span>
                        <span className="recurring-amount">P{rec.amount.toFixed(2)}</span>
                        <span className="recurring-count">{rec.occurrences} occurrences</span>
                        {rec.nextExpected && (
                          <span className="recurring-next">
                            <Calendar size={12} />
                            Next: {new Date(rec.nextExpected).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* WARNINGS TAB */}
        {activeTab === 'warnings' && predictions && (
          <div className="warnings-section">
            {predictions.budgetWarnings.length === 0 ? (
              <div className="empty-state">
                <Shield size={48} />
                <h3>No budget warnings</h3>
                <p>All budgets are on track. Keep up the good work!</p>
              </div>
            ) : (
              <div className="warnings-list">
                {predictions.budgetWarnings.map((warn, i) => (
                  <div key={i} className={`warning-card warning-${warn.severity}`}>
                    <div className="warning-icon">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="warning-body">
                      <p className="warning-message">{warn.message}</p>
                      <div className="warning-bar">
                        <div
                          className="warning-bar-fill"
                          style={{ width: `${Math.min(100, (warn.spent / warn.allocated) * 100)}%` }}
                        />
                      </div>
                      <span className="warning-detail">
                        P{warn.spent.toFixed(2)} / P{warn.allocated.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Insights;
