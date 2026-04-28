import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import axios from "axios";
import WebSocketManager from "../../components/AdviceScreenComponents/DynamicText/WebSocketManager";
import { useTrade } from "../../screens/TradeContext";
import server from "../../utils/serverConfig";
import Config from "react-native-config";
import { generateToken } from "../../utils/SecurityTokenManager";

// Indices configuration with correct symbols and exchanges
// NOTE: Primary symbols MUST match what the WebSocket actually sends
const indicesConfig = {
  nifty50: {
    symbol: "NIFTY",
    exchange: "NSE",
    displayName: "Nifty 50",
    alternativeSymbols: ["NIFTY 50", "Nifty 50", "NIFTY_50"],
  },
  sensex: {
    symbol: "SENSEX",
    exchange: "BSE",
    displayName: "Sensex",
    alternativeSymbols: ["Sensex", "BSE SENSEX", "SENSEX 30"],
  },
  bankNifty: {
    symbol: "BANKNIFTY",
    exchange: "NSE",
    displayName: "BankNifty",
    alternativeSymbols: ["NIFTY BANK", "NIFTYBANK", "Nifty Bank", "BANK NIFTY"],
  },
  finNifty: {
    symbol: "NIFTY FIN SERVICE",
    exchange: "NSE",
    displayName: "FinNifty",
    alternativeSymbols: ["FINNIFTY", "NIFTY FINANCIAL SERVICES", "Nifty Fin Service", "NIFTY_FIN_SERVICE"],
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

    const fetchPreviousClosePrices = async () => {
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
            setBasePrices(previousClosePrices);
            setComparisonType("prevClose");
            setHasInitializedBasePrices(true);
          } else {
            throw new Error("No valid previous close data in response");
          }
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        // Fallback: Will use first price received as opening price
        setComparisonType("opening");
        // Don't set hasInitializedBasePrices yet - will be set when first prices arrive
      }
    };

    fetchPreviousClosePrices();
  }, [configData]);

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

            // Track all subscribed symbols for this key
            if (!subscribedSymbolsRef.current[key]) {
              subscribedSymbolsRef.current[key] = new Set();
            }
            subscribedSymbolsRef.current[key].add(sym);

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

                let basePrice;
                const currentComparisonType = comparisonTypeRef.current;
                const currentBasePrices = basePricesRef.current;

                if (currentComparisonType === "prevClose" && currentBasePrices[key]) {
                  basePrice = currentBasePrices[key];
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
