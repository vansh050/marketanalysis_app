import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, AppState } from "react-native";
import axios from "axios";
import WebSocketManager from "../../components/AdviceScreenComponents/DynamicText/WebSocketManager";
import { useTrade } from "../../screens/TradeContext";
import server from "../../utils/serverConfig";
import Config from "react-native-config";
import { generateToken } from "../../utils/SecurityTokenManager";

// Day-boundary / foreground refresh interval for the prev-close base.
//
// 2026-06-22: prev-close (yesterday's settled close) is fetched ONCE on mount
// and held in memory for the whole session, with no day-boundary refresh. A
// session left open across the close→open rollover therefore keeps the STALE
// base — e.g. app opened Fri pre-close → base = Thu close → still showing Thu
// close on Mon morning until a manual logout/login (reported 2026-06-22). We
// now re-fetch when the app returns to the foreground, throttled to this
// interval. During market hours a re-fetch returns the SAME value (no flicker
// — the recompute below produces an identical change); the value only differs
// across a session that spans a market close, which is exactly the bug.
const PREV_CLOSE_REFRESH_MS = 15 * 60 * 1000; // 15 minutes

// Indices configuration with correct symbols and exchanges.
//
// 2026-05-07: removed finNifty — AngelOne WebSocket token 26037 does
// not deliver live ticks reliably; key ltp:NSE:FINNIFTY never
// populates in Redis. Confirmed by pubsub monitoring: 0 FINNIFTY
// messages in 80+ samples while NIFTY/BANKNIFTY/SENSEX all stream.
//
// alternativeSymbols for sensex are all uppercase — the server
// normalizes symbols to uppercase before emitting ltp_update, so
// mixed-case aliases like "Sensex" would cause the Set gate to drop
// valid ticks. Fallbacks kept for resilience but must stay uppercase.
const indicesConfig = {
  nifty50: {
    symbol: "NIFTY",
    exchange: "NSE",
    displayName: "Nifty 50",
    alternativeSymbols: [],
  },
  sensex: {
    symbol: "SENSEX",
    exchange: "BSE",
    displayName: "Sensex",
    // 2026-05-26: alternativeSymbols dropped after recurrent "Sensex
    // Loading" reports. The Set-replacement fallback at line ~178 (added
    // 2026-05-07 to stop alias-driven flicker) advanced PAST the working
    // "SENSEX" symbol when the server's auto_sync snapshot (poll cadence
    // ~3s) arrived after the 1.5s fallback timer fired. By that point
    // subscribedSymbolsRef[sensex] had been replaced with
    // Set(["BSE SENSEX"]) or Set(["SENSEX 30"]) — neither of which had
    // data in Redis (`ltp:BSE:BSE SENSEX` and `ltp:BSE:SENSEX 30` both
    // empty per Redis HGETALL inspection 2026-05-26). The legitimate
    // `ltp_update` for symbol="SENSEX" was then silently rejected by the
    // gate. Empty alternativeSymbols matches nifty50/bankNifty and means
    // the fallback timer never fires for an out-of-Redis alias.
    alternativeSymbols: [],
  },
  bankNifty: {
    symbol: "BANKNIFTY",
    exchange: "NSE",
    displayName: "BankNifty",
    alternativeSymbols: [],
  },
};

const initialLoadingState = Object.fromEntries(
  Object.keys(indicesConfig).map((key) => [
    key,
    { value: 0, change: 0, percentChange: 0, loading: true, previousClose: null },
  ])
);

