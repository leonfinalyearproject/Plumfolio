import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { useInsights } from '../context/InsightsContext';
import { parseReceiptText, detectCategory as receiptDetectCategory } from '../utils/receiptParser';
import { parseReceiptStrict } from '../utils/receiptParserStrict';
import processReceiptImage from '../utils/imageProcessor';
import { validateTransactionForm } from '../utils/validation';
import { parseImportRows, SAMPLE_TEMPLATE_ROWS, buildHistoryIndex, setReceiptDetectCategory, setCommunityMap } from '../utils/importParser';
import { findDuplicates, describeMatch } from '../utils/duplicateCheck';

setReceiptDetectCategory(receiptDetectCategory);

import {
  Plus, Filter, Download, Upload, X, ArrowUpCircle, ArrowDownCircle,
  Coffee, Home, Car, Zap, GraduationCap, ShoppingCart, Wallet,
  Heart, Film, MoreHorizontal, Trash2, Edit, Receipt, Camera, FileText,
  Check, Loader, AlertCircle, Image, ScanLine, Calendar, DollarSign,
  Star, ChevronDown, ChevronRight, Search, RefreshCw, TrendingUp, TrendingDown, Sparkles, PiggyBank
} from 'lucide-react';
import MonthPicker from '../components/MonthPicker';
import './Transactions.css';

