/**
 * Timing + retry rules for the staged device-TOTP quick-reconnect enrollment
 * (DeviceTotpReconnectGate.finishPendingEnrollment). Documented in
 * docs/BROKER_CONNECTION.md § "Device TOTP runtime and Fyers staged hand-off".
 *
 * Enrollment verifies the phone's TOTP with a real server-side broker login
 * seconds after the customer typed a code from the same seed into the broker's
 * own login page. Brokers reject a TOTP reused within its 30 s window, so the
 * enrollment waits for the NEXT window and retries once (one window later)
 * only when the broker rejected the TOTP step, the server errored, or the
 * request never got an answer. PIN / Client ID / account-mismatch errors are
 * genuine and are reported immediately. All of this runs after "Connected".
 */
export const TOTP_STEP_MS = 30000;
export const TOTP_WINDOW_MARGIN_MS = 1500;

export const msUntilNextTotpWindow = (nowMs = Date.now()) =>
  TOTP_STEP_MS - (nowMs % TOTP_STEP_MS) + TOTP_WINDOW_MARGIN_MS;

export const waitForNextTotpWindow = () =>
  new Promise(resolve => setTimeout(resolve, msUntilNextTotpWindow()));

export const isRetryableEnrollmentError = error => {
  const response = error?.response;
  // No response = the request itself failed (network/timeout). A thrown app
  // error (e.g. no Firebase session) is not retryable.
  if (!response) return error?.isAxiosError === true;
  const code = String(response.data?.error_code || '');
  return /_ASSISTED_TOTP_FAILED$/.test(code) || response.status >= 500;
};

/**
 * True when the broker rejected the PIN (not the TOTP, not the network).
 * Used only to title the alert; it never blocks, retries or clears anything.
 * Brokers lock logins after repeated wrong PINs, so the customer must be told
 * plainly that the PIN (often an old one saved for quick reconnect) is wrong.
 */
export const isWrongPinError = error => {
  const code = String(error?.response?.data?.error_code || '');
  if (/_ASSISTED_PIN_FAILED$/.test(code)) return true;
  const message = String(error?.response?.data?.message || error?.message || '');
  return /\b(?:invalid|incorrect|wrong)\s+(?:login\s+)?m?-?pin\b|\bm?pin\s+(?:is\s+)?(?:invalid|incorrect|wrong)\b/i.test(message);
};
