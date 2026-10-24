/**
 * Routes the PUBLIC pre-login key may call.
 *
 * Once the binary carries the public pre-login key pair, the servers refuse
 * the app's own static `aq-encrypted-key` on every route NOT listed here
 * (403 "Sign in to use this API"). A signed-in request uses the server-issued
 * app-session token instead (./appSessionToken.js); this list only decides
 * which signed-in requests may still leave with the static token when no
 * issued token can be obtained.
 *
 * Mirrors (keep in sync; the server lists are the authority):
 *   - aq_backend_github middlewares/headerMiddleware.js PUBLIC_KEY_ALLOWED_ROUTES
 *     (patterns: "/x/*" prefix, ":name" one segment, otherwise exact;
 *     utilities/routePattern.js) minus middlewares/guestCheckoutPolicy.js
 *     PRELOGIN_DENIED_ROUTES.
 *   - ccxt-india crypto_utils.py PUBLIC_KEY_ALLOWED_ROUTES (regex, trailing
 *     slash stripped).
 * A route missing here only means a signed-in request to it fails visibly
 * when no issued token is available; it never sends a token the server
 * would refuse anyway.
 */

export const NODE_PUBLIC_ROUTES = [
  ['GET', '/api/admin/frontend-config'],
  ['GET', '/api/adminControl/get-gst-config'],
  ['GET', '/api/adminControl/get-theme-settings'],
  ['GET', '/api/adminControl/get-testimonials'],
  ['GET', '/api/adminControl/get-social-media-handles'],
  ['GET', '/api/adminControl/get-payment-platform'],
  ['GET', '/api/get-landing-page'],
  ['GET', '/api/get-landing-page/*'],
  ['GET', '/api/admin/all/footer-link'],
  ['GET', '/api/admin/plan-categories/*'],
  ['GET', '/api/advisor-config-env/getConfig/*'],
  ['GET', '/api/payment-gateway/client-config'],
  ['GET', '/api/public/complaints/summary'],
  ['GET', '/api/public-pdfs/*'],
  ['GET', '/api/all-plans/specific-advisor/plan/*'],
  ['GET', '/api/all-plans/check-portfolio-plan/:modelName'],
  ['GET', '/api/admin/plan/:advisorName/:type/:user_email'],
  ['GET', '/api/admin/plan/detail/specific/:id/:user_email'],
  ['GET', '/api/admin/plan/landing/subscription/detail/specific/:id'],
  ['GET', '/api/model-portfolio/portfolios/strategy/:modelName'],
  ['GET', '/api/mf/public-models'],
  ['GET', '/api/livekit/webinars/list'],
  ['GET', '/api/livekit/webinars/:lessonId/public'],
  ['GET', '/api/app-advisor/get'],
  ['POST', '/api/user/save-contact'],
  ['POST', '/api/auth/check-provider'],
  ['POST', '/api/auth/send-password-reset'],
  ['POST', '/api/app-login/log'],
  ['POST', '/api/app-login/heartbeat'],
  ['POST', '/api/app-login/track-user'],
  ['POST', '/api/log-frontend-anomaly'],
  ['POST', '/api/checkout/session'],
];

export const NODE_PRELOGIN_DENIED_ROUTES = [['GET', '/api/admin/plan/detail/:id/advisor']];

export const CCXT_PUBLIC_ROUTES = [
  ['POST', /^\/misc\/indices-previous-close$/],
  ['GET', /^\/misc\/videos$/],
  ['GET', /^\/misc\/pdfs$/],
  ['GET', /^\/misc\/s3\/blogs-content$/],
  ['GET', /^\/misc\/expiry$/],
  ['GET', /^\/comms\/reco\/best-performer-closed-advice\/[^/]+\/\d+$/],
  ['GET', /^\/misc\/data-fetcher$/],
  ['POST', /^\/rebalance\/v2\/get-portfolio-performance$/],
];

/** Same semantics as aq_backend_github utilities/routePattern.js. */
export function matchRoutePattern(requestPath, pattern) {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return requestPath === prefix || requestPath.startsWith(prefix + '/');
  }
  if (!pattern.includes('/:')) return requestPath === pattern;
  const want = pattern.split('/');
  const got = requestPath.split('/');
  if (want.length !== got.length) return false;
  return want.every((seg, i) => (seg.startsWith(':') ? got[i] !== '' : seg === got[i]));
}

function normMethod(method) {
  const m = String(method || 'GET').toUpperCase();
  return m === 'HEAD' ? 'GET' : m;
}

/** Path part of `url` below `base` ("https://h/" + "api/x?y" → "/api/x"). */
export function pathBelow(url, base) {
  if (!url || !base || typeof url !== 'string' || !url.startsWith(base)) return null;
  let rest = url.slice(base.length).split('#')[0].split('?')[0];
  rest = `/${rest}`.replace(/\/{2,}/g, '/');
  return rest;
}

/**
 * Is `method url` a route the public pre-login key may call?
 * `bases` = {node, ccxt} base URLs (with trailing slash, as in serverConfig).
 */
export function isPublicPreloginRoute(method, url, bases = {}) {
  try {
    const m = normMethod(method);
    const nodePath = pathBelow(url, bases.node);
    if (nodePath !== null) {
      const hit = list => list.some(([am, p]) => am === m && matchRoutePattern(nodePath, p));
      return !hit(NODE_PRELOGIN_DENIED_ROUTES) && hit(NODE_PUBLIC_ROUTES);
    }
    const ccxtPath = pathBelow(url, bases.ccxt);
    if (ccxtPath !== null) {
      const p = ccxtPath.length > 1 ? ccxtPath.replace(/\/+$/, '') : ccxtPath;
      return CCXT_PUBLIC_ROUTES.some(([am, re]) => am === m && re.test(p));
    }
    return false;
  } catch (_) {
    return false;
  }
}
