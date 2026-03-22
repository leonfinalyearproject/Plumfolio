// src/pages/ReceiptScanner.js
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Camera, FileText, Check, X, Loader, Receipt,
  DollarSign, Tag, Calendar, AlertCircle, Plus, Edit3
} from 'lucide-react';
import './ReceiptScanner.css';

const ReceiptScanner = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [tesseractReady, setTesseractReady] = useState(false);

  useEffect(() => {
    if (window.Tesseract) {
      setTesseractReady(true);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => setTesseractReady(true);
      script.onerror = () => setError('Failed to load OCR engine. Please refresh.');
      document.head.appendChild(script);
    }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please upload JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB.');
      return;
    }
    setSelectedFile(file);
    setError('');
    setExtractedData(null);
    setSuccess('');
    setScanProgress(0);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const parseReceiptText = (rawText) => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return null;

    // Merchant: first substantial line
    let merchant = 'Unknown Merchant';
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
      if (line.length > 2 && !/^\d+$/.test(line) && !/^(tel|phone|fax|vat|tax|receipt|invoice)/i.test(line)) {
        merchant = line;
        break;
      }
    }

    // Date
    let date = new Date().toISOString().split('T')[0];
    const monthMap = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const datePatterns = [
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
      /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
      /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i,
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i,
    ];
    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          try {
            if (match[2] && monthMap[match[2].toLowerCase().substring(0,3)]) {
              date = `${match[3]}-${monthMap[match[2].toLowerCase().substring(0,3)]}-${match[1].padStart(2,'0')}`;
            } else if (match[1] && monthMap[match[1].toLowerCase().substring(0,3)]) {
              date = `${match[3]}-${monthMap[match[1].toLowerCase().substring(0,3)]}-${match[2].padStart(2,'0')}`;
            } else if (match[1].length === 4) {
              date = `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
            } else {
              date = `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
            }
          } catch (e) {}
          break;
        }
      }
    }

    // Items and amounts
    const items = [];
    const amountPattern = /(\d+[.,]\d{2})/g;
    const totalPatterns = [
      /(?:total|tot|amount\s*due|grand\s*total|balance\s*due|sum|net|gross)\s*[:\s]*[A-Z$P]*\s*(\d+[.,]\d{2})/i,
      /(\d+[.,]\d{2})\s*(?:total|tot|amount\s*due|grand\s*total)/i,
    ];

    let total = 0;
    let foundTotal = false;
    for (const line of lines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          total = parseFloat(match[1].replace(',', '.'));
          foundTotal = true;
          break;
        }
      }
      if (foundTotal) break;
    }

    for (const line of lines) {
      if (/^(tel|phone|fax|vat|tax|receipt|invoice|change|cash|card|visa|master|debit|credit|thank|welcome)/i.test(line)) continue;
      if (/total|subtotal|sub-total|amount due/i.test(line)) continue;
      const amounts = line.match(amountPattern);
      if (amounts && amounts.length > 0) {
        const amount = parseFloat(amounts[amounts.length - 1].replace(',', '.'));
        const desc = line.replace(amountPattern, '').replace(/[^\w\s&'.-]/g, '').trim();
        if (desc.length > 1 && amount > 0 && amount < 100000) {
          items.push({ description: desc.substring(0, 50), amount });
        }
      }
    }

    if (!foundTotal && items.length > 0) {
      total = items.reduce((sum, item) => sum + item.amount, 0);
    }
    if (total === 0) {
      const allAmounts = [];
      for (const line of lines) {
        const matches = line.match(amountPattern);
        if (matches) matches.forEach(m => allAmounts.push(parseFloat(m.replace(',', '.'))));
      }
      if (allAmounts.length > 0) total = Math.max(...allAmounts);
    }

    // Category guess
    const text = rawText.toLowerCase();
    let category = 'Other';
    if (/restaurant|cafe|coffee|food|eat|dine|pizza|burger|chicken|bakery|grocery|spar|shoprite|choppies|pick.*pay/i.test(text)) category = 'Food & Dining';
    else if (/fuel|petrol|gas|shell|engen|parking|uber|taxi|bus|transport/i.test(text)) category = 'Transportation';
    else if (/pharmacy|clinic|hospital|doctor|medical|health|chemist/i.test(text)) category = 'Healthcare';
    else if (/game|makro|pep|jet|wool|cloth|shoe|fashion|mall|shop/i.test(text)) category = 'Shopping';
    else if (/electric|water|internet|wifi|airtime|dstv|btc|bpc|wuc/i.test(text)) category = 'Utilities';
    else if (/cinema|movie|ticket|event|concert/i.test(text)) category = 'Entertainment';
    else if (/school|university|book|tuition|education|stationery/i.test(text)) category = 'Education';

    return { merchant: merchant.substring(0, 60), date, items, total: Math.round(total * 100) / 100, category, rawText };
  };

  const scanReceipt = async () => {
    if (!selectedFile || !tesseractReady) return;
    setScanning(true);
    setError('');
    setScanProgress(0);
    try {
      const result = await window.Tesseract.recognize(selectedFile, 'eng', {
        logger: (m) => { if (m.status === 'recognizing text') setScanProgress(Math.round(m.progress * 100)); },
      });
      const rawText = result.data.text;
      if (!rawText || rawText.trim().length < 5) {
        setError('Could not read text from this image. Try a clearer photo.');
        return;
      }
      const parsed = parseReceiptText(rawText);
      if (!parsed) {
        setError('Could not extract receipt details. Please enter manually.');
        return;
      }
      setExtractedData(parsed);
      setEditMode(true);
    } catch (err) {
      console.error('OCR error:', err);
      setError('Failed to scan receipt: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  };

  const handleFieldChange = (field, value) => setExtractedData(prev => ({ ...prev, [field]: value }));

  const saveTransaction = async () => {
    if (!extractedData || !user) return;
    if (extractedData.total <= 0) { setError('Enter a valid amount.'); return; }
    try {
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: user.id, type: 'expense', amount: extractedData.total,
        category: extractedData.category,
        description: `${extractedData.merchant}${extractedData.items.length > 0 ? ` (${extractedData.items.length} items)` : ''}`,
        date: extractedData.date,
      });
      if (insertError) throw insertError;
      setSuccess(`Transaction saved: P${extractedData.total.toFixed(2)} at ${extractedData.merchant}`);
      resetScanner();
    } catch (err) { setError('Failed to save: ' + err.message); }
  };

  const resetScanner = () => {
    setSelectedFile(null); setPreview(null); setExtractedData(null);
    setError(''); setSuccess(''); setEditMode(false); setScanProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const categories = ['Food & Dining','Shopping','Transportation','Entertainment','Healthcare','Education','Utilities','Other'];

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <div className="scanner-header-left">
          <Receipt size={24} />
          <div>
            <h2>Receipt Scanner</h2>
            <p>Upload a receipt and OCR extracts the details automatically</p>
          </div>
        </div>
        {!tesseractReady && <span className="loading-badge"><Loader size={14} className="spin" /> Loading OCR...</span>}
      </div>

      {success && <div className="scanner-success"><Check size={18} /><span>{success}</span><button onClick={() => setSuccess('')}><X size={14} /></button></div>}
      {error && <div className="scanner-error"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div>}

      <div className="scanner-content">
        <div className="scanner-upload-section">
          <div className={`upload-zone ${preview ? 'has-preview' : ''}`} onClick={() => !preview && fileInputRef.current?.click()}>
            {preview ? (
              <div className="preview-container">
                <img src={preview} alt="Receipt" className="receipt-preview" />
                <button className="remove-preview" onClick={(e) => { e.stopPropagation(); resetScanner(); }}><X size={16} /></button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon"><Camera size={32} /></div>
                <h3>Upload Receipt</h3>
                <p>Click to select or drag and drop</p>
                <p className="upload-formats">JPEG, PNG, WebP (max 10MB)</p>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} hidden />
          {preview && !extractedData && (
            <div className="scan-actions">
              <button className="scan-btn" onClick={scanReceipt} disabled={scanning || !tesseractReady}>
                {scanning ? <><Loader size={18} className="spin" /> Scanning... {scanProgress}%</> : <><FileText size={18} /> Scan Receipt</>}
              </button>
              {scanning && <div className="progress-bar"><div className="progress-fill" style={{ width: `${scanProgress}%` }} /></div>}
            </div>
          )}
        </div>

        {extractedData && editMode && (
          <div className="extracted-section">
            <h3 className="extracted-title"><Check size={18} /> Receipt Data Extracted</h3>
            <p className="extracted-subtitle">Review and edit before saving</p>
            <div className="extracted-form">
              <div className="form-group"><label><Tag size={14} /> Merchant</label><input type="text" value={extractedData.merchant} onChange={(e) => handleFieldChange('merchant', e.target.value)} /></div>
              <div className="form-row">
                <div className="form-group"><label><Calendar size={14} /> Date</label><input type="date" value={extractedData.date} onChange={(e) => handleFieldChange('date', e.target.value)} /></div>
                <div className="form-group"><label><DollarSign size={14} /> Total (P)</label><input type="number" step="0.01" min="0" value={extractedData.total} onChange={(e) => handleFieldChange('total', parseFloat(e.target.value) || 0)} /></div>
              </div>
              <div className="form-group"><label><Tag size={14} /> Category</label><select value={extractedData.category} onChange={(e) => handleFieldChange('category', e.target.value)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              {extractedData.items.length > 0 && (
                <div className="items-breakdown">
                  <label><Receipt size={14} /> Detected Items ({extractedData.items.length})</label>
                  <div className="items-list">
                    {extractedData.items.map((item, i) => <div key={i} className="item-row"><span className="item-desc">{item.description}</span><span className="item-amount">P{item.amount.toFixed(2)}</span></div>)}
                    <div className="item-row item-total"><span>Items Total</span><span className="item-amount">P{extractedData.items.reduce((s,i) => s + i.amount, 0).toFixed(2)}</span></div>
                  </div>
                </div>
              )}
              <details className="raw-text-toggle"><summary>View raw OCR text</summary><pre className="raw-text">{extractedData.rawText}</pre></details>
              <div className="form-actions">
                <button className="save-btn" onClick={saveTransaction}><Plus size={16} /> Save as Expense</button>
                <button className="cancel-btn" onClick={resetScanner}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!preview && !extractedData && (
        <div className="how-it-works">
          <h3>How It Works</h3>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><div className="step-content"><h4>Upload</h4><p>Take a photo or upload an image of your receipt</p></div></div>
            <div className="step"><div className="step-num">2</div><div className="step-content"><h4>OCR Scan</h4><p>Tesseract.js reads the text, then our algorithms extract merchant, items, and total</p></div></div>
            <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Review & Save</h4><p>Edit any details and save directly as a transaction</p></div></div>
          </div>
          <div className="scanner-tips">
            <h4><Edit3 size={14} /> Tips for Best Results</h4>
            <ul>
              <li>Use good lighting and avoid shadows</li>
              <li>Keep the receipt flat and capture the full image</li>
              <li>Printed receipts work better than handwritten</li>
              <li>You can always edit extracted data before saving</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptScanner;
