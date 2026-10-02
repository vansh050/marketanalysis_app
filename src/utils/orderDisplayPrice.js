const isUsablePrice = value => {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
};

/**
 * Completed SELL rows may receive the broker fill in tradedPrice before the
 * legacy exitPrice projection is populated. Never fall back to the submitted
 * recommendation/limit price for trade history.
 */
export const resolveTradeExitPrice = trade => {
  if (!trade) {
    return '-';
  }
  const resolved = [trade.exitPrice, trade.tradedPrice].find(isUsablePrice);
  return resolved === undefined ? '-' : String(resolved);
};
