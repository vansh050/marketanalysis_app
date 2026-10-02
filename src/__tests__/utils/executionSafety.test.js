import {
  executionQuantityUnit,
  executionSegment,
  prepareExecutionPayload,
} from '../../utils/executionSafety';

describe('mobile execution quantity contract', () => {
  test('cash equity is stamped as shares', () => {
    const payload = prepareExecutionPayload({
      requestId: 'tap-equity',
      trades: [{exchange: 'NSE', quantity: 10}],
    });
    expect(payload.trades[0]).toEqual(expect.objectContaining({
      quantity_unit: 'shares',
      segment: 'EQUITY',
      clientTradeId: 'tap-equity-leg-1',
    }));
  });

  test.each(['NFO', 'BFO'])('%s derivatives use the broker FNO segment', exchange => {
    expect(executionSegment({exchange, segment: 'FUTURES'})).toBe('FNO');
  });

  test('cash exchange repairs a missing segment before dispatch', () => {
    expect(executionSegment({exchange: 'NSE'})).toBe('EQUITY');
  });

  test.each(['NFO', 'BFO'])('%s derivative quantities remain lots', exchange => {
    expect(executionQuantityUnit({exchange, quantity: 2, Lots: 65})).toBe('lots');
  });

  test('an explicit already-expanded share unit is preserved', () => {
    expect(executionQuantityUnit({
      exchange: 'NFO', quantity: 130, quantity_unit: 'shares',
    })).toBe('shares');
  });
});
