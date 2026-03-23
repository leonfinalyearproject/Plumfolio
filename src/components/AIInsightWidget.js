// src/components/AIInsightWidget.js
import React, { useState } from 'react';
import { useInsights } from '../context/InsightsContext';
import { useNavigate } from 'react-router-dom';
import {
  Brain, X, AlertTriangle, TrendingUp, TrendingDown,
  Lightbulb, ChevronUp, ChevronDown, ArrowRight,
  Target, Shield, Repeat
} from 'lucide-react';
import './AIInsightWidget.css';

// === Toast Notifications (top-right, for urgent alerts) ===
export const AIToasts = () => {
  const { toasts, dismissToast } = useInsights();

  if (toasts.length === 0) return null;

  return (
    <div className="ai-toasts-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`ai-toast ai-toast-${toast.severity || toast.type}`}>
          <div className="ai-toast-icon">
            {toast.severity === 'high' ? <AlertTriangle size={16} /> : <Lightbulb size={16} />}
          </div>
          <div className="ai-toast-content">
            <span className="ai-toast-title">{toast.title}</span>
            <p className="ai-toast-message">{toast.message}</p>
          </div>
          <button className="ai-toast-close" onClick={() => dismissToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

// === Floating Widget (bottom-right corner) ===
const AIInsightWidget = () => {
  const { insights, predictions, loading } = useInsights();
  const [expanded, setExpanded] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const navigate = useNavigate();

  // Don't render if still loading or user not logged in
  if (loading && !insights) return <AIToasts />;
  if (!insights) return <AIToasts />;

  const urgentInsights = insights.insights ? insights.insights.filter(i => i.severity === 'high' || i.severity === 'medium') : [];
  const positiveInsights = insights.insights ? insights.insights.filter(i => i.severity === 'positive') : [];
  const topInsights = insights.insights ? insights.insights.slice(0, 3) : [];
  const totalCount = insights.insights ? insights.insights.length : 0;
  const hasUrgent = urgentInsights.length > 0;

  if (minimised) {
    return (
      <>
        <AIToasts />
        <button
          className={`ai-widget-fab ${hasUrgent ? 'fab-urgent' : ''}`}
          onClick={() => setMinimised(false)}
        >
          <Brain size={20} />
          {hasUrgent && <span className="fab-badge">{urgentInsights.length}</span>}
        </button>
      </>
    );
  }

  return (
    <>
      <AIToasts />
      <div className={`ai-widget ${expanded ? 'ai-widget-expanded' : ''}`}>
        {/* Header */}
        <div className="ai-widget-header" onClick={() => setExpanded(!expanded)}>
          <div className="ai-widget-header-left">
            <div className={`ai-widget-dot ${hasUrgent ? 'dot-urgent' : 'dot-ok'}`} />
            <Brain size={16} />
            <span className="ai-widget-title">AI Insights</span>
            {!expanded && topInsights.length > 0 && (
              <span className="ai-widget-count">{totalCount}</span>
            )}
          </div>
          <div className="ai-widget-header-right">
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <button className="ai-widget-minimize" onClick={(e) => { e.stopPropagation(); setMinimised(true); }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Collapsed: show one-line summary */}
        {!expanded && (
          <div className="ai-widget-summary" onClick={() => setExpanded(true)}>
            {hasUrgent ? (
              <span className="summary-urgent">
                <AlertTriangle size={12} />
                {urgentInsights.length} alert{urgentInsights.length > 1 ? 's' : ''} need attention
              </span>
            ) : positiveInsights.length > 0 ? (
              <span className="summary-positive">
                <TrendingDown size={12} />
                Your finances look healthy
              </span>
            ) : (
              <span className="summary-neutral">
                <Lightbulb size={12} />
                {totalCount} insight{totalCount !== 1 ? 's' : ''} available
              </span>
            )}
          </div>
        )}

        {/* Expanded: show insights list */}
        {expanded && (
          <div className="ai-widget-body">
            {/* Quick Stats */}
            <div className="ai-widget-stats">
              {predictions?.totalForecast?.predicted > 0 && (
                <div className="widget-stat">
                  <Target size={12} />
                  <span>Next month: <strong>P{predictions.totalForecast.predicted.toFixed(0)}</strong></span>
                </div>
              )}
              {insights.summary.savingsRate !== undefined && (
                <div className="widget-stat">
                  <Shield size={12} />
                  <span>Savings: <strong>{insights.summary.savingsRate}%</strong></span>
                </div>
              )}
              {insights.recurring?.length > 0 && (
                <div className="widget-stat">
                  <Repeat size={12} />
                  <span><strong>{insights.recurring.length}</strong> recurring</span>
                </div>
              )}
            </div>

            {/* Insights List */}
            <div className="ai-widget-insights">
              {topInsights.length === 0 ? (
                <p className="ai-widget-empty">Add more transactions to get AI insights</p>
              ) : (
                topInsights.map((insight, i) => (
                  <div key={i} className={`widget-insight widget-insight-${insight.severity}`}>
                    <div className="widget-insight-icon">
                      {insight.severity === 'high' ? <AlertTriangle size={12} /> :
                       insight.severity === 'medium' ? <TrendingUp size={12} /> :
                       insight.severity === 'positive' ? <TrendingDown size={12} /> :
                       <Lightbulb size={12} />}
                    </div>
                    <p>{insight.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* View All */}
            {totalCount > 3 && (
              <button className="ai-widget-viewall" onClick={() => { navigate('/insights'); setExpanded(false); }}>
                View all {totalCount} insights <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AIInsightWidget;
