import { useMemo, useCallback } from 'react';
import useLTPStore from './useLtpStore';
import { shallow } from 'zustand/shallow';

// This hook contains all the complex logic.
export const useBasketProfit = (basket) => {
  // Memoize the list of symbols from the basket prop.
  const symbolList = useMemo(() => {
    return basket?.trades?.map((t) => t.Symbol) || [];
  }, [basket?.trades]);

  // Create a stable selector function that won't change on every render.
  const ltpSelector = useCallback(
    (state) => {
      const selected = {};
      symbolList.forEach((symbol) => {
        if (state.ltps[symbol]) {
          selected[symbol] = state.ltps[symbol];
        }
      });
      return selected;
    },
    [symbolList] // It only updates if the symbols in the basket change.
  );

  // Subscribe to the store using the stable selector.
  const relevantLtps = useLTPStore(ltpSelector, shallow);

  // Perform the final calculation and return a simple, stable data object.
  const profitData = useMemo(() => {
    let totalProfit = 0;
    let totalInvestment = 0;

    basket?.trades?.forEach((trade) => {
      const ltpData = relevantLtps[trade.Symbol];
      const ltpPrice = typeof ltpData === 'object' ? ltpData?.last_traded_price : ltpData;
      const currentLTP = parseFloat(String(ltpPrice)?.replace(/[₹,]/g, '') || '0');
      const entryPrice = parseFloat(trade.price_when_send_advice || '0');

      if (!entryPrice || isNaN(currentLTP) || currentLTP === 0) return;

      const quantity = Number(trade.Quantity || 1);
      const lots = Number(trade.Lots || 1);
      const isBuy = trade.Type === 'BUY';
      const diff = currentLTP - entryPrice;
      const effectiveDiff = isBuy ? diff : -diff;

      totalProfit += effectiveDiff * quantity * lots;
      totalInvestment += entryPrice * quantity * lots;
    });

    const profitPercent = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

    return { totalProfit, profitPercent };
  }, [basket?.trades, relevantLtps]);

  return profitData;
};