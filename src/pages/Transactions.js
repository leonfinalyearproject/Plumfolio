import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency, CURRENCIES } from '../context/CurrencyContext';
import { useInsights } from '../context/InsightsContext';
import { parseReceiptText } from '../utils/receiptParser';
import { detectCategory as receiptDetectCategory } from '../utils/receiptParser';
import processReceiptImage from '../utils/imageProcessor';
import { validateTransactionForm } from '../utils/validation';
import {
  parseImportRows, SAMPLE_TEMPLATE_ROWS, buildHistoryIndex, setReceiptDetectCategory, smartCategorise,
  setCommunityMap,
} from '../utils/importParser';

// Inject the merchant database as the cold-start fallback for import categorisation
setReceiptDetectCategory(receiptDetectCategory);
import {
  Plus, Filter, Download, Upload, X, ArrowUpCircle, ArrowDownCircle,
  Coffee, Home, Car, Zap, GraduationCap, ShoppingCart, Wallet, Briefcase,
  Heart, Film, MoreHorizontal, Trash2, Edit, Receipt, Camera, FileText,
  Check, Loader, AlertCircle, Image, ScanLine, Tag, Calendar, DollarSign,
  Star, Sparkles, Users,
  Search, ArrowUp, ArrowDown, RefreshCw, ChevronDown, Save, CheckSquare,
  Square, FileSpreadsheet, Calculator, XCircle
} from 'lucide-react';
import './Transactions.css';

