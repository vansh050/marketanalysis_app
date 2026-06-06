/**
 * Translate the SDK's `SdkError` shape ({ error, detail, httpStatus, upstream })
 * into user-facing copy + a small technical breadcrumb for support triage.
 *
 * Why this exists. The SDK forwards backend / broker error codes verbatim
 * (e.g. `internal_error`, `broker_login_url_missing`,
 * `broker_credential_validate_failed`). Phase3SdkBrokerModal previously
 * rendered them as `sdk_error: internal_error` — every broker, every error,
 * unactionable. This helper centralizes the code → copy mapping so:
 *  - the user sees a sentence that tells them what happened and what to do
 *  - the underlying codes still appear as a small caption so support can
 *    diagnose without asking the user to re-open developer tools
 *  - new error codes get a sane fallback (sentence built from the SDK error
 *    + HTTP status) instead of a raw machine string
 *
 * Mapping is informed by:
 *  - SDK throw sites: WebViewBrokerAuthFlow / BrokerCredentialForm /
 *    EdisModal / RebalanceReviewModal in `@alphaquark/mobile-sdk`
 *  - Backend envelopes: `aq_backend_github/Routes/sdk/v1/connections.js`
 *  - Per-broker quirks: BROKER_FLOW_AUDIT.md and PHASE3_BROKER_AUDIT.md
 */

// SDK-level error codes (the `.error` field). These describe WHICH STAGE of
// the SDK flow failed.
const SDK_STAGE_COPY = {
  broker_login_url_failed: {
    title: (broker) => `Couldn't start ${broker || 'broker'} login`,
    body: 'We couldn\'t reach the broker to begin the login flow. Check your internet connection and try again. If the problem persists, your broker credentials in the form may be wrong.',
  },
  broker_exchange_failed: {
    title: (broker) => `${broker || 'Broker'} login didn\'t complete`,
    body: 'The broker authorized you, but exchanging the token failed. This usually clears up if you try again. If it keeps happening, contact support.',
  },
  credential_submit_failed: {
    title: (broker) => `${broker || 'Broker'} rejected your details`,
    body: 'Double-check the values you entered (API key, secret, client code, mobile number, etc.) against your broker\'s developer portal and resubmit.',
  },
  edis_action_failed: {
    title: () => 'Sell authorization failed',
    body: 'The broker couldn\'t complete the EDIS / DDPI authorization step. Try again, or open your broker app to authorize there directly.',
  },
  rebalance_execute_failed: {
    title: () => 'Rebalance couldn\'t execute',
    body: 'Some orders failed before reaching the broker. See the detail below and contact your advisor if it keeps happening.',
  },
};

// Backend / upstream codes (the `.detail` field, when SDK forwards backend
// envelope's `error`). These describe WHAT SPECIFICALLY went wrong upstream.
// The refinement REPLACES the generic body when present, so the user sees the
// most specific guidance available.
const UPSTREAM_REFINEMENT = {
  internal_error:
    'The server hit an unexpected error. Please try again in a moment.',
  unsupported_broker:
    'This broker isn\'t supported on your account yet. Contact your advisor.',
  broker_credential_validate_failed:
    'Your credentials were rejected. Verify the API key, secret, and any client/UCC fields match your broker\'s developer portal exactly.',
  broker_login_url_missing:
    'The broker didn\'t return a login URL. This usually means one of: (1) your saved API key/secret in our system is incorrect or expired — re-paste them in the broker form; (2) your broker\'s developer-portal app is misconfigured (check Order Placement permission and the registered redirect URL); (3) the broker\'s server was unreachable from ours just now — wait a moment and try again.',
  broker_login_url_failed:
    'The broker rejected the login-URL request. Most often this means the API key, secret, or registered redirect URL is incorrect.',
  broker_verify_failed:
    'The broker couldn\'t verify your identity. Open your broker app and complete any pending KYC / 2FA, then try again.',
  redirect_url_mismatch:
    'The redirect URL registered with your broker doesn\'t match. Update it in the broker\'s developer portal and resubmit.',
  invalid_api_key:
    'The API key you entered was rejected by the broker. Re-copy it from the broker\'s developer portal (no extra spaces).',
  app_config_ambiguous:
    'Your broker account has multiple apps registered with the same key. Pick one and remove the others, or contact support.',
  no_user_email_in_session:
    'Your session has expired. Please sign out and sign in again.',
  no_user_ref_in_session:
    'Your session has expired. Please sign out and sign in again.',
  user_not_found: 'Your account wasn\'t found. Please sign out and sign in again.',
  tenant_db_unresolved:
    'Your account isn\'t fully provisioned yet. Contact support.',
  tenant_db_connect_failed:
    'We couldn\'t reach your account database. Try again in a moment, then contact support if the problem persists.',
  verify_not_supported:
    'This broker doesn\'t support the verify step on your account yet. Contact your advisor.',
  attest_not_supported:
    'This broker doesn\'t support the attest step on your account yet. Contact your advisor.',
  broker_slug_missing:
    'The broker isn\'t fully wired up server-side. Please contact support.',
  angel_one_connect_requires_post_oauth:
    'Angel One needs you to complete the in-app OAuth flow first. Close this dialog and re-open Connect Angel One.',
};

