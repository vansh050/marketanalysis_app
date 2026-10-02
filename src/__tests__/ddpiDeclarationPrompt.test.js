// Plan item 4 (2026-10-01): ask once per connected broker about DDPI; never a gate.
jest.mock('axios', () => ({put: jest.fn(), get: jest.fn(() => Promise.reject(new Error('x')))}));
jest.mock('../utils/SecurityTokenManager', () => ({generateToken: () => 'tok'}));
jest.mock('../utils/variantHelper', () => ({getTenantSubdomain: () => 'prod'}));
jest.mock('../screens/TradeContext', () => ({useTrade: () => ({})}));
const fs = require('fs');
const path = require('path');
const {brokerNeedingDdpiQuestion} = require('../components/SellAuth/DdpiDeclarationPrompt');

const user = (broker, entry = {}) => ({
  email: 'c@example.com',
  user_broker: broker,
  connected_brokers: [{broker, status: 'connected', ...entry}],
});

test('asks for a connected broker without an answer', () => {
  expect(brokerNeedingDdpiQuestion(user('Upstox'))).toBe('Upstox');
});

test('does not ask when answered, disconnected, Zerodha or DummyBroker', () => {
  expect(brokerNeedingDdpiQuestion(user('Upstox', {ddpi_self_declared: 'no'}))).toBeNull();
  expect(brokerNeedingDdpiQuestion(user('Upstox', {status: 'expired'}))).toBeNull();
  expect(brokerNeedingDdpiQuestion(user('Zerodha'))).toBeNull();
  expect(brokerNeedingDdpiQuestion(user('DummyBroker'))).toBeNull();
  expect(brokerNeedingDdpiQuestion(null)).toBeNull();
});

test('is mounted at the app root and never writes authorization flags', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'App.js'), 'utf8');
  expect((app.match(/<DdpiDeclarationPrompt \/>/g) || []).length).toBe(2);
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'SellAuth', 'DdpiDeclarationPrompt.js'),
    'utf8',
  );
  expect(src).toContain('api/sell-auth/ddpi-declaration');
  expect(src).not.toMatch(/is_authorized_for_sell|update-edis-status/);
});
