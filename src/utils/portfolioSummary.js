const asFiniteNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const asPositiveNumber = value => {
  const number = asFiniteNumber(value);
  return number !== null && number > 0 ? number : null;
};

export const getBrokerHoldingRows = payload => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.holding)) return payload.holding;
  if (Array.isArray(payload?.data?.holding)) return payload.data.holding;
  return [];
};

export const buildPriceInstruments = (...collections) => {
  const seen = new Set();
  const instruments = [];

  collections.forEach(collection => {
    getBrokerHoldingRows(collection).forEach(holding => {
      const symbol = String(
        holding?.symbol ||
          holding?.tradingSymbol ||
          holding?.tradingsymbol ||
          '',
      ).trim();
      if (!symbol) return;
      const exchange = String(holding?.exchange || 'NSE').trim() || 'NSE';
      const key = `${exchange.toUpperCase()}:${symbol.toUpperCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      instruments.push({symbol, exchange});
    });
  });

  return instruments;
};

/**
 * Calculate a summary only when every eligible holding has a usable price.
 *
 * Mixing invested value for all rows with current value for only the priced
 * rows creates a large false loss while WebSocket quotes are still arriving.
 * Returning null keeps the broker's aggregate response visible until a
 * complete live calculation is possible.
 */
export const calculateCompleteHoldingsSummary = (payload, getLTPForSymbol) => {
  const holdings = getBrokerHoldingRows(payload)
    .map(holding => {
      const quantity = asFiniteNumber(
        holding?.quantity ?? holding?.qty ?? holding?.netQuantity,
      );
      const avgPrice = asFiniteNumber(
        holding?.avgPrice ??
          holding?.averagePrice ??
          holding?.average_price ??
          holding?.buyAvgPrice,
      );
      const symbol =
        holding?.symbol || holding?.tradingSymbol || holding?.tradingsymbol;
      return {holding, quantity, avgPrice, symbol};
    })
    .filter(
      row =>
        row.symbol &&
        row.quantity !== null &&
        row.quantity > 0 &&
        row.avgPrice !== null &&
        row.avgPrice >= 0,
    );

  if (holdings.length === 0) return null;

  let totalInvested = 0;
  let totalCurrent = 0;

  for (const row of holdings) {
    const liveLtp =
      typeof getLTPForSymbol === 'function'
        ? asPositiveNumber(getLTPForSymbol(row.symbol))
        : null;
    const brokerLtp = asPositiveNumber(
      row.holding?.ltp ??
        row.holding?.lastPrice ??
        row.holding?.last_price ??
        row.holding?.close,
    );
    const ltp = liveLtp ?? brokerLtp;

    if (ltp === null) return null;
    totalInvested += row.quantity * row.avgPrice;
    totalCurrent += row.quantity * ltp;
  }

  if (totalInvested <= 0) return null;
  const totalReturns = totalCurrent - totalInvested;
  return {
    totalInvested,
    totalCurrent,
    totalReturns,
    returnsPercentage: (totalReturns / totalInvested) * 100,
  };
};

export default {
  getBrokerHoldingRows,
  buildPriceInstruments,
  calculateCompleteHoldingsSummary,
};
