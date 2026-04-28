/**
 * Tests for ProcessTrades.js
 * Validates order payload building, GTT/regular order separation,
 * EDIS/TPIN detection, broker credential mapping, and API routing.
 */

jest.mock('react-native-crypto-js');
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'mock-service-token'),
}));
jest.mock('../../utils/serverConfig', () => ({
  server: 'https://server.alphaquark.in/',
  ccxtServer: 'https://ccxtprod.alphaquark.in/',
}));
jest.mock('../../utils/Config', () => ({
  AQ_KEY: 'test-aq-key',
  AQ_SECRET: 'test-aq-secret',
}));

// Mock fetch
global.fetch = jest.fn();

import {server, ccxtServer} from '../../utils/serverConfig';
import {createPlaceOrderFunction, getBrokerUrlSlug} from '../../utils/ProcessTrades';
import {
  SAMPLE_STOCK_DETAIL,
  SAMPLE_SELL_ORDER,
  SAMPLE_GTT_ORDER,
  SAMPLE_ORDER_RESULTS,
  SAMPLE_CONFIG_DATA,
} from '../fixtures/tradeData';
import {
  ZERODHA_CREDENTIALS,
  ANGEL_ONE_CREDENTIALS,
  UPSTOX_CREDENTIALS,
  DHAN_CREDENTIALS,
  KOTAK_CREDENTIALS,
  AXIS_CREDENTIALS,
} from '../fixtures/brokerCredentials';

