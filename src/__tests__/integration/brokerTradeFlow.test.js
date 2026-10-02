/**
 * Integration test: End-to-end broker trade flow
 *
 * Phase A trade-exec alignment (2026-05-01) — `createPlaceOrderFunction`
 * (from `src/utils/ProcessTrades.js`) was deleted as dead code; bespoke /
 * cart / ignore-trades / OrderService flows now POST direct to ccxt-india
 * `/orders/process-trade`. This test was rewritten against the new
 * direct-ccxt path via `OrderService.placeOrders`. Spec:
 * `docs/SDK_TRADE_EXECUTION_MIGRATION.md § Phase A`.
 *
 * Tests the modules that still exist post-Phase-A:
 *   - brokerSupport (broker availability + order-type matrix)
 *   - rebalanceHelpers (payload builder, auth-error detector, funds check)
 *   - rebalanceDiffUtils (diff + summary)
 *   - OrderService.placeOrders (single direct-ccxt dispatch path)
 */

jest.mock('react-native-crypto-js');
jest.mock('react-native-config', () => ({
  REACT_APP_AQ_KEYS: 'test-key',
  REACT_APP_AQ_SECRET: 'test-secret',
  REACT_APP_ZERODHA_API_KEY: 'test-zerodha-key',
  REACT_APP_ANGEL_ONE_API_KEY: 'test-angel-key',
  REACT_APP_BESPOKE_DIRECT_CCXT_FALLBACK: 'true',
}));
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'mock-token'),
}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://server.alphaquark.in/'},
    ccxtServer: {baseUrl: 'https://ccxtprod.alphaquark.in/'},
  },
  server: {baseUrl: 'https://server.alphaquark.in/'},
  ccxtServer: {baseUrl: 'https://ccxtprod.alphaquark.in/'},
}));
jest.mock('../../utils/Config', () => ({
  AQ_KEY: 'test-key',
  AQ_SECRET: 'test-secret',
}));
jest.mock('../../utils/customerAuthHeaders', () => ({
  getCustomerAuthHeaders: jest.fn(async () => ({
    Authorization: 'Bearer firebase-token',
  })),
}));

jest.mock('axios', () => {
  const mock = jest.fn();
  mock.post = jest.fn();
  return {__esModule: true, default: mock};
});

import axios from 'axios';
import {
  isOrderTypeSupported,
  isBrokerAvailable,
  validateOrderConfig,
} from '../../utils/brokerSupport';
import {
  isFundsErrorOrMissing,
  buildBrokerPayloadFields,
  isBrokerAuthError,
} from '../../utils/rebalanceHelpers';
import {
  computeRebalanceDiff,
  summarizeRebalanceDiff,
} from '../../utils/rebalanceDiffUtils';
import {placeOrders} from '../../services/OrderService';

