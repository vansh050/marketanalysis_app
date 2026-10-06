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

const normalizeModelName = value =>
  String(value ?? '').replace(/_/g, ' ').trim().toLowerCase();

/**
 * Pick the server-resolved model that belongs to the CURRENT recommendation.
 *
 * A model the operator/server resolved for an EARLIER rebalance shares the
 * model name with today's rebalance. Matching on the name alone let the card
 * acknowledge today's rebalance as "executed" without placing a single order
 * (markup uagaskar, 2026-10-06: September's operator-resolved rebalance
 * bfc6d856 resolved October's ca653c31). Identity wins whenever both sides
 * carry one; the name is only a fallback when an id is missing.
 */
export const findResolvedModelForRecommendation = (
  resolvedModels,
  {modelId, modelName} = {},
) => {
  const current = modelId != null && modelId !== '' ? String(modelId) : null;
  return (resolvedModels || []).find(item => {
    if (!item) return false;
    const completionId = item.completionRecommendationId;
    if (current && completionId != null && completionId !== '' &&
        String(completionId) !== current) {
      return false;
    }
    if (current && item.modelId != null && item.modelId !== '') {
      return String(item.modelId) === current;
    }
    return normalizeModelName(item.modelName) === normalizeModelName(modelName);
  }) || null;
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
