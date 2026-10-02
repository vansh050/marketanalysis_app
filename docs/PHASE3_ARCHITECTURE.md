# Phase 3 — SDK-Primary Broker Connect: Architecture

> **Source of truth for the Phase 3 SDK migration design.** Update this doc BEFORE writing the matching code change. See `CLAUDE.md § Phase 3 SDK Broker Migration — BLOCKING DOCUMENTATION REQUIREMENT`.

## Broker WebView renderer lifecycle (2026-09-22)

`WebViewBrokerAuthFlow` owns recovery when the operating system terminates its
native web-content process. Android reports this through
`onRenderProcessGone`; Apple WebKit uses `onContentProcessDidTerminate`. The
dead native view cannot be reused, so the RN SDK replaces it with a newly keyed
WebView at the same broker login URL. One automatic recovery is allowed. If the
replacement process also terminates, the widget emits
`broker_webview_process_gone` through its existing `onError` contract and the
host returns to its retryable broker form instead of leaving a dead login page.

This is SDK-owned behavior for all OAuth brokers. The AlphaB2B build has
`REACT_APP_USE_SDK_BROKER_FLOW=true`, so Zerodha uses this SDK WebView path;
IIFL remains the explicit legacy fallback. The 2026-09-22 user report did not
include an Android stack trace, so renderer termination is treated as the
guarded crash class, not claimed as a log-confirmed diagnosis.

## What Phase 3 is

Phase 3 replaces the per-broker legacy connect modals (`src/components/BrokerConnectionModal/*`) with widgets from the in-house React Native SDK package `@alphaquark/mobile-sdk` (`BrokerCredentialForm`, `WebViewBrokerAuthFlow`). The replacement is gated by:

1. A global feature flag `REACT_APP_USE_SDK_BROKER_FLOW` (read in `src/GlobalUIModals/ModalManager.js`).
2. A per-broker allowlist `SDK_ELIGIBLE_MODALS` inside the same file.
3. A per-broker fallback set `SDK_LEGACY_FALLBACK` for brokers that are in the allowlist conceptually but currently route to legacy because of an open SDK gap.
4. A re-auth bypass: when `modalPayload.reauthConfig` is non-null, ALL brokers route to legacy regardless of flag/allowlist.

Phases 1 and 2 (SDK service singleton + dual-write shadow) are upstream of this and shipped earlier — see `docs/SDK_MOBILE_FIT_ASSESSMENT.md` for the high-level migration plan.

## Routing rules — `BrokerConnectModalDispatch.js`

The Phase 3 dispatch is the SINGLE place where SDK-vs-legacy routing happens. It lives in `src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js` and is invoked from BOTH:

1. `src/GlobalUIModals/ModalManager.js` — for modals opened via the Zustand `visibleModal` store.
2. Inline render sites (`src/components/AdviceScreenComponents/StockAdvices.js`, `RebalanceAdvices.js`, etc.) — which previously rendered legacy modals directly via local `useState` and bypassed Phase 3 routing entirely. Fixed 2026-04-28; see `PHASE3_PROGRESS.md`.

The dispatch runs before the `switch` over per-broker legacy modals.

```
if (useSdkBrokerFlow() && !isReauthFlow && SDK_ELIGIBLE_MODALS.has(visibleModal)) {
  if (!SDK_LEGACY_FALLBACK.has(visibleModal)) {
    return <Phase3SdkBrokerModal {...commonProps} brokerName={visibleModal} />;
  }
  // else fall through to legacy switch
}
// else fall through to legacy switch
```

Three predicates, each independently necessary:

- **`useSdkBrokerFlow()`** — getter around `Config.REACT_APP_USE_SDK_BROKER_FLOW`. Reads `'true' | '1' | 'yes'` (case-insensitive) as on. Default off in main; this branch ships off.
- **`!isReauthFlow`** — `isReauthFlow := !!modalPayload?.reauthConfig`. Set by `ManageConnectionsModal`'s smart-reauth flow when a credential broker (Upstox/ICICI/HDFC/Motilal/Fyers) needs to re-validate after an existing-session bounce. The legacy modals consume `reauthConfig` to pre-fill the WebView; the SDK widget always starts fresh, so re-auth would lose the pre-fill. Always legacy.
- **`SDK_ELIGIBLE_MODALS.has(visibleModal)`** — explicit per-broker opt-in. The visibleModal key is the Zustand store's `visibleModal` field (e.g. `'ICICI'`, `'Angel One'`, `'Axis Securities'`), NOT the SDK's BrokerName wire enum. The mapping happens inside `Phase3SdkBrokerModal.visibleModalToBrokerName()`.
- **`!SDK_LEGACY_FALLBACK.has(visibleModal)`** — temporary fallback for brokers conceptually in the allowlist but with an unresolved SDK gap. Today: `Angel One` (per-customer SmartAPI mismatch + shared-mode exchange-token gap) and `Zerodha` (Android 302-redirect intercept timing).

Re-auth's "always legacy" rule is documented per-broker in `PHASE3_BROKER_AUDIT.md` because the `reauthConfig` payload shape varies by broker.

## `SDK_ELIGIBLE_MODALS` — the allowlist

