jest.mock('axios', () => ({post: jest.fn()}));
jest.mock('react-native-config', () => ({
  REACT_APP_AQ_KEYS: 'test-key',
  REACT_APP_AQ_SECRET: 'test-secret',
  REACT_APP_ASYNC_ORDER_EXECUTION_V1: '',
}));
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'encrypted-key'),
}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {server: {baseUrl: 'https://server.alphaquark.in/'}},
}));
jest.mock('../../utils/variantHelper', () => ({
  getTenantSubdomain: jest.fn(() => 'alphab2b'),
}));
jest.mock('../../utils/customerAuthHeaders', () => ({
  getCustomerAuthHeaders: jest.fn(async () => ({Authorization: 'Bearer token'})),
}));

const mockStorage = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async key => mockStorage.get(key) || null),
  setItem: jest.fn(async (key, value) => mockStorage.set(key, value)),
  removeItem: jest.fn(async key => mockStorage.delete(key)),
  getAllKeys: jest.fn(async () => [...mockStorage.keys()]),
  multiGet: jest.fn(async keys => keys.map(key => [key, mockStorage.get(key) || null])),
}));

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  durableOrderExecutionEnabled,
  isDurableDirectOrderEligible,
  reportDurableOrderOutcome,
  submitDurableOrder,
} from '../../services/DurableOrderService';

const configData = {config: {asyncOrderExecutionV1: true}};
const payload = (changes = {}) => ({
  user_email: 'customer@example.com',
  user_broker: 'Dhan',
  requestId: 'request-1',
  jwtToken: 'must-not-persist',
  trades: [{
    tradeId: 'trade-1', tradingSymbol: 'ABC-EQ', transactionType: 'BUY',
    quantity: 2, orderType: 'MARKET',
  }],
  ...changes,
});

describe('DurableOrderService', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  test('is default-off and only admits direct normal or basket trades', () => {
    expect(durableOrderExecutionEnabled({config: {}})).toBe(false);
    expect(durableOrderExecutionEnabled(configData)).toBe(true);
    expect(isDurableDirectOrderEligible(payload())).toBe(true);
    expect(isDurableDirectOrderEligible(payload({basketId: 'basket-1'}))).toBe(true);
    expect(isDurableDirectOrderEligible(payload({model_id: 'model-1'}))).toBe(false);
    expect(isDurableDirectOrderEligible(payload({publisher: true}))).toBe(false);
    expect(isDurableDirectOrderEligible(payload({
      trades: [{...payload().trades[0], orderType: 'GTT'}],
    }))).toBe(false);
  });

  test('accepts once, polls by job id, and returns terminal results', async () => {
    axios.post
      .mockResolvedValueOnce({data: {job_id: 'job-1', state: 'queued'}})
      .mockResolvedValueOnce({data: {
        job_id: 'job-1', state: 'completed',
        result: {results: [{orderId: 'broker-1'}]},
      }});
    const result = await submitDurableOrder(payload(), configData, {
      pollAttempts: 2, delayMs: 0,
    });
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[1][1]).toEqual({jobId: 'job-1'});
    expect(result.results[0].orderId).toBe('broker-1');
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  test('recovers unknown acceptance by requestId without resubmitting', async () => {
    axios.post
      .mockResolvedValueOnce({data: {
        error: 'durable_acceptance_unknown', state: 'acceptance_unknown',
      }})
      .mockResolvedValueOnce({data: {job_id: 'job-1', state: 'completed'}});
    const result = await submitDurableOrder(payload(), configData, {
      recoveryAttempts: 1, pollAttempts: 1, delayMs: 0,
    });
    expect(result.state).toBe('completed');
    expect(axios.post.mock.calls.filter(call =>
      call[0].endsWith('/order-place-async-v1'),
    )).toHaveLength(1);
    expect(axios.post.mock.calls[1][1]).toEqual({requestId: 'request-1'});
  });

  test('keeps only compact recovery identity after a network ambiguity', async () => {
    axios.post.mockRejectedValueOnce({message: 'Network Error'});
    axios.post.mockRejectedValueOnce({message: 'Still unavailable'});
    const result = await submitDurableOrder(payload(), configData, {
      recoveryAttempts: 1, pollAttempts: 1, delayMs: 0,
    });
    expect(result.accepted).toBeNull();
    const stored = [...mockStorage.values()].join(' ');
    expect(stored).toContain('request-1');
    expect(stored).not.toContain('must-not-persist');
    expect(stored).not.toContain('jwtToken');
  });

  test('returns a recovered terminal result without placing again', async () => {
    await AsyncStorage.setItem('@aq/durable-order/v1/old-request', JSON.stringify({
      requestId: 'old-request', jobId: 'job-old', state: 'queued',
      fingerprint: JSON.stringify({
        user: 'customer@example.com', broker: 'dhan', basketId: '',
        trades: [{
          id: 'trade-1', symbol: 'ABC-EQ', exchange: '', side: 'BUY',
          quantity: 2, orderType: 'MARKET', product: '', price: null,
        }],
      }),
    }));
    axios.post.mockResolvedValueOnce({data: {
      job_id: 'job-old', state: 'completed',
      result: {results: [{orderId: 'broker-old'}]},
    }});
    const result = await submitDurableOrder(payload(), configData, {
      pollAttempts: 1, delayMs: 0,
    });
    expect(result.results[0].orderId).toBe('broker-old');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][0]).toContain('/status');
  });

  test('sends customer evidence to review without authorizing retry', async () => {
    axios.post.mockResolvedValueOnce({data: {status: 0, customerReconciliation: {
      verificationState: 'pending_broker_verification', retryAllowed: false,
    }}});
    await reportDurableOrderOutcome({
      reportId: 'report-1', jobId: 'job-1', reportedOutcome: 'filled',
      brokerOrderId: 'not-customer-input', tradeId: 'not-customer-input',
      reportedAveragePrice: 100,
    }, configData);
    expect(axios.post.mock.calls[0][0]).toContain('/reconciliation-report');
    expect(axios.post.mock.calls[0][1].reportId).toBe('report-1');
    expect(axios.post.mock.calls[0][1]).not.toHaveProperty('brokerOrderId');
    expect(axios.post.mock.calls[0][1]).not.toHaveProperty('tradeId');
    expect(axios.post.mock.calls[0][1].legId).toBe('not-customer-input');
    expect(axios.post.mock.calls[0][1].reportedAveragePrice).toBe(100);
  });
});
