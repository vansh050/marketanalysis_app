/**
 * Select every execution identity field from the same reviewed attempt.
 *
 * A stale repair row may remain available while the customer reviews a fresh
 * calculation. The repair identity is valid only when no fresh calculation
 * identity is present; otherwise the displayed calculation owns the request.
 */
export const resolveRebalancePlanCorrelation = ({
  calculatedPortfolioData,
  matchingRepairTrade,
  activeModelName,
  advisorTag,
  rebalanceFreezePlan,
  repairFreezePlan,
}) => {
  const useRepairCorrelation = Boolean(
    matchingRepairTrade && !calculatedPortfolioData?.uniqueId,
  );

  if (useRepairCorrelation) {
    return {
      modelName: matchingRepairTrade.modelName,
      advisor: advisorTag,
      unique_id: matchingRepairTrade.uniqueId,
      ...(repairFreezePlan === true && matchingRepairTrade.planId
        ? {
            plan_id: matchingRepairTrade.planId,
            plan_version: matchingRepairTrade.planVersion,
          }
        : {}),
    };
  }

  return {
    modelName: activeModelName,
    advisor: advisorTag,
    unique_id: calculatedPortfolioData?.uniqueId,
    ...(rebalanceFreezePlan === true && calculatedPortfolioData?.plan_id
      ? {
          plan_id: calculatedPortfolioData.plan_id,
          plan_version: calculatedPortfolioData.plan_version,
        }
      : {}),
  };
};
