const creds = require('../loadCredentials');
const {generateJWT, generateTOTP, getHeaders} = require('../generateAuth');
const api = require('../apiHelpers');

// Auto-skip if credentials not provided
const HAS_CREDS = !!(creds.aq.apiKey && creds.upstox.accessToken);
const describeIf = HAS_CREDS ? describe : describe.skip;

describeIf('Upstox Broker Integration', () => {
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
    const result = await api.getHoldings('upstox', {
      apiKey: creds.upstox.apiKey,
      apiSecret: creds.upstox.apiSecret,
      accessToken: creds.upstox.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch funds/balance', async () => {
    const result = await api.getFunds('upstox', {
      apiKey: creds.upstox.apiKey,
      apiSecret: creds.upstox.apiSecret,
      accessToken: creds.upstox.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch order book', async () => {
    const result = await api.getOrderBook('upstox', {
      apiKey: creds.upstox.apiKey,
      apiSecret: creds.upstox.apiSecret,
      accessToken: creds.upstox.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('TOTP generation', () => {
    if (!creds.upstox.totpSecret) return;
    const totp = generateTOTP(creds.upstox.totpSecret);
    expect(totp).toMatch(/^\d{6}$/);
  });
});
