// src/utils/importParser.js
// Robust transaction import parser - handles messy real-world spreadsheets.
// Works with bank exports, accounting software, custom templates.
//
// Handles:
// - 30+ column-name variations (Trans Date, Posted, Memo, Debit, Credit, etc.)
// - Income/expense auto-detection from negative amounts or separate debit/credit columns
// - Multiple date formats (ISO, UK, US, Excel serial, month-name)
// - Currency symbol stripping (P, $, €, £, ¥, ₹, etc.)
// - Fuzzy category mapping to app's known categories
// - Returns detailed validation so the UI can show a review step

// ============================================================
// COLUMN NAME DETECTION
// ============================================================
// Each key is a field we want; values are synonyms we accept (case-insensitive)
const COLUMN_SYNONYMS = {
  date: [
    'date', 'transaction date', 'trans date', 'trans. date', 'txn date',
    'posted date', 'posting date', 'post date', 'posted', 'value date',
    'processed date', 'effective date', 'booking date',
    'when', 'day', 'time',
  ],
  description: [
    'description', 'desc', 'memo', 'narrative', 'details', 'particulars',
    'payee', 'merchant', 'vendor', 'name', 'reference', 'ref', 'narration',
    'transaction', 'transaction description', 'label', 'note', 'notes',
  ],
  category: [
    'category', 'cat', 'type of expense', 'classification', 'group', 'tag',
    'expense category', 'budget category',
  ],
  type: [
    'type', 'transaction type', 'txn type', 'direction', 'flow',
    'dr/cr', 'debit/credit',
  ],
  amount: [
    'amount', 'value', 'sum', 'total', 'transaction amount', 'amt',
    'amount (p)', 'amount (usd)', 'amount (eur)', 'amount (gbp)',
  ],
  debit: [
    'debit', 'debits', 'withdrawal', 'withdrawals', 'money out', 'out',
    'paid out', 'expense amount', 'dr',
  ],
  credit: [
    'credit', 'credits', 'deposit', 'deposits', 'money in', 'in',
    'paid in', 'income amount', 'cr',
  ],
  balance: ['balance', 'running balance', 'closing balance', 'bal'],
  currency: [
    'currency', 'ccy', 'curr', 'currency code', 'iso', 'iso code',
  ],
};

// ============================================================
// CURRENCY DETECTION
// ============================================================
// Map of symbol → ISO code. Order matters for ambiguous ones.
const SYMBOL_TO_CODE = [
  { re: /\bBWP\b/i,  code: 'BWP' }, { re: /\bZAR\b/i, code: 'ZAR' },
  { re: /\bUSD\b/i,  code: 'USD' }, { re: /\bGBP\b/i, code: 'GBP' },
  { re: /\bEUR\b/i,  code: 'EUR' }, { re: /\bNGN\b/i, code: 'NGN' },
  { re: /\bKES\b/i,  code: 'KES' }, { re: /\bGHS\b/i, code: 'GHS' },
  { re: /\bTZS\b/i,  code: 'TZS' }, { re: /\bUGX\b/i, code: 'UGX' },
  { re: /\bZMW\b/i,  code: 'ZMW' }, { re: /\bNAD\b/i, code: 'NAD' },
  { re: /\bMWK\b/i,  code: 'MWK' }, { re: /\bCAD\b/i, code: 'CAD' },
  { re: /\bAUD\b/i,  code: 'AUD' }, { re: /\bINR\b/i, code: 'INR' },
  { re: /\bCNY\b/i,  code: 'CNY' }, { re: /\bJPY\b/i, code: 'JPY' },
  { re: /\bBRL\b/i,  code: 'BRL' }, { re: /\bAED\b/i, code: 'AED' },
  { re: /\bEGP\b/i,  code: 'EGP' }, { re: /\bLSL\b/i, code: 'LSL' },
  { re: /\bSZL\b/i,  code: 'SZL' },
  // Symbols — ordered so multi-char ones match first
  { re: /GH₵/i,    code: 'GHS' }, { re: /CA\$/i,   code: 'CAD' },
  { re: /A\$/i,    code: 'AUD' }, { re: /N\$/i,    code: 'NAD' },
  { re: /R\$/i,    code: 'BRL' }, { re: /E£/i,     code: 'EGP' },
  { re: /KSh/i,    code: 'KES' }, { re: /TSh/i,    code: 'TZS' },
  { re: /USh/i,    code: 'UGX' }, { re: /ZK/i,     code: 'ZMW' },
  { re: /MK/i,     code: 'MWK' }, { re: /£/,       code: 'GBP' },
  { re: /€/,       code: 'EUR' }, { re: /₦/,       code: 'NGN' },
  { re: /₹/,       code: 'INR' }, { re: /¥/,       code: 'JPY' }, // JPY wins over CNY — ambiguous
  // $ alone → default USD. Checked last so CA$, A$, N$, R$ win first.
  { re: /\$/,      code: 'USD' },
  // P/R are too ambiguous to auto-detect on their own — leave unmatched.
];

