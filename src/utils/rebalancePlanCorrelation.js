/**
 * Select every execution identity field from the same reviewed attempt.
 *
 * The identity follows the legs on screen. When the modal shows Repair rows
 * (`repairRowsShown`), the Repair row owns the request even if the parent
 * still holds a calculation: that calculation is the attempt the Repair rows
 * came from, and its plan was already sent. Otherwise a stale repair row may
 * coexist with a fresh calculation, and the displayed calculation wins.
 */
export const resolveRebalancePlanCorrelation = ({
  calculatedPortfolioData,
  matchingRepairTrade,
  activeModelName,
  advisorTag,
  rebalanceFreezePlan,
  repairFreezePlan,
  repairRowsShown = false,
}) => {
  const useRepairCorrelation = Boolean(
    matchingRepairTrade &&
      (repairRowsShown || !calculatedPortfolioData?.uniqueId),
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
