/**
 * SdkProviderRoot — wraps the SDK <AqSdkProvider/> with a mintSession
 * callback that hits a configurable mint endpoint. Behind a feature
 * flag (REACT_APP_SDK_INTEGRATION) so the SDK code path is only loaded
 * when explicitly enabled.
 *
 * The mint endpoint is YOUR backend, not server.alphaquark.in. Your
 * backend holds the tenant secret and signs the /sdk/session/create
 * request. For dev / smoke-test the URL can be a small Node script
 * running on localhost — see docs/SDK_INTEGRATION.md (to be written).
 *
 * Until REACT_APP_SDK_MINT_URL is set, mintSession throws a clear
 * error string so the developer knows what's missing.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {AqSdkClient, AqSdkProvider, ExecuteAdviceOverlay as _MaybeExecuteAdviceOverlay} from '@alphaquark/mobile-sdk';
import Config from 'react-native-config';
import {getAuth} from '@react-native-firebase/auth';

import {getTenantSubdomain} from '../utils/variantHelper';
import {subscribeRuntimeAdvisor} from '../utils/runtimeAdvisor';
import {useConfig} from '../context/ConfigContext';
import {useDesign} from '../design/useDesign';

import { designColor, designFont } from '../design/literalTokens';

// Defensive fallback (2026-05-07): the installed @alphaquark/mobile-sdk
// version doesn't export `ExecuteAdviceOverlay`, so the named import
// resolves to `undefined`. Rendering `<undefined />` throws
// "Element type is invalid" at SdkProviderRoot, which puts the entire
// app's React tree in an error state — every keystroke / focus event
// re-evaluates the broken tree and the LoginScreen / SignupScreen
// inputs misbehave (keyboard pops up briefly then dismisses; characters
// disappear; can't type at all). Mask the undefined with a no-op so the
// tree renders cleanly even if the SDK package is older than the app
// expects. When the SDK ships ExecuteAdviceOverlay, this fallback
// becomes a no-op and the real overlay is used. Tracked for cleanup
// once the SDK package version pins are realigned.
const ExecuteAdviceOverlay =
    typeof _MaybeExecuteAdviceOverlay === 'function'
        ? _MaybeExecuteAdviceOverlay
        : () => null;

const MINT_URL = Config?.REACT_APP_SDK_MINT_URL || '';
const SDK_BASE_URL =
  Config?.REACT_APP_SDK_BASE_URL ||
  Config?.REACT_APP_NODE_SERVER_API_URL ||
  'https://server.alphaquark.in/';
// Dev-only override — never bind a release build to a test identity,
// even if a developer accidentally leaves the variable in the build
// environment. Debug smoke builds can still use it without login.
const SDK_TEST_USER_REF = __DEV__
  ? Config?.REACT_APP_SDK_TEST_USER_REF || ''
  : '';

/**
 * Resolve the tenant subdomain for the X-Advisor-Subdomain header
 * sent on every mint request.
 *
 * Standalone builds are per-tenant. The AlphaB2B master build additionally
 * supports runtime advisor selection after login, so minting must use the same
 * canonical resolver as REST calls. Otherwise SDK broker writes can land in
 * `prod` while TradeContext reads the selected advisor database.
 *
 * Why send the header explicitly instead of relying on the mint
 * server's default secret: every variant must mint sessions scoped
 * to its OWN tenant id. If we omit the header, the mint server falls
 * back to whatever AQ_SDK_TENANT_SECRET is set to (today: prod's
 * sk_live_…), which is wrong for every non-prod variant — their
 * session JWT would be scoped to prod's user pool but their /api/*
 * calls hit their own DB. Result: SDK calls 401 silently while
 * legacy keeps working — survivable in Phase 2 (dual-write swallows
 * errors) but not the right architecture.
 *
 * Each new variant that turns on REACT_APP_SDK_INTEGRATION must
 * have its tenant secret provisioned on the mint server first:
 *   1. node aq_backend_github/scripts/create_tenant_api_keys.js
 *      --tenant=<subdomain>
 *   2. Append AQ_SDK_TENANT_SECRET_<UPPER>=sk_live_…
 *      to /home/ubuntu/servers/server2/aq-sdk-mint-server/.env
 *   3. sudo systemctl restart aq-sdk-mint.service
 * Without that, mintSession returns 401 tenant_not_provisioned and
 * Phase 2 dual-writes silently skip.
 */