describe('Integration: Broker Trade Flow (Phase A direct-ccxt)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Broker support matrix ─────────────────────────────────────

  describe('Zerodha trade preflight', () => {
    test('Zerodha is available', () => {
      expect(isBrokerAvailable('Zerodha')).toBe(true);
    });

    test('MARKET + GTT are supported on Zerodha', () => {
      expect(isOrderTypeSupported('Zerodha', 'MARKET')).toBe(true);
      expect(isOrderTypeSupported('Zerodha', 'GTT')).toBe(true);
    });

    test('order config validates', () => {
      const result = validateOrderConfig(
        {orderType: 'MARKET', quantity: 10, symbol: 'RELIANCE'},
        'Zerodha',
      );
      expect(result.valid).toBe(true);
    });

    test('funds-not-missing detector', () => {
      const funds = {status: 0, data: {availablecash: 50000}};
      expect(isFundsErrorOrMissing(funds, 'connected')).toBe(false);
    });

    test('payload builder maps Zerodha credentials', () => {
      const mockDecrypt = (val) => val;
      const payload = buildBrokerPayloadFields(
        'Zerodha',
        {jwtToken: 'zerodha-token-123'},
        mockDecrypt,
      );
      expect(payload.accessToken).toBe('zerodha-token-123');
    });
  });

  // ─── New direct-ccxt order placement (replaces old ProcessTrades) ──

  describe('OrderService.placeOrders direct-ccxt path', () => {
    const configData = {config: {REACT_APP_HEADER_NAME: 'test-advisor'}};
    const samplePayload = {
      user_email: 'user@test.com',
      user_broker: 'Zerodha',
      trades: [
        {
          tradingSymbol: 'RELIANCE-EQ',
          transactionType: 'BUY',
          exchange: 'NSE',
          quantity: 10,
          orderType: 'MARKET',
          tradeId: 'T1',
        },
      ],
      jwtToken: 'zerodha-token-123',
    };

    test('POSTs with stable request, leg identity, and explicit quantity unit', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              symbol: 'RELIANCE-EQ',
              transactionType: 'BUY',
              orderStatus: 'COMPLETE',
              orderId: 'ZRD-001',
            },
          ],
        },
      });

      const data = await placeOrders(samplePayload, configData);
      expect(axios.post).toHaveBeenCalledTimes(1);
      const [url, body, opts] = axios.post.mock.calls[0];
      expect(url).toBe('https://server.alphaquark.in/api/process-trades/order-place');
      expect(body.trades[0].clientTradeId).toBeDefined();
      expect(body.requestId).toBeDefined();
      expect(body.trades[0].quantity_unit).toBe('shares');
      expect(opts.headers['x-request-id']).toBe(body.requestId);
      expect(opts.headers['X-Advisor-Subdomain']).toBe('test-advisor');
      expect(opts.headers.Authorization).toBe('Bearer firebase-token');
      expect(data.results[0].orderStatus).toBe('COMPLETE');
    });

    test('does not dispatch a second route after a 5xx', async () => {
      axios.post.mockRejectedValueOnce({response: {status: 503}, message: 'unavailable'});
      await expect(placeOrders(samplePayload, configData)).rejects.toMatchObject({
        response: {status: 503},
      });
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('does not dispatch a second route after a network error', async () => {
      axios.post.mockRejectedValueOnce({message: 'Network Error'});
      await expect(placeOrders(samplePayload, configData)).rejects.toMatchObject({
        message: 'Network Error',
      });
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('does NOT fall back on 4xx', async () => {
      axios.post.mockRejectedValueOnce({
        response: {status: 401},
        message: 'Token decode failed',
      });

      await expect(placeOrders(samplePayload, configData)).rejects.toMatchObject({
        response: {status: 401},
      });
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });

  // ─── IIFL direct flow (broker matrix gate) ─────────────────────

  describe('IIFL Securities direct flow', () => {
    test('broker availability check permits IIFL', () => {
      expect(isBrokerAvailable('IIFL Securities')).toBe(true);
    });
  });

  // ─── Kotak GTT fallback flow ───────────────────────────────────

  describe('Kotak GTT fallback flow', () => {
    test('GTT order type not supported → suggests SL fallback', () => {
      expect(isOrderTypeSupported('Kotak', 'GTT')).toBe(false);
      const validation = validateOrderConfig(
        {
          orderType: 'GTT',
          quantity: 10,
          symbol: 'TEST',
          price: 100,
          triggerPrice: 95,
        },
        'Kotak',
      );
      expect(validation.suggestedFallback).toBe('SL');
    });
  });

  // ─── Rebalance computation → order summary ─────────────────────

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
      expect(
        diffs.some((d) => d.symbol === 'WIPRO' && d.action === 'BUY'),
      ).toBe(true);
      expect(
        diffs.some((d) => d.symbol === 'TCS' && d.action === 'SELL'),
      ).toBe(true);

      const summary = summarizeRebalanceDiff(diffs);
      expect(summary.buyCount).toBeGreaterThan(0);
      expect(summary.sellCount).toBeGreaterThan(0);
      expect(summary.totalStocks).toBe(diffs.length);
    });
  });

  // ─── Multi-broker credential mapping ───────────────────────────

  describe('all brokers credential mapping consistency', () => {
    const brokerCredentialPairs = [
      ['Zerodha', {jwtToken: 'token'}, ['accessToken']],
      ['Angel One', {jwtToken: 'token', apiKey: 'key'}, ['apiKey', 'jwtToken']],
      [
        'Upstox',
        {jwtToken: 'token', apiKey: 'enc', secretKey: 'enc'},
        ['apiKey', 'apiSecret', 'accessToken'],
      ],
      [
        'ICICI Direct',
        {jwtToken: 'token', apiKey: 'enc', secretKey: 'enc'},
        ['apiKey', 'secretKey', 'accessToken'],
      ],
      [
        'Dhan',
        {jwtToken: 'token', clientCode: 'CC'},
        ['clientId', 'accessToken'],
      ],
      ['Groww', {jwtToken: 'token'}, ['accessToken']],
      ['IIFL Securities', {clientCode: 'CC'}, ['clientCode']],
      [
        'Kotak',
        {
          jwtToken: 't',
          apiKey: 'e',
          secretKey: 'e',
          sid: 's',
          serverId: 'sr',
          viewToken: 'vt',
        },
        ['apiKey', 'apiAccessToken', 'accessToken', 'sid', 'serverId'],
      ],
      [
        'Hdfc Securities',
        {jwtToken: 'token', apiKey: 'enc'},
        ['apiKey', 'accessToken'],
      ],
      [
        'AliceBlue',
        {jwtToken: 'token', clientCode: 'CC', apiKey: 'key'},
        ['clientId', 'accessToken', 'apiKey'],
      ],
      [
        'Fyers',
        {jwtToken: 'token', clientCode: 'CC'},
        ['clientId', 'accessToken'],
      ],
      [
        'Motilal Oswal',
        {jwtToken: 'token', clientCode: 'CC', apiKey: 'enc'},
        ['clientCode', 'accessToken', 'apiKey'],
      ],
      ['Axis Securities', {jwtToken: 'token'}, ['accessToken']],
    ];

    test.each(brokerCredentialPairs)(
      '%s payload has correct fields: %p',
      (broker, credentials, expectedFields) => {
        const mockDecrypt = (val) => `dec_${val}`;
        const payload = buildBrokerPayloadFields(
          broker,
          credentials,
          mockDecrypt,
          'angel-config-key',
        );
        expectedFields.forEach((field) => {
          expect(payload).toHaveProperty(field);
        });
      },
    );
  });

  // ─── Auth error detector ───────────────────────────────────────

  describe('auth error detection integration', () => {
    test('isBrokerAuthError detects expired-token messages', () => {
      expect(isBrokerAuthError('Token expired')).toBe(true);
      expect(isBrokerAuthError('Invalid api_key')).toBe(true);
      expect(isBrokerAuthError('Session expired')).toBe(true);
    });
  });
});
