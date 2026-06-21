// src/utils/receiptParser.js
// Global receipt parser - extracts merchant, date, items, total, currency, category
// Supports all world currencies and any merchant/shop globally.
// IMPROVED: Better total extraction, merchant detection, and OCR text handling.

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

  // Enhanced OCR text cleaning
  let cleaned = rawText
    // Remove common OCR artifacts
    .replace(/[|\\}{[\]`~^<>]/g, ' ')
    // Normalize line endings
    .replace(/(\r\n|\r)/g, '\n')
    // Fix common OCR misreads for currency
    .replace(/\bP\s*(\d)/gi, 'P $1')  // Botswana Pula: P50 → P 50
    .replace(/\bR\s*(\d)/gi, 'R $1')  // Rand: R50 → R 50
    .replace(/[$]\s*(\d)/g, '$ $1')   // Dollar: $50 → $ 50
    // Fix O/0 confusion near decimals
    .replace(/[oO](\.\d{2})/g, '0$1')
    .replace(/(\d)[oO](\d)/g, '$10$2')
    // Fix l/1 and I/1 confusion in numbers
    .replace(/(\d)[lI](\d)/g, '$11$2')
    .replace(/[lI](\d{2,})/g, '1$1')
    // Fix common "Total" OCR misreads
    .replace(/\b[Tt][oO0][tT][aA][lL1]\b/gi, 'Total')
    .replace(/\b[Tt][oO0][tT][aA][Ii1]\b/gi, 'Total')
    .replace(/\bT[oO0]TAL\b/gi, 'Total')
    .replace(/\bTOTAI\b/gi, 'Total')
    .replace(/\bTOTAI\.\b/gi, 'Total')
    // Fix "Amount" OCR misreads
    .replace(/\bAm[oO0]unt\b/gi, 'Amount')
    .replace(/\bAM[oO0]UNT\b/gi, 'Amount')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Separate letters and digits that are stuck together (but preserve decimals)
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .trim();

  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = cleaned.toLowerCase();

  const merchant = extractMerchant(lines, fullText, rawText);
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
// MERCHANT EXTRACTION - IMPROVED V2
// Now much better at finding brand names, especially short ones
// ============================================================

function extractMerchant(lines, fullText, rawText) {
  // STEP 1: Look for clean brand-like words in the first 5 lines
  // Brand names are typically: short (3-15 chars), all letters, at the very top
  // This catches "hoco", "Nike", "Zara", etc.
  const brandCandidates = [];
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    
    // Extract individual words that look like brand names
    const words = line.split(/\s+/);
    for (const word of words) {
      const cleaned = word.replace(/[^a-zA-Z]/g, '');
      // Brand-like: 3-15 chars, all letters, not a common word
      if (cleaned.length >= 3 && cleaned.length <= 15 && /^[a-zA-Z]+$/.test(cleaned)) {
        const lower = cleaned.toLowerCase();
        // Skip common non-brand words
        const skipWords = ['ticket', 'receipt', 'invoice', 'date', 'time', 'total', 'amount', 
          'subtotal', 'change', 'cash', 'card', 'served', 'by', 'the', 'and', 'for', 'tax',
          'vat', 'payment', 'thank', 'thanks', 'welcome', 'customer', 'copy', 'original',
          'units', 'unit', 'qty', 'quantity', 'price', 'item', 'items', 'powered', 'odoo'];
        if (skipWords.includes(lower)) continue;
        
        // Score this word as a potential brand
        let score = 100 - (i * 15); // Earlier lines = higher score
        
        // Bonus for clean single words (likely logo text)
        if (words.length === 1) score += 30;
        // Bonus for short words (brands are often short)
        if (cleaned.length <= 8) score += 20;
        // Bonus for all lowercase or all uppercase (logo styling)
        if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) score += 10;
        // Bonus for Title Case
        if (/^[A-Z][a-z]+$/.test(cleaned)) score += 15;
        // Penalty for words that look like descriptions
        if (lower.includes('charge') || lower.includes('travel') || lower.includes('mini')) score -= 50;
        
        brandCandidates.push({ text: cleaned, score, lineIndex: i });
      }
    }
    
    // Also check if the whole line is a clean brand name
    const wholeLine = line.replace(/[^a-zA-Z\s]/g, '').trim();
    if (wholeLine.length >= 3 && wholeLine.length <= 20 && /^[a-zA-Z]+$/.test(wholeLine.replace(/\s/g, ''))) {
      const lower = wholeLine.toLowerCase();
      if (!['receipt', 'invoice', 'ticket', 'served by', 'powered by'].includes(lower)) {
        let score = 100 - (i * 15);
        if (wholeLine.length <= 10) score += 25;
        if (wholeLine === wholeLine.toLowerCase()) score += 15; // "hoco" style
        if (wholeLine === wholeLine.toUpperCase()) score += 10; // "HOCO" style
        brandCandidates.push({ text: wholeLine, score: score + 20, lineIndex: i });
      }
    }
  }
  
  // Sort brand candidates by score
  brandCandidates.sort((a, b) => b.score - a.score);
  
  // STEP 2: Check against known merchants (fast path)
  const knownMerchants = [
    // Electronics / Tech (added for better categorization)
    { pattern: /\bhoco\b/i, name: 'Hoco', category: 'Shopping' },
    { pattern: /\bsamsung\b/i, name: 'Samsung', category: 'Shopping' },
    { pattern: /\bapple\b/i, name: 'Apple', category: 'Shopping' },
    { pattern: /\bhuawei\b/i, name: 'Huawei', category: 'Shopping' },
    { pattern: /\bxiaomi\b/i, name: 'Xiaomi', category: 'Shopping' },
    { pattern: /\bonepluse?\b/i, name: 'OnePlus', category: 'Shopping' },
    { pattern: /\banker\b/i, name: 'Anker', category: 'Shopping' },
    { pattern: /\bbaseus\b/i, name: 'Baseus', category: 'Shopping' },
    { pattern: /\bugreen\b/i, name: 'UGREEN', category: 'Shopping' },
    // Fuel
    { pattern: /\bengen\b/i, name: 'Engen' },
    { pattern: /\bshell\b/i, name: 'Shell' },
    { pattern: /total\s*energies|total\s*garage/i, name: 'TotalEnergies' },
    { pattern: /puma\s*energy/i, name: 'Puma Energy' },
    { pattern: /\bcaltex\b/i, name: 'Caltex' },
    { pattern: /\bsasol\b/i, name: 'Sasol' },
    { pattern: /\bbp\b(?!\s*station)/i, name: 'BP' },
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
    { pattern: /game\s+stores/i, name: 'Game Stores' },
    { pattern: /makro/i, name: 'Makro' },
    { pattern: /pep\s+stores/i, name: 'Pep Stores' },
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
    { pattern: /builders\s*warehouse/i, name: 'Builders Warehouse' },
    { pattern: /cashbuild/i, name: 'Cashbuild' },
    { pattern: /home\s*depot/i, name: 'Home Depot' },
    { pattern: /\blowes\b|lowe['']s/i, name: "Lowe's" },
    { pattern: /\bb\s*&\s*q\b/i, name: 'B&Q' },
    { pattern: /screwfix/i, name: 'Screwfix' },
    { pattern: /bauhaus/i, name: 'Bauhaus' },
    { pattern: /leroy\s*merlin/i, name: 'Leroy Merlin' },
  ];

  // Check for known merchants across the ENTIRE text, not just top lines
  for (const km of knownMerchants) {
    if (km.pattern.test(fullText)) {
      // Return the canonical name directly - don't try to extract from cluttered lines
      return km.name;
    }
  }

  // STEP 3: Use brand candidates if we found any good ones
  if (brandCandidates.length > 0 && brandCandidates[0].score >= 80) {
    // Format nicely - capitalize first letter
    const best = brandCandidates[0].text;
    return best.charAt(0).toUpperCase() + best.slice(1).toLowerCase();
  }

  // STEP 4: Generic fallback - look for prominent merchant-like lines
  const skipPatterns = /^(p\.?o\.?\s*box|tel[:\s]|phone[:\s]|fax[:\s]|vat\s*(?:no|reg|id)?[:\s]|tax\s*(?:no|id)?[:\s]|gst[:\s]|hst[:\s]|receipt\s*(?:no|#)?[:\s]|invoice\s*(?:no|#)?[:\s]|date[:\s]|time[:\s]|cashier[:\s]|till[:\s]|terminal[:\s]|store\s*(?:no|#)?[:\s]|branch[:\s]|www\.|http|https|change\b|total\b|amount\b|ticket[:\s]|trans(?:action)?[:\s]|order[:\s]|auth[:\s]|ref[:\s]|\d{8,})/i;
  const addressPattern = /\b(street|road|avenue|blvd|drive|lane|way|plot|unit|floor|building|mall|centre|center|shopping|plaza|junction|airport)\b/i;
  const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/;
  const companyPattern = /\b(pty|ltd|inc|corp|llc|plc|co\.|company|enterprise|world|group|international)\b/i;
  
  const merchantCandidates = [];

  for (let i = 0; i < Math.min(12, lines.length); i++) {
    const line = lines[i];
    let cleaned = line.replace(/[^a-zA-Z0-9\s&'.\-]/g, '').trim();

    if (cleaned.length < 3 || cleaned.length > 50) continue;
    if (/^\d+$/.test(cleaned)) continue;
    if (skipPatterns.test(cleaned)) continue;
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}/.test(cleaned)) continue;
    if (addressPattern.test(cleaned)) continue;
    if (phonePattern.test(line)) continue;
    
    // Skip lines that are mostly numbers (like ticket numbers)
    const letterCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
    const digitCount = (cleaned.match(/\d/g) || []).length;
    if (digitCount > letterCount * 1.5) continue;
    
    // Skip OCR garbage - random short character sequences
    if (cleaned.length < 5 && !/^[A-Z][a-z]+$/.test(cleaned) && cleaned !== cleaned.toUpperCase()) continue;

    let score = 0;
    score += (12 - i) * 5; // Earlier = better
    
    // Strong bonuses for clean brand-like names
    if (cleaned === cleaned.toUpperCase() && /^[A-Z]+$/.test(cleaned.replace(/\s/g, ''))) score += 30;
    if (/^[A-Z][a-z]+$/.test(cleaned)) score += 25; // Title case single word
    if (cleaned.length >= 4 && cleaned.length <= 12 && !/\d/.test(cleaned)) score += 20;
    
    // Moderate bonuses
    if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(cleaned)) score += 15;
    if (!/\d/.test(cleaned)) score += 10;
    if (!/\d+[.,]\d{2}/.test(line)) score += 10;
    
    // Penalties
    if (/\b(welcome|thank|receipt|invoice|customer|copy|original|served|by|powered)\b/i.test(cleaned)) score -= 40;
    if (companyPattern.test(cleaned)) score -= 10; // Likely legal name, not brand
    if (/sysadmin|admin|email|@/.test(line)) score -= 50;

    merchantCandidates.push({ text: cleaned, score, line: i });
  }

  merchantCandidates.sort((a, b) => b.score - a.score);

  // Use the best candidate, but prefer brand candidates if they're close
  if (merchantCandidates.length > 0 && merchantCandidates[0].score > 20) {
    // If we have brand candidates, compare
    if (brandCandidates.length > 0 && brandCandidates[0].score >= 60) {
      // Brand candidate wins if it's from an earlier line or comparable score
      if (brandCandidates[0].lineIndex <= merchantCandidates[0].line) {
        const best = brandCandidates[0].text;
        return best.charAt(0).toUpperCase() + best.slice(1).toLowerCase();
      }
    }
    return merchantCandidates[0].text;
  }
  
  // Last resort: use best brand candidate if any
  if (brandCandidates.length > 0) {
    const best = brandCandidates[0].text;
    return best.charAt(0).toUpperCase() + best.slice(1).toLowerCase();
  }

  return 'Unknown Merchant';
}

// ============================================================
// DATE EXTRACTION - Always returns today's date
// User can change it manually if needed
// ============================================================

function extractDate(lines, fullText) {
  return new Date().toISOString().split('T')[0];
}

// ============================================================
// AMOUNT + TOTAL EXTRACTION - SIGNIFICANTLY IMPROVED
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
    .replace(/\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/g, ' ')
    // Also strip times like 14:30:45
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ');

  // No-decimal currencies (yen, won, rupiah, etc) - amounts are whole numbers
  const noDecimalCurrency = /JPY|KRW|VND|IDR|HUF|CLP|COP|UGX|TZS|¥|₩|฿/i.test(currency || rawText);

  // IMPROVED: More flexible amount patterns
  // Pattern 1: Standard decimal amounts (12.50, 1,234.56, 1 234.56)
  // Pattern 2: European format (12,50, 1.234,56)
  // Pattern 3: Whole numbers for no-decimal currencies
  const amountPatterns = noDecimalCurrency
    ? [
        /\d{1,3}(?:[,\s.]\d{3})*(?:[.,]\d{1,2})?/g,  // Optional decimals
        /\d+/g  // Plain integers
      ]
    : [
        /\d{1,3}(?:[,\s.]\d{3})*[.,]\d{2}/g,  // With decimals
        /\d{1,3}(?:[,\s.]\d{3})*[.,]\d{1}/g,  // Single decimal (some receipts)
        /\d+[.,]\d{2}/g  // Simple decimal
      ];

  // Get the best amount regex for this receipt
  const amountRegex = amountPatterns[0];

  const cur = CURRENCY_PREFIX_OPT;
  // IMPROVED: More flexible number pattern - allow 1-2 decimal places OR none
  const numPat = noDecimalCurrency
    ? `(\\d{1,3}(?:[,\\s.]\\d{3})*(?:[.,]\\d{1,2})?|\\d+)`
    : `(\\d{1,3}(?:[,\\s.]\\d{3})*[.,]\\d{1,2}|\\d+[.,]\\d{1,2})`;

  // IMPROVED: Comprehensive total patterns with more variations
  const totalPatterns = [
    // Direct "Total" matches (most reliable)
    new RegExp(`(?:grand\\s*)?total\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    new RegExp(`${cur}${numPat}\\s*(?:grand\\s*)?total`, 'i'),
    // "Amount Due" variations
    new RegExp(`(?:amount|amt)\\s*(?:due|payable)?\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    new RegExp(`(?:balance|bal)\\s*(?:due)?\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    // Payment confirmations
    new RegExp(`(?:you\\s*)?paid\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    new RegExp(`payment\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    new RegExp(`(?:cash|card|visa|master)\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    new RegExp(`tendered\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    // Multilingual
    new RegExp(`(?:summe|somme|importe|totale|montant|gesamt|合計|总计|總計)\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    new RegExp(`total\\s+(?:a\\s*)?pagar\\s*[:=]?\\s*${cur}${numPat}`, 'i'),
    // Currency symbol followed by amount after "Total"
    new RegExp(`total\\s+[PR$€£]\\s*${numPat}`, 'i'),
    // Just "TOTAL" on a line, amount on same or next line
    /^total$/i,
  ];

  // Lines to skip - these contain amounts but are NOT the grand total
  const notTotalPatterns = /\b(sub-?total|subtotal|v\.?a\.?t\.?|tax|gst|hst|discount|saving|change|cash\s*back|cashback|rounding|tip|gratuity|service|charge|item|qty|quantity|unit|price)\b/i;

  // STRICT Total Detection - Only extract from lines with the word "Total"
  // Step 1: Find ALL lines that contain the word "Total" (case insensitive)
  const totalLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    // Must contain "total" but NOT "subtotal"
    if (lineLower.includes('total') && !lineLower.includes('subtotal') && !lineLower.includes('sub-total') && !lineLower.includes('sub total')) {
      // Skip VAT/tax lines
      if (notTotalPatterns.test(line) && !/\bgrand\s*total\b/i.test(line)) continue;
      
      totalLines.push({ line, index: i });
    }
  }

  // Step 2: From the total lines, extract amounts
  for (const { line, index } of totalLines) {
    // Extract all numbers that look like amounts (with optional decimals)
    const amountMatches = line.match(/\d+[.,]\d{2}|\d+[.,]\d{1}(?!\d)|\b\d{2,}\b/g);
    
    if (amountMatches) {
      const vals = amountMatches
        .map(a => normaliseAmount(a))
        .filter(v => v > 0 && v < 10000000);
      
      if (vals.length > 0) {
        // If multiple amounts on the line, take the one that appears after "total"
        // Usually the total amount is the largest or the last one
        total = Math.max(...vals);
        foundTotal = true;
        break;
      }
    }
    
    // If no amount on this line, check the next line
    if (!foundTotal && index < lines.length - 1) {
      const nextLine = lines[index + 1];
      const nextAmounts = nextLine.match(/\d+[.,]\d{2}|\d+[.,]\d{1}(?!\d)|\b\d{2,}\b/g);
      if (nextAmounts) {
        const vals = nextAmounts
          .map(a => normaliseAmount(a))
          .filter(v => v > 0 && v < 10000000);
        if (vals.length > 0) {
          total = Math.max(...vals);
          foundTotal = true;
          break;
        }
      }
    }
  }

  // Step 3: If still no total, look for "Card" or "Paid" or "Payment" lines (payment confirmation)
  if (!foundTotal) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\b(card|paid|payment|amount\s*due|balance\s*due)\b/i.test(line) && !/change/i.test(line)) {
        const amounts = line.match(/\d+[.,]\d{2}/g);
        if (amounts) {
          const vals = amounts.map(a => normaliseAmount(a)).filter(v => v > 0);
          if (vals.length > 0) {
            total = Math.max(...vals);
            foundTotal = true;
            break;
          }
        }
      }
    }
  }

  // Collect ALL amounts from the receipt for analysis
  const allAmounts = [];
  const allText = stripDates(rawText + '\n' + cleaned);
  for (const pattern of amountPatterns) {
    const globalMatches = allText.match(pattern);
    if (globalMatches) {
      globalMatches.forEach(m => {
        const val = normaliseAmount(m);
        if (val > 0 && val < 10000000) allAmounts.push(val);
      });
    }
  }

  // IMPROVED: Smarter fallback - if we found a total, validate it
  // The total should be >= most other amounts (it's the sum)
  if (foundTotal && allAmounts.length > 3) {
    const sortedAmounts = [...new Set(allAmounts)].sort((a, b) => b - a);
    // If our "total" is less than the largest amount, the largest is probably the real total
    if (sortedAmounts[0] > total * 1.1) {
      // But only override if the largest appears exactly once (totals usually appear once)
      const largestCount = allAmounts.filter(a => Math.abs(a - sortedAmounts[0]) < 0.01).length;
      if (largestCount <= 2) {
        total = sortedAmounts[0];
      }
    }
  }

  // Pass 5 (last resort): If no total found, use the largest unique amount
  if (!foundTotal && allAmounts.length > 0) {
    const freq = {};
    allAmounts.forEach(a => {
      const rounded = Math.round(a * 100) / 100;
      freq[rounded] = (freq[rounded] || 0) + 1;
    });

    // Find the largest amount that appears 1-2 times (totals usually aren't repeated)
    const sortedUnique = Object.entries(freq)
      .map(([amt, count]) => ({ amt: parseFloat(amt), count }))
      .sort((a, b) => b.amt - a.amt);

    for (const { amt, count } of sortedUnique) {
      if (count <= 2 && amt > 0) {
        total = amt;
        break;
      }
    }

    // If all amounts repeat, just take the max
    if (total === 0) {
      total = Math.max(...allAmounts);
    }
  }

  // Line items extraction
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
  
  // Handle currency symbols that might be attached
  s = s.replace(/^[PR$€£¥₹₩₪₨₫₴₦₱₲₵₸₺₼₾฿]+/i, '');
  
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  
  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      // European: 1.234,56 → 1234.56
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,234.56 → 1234.56
      s = s.replace(/,/g, '');
    }
  } else if (lastComma >= 0 && lastDot < 0) {
    const parts = s.split(',');
    // If the part after comma is exactly 2 digits, treat as decimal
    if (parts[parts.length - 1].length === 2) {
      // Could be 1,234 (thousand separator) or 12,34 (decimal)
      // If there's only one comma and the part before is 1-3 digits, it's likely decimal
      if (parts.length === 2 && parts[0].length <= 3) {
        s = s.replace(',', '.');
      } else {
        // Multiple commas or large number before comma → thousand separator
        s = s.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
      }
    } else {
      s = s.replace(/,/g, '');
    }
  } else {
    s = s.replace(/,/g, '');
  }
  
  const v = parseFloat(s);
  return isNaN(v) ? 0 : Math.abs(v);  // Always return positive amounts
}

// ============================================================
// CATEGORY DETECTION (broadened, multilingual hints)
// ============================================================

export function detectCategory(fullText, merchant) {
  const text = (fullText + ' ' + merchant).toLowerCase();

  // Electronics / Tech Shopping (check first - specific)
  if (/\b(hoco|anker|baseus|ugreen|charger|charging|cable|usb|hdmi|adapter|earphone|headphone|earbuds|powerbank|power\s*bank|smartphone|iphone|samsung|huawei|xiaomi|laptop|tablet|ipad|macbook|keyboard|mouse|speaker|bluetooth|wireless|pd\s*\d+w|watt|mini\s*travel|tech|gadget|accessory|accessories)\b/i.test(text)) {
    return 'Shopping';
  }

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
