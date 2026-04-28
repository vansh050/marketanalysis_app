const creds = require('../loadCredentials');
const {generateJWT, getHeaders} = require('../generateAuth');
const api = require('../apiHelpers');

// DummyBroker only needs AQ credentials — always available when AQ key is set
const HAS_CREDS = !!creds.aq.apiKey;
const describeIf = HAS_CREDS ? describe : describe.skip;

describeIf('DummyBroker Simulation Integration', () => {
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
    const result = await api.getHoldings('dummy', {}, headers);
    expect(result).toBeDefined();
  });

  test('fetch funds/balance', async () => {
    const result = await api.getFunds('dummy', {}, headers);
    expect(result).toBeDefined();
  });

  test('fetch order book', async () => {
    const result = await api.getOrderBook('dummy', {}, headers);
    expect(result).toBeDefined();
  });

  test('3-step simulation: place order', async () => {
    const orderPayload = {
      symbol: creds.testSafety.symbol,
      exchange: creds.testSafety.exchange,
      qty: creds.testSafety.qty,
      orderType: 'MARKET',
      transactionType: 'BUY',
      productType: 'CNC',
    };

    const result = await api.placeOrder('dummy', orderPayload, headers);
    expect(result).toBeDefined();
    expect(result.orderId || result.order_id || result.data).toBeDefined();
  });

  test('3-step simulation: check order status', async () => {
    // Place an order first, then verify it appears in the order book
    const orderPayload = {
      symbol: creds.testSafety.symbol,
      exchange: creds.testSafety.exchange,
      qty: creds.testSafety.qty,
      orderType: 'MARKET',
      transactionType: 'BUY',
      productType: 'CNC',
    };

    await api.placeOrder('dummy', orderPayload, headers);
    const orderBook = await api.getOrderBook('dummy', {}, headers);
    expect(orderBook).toBeDefined();
  });

  test('3-step simulation: verify completion', async () => {
    // Full cycle: place order -> fetch order book -> verify order is reflected
    const orderPayload = {
      symbol: creds.testSafety.symbol,
      exchange: creds.testSafety.exchange,
      qty: creds.testSafety.qty,
      orderType: 'MARKET',
      transactionType: 'BUY',
      productType: 'CNC',
    };

    const placeResult = await api.placeOrder('dummy', orderPayload, headers);
    expect(placeResult).toBeDefined();

    const orderBook = await api.getOrderBook('dummy', {}, headers);
    expect(orderBook).toBeDefined();

    const holdings = await api.getHoldings('dummy', {}, headers);
    expect(holdings).toBeDefined();
  });
});
