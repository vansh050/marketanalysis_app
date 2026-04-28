import { useState, useEffect, useCallback, useRef } from "react";
import io from "socket.io-client";
import axios from "axios";
import Config from "react-native-config";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 5000; // 5 seconds

const useWebSocketCurrentPrice = (symbols) => {
  const ccxtUrl = Config.REACT_APP_CCXT_SERVER_WEBSOCKET_URL;
  const webListingUrl = Config.REACT_APP_WEBSOCKET_LISTENING_URL;

  const [ltp, setLtp] = useState([]);
  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());
  const failedSubscriptionsRef = useRef({});

  useEffect(() => {
    socketRef.current = io(`${webListingUrl}`, {
      transports: ["websocket"],
      query: { EIO: "4" },
    });

    socketRef.current.on("market_data", (data) => {
      setLtp((prev) => {
        const index = prev.findIndex(
          (item) => item.tradingSymbol === data.stockSymbol
        );
        if (index !== -1) {
          const newLtp = [...prev];
          newLtp[index] = {
            ...newLtp[index],
            lastPrice: data.last_traded_price,
          };
          return newLtp;
        } else {
          return [
            ...prev,
            {
              tradingSymbol: data.stockSymbol,
              lastPrice: data.last_traded_price,
            },
          ];
        }
      });
    });

    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("ping");
      }
    }, 20000);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      clearInterval(pingInterval);
    };
  }, []);

  /** ✅ Batch Subscribe to Symbols (Minimizing API Calls) */
  const subscribeToSymbols = useCallback(async (symbolsToSubscribe) => {
    console.log('symbbbb[[[[[:"',symbolsToSubscribe);
    if (symbolsToSubscribe.length === 0) return;

    try {
      // ✅ API expects { "symbolExchange": [ {symbol, exchange}, ... ] }
      await axios.post(`${ccxtUrl}/websocket/subscribe-array`, {
        symbolExchange: symbolsToSubscribe, // Wrap inside "symbolExchange"
      });

      // Mark all subscribed symbols as successful
      symbolsToSubscribe.forEach((symbol) => {
        subscribedSymbolsRef.current.add(symbol.symbol);
        delete failedSubscriptionsRef.current[symbol.symbol];
      });
    } catch (error) {
      console.error(`Failed to subscribe to symbols:`, error);

      // Retry failed subscriptions
      symbolsToSubscribe.forEach((symbol) => {
        failedSubscriptionsRef.current[symbol.symbol] =
          (failedSubscriptionsRef.current[symbol.symbol] || 0) + 1;

        if (
          failedSubscriptionsRef.current[symbol.symbol] < MAX_RETRY_ATTEMPTS
        ) {
          setTimeout(() => subscribeToSymbols([symbol]), RETRY_DELAY);
        } else {
          console.warn(`Max retry attempts reached for ${symbol.symbol}`);
        }
      });
    }
  }, []);

  /** ✅ Identify New Symbols & Subscribe in Batches */
  const subscribeToNewSymbols = useCallback(() => {
    if (!symbols || symbols.length === 0) return;

    const newSymbols = symbols
      ?.map((item) => ({
        symbol: item.symbol || item.Symbol, // Extract symbol
        exchange: item.exchange || item.Exchange, // Extract exchange
      }))
      .filter(
        (symbol) =>
          !subscribedSymbolsRef.current.has(symbol.symbol) &&
          (!failedSubscriptionsRef.current[symbol.symbol] ||
            failedSubscriptionsRef.current[symbol.symbol] < MAX_RETRY_ATTEMPTS)
      );

    if (newSymbols.length > 0) {
      subscribeToSymbols(newSymbols); // Pass all new symbols in one API call
    }
  }, [symbols, subscribeToSymbols]);

  useEffect(() => {
    subscribeToNewSymbols();
  }, [symbols, subscribeToNewSymbols]);

  /** ✅ Get LTP for a Specific Symbol */
  const getLTPForSymbol = useCallback(
    (symbol) => {
      const ltpOne = ltp.find(
        (item) => item.tradingSymbol === symbol
      )?.lastPrice;
      return ltpOne ? ltpOne.toFixed(2) : "-";
    },
    [ltp]
  );

  return {
    ltp,
    getLTPForSymbol,
  };
};

export default useWebSocketCurrentPrice;
