/**
 * Integration test: Rebalance computation and payload flow
 *
 * Tests the complete rebalance flow: holdings diff → payload building →
 * API call pattern, across multiple broker configurations.
 */

jest.mock('react-native-crypto-js');

import {computeRebalanceDiff, summarizeRebalanceDiff} from '../../utils/rebalanceDiffUtils';
import {
  buildBrokerPayloadFields,
  isFundsErrorOrMissing,
  checkPortfolioShortfall,
  isRebalanceErrorResponse,
} from '../../utils/rebalanceHelpers';

describe('Integration: Rebalance Flow', () => {
  const mockDecrypt = val => `dec_${val}`;

  // ─── Scenario: Fresh Subscription (No Holdings) ───

  describe('fresh subscription (empty portfolio)', () => {
    test('all target allocations become BUY orders', () => {
      const target = [
        {symbol: 'RELIANCE', value: 30, price: 2600, exchange: 'NSE'},
        {symbol: 'TCS', value: 30, price: 3600, exchange: 'NSE'},
        {symbol: 'INFY', value: 20, price: 1500, exchange: 'NSE'},
        {symbol: 'WIPRO', value: 20, price: 450, exchange: 'NSE'},
      ];

      const diffs = computeRebalanceDiff([], target, 100000);

      expect(diffs).toHaveLength(4);
      diffs.forEach(d => {
        expect(d.action).toBe('BUY');
        expect(d.currentQty).toBe(0);
        expect(d.targetQty).toBeGreaterThan(0);
      });

      const summary = summarizeRebalanceDiff(diffs);
      expect(summary.buyCount).toBe(4);
      expect(summary.sellCount).toBe(0);
      expect(summary.totalBuyValue).toBeGreaterThan(0);
    });
  });

  // ─── Scenario: Complete Exit ───

  describe('complete exit (empty target)', () => {
    test('all holdings become SELL orders', () => {
      const holdings = [
        {symbol: 'RELIANCE', quantity: 10, avgPrice: 2500},
        {symbol: 'TCS', quantity: 5, avgPrice: 3500},
      ];

      const diffs = computeRebalanceDiff(holdings, [], 0);

      expect(diffs).toHaveLength(2);
      diffs.forEach(d => {
        expect(d.action).toBe('SELL');
        expect(d.targetQty).toBe(0);
      });

      const summary = summarizeRebalanceDiff(diffs);
      expect(summary.sellCount).toBe(2);
      expect(summary.buyCount).toBe(0);
    });
  });

  // ─── Scenario: Partial Rebalance ───

  describe('partial rebalance (mixed buy/sell/hold)', () => {
    test('correctly identifies add, remove, and adjust positions', () => {
      const holdings = [
        {symbol: 'RELIANCE', quantity: 10, avgPrice: 2500},
        {symbol: 'TCS', quantity: 5, avgPrice: 3500},
        {symbol: 'OLD_STOCK', quantity: 100, avgPrice: 50},
      ];

      const target = [
        {symbol: 'RELIANCE', value: 40, price: 2600, exchange: 'NSE'},
        {symbol: 'TCS', value: 30, price: 3600, exchange: 'NSE'},
        {symbol: 'NEW_STOCK', value: 30, price: 200, exchange: 'NSE'},
      ];

      const diffs = computeRebalanceDiff(holdings, target, 100000);

      // OLD_STOCK should be SELL (exit)
      const oldStock = diffs.find(d => d.symbol === 'OLD_STOCK');
      expect(oldStock.action).toBe('SELL');
      expect(oldStock.diffQty).toBe(-100);

      // NEW_STOCK should be BUY (new entry)
      const newStock = diffs.find(d => d.symbol === 'NEW_STOCK');
      expect(newStock.action).toBe('BUY');
      expect(newStock.currentQty).toBe(0);

      // All action types should be present
      const actions = new Set(diffs.map(d => d.action));
      expect(actions.has('SELL')).toBe(true);
      expect(actions.has('BUY')).toBe(true);
    });
  });

  // ─── Scenario: Shortfall Detection ───

  describe('portfolio shortfall detection', () => {
    test('detects shortfall and still allows trade execution', () => {
      const response = {
        totalValue: 30000,
        minInvestmentValue: 50000,
        buy: [{symbol: 'RELIANCE', quantity: 5}],
        sell: [],
      };

      const shortfall = checkPortfolioShortfall(response);
      expect(shortfall.isShortfall).toBe(true);
      expect(shortfall.hasTrades).toBe(true);
      // Shortfall is a warning, not a blocker — trades should still proceed
    });
  });

  // ─── Scenario: Funds Validation Before Rebalance ───

  describe('funds validation before rebalance', () => {
    test('connected broker with valid funds → proceed', () => {
      const result = isFundsErrorOrMissing(
        {status: 0, data: {availablecash: 100000}},
        'connected',
      );
      expect(result).toBe(false);
    });

    test('expired token → block rebalance', () => {
      expect(isFundsErrorOrMissing({status: 1}, 'connected')).toBe(true);
    });

    test('disconnected broker → does not flag (caller handles separately)', () => {
      expect(isFundsErrorOrMissing(null, 'disconnected')).toBe(false);
    });
  });

  // ─── Scenario: Error Response Handling ───

  describe('rebalance error responses', () => {
    test('status 1 and 2 are errors', () => {
      expect(isRebalanceErrorResponse({status: 1, message: 'Token expired'})).toBe(true);
      expect(isRebalanceErrorResponse({status: 2, message: 'Server error'})).toBe(true);
    });

    test('status 0 is success', () => {
      expect(isRebalanceErrorResponse({status: 0, buy: [], sell: []})).toBe(false);
    });
  });

  // ─── Scenario: Multi-Broker Payload Consistency ───

  describe('multi-broker payload consistency with rebalance', () => {
    test('Zerodha rebalance payload has only accessToken', () => {
      const payload = buildBrokerPayloadFields('Zerodha', {jwtToken: 'zt'}, mockDecrypt);
      expect(Object.keys(payload)).toEqual(['accessToken']);
    });

    test('Kotak rebalance payload has 6 fields', () => {
      const payload = buildBrokerPayloadFields('Kotak', {
        apiKey: 'enc', secretKey: 'enc', jwtToken: 'kt',
        sid: 'sid1', serverId: 'srv1', viewToken: 'vt1',
      }, mockDecrypt);
      expect(Object.keys(payload)).toHaveLength(6);
      expect(payload.consumerKey).toBeDefined();
      expect(payload.sid).toBe('sid1');
    });

    test('Dhan rebalance payload maps clientCode → clientId', () => {
      const payload = buildBrokerPayloadFields('Dhan', {
        clientCode: 'DH001', jwtToken: 'dt',
      }, mockDecrypt);
      expect(payload.clientId).toBe('DH001');
      expect(payload.accessToken).toBe('dt');
    });
  });
});
