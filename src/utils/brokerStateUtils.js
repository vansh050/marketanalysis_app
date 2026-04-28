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

export default {
  isStatusExpired,
  isTokenExpired,
  isBrokerSessionExpired,
  getPrimaryBrokerEntry,
};
