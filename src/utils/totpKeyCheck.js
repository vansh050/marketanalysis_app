import {
  generateDeviceTotpFromSeed,
  normalizeDeviceTotpSeedInput,
} from '../services/DeviceTotpVault';

// Shows the 6-digit code a pasted setup key produces right now, so the
// customer can compare it with their authenticator before the broker sees it.
export const describeSeedCheck = (seed, brokerName, nowMs = Date.now()) => {
  if (!String(seed || '').trim()) return '';
  try {
    const code = generateDeviceTotpFromSeed(seed);
    const secondsLeft = 30 - (Math.floor(nowMs / 1000) % 30);
    return `Key check: this key gives ${code} now (changes in ${secondsLeft}s). Your authenticator's ${brokerName} code must show the same. If it doesn't, the key is wrong or ${brokerName} TOTP was re-enabled with a new key; fix that before verifying, because wrong codes count towards the broker's login lock.`;
  } catch (_) {
    return '';
  }
};

// Says WHY a pasted TOTP setup key was rejected, without echoing the value.
// A bare "not a valid Base32 key" left testers guessing (Kyzen QA 2026-10-15,
// Upstox): the usual mistakes are pasting a 6-digit code or the broker's API
// Secret, which always contains digits a TOTP key never has (0, 1, 8, 9).
export const explainInvalidSeed = (seed, brokerName = 'broker') => {
  const value = normalizeDeviceTotpSeedInput(seed);
  if (!value) return `Paste the TOTP secret from the ${brokerName} TOTP QR (or its manual setup key).`;
  if (/^\d{6}$/.test(value)) {
    return `That is a 6-digit one-time code. Paste the setup key it comes from: the secret in the ${brokerName} TOTP QR (or its manual setup key).`;
  }
  const raw = String(seed || '').replace(/\s+/g, '');
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(raw) && (/[+/=]/.test(raw) || (/[a-z]/.test(raw) && /[A-Z]/.test(raw)))) {
    return `This looks like a Base64 copy of a key, but not one with a TOTP-secret length. Open the ${brokerName} TOTP QR again and copy its setup key (letters A–Z and digits 2–7).`;
  }
  if (/[^A-Z0-9=]/.test(value)) {
    return `It contains characters a TOTP secret never has. A TOTP secret uses only letters A–Z and digits 2–7. Use the secret from the ${brokerName} TOTP QR (or its manual setup key).`;
  }
  if (/[0189]/.test(value)) {
    return `It contains the digit 0, 1, 8 or 9, which a TOTP secret never has. This is usually the ${brokerName} API Secret. Use the secret from the ${brokerName} TOTP QR (or its manual setup key) instead.`;
  }
  return `This is not a valid TOTP setup key. Use the secret from the ${brokerName} TOTP QR (or its manual setup key); it uses only letters A–Z and digits 2–7.`;
};
