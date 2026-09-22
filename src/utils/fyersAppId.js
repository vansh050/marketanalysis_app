/**
 * Fyers App ID guard (RN mirror of prod-alphaquark-github
 * src/utils/fyersAppId.js and the SDK's brokerFormSchema Fyers.apiKey
 * pattern).
 *
 * Since 2026-04-01 (SEBI retail-algo framework) Fyers places orders ONLY
 * from an activated "Algo trading" app whose App ID ends in `-200`
 * (e.g. UMEG2NCP7W-200). Any other app is data-only: login, funds and
 * holdings all succeed, while every order is rejected with
 *   -50 Order placement restricted. Algo orders are not allowed from this app
 * and the eDIS endpoints fail -96. So a wrong App ID is invisible until
 * the customer's first SELL, and the eDIS failure it causes looks like a
 * TPIN problem it is not.
 *
 * Case-insensitive on input; the backend normalises to upper-case
 * (aq_backend_github utilities/fyersCredentials.js).
 */

export const FYERS_APP_ID_PATTERN = /^[A-Za-z0-9]{6,20}-200$/;

export const FYERS_APP_ID_ENTERED_MESSAGE =
  'Fyers only accepts an App ID ending in -200 (the Algo-trading app created in the Fyers API Dashboard). The App ID you entered does not end in -200 — copy the App ID from API Dashboard \u2192 your app, and make sure the app is activated with Order Placement enabled.';

export function normalizeFyersAppId(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function isValidFyersAppId(value) {
  return FYERS_APP_ID_PATTERN.test(normalizeFyersAppId(value));
}

/** Inline form error for the App ID field, or '' when fine / still empty. */
export function fyersAppIdFieldError(value) {
  const v = normalizeFyersAppId(value);
  if (!v) return '';
  return isValidFyersAppId(v) ? '' : FYERS_APP_ID_ENTERED_MESSAGE;
}
