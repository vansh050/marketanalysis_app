/**
 * Centralized order status normalization utility.
 * Replaces scattered case-sensitive status comparisons across the codebase.
 * Works with both `orderStatus` (from broker API) and `trade_place_status` (from DB).
 */

import vocabulary from '../../contracts/order-status-vocabulary.json';

const SUCCESS_STATUSES = vocabulary.aliases.complete;

const PENDING_STATUSES = [...vocabulary.aliases.pending, 'not_submitted'];

// Verified absence is terminal but is displayed as NOT SENT, not broker rejection.
const REJECTED_STATUSES = [...vocabulary.aliases.rejected, 'not_observed'];

const CANCELLED_STATUSES = vocabulary.aliases.cancelled;

const PARTIAL_STATUSES = vocabulary.aliases.partial;

// `needs_reconciliation` is the stale-order sweeper's verdict on a leg it could
// not find in the broker order book. It is not pending (nothing is known to be
// working) and not rejected (nothing was refused) — it is "not yet confirmed".
const NEEDS_RECONCILIATION_STATUSES = vocabulary.aliases.needs_reconciliation || [];

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
  if (NEEDS_RECONCILIATION_STATUSES.includes(s)) return 'needs_reconciliation';

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
  return normalized === 'rejected' || normalized === 'cancelled';
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
 * Manual placement is user-confirmed, but is intentionally kept separate
 * from broker-confirmed execution and generic pending statuses.
 */
export const isOrderManuallyPlaced = (status) => {
  if (!status || typeof status !== 'string') return false;
  const normalized = status.toLowerCase().trim();
  return normalized === 'manually_placed' || normalized === 'manually placed';
};

/**
 * Build mutually-exclusive counts for order result UIs.
 *
 * `successCount` includes broker executions and user-confirmed manual
 * placements for backwards-compatible success rendering. `executedCount`
 * remains broker-confirmed only. Most importantly, PENDING/OPEN/PLACED are
 * never included in either count.
 */
export const summarizeOrderStatuses = (orders) => {
  const rows = Array.isArray(orders) ? orders : [];
  const summary = {
    totalCount: rows.length,
    executedCount: 0,
    manualPlacedCount: 0,
    successCount: 0,
    pendingCount: 0,
    failureCount: 0,
    unknownCount: 0,
  };

  rows.forEach((row) => {
    const status = row?.orderStatus;
    if (isOrderSuccess(status)) {
      summary.executedCount += 1;
      summary.successCount += 1;
    } else if (isOrderManuallyPlaced(status)) {
      summary.manualPlacedCount += 1;
      summary.successCount += 1;
    } else if (isOrderPending(status)) {
      summary.pendingCount += 1;
    } else if (isOrderRejected(status)) {
      summary.failureCount += 1;
    } else {
      summary.unknownCount += 1;
    }
  });

  return summary;
};

/**
 * A cancelled leg stamped by the auto-cancel zero-fill closure is a
 * MANAGER-CLOSED trade, not a customer-visible cancellation: the advisor sent
 * the exit and the system cancelled the never-executed legs with nothing to
 * close (ccxt `Basket.zero_fill_closure_symbols`). Takes the full order/leg
 * object because the marker lives on message_aq / cancel_rationale, not the
 * status string. Mirrors the web PlaceOrders + BasketCard labels.
 */
export const isManagerClosedZeroFill = (order) => {
  if (!order || typeof order !== 'object') return false;
  const status = String(order?.trade_place_status || '').toLowerCase().trim();
  if (status !== 'cancelled' && status !== 'canceled') return false;
  return (
    String(order?.message_aq || '').toLowerCase().includes('auto_cancel_zero_fill_closure') ||
    String(order?.cancel_rationale || '').toLowerCase().includes('auto-cancelled')
  );
};

/**
 * Get display-friendly status label.
 * @returns {'Complete'|'Pending'|'Rejected'|'Cancelled'|'Partial'|'Awaiting broker confirmation'|'Not sent'|string}
 */
export const getOrderStatusDisplay = (status) => {
  const normalized = normalizeOrderStatus(status);
  if (normalized === 'unknown') {
    // An empty status is not an unclassifiable broker status — it is a row that
    // nothing has stamped, so it must not read as "Unknown"
    // (prod/arulthakur, 2026-09-17: five such rows on the Orders screen).
    return status ? status : vocabulary.labels.not_sent;
  }
  return vocabulary.labels[normalized] || vocabulary.labels.unknown;
};
