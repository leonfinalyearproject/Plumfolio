// src/utils/receiptParser.js
// Global receipt parser - extracts merchant, date, items, total, currency, category
// Supports all world currencies and any merchant/shop globally.
// Known merchants are a fast-path; unknown merchants are detected heuristically.

// ============================================================
// CURRENCY SUPPORT - all major world currencies
// ============================================================

const CURRENCY_SYMBOLS = [
  // Multi-char ISO codes
  'BWP', 'ZAR', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'NZD',
  'INR', 'KRW', 'SGD', 'HKD', 'MXN', 'BRL', 'RUB', 'TRY', 'AED', 'SAR',
  'NGN', 'KES', 'GHS', 'EGP', 'MAD', 'TZS', 'UGX', 'ZMW', 'NAD', 'MWK',
  'THB', 'IDR', 'MYR', 'PHP', 'VND', 'PKR', 'BDT', 'LKR', 'NOK', 'SEK', 'DKK',
  'PLN', 'CZK', 'HUF', 'RON', 'ILS', 'CLP', 'COP', 'PEN', 'ARS',
  // Multi-char symbols
  'R$', 'Rs', 'kr', 'zł',
];

// Single-char currency symbols class (used inside regex)
const CURRENCY_CHAR_CLASS = '[P$R€£¥₹₩₪₨₫₴₦₱₲₵₸₺₼₾฿]';

// Build optional currency-prefix regex piece (e.g. "P 12.50", "$12.50", "USD 12.50", "Rs 1,200")
const CURRENCY_PREFIX_RE = new RegExp(
  `(?:${CURRENCY_SYMBOLS.map(s => s.replace(/\$/g, '\\$').replace(/\./g, '\\.')).join('|')}|${CURRENCY_CHAR_CLASS})\\s*`,
  'i'
);
const CURRENCY_PREFIX_OPT = `(?:${CURRENCY_SYMBOLS.map(s => s.replace(/\$/g, '\\$').replace(/\./g, '\\.')).join('|')}|${CURRENCY_CHAR_CLASS})?\\s*`;

// ============================================================
// MAIN PARSER
// ============================================================

