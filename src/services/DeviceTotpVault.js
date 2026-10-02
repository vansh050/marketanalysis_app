import * as Keychain from 'react-native-keychain';
import {authenticator} from '../utils/totp';

const normalize = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
const serviceFor = ({advisor, broker, userEmail}) =>
  `com.alphaquark.totp.${normalize(advisor)}.${normalize(broker)}.${normalize(userEmail)}`;
export const normalizeDeviceTotpSeedInput = seed => {
  const raw = String(seed || '').trim();
  let candidate = raw;

  // Authenticator QR decoders and some broker portals copy the complete
  // otpauth URI instead of only the secret. Accept that safe representation,
  // but retain only its Base32 `secret` value.
  const uriSecret = raw.match(/[?&]secret=([^&#]+)/i);
  const labelledSecret = raw.match(/^secret\s*[:=]\s*(.+)$/i);
  const encoded = uriSecret?.[1] || labelledSecret?.[1];
  if (encoded) {
    try {
      candidate = decodeURIComponent(encoded);
    } catch (_) {
      candidate = encoded;
    }
  }

  // Broker pages commonly group setup keys with spaces or hyphens. These are
  // presentation separators, not Base32 data. Also discard invisible Unicode
  // clipboard marks that otherwise make a visually correct key fail locally.
  return candidate
    .replace(/[\s\u00AD\u200B\u200C\u200D\u2060\uFEFF\u2010\u2011\u2012\u2013\u2014\u2015-]/g, '')
    .toUpperCase();
};

const normalizeSeed = normalizeDeviceTotpSeedInput;

const DEVICE_AUTH_ERROR =
  /user not authenticated|not authenticated|authentication (?:failed|cancelled|canceled)|biometric|user cancel(?:led|ed)/i;

export const friendlyDeviceAuthError = error => {
  const message = String(error?.message || error || '');
  if (!DEVICE_AUTH_ERROR.test(message)) return error;
  const wrapped = new Error(
    'Phone authentication did not complete. Use your fingerprint, face unlock, or device PIN, then tap Reconnect with biometric unlock again.',
  );
  wrapped.code = 'DEVICE_AUTHENTICATION_REQUIRED';
  return wrapped;
};

export function isValidDeviceTotpSeed(seed, verificationCode) {
  const normalizedSeed = normalizeSeed(seed);
  const code = String(verificationCode || '');
  try {
    return (
      !!normalizedSeed &&
      /^[A-Z2-7]+=*$/.test(normalizedSeed) &&
      authenticator.check(code, normalizedSeed)
    );
  } catch (_) {
    return false;
  }
}

export function generateDeviceTotpFromSeed(seed) {
  const normalizedSeed = normalizeSeed(seed);
  if (!normalizedSeed || !/^[A-Z2-7]+=*$/.test(normalizedSeed)) {
    throw new Error('The TOTP secret is invalid.');
  }
  try {
    return authenticator.generate(normalizedSeed);
  } catch (_) {
    throw new Error('The TOTP secret is invalid.');
  }
}

const FACTOR_RULES = Object.freeze({
  Kotak: {mpin: /^\d{6}$/},
  Upstox: {pin: /^\d{6}$/},
  Dhan: {pin: /^\d{6}$/},
  'Angel One': {mpin: /^\d{4,6}$/, userId: /^.{3,64}$/},
  'Motilal Oswal': {
    password: /^.{4,128}$/,
    twoFactor: /^(?:\d{2}\/\d{2}\/\d{4}|[A-Z]{5}\d{4}[A-Z])$/,
  },
  Zerodha: {password: /^.{4,128}$/, userId: /^.{3,64}$/},
  Fyers: {pin: /^\d{4}$/, userId: /^.{3,64}$/},
  'Arihant Capital': {password: /^.{4,128}$/, userId: /^.{3,64}$/},
});

const sanitizeProtectedValues = (identity, values = {}) => {
  const rules = FACTOR_RULES[identity?.broker] || {};
  const sanitized = {};
  for (const [field, pattern] of Object.entries(rules)) {
    const value = String(values?.[field] || '');
    if (!value) continue;
    if (!pattern.test(value)) {
      throw new Error(`The saved ${field} is invalid for ${identity?.broker}.`);
    }
    sanitized[field] = value;
  }
  const unsupported = Object.keys(values || {}).filter(
    field => values[field] && !Object.prototype.hasOwnProperty.call(rules, field),
  );
  if (unsupported.length) {
    throw new Error(`${unsupported[0]} cannot be stored for ${identity?.broker}.`);
  }
  return sanitized;
};

const parseRecord = value => {
  try {
    const parsed = JSON.parse(value);
    if ((parsed?.version === 2 || parsed?.version === 3) && typeof parsed.seed === 'string') {
      return {
        seed: normalizeSeed(parsed.seed),
        mpin: /^\d{6}$/.test(String(parsed.mpin || ''))
          ? String(parsed.mpin)
          : '',
        pin: /^\d{4,6}$/.test(String(parsed.pin || ''))
          ? String(parsed.pin)
          : '',
        password: typeof parsed.password === 'string' ? parsed.password : '',
        userId: typeof parsed.userId === 'string' ? parsed.userId : '',
        twoFactor: typeof parsed.twoFactor === 'string' ? parsed.twoFactor : '',
      };
    }
  } catch (_) {
    // Version 1 records stored the Base32 seed as the raw password.
  }
  return {
    seed: normalizeSeed(value),
    mpin: '',
    pin: '',
    password: '',
    userId: '',
    twoFactor: '',
  };
};

export async function saveDeviceTotpSeed(
  identity,
  seed,
  verificationCode,
  protectedValues = {},
) {
  const normalizedSeed = normalizeSeed(seed);
  let code = String(verificationCode || '');
  try {
    if (!code && normalizedSeed) code = authenticator.generate(normalizedSeed);
  } catch (_) {
    code = '';
  }
  if (!isValidDeviceTotpSeed(normalizedSeed, code)) {
    throw new Error('The TOTP secret or verification code is invalid.');
  }
  const protectedRecord = sanitizeProtectedValues(identity, protectedValues);
  const serialized = JSON.stringify({
    version: 3,
    seed: normalizedSeed,
    ...protectedRecord,
  });
  await Keychain.setGenericPassword('broker-totp', serialized, {
    service: serviceFor(identity),
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    authenticationType:
      Keychain.AUTHENTICATION_TYPE?.DEVICE_PASSCODE_OR_BIOMETRICS,
    authenticationPrompt: {title: 'Protect broker connection key'},
  });
  return true;
}

export async function generateDeviceTotp(identity) {
  const record = await unlockDeviceTotpRecord(identity);
  return record?.seed ? authenticator.generate(record.seed) : null;
}

export async function unlockDeviceTotpRecord(identity) {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: serviceFor(identity),
      authenticationType:
        Keychain.AUTHENTICATION_TYPE?.DEVICE_PASSCODE_OR_BIOMETRICS,
      authenticationPrompt: {title: 'Unlock broker connection', subtitle: 'Authenticate to use the broker TOTP key stored on this phone', cancel: 'Cancel'},
    });
    return credentials ? parseRecord(credentials.password) : null;
  } catch (error) {
    throw friendlyDeviceAuthError(error);
  }
}

export async function unlockDeviceTotpSeed(identity) {
  const record = await unlockDeviceTotpRecord(identity);
  return record?.seed || null;
}

export async function unlockDeviceTotpLogin(identity) {
  const record = await unlockDeviceTotpRecord(identity);
  if (!record?.seed) return null;
  return {
    totp: authenticator.generate(record.seed),
    mpin: record.mpin || '',
    pin: record.pin || '',
    password: record.password || '',
    userId: record.userId || '',
    twoFactor: record.twoFactor || '',
    // Kept for Kotak re-enrolment compatibility and Arihant's two-stage flow,
    // where the code must be generated only after login initiation returns.
    // Callers must never transmit this value; only a generated TOTP may leave
    // the device.
    seed: record.seed,
  };
}

export async function hasDeviceTotp(identity) {
  return Keychain.hasGenericPassword({service: serviceFor(identity)});
}

export async function removeDeviceTotp(identity) {
  return Keychain.resetGenericPassword({service: serviceFor(identity)});
}
