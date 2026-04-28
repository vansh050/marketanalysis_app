/**
 * Tests for AliceBlue session classifier — the client-side counterpart
 * of ccxt-india's `_parse_funds_response` + `validate_session`. These
 * cover the regression matrix from Alphab2bapp commit `3bf15a3` paired
 * with ccxt-india `fc01dfd1` / `f657ce5d` / `4dfb6a6c`.
 *
 * The fixtures below are the actual response shapes ccxt-india's
 * `/aliceblue/funds` endpoint emits after the 2026-04-26 fix:
 *
 *   Maintenance window  → status:0, errorcode:'MAINTENANCE'  + zero funds
 *   No-data (no trades) → status:0, errorcode:'NO_DATA'      + zero funds
 *   Real 401 / expired  → status:1, errorcode:'NO_RESPONSE'  + auth message
 *   Success             → status:0                            + real funds
 *
 * The client's `classifyFundsResponse` must:
 *   - return OK for maintenance + no-data + success (don't false-positive expiry)
 *   - return TOKEN_EXPIRED for real 401 / token expired
 *   - return TRANSIENT for known transient codes (the 'maintenance'
 *     errorcode is in TRANSIENT_NON_AUTH_BROKER_ERROR_CODES, but ccxt
 *     now returns status:0 for that case so it shouldn't even reach
 *     the transient classifier — the test covers both belt and braces)
 */

import {
  isTransientFundsError,
  isFundsErrorOrMissing,
} from '../../utils/rebalanceHelpers';

// Mock CryptoJS — pulled in via rebalanceHelpers
jest.mock('react-native-crypto-js');

// `classifyFundsResponse` lives in `brokerSessionValidator.js`, which
// transitively imports `react-native-pure-jwt` (an ES-module native
// binding jest can't transform). Test the contract via a local mirror
// that exactly replicates the production switch.
function classifyFundsResponse(funds, brokerStatus, broker) {
  if (!broker || brokerStatus !== 'connected') {
    return {ok: false, reason: 'NOT_CONNECTED'};
  }
  if (!funds) {
    return {ok: false, reason: 'TOKEN_EXPIRED'};
  }
  if (isTransientFundsError(funds, broker)) {
    return {ok: false, reason: 'TRANSIENT'};
  }
  if (isFundsErrorOrMissing(funds, brokerStatus, broker)) {
    return {ok: false, reason: 'TOKEN_EXPIRED'};
  }
  return {ok: true, reason: 'OK'};
}

// ─── Fixtures ─────────────────────────────────────────────────────────

// 2026-04-26 02:42 — AliceBlue maintenance, after ccxt fix
const RESP_MAINTENANCE = {
  status: 0,
  errorcode: 'MAINTENANCE',
  message:
    'Please note: System is currently undergoing routine maintenance, ' +
    'so order processing is temporarily unavailable.',
  data: {
    availablecash: '0',
    availableintradaypayin: '0',
    availablelimitmargin: '0',
    collateral: '0',
    net: '0',
  },
};

// 2026-04-26 02:55 — empty account, after ccxt fix
const RESP_NO_DATA = {
  status: 0,
  errorcode: 'NO_DATA',
  message: 'Error: No trades found for this user.',
  data: {availablecash: '0', net: '0'},
};

// 2026-04-25 06:48 — real HTTP 401, after ccxt normalization
const RESP_REAL_401 = {
  status: 1,
  errorcode: 'NO_RESPONSE',
  message:
    'Session expired or unauthorized (HTTP 401). Please reconnect your broker.',
  data: {},
};

const RESP_TOKEN_EXPIRED = {
  status: 1,
  errorcode: 'NO_RESPONSE',
  message: 'Token Expired. Please relogin.',
  data: {},
};

// True success
const RESP_SUCCESS = {
  status: 0,
  errorcode: '',
  message: 'SUCCESS',
  data: {availablecash: '1000.50', net: '950.00'},
};

// Defensive: legacy shape — ccxt response WITHOUT the new errorcode
// tagging (e.g. an old ccxt binary that hasn't been deployed yet).
// `isTransientFundsError` should still match by message keyword.
const RESP_LEGACY_MAINTENANCE_KEYWORD_ONLY = {
  status: 1,
  message:
    'Please note: System is currently undergoing routine maintenance, ' +
    'so order processing is temporarily unavailable.',
};

// ─── isTransientFundsError ────────────────────────────────────────────

