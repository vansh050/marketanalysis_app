import {normalizeOrderStatus} from './orderStatusUtils';

export const SELL_GATE_POLL_INTERVAL_MS = 3000;
export const SELL_GATE_TIMEOUT_MS = 180000;

export const normalizePublisherSymbol = value =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/-(EQ|BE|BZ|SM|ST|BL)$/i, '');

const positiveQuantity = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const orderQuantity = order => {
  const filled = positiveQuantity(
    order?.filledQuantity ??
      order?.filled_quantity ??
      order?.filledShares,
  );
  return filled || positiveQuantity(order?.quantity);
};

const expectedSellQuantities = expectedLegs => {
  const result = new Map();
  (expectedLegs || []).forEach(leg => {
    const side = String(
      leg?.transaction_type || leg?.transactionType || leg?.orderType || '',
    ).toUpperCase();
    if (side !== 'SELL') return;
    const symbol = normalizePublisherSymbol(
      leg?.tradingsymbol || leg?.tradingSymbol || leg?.symbol,
    );
    if (!symbol) return;
    result.set(symbol, (result.get(symbol) || 0) + positiveQuantity(leg?.quantity));
  });
  return result;
};

/**
 * Evaluate only the broker orders created after the current Kite basket's
 * baseline. A SELL batch is ready only when every expected symbol has its
 * full quantity broker-confirmed as COMPLETE/TRADED/FILLED.
 */
export const evaluateSellBatchOrders = (expectedLegs, newOrders) => {
  const expected = expectedSellQuantities(expectedLegs);
  if (expected.size === 0) {
    return {ready: true, state: 'complete', missing: [], pending: [], failed: []};
  }

  const completedBySymbol = new Map();
  const pendingSymbols = new Set();
  const failedSymbols = new Set();

  (newOrders || []).forEach(order => {
    const side = String(
      order?.transactionType ||
        order?.transaction_type ||
        order?.orderType ||
        '',
    ).toUpperCase();
    if (side !== 'SELL') return;
    const symbol = normalizePublisherSymbol(
      order?.symbol || order?.tradingSymbol || order?.tradingsymbol,
    );
    if (!expected.has(symbol)) return;

    const status = order?.normalizedStatus || normalizeOrderStatus(
      order?.status || order?.orderStatus || order?.order_status,
    );
    if (status === 'complete') {
      completedBySymbol.set(
        symbol,
        (completedBySymbol.get(symbol) || 0) + orderQuantity(order),
      );
    } else if (status === 'rejected' || status === 'cancelled') {
      failedSymbols.add(symbol);
    } else {
      pendingSymbols.add(symbol);
    }
  });

  const missing = [];
  const pending = [];
  const failed = [];
  expected.forEach((quantity, symbol) => {
    const completed = completedBySymbol.get(symbol) || 0;
    if (completed >= quantity) return;
    if (failedSymbols.has(symbol)) {
      failed.push(symbol);
      return;
    }
    if (pendingSymbols.has(symbol) || completed > 0) pending.push(symbol);
    else missing.push(symbol);
  });

  const ready = failed.length === 0 && missing.length === 0 && pending.length === 0;
  // Nothing is still in flight: every expected sell reached a terminal state
  // (complete / rejected / cancelled). This is what separates "some sells
  // failed and no more money is coming" — where the buys can safely proceed at
  // a trimmed size — from "a sell is still resting in the book", where the
  // money may land any second and trimming now would under-deploy the customer
  // permanently for a transient condition.
  const allTerminal = pending.length === 0 && missing.length === 0;
  return {
    ready,
    state: ready ? 'complete' : failed.length > 0 ? 'failed' : 'pending',
    allTerminal,
    missing,
    pending,
    failed,
  };
};

export const extractAvailableCash = funds => {
  const source = funds?.data && typeof funds.data === 'object'
    ? funds.data
    : funds;
  const value = Number(
    source?.availablecash ??
      source?.availableCash ??
      source?.available_cash ??
      source?.availableMargin ??
      source?.available_margin,
  );
  return Number.isFinite(value) && value >= 0 ? value : null;
};

// Continuing with a possibly settlement-funded BUY basket is an explicit,
// informed choice only when the broker session and both money figures were
// successfully read. Unknown funds/auth failures never masquerade as T1.
export const canOfferSettlementProceed = gateResult =>
  gateResult?.status === 'margin-timeout' &&
  Number.isFinite(gateResult?.availableCash) &&
  Number.isFinite(gateResult?.requiredBuyingPower) &&
  gateResult.requiredBuyingPower > gateResult.availableCash + 1;

const resultMessage = result =>
  [
    result?.message_aq,
    result?.orderStatusMessage,
    result?.statusMessage,
    result?.message,
    result?.reason,
  ]
    .filter(Boolean)
    .join(' ');

export const annotateSettlementRiskResults = (results, riskAccepted) => {
  if (!riskAccepted) return results || [];
  return (results || []).map(result => {
    const side = String(
      result?.transactionType || result?.transaction_type || result?.Type || '',
    ).toUpperCase();
    const status = String(
      result?.orderStatus || result?.status || result?.order_status || '',
    ).toLowerCase();
    const message = resultMessage(result);
    const insufficientFunds = /(insufficient|not enough|shortage).*(fund|margin)|(?:fund|margin).*(insufficient|shortage)/i
      .test(message);
    if (side !== 'BUY' || !/(reject|fail|cancel)/.test(status) || !insufficientFunds) {
      return result;
    }
    const recovery = ' Buying power may still be settling. Use Repair after the margin is released; if the shortfall remains, add funds or Calculate again.';
    return {
      ...result,
      settlementRiskAccepted: true,
      orderStatusMessage: `${result?.orderStatusMessage || message || 'Insufficient buying power.'}${recovery}`,
      message_aq: `${result?.message_aq || message || 'Insufficient buying power.'}${recovery}`,
    };
  });
};

export const estimateProtectedBuyCost = baskets =>
  (baskets || []).reduce(
    (total, basket) =>
      total +
      (basket || []).reduce((batchTotal, order) => {
        const side = String(
          order?.transaction_type || order?.transactionType || '',
        ).toUpperCase();
        if (side !== 'BUY') return batchTotal;
        return (
          batchTotal +
          positiveQuantity(order?.quantity) * positiveQuantity(order?.price)
        );
      }, 0),
    0,
  );