describe('ProcessTrades', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockReset();
  });

  // ─── getBrokerUrlSlug ───

  describe('getBrokerUrlSlug', () => {
    test('maps all known brokers to correct URL slugs', () => {
      expect(getBrokerUrlSlug('Zerodha')).toBe('zerodha/api');
      expect(getBrokerUrlSlug('Angel One')).toBe('angelone');
      expect(getBrokerUrlSlug('Upstox')).toBe('upstox');
      expect(getBrokerUrlSlug('ICICI Direct')).toBe('icici');
      expect(getBrokerUrlSlug('Kotak')).toBe('kotak');
      expect(getBrokerUrlSlug('Dhan')).toBe('dhan');
      expect(getBrokerUrlSlug('Fyers')).toBe('fyers');
      expect(getBrokerUrlSlug('IIFL Securities')).toBe('iifl');
      expect(getBrokerUrlSlug('AliceBlue')).toBe('aliceblue');
      expect(getBrokerUrlSlug('Hdfc Securities')).toBe('hdfc');
      expect(getBrokerUrlSlug('Groww')).toBe('groww');
      expect(getBrokerUrlSlug('Motilal Oswal')).toBe('motilal-oswal');
      expect(getBrokerUrlSlug('Axis Securities')).toBe('axis');
    });

    test('unknown broker falls back to lowercase name', () => {
      expect(getBrokerUrlSlug('NewBroker')).toBe('newbroker');
    });
  });

  // ─── createPlaceOrderFunction - Regular Orders ───

  describe('createPlaceOrderFunction - regular orders', () => {
    test('places regular MARKET order via unified endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: SAMPLE_ORDER_RESULTS.success}),
      });

      const onComplete = jest.fn();
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
        onComplete,
      });

      const result = await placeOrders([SAMPLE_STOCK_DETAIL]);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toBe(
        `${server}api/process-trades/order-place`,
      );
      expect(onComplete).toHaveBeenCalledWith(SAMPLE_ORDER_RESULTS.success);
    });

    test('includes correct Zerodha credentials in payload', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: []}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      await placeOrders([SAMPLE_STOCK_DETAIL]);

      const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(payload.jwtToken).toBe('zerodha-jwt-token-123');
      expect(payload.user_broker).toBe('Zerodha');
      expect(payload.user_email).toBe('test@example.com');
    });

    test('includes Angel One apiKey from config', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: []}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Angel One',
        credentials: ANGEL_ONE_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      await placeOrders([SAMPLE_STOCK_DETAIL]);

      const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(payload.apiKey).toBe('config-angel-api-key');
      expect(payload.accessToken).toBe('angel-jwt-token-456');
    });

    test('includes Axis Securities auth credentials', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: []}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Axis Securities',
        credentials: AXIS_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      await placeOrders([SAMPLE_STOCK_DETAIL]);

      const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(payload.authToken).toBe('axis-jwt-token-111');
      expect(payload.subAccountId).toBe('AXIS-CLIENT-001');
    });

    test('formats trade array correctly', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: []}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Dhan',
        credentials: DHAN_CREDENTIALS,
        userEmail: 'user@test.com',
        tradeGivenBy: 'advisor@test.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      await placeOrders([SAMPLE_STOCK_DETAIL]);

      const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
      const trade = payload.trades[0];
      expect(trade.user_email).toBe('user@test.com');
      expect(trade.trade_given_by).toBe('advisor@test.com');
      expect(trade.tradingSymbol).toBe('RELIANCE-EQ');
      expect(trade.transactionType).toBe('BUY');
      expect(trade.exchange).toBe('NSE');
      expect(trade.segment).toBe('EQUITY');
      expect(trade.productType).toBe('DELIVERY');
      expect(trade.orderType).toBe('MARKET');
      expect(trade.quantity).toBe(10);
      expect(trade.user_broker).toBe('Dhan');
    });
  });

  // ─── createPlaceOrderFunction - GTT Orders ───

  describe('createPlaceOrderFunction - GTT orders', () => {
    test('routes GTT orders to broker-specific endpoint for Zerodha', async () => {
      // GTT endpoint
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: [{orderStatus: 'COMPLETE'}]}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      await placeOrders([SAMPLE_GTT_ORDER]);

      expect(global.fetch.mock.calls[0][0]).toBe(
        `${ccxtServer}zerodha/api/process-trades`,
      );
    });

    test('routes GTT orders to Upstox-specific endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: []}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Upstox',
        credentials: UPSTOX_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      await placeOrders([SAMPLE_GTT_ORDER]);

      expect(global.fetch.mock.calls[0][0]).toBe(
        `${ccxtServer}upstox/process-trades`,
      );
    });

    test('GTT orders for non-GTT brokers go via regular endpoint', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: []}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Dhan',
        credentials: DHAN_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      // Dhan is not in gttBrokers ['upstox', 'zerodha'], so goes to regular endpoint
      await placeOrders([{...SAMPLE_GTT_ORDER}]);

      expect(global.fetch.mock.calls[0][0]).toBe(
        `${server}api/process-trades/order-place`,
      );
    });

    test('mixed GTT + regular orders are split correctly', async () => {
      // GTT endpoint call
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: [{orderId: 'GTT-1'}]}),
      });
      // Regular endpoint call
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: [{orderId: 'REG-1'}]}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      const result = await placeOrders([SAMPLE_GTT_ORDER, SAMPLE_STOCK_DETAIL]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.results).toHaveLength(2);
    });

    test('GTT payload includes gtt flag and leg data', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: []}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      await placeOrders([SAMPLE_GTT_ORDER]);

      const payload = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(payload.gtt).toBe(true);
      expect(payload.entryLeg).toBeDefined();
      expect(payload.leg1).toBeDefined();
      expect(payload.leg2).toBeDefined();
    });
  });

  // ─── EDIS/TPIN Detection ───

  describe('EDIS/TPIN detection', () => {
    test('triggers onTpinRequired for EDIS rejection on SELL', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: SAMPLE_ORDER_RESULTS.edisRejected}),
      });

      const onTpinRequired = jest.fn();
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
        onTpinRequired,
      });

      await placeOrders([SAMPLE_SELL_ORDER]);

      expect(onTpinRequired).toHaveBeenCalledWith('Zerodha', expect.any(Array));
    });

    test('does NOT trigger onTpinRequired for non-EDIS rejection', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: SAMPLE_ORDER_RESULTS.rejected}),
      });

      const onTpinRequired = jest.fn();
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
        onTpinRequired,
      });

      await placeOrders([SAMPLE_SELL_ORDER]);

      expect(onTpinRequired).not.toHaveBeenCalled();
    });
  });

  // ─── Error Handling ───

  describe('error handling', () => {
    test('calls onError on API failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const onError = jest.fn();
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
        onError,
      });

      const result = await placeOrders([SAMPLE_STOCK_DETAIL]);

      expect(result.success).toBe(false);
      expect(onError).toHaveBeenCalled();
    });

    test('calls onSessionExpired when session is expired', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: [], sessionExpired: true}),
      });

      const onSessionExpired = jest.fn();
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
        onSessionExpired,
      });

      const result = await placeOrders([SAMPLE_STOCK_DETAIL]);

      expect(result.sessionExpired).toBe(true);
      expect(onSessionExpired).toHaveBeenCalled();
    });

    test('handles network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network timeout'));

      const onError = jest.fn();
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
        onError,
      });

      const result = await placeOrders([SAMPLE_STOCK_DETAIL]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    test('returns empty results on no orders', async () => {
      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      const result = await placeOrders([]);

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });
  });

  // ─── Authorization Header ───

  describe('authorization header', () => {
    test('sends Bearer token in Authorization header', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({response: []}),
      });

      const placeOrders = createPlaceOrderFunction({
        broker: 'Zerodha',
        credentials: ZERODHA_CREDENTIALS,
        userEmail: 'test@example.com',
        tradeGivenBy: 'advisor@example.com',
        configData: SAMPLE_CONFIG_DATA,
      });

      await placeOrders([SAMPLE_STOCK_DETAIL]);

      const headers = global.fetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer mock-service-token');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });
});
