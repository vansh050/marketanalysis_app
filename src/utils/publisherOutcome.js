/**
 * Convert the shared Kite polling result into the status sent to the
 * publisher record-back endpoint.
 *
 * A polling timeout only means that no new broker order was observed. It is
 * never proof of success. The backend may still perform one final order-book
 * verification, but it must receive "timeout" (or "cancelled") so an empty
 * order book becomes order_not_found instead of PENDING.
 */
export function resolvePublisherSettlement(settlement) {
  const reason = settlement?.reason;
  const newOrders = Array.isArray(settlement?.newOrders)
    ? settlement.newOrders
    : [];

  if (reason === 'orders-detected' && newOrders.length > 0) {
    return 'success';
  }
  if (reason === 'timeout') {
    return 'timeout';
  }
  if (reason === 'cancelled' || reason === 'closed') {
    return 'cancelled';
  }
  return 'unknown';
}

/**
 * Persist only navigation fields needed to diagnose the hosted Kite flow.
 * Session IDs, request tokens, and API keys in Kite URLs are credentials and
 * must never be copied into frontend anomaly telemetry.
 */
export function sanitizeKiteDiagnosticUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return '';
  try {
    const parsed = new URL(url);
    const safeParams = new URLSearchParams();
    ['status', 'type'].forEach(key => {
      const value = parsed.searchParams.get(key);
      if (value) safeParams.set(key, value);
    });
    const query = safeParams.toString();
    return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ''}`;
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

/**
 * Parse only Kite's explicit `status` query parameter. Substring matching
 * (`url.includes("success")`) can fire on unrelated paths or parameters.
 */
export function parseKiteRedirectStatus(url) {
  if (typeof url !== 'string' || url.length === 0) return null;

  const match = url.match(/[?&]status=([^&#]+)/i);
  if (!match) return null;

  let status;
  try {
    status = decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    status = String(match[1]).trim().toLowerCase();
  }

  if (status === 'success' || status === 'completed') return 'success';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  return null;
}

export const ZERODHA_PUBLISHER_ORDER_KEY = 'stockDetailsZerodhaOrder';
export const ZERODHA_PUBLISHER_ATTEMPT_KEY = 'zerodhaPublisherAttempt';
export const ZERODHA_PUBLISHER_RETRY_GUARD_MS = 3 * 60 * 1000;

const asNonEmptyArray = value =>
  Array.isArray(value) && value.length > 0 ? value : null;

/**
 * AsyncStorage is recovery state, not the only source of the submitted
 * basket. A failed/missed write must fall back to the exact trades passed by
 * the parent instead of posting `stockDetails: null` to record-orders.
 */
export function selectPublisherStockDetails(persisted, fallback) {
  return asNonEmptyArray(persisted) || asNonEmptyArray(fallback) || [];
}

/**
 * Kite accepts a `tag` (maximum 20 characters), not our internal
 * `zerodhaTradeId` property. The backend uses the same precedence when it
 * matches the order book, so the outgoing tag and record-back lookup agree.
 */
export function getKitePublisherTag(stock) {
  const zerodhaTradeId =
    stock?.zerodhaTradeId && stock.zerodhaTradeId !== 'NA'
      ? stock.zerodhaTradeId
      : null;
  const rawTag = zerodhaTradeId || stock?.tradeId;
  const normalized = rawTag == null ? '' : String(rawTag).trim();
  return normalized ? normalized.slice(0, 20) : undefined;
}

export function createZerodhaPublisherAttempt({
  stockDetails,
  userEmail,
  flow = 'single',
  now = Date.now(),
  attemptId,
}) {
  const id =
    attemptId ||
    `mobile-${now}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    attemptId: id,
    broker: 'Zerodha',
    flow,
    status: 'popup_opened',
    publisherStatus: 'unknown',
    userEmail: userEmail || '',
    createdAt: now,
    updatedAt: now,
    stockDetails: selectPublisherStockDetails(stockDetails, []),
  };
}

export function parseZerodhaPublisherAttempt(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return null;
    const stockDetails = selectPublisherStockDetails(parsed.stockDetails, []);
    if (stockDetails.length === 0) return null;
    return {...parsed, stockDetails};
  } catch {
    return null;
  }
}

export function isZerodhaPublisherRetryGuarded(
  attempt,
  now = Date.now(),
  guardMs = ZERODHA_PUBLISHER_RETRY_GUARD_MS,
) {
  const parsed = parseZerodhaPublisherAttempt(attempt);
  if (!parsed) return false;
  if (['cancelled', 'recorded', 'resolved'].includes(parsed.status)) {
    return false;
  }

  const createdAt = Number(parsed.createdAt);
  if (!Number.isFinite(createdAt)) return true;
  const age = now - createdAt;
  return age >= 0 && age < guardMs;
}

/**
 * Classify the record-back response without inventing broker truth.
 * `not_found` means the broker order book did not contain the order;
 * `pending` means the backend explicitly kept it non-terminal; `recorded`
 * means every row carries a broker-derived terminal/order status.
 */
export function classifyPublisherRecordResults(results) {
  const rows = asNonEmptyArray(results);
  if (!rows) return 'empty';

  const statuses = rows.map(row =>
    String(row?.orderStatus || '').trim().toLowerCase(),
  );
  const notFoundStatuses = new Set([
    'order_not_found',
    'order not found',
    'not_found',
  ]);
  if (statuses.every(status => notFoundStatuses.has(status))) {
    return 'not_found';
  }

  const pendingStatuses = new Set([
    '',
    'pending',
    'unknown',
    'unconfirmed',
    'requested',
  ]);
  if (
    statuses.some(
      status =>
        pendingStatuses.has(status) || notFoundStatuses.has(status),
    )
  ) {
    return 'pending';
  }

  return 'recorded';
}

export function sanitizePublisherRecordResults(results, message) {
  const rows = asNonEmptyArray(results);
  if (!rows) return [];

  const safeMessage =
    message ||
    'Order confirmation is pending. Please check your Kite order book and do not place the same order again.';
  const notFoundStatuses = new Set([
    'order_not_found',
    'order not found',
    'not_found',
  ]);

  return rows.map(row => {
    const status = String(row?.orderStatus || '').trim().toLowerCase();
    if (!notFoundStatuses.has(status)) return row;
    return {
      ...row,
      orderStatus: 'pending',
      orderPlacement: 'pending',
      orderStatusMessage: safeMessage,
      message_aq: safeMessage,
    };
  });
}

export function buildUnconfirmedPublisherResults(stockDetails, message) {
  const safeMessage =
    message ||
    'Order confirmation is pending. Please check your Kite order book and do not place the same order again.';

  return selectPublisherStockDetails(stockDetails, []).map(stock => ({
    symbol: stock.tradingSymbol || stock.symbol,
    tradingSymbol: stock.tradingSymbol || stock.symbol,
    transactionType: stock.transactionType || 'BUY',
    quantity: stock.quantity,
    orderType: stock.orderType || 'MARKET',
    exchange: stock.exchange || 'NSE',
    variant: stock.variant,
    orderStatus: 'pending',
    orderPlacement: 'pending',
    orderStatusMessage: safeMessage,
    message_aq: safeMessage,
  }));
}
