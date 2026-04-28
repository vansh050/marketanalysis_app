// priceManager.js
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from "socket.io-client";
import server from '../../utils/serverConfig';

const WebSocketManager = (() => {
  let instance = null;
  let subscribers = new Map();
  let socket = null;
  let lastPrices = new Map();
  let initialized = false;
  let priceUpdateCallbacks = new Set(); // Add this for global price update notifications

  return {
    getInstance() {
      if (!instance) {
        instance = {
          connect() {
            if (socket) return;

            socket = io(server.ccxtWs.baseUrl, {
              transports: ["websocket"],
              query: { EIO: "4" },
            });

            socket.on("market_data", (data) => {
              lastPrices.set(data.stockSymbol, data.last_traded_price);
              const callbacks = subscribers.get(data.stockSymbol) || [];
              callbacks.forEach(callback => callback(data.last_traded_price));
              // Notify global price update listeners
              priceUpdateCallbacks.forEach(callback => callback(data.stockSymbol, data.last_traded_price));
            });

            initialized = true;
          },

          isInitialized() {
            return initialized;
          },

          getLastPrice(symbol) {
            return lastPrices.get(symbol);
          },

          // Add method to subscribe to all price updates
          subscribeToUpdates(callback) {
            priceUpdateCallbacks.add(callback);
            return () => priceUpdateCallbacks.delete(callback);
          },

          async fetchInitialPrice(symbol) {
            try {
              const response = await axios.get(`${server.ccxtWs.httpUrl}/api/price/${symbol}`);
              const price = response.data.last_traded_price;
              lastPrices.set(symbol, price);
              return price;
            } catch (error) {
              return null;
            }
          },

          subscribe(symbol, callback) {
            if (!subscribers.has(symbol)) {
              subscribers.set(symbol, []);
              this.subscribeToAPI(symbol);
            }
            if (callback) {
              subscribers.get(symbol).push(callback);
            }
          },

          unsubscribe(symbol, callback) {
            if (!callback) {
              subscribers.delete(symbol);
              return;
            }
            const callbacks = subscribers.get(symbol) || [];
            subscribers.set(symbol, callbacks.filter(cb => cb !== callback));
          },

          async subscribeToAPI(symbol) {
            try {
              await axios.post(`${server.ccxtWs.httpUrl}/websocket/subscribe`, {
                symbol,
                exchange: "NSE"
              });
            } catch (error) {
              // Subscription error - silent
            }
          },

          getAllPrices() {
            return Object.fromEntries(lastPrices);
          },
        };
      }
      return instance;
    }
  };
})();

// Initialize when module loads
const initializeWebSocket = () => {
  const wsManager = WebSocketManager.getInstance();
  if (!wsManager.isInitialized()) {
    wsManager.connect();
  }
};

initializeWebSocket();

// Hook for UI components that need to display prices
export const useLTP = (symbol) => {
  const [price, setPrice] = useState(() => {
    return WebSocketManager.getInstance().getLastPrice(symbol) || null;
  });

  useEffect(() => {
    const wsManager = WebSocketManager.getInstance();
    let mounted = true;

    const handlePrice = (newPrice) => {
      if (mounted) setPrice(newPrice);
    };

    const initializePrice = async () => {
      if (!price) {
        const initialPrice = await wsManager.fetchInitialPrice(symbol);
        if (mounted && initialPrice) {
          setPrice(initialPrice);
        }
      }
    };

    wsManager.subscribe(symbol, handlePrice);
    initializePrice();

    return () => {
      mounted = false;
      wsManager.unsubscribe(symbol, handlePrice);
    };
  }, [symbol, price]);

  return price;
};

// Synchronous price getter for calculations (no re-renders)
export const getLastKnownPrice = (symbol) => {
  return WebSocketManager.getInstance().getLastPrice(symbol) || null;
};

// Helper function for calculating total amount
export const calculateTotalAmount = (stockDetails) => {
  //console.log('IStosL:',stockDetails);
  let totalAmount = 0;
  //console.log('ltfos',stockDetails);
  stockDetails.forEach((ele) => {
    if (ele.orderType === "BUY") {
      const price = getLastKnownPrice(ele.symbol);
      //console.log('Got tproce:',price);
      if (price !== null && price !== "-") {
        totalAmount += parseFloat(price) * ele.qty;
      }
    }
  });
 // console.log('totak:',totalAmount);
  return totalAmount.toFixed(2);
};

// Custom hook for total amount with controlled updates
export const useTotalAmount = (stockDetails) => {
  const [totalAmount, setTotalAmount] = useState(() => calculateTotalAmount(stockDetails));
  const stockDetailsRef = useRef(stockDetails);

  useEffect(() => {
    stockDetailsRef.current = stockDetails;
    setTotalAmount(calculateTotalAmount(stockDetails));

    const wsManager = WebSocketManager.getInstance();
    const symbols = new Set(stockDetails.map(stock => stock.symbol));

    // Subscribe to relevant symbols
    symbols.forEach(symbol => {
      wsManager.subscribe(symbol);
    });

    // Use single callback for all price updates
    const unsubscribe = wsManager.subscribeToUpdates((symbol, newPrice) => {
      if (symbols.has(symbol)) {
        setTotalAmount(calculateTotalAmount(stockDetailsRef.current));
      }
    });

    return () => {
      unsubscribe();
      symbols.forEach(symbol => {
        wsManager.unsubscribe(symbol);
      });
    };
  }, [JSON.stringify(stockDetails)]); // Deep comparison of stockDetails
  //console.log('totalamout:',totalAmount);
  return totalAmount;
};