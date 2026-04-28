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

const decryptValue = (encrypted) => {
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
 */
export const getStoredBrokerCreds = (userDetails, brokerName) => {
  if (!userDetails || !brokerName) return null;
  const entry = (userDetails.connected_brokers || []).find(
    (b) => b.broker === brokerName,
  );
  if (!entry) return null;

  return {
    apiKey: decryptValue(entry.apiKey),
    secretKey: decryptValue(entry.secretKey),
    clientCode: entry.clientCode || '',
  };
};

export default { getStoredBrokerCreds };