/**
 * Build a friendly title + body + technical caption from the SDK error.
 *
 * @param {object|null|undefined} sdkError - the SdkError shape from
 *   `@alphaquark/mobile-sdk`. If null/undefined, falls back to a generic
 *   "something went wrong" message.
 * @param {string} brokerName - display name (e.g. "Upstox", "Angel One").
 *   Used when the title needs the broker.
 * @returns {{title: string, body: string, technical: string}}
 *   Title and body for the banner; technical is a short code chain like
 *   "broker_login_url_failed → internal_error (HTTP 500)" intended to be
 *   rendered as a small caption underneath.
 */
/**
 * Pull a human-readable upstream message out of the backend's `upstream`
 * envelope when present. The backend forwards the upstream broker / ccxt
 * response verbatim under the `upstream` key for several error codes
 * (broker_login_url_missing, broker_exchange_failed, etc.) — it carries
 * the actual root cause that's far more actionable than our generic
 * mapping. Examples seen in production:
 *   - {keyError: "apiSecret is missing", status: 1}            (ccxt extract_keys decorator)
 *   - {error: "Connection to api.upstox.com timed out"}        (ccxt outbound timeout)
 *   - "<html>...nginx error...</html>"                          (gateway down)
 *   - {errors:[{errorCode:"UDAPI100068", message:"Invalid client_id"}]} (Upstox UDAPI)
 *
 * Returns the most specific actionable string, or null when nothing
 * usable surfaces. Caller drops it into the body line so the user sees
 * the real broker / server message instead of a guess.
 */
function extractUpstreamMessage(upstream, depth = 0) {
  if (upstream == null) return null;
  if (depth > 4) return null; // bail on accidental cycles
  if (typeof upstream === 'string') {
    const trimmed = upstream.trim();
    if (trimmed.startsWith('<')) return null; // HTML / XML — not a sentence
    return trimmed.length >= 8 && trimmed.length <= 280 ? trimmed : null;
  }
  if (typeof upstream !== 'object') return null;
  // ccxt extract_keys decorator
  if (typeof upstream.keyError === 'string') return upstream.keyError;
  // Upstox UDAPI nested error
  if (Array.isArray(upstream.errors) && upstream.errors[0]) {
    const e0 = upstream.errors[0];
    if (typeof e0.message === 'string') {
      return e0.errorCode ? `${e0.message} (${e0.errorCode})` : e0.message;
    }
  }
  // Generic message field. Skip `error` when it's our own SDK error code
  // (looks like `snake_case_words` we already mapped) — that's not a user
  // sentence, just an opaque label, and our caller will substitute the
  // mapped copy. Bare error strings without underscores (e.g. real broker
  // error codes like "INVALID_API_KEY") fall through to the lower-priority
  // fallback below.
  if (
    typeof upstream.message === 'string' &&
    upstream.message.trim().length >= 8 &&
    /\s/.test(upstream.message)
  ) {
    return upstream.message;
  }
  if (
    typeof upstream.detail === 'string' &&
    upstream.detail.trim().length >= 8 &&
    /\s/.test(upstream.detail)
  ) {
    return upstream.detail;
  }
  // Recurse into wrappers — backend forwards `upstream: {...}` with the
  // actual ccxt body inside, and Fyers / Motilal / etc. wrap broker
  // responses under `.response`.
  if (upstream.upstream) {
    const nested = extractUpstreamMessage(upstream.upstream, depth + 1);
    if (nested) return nested;
  }
  if (upstream.response) {
    const nested = extractUpstreamMessage(upstream.response, depth + 1);
    if (nested) return nested;
  }
  // Last resort: a non-snake_case `error` string is probably a real
  // broker code worth showing.
  if (
    typeof upstream.error === 'string' &&
    !/^[a-z][a-z0-9_]*$/.test(upstream.error)
  ) {
    return upstream.error;
  }
  return null;
}

