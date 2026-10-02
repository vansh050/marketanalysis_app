jest.mock('react-native-config', () => ({
  REACT_APP_DOMAIN: 'https://research.markup.club,http://localhost:3000',
  REACT_APP_ZERODHA_API_KEY: 'test-key',
}));
jest.mock('../../utils/serverConfig', () => ({
  __esModule: true,
  default: {
    server: {baseUrl: 'https://server.example/'},
    ccxtServer: {baseUrl: 'https://ccxt.example/'},
    websocket: {baseUrl: 'https://websocket.example/'},
  },
}));
jest.mock('../../utils/SecurityTokenManager', () => ({
  generateToken: jest.fn(() => 'test-token'),
}));
jest.mock('../../utils/accountEmail', () => ({
  getAccountEmailAsync: jest.fn(async () => 'test@example.com'),
}));
jest.mock('../../utils/variantHelper', () => ({
  getTenantSubdomain: configData =>
    configData?.config?.REACT_APP_HEADER_NAME ||
    configData?.REACT_APP_HEADER_NAME ||
    configData?.subdomain ||
    'test',
  getAdvisorSubdomain: jest.fn(() => 'test'),
}));
jest.mock('react-native', () => ({Alert: {alert: jest.fn()}}));

import {
  __setCircuitBandsForTest,
  applyKiteMarketProtection,
  clampToCircuitBand,
  convertToBasketItem,
  createModelPortfolioPublisherBatches,
  fetchFreshKiteProtectionPrices,
  enrichPublisherLegPrices,
  getCircuitBand,
  getPublisherWebViewBaseUrl,
  resolveZerodhaSymbol,
  roundToKiteTick,
} from '../../utils/brokerPublisher';
import fs from 'fs';
import path from 'path';
import {Alert} from 'react-native';
import {getKiteBasketQuantity} from '../../utils/basketUtils';

