/**
 * Detect whether a broker rejection message / classification indicates a
 * sell-authorization problem (EDIS / DDPI / TPIN / mandate / POA not
 * enabled). Used by rejection-display surfaces across the app to decide
 * whether to render an inline "Learn about DDPI" affordance that opens
 * the per-broker DDPI help modal.
 *
 * Intentionally liberal on the message side — broker error strings are
 * inconsistent across Zerodha / Angel One / Upstox / Motilal / etc. ccxt-
 * india's `message_map.py` classifies these to `SELL_AUTH_REVOKED` on the
 * server; we prefer that signal when present and fall back to keyword
 * matching on the raw text when it isn't.
 */

const KEYWORDS = [
  /\bedis\b/i,
  /\bddpi\b/i,
  /\btpin\b/i,
  /\bmandate\b/i,
  /authoriz/i, // authorization / authorized / authorise / authorised
  /sell[-_ ]?auth/i,
  /insufficient\s+stocks?\s+allocated/i, // Zerodha phrasing
  /insufficient\s+mandate/i, // Angel One phrasing
  /poa\s+not\s+enabled/i,
  /cdsl\s+tpin/i,
  /3-in-1/i, // Axis 3-in-1 authorization
];

export const SELL_AUTH_FAILURE_CLASSIFICATIONS = new Set([
  'SELL_AUTH_REVOKED',
  'SELL_AUTH_REQUIRED',
]);

/**
 * Strict control-flow predicate for opening a sell-authorization recovery
 * screen. Raw broker prose is intentionally ignored here: only the backend's
 * stable classification (or an equivalent explicit flag) may replace an
 * order result with DDPI/eDIS/TPIN recovery.
 */
export function isExplicitSellAuthRejection(result) {
  if (!result || typeof result !== 'object') return false;
  const classification = String(
    result.classification || result.code || result.errorCode || '',
  ).toUpperCase();
  return (
    SELL_AUTH_FAILURE_CLASSIFICATIONS.has(classification) ||
    result.sell_auth_revoked === true ||
    result.sellAuthRevoked === true ||
    result.sell_auth_required === true ||
    result.sellAuthRequired === true
  );
}

export function hasExplicitSellAuthRejection(results) {
  if (Array.isArray(results)) {
    return results.some(isExplicitSellAuthRejection);
  }
  if (!results || typeof results !== 'object') return false;
  if (isExplicitSellAuthRejection(results)) return true;
  return [results.results, results.response, results.orderErrors, results.details]
    .filter(Array.isArray)
    .some(rows => rows.some(isExplicitSellAuthRejection));
}

export function isSellAuthRejection(message, classification) {
  if (SELL_AUTH_FAILURE_CLASSIFICATIONS.has(classification)) {
    return true;
  }
  if (!message || typeof message !== 'string') return false;
  return KEYWORDS.some(rx => rx.test(message));
}
