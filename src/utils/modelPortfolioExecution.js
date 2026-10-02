const normalize = value => String(value || '').trim().toLowerCase();

// Completion is bound to the accepted recommendation, not broker-session age.
export const hasVerifiedExecutionCompletion = (action, recommendationId) => Boolean(
  action?.executionComplete === true && action?.completionPlanId &&
  recommendationId && String(action.completionRecommendationId) === String(recommendationId) &&
  action?.reconciliationPending !== true && action?.requiresFreshRebalance !== true &&
  action?.allocationReviewReady !== true && !action?.allocationGaps?.length &&
  !action?.failedTrades?.length && !action?.pendingOrders?.length &&
  action?.verificationStatus !== 'unknown'
);

export const selectBrokerExecution = (executions, userEmail, broker) => {
  const email = normalize(userEmail);
  const brokerName = normalize(broker || 'DummyBroker');
  return (executions || []).find(
    execution =>
      normalize(execution?.user_email) === email &&
      normalize(execution?.user_broker || 'DummyBroker') === brokerName,
  );
};
