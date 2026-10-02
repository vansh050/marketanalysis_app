/**
 * smartLink.js — campaign smart-link / deep-link + attribution handling.
 *
 * Pairs with the backend SmartLinkRouter
 * (aq_backend_github/Routes/SmartLinks/SmartLinkRouter.js) and the
 * `app-links.alphaquark.in/l/<tenant>` App Link / Universal Link.
 *
 * Responsibilities:
 *   1. parseSmartLink(url)        — pull {tenant, dl, utm} out of an incoming
 *                                    App Link / Universal Link / custom-scheme URL.
 *   2. captureCampaign(utm, meta) — persist UTM locally (AsyncStorage) and
 *                                    best-effort report it to the backend so a
 *                                    user/install can be tied to a campaign.
 *   3. captureInstallReferrer()   — Android only, first launch: read the Play
 *                                    Install Referrer so UTM survives a
 *                                    not-installed → Play Store → install hop
 *                                    (deferred deep link).
 *   4. routeSmartLinkDestination(dl) — navigate to the screen named by `dl`.
 *   5. handleSmartLink(url)       — orchestrates 1+2+4 for a live tap.
 *
 * Whitelabel note: this file is generic and lives upstream (Alphab2bapp).
 * Each fork differentiates purely by its OWN smart-link tenant slug
 * (= REACT_APP_HEADER_NAME) baked into the campaign URL, plus its native
 * package id / store id — no per-fork code change here.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules, Platform} from 'react-native';
import axios from 'axios';
import {getAuth} from '@react-native-firebase/auth';
import NavigationService from '../components/NatificationServiceNav';
import server from './serverConfig';
import {getAuthedHeaders} from './courseAuthHeaders';

// Functional deep-link (rebalance/execute) target stashed for the destination
// screen to auto-open — the RN mirror of the web's sessionStorage handoff.
export const PENDING_DEEPLINK_KEY = 'pending_functional_deeplink';

const CAMPAIGN_KEY = 'campaign_attribution';
const REFERRER_READ_KEY = 'install_referrer_read_v1';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// dl value (from ?dl=) → navigation route name. Keep in sync with the screens
// registered in src/components/Navigation.js. Extend as campaigns need more
// landing targets; an unknown dl just lands the user on the default home flow.
export const SMART_LINK_DL_ROUTES = {
  subscriptions: 'SubscriptionScreen',
  mysubscriptions: 'MySubscriptionsScreen',
  // Advice/recommendation "View Update" WhatsApp button (2026-07-16,
  // advice_applink_enabled) — 'Home' is the recommendations tab
  // (Navigation.js registers it as component={AdviceScreen}, itself an
  // alias for screens/Home/HomeScreen.js). Explicit even though an
  // unmatched dl already falls through to the default launch screen —
  // don't rely on that staying Home if the initial route ever changes.
  'stock-recommendation': 'Home',
};

// Path-prefixed dl values that carry a parameter (e.g. campaign links to a
// specific model portfolio). `model-portfolio/<slug>` opens that model's screen
// directly. <slug> is the model_name lowercased with spaces→underscores (may
// contain brackets, e.g. moneyman_sector_rotation_optimizer_[msro]); the target
// screen replaces underscores→spaces to fetch via
// api/model-portfolio/portfolios/strategy/<name>. MPPerformanceScreen is
// self-contained (fetches its own model) and renders for BOTH prospects (shows
// Subscribe) and subscribers — same screen the web /model-portfolio/:fileName
// methodology page maps to.
const SMART_LINK_DL_PREFIX_ROUTES = [
  {prefix: 'model-portfolio/', screen: 'MPPerformanceScreen', param: 'modelName'},
];

function parseQuery(qs) {
  const out = {};
  (qs || '').split('&').forEach(pair => {
    if (!pair) return;
    const idx = pair.indexOf('=');
    const key = idx >= 0 ? pair.slice(0, idx) : pair;
    const val =
      idx >= 0 ? decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' ')) : '';
    if (key) out[key] = val;
  });
  return out;
}

function pickUtm(obj) {
  const utm = {};
  UTM_KEYS.forEach(k => {
    if (obj[k]) utm[k] = obj[k];
  });
  return utm;
}

/**
 * Parse a smart-link URL. Accepts the https App Link / Universal Link
 * (https://app-links.alphaquark.in/l/<tenant>?...) and is tolerant of the
 * custom scheme. Returns null if the URL is not a /l/ smart link.
 */
