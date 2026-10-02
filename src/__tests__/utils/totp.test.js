import fs from 'fs';
import path from 'path';
import {authenticator, base32ToHex, hotp} from '../../utils/totp';

// RFC 6238 Appendix B SHA-1 seed "12345678901234567890" in Base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_SECRET_HEX = '3132333435363738393031323334353637383930';

describe('Hermes-safe TOTP', () => {
  test('decodes Base32 to the RFC seed bytes', () => {
    expect(base32ToHex(RFC_SECRET)).toBe(RFC_SECRET_HEX);
    expect(base32ToHex('gEzDgNbVgY3tQoJqGeZdGnBvGy3TqOjQ')).toBe(
      RFC_SECRET_HEX,
    );
  });

  test.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('matches RFC 6238 vector at T=%i', (seconds, expected) => {
    const hex = base32ToHex(RFC_SECRET);
    expect(hotp(hex, Math.floor(seconds / 30), 8)).toBe(expected);
    expect(authenticator.generate(RFC_SECRET, seconds * 1000)).toBe(expected.slice(-6));
  });

  test('accepts one step of clock drift and rejects older codes', () => {
    const now = 1234567890 * 1000;
    const previous = authenticator.generate(RFC_SECRET, now - 30000);
    const stale = authenticator.generate(RFC_SECRET, now - 90000);
    expect(authenticator.check(authenticator.generate(RFC_SECRET, now), RFC_SECRET, now)).toBe(true);
    expect(authenticator.check(previous, RFC_SECRET, now)).toBe(true);
    expect(authenticator.check(stale, RFC_SECRET, now)).toBe(false);
    expect(authenticator.check('12345', RFC_SECRET, now)).toBe(false);
  });

  test('rejects non-Base32 secrets', () => {
    expect(() => authenticator.generate('not-a-seed!')).toThrow();
  });

  test('app bundle never imports otplib (Hermes has no TextDecoder)', () => {
    const offenders = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
          if (/from ['"]otplib['"]|require\(['"]otplib['"]\)/.test(fs.readFileSync(full, 'utf8'))) {
            offenders.push(full);
          }
        }
      }
    };
    walk(path.join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});
