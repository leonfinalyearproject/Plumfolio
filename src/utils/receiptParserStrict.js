// src/utils/receiptParserStrict.js
// =============================================================================
// STRICT RECEIPT PARSER
// =============================================================================
// Extracts ONLY three things: merchant, date, total amount.
//
// Guiding principles:
//   1. If uncertain, return null for that field. Don't invent data.
//   2. Anchor to keywords that actually appear on receipts ("TOTAL", date
//      formats, etc). No heuristic scoring of candidate words.
//   3. Reject known junk: VAT numbers, invoice numbers, tax codes, phone
//      numbers — these frequently get mistaken for merchant/total.
//   4. Prefer MULTIPLE confirming signals over a single lucky match.
// =============================================================================

// ----------------------------------------------------------------------------
// TEXT NORMALIZATION
// ----------------------------------------------------------------------------
function normalize(raw) {
  if (!raw) return '';
  return raw
    .replace(/\r/g, '')
    // OCR glyph fixes
    .replace(/[|\\{}\[\]`~^<>]/g, ' ')
    .replace(/\bO(?=\d)/g, '0')       // O before digit → 0
    .replace(/(?<=\d)O\b/g, '0')       // O after digit → 0
    .replace(/(?<=\d)[lI](?=\d)/g, '1') // l/I between digits → 1
    // Collapse spaces around decimals: "1 . 50" → "1.50"
    .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
    .replace(/(\d)\s*,\s*(\d)/g, '$1,$2')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function getLines(text) {
  return text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

// ----------------------------------------------------------------------------
// MERCHANT EXTRACTION
// ----------------------------------------------------------------------------
// Strategy: the merchant name almost always appears in the first 1-5 lines,
// OR in the last 2-4 lines (often "Thank you for shopping at X"). We look in
// both zones, reject noise, and pick the best multi-word candidate.
//
// Noise keywords (not a merchant):
const MERCHANT_NOISE_RE = /\b(receipt|invoice|ticket|tax\s*invoice|welcome\s*to|thank\s*you|vat\s*no|vat\s*num|reg\s*no|tel|phone|email|address|customer\s*copy|original|duplicate|cashier|attendant|pump|date|time|til|terminal|till|order|table|vat[\s:=]|tax[\s:=]|total|subtotal|sub\-total|amount|change|cash|card|visa|master|mastercard|debit|credit|balance|items?[\s:]|qty|quantity|discount|saving|loyalty|points|round|shift|trans|ref|auth|code)\b/i;

// Matches a VAT number, phone number, long serial: reject these as merchants
const SERIAL_RE = /^[A-Z]*\d{6,}[A-Z0-9]*$/;

function scoreMerchantLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 50) return 0;

  // Reject pure digits, codes, serial numbers
  if (/^\d+$/.test(trimmed)) return 0;
  if (SERIAL_RE.test(trimmed.replace(/\s/g, ''))) return 0;

  // Reject lines that are mostly numbers (VAT, phone)
  const digitRatio = (trimmed.match(/\d/g) || []).length / trimmed.length;
  if (digitRatio > 0.4) return 0;

  // Reject noise keywords
  if (MERCHANT_NOISE_RE.test(trimmed)) return 0;

  // Reject lines with currency symbols (they're amounts, not merchants)
  if (/[P$€£¥₹₩]\s*\d/.test(trimmed)) return 0;

  // Must have at least one word of 3+ letters
  const letterWords = trimmed.split(/\s+/).filter(w => /^[A-Za-z&'.-]{3,}$/.test(w));
  if (letterWords.length === 0) return 0;

  let score = 10;
  // Boost for multi-word business names
  score += letterWords.length * 5;
  // Boost for ALL CAPS (common on receipt headers)
  if (trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed)) score += 10;
  // Boost for well-known store-type words
  if (/\b(filling\s*station|petrol|fuel|mart|store|shop|restaurant|cafe|bakery|grocery|supermarket|pharmacy|hotel|market|centre|center)\b/i.test(trimmed)) score += 15;
  return score;
}

function extractMerchant(lines) {
  const candidates = [];

  // Zone 1: first 6 lines (receipt header — where the name usually lives)
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const s = scoreMerchantLine(lines[i]);
    if (s > 0) candidates.push({ line: lines[i], score: s + (6 - i), zone: 'header' });
  }

  // Zone 2: last 4 lines (footer — "Thank you for shopping at X")
  for (let i = Math.max(0, lines.length - 4); i < lines.length; i++) {
    const line = lines[i];
    // Look for "shopping at X" or "visit again" patterns
    const shoppingAt = line.match(/(?:shopping|visit)\s+(?:at|to)\s+([A-Z][A-Z\s&'.-]{2,40})/i);
    if (shoppingAt) {
      const name = shoppingAt[1].replace(/\*+/g, '').trim();
      if (name.length >= 3 && !MERCHANT_NOISE_RE.test(name)) {
        candidates.push({ line: name, score: 50, zone: 'footer-shopping-at' });
      }
    }
    // Also score the line itself (some receipts end with "** SHELL ACACIA **")
    const cleaned = line.replace(/\*+/g, '').trim();
    const s = scoreMerchantLine(cleaned);
    if (s > 0) candidates.push({ line: cleaned, score: s + 5, zone: 'footer' });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  // Title-case the result for display consistency (SHELL ACACIA → Shell Acacia)
  return toTitleCase(best.line);
}

function toTitleCase(s) {
  return s.replace(/\b([A-Z]+)\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
}

// ----------------------------------------------------------------------------
// DATE EXTRACTION
// ----------------------------------------------------------------------------
// Looks for: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD, and
// "DD Month YYYY" / "Month DD, YYYY". Returns ISO YYYY-MM-DD.
// Returns null if no valid date found. Rejects dates in the future or older
// than 3 years.

const MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function extractDate(text) {
  const candidates = [];

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (and with 2-digit year)
  const numericRe = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g;
  let m;
  while ((m = numericRe.exec(text)) !== null) {
    let [, a, b, y] = m;
    a = parseInt(a, 10); b = parseInt(b, 10); y = parseInt(y, 10);
    if (y < 100) y += 2000;
    // Ambiguity: could be DD/MM or MM/DD. Heuristic: if a > 12, must be DD/MM.
    // Receipts in Botswana/SA/Europe use DD/MM. We prefer DD/MM.
    if (a > 31 || b > 31) continue;
    let day, month;
    if (a > 12 && b <= 12) { day = a; month = b; }
    else if (b > 12 && a <= 12) { day = b; month = a; } // could be YYYY-MM-DD first
    else { day = a; month = b; }  // default DD/MM
    const iso = formatIsoDate(y, month, day);
    if (iso) candidates.push(iso);
  }

  // YYYY-MM-DD (explicit ISO)
  const isoRe = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  while ((m = isoRe.exec(text)) !== null) {
    const [, y, mo, d] = m;
    const iso = formatIsoDate(parseInt(y, 10), parseInt(mo, 10), parseInt(d, 10));
    if (iso) candidates.push(iso);
  }

  // DD Month YYYY or Month DD YYYY
  const textualRe = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{2,4})\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})[,\s]+(\d{2,4})\b/gi;
  while ((m = textualRe.exec(text)) !== null) {
    let day, monthName, year;
    if (m[1]) { day = parseInt(m[1], 10); monthName = m[2].toLowerCase(); year = parseInt(m[3], 10); }
    else { monthName = m[4].toLowerCase(); day = parseInt(m[5], 10); year = parseInt(m[6], 10); }
    if (year < 100) year += 2000;
    const month = MONTH_NAMES[monthName];
    const iso = formatIsoDate(year, month, day);
    if (iso) candidates.push(iso);
  }

  if (candidates.length === 0) return null;

  // Keep only sensible dates (not future, not older than 3 years)
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const cutoff = new Date(today.getFullYear() - 3, 0, 1);

  const valid = candidates.filter(d => {
    const dt = new Date(d + 'T12:00:00');
    return dt >= cutoff && dt <= today;
  });

  if (valid.length === 0) return null;

  // Pick the most frequent, then the earliest (dates on receipts often appear
  // multiple times — print time, transaction date, etc)
  const freq = {};
  valid.forEach(d => { freq[d] = (freq[d] || 0) + 1; });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted[0][0];
}

function formatIsoDate(year, month, day) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  // Validate day-of-month
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ----------------------------------------------------------------------------
// TOTAL EXTRACTION
// ----------------------------------------------------------------------------
// Strategy: find lines with "TOTAL" (NOT "SUBTOTAL", not "VAT", not "TAX").
// Take the rightmost numeric value on that line. If no TOTAL line, look for
// "Amount Due" / "Balance" / "Paid". If still nothing, return null and let
// the user enter it manually — do NOT guess from "largest number on page"
// because that catches VAT numbers, phone numbers, etc.

// Returns number value or null
function parseAmount(s) {
  if (!s) return null;
  // Strip currency symbols and whitespace
  let cleaned = String(s).replace(/[P$€£¥₹₩R\s]/g, '').trim();
  if (!cleaned) return null;

  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  if (hasDot && hasComma) {
    // Determine which is the decimal separator by position (rightmost one)
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      // European: "1.234,56" → "1234.56"
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: "1,234.56" → "1234.56"
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    // Could be "7,75" (European decimal) or "1,234" (US thousands).
    // Heuristic: if exactly 1-2 digits after the last comma, it's decimal.
    const parts = cleaned.split(',');
    const last = parts[parts.length - 1];
    if (last.length <= 2) {
      cleaned = cleaned.replace(/,/g, '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  // else: hasDot only or neither — already correct

  const n = parseFloat(cleaned);
  if (!isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

// Extract all numeric amounts from a single line (respecting decimals)
function amountsInLine(line) {
  // Try European "7,75" and "1.234,56" formats first when the line has commas
  // as the decimal separator AND no period-decimal numbers
  const euRe = /\d{1,3}(?:\.\d{3})*,\d{1,2}|\d+,\d{1,2}/g;
  const stdRe = /\d{1,3}(?:,\d{3})*\.\d{1,2}|\d+\.\d{1,2}/g;
  const intRe = /\b\d{2,}\b/g;

  // Prefer period-decimals if present; fall back to European if not; fall
  // back to integers only as last resort.
  const std = line.match(stdRe);
  if (std && std.length > 0) {
    return std.map(parseAmount).filter(v => v !== null && v > 0);
  }
  const eu = line.match(euRe);
  if (eu && eu.length > 0) {
    return eu.map(parseAmount).filter(v => v !== null && v > 0);
  }
  const ints = line.match(intRe);
  if (ints && ints.length > 0) {
    return ints.map(parseAmount).filter(v => v !== null && v > 0);
  }
  return [];
}

const TOTAL_RE = /\btotal\b/i;
const SUBTOTAL_RE = /\b(sub[-\s]?total)\b/i;
// Lines that look like TOTAL but aren't:
const FAKE_TOTAL_RE = /\b(vat|tax|code|net|gross|change|items?|qty|quantity|discount|saving|round|cash\s*back)\b/i;

function extractTotal(lines) {
  // Pass 1: lines containing "total" but NOT subtotal/VAT/tax
  const primaryCandidates = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!TOTAL_RE.test(line)) continue;
    if (SUBTOTAL_RE.test(line)) continue;
    if (FAKE_TOTAL_RE.test(line) && !/\bgrand\s*total\b/i.test(line)) continue;

    const amounts = amountsInLine(line);
    if (amounts.length > 0) {
      // The total on a TOTAL line is the rightmost number (column layout)
      primaryCandidates.push(amounts[amounts.length - 1]);
    } else if (i + 1 < lines.length) {
      // "TOTAL" on its own line, amount on the next
      const nextAmounts = amountsInLine(lines[i + 1]);
      if (nextAmounts.length > 0) primaryCandidates.push(nextAmounts[nextAmounts.length - 1]);
    }
  }

  if (primaryCandidates.length > 0) {
    // Prefer the LAST total line's amount (grand total usually appears late)
    return primaryCandidates[primaryCandidates.length - 1];
  }

  // Pass 2: "Amount Due" / "Balance" / "Paid"
  const SECONDARY_RE = /\b(amount\s*(?:due|payable)|balance|paid|payment)\b/i;
  for (const line of lines) {
    if (SECONDARY_RE.test(line) && !/change/i.test(line)) {
      const amounts = amountsInLine(line);
      if (amounts.length > 0) return amounts[amounts.length - 1];
    }
  }

  // Pass 3: "TENDERED" or "CREDIT CARD" with amount (what the customer paid)
  const TENDER_RE = /\b(tendered|credit\s*card|debit\s*card|cash|visa|master)\b/i;
  for (const line of lines) {
    if (TENDER_RE.test(line) && !/change/i.test(line)) {
      const amounts = amountsInLine(line);
      if (amounts.length > 0) return amounts[amounts.length - 1];
    }
  }

  // No confident match — return null. Never guess from largest number.
  return null;
}

// ----------------------------------------------------------------------------
// CATEGORY DETECTION (simple keyword → category)
// ----------------------------------------------------------------------------
const CATEGORY_RULES = [
  { cat: 'Transportation', re: /\b(fuel|petrol|diesel|filling\s*station|gas\s*station|shell|bp|engen|caltex|sasol|total\s*(?:garage|energies)|puma\s*energy|uber|bolt|taxi|parking)\b/i },
  { cat: 'Groceries',      re: /\b(grocery|groceries|supermarket|shoprite|spar|woolworths|pick\s*n\s*pay|choppies|sefalana|checkers|food\s*lovers|fresh\s*mark)\b/i },
  { cat: 'Food & Dining',  re: /\b(restaurant|cafe|coffee|bakery|pizza|burger|kfc|mcdonald|nandos|steers|wimpy|ocean\s*basket|spur)\b/i },
  { cat: 'Health & Fitness', re: /\b(pharmacy|clicks|dis-?chem|hospital|clinic|doctor|dental|gym|fitness)\b/i },
  { cat: 'Utilities',      re: /\b(electricity|water|wifi|internet|fibre|airtime|data\s*bundle|bpc|water\s*utilities)\b/i },
  { cat: 'Shopping',       re: /\b(mr\s*price|woolworths|edgars|truworths|foschini|jet|ackermans|pep|cashbuild|game|makro|takealot)\b/i },
  { cat: 'Entertainment',  re: /\b(cinema|movies|ster.?kinekor|netflix|spotify|showmax|dstv)\b/i },
];

function detectCategory(text) {
  for (const { cat, re } of CATEGORY_RULES) {
    if (re.test(text)) return cat;
  }
  return 'Other';
}

// ----------------------------------------------------------------------------
// MAIN ENTRY POINT
// ----------------------------------------------------------------------------
// Returns { merchant, date, total, category }, with null for any field that
// couldn't be confidently extracted. The UI should prompt the user to fill
// in missing fields manually rather than saving bad data.

export function parseReceiptStrict(rawText) {
  if (!rawText || rawText.trim().length < 5) {
    return { merchant: null, date: null, total: null, category: 'Other', confidence: 'none' };
  }

  const normalized = normalize(rawText);
  const lines = getLines(normalized);

  const merchant = extractMerchant(lines);
  const date = extractDate(normalized);
  const total = extractTotal(lines);
  const category = detectCategory(normalized);

  // Confidence: high = all 3 extracted; medium = 2; low = 1; none = 0
  const hits = [merchant, date, total].filter(Boolean).length;
  const confidence = hits === 3 ? 'high' : hits === 2 ? 'medium' : hits === 1 ? 'low' : 'none';

  return { merchant, date, total, category, confidence };
}

// Keep compatibility with old imports
export { detectCategory };
export default parseReceiptStrict;