export function parseSmartLink(url) {
  if (!url || typeof url !== 'string') return null;
  const hashless = url.split('#')[0];
  const [path, qs] = hashless.split('?');
  const m = path.match(/\/l\/([a-zA-Z0-9-]+)/);
  if (!m) return null;
  const q = parseQuery(qs);
  // `t` = functional deep-link token (rebalance/execute, mobile-deeplink Phase 1).
  return {tenant: m[1].toLowerCase(), dl: q.dl || '', t: q.t || '', utm: pickUtm(q)};
}

/**
 * Persist campaign attribution locally + best-effort report to backend.
 * Idempotent-friendly: latest write wins. Never throws.
 */
export async function captureCampaign(utm, meta = {}) {
  if (!utm || Object.keys(utm).length === 0) return;
  const payload = {
    ...utm,
    tenant: meta.tenant || null,
    source: meta.source || 'deeplink',
    platform: Platform.OS,
    capturedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(CAMPAIGN_KEY, JSON.stringify(payload));
  } catch (e) {
    // local persistence failure is non-fatal
  }
  try {
    await axios.post(`${server.server.baseUrl}l/attribution`, payload, {
      timeout: 4000,
    });
  } catch (e) {
    // backend attribution is best-effort; the redirect-time click log already
    // captured the initial hit server-side.
  }
}

