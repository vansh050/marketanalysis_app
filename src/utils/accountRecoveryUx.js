export const accountRecoveryMetadata = error => {
  const data = error?.response?.data || {};
  const recovery = data.accountRecovery || data.account_recovery || {};
  const running =
    data.reason === 'account_recovery_running' ||
    data.code === 'ACCOUNT_RECOVERY_RUNNING' ||
    recovery.reason === 'account_recovery_running' ||
    recovery.state === 'reconciling';
  const requestedDelay = Number(
    data.retry_after_seconds || recovery.retryAfterSeconds || 5,
  );
  const safeDelay = Number.isFinite(requestedDelay) ? requestedDelay : 5;
  return {
    running,
    operationId: data.operation_id || recovery.operation_id || null,
    retryAfterSeconds: Math.max(1, Math.min(30, safeDelay)),
  };
};

export const accountRecoveryTitle = recovery => {
  if (Number(recovery?.staleDays) > 0) return 'Verification needs support';
  const reason = String(recovery?.reason || '');
  const state = String(recovery?.state || '');
  if (reason === 'broker_auth_required') return 'Reconnect your broker';
  if (state === 'ownership_conflict' || reason === 'broker_attribution_ambiguous' ||
      reason === 'holding_attribution_conflict') {
    return 'Portfolio holdings need review';
  }
  if (state === 'orders_unresolved' || reason === 'execution_not_terminal' ||
      reason === 'execution_session_closed' || reason === 'broker_orders_working' ||
      reason === 'broker_order_status_unknown') {
    return 'Broker order status is pending';
  }
  if (state === 'reconciling' || reason === 'account_recovery_running') {
    return 'Broker account check in progress';
  }
  if (reason === 'broker_snapshot_unavailable') return 'Broker holdings check failed';
  if (reason === 'broker_order_book_unavailable') return 'Broker order book check failed';
  return 'Broker account needs attention';
};

// Blocker causes that no amount of holdings editing can clear: they are waiting
// on the broker, or on us, not on the customer's answer about who owns what.
const HOLDINGS_UNRESOLVABLE_CAUSES = new Set([
  'execution_not_terminal',
  // 2026-09-21: a DAY-contract case past its session (ccxt f3aa82ce); a
  // holdings edit cannot settle it any more than a live working order.
  'execution_session_closed',
  'broker_orders_working',
  'broker_order_status_unknown',
  'broker_order_book_unavailable',
  'broker_reconciliation_pending',
  'broker_snapshot_unavailable',
  'broker_activity_verification_required',
  'recovery_check_failed',
  'recovery_verification_required',
]);

/**
 * Whether `review_holdings` is a route to somewhere.
 *
 * The holdings screen's only action is Continue, and Continue calls calculate.
 * When the account is ALSO blocked by something a holdings edit cannot change,
 * that is a closed loop -- calculate refuses, the same banner returns, and the
 * customer presses Continue again. 2026-09-18: three trips round it before the
 * customer gave up, while the real blocker (a live Zerodha DAY limit and a leg
 * Kite never accepted) was never named on screen.
 *
 * A blocker that has been stuck for days is not resolvable here either; the
 * message for those already says to contact support, so let it be shown.
 */
export const holdingsReviewCanResolve = recovery => {
  if (recovery?.nextAction?.code !== 'review_holdings') return false;
  if (Number(recovery?.staleDays) > 0) return false;
  return !(recovery?.causes || []).some(cause =>
    HOLDINGS_UNRESOLVABLE_CAUSES.has(String(cause)),
  );
};