**Allowlist removed 2026-04-29.** The `SDK_ELIGIBLE_MODALS` Set + `SDK_LEGACY_FALLBACK` kill-switch are deleted from `BrokerConnectModalDispatch.js`. With the SDK package at parity with Flutter (RN SDK gained `BrokerFormField.initialValue` + `transformValue` mirroring Flutter commit `64d4eff`) the per-broker gating is no longer load-bearing.

**Today's routing rule (post 2026-04-29 reauth-via-initialValue):**
```
if (REACT_APP_USE_SDK_BROKER_FLOW is on) {
  return <Phase3SdkBrokerModal {...} brokerName={key} />;
}
// else legacy switch
```

When the flag is on, the dispatcher normally routes brokers through `Phase3SdkBrokerModal` for both first-connect and re-auth. IIFL is the explicit exception: `SDK_LEGACY_FALLBACK` sends it to the re-certified native `IIFLModal`, because the current SDK schema models a different credentials/TOTP product rather than IIFL's customer-owned App Key/App Secret + OAuth flow. This exception is required for correctness, not a staged rollout preference.

`deviceTotpEnabled` may wrap this dispatch for assisted reconnect, but it must
not shadow first-time Fyers onboarding. With no persisted Fyers broker slot,
`DeviceTotpReconnectGate` renders the canonical Fyers developer-portal guide,
redirect URL and dedicated-static-IP acknowledgement alongside the optional
phone-TOTP fields. It then hands off to `Phase3SdkBrokerModal` (or the legacy
equivalent) for App ID/Secret entry and OAuth. The staged device values are
persisted only after that authorization succeeds. This sequencing is made by
the host and does not indicate SDK failure or legacy fallback.

**Re-auth pre-fill (no authUrl path).** When the user reconnects an already-connected broker, `Phase3SdkBrokerModal` fetches `userDetails` on mount, reads `connected_brokers[broker]` via `src/utils/brokerCredentials.js#getStoredBrokerCreds`, and builds a per-broker `schemaOverride` whose fields carry `initialValue`. The SDK form's `useState` initialiser merges these with the base schema and seeds the controllers. One unified path.

**Re-auth direct-to-OAuth (post 2026-04-30).** For OAuth-flow brokers in `OAUTH_REAUTH_AUTOJUMP_BROKERS` (Zerodha, Upstox, ICICI Direct, Hdfc Securities, Motilal Oswal, Fyers, Dhan, AliceBlue, Axis Securities), the `Phase3SdkBrokerModal` skips `<BrokerCredentialForm>` entirely on re-auth and hands stored apiKey + secretKey + clientCode directly to `<WebViewBrokerAuthFlow>` as `extraExchangeBody`. The SDK's `/login-url` route mints a fresh OAuth URL from those creds, the WebView opens the broker's login page, and the user is usually one TOTP away from done — restoring the legacy `reauthConfig.authUrl` UX without the legacy round-trip. The auto-jump is single-fire (`reauthJumpFiredRef`) so `userDetails` refreshes during the WebView phase don't yank the user back.

For the Kotak credentials_totp re-auth path the equivalent is "skip the persistable fields, show only the unavoidable mpin + totp" — `buildSchemaOverride` marks `apiKey`, `mobileNumber`, `ucc` with `hideFromUi: true` when stored entry is present. The SDK widget filters those rows from render but keeps their `initialValue` flowing into the submit body. Angel One is excluded because it's in `SDK_LEGACY_FALLBACK` (shared-mode is the default and the SDK doesn't yet do shared-key OAuth — see `BrokerConnectModalDispatch.js`).

First-connect path (no stored entry): `getStoredBrokerCreds` returns null, the auto-jump effect bails, every `initialValue` resolves to `''`, no field is hidden — the form renders empty. Same UX as before.

The legacy pre-signed `authUrl` flow (`src/utils/reauthHelpers.js#handleSmartReauth`) is **unused on the SDK lane** — SDK always mints a fresh login URL via `client.getBrokerLoginUrl`. The legacy `reauthConfig` is still resolved by `ManageConnectionsModal` for the legacy lane (flag off), where modals like `UpstoxModal` continue to consume `reauthConfig.authUrl` to skip the credentials form. SDK lane ignores it. Mirror of tidi_new commit `2d44fbf` (Kotak smart-prefill + Groww silent refresh + Fyers field inversion).

**Per-broker schema override builder** lives in `Phase3SdkBrokerModal.js#buildSchemaOverride(brokerName, userDetails)`. Today's coverage:

| Broker | Fields pre-filled from stored creds | Notes |
|--------|------------------------------------|-------|
| Zerodha / Dhan / AliceBlue / Axis Securities | (none) | OAuth-only schemas, empty fields, no override needed |
| Kotak | apiKey + ucc + mobileNumber | mpin + totp deliberately NEVER pre-filled (security; rotation). mobileNumber sourced from `userDetails.phone_number` (top-level). `transformValue: normaliseKotakMobile` applied per-keystroke + paste so any input shape (`+91 9876543210`, `09876543210`, `98765 43210`) reduces to canonical `+919876543210` for both validation and submit. |
| Groww | apiKey + growwTotpSeed | `getStoredBrokerCreds` returns `{apiKey, totpToken}`; SDK schema field name is `growwTotpSeed`. Both stored encrypted; decrypted client-side. |
| Motilal Oswal | apiKey + clientCode | Two-field schema. |
| Fyers | apiKey + secretKey + clientCode | `getStoredBrokerCreds` already inverts Fyers' DB naming (DB.secretKey → modal.apiKey, DB.clientCode → modal.secretKey + modal.clientCode); see `brokerCredentials.js:46-53`. We pass through what it returns. |
| Angel One (per-customer) | apiKey + secretKey + clientCode | Shared mode would need a different override (empty-fields like Zerodha); first-connect for shared advisors today still surfaces the per-customer form. Tracked as Known Gap. |
| Upstox / ICICI Direct / Hdfc Securities | apiKey + secretKey | Standard two-field credential schema. |
| IIFL Securities | (legacy-owned App Key/App Secret) | Schema mismatch keeps IIFL on the deliberate fallback. The legacy modal uses Node `/api/iifl/reauth-url` to reuse saved direct credentials, so no SDK override applies. |

