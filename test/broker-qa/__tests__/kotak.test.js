const creds = require('../loadCredentials');
const {generateJWT, generateTOTP, getHeaders} = require('../generateAuth');
const api = require('../apiHelpers');

// Auto-skip if credentials not provided
const HAS_CREDS = !!(creds.aq.apiKey && creds.kotak.consumerKey);
const describeIf = HAS_CREDS ? describe : describe.skip;

describeIf('Kotak Broker Integration', () => {
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
    const result = await api.getHoldings('kotak', {
      consumerKey: creds.kotak.consumerKey,
      consumerSecret: creds.kotak.consumerSecret,
      accessToken: creds.kotak.accessToken,
      mobile: creds.kotak.mobile,
      mpin: creds.kotak.mpin,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch funds/balance', async () => {
    const result = await api.getFunds('kotak', {
      consumerKey: creds.kotak.consumerKey,
      consumerSecret: creds.kotak.consumerSecret,
      accessToken: creds.kotak.accessToken,
      mobile: creds.kotak.mobile,
      mpin: creds.kotak.mpin,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch order book', async () => {
    const result = await api.getOrderBook('kotak', {
      consumerKey: creds.kotak.consumerKey,
      consumerSecret: creds.kotak.consumerSecret,
      accessToken: creds.kotak.accessToken,
      mobile: creds.kotak.mobile,
      mpin: creds.kotak.mpin,
    }, headers);
    expect(result).toBeDefined();
  });

  test('TOTP generation', () => {
    if (!creds.kotak.totpSecret) return;
    const totp = generateTOTP(creds.kotak.totpSecret);
    expect(totp).toMatch(/^\d{6}$/);
  });
});