describe('isTransientFundsError (AliceBlue)', () => {
  test('errorcode=maintenance → transient', () => {
    expect(
      isTransientFundsError({errorcode: 'maintenance'}, 'AliceBlue'),
    ).toBe(true);
  });

  test('errorcode=MAINTENANCE (uppercase) → transient', () => {
    expect(
      isTransientFundsError({errorcode: 'MAINTENANCE'}, 'AliceBlue'),
    ).toBe(true);
  });

  test('legacy shape with keyword "temporarily unavailable" → transient', () => {
    expect(
      isTransientFundsError(RESP_LEGACY_MAINTENANCE_KEYWORD_ONLY, 'AliceBlue'),
    ).toBe(true);
  });

  test('real 401 message → NOT transient (must trip expiry)', () => {
    expect(isTransientFundsError(RESP_REAL_401, 'AliceBlue')).toBe(false);
  });

  test('token expired → NOT transient', () => {
    expect(isTransientFundsError(RESP_TOKEN_EXPIRED, 'AliceBlue')).toBe(false);
  });

  test('no-data → NOT transient (status:0 from ccxt; no expiry path needed)', () => {
    expect(isTransientFundsError(RESP_NO_DATA, 'AliceBlue')).toBe(false);
  });
});

// ─── isFundsErrorOrMissing ────────────────────────────────────────────

describe('isFundsErrorOrMissing (AliceBlue)', () => {
  test('maintenance status:0 → not error', () => {
    expect(isFundsErrorOrMissing(RESP_MAINTENANCE, 'connected', 'AliceBlue'))
      .toBe(false);
  });

  test('no-data status:0 → not error', () => {
    expect(isFundsErrorOrMissing(RESP_NO_DATA, 'connected', 'AliceBlue'))
      .toBe(false);
  });

  test('real 401 status:1 → error (correctly classified as expired)', () => {
    expect(isFundsErrorOrMissing(RESP_REAL_401, 'connected', 'AliceBlue'))
      .toBe(true);
  });

  test('token expired status:1 → error', () => {
    expect(isFundsErrorOrMissing(RESP_TOKEN_EXPIRED, 'connected', 'AliceBlue'))
      .toBe(true);
  });

  test('success → not error', () => {
    expect(isFundsErrorOrMissing(RESP_SUCCESS, 'connected', 'AliceBlue'))
      .toBe(false);
  });

  test('legacy maintenance shape (status:1 + keyword) → masked by transient → not error', () => {
    // isTransientFundsError fires first inside isFundsErrorOrMissing,
    // so even a status:1 maintenance response is treated as non-error.
    expect(
      isFundsErrorOrMissing(
        RESP_LEGACY_MAINTENANCE_KEYWORD_ONLY,
        'connected',
        'AliceBlue',
      ),
    ).toBe(false);
  });
});

// ─── classifyFundsResponse ────────────────────────────────────────────

describe('classifyFundsResponse (AliceBlue)', () => {
  test('maintenance → TRANSIENT (soft toast, no false expiry)', () => {
    // ccxt now returns status:0 for maintenance + errorcode:'MAINTENANCE'.
    // The transient classifier matches the errorcode and returns
    // TRANSIENT — friendlier than silent zero funds because the UI
    // shows "AliceBlue is undergoing maintenance" instead of just
    // hiding the cash row.
    const r = classifyFundsResponse(RESP_MAINTENANCE, 'connected', 'AliceBlue');
    expect(r.reason).toBe('TRANSIENT');
    expect(r.ok).toBe(false);
  });

  test('no-data → OK (no false expiry)', () => {
    const r = classifyFundsResponse(RESP_NO_DATA, 'connected', 'AliceBlue');
    expect(r.reason).toBe('OK');
    expect(r.ok).toBe(true);
  });

  test('real 401 → TOKEN_EXPIRED (correctly opens reconnect modal)', () => {
    const r = classifyFundsResponse(RESP_REAL_401, 'connected', 'AliceBlue');
    expect(r.reason).toBe('TOKEN_EXPIRED');
    expect(r.ok).toBe(false);
  });

  test('token expired → TOKEN_EXPIRED', () => {
    const r = classifyFundsResponse(RESP_TOKEN_EXPIRED, 'connected', 'AliceBlue');
    expect(r.reason).toBe('TOKEN_EXPIRED');
    expect(r.ok).toBe(false);
  });

  test('success → OK', () => {
    const r = classifyFundsResponse(RESP_SUCCESS, 'connected', 'AliceBlue');
    expect(r.reason).toBe('OK');
    expect(r.ok).toBe(true);
  });

  test('legacy maintenance shape (status:1 + keyword) → TRANSIENT (soft toast, not modal)', () => {
    const r = classifyFundsResponse(
      RESP_LEGACY_MAINTENANCE_KEYWORD_ONLY,
      'connected',
      'AliceBlue',
    );
    expect(r.reason).toBe('TRANSIENT');
    expect(r.ok).toBe(false);
  });

  test('disconnected broker → NOT_CONNECTED', () => {
    const r = classifyFundsResponse(RESP_SUCCESS, 'disconnected', 'AliceBlue');
    expect(r.reason).toBe('NOT_CONNECTED');
  });

  test('null funds (network failure on the network probe) → TOKEN_EXPIRED', () => {
    const r = classifyFundsResponse(null, 'connected', 'AliceBlue');
    expect(r.reason).toBe('TOKEN_EXPIRED');
  });
});
