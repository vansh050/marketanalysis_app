export function detectMarketExchange(symbol, providedExchange) {
  if (!symbol) return providedExchange || 'NSE';
  const normalized = String(symbol).toUpperCase();
  if (
    normalized.endsWith('-EQ') ||
    normalized.endsWith('-BE') ||
    normalized.endsWith('-SM') ||
    normalized.endsWith('-ST')
  ) {
    return providedExchange || 'NSE';
  }
  if (/\d(CE|PE|FUT)$/.test(normalized)) {
    if (providedExchange === 'BSE') return 'BFO';
    if (providedExchange === 'NFO' || providedExchange === 'BFO') {
      return providedExchange;
    }
    return 'NFO';
  }
  return providedExchange || 'NSE';
}

export function buildReconnectSubscriptions(symbols, exchangeBySymbol) {
  return Array.from(symbols || []).map(symbol => ({
    symbol,
    exchange:
      exchangeBySymbol?.get?.(symbol) || detectMarketExchange(symbol),
  }));
}

export function needsPriceRefresh(entry, now = Date.now(), staleAfterMs = 60 * 1000) {
  return (
    !entry ||
    !(Number(entry.lastPrice) > 0) ||
    !entry.timestamp ||
    now - entry.timestamp > staleAfterMs
  );
}
