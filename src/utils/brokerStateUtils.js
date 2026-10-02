// brokerStateUtils.js — single source of truth for "is this broker's
// session actually usable right now?".
//
// Backend's `connected_brokers[].status` is not always fresh — e.g.,
// ICICI can be `'connected'` in the DB well after the broker-side
// session expired, because status is only flipped when a trade fails
// or a reconnect happens. Cross-checking `token_expire` against the
// current time gives us a client-side signal that's accurate even if
// the status field is stale.
//
// Also used by SubscriptionScreen's top "Broker Connected" card so it
// flips to "Session Expired" when the primary broker's session has
// really lapsed, instead of trusting the top-level
// `connect_broker_status` flag (which reflects "user has any broker
// at all" rather than "primary is usable").

const EXPIRED_STATUSES = new Set(['expired', 'error']);
const DISCONNECTED_STATUSES = new Set([
  'disconnected',
  'removed',
  'revoked',
  'deleted',
]);

export const isStatusExpired = (status) =>
  typeof status === 'string' && EXPIRED_STATUSES.has(status.toLowerCase());

export const isTokenExpired = (tokenExpire) => {
  if (!tokenExpire) return false; // no expiry info — assume not expired
  const ts = new Date(tokenExpire).getTime();
  if (Number.isNaN(ts)) return false;
  return ts <= Date.now();
};

/**
 * A broker's session is expired if EITHER the backend marked it
 * expired/error OR the token_expire timestamp is in the past. Returns
 * true for `null`/`undefined` entries to be safe (no entry = no usable
 * session).
 */
export const isBrokerSessionExpired = (entry) => {
  if (!entry) return true;
  return isStatusExpired(entry.status) || isTokenExpired(entry.token_expire);
};

/**
 * Find the user's primary broker's connected_brokers[] entry. Returns
 * null if no primary is set or the primary isn't in the array.
 */
export const getPrimaryBrokerEntry = (userDetails) => {
  if (!userDetails) return null;
  const primary = userDetails.primary_broker || userDetails.user_broker;
  if (!primary) return null;
  return (
    (userDetails.connected_brokers || []).find((b) => b?.broker === primary) ||
    null
  );
};

const hasText = value => typeof value === 'string' && value.trim().length > 0;

const brokerOwnsRootCredentials = (userDetails, brokerName) =>
  userDetails?.primary_broker === brokerName ||
  userDetails?.user_broker === brokerName;

const credentialValue = (userDetails, entry, brokerName, field) => {
  if (hasText(entry?.[field])) return entry[field];
  return brokerOwnsRootCredentials(userDetails, brokerName) &&
    hasText(userDetails?.[field])
    ? userDetails[field]
    : '';
};

/**
 * Classify the reconnect path from the latest server user document.
 *
 * Presence in connected_brokers[] alone is not enough: a hard disconnect may
 * leave a stale/disconnected slot, and an old slot may not contain the API
 * credentials that the server-side quick-reconnect endpoint requires. The
 * returned object deliberately contains metadata only—never credential
 * values—so it is safe to use in diagnostics.
 */
export const getServerBrokerReconnectState = (userDetails, brokerName) => {
  const slots = Array.isArray(userDetails?.connected_brokers)
    ? userDetails.connected_brokers
    : [];
  const entry = slots.find(item => item?.broker === brokerName) || null;
  const status = String(entry?.status || '').trim().toLowerCase();
  const explicitlyDisconnected = DISCONNECTED_STATUSES.has(status);

  let credentialsComplete = Boolean(entry);
  if (entry) {
    switch (brokerName) {
      case 'Fyers':
        credentialsComplete =
          hasText(credentialValue(userDetails, entry, brokerName, 'secretKey')) &&
          (hasText(credentialValue(userDetails, entry, brokerName, 'apiKey')) ||
            hasText(credentialValue(userDetails, entry, brokerName, 'clientCode')));
        break;
      case 'Motilal Oswal':
        credentialsComplete =
          hasText(credentialValue(userDetails, entry, brokerName, 'apiKey')) &&
          hasText(credentialValue(userDetails, entry, brokerName, 'clientCode'));
        break;
      case 'Angel One':
      case 'Zerodha':
        credentialsComplete = hasText(
          credentialValue(userDetails, entry, brokerName, 'apiKey'),
        );
        break;
      default:
        credentialsComplete = true;
    }
  }

  const requiresOAuth =
    !entry || explicitlyDisconnected || !credentialsComplete;
  const reason = !entry
    ? 'slot_missing'
    : explicitlyDisconnected
      ? 'server_disconnected'
      : !credentialsComplete
        ? 'server_credentials_incomplete'
        : 'server_reconnect_ready';

  return {
    hasSlot: Boolean(entry),
    slotCount: slots.length,
    status: status || 'unknown',
    credentialsComplete,
    requiresOAuth,
    reason,
  };
};

export default {
  isStatusExpired,
  isTokenExpired,
  isBrokerSessionExpired,
  getPrimaryBrokerEntry,
  getServerBrokerReconnectState,
};
