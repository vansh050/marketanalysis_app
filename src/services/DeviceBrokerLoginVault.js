import * as Keychain from 'react-native-keychain';
import {authenticator} from '../utils/totp';
import {
  friendlyDeviceAuthError,
  normalizeDeviceTotpSeedInput,
} from './DeviceTotpVault';

const normalize = value =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
const normalizeSeed = normalizeDeviceTotpSeedInput;
const serviceFor = ({advisor, broker, userEmail}) =>
  `com.alphaquark.broker-login.${normalize(advisor)}.${normalize(broker)}.${normalize(userEmail)}`;

const sanitizeAliceBlue = record => {
  if (record?.broker && record.broker !== 'AliceBlue') {
    throw new Error('Protected broker login record does not match AliceBlue.');
  }
  const userId = String(record?.userId || '').trim();
  const password = String(record?.password || '');
  const totpSeed = normalizeSeed(record?.totpSeed);
  if (!userId || userId.length > 256) {
    throw new Error('Enter a valid AliceBlue user ID.');
  }
  if (!password || password.length > 1024) {
    throw new Error('Enter a valid AliceBlue password.');
  }
  if (!totpSeed || !/^[A-Z2-7]+=*$/.test(totpSeed)) {
    throw new Error('Enter a valid Base32 AliceBlue TOTP secret.');
  }
  return {version: 1, broker: 'AliceBlue', userId, password, totpSeed};
};

export async function saveAliceBlueDeviceLogin(
  identity,
  record,
  verificationCode,
) {
  if (identity?.broker !== 'AliceBlue') {
    throw new Error('This device login vault is only enabled for AliceBlue.');
  }
  const sanitized = sanitizeAliceBlue(record);
  let code = String(verificationCode || '');
  if (!code) {
    try {
      code = authenticator.generate(sanitized.totpSeed);
    } catch (_) {
      code = '';
    }
  }
  if (!authenticator.check(code, sanitized.totpSeed)) {
    throw new Error('The AliceBlue TOTP secret or verification code is invalid.');
  }
  await Keychain.setGenericPassword(
    'broker-login',
    JSON.stringify(sanitized),
    {
      service: serviceFor(identity),
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      authenticationType:
        Keychain.AUTHENTICATION_TYPE?.DEVICE_PASSCODE_OR_BIOMETRICS,
      authenticationPrompt: {title: 'Protect AliceBlue login'},
    },
  );
  return true;
}

export async function unlockAliceBlueDeviceLogin(identity) {
  if (identity?.broker !== 'AliceBlue') return null;
  let credentials;
  try {
    credentials = await Keychain.getGenericPassword({
      service: serviceFor(identity),
      authenticationType:
        Keychain.AUTHENTICATION_TYPE?.DEVICE_PASSCODE_OR_BIOMETRICS,
      authenticationPrompt: {
        title: 'Unlock AliceBlue reconnect',
        subtitle: 'Use biometrics or your device PIN to continue',
        cancel: 'Cancel',
      },
    });
  } catch (error) {
    throw friendlyDeviceAuthError(error);
  }
  if (!credentials) return null;
  let parsed;
  try {
    parsed = JSON.parse(credentials.password);
  } catch (_) {
    throw new Error('The protected AliceBlue login is damaged. Re-enrol it.');
  }
  return sanitizeAliceBlue(parsed);
}

export async function hasAliceBlueDeviceLogin(identity) {
  return Keychain.hasGenericPassword({service: serviceFor(identity)});
}

export async function removeAliceBlueDeviceLogin(identity) {
  return Keychain.resetGenericPassword({service: serviceFor(identity)});
}
