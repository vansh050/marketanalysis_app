const STATUS_GROUPS = {
  recommendation: new Set(['', 'recommend', 'recommended']),
  pending: new Set([
    'placed', 'pending', 'open', 'transit', 'trigger pending',
    'trigger_pending', 'publisher_pending', 'requested', 'ordered', 'am',
    'amo', 'after market', 'after market order req received',
    'pending_confirmation', 'pending confirmation', 'validation pending',
    'manually_placed', 'manually placed', 'order_not_found',
    'order not found', 'not_found', 'timeout', 'unknown',
  ]),
  filled: new Set(['complete', 'completed', 'executed', 'filled', 'success', 'traded']),
  partial: new Set([
    'partial', 'partially_filled', 'partially filled',
    'partially executed', 'partially_executed',
  ]),
  rejected: new Set(['rejected', 'failure', 'failed', 'error', 'declined']),
  cancelled: new Set([
    'cancelled', 'canceled', 'cancelled by user', 'cancelled by system',
  ]),
};

export const normalizeBasketOrderStatus = value =>
  String(value || '').trim().toLowerCase();

export const classifyBasketOrderStatus = value => {
  const status = normalizeBasketOrderStatus(value);
  for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
    if (statuses.has(status)) return group;
  }
  return 'unknown_status';
};

export const isBasketInFlightStatus = value =>
  classifyBasketOrderStatus(value) === 'pending';

export const isBasketCustomerVisibleStatus = value => {
  const normalized = normalizeBasketOrderStatus(value);
  return normalized !== '' || classifyBasketOrderStatus(value) === 'recommendation';
};

export const getBasketOrderAggregateStatus = order => {
  const legs = Array.isArray(order?.basket_advice) ? order.basket_advice : [];
  if (legs.length === 0) return null;
  const groups = legs.map(leg =>
    classifyBasketOrderStatus(leg?.trade_place_status || leg?.orderStatus),
  );
  if (groups.every(group => group === 'recommendation')) return 'recommendation';
  if (groups.some(group => group === 'pending' || group === 'partial')) return 'pending';
  if (groups.some(group => group === 'filled')) {
    return groups.every(group => group === 'filled') ? 'completed' : 'pending';
  }
  if (groups.every(group => group === 'rejected' || group === 'cancelled')) {
    return 'rejected';
  }
  return 'unavailable';
};

export const shouldShowInOrderHistory = order => {
  const topStatus = normalizeBasketOrderStatus(order?.trade_place_status);
  const basketStatus = getBasketOrderAggregateStatus(order);
  if (topStatus === 'ignored' || basketStatus === 'recommendation') return false;
  // Basket parents intentionally stay `recommend` so rejected legs remain
  // retryable. Once any leg was attempted, aggregate leg status owns history.
  if (topStatus === 'recommend' && basketStatus === null) return false;
  return true;
};

export const basketOrderIdentity = (trade, basketId, currentBroker) => {
  const orderId = trade?.orderId || trade?.uniqueorderid || trade?.uniqueOrderId;
  const tradeId = trade?.tradeId;
  const resolvedBasketId = trade?.basketId || basketId;
  const broker = trade?.user_broker || trade?.userBroker || currentBroker;
  return {
    orderId,
    tradeId,
    basketId: resolvedBasketId,
    broker,
    canCancel: Boolean(orderId && tradeId && resolvedBasketId && broker),
  };
};

export default {
  basketOrderIdentity,
  classifyBasketOrderStatus,
  getBasketOrderAggregateStatus,
  shouldShowInOrderHistory,
  isBasketCustomerVisibleStatus,
  isBasketInFlightStatus,
  normalizeBasketOrderStatus,
};
