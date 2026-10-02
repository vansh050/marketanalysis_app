/**
 * Pure helpers for the customer-owned IIFL OAuth flow.
 *
 * Keep callback parsing outside the React Native WebView component so both
 * callback spellings used by IIFL can be regression-tested without mounting
 * native UI. See docs/BROKER_CONNECTION.md, "IIFL Securities — direct flow".
 */

const decodePart = value => {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  } catch (_error) {
    return String(value || '');
  }
};

export const parseIiflCallbackUrl = url => {
  const query = String(url || '').split('?')[1]?.split('#')[0] || '';
  const params = {};

  query.split('&').forEach(pair => {
    if (!pair) return;
    const separator = pair.indexOf('=');
    const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
    const rawValue = separator >= 0 ? pair.slice(separator + 1) : '';
    params[decodePart(rawKey).toLowerCase()] = decodePart(rawValue);
  });

  return {
    // Current direct flow uses authcode/clientid. Keep auth_token support for
    // callbacks still emitted by older IIFL sessions during the transition.
    authCode: params.authcode || params.auth_token || null,
    clientCode: params.clientid || params.clientcode || null,
  };
};

export const hasCompleteIiflCallback = url => {
  const {authCode, clientCode} = parseIiflCallbackUrl(url);
  return Boolean(authCode && clientCode);
};
