/**
 * rebalanceHelpers.js
 *
 * Pure helper functions for rebalancing logic, error detection, and
 * broker-specific payload construction.
 * Ported from prod-alphaquark-github web app for consistency.
 */

import CryptoJS from 'react-native-crypto-js';

/**
 * Known broker error codes that are TRANSIENT / non-auth and must
 * NOT trigger the token-expire re-login modal. Callers should
 * proceed with cached funds / show a soft "try again later" toast
 * instead of forcing the customer through an OAuth re-flow.
 */
const TRANSIENT_NON_AUTH_BROKER_ERROR_CODES = {
  // Upstox funds service offline 00:00–05:30 IST daily for
  // broker-side maintenance. JWT still valid.
  'udapi100072': 'Upstox funds service outside its daily window (00:00–05:30 IST)',
  // Upstox place-order API offline 00:00–05:30 IST daily — same
  // nightly maintenance window. Any /order endpoint call during
  // this window returns UDAPI100074 regardless of auth state.
  'udapi100074': 'Upstox place-order API outside its daily window (00:00–05:30 IST)',
  // AliceBlue maintenance window — emitted by ccxt-india
  // `aliceblue.py:_parse_funds_response` when AliceBlue returns
  // `{status:'Info', message:'…temporarily unavailable…'}` (typically
  // overnight / pre-market 09:00 IST onwards). JWT still valid; just
  // the funds/holdings/positions endpoints reject. Production
  // 2026-04-26: post-connect funds-fetch returned this and the
  // app re-popped "Authentication Required → Login to AliceBlue"
  // even though the user had successfully reconnected seconds before.
  'maintenance': 'AliceBlue is undergoing scheduled maintenance. Try again in a few minutes.',
};

/**
 * Soft-check: is this a known transient broker error that should
 * NOT trigger a re-login? Works for both funds-fetch responses
 * and trade-placement result rows — both shapes carry
 * ``error_code`` / ``errorCode`` and ``message``.
 */
export function isTransientFundsError(resp, broker) {
  if (!resp) return false;
  // ccxt emits `errorcode` (lowercase, no separator) on AliceBlue
  // funds responses (production 2026-04-26: `MAINTENANCE` / `NO_DATA`
  // tagging); other broker / endpoint paths historically use
  // `error_code` (snake) or `errorCode` (camel). Cover all three.
  const code = (resp.errorcode || resp.error_code || resp.errorCode || '').toString().toLowerCase();
  if (code && Object.prototype.hasOwnProperty.call(TRANSIENT_NON_AUTH_BROKER_ERROR_CODES, code)) {
    return true;
  }
  const message = (resp.message || '').toLowerCase();
  if (
    message.includes('service is accessible from') ||
    message.includes('temporarily unavailable') ||
    message.includes('try again') ||
    message.includes('service window') ||
    message.includes('market hours')
  ) {
    return true;
  }
  // Upstox /funds is offline 00:00–05:30 IST daily. ccxt's response shape is
  // inconsistent during that window — sometimes `{status: 1, message:
  // "Service is accessible..."}` (caught by keyword above), sometimes
  // `{status: 2, message: undefined}` with nothing to match on. Scope this
  // IST-clock guard to Upstox only — applying it to all brokers would mask
  // a genuinely expired token for e.g. Zerodha at 3 AM. Broker can be
  // passed explicitly; if omitted, the guard is skipped (safe default).
  if (
    (broker === 'Upstox' || broker === 'upstox') &&
    (resp.status === 1 || resp.status === 2) &&
    isInUpstoxMaintenanceWindow()
  ) {
    return true;
  }
  return false;
}

/**
 * True if current IST clock is inside Upstox's 12:00 AM – 5:30 AM daily
 * maintenance window. Computed from the user's local offset shifted to
 * Asia/Kolkata (+05:30) so it works regardless of device timezone.
 */
function isInUpstoxMaintenanceWindow() {
  const nowUtcMs = Date.now();
  const istMs = nowUtcMs + 5.5 * 60 * 60 * 1000;
  const istDate = new Date(istMs);
  // Use UTC getters on the shifted epoch — treating the shifted Date as
  // if it were UTC gives us the IST wall clock.
  const h = istDate.getUTCHours();
  const m = istDate.getUTCMinutes();
  const minutesFromMidnight = h * 60 + m;
  // 00:00 (incl.) → 05:30 (excl.)
  return minutesFromMidnight >= 0 && minutesFromMidnight < 330;
}

