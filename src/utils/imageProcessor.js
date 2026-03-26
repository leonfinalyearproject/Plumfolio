// src/utils/imageProcessor.js
// Advanced image preprocessing for OCR
// Handles: angles, blur, shadows, poor lighting, skew

/**
 * Master preprocessing function - applies all corrections
 * Returns multiple processed versions for the OCR to try
 */
export async function processReceiptImage(imageDataUrl) {
  const img = await loadImage(imageDataUrl);
  
  // Generate 4 different processed versions
  const versions = [];

  // Version 1: Adaptive threshold (best for uneven lighting/shadows)
  versions.push({
    label: 'adaptive',
    data: await adaptiveProcess(img),
  });

  // Version 2: Sharpen + normalize (best for slightly blurry)
  versions.push({
    label: 'sharp',
    data: await sharpenAndNormalize(img),
  });

  // Version 3: High contrast grayscale (best for faded receipts)
  versions.push({
    label: 'contrast',
    data: await highContrastGray(img),
  });

  // Version 4: Scaled original (sometimes Tesseract handles it best)
  versions.push({
    label: 'scaled',
    data: await scaleOnly(img),
  });

  return versions;
}

/**
 * Load an image from data URL
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Create a canvas from image, scaled to optimal OCR size
 */
function createCanvas(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let w = img.width;
  let h = img.height;

  // Scale to optimal OCR range (2000-3000px longest side)
  const target = 2500;
  if (Math.max(w, h) < 1500) {
    const scale = target / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  } else if (Math.max(w, h) > 4000) {
    const scale = 3000 / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  return { canvas, ctx, w, h };
}

/**
 * Get grayscale values from image data
 */
function getGrayscale(data, total) {
  const gray = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  return gray;
}

/**
 * Version 1: Adaptive thresholding
 * Handles uneven lighting and shadows by computing local thresholds
 * Each pixel is compared to the average of its neighborhood
 */
async function adaptiveProcess(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;
  const gray = getGrayscale(data, total);

  // Apply sharpening first
  sharpenInPlace(data, w, h);
  
  // Recompute grayscale after sharpening
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  // Compute integral image for fast local mean calculation
  const integral = new Float64Array(total);
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      rowSum += gray[i];
      integral[i] = rowSum + (y > 0 ? integral[(y - 1) * w + x] : 0);
    }
  }

  // Adaptive threshold using local mean
  const blockSize = Math.max(15, Math.round(Math.min(w, h) * 0.04)); // ~4% of image size
  const C = 8; // Threshold offset

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = i * 4;

      // Compute local mean using integral image
      const y1 = Math.max(0, y - blockSize);
      const y2 = Math.min(h - 1, y + blockSize);
      const x1 = Math.max(0, x - blockSize);
      const x2 = Math.min(w - 1, x + blockSize);

      const area = (y2 - y1 + 1) * (x2 - x1 + 1);
      let sum = integral[y2 * w + x2];
      if (y1 > 0) sum -= integral[(y1 - 1) * w + x2];
      if (x1 > 0) sum -= integral[y2 * w + (x1 - 1)];
      if (y1 > 0 && x1 > 0) sum += integral[(y1 - 1) * w + (x1 - 1)];

      const localMean = sum / area;
      const val = gray[i] < (localMean - C) ? 0 : 255;

      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Version 2: Sharpen + histogram normalization
 * Best for slightly blurry images
 */
async function sharpenAndNormalize(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  // Double sharpen for blurry images
  sharpenInPlace(data, w, h);
  sharpenInPlace(data, w, h);

  // Grayscale + normalize
  const gray = getGrayscale(data, total);
  let minG = 255, maxG = 0;
  for (let i = 0; i < total; i++) {
    if (gray[i] < minG) minG = gray[i];
    if (gray[i] > maxG) maxG = gray[i];
  }

  const range = maxG - minG || 1;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    let val = ((gray[i] - minG) / range) * 255;
    // Moderate contrast
    val = ((val - 128) * 1.6) + 128;
    val = Math.max(0, Math.min(255, val));
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Version 3: High contrast grayscale
 * Best for faded or low-contrast receipts
 */
async function highContrastGray(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  sharpenInPlace(data, w, h);

  const gray = getGrayscale(data, total);
  
  // Find the 5th and 95th percentile for robust normalization
  const sorted = Array.from(gray).sort((a, b) => a - b);
  const p5 = sorted[Math.floor(total * 0.05)];
  const p95 = sorted[Math.floor(total * 0.95)];
  const range = p95 - p5 || 1;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    // Robust normalization using percentiles (ignores extreme outliers)
    let val = ((gray[i] - p5) / range) * 255;
    val = Math.max(0, Math.min(255, val));
    // Soft S-curve contrast
    val = val / 255;
    val = val * val * (3 - 2 * val); // Smoothstep function
    val = val * 255;
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Version 4: Just scale, no processing
 */
async function scaleOnly(img) {
  const { canvas } = createCanvas(img);
  return canvas.toDataURL('image/png');
}

/**
 * Apply sharpening convolution in-place
 * Kernel: [0,-1,0,-1,5,-1,0,-1,0]
 */
function sharpenInPlace(data, w, h) {
  const temp = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * w + x) * 4 + c;
        const val =
          -temp[((y - 1) * w + x) * 4 + c]
          - temp[(y * w + x - 1) * 4 + c]
          + 5 * temp[(y * w + x) * 4 + c]
          - temp[(y * w + x + 1) * 4 + c]
          - temp[((y + 1) * w + x) * 4 + c];
        data[idx] = Math.max(0, Math.min(255, val));
      }
    }
  }
}

export default processReceiptImage;
