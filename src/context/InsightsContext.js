// src/context/InsightsContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { generateInsights } from '../utils/insightsEngine';
import { generatePredictions } from '../utils/predictionsEngine';

const InsightsContext = createContext();

export const useInsights = () => {
  const context = useContext(InsightsContext);
  if (!context) {
    return {
      insights: null,
      predictions: null,
      toasts: [],
      loading: true,
      refreshInsights: () => {},
      dismissToast: () => {},
    };
  }
  return context;
};

export const InsightsProvider = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [insights, setInsights] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevInsightsRef = useRef(null);
  const toastIdRef = useRef(0);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [txnRes, budgetRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
        supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id),
      ]);

      const txns = txnRes.data || [];
      const budgs = budgetRes.data || [];

      setTransactions(txns);
      setBudgets(budgs);

      // Run AI engines
      const newInsights = generateInsights(txns);
      const newPredictions = generatePredictions(txns, budgs);

      // Check for new urgent insights to show as toasts
      if (prevInsightsRef.current) {
        detectNewInsights(prevInsightsRef.current, newInsights);
      }

      prevInsightsRef.current = newInsights;
      setInsights(newInsights);
      setPredictions(newPredictions);
    } catch (err) {
      console.error('InsightsContext fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, detectNewInsights]);

  // Detect new insights that weren't there before and show as toasts
  const detectNewInsights = useCallback((oldInsights, newInsights) => {
    if (!oldInsights || !newInsights) return;

    const oldMessages = new Set(oldInsights.insights.map(i => i.message));

    newInsights.insights.forEach(insight => {
      if (!oldMessages.has(insight.message)) {
        // New insight detected - show toast if urgent
        if (insight.severity === 'high' || insight.severity === 'medium') {
          addToast({
            type: insight.severity === 'high' ? 'warning' : 'info',
            title: insight.type === 'anomaly' ? 'Unusual Transaction' :
                   insight.type === 'spending_increase' ? 'Spending Alert' :
                   insight.type === 'savings_rate' ? 'Savings Alert' :
                   insight.type === 'exceeded' ? 'Budget Exceeded' :
                   insight.type === 'projected_exceed' ? 'Budget Warning' :
                   'AI Insight',
            message: insight.message,
            severity: insight.severity,
          });
        }
      }
    });

    // Check for new budget warnings
    if (newInsights.summary && oldInsights.summary) {
      // New anomalies
      if (newInsights.anomalies.length > oldInsights.anomalies.length) {
        const newAnomaly = newInsights.anomalies[0];
        if (newAnomaly) {
          addToast({
            type: 'warning',
            title: 'Unusual Transaction Detected',
            message: newAnomaly.message,
            severity: 'high',
          });
        }
      }
    }
  }, []);

  // Add a toast notification
  const addToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { ...toast, id, timestamp: Date.now() }]);

    // Auto-dismiss after 8 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 8000);
  }, []);

  // Dismiss a specific toast
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Manual refresh
  const refreshInsights = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Initial load + re-load when user changes
  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setInsights(null);
      setPredictions(null);
      setTransactions([]);
      setBudgets([]);
      setLoading(false);
      prevInsightsRef.current = null;
    }
  }, [user, fetchData]);

  // Subscribe to real-time changes on transactions and budgets
  // Also poll every 30 seconds as fallback in case realtime isn't enabled
  useEffect(() => {
    if (!user) return;

    // Polling fallback - refresh every 30 seconds
    const pollInterval = setInterval(() => {
      fetchData();
    }, 30000);

    // Try Supabase realtime (requires realtime enabled on tables)
    let txnChannel;
    let budgetChannel;
    try {
      txnChannel = supabase
        .channel('insights-transactions')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchData()
        )
        .subscribe();

      budgetChannel = supabase
        .channel('insights-budgets')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'budgets',
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchData()
        )
        .subscribe();
    } catch (err) {
      console.log('Realtime not available, using polling only');
    }

    return () => {
      clearInterval(pollInterval);
      if (txnChannel) supabase.removeChannel(txnChannel);
      if (budgetChannel) supabase.removeChannel(budgetChannel);
    };
  }, [user, fetchData]);

  const value = {
    insights,
    predictions,
    transactions,
    budgets,
    toasts,
    loading,
    refreshInsights,
    dismissToast,
    addToast,
  };

  return (
    <InsightsContext.Provider value={value}>
      {children}
    </InsightsContext.Provider>
  );
};

export default InsightsContext;
