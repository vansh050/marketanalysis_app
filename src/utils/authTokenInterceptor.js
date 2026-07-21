/**
 * ============================================================================
 * authTokenInterceptor — session-token migration Phase 1 (client side)
 * ============================================================================
 *
 * Installs a global axios request interceptor (this app has ZERO
 * `axios.create()` instances — every call site uses the default `axios`
 * import directly with a full absolute URL, so patching the default
 * instance covers the whole app) that attaches
 * `Authorization: Bearer <firebase-id-token>` to requests targeting our own
 * API bases, so the backend's Phase 1 OBSERVE MODE telemetry
 * (aq_backend_github middlewares/authObserve.js /
 * ccxt-india common/auth_observe.py) can measure per-user-token coverage.
 * This phase does NOT enforce anything server-side — attaching the header
 * is purely additive.
 *
 * PRIME DIRECTIVE: totally fail-open. No signed-in user, no token, a
 * getIdToken() failure, a missing @react-native-firebase/auth module — any
 * of these must leave the request completely unchanged, never throw, never
 * delay the request waiting on a token network round-trip.
 *
 * Design:
 *   - The interceptor itself is synchronous — it reads a module-level
 *     cached token string and attaches it immediately. It never awaits
 *     getIdToken() inline (that would add a network round-trip's worth of
 *     latency to every single request).
 *   - `getIdToken()` is called in the background at most once every 5
 *     minutes (REFRESH_INTERVAL_MS), fire-and-forget, updating the cache
 *     for subsequent requests. (Firebase's own getIdToken() already caches
 *     internally and only refreshes near expiry, but we still rate-limit
 *     our OWN calls into it to guarantee zero per-request awaits here.)
 *   - Only attaches to requests whose URL starts with
 *     server.server.baseUrl or server.ccxtServer.baseUrl (our own Node /
 *     ccxt-india backends) — never to third-party requests (Firebase SDK
 *     internals, S3/Wasabi presigned URLs, etc. — those already use their
 *     own client, not the default axios instance, but this URL check is a
 *     defensive belt-and-suspenders guard regardless).
 *   - NEVER overwrites an existing Authorization header. Some call sites
 *     already set their own (e.g. the SDK bridge's own client — see below);
 *     this interceptor must not clobber that.
 *
 * Note on the SDK client (src/sdk/brokerSdkBridge.js / useSdkClient.js):
 * the SDK client comes from the separate `@alphaquark/mobile-sdk` npm
 * package and constructs its own internal HTTP client — it is NOT built on
 * this app's default `axios` instance, so this interceptor does not touch
 * its requests at all (verified: no `axios.create()` anywhere in this repo,
 * and the SDK package is an external dependency with its own request
 * machinery). The "never overwrite an existing Authorization header" rule
 * above is kept anyway as a defensive guard in case any call site in this
 * codebase ever sets its own Authorization header via the default axios
 * instance.
 * ============================================================================
 */
import axios from 'axios';
import {getAuth} from '@react-native-firebase/auth';
import server from './serverConfig';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let cachedToken = null;
let cachedAt = 0;
let refreshInFlight = false;
let installed = false;

function isTrackedApiUrl(url) {
  try {
    if (!url || typeof url !== 'string') return false;
    return (
      url.startsWith(server?.server?.baseUrl || '__never__') ||
      url.startsWith(server?.ccxtServer?.baseUrl || '__never__')
    );
  } catch (_) {
    return false;
  }
}

function hasExistingAuthHeader(config) {
  try {
    const headers = config && config.headers;
    if (!headers) return false;
    return Boolean(headers.Authorization || headers.authorization);
  } catch (_) {
    return false;
  }
}

// Fire-and-forget background refresh. Never awaited by the interceptor —
// updates the cache for the NEXT request, never delays the current one.
function maybeRefreshInBackground() {
  try {
    const now = Date.now();
    if (refreshInFlight) return;
    if (cachedToken && now - cachedAt < REFRESH_INTERVAL_MS) return;

    refreshInFlight = true;
    (async () => {
      try {
        const auth = getAuth();
        const user = auth && auth.currentUser;
        if (!user) {
          // No signed-in user — clear the cache so we stop attaching a
          // stale token, but this is not an error.
          cachedToken = null;
          cachedAt = Date.now();
          return;
        }
        const token = await user.getIdToken();
        if (token) {
          cachedToken = token;
          cachedAt = Date.now();
        }
      } catch (_) {
        // Fail-open: keep whatever was cached before (possibly stale or
        // null). Never throw — this runs detached from any request.
      } finally {
        refreshInFlight = false;
      }
    })();
  } catch (_) {
    refreshInFlight = false;
  }
}

export function installAuthTokenInterceptor() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use(
    config => {
      try {
        if (!isTrackedApiUrl(config && config.url)) return config;
        if (hasExistingAuthHeader(config)) return config;

        // Kick off a background refresh if the cache is stale/empty; never
        // awaited here.
        maybeRefreshInBackground();

        if (cachedToken) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${cachedToken}`;
        }
      } catch (_) {
        // Total fail-open — never let this interceptor break a request.
      }
      return config;
    },
    error => Promise.reject(error),
  );
}

// Side-effect install at import time — matches the existing module-level
// side-effect import pattern in App.js (e.g. `import
// 'react-native-gesture-handler';`). Callers just need
// `import '<path>/authTokenInterceptor';` once at app bootstrap.
installAuthTokenInterceptor();

export default installAuthTokenInterceptor;
