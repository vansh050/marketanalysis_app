import {getBasketBrokerOwnership} from '../../utils/basketBrokerOwnership';

describe('basket broker ownership', () => {
  test('blocks a Zerodha position while Fyers is active', () => {
    expect(getBasketBrokerOwnership(
      {positionBroker: 'Zerodha', positionBrokers: ['Zerodha']},
      'Fyers',
    )).toMatchObject({mismatch: true, positionBroker: 'Zerodha'});
  });

  test('allows the broker that owns the position', () => {
    expect(getBasketBrokerOwnership(
      {positionBrokers: ['Zerodha']},
      'zerodha',
    ).mismatch).toBe(false);
  });

  test('keeps legacy baskets without ownership metadata compatible', () => {
    expect(getBasketBrokerOwnership({}, 'Fyers')).toMatchObject({
      hasKnownOwner: false,
      mismatch: false,
    });
  });
});
