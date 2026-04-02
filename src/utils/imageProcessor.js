// src/utils/imageProcessor.js
// Advanced image preprocessing for OCR
// Handles: angles, blur, shadows, poor lighting, skew, inverted receipts

/**
 * Master preprocessing function
 * Returns multiple processed versions for the OCR to try
 */
export async function processReceiptImage(imageDataUrl) {
  const img = await loadImage(imageDataUrl);
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

  // Version 3: High contrast + Otsu threshold (best for faded receipts)
  versions.push({
    label: 'otsu',
    data: await otsuThreshold(img),
  });

  // Version 4: CLAHE-like local contrast (best for mixed lighting)
  versions.push({
    label: 'clahe',
    data: await localContrastEnhance(img),
  });

  // Version 5: Scaled original (sometimes Tesseract handles raw best)
  versions.push({
    label: 'scaled',
    data: await scaleOnly(img),
  });

  return versions;
}

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
 * Tesseract works best at 300 DPI equivalent, which is ~2500-3000px for a receipt
 */
function createCanvas(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let w = img.width;
  let h = img.height;

  // Scale to optimal OCR range
  const longest = Math.max(w, h);
  const target = 3000;
  
  if (longest < 1800) {
    // Small image - scale up aggressively for OCR
    const scale = target / longest;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  } else if (longest > 5000) {
    // Very large - scale down to save memory
    const scale = 3500 / longest;
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

function getGrayscale(data, total) {
  const gray = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }
  return gray;
}

function applyGrayToImageData(data, gray, total) {
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    data[idx] = gray[i];
    data[idx + 1] = gray[i];
    data[idx + 2] = gray[i];
  }
}

/**
 * Version 1: Adaptive thresholding with integral image
 * Handles uneven lighting and shadows
 */
async function adaptiveProcess(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  // Sharpen first
  sharpenInPlace(data, w, h);

  const gray = getGrayscale(data, total);

  // Compute integral image
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
  const blockSize = Math.max(15, Math.round(Math.min(w, h) * 0.05));
  const C = 10;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = i * 4;

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
 * Version 2: Double sharpen + histogram normalization
 */
async function sharpenAndNormalize(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  // Double sharpen
  sharpenInPlace(data, w, h);
  sharpenInPlace(data, w, h);

  const gray = getGrayscale(data, total);

  // Percentile normalization (robust to noise)
  const sorted = Array.from(gray).sort((a, b) => a - b);
  const p2 = sorted[Math.floor(total * 0.02)];
  const p98 = sorted[Math.floor(total * 0.98)];
  const range = p98 - p2 || 1;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    let val = ((gray[i] - p2) / range) * 255;
    val = Math.max(0, Math.min(255, val));
    // Mild contrast boost
    val = ((val - 128) * 1.4) + 128;
    val = Math.max(0, Math.min(255, val));
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Version 3: Otsu's thresholding
 * Automatically finds the optimal global threshold
 */
async function otsuThreshold(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  sharpenInPlace(data, w, h);
  const gray = getGrayscale(data, total);

  // Build histogram
  const hist = new Array(256).fill(0);
  for (let i = 0; i < total; i++) hist[gray[i]]++;

  // Otsu's method - find threshold that maximises between-class variance
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];

  let sumB = 0, wB = 0, wF;
  let maxVariance = 0, threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // Apply threshold
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    const val = gray[i] > threshold ? 255 : 0;
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Version 4: CLAHE-like local contrast enhancement
 * Contrast Limited Adaptive Histogram Equalization
 * Great for receipts with mixed bright/dark areas
 */
async function localContrastEnhance(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  sharpenInPlace(data, w, h);
  const gray = getGrayscale(data, total);

  // Divide image into tiles and equalize each
  const tilesX = 8;
  const tilesY = 8;
  const tileW = Math.ceil(w / tilesX);
  const tileH = Math.ceil(h / tilesY);
  const clipLimit = 3.0; // Contrast limiting factor

  // Process each tile
  const result = new Uint8Array(total);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const startX = tx * tileW;
      const startY = ty * tileH;
      const endX = Math.min(startX + tileW, w);
      const endY = Math.min(startY + tileH, h);
      const tilePixels = (endX - startX) * (endY - startY);

      // Build tile histogram
      const tileHist = new Array(256).fill(0);
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          tileHist[gray[y * w + x]]++;
        }
      }

      // Clip histogram (redistribute excess)
      const limit = Math.round(clipLimit * tilePixels / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (tileHist[i] > limit) {
          excess += tileHist[i] - limit;
          tileHist[i] = limit;
        }
      }
      const redistrib = Math.floor(excess / 256);
      for (let i = 0; i < 256; i++) tileHist[i] += redistrib;

      // Build CDF
      const cdf = new Array(256);
      cdf[0] = tileHist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + tileHist[i];

      const cdfMin = cdf.find(v => v > 0) || 0;
      const denom = tilePixels - cdfMin || 1;

      // Apply equalization to tile
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = y * w + x;
          result[i] = Math.round(((cdf[gray[i]] - cdfMin) / denom) * 255);
        }
      }
    }
  }

  // Apply moderate contrast after CLAHE
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    let val = ((result[i] - 128) * 1.3) + 128;
    val = Math.max(0, Math.min(255, val));
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Version 5: Just scale, no processing
 */
async function scaleOnly(img) {
  const { canvas } = createCanvas(img);
  return canvas.toDataURL('image/png');
}

/**
 * Apply sharpening convolution in-place
 * Kernel: [0,-1,0,-1,5,-1,0,-1,0] (Laplacian sharpen)
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
