import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import WebSocketManager from "./WebSocketManager";

// Create a context to hold all stock prices
const StockPriceContext = createContext({});

// Provider component for central WebSocket management
export const StockPriceProvider = ({ children }) => {
  const [prices, setPrices] = useState({});
  const wsManagerRef = useRef(WebSocketManager.getInstance());

  // Handle WebSocket updates in one central place
  const handlePriceUpdate = useCallback((symbol, data) => {
    if (data?.last_traded_price !== undefined) {
      setPrices(prevPrices => ({
        ...prevPrices,
        [symbol]: data.last_traded_price
      }));
    }
  }, []);

  // Add/remove socket subscriptions
  const subscribeToSymbol = useCallback((symbol, exchange) => {
    const wsInstance = wsManagerRef.current;
    
    // Create a handler specific to this symbol
    const updateHandler = (data) => handlePriceUpdate(symbol, data);
    
    // Subscribe and get initial LTP
    wsInstance.subscribe(symbol, exchange, updateHandler);
    wsInstance.getLTP(symbol).then(price => {
      if (price !== undefined) {
        setPrices(prevPrices => ({
          ...prevPrices,
          [symbol]: price
        }));
      }
    }).catch(() => {});
    
    // Return unsubscribe function
    return () => wsInstance.unsubscribe?.(symbol, updateHandler);
  }, [handlePriceUpdate]);

  return (
    <StockPriceContext.Provider value={{ prices, subscribeToSymbol }}>
      {children}
    </StockPriceContext.Provider>
  );
};

// Hook to use the price context
export const useStockPrice = (symbol, exchange) => {
  const { prices, subscribeToSymbol } = useContext(StockPriceContext);
  
  useEffect(() => {
    if (symbol && exchange) {
      const unsubscribe = subscribeToSymbol(symbol, exchange);
      return unsubscribe;
    }
  }, [symbol, exchange, subscribeToSymbol]);
  
  return prices[symbol] || null;
};
