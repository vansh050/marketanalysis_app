const asFiniteNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const firstFiniteNumber = (...values) => {
  for (const value of values) {
    const number = asFiniteNumber(value);
    if (number !== null) return number;
  }
  return null;
};

const asPositiveNumber = value => {
  const number = asFiniteNumber(value);
  return number !== null && number > 0 ? number : null;
};

const firstPositiveNumber = (...values) => {
  for (const value of values) {
    const number = asPositiveNumber(value);
    if (number !== null) return number;
  }
  return null;
};

export const getPositionRows = payload => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.position)) return payload.position;
  if (Array.isArray(payload?.positions)) return payload.positions;
  if (Array.isArray(payload?.data?.position)) return payload.data.position;
  if (Array.isArray(payload?.data?.positions)) return payload.data.positions;
  return [];
};

const normalizePosition = position => {
  let buyQuantity = firstFiniteNumber(
    position?.buyQuantity,
    position?.buyQty,
    position?.buy_quantity,
    position?.dayBuyQuantity,
    position?.day_buy_qty,
  );
  let sellQuantity = firstFiniteNumber(
    position?.sellQuantity,
    position?.sellQty,
    position?.sell_quantity,
    position?.daySellQuantity,
    position?.day_sell_qty,
  );
  const explicitNetQuantity = firstFiniteNumber(
    position?.netQuantity,
    position?.netQty,
    position?.net_quantity,
    position?.quantity,
    position?.qty,
  );
  const netQuantity =
    explicitNetQuantity ??
    (buyQuantity !== null && sellQuantity !== null
      ? buyQuantity - sellQuantity
      : null);

  if (buyQuantity === null && netQuantity !== null) {
    buyQuantity = Math.max(netQuantity, 0);
  }
  if (sellQuantity === null && netQuantity !== null) {
    sellQuantity = Math.max(-netQuantity, 0);
  }

  const averagePrice = firstFiniteNumber(
    position?.averagePrice,
    position?.avgPrice,
    position?.average_price,
  );
  const buyAvgPrice = firstFiniteNumber(
    position?.buyAvgPrice,
    position?.buyAveragePrice,
    position?.buyPrice,
    position?.buy_avg_price,
    netQuantity !== null && netQuantity >= 0 ? averagePrice : null,
  );
  const sellAvgPrice = firstFiniteNumber(
    position?.sellAvgPrice,
    position?.sellAveragePrice,
    position?.sellPrice,
    position?.sell_avg_price,
    netQuantity !== null && netQuantity < 0 ? averagePrice : null,
  );
  const declaredMultiplier = firstPositiveNumber(
    position?.multiplier,
    position?.contractMultiplier,
    position?.lotSize,
  );

  let buyAmount = firstFiniteNumber(
    position?.buyAmount,
    position?.buyValue,
    position?.buy_amount,
  );
  let sellAmount = firstFiniteNumber(
    position?.sellAmount,
    position?.sellValue,
    position?.sell_amount,
  );

  if (buyAmount === null && buyQuantity !== null && buyAvgPrice !== null) {
    buyAmount = buyQuantity * buyAvgPrice * (declaredMultiplier ?? 1);
  }
  if (sellAmount === null && sellQuantity !== null && sellAvgPrice !== null) {
    sellAmount = sellQuantity * sellAvgPrice * (declaredMultiplier ?? 1);
  }

  const inferredBuyMultiplier =
    buyAmount !== null &&
    buyAmount > 0 &&
    buyQuantity !== null &&
    buyQuantity > 0 &&
    buyAvgPrice !== null &&
    buyAvgPrice > 0
      ? asPositiveNumber(buyAmount / (buyQuantity * buyAvgPrice))
      : null;
  const inferredSellMultiplier =
    sellAmount !== null &&
    sellAmount > 0 &&
    sellQuantity !== null &&
    sellQuantity > 0 &&
    sellAvgPrice !== null &&
    sellAvgPrice > 0
      ? asPositiveNumber(sellAmount / (sellQuantity * sellAvgPrice))
      : null;

  const directPnl = firstFiniteNumber(
    position?.pnl,
    position?.profitAndLoss,
    position?.profit_loss,
    position?.netPnl,
    position?.net_pnl,
    position?.m2m,
    position?.mtm,
  );
  const realizedPnl = firstFiniteNumber(
    position?.realizedPnl,
    position?.realisedPnl,
    position?.realized_pnl,
  );
  const unrealizedPnl = firstFiniteNumber(
    position?.unrealizedPnl,
    position?.unrealisedPnl,
    position?.unrealized_pnl,
  );

  return {
    buyQuantity,
    sellQuantity,
    netQuantity,
    buyAvgPrice,
    sellAvgPrice,
    buyAmount,
    sellAmount,
    unitMultiplier:
      inferredBuyMultiplier ??
      inferredSellMultiplier ??
      declaredMultiplier ??
      1,
    directPnl:
      directPnl ??
      (realizedPnl !== null || unrealizedPnl !== null
        ? (realizedPnl ?? 0) + (unrealizedPnl ?? 0)
        : null),
    brokerLtp: firstPositiveNumber(
      position?.ltp,
      position?.lastPrice,
      position?.last_price,
      position?.lastTradedPrice,
      position?.currentPrice,
      position?.close,
    ),
  };
};

