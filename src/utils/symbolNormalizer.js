/**
 * symbolNormalizer.js
 * Converts symbol formats across different brokers.
 * Ported from prod-alphaquark-github for feature parity.
 *
 * Different brokers use different symbol formats:
 * - Zerodha: "SBIN" (NSE), "SBIN23D2860CE" (NFO)
 * - Angel One: "SBIN-EQ", "SBIN-BE"
 * - Upstox: "SBIN" with exchange prefix "NSE_EQ|SBIN"
 * - ICICI: "SBIN" plain
 * - Fyers: "NSE:SBIN-EQ"
 */

/**
 * Strip common suffixes from trading symbols for comparison.
 */
export function stripSymbolSuffix(symbol) {
  if (!symbol) return '';
  return symbol
    .toUpperCase()
    .replace(/-EQ$/i, '')
    .replace(/-BE$/i, '')
    .replace(/-BL$/i, '')
    .replace(/-SM$/i, '')
    .trim();
}

/**
 * Normalize a symbol to a canonical form for cross-broker matching.
 */
export function normalizeSymbol(symbol, exchange) {
  if (!symbol) return '';
  let normalized = symbol.toUpperCase().trim();

  // Remove exchange prefix (Fyers format: "NSE:SBIN-EQ")
  if (normalized.includes(':')) {
    normalized = normalized.split(':').pop();
  }

  // Remove Upstox exchange prefix ("NSE_EQ|SBIN")
  if (normalized.includes('|')) {
    normalized = normalized.split('|').pop();
  }

  // Strip suffixes
  normalized = stripSymbolSuffix(normalized);

  return normalized;
}

/**
 * Convert a symbol to Angel One format.
 */
export function toAngelOneSymbol(symbol, exchange) {
  const base = normalizeSymbol(symbol);
  if (!base) return symbol;
  if (exchange === 'BSE') return `${base}-BE`;
  return `${base}-EQ`;
}

/**
 * Convert a symbol to Zerodha format.
 * For equity, Zerodha uses plain symbol. For F&O, format differs.
 */
export function toZerodhaSymbol(symbol) {
  return normalizeSymbol(symbol);
}

/**
 * Convert a symbol to Fyers format ("NSE:SBIN-EQ").
 */
export function toFyersSymbol(symbol, exchange) {
  const base = normalizeSymbol(symbol);
  const exch = (exchange || 'NSE').toUpperCase();
  return `${exch}:${base}-EQ`;
}

/**
 * Convert a symbol to Upstox format ("NSE_EQ|SBIN").
 */
export function toUpstoxSymbol(symbol, exchange) {
  const base = normalizeSymbol(symbol);
  const exch = (exchange || 'NSE').toUpperCase();
  return `${exch}_EQ|${base}`;
}

/**
 * Convert symbol to broker-specific format.
 */
export function toBrokerSymbol(symbol, exchange, broker) {
  switch (broker) {
    case 'Angel One':
      return toAngelOneSymbol(symbol, exchange);
    case 'Zerodha':
      return toZerodhaSymbol(symbol);
    case 'Fyers':
      return toFyersSymbol(symbol, exchange);
    case 'Upstox':
      return toUpstoxSymbol(symbol, exchange);
    default:
      return normalizeSymbol(symbol);
  }
}

/**
 * Compare two symbols across different broker formats.
 * Returns true if they represent the same underlying instrument.
 */
export function symbolsMatch(symbolA, symbolB) {
  if (!symbolA || !symbolB) return false;
  return normalizeSymbol(symbolA) === normalizeSymbol(symbolB);
}

/**
 * Find matching symbol in an array, broker-agnostic.
 */
export function findMatchingSymbol(targetSymbol, symbolArray, key = 'symbol') {
  const normalized = normalizeSymbol(targetSymbol);
  return symbolArray.find(
    item => normalizeSymbol(typeof item === 'string' ? item : item[key]) === normalized,
  );
}