export function humanizeSdkError(sdkError, brokerName) {
  const error = sdkError?.error || 'sdk_error';
  const detail = sdkError?.detail || null;
  const upstream = sdkError?.upstream || null;
  const httpStatus =
    typeof sdkError?.httpStatus === 'number' ? sdkError.httpStatus : null;

  // Look up upstream copy. The SDK's `_toSdkError` puts the BACKEND error
  // code into `error` when the source was `SdkRequestError` (because the
  // Error.message field carries the backend's `error` string from
  // AqSdkClient.ts:209-214). When the source was a generic exception the
  // backend code lands in `detail` instead. Check both — whichever has a
  // mapped refinement wins, with `detail` preferred since it's slightly
  // more specific (the SDK-stage code in `error` like
  // `broker_login_url_failed` is the umbrella, while `detail` is the
  // specific backend cause within that umbrella).
  const upstreamCopy =
    (detail && UPSTREAM_REFINEMENT[detail]) ||
    UPSTREAM_REFINEMENT[error] ||
    null;
  const stage = SDK_STAGE_COPY[error];
  const stageTitle =
    typeof stage?.title === 'function'
      ? stage.title(brokerName)
      : upstreamCopy
        ? `Couldn't connect to ${brokerName || 'your broker'}`
        : `Something went wrong with ${brokerName || 'your broker'}`;
  const stageBody = stage?.body || null;

  // When the backend supplied a free-form `detail` string that ISN'T one of
  // our known refinement codes, prefer surfacing it verbatim — it's the
  // broker's own rejection reason (e.g. "Incorrect M-PIN. You have 2 more
  // attempts remaining.") and is far more actionable than the generic
  // "verify your credentials" stage body. Heuristic: detail contains
  // whitespace and is long enough to be a sentence (≥12 chars). Pure
  // machine codes like "INVALID_API_KEY" or "broker_credential_update_failed"
  // are caught by the UPSTREAM_REFINEMENT lookup above and don't reach this
  // branch. Pairs with the 2026-04-30 backend change in
  // /sdk/v1/connections/:broker/update-credentials that started passing
  // upstream broker messages through the `detail` field.
  const detailIsActionableText =
    typeof detail === 'string' &&
    /\s/.test(detail) &&
    detail.trim().length >= 12 &&
    !UPSTREAM_REFINEMENT[detail];

  // Prefer the actual upstream broker / ccxt message over our mapped
  // copy when available — it tells the user the real reason, not a
  // guess. Falls through to the mapped copy when no upstream sentence
  // surfaces.
  const upstreamMessage = extractUpstreamMessage(upstream);

  const title = stageTitle;
  const body =
    upstreamMessage ||
    upstreamCopy ||
    (detailIsActionableText ? detail.trim() : null) ||
    stageBody ||
    'Please try again. If the problem keeps happening, contact your advisor or support.';

  // Technical breadcrumb — always shown so support can triage without asking
  // the user to dig. Format matches the legacy modal copy where the raw
  // codes were the only thing shown.
  const parts = [error];
  if (detail && detail !== error) parts.push(detail);
  let technical = parts.join(' → ');
  if (httpStatus) technical += ` (HTTP ${httpStatus})`;

  return { title, body, technical };
}