export function parseReceiptText(rawText) {
  if (!rawText || rawText.trim().length < 5) return null;

  let cleaned = rawText
    .replace(/[|\\}{[\]`~^]/g, ' ')
    .replace(/(\r\n|\r)/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/[oO](\.\d{2})/g, '0$1')
    .replace(/(\d)[lI](\d)/g, '$1l$2')
    .trim();

  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = cleaned.toLowerCase();

  const merchant = extractMerchant(lines, fullText);
  const date = extractDate(lines, cleaned);
  const { items, total, currency } = extractAmountsAndTotal(lines, rawText, cleaned);
  const category = detectCategory(fullText, merchant);

  return {
    merchant,
    date,
    items,
    total,
    currency,
    category,
    rawText,
  };
}

// ============================================================
// MERCHANT EXTRACTION
// ============================================================

function extractMerchant(lines, fullText) {
  // Known global brands - fast path. Unknown shops still detected by fallback.
  const knownMerchants = [
    // Fuel
    { pattern: /\bengen\b/i, name: 'Engen' },
    { pattern: /\bshell\b/i, name: 'Shell' },
    { pattern: /total\s*energies|total\s*garage/i, name: 'TotalEnergies' },
    { pattern: /puma\s*energy/i, name: 'Puma Energy' },
    { pattern: /\bcaltex\b/i, name: 'Caltex' },
    { pattern: /\bsasol\b/i, name: 'Sasol' },
    { pattern: /\bbp\b/i, name: 'BP' },
    { pattern: /\bexxon\b/i, name: 'Exxon' },
    { pattern: /\bmobil\b/i, name: 'Mobil' },
    { pattern: /\bchevron\b/i, name: 'Chevron' },
    { pattern: /\btexaco\b/i, name: 'Texaco' },
    { pattern: /\besso\b/i, name: 'Esso' },
    { pattern: /\bgulf\b/i, name: 'Gulf' },
    { pattern: /\b(7.?eleven|seven\s*eleven)\b/i, name: '7-Eleven' },
    { pattern: /\bcircle\s*k\b/i, name: 'Circle K' },
    // Groceries
    { pattern: /shoprite/i, name: 'Shoprite' },
    { pattern: /choppies/i, name: 'Choppies' },
    { pattern: /\bspar\b/i, name: 'Spar' },
    { pattern: /pick\s*n\s*pay|pick.*pay/i, name: 'Pick n Pay' },
    { pattern: /woolworths|woolies/i, name: 'Woolworths' },
    { pattern: /checkers/i, name: 'Checkers' },
    { pattern: /food\s*lovers/i, name: 'Food Lovers Market' },
    { pattern: /sefalana/i, name: 'Sefalana' },
    { pattern: /payless/i, name: 'Payless' },
    { pattern: /walmart/i, name: 'Walmart' },
    { pattern: /\btarget\b/i, name: 'Target' },
    { pattern: /costco/i, name: 'Costco' },
    { pattern: /kroger/i, name: 'Kroger' },
    { pattern: /safeway/i, name: 'Safeway' },
    { pattern: /trader\s*joe/i, name: "Trader Joe's" },
    { pattern: /whole\s*foods/i, name: 'Whole Foods' },
    { pattern: /tesco/i, name: 'Tesco' },
    { pattern: /sainsbury/i, name: "Sainsbury's" },
    { pattern: /morrisons/i, name: 'Morrisons' },
    { pattern: /\basda\b/i, name: 'Asda' },
    { pattern: /waitrose/i, name: 'Waitrose' },
    { pattern: /marks\s*&?\s*spencer/i, name: 'Marks & Spencer' },
    { pattern: /\baldi\b/i, name: 'Aldi' },
    { pattern: /\blidl\b/i, name: 'Lidl' },
    { pattern: /carrefour/i, name: 'Carrefour' },
    { pattern: /auchan/i, name: 'Auchan' },
    { pattern: /\brewe\b/i, name: 'REWE' },
    { pattern: /edeka/i, name: 'EDEKA' },
    { pattern: /mercadona/i, name: 'Mercadona' },
    { pattern: /\bmigros\b/i, name: 'Migros' },
    { pattern: /\bicas?\b/i, name: 'ICA' },
    { pattern: /\bk-?citymarket\b/i, name: 'K-Market' },
    { pattern: /\bbig\s*c\b/i, name: 'Big C' },
    { pattern: /fairprice/i, name: 'FairPrice' },
    { pattern: /cold\s*storage/i, name: 'Cold Storage' },
    { pattern: /family\s*mart/i, name: 'FamilyMart' },
    { pattern: /\blawson\b/i, name: 'Lawson' },
    { pattern: /\baeon\b/i, name: 'AEON' },
    { pattern: /lulu\s*hyper/i, name: 'LuLu Hypermarket' },
    { pattern: /\bbim\b/i, name: 'BIM' },
    // Retail
    { pattern: /game\s+stores|\bgame\b/i, name: 'Game Stores' },
    { pattern: /makro/i, name: 'Makro' },
    { pattern: /pep\s+stores|\bpep\b/i, name: 'Pep Stores' },
    { pattern: /jet\s+stores/i, name: 'Jet Stores' },
    { pattern: /ackermans/i, name: 'Ackermans' },
    { pattern: /mr\s*price/i, name: 'Mr Price' },
    { pattern: /truworths/i, name: 'Truworths' },
    { pattern: /edgars/i, name: 'Edgars' },
    { pattern: /\bh\s*&\s*m\b/i, name: 'H&M' },
    { pattern: /\bzara\b/i, name: 'Zara' },
    { pattern: /uniqlo/i, name: 'Uniqlo' },
    { pattern: /\bgap\b/i, name: 'Gap' },
    { pattern: /\bnike\b/i, name: 'Nike' },
    { pattern: /\badidas\b/i, name: 'Adidas' },
    { pattern: /\bikea\b/i, name: 'IKEA' },
    { pattern: /best\s*buy/i, name: 'Best Buy' },
    { pattern: /media\s*markt/i, name: 'MediaMarkt' },
    { pattern: /amazon/i, name: 'Amazon' },
    // Pharmacy
    { pattern: /\bclicks\b/i, name: 'Clicks' },
    { pattern: /dis-?chem/i, name: 'Dis-Chem' },
    { pattern: /\bcvs\b/i, name: 'CVS' },
    { pattern: /walgreens/i, name: 'Walgreens' },
    { pattern: /\bboots\b/i, name: 'Boots' },
    { pattern: /rite\s*aid/i, name: 'Rite Aid' },
    { pattern: /\bapotek\b/i, name: 'Apotek' },
    // Fast food / coffee
    { pattern: /\bkfc\b/i, name: 'KFC' },
    { pattern: /nando['s]?/i, name: 'Nandos' },
    { pattern: /mcdonald/i, name: "McDonald's" },
    { pattern: /steers/i, name: 'Steers' },
    { pattern: /wimpy/i, name: 'Wimpy' },
    { pattern: /debonairs/i, name: 'Debonairs' },
    { pattern: /chicken\s*licken/i, name: 'Chicken Licken' },
    { pattern: /hungry\s*lion/i, name: 'Hungry Lion' },
    { pattern: /burger\s*king/i, name: 'Burger King' },
    { pattern: /subway/i, name: 'Subway' },
    { pattern: /pizza\s*hut/i, name: 'Pizza Hut' },
    { pattern: /domino/i, name: "Domino's" },
    { pattern: /starbucks/i, name: 'Starbucks' },
    { pattern: /costa\s*coffee/i, name: 'Costa Coffee' },
    { pattern: /\bdunkin/i, name: "Dunkin'" },
    { pattern: /tim\s*hortons/i, name: 'Tim Hortons' },
    { pattern: /\bchipotle\b/i, name: 'Chipotle' },
    { pattern: /\btaco\s*bell\b/i, name: 'Taco Bell' },
    { pattern: /\bwendy/i, name: "Wendy's" },
    { pattern: /\bpanera\b/i, name: 'Panera Bread' },
    { pattern: /five\s*guys/i, name: 'Five Guys' },
    { pattern: /pret\s*a\s*manger/i, name: 'Pret A Manger' },
    { pattern: /\bgreggs\b/i, name: 'Greggs' },
    { pattern: /caff[eè]\s*nero/i, name: 'Caffè Nero' },
    // Hardware
    { pattern: /builders\s*warehouse|\bbuilders\b/i, name: 'Builders Warehouse' },
    { pattern: /cashbuild/i, name: 'Cashbuild' },
    { pattern: /home\s*depot/i, name: 'Home Depot' },
    { pattern: /\blowes\b|lowe['']s/i, name: "Lowe's" },
    { pattern: /\bb\s*&\s*q\b/i, name: 'B&Q' },
    { pattern: /screwfix/i, name: 'Screwfix' },
    { pattern: /bauhaus/i, name: 'Bauhaus' },
    { pattern: /leroy\s*merlin/i, name: 'Leroy Merlin' },
  ];

  for (const km of knownMerchants) {
    if (km.pattern.test(fullText)) {
      for (const line of lines.slice(0, 10)) {
        if (km.pattern.test(line)) {
          const cleaned = line.replace(/[^a-zA-Z0-9\s&'.\-]/g, '').trim();
          if (cleaned.length > 2 && cleaned.length < 60) return cleaned;
        }
      }
      return km.name;
    }
  }

  // Generic fallback - works for ANY shop worldwide.
  // Skip lines that are clearly not the shop name (multilingual hints).
  const skipPatterns = /^(p\.?o\.?\s*box|tel|phone|fax|vat|tax|gst|hst|tva|mwst|iva|receipt|invoice|date|time|cashier|till|terminal|store|branch|\d{5,}|www\.|http|change|total|amount|ticket|reg\b|trans|order|n[°ºo]\.|nro|fact|bill|kassenbon|recibo|facture)/i;

  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    const cleaned = line.replace(/[^a-zA-Z0-9\s&'.\-]/g, '').trim();

    if (cleaned.length < 3 || cleaned.length > 60) continue;
    if (/^\d+$/.test(cleaned)) continue;
    if (skipPatterns.test(cleaned)) continue;
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(cleaned)) continue;

    if (/[a-zA-Z]{2,}/.test(cleaned)) {
      return cleaned;
    }
  }

  return 'Unknown Merchant';
}

// ============================================================
// DATE EXTRACTION
// ============================================================

function extractDate(lines, fullText) {
  const today = new Date().toISOString().split('T')[0];

  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  for (const line of lines) {
    if (/date/i.test(line)) {
      const d = parseDateFromLine(line, monthMap);
      if (d) return d;
    }
  }
  for (const line of lines) {
    const d = parseDateFromLine(line, monthMap);
    if (d) return d;
  }
  return today;
}

function parseDateFromLine(line, monthMap) {
  let match;

  match = line.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (match) {
    const a = parseInt(match[1]), b = parseInt(match[2]), year = match[3];
    if (a > 12 && b <= 12) {
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    } else if (b > 12 && a <= 12) {
      return `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
    } else if (a <= 12 && b <= 12) {
      // Ambiguous - default DD/MM (international standard outside US)
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
  }

  match = line.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = parseInt(match[3]) > 50 ? '19' + match[3] : '20' + match[3];
    if (parseInt(month) >= 1 && parseInt(month) <= 12 && parseInt(day) >= 1 && parseInt(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  match = line.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (match) {
    const m = parseInt(match[2]), d = parseInt(match[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${match[1]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  match = line.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i);
  if (match) {
    const m = monthMap[match[2].toLowerCase().substring(0, 3)];
    if (m) return `${match[3]}-${m}-${match[1].padStart(2, '0')}`;
  }

  match = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (match) {
    const m = monthMap[match[1].toLowerCase().substring(0, 3)];
    if (m) return `${match[3]}-${m}-${match[2].padStart(2, '0')}`;
  }

  return null;
}

// ============================================================
// AMOUNT + TOTAL EXTRACTION
// ============================================================

function detectCurrency(text) {
  const codeMatch = text.match(/\b(BWP|ZAR|USD|EUR|GBP|JPY|CNY|CHF|CAD|AUD|NZD|INR|KRW|SGD|HKD|MXN|BRL|RUB|TRY|AED|SAR|NGN|KES|GHS|EGP|MAD|TZS|UGX|ZMW|NAD|MWK|THB|IDR|MYR|PHP|VND|PKR|BDT|LKR|NOK|SEK|DKK|PLN|CZK|HUF|RON|ILS|CLP|COP|PEN|ARS)\b/);
  if (codeMatch) return codeMatch[1];

  if (/€/.test(text)) return 'EUR';
  if (/£/.test(text)) return 'GBP';
  if (/¥/.test(text)) return 'JPY';
  if (/₹/.test(text)) return 'INR';
  if (/₩/.test(text)) return 'KRW';
  if (/₪/.test(text)) return 'ILS';
  if (/₦/.test(text)) return 'NGN';
  if (/₱/.test(text)) return 'PHP';
  if (/₴/.test(text)) return 'UAH';
  if (/₺/.test(text)) return 'TRY';
  if (/฿/.test(text)) return 'THB';
  if (/R\$/.test(text)) return 'BRL';
  if (/\bR\s*\d/.test(text)) return 'ZAR';
  if (/\bP\s*\d/.test(text)) return 'BWP';
  if (/\bRs\s*\d/.test(text)) return 'INR';
  if (/\bkr\b/i.test(text)) return 'NOK';
  if (/\$/.test(text)) return 'USD';
  return null;
}

function extractAmountsAndTotal(lines, rawText, cleaned) {
  const items = [];
  let total = 0;
  let foundTotal = false;

  const currency = detectCurrency(rawText) || detectCurrency(cleaned);

  // Strip dates from text before amount-frequency analysis to avoid
  // confusing "22.03.2026" with an amount of "22.03"
  const stripDates = (s) => s
    .replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/g, ' ')
    .replace(/\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/g, ' ');

  // No-decimal currencies (yen, won, rupiah, etc) - amounts are whole numbers
  const noDecimalCurrency = /JPY|KRW|VND|IDR|HUF|CLP|COP|UGX|TZS|¥|₩|฿/i.test(currency || rawText);

  // Amount pattern - supports both 1,234.56 (US/UK) and 1.234,56 (EU) styles
  const amountRegex = noDecimalCurrency
    ? /\d{1,3}(?:[,\s.]\d{3})*(?:[.,]\d{2})?/g          // optional decimals for JPY etc
    : /\d{1,3}(?:[,\s.]\d{3})*[.,]\d{2}/g;

  const cur = CURRENCY_PREFIX_OPT;
  // Allow optional decimals so JPY/KRW/IDR etc work too
  const numPat = noDecimalCurrency
    ? `(\\d{1,3}(?:[,\\s.]\\d{3})*(?:[.,]\\d{2})?)`
    : `(\\d{1,3}(?:[,\\s.]\\d{3})*[.,]\\d{2})`;
  const totalPatterns = [
    new RegExp(`(?:grand\\s*)?(?:total|summe|somme|importe|totale|合計|总计)\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    new RegExp(`(?:amount\\s*due|balance\\s*due|net\\s*amount|nett|amt\\s*due|importe|montant|gesamt|totale|total\\s*a\\s*pagar|合計)\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    new RegExp(`${CURRENCY_PREFIX_RE.source}${numPat}\\s*(?:total|due)`, 'i'),
    new RegExp(`total\\s+${CURRENCY_PREFIX_RE.source}${numPat}`, 'i'),
    new RegExp(`(?:to\\s*pay|you\\s*paid|payment|tendered|paid|cash)\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = stripDates(lines[i]);
    if (/\b(change|cashback|cash\s*back|vuelto|monnaie|rückgeld|gegeben|gegen|zurück)\b/i.test(line) && !/total|summe/i.test(line)) continue;

    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match) {
        const val = normaliseAmount(match[1]);
        if (val > 0 && val < 10000000) {
          total = val;
          foundTotal = true;
          break;
        }
      }
    }
    if (foundTotal) break;

    if (/\btotal\b/i.test(line) && !/sub.?total/i.test(line) && !/change/i.test(line)) {
      const lineAmounts = line.match(amountRegex);
      if (lineAmounts) {
        const vals = lineAmounts.map(normaliseAmount);
        const maxVal = Math.max(...vals);
        if (maxVal > 0) { total = maxVal; foundTotal = true; break; }
      }
      if (i + 1 < lines.length) {
        const nextAmounts = stripDates(lines[i + 1]).match(amountRegex);
        if (nextAmounts) {
          const vals = nextAmounts.map(normaliseAmount);
          const maxVal = Math.max(...vals);
          if (maxVal > 0) { total = maxVal; foundTotal = true; break; }
        }
      }
    }
  }

  // Frequency voting - strip dates first so "22.03.2026" doesn't pollute amounts
  const allAmounts = [];
  const allText = stripDates(rawText + '\n' + cleaned);
  const globalMatches = allText.match(amountRegex);
  if (globalMatches) {
    globalMatches.forEach(m => {
      const val = normaliseAmount(m);
      if (val > 0 && val < 10000000) allAmounts.push(val);
    });
  }

  if (foundTotal && allAmounts.length > 0) {
    const freq = {};
    allAmounts.forEach(a => {
      const rounded = Math.round(a * 100) / 100;
      freq[rounded] = (freq[rounded] || 0) + 1;
    });
    let maxFreq = 0, mostFreqAmt = 0;
    Object.entries(freq).forEach(([amt, count]) => {
      const numAmt = parseFloat(amt);
      if (count > maxFreq || (count === maxFreq && numAmt > mostFreqAmt)) {
        maxFreq = count;
        mostFreqAmt = numAmt;
      }
    });
    if (maxFreq >= 3 && Math.abs(mostFreqAmt - total) > 0.05 && mostFreqAmt > total * 0.5) {
      total = mostFreqAmt;
    }
  }

  if (!foundTotal && allAmounts.length > 0) {
    const freq = {};
    allAmounts.forEach(a => {
      const rounded = Math.round(a * 100) / 100;
      freq[rounded] = (freq[rounded] || 0) + 1;
    });
    let maxFreq = 0, mostFreqAmt = 0;
    Object.entries(freq).forEach(([amt, count]) => {
      const numAmt = parseFloat(amt);
      if (count > maxFreq || (count === maxFreq && numAmt > mostFreqAmt)) {
        maxFreq = count;
        mostFreqAmt = numAmt;
      }
    });
    if (maxFreq >= 2) {
      total = mostFreqAmt;
    } else {
      total = Math.max(...allAmounts);
    }
  }

  // Line items
  const skipLinePatterns = /\b(total|subtotal|sub-total|change|cash\b|card|visa|master|debit|credit|vat-code|vat.?val|net.?val|tax\b|gst|hst|thank|welcome|receipt|invoice|terminal|cashier|attendant|pump\s*no|items?\s+\d|rounding|discount|saving|you\s*save|loyalty|points|balance|payment|tendered|auth|approval|merchant|customer\s*copy|duplicate|importe|montant|gesamt|totale)\b/i;

  for (const rawLine of lines) {
    const line = stripDates(rawLine);
    if (skipLinePatterns.test(line)) continue;

    const amounts = line.match(amountRegex);
    if (amounts && amounts.length > 0) {
      const amount = normaliseAmount(amounts[amounts.length - 1]);

      if (total > 0 && Math.abs(amount - total) / total < 0.02) continue;

      let desc = line;
      desc = desc.replace(amountRegex, '');
      desc = desc.replace(new RegExp(CURRENCY_CHAR_CLASS + '\\s*', 'g'), '');
      desc = desc.replace(/\d+\s*[@x]\s*/gi, '');
      desc = desc.replace(/[^a-zA-Z0-9\s&'.\-]/g, ' ');
      desc = desc.replace(/\s+/g, ' ').trim();

      if (desc.length > 1 && /[a-zA-Z]{2,}/.test(desc) && amount > 0 && amount < 100000) {
        items.push({
          description: desc.substring(0, 50),
          amount: Math.round(amount * 100) / 100,
        });
      }
    }
  }

  return {
    items,
    total: Math.round(total * 100) / 100,
    currency,
  };
}

// Normalise amount: handles "1,234.56" (US), "1.234,56" (EU), "1 234,56" (FR/SE)
function normaliseAmount(str) {
  if (!str) return 0;
  let s = String(str).replace(/\s/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0 && lastDot < 0) {
    const parts = s.split(',');
    if (parts[parts.length - 1].length === 2) {
      s = s.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else {
    s = s.replace(/,/g, '');
  }
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}

// ============================================================
// CATEGORY DETECTION (broadened, multilingual hints)
// ============================================================

export function detectCategory(fullText, merchant) {
  const text = (fullText + ' ' + merchant).toLowerCase();

  // Transportation / Fuel
  if (/\b(fuel|diesel|petrol|gasoline|gas\s*station|unleaded|engen|shell|total\s*energies|puma|caltex|\bbp\b|sasol|exxon|mobil|chevron|texaco|esso|gulf|7.?eleven|circle\s*k|pump|litre|liter|gallon|octane|benzin|essence|carburant|gasolina)\b/i.test(text)) {
    return 'Transportation';
  }
  if (/\b(uber|lyft|bolt|taxi|cab|bus|combi|train|metro|subway|tube|tram|parking|toll|transport|airline|flight|booking|car\s*wash|tyre|tire|rental)\b/i.test(text)) {
    return 'Transportation';
  }

  // Food & Dining
  if (/\b(restaurant|cafe|café|coffee|dine|diner|bistro|pizza|burger|chicken|bakery|kfc|nandos|steers|wimpy|debonairs|mcdonalds?|hungry\s*lion|spur|ocean\s*basket|mug|vida|starbucks|costa|dunkin|tim\s*hortons|subway|domino|pizza\s*hut|chipotle|taco\s*bell|wendy|panera|five\s*guys|pret|greggs|nero)\b/i.test(text)) {
    return 'Food & Dining';
  }
  if (/\b(shoprite|choppies|spar|pick.*pay|checkers|food\s*lovers|sefalana|grocery|supermarket|hypermarket|payless|woolworths|aldi|lidl|tesco|sainsbury|morrisons|asda|waitrose|carrefour|auchan|rewe|edeka|mercadona|coop|migros|ica|kesko|big\s*c|fairprice|cold\s*storage|familymart|lawson|aeon|lulu|bim|kroger|safeway|trader\s*joe|whole\s*foods|costco|walmart|target)\b/i.test(text)) {
    return 'Food & Dining';
  }
  if (/\b(bread|milk|eggs|rice|meat|chicken|beef|pork|fish|vegetables|veggies|fruit|juice|water|soda|beer|wine|snack|biscuit|chips|cereal|sugar|flour|oil|butter|cheese|yogurt|pasta)\b/i.test(text)) {
    return 'Food & Dining';
  }

  // Healthcare
  if (/\b(pharmacy|pharmacie|apotek|apotheke|farmacia|clinic|hospital|doctor|medical|health|chemist|clicks|dis.?chem|medirite|cvs|walgreens|boots|rite\s*aid|prescription|medicine|vitamin|drug\s*store)\b/i.test(text)) {
    return 'Healthcare';
  }

  // Shopping / Retail
  if (/\b(game\b|makro|pep|jet|ackermans|mr\s*price|truworths|edgars|foschini|cotton\s*on|h\s*&\s*m|zara|uniqlo|gap|nike|adidas|ikea|best\s*buy|media\s*markt|amazon|clothing|fashion|shoe|apparel|electronics|device|laptop|phone)\b/i.test(text)) {
    return 'Shopping';
  }

  // Utilities
  if (/\b(electric|electricity|water|internet|wifi|airtime|data|dstv|btc|bpc|wuc|mascom|orange|btel|prepaid|recharge|fibre|fiber|telkom|mtn|vodacom|cell\s*c|verizon|comcast|spectrum|\bbt\b|\bsky\b|virgin)\b/i.test(text)) {
    return 'Utilities';
  }

  // Entertainment
  if (/\b(cinema|movie|theater|theatre|ticket|event|concert|ster\s*kinekor|nouveau|amc|imax|bowling|entertainment|netflix|spotify|disney|gaming|playstation|xbox|steam)\b/i.test(text)) {
    return 'Entertainment';
  }

  // Education
  if (/\b(school|university|book|tuition|education|stationery|cna|exclusive\s*books|textbook|course|college)\b/i.test(text)) {
    return 'Education';
  }

  // Hardware / Home
  if (/\b(builders|hardware|cashbuild|mica|tile|paint|plumb|furniture|home\s*depot|lowes|b\s*&\s*q|screwfix|bauhaus|leroy\s*merlin)\b/i.test(text)) {
    return 'Shopping';
  }

  return 'Other';
}

export default parseReceiptText;
