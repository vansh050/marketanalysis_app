/**
 * Plan items 2+3 (2026-10-01): every sell-authorization sheet renders the
 * shared SellAuthGuideCard (server guide), and no sheet claims "DDPI Inactive".
 */
const fs = require('fs');
const path = require('path');
const {sellOrdersForAuth} = require('../utils/sellAuthOrders');

const read = rel => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
const ddpi = read('src/components/DdpiModal.js');

describe('sell-auth sheets use the shared guide', () => {
  test('no sheet claims DDPI is inactive', () => {
    expect(ddpi).not.toMatch(/DDPI Inactive: Proceed/);
  });

  test('each in-app broker sheet renders the card for its broker', () => {
    for (const [fn, broker] of [
      ['export default function DdpiModal', 'Zerodha'],
      ['export function AngleOneTpinModal', 'Angel One'],
      ['export function DhanTpinModal', 'Dhan'],
      ['export function FyersTpinModal', 'Fyers'],
    ]) {
      const start = ddpi.indexOf(fn);
      const next = ddpi.indexOf('\nexport ', start + 10);
      const body = ddpi.slice(start, next === -1 ? undefined : next);
      expect({fn, ok: body.includes(`broker="${broker}"`) && body.includes('variant="inApp"')}).toEqual({fn, ok: true});
    }
  });

  test('the portal sheet renders the card in both views', () => {
    const start = ddpi.indexOf('export function OtherBrokerModel');
    const body = ddpi.slice(start, ddpi.indexOf('\nexport ', start + 10));
    expect(body).toContain('testID="sell-auth-guide-howto"');
    expect(body).toContain('testID="sell-auth-guide-other-broker"');
    expect(body).not.toContain('Open Groww TPIN authorization');
  });

  test('every render site passes the sells to approve', () => {
    for (const f of [
      'src/components/AdviceScreenComponents/RebalanceAdviceContent.js',
      'src/components/AdviceScreenComponents/AddtoCartModal.js',
      'src/components/AdviceScreenComponents/StockAdvices.js',
      'src/screens/Drawer/MPPerformanceScreen.js',
    ]) {
      expect((read(f).match(/sellOrders=\{sellOrdersForAuth\(/g) || []).length).toBe(5);
    }
  });

  test('hook reads the server guide endpoint', () => {
    expect(read('src/hooks/useSellAuthGuide.js')).toContain('api/sell-auth/guides/');
  });
});

describe('sellOrdersForAuth', () => {
  test('prefers broker-rejected equity SELLs, ignores F&O and BUYs', () => {
    const placed = [
      {tradingSymbol: 'A', transactionType: 'SELL', orderStatus: 'REJECTED', quantity: 3},
      {tradingSymbol: 'B', transactionType: 'SELL', orderStatus: 'COMPLETE', quantity: 1},
      {tradingSymbol: 'C', transactionType: 'BUY', orderStatus: 'REJECTED'},
      {tradingSymbol: 'NIFTY', transactionType: 'SELL', exchange: 'NFO', orderStatus: 'REJECTED'},
    ];
    expect(sellOrdersForAuth(placed).map(r => r.tradingSymbol)).toEqual(['A']);
  });

  test('falls back to planned sells when nothing was placed', () => {
    const planned = [{symbol: 'X', transactionType: 'SELL', quantity: 2}];
    expect(sellOrdersForAuth(undefined, planned)).toEqual(planned);
    expect(sellOrdersForAuth(undefined, [])).toEqual([]);
  });
});
