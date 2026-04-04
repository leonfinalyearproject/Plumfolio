// src/components/AIInsightWidget.js
import React, { useState, useMemo } from 'react';
import { useInsights } from '../context/InsightsContext';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Brain, X, AlertTriangle, TrendingUp, TrendingDown,
  Lightbulb, ChevronUp, ChevronDown, ArrowRight,
  Target, Shield, Repeat, BarChart3, DollarSign,
  ArrowUpRight, ArrowDownRight, Receipt, Settings
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import './AIInsightWidget.css';

/**
 * Generate page-specific insights based on the current route
 * Each page gets its own analysis - the AI "mind" adapts to context
 */
function getPageInsights(pathname, insights, predictions) {
  if (!insights || !insights.insights) {
    return { title: 'AI Insights', icon: Brain, items: [], summary: '' };
  }

  const allInsights = insights.insights || [];
  const anomalies = insights.anomalies || [];
  const recurring = insights.recurring || [];
  const spendingPatterns = insights.spendingPatterns || [];
  const budgetWarnings = predictions?.budgetWarnings || [];
  const categoryForecasts = predictions?.categoryForecasts || {};
  const totalForecast = predictions?.totalForecast || {};
  const budgetSuggestions = predictions?.budgetSuggestions || [];

  // Normalise path
  const page = pathname.replace(/^\/Plumfolio/i, '').replace(/^\//, '') || 'dashboard';

  switch (page) {
    case 'dashboard': {
      // Dashboard: overall health, key alerts, savings rate, quick summary
      const items = [];

      // Savings rate insight
      const savingsInsight = allInsights.find(i => i.type === 'savings_rate');
      if (savingsInsight) items.push({ ...savingsInsight, context: 'Your overall financial health' });

      // Top spending category
      const topCat = allInsights.find(i => i.type === 'top_category');
      if (topCat) items.push({ ...topCat, context: 'Where your money goes' });

      // Any budget that's exceeded or close
      budgetWarnings.slice(0, 2).forEach(w => {
        items.push({
          type: w.type,
          severity: w.severity,
          message: w.message,
          context: 'Budget alert',
        });
      });

      // Next month prediction
      if (totalForecast.predicted > 0) {
        items.push({
          type: 'prediction',
          severity: 'info',
          message: `Predicted expenses for ${totalForecast.nextMonth || 'next month'}: P${totalForecast.predicted.toFixed(0)} (${totalForecast.confidence} confidence)`,
          context: 'Forecast',
        });
      }

      // Any high-severity alerts
      allInsights.filter(i => i.severity === 'high' && !items.find(x => x.message === i.message))
        .slice(0, 2)
        .forEach(i => items.push({ ...i, context: 'Requires attention' }));

      const urgentCount = items.filter(i => i.severity === 'high' || i.severity === 'medium').length;
      return {
        title: 'Dashboard Overview',
        icon: BarChart3,
        items: items.slice(0, 5),
        summary: urgentCount > 0
          ? `${urgentCount} alert${urgentCount > 1 ? 's' : ''} need your attention`
          : items.length > 0 ? 'Your financial overview looks good' : 'Add transactions to get insights',
      };
    }

    case 'transactions': {
      // Transactions: anomalies, spending patterns, recurring detection
      const items = [];

      // Anomalous transactions
      anomalies.slice(0, 3).forEach(a => {
        items.push({
          type: 'anomaly',
          severity: a.severity,
          message: a.message,
          context: 'Unusual transaction',
        });
      });

      // Spending increases per category
      spendingPatterns.filter(s => s.type === 'spending_increase').slice(0, 2).forEach(s => {
        items.push({
          ...s,
          context: `${s.category} trend`,
        });
      });

      // Spending decreases (positive)
      spendingPatterns.filter(s => s.type === 'spending_decrease').slice(0, 1).forEach(s => {
        items.push({
          ...s,
          context: `${s.category} trend`,
        });
      });

      // Recurring transactions
      if (recurring.length > 0) {
        items.push({
          type: 'recurring',
          severity: 'info',
          message: `${recurring.length} recurring transaction${recurring.length > 1 ? 's' : ''} detected: ${recurring.map(r => r.description).join(', ')}`,
          context: 'Pattern detected',
        });
      }

      return {
        title: 'Transaction Analysis',
        icon: ArrowUpRight,
        items: items.slice(0, 5),
        summary: anomalies.length > 0
          ? `${anomalies.length} unusual transaction${anomalies.length > 1 ? 's' : ''} flagged`
          : 'No anomalies detected — all transactions look normal',
      };
    }

    case 'budgets': {
      // Budgets: warnings, projected overspend, suggested allocations
      const items = [];

      // Budget warnings (exceeded, projected, approaching)
      budgetWarnings.forEach(w => {
        items.push({
          type: w.type,
          severity: w.severity,
          message: w.message,
          context: w.type === 'exceeded' ? 'Over budget' : w.type === 'projected_exceed' ? 'Projected overspend' : 'Getting close',
        });
      });

      // Suggested budget allocations
      budgetSuggestions.slice(0, 3).forEach(s => {
        items.push({
          type: 'suggestion',
          severity: 'info',
          message: s.message,
          context: 'AI suggestion',
        });
      });

      // Category trend info for budgeted categories
      Object.entries(categoryForecasts).slice(0, 2).forEach(([cat, pred]) => {
        if (pred.trend === 'increasing') {
          items.push({
            type: 'trend',
            severity: 'medium',
            message: `${cat} spending is trending upward — predicted P${pred.predicted.toFixed(0)} next month`,
            context: 'Spending trend',
          });
        }
      });

      const exceededCount = budgetWarnings.filter(w => w.type === 'exceeded').length;
      return {
        title: 'Budget Intelligence',
        icon: Target,
        items: items.slice(0, 5),
        summary: exceededCount > 0
          ? `${exceededCount} budget${exceededCount > 1 ? 's' : ''} exceeded!`
          : budgetWarnings.length > 0
          ? `${budgetWarnings.length} budget warning${budgetWarnings.length > 1 ? 's' : ''}`
          : 'All budgets on track',
      };
    }

    case 'analytics': {
      // Analytics: trends, forecasts, category breakdowns
      const items = [];

      // Total forecast
      if (totalForecast.predicted > 0) {
        items.push({
          type: 'forecast',
          severity: 'info',
          message: `Next month forecast: P${totalForecast.predicted.toFixed(0)} (${totalForecast.confidence} confidence, ${totalForecast.trend > 0 ? 'upward' : totalForecast.trend < 0 ? 'downward' : 'stable'} trend)`,
          context: 'Expense forecast',
        });
      }

      // Category trends
      Object.entries(categoryForecasts).forEach(([cat, pred]) => {
        if (pred.trend !== 'stable') {
          items.push({
            type: 'trend',
            severity: pred.trend === 'increasing' ? 'medium' : 'positive',
            message: `${cat}: ${pred.trend} trend — predicted P${pred.predicted.toFixed(0)} next month`,
            context: 'Category forecast',
          });
        }
      });

      // Savings rate
      const savingsInsight = allInsights.find(i => i.type === 'savings_rate');
      if (savingsInsight) items.push({ ...savingsInsight, context: 'Savings analysis' });

      // Top category
      const topCat = allInsights.find(i => i.type === 'top_category');
      if (topCat) items.push({ ...topCat, context: 'Top category' });

      return {
        title: 'Analytics Intelligence',
        icon: BarChart3,
        items: items.slice(0, 5),
        summary: totalForecast.predicted > 0
          ? `Predicted P${totalForecast.predicted.toFixed(0)} next month`
          : 'Add more data for forecasting',
      };
    }

    case 'receipt-scanner': {
      // Receipt scanner: recent scan tips, spending context
      const items = [];

      // Show recent spending context
      const topCat = allInsights.find(i => i.type === 'top_category');
      if (topCat) items.push({ ...topCat, context: 'Current spending' });

      // Budget warnings to be aware of when scanning
      budgetWarnings.filter(w => w.severity === 'high').slice(0, 2).forEach(w => {
        items.push({
          type: w.type,
          severity: w.severity,
          message: `Watch out: ${w.message}`,
          context: 'Budget alert',
        });
      });

      items.push({
        type: 'tip',
        severity: 'info',
        message: 'Tip: Use good lighting and keep the receipt flat for best OCR accuracy',
        context: 'Scanner tip',
      });

      return {
        title: 'Scanner Assistant',
        icon: Receipt,
        items: items.slice(0, 4),
        summary: 'Ready to scan — AI will auto-categorise your receipt',
      };
    }

    case 'settings': {
      return {
        title: 'Account Insights',
        icon: Settings,
        items: [{
          type: 'info',
          severity: 'info',
          message: `You have ${insights.insights.length} active insights and ${recurring.length} recurring transactions detected`,
          context: 'Account summary',
        }],
        summary: 'Your AI analysis is running in real-time',
      };
    }

    case 'insights': {
      // On the insights page itself, show a meta-summary
      return {
        title: 'Full Analysis',
        icon: Brain,
        items: [{
          type: 'info',
          severity: 'info',
          message: 'You\'re viewing the full AI analysis. All insights, predictions, and patterns are displayed on this page.',
          context: 'Current page',
        }],
        summary: `${allInsights.length} insights active`,
      };
    }

    default:
      return {
        title: 'AI Insights',
        icon: Brain,
        items: allInsights.slice(0, 3),
        summary: `${allInsights.length} insight${allInsights.length !== 1 ? 's' : ''} available`,
      };
  }
}

// === Toast Notifications ===
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
            <p className="ai-toast-message">{fmt(toast.message)}</p>
          </div>
          <button className="ai-toast-close" onClick={() => dismissToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

// === Floating Widget ===
const AIInsightWidget = () => {
  const { insights, predictions, loading } = useInsights();
  const [expanded, setExpanded] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Get page-specific insights
  const pageData = useMemo(() => {
    return getPageInsights(location.pathname, insights, predictions);
  }, [location.pathname, insights, predictions]);

  // Don't show widget on receipt scanner page
  const page = location.pathname.replace(/^\/Plumfolio/i, '').replace(/^\//, '') || 'dashboard';
  if (page === 'receipt-scanner') return <AIToasts />;

  if (loading && !insights) return <AIToasts />;
  if (!insights) return <AIToasts />;

  const PageIcon = pageData.icon;
  const hasUrgent = pageData.items.some(i => i.severity === 'high' || i.severity === 'medium');
  const hasPositive = pageData.items.some(i => i.severity === 'positive');

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return <AlertTriangle size={12} />;
      case 'medium': return <TrendingUp size={12} />;
      case 'positive': return <TrendingDown size={12} />;
      default: return <Lightbulb size={12} />;
    }
  };

  if (minimised) {
    return (
      <>
        <AIToasts />
        <button
          className={`ai-widget-fab ${hasUrgent ? 'fab-urgent' : ''}`}
          onClick={() => setMinimised(false)}
        >
          <Brain size={20} />
          {hasUrgent && <span className="fab-badge">{pageData.items.filter(i => i.severity === 'high' || i.severity === 'medium').length}</span>}
        </button>
      </>
    );
  }

  return (
    <>
      <AIToasts />
      <div className={`ai-widget ${expanded ? 'ai-widget-expanded' : ''}`}>
        {/* Header - shows page context */}
        <div className="ai-widget-header" onClick={() => setExpanded(!expanded)}>
          <div className="ai-widget-header-left">
            <div className={`ai-widget-dot ${hasUrgent ? 'dot-urgent' : hasPositive ? 'dot-positive' : 'dot-ok'}`} />
            <PageIcon size={15} />
            <span className="ai-widget-title">{pageData.title}</span>
            {!expanded && pageData.items.length > 0 && (
              <span className="ai-widget-count">{pageData.items.length}</span>
            )}
          </div>
          <div className="ai-widget-header-right">
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <button className="ai-widget-minimize" onClick={(e) => { e.stopPropagation(); setMinimised(true); }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Collapsed: one-line contextual summary */}
        {!expanded && (
          <div className="ai-widget-summary" onClick={() => setExpanded(true)}>
            <span className={hasUrgent ? 'summary-urgent' : hasPositive ? 'summary-positive' : 'summary-neutral'}>
              {hasUrgent ? <AlertTriangle size={12} /> : hasPositive ? <TrendingDown size={12} /> : <Lightbulb size={12} />}
              {pageData.summary}
            </span>
          </div>
        )}

        {/* Expanded: page-specific insights */}
        {expanded && (
          <div className="ai-widget-body">
            {/* Quick stats bar */}
            {predictions?.totalForecast?.predicted > 0 && (
              <div className="ai-widget-stats">
                <div className="widget-stat">
                  <Target size={12} />
                  <span>Next: <strong>{formatCurrency(predictions.totalForecast.predicted)}</strong></span>
                </div>
                <div className="widget-stat">
                  <Shield size={12} />
                  <span>Save: <strong>{insights.summary?.savingsRate || 0}%</strong></span>
                </div>
                {insights.recurring?.length > 0 && (
                  <div className="widget-stat">
                    <Repeat size={12} />
                    <span><strong>{insights.recurring.length}</strong> recurring</span>
                  </div>
                )}
              </div>
            )}

            {/* Page-specific insight cards */}
            <div className="ai-widget-insights">
              {pageData.items.length === 0 ? (
                <p className="ai-widget-empty">No specific insights for this page yet</p>
              ) : (
                pageData.items.map((item, i) => (
                  <div key={i} className={`widget-insight widget-insight-${item.severity || 'info'}`}>
                    <div className="widget-insight-icon">
                      {getSeverityIcon(item.severity)}
                    </div>
                    <div className="widget-insight-content">
                      {item.context && <span className="widget-insight-context">{item.context}</span>}
                      <p>{fmt(item.message)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Link to full insights page */}
            {location.pathname.indexOf('/insights') === -1 && (
              <button className="ai-widget-viewall" onClick={() => { navigate('/insights'); setExpanded(false); }}>
                View full AI analysis <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AIInsightWidget;
