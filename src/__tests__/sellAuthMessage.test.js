import {
  hasExplicitSellAuthRejection,
  isExplicitSellAuthRejection,
} from '../utils/sellAuthMessage';

describe('strict sell-authorization recovery trigger', () => {
  test.each(['SELL_AUTH_REVOKED', 'SELL_AUTH_REQUIRED'])(
    'accepts backend classification %s',
    classification => {
      expect(isExplicitSellAuthRejection({classification})).toBe(true);
    },
  );

  test('accepts explicit flags and nested response envelopes', () => {
    expect(
      hasExplicitSellAuthRejection({
        results: [{sell_auth_required: true}],
      }),
    ).toBe(true);
  });

  test.each([
    {orderStatus: 'REJECTED', orderStatusMessage: 'Insufficient funds'},
    {orderStatus: 'REJECTED', orderStatusMessage: 'Please enter TPIN'},
    {errorCode: '-50', message: 'Invalid Fyers App ID permissions'},
  ])('does not reinterpret an unclassified broker failure: %j', result => {
    expect(isExplicitSellAuthRejection(result)).toBe(false);
  });

  test('empty and transport-error envelopes are not sell-auth evidence', () => {
    expect(hasExplicitSellAuthRejection([])).toBe(false);
    expect(
      hasExplicitSellAuthRejection({message: 'Request timed out'}),
    ).toBe(false);
  });
});