/** Read the stored campaign attribution (e.g. to tag it onto signup). */
export async function getStoredCampaign() {
  try {
    const raw = await AsyncStorage.getItem(CAMPAIGN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Android-only, first-launch: read the Play Install Referrer so UTM from a
 * "not installed → Play Store → install" journey is recovered (deferred deep
 * link). No-ops on iOS, on repeat launches, and if the native module is not
 * yet bundled (require guarded) so it is safe to ship ahead of the native lib.
 */
export async function captureInstallReferrer() {
  if (Platform.OS !== 'android') return;
  try {
    const already = await AsyncStorage.getItem(REFERRER_READ_KEY);
    if (already) return;
  } catch (e) {
    return;
  }
  // react-native-play-install-referrer is declared in package.json but the
  // native module may not be installed/linked yet. Look up via NativeModules
  // so Metro never tries to bundle the JS shim — a missing require() string
  // surfaces as a dev-mode LogBox redbox even when wrapped in try/catch.
  const PlayInstallReferrer = NativeModules.RNPlayInstallReferrer;
  if (
    !PlayInstallReferrer ||
    typeof PlayInstallReferrer.getInstallReferrerInfo !== 'function'
  ) {
    return;
  }
  try {
    PlayInstallReferrer.getInstallReferrerInfo(async (info, error) => {
      try {
        await AsyncStorage.setItem(REFERRER_READ_KEY, '1');
      } catch (e) {}
      if (error || !info || !info.installReferrer) return;
      const parsed = parseQuery(info.installReferrer);
      const utm = pickUtm(parsed);
      if (Object.keys(utm).length === 0) return;
      await captureCampaign(utm, {
        source: 'install_referrer',
        tenant: parsed.tenant || null,
      });
    });
  } catch (e) {
    // ignore
  }
}

/** Navigate to the screen named by a smart-link `dl` value, if recognised. */
export function routeSmartLinkDestination(dl) {
  if (!dl) return;
  const raw = String(dl).replace(/^\/+/, '');

  // Path-prefixed targets first (e.g. model-portfolio/<slug>). The remainder
  // after the prefix is passed as the screen's param.
  for (const {prefix, screen, param} of SMART_LINK_DL_PREFIX_ROUTES) {
    if (raw.toLowerCase().startsWith(prefix)) {
      const value = raw.slice(prefix.length);
      if (!value) return;
      // Small delay so the navigator is mounted when launched cold from a link.
      setTimeout(() => NavigationService.navigate(screen, {[param]: value}), 350);
      return;
    }
  }

  const route = SMART_LINK_DL_ROUTES[raw.toLowerCase()];
  if (!route) return;
  // Small delay so the navigator is mounted when launched cold from a link.
  setTimeout(() => NavigationService.navigate(route), 350);
}

/**
 * Resolve a functional deep-link token (rebalance/execute) against the Node
 * backend. Requires the customer to be signed in — the server enforces a
 * Firebase identity-match. Returns {success, surface, model_name, unique_id,
 * advisor_tag, broker, ...} or null.
 * NOTE(app team): confirm `server.baseUrl` (server.alphaquark.in) is the host
 * that serves aq_backend `POST /api/deep-link/resolve` in this build's env.
 */
async function resolveFunctionalDeepLink(token) {
  try {
    const headers = await getAuthedHeaders();
    const {data} = await axios.post(
      `${server.baseUrl}api/deep-link/resolve`,
      {token},
      {headers, timeout: 15000},
    );
    return data && data.success ? data : null;
  } catch (e) {
    return null;
  }
}

/**
 * Handle a functional deep link (rebalance/execute) that arrived via /l/ with a
 * `?t=<token>`. Signed-out → stash token + go to sign-in (resume post-login).
 * Signed-in → resolve, stash the resolved target under PENDING_DEEPLINK_KEY, and
 * navigate to the surface; the destination screen reads + clears the stash on
 * focus (mirrors web sessionStorage["aq_deeplink_rebalance"]).
 */
async function handleFunctionalDeepLink(token) {
  const user = getAuth().currentUser;
  if (!user) {
    await AsyncStorage.setItem(
      PENDING_DEEPLINK_KEY,
      JSON.stringify({token, resolved: null}),
    );
    setTimeout(() => NavigationService.navigate('SignIn'), 300);
    return;
  }
  const resolved = await resolveFunctionalDeepLink(token);
  if (!resolved) {
    setTimeout(() => NavigationService.navigate('Home'), 300);
    return;
  }
  await AsyncStorage.setItem(
    PENDING_DEEPLINK_KEY,
    JSON.stringify({token, resolved}),
  );
  const surface = String(resolved.surface || '');
  if (surface === 'broker_reauth') {
    setTimeout(() => NavigationService.navigate('SubscriptionScreen'), 350);
    return;
  }
  // rebalance / rebalance_execute / trade_execute / basket_execute → the rebalance
  // surface. TODO(app team): on 'Home' focus, read PENDING_DEEPLINK_KEY and open
  // the rebalance for resolved.model_name / resolved.unique_id via the same flow
  // as RebalanceNotificationComponent, then AsyncStorage.removeItem(PENDING_DEEPLINK_KEY).
  setTimeout(() => NavigationService.navigate('Home'), 350);
}

/**
 * Handle a live smart-link tap. Returns true if the URL was a smart link
 * (so the caller can stop other deep-link handlers from also firing).
 */
export async function handleSmartLink(url) {
  const parsed = parseSmartLink(url);
  if (!parsed) return false;
  await captureCampaign(parsed.utm, {source: 'deeplink', tenant: parsed.tenant});
  if (parsed.t) {
    // Functional deep-link (rebalance/execute) — resolve + route natively.
    await handleFunctionalDeepLink(parsed.t);
  } else {
    routeSmartLinkDestination(parsed.dl);
  }
  return true;
}
