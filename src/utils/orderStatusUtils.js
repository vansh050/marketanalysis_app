/**
 * Centralized order status normalization utility.
 * Replaces scattered case-sensitive status comparisons across the codebase.
 * Works with both `orderStatus` (from broker API) and `trade_place_status` (from DB).
 */

const SUCCESS_STATUSES = [
  'complete', 'completed', 'traded', 'filled', 'executed',
];

const PENDING_STATUSES = [
  'pending', 'trigger pending', 'trigger_pending',
  'requested', 'am', 'after market',
  'open', 'transit', 'placed', 'ordered',
];

const REJECTED_STATUSES = [
  'rejected', 'failed', 'failure', 'error', 'declined',
];

const CANCELLED_STATUSES = [
  'cancelled', 'canceled', 'cancelled by user', 'cancelled by system',
];

const PARTIAL_STATUSES = [
  'partially filled', 'partial', 'partially_filled',
];

/**
 * Normalize any broker/trade status string to a canonical value.
 * @param {string} status - Raw status from broker API or DB
 * @returns {'complete'|'pending'|'rejected'|'cancelled'|'partial'|'unknown'}
 */
export const normalizeOrderStatus = (status) => {
  if (!status || typeof status !== 'string') return 'unknown';
  const s = status.toLowerCase().trim();

  if (SUCCESS_STATUSES.includes(s)) return 'complete';
  if (PENDING_STATUSES.includes(s)) return 'pending';
  if (REJECTED_STATUSES.includes(s)) return 'rejected';
  if (CANCELLED_STATUSES.includes(s)) return 'cancelled';
  if (PARTIAL_STATUSES.includes(s)) return 'partial';

  return 'unknown';
};

/**
 * Check if order status indicates successful placement/execution.
 */
export const isOrderSuccess = (status) =>
  normalizeOrderStatus(status) === 'complete';

/**
 * Check if order status indicates rejection or failure.
 */
export const isOrderRejected = (status) => {
  const normalized = normalizeOrderStatus(status);
  return normalized === 'rejected';
};

/**
 * Check if order status indicates cancellation.
 */
export const isOrderCancelled = (status) =>
  normalizeOrderStatus(status) === 'cancelled';

/**
 * Check if order status indicates it is still pending.
 */
export const isOrderPending = (status) =>
  normalizeOrderStatus(status) === 'pending';

/**
 * Get display-friendly status label.
 * @returns {'Complete'|'Pending'|'Rejected'|'Cancelled'|'Partial'|string}
 */
export const getOrderStatusDisplay = (status) => {
  const normalized = normalizeOrderStatus(status);
  switch (normalized) {
    case 'complete': return 'Complete';
    case 'pending': return 'Pending';
    case 'rejected': return 'Rejected';
    case 'cancelled': return 'Cancelled';
    case 'partial': return 'Partial';
    default: return status || 'Unknown';
  }
};
