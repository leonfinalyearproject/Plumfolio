// src/pages/Insights.js
import React, { useState } from 'react';
import { useInsights } from '../context/InsightsContext';
import {
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
  ArrowUpRight, ArrowDownRight, Repeat, Lightbulb, Target,
  BarChart3, DollarSign, Shield, ChevronRight, PiggyBank
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import './Insights.css';

const Insights = () => {
  const { insights, predictions, loading, refreshInsights } = useInsights();
  const { formatCurrency, symbol } = useCurrency();

  // Replace currency placeholders emitted by the insights engine (¤123.45 → formatted)
  const fmt = (msg) => {
    if (!msg) return msg;
    return String(msg).replace(/¤(-?\d+(?:\.\d+)?)/g, (_, num) => {
      const parsed = parseFloat(num);
      if (isNaN(parsed)) return symbol + num;
      return formatCurrency(parsed);
    }).replace(/¤/g, symbol);
  };

  const [activeTab, setActiveTab] = useState('next-month');

  // Map internal confidence levels to plain language
  const confidenceLabel = (c) => ({
    high: 'Reliable estimate',
    medium: 'Rough estimate',
    low: 'Early estimate',
  }[c] || 'Estimate');

  const confidenceClass = (c) => ({
    high: 'confidence-high',
    medium: 'confidence-medium',
    low: 'confidence-low',
  }[c] || 'confidence-low');

  const severityIcon = (s) => {
    if (s === 'high') return <AlertTriangle size={18} />;
    if (s === 'medium') return <TrendingUp size={18} />;
    if (s === 'positive') return <TrendingDown size={18} />;
    return <Lightbulb size={18} />;
  };
  const severityClass = (s) => ({
    high: 'severity-high',
    medium: 'severity-medium',
    positive: 'severity-positive',
    info: 'severity-info',
  }[s] || 'severity-info');

  const tabs = [
    { id: 'next-month', label: 'Next Month',    icon: BarChart3  },
    { id: 'warnings',   label: 'Warnings',       icon: Shield     },
    { id: 'tips',       label: 'Spending Tips',  icon: Lightbulb  },
    { id: 'bills',      label: 'Regular Bills',  icon: Repeat     },
  ];

  if (loading) {
    return (
      <div className="insights-loading">
        <PiggyBank size={40} className="loading-icon" />
        <p>Analysing your finances...</p>
      </div>
    );
  }

  // Count warnings for the badge
  const warningCount = predictions?.budgetWarnings?.length || 0;

  return (
    <div className="insights-page">

      {/* Header */}
      <div className="insights-header">
        <div className="insights-header-left">
          <div>
            <h2>Forecasts</h2>
            <p>Based on your transaction history — what to expect next month</p>
          </div>
        </div>
        <button className="refresh-btn" onClick={refreshInsights}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary bar — 3 key numbers at a glance */}
      {insights && predictions && (
        <div className="insights-summary-cards">
          <div className="summary-card">
            <div className="summary-icon prediction-icon"><Target size={20} /></div>
            <div className="summary-content">
              <span className="summary-value">{formatCurrency(predictions.totalForecast.predicted || 0)}</span>
              <span className="summary-label">Predicted expenses next month</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon savings-icon"><DollarSign size={20} /></div>
            <div className="summary-content">
              <span className="summary-value">{insights.summary.savingsRate}%</span>
              <span className="summary-label">Savings rate this month</span>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon recurring-icon"><Repeat size={20} /></div>
            <div className="summary-content">
              <span className="summary-value">{insights.recurring?.length || 0}</span>
              <span className="summary-label">Regular bills detected</span>
            </div>
          </div>
          <div className="summary-card">
            <div className={`summary-icon ${warningCount > 0 ? 'warning-icon-sum' : 'ok-icon'}`}>
              <Shield size={20} />
            </div>
            <div className="summary-content">
              <span className="summary-value">{warningCount}</span>
              <span className="summary-label">{warningCount === 1 ? 'Budget warning' : 'Budget warnings'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="insights-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.id === 'warnings' && warningCount > 0 && (
              <span className="tab-badge">{warningCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="insights-content">

        {/* NEXT MONTH */}
        {activeTab === 'next-month' && predictions && (
          <div className="predictions-section">

            {/* Hero forecast card */}
            <div className="forecast-card main-forecast">
              <div className="forecast-header">
                <Target size={20} />
                <h3>Expected total spending</h3>
                <span className={`confidence-badge ${confidenceClass(predictions.totalForecast.confidence)}`}>
                  {confidenceLabel(predictions.totalForecast.confidence)}
                </span>
              </div>
              <div className="forecast-value">{formatCurrency(predictions.totalForecast.predicted || 0)}</div>
              <p className="forecast-detail">
                Predicted expenses for {predictions.totalForecast.nextMonth || 'next month'}
                {predictions.totalForecast.trend > 0 && ' — your spending is trending upward.'}
                {predictions.totalForecast.trend < 0 && ' — your spending is trending downward.'}
                {predictions.totalForecast.trend === 0 && ' — your spending looks stable.'}
              </p>
            </div>

            {/* Per-category breakdown */}
            {Object.keys(predictions.categoryForecasts).length > 0 && (
              <>
                <h3 className="section-title">Breakdown by category</h3>
                <div className="category-forecasts">
                  {Object.entries(predictions.categoryForecasts).map(([cat, pred]) => (
                    <div key={cat} className="category-forecast-card">
                      <div className="cat-forecast-header">
                        <span className="cat-name">{cat}</span>
                        <span className={`trend-badge trend-${pred.trend}`}>
                          {pred.trend === 'increasing' && <ArrowUpRight size={12} />}
                          {pred.trend === 'decreasing' && <ArrowDownRight size={12} />}
                          {pred.trend === 'increasing' ? 'Going up' : pred.trend === 'decreasing' ? 'Going down' : 'Stable'}
                        </span>
                      </div>
                      <div className="cat-forecast-value">{formatCurrency(pred.predicted)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Budget suggestions */}
            {predictions.budgetSuggestions.length > 0 && (
              <>
                <h3 className="section-title">Suggested budgets for next month</h3>
                <p className="section-subtitle">Based on your predicted spending, with a small buffer added.</p>
                <div className="budget-suggestions">
                  {predictions.budgetSuggestions.map((sug, i) => (
                    <div key={i} className="suggestion-card">
                      <div className="suggestion-header">
                        <span>{sug.category}</span>
                        <span className="suggested-amount">{formatCurrency(sug.suggestedAmount)}</span>
                      </div>
                      <p className="suggestion-detail">
                        You're likely to spend around {formatCurrency(sug.predictedSpend)} — this adds a 10% safety buffer.
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {Object.keys(predictions.categoryForecasts).length === 0 && predictions.budgetSuggestions.length === 0 && (
              <div className="empty-state">
                <BarChart3 size={48} />
                <h3>Not enough data yet</h3>
                <p>Keep adding transactions and forecasts will appear automatically after a few weeks.</p>
              </div>
            )}
          </div>
        )}

        {/* WARNINGS */}
        {activeTab === 'warnings' && predictions && (
          <div className="warnings-section">
            {predictions.budgetWarnings.length === 0 ? (
              <div className="empty-state">
                <Shield size={48} />
                <h3>All budgets look good</h3>
                <p>Nothing to worry about — keep it up!</p>
              </div>
            ) : (
              <div className="warnings-list">
                {predictions.budgetWarnings.map((warn, i) => (
                  <div key={i} className={`warning-card warning-${warn.severity}`}>
                    <div className="warning-icon"><AlertTriangle size={18} /></div>
                    <div className="warning-body">
                      <p className="warning-message">{fmt(warn.message)}</p>
                      <div className="warning-bar">
                        <div className="warning-bar-fill" style={{ width: `${Math.min(100, (warn.spent / warn.allocated) * 100)}%` }} />
                      </div>
                      <span className="warning-detail">
                        Spent {formatCurrency(warn.spent)} of {formatCurrency(warn.allocated)} budget
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SPENDING TIPS */}
        {activeTab === 'tips' && insights && (
          <div className="insights-list">
            {insights.insights.length === 0 ? (
              <div className="empty-state">
                <Lightbulb size={48} />
                <h3>No tips yet</h3>
                <p>Add more transactions and tips will appear based on your spending patterns.</p>
              </div>
            ) : (
              insights.insights.map((insight, i) => (
                <div key={i} className={`insight-card ${severityClass(insight.severity)}`}>
                  <div className="insight-icon">{severityIcon(insight.severity)}</div>
                  <div className="insight-body">
                    <p className="insight-message">{fmt(insight.message)}</p>
                    {insight.category && <span className="insight-tag">{insight.category}</span>}
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

        {/* REGULAR BILLS */}
        {activeTab === 'bills' && insights && (
          <div className="recurring-section">
            {(!insights.recurring || insights.recurring.length === 0) ? (
              <div className="empty-state">
                <Repeat size={48} />
                <h3>No regular bills detected yet</h3>
                <p>Recurring payments like subscriptions and rent will appear here once a pattern is spotted.</p>
              </div>
            ) : (
              <>
                <p className="section-subtitle" style={{ marginBottom: 16 }}>
                  These are payments that happen regularly based on your transaction history.
                </p>
                <div className="recurring-list">
                  {insights.recurring.map((rec, i) => (
                    <div key={i} className="recurring-card">
                      <div className="recurring-icon"><Repeat size={18} /></div>
                      <div className="recurring-body">
                        <h4>{rec.description}</h4>
                        <div className="recurring-meta">
                          <span className="recurring-freq">{rec.frequency}</span>
                          <span className="recurring-amount">{formatCurrency(rec.amount)}</span>
                          <span className="recurring-count">{rec.occurrences}× detected</span>
                          {rec.nextExpected && (
                            <span className="recurring-next">
                              Next: {new Date(rec.nextExpected).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default Insights;
