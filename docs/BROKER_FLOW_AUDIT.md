# Broker Flow Audit — Phase 3 SDK Migration

> **Per-broker walkthrough of the legacy connect flow vs the SDK Phase 3 path.** For each broker: legacy entry points, every API call (file:line), WebView intercepts, encryption, IP-whitelist, reauth handling, help content, broker-specific quirks, then the SDK widget mapping + backend SDK route + touchpoint comparison + gap fix plan + verdict.
>
> Goal: anyone reading this doc can move a broker from legacy to SDK with confidence that every legacy touchpoint is replicated. This is the depth audit; `PHASE3_BROKER_AUDIT.md` is the matrix.

## Scope

14 brokers in canonical order:

1. Zerodha
2. Angel One
3. Upstox
4. ICICI Direct
5. Kotak Securities
6. Dhan
7. Fyers
8. IIFL Securities
9. AliceBlue
10. Motilal Oswal
11. HDFC Securities
12. Groww
13. Axis Securities
14. DummyBroker (simulation)

## Summary table

| # | Broker | Legacy flow type | SDK verdict | Key gaps |
|---|--------|------------------|-------------|----------|
| 1 | Zerodha | OAuth (empty-fields, env apiKey) | SDK-broken | Android 302 redirect race; Kite dev-portal redirect URL needs migration |
| 2 | Angel One | Publisher-OAuth (broker-initiated, embedded apiKey) | SDK-broken | Shared-mode SDK route missing; per-customer flow needs `flow=credentials-then-oauth` |
| 3 | Upstox | OAuth (apiKey + secretKey) | SDK-with-gap | Reauth pre-fill, defensive URL parsing, model portfolio refresh |
| 4 | ICICI Direct | OAuth (apiKey + secretKey, `apisession` callback) | SDK-with-gap | EgressIpCallout content thinner than legacy step text; reauth pre-fill |
| 5 | Kotak Securities | Credentials + TOTP (NEO API: apiKey + mobile + mpin + ucc + totp) | SDK-with-gap | TOTP 30s debounce; TOTP-specific error parsing; mobile-number normalization |
| 6 | Dhan | OAuth (CCXT partner consent) + manual fallback | SDK-with-gap | Error branch (HTTP vs network); reauth hydration; custom User-Agent; help content |
| 7 | Fyers | OAuth (apiKey/secretKey field naming inversion) | SDK-broken | IP-whitelist gate missing in SDK; reauth hydration missing; "Order Placement permission" warning |
| 8 | IIFL Securities | Customer-owned App Key/App Secret → OAuth WebView → Node exchange + MongoDB persistence | SDK-broken / legacy-correct | SDK schema still models a different credentials/TOTP product; production deliberately uses the re-certified direct legacy modal |
| 9 | AliceBlue | OAuth (empty-fields, hardcoded `prod.alphaquark.in` origin) | SDK-with-gap | Schema needs `flow=oauth, fields=[]`; hardcoded redirect URL override |
| 10 | Motilal Oswal | OAuth (apiKey + clientCode, accessToken in callback) | SDK-with-gap | Schema mismatch; 30s session-affinity debounce; Restart-on-error callback; reauth pre-fill |
| 11 | HDFC Securities | OAuth (apiKey + secretKey, `requestToken` callback) | SDK-clean (subject to verification) | IP_WHITELIST_BROKERS extension; backend `/exchange-token` requestToken acceptance |
| 12 | Groww | Credentials (JWT + Base32 TOTP) | SDK-broken | Schema dual-field shape; Base32 validator; granular per-error-code mapping |
| 13 | Axis Securities | OAuth (SSO `ssoId` callback) | SDK-with-gap | Backend `/sdk/v1/connections/Axis Securities/login-url` proxy missing |
| 14 | DummyBroker | Stub (auto-success) | SDK-clean | None |

**Closest to actual SDK promotion:** HDFC (subject to emulator verification + IP_WHITELIST_BROKERS extension). Axis (subject to backend `/login-url` proxy). All others have non-trivial gaps.


## 1. Zerodha

### Legacy flow (production path)

**Entry points:**
- `ZerodhaConnectModal.js` (line 5) thin wrapper that calls `ZerodhaConnectUI` (line 26)
- `ZerodhaConnectUI.js` is the real implementation (500+ lines, lines 43-497)
- `BrokerConnectModalDispatch` case `'Zerodha'` (line 137) — but currently in `SDK_LEGACY_FALLBACK` so always falls through to legacy switch
- ModalManager dispatch passes: `isVisible`, `onClose`, `fetchBrokerStatusModal`, `setShowBrokerModal`

**Form fields:**
The modal is API-key-gated (no user form) — the apiKey is seeded from environment at line 158 (`configData?.config?.REACT_APP_ZERODHA_API_KEY || Config?.REACT_APP_ZERODHA_API_KEY`). User only authenticates via WebView (Zerodha username + password + 2FA TOTP).

**Step-by-step flow:**
1. Modal mounts; state initialized: `expanded` (help toggle), `isLoading`, `showWebView`, `authUrl`, `hasProcessedCallback` ref (line 48-53).
2. ConfigContext/TradeContext consumed: `configData?.config` for API key + header name (line 54-65).
3. User taps "Login to Zerodha" button → `handleConnectZerodha()` fires (line 282).
4. Validation: apiKey is required from config (lines 294-296); if missing, alert "Zerodha API key not configured".
5. Headers constructed: `X-Advisor-Subdomain` from config or fallback (line 65), `aq-encrypted-key` via `generateToken()` (lines 66-69).
6. POST to `${server.ccxtServer.baseUrl}zerodha/login-url` with body `{apiKey, site}` (lines 301-307). The `site` param is `brokerConnectRedirectURL?.replace('https://', '')` (line 305).
7. Backend response: `response.data` is the URL string (line 315).
8. WebView opens at `authUrl` with full cookie + JS support (lines 410-426). Config: `onNavigationStateChange={handleWebViewNavigationStateChange}` (line 413), `domStorageEnabled={true}`, `thirdPartyCookiesEnabled={true}` (lines 415-416).
9. WebView intercept logic: `handleWebViewNavigationStateChange()` (line 329) — detects when URL contains `status=`, `request_token=`, or `type=` query params (line 335). Parses query string defensively (lines 73-85). Extracts `request_token` from `queryParams.request_token` (line 343).
10. On match: `hasProcessedCallback.current = true` (line 350) prevents double-processing; calls `processOAuthCallback(requestToken)` (line 351).
11. Token exchange: POST to `${server.ccxtServer.baseUrl}zerodha/gen-access-token` with body `{user_email, apiKey, requestToken}` (lines 110-113). Expects response shape `{status, access_token}` (lines 116-118).
12. Response parsing: Checks `response.data.status !== 1` for success (line 116); throws on failure. Then checks for `access_token` field (line 118).
13. PUT `/api/user/connect-broker` with body `{uid, user_broker: 'Zerodha', jwtToken: accessToken, apiKey}` (lines 139-143).
14. SDK dual-write: when `sdkBridge.enabled && sdkBridge.ready` (line 169), calls `sdkExchangeBrokerToken(sdkBridge.client, 'Zerodha', {requestToken, apiKey})` (lines 171-174). Falls back to legacy if SDK fails (lines 194-202).
15. Model portfolio refresh: POST `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf` with body `{user_email, user_broker: 'Zerodha'}` (lines 227-232, non-critical).
16. Success: close WebView, call `onClose()` (lines 240-241), wrap post-success in try-catch to avoid throwing (lines 246-256), emit `showAlert('success', ...)` + call `onConnectionSuccess()` (lines 247-250).
17. Error path: catches in outer block (lines 257-279). Distinguishes `isHttpError` (response present) from network error. Shows "Connection Error" for HTTP, "Connection Issue" for network (lines 265-275).

**Encryption:**
No encryption of user-supplied credentials (there are none). The `apiKey` from config is passed plaintext in the request body and headers. No CryptoJS usage in ZerodhaConnectUI.

**Auth header construction:**
- `aq-encrypted-key`: `Config?.REACT_APP_AQ_ENCRYPTED_KEY || generateToken(Config?.REACT_APP_AQ_KEYS, Config?.REACT_APP_AQ_SECRET)` (lines 66-69). Uses `generateToken()` from `SecurityTokenManager.js`.
- `X-Advisor-Subdomain`: `configData?.config?.REACT_APP_HEADER_NAME || Config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain()` (line 65).

**IP-whitelist gate:**
No EgressIpCallout. Zerodha is not in `WHITELIST_BROKERS` (line 65 of EgressIpCallout.js excludes it).

**Reauth handling:**
No `reauthConfig` prop. Each connect attempt starts from scratch.

**Help content:**
Imports `ZerodhaHelpContent` (line 24). YouTube video ID: `tqJTYfgkS04` (line 19 in ZerodhaHelpContent.js). Step count: 7 steps (5 collapsed, 2 expanded). Steps include "Click Login to Zerodha", "Redirect to Zerodha login", "Enter User ID + Password", "Complete 2-Factor Authentication", "Review and authorize", "Redirected back to app", "Account now connected". Important notes: "login credentials not stored", "tokens expire every 24 hours" (line 60), "reconnect daily" (implicit). Line 37: "2-Factor Authentication (TOTP/PIN)".

**Broker-specific quirks:**
- **Android 302-redirect intercept issue**: `prod.alphaquark.in/stock-recommendation` 302-redirects unauthenticated visitors to `/login`. Android WebView resolves the 302 chain internally before the JS `onNavigationStateChange` hook fires, so the redirect URL with `request_token` is lost. The `handleWebViewNavigationStateChange()` detector (line 335) looks for `request_token=` in the final URL, but if Android's internal 302 resolution strips the query param, it never fires. **Real fix**: register a non-redirecting redirect URL on Kite dev portal (e.g., `app-links.alphaquark.in/zerodha-callback`). This is out-of-band and not yet done.
- **SDK single-use token guard**: When SDK path is active, calls `sdkExchangeBrokerToken()` first (lines 171-174). Zerodha's `requestToken` is a single-use OAuth code; calling `gen-access-token` twice fails the second time. The code falls back to legacy (line 200) if SDK exchange fails, but this means the token may already be spent (lines 200-201).

**Backend Node routes (aq_backend_github):**
`/api/user/connect-broker` PUT route at `Routes/userRoutes.js` (called at line 141).

**ccxt-india routes:**
`/zerodha/login-url` POST at `ccxt-india/apps/app_zerodha.py` (called at line 301).
`/zerodha/gen-access-token` POST at `ccxt-india/apps/app_zerodha.py` (called at line 110).

### SDK flow (Phase 3)

**Schema row:** From `brokerFormSchema.ts` lines 123-130:
```
Zerodha: {
  broker: "Zerodha",
  flow: "oauth",
  intro: "Sign in to your Zerodha account. The advisor's Kite Connect API key is used; you only provide your Kite username + password in the WebView.",
  fields: [],
}
```

**Phase3SdkBrokerModal handling:** Lines 299-304 of Phase3SdkBrokerModal.js seed the apiKey from env if Zerodha is detected:
```javascript
if (brokerName === 'Zerodha') {
  extras.apiKey = extras.apiKey || Config?.REACT_APP_ZERODHA_API_KEY || configData?.config?.REACT_APP_ZERODHA_API_KEY || '';
}
```

**Backend SDK route:** `/sdk/v1/connections/Zerodha/login-url` (line 858 onwards in connections.js). Routes via `_selfCallLegacy` to `/api/zerodha/login-url` OR ccxt.

**ccxt-india proxy target:** `/zerodha/login-url` and `/zerodha/gen-access-token` on ccxt-india.

**SDK widget API surface:** `WebViewBrokerAuthFlow` receives `broker="Zerodha"`, `redirectUrl=REDIRECT_URL` (from Phase3SdkBrokerModal line 223), `extraExchangeBody={apiKey}` (from line 224). On success, calls `onSuccess()` (line 225). On error, calls `onError(sdkError)` (line 226).

### Touchpoint comparison table

| Touchpoint | Legacy | SDK | Status |
|-----------|--------|-----|--------|
| Form field collection | None (API key from env) | None (API key from env, seeded at line 299 of Phase3SdkBrokerModal) | ✅ matches |
| apiKey source | `Config.REACT_APP_ZERODHA_API_KEY` | `Config.REACT_APP_ZERODHA_API_KEY` seeded into `extraExchangeBody` | ✅ matches |
| OAuth flow | Yes, WebView + `onNavigationStateChange` intercept | Yes, `WebViewBrokerAuthFlow` handles | ✅ matches |
| Redirect URL intercept param | `request_token=` in URL (line 343) | SDK widget looks for redirect URL match, extracts query params | ✅ matches in principle |
| Token exchange route | POST `ccxt/zerodha/gen-access-token` with `{user_email, apiKey, requestToken}` | POST `/sdk/v1/connections/Zerodha/exchange-token` with `{requestToken, apiKey}` | ⚠️ different endpoints but same upstream |
| Token persistence | PUT `/api/user/connect-broker` with `{uid, user_broker, jwtToken, apiKey}` | PUT `/sdk/v1/connections/Zerodha/connect` with same body shape | ✅ matches (SDK route proxies to legacy) |
| Model portfolio refresh | POST `ccxt/rebalance/change_broker_model_pf` | Handled separately by SDK client or omitted | ⚠️ SDK widget doesn't refresh |
| Help content | `ZerodhaHelpContent` component (video ID `tqJTYfgkS04`, 7 steps) | `Phase3BrokerHelp` imports legacy component at line 280 | ✅ matches |
| Success toast | `showAlert('success', ...)` (line 247) | SDK `onSuccess()` triggers fetch + modal dismiss | ✅ visible outcome equivalent |
| Error handling | "Connection Error" vs "Connection Issue" (lines 265-275) | SDK `onError()` sets `errorMessage` (line 182), renders in error box | ⚠️ error wording differs |
| IP-whitelist gate | None | None (Zerodha not in `IP_WHITELIST_BROKERS`, line 155) | ✅ matches |
| Reauth pre-fill | No `reauthConfig` | No `reauthConfig` API in SDK | ✅ matches (neither supports) |
| Android 302-intercept workaround | Hardcoded `onNavigationStateChange` detector (line 335) | SDK widget relies on generic redirect-URL match | ❌ missing — SDK widget will miss Android 302-redirected URLs |
| Single-use token protection | SDK dual-write guards with fallback (line 194-202) | SDK as primary, no fallback | ❌ missing — no fallback if token spent |

### Gap fix plan

**Gap 1: Android 302-redirect loss on SDK path**
- **File:line to fix:** `../../alphaquark-mobile-sdk/packages/rn/src/components/WebViewBrokerAuthFlow.tsx`. Real fix is OUT-OF-BAND: register a non-redirecting redirect URL on Kite developer portal (e.g., `app-links.alphaquark.in/zerodha-callback`). Then update `REDIRECT_URL` (line 91 of Phase3SdkBrokerModal.js) OR the SDK widget's hardcoded default to use the non-redirecting URL.
- **Dependencies:** Kite dev-portal registration (out-of-band), possibly SDK package version bump.

**Gap 2: Single-use token protection missing in SDK path**
- **File:line to fix:** `Phase3SdkBrokerModal.js` line 160-170 (the `onSuccess` callback).
- **Exact change required:** Add retry logic similar to legacy (lines 194-202) — if `exchangeBrokerToken` fails with "token invalid" or similar, do NOT immediately fail; instead, catch and surface a "Your token may have expired; please tap Connect again to re-authenticate" message.
- **Dependencies:** SDK package error-shape documentation.

### Verdict

**SDK-broken** — the core OAuth flow is mapped, but the Android 302-redirect issue makes the SDK path non-functional on devices where the redirect URL is served by a 302-redirecting web server. The legacy modal has a workaround (custom URL-pattern detection at line 335), but the SDK widget doesn't. Zerodha will fail silently on Android unless the Kite dev portal is updated to register a non-redirecting redirect URL. This is a **prerequisite blocker**. Once that's done, Zerodha becomes SDK-clean. In `SDK_LEGACY_FALLBACK` today.

---

## 2. Angel One

### Legacy flow (production path)

**Entry points:**
- `AngleoneBookingModal.js` (line 20, the wrapper, renamed from "TrueSheet")
- `BrokerConnectModalDispatch` case `'Angel One'` — currently in `SDK_LEGACY_FALLBACK` so always routes to legacy regardless of flag
- Dispatch passes: `isVisible`, `onClose`, `setShowBrokerModal`, `fetchBrokerStatusModal`

**Form fields:**
**None**. Pure publisher-OAuth flow. The apiKey is the platform's shared SmartAPI vendor key, embedded directly in the WebView URL. User sees no form, only the broker's OAuth login page.

**Step-by-step flow:**
1. Modal mounts; state initialized: `authUrl`, `authtoken`, `userDetails`, `isToastShown` ref (lines 54-114).
2. ConfigContext/TradeContext consumed: `configData?.config?.REACT_APP_ANGEL_ONE_API_KEY` (line 112).
3. When `isVisible` becomes true, effect fires (line 236). Constructs the ccxt login-url query: `apiKey`, `origin` (advisor web domain), `returnPath` (stock-recommendation), `redirectUrl` (legacy callback URL) (lines 237-259).
4. Sets `authUrl` to `${ccxtUrl}angelone/login-url?apiKey=${apiKey}&origin=${origin}&returnPath=${returnPath}&redirectUrl=${legacyRedirect}` (line 257-258). The `legacyRedirect` is hardcoded as `https://alphaquark.in/api/deploy/broker/callback` (line 254-256).
5. `sheet.current?.present()` opens the TrueSheet (line 261).
6. WebView navigates to the constructed URL (passed to `AngleOneConnectUI`, line 275-281).
7. WebView intercept logic: `handleWebViewNavigationStateChange()` (line 101-111) — detects `auth_token=` in the URL (line 103). Parses query string defensively (lines 84-98). Extracts `sessionToken` as `queryParams.auth_token` (line 105).
8. On match: closes TrueSheet (line 108), sets `authToken` state (line 107). This triggers the effect at line 229.
9. Token exchange is implicit — Angel One publisher-OAuth returns `auth_token` directly in the redirect URL, not an exchange code. No separate gen-access-token call.
10. PUT `/api/user/connect-broker` with body `{uid, user_broker: 'Angel One', jwtToken: authtoken, apiKey: angelApi, ddpi_status}` (lines 120-126, 129-139).
11. SDK dual-write: if `sdkBridge.enabled && sdkBridge.ready` (line 149), calls `sdkDualWriteSafely(sdkConnectBroker(...), 'Angel One', 'connect')` (lines 150-154).
12. Model portfolio refresh: POST `ccxt/rebalance/change_broker_model_pf` with body `{user_email, user_broker: 'AngelOne'}` (lines 158-174). Caught separately so connection success isn't affected (line 177).
13. Success: close modal (line 187-188), emit `refreshEvent` (line 194), call `fetchBrokerStatusModal()` (line 195), show toast only if migration modal didn't show (lines 196-197).
14. Error path: catches on connect-broker failure (lines 206-224). Distinguishes HTTP error from network error. Shows "Connection Error" for HTTP, "Connection Issue" for network (lines 215-223).

**Encryption:**
No encryption. Publisher-OAuth `auth_token` passed plaintext in URL.

**Auth header construction:**
- `aq-encrypted-key`: `generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)` (lines 67-70).
- `X-Advisor-Subdomain`: `configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain()` (line 66).

