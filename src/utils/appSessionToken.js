/**
 * ============================================================================
 * appSessionToken — server-issued short-lived per-user `aq-encrypted-key`
 * ============================================================================
 *
 * Migration away from the static client-held signing secret. The server
 * (aq_backend_github `POST /api/app-session/token`) exchanges the signed-in
 * user's Firebase ID token for a 15-minute token that is sent in the SAME
 * `aq-encrypted-key` header the static token uses today.
 *
 * NO-REGRESSION CONTRACT
 *   - `generateToken()` (SecurityTokenManager) stays synchronous and keeps its
 *     signature. It asks `getIssuedAppSessionToken()` and, when that returns
 *     null, returns exactly the static token it always returned.
 *   - Nothing ever waits for this module. A fetch runs in the background and
 *     only benefits LATER requests.
 *   - The token lives in memory only (never AsyncStorage).
 *   - Expiry is measured from when the token was RECEIVED, with the
 *     server's `expiresIn`, on the device clock. The server `exp` claim is
 *     never compared with the device clock (devices drift; the static token
 *     even uses an IST-shifted clock).
 *   - Kill switch: `REACT_APP_APP_SESSION_TOKENS=false` → never fetches, so
 *     every request carries the static token (pre-migration behaviour).
 *   - 404 / 503 (server not deployed / APP_SESSION_DISABLED) → stop asking for
 *     30 minutes. 401 / network / other → exponential back-off up to 10 min.
 *   - Sign-out or a different Firebase user clears the token; a different
 *     tenant (AlphaB2B can switch advisor at runtime) makes it unusable until
 *     a token for the new tenant arrives.
 *
 * Where it is used: only on requests to our own Node and ccxt bases. The
 * axios interceptor (authTokenInterceptor.js) and the fetch guard below swap
 * an issued token back to the static one for any other host (support brain,
 * websocket server, …) because those hosts only understand the static token.
 * ============================================================================
 */
import {AppState} from 'react-native';
import Config from 'react-native-config';
import server from './serverConfig';
import {getTenantSubdomain} from './variantHelper';

export const TOKEN_PATH = 'api/app-session/token';
export const MIN_USABLE_MS = 120 * 1000; // never hand out a token with <120 s left
export const REFRESH_AHEAD_MS = 180 * 1000; // refresh when <180 s left
export const DISABLED_BACKOFF_MS = 30 * 60 * 1000; // 404 / 503
export const MAX_BACKOFF_MS = 10 * 60 * 1000;
export const BASE_BACKOFF_MS = 15 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;
const MAX_REMEMBERED_TOKENS = 8;

const state = {
  cache: null, // {token, uid, tenant, receivedAt, lifetimeMs}
  inflight: null,
  nextAttemptAt: 0,
  failures: 0,
  issued: [], // recent issued token values, so guards can recognise them
  timer: null,
  authUnsub: null,
  appStateSub: null,
  initialized: false,
  fetchGuardInstalled: false,
  originalFetch: null,
};

const now = () => Date.now();

export function isAppSessionEnabled() {
  try {
    const flag = Config?.REACT_APP_APP_SESSION_TOKENS;
    return String(flag ?? '').trim().toLowerCase() !== 'false';
  } catch (_) {
    return true;
  }
}

function getAuthInstance() {
  try {
    // Lazy: a module that only needs the static token (and every jest test
    // that never mocks Firebase) must not pull the native module at import.
    const mod = require('@react-native-firebase/auth');
    if (mod && typeof mod.getAuth === 'function') return mod.getAuth();
    if (mod && typeof mod.default === 'function') return mod.default();
  } catch (_) {}
  return null;
}

function currentUser() {
  try {
    const auth = getAuthInstance();
    return (auth && auth.currentUser) || null;
  } catch (_) {
    return null;
  }
}

export function currentTenant() {
  try {
    return getTenantSubdomain() || null;
  } catch (_) {
    return null;
  }
}

function nodeBase() {
  const base = server?.server?.baseUrl || '';
  if (!base) return '';
  return base.endsWith('/') ? base : `${base}/`;
}

/** Requests to these bases may carry an issued token; everything else gets static. */
export function isAppSessionUrl(url) {
  try {
    if (!url || typeof url !== 'string') return false;
    const n = server?.server?.baseUrl;
    const c = server?.ccxtServer?.baseUrl;
    return Boolean((n && url.startsWith(n)) || (c && url.startsWith(c)));
  } catch (_) {
    return false;
  }
}

export function isIssuedAppSessionToken(value) {
  return Boolean(value) && state.issued.includes(value);
}

/** Tenant the issued token was minted for (null when unknown/not issued). */
export function tenantForIssuedToken(value) {
  if (state.cache && state.cache.token === value) return state.cache.tenant;
  return null;
}

function remember(token) {
  state.issued = [token, ...state.issued.filter(t => t !== token)].slice(
    0,
    MAX_REMEMBERED_TOKENS,
  );
}

