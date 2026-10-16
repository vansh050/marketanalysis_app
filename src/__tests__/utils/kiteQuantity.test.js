import {kiteQuantity, missingQuantityMessage, tradesMissingQuantity} from '../../utils/kiteQuantity';

// 2026-10-13 Kyzen TCS: `parseInt(qty) || 1` turned a blank quantity into a
// 1-share Kite order that the record-back could never match.
describe('kiteQuantity', () => {
  test('never invents a quantity', () => {
    expect(kiteQuantity({quantity: ''})).toBeNull();
    expect(kiteQuantity({quantity: 0})).toBeNull();
    expect(kiteQuantity({Quantity: '2.5'})).toBeNull();
    expect(kiteQuantity({})).toBeNull();
  });
  test('accepts positive whole numbers', () => {
    expect(kiteQuantity({quantity: '4'})).toBe(4);
    expect(kiteQuantity({Quantity: 1})).toBe(1);
  });
  test('names every stock that still needs a quantity', () => {
    const missing = tradesMissingQuantity([{tradingSymbol: 'TCS-EQ', quantity: ''}, {tradingSymbol: 'INFY', quantity: 2}]);
    expect(missing).toEqual(['TCS']);
    expect(missingQuantityMessage(missing)).toBe('Enter a quantity for TCS before placing. No order was sent.');
  });
});

test('no Kite basket builder defaults a missing quantity to one share', () => {
  const fs = require('fs');
  const path = require('path');
  const files = [
    'src/components/AdviceScreenComponents/StockAdvices.js',
    'src/components/AdviceScreenComponents/AddtoCartModal.js',
    'src/screens/Drawer/IgnoreTradesScreen.js',
    'src/components/AdviceScreenComponents/RebalanceModal.js',
    'src/components/ModelPortfolioComponents/MPReviewTradeModal.js',
  ];
  for (const f of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', f), 'utf8');
    expect(src).not.toMatch(/parseInt\(stock\.quantity, 10\) \|\| 1/);
    expect(src).toContain('tradesMissingQuantity(');
  }
});
