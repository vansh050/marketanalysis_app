// brokerCredentials.js — read and decrypt stored broker credentials from
// the user object's connected_brokers[] array.
//
// Credentials are stored on the backend encrypted with CryptoJS AES using
// the passphrase 'ApiKeySecret' (see upstoxModal.js:checkValidApiAnSecret
// and siblings). Decrypting client-side lets the smart re-auth flow hand
// plaintext apiKey/secretKey to the credential broker modals so they can
// skip the form and jump straight to the WebView step.

import CryptoJS from 'react-native-crypto-js';

const PASSPHRASE = 'ApiKeySecret';
// Fyers App IDs end in a 3-digit app-type suffix ("-200" for trading apps).
const FYERS_APP_ID = /^[A-Z0-9]+-\d{3}$/i;

export const decryptBrokerCredential = (encrypted) => {
  if (!encrypted) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, PASSPHRASE);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || '';
  } catch (err) {
    console.warn('[brokerCredentials] decrypt failed:', err?.message);
    return '';
  }
};

/**
 * Find the stored credentials for a given broker in userDetails.
 * Returns plaintext { apiKey, secretKey, clientCode } or null if the
 * broker isn't in connected_brokers or has no stored creds.
 *
 * Per-broker field-name mapping handled inline. Most brokers store
 * `apiKey` / `secretKey` in the obvious slots, but Fyers swaps them
 * (modal `apiKey` = DB `secretKey` = OAuth secret; modal `secretKey`
 * = DB `clientCode` = client ID). Mirror of FyersConnect.js:345-355
 * reauth hydration which translates DB → modal field naming. Without
 * this mapping, smart-reauth's `!creds.apiKey` guard rejected every
 * Fyers re-auth attempt and fell through to the fresh-form path.
 */
export const getStoredBrokerCreds = (userDetails, brokerName) => {
  if (!userDetails || !brokerName) return null;
  const entry = (userDetails.connected_brokers || []).find(
    (b) => b.broker === brokerName,
  );
  if (!entry) return null;

  if (brokerName === 'Fyers') {
    // Two stored layouts exist. Legacy: DB clientCode = App ID. Current
    // (backend /fyers/update-key since the -200 guard): DB apiKey = App ID
    // (plain or AES) and DB clientCode = the Fyers user ID. Pick the App
    // ID by its "-NNN" shape so a reconnect never sends the user ID as the
    // App ID (rejected "malformed appId (not -200)" — Kyzen 2026-10-13).
    const plainOrDecrypted = (v) => {
      if (!v) return '';
      const s = String(v);
      return s.startsWith('U2FsdGVk') ? decryptBrokerCredential(s) : s;
    };
    const candidates = [plainOrDecrypted(entry.apiKey), entry.clientCode || ''];
    const appId = candidates.find((v) => FYERS_APP_ID.test(v)) || entry.clientCode || '';
    const fyersUserId = entry.clientCode && entry.clientCode !== appId ? entry.clientCode : '';
    return {
      apiKey: decryptBrokerCredential(entry.secretKey),    // OAuth secret
      secretKey: appId,                                    // App ID (form field naming)
      clientCode: entry.clientCode || '',
      appId,
      fyersUserId,
    };
  }

  if (brokerName === 'Kotak') {
    // Kotak NEO has 5 form fields: apiKey, mobileNumber, mpin, ucc,
    // totp. Backend (Routes/Broker/Kotak.js:168-189) only persists
    // apiKey (encrypted) + clientCode (=ucc) in connected_brokers[],
    // plus phone_number on the user doc. mpin and totp are NEVER
    // stored (security: mpin is a personal PIN; totp rotates 30s).
    // Pre-fill apiKey + ucc; caller pulls mobileNumber from
    // userDetails.phone_number separately. User still types mpin +
    // totp on every reconnect — that's the best achievable for a
    // PIN-protected broker.
    return {
      apiKey: decryptBrokerCredential(entry.apiKey),
      ucc: entry.clientCode || '',
    };
  }

  if (brokerName === 'Groww') {
    // Groww has 2 form fields: apiKey (long JWT) + totpToken (Base32
    // secret, stored DB as `totp_seed`). Both stored encrypted. The
    // Base32 seed is the long-lived credential — backend can refresh
    // the JWT silently via /api/groww/refresh-token. For modal
    // pre-fill: decrypt both. Note backend stores totp_seed under
    // that field name; legacy GrowwConnectModal doesn't pre-fill at
    // all (legacy bug — every reconnect was a full re-paste).
    return {
      apiKey: decryptBrokerCredential(entry.apiKey),
      totpToken: decryptBrokerCredential(entry.totp_seed || entry.totpToken),
    };
  }

  return {
    apiKey: decryptBrokerCredential(entry.apiKey),
    secretKey: decryptBrokerCredential(entry.secretKey),
    clientCode: entry.clientCode || '',
  };
};

export default {decryptBrokerCredential, getStoredBrokerCreds};
