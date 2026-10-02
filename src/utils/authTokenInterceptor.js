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
 * Protected customer routes now enforce the Firebase identity boundary. The
 * first request after a cold start therefore waits for Firebase's cached ID
 * token instead of racing a fire-and-forget token refresh and receiving 401.
 *
 * Design:
 *   - One shared promise coalesces simultaneous cold-start requests.
 *   - Firebase caches getIdToken() locally, so only the first protected
 *     request waits; subsequent requests read this module's five-minute cache.
 *   - A customer-API GET which receives 401 forces one token refresh and
 *     retries once. Broker/ccxt 401 responses are not replayed.
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
import eventEmitter from '../components/EventEmitter';
import {getAuth} from '@react-native-firebase/auth';
import server from './serverConfig';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let cachedToken = null;
let cachedAt = 0;
let tokenRequest = null;
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

function isCustomerApiUrl(url) {
  try {
    return Boolean(
      url &&
        typeof url === 'string' &&
        url.startsWith(server?.server?.baseUrl || '__never__'),
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

async function resolveFirebaseToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now - cachedAt < REFRESH_INTERVAL_MS) {
    return cachedToken;
  }
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    try {
      const auth = getAuth();
      const user = auth && auth.currentUser;
      if (!user) {
        cachedToken = null;
        cachedAt = Date.now();
        return null;
      }
      const token = await user.getIdToken(forceRefresh);
      if (token) {
        cachedToken = token;
        cachedAt = Date.now();
      }
      return token || null;
    } catch (_) {
      if (forceRefresh) cachedToken = null;
      return forceRefresh ? null : cachedToken;
    } finally {
      tokenRequest = null;
    }
  })();
  return tokenRequest;
}

/** Server code for "the token proves a different customer than you asked for". */
export const IDENTITY_MISMATCH_CODE = 'MF_CUSTOMER_IDENTITY_MISMATCH';

/** Emitted when a fresh token still could not satisfy the identity boundary. */
export const IDENTITY_MISMATCH_EVENT = 'aq:customerIdentityMismatch';

// Announce at most once per app run. The same mismatch fires on every
// protected route the screen touches, and a prompt per request would be worse
// than the dead Retry button this replaces.
let identityMismatchAnnounced = false;

export function resetIdentityMismatchAnnouncement() {
  identityMismatchAnnounced = false;
}

function announceIdentityMismatch() {
  if (identityMismatchAnnounced) return;
  identityMismatchAnnounced = true;
  try {
    eventEmitter.emit(IDENTITY_MISMATCH_EVENT);
  } catch (_) {
    // A listener throwing must never turn into an unhandled rejection inside
    // an interceptor.
  }
}

export function installAuthTokenInterceptor() {
  if (installed) return;
  installed = true;

  axios.interceptors.request.use(
    async config => {
      try {
        if (!isTrackedApiUrl(config && config.url)) return config;
        if (hasExistingAuthHeader(config)) return config;

        const token = await resolveFirebaseToken(false);
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (_) {
        // Preserve legacy compatibility when Firebase itself is unavailable.
      }
      return config;
    },
    error => Promise.reject(error),
  );

  axios.interceptors.response.use(
    response => response,
    async error => {
      const config = error?.config;
      const method = String(config?.method || 'get').toLowerCase();
      if (
        error?.response?.status === 401 &&
        method === 'get' &&
        // Retry only the customer API. A 401 from ccxt-india may represent a
        // broker-session failure; replaying that request with a fresh Firebase
        // token cannot repair the broker session and only adds more load.
        isCustomerApiUrl(config?.url) &&
        !config?.__firebaseAuthRetried
      ) {
        const token = await resolveFirebaseToken(true);
        if (token) {
          config.__firebaseAuthRetried = true;
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          return axios(config);
        }
      }

      // 403 MF_CUSTOMER_IDENTITY_MISMATCH — the server proved a different
      // customer than the one this request asked for. Until 2026-09-18 this
      // fell straight through: only 401 was replayed, so a customer sat on
      // "Portfolio recommendations could not be refreshed" with a Retry button
      // that re-issued a byte-identical request and got the same 403 forever.
      //
      // One replay with a force-refreshed token covers the real recoverable
      // case (the cached token predates an identity change). If the mismatch
      // survives that, the two identities genuinely differ and no retry can
      // fix it — so announce it once and let the UI offer signing in again.
      //
      // Deliberately NOT done here: rewriting the stored account email from
      // the Firebase user. `accountEmail.js` treats the typed email as
      // identity on purpose (an Apple relay alias matches no backend record),
      // and silently overwriting it would regress that.
      if (
        error?.response?.status === 403 &&
        error?.response?.data?.code === IDENTITY_MISMATCH_CODE &&
        isCustomerApiUrl(config?.url) &&
        !config?.__identityMismatchRetried
      ) {
        const token = await resolveFirebaseToken(true);
        if (token) {
          config.__identityMismatchRetried = true;
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
          try {
            return await axios(config);
          } catch (retryError) {
            if (
              retryError?.response?.status === 403 &&
              retryError?.response?.data?.code === IDENTITY_MISMATCH_CODE
            ) {
              announceIdentityMismatch();
            }
            return Promise.reject(retryError);
          }
        }
        announceIdentityMismatch();
      }
      return Promise.reject(error);
    },
  );
}

// Side-effect install at import time — matches the existing module-level
// side-effect import pattern in App.js (e.g. `import
// 'react-native-gesture-handler';`). Callers just need
// `import '<path>/authTokenInterceptor';` once at app bootstrap.
installAuthTokenInterceptor();

export default installAuthTokenInterceptor;
