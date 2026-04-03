import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useCurrency } from '../context/CurrencyContext';
import { parseReceiptText } from '../utils/receiptParser';
import processReceiptImage from '../utils/imageProcessor';
import { 
  Plus, 
  Filter, 
  Download, 
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  Coffee,
  Home,
  Car,
  Zap,
  GraduationCap,
  ShoppingCart,
  Wallet,
  Briefcase,
  Heart,
  Film,
  MoreHorizontal,
  Trash2,
  Edit,
  Receipt,
  Camera,
  FileText,
  Check,
  Loader,
  AlertCircle,
  Upload,
  Image,
  ScanLine,
  Tag,
  Calendar,
  DollarSign
} from 'lucide-react';
import './Transactions.css';

const Transactions = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    description: '',
    category: 'Food & Dining',
    date: new Date().toISOString().split('T')[0],
  });

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
    'Food & Dining',
    'Transportation',
    'Housing',
    'Utilities',
    'Entertainment',
    'Shopping',
    'Health & Fitness',
    'Education',
    'Income',
    'Other',
  ];

  // Check mobile
  useEffect(() => {
    console.log("[EFFECT] user:", user?.id, "user obj:", !!user);
    const check = () => {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const touch = 'ontouchstart' in window;
      setIsMobile(mobile || (touch && window.innerWidth < 1024));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load Tesseract lazily when scanner opens
  useEffect(() => {
    console.log("[EFFECT] user:", user?.id, "user obj:", !!user);
    if (!scannerOpen) return;
    if (window.Tesseract) {
      setTesseractReady(true);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => setTesseractReady(true);
      script.onerror = () => setScanError('Failed to load OCR engine.');
      document.head.appendChild(script);
    }
  }, [scannerOpen]);

  useEffect(() => {
    console.log("[EFFECT] user:", user?.id, "user obj:", !!user);
    if (user) {
      fetchTransactions();
    }
  }, [user?.id]);

  const fetchTransactions = async () => {
    try {
      // v2 fix: use getSession directly
      const { data: { session: _s } } = await supabase.auth.getSession();
      const userId = _s ? _s.user.id : user?.id;
      console.log('[FETCH] userId:', userId, 'session:', !!_s);
      if (!userId) { console.log('[FETCH] No userId, stopping'); setLoading(false); return; }
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTransaction) {
        const { error } = await supabase
          .from('transactions')
          .update({
            type: formData.type,
            amount: parseFloat(formData.amount),
            description: formData.description,
            category: formData.category,
            date: formData.date,
          })
          .eq('id', editingTransaction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: formData.type,
            amount: parseFloat(formData.amount),
            description: formData.description,
            category: formData.category,
            date: formData.date,
          });

        if (error) throw error;
      }

      setModalOpen(false);
      setEditingTransaction(null);
      setFormData({
        type: 'expense',
        amount: '',
        description: '',
        category: 'Food & Dining',
        date: new Date().toISOString().split('T')[0],
      });
      fetchTransactions();
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      category: transaction.category,
      date: transaction.date,
    });
    setModalOpen(true);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Food & Dining': Coffee,
      'Housing': Home,
      'Transportation': Car,
      'Utilities': Zap,
      'Education': GraduationCap,
      'Income': Wallet,
      'Shopping': ShoppingCart,
      'Health & Fitness': Heart,
      'Entertainment': Film,
      'Other': MoreHorizontal,
    };
    return icons[category] || ShoppingCart;
  };


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  // =====================
  // SCANNER FUNCTIONS
  // =====================

  const openScanner = () => {
    setScannerOpen(true);
    setScanError('');
    setScanSuccess('');
    setExtractedData(null);
    setSelectedFile(null);
    setPreview(null);
    setScanProgress(0);
    setScanStatus('');
  };

  const closeScanner = () => {
    setScannerOpen(false);
    setSelectedFile(null);
    setPreview(null);
    setExtractedData(null);
    setScanError('');
    setScanSuccess('');
    setScanning(false);
    setScanProgress(0);
    setScanStatus('');
  };

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setScanError('Please select an image.'); return; }
    if (file.size > 15 * 1024 * 1024) { setScanError('Image must be under 15MB.'); return; }
    setSelectedFile(file);
    setScanError('');
    setExtractedData(null);
    setScanSuccess('');
    setScanProgress(0);
    setScanStatus('');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const scoreOCR = (text) => {
    if (!text || text.length < 10) return -10;
    let score = 0;
    const amounts = text.match(/\d+\.\d{2}/g);
    if (amounts) {
      score += amounts.length * 15;
      amounts.forEach(a => { if (parseFloat(a) > 1) score += 25; });
    }
    if (/total/i.test(text)) score += 30;
    if (/P\s*\d+\.\d{2}/i.test(text)) score += 25;
    if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(text)) score += 15;
    if (/card|cash|visa|master|credit|debit/i.test(text)) score += 10;
    if (/vat|tax|item/i.test(text)) score += 5;
    if (/engen|shell|shoprite|choppies|spar|pick.*pay|kfc|woolworths/i.test(text)) score += 15;
    if (text.length < 50) score -= 15;
    const readable = text.replace(/[^a-zA-Z0-9\s.,]/g, '').length;
    if (text.length > 0 && readable / text.length < 0.4) score -= 15;
    return score;
  };

  const scanReceipt = async () => {
    if (!selectedFile || !tesseractReady) return;
    setScanning(true);
    setScanError('');
    setScanProgress(0);

    try {
      setScanStatus('Reading image...');
      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(selectedFile);
      });

      setScanStatus('Enhancing image...');
      const versions = await processReceiptImage(imageDataUrl);

      const results = [];
      for (let i = 0; i < versions.length; i++) {
        const v = versions[i];
        setScanStatus(`Scanning ${v.label} (${i + 1}/${versions.length})...`);
        
        const ocrResult = await window.Tesseract.recognize(v.data, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setScanProgress(Math.round(((i + m.progress) / versions.length) * 100));
            }
          },
        });

        const text = ocrResult.data.text || '';
        const score = scoreOCR(text);
        results.push({ text, score, label: v.label });
        console.log(`[${v.label}] score: ${score}\n${text.substring(0, 150)}`);
        
        if (score >= 80) {
          console.log(`Early exit: ${v.label} scored ${score}`);
          break;
        }
      }

      results.sort((a, b) => b.score - a.score);
      const best = results[0];
      console.log(`Winner: ${best.label} (score: ${best.score})`);

      if (!best.text || best.text.trim().length < 5 || best.score < 0) {
        setScanError('Could not read this receipt. Try a clearer, well-lit photo with the receipt flat.');
        return;
      }

      setScanStatus('Extracting data...');
      const parsed = parseReceiptText(best.text);

      if (!parsed) {
        setScanError('Could not extract details. Please enter manually.');
        return;
      }

      setExtractedData(parsed);
    } catch (err) {
      console.error('Scan error:', err);
      setScanError('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
      setScanProgress(0);
      setScanStatus('');
    }
  };

  const handleScanFieldChange = (field, value) => {
    setExtractedData(prev => ({ ...prev, [field]: value }));
  };

  const saveScannedTransaction = async () => {
    if (!extractedData || !user) return;
    if (extractedData.total <= 0) { setScanError('Enter an amount greater than 0.'); return; }
    try {
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'expense',
        amount: extractedData.total,
        category: extractedData.category,
        description: `${extractedData.merchant}${extractedData.items.length > 0 ? ` (${extractedData.items.length} items)` : ''}`,
        date: extractedData.date,
      });
      if (insertError) throw insertError;
      setScanSuccess(`Saved: P${extractedData.total.toFixed(2)} at ${extractedData.merchant}`);
      fetchTransactions();
      // Reset scanner after short delay so user sees success
      setTimeout(() => {
        closeScanner();
      }, 1500);
    } catch (err) {
      setScanError('Failed to save: ' + err.message);
    }
  };

  const resetScannerPreview = () => {
    setSelectedFile(null);
    setPreview(null);
    setExtractedData(null);
    setScanError('');
    setScanSuccess('');
    setScanProgress(0);
    setScanStatus('');
  };

  if (loading) {
    return (
      <div className="transactions-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="transactions-page">
      {/* Actions Bar */}
      <div className="actions-bar">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-tab ${filter === 'income' ? 'active' : ''}`}
            onClick={() => setFilter('income')}
          >
            Income
          </button>
          <button 
            className={`filter-tab ${filter === 'expense' ? 'active' : ''}`}
            onClick={() => setFilter('expense')}
          >
            Expenses
          </button>
        </div>
        
        <div className="action-buttons">
          <button className="action-btn scan-receipt-btn" onClick={openScanner}>
            <ScanLine size={18} />
            <span>Scan Receipt</span>
          </button>
          <button className="action-btn primary" onClick={() => setModalOpen(true)}>
            <Plus size={18} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {filteredTransactions.length > 0 ? (
        <div className="transactions-table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => {
                const Icon = getCategoryIcon(transaction.category);
                return (
                  <tr key={transaction.id}>
                    <td className="date-cell">{formatDate(transaction.date)}</td>
                    <td className="desc-cell">
                      <div className="desc-wrapper">
                        <div className="transaction-icon">
                          <Icon size={16} />
                        </div>
                        <span>{transaction.description}</span>
                      </div>
                    </td>
                    <td>
                      <span className="category-badge">{transaction.category}</span>
                    </td>
                    <td>
                      <span className={`type-badge ${transaction.type}`}>
                        {transaction.type === 'income' ? (
                          <ArrowUpCircle size={14} />
                        ) : (
                          <ArrowDownCircle size={14} />
                        )}
                        {transaction.type}
                      </span>
                    </td>
                    <td className={`amount-cell ${transaction.type}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="row-action edit"
                        onClick={() => handleEdit(transaction)}
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="row-action delete"
                        onClick={() => handleDelete(transaction.id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
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
            <h3>No transactions yet</h3>
            <p>Start tracking your finances by adding your first transaction</p>
            <div className="empty-state-actions">
              <button className="empty-action-btn" onClick={openScanner}>
                <ScanLine size={18} />
                Scan Receipt
              </button>
              <button className="empty-action-btn primary" onClick={() => setModalOpen(true)}>
                <Plus size={18} />
                Add Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FABs */}
      <div className="fab-group">
        <button className="fab fab-scan" onClick={openScanner} title="Scan Receipt">
          <ScanLine size={22} />
        </button>
        <button className="fab fab-add" onClick={() => setModalOpen(true)} title="Add Transaction">
          <Plus size={24} />
        </button>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => { setModalOpen(false); setEditingTransaction(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
              <button className="modal-close" onClick={() => { setModalOpen(false); setEditingTransaction(null); }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="type-selector">
                <button
                  type="button"
                  className={`type-btn ${formData.type === 'income' ? 'active income' : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'income' })}
                >
                  <ArrowUpCircle size={20} />
                  Income
                </button>
                <button
                  type="button"
                  className={`type-btn ${formData.type === 'expense' ? 'active expense' : ''}`}
                  onClick={() => setFormData({ ...formData, type: 'expense' })}
                >
                  <ArrowDownCircle size={20} />
                  Expense
                </button>
              </div>
              
              <div className="form-group">
                <label htmlFor="amount">Amount (P)</label>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="date">Date</label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              
              <button type="submit" className="submit-btn">
                {editingTransaction ? 'Save Changes' : 'Add Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================== */}
      {/* RECEIPT SCANNER MODAL    */}
      {/* ======================== */}
      {scannerOpen && (
        <div className="modal-overlay" onClick={closeScanner}>
          <div className="modal scanner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="scanner-modal-title">
                <ScanLine size={20} />
                <h2>Scan Receipt</h2>
              </div>
              <button className="modal-close" onClick={closeScanner}>
                <X size={20} />
              </button>
            </div>

            <div className="scanner-modal-body">
              {/* Success message */}
              {scanSuccess && (
                <div className="scan-msg scan-msg-success">
                  <Check size={16} />
                  <span>{scanSuccess}</span>
                </div>
              )}
              {/* Error message */}
              {scanError && (
                <div className="scan-msg scan-msg-error">
                  <AlertCircle size={16} />
                  <span>{scanError}</span>
                  <button onClick={() => setScanError('')}><X size={14} /></button>
                </div>
              )}

              {/* Step 1: Upload / Take Photo */}
              {!extractedData && (
                <div className="scan-upload-area">
                  {preview ? (
                    <div className="scan-preview-wrapper">
                      <img src={preview} alt="Receipt" className="scan-preview-img" />
                      <button className="scan-preview-remove" onClick={resetScannerPreview}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="scan-dropzone" onClick={() => fileInputRef.current?.click()}>
                      <ScanLine size={32} className="scan-dropzone-icon" />
                      <p className="scan-dropzone-text">
                        {isMobile ? 'Tap to select a receipt' : 'Click to upload a receipt'}
                      </p>
                      <span className="scan-dropzone-formats">JPEG, PNG, WebP, HEIC</span>
                    </div>
                  )}

                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />

                  {!preview && (
                    <div className="scan-btn-row">
                      {isMobile && (
                        <button className="scan-action-btn scan-camera" onClick={() => cameraInputRef.current?.click()}>
                          <Camera size={16} /> Take Photo
                        </button>
                      )}
                      <button className="scan-action-btn scan-gallery" onClick={() => fileInputRef.current?.click()}>
                        <Image size={16} /> {isMobile ? 'Gallery' : 'Upload Image'}
                      </button>
                    </div>
                  )}

                  {preview && (
                    <div className="scan-go-row">
                      <button
                        className="scan-go-btn"
                        onClick={scanReceipt}
                        disabled={scanning || !tesseractReady}
                      >
                        {scanning ? (
                          <><Loader size={16} className="spin" /> {scanStatus || `${scanProgress}%`}</>
                        ) : !tesseractReady ? (
                          <><Loader size={16} className="spin" /> Loading OCR...</>
                        ) : (
                          <><FileText size={16} /> Scan Receipt</>
                        )}
                      </button>
                      {scanning && (
                        <div className="scan-progress">
                          <div className="scan-progress-fill" style={{ width: `${Math.max(scanProgress, 3)}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Review extracted data */}
              {extractedData && (
                <div className="scan-result">
                  <div className="scan-result-header">
                    <Check size={16} />
                    <span>Data Extracted — Review & Save</span>
                  </div>

                  <div className="scan-fields">
                    <div className="scan-field">
                      <label><Tag size={13} /> Merchant</label>
                      <input
                        type="text"
                        value={extractedData.merchant}
                        onChange={(e) => handleScanFieldChange('merchant', e.target.value)}
                      />
                    </div>
                    <div className="scan-field-row">
                      <div className="scan-field">
                        <label><Calendar size={13} /> Date</label>
                        <input
                          type="date"
                          value={extractedData.date}
                          onChange={(e) => handleScanFieldChange('date', e.target.value)}
                        />
                      </div>
                      <div className="scan-field">
                        <label><DollarSign size={13} /> Total (P)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={extractedData.total}
                          onChange={(e) => handleScanFieldChange('total', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div className="scan-field">
                      <label><Tag size={13} /> Category</label>
                      <select
                        value={extractedData.category}
                        onChange={(e) => handleScanFieldChange('category', e.target.value)}
                      >
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {extractedData.items.length > 0 && (
                      <div className="scan-items">
                        <label><Receipt size={13} /> Detected Items ({extractedData.items.length})</label>
                        <div className="scan-items-list">
                          {extractedData.items.map((item, i) => (
                            <div key={i} className="scan-item">
                              <span>{item.description}</span>
                              <span className="scan-item-amt">P{item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <details className="scan-raw-toggle">
                      <summary>View raw OCR text</summary>
                      <pre className="scan-raw-text">{extractedData.rawText}</pre>
                    </details>
                  </div>

                  <div className="scan-result-actions">
                    <button className="scan-save-btn" onClick={saveScannedTransaction}>
                      <Plus size={16} /> Save as Expense
                    </button>
                    <button className="scan-retry-btn" onClick={resetScannerPreview}>
                      Try Another
                    </button>
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
