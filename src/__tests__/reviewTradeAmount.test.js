import {calculateBuyOrderValue} from '../components/AdviceScreenComponents/DynamicText/totalAmount';
import fs from 'fs';

describe('review trade amount', () => {
  test('applies derivative lot sizes to each buy leg', () => {
    const legs = [
      {tradingSymbol: 'SUNPHARMA29SEP261840PE', transactionType: 'BUY', quantity: 1, Lots: '350'},
      {tradingSymbol: 'SUNPHARMA29SEP26FUT', transactionType: 'BUY', quantity: 1, Lots: '350'},
    ];
    const prices = {
      SUNPHARMA29SEP261840PE: 11.8,
      SUNPHARMA29SEP26FUT: 1923.8,
    };

    expect(calculateBuyOrderValue(legs, prices)).toBe(677460);
  });

  test('does not count sell proceeds as required buy value', () => {
    const legs = [
      {tradingSymbol: 'EXIT', transactionType: 'SELL', quantity: 1, Lots: 625},
    ];
    expect(calculateBuyOrderValue(legs, {EXIT: 10})).toBe(0);
  });

  test('labels derivative totals as indicative order value, not broker margin', () => {
    const modal = fs.readFileSync('src/components/ReviewTradeModal.js', 'utf8');
    expect(modal).toContain("'Indicative Order Value :'");
  });
});