**If a specific broker is broken in the SDK at any point, the fix is to fix the SDK widget — NOT to re-introduce a per-app allowlist.** The SDK package is the single point of broker-flow truth; per-app exception lists encourage drift between Alphab2bapp and tidi_new (which is exactly what `docs/SDK_PARITY_AUDIT.md § 2` flagged).

**Promotion rule:** a broker is added to this Set ONLY when:

1. Its row in `PHASE3_BROKER_AUDIT.md` reads verdict=SDK-clean.
2. End-to-end emulator verification through `Phase3SdkBrokerModal` is recorded in `PHASE3_PROGRESS.md` (form phase + WebView phase + success refresh + error path).
3. Any backend SDK-route changes the broker depends on are deployed and documented in `PHASE3_ARCHITECTURE.md § Backend routes`.

**Future enhancement:** consider per-broker env flags (e.g. `REACT_APP_USE_SDK_KOTAK=true`) for staged rollout. The master flag `REACT_APP_USE_SDK_BROKER_FLOW=true` remains the on-switch.

> **Superseded 2026-09-29:** today the dispatcher has `SDK_LEGACY_FALLBACK = new Set(['IIFL'])`, and device-TOTP brokers leave the SDK lane via `secureTotpHostFlow` / `secureAliceBlueHostFlow`, not via this set. The current per-broker routing is the canonical table in `docs/BROKER_CONNECTION.md` § "Broker connect routing matrix". The paragraph below is historical.

**`SDK_LEGACY_FALLBACK = new Set(['Angel One', 'Zerodha'])`** is kept defensively while the allowlist is empty; it has no practical effect (the broker has to be in the allowlist for the fallback to even matter). Once a broker is promoted, `SDK_LEGACY_FALLBACK` is the immediate kill-switch for that broker without removing it from the allowlist. If the allowlist stays empty long-term, `SDK_LEGACY_FALLBACK` and the entire `useSdkBrokerFlow() && !isReauthFlow && ...` block become dead code and can be deleted.

## Angel One — per-customer SmartAPI only (2026-07-18)

AlphaB2B no longer permits the platform/shared SmartAPI key for customer
connections. `BrokerConnectModalDispatch` routes Angel One directly to
`Phase3SdkBrokerModal` even if the SDK master flag is off; that modal always
collects the customer’s own `apiKey`, `secretKey`, and `clientCode` and always
shows the Angel One static-IP gate. `AngleoneBookingTrueSheet` is no longer a
reachable connect route.

`useSharedAngelOneKey`, `REACT_APP_USE_SHARED_ANGEL_ONE_KEY`, and
`REACT_APP_ANGEL_ONE_API_KEY` may remain in cached/backend configuration for
legacy data and other clients, but they must not select a mobile connection
path. Do not reintroduce shared-mode instructions or a one-tap publisher login.

**2026-09-29 correction:** the statement above was not true for device-TOTP
tenants. The dispatcher used `angelOnePerCustomer && !secureTotpHostFlow`, so
with `deviceTotpEnabled=true` Angel One went to `renderLegacyModal` →
`AngleoneBookingTrueSheet` (shared SmartAPI key) as the
`DeviceTotpReconnectGate` fallback. Now `angelOnePerCustomer` alone selects
`Phase3SdkBrokerModal` (the gate wraps it for quick reconnect) and the
`'Angel One'` case was removed from `renderLegacyModal`. Guarded by
`src/__tests__/brokerDispatchRouting.test.js`.

## `Phase3SdkBrokerModal` — component contract

File: `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js`

**Props (from ModalManager `commonProps`):**

| Prop | Type | Notes |
|------|------|-------|
| `isVisible` | bool | Controls render. False renders null. |
| `onClose` | () => void | Dismisses the modal — wired to `closeModal` from Zustand store. |
| `setShowBrokerModal` | (bool) => void | Legacy compat — closes the parent broker selection modal. |
| `fetchBrokerStatusModal` | () => Promise | Refreshes connected-brokers list after success. |
| `reauthConfig` | object \| null | NOT consumed in Phase 3 (re-auth always routes to legacy). |
| `brokerName` | string | The Zustand `visibleModal` key — translated internally via `visibleModalToBrokerName`. |

**State:**

