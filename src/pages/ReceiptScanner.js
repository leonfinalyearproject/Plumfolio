// src/pages/ReceiptScanner.js
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { parseReceiptText } from '../utils/receiptParser';
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
  const [scanStatus, setScanStatus] = useState('');
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
    setScanStatus('');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  /**
   * Preprocess image for much better OCR accuracy:
   * 1. Scale up small images
   * 2. Convert to grayscale
   * 3. Boost contrast aggressively
   * 4. Apply threshold to make text crisp black on white
   */
  const preprocessImage = (imageDataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Scale up small images - Tesseract works best with larger images
        let w = img.width;
        let h = img.height;
        const minDim = 1500;
        if (Math.max(w, h) < minDim) {
          const scale = minDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        // Cap at reasonable size
        const maxDim = 3000;
        if (Math.max(w, h) > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Pass 1: Convert to grayscale and find min/max for normalization
        const grayValues = new Uint8Array(data.length / 4);
        let minGray = 255, maxGray = 0;
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          grayValues[i / 4] = gray;
          if (gray < minGray) minGray = gray;
          if (gray > maxGray) maxGray = gray;
        }

        // Pass 2: Normalize + contrast stretch + threshold
        const range = maxGray - minGray || 1;
        for (let i = 0; i < data.length; i += 4) {
          // Normalize to 0-255 range
          let val = ((grayValues[i / 4] - minGray) / range) * 255;
          
          // Aggressive contrast boost
          val = ((val - 128) * 2.0) + 128;
          val = Math.max(0, Math.min(255, val));

          // Adaptive threshold for receipt text
          // Receipt text is usually very dark on light background
          if (val < 120) val = 0;       // Make text solid black
          else if (val > 160) val = 255; // Make background solid white
          // Leave middle values for edge anti-aliasing

          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageDataUrl;
    });
  };

  const scanReceipt = async () => {
    if (!selectedFile || !tesseractReady) return;
    setScanning(true);
    setError('');
    setScanProgress(0);
    setScanStatus('Preparing image...');

    try {
      // Read file as data URL
      const imageDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(selectedFile);
      });

      // Preprocess for better OCR
      setScanStatus('Enhancing image...');
      const processedImage = await preprocessImage(imageDataUrl);

      // Run Tesseract OCR with optimized settings
      setScanStatus('Reading receipt text...');
      const result = await window.Tesseract.recognize(
        processedImage,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pct = Math.round(m.progress * 100);
              setScanProgress(pct);
              setScanStatus(`Reading text... ${pct}%`);
            } else if (m.status === 'loading language traineddata') {
              setScanStatus('Loading OCR data...');
            }
          },
        }
      );

      const rawText = result.data.text;
      console.log('=== RAW OCR TEXT ===');
      console.log(rawText);
      console.log('===================');

      if (!rawText || rawText.trim().length < 5) {
        setError('Could not read text from this image. Try a clearer, well-lit photo with the receipt flat.');
        return;
      }

      // Parse with the robust parser
      setScanStatus('Extracting receipt data...');
      const parsed = parseReceiptText(rawText);

      if (!parsed) {
        setError('Could not extract receipt details. Please enter them manually.');
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
      setScanStatus('');
    }
  };

  const handleFieldChange = (field, value) => setExtractedData(prev => ({ ...prev, [field]: value }));

  const saveTransaction = async () => {
    if (!extractedData || !user) return;
    if (extractedData.total <= 0) { setError('Enter a valid amount greater than 0.'); return; }
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
      setSuccess(`Transaction saved: P${extractedData.total.toFixed(2)} at ${extractedData.merchant}`);
      resetScanner();
    } catch (err) { setError('Failed to save: ' + err.message); }
  };

  const resetScanner = () => {
    setSelectedFile(null); setPreview(null); setExtractedData(null);
    setError(''); setSuccess(''); setEditMode(false); setScanProgress(0); setScanStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const categories = ['Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Utilities', 'Other'];

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
                {scanning ? (
                  <><Loader size={18} className="spin" /> {scanStatus || `Scanning... ${scanProgress}%`}</>
                ) : (
                  <><FileText size={18} /> Scan Receipt</>
                )}
              </button>
              {scanning && <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.max(scanProgress, 5)}%` }} /></div>}
            </div>
          )}
        </div>

        {extractedData && editMode && (
          <div className="extracted-section">
            <h3 className="extracted-title"><Check size={18} /> Receipt Data Extracted</h3>
            <p className="extracted-subtitle">Review and edit before saving</p>
            <div className="extracted-form">
              <div className="form-group">
                <label><Tag size={14} /> Merchant</label>
                <input type="text" value={extractedData.merchant} onChange={(e) => handleFieldChange('merchant', e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label><Calendar size={14} /> Date</label>
                  <input type="date" value={extractedData.date} onChange={(e) => handleFieldChange('date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label><DollarSign size={14} /> Total (P)</label>
                  <input type="number" step="0.01" min="0" value={extractedData.total} onChange={(e) => handleFieldChange('total', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="form-group">
                <label><Tag size={14} /> Category</label>
                <select value={extractedData.category} onChange={(e) => handleFieldChange('category', e.target.value)}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {extractedData.items.length > 0 && (
                <div className="items-breakdown">
                  <label><Receipt size={14} /> Detected Items ({extractedData.items.length})</label>
                  <div className="items-list">
                    {extractedData.items.map((item, i) => (
                      <div key={i} className="item-row">
                        <span className="item-desc">{item.description}</span>
                        <span className="item-amount">P{item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <details className="raw-text-toggle">
                <summary>View raw OCR text</summary>
                <pre className="raw-text">{extractedData.rawText}</pre>
              </details>

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
            <div className="step"><div className="step-num">2</div><div className="step-content"><h4>AI Scan</h4><p>Image is enhanced, then OCR reads text and our algorithms extract merchant, total, date, and category</p></div></div>
            <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Review & Save</h4><p>Edit any details and save directly as a transaction</p></div></div>
          </div>
          <div className="scanner-tips">
            <h4><Edit3 size={14} /> Tips for Best Results</h4>
            <ul>
              <li>Use good lighting — avoid shadows on the receipt</li>
              <li>Keep the receipt flat and capture the full image</li>
              <li>Printed receipts work best</li>
              <li>Make sure the total amount is visible and clear</li>
              <li>You can always edit the data before saving</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptScanner;
