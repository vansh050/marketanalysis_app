/**
 * Hermes-safe RFC 6238 TOTP (SHA-1, 6 digits, 30 s step) — the codes every
 * broker authenticator (Google Authenticator, Fyers/Kotak/Upstox/Dhan/Angel
 * One/Arihant/AliceBlue) issues.
 *
 * Replaces `otplib` in the app bundle. otplib v13 crashes Hermes at module
 * load (`new TextDecoder()` at top level — Hermes has no TextDecoder) and no
 * longer exports the v12 `authenticator` object the app imported, so every
 * device-TOTP generate/check was either a fatal crash or `undefined`.
 * Documented in docs/BROKER_CONNECTION.md § "Device TOTP runtime".
 *
 * API mirrors the old otplib v12 `authenticator` so call sites are unchanged:
 *   authenticator.generate(base32Secret) -> '123456'
 *   authenticator.check(token, base32Secret) -> boolean (±1 step for drift)
 */
import HmacSHA1 from 'crypto-js/hmac-sha1';
import Hex from 'crypto-js/enc-hex';

const STEP_SECONDS = 30;
const DIGITS = 6;
const DRIFT_STEPS = 1;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32ToHex = secret => {
  const clean = String(secret || '')
    .replace(/\s+/g, '')
    .replace(/=+$/, '')
    .toUpperCase();
  if (!clean || /[^A-Z2-7]/.test(clean)) {
    throw new Error('The TOTP secret is not valid Base32.');
  }
  let bits = '';
  for (const char of clean) {
    bits += BASE32_ALPHABET.indexOf(char).toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    hex += parseInt(bits.slice(i, i + 8), 2).toString(16).padStart(2, '0');
  }
  return hex;
};

const counterToHex = counter => {
  // 8-byte big-endian counter; split to stay exact beyond 2^32.
  const high = Math.floor(counter / 0x100000000);
  const low = counter % 0x100000000;
  return high.toString(16).padStart(8, '0') + low.toString(16).padStart(8, '0');
};

export const hotp = (secretHex, counter, digits = DIGITS) => {
  const digest = HmacSHA1(Hex.parse(counterToHex(counter)), Hex.parse(secretHex))
    .toString(Hex);
  const offset = parseInt(digest.slice(-1), 16);
  const binary = parseInt(digest.slice(offset * 2, offset * 2 + 8), 16) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
};

const currentCounter = (nowMs = Date.now()) =>
  Math.floor(nowMs / 1000 / STEP_SECONDS);

export const authenticator = Object.freeze({
  generate(secret, nowMs) {
    return hotp(base32ToHex(secret), currentCounter(nowMs));
  },
  check(token, secret, nowMs) {
    const code = String(token || '');
    if (!/^\d{6}$/.test(code)) return false;
    const secretHex = base32ToHex(secret);
    const counter = currentCounter(nowMs);
    for (let delta = -DRIFT_STEPS; delta <= DRIFT_STEPS; delta += 1) {
      if (hotp(secretHex, counter + delta) === code) return true;
    }
    return false;
  },
});

export default authenticator;
