/**
 * 2026-10-13 (Kyzen): Upstox rejected the saved login ("Invalid token used to
 * access API") before its stored expiry, and Broker connection still said
 * "Upstox connected" with a green tick.
 */
// The validator's import chain reaches executionBundleSafety, which imports
// Revopush (untransformed ESM in node_modules). The test only needs the
// classifier, so stub the OTA client and the token signer (pure-jwt).
jest.mock('@revopush/react-native-code-push', () => ({
  InstallMode: {ON_NEXT_RESTART: 'ON_NEXT_RESTART'},
  checkForUpdate: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../utils/SecurityTokenManager', () => ({generateToken: () => 'tok'}));
import {classifyFundsResponse} from '../utils/brokerSessionValidator';

const fs = require('fs');
const path = require('path');

test('an invalid-token funds reply classifies as an expired session', () => {
  const r = classifyFundsResponse({status: 1, message: 'Invalid token used to access API'}, 'connected', 'Upstox');
  expect(r.reason).toBe('TOKEN_EXPIRED');
});

test('the broker screen treats a rejected session as expired in both designs', () => {
  const container = fs.readFileSync(path.join(__dirname, '..', 'screens', 'Home', 'SubscriptionScreen.js'), 'utf8');
  const design = fs.readFileSync(path.join(__dirname, '..', '..', 'designs', 'default', 'screens', 'SubscriptionScreen.js'), 'utf8');
  expect(container).toMatch(/fundsError &&\s*classifyFundsResponse\(funds, brokerStatus, broker\)\.reason === 'TOKEN_EXPIRED'/);
  expect(container).toContain('brokerSessionRejected,');
  expect(design).toContain('isBrokerSessionExpired(primaryEntry) || brokerSessionRejected');
});