- `oauthExtraBody` — when non-null, render is in OAuth phase (WebView). Set by `BrokerCredentialForm.onContinueToOauth` callback.
- `errorInfo` — structured `{title, body, technical}` produced by `humanizeSdkError(sdkError, brokerName)`. Renderer shows title (semibold), body (regular), and a small monospace `technical` breadcrumb caption. Cleared on next successful `onContinueToOauth`. **Replaced the prior flat `errorMessage` string** which was built from the wrong `SdkError` fields (`code` / `httpStatus` — neither exists on `SdkError`, which uses `error` / `detail` / `httpStatus`) and surfaced as the literal `sdk_error: <detail>` for every broker, every error.
- `egressReady` — IP-whitelist gate for `IP_WHITELIST_BROKERS`. Initialized to `!IP_WHITELIST_BROKERS.has(brokerName)` so non-IP brokers start ready. Set true by `EgressIpCallout.onAcknowledgeChange` when the user ticks the ack.
- `unmetAck` — drives the `EgressIpCallout` `showUnmetAck` flash. Set true by `nudgeEgressAck()` (called when the user taps the locked-form banner) and cleared via `onUnmetAckHandled`. Surfaces *why* the form is locked instead of leaving the user staring at a dimmed form.
- `scrollRef` — ref on the form-phase `ScrollView`. `nudgeEgressAck()` scrolls it to `y: 0` so the flashing IP-whitelist checkbox is brought back into view.

**Error envelope contract — humanizeSdkError**

The SDK passes `SdkError` (`{error, detail?, httpStatus?, upstream?}`) into `onError` callbacks. `Phase3SdkBrokerModal` does NOT render this object directly — it routes through `src/utils/sdkErrorHumanize.js` which:

1. Maps the SDK-stage code (`error` field — one of `broker_login_url_failed`, `broker_exchange_failed`, `credential_submit_failed`, `edis_action_failed`, `rebalance_execute_failed`) to a `{title, body}` user-facing pair.
2. Refines the body when an upstream backend code is present in `detail` (e.g. `broker_credential_validate_failed`, `redirect_url_mismatch`, `invalid_api_key`, `app_config_ambiguous`, `internal_error`, `no_user_email_in_session`, `tenant_db_unresolved`).
3. Builds a `technical` breadcrumb like `broker_login_url_failed → internal_error (HTTP 500)` for support diagnostics (rendered as a small caption beneath the body).
4. Falls through to a generic title + body for unmapped codes — the breadcrumb is always rendered so unknown codes are still triageable.

When extending with new SDK error codes, add them to either `SDK_STAGE_COPY` (if a new SDK-stage code) or `UPSTREAM_REFINEMENT` (if a new backend / upstream code). Don't re-introduce flat-string error rendering in `Phase3SdkBrokerModal` — every error must go through the humanizer so users always see actionable copy and support always sees the breadcrumb.

**Phases:**

- **Form phase (`oauthExtraBody === null`)** — Renders `EgressIpCallout` (only for IP brokers) + `BrokerCredentialForm`. Until `egressReady`, the form is **clearly labeled as locked**, not silently dimmed: an amber `lockNotice` banner ("🔒 One step left — tick the … whitelist box above … Tap here to jump back to it") renders directly above the form; the form `View` gets `pointerEvents="none"` + a gentle `formWrapLocked` dim (`opacity: 0.55`). Tapping the banner runs `nudgeEgressAck()` → flashes the `EgressIpCallout` checkbox (`showUnmetAck`) and scrolls back up to it. **Replaced the prior bare `opacity: 0.45` wrap**, which users reported as a mysterious "white transparent layer" with no indication that the IP-whitelist checkbox above was the blocker (Upstox bug-77, 2026-05-28).
- **OAuth phase (`oauthExtraBody !== null`)** — Renders `WebViewBrokerAuthFlow` with `extraExchangeBody = oauthExtraBody`. WebView's `onClose` drops back to form (preserving collected creds via component state — actually this is a bug, see below); `onSuccess` calls `fetchBrokerStatusModal()` then `onClose()`; `onError` resets `oauthExtraBody = null` and shows the error.

**Layout:**

- Modal is a bottom-anchored sheet at `height: 95%`. Earlier `minHeight: 60% / maxHeight: 92%` squeezed the WebView into an unusable strip.
- Tap-outside-to-dismiss via `Pressable` scrim. Inner `Pressable` panel catches taps via `onPress={() => {}}`.
- Top-right close `✕` button in `Header` — needed because users can land in error states or stuck WebViews; without the explicit close affordance there is no way out.
- **Form-phase scroll surface (bug-78 fix, 2026-05-29):** the form-phase `ScrollView` carries `style={styles.formScroll}` (`flex: 1`) and `contentContainerStyle={styles.scrollPad}` (`flexGrow: 1`). This is load-bearing: `formWrap` (which wraps the SDK `BrokerCredentialForm`) is `flex: 1`, and a `flex: 1` child inside a *content-sized* ScrollView collapses to 0 height. For brokers WITH an `EgressIpCallout` + `Phase3BrokerHelp` (Upstox/ICICI/Kotak) the siblings still showed, masking the collapse; but **empty-field brokers with no callout and no help (Dhan, AliceBlue)** had `formWrap` as the only child → the entire body rendered blank ("Connect Dhan" header over a white void — bug-78/bug-79). Giving the ScrollView `flex: 1` (fill the panel below the Header) + the content container `flexGrow: 1` gives `formWrap`'s flex a bounded parent to resolve against: short brokers fill the viewport and render; taller brokers overflow and scroll. Do NOT drop `formScroll`/`flexGrow` without re-testing Dhan + AliceBlue specifically.

