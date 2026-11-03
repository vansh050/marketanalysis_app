/**
 * The client clock is only an early UX gate. Groww may reach the backend
 * outside NSE hours because the backend owns the broker-scoped, expiring
 * authorization. This helper does not authorize an order: when that server
 * window is missing or expired, placement still fails closed as MARKET_CLOSED.
 */
const TEMPORARY_AFTER_HOURS_BROKERS = new Set(['groww', 'kotak', 'fyers']);

const normalizeBroker = value => String(value || '').trim().toLowerCase();

/**
 * Mirror of ccxt `common/after_hours_policy.temporary_after_hours_allowed`.
 * The window comes from the advisor's `advisor_config.after_hours_order_brokers`
 * + `after_hours_orders_until`, surfaced by /api/app-advisor/get. It is open
 * only for a listed broker and only until the expiry; anything missing or
 * malformed keeps it closed. ccxt re-checks the same record on every order.
 */
export const isTemporaryAfterHoursWindowOpen = ({
  broker,
  afterHoursOrderBrokers,
  afterHoursOrdersUntil,
  now = Date.now(),
}) => {
  const name = normalizeBroker(broker);
  if (!name || !Array.isArray(afterHoursOrderBrokers)) return false;
  if (!afterHoursOrderBrokers.some(item => normalizeBroker(item) === name)) {
    return false;
  }
  const expiresAt = Date.parse(afterHoursOrdersUntil || '');
  return Number.isFinite(expiresAt) && now < expiresAt;
};

export const canAttemptRebalancePlacement = ({
  broker,
  marketOpen,
  allowAfterHoursOrders = false,
  afterHoursOrderBrokers,
  afterHoursOrdersUntil,
  now,
}) =>
  marketOpen ||
  allowAfterHoursOrders === true ||
  TEMPORARY_AFTER_HOURS_BROKERS.has(normalizeBroker(broker)) ||
  isTemporaryAfterHoursWindowOpen({
    broker,
    afterHoursOrderBrokers,
    afterHoursOrdersUntil,
    now,
  });
