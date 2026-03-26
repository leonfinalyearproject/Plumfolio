// src/pages/ReceiptScanner.js
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { parseReceiptText } from '../utils/receiptParser';
import {
  Camera, FileText, Check, X, Loader, Receipt,
  DollarSign, Tag, Calendar, AlertCircle, Plus, Edit3, Upload, Image
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
  const [isMobile, setIsMobile] = useState(false);

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

  useEffect(() => {
    if (window.Tesseract) {
      setTesseractReady(true);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = () => setTesseractReady(true);
      script.onerror = () => setError('Failed to load OCR engine.');
      document.head.appendChild(script);
    }
  }, []);

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image.'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('Image must be under 15MB.'); return; }
    setSelectedFile(file);
    setError(''); setExtractedData(null); setSuccess(''); setScanProgress(0); setScanStatus('');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  /**
   * Preprocess with configurable intensity
   * mode: 'gentle' (light cleanup) or 'strong' (aggressive threshold)
   */
  const preprocessImage = (imageDataUrl, mode = 'gentle') => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let w = img.width;
        let h = img.height;

        // Scale to good OCR size
        const targetSize = 2000;
        if (Math.max(w, h) < targetSize) {
          const scale = targetSize / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        if (Math.max(w, h) > 3500) {
          const scale = 3500 / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const total = w * h;

        // Grayscale
        const gray = new Uint8Array(total);
        let minG = 255, maxG = 0;
        for (let i = 0; i < total; i++) {
          const idx = i * 4;
          const g = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          gray[i] = g;
          if (g < minG) minG = g;
          if (g > maxG) maxG = g;
        }

        const range = maxG - minG || 1;

        if (mode === 'gentle') {
          // Gentle: just normalize + mild contrast (good for clear photos)
          for (let i = 0; i < total; i++) {
            const idx = i * 4;
            let val = ((gray[i] - minG) / range) * 255;
            // Mild contrast boost (1.5x)
            val = ((val - 128) * 1.5) + 128;
            val = Math.max(0, Math.min(255, val));
            data[idx] = val;
            data[idx + 1] = val;
            data[idx + 2] = val;
          }
        } else {
          // Strong: normalize + heavy contrast + threshold (for blurry/dark photos)
          for (let i = 0; i < total; i++) {
            const idx = i * 4;
            let val = ((gray[i] - minG) / range) * 255;
            val = ((val - 128) * 2.0) + 128;
            val = Math.max(0, Math.min(255, val));
            if (val < 128) val = 0;
            else val = 255;
            data[idx] = val;
            data[idx + 1] = val;
            data[idx + 2] = val;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageDataUrl);
      img.src = imageDataUrl;
    });
  };

  /**
   * Run OCR on an image and return the text
   */
  const runOCR = async (imageData, label) => {
    setScanStatus(`${label}...`);
    const result = await window.Tesseract.recognize(imageData, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setScanProgress(Math.round(m.progress * 100));
        }
      },
    });
    return result.data.text || '';
  };

  /**
   * Score how good an OCR result is — more amounts and keywords = better
   */
  const scoreOCRResult = (text) => {
    let score = 0;
    // Count decimal numbers (amounts)
    const amounts = text.match(/\d+\.\d{2}/g);
    score += (amounts ? amounts.length : 0) * 10;
    // Keywords
    if (/total/i.test(text)) score += 20;
    if (/change/i.test(text)) score += 5;
    if (/card|cash|visa|master/i.test(text)) score += 5;
    if (/vat|tax/i.test(text)) score += 5;
    if (/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(text)) score += 15; // date
    // Penalize very short results
    if (text.length < 30) score -= 20;
    // Penalize too much garbage
    const letters = text.replace(/[^a-zA-Z]/g, '').length;
    const total = text.replace(/\s/g, '').length;
    if (total > 0 && letters / total < 0.3) score -= 10; // too few real letters
    return score;
  };

  const scanReceipt = async () => {
    if (!selectedFile || !tesseractReady) return;
    setScanning(true);
    setError(''); setScanProgress(0);

    try {
      setScanStatus('Reading image...');
      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(selectedFile);
      });

      // Try 3 approaches and pick the best result
      const attempts = [];

      // Attempt 1: Gentle preprocessing (best for clear, well-lit photos)
      setScanStatus('Pass 1: Light enhancement...');
      const gentle = await preprocessImage(imageDataUrl, 'gentle');
      const gentleText = await runOCR(gentle, 'Reading (light)');
      attempts.push({ text: gentleText, score: scoreOCRResult(gentleText), label: 'gentle' });
      console.log('Gentle score:', attempts[0].score, gentleText.substring(0, 100));

      // Attempt 2: Strong preprocessing (best for dark/blurry photos)
      setScanStatus('Pass 2: Deep enhancement...');
      const strong = await preprocessImage(imageDataUrl, 'strong');
      const strongText = await runOCR(strong, 'Reading (deep)');
      attempts.push({ text: strongText, score: scoreOCRResult(strongText), label: 'strong' });
      console.log('Strong score:', attempts[1].score, strongText.substring(0, 100));

      // Attempt 3: Raw image (sometimes original is better than processed)
      setScanStatus('Pass 3: Direct read...');
      const rawText = await runOCR(imageDataUrl, 'Reading (direct)');
      attempts.push({ text: rawText, score: scoreOCRResult(rawText), label: 'raw' });
      console.log('Raw score:', attempts[2].score, rawText.substring(0, 100));

      // Pick the best result
      attempts.sort((a, b) => b.score - a.score);
      const best = attempts[0];
      console.log('Best:', best.label, 'score:', best.score);

      if (!best.text || best.text.trim().length < 5 || best.score < 5) {
        setError('Could not read text. Try a clearer photo with good lighting.');
        return;
      }

      setScanStatus('Extracting data...');
      const parsed = parseReceiptText(best.text);

      if (!parsed) {
        setError('Could not extract details. Please enter manually.');
        return;
      }

      setExtractedData(parsed);
      setEditMode(true);
    } catch (err) {
      console.error('Scan error:', err);
      setError('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false); setScanProgress(0); setScanStatus('');
    }
  };

  const handleFieldChange = (field, value) => setExtractedData(prev => ({ ...prev, [field]: value }));

  const saveTransaction = async () => {
    if (!extractedData || !user) return;
    if (extractedData.total <= 0) { setError('Enter an amount greater than 0.'); return; }
    try {
      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: user.id, type: 'expense', amount: extractedData.total,
        category: extractedData.category,
        description: `${extractedData.merchant}${extractedData.items.length > 0 ? ` (${extractedData.items.length} items)` : ''}`,
        date: extractedData.date,
      });
      if (insertError) throw insertError;
      setSuccess(`Saved: P${extractedData.total.toFixed(2)} at ${extractedData.merchant}`);
      resetScanner();
    } catch (err) { setError('Failed: ' + err.message); }
  };

  const resetScanner = () => {
    setSelectedFile(null); setPreview(null); setExtractedData(null);
    setError(''); setSuccess(''); setEditMode(false); setScanProgress(0); setScanStatus('');
  };

  const categories = ['Food & Dining', 'Shopping', 'Transportation', 'Entertainment', 'Healthcare', 'Education', 'Utilities', 'Other'];

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <div className="scanner-header-left">
          <Receipt size={24} />
          <div>
            <h2>Receipt Scanner</h2>
            <p>{isMobile ? 'Take a photo or upload a receipt' : 'Upload a receipt image for OCR scanning'}</p>
          </div>
        </div>
        {!tesseractReady && <span className="loading-badge"><Loader size={14} className="spin" /> Loading OCR...</span>}
      </div>

      {success && <div className="scanner-success"><Check size={18} /><span>{success}</span><button onClick={() => setSuccess('')}><X size={14} /></button></div>}
      {error && <div className="scanner-error"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError('')}><X size={14} /></button></div>}

      <div className="scanner-content">
        <div className="scanner-upload-section">
          {preview ? (
            <div className="preview-wrapper">
              <img src={preview} alt="Receipt" className="receipt-preview" />
              <button className="remove-preview" onClick={resetScanner}><X size={16} /></button>
            </div>
          ) : (
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-placeholder">
                <div className="upload-icon"><Upload size={28} /></div>
                <h3>{isMobile ? 'Tap to select image' : 'Click to upload receipt'}</h3>
                <p className="upload-formats">JPEG, PNG, WebP, HEIC</p>
              </div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} style={{ display: 'none' }} />

          {!preview && (
            <div className="scanner-buttons">
              {isMobile && (
                <button className="scanner-action-btn camera-btn" onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={18} /> Take Photo
                </button>
              )}
              <button className="scanner-action-btn upload-btn" onClick={() => fileInputRef.current?.click()}>
                <Image size={18} /> {isMobile ? 'Gallery' : 'Upload Image'}
              </button>
            </div>
          )}

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
            <h3 className="extracted-title"><Check size={18} /> Data Extracted</h3>
            <p className="extracted-subtitle">Review and edit before saving</p>
            <div className="extracted-form">
              <div className="form-group"><label><Tag size={14} /> Merchant</label><input type="text" value={extractedData.merchant} onChange={(e) => handleFieldChange('merchant', e.target.value)} /></div>
              <div className="form-row">
                <div className="form-group"><label><Calendar size={14} /> Date</label><input type="date" value={extractedData.date} onChange={(e) => handleFieldChange('date', e.target.value)} /></div>
                <div className="form-group"><label><DollarSign size={14} /> Total (P)</label><input type="number" step="0.01" min="0" value={extractedData.total} onChange={(e) => handleFieldChange('total', parseFloat(e.target.value) || 0)} /></div>
              </div>
              <div className="form-group"><label><Tag size={14} /> Category</label><select value={extractedData.category} onChange={(e) => handleFieldChange('category', e.target.value)}>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              {extractedData.items.length > 0 && (
                <div className="items-breakdown"><label><Receipt size={14} /> Items ({extractedData.items.length})</label><div className="items-list">{extractedData.items.map((item, i) => (<div key={i} className="item-row"><span className="item-desc">{item.description}</span><span className="item-amount">P{item.amount.toFixed(2)}</span></div>))}</div></div>
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
            <div className="step"><div className="step-num">1</div><div className="step-content"><h4>{isMobile ? 'Capture' : 'Upload'}</h4><p>{isMobile ? 'Photo or gallery' : 'Upload receipt image'}</p></div></div>
            <div className="step"><div className="step-num">2</div><div className="step-content"><h4>AI Scan</h4><p>3-pass OCR with auto-enhancement</p></div></div>
            <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Save</h4><p>Review, edit, save as transaction</p></div></div>
          </div>
          <div className="scanner-tips">
            <h4><Edit3 size={14} /> Tips</h4>
            <ul>
              <li>Good lighting, no shadows</li>
              <li>Receipt flat, fully visible</li>
              <li>Printed receipts work best</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptScanner;
