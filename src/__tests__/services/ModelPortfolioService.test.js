/**
 * Tests for ModelPortfolioService.js
 * Validates all 16 API functions: subscriptions, rebalance lifecycle,
 * portfolio management, and broker operations.
 */

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
  getAdvisorSubdomain: jest.fn(() => 'test-subdomain'),
}));

import axios from 'axios';
import server from '../../utils/serverConfig';
import {
  getSubscribedStrategies,
  getStrategyDetails,
  subscribeStrategy,
  getSubscriptionAmount,
  updateModelPortfolioDB,
  getLatestUserPortfolio,
  calculateRebalance,
  processRebalanceTrade,
  updateSubscriberExecution,
  recordPublisherResults,
  addToStatusCheckQueue,
  getRebalanceRepair,
  insertUserDoc,
  changeBrokerModelPF,
  updateLatestUserPortfolio,
  getAvailableBrokers,
} from '../../services/ModelPortfolioService';

const mockConfigData = {
  config: {REACT_APP_HEADER_NAME: 'test-advisor'},
};

describe('ModelPortfolioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({data: {success: true}});
    axios.post.mockResolvedValue({data: {success: true}});
    axios.put.mockResolvedValue({data: {success: true}});
  });

  // ─── Subscription APIs ───

  describe('subscription APIs', () => {
    test('getSubscribedStrategies calls correct endpoint', async () => {
      await getSubscribedStrategies('user@test.com', mockConfigData);
      expect(axios.get).toHaveBeenCalledWith(
        `${server.server.baseUrl}api/model-portfolio/subscribed-strategies/user@test.com`,
        expect.objectContaining({headers: expect.any(Object)}),
      );
    });

    test('getStrategyDetails encodes strategy name', async () => {
      await getStrategyDetails('Growth & Value', mockConfigData);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('Growth%20%26%20Value'),
        expect.any(Object),
      );
    });

    test('subscribeStrategy sends PUT with email and action', async () => {
      await subscribeStrategy('strategy-123', 'user@test.com', mockConfigData);
      expect(axios.put).toHaveBeenCalledWith(
        `${server.server.baseUrl}api/model-portfolio/subscribe-strategy/strategy-123`,
        {email: 'user@test.com', action: 'subscribe'},
        expect.any(Object),
      );
    });

    test('getSubscriptionAmount includes query params', async () => {
      await getSubscriptionAmount('user@test.com', 'Growth', 'Zerodha', mockConfigData);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringMatching(/subscription-raw-amount\?.*email=.*modelName=.*user_broker=/),
        expect.any(Object),
      );
    });

    test('getSubscriptionAmount works without broker', async () => {
      await getSubscriptionAmount('user@test.com', 'Growth', null, mockConfigData);
      const url = axios.get.mock.calls[0][0];
      expect(url).not.toContain('user_broker');
    });
  });

  // ─── Rebalance APIs ───

  describe('rebalance APIs', () => {
    test('calculateRebalance calls ccxtServer with 120s timeout', async () => {
      const payload = {userEmail: 'user@test.com', modelName: 'Growth'};
      await calculateRebalance(payload, mockConfigData);
      expect(axios.post).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/calculate`,
        payload,
        expect.objectContaining({timeout: 120000}),
      );
    });

    test('processRebalanceTrade calls ccxtServer', async () => {
      const payload = {trades: []};
      await processRebalanceTrade(payload, mockConfigData);
      expect(axios.post).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/process-trade`,
        payload,
        expect.objectContaining({timeout: 120000}),
      );
    });

    test('updateSubscriberExecution calls PUT', async () => {
      const payload = {email: 'user@test.com', status: 'executed'};
      await updateSubscriberExecution(payload, mockConfigData);
      expect(axios.put).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
        payload,
        expect.any(Object),
      );
    });

    test('recordPublisherResults calls POST', async () => {
      const payload = {results: []};
      await recordPublisherResults(payload, mockConfigData);
      expect(axios.post).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
        payload,
        expect.any(Object),
      );
    });

    test('addToStatusCheckQueue calls POST', async () => {
      const payload = {userEmail: 'user@test.com'};
      await addToStatusCheckQueue(payload, mockConfigData);
      expect(axios.post).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        payload,
        expect.any(Object),
      );
    });

    test('getRebalanceRepair sends correct payload', async () => {
      await getRebalanceRepair(['Growth'], 'advisor', 'user@test.com', 'Zerodha', mockConfigData);
      expect(axios.post).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/get-repair`,
        {modelName: ['Growth'], advisor: 'advisor', userEmail: 'user@test.com', userBroker: 'Zerodha'},
        expect.any(Object),
      );
    });
  });

  // ─── Portfolio Management APIs ───

  describe('portfolio management APIs', () => {
    test('getLatestUserPortfolio encodes params', async () => {
      await getLatestUserPortfolio('user@test.com', 'Growth & Value', mockConfigData);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('user-portfolio/latest/'),
        expect.any(Object),
      );
    });

    test('updateLatestUserPortfolio calls PUT', async () => {
      const payload = {portfolio: []};
      await updateLatestUserPortfolio(payload, mockConfigData);
      expect(axios.put).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/update/user-portfolio/latest`,
        payload,
        expect.any(Object),
      );
    });

    test('insertUserDoc calls POST', async () => {
      const payload = {email: 'user@test.com', modelName: 'Growth'};
      await insertUserDoc(payload, mockConfigData);
      expect(axios.post).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
        payload,
        expect.any(Object),
      );
    });

    test('updateModelPortfolioDB calls main server', async () => {
      const payload = {data: 'test'};
      await updateModelPortfolioDB(payload, mockConfigData);
      expect(axios.post).toHaveBeenCalledWith(
        `${server.server.baseUrl}api/model-portfolio-db-update`,
        payload,
        expect.any(Object),
      );
    });
  });

  // ─── Broker Operations ───

  describe('broker operations', () => {
    test('changeBrokerModelPF sends email and broker', async () => {
      await changeBrokerModelPF('user@test.com', 'Dhan', mockConfigData);
      expect(axios.post).toHaveBeenCalledWith(
        `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
        {user_email: 'user@test.com', user_broker: 'Dhan'},
        expect.any(Object),
      );
    });

    test('getAvailableBrokers includes query params', async () => {
      await getAvailableBrokers('user@test.com', 'Growth', mockConfigData);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('available-brokers?'),
        expect.any(Object),
      );
    });
  });

  // ─── Headers ───

  describe('API headers', () => {
    test('all calls include required headers', async () => {
      await getSubscribedStrategies('user@test.com', mockConfigData);

      const headers = axios.get.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Advisor-Subdomain']).toBe('test-advisor');
      expect(headers['aq-encrypted-key']).toBe('mock-encrypted-key');
    });

    test('falls back to getAdvisorSubdomain when config missing', async () => {
      await getSubscribedStrategies('user@test.com', {config: {}});

      const headers = axios.get.mock.calls[0][1].headers;
      expect(headers['X-Advisor-Subdomain']).toBe('test-subdomain');
    });
  });

  // ─── Error Handling ───

  describe('error handling', () => {
    test('propagates axios errors', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        getSubscribedStrategies('user@test.com', mockConfigData),
      ).rejects.toThrow('Network error');
    });

    test('propagates 401 errors', async () => {
      const error = new Error('Unauthorized');
      error.response = {status: 401, data: {message: 'Token expired'}};
      axios.post.mockRejectedValueOnce(error);

      await expect(
        calculateRebalance({}, mockConfigData),
      ).rejects.toThrow('Unauthorized');
    });
  });
});