// Preferred alias for call sites handling trade results rather than funds.
export const isTransientBrokerError = isTransientFundsError;

/**
 * Given a process-trade response (response.data.results array
 * and/or response.data.orderErrors array), detect whether EVERY
 * failed row is a transient service-window error from the same
 * broker. If yes, return the first matching message so the UI
 * can show a friendly "retry at 5:30 AM" toast instead of
 * rendering the all-failed modal. Returns null if the pattern
 * doesn't match.
 */
export function detectTransientOrderWindowError(responseData) {
  if (!responseData) return null;
  const results = Array.isArray(responseData.results) ? responseData.results : [];
  if (results.length === 0) return null;
  let transientMessage = null;
  for (const row of results) {
    const isFailure =
      row?.status === 1 ||
      (row?.orderStatus || '').toString().toUpperCase() === 'FAILURE' ||
      (row?.orderStatus || '').toString().toUpperCase() === 'REJECTED';
    if (!isFailure) return null;
    if (!isTransientBrokerError(row)) return null;
    if (!transientMessage) {
      transientMessage = row?.message || null;
    }
  }
  return transientMessage;
}

/**
 * Check if funds data indicates an error or is missing.
 * Covers: null funds, undefined funds, status 1 (token error), status 2 (backend error).
 *
 * EXCEPT: transient non-auth errors (see isTransientFundsError) are
 * explicitly excluded so the re-login modal is only raised for genuine
 * session failures — e.g. Upstox's 00:00–05:30 IST maintenance window
 * no longer forces re-OAuth.
 *
 * @param {Object|null|undefined} currentFunds - Funds response object
 * @param {string} brokerStatus - Broker connection status
 * @returns {boolean} True if funds are in an error state while broker is connected
 */
export function isFundsErrorOrMissing(currentFunds, brokerStatus, broker) {
  if (brokerStatus !== 'connected') return false;
  if (isTransientFundsError(currentFunds, broker)) return false;
  return currentFunds?.status === 1 || currentFunds?.status === 2 || !currentFunds;
}

/**
 * Check if rebalance API response is an error.
 */
export function isRebalanceErrorResponse(responseData) {
  if (!responseData) return false;
  return responseData.status === 1 || responseData.status === 2;
}

/**
 * Check if an error message relates to a missing subscription amount.
 *
 * @param {string|null|undefined} message - Error message string
 * @returns {boolean} True if the message indicates a subscription amount issue
 */
export function isSubscriptionAmountError(message) {
  if (!message) return false;
  return (
    message.includes('subscription_amount_raw') ||
    message.includes('subscription amount') ||
    message.includes('not set or has been cleared')
  );
}

/**
 * Check if an error message indicates low allowed balance.
 *
 * @param {string|null|undefined} message - Error message string
 * @returns {boolean} True if the message indicates balance is too low
 */
export function isLowAllowedBalanceError(message) {
  if (!message) return false;
  return message.toLowerCase().includes('low allowed balance');
}

/**
 * Check if an error message indicates portfolio value is below subscription
 * amount ("less than required minimum"). This is a WARNING, not a blocker —
 * the backend may still return buy/sell trades with the available amount.
 *
 * @param {Object} responseData - The response.data from rebalance/calculate
 * @returns {{ isShortfall: boolean, hasTrades: boolean, currentValue: number|null, requiredAmount: number|null }}
 */
export function checkPortfolioShortfall(responseData) {
  if (!responseData?.message) {
    return {isShortfall: false, hasTrades: false, currentValue: null, requiredAmount: null};
  }

  const msg = responseData.message.toLowerCase();
  if (!msg.includes('less than required minimum')) {
    return {isShortfall: false, hasTrades: false, currentValue: null, requiredAmount: null};
  }

  const currentValue = responseData.totalValue ?? null;
  const reqMatch = responseData.message.match(/required minimum amount \((\d+\.?\d*)\)/);
  const requiredAmount = reqMatch ? parseFloat(reqMatch[1]) : null;
  const hasTrades =
    (Array.isArray(responseData.buy) && responseData.buy.length > 0) ||
    (Array.isArray(responseData.sell) && responseData.sell.length > 0);

  return {isShortfall: true, hasTrades, currentValue, requiredAmount};
}

