/**
 * useMultiBrokerHoldings.js
 * Hook for fetching, normalizing, and aggregating holdings across multiple brokers.
 * Ported from prod-alphaquark-github for feature parity.
 */
import {useState, useCallback, useRef, useEffect} from 'react';
import {fetchBrokerAllHoldings} from '../FunctionCall/fetchBrokerAllHoldings';
import {fetchFunds} from '../FunctionCall/fetchFunds';

/**
 * Normalize a holding from any broker into a standard format.
 */
function normalizeHolding(holding, broker) {
  const symbol =
    holding.symbol ||
    holding.tradingSymbol ||
    holding.tradingsymbol ||
    holding.symbolName ||
    '';
  const quantity = Number(holding.quantity || holding.qty || 0);
  const avgPrice = Number(
    holding.averagePrice ||
      holding.avgPrice ||
      holding.average_price ||
      holding.buyAvg ||
      0,
  );
  const ltp = Number(
    holding.ltp || holding.lastPrice || holding.last_price || 0,
  );
  const exchange = holding.exchange || 'NSE';
  const invested = avgPrice * quantity;
  const currentValue = ltp * quantity;
  const pnl = currentValue - invested;
  const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

  return {
    symbol,
    quantity,
    avgPrice,
    ltp,
    exchange,
    invested,
    currentValue,
    pnl,
    pnlPercent,
    broker,
    isin: holding.isin || '',
    product: holding.product || holding.productType || 'CNC',
    raw: holding,
  };
}

/**
 * Aggregate same symbols across multiple brokers.
 */
function aggregateHoldings(holdingsMap) {
  const symbolMap = {};

  Object.entries(holdingsMap).forEach(([broker, holdings]) => {
    if (!Array.isArray(holdings)) return;
    holdings.forEach(h => {
      const normalized = normalizeHolding(h, broker);
      if (normalized.quantity <= 0) return;
      const key = `${normalized.symbol}|${normalized.exchange}`;

      if (!symbolMap[key]) {
        symbolMap[key] = {
          symbol: normalized.symbol,
          exchange: normalized.exchange,
          totalQuantity: 0,
          totalInvested: 0,
          totalCurrentValue: 0,
          brokers: [],
          breakdown: [],
        };
      }

      symbolMap[key].totalQuantity += normalized.quantity;
      symbolMap[key].totalInvested += normalized.invested;
      symbolMap[key].totalCurrentValue += normalized.currentValue;
      symbolMap[key].brokers.push(broker);
      symbolMap[key].breakdown.push(normalized);
    });
  });

  return Object.values(symbolMap).map(entry => ({
    ...entry,
    weightedAvgPrice:
      entry.totalQuantity > 0
        ? entry.totalInvested / entry.totalQuantity
        : 0,
    totalPnl: entry.totalCurrentValue - entry.totalInvested,
    pnlPercent:
      entry.totalInvested > 0
        ? ((entry.totalCurrentValue - entry.totalInvested) /
            entry.totalInvested) *
          100
        : 0,
  }));
}

/**
 * Hook for multi-broker holdings management.
 */
export default function useMultiBrokerHoldings(
  connectedBrokers = [],
  getLTPForSymbol = null,
  userEmail = null,
) {
  const [brokerHoldings, setBrokerHoldings] = useState({});
  const [aggregatedHoldings, setAggregatedHoldings] = useState([]);
  const [brokerFunds, setBrokerFunds] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [lastFetched, setLastFetched] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchAllBrokerData = useCallback(async () => {
    if (connectedBrokers.length === 0) return;
    setIsLoading(true);
    setErrors({});

    const holdingsMap = {};
    const fundsMap = {};
    const errorsMap = {};

    // Fetch all brokers in parallel
    await Promise.all(
      connectedBrokers.map(async brokerInfo => {
        const brokerName =
          brokerInfo.broker || brokerInfo.name || brokerInfo;
        try {
          const holdings = await fetchBrokerAllHoldings(
            brokerName,
            brokerInfo.clientCode,
            brokerInfo.apiKey,
            brokerInfo.jwtToken,
            brokerInfo.secretKey,
          );
          if (holdings) {
            holdingsMap[brokerName] = holdings;
          }
        } catch (err) {
          errorsMap[brokerName] = err.message;
        }

        try {
          const funds = await fetchFunds(
            brokerName,
            brokerInfo.clientCode,
            brokerInfo.apiKey,
            brokerInfo.jwtToken,
            brokerInfo.secretKey,
            brokerInfo.sid,
            brokerInfo.serverId,
            userEmail,
          );
          if (funds) {
            fundsMap[brokerName] = funds;
          }
        } catch (err) {
          // Funds error non-fatal
        }
      }),
    );

    if (!isMountedRef.current) return;

    setBrokerHoldings(holdingsMap);
    setBrokerFunds(fundsMap);
    setErrors(errorsMap);
    setAggregatedHoldings(aggregateHoldings(holdingsMap));
    setLastFetched(new Date());
    setIsLoading(false);
  }, [connectedBrokers]);

  const refreshBrokerHoldings = useCallback(
    async brokerName => {
      const brokerInfo = connectedBrokers.find(
        b => (b.broker || b.name || b) === brokerName,
      );
      if (!brokerInfo) return;

      try {
        const holdings = await fetchBrokerAllHoldings(
          brokerName,
          brokerInfo.clientCode,
          brokerInfo.apiKey,
          brokerInfo.jwtToken,
          brokerInfo.secretKey,
        );

        if (isMountedRef.current && holdings) {
          setBrokerHoldings(prev => {
            const updated = {...prev, [brokerName]: holdings};
            setAggregatedHoldings(aggregateHoldings(updated));
            return updated;
          });
        }
      } catch (err) {
        if (isMountedRef.current) {
          setErrors(prev => ({...prev, [brokerName]: err.message}));
        }
      }
    },
    [connectedBrokers],
  );

  // Auto-fetch on connectedBrokers change
  useEffect(() => {
    if (connectedBrokers.length > 0) {
      fetchAllBrokerData();
    }
  }, [connectedBrokers.length]);

  // Computed helpers
  const getHoldingsCount = broker =>
    (brokerHoldings[broker] || []).length;
  const getTotalValue = broker =>
    (brokerHoldings[broker] || []).reduce((sum, h) => {
      const ltp = Number(h.ltp || h.lastPrice || h.last_price || 0);
      const qty = Number(h.quantity || h.qty || 0);
      return sum + ltp * qty;
    }, 0);
  const getTotalPnL = broker =>
    (brokerHoldings[broker] || []).reduce((sum, h) => {
      const ltp = Number(h.ltp || h.lastPrice || h.last_price || 0);
      const avg = Number(h.averagePrice || h.avgPrice || h.average_price || 0);
      const qty = Number(h.quantity || h.qty || 0);
      return sum + (ltp - avg) * qty;
    }, 0);

  return {
    brokerHoldings,
    aggregatedHoldings,
    brokerFunds,
    isLoading,
    errors,
    lastFetched,
    fetchAllBrokerData,
    refreshBrokerHoldings,
    getHoldingsCount,
    getTotalValue,
    getTotalPnL,
  };
}