const Transactions = () => {
  const { user } = useAuth();
  const { formatCurrency, symbol, currencyCode, convertToBwp, getRate, ratesLoaded } = useCurrency();
  const { addToast, refreshInsights } = useInsights();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  // Sort
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense', amount: '', description: '',
    category: 'Food & Dining', date: new Date().toISOString().split('T')[0],
  });
  const [formErrors, setFormErrors] = useState({});

  // Inline editing
  const [inlineEdit, setInlineEdit] = useState(null);

  // Multi-select
  const [selected, setSelected] = useState(new Set());
  const [showBulkBar, setShowBulkBar] = useState(false);

  // Formula bar
  const [showFormula, setShowFormula] = useState(false);

  // Import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSource, setImportSource] = useState('');
  const [importStats, setImportStats] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [importWarnings, setImportWarnings] = useState([]);
  const [importDetected, setImportDetected] = useState({});
  const [importCurrency, setImportCurrency] = useState(null); // { code, mixed, counts } from parser
  const [importCurrencyChoice, setImportCurrencyChoice] = useState(null); // { action: 'store-as-is'|'convert', sourceCode: 'USD' }
  const [showAllImportRows, setShowAllImportRows] = useState(false); // toggle: show all rows in preview vs first 10
  const csvInputRef = useRef(null);
  const xlsxInputRef = useRef(null);

  // Scanner
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
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // SheetJS loaded flag
  const [xlsxReady, setXlsxReady] = useState(false);

  const categories = [
    'Food & Dining', 'Transportation', 'Housing', 'Utilities',
    'Entertainment', 'Shopping', 'Health & Fitness', 'Education',
    'Groceries', 'Subscriptions', 'Savings', 'Investments',
    'Gifts & Donations', 'Personal Care', 'Travel', 'Income', 'Other',
  ];

  // Load SheetJS on demand
  const loadSheetJS = () => {
    return new Promise((resolve) => {
      if (window.XLSX) { setXlsxReady(true); resolve(true); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
      s.onload = () => { setXlsxReady(true); resolve(true); };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  };

  // Mobile check
  useEffect(() => {
    const check = () => {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(mobile || ('ontouchstart' in window && window.innerWidth < 1024));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Tesseract
  useEffect(() => {
    if (!scannerOpen) return;
    if (window.Tesseract) { setTesseractReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => setTesseractReady(true);
    s.onerror = () => setScanError('Failed to load OCR.');
    document.head.appendChild(s);
  }, [scannerOpen]);

  // Fetch
  useEffect(() => {
    if (user) fetchTransactions();
    else setLoading(false);
  }, [user?.id]);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase.from('transactions').select('*')
        .eq('user_id', user.id).order('date', { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
    } catch (e) { console.error('Fetch error:', e); }
    finally { setLoading(false); }
  };

  // ========== FILTERING & SORTING ==========
  const filtered = transactions.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.description.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) return false;
    }
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    if (amountMin && parseFloat(t.amount) < parseFloat(amountMin)) return false;
    if (amountMax && parseFloat(t.amount) > parseFloat(amountMax)) return false;
    return true;
  }).sort((a, b) => {
    let va, vb;
    if (sortField === 'date') { va = a.date; vb = b.date; }
    else if (sortField === 'amount') { va = parseFloat(a.amount); vb = parseFloat(b.amount); }
    else if (sortField === 'description') { va = a.description.toLowerCase(); vb = b.description.toLowerCase(); }
    else if (sortField === 'category') { va = a.category; vb = b.category; }
    else if (sortField === 'type') { va = a.type; vb = b.type; }
    else { va = a.date; vb = b.date; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={12} className="sort-icon inactive" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="sort-icon active" /> : <ArrowDown size={12} className="sort-icon active" />;
  };

  const clearFilters = () => {
    setSearchQuery(''); setDateFrom(''); setDateTo('');
    setCategoryFilter('all'); setFilter('all');
    setAmountMin(''); setAmountMax('');
  };
  const hasFilters = searchQuery || dateFrom || dateTo || categoryFilter !== 'all' || filter !== 'all' || amountMin || amountMax;

  // Formula calculations
  const fIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const fExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);
  const fAmounts = filtered.map(t => parseFloat(t.amount));
  const fSum = fAmounts.reduce((a, b) => a + b, 0);
  const fAvg = fAmounts.length > 0 ? fSum / fAmounts.length : 0;
  const fMin = fAmounts.length > 0 ? Math.min(...fAmounts) : 0;
  const fMax = fAmounts.length > 0 ? Math.max(...fAmounts) : 0;

  // ========== CRUD ==========
  // ========== AUTO-CONTRIBUTE TO SAVINGS GOAL ==========
  // When a transaction is tagged "Savings" or "Investments" AND its description
  // matches (case-insensitive) one of the user's savings goals, automatically
  // add the amount to that goal. Requires savings_goals DB table to exist.
  const autoContributeToSavingsGoal = async ({ category, description, amount }) => {
    if (!user || !description) return;
    if (category !== 'Savings' && category !== 'Investments') return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    try {
      const { data: goals, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id);
      if (error || !goals || goals.length === 0) return;
      // Find the goal whose name appears in the transaction description (loose match)
      const descLower = description.toLowerCase();
      const match = goals.find(g => {
        const name = (g.name || '').toLowerCase().trim();
        if (!name) return false;
        return descLower.includes(name) || name.includes(descLower);
      });
      if (!match) return;
      const current = parseFloat(match.saved) || 0;
      const target = parseFloat(match.target) || 0;
      const newSaved = Math.min(current + amt, target);
      if (newSaved === current) return;
      const { error: updErr } = await supabase
        .from('savings_goals')
        .update({ saved: newSaved })
        .eq('id', match.id);
      if (updErr) return;
      if (addToast) {
        const hit = newSaved >= target && current < target;
        addToast({
          type: hit ? 'success' : 'info',
          title: hit ? 'Goal Reached!' : 'Goal Updated',
          message: hit
            ? `Your "${match.name}" goal is complete!`
            : `${formatCurrency(newSaved - current)} added to "${match.name}" from this transaction.`
        });
      }
    } catch (e) { /* silently ignore — table may not be migrated */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate
    const { isValid, errors } = validateTransactionForm(formData, categories);
    if (!isValid) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    try {
      const p = { type: formData.type, amount: parseFloat(formData.amount), description: formData.description.trim(), category: formData.category, date: formData.date };
      const wasEdit = !!editingTransaction;
      if (editingTransaction) await supabase.from('transactions').update(p).eq('id', editingTransaction.id);
      else await supabase.from('transactions').insert({ ...p, user_id: user.id });
      // Contribute a community vote (privacy filters applied server-side)
      if (p.description && p.category && p.category !== 'Other') {
        contributeCommunityVote(p.description, p.category);
      }
      // Auto-contribute to matching savings goal if this is a Savings/Investments transaction
      if (!wasEdit) await autoContributeToSavingsGoal(p);
      setModalOpen(false); setEditingTransaction(null);
      setFormData({ type: 'expense', amount: '', description: '', category: 'Food & Dining', date: new Date().toISOString().split('T')[0] });
      fetchTransactions();
      if (addToast) addToast({
        type: 'success',
        title: wasEdit ? 'Transaction Updated' : (p.type === 'expense' ? 'Expense Added' : 'Income Added'),
        message: `${p.description} — ${formatCurrency(p.amount)}`
      });
      if (refreshInsights) refreshInsights();
    } catch (e) { console.error('Save error:', e); if (addToast) addToast({ type: 'warning', title: 'Save Failed', message: e.message }); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    await supabase.from('transactions').delete().eq('id', id);
    fetchTransactions();
    if (addToast) addToast({ type: 'info', title: 'Transaction Deleted', message: 'The transaction has been removed.' });
    if (refreshInsights) refreshInsights();
  };

  const handleEdit = (t) => {
    setEditingTransaction(t);
    setFormData({ type: t.type, amount: t.amount.toString(), description: t.description, category: t.category, date: t.date });
    setModalOpen(true);
  };

  // ========== MULTI-SELECT & BULK ==========
  const toggleSelect = (id) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
    setShowBulkBar(n.size > 0);
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      setShowBulkBar(false);
    } else {
      setSelected(new Set(filtered.map(t => t.id)));
      setShowBulkBar(true);
    }
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} transactions?`)) return;
    const ids = Array.from(selected);
    const count = ids.length;
    await supabase.from('transactions').delete().in('id', ids);
    setSelected(new Set()); setShowBulkBar(false);
    fetchTransactions();
    if (addToast) addToast({ type: 'info', title: 'Bulk Delete Complete', message: `${count} transactions removed.` });
    if (refreshInsights) refreshInsights();
  };

  // ========== INLINE EDITING ==========
  const startInlineEdit = (id, field, value) => setInlineEdit({ id, field, value: value.toString() });
  const saveInlineEdit = async () => {
    if (!inlineEdit) return;
    const { id, field, value } = inlineEdit;
    const update = field === 'amount' ? { amount: parseFloat(value) } : { [field]: value };
    await supabase.from('transactions').update(update).eq('id', id);
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...update } : t));
    setInlineEdit(null);
    if (refreshInsights) refreshInsights();
  };
  const handleInlineKey = (e) => { if (e.key === 'Enter') saveInlineEdit(); if (e.key === 'Escape') setInlineEdit(null); };

  // ========== XLSX EXPORT ==========
  const exportXLSX = async () => {
    await loadSheetJS();
    if (!window.XLSX) { alert('Failed to load Excel library'); return; }
    const data = filtered.map(t => ({
      Date: t.date, Description: t.description, Category: t.category,
      Type: t.type, Amount: parseFloat(t.amount),
    }));
    const ws = window.XLSX.utils.json_to_sheet(data);
    // Column widths
    ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 14 }];
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // Add summary sheet
    const summary = [
      ['Plumfolio Financial Summary'],
      [''],
      ['Total Income', fIncome],
      ['Total Expenses', fExpenses],
      ['Net Savings', fIncome - fExpenses],
      ['Transaction Count', filtered.length],
      ['Average Transaction', fAvg],
      ['Largest Transaction', fMax],
      [''],
      ['Category Breakdown'],
      ...Object.entries(filtered.filter(t => t.type === 'expense').reduce((a, t) => {
        a[t.category] = (a[t.category] || 0) + parseFloat(t.amount); return a;
      }, {})).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => [cat, amt]),
    ];
    const ws2 = window.XLSX.utils.aoa_to_sheet(summary);
    ws2['!cols'] = [{ wch: 24 }, { wch: 16 }];
    window.XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    window.XLSX.writeFile(wb, `plumfolio-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ========== CSV EXPORT ==========
  const exportCSV = () => {
    const h = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const rows = filtered.map(t => [t.date, `"${t.description}"`, t.category, t.type, t.amount]);
    const csv = [h.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `plumfolio-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // ========== XLSX IMPORT ==========
  const handleXLSXFile = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    await loadSheetJS();
    if (!window.XLSX) { alert('Failed to load Excel library'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = window.XLSX.read(ev.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
      processImportRows(rawRows, 'xlsx');
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // ========== CSV IMPORT ==========
  const handleCSVFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        setImportErrors(['CSV has no data rows.']);
        setImportData(null); setImportPreview([]); setImportStats(null);
        setImportSource('csv'); setImportModalOpen(true);
        return;
      }
      // Simple CSV parser: split on commas not inside quotes
      const parseCSVLine = (line) => {
        const out = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
          cur += ch;
        }
        out.push(cur);
        return out.map(c => c.trim());
      };
      const headers = parseCSVLine(lines[0]);
      const rawRows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] !== undefined ? cols[idx] : ''; });
        rawRows.push(row);
      }
      processImportRows(rawRows, 'csv');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ========== COMMUNITY LEARNING HELPERS ==========
  // Normalise a merchant string the same way the SQL function does.
  const normaliseMerchantToken = (s) => {
    if (!s) return '';
    return String(s).toLowerCase()
      .replace(/[0-9]+/g, ' ')
      .replace(/[^a-z\s&-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Ask Supabase for crowd-learned categories. Builds a lookup map keyed by normalised merchant.
  // Fails silently if the DB function isn't available yet (e.g. migration not run).
  const prefetchCommunityCategories = async (descriptions) => {
    const map = {};
    const unique = [...new Set(
      descriptions.map(normaliseMerchantToken).filter(t => t.length >= 3)
    )];
    if (unique.length === 0) { setCommunityMap(map); return map; }
    // Fire in parallel, cap concurrency to 10
    const lookup = async (token) => {
      try {
        const { data, error } = await supabase.rpc('lookup_merchant_category', { raw_merchant: token });
        if (!error && data && data.length > 0) {
          map[token] = { category: data[0].category, confidence: parseFloat(data[0].confidence), votes: data[0].votes };
        }
      } catch (e) { /* silently ignore — migration may not be applied */ }
    };
    const chunks = [];
    for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
    for (const chunk of chunks) {
      await Promise.all(chunk.map(lookup));
    }
    setCommunityMap(map);
    return map;
  };

  // Cast one vote for a merchant → category pairing. Fires and forgets.
  const contributeCommunityVote = (merchant, category) => {
    if (!merchant || !category) return;
    try {
      supabase.rpc('vote_for_merchant_category', {
        raw_merchant: merchant,
        raw_category: category,
      }).catch(() => { /* ignore */ });
    } catch (e) { /* ignore */ }
  };

  // ========== SHARED: parse + open review modal ==========
  const processImportRows = async (rawRows, source) => {
    // Build a learning index from the user's existing transactions so we can
    // auto-categorise new descriptions based on past behaviour.
    const historyIndex = buildHistoryIndex(transactions);

    // Prefetch crowd-learned categories from the DB so smartCategorise can use them synchronously.
    const descriptions = rawRows.map(r => {
      // Pull the description from whatever column the parser will detect
      return Object.values(r).find(v => typeof v === 'string' && v.length >= 3) || '';
    });
    await prefetchCommunityCategories(descriptions);

    const result = parseImportRows(rawRows, categories, historyIndex);
    setImportData(result.rows);
    setImportPreview(result.rows.slice(0, 10));
    setImportStats(result.stats);
    setImportErrors(result.errors || []);
    setImportWarnings(result.warnings || []);
    setImportDetected(result.detected || {});
    setImportCurrency(result.currency || null);

    // Work out the default choice based on three states:
    //  A) file currency detected AND matches account → no action needed
    //  B) file currency detected AND differs from account → default to CONVERT
    //  C) no currency detected → ASSUME the numbers are in the user's account currency,
    //     but show a banner so the user can override (import-assume state)
    const detectedCode = result.currency?.code;
    const userCode = currencyCode || 'BWP';
    if (detectedCode && detectedCode === userCode) {
      // A: silent default, no banner
      setImportCurrencyChoice({ action: 'store-as-is', sourceCode: userCode });
    } else if (detectedCode) {
      // B: detected a different currency, default to convert
      setImportCurrencyChoice({ action: 'convert', sourceCode: detectedCode });
    } else {
      // C: unknown currency — assume user's account currency, let them change it
      setImportCurrencyChoice({ action: 'assume', sourceCode: userCode });
    }

    setImportSource(source);
    setShowAllImportRows(false);
    setImportModalOpen(true);
  };

  // ========== SAMPLE TEMPLATE DOWNLOAD ==========
  const downloadTemplate = async (kind) => {
    if (kind === 'csv') {
      const headers = Object.keys(SAMPLE_TEMPLATE_ROWS[0]);
      const csv = [
        headers.join(','),
        ...SAMPLE_TEMPLATE_ROWS.map(r => headers.map(h => r[h]).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'plumfolio-import-template.csv';
      a.click(); URL.revokeObjectURL(url);
    } else {
      await loadSheetJS();
      if (!window.XLSX) return;
      const ws = window.XLSX.utils.json_to_sheet(SAMPLE_TEMPLATE_ROWS);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Template');
      window.XLSX.writeFile(wb, 'plumfolio-import-template.xlsx');
    }
  };

  // ========== update a row's category in the review step ==========
  const updateImportRowCategory = (idx, newCategory) => {
    setImportData(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], category: newCategory, _wasMapped: false };
      return next;
    });
    setImportPreview(prev => {
      const next = [...prev];
      if (idx < next.length) next[idx] = { ...next[idx], category: newCategory, _wasMapped: false };
      return next;
    });
  };

  const doImport = async () => {
    if (!importData || importData.length === 0 || !user) return;
    setImporting(true);
    try {
      // Decide how to convert each row's amount into BWP (storage unit):
      //  - 'store-as-is' → assume BWP already; use amount directly
      //  - 'convert'     → file is in a known non-BWP currency; use live rates
      //  - 'assume'      → file had no symbols; treat all numbers as `choice.sourceCode`
      //                    (which the user may have changed via the dropdown)
      const choice = importCurrencyChoice || { action: 'store-as-is', sourceCode: 'BWP' };
      const inserts = importData.map(r => {
        let bwpAmount = r.amount;
        if (choice.action === 'convert') {
          const rowCode = r._sourceCurrency || choice.sourceCode;
          bwpAmount = convertToBwp(r.amount, rowCode);
        } else if (choice.action === 'assume') {
          // Treat the entire file as the chosen source currency
          bwpAmount = convertToBwp(r.amount, choice.sourceCode);
        }
        return {
          user_id: user.id, date: r.date, description: r.description,
          category: categories.includes(r.category) ? r.category : 'Other',
          type: r.type, amount: bwpAmount,
        };
      });
      await supabase.from('transactions').insert(inserts);
      // Contribute community votes for each merchant the user accepted/edited.
      // This is async but we don't await — fire and forget, no blocking the UI.
      inserts.forEach(t => {
        if (t.description && t.category && t.category !== 'Other') {
          contributeCommunityVote(t.description, t.category);
        }
      });
      // Auto-contribute to matching savings goals (Savings/Investments-tagged rows only)
      for (const t of inserts) {
        await autoContributeToSavingsGoal(t);
      }
      if (addToast) addToast({ type: 'success', title: 'Import Complete', message: `${inserts.length} transactions imported.` });
      setImportModalOpen(false); setImportData(null); setImportPreview([]);
      setImportStats(null); setImportErrors([]); setImportWarnings([]); setImportDetected({});
      setImportCurrency(null); setImportCurrencyChoice(null);
      fetchTransactions();
      if (refreshInsights) refreshInsights();
    } catch (e) {
      if (addToast) addToast({ type: 'warning', title: 'Import Failed', message: e.message });
      else alert('Import failed: ' + e.message);
    }
    finally { setImporting(false); }
  };

  // ========== HELPERS ==========
  const getCategoryIcon = (c) => {
    const icons = { 'Food & Dining': Coffee, 'Housing': Home, 'Transportation': Car, 'Utilities': Zap, 'Education': GraduationCap, 'Income': Wallet, 'Shopping': ShoppingCart, 'Health & Fitness': Heart, 'Entertainment': Film, 'Groceries': ShoppingCart, 'Subscriptions': RefreshCw, 'Savings': Wallet, 'Investments': Briefcase, 'Personal Care': Heart, 'Travel': Car, 'Gifts & Donations': Heart, 'Other': MoreHorizontal };
    return icons[c] || ShoppingCart;
  };
  const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Conditional formatting
  const getAmountClass = (t) => {
    const amt = parseFloat(t.amount);
    if (t.type === 'income') return 'amount-cell income';
    if (amt > 5000) return 'amount-cell expense high-expense';
    if (amt > 1000) return 'amount-cell expense mid-expense';
    return 'amount-cell expense';
  };

  // ========== SCANNER (condensed from original) ==========
  const openScanner = () => { setScannerOpen(true); setScanError(''); setScanSuccess(''); setExtractedData(null); setSelectedFile(null); setPreview(null); };
  const closeScanner = () => { setScannerOpen(false); setSelectedFile(null); setPreview(null); setExtractedData(null); setScanError(''); setScanSuccess(''); setScanning(false); };
  const processFileInput = (file) => { if (!file || !file.type.startsWith('image/') || file.size > 15*1024*1024) return; setSelectedFile(file); setScanError(''); setExtractedData(null); const r = new FileReader(); r.onload = e => setPreview(e.target.result); r.readAsDataURL(file); };
  const handleFileChange = (e) => { if (e.target.files?.[0]) processFileInput(e.target.files[0]); e.target.value = ''; };
  const scoreOCR = (text) => { if (!text || text.length < 10) return -10; let s = 0; const a = text.match(/\d+\.\d{2}/g); if (a) { s += a.length*15; a.forEach(x => { if (parseFloat(x)>1) s+=25; }); } if (/total/i.test(text)) s+=30; if (/P\s*\d+\.\d{2}/i.test(text)) s+=25; return s; };
  const resetScanner = () => { setSelectedFile(null); setPreview(null); setExtractedData(null); setScanError(''); setScanSuccess(''); };

  const scanReceipt = async () => {
    if (!selectedFile || !tesseractReady) return;
    setScanning(true); setScanError('');
    try {
      const img = await new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = () => rej(new Error('Fail')); r.readAsDataURL(selectedFile); });
      const versions = await processReceiptImage(img);
      const results = [];
      for (let i = 0; i < versions.length; i++) {
        setScanStatus(`Scanning ${i+1}/${versions.length}...`);
        const ocr = await window.Tesseract.recognize(versions[i].data, 'eng', { logger: m => { if (m.status === 'recognizing text') setScanProgress(Math.round(((i + m.progress) / versions.length) * 100)); } });
        results.push({ text: ocr.data.text || '', score: scoreOCR(ocr.data.text), label: versions[i].label });
        if (results[results.length-1].score >= 80) break;
      }
      results.sort((a, b) => b.score - a.score);
      if (!results[0].text || results[0].score < 0) { setScanError('Could not read receipt.'); return; }
      const parsed = parseReceiptText(results[0].text);
      if (!parsed) { setScanError('Could not extract details.'); return; }

      // Apply the same smart categorisation waterfall as the import feature:
      // 1) user history  2) generic keywords  3) community crowd-learned  4) merchant DB
      const historyIndex = buildHistoryIndex(transactions);
      const descForCategorisation = `${parsed.merchant || ''} ${parsed.rawText || ''}`.trim();
      // Prefetch community data for this merchant before running the waterfall
      await prefetchCommunityCategories([descForCategorisation]);
      const smart = smartCategorise(descForCategorisation, historyIndex);
      if (smart && categories.includes(smart.category)) {
        // History/community wins (users' real labels beat any heuristic)
        if (smart.source.startsWith('history') || smart.source === 'community' || !parsed.category || parsed.category === 'Other') {
          parsed.category = smart.category;
          parsed._categorySource = smart.source;
        }
      }

      setExtractedData(parsed);
    } catch (err) { setScanError('Scan failed: ' + err.message); }
    finally { setScanning(false); setScanProgress(0); setScanStatus(''); }
  };

  const saveScanned = async () => {
    if (!extractedData || !user || extractedData.total <= 0) return;
    await supabase.from('transactions').insert({ user_id: user.id, type: 'expense', amount: extractedData.total, category: extractedData.category, description: extractedData.merchant, date: extractedData.date });
    // Contribute community vote for this merchant → category pairing
    if (extractedData.merchant && extractedData.category && extractedData.category !== 'Other') {
      contributeCommunityVote(extractedData.merchant, extractedData.category);
    }
    setScanSuccess('Saved!'); fetchTransactions();
    if (addToast) addToast({
      type: 'success',
      title: 'Receipt Scanned & Added',
      message: `${extractedData.merchant} — ${formatCurrency(extractedData.total)} logged to ${extractedData.category}.`
    });
    if (refreshInsights) refreshInsights();
    setTimeout(closeScanner, 1500);
  };

  // ========== RENDER ==========
  if (loading) return <div className="transactions-loading"><div className="spinner" /></div>;

  return (
    <div className="transactions-page">
      {/* Action Bar */}
      <div className="actions-bar">
        <div className="search-bar">
          <Search size={16} />
          <input type="text" placeholder="Search transactions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>}
        </div>
        <div className="action-buttons">
          <button className={`action-btn ${showFormula ? 'active' : ''}`} onClick={() => setShowFormula(!showFormula)} title="Formula Bar">
            <Calculator size={16} /> <span>Formulas</span>
          </button>
          <button className={`action-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} /> <span>Filter</span>
            {hasFilters && <span className="filter-dot" />}
          </button>
          <button className="action-btn" onClick={() => xlsxInputRef.current?.click()} title="Import Excel">
            <FileSpreadsheet size={16} /> <span>Import</span>
          </button>
          <button className="action-btn" onClick={exportXLSX} disabled={filtered.length === 0} title="Export Excel">
            <Download size={16} /> <span>Excel</span>
          </button>
          <button className="action-btn" onClick={exportCSV} disabled={filtered.length === 0} title="Export CSV">
            <FileText size={16} /> <span>CSV</span>
          </button>
          <button className="action-btn scan-receipt-btn" onClick={openScanner}>
            <ScanLine size={16} /> <span>Scan</span>
          </button>
          <button className="action-btn primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> <span>Add</span>
          </button>
        </div>
        <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls" onChange={handleXLSXFile} style={{ display: 'none' }} />
        <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCSVFile} style={{ display: 'none' }} />
      </div>

      {/* Formula Bar */}
      {showFormula && (
        <div className="formula-bar">
          <div className="formula-item"><span className="formula-label">COUNT</span><span className="formula-value">{filtered.length}</span></div>
          <div className="formula-item"><span className="formula-label">SUM</span><span className="formula-value">{formatCurrency(fSum)}</span></div>
          <div className="formula-item"><span className="formula-label">AVG</span><span className="formula-value">{formatCurrency(fAvg)}</span></div>
          <div className="formula-item"><span className="formula-label">MIN</span><span className="formula-value">{formatCurrency(fMin)}</span></div>
          <div className="formula-item"><span className="formula-label">MAX</span><span className="formula-value">{formatCurrency(fMax)}</span></div>
          <div className="formula-sep" />
          <div className="formula-item income-formula"><span className="formula-label">INCOME</span><span className="formula-value">{formatCurrency(fIncome)}</span></div>
          <div className="formula-item expense-formula"><span className="formula-label">EXPENSES</span><span className="formula-value">{formatCurrency(fExpenses)}</span></div>
          <div className="formula-item net-formula"><span className="formula-label">NET</span><span className="formula-value">{formatCurrency(fIncome - fExpenses)}</span></div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label>Type</label>
              <div className="filter-tabs compact">
                {['all', 'income', 'expense'].map(f => (
                  <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group"><label>Category</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-group"><label>From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div className="filter-group"><label>To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
            <div className="filter-group"><label>Min Amt</label><input type="number" placeholder="0" value={amountMin} onChange={e => setAmountMin(e.target.value)} /></div>
            <div className="filter-group"><label>Max Amt</label><input type="number" placeholder="∞" value={amountMax} onChange={e => setAmountMax(e.target.value)} /></div>
            {hasFilters && <button className="clear-filters-btn" onClick={clearFilters}><X size={14} /> Clear</button>}
          </div>
          <div className="filter-summary">
            {filtered.length} of {transactions.length} transactions
            <span className="summary-income"> • Income: {formatCurrency(fIncome)}</span>
            <span className="summary-expense"> • Expenses: {formatCurrency(fExpenses)}</span>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {showBulkBar && (
        <div className="bulk-bar">
          <span>{selected.size} selected</span>
          <button className="bulk-btn delete" onClick={bulkDelete}><Trash2 size={14} /> Delete Selected</button>
          <button className="bulk-btn" onClick={() => { setSelected(new Set()); setShowBulkBar(false); }}><X size={14} /> Cancel</button>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="transactions-table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th className="check-col"><button className="check-btn" onClick={toggleSelectAll}>{selected.size === filtered.length && filtered.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}</button></th>
                <th onClick={() => handleSort('date')} className="sortable">Date <SortIcon field="date" /></th>
                <th onClick={() => handleSort('description')} className="sortable">Description <SortIcon field="description" /></th>
                <th onClick={() => handleSort('category')} className="sortable">Category <SortIcon field="category" /></th>
                <th onClick={() => handleSort('type')} className="sortable">Type <SortIcon field="type" /></th>
                <th onClick={() => handleSort('amount')} className="sortable">Amount <SortIcon field="amount" /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const Icon = getCategoryIcon(t.category);
                const isSelected = selected.has(t.id);
                return (
                  <tr key={t.id} className={isSelected ? 'row-selected' : ''}>
                    <td className="check-col"><button className="check-btn" onClick={() => toggleSelect(t.id)}>{isSelected ? <CheckSquare size={16} /> : <Square size={16} />}</button></td>
                    <td className="date-cell">
                      {inlineEdit?.id === t.id && inlineEdit.field === 'date' ? (
                        <input type="date" className="inline-input" value={inlineEdit.value} onChange={e => setInlineEdit({...inlineEdit, value: e.target.value})} onBlur={saveInlineEdit} onKeyDown={handleInlineKey} autoFocus />
                      ) : <span onDoubleClick={() => startInlineEdit(t.id, 'date', t.date)}>{formatDate(t.date)}</span>}
                    </td>
                    <td className="desc-cell">
                      {inlineEdit?.id === t.id && inlineEdit.field === 'description' ? (
                        <input type="text" className="inline-input" value={inlineEdit.value} onChange={e => setInlineEdit({...inlineEdit, value: e.target.value})} onBlur={saveInlineEdit} onKeyDown={handleInlineKey} autoFocus />
                      ) : <div className="desc-wrapper" onDoubleClick={() => startInlineEdit(t.id, 'description', t.description)}><div className="transaction-icon"><Icon size={16} /></div><span>{t.description}</span></div>}
                    </td>
                    <td>
                      {inlineEdit?.id === t.id && inlineEdit.field === 'category' ? (
                        <select className="inline-select" value={inlineEdit.value} onChange={e => setInlineEdit({...inlineEdit, value: e.target.value})} onBlur={saveInlineEdit} autoFocus>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : <span className="category-badge" onDoubleClick={() => startInlineEdit(t.id, 'category', t.category)}>{t.category}</span>}
                    </td>
                    <td><span className={`type-badge ${t.type}`}>{t.type === 'income' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}{t.type}</span></td>
                    <td className={getAmountClass(t)}>
                      {inlineEdit?.id === t.id && inlineEdit.field === 'amount' ? (
                        <input type="number" step="0.01" className="inline-input amount" value={inlineEdit.value} onChange={e => setInlineEdit({...inlineEdit, value: e.target.value})} onBlur={saveInlineEdit} onKeyDown={handleInlineKey} autoFocus />
                      ) : <span onDoubleClick={() => startInlineEdit(t.id, 'amount', t.amount)}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</span>}
                    </td>
                    <td className="actions-cell">
                      <button className="row-action edit" onClick={() => handleEdit(t)}><Edit size={16} /></button>
                      <button className="row-action delete" onClick={() => handleDelete(t.id)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state-container"><div className="empty-state">
          <Receipt size={64} strokeWidth={1} />
          <h3>{hasFilters ? 'No matching transactions' : 'No transactions yet'}</h3>
          <p>{hasFilters ? 'Try adjusting your filters' : 'Start tracking your finances'}</p>
          <div className="empty-state-actions">
            {hasFilters && <button className="empty-action-btn" onClick={clearFilters}><X size={18} /> Clear Filters</button>}
            <button className="empty-action-btn" onClick={openScanner}><ScanLine size={18} /> Scan Receipt</button>
            <button className="empty-action-btn primary" onClick={() => setModalOpen(true)}><Plus size={18} /> Add Transaction</button>
          </div>
        </div></div>
      )}

      {/* Mobile FABs */}
      <div className="fab-group">
        <button className="fab fab-scan" onClick={openScanner}><ScanLine size={22} /></button>
        <button className="fab fab-add" onClick={() => setModalOpen(true)}><Plus size={24} /></button>
      </div>

      {/* Add/Edit Modal - rendered via Portal */}
      {modalOpen && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => { setModalOpen(false); setEditingTransaction(null); setFormErrors({}); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editingTransaction ? 'Edit' : 'Add'} Transaction</h2><button className="modal-close" onClick={() => { setModalOpen(false); setEditingTransaction(null); setFormErrors({}); }}><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="modal-form" noValidate>
              <div className="type-selector">
                <button type="button" className={`type-btn ${formData.type === 'income' ? 'active income' : ''}`} onClick={() => setFormData({...formData, type: 'income'})}><ArrowUpCircle size={20} /> Income</button>
                <button type="button" className={`type-btn ${formData.type === 'expense' ? 'active expense' : ''}`} onClick={() => setFormData({...formData, type: 'expense'})}><ArrowDownCircle size={20} /> Expense</button>
              </div>
              <div className={`form-group ${formErrors.amount ? 'has-error' : ''}`}>
                <label>Amount (P)</label>
                <input type="number" value={formData.amount} onChange={e => { setFormData({...formData, amount: e.target.value}); if (formErrors.amount) setFormErrors({...formErrors, amount: ''}); }} placeholder="0.00" min="0" step="0.01" />
                {formErrors.amount ? <span className="field-error">{formErrors.amount}</span> : <span className="field-hint">Max 2 decimal places, up to P10,000,000</span>}
              </div>
              <div className={`form-group ${formErrors.description ? 'has-error' : ''}`}>
                <label>Description</label>
                <input type="text" value={formData.description} onChange={e => { setFormData({...formData, description: e.target.value}); if (formErrors.description) setFormErrors({...formErrors, description: ''}); }} placeholder="Enter description" maxLength={100} />
                {formErrors.description ? <span className="field-error">{formErrors.description}</span> : <span className="field-hint">2-100 characters describing this transaction</span>}
              </div>
              <div className={`form-group ${formErrors.category ? 'has-error' : ''}`}>
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                {formErrors.category ? <span className="field-error">{formErrors.category}</span> : <span className="field-hint">Choose the closest match for better insights</span>}
              </div>
              <div className={`form-group ${formErrors.date ? 'has-error' : ''}`}>
                <label>Date</label>
                <input type="date" value={formData.date} onChange={e => { setFormData({...formData, date: e.target.value}); if (formErrors.date) setFormErrors({...formErrors, date: ''}); }} />
                {formErrors.date ? <span className="field-error">{formErrors.date}</span> : <span className="field-hint">Cannot be in the future or more than 10 years ago</span>}
              </div>
              <button type="submit" className="submit-btn">{editingTransaction ? 'Save Changes' : 'Add Transaction'}</button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Import Modal - rendered via Portal */}
      {importModalOpen && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="modal import-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FileSpreadsheet size={20} /> Import from {importSource.toUpperCase()}</h2>
              <button className="modal-close" onClick={() => setImportModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="import-body">
              {/* Error state */}
              {importErrors.length > 0 && (
                <div className="import-error-box">
                  <div className="import-error-title"><AlertCircle size={16} /> We couldn't read this file</div>
                  <ul>{importErrors.map((er, i) => <li key={i}>{er}</li>)}</ul>
                  <div className="import-help">
                    <p>Your file needs at least a <strong>Date</strong> column and an <strong>Amount</strong> (or Debit/Credit) column.</p>
                    <p>We accept many variations of column names — see the template:</p>
                    <div className="import-template-actions">
                      <button className="action-btn" onClick={() => downloadTemplate('csv')}><Download size={14} /> CSV template</button>
                      <button className="action-btn" onClick={() => downloadTemplate('xlsx')}><Download size={14} /> Excel template</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Success state */}
              {importErrors.length === 0 && importStats && (
                <>
                  <div className="import-stats">
                    <div className="import-stat">
                      <span className="import-stat-value">{importStats.valid}</span>
                      <span className="import-stat-label">will be imported</span>
                    </div>
                    {importStats.skipped > 0 && (
                      <div className="import-stat">
                        <span className="import-stat-value" style={{ color: '#f59e0b' }}>{importStats.skipped}</span>
                        <span className="import-stat-label">skipped (invalid)</span>
                      </div>
                    )}
                    {importStats.mapped > 0 && (
                      <div className="import-stat">
                        <span className="import-stat-value" style={{ color: '#A855F7' }}>{importStats.mapped}</span>
                        <span className="import-stat-label">auto-mapped categories</span>
                      </div>
                    )}
                    {importStats.autoCategorised > 0 && (
                      <div className="import-stat">
                        <span className="import-stat-value" style={{ color: '#A855F7' }}>{importStats.autoCategorised}</span>
                        <span className="import-stat-label">auto-categorised from description</span>
                      </div>
                    )}
                  </div>

                  {/* Column detection summary */}
                  {Object.keys(importDetected).length > 0 && (
                    <div className="import-detected">
                      <strong>Detected columns:</strong>
                      {' '}{Object.entries(importDetected).map(([k, v]) => (
                        <span key={k} className="import-col-tag">{k} → "{v}"</span>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {importWarnings.length > 0 && (
                    <details className="import-warnings">
                      <summary>{importWarnings.length} rows skipped — click to see why</summary>
                      <ul>{importWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </details>
                  )}

                  {/* Currency banner: detected file currency differs from account */}
                  {importCurrency && importCurrency.code && importCurrency.code !== (currencyCode || 'BWP') && (
                    <div className="import-currency-banner">
                      <div className="import-currency-banner-title">
                        <AlertCircle size={16} />
                        This file appears to be in <strong>{importCurrency.code}</strong>, but your account is set to <strong>{currencyCode || 'BWP'}</strong>.
                        {importCurrency.mixed && <span className="import-currency-mixed"> (file contains multiple currencies — the dominant one is shown)</span>}
                      </div>
                      <div className="import-currency-choices">
                        <label className={`import-currency-choice ${importCurrencyChoice?.action === 'convert' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="currency-choice"
                            checked={importCurrencyChoice?.action === 'convert'}
                            onChange={() => setImportCurrencyChoice({ action: 'convert', sourceCode: importCurrency.code })}
                          />
                          <div>
                            <div className="import-currency-choice-title">Convert to {currencyCode || 'BWP'}</div>
                            <div className="import-currency-choice-desc">
                              Use live exchange rate{getRate && getRate(importCurrency.code) ? ` (1 ${importCurrency.code} ≈ ${(1 / getRate(importCurrency.code)).toFixed(2)} BWP)` : ''}
                            </div>
                          </div>
                        </label>
                        <label className={`import-currency-choice ${importCurrencyChoice?.action === 'store-as-is' ? 'active' : ''}`}>
                          <input
                            type="radio"
                            name="currency-choice"
                            checked={importCurrencyChoice?.action === 'store-as-is'}
                            onChange={() => setImportCurrencyChoice({ action: 'store-as-is', sourceCode: currencyCode || 'BWP' })}
                          />
                          <div>
                            <div className="import-currency-choice-title">Import as-is</div>
                            <div className="import-currency-choice-desc">Treat numbers as {currencyCode || 'BWP'}, no conversion</div>
                          </div>
                        </label>
                      </div>
                      {!ratesLoaded && importCurrencyChoice?.action === 'convert' && (
                        <div className="import-currency-loading"><Loader size={12} className="spin" /> Loading exchange rates…</div>
                      )}
                    </div>
                  )}

                  {/* Currency banner: no currency detected in file — ask user to confirm */}
                  {importCurrency && !importCurrency.code && importCurrencyChoice?.action === 'assume' && (
                    <div className="import-currency-banner import-currency-banner-info">
                      <div className="import-currency-banner-title">
                        <AlertCircle size={16} />
                        No currency symbols were found in this file. We'll treat the numbers as <strong>{importCurrencyChoice.sourceCode}</strong> (your account currency). Change this if the file is actually in a different currency.
                      </div>
                      <div className="import-currency-assume-row">
                        <label>File currency:</label>
                        <select
                          value={importCurrencyChoice.sourceCode}
                          onChange={e => setImportCurrencyChoice({
                            action: 'assume',
                            sourceCode: e.target.value,
                          })}
                          className="import-currency-select"
                        >
                          {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code} — {c.name}
                            </option>
                          ))}
                        </select>
                        {importCurrencyChoice.sourceCode !== (currencyCode || 'BWP') && getRate && getRate(importCurrencyChoice.sourceCode) && (
                          <span className="import-currency-rate-hint">
                            1 {importCurrencyChoice.sourceCode} ≈ {(1 / getRate(importCurrencyChoice.sourceCode)).toFixed(2)} BWP
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Preview with editable categories */}
                  {importData && importData.length > 0 && (
                    <>
                      <div className="import-preview-header">
                        <p className="import-info">
                          {showAllImportRows
                            ? `Showing all ${importData.length} rows — review before importing:`
                            : `Preview (first ${Math.min(10, importData.length)} of ${importData.length} rows) — review before importing:`}
                        </p>
                        {importData.length > 10 && (
                          <button
                            type="button"
                            className="import-toggle-btn"
                            onClick={() => setShowAllImportRows(v => !v)}
                          >
                            {showAllImportRows ? 'Show less' : `Show all ${importData.length}`}
                          </button>
                        )}
                      </div>
                      <div className={`import-preview ${showAllImportRows ? 'expanded' : ''}`}>
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(showAllImportRows ? importData : importData.slice(0, 10)).map((r, i) => (
                              <tr key={i} className={r._wasMapped ? 'row-remapped' : ''}>
                                <td>{r.date}</td>
                                <td title={r.description}>{r.description || <em style={{ opacity: 0.5 }}>no description</em>}</td>
                                <td>
                                  <select
                                    value={r.category}
                                    onChange={e => updateImportRowCategory(i, e.target.value)}
                                    className="import-category-select"
                                  >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                  {r._wasMapped && r._originalCategory && (
                                    <span className="import-remap-note" title={`Original: "${r._originalCategory}"`}>↺</span>
                                  )}
                                  {r._categorySource === 'history-exact' && (
                                    <span className="import-cat-badge badge-history" title="Learned from your past transactions (exact match)"><Star size={11} /> history</span>
                                  )}
                                  {r._categorySource === 'history-fuzzy' && (
                                    <span className="import-cat-badge badge-history" title="Pattern-matched from your past transactions"><Star size={11} /> history</span>
                                  )}
                                  {r._categorySource === 'keyword' && (
                                    <span className="import-cat-badge badge-keyword" title="Detected from description keywords"><Sparkles size={11} /> auto</span>
                                  )}
                                  {r._categorySource === 'community' && (
                                    <span className="import-cat-badge badge-community" title="Crowd-learned from other Plumfolio users"><Users size={11} /> community</span>
                                  )}
                                  {r._categorySource === 'merchant-db' && (
                                    <span className="import-cat-badge badge-merchant" title="Matched against known merchants"><Tag size={11} /> known</span>
                                  )}
                                </td>
                                <td><span className={`type-badge ${r.type}`}>{r.type}</span></td>
                                <td className={r.type === 'income' ? 'amount-income' : 'amount-expense'}>
                                  {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}
                                </td>
                              </tr>
                            ))}
                            {!showAllImportRows && importData.length > 10 && (
                              <tr>
                                <td colSpan="5" className="import-more">
                                  <button
                                    type="button"
                                    className="import-more-btn"
                                    onClick={() => setShowAllImportRows(true)}
                                  >
                                    Show {importData.length - 10} more rows
                                  </button>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <div className="import-actions">
                    <button className="submit-btn" onClick={doImport} disabled={importing || !importData || importData.length === 0}>
                      {importing ? <><Loader size={16} className="spin" /> Importing...</> : <><Upload size={16} /> Import {importData?.length || 0}</>}
                    </button>
                    <button className="cancel-btn" onClick={() => setImportModalOpen(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Scanner Modal - rendered via Portal to escape overflow containers */}
      {scannerOpen && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={closeScanner}><div className="modal scanner-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header"><div className="scanner-modal-title"><ScanLine size={20} /><h2>Scan Receipt</h2></div><button className="modal-close" onClick={closeScanner}><X size={20} /></button></div>
          <div className="scanner-modal-body">
            {scanSuccess && <div className="scan-msg scan-msg-success"><Check size={16} />{scanSuccess}</div>}
            {scanError && <div className="scan-msg scan-msg-error"><AlertCircle size={16} />{scanError}<button onClick={() => setScanError('')}><X size={14} /></button></div>}
            {!extractedData && <div className="scan-upload-area">
              {preview ? <div className="scan-preview-wrapper"><img src={preview} alt="Receipt" className="scan-preview-img" /><button className="scan-preview-remove" onClick={resetScanner}><X size={14} /></button></div>
              : <div className="scan-dropzone" onClick={() => fileInputRef.current?.click()}><ScanLine size={32} className="scan-dropzone-icon" /><p className="scan-dropzone-text">{isMobile ? 'Tap to select' : 'Click to upload'}</p></div>}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{display:'none'}} />
              {!preview && <div className="scan-btn-row">{isMobile && <button className="scan-action-btn scan-camera" onClick={() => cameraInputRef.current?.click()}><Camera size={16} /> Photo</button>}<button className="scan-action-btn scan-gallery" onClick={() => fileInputRef.current?.click()}><Image size={16} /> Upload</button></div>}
              {preview && <div className="scan-go-row"><button className="scan-go-btn" onClick={scanReceipt} disabled={scanning || !tesseractReady}>{scanning ? <><Loader size={16} className="spin" /> {scanStatus || scanProgress+'%'}</> : <><FileText size={16} /> Scan</>}</button>{scanning && <div className="scan-progress"><div className="scan-progress-fill" style={{width:`${Math.max(scanProgress,3)}%`}} /></div>}</div>}
            </div>}
            {extractedData && <div className="scan-result">
              <div className="scan-result-header"><Check size={16} />Review & Save</div>
              <div className="scan-fields">
                <div className="scan-field"><label>Merchant</label><input type="text" value={extractedData.merchant} onChange={e => setExtractedData({...extractedData, merchant: e.target.value})} /></div>
                <div className="scan-field-row"><div className="scan-field"><label>Date</label><input type="date" value={extractedData.date} onChange={e => setExtractedData({...extractedData, date: e.target.value})} /></div><div className="scan-field"><label>Total</label><input type="number" step="0.01" value={extractedData.total} onChange={e => setExtractedData({...extractedData, total: parseFloat(e.target.value)||0})} /></div></div>
                <div className="scan-field"><label>Category</label><select value={extractedData.category} onChange={e => setExtractedData({...extractedData, category: e.target.value})}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
              <div className="scan-result-actions"><button className="scan-save-btn" onClick={saveScanned}><Plus size={16} /> Save</button><button className="scan-retry-btn" onClick={resetScanner}>Try Another</button></div>
            </div>}
          </div>
        </div></div>,
        document.body
      )}
    </div>
  );
};

export default Transactions;