**Field encryption:**

- `encryptField(_fieldName, raw) → CryptoJS.AES.encrypt(raw, 'ApiKeySecret').toString()` — same envelope as every legacy modal (KotakModal:46, MotilalModal:50). Backend `/update-key` and `/connect-broker` decrypt with the same `'ApiKeySecret'` passphrase.

**Zerodha apiKey seeding:**

- Zerodha's SDK schema is empty-fields (`flow=oauth, fields=[]`). When `onContinueToOauth({})` fires, we seed `apiKey` from `Config.REACT_APP_ZERODHA_API_KEY` or `configData.config.REACT_APP_ZERODHA_API_KEY` so ccxt-india's `gen-access-token` has it alongside `request_token`.

**Known design issues** (tracked in `PHASE3_BROKER_AUDIT.md`):

- `WebViewBrokerAuthFlow.onClose` resets `oauthExtraBody` to null but the form re-mounts losing collected creds (form state is local). For Zerodha this doesn't matter (empty fields); for OAuth brokers with apiKey/secret entry it's a UX regression vs legacy.
- `EgressIpCallout` only fires `onAcknowledgeChange(true)` when the user explicitly ticks; for brokers in `IP_WHITELIST_BROKERS` this means form stays disabled until interaction. Legacy modals had a smoother "claim + auto-detect" flow. **Mitigated 2026-05-28**: the locked form now shows an explicit `lockNotice` banner + flashes the checkbox on tap (`nudgeEgressAck`), so the disabled state is self-explanatory rather than a silent dim.

## `BrokerCredentialForm` — SDK widget contract

Source: `../../alphaquark-mobile-sdk/packages/rn/src/components/BrokerCredentialForm.tsx`. Schema: `brokerFormSchema.ts`.

**Per-broker schema fields (key ones):**

| Broker | flow | fields | submitEndpoint |
|--------|------|--------|----------------|
| Dhan | credentials | accessToken | connect |
| AliceBlue | credentials | apiKey, userId | connect |
| Groww | credentials | accessToken | connect |
| Kotak | credentials_totp | consumerKey, consumerSecret, mobileNumber, password, mpin | update-credentials |
| IIFL Securities | credentials | apiKey, interactiveSecret, marketSecret, userId | update-credentials |
| Angel One | oauth | apiKey, secretKey, clientCode | (oauth → exchange-token after WebView) |
| Zerodha | oauth | (empty — auto-skip to onContinueToOauth) | (oauth) |
| Upstox | oauth | apiKey, apiSecret | (oauth) |
| Fyers | oauth | apiKey, apiSecret | (oauth) |
| ICICI Direct | oauth | apiKey, apiSecret | (oauth) |
| HDFC Securities | oauth | apiKey, apiSecret, password | (oauth) |
| Motilal Oswal | oauth | apiKey, apiSecret, userId, password, totpSecret | (oauth) |
| Axis Securities | oauth | apiKey, apiSecret, userId | (oauth) |
| DummyBroker | stub | (none) | (stub-success) |

**Callbacks (the only API surface ModalManager uses):**

- `onContinueToOauth(collectedFields)` — fires for `flow=oauth` after the form's Continue is tapped. Payload is `{<fieldName>: <encryptedValueOrRaw>}` — encryption applied via the parent-supplied `encrypt` callback.
- `onSuccess(result)` — fires for `flow=credentials | credentials_totp | stub` after the form's submit endpoint returned 2xx.
- `onError(sdkError)` — `{code, httpStatus?, detail?, message?}` shape. Phase3SdkBrokerModal renders this above the form.

**Encryption hook:**

- `encrypt(fieldName, raw) → Promise<string>` — parent-supplied. Phase3SdkBrokerModal passes the AES-CBC-with-passphrase `'ApiKeySecret'` envelope.

**TOTP-window debounce (`flow === "credentials_totp"`):**

- A 30s in-flight + reuse cooldown gates back-to-back submits for any
  `credentials_totp` schema (Kotak today). `lastTotpSubmitAtRef` is
  stamped BEFORE the network call so a user double-tap, an in-flight
  retry, or a slow upstream response can't burn the same code on the
  next attempt. Within the window the second submit short-circuits
  with the inline banner `"TOTP rotates every 30s and cannot be
  reused. Generate a fresh 6-digit code in your authenticator and try
  again in ~Xs."` and never reaches the network — preventing the
  Kotak `Invalid TOTP` surface from masking an already-successful
  first attempt. Mirror of legacy `KotakModal.js:128-167` (the legacy
  modal documented the same hazard with the same window). Source:
  `BrokerCredentialForm.tsx` § `TOTP_REUSE_COOLDOWN_MS`.

## `WebViewBrokerAuthFlow` — SDK widget contract

Source: `../../alphaquark-mobile-sdk/packages/rn/src/components/WebViewBrokerAuthFlow.tsx`.

**Inputs:**

- `broker` — SDK BrokerName.
- `redirectUrl` — string. The widget watches WebView navigations for a URL whose pathname matches this redirectUrl's pathname AND captures querystring params.
- `extraExchangeBody` — object merged into the `/exchange-token` POST body. ModalManager passes the encrypted creds collected in form phase (e.g. `{apiKey, apiSecret}`).

**Lifecycle:**

