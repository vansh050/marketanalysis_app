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
import server from '../utils/serverConfig';
import {getAccountEmail} from '../utils/accountEmail';
import {fetchLTPBatch} from '../utils/marketDataLTP';
import {
  buildReconnectSubscriptions,
  detectMarketExchange,
  needsPriceRefresh,
} from '../utils/marketDataReconnect';

// Web hits https://websocket.alphaquark.in (NOT ccxtprod) for both the
// socket.io /ltp namespace and the /subscribe-array REST call. The app
// already has this URL in serverConfig.js as `server.websocket.baseUrl`;
// it just wasn't being used. Strip trailing slash so the path joins work.
const rawBase = server.websocket.baseUrl || '';
const ccxtUrl = rawBase.replace(/\/+$/, '');
const REST_RECOVERY_INTERVAL_MS = 30 * 1000;

const useWebSocketCurrentPrice = (symbols) => {
  const [ltp, setLtp] = useState([]);
  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());
  const symbolExchangesRef = useRef(new Map());
  const pendingSubscriptionsRef = useRef([]); // symbols queued while socket connects
  const ltpRef = useRef([]);
  const fallbackTimersRef = useRef(new Set());

  const userEmail = getAccountEmail();
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
      out.push({ symbol: sym, exchange: detectMarketExchange(sym, rawExchange) });
    }
    return out;
  }, [symbols]);

  // --- Price update handler (shared by ltp_update and market_data) ---
  useEffect(() => {
    ltpRef.current = ltp;
  }, [ltp]);

  const applyPriceUpdate = useCallback((rawSymbol, rawLtp, source = 'websocket') => {
    if (!rawSymbol || rawLtp === undefined || rawLtp === null) return;
    const symbol = rawSymbol.toString().toUpperCase();
    const lastPrice = parseFloat(rawLtp);
    if (isNaN(lastPrice)) return;
    setLtp((prev) => {
      const index = prev.findIndex((item) => item.tradingSymbol === symbol);
      if (index !== -1) {
        if (prev[index].lastPrice === lastPrice) return prev;
        const next = [...prev];
        next[index] = {
          ...next[index],
          lastPrice,
          timestamp: Date.now(),
          source,
        };
        return next;
      }
      return [
        ...prev,
        {tradingSymbol: symbol, lastPrice, timestamp: Date.now(), source},
      ];
    });
  }, []);

  const refreshMissingOrStalePrices = useCallback(
    async list => {
      const now = Date.now();
      const refresh = (list || []).filter(item => {
        const symbol = item.symbol.toUpperCase();
        const entry = ltpRef.current.find(
          price => price.tradingSymbol === symbol,
        );
        return needsPriceRefresh(entry, now);
      });
      if (refresh.length === 0) return;
      const prices = await fetchLTPBatch(refresh);
      Object.entries(prices).forEach(([symbol, price]) => {
        applyPriceUpdate(symbol, price, 'rest');
      });
    },
    [applyPriceUpdate],
  );

  const schedulePriceRecovery = useCallback(
    list => {
      const timer = setTimeout(() => {
        fallbackTimersRef.current.delete(timer);
        refreshMissingOrStalePrices(list);
      }, 4000);
      fallbackTimersRef.current.add(timer);
    },
    [refreshMissingOrStalePrices],
  );

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
        list.forEach(s => {
          const symbol = s.symbol.toUpperCase();
          subscribedSymbolsRef.current.add(symbol);
          symbolExchangesRef.current.set(
            symbol,
            detectMarketExchange(symbol, s.exchange),
          );
        });
      } catch (err) {
        console.warn('[useWebSocketCurrentPrice] /subscribe-array failed:', err?.message);
      } finally {
        // Price recovery must not depend on the subscription request succeeding.
        // A REST quote still unblocks basket preparation during a socket/API outage.
        schedulePriceRecovery(list);
      }
    },
    [userEmail, dbName, schedulePriceRecovery],
  );

  // --- Socket lifecycle ---
  useEffect(() => {
    if (!userEmail) return; // wait for auth
    const fallbackTimers = fallbackTimersRef.current;

    const socket = io(`${ccxtUrl}/ltp`, {
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
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
        subscribeViaAPI(
          buildReconnectSubscriptions(all, symbolExchangesRef.current),
        );
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
      fallbackTimers.forEach(timer => clearTimeout(timer));
      fallbackTimers.clear();
    };
  }, [userEmail, dbName, applyPriceUpdate, subscribeViaAPI]);

  // --- Subscribe the symbols this caller asked for ---
  useEffect(() => {
    if (memoizedSymbols.length === 0) return;
    // Also schedule recovery before the socket connects; otherwise a connection
    // outage leaves the list queued forever with no usable price fallback.
    schedulePriceRecovery(memoizedSymbols);
    memoizedSymbols.forEach(item => {
      symbolExchangesRef.current.set(item.symbol, item.exchange);
    });
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
  }, [memoizedSymbols, schedulePriceRecovery, subscribeViaAPI]);

  // A Socket.IO connection can remain "connected" while symbol-room delivery
  // has silently stalled. Re-check every subscribed symbol independently of
  // socket state and heal missing/stale quotes through the batched REST API.
  useEffect(() => {
    if (memoizedSymbols.length === 0) return undefined;
    const interval = setInterval(
      () => refreshMissingOrStalePrices(memoizedSymbols),
      REST_RECOVERY_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [memoizedSymbols, refreshMissingOrStalePrices]);

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