/**
 * Check if an error message indicates broker authentication failure.
 *
 * @param {string|null|undefined} message - Error message string
 * @returns {boolean} True if the message indicates a broker auth issue
 */
export function isBrokerAuthError(message) {
  if (!message) return false;
  const msg = message.toLowerCase();
  return (
    (msg.includes('invalid') && (msg.includes('api_key') || msg.includes('access_token') || msg.includes('token'))) ||
    msg.includes('session expired') ||
    msg.includes('token expired') ||
    msg.includes('unauthorized') ||
    msg.includes('authentication') ||
    // Broker-forwarded 401 patterns. Groww (and some other broker
    // upstreams) surface 401s as e.g. "Please Login and Try Again (Error: 401)".
    // The older keyword set missed all of those, so the rebalance flow
    // rendered a dead-end "Unable to Rebalance" instead of opening the
    // TokenExpire reconnect modal.
    msg.includes('please login') ||
    msg.includes('please re-login') ||
    msg.includes('login required') ||
    msg.includes('error: 401') ||
    msg.includes('401 unauthorized')
  );
}

/**
 * Build broker-specific payload fields for rebalance API calls.
 * Maps each broker's credentials to the format expected by the Python backend.
 *
 * @param {string} broker - Broker name
 * @param {object} credentials - User's broker credentials
 * @param {function} decryptFn - AES decryption function (optional)
 * @param {string} angelOneApiKey - Angel One API key from config
 * @returns {object} Broker-specific fields for API payload
 */
export function buildBrokerPayloadFields(
  broker,
  credentials,
  decryptFn,
  angelOneApiKey,
) {
  const decrypt = decryptFn || defaultDecrypt;

  switch (broker) {
    case 'Zerodha':
      return {
        accessToken: credentials.jwtToken,
      };

    case 'Angel One':
      return {
        apiKey: angelOneApiKey,
        jwtToken: credentials.jwtToken,
      };

    case 'Upstox':
      return {
        apiKey: decrypt(credentials.apiKey),
        apiSecret: decrypt(credentials.secretKey),
        accessToken: credentials.jwtToken,
      };

    case 'ICICI Direct':
      return {
        apiKey: decrypt(credentials.apiKey),
        secretKey: decrypt(credentials.secretKey),
        accessToken: credentials.jwtToken,
      };

    case 'Dhan':
      return {
        clientId: credentials.clientCode,
        accessToken: credentials.jwtToken,
      };

    case 'Groww':
      return {
        accessToken: credentials.jwtToken,
      };

    case 'IIFL Securities':
      return {
        clientCode: credentials.clientCode,
      };

    case 'Kotak':
      // Kotak NEO UUID flow (2026-04-22): consumerKey is the UUID access
      // token; no consumer secret exists on the new developer portal.
      return {
        consumerKey: decrypt(credentials.apiKey),
        accessToken: credentials.jwtToken,
        sid: credentials.sid,
        serverId: credentials.serverId,
        viewToken: credentials.viewToken,
      };

    case 'Hdfc Securities':
      return {
        apiKey: decrypt(credentials.apiKey),
        accessToken: credentials.jwtToken,
      };

    case 'AliceBlue':
      return {
        clientId: credentials.clientCode,
        accessToken: credentials.jwtToken,
        apiKey: credentials.apiKey,
      };

    case 'Fyers':
      return {
        clientId: credentials.clientCode,
        accessToken: credentials.jwtToken,
      };

    case 'Motilal Oswal':
      return {
        clientCode: credentials.clientCode,
        accessToken: credentials.jwtToken,
        apiKey: decrypt(credentials.apiKey),
      };

    case 'Axis Securities':
      return {
        accessToken: credentials.jwtToken,
      };

    default:
      return {};
  }
}

// --- Internal helpers ---

export function defaultDecrypt(value) {
  if (!value) return value;
  try {
    const bytes = CryptoJS.AES.decrypt(value, 'ApiKeySecret');
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || value;
  } catch {
    return value;
  }
}
