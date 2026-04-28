/**
 * Tests for BrokerOrderBookAPI.js
 * Validates order book fetching, order cancellation, order modification,
 * broker payload construction, and response normalization for all brokers.
 */

jest.mock('axios');
jest.mock('react-native-crypto-js');
jest.mock('react-native-config', () => ({
  REACT_APP_AQ_KEYS: 'test-key',
  REACT_APP_AQ_SECRET: 'test-secret',
  REACT_APP_ZERODHA_API_KEY: 'env-zerodha-key',
  REACT_APP_ANGEL_ONE_API_KEY: 'env-angel-key',
  REACT_APP_HEADER_NAME: 'test-advisor',
}));
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'mock-encrypted-key'),
}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://server.alphaquark.in/'},
    ccxtServer: {baseUrl: 'https://ccxtprod.alphaquark.in/'},
  },
}));
jest.mock('../../utils/orderStatusUtils', () => ({
  normalizeOrderStatus: jest.fn((status) => {
    const map = {
      COMPLETE: 'completed',
      complete: 'completed',
      OPEN: 'pending',
      open: 'pending',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      TRIGGER_PENDING: 'pending',
    };
    return map[status] || 'unknown';
  }),
}));

import axios from 'axios';
import server from '../../utils/serverConfig';
import {
  fetchOrderBook,
  fetchPendingOrders,
  cancelOrder,
  getOrderStatus,
  modifyOrder,
  findPendingOrdersForSymbol,
} from '../../services/BrokerOrderBookAPI';

