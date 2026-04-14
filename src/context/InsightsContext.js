// src/context/InsightsContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { generateInsights } from '../utils/insightsEngine';
import { generatePredictions } from '../utils/predictionsEngine';
import { generateCrossReferenceSignals } from '../utils/crossRefEngine';

const InsightsContext = createContext();

export const useInsights = () => {
  const context = useContext(InsightsContext);
  if (!context) {
    return {
      insights: null,
      predictions: null,
      crossSignals: [],
      goals: [],
      toasts: [],
      loading: true,
      monthlyIncome: 0,
      currentMonthKey: '',
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
  const [goals, setGoals] = useState([]);
  const [insights, setInsights] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [crossSignals, setCrossSignals] = useState([]);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [currentMonthKey, setCurrentMonthKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const prevSignalIdsRef = useRef(new Set());
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
      // Get fresh auth token before querying
      const { data: { session: _s2 } } = await supabase.auth.getSession();
      const userId = _s2 ? _s2.user.id : passedUserId;
      console.log('[INSIGHTS] userId:', userId);

      const [txnRes, budgetRes, goalRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false }),
        supabase
          .from('budgets')
          .select('*')
          .eq('user_id', userId),
        supabase
          .from('savings_goals')
          .select('*')
          .eq('user_id', userId),
      ]);

      const txns = txnRes.data || [];
      const budgs = budgetRes.data || [];
      // Goals query may fail if migration hasn't been run — fall back to [] silently
      const gls = (goalRes && !goalRes.error && Array.isArray(goalRes.data))
        ? goalRes.data.map(g => ({ ...g, target: parseFloat(g.target), saved: parseFloat(g.saved) }))
        : [];

      setTransactions(txns);
      setBudgets(budgs);
      setGoals(gls);

      // Calculate current month's income from transactions
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setCurrentMonthKey(monthKey);
      
      const currentMonthIncome = txns
        .filter(t => {
          if (t.type !== 'income') return false;
          const txnMonth = t.date ? t.date.slice(0, 7) : null;
          return txnMonth === monthKey;
        })
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
      setMonthlyIncome(currentMonthIncome);

      // Run AI engines
      const newInsights = generateInsights(txns, gls);
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
                     insight.type === 'goal_overdue' ? 'Goal Overdue' :
                     insight.type === 'goal_deadline_urgent' ? 'Goal Deadline!' :
                     insight.type === 'goal_deadline_soon' ? 'Goal Deadline Approaching' :
                     insight.type === 'goal_behind_pace' ? 'Savings Pace Alert' :
                     insight.type === 'goal_completed' ? 'Goal Reached!' :
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

      // ---- Cross-reference compound signals ----
      const signals = generateCrossReferenceSignals(newInsights, newPredictions, { transactions: txns, budgets: budgs, goals: gls });
      setCrossSignals(signals);

      // Emit toasts for newly-surfaced compound signals (high/medium only)
      const prevIds = prevSignalIdsRef.current;
      const currentIds = new Set();
      signals.forEach(sig => {
        currentIds.add(sig.id);
        if (!prevIds.has(sig.id) && (sig.severity === 'high' || sig.severity === 'medium')) {
          const id = ++toastIdRef.current;
          setToasts(prev => [...prev, {
            id,
            timestamp: Date.now(),
            type: sig.severity === 'high' ? 'warning' : 'info',
            title: sig.title,
            message: sig.message,
            severity: sig.severity,
            crossRef: true,
          }]);
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
          }, 10000);
        }
      });
      prevSignalIdsRef.current = currentIds;
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
  }, [user?.id]);

  // Initial load + re-load when user changes
  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      fetchAndAnalyse(user.id);
    } else {
      setInsights(null);
      setPredictions(null);
      setTransactions([]);
      setBudgets([]);
      setCrossSignals([]);
      setLoading(false);
      prevInsightsRef.current = null;
      prevSignalIdsRef.current = new Set();
    }
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
    crossSignals,
    transactions,
    budgets,
    goals,
    toasts,
    loading,
    monthlyIncome,
    currentMonthKey,
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
