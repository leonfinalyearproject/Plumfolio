// src/context/InsightsContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { generateInsights } from '../utils/insightsEngine';
import { generatePredictions } from '../utils/predictionsEngine';
import { generateCrossReferenceSignals } from '../utils/crossRefEngine';

const InsightsContext = createContext();

const INSIGHT_TOAST_TITLES = {
  anomaly: 'Unusual Transaction',
  spending_increase: 'Spending Alert',
  exceeded: 'Budget Exceeded',
  goal_overdue: 'Goal Overdue',
  goal_deadline_urgent: 'Goal Deadline',
  goal_deadline_soon: 'Goal Deadline Approaching',
  goal_behind_pace: 'Savings Pace Alert',
  goal_completed: 'Goal Reached',
  backdated_recent: 'Past-Month Entry Added',
};

export const useInsights = () => {
  const context = useContext(InsightsContext);
  if (!context) {
    return {
      insights: null,
      predictions: null,
      crossSignals: [],
      goals: [],
      transactions: [],
      budgets: [],
      toasts: [],
      loading: true,
      syncing: false,
      isLive: false,
      dataVersion: 0,
      lastSyncedAt: null,
      monthlyIncome: 0,
      typicalMonthlyIncome: 0,
      incomeBreakdown: { last3Months: [], monthsUsed: 0, confidence: 'low' },
      cashOnHand: 0,
      totalIncomeReceived: 0,
      totalExpensesPaid: 0,
      currentMonthKey: '',
      refreshInsights: () => {},
      dismissToast: () => {},
      addToast: () => {},
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
  const [cashOnHand, setCashOnHand] = useState(0);
  const [totalIncomeReceived, setTotalIncomeReceived] = useState(0);
  const [totalExpensesPaid, setTotalExpensesPaid] = useState(0);
  const [currentMonthKey, setCurrentMonthKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [dataVersion, setDataVersion] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const prevSignalIdsRef = useRef(new Set());
  const seenToastKeysRef = useRef(new Set());
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const prevInsightsRef = useRef(null);
  const toastIdRef = useRef(0);
  const userIdRef = useRef(null);
  const addToastRef = useRef(null);
  const fetchInFlightRef = useRef(false);

  const addToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    const signature = `${toast.title || ''}::${toast.message || ''}`;
    setToasts(prev => {
      if (prev.some(t => `${t.title || ''}::${t.message || ''}` === signature)) {
        return prev;
      }
      const next = [...prev, { ...toast, id, timestamp: Date.now() }];
      return next.length > 2 ? next.slice(next.length - 2) : next;
    });
    const duration = toast.duration || 8000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  addToastRef.current = addToast;

  const queueAutoToast = useCallback((toast) => {
    const key = `${toast.title || ''}::${toast.message || ''}`;
    if (seenToastKeysRef.current.has(key)) return;
    seenToastKeysRef.current.add(key);
    addToastRef.current?.(toast);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fetchAndAnalyse = useCallback(async (passedUserId, { silent = false } = {}) => {
    if (!passedUserId) {
      setLoading(false);
      return;
    }
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    if (!silent) setLoading(true);
    setSyncing(true);

    try {
      const { data: { session: _s2 } } = await supabase.auth.getSession();
      const userId = _s2 ? _s2.user.id : passedUserId;

      const [txnRes, budgetRes, goalRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('budgets').select('*').eq('user_id', userId),
        supabase.from('savings_goals').select('*').eq('user_id', userId),
      ]);

      const txns = txnRes.data || [];
      const budgs = budgetRes.data || [];
      const rawGls = (goalRes && !goalRes.error && Array.isArray(goalRes.data)) ? goalRes.data : [];
      const contribsByGoal = txns
        .filter(t => t.goal_id)
        .reduce((acc, t) => {
          const signed = t.type === 'expense' ? parseFloat(t.amount || 0) : -parseFloat(t.amount || 0);
          acc[t.goal_id] = (acc[t.goal_id] || 0) + signed;
          return acc;
        }, {});
      const gls = rawGls.map(g => {
        const baseline = parseFloat(g.saved || 0);
        const contribs = contribsByGoal[g.id] || 0;
        return { ...g, target: parseFloat(g.target), savedBaseline: baseline, saved: baseline + contribs };
      });

      setTransactions(txns);
      setBudgets(budgs);
      setGoals(gls);
      setDataVersion(v => v + 1);
      setLastSyncedAt(Date.now());

      const now = new Date();
      const monthKey = now.toISOString().slice(0, 7);
      setCurrentMonthKey(monthKey);

      const sumIncomeForMonth = (key) => txns
        .filter(t => t.type === 'income' && (t.date || '').slice(0, 7) === key)
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const currentMonthIncome = sumIncomeForMonth(monthKey);
      setMonthlyIncome(currentMonthIncome);

      const totalIncomeReceived = txns
        .filter(t => t.type === 'income')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      const totalExpensesPaid = txns
        .filter(t => t.type === 'expense')
        .reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      setCashOnHand(totalIncomeReceived - totalExpensesPaid);
      setTotalIncomeReceived(totalIncomeReceived);
      setTotalExpensesPaid(totalExpensesPaid);

      const last3Months = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const k = d.toISOString().slice(0, 7);
        last3Months.push({ monthKey: k, income: sumIncomeForMonth(k) });
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

      const newInsights = generateInsights(txns, gls);
      const newPredictions = generatePredictions(txns, budgs);

      const oldInsights = prevInsightsRef.current;
      if (oldInsights?.insights) {
        const oldMessages = new Set(oldInsights.insights.map(i => i.message));
        newInsights.insights.forEach(insight => {
          if (oldMessages.has(insight.message)) return;
          if (insight.severity !== 'high') return;
          queueAutoToast({
            type: 'warning',
            title: INSIGHT_TOAST_TITLES[insight.type] || 'Financial Alert',
            message: insight.message,
            severity: insight.severity,
          });
        });
      }

      prevInsightsRef.current = newInsights;
      setInsights(newInsights);
      setPredictions(newPredictions);

      const signals = generateCrossReferenceSignals(newInsights, newPredictions, { transactions: txns, budgets: budgs, goals: gls });
      setCrossSignals(signals);

      const prevIds = prevSignalIdsRef.current;
      const currentIds = new Set();
      signals.forEach(sig => {
        currentIds.add(sig.id);
        if (prevIds.has(sig.id)) return;
        if (sig.severity !== 'high') return;
        queueAutoToast({
          type: 'warning',
          title: sig.title,
          message: sig.message,
          severity: sig.severity,
          crossRef: true,
        });
      });
      prevSignalIdsRef.current = currentIds;
    } catch (err) {
      console.error('InsightsContext fetch error:', err);
    } finally {
      fetchInFlightRef.current = false;
      setSyncing(false);
      setLoading(false);
    }
  }, [queueAutoToast]);

  const refreshInsights = useCallback(() => {
    if (userIdRef.current) {
      fetchAndAnalyse(userIdRef.current, { silent: false });
    }
  }, [fetchAndAnalyse]);

  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchAndAnalyse(user.id, { silent: false });
    } else {
      setInsights(null);
      setPredictions(null);
      setTransactions([]);
      setBudgets([]);
      setGoals([]);
      setCrossSignals([]);
      setIsLive(false);
      setDataVersion(0);
      setLastSyncedAt(null);
      setLoading(false);
      prevInsightsRef.current = null;
      prevSignalIdsRef.current = new Set();
      seenToastKeysRef.current = new Set();
    }
  }, [user?.id, fetchAndAnalyse]);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const pollInterval = setInterval(() => {
      fetchAndAnalyse(userId, { silent: true });
    }, 120000);

    const channel = supabase.channel('plumfolio-sync-' + userId.substring(0, 8));

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` },
        () => fetchAndAnalyse(userId, { silent: true })
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` },
        () => fetchAndAnalyse(userId, { silent: true })
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals', filter: `user_id=eq.${userId}` },
        () => fetchAndAnalyse(userId, { silent: true })
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      setIsLive(false);
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
    syncing,
    isLive,
    dataVersion,
    lastSyncedAt,
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
