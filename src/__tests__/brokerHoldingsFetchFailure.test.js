/**
 * 2026-10-13 (Kyzen): an expired Upstox login returned status 1 with all-zero
 * totals; Home showed "No holdings in your Upstox account yet" for an account
 * holding Rs 3.8 lakh, and the zeros overwrote the cached summary.
 */
jest.mock('axios', () => ({post: jest.fn()}));
jest.mock('react-native-config', () => ({}));
jest.mock('../utils/SecurityTokenManager', () => ({generateToken: () => 'token'}));

const axios = require('axios');
const {fetchBrokerAllHoldings} = require('../FunctionCall/fetchBrokerAllHoldings');
const fs = require('fs');
const path = require('path');

test('a broker error reply is reported as a failure, not as zero holdings', async () => {
  axios.post.mockResolvedValueOnce({data: {status: 1, message: 'Invalid token used to access API', totalHoldings: {totalholdingvalue: 0, totalinvvalue: 0}}});
  const result = await fetchBrokerAllHoldings('Upstox', 'c', 'k', 'jwt', 's', '', '', '', {}, 'a@b.c');
  expect(result).toEqual({fetchFailed: true, message: 'Invalid token used to access API', lastKnown: null});
});

test('a real empty account still returns zero totals', async () => {
  axios.post.mockResolvedValueOnce({data: {status: 0, totalHoldings: {totalholdingvalue: 0, totalinvvalue: 0}, holding: []}});
  const result = await fetchBrokerAllHoldings('Upstox', 'c', 'k', 'jwt', 's', '', '', '', {}, 'a@b.c');
  expect(result.fetchFailed).toBeUndefined();
  expect(result.totalholdingvalue).toBe(0);
});

test('a failed fetch is not cached and is flagged to the Home summary', () => {
  const trade = fs.readFileSync(path.join(__dirname, '..', 'screens', 'TradeContext.js'), 'utf8');
  const summary = fs.readFileSync(path.join(__dirname, '..', 'screens', 'Home', 'hooks', 'useHomeMarketSummary.js'), 'utf8');
  const i = trade.indexOf('if (allHoldings?.fetchFailed) {');
  expect(i).toBeGreaterThan(-1);
  expect(trade.indexOf('saveBrokerHoldingsSummary({', i)).toBeGreaterThan(trade.indexOf('return null;', i));
  expect(summary).toContain('failed: true');
  // last good figures are shown, stamped with when they were fetched
  expect(trade).toContain('staleAsOf: best.asOf');
  expect(summary).toContain('staleAsOf: h.staleAsOf');
});

test('the server last-good copy is passed through and used when the phone has none', async () => {
  axios.post.mockResolvedValueOnce({data: {status: 1, message: 'Invalid token used to access API', lastKnown: {totalholdingvalue: 386674, totalinvvalue: 408953, asOf: '2026-10-13T08:45:00+00:00'}}});
  const result = await fetchBrokerAllHoldings('Upstox', 'c', 'k', 'jwt', 's', '', '', '', {}, 'a@b.c');
  expect(result.lastKnown.totalholdingvalue).toBe(386674);
  const trade = fs.readFileSync(path.join(__dirname, '..', 'screens', 'TradeContext.js'), 'utf8');
  expect(trade).toContain('const best = local || server;');
});
