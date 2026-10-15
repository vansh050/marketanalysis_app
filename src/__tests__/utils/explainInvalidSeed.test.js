jest.mock('react-native-keychain', () => ({ACCESSIBLE: {}, ACCESS_CONTROL: {}, AUTHENTICATION_TYPE: {}}));
const {explainInvalidSeed} = require('../../utils/totpKeyCheck');

describe('explainInvalidSeed (Kyzen QA 2026-10-15, Upstox)', () => {
  test('a 6-digit one-time code is named as such', () => {
    expect(explainInvalidSeed('152826', 'Upstox')).toMatch(/6-digit one-time code/);
  });
  test('an API Secret (has 0/1/8/9) is called out', () => {
    expect(explainInvalidSeed('a1b2c3d4e5f60789', 'Upstox')).toMatch(/0, 1, 8 or 9.*Upstox API Secret/);
  });
  test('other characters are called out', () => {
    expect(explainInvalidSeed('abcd_efgh!ijkl', 'Upstox')).toMatch(/characters a TOTP secret never has/);
  });
  test('an empty box asks for the secret', () => {
    expect(explainInvalidSeed('  ', 'Upstox')).toMatch(/^Paste the TOTP secret/);
  });
  test('never echoes the pasted value', () => {
    const secret = 'a1b2c3d4e5f60789';
    expect(explainInvalidSeed(secret, 'Upstox')).not.toContain(secret);
    expect(explainInvalidSeed(secret, 'Upstox')).not.toContain(secret.toUpperCase());
  });
});
