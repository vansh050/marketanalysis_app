export const getRebalanceContract = calculation => {
  const contract = calculation?.rebalanceContract;
  if (!contract || contract.schemaVersion !== 1) {
    return null;
  }
  if (!contract.plan || !contract.funding || !contract.customerAction) {
    return null;
  }
  return contract;
};

export const getCanonicalRebalanceTrades = calculation => {
  const contract = getRebalanceContract(calculation);
  if (!contract) {
    return {buy: calculation?.buy || [], sell: calculation?.sell || []};
  }
  const toTrade = leg => ({
    ...leg,
    symbol: leg.tradingSymbol || leg.symbol,
    quantity: Number(leg.quantity) || 0,
  });
  return {
    buy: contract.plan.legs
      .filter(leg => String(leg.transactionType).toUpperCase() === 'BUY')
      .map(toTrade),
    sell: contract.plan.legs
      .filter(leg => String(leg.transactionType).toUpperCase() === 'SELL')
      .map(toTrade),
  };
};

export const canExecuteRebalance = calculation => {
  const contract = getRebalanceContract(calculation);
  if (contract) {
    return contract.customerAction?.code === 'EXECUTE';
  }
  // 🔴 FAIL CLOSED (2026-08-12, web parity). A calculate response that cannot
  // state its verdict used to mean "go ahead", so a backend rollback, a
  // half-deployed fleet or a schemaVersion bump would silently restore this
  // client's own funding interpretation — the behaviour behind the 2026-08-11/12
  // incidents. Only real calculate responses are gated: repair baskets and
  // legacy payloads are not calculate responses and keep their own guards
  // (blanket fail-closed would disable Repair, the recovery path itself).
  if (!isCalculationResponse(calculation)) return true;
  return false;
};

const isCalculationResponse = calculation => {
  if (!calculation || typeof calculation !== 'object') return false;
  return (
    Array.isArray(calculation.buy) ||
    Array.isArray(calculation.sell) ||
    typeof calculation.status === 'boolean'
  );
};

export const getRebalanceBlockReason = calculation => {
  const contract = getRebalanceContract(calculation);
  if (contract) {
    return contract.customerAction?.code === 'EXECUTE'
      ? null
      : contract.customerAction?.label || null;
  }
  if (!isCalculationResponse(calculation)) return null;
  return "We couldn't verify this basket. Please calculate again.";
};
