const creds = require('../loadCredentials');
const {generateJWT, generateTOTP, getHeaders} = require('../generateAuth');
const api = require('../apiHelpers');

// Auto-skip if credentials not provided
const HAS_CREDS = !!(creds.aq.apiKey && creds.angelone.apiKey);
const describeIf = HAS_CREDS ? describe : describe.skip;

describeIf('Angel One Broker Integration', () => {
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
    const result = await api.getHoldings('angelone', {
      apiKey: creds.angelone.apiKey,
      clientId: creds.angelone.clientId,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch funds/balance', async () => {
    const result = await api.getFunds('angelone', {
      apiKey: creds.angelone.apiKey,
      clientId: creds.angelone.clientId,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch order book', async () => {
    const result = await api.getOrderBook('angelone', {
      apiKey: creds.angelone.apiKey,
      clientId: creds.angelone.clientId,
    }, headers);
    expect(result).toBeDefined();
  });

  test('TOTP generation', () => {
    if (!creds.angelone.totpSecret) return;
    const totp = generateTOTP(creds.angelone.totpSecret);
    expect(totp).toMatch(/^\d{6}$/);
  });

  test('EDIS verification', async () => {
    const result = await api.ccxtPost('angelone/verify-edis', {
      apiKey: creds.angelone.apiKey,
      clientId: creds.angelone.clientId,
    }, headers);
    expect(result).toBeDefined();
  });
});