1. POST `/sdk/v1/connections/:broker/login-url` with `extraExchangeBody` → response `{loginUrl}`.
2. Open WebView at `loginUrl`.
3. Watch navigations via three hooks: `onShouldStartLoadWithRequest`, `onNavigationStateChange`, `onLoadStart` (added 2026-04-28 for Android 302 races — still insufficient for Zerodha's `/stock-recommendation` 302→`/login` chain).
4. On match: POST `/sdk/v1/connections/:broker/exchange-token` with `{...extraExchangeBody, ...capturedQueryParams}`.
5. Surface `onSuccess(BrokerExchangeResult)` or `onError(sdkError)`.

**Known timing gap (Zerodha):** Android resolves server 302 redirects internally before the JS hooks fire, so when `prod.alphaquark.in/stock-recommendation` 302's an unauthenticated visitor to `/login`, the widget never sees the original `/stock-recommendation?request_token=…` URL. Fix is out-of-band — register a non-redirecting redirect URL on the Kite developer portal (e.g. `app-links.alphaquark.in/zerodha-callback`).

**AliceBlue-only WebView overrides (2026-06-11).** Two props are conditionally set when `broker === "AliceBlue"` (undefined for every other broker — all verified working on platform defaults, and changing a working broker's UA is an unverified fan-out change):

1. **`injectedJavaScriptBeforeContentLoaded` — WKWebView API shims + OTP interceptor. THE PRIMARY iOS blank-page fix.** Root cause (verified by reading AliceBlue's deployed bundle `assets/index-6a09ab85.js`): the portal's Vue entry module runs **firebase-messaging at module top level, BEFORE `mount("#app")`** — its factory calls `navigator.serviceWorker.addEventListener("message", …)` unguarded, and a UA-gated branch calls `Notification.requestPermission()`. **iOS WKWebView has neither API** (Service Workers / Web Push are Safari-only), so AliceBlue's own bootstrap throws a TypeError, aborts before mount, and `<div id="app">` stays empty → **blank page**. Android WebView supports both APIs → works — the exact iOS-blank/Android-fine signature. The injected script stubs `navigator.serviceWorker` (no-op listeners, rejecting `register`) and `window.Notification` (`permission='denied'`), then arms the legacy OTP-validate redirect interceptor (verbatim from `AliceBlueConnectUI.js` / tidi_new `BrokerAuthPage.dart`: patches fetch/XHR, watches `/omk/auth/access/v1/otp/validate`, force-navigates to its `redirectUrl` — covers AliceBlue's historically broken post-OTP redirect, their Keycloak `alice-kb` client allow-lists only localhost origins). Shims are no-ops on Android; interceptor self-deactivates unless an otp/validate response carries `authCode=`.
2. **`userAgent` (iOS only) — supporting fix.** Safari-style iPhone UA. AliceBlue's bundle UA-gates the `Notification.requestPermission()` call — mobile-looking UAs skip it; desktop-class UAs (e.g. iPad's default desktop UA, no iPhone/iPad token) would call it. The iPhone UA keeps us on the safe branch and matches the legacy modal (`59e8e1f`, 2026-03-02). First shipped 2026-06-11 as the presumed root cause; insufficient alone — the serviceWorker abort happens on every UA.

**Same shim added to the legacy lane** (`src/UIComponents/BrokerConnectionUI/AliceBlueConnectUI.js`, prepended to its `ALICEBLUE_REDIRECT_INTERCEPTOR`) in the same commit — legacy had the identical latent iOS bug; per the repo rule, every code path gets the fix in one cycle. Keep the SDK and legacy copies of the shim in sync.

**Cross-platform parity:** the same shims + UA exist in the Flutter package (`packages/flutter/lib/src/widgets/webview_auth_flow.dart` — `_kAliceBlueIosUserAgent` via `setUserAgent` gated on `defaultTargetPlatform == TargetPlatform.iOS`; shims + interceptor injected on `onPageStarted`/`onPageFinished` for `aliceblueonline.com` pages). **Known Flutter caveat:** webview_flutter has no document-start injection hook, so on iOS the shim races the page's module script — the RN package's `injectedJavaScriptBeforeContentLoaded` (WKUserScript at document start) is the reliable mechanism.

## `EgressIpCallout` — IP-whitelist gate

File: `src/components/BrokerConnectionModal/EgressIpCallout.js`. Used for brokers whose API server requires the caller IP to be whitelisted in the broker's developer portal:

```
IP_WHITELIST_BROKERS = { Kotak, Groww, AliceBlue, ICICI, ICICI Direct }
```

Behavior:

- For non-IP brokers: zero-height widget; `onAcknowledgeChange(true)` fires immediately on mount.
- For IP brokers: shows the egress IP claim UI + acknowledgment checkbox. `onAcknowledgeChange(true)` fires only when the user ticks ack.

**Broker-key contract (bug-81, 2026-05-29):** `EgressIpCallout` resolves against its own internal `WHITELIST_BROKERS` set of **lowercase, no-space backend broker_keys** (`upstox`, `fyers`, `kotak`, `groww`, `icicidirect`, `hdfcsec`, `motilaloswal`, `angelone`, `iifl`). It lowercases the `broker` prop and, if the result isn't in that set, **short-circuits to `brokerState="partner"` and renders nothing**. Every legacy `*ConnectUI` caller passes the right key (`broker="icicidirect"`, etc.). Phase3SdkBrokerModal, however, has the **display name** in `brokerName` (`"ICICI Direct"`, `"Hdfc Securities"`, `"Motilal Oswal"`), which lowercases to `"icici direct"` (with a space) — not in the set — so the IP panel silently disappeared for those three brokers while their instructions still referenced the missing "IP-whitelist panel above" (user: "I can't see the IP field for ICICI"). Single-word brokers (Upstox/Fyers/Kotak/Groww) lowercased to the correct key by coincidence, masking the bug. **Fix:** Phase3SdkBrokerModal now maps `brokerName → EGRESS_BROKER_KEY` before passing `broker=` to the callout. Any new IP broker added to the modal MUST have an `EGRESS_BROKER_KEY` entry matching `EgressIpCallout.WHITELIST_BROKERS`.

In Phase3SdkBrokerModal, `egressReady` initial state is `!IP_WHITELIST_BROKERS.has(brokerName)`, so non-IP brokers start unblocked. The form is gated per the Form-phase section above (labeled `lockNotice` + `pointerEvents` + `formWrapLocked` dim until acknowledged).

## Backend routes — `aq_backend_github/Routes/sdk/v1/connections.js`

The SDK widgets POST to one of three endpoints, all under `/sdk/v1/connections/:broker/`:

| Endpoint | Used for | Backend impl |
|----------|----------|--------------|
| `/login-url` | OAuth flow — fetch the broker's authorize URL | Calls ccxt-india `<broker>/login-url` with the advisor's apiKey resolved from `all_advisor_details` (commit 583876b). Some brokers (Angel One shared mode, Axis SSO) need broker-specific resolution. |
| `/exchange-token` | OAuth flow — exchange request_token / auth_code for session | Calls ccxt-india `<broker>/gen-access-token` (or equivalent) with merged `extraExchangeBody + capturedQueryParams`. Persists the new session via the legacy persist path. |
| `/update-credentials` | credentials / credentials_totp flow | Proxies to the legacy per-broker `/update-key` route via the `CREDENTIAL_BROKER_VALIDATE_DISPATCH` map (commit 0e2ef25 + 6f25766). Validates against ccxt before persistence. |
| `/connect` | credentials flow (Dhan, AliceBlue, Groww-creds) | Calls ccxt validate with the credentials; if 2xx persist via `/api/user/connect-broker`. Rejects pre-OAuth raw creds for Angel One specifically (no jwtToken in body → 400). |

Auth model: every backend self-call to ccxt or to the legacy node routes uses `SecurityTokenManager.generateServiceToken()` — a signed 15s-TTL JWT. Replaced the buggy raw `apiKey`-in-header pattern (and the briefly-used `BYPASS_TOKEN`). Latest commit on `connections.js`: `0838f69`.

Per-broker dispatch:

- `LEGACY_PER_BROKER_SLUG` maps SDK BrokerName → legacy-route slug (e.g. `"Angel One" → "angel-one"`, `"ICICI Direct" → "icici"`). Used to route `/update-credentials` and `/connect` to the matching legacy `/api/<slug>/update-key`.
- `CREDENTIAL_BROKER_VALIDATE_DISPATCH` controls which brokers run the pre-persist ccxt validation step: AliceBlue, Dhan, Groww. Angel One was removed because it routes through `/update-credentials` only (per-customer mode); shared-mode Angel One has no SDK route.

## Re-auth flow

Triggered by `ManageConnectionsModal`'s smart-reauth handler when an existing broker session is invalid. Flow:

1. ManageConnectionsModal calls `openModal(brokerKey, {reauthConfig: {…}})`.
2. ModalManager reads `modalPayload.reauthConfig` from Zustand store.
3. `isReauthFlow = !!reauthConfig` short-circuits the Phase 3 dispatch — every broker routes to legacy.
4. Per-broker legacy modal reads `props.reauthConfig` and pre-fills the WebView with the existing apiKey/secret + immediately opens the broker's OAuth URL, skipping the credential form.

**Why re-auth must stay legacy:** the SDK `BrokerCredentialForm` always starts fresh — no prop to pre-fill encrypted-already-stored creds. Routing re-auth through Phase 3 would force the user to re-enter everything they already entered last week, defeating the smart-reauth UX. SDK gap; tracked in `PHASE3_BROKER_AUDIT.md` per credential broker.

## `.env` flags consumed by Phase 3

| Variable | Effect |
|----------|--------|
| `REACT_APP_USE_SDK_BROKER_FLOW` | Master Phase 3 on/off. Default off. |
| `REACT_APP_USE_SHARED_ANGEL_ONE_KEY` | Build-time default for `useSharedAngelOneKey` when no backend value. Default true. |
| `REACT_APP_BROKER_CONNECT_REDIRECT_URL` | Redirect URL passed to `WebViewBrokerAuthFlow.redirectUrl`. Same var used by every legacy OAuth modal — see `CLAUDE.md § Shared env vars across brokers`. |
| `REACT_APP_ZERODHA_API_KEY` | Seeded into `oauthExtraBody.apiKey` for Zerodha (form is empty-fields). |
| `REACT_APP_ANGEL_ONE_API_KEY` | Read by ccxt-india `/angelone/login-url` in shared mode; the SDK widget does NOT pass it. |
| `REACT_APP_SDK_INTEGRATION` | Phase 1 flag — wraps the tree with `<AqSdkProvider/>`. Phase 3 requires this true. |
| `REACT_APP_SDK_MINT_URL` | Multi-tenant mint server URL. Today: `https://app-links.alphaquark.in/sdk/mint`. |
| `REACT_APP_SDK_BASE_URL` | SDK API base — points at `aq_backend_github`. Today: `https://server.alphaquark.in`. |

## Open SDK gaps (block verdict=SDK-clean)

- Angel One shared-mode `/login-url` resolution + `/exchange-token` callback handler.
- Angel One per-customer `flow=credentials-then-oauth` widget shape.
- Zerodha non-302 redirect URL on Kite developer portal.
- Axis Securities `/login-url` proxy — current path returns `broker_login_url_failed`.
- AliceBlue partner-OAuth flow — legacy doesn't show a credential form, opens broker web auth directly. SDK widget today wrongly shows `apiKey + userId` form.
- Re-auth pre-fill API on `BrokerCredentialForm`.
- `WebViewBrokerAuthFlow.onClose` cred preservation when dropping back to form phase.

## Pointers

- ModalManager: `src/GlobalUIModals/ModalManager.js`
- Phase3SdkBrokerModal: `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js`
- EgressIpCallout: `src/components/BrokerConnectionModal/EgressIpCallout.js`
- SDK widgets: `../../alphaquark-mobile-sdk/packages/rn/src/components/`
- SDK schema: `../../alphaquark-mobile-sdk/packages/rn/src/components/brokerFormSchema.ts`
- Backend SDK routes: `../aq_backend_github/Routes/sdk/v1/connections.js`
- Mint server: https://github.com/pk1762012/aq-sdk-mint-server
- Phase 1/2 background: `docs/SDK_MOBILE_FIT_ASSESSMENT.md`
- Per-broker audit: `docs/PHASE3_BROKER_AUDIT.md`
- Work log: `docs/PHASE3_PROGRESS.md`

---

## 2026-07-18 — Phase3SdkBrokerModal contract updates: guide card + v3 touch layout

1. **Guidance parity in the host**: the form phase now renders
   `<BrokerGuideCard>` (from `brokerGuideConfigs.js` — the shared web-parity
   setup-guide content: numbered steps, portal deep-link, walkthrough video,
   copyable redirect URL) ABOVE the EgressIpCallout, for brokers with a guide
   config (Upstox/HDFC/ICICI/Kotak/Groww/Fyers/Arihant/DefinEdge).
   `Phase3BrokerHelp` remains the fallback for brokers without one. This is
   why Kotak/Groww/Fyers/Upstox/HDFC/ICICI did NOT move to
   `SDK_LEGACY_FALLBACK` — per the "fix the SDK widget/host, not the
   allowlist" rule, the polish shipped in the host instead. Broker brand
   colors paint only the monogram; action accents come from the advisor/app
   theme (`useConfig()`).
2. **v3 sibling-Pressable touch layout everywhere**: the form phase and the
   missing-schema branch were still on the v2 layout (panel View claiming the
   JS responder + refusing termination), which fought the inner ScrollView's
   pan responder — user-visible as erratic/sticky credential-form scrolling
   (2026-07-18 Kotak report). Both now use the same v3 layout the OAuth phase
   already had: scrim View `pointerEvents="box-none"` + absoluteFill Pressable
   sibling BEHIND a handler-free panel View.
3. Full container/UX rules (RN `<Modal>` ban, CrossPlatformOverlay, stepper
   sheet, egress registration): `docs/BROKER_CONNECTION.md` § 2026-07-18.

### 2026-07-18 addendum — display-name guides, in-app walkthrough, and SDK skin

- `getBrokerGuideConfig()` accepts both dispatcher keys and SDK display names:
  `ICICI Direct → ICICI`, `Hdfc/HDFC Securities → HDFC`, plus the existing
  Motilal/DefinEdge aliases. This is required because the SDK exposes display
  names; without it ICICI/HDFC render the older `Phase3BrokerHelp` branch.
- `BrokerGuideCard` and `BrokerConnectStepperSheet` pass the selected video id
  to `BrokerWalkthroughPlayer`, an in-app overlay with explicit Back/Close.
  A walkthrough tap must play inside the app and preserve the connection state;
  portal and hosted-payment links remain external by design.
- `SdkProviderRoot` supplies the active advisor colour theme to
  `AqSdkProvider`. This is a host skin only: SDK schemas, validation, encryption
  and submit contracts remain owned by `alphaquark-mobile-sdk`.
- Guide copy that asks for an app name must interpolate `whiteLabelText`; never
  hard-code the AlphaQuark brand in a white-label broker instruction.
- Zerodha's empty-field OAuth form has a host-level session notice: ask the
  customer to select **Login to Kite web** on the next screen. That preserves
  the Kite web session for the broker's normal next-few-hours session window;
  it is instructional only and does not claim to change Kite's expiry policy.
- IIFL is enabled through the deliberate legacy fallback. Its re-certified
  customer-owned direct flow shows the IIFL developer portal, the exact
  redirect URL, and the customer's assigned Route64 IPv6; both values must be
  registered before continuing. App Key/App Secret are AES-wrapped for Node
  `/api/iifl/update-key`, callbacks exchange through `/api/iifl/exchange`, and
  the resulting session is persisted by `/api/user/connect-broker`.
