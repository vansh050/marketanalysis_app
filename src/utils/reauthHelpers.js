// reauthHelpers.js — smart broker re-auth orchestration.
//
// Mirrors web prod-alphaquark-github/src/Home/Subscriptions/subscription.js
// (handleCredentialReauth + setPrimaryBrokerRequest). For credential
// brokers the backend uses stored creds to generate a pre-signed OAuth
// URL, which we hand to the per-broker modal so the user does not have
// to re-enter apiKey/secretKey on every session expiry.

import axios from 'axios';
import Config from 'react-native-config';
import server from './serverConfig';
import { generateToken } from './SecurityTokenManager';
import { getAdvisorSubdomain } from './variantHelper';
import { getStoredBrokerCreds } from './brokerCredentials';
import useModalStore from '../GlobalUIModals/modalStore';

// Brokers where the backend can regenerate a login URL from stored
// credentials. Other brokers must go through the full per-broker modal
// (OAuth partner flow for Zerodha/Angel/Dhan/AliceBlue/Axis, TOTP form
// for Kotak).
export const CREDENTIAL_REAUTH_BROKERS = new Set([
  'ICICI Direct',
  'Upstox',
  'Motilal Oswal',
  'Hdfc Securities',
  'HDFC Securities',
  'Fyers',
]);

// Brokers that support silent refresh — backend regenerates the broker
// session token from stored credentials with NO user interaction
// required. Today: Groww (uses stored Base32 TOTP seed via
// /api/groww/refresh-token to mint fresh JWT every reconnect).
export const SILENT_REFRESH_BROKERS = new Set(['Groww']);

// Backend broker name → ModalManager switch key. Must stay in sync with
// ModalManager.js and ManageConnectionsModal.BROKER_MODAL_KEY_MAP.
const BROKER_MODAL_KEY_MAP = {
  'ICICI Direct': 'ICICI',
  'Upstox': 'Upstox',
  'Motilal Oswal': 'Motilal',
  'Hdfc Securities': 'HDFC',
  'HDFC Securities': 'HDFC',
  'Fyers': 'Fyers',
  'Kotak': 'Kotak',
};

const buildHeaders = (configData) => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain':
    configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET,
  ),
});

/**
 * Flip primary_broker on the backend. Called before re-auth so that if
 * the user backs out of the OAuth step the new primary still sticks —
 * matches web subscription.js:161.
 */
export const flipPrimaryBroker = async (brokerName, userEmail, configData) => {
  try {
    await axios.put(
      `${server.server.baseUrl}api/user/brokers/${encodeURIComponent(
        brokerName,
      )}/primary`,
      { email: userEmail },
      { headers: buildHeaders(configData) },
    );
  } catch (err) {
    console.warn(
      `[reauthHelpers] flipPrimaryBroker(${brokerName}) failed:`,
      err?.message,
    );
  }
};

/**
 * Mark a broker's connected_brokers[] entry as `status='expired'` on
 * the backend. Called when the user taps "Reconnect" — the act of
 * tapping reconnect IS the user's signal that the current session is
 * bad and needs refresh. UI then shows "Re-auth needed" / "Session
 * Expired" badge.
 *
 * If the subsequent OAuth (or credentials) flow succeeds, the
 * per-broker connect-broker route will overwrite status back to
 * 'connected'. If the user backs out of the OAuth step, status stays
 * 'expired' and the UI correctly reflects the state instead of
 * lingering on "Connected" with a stale token_expire.
 *
 * Was previously missing — user reported 2026-04-29 that AliceBlue
 * still showed "Connected" after a backed-out reconnect attempt.
 */
export const markBrokerExpired = async (brokerName, userEmail, configData) => {
  try {
    await axios.put(
      `${server.server.baseUrl}api/user/brokers/${encodeURIComponent(
        brokerName,
      )}/status`,
      { email: userEmail, status: 'expired' },
      { headers: buildHeaders(configData) },
    );
  } catch (err) {
    console.warn(
      `[reauthHelpers] markBrokerExpired(${brokerName}) failed:`,
      err?.message,
    );
  }
};

/**
 * Call GET /api/user/brokers/{broker}/reauth-url. Returns the parsed
 * response body ({ success, url?, requiresTotp?, requiresForm? }) or
 * null on network error.
 */
const fetchReauthUrl = async (
  brokerName,
  userEmail,
  redirectUrl,
  configData,
) => {
  try {
    const response = await axios.get(
      `${server.server.baseUrl}api/user/brokers/${encodeURIComponent(
        brokerName,
      )}/reauth-url`,
      {
        params: { email: userEmail, redirectUrl },
        headers: buildHeaders(configData),
      },
    );
    return response.data || null;
  } catch (err) {
    console.warn(
      `[reauthHelpers] fetchReauthUrl(${brokerName}) failed:`,
      err?.response?.data?.message || err?.message,
    );
    return null;
  }
};