const MarketIndices = () => {
  const { configData, configLoading } = useTrade();

  const [time, setTime] = useState(new Date());
  const [marketData, setMarketData] = useState(initialLoadingState);
  const [basePrices, setBasePrices] = useState({});
  const [comparisonType, setComparisonType] = useState("loading"); // "prevClose", "opening", "loading"
  const [hasInitializedBasePrices, setHasInitializedBasePrices] = useState(false);
  const wsManagerRef = useRef(null);
  const callbacksRef = useRef({});
  const comparisonTypeRef = useRef(comparisonType);
  const basePricesRef = useRef(basePrices);
  const activeSymbolRef = useRef({});
  const subscribedSymbolsRef = useRef({}); // Track ALL subscribed symbols for each key
  const hasReceivedRef = useRef({});
  const fallbackTimersRef = useRef({});
  const fallbackDelayRef = useRef(1500);
  // Day-boundary refresh bookkeeping (see PREV_CLOSE_REFRESH_MS above):
  // lastPrevCloseFetchRef = ms timestamp of the last SUCCESSFUL prev-close
  // fetch (0 = never); fetchPrevCloseRef holds the latest fetch fn so the
  // AppState listener can re-trigger it without duplicating the retry/merge
  // logic.
  const lastPrevCloseFetchRef = useRef(0);
  const fetchPrevCloseRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => {
    comparisonTypeRef.current = comparisonType;
  }, [comparisonType]);

  useEffect(() => {
    basePricesRef.current = basePrices;
  }, [basePrices]);

  // Fetch previous close prices from API (Option 2) with fallback to opening price (Option 3)
  useEffect(() => {
    if (!configData) return;

    const fetchPreviousClosePrices = async (attempt = 0) => {
      try {
        const symbols = Object.entries(indicesConfig).map(([key, config]) => ({
          symbol: config.symbol,
          exchange: config.exchange,
        }));

        // Try to fetch previous close prices from API
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}misc/indices-previous-close`,
          { symbols },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          }
        );

        if (response.data && response.data.data && response.data.success) {
          // Map response to basePrices
          const previousClosePrices = {};
          const pricesData = response.data.data;

          Object.entries(indicesConfig).forEach(([key, config]) => {
            // Check primary symbol first
            let price = pricesData[config.symbol];

            // If not found, check alternative symbols
            if (!price && config.alternativeSymbols) {
              for (const altSymbol of config.alternativeSymbols) {
                if (pricesData[altSymbol]) {
                  price = pricesData[altSymbol];
                  break;
                }
              }
            }

            if (price) {
              previousClosePrices[key] = parseFloat(price);
            }
          });

          if (Object.keys(previousClosePrices).length > 0) {
            // MERGE, don't replace. This effect re-runs whenever `configData`
            // changes, re-fetching prev-close. If a re-fetch intermittently
            // omits a symbol (the endpoint occasionally returns NIFTY missing),
            // replacing the whole object would DROP that symbol's already-known
            // base → the tick callback falls into the else-branch
            // (basePrice = live value) → change flickers to 0.00 while the
            // price stays correct. Merging preserves every known base.
            // (Observed on NIFTY, 2026-06-10.)
            setBasePrices(prev => ({ ...prev, ...previousClosePrices }));
            setComparisonType("prevClose");
            setHasInitializedBasePrices(true);
            lastPrevCloseFetchRef.current = Date.now();
          } else {
            throw new Error("No valid previous close data in response");
          }
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        // 2026-06-08: RETRY before degrading. A single transient failure of the
        // prev-close endpoint used to permanently flip to "opening" mode (base =
        // first live LTP) → when the market is closed (flat LTP) the indices render
        // 0.00% even though Redis has the correct prev_close. Retry up to 3× (1.5s
        // apart) so a blip doesn't strand the user on the 0.00% fallback. Redis
        // prev_close confirmed correct 2026-06-08 (ltp:NSE:NIFTY.prev_close present);
        // the bug was purely this no-retry frontend fallback. See WEBSOCKET_HEALTH doc.
        if (attempt < 3) {
          setTimeout(() => fetchPreviousClosePrices(attempt + 1), 1500);
          return;
        }
        // Exhausted retries → use first price received as opening base (last resort).
        setComparisonType("opening");
        // Don't set hasInitializedBasePrices yet - will be set when first prices arrive
      }
    };

    fetchPrevCloseRef.current = fetchPreviousClosePrices;
    fetchPreviousClosePrices();
  }, [configData]);

  // Day-boundary refresh: re-fetch the prev-close base when the app returns to
  // the foreground after long enough that the completed-session close may have
  // rolled over. This fixes the stale-base-across-overnight/weekend bug
  // (2026-06-22) without a manual logout/login. Throttled by
  // PREV_CLOSE_REFRESH_MS so frequent background/foreground toggles don't spam
  // the endpoint; a same-session refresh returns the same base (no flicker).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      if (Date.now() - lastPrevCloseFetchRef.current < PREV_CLOSE_REFRESH_MS) {
        return;
      }
      fetchPrevCloseRef.current?.();
    });
    return () => sub?.remove();
  }, []);

  // Recompute change/% whenever the base (prev_close) or comparison mode
  // changes — WITHOUT waiting for the next price tick.
  //
  // The tick handler below only (re)computes `change` when the price ticks
  // to a NEW value (the `newPrice !== currentData.value` gate). But the
  // prev_close base is fetched asynchronously and usually lands AFTER the
  // first tick has already set change=0 (in "loading" mode the base is the
  // live price itself). If the index then doesn't tick to a fresh value, the
  // stale 0.00 change sticks on screen even though the correct base is now
  // known — the intermittent "Nifty/Sensex 0.00" report. This effect closes
  // that race: on every base/mode change, recompute each index's change from
  // its current value against the current base. (2026-06-21)
  useEffect(() => {
    if (comparisonType !== "prevClose") {
      return;
    }
    setMarketData((prev) => {
      let mutated = false;
      const next = { ...prev };
      Object.keys(indicesConfig).forEach((key) => {
        const data = prev[key];
        const base = basePrices[key];
        if (!data || data.loading || base == null || !data.value) {
          return;
        }
        const change = parseFloat((data.value - base).toFixed(2));
        const percentChange =
          base === 0 ? 0 : parseFloat(((change / base) * 100).toFixed(2));
        if (change !== data.change || percentChange !== data.percentChange) {
          next[key] = { ...data, change, percentChange, basePrice: base };
          mutated = true;
        }
      });
      return mutated ? next : prev;
    });
  }, [basePrices, comparisonType]);

  // Subscribe to all indices via WebSocket
  useEffect(() => {
    if (!configData) {
      return;
    }

    wsManagerRef.current = WebSocketManager.getInstance();

    const subscribeToIndices = async () => {
      try {
        const subscribeWithFallback = (key, config) => {
          const candidates = [config.symbol, ...(config.alternativeSymbols || [])];
          let attempt = 0;

          const tryNext = () => {
            if (attempt >= candidates.length) return;
            const sym = candidates[attempt++];
            activeSymbolRef.current[key] = sym;
            hasReceivedRef.current[key] = false;

            // 2026-05-07: REPLACE the Set, don't accumulate.
            // Previously this used `.add(sym)` which kept the
            // prior fallback symbol active alongside the new one.
            // When the alias and canonical Redis keys both held
            // data (which they do: AngelOne auto-resolve populates
            // both `ltp:NSE:NIFTY` and `ltp:NSE:NIFTY 50`), the
            // gate at line 172 accepted ticks from either → stale
            // and fresh prices alternated ~3-5x/sec on the home
            // header. Replacing the Set ensures only the currently
            // active sym passes the gate; previous-attempt ticks
            // from the wsManager are silently dropped at line 172.
            subscribedSymbolsRef.current[key] = new Set([sym]);

            const callback = ({ symbol, ltp }) => {
              // Accept data from ANY symbol we've subscribed to for this key
              if (!subscribedSymbolsRef.current[key]?.has(symbol)) return;

              hasReceivedRef.current[key] = true;
              const t = fallbackTimersRef.current[key];
              if (t) {
                clearTimeout(t);
                delete fallbackTimersRef.current[key];
              }

              setMarketData((prev) => {
                const currentData = prev[key];
                const newPrice = parseFloat(ltp);

                const currentComparisonType = comparisonTypeRef.current;
                const currentBasePrices = basePricesRef.current;

                // In prevClose mode the change MUST be measured against the
                // fetched prev_close. If this key's base is transiently
                // unavailable, do NOT fall through to `basePrice = live value`
                // (that renders a bogus 0.00 change while the price is still
                // correct — the NIFTY flicker). Update the price, keep the
                // last good change, and wait for the base to arrive.
                if (currentComparisonType === "prevClose" && !currentBasePrices[key]) {
                  if (newPrice !== currentData.value) {
                    return {
                      ...prev,
                      [key]: { ...currentData, value: newPrice, loading: false },
                    };
                  }
                  return prev;
                }

                let basePrice;
                if (currentComparisonType === "prevClose") {
                  basePrice = currentBasePrices[key];
                  // Spurious-echo guard: a live LTP virtually never lands
                  // EXACTLY on prev_close to full float precision. When a tick
                  // does, it's almost always a server auto_sync snapshot
                  // echoing prev_close (common after market hours / between
                  // real ticks) — it flashes change=0.00 then recovers on the
                  // next real frame. Ignore it; keep the last good reading.
                  if (newPrice === basePrice) {
                    return prev;
                  }
                } else if (currentComparisonType === "opening") {
                  if (!currentBasePrices[key]) {
                    setBasePrices(prevBases => ({
                      ...prevBases,
                      [key]: newPrice,
                    }));
                    setHasInitializedBasePrices(true);
                    basePrice = newPrice;
                  } else {
                    basePrice = currentBasePrices[key];
                  }
                } else {
                  basePrice = currentData.value || newPrice;
                }

                const change = newPrice - basePrice;
                const percentChange = basePrice === 0 ? 0 : (change / basePrice) * 100;

                if (newPrice !== currentData.value) {
                  return {
                    ...prev,
                    [key]: {
                      value: newPrice,
                      change: parseFloat(change.toFixed(2)),
                      percentChange: parseFloat(percentChange.toFixed(2)),
                      loading: false,
                      basePrice: basePrice,
                    },
                  };
                }
                return prev;
              });
            };

            callbacksRef.current[key] = callback;

            wsManagerRef.current.subscribe(sym, config.exchange, callback);

            const delay = fallbackDelayRef.current || 3000;
            if (fallbackTimersRef.current[key]) clearTimeout(fallbackTimersRef.current[key]);
            fallbackTimersRef.current[key] = setTimeout(() => {
              if (!hasReceivedRef.current[key]) {
                tryNext();
              }
            }, delay);
          };

          tryNext();
        };

        Object.entries(indicesConfig).forEach(([key, config]) => {
          subscribeWithFallback(key, config);
        });
      } catch (error) {
        // Error subscribing to indices - silent
      }
    };

    subscribeToIndices();

    const clock = setInterval(() => setTime(new Date()), 5000);

    return () => {
      clearInterval(clock);
      Object.values(fallbackTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, [configData]);

  const displayIndices = Object.entries(indicesConfig).map(([key, config]) => {
    const data = marketData[key];
    const isPositive = data.change >= 0;

    return {
      key,
      name: config.displayName,
      value: data.loading ? "..." : `${Math.abs(data.percentChange).toFixed(2)}%`,
      actualValue: data.value,
      change: Math.abs(data.change).toFixed(2),
      isPositive,
      loading: data.loading,
    };
  });

  // Determine comparison label
  const getComparisonLabel = () => {
    if (comparisonType === "prevClose") {
      return "vs Prev Close";
    }
    return "";
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        {displayIndices.map((index) => {
          const showChange = comparisonType === "prevClose" && basePrices[index.key] != null && !index.loading;
          return (
            <View
              key={index.key}
              style={[styles.indexCard, !showChange && styles.indexCardCondensed]}
            >
              <View>
                {/* Keep text size consistent regardless of data availability */}
                <Text style={styles.indexName}>{index.name}</Text>
                <Text style={styles.actualValue}>
                  {index.loading
                    ? "Loading..."
                    : index.actualValue.toLocaleString()}
                </Text>
              </View>
              {/* Only show arrows and percentage when we have previous close data */}
              {showChange ? (
                <View style={styles.valueContainer}>
                  <Text
                    style={[
                      styles.arrow,
                      { color: index.isPositive ? "#85F500" : "#FF6A6A" },
                    ]}
                  >
                    {index.isPositive ? "▲" : "▼"} {index.change}
                  </Text>
                  <Text
                    style={[
                      styles.indexValue,
                      { color: index.isPositive ? "#85F500" : "#FF6A6A" },
                    ]}
                  >
                    ({index.value})
                  </Text>
                </View>
              ) : (
                <View style={[styles.valueContainer, styles.valueContainerSmall]} />
              )}
            </View>
          );
        })}
        {/* Disclaimer: always shown */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>Prices may be delayed.{"\n"}If they appear stale, refresh the app.</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  contentContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  indexCard: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    paddingHorizontal: 10,
    flex: 1,
    paddingVertical: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
    minHeight: 52,

  },
  indexCardCondensed: {
    minHeight: 40,
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 16,
    flex: 0.75,
  },
  indexName: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Poppins-Medium",
    marginBottom: 2,
  },
  smallNameText: {
    fontSize: 9,
  },
  actualValue: {
    color: "#ffffff",
    fontSize: 10,
    fontFamily: "Poppins-Regular",
  },
  smallActualValueText: {
    fontSize: 8,
  },
  valueContainer: {
    minWidth: 80,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  valueContainerSmall: {
    minWidth: 60,
  },
  arrow: {
    fontSize: 10,
    marginRight: 4,
    marginBottom: 2,
    fontFamily: "Poppins-SemiBold",
  },
  smallArrowText: {
    fontSize: 8,
  },
  indexValue: {
    fontSize: 10,
    fontFamily: "Poppins-Regular",
  },
  smallIndexValueText: {
    fontSize: 8,
  },
  placeholderLine: {
    fontSize: 10,
    lineHeight: 12,
    color: 'transparent',
  },
  updateIndicator: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  updateText: {
    color: "#999999",
    fontSize: 10,
    fontFamily: "Poppins-Regular",
  },
  comparisonIndicator: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  comparisonText: {
    color: "#999999",
    fontSize: 9,
    fontFamily: "Poppins-Regular",
  },
  disclaimerBox: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    maxWidth: 240,
  },
  disclaimerText: {
    color: "#999999",
    fontSize: 9,
    fontFamily: "Poppins-Regular",
    textAlign: 'center',
  },
});

export default MarketIndices;
