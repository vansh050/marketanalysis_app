/**
 * The client clock is only an early UX gate. Groww may reach the backend
 * outside NSE hours because the backend owns the broker-scoped, expiring
 * authorization. This helper does not authorize an order: when that server
 * window is missing or expired, placement still fails closed as MARKET_CLOSED.
 */
const TEMPORARY_AFTER_HOURS_BROKERS = new Set(['groww', 'kotak', 'fyers']);

export const canAttemptRebalancePlacement = ({
  broker,
  marketOpen,
  allowAfterHoursOrders = false,
}) =>
  marketOpen ||
  allowAfterHoursOrders === true ||
  TEMPORARY_AFTER_HOURS_BROKERS.has(
    String(broker || '').trim().toLowerCase(),
  );
