/**
 * MarketDataContext.js
 * Centralized real-time market data streaming via WebSocket.
 * Ported from prod-alphaquark-github for feature parity.
 *
 * Provides:
 * - Single WebSocket connection for all price data
 * - Symbol subscription/unsubscription management
 * - LTP cache with staleness detection
 * - Hooks: useMarketData(), useMarketPrice(symbol), useMarketPrices(symbols)
 */
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {ccxtServer} from '../utils/serverConfig';

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = '@market_data_cache';
const DEBOUNCE_SAVE_MS = 2000;

// --- Reducer ---
const ACTION = {
  SET_PRICES: 'SET_PRICES',
  UPDATE_PRICE: 'UPDATE_PRICE',
  ADD_SUBSCRIPTIONS: 'ADD_SUBSCRIPTIONS',
  SET_CONNECTION: 'SET_CONNECTION',
  HYDRATE: 'HYDRATE',
};

function reducer(state, action) {
  switch (action.type) {
    case ACTION.HYDRATE:
      return {...state, prices: {...action.payload, ...state.prices}, isHydrated: true};
    case ACTION.UPDATE_PRICE: {
      const {symbol, ltp, timestamp} = action.payload;
      if (!symbol) return state;
      return {
        ...state,
        prices: {
          ...state.prices,
          [symbol.toUpperCase()]: {ltp, timestamp: timestamp || Date.now(), source: 'ws'},
        },
      };
    }
    case ACTION.SET_PRICES:
      return {...state, prices: {...state.prices, ...action.payload}};
    case ACTION.ADD_SUBSCRIPTIONS: {
      const next = new Set(state.subscriptions);
      action.payload.forEach(s => next.add(s.toUpperCase()));
      return {...state, subscriptions: next};
    }
    case ACTION.SET_CONNECTION:
      return {...state, connection: {...state.connection, ...action.payload}};
    default:
      return state;
  }
}

const initialState = {
  prices: {},
  connection: {status: 'disconnected', error: null},
  subscriptions: new Set(),
  isHydrated: false,
};

const MarketDataContext = createContext(null);

export function MarketDataProvider({children, websocketUrl}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);
  const saveTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const subscribedRef = useRef(new Set());

  const wsUrl = websocketUrl || ccxtServer;

  // --- Cache persistence ---
  const loadFromCache = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        dispatch({type: ACTION.HYDRATE, payload: JSON.parse(cached)});
      } else {
        dispatch({type: ACTION.HYDRATE, payload: {}});
      }
    } catch {
      dispatch({type: ACTION.HYDRATE, payload: {}});
    }
  }, []);

  const saveToCache = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(state.prices));
      } catch {}
    }, DEBOUNCE_SAVE_MS);
  }, [state.prices]);

  useEffect(() => {
    loadFromCache();
  }, []);

  useEffect(() => {
    if (Object.keys(state.prices).length > 0) {
      saveToCache();
    }
  }, [state.prices]);

  // --- WebSocket subscription via REST API ---
  const subscribeViaAPI = useCallback(
    async symbols => {
      if (!symbols || symbols.length === 0) return;
      try {
        const response = await fetch(`${wsUrl}websocket/subscribe`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({symbols}),
        });
        if (response.ok) {
          symbols.forEach(s => subscribedRef.current.add(s.toUpperCase()));
        }
      } catch (err) {
        console.warn('[MarketData] Subscribe API error:', err);
      }
    },
    [wsUrl],
  );

  // --- Public: subscribe to symbols ---
  const subscribe = useCallback(
    symbols => {
      if (!symbols || symbols.length === 0) return;
      const normalized = symbols
        .map(s => (typeof s === 'string' ? s.toUpperCase().trim() : ''))
        .filter(s => s && !subscribedRef.current.has(s));

      if (normalized.length === 0) return;
      dispatch({type: ACTION.ADD_SUBSCRIPTIONS, payload: normalized});
      subscribeViaAPI(normalized);
    },
    [subscribeViaAPI],
  );

  // --- Public: get price for a symbol ---
  const getPrice = useCallback(
    symbol => {
      if (!symbol) return {ltp: 0, isLoading: true, isStale: true};
      const key = symbol.toUpperCase();
      const entry = state.prices[key];
      if (!entry) return {ltp: 0, isLoading: true, isStale: true, source: null};
      const isStale = Date.now() - (entry.timestamp || 0) > STALE_THRESHOLD_MS;
      return {
        ltp: entry.ltp || 0,
        isLoading: false,
        isStale,
        source: entry.source,
        timestamp: entry.timestamp,
      };
    },
    [state.prices],
  );

  // --- Public: get LTP number directly (backward compatible) ---
  const getLTPForSymbol = useCallback(
    symbol => {
      if (!symbol) return 0;
      const entry = state.prices[symbol.toUpperCase()];
      return entry?.ltp || 0;
    },
    [state.prices],
  );

  // --- Handle incoming price updates (called from WebSocket handler) ---
  const handlePriceUpdate = useCallback((symbol, ltp) => {
    dispatch({
      type: ACTION.UPDATE_PRICE,
      payload: {symbol, ltp, timestamp: Date.now()},
    });
  }, []);

  // --- App state handling (pause/resume WebSocket) ---
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && subscribedRef.current.size > 0) {
        // Re-subscribe on app foreground
        subscribeViaAPI(Array.from(subscribedRef.current));
      }
    });
    return () => subscription?.remove();
  }, [subscribeViaAPI]);

  const isConnected = state.connection.status === 'connected';
  const isConnecting = state.connection.status === 'connecting';
  const isDisconnected = state.connection.status === 'disconnected';
  const hasError = !!state.connection.error;

  const value = useMemo(
    () => ({
      prices: state.prices,
      connection: state.connection,
      isHydrated: state.isHydrated,
      subscriptions: state.subscriptions,
      subscribe,
      getPrice,
      getLTPForSymbol,
      handlePriceUpdate,
      isConnected,
      isConnecting,
      isDisconnected,
      hasError,
    }),
    [
      state.prices,
      state.connection,
      state.isHydrated,
      state.subscriptions,
      subscribe,
      getPrice,
      getLTPForSymbol,
      handlePriceUpdate,
      isConnected,
      isConnecting,
      isDisconnected,
      hasError,
    ],
  );

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

// --- Hooks ---

export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
}

/**
 * Single symbol hook with auto-subscribe.
 */
export function useMarketPrice(symbol, exchange) {
  const {subscribe, getPrice} = useMarketData();

  useEffect(() => {
    if (symbol) {
      subscribe([symbol]);
    }
  }, [symbol, subscribe]);

  return getPrice(symbol);
}

/**
 * Multiple symbols hook with auto-subscribe and stable memoization.
 */
export function useMarketPrices(symbols) {
  const {subscribe, prices} = useMarketData();
  const symbolsKey = useMemo(
    () => (symbols || []).sort().join(','),
    [symbols],
  );

  useEffect(() => {
    if (symbols && symbols.length > 0) {
      subscribe(symbols);
    }
  }, [symbolsKey, subscribe]);

  return useMemo(() => {
    const result = {};
    (symbols || []).forEach(s => {
      const key = s?.toUpperCase();
      const entry = prices[key];
      result[s] = entry?.ltp || 0;
    });
    return result;
  }, [symbols, prices]);
}

/**
 * Backward-compatible hook returning getLTPForSymbol function.
 */
export function useLTPGetter() {
  const {getLTPForSymbol} = useMarketData();
  return {getLTPForSymbol};
}

export default MarketDataContext;
