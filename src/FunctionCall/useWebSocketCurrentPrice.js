/**
 * useWebSocketCurrentPrice
 *
 * Real-time LTP streaming. Protocol mirrors web
 * (prod-alphaquark-github/src/context/MarketDataContext.js):
 *
 *   1. Connect to socket.io namespace ${ccxtUrl}/ltp (not default "/").
 *   2. On connect, emit 'subscribe_me' with { userEmail, dbName } so the
 *      server attaches this socket to the user's subscription scope.
 *   3. Subscribe via batched POST ${ccxtUrl}/subscribe-array with body
 *      { symbolExchange: [...], userEmail, dbName } — the per-symbol
 *      /websocket/subscribe endpoint the app used before is unrelated
 *      to this pipeline and doesn't trigger price delivery here.
 *   4. Listen to both 'ltp_update' (primary) and 'market_data' (alt)
 *      events — web supports both shapes.
 *
 * Returns { ltp, getLTPForSymbol }. getLTPForSymbol(sym) returns the
 * last price as a Number, or 0 if we haven't received one yet.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import Config from 'react-native-config';
import { getAuth } from '@react-native-firebase/auth';
import server from '../utils/serverConfig';

/**
 * Detect the correct exchange for a symbol.
 * Derivative symbols (ending with CE, PE, FUT preceded by digit) belong to NFO
 * or BFO. Equity suffixes (-EQ, -BE, etc.) stay on NSE/BSE.
 */
function detectExchange(symbol, providedExchange) {
  if (!symbol) return providedExchange || 'NSE';
  const s = symbol.toUpperCase();
  if (s.endsWith('-EQ') || s.endsWith('-BE') || s.endsWith('-SM') || s.endsWith('-ST'))
    return providedExchange || 'NSE';
  const isDerivative = /\d(CE|PE|FUT)$/.test(s);
  if (isDerivative) {
    if (providedExchange === 'BSE') return 'BFO';
    if (providedExchange === 'NFO' || providedExchange === 'BFO') return providedExchange;
    return 'NFO';
  }
  return providedExchange || 'NSE';
}

// Web hits https://websocket.alphaquark.in (NOT ccxtprod) for both the
// socket.io /ltp namespace and the /subscribe-array REST call. The app
// already has this URL in serverConfig.js as `server.websocket.baseUrl`;
// it just wasn't being used. Strip trailing slash so the path joins work.
const rawBase = server.websocket.baseUrl || '';
const ccxtUrl = rawBase.replace(/\/+$/, '');

const useWebSocketCurrentPrice = (symbols) => {
  const [ltp, setLtp] = useState([]);
  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());
  const pendingSubscriptionsRef = useRef([]); // symbols queued while socket connects

  const auth = getAuth();
  const userEmail = auth.currentUser?.email;
  const dbName =
    Config.REACT_APP_HEADER_NAME ||
    Config.REACT_APP_URL ||
    Config.REACT_APP_ADVISOR_SUBDOMAIN ||
    '';

  const memoizedSymbols = useMemo(() => {
    if (!symbols) return [];
    const seen = new Set();
    const out = [];
    for (const item of symbols) {
      const sym = (item?.symbol || item?.Symbol || item?.tradingSymbol || '').toString().toUpperCase();
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      const rawExchange = item?.exchange || item?.Exchange;
      out.push({ symbol: sym, exchange: detectExchange(sym, rawExchange) });
    }
    return out;
  }, [symbols]);

  // --- Price update handler (shared by ltp_update and market_data) ---
  const applyPriceUpdate = useCallback((rawSymbol, rawLtp) => {
    if (!rawSymbol || rawLtp === undefined || rawLtp === null) return;
    const symbol = rawSymbol.toString().toUpperCase();
    const lastPrice = parseFloat(rawLtp);
    if (isNaN(lastPrice)) return;
    setLtp((prev) => {
      const index = prev.findIndex((item) => item.tradingSymbol === symbol);
      if (index !== -1) {
        if (prev[index].lastPrice === lastPrice) return prev;
        const next = [...prev];
        next[index] = { ...next[index], lastPrice };
        return next;
      }
      return [...prev, { tradingSymbol: symbol, lastPrice }];
    });
  }, []);

  // --- Batched REST subscribe ---
  const subscribeViaAPI = useCallback(
    async (list) => {
      if (!list || list.length === 0) return;
      if (!userEmail) {
        // Queue until user email is available (firebase auth hydrates async).
        pendingSubscriptionsRef.current.push(...list);
        return;
      }
      try {
        await axios.post(`${ccxtUrl}/subscribe-array`, {
          symbolExchange: list,
          userEmail,
          dbName,
        });
        list.forEach((s) => subscribedSymbolsRef.current.add(s.symbol.toUpperCase()));
      } catch (err) {
        console.warn('[useWebSocketCurrentPrice] /subscribe-array failed:', err?.message);
      }
    },
    [userEmail, dbName],
  );

  // --- Socket lifecycle ---
  useEffect(() => {
    if (!userEmail) return; // wait for auth

    const socket = io(`${ccxtUrl}/ltp`, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Authenticate the socket to the user/advisor scope.
      socket.emit('subscribe_me', { userEmail, dbName });

      // Re-subscribe any symbols we already knew about (reconnect case).
      const all = Array.from(subscribedSymbolsRef.current);
      if (all.length > 0) {
        subscribeViaAPI(all.map((s) => ({ symbol: s, exchange: 'NSE' })));
      }
      // Drain queued pending subscriptions.
      if (pendingSubscriptionsRef.current.length > 0) {
        subscribeViaAPI(pendingSubscriptionsRef.current);
        pendingSubscriptionsRef.current = [];
      }
    });

    socket.on('ltp_update', (data) => {
      applyPriceUpdate(data?.symbol, data?.ltp);
    });

    socket.on('market_data', (data) => {
      applyPriceUpdate(data?.stockSymbol, data?.last_traded_price);
    });

    socket.on('connect_error', (err) => {
      console.warn('[useWebSocketCurrentPrice] connect_error:', err?.message);
    });

    return () => {
      socket.off('ltp_update');
      socket.off('market_data');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userEmail, dbName, applyPriceUpdate, subscribeViaAPI]);

  // --- Subscribe the symbols this caller asked for ---
  useEffect(() => {
    if (memoizedSymbols.length === 0) return;
    const fresh = memoizedSymbols.filter(
      (s) => !subscribedSymbolsRef.current.has(s.symbol),
    );
    if (fresh.length === 0) return;
    // If socket not connected yet, queue — 'connect' handler will drain.
    if (!socketRef.current || !socketRef.current.connected) {
      pendingSubscriptionsRef.current.push(...fresh);
      return;
    }
    subscribeViaAPI(fresh);
  }, [memoizedSymbols, subscribeViaAPI]);

  const getLTPForSymbol = useCallback(
    (symbol) => {
      if (!symbol) return 0;
      const needle = symbol.toString().toUpperCase();
      const hit = ltp.find((item) => item.tradingSymbol === needle);
      if (!hit || hit.lastPrice === undefined || hit.lastPrice === null) return 0;
      return Number(Number(hit.lastPrice).toFixed(2));
    },
    [ltp],
  );

  return {
    ltp,
    getLTPForSymbol,
  };
};

export default useWebSocketCurrentPrice;
