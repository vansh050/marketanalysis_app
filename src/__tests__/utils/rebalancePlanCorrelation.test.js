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
