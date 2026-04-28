const creds = require('../loadCredentials');
const {generateJWT, generateTOTP, getHeaders} = require('../generateAuth');
const api = require('../apiHelpers');

// Auto-skip if credentials not provided
const HAS_CREDS = !!(creds.aq.apiKey && creds.zerodha.accessToken);
const describeIf = HAS_CREDS ? describe : describe.skip;

describeIf('Zerodha Broker Integration', () => {
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
    const result = await api.getHoldings('zerodha', {
      apiKey: creds.zerodha.apiKey,
      apiSecret: creds.zerodha.apiSecret,
      accessToken: creds.zerodha.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch funds/balance', async () => {
    const result = await api.getFunds('zerodha', {
      apiKey: creds.zerodha.apiKey,
      apiSecret: creds.zerodha.apiSecret,
      accessToken: creds.zerodha.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch order book', async () => {
    const result = await api.getOrderBook('zerodha', {
      apiKey: creds.zerodha.apiKey,
      apiSecret: creds.zerodha.apiSecret,
      accessToken: creds.zerodha.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('TOTP generation', () => {
    if (!creds.zerodha.totpSecret) return;
    const totp = generateTOTP(creds.zerodha.totpSecret);
    expect(totp).toMatch(/^\d{6}$/);
  });

  test('DDPI auth-sell status', async () => {
    const result = await api.ccxtPost('zerodha/auth-sell', {
      apiKey: creds.zerodha.apiKey,
      apiSecret: creds.zerodha.apiSecret,
      accessToken: creds.zerodha.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });
});
