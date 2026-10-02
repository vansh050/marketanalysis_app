jest.mock('axios');
jest.mock('react-native-config', () => ({
  REACT_APP_AQ_KEYS: 'test-key',
  REACT_APP_AQ_SECRET: 'test-secret',
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
jest.mock('../../utils/variantHelper', () => ({
  getTenantSubdomain: configData =>
    configData?.config?.REACT_APP_HEADER_NAME ||
    configData?.REACT_APP_HEADER_NAME ||
    configData?.subdomain ||
    'markup',
  getAdvisorSubdomain: jest.fn(() => 'markup'),
}));
jest.mock('../../utils/customerAuthHeaders', () => ({
  getCustomerAuthHeaders: jest.fn(async () => ({
    Authorization: 'Bearer firebase-token',
  })),
}));
jest.mock('../../services/DurableOrderService', () => ({
  durableOrderExecutionEnabled: jest.fn(() => false),
  isDurableDirectOrderEligible: jest.fn(() => true),
  submitDurableOrder: jest.fn(),
}));

import axios from 'axios';
import {
  cancelPendingBasketOrder,
  getBrokerOrderStatusSlug,
  placeOrders,
  refreshSingleOrderStatus,
} from '../../services/OrderService';
import {
  durableOrderExecutionEnabled,
  submitDurableOrder,
} from '../../services/DurableOrderService';

describe('OrderService single-order status refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({data: {orderStatus: 'COMPLETE'}});
  });

  test('routes DefinEdge through its v2 status endpoint', () => {
    expect(getBrokerOrderStatusSlug('DefinEdge Securities')).toBe('definedge');
  });

  test('sends customer identity and the Markup tenant header', async () => {
    await expect(
      refreshSingleOrderStatus(
        'DefinEdge Securities',
        'customer@example.com',
        'order-123',
      ),
    ).resolves.toEqual({orderStatus: 'COMPLETE'});

    expect(axios.post).toHaveBeenCalledWith(
      'https://ccxtprod.alphaquark.in/definedge/v2/single-order-status',
      {user_email: 'customer@example.com', orderId: 'order-123'},
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': 'markup',
          'aq-encrypted-key': 'mock-encrypted-key',
        },
        timeout: 30000,
      },
    );
  });

  test('cancels through the durable mutation boundary with exact identity', async () => {
    axios.post.mockResolvedValueOnce({
      data: {terminal: false, mutationState: 'cancel_requested'},
    });
    await expect(cancelPendingBasketOrder({
      broker: 'Zerodha',
      userEmail: 'customer@example.com',
      basketId: 'basket-1',
      mutationId: 'mobile-basket-cancel-basket-1-leg-1-order-123',
      order: {
        orderId: 'order-123',
        tradeId: 'leg-1',
        Symbol: 'ABC-EQ',
        Exchange: 'NSE',
      },
    })).resolves.toEqual({
      terminal: false,
      mutationState: 'cancel_requested',
    });

    expect(axios.post).toHaveBeenLastCalledWith(
      'https://ccxtprod.alphaquark.in/orders/mutate',
      expect.objectContaining({
        action: 'cancel',
        orderId: 'order-123',
        tradeId: 'leg-1',
        basketId: 'basket-1',
      }),
      expect.objectContaining({timeout: 30000}),
    );
  });

  test('refuses a basket cancellation without exact basket-leg identity', async () => {
    await expect(cancelPendingBasketOrder({
      broker: 'Zerodha',
      userEmail: 'customer@example.com',
      basketId: 'basket-1',
      mutationId: 'missing-trade-id',
      order: {orderId: 'order-123'},
    })).rejects.toThrow('basket ID, trade ID, order ID');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('routes an enabled eligible direct order only to durable execution', async () => {
    durableOrderExecutionEnabled.mockReturnValueOnce(true);
    submitDurableOrder.mockResolvedValueOnce({state: 'queued', results: []});
    const order = {
      user_email: 'customer@example.com',
      user_broker: 'Dhan',
      trades: [{tradeId: 'trade-1', quantity: 1, transactionType: 'BUY'}],
    };

    await expect(placeOrders(order, {config: {asyncOrderExecutionV1: true}}))
      .resolves.toMatchObject({state: 'queued'});
    expect(submitDurableOrder).toHaveBeenCalledTimes(1);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
