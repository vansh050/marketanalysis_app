/**
 * Integration test: End-to-end broker trade flow
 *
 * Tests the complete flow from broker validation → payload building →
 * order placement → EDIS detection, ensuring all modules work together.
 * This simulates what happens when a user taps "Execute" on a trade.
 */

jest.mock('react-native-crypto-js');
jest.mock('react-native-config', () => ({
  REACT_APP_AQ_KEYS: 'test-key',
  REACT_APP_AQ_SECRET: 'test-secret',
  REACT_APP_ZERODHA_API_KEY: 'test-zerodha-key',
  REACT_APP_ANGEL_ONE_API_KEY: 'test-angel-key',
}));
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'mock-token'),
}));
jest.mock('../../utils/serverConfig', () => ({
  server: 'https://server.alphaquark.in/',
  ccxtServer: 'https://ccxtprod.alphaquark.in/',
}));
jest.mock('../../utils/Config', () => ({
  AQ_KEY: 'test-key',
  AQ_SECRET: 'test-secret',
}));

global.fetch = jest.fn();

import {server, ccxtServer} from '../../utils/serverConfig';
import {isOrderTypeSupported, isBrokerAvailable, validateOrderConfig} from '../../utils/brokerSupport';
import {isFundsErrorOrMissing, buildBrokerPayloadFields, isBrokerAuthError} from '../../utils/rebalanceHelpers';
import {computeRebalanceDiff, summarizeRebalanceDiff} from '../../utils/rebalanceDiffUtils';
import {createPlaceOrderFunction, getBrokerUrlSlug} from '../../utils/ProcessTrades';

