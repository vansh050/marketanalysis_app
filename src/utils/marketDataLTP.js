/**
 * marketDataLTP.js
 * REST API fallback for fetching Last Traded Price (LTP) when WebSocket is unavailable.
 * Ported from prod-alphaquark-github for feature parity.
 */
import {generateToken} from './SecurityTokenManager';
import Config from 'react-native-config';
import server from './serverConfig';

// In-memory LTP cache with timestamps
const ltpCache = {};
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Fetch LTP for multiple symbols via REST API.
 * @param {Array<{symbol: string, exchange: string}>} symbols
 * @returns {Promise<Object>} Map of symbol -> ltp
 */
export async function fetchLTPBatch(symbols) {
  if (!symbols || symbols.length === 0) return {};

  const orders = symbols.map(s => ({
    exchange: s.exchange || 'NSE',
    tradingSymbol: s.symbol || s.tradingSymbol,
  }));

  try {
    const response = await fetch(
      `${server.websocket.baseUrl}market-data/ltp`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        body: JSON.stringify({Orders: orders}),
      },
    );

    if (!response.ok) {
      throw new Error(`LTP fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const fetched = data?.data?.fetched || data?.fetched || [];
    const result = {};
    const now = Date.now();

    fetched.forEach(item => {
      const sym = (item.tradingSymbol || item.symbol || '').toUpperCase();
      const ltp = parseFloat(item.ltp || item.lastPrice || 0);
      if (sym && ltp > 0) {
        result[sym] = ltp;
        ltpCache[sym] = {ltp, timestamp: now};
      }
    });

    return result;
  } catch (err) {
    console.warn('[marketDataLTP] Batch fetch error:', err);
    return {};
  }
}

/**
 * Get LTP for a single symbol. Uses cache if fresh, else fetches.
 */
export async function fetchLTP(symbol, exchange) {
  if (!symbol) return 0;
  const key = symbol.toUpperCase();

  // Check cache
  const cached = ltpCache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.ltp;
  }

  // Fetch from API
  const result = await fetchLTPBatch([{symbol, exchange: exchange || 'NSE'}]);
  return result[key] || 0;
}

/**
 * Get cached LTP without making API call.
 */
export function getCachedLTP(symbol) {
  if (!symbol) return 0;
  const cached = ltpCache[symbol.toUpperCase()];
  return cached?.ltp || 0;
}

/**
 * Check if cached LTP is stale.
 */
export function isLTPStale(symbol, thresholdMs = CACHE_TTL_MS) {
  if (!symbol) return true;
  const cached = ltpCache[symbol.toUpperCase()];
  if (!cached) return true;
  return Date.now() - cached.timestamp > thresholdMs;
}

/**
 * Preload LTP for an array of symbols.
 */
export async function preloadLTP(symbols) {
  const toFetch = symbols
    .filter(s => {
      const key = (s.symbol || s).toUpperCase();
      const cached = ltpCache[key];
      return !cached || Date.now() - cached.timestamp > CACHE_TTL_MS;
    })
    .map(s =>
      typeof s === 'string'
        ? {symbol: s, exchange: 'NSE'}
        : {symbol: s.symbol, exchange: s.exchange || 'NSE'},
    );

  if (toFetch.length > 0) {
    await fetchLTPBatch(toFetch);
  }
}

/**
 * Clear the entire LTP cache.
 */
export function clearLTPCache() {
  Object.keys(ltpCache).forEach(k => delete ltpCache[k]);
}
