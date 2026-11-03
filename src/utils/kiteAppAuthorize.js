/**
 * Zerodha only issues a request_token for a Kite Connect app after the user
 * has tapped "Authorize" for that app once. A customer's own (BYO) app is
 * never authorized by normal login (that uses AlphaQuark's shared app), so the
 * first quick-reconnect verification stops on Kite's /connect/authorize page
 * and ccxt returns ZERODHA_ASSISTED_AUTHORIZE_FAILED. The app then opens the
 * Authorize page in a WebView and retries once the consent is given.
 */
export const KITE_AUTHORIZE_ERROR_CODE = 'ZERODHA_ASSISTED_AUTHORIZE_FAILED';

export const isKiteAuthorizeRequired = error =>
  String(error?.response?.data?.error_code || '') === KITE_AUTHORIZE_ERROR_CODE;

const KITE_LOGIN_PREFIX = 'https://kite.zerodha.com/connect/login?';

/** The Kite login URL for the app; prefers the server's, else builds one. */
export const kiteAuthorizeUrl = (error, apiKey) => {
  const fromServer = String(error?.response?.data?.authorize_url || '');
  if (fromServer.startsWith(KITE_LOGIN_PREFIX)) return fromServer;
  const key = String(apiKey || '').trim();
  if (!/^[a-z0-9]+$/i.test(key)) return null;
  return `${KITE_LOGIN_PREFIX}api_key=${key}&v=3`;
};

/**
 * Classify a URL the Authorize WebView is about to load.
 * 'authorized' — Kite redirected away with a request_token (consent given);
 * 'failed'     — Kite redirected with status=error;
 * null         — keep browsing (Kite login, TOTP, the Authorize page itself).
 */
export const classifyKiteAuthorizeUrl = url => {
  const text = String(url || '');
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : '';
  const params = {};
  query.split('#')[0].split('&').forEach(pair => {
    const [k, v = ''] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  });
  if (params.request_token) return 'authorized';
  if (params.status === 'error' && !text.startsWith('https://kite.zerodha.com/connect/login')) {
    return 'failed';
  }
  return null;
};
