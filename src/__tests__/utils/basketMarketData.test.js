import {calculateBasketValue} from '../../utils/basketUtils';

jest.mock('../../utils/SecurityTokenManager', () => ({generateToken: jest.fn(() => 'test-token')}));
import {basketEntryGateMessage} from '../../services/BasketEntryGateService';
import fs from 'node:fs';
import path from 'node:path';

describe('basket market-data safety', () => {
  const basket = [
    {symbol: 'TCS', transactionType: 'BUY', quantity: 2, price: 0},
    {symbol: 'INFY', transactionType: 'BUY', quantity: 1, price: 100},
  ];

  test('never values a missing quote as a real zero', () => {
    expect(calculateBasketValue(basket, symbol => symbol === 'INFY' ? 110 : 0)).toEqual({
      buyValue: null, sellValue: null, netValue: null, missingSymbols: ['TCS'],
    });
  });

  test('returns a value only when every basket leg has a valid price', () => {
    expect(calculateBasketValue(basket, symbol => symbol === 'TCS' ? 200 : 110)).toEqual({
      buyValue: 510, sellValue: 0, netValue: 510, missingSymbols: [],
    });
  });

  test('explains the concrete entry-gate reason', () => {
    expect(basketEntryGateMessage({code: 'PRICE_UNAVAILABLE'})).toContain('LTP unavailable');
    expect(basketEntryGateMessage({code: 'PRICE_STALE'})).toContain('Stale market price');
    expect(basketEntryGateMessage({code: 'ENTRY_BLOCKED'})).toContain('Entry gate condition');
  });

  test('basket cards surface live LTP or an explicit unavailable state', () => {
    const root = path.resolve(__dirname, '../../..');
    const container = fs.readFileSync(
      path.join(root, 'src/UIComponents/StockAdvicesUI/BasketCard.js'),
      'utf8',
    );
    const presentation = fs.readFileSync(
      path.join(root, 'designs/default/composites/BasketCard.js'),
      'utf8',
    );
    expect(container).toContain('currentLtp');
    expect(presentation).toContain('LTP unavailable');
    expect(presentation).toContain('LTP ₹');
    expect(presentation).toContain('const displayHours = hours % 12 || 12');
  });
});
