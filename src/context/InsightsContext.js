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
      typicalMonthlyIncome: 0,
      incomeBreakdown: { last3Months: [], monthsUsed: 0, confidence: 'low' },
      cashOnHand: 0,
      totalIncomeReceived: 0,
      totalExpensesPaid: 0,
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
  const [typicalMonthlyIncome, setTypicalMonthlyIncome] = useState(0);
  const [incomeBreakdown, setIncomeBreakdown] = useState({ last3Months: [], monthsUsed: 0, confidence: 'low' });
  // Cash on hand = all-time income received − all-time expenses paid.
  // This is the real money available to budget against (per supervisor
  // feedback: budget with what you actually have, not estimates).
  const [cashOnHand, setCashOnHand] = useState(0);
  const [totalIncomeReceived, setTotalIncomeReceived] = useState(0);
  const [totalExpensesPaid, setTotalExpensesPaid] = useState(0);
  const [currentMonthKey, setCurrentMonthKey] = useState(() => {
    // UTC to match transaction dates (stored via toISOString) and other pages.
    return new Date().toISOString().slice(0, 7);
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

      // --- Income calculations (separated for clarity) ---
      // Three different concepts the UI consumes:
      //   1. currentMonthIncome   — what you've earned THIS month so far (partial)
      //   2. typicalMonthlyIncome — average of your last 3 COMPLETE months
      //                             (stable anchor for forward-looking budgets)
      //   3. incomeBreakdown      — the 3 months that went into the average,
      //                             so we can show the user where the number came from
      const now = new Date();
      const monthKey = now.toISOString().slice(0, 7);
      setCurrentMonthKey(monthKey);

      const sumIncomeForMonth = (key) => txns
        .filter(t => t.type === 'income' && (t.date || '').slice(0, 7) === key)
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const currentMonthIncome = sumIncomeForMonth(monthKey);
      setMonthlyIncome(currentMonthIncome);

      // --- Available funds: the ACTUAL money in the pot ---
      // Principle (per supervisor feedback): budgets must be anchored to money
      // already received, not to estimates/averages/forecasts.
      //
      // availableFunds = all-time income received − all-time expenses − budgets
      //                  allocated to OTHER months (those funds are earmarked).
      //
      // The "budgets for other months" subtraction is done lazily per-caller
      // because it depends on which month they're currently editing. Here we
      // publish the two base numbers and let consumers subtract as needed.
      const totalIncomeReceived = txns
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      const totalExpensesPaid = txns
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      const cashOnHand = totalIncomeReceived - totalExpensesPaid;
      setCashOnHand(cashOnHand);
      setTotalIncomeReceived(totalIncomeReceived);
      setTotalExpensesPaid(totalExpensesPaid);

      // --- Typical monthly income (reference only — NOT a budget ceiling) ---
      // We still compute this for display (Dashboard/Analytics "avg income"
      // labels) but it must never gate budget creation. Keep it informational.
      const last3Months = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const k = d.toISOString().slice(0, 7);
        const income = sumIncomeForMonth(k);
        last3Months.push({ monthKey: k, income });
      }
      const monthsWithIncome = last3Months.filter(m => m.income > 0);
      const typicalMonthlyIncome = monthsWithIncome.length > 0
        ? monthsWithIncome.reduce((s, m) => s + m.income, 0) / monthsWithIncome.length
        : currentMonthIncome;
      setTypicalMonthlyIncome(typicalMonthlyIncome);
      setIncomeBreakdown({
        last3Months,
        monthsUsed: monthsWithIncome.length,
        confidence: monthsWithIncome.length >= 3 ? 'high' : monthsWithIncome.length >= 1 ? 'medium' : 'low',
      });

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
                     insight.type === 'backdated_recent' ? 'Past-Month Transaction Added' :
                     'Forecast Insight',
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
    typicalMonthlyIncome,
    incomeBreakdown,
    cashOnHand,
    totalIncomeReceived,
    totalExpensesPaid,
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