describe('BrokerOrderBookAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log/error in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  // ─── fetchOrderBook - Endpoint Routing ───

  describe('fetchOrderBook - endpoint routing', () => {
    const credentials = {jwtToken: 'token-123', apiKey: 'key', secretKey: 'secret', clientCode: 'CC001', sid: 'sid-1'};

    beforeEach(() => {
      axios.post.mockResolvedValue({data: []});
    });

    test('Zerodha routes to /zerodha/order-book', async () => {
      await fetchOrderBook('Zerodha', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}zerodha/order-book`);
    });

    test('Angel One routes to /angelone/order-book', async () => {
      await fetchOrderBook('Angel One', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}angelone/order-book`);
    });

    test('Upstox routes to /upstox/order-book', async () => {
      await fetchOrderBook('Upstox', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}upstox/order-book`);
    });

    test('ICICI Direct routes to /icici/order-book', async () => {
      await fetchOrderBook('ICICI Direct', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}icici/order-book`);
    });

    test('Dhan routes to /dhan/order-book', async () => {
      await fetchOrderBook('Dhan', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}dhan/order-book`);
    });

    test('Kotak routes to /kotak/order-book', async () => {
      await fetchOrderBook('Kotak', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}kotak/order-book`);
    });

    test('Fyers routes to /fyers/order-book', async () => {
      await fetchOrderBook('Fyers', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}fyers/order-book`);
    });

    test('AliceBlue routes to /aliceblue/order-book', async () => {
      await fetchOrderBook('AliceBlue', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}aliceblue/order-book`);
    });

    test('HDFC routes to /hdfc/order-book', async () => {
      await fetchOrderBook('Hdfc Securities', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}hdfc/order-book`);
    });

    test('Motilal Oswal routes to /motilal-oswal/order-book', async () => {
      await fetchOrderBook('Motilal Oswal', credentials);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}motilal-oswal/order-book`);
    });
  });

  // ─── fetchOrderBook - Error Cases ───

  describe('fetchOrderBook - error cases', () => {
    test('IIFL Securities throws unavailable error', async () => {
      await expect(
        fetchOrderBook('IIFL Securities', {clientCode: 'CC'}),
      ).rejects.toThrow('temporarily unavailable');
    });

    test('unsupported broker throws error', async () => {
      await expect(
        fetchOrderBook('RandomBroker', {}),
      ).rejects.toThrow('Unsupported broker');
    });

    test('missing credentials throws error', async () => {
      await expect(
        fetchOrderBook('ICICI Direct', {jwtToken: null, apiKey: null, secretKey: null}),
      ).rejects.toThrow('Missing required credentials');
    });

    test('missing Zerodha jwtToken throws error', async () => {
      await expect(
        fetchOrderBook('Zerodha', {jwtToken: null}),
      ).rejects.toThrow('Missing jwtToken');
    });
  });

  // ─── fetchOrderBook - Response Normalization ───

  describe('fetchOrderBook - response normalization', () => {
    test('normalizes direct array response', async () => {
      axios.post.mockResolvedValueOnce({
        data: [
          {order_id: 'ORD-1', tradingsymbol: 'RELIANCE', exchange: 'NSE', transaction_type: 'BUY', quantity: 10, status: 'COMPLETE'},
        ],
      });

      const orders = await fetchOrderBook('Zerodha', {jwtToken: 'token'});
      expect(orders).toHaveLength(1);
      expect(orders[0].orderId).toBe('ORD-1');
      expect(orders[0].symbol).toBe('RELIANCE');
      expect(orders[0].normalizedStatus).toBe('completed');
    });

    test('normalizes nested data.orders response', async () => {
      axios.post.mockResolvedValueOnce({
        data: {orders: [{orderId: 'ORD-2', tradingSymbol: 'TCS', status: 'OPEN'}]},
      });

      const orders = await fetchOrderBook('Angel One', {jwtToken: 'token'});
      expect(orders).toHaveLength(1);
      expect(orders[0].orderId).toBe('ORD-2');
    });

    test('normalizes nested data.data response', async () => {
      axios.post.mockResolvedValueOnce({
        data: {data: [{order_id: 'ORD-3', status: 'REJECTED'}]},
      });

      const orders = await fetchOrderBook('Dhan', {jwtToken: 'token', clientCode: 'CC'});
      expect(orders).toHaveLength(1);
    });

    test('normalizes nested data.orderBook response', async () => {
      axios.post.mockResolvedValueOnce({
        data: {orderBook: [{orderId: 'ORD-4', status: 'OPEN'}]},
      });

      const orders = await fetchOrderBook('Fyers', {jwtToken: 'token'});
      expect(orders).toHaveLength(1);
    });

    test('detects token expiry in response', async () => {
      axios.post.mockResolvedValueOnce({
        data: {warning: {type: 'TOKEN_EXPIRED'}},
      });

      const result = await fetchOrderBook('Zerodha', {jwtToken: 'expired'});
      expect(result.tokenExpired).toBe(true);
    });

    test('detects brokerConnected=false as token expiry', async () => {
      axios.post.mockResolvedValueOnce({
        data: {data: {brokerConnected: false}},
      });

      const result = await fetchOrderBook('Angel One', {jwtToken: 'token'});
      expect(result.tokenExpired).toBe(true);
    });
  });

  // ─── fetchPendingOrders ───

  describe('fetchPendingOrders', () => {
    test('filters only pending orders', async () => {
      axios.post.mockResolvedValueOnce({
        data: [
          {order_id: '1', status: 'OPEN', tradingsymbol: 'A', quantity: 1},
          {order_id: '2', status: 'COMPLETE', tradingsymbol: 'B', quantity: 2},
          {order_id: '3', status: 'TRIGGER_PENDING', tradingsymbol: 'C', quantity: 3},
        ],
      });

      const pending = await fetchPendingOrders('Zerodha', {jwtToken: 'token'});
      expect(pending.length).toBe(2); // OPEN + TRIGGER_PENDING
    });
  });

  // ─── cancelOrder ───

  describe('cancelOrder', () => {
    test('calls correct cancel endpoint for Zerodha', async () => {
      axios.post.mockResolvedValueOnce({data: {success: true}});

      const result = await cancelOrder('Zerodha', {jwtToken: 'token'}, 'ORD-1');
      expect(result.success).toBe(true);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}zerodha/cancel-order`);
    });

    test('handles cancel failure gracefully', async () => {
      axios.post.mockRejectedValueOnce(new Error('Cancel failed'));

      const result = await cancelOrder('Zerodha', {jwtToken: 'token'}, 'ORD-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancel failed');
    });

    test('IIFL cancel throws unavailable', async () => {
      const result = await cancelOrder('IIFL Securities', {}, 'ORD-1');
      expect(result.success).toBe(false);
    });
  });

  // ─── modifyOrder ───

  describe('modifyOrder', () => {
    test('calls modify endpoint for Angel One', async () => {
      axios.post.mockResolvedValueOnce({data: {success: true}});

      const result = await modifyOrder(
        'Angel One',
        {jwtToken: 'token'},
        'ORD-1',
        {price: 100, quantity: 5},
      );
      expect(result.success).toBe(true);
      expect(axios.post.mock.calls[0][0]).toBe(`${server.ccxtServer.baseUrl}angelone/modify-order`);
    });

    test('Kotak modify throws not-supported error', async () => {
      const result = await modifyOrder('Kotak', {jwtToken: 'token'}, 'ORD-1', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported for Kotak');
    });

    test('unsupported broker modify returns error', async () => {
      const result = await modifyOrder('Groww', {jwtToken: 'token'}, 'ORD-1', {});
      expect(result.success).toBe(false);
    });
  });

  // ─── findPendingOrdersForSymbol ───

  describe('findPendingOrdersForSymbol', () => {
    const orders = [
      {symbol: 'RELIANCE', normalizedStatus: 'pending', transactionType: 'BUY'},
      {symbol: 'RELIANCE', normalizedStatus: 'pending', transactionType: 'SELL'},
      {symbol: 'RELIANCE', normalizedStatus: 'completed', transactionType: 'BUY'},
      {symbol: 'TCS', normalizedStatus: 'pending', transactionType: 'BUY'},
    ];

    test('finds all pending orders for symbol', () => {
      const result = findPendingOrdersForSymbol(orders, 'RELIANCE');
      expect(result).toHaveLength(2);
    });

    test('filters by transaction type', () => {
      const result = findPendingOrdersForSymbol(orders, 'RELIANCE', 'BUY');
      expect(result).toHaveLength(1);
      expect(result[0].transactionType).toBe('BUY');
    });

    test('case insensitive symbol matching', () => {
      const result = findPendingOrdersForSymbol(orders, 'reliance');
      expect(result).toHaveLength(2);
    });

    test('returns empty for non-matching symbol', () => {
      const result = findPendingOrdersForSymbol(orders, 'INFY');
      expect(result).toHaveLength(0);
    });
  });
});
