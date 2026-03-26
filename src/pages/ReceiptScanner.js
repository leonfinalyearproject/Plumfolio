// src/pages/ReceiptScanner.js
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { parseReceiptText } from '../utils/receiptParser';
import {
  Camera, FileText, Check, X, Loader, Receipt,
  DollarSign, Tag, Calendar, AlertCircle, Plus, Edit3, Upload
} from 'lucide-react';
import './ReceiptScanner.css';

const ReceiptScanner = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
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
  const [isMobileOrPWA, setIsMobileOrPWA] = useState(false);

  useEffect(() => {
    // Detect mobile or PWA (installed app)
    const checkMobileOrPWA = () => {
      const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || window.navigator.standalone === true;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobileOrPWA(isMobile || isStandalone || (isTouchDevice && window.innerWidth < 1024));
    };
    checkMobileOrPWA();
    window.addEventListener('resize', checkMobileOrPWA);
    return () => window.removeEventListener('resize', checkMobileOrPWA);
  }, []);

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

  const preprocessImage = (imageDataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let w = img.width;
        let h = img.height;
        const minDim = 1500;
        if (Math.max(w, h) < minDim) {
          const scale = minDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
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
        const grayValues = new Uint8Array(data.length / 4);
        let minGray = 255, maxGray = 0;
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          grayValues[i / 4] = gray;
          if (gray < minGray) minGray = gray;
          if (gray > maxGray) maxGray = gray;
        }
        const range = maxGray - minGray || 1;
        for (let i = 0; i < data.length; i += 4) {
          let val = ((grayValues[i / 4] - minGray) / range) * 255;
          val = ((val - 128) * 2.0) + 128;
          val = Math.max(0, Math.min(255, val));
          if (val < 120) val = 0;
          else if (val > 160) val = 255;
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
      const imageDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(selectedFile);
      });
      setScanStatus('Enhancing image...');
      const processedImage = await preprocessImage(imageDataUrl);
      setScanStatus('Reading receipt text...');
      const result = await window.Tesseract.recognize(processedImage, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            setScanProgress(pct);
            setScanStatus(`Reading text... ${pct}%`);
          } else if (m.status === 'loading language traineddata') {
            setScanStatus('Loading OCR data...');
          }
        },
      });
      const rawText = result.data.text;
      if (!rawText || rawText.trim().length < 5) {
        setError('Could not read text from this image. Try a clearer, well-lit photo.');
        return;
      }
      setScanStatus('Extracting receipt data...');
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
      setScanStatus('');
    }
  };

  const handleFieldChange = (field, value) => setExtractedData(prev => ({ ...prev, [field]: value }));

  const saveTransaction = async () => {
    if (!extractedData || !user) return;
    if (extractedData.total <= 0) { setError('Enter a valid amount greater than 0.'); return; }
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
    setError(''); setSuccess(''); setEditMode(false); setScanProgress(0); setScanStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const categories = ['Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Utilities', 'Other'];

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <div className="scanner-header-left">
          <Receipt size={24} />
          <div>
            <h2>Receipt Scanner</h2>
            <p>Upload or photograph a receipt — OCR extracts the details</p>
          </div>
        </div>
        {!tesseractReady && <span className="loading-badge"><Loader size={14} className="spin" /> Loading OCR...</span>}
      </div>

      {success && <div className="scanner-success"><Check size={18} /><span>{success}</span><button onClick={() => setSuccess('')}><X size={14} /></button></div>}
      {error && <div className="scanner-error"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div>}

      <div className="scanner-content">
        <div className="scanner-upload-section">
          {/* Upload zone */}
          <div className={`upload-zone ${preview ? 'has-preview' : ''}`} onClick={() => !preview && fileInputRef.current?.click()}>
            {preview ? (
              <div className="preview-container">
                <img src={preview} alt="Receipt" className="receipt-preview" />
                <button className="remove-preview" onClick={(e) => { e.stopPropagation(); resetScanner(); }}><X size={16} /></button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon"><Upload size={32} /></div>
                <h3>Upload Receipt</h3>
                <p>Click to select an image file</p>
                <p className="upload-formats">JPEG, PNG, WebP (max 10MB)</p>
              </div>
            )}
          </div>

          {/* File upload input (always available) */}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} hidden />

          {/* Camera input (only on mobile/PWA) */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} hidden />

          {/* Action buttons */}
          {!preview && (
            <div className="scanner-buttons">
              {/* Take Photo button - only on mobile/PWA */}
              {isMobileOrPWA && (
                <button className="scanner-action-btn camera-btn" onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={18} />
                  Take Photo
                </button>
              )}
              <button className="scanner-action-btn upload-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={18} />
                Upload Image
              </button>
            </div>
          )}

          {/* Scan button */}
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

        {/* Extracted data form */}
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
                      <div key={i} className="item-row"><span className="item-desc">{item.description}</span><span className="item-amount">P{item.amount.toFixed(2)}</span></div>
                    ))}
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

      {/* How It Works */}
      {!preview && !extractedData && (
        <div className="how-it-works">
          <h3>How It Works</h3>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><div className="step-content"><h4>{isMobileOrPWA ? 'Capture' : 'Upload'}</h4><p>{isMobileOrPWA ? 'Take a photo of your receipt or upload from gallery' : 'Upload an image of your receipt'}</p></div></div>
            <div className="step"><div className="step-num">2</div><div className="step-content"><h4>AI Scan</h4><p>Image is enhanced, then OCR reads text and extracts merchant, total, date, and category</p></div></div>
            <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Review & Save</h4><p>Edit any details and save directly as a transaction</p></div></div>
          </div>
          <div className="scanner-tips">
            <h4><Edit3 size={14} /> Tips for Best Results</h4>
            <ul>
              <li>Use good lighting — avoid shadows on the receipt</li>
              <li>Keep the receipt flat and capture the full image</li>
              <li>Printed receipts work best</li>
              <li>Make sure the total amount is visible and clear</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptScanner;
