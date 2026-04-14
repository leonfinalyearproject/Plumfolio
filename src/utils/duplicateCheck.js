// src/utils/duplicateCheck.js
// =============================================================================
// DUPLICATE TRANSACTION DETECTION
// =============================================================================
// A transaction is considered a potential duplicate if another transaction has:
//   1. Same type (income/expense)
//   2. Same amount (exact match to 2 decimals)
//   3. Same category
//   4. Date within ±1 day
//   5. Either identical description OR similar description (token overlap >= 60%)
//
// We return a DUPLICATE MATCH rather than block the add outright, because some
// legitimate cases look identical (e.g. two coffees on the same day). The UI
// warns the user and asks them to confirm.
// =============================================================================

const DATE_TOLERANCE_DAYS = 1;
const DESCRIPTION_SIMILARITY_THRESHOLD = 0.6;

// Strip punctuation + lowercase, split on whitespace, drop 1-char tokens.
function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

// Jaccard-style overlap — how much do these two descriptions share?
function descriptionSimilarity(a, b) {
  if (!a || !b) return 0;
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach(t => { if (tb.has(t)) shared++; });
  const union = new Set([...ta, ...tb]).size;
  return shared / union;
}

function daysBetween(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.abs(Math.round((da - db) / 86400000));
}

/**
 * Find potential duplicates of `candidate` within `existing`.
 * Pass `excludeId` when editing an existing transaction so it doesn't match itself.
 *
 * @param {Object} candidate - { type, amount, category, date, description }
 * @param {Array}  existing  - list of DB transactions
 * @param {string|number} [excludeId]
 * @returns {Array} matches, sorted by strongest match first (empty if none)
 */
export function findDuplicates(candidate, existing, excludeId = null) {
  if (!candidate || !Array.isArray(existing)) return [];
  const amt = parseFloat(candidate.amount);
  if (!isFinite(amt) || amt <= 0) return [];
  const matches = [];

  existing.forEach(t => {
    if (excludeId && t.id === excludeId) return;
    if (t.type !== candidate.type) return;
    if ((t.category || '') !== (candidate.category || '')) return;
    if (Math.abs(parseFloat(t.amount) - amt) > 0.01) return;
    if (daysBetween(t.date, candidate.date) > DATE_TOLERANCE_DAYS) return;

    const sim = descriptionSimilarity(t.description, candidate.description);
    const exactDesc = String(t.description || '').trim().toLowerCase() ===
                      String(candidate.description || '').trim().toLowerCase();

    // Strongest: same day + same description → almost certainly a duplicate
    // Medium: same day + similar description
    // Weak: date within tolerance + similar description
    if (exactDesc && daysBetween(t.date, candidate.date) === 0) {
      matches.push({ ...t, matchStrength: 'certain', similarity: 1 });
    } else if (sim >= DESCRIPTION_SIMILARITY_THRESHOLD) {
      matches.push({
        ...t,
        matchStrength: daysBetween(t.date, candidate.date) === 0 ? 'likely' : 'possible',
        similarity: sim,
      });
    }
  });

  const order = { certain: 0, likely: 1, possible: 2 };
  return matches.sort((a, b) => (order[a.matchStrength] ?? 3) - (order[b.matchStrength] ?? 3));
}

/** Human-readable summary of why we think something's a duplicate. */
export function describeMatch(match, formatCurrency) {
  const when = new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const amt = formatCurrency ? formatCurrency(parseFloat(match.amount)) : match.amount;
  return `${match.description} — ${amt} on ${when} (${match.category})`;
}
