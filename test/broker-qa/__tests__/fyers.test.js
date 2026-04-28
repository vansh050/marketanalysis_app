const creds = require('../loadCredentials');
const {generateJWT, generateTOTP, getHeaders} = require('../generateAuth');
const api = require('../apiHelpers');

// Auto-skip if credentials not provided
const HAS_CREDS = !!(creds.aq.apiKey && creds.fyers.accessToken);
const describeIf = HAS_CREDS ? describe : describe.skip;

describeIf('Fyers Broker Integration', () => {
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
    const result = await api.getHoldings('fyers', {
      appId: creds.fyers.appId,
      secretKey: creds.fyers.secretKey,
      accessToken: creds.fyers.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch funds/balance', async () => {
    const result = await api.getFunds('fyers', {
      appId: creds.fyers.appId,
      secretKey: creds.fyers.secretKey,
      accessToken: creds.fyers.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch order book', async () => {
    const result = await api.getOrderBook('fyers', {
      appId: creds.fyers.appId,
      secretKey: creds.fyers.secretKey,
      accessToken: creds.fyers.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('TOTP generation', () => {
    if (!creds.fyers.totpSecret) return;
    const totp = generateTOTP(creds.fyers.totpSecret);
    expect(totp).toMatch(/^\d{6}$/);
  });
});
