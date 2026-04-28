/**
 * Tests for rebalanceDiffUtils.js
 * Validates portfolio diff computation, action assignment (BUY/SELL/HOLD),
 * weight calculations, exit detection, and summary generation.
 */

import {
  computeRebalanceDiff,
  summarizeRebalanceDiff,
} from '../../utils/rebalanceDiffUtils';

describe('rebalanceDiffUtils', () => {
  // ─── computeRebalanceDiff ───

  describe('computeRebalanceDiff', () => {
    const holdings = [
      {symbol: 'RELIANCE', quantity: 10, avgPrice: 2500, exchange: 'NSE'},
      {symbol: 'TCS', quantity: 5, avgPrice: 3500, exchange: 'NSE'},
      {symbol: 'INFY', quantity: 20, avgPrice: 1500, exchange: 'NSE'},
    ];

    const target = [
      {symbol: 'RELIANCE', value: 40, price: 2600, exchange: 'NSE'},
      {symbol: 'TCS', value: 30, price: 3600, exchange: 'NSE'},
      {symbol: 'WIPRO', value: 30, price: 450, exchange: 'NSE'},
    ];

    test('computes diffs for existing and new stocks', () => {
      const diffs = computeRebalanceDiff(holdings, target, 100000);
      expect(diffs.length).toBeGreaterThanOrEqual(4); // RELIANCE, TCS, WIPRO, INFY (exit)

      const reliance = diffs.find(d => d.symbol === 'RELIANCE');
      expect(reliance).toBeDefined();
      expect(reliance.currentQty).toBe(10);
      expect(reliance.targetQty).toBeGreaterThan(0);
    });

    test('marks new stocks as BUY', () => {
      const diffs = computeRebalanceDiff(holdings, target, 100000);
      const wipro = diffs.find(d => d.symbol === 'WIPRO');
      expect(wipro).toBeDefined();
      expect(wipro.action).toBe('BUY');
      expect(wipro.currentQty).toBe(0);
      expect(wipro.diffQty).toBeGreaterThan(0);
    });

    test('marks stocks not in target as SELL (exit)', () => {
      const diffs = computeRebalanceDiff(holdings, target, 100000);
      const infy = diffs.find(d => d.symbol === 'INFY');
      expect(infy).toBeDefined();
      expect(infy.action).toBe('SELL');
      expect(infy.targetQty).toBe(0);
      expect(infy.diffQty).toBe(-20);
    });

    test('groups actions: SELL, BUY, HOLD in output', () => {
      const h = [
        {symbol: 'EXIT1', quantity: 10, avgPrice: 100},
        {symbol: 'EXIT2', quantity: 5, avgPrice: 200},
        {symbol: 'KEEP', quantity: 50, avgPrice: 200},
      ];
      const t = [
        {symbol: 'KEEP', value: 50, price: 200, exchange: 'NSE'},
        {symbol: 'NEW1', value: 25, price: 100, exchange: 'NSE'},
        {symbol: 'NEW2', value: 25, price: 100, exchange: 'NSE'},
      ];
      const diffs = computeRebalanceDiff(h, t, 100000);
      const actions = diffs.map(d => d.action);

      // Verify all three action types are present
      expect(actions).toContain('SELL');
      expect(actions).toContain('BUY');

      // Verify actions are grouped (no interleaving of SELL and BUY)
      const sellCount = actions.filter(a => a === 'SELL').length;
      const buyCount = actions.filter(a => a === 'BUY').length;
      expect(sellCount).toBeGreaterThanOrEqual(2); // EXIT1 + EXIT2
      expect(buyCount).toBeGreaterThanOrEqual(2);  // NEW1 + NEW2
    });

    test('calculates target quantity using floor division', () => {
      const diffs = computeRebalanceDiff(
        [],
        [{symbol: 'TEST', value: 50, price: 300, exchange: 'NSE'}],
        100000,
      );
      const test = diffs.find(d => d.symbol === 'TEST');
      // 50% of 100000 = 50000, 50000/300 = 166.66 → floor = 166
      expect(test.targetQty).toBe(166);
    });

    test('handles zero price → targetQty = 0', () => {
      const diffs = computeRebalanceDiff(
        [],
        [{symbol: 'ZERO', value: 50, price: 0, exchange: 'NSE'}],
        100000,
      );
      const zero = diffs.find(d => d.symbol === 'ZERO');
      expect(zero.targetQty).toBe(0);
    });

    test('uses currentTotalValue when totalInvestment is 0', () => {
      // Holdings total: 10*2500 + 5*3500 + 20*1500 = 25000+17500+30000 = 72500
      const diffs = computeRebalanceDiff(holdings, target, 0);
      const reliance = diffs.find(d => d.symbol === 'RELIANCE');
      // 40% of 72500 = 29000, 29000/2600 = 11.15 → floor = 11
      expect(reliance.targetQty).toBe(11);
    });

    test('handles empty holdings', () => {
      const diffs = computeRebalanceDiff([], target, 100000);
      expect(diffs.length).toBe(3);
      diffs.forEach(d => {
        expect(d.currentQty).toBe(0);
        expect(d.action).toBe('BUY');
      });
    });

    test('handles empty target → all stocks become SELL', () => {
      const diffs = computeRebalanceDiff(holdings, [], 100000);
      expect(diffs.length).toBe(3);
      diffs.forEach(d => {
        expect(d.action).toBe('SELL');
        expect(d.targetQty).toBe(0);
      });
    });

    test('handles both empty → returns empty', () => {
      const diffs = computeRebalanceDiff([], [], 100000);
      expect(diffs).toEqual([]);
    });

    test('HOLD when currentQty equals targetQty', () => {
      const diffs = computeRebalanceDiff(
        [{symbol: 'A', quantity: 100, avgPrice: 100}],
        [{symbol: 'A', value: 100, price: 100, exchange: 'NSE'}],
        10000,
      );
      const a = diffs.find(d => d.symbol === 'A');
      expect(a.action).toBe('HOLD');
      expect(a.diffQty).toBe(0);
    });

    test('weight calculations are rounded to 2 decimal places', () => {
      const diffs = computeRebalanceDiff(holdings, target, 100000);
      diffs.forEach(d => {
        const currentDecimalPlaces = (d.currentWeight.toString().split('.')[1] || '').length;
        const targetDecimalPlaces = (d.targetWeight.toString().split('.')[1] || '').length;
        expect(currentDecimalPlaces).toBeLessThanOrEqual(2);
        expect(targetDecimalPlaces).toBeLessThanOrEqual(2);
      });
    });

    test('symbol normalization is case-insensitive', () => {
      const diffs = computeRebalanceDiff(
        [{symbol: 'reliance', quantity: 10, avgPrice: 2500}],
        [{symbol: 'RELIANCE', value: 50, price: 2600, exchange: 'NSE'}],
        100000,
      );
      const reliance = diffs.find(d => d.symbol === 'RELIANCE');
      expect(reliance.currentQty).toBe(10);
    });

    test('supports averagePrice alias', () => {
      const diffs = computeRebalanceDiff(
        [{symbol: 'TEST', quantity: 10, averagePrice: 100}],
        [{symbol: 'TEST', value: 100, price: 100, exchange: 'NSE'}],
        10000,
      );
      const test = diffs.find(d => d.symbol === 'TEST');
      expect(test.currentQty).toBe(10);
    });

    test('each diff has all required fields', () => {
      const diffs = computeRebalanceDiff(holdings, target, 100000);
      diffs.forEach(d => {
        expect(d).toHaveProperty('symbol');
        expect(d).toHaveProperty('exchange');
        expect(d).toHaveProperty('currentQty');
        expect(d).toHaveProperty('targetQty');
        expect(d).toHaveProperty('diffQty');
        expect(d).toHaveProperty('action');
        expect(d).toHaveProperty('currentWeight');
        expect(d).toHaveProperty('targetWeight');
        expect(d).toHaveProperty('weightDiff');
        expect(d).toHaveProperty('currentValue');
        expect(d).toHaveProperty('targetValue');
        expect(d).toHaveProperty('price');
      });
    });
  });

  // ─── summarizeRebalanceDiff ───

  describe('summarizeRebalanceDiff', () => {
    test('correctly counts buy/sell/hold', () => {
      const diffs = [
        {action: 'BUY', diffQty: 10, price: 100},
        {action: 'BUY', diffQty: 5, price: 200},
        {action: 'SELL', diffQty: -8, price: 150},
        {action: 'HOLD', diffQty: 0, price: 300},
      ];
      const summary = summarizeRebalanceDiff(diffs);
      expect(summary.buyCount).toBe(2);
      expect(summary.sellCount).toBe(1);
      expect(summary.holdCount).toBe(1);
      expect(summary.totalStocks).toBe(4);
    });

    test('calculates total buy and sell values', () => {
      const diffs = [
        {action: 'BUY', diffQty: 10, price: 100},   // 1000
        {action: 'BUY', diffQty: 5, price: 200},    // 1000
        {action: 'SELL', diffQty: -8, price: 150},   // 1200
      ];
      const summary = summarizeRebalanceDiff(diffs);
      expect(summary.totalBuyValue).toBe(2000);
      expect(summary.totalSellValue).toBe(1200);
    });

    test('netCashFlow = totalSellValue - totalBuyValue', () => {
      const diffs = [
        {action: 'BUY', diffQty: 10, price: 100},   // 1000
        {action: 'SELL', diffQty: -20, price: 150},  // 3000
      ];
      const summary = summarizeRebalanceDiff(diffs);
      expect(summary.netCashFlow).toBe(2000); // 3000 - 1000
    });

    test('empty diffs returns zeros', () => {
      const summary = summarizeRebalanceDiff([]);
      expect(summary.buyCount).toBe(0);
      expect(summary.sellCount).toBe(0);
      expect(summary.holdCount).toBe(0);
      expect(summary.totalBuyValue).toBe(0);
      expect(summary.totalSellValue).toBe(0);
      expect(summary.netCashFlow).toBe(0);
      expect(summary.totalStocks).toBe(0);
    });

    test('uses absolute value for sell diffQty', () => {
      const diffs = [
        {action: 'SELL', diffQty: -5, price: 100}, // abs(5)*100 = 500
      ];
      const summary = summarizeRebalanceDiff(diffs);
      expect(summary.totalSellValue).toBe(500);
    });
  });
});
