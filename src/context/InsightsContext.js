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
  const userIdRef = useRef(null);

  // Toast functions using refs to avoid dependency issues
  const addToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { ...toast, id, timestamp: Date.now() }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 8000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Main fetch + analyse function
  const fetchAndAnalyse = useCallback(async (passedUserId) => {
    if (!passedUserId) {
      setLoading(false);
      return;
    }

    try {
      const userId = passedUserId;

      const [txnRes, budgetRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false }),
        supabase
          .from('budgets')
          .select('*')
          .eq('user_id', userId),
      ]);

      const txns = txnRes.data || [];
      const budgs = budgetRes.data || [];

      setTransactions(txns);
      setBudgets(budgs);

      // Run AI engines
      const newInsights = generateInsights(txns);
      const newPredictions = generatePredictions(txns, budgs);

      // Detect new urgent insights for toasts
      const oldInsights = prevInsightsRef.current;
      if (oldInsights && oldInsights.insights) {
        const oldMessages = new Set(oldInsights.insights.map(i => i.message));
        newInsights.insights.forEach(insight => {
          if (!oldMessages.has(insight.message) && (insight.severity === 'high' || insight.severity === 'medium')) {
            const id = ++toastIdRef.current;
            setToasts(prev => [...prev, {
              id,
              timestamp: Date.now(),
              type: insight.severity === 'high' ? 'warning' : 'info',
              title: insight.type === 'anomaly' ? 'Unusual Transaction' :
                     insight.type === 'spending_increase' ? 'Spending Alert' :
                     insight.type === 'exceeded' ? 'Budget Exceeded' :
                     'AI Insight',
              message: insight.message,
              severity: insight.severity,
            }]);
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== id));
            }, 8000);
          }
        });
      }

      prevInsightsRef.current = newInsights;
      setInsights(newInsights);
      setPredictions(newPredictions);
    } catch (err) {
      console.error('InsightsContext fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual refresh
  const refreshInsights = useCallback(() => {
    if (userIdRef.current) {
      setLoading(true);
      fetchAndAnalyse(userIdRef.current);
    }
  }, [fetchAndAnalyse]);

  // Track user ID in ref
  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user]);

  // Initial load + re-load when user changes
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 10000);
    if (user?.id) {
      setLoading(true);
      fetchAndAnalyse(user.id);
    } else {
      setInsights(null);
      setPredictions(null);
      setTransactions([]);
      setBudgets([]);
      setLoading(false);
      prevInsightsRef.current = null;
    }
    return () => clearTimeout(t);
  }, [user?.id, fetchAndAnalyse]);

  // Real-time subscription + polling fallback
  useEffect(() => {
    if (!user?.id) return;

    const userId = user.id;

    // Poll every 30 seconds as fallback
    const pollInterval = setInterval(() => {
      fetchAndAnalyse(userId);
    }, 30000);

    // Try Supabase realtime
    let txnChannel;
    let budgetChannel;
    try {
      txnChannel = supabase
        .channel('insights-txn-' + userId.substring(0, 8))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
          () => fetchAndAnalyse(userId)
        )
        .subscribe();

      budgetChannel = supabase
        .channel('insights-bud-' + userId.substring(0, 8))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` },
          () => fetchAndAnalyse(userId)
        )
        .subscribe();
    } catch (err) {
      console.log('Realtime not available, using polling');
    }

    return () => {
      clearInterval(pollInterval);
      if (txnChannel) supabase.removeChannel(txnChannel);
      if (budgetChannel) supabase.removeChannel(budgetChannel);
    };
  }, [user?.id, fetchAndAnalyse]);

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
