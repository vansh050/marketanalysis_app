import { io } from "socket.io-client";
import axios from "axios";
import useLTPStore from "./useLtpStore";
import server from "../../../utils/serverConfig";
import {getAuth} from '@react-native-firebase/auth';

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

  const baseWsUrl = server.websocket.baseUrl;

  // Helper to get current subscription params, with fallback to Firebase auth
  const getSubscriptionParams = () => ({
    userEmail: userEmail || getAuth()?.currentUser?.email,
    dbName: configData?.config?.REACT_APP_HEADER_NAME || "prod",
  });

  // Re-subscribe all tracked symbols (used on reconnect)
  const resubscribeAll = () => {
    if (subscribedSymbols.size === 0) return;
    const symbolsToResubscribe = Array.from(subscribedSymbols.entries()).map(
      ([symbol, exchange]) => ({ symbol, exchange })
    );
    const params = getSubscriptionParams();
    axios.post(`${baseWsUrl}subscribe-array`, {
      ...params,
      symbolExchange: symbolsToResubscribe,
    }).catch(() => {});
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

              socket.on("ltp_update", (data) => {
                if (!data || !data.symbol || !data.ltp) return;

                const { symbol, ltp } = data;

                useLTPStore.getState().setLTP(symbol, ltp);
                latestLTPs.set(symbol, ltp);

                const callbacks = subscribers.get(symbol) || [];
                callbacks.forEach((cb) => cb({ symbol, ltp }));
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

              const cleanSymbols = symbols
                .map((item) => ({
                  symbol: item.symbol || item.Symbol || item.orginal_symbol,
                  exchange: item.exchange || item.Exchange,
                }))
                .filter((x) => x.symbol && x.exchange);

              if (cleanSymbols.length === 0) return;

              const params = getSubscriptionParams();
              await axios.post(`${baseWsUrl}subscribe-array`, {
                ...params,
                symbolExchange: cleanSymbols,
              });

              cleanSymbols.forEach(({ symbol, exchange }) => {
                subscribedSymbols.set(symbol, exchange);
                if (!subscribers.has(symbol)) {
                  subscribers.set(symbol, []);
                }
              });
            } catch (error) {
              // Subscription error - silent
            }
          },

          subscribe(symbol, exchange, callback) {
            if (!symbol || !exchange || typeof callback !== "function") return;

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