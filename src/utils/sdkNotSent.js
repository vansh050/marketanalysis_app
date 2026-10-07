/**
 * The SDK reports a server refusal that dispatched nothing (MARKET_CLOSED,
 * expired session, drifted plan) as a RESULT, `{notSent: true, rows: []}`,
 * while the same refusal on the direct path is an axios 409. Screens that only
 * read `rows` treated it as an empty placement, and the Fyers branches padded
 * it into "not yet verified" legs (moneyman Fyers, 7 Oct 2026, 15:30:56 IST).
 *
 * Re-raise it as the 409 the server sent, so every screen's existing refusal
 * handling (market closed, session expired, frozen-plan recompute) runs
 * exactly as it does with the SDK switched off.
 */
export function throwIfSdkNotSent(sdkResult) {
  if (sdkResult?.notSent !== true) return;
  const recovery = sdkResult?.recovery || {};
  const data = {
    status: 3,
    code: sdkResult?.code || recovery.code || 'PLACEMENT_REFUSED',
    message: recovery.message || 'Nothing was sent to your broker.',
    dispatchState: 'NOT_SENT',
    notSent: true,
    recompute: recovery.reason === 'recalculate_required',
    sessionExpired: recovery.reason === 'broker_session_expired',
    results: [],
  };
  const error = new Error(data.message);
  error.response = {status: 409, data};
  error.sdkNotSent = true;
  throw error;
}