const Transactions = () => {
  const { user } = useAuth();
  const { formatCurrency, symbol, currencyCode, convertToBwp } = useCurrency();
  const { addToast, refreshInsights, transactions: liveTransactions, budgets: liveBudgets, goals: liveGoals, loading: ctxLoading, dataVersion } = useInsights();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Period view — matches Budgets/Reports. Default is current month so users
  // see "how am I doing THIS month?" not a lifetime dump.
  const todayKey = new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState('month'); // 'month' | 'year' | 'all'
  const [selectedMonth, setSelectedMonth] = useState(todayKey);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense', amount: '', description: '',
    category: 'Food & Dining', date: new Date().toISOString().split('T')[0],
    goal_id: '',
  });
  const [formErrors, setFormErrors] = useState({});
  // Duplicate-detection state: when we find potential matches, we block the
  // save and surface them to the user. They can either cancel or tick
  // "add anyway" to confirm the transaction really is a new event.
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [duplicateOverride, setDuplicateOverride] = useState(false);

  // Categories list - defined before state that uses it
  const categories = [
    'Food & Dining', 'Transportation', 'Housing', 'Utilities',
    'Entertainment', 'Shopping', 'Health & Fitness', 'Education',
    'Groceries', 'Subscriptions', 'Savings', 'Investments',
    'Gifts & Donations', 'Personal Care', 'Travel', 'Income', 'Other',
  ];

  // Start with all categories collapsed
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set(categories));

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [importStats, setImportStats] = useState(null); // { total, valid, skipped, mapped, autoCategorised }
  const [importWarnings, setImportWarnings] = useState([]);
  const [importExpanded, setImportExpanded] = useState(false); // show all rows toggle
  const xlsxInputRef = useRef(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [extractedData, setExtractedData] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanSuccess, setScanSuccess] = useState('');
  const [tesseractReady, setTesseractReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Backdated transaction confirmation — when a scanned receipt's date is
  // from a different month/year than the current one, we show a confirmation
  // dialog so the user knows this will be filed under the receipt's original
  // financial period (not the current month).
  const [backdateConfirm, setBackdateConfirm] = useState(null); // { payload, message, monthLabel, timeAgo }
  // AI scan credits — tracks how many AI calls the user has made today
  // so we can show a "X of 50 remaining" badge + reset countdown.
  // Tesseract scans don't count (they're free and unlimited).
  const [aiScansToday, setAiScansToday] = useState(null); // null = loading
  const AI_SCANS_PER_DAY = 50;
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const categoryConfig = {
    'Food & Dining': { icon: Coffee, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    'Transportation': { icon: Car, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
    'Housing': { icon: Home, color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
    'Utilities': { icon: Zap, color: '#F97316', bg: 'rgba(249,115,22,0.1)' },
    'Entertainment': { icon: Film, color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
    'Shopping': { icon: ShoppingCart, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    'Health & Fitness': { icon: Heart, color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
    'Education': { icon: GraduationCap, color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
    'Groceries': { icon: ShoppingCart, color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    'Subscriptions': { icon: RefreshCw, color: '#A855F7', bg: 'rgba(168,85,247,0.1)' },
    'Savings': { icon: Wallet, color: '#14B8A6', bg: 'rgba(20,184,166,0.1)' },
    'Investments': { icon: TrendingUp, color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
    'Gifts & Donations': { icon: Heart, color: '#F472B6', bg: 'rgba(244,114,182,0.1)' },
    'Personal Care': { icon: Star, color: '#FB923C', bg: 'rgba(251,146,60,0.1)' },
    'Travel': { icon: Car, color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
    'Income': { icon: DollarSign, color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
    'Other': { icon: MoreHorizontal, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
  };

  const getCategoryIcon = (cat) => categoryConfig[cat]?.icon || MoreHorizontal;
  const getCategoryColor = (cat) => categoryConfig[cat]?.color || '#94A3B8';
  const getCategoryBg = (cat) => categoryConfig[cat]?.bg || 'rgba(148,163,184,0.1)';

  const loadSheetJS = () => {
    return new Promise((resolve) => {
      if (window.XLSX) { resolve(true); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  };

  useEffect(() => {
    const check = () => {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(mobile || ('ontouchstart' in window && window.innerWidth < 1024));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!scannerOpen) return;
    if (window.Tesseract) { setTesseractReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => setTesseractReady(true);
    document.head.appendChild(s);
  }, [scannerOpen]);

  const [goalsById, setGoalsById] = useState({});
  // budgetsByCategory: { 'Food & Dining': { allocated: 3000 }, ... } for current month
  const [budgetsByCategory, setBudgetsByCategory] = useState({});
  useEffect(() => {
    if (!user) return;
    setTransactions(liveTransactions || []);
    const lookup = {};
    (liveGoals || []).forEach(g => { lookup[g.id] = g.name; });
    setGoalsById(lookup);
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const bLookup = {};
    (liveBudgets || []).filter(b => b.month_year === currentMonthKey).forEach(b => {
      bLookup[b.category] = b;
    });
    setBudgetsByCategory(bLookup);
    if (!ctxLoading) setLoading(false);
  }, [user, liveTransactions, liveBudgets, liveGoals, dataVersion, ctxLoading]);

  // =============================================================
  // COMMUNITY CATEGORY MAP — load crowd-learned merchant→category
  // mappings from Supabase so other users' contributions can help
  // auto-categorise this user's imports. Only trusts entries with
  // ≥5 votes AND ≥60% share of votes for that merchant (matching
  // the server-side thresholds in lookup_merchant_category).
  // Falls back silently if the table doesn't exist yet.
  // =============================================================
  useEffect(() => {
    if (!user) return;
    const loadCommunityMap = async () => {
      try {
        const { data, error } = await supabase
          .from('merchant_categories')
          .select('merchant_token, category, vote_count')
          .gte('vote_count', 5);
        if (error) {
          // Table likely doesn't exist yet — silent fail, keyword fallback still works
          setCommunityMap(null);
          return;
        }

        // Aggregate per merchant: pick the category with the highest vote_count,
        // but only if it represents ≥60% of all votes for that merchant (matches
        // the server-side min_share threshold in lookup_merchant_category).
        const byMerchant = {};
        (data || []).forEach(row => {
          if (!byMerchant[row.merchant_token]) {
            byMerchant[row.merchant_token] = { rows: [], total: 0 };
          }
          byMerchant[row.merchant_token].rows.push(row);
          byMerchant[row.merchant_token].total += row.vote_count;
        });

        const map = {};
        Object.entries(byMerchant).forEach(([token, info]) => {
          // Sort by vote_count desc, take winner
          info.rows.sort((a, b) => b.vote_count - a.vote_count);
          const winner = info.rows[0];
          const share = winner.vote_count / info.total;
          if (share >= 0.6) {
            map[token] = {
              category: winner.category,
              confidence: winner.vote_count >= 20 ? 'high' : winner.vote_count >= 10 ? 'medium' : 'low',
              votes: winner.vote_count,
            };
          }
        });

        setCommunityMap(map);
      } catch (e) {
        setCommunityMap(null);
      }
    };
    loadCommunityMap();
  }, [user]);

  // =============================================================
  // AI SCAN CREDITS — counts Plumfolio AI calls since the last Pacific
  // midnight (when the free-tier quota resets). We refresh
  // when the scanner opens and again after each successful AI scan.
  // =============================================================
  // Computes the ISO timestamp of the most recent midnight in Pacific time.
  // AI quota resets at 00:00 US/Pacific. We convert that wall-clock
  // moment to a UTC ISO string so our `gte(...)` SQL query is correct.
  const lastPacificMidnightIso = () => {
    // Pacific offset: -08:00 standard, -07:00 daylight. A robust way to
    // find "today at midnight Pacific" is to use the Intl formatter with
    // the America/Los_Angeles zone.
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const pacificDate = fmt.format(now); // "2026-04-14"
    // Parse "2026-04-14 00:00" as America/Los_Angeles, then get its UTC value.
    // Trick: build an ISO string with the offset by round-tripping.
    const probe = new Date(`${pacificDate}T00:00:00-08:00`); // works for PST
    // If daylight saving is active, the above is 1h off. Correct by checking
    // what time this probe prints in Pacific:
    const probePac = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit', hourCycle: 'h23',
    }).format(probe);
    if (probePac !== '00') {
      // probe reads as 01:00 Pacific, meaning we're in PDT (UTC-7).
      return new Date(`${pacificDate}T00:00:00-07:00`).toISOString();
    }
    return probe.toISOString();
  };

  const fetchAiScansToday = async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('scan_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', lastPacificMidnightIso());
      setAiScansToday(count ?? 0);
    } catch (e) {
      console.warn('Could not fetch AI scan usage:', e?.message);
      setAiScansToday(0); // fail-open: assume 0 used rather than blocking
    }
  };

  // Refresh when the scanner modal opens
  useEffect(() => {
    if (scannerOpen) fetchAiScansToday();
  }, [scannerOpen, user]);

  // A ticker so the reset countdown updates every minute
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!scannerOpen) return;
    const id = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(id);
  }, [scannerOpen]);

  // Time until next Pacific midnight, formatted "Xh Ym"
  const resetCountdown = () => {
    const next = new Date(lastPacificMidnightIso());
    next.setUTCDate(next.getUTCDate() + 1);
    const diffMs = next.getTime() - nowTick;
    if (diffMs <= 0) return 'soon';
    const hours = Math.floor(diffMs / 3_600_000);
    const mins = Math.floor((diffMs % 3_600_000) / 60_000);
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const aiScansRemaining = aiScansToday === null ? null : Math.max(0, AI_SCANS_PER_DAY - aiScansToday);


  const hasFilters = filter !== 'all' || categoryFilter !== 'all' || dateFrom || dateTo || searchQuery;

  // Filter by period first, then other filters.
  const filtered = transactions.filter(t => {
    // Period filter
    if (period === 'month' && !(t.date || '').startsWith(selectedMonth)) return false;
    if (period === 'year' && !(t.date || '').startsWith(selectedYear)) return false;
    // (period === 'all' means no period filter)

    if (filter !== 'all' && t.type !== filter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  // Human label for the currently-selected period
  const periodLabel = (() => {
    if (period === 'month') return new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (period === 'year') return selectedYear;
    return 'All time';
  })();

  const groupedByCategory = filtered.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => {
    const totalA = groupedByCategory[a].reduce((sum, t) => sum + t.amount, 0);
    const totalB = groupedByCategory[b].reduce((sum, t) => sum + t.amount, 0);
    return totalB - totalA;
  });

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const netAmount = totalIncome - totalExpenses;

  // Period-scoped totals — used by the summary cards at the top.
  // These IGNORE type/category/search filters because the cards literally
  // say "Income / Expenses / Net" for the period — they should always
  // tell the truth about the period regardless of which transactions are
  // currently being LISTED below. Without this, picking the Expense filter
  // makes the Income card show P0 even when income exists for the month.
  const periodTransactions = transactions.filter(t => {
    if (period === 'month' && !(t.date || '').startsWith(selectedMonth)) return false;
    if (period === 'year' && !(t.date || '').startsWith(selectedYear)) return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return true;
  });
  const periodIncome = periodTransactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const periodExpenses = periodTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const periodNet = periodIncome - periodExpenses;

  const clearFilters = () => {
    setFilter('all');
    setCategoryFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
  };

  const toggleCategory = (cat) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const formatDate = (d) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { isValid, errors } = validateTransactionForm(formData);
    if (!isValid) { setFormErrors(errors); return; }

    const payload = {
      user_id: user.id,
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description.trim(),
      category: formData.category,
      date: formData.date,
      ...(formData.goal_id ? { goal_id: formData.goal_id } : {}),
    };

    // Duplicate check — skipped on edit (editing = intentional change to an
    // existing row), skipped if the user already confirmed to override.
    if (!editingTransaction && !duplicateOverride) {
      const matches = findDuplicates(payload, transactions);
      if (matches.length > 0) {
        setDuplicateMatches(matches);
        return;  // block save; the UI shows a confirmation banner
      }
    }

    if (editingTransaction) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editingTransaction.id);
      if (!error) {
        setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...t, ...payload } : t));
        if (addToast) addToast({ type: 'success', title: 'Transaction Updated', message: `${payload.description} — ${formatCurrency(payload.amount)}` });
        // Editing a transaction → user actively confirmed merchant→category. Vote.
        if (payload.description && payload.category && payload.category !== 'Other' && payload.type === 'expense') {
          supabase.rpc('vote_for_merchant_category', {
            raw_merchant: payload.description,
            raw_category: payload.category,
          }).then(() => null).catch(() => null);
        }
      }
    } else {
      const { data, error } = await supabase.from('transactions').insert([payload]).select();
      if (!error && data) {
        setTransactions(prev => [data[0], ...prev]);
        const goalName = payload.goal_id ? goalsById[payload.goal_id] : null;
        const matchedBudget = !goalName && payload.type === 'expense' ? budgetsByCategory[payload.category] : null;
        if (addToast) addToast({
          type: 'success',
          title: goalName ? `Added to ${goalName}` : 'Transaction Added',
          message: goalName
            ? `${formatCurrency(payload.amount)} saved towards ${goalName}`
            : matchedBudget
              ? `${payload.description} — ${formatCurrency(payload.amount)} applied to your ${payload.category} budget`
              : `${payload.description} — ${formatCurrency(payload.amount)}`,
        });
        // Budget breach detection — warn if this expense pushed a category or
        // the total budget over the limit.
        if (payload.type === 'expense' && addToast && Object.keys(budgetsByCategory).length > 0) {
          const currentMonth = new Date().toISOString().slice(0, 7);
          const allTxns = [data[0], ...transactions];
          const monthExpenses = allTxns.filter(
            t => t.type === 'expense' && (t.date || '').startsWith(currentMonth)
          );
          // Check individual category budget
          if (matchedBudget) {
            const catSpent = monthExpenses
              .filter(t => t.category === payload.category)
              .reduce((s, t) => s + t.amount, 0);
            if (catSpent > matchedBudget.allocated) {
              addToast({
                type: 'warning',
                title: `${payload.category} Budget Exceeded`,
                message: `You've spent ${formatCurrency(catSpent)} of your ${formatCurrency(matchedBudget.allocated)} ${payload.category} budget — over by ${formatCurrency(catSpent - matchedBudget.allocated)}.`,
              });
            }
          }
          // Check total budget
          const totalBudgeted = Object.values(budgetsByCategory).reduce((s, b) => s + b.allocated, 0);
          const totalSpent = monthExpenses
            .filter(t => budgetsByCategory[t.category])
            .reduce((s, t) => s + t.amount, 0);
          if (totalSpent > totalBudgeted) {
            addToast({
              type: 'warning',
              title: 'Total Budget Exceeded',
              message: `Your total budgeted spending (${formatCurrency(totalSpent)}) has exceeded your total budget of ${formatCurrency(totalBudgeted)} by ${formatCurrency(totalSpent - totalBudgeted)}.`,
            });
          }
        }
        // Manual add → user explicitly chose merchant + category. Vote.
        if (payload.description && payload.category && payload.category !== 'Other' && payload.type === 'expense') {
          supabase.rpc('vote_for_merchant_category', {
            raw_merchant: payload.description,
            raw_category: payload.category,
          }).then(() => null).catch(() => null);
        }
      }
    }

    setModalOpen(false);
    setEditingTransaction(null);
    setFormData({ type: 'expense', amount: '', description: '', category: 'Food & Dining', date: new Date().toISOString().split('T')[0], goal_id: '' });
    setFormErrors({});
    setDuplicateMatches([]);
    setDuplicateOverride(false);
    if (refreshInsights) refreshInsights();
  };

  const handleEdit = (t) => {
    setEditingTransaction(t);
    setFormData({ type: t.type, amount: t.amount.toString(), description: t.description, category: t.category, date: t.date });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    // Grab the transaction BEFORE deleting so we can tailor the toast
    // message if it was a goal contribution.
    const victim = transactions.find(t => t.id === id);
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) {
      setTransactions(prev => prev.filter(t => t.id !== id));

      // Note: we do NOT update savings_goals.saved here. That column is the
      // frozen legacy baseline; displayed progress = baseline + sum(linked
      // contributions). Deleting a contribution transaction automatically
      // reduces the sum on the next Budgets fetch.

      if (addToast) {
        addToast({
          type: 'info',
          title: 'Deleted',
          message: victim?.goal_id
            ? 'Contribution removed — goal progress updated.'
            : 'Transaction removed'
        });
      }
      if (refreshInsights) refreshInsights();
    }
  };

  const openScanner = () => { setScannerOpen(true); resetScanner(); };
  const closeScanner = () => { setScannerOpen(false); resetScanner(); };
  const resetScanner = () => {
    setSelectedFile(null); setPreview(null); setScanning(false);
    setScanProgress(0); setScanStatus(''); setExtractedData(null);
    setScanError(''); setScanSuccess('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setScanError('Please select an image'); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result);
    reader.readAsDataURL(file);
    setScanError('');
  };

  const scanReceipt = async () => {
    if (!preview || !window.Tesseract) return;
    setScanning(true); setScanError(''); setScanProgress(0); setScanStatus('Processing...');
    try {
      // =======================================================
      // PHASE 1: LOCAL OCR (fast, free, offline)
      // =======================================================
      // Always try Tesseract first. It's instant on clean receipts and
      // costs nothing — no reason to burn AI quota when a straight
      // receipt can be parsed locally.
      const processedVersions = await processReceiptImage(preview);
      setScanStatus('Reading locally...'); setScanProgress(10);

      const confidenceRank = { high: 3, medium: 2, low: 1, none: 0 };
      let bestParsed = null;

      for (let i = 0; i < processedVersions.length; i++) {
        const version = processedVersions[i];
        setScanStatus(`Reading (${version.label})...`);
        setScanProgress(10 + Math.round((i / processedVersions.length) * 40));

        const result = await window.Tesseract.recognize(version.data, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const baseProgress = 10 + Math.round((i / processedVersions.length) * 40);
              setScanProgress(baseProgress + Math.round(m.progress * (40 / processedVersions.length)));
            }
          },
          tessedit_pageseg_mode: 6,
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/-$£€¥PR*@ ',
        });

        const parsed = parseReceiptStrict(result.data.text);
        if (!bestParsed || confidenceRank[parsed.confidence] > confidenceRank[bestParsed.confidence]) {
          bestParsed = parsed;
        }
        // Stop Tesseract loop early only if we got high confidence — we'll
        // skip the AI step entirely in that case.
        if (parsed.confidence === 'high') break;
      }

      // =======================================================
      // PHASE 2: AI FALLBACK (only if local was not high-confidence)
      // =======================================================
      // Route to Plumfolio AI for anything below 'high' — it's dramatically
      // better on crumpled / angled / faded receipts. Uses Supabase Edge
      // Function so the API key stays server-side. Skipped entirely if
      // the user has used all 50 of their daily AI credits.
      const hasAiCredits = aiScansRemaining === null || aiScansRemaining > 0;
      const shouldUseAI = (!bestParsed || bestParsed.confidence !== 'high') && hasAiCredits;

      if (shouldUseAI) {
        setScanStatus('Using AI for better accuracy...');
        setScanProgress(60);
        try {
          // Extract base64 payload from the data URL preview
          // Downscale the image before sending. The AI doesn't need a 4k
          // photo to read a receipt, but we DO need enough resolution to
          // keep tiny receipt text legible — especially on phone photos
          // taken at an angle or under poor lighting. 1600px on the long
          // edge at JPEG quality 0.92 is the sweet spot: small enough to
          // upload fast, large enough that total/date text stays crisp.
          //
          // Using document.createElement('img') instead of `new Image()`
          // because the minified production build was clashing `Image` with
          // another identifier (causing "Kf is not a constructor" errors).
          const downscaled = await new Promise((resolve, reject) => {
            const img = document.createElement('img');
            img.onload = () => {
              const MAX = 1600;
              const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
              const w = Math.round(img.width * ratio);
              const h = Math.round(img.height * ratio);
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              // High-quality resampling (default on modern Chrome/Safari
              // but setting explicitly for safety)
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, w, h);
              resolve(canvas.toDataURL('image/jpeg', 0.92));
            };
            img.onerror = () => reject(new Error('Image load failed'));
            img.src = preview;
          });

          const base64 = downscaled.replace(/^data:image\/\w+;base64,/, '');

          // Get the current session JWT explicitly. supabase.functions.invoke
          // usually picks this up automatically but some versions/setups miss
          // it, leading to 401s. Being explicit here removes that ambiguity.
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('Not signed in');

          // Supabase's edge-function gateway requires BOTH the user's JWT
          // (Authorization) AND the project anon key (apikey). Some builds
          // drop the apikey header when calling via .invoke() — passing it
          // explicitly prevents the 401-before-function-runs problem.
          const { data: aiResult, error: fnError } = await supabase.functions.invoke('scan-receipt', {
            body: { imageBase64: base64 },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: SUPABASE_ANON_KEY,
            },
          });

          if (fnError) throw new Error(fnError.message || 'AI scan failed');

          if (aiResult && !aiResult.error) {
            // AI returned something — prefer it over the local result if its
            // confidence is >= the local result (AI is more reliable on hard
            // receipts, and this is the branch where local wasn't 'high').
            const aiRank = confidenceRank[aiResult.confidence] ?? 0;
            const localRank = confidenceRank[bestParsed?.confidence] ?? 0;
            if (aiRank >= localRank) {
              bestParsed = {
                merchant: aiResult.merchant,
                date: aiResult.date,
                total: aiResult.total,
                category: aiResult.category,
                confidence: aiResult.confidence,
                documentType: aiResult.documentType || aiResult.document_type || 'receipt',
                source: 'ai',
              };
            }
          } else if (aiResult?.error === 'not_a_receipt') {
            setScanError("This doesn't look like a receipt. Please upload a clear receipt photo.");
            return;
          } else if (aiResult?.error === 'quota_exhausted' || aiResult?.error === 'rate_limit') {
            // AI unavailable — fall back to whatever Tesseract gave us with
            // a note that accuracy may be lower.
            console.warn('AI scan unavailable:', aiResult?.message);
          }
        } catch (aiErr) {
          // Edge function unreachable (network issue, function not deployed,
          // etc). Fall back silently to the local result — user still gets
          // whatever Tesseract extracted.
          console.warn('AI scan failed, using local result:', aiErr.message);
        }
        // Refresh the credits badge after any AI attempt — successful or not,
        // a row was logged in scan_usage so the count went up by 1.
        fetchAiScansToday();
        setScanProgress(90);
      }

      // =======================================================
      // PHASE 3: SURFACE RESULTS
      // =======================================================
      setScanProgress(95); setScanStatus('Extracting...');

      if (!bestParsed || bestParsed.confidence === 'none') {
        setScanError("Couldn't read the receipt. Try a clearer photo or enter the details manually.");
        return;
      }

      const missing = [];
      if (!bestParsed.merchant) missing.push('merchant');
      if (!bestParsed.date) missing.push('date');
      if (!bestParsed.total) missing.push('total');

      setExtractedData({
        merchant: bestParsed.merchant || '',
        date: bestParsed.date || '',
        total: bestParsed.total || 0,
        category: bestParsed.category || 'Other',
        documentType: bestParsed.documentType || 'receipt',
      });

      const sourceLabel = bestParsed.source === 'ai' ? ' (AI)' : '';
      if (bestParsed.confidence === 'high') {
        setScanSuccess(`Receipt scanned${sourceLabel} — review and save.`);
      } else if (bestParsed.confidence === 'medium') {
        setScanSuccess(`Partial scan${sourceLabel} — please fill in ${missing.join(', ')}.`);
      } else {
        setScanSuccess(`Low confidence${sourceLabel} — please check ${missing.join(', ')} carefully.`);
      }
    } catch (err) { setScanError('Scan failed: ' + err.message); }
    finally { setScanning(false); setScanProgress(100); }
  };

  // Helper: calculate human-readable time-ago string
  const getTimeAgo = (dateStr) => {
    const txDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now - txDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    const diffYears = Math.floor(diffMonths / 12);
    const remainingMonths = diffMonths % 12;
    if (remainingMonths === 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears > 1 ? 's' : ''} and ${remainingMonths} month${remainingMonths > 1 ? 's' : ''} ago`;
  };

  // Check if a date falls in a different month/year than the current one
  const isBackdated = (dateStr) => {
    const txDate = new Date(dateStr);
    const now = new Date();
    return txDate.getFullYear() !== now.getFullYear() || txDate.getMonth() !== now.getMonth();
  };

  // Actually insert a scanned transaction into the DB (shared by normal save + confirmed backdate)
  const commitScannedTransaction = async (payload) => {
    const { data, error } = await supabase.from('transactions').insert([payload]).select();
    if (!error && data) {
      setTransactions(prev => [data[0], ...prev]);

      // Contribute the merchant→category to the community pool.
      // The user has confirmed this categorisation by saving, so it's a high-quality vote.
      // Server RPC handles all normalisation, validation and sensitive-keyword filtering.
      if (payload.description && payload.category && payload.category !== 'Other' && payload.type === 'expense') {
        supabase.rpc('vote_for_merchant_category', {
          raw_merchant: payload.description,
          raw_category: payload.category,
        }).then(() => null).catch(() => null);
      }

      const txDate = new Date(payload.date);
      const monthLabel = txDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      if (addToast) addToast({
        type: 'success',
        title: 'Saved',
        message: isBackdated(payload.date)
          ? `Added ${payload.description} to ${monthLabel}`
          : `Added ${payload.description}`,
      });
      closeScanner();
      setBackdateConfirm(null);
      if (refreshInsights) refreshInsights();
    }
  };

  const saveScanned = async () => {
    if (!extractedData) return;
    // Strict mode: we save merchant (description), date, and total. Nothing else.
    // First check the three required fields are present and valid.
    if (!extractedData.merchant || extractedData.merchant.trim().length < 2) {
      setScanError('Merchant name missing — tap the field and type it in');
      return;
    }
    if (!extractedData.date) {
      setScanError('Date missing — tap the date field to set it');
      return;
    }
    if (!(extractedData.total > 0)) {
      setScanError('Total amount missing or zero — tap the total field and correct it');
      return;
    }

    const payload = {
      user_id: user.id, type: 'expense', amount: extractedData.total,
      description: extractedData.merchant.trim(), category: extractedData.category || 'Other', date: extractedData.date,
    };

    // Duplicate check for scanned receipts — same merchant + same amount + same date
    // is almost certainly a double-scan of the same physical receipt.
    const matches = findDuplicates(payload, transactions);
    if (matches.length > 0 && !extractedData.overrideDuplicate) {
      setExtractedData({ ...extractedData, duplicateMatches: matches });
      setScanError(`This receipt looks like a duplicate of a transaction you already have (${describeMatch(matches[0], formatCurrency)}). Tick "Save anyway" below if it really is a new receipt.`);
      return;
    }

    // Backdated receipt check — if the receipt date is from a different month/year,
    // confirm with the user before saving so they understand it will be filed under
    // the original financial period (affecting that month/year's totals, insights, forecasts).
    if (isBackdated(extractedData.date)) {
      const txDate = new Date(extractedData.date);
      const monthLabel = txDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      const timeAgo = getTimeAgo(extractedData.date);
      setBackdateConfirm({
        payload,
        timeAgo,
        monthLabel,
      });
      return;
    }

    await commitScannedTransaction(payload);
  };

  const handleXLSXFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loaded = await loadSheetJS();
    if (!loaded || !window.XLSX) {
      setImportErrors(['Could not load spreadsheet library — check your internet connection and try again']);
      setImportModalOpen(true);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv') || file.type === 'text/csv';

    reader.onerror = () => {
      setImportErrors(['Could not read the file — it may be corrupt or empty']);
      setImportModalOpen(true);
    };

    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        if (!data) {
          setImportErrors(['File appears to be empty']);
          setImportModalOpen(true);
          return;
        }

        // CSV files are read as text; XLSX/XLS as array buffer
        const wb = isCSV
          ? window.XLSX.read(data, { type: 'string' })
          : window.XLSX.read(data, { type: 'array' });

        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          setImportErrors(['No sheets found in this file']);
          setImportModalOpen(true);
          return;
        }

        const ws = wb.Sheets[wb.SheetNames[0]];
        // Use defval so empty cells become '' (not undefined), and
        // omit `header: 1` so we get keyed objects ({ Date: '...', Amount: ... })
        // instead of arrays of arrays — which is what parseImportRows expects.
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (!rows || rows.length === 0) {
          setImportErrors(['No data rows found in the file. Make sure the first row contains column headers (Date, Amount, Description, etc.) and that there is at least one row of data below.']);
          setImportModalOpen(true);
          return;
        }

        processImportRows(rows);
      } catch (err) {
        console.error('Import error:', err);
        setImportErrors([`Could not parse file: ${err.message || 'unknown error'}. Make sure it is a valid CSV, XLSX or XLS file with headers in the first row.`]);
        setImportModalOpen(true);
      }
    };

    if (isCSV) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
    e.target.value = '';
  };

  const processImportRows = (rows) => {
    const historyIndex = buildHistoryIndex(transactions);
    // parseImportRows signature is (rows, knownCategories, historyIndex)
    // We pass our category list as knownCategories so import can recognise
    // existing categories during mapping.
    const result = parseImportRows(rows, categories, historyIndex);
    setImportErrors(result.errors || []);
    setImportWarnings(result.warnings || []);
    setImportStats(result.stats || null);
    setImportExpanded(false);
    if (result.rows && result.rows.length > 0) setImportData(result.rows);
    else setImportData(null);
    setImportModalOpen(true);
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    setImportData(null);
    setImportErrors([]);
    setImportWarnings([]);
    setImportStats(null);
    setImportExpanded(false);
  };

  // Update the category for a single import row before saving
  const updateImportRowCategory = (rowIdx, newCategory) => {
    setImportData(prev => prev.map((r, i) =>
      i === rowIdx ? { ...r, category: newCategory, _categorySource: 'user-edited' } : r
    ));
  };

  // Contribute categorisations to the community pool so other users benefit.
  // Calls vote_for_merchant_category once per unique merchant. The server-side
  // RPC handles normalisation, sensitive-keyword filtering, and vote
  // aggregation — we just send the raw merchant name + chosen category.
  // Runs after a successful import. Failures are silent (community
  // contribution is best-effort and the import has already succeeded).
  const contributeToCommunity = async (importedRows) => {
    try {
      // Dedupe by raw description so we vote at most once per merchant per import
      const seen = new Set();
      const votes = [];
      importedRows.forEach(r => {
        if (!r.description || !r.category || r.category === 'Other') return;
        // Skip rows where the user didn't engage with the categorisation
        // (e.g. transparent income defaults). We want votes to reflect
        // confirmed merchant→category pairings.
        if (r._categorySource === 'income-default') return;
        const key = r.description.trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        votes.push({ merchant: r.description.trim(), category: r.category });
      });

      if (votes.length === 0) return;

      // Fire all votes in parallel; server RPC does its own validation
      // and silently rejects ones that don't meet the privacy/quality bar.
      await Promise.all(
        votes.map(v =>
          supabase.rpc('vote_for_merchant_category', {
            raw_merchant: v.merchant,
            raw_category: v.category,
          }).then(() => null).catch(() => null) // silent — never block
        )
      );
    } catch (e) {
      console.log('Community contribution skipped:', e.message);
    }
  };

  const doImport = async () => {
    if (!importData || importData.length === 0) return;
    setImporting(true);

    // Skip rows that duplicate existing transactions. Report how many were skipped.
    const seen = [...transactions];
    const toInsert = [];
    let skipped = 0;
    for (const r of importData) {
      const candidate = {
        user_id: user.id, type: r.type, amount: r.amount,
        description: r.description || '', category: r.category, date: r.date,
      };
      const matches = findDuplicates(candidate, seen);
      if (matches.length > 0 && matches[0].matchStrength === 'certain') {
        skipped++;
        continue;
      }
      toInsert.push(candidate);
      // Also add to `seen` so duplicates WITHIN the import file itself get caught.
      seen.push(candidate);
    }

    if (toInsert.length === 0) {
      if (addToast) addToast({ type: 'info', title: 'Nothing to import', message: `All ${importData.length} rows matched existing transactions.` });
      setImporting(false);
      closeImportModal();
      return;
    }

    const { data, error } = await supabase.from('transactions').insert(toInsert).select();
    if (!error && data) {
      setTransactions(prev => [...data, ...prev]);

      // Contribute categorisations to the community pool (non-blocking, best-effort)
      contributeToCommunity(importData);

      if (addToast) addToast({
        type: 'success',
        title: 'Imported',
        message: skipped > 0
          ? `${data.length} added, ${skipped} skipped as duplicates`
          : `${data.length} transactions added`
      });
      closeImportModal();
      if (refreshInsights) refreshInsights();
    } else if (error) {
      setImportErrors([`Could not save: ${error.message}`]);
    }
    setImporting(false);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const rows = filtered.map(t => [t.date, `"${t.description}"`, t.category, t.type, t.amount]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click();
  };

  if (loading) return <div className="tx-loading"><Loader size={32} className="spin" /></div>;

  // The summary label now leads with the period (Month/Year/All time), then
  // Filter suffix for the LIST area only (summary cards above use period
  // totals and intentionally ignore type/category/search filters).
  // Date range narrowing IS reflected because it changes which days the
  // period actually covers.
  const filterSuffix = (() => {
    const parts = [];
    if (categoryFilter !== 'all') parts.push(`${categoryFilter} only`);
    if (filter !== 'all') parts.push(`${filter} only`);
    if (searchQuery) parts.push(`matching "${searchQuery}"`);
    if (dateFrom || dateTo) parts.push(`${dateFrom || '…'} → ${dateTo || '…'}`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  })();
  // Summary cards use the plain period label (no filter suffix) since they
  // show period truth, not filter-narrowed sums.
  const summaryPeriodLabel = periodLabel;
  const listPeriodLabel = periodLabel + filterSuffix;

  // "No income yet" flag — uses the period's TRUE income (not the
  // filter-narrowed totalIncome) so picking the Expense filter doesn't
  // wrongly trigger the "no income" warning when income actually exists.
  const noIncomeThisMonth = period === 'month' && selectedMonth >= todayKey && periodIncome === 0;

  // Years that appear in the user's transactions, for the year picker
  const availableYears = Array.from(new Set(transactions.map(t => (t.date || '').slice(0, 4)).filter(Boolean))).sort();
  if (!availableYears.includes(String(new Date().getFullYear()))) availableYears.push(String(new Date().getFullYear()));
  availableYears.sort();

  return (
    <div className="tx-page">
      {/* Period Picker — matches Budgets/Reports UX */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, border: '1px solid var(--border-color)' }}>
          {['month', 'year', 'all'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                background: period === p ? 'var(--plum-medium)' : 'transparent',
                color: period === p ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: period === p ? 600 : 400,
                fontFamily: 'inherit',
              }}
            >
              {p === 'month' ? 'Monthly' : p === 'year' ? 'Yearly' : 'All time'}
            </button>
          ))}
        </div>
        {period === 'month' && (
          <MonthPicker
            value={selectedMonth}
            onChange={v => v && setSelectedMonth(v)}
          />
        )}
        {period === 'year' && (
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            style={{
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border-color)', borderRadius: 8,
              padding: '6px 10px', fontSize: '0.85rem', fontFamily: 'inherit',
            }}
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {period === 'month' && selectedMonth === todayKey && (
          <span style={{ fontSize: '0.7rem', color: '#22C55E', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 6 }}>
            Current month
          </span>
        )}
        {period === 'month' && selectedMonth < todayKey && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6 }}>
            Historical
          </span>
        )}
        {period === 'month' && selectedMonth > todayKey && (
          <span style={{ fontSize: '0.7rem', color: 'var(--plum-glow)', background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: 6 }}>
            Future
          </span>
        )}
      </div>

      {/* "No income yet" nudge — explains the rule to users who haven't
          entered income for the current/future month. Uses period totals
          (not filter-narrowed) so it's accurate regardless of type filter. */}
      {noIncomeThisMonth && periodExpenses > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 10,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: '0.82rem',
          color: '#F59E0B',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={14} />
          <span>You have expenses in {periodLabel} but no income recorded yet. Add your income transaction so budgets and forecasts reflect reality.</span>
        </div>
      )}

      {/* Summary Cards — always show the period's TRUE Income/Expenses/Net.
          These intentionally ignore the type/category/search filters because
          they label themselves "Income / Expenses / Net" — they need to be
          honest about the period regardless of what's being LISTED below. */}
      <div className="tx-summary">
        <div className="tx-card income">
          <div className="tx-card-icon"><TrendingUp size={20} /></div>
          <div className="tx-card-info">
            <span className="tx-card-label">Income <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>· {summaryPeriodLabel}</span></span>
            <span className="tx-card-value" style={noIncomeThisMonth ? { color: '#F59E0B' } : {}}>
              {noIncomeThisMonth ? 'P0 · no income yet' : '+' + formatCurrency(periodIncome)}
            </span>
          </div>
        </div>
        <div className="tx-card expense">
          <div className="tx-card-icon"><TrendingDown size={20} /></div>
          <div className="tx-card-info">
            <span className="tx-card-label">Expenses <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>· {summaryPeriodLabel}</span></span>
            <span className="tx-card-value">-{formatCurrency(periodExpenses)}</span>
          </div>
        </div>
        <div className="tx-card net">
          <div className="tx-card-icon"><Wallet size={20} /></div>
          <div className="tx-card-info">
            <span className="tx-card-label">Net <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>· {summaryPeriodLabel}</span></span>
            <span className={`tx-card-value ${periodNet >= 0 ? 'pos' : 'neg'}`}>
              {periodNet >= 0 ? '+' : ''}{formatCurrency(periodNet)}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="tx-actions">
        <div className="tx-search">
          <Search size={16} />
          <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery && <button onClick={() => setSearchQuery('')}><X size={14} /></button>}
        </div>
        <div className="tx-btns">
          <button
            className={`tx-btn ${showFilters ? 'on' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title={showFilters ? 'Hide filters' : 'Show filters'}
            aria-label="Toggle filters"
          >
            <Filter size={16} />
            <span className="tx-btn-label">Filter</span>
            {hasFilters && <span className="dot" />}
          </button>
          <button
            className="tx-btn"
            onClick={() => xlsxInputRef.current?.click()}
            title="Import from Excel/CSV"
            aria-label="Import transactions"
          >
            <Upload size={16} />
            <span className="tx-btn-label">Import</span>
          </button>
          <button
            className="tx-btn"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            title="Export to CSV"
            aria-label="Export transactions"
          >
            <Download size={16} />
            <span className="tx-btn-label">Export</span>
          </button>
          <button
            className="tx-btn scan"
            onClick={openScanner}
            title="Scan a receipt"
            aria-label="Scan receipt"
          >
            <ScanLine size={16} />
            <span className="tx-btn-label">Scan</span>
          </button>
          <button
            className="tx-btn add"
            onClick={() => setModalOpen(true)}
            title="Add a new transaction"
            aria-label="Add transaction"
          >
            <Plus size={18} />
            <span className="tx-btn-label">Add</span>
          </button>
        </div>
        <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleXLSXFile} hidden />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="tx-filters">
          <div className="tx-filter-row">
            <div className="tx-filter-grp">
              <label>Type</label>
              <div className="tx-pills">
                {['all', 'income', 'expense'].map(f => (
                  <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="tx-filter-grp">
              <label>Category</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="tx-filter-grp">
              <label>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="tx-filter-grp">
              <label>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          {hasFilters && <button className="tx-clear" onClick={clearFilters}><X size={14} /> Clear</button>}
        </div>
      )}

      {/* Category Groups */}
      {filtered.length > 0 ? (
        <div className="tx-groups">
          {sortedCategories.map(category => {
            const items = groupedByCategory[category];
            const catTotal = items.reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0);
            const isCollapsed = collapsedCategories.has(category);
            const Icon = getCategoryIcon(category);
            const color = getCategoryColor(category);
            const bg = getCategoryBg(category);

            return (
              <div key={category} className="tx-group">
                <button className="tx-group-header" onClick={() => toggleCategory(category)}>
                  <div className="tx-group-left">
                    <div className="tx-group-icon" style={{ background: bg, color }}><Icon size={18} /></div>
                    <div className="tx-group-info">
                      <span className="tx-group-name">{category}</span>
                      <span className="tx-group-count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="tx-group-right">
                    <span className={`tx-group-total ${catTotal >= 0 ? 'pos' : 'neg'}`}>
                      {catTotal >= 0 ? '+' : ''}{formatCurrency(Math.abs(catTotal))}
                    </span>
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>
                
                {!isCollapsed && (
                  <div className="tx-group-items">
                    {items.map(t => (
                      <div key={t.id} className="tx-item">
                        <div className="tx-item-main">
                          <span className="tx-item-desc">{t.description}</span>
                          {t.goal_id && goalsById[t.goal_id] && (
                            <span className="tx-item-goal-tag" title="This transaction is a contribution to a savings goal. Delete it to undo.">
                              <PiggyBank size={11} /> {goalsById[t.goal_id]}
                            </span>
                          )}
                          <span className="tx-item-date">{formatDate(t.date)}</span>
                        </div>
                        <div className="tx-item-right">
                          <span className={`tx-item-amt ${t.type}`}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                          <div className="tx-item-actions">
                            <button onClick={() => handleEdit(t)}><Edit size={14} /></button>
                            <button onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="tx-empty">
          <Receipt size={48} />
          <h3>{hasFilters ? 'No matches' : 'No transactions'}</h3>
          <p>{hasFilters ? 'Try different filters' : 'Start tracking spending'}</p>
          <div className="tx-empty-btns">
            {hasFilters && <button onClick={clearFilters}><X size={16} /> Clear</button>}
            <button onClick={openScanner}><ScanLine size={16} /> Scan</button>
            <button className="primary" onClick={() => setModalOpen(true)}><Plus size={16} /> Add</button>
          </div>
        </div>
      )}

      {/* FABs */}
      <div className="tx-fabs">
        <button className="tx-fab scan" onClick={openScanner}><ScanLine size={20} /></button>
        <button className="tx-fab add" onClick={() => setModalOpen(true)}><Plus size={22} /></button>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && ReactDOM.createPortal(
        <div className="tx-overlay" onClick={() => { setModalOpen(false); setEditingTransaction(null); setFormErrors({}); setDuplicateMatches([]); setDuplicateOverride(false); }}>
          <div className="tx-modal" onClick={e => e.stopPropagation()}>
            <div className="tx-modal-head">
              <h2>{editingTransaction ? 'Edit' : 'Add'} Transaction</h2>
              <button onClick={() => { setModalOpen(false); setEditingTransaction(null); setDuplicateMatches([]); setDuplicateOverride(false); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="tx-modal-form">
              {/* Duplicate warning — shown after user hits save and we found a likely match */}
              {duplicateMatches.length > 0 && (
                <div style={{
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 12,
                  fontSize: '0.82rem',
                  color: '#F59E0B',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, marginBottom: 6 }}>
                    <AlertCircle size={14} />
                    Possible duplicate{duplicateMatches.length > 1 ? 's' : ''} detected
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {duplicateMatches.slice(0, 3).map((m, i) => (
                      <div key={m.id || i} style={{ marginBottom: 4 }}>• {describeMatch(m, formatCurrency)} <em style={{ opacity: 0.7 }}>({m.matchStrength} match)</em></div>
                    ))}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={duplicateOverride} onChange={e => setDuplicateOverride(e.target.checked)} />
                    <span>Yes, this really is a new transaction — add it anyway</span>
                  </label>
                </div>
              )}
              <div className="tx-type-toggle">
                <button type="button" className={formData.type === 'expense' ? 'on expense' : ''} onClick={() => { setFormData({...formData, type: 'expense'}); setDuplicateMatches([]); }}>
                  <ArrowDownCircle size={18} /> Expense
                </button>
                <button type="button" className={formData.type === 'income' ? 'on income' : ''} onClick={() => { setFormData({...formData, type: 'income'}); setDuplicateMatches([]); }}>
                  <ArrowUpCircle size={18} /> Income
                </button>
              </div>
              <div className="tx-field">
                <label>Amount</label>
                <div className="tx-amt-input">
                  <span>{symbol}</span>
                  <input type="number" step="0.01" min="0.01" max="10000000" value={formData.amount} onChange={e => { setFormData({...formData, amount: e.target.value}); setDuplicateMatches([]); }} placeholder="0.00" />
                </div>
                {formErrors.amount && <span className="tx-err">{formErrors.amount}</span>}
              </div>
              <div className="tx-field">
                <label>Description</label>
                <input type="text" value={formData.description} onChange={e => { setFormData({...formData, description: e.target.value}); setDuplicateMatches([]); }} placeholder="What was this for?" />
                {formErrors.description && <span className="tx-err">{formErrors.description}</span>}
              </div>
              <div className="tx-field-row">
                <div className="tx-field">
                  <label>Category</label>
                  <select value={formData.category} onChange={e => { setFormData({...formData, category: e.target.value, goal_id: ''}); setDuplicateMatches([]); }}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="tx-field">
                  <label>Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              {formData.category === 'Savings' && formData.type === 'expense' && Object.keys(goalsById).length > 0 && (
                <div className="tx-field">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PiggyBank size={14} /> Link to Savings Goal <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <select value={formData.goal_id} onChange={e => setFormData({...formData, goal_id: e.target.value})}>
                    <option value=''>— No specific goal —</option>
                    {Object.entries(goalsById).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button type="submit" className="tx-submit">{editingTransaction ? 'Save' : 'Add Transaction'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Scanner Modal */}
      {scannerOpen && ReactDOM.createPortal(
        <div className="tx-overlay" onClick={closeScanner}>
          <div className="tx-modal scanner" onClick={e => e.stopPropagation()}>
            <div className="tx-modal-head">
              <h2><ScanLine size={20} /> Scan Receipt</h2>
              <button onClick={closeScanner}><X size={20} /></button>
            </div>
            <div className="tx-scanner-body">
              {/* AI credits badge — shows how many AI scans the user has
                  left today and when the quota resets. Tesseract is free and
                  unlimited, so we only count AI calls. */}
              {aiScansToday !== null && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '8px 12px',
                  marginBottom: 10,
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  background: aiScansRemaining === 0 ? 'rgba(239,68,68,0.08)'
                              : aiScansRemaining <= 10 ? 'rgba(245,158,11,0.08)'
                              : 'rgba(168,85,247,0.06)',
                  border: `1px solid ${aiScansRemaining === 0 ? 'rgba(239,68,68,0.25)'
                              : aiScansRemaining <= 10 ? 'rgba(245,158,11,0.25)'
                              : 'rgba(168,85,247,0.18)'}`,
                  color: aiScansRemaining === 0 ? '#EF4444'
                              : aiScansRemaining <= 10 ? '#F59E0B'
                              : 'var(--text-secondary)',
                }}>
                  <span>
                    {aiScansRemaining === 0 ? (
                      <>Out of AI scans · local-only mode</>
                    ) : (
                      <><strong style={{ color: 'var(--text-primary)' }}>{aiScansRemaining}</strong> of {AI_SCANS_PER_DAY} AI scans left today</>
                    )}
                  </span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                    Resets in {resetCountdown()}
                  </span>
                </div>
              )}

              {scanSuccess && <div className="tx-msg success"><Check size={16} />{scanSuccess}</div>}
              {scanError && <div className="tx-msg error"><AlertCircle size={16} />{scanError}</div>}
              
              {!extractedData ? (
                <div className="tx-scan-upload">
                  {preview ? (
                    <div className="tx-scan-preview">
                      <img src={preview} alt="Receipt" />
                      <button onClick={resetScanner}><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="tx-scan-drop" onClick={() => fileInputRef.current?.click()}>
                      <ScanLine size={32} />
                      <p>{isMobile ? 'Tap to select' : 'Click to upload'}</p>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} hidden />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} hidden />
                  
                  {!preview && (
                    <div className="tx-scan-btns">
                      {isMobile && <button onClick={() => cameraInputRef.current?.click()}><Camera size={16} /> Camera</button>}
                      <button onClick={() => fileInputRef.current?.click()}><Image size={16} /> Gallery</button>
                    </div>
                  )}
                  
                  {preview && (
                    <button className="tx-scan-go" onClick={scanReceipt} disabled={scanning || !tesseractReady}>
                      {scanning ? <><Loader size={16} className="spin" /> {scanStatus}</> : <><FileText size={16} /> Scan</>}
                    </button>
                  )}
                </div>
              ) : (
                <div className="tx-scan-result">
                  <div className="tx-scan-result-head" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={16} /> Review & Save
                    </span>
                    {extractedData.documentType === 'tax_invoice' && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700,
                        color: '#A855F7',
                        background: 'rgba(168,85,247,0.12)',
                        padding: '3px 8px', borderRadius: 10,
                        letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>
                        Tax Invoice
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {extractedData.documentType === 'tax_invoice'
                      ? <>Tax invoice detected — the total shown is the <strong>VAT-inclusive</strong> amount. Correct any OCR errors before saving.</>
                      : <>Only three things are saved: <strong>merchant</strong>, <strong>date</strong>, and <strong>total</strong>. Correct any OCR errors before saving.</>
                    }
                  </p>
                  <div className="tx-scan-fields">
                    <div className="tx-field">
                      <label>Merchant</label>
                      <input type="text" value={extractedData.merchant} onChange={e => setExtractedData({...extractedData, merchant: e.target.value, duplicateMatches: undefined, overrideDuplicate: false})} />
                    </div>
                    <div className="tx-field-row">
                      <div className="tx-field">
                        <label>Date</label>
                        <input type="date" value={extractedData.date} onChange={e => setExtractedData({...extractedData, date: e.target.value, duplicateMatches: undefined, overrideDuplicate: false})} />
                      </div>
                      <div className="tx-field">
                        <label>Total</label>
                        <div className="tx-amt-input">
                          <span>{symbol}</span>
                          <input type="number" step="0.01" value={extractedData.total} onChange={e => setExtractedData({...extractedData, total: parseFloat(e.target.value)||0, duplicateMatches: undefined, overrideDuplicate: false})} />
                        </div>
                      </div>
                    </div>
                    <div className="tx-field">
                      <label>Category</label>
                      <select value={extractedData.category} onChange={e => setExtractedData({...extractedData, category: e.target.value})}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  {extractedData.duplicateMatches && extractedData.duplicateMatches.length > 0 && (
                    <div style={{
                      marginTop: 10,
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.3)',
                      borderRadius: 8, padding: '10px 12px',
                      fontSize: '0.8rem', color: '#F59E0B',
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠ Already in your transactions:</div>
                      {extractedData.duplicateMatches.slice(0, 2).map((m, i) => (
                        <div key={m.id || i} style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>
                          • {describeMatch(m, formatCurrency)}
                        </div>
                      ))}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <input type="checkbox" checked={!!extractedData.overrideDuplicate}
                          onChange={e => setExtractedData({...extractedData, overrideDuplicate: e.target.checked})} />
                        <span>Save anyway — this is a separate receipt</span>
                      </label>
                    </div>
                  )}
                  <div className="tx-scan-actions">
                    <button className="tx-scan-save" onClick={saveScanned}><Plus size={16} /> Save</button>
                    <button className="tx-scan-retry" onClick={resetScanner}>Try Another</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import Modal */}

      {/* Backdated Transaction Confirmation Modal */}
      {backdateConfirm && ReactDOM.createPortal(
        <div className="tx-overlay" onClick={() => setBackdateConfirm(null)}>
          <div className="tx-modal backdate-confirm" onClick={e => e.stopPropagation()} style={{
            maxWidth: 440, padding: '24px 28px',
          }}>
            <div className="tx-modal-head" style={{ marginBottom: 16 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={20} /> Past Transaction</h2>
              <button onClick={() => setBackdateConfirm(null)}><X size={20} /></button>
            </div>

            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 10, padding: '14px 16px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertCircle size={18} style={{ color: '#F59E0B', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: '#F59E0B', fontSize: '0.9rem' }}>
                  This transaction happened {backdateConfirm.timeAgo}
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                It will be added to <strong style={{ color: 'var(--text-primary)' }}>{backdateConfirm.monthLabel}</strong>'s
                financial records. This means:
              </p>
              <ul style={{
                fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '10px 0 0',
                paddingLeft: 18, lineHeight: 1.7,
              }}>
                <li>The expense will appear under <strong style={{ color: 'var(--text-primary)' }}>{backdateConfirm.monthLabel}</strong></li>
                <li>Your <strong style={{ color: 'var(--text-primary)' }}>all-time balance</strong> will be updated</li>
                <li>Insights and forecasts for that period will be recalculated</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="tx-scan-save" onClick={() => commitScannedTransaction(backdateConfirm.payload)} style={{ flex: 1 }}>
                <Check size={16} /> Accept & Save
              </button>
              <button className="tx-scan-retry" onClick={() => setBackdateConfirm(null)} style={{ flex: 1 }}>
                Discard
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Import Modal */}
      {importModalOpen && ReactDOM.createPortal(
        <div className="tx-overlay" onClick={closeImportModal}>
          <div className="tx-modal import" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="tx-modal-head">
              <h2><Upload size={20} /> Import Transactions</h2>
              <button onClick={closeImportModal}><X size={20} /></button>
            </div>
            <div className="tx-import-body">
              {importErrors.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="tx-msg error" style={{ alignItems: 'flex-start' }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {importErrors.map((err, i) => (
                        <span key={i}>{err}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    lineHeight: 1.5,
                  }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Expected format:</strong> CSV, XLSX, or XLS file with column headers in the first row. Required columns: <code>Date</code>, <code>Amount</code> (or <code>Debit</code>/<code>Credit</code>). Optional: <code>Description</code>, <code>Category</code>, <code>Type</code>.
                  </div>
                </div>
              ) : importData && importData.length > 0 ? (
                <>
                  {/* Stats banner */}
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 8,
                    marginBottom: 14, padding: '12px 14px',
                    background: 'rgba(168,85,247,0.06)',
                    border: '1px solid rgba(168,85,247,0.18)',
                    borderRadius: 10,
                  }}>
                    <div style={{ flex: '1 1 auto', minWidth: 160 }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {importData.length}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        transactions ready to import
                      </div>
                    </div>
                    {importStats && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {importStats.autoCategorised > 0 && (
                          <span title="Categories auto-detected from descriptions using your history, keywords, and community data">
                            <Sparkles size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: '#A855F7' }} />
                            <strong style={{ color: 'var(--text-primary)' }}>{importStats.autoCategorised}</strong> auto-categorised
                          </span>
                        )}
                        {importStats.mapped > 0 && (
                          <span title="Categories mapped from your file's category column">
                            <Check size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: '#22C55E' }} />
                            <strong style={{ color: 'var(--text-primary)' }}>{importStats.mapped}</strong> from file
                          </span>
                        )}
                        {importStats.skipped > 0 && (
                          <span title="Rows skipped due to invalid date or amount">
                            <AlertCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: '#F59E0B' }} />
                            <strong style={{ color: 'var(--text-primary)' }}>{importStats.skipped}</strong> skipped
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Warnings about skipped rows */}
                  {importWarnings && importWarnings.length > 0 && (
                    <details style={{
                      marginBottom: 12,
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                    }}>
                      <summary style={{ cursor: 'pointer', color: '#F59E0B' }}>
                        Show {importWarnings.length} skipped row{importWarnings.length > 1 ? 's' : ''}
                      </summary>
                      <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
                        {importWarnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </details>
                  )}

                  {/* Helper hint */}
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginBottom: 10,
                    padding: '8px 12px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 6,
                    lineHeight: 1.5,
                  }}>
                    Review each row's category before importing. Tap any category to change it. Your choices help train Plumfolio's auto-categoriser for everyone.
                  </div>

                  {/* Per-row preview with editable categories */}
                  <div className="tx-import-preview" style={{
                    maxHeight: 360,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    paddingRight: 4,
                  }}>
                    {(importExpanded ? importData : importData.slice(0, 8)).map((r, i) => {
                      // Source label + colour for the badge
                      const sourceLabels = {
                        'explicit': { label: 'from file', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
                        'mapped': { label: 'mapped', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
                        'history-exact': { label: 'your history', color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
                        'history-fuzzy': { label: 'your history', color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
                        'keyword': { label: 'keyword match', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
                        'community': { label: 'community', color: '#EC4899', bg: 'rgba(236,72,153,0.12)' },
                        'merchant-db': { label: 'merchant DB', color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
                        'income-default': { label: 'income default', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
                        'user-edited': { label: 'edited by you', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
                      };
                      const src = sourceLabels[r._categorySource] || { label: 'auto', color: 'var(--text-muted)', bg: 'var(--bg-tertiary)' };

                      return (
                        <div key={i} style={{
                          display: 'grid',
                          gridTemplateColumns: '90px 1fr auto',
                          gap: 10,
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          fontSize: '0.82rem',
                        }}>
                          {/* Date */}
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                            {r.date}
                          </span>

                          {/* Description + category dropdown + source badge */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                            <span style={{
                              color: 'var(--text-primary)',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {r.description || <em style={{ color: 'var(--text-muted)' }}>(no description)</em>}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <select
                                value={r.category}
                                onChange={e => updateImportRowCategory(i, e.target.value)}
                                style={{
                                  background: 'var(--bg-secondary, #1e1e2e)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: 5,
                                  color: 'var(--text-primary)',
                                  padding: '3px 6px',
                                  fontSize: '0.74rem',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  colorScheme: 'dark',
                                }}
                              >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <span style={{
                                fontSize: '0.66rem',
                                color: src.color,
                                background: src.bg,
                                padding: '2px 7px',
                                borderRadius: 10,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                              }}>
                                {src.label}
                              </span>
                            </div>
                          </div>

                          {/* Amount */}
                          <span className={r.type} style={{
                            color: r.type === 'income' ? '#22C55E' : '#EF4444',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            whiteSpace: 'nowrap',
                          }}>
                            {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}
                          </span>
                        </div>
                      );
                    })}

                    {importData.length > 8 && (
                      <button
                        onClick={() => setImportExpanded(!importExpanded)}
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px dashed var(--border-color)',
                          borderRadius: 8,
                          padding: '10px',
                          color: 'var(--text-secondary)',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        {importExpanded
                          ? <>Show fewer <ChevronDown size={14} style={{ transform: 'rotate(180deg)' }} /></>
                          : <>+{importData.length - 8} more — show all <ChevronDown size={14} /></>
                        }
                      </button>
                    )}
                  </div>

                  <button
                    className="tx-import-btn"
                    onClick={doImport}
                    disabled={importing}
                    style={{ marginTop: 14 }}
                  >
                    {importing
                      ? <><Loader size={16} className="spin" /> Importing...</>
                      : <><Upload size={16} /> Import All ({importData.length})</>
                    }
                  </button>
                </>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  No valid data found in this file. Make sure it has <code>Date</code> and <code>Amount</code> columns with at least one row of data below the headers.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Transactions;