**IP-whitelist gate:**
No EgressIpCallout. Angel One is not in the legacy `WHITELIST_BROKERS` set (but it IS in the SDK's `IP_WHITELIST_BROKERS` at line 83 of Phase3SdkBrokerModal.js — mismatch).

**Reauth handling:**
No `reauthConfig` prop.

**Help content:**
No help content imported. The legacy modal is minimal — just the WebView. The SDK schema (lines 131-172 of brokerFormSchema.ts) includes prerequisites and help text, but the legacy modal doesn't show these.

**Broker-specific quirks:**
- **Publisher-OAuth (broker-initiated)**: Angel One owns the flow. The apiKey is NOT user-supplied; it's the platform's shared key embedded in the query.
- **Hardcoded redirect URL**: `https://alphaquark.in/api/deploy/broker/callback` (line 254-256). This MUST match what's registered in the Angel One SmartAPI app dev portal. No config override — if the registered URL differs, the flow silently fails with "Invalid redirect URL" (per commit 741d8412 comment).
- **Recent fix (prod-alphaquark-github commit 741d8412)**: The web frontend's `handleAngelOneConnect()` was fixed to append `&redirectUrl=<URL-encoded-legacy-callback>` to the ccxt login-url call. This disambiguates which of the advisor's multiple SmartAPI apps' registered URLs to use. The mobile legacy (AngleoneBookingModal.js lines 254-258) mirrors this fix — it now passes `redirectUrl` to ccxt.
- **ddpi_status field**: Persisted alongside `jwtToken` for compliance tracking (line 125).

**Backend Node routes (aq_backend_github):**
`/api/user/connect-broker` PUT route (called at line 129).

**ccxt-india routes:**
`/angelone/login-url` GET at `ccxt-india/apps/app_angelone.py` (lines 122-177). Public endpoint (no `@validate_token`) because it's reached by direct browser navigation. Returns a 302 redirect to SmartAPI publisher-login.

ccxt-india's `_publisher_redirect_url = "https://ccxtprod.alphaquark.in/angelone/callback"` constant (in `brokers/angelone/angelone.py`, commit 81ff50f9) is now ALWAYS appended to the publisher-login URL as `&redirect_url={quote(...)}` so SmartAPI can disambiguate which Trading credential App to use.

### SDK flow (Phase 3)

**Schema row:** From `brokerFormSchema.ts` lines 131-172:
```
"Angel One": {
  broker: "Angel One",
  flow: "oauth",
  intro: "Connect your personal Angel One SmartAPI app...",
  prerequisites: [...],
  fields: [FIELD_API_KEY, FIELD_API_SECRET, { name: "clientCode", ... }],
}
```

**Phase3SdkBrokerModal handling:** Angel One IS in SDK_ELIGIBLE_MODALS (test override) but ALSO in `SDK_LEGACY_FALLBACK` so it falls through to legacy AngleoneBookingTrueSheet — the publisher-OAuth flow above.

**SDK widget behavior differs from legacy:**
- Legacy: NO form (publisher-OAuth, embedded shared apiKey, no user form).
- SDK schema: form collects `apiKey + secretKey + clientCode` (per-customer SmartAPI mode — different mode).

These are fundamentally different flows. The SDK is for per-customer mode (user supplies their own SmartAPI app credentials). The legacy is for shared-mode (advisor's platform key embedded).

**ccxt-india proxy target:** `/angelone/login-url` for per-customer mode (accepts apiKey + secretKey + clientCode + redirect URL).

### Touchpoint comparison table

| Touchpoint | Legacy | SDK | Status |
|-----------|--------|-----|--------|
| Form field collection | None (publisher-OAuth) | Three fields: apiKey, secretKey, clientCode (per-customer mode) | ❌ fundamentally different |
| apiKey source | `REACT_APP_ANGEL_ONE_API_KEY` (platform-shared, embedded) | User-supplied (per-customer SmartAPI app) | ❌ different mode |
| OAuth flow | Yes, publisher-initiated (Angel One owns the flow) | Yes, per-customer app OAuth (user owns the app) | ❌ different broker flow type |
| Redirect URL | Hardcoded `https://alphaquark.in/api/deploy/broker/callback` | From `/sdk/v1/connections/Angel%20One/login-url` response | ⚠️ different source |
| Token exchange | Publisher-OAuth `auth_token` in redirect URL (implicit) | POST `/sdk/v1/connections/Angel%20One/exchange-token` with code + fields | ⚠️ different exchange type |
| Token persistence | PUT `/api/user/connect-broker` | PUT `/sdk/v1/connections/Angel%20One/connect` (via `/update-credentials` proxy) | ⚠️ different endpoints |
| Model portfolio refresh | POST `ccxt/rebalance/change_broker_model_pf` | Omitted from SDK flow | ❌ missing |
| IP-whitelist gate | None (legacy doesn't gate) | YES — Phase3SdkBrokerModal includes Angel One in `IP_WHITELIST_BROKERS` (line 83) | ❌ mismatch — SDK gates, legacy doesn't |
| Shared-mode support (REACT_APP_ANGEL_ONE_API_KEY embedded) | Yes, full support | No — SDK routes don't branch on advisor config | ❌ missing |
| Per-customer mode support | No (legacy is publisher-OAuth) | Yes (new post-2026-04-28 flow) | ✅ SDK supports this |

### Gap fix plan

**Gap 1: Shared-mode vs per-customer mode incompatibility**
- **File:line to fix:** `aq_backend_github/Routes/sdk/v1/connections.js` Angel One section. Add a `/sdk/v1/connections/Angel%20One/login-url` handler that checks the advisor's `useSharedAngelOneKey` config flag. If true, route to ccxt `/angelone/login-url` with the platform apiKey (fetched from `all_advisor_details`). If false, route to `/api/angel-one/update-key` with user-supplied credentials.
- **Dependencies:** Backend deploy.

**Gap 2: IP-whitelist gate mismatch**
- **File:line to fix:** `Phase3SdkBrokerModal.js` line 83 — `IP_WHITELIST_BROKERS` set.
- **Exact change required:** Make the gate dynamic — call EgressIpCallout only if per-customer mode is active.

### Verdict

**SDK-broken** — The legacy flow is publisher-OAuth with a shared platform API key. The SDK schema and phase-3 implementation assume per-customer mode (user supplies their own SmartAPI app credentials). These are fundamentally different broker integrations. Until the SDK routes support both modes, Angel One stays legacy. In `SDK_LEGACY_FALLBACK` today, regardless of `useSharedAngelOneKey`.

---

## 3. Upstox

### Legacy flow (production path)

**Entry points:**
- `upstoxModal.js` (line 26, the main wrapper component)
- `BrokerConnectModalDispatch` case `'Upstox'` — when SDK_ELIGIBLE_MODALS allows it AND not in fallback, routes to Phase3SdkBrokerModal; otherwise legacy
- Dispatch passes: `isVisible`, `onClose`, `setShowupstoxModal`, `setShowBrokerModal`, `fetchBrokerStatusModal`, `reauthConfig` (optional)

**Form fields:**
- `apiKey` (text input, line 38, password-hidden by default line 40)
- `secretKey` (text input, line 39, password-hidden by default line 41)
Both are required, validated client-side (line 294: "Please check your API Key and Secret Key"), encrypted before transmission.

**Step-by-step flow:**
1. Modal mounts; state initialized: `apiKey`, `secretKey`, `isPasswordVisible`, `isPasswordVisibleup`, `showWebView`, `authUrl`, `upstoxCode`, `upstoxSessionToken`, `hasConnectedUpstox` ref, `egressReady`, `unmetAck`, `helpVisible` (lines 38-127).
2. ConfigContext/TradeContext consumed: `configData?.config?.REACT_APP_HEADER_NAME`, `freshConfig?.REACT_APP_BROKER_CONNECT_REDIRECT_URL` (lines 34-64).
3. Reauth hydration (lines 421-432): if `reauthConfig` is supplied AND contains `authUrl + apiKey + secretKey`, hydrate form and jump straight to WebView, skipping form entry. This is the "smart reauth" optimization.
4. User enters apiKey + secretKey, taps "Connect" → `updateSecretKey()` fires (line 129).
5. Validation:
   - IP-whitelist gate: if `!egressReady`, flash unmet acknowledgment for 2.5s (lines 130-133).
   - Redirect URL validation: if `!brokerConnectRedirectURL`, alert "Broker redirect URL is not configured" (lines 135-138).
6. Encryption: `CryptoJS.AES.encrypt(value, 'ApiKeySecret')` for both apiKey and secretKey (lines 143-144, via `checkValidApiAnSecret()` at line 73).
7. POST to `${server.server.baseUrl}api/upstox/update-key` with body `{uid, apiKey (encrypted), secretKey (encrypted), redirect_uri, user_broker: 'Upstox'}` (lines 141-161).
8. Backend response shape: `response.data.response` contains the URL or error (line 169). Checks for `error_code` or `error_message` in the response URL string (line 172).
9. **Defensive URL error parsing** (lines 181-196): Instead of `new URL().searchParams` (which React Native's URL polyfill doesn't support well), uses manual string parsing. Splits `?` to separate query string, then splits `&` for pairs. Replaces `+` with space BEFORE decoding (line 187-189) because Upstox form-encodes spaces as `+`, not `%20`.
10. If error detected in authUrl: alert the error_message + error_code (lines 204-209).
11. If no error: open WebView at `authUrl` (lines 213-214).
12. WebView intercept logic: `handleWebViewNavigationStateChange()` (line 224) — detects `code=` in the URL (line 228). Parses query string (lines 229-231). Extracts `authCode` (line 232).
13. On match: close WebView (line 236), set `upstoxCode` (line 235). This triggers effect at line 288.
14. Token exchange: `connectUpstox()` (line 243) fires when `upstoxCode !== null` (line 288). POST to `${server.ccxtServer.baseUrl}upstox/gen-access-token` with body `{user_email, apiKey (plaintext), apiSecret: secretKey (plaintext), code, redirectUri}` (lines 246-252). Note: apiKey/apiSecret here are plaintext, NOT encrypted (the encryption was only for the `/api/upstox/update-key` call, now decrypted by backend).
15. Backend response: expects `response.data?.access_token` (line 270). If missing, error (lines 271-275).
16. Sets `upstoxSessionToken` (line 278). This triggers effect at line 400.
17. PUT `/api/user/connect-broker` with body `{uid, user_broker: 'Upstox', jwtToken: upstoxSessionToken, apiKey (encrypted), secretKey (encrypted)}` (lines 298-316).
18. SDK dual-write: if `sdkBridge.enabled && sdkBridge.ready` (line 326), calls `sdkDualWriteSafely(sdkConnectBroker(...), 'Upstox', 'connect')` (lines 327-331).
19. Model portfolio refresh: POST `ccxt/rebalance/change_broker_model_pf` (lines 336-351). Non-critical.
20. Success: close modal (line 356-357), refreshEvent (line 365), show toast only if migration modal didn't show (line 367).
21. Error path: catches on token exchange (lines 280-284) or connect-broker (lines 377-395). Distinguishes HTTP from network. "Connection Error" vs "Connection Issue".

**Encryption:**
- On `/api/upstox/update-key` call: `CryptoJS.AES.encrypt(apiKey, 'ApiKeySecret')` + same for secretKey (lines 143-144).
- On `/ccxt/upstox/gen-access-token` call: apiKey/secretKey passed plaintext (lines 249-250) — backend has already decrypted them.
- On `/api/user/connect-broker` call: re-encrypted (lines 302-303).

**Auth header construction:**
- `aq-encrypted-key`: `generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)` (lines 155-157).
- `X-Advisor-Subdomain`: `configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain()` (line 154).

**IP-whitelist gate:**
Yes — `EgressIpCallout` component (imported in UpstoxConnectUI, passed props at line 462). The `egressReady` state (line 126) gates the form submission. When unmet, `unmetAck` flash shows for 2.5s (lines 131-133).

**Reauth handling:**
Yes — `reauthConfig` prop (line 32) with shape `{authUrl, apiKey, secretKey}` (lines 424-430). Hydration logic: when `isVisible && reauthConfig` (line 423), pre-fills state + jumps to WebView (lines 428-431). Ref guard prevents double-hydration (line 427).

**Help content:**
Rendered in UpstoxConnectUI. The modal has a help modal (line 454, `OpenHelpModal` handler). `Phase3BrokerHelp` for SDK imports `UpstoxHelpContent`. YouTube ID: `yfTXrjl0k3E`. Step count: 5 steps. Critical warning: "paste your dedicated static IP into the Allowed IPs field — Upstox rejects every order from a non-whitelisted IP with UDAPI1154 'static IP mismatch'".

**Broker-specific quirks:**
- **Defensive URL parsing**: Upstox form-encodes spaces as `+`, not `%20`. The modal manually decodes (lines 187-189).
- **Redirect URL validation**: Upstox rejects with "Invalid redirect_uri" if the URL doesn't match the dev portal registration. The modal checks for this error in the response URL (lines 172-210) before opening WebView, surfacing the error inline.
- **Reauth optimization**: Unlike most brokers, Upstox supports jumping straight to WebView if a previous authorization succeeded and we have the stored authUrl + credentials. This skips the form (lines 421-432).
- **EgressIpCallout mandatory**: Upstox's API rejects with "IP not whitelisted" (UDAPI1154) if the call comes from an unwhitelisted IP. The modal gates on this (lines 130-133).

**Backend Node routes (aq_backend_github):**
`/api/upstox/update-key` POST at `Routes/UpstoxRoutes.js` (lines 141-160).
`/api/user/connect-broker` PUT (line 307).

**ccxt-india routes:**
`/upstox/gen-access-token` POST at `ccxt-india/apps/app_upstox.py` (line 256).

### SDK flow (Phase 3)

**Schema row:** From `brokerFormSchema.ts` lines 174-180:
```
Upstox: {
  broker: "Upstox",
  flow: "oauth",
  intro: "Connect via Upstox Login.",
  prerequisites: ["Upstox Pro app credentials from api.upstox.com"],
  fields: [FIELD_API_KEY, FIELD_API_SECRET],
}
```

**Phase3SdkBrokerModal handling:** Renders `BrokerCredentialForm` with the two fields. `onContinueToOauth` collects `{apiKey, secretKey}` and sets `oauthExtraBody`. Then `WebViewBrokerAuthFlow` opens.

**Backend SDK route:** `/sdk/v1/connections/Upstox/login-url` at line 858+ in connections.js. Per `LEGACY_PER_BROKER_SLUG` (line 212) where `"Upstox": "upstox"`, this routes through `_selfCallLegacy` to `/api/upstox/update-key`.

**ccxt-india proxy target:** `/upstox/gen-access-token` on ccxt-india.

**SDK widget API surface:** `BrokerCredentialForm` renders apiKey + secretKey fields, encrypts them (per `encryptField` at line 102), submits to `/sdk/v1/connections/Upstox/update-credentials` which proxies to `/api/upstox/update-key`. Backend returns the OAuth URL. Then `WebViewBrokerAuthFlow` opens and captures the `code=` param, posts to `/sdk/v1/connections/Upstox/exchange-token`.

### Touchpoint comparison table

| Touchpoint | Legacy | SDK | Status |
|-----------|--------|-----|--------|
| Form field collection | apiKey + secretKey (encrypted before POST) | apiKey + secretKey (encrypted via `encryptField` before POST) | ✅ matches |
| Encryption envelope | `CryptoJS.AES.encrypt(value, 'ApiKeySecret')` (lines 73, 143-144) | Same envelope via `encryptField` (line 102-103) | ✅ matches |
| OAuth URL generation | POST `/api/upstox/update-key` (line 150) | POST `/sdk/v1/connections/Upstox/update-credentials` → proxies to `/api/upstox/update-key` | ✅ matches |
| Redirect URL validation | Defensive check in response URL for `error_code` + `error_message` (lines 172-210) | SDK widget returns error to `onError` callback (line 172) | ⚠️ SDK loses defensive parsing |
| WebView intercept | Detects `code=` in URL (line 228) | WebViewBrokerAuthFlow matches redirect URL, extracts query params | ✅ matches in principle |
| Token exchange | POST `/ccxt/upstox/gen-access-token` with `{apiKey, apiSecret, code, redirectUri}` (lines 246-266) | POST `/sdk/v1/connections/Upstox/exchange-token` with backend-determined body | ✅ matches (SDK proxies to same endpoint) |
| Token persistence | PUT `/api/user/connect-broker` with `{uid, user_broker, jwtToken, apiKey (encrypted), secretKey (encrypted)}` | PUT `/sdk/v1/connections/Upstox/connect` with same body | ✅ matches |
| Model portfolio refresh | POST `ccxt/rebalance/change_broker_model_pf` (lines 336-351) | Omitted | ❌ missing |
| Help content | UpstoxHelpContent component | `Phase3BrokerHelp` renders UpstoxHelpContent (legacy component) | ✅ matches |
| Success flow | Close modal → refreshEvent + toast (lines 365-367) | SDK onSuccess → fetchBrokerStatusModal → modal dismiss (line 162) | ✅ visible outcome equivalent |
| Error handling | "Connection Error" vs "Connection Issue" (lines 377-395), with defensive URL parsing for broker-specific errors (lines 172-210) | SDK widget error message (line 182), no defensive parsing | ⚠️ SDK loses defensive error detection |
| IP-whitelist gate | EgressIpCallout with `egressReady` gate (line 130) | EgressIpCallout in Phase3SdkBrokerModal — but Upstox NOT in `IP_WHITELIST_BROKERS` (line 83-89) | ❌ MISMATCH — needs Upstox added |
| Reauth pre-fill | Yes — `reauthConfig` prop with `{authUrl, apiKey, secretKey}` pre-fills form and jumps to WebView (lines 422-432) | No — SDK `BrokerCredentialForm` and `WebViewBrokerAuthFlow` don't have `reauthConfig` API | ❌ missing |
| Form-encoded space handling | Defensive decoding: replace `+` with space BEFORE decodeURIComponent (lines 187-189) | SDK widget relies on standard `URLSearchParams`, may not handle Upstox's `+` encoding | ⚠️ missing |

### Gap fix plan

**Gap 1: Reauth pre-fill missing**
- **File:line to fix:**
  1. `brokerFormSchema.ts` — add optional `reauthConfig?: {authUrl, apiKey, secretKey}` field to `BrokerFormSchema` interface.
  2. SDK's `BrokerCredentialForm` — accept `reauthConfig` prop, pre-fill fields, auto-skip to oauth phase.
  3. Phase3SdkBrokerModal.js — detect `reauthConfig` (if passed by caller) and inject into `BrokerCredentialForm` props.
- **Dependencies:** SDK package version bump.

**Gap 2: IP_WHITELIST_BROKERS missing Upstox**
- **File:line to fix:** `Phase3SdkBrokerModal.js` lines 83-89.
- **Exact change required:** Add `'Upstox'` to the set.

**Gap 3: Defensive URL error parsing missing**
- **File:line to fix:** SDK's `WebViewBrokerAuthFlow` or the backend `/sdk/v1/connections/Upstox/login-url` handler.
- **Exact change required:** Backend should return the OAuth URL inside a JSON response, not raw URL string. If an error is detected, return `{ok: false, error_code, error_message}` instead of an error URL.

**Gap 4: Form-encoded space decoding**
- **File:line to fix:** SDK's `WebViewBrokerAuthFlow` query-param parsing.

**Gap 5: Model portfolio refresh missing**
- **File:line to fix:** Phase3SdkBrokerModal.js line 160-170 (onSuccess callback). After `fetchBrokerStatusModal()`, also POST `ccxt/rebalance/change_broker_model_pf`.

### Verdict

**SDK-with-gap** — The core OAuth + credential encryption flow is SDK-compatible. However, three touchpoints regress:
1. **Reauth pre-fill**: Legacy skips form and jumps to WebView. SDK forces re-entry of apiKey + secretKey.
2. **Defensive error parsing**: Legacy parses Upstox's error URLs inline. SDK relies on backend.
3. **IP-whitelist gate**: Upstox needs to be added to `IP_WHITELIST_BROKERS`.

None of these gaps are blockers. Upstox CAN move to SDK once: Reauth pre-fill API is added (Phase 3.2 scope), backend `/login-url` handlers return JSON errors, and IP_WHITELIST_BROKERS is updated. Closest-to-ready broker after HDFC.

---

## 4. ICICI Direct

### Legacy flow (production path)

**Entry points:** `icicimodal.js` component (ICICIUPModal) dispatched by ModalManager / BrokerConnectModalDispatch (case `'ICICI'`); inline form rendering.

**Form fields:** (from icicimodal.js lines 32-43)
- `apiKey` (state: apiKey, TextInput)
- `secretKey` (state: secretKey, TextInput with visibility toggle)
- No MPIN, no TOTP, no UCC—only the two OAuth-precursor keys

**Step-by-step flow:**

1. **Entry (icicimodal.js:21-27):** `ICICIUPModal` receives `isVisible`, `reauthConfig`, `fetchBrokerStatusModal`. Bound to ModalManager via `setShowICICIUPModal`.
2. **User details fetch (icicimodal.js:58-76):** axios GET `/api/user/getUser/{userEmail}` with headers `X-Advisor-Subdomain` + `aq-encrypted-key` (generateToken). Sets `userDetails` state.
3. **EgressIP gate (icicimodal.js:264-265, 348-353):** Renders `<EgressIpCallout broker="icicidirect" customerId={userDetails._id} customerEmail={userEmail} onAcknowledgeChange={setEgressReady} ... />`. Gate: `egressReady` must be true to proceed (EgressIpCallout.js:65-75 WHITELIST_BROKERS includes `icicidirect`).
4. **Smart-reauth hydration (icicimodal.js:97-106):** If `reauthConfig` has `authUrl` + `apiKey`, skip form, jump to WebView with `setShowWebView(true)` + pre-filled creds.
5. **Form validation (icicimodal.js:267-305):** User enters apiKey + secretKey. On "Initiate Auth" (initiateAuth fn):
   - Check `egressReady === true`; if not, set `unmetAck = true` (flashes checkbox red in EgressIpCallout, line 146).
   - Validate both fields present (line 272-275).
   - Encrypt both via `checkValidApiAnSecret()` using CryptoJS.AES.encrypt with passphrase `'ApiKeySecret'` (line 279-280, mirror of line 257-260).
   - PUT `/api/icici/update-key` with encrypted body `{ uid, apiKey, secretKey }` (line 284-293).
6. **Broker auth redirect (icicimodal.js:295-299):** On 200 response, construct browser URL `https://api.icicidirect.com/apiuser/login?api_key={apiKey}`, open in WebView (`setAuthUrl`, `setShowWebView(true)`).
7. **ICICI callback interception (icicimodal.js:168-255):** WebView navigates to ICICI's callback. OnNavigationStateChange listener:
   - Detect `?apisession=` in URL (line 174).
   - Extract token: `match[1]` via regex (line 175).
   - Set `hasProcessedCallback = true` guard (line 178), close WebView (line 179).
   - POST to ccxt `/icici/customer-details` with `{ user_email, apiKey, accessToken: apiSession }` (line 186-199). Validates `userDetails._id` exists (line 181-184).
8. **Session exchange (icicimodal.js:200-212):** ccxt responds with `Success.session_token` (line 201). Extract to `sessionToken`.
   - Build `iciciBrokerData` struct (line 206-212): `{ uid, user_broker: 'ICICI Direct', jwtToken: sessionToken, apiKey (decrypted), secretKey (decrypted) }`.
   - SDK dual-write guard (line 214-220): if `sdkBridge.enabled && sdkBridge.ready`, call `sdkDualWriteSafely(sdkConnectBroker(sdkBridge.client, 'ICICI Direct', iciciBrokerData), 'ICICI Direct', 'connect')`.
9. **Broker persistence (icicimodal.js:221-231):** PUT `/api/user/connect-broker` with encrypted body `iciciBrokerData` (line 222-229). Waits for 200.
10. **Post-success cleanup (icicimodal.js:112-153):** `finalizeConnection()`:
    - Non-critical: POST to ccxt `/rebalance/change_broker_model_pf` with `{ user_email, user_broker: 'ICICI Direct' }` (line 119-128). Swallows errors (line 129-131).
    - Close modal (line 133-134).
    - Wrap post-modal steps in try/catch so success toast doesn't suppress on error (line 139-152).
    - Emit `refreshEvent` (line 142).
    - Call `fetchBrokerStatusModal()` (line 141).
    - Show success toast if migration won't show (line 144).

**Encryption:** AES (line 257-260 checkValidApiAnSecret):
```javascript
const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');
return bytesKey.toString();
```
Passphrase `'ApiKeySecret'` (hardcoded). Result is base64; ccxt-india's `_maybe_decrypt_cryptojs()` (app_icici.py:77-101) detects prefix `U2FsdGVkX1` and decrypts on entry.

**Auth header construction (icicimodal.js:61-69, 195-198):**
```javascript
headers: {
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET,
  ),
}
```

**IP-whitelist gate:** EgressIpCallout (line 62-75 WHITELIST_BROKERS, line 107 BROKER_WHITELIST_HINT):
- WHITELIST_BROKERS includes `'icicidirect'` (line 73).
- BROKER_WHITELIST_HINT['icicidirect']: `'Breeze API app → IP Whitelist'` (line 107).
- Portal: `https://api.icicidirect.com/apiuser/home` (line 95 BROKER_DEV_PORTAL_URLS).
- Render flow: `unclaimed` state shows blue CTA button "Assign me a dedicated static IP"; `claimed` state shows amber panel with IP address + step-by-step whitelist instructions + checkbox "I have added X.X.X.X to my ICICI Direct developer portal whitelist...". Only checkbox tick unlocks parent Connect button via `onAcknowledgeChange(true)`.

**Reauth handling:** Yes — accepts `reauthConfig` object (line 27). If `isVisible && reauthConfig.authUrl && reauthConfig.apiKey`, populate form fields and skip to WebView (line 98-106). Mirrors web reauth flow.

**Help content (ICICIHelpContent.js:1-96):**
- YouTube ID: `XFLjL8hOctI` (line 27).
- Step count: 3 steps (line 49).
- Step 1 (line 32-36): "Visit https://api.icicidirect.com/apiuser/home and log in using your username and password. Verify your identity with the OTP and submit."
- Step 2 (line 37-42): "Click on the 'Register an App' tab, fill in the 'App Name' field with '{AppName}', paste your dedicated static IP into the Breeze 'IP Whitelist' field, enter the 'Redirect URL' as {iciciCallbackUrl}, and click 'Submit'."
- Step 3 (expanded, line 48-50): "Navigate to the 'View Apps' tab and copy your API and Secret Key—enter these details on the screen."
- Callback URL (line 14): `${server.ccxtServer.baseUrl}icici/auth-callback/${advisorSubdomain}`.

**Broker-specific quirks:**
- **OAuth-precursor form:** Unlike Kotak/Groww, ICICI does NOT validate credentials in the form step—it only stores them temporarily, then kicks off OAuth via ICICI's redirected login URL.
- **WebView callback detection:** Client-side regex parse of `?apisession=` (icicimodal.js:174). ICICI redirects the OAuth flow back to a registered callback URL; Alphab2bapp must intercept the param and extract the token manually.
- **Session token lifecycle:** The session_token returned by ccxt is a long-lived JWT (stored in connected_brokers[].jwtToken). Reauth can re-use stored apiKey + secretKey without re-prompting the user if the token expires.
- **Model portfolio sync (non-critical):** POST to `/rebalance/change_broker_model_pf` after connection succeeds. Failures are swallowed.

**Backend Node routes (aq_backend_github):**
- POST `/sdk/v1/connections/ICICI Direct/exchange-token` (`Routes/sdk/v1/connections.js:1180-1205`)
- PUT `/api/icici/update-key` (legacy path, called by icicimodal.js:284)
- PUT `/sdk/v1/connections/ICICI Direct/update-credentials` (`Routes/sdk/v1/connections.js:1278-1373`): proxies to `/api/icici/update-key`

**ccxt-india routes (app_icici.py):**
- `POST /icici/customer-details` (line 158-168): accepts `{ user_email, apiKey, accessToken }`. Calls `get_customer_details()`. Returns `{ Success: {..., session_token} }` on success.
- `PUT /api/icici/update-key`: stores encrypted apiKey + secretKey temporarily for the OAuth flow pre-stage.
- `GET /icici/auth-callback/<subdomain>` (line 545-581): redirects the browser back to the frontend with the apisession param still in URL.

### SDK flow (Phase 3)

**Schema row (brokerFormSchema.ts:181-187):**
```typescript
"ICICI Direct": {
  broker: "ICICI Direct",
  flow: "oauth",
  intro: "Connect via ICICI Direct Breeze API.",
  prerequisites: ["Breeze app credentials from api.icicidirect.com"],
  fields: [FIELD_API_KEY, FIELD_API_SECRET],
},
```

**Phase3SdkBrokerModal handling:** ICICI Direct flow="oauth" → `<WebViewBrokerAuthFlow />` widget. Sequence: form collects apiKey + secretKey → submit to `/sdk/v1/connections/ICICI Direct/update-credentials` → backend proxies to `/api/icici/update-key` → returns login URL → mobile opens WebView → after ICICI redirects with `?apisession=`, SDK widget extracts and calls `/sdk/v1/connections/ICICI Direct/exchange-token` with `{ apiKey, apisession }` → backend exchanges via ccxt → returns `{ ok: true, broker, is_primary, connected_at, token_expire }`.

**Backend SDK route dispatch (connections.js:1180-1205):**
POST `/sdk/v1/connections/ICICI Direct/exchange-token`:
- Receives `{ apiKey, apisession }` (or `accessToken`).
- Calls ccxt POST `/icici/customer-details` with `{ apiKey, accessToken: apisession }`.
- Extracts `Success.session_token`.
- Returns `{ jwtToken: sessionToken, apiKey }`.
- Route then calls `_selfCallLegacy()` PUT `/api/user/connect-broker` to persist (line 1225-1235).

**ccxt-india proxy target:** `/icici/customer-details` (app_icici.py:158-168).

### Touchpoint comparison table

| Touchpoint | Legacy Flow | SDK Flow | Status | Notes |
|---|---|---|---|---|
| Form entry | Modal dispatch (ModalManager) | BrokerCredentialForm widget | ✅ | Both converge on apiKey + secretKey form |
| Field collection | 2 fields (apiKey, secretKey) | 2 fields (apiKey, secretKey) | ✅ | Identical shape |
| Encryption | AES-256 "ApiKeySecret" passphrase (client) | AES-256 "ApiKeySecret" passphrase (SDK caller) | ✅ | Same envelope |
| IP whitelist gate | EgressIpCallout component + checkbox ack | Phase3SdkBrokerModal includes ICICI in IP_WHITELIST_BROKERS | ✅ | Both gate |
| Auth redirect | manual WebView interception in modal | SDK widget's native code + WebView callback handler | ✅ | Both intercept ?apisession param |
| Session exchange | client-side POST to ccxt /customer-details | SDK route POST to ccxt /customer-details | ✅ | Identical ccxt endpoint |
| Persistence | PUT /api/user/connect-broker via modal | PUT /api/user/connect-broker via SDK route | ✅ | Identical persistence |
| Post-success model portfolio | POST /rebalance/change_broker_model_pf (non-critical) | Not in SDK scope (caller responsibility) | ⚠️ | SDK does not sync model portfolio; legacy modal does it automatically |
| Reauth support | reauthConfig object + pre-filled form + WebView | SDK getReauthUrl() endpoint (connections.js:1383-1423) | ⚠️ | Both support reauth, different surfaces; SDK BrokerCredentialForm has no reauthConfig pre-fill prop |
| Help content | YouTube + step-by-step in help modal | Phase3BrokerHelp imports ICICIHelpContent | ✅ | Help content reused |
| Callback URL registration | ICICIHelpContent step 2 instructs manual entry | SDK default: `https://{advisor}.alphaquark.in/stock-recommendation` | ✅ | Both instruct to whitelist the same URL path |
| Error handling | Granular alerts for session fail, network fail | Generic 502 on exchange failure | ⚠️ | SDK surface is thinner |
| Primary broker promotion | Automatic on successful connection | Automatic via _updatePrimaryBroker() (line 1245) | ✅ | Both promote ICICI Direct to primary |
| Token expiry tracking | Implicit in jwtToken (no explicit expiry) | token_expire in response (line 832-834) | ✅ | SDK surfaces explicit expiry; legacy doesn't expose it |

### Gap fix plan

| Gap | File:Line | Fix | Dependencies |
|---|---|---|---|
| Reauth pre-fill missing in form | brokerFormSchema.ts (BrokerFormSchema interface) | Add `reauthConfig?: {authUrl, apiKey, secretKey}` field; SDK widget consumes it. | SDK package version bump |
| Model portfolio sync | connections.js exchange-token completion | After successful exchange, post `/rebalance/change_broker_model_pf`. | Backend deploy |
| Help content YouTube embedded | brokerFormSchema.ts | Add `helpYoutubeId`, `helpSteps` fields. | Type extension |

### Verdict

**SDK-with-gap** — ICICI Direct OAuth flow is fully implemented in the SDK routes (exchange-token at line 1180-1205, update-credentials via proxy at line 1278-1373). The IP-callout content delivered by the SDK widget may be thinner than the legacy step-by-step (which references `Breeze IP Whitelist` field by exact name). Reauth pre-fill is missing in the SDK widget (legacy hydrates and skips form). Model portfolio sync is missing. Promote to SDK-clean once these three are addressed AND emulator end-to-end is verified.

---

## 5. Kotak Securities

### Legacy flow (production path)

**Entry points:** `KotakModal` component (KotakModal.js:20-416) dispatched by ModalManager / BrokerConnectModalDispatch (case `'Kotak'`); inline form rendering.

**Form fields:** (from KotakModal.js lines 36-43)
- `apiKey` (Consumer Key from NEO app)
- `mobileNumber` (10 digits, normalized from +91XXXXXXXXXX)
- `ucc` (Unique Client Code)
- `mpin` (6 digits)
- `totp` (6 digits, one-time code from authenticator)

**Step-by-step flow:**

1. **Entry (KotakModal.js:20-27):** `KotakModal` receives `isVisible`, `fetchBrokerStatusModal`, `setShowBrokerModal`, `setShowKotakModal`.
2. **User details fetch (KotakModal.js:54-73):** axios GET `/api/user/getUser/{userEmail}`. On success, set `userDetails`.
3. **Mobile number pre-fill (KotakModal.js:80-93):** If reconnect, pre-populate `mobileNumber` from `connected_brokers[].mobileNumber` or fallback `phone_number` field. Strip `+91` prefix to leave 10 digits.
4. **EgressIP gate (KotakModal.js:108-109, 406-411):** Renders `<EgressIpCallout broker="kotak" customerId={userId} customerEmail={userEmail} onAcknowledgeChange={setEgressReady} ... />`. Gate identical to ICICI: `egressReady` must be true.
5. **TOTP 30s cooldown (KotakModal.js:126-127):** `_KOTAK_CONNECT_COOLDOWN_MS = 30 * 1000`. Kotak TOTP rotates every 30s; consecutive submits within window either reuse stale code (broker rejects) or race-condition the DB write. Single-flight guard + cooldown prevent "Incorrect credentials" false-negative on the second attempt (line 134-151).
6. **Form validation (KotakModal.js:129-196):** User enters 5 fields. On "Connect" button (updateKotakSecretKey fn):
   - Check `egressReady === true`; if not, set `unmetAck = true` to flash the checkbox.
   - Mobile number normalization (line 164-182): strip non-digits, strip `+91` or `0` prefix if remainder is 10 digits, validate `^\d{10}$`.
   - Validate MPIN `^\d{6}$` (line 184-189).
   - Validate TOTP `^\d{6}$` (line 191-196).
   - Build body (line 198-205): `{ uid, apiKey (encrypted), mobileNumber (with +91 re-added), mpin, ucc, totp }`.
7. **Broker connection (KotakModal.js:207-219):** PUT `/api/kotak/connect-broker` with encrypted body.
8. **SDK dual-write (KotakModal.js:236-242):** If `sdkBridge.enabled && sdkBridge.ready`, call `sdkDualWriteSafely(sdkConnectBroker(sdkBridge.client, 'Kotak', data), 'Kotak', 'connect')`.
9. **Model portfolio update (KotakModal.js:250-278):** POST `/rebalance/change_broker_model_pf` with `{ user_email, user_broker: 'Kotak Neo' }`.
10. **Post-success modal close and state refresh (KotakModal.js:280-316):** Close Kotak modal first (line 289), then broker modal (line 290). Wrap post-success steps in try/catch.
11. **Error handling (KotakModal.js:318-365):** TOTP-specific failure detection (line 333-337): keywords `otp`, `totp`, `two factor`. Surface "TOTP Rejected" + hint to regenerate (line 350-353).

**Encryption:** AES (line 45-51 checkValidApiAnSecret) — same passphrase `'ApiKeySecret'` as ICICI.

**Auth header construction:** Same as ICICI/Upstox.

**IP-whitelist gate:** EgressIpCallout includes `'kotak'` in WHITELIST_BROKERS. Hint "Consumer Key settings → IP Whitelist". Portal: `https://npapi.kotaksecurities.com/`.

**Reauth handling:** NO — `KotakModal.js` does not accept a `reauthConfig` prop. Unlike ICICI, Kotak has no reauth pre-fill. By design — Kotak TOTP is single-use per 30s window; storing old TOTPs is worthless.

**Help content (KotakHelpContent.js:1-165):**
- YouTube ID: `JXwnwaxM88k` (line 22).
- Step count: 4 major steps.
- Step 1: Get Client ID from NEO account. Log in to Kotak NEO Trade API portal. Receive User ID + password + Neo Finkey via email in 30 min.
- Step 2: Log in to Kotak API Portal. Create application. Subscribe to all APIs. Generate keys → copy Consumer Key & Consumer Secret.
- Step 3: TOTP registration at `https://www.kotaksecurities.com/platform/kotak-neo-trade-api/totp-registration/`.
- Step 4: Input UCC + Consumer Key & Secret + MPIN. Need TOTP from authenticator at link time.

**Broker-specific quirks:**
- **NEO migration:** Kotak shifted from old OAuth + consumer_secret exchange to NEO Trade API app UUID model. The "apiKey" in the form is actually the Consumer Key from NEO app.
- **TOTP single-use + 30s rotation:** Unlike ICICI, Kotak TOTP is generated in the user's authenticator app and is one-time-use on the broker side. If the same TOTP is submitted twice within the same 30s window, the broker rejects it. This is why the 30s cooldown gate exists.
- **Mobile number normalization:** Kotak NEO requires a mobile number; users commonly paste various formats. The normalizer strips all non-digits, then conditionally strips "91" or "0" prefix only if the result is 10 digits.
- **Post-success modal stacking:** Close Kotak modal BEFORE broker modal (line 289-290) to prevent visual stacking.
- **Error message surface:** Kotak's broker API rejection reasons are often specific (`Invalid OTP`, `OTP expired`). The modal surfaces the raw message rather than a generic fallback.

**Backend Node routes:**
PUT `/api/kotak/connect-broker` (legacy route, slug 'kotak', path overridden at line 1328 because the old /update-key path is deprecated).
PUT `/sdk/v1/connections/Kotak/update-credentials` (line 1278-1373): proxies to `/api/kotak/connect-broker`.

**ccxt-india routes (app_kotak.py:1-564):**
- `POST /kotak/login/totp` (line 87-99): accepts `{ accessToken, mobileNumber, mpin, ucc, totp }`. Calls `get_final_session()`.
- Helper `get_kotak_credentials_with_fallback()` (line 25-63): resolves `apiAccessToken` (UUID from NEO app) + `accessToken` (trading token) + `sid` + `serverId`.

### SDK flow (Phase 3)

**Schema row (brokerFormSchema.ts:188-235):**
```typescript
Kotak: {
  broker: "Kotak",
  flow: "credentials_totp",
  intro: "Connect via Kotak Securities Neo TradeApi.",
  prerequisites: [
    "Kotak Neo TradeApi app credentials",
    "Account mobile number + MPIN",
  ],
  fields: [
    { ...FIELD_API_KEY, helper: "Neo TradeApi consumer key" },
    { name: "mobileNumber", label: "Mobile Number", helper: "Include country code, e.g. +919999999999", inputType: "tel", required: true, pattern: /^\+91\d{10}$/, patternError: "Use +91 followed by 10 digits" },
    { name: "mpin", label: "MPIN", secureEntry: true, required: true, inputType: "number", redactInLogs: true, encrypt: true },
    { name: "ucc", label: "UCC / Client ID", placeholder: "e.g. XL6HF", required: true },
    { name: "totp", label: "TOTP", helper: "6-digit code from Kotak Neo authenticator", inputType: "number", required: true, pattern: /^\d{6}$/, patternError: "TOTP must be 6 digits" },
  ],
},
```

**Phase3SdkBrokerModal handling:** flow="credentials_totp" → `<BrokerCredentialForm submitEndpoint="update-credentials" />`. The widget renders 5 form fields, validates patterns client-side, encrypts apiKey + mpin + totp, POSTs to `/sdk/v1/connections/Kotak/update-credentials`.

**Backend SDK route dispatch (connections.js:1278-1373):**
PUT `/sdk/v1/connections/Kotak/update-credentials`:
- Receives body `{ apiKey, mobileNumber, mpin, ucc, totp }`.
- Resolves uid via email lookup (line 1306-1310).
- Constructs legacyBody and calls `_selfCallLegacy()` PUT `/api/kotak/connect-broker` (line 1333-1338).
- Returns response from legacy route.

**ccxt-india proxy target:** `POST /kotak/login/totp` (app_kotak.py:87-99).

### Touchpoint comparison table

| Touchpoint | Legacy Flow | SDK Flow | Status | Notes |
|---|---|---|---|---|
| Form entry | Modal dispatch + local state | BrokerCredentialForm widget | ✅ | Both render 5 fields |
| Mobile number format | Accept +91XXXXXXXXXX, strip +91 in input, re-add +91 on submit | Schema pattern /^\+91\d{10}$/ enforced strict; backend may re-normalize | ⚠️ | Legacy normalizes aggressively; SDK schema is strict |
| Encryption | AES "ApiKeySecret" for apiKey + mpin | AES "ApiKeySecret" for apiKey + mpin (SDK caller side) | ✅ | Same passphrase, same envelope |
| TOTP validation | 6 digits, pattern /^\d{6}$/ | 6 digits, pattern /^\d{6}$/ | ✅ | Identical |
| TOTP cooldown | 30s debounce gate in modal (line 126-127, 140-151) | No cooldown gate in SDK route | ❌ | Legacy enforces 30s debounce; SDK does NOT |
| IP whitelist gate | EgressIpCallout component + checkbox ack | Phase3SdkBrokerModal includes Kotak in IP_WHITELIST_BROKERS | ✅ | Both gate |
| Broker connection | PUT /api/kotak/connect-broker via modal | PUT /api/kotak/connect-broker via SDK route | ✅ | Identical backend endpoint |
| Post-success model portfolio | POST /rebalance/change_broker_model_pf (non-critical) | Not in SDK scope | ⚠️ | Missing |
| Reauth support | NO (by design — TOTP single-use) | SDK provides GET /reauth-url (connections.js:1383-1423) | ✅ | SDK route exposes reauth-url, but caller must still get fresh TOTP |
| Help content | YouTube + 4-step guide | Phase3BrokerHelp imports KotakHelpContent | ✅ | Reused |
| Error handling | Granular TOTP-specific alerts (line 350-353), raw broker message surface | Generic "broker_credential_update_failed" in SDK route | ⚠️ | Legacy surfaces TOTP rejection with regeneration hint; SDK surfaces raw upstream error |
| Primary broker promotion | Automatic on success (implicit) | Automatic via _updatePrimaryBroker() | ✅ | Both promote |

### Gap fix plan

| Gap | File:Line | Fix | Dependencies |
|---|---|---|---|
| **CRITICAL: TOTP 30s cooldown missing in SDK** | connections.js:1278-1373 (PUT /update-credentials) | Add client-side 30s debounce in SDK widget OR add server-side throttle. Recommend client-side. Host app should implement: `lastSubmit` timestamp, check on submit, show alert + prevent re-submit if < 30s. | SDK widget dependency |
| **TOTP-specific error surfacing** | connections.js:1341-1344 | Parse upstream error message for TOTP keywords (`otp`, `totp`, `expired`, `used`). If detected, return `{ error: "totp_rejected", detail: rawMessage, suggest_regenerate: true }`. | Minimal backend change |
| **Mobile number format strictness** | brokerFormSchema.ts:207-208 | Backend normalizes mobileNumber same as legacy before forwarding to ccxt. ~5 lines. | Backend normalization in connections.js /update-credentials |
| **Help content embedded** | brokerFormSchema.ts:1-24 | Add optional `helpYoutubeId`, `helpSteps` fields. Kotak: `helpYoutubeId: "JXwnwaxM88k"`. | Type extension |

### Verdict

**SDK-with-gap.** Kotak flow="credentials_totp" is wired end-to-end (schema line 188-235, /update-credentials route at 1278-1373, ccxt POST /kotak/login/totp). TWO critical gaps prevent production readiness: (1) **TOTP 30s cooldown missing** — legacy modal enforces 30s debounce to prevent rate-limiting and false "Incorrect credentials" alerts when the same TOTP is resubmitted; SDK route has NO debounce. (2) **TOTP-specific error not surfaced** — when the broker rejects a TOTP, ccxt returns a specific error message; SDK route only returns generic "broker_credential_update_failed". Mobile number format strictness is a minor follow-up. Recommendation: Fix #1 (cooldown) and #2 (TOTP error) before Phase 3 production launch.

---

## 6. Dhan

### Legacy flow (production path)

**Entry points:** `BrokerConnectionModal/DhanConnectModal.js:22-27`; `BrokerConnectModalDispatch` case `'Dhan'`. Modal also rendered via inline `<BrokerConnectModalDispatch brokerName="Dhan" />` from StockAdvices/RebalanceAdvices (post-2026-04-28 bypass fix).

**Form fields (credential fallback):**
- **Client ID** (`cliendId` state) — text input, required (DhanConnectUI.js:148, typo preserved in codebase)
- **Access Token** (`accessToken` state) — password input with toggle visibility (DhanConnectUI.js:160+)
- Both encrypted with `CryptoJS.AES.encrypt(value, 'ApiKeySecret')` before DB persist
- Validation: empty-check only

**Step-by-step flow:**

1. **Modal opens** (DhanConnectModal.js:22-86): `oauthMode=true` by default; sets `prefetchedAuthUrl=null`
2. **Prefetch consent ID** (lines 101-127): parallel fetch to `${server.ccxtServer.baseUrl}dhan/login` with `fetch({redirect:'follow'})`, capturing final URL post-302-chain to skip hops
3. **WebView renders** (DhanConnectModal.js:278-288): DhanOAuthUI component with auth URL (prefetched or fallback ccxt URL)
4. **WebView initializes** (DhanOAuthUI.js:75-102): mounts React Native WebView, sets custom User-Agent (`Mozilla/5.0 … Chrome/123.0.0.0 Mobile`), enables JavaScript + DOM storage + third-party cookies, `cacheEnabled=false`, `originWhitelist=['*']`
5. **Loading overlay** (DhanOAuthUI.js:36-38, 103-108): Shows until `progress >= 0.3`, uses `onLoadProgress` callback; latch `loadedOnce` prevents re-flash on internal page navigation
6. **User logs in on Dhan** (external flow): enters PIN + SMS OTP on `partner-login.dhan.co` (provided by CCXT partner consent mint)
7. **Dhan redirects** → `ccxt_server/dhan/callback?tokenId=...`
8. **CCXT exchanges token** (ccxt-india `apps/app_dhan.py /dhan/callback`): consumes tokenId, retrieves `dhan_client_id` + `dhan_access_token` from Dhan API
9. **CCXT redirects back** → `prod.alphaquark.in/stock-recommendation?dhan_client_id=...&dhan_access_token=...`
10. **WebView navigation handler** (DhanConnectModal.js:132-157): `handleWebViewNavigationStateChange()` detects redirect URL match
11. **Query param extraction** (lines 136-150): splits URL on `?`, parses key=value pairs with `decodeURIComponent`, extracts `dhan_client_id` and `dhan_access_token`
12. **Callback guard** (line 153): `hasProcessedCallback.current` prevents re-entry
13. **Save broker connection** (DhanConnectModal.js:160-180): calls `saveBrokerConnection(clientId, accessToken)`, which wraps in user-lookup retry if `userId` not yet hydrated
14. **HTTP PUT /api/user/connect-broker** (lines 191-196): payload `{ uid, user_broker: 'Dhan', clientCode: clientId, jwtToken: accessToken }` with headers from `getHeaders()` (lines 52-60)
15. **Header construction** (lines 52-60):
    - `'Content-Type': 'application/json'`
    - `'X-Advisor-Subdomain'`: from `configData?.config?.REACT_APP_HEADER_NAME` or `getAdvisorSubdomain()`
    - `'aq-encrypted-key'`: `generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)` (SecurityTokenManager.js pattern)
16. **Model portfolio update** (lines 209-219): non-critical `POST /rebalance/change_broker_model_pf` with `{ user_email, user_broker: 'Dhan' }`
17. **Post-success hygiene** (lines 224-244): wrapped in try/catch; calls `fetchBrokerStatusModal()` → `refreshEvent` emit → success alert only if no migration modal
18. **Modal close** (lines 222-223): `setShowBrokerModal(false)` + `onClose()`
19. **Error handling** (lines 245-265): axios `.catch` distinguishes `error.response` (HTTP error → "Incorrect credentials") vs network/JS error (→ "Connection Issue — credentials may already be saved")
20. **Fallback credential form**: user taps "Enter Access Token manually instead" (DhanOAuthUI.js:111-116) → `onSwitchToManual()` → `setOauthMode(false)` → DhanConnectUI renders credential form
21. **Credential form submit** (DhanConnectModal.js:269-275): `handleSubmit()` validates non-empty, calls same `saveBrokerConnection(clientId, accessToken)` path as OAuth

**Encryption:** AES with key `'ApiKeySecret'` applied at modal form level before axios POST.

**Auth header construction:** quote from DhanConnectModal.js:52-60:
```javascript
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain':
    configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(
    Config.REACT_APP_AQ_KEYS,
    Config.REACT_APP_AQ_SECRET,
  ),
});
```

**IP-whitelist gate:** Dhan is a **partner broker** (EgressIpCallout.js:65-75 WHITELIST_BROKERS set does NOT include 'dhan'); EgressIpCallout returns early with `setState('partner')`, so no IP gate appears. CCXT partner IP is pre-whitelisted by Dhan.

**Reauth handling:** No `reauthConfig` prop accepted (Dhan uses CCXT partner OAuth, no per-user secret to pre-fill).

**Help content** (DhanHelpContent.js:1-97):
- YouTube ID: `MhAfqNQKSrQ` (line 22)
- Step count: 5 steps (lines 25-51)
- Critical string (line 34): "Click on your profile picture and choose 'My Profile on Dhan'. Under the Profile details, you'll find the 'Client ID'."
- Critical string (lines 47-48): "To generate an access token, click on '+ New Token,' enter a name for your app, set the validity to 30 days, and click 'Generate Token.'"
- Step 1 → https://login.dhan.co
- Step 3 → "Dhan HQ Trading APIs" menu
- Step 4 → "+ New Token" → 30-day validity
- Step 5 → paste access token

**Broker-specific quirks:**
- **Typo in state var**: `cliendId` (not `clientId`) preserved across DhanConnectModal, DhanConnectUI, DhanOAuthUI since early commits
- **Partner OAuth via CCXT**: no per-user API key form; CCXT holds platform PARTNER_ID `"9ae1131d"` server-side
- **Prefetch optimization**: consentID pre-fetched while modal mounts (lines 101-127) to skip 302 hop chain (~200ms saved)
- **Fallback form**: OAuth-primary but credential form available for users with standing tokens
- **Loading overlay**: partial-page render at 30% progress instead of blank screen (DhanOAuthUI.js:36-38)
- **No TOTP**: session token valid 30 days (unlike Zerodha/Fyers/ICICI 1-day)
- **Custom User-Agent**: spoofs Chrome/Safari to avoid broker-side bot detection (DhanOAuthUI.js:97-101)
- **Shared cookies + third-party cookies**: `sharedCookiesEnabled={true}` + `thirdPartyCookiesEnabled={true}` (line 91-92) required for Dhan's partner flow

**Backend Node routes:**
- `PUT /api/user/connect-broker` (line 193): legacy broker-connect endpoint, handles Dhan payload
- `POST /rebalance/change_broker_model_pf` (line 213): portfolio rebalance to new broker

**ccxt-india routes:**
- `GET /dhan/login` (line 91): mints consent, redirects to auth.dhan.co
- `GET /dhan/callback?tokenId=...` (implicit, handled by ccxt): exchanges tokenId for client_id + access_token, redirects to app redirect URL

### SDK flow (Phase 3)

**Schema row** from `@alphaquark/mobile-sdk` brokerFormSchema.ts:
```
{
  broker: 'Dhan',
  flow: 'oauth',
  fields: [],  // empty — no per-user apiKey/secretKey form
  ...
}
```
The SDK expects Dhan to follow OAuth path with no credential fields. Form auto-skips to `onContinueToOauth` with empty body.

**Phase3SdkBrokerModal handling:**
- IP-whitelist gate: Dhan NOT in `IP_WHITELIST_BROKERS` (lines 83-89), so `egressReady` starts true (line 155)
- Render `BrokerCredentialForm` with SDK schema — form auto-succeeds with no fields
- `onContinueToOauth` fires immediately → hands off to `WebViewBrokerAuthFlow`
- `WebViewBrokerAuthFlow` internally:
  - POST `/sdk/v1/connections/Dhan/login-url` with empty body → backend returns `{ authUrl }`
  - Opens WebView at authUrl
  - Captures redirect-URL match on `REACT_APP_BROKER_CONNECT_REDIRECT_URL`
  - POST `/sdk/v1/connections/Dhan/exchange-token` with captured params + extraExchangeBody

**Backend SDK route:**
- `/sdk/v1/connections/Dhan/login-url` (POST): dispatches to ccxt `/dhan/login`, returns `{ authUrl }`
- `/sdk/v1/connections/Dhan/exchange-token` (POST): dispatches to ccxt `/dhan/callback`, mints session

**ccxt-india proxy target:** Same routes as legacy.

### Touchpoint comparison table

| Component | Legacy (DhanConnectModal) | SDK (Phase3SdkBrokerModal) | Status |
|-----------|--------------------------|---------------------------|--------|
| **Entry** | ModalManager dispatches 'Dhan' | BrokerConnectModalDispatch dispatches 'Dhan' when REACT_APP_USE_SDK_BROKER_FLOW=true | ✅ |
| **Form schema** | Hard-coded DhanConnectUI (OAuth then credential) | SDK brokerFormSchema.ts (OAuth, empty fields) | ✅ |
| **OAuth flow** | Client captures redirect, parses query params | SDK WebViewBrokerAuthFlow captures + exchanges | ✅ |
| **Login URL source** | Hard-coded CCXT `/dhan/login` | Backend `/sdk/v1/connections/Dhan/login-url` → CCXT | ✅ |
| **Token exchange** | Client → `handleWebViewNavigationStateChange` | SDK POST `/sdk/v1/connections/Dhan/exchange-token` | ✅ |
| **Credential storage** | `PUT /api/user/connect-broker` (legacy endpoint) | SDK client auto-persists via `/exchange-token` response | ✅ |
| **Post-success callback** | `fetchBrokerStatusModal()` in try/catch | `fetchBrokerStatusModal()` in try/catch (line 162) | ✅ |
| **Error handling** | Axios `.catch` with HTTP vs network branch | SDK `onError` with `error.code` / `error.detail` | ⚠️ |
| **Reauth hydration** | Not yet implemented (infrastructure ready) | Not yet implemented (SDK form reauth pattern TBD) | ⚠️ |
| **IP whitelist** | Partner broker, skipped | Not in IP_WHITELIST_BROKERS, skipped | ✅ |
| **Encryption** | CryptoJS.AES (credential form only) | SDK handles encryption server-side per broker schema | ✅ |
| **User-Agent spoofing** | DhanOAuthUI.js:97-101 custom UA string | SDK WebViewBrokerAuthFlow may/may not apply (TBD) | ⚠️ |
| **Loading overlay** | Progress-driven at 30% (DhanOAuthUI.js) | SDK WebViewBrokerAuthFlow manages (TBD) | ⚠️ |
| **Help content** | DhanHelpContent.js YouTube + 5 steps | Phase3BrokerHelp.js renders DhanHelpContent | ✅ |
| **Manual fallback path** | Switch to credential form if OAuth fails (DhanOAuthUI line 111-116) | Not present in SDK flow (form is empty) | ❌ |

### Gap fix plan

**Error handling branch (⚠️)**
- **File:line**: Phase3SdkBrokerModal.js:172-185 (`onError`)
- **Issue**: Legacy `.catch` distinguishes HTTP vs network. SDK `onError` receives `SdkError` with `code`, `httpStatus`, `detail`. Mobile needs to branch on `httpStatus`.
- **Exact change**: Check `sdkError?.httpStatus >= 400` to distinguish auth failure from transient network error.
- **Dependencies**: SdkError contract must include `httpStatus` field.

**Reauth hydration (⚠️)**
- **File:line**: Phase3SdkBrokerModal.js (no reauthConfig prop yet)
- **Exact change**: Add `reauthConfig` prop to Phase3SdkBrokerModal signature and pre-set `oauthExtraBody` to skip form when present.

**User-Agent spoofing (⚠️)**
- **File:line**: SDK WebViewBrokerAuthFlow component
- **Exact change**: Verify SDK exposes a `userAgent` prop. If not, file SDK enhancement request.

**Manual fallback path (❌)**
- **File:line**: brokerFormSchema.ts (Dhan row) + SDK widget composite flow
- **Exact change**: SDK widget should support `flow=oauth-with-credentials-fallback` shape OR ship a "Try manual entry instead" link in the SDK widget that switches to a credential-only form.

### Verdict

**SDK-with-gap** — Dhan OAuth flow is architecturally clean and aligns with SDK design (empty credential form auto-skips to WebView, matching web's CCXT partner OAuth). SDK `/dhan/login` → `/dhan/exchange-token` routes exist and proxy to same ccxt endpoints as legacy. **Four refinements needed before production parity:** (1) error-handling branch, (2) reauth hydration, (3) custom User-Agent spoofing, (4) manual fallback path. None are architectural blockers.

---

## 7. Fyers

### 2026-09-29 host biometric/TOTP boundary

When the tenant enables device TOTP, dispatch stays in the host
`DeviceTotpReconnectGate`; it does not enter `Phase3SdkBrokerModal`. A refreshed
server document is classified into `requiresOAuth` versus reusable quick
reconnect using slot status and server credential completeness. Fresh OAuth
posts only `{uid, authCode}` to Node `/api/fyers/exchange-token`; Node resolves
the stored App ID/Secret and calls ccxt. The existing SDK contract and its
optional post-save dual-write are unchanged.

Disconnect is confirmed by a second server read before the host clears local
vaults. Fyers WebView navigation is never URL-logged, malformed query segments
are ignored, and safe Crashlytics breadcrumbs record only phase/branch/status
metadata.

### Legacy flow (production path)

**Entry points:** `BrokerConnectionModal/FyersConnect.js:24-31` (component definition); `BrokerConnectModalDispatch` case `'Fyers'`. Modal rendered from Settings/Manage Connections or mid-trade TokenExpire modal.

**Form fields:**
- **API Key** (`apiKey` state, line 35) — **CRITICAL NAMING INVERSION**: modal `apiKey` = OAuth secret (stored DB-side as `credentials.secretKey`). Password input with toggle visibility (FyersConnectUI.js:44, label "API Key").
- **Secret Key** (`secretKey` state, line 36) — **CRITICAL NAMING INVERSION**: modal `secretKey` = clientId (stored DB-side as `credentials.clientCode`). Text input (FyersConnectUI.js:373, label "Secret Key").
- Both encrypted with `CryptoJS.AES.encrypt(value, 'ApiKeySecret')` via `checkValidApiAnSecret()` (line 279-283) before DB persist
- Validation: empty-check (line 120)

**Step-by-step flow:**

1. **Modal opens** (FyersConnect.js:24-31): `showWebView=false`; displays credential form (FyersConnectUI.js:124-233)
2. **User enters credentials** (FyersConnectUI.js): types API Key (OAuth secret) + Secret Key (clientId)
3. **IP-whitelist gate** (FyersConnectUI.js:149-160, EgressIpCallout.js:65-75): Fyers in WHITELIST_BROKERS set. EgressIpCallout renders:
   - Fetch `GET /ccxtServer/egress/me?email=&customer_id=` (line 170)
   - If `status='unclaimed'`: blue "Assign me a static IP" button
   - If `status='claimed'`: amber panel with assigned IP + step-by-step whitelist instructions + acknowledgment checkbox
   - If `status='ipv4_provisioning'`: "Cannot connect — IPv4 being provisioned" (hard-blocks Connect)
4. **IP acknowledgment required** (FyersConnectUI.js:egressReady gate, line 388): Connect button disabled until `egressReady === true`
5. **User taps "Proceed"** (FyersConnectUI.js:381, `updateSecretKey()`): validates `egressReady`, then POST to `/api/fyers/update-key` (line 300)
6. **Backend validates credentials** (aq_backend_github `/api/fyers/update-key`)
7. **Backend returns auth URL** (FyersConnect.js:319, `response.data.response`): Fyers OAuth login URL
8. **WebView opens** (FyersConnectUI.js:95-103): `setShowWebView(true)`
9. **User logs in on Fyers** (external): enters phone number + TOTP + 4-digit PIN
10. **Fyers redirects** → app redirect URL with `auth_code=...` query param
11. **WebView navigation handler** (FyersConnect.js:100-116, `handleWebViewNavigationStateChange`): detects `url.includes('auth_code=')`
12. **Query param extraction** (lines 105-108): parses auth_code, extracts `authcode` (line 108)
13. **Auth code saved** (line 111): `setFyersAuthCode(authcode)` + `setShowWebView(false)`
14. **Token exchange trigger**: the idempotent effect fires once for `authCode + userId`
15. **Call connectFyers()**: POST to Node `/api/fyers/exchange-token`
16. **Exchange request payload**:
    ```javascript
    {
      uid: userId,
      authCode: fyersAuthCode
    }
    ```
17. **Node resolves server credentials, then ccxt-india processes**: App ID and Secret never return to the mobile exchange request
18. **Response captured** (line 145): `const session_token = response.data.accessToken`
19. **Access token saved** (line 147): `setFyersAccessToken(session_token)`
20. **Broker DB save trigger** (FyersConnect.js:268-272): `useEffect([userId, fyersAccessToken])`
21. **Call connectBrokerDbUpdate()** (lines 165-266): constructs broker data with field-name swap (modal apiKey → DB secretKey, modal secretKey → DB clientCode).
22. **Encryption** (line 279-283): `CryptoJS.AES.encrypt(apiKey, 'ApiKeySecret').toString()` wraps secret before DB store
23. **HTTP PUT /api/user/connect-broker** (lines 174-186)
24. **SDK dual-write** (lines 192-198): if `sdkBridge.enabled && ready`, fires `sdkConnectBroker(sdkBridge.client, 'Fyers', brokerData)` in background
25. **Model portfolio update** (lines 207-225): non-critical `POST /rebalance/change_broker_model_pf`
26. **Post-success hygiene** (lines 227-244): wrapped in try/catch
27. **Error handling** (lines 246-264): axios `.catch` distinguishes HTTP error vs network error

**Encryption:** CryptoJS.AES with key `'ApiKeySecret'` applied to modal `apiKey` before DB store (line 279-283).

**Auth header construction:** Same as ICICI/Upstox/Kotak.

**IP-whitelist gate:** Fyers IS in `EgressIpCallout.js` WHITELIST_BROKERS set. Step text: "Egress-IP gate (see EgressIpCallout). Fyers requires a dedicated static IP whitelisted in the user's Fyers API dashboard." Connect button blocked until `egressReady === true`.

**Reauth handling:** YES — FyersConnect.js:345-355 shows smart-reauth hydration pattern. Quote:
```javascript
// Smart-reauth hydration. Fyers swaps modal terminology vs. DB:
//   modal `apiKey` state  = OAuth secret (stored as credentials.secretKey)
//   modal `secretKey` state = clientId (stored as credentials.clientCode)
// reauthConfig follows DB naming — we translate here.
const reauthHydratedRef = useRef(false);
useEffect(() => {
  if (!isVisible || !reauthConfig || reauthHydratedRef.current) return;
  if (!reauthConfig.authUrl || !reauthConfig.secretKey || !reauthConfig.clientCode) {
    return;
  }
  reauthHydratedRef.current = true;
  setApiKey(reauthConfig.secretKey);   // OAuth secret
  setSecretKey(reauthConfig.clientCode); // clientId
  setAuthUrl(reauthConfig.authUrl);
  setShowWebView(true);
}, [isVisible, reauthConfig]);
```

**Help content** (FyersHelpContent.js:1-101):
- YouTube ID: `blhTiePBIg0` (line 22)
- Step count: 5 steps (lines 25-55)
- **Critical warning** (line 47):
  > "⚠️ You MUST tick the 'Order Placement' permission — without it Fyers rejects every basket order with 'algo orders are not allowed for this app'. The checkbox is OFF by default."
- Step 1 → https://fyers.in/web/api-dashboard/user-apps
- Step 2 → phone + TOTP + 4-digit PIN
- Step 3 → "Create App" button, paste redirect URL, **tick Order Placement permission**, accept T&C
- Step 4 → copy App ID + Secret ID
- Step 5 → **if already created app and seeing "algo orders are not allowed"**: go back to app settings → "Edit" → tick Order Placement → Save (no need to recreate)

**Broker-specific quirks:**
- **Naming inversion**: modal `apiKey` ↔ DB `secretKey`; modal `secretKey` ↔ DB `clientCode` (lines 346-355 swap on reauth; line 123-124 invert on token exchange)
- **IP whitelist mandatory**: Connect button hard-disabled until user claims IPv4 + acknowledges
- **Two-stage auth**: credential form → OAuth URL → PIN-entry WebView → token exchange → broker save (4 async steps)
- **Order Placement permission**: Fyers rejects orders if app created without this permission
- **TOTP on login**: Fyers sends 6-digit OTP during login (step 2 of help)
- **Redirect URL must match**: Fyers API dashboard must have redirect URL registered

**Backend Node routes:**
- `PUT /api/fyers/update-key` (line 300): pre-flight credentials, returns Fyers OAuth URL
- `POST /rebalance/change_broker_model_pf` (line 209): portfolio rebalance

**ccxt-india routes:**
- `POST /api/fyers/exchange-token`: host sends uid + auth_code; Node resolves the stored App ID/Secret and forwards the exchange to ccxt `/fyers/gen-access-token`

### SDK flow (Phase 3)

**Schema row** from brokerFormSchema.ts:
```
{
  broker: 'Fyers',
  flow: 'oauth',
  fields: [
    { name: 'apiKey', label: 'API Key (Secret)', type: 'password', required: true },
    { name: 'secretKey', label: 'Secret Key (Client ID)', type: 'text', required: true }
  ],
  ...
}
```
The SDK schema labels clarify the inversion (unlike the legacy modal which had confusing label names).

**Phase3SdkBrokerModal handling:**
- IP-whitelist gate: Fyers NOT explicitly in `IP_WHITELIST_BROKERS` (lines 83-89) **[KNOWN GAP]**, so `egressReady` starts true (line 155)
- Render `BrokerCredentialForm` with SDK schema fields (lines 233-253)
- User fills API Key + Secret Key; form calls `onContinueToOauth(extras)` (line 135) → sets `oauthExtraBody` to form values
- `WebViewBrokerAuthFlow` internally:
  - POST `/sdk/v1/connections/Fyers/login-url` with `{ apiKey, secretKey }` from form → backend returns `{ authUrl }`
  - Opens WebView at authUrl
  - Captures redirect-URL match on `REACT_APP_BROKER_CONNECT_REDIRECT_URL`
  - POST `/sdk/v1/connections/Fyers/exchange-token` with captured `auth_code` + form `apiKey`/`secretKey` as extraExchangeBody

**Backend SDK route:**
- `/sdk/v1/connections/Fyers/login-url` (POST): dispatches to ccxt
- `/sdk/v1/connections/Fyers/exchange-token` (POST): dispatches to ccxt `/fyers/gen-access-token`

**ccxt-india proxy target:** Same routes as legacy.

### Touchpoint comparison table

| Component | Legacy (FyersConnect) | SDK (Phase3SdkBrokerModal) | Status |
|-----------|----------------------|---------------------------|--------|
| **Entry** | ModalManager dispatches 'Fyers' | BrokerConnectModalDispatch dispatches 'Fyers' | ✅ |
| **Form schema** | Hard-coded FyersConnectUI (API Key + Secret Key inputs) | SDK brokerFormSchema.ts with field labels clarifying inversion | ✅ |
| **IP-whitelist gate** | EgressIpCallout integration at FyersConnectUI.js:149-160 | **NOT integrated in Phase3SdkBrokerModal** (egressReady defaults true) | ❌ |
| **IP gate blocking** | Connect button disabled until egressReady=true | No blocking; user can submit form without claiming IP | ❌ |
| **OAuth flow** | Client detects `auth_code=` in WebView URL | SDK WebViewBrokerAuthFlow captures + exchanges | ✅ |
| **Login URL source** | Backend `/api/fyers/update-key` → Fyers | Backend `/sdk/v1/connections/Fyers/login-url` → Fyers | ✅ |
| **Token exchange** | Client parses auth_code → POST `fyers/gen-access-token` | SDK POST `/sdk/v1/connections/Fyers/exchange-token` | ✅ |
| **Credential storage** | PUT `/api/user/connect-broker` (legacy endpoint) | SDK client auto-persists via `/exchange-token` response | ✅ |
| **Naming inversion** | modal apiKey ↔ DB secretKey; modal secretKey ↔ DB clientCode (line 346-355) | SDK schema labels clarify ("API Key (Secret)", "Secret Key (Client ID)") | ✅ |
| **Reauth hydration** | FyersConnect.js:345-355 (reauthConfig payload + swap on hydrate) | **NOT yet implemented in Phase3SdkBrokerModal** (no reauthConfig prop) | ❌ |
| **Encryption** | CryptoJS.AES on modal apiKey (line 279-283) | SDK handles encryption server-side | ✅ |
| **Error handling** | Axios `.catch` with HTTP vs network branch | SDK `onError` with `error.code` / `error.detail` | ⚠️ |
| **Post-success callback** | `fetchBrokerStatusModal()` in try/catch | `fetchBrokerStatusModal()` in try/catch (line 162) | ✅ |
| **Help content** | FyersHelpContent.js YouTube + 5 steps + "Order Placement" warning | Phase3BrokerHelp imports FyersHelpContent | ✅ |

### Gap fix plan

**IP-whitelist gate (❌)**
- **File:line**: Phase3SdkBrokerModal.js:83-89 (IP_WHITELIST_BROKERS set)
- **Issue**: Phase3SdkBrokerModal does not include Fyers in IP_WHITELIST_BROKERS, so `egressReady` starts true and the BrokerCredentialForm submit is never gated.
- **Exact change**: Add `'Fyers'` to IP_WHITELIST_BROKERS set.
- **Dependencies**: None (EgressIpCallout already integrated in Phase3SdkBrokerModal).

**Reauth hydration (❌)**
- **File:line**: Phase3SdkBrokerModal.js (no reauthConfig prop yet)
- **Exact change**: (1) Add `reauthConfig` prop to Phase3SdkBrokerModal signature. (2) In useEffect, decode `reauthConfig.secretKey` → `oauthExtraBody.apiKey` (swap name) and `reauthConfig.clientCode` → `oauthExtraBody.secretKey` (swap name). (3) Update BrokerConnectModalDispatch to pass `modalPayload.reauthConfig`.

**Error handling branch (⚠️)**
- **File:line**: Phase3SdkBrokerModal.js:172-185
- **Exact change**: Check `sdkError?.httpStatus` to distinguish credential rejection vs network failure.

### Verdict

**SDK-broken** — Fyers flow has two critical gaps that block production readiness: **(1) missing IP-whitelist gate** — users can submit the form without claiming a static IPv4, leading to order-placement failures with opaque "IP not whitelisted" errors from Fyers, and **(2) missing reauth hydration** — session-expired users on Fyers cannot reconnect via SDK path. EgressIpCallout component is already ported; reauth pattern is already implemented in FyersConnect.js (lines 345-355). Effort is low (2-3 hours); impact is high.

---

# BROKER FLOW AUDIT: IIFL Securities, AliceBlue, Motilal Oswal

Deep per-broker flow audit for AlphaQuark B2B mobile app's Phase 3 SDK migration. Comprehensive analysis of legacy implementation paths, encryption envelopes, backend routing, and SDK readiness gaps.

---

## 8. IIFL Securities

### Current production flow (re-certified 2026-09-27)

IIFL is enabled and intentionally dispatched to `src/components/iiflmodal.js`
through `SDK_LEGACY_FALLBACK`, regardless of the SDK master flag. This is a
Phase 3 schema fallback, not the retired partner flow described in the
historical audit below.

- The customer creates an Individual Trader API app at
  `https://developers.iiflcapital.com/`, registers the exact redirect URL shown
  in the app, and whitelists the exact Route64 IPv6 shown in the egress card.
- The stepper collects the customer's App Key and App Secret. Both are
  AES-wrapped before `POST /api/iifl/update-key`; the Node backend persists the
  encrypted direct credentials and returns a login URL.
- The WebView accepts only the registered callback and parses current
  `authcode`/`clientid`, camel-case aliases, plus retired `auth_token` for
  compatibility. A single-flight ref prevents duplicate exchange calls.
- `POST /api/iifl/exchange` performs the secret-bearing token exchange in Node.
  App JavaScript does not receive the stored App Secret.
- `PUT /api/user/connect-broker` persists the session under
  `connected_brokers[IIFL Securities]`. AsyncStorage is only retained for
  compatibility. The broker picker, status refresh, holdings/funds, order book,
  and existing trade path therefore use the normal persisted broker record.
- Reconnect and session-expiry entry points call `/api/iifl/reauth-url` when
  saved direct credentials exist, then require the normal daily IIFL browser
  login without asking the user to recreate the developer app.
- Order-book and cancel requests use the mounted direct ccxt routes with the
  persisted `accessToken` and `clientCode`.

**Current verdict:** production-capable on the legacy lane; **SDK-broken** only
in the migration sense. Promotion remains blocked until the SDK offers the
same two-field direct-OAuth schema, IPv6 gate, Node login-url route, and
secret-preserving exchange contract.

### Historical pre-2026-09-27 flow (superseded; retained for audit trail)

#### Legacy flow at the time of the original audit

**Entry points:**
- BrokerConnectModalDispatch dispatch (`src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js:58-62`) — `SDK_ELIGIBLE_MODALS.has('IIFL')` returns true but IIFL is NOT in active SDK rollout due to architectural break.
- Inline render sites: IIFLReviewTradeModal (legacy production path; see PHASE3_BROKER_AUDIT.md § routing bypass).

**Form fields:**
- **Zero form fields collected.** IIFL uses pure OAuth flow via WebView.
- User is presented with a WebView (React Native `<WebView>` component, `iiflmodal.js:238`) pointed at the broker's OAuth portal.
- No credential form; no user input fields.

**Step-by-step flow:**
1. Modal opens when `isVisible` becomes true (`iiflmodal.js:45`).
2. `useEffect` at line 44-56 constructs auth URL: `https://markets.iiflcapital.com/?v=1&appkey=nHjYctmzvrHrYWA&redirect_url=${redirectUrl}` (line 52). The `redirectUrl` is read from `configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL` and the protocol is stripped (line 48-51).
3. `setAuthUrl(iiflUrl)` stages the URL (`iiflmodal.js:54`).
4. WebView is rendered at `source={{uri: authUrl}}` (`iiflmodal.js:239`).
5. User authenticates with IIFL broker portal (outside app).
6. IIFL portal redirects to `${REACT_APP_BROKER_CONNECT_REDIRECT_URL}?auth_token=<TOKEN>&clientid=<ID>` (OAuth callback).
7. WebView's `onNavigationStateChange` handler (`iiflmodal.js:83-95`) fires on navigation.
8. Handler checks `url.includes('auth_token=')` at line 86.
9. If matched, `parseQueryString` extracts `auth_token` and `clientid` from the redirect URL (lines 87-89).
10. `handleIIFLLogin(sessionToken, clientId)` is called with both params (line 92).
11. Inside `handleIIFLLogin` (lines 97-191), form validation checks `!authCode || !clientId` (line 98) and returns early if either is missing.
12. `setIsLoading(true)` at line 100.
13. Axios POST to `${server.ccxtServer.baseUrl}/iifl/login/client` (line 103) with payload:
    ```javascript
    {
      user_email: userEmail,
      auth_token: authCode,
      client_code: clientId,
    }
    ```
    (lines 104-107).
14. Request headers include:
    - `Content-Type: application/json` (line 111).
    - `X-Advisor-Subdomain: configData?.config?.REACT_APP_HEADER_NAME` (line 112).
    - `aq-encrypted-key: generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)` (line 113-116) — security token generated from environment secrets.
15. ccxt-india `/iifl/login/client` endpoint processes the OAuth tokens and returns `response.data.sessionToken` (line 121).
16. **CRITICAL: AsyncStorage persistence, NOT MongoDB.** `AsyncStorage.setItem('iiflAccessToken', accessToken)` (line 123). `AsyncStorage.setItem('iiflClientCode', clientId)` (line 124). These write to device-local AsyncStorage, NOT to any backend database.
17. SDK dual-write attempt at lines 132-142 (if SDK bridge is enabled and ready):
    ```javascript
    if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
      sdkDualWriteSafely(
        sdkConnectBroker(sdkBridge.client, 'IIFL Securities', {
          user_broker: 'IIFL Securities',
          clientCode: clientId,
          jwtToken: accessToken,
        }),
        'IIFL Securities',
        'connect',
      );
    }
    ```
    This attempts to write to SDK backend route `/sdk/v1/connections/IIFL Securities/connect` for parity.
18. `onClose()` dismisses the modal (line 144).
19. Post-success steps wrapped in try-catch (lines 149-166) to prevent downstream errors from overwriting the "Connected" success message:
    - `Toast.show({type: 'success', text1: 'Successfully connected to IIFL'})` (line 150-153).
    - `fetchBrokerStatusModal()` refreshes broker status in UI context (line 159).
20. On error (catch at line 167):
    - Check if HTTP error via `!!error?.response` (line 169).
    - Extract message from `error?.response?.data?.message` or `.details` or fallback to `error?.message` (lines 170-173).
    - Show toast with error text (lines 183-187).
    - Two error message modes:
      - HTTP error: use upstream message.
      - Network/app error: generic "Connection Issue" + recovery note (lines 179-181).
21. `setIsLoading(false)` in finally block (line 189).

**Encryption:**
- **None.** OAuth tokens (`auth_token`, sessionToken) are passed plaintext over HTTPS. No local encryption before AsyncStorage.
- No encryption envelope on the API request body.

**Auth header construction:**
- Standard AlphaQuark app header: `aq-encrypted-key` token from `generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)`.
- Advisor subdomain: `X-Advisor-Subdomain: configData?.config?.REACT_APP_HEADER_NAME` (line 112) — multi-tenant routing.
- Standard `Content-Type: application/json`.

**IP-whitelist gate:**
- **None.** IIFL does not implement an IP-whitelist gate (no EgressIpCallout). Broker portal is publicly accessible.

**Reauth handling:**
- **No `reauthConfig` prop.** Modal does not accept reauth pre-fill parameters. Every connect is a fresh OAuth round-trip.

**Help content:**
- No explicit help UI in iiflmodal.js. Help would be rendered upstream in the parent modal container or via a separate HelpUI component.

**Broker-specific quirks:**
- **Hardcoded `appkey=nHjYctmzvrHrYWA` in the WebView URL** (line 52). This is a platform-level app registration with IIFL. The appkey is embedded in the OAuth URL and tightly bound to the redirect domain.
- **AsyncStorage-only persistence** — No backend database record. The entire IIFL connection state is stored on the device's local AsyncStorage. This is a critical deviation from every other broker.
- **SDK dual-write to non-standard endpoint** — The dual-write targets `/sdk/v1/connections/IIFL Securities/connect` but since there's no MongoDB backend, the SDK route receives an AsyncStorage-originated token that the SDK's MongoDB layer can't replicate.
- **No credential form** — user never enters fields; all auth is mediated by the IIFL WebView.
- **Redirect URL handling** — the redirect URL is read from `.env` at runtime, but the appkey is hardcoded, so the appkey-to-redirect mapping is fixed at app build time. If the redirect domain changes, the appkey must be re-registered with IIFL.

**Backend Node routes:**
- No Node routes in the app — IIFL uses ccxt-india exclusively for token exchange.

**ccxt-india routes:**
- `POST /iifl/login/client` (line 103, `server.ccxtServer.baseUrl`) — consumes `user_email, auth_token, client_code` and returns `sessionToken`. This route is the bridge between IIFL's OAuth and the app's session. No database write on the backend; the sessionToken is returned to the client for AsyncStorage storage.

### SDK flow (Phase 3)

**Schema row:**
From `PHASE3_BROKER_AUDIT.md` line 41:
```
| IIFL Securities | `IIFL` / `IIFL Securities` | `IIFL Securities` | `src/components/iiflmodal.js` | **SDK-broken** — AsyncStorage-only persistence (no MongoDB record) |
```

Schema from SDK broker registry (brokerFormSchema.ts) — expected to be `flow=oauth, fields=[]` (OAuth-only, no credential form). Verify via SDK package.

**Phase3SdkBrokerModal handling:**
- When `SDK_ELIGIBLE_MODALS.has('IIFL')` is true (line 58-62 BrokerConnectModalDispatch.js), the modal is routed to `Phase3SdkBrokerModal` instead of legacy `IIFLModal` (line 44-45).
- `Phase3SdkBrokerModal` instantiates `<BrokerCredentialForm>` for IIFL (Phase3SdkBrokerModal.js lines 71-73 import).
- The form's behavior depends on SDK schema: if schema is `flow=oauth, fields=[]`, the form auto-skips and hands off to `<WebViewBrokerAuthFlow>` (no credential collection phase).
- `WebViewBrokerAuthFlow` opens a WebView at the SDK's `/sdk/v1/connections/IIFL Securities/login-url` endpoint response URL.
- SDK intercepts the redirect URL and POSTs to `/sdk/v1/connections/IIFL Securities/exchange-token` with the captured query params.

**Backend SDK route:**
- `/sdk/v1/connections/IIFL Securities/login-url` (assumed from pattern) — should return the OAuth URL, likely proxying to ccxt-india or returning the hardcoded `https://markets.iiflcapital.com/?v=1&appkey=...&redirect_url=...` URL. **Verify backend implementation in aq_backend_github/Routes/sdk/v1/connections.js.**
- `/sdk/v1/connections/IIFL Securities/exchange-token` (assumed from pattern) — should accept the OAuth callback query params and call ccxt `/iifl/login/client` to mint the sessionToken. Then **where does the sessionToken persist?** If it's AsyncStorage-like persistence via SDK, the gap is that SDK expects MongoDB but IIFL has no MongoDB backend. If it's returned to the client for AsyncStorage, the SDK route must bypass its normal MongoDB write and return the token directly.

**ccxt-india proxy target:**
- Same as legacy: `POST /iifl/login/client` (ccxt-india).

**SDK widget API surface:**
- `BrokerCredentialForm` with zero fields (auto-skips).
- `WebViewBrokerAuthFlow` with redirect-URL intercept.
- No reauthConfig pre-fill (not supported by SDK widgets today).
- No special AsyncStorage-only mode.

### Touchpoint comparison table

| Touchpoint | Legacy (iiflmodal.js) | SDK (Phase3SdkBrokerModal + SDK widgets) | Gap Status |
|------------|----------------------|----------------------------------------|-----------|
| Entry point dispatch | BrokerConnectModalDispatch → IIFLModal | BrokerConnectModalDispatch → Phase3SdkBrokerModal | ✅ Dispatch consistent |
| Form fields | Zero (pure OAuth) | Zero (OAuth schema) | ✅ Aligned |
| OAuth URL construction | Hardcoded appkey + env redirect URL (iiflmodal.js:52) | SDK `/login-url` backend route | ⚠️ Backend route must return same URL structure |
| OAuth callback interception | WebView `onNavigationStateChange` (iiflmodal.js:83-95) | `WebViewBrokerAuthFlow` generic intercept | ⚠️ Assumes callback params are compatible |
| Token exchange | POST `/iifl/login/client` (ccxt) | `/exchange-token` → POST `/iifl/login/client` (ccxt) | ✅ Same ccxt endpoint |
| sessionToken destination | AsyncStorage (iiflmodal.js:123) | SDK backend (MongoDB assumed) | ❌ **BROKEN** — AsyncStorage vs MongoDB mismatch |
| Device-side persistence | AsyncStorage only | SDK local cache + MongoDB sync | ❌ SDK assumes MongoDB backend; IIFL has none |
| Broker status refresh | `fetchBrokerStatusModal()` reads UI's `connected_brokers[]` | Same | ⚠️ But `connected_brokers[]` is empty if IIFL has no MongoDB |
| Error handling | HTTP vs network distinction (iiflmodal.js:169-187) | SDK error envelope | ⚠️ Message format may differ |
| Post-success toast | "Successfully connected to IIFL" | SDK widget's success toast | ⚠️ Copy may differ |
| IP whitelist gate | None | Phase3SdkBrokerModal does NOT gate IIFL on IP | ✅ Aligned (no gate) |
| Reauth pre-fill | Not supported (no reauthConfig) | Not supported (SDK gap) | ✅ Consistently absent |
| Session state persistence | Device-local AsyncStorage | Backend MongoDB + SDK sync | ❌ **CRITICAL GAP** |
| User broker name | 'IIFL Securities' | 'IIFL Securities' (wire-name) | ✅ Aligned |
| Encryption | None (plaintext tokens over HTTPS) | SDK encryption layer (if any) | ⚠️ Verify SDK token handling |
| Callback URL from env | `REACT_APP_BROKER_CONNECT_REDIRECT_URL` (stripped) | Same (via Phase3SdkBrokerModal.js:91-93) | ✅ Aligned |

### Gap fix plan

**Primary gap — AsyncStorage-only persistence:** IIFL's connection is stored ONLY on the device via AsyncStorage. The SDK's entire persistence model assumes server-side MongoDB storage. This is an architectural mismatch.

**Fix options:**

**Option A: IIFL backend adds MongoDB persistence** (server-side change)
- File: `aq_backend_github/Routes/sdk/v1/connections.js` (hypothetical; search for IIFL handling).
- Change: After `/exchange-token` returns the sessionToken from ccxt-india, the backend must INSERT into MongoDB's `connected_brokers[]` collection for the user, mirroring what happens for every other broker.
- Endpoint: `PUT /sdk/v1/connections/IIFL Securities/exchange-token` should call ccxt `/iifl/login/client`, receive sessionToken, then call a local MongoDB persist function (`saveConnectedBrokerToDb` or similar) to record `{user_broker: 'IIFL Securities', jwtToken: sessionToken, clientCode: clientId}`.
- Dependencies: MongoDB write path, user_id routing from SDK session token.
- Effort: Low-to-medium (one endpoint + one DB write).

**Option B: SDK widget gains AsyncStorage-only mode** (SDK architectural change)
- File: `@alphaquark/mobile-sdk` → `WebViewBrokerAuthFlow.tsx` or SDK's persistence layer.
- Change: Add a schema flag (e.g., `persistenceModel: 'device-storage'` or similar) that tells the SDK to skip MongoDB and write only to the client's AsyncStorage after token exchange.
- For IIFL specifically, the schema row would have `persistenceModel: 'device-storage'` and the SDK would respect that at exchange-token time.
- Dependencies: SDK schema extension, SDK bridge's dual-write to AsyncStorage.
- Effort: Medium (requires SDK package change, testing in two flows).

**Current state:** The legacy modal persists to AsyncStorage at line 123. The SDK dual-write (lines 132-142) attempts to write to MongoDB via `/sdk/v1/connections/IIFL Securities/connect`, but there's no backend handler. Even if the handler existed, the AsyncStorage state is the source of truth for the app's UI refresh loop.

**Recommended approach:** Option A (server-side MongoDB add) is lower-risk and aligns with SDK's design. Option B is more flexible long-term but requires SDK package changes.

### Historical verdict (superseded 2026-09-27)

**SDK-broken.**

**Historical reasoning:** At the time of the original audit, IIFL persisted session tokens only to device-local AsyncStorage. That persistence gap is closed by the 2026-09-27 Node `/api/user/connect-broker` path. The remaining SDK blocker is now the incompatible SDK schema and exchange contract documented in the current-state section above.

---

## 9. AliceBlue

### Legacy flow (production path)

**Entry points:**
- BrokerConnectModalDispatch dispatch (`src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js:58-62`) — `SDK_ELIGIBLE_MODALS.has('AliceBlue')` is true.
- Inline render sites: legacy code paths render `AliceBlueConnect` directly (see PHASE3_BROKER_AUDIT.md § routing bypass).

**Form fields:**
- **Zero form fields collected.** AliceBlue is pure OAuth flow. User does NOT enter API keys, client IDs, or credentials.
- The modal only renders a WebView; the credential collection happens on AliceBlue's broker portal within the WebView.

**Step-by-step flow:**
1. Modal opens when `isVisible` becomes true (`AliceBlueConnect.js:84`).
2. On mount, `useEffect` calls `getUserDetails()` (line 84-86) to fetch the logged-in user's MongoDB user ID via `axios.get('api/user/getUser/${userEmail}')` (line 68). This is used later for the MongoDB write (line 178).
3. `buildAliceBlueAuthUrl()` is called (line 290, passed to AliceBlueConnectUI) and constructs:
   ```javascript
   const origin = 'https://prod.alphaquark.in';
   const returnPath = '/stock-recommendation';
   return `${server.ccxtServer.baseUrl}aliceblue/login?origin=${encodeURIComponent(origin)}&returnPath=${encodeURIComponent(returnPath)}`;
   ```
   (lines 40-44).
4. **CRITICAL: HARDCODED `prod.alphaquark.in` origin** (line 40). This is NOT read from `REACT_APP_BROKER_CONNECT_REDIRECT_URL`. Comment at lines 24-38 explains: AliceBlue's partner appcode is allow-listed against `prod.alphaquark.in` only. Production incident 2026-04-26: when the origin was changed to `app-links.alphaquark.in/broker-callback`, AliceBlue's portal silently bounced users back to the password screen after OTP because the redirect URL failed appcode-whitelist validation. The hardcoding is intentional and safe because the WebView intercepts the callback by query params (`user_broker=AliceBlue`, `access_token`), not by matching the redirect host.
5. WebView at that URL: `https://ccxtprod.alphaquark.in/aliceblue/login?origin=https://prod.alphaquark.in&returnPath=/stock-recommendation`.
6. ccxt-india `/aliceblue/login` endpoint processes the OAuth redirect and yields a final URL for AliceBlue's portal.
7. User logs into AliceBlue portal with phone number, password, TOTP/mobile OTP (per AliceblueHelpContent.js lines 31-33).
8. AliceBlue redirects to `https://prod.alphaquark.in/stock-recommendation?user_broker=AliceBlue&status=0&access_token=<TOKEN>&client_id=<ID>` (OAuth callback).
9. WebView's `onNavigationStateChange` handler (line 120-158) fires.
10. Handler checks if URL includes `user_broker=AliceBlue` OR both `access_token=` and `client_id=` (lines 127-130).
11. If callback already processed (hasProcessedCallback.current is true), return early (line 124).
12. Parse query string (line 134) to extract `status`, `access_token`, `client_id`.
13. Check status code: if `status === '1'`, connection failed (lines 139-150). Show error alert and close modal.
14. If `status === '0'` and both tokens present (line 153), mark callback as processed (line 154) and call `saveBrokerConnection(accessToken, clientId)` (line 155).
15. Inside `saveBrokerConnection` (lines 161-277):
    - Validate `userId` exists (line 162). If not, show error.
    - Set loading state (line 167).
    - Construct broker data object (lines 169-174):
      ```javascript
      {
        uid: userId,
        user_broker: 'AliceBlue',
        jwtToken: accessToken,
        clientCode: clientId,
      }
      ```
    - Axios PUT to `${server.server.baseUrl}api/user/connect-broker` (line 178) with the broker data.
    - Request headers (lines 179):
      ```javascript
      {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
      }
      ```
16. SDK dual-write (lines 192-201) if SDK bridge is enabled:
    ```javascript
    if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
      sdkDualWriteSafely(
        sdkExchangeBrokerToken(sdkBridge.client, 'AliceBlue', {
          access_token: accessToken,
          client_id: clientId,
        }),
        'AliceBlue',
        'exchange-token',
      );
    }
    ```
    Note: uses `sdkExchangeBrokerToken` (not `sdkConnectBroker`) because the callback yields `access_token + client_id`, not `jwtToken + clientCode`.
17. Optional model-portfolio refresh (lines 204-220) — non-critical, wrapped in try-catch.
18. Close modal (line 225).
19. Post-success steps (lines 231-256) wrapped in try-catch:
    - Emit refreshEvent (line 232).
    - Call `fetchBrokerStatusModal()` to refresh broker status (line 243).
    - Only show "Connected Successfully" toast if migration modal won't surface (lines 244-250).
20. On error (catch at line 257):
    - Set loading state to false (line 259).
    - Extract message from response (lines 260-264).
    - Show error alert with HTTP or network distinction (lines 267-275).

**Encryption:**
- **None.** OAuth tokens (`access_token`) are passed plaintext over HTTPS.
- No encryption on the API request body.

**Auth header construction:**
- Standard AlphaQuark app header: `aq-encrypted-key` token from `generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)`.
- Advisor subdomain: `X-Advisor-Subdomain: configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain()` (line 93-94) — multi-tenant routing.
- Standard `Content-Type: application/json`.

**IP-whitelist gate:**
- **No explicit IP gate in AliceBlueConnect.js.** However, Phase3SdkBrokerModal includes AliceBlue in `IP_WHITELIST_BROKERS` (Phase3SdkBrokerModal.js line 86). This means the SDK widget WILL gate on IP readiness, whereas the legacy modal does NOT. This is a behavioral divergence that should be verified.

**Reauth handling:**
- **No `reauthConfig` prop.** Modal does not accept reauth parameters. Every connect is a fresh OAuth round-trip.

**Help content:**
From `AliceblueHelpContent.js`:
- Steps 1-2 are always visible (lines 28-43): login to broker portal, handle Risk Disclosure pop-up.
- Steps 3-5 are expanded-only (lines 45-57): copy API Key, find Client ID, enter both and click Connect.
- No video (commented out at lines 18-24).
- Note that API Key is valid for 24 hours only (line 49).
- Help content URL: `https://ant.aliceblueonline.com/apps` (line 32).

**Broker-specific quirks:**
- **Hardcoded `prod.alphaquark.in` origin** (line 40) — DO NOT read from env var. This is hardcoded because AliceBlue's appcode whitelist only allows `prod.alphaquark.in`. The comment (lines 24-38) is extensive and documents a production incident.
- **Empty OAuth form** — AliceBlue broker portal collects all credentials; the app never sees them. The app only receives `access_token` and `client_id` from the callback.
- **ccxt-india relay for origin storage** (line 42) — The legacy code routes through `ccxtServer.baseUrl/aliceblue/login?origin=...&returnPath=...`. This allows the backend to store the origin in MongoDB for multi-site callback routing (per comment line 19-21).
- **SDK dual-write uses `exchange-token`, not `connect`** (line 194) — because the callback yields OAuth tokens, not credentials.
- **No IP gate in legacy** (line 261 has no egressReady check) — but Phase3SdkBrokerModal.js line 86 includes AliceBlue in IP_WHITELIST_BROKERS, so the SDK version will gate.

**Backend Node routes:**
- `PUT /api/user/connect-broker` (line 178) — persists `uid, user_broker, jwtToken, clientCode` to MongoDB.
- No other Node routes; AliceBlue uses ccxt-india exclusively for OAuth.

**ccxt-india routes:**
- `GET /aliceblue/login?origin=<ORIGIN>&returnPath=<PATH>` (line 42) — returns the OAuth URL for AliceBlue portal. The origin is stored in MongoDB for redirect-URL enforcement on the backend.

### SDK flow (Phase 3)

**Schema row:**
From `PHASE3_BROKER_AUDIT.md` line 42:
```
| AliceBlue | `AliceBlue` | `AliceBlue` | `AliceBlueConnect.js` | **SDK-with-gap** — schema must be `flow=oauth, fields=[]` (currently wrong); hardcoded origin `prod.alphaquark.in` |
```

Schema from SDK broker registry — currently (incorrectly) set to `flow=credentials, fields=[apiKey, userId]` per user-reported regression. **Must be changed to `flow=oauth, fields=[]`** to match Zerodha's empty-form OAuth shape.

**Phase3SdkBrokerModal handling:**
- When `SDK_ELIGIBLE_MODALS.has('AliceBlue')` is true (line 58 BrokerConnectModalDispatch.js), the modal is routed to `Phase3SdkBrokerModal`.
- `Phase3SdkBrokerModal` at line 143-145 maps 'AliceBlue' → 'AliceBlue' (wire-name) via `visibleModalToBrokerName`.
- Form instantiation: if schema is `flow=oauth, fields=[]`, the form auto-skips (no credential collection).
- `WebViewBrokerAuthFlow` opens a WebView at the SDK's `/sdk/v1/connections/AliceBlue/login-url` endpoint response.
- SDK intercepts the redirect URL and POSTs to `/sdk/v1/connections/AliceBlue/exchange-token`.

**Backend SDK route:**
- `/sdk/v1/connections/AliceBlue/login-url` — must return the OAuth URL. **CRITICAL: must hardcode `origin=https://prod.alphaquark.in&returnPath=/stock-recommendation` when calling ccxt-india `/aliceblue/login`**, NOT use `REACT_APP_BROKER_CONNECT_REDIRECT_URL` from the tenant's config. This is the key architectural requirement: the origin is locked to `prod.alphaquark.in` due to AliceBlue's appcode whitelist.
- `/sdk/v1/connections/AliceBlue/exchange-token` — must accept `access_token` and `client_id` query params (from the callback), call ccxt `/aliceblue/login` if needed to finalize, and return `BrokerExchangeResult`.

**ccxt-india proxy target:**
- Same as legacy: `GET /aliceblue/login?origin=https://prod.alphaquark.in&returnPath=/stock-recommendation` (hardcoded origin, NOT from env).

**SDK widget API surface:**
- `BrokerCredentialForm` with zero fields (auto-skips).
- `WebViewBrokerAuthFlow` with redirect-URL intercept.
- SDK must recognize AliceBlue's callback params (`user_broker=AliceBlue`, `access_token`, `client_id`) and route to `exchange-token`.
- No reauthConfig pre-fill (not supported by SDK widgets today).

### Touchpoint comparison table

| Touchpoint | Legacy (AliceBlueConnect.js) | SDK (Phase3SdkBrokerModal + SDK widgets) | Gap Status |
|------------|---------------------------|----------------------------------------|-----------|
| Entry point dispatch | BrokerConnectModalDispatch → AliceBlueConnect | BrokerConnectModalDispatch → Phase3SdkBrokerModal | ✅ Dispatch consistent |
| Form fields | Zero (pure OAuth) | Zero (should be `flow=oauth, fields=[]`) | ❌ Schema currently wrong (`flow=credentials`) |
| OAuth URL construction | ccxt `/aliceblue/login?origin=prod.alphaquark.in&returnPath=/stock-recommendation` (hardcoded, lines 40-44) | SDK `/login-url` → backend must hardcode same origin | ⚠️ Backend route must override env var |
| Origin URL enforcement | Hardcoded `prod.alphaquark.in` (line 40) | Must be hardcoded in backend route, not read from env | ⚠️ Architectural change needed |
| OAuth callback URL | `https://prod.alphaquark.in/stock-recommendation?user_broker=AliceBlue&status=0&access_token=...&client_id=...` | Same (hardcoded origin) | ✅ Aligned |
| OAuth callback interception | `onNavigationStateChange` checks for `user_broker=AliceBlue` and `access_token` (lines 128-129) | `WebViewBrokerAuthFlow` generic intercept | ⚠️ SDK must recognize `user_broker=AliceBlue` param |
| Token exchange | PUT `/api/user/connect-broker` with `{access_token, client_id}` (line 178) | SDK `/exchange-token` → MongoDB persist | ✅ Routing aligned |
| Persistence target | MongoDB `connected_brokers[]` via `/api/user/connect-broker` | SDK `/exchange-token` → same MongoDB path | ✅ Aligned |
| Broker status refresh | `fetchBrokerStatusModal()` reads `connected_brokers[]` | Same | ✅ Aligned |
| Error handling | HTTP vs network distinction (lines 260-275) | SDK error envelope | ⚠️ Message format may differ |
| Post-success toast | "Connected Successfully" (lines 245-248) | SDK widget's success toast | ⚠️ Copy may differ |
| IP whitelist gate | None in legacy (line 261 has no egressReady check) | Phase3SdkBrokerModal gates on IP (line 86 in `IP_WHITELIST_BROKERS`) | ❌ Divergence — legacy does NOT gate, SDK DOES gate |
| Reauth pre-fill | Not supported | Not supported (SDK gap) | ✅ Consistently absent |
| User broker name | 'AliceBlue' | 'AliceBlue' (wire-name) | ✅ Aligned |
| Encryption | None (plaintext tokens over HTTPS) | SDK encryption layer (if any) | ⚠️ Verify SDK token handling |
| Callback URL from env | NOT read from env; hardcoded `prod.alphaquark.in` | Must also be hardcoded, not read from `REACT_APP_BROKER_CONNECT_REDIRECT_URL` | ⚠️ Requires Phase3SdkBrokerModal override |
| User-visible flow | WebView OAuth, no form | Same (zero-field form → WebView) | ✅ Aligned |

### Gap fix plan

**Gap 1: SDK schema is wrong** (File: `@alphaquark/mobile-sdk` → `brokerFormSchema.ts`)
- Current: `flow=credentials, fields=[apiKey, userId]` (per user-reported regression).
- Fix: Change to `flow=oauth, fields=[]` matching Zerodha's shape.
- Reasoning: AliceBlue broker portal collects credentials; the app receives only OAuth tokens. No credential form fields are needed.
- Effort: Low (one schema row change in SDK package).

**Gap 2: Hardcoded origin not enforced at SDK layer** (File: `aq_backend_github/Routes/sdk/v1/connections.js`)
- Current: Phase3SdkBrokerModal.js passes `REDIRECT_URL` from `Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL` (line 91-93).
- For AliceBlue specifically, the backend route `/sdk/v1/connections/AliceBlue/login-url` must IGNORE the tenant's redirect URL and FORCE `origin=https://prod.alphaquark.in&returnPath=/stock-recommendation` when calling ccxt-india `/aliceblue/login`.
- Alternative: Add a special case in Phase3SdkBrokerModal (line 140+) that overrides `REDIRECT_URL` for AliceBlue:
  ```javascript
  const redirectUrl = brokerName === 'AliceBlue'
    ? 'https://prod.alphaquark.in/stock-recommendation'
    : REDIRECT_URL;
  ```
  Then pass this override to the WebView via props.
- Either way (backend or SDK-side), AliceBlue's origin must be hardcoded.
- Effort: Low (conditional logic or backend dispatcher change).

**Gap 3: IP whitelist gate divergence** (File: `Phase3SdkBrokerModal.js`)
- Current: AliceBlue is in `IP_WHITELIST_BROKERS` (line 86) but legacy AliceBlueConnect.js does NOT gate on IP.
- Action: Verify if AliceBlue's broker API requires IP whitelist. If not, remove from `IP_WHITELIST_BROKERS` (line 86) to align with legacy.
- If IP whitelist IS required by AliceBlue (undocumented), add IP-gate logic to legacy AliceBlueConnect.js for parity.
- Effort: Low (set membership change or add EgressIpCallout to legacy).

**Gap 4: Backend `/sdk/v1/connections/AliceBlue/exchange-token` implementation** (File: `aq_backend_github/Routes/sdk/v1/connections.js`)
- Verify that the backend route accepts AliceBlue's callback query params (`access_token`, `client_id`) and persists to MongoDB via the same path as legacy `/api/user/connect-broker`.
- Effort: Low (routing verification + potential ccxt call if not already implemented).

### Verdict

**SDK-with-gap.**

**Reasoning:** AliceBlue's legacy flow is pure OAuth with zero credential fields — structurally identical to Zerodha. The SDK widget family supports empty-field OAuth via `flow=oauth, fields=[]`. However, three issues block migration:

1. **SDK schema is currently wrong** (set to credentials form instead of OAuth). Must be corrected to `flow=oauth, fields=[]`.
2. **Hardcoded origin `prod.alphaquark.in` must be enforced in the SDK layer.** AliceBlue's appcode whitelist rejects other origins (production incident 2026-04-26). The SDK backend's `/login-url` route must hardcode the origin when calling ccxt, not read from the tenant's env var.
3. **IP whitelist gate divergence** — legacy does NOT gate, Phase3SdkBrokerModal DOES gate. Clarify whether AliceBlue requires IP whitelist and align.

Once these gaps close (primarily SDK schema fix + backend route hardcoding), AliceBlue is a solid SDK-clean candidate. The OAuth flow is straightforward; callback interception is generic; persistence targets the standard MongoDB path.

---

## 10. Motilal Oswal

### Legacy flow (production path)

**Entry points:**
- BrokerConnectModalDispatch dispatch (`src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js:58-62`) — `SDK_ELIGIBLE_MODALS.has('Motilal')` is true.
- Inline render sites: legacy code paths render `MotilalModal` directly.

**Form fields:**
- **Two credential fields collected:**
  1. `apiKey` (state: `apiKey`, handler: `setApiKey`, line 35) — user enters the API Key from Motilal developer portal.
  2. `clientCode` (state: `clientCode`, handler: `setClientCode`, line 36) — user enters the Client Code from their Motilal account.
- Both fields have visibility toggles:
  - `isPasswordVisible` / `setIsPasswordVisible` (line 37) — for apiKey field.
  - `ispasswordVisibleup` / `setIsPasswordVisibleup` (line 38) — for clientCode field (naming inconsistency).
- Form validation at line 138: both fields must be non-empty.

**Step-by-step flow:**
1. Modal opens when `isVisible` becomes true (`MotilalModal.js:306-309`).
2. On mount, `useEffect` at line 75-77 fetches user details via `axios.get('api/user/getUser/${userEmail}')` to get the user's MongoDB `_id`.
3. User enters apiKey and clientCode in the form fields (lines 350-353).
4. User taps "Connect" button (`handleConnect={initiateAuth}`, line 358).
5. Inside `initiateAuth` (lines 119-176):
   - Check if egress IP is ready (line 120). If not, set `unmetAck(true)` and show alert to claim IP (lines 121-122).
   - **30-second session-affinity debounce gate (lines 124-136).** Motilal binds OTP + Authorization header + page session to a single page-load. Back-to-back logins surface "Authorization Invalid" or "Two Factor Authentication Failed" errors. Debounce is empirically ~30 seconds for Motilal's session state to settle (line 112 comment):
     ```javascript
     const now = Date.now();
     const sinceLast = now - lastConnectAtRef.current;
     if (sinceLast < _MOTILAL_CONNECT_COOLDOWN_MS) {
       const wait = Math.ceil((_MOTILAL_CONNECT_COOLDOWN_MS - sinceLast) / 1000);
       showAlert('warning', 'Please wait', ...);
       return;
     }
     ```
   - Validate form fields: `!userDetails?._id || !apiKey || !clientCode` (line 138). If invalid, show error and return.
   - Record connection attempt timestamp (line 142): `lastConnectAtRef.current = now`.
   - Encrypt apiKey using `CryptoJS.AES.encrypt(apiKey, 'ApiKeySecret')` (line 145).
   - Construct request body (lines 143-152):
     ```javascript
     {
       uid: userDetails?._id,
       apiKey: checkValidApiAnSecret(apiKey),  // encrypted
       user_broker: 'Motilal Oswal',
       clientCode: clientCode,  // NOT encrypted
       redirect_url: `${configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL.replace('https://', '')}`,
     }
     ```
   - PUT to `${server.server.baseUrl}api/motilal-oswal/update-key` (line 154) with encrypted payload.
   - Headers (lines 155-162):
     ```javascript
     {
       'Content-Type': 'application/json',
       'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
       'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
     }
     ```
   - Backend returns `response.data.response` containing the OAuth login URL (line 166).
   - `setAuthUrl(response.data.response)` and `setShowWebView(true)` (lines 166-167).
6. WebView opens at the OAuth URL (rendered in MotilalConnectUI).
7. User authenticates with Motilal broker portal and grants OTP (outside app).
8. Motilal redirects to `${REACT_APP_BROKER_CONNECT_REDIRECT_URL}?accessToken=<TOKEN>` (OAuth callback).
9. WebView's `onNavigationStateChange` handler (lines 179-195) fires.
10. Handler checks if URL includes `accessToken=` (line 183).
11. If matched, parse query string (line 184) and extract `accessToken` (line 187).
12. If accessToken is present (line 188), set it in state (line 190) and close WebView (line 191).
13. `useEffect` at line 297-301 watches `userId` and `jwtToken`. When both are available, trigger `connectBrokerDbUpdate()` (line 299).
14. Inside `connectBrokerDbUpdate` (lines 198-295):
    - Toast flag check (line 199): if `jwtToken && !isToastShown.current`, proceed.
    - Set toast flag (line 200): `isToastShown.current = true` to prevent duplicate calls.
    - Construct broker data (lines 201-208):
      ```javascript
      {
        uid: userId,
        jwtToken: jwtToken,  // from WebView callback
        apiKey: checkValidApiAnSecret(apiKey),  // re-encrypt
        user_broker: 'Motilal Oswal',
        clientCode: clientCode,
        redirectUrl: configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL,
      }
      ```
    - PUT to `${server.server.baseUrl}api/user/connect-broker` (line 211) to persist to MongoDB.
    - Headers (lines 212-218): same as above.
15. SDK dual-write (lines 229-235) if SDK bridge is enabled:
    ```javascript
    if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
      sdkDualWriteSafely(
        sdkConnectBroker(sdkBridge.client, 'Motilal Oswal', brokerData),
        'Motilal Oswal',
        'connect',
      );
    }
    ```
16. Optional model-portfolio refresh (lines 238-251) — non-critical.
17. Close modal and broker modal (lines 253-254).
18. Post-success steps (lines 259-272) wrapped in async try-catch:
    - Await `fetchBrokerStatusModal()` to refresh broker status.
    - Emit refreshEvent (line 262).
    - Show "Connected Successfully" toast if no migration sheet will display (line 263-264).
19. On error (catch at line 274):
    - Extract message from response (lines 276-280).
    - Show error alert with HTTP or network distinction (lines 281-292).
20. **Reauth handling (lines 317-325):** If `reauthConfig` is passed and `isVisible` is true, pre-fill the form:
    ```javascript
    if (!isVisible || !reauthConfig || reauthHydratedRef.current) return;
    if (!reauthConfig.authUrl || !reauthConfig.apiKey) return;
    reauthHydratedRef.current = true;
    setApiKey(reauthConfig.apiKey);
    if (reauthConfig.clientCode) setClientCode(reauthConfig.clientCode);
    setAuthUrl(reauthConfig.authUrl);
    setShowWebView(true);
    ```
21. **WebView error recovery (lines 327-344):** `handleRequestRestart` callback (passed to MotilalConnectUI as `onRequestRestart`, line 366):
    - Called by the UI's "Restart connection" button when the WebView errored AFTER Motilal's page loaded.
    - Closes the WebView (line 340).
    - Wipes stored authUrl, jwtToken, and toast flag (lines 341-343) to force a full re-auth on next Connect tap.
    - The 30s debounce (lines 116-136) still applies, protecting against rapid Restart→Connect loops.

**Encryption:**
- **CryptoJS.AES.encrypt(apiKey, 'ApiKeySecret')** (line 145, line 204 for persist).
- clientCode is NOT encrypted.
- The encrypted apiKey is persisted to MongoDB and sent to the backend in plaintext (the backend decrypts with the same passphrase).

**Auth header construction:**
- Standard AlphaQuark app header: `aq-encrypted-key` token from `generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)`.
- Advisor subdomain: `X-Advisor-Subdomain: configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain()` (line 157, line 214) — multi-tenant routing.
- Standard `Content-Type: application/json`.

**IP-whitelist gate:**
- **Yes.** Line 120 checks `if (!egressReady)` and returns early with an alert directing the user to claim an IP.
- EgressIpCallout component (imported at line 76 from elsewhere) manages the IP-claim UX.
- `egressReady` is a state prop (line 369) passed from the MotilalConnectUI component.

**Reauth handling:**
- **Yes.** `reauthConfig` prop is accepted (line 30).
- Pre-fill at lines 317-325: copies `reauthConfig.apiKey` → `apiKey`, `reauthConfig.clientCode` → `clientCode`, `reauthConfig.authUrl` → `authUrl`, and auto-opens the WebView.
- The reauth hydration runs once per modal open (protected by `reauthHydratedRef.current`).

**Help content:**
From `MotilalHelpContent.js`:
- YouTube video ID: `gGKedxU-sQ0` (line 22).
- Steps 1-2 always visible (lines 27-36): visit motilaloswal.com, click Customer Login → Older Version.
- Steps 3-8 are expanded-only (lines 44-80):
  - Step 3: Click Profile Icon for Client Code.
  - Step 4: Click hamburger menu.
  - Step 5: Select "Trading API".
  - Step 6: Click "Create an API Key", enter app name (defaults to `Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'`, line 61), and paste the hardcoded Redirect URL `https://ccxtprod.alphaquark.in/motilal-oswal/callback` (line 65).
  - Step 7: Copy API Key and Client Code.
  - Step 8: Paste into the app.
- Redirect URL is hardcoded in help content (line 65), matching the broker's API requirement.

**Broker-specific quirks:**
- **30-second session-affinity debounce** (lines 116-136) — Motilal binds OTP + Authorization header + page session to a single page-load. Production incident 2026-04-25: user fired 4 logins in 4 minutes and got multiple failure modes (see comment lines 105-115). The debounce is empirically sufficient for Motilal's session state to settle.
- **`handleRequestRestart` callback** (lines 339-344) — allows the WebView error UI to force a full session reset by wiping stored authUrl + token.
- **clientCode is NOT encrypted** — only apiKey is encrypted with `CryptoJS.AES.encrypt(apiKey, 'ApiKeySecret')`.
- **Two-step credential collection + OAuth** — user enters apiKey + clientCode, backend calls `/api/motilal-oswal/update-key` to mint OAuth URL, then WebView opens for OTP auth.
- **Direct accessToken in callback** — unlike some brokers that return an OAuth `code` requiring a separate `/gen-access-token` exchange, Motilal returns the final `accessToken` directly in the callback URL (line 183).

**Backend Node routes:**
- `PUT /api/motilal-oswal/update-key` (line 154) — takes encrypted apiKey + clientCode, returns OAuth login URL.
- `PUT /api/user/connect-broker` (line 211) — persists to MongoDB.

**ccxt-india routes:**
- None explicitly called from the modal. The `/api/motilal-oswal/update-key` backend route calls ccxt-india's `/motilal-oswal/login` or equivalent (assumed; verify in aq_backend_github).

### SDK flow (Phase 3)

**Schema row:**
From `PHASE3_BROKER_AUDIT.md` line 43:
```
| Motilal Oswal | `Motilal` | `Motilal Oswal` | `MotilalModal.js` | **SDK-with-gap** — 30s session-affinity debounce + Restart-on-WebView-error callback |
```

Schema from SDK broker registry — currently set to `flow=credentials_totp, fields=[apiKey, apiSecret, userId, password, totpSecret]` (per line 293 audit note). **But legacy collects only `apiKey + clientCode`, NOT `apiSecret, userId, password, totpSecret`.** This is a critical schema mismatch.

**Phase3SdkBrokerModal handling:**
- When `SDK_ELIGIBLE_MODALS.has('Motilal')` is true (line 59 BrokerConnectModalDispatch.js), the modal is routed to `Phase3SdkBrokerModal`.
- `Phase3SdkBrokerModal` at line 143-145 maps 'Motilal' → 'Motilal Oswal' (wire-name) via `visibleModalToBrokerName` (line 120).
- Form instantiation: if schema is `flow=credentials_totp, fields=[apiKey, apiSecret, userId, password, totpSecret]`, the form collects all five fields. But the legacy modal only collects two (apiKey, clientCode). **Mismatch.**
- After form submit, the SDK calls `client.updateBrokerCredentials` (per brokerSdkBridge.js line 78) to POST to `/sdk/v1/connections/Motilal Oswal/update-credentials`.
- If schema is `flow=oauth`, the form hands off to `WebViewBrokerAuthFlow` for the OAuth round-trip.

**Backend SDK route:**
- `/sdk/v1/connections/Motilal Oswal/update-credentials` — should accept the form fields and call backend `/api/motilal-oswal/update-key` to mint the OAuth URL, then return it to the SDK.
- `/sdk/v1/connections/Motilal Oswal/exchange-token` — should accept the `accessToken` query param (from the callback) and persist to MongoDB via the same path as legacy `/api/user/connect-broker`.

**ccxt-india proxy target:**
- Backend SDK route must eventually call ccxt-india's `/motilal-oswal/login` or equivalent to mint the OAuth URL (same as legacy backend).

**SDK widget API surface:**
- `BrokerCredentialForm` with schema-defined fields (currently mis-configured).
- `WebViewBrokerAuthFlow` with redirect-URL intercept.
- No 30-second session-affinity debounce in SDK.
- No `handleRequestRestart`-style WebView error callback.
- No reauthConfig pre-fill (not supported by SDK widgets today).

### Touchpoint comparison table

| Touchpoint | Legacy (MotilalModal.js) | SDK (Phase3SdkBrokerModal + SDK widgets) | Gap Status |
|------------|-------------------------|----------------------------------------|-----------|
| Entry point dispatch | BrokerConnectModalDispatch → MotilalModal | BrokerConnectModalDispatch → Phase3SdkBrokerModal | ✅ Dispatch consistent |
| Credential fields | `[apiKey, clientCode]` (lines 35-36) | SDK schema: `[apiKey, apiSecret, userId, password, totpSecret]` (mismatch) | ❌ Schema mismatch — SDK collects more fields |
| Field validation | `!userDetails?._id || !apiKey || !clientCode` (line 138) | SDK form validation per schema | ⚠️ May accept invalid states |
| Encryption | `CryptoJS.AES.encrypt(apiKey, 'ApiKeySecret')` (line 145) | SDK encryption via `encryptField` (Phase3SdkBrokerModal.js:102-103) | ✅ Same passphrase |
| Credential submission | PUT `/api/motilal-oswal/update-key` (line 154) | SDK `/update-credentials` → backend proxy | ⚠️ Must route to same `/update-key` endpoint |
| OAuth URL response | `response.data.response` (line 166) | SDK expects structured response with `authUrl` | ⚠️ Response format may differ |
| WebView URL set | `setAuthUrl(response.data.response)` → `setShowWebView(true)` (lines 166-167) | `WebViewBrokerAuthFlow` auto-opens WebView | ✅ Behavior aligned |
| OAuth callback intercept | `onNavigationStateChange` checks `accessToken=` (line 183) | `WebViewBrokerAuthFlow` generic intercept | ⚠️ SDK must extract `accessToken` from callback |
| AccessToken capture | Store in state (line 190): `setjwtToken(accessToken)` | SDK exchanges at `/exchange-token` | ⚠️ SDK path must accept `accessToken` param |
| Token persistence | PUT `/api/user/connect-broker` (line 211) | SDK `/exchange-token` → MongoDB persist | ✅ Same MongoDB path |
| IP-whitelist gate | EgressIpCallout gate (line 120 check of `egressReady`) | Phase3SdkBrokerModal gates on IP (line 83, `IP_WHITELIST_BROKERS` does NOT include 'Motilal') | ❌ Divergence — legacy GATES, SDK does NOT gate |
| Session-affinity debounce | 30-second cooldown (lines 116-136, _MOTILAL_CONNECT_COOLDOWN_MS = 30s) | SDK has no equivalent | ❌ SDK missing 30s debounce |
| WebView error recovery | `handleRequestRestart` callback (lines 339-344) | SDK has no equivalent | ❌ SDK missing error recovery callback |
| Reauth pre-fill | `reauthConfig` hydration (lines 317-325) | SDK does NOT support reauthConfig | ❌ Reauth pre-fill missing in SDK |
| User broker name | 'Motilal Oswal' | 'Motilal Oswal' (wire-name) | ✅ Aligned |
| Encryption passphrase | 'ApiKeySecret' | 'ApiKeySecret' (phase3SdkBrokerModal.js:103) | ✅ Aligned |
| Redirect URL | Read from env (line 151), stripped of protocol | Read from env (phase3SdkBrokerModal.js:91-93) | ✅ Aligned |
| Model-portfolio refresh | Non-critical post-success (lines 238-251) | SDK does NOT auto-refresh | ⚠️ May need manual refresh |
| Post-success toast | "Connected Successfully" (line 264) | SDK widget's success toast | ⚠️ Copy may differ |
| Error handling | HTTP vs network distinction (lines 276-292) | SDK error envelope | ⚠️ Message format may differ |

### Gap fix plan

**Gap 1: SDK schema mismatch** (File: `@alphaquark/mobile-sdk` → `brokerFormSchema.ts`)
- Current: `flow=credentials_totp, fields=[apiKey, apiSecret, userId, password, totpSecret]`.
- Fix: Determine which fields Motilal's API actually requires today:
  - Legacy collects: `apiKey`, `clientCode`.
  - Help content references: API Key, Client Code.
  - No mention of `apiSecret`, `userId`, `password`, `totpSecret`.
- Change schema to: `flow=credentials, fields=[apiKey, clientCode]` matching legacy.
- Verify with Motilal broker API documentation.
- Effort: Low (schema row change in SDK package) + verification.

**Gap 2: Missing 30-second session-affinity debounce** (File: `@alphaquark/mobile-sdk` → `BrokerCredentialForm` or SDK app-side wrapper)
- Current: SDK has no debounce; legacy enforces 30 seconds (lines 116-136).
- Fix approach:
  - Option A (SDK-side): Add a `submitCooldownMs` field to the schema or broker config, and SDK respects it before dispatching `updateBrokerCredentials` or `connectBroker`.
  - Option B (App-side): Phase3SdkBrokerModal wraps the form's `onContinue` callback with a 30-second debounce gate specific to Motilal.
- Effort: Medium (SDK schema extension + wrapper logic).

**Gap 3: Missing `handleRequestRestart` WebView error callback** (File: `@alphaquark/mobile-sdk` → `WebViewBrokerAuthFlow`)
- Current: SDK has no mechanism to reset auth state when the WebView errors.
- Fix: SDK's `WebViewBrokerAuthFlow` needs a callback prop (e.g., `onWebViewError`) that the app can use to reset Motilal's authUrl + token state.
- Alternatively: Phase3SdkBrokerModal detects WebView errors and calls a reset function.
- Effort: Medium (SDK API extension + app-side handler).

**Gap 4: IP whitelist gate not enforced in SDK** (File: `Phase3SdkBrokerModal.js`)
- Current: Motilal is NOT in `IP_WHITELIST_BROKERS` (line 83-89), but legacy MotilalModal DOES gate on `egressReady`.
- Fix: Add 'Motilal' or 'Motilal Oswal' to `IP_WHITELIST_BROKERS` (line 83).
- Verify: Ensure EgressIpCallout renders for Motilal and user can claim IP (line 148+ in Phase3SdkBrokerModal).
- Effort: Low (set membership change).

**Gap 5: Reauth pre-fill missing in SDK** (Architectural SDK gap)
- Current: SDK `BrokerCredentialForm` cannot accept `reauthConfig` props to pre-fill form fields.
- Fix: Cross-cutting SDK gap affecting multiple brokers (Upstox, ICICI, HDFC, Motilal, Fyers). Mitigated today by routing all reauth flows to legacy via `isReauthFlow` short-circuit in BrokerConnectModalDispatch (line 100+ — verify).
- Effort: High (SDK widget API extension).

**Gap 6: Backend `/sdk/v1/connections/Motilal Oswal/exchange-token` must accept `accessToken` query param** (File: `aq_backend_github/Routes/sdk/v1/connections.js`)
- Current: Legacy receives `accessToken` directly in the OAuth callback (line 183). SDK exchange-token route must handle this.
- Fix: Backend route must not assume an OAuth `code` param. For Motilal, accept `accessToken` directly and skip the `/gen-access-token` call (since Motilal returns the final token, not a code).
- Effort: Low (conditional logic in exchange-token dispatcher).

### Verdict

**SDK-with-gap.**

**Reasoning:** Motilal Oswal's legacy flow is credential-based OAuth with two fields (apiKey, clientCode) collected before OAuth. The SDK widget family supports credential-form → OAuth flows via `flow=credentials, fields=[...]`. However, five gaps block migration:

1. **SDK schema is mismatched** — currently lists 5 fields (`apiSecret, userId, password, totpSecret`) that legacy never collects. Must be verified against live broker API and corrected to `[apiKey, clientCode]`.

2. **Missing 30-second session-affinity debounce** — Motilal strictly enforces session state isolation. Back-to-back logins cause "Authorization Invalid" errors. The SDK widget has no debounce; either the SDK must support per-broker cooldowns or Phase3SdkBrokerModal must wrap the submit with a 30s gate.

3. **Missing `handleRequestRestart` WebView error callback** — when the WebView errors after Motilal's page loads, the session is rotated and reload compounds the problem. Legacy closes the WebView and wipes state to force a full re-auth. SDK has no callback for this; either the SDK or Phase3SdkBrokerModal must detect WebView errors and reset Motilal's auth state.

4. **IP whitelist gate not enforced** — Motilal's API requires calls from whitelisted IPs. Legacy gates on `egressReady`. Phase3SdkBrokerModal does NOT include Motilal in `IP_WHITELIST_BROKERS`, so the SDK version will not gate. Add Motilal to the set.

5. **Backend `/exchange-token` must accept `accessToken` directly** — Motilal returns the final accessToken in the callback, not an OAuth code. Backend must handle this non-standard shape.

6. **Reauth pre-fill missing in SDK** — cross-cutting gap. Motilal accepts `reauthConfig` pre-fill (lines 317-325); SDK doesn't support it yet.

Once these gaps close (primarily schema alignment, debounce implementation, error callback, and IP gate), Motilal is a solid SDK-with-gap → SDK-clean candidate.

---


---

## 11. HDFC Securities

### Legacy flow (production path)

**Entry points:**
- `BrokerConnectModalDispatch` (line 144: `case 'HDFC': return <HDFCconnectModal {...commonProps} />;`)
- Inline render sites dispatch through same normalization (line 90: `if (trimmed === 'Hdfc Securities' || trimmed === 'HDFC Securities') return 'HDFC';`)

**Form fields:**
- `apiKey` (password-hidden, line 34 `setApiKey`, line 349 rendered with `TextInput`)
- `secretKey` (password-hidden, line 33 `setSecretKey`, line 351 rendered)
Both collected via UI component `HDFCConnectUI` and validated client-side before submission.

**Step-by-step flow:**

1. Modal opens, `isVisible` triggers render (line 279–286)
2. User enters `apiKey` and `secretKey` into form fields (HDFCConnectUI lines 349–351)
3. Smart-reauth hydration checks `reauthConfig` and pre-fills creds if present (lines 290–300: `if (!isVisible || !reauthConfig || reauthHydratedRef.current) return;` then `setApiKey(reauthConfig.apiKey)` line 296)
4. User taps "Initiate Auth" button → `initiateAuth()` called (line 359)
5. EgressIpCallout gate checks `egressReady` state; if false, flashes `unmetAck` alert and returns early (lines 303–305: `if (!egressReady) { setUnmetAck(true); return; }`)
6. `initiateAuth()` encrypts both keys with `checkValidApiAnSecret()` (lines 309–310, which calls `CryptoJS.AES.encrypt(details, 'ApiKeySecret')` per line 45)
7. POST to `${server.server.baseUrl}api/hdfc/update-key` with encrypted `{uid, apiKey, secretKey, user_broker: 'Hdfc Securities'}` (lines 313–327)
8. Backend returns `{response: authUrl}` (line 332, stored in `setAuthUrl`)
9. WebView opens at `authUrl` (line 333: `setShowWebView(true)`)
10. User logs in and authorizes on HDFC's InvestRight portal
11. Portal redirects to callback URL with `requestToken=` query param
12. `handleWebViewNavigationStateChange` fires (line 109)
13. Parses URL query string (lines 113–116): `parseQueryString(queryString)` extracts `requestToken` value
14. Checks for `requestToken=` in URL (line 113: `if (url.includes('requestToken=')`)
15. Stores `requestToken` in state (line 120: `setHdfcRequestToken(requestToken)`)
16. Closes WebView (line 121: `setShowWebView(false)`)
17. `useEffect` detects `hdfcRequestToken` and `apiKey` both set (line 167–171), calls `connectHdfc()`
18. `connectHdfc()` POSTs to `${server.ccxtServer.baseUrl}hdfc/access-token` with `{user_email, apiKey, apiSecret: secretKey, requestToken}` (line 139, line 134)
19. Backend exchanges `requestToken` for `accessToken` and returns `{accessToken: session_token}` (line 155)
20. Stores `session_token` in state (line 156: `setHdfcSessionToken(session_token)`)
21. `useEffect` detects `hdfcSessionToken` is set (line 272–275), calls `connectBrokerDbUpdate()`
22. Encrypts keys again (line 181: `checkValidApiAnSecret(apiKey)` and `checkValidApiAnSecret(secretKey)`)
23. PUT to `${server.server.baseUrl}api/user/connect-broker` with `{uid, user_broker: 'Hdfc Securities', jwtToken: session_token, apiKey: encrypted, secretKey: encrypted}` (line 186)
24. On success, emits `refreshEvent` with source 'HDFC Securities broker connection' (line 237)
25. Calls `fetchBrokerStatusModal()` to refresh connected brokers list (line 236)
26. Closes modal (line 228–229)

**Encryption:**
- `CryptoJS.AES.encrypt(details, 'ApiKeySecret')` envelope for apiKey and secretKey (line 45: `const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');`)
- Applied at `initiateAuth()` step (line 309–310 for update-key call)
- Applied again at `connectBrokerDbUpdate()` step (line 181–182 for connect-broker persistence)
- Both legacy backend routes (`/api/hdfc/update-key` and `/api/user/connect-broker`) expect and decrypt with same passphrase

**Auth header construction:**
- `'Content-Type': 'application/json'`
- `'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain()`
- `'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)` (SecurityTokenManager pattern, line 86–89)
Used in all three HTTP calls (update-key, access-token, connect-broker)

**IP-whitelist gate:**
- EgressIpCallout component renders in HDFCConnectUI (passed `egressReady`, `setEgressReady`, `egressUserId`, `egressUserEmail` via props lines 364–368)
- Gate enforced at submit: "if (!egressReady) { setUnmetAck(true); return; }" (line 303–305)
- User must claim a static IP on the IP-whitelist panel, whitelist it on HDFC InvestRight "Allowed IPs" field, and tick acknowledgment checkbox before Connect button is active

**Reauth handling:**
- `reauthConfig` prop accepted (line 27)
- Pre-fill hydration: `if (!isVisible || !reauthConfig || reauthHydratedRef.current) return;` (line 291)
- Checks shape: `if (!reauthConfig.authUrl || !reauthConfig.apiKey || !reauthConfig.secretKey)` (line 292)
- Sets `setApiKey(reauthConfig.apiKey)`, `setSecretKey(reauthConfig.secretKey)`, `setAuthUrl(reauthConfig.authUrl)` (lines 296–298)
- Skips form and jumps straight to WebView (line 299: `setShowWebView(true)`)
- Only fires once per mount due to `reauthHydratedRef` guard (line 289: `const reauthHydratedRef = useRef(false);` and line 295: `reauthHydratedRef.current = true;`)

**Help content:**
- YouTube ID: `XFLjL8hOctI` (line 22 of HDFCHelpContent.js)
- 5-step process (collapsed: steps 1–2; expanded: steps 3–5)
- Collapsed steps: "Go to https://developer.hdfcsec.com/" + "Log in with your ID, password, and OTP."
- Expanded step 3 critical string: "Accept the *Risk Disclosure *." (line 43)
- Expanded step 4 critical string: "Click *Create* to make a new app. Enter app name, paste your dedicated static IP (claimed in the IP-whitelist panel above) into the "Allowed IPs" field on the InvestRight app form — HDFC rejects orders from non-whitelisted IPs. Set the redirect URL to: {brokerConnectRedirectURL} and description, then click *Create *." (line 46–52)
- Expanded step 5: "Copy the *API* and *Secret Key* and paste them into the {REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'} platform to connect your broker." (line 55–57)

**Broker-specific quirks:**
- Returns `requestToken` instead of OAuth `code`; non-standard query param (line 113: `if (url.includes('requestToken=')`)
- CCXT-india `hdfc/access-token` endpoint handles the exchange (line 139: `${server.ccxtServer.baseUrl}hdfc/access-token`)
- Standard 3-phase flow: mints authUrl → user logs in → exchanges requestToken for accessToken → saves to DB
- No OAuth library dependency; raw WebView URL navigation (line 361: `handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}`)

**Backend Node routes:**
- `/api/hdfc/update-key` — POST (line 315): accepts encrypted apiKey + secretKey, returns authUrl. File:line in aq_backend_github would be `Routes/hdfc/` or `Routes/HdfcRoutes.js`
- `/api/user/connect-broker` — PUT (line 186): persists jwtToken + encrypted apiKey/secretKey to user's broker record. Common route across all credential brokers.

**ccxt-india routes:**
- `POST /hdfc/access-token` (line 139): accepts `{user_email, apiKey, apiSecret, requestToken}`, exchanges requestToken for accessToken via HDFC InvestRight API, returns `{accessToken: ...}`

### SDK flow (Phase 3)

**Schema row:**
From PHASE3_BROKER_AUDIT.md line 307: "HDFC Securities — SDK-clean (subject to emulator verification)"
SDK BrokerName: `Hdfc Securities` (per visibleModalToBrokerName line 118 of Phase3SdkBrokerModal.js)
Expected schema: `flow=oauth, fields=[apiKey, secretKey], submitEndpoint=login-url`

**Phase3SdkBrokerModal handling:**
- Dispatch via `BrokerConnectModalDispatch` detects `useSdkBrokerFlow() && !isReauthFlow && SDK_ELIGIBLE_MODALS.has(key)` (line 123–129)
- Not in `SDK_ELIGIBLE_MODALS` set today (empty per line 58: `new Set([])`) so legacy path taken
- If promoted to allowlist, modal would NOT be in `IP_WHITELIST_BROKERS` set at Phase3SdkBrokerModal line 83–89, but PHASE3_BROKER_AUDIT line 325 flags this gap: "Phase3SdkBrokerModal does NOT include HDFC in IP_WHITELIST_BROKERS today. Legacy DOES gate on egressReady. If HDFC needs IP whitelist, Phase3SdkBrokerModal IP_WHITELIST_BROKERS set must be extended."
- Form phase uses `BrokerCredentialForm` with `broker="Hdfc Securities"` (Phase3SdkBrokerModal line 291)
- On OAuth trigger, `WebViewBrokerAuthFlow` opens with `redirectUrl=Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL` (line 223)
- Expects backend to POST `/sdk/v1/connections/Hdfc Securities/login-url` and `/sdk/v1/connections/Hdfc Securities/exchange-token`

**Backend SDK route:**
SDK dispatch would be in `aq_backend_github/Routes/sdk/v1/connections.js`. Expected behavior per Phase3SdkBrokerModal line 41–42:
- `POST /sdk/v1/connections/Hdfc Securities/login-url` → proxies to `/api/hdfc/update-key` (or equivalent CCXT route)
- `POST /sdk/v1/connections/Hdfc Securities/exchange-token` → accepts `requestToken` query param (line 323 of PHASE3_BROKER_AUDIT: "backend `/sdk/v1/connections/Hdfc Securities/exchange-token` must accept `requestToken` query param and proxy to ccxt `hdfc/access-token`")

**ccxt-india proxy target:**
- `POST /hdfc/access-token` — same as legacy flow (line 139 of HDFCconnectModal)
- Backend SDK route must construct the call with `apiKey`, `apiSecret`, `requestToken` extracted from the SDK form + exchange body

**SDK widget API surface:**
- `BrokerCredentialForm` contract: `broker="Hdfc Securities"`, `encrypt=encryptField` (CryptoJS per line 102–103), `onContinueToOauth` callback, `onSuccess` callback, `onError` callback
- `WebViewBrokerAuthFlow` contract: `broker="Hdfc Securities"`, `redirectUrl`, `extraExchangeBody` (containing apiKey + secretKey), `onSuccess`, `onError`, `onClose`
- No IP-whitelist gate in SDK today; Phase3SdkBrokerModal would need to extend `IP_WHITELIST_BROKERS` to include `Hdfc Securities`

### Touchpoint comparison table

| Touchpoint | Legacy | SDK | Gap | Status |
|-----------|--------|-----|-----|--------|
| Form apiKey collection | HDFCConnectUI TextInput | BrokerCredentialForm (SDK schema) | Schema must define both apiKey + secretKey fields | ⚠️ |
| Form secretKey collection | HDFCConnectUI TextInput | BrokerCredentialForm (SDK schema) | Schema must define both apiKey + secretKey fields | ⚠️ |
| Encryption envelope | CryptoJS.AES.encrypt(..., 'ApiKeySecret') | encryptField (same envelope) | Identical; no gap | ✅ |
| Update-key call | POST /api/hdfc/update-key | POST /sdk/v1/connections/Hdfc Securities/login-url (proxies to /api/hdfc/update-key) | Backend proxy must exist | ⚠️ |
| Mint authUrl | /api/hdfc/update-key returns {response: authUrl} | Backend /login-url proxies same | Same endpoint | ✅ |
| WebView open | Explicit setShowWebView(true) after update-key | WebViewBrokerAuthFlow fires on onContinueToOauth | Automatic; no user-visible diff | ✅ |
| RequestToken extraction | onNavigationStateChange parses URL | WebViewBrokerAuthFlow's internal interception | SDK widget must capture requestToken, not generic code | ⚠️ |
| RequestToken exchange | POST /hdfc/access-token (ccxt-india) | POST /sdk/v1/connections/Hdfc Securities/exchange-token (SDK route proxies to ccxt) | Backend must map requestToken → /hdfc/access-token | ⚠️ |
| Access token storage | setHdfcSessionToken state | SDK result contract | SDK returns response to onSuccess callback | ✅ |
| Broker connect-broker persist | PUT /api/user/connect-broker + SDK dual-write | SDK route directly persists via /api/user/connect-broker | Same persistence target | ✅ |
| Model portfolio refresh | POST /rebalance/change_broker_model_pf (non-critical) | Same call, SDK modal omits this (Phase3SdkBrokerModal doesn't call it) | SDK doesn't refresh model portfolio; user must manually sync | ⚠️ |
| Post-success refresh | fetchBrokerStatusModal() → emit refreshEvent | SDK onSuccess calls fetchBrokerStatusModal() | Same contract | ✅ |
| Reauth pre-fill | reauthConfig hydration (creds + authUrl) | BrokerCredentialForm cannot accept pre-fill | SDK BrokerCredentialForm has no pre-fill API | ❌ |
| Reauth WebView skip | Pre-filled authUrl jumps straight to setShowWebView(true) | Form always renders, user re-enters creds | User friction on reauth; form skip lost | ❌ |
| IP-whitelist gate | EgressIpCallout with egressReady state gate | Phase3SdkBrokerModal IP_WHITELIST_BROKERS set (HDFC not included) | HDFC must be added to set to gate on IP claim | ❌ |
| Error handling (4xx/5xx) | Two-level: authUrl error codes + connection-broker HTTP-vs-network | SDK onError callback + Phase3SdkBrokerModal displays error inline | SDK error codes may differ; user-facing text loses legacy granularity | ⚠️ |
| Unmet IP ack flash | setUnmetAck(true) triggers visual alert for 2.5s | EgressIpCallout onUnmetAckHandled | Same UX; no gap | ✅ |

### Gap fix plan

1. **Backend SDK route for login-url** (file:line in aq_backend_github `Routes/sdk/v1/connections.js`)
   - Add Hdfc Securities case to dispatch
   - Accept `apiKey`, `secretKey` from request body
   - Call `/api/hdfc/update-key` or proxy directly to HDFC portal
   - Return `{data: {redirectURL: authUrl}}`
   - Dependency: none; legacy route exists

2. **Backend SDK route for exchange-token**
   - Accept `requestToken` query param (or body field) in addition to generic `code` param
   - Route HDFC case to ccxt-india `/hdfc/access-token` with reconstructed `{apiKey, apiSecret, requestToken}`
   - Return `{data: {accessToken: ...}}`
   - Dependency: none; ccxt endpoint exists

3. **Extend IP_WHITELIST_BROKERS in Phase3SdkBrokerModal.js**
   - Line 83–89: add `'Hdfc Securities'` to set
   - Update Phase3BrokerHelp.js to render HDFC help content
   - Dependency: help content already exists (HDFCHelpContent.js)

4. **Model portfolio refresh** (optional but user-visible feature)
   - Phase3SdkBrokerModal.onSuccess could call `/rebalance/change_broker_model_pf` before dismissing
   - Dependency: non-critical; can be deferred

5. **Reauth pre-fill** (cross-cutting gap, deferred for now)
   - BrokerCredentialForm SDK contract doesn't support pre-fill
   - Legacy reauth flows continue to use legacy modals (isReauthFlow short-circuit in BrokerConnectModalDispatch line 122)
   - No HDFC-specific action needed

### Verdict

**SDK-clean subject to three conditions:**

1. **Backend `/sdk/v1/connections/Hdfc Securities/login-url` and `exchange-token` routes implemented and tested** — the routes must correctly proxy to legacy endpoints and CCXT. Legacy modal calls `/api/hdfc/update-key` and ccxt `/hdfc/access-token`; SDK routes must forward those calls with the same signature.

2. **Phase3SdkBrokerModal.IP_WHITELIST_BROKERS extended to include 'Hdfc Securities'** — legacy HDFCconnectModal gates on egressReady (line 303–305), and that gate is critical because HDFC rejects orders from non-whitelisted IPs. Phase3SdkBrokerModal currently omits HDFC from the IP-whitelist set (line 83–89), which would disable the gate for SDK users. Must add.

3. **End-to-end emulator verification through Phase3SdkBrokerModal** — the legacy modal has been in production for years; the SDK path is new. Form entry → auth URL minting → WebView redirect → requestToken capture → access-token exchange → broker persistence must all work on emulator. No prior SDK end-to-end verification documented.

HDFC is the closest broker to SDK-clean migration. All gaps are resolvable with no SDK-package changes. The legacy modal is solid; the OAuth shape is standard. IP-whitelist gate + requestToken exchange are the only Hdfc-specific deviations from generic OAuth, both addressable in backend dispatch. Promote from **SDK-clean** to `SDK_ELIGIBLE_MODALS` only after (1) backend routes land, (2) IP gate is enabled, (3) emulator E2E passes.

---

## 12. Groww

### Legacy flow (production path)

**Entry points:**
- `BrokerConnectModalDispatch` dispatch (line 154–155: `case 'Groww': return <GrowwConnectModal {...commonProps} />;`)

**Form fields:**
- **apiKey** — JWT-style TOTP Token from Groww dialog top (line 58: `const [apiKey, setApiKey]`, line 426: `TextInput` with placeholder "Paste the JWT (eyJraWQi…) from the TOP of Groww's dialog")
  - Validation: non-empty check (line 120: `if (!trimmedApiKey || !trimmedToken)`)
  - Encryption: `encryptForTransport(trimmedApiKey)` → `CryptoJS.AES.encrypt(plain, 'ApiKeySecret').toString()` (line 44)
  - User-facing label: "TOTP Token (used as API Key) *" (line 424)
  - Helper text: "The long JWT-style value labelled "TOTP Token" at the TOP of Groww's "Generate TOTP token" dialog — Groww uses this as the Bearer token. Not the Base32 secret below the QR (that goes in the next field)." (line 435–439)

- **totpToken** — ~32-char Base32 secret string from below QR code, NOT JWT (line 59: `const [totpToken, setTotpToken]`, line 443: `TextInput` with placeholder "Paste the ~32-char Base32 secret below the QR (A–Z, 2–7)")
  - Validation: non-empty check (line 120)
  - Encryption: `encryptForTransport(trimmedToken)` → same `CryptoJS.AES.encrypt` (line 136: `totp_seed: encryptForTransport(trimmedToken)`)
  - User-facing label: "TOTP QR Secret (Base32) *" (line 442)
  - Helper text: "The ~32-character Base32 secret shown BELOW the QR code on Groww's "Generate TOTP token" dialog. Stored encrypted; never shown back to you. If the secret is ever revoked on Groww, generate a new one and reconnect here." (line 453–459)
  - Critical string at lines 348–356: "Groww's "TOTP token" dialog shows two values — both are needed, both come from this single dialog: [bullet] JWT at the top (starts with eyJraWQi…) → paste into our "TOTP Token (used as API Key)" field below. Groww uses this as the Bearer token. [bullet] Base32 secret below the QR (~32 chars, A–Z and 2–7, e.g. HYSRYAALJ3NPKVQH2K4VW4FQH4AKEENP) → paste into our "TOTP QR Secret (Base32)" field below. Our backend uses it to mint a fresh 6-digit TOTP every daily refresh."

**Step-by-step flow:**

1. Modal opens via `GrowwConnectModal` component (line 48–53 props)
2. Fetch user details on mount (lines 89–99: `useEffect` calls `getUser` endpoint, stores `_id` in `userId`)
3. User enters apiKey (JWT from Groww dialog top) into first field (line 426)
4. User enters totpToken (Base32 secret from below QR) into second field (line 443)
5. User taps "Read More" toggle to expand help content (line 397–409, controls `helpExpanded` state)
6. Help panel shows inline 4-step guide (lines 292–383 of GrowwConnectModal):
   - Step 1: Open Groww's Trade API page (line 299–306, clickable link to `groww.in/trade-api/api-keys`)
   - Step 2: Click "Generate API key" → "Generate TOTP token" (line 314–325, explains the dialog)
   - Step 3: Copy both values from single dialog (line 334–361, emphasizes JWT at top and Base32 below QR)
   - Step 4: Click "Update static IP" and whitelist dedicated IP (line 369–380, references EgressIpCallout IP shown below)
7. EgressIpCallout component renders (lines 415–422), shows user's dedicated IP claim status
8. Gate: if `egressReady === false` and user taps Connect, `unmetAck` flash fires (lines 110–112: `if (!egressReady) { setUnmetAck(true); return; }`)
9. User ticks IP acknowledgment checkbox in EgressIpCallout (line 419: `onAcknowledgeChange={setEgressReady}`)
10. User taps "Connect Groww" button (line 461–469, `disabled={!apiKey.trim() || !totpToken.trim() || loading}`)
11. `handleSubmit()` fires (line 109, triggered by button onPress)
12. Validates gate: `if (!egressReady) { setUnmetAck(true); return; }` (lines 110–112)
13. Validates userId exists (lines 114–117): `if (!userId) { showAlert('error', 'Error', 'User not found. Please try again.'); return; }`
14. Trims both fields (lines 118–119)
15. Validates both non-empty (lines 120–125): if not, shows alert: "Paste both the API Key and the TOTP Secret Key (the Base32 string shown below the QR on Groww's "Generate TOTP token" dialog — not the JWT-style token at the top)."
16. Sets `loading = true` (line 129)
17. Constructs payload (lines 131–137): `{uid, user_email, user_broker: 'Groww', apiKey: encrypted, totp_seed: encrypted}`
18. POSTs to `${server.server.baseUrl}api/groww/update-key` (line 138–141)
19. On success (`res.data?.success === true`, line 143), saves broker session time (line 145: `saveBrokerSessionTime('Groww')`)
20. SDK dual-write if bridge ready (lines 154–160: `if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) { sdkDualWriteSafely(sdkConnectBroker(...), 'Groww', 'connect'); }`)
21. Optional model-portfolio refresh (lines 163–168)
22. Closes modal (lines 176–177: `setShowBrokerModal?.(false); onClose?.();`)
23. Wraps post-success in try-catch (lines 182–199) to avoid errors bubbling back as "Connection Error":
    - Calls `fetchBrokerStatusModal()` (line 183)
    - Emits `refreshEvent` (line 184–186)
    - Shows success alert unless migration UI will show (line 187–192)
24. On error (line 208–268), granular per-error-code response:
    - Error code `NOT_BASE32` (line 216): "TOTP Secret Key format is off" + detailed string about Base32 format (A–Z, 2–7, ~32 chars)
    - Error code `WRONG_LENGTH` (line 223): "TOTP Secret Key looks incomplete" + hint to copy full ~32-char string
    - Error code `GROWW_REJECTED` (line 230): "Groww rejected the credentials" + 3-part checklist (API Key from TOP, Base32 from SAME dialog, dedicated IP whitelisted)
    - Error code `INVALID_SEED` or `INVALID_CREDENTIALS` (line 237–246): "Groww rejected the credentials" + fallback checklist
    - All other errors: HTTP-vs-network distinction (line 252: `const isHttpError = !!err?.response;`)
      - If HTTP error: show server message with "Connection Error" title (line 254–260)
      - If network error: show "Connection Issue" with "Your credentials may already be saved — please refresh to check before retrying." (line 262–266)

**Encryption:**
- `encryptForTransport()` (line 43–44): `CryptoJS.AES.encrypt(plain, 'ApiKeySecret').toString()`
- Applied to both apiKey and totpToken before POST (lines 135–136)
- Backend `/api/groww/update-key` decrypts with same passphrase before CCXT validation

**Auth header construction:**
- `'Content-Type': 'application/json'`
- `'X-Advisor-Subdomain': advisorSubdomain` (line 82, resolved from configData or getAdvisorSubdomain())
- `'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)` (line 83–86)
- All three calls use `authHeaders` variable (line 80–87)

**IP-whitelist gate:**
- EgressIpCallout with broker="groww" (line 416)
- User must claim dedicated IP and whitelist on Groww's Trade API page "Update static IP" button (step 4 of guide, line 369–380)
- Acknowledgment gated via `egressReady` state (line 70: `const [egressReady, setEgressReady]`)
- Early return if not ready (lines 110–112): "if (!egressReady) { setUnmetAck(true); return; }"
- Critical user-facing string at line 378: "Groww rejects access-token requests and orders from non-whitelisted IPs — the most common cause of the "Groww rejected the credentials" error."

**Reauth handling:**
- No `reauthConfig` prop in component signature (line 48–53)
- No reauth pre-fill; user must re-enter both fields on reconnect

**Help content:**
- No YouTube ID (unlike HDFC/Axis); help is inline + expandable panel
- Collapsed state shows one-line intro: "About this connection" title (GrowwHelpContent line 30) + "Groww uses an API Key + TOTP Secret pair (Bearer token + seed for daily 6-digit codes) instead of OAuth. Tap Read More below for notes on which value goes where, daily refresh behaviour, and what to do if you hit a "rejected credentials" error." (line 31–36)
- Expanded state reveals three sections (lines 40–94):
  1. "Which value goes where?" (line 42–58): "The JWT (starts with eyJraWQi…) → paste into the "TOTP Token (used as API Key)" field. Groww uses this as the Bearer token." + "The Base32 secret (~32 chars, A–Z and 2–7) shown below the QR → paste into the "TOTP QR Secret (Base32)" field. Our backend uses it to mint a fresh 6-digit TOTP every daily refresh." (line 44–53)
  2. "Important Notes:" (line 62–82): 4 bullets about IP whitelist, encryption, secret revocation, active trading account
  3. "Need Help?" (line 86–91): "If you encounter "Groww rejected the credentials" or any other error, double-check the dedicated IP whitelist on Groww's side first, then contact our support team with the error code shown."
- Critical user-facing strings at line 124: "Paste both the API Key and the TOTP Secret Key (the Base32 string shown below the QR on Groww's "Generate TOTP token" dialog — not the JWT-style token at the top)."
- At line 206: "Failed to connect Groww. Please verify your API Key, TOTP Secret Key (Base32 string below the QR), and that your dedicated IP is whitelisted on Groww."

**Broker-specific quirks:**
- Dual TOTP collection from single Groww dialog: JWT at top (Bearer token for API calls) + Base32 below QR (seed for regenerating 6-digit TOTP every day) — no OAuth, pure credentials
- Base32 format validation expected: CCXT error codes `NOT_BASE32` (line 216) and `WRONG_LENGTH` (line 223) documented
- Granular per-error-code mapping with user-facing explanations (lines 216–246)
- Single endpoint `/api/groww/update-key` handles both credential validation and persistence (no separate `/api/user/connect-broker` call unlike most brokers)
- Help content extensive (lines 292–383 of modal) because user confusion is high; dedicated section explaining which field takes which value, repeated in both inline guide + expandable help panel
- EgressIpCallout required due to Groww's strict IP whitelist on access-token and order endpoints

**Backend Node routes:**
- `/api/groww/update-key` — POST (line 139): accepts `{uid, user_email, user_broker: 'Groww', apiKey: encrypted, totp_seed: encrypted}`, returns `{success: true}` or error response with `error_code` field
- File:line in aq_backend_github: `Routes/groww/` or `Routes/GrowwRoutes.js`

**ccxt-india routes:**
- No direct ccxt call from mobile; backend `/api/groww/update-key` proxies all validation
- `app_groww.py` contains the validator functions: `_normalize_totp_token()` (returns `NOT_BASE32` or `WRONG_LENGTH` error codes, line 212 comment) and `_mint_groww_access_token()` (returns `GROWW_REJECTED` if credentials rejected, line 212 comment)
- Daily session refresh calls ccxt to mint fresh TOTP from stored seed (backend-side only)

### SDK flow (Phase 3)

**Schema row:**
From PHASE3_BROKER_AUDIT.md line 331–354: "Groww — SDK-broken"
SDK BrokerName: `Groww` (per visibleModalToBrokerName, line 127 of Phase3SdkBrokerModal.js returns `Groww` unchanged)
Current schema (per audit): `flow=credentials, fields=[accessToken], submitEndpoint=connect`
**WRONG** — legacy collects 2 fields (`apiKey` + `totpToken`), not 1 (`accessToken`), and doesn't use OAuth
Correct schema needed: `flow=credentials, fields=[apiKey, totpToken], submitEndpoint=update-key, validators=[Base32ForTotpToken], errorCodeMap={NOT_BASE32, WRONG_LENGTH, GROWW_REJECTED}`

**Phase3SdkBrokerModal handling:**
- Not in `SDK_ELIGIBLE_MODALS` allowlist (empty set, line 58) so legacy modal forced
- If promoted (after SDK schema fix), would flow through BrokerCredentialForm (line 291 of Phase3SdkBrokerModal)
- Form would need to render two fields (apiKey + totpToken) with separate labels and helper text
- Encryption would use `encryptField()` (line 102–103, same `CryptoJS.AES.encrypt(..., 'ApiKeySecret')` as legacy)
- No OAuth phase; form submits directly via `onSuccess` callback (line 309)

**Backend SDK route:**
- Would need to exist at `POST /sdk/v1/connections/Groww/connect` (per Phase3SdkBrokerModal line 25: "submitEndpoint=connect" brokers call `client.connectBroker`)
- Must proxy to `/api/groww/update-key` with same request signature
- Must return granular error codes (`NOT_BASE32`, `WRONG_LENGTH`, `GROWW_REJECTED`) for SDK to surface

**ccxt-india proxy target:**
- `/api/groww/update-key` backend route calls ccxt-india's validation functions
- SDK route must forward validation errors back to client for user display

**SDK widget API surface:**
- Would need `BrokerCredentialForm` to support `fields=[apiKey, totpToken]` with per-field validation
- Base32 format validator for totpToken field (SDK currently has no field-level validators per audit)
- Error handler must map `NOT_BASE32` → user message about Base32 format, `WRONG_LENGTH` → incomplete string, `GROWW_REJECTED` → 3-part checklist
- No OAuth phase; form only; no WebViewBrokerAuthFlow involvement

### Touchpoint comparison table

| Touchpoint | Legacy | SDK | Gap | Status |
|-----------|--------|-----|-----|--------|
| Field: apiKey (JWT) | TextInput on GrowwConnectModal | BrokerCredentialForm field | SDK schema lists only accessToken, not apiKey | ❌ |
| Field: totpToken (Base32) | TextInput on GrowwConnectModal | BrokerCredentialForm field | SDK schema has no totpToken field | ❌ |
| Validation: non-empty | Client-side checks both (line 120) | SDK form validation | SDK must validate both non-empty | ⚠️ |
| Validation: Base32 format | Server-side (ccxt _normalize_totp_token) | Field-level validator on totpToken | SDK widget has no field validators | ❌ |
| Encryption envelope | CryptoJS.AES.encrypt(..., 'ApiKeySecret') | encryptField (same envelope) | Identical | ✅ |
| Submit endpoint | POST /api/groww/update-key | POST /sdk/v1/connections/Groww/connect (proxies to /api/groww/update-key) | SDK route must exist and proxy | ⚠️ |
| Error code: NOT_BASE32 | Granular alert with Base32 format hint (line 216–221) | SDK onError callback must map error code | SDK error handler must recognize NOT_BASE32 and surface hint | ❌ |
| Error code: WRONG_LENGTH | Granular alert about incomplete secret (line 223–228) | SDK onError callback must map | SDK must recognize WRONG_LENGTH | ❌ |
| Error code: GROWW_REJECTED | Granular alert with 3-part checklist (line 230–235) | SDK onError callback | SDK must recognize GROWW_REJECTED and hint about IP whitelist | ❌ |
| HTTP vs network errors | Two-layer distinction (line 252–267) | SDK onError receives error object | SDK widget handles both layers | ⚠️ |
| IP-whitelist gate | EgressIpCallout with egressReady (line 110–112) | Phase3SdkBrokerModal IP_WHITELIST_BROKERS includes Groww (line 87) | Gate exists in SDK path | ✅ |
| Help content: which value goes where | GrowwConnectModal lines 337–359 + GrowwHelpContent lines 42–58 | Phase3BrokerHelp renders GrowwHelpContent | Help content reused in SDK path | ✅ |
| Help content: Groww dialog steps | GrowwConnectModal lines 292–383 (4-step inline guide) | Phase3BrokerHelp renders same content | Legacy guide is thorough; SDK inherits it | ✅ |
| Help content: IP whitelist step | GrowwConnectModal line 369–380 (step 4) | Phase3BrokerHelp + EgressIpCallout | Help + gate both present in SDK | ✅ |
| Daily refresh (non-critical) | Backend auto-mints TOTP from stored seed | SDK doesn't manage daily refresh (connection persist only) | Backend handles; no SDK gap | ✅ |
| Model-portfolio refresh | POST /rebalance/change_broker_model_pf (line 164–168) | Phase3SdkBrokerModal doesn't call it | User must manually sync; no SDK call | ⚠️ |
| Broker persistence | Direct in /api/groww/update-key (no /connect-broker call) | SDK route proxies to /api/groww/update-key | Same persistence | ✅ |
| Post-success refresh | fetchBrokerStatusModal() (line 183) | SDK onSuccess calls fetchBrokerStatusModal() | Same contract | ✅ |
| Reauth support | No pre-fill; user re-enters both fields | BrokerCredentialForm has no pre-fill | Reauth flows forced to legacy via isReauthFlow short-circuit | ✅ |

### Gap fix plan

1. **SDK schema update in @alphaquark/mobile-sdk brokerFormSchema.ts**
   - Change from: `flow=credentials, fields=[accessToken], submitEndpoint=connect`
   - Change to: `flow=credentials, fields=[{name: 'apiKey', label: 'TOTP Token (used as API Key)', required: true, helperText: '...'}, {name: 'totpToken', label: 'TOTP QR Secret (Base32)', required: true, validator: 'base32', helperText: '...'}], submitEndpoint=connect`
   - Dependency: SDK package release

2. **Field-level Base32 validator in SDK**
   - Add `validator: 'base32'` support to BrokerCredentialForm field schema
   - Validator checks: non-empty, length ~32 chars, only A–Z and 2–7
   - Returns error code `NOT_BASE32` or `WRONG_LENGTH` to SDK form handler
   - Dependency: SDK package update

3. **Backend SDK route for /connect**
   - Add Groww case to `POST /sdk/v1/connections/Groww/connect` dispatch
   - Forward request body to `/api/groww/update-key` unchanged
   - Return response with `error_code` field preserved for SDK to map
   - Dependency: aq_backend_github Routes/sdk/v1/connections.js

4. **SDK error handler for Groww error codes**
   - Map `NOT_BASE32` → "TOTP Secret Key format is off. The Base32 string needs to be ~32 characters of A–Z and 2–7 only. Copy the full string from below the QR on Groww's "Generate TOTP token" dialog."
   - Map `WRONG_LENGTH` → "TOTP Secret Key looks incomplete. Make sure you copied the full ~32-character string shown below the QR."
   - Map `GROWW_REJECTED` → "Groww rejected the credentials. Check: (1) API Key is the JWT from the TOP of "Generate TOTP token", (2) Base32 is from the SAME dialog (not a different one), (3) your dedicated IP is whitelisted on Groww's "Update static IP"."
   - Dependency: SDK package + Phase3SdkBrokerModal onError callback

5. **Field label and helper text in schema**
   - apiKey: label "TOTP Token (used as API Key)", helper "The long JWT-style value labelled "TOTP Token" at the TOP of Groww's "Generate TOTP token" dialog"
   - totpToken: label "TOTP QR Secret (Base32)", helper "The ~32-character Base32 secret shown BELOW the QR code"
   - Dependency: SDK schema update

### Verdict

**SDK-broken** until the SDK package gains three critical features:

1. **Multi-field schema for Groww** — SDK schema currently lists only `accessToken` field; Groww legacy uses two distinct fields (`apiKey` JWT + `totpToken` Base32 secret) from a single Groww dialog. Schema must support arbitrary field lists, not just single-field credentials.

2. **Field-level validation (Base32 format)** — Legacy modal delegates Base32 validation to CCXT backend (app_groww.py `_normalize_totp_token()`), which catches `NOT_BASE32` and `WRONG_LENGTH` and returns granular error codes. SDK BrokerCredentialForm has no field-validator support, so mobile side cannot provide early feedback that the user pasted an invalid Base32 string.

3. **Granular per-error-code mapping** — Legacy modal surfaces three distinct user-facing strings depending on error code: NOT_BASE32 (format hint), WRONG_LENGTH (copy full string), GROWW_REJECTED (3-part IP/field checklist). SDK error handler must map each code to the correct user guidance. Without this, users see generic "Connection Error" and cannot self-diagnose.

Significant SDK-package work required. The legacy GrowwConnectModal is user-tested and handles the two-field collection + base32 validation + granular error codes very well. The help content (both inline 4-step guide and expandable panel) is extensive because the Groww UX is non-obvious (two values from one dialog, one is a JWT and one is Base32, no OAuth). These design decisions are not negotiable; they reflect Groww's actual API requirements. SDK widget must model them.

---

## 13. Axis Securities

### Legacy flow (production path)

**Entry points:**
- `BrokerConnectModalDispatch` dispatch (line 156–157: `case 'Axis Securities': return <AxisConnectModal {...commonProps} />;`)

**Form fields:**
- **None collected in form.** Pure SSO/WebView flow. User enters username/password on Axis Direct's secure login page, not in the app.

**Step-by-step flow:**

1. Modal opens via AxisConnectModal (line 33–37 props)
2. Fetch user details on mount (lines 49–65: `useEffect` calls `getUser` endpoint, stores `_id` in `userId`, stores full user object for re-auth fallback)
3. User taps "Login with Axis Direct" button (lines 499–510, calls `handleAxisLogin()`)
4. `handleAxisLogin()` validates redirect URL config (lines 97–105: `if (!brokerConnectRedirectURL) { Toast.show error }`)
5. POSTs to `${server.ccxtServer.baseUrl}axis/login-url` with `{redirectUrl: brokerConnectRedirectURL}` (lines 107–110)
6. Backend returns `{data: {redirectURL: url}}` or error envelope (lines 113–130)
7. If response has `redirectURL`, stores in state (line 115: `setLoginUrl(url)`) and opens WebView (line 116: `setShowWebView(true)`)
8. If response lacks `redirectURL`, surfaces upstream error (line 121–130: toast shows `response.data?.error` or `response.data?.message`)
9. On HTTP error (lines 132–158), surfaces structured error with status code + body to user:
    - 400: "Axis Securities — invalid redirect URL"
    - 500/502: "Axis Securities upstream error"
    - Network: "Connection Issue"
10. WebView opens at `loginUrl` (line 461, `source={{uri: loginUrl}}`)
11. User enters username, password, OTP on Axis Direct's secure page (not captured by app)
12. Axis SSO redirects to callback URL (e.g., `https://prod.alphaquark.in/stock-recommendation?ssoId=...`)
13. Dual-method intercept catches the redirect:
    - **Method 1: `onShouldStartLoadWithRequest` (line 464)** — fires BEFORE WebView loads URL, can return false to prevent load
    - **Method 2: `onNavigationStateChange` (line 463)** — fires AFTER navigation, fallback if method 1 doesn't catch
14. `handleShouldStartLoad()` extracts ssoId (lines 168–184):
    - Parses URL query string defensively (lines 172–181)
    - Looks for `ssoId=` or `spSsoId=` param (line 169)
    - Decodes URI components with try-catch fallback (line 179)
    - Returns false if ssoId found to prevent WebView loading the blank landing page (line 197: `return false;`)
    - Calls `processAxisCallback(ssoId)` (line 196)
15. `handleWebViewNavigation()` fallback (lines 202–209) — same extraction logic, fires if method 1 missed
16. Guard: `hasProcessedCallback` prevents duplicate processing (line 212: `if (hasProcessedCallback.current) return;`)
17. Set flag and close WebView (lines 213–214)
18. POSTs to `${server.ccxtServer.baseUrl}axis/callback` with `{ssoId}` (lines 221–224)
19. Response handling (lines 227–250):
    - Unwrap response: `const data = callbackResponse.data?.data || callbackResponse.data;` (line 231, handles both `{data: {...}}` and flat responses)
    - **Upstream error envelope detection** (lines 244–250): if `data.error && typeof data.error === 'object'`, throw with upstream code + message (e.g., "Axis Securities SSO error 1083: failed to type cast user id")
    - **Multi-path authToken parsing** (lines 257–271): walk all known response shapes before giving up:
      - `data.authToken?.token` (nested obj)
      - `data.authToken` (direct)
      - `data.token`
      - `data.access_token`
      - `data.accessToken`
      - `data.tokens?.authToken?.token` (deep nest)
      - `data.tokens?.authToken`
      - `data.tokens?.access_token`
      - `data.metadata?.authToken?.token` (alternate top-level)
      - `data.metadata?.authToken`
      - `data.metadata?.tokens?.authToken`
      - `data.result?.authToken?.token` (tertiary)
      - `data.result?.authToken`
      - `data.result?.token`
    - If no authToken found, log diagnostic with response preview (lines 287–300)
    - **Re-auth fallback for subAccountId** (lines 311–321): Axis sometimes omits `accounts[]` array on re-auth; fallback chain:
      - `data.accounts?.[0]?.subAccountId`
      - `data.metadata?.accounts?.[0]?.subAccountId`
      - `data.subAccountId` (top-level)
      - `data.clientCode`
      - `data.clientId`
      - `existingAxisCode` — stored from prior connection (lines 311–314: `userDetails?.connected_brokers?.find(b => b.broker === 'Axis Securities')?.clientCode`)
20. Validation gates (lines 323–331):
    - `if (!authToken) throw "Missing auth token"`
    - `if (!subAccountId) throw "Missing subAccountId and no prior Axis connection"`
21. Construct broker data (lines 341–347): `{uid, user_broker: 'Axis Securities', clientCode: subAccountId, jwtToken: authToken, secretKey: refreshToken}`
22. PUT to `${server.server.baseUrl}api/user/connect-broker` with axisBrokerData (lines 349–352)
23. SDK dual-write if bridge ready (lines 356–361)
24. Optional model-portfolio refresh (lines 365–370)
25. Close modal (line 375)
26. Wrap post-success steps in try-catch (lines 380–394):
    - Toast "Axis Securities connected successfully!" (lines 381–384)
    - Call `fetchBrokerStatusModal()` (line 387)
    - Emit refreshEvent (line 388)
27. On error (lines 395–434):
    - If upstream Axis error (code 1083 detected, line 417): "Axis Securities — temporary SSO issue" + "Axis SSO returned error 1083. Their server is rejecting the SSO ID — please retry in a few minutes or contact support." (lines 421–423)
    - If upstream error other than 1083: "Failed to connect Axis Securities" + error message (lines 408–410)
    - If network error (no `error.response`, line 413): "Connection Issue" + "Your credentials may already be saved — please refresh to check before retrying." (lines 414–416)
    - Toast with 6s visibility (line 425–429)

**Encryption:**
- None. SSO tokens passed plaintext.

**Auth header construction:**
- `'Content-Type': 'application/json'`
- `'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain()` (line 69–70)
- `'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)` (line 71–74)
- Used in getUser, login-url, callback, connect-broker calls

**IP-whitelist gate:**
- None. Axis SSO is broker-hosted; no dedicated IP required from our side.

**Reauth handling:**
- No `reauthConfig` prop.
- Re-auth uses `existingAxisCode` fallback (lines 311–314) — when user re-auths, Axis sometimes omits `accounts[]` array; we look up the prior `connected_brokers[broker='Axis Securities'].clientCode` which was the subAccountId from initial auth, and reuse it.

**Help content:**
- No expandable help panel (unlike Groww/Zerodha).
- Inline security note (lines 513–520): "Secure SSO Login — Your login credentials are entered directly on Axis Direct's secure page. We only receive a session token to execute trades on your behalf." with Shield icon.

**Broker-specific quirks:**
- Pure SSO/WebView — user never enters credentials in app; all login happens on Axis Direct.
- **Dual-method intercept** (onShouldStartLoadWithRequest + onNavigationStateChange) to catch redirect before blank landing page renders (lines 191–209). onShouldStartLoadWithRequest fires BEFORE load and returns false to prevent navigation; onNavigationStateChange fires AFTER and is fallback.
- **Defensive URL parsing** (lines 168–184) — avoids React Native's partial `URL().searchParams` implementation; manually splits query string with try-catch on decodeURIComponent.
- **Upstream error envelope detection** (lines 244–250) — Axis can return 200 with `error: {code, error, stackTrace}` body for some failures (e.g., code 1083 from sso/model.go:326 type-cast bug). Without this guard, the next authToken check reports "Missing auth token" which is accurate but misleading.
- **Multi-path authToken parsing** (lines 257–271) — Axis response shape varies; initial auth returns `{data: {...}}`, re-auth may omit `data` wrapper; authToken may be nested under `tokens`, `metadata`, `result` at various depths.
- **`existingAxisCode` fallback** (lines 311–314) — handles re-auth when Axis omits the accounts array.
- **CrossPlatformOverlay instead of <Modal>** (line 448, line 484) — Android native Modal has stacking bugs when opening while another Modal (ManageConnectionsModal) is unmounting. CrossPlatformOverlay uses absoluteFillObject + zIndex:9999 on Android, FullWindowOverlay on iOS.

**Backend Node routes:**
- `/api/user/connect-broker` — PUT (line 350): persists axisBrokerData. Common route across all brokers.
- No `/api/axis/` route needed; Axis flow is pure SSO → ccxt callback.

**ccxt-india routes:**
- `POST /axis/login-url` (line 108): accepts `{redirectUrl}`, validates against registered URLs on Axis SSO side, returns `{data: {redirectURL: ...}}`
- `POST /axis/callback` (line 222): accepts `{ssoId}`, exchanges with Axis backend, returns `{data: {authToken, refreshToken, ...}}` or error envelope

### SDK flow (Phase 3)

**Schema row:**
From PHASE3_BROKER_AUDIT.md line 357–382: "Axis Securities — SDK-with-gap (backend-side)"
SDK BrokerName: `Axis Securities` (per visibleModalToBrokerName, line 127 of Phase3SdkBrokerModal.js returns unchanged)
Expected schema: `flow=oauth, fields=[], submitEndpoint=login-url` (pure SSO, no credential form)

**Phase3SdkBrokerModal handling:**
- In `SDK_LEGACY_FALLBACK` set (line 75–79: `const SDK_LEGACY_FALLBACK = new Set(['Angel One', 'Zerodha', 'Axis Securities']);`)
- Comment at line 68–74: "Axis Securities: backend /sdk/v1/connections/Axis Securities/login-url proxy is missing (returns broker_login_url_failed). Legacy AxisConnectModal works fine — it hits ccxt-india /axis/login-url directly with dual intercept (onShouldStartLoadWithRequest + onNavigationStateChange) and captures ssoId. Routes to legacy until backend SDK route lands."
- Even if removed from fallback, would flow through WebViewBrokerAuthFlow (Phase3SdkBrokerModal line 221–232) since `fields=[]` schema would skip credential form

**Backend SDK route:**
- **MISSING or BROKEN** — user-reported regression 2026-04-28: `/sdk/v1/connections/Axis Securities/login-url` returns `{error: 'broker_login_url_failed'}`
- Expected behavior: `POST /sdk/v1/connections/Axis Securities/login-url` → proxy to ccxt-india `/axis/login-url` → return `{data: {redirectURL: ...}}`
- File:line in aq_backend_github: `Routes/sdk/v1/connections.js` (add Axis dispatch to switch/case)

**ccxt-india proxy target:**
- `POST /axis/login-url` — same as legacy
- `POST /axis/callback` — same as legacy

**SDK widget API surface:**
- `BrokerCredentialForm` skips entirely due to `fields=[]` schema (line 291 of Phase3SdkBrokerModal)
- Form directly transitions to `onContinueToOauth` with empty `{}` body (Phase3SdkBrokerModal line 294, `onContinueToOauth: (collected) => {...}`)
- `WebViewBrokerAuthFlow` takes over with `broker="Axis Securities"`, `redirectUrl`, `extraExchangeBody={}` (line 221–232)
- Expects backend `/sdk/v1/connections/Axis Securities/exchange-token` to:
  - Accept `ssoId` from redirect query param
  - Proxy to ccxt `/axis/callback`
  - Handle multi-path authToken response shapes (initial vs re-auth)
  - Return `{data: {authToken, ...}}` to SDK onSuccess handler

### Touchpoint comparison table

| Touchpoint | Legacy | SDK | Gap | Status |
|-----------|--------|-----|-----|--------|
| Form fields | None (pure SSO) | fields=[] (skips form) | Identical behavior | ✅ |
| Get login URL | POST /axis/login-url (ccxt-india) | POST /sdk/v1/connections/Axis Securities/login-url (SDK route proxies to ccxt) | SDK route missing/broken | ❌ |
| Redirect URL config | brokerConnectRedirectURL from configData or .env (lines 89–92) | REDIRECT_URL from Phase3SdkBrokerModal (line 91–93) | Both pull from same config sources; no gap | ✅ |
| WebView open | setShowWebView(true) with loginUrl (line 116) | WebViewBrokerAuthFlow handles (line 221) | Same UX | ✅ |
| ssoId extraction | onShouldStartLoadWithRequest + onNavigationStateChange dual intercept (lines 191–209) | WebViewBrokerAuthFlow's generic URL intercept | SDK widget's redirect intercept must catch query param correctly | ✅ |
| Callback exchange | POST /axis/callback with {ssoId} (line 222) | POST /sdk/v1/connections/Axis Securities/exchange-token (SDK route proxies to /axis/callback) | SDK route missing | ❌ |
| Upstream error detection | data.error && typeof data.error === 'object' check (line 244) | Backend /exchange-token must detect and surface | Backend handler must replicate envelope detection | ⚠️ |
| Multi-path authToken parsing | 15+ fallback paths (lines 257–271) | Backend /exchange-token must try all paths | Backend handler must replicate all fallback paths | ⚠️ |
| Re-auth subAccountId fallback | existingAxisCode from connected_brokers lookup (lines 311–314) | SDK has no user-history access | Backend /exchange-token must query prior broker record server-side | ⚠️ |
| Broker persist | PUT /api/user/connect-broker (legacy calls directly) | SDK route persists via /api/user/connect-broker | Same persistence target | ✅ |
| Model-portfolio refresh | POST /rebalance/change_broker_model_pf (lines 365–370) | Phase3SdkBrokerModal doesn't call it | User must manually sync | ⚠️ |
| Post-success refresh | fetchBrokerStatusModal() (line 387) | SDK onSuccess calls fetchBrokerStatusModal() | Same contract | ✅ |
| Success toast | "Axis Securities connected successfully!" (line 381) | SDK onSuccess fires, Phase3SdkBrokerModal omits toast | No visible toast in SDK; lower visibility | ⚠️ |
| Error handling: upstream 1083 | Detects code, shows "temporary SSO issue" hint (line 417–423) | Backend must surface code to SDK | SDK onError receives code in structured format | ⚠️ |
| Error handling: upstream other | Shows error code + message (line 408–410) | Backend surfaces to SDK | SDK onError handler must process | ⚠️ |
| Error handling: network | "Connection Issue" + "credentials may already be saved" (line 414–415) | SDK onError for non-HTTP errors | Same wording | ✅ |
| Reauth: no reauthConfig | User re-auths from scratch | BrokerCredentialForm has no pre-fill; form skips anyway | No change in behavior | ✅ |
| Reauth: subAccountId recovery | existingAxisCode fallback from DB (lines 311–314) | SDK has no client-side history | Backend /exchange-token must query user's prior Axis record | ⚠️ |
| Render: CrossPlatformOverlay vs Modal | CrossPlatformOverlay (line 448, 484) | Phase3SdkBrokerModal uses Pressable scrim (line 240) | Different underlying components; both avoid Android Modal stacking bug | ✅ |
| Layout: dual-intercept WebView | onShouldStartLoadWithRequest + onNavigationStateChange (lines 191–209) | WebViewBrokerAuthFlow's single generic intercept | SDK widget's intercept must catch Axis redirect correctly | ✅ |

### Gap fix plan

1. **Backend SDK route for login-url** (file:line in aq_backend_github `Routes/sdk/v1/connections.js`)
   - Add Axis Securities case to dispatch
   - Accept `{redirectUrl}` from request body (per SDK caller Phase3SdkBrokerModal line 223)
   - Call ccxt-india `POST /axis/login-url` with same redirectUrl
   - Return `{data: {redirectURL: url}}` on success, or error if ccxt fails
   - Return `{error: 'broker_login_url_failed'}` on missing redirectUrl (current behavior that blocks users)
   - Dependency: none; ccxt endpoint exists

2. **Backend SDK route for exchange-token** (file:line in aq_backend_github `Routes/sdk/v1/connections.js`)
   - Add Axis Securities case to dispatch
   - Extract `ssoId` from query params (SDK widget captures redirect and forwards query string)
   - Call ccxt-india `POST /axis/callback` with `{ssoId}`
   - **Upstream error envelope detection** (lines 244–250 of AxisConnectModal): if response contains `error: {code, error}`, throw with that code preserved so SDK can surface it
   - **Multi-path authToken parsing** (lines 257–271): try all 15+ fallback shapes for authToken
   - **Re-auth subAccountId recovery** — query user's prior `connected_brokers[broker='Axis Securities'].clientCode` and use as fallback if Axis omits accounts array (lines 311–314 pattern)
   - Return `{data: {authToken, clientCode, ...}}` on success
   - Dependency: same as login-url; ccxt endpoint exists

3. **Add Axis Securities to SDK-eligible conditions**
   - Remove from `SDK_LEGACY_FALLBACK` set in BrokerConnectModalDispatch (line 75–79) once backend routes land
   - Add to `SDK_ELIGIBLE_MODALS` allowlist (currently empty, line 58)
   - Dependency: backend SDK routes + testing

4. **Success toast in SDK flow** (optional but user-visible)
   - Phase3SdkBrokerModal.onSuccess could show Toast (legacy shows line 381)
   - Or rely on fetchBrokerStatusModal's own UI refresh
   - Dependency: Phase3SdkBrokerModal enhancement

### Verdict

**SDK-with-gap (backend-side only).** Legacy AxisConnectModal is solid, well-tested, and handles all the Axis-specific quirks (dual intercept, envelope detection, multi-path parsing, re-auth fallback). The SDK widget (`WebViewBrokerAuthFlow`) is generic enough to catch the ssoId redirect.

The **only blocker is the backend SDK routes**, which are currently missing or broken. Once `/sdk/v1/connections/Axis Securities/login-url` and `/exchange-token` are implemented in aq_backend_github, Axis is closest to SDK-clean (after HDFC) because:

1. No form fields to collect (pure SSO, no encryption)
2. No IP whitelist gate (Axis SSO is broker-hosted)
3. No reauth pre-fill API gap (legacy doesn't use reauthConfig anyway; re-auth falls through to existing code fallback which backend must replicate server-side)
4. No field validators or error-code mapping (upstream Axis errors are surfaced verbatim)

The backend must carefully replicate AxisConnectModal's error handling (envelope detection for code 1083, multi-path authToken parsing, existingAxisCode lookup) so SDK users get the same robustness. With that backend work, Axis is SDK-clean and can be promoted.

---

## 14. DummyBroker

### Legacy flow (production path)

**Entry points:**
- No dedicated modal. DummyBroker is referenced in rebalance flows (ExecutionStatusScreen, RebalanceReviewScreen) as a pseudo-broker for manual execution.
- Search results show no `DummyBrokerConnectModal.js` or `/src/components/DummyBroker*` files.

**Form fields:**
- None. DummyBroker is not a real broker; it's a placeholder for "user will execute manually".

**Step-by-step flow:**

1. User navigates to rebalance screen without selecting a broker (or chooses "Continue without broker" option)
2. `isDummyBroker` flag triggers (e.g., line in RebalanceReviewScreen: `const isDummyBroker = broker === 'DummyBroker' || !broker;`)
3. Button text changes to "Confirm Manual Execution" instead of "Accept & Execute Rebalance" (conditional render)
4. User taps confirm
5. Backend stores execution with `user_broker: 'DummyBroker'` (line in RebalanceAdvices: `user_broker: 'DummyBroker'`)
6. No broker persistence call (no credentials, no auth tokens)
7. User manually executes trades on broker's own platform or via broker app
8. No API order execution; app is purely advisory

**Encryption:**
- None. No credentials exchanged.

**Auth header construction:**
- Same as all other calls: Content-Type, X-Advisor-Subdomain, aq-encrypted-key

**IP-whitelist gate:**
- None.

**Reauth handling:**
- N/A.

**Help content:**
- None; no modal exists.

**Broker-specific quirks:**
- Is a flag value in `connected_brokers` array (`broker: 'DummyBroker'`), not a real broker
- Used to track when user says "I'll execute manually"
- Filters out of broker-action UX (line in SubscriptionScreen: `b => b?.broker && b.broker !== 'DummyBroker'`)

**Backend Node routes:**
- No `/api/dummybroker/*` routes exist.
- `/api/user/connect-broker` is never called with `user_broker: 'DummyBroker'`.
- Rebalance API calls include `user_broker: 'DummyBroker'` for tracking only.

**ccxt-india routes:**
- None.

### SDK flow (Phase 3)

**Schema row:**
From PHASE3_BROKER_AUDIT.md (search results): no explicit mention of DummyBroker in the audit, but Phase3SdkBrokerModal comment line 47–48 mentions "flow == stub (DummyBroker): The form auto-succeeds without persistence."
Expected schema: `flow=stub, fields=[], submitEndpoint=none`

**Phase3SdkBrokerModal handling:**
- If DummyBroker is added to `SDK_ELIGIBLE_MODALS` allowlist, would route through Phase3SdkBrokerModal (line 129)
- Form phase: BrokerCredentialForm with `broker="DummyBroker"` and `fields=[]` (line 291)
- Form would auto-skip to onSuccess (no fields, no validation) (line 294)
- onSuccess calls fetchBrokerStatusModal() then onClose (lines 160–169)
- No backend call; no persistence

**Backend SDK route:**
- No route needed; stub flow auto-succeeds client-side

**ccxt-india proxy target:**
- None.

**SDK widget API surface:**
- `BrokerCredentialForm` with `broker="DummyBroker"`, `fields=[]`, `encrypt=encryptField` (unused), `onSuccess` callback
- Form immediately fires onSuccess with no network call
- No `WebViewBrokerAuthFlow` involved

### Touchpoint comparison table

| Touchpoint | Legacy | SDK | Gap | Status |
|-----------|--------|-----|-----|--------|
| Broker selection | Manual UI option ("Continue without broker") | Not yet UI-integrated | Need modal entry point or checkbox in SDK flow | ⚠️ |
| Form fields | None | None | Identical | ✅ |
| Persistence | No /connect-broker call | No SDK persist call | Identical (no persistence) | ✅ |
| Success callback | Rebalance flow continues with isDummyBroker flag | SDK onSuccess closes modal, rebalance must detect broker=null | Detection logic may differ | ⚠️ |
| Help content | None | None | Identical | ✅ |
| Error handling | N/A (cannot fail) | Form auto-succeeds | Identical | ✅ |

### Gap fix plan

1. **Add DummyBroker entry point to broker modal selection**
   - Currently no "Continue without broker" modal exists in SDK flow
   - Either add as a button in the broker selection UI that triggers Phase3SdkBrokerModal with `brokerName="DummyBroker"`, or
   - Add a checkbox in Phase3SdkBrokerModal itself for "Manual execution"
   - Dependency: UI design; no backend changes

2. **SDK schema for DummyBroker**
   - Define as `flow=stub, fields=[], submitEndpoint=none`
   - BrokerCredentialForm should recognize stub flow and auto-fire onSuccess with empty body
   - Dependency: SDK package schema update

3. **Rebalance flow detection for SDK DummyBroker path**
   - Legacy code checks `broker === 'DummyBroker' || !broker`
   - SDK path sets `broker = null` after phase3 modal closes (or explicitly returns "DummyBroker")
   - Ensure rebalance view renders "Confirm Manual Execution" when broker is absent or DummyBroker
   - Dependency: rebalance screen view logic (likely already handles this)

### Verdict

**SDK-clean (stub, trivial).** DummyBroker is not a real broker; it's a placeholder flag for "user will execute manually". The legacy flow has no modal, no form, no persistence — just a flag in the rebalance request. The SDK flow would be a zero-friction modal that auto-succeeds and dismisses.

Adding DummyBroker to `SDK_ELIGIBLE_MODALS` requires:
1. BrokerCredentialForm SDK schema to support `flow=stub` that auto-succeeds
2. A UI entry point (button or checkbox) so user can select "manual execution" in SDK flow
3. Rebalance view to recognize the result and display "Confirm Manual Execution" button

No backend routes, no encryption, no API calls. The work is pure client-side UX + schema. Can be promoted immediately once the stub schema is added to SDK package.

---

**End of audit output.**

---

## Cross-cutting findings

Gaps that affect multiple brokers — consolidated for visibility:

### 1. Reauth pre-fill API missing in `BrokerCredentialForm`

The legacy modals for **Upstox, ICICI Direct, HDFC Securities, Motilal Oswal, Fyers** all accept a `reauthConfig` prop with shape `{authUrl, apiKey, secretKey, ...}`. When set, they pre-fill the form fields and jump straight to the WebView phase, skipping credential entry. The SDK widget `BrokerCredentialForm` has no `reauthConfig` prop today.

Mitigation today: `BrokerConnectModalDispatch` short-circuits ALL re-auth flows to legacy via `isReauthFlow = !!modalPayload?.reauthConfig`. So this gap doesn't cause regressions, but it does mean every credential broker stays partly legacy until the SDK widget gains reauth pre-fill.

**Fix path:** Add optional `reauthConfig` prop to `BrokerCredentialForm` (in `../../alphaquark-mobile-sdk/packages/rn/src/components/`). On mount, if present + valid, set internal state to "oauth phase" with pre-filled fields and emit `onContinueToOauth(extras)` immediately.

### 2. `IP_WHITELIST_BROKERS` set in `Phase3SdkBrokerModal` is incomplete

Today: `{Kotak, Groww, AliceBlue, ICICI, ICICI Direct}`.

Per audit, the set should ALSO include:
- **HDFC Securities** — legacy `HDFCconnectModal` gates on `egressReady`.
- **Upstox** — legacy `upstoxModal` gates on `egressReady`.
- **Fyers** — legacy `FyersConnect` gates on `egressReady`.
- **Motilal Oswal** — legacy `MotilalModal` gates on `egressReady`.

And AliceBlue should likely be **removed** — its legacy modal does NOT gate on IP (no `egressReady` check in `AliceBlueConnect.js`).

**Fix path:** Update `IP_WHITELIST_BROKERS = new Set([...])` in `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js`.

### 3. `EgressIpCallout` content thinner than legacy step text

Brokers like Kotak, ICICI, HDFC, Upstox, Fyers, Groww have rich step-by-step IP-whitelist instructions in their `*HelpContent.js` components — telling users which broker dev-portal field to paste the IP into ("Breeze IP Whitelist", "Allowed IPs", "Consumer Key settings → IP Whitelist"). `EgressIpCallout` shows the IP + a generic "I have whitelisted" checkbox, but doesn't reproduce the per-broker step text.

**Fix path:** Either extend `EgressIpCallout` to take a `broker` prop and render broker-specific step copy (already does this via `BROKER_WHITELIST_HINT` map but copy is one-liner), OR rely on `Phase3BrokerHelp` rendering the full help content above the form (which already happens for these brokers).

### 4. Backend `/exchange-token` per-broker callback handlers missing for non-standard query params

Backend `aq_backend_github/Routes/sdk/v1/connections.js` `/exchange-token` route handlers must accept per-broker query params:
- `apisession` for ICICI Direct
- `requestToken` for HDFC Securities
- `accessToken` directly for Motilal Oswal (no separate gen-access-token call)
- `auth_token` for Angel One and AliceBlue
- `ssoId` for Axis Securities
- `code` (standard OAuth) for Zerodha, Upstox, Fyers, Dhan

Audit each broker's exchange-token implementation against the expected query param. Several may be missing — Axis is confirmed missing (`broker_login_url_failed`).

**Fix path:** For each broker whose audit verdict mentions backend gap, add the per-broker dispatch in `connections.js`. Each dispatch proxies to the matching legacy ccxt route via `_selfCallLegacy()`.

### 5. SDK schema mismatches with live broker APIs

- **Kotak**: legacy collects `apiKey + mobileNumber + mpin + ucc + totp`; SDK schema says `consumerKey + consumerSecret + mobileNumber + password + mpin`. Schema needs alignment with NEO API actuals.
- **Motilal Oswal**: legacy collects `apiKey + clientCode`; SDK schema says `apiKey + apiSecret + userId + password + totpSecret`. Schema needs alignment.
- **AliceBlue**: legacy is empty-fields OAuth (no form); SDK schema may say `flow=credentials, fields=[apiKey, userId]` (per user-reported regression). Schema needs change to `flow=oauth, fields=[]` matching Zerodha's shape.

**Fix path:** Schema audit of `brokerFormSchema.ts` against live broker integration tests, per broker.

### 6. 30-second debounces and session-affinity not in SDK

- **Kotak** — TOTP rotates every 30s; legacy has 30s debounce on Connect tap (lines 116-151 of KotakModal). SDK has no equivalent, leading to false "Incorrect credentials" alerts on rapid retry.
- **Motilal Oswal** — Motilal binds OTP + Authorization header + page session to a single page-load. Back-to-back logins surface "Authorization Invalid" or "Two Factor Authentication Failed". Legacy has 30s debounce + `handleRequestRestart` callback to wipe state (lines 116-136 + 339-344 of MotilalModal). SDK has no equivalent.

**Fix path:** Add a per-broker debounce config to `BrokerCredentialForm` in the SDK schema.

### 7. SDK widget shape for "no-form" OAuth brokers

**AliceBlue** and **Angel One** (shared mode) are pure broker-initiated OAuth with embedded apiKey, no user form. SDK shape that fits is `flow=oauth, fields=[]` (Zerodha's shape). Verify each schema row.

**Fix path:** Update `brokerFormSchema.ts` for AliceBlue. For Angel One, requires backend dual-mode support first (per Angel One section).

### 8. Inline-render bypasses (FIXED 2026-04-28)

Pre-fix: `StockAdvices.js`, `RebalanceAdvices.js` rendered legacy modals inline via local `useState`, completely bypassing Phase 3 routing. Result: AliceBlue, Dhan, and 9 other brokers ALWAYS opened legacy regardless of `REACT_APP_USE_SDK_BROKER_FLOW`.

**Status:** Fixed by extracting dispatch logic into `BrokerConnectModalDispatch` and replacing every inline render with it. Now Phase 3 routing applies uniformly. See `docs/PHASE3_PROGRESS.md`.

### 9. Help content from legacy now rendered in SDK modal

`Phase3BrokerHelp.js` (new 2026-04-28) imports the existing `*HelpContent.js` components (HDFC/Fyers/Upstox/Motilal/AliceBlue/Zerodha/Groww/Kotak/Dhan/ICICI) and renders them in `Phase3SdkBrokerModal` between `EgressIpCallout` and `BrokerCredentialForm`, defaulted expanded. Closes the "missing instructions" gap for these 10 brokers.

Brokers without `*HelpContent` components: Axis Securities, IIFL Securities, Angel One. Their legacy modals also have minimal help; SDK doesn't regress.

### 10. Model portfolio refresh missing from SDK `onSuccess`

Every legacy modal posts to `${ccxtUrl}rebalance/change_broker_model_pf` after successful broker connection (non-critical, swallows errors). SDK's `Phase3SdkBrokerModal.onSuccess` (line 160-170) does NOT make this call.

**Fix path:** In `Phase3SdkBrokerModal.onSuccess` (after `fetchBrokerStatusModal()` succeeds), POST to `change_broker_model_pf` with the broker name. Or add the call to `fetchBrokerStatusModal` itself.

---

## 2026-07-18 — Connection UX routing addendum

The broker guide is resolved after SDK display-name selection, not only from the
picker key. `ICICI Direct` and `Hdfc/HDFC Securities` must normalise to ICICI
and HDFC respectively; otherwise they silently route to the old inline-help UI.
The current common route is guide card → (when required) static-IP callout → SDK
form/OAuth. The walkthrough action is an in-app player overlay. Only a broker
portal or AlphaQuark-hosted Cashfree mandate opens outside the app.

For the customer-pays IPv4 path, returning from the browser never completes the
connection on its own: the app calls `/api/egress-ipv4/verify` and enables the
form only after the server reports a confirmed mandate and allocated address.
