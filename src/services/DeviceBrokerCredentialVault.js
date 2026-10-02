import * as Keychain from 'react-native-keychain';

// Exact broker/field allowlist for values already validated and persisted by
// the backend. Deliberately absent: password, mpin, dob, otp, totp, jwtToken,
// accessToken, authCode, otpToken, txnId and every other session/challenge
// value. The vault is for durable developer/API credentials only.
const VAULT_FIELDS = Object.freeze({
  'Angel One': ['apiKey', 'clientCode'],
  Upstox: ['apiKey', 'secretKey', 'clientCode'],
  'ICICI Direct': ['apiKey', 'secretKey', 'clientCode'],
  'Hdfc Securities': ['apiKey', 'secretKey', 'clientCode'],
  Fyers: ['apiKey', 'secretKey', 'clientCode'],
  'Motilal Oswal': ['apiKey', 'secretKey', 'clientCode'],
  'Arihant Capital': ['apiKey', 'secretKey', 'clientCode'],
  'DefinEdge Securities': ['apiKey', 'secretKey', 'clientCode'],
});

const normalize = value =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');

const serviceFor = ({advisor, broker, userEmail}) =>
  `com.alphaquark.broker-credentials.${normalize(advisor)}.${normalize(broker)}.${normalize(userEmail)}`;

export const supportsDeviceBrokerCredentialVault = broker =>
  Array.isArray(VAULT_FIELDS[broker]);

export const findPersistedBrokerEntry = (userDetails, broker) =>
  (userDetails?.connected_brokers || []).find(entry => entry?.broker === broker) || null;

const sanitizePersistedEntry = (broker, entry) => {
  const allowed = VAULT_FIELDS[broker];
  if (!allowed || !entry || entry.broker !== broker) {
    throw new Error('This broker does not support device-protected API credentials.');
  }
  const sanitized = {broker};
  for (const field of allowed) {
    const value = entry[field];
    if (typeof value === 'string' && value.length > 0 && value.length <= 8192) {
      sanitized[field] = value;
    }
  }
  if (Object.keys(sanitized).length === 1) {
    throw new Error('No validated reusable API credentials are available to protect.');
  }
  return sanitized;
};

export async function savePersistedBrokerCredentials(identity, entry) {
  const sanitized = sanitizePersistedEntry(identity?.broker, entry);
  await Keychain.setGenericPassword('broker-api-credentials', JSON.stringify(sanitized), {
    service: serviceFor(identity),
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
    authenticationPrompt: {title: 'Protect broker API credentials'},
  });
  return true;
}

export async function unlockPersistedBrokerCredentials(identity) {
  const credentials = await Keychain.getGenericPassword({
    service: serviceFor(identity),
    authenticationPrompt: {
      title: 'Unlock broker connection',
      subtitle: 'Authenticate to use API credentials protected on this phone',
      cancel: 'Cancel',
    },
  });
  if (!credentials) return null;
  let parsed;
  try {
    parsed = JSON.parse(credentials.password);
  } catch (_) {
    throw new Error('The protected broker credential record is damaged. Re-enrol it.');
  }
  return sanitizePersistedEntry(identity?.broker, parsed);
}

export async function hasPersistedBrokerCredentials(identity) {
  return Keychain.hasGenericPassword({service: serviceFor(identity)});
}

export async function removePersistedBrokerCredentials(identity) {
  return Keychain.resetGenericPassword({service: serviceFor(identity)});
}

export default {
  supportsDeviceBrokerCredentialVault,
  findPersistedBrokerEntry,
  savePersistedBrokerCredentials,
  unlockPersistedBrokerCredentials,
  hasPersistedBrokerCredentials,
  removePersistedBrokerCredentials,
};