describe('brokerPublisher Zerodha safety', () => {
  test('prices all eight MARKET recovery buys without changing their order type', () => {
    const legs = Array.from({length: 8}, (_, index) => ({
      tradingSymbol: `BUY${index + 1}-EQ`,
      transactionType: 'BUY',
      orderType: 'MARKET',
      price: 0,
      referencePrice: 100 + index,
      quantity: 1,
      exchange: 'NSE',
    }));
    const prices = Object.fromEntries(
      legs.map((leg, index) => [leg.tradingSymbol.replace(/-EQ$/, ''), 200 + index]),
    );

    const enriched = enrichPublisherLegPrices(legs, prices);

    expect(enriched).toHaveLength(8);
    expect(enriched.every(leg => leg.orderType === 'MARKET')).toBe(true);
    expect(enriched.map(leg => leg.price)).toEqual(
      Array.from({length: 8}, (_, index) => 200 + index),
    );
  });

  test('keeps a customer LIMIT while refreshing its valuation reference', () => {
    expect(enrichPublisherLegPrices([{
      tradingSymbol: 'ABC', transactionType: 'BUY', orderType: 'LIMIT',
      price: 91, referencePrice: 90, exchange: 'NSE',
    }], {ABC: 100})[0]).toMatchObject({
      orderType: 'LIMIT', price: 91, referencePrice: 100, ltp: 100,
    });
  });

  test('model-portfolio mixed baskets always expose SELL before BUY', () => {
    const batches = createModelPortfolioPublisherBatches([
      {tradingSymbol: 'SINDHUTRAD-EQ', transactionType: 'BUY', quantity: 2},
      {tradingSymbol: 'RTNPOWER-EQ', transactionType: 'SELL', quantity: 5},
      {tradingSymbol: 'YESBANK-EQ', transactionType: 'SELL', quantity: 2},
    ]);

    expect(batches.map(batch => batch.map(row => row.transactionType))).toEqual([
      ['SELL', 'SELL'],
      ['BUY'],
    ]);
  });

  test('expands derivative lots for Kite while preserving equity quantities', () => {
    expect(getKiteBasketQuantity(1, 'NFO', 65)).toBe(65);
    expect(getKiteBasketQuantity(17, 'NFO', 65)).toBe(1105);
    expect(getKiteBasketQuantity(17, 'NSE', 65)).toBe(17);
  });
  // prod/testaccount 2026-09-18: the scripmaster mapped VIKASECO-EQ to NSE
  // (its -EQ series) but the customer's 82 shares were held as BSE. Kite
  // validates a CNC sell against that exchange's holding and rejected the NSE
  // sell with "Holding quantity: 0" although book and snapshot both said 82.
  test('a SELL is sent to the exchange the holding is tagged with, not the scripmaster listing', () => {
    const symbolMap = {'VIKASECO-EQ': {zerodha_symbol: 'VIKASECO', exchange: 'NSE', ltp: 1.04}};
    const sell = convertToBasketItem(
      'Zerodha',
      {tradingSymbol: 'VIKASECO-EQ', exchange: 'BSE', transactionType: 'SELL',
        quantity: 82, orderType: 'MARKET', productType: 'DELIVERY'},
      symbolMap,
    );
    expect(sell).toMatchObject({tradingsymbol: 'VIKASECO', exchange: 'BSE', transaction_type: 'SELL'});
    expect(resolveZerodhaSymbol(
      {tradingSymbol: 'VIKASECO-EQ', exchange: 'BSE', transactionType: 'SELL'}, symbolMap,
    ).exchange).toBe('BSE');
  });

  test('a BUY keeps the scripmaster exchange (BE / BSE-only mapping authority)', () => {
    const symbolMap = {'VIKASECO-EQ': {zerodha_symbol: 'VIKASECO', exchange: 'BSE', ltp: 1.04}};
    const buy = convertToBasketItem(
      'Zerodha',
      {tradingSymbol: 'VIKASECO-EQ', exchange: 'NSE', transactionType: 'BUY',
        quantity: 10, orderType: 'MARKET', productType: 'DELIVERY'},
      symbolMap,
    );
    expect(buy).toMatchObject({exchange: 'BSE', transaction_type: 'BUY'});
  });

  test('a SELL with no exchange on the leg still falls back to the scripmaster', () => {
    const symbolMap = {'IDEA-EQ': {zerodha_symbol: 'IDEA', exchange: 'NSE', ltp: 9}};
    expect(resolveZerodhaSymbol(
      {tradingSymbol: 'IDEA-EQ', transactionType: 'SELL'}, symbolMap,
    ).exchange).toBe('NSE');
  });

  test('uses LIMIT-DAY for NSE publisher orders', () => {
    const result = applyKiteMarketProtection(
      {
        tradingsymbol: 'VIKASECO',
        exchange: 'NSE',
        transaction_type: 'BUY',
        order_type: 'MARKET',
        product: 'CNC',
      },
      1.11,
      'BUY',
    );

    expect(result).toMatchObject({
      order_type: 'LIMIT',
      price: 1.13,
      validity: 'DAY',
    });
  });

  test('rounds BUY upward and SELL downward so limits stay marketable', () => {
    expect(roundToKiteTick(1.1211, 'ceil')).toBe(1.13);
    expect(roundToKiteTick(1.0989, 'floor')).toBe(1.09);
  });

  test('uses the full six-band NSE tick fallback including ₹5 above ₹20,000', () => {
    expect(roundToKiteTick(249.994, 'nearest')).toBe(249.99);
    expect(roundToKiteTick(250.024, 'nearest')).toBe(250);
    expect(roundToKiteTick(1000.049, 'ceil')).toBe(1000.1);
    expect(roundToKiteTick(5000.19, 'ceil')).toBe(5000.5);
    expect(roundToKiteTick(10000.2, 'ceil')).toBe(10001);
    expect(roundToKiteTick(20001, 'ceil')).toBe(20005);
  });

  test('requires broker-safe quotes for every MARKET protection price', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({status: 0, prices: {'NSE:INFY': 1500}}),
    });

    await expect(
      fetchFreshKiteProtectionPrices([
        {tradingSymbol: 'INFY-EQ', exchange: 'NSE', orderType: 'MARKET'},
      ], {
        'INFY-EQ': {zerodha_symbol: 'INFY', exchange: 'NSE'},
      }),
    ).resolves.toEqual({INFY: 1500});
  });

  test('queries Kite symbols and maps safe prices back to basket symbols', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({status: 0, prices: {
        'NSE:IDEA': 14.74,
        'NSE:JPPOWER': 15.93,
        'NSE:SINDHUTRAD': 23.63,
        'BSE:RTNPOWER': 7.19,
      }}),
    });

    const prices = await fetchFreshKiteProtectionPrices([
      {tradingSymbol: 'IDEA-EQ', exchange: 'NSE', orderType: 'MARKET'},
      {tradingSymbol: 'JPPOWER-EQ', exchange: 'NSE', orderType: 'MARKET'},
      {tradingSymbol: 'SINDHUTRAD-EQ', exchange: 'NSE', orderType: 'MARKET'},
      {tradingSymbol: 'RTNPOWER-EQ', exchange: 'NSE', orderType: 'MARKET'},
    ], {
      'IDEA-EQ': {zerodha_symbol: 'IDEA', exchange: 'NSE'},
      'JPPOWER-EQ': {zerodha_symbol: 'JPPOWER', exchange: 'NSE'},
      'SINDHUTRAD-EQ': {zerodha_symbol: 'SINDHUTRAD', exchange: 'NSE'},
      'RTNPOWER-EQ': {zerodha_symbol: 'RTNPOWER', exchange: 'BSE'},
    });

    expect(prices).toEqual({
      IDEA: 14.74,
      JPPOWER: 15.93,
      SINDHUTRAD: 23.63,
      RTNPOWER: 7.19,
    });
    const request = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(request.orders).toEqual(expect.arrayContaining([
      {exchange: 'NSE', symbol: 'IDEA', transactionType: 'BUY'},
      {exchange: 'NSE', symbol: 'JPPOWER', transactionType: 'BUY'},
      {exchange: 'NSE', symbol: 'SINDHUTRAD', transactionType: 'BUY'},
      {exchange: 'BSE', symbol: 'RTNPOWER', transactionType: 'BUY'},
    ]));
  });

  test('warns and continues when a MARKET quote cannot be refreshed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({status: 2, blocked: [{symbol: 'NSE:TATVA', reason: 'last traded price is stale'}]}),
    });

    await expect(
      fetchFreshKiteProtectionPrices([
        {tradingSymbol: 'TATVA-EQ', exchange: 'NSE', orderType: 'MARKET'},
      ]),
    ).resolves.toEqual({});
    expect(Alert.alert).toHaveBeenCalledWith(
      'Review prices and liquidity in Kite',
      expect.stringContaining('basket will open for your review'),
    );
  });

  test('legacy basket conversion also uses LIMIT-DAY', () => {
    const item = convertToBasketItem(
      'Zerodha',
      {
        tradingSymbol: 'VIKASECO-EQ',
        exchange: 'NSE',
        transactionType: 'BUY',
        quantity: 3,
        orderType: 'MARKET',
        productType: 'DELIVERY',
        ltp: 1.11,
      },
      {
        'VIKASECO-EQ': {
          zerodha_symbol: 'VIKASECO',
          exchange: 'NSE',
        },
      },
    );

    expect(item).toMatchObject({
      tradingsymbol: 'VIKASECO',
      order_type: 'LIMIT',
      price: 1.13,
      validity: 'DAY',
    });
  });

  test('maps NFO carry-forward basket legs to Zerodha NRML', () => {
    const item = convertToBasketItem('Zerodha', {
      tradingSymbol: 'NIFTY26SEPFUT',
      exchange: 'NFO',
      transactionType: 'BUY',
      quantity: 1,
      orderType: 'LIMIT',
      productType: 'CARRYFORWARD',
      price: 25000,
    });

    expect(item.product).toBe('NRML');
  });

  test('canonical conversion preserves caller-owned derivative sizing and symbol resolution', () => {
    const item = convertToBasketItem(
      'Zerodha',
      {
        tradingSymbol: 'NIFTY-OLD',
        exchange: 'NFO',
        transactionType: 'buy',
        quantity: 2,
        orderType: 'MARKET',
        productType: 'CARRYFORWARD',
      },
      undefined,
      {
        tradingsymbol: 'NIFTY26SEPFUT',
        exchange: 'NFO',
        quantity: 150,
        ltp: 25000,
        tag: 'publisher-tag-longer-than-twenty-characters',
      },
    );

    expect(item).toMatchObject({
      tradingsymbol: 'NIFTY26SEPFUT',
      exchange: 'NFO',
      transaction_type: 'BUY',
      quantity: 150,
      product: 'NRML',
      order_type: 'LIMIT',
      price: 25375,
      validity: 'DAY',
      readonly: true,
      tag: 'publisher-tag-longer',
    });
  });

  test('all six Kite basket builders use canonical conversion and fresh protection quotes', () => {
    const files = [
      'components/ReviewZerodhaTradeModal.js',
      'components/AdviceScreenComponents/RebalanceModal.js',
      'components/ModelPortfolioComponents/MPReviewTradeModal.js',
      'screens/Drawer/IgnoreTradesScreen.js',
      'components/AdviceScreenComponents/StockAdvices.js',
      'components/AdviceScreenComponents/AddtoCartModal.js',
    ];

    files.forEach(file => {
      const source = fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
      expect(source).toContain("convertToBasketItem('Zerodha'");
      expect(source).toContain('fetchFreshKiteProtectionPrices');
      expect(source).not.toContain('const mapKiteProductType');
      expect(source).not.toContain('const mapKiteOrderType');
    });
  });

  test('prefers the runtime custom domain for the Kite WebView origin', () => {
    expect(
      getPublisherWebViewBaseUrl({
        config: {customDomain: 'invest.example.com'},
      }),
    ).toBe('https://invest.example.com');
  });

  test('uses the build web origin before an incompatible advisor subdomain', () => {
    expect(
      getPublisherWebViewBaseUrl({
        config: {REACT_APP_HEADER_NAME: 'markup'},
      }),
    ).toBe('https://research.markup.club');
  });
});