describe('Integration: Broker Trade Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  // ─── Full Trade Execution Flow ───

  describe('Zerodha full trade flow', () => {
    const credentials = {jwtToken: 'zerodha-token-123'};
    const configData = {
      config: {REACT_APP_HEADER_NAME: 'test-advisor'},
      apiKeys: {angelOneApiKey: 'angel-key'},
    };

    test('step 1: validate broker is available', () => {
      expect(isBrokerAvailable('Zerodha')).toBe(true);
    });

    test('step 2: validate order type is supported', () => {
      expect(isOrderTypeSupported('Zerodha', 'MARKET')).toBe(true);
      expect(isOrderTypeSupported('Zerodha', 'GTT')).toBe(true);
    });

    test('step 3: validate order config', () => {
      const result = validateOrderConfig(
        {orderType: 'MARKET', quantity: 10, symbol: 'RELIANCE'},
        'Zerodha',
      );
      expect(result.valid).toBe(true);
    });

    test('step 4: check funds', () => {
      const funds = {status: 0, data: {availablecash: 50000}};
      expect(isFundsErrorOrMissing(funds, 'connected')).toBe(false);
    });

    test('step 5: build rebalance payload', () => {
      const mockDecrypt = val => val;
      const payload = buildBrokerPayloadFields('Zerodha', credentials, mockDecrypt);
      expect(payload.accessToken).toBe('zerodha-token-123');
    });

    test('step 6: place order via unified endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: [{orderStatus: 'COMPLETE', orderId: 'ZRD-001', tradingSymbol: 'RELIANCE-EQ'}],
        }),
      });

      const onComplete = jest.fn();
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials,
        userEmail: 'user@test.com',
        tradeGivenBy: 'advisor@test.com',
        configData,
        onComplete,
      });

      const result = await placeOrders([
        {tradingSymbol: 'RELIANCE-EQ', transactionType: 'BUY', exchange: 'NSE', quantity: 10, orderType: 'MARKET', tradeId: 'T1'},
      ]);

      expect(result.success).toBe(true);
      expect(onComplete).toHaveBeenCalled();
    });
  });

  // ─── IIFL Blocked Flow ───

  describe('IIFL Securities blocked flow', () => {
    test('broker availability check blocks IIFL', () => {
      expect(isBrokerAvailable('IIFL Securities')).toBe(false);
    });
  });

  // ─── Kotak GTT Fallback Flow ───

  describe('Kotak GTT fallback flow', () => {
    test('GTT order type not supported → suggests SL fallback', () => {
      expect(isOrderTypeSupported('Kotak', 'GTT')).toBe(false);
      const validation = validateOrderConfig(
        {orderType: 'GTT', quantity: 10, symbol: 'TEST', price: 100, triggerPrice: 95},
        'Kotak',
      );
      expect(validation.suggestedFallback).toBe('SL');
    });
  });

  // ─── Rebalance Computation → Order Placement ───

  describe('rebalance to order placement flow', () => {
    test('computes diff → builds trades → summarizes', () => {
      const holdings = [
        {symbol: 'RELIANCE', quantity: 10, avgPrice: 2500},
        {symbol: 'TCS', quantity: 5, avgPrice: 3500},
      ];
      const target = [
        {symbol: 'RELIANCE', value: 60, price: 2600, exchange: 'NSE'},
        {symbol: 'WIPRO', value: 40, price: 450, exchange: 'NSE'},
      ];

      const diffs = computeRebalanceDiff(holdings, target, 100000);

      // Should have BUY WIPRO, adjust RELIANCE, SELL TCS
      expect(diffs.some(d => d.symbol === 'WIPRO' && d.action === 'BUY')).toBe(true);
      expect(diffs.some(d => d.symbol === 'TCS' && d.action === 'SELL')).toBe(true);

      const summary = summarizeRebalanceDiff(diffs);
      expect(summary.buyCount).toBeGreaterThan(0);
      expect(summary.sellCount).toBeGreaterThan(0);
      expect(summary.totalStocks).toBe(diffs.length);
    });
  });

  // ─── Multi-Broker Credential Consistency ───

  describe('all brokers credential mapping consistency', () => {
    const brokerCredentialPairs = [
      ['Zerodha', {jwtToken: 'token'}, ['accessToken']],
      ['Angel One', {jwtToken: 'token', apiKey: 'key'}, ['apiKey', 'jwtToken']],
      ['Upstox', {jwtToken: 'token', apiKey: 'enc', secretKey: 'enc'}, ['apiKey', 'apiSecret', 'accessToken']],
      ['ICICI Direct', {jwtToken: 'token', apiKey: 'enc', secretKey: 'enc'}, ['apiKey', 'secretKey', 'accessToken']],
      ['Dhan', {jwtToken: 'token', clientCode: 'CC'}, ['clientId', 'accessToken']],
      ['Groww', {jwtToken: 'token'}, ['accessToken']],
      ['IIFL Securities', {clientCode: 'CC'}, ['clientCode']],
      ['Kotak', {jwtToken: 't', apiKey: 'e', secretKey: 'e', sid: 's', serverId: 'sr', viewToken: 'vt'}, ['consumerKey', 'consumerSecret', 'accessToken', 'sid', 'serverId', 'viewToken']],
      ['Hdfc Securities', {jwtToken: 'token', apiKey: 'enc'}, ['apiKey', 'accessToken']],
      ['AliceBlue', {jwtToken: 'token', clientCode: 'CC', apiKey: 'key'}, ['clientId', 'accessToken', 'apiKey']],
      ['Fyers', {jwtToken: 'token', clientCode: 'CC'}, ['clientId', 'accessToken']],
      ['Motilal Oswal', {jwtToken: 'token', clientCode: 'CC', apiKey: 'enc'}, ['clientCode', 'accessToken', 'apiKey']],
      ['Axis Securities', {jwtToken: 'token'}, ['accessToken']],
    ];

    test.each(brokerCredentialPairs)(
      '%s payload has correct fields: %p',
      (broker, credentials, expectedFields) => {
        const mockDecrypt = val => `dec_${val}`;
        const payload = buildBrokerPayloadFields(broker, credentials, mockDecrypt, 'angel-config-key');
        expectedFields.forEach(field => {
          expect(payload).toHaveProperty(field);
        });
      },
    );
  });

  // ─── Auth Error Detection Cross-Module ───

  describe('auth error detection integration', () => {
    test('broker auth error triggers session expired flow', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: [], sessionExpired: true}),
      });

      const onSessionExpired = jest.fn();
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: {jwtToken: 'expired-token'},
        userEmail: 'test@test.com',
        tradeGivenBy: 'adv@test.com',
        configData: {config: {}},
        onSessionExpired,
      });

      await placeOrders([{tradingSymbol: 'TEST', transactionType: 'BUY', exchange: 'NSE', quantity: 1, tradeId: 'T'}]);

      expect(onSessionExpired).toHaveBeenCalled();
    });

    test('isBrokerAuthError detects expired token messages', () => {
      expect(isBrokerAuthError('Token expired')).toBe(true);
      expect(isBrokerAuthError('Invalid API key')).toBe(true);
      expect(isBrokerAuthError('Session expired')).toBe(true);
    });
  });
});
