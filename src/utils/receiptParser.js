// src/utils/receiptParser.js
// Advanced receipt text parser - extracts merchant, date, items, total, category
// Works globally with optimisation for Botswana receipts (Pula currency)

/**
 * Main parser function - takes raw OCR text and returns structured data
 */
export function parseReceiptText(rawText) {
  if (!rawText || rawText.trim().length < 5) return null;

  // Clean up common OCR noise before parsing
  let cleaned = rawText
    .replace(/[|\\}{[\]`~^]/g, ' ')         // Remove brackets, pipes, backticks
    .replace(/(\r\n|\r)/g, '\n')             // Normalize line endings
    .replace(/[ \t]+/g, ' ')                // Collapse spaces
    .replace(/\n{3,}/g, '\n\n')             // Max 2 consecutive newlines
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')    // Separate letters stuck to numbers
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')    // Separate numbers stuck to letters
    .replace(/[oO](\.\d{2})/g, '0$1')       // Fix OCR: O → 0 before decimals
    .replace(/(\d)[lI](\d)/g, '$1l$2')      // Fix OCR: l/I between digits → 1 (contextual)
    .trim();

  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = cleaned.toLowerCase();

  const merchant = extractMerchant(lines, fullText);
  const date = extractDate(lines, cleaned);
  const { items, total } = extractAmountsAndTotal(lines, rawText, cleaned);
  const category = detectCategory(fullText, merchant);

  return {
    merchant,
    date,
    items,
    total,
    category,
    rawText,
  };
}

/**
 * Extract merchant name
 */
function extractMerchant(lines, fullText) {
  const knownMerchants = [
    // Fuel
    { pattern: /engen/i, name: 'Engen' },
    { pattern: /shell/i, name: 'Shell' },
    { pattern: /total\s*energies|total\s*garage/i, name: 'TotalEnergies' },
    { pattern: /puma\s*energy/i, name: 'Puma Energy' },
    { pattern: /caltex/i, name: 'Caltex' },
    { pattern: /sasol/i, name: 'Sasol' },
    { pattern: /bp\b/i, name: 'BP' },
    // Groceries
    { pattern: /shoprite/i, name: 'Shoprite' },
    { pattern: /choppies/i, name: 'Choppies' },
    { pattern: /spar\b/i, name: 'Spar' },
    { pattern: /pick\s*n\s*pay|pick.*pay/i, name: 'Pick n Pay' },
    { pattern: /woolworths|woolies/i, name: 'Woolworths' },
    { pattern: /checkers/i, name: 'Checkers' },
    { pattern: /food\s*lovers/i, name: 'Food Lovers Market' },
    { pattern: /sefalana/i, name: 'Sefalana' },
    { pattern: /payless/i, name: 'Payless' },
    // Retail
    { pattern: /game\s+stores|game\b/i, name: 'Game Stores' },
    { pattern: /makro/i, name: 'Makro' },
    { pattern: /pep\s+stores|pep\b/i, name: 'Pep Stores' },
    { pattern: /jet\s+stores/i, name: 'Jet Stores' },
    { pattern: /ackermans/i, name: 'Ackermans' },
    { pattern: /mr\s*price/i, name: 'Mr Price' },
    { pattern: /truworths/i, name: 'Truworths' },
    { pattern: /edgars/i, name: 'Edgars' },
    // Pharmacy
    { pattern: /clicks/i, name: 'Clicks' },
    { pattern: /dis-?chem/i, name: 'Dis-Chem' },
    // Fast food
    { pattern: /kfc/i, name: 'KFC' },
    { pattern: /nando['s]?/i, name: 'Nandos' },
    { pattern: /mcdonald/i, name: 'McDonalds' },
    { pattern: /steers/i, name: 'Steers' },
    { pattern: /wimpy/i, name: 'Wimpy' },
    { pattern: /debonairs/i, name: 'Debonairs' },
    { pattern: /chicken\s*licken/i, name: 'Chicken Licken' },
    { pattern: /hungry\s*lion/i, name: 'Hungry Lion' },
    { pattern: /burger\s*king/i, name: 'Burger King' },
    { pattern: /subway/i, name: 'Subway' },
    { pattern: /pizza\s*hut/i, name: 'Pizza Hut' },
    { pattern: /domino/i, name: 'Dominos' },
    // International
    { pattern: /walmart/i, name: 'Walmart' },
    { pattern: /target\b/i, name: 'Target' },
    { pattern: /costco/i, name: 'Costco' },
    { pattern: /tesco/i, name: 'Tesco' },
    { pattern: /aldi/i, name: 'Aldi' },
    { pattern: /lidl/i, name: 'Lidl' },
    { pattern: /carrefour/i, name: 'Carrefour' },
    { pattern: /starbucks/i, name: 'Starbucks' },
    // Hardware
    { pattern: /builders/i, name: 'Builders Warehouse' },
    { pattern: /cashbuild/i, name: 'Cashbuild' },
  ];

  // Check known merchants in full text
  for (const km of knownMerchants) {
    if (km.pattern.test(fullText)) {
      // Try to get the full name from the actual receipt line
      for (const line of lines.slice(0, 10)) {
        if (km.pattern.test(line)) {
          const cleaned = line.replace(/[^a-zA-Z0-9\s&'.\-]/g, '').trim();
          if (cleaned.length > 2 && cleaned.length < 60) return cleaned;
        }
      }
      return km.name;
    }
  }

  // Fallback: scan first 8 lines for a likely merchant name
  const skipPatterns = /^(p\.?o\.?\s*box|tel|phone|fax|vat|tax|receipt|invoice|date|time|cashier|till|terminal|store|branch|\d{5,}|www\.|http|change|total|amount)/i;
  
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

/**
 * Extract date - tries multiple formats
 */
function extractDate(lines, fullText) {
  const today = new Date().toISOString().split('T')[0];
  
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // Search all lines for date patterns
  const allText = lines.join(' ') + ' ' + fullText;
  
  // Try to find date near "date" keyword first
  for (const line of lines) {
    if (/date/i.test(line)) {
      const d = parseDateFromLine(line, monthMap);
      if (d) return d;
    }
  }

  // Try all lines
  for (const line of lines) {
    const d = parseDateFromLine(line, monthMap);
    if (d) return d;
  }

  return today;
}

function parseDateFromLine(line, monthMap) {
  let match;
  
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  match = line.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (match) {
    const a = parseInt(match[1]), b = parseInt(match[2]), year = match[3];
    // Determine if DD/MM or MM/DD
    if (a > 12 && b <= 12) {
      // a is day, b is month
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    } else if (b > 12 && a <= 12) {
      // a is month, b is day
      return `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
    } else if (a <= 12 && b <= 12) {
      // Ambiguous - assume DD/MM (common in Botswana/UK)
      return `${year}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
  }

  // DD/MM/YY
  match = line.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = parseInt(match[3]) > 50 ? '19' + match[3] : '20' + match[3];
    if (parseInt(month) >= 1 && parseInt(month) <= 12 && parseInt(day) >= 1 && parseInt(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  // YYYY/MM/DD or YYYY-MM-DD
  match = line.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (match) {
    const m = parseInt(match[2]), d = parseInt(match[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${match[1]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD Mon YYYY (e.g., 22 Mar 2026)
  match = line.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i);
  if (match) {
    const m = monthMap[match[2].toLowerCase().substring(0, 3)];
    if (m) return `${match[3]}-${m}-${match[1].padStart(2, '0')}`;
  }

  // Mon DD, YYYY (e.g., Mar 22, 2026)
  match = line.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (match) {
    const m = monthMap[match[1].toLowerCase().substring(0, 3)];
    if (m) return `${match[3]}-${m}-${match[2].padStart(2, '0')}`;
  }

  return null;
}

/**
 * Extract all amounts and determine the total
 * Uses multiple strategies: keyword matching, frequency voting, largest amount
 */
function extractAmountsAndTotal(lines, rawText, cleaned) {
  const items = [];
  let total = 0;
  let foundTotal = false;

  // Amount pattern - matches numbers like 862.19, 1,234.56
  const amountRegex = /\d{1,3}(?:[,\s]\d{3})*[.,]\d{2}/g;

  // Strategy 1: Look for explicit TOTAL keyword + amount on same or next line
  const totalPatterns = [
    /(?:grand\s*)?total\s*[:=]?\s*[P$R€£]?\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/i,
    /(?:amount\s*due|balance\s*due|net\s*amount|nett|amt\s*due)\s*[:=]?\s*[P$R€£]?\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/i,
    /[P$R€£]\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})\s*(?:total|due)/i,
    /total\s+[P$R€£]\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/i,
    /(?:to\s*pay|you\s*paid|payment|tendered)\s*[:=]?\s*[P$R€£]?\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip change/cashback lines
    if (/\b(change|cashback|cash\s*back)\b/i.test(line) && !/total/i.test(line)) continue;
    
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match) {
        const val = parseFloat(match[1].replace(/[,\s]/g, ''));
        if (val > 0 && val < 1000000) {
          total = val;
          foundTotal = true;
          break;
        }
      }
    }
    if (foundTotal) break;

    // Check if line has "TOTAL" and next line has amount
    if (/\btotal\b/i.test(line) && !/sub.?total/i.test(line) && !/change/i.test(line)) {
      // Check this line
      const lineAmounts = line.match(amountRegex);
      if (lineAmounts) {
        const vals = lineAmounts.map(a => parseFloat(a.replace(/[,\s]/g, '')));
        const maxVal = Math.max(...vals);
        if (maxVal > 0) { total = maxVal; foundTotal = true; break; }
      }
      // Check next line
      if (i + 1 < lines.length) {
        const nextAmounts = lines[i + 1].match(amountRegex);
        if (nextAmounts) {
          const vals = nextAmounts.map(a => parseFloat(a.replace(/[,\s]/g, '')));
          const maxVal = Math.max(...vals);
          if (maxVal > 0) { total = maxVal; foundTotal = true; break; }
        }
      }
    }
  }

  // Strategy 2: Collect ALL amounts for frequency voting
  const allAmounts = [];
  const allText = rawText + '\n' + cleaned;
  
  // Find all amounts in the entire text
  const globalMatches = allText.match(/\d{1,3}(?:[,\s]\d{3})*[.,]\d{2}/g);
  if (globalMatches) {
    globalMatches.forEach(m => {
      const val = parseFloat(m.replace(/[,\s]/g, ''));
      if (val > 0 && val < 1000000) allAmounts.push(val);
    });
  }

  // Also find P-prefixed amounts
  const pMatches = allText.match(/P\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/gi);
  if (pMatches) {
    pMatches.forEach(m => {
      const val = parseFloat(m.replace(/[P\s,]/gi, ''));
      if (val > 0 && val < 1000000) allAmounts.push(val);
    });
  }

  // If we found a total via keyword, validate it against frequency
  if (foundTotal && allAmounts.length > 0) {
    // Count how often the total appears
    const totalFreq = allAmounts.filter(a => Math.abs(a - total) < 0.05).length;
    
    // Find the most frequent amount
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

    // If the most frequent amount appears 3+ times and differs from keyword total,
    // prefer the frequent one (the keyword match might be wrong)
    if (maxFreq >= 3 && Math.abs(mostFreqAmt - total) > 0.05 && mostFreqAmt > total * 0.5) {
      total = mostFreqAmt;
    }
  }

  // Strategy 3: If no keyword total, use frequency voting or largest
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
      // Use largest amount as total
      total = Math.max(...allAmounts);
    }
  }

  // Extract line items
  const skipLinePatterns = /\b(total|subtotal|sub-total|change|cash\b|card|visa|master|debit|credit|vat-code|vat.?val|net.?val|tax\b|thank|welcome|receipt|invoice|terminal|cashier|attendant|pump\s*no|items?\s+\d|rounding|discount|saving|you\s*save|loyalty|points|balance|payment|tendered|auth|approval|merchant|customer\s*copy|duplicate)\b/i;

  for (const line of lines) {
    if (skipLinePatterns.test(line)) continue;
    
    const amounts = line.match(amountRegex);
    if (amounts && amounts.length > 0) {
      const amount = parseFloat(amounts[amounts.length - 1].replace(/[,\s]/g, ''));
      
      // Skip if amount is the total or very close to it
      if (total > 0 && Math.abs(amount - total) / total < 0.02) continue;
      
      // Get description
      let desc = line;
      desc = desc.replace(amountRegex, '');
      desc = desc.replace(/[P$R€£]\s*/g, '');
      desc = desc.replace(/\d+\s*[@x]\s*/gi, '');
      desc = desc.replace(/[^a-zA-Z0-9\s&'.\-]/g, ' ');
      desc = desc.replace(/\s+/g, ' ').trim();

      // Must have at least one 2+ letter word
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
  };
}

/**
 * Detect category based on merchant name and receipt content
 */
function detectCategory(fullText, merchant) {
  const text = (fullText + ' ' + merchant).toLowerCase();

  // Transportation / Fuel
  if (/\b(fuel|diesel|petrol|unleaded|engen|shell|total\s*energies|puma|caltex|bp\b|sasol|pump|litre|liter|gallon|octane)\b/i.test(text)) {
    return 'Transportation';
  }
  if (/\b(uber|taxi|bus|combi|train|parking|toll|transport|airline|flight|booking|car\s*wash|tyre)\b/i.test(text)) {
    return 'Transportation';
  }

  // Food & Dining - restaurants
  if (/\b(restaurant|cafe|coffee|dine|pizza|burger|chicken|bakery|kfc|nandos|steers|wimpy|debonairs|mcdonalds|hungry\s*lion|spur|ocean\s*basket|mug\s*&?\s*bean|vida|starbucks|subway|domino|pizza\s*hut)\b/i.test(text)) {
    return 'Food & Dining';
  }
  // Grocery stores
  if (/\b(shoprite|choppies|spar|pick.*pay|checkers|food\s*lovers|sefalana|grocery|supermarket|payless|woolworths|aldi|lidl|tesco|carrefour|costco|walmart)\b/i.test(text)) {
    return 'Food & Dining';
  }
  // Food items on receipt
  if (/\b(bread|milk|eggs|rice|meat|chicken|beef|pork|fish|vegetables|fruit|juice|water|soda|beer|wine|snack|biscuit|chips|cereal|sugar|flour|oil|butter|cheese)\b/i.test(text)) {
    return 'Food & Dining';
  }

  // Healthcare
  if (/\b(pharmacy|clinic|hospital|doctor|medical|health|chemist|clicks|dis.?chem|medirite|prescription|medicine|vitamin)\b/i.test(text)) {
    return 'Healthcare';
  }

  // Shopping / Retail
  if (/\b(game\b|makro|pep|jet|ackermans|mr\s*price|truworths|edgars|foschini|cotton\s*on|h\s*&\s*m|zara|clothing|fashion|shoe|apparel)\b/i.test(text)) {
    return 'Shopping';
  }

  // Utilities
  if (/\b(electric|water|internet|wifi|airtime|data|dstv|btc|bpc|wuc|mascom|orange|btel|prepaid|recharge|fibre|telkom|mtn|vodacom|cell\s*c)\b/i.test(text)) {
    return 'Utilities';
  }

  // Entertainment
  if (/\b(cinema|movie|ticket|event|concert|ster\s*kinekor|nouveau|bowling|entertainment|netflix|spotify|gaming)\b/i.test(text)) {
    return 'Entertainment';
  }

  // Education
  if (/\b(school|university|book|tuition|education|stationery|cna|exclusive\s*books|textbook|course)\b/i.test(text)) {
    return 'Education';
  }

  // Hardware / Home
  if (/\b(builders|hardware|cashbuild|mica|tile|paint|plumb|furniture|home\s*depot)\b/i.test(text)) {
    return 'Shopping';
  }

  return 'Other';
}

export default parseReceiptText;
