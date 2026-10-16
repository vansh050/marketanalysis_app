/**
 * Fyers reconnect sends the App ID, never the Fyers user ID in its place.
 * Current records store DB apiKey = App ID and clientCode = Fyers user ID;
 * the old mapping sent clientCode as the App ID and the backend rejected it
 * ("malformed appId (not -200)") on every first reconnect (Kyzen 2026-10-13).
 */
jest.mock('react-native-crypto-js', () => ({
  AES: {
    decrypt: (v) => ({toString: () => (String(v).startsWith('U2FsdGVk') ? String(v).slice(8) : '')}),
    encrypt: (v) => ({toString: () => 'U2FsdGVk' + v}),
  },
  enc: {Utf8: 'utf8'},
}));
const {getStoredBrokerCreds} = require('../utils/brokerCredentials');

const user = entry => ({connected_brokers: [{broker: 'Fyers', ...entry}]});

test('current layout: App ID from apiKey, user ID from clientCode', () => {
  const creds = getStoredBrokerCreds(user({apiKey: 'UMEG2NCP7W-200', clientCode: 'YR17597', secretKey: 'U2FsdGVksecret'}), 'Fyers');
  expect(creds).toMatchObject({appId: 'UMEG2NCP7W-200', fyersUserId: 'YR17597', apiKey: 'secret', secretKey: 'UMEG2NCP7W-200'});
});

test('encrypted App ID in apiKey is decrypted', () => {
  const creds = getStoredBrokerCreds(user({apiKey: 'U2FsdGVkABCD123-200', clientCode: 'YR17597', secretKey: 'U2FsdGVks'}), 'Fyers');
  expect(creds.appId).toBe('ABCD123-200');
});

test('legacy layout: App ID in clientCode still works', () => {
  const creds = getStoredBrokerCreds(user({clientCode: 'OLDAPP99-200', secretKey: 'U2FsdGVks'}), 'Fyers');
  expect(creds).toMatchObject({appId: 'OLDAPP99-200', fyersUserId: ''});
});

test('reconnect extras put the App ID in apiKey', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../components/BrokerConnectionModal/Phase3SdkBrokerModal.js'), 'utf8');
  expect(src).toContain('if (stored.appId) extras.apiKey = enc(stored.appId);');
  expect(src).toContain('const fyersClient = stored.fyersUserId || stored.clientCode;');
});