/**
 * High-level entry for smart re-auth. Handles the credential-broker
 * branch (Upstox/ICICI/HDFC/Motilal/Fyers) end-to-end: fetches the
 * pre-signed URL, decrypts stored creds, and opens the per-broker
 * modal with a reauthConfig payload so it skips the form.
 *
 * For partner-OAuth brokers and TOTP brokers, returns { handled: false }
 * and lets the caller fall back to opening the modal normally.
 *
 * @returns { handled: boolean, reason?: string }
 */
/**
 * Silent refresh path for brokers where the backend can regenerate the
 * session token from stored credentials with NO user interaction.
 * Today: Groww. POSTs /api/<broker>/refresh-token, expects 2xx on
 * success. Returns { ok: boolean, message?: string }.
 */
export const performSilentRefresh = async ({
  brokerName,
  userEmail,
  userDetails,
  configData,
}) => {
  if (!SILENT_REFRESH_BROKERS.has(brokerName)) {
    return { ok: false, reason: 'not-silent-refresh-broker' };
  }
  try {
    const uid = userDetails?._id;
    const slug = brokerName === 'Groww' ? 'groww' : brokerName.toLowerCase();
    const response = await axios.post(
      `${server.server.baseUrl}api/${slug}/refresh-token`,
      { uid, user_email: userEmail },
      { headers: buildHeaders(configData) },
    );
    return {
      ok: response.status >= 200 && response.status < 300,
      message: response.data?.message,
    };
  } catch (err) {
    console.warn(
      `[reauthHelpers] performSilentRefresh(${brokerName}) failed:`,
      err?.response?.data?.message || err?.message,
    );
    return {
      ok: false,
      message: err?.response?.data?.message || err?.message,
    };
  }
};

export const handleSmartReauth = async ({
  brokerName,
  userEmail,
  userDetails,
  configData,
  brokerConnectRedirectURL,
}) => {
  // Silent refresh path — Groww. Backend uses stored Base32 TOTP seed
  // to mint a fresh JWT; no user interaction required. On success the
  // caller closes ManageConnectionsModal without opening any per-broker
  // modal at all.
  if (SILENT_REFRESH_BROKERS.has(brokerName)) {
    console.log('[smartReauth]', brokerName, '→ trying silent refresh');
    const result = await performSilentRefresh({
      brokerName,
      userEmail,
      userDetails,
      configData,
    });
    if (result.ok) {
      console.log('[smartReauth]', brokerName, '→ silent refresh OK');
      return { handled: true, silent: true, brokerName };
    }
    // Silent refresh failed — fall through to legacy modal so user can
    // re-paste fresh JWT + Base32 seed (e.g. seed got revoked at broker).
    console.log('[smartReauth]', brokerName, '→ silent refresh failed, fallback');
    return { handled: false, reason: 'silent-refresh-failed' };
  }

  // Non-credential brokers — let caller open the modal normally
  if (!CREDENTIAL_REAUTH_BROKERS.has(brokerName)) {
    console.log('[smartReauth]', brokerName, '→ not-credential-broker (fallback)');
    return { handled: false, reason: 'not-credential-broker' };
  }

  const modalKey = BROKER_MODAL_KEY_MAP[brokerName];
  if (!modalKey) {
    console.log('[smartReauth]', brokerName, '→ no-modal-key (fallback)');
    return { handled: false, reason: 'no-modal-key' };
  }

  const response = await fetchReauthUrl(
    brokerName,
    userEmail,
    brokerConnectRedirectURL,
    configData,
  );
  console.log('[smartReauth]', brokerName, 'reauth-url response:', response);

  // Backend says Kotak/Groww require interactive form — fall through
  if (!response || response.requiresTotp || response.requiresForm) {
    console.log('[smartReauth]', brokerName, '→ requires-form (fallback)');
    return { handled: false, reason: 'requires-form' };
  }

  if (!response.url) {
    console.log('[smartReauth]', brokerName, '→ no-url in response (fallback)');
    return { handled: false, reason: 'no-url' };
  }

  // Decrypt stored creds for the post-WebView code exchange step
  const creds = getStoredBrokerCreds(userDetails, brokerName);
  console.log('[smartReauth]', brokerName, 'local creds present:', {
    hasApiKey: !!creds?.apiKey,
    hasSecretKey: !!creds?.secretKey,
    hasClientCode: !!creds?.clientCode,
  });
  if (!creds || !creds.apiKey) {
    console.log('[smartReauth]', brokerName, '→ no-local-creds (fallback)');
    return { handled: false, reason: 'no-local-creds' };
  }

  // Don't call openModal here — return the dispatch so the caller can
  // open it after ManageConnectionsModal has unmounted. Android
  // swallows the second of two stacked transparent Modals; opening
  // mid-flow here used to "work" for credential brokers only because
  // the axios(/reauth-url) delay happened to give React time to
  // unmount the parent first. Now deterministic regardless of broker.
  console.log('[smartReauth]', brokerName, '→ queueing WebView open');
  return {
    handled: true,
    modalKey,
    payload: {
      reauthConfig: {
        authUrl: response.url,
        apiKey: creds.apiKey,
        secretKey: creds.secretKey,
        clientCode: creds.clientCode,
      },
    },
  };
};

export default {
  CREDENTIAL_REAUTH_BROKERS,
  flipPrimaryBroker,
  handleSmartReauth,
};
