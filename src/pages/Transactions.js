import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { parseReceiptText } from '../utils/receiptParser';
import processReceiptImage from '../utils/imageProcessor';
import {
  Plus, Filter, Download, Upload, X, ArrowUpCircle, ArrowDownCircle,
  Coffee, Home, Car, Zap, GraduationCap, ShoppingCart, Wallet, Briefcase,
  Heart, Film, MoreHorizontal, Trash2, Edit, Receipt, Camera, FileText,
  Check, Loader, AlertCircle, Image, ScanLine, Tag, Calendar, DollarSign,
  Search, ArrowUp, ArrowDown, RefreshCw, ChevronDown, Save
} from 'lucide-react';
import './Transactions.css';

const Transactions = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense', amount: '', description: '',
    category: 'Food & Dining', date: new Date().toISOString().split('T')[0],
    is_recurring: false, recurring_interval: 'monthly',
  });

  // Inline editing
  const [inlineEdit, setInlineEdit] = useState(null); // { id, field, value }

  // CSV import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [csvData, setCsvData] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef(null);

  // Scanner state
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
    'Gifts & Donations', 'Personal Care', 'Travel',
    'Income', 'Other',
  ];

  const recurringIntervals = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  // Mobile check
  useEffect(() => {
    const check = () => {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const touch = 'ontouchstart' in window;
      setIsMobile(mobile || (touch && window.innerWidth < 1024));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Tesseract lazy load
  useEffect(() => {
    if (!scannerOpen) return;
    if (window.Tesseract) { setTesseractReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = () => setTesseractReady(true);
    script.onerror = () => setScanError('Failed to load OCR engine.');
    document.head.appendChild(script);
  }, [scannerOpen]);

  // Fetch data
  useEffect(() => {
    if (user) fetchTransactions();
    else setLoading(false);
  }, [user?.id]);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions').select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching:', error);
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // FILTERING & SORTING
  // =====================
  const filteredTransactions = transactions
    .filter(t => {
      if (filter !== 'all' && t.type !== filter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.description.toLowerCase().includes(q) &&
            !t.category.toLowerCase().includes(q) &&
            !t.amount.toString().includes(q)) return false;
      }
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      return true;
    })
    .sort((a, b) => {
      let valA, valB;
      if (sortField === 'date') { valA = a.date; valB = b.date; }
      else if (sortField === 'amount') { valA = parseFloat(a.amount); valB = parseFloat(b.amount); }
      else if (sortField === 'description') { valA = a.description.toLowerCase(); valB = b.description.toLowerCase(); }
      else if (sortField === 'category') { valA = a.category; valB = b.category; }
      else if (sortField === 'type') { valA = a.type; valB = b.type; }
      else { valA = a.date; valB = b.date; }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={12} className="sort-icon inactive" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="sort-icon active" />
      : <ArrowDown size={12} className="sort-icon active" />;
  };

  const clearFilters = () => {
    setSearchQuery(''); setDateFrom(''); setDateTo('');
    setCategoryFilter('all'); setFilter('all');
  };

  const hasActiveFilters = searchQuery || dateFrom || dateTo || categoryFilter !== 'all' || filter !== 'all';

  // Stats
  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);

  // =====================
  // CRUD
  // =====================
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        type: formData.type,
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        date: formData.date,
      };
      if (editingTransaction) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editingTransaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('transactions').insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
      setModalOpen(false);
      setEditingTransaction(null);
      setFormData({ type: 'expense', amount: '', description: '', category: 'Food & Dining', date: new Date().toISOString().split('T')[0], is_recurring: false, recurring_interval: 'monthly' });
      fetchTransactions();
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await supabase.from('transactions').delete().eq('id', id);
      fetchTransactions();
    } catch (error) { console.error('Delete error:', error); }
  };

  const handleEdit = (t) => {
    setEditingTransaction(t);
    setFormData({ type: t.type, amount: t.amount.toString(), description: t.description, category: t.category, date: t.date, is_recurring: false, recurring_interval: 'monthly' });
    setModalOpen(true);
  };

  // =====================
  // INLINE EDITING
  // =====================
  const startInlineEdit = (id, field, value) => {
    setInlineEdit({ id, field, value: value.toString() });
  };

  const saveInlineEdit = async () => {
    if (!inlineEdit) return;
    const { id, field, value } = inlineEdit;
    try {
      const update = {};
      if (field === 'amount') update.amount = parseFloat(value);
      else update[field] = value;
      const { error } = await supabase.from('transactions').update(update).eq('id', id);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...update } : t));
    } catch (e) { console.error('Inline save error:', e); }
    setInlineEdit(null);
  };

  const cancelInlineEdit = () => setInlineEdit(null);

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') saveInlineEdit();
    if (e.key === 'Escape') cancelInlineEdit();
  };

  // =====================
  // CSV EXPORT
  // =====================
  const exportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
    const rows = filteredTransactions.map(t => [t.date, `"${t.description}"`, t.category, t.type, t.amount]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plumfolio-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =====================
  // CSV IMPORT
  // =====================
  const handleCSVFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { alert('CSV file is empty or has no data rows.'); return; }
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!cols) continue;
        const clean = cols.map(c => c.replace(/^"|"$/g, '').trim());
        const row = {};
        headers.forEach((h, idx) => { row[h] = clean[idx] || ''; });
        // Map common header names
        const mapped = {
          date: row.date || row.transaction_date || row.trans_date || '',
          description: row.description || row.desc || row.memo || row.narrative || row.details || '',
          category: row.category || row.cat || 'Other',
          type: (row.type || '').toLowerCase() === 'income' ? 'income' : 'expense',
          amount: Math.abs(parseFloat(row.amount || row.value || row.total || 0)),
        };
        // Auto-detect type from negative amount
        if (row.amount && parseFloat(row.amount) > 0 && !row.type) mapped.type = 'income';
        if (mapped.amount > 0 && mapped.date) rows.push(mapped);
      }
      setCsvData(rows);
      setCsvPreview(rows.slice(0, 5));
      setImportModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const importCSV = async () => {
    if (!csvData || !user) return;
    setImporting(true);
    try {
      const inserts = csvData.map(r => ({
        user_id: user.id,
        date: r.date,
        description: r.description,
        category: categories.includes(r.category) ? r.category : 'Other',
        type: r.type,
        amount: r.amount,
      }));
      const { error } = await supabase.from('transactions').insert(inserts);
      if (error) throw error;
      setImportModalOpen(false);
      setCsvData(null);
      setCsvPreview([]);
      fetchTransactions();
    } catch (e) {
      console.error('Import error:', e);
      alert('Import failed: ' + e.message);
    } finally {
      setImporting(false);
    }
  };

  // =====================
  // HELPERS
  // =====================
  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Dining': Coffee, 'Housing': Home, 'Transportation': Car,
      'Utilities': Zap, 'Education': GraduationCap, 'Income': Wallet,
      'Shopping': ShoppingCart, 'Health & Fitness': Heart, 'Entertainment': Film,
      'Groceries': ShoppingCart, 'Subscriptions': RefreshCw, 'Savings': Wallet,
      'Investments': Briefcase, 'Personal Care': Heart, 'Travel': Car,
      'Gifts & Donations': Heart, 'Other': MoreHorizontal,
    };
    return icons[category] || ShoppingCart;
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // =====================
  // SCANNER FUNCTIONS (kept from original)
  // =====================
  const openScanner = () => { setScannerOpen(true); setScanError(''); setScanSuccess(''); setExtractedData(null); setSelectedFile(null); setPreview(null); setScanProgress(0); setScanStatus(''); };
  const closeScanner = () => { setScannerOpen(false); setSelectedFile(null); setPreview(null); setExtractedData(null); setScanError(''); setScanSuccess(''); setScanning(false); setScanProgress(0); setScanStatus(''); };
  const processFile = (file) => { if (!file) return; if (!file.type.startsWith('image/')) { setScanError('Please select an image.'); return; } if (file.size > 15*1024*1024) { setScanError('Image must be under 15MB.'); return; } setSelectedFile(file); setScanError(''); setExtractedData(null); setScanSuccess(''); setScanProgress(0); setScanStatus(''); const reader = new FileReader(); reader.onload = (e) => setPreview(e.target.result); reader.readAsDataURL(file); };
  const handleFileChange = (e) => { const file = e.target.files?.[0]; if (file) processFile(file); e.target.value = ''; };
  const scoreOCR = (text) => { if (!text || text.length < 10) return -10; let s = 0; const a = text.match(/\d+\.\d{2}/g); if (a) { s += a.length*15; a.forEach(x => { if (parseFloat(x)>1) s+=25; }); } if (/total/i.test(text)) s+=30; if (/P\s*\d+\.\d{2}/i.test(text)) s+=25; if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(text)) s+=15; if (/card|cash|visa|master/i.test(text)) s+=10; if (/engen|shell|shoprite|choppies|spar|pick.*pay|kfc|woolworths/i.test(text)) s+=15; if (text.length<50) s-=15; return s; };
  const resetScannerPreview = () => { setSelectedFile(null); setPreview(null); setExtractedData(null); setScanError(''); setScanSuccess(''); setScanProgress(0); setScanStatus(''); };

  const scanReceipt = async () => {
    if (!selectedFile || !tesseractReady) return;
    setScanning(true); setScanError(''); setScanProgress(0);
    try {
      setScanStatus('Reading image...');
      const imageDataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = () => rej(new Error('Failed')); r.readAsDataURL(selectedFile); });
      setScanStatus('Enhancing...');
      const versions = await processReceiptImage(imageDataUrl);
      const results = [];
      for (let i = 0; i < versions.length; i++) {
        setScanStatus(`Scanning ${versions[i].label} (${i+1}/${versions.length})...`);
        const ocr = await window.Tesseract.recognize(versions[i].data, 'eng', { logger: m => { if (m.status === 'recognizing text') setScanProgress(Math.round(((i + m.progress) / versions.length) * 100)); } });
        const text = ocr.data.text || '';
        const score = scoreOCR(text);
        results.push({ text, score, label: versions[i].label });
        if (score >= 80) break;
      }
      results.sort((a, b) => b.score - a.score);
      const best = results[0];
      if (!best.text || best.text.trim().length < 5 || best.score < 0) { setScanError('Could not read receipt. Try a clearer photo.'); return; }
      setScanStatus('Extracting...');
      const parsed = parseReceiptText(best.text);
      if (!parsed) { setScanError('Could not extract details. Enter manually.'); return; }
      setExtractedData(parsed);
    } catch (err) { setScanError('Scan failed: ' + (err.message || 'Unknown error')); }
    finally { setScanning(false); setScanProgress(0); setScanStatus(''); }
  };

  const handleScanFieldChange = (field, value) => setExtractedData(prev => ({ ...prev, [field]: value }));

  const saveScannedTransaction = async () => {
    if (!extractedData || !user) return;
    if (extractedData.total <= 0) { setScanError('Enter amount > 0.'); return; }
    try {
      const { error } = await supabase.from('transactions').insert({ user_id: user.id, type: 'expense', amount: extractedData.total, category: extractedData.category, description: `${extractedData.merchant}${extractedData.items.length > 0 ? ` (${extractedData.items.length} items)` : ''}`, date: extractedData.date });
      if (error) throw error;
      setScanSuccess(`Saved: P${extractedData.total.toFixed(2)} at ${extractedData.merchant}`);
      fetchTransactions();
      setTimeout(closeScanner, 1500);
    } catch (err) { setScanError('Failed: ' + err.message); }
  };

  // =====================
  // RENDER
  // =====================
  if (loading) return <div className="transactions-loading"><div className="spinner" /></div>;

  return (
    <div className="transactions-page">
      {/* Search & Actions Bar */}
      <div className="actions-bar">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>}
        </div>

        <div className="action-buttons">
          <button className={`action-btn filter-toggle ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <Filter size={16} />
            <span>Filter</span>
            {hasActiveFilters && <span className="filter-dot" />}
          </button>
          <button className="action-btn" onClick={() => csvInputRef.current?.click()}>
            <Upload size={16} /> <span>Import</span>
          </button>
          <button className="action-btn" onClick={exportCSV} disabled={filteredTransactions.length === 0}>
            <Download size={16} /> <span>Export</span>
          </button>
          <button className="action-btn scan-receipt-btn" onClick={openScanner}>
            <ScanLine size={18} /> <span>Scan</span>
          </button>
          <button className="action-btn primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} /> <span>Add</span>
          </button>
        </div>
        <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCSVFile} style={{ display: 'none' }} />
      </div>

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
            <div className="filter-group">
              <label>Category</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                <X size={14} /> Clear
              </button>
            )}
          </div>
          <div className="filter-summary">
            Showing {filteredTransactions.length} of {transactions.length} transactions
            {totalIncome > 0 && <span className="summary-income"> • Income: {formatCurrency(totalIncome)}</span>}
            {totalExpenses > 0 && <span className="summary-expense"> • Expenses: {formatCurrency(totalExpenses)}</span>}
          </div>
        </div>
      )}

      {/* Table */}
      {filteredTransactions.length > 0 ? (
        <div className="transactions-table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('date')} className="sortable">Date <SortIcon field="date" /></th>
                <th onClick={() => handleSort('description')} className="sortable">Description <SortIcon field="description" /></th>
                <th onClick={() => handleSort('category')} className="sortable">Category <SortIcon field="category" /></th>
                <th onClick={() => handleSort('type')} className="sortable">Type <SortIcon field="type" /></th>
                <th onClick={() => handleSort('amount')} className="sortable">Amount <SortIcon field="amount" /></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map(t => {
                const Icon = getCategoryIcon(t.category);
                return (
                  <tr key={t.id}>
                    <td className="date-cell">
                      {inlineEdit?.id === t.id && inlineEdit.field === 'date' ? (
                        <input type="date" className="inline-input" value={inlineEdit.value} onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })} onBlur={saveInlineEdit} onKeyDown={handleInlineKeyDown} autoFocus />
                      ) : (
                        <span onDoubleClick={() => startInlineEdit(t.id, 'date', t.date)}>{formatDate(t.date)}</span>
                      )}
                    </td>
                    <td className="desc-cell">
                      {inlineEdit?.id === t.id && inlineEdit.field === 'description' ? (
                        <input type="text" className="inline-input" value={inlineEdit.value} onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })} onBlur={saveInlineEdit} onKeyDown={handleInlineKeyDown} autoFocus />
                      ) : (
                        <div className="desc-wrapper" onDoubleClick={() => startInlineEdit(t.id, 'description', t.description)}>
                          <div className="transaction-icon"><Icon size={16} /></div>
                          <span>{t.description}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {inlineEdit?.id === t.id && inlineEdit.field === 'category' ? (
                        <select className="inline-select" value={inlineEdit.value} onChange={e => { setInlineEdit({ ...inlineEdit, value: e.target.value }); }} onBlur={saveInlineEdit} autoFocus>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="category-badge" onDoubleClick={() => startInlineEdit(t.id, 'category', t.category)}>{t.category}</span>
                      )}
                    </td>
                    <td>
                      <span className={`type-badge ${t.type}`}>
                        {t.type === 'income' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                        {t.type}
                      </span>
                    </td>
                    <td className={`amount-cell ${t.type}`}>
                      {inlineEdit?.id === t.id && inlineEdit.field === 'amount' ? (
                        <input type="number" step="0.01" className="inline-input amount" value={inlineEdit.value} onChange={e => setInlineEdit({ ...inlineEdit, value: e.target.value })} onBlur={saveInlineEdit} onKeyDown={handleInlineKeyDown} autoFocus />
                      ) : (
                        <span onDoubleClick={() => startInlineEdit(t.id, 'amount', t.amount)}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                      )}
                    </td>
                    <td className="actions-cell">
                      <button className="row-action edit" onClick={() => handleEdit(t)} title="Edit"><Edit size={16} /></button>
                      <button className="row-action delete" onClick={() => handleDelete(t.id)} title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state-container">
          <div className="empty-state">
            <Receipt size={64} strokeWidth={1} />
            <h3>{hasActiveFilters ? 'No matching transactions' : 'No transactions yet'}</h3>
            <p>{hasActiveFilters ? 'Try changing your filters' : 'Start tracking your finances'}</p>
            <div className="empty-state-actions">
              {hasActiveFilters && (
                <button className="empty-action-btn" onClick={clearFilters}><X size={18} /> Clear Filters</button>
              )}
              <button className="empty-action-btn" onClick={openScanner}><ScanLine size={18} /> Scan Receipt</button>
              <button className="empty-action-btn primary" onClick={() => setModalOpen(true)}><Plus size={18} /> Add Transaction</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FABs */}
      <div className="fab-group">
        <button className="fab fab-scan" onClick={openScanner}><ScanLine size={22} /></button>
        <button className="fab fab-add" onClick={() => setModalOpen(true)}><Plus size={24} /></button>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => { setModalOpen(false); setEditingTransaction(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
              <button className="modal-close" onClick={() => { setModalOpen(false); setEditingTransaction(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="type-selector">
                <button type="button" className={`type-btn ${formData.type === 'income' ? 'active income' : ''}`} onClick={() => setFormData({ ...formData, type: 'income' })}><ArrowUpCircle size={20} /> Income</button>
                <button type="button" className={`type-btn ${formData.type === 'expense' ? 'active expense' : ''}`} onClick={() => setFormData({ ...formData, type: 'expense' })}><ArrowDownCircle size={20} /> Expense</button>
              </div>
              <div className="form-group">
                <label>Amount (P)</label>
                <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" min="0" step="0.01" required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Enter description" required />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
              </div>
              <button type="submit" className="submit-btn">{editingTransaction ? 'Save Changes' : 'Add Transaction'}</button>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {importModalOpen && (
        <div className="modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="modal import-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Upload size={20} /> Import from CSV</h2>
              <button className="modal-close" onClick={() => setImportModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="import-body">
              <p className="import-info">{csvData?.length || 0} transactions found. Preview:</p>
              <div className="import-preview">
                <table>
                  <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th></tr></thead>
                  <tbody>
                    {csvPreview.map((r, i) => (
                      <tr key={i}><td>{r.date}</td><td>{r.description}</td><td>{r.category}</td><td>{r.type}</td><td>P{r.amount.toFixed(2)}</td></tr>
                    ))}
                    {csvData && csvData.length > 5 && <tr><td colSpan="5" className="import-more">...and {csvData.length - 5} more</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="import-actions">
                <button className="submit-btn" onClick={importCSV} disabled={importing}>
                  {importing ? <><Loader size={16} className="spin" /> Importing...</> : <><Upload size={16} /> Import {csvData?.length} Transactions</>}
                </button>
                <button className="cancel-btn" onClick={() => setImportModalOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal — same as original */}
      {scannerOpen && (
        <div className="modal-overlay" onClick={closeScanner}>
          <div className="modal scanner-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="scanner-modal-title"><ScanLine size={20} /><h2>Scan Receipt</h2></div>
              <button className="modal-close" onClick={closeScanner}><X size={20} /></button>
            </div>
            <div className="scanner-modal-body">
              {scanSuccess && <div className="scan-msg scan-msg-success"><Check size={16} /><span>{scanSuccess}</span></div>}
              {scanError && <div className="scan-msg scan-msg-error"><AlertCircle size={16} /><span>{scanError}</span><button onClick={() => setScanError('')}><X size={14} /></button></div>}
              {!extractedData && (
                <div className="scan-upload-area">
                  {preview ? (
                    <div className="scan-preview-wrapper"><img src={preview} alt="Receipt" className="scan-preview-img" /><button className="scan-preview-remove" onClick={resetScannerPreview}><X size={14} /></button></div>
                  ) : (
                    <div className="scan-dropzone" onClick={() => fileInputRef.current?.click()}><ScanLine size={32} className="scan-dropzone-icon" /><p className="scan-dropzone-text">{isMobile ? 'Tap to select' : 'Click to upload'}</p><span className="scan-dropzone-formats">JPEG, PNG, WebP</span></div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />
                  {!preview && (
                    <div className="scan-btn-row">
                      {isMobile && <button className="scan-action-btn scan-camera" onClick={() => cameraInputRef.current?.click()}><Camera size={16} /> Photo</button>}
                      <button className="scan-action-btn scan-gallery" onClick={() => fileInputRef.current?.click()}><Image size={16} /> {isMobile ? 'Gallery' : 'Upload'}</button>
                    </div>
                  )}
                  {preview && (
                    <div className="scan-go-row">
                      <button className="scan-go-btn" onClick={scanReceipt} disabled={scanning || !tesseractReady}>
                        {scanning ? <><Loader size={16} className="spin" /> {scanStatus || `${scanProgress}%`}</> : !tesseractReady ? <><Loader size={16} className="spin" /> Loading OCR...</> : <><FileText size={16} /> Scan</>}
                      </button>
                      {scanning && <div className="scan-progress"><div className="scan-progress-fill" style={{ width: `${Math.max(scanProgress, 3)}%` }} /></div>}
                    </div>
                  )}
                </div>
              )}
              {extractedData && (
                <div className="scan-result">
                  <div className="scan-result-header"><Check size={16} /><span>Review & Save</span></div>
                  <div className="scan-fields">
                    <div className="scan-field"><label><Tag size={13} /> Merchant</label><input type="text" value={extractedData.merchant} onChange={e => handleScanFieldChange('merchant', e.target.value)} /></div>
                    <div className="scan-field-row">
                      <div className="scan-field"><label><Calendar size={13} /> Date</label><input type="date" value={extractedData.date} onChange={e => handleScanFieldChange('date', e.target.value)} /></div>
                      <div className="scan-field"><label><DollarSign size={13} /> Total</label><input type="number" step="0.01" min="0" value={extractedData.total} onChange={e => handleScanFieldChange('total', parseFloat(e.target.value) || 0)} /></div>
                    </div>
                    <div className="scan-field"><label><Tag size={13} /> Category</label><select value={extractedData.category} onChange={e => handleScanFieldChange('category', e.target.value)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    {extractedData.items?.length > 0 && (
                      <div className="scan-items"><label><Receipt size={13} /> Items ({extractedData.items.length})</label><div className="scan-items-list">{extractedData.items.map((item, i) => <div key={i} className="scan-item"><span>{item.description}</span><span className="scan-item-amt">P{item.amount.toFixed(2)}</span></div>)}</div></div>
                    )}
                  </div>
                  <div className="scan-result-actions">
                    <button className="scan-save-btn" onClick={saveScannedTransaction}><Plus size={16} /> Save</button>
                    <button className="scan-retry-btn" onClick={resetScannerPreview}>Try Another</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
