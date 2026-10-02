import {hasVerifiedExecutionCompletion} from '../../utils/modelPortfolioExecution';
import {normalizeRepairResponse} from '../../utils/rebalanceReconciliation';

const complete = {modelId:'r', executionComplete:true, completionPlanId:'p',
  completionRecommendationId:'r', failedTrades:[], pendingOrders:[],
  verificationStatus:'verified_live'};

test('polling retains exact completion even when the subscriber row is stale', () => {
  const response = normalizeRepairResponse({models:[complete], verificationStatus:'verified_live'});
  expect(response.models).toEqual([complete]);
  expect(hasVerifiedExecutionCompletion(response.models[0], 'r')).toBe(true);
  expect(hasVerifiedExecutionCompletion(response.models[0], 'new')).toBe(false);
});

test.each([
  {failedTrades:[{quantity:1}]}, {pendingOrders:[{}]}, {allocationGaps:[{}]},
  {requiresFreshRebalance:true}, {allocationReviewReady:true},
  {reconciliationPending:true}, {verificationStatus:'unknown'}, {completionPlanId:null},
])('never hide unfinished work: %j', change => {
  expect(hasVerifiedExecutionCompletion({...complete,...change}, 'r')).toBe(false);
});

test('an unavailable broker response cannot manufacture completion', () => {
  const response = normalizeRepairResponse({models:[complete], verificationStatus:'unknown'});
  expect(response.models).toEqual([]);
  expect(hasVerifiedExecutionCompletion(response.models[0], 'r')).toBe(false);
});
