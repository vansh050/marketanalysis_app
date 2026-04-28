const creds = require('../loadCredentials');
const {generateJWT, getHeaders} = require('../generateAuth');
const api = require('../apiHelpers');

// Auto-skip if credentials not provided
const HAS_CREDS = !!(creds.aq.apiKey && creds.icici.accessToken);
const describeIf = HAS_CREDS ? describe : describe.skip;

describeIf('ICICI Direct Broker Integration', () => {
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
    const result = await api.getHoldings('icici', {
      apiKey: creds.icici.apiKey,
      apiSecret: creds.icici.apiSecret,
      accessToken: creds.icici.accessToken,
      sessionToken: creds.icici.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch funds/balance', async () => {
    const result = await api.getFunds('icici', {
      apiKey: creds.icici.apiKey,
      apiSecret: creds.icici.apiSecret,
      accessToken: creds.icici.accessToken,
      sessionToken: creds.icici.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });

  test('fetch order book', async () => {
    const result = await api.getOrderBook('icici', {
      apiKey: creds.icici.apiKey,
      apiSecret: creds.icici.apiSecret,
      accessToken: creds.icici.accessToken,
      sessionToken: creds.icici.accessToken,
    }, headers);
    expect(result).toBeDefined();
  });
});
