const creds = require('../loadCredentials');
const {generateJWT, generateTOTP, getHeaders} = require('../generateAuth');
const api = require('../apiHelpers');

// Auto-skip if credentials not provided
const HAS_CREDS = !!(creds.aq.apiKey && creds.motilal.apiKey);
const describeIf = HAS_CREDS ? describe : describe.skip;

describeIf('Motilal Oswal Broker Integration', () => {
  let headers;

  beforeAll(() => {
    const jwt = generateJWT(creds.aq.apiKey, creds.aq.apiSecret);
    headers = getHeaders(creds.aq.subdomain, jwt);
  });

  test('verify broker connection status', async () => {
    const user = await api.getUserDetails(creds.aq.testEmail, headers);
    expect(user).toBeDefined();
  });

  test('fetch holdings', async () => {
    const result = await api.getHoldings('motilal-oswal', {
      clientCode: creds.motilal.clientCode,
      apiKey: creds.motilal.apiKey,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch funds/balance', async () => {
    const result = await api.getFunds('motilal-oswal', {
      clientCode: creds.motilal.clientCode,
      apiKey: creds.motilal.apiKey,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch order book', async () => {
    const result = await api.getOrderBook('motilal-oswal', {
      clientCode: creds.motilal.clientCode,
      apiKey: creds.motilal.apiKey,
    }, headers);
    expect(result).toBeDefined();
  });

  test('TOTP generation', () => {
    if (!creds.motilal.totpSecret) return;
    const totp = generateTOTP(creds.motilal.totpSecret);
    expect(totp).toMatch(/^\d{6}$/);
  });
});
