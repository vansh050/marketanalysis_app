/**
 * Fix for the orphan rows (prod/arulthakur, 2026-09-17).
 *
 * `update-reco-with-zerodha-model-pf` writes one TradeReco per leg BEFORE the
 * attempt is authorised, so a refused attempt leaves status-less rows that no
 * reconciler owns and the Orders screen renders as "Unknown". When the intent
 * is refused the app must void the rows it just wrote — but only on a
 * definitive refusal: an ambiguous outcome (timeout, 5xx) may mean the basket
 * still opens, which is the same rule `publisherBatchDispatch` applies past
 * `authorize()`.
 *
 * Record:
 * prod-alphaquark-github/docs/server_issues/2026-09-17-arul-zerodha-orders-unknown-orphan-rows.md
 */

const fs = require('fs');
const path = require('path');

jest.mock('react-native-config', () => ({REACT_APP_DOMAIN: 'https://example.test'}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {server: {baseUrl: 'https://server.example/'}},
}));
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'test-token'),
}));
jest.mock('../../utils/accountEmail', () => ({
  getAccountEmailAsync: jest.fn(async () => 'test@example.com'),
}));
jest.mock('../../utils/variantHelper', () => ({
  getTenantSubdomain: () => 'test',
  getAdvisorSubdomain: () => 'test',
}));
jest.mock('react-native', () => ({Alert: {alert: jest.fn()}}));
jest.mock('axios');

import axios from 'axios';
import {voidUnsentPublisherRecos} from '../../utils/brokerPublisher';

const legs = [
  {tradeId: '111111111111111', tradingSymbol: 'YESBANK-EQ'},
  {tradeId: '222222222222222', tradingSymbol: 'SWASTIVI'},
  {tradingSymbol: 'NO-TRADE-ID'},
];

const refused = {response: {status: 409}};

const call = (error, overrides = {}) =>
  voidUnsentPublisherRecos({legs, email: 'arul@example.com', headers: {h: '1'}, error, ...overrides});

describe('voidUnsentPublisherRecos', () => {
  beforeEach(() => {
    axios.post.mockReset();
    axios.post.mockResolvedValue({data: {data: {voided: 2}}});
  });

  test('voids the attempt rows when the intent is definitively refused', async () => {
    await expect(call(refused)).resolves.toBe(2);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = axios.post.mock.calls[0];
    expect(url).toContain('/api/zerodha/model-portfolio/void-reco-with-zerodha-model-pf');
    expect(body.tradeIds).toEqual(['111111111111111', '222222222222222']);
    expect(body.email).toBe('arul@example.com');
    expect(config.headers).toEqual({h: '1'});
  });

  test.each([
    ['a timeout', new Error('timeout of 30000ms exceeded')],
    ['a server error', {response: {status: 503}}],
    ['an unacknowledged response', {response: {status: 200}}],
    ['no error at all', undefined],
  ])('leaves the rows alone on %s', async (_label, error) => {
    await expect(call(error)).resolves.toBe(0);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('does nothing when no leg carries a tradeId', async () => {
    await expect(call(refused, {legs: [{tradingSymbol: 'X'}]})).resolves.toBe(0);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('never throws when the cleanup call itself fails', async () => {
    axios.post.mockRejectedValue(new Error('network down'));
    await expect(call(refused)).resolves.toBe(0);
  });
});

describe('publisher modals void the rows their refused attempt wrote', () => {
  const modals = [
    'AdviceScreenComponents/RebalanceModal.js',
    'ModelPortfolioComponents/MPReviewTradeModal.js',
    'ModelPortfolioComponents/UserStrategySubscribeModal.js',
  ];

  test.each(modals)('%s', name => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components', name),
      'utf8',
    );
    expect(source).toContain('voidUnsentPublisherRecos');
    // The void must target THIS attempt's legs and the signed-in customer.
    expect(source).toMatch(
      /voidUnsentPublisherRecos\(\{[\s\S]*?legs: activationLegs,[\s\S]*?email: userEmail,[\s\S]*?headers/m,
    );
  });
});
