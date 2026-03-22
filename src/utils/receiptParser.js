// src/utils/receiptParser.js
// Advanced receipt text parser - extracts merchant, date, items, total, category
// Optimised for Botswana receipts (Pula currency, local stores)

/**
 * Main parser function - takes raw OCR text and returns structured data
 */
export function parseReceiptText(rawText) {
  if (!rawText || rawText.trim().length < 5) return null;

  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = rawText.toLowerCase();

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
    // === FUEL / PETROL ===
    { pattern: /engen/i, name: 'Engen' },
    { pattern: /shell/i, name: 'Shell' },
    { pattern: /total\s*energies|total\s*garage/i, name: 'TotalEnergies' },
    { pattern: /puma\s*energy/i, name: 'Puma Energy' },
    { pattern: /caltex/i, name: 'Caltex' },
    { pattern: /sasol/i, name: 'Sasol' },
    { pattern: /\bbp\b/i, name: 'BP' },
    { pattern: /chevron/i, name: 'Chevron' },
    { pattern: /exxon|mobil/i, name: 'ExxonMobil' },
    { pattern: /texaco/i, name: 'Texaco' },
    { pattern: /petronas/i, name: 'Petronas' },
    { pattern: /esso/i, name: 'Esso' },
    { pattern: /sunoco/i, name: 'Sunoco' },
    { pattern: /circle\s*k/i, name: 'Circle K' },

    // === GROCERY / SUPERMARKETS ===
    { pattern: /shoprite/i, name: 'Shoprite' },
    { pattern: /choppies/i, name: 'Choppies' },
    { pattern: /\bspar\b/i, name: 'Spar' },
    { pattern: /pick\s*n\s*pay|pick.*pay/i, name: 'Pick n Pay' },
    { pattern: /woolworths/i, name: 'Woolworths' },
    { pattern: /checkers/i, name: 'Checkers' },
    { pattern: /food\s*lovers/i, name: 'Food Lovers Market' },
    { pattern: /sefalana/i, name: 'Sefalana' },
    { pattern: /payless/i, name: 'Payless' },
    { pattern: /walmart/i, name: 'Walmart' },
    { pattern: /target(?!\s*audience)/i, name: 'Target' },
    { pattern: /costco/i, name: 'Costco' },
    { pattern: /kroger/i, name: 'Kroger' },
    { pattern: /aldi\b/i, name: 'Aldi' },
    { pattern: /lidl/i, name: 'Lidl' },
    { pattern: /tesco/i, name: 'Tesco' },
    { pattern: /sainsbury/i, name: 'Sainsburys' },
    { pattern: /asda/i, name: 'ASDA' },
    { pattern: /morrisons/i, name: 'Morrisons' },
    { pattern: /waitrose/i, name: 'Waitrose' },
    { pattern: /carrefour/i, name: 'Carrefour' },
    { pattern: /auchan/i, name: 'Auchan' },
    { pattern: /leclerc/i, name: 'E.Leclerc' },
    { pattern: /intermarche/i, name: 'Intermarché' },
    { pattern: /rewe\b/i, name: 'REWE' },
    { pattern: /edeka/i, name: 'EDEKA' },
    { pattern: /whole\s*foods/i, name: 'Whole Foods' },
    { pattern: /trader\s*joe/i, name: 'Trader Joes' },
    { pattern: /publix/i, name: 'Publix' },
    { pattern: /safeway/i, name: 'Safeway' },
    { pattern: /7.?eleven|7.?11/i, name: '7-Eleven' },
    { pattern: /winn.?dixie/i, name: 'Winn-Dixie' },
    { pattern: /albert\s*heijn/i, name: 'Albert Heijn' },
    { pattern: /woolworths/i, name: 'Woolworths' },
    { pattern: /coles\b/i, name: 'Coles' },
    { pattern: /loblaws/i, name: 'Loblaws' },
    { pattern: /sobeys/i, name: 'Sobeys' },
    { pattern: /metro\b(?!\s*rail)/i, name: 'Metro' },

    // === RETAIL / DEPARTMENT STORES ===
    { pattern: /game\s*stores|\bgame\b/i, name: 'Game Stores' },
    { pattern: /makro/i, name: 'Makro' },
    { pattern: /pep\s*stores|\bpep\b/i, name: 'Pep Stores' },
    { pattern: /jet\s*stores/i, name: 'Jet Stores' },
    { pattern: /ackermans/i, name: 'Ackermans' },
    { pattern: /mr\s*price/i, name: 'Mr Price' },
    { pattern: /truworths/i, name: 'Truworths' },
    { pattern: /edgars/i, name: 'Edgars' },
    { pattern: /foschini/i, name: 'Foschini' },
    { pattern: /amazon/i, name: 'Amazon' },
    { pattern: /ikea/i, name: 'IKEA' },
    { pattern: /h\s*&\s*m\b/i, name: 'H&M' },
    { pattern: /zara\b/i, name: 'Zara' },
    { pattern: /uniqlo/i, name: 'Uniqlo' },
    { pattern: /primark/i, name: 'Primark' },
    { pattern: /cotton\s*on/i, name: 'Cotton On' },
    { pattern: /best\s*buy/i, name: 'Best Buy' },
    { pattern: /home\s*depot/i, name: 'Home Depot' },
    { pattern: /lowes/i, name: 'Lowes' },
    { pattern: /builders\s*warehouse/i, name: 'Builders Warehouse' },
    { pattern: /cashbuild/i, name: 'Cashbuild' },

    // === FAST FOOD / RESTAURANTS ===
    { pattern: /\bkfc\b/i, name: 'KFC' },
    { pattern: /nandos|nando/i, name: 'Nandos' },
    { pattern: /mcdonald/i, name: 'McDonalds' },
    { pattern: /burger\s*king/i, name: 'Burger King' },
    { pattern: /steers/i, name: 'Steers' },
    { pattern: /wimpy/i, name: 'Wimpy' },
    { pattern: /debonairs/i, name: 'Debonairs' },
    { pattern: /chicken\s*licken/i, name: 'Chicken Licken' },
    { pattern: /hungry\s*lion/i, name: 'Hungry Lion' },
    { pattern: /subway/i, name: 'Subway' },
    { pattern: /dominos|domino.*pizza/i, name: 'Dominos' },
    { pattern: /pizza\s*hut/i, name: 'Pizza Hut' },
    { pattern: /starbucks/i, name: 'Starbucks' },
    { pattern: /costa\s*coffee/i, name: 'Costa Coffee' },
    { pattern: /dunkin/i, name: 'Dunkin' },
    { pattern: /taco\s*bell/i, name: 'Taco Bell' },
    { pattern: /wendys|wendy/i, name: 'Wendys' },
    { pattern: /chick.?fil.?a/i, name: 'Chick-fil-A' },
    { pattern: /popeyes/i, name: 'Popeyes' },
    { pattern: /chipotle/i, name: 'Chipotle' },
    { pattern: /five\s*guys/i, name: 'Five Guys' },
    { pattern: /panda\s*express/i, name: 'Panda Express' },
    { pattern: /spur\b/i, name: 'Spur' },
    { pattern: /ocean\s*basket/i, name: 'Ocean Basket' },
    { pattern: /mugg?\s*&?\s*bean/i, name: 'Mugg & Bean' },
    { pattern: /vida\s*e?\s*caffe/i, name: 'Vida e Caffè' },
    { pattern: /waffle\s*house/i, name: 'Waffle House' },

    // === PHARMACY / HEALTH ===
    { pattern: /clicks/i, name: 'Clicks' },
    { pattern: /dis.?chem/i, name: 'Dis-Chem' },
    { pattern: /cvs/i, name: 'CVS' },
    { pattern: /walgreens/i, name: 'Walgreens' },
    { pattern: /boots\b/i, name: 'Boots' },
    { pattern: /rite\s*aid/i, name: 'Rite Aid' },
    { pattern: /medirite/i, name: 'Medirite' },

    // === ELECTRONICS ===
    { pattern: /apple\s*store/i, name: 'Apple Store' },
    { pattern: /samsung\s*store/i, name: 'Samsung Store' },
    { pattern: /incredible\s*connection/i, name: 'Incredible Connection' },
    { pattern: /hi.?fi\s*corp/i, name: 'HiFi Corp' },
    { pattern: /currys/i, name: 'Currys' },
    { pattern: /media\s*markt/i, name: 'MediaMarkt' },

    // === CONVENIENCE ===
    { pattern: /wawa/i, name: 'Wawa' },
    { pattern: /sheetz/i, name: 'Sheetz' },
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
 * Uses frequency voting - the total usually appears multiple times on a receipt
 * Handles P prefix (Botswana Pula), $, £, €, R (Rand), etc.
 */
function extractAmountsAndTotal(lines, rawText) {
  const items = [];
  let total = 0;
  let foundTotal = false;

  // Amount regex - must be preceded by space, line start, or currency symbol
  // This prevents "7862.19" being matched when the real amount is "862.19"
  const amountRegex = /(?:^|[\s,P$£€R¥₹]|[Pp]\s*)(\d{1,3}(?:[,]\d{3})*\.\d{2})(?:\s|$|[,;])/g;
  
  // Simpler regex for finding all decimal numbers on a line
  const simpleAmountRegex = /(\d+\.\d{2})/g;

  /**
   * Extract all amounts from a single line, properly bounded
   */
  function getAmountsFromLine(line) {
    const amounts = [];
    // First try: look for properly formatted amounts with currency or spacing
    const matches = [...line.matchAll(/(?:^|[\s(P$£€R¥₹])(\d{1,3}(?:,\d{3})*\.\d{2})(?:[\s),$;]|$)/g)];
    matches.forEach(m => {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (val > 0 && val < 1000000) amounts.push(val);
    });
    
    // If nothing found, try simpler pattern
    if (amounts.length === 0) {
      const simpleMatches = [...line.matchAll(simpleAmountRegex)];
      simpleMatches.forEach(m => {
        const val = parseFloat(m[1]);
        if (val > 0 && val < 1000000) amounts.push(val);
      });
    }
    
    return amounts;
  }

  // === STEP 1: Collect ALL amounts from the entire receipt ===
  const allAmounts = [];
  for (const line of lines) {
    const amounts = getAmountsFromLine(line);
    amounts.forEach(a => allAmounts.push(a));
  }
  
  // Also find P-prefixed amounts (Pula) like "P862.19"
  const pMatches = [...rawText.matchAll(/P\s*(\d{1,3}(?:,\d{3})*\.\d{2})/gi)];
  pMatches.forEach(m => {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val > 0 && val < 1000000) allAmounts.push(val);
  });

  // === STEP 2: Frequency voting - find the most repeated amount ===
  // On receipts, the total typically appears 2-4 times (item total, TOTAL line, payment line, etc.)
  const freq = {};
  allAmounts.forEach(a => {
    // Round to 2 decimal places to handle tiny float differences
    const key = a.toFixed(2);
    freq[key] = (freq[key] || 0) + 1;
  });

  // Sort by frequency then by value (highest frequency + highest value wins)
  const amountsByFreq = Object.entries(freq)
    .map(([amt, count]) => ({ amount: parseFloat(amt), count }))
    .filter(a => a.amount > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count; // More frequent first
      return b.amount - a.amount; // Then larger amount first
    });

  // === STEP 3: Look for explicit TOTAL keyword line ===
  for (const line of lines) {
    // Skip change/cash back lines
    if (/\b(change|cash\s*back)\b/i.test(line) && !/total/i.test(line)) continue;
    
    // Check if this line has a TOTAL keyword
    if (/\b(total|amount\s*due|balance\s*due|grand\s*total|nett?\s*amount)\b/i.test(line) && !/sub.?total/i.test(line)) {
      const lineAmounts = getAmountsFromLine(line);
      if (lineAmounts.length > 0) {
        // Take the largest amount on the total line
        total = Math.max(...lineAmounts);
        foundTotal = true;
        break;
      }
    }
  }

  // === STEP 4: If no explicit total, use frequency voting ===
  if (!foundTotal && amountsByFreq.length > 0) {
    // If an amount appears 2+ times and is the most frequent, it's very likely the total
    if (amountsByFreq[0].count >= 2) {
      total = amountsByFreq[0].amount;
      foundTotal = true;
    } else {
      // Otherwise use the largest amount on the receipt
      total = Math.max(...allAmounts);
      foundTotal = true;
    }
  }

  // === STEP 5: Cross-validate total ===
  // If we found a total from the TOTAL line, check if the frequency-voted amount
  // is very close — if the voted amount appears more often, it's probably more accurate
  if (foundTotal && amountsByFreq.length > 0 && amountsByFreq[0].count >= 2) {
    const votedAmount = amountsByFreq[0].amount;
    // If the voted amount is within 5% of our total and appears more frequently, prefer it
    if (Math.abs(votedAmount - total) / Math.max(total, 1) < 0.05 && amountsByFreq[0].count >= 2) {
      total = votedAmount;
    }
  }

  // === STEP 6: Extract line items ===
  const skipLinePatterns = /\b(total|subtotal|sub-total|change|cash\s*back|card\s*payment|visa|master|debit|credit|vat.?code|vat.?val|net.?val|tax\s*invoice|thank|welcome|receipt|invoice|terminal|cashier|attendant|pump\s*no|items?\s+\d|zero\s*rate|p\.?o\.?\s*box|monica|printed|duplicate|ledit|lecit)\b/i;

  for (const line of lines) {
    if (skipLinePatterns.test(line)) continue;
    
    const lineAmounts = getAmountsFromLine(line);
    if (lineAmounts.length === 0) continue;
    
    // Take the last (rightmost) amount as the item price
    const amount = lineAmounts[lineAmounts.length - 1];
    
    // Skip if this amount equals or is very close to the total (within 1%)
    if (total > 0 && Math.abs(amount - total) / total < 0.01) continue;
    // Skip zero amounts
    if (amount <= 0) continue;
    // Skip very small amounts that are likely dates or codes
    if (amount < 1) continue;
    
    // Get description - strip amounts, currency symbols, and clean up
    let desc = line;
    // Remove all decimal numbers
    desc = desc.replace(/\d+\.\d{2}/g, '');
    // Remove currency symbols and @ qty indicators
    desc = desc.replace(/[P$£€R¥₹]\s*/g, '');
    desc = desc.replace(/\d+\s*[@xX]\s*/g, '');
    // Remove Tx, VAT indicators
    desc = desc.replace(/\bTx\s*[A-Z]?\b/gi, '');
    // Clean to letters, numbers, spaces only
    desc = desc.replace(/[^a-zA-Z0-9\s&'.-]/g, ' ');
    desc = desc.replace(/\s+/g, ' ').trim();
    // Remove leading/trailing numbers that aren't part of the name
    desc = desc.replace(/^\d+\s+/, '').replace(/\s+\d+$/, '').trim();

    if (desc.length >= 3 && amount > 0.50 && /[a-zA-Z]{2,}/.test(desc)) {
      items.push({
        description: desc.substring(0, 50),
        amount: Math.round(amount * 100) / 100,
      });
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
  if (/\b(fuel|diesel|petrol|unleaded|gasoline|gas\s*station|engen|shell|total\s*energies|puma|caltex|bp\b|sasol|chevron|exxon|mobil|texaco|petronas|esso|sunoco|circle\s*k|pump|litre|liter|gallon|octane)\b/i.test(text)) {
    return 'Transportation';
  }
  if (/\b(uber|lyft|taxi|cab|bus|combi|train|metro|subway|parking|toll|transport|grab|gojek|bolt|didi|flight|airline|airways|airport)\b/i.test(text)) {
    return 'Transportation';
  }

  // Food & Dining - Restaurants
  if (/\b(restaurant|cafe|coffee|bistro|diner|grill|eatery|pizzeria|steakhouse|buffet|canteen|food\s*court|takeaway|take.?out|drive.?thru)\b/i.test(text)) {
    return 'Food & Dining';
  }
  // Food & Dining - Known chains
  if (/\b(kfc|nandos|steers|wimpy|debonairs|mcdonalds|burger\s*king|subway|dominos|pizza\s*hut|starbucks|costa|dunkin|taco\s*bell|wendys|chick.?fil|popeyes|chipotle|five\s*guys|panda\s*express|spur|ocean\s*basket|mugg?\s*&?\s*bean|vida|waffle\s*house|hungry\s*lion|chicken\s*licken)\b/i.test(text)) {
    return 'Food & Dining';
  }
  // Food & Dining - Grocery stores
  if (/\b(shoprite|choppies|spar\b|pick.*pay|checkers|food\s*lovers|sefalana|grocery|supermarket|payless|walmart|costco|kroger|aldi|lidl|tesco|sainsbury|asda|morrisons|waitrose|carrefour|auchan|leclerc|rewe|edeka|whole\s*foods|trader\s*joe|publix|safeway|7.?eleven|albert\s*heijn|coles|loblaws|sobeys|bakery|butcher|deli|fresh\s*market)\b/i.test(text)) {
    return 'Food & Dining';
  }
  // Food items on receipt
  if (/\b(bread|milk|eggs|chicken|beef|rice|pasta|fruit|vegetable|cereal|yogurt|cheese|butter|juice|water|soda|snack|chips|biscuit|cookie)\b/i.test(text) && !/pharmacy|clinic|hospital/i.test(text)) {
    return 'Food & Dining';
  }

  // Healthcare
  if (/\b(pharmacy|clinic|hospital|doctor|medical|health|chemist|clicks|dis.?chem|cvs|walgreens|boots|rite\s*aid|medirite|dental|dentist|optician|optometrist|prescription|medicine|drug\s*store|apotheke|farmacia|apotek)\b/i.test(text)) {
    return 'Healthcare';
  }

  // Shopping / Retail
  if (/\b(game\b|makro|pep\b|jet\b|ackermans|woolworths|mr\s*price|truworths|edgars|foschini|cotton\s*on|h\s*&\s*m|zara|uniqlo|primark|amazon|ikea|best\s*buy|home\s*depot|lowes|builders|cashbuild|target|marshall|tj\s*maxx|ross|nordstrom|macy|jcpenney|kohls|old\s*navy|gap\b|nike|adidas|clothing|fashion|apparel|shoes|wear)\b/i.test(text)) {
    return 'Shopping';
  }

  // Utilities
  if (/\b(electric|water|internet|wifi|broadband|fibre|fiber|airtime|data|dstv|btc|bpc|wuc|mascom|orange|btel|prepaid|recharge|vodacom|mtn|telkom|at&t|verizon|comcast|sprint|t.?mobile|virgin\s*media|sky\b|netflix|spotify|subscription|utility|power|gas\s*bill|sewage|waste|council\s*tax)\b/i.test(text)) {
    return 'Utilities';
  }

  // Entertainment
  if (/\b(cinema|movie|theatre|theater|ticket|event|concert|ster\s*kinekor|nouveau|bowling|arcade|museum|amusement|theme\s*park|zoo|aquarium|festival|show|performance|stadium|sport|gym\s*member|fitness)\b/i.test(text)) {
    return 'Entertainment';
  }

  // Education
  if (/\b(school|university|college|book|tuition|education|stationery|cna|exclusive\s*books|library|course|training|workshop|seminar|student|textbook|notebook|pen|pencil|exam)\b/i.test(text)) {
    return 'Education';
  }

  // Electronics
  if (/\b(incredible\s*connection|hi.?fi\s*corp|currys|media\s*markt|apple\s*store|samsung|laptop|phone|tablet|computer|electronics|charger|cable|headphone|speaker|battery|usb)\b/i.test(text)) {
    return 'Shopping';
  }

  // Home / Hardware
  if (/\b(hardware|plumbing|paint|tile|lumber|garden|furniture|mattress|curtain|blind|carpet|renovation)\b/i.test(text)) {
    return 'Shopping';
  }

  return 'Other';
}

export default parseReceiptText;
