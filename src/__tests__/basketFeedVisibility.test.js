const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {isBasketCustomerVisibleStatus} = require('../utils/basketOrderState');

// Exercise the real feed flattening AND tab classification, without mounting
// the provider's broker sockets/auth/native modules.
const source = fs.readFileSync(path.join(__dirname, '../screens/TradeContext.js'), 'utf8');
const feedCode = source.slice(
  source.indexOf('    const flattenResponse = response => {'),
  source.indexOf('    // Sort recommended by LATEST ACTIVITY'),
);
const processFeed = basket => vm.runInNewContext(`${feedCode}\nprocessedTrades`, {
  response: {data: {trades: [basket]}},
  cutoffDate: new Date(Date.now() - 15 * 86400000),
  terminalClosedExtraDays: 7,
  isValidSymbolExpiry: () => true,
  debugBasketProcessing: () => {},
  isBasketEdited: () => false,
  isWithdrawnUnfilledEntry: () => false,
  isOrderRejected: () => false,
  isBasketCustomerVisibleStatus,
  console: {log: () => {}},
});
// AlphaB2B renders closed cards from its shared recommendation feed, while
// Markup has a dedicated Closed bucket. Assert the same customer-visible split.
const processBasket = basket => {
  const result = processFeed(basket);
  return {
    ...result,
    closed: result.recommended.filter(row => row.basketLifecycle?.displayStatus === 'CLOSED'),
    recommended: result.recommended.filter(row => row.basketLifecycle?.displayStatus !== 'CLOSED'),
  };
};
const basket = (displayStatus, legs) => ({
  basketId: 'ltm-basket',
  basketName: 'SSD-LTM',
  date: new Date(Date.now() - 30 * 86400000).toISOString(),
  basketLifecycle: {displayStatus, closedAt: new Date().toISOString()},
  basket_advice: legs,
});
const leg = (Type, overrides = {}) => ({
  Symbol: 'LTM29SEP26FUT', Type, trade_place_status: 'COMPLETE',
  Quantity: 1, tradedQty: 1, ...overrides,
});

test('completed opposite sides survive into Closed after the original advice window', () => {
  const result = processBasket(basket('CLOSED', [leg('BUY'), leg('SELL', {purpose: 'EXIT'})]));
  expect(result.closed).toHaveLength(2);
  expect(result.recommended).toHaveLength(0);
  expect(result.closed.map(row => row.Type)).toEqual(['BUY', 'SELL']);
});

test('completed opposite sides with unequal fills preserve a pending closure card', () => {
  const item = basket('CLOSURE_PENDING', [
    leg('BUY', {Quantity: 2, tradedQty: 2}),
    leg('SELL', {purpose: 'EXIT', closurestatus: 'partialClose'}),
  ]);
  item.to_trade_net = [{Symbol: 'LTM29SEP26FUT', toTradeQty: -1, closure: true}];
  const result = processBasket(item);
  expect(result.recommended).toHaveLength(2);
  expect(result.closed).toHaveLength(0);
  expect(result.recommended.every(row => row.currentHolding === 1)).toBe(true);
});

test('manager-closed zero-fill baskets remain read-only despite cancelled legs', () => {
  const item = basket('CLOSED', [
    leg('BUY', {trade_place_status: 'cancelled', cancel: true, tradedQty: 0}),
    leg('BUY', {purpose: 'EXIT', closurestatus: 'fullClose', trade_place_status: 'cancelled', cancel: true, tradedQty: 0}),
  ]);
  item.basketLifecycle.reason = 'MANAGER_CLOSED_ZERO_FILL';
  const result = processBasket(item);
  expect(result.closed).toHaveLength(2);
  expect(result.recommended).toHaveLength(0);
});

test('closed baskets still age out after the closure retention window', () => {
  const item = basket('CLOSED', [leg('BUY'), leg('SELL', {purpose: 'EXIT'})]);
  item.basketLifecycle.closedAt = new Date(Date.now() - 8 * 86400000).toISOString();
  expect(processBasket(item).closed).toHaveLength(0);
});
