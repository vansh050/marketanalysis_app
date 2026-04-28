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

export function isSellAuthRejection(message, classification) {
  if (classification === 'SELL_AUTH_REVOKED' || classification === 'SELL_AUTH_REQUIRED') {
    return true;
  }
  if (!message || typeof message !== 'string') return false;
  return KEYWORDS.some(rx => rx.test(message));
}