const hasPositionActivity = position =>
  Math.abs(position.buyQuantity ?? 0) > 0 ||
  Math.abs(position.sellQuantity ?? 0) > 0 ||
  Math.abs(position.netQuantity ?? 0) > 0 ||
  position.directPnl !== null;

/**
 * Calculates mark-to-market P&L from the common broker position contract.
 *
 * The identity `sell proceeds - buy cost + net quantity × current price`
 * handles long, short, partially closed, and fully closed positions without
 * broker-specific branching.
 */
export const calculatePositionPnl = (position, liveLtp) => {
  const normalized = normalizePosition(position);
  if (!hasPositionActivity(normalized)) return null;

  const {
    buyQuantity,
    sellQuantity,
    netQuantity,
    buyAvgPrice,
    sellAvgPrice,
    unitMultiplier,
    directPnl,
  } = normalized;
  const buyAmount = normalized.buyAmount ?? 0;
  const sellAmount = normalized.sellAmount ?? 0;
  const isClosed =
    netQuantity !== null
      ? Math.abs(netQuantity) < 1e-9
      : buyQuantity !== null &&
        sellQuantity !== null &&
        Math.abs(buyQuantity - sellQuantity) < 1e-9;
  const currentPrice = firstPositiveNumber(liveLtp, normalized.brokerLtp);

  let pnl = null;
  if (isClosed) {
    pnl = sellAmount - buyAmount;
  } else if (netQuantity !== null && currentPrice !== null) {
    pnl =
      sellAmount -
      buyAmount +
      netQuantity * currentPrice * unitMultiplier;
  } else if (directPnl !== null) {
    pnl = directPnl;
  }

  if (pnl === null || !Number.isFinite(pnl)) return null;

  const entryPrice = netQuantity !== null && netQuantity < 0
    ? sellAvgPrice
    : buyAvgPrice;
  let capitalBasis =
    netQuantity !== null && netQuantity < 0 ? sellAmount : buyAmount;
  if (!(capitalBasis > 0) && entryPrice !== null && netQuantity !== null) {
    capitalBasis =
      Math.abs(netQuantity) * entryPrice * unitMultiplier;
  }
  if (!(capitalBasis > 0)) {
    capitalBasis = Math.max(Math.abs(buyAmount), Math.abs(sellAmount), 0);
  }

  return {
    pnl,
    pnlPercentage: capitalBasis > 0 ? (pnl / capitalBasis) * 100 : 0,
    capitalBasis,
    currentValue: capitalBasis + pnl,
    currentPrice,
    netQuantity,
    buyQuantity,
    sellQuantity,
    entryPrice,
    isClosed,
  };
};

/**
 * Returns null until every active open position has either a live price or a
 * broker-provided P&L. This prevents a temporary missing quote from appearing
 * as a genuine zero in the portfolio hero card.
 */
export const calculateCompletePositionsSummary = (
  payload,
  getLTPForSymbol,
) => {
  const rows = getPositionRows(payload);
  const calculations = [];

  for (const row of rows) {
    const normalized = normalizePosition(row);
    if (!hasPositionActivity(normalized)) continue;
    const symbol =
      row?.symbol || row?.tradingSymbol || row?.tradingsymbol || row?.name;
    const liveLtp =
      symbol && typeof getLTPForSymbol === 'function'
        ? getLTPForSymbol(symbol)
        : null;
    const calculation = calculatePositionPnl(row, liveLtp);
    if (!calculation) return null;
    calculations.push(calculation);
  }

  if (calculations.length === 0) return null;

  const totals = calculations.reduce(
    (acc, calculation) => {
      acc.totalInvested += calculation.capitalBasis;
      acc.totalReturns += calculation.pnl;
      return acc;
    },
    {totalInvested: 0, totalReturns: 0},
  );

  return {
    totalInvested: totals.totalInvested,
    totalCurrent: totals.totalInvested + totals.totalReturns,
    totalReturns: totals.totalReturns,
    returnsPercentage:
      totals.totalInvested > 0
        ? (totals.totalReturns / totals.totalInvested) * 100
        : 0,
    positionCount: calculations.length,
  };
};

export default {
  getPositionRows,
  calculatePositionPnl,
  calculateCompletePositionsSummary,
};