function clearTimer() {
  if (state.timer) {
    try {
      clearTimeout(state.timer);
    } catch (_) {}
    state.timer = null;
  }
}

/**
 * Drop the cached token. Called on sign-out, on user change and when a
 * request that carried the token was rejected. Recognition of old values is
 * kept so guards still swap a stale copy (held by a call site) to static.
 */
export function clearAppSessionToken() {
  state.cache = null;
  clearTimer();
}

function backoff(kind) {
  if (kind === 'disabled') {
    state.nextAttemptAt = now() + DISABLED_BACKOFF_MS;
    return;
  }
  state.failures += 1;
  const delay = Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * 2 ** Math.max(0, state.failures - 1),
  );
  state.nextAttemptAt = now() + delay;
}

function scheduleRefresh() {
  clearTimer();
  const c = state.cache;
  if (!c) return;
  const due = c.receivedAt + c.lifetimeMs - REFRESH_AHEAD_MS - now();
  try {
    state.timer = setTimeout(() => {
      state.timer = null;
      maybeRefreshAppSessionToken();
    }, Math.max(1000, due));
  } catch (_) {}
}

function rawFetch(...args) {
  const f = state.originalFetch || (typeof fetch === 'function' ? fetch : null);
  if (!f) return Promise.reject(new Error('fetch unavailable'));
  return f(...args);
}