/** Detect ISO currency code from a raw string. Returns code or null. */
export function detectCurrencyCode(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Check if the whole string is a bare ISO code
  const upper = s.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  // Pattern match
  for (const { re, code } of SYMBOL_TO_CODE) {
    if (re.test(s)) return code;
  }
  return null;
}

/** Given parsed rows and detected columns, work out what currency the file is in.
 *  Priority: explicit currency column > symbols in amounts > null (unknown). */
export function detectFileCurrency(rows, detected) {
  const counts = {};
  const bump = (code) => { if (code) counts[code] = (counts[code] || 0) + 1; };

  rows.forEach(r => {
    // Explicit currency column
    if (detected.currency) {
      const c = detectCurrencyCode(r[detected.currency]);
      if (c) { bump(c); return; }
    }
    // Symbols in the amount fields
    if (detected.amount) bump(detectCurrencyCode(r[detected.amount]));
    if (detected.debit)  bump(detectCurrencyCode(r[detected.debit]));
    if (detected.credit) bump(detectCurrencyCode(r[detected.credit]));
  });

  const entries = Object.entries(counts);
  if (entries.length === 0) return { code: null, mixed: false, counts };
  entries.sort((a, b) => b[1] - a[1]);
  // Mixed if 2+ currencies and the top one isn't overwhelmingly dominant
  const topCount = entries[0][1];
  const totalNonTop = entries.slice(1).reduce((s, [, c]) => s + c, 0);
  const mixed = entries.length > 1 && totalNonTop > topCount * 0.1; // > 10% other = mixed
  return { code: entries[0][0], mixed, counts };
}

