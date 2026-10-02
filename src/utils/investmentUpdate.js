export const normalizeInvestmentBroker = value =>
  typeof value === 'string' ? value.trim() : '';

export const resolveInvestmentModelId = (latestRebalance, strategyDetails) =>
  latestRebalance?.model_Id ||
  latestRebalance?.model_id ||
  strategyDetails?.model_id ||
  strategyDetails?.model?._id ||
  strategyDetails?._id ||
  undefined;

export const resolveGainAwareBase = ({
  enabled,
  reconciledValue,
  nominalAmount,
  valuationReliable,
}) => {
  const reconciled = Number(reconciledValue);
  const nominal = Number(nominalAmount);
  return enabled === true &&
    valuationReliable === true &&
    Number.isFinite(reconciled) &&
    reconciled > 0 &&
    Number.isFinite(nominal) &&
    nominal > 0
    ? Math.round(reconciled)
    : Math.round(Number.isFinite(nominal) ? nominal : 0);
};

export const computeInvestmentTotal = ({ mode, enteredAmount, baseAmount }) => {
  const entered = Number.parseInt(enteredAmount || '0', 10) || 0;
  if (mode !== 'topup') return entered;
  return Math.round((Number(baseAmount) || 0) + entered);
};
