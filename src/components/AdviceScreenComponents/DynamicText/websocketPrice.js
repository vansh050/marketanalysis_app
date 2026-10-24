// priceManager.js
import {useState, useEffect, useRef} from 'react';
import {fetchLTP} from '../../../utils/marketDataLTP';
import {
  subscribeLTP,
  onAnyLTP,
  getLastLTP,
  getAllLTPs,
} from '../../../utils/ltpPoller';

// Prices come from the shared REST poller (utils/ltpPoller.js). The socket.io
// feed this used on ccxt.alphaquark.in no longer exists, so every price here
// was empty — including the totals in the trade review modals.
const WebSocketManager = (() => {
  let instance = null;
  // symbol -> Map(callback | NO_CB -> [release functions])
  const handles = new Map();
  const NO_CB = '__no_callback__';

  const remember = (symbol, cb, release) => {
    if (!handles.has(symbol)) handles.set(symbol, new Map());
    const byCb = handles.get(symbol);
    const k = cb || NO_CB;
    if (!byCb.has(k)) byCb.set(k, []);
    byCb.get(k).push(release);
  };

  return {
    getInstance() {
      if (!instance) {
        instance = {
          connect() {},

          isInitialized() {
            return true;
          },

          getLastPrice(symbol) {
            return getLastLTP(symbol);
          },

          subscribeToUpdates(callback) {
            return onAnyLTP(callback);
          },

          async fetchInitialPrice(symbol) {
            try {
              const price = await fetchLTP(symbol, 'NSE');
              return price || null;
            } catch (error) {
              return null;
            }
          },

          subscribe(symbol, callback) {
            remember(symbol, callback, subscribeLTP(symbol, 'NSE', callback || null));
          },

          unsubscribe(symbol, callback) {
            const byCb = handles.get(symbol);
            if (!byCb) return;
            const keys = callback ? [callback] : [...byCb.keys()];
            keys.forEach(k => {
              const list = byCb.get(k) || [];
              if (callback) {
                const release = list.pop();
                if (release) release();
                if (list.length === 0) byCb.delete(k);
              } else {
                // No callback: drop every listener for the symbol (old behaviour).
                list.forEach(release => release());
                byCb.delete(k);
              }
            });
            if (byCb.size === 0) handles.delete(symbol);
          },

          subscribeToAPI() {},

          getAllPrices() {
            return getAllLTPs();
          },
        };
      }
      return instance;
    },
  };
})();

// Hook for UI components that need to display prices
export const useLTP = symbol => {
  const [price, setPrice] = useState(() => {
    return WebSocketManager.getInstance().getLastPrice(symbol) || null;
  });

  useEffect(() => {
    const wsManager = WebSocketManager.getInstance();
    let mounted = true;

    const handlePrice = newPrice => {
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
export const getLastKnownPrice = symbol => {
  return WebSocketManager.getInstance().getLastPrice(symbol) || null;
};

// Helper function for calculating total amount
export const calculateTotalAmount = stockDetails => {
  let totalAmount = 0;
  //console.log('ltfos',stockDetails);
  stockDetails.forEach(ele => {
    if (ele.transactionType === 'BUY') {
      const price = getLastKnownPrice(ele.tradingSymbol);
      //console.log('Got tproce:',price);
      if (price !== null && price !== '-') {
        totalAmount += parseFloat(price) * ele.quantity;
      }
    }
  });
  console.log('totak:', totalAmount);
  return totalAmount.toFixed(2);
};

// Custom hook for total amount with controlled updates
export const useTotalAmount = stockDetails => {
  const [totalAmount, setTotalAmount] = useState(() =>
    calculateTotalAmount(stockDetails),
  );
  const stockDetailsRef = useRef(stockDetails);

  useEffect(() => {
    stockDetailsRef.current = stockDetails;
    setTotalAmount(calculateTotalAmount(stockDetails));

    const wsManager = WebSocketManager.getInstance();
    const symbols = new Set(stockDetails.map(stock => stock.tradingSymbol));

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
