/**
 * 2026-09-22: a server refusal before dispatch (MARKET_CLOSED, expired
 * session, drifted plan) comes back from the SDK as `notSent`. It is not a
 * reconciliation and IS safe to retry — the customer must read why.
 */
jest.mock('axios');
jest.mock('react-native-config', () => ({
  REACT_APP_AQ_KEYS: 'test-key',
  REACT_APP_AQ_SECRET: 'test-secret',
  REACT_APP_USE_SDK_EXECUTE_ADVICE: 'true',
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
  getTenantSubdomain: () => 'test-subdomain',
  getAdvisorSubdomain: jest.fn(() => 'test-subdomain'),
}));

import {processRebalanceTrade} from '../../services/ModelPortfolioService';

const payload = {
  model_id: 'm1', modelName: 'test', user_broker: 'Upstox', unique_id: 'uid-1',
  trades: [{symbol: 'BRIDGESE', transactionType: 'BUY', quantity: 10}],
};

describe('processRebalanceTrade with a not-sent SDK result', () => {
  it('is retryable, carries the server sentence, and is not a reconciliation', async () => {
    const sdkClient = {
      executeAdvice: jest.fn().mockResolvedValue({
        clientAdviceId: 'uid-1', status: 'not_sent', rows: [], executionState: 'paused',
        notSent: true, code: 'MARKET_CLOSED',
        recovery: {reason: 'market_closed', message: 'The market is closed. No rebalance orders were sent.', safeToRetryPlacement: true},
      }),
    };
    const result = await processRebalanceTrade(payload, {}, sdkClient);
    expect(sdkClient.executeAdvice).toHaveBeenCalledTimes(1);
    expect(result.notSent).toBe(true);
    expect(result.retryAllowed).toBe(true);
    expect(result.reconciliationRequired).toBe(false);
    expect(result.message).toMatch(/^The market is closed/);
    expect(result.code).toBe('MARKET_CLOSED');
  });

  it('a genuinely paused result stays a reconciliation', async () => {
    const sdkClient = {
      executeAdvice: jest.fn().mockResolvedValue({
        clientAdviceId: 'uid-1', status: 'queued', rows: [], executionState: 'paused',
        recovery: {reason: 'active_intent', message: 'x', safeToRetryPlacement: false},
      }),
    };
    const result = await processRebalanceTrade(payload, {}, sdkClient);
    expect(result.reconciliationRequired).toBe(true);
    expect(result.retryAllowed).toBe(false);
    expect(result.notSent).toBe(false);
  });
});
