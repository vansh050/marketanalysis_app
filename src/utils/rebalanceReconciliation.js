/**
 * Mobile response guards for the model-portfolio post-sell and Repair flow.
 * See docs/MODEL_PORTFOLIO_ARCHITECTURE.md (broker reconciliation window).
 */
export const normalizeRepairResponse = data => {
  const accountRecovery = data?.accountRecovery || null;
  const models = Array.isArray(data?.models) ? data.models : [];
  const pending =
    data?.reconciliationPending === true ||
    models.some(model => model?.reconciliationPending === true);
  const retryAfterSeconds = pending
    ? Math.max(1, Number(data?.retryAfterSeconds) || 60)
    : 0;
  const unknown =
    accountRecovery?.blocked === true ||
    data?.repairVerificationPending === true ||
    data?.verificationStatus === 'unknown' ||
    data?.verificationSource === 'archive_only';
  return {
    ...(accountRecovery ? {accountRecovery} : {}),
    pending,
    unknown,
    retryAfterSeconds: unknown
      ? Math.max(1, Number(data?.retryAfterSeconds) || 15)
      : retryAfterSeconds,
    // Retain model-scoped OPEN-order evidence while broker reconciliation is
    // still running. It must remain a status/repair flow, never a fresh
    // allocation calculation.
    models: unknown
      ? []
      : models.filter(
          model =>
            model?.reconciliationPending === true ||
            (Array.isArray(model?.failedTrades) && model.failedTrades.length > 0) ||
            model?.requiresFreshRebalance === true ||
            model?.allocationReviewReady === true ||
            model?.executionComplete === true,
        ),
    resolvedModels: unknown
      ? []
      : models.filter(
          model =>
            model?.reconciliationResolved === true ||
            model?.repairStatus === 'complete',
        ),
  };
};

export const normalizeRepairError = error => {
  const data = error?.response?.data;
  if (
    data?.accountRecovery?.blocked === true ||
    error?.response?.status === 503 ||
    data?.repairVerificationPending === true ||
    data?.verificationStatus === 'unknown'
  ) {
    return {
      ...(data?.accountRecovery ? {accountRecovery: data.accountRecovery} : {}),
      pending: false,
      unknown: true,
      retryAfterSeconds: Math.max(1, Number(data?.retryAfterSeconds) || 15),
      models: [],
    };
  }
  return null;
};

const CASH_USABLE_REFIT_OUTCOMES = new Set([
  'applied',
  'not_needed',
  'attempt_with_shortfall',
]);

export const isPostSellCashUsable = data =>
  CASH_USABLE_REFIT_OUTCOMES.has(data?.outcome) &&
  Array.isArray(data?.submit) &&
  data?.cashUsable !== false &&
  (data?.cashReadOk !== false || data?.cashFallbackUsed === true);
