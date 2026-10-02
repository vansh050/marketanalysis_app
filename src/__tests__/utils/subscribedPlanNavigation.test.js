import {
  getSubscribedPlanDestination,
  isBespokePlan,
} from '../../utils/subscribedPlanNavigation';

describe('subscribed plan navigation', () => {
  it('opens a bespoke subscription in the bespoke detail screen', () => {
    const plan = {
      _id: 'bespoke-plan-id',
      name: 'Swing Select - Collection',
      type: 'bespoke',
    };

    const destination = getSubscribedPlanDestination(plan);

    expect(destination).toEqual({
      screen: 'BespokePerformanceScreen',
      params: {
        modelName: 'Swing Select - Collection',
        specificPlan: plan,
      },
    });
    expect(destination.params.specificPlan).toBe(plan);
  });

  it('normalizes bespoke type casing and whitespace', () => {
    expect(isBespokePlan({type: ' Bespoke '})).toBe(true);
  });

  it('keeps model portfolios on the subscribed portfolio dashboard', () => {
    const plan = {
      _id: 'model-portfolio-id',
      name: 'Alpha Momentum',
      type: 'model portfolio',
    };

    expect(getSubscribedPlanDestination(plan)).toEqual({
      screen: 'AfterSubscriptionScreen',
      params: {
        fileName: 'Alpha Momentum',
      },
    });
  });
});
