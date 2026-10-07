import fs from 'fs';
import path from 'path';
import { resolveRebalancePlanCorrelation } from '../../utils/rebalancePlanCorrelation';

describe('mobile rebalance plan correlation', () => {
  const freshCalculation = {
    uniqueId: '29b26247',
    plan_id: 'rbp_fresh',
    plan_version: 3,
  };
  const staleRepair = {
    modelName: 'MQ - LargeMid Momentum',
    uniqueId: '488f48c9',
    planId: 'rbp_repair',
    planVersion: 1,
  };

  test('fresh calculation wins when an older repair row still exists', () => {
    expect(resolveRebalancePlanCorrelation({
      calculatedPortfolioData: freshCalculation,
      matchingRepairTrade: staleRepair,
      activeModelName: 'MQ - LargeMid Momentum',
      advisorTag: 'markup',
      rebalanceFreezePlan: true,
      repairFreezePlan: true,
    })).toEqual({
      modelName: 'MQ - LargeMid Momentum',
      advisor: 'markup',
      unique_id: '29b26247',
      plan_id: 'rbp_fresh',
      plan_version: 3,
    });
  });

  test('repair-built review keeps the repair plan and unique id together', () => {
    expect(resolveRebalancePlanCorrelation({
      calculatedPortfolioData: {},
      matchingRepairTrade: staleRepair,
      activeModelName: 'MQ - LargeMid Momentum',
      advisorTag: 'markup',
      rebalanceFreezePlan: true,
      repairFreezePlan: true,
    })).toEqual({
      modelName: 'MQ - LargeMid Momentum',
      advisor: 'markup',
      unique_id: '488f48c9',
      plan_id: 'rbp_repair',
      plan_version: 1,
    });
  });

  test('shown repair rows own the request even when an old calculation is still held', () => {
    // moneyman ICICI, 7 Oct 2026: the 12:50 calculation (plan already sent and
    // rejected by the broker) stayed in the parent. Repair rows were shown, but
    // Place Order re-sent the consumed plan and was refused 409 twice.
    const consumedCalculation = {
      uniqueId: 'b1f3',
      plan_id: 'rbp_consumed',
      plan_version: 1,
    };
    expect(resolveRebalancePlanCorrelation({
      calculatedPortfolioData: consumedCalculation,
      matchingRepairTrade: staleRepair,
      repairRowsShown: true,
      activeModelName: 'MQ - LargeMid Momentum',
      advisorTag: 'markup',
      rebalanceFreezePlan: true,
      repairFreezePlan: true,
    })).toEqual({
      modelName: 'MQ - LargeMid Momentum',
      advisor: 'markup',
      unique_id: '488f48c9',
      plan_id: 'rbp_repair',
      plan_version: 1,
    });
  });

  test('the modal tells the resolver when repair rows are on screen', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../components/AdviceScreenComponents/RebalanceModal.js'),
      'utf8',
    );
    expect(source).toContain('repairRowsShown: isRepairMode');
    expect(source).toMatch(/calculationMatchesPortfolio && !repairStatus/);
  });

  test('all rendered execution paths consume the shared correlation result', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../components/AdviceScreenComponents/RebalanceModal.js'),
      'utf8',
    );
    expect(source).toContain('resolveRebalancePlanCorrelation({');
    expect(source).toContain('plan_id: additionalPayload.plan_id || undefined');
    expect(source).toContain('...additionalPayload');
    expect(source).toContain('executionCorrelation={additionalPayload}');
    expect(source).not.toContain('matchingRepairTrade?.planId ||');
  });
});
