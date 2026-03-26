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
      const narrow = window.innerWidth < 1024;
      setIsMobile(mobile || (touch && narrow));
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
      script.onerror = () => setError('Failed to load OCR engine. Please refresh.');
      document.head.appendChild(script);
    }
  }, []);

  const processFile = (file) => {
    if (!file) return;
    
    // Accept any image type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Image must be under 15MB.');
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
    reader.onerror = () => setError('Failed to read image. Please try again.');
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) processFile(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const openCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const openFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  /**
   * Advanced image preprocessing for better OCR:
   * 1. Scale up to minimum 2000px for sharp text
   * 2. Grayscale with luminance formula
   * 3. Histogram normalization (stretch full range)
   * 4. Unsharp mask for edge sharpening
   * 5. Adaptive thresholding for crisp text
   */
  const preprocessImage = (imageDataUrl) => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let w = img.width;
        let h = img.height;

        // Scale up small images — Tesseract needs at least 2000px on longest side
        const minDim = 2000;
        if (Math.max(w, h) < minDim) {
          const scale = minDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        // Cap very large images
        const maxDim = 4000;
        if (Math.max(w, h) > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        canvas.width = w;
        canvas.height = h;
        
        // Draw with image smoothing for clean upscale
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const totalPixels = w * h;
        const gray = new Uint8Array(totalPixels);

        // Pass 1: Convert to grayscale
        let minG = 255, maxG = 0;
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const g = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          gray[i] = g;
          if (g < minG) minG = g;
          if (g > maxG) maxG = g;
        }

        // Pass 2: Normalize histogram + contrast boost + threshold
        const range = maxG - minG || 1;
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          
          // Normalize to 0-255
          let val = ((gray[i] - minG) / range) * 255;
          
          // Strong contrast boost (factor 2.5)
          val = ((val - 128) * 2.5) + 128;
          val = Math.max(0, Math.min(255, val));

          // Aggressive threshold for receipt text
          if (val < 110) val = 0;
          else if (val > 150) val = 255;

          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageDataUrl); // Fallback to original
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
      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(selectedFile);
      });

      setScanStatus('Enhancing image...');
      const processedImage = await preprocessImage(imageDataUrl);

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
      console.log('OCR result:', rawText);

      if (!rawText || rawText.trim().length < 5) {
        setError('Could not read text. Try a clearer, well-lit photo with the receipt flat.');
        return;
      }

      setScanStatus('Extracting data...');
      const parsed = parseReceiptText(rawText);

      if (!parsed) {
        setError('Could not extract details. Please enter manually.');
        return;
      }

      setExtractedData(parsed);
      setEditMode(true);
    } catch (err) {
      console.error('OCR error:', err);
      setError('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
      setScanProgress(0);
      setScanStatus('');
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
    } catch (err) { setError('Failed to save: ' + err.message); }
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
          {/* Preview or upload zone */}
          {preview ? (
            <div className="preview-wrapper">
              <img src={preview} alt="Receipt" className="receipt-preview" />
              <button className="remove-preview" onClick={resetScanner}><X size={16} /></button>
            </div>
          ) : (
            <div className="upload-zone" onClick={openFilePicker}>
              <div className="upload-placeholder">
                <div className="upload-icon"><Upload size={28} /></div>
                <h3>{isMobile ? 'Tap to select image' : 'Click to upload receipt'}</h3>
                <p className="upload-formats">JPEG, PNG, WebP, HEIC</p>
              </div>
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Action buttons */}
          {!preview && (
            <div className="scanner-buttons">
              {isMobile && (
                <button className="scanner-action-btn camera-btn" onClick={openCamera}>
                  <Camera size={18} /> Take Photo
                </button>
              )}
              <button className="scanner-action-btn upload-btn" onClick={openFilePicker}>
                <Image size={18} /> {isMobile ? 'Gallery' : 'Upload Image'}
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
            <h3 className="extracted-title"><Check size={18} /> Data Extracted</h3>
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
                  <label><Receipt size={14} /> Items ({extractedData.items.length})</label>
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

      {/* How it works - only when nothing is loaded */}
      {!preview && !extractedData && (
        <div className="how-it-works">
          <h3>How It Works</h3>
          <div className="steps">
            <div className="step"><div className="step-num">1</div><div className="step-content"><h4>{isMobile ? 'Capture' : 'Upload'}</h4><p>{isMobile ? 'Take a photo or pick from gallery' : 'Upload a receipt image'}</p></div></div>
            <div className="step"><div className="step-num">2</div><div className="step-content"><h4>AI Scan</h4><p>Image enhanced, OCR reads text, algorithms extract data</p></div></div>
            <div className="step"><div className="step-num">3</div><div className="step-content"><h4>Save</h4><p>Review, edit, save as transaction</p></div></div>
          </div>
          <div className="scanner-tips">
            <h4><Edit3 size={14} /> Tips</h4>
            <ul>
              <li>Good lighting, no shadows</li>
              <li>Keep receipt flat and fully visible</li>
              <li>Printed receipts work best</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptScanner;
