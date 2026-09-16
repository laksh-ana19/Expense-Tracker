import Tesseract from 'tesseract.js';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.78;

/**
 * Resizes + compresses an image file into a JPEG data URL. Keeps the receipt
 * legible for OCR while keeping the payload small enough to store alongside
 * the transaction document.
 */
export function compressImage(file, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Could not read the image file.'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('Could not decode the image file.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // flatten transparency before JPEG encoding
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Matches amounts like ₹1,234.50 / Rs. 1234 / INR 999.00 / plain 1234.50
const AMOUNT_PATTERN = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:₹|rs\.?|inr)/gi;
const TOTAL_LINE_KEYWORDS = /\b(grand\s*total|net\s*amount|total\s*amount|amount\s*due|balance\s*due|total)\b/i;

function extractAmount(text) {
  const lines = text.split('\n');
  // Prefer a number on a line that mentions "total" / "amount due" etc.
  for (const line of lines) {
    if (TOTAL_LINE_KEYWORDS.test(line)) {
      const matches = [...line.matchAll(AMOUNT_PATTERN)];
      if (matches.length) {
        const raw = (matches[matches.length - 1][1] || matches[matches.length - 1][2] || '').replace(/,/g, '');
        const value = Number(raw);
        if (!Number.isNaN(value) && value > 0) return value;
      }
      // Fall back to any trailing number on that line, even without a currency symbol.
      const numMatch = line.match(/([\d,]+\.\d{2})\s*$/) || line.match(/([\d,]+)\s*$/);
      if (numMatch) {
        const value = Number(numMatch[1].replace(/,/g, ''));
        if (!Number.isNaN(value) && value > 0) return value;
      }
    }
  }
  // No labelled total found — fall back to the largest currency-looking number in the whole text.
  const allMatches = [...text.matchAll(AMOUNT_PATTERN)];
  const values = allMatches
    .map((m) => Number((m[1] || m[2] || '').replace(/,/g, '')))
    .filter((v) => !Number.isNaN(v) && v > 0);
  if (values.length) return Math.max(...values);
  return null;
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function pad2(n) { return String(n).padStart(2, '0'); }

function toIsoDate(y, mIdx, d) {
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(year, mIdx, d);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null; // ignore obviously-future OCR misreads
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function extractDate(text) {
  // "12 Jan 2024" / "12-Jan-2024"
  let m = text.match(/\b(\d{1,2})[\s-]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,-]+(\d{2,4})\b/i);
  if (m) {
    const iso = toIsoDate(Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]));
    if (iso) return iso;
  }
  // "DD/MM/YYYY" or "DD-MM-YYYY" (day-first, most common on Indian receipts)
  m = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = toIsoDate(year, month - 1, day);
      if (iso) return iso;
    }
  }
  // "YYYY-MM-DD"
  m = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const iso = toIsoDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (iso) return iso;
  }
  return null;
}

function guessNote(text) {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length >= 3 && /[a-zA-Z]/.test(l) && !TOTAL_LINE_KEYWORDS.test(l));
  if (!line) return '';
  return line.slice(0, 80);
}

/**
 * Runs OCR on a (already compressed) image data URL and pulls out a best-guess
 * amount, date, and note. Any of these can come back null/empty — the caller
 * always leaves the form editable so the person can correct or fill gaps.
 */
export async function scanReceipt(dataUrl, { onProgress } = {}) {
  const { data } = await Tesseract.recognize(dataUrl, 'eng', {
    logger: (msg) => {
      if (onProgress && msg.status === 'recognizing text') onProgress(msg.progress);
    },
  });
  const text = data.text || '';
  return {
    amount: extractAmount(text),
    date: extractDate(text),
    note: guessNote(text),
    rawText: text,
  };
}

/** Opens a data-URL image in a new tab (works around browsers blocking direct data: navigation). */
export function openDataUrlInNewTab(dataUrl) {
  fetch(dataUrl)
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    })
    .catch(() => {
      // Best-effort viewer — silently ignore if it fails.
    });
}