/** Normalize a header string for matching */
function normaliseKey(k) {
  return String(k || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

/** Given the keys of a parsed row, map our field names → actual column name */
export function detectColumns(rowKeys) {
  const map = {};
  const normalised = rowKeys.map(k => ({ raw: k, norm: normaliseKey(k) }));

  for (const [field, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
    for (const syn of synonyms) {
      const hit = normalised.find(c => c.norm === syn);
      if (hit) { map[field] = hit.raw; break; }
    }
    // Fallback: contains-match
    if (!map[field]) {
      for (const syn of synonyms) {
        const hit = normalised.find(c => c.norm.includes(syn));
        if (hit) { map[field] = hit.raw; break; }
      }
    }
  }
  return map;
}

// ============================================================
// AMOUNT / CURRENCY PARSING
// ============================================================
/** Strip currency symbols, spaces, and parse into a signed number. Returns null if invalid. */
export function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return raw;
  let s = String(raw).trim();
  if (!s) return null;

  // Handle parentheses for negatives: (1,234.56) → -1234.56
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) { negative = true; s = s.slice(1, -1); }

  // Detect explicit sign
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  else if (s.startsWith('+')) { s = s.slice(1); }

  // Strip currency symbols and letters (but keep digits, dots, commas, spaces)
  s = s.replace(/[^\d.,\s-]/g, '').trim();

  // Handle European format (1.234,56) vs US/UK (1,234.56)
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot && lastComma !== -1) {
    // European: comma is decimal separator
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // US/UK: remove commas (thousands separator)
    s = s.replace(/,/g, '');
  }

  s = s.replace(/\s/g, '');
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

// ============================================================
// DATE PARSING
// ============================================================
const MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Robust date parser → returns YYYY-MM-DD string or null */
export function parseDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  // Already a JS Date (from SheetJS cellDates: true)
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Excel serial number (days since 1899-12-30)
  if (typeof raw === 'number' && raw > 1 && raw < 80000) {
    const ms = (raw - 25569) * 86400 * 1000;
    const date = new Date(ms);
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const s = String(raw).trim();
  if (!s) return null;

  // ISO format: 2026-04-14 or 2026/04/14
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  // vs MM/DD/YYYY — we have to guess. Rule: if first number > 12, it's DD. If second > 12, it's MM.
  // Default to DD/MM (UK/EU/BW convention) since MM/DD is mostly US.
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m;
    a = parseInt(a, 10); b = parseInt(b, 10);
    let yy = parseInt(y, 10);
    if (yy < 100) yy += yy > 50 ? 1900 : 2000;

    let day, month;
    if (a > 12 && b <= 12) { day = a; month = b; }
    else if (b > 12 && a <= 12) { month = a; day = b; }
    else { day = a; month = b; } // default DD/MM

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${yy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // "14 Apr 2026", "Apr 14, 2026", "14 April 2026"
  m = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/i);
  if (m) {
    const [, d, mName, y] = m;
    const month = MONTH_NAMES[mName.toLowerCase()];
    if (month) {
      let yy = parseInt(y, 10);
      if (yy < 100) yy += yy > 50 ? 1900 : 2000;
      return `${yy}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  m = s.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/i);
  if (m) {
    const [, mName, d, y] = m;
    const month = MONTH_NAMES[mName.toLowerCase()];
    if (month) {
      let yy = parseInt(y, 10);
      if (yy < 100) yy += yy > 50 ? 1900 : 2000;
      return `${yy}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Last-ditch: try native Date parser
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) {
    const y = d2.getFullYear();
    const mo = String(d2.getMonth() + 1).padStart(2, '0');
    const dd = String(d2.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dd}`;
  }

  return null;
}

// ============================================================
// CATEGORY FUZZY MATCHING
// ============================================================
/** Map of external category → canonical app category.
 * Covers common bank / budgeting app labels. */
const CATEGORY_MAP = {
  // Food & Dining
  'food': 'Food & Dining', 'food & drink': 'Food & Dining', 'dining': 'Food & Dining',
  'restaurants': 'Food & Dining', 'restaurant': 'Food & Dining', 'eating out': 'Food & Dining',
  'coffee': 'Food & Dining', 'takeaway': 'Food & Dining', 'fast food': 'Food & Dining',
  'groceries': 'Groceries', 'supermarket': 'Groceries', 'grocery': 'Groceries',

  // Transportation
  'transport': 'Transportation', 'transportation': 'Transportation', 'fuel': 'Transportation',
  'gas': 'Transportation', 'petrol': 'Transportation', 'diesel': 'Transportation',
  'uber': 'Transportation', 'taxi': 'Transportation', 'parking': 'Transportation',
  'car': 'Transportation', 'auto': 'Transportation', 'vehicle': 'Transportation',
  'public transport': 'Transportation', 'bus': 'Transportation', 'train': 'Transportation',

  // Housing / Utilities
  'rent': 'Housing', 'mortgage': 'Housing', 'housing': 'Housing', 'home': 'Housing',
  'utilities': 'Utilities', 'electricity': 'Utilities', 'power': 'Utilities',
  'water': 'Utilities', 'gas bill': 'Utilities', 'internet': 'Utilities', 'wifi': 'Utilities',
  'phone': 'Utilities', 'mobile': 'Utilities', 'airtime': 'Utilities', 'data': 'Utilities',

  // Entertainment
  'entertainment': 'Entertainment', 'movies': 'Entertainment', 'cinema': 'Entertainment',
  'streaming': 'Entertainment', 'netflix': 'Entertainment', 'spotify': 'Entertainment',
  'games': 'Entertainment', 'gaming': 'Entertainment', 'leisure': 'Entertainment',
  'sports': 'Entertainment', 'hobbies': 'Entertainment',

  // Shopping
  'shopping': 'Shopping', 'clothing': 'Shopping', 'clothes': 'Shopping', 'apparel': 'Shopping',
  'electronics': 'Shopping', 'retail': 'Shopping', 'amazon': 'Shopping', 'online': 'Shopping',

  // Health
  'health': 'Health & Fitness', 'healthcare': 'Health & Fitness', 'medical': 'Health & Fitness',
  'pharmacy': 'Health & Fitness', 'doctor': 'Health & Fitness', 'gym': 'Health & Fitness',
  'fitness': 'Health & Fitness', 'wellness': 'Health & Fitness',

  // Education
  'education': 'Education', 'school': 'Education', 'tuition': 'Education',
  'books': 'Education', 'courses': 'Education', 'training': 'Education',

  // Subscriptions
  'subscriptions': 'Subscriptions', 'subscription': 'Subscriptions',
  'software': 'Subscriptions', 'saas': 'Subscriptions',

  // Personal
  'personal care': 'Personal Care', 'beauty': 'Personal Care', 'hair': 'Personal Care',
  'grooming': 'Personal Care',

  // Travel
  'travel': 'Travel', 'flights': 'Travel', 'hotels': 'Travel', 'accommodation': 'Travel',
  'vacation': 'Travel', 'holiday': 'Travel',

  // Savings / Investments
  'savings': 'Savings', 'investments': 'Investments', 'investment': 'Investments',
  'stocks': 'Investments', 'shares': 'Investments',

  // Gifts
  'gifts': 'Gifts & Donations', 'donations': 'Gifts & Donations', 'charity': 'Gifts & Donations',
  'giving': 'Gifts & Donations',

  // Income
  'income': 'Income', 'salary': 'Income', 'wages': 'Income', 'pay': 'Income',
  'paycheck': 'Income', 'refund': 'Income', 'interest': 'Income',
};

/** Map a raw category string to one of the app's known categories */
export function mapCategory(raw, knownCategories) {
  if (!raw) return { category: 'Other', mapped: false };
  const s = String(raw).trim();
  if (!s) return { category: 'Other', mapped: false };

  // Exact match (case-insensitive)
  const exact = knownCategories.find(c => c.toLowerCase() === s.toLowerCase());
  if (exact) return { category: exact, mapped: false };

  // Lookup in synonym map
  const lower = s.toLowerCase();
  if (CATEGORY_MAP[lower]) return { category: CATEGORY_MAP[lower], mapped: true };

  // Partial match: see if any synonym appears as a word in the value
  for (const [synonym, canonical] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(synonym)) return { category: canonical, mapped: true };
  }

  // Partial match against the known categories themselves
  for (const c of knownCategories) {
    if (lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)) {
      return { category: c, mapped: true };
    }
  }

  return { category: 'Other', mapped: true, original: s };
}

// ============================================================
// INTELLIGENT CATEGORY INFERENCE
// ============================================================
// Waterfall:
// 1. User history (exact or fuzzy match on past transactions)
// 2. Generic keywords (uber, coffee, pharmacy — work across merchants)
// 3. Merchant database (via receiptParser.detectCategory — cold-start fallback)
// 4. 'Other'

// Map receiptParser's category names to the app's canonical categories
const RECEIPT_CATEGORY_ALIAS = {
  'Healthcare': 'Health & Fitness',
  // Others already match the app's category list
};

/** Build a normalised token (lowercased, letters only) used for fuzzy matching */
function tokenize(s) {
  if (!s) return [];
  return String(s).toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3); // ignore very short words
}

/**
 * Build a "learning index" from the user's existing transactions.
 * For each word in past descriptions, track which categories it's been used with.
 *
 * Returns: { byExact: Map<desc→category>, byToken: Map<token→{category: count}> }
 */
export function buildHistoryIndex(pastTransactions) {
  const byExact = new Map();          // exact lowercase description → most frequent category
  const exactCounts = new Map();      // description → {category → count}
  const byToken = new Map();          // token word → {category → count}

  (pastTransactions || []).forEach(t => {
    if (!t || !t.description || !t.category) return;
    const desc = String(t.description).toLowerCase().trim();
    if (!desc) return;

    // Exact description
    if (!exactCounts.has(desc)) exactCounts.set(desc, {});
    const exactEntry = exactCounts.get(desc);
    exactEntry[t.category] = (exactEntry[t.category] || 0) + 1;

    // Token-level (handles partial matches: "CHOPPIES MARULA" ↔ "Choppies Gaborone")
    const tokens = tokenize(desc);
    tokens.forEach(tok => {
      if (!byToken.has(tok)) byToken.set(tok, {});
      const entry = byToken.get(tok);
      entry[t.category] = (entry[t.category] || 0) + 1;
    });
  });

  // Pick the winner for each exact description
  for (const [desc, counts] of exactCounts.entries()) {
    let winner = null, winCount = 0;
    for (const [cat, count] of Object.entries(counts)) {
      if (count > winCount) { winner = cat; winCount = count; }
    }
    if (winner) byExact.set(desc, { category: winner, confidence: winCount / Object.values(counts).reduce((a, b) => a + b, 0), samples: winCount });
  }

  return { byExact, byToken };
}

/** Look up a description in the user's history. Returns category or null. */
export function categoriseFromHistory(description, historyIndex) {
  if (!description || !historyIndex) return null;
  const desc = String(description).toLowerCase().trim();
  if (!desc) return null;

  // 1. Exact match
  if (historyIndex.byExact.has(desc)) {
    const hit = historyIndex.byExact.get(desc);
    return { category: hit.category, source: 'history-exact', confidence: hit.confidence };
  }

  // 2. Token-level voting: tally which category each token suggests
  const tokens = tokenize(desc);
  if (tokens.length === 0) return null;
  const votes = {};
  let totalHits = 0;
  tokens.forEach(tok => {
    if (historyIndex.byToken.has(tok)) {
      const entry = historyIndex.byToken.get(tok);
      for (const [cat, count] of Object.entries(entry)) {
        votes[cat] = (votes[cat] || 0) + count;
        totalHits += count;
      }
    }
  });

  if (totalHits === 0) return null;

  // Pick highest-voted category. Require > 60% share to claim a fuzzy match.
  let winner = null, winCount = 0;
  for (const [cat, count] of Object.entries(votes)) {
    if (count > winCount) { winner = cat; winCount = count; }
  }
  const share = winCount / totalHits;
  if (share < 0.6) return null;

  return { category: winner, source: 'history-fuzzy', confidence: share };
}

/** Generic keyword-based categoriser. No merchant names — only universal words.
 *  Works for a description the user has never seen before IF it contains a generic hint. */
export function categoriseFromKeywords(description) {
  if (!description) return null;
  const s = String(description).toLowerCase();
  if (!s.trim()) return null;

  const KEYWORD_RULES = [
    // Transportation (generic — no merchants)
    { cats: 'Transportation', re: /\b(fuel|petrol|diesel|gasoline|gas\s*station|unleaded|pump|litre|liter|gallon|benzin|essence|carburant|gasolina)\b/ },
    { cats: 'Transportation', re: /\b(uber|lyft|taxi|cab|bus|train|metro|subway|tram|parking|toll|airline|flight|rideshare|car\s*wash|tyre|tire|rental|transport)\b/ },

    // Food & Dining
    { cats: 'Food & Dining', re: /\b(restaurant|cafe|café|coffee|diner|bistro|pizza|burger|chicken|bakery|takeaway|dine|eatery|bar\s*and\s*grill|food\s*court)\b/ },
    { cats: 'Groceries',     re: /\b(grocery|groceries|supermarket|hypermarket|market|food\s*shop|butcher|greengrocer)\b/ },

    // Health & Fitness
    { cats: 'Health & Fitness', re: /\b(pharmacy|pharmacie|apotek|apotheke|farmacia|clinic|hospital|doctor|medical|dentist|chemist|prescription|medicine|vitamin|drug\s*store|gym|fitness|yoga|pilates|wellness|crossfit)\b/ },

    // Shopping
    { cats: 'Shopping', re: /\b(clothing|fashion|shoe|apparel|electronics|department\s*store|boutique|outlet|mall|store)\b/ },

    // Utilities
    { cats: 'Utilities', re: /\b(electric|electricity|power\s*bill|water\s*bill|internet|wifi|broadband|airtime|data\s*bundle|prepaid|recharge|fibre|fiber|telco|telecom|mobile\s*network)\b/ },

    // Entertainment
    { cats: 'Entertainment', re: /\b(cinema|movie|theater|theatre|concert|festival|streaming|bowling|arcade|amusement|gaming|nightclub)\b/ },
    { cats: 'Entertainment', re: /\b(netflix|spotify|disney\+?|hulu|youtube\s*premium|apple\s*music|amazon\s*prime|hbo|paramount)\b/ },

    // Education
    { cats: 'Education', re: /\b(school|university|college|tuition|course|textbook|stationery|library|exam|certification)\b/ },

    // Housing
    { cats: 'Housing', re: /\b(rent|mortgage|lease|landlord|property\s*management|hoa\s*fee|body\s*corporate)\b/ },

    // Subscriptions
    { cats: 'Subscriptions', re: /\b(subscription|monthly\s*plan|annual\s*plan|saas|membership\s*fee)\b/ },

    // Travel
    { cats: 'Travel', re: /\b(hotel|motel|hostel|resort|accommodation|airbnb|booking\.com|expedia|flight|airfare|vacation|holiday)\b/ },

    // Personal Care
    { cats: 'Personal Care', re: /\b(salon|barber|hair|beauty|spa|manicure|pedicure|grooming|cosmetic)\b/ },

    // Savings / Investments
    { cats: 'Savings',     re: /\b(savings\s*deposit|save|emergency\s*fund)\b/ },
    { cats: 'Investments', re: /\b(stock|share|etf|mutual\s*fund|broker|bond|crypto|bitcoin|ethereum|investment\s*account)\b/ },

    // Gifts & Donations
    { cats: 'Gifts & Donations', re: /\b(gift|donation|donate|charity|tithe|offering)\b/ },

    // Income
    { cats: 'Income', re: /\b(salary|payroll|wages|paycheck|stipend|bonus|commission|refund|interest\s*earned|dividend|payout)\b/ },
  ];

  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(s)) return { category: rule.cats, source: 'keyword', confidence: 0.75 };
  }
  return null;
}

/** Cold-start fallback: use the receiptParser's merchant database.
 *  Dynamically imports to avoid circular deps. */
let _receiptDetectCategory = null;
export function setReceiptDetectCategory(fn) {
  // Allow consumer to inject to avoid circular import in tests
  _receiptDetectCategory = fn;
}

/** Community layer: async function that asks Supabase for a crowd-learned category.
 *  Injected by the consumer so this parser stays framework-agnostic. */
let _communityLookup = null;
export function setCommunityLookup(fn) {
  _communityLookup = fn;
}

/** Bulk prefetch: given an array of descriptions, lets the consumer pre-fill
 *  a map of {merchant → {category, confidence}} so we can do a sync lookup.
 *  Caller injects the resolved map before calling smartCategorise. */
let _communityMap = null;
export function setCommunityMap(map) {
  _communityMap = map;  // { normalisedMerchant: { category, confidence, votes } }
}

function normaliseForCommunity(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z\s&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoriseFromCommunity(description) {
  if (!description || !_communityMap) return null;
  const key = normaliseForCommunity(description);
  if (!key || key.length < 3) return null;
  const hit = _communityMap[key];
  if (!hit) return null;
  return { category: hit.category, source: 'community', confidence: hit.confidence };
}

function categoriseFromMerchantDB(description) {
  if (!_receiptDetectCategory || !description) return null;
  try {
    const cat = _receiptDetectCategory(String(description).toLowerCase(), String(description));
    if (cat && cat !== 'Other') {
      return { category: RECEIPT_CATEGORY_ALIAS[cat] || cat, source: 'merchant-db', confidence: 0.7 };
    }
  } catch (e) { /* swallow */ }
  return null;
}

/**
 * Full categorisation waterfall.
 * Priority: history → keywords → community (crowd-learned) → merchant DB → null
 * @returns {{category, source, confidence} | null}
 */
export function smartCategorise(description, historyIndex) {
  if (!description) return null;
  // 1. User's own history
  const fromHistory = categoriseFromHistory(description, historyIndex);
  if (fromHistory) return fromHistory;
  // 2. Generic keywords
  const fromKeywords = categoriseFromKeywords(description);
  if (fromKeywords) return fromKeywords;
  // 3. Community crowd-learned (requires _communityMap to be pre-populated)
  const fromCommunity = categoriseFromCommunity(description);
  if (fromCommunity) return fromCommunity;
  // 4. Hardcoded merchant database fallback
  const fromMerchant = categoriseFromMerchantDB(description);
  if (fromMerchant) return fromMerchant;
  return null;
}

// ============================================================
// MAIN PARSER — takes raw JSON rows, returns structured result
// ============================================================
/**
 * @param {Array<Object>} rows - rows from SheetJS sheet_to_json or CSV parser
 * @param {Array<string>} knownCategories - app's canonical category list
 * @param {{byExact, byToken}} [historyIndex] - optional, built via buildHistoryIndex()
 * @returns {{ ok, rows, stats, errors, detected, currency }}
 */
export function parseImportRows(rows, knownCategories, historyIndex = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false, rows: [], errors: ['No rows found in file.'],
      detected: {}, stats: { total: 0, valid: 0, skipped: 0, mapped: 0, autoCategorised: 0 },
    };
  }

  const keys = Object.keys(rows[0] || {});
  const detected = detectColumns(keys);

  const errors = [];
  if (!detected.date) errors.push('No Date column found. Expected: Date, Transaction Date, Posted Date, etc.');
  if (!detected.amount && !detected.debit && !detected.credit) {
    errors.push('No Amount column found. Expected: Amount, Value, Debit/Credit, or Withdrawal/Deposit.');
  }

  if (errors.length > 0) {
    return {
      ok: false, rows: [], errors, detected,
      stats: { total: rows.length, valid: 0, skipped: rows.length, mapped: 0, autoCategorised: 0 },
    };
  }

  const out = [];
  let skipped = 0, mappedCount = 0, autoCategorised = 0;
  const skippedReasons = [];

  rows.forEach((r, idx) => {
    const rawDate = r[detected.date];
    const date = parseDate(rawDate);
    if (!date) { skipped++; skippedReasons.push(`Row ${idx + 2}: invalid date "${rawDate}"`); return; }

    // Resolve amount + type
    let amount = null;
    let type = null;

    if (detected.debit || detected.credit) {
      const d = detected.debit ? parseAmount(r[detected.debit]) : null;
      const c = detected.credit ? parseAmount(r[detected.credit]) : null;
      if (d && d > 0) { amount = Math.abs(d); type = 'expense'; }
      else if (c && c > 0) { amount = Math.abs(c); type = 'income'; }
    }
    if (amount === null && detected.amount) {
      const raw = parseAmount(r[detected.amount]);
      if (raw !== null) {
        amount = Math.abs(raw);
        type = raw < 0 ? 'expense' : 'income';
      }
    }
    if (amount === null || amount === 0) {
      skipped++; skippedReasons.push(`Row ${idx + 2}: invalid or zero amount`); return;
    }

    // Override type if there's an explicit type column
    if (detected.type) {
      const t = String(r[detected.type] || '').trim().toLowerCase();
      if (t === 'income' || t === 'credit' || t === 'cr' || t === 'deposit' || t === 'in') type = 'income';
      else if (t === 'expense' || t === 'debit' || t === 'dr' || t === 'withdrawal' || t === 'out') type = 'expense';
    }

    // Sensible default if we still don't know
    if (!type) type = 'expense';

    const description = detected.description ? String(r[detected.description] || '').trim() : '';

    const rawCategory = detected.category ? String(r[detected.category] || '').trim() : '';
    const { category, mapped, original } = mapCategory(rawCategory, knownCategories);
    if (mapped) mappedCount++;

    // SMART CATEGORISATION: if we landed on "Other" (or no category column exists),
    // try to infer from the description.
    let finalCategory = category;
    let categorySource = mapped ? 'mapped' : (rawCategory ? 'explicit' : null);

    if ((!rawCategory || finalCategory === 'Other') && description) {
      const smart = smartCategorise(description, historyIndex);
      if (smart && knownCategories.includes(smart.category)) {
        finalCategory = smart.category;
        categorySource = smart.source;
        autoCategorised++;
      }
    }

    // Income without any category inference → "Income"
    if (type === 'income' && !rawCategory && (!categorySource || categorySource === null)) {
      finalCategory = 'Income';
      categorySource = 'income-default';
    }

    // Per-row currency: column > symbol in amount > null
    let rowCurrency = detected.currency ? detectCurrencyCode(r[detected.currency]) : null;
    if (!rowCurrency && detected.amount) rowCurrency = detectCurrencyCode(r[detected.amount]);
    if (!rowCurrency && detected.debit)  rowCurrency = detectCurrencyCode(r[detected.debit]);
    if (!rowCurrency && detected.credit) rowCurrency = detectCurrencyCode(r[detected.credit]);

    out.push({
      date, description, category: finalCategory, type, amount,
      _rowIndex: idx + 2,
      _originalCategory: mapped ? (original || rawCategory) : null,
      _wasMapped: mapped,
      _categorySource: categorySource, // 'explicit', 'mapped', 'history-exact', 'history-fuzzy', 'keyword', 'merchant-db', 'income-default', null
      _sourceCurrency: rowCurrency,
    });
  });

  const currencyInfo = detectFileCurrency(rows, detected);

  return {
    ok: out.length > 0,
    rows: out,
    errors: out.length === 0 ? ['No valid rows could be parsed.'] : [],
    warnings: skippedReasons.slice(0, 5),
    detected,
    currency: currencyInfo,
    stats: {
      total: rows.length,
      valid: out.length,
      skipped,
      mapped: mappedCount,
      autoCategorised, // how many were auto-inferred from description
    },
  };
}

// ============================================================
// SAMPLE TEMPLATE
// ============================================================
export const SAMPLE_TEMPLATE_ROWS = [
  { Date: '2026-04-10', Description: 'Choppies groceries', Category: 'Groceries', Type: 'expense', Amount: 450.00 },
  { Date: '2026-04-11', Description: 'Engen fuel', Category: 'Transportation', Type: 'expense', Amount: 320.00 },
  { Date: '2026-04-12', Description: 'Salary payment', Category: 'Income', Type: 'income', Amount: 5000.00 },
  { Date: '2026-04-13', Description: 'Netflix subscription', Category: 'Entertainment', Type: 'expense', Amount: 119.00 },
];
