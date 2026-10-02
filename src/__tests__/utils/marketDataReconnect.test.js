import {
  buildReconnectSubscriptions,
  detectMarketExchange,
  needsPriceRefresh,
} from '../../utils/marketDataReconnect';

describe('mobile market-data recovery', () => {
  test('preserves exchanges when rebuilding reconnect subscriptions', () => {
    const exchanges = new Map([
      ['NIFTY26MAY26FUT', 'NFO'],
      ['SENSEX28AUG2675000CE', 'BFO'],
    ]);

    expect(
      buildReconnectSubscriptions(
        new Set(['NIFTY26MAY26FUT', 'SENSEX28AUG2675000CE']),
        exchanges,
      ),
    ).toEqual([
      {symbol: 'NIFTY26MAY26FUT', exchange: 'NFO'},
      {symbol: 'SENSEX28AUG2675000CE', exchange: 'BFO'},
    ]);
  });

  test('detects derivative and equity exchanges safely', () => {
    expect(detectMarketExchange('NIFTY26MAY26FUT')).toBe('NFO');
    expect(detectMarketExchange('SENSEX28AUG2675000CE', 'BSE')).toBe('BFO');
    expect(detectMarketExchange('INFY-EQ')).toBe('NSE');
  });

  test('refreshes missing, zero, or stale prices only', () => {
    const now = 1_000_000;
    expect(needsPriceRefresh(null, now)).toBe(true);
    expect(needsPriceRefresh({lastPrice: 0, timestamp: now}, now)).toBe(true);
    expect(
      needsPriceRefresh({lastPrice: 100, timestamp: now - 60_001}, now),
    ).toBe(true);
    expect(
      needsPriceRefresh({lastPrice: 100, timestamp: now - 1_000}, now),
    ).toBe(false);
  });
});
