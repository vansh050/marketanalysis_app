export const createExecutionRequestId = () =>
  `exec-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

export const executionQuantityUnit = (trade = {}) => {
  const explicit = trade.quantity_unit || trade.quantityUnit;
  if (explicit) return explicit;
  const exchange = String(trade.exchange || trade.Exchange || '').toUpperCase();
  // Python broker adapters accept NFO/BFO sizes in lots and own the one
  // lot→share expansion. Cash-equity quantities are already shares.
  return ['NFO', 'BFO'].includes(exchange) ? 'lots' : 'shares';
};

export const executionSegment = (trade = {}) => {
  const exchange = String(trade.exchange || trade.Exchange || '').toUpperCase();
  if (['NFO', 'BFO'].includes(exchange)) return 'FNO';
  if (['NSE', 'BSE'].includes(exchange)) return 'EQUITY';

  const explicit = String(trade.segment || trade.Segment || '').trim().toUpperCase();
  if (['OPTION', 'OPTIONS', 'FUTURE', 'FUTURES', 'FO', 'F&O'].includes(explicit)) {
    return 'FNO';
  }
  return explicit || 'EQUITY';
};

export const prepareExecutionPayload = payload => {
  const requestId = payload?.requestId || createExecutionRequestId();
  return {
    ...payload,
    requestId,
    trades: (payload?.trades || []).map((trade, index) => ({
      ...trade,
      clientTradeId: trade.clientTradeId || `${requestId}-leg-${index + 1}`,
      quantity_unit: executionQuantityUnit(trade),
      segment: executionSegment(trade),
    })),
  };
};

export const isReconciliationResponse = (status, data) =>
  status === 202 ||
  data?.reconciliationRequired === true ||
  ['placing', 'needs_reconciliation', 'waiting_for_broker'].includes(
    data?.executionState,
  );

export const isAmbiguousPlacementError = error => {
  const data = error?.response?.data;
  if (data?.retryAllowed === true) return false;
  const status = error?.response?.status;
  return (
    !status ||
    status === 202 ||
    status >= 500 ||
    data?.reconciliationRequired === true
  );
};

export const reconciliationMessage = data =>
  data?.message ||
  'Checking with broker—do not retry until the order status is confirmed.';
