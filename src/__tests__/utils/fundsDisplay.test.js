import {
  availableCashText,
  confirmedFundsSnapshot,
  fundsVerificationText,
} from '../../utils/fundsDisplay';

describe('confirmed funds display', () => {
  test('keeps a genuine broker zero distinct from missing data', () => {
    const zero = confirmedFundsSnapshot({status: 0, data: {availablecash: 0}});
    expect(zero.availableCash).toBe(0);
    expect(availableCashText({broker: 'ICICI Direct', snapshot: zero})).toBe('₹ 0.00');
    expect(availableCashText({broker: 'ICICI Direct', snapshot: null, loading: false})).toBe('Unavailable');
  });

  test.each([null, {}, {status: 1}, {status: 2, data: {}}, {status: 0, data: {availablecash: ''}}])(
    'does not confirm an incomplete or failed response: %p',
    response => expect(confirmedFundsSnapshot(response)).toBeNull(),
  );

  test('retains a verified value while refresh is in progress or fails', () => {
    const snapshot = {availableCash: 1234, verifiedAt: Date.now()};
    expect(availableCashText({broker: 'ICICI Direct', snapshot, loading: true})).toBe('₹ 1234.00');
    expect(fundsVerificationText({snapshot, loading: true, error: null})).toBe('Refreshing…');
    expect(fundsVerificationText({snapshot, loading: false, error: 'timeout'})).toMatch(/^Last verified /);
  });
});
