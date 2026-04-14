// src/utils/imageProcessor.js
// Optimized image preprocessing for OCR - 2 passes instead of 5

export async function processReceiptImage(imageDataUrl) {
  const img = await loadImage(imageDataUrl);
  const versions = [];

  // Pass 1: Adaptive threshold (handles shadows, uneven lighting)
  versions.push({ label: 'adaptive', data: await adaptiveProcess(img) });

  // Pass 2: High contrast grayscale (handles most normal receipts)
  versions.push({ label: 'contrast', data: await contrastGrayscale(img) });

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

function createCanvas(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let w = img.width;
  let h = img.height;

  // Scale to ~2400px on the long edge for OCR sweet spot.
  // Mobile photos are often too small or too large — both hurt accuracy.
  // Small images upscale with smoothing; very large ones downscale to save CPU.
  const TARGET = 2400;
  const longest = Math.max(w, h);
  if (longest < 1600) {
    const scale = TARGET / longest;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  } else if (longest > 3200) {
    const scale = TARGET / longest;
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

// Pass 1: Adaptive threshold with integral image
async function adaptiveProcess(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  // Light sharpen
  sharpenInPlace(data, w, h);
  const gray = getGrayscale(data, total);

  // Integral image for fast local mean
  const integral = new Float64Array(total);
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      rowSum += gray[i];
      integral[i] = rowSum + (y > 0 ? integral[(y - 1) * w + x] : 0);
    }
  }

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

      const val = gray[i] < (sum / area - C) ? 0 : 255;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

// Pass 2: High contrast grayscale with normalization
async function contrastGrayscale(img) {
  const { canvas, ctx, w, h } = createCanvas(img);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const total = w * h;

  sharpenInPlace(data, w, h);
  const gray = getGrayscale(data, total);

  // Percentile normalization
  const sorted = Array.from(gray).sort((a, b) => a - b);
  const lo = sorted[Math.floor(total * 0.02)];
  const hi = sorted[Math.floor(total * 0.98)];
  const range = hi - lo || 1;

  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    let val = ((gray[i] - lo) / range) * 255;
    val = Math.max(0, Math.min(255, val));
    val = ((val - 128) * 1.5) + 128; // Boost contrast
    val = Math.max(0, Math.min(255, val));
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

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
