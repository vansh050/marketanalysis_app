import {
  isPostSellCashUsable,
  normalizeRepairError,
  normalizeRepairResponse,
} from '../../utils/rebalanceReconciliation';

describe('rebalance reconciliation response guards', () => {
  test('retains model-scoped pending evidence and preserves the retry delay', () => {
    const pendingModel = {
      modelName: 'MFCC',
      reconciliationPending: true,
      pendingOrders: [{orderId: '260903170784457', orderStatus: 'OPEN'}],
      failedTrades: [],
    };
    expect(normalizeRepairResponse({
      reconciliationPending: true,
      retryAfterSeconds: 37,
      models: [pendingModel],
    })).toEqual({
      pending: true,
      unknown: false,
      retryAfterSeconds: 37,
      models: [pendingModel],
      resolvedModels: [],
    });
  });

  test('withholds archive-only legs when live verification is unknown', () => {
    expect(normalizeRepairResponse({
      verificationStatus: 'unknown',
      verificationSource: 'archive_only',
      repairVerificationPending: true,
      models: [{failedTrades: [{advSymbol: 'ABC'}]}],
    })).toEqual({
      pending: false,
      unknown: true,
      retryAfterSeconds: 15,
      models: [],
      resolvedModels: [],
    });
  });

  test('normalizes an HTTP 503 into a retryable unknown state', () => {
    expect(normalizeRepairError({
      response: {
        status: 503,
        data: {verificationStatus: 'unknown', models: []},
      },
    })).toEqual({
      pending: false,
      unknown: true,
      retryAfterSeconds: 15,
      models: [],
    });
  });

  test('exposes only genuine Repair models after reconciliation', () => {
    const result = normalizeRepairResponse({models: [
      {modelName: 'complete', failedTrades: [], repairStatus: 'complete'},
      {modelName: 'repair', failedTrades: [{advSymbol: 'ABC'}]},
    ]});
    expect(result.models.map(model => model.modelName)).toEqual(['repair']);
    expect(result.resolvedModels.map(model => model.modelName)).toEqual(['complete']);
  });

  test('keeps target-allocation reviews without frozen failed legs', () => {
    const result = normalizeRepairResponse({models: [{
      modelId: 'm1',
      failedTrades: [],
      requiresFreshRebalance: true,
    }]});
    expect(result.models).toHaveLength(1);
    expect(result.models[0].requiresFreshRebalance).toBe(true);
  });

  test('accepts confirmed-fill fallback as verified buying power', () => {
    expect(isPostSellCashUsable({
      outcome: 'applied', submit: [], cashReadOk: false, cashUsable: true,
      cashFallbackUsed: true,
    })).toBe(true);
    expect(isPostSellCashUsable({
      outcome: 'abstain', cashReadOk: false, cashFallbackUsed: false,
    })).toBe(false);
    expect(isPostSellCashUsable({})).toBe(false);
  });

  test.each(['applied', 'not_needed', 'attempt_with_shortfall'])(
    'accepts a verified %s refit response',
    outcome => {
      expect(isPostSellCashUsable({
        outcome,
        submit: [{symbol: 'BUY1', quantity: 1}],
        cashReadOk: true,
        cashUsable: true,
      })).toBe(true);
    },
  );
});
