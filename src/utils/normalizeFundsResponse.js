const hasValue = value =>
  value !== undefined && value !== null && value !== '';

/**
 * Normalizes broker-specific cash fields into the envelope consumed by the app.
 *
 * Most screens read `funds.data.availablecash`, while some broker adapters
 * return `availableCash` or `raw.cash` at the top level.
 */
export const normalizeFundsResponse = funds => {
  if (!funds || typeof funds !== 'object' || Array.isArray(funds)) {
    return funds;
  }

  const hasDataObject =
    funds.data && typeof funds.data === 'object' && !Array.isArray(funds.data);
  const source = hasDataObject ? funds.data : funds;
  const candidates = [
    source.availablecash,
    source.availableCash,
    source.available_cash,
    source.availableBalance,
    source.available_balance,
    source.cashAvailable,
    source.cash_available,
    source.withdrawableBalance,
    source.withdrawable_balance,
    source.availableMargin,
    source.available_margin,
    source.equity?.available_margin,
    source.cash,
    source.raw?.availablecash,
    source.raw?.availableCash,
    source.raw?.available_cash,
    source.raw?.cash,
    funds.availablecash,
    funds.availableCash,
    funds.available_cash,
    funds.availableBalance,
    funds.available_balance,
    funds.cashAvailable,
    funds.cash_available,
    funds.withdrawableBalance,
    funds.withdrawable_balance,
    funds.availableMargin,
    funds.available_margin,
    funds.equity?.available_margin,
    funds.cash,
    funds.raw?.availablecash,
    funds.raw?.availableCash,
    funds.raw?.available_cash,
    funds.raw?.cash,
  ];
  const availableCash = candidates.find(hasValue);

  if (!hasValue(availableCash)) {
    return funds;
  }

  if (hasDataObject && source.availablecash === availableCash) {
    return funds;
  }

  return {
    ...funds,
    data: {
      ...source,
      availablecash: availableCash,
    },
  };
};
