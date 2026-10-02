import { io } from "socket.io-client";
import axios from "axios";
import useLTPStore from "./useLtpStore";
import server from "../../../utils/serverConfig";
import {getAccountEmail} from '../../../utils/accountEmail';
import auth from '@react-native-firebase/auth';
import {fetchLTPBatch} from '../../../utils/marketDataLTP';
import {detectMarketExchange} from '../../../utils/marketDataReconnect';

const STALE_PRICE_MS = 60 * 1000;
const REST_RECOVERY_INTERVAL_MS = 30 * 1000;
const INITIAL_RECOVERY_DELAY_MS = 4 * 1000;

const normalizeSymbol = symbol => String(symbol || '').trim().toUpperCase();

const normalizeSymbols = symbols => {
  const seen = new Set();
  return (symbols || [])
    .map(item => {
      const symbol = normalizeSymbol(
        item?.symbol || item?.Symbol || item?.orginal_symbol,
      );
      const providedExchange = String(item?.exchange || item?.Exchange || '')
        .trim()
        .toUpperCase();
      return {
        symbol,
        exchange: detectMarketExchange(symbol, providedExchange || undefined),
      };
    })
    .filter(item => {
      const key = `${item.exchange}:${item.symbol}`;
      if (!item.symbol || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getFirebaseToken = async () => {
  try {
    return (await auth().currentUser?.getIdToken()) || null;
  } catch (_) {
    return null;
  }
};

const WebSocketManager = (() => {
  let instance = null;
  let subscribers = new Map();
  let socket = null;
  let latestLTPs = new Map();
  let subscribedSymbols = new Map(); // symbol -> exchange (was Set, now Map for reconnect re-subscription)
  let configData = null;
  let userEmail = null;
  let connectingPromise = null; // Guard against concurrent connect() calls
  let connectResolve = null;   // Stored so connect_error can resolve stale Promise
  let recoveryInterval = null;
  let fallbackTimers = new Set();
  let priceUpdatedAt = new Map();

  const baseWsUrl = server.websocket.baseUrl;

  // Helper to get current subscription params, with fallback to Firebase auth
  const getSubscriptionParams = () => ({
    userEmail: userEmail || getAccountEmail(),
    dbName: configData?.config?.REACT_APP_HEADER_NAME || "prod",
  });

  const applyPriceUpdate = (rawSymbol, rawLtp) => {
    const symbol = normalizeSymbol(rawSymbol);
    const ltp = Number(rawLtp);
    if (!symbol || !Number.isFinite(ltp) || ltp <= 0) return;

    useLTPStore.getState().setLTP(symbol, ltp);
    latestLTPs.set(symbol, ltp);
    priceUpdatedAt.set(symbol, Date.now());

    const callbacks = subscribers.get(symbol) || [];
    callbacks.forEach(cb => cb({symbol, ltp}));
  };

  const recoverPrices = async symbols => {
    const now = Date.now();
    const stale = normalizeSymbols(symbols).filter(({symbol}) => {
      const current = Number(useLTPStore.getState().getLTP(symbol));
      const updatedAt = priceUpdatedAt.get(symbol) || 0;
      return !(current > 0) || now - updatedAt >= STALE_PRICE_MS;
    });
    if (stale.length === 0) return;

    const prices = await fetchLTPBatch(stale);
    Object.entries(prices).forEach(([symbol, ltp]) => {
      applyPriceUpdate(symbol, ltp);
    });
  };

  const scheduleRecovery = symbols => {
    const timer = setTimeout(() => {
      fallbackTimers.delete(timer);
      recoverPrices(symbols);
    }, INITIAL_RECOVERY_DELAY_MS);
    fallbackTimers.add(timer);
  };

  const ensureRecoveryLoop = () => {
    if (recoveryInterval) return;
    recoveryInterval = setInterval(() => {
      recoverPrices(
        Array.from(subscribedSymbols.entries()).map(([symbol, exchange]) => ({
          symbol,
          exchange,
        })),
      );
    }, REST_RECOVERY_INTERVAL_MS);
  };

  const postSubscriptions = async symbols => {
    const params = getSubscriptionParams();
    const token = await getFirebaseToken();
    await axios.post(
      `${baseWsUrl}subscribe-array`,
      {...params, symbolExchange: symbols},
      token ? {headers: {Authorization: `Bearer ${token}`}} : undefined,
    );
    if (socket?.connected) {
      socket.emit('subscribe_symbols', {symbols});
    }
  };

  // Re-subscribe all tracked symbols (used on reconnect)
  const resubscribeAll = () => {
    if (subscribedSymbols.size === 0) return;
    const symbolsToResubscribe = Array.from(subscribedSymbols.entries()).map(
      ([symbol, exchange]) => ({ symbol, exchange })
    );
    postSubscriptions(symbolsToResubscribe).catch(() => {});
    scheduleRecovery(symbolsToResubscribe);
  };

  return {
    initialize(config, email) {
      configData = config;
      userEmail = email;
    },

    getInstance() {
      if (!instance) {
        instance = {
          connect() {
            // Already connected
            if (socket && socket.connected) return Promise.resolve();
            // Connection in progress — reuse the same promise instead of creating a new socket
            if (connectingPromise) return connectingPromise;

            connectingPromise = new Promise((resolve) => {
              connectResolve = resolve;
              // Clean up any stale socket before creating a new one
              if (socket) {
                try { socket.removeAllListeners(); socket.disconnect(); } catch(e) {}
                socket = null;
              }

              socket = io(`${baseWsUrl}ltp`, {
                path: "/socket.io",
                auth: callback => {
                  getFirebaseToken()
                    .then(token => callback(token ? {token} : {}))
                    .catch(() => callback({}));
                },
                transports: ["websocket"],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                timeout: 20000
              });

              socket.on("connect", () => {
                const params = getSubscriptionParams();
                socket.emit("subscribe_me", params);

                // Re-subscribe all existing symbols on reconnection
                resubscribeAll();

                setTimeout(() => {
                  connectingPromise = null;
                  const r = connectResolve;
                  connectResolve = null;
                  if (r) r();
                }, 200);
              });

              socket.on("connect_error", () => {
                // Resolve stale Promise so any awaiting subscribeToAllSymbols
                // callers unblock and can still POST to subscribe-array (HTTP,
                // not socket-dependent). They'll be picked up by resubscribeAll
                // on the next successful reconnect.
                connectingPromise = null;
                const r = connectResolve;
                connectResolve = null;
                if (r) r();
              });

              socket.on("ltp_update", data => {
                applyPriceUpdate(data?.symbol, data?.ltp);
              });

              socket.on("market_data", data => {
                applyPriceUpdate(data?.stockSymbol, data?.last_traded_price);
              });

              socket.on("disconnect", () => {
                connectingPromise = null;
              });
            });

            return connectingPromise;
          },

          async subscribeToAllSymbols(symbols) {
            if (!symbols || symbols.length === 0) return;

            try {
              await this.connect();

              const cleanSymbols = normalizeSymbols(symbols);

              if (cleanSymbols.length === 0) return;

              cleanSymbols.forEach(({ symbol, exchange }) => {
                subscribedSymbols.set(symbol, exchange);
                if (!subscribers.has(symbol)) {
                  subscribers.set(symbol, []);
                }
              });
              ensureRecoveryLoop();
              scheduleRecovery(cleanSymbols);
              await postSubscriptions(cleanSymbols);
            } catch (error) {
              // REST recovery remains active even when the room subscription fails.
            }
          },

          subscribe(symbol, exchange, callback) {
            symbol = normalizeSymbol(symbol);
            const providedExchange = String(exchange || '').trim().toUpperCase();
            exchange = detectMarketExchange(symbol, providedExchange || undefined);
            if (!symbol || typeof callback !== "function") return;

            if (!subscribers.has(symbol)) {
              subscribers.set(symbol, []);
            }

            const list = subscribers.get(symbol);
            if (!list.includes(callback)) list.push(callback);

            const zustandLTP = useLTPStore.getState().getLTP(symbol);
            if (zustandLTP !== undefined) {
              callback({ symbol, ltp: zustandLTP });
            } else if (latestLTPs.has(symbol)) {
              callback({ symbol, ltp: latestLTPs.get(symbol) });
            }

            if (!subscribedSymbols.has(symbol)) {
              // Track immediately so resubscribeAll() picks this up on any
              // reconnect even if the subscribe-array POST below hasn't fired yet.
              subscribedSymbols.set(symbol, exchange);
              this.subscribeToAllSymbols([{ symbol, exchange }]);
            }
          },

          getLTP(symbol) {
            return new Promise((resolve, reject) => {
              symbol = normalizeSymbol(symbol);
              const zs = useLTPStore.getState().getLTP(symbol);
              if (zs !== undefined) return resolve(zs);

              if (latestLTPs.has(symbol)) return resolve(latestLTPs.get(symbol));

              reject("LTP not available");
            });
          },

          disconnect() {
            if (socket) {
              socket.removeAllListeners();
              socket.disconnect();
            }
            subscribers.clear();
            subscribedSymbols.clear();
            latestLTPs.clear();
            priceUpdatedAt.clear();
            fallbackTimers.forEach(timer => clearTimeout(timer));
            fallbackTimers.clear();
            if (recoveryInterval) clearInterval(recoveryInterval);
            recoveryInterval = null;
            connectingPromise = null;
            socket = null;
          },
        };
      }

      return instance;
    },
  };
})();

export default WebSocketManager;