async function fetchIssuedToken(user) {
  const base = nodeBase();
  if (!base) return null;
  const tenant = currentTenant();
  let idToken = null;
  try {
    idToken = await user.getIdToken();
  } catch (_) {
    backoff('error');
    return null;
  }
  if (!idToken) {
    backoff('error');
    return null;
  }

  const headers = {
    Authorization: `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
  if (tenant) headers['X-Advisor-Subdomain'] = tenant;

  let controller = null;
  let timeout = null;
  try {
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (controller) timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  } catch (_) {
    controller = null;
  }

  let res;
  try {
    res = await rawFetch(`${base}${TOKEN_PATH}`, {
      method: 'POST',
      headers,
      body: '{}',
      ...(controller ? {signal: controller.signal} : {}),
    });
  } catch (_) {
    backoff('error');
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const status = res && res.status;
  if (status === 404 || status === 503) {
    backoff('disabled');
    return null;
  }
  if (status !== 200) {
    backoff('error');
    return null;
  }

  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = null;
  }
  const token = body && body.success === true && typeof body.token === 'string' ? body.token : null;
  const expiresIn = Number(body && body.expiresIn);
  if (!token || !Number.isFinite(expiresIn) || expiresIn * 1000 <= MIN_USABLE_MS) {
    backoff('error');
    return null;
  }

  // The user (or tenant) changed while the request was in flight: discard.
  const after = currentUser();
  if (!after || after.uid !== user.uid || currentTenant() !== tenant) return null;

  state.failures = 0;
  state.nextAttemptAt = 0;
  state.cache = {
    token,
    uid: user.uid,
    tenant,
    kid: body.kid || null,
    receivedAt: now(),
    lifetimeMs: expiresIn * 1000,
  };
  remember(token);
  scheduleRefresh();
  return token;
}

/**
 * Background refresh. Never throws, never awaited by request code.
 * Returns the in-flight promise (tests and init may await it).
 */
export function maybeRefreshAppSessionToken({force = false} = {}) {
  try {
    if (!isAppSessionEnabled()) return Promise.resolve(null);
    if (state.inflight) return state.inflight;
    if (!force && now() < state.nextAttemptAt) return Promise.resolve(null);
    const user = currentUser();
    if (!user || !user.uid) return Promise.resolve(null);

    const p = (async () => {
      await null;
      try {
        return await fetchIssuedToken(user);
      } catch (_) {
        backoff('error');
        return null;
      } finally {
        if (state.inflight === p) state.inflight = null;
      }
    })();
    state.inflight = p;
    return p;
  } catch (_) {
    return Promise.resolve(null);
  }
}

/**
 * Synchronous read used by generateToken(). Returns the issued token when it
 * belongs to the signed-in user and current tenant and has more than 120 s
 * left; otherwise null (caller then uses the static token). Kicks a
 * background refresh when the token is missing or within 180 s of expiry.
 */
export function getIssuedAppSessionToken() {
  try {
    if (!isAppSessionEnabled()) return null;
    const c = state.cache;
    const user = currentUser();
    if (!user) {
      if (c) clearAppSessionToken();
      return null;
    }
    if (!c || c.uid !== user.uid) {
      if (c) clearAppSessionToken();
      maybeRefreshAppSessionToken();
      return null;
    }
    if (c.tenant !== currentTenant()) {
      maybeRefreshAppSessionToken();
      return null;
    }
    const t = now();
    if (t < c.receivedAt) {
      // Device clock moved backwards — we can no longer tell how old it is.
      clearAppSessionToken();
      maybeRefreshAppSessionToken();
      return null;
    }
    const left = c.receivedAt + c.lifetimeMs - t;
    if (left <= REFRESH_AHEAD_MS) maybeRefreshAppSessionToken();
    return left > MIN_USABLE_MS ? c.token : null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// fetch() guard: an issued token must only reach Node/ccxt. A handful of
// fetch() call sites send `aq-encrypted-key` to other hosts (support brain
// /voice/token, websocket server); swap the issued value for the static one
// there. No header is added or removed — only that value is replaced.
// ---------------------------------------------------------------------------
let staticTokenProvider = null;

/** SecurityTokenManager registers its static generator (avoids an import cycle). */
export function setStaticTokenProvider(fn) {
  staticTokenProvider = typeof fn === 'function' ? fn : null;
}

export function getStaticToken() {
  try {
    return staticTokenProvider ? staticTokenProvider() : null;
  } catch (_) {
    return null;
  }
}

function headerKey(headers, name) {
  const lower = name.toLowerCase();
  return Object.keys(headers).find(k => k.toLowerCase() === lower);
}

/**
 * Should a request carrying `token` to `url` with tenant header `reqTenant`
 * use the issued token? (Shared by the axios interceptor and the fetch guard.)
 */
export function issuedTokenAllowedFor(url, token, reqTenant) {
  if (!isAppSessionUrl(url)) return false;
  const tokenTenant = tenantForIssuedToken(token);
  if (reqTenant && tokenTenant && String(reqTenant) !== String(tokenTenant)) return false;
  return true;
}

function guardFetchArgs(input, init) {
  try {
    if (!init || !init.headers || !state.issued.length) return init;
    const url = typeof input === 'string' ? input : input && input.url;
    const h = init.headers;
    if (typeof h.get === 'function' && typeof h.set === 'function') {
      const v = h.get('aq-encrypted-key');
      if (!isIssuedAppSessionToken(v)) return init;
      if (issuedTokenAllowedFor(url, v, h.get('X-Advisor-Subdomain'))) return init;
      const s = getStaticToken();
      if (s) h.set('aq-encrypted-key', s);
      return init;
    }
    if (typeof h !== 'object') return init;
    const k = headerKey(h, 'aq-encrypted-key');
    if (!k || !isIssuedAppSessionToken(h[k])) return init;
    const tk = headerKey(h, 'X-Advisor-Subdomain');
    if (issuedTokenAllowedFor(url, h[k], tk ? h[tk] : null)) return init;
    const s = getStaticToken();
    if (!s) return init;
    return {...init, headers: {...h, [k]: s}};
  } catch (_) {
    return init;
  }
}

function installFetchGuard() {
  if (state.fetchGuardInstalled) return;
  try {
    const g = typeof global !== 'undefined' ? global : null;
    if (!g || typeof g.fetch !== 'function') return;
    const original = g.fetch;
    state.originalFetch = original.bind ? original.bind(g) : original;
    g.fetch = function aqGuardedFetch(input, init) {
      return original.call(this === undefined ? g : this, input, guardFetchArgs(input, init));
    };
    state.fetchGuardInstalled = true;
  } catch (_) {}
}

/** Initialise once at app start. Safe to call more than once. */
export function initAppSessionTokens() {
  if (state.initialized) return;
  state.initialized = true;
  // Kill switch: install nothing at all — today's pure-static behaviour.
  if (!isAppSessionEnabled()) return;
  installFetchGuard();

  try {
    const mod = require('@react-native-firebase/auth');
    const auth = getAuthInstance();
    const onChange = user => {
      const c = state.cache;
      if (!user || (c && c.uid !== user.uid)) {
        clearAppSessionToken();
        // A new identity is not penalised for the previous one's failures,
        // but a "server not deployed / disabled" pause stays in force.
        if (state.failures) {
          state.failures = 0;
          state.nextAttemptAt = 0;
        }
      }
      if (user) maybeRefreshAppSessionToken();
    };
    if (auth && mod && typeof mod.onAuthStateChanged === 'function') {
      state.authUnsub = mod.onAuthStateChanged(auth, onChange);
    } else if (auth && typeof auth.onAuthStateChanged === 'function') {
      state.authUnsub = auth.onAuthStateChanged(onChange);
    }
  } catch (_) {}

  try {
    state.appStateSub = AppState.addEventListener('change', next => {
      if (next === 'active') getIssuedAppSessionToken();
    });
  } catch (_) {}
}

/** Test-only: reset all module state. */
export function __resetAppSessionTokensForTests() {
  clearTimer();
  try {
    if (typeof state.authUnsub === 'function') state.authUnsub();
  } catch (_) {}
  try {
    state.appStateSub && state.appStateSub.remove && state.appStateSub.remove();
  } catch (_) {}
  Object.assign(state, {
    cache: null,
    inflight: null,
    nextAttemptAt: 0,
    failures: 0,
    issued: [],
    timer: null,
    authUnsub: null,
    appStateSub: null,
    initialized: false,
    fetchGuardInstalled: false,
    originalFetch: null,
  });
}

export const __state = state;