function getTenantSubdomainForMint(tenantSubdomain) {
  return tenantSubdomain || getTenantSubdomain() || '';
}

async function mintSession(userRef, tenantSubdomain) {
  if (!MINT_URL) {
    throw new Error(
      'SDK integration: REACT_APP_SDK_MINT_URL is not set. ' +
        'Wire your backend mint endpoint and rebuild.',
    );
  }
  const subdomain = getTenantSubdomainForMint(tenantSubdomain);
  // Phase 1 of the SDK-mint end-user-auth hardening (2026-07-18): attach
  // the signed-in user's Firebase ID token so the backend can verify the
  // mint is for the caller's own account (observe mode today; per-tenant
  // enforcement via advisor_config.sdk_mint_require_id_token). STRICTLY
  // fail-open — no user / any error sends the request unchanged, so old
  // flows keep working until enforcement is deliberately flipped.
  let endUserIdToken = null;
  try {
    const u = getAuth().currentUser;
    if (u) {
      endUserIdToken = await u.getIdToken();
    }
  } catch (e) {
    endUserIdToken = null;
  }
  const headers = {'Content-Type': 'application/json'};
  if (subdomain) {
    headers['X-Advisor-Subdomain'] = subdomain;
  }
  if (endUserIdToken) {
    headers.Authorization = `Bearer ${endUserIdToken}`;
  }
  const controller = new AbortController();
  const mintTimeout = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch(MINT_URL, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
      user_ref: userRef,
      // Scope set must match `aq_backend_github/utilities/
      // sessionToken.js` `ALL_SCOPES`. Today's whitelist is:
      //   connections:read, connections:write, portfolio:read,
      //   orders:read, orders:write, gtt:read, gtt:write
      // (verified 2026-05-03 from the deployed file). Requesting an
      // unknown scope risks the mint endpoint returning 400; only
      // ship scopes already whitelisted upstream.
      //
      // Phase B-1 SDK orders module (Phase B commit, 2026-05-01)
      // requires `orders:read` + `orders:write` at the route layer.
      // GTT routes — Pass 2 surfaced GTT as a missed orchestration
      // detail (StockAdvices.js:812 + OrderService.js:91 use a
      // separate `<broker>/process-trades` endpoint for GTT/SL/SL-M
      // variants) — `gtt:*` ships forward-compatibly.
      //
      // 2026-05-03: extended from 3-scope (connections:* +
      // portfolios:read [NOTE: legacy plural, backend ALL_SCOPES uses
      // singular `portfolio:read` — left as-is to avoid regression;
      // mint server tolerates unknown scopes by silent-drop based on
      // 14-day production track record, but this mismatch should be
      // reconciled in a follow-up by either fixing the request to
      // `portfolio:read` OR adding `portfolios:read` to backend
      // whitelist])
      // to the orders + gtt set per the Pass 2 cross-cutting agent
      // finding — Phase B-1 SDK orders endpoints would have 401'd
      // `scope_missing` otherwise.
      //
      // Phase D adds `sell_auth:read` + `sell_auth:write` + `funds:
      // read` to backend ALL_SCOPES; THIS file extends to request
      // them in the same commit. Until then, `requireSellAuth` and
      // `requireFunds` sub-orchestrators (CONTRACT § 6) will not
      // be reachable via SDK lane.
      //
      // Documented in:
      //   docs/SDK_ORCHESTRATION_CONTRACT.md § 10 Auth and scopes
      //   docs/SDK_ORCHESTRATION_PHASES.md Phase C pre-conditions +
      //   Phase D pre-conditions
      scopes: [
        'connections:read',
        'connections:write',
        'portfolios:read',
        'orders:read',
        'orders:write',
        'gtt:read',
        'gtt:write',
        'sell_auth:read',
        'sell_auth:write',
        'funds:read',
      ],
      }),
    });
  } finally {
    clearTimeout(mintTimeout);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`mintSession failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return {
    token: data.token,
    expires_at: data.expires_at,
    user_ref: data.user_ref || userRef,
    scopes: data.scopes || ['connections:read', 'connections:write'],
  };
}

export default function SdkProviderRoot({userEmail, children}) {
  const appConfig = useConfig();
  const {sdk: sdkComponents} = useDesign();
  // AlphaB2B can change tenant after the Firebase identity is already known.
  // The SDK session JWT is tenant-scoped, so userEmail alone is not a complete
  // session identity. Subscribe directly to the runtime-advisor authority and
  // replace the SDK client whenever the selected tenant changes.
  const [tenantSubdomain, setTenantSubdomain] = useState(
    () => getTenantSubdomain() || '',
  );
  useEffect(
    () =>
      subscribeRuntimeAdvisor(configData => {
        setTenantSubdomain(getTenantSubdomain(configData) || '');
      }),
    [],
  );

  // One client per tenant selection. Binding mintSession to the resolved
  // tenant prevents a later runtime change from mutating an in-flight mint.
  const client = useMemo(
    () =>
      new AqSdkClient({
        baseUrl: SDK_BASE_URL.replace(/\/+$/, ''),
        mintSession: userRef => mintSession(userRef, tenantSubdomain),
        zerodhaApiKey: Config?.REACT_APP_ZERODHA_API_KEY || '',
      }),
    [tenantSubdomain],
  );
  const effectiveUserRef = userEmail || SDK_TEST_USER_REF || null;
  // SDK forms used their package-default Material blue/grey styling while
  // the surrounding app used the advisor theme. Supplying the theme once at
  // the provider makes every SDK form, input and CTA read as one surface —
  // including the lower half of broker connection pages.
  const sdkTheme = useMemo(() => {
    const primary =
      appConfig?.mainColor || appConfig?.gradient2 || designColor('0056b7');
    return {
      colors: {
        primary,
        secondary: primary,
        surface: designColor('ffffff'),
        surfaceMuted: designColor('f4f7fb'),
        text: designColor('172033'),
        textMuted: designColor('64748b'),
        textLabel: designColor('334155'),
        inputBorder: designColor('cbd5e1'),
        inputBorderError: designColor('dc2626'),
        error: designColor('b91c1c'),
        warning: designColor('92400e'),
        success: designColor('047857'),
        headerBackground: primary,
        headerText: designColor('ffffff'),
        primaryDisabled: designColor('94a3b8'),
        divider: designColor('e2e8f0'),
      },
      typography: {
        titleSize: 19,
        titleWeight: '800',
        bodySize: 13,
        helperSize: 12,
        buttonSize: 15,
        fontFamily: designFont('Satoshi-Regular'),
      },
      shape: {radiusSm: 10, radiusMd: 14},
    };
  }, [appConfig?.mainColor, appConfig?.gradient2]);

  // 2026-05-07: <ExecuteAdviceOverlay /> MUST be rendered inside the
  // provider tree. The SDK's `AqSdkClient.executeAdvice()` calls into
  // the overlay's module-level `_showReview` / `_showResult` /
  // `_setProgress` bridges to drive its review modal + progress + result
  // UI. If the overlay component is not mounted, those bridges are no-
  // ops (`_setState` is null), `_showReview` returns a Promise that
  // never resolves, and the calling screen's spinner hangs forever.
  // SDK_INTEGRATION_GUIDE.md § 2 explicitly requires this mount —
  // omitting it was the silent root cause of the post-tap-Place-Order
  // permanent spinner observed 2026-05-06/07.
  return (
    <AqSdkProvider
      key={`aq-sdk-${tenantSubdomain || 'default'}`}
      client={client}
      userRef={effectiveUserRef}
      theme={sdkTheme}
      components={sdkComponents}>
      {children}
      <ExecuteAdviceOverlay />
    </AqSdkProvider>
  );
}

/**
 * Read the on/off flag for the parallel SDK-powered code path. Used by
 * App.js to decide whether to wrap the tree, and by individual
 * screens that have a parallel SDK demo route.
 */
export function isSdkIntegrationEnabled() {
  return String(Config?.REACT_APP_SDK_INTEGRATION || '').toLowerCase() === 'true';
}
