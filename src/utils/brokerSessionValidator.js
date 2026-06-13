/**
 * validateBrokerSession — typed pre-trade auth probe.
 *
 * Thin wrapper over `fetchFunds` + `isFundsErrorOrMissing` + `isTransientFundsError`
 * that classifies the result into a reason code callers can branch on:
 *
 *   OK             → session is live, funds are fresh, proceed with trade.
 *   NOT_CONNECTED  → no broker connected at all (brokerStatus !== 'connected').
 *                    Caller should open the broker-selection modal.
 *   TRANSIENT      → broker is temporarily unavailable (Upstox 00:00–05:30 IST
 *                    maintenance, ICICI Breeze base-64 hiccup, etc.). Caller
 *                    should show a soft toast ("try again in a few minutes")
 *                    and NOT prompt reconnect — the user's stored token is
 *                    still valid.
 *   TOKEN_EXPIRED  → real auth failure. Funds returned status 1/2 or null
 *                    while broker is connected AND message isn't transient.
 *                    Caller should open TokenExpireBrokerModal.
 *   PROBE_FAILED   → network-level failure reaching ccxt (timeout, DNS,
 *                    non-2xx without a body we can classify). We can't tell
 *                    whether the token is valid or not — caller should let
 *                    the trade attempt proceed; the actual order-placement
 *                    call will surface any real issue, and we don't want to
 *                    wrongly block trades on a connectivity blip.
 *
 * Returns `{ok, reason, message, funds}`. `funds` is the raw response when
 * we got one (useful for downstream cash-availability checks).
 *
 * Intentionally does NOT call setFunds / setBrokerStatus — callers own
 * state updates. This helper is pure I/O + classification.
 */
import {fetchFunds} from '../FunctionCall/fetchFunds';
import {isFundsErrorOrMissing, isTransientFundsError} from './rebalanceHelpers';

/**
 * Sync classifier — given a funds response that the caller has ALREADY
 * fetched (e.g. via `useRefreshBrokerStatus({forceNetwork: true})`),
 * return the same `{ok, reason, message, funds}` shape without firing
 * the network call again. Use this at sites that already have fresh
 * funds in hand; use [validateBrokerSession] when you don't.
 *
 * Reasons identical to validateBrokerSession:
 *   OK | NOT_CONNECTED | TRANSIENT | TOKEN_EXPIRED
 *
 * (PROBE_FAILED is exclusive to validateBrokerSession — it represents a
 * network failure during the helper's own probe; if you already have a
 * funds object, by definition the probe didn't fail.)
 */
export function classifyFundsResponse(funds, brokerStatus, broker) {
  if (!broker || brokerStatus !== 'connected') {
    return {
      ok: false,
      reason: 'NOT_CONNECTED',
      message: 'No broker connected',
      funds: funds || null,
    };
  }
  if (!funds) {
    return {
      ok: false,
      reason: 'TRANSIENT',
      message: `${broker} funds unavailable. You can still place orders.`,
      funds: null,
    };
  }
  if (isTransientFundsError(funds, broker)) {
    return {
      ok: false,
      reason: 'TRANSIENT',
      message:
        funds.message ||
        `${broker} is temporarily unavailable. Please try again in a few minutes.`,
      funds,
    };
  }
  if (isFundsErrorOrMissing(funds, brokerStatus, broker)) {
    return {
      ok: false,
      reason: 'TOKEN_EXPIRED',
      message: funds.message || `${broker} session expired. Please reconnect.`,
      funds,
    };
  }
  return {
    ok: true,
    reason: 'OK',
    message: null,
    funds,
  };
}

export async function validateBrokerSession({
  broker,
  brokerStatus,
  userDetails,
  userEmail,
}) {
  if (!broker || brokerStatus !== 'connected') {
    return {
      ok: false,
      reason: 'NOT_CONNECTED',
      message: 'No broker connected',
      funds: null,
    };
  }
  if (!userDetails) {
    return {
      ok: false,
      reason: 'NOT_CONNECTED',
      message: 'User details not available',
      funds: null,
    };
  }

  let funds;
  try {
    funds = await fetchFunds(
      broker,
      userDetails.clientCode,
      userDetails.apiKey,
      userDetails.jwtToken,
      userDetails.secretKey,
      userDetails.sid,
      userDetails.serverId,
      userEmail,
    );
  } catch (err) {
    return {
      ok: false,
      reason: 'PROBE_FAILED',
      message: err?.message || 'Funds probe failed',
      funds: null,
    };
  }

  return classifyFundsResponse(funds, brokerStatus, broker);
}

export default validateBrokerSession;
