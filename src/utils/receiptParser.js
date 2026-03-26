// src/utils/receiptParser.js
// Advanced receipt text parser - extracts merchant, date, items, total, category
// Optimised for Botswana receipts (Pula currency, local stores)

/**
 * Main parser function - takes raw OCR text and returns structured data
 */
export function parseReceiptText(rawText) {
  if (!rawText || rawText.trim().length < 5) return null;

  // Clean up common OCR noise before parsing
  let cleaned = rawText
    .replace(/[|\\}{[\]]/g, ' ')           // Remove brackets and pipes
    .replace(/[`~^]/g, '')                  // Remove backticks and carets
    .replace(/(\r\n|\r)/g, '\n')           // Normalize line endings
    .replace(/[ \t]+/g, ' ')              // Collapse multiple spaces/tabs
    .replace(/\n{3,}/g, '\n\n')           // Max 2 consecutive newlines
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')  // Add space between letters and numbers stuck together
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')  // Add space between numbers and letters stuck together
    .trim();

  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = cleaned.toLowerCase();

  const merchant = extractMerchant(lines, fullText);
  const date = extractDate(lines);
  const { items, total } = extractAmountsAndTotal(lines, rawText);
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
 * Extract merchant name - looks at first few lines for store name
 * Skips addresses, VAT numbers, phone numbers
 */
function extractMerchant(lines, fullText) {
  // Known Botswana merchants - check first
  const knownMerchants = [
    { pattern: /engen/i, name: 'Engen' },
    { pattern: /shell/i, name: 'Shell' },
    { pattern: /total\s+energies|total\s+garage/i, name: 'TotalEnergies' },
    { pattern: /puma\s+energy/i, name: 'Puma Energy' },
    { pattern: /shoprite/i, name: 'Shoprite' },
    { pattern: /choppies/i, name: 'Choppies' },
    { pattern: /spar\b/i, name: 'Spar' },
    { pattern: /pick\s*n\s*pay|pick.*pay/i, name: 'Pick n Pay' },
    { pattern: /woolworths/i, name: 'Woolworths' },
    { pattern: /game\s+stores|game\b/i, name: 'Game Stores' },
    { pattern: /makro/i, name: 'Makro' },
    { pattern: /pep\s+stores|pep\b/i, name: 'Pep Stores' },
    { pattern: /jet\s+stores/i, name: 'Jet Stores' },
    { pattern: /ackermans/i, name: 'Ackermans' },
    { pattern: /clicks/i, name: 'Clicks' },
    { pattern: /dis-chem|dischem/i, name: 'Dis-Chem' },
    { pattern: /kfc/i, name: 'KFC' },
    { pattern: /nandos|nando/i, name: 'Nandos' },
    { pattern: /mcdonalds|mcdonald/i, name: 'McDonalds' },
    { pattern: /steers/i, name: 'Steers' },
    { pattern: /wimpy/i, name: 'Wimpy' },
    { pattern: /debonairs/i, name: 'Debonairs' },
    { pattern: /chicken\s+licken/i, name: 'Chicken Licken' },
    { pattern: /hungry\s+lion/i, name: 'Hungry Lion' },
    { pattern: /builders\s+warehouse/i, name: 'Builders Warehouse' },
    { pattern: /mr\s+price/i, name: 'Mr Price' },
    { pattern: /truworths/i, name: 'Truworths' },
    { pattern: /edgars/i, name: 'Edgars' },
    { pattern: /checkers/i, name: 'Checkers' },
    { pattern: /food\s+lovers/i, name: 'Food Lovers Market' },
    { pattern: /payless/i, name: 'Payless' },
    { pattern: /sefalana/i, name: 'Sefalana' },
  ];

  // Check against known merchants in full text
  for (const km of knownMerchants) {
    if (km.pattern.test(fullText)) {
      // Try to get the full name from the actual receipt line
      for (const line of lines.slice(0, 8)) {
        if (km.pattern.test(line)) {
          const cleaned = line.replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
          if (cleaned.length > 2) return cleaned;
        }
      }
      return km.name;
    }
  }

  // Fallback: scan first 6 lines for a likely merchant name
  const skipPatterns = /^(p\.?o\.?\s*box|tel|phone|fax|vat|tax|receipt|invoice|date|time|cashier|till|terminal|\d{5,}|www\.|http)/i;
  
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    const cleaned = line.replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
    
    // Skip short lines, pure numbers, addresses, metadata
    if (cleaned.length < 3) continue;
    if (/^\d+$/.test(cleaned)) continue;
    if (skipPatterns.test(cleaned)) continue;
    if (/^\d+\/\d+\/\d+/.test(cleaned)) continue; // dates
    
    // Good candidate - has letters and is substantial
    if (/[a-zA-Z]{2,}/.test(cleaned)) {
      return cleaned.substring(0, 60);
    }
  }

  return 'Unknown Merchant';
}

/**
 * Extract date - tries multiple formats common in Botswana
 */
function extractDate(lines) {
  const today = new Date().toISOString().split('T')[0];
  
  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  for (const line of lines) {
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    let match = line.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      if (parseInt(month) >= 1 && parseInt(month) <= 12 && parseInt(day) >= 1 && parseInt(day) <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    // YYYY/MM/DD or YYYY-MM-DD
    match = line.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
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
  }

  return today;
}

/**
 * Extract all amounts and determine the total
 * Much more robust - handles P prefix, multiple formats
 */
function extractAmountsAndTotal(lines, rawText) {
  const items = [];
  let total = 0;
  let foundTotal = false;

  // Amount patterns - matches numbers like 862.19, 1,234.56, etc.
  const amountRegex = /\d{1,3}(?:[,\s]\d{3})*[.,]\d{2}/g;

  // Step 1: Look for explicit TOTAL line
  const totalKeywords = [
    /(?:grand\s*)?total\s*[:=]?\s*P?\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/i,
    /(?:amount\s*due|balance\s*due|net\s*amount|sum|nett)\s*[:=]?\s*P?\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/i,
    /P\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})\s*(?:total|due)/i,
    /total\s+P\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/i,
  ];

  for (const line of lines) {
    // Skip change lines
    if (/change/i.test(line) && !/total/i.test(line)) continue;
    
    for (const pattern of totalKeywords) {
      const match = line.match(pattern);
      if (match) {
        const val = parseFloat(match[1].replace(/[,\s]/g, '').replace(',', '.'));
        if (val > 0 && val < 1000000) {
          total = val;
          foundTotal = true;
          break;
        }
      }
    }
    if (foundTotal) break;
  }

  // Step 2: If no explicit total found, look for the line with "TOTAL" and grab nearby amount
  if (!foundTotal) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\btotal\b/i.test(line) && !/sub.?total/i.test(line) && !/change/i.test(line)) {
        // Check this line for amounts
        const amounts = line.match(amountRegex);
        if (amounts) {
          const vals = amounts.map(a => parseFloat(a.replace(/[,\s]/g, '')));
          total = Math.max(...vals);
          foundTotal = true;
          break;
        }
        // Check next line
        if (i + 1 < lines.length) {
          const nextAmounts = lines[i + 1].match(amountRegex);
          if (nextAmounts) {
            const vals = nextAmounts.map(a => parseFloat(a.replace(/[,\s]/g, '')));
            total = Math.max(...vals);
            foundTotal = true;
            break;
          }
        }
      }
    }
  }

  // Step 3: Extract line items (lines with amounts that aren't total/change/vat lines)
  const skipLinePatterns = /\b(total|subtotal|sub-total|change|cash|card|visa|master|debit|credit|vat-code|vat.?val|net.?val|tax|thank|welcome|receipt|invoice|terminal|cashier|attendant|pump\s*no|items\s+\d)\b/i;

  for (const line of lines) {
    if (skipLinePatterns.test(line)) continue;
    
    const amounts = line.match(amountRegex);
    if (amounts && amounts.length > 0) {
      const amount = parseFloat(amounts[amounts.length - 1].replace(/[,\s]/g, ''));
      
      // Get description - everything before the last amount
      let desc = line;
      // Remove all amounts from the line to get description
      desc = desc.replace(amountRegex, '');
      // Remove P currency symbol, @, x, qty indicators
      desc = desc.replace(/[P$]\s*/g, '');
      desc = desc.replace(/\d+\s*[@x]\s*/gi, '');
      desc = desc.replace(/[^a-zA-Z0-9\s&'.-]/g, ' ');
      desc = desc.replace(/\s+/g, ' ').trim();

      if (desc.length > 1 && amount > 0 && amount < 100000) {
        items.push({
          description: desc.substring(0, 50),
          amount: Math.round(amount * 100) / 100,
        });
      }
    }
  }

  // Step 4: If still no total, use largest amount found anywhere
  if (!foundTotal || total === 0) {
    const allAmounts = [];
    for (const line of lines) {
      const matches = line.match(amountRegex);
      if (matches) {
        matches.forEach(m => {
          const val = parseFloat(m.replace(/[,\s]/g, ''));
          if (val > 0 && val < 1000000) allAmounts.push(val);
        });
      }
    }
    // Also check for P prefix amounts like P862.19
    const pAmounts = rawText.match(/P\s*(\d{1,3}(?:[,\s]\d{3})*[.,]\d{2})/gi);
    if (pAmounts) {
      pAmounts.forEach(m => {
        const val = parseFloat(m.replace(/[P\s,]/gi, ''));
        if (val > 0 && val < 1000000) allAmounts.push(val);
      });
    }

    if (allAmounts.length > 0) {
      // The total is usually the most frequently occurring large amount, or the largest
      const freq = {};
      allAmounts.forEach(a => { freq[a] = (freq[a] || 0) + 1; });
      
      // Find amount that appears most (total often appears 2-3 times on receipt)
      let maxFreq = 0;
      let mostFreqAmount = 0;
      Object.entries(freq).forEach(([amt, count]) => {
        const numAmt = parseFloat(amt);
        if (count > maxFreq || (count === maxFreq && numAmt > mostFreqAmount)) {
          maxFreq = count;
          mostFreqAmount = numAmt;
        }
      });

      // If the most frequent appears 2+ times, that's likely the total
      if (maxFreq >= 2) {
        total = mostFreqAmount;
      } else {
        // Otherwise use the largest amount
        total = Math.max(...allAmounts);
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

  // Transportation / Fuel - check first as it's common
  if (/\b(fuel|diesel|petrol|unleaded|engen|shell|total\s*energies|puma|caltex|bp\b|sasol|pump|litre|liter|gallon)\b/i.test(text)) {
    return 'Transportation';
  }
  if (/\b(uber|taxi|bus|combi|train|parking|toll|transport)\b/i.test(text)) {
    return 'Transportation';
  }

  // Food & Dining
  if (/\b(restaurant|cafe|coffee|food|eat|dine|pizza|burger|chicken|bakery|kfc|nandos|steers|wimpy|debonairs|mcdonalds|hungry\s*lion|spur|ocean\s*basket|mug\s*&?\s*bean|vida)\b/i.test(text)) {
    return 'Food & Dining';
  }
  // Grocery stores
  if (/\b(shoprite|choppies|spar|pick.*pay|checkers|food\s*lovers|sefalana|grocery|supermarket|payless)\b/i.test(text)) {
    return 'Food & Dining';
  }

  // Healthcare
  if (/\b(pharmacy|clinic|hospital|doctor|medical|health|chemist|clicks|dis.?chem|medirite)\b/i.test(text)) {
    return 'Healthcare';
  }

  // Shopping / Retail
  if (/\b(game\b|makro|pep|jet|ackermans|woolworths|mr\s*price|truworths|edgars|foschini|cotton\s*on|h\s*&\s*m|zara)\b/i.test(text)) {
    return 'Shopping';
  }

  // Utilities
  if (/\b(electric|water|internet|wifi|airtime|data|dstv|btc|bpc|wuc|mascom|orange|btel|prepaid|recharge|fibre)\b/i.test(text)) {
    return 'Utilities';
  }

  // Entertainment
  if (/\b(cinema|movie|ticket|event|concert|ster\s*kinekor|nouveau|bowling|entertainment)\b/i.test(text)) {
    return 'Entertainment';
  }

  // Education
  if (/\b(school|university|book|tuition|education|stationery|cna|exclusive\s*books)\b/i.test(text)) {
    return 'Education';
  }

  // Hardware / Home
  if (/\b(builders|hardware|cashbuild|mica|tile|paint|plumb)\b/i.test(text)) {
    return 'Shopping';
  }

  return 'Other';
}

export default parseReceiptText;
