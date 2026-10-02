import {resolveTradeExitPrice} from '../../utils/orderDisplayPrice';

describe('resolveTradeExitPrice', () => {
  test('uses the explicit exit price when present', () => {
    expect(
      resolveTradeExitPrice({exitPrice: '1204.25', tradedPrice: '1204.30'}),
    ).toBe('1204.25');
  });

  test('falls back to the broker fill when exitPrice is absent', () => {
    expect(
      resolveTradeExitPrice({Price: '1207.00', tradedPrice: '1204.30'}),
    ).toBe('1204.30');
  });

  test('does not mislabel the submitted limit as an execution price', () => {
    expect(resolveTradeExitPrice({Price: '1207.00'})).toBe('-');
  });
});
