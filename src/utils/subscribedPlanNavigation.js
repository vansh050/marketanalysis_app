const normalizePlanType = type =>
  String(type ?? '')
    .trim()
    .toLowerCase();

export const isBespokePlan = plan =>
  normalizePlanType(plan?.type) === 'bespoke';

export const getSubscribedPlanDestination = plan => {
  if (isBespokePlan(plan)) {
    return {
      screen: 'BespokePerformanceScreen',
      params: {
        modelName: plan?.name,
        specificPlan: plan,
      },
    };
  }

  return {
    screen: 'AfterSubscriptionScreen',
    params: {
      fileName: plan?.name,
    },
  };
};
