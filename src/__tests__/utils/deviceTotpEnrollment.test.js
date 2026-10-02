import {authenticator} from '../../utils/totp';
import {
  isRetryableEnrollmentError,
  isWrongPinError,
  msUntilNextTotpWindow,
  TOTP_STEP_MS,
} from '../../utils/deviceTotpEnrollment';

const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('device TOTP enrollment timing', () => {
  test.each([0, 1, 12345, 29999])(
    'the code after the wait differs from the code typed at +%i ms into a window',
    offset => {
      const typedAt = 1234560000 * 1000 + offset; // window-aligned base
      const verifyAt = typedAt + msUntilNextTotpWindow(typedAt);
      expect(Math.floor(verifyAt / TOTP_STEP_MS)).toBe(
        Math.floor(typedAt / TOTP_STEP_MS) + 1,
      );
      expect(authenticator.generate(SECRET, verifyAt)).not.toBe(
        authenticator.generate(SECRET, typedAt),
      );
    },
  );

  test('never waits longer than one window plus the margin', () => {
    for (const now of [0, 1, 15000, 29999, 1727600000123]) {
      const wait = msUntilNextTotpWindow(now);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(TOTP_STEP_MS + 1500);
    }
  });
});

describe('enrollment retry classification', () => {
  const upstream = (status, error_code) => ({response: {status, data: {error_code}}});

  test('retries a broker TOTP-step rejection, server errors and network failures', () => {
    expect(isRetryableEnrollmentError(upstream(400, 'FYERS_ASSISTED_TOTP_FAILED'))).toBe(true);
    expect(isRetryableEnrollmentError(upstream(400, 'ZERODHA_ASSISTED_TOTP_FAILED'))).toBe(true);
    expect(isRetryableEnrollmentError(upstream(500))).toBe(true);
    expect(isRetryableEnrollmentError({isAxiosError: true})).toBe(true);
  });

  test('reports PIN, account and credential errors immediately', () => {
    expect(isRetryableEnrollmentError(upstream(400, 'FYERS_ASSISTED_PIN_FAILED'))).toBe(false);
    expect(isRetryableEnrollmentError(upstream(400))).toBe(false);
    expect(isRetryableEnrollmentError(upstream(409))).toBe(false);
    expect(isRetryableEnrollmentError(new Error('Please sign in again before reconnecting.'))).toBe(false);
  });
});


describe('isWrongPinError', () => {
  const rejected = (data, status = 400) => ({response: {status, data}});

  it('recognises the assisted-login PIN step and broker PIN wording', () => {
    expect(isWrongPinError(rejected({error_code: 'FYERS_ASSISTED_PIN_FAILED'}))).toBe(true);
    expect(isWrongPinError(rejected({message: 'Invalid PIN'}))).toBe(true);
    expect(isWrongPinError(rejected({message: 'FYERS says the PIN is incorrect. Repeated wrong PINs can lock your FYERS login'}))).toBe(true);
    expect(isWrongPinError(rejected({message: 'Invalid MPIN'}))).toBe(true);
  });

  it('does not treat TOTP, network or other failures as a wrong PIN', () => {
    expect(isWrongPinError(rejected({error_code: 'FYERS_ASSISTED_TOTP_FAILED', message: 'you have entered wrong totp'}))).toBe(false);
    expect(isWrongPinError({isAxiosError: true})).toBe(false);
    expect(isWrongPinError(rejected({message: 'Upstox rejected the quick reconnect.'}))).toBe(false);
    expect(isWrongPinError(null)).toBe(false);
  });
});
