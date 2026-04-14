import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { useInsights } from '../context/InsightsContext';
import { parseReceiptText, detectCategory as receiptDetectCategory } from '../utils/receiptParser';
import processReceiptImage from '../utils/imageProcessor';
import { validateTransactionForm } from '../utils/validation';
import { parseImportRows, SAMPLE_TEMPLATE_ROWS, buildHistoryIndex, setReceiptDetectCategory } from '../utils/importParser';

setReceiptDetectCategory(receiptDetectCategory);

import {
  Plus, Filter, Download, Upload, X, ArrowUpCircle, ArrowDownCircle,
  Coffee, Home, Car, Zap, GraduationCap, ShoppingCart, Wallet,
  Heart, Film, MoreHorizontal, Trash2, Edit, Receipt, Camera, FileText,
  Check, Loader, AlertCircle, Image, ScanLine, Calendar, DollarSign,
  Star, ChevronDown, ChevronRight, Search, RefreshCw, TrendingUp, TrendingDown
} from 'lucide-react';
import './Transactions.css';

const Transactions = () => {
  const { user } = useAuth();
  const { formatCurrency, symbol, currencyCode, convertToBwp } = useCurrency();
  const { addToast, refreshInsights } = useInsights();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense', amount: '', description: '',
    category: 'Food & Dining', date: new Date().toISOString().split('T')[0],
  });
  const [formErrors, setFormErrors] = useState({});

  // Start with all categories collapsed - will be populated after transactions load
  const [collapsedCategories, setCollapsedCategories] = useState(new Set(categories));

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
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
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const categories = [
    'Food & Dining', 'Transportation', 'Housing', 'Utilities',
    'Entertainment', 'Shopping', 'Health & Fitness', 'Education',
    'Groceries', 'Subscriptions', 'Savings', 'Investments',
    'Gifts & Donations', 'Personal Care', 'Travel', 'Income', 'Other',
  ];

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

  useEffect(() => {
    if (!user) return;
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (!error) setTransactions(data || []);
      setLoading(false);
    };
    fetchTransactions();
  }, [user]);

  const hasFilters = filter !== 'all' || categoryFilter !== 'all' || dateFrom || dateTo || searchQuery;

  const filtered = transactions.filter(t => {
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

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netAmount = totalIncome - totalExpenses;

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
    const errors = validateTransactionForm(formData);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    
    const payload = {
      user_id: user.id,
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description.trim(),
      category: formData.category,
      date: formData.date,
    };

    if (editingTransaction) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editingTransaction.id);
      if (!error) {
        setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...t, ...payload } : t));
        if (addToast) addToast({ type: 'success', title: 'Updated', message: 'Transaction updated' });
      }
    } else {
      const { data, error } = await supabase.from('transactions').insert([payload]).select();
      if (!error && data) {
        setTransactions(prev => [data[0], ...prev]);
        if (addToast) addToast({ type: 'success', title: 'Added', message: 'Transaction added' });
      }
    }
    
    setModalOpen(false);
    setEditingTransaction(null);
    setFormData({ type: 'expense', amount: '', description: '', category: 'Food & Dining', date: new Date().toISOString().split('T')[0] });
    setFormErrors({});
    if (refreshInsights) refreshInsights();
  };

  const handleEdit = (t) => {
    setEditingTransaction(t);
    setFormData({ type: t.type, amount: t.amount.toString(), description: t.description, category: t.category, date: t.date });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      if (addToast) addToast({ type: 'info', title: 'Deleted', message: 'Transaction removed' });
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
    if (!selectedFile || !window.Tesseract) return;
    setScanning(true); setScanError(''); setScanProgress(0); setScanStatus('Processing...');
    try {
      const processedBlob = await processReceiptImage(selectedFile);
      setScanStatus('Reading...'); setScanProgress(30);
      const result = await window.Tesseract.recognize(processedBlob, 'eng', {
        logger: (m) => { if (m.status === 'recognizing text') setScanProgress(30 + Math.round(m.progress * 60)); },
      });
      setScanProgress(95); setScanStatus('Extracting...');
      const parsed = parseReceiptText(result.data.text);
      if (parsed) {
        setExtractedData({
          merchant: parsed.merchant || 'Unknown',
          date: parsed.date || new Date().toISOString().split('T')[0],
          total: parsed.total || 0,
          category: parsed.category || 'Other',
        });
        setScanSuccess('Receipt scanned!');
      } else { setScanError('Could not extract data'); }
    } catch (err) { setScanError('Scan failed: ' + err.message); }
    finally { setScanning(false); setScanProgress(100); }
  };

  const saveScanned = async () => {
    if (!extractedData) return;
    const payload = {
      user_id: user.id, type: 'expense', amount: extractedData.total,
      description: extractedData.merchant, category: extractedData.category, date: extractedData.date,
    };
    const { data, error } = await supabase.from('transactions').insert([payload]).select();
    if (!error && data) {
      setTransactions(prev => [data[0], ...prev]);
      if (addToast) addToast({ type: 'success', title: 'Saved', message: `Added ${extractedData.merchant}` });
      closeScanner();
      if (refreshInsights) refreshInsights();
    }
  };

  const handleXLSXFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await loadSheetJS();
    if (!window.XLSX) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = window.XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
        processImportRows(rows);
      } catch (err) { setImportErrors(['Failed to read file']); setImportModalOpen(true); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const processImportRows = (rows) => {
    const historyIndex = buildHistoryIndex(transactions);
    const result = parseImportRows(rows, historyIndex);
    setImportErrors(result.errors || []);
    if (result.rows && result.rows.length > 0) setImportData(result.rows);
    else setImportData(null);
    setImportModalOpen(true);
  };

  const doImport = async () => {
    if (!importData || importData.length === 0) return;
    setImporting(true);
    const rowsToInsert = importData.map(r => ({
      user_id: user.id, type: r.type, amount: r.amount,
      description: r.description || '', category: r.category, date: r.date,
    }));
    const { data, error } = await supabase.from('transactions').insert(rowsToInsert).select();
    if (!error && data) {
      setTransactions(prev => [...data, ...prev]);
      if (addToast) addToast({ type: 'success', title: 'Imported', message: `${data.length} transactions` });
      setImportModalOpen(false); setImportData(null);
      if (refreshInsights) refreshInsights();
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

  return (
    <div className="tx-page">
      {/* Summary Cards */}
      <div className="tx-summary">
        <div className="tx-card income">
          <div className="tx-card-icon"><TrendingUp size={20} /></div>
          <div className="tx-card-info">
            <span className="tx-card-label">Income</span>
            <span className="tx-card-value">+{formatCurrency(totalIncome)}</span>
          </div>
        </div>
        <div className="tx-card expense">
          <div className="tx-card-icon"><TrendingDown size={20} /></div>
          <div className="tx-card-info">
            <span className="tx-card-label">Expenses</span>
            <span className="tx-card-value">-{formatCurrency(totalExpenses)}</span>
          </div>
        </div>
        <div className="tx-card net">
          <div className="tx-card-icon"><Wallet size={20} /></div>
          <div className="tx-card-info">
            <span className="tx-card-label">Net</span>
            <span className={`tx-card-value ${netAmount >= 0 ? 'pos' : 'neg'}`}>
              {netAmount >= 0 ? '+' : ''}{formatCurrency(netAmount)}
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
          <button className={`tx-btn ${showFilters ? 'on' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} />{hasFilters && <span className="dot" />}
          </button>
          <button className="tx-btn" onClick={() => xlsxInputRef.current?.click()}><Upload size={16} /></button>
          <button className="tx-btn" onClick={exportCSV} disabled={filtered.length === 0}><Download size={16} /></button>
          <button className="tx-btn scan" onClick={openScanner}><ScanLine size={16} /></button>
          <button className="tx-btn add" onClick={() => setModalOpen(true)}><Plus size={18} /></button>
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
        <div className="tx-overlay" onClick={() => { setModalOpen(false); setEditingTransaction(null); setFormErrors({}); }}>
          <div className="tx-modal" onClick={e => e.stopPropagation()}>
            <div className="tx-modal-head">
              <h2>{editingTransaction ? 'Edit' : 'Add'} Transaction</h2>
              <button onClick={() => { setModalOpen(false); setEditingTransaction(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="tx-modal-form">
              <div className="tx-type-toggle">
                <button type="button" className={formData.type === 'expense' ? 'on expense' : ''} onClick={() => setFormData({...formData, type: 'expense'})}>
                  <ArrowDownCircle size={18} /> Expense
                </button>
                <button type="button" className={formData.type === 'income' ? 'on income' : ''} onClick={() => setFormData({...formData, type: 'income'})}>
                  <ArrowUpCircle size={18} /> Income
                </button>
              </div>
              <div className="tx-field">
                <label>Amount</label>
                <div className="tx-amt-input">
                  <span>{symbol}</span>
                  <input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="0.00" />
                </div>
                {formErrors.amount && <span className="tx-err">{formErrors.amount}</span>}
              </div>
              <div className="tx-field">
                <label>Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="What was this for?" />
                {formErrors.description && <span className="tx-err">{formErrors.description}</span>}
              </div>
              <div className="tx-field-row">
                <div className="tx-field">
                  <label>Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="tx-field">
                  <label>Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
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
                  <div className="tx-scan-result-head"><Check size={16} /> Review & Save</div>
                  <div className="tx-scan-fields">
                    <div className="tx-field">
                      <label>Merchant</label>
                      <input type="text" value={extractedData.merchant} onChange={e => setExtractedData({...extractedData, merchant: e.target.value})} />
                    </div>
                    <div className="tx-field-row">
                      <div className="tx-field">
                        <label>Date</label>
                        <input type="date" value={extractedData.date} onChange={e => setExtractedData({...extractedData, date: e.target.value})} />
                      </div>
                      <div className="tx-field">
                        <label>Total</label>
                        <div className="tx-amt-input">
                          <span>{symbol}</span>
                          <input type="number" step="0.01" value={extractedData.total} onChange={e => setExtractedData({...extractedData, total: parseFloat(e.target.value)||0})} />
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
      {importModalOpen && ReactDOM.createPortal(
        <div className="tx-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="tx-modal import" onClick={e => e.stopPropagation()}>
            <div className="tx-modal-head">
              <h2><Upload size={20} /> Import</h2>
              <button onClick={() => setImportModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="tx-import-body">
              {importErrors.length > 0 ? (
                <div className="tx-msg error"><AlertCircle size={16} /> Could not read file</div>
              ) : importData && importData.length > 0 ? (
                <>
                  <p className="tx-import-stat">{importData.length} transactions ready</p>
                  <div className="tx-import-preview">
                    {importData.slice(0, 5).map((r, i) => (
                      <div key={i} className="tx-import-row">
                        <span>{r.date}</span>
                        <span>{r.description}</span>
                        <span className={r.type}>{r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}</span>
                      </div>
                    ))}
                    {importData.length > 5 && <p className="tx-import-more">+{importData.length - 5} more</p>}
                  </div>
                  <button className="tx-import-btn" onClick={doImport} disabled={importing}>
                    {importing ? <><Loader size={16} className="spin" /> Importing...</> : <><Upload size={16} /> Import All</>}
                  </button>
                </>
              ) : <p>No valid data found</p>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Transactions;
