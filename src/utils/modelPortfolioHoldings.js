import {latestHeldExec} from './rebalanceHelpers';

const asExecutionList = value => {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
};

/**
 * Resolve the holdings snapshot used by subscribed Model Portfolio details.
 *
 * A dated CCXT snapshot is authoritative even when it contains zero holdings.
 * An absent/unusable CCXT snapshot may still fall back to the post-execution
 * Node mirror while broker reconciliation catches up.
 */
export const resolveModelPortfolioHoldings = (
  portfolioData,
  subscriptionData,
  currentBroker,
) => {
  const ccxtExecutions = asExecutionList(portfolioData?.user_net_pf_model);
  const subscriptionExecutions = asExecutionList(
    subscriptionData?.user_net_pf_model,
  );
  const ccxtLatest = latestHeldExec(ccxtExecutions);
  const subscriptionLatest = latestHeldExec(subscriptionExecutions);
  const ccxtHasSnapshot = Boolean(ccxtLatest);
  const subscriptionHasSnapshot = Boolean(subscriptionLatest);
  const ccxtHasHoldings = Boolean(ccxtLatest?.order_results?.length);
  const subscriptionHasHoldings = Boolean(
    subscriptionLatest?.order_results?.length,
  );
  const subscriptionBroker =
    subscriptionData?.user_broker ||
    subscriptionLatest?.user_broker ||
    '';
  const normalizedCurrentBroker = String(currentBroker || '').trim().toLowerCase();
  const normalizedSubscriptionBroker = String(subscriptionBroker)
    .trim()
    .toLowerCase();

  let executions = ccxtExecutions;
  let source = 'ccxt';

  if (!ccxtHasSnapshot && subscriptionHasSnapshot) {
    executions = subscriptionExecutions;
    source = 'subscription';
  } else if (!ccxtExecutions.length && subscriptionExecutions.length) {
    executions = subscriptionExecutions;
    source = 'subscription';
  }

  return {
    executions,
    source,
    ccxtHasSnapshot,
    subscriptionHasSnapshot,
    ccxtHasHoldings,
    subscriptionHasHoldings,
    isStaleBrokerData:
      !ccxtHasHoldings &&
      subscriptionHasHoldings &&
      Boolean(normalizedCurrentBroker) &&
      Boolean(normalizedSubscriptionBroker) &&
      normalizedCurrentBroker !== normalizedSubscriptionBroker,
  };
};
