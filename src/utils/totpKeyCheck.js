import {generateDeviceTotpFromSeed} from '../services/DeviceTotpVault';

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
