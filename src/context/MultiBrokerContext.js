/**
 * MultiBrokerContext.js
 *
 * React Context for managing multi-broker portfolio data across the application.
 * Ported from prod-alphaquark-github web app for consistency.
 *
 * Provides:
 * - Connected broker list management
 * - Per-broker holdings and funds tracking
 * - Aggregated portfolio data across all brokers
 * - Broker status management (connected/expired/error/disconnected)
 * - Parallel holdings/funds fetching
 */

import React, {createContext, useContext, useState, useCallback, useRef} from 'react';

export const BROKER_STATUS = {
  CONNECTED: 'connected',
  EXPIRED: 'expired',
  ERROR: 'error',
  DISCONNECTED: 'disconnected',
};

const MultiBrokerContext = createContext(null);

export function MultiBrokerProvider({children}) {
  const [connectedBrokers, setConnectedBrokers] = useState([]);
  const [selectedBroker, setSelectedBroker] = useState('ALL');
  const [brokerHoldings, setBrokerHoldingsState] = useState({});
  const [aggregatedHoldings, setAggregatedHoldings] = useState([]);
  const [brokerFunds, setBrokerFundsState] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const lastFetchedRef = useRef(null);

  const setBrokerHoldings = useCallback((broker, holdings) => {
    setBrokerHoldingsState(prev => ({...prev, [broker]: holdings}));
  }, []);

  const setAllBrokerHoldings = useCallback(holdingsMap => {
    setBrokerHoldingsState(holdingsMap);
  }, []);

  const setBrokerFunds = useCallback((broker, funds) => {
    setBrokerFundsState(prev => ({...prev, [broker]: funds}));
  }, []);

  const setAllBrokerFunds = useCallback(fundsMap => {
    setBrokerFundsState(fundsMap);
  }, []);

  const setBrokerError = useCallback((broker, error) => {
    setErrors(prev => ({...prev, [broker]: error}));
  }, []);

  const clearBrokerError = useCallback(broker => {
    setErrors(prev => {
      const next = {...prev};
      delete next[broker];
      return next;
    });
  }, []);

  const getSelectedBrokerHoldings = useCallback(() => {
    if (!selectedBroker || selectedBroker === 'ALL') return aggregatedHoldings;
    return brokerHoldings[selectedBroker] || [];
  }, [selectedBroker, brokerHoldings, aggregatedHoldings]);

  const getTotalValue = useCallback(() => {
    let total = 0;
    Object.values(brokerHoldings).forEach(holdings => {
      if (Array.isArray(holdings)) {
        holdings.forEach(h => {
          const ltp = h.ltp || h.lastPrice || h.last_price || 0;
          const qty = h.quantity || h.qty || 0;
          total += ltp * qty;
        });
      }
    });
    return total;
  }, [brokerHoldings]);

  const getTotalPnL = useCallback(() => {
    let totalPnL = 0;
    Object.values(brokerHoldings).forEach(holdings => {
      if (Array.isArray(holdings)) {
        holdings.forEach(h => {
          const ltp = h.ltp || h.lastPrice || h.last_price || 0;
          const avgPrice = h.averagePrice || h.average_price || h.avgPrice || 0;
          const qty = h.quantity || h.qty || 0;
          totalPnL += (ltp - avgPrice) * qty;
        });
      }
    });
    return totalPnL;
  }, [brokerHoldings]);

  const hasBrokerError = useCallback(
    broker => {
      return !!errors[broker];
    },
    [errors],
  );

  const getBrokerStatus = useCallback(
    broker => {
      const brokerData = connectedBrokers.find(
        b => b.broker === broker || b.name === broker,
      );
      if (!brokerData) return BROKER_STATUS.DISCONNECTED;
      if (errors[broker]) return BROKER_STATUS.ERROR;
      if (brokerData.status === 'expired') return BROKER_STATUS.EXPIRED;
      if (brokerData.status === 'connected') return BROKER_STATUS.CONNECTED;
      return BROKER_STATUS.DISCONNECTED;
    },
    [connectedBrokers, errors],
  );

  const resetBrokerData = useCallback(broker => {
    setBrokerHoldingsState(prev => {
      const next = {...prev};
      delete next[broker];
      return next;
    });
    setBrokerFundsState(prev => {
      const next = {...prev};
      delete next[broker];
      return next;
    });
    setErrors(prev => {
      const next = {...prev};
      delete next[broker];
      return next;
    });
  }, []);

  const value = {
    // State
    connectedBrokers,
    selectedBroker,
    brokerHoldings,
    aggregatedHoldings,
    brokerFunds,
    isLoading,
    errors,
    lastFetchedRef,

    // Setters
    setConnectedBrokers,
    setSelectedBroker,
    setBrokerHoldings,
    setAllBrokerHoldings,
    setAggregatedHoldings,
    setBrokerFunds,
    setAllBrokerFunds,
    setIsLoading,
    setBrokerError,
    clearBrokerError,
    resetBrokerData,

    // Getters
    getSelectedBrokerHoldings,
    getTotalValue,
    getTotalPnL,
    hasBrokerError,
    getBrokerStatus,
  };

  return (
    <MultiBrokerContext.Provider value={value}>
      {children}
    </MultiBrokerContext.Provider>
  );
}

export function useMultiBroker() {
  const context = useContext(MultiBrokerContext);
  if (!context) {
    throw new Error('useMultiBroker must be used within a MultiBrokerProvider');
  }
  return context;
}

export default MultiBrokerContext;