// ── circuit-band clamp (2026-09-18) ────────────────────────────────────
// tidi/prikc1333: BSE TAPARIA sat AT its upper circuit (ltp 14.03 == upper
// 14.03). The flat +1% produced 14.18 and Kite refused the leg with no order
// id and no reason. Every RN fork carried the same unclamped buffer.
describe('circuit-band clamp', () => {
  const MARKET_LEG = {
    tradingSymbol: 'TAPARIA',
    symbol: 'TAPARIA',
    exchange: 'BSE',
    transactionType: 'BUY',
    quantity: 4,
    orderType: 'MARKET',
  };

  afterEach(() => __setCircuitBandsForTest(null));

  test('the TAPARIA case: a BUY at the ceiling is clamped, not refused', () => {
    __setCircuitBandsForTest({'BSE:TAPARIA': {lower: 11.23, upper: 14.03}});
    const item = convertToBasketItem('Zerodha', MARKET_LEG, {}, {ltp: 14.03});
    expect(item.order_type).toBe('LIMIT');
    expect(item.price).toBe(14.03); // unclamped this was 14.18
  });

  test('a SELL at the floor is clamped up', () => {
    __setCircuitBandsForTest({'BSE:TAPARIA': {lower: 10, upper: 12.5}});
    const item = convertToBasketItem(
      'Zerodha',
      {...MARKET_LEG, transactionType: 'SELL'},
      {},
      {ltp: 10},
    );
    expect(item.price).toBe(10); // unclamped this was 9.9
  });

  // The invariant that makes this safe to ship: a clamp can only ever make an
  // order LESS aggressive than the unclamped buffer, never more.
  test('clamping never moves a price further from the LTP', () => {
    const cases = [
      {ltp: 14.03, band: {lower: 11.23, upper: 14.03}, buy: true},
      {ltp: 100, band: {lower: 90, upper: 110}, buy: true},
      {ltp: 10, band: {lower: 10, upper: 12.5}, buy: false},
      {ltp: 500, band: {lower: 450, upper: 550}, buy: false},
    ];
    cases.forEach(({ltp, band, buy}) => {
      const buffered = roundToKiteTick(
        buy ? ltp * 1.01 : ltp * 0.99,
        buy ? 'ceil' : 'floor',
      );
      const clamped = clampToCircuitBand(buffered, buy, band);
      if (buy) expect(clamped).toBeLessThanOrEqual(buffered);
      else expect(clamped).toBeGreaterThanOrEqual(buffered);
    });
  });

  test('no band leaves the price exactly as it was before this change', () => {
    __setCircuitBandsForTest(null);
    const item = convertToBasketItem('Zerodha', MARKET_LEG, {}, {ltp: 14.03});
    expect(item.price).toBe(14.18);
  });

  test('a non-binding band leaves the buffer alone', () => {
    __setCircuitBandsForTest({'BSE:TAPARIA': {lower: 11.23, upper: 20}});
    const item = convertToBasketItem('Zerodha', MARKET_LEG, {}, {ltp: 14.03});
    expect(item.price).toBe(14.18);
  });

  test('an explicit LIMIT is never touched by the clamp', () => {
    __setCircuitBandsForTest({'BSE:TAPARIA': {lower: 11.23, upper: 14.03}});
    const item = convertToBasketItem(
      'Zerodha',
      {...MARKET_LEG, orderType: 'LIMIT', price: 99},
      {},
      {},
    );
    expect(item.order_type).toBe('LIMIT');
    expect(item.price).toBe(99);
  });

  test('a band for another instrument is never applied', () => {
    __setCircuitBandsForTest({'NSE:IDEA': {lower: 11, upper: 14.03}});
    const item = convertToBasketItem('Zerodha', MARKET_LEG, {}, {ltp: 14.03});
    expect(item.price).toBe(14.18);
  });

  test('a stale band is ignored', () => {
    __setCircuitBandsForTest({'BSE:TAPARIA': {lower: 11.23, upper: 14.03}});
    const realNow = Date.now;
    Date.now = () => realNow() + 6 * 60 * 1000;
    try {
      expect(getCircuitBand('BSE', 'TAPARIA')).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  // The one that matters most: proves the registry key produced by the FETCH
  // path matches the key the CONVERSION path looks up. A mismatch would make
  // the whole fix a silent no-op that still passes every seam-based test.
  test('end to end: a real quote response clamps the real conversion', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 0,
        prices: {'BSE:TAPARIA': 14.03, 'NSE:IDEA': 14.19},
        bands: {
          'BSE:TAPARIA': {lower: 11.23, upper: 14.03},
          'NSE:IDEA': {lower: 11.36, upper: 17.03},
        },
      }),
    });

    const legs = [
      {tradingSymbol: 'TAPARIA', exchange: 'BSE', orderType: 'MARKET',
       transactionType: 'BUY', quantity: 4},
      {tradingSymbol: 'IDEA-EQ', exchange: 'NSE', orderType: 'MARKET',
       transactionType: 'BUY', quantity: 3},
    ];
    const symbolMap = {
      TAPARIA: {zerodha_symbol: 'TAPARIA', exchange: 'BSE'},
      'IDEA-EQ': {zerodha_symbol: 'IDEA', exchange: 'NSE'},
    };

    const prices = await fetchFreshKiteProtectionPrices(legs, symbolMap);
    expect(prices).toEqual({TAPARIA: 14.03, IDEA: 14.19});

    // TAPARIA is at its ceiling: clamped from 14.18 down to 14.03.
    const taparia = convertToBasketItem('Zerodha', legs[0], symbolMap, {
      ltp: prices.TAPARIA,
    });
    expect(taparia.price).toBe(14.03);

    // IDEA has headroom: the buffer stands.
    const idea = convertToBasketItem('Zerodha', legs[1], symbolMap, {
      ltp: prices.IDEA,
    });
    expect(idea.price).toBe(14.34);
  });

  test('a failed quote leaves no band behind for a later basket', async () => {
    __setCircuitBandsForTest({'BSE:TAPARIA': {lower: 11.23, upper: 14.03}});
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({status: 1}),
    });
    await fetchFreshKiteProtectionPrices(
      [{tradingSymbol: 'TAPARIA', exchange: 'BSE', orderType: 'MARKET'}],
      {TAPARIA: {zerodha_symbol: 'TAPARIA', exchange: 'BSE'}},
    );
    expect(getCircuitBand('BSE', 'TAPARIA')).toBeNull();
  });

  test('malformed band values are discarded, never clamped to', () => {
    __setCircuitBandsForTest({
      'BSE:TAPARIA': {lower: 0, upper: null},
      'BSE:OTHER': {lower: 'x', upper: undefined},
    });
    expect(getCircuitBand('BSE', 'TAPARIA')).toBeNull();
    expect(getCircuitBand('BSE', 'OTHER')).toBeNull();
    expect(clampToCircuitBand(14.18, true, null)).toBe(14.18);
    expect(clampToCircuitBand(14.18, true, {lower: null, upper: null})).toBe(14.18);
    expect(clampToCircuitBand(0, true, {upper: 10})).toBe(0);
  });
});
