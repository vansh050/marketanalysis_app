/**
 * useZerodhaSymbolMap
 *
 * Fetch a `{angelone_symbol → {zerodha_symbol, exchange, lot_size, ltp}}` map
 * from ccxt-india's `POST /zerodha/convert-symbol` for the given
 * `stockDetails`. The map is the authoritative mapping for building Kite
 * publisher baskets — handles `-EQ` suffix stripping, BE-series → BSE
 * diversion, BSE-primary symbols mislabeled as NSE in tradeReco, etc.
 *
 * Why a hook (not an on-demand call in the submit handler):
 * `useWebSocketCurrentPrice` subscribes to symbols the moment the review
 * modal opens so the UI can show live LTP. For `-EQ` / BE / BSE-primary
 * symbols, that subscription needs the *corrected* exchange or it silently
 * never receives prices (VIKASECO-EQ is the canonical example). Fetching
 * the map in `useEffect` on mount lets callers pass corrected
 * `{symbol, exchange}` pairs into the LTP hook *before* subscribing.
 *
 * Stability: the hook keys on the joined list of advice-side trading
 * symbols, so adding/removing stocks in the review triggers a single
 * re-fetch (no thrash from unrelated re-renders).
 */
import {useEffect, useRef, useState} from 'react';
import {convertSymbolsToZerodha} from '../utils/brokerPublisher';

const extractSymbols = stockDetails => {
  if (!stockDetails || stockDetails.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const s of stockDetails) {
    const sym = (
      s?.tradingSymbol ||
      s?.symbol ||
      s?.Trading_Symbol ||
      ''
    ).toString();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
  }
  return out;
};

const useZerodhaSymbolMap = (stockDetails, enabled = true) => {
  const [map, setMap] = useState({});
  const lastKeyRef = useRef('');

  useEffect(() => {
    if (!enabled) return;
    const symbols = extractSymbols(stockDetails);
    if (symbols.length === 0) return;
    const key = symbols.slice().sort().join('|');
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    let cancelled = false;
    convertSymbolsToZerodha(symbols).then(result => {
      if (cancelled) return;
      console.log('[useZerodhaSymbolMap] result:', JSON.stringify(result || {}));
      setMap(result || {});
    });
    return () => {
      cancelled = true;
    };
    // Re-run when the set of advice symbols changes. Using JSON.stringify
    // on a minimal projection keeps this cheap and stable under unrelated
    // re-renders of the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, JSON.stringify(extractSymbols(stockDetails))]);

  return map;
};

export default useZerodhaSymbolMap;
