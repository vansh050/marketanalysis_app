/**
 * Kyzen QA 2026-10-15: a tester pasted the Upstox TOTP secret in Base64 form
 * (mixed case, trailing "="). It is accepted by converting to Base32; normal
 * Base32 keys and broker API secrets must be left alone.
 */
jest.mock('react-native-keychain', () => ({ACCESSIBLE: {}, ACCESS_CONTROL: {}, AUTHENTICATION_TYPE: {}}));
const {normalizeDeviceTotpSeedInput, generateDeviceTotpFromSeed} = require('../../services/DeviceTotpVault');
const {explainInvalidSeed} = require('../../utils/totpKeyCheck');

// RFC 6238 test secret "12345678901234567890" (20 bytes).
const RFC_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_BASE64 = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=';

test('a Base64 copy of a 20-byte secret becomes its Base32 key', () => {
  expect(normalizeDeviceTotpSeedInput(RFC_BASE64)).toBe(RFC_BASE32);
  expect(generateDeviceTotpFromSeed(RFC_BASE64)).toBe(generateDeviceTotpFromSeed(RFC_BASE32));
});

test('Base32 keys are unchanged, in any case and with padding', () => {
  expect(normalizeDeviceTotpSeedInput('jbswy3dpehpk3pxp')).toBe('JBSWY3DPEHPK3PXP');
  expect(normalizeDeviceTotpSeedInput('JBSWY3DPEHPK3PXP====')).toBe('JBSWY3DPEHPK3PXP====');
  expect(normalizeDeviceTotpSeedInput(RFC_BASE32)).toBe(RFC_BASE32);
});

test('broker API secrets and UUID keys are not converted', () => {
  expect(normalizeDeviceTotpSeedInput('urx7vq3b8z')).toBe('URX7VQ3B8Z');
  expect(normalizeDeviceTotpSeedInput('910abbc7-0eb0-41c5-92d2-acd7db7e74ff')).toBe('910ABBC70EB041C592D2ACD7DB7E74FF');
  expect(() => generateDeviceTotpFromSeed('urx7vq3b8z')).toThrow();
});

test('Base64 that is not a TOTP-secret length gets its own message, not "API Secret"', () => {
  const msg = explainInvalidSeed('QWxwaGFRdWFyaw==', 'Upstox'); // 9 bytes
  expect(msg).toMatch(/Base64 copy/);
  expect(msg).not.toMatch(/API Secret/);
});
