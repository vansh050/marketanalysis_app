# Changelog

All notable changes to the AlphaQuark B2B Mobile App are documented here.

---

## [3.9.30] - 2026-04-26

### Fixed — AliceBlue post-connect "Authentication Required" loop + place-order session-expired loop + dual-modal stack

**Symptoms (production reproduction).** After AliceBlue connect succeeded via the OTP-validate interceptor [3.9.29], the user was bounced into a misleading state: tapping Rebalance opened a "Login to AliceBlue" prompt; tapping Place Order on Step 3 returned them to the AliceBlue WebView. Token was valid throughout.

**Root cause — ccxt-side, applies to all client repos.** `aliceblue.py:_parse_funds_response` and `aliceblue.py:validate_session` both collapsed every non-`status:'Ok'` AliceBlue response into a session-expired error, including:
1. `{status:'Info', message:'…temporarily unavailable…'}` — scheduled maintenance window. Token valid.
2. `{status:'EC920', message:'…No trades found…'|'…No positions found…'}` — empty-account / no-data. Token valid.

The collapse stripped upstream context AND set `status:1` / `is_valid=False`. Two failure modes:
- **Rebalance entry**: `validateBrokerSession` saw `status:1` → TOKEN_EXPIRED → opened BrokerSelectionModal "Authentication Required → Login to AliceBlue".
- **Place Order**: `validate_session` returned `False` → trade pipeline marked every order as `session_expired:True` → client opened the AliceBlue reconnect WebView.

**Fix — ccxt-india `brokers/aliceblue/aliceblue.py`** (committed in ccxt repo):
- `_parse_funds_response`: maintenance + no-data → `status:0` with zero-funds payload, errorcode `MAINTENANCE` / `NO_DATA`. Only true I/O / shape failures keep `status:1`.
- `validate_session`: maintenance + no-data return `(True, "")`. Only auth-shaped messages (`token expired`, `invalid token`, `unauthorized`, `session expired`, `please log`, `2fa`, etc.) return `(False, ...)`. Unrecognized non-Ok responses log a warning and return `(True, "")` — fail-open to avoid false expiry; placement endpoint surfaces real errors itself.

**Fix — Alphab2bapp `src/utils/rebalanceHelpers.js`** (this commit):
- Added `'maintenance'` errorcode to `TRANSIENT_NON_AUTH_BROKER_ERROR_CODES` as a hard signal — the existing keyword check already catches `temporarily unavailable`, this is the structured-code dual.

**Dual-modal stacking on broker connect** (this commit):
- After AliceBlue / Kotak connect, `showAlert('success', ...)` fired immediately AND `fetchBrokerStatusModal()` queued the migration sheet 700ms later. Both rendered on screen simultaneously, with the success alert above and the migration sheet below — confusing UX, and the migration sheet didn't block navigation so users could tap "Rebalance" while both modals were open.
- `TradeContext.fetchBrokerStatusModal` now returns `{migrationWillShow: boolean}`. `AliceBlueConnect.saveBrokerConnection` and `KotakModal._connect` await the result and skip the success alert when the migration sheet will appear (the migration sheet itself says "Reconnected to AliceBlue — your holdings are already set up", which is its own success indicator). Underlying broker modal closed first to prevent the migration sheet from stacking under a stale OAuth modal.

### Files
- `src/screens/TradeContext.js` — `fetchBrokerStatusModal` returns `{migrationWillShow}`
- `src/components/BrokerConnectionModal/AliceBlueConnect.js` — await, skip-on-migration
- `src/components/BrokerConnectionModal/KotakModal.js` — same pattern
- `src/utils/rebalanceHelpers.js` — `'maintenance'` errorcode

### Cross-repo
- ccxt-india `brokers/aliceblue/aliceblue.py` — `_parse_funds_response` + `validate_session` (committed `fc01dfd1`)
- tidi_new `lib/components/home/portfolio/BrokerAuthPage.dart` (interceptor port) + `lib/utils/rebalance_helpers.dart` (`maintenance` errorcode)
- prod-alphaquark-github `src/utils/rebalanceHelpers.js` (`maintenance` errorcode)

---

## [3.9.29] - 2026-04-26

### Fixed — AliceBlue: post-OTP redirect bypassed via WebView fetch/XHR interceptor (workaround for AliceBlue's broken Keycloak `getUser` step)

**Symptom (2026-04-26 production reproduction).** After hardcoding `prod.alphaquark.in` in [3.9.28], AliceBlue connect *still* failed — user enters UCC → password → OTP → WebView reloads back to login. Logcat showed every WebView nav stuck at `https://ant.aliceblueonline.com/?appcode=7WMf5NotZe` (the SPA was doing internal routing, never navigating externally), plus a console error: `Uncaught (in promise) FirebaseError: Messaging: This browser doesn't support the API's required to use the Firebase SDK`.

**Root cause — AliceBlue's broken Keycloak client config (server-side, our code is fine).** User captured AliceBlue's actual API responses from web devtools:

- `POST https://antdrn.aliceblueonline.com/omk/auth/access/v1/otp/validate` → `{status:'Ok', result:[{accessToken:'<JWT>', redirectUrl:'https://alphaquark.in/api/deploy/broker/callback?authCode=...&userId=254555', authorized:true}]}` — the OAuth completes successfully and AliceBlue HANDS US the redirectUrl with the authCode.
- `GET https://antdrn.aliceblueonline.com/omk/client-rest/profile/getUser` → **401 Unauthorized**.

The JWT's `allowed-origins` claim contains only localhost: `["http://localhost:3002", "http://localhost:5050", "http://localhost:9943", "http://localhost:9000"]`. AliceBlue's Keycloak `alice-kb` client is mis-configured — `ant.aliceblueonline.com` (their own production SPA host) isn't allowlisted, so when their SPA cross-origins to `getUser` after OTP, Keycloak rejects with 401. The SPA aborts the post-OTP redirect on this 401 — never navigating to the `redirectUrl` AliceBlue's own OTP-validate endpoint just handed it. **This is broken for everyone, including AliceBlue's own web flow** (user confirmed same issue in browser).

**Workaround — fetch/XHR interceptor injected into the WebView.** New `ALICEBLUE_REDIRECT_INTERCEPTOR` const in `AliceBlueConnectUI.js` is passed via `injectedJavaScriptBeforeContentLoaded` so it runs before any AliceBlue page script. It monkey-patches both `window.fetch` and `XMLHttpRequest.prototype.{open,send}`, watches for responses to `/otp/validate`, parses the JSON for `result[0].redirectUrl`, and force-navigates the WebView via `window.location.href = redirectUrl` — bypassing the broken `getUser` step entirely. We don't need profile data; we only need the `authCode` in the redirectUrl, and AliceBlue gives us that in the OTP-validate response itself.

The redirect lands on `https://alphaquark.in/api/deploy/broker/callback?authCode=...&userId=...`, which 302s through ccxt's `/aliceblue/oauth/callback` → exchanges authCode → access_token → 302s to `prod.alphaquark.in/stock-recommendation?user_broker=AliceBlue&status=0&access_token=X&client_id=Y` — captured by the existing `handleWebViewNavigationStateChange` query-param matcher.

### Files
- `src/UIComponents/BrokerConnectionUI/AliceBlueConnectUI.js` — `ALICEBLUE_REDIRECT_INTERCEPTOR` const + `injectedJavaScriptBeforeContentLoaded` prop on the WebView

### Open follow-ups
- This is a workaround for an AliceBlue server-side bug. **Contact AliceBlue partner support** to add `ant.aliceblueonline.com` (and any other production SPA host) to the `alice-kb` Keycloak client's `Web Origins` config.
- Port to tidi_new `lib/components/home/portfolio/BrokerAuthPage.dart` — `webview_flutter` supports `runJavaScript` / `addJavaScriptChannel` for the same patch pattern.
- Dual-modal stacking: success alert `Connected Successfully` + `HoldingsMigrationModal` "Reconnected to AliceBlue" both render simultaneously after connect (700ms migration delay isn't enough). Affects every credential broker (`KotakModal.js:251` and `AliceBlueConnect.js:205` both fire `showAlert` then `fetchBrokerStatusModal`). Tracked separately.

---

## [3.9.28] - 2026-04-26

### Fixed — AliceBlue connect: OTP submission silently bounced back to password screen (cross-broker fan-out from Groww App Links)

**Symptom (2026-04-26 production user reproduction).** AliceBlue connect on Alphab2bapp: user enters UCC → password → AliceBlue OTP screen → enters OTP → WebView reloads back to the AliceBlue PASSWORD screen, not our success/error UI. Repeats every retry. Tidi_new doesn't reproduce because tidi_new hardcoded `prod.alphaquark.in` as the origin in commit `d5fb65b`.

**Root cause — env-var fan-out from Groww App Links work.** `AliceBlueConnect.js:buildAliceBlueAuthUrl` was reading `Config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL` and using its `origin` as the AliceBlue OAuth redirect host. That env var was repurposed in commit `f9f5d0f` (Groww App Links) from `https://prod.alphaquark.in/stock-recommendation` → `https://app-links.alphaquark.in/broker-callback`. ccxt logs confirmed: `GET /aliceblue/login?origin=https%3A%2F%2Fapp-links.alphaquark.in%2Fbroker-callback&returnPath=%2Fstock-recommendation`. AliceBlue's partner appcode `7WMf5NotZe` is **allow-listed against `prod.alphaquark.in` ONLY** — any other origin causes AliceBlue's portal to silently fail the post-OTP redirect and the WebView falls back to the login page. We never see a callback URL to intercept; the user just sees the password screen again.

**This is exactly the fan-out the CLAUDE.md guardrail warns about**: "NEVER modify a broker-related env var (`.env`) without running the audit below. A single env-var change can silently break multiple broker OAuth flows... `f9f5d0f` (Groww App Links) repurposed `REACT_APP_BROKER_CONNECT_REDIRECT_URL` from `https://prod.alphaquark.in/stock-recommendation` → `https://app-links.alphaquark.in/broker-callback` and silently broke Zerodha's publisher basket on prod, and OAuth for 8 brokers × 10 tenants that had no backend override." AliceBlue is the latest casualty — Zerodha and others were called out at f9f5d0f time; AliceBlue's specific failure mode (silent OTP-screen bounce, no error message) wasn't surfaced until now because the appcode-whitelist behaviour is invisible from our side.

**Fix — hardcode `prod.alphaquark.in`** (matching tidi_new's `_getAliceBlueLoginUrl` from commit `d5fb65b`). `AliceBlueConnect.js:buildAliceBlueAuthUrl` no longer reads the env var; the origin and `returnPath` are constants. Safe because the WebView intercepts callback URLs by query params (`user_broker=AliceBlue`, `access_token`, `client_id`) — the redirect host doesn't have to match the runtime app's actual host. Fat comment block on the function explains why and references the d5fb65b precedent.

### Files
- `src/components/BrokerConnectionModal/AliceBlueConnect.js` — `buildAliceBlueAuthUrl` hardcoded
- `docs/BROKER_CONNECTION.md` — Per-broker redirect URL reference table updated for AliceBlue (hardcoded + appcode allow-list note)

### Cross-repo precedent
- tidi_new `lib/components/home/portfolio/BrokerAuthPage.dart:_getAliceBlueLoginUrl` (commit `d5fb65b`)

### Open follow-up
- Audit other partner-broker connect URLs (Dhan, Axis, Angel One) for the same pattern. Each broker's appcode/registered-redirect URL has its own allow-list; if any of them currently use `REACT_APP_BROKER_CONNECT_REDIRECT_URL` and the broker's appcode isn't allow-listed for `app-links.alphaquark.in`, the same silent-bounce class of bug will surface.

---

## [3.9.27] - 2026-04-26

### Fixed — Fyers Publisher SDK registry stubs removed (de-facto already REST-only)

**Why this is a port from tidi_new commit `a063887`** (2026-04-25 — "Fyers execution: drop Publisher-SDK WebView, use REST via ccxt"). tidi_new reproduced "Awaiting Confirmation forever" caused by Flutter's `loadHtmlString` having no real origin → Fyers Publisher SDK silent domain-validation failure → basket WebView never rendered. They retired the Fyers WebView path entirely; basket execution now goes through ccxt-india's `/fyers/process-trades` REST endpoint like every non-Zerodha broker.

**Cross-repo audit on Alphab2bapp.** Surveyed the 3 callsites flagged by the audit (`RebalanceModal.js`, `UserStrategySubscribeModal.js`, `MPReviewTradeModal.js`) — each has a `handleFyersRedirect` function that **already** posts to `${ccxtServer}rebalance/process-trade` (the REST path), NOT a publisher SDK WebView. Verified via grep: `isPublisherSupported('Fyers')` and `BROKER_PUBLISHER_CONFIG.Fyers` are referenced only inside `brokerPublisher.js` itself, never read by any consumer. The Fyers Publisher path was registered in `brokerPublisher.js` but never wired into the order-execution flow on RN — it was always dead code. So Alphab2bapp doesn't have the production bug tidi_new fixed; the de-facto behaviour is already correct.

**What this commit does**: Cleans up the misleading dead-code stubs so a future contributor doesn't re-wire Fyers through the publisher (which would reproduce the tidi_new bug). Removed:
- `'Fyers'` from `PUBLISHER_SUPPORTED_BROKERS` (now `['Zerodha']` only) — replaced with a fat comment explaining the de-facto REST-only state and the tidi_new precedent.
- `BROKER_PUBLISHER_CONFIG.Fyers` entry (`scriptUrl: api-connect-docs.fyers.in/fyers-lib.js` was the SDK we'd have loaded).
- Fyers branches in `getPublisherApiKey` (returned `userBrokerClientCode`), `convertToBasketItem` (built the `NSE:SBIN-EQ` symbol form for Fyers SDK), `getPublisherRecordEndpoint` (`api/fyers/publisher/record-orders`).
- Helper functions `mapFyersOrderType` and `mapFyersProductType` — both now unused.

**Net behaviour change**: zero. All Fyers order placement continues through the existing REST `handleFyersRedirect` paths.

### Files
- `src/utils/brokerPublisher.js` — registry, helper, dead-branch removal

### Cross-repo
- tidi_new `lib/service/OrderExecutionService.dart` (commit `a063887`) — the original ccxt-only flip
- ccxt-india `apps/app_fyers.py:161` (`/fyers/process-trades`) — the REST endpoint everyone now uses

---

## [3.9.26] - 2026-04-25

### Fixed — Fyers instructions: explicit "Order Placement" permission warning + recovery copy

**Symptom (2026-04-25 production logs, ccxt-india).** Once Fyers basket orders started reaching the broker (after the REST endpoint fix `68a4d0a1` on the ccxt side), every multi-order POST was rejected with `Order placement restricted. Algo orders are not allowed from this app UBGF6OHH9P-100`. Same string for every order; no other failures in the same time window. The Alphab2bapp / tidi UI surfaced the rejection in the Order Errors modal, so the user knew SOMETHING was wrong but had no path to fix it from our screens.

**Root cause — user-side permission, not a code bug.** Fyers's app-create UI at https://fyers.in/web/api-dashboard/user-apps exposes a per-permission checklist (Order Placement, Holdings, Funds, etc.) and **defaults the "Order Placement" checkbox to OFF**. Without it ticked, Fyers's order endpoints reject every order with the "algo orders are not allowed for this app" string regardless of how the order is shaped, what API the call goes through, or which app version is making it. Our existing `FyersHelpContent.js` step 3 said `Grant all app permissions and check the box to accept the API Usage Terms and Conditions` — too generic for users to notice that one specific checkbox at the bottom of the list is the make-or-break one.

**Fix — instruction copy on all 3 surfaces.** Documentation only on our side (no code change resolves it; the user MUST enable the permission on Fyers's dashboard). Updated:
- `Alphab2bapp/src/UIComponents/BrokerConnectionUI/HelpUI/FyersHelpContent.js` — step 3 split into create + permissions guidance with a `⚠️ MUST tick "Order Placement" permission` callout in bold; new step 5 with recovery instructions for users who already created the app and are now seeing the algo-orders error (Edit app → tick permission → Save, no need to recreate / re-paste keys)
- `prod-alphaquark-github/src/Home/BrokerConnection/Fyers/FyersConnection.js` — same callout pattern in the Step-3 substep list (amber `⚠️` bullet) + new "!" callout block beneath Step 4 with the recovery steps
- `tidi_new/tidistockmobileapp/lib/models/broker_config.dart` — Flutter equivalent in `Fyers.instructionSteps` step 3 + recovery in `instructionNote` (committed in tidi_new repo)

**Why the recovery copy matters separately.** The "fix at create time" warning is for new users; the "edit existing app" recovery is for everyone already affected (the user who reported it included). Without the recovery copy, an affected user reads our warning, thinks "but I already created it" and assumes they need to delete/recreate the app and re-paste API Key + Secret — which they don't. Fyers's Edit form lets you toggle the permission post-create and the existing keys keep working.

### Files
- `src/UIComponents/BrokerConnectionUI/HelpUI/FyersHelpContent.js` — step 3 expanded + new step 5

### Cross-repo
- `prod-alphaquark-github/src/Home/BrokerConnection/Fyers/FyersConnection.js`
- `tidi_new/tidistockmobileapp/lib/models/broker_config.dart` (committed in tidi_new repo)
- `tidi_new/tidistockmobileapp/lib/components/home/portfolio/ExecutionStatusPage.dart` — bottom-sheet "Close" button on `_showOrderErrorModal` was clipped on devices with system gesture inset; wrapped in `SafeArea(top: false)`. Same commit bundle in tidi_new repo.

### Open follow-up
- The "Order Placement" warning is only on the credential-entry instruction screens. Add the same callout on the broker-error UI when the rejection message contains `algo orders are not allowed` so an affected user gets pointed at the Fyers Edit dashboard from the failure surface itself, not just the (already-completed) connect screen.

---

## [3.9.25] - 2026-04-25

### Fixed — Kotak double-submit trap: "Incorrect credentials" alert overlapping the success migration sheet

**Symptom (2026-04-25 production screenshot, Alphab2bapp).** "Connect to Kotak" page had two conflicting UI elements on screen at once: a `Connection Error: Incorrect credentials. Please try again` alert AND a `Reconnected to Kotak — Your holdings are already set up for Kotak. You're good to go!` bottom sheet (`HoldingsMigrationModal` with `isReconnection = true`). User reported that Kotak connected fine on tidi but not Alphab2bapp.

**Root cause — single-flight gate missing on the Connect button.** `KotakConnectUI.js:239` had:
```jsx
disabled={!apiKey || !mobileNumber || !mpin || !ucc || !totp || !egressReady}
```
`isLoading` was NOT in the disabled list. While a Connect was in flight (spinner up), the button stayed tappable. Sequence that produced the screenshot:
1. User submits credentials → `setIsLoading(true)` → `axios.put(/api/kotak/connect-broker)` fires → spinner shows
2. Backend hits ccxt `/kotak/login/totp` → Kotak accepts the TOTP → backend writes `connect_broker_status: connected` + `connected_brokers[Kotak]` slot → returns 200
3. The `.then` chain runs → `fetchBrokerStatusModal()` → migration check returns `requiresMigration: true` → `setShowMigrationModal(true)` queued for 700ms
4. User, not seeing immediate feedback (the success alert is brief / the migration modal hasn't fired yet), taps Connect AGAIN
5. Second `axios.put` → ccxt forwards the SAME TOTP to Kotak → Kotak rejects (TOTPs are single-use within their 30s window) → backend returns 400 with `Invalid OTP` or similar
6. Mobile's `.catch` fires the generic fallback `Incorrect credentials. Please try again` alert (the actual broker message wasn't surfaced)
7. The 700ms timer from step 3 fires → migration modal opens
8. Both visible — the screenshot

**tidi worked because** its Connect button correctly gates on `_isLoading` so a parallel submit can't happen.

**Three guards.**
- **Single-flight in the UI** (`KotakConnectUI.js:239`). Added `|| isLoading` to the `disabled` list and to the grey-out style. Also added a code comment explicitly tying the flag to the 2026-04-25 incident so a future edit doesn't silently drop it.
- **Single-flight + 30s debounce in the modal** (`KotakModal.js:updateKotakSecretKey`). New `isInFlightRef` blocks parallel submits even if a future UI edit drops the disabled-flag (defence-in-depth). New `lastKotakConnectAtRef` + 30s cooldown (matches Kotak's TOTP rotation window) blocks the user from re-submitting Connect within 30s — generates a clear `'Please wait'` alert that names the exact failure mode (`Incorrect credentials` even when the previous attempt actually succeeded). Both flags are reset in every exit path: each validation early-return, the success `.then`, and the failure `.catch`.
- **Better error message** (`KotakModal.js:.catch`). Surfaces Kotak's actual rejection text first; if it contains TOTP-related keywords (`otp` / `totp` / `two factor` / `two-factor`), title flips from `Connection Error` → `TOTP Rejected` and body appends the explicit "TOTPs rotate every 30s, can't be reused, generate a fresh code in NEO" hint. Generic fallback only when the broker returns no message.

**Files:** `src/UIComponents/BrokerConnectionUI/KotakConnectUI.js` (disabled-list + style fix), `src/components/BrokerConnectionModal/KotakModal.js` (in-flight ref + 30s debounce + improved error parsing), `docs/CHANGELOG.md` (this entry).

**Cross-repo note.** tidi_new (Flutter) is unaffected — its `BrokerCredentialPage._connectKotak` already gates on its loading state. Same Connect-debounce pattern shipped earlier today on Motilal (CHANGELOG `[3.9.24]`); Kotak now matches.

---

## [3.9.24] - 2026-04-25

### Fixed — Motilal session-affinity trap: silent WebView reload + Connect spam → "Authorization Invalid" / `MO1007`

**Symptom (production trigger).** A single user fired `/motilal-oswal/login` 4 times in 4 minutes (12:18–12:22 UTC) and got three different broker-side errors in succession: (1) `net::ERR_NAME_NOT_RESOLVED` on first WebView load (the IPv6 / DNS race we already auto-retry), (2) `Authorization is Invalid In Header Parameter` on OTP submit, (3) `{"status":"ERROR","message":"Two Factor Authentication Failed","errorcode":"MO1007"}` on the next OTP submit. ccxt logs confirmed 4 separate `/motilal-oswal/login` POSTs from the same client over the same 4 minutes.

**Root cause — Motilal binds OTP, page session, and Authorization header to a single page-load.** Motilal's OpenAPI requires the OTP delivered to the user's mobile, the page-side session cookie, and the apikey-derived `Authorization` header on OTP-verify to all originate from the **same** WebView load. Any rotation in between invalidates the others. Two of our behaviours rotated the session without telling the user:
- `MotilalConnectUI.js:onError` was unconditionally `setKey(k+1)`-reloading the WebView on ANY error — including transient errors that fired AFTER Motilal's page had already loaded successfully. The reload silently unmounted + remounted the WebView, wiping the user's typed OTP and rotating Motilal's server-side session, so the OTP they then re-entered came from session N–1 while Motilal had already moved to session N → `Authorization Invalid`.
- `MotilalModal.js:initiateAuth` had no debounce. The user could fire 4 fresh `/motilal-oswal/login` calls in 4 minutes, each issuing a fresh Motilal session and a fresh OTP. Without a clear "wait" signal, the user spam-clicked Connect and ended up entering OTP from session 1 into a page on session 4.

**Fix — two guards.**
- **Post-load failure isolation** (`MotilalConnectUI.js:MotilalWebViewWithRetry`). New `pageLoadedOnceRef` armed in `onLoadEnd`. After it's true, `onError` no longer silently reloads — it surfaces a "Restart connection" UI explaining that reloading would rotate Motilal's session and invalidate any OTP the user has received. The user has to consciously tap Restart, which fires `onRequestRestart` on the parent. Pre-load failures (DNS race, network down before page loaded) keep the existing auto-retry-once behaviour.
- **Connect-button 30s debounce** (`MotilalModal.js:initiateAuth`). New `lastConnectAtRef` blocks repeat Connects within 30s of the previous `/motilal-oswal/update-key` call. The blocking alert names both failure modes (`Authorization Invalid`, `Two Factor Authentication Failed`) so support can diagnose by string match. 30s was chosen empirically — Motilal's session state typically settles within 15–20s; 30s leaves margin without breaking UX.
- **Restart helper** (`MotilalModal.js:handleRequestRestart`). The Restart-connection CTA wired through to a parent handler that closes the WebView and wipes `authUrl` / `jwtToken` / `isToastShown` so the next Connect goes through the full `/motilal-oswal/login` round-trip with fresh state. The 30s debounce still applies to gate Restart→Connect→Restart loops.

**Docs:** `docs/BROKER_CONNECTION.md` — new § Motilal session-affinity guard (2026-04-25) explaining the failure mode, the two guards, and what we deliberately did not build (page-content sniffing — fragile, deferred unless the two guards prove insufficient). Per-broker table row updated. Cross-repo note: web app's Motilal flow uses `window.location.href` not WebView so doesn't have this trap; tidi_new (Flutter) uses `webview_flutter` and likely DOES — flagged for future audit.

**Files:** `src/UIComponents/BrokerConnectionUI/MotilalConnectUI.js`, `src/components/BrokerConnectionModal/MotilalModal.js`, `docs/BROKER_CONNECTION.md`.

---

## [3.9.23] - 2026-04-25

### Fixed — "How to Authorize >" crashes app for Groww and 7 other brokers (DdpiModal.js)

**Symptom.** Tapping "How to Authorize >" on the "Action Required: Stock Authorization to Sell" modal crashed the app. Reproduced with Groww (screenshot 2026-04-25 12:48). Affected all brokers not explicitly listed in `brokerInstructions`.

**Root cause — three bugs in `DdpiModal.js`:**

1. **Missing broker entries (crash).** `brokerInstructions` only had 7 keys: IIFL Securities, ICICI Direct, Upstox, Kotak Securities, HDFC Securities, AliceBlue, Dhan. Zerodha, Angel One, Groww, Motilal Oswal, Axis Securities, and Fyers were absent. When `broker = 'Groww'`, `brokerInstructions['Groww']` = `undefined`, and the render path unconditionally accessed `.videoId` on it → `TypeError: Cannot read properties of undefined` → crash.

2. **Wrong map keys (crash).** `'Kotak Securities'` should be `'Kotak'` (matching `userDetails.user_broker`). `'HDFC Securities'` should be `'Hdfc Securities'`. Users with Kotak or HDFC Securities connected hit the same crash via a different path.

3. **YoutubePlayer rendered unconditionally (crash/blank).** `<YoutubePlayer videoId={brokerInstructions[broker].videoId} />` was rendered even when no `videoId` exists for the broker. For ICICI Direct and Kotak this passed `undefined` to YoutubePlayer (blank/crash). For Dhan the `videoId` was a full URL instead of a YouTube ID — invalid format. Fix: only render `YoutubePlayer` when `brokerInstructions[broker]?.videoId` is truthy.

**Fix.** Replaced the entire `brokerInstructions` map with complete entries for all 13 applicable brokers (DummyBroker excluded). Each entry has a title and steps array describing how to complete EDIS/TPIN authorization on that broker's own app — distinct from the DDPI activation flow (handled by the separate green "Show me how to activate DDPI" button). Guarded the `YoutubePlayer` render with a `?.videoId` check.

**Brokers now covered:** Zerodha, Angel One, Upstox, ICICI Direct, Kotak, Dhan, Fyers, IIFL Securities, AliceBlue, Motilal Oswal, Hdfc Securities, Groww, Axis Securities.

**YouTube walkthroughs available for:** Upstox (`eD6aQ07Ommw`), IIFL Securities (`hpP5M5H52HY`), AliceBlue (`gP06qK8LfYo`), Hdfc Securities (`CkZI_2psXLY`).

**Files changed:**
- `src/components/DdpiModal.js` — `brokerInstructions` map replaced; `YoutubePlayer` guarded with `?.videoId`

---

## [3.9.22] - 2026-04-25

### Fixed — Android hardware back button leaves ghost overlay over wrong screen (all 14 broker modals)

**Symptom.** User opens any broker connection modal (Groww, Zerodha, AliceBlue, etc.), does not fill in credentials, presses the Android hardware back button. The background navigates back to the previous screen but the modal overlay **stays painted on top** — a ghost UI floating over the wrong screen. Screenshot captured 2026-04-25 12:19: Groww instructions screen persisted over "Account Settings" after back press.

**Root cause.** `CrossPlatformOverlay` on Android renders as a plain `View` with `StyleSheet.absoluteFillObject` + `zIndex: 9999`, not a React Native `Modal`. React Navigation's hardware-back handler fires first, pops the underlying screen, but the `View` has no lifecycle tie to navigation so it stays rendered. Additionally, every caller passes `onClose` to `CrossPlatformOverlay` but the component destructured only `{ children, visible }` — `onClose` was silently dropped and never wired to anything.

**Fix.** Added a `BackHandler.addEventListener('hardwareBackPress', …)` inside a `useEffect` in `CrossPlatformOverlay`. When the overlay is visible on Android the handler fires first, calls `onClose?.()` to close the overlay, and returns `true` to consume the event (preventing React Navigation from also popping the screen). Cleaned up via `sub.remove()` on unmount / when `visible` flips to `false`.

**Blast radius fixed (14 surfaces, single file change):**
- `BrokerConnectionModal/GrowwConnectModal.js`
- `UIComponents/BrokerConnectionUI/ZerodhaConnectUI.js`
- `UIComponents/BrokerConnectionUI/AngelOneConnectUI.js`
- `UIComponents/BrokerConnectionUI/AliceBlueConnectUI.js`
- `UIComponents/BrokerConnectionUI/UpstoxConnectUI.js`
- `UIComponents/BrokerConnectionUI/DhanConnectUI.js`
- `UIComponents/BrokerConnectionUI/DhanOAuthUI.js`
- `UIComponents/BrokerConnectionUI/FyersConnectUI.js`
- `UIComponents/BrokerConnectionUI/KotakConnectUI.js`
- `UIComponents/BrokerConnectionUI/MotilalConnectUI.js`
- `UIComponents/BrokerConnectionUI/ICICIConnectUI.js`
- `UIComponents/BrokerConnectionUI/HDFCConnectUI.js`
- `BrokerConnectionModal/AxisConnectModal.js` *(passes no `onClose` — back press is consumed/blocked but overlay doesn't close; pre-existing gap, not introduced here)*
- `components/BrokerDdpiHelpModal.js`

**iOS:** Unaffected — `useEffect` has `Platform.OS !== 'android'` guard; `FullWindowOverlay` path is unchanged.

**Files changed:**
- `src/components/CrossPlatformOverlay.js` — add `BackHandler` + `useEffect`; destructure `onClose`

**Backend:** No changes.

---

## [3.9.21] - 2026-04-24

### Fixed — ICICI broker: holdings mismatch, "Detail on portfolio" blank screen, race condition, stale-broker banner

Five related bugs traced to ICICI Direct users having an empty `model_portfolio_user` record after switching brokers, while cross-broker fallbacks in `subscription-raw-amount` (aq_backend) served old-broker data to some screens but not others.

**(1) MPStatusModal used a strict broker filter the web doesn't have (`MPStatusModal.js`).** The modal's internal fallback fetch passed `params: { broker: userbroker }` to `rebalance/user-portfolio/latest`. The backend's `$project` stage doesn't return `user_broker`, so the broker-mismatch guard (`portfolioBroker !== userbroker`) was dead code — but the `broker` query param caused the backend to return only the empty ICICI Direct record rather than falling back the way the web does. Rebalance Step 2 showed "You do not have holdings associated with THIS model portfolio" even when holdings from another broker existed. **Fix:** removed `params: { broker: userbroker }` and the dead mismatch block, matching `prod-alphaquark-github/MPStatusModal.js` exactly.

**(2) AfterSubscriptionScreen: race condition served wrong-broker data to Portfolio Holdings tab (`AfterSubscriptionScreen.js`).** `getSubscriptionData()` was triggered by `useEffect([strategyDetails])`. `userDetails` (which carries `user_broker`) resolves later. During the gap, `getSubscriptionData` called `subscription-raw-amount` with `user_broker = undefined` — the aq_backend treated this as no broker filter and returned whichever record existed first (often DummyBroker). **Fix:** added `userDetails` to the dependency array so `getSubscriptionData` waits for both `strategyDetails` and `userDetails` before running; `user_broker` is always a real value when the API is called.

**(3) "Detail on portfolio" appeared to do nothing for ICICI users (`AfterSubscriptionScreen.js`).** The button navigated correctly but for ICICI users with wrong/empty holdings data the screen showed `EmptyStateInfoMP` immediately, which the user interpreted as the button failing. Root cause was bug (2). Also hardened `tableData.length` → `tableData?.length` (defensive optional chain matching web style).

**(4) Stale cross-broker data shown without indication (`AfterSubscriptionScreen.js`).** When CCXT returns empty for the current broker and `subscription-raw-amount` falls back to another broker's holdings, the Portfolio Holdings tab silently showed that stale data. Added `isStalebrokerData` detection and a yellow warning banner: *"⚠️ Holdings shown are from a previous broker. To rebalance with [broker], please update your holdings in the rebalance flow."*

**Files changed:**
- `src/components/AdviceScreenComponents/MPStatusModal.js` — removed `params: { broker: userbroker }` + dead broker-mismatch check
- `src/screens/Home/AfterSubscriptionScreen.js` — useEffect race condition fix (`[strategyDetails, userDetails]`), `tableData?.length` guard, `isStalebrokerData` state + stale-data banner

**Backend:** No changes required.

**Docs updated:** `docs/MODEL_PORTFOLIO.md` — new sections on holdings data source discrepancy, broker-switch migration flow, and AfterSubscriptionScreen data flow.

---

## [3.9.20] - 2026-04-24

### Fixed — AliceBlue broker connect: "Your Broker & Funds Info" card appeared truncated after connection

**Symptom.** After connecting AliceBlue (or any broker where the account had prior model-portfolio holdings from a different broker), the "Your Broker & Funds Info" card on the Broker Screen (`SubscriptionScreen`) showed only its title — the six info rows (Broker, Available Cash, Phone, Email, PAN, Account Created) were invisible. Screenshot captured at 2026-04-24 20:09.

**Root cause — race between `navigation.goBack()` and `setShowMigrationModal(true)`.**
`TradeContext.fetchBrokerStatusModal()` is called immediately after a successful broker connection. It calls `getUserDeatils()` → `fetchFunds()` → `broker-migration-summary` API. If `requiresMigration: true` the function called `setShowMigrationModal(true)` synchronously. `BrokerAuthScreen.handleCallback` fires `onSuccess()` (which calls `fetchBrokerStatusModal`) and then immediately fires `navigation.goBack()`. The back-navigation animation takes ~300 ms. When `fetchBrokerStatusModal` finished its three async calls (~400–600 ms), the user had already landed on `SubscriptionScreen` — but the `HoldingsMigrationModal` bottom sheet slid up at exactly that moment, its white background hiding the just-rendered card rows. Visually the card appeared truncated (title only).

**Fix.** Wrap the `setShowMigrationModal(true)` call in a 700 ms `setTimeout` in `TradeContext.js`. This lets `navigation.goBack()` animation (~300 ms) complete and `SubscriptionScreen` fully render before the bottom sheet appears. Matches the web-prod pattern: `prod-alphaquark-github` only triggers the migration check after the user explicitly clicks "Continue" on the broker-success dialog — the delay here achieves the same settled-screen guarantee on mobile.

**Also shipped in this entry:**
- `HoldingsMigrationModal.js` (new) — broker-switch migration bottom sheet: Carry Forward / Start Fresh per model portfolio. Parity with `prod-alphaquark-github/src/Home/ModelPortfolioSection/HoldingsMigrationModal.js`.
- `TradeContext.js` — `showMigrationModal` + `migrationBroker` state; migration check in `fetchBrokerStatusModal`; both exported.
- `Navigation.js` — `HoldingsMigrationModal` mounted globally in `MainTabNavigator`.

**Files changed:**
- `src/screens/TradeContext.js`
- `src/components/HoldingsMigrationModal.js` *(new)*
- `src/components/Navigation.js`

**Docs updated:**
- `docs/APP_ARCHITECTURE.md` — new § 3.11 Post-Connect Holdings Migration Flow.

**Backend:** No changes — `broker-migration-summary` and `handle-broker-migration` endpoints already deployed in `aq_backend_github`.

---

## [3.9.19] - 2026-04-24

### Fixed — pre-trade broker-session correctness across every chokepoint + IIFL reconnect parity + Kotak mobile normalization + DDPI/EDIS inline help on rejection surfaces

Six interlocking fixes landed today. All ship on the next Play/App Store build; cross-repo partners also shipped on tidi_new (`feature/mp`) and prod-alphaquark-github (`feature/4.0` — already live on `prod.alphaquark.in`).

#### 1. Fyers / Dhan / Upstox silent-block on stale-token trades — `b741f0b`

**Symptom.** User opens app at 9 AM with a valid Fyers session → context loads `funds={data:{...}, status:0}`. Token expires during the day (Fyers/Dhan/Upstox tokens are ~daily). User clicks Trade at 6 PM → "doesn't go beyond, doesn't place." No toast, no modal, no rejection — just silent failure.

**Root cause.** `useRefreshBrokerStatus` hook (added yesterday in `8e39e02` as a Trade-Now perf win) has a fast-path at line 57 that returns cached context funds when they look "live" (`brokerStatus === 'connected' && hasLiveFunds(funds)`). Cached funds from 9 AM don't prove the token at 6 PM is still valid — so `isFundsErrorOrMissing` returns false (passes), ReviewTrade opens, user hits Place Order, ccxt/Fyers rejects with 401. Broker-agnostic bug; Fyers just happened to be the first reported.

**Fix.** New `{forceNetwork: true}` option on `refreshBrokerStatus`. When true, skip fast path entirely and always fire `fetchFunds` regardless of cache shape. Wired into all 7 pre-trade chokepoints:
- `StockAdvices.handleTrade` / `handleTradeBasket` / `handleSingleSelectStock`
- `AddtoCartModal.handleTrade`
- `RebalanceAdvices.handleAcceptRebalance`
- `RebalanceCard.handleCheckStatus` / `handleCheckBroker`

Read-only surfaces (no-trade-button screens) keep the fast path — no perf regression on the hot read path.

#### 2. Typed `validateBrokerSession` + `classifyFundsResponse` helpers — `07252fd`, `703f821`

Thin wrapper over existing `fetchFunds` + `isFundsErrorOrMissing` + `isTransientFundsError` that returns `{ok, reason, message, funds}` where `reason ∈ {OK, NOT_CONNECTED, TRANSIENT, TOKEN_EXPIRED, PROBE_FAILED}`. Lets chokepoints branch UX:
- `OK` → proceed
- `TRANSIENT` → soft toast (Upstox 00:00–05:30 IST maintenance, ICICI Breeze base-64 hiccup) — NO reconnect prompt
- `TOKEN_EXPIRED` / `NOT_CONNECTED` → existing `TokenExpire` modal
- `PROBE_FAILED` → let trade proceed; the actual order placement surfaces any real issue

**Two helpers**: `classifyFundsResponse` is sync (for sites that already have fresh funds from the refresh-hook); `validateBrokerSession` is async (fires its own fetchFunds). DRY — async delegates to sync after the network call.

Migrated 9 chokepoints (5 StockAdvices, 1 each AddtoCartModal/RebalanceAdvices/RebalanceCard-×2). Before: boolean `isFundsEmpty` → single modal for everything. After: TRANSIENT gets a dedicated toast path (no more Upstox maintenance window misfiring as "session expired"). Files: `src/utils/brokerSessionValidator.js` (new — 180 LOC), plus in-place migration at each site.

Cross-repo parity:
- tidi_new: `lib/utils/broker_session_validator.dart` (`a7bb53f`), + MP rebalance pre-flight via `validateBrokerSession` (`1311518`), + `OrderExecutionService._validateBrokerSession` live probe using typed validator (`32a15fd`), + `ExecutionStatusPage` catches `TRANSIENT_BROKER_ERROR:` marker as orange snackbar instead of Reconnect Broker error state.
- prod-alphaquark-github: `src/utils/brokerSessionValidator.js` + broker-scoped IST maintenance window in `rebalanceHelpers.js` (`be6639d`), + `BasketModal.executePlaceOrder` / `UserStrategySubscribeModal` / `ModelPortfolioSection/RebalanceCard` all 3 sites migrated (`4f30524`).

#### 3. IIFL reconnect didn't refresh TradeContext — `f05c5e8`

**Symptom.** User reconnects IIFL → "Successfully connected" toast → modal closes → user clicks Trade again → "Login to IIFL Securities" modal pops AGAIN despite the just-completed reconnect.

**Root cause.** `src/components/iiflmodal.js:handleIIFLLogin` was the lone per-broker modal that didn't call `fetchBrokerStatusModal()` on success. Every other broker (Zerodha/Angel One/Upstox/ICICI/Kotak/Dhan/Fyers/AliceBlue/Motilal/HDFC/Axis/Groww) re-hydrates TradeContext on success so the user's next pre-trade check passes. IIFL was just calling `onClose()` — leaving context at its pre-reconnect state, which the next `classifyFundsResponse` check still saw as TOKEN_EXPIRED.

**Fix.** Accept `fetchBrokerStatusModal` via props (already passed by `ModalManager.commonProps` line 33 — IIFLModal just wasn't reading it) and call it on the success path between Toast and onClose. Wrapped in `typeof` guard + try/catch for defence.

**Verified scope across all 14 brokers** — this was the ONLY gap. Note: `src/components/TokenExpireBrokerModal.js` is dead code (never imported; `setOpenTokenExpireModel(true)` renders `BrokerSelectionModal` instead via `(brokerModel || OpenTokenExpireModel)` JSX guards in parent screens). Its `OAUTH_BROKERS` list and per-broker branches are misleading during audits. Worth deleting in a janitorial commit.

#### 4. Kotak mobile number rejected on valid inputs — `1f1fa0b`

**Symptom.** User enters `+91 9876543210` (contacts autofill), `+919876543210`, `09876543210`, `98765 43210`, or `98765-43210` → "Invalid Mobile Number — Please enter a valid 10-digit mobile number."

**Root cause.** `KotakModal.updateKotakSecretKey` tested the raw input directly against `/^\d{10}$/`. The TextInput had no `maxLength` / `inputFormatters`, so anything the user typed or pasted reached the regex unchanged.

**Fix.** Normalize before validating: strip non-digits, strip `91` or `0` prefix only when doing so leaves a 10-digit remainder (so genuine numbers starting with 9 aren't truncated). Write the normalized value back to the input so the user sees what we're submitting; use it in the payload. Cross-repo parity: tidi_new `b94a829`, prod-alphaquark-github `e2b4db7`.

#### 5. "What is DDPI / EDIS?" inline help on rejection surfaces — `32f1f80`

**Symptom.** Users hit a generic "EDIS authorization required" / "DDPI not enabled" / "Insufficient Mandate Qty" rejection with no path forward — had to dismiss and hunt for DDPI help through unrelated flows.

**Fix.** New shared matcher `src/utils/sellAuthMessage.js:isSellAuthRejection(message, classification)` — keyword-liberal regex covering EDIS/DDPI/TPIN/mandate/authorization/SELL_AUTH_REVOKED/SELL_AUTH_REQUIRED/CDSL TPIN/insufficient-mandate/insufficient-stocks-allocated/POA-not-enabled/3-in-1. Prefers server-side classification tag when present; falls back to message regex.

Wired into:
- `OrderScreen.js` — green "What is DDPI / EDIS? How to enable →" link below rejection text in order history; opens `openModal('DdpiHelp', {broker: item.user_broker})`
- `StockCard.js` (via `StockAdviceContent` plumbing `rejectionClassification` + `rejectionBroker` props through) — same link below "Rejected: …" text in advice-screen cards

Broker resolved from `item.user_broker` (order row) or the surrounding advice context. Suppressed when `getBrokerDdpiHelp(broker)` returns null (shouldn't happen — all 14 brokers registered — but defensive).

Cross-repo parity: tidi_new `ea85955` (ExecutionStatusPage rejection box), prod-alphaquark-github `a4a6492` (RecommendationSuccessModal desktop table + mobile card).

#### 6. Minor — dead file

`src/components/TokenExpireBrokerModal.js` exists in the repo but is NOT imported from any production path. Its `OAUTH_BROKERS` list and per-broker render branches reflect an older architecture that the move to `BrokerSelectionModal.handleBrokerSelectOpenExpire` superseded. Left in place this session to avoid scope creep; flagged for janitorial removal.

---

## [3.9.18] - 2026-04-23

### Fixed — OAuth broker connect reliability (Axis / Upstox) + distorted broker screen on foldables/split-screen

Consolidation of five session fixes (commits `7e1a321`, `c0ee009`, `06afe5f`, `7f106ef`, `ce7461d`) that together make the mobile broker connect path match the web's robustness.

**(1) Axis WebView callback never fired (`AxisConnectModal.js`, commit `7e1a321`).** The SSO callback parser was using `new URL(url)` + `searchParams.get('ssoId')`. RN has no `react-native-url-polyfill` installed and its built-in `URL` is partial — `searchParams` can be undefined on intermediate navigations (about:blank, data:, WebView-internal URLs), and without a try/catch any throw killed the handler silently. Result: WebView parked on `app-links.alphaquark.in/broker-callback?ssoId=xxx` forever with no callback POST. Rewrote parsing to defensive string-split matching Upstox/Zerodha in this same folder (`extractSsoId(url)` — guard with `url.includes('ssoId=')`, split on `?`, `decodeURIComponent` each pair in try/catch). Also added `onShouldStartLoadWithRequest` to intercept the redirect landing page BEFORE it loads — user no longer sees the blank callback URL. Split token exchange into standalone `processAxisCallback(ssoId)` so both hooks (`onShouldStartLoad` + `onNavigationStateChange`) share one idempotent path gated by `hasProcessedCallback`.

**(2) Upstox OAuth error message surfacing (`upstoxModal.js`, commits `c0ee009` + `06afe5f`).** When `api/upstox/update-key` returned a URL containing `error_code` / `error_message` (IP not whitelisted, `Invalid redirect_uri`, `Invalid client_id`), the fallback parser used the same brittle `new URL()` + `searchParams.get('error_message')` that silently landed in the generic fallback — users saw "check your keys" instead of e.g. `"Static IP mismatch (UDAPI1154)"`. Replaced with defensive split-on-`?` + `decodeURIComponent`-in-try-catch extracting BOTH `error_code` and `error_message`. Also: Upstox form-encodes spaces as `+` (not `%20`), which `decodeURIComponent` doesn't cover — added `s.replace(/\+/g, ' ')` before decoding so the alert renders `"Check your client_id and redirect_uri; one or both are incorrect. (UDAPI100068)"` instead of `"Check+your+'client_id'+..."`.

**(3) Dropped `.env` fallback for OAuth redirect URI (`upstoxModal.js`, `AxisConnectModal.js`, `ManageConnectionsModal.js`, commit `7f106ef`).** The resolution chain was `freshConfig → configData → Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL`. The `.env` default is `app-links.alphaquark.in/broker-callback` — not registered in any advisor's Upstox / Axis dev portal, so falling back silently sent a known-bad URL that got rejected with cryptic `Invalid redirect_uri` errors. Changed to `freshConfig → configData → ''`. Empty value now fires the existing "Broker redirect URL is not configured" alert (fail-loud) instead of hitting the broker with a doomed URL. Paired with the aq_backend `/frontend-config` fix (commit `63a7a1b`) that derives the correct per-advisor URL so the empty path should never trigger in practice. Partner-OAuth brokers (Zerodha / AliceBlue / Dhan / Groww / Angel One) left alone — they use platform-level Kite-style apps so `.env` is correct for them.

**(4) Broker screen distorted on foldables / split-screen / Android 15 edge-to-edge (`SubscriptionScreen.js`, commit `ce7461d`).** `const { width: screenWidth } = Dimensions.get('window')` at module load time froze the captured width forever. On Galaxy Fold/Flip, Android split-screen / DeX / Samsung Flex Mode, and some MediaTek/Unisoc devices where RN's initial `Dimensions.get()` returns a stale dp value, the captured width diverged from the live width — styles using `screenWidth - 100` / `screenWidth - 60` rendered with a narrower content column than the physical screen. No `SafeAreaView` wrapping the root caused the Android 15 system nav bar to sit on top of scroll content (the thick black bottom band in the 2026-04-23 screenshot). Fix: wrap root in `<SafeAreaView edges={['top', 'bottom']}>` from `react-native-safe-area-context` (already at App root). Drop the frozen `screenWidth - 100` on `.button` (dead code — composed `flex: 1` already overrode it). Replace `screenWidth - 60` on `.loadingBar` with `alignSelf: 'stretch'`. Drop unused `Dimensions` import. **Scoped to this one screen**; the pattern exists in ~130 other files — will audit opportunistically as reports come in.

**Cross-repo:** Paired with backend fixes in `aq_backend_github` (`a0834c5`: Upstox update-key doesn't flip `user_broker` on error; `63a7a1b`: `/frontend-config` derives `brokerConnectRedirectUrl` from `admin → AllAdvisorDetails → subdomain-header` so every advisor gets a valid URL). tidi_new (Flutter) ported the Upstox error parser in the same session.

**Docs updated:** This CHANGELOG entry. `docs/BROKER_CONNECTION.md` Axis row already carries the 2026-04-21 WebView-parsing note.

---

## [3.9.17] - 2026-04-23

### Fixed — Groww TOTP seed capture: users were pasting the JWT-style "TOTP Token" instead of the Base32 secret below the QR

**Symptom.** User clicks "Connect Groww" → toast "TOTP Token format is off — Groww validation failed: TOTP token has non-Base32 characters." No way to recover; instructions and error message both said "TOTP Token", and so does Groww's UI.

**Root cause — field-name collision between Groww's UI and ours.** Groww's "Generate TOTP token" dialog displays two strings adjacent to the QR code:
1. A **field labelled "TOTP Token"** at the top of the dialog containing a long JWT-style value (`eyJraWQi…`). This is a Groww-internal display/activation token, contains base64url chars (`-`, `_`, digits `0/1/8/9`), and fails Base32 validation.
2. A **~32-character Base32 secret shown *below* the QR code** (e.g. `HYSRYAALJ3NPKVQH2K4VW4FQH4AKEENP`) — the actual `secret=` param encoded in the otpauth URI. A-Z and 2-7 only.

Groww's API (`POST /v1/token/api/access` per [groww.in/trade-api/docs/curl](https://groww.in/trade-api/docs/curl)) consumes a 6-digit TOTP code computed from that Base32 seed. Our backend stores the seed, computes the 6-digit code via `pyotp.TOTP(seed).now()` at daily reset. So we need the Base32 seed — NOT the JWT, NOT a one-off 6-digit code.

Our mobile UI (`GrowwConnectModal.js` + `brokerRegistry.js`) labelled its input field "TOTP Token *" and Step 2 said "Click 'Generate TOTP token' … copy the TOTP Token — shown only once" — which unambiguously points at Groww's JWT field. Error toasts also repeated "TOTP Token", so a user who pasted correctly per our instructions hit `NOT_BASE32`, read the toast ("TOTP Token format is off") and repasted the same JWT.

**Fix (UI copy + instructions only — backend validation was already correct).**
- **Field renamed**: "TOTP Token *" → **"TOTP Secret Key (Base32) *"** in `GrowwConnectModal.js` and `brokerRegistry.js`.
- **Step 2 rewrite**: contrasts the JWT top field with the Base32 secret below the QR, shows the example value `HYSRYAALJ3NPKVQH2K4VW4FQH4AKEENP` inline in monospace, explicitly says "ignore the long JWT-style 'TOTP Token' at the top".
- **Placeholder / helper**: "Paste the ~32-char Base32 secret below the QR (A–Z, 2–7)".
- **Error toasts rewritten** for `NOT_BASE32`, `WRONG_LENGTH`, `GROWW_REJECTED`, `INVALID_SEED` — each now names the Base32 seed unambiguously, with the "NOT_BASE32" case diagnosing the most common failure ("you likely pasted the JWT — we need the Base32 secret below the QR").
- **`refreshGrowwSession`** (`src/utils/growwRefresh.js`) — two alerts (`NO_TOTP_SEED`, `INVALID_SEED`/`GROWW_REJECTED`) updated with the same seed-vs-JWT disambiguation.
- **Two new text styles** (`boldText`, `monoText`) in `GrowwConnectModal` to highlight the key distinction inside Step 2.

**Docs:**
- `docs/BROKER_CONNECTION.md` — new section § Groww TOTP seed capture — which value to paste, with a side-by-side table of the two strings Groww's dialog displays. Also corrected the Per-Broker-Details row to say "Base32 seed" instead of "TOTP Token".

**Files:**
- `src/components/BrokerConnectionModal/GrowwConnectModal.js`
- `src/utils/growwRefresh.js`
- `src/config/brokerRegistry.js`
- `docs/BROKER_CONNECTION.md`

**Cross-repo porting required.** This copy lives identically in the web app (`../prod-alphaquark-github`) and the Flutter app (`../tidi_new`). Both need the same UI-copy fix or web/Flutter users will hit the same trap. Tracked for same-day port.

**Backend:** no changes. ccxt-india `app_groww.py:_normalize_totp_token` validation is correct as-is.

---

## [3.9.16] - 2026-04-23

### Fixed — Upstox service-window false "Login to {broker}" + slow Trade Now + invisible cart UX + DDPI-help popup regressions

Four user-reported regressions in one commit cycle.

**1. Upstox 12:00–05:30 IST maintenance window incorrectly forced re-login.** Both the bespoke "Trade Now" and basket/cart handlers gated on a raw `funds?.status === 1 || funds?.status === 2 || funds === null` check. During Upstox's nightly funds-service outage, ccxt responded either `{status: 1, message: "Service is accessible from 5:30 AM..."}` (caught by the existing `isTransientFundsError` keyword match) OR `{status: 2, message: undefined}` (no match possible — no distinguishing signal in the body). The raw check treated both as "token expired" and re-popped the auth modal even though `connect_broker_status` was still `'connected'`.

  - Replaced every raw `funds.status === 1 || ...` check in `StockAdvices.js` (5 sites: `handleTrade`, `handleTradeBasket`, `handleSingleSelectStock`, `placeOrder`, `handleConnectAndPlaceOrder`), `AddtoCartModal.js` (`handleTrade`), and `RebalanceCard.js` (`handleCheckBroker` — the sibling of `handleCheckStatus` which was already correct) with `isFundsErrorOrMissing(funds, brokerStatus, broker)`. All of those now go through the transient-aware helper uniformly.
  - `isTransientFundsError(resp, broker)` now takes the broker name and — scoped to Upstox only — returns `true` for any `status: 1` or `status: 2` response during 12:00–05:30 IST. `isInUpstoxMaintenanceWindow()` shifts `Date.now()` by +5:30 and reads UTC hours, so it works irrespective of the device's local timezone. Broker-scoped so a genuinely expired Zerodha token at 3 AM IST still correctly triggers re-login.
  - All call sites updated to pass `broker` as the third arg of `isFundsErrorOrMissing`.

**2. Trade Now was slow (2×~2s network calls).** `useRefreshBrokerStatus` previously serialized `GET /api/user/getUser/{email}` → `fetchFunds(...)`. The context usually already held a fresh connected broker + live funds — no network call was needed.

  - Added a **fast path**: if `brokerStatus === 'connected'` and `funds.data.availablecash` is present, return context values instantly without hitting the network.
  - Cold path now fires both requests in **parallel** via `Promise.all`, using context credentials for the optimistic fetchFunds; a second serialized fetchFunds only kicks in if `getUser` revealed the broker changed mid-flight (rare — e.g. disconnect from another device).
  - Hot path: instant. Cold path: ~2s (was ~3.5s).

**3. Add-to-Cart had no visible cart.** The `ShoppingCart` icon was imported in `CustomToolbar.js` but never rendered; the only cart affordance was the bottom `Trade (N)` bar inside `StockAdviceContent` which scrolled off-screen with the list. Users hit "Add to Cart" and got zero feedback or persistent indicator.

  - Wired the `ShoppingCart` icon into the top toolbar next to the Bell, with a red badge showing `cartCount` (`99+` cap). Tap → existing `AddToCartModal` tray.
  - `CartContext` now self-syncs: subscribes to the `cartUpdated` event, re-reads `AsyncStorage.cartItems` on every emit, and exposes the live count. No caller needs to `setCartCount` manually — every Add/Remove in `StockAdvices.handleSelectStock` already emits `cartUpdated`, so the badge is always accurate.
  - Toast feedback on Add (`Added to cart — AAPL · 3 items in cart`) and Remove (`Removed from cart — AAPL · 2 items left`). Cheap but important because the toolbar icon can scroll out of frame on long lists.

**4. Cart tray "not opening".** The 100px-tall cart bottom sheet (rendered in `Navigation.js`) was actually animating in — but `getBottomSheetPosition` only subtracted the tab-bar height from `screenHeight`, leaving most of the 100px body tucked *behind* the tab bar (which wins zIndex 99 vs sheet's 98). Users saw at most a thin sliver peeking above the tab bar — indistinguishable from "nothing happened".

  - `getBottomSheetPosition` now subtracts `CART_SHEET_HEIGHT` as well, so the entire 100px sheet sits above the tab bar.

**5. DDPI help modal UX fixes** (follow-up from [3.9.15]):
  - Converted from bottom-sheet → centered card popup (`borderRadius: 16`, `maxWidth: 460`, `maxHeight: 85%`). The help sheet is informational content, not a persistent bottom-sheet drawer.
  - Added three closable paths: (a) tap backdrop, (b) X button in header, (c) Android hardware back — the back-handler closes the stacked WebView first if open, else the whole modal.
  - When the in-app WebView sub-overlay is open, the header now has both a back arrow (returns to steps) AND a full X close (dismisses the whole help modal) so users coming from "Retry sell order" can close and resume the retry flow in one tap instead of two.

**Files:**
- `src/hooks/useRefreshBrokerStatus.js` — fast path + parallel network.
- `src/utils/rebalanceHelpers.js` — `isTransientFundsError(resp, broker)`, Upstox-scoped maintenance-window guard, `isFundsErrorOrMissing(f, s, b)`.
- `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` — `handleCheckBroker` routed through `isFundsErrorOrMissing`.
- `src/components/AdviceScreenComponents/StockAdvices.js` — 5 raw-check sites replaced + Toast feedback on add/remove.
- `src/components/AdviceScreenComponents/AddtoCartModal.js` — raw-check replaced with `isFundsErrorOrMissing`.
- `src/components/AdviceScreenComponents/RebalanceAdvices.js` — broker arg passed to `isFundsErrorOrMissing`.
- `src/components/CartContext.js` — self-syncing via `cartUpdated` event.
- `src/components/CustomToolbar.js` — cart icon + badge.
- `src/components/Navigation.js` — bottom-sheet geometry fixed.
- `src/components/BrokerDdpiHelpModal.js` — centered popup, 3 close paths, `Pressable` backdrop, `BackHandler` on Android.

**Still-open gaps (same class, different surface):** `UserStrategySubscribeModal.js:213`, `MPPerformanceScreen.js:640`, `BespokePerformanceScreen.js:548`, `IgnoreTradesScreen.js:1441` — raw `funds.status === 1 || …` pattern. Port if the symptom recurs there.

---

## [3.9.15] - 2026-04-23

### Fixed — DDPI help module: broken URLs + external-browser CTA replaced with closable in-app WebView + fresh-funds gate extended to basket & bespoke

**Broken DDPI URLs.** 9 of the 13 broker entries in `src/config/brokerDdpiHelp.js` shipped with URLs that 404'd, 500'd, or redirected to login/error pages. Verified all 13 via curl with full Chrome UA; replaced the bad ones:

| Broker | Old URL | New URL |
|---|---|---|
| Zerodha | `support.zerodha.com/category/account-opening/...activate-ddpi` | `support.zerodha.com/category/your-zerodha-account/your-profile/ddpi/articles/activate-ddpi` (followed the real 2xx redirect target) |
| Upstox | `help.upstox.com/support/solutions/articles/260000008762-what-is-ddpi-` (500) | `upstox.com/help-center/t-260205/` |
| Fyers | `fyers.in/support/solutions/articles/103000114524-...` (404) | `support.fyers.in/portal/en/kb/articles/how-do-i-activate-ddpi-on-fyers-online-and-offline` |
| Dhan | `knowledge.dhan.co/support/solutions/articles/82000900258-...` | `dhan.freshdesk.com/support/solutions/articles/82000900258-from-where-ddpi-service-can-be-activated-` (real origin) |
| AliceBlue | `aliceblueonline.com/support/account-opening/ddpi-activation-guide/` | `wp.aliceblueonline.com/support/account-opening/ddpi-activation-guide/` (real origin; the bare domain 3xx's here anyway) |
| ICICI Direct | `icicidirect.com/customerservice/questions-detail/what-is-ddpi` (redirects to login) | `icicidirect.com/faqs/my-account/how-can-i-activate-ddpi-with-icici-securities` |
| HDFC Securities | `null` | `hdfcsec.com/Products/FAQ/2633` (live FAQ; self-serve DDPI flow is still form-based but this gives users a landing page) |
| IIFL Securities | `indiainfoline.com/customer-service/customer-service-faqs` (404) | `indiainfoline.com/knowledge-center/demat-account/demat-debit-and-pledge-instruction` |
| Motilal Oswal | `motilaloswal.com/blog-details/What-is-a-Demat-Debit-and-Pledge-Instruction-...` (404) | `motilaloswal.com/learning-centre/2025/1/what-is-ddpi-the-role-of-demat-debit-and-pledge-instructions` |
| Kotak Securities | `kotaksecurities.com/faqs/demat-account/what-is-ddpi/` (redirects to 404) | `kotakneo.com/investing-guide/share-market/what-is-ddpi/` |
| Axis Securities | `simplehai.axisdirect.in/help-and-support/demat-account` (redirects to /error) | `simplehai.axisdirect.in/544-faqs-ri/demat-account/6396-what-is-demat-debit-pledge-instruction-ddpi-how-to-download-it` |
| Groww | `groww.in/p/ddpi` (404) | `groww.in/help/stocks,-f&o,-ipo-&-mtf/searchable/how-can-i-opt-for-ddpi--60` |

Angel One's old URL was already correct.

**Why the old URLs rotted.** Fresh-desk sub-domains renamed (Dhan, Fyers), WP origin domains exposed (AliceBlue), FAQ hubs restructured (ICICI, Kotak, Motilal), Cloudflare error pages behind redirects (Axis), Upstox migrated from Freshdesk-style article IDs to shorter `/t-XXXXXX/` slugs, Groww replaced their `/p/ddpi` vanity page with a help-center searchable path. All verified 200 via curl with a realistic Chrome UA; ICICI and HDFC block the default curl UA (return 404) but render correctly in an in-app WebView with the mobile Chrome UA string.

**In-app WebView replaces `Linking.openURL`.** The "Open {broker}'s DDPI page" CTA previously kicked the user out to Chrome — bad UX generally, worse when the destination was broken. `src/components/BrokerDdpiHelpModal.js` now stacks a second closable overlay on top of the help sheet that renders the broker's DDPI page in a `react-native-webview`. Header has a back arrow (returns to the help sheet), the broker name, and an external-browser escape hatch (still uses `Linking.openURL` so users who prefer Chrome aren't blocked). WebView sets a desktop-Chrome-ish UA on Android so pages that 404 to the default Android WebView UA render correctly.

**Fresh-funds gate extended to basket and bespoke surfaces.** [3.9.11] fixed `RebalanceCard.js`; [3.9.14] fixed `RebalanceAdvices.js`. Same class of bug (closure-bound `funds` / `brokerStatus` re-popping the TokenExpire modal right after a successful reconnect) was still live on two other entry points that the user surfaced:

- **Basket** (`src/components/AdviceScreenComponents/AddtoCartModal.js:handleTrade`) — the `isFundsEmpty` pre-check across Zerodha / Fyers / default-broker branches now reads `freshStatus.funds ?? funds` / `freshStatus.brokerStatus ?? brokerStatus` via the new shared hook.
- **Bespoke** (`src/components/AdviceScreenComponents/StockAdvices.js`) — three handlers touched: `handleTrade` (line ~1565, previously refetched only user), `handleTradeBasket` (line ~1704, had no refresh at all), `handleSingleSelectStock` (line ~2308, previously refetched only user). All three now shadow `broker` / `brokerStatus` / `funds` from `refreshBrokerStatus()` output before any downstream branch reads them.

**Shared hook extraction.** Rather than a 4th copy-paste of the refresh-user-then-refresh-funds helper, extracted the logic to `src/hooks/useRefreshBrokerStatus.js`. Returns `{brokerStatus, broker, userDetails, funds}`; hit-counts internal `getUserDeatils()` so context also converges on the next render. `RebalanceCard.js` and `RebalanceAdvices.js` refactored to use the shared hook (deleted their local duplicates).

**Files:**
- `src/config/brokerDdpiHelp.js` — URL replacements.
- `src/components/BrokerDdpiHelpModal.js` — in-app WebView overlay, back arrow, external-browser escape, Android desktop UA.
- `src/hooks/useRefreshBrokerStatus.js` (new) — shared hook.
- `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` — swap local helper → shared hook.
- `src/components/AdviceScreenComponents/RebalanceAdvices.js` — swap local helper → shared hook.
- `src/components/AdviceScreenComponents/AddtoCartModal.js` — add hook + use fresh state in `handleTrade`.
- `src/components/AdviceScreenComponents/StockAdvices.js` — add hook + use fresh state in `handleTrade`, `handleTradeBasket`, `handleSingleSelectStock`.

**Still-known gaps (not this PR):** `UserStrategySubscribeModal.js:213`, `MPPerformanceScreen.js:640`, `BespokePerformanceScreen.js:548`, `IgnoreTradesScreen.js:1441` — same `funds.status === 1 || ...` pattern, different surface. Port when those surfaces show the symptom.

---

## [3.9.14] - 2026-04-22

### Fixed — "Login to {broker}" modal re-pops on Home screen Rebalance tap after successful reconnect (RebalanceAdvices closure-bound funds)

**Symptom.** Right after connecting Upstox (e.g. from settings or the broker-selection modal), tapping Rebalance on a Portfolio Recommendation card on Home re-opened the `TokenExpireBrokerModal` ("Authentication Required — Login to Upstox") even though the broker was already connected and the access token valid.

**Root cause.** The known remaining gap called out in [3.9.11] (`src/components/AdviceScreenComponents/RebalanceAdvices.js:682`). After [3.9.10]/[3.9.11] fixed `RebalanceCard.js`, this second entry point still ran `isFundsErrorOrMissing(funds, brokerStatus)` against the **closure-bound context values**. Immediately after a broker reconnect, `TradeContext.setFunds` has committed but this parent component hasn't re-rendered before the handler runs — closure still holds the pre-reconnect `{status:1}` (or `null`) funds object while `brokerStatus` has already flipped to `'connected'`. Helper returns `true` → `setOpenTokenExpireModel(true)` → modal re-pops.

**Fix.** Ported the same `refreshBrokerStatus` pattern from `RebalanceCard.js`:
- Added `fetchFunds` import.
- Added a local `refreshBrokerStatus` helper that re-fetches the user via `api/user/getUser/{email}` and calls `fetchFunds` inline with the just-fetched user object, returning `{brokerStatus, broker, funds}`.
- Replaced the `handleAcceptRebalance` pre-check so the funds/status read happens against **network-fresh values**; closure `funds` / `brokerStatus` are only the fallback when the refresh call errors.

**Files:** `src/components/AdviceScreenComponents/RebalanceAdvices.js` (import + helper + updated pre-check at the former line 682).

**Remaining known gaps with the same class of bug (not triggered by the user's current flow, flagged for future):**
- `src/components/AdviceScreenComponents/AddtoCartModal.js:381,433,443` — same stale `funds?.status === 1 || ... || null` pattern across Zerodha / Fyers / default-broker branches. Cart flow is user-action gated so less likely to self-fire right after a reconnect, but the pattern is identical. Apply the same fix if the symptom recurs there.
- `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js:213`, `src/screens/Drawer/MPPerformanceScreen.js:640`, `src/screens/Drawer/BespokePerformanceScreen.js:548`, `src/screens/Drawer/IgnoreTradesScreen.js:1441` — same class. Not audited in this PR.

---

## [3.9.13] - 2026-04-23

### Added — Reusable DDPI/EDIS help module (config + modal + global-store wiring)

Centralized the "how to activate DDPI" nudge so every surface that encounters a sell-authorization error, EDIS prompt, or manual-authorize screen can invoke the same, content-rich, per-broker help modal with one function call.

**Motivation.** DDPI activation guidance was previously:
- Hardcoded inline in `ManualSellModal.js` (ICICI-only, ignored other brokers)
- Duplicated across three separate `brokerInstructions` maps inside `DdpiModal.js`
- Missing entirely for 8 brokers (Upstox, ICICI Direct, Fyers, IIFL, Motilal, Axis, Groww, Kotak was partial)
- Had a copy-paste bug (Dhan entry said "Log in to your IIFL account")
- Never nudged users on brokers with online EDIS (Angel One, Dhan) — those users kept hitting the per-day EDIS friction with no path to the one-time DDPI upgrade

**New module.**

| File | Role |
|---|---|
| `src/config/brokerDdpiHelp.js` | Per-broker registry. All 14 brokers covered. Schema: `{title, intro, steps[], directLink, portalUrl, hasOnlineEdis, customerCare?, videoId?}`. Exports `getBrokerDdpiHelp(broker)` with case-insensitive lookup. |
| `src/components/BrokerDdpiHelpModal.js` | Reusable bottom-sheet. Renders title + persuasive broker-specific intro + optional EDIS callout (conditional on `hasOnlineEdis: true`) + numbered step list + customer-care contact footer + primary CTA ("Open {broker}'s DDPI page") + dismiss. Pure consumer of the config. |
| `src/GlobalUIModals/ModalManager.js` | Registered as `case 'DdpiHelp'`. Payload: `{broker: '<name>'}`. |
| `src/components/ManualSellModal.js` | Replaced hardcoded ICICI-only text with broker-aware copy + prominent green nudge row that calls `openModal('DdpiHelp', {broker})`. Accepts `broker` prop (default `'ICICI Direct'` for backward compat with existing callsites). |
| `src/components/DdpiModal.js` | Added the same green nudge row below the "authorize manually" text so users on the DDPI modal can jump directly to the activation guide for their broker. |

**Persuasion-first content**, not a dry instruction list:

- Every broker's `intro` explains what DDPI is in one sentence AND why this user should activate it right now (*"without it, every sell you place here will require a per-session TPIN prompt on the broker's site, which often fails from third-party apps"*).
- For Angel One and Dhan (online-EDIS brokers), the modal renders an additional *"Why DDPI even though {broker} has online EDIS?"* callout — acknowledges EDIS works but pitches DDPI as the one-time upgrade that removes the per-day friction. Without this nudge, those users skip DDPI assuming it's unnecessary and come back with the same issue next rebalance cycle.
- For HDFC Securities (no self-serve DDPI flow), `directLink: null` and the customer-care email/phone are surfaced instead — CTA becomes "Open HDFC's portal". Honest degradation.

**Docs.** New "DDPI/EDIS Help module" section added to `docs/BROKER_CONNECTION.md` covering module layout, invocation patterns, persuasion-copy design choices, consumer surfaces, the "when adding a new broker" checklist, and explicit tech debt (three inline `brokerInstructions` maps still inside `DdpiModal.js` at lines ~886/1799/2180 — deferred to a follow-up PR since that file is 2685 lines with pre-existing eslint issues).

**Cross-repo follow-up**: port the same pattern to tidi_new (Flutter). Not in this PR.

---

## [3.9.12] - 2026-04-23

### Fixed — Kite publisher multi-layer fix: scripmaster / LTP fallback / MARKET-protection centralization

End-to-end fix for Zerodha publisher basket orders failing or mis-routing. Four distinct bugs, all shipped together because they share the `/zerodha/convert-symbol` → `applyKiteMarketProtection` pipeline.

#### 1. Per-broker scripmaster disambiguation (Zerodha + HDFC) — wrong-security risk class

Two distinct scripmasters had the same class of bug — `fetchone()` returning whichever row SQLite's B-tree yielded first when multiple rows shared the lookup key. Different data, same class.

**Zerodha**: INFY-EQ → NIFTY TOP 20 EW

`brokers/zerodha/zerodha_scrip_master.py: get_zerodha_symbol_from_angelone_symbol()` SQL was:

```sql
SELECT tradingsymbol FROM zerodha_scrip_data WHERE exchange_token = ? AND exchange = ?
```

Zerodha's scripmaster carries **multiple rows with the same `(exchange_token, exchange)`** — one for the tradable equity (`segment='NSE'`) and one for an index composition marker (`segment='INDICES'`). SQLite's `fetchone()` picked whichever came first in the B-tree — in practice the INDICES row. Consequence: `INFY-EQ` resolved to `NIFTY TOP 20 EW` (an unrelated ETF) and orders would have gone to the wrong security or been rejected. Audit found dozens of other `(exchange_token, NSE)` pairs with the same collision pattern.

Fix: added `AND segment = ?` with exchange as the third bind arg (NSE/BSE rows have `segment = exchange`; INDICES rows have `segment = 'INDICES'`). Belt-and-braces fallback query uses `segment != 'INDICES'` if the strict match returns nothing. Single WHERE-clause fix corrects every collision simultaneously.

Verification: `INFY-EQ` before → `NIFTY TOP 20 EW`. After → `INFY`. Other 6 representative symbols (ADARSHPL, GTLINFRA-EQ, VIKASECO-EQ, TCS-EQ, RELAXO-EQ, INFRAIETF-EQ, JIOFIN-EQ) unchanged (were already correct).

**HDFC**: equity tokens collided with currency futures on the same `exch_security_id`

`brokers/hdfc/hdfcsec_scrip_master.py: get_hdfcsec_symbol_from_angelone_symbol()` had `WHERE exch_security_id = ? AND exchange = ?` — which could match TWO rows, one equity (`instrument_segment='EQUITY'`) and one currency future (`instrument_segment='FUTCUR'`). E.g. token 1011 on NSE resolves to BOTH SCHAEFFLER (equity) AND EURINR (FUTCUR). SCHAEFFLER equity orders could silently have been placed on EURINR currency futures.

Fix: disambiguate by the original AngelOne segment — for NSE/BSE equity lookups, filter `instrument_segment = 'EQUITY'`; for NFO/BFO/CDS/MCX, filter to the matching derivative types. Belt-and-braces fallback drops the filter if strict match returns nothing, logging for audit.

**Audit across other broker scripmasters** (performed 2026-04-23): ICICI (schema keyed on `ExchangeCode + Series` — naturally unique), AliceBlue, Upstox, Fyers, Dhan, Groww, Motilal, IIFL, Axis — all confirmed SAFE. Their lookup code already includes the correct disambiguator (e.g. Axis: `AND segment = 'EQ'`; Upstox: `AND instrument_type` filter in the broker module). Only Zerodha and HDFC were missing the segment filter. Documented in `docs/BROKER_CONNECTION.md § Per-broker scripmaster disambiguation`.

#### 2. `/zerodha/convert-symbol` returns `ltp: null` for BSE-primary stocks

`apps/app_zerodha.py: _get_cached_ltp()` reads from Redis DB 11 where the websocket server (`servers/server2/websocket`) writes `ltp:{EXCH}:{SYMBOL}` keys. Only symbols in some user's active subscription pool get written — BSE-primary stocks that aren't actively ticked never appear, so the cache returns None. Consequence: `applyKiteMarketProtection` falls through to plain MARKET and Kite rejects GSM/T2T/BE stocks.

Fix: added `_live_fetch_ltps(fetch_specs)` which does a single batched live Angel One market-data call for Redis-miss symbols, merges the response back into the `results` array. Silent best-effort — if the live fetch fails the `ltp` stays `null` and the client falls through to the existing behaviour. One extra round-trip (~200–500ms) per `/zerodha/convert-symbol` call if ANY symbol missed Redis.

Verification: VIKASECO LTP now populates via the live-fetch fallback even when Redis is cold.

#### 3. Centralized MARKET→LIMIT conversion across ALL equity brokers

`brokers/market_order_conversion.py` is now the single source of truth for every broker's MARKET-order protection:

| Broker | Before | After |
|---|---|---|
| ICICI | Used shared helper ✓ | Unchanged |
| AliceBlue | Used shared helper ✓ | Unchanged |
| Zerodha | Rejected MARKET silently; no protection | Uses shared helper (`compute_ioc_limit_price`, `converted_validity_for_exchange`, `fetch_ltp_for_symbol`) |
| Motilal Oswal | Had its own MARKET→LIMIT but used LTP as-is (no buffer, no tick rounding) | Keeps its fast Redis-cached LTP source but delegates buffer+tick math to the shared helper |

Tick schedule updated to the Kite-compatible buckets (`₹0.10` < ₹500, `₹0.20` for ₹500–5000, `₹0.50` > ₹5000) — replaces the old `₹1.00 above ₹5000, else ₹0.10` which was Kite-incompatible in the ₹500–5000 band. Kite's ticks are a strict superset of ICICI/AliceBlue's, so the change tightens without regressing either. Mirrors the client-side `src/utils/brokerPublisher.js: roundToKiteTick`.

Tiered buffer (0.3% / 0.5% / 1.0% by LTP) unchanged.

The shared helper's top-of-file docstring now prescribes the template every new equity broker's `place_order` should follow. Derivatives (NFO/BFO) skip the conversion because exchange-level MARKET handling is correct for options/futures.

#### 4. Client-side UI: `useZerodhaSymbolMap` hook + `resolveZerodhaSymbol` + `roundToKiteTick` + 6 publisher callsites

- `src/utils/brokerPublisher.js` — fixed 3 latent bugs in `convertSymbolsToZerodha` (wrong imports, wrong auth header, wrong response-shape unwrap) so the helper actually works. Added `resolveZerodhaSymbol(stock, symbolMap)` and `roundToKiteTick(price)`. `applyKiteMarketProtection` now snaps the buffered price to the same Kite tick schedule as the server.
- `src/hooks/useZerodhaSymbolMap.js` (new) — React hook that fetches the scripmaster map on advice-symbol-list change. Memoized.
- 6 Zerodha publisher basket builders wired: `ReviewZerodhaTradeModal`, `UserStrategySubscribeModal`, `MPReviewTradeModal`, `RebalanceModal`, `StockAdvices`, `AddtoCartModal`. Each calls `useZerodhaSymbolMap` + uses `resolveZerodhaSymbol` for outgoing `tradingsymbol`/`exchange` in the Kite basket POST. LTP precedence: live-ws on resolved symbol → live-ws on raw symbol → server-cached `ltp` from `/zerodha/convert-symbol`.
- `RebalanceModal.js: getLTPForSymbol` wrapper also consults the scripmaster map in the priority chain, so the Step-3 review UI's "Current Price" column shows the scripmaster-provided LTP for BE/BSE-primary stocks instead of ₹0.

### Deploy ordering

All backend changes are live on tidi (ccxt-india restarted 22:21 UTC). Mobile JS changes take effect on next Metro reload / APK rebuild. Backend is forward-compatible with older clients.

### Remaining follow-up (deferred)

- 5 of 6 mobile publisher callsites still pass raw `stock.exchange` to `useWebSocketCurrentPrice`. For BE/BSE-primary stocks the live websocket won't emit; the scripmaster cached LTP covers the MARKET-protection path but the review UI may briefly show ₹0 until the cache arrives. Only `RebalanceModal` subscribes with the resolved exchange today. Non-blocking — fix in a later pass.
- Motilal's redis-LTP cache is a different key format than the shared helper — functional but not unified. No action needed today.

---

## [3.9.11] - 2026-04-23

### Fixed — "Login to {broker}" re-pops on first Retry Rebalance tap after successful reconnect (RebalanceCard closure-bound funds)

**Symptom.** User re-auths ICICI Direct → "Connected Successfully" → taps Retry Rebalance → "Login to ICICI Direct" appears *again*. Wait 10 seconds, tap again, works. Repro-rate: ~every first tap immediately after reconnect.

**Root cause.** Even after [3.9.10] made `fetchBrokerStatusModal` eagerly refresh funds in `TradeContext`, `RebalanceCard.handleCheckStatus` / `handleCheckBroker` (`src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js:234,599`) still read the **closure-bound `funds` prop** that the parent passes down. Between the reconnect and the next Retry Rebalance tap, TradeContext's `setFunds` has committed but the parent `RebalanceAdvices` hasn't re-rendered *before* the handler runs — so the closure still holds the pre-reconnect `{status:1}` object. `isFundsErrorOrMissing` trips → `setOpenTokenExpireModel(true)` → TokenExpire modal re-opens despite the broker actually being connected.

**Fix.** Extended `refreshBrokerStatus` (same file, line 93) to also fetch funds inline with the just-fetched user object and return them alongside `brokerStatus` / `broker` / `userDetails`. Updated both `handleCheckStatus` (line ~234) and `handleCheckBroker` (line ~599) to read `freshStatus.funds ?? funds` instead of closure `funds` — network-fresh value wins, closure prop is only the fallback on fetch error. Falls back gracefully if the funds endpoint is flaky (same behaviour as before, just with the stale reference narrowed to the error path).

**Files:** `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` (added `fetchFunds` import; extended `refreshBrokerStatus`; tweaked both handlers).

**Known remaining gap.** `src/components/AdviceScreenComponents/RebalanceAdvices.js:682` has the same closure-bound `funds` read in its own check path. Not touched here because it's a different entry point (not hit by HomeScreen's Retry Rebalance button). If the symptom recurs from a different surface, apply the same pattern.

---

## [3.9.10] - 2026-04-23

### Fixed — "Login to Zerodha" loop after successful OAuth reconnect; Groww mid-trade now one-tap refreshes

**Symptom 1 (loop).** User taps Retry Rebalance → "Login to Zerodha" appears → reconnects Zerodha → "Connected Successfully". User taps Retry Rebalance again → "Login to Zerodha" re-appears. Forever.

**Root cause.** `fetchBrokerStatusModal` in `src/screens/TradeContext.js` refreshed `userDetails` but relied on the `useEffect([userDetails, configData])` at line 1236 to trigger `getAllFunds()`. That effect gates on the **stale** `broker` state variable (not a dep), and `getAllFunds` closes over a `userDetails` snapshot that may not be committed when it runs. Result: `funds` stayed at its pre-reconnect value (likely `null` or `{status:1}`). On the next Retry Rebalance tap, `RebalanceCard.handleCheckStatus` (`src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js:200-216`) called `refreshBrokerStatus()` (OK — returned `connect_broker_status:'connected'`), then hit the second door: `isFundsErrorOrMissing(funds, currentBrokerStatus)` returned `true` because funds was stale → `setOpenTokenExpireModel(true)` re-fired. Broker was actually connected; client-side funds state just hadn't caught up.

**Fix.** Rewrote `fetchBrokerStatusModal` (`src/screens/TradeContext.js:1013-1060`) to await `getUserDeatils()`, **then synchronously call `fetchFunds` with the fresh user object** it returned — bypassing the stale-closure / ref-equality pitfalls of the `useEffect`. Every OAuth broker (Zerodha / Dhan / Angel One / AliceBlue / Axis / Fyers / Upstox / ICICI / HDFC / Motilal) benefits because they all call `fetchBrokerStatusModal` via `commonProps` in `ModalManager` after their `connect-broker` save.

### Changed — Groww mid-trade session-expiry: one-tap refresh instead of credential form

**Symptom 2.** When a Groww user hit a mid-trade "Login to Groww" modal and tapped it, our [3.9.9] fix opened the full `GrowwConnectModal` (4-step credential-paste form). That's wrong — Groww stores a TOTP seed server-side (AES-256 at rest), so `POST /api/groww/refresh-token` can mint fresh tokens silently. `TokenExpireBrokerModal.handleGrowwRefresh` already does exactly this; the mid-trade `BrokerSelectionModal` path was the exception.

**Fix.** Added a Groww-specific branch to `BrokerSelectionModal.handleBrokerSelectOpenExpire` (`src/components/BrokerSelectionModal.js`) that calls `refreshGrowwSession` directly. Falls back to `openModal('Groww')` only on `NO_TOTP_SEED` / `INVALID_SEED` (legacy customers without a stored seed, or a key revoked on Groww's dashboard). Success path re-hydrates state via `fetchBrokerStatusModal` + `refreshEvent` emit so the next Retry Rebalance tap isn't caught by Symptom 1's funds-stale trap. Button label and security-note copy now switch to "Refresh Groww session" / "Takes about 2 seconds, no credentials needed" when `broker === 'Groww'`, and an `ActivityIndicator` replaces the arrow icon while refreshing.

**Files:**
- `src/screens/TradeContext.js:1013-1060` — `fetchBrokerStatusModal` now eagerly refreshes funds with the fresh user object.
- `src/components/BrokerSelectionModal.js` — added `refreshGrowwSession` + `eventEmitter` imports; pulled `fetchBrokerStatusModal` + `showModalAlert` out of hooks; added Groww branch to `handleBrokerSelectOpenExpire`; Groww-specific button label / security note / loading spinner.

---

## [3.9.9] - 2026-04-23

### Fixed — Mid-trade session-expiry modal: "Login to ICICI Direct" (+ 4 other brokers) silently no-opped AND re-opened the full credential form instead of the smart OAuth WebView

**Symptom.** User clicks "Retry Rebalance" on an MP with an expired broker session → "Authentication Required / Login to ICICI Direct" modal appears → tapping the button either (a) did nothing at all, or (b) opened the full ICICI credential form asking for API Key + Secret again even though credentials were already saved. Correct behaviour is the same smart-reauth flow `ManageConnectionsModal` uses — jump straight into the OAuth WebView with stored creds.

**Root causes — two separate bugs in the same handler.**

1. **Key mismatch → silent no-op.** `BrokerSelectionModal.handleBrokerSelectOpenExpire` passed raw `userDetails.user_broker` (e.g. `'ICICI Direct'`) into `useModalStore.openModal()`. `GlobalUIModals/ModalManager.js` dispatches on a `switch (visibleModal)` whose cases use the shorter modal key (`'ICICI'`, `'HDFC'`, `'Motilal'`, `'Kotak'`, `'Angel One'`). Any unmatched key hit `default: return null` — zero visible feedback. Five `user_broker` values affected: `ICICI Direct` → `ICICI`, `Kotak Neo` → `Kotak` (written by `KotakModal.js:162`), `Hdfc Securities` → `HDFC`, `Motilal Oswal` → `Motilal`, `AngelOne` (alt writer) → `Angel One`.

2. **Bypassed the smart-reauth router.** Even once the key-mismatch was fixed, `openModal('ICICI')` just opens the stock `ICICIUPModal` with an empty credential form — the pre-signed-OAuth-URL shortcut from `src/utils/reauthHelpers.js:handleSmartReauth` was never invoked. Web (`subscription.js:handleCredentialReauth`) and mobile `ManageConnectionsModal.handleReconnect` both go through this router; `BrokerSelectionModal` was the odd one out.

**Fix.** Rewrote `handleBrokerSelectOpenExpire` to call `flipPrimaryBroker` + `handleSmartReauth` first. For credential brokers (Upstox/ICICI Direct/Hdfc Securities/Motilal Oswal/Fyers) the backend `/reauth-url` returns a pre-signed OAuth URL, stored creds are decrypted locally, and the per-broker modal opens with `modalPayload.reauthConfig` so it skips the credential form entirely (its existing hydration `useEffect` picks it up and jumps straight to the WebView). For partner-OAuth / Kotak TOTP / Groww / anything that returns `requiresForm` or `requiresTotp`, falls back to `openModal(modalKey)` where `modalKey` is resolved via the new `USER_BROKER_TO_MODAL_KEY` lookup (fixing bug #1). Modal unmount is sequenced before `openModal` with a 100ms setTimeout so Android doesn't swallow the second transparent Modal — matches the pattern documented in `reauthHelpers.js:167`.

**Files:** `src/components/BrokerSelectionModal.js` (added `useConfig` + `handleSmartReauth`/`flipPrimaryBroker` imports; pulled `configData` + `userDetails` out of `useTrade`; rewrote `handleBrokerSelectOpenExpire`).

---

## [3.9.8] - 2026-04-23

### Fixed — Kite publisher basket: BE-series / BSE-primary stocks silently dropped (VIKASECO)

**Symptom.** A Zerodha publisher rebalance included VIKASECO-EQ and it showed up in the Kite basket with `order_type: MARKET, price: 0`. Kite rejects plain MARKET orders on GSM/T2T/BE stocks and silently drops BSE-primary symbols sent to NSE. User-visible outcome: mysterious partial basket with no broker-side reason.

**Root causes.**

1. `convertSymbolsToZerodha()` in `src/utils/brokerPublisher.js` has been **broken since inception** — (a) imports `Config from './Config'` (local APP_VARIANTS) instead of `react-native-config`, so `Config.AQ_KEY` was always undefined; (b) uses `Bearer` auth header but the backend route `/zerodha/convert-symbol` decorator is `@validate_token` which expects `aq-encrypted-key`; (c) dereferences `ccxtServer` as a named import from `serverConfig` but that file default-exports `server`, so the URL resolved to `"undefined/zerodha/convert-symbol"` → every request 404'd. Zero callers used it anyway (grep: no hits), so the bug was invisible.
2. The 6 Zerodha basket builders (`ReviewZerodhaTradeModal.js`, `UserStrategySubscribeModal.js`, `MPReviewTradeModal.js`, `RebalanceModal.js`, `StockAdvices.js`, `AddtoCartModal.js`) all built the basket with raw `stock.tradingSymbol` + `stock.exchange`. No scripmaster consultation. So a stock tagged `VIKASECO-EQ` on NSE in tradeReco was sent to Kite as exactly that, even though the NSE scripmaster no longer has it — Kite silently drops.
3. `useWebSocketCurrentPrice` subscribes `-EQ` / `-BE` / `-SM` / `-ST` symbols to NSE with no BSE fallback. If VIKASECO moved to NSE-BE (trade-to-trade) or to BSE-only, the NSE feed emits nothing → `getLTPForSymbol` returns 0 → `applyKiteMarketProtection` falls through to plain MARKET → Kite rejection. The backend ccxt-india BE→BSE fix (2026-04-22) only covers the ProcessTrades path, not the publisher basket path.

**Fixes.**

1. **`src/utils/brokerPublisher.js`** — fixed imports (`import RNConfig from 'react-native-config'`, `import server from './serverConfig'`), rewrote `convertSymbolsToZerodha()` to use `aq-encrypted-key` header with `generateToken(RNConfig.REACT_APP_AQ_KEYS, RNConfig.REACT_APP_AQ_SECRET)`, parse the `{results: [...]}` shape correctly, and return a map keyed by `angelone_symbol`. Added `resolveZerodhaSymbol(stock, symbolMap)` helper that returns `{tradingsymbol, exchange, cachedLtp}` — single place for `-EQ` strip + scripmaster override + server-cached LTP extraction.
2. **New `src/hooks/useZerodhaSymbolMap.js`** — `useZerodhaSymbolMap(stockDetails, enabled)` hook. Fires `convertSymbolsToZerodha` on mount / when the advice-symbol list changes. Keyed on sorted joined symbol list so unrelated re-renders don't refetch.
3. **All 6 publisher basket builders wired**: each calls `useZerodhaSymbolMap` at the component top and uses `resolveZerodhaSymbol(stock, symbolMap)` during basket build to drive `tradingsymbol` + `exchange`. LTP preference becomes: live-ws on resolved symbol → live-ws on raw symbol → server-cached `ltp` from `/zerodha/convert-symbol`. The server-cached fallback is the load-bearing piece for BE-series / BSE-primary stocks — it's returned by ccxt-india's Redis-cached LTP lookup (`_get_cached_ltp` in `apps/app_zerodha.py:convert_symbol`) and covers exactly the symbols that live-ws can't.
   - `src/components/ReviewZerodhaTradeModal.js:76` + `:420` basket build. Derivative (NFO/BFO) branch intentionally preserves advice-side exchange since scripmaster's equity answer doesn't apply.
   - `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js:394` + `:831` basket build.
   - `src/components/ModelPortfolioComponents/MPReviewTradeModal.js:270` + `:857` basket build.
   - `src/components/AdviceScreenComponents/RebalanceModal.js:310` + `:602` basket build + `useWebSocketCurrentPrice` subscription updated to subscribe with the resolved exchange so live LTP flows for BE/BSE-primary stocks without relying on the server-cached fallback.
   - `src/components/AdviceScreenComponents/StockAdvices.js:236` + `:1113` basket build.
   - `src/components/AdviceScreenComponents/AddtoCartModal.js:206` + `:973` basket build.

**Architectural note.** ccxt-india's `ZERODHA_SCRIP_MASTER.get_zerodha_symbol_from_angelone_symbol()` is the single source of truth for NSE ↔ BSE / EQ ↔ BE decisions — it reads NSE's daily circular and BSE's scripmaster to determine where each symbol trades today. Never replicate the mapping client-side; always go through `/zerodha/convert-symbol`. `brokerPublisher.resolveZerodhaSymbol` is a pure consumer of that map.

**Not fixed (deferred).**
- `useWebSocketCurrentPrice.subscribeViaAPI` still subscribes to the list with whatever exchange the caller passed. For callsites that DON'T rewrite `wsSymbols` via the resolved symbol (5 of 6 — only RebalanceModal does), live LTP for BE-series stocks remains empty and `applyKiteMarketProtection` falls back to the server-cached LTP. That's sufficient for market-protection correctness but shows a stale price in the review UI for a few seconds. Follow-up: wire the `wsSymbols` rewrite into the remaining 5 callsites.
- BSE fallback on `useWebSocketCurrentPrice` itself (subscribe to NSE, retry with BSE on timeout) is a bigger refactor deferred separately.

---

## [3.9.7] - 2026-04-23

### Fixed — Zerodha publisher basket + shared-env-var coupling with Groww

**ENV-VAR CHANGE — CROSS-BROKER IMPACT.** Reverted commit `f9f5d0f`'s `.env` change of `REACT_APP_BROKER_CONNECT_REDIRECT_URL` and isolated the Zerodha publisher WebView's origin from it.

**Root cause.** Commit `f9f5d0f` (2026-04, "Groww OAuth via Android App Links") changed `.env`'s `REACT_APP_BROKER_CONNECT_REDIRECT_URL` from `https://prod.alphaquark.in/stock-recommendation` → `https://app-links.alphaquark.in/broker-callback`. That var is a **shared-across-8-broker-flows** value. Groww's actual App Links behaviour lives in `AndroidManifest.xml`'s `<intent-filter>` (hardcoded `app-links.alphaquark.in`) and does **not** read this env var — confirmed by `grep -rn REACT_APP_BROKER_CONNECT_REDIRECT_URL src/components/BrokerConnectionModal/GrowwConnectModal.js src/utils/growwRefresh.js` returning zero hits. So the `.env` change was redundant for Groww and silently flipped the fallback for 10 of 12 backend tenants (those without `appadvisors.brokerConnectRedirectUrl`), and flipped the Zerodha basket Referer origin for the `prod` tenant because the Kite basket WebView had never had a `baseUrl` and Referer was defaulting to `about:blank` — Kite rejects that with a misleading `Invalid 'api_key'` error.

**Fixes.**

1. **`.env` reverted** — `REACT_APP_BROKER_CONNECT_REDIRECT_URL=https://prod.alphaquark.in/stock-recommendation` restored, with a blocking in-file comment pointing at `docs/BROKER_CONNECTION.md § Per-broker redirect URL reference` and explicitly calling out that Groww does not need this var.
2. **Zerodha basket Referer isolated** — `src/utils/brokerPublisher.js` gains `getPublisherWebViewBaseUrl(configData)` which derives the Kite basket `baseUrl` from `configData.customDomain` → `configData.subdomain` / `REACT_APP_HEADER_NAME` → `prod.alphaquark.in`. **Intentionally does NOT read `REACT_APP_BROKER_CONNECT_REDIRECT_URL`.** Comment in code records the isolation reason.
3. **5 Zerodha basket WebView callsites wired** — `source.baseUrl` added so Kite sees a valid Referer:
   - `src/components/ReviewZerodhaTradeModal.js:946` + `:1073` (two WebView instances)
   - `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js:1266`
   - `src/components/ModelPortfolioComponents/MPReviewTradeModal.js:1632`
   - `src/components/AdviceScreenComponents/RebalanceModal.js:1849`
4. **`docs/BROKER_CONNECTION.md`** — new "§ Per-broker redirect URL reference (MANDATORY reading before touching `REACT_APP_BROKER_CONNECT_REDIRECT_URL`)" section with a per-broker consumer map (12 brokers × { auth type, reads the shared var?, where the URL is sent, dev-portal registration requirement, publisher/basket `baseUrl` needed }), a shared-env-var coupling table, and a post-mortem of the incident.
5. **`CLAUDE.md`** — new "§ Shared env vars across brokers — BLOCKING GUARDRAIL" section enumerating the 6-step audit protocol any future contributor must follow before editing a shared broker env var. Designed to make this class of regression impossible to introduce again without tripping an explicit blocking checkpoint.

**Not fixed (deferred).**

- Help-content screens (`FyersHelpContent`, `KotakHelpContent`, `MotilalHelpContent`, `DhanHelpContent`, `AliceblueHelpContent`, `HDFCHelpContent`) read `Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL` directly instead of going through `configData`. For any tenant with a backend override, they'll display the `.env` fallback (wrong) while runtime actually uses the backend value (right). Only `UpstoxHelpContent` has the proper `redirectURLProp || Config...` pattern. Tracked as a follow-up — low priority since affected tenants have backend overrides for the values users consume.
- 10 of 12 backend tenants still have no `appadvisors.brokerConnectRedirectUrl` set, meaning they'd fall back to whatever `.env` ships in their respective app builds. For THIS repo's prod build, that's now correctly `prod.alphaquark.in/stock-recommendation` again. Other repos / variants should verify the same.

**Why this isn't just reverting `f9f5d0f`.** The intent-filter for Groww App Links in `AndroidManifest.xml` is load-bearing and correct — it's what makes Android route `app-links.alphaquark.in/broker-callback` into the app. That part of `f9f5d0f` stays. Only the `.env` line was revertible, because it was redundant.

---

## [3.9.6] - 2026-04-23

### Removed — dead Groww connect-UI trio with pre-migration copy

Three files were left behind by the 2026-04-20 Groww OAuth → credential migration and the 2026-04-21 follow-up to TOTP-Token mode. They survived because they formed a self-contained import island (one imports the other; nothing in the active tree imports any of them), so the Metro bundler never pulled them in and their stale guidance never reached users. But they still sat in the repo with `"Click Generate API Key" → "copy the Access Token"` copy that contradicts the current `Generate TOTP token` flow — a trap for any future contributor searching the codebase for Groww UX references.

Deleted:

- `src/UIComponents/BrokerConnectionUI/GrowwConnectUI.js` (330 lines)
- `src/UIComponents/BrokerConnectionUI/GrowwConnectUI1.js` (318 lines — imports `GrowwHelpContent`)
- `src/UIComponents/BrokerConnectionUI/HelpUI/GrowwHelpContent.js` (119 lines — imported only by `GrowwConnectUI1.js`)

Verified zero imports from the active tree via `grep -rln GrowwConnectUI src/` before removal. `BROKER_CONNECTION.md` "Known follow-ups (deferred)" entry that flagged these as vestigial is now struck-through and annotated with the deletion date.

---

## [3.9.5] - 2026-04-22

### Fixed — Kotak consumer_secret fully retired across mobile + ccxt (follow-up to 3.9.4)

The 2026-04-22 morning commit (`11b099c`) correctly simplified the Kotak connect form to a single UUID "API Access Token", but left every downstream Kotak payload in the mobile app still referencing the now-absent `credentials.secretKey`. Most sites would have sent an empty `consumerSecret` to ccxt; `BrokerOrderBookAPI.js:120` would have hard-thrown `Kotak: Missing required credentials` on the first order-book call. Since the Kotak user cohort had no legacy carry-over, this was a pure regression for every new Kotak connect.

**Mobile — 9 call sites cleaned up**:

| File:Line | Fix |
|---|---|
| `src/services/BrokerOrderBookAPI.js:119` | Dropped `!secretKey` from the validation throw; dropped `consumerSecret` from `kotak/order-book` body. |
| `src/services/BrokerOrderBookAPI.js:270` | Dropped `consumerSecret` from `kotak/order-cancel` body. |
| `src/utils/rebalanceHelpers.js:252` | Dropped `consumerSecret` from `buildBrokerPayloadFields('Kotak')`. |
| `src/utils/ProcessTrades.js:320` | Dropped `consumerSecret` from the Kotak credentials dict. |
| `src/FunctionCall/fetchBrokerAllHoldings.js:103` | Dropped both the `!secretKey` guard and `consumerSecret` from `kotak/all-holdings`. |
| `src/FunctionCall/fetchBrokerSpecificHoldings.js:101` | Same as above for `kotak/holdings`. |
| `src/screens/Drawer/IgnoreTradesScreen.js:1126` | Dropped `consumerSecret` from the ignore-trades payload. |
| `src/screens/Drawer/MPPerformanceScreen.js:697` | Dropped `consumerSecret` from MP performance payload. |
| `src/screens/Drawer/BespokePerformanceScreen.js:605` | Dropped `consumerSecret` from bespoke performance payload. |
| `src/screens/PortfolioScreen/PortfolioScreen.js:232, :413` | Dropped `consumerSecret` from positions + funds payloads. |
| `src/components/AdviceScreenComponents/RebalanceModal.js:1229` | Dropped `consumerSecret` from the basket-run credential builder. |
| `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js:268, :633` | Dropped `consumerSecret` from both MP subscribe payload builders. |

**ccxt-india — `apps/app_kotak.py` `/kotak/v2/modify-order` realigned**:

The v2 modify-order endpoint was the last holdout still doing `credentials.get("secretKey")` and passing `consumer_secret=...` into `Kotak()`. It was also reading the wrong DB fields (treated `jwtToken` as `access_token`, `viewToken` as `view_token`) — inverted from every other NEO-UUID-flow handler. Realigned to match the v1 `/kotak/order-modify` + `create_kotak_instance` pattern: `apiKey` (UUID) → `access_token`, `jwtToken` (trading/session token) → `view_token`, no `consumer_secret`.

After this commit, there are zero `consumerSecret` references in mobile and zero `consumer_secret=...` arguments in `app_kotak.py`. The broker class `brokers/kotak/kotak.py` still accepts `consumer_secret` as an optional `__init__` parameter — left intact as no caller passes it anymore and the constructor gracefully handles `None`.

Docs updated: `BROKER_CONNECTION.md` Kotak section now documents the UUID-only payload shape.

---

## [3.9.4] - 2026-04-22

### Fixed — Kotak connect flow simplified to single "API Access Token" (matches web)

The Kotak credential form was collecting **Consumer Key** + **Consumer Secret** as two separate fields (6 inputs total) and sending both in the `PUT /api/kotak/connect-broker` body as `apiKey` + `secretKey`. The web source of truth (`prod-alphaquark-github/src/Home/BrokerConnection/Kotak/KotakConnection.js`) now collects a **single "API Access Token"** (UUID from NEO → TradeAPI → API Dashboard, e.g. `ec6a746c-e44b-455e-abf2-c13352b2fc45`) and sends only `apiKey`. The backend derives any downstream secret; the stored `connected_broker` record still has a `secretKey` field populated by the backend on success, so the rebalance/order-book payload builders (`rebalanceHelpers.js`, `ProcessTrades.js`, `fetchBrokerAllHoldings.js`, etc.) that still read `decrypt(secretKey)` at execution time are unaffected.

**Changes —**

- `src/components/BrokerConnectionModal/KotakModal.js`: dropped `consumerKey` / `consumerSecret` form state → renamed to single `apiKey`; removed `secretKey` from the PUT body; deleted 7 unused state vars (`clientCode`, `showProceedModal`, `selectedOption`, `panNumber`, `password`, `storeResponse`, `openOtpBox`) and the unreachable `submitOtp()` function (80 lines — stale two-stage OTP flow that was simplified to single-stage but never cleaned up).
- `src/UIComponents/BrokerConnectionUI/KotakConnectUI.js`: removed the "Consumer Secret" input; renamed "Consumer Key" → "API Access Token" with the UUID-example placeholder; removed the `openOtpBox` branch (unreachable); tightened the disabled-condition for Connect to `!apiKey || !mobileNumber || !mpin || !ucc || !totp || !egressReady`.
- `src/config/brokerRegistry.js`: Kotak `fields` trimmed from 6 to 5 — dropped `secretKey`, relabeled `apiKey` to "API Access Token" with `isSecret: true` so the generic credential screen masks it.
- `src/UIComponents/BrokerConnectionUI/HelpUI/KotakHelpContent.js`: instructions rewritten to match the web KotakSteps content — Step 1 (NEO → TradeAPI → API Dashboard → Create Application → copy UUID), Step 2 (TOTP Registration via `http://bit.ly/4h4LByx` + authenticator), Step 3 (UCC + MPIN lookup), Step 4 (enter on the form).
- **Deleted** `src/components/Kotakproceedmodal.js` — orphan file, internally labeled "Connect IIFL Securities", never imported anywhere.
- **Deleted** `src/components/BrokerConnectionModal/KotakConsumerKeySteps.js` — orphan legacy component for the two-key flow, referenced only in doc comments.

Mirrors the same simplification shipped to the Flutter retail app (tidi_new `feature/mp` — `lib/models/broker_config.dart`, `lib/service/AqApiService.dart`, `lib/components/home/portfolio/BrokerCredentialPage.dart`).

No migration needed for users already connected: the stored `connected_broker.secretKey` remains valid and the rebalance payloads continue to decrypt it. New connections skip the secret-key exchange entirely.

Docs updated: `BROKER_CONNECTION.md` — Kotak row now reflects the 5-field flow.

---

## [3.9.3] - 2026-04-22

### Fixed — Broker connect-instruction URLs now tap-to-open AND tap-to-copy (all 9 brokers)

The broker-help screens (`src/UIComponents/BrokerConnectionUI/HelpUI/*`, the legacy `src/components/BrokerConnectionModal/HelpModal.js` modal, and the developer-portal link inside `EgressIpCallout.js`) rendered every login/portal URL as a `<Text onPress={Linking.openURL(...)}>` — so the URL *opened* on tap, but there was no way to *copy* it. Users on a phone without the target browser installed (or trying to paste the URL into a desktop session) had no recourse. Worse, the Upstox block had a subtle display bug: the tappable target was `https://shorturl.at/plWYJ` (lowercase L) but the displayed text was `pIWYJ` (capital I) — users who copied the visible text landed on the wrong URL.

**Fix —** added `src/UIComponents/BrokerConnectionUI/HelpUI/LinkifiedUrl.js`, a small drop-in component that renders a URL as three inline `<Text>` nodes: the selectable, tappable, blue-underlined URL itself (tap → `Linking.openURL`), followed by a tappable copy-icon glyph (tap → `Clipboard.setString` + "Link copied" toast via `react-native-toast-message`). Same runtime-global `Clipboard` pattern as `MotilalConnectUI` / `HelpModal` / `KotakConsumerKeySteps` — no new native dep needed on RN 0.78 — with a graceful fallback toast telling the user to long-press if the shim isn't present. `selectable` on the URL span also enables native long-press-to-select as a second copy path.

Swapped the `<Text onPress={Linking.openURL(...)}>` pattern (and the `<TouchableOpacity><Text>URL</Text></TouchableOpacity>` block-link variant used for Kotak / Motilal callback URLs) to `<LinkifiedUrl url={...} />` across:

- `HelpUI/GrowwHelpContent.js` (2 URLs)
- `HelpUI/UpstoxHelpContent.js` (2 URLs — fixed the `plWYJ` vs `pIWYJ` display bug)
- `HelpUI/FyersHelpContent.js` (1 URL)
- `HelpUI/ICICIHelpContent.js` (2 URLs — the dynamic `iciciCallbackUrl` used to render as non-tappable plain text)
- `HelpUI/HDFCHelpContent.js` (2 URLs)
- `HelpUI/MotilalHelpContent.js` (2 URLs)
- `HelpUI/KotakHelpContent.js` (4 URLs)
- `HelpUI/DhanHelpContent.js` (1 URL — promoted `http://login.dhan.co` → `https://login.dhan.co`)
- `HelpUI/AliceblueHelpContent.js` (1 URL)
- `components/BrokerConnectionModal/HelpModal.js` (~15 URLs across ICICI / AliceBlue / Fyers / Dhan / HDFC / Kotak / Upstox / Motilal / Zerodha)
- `components/BrokerConnectionModal/EgressIpCallout.js` (developer-portal link)

Mirrors the same fix shipped to the Flutter retail app (tidi_new `feature/mp` commit `da63c92`).

Docs updated: `BROKER_CONNECTION.md` — note on the shared `LinkifiedUrl` helper + the Upstox `pIWYJ` display fix.

---

## [3.9.2] - 2026-04-22

### Fixed — Groww TOTP Token never parsed ("TOTP seed could not be parsed")

Groww's "Generate TOTP token" dialog labels the Base32 value **"TOTP Token"**, but the mobile form was asking for a "TOTP Seed (Base32)" — users hunting for a field literally called "Seed" on Groww's screen never found one. Those who did paste a value often pasted it with whitespace, hyphens, or as an `otpauth://` URL (scanned from Groww's QR with a generic scanner), all of which `pyotp.TOTP()` rejects with an opaque "Incorrect padding" / "Non-base32 digit" message. That surfaced as the generic `"TOTP seed could not be parsed"` error on almost every first-connect attempt.

**Backend (ccxt-india, `apps/app_groww.py`)** — added `_normalize_totp_token(raw)` which runs ahead of `pyotp.TOTP(...)`. It extracts `secret=` from `otpauth://` URLs, strips whitespace/hyphens/underscores, uppercases, pads to a multiple of 8, and validates the Base32 alphabet. Parse failures now return one of three granular error codes (`NOT_BASE32`, `WRONG_LENGTH`, `GROWW_REJECTED`) so the mobile UI can steer the user to the specific fix instead of showing the generic "could not be parsed" copy.

**Mobile —**

- `src/components/BrokerConnectionModal/GrowwConnectModal.js`: field relabeled "TOTP Seed (Base32)" → "TOTP Token", state variable `totpSeed` → `totpToken`, placeholder and helper copy updated, step-2 instruction rewritten to match Groww's actual dialog wording, three new error-code branches with targeted alerts.
- `src/config/brokerRegistry.js`: Groww field `label: 'TOTP Seed (Base32)' → 'TOTP Token'` and placeholder updated. Wire field name (`key: 'totp_seed'`) unchanged — only the user-facing label moved, so backend contract stays intact.
- `src/utils/growwRefresh.js`: user-facing copy changed to "TOTP Token"; `GROWW_REJECTED` added alongside `INVALID_SEED` in the "stored token rejected" branch.

Docs updated: `BROKER_CONNECTION.md` — Groww overview-table entry rewritten to reflect the TOTP-token flow; new "Groww TOTP Token — parsing hardening + UX fix (2026-04-22)" section added.

---

## [3.9.1] - 2026-04-21

### Fixed — Axis Securities WebView callback never fired

`src/components/BrokerConnectionModal/AxisConnectModal.js` — the WebView
navigation handler parsed the SSO callback with `new URL(url)` +
`searchParams.get('ssoId')`. React Native has no `react-native-url-polyfill`
installed, and its built-in `URL` is partial — `searchParams` can be
undefined on intermediate navigations (about:blank, data:, WebView-
internal URLs), and no try/catch was in place, so any throw killed the
handler silently. Result: WebView parked on
`app-links.alphaquark.in/broker-callback?ssoId=xxx` and the callback
POST was never issued.

Rewrote parsing to match Upstox/Zerodha in this same folder: guard with
`url.includes('ssoId=')`, split on `?`, `decodeURIComponent` each pair
in a try/catch. Also added `onShouldStartLoadWithRequest` so the
redirect landing page is intercepted BEFORE the WebView loads it — the
ssoId is snatched and the WebView closes without the user ever seeing
the blank callback URL. Split the token exchange into a standalone
`processAxisCallback(ssoId)` so both hooks (`onShouldStartLoad` and
`onNavigationStateChange`) reuse the same idempotent path gated by
`hasProcessedCallback`.

---

## [3.9.0] - 2026-04-21

### Changed — Groww: TOTP-seed default flow (parity with web)

Ported the 2026-04-21 Groww TOTP-seed migration from `prod-alphaquark-github`.
Groww deprecated partner OAuth in 2026-04; the mobile app was already on
the approval-mode credential form (2026-04-20 migration). This commit
takes it the rest of the way: approval-mode `secretKey` → Base32 TOTP
seed. Customers paste the API Key + Base32 seed once; the backend stores
the seed AES-256-CBC encrypted; daily refresh is a one-tap call to
`POST /api/groww/refresh-token` that mints a fresh TOTP server-side
(`pyotp.TOTP(seed).now()`) and swaps it for a new access token.

- **GrowwConnectModal.js**: second field relabelled "API Secret" → "TOTP
  Seed (Base32)"; instructions rewritten around Groww's "Generate TOTP
  token" dialog (not "API Key & Secret"). Payload to
  `POST /api/groww/update-key` now sends `{apiKey, totp_seed}` instead
  of `{apiKey, secretKey}`. `EgressIpCallout` integration from the
  2026-04-20 approval-mode work preserved — IP whitelist gate still
  blocks submit until the customer claims + whitelists + acknowledges.
  Calls `saveBrokerSessionTime('Groww')` on success.
- **src/utils/growwRefresh.js** (new): `refreshGrowwSession` helper with
  `Alert.alert` confirm → POST `/api/groww/refresh-token` → error-code
  routing: `NO_TOTP_SEED` → re-open connect modal (legacy
  approval-mode user upgrading), `INVALID_SEED` → external
  `Linking.openURL('https://groww.in/trade-api/api-keys')` + re-open
  connect modal (revoked-key recovery), `RATE_LIMITED` → silent
  (backend's 30s cooldown is a correctness guardrail, not a UX signal).
- **TokenExpireBrokerModal.js**: Groww no longer in `OAUTH_BROKERS`
  (moved from the generic "Reconnect {broker}" path). Dedicated Groww
  branch renders "Refresh Groww session" button that calls the helper;
  fallback to `checkValidApiAnSecret('Groww')` on NO_TOTP_SEED /
  INVALID_SEED opens the connect modal for seed (re)capture.
- **docs/BROKER_CONNECTION.md**: Groww row updated (approval-mode
  → TOTP-seed). Added §"Groww (TOTP-seed, 2026-04-21)" with flow
  diagram, error-code table, and file list.

Cross-repo: rides on already-deployed Node (`c6cfd43`) + ccxt
(`3e63a32`) + web frontend (`9ed5c25`) commits. No backend changes
required on this commit — mobile app consumes existing endpoints.

**Release timing**: no CodePush/Expo OTA in this repo — ships on the
next Play/App Store build. A backend backward-compat bridge
(2026-04-21, separate `aq_backend_github` + `ccxt-india` commits) lets
legacy builds keep working during the store rollout window — see the
Follow-up section below. Remove the bridge after the new build is
broadly adopted.

### Follow-up — parallel surface parity + backward-compat bridge

After the initial port, two gaps surfaced:

1. **Parallel settings-page surface.** `BrokerSelectionScreen` →
   `BrokerCredentialScreen` (the 2026-04-20 web-parity settings flow)
   dispatched Groww via the generic `default:` branch to
   `/api/user/connect-broker` — which bypasses `/api/groww/update-key`
   entirely and trusts an upstream-validated `jwtToken`. Bypass would
   paper over credential errors at connect-time and fail at
   order-time. Fixed:
   - `src/config/brokerRegistry.js`: Groww fields switched from
     `secretKey` → `totp_seed` (`isSecret: true`), labels updated
     to "TOTP Seed (Base32)". Also fixed an upstream `name:` typo
     → `key:` so the data-driven form actually renders.
   - `src/utils/brokerAuth.js`: Groww `BROKER_OAUTH_CONFIG` entry
     renamed `requiresSecretKey` → `requiresTotpSeed`; added
     `refreshEndpoint: '/api/groww/refresh-token'`.
   - `src/components/BrokerConnectionModal/EgressIpCallout.js`:
     `BROKER_WHITELIST_HINT.groww` now says "Generate TOTP token"
     (was "Create API Key + Secret").
   - `src/screens/Broker/BrokerCredentialScreen.js`: NEW explicit
     `case 'groww':` that POSTs to `/api/groww/update-key` with
     `{apiKey, totp_seed}` — matches `GrowwConnectModal` shape.

2. **Backward-compat bridge (backend side, no RN change).** Stale
   mobile-app builds from before 2026-04-21 still POST
   `{apiKey, secretKey}`. The backend was updated
   (`aq_backend_github` `/api/groww/update-key` + ccxt
   `/groww/generate-token`) to temporarily accept either
   `totp_seed` or `secretKey`, with a matching
   `_mint_groww_approval_mode` fallback in ccxt. Legacy payloads do
   NOT persist a seed — those users stay on the daily re-paste flow
   until their app updates. Remove this bridge after the rollout is
   broadly adopted (monitor deprecation log → zero hits for ~30 days).

---

## [unreleased] - 2026-04-21

### Change — Market-hours gate restored behind `allowAfterHoursOrders` feature flag

**Why this matters:** the previous entry (below) fully removed the client-side
market-hours gate across every order-placement surface. That was too blunt:
most advisors still want the gate (brokers reject non-AMO orders after 15:30
and the failures look like broker bugs to end users), while a smaller set of
advisors genuinely want the 24×7 queue behavior. Rather than pick one default
for everyone, the gate is now conditional on an admin-controlled flag.

**Mechanism:** `ConfigContext` now reads an `allowAfterHoursOrders` boolean
from the advisor record served by `/api/app-advisor/get` (same
`featureFlags` object that already carries `modelPortfolioEnabled`,
`bespokePlansEnabled`, `brokerConnectEnabled`). Default is `true` — the
gate is bypassed and every placement surface remains enabled 24×7 unless an
admin explicitly sets the flag to `false` on an advisor's config record (in
which case the original 09:15–15:30 IST "Market is Closed" behavior returns
for that advisor).

**Surfaces wired to the flag (all use `IsMarketHours() || allowAfterHoursOrders`):**

1. `src/components/AdviceScreenComponents/RebalanceModal.js` — Step-3 "Place
   Order" button.
2. `src/components/ReviewTradeModal.js` — basket and single-stock review
   buttons.
3. `src/components/ReviewZerodhaTradeModal.js` — both slider variants.
4. `src/components/AdviceScreenComponents/StockAdvices.js` — `placeOrder`
   guard and orderscreen `handleCheckOrder` guard.
5. `src/components/AdviceScreenComponents/AddtoCartModal.js` — `handleTrade`
   guard.

**Not touched** (cleanup-only changes from the previous entry stay):
`UserStrategySubscribeModal.js`, `RebalanceCard.js`, `BasketTradeModal.js`.
Those had either dead declarations or no user-blocking gate to begin with.

**Files changed:**
- `src/context/ConfigContext.js` (added `allowAfterHoursOrders` to the
  feature-flags pass-through)
- `src/components/AdviceScreenComponents/RebalanceModal.js`
- `src/components/ReviewTradeModal.js`
- `src/components/ReviewZerodhaTradeModal.js`
- `src/components/AdviceScreenComponents/StockAdvices.js`
- `src/components/AdviceScreenComponents/AddtoCartModal.js`
- `docs/APP_ARCHITECTURE.md`

**Backend contract:** the admin-side advisor record may include
`featureFlags.allowAfterHoursOrders: boolean`. Missing/undefined → treated as
`true` (24×7 placement). A top-level `allowAfterHoursOrders` field on the
response is also honoured for backward compatibility. Advisors who want the
intraday-only gate restored must explicitly set the flag to `false`.

---

### Change — Remove client-side market-hours gate on order placement

**Why this matters:** advisors / power users wanted the ability to queue orders
outside market hours (09:15–15:30 IST). The app was blocking every
order-placement surface with a client-side `moment()` time check and a disabled
"Market is Closed" button — no API was consulted, no AMO variety was offered,
orders were simply refused even when brokers could have queued them.

**Behavior change:** every Place Order / Slide-to-Place-Order affordance is
now enabled 24×7. Whether the broker accepts the order is now entirely a
broker-side decision (error surfaced via the usual order-status poll). No AMO
payload switching was added — the order goes out with `variety: 'regular'`
and any broker-side rejection returns as a regular order failure.

**Surfaces unblocked:**

1. `src/components/AdviceScreenComponents/RebalanceModal.js` — Step-3 "Place
   Order" button (the one in the bug report screenshot).
2. `src/components/ReviewTradeModal.js` — both button variants (basket and
   single-stock review).
3. `src/components/ReviewZerodhaTradeModal.js` — both slider variants.
4. `src/components/AdviceScreenComponents/StockAdvices.js` — two `placeOrder`
   guards (early-return on `!isMarketHours`).
5. `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js` —
   `calculateRebalance` guard.
6. `src/components/AdviceScreenComponents/AddtoCartModal.js` — `handleTrade`
   guard.

**Code hygiene:** removed now-dead `IsMarketHours` imports and call sites from
all six files above plus `UIComponents/RebalanceAdvicesUI/RebalanceCard.js`
and `components/BasketTradeModal.js` (which had dead declarations even before
this change). Also removed `BasketTradeModal.js`'s `false ? 'Market is
Closed' : ...` hardcoded ternaries — the slider labels are now clean. The
util `src/utils/isMarketHours.js` itself is retained for potential future
informational use (e.g. an advisory banner that does not block action).

**Files changed:**
- `src/components/AdviceScreenComponents/RebalanceModal.js`
- `src/components/ReviewTradeModal.js`
- `src/components/ReviewZerodhaTradeModal.js`
- `src/components/AdviceScreenComponents/StockAdvices.js`
- `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js`
- `src/components/AdviceScreenComponents/AddtoCartModal.js`
- `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`
- `src/components/BasketTradeModal.js`
- `docs/APP_ARCHITECTURE.md` (rebalance-flow step removed; util entry annotated)

**Caveat to surface to users later if needed:** after-hours orders will be
rejected at the broker side for most Indian brokers unless the payload sets
AMO variety. If the user sees "broker rejected" after 15:30 IST, this is
expected with the current payload. Adding per-broker AMO variety support is
a follow-up (Option B in the investigation notes).

---

### Feature — Broker picker display config + hide Angel One

**What:** Extracted the hardcoded `brokersmain` array in `BrokerSelectionModal.js` into a new standalone config file `src/config/brokerDisplayConfig.js`. The modal now reads its grid of tiles from that config — changing which brokers appear in the picker, and in what order, is a one-line edit in the config.

**Why:** Business asked to remove Angel One from the broker picker without deleting any auth code (may be re-enabled later). An inline array in the modal made that a scattershot change; a single config makes it one commented-out entry.

**Changes:**

- **New file** `src/config/brokerDisplayConfig.js` — plain array of `{ name, key, logo }` in display order. Angel One entry is present but commented out.
- **`src/components/BrokerSelectionModal.js`** — `brokersmain` is now `brokerDisplayConfig` imported from the config file. Dropped the unused `url` field (the modal never read it — taps route through `openModal(broker.key)` into `ModalManager`). Removed the now-unused `configData` destructure from `useTrade()`.
- **Angel One auth plumbing untouched.** `AngleoneBookingModal`, `ModalManager`'s `'Angel One'` case, the `registerCallback('angelone', ...)` nonce branch in `handleBrokerSelect`, `brokerSupport`/`brokerAuth`/`ProcessTrades`/`fetchFunds`/backend — all still intact. Existing users with an Angel One connection continue to work; `ManageConnectionsModal` still shows their Angel One row with Re-auth/Switch/Remove. Only the "Connect new broker" picker hides the tile.

**To re-enable Angel One:** uncomment the first entry in `brokerDisplayConfig.js`. No other code changes needed.

### Fix — Order exchange routing (Kite Publisher silent-drop) + rebalance auto-trigger leak

**Why this matters:** a user's Zerodha basket rebalance silently dropped a BSE-only
symbol (ADARSHPL) because the app sent `exchange: "NSE"` to Kite Publisher. Kite
silently skipped the mismatched item — no order created, no error to the user —
and the post-flow status poll reported "Order rejected by broker (not found in
order book)", which sounded like a broker rejection but was actually a
pre-validation silent drop.

**Two classes of bug fixed:**

1. **Silent exchange default** — mobile order/basket builders fell back to
   `'NSE'` if `stock.exchange` was blank. That silently mis-routes BSE-only
   symbols. Removed every `|| 'NSE'` fallback in order-placement paths and
   added a single validation helper `validateStockExchanges()` in
   `src/utils/brokerPublisher.js` that every order entry now gates on. If any
   stock in the basket is missing exchange, the whole basket is rejected with
   a user-facing list of the offending symbols — no order ever leaves the
   device in a mis-routable state.

2. **Exchange lost in backend round-trip** — the backend
   `/api/zerodha/publisher/record-orders` and `/api/fyers/publisher/record-orders`
   endpoints didn't include the `exchange` field in their response payloads.
   Mobile stored those empty `exchange` values in `user_net_pf_model.order_results`,
   so the next Repair Trades flow read back blank — which then triggered bug #1.
   The backend now preserves `exchange` in every branch (matched / publisher-
   reported-success-but-missing / unmatched / error-fallback). A one-time Mongo
   backfill repopulated 211 stale records in `model_portfolio_user.advice_executed`
   from the advice source of truth (`model_portfolio.model.rebalanceHistory.adviceEntries`).

**Also fixed — rebalance auto-trigger on unrelated broker connect:**

`RebalanceAdvices.js` had a reactive `useEffect` that, when `storeModalName`
was set and the global broker modal closed with `brokerStatus==='connected'`,
automatically fetched holdings and opened the model-portfolio rebalance flow.
`storeModalName` was never cleared, so a stale value from a previous MP tap
caused "connect a broker from Settings" to unexpectedly open a rebalance for
that MP. Changed the intent tracker from a sticky boolean ref to a timestamp
ref with a 2-minute TTL — legitimate auto-continue still works; stale intent
can't fire.

**Also updated — more informative Zerodha "not in order book" message:**
Replaced `"Order rejected by broker (not found in order book). Please check
your Kite app for details."` with `"Order not accepted by Zerodha (no record
in order book). Likely causes: invalid symbol/exchange combination, restricted
stock (GSM/T2T), or pre-acceptance rejection. Please verify in your Kite app."`

**Files — mobile:**
- `src/utils/brokerPublisher.js` — new `validateStockExchanges()` helper; removed silent NSE default in `convertToBasketItem()` for both Zerodha and Fyers
- `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` — gate in `handleZerodhaRedirect` + `handleFyersRedirect`; removed inline NSE default in Zerodha basket builder
- `src/components/ReviewZerodhaTradeModal.js` — gate in `handleZerodhaRedirect`; removed NSE default
- `src/components/AdviceScreenComponents/StockAdvices.js` — gate + removed NSE default
- `src/components/AdviceScreenComponents/RebalanceModal.js` — gate + removed NSE default
- `src/components/AdviceScreenComponents/AddtoCartModal.js` — gate + removed NSE default
- `src/screens/Drawer/IgnoreTradesScreen.js` — gate + removed NSE default
- `src/components/AdviceScreenComponents/RebalanceAdvices.js` — rebalance auto-trigger timestamp TTL

**Files — backend (`aq_backend_github`):**
- `Routes/Broker/zerodha.js` — preserve `exchange` in all 4 `orderResult`/response branches of `/publisher/record-orders`; update "not in order book" message
- `Routes/Broker/Fyers.js` — preserve `exchange` in all 3 response branches of `/publisher/record-orders`

**Data — one-time Mongo backfill (production `prod` DB):**
211 records in `model_portfolio_user.advice_executed[*].order_results[*]` had
blank `exchange`; backfilled from the symbol→exchange map derived from all
`model_portfolio.model.rebalanceHistory[*].adviceEntries`. One `tcs` test
record intentionally left alone (not in advice).

---

## [earlier-2026-04-21] - 2026-04-21

### Fix — ICICI Direct and Upstox broker connection on mobile

**Root causes fixed:**

**ICICI Direct:**
1. `ccxt-india/apps/app_icici.py` — `/icici/auth-callback/<subdomain>` and `/icici/auth-callback/website/<site>` only accepted `POST`, but ICICI redirects the browser via GET. Changed to `['GET', 'POST']`.
2. `icicimodal.js` — The WebView handler was designed around a false assumption that CCXT does the `apisession → session_token` exchange server-side before redirecting. CCXT is actually a pass-through relay to the web frontend URL. The mobile never detected the final redirect (wrong URL pattern) and the legacy-detection code fired instead. Replaced the handler with the same client-side exchange that the web app uses: detect `apisession=` in any WebView URL → POST to `icici/customer-details` → PUT to `api/user/connect-broker`.

**Upstox:**
1. `upstoxModal.js` — `hasConnectedUpstox.current` was set but never checked in `connectUpstox`, so double API calls could occur when `userDetails` changed after `upstoxCode` was set. Fixed to mirror web app (guard before starting the request, not after).
2. `upstoxModal.js` — Silent failure when `gen-access-token` returned HTTP 200 with an error body (no `access_token`). Added explicit check and user-facing error message.
3. `UpstoxHelpContent.js` — Help text always showed `.env`'s redirect URL, not the config-resolved URL that the modal actually uses. Fixed to accept `brokerConnectRedirectURL` as a prop.

**White-labeling note:** Each advisor registers their own ICICI API app with callback URL `https://ccxtprod.alphaquark.in/icici/auth-callback/{subdomain}`. Upstox redirect URI must match what's registered in the advisor's Upstox developer portal — the app uses `REACT_APP_BROKER_CONNECT_REDIRECT_URL` from the advisor config API (falls back to `.env`).

**Files:**
- `ccxt-india/apps/app_icici.py` (GET method on auth-callback routes)
- `src/components/BrokerConnectionModal/icicimodal.js` (WebView handler rewrite)
- `src/components/BrokerConnectionModal/upstoxModal.js` (guard + error handling)
- `src/UIComponents/BrokerConnectionUI/UpstoxConnectUI.js` (prop passthrough)
- `src/UIComponents/BrokerConnectionUI/HelpUI/UpstoxHelpContent.js` (accept redirect URL prop)

---

## [3.10.0-color-tokens] - 2026-04-21

### Feat — Semantic color token system + `colorTokens` slot in advisor config

**Scope**: Infrastructure only — zero visual change. Components keep their existing hardcoded colors and keep rendering identically. This change lays the foundation for advisor-configurable theming and the upcoming migration of ~4,618 hardcoded hex values across 224 files.

**What shipped:**

1. `src/theme/colors.js` (new) — canonical `DEFAULT_TOKENS` tree grouped into `brand`, `text`, `surface`, `border`, `status`, `pnl`, `nav`, `basket`, `chart.series[]`, `emptyState`, `overlay`, `shadow`. Exposes `buildColors(config)` that resolves defaults ← legacy branding fields (`mainColor`, `themeColor`, `gradient1/2`, `basket1`, `bottomTabbg`, `tabIconColor`, `selectedTabcolor`, `basketcolor`, `basketsymbolbg`, `EmptyStateUi`) ← `colorTokens` advisor overrides.
2. `src/theme/useColors.js` (new) — memoized hook `useColors()` for component consumption.
3. `src/context/ConfigContext.js` — reads new `apiData.colorTokens` field from `/api/app-advisor/get` and surfaces it in the React context. Existing fields untouched.
4. Backend `aq_backend_github/Models/appAdvisorModel.js` — added `colorTokens: { type: Schema.Types.Mixed, default: {} }`. `Mixed` chosen so the mobile app owns the token shape without requiring schema migrations.
5. Backend `aq_backend_github/Routes/AppAdvisor/AppAdvisorRouter.js` — `PUT /update-theme` now destructures and writes `colorTokens`. `GET /get` returns it automatically via `.lean()`.
6. Support UI `supportAQ/src/components/AppAdvisorConfig.jsx` — new **Semantic Color Tokens** section under Theme Configuration, with grouped color pickers for `text`, `surface`, `border`, `status`, `pnl`, plus a raw-JSON escape hatch for advanced fields (`chart.series[]`, `overlay`, `shadow`, `emptyState`).
7. Docs: `docs/COLOR_TOKENS.md` (full catalog + override shape) and `docs/COLOR_SYSTEM.md` (data flow, where to change colors, FAQ).

**API verified**: `GET https://server.alphaquark.in/api/app-advisor/get?appSubdomain=rgxresearch` returns the advisor config with all existing branding fields (themeColor, mainColor, gradient1/2, basket1/2, etc.) plus the new `colorTokens` slot (empty `{}` for existing advisors — they keep rendering with defaults + legacy branding).

**Security note**: The `/get` endpoint currently returns `fcmServiceAccount.private_key` and decrypted broker API keys in the response body. This is pre-existing behavior and unrelated to this change, but worth flagging — any color edit in support also hands out the Firebase service account private key to whoever can call the endpoint with a valid `aq-encrypted-key`.

**Files**:
- `src/theme/colors.js` (new)
- `src/theme/useColors.js` (new)
- `src/context/ConfigContext.js` (added `colorTokens` passthrough)
- `docs/COLOR_TOKENS.md` (new)
- `docs/COLOR_SYSTEM.md` (new)
- `docs/APP_ARCHITECTURE.md` (cross-reference to theme module)
- `aq_backend_github/Models/appAdvisorModel.js` (schema field)
- `aq_backend_github/Routes/AppAdvisor/AppAdvisorRouter.js` (update-theme route)
- `supportAQ/src/components/AppAdvisorConfig.jsx` (UI section + form plumbing)

**Next**: component migration (waves A–F in `docs/COLOR_SYSTEM.md` §4) replaces hardcoded hex literals with `useColors()` reads. This commit is a safe land — nothing in existing component code paths has changed.

---

## [3.9.1] - 2026-04-21

### Fix — JWT expiry bumped 15s → 300s so clock-drifted devices can auth

**Symptom**: Login returned `401 "Token has expired"` (server response body: `{"success":false,"message":"Token has expired","triedConfigurations":["altqube","default","common"]}`). Observed on Android emulator where the device clock had drifted ~33 seconds behind real UTC. Every request signed with `aq-encrypted-key` — `/api/user/getUser/*`, `POST /api/user/`, `/api/gst/config`, etc. — 401'd identically. Error surfaced to users as "Something went wrong. Please try again." (email/password path) or "Authentication failed. Please try again." (Google path).

**Root cause**: `src/utils/SecurityTokenManager.js` `generateServiceToken()` minted JWTs with a **15-second expiry window** (`exp = iat + 15`). The server compares `exp` against its own clock (which is NTP-synced in prod). Any client with clock drift > 15 sec — trivially easy on emulators, also happens on real phones with stale time — ships tokens whose `exp` is already in the past when they land at the server, so the server answers 401.

**Subtlety: IST offset is NOT the bug.** Both app and server add +5h30m to UTC epoch before comparing `iat`/`exp`. Verified by curl: a token with UTC-only timestamps returns `401 "Token has expired"` from `server.alphaquark.in`; a token with the same IST offset returns `200`. The offset is self-consistent across the two sides; only the window size was wrong.

**Fix**: `src/utils/SecurityTokenManager.js:57-60` — changed `1000 * 15` to `1000 * 300`. 5 minutes covers typical NTP drift (seconds to low-minutes) and all emulator skew seen in practice, while still being short enough to limit replay-attack exposure. No server change needed — server already tolerates varied `exp` claims as long as `exp > now`.

**Why 15s slipped through**: works perfectly on NTP-synced dev machines (macOS auto-syncs), works perfectly on freshly-booted physical devices, works perfectly for localhost testing. Only fails on stale clocks — emulators that have been suspended/resumed, phones with manual time, airplane-mode devices recovering connectivity.

**How to reproduce in future**: `adb shell "date"` vs host `date -u`. Any difference >15 sec and the old 15-sec window would break. The 300-sec window tolerates ~4 min of drift before re-breaking.

**Files**: `src/utils/SecurityTokenManager.js` only.

---

## [3.9.0-color-restore] - 2026-04-21

### Fix — Restore AlphaQuark palette (reverts collateral damage from "sync with rgx app")

**Symptom**: Login/splash/signup/reset screens showed Zamzam purple gradient + "Z" logo instead of the AlphaQuark navy gradient + alpha-symbol logo. Only the `alphaquark` build variant was affected.

**Culprit**: commit `36514de` ("sync with rgx app", 2026-03-31) bulk-copied Config.js and 5 screen files from the RGX fork. Three regressions in one commit:
1. Collapsed `APP_VARIANTS.alphaquark` (and 4 other variants) into a single shared `zamzamConfig` block — alphaquark lost its teal `mainColor: '#4CAAA0'`, `layout2`, and `paymentModal` block.
2. Redirected six logo import/require paths from `../assets/logo.png` (AlphaQuark alpha-symbol) to `../assets/AppLogo/logo.png` (Zamzam "Z"). Variable names (`AlphaQuarkLogo`) were preserved, so the regression was invisible in review.
3. `LoginScreen.js` rewritten to read `gradient1`/`gradient2` from config with blue fallbacks — because shared config fed it `gradient2: '#773D9A'`, login screen rendered purple.

A later commit (`3223331`) renamed `zamzamConfig` → `sharedUIConfig` but did not restore per-variant palettes.

**Fix**: 6 files.
1. `src/utils/Config.js` — added `import AlphaQuarkLogo from '../assets/logo.png'`; replaced `alphaquark: {...sharedUIConfig, subdomain: 'prod', advisorRaCode: 'ALPHAQUARK'}` with the full explicit pre-sync palette block (teal `#4CAAA0`, layout2, paymentModal `#0056B7`/`#29A400`, `basket1/2` red tones, AlphaQuarkLogo). Other variants still spread `sharedUIConfig` unchanged.
2. `src/components/SplashScreen.js:5` — `require('../assets/AppLogo/logo.png')` → `require('../assets/logo.png')`.
3. `src/screens/Authentication/LoginScreen.js:49` — same path revert. Lines 56-58 (config-driven gradient1/gradient2 variables) removed; `LinearGradient` colors prop hard-coded back to `['rgba(0, 38, 81, 1)', 'rgba(0, 86, 183, 1)']` (pre-sync state).
4. `src/screens/Authentication/SignupScreen.js:49` — same path revert.
5. `src/screens/Authentication/ResetPassword.js:24` — same path revert.
6. `src/components/HomeScreenComponents/PlanCard.js:74` — same inline `require` path revert.

**Not done**: no `git revert 36514de` — that commit also carried legitimate sync work (broker, WebSocket, MP Performance). File-scoped restore preserves all of those.

**Verified**: login screen now renders navy gradient + AlphaQuark alpha-symbol + green Log In button on `emulator-5554` (release APK, clean build).

---

## [3.9.0] - 2026-04-21

### Feat — Session-expired detection util + top-card state + cross-repo 5 AM IST cron

Three fixes that together make the "is this broker usable right now?" signal actually accurate end-to-end, not just on the row badge:

1. **`src/utils/brokerStateUtils.js` (new)** — `isBrokerSessionExpired(entry)` checks BOTH `entry.status` ∈ {`'expired'`, `'error'`} AND `entry.token_expire` in the past. `getPrimaryBrokerEntry(userDetails)` looks up the primary broker's entry. `ManageConnectionsModal.fetchConnections` now uses this instead of the status-only check so expiry derived from `token_expire` is caught.

2. **`SubscriptionScreen.js` top card** — now renders three states instead of two: Connected (green, session live) / **Session Expired (amber, new state with "Re-auth" button)** / Disconnected (red, no primary). Previously the card blindly said "Connected" whenever the top-level `connect_broker_status` was truthy, even if the primary broker's session was dead. Also hides the Disconnect button when the primary is expired (nothing to disconnect). Verified on emulator: after tapping Reconnect on Dhan and backing out of the OAuth WebView, the card correctly flips to "Dhan Session Expired" with a Re-auth button.

3. **`aq_backend_github/CronJob/CronBrokerDailyResetExpiry.js` (new, cross-repo)** — the client util alone can't detect expiry for brokers whose backend `status` field stays `'connected'` across the broker-side daily reset (ICICI is the canonical offender). Added a backend cron that runs **daily at 5 AM IST** (`0 5 * * *` with `timezone: "Asia/Kolkata"`), iterates every advisor database, and unconditionally flips every `status: 'connected'` entry to `status: 'expired'` with `last_error: 'Daily 5 AM IST reset'`. Mirrors the legacy top-level `connect_broker_status` when the primary is flipped. Wired into `CronJob/index.js` as slot [4/8], complementing the existing `brokerTokenRefresh.js` (which only catches `token_expire`-based expiry). Documented in `aq_backend_github/docs/BACKEND_API_ARCHITECTURE.md` §10.1.

**Gate fix** (earlier in this session): `SubscriptionScreen.js` — Manage Connections button is now visible whenever `userDetails.connected_brokers[].length > 0`, not only when `brokerStatus !== 'Disconnected'`. Users with saved broker credentials but no active primary can now reach Manage Connections to re-auth.

**Deployment note**: The cron side requires `ssh tidi` → pull on the backend server → `sudo systemctl restart aq-cron-jobs.service` (see `CronJob/aq-cron-jobs.service`).

---

## [3.9.0-phase12] - 2026-04-21

### Feat — Web-parity Settings broker UX (Phase 1 + 2)

Ports the `/subscriptions` page's two headline UX wins from web (`prod-alphaquark-github/src/Home/Subscriptions/subscription.js`) into the mobile `ManageConnectionsModal`:

**Phase 1 — "+ Connect new broker" CTA inside Manage Connections** (`src/screens/Home/ManageConnectionsModal.js` + `src/screens/Home/SubscriptionScreen.js`). Previously the mobile "Connect Broker" button only rendered when zero brokers were connected, so adding a 2nd/3rd broker required closing Settings and finding another entry point. Manage Connections now includes a dashed-outline button above the list that fires a new `onAddBroker` prop; `SubscriptionScreen` wires it to close Manage Connections and open `BrokerSelectionModal`.

**Phase 2 — Smart credential re-auth routing** (new `src/utils/reauthHelpers.js` + `src/utils/brokerCredentials.js`, plumbed through `modalStore.openModal(name, payload)` → `ModalManager` → per-broker modals). For Upstox / ICICI Direct / HDFC Securities / Motilal Oswal / Fyers, clicking Reconnect now:

1. Calls `PUT /api/user/brokers/{broker}/primary` to flip primary up-front (matches web `subscription.js:161` intent-to-primary).
2. Calls `GET /api/user/brokers/{broker}/reauth-url`, which uses saved credentials on the backend to build the broker's OAuth URL.
3. Decrypts the stored `apiKey` / `secretKey` / `clientCode` client-side from `userDetails.connected_brokers[]` (CryptoJS AES with `'ApiKeySecret'` passphrase — same scheme used by every credential modal already).
4. Dispatches `openModal(key, { reauthConfig: { authUrl, apiKey, secretKey, clientCode } })`. Each of the 5 credential modals gains a `reauthConfig` prop + hydration `useEffect` that pre-fills state and jumps straight to `showWebView=true` — the credential-form step is skipped entirely.

Result: session-expired re-auth for the 5 credential brokers no longer requires re-entering API keys, matching the web experience. Kotak (TOTP) and Groww (fresh creds) are unaffected — backend returns `requiresTotp` / `requiresForm` and the code falls back to opening the full modal. Partner-OAuth brokers (Zerodha / Angel One / Dhan / AliceBlue / Axis) are also unaffected — they never had a credential form to skip.

**Fyers naming quirk**: Fyers' modal state uses `apiKey` for the OAuth secret and `secretKey` for the clientId, opposite of DB storage (`credentials.secretKey` = secret, `credentials.clientCode` = clientId). The hydration `useEffect` in `FyersConnect.js` does the swap; the `reauthConfig` payload itself uses DB field names to stay uniform.

**Out of scope (Phase 3 + 4, next PR)**: Primary-broker star badge, token-expiry date display, tri-state status (Connected/Expired/Saved) sort, promoting the Settings surface. Documented in `BROKER_CONNECTION.md` `## Smart re-auth routing (2026-04-21)`.

Files changed:
- `src/screens/Home/ManageConnectionsModal.js` — `onAddBroker` prop + CTA button, rewritten `handleReconnect` with smart routing + per-broker `reauthing` loading state.
- `src/screens/Home/SubscriptionScreen.js` — wires `onAddBroker` to `setModalVisible(true)`.
- `src/utils/reauthHelpers.js` — new (`handleSmartReauth`, `flipPrimaryBroker`, `CREDENTIAL_REAUTH_BROKERS`).
- `src/utils/brokerCredentials.js` — new (`getStoredBrokerCreds`).
- `src/GlobalUIModals/modalStore.js` — `modalPayload` state + `openModal(name, payload)`.
- `src/GlobalUIModals/ModalManager.js` — forwards `modalPayload.reauthConfig` to modals.
- `src/components/BrokerConnectionModal/upstoxModal.js` — `reauthConfig` prop + hydration `useEffect`.
- `src/components/BrokerConnectionModal/icicimodal.js` — ditto.
- `src/components/BrokerConnectionModal/HDFCconnectModal.js` — ditto.
- `src/components/BrokerConnectionModal/MotilalModal.js` — ditto.
- `src/components/BrokerConnectionModal/FyersConnect.js` — ditto (with the Fyers naming swap).
- `docs/BROKER_CONNECTION.md` — new `## Smart re-auth routing (2026-04-21)` section + updated Manage Connections bullets.

---

## [3.8.9] - 2026-04-20

### Docs — APP_ARCHITECTURE + REBALANCING backfill for B1/B2/DDPI commits

Backfill doc update for three earlier commits that landed their code + BROKER_CONNECTION.md + CHANGELOG.md entries but missed their secondary architecture docs. The app's `CLAUDE.md` overlap rule requires that a change to `StockAdvices.js` (listed in APP_ARCHITECTURE.md) update APP_ARCHITECTURE.md too, and DDPI changes invoked from the rebalance flow (`OtherBrokerModel.handleAcceptRebalance`, `AngleOneTpinModal` in rebalance-SELL path) warrant a REBALANCING.md entry.

**APP_ARCHITECTURE.md** — added two new subsections:

- *Trade/basket payload `user_email` contract (2026-04-20)* — documents the hard contract with the ccxt-india egress request hook: every `api/process-trades/order-place` payload must carry top-level `user_email` or whitelist-enforcing brokers reject the order. Lists all 7 app trade-flow callsites (the 3 patched in B1 `b36d981`, plus the 4 pre-existing). Covers the dual-key contract (snake_case `user_email` for new code, camelCase `userEmail` still accepted for 5 legacy `verify-edis` sites).
- *DDPI authorize-for-sell race (2026-04-20)* — documents the 6-callsite `await getUserDetails()` fix from `a6bbeae`, cross-references TradeContext's async `getUserDeatils` that returns the axios promise so the `await` takes effect.

**REBALANCING.md** — added two new subsections:

- *DDPI authorize-for-sell — `await getUserDetails` before reopening rebalance modal* — explains why the DDPI fix matters specifically for the rebalance flow: `OtherBrokerModel.handleAcceptRebalance` (line ~1966) and `AngleOneTpinModal` (line ~1115) are invoked from the rebalance SELL-side precheck, and the stale-userDetails race would re-trigger DDPI right after the user ticked authorize-for-sell. Same 6-callsite table as APP_ARCHITECTURE.md with rebalance context.
- *Rebalance-flow broker-auth error detection — expanded keyword set* — documents `isBrokerAuthError` keyword expansion from vansh's `3d77710` merge, specifically flagging Groww's `"Please Login and Try Again (Error: 401)"` pattern that previously caused dead-end "Unable to Rebalance" dialogs instead of the reconnect modal.

**Net code change: zero.** Pure doc backfill. Cites the original commit hashes (`b36d981` B1, `837975c` B2, `a6bbeae` DDPI, `3d77710` vansh merge) for traceability per the CLAUDE.md post-commit recovery guidance.

No CHANGELOG entry in BROKER_CONNECTION.md this time — it's already fully up to date from the earlier commits.

---

## [3.8.8] - 2026-04-20

### Docs — EgressIpCallout parity audit (Group D, no code change)

Ports web `b25d105` (UI polish + visible error state + steps preamble), `0f1f3bf` (no-opt-out hard-gate), and `fca0620`'s red-flash half (the HDFC/ICICI/Upstox step-text half was ported in Group C3/C4/C5).

**Net code change: zero.** The app's `src/components/BrokerConnectionModal/EgressIpCallout.js` (706 lines) already implements every feature covered by these three web commits — they were ported piecewise during the earlier broker wire-up commits (`321fb92` wired Upstox/Fyers/Motilal/HDFC/ICICI + `99a0c69` wired Kotak). Groww was added in `7fa7e10` (Group G).

Audited the app file line-by-line against web's final state:

- `showUnmetAck` → `flashAck` red pulse (`Animated.sequence`, lines 216–248) ✅
- Red-ring + `⚠ Please tick this box...` warning when flashing (lines 441–472) ✅
- Hard-gate: `onAcknowledgeChange(false)` for `unclaimed`, `ipv4_provisioning`, `loading`, `error`, `claiming`, and `claimed` pre-acknowledgment (line 213) ✅
- Visible error state + Retry button (lines 308–326) ✅
- Steps preamble + a/b/c numbered steps in `claimed` state using `brokerDevPortal` + `brokerHint` maps (lines 408–439) ✅
- Partner broker short-circuit with `onAcknowledgeChange(true)` (lines 205–207) ✅
- `ipv4_provisioning` amber hard-block panel with SEBI rationale, no opt-out (lines 328–353) ✅
- Migration banner (lines 276–290) ✅

Wire-up count: 7 app screens now render `EgressIpCallout` (Upstox, Fyers, HDFC, ICICI, Kotak, Groww, BrokerCredentialScreen/Fyers branch). Motilal intentionally doesn't — swapped in Group C2 for the shared-server-IPv4 static callout.

The 230-line delta between app (706) and web (936) is cosmetic (Tailwind classes vs inline `StyleSheet`). No behavioural divergence.

See `docs/BROKER_CONNECTION.md` → *EgressIpCallout polish — parity audit* for the full per-feature table.

---

## [3.8.7] - 2026-04-20

### Changed — Per-broker polish [Group C]

Five focused per-broker fixes bundled (each ports a discrete web commit).

**C1 — Kotak mobile pre-fill on reconnect** (web `933e9a4`): `src/components/BrokerConnectionModal/KotakModal.js` — on mount/when `userDetails` arrives, read `connected_brokers[broker=Kotak].mobileNumber` (primary) with fallback to legacy top-level `phone_number`, strip the `+91` prefix, and pre-fill the 10-digit input so returning users don't have to retype it every reconnect. Only fires when the form field is empty, so in-progress edits aren't overwritten.

**C2 — Motilal server-IPv4 static callout** (web `156589e`): `src/UIComponents/BrokerConnectionUI/MotilalConnectUI.js` — Motilal is IPv4-only; all calls route through the server's shared static IPv4 (`72.61.251.253`) via an IPv4-pinned session on ccxt-india. Replaced the broker's `<EgressIpCallout broker="motilaloswal" ...>` render with an inline static callout (IP + Copy + acknowledgment checkbox + red-flash on unmet ack). Dropped the `EgressIpCallout` import from MotilalConnectUI. Copy button uses the app-wide global-`Clipboard` pattern (same as `HelpModal.js`, `KotakConsumerKeySteps.js`, `DdpiModal.js`) with a try/catch fallback toast for platforms that don't expose a shim.

**C3 — Upstox Help Content step 3 "Allowed IPs" mention** (web `608c9d4`): `src/UIComponents/BrokerConnectionUI/HelpUI/UpstoxHelpContent.js` — prepended a sentence to step 3 telling the user to paste the dedicated static IP (from the in-form whitelist panel) into Upstox's "Allowed IPs" field, with `UDAPI1154 "static IP mismatch"` as the rejection rationale. The IP guidance now comes before the Redirect URL text so it's less likely to be missed on Upstox's "Create App" form.

**C4 — HDFC Help Content step 4 "Allowed IPs" mention**: `src/UIComponents/BrokerConnectionUI/HelpUI/HDFCHelpContent.js` — step 4 now instructs the user to paste the dedicated static IP into InvestRight's "Allowed IPs" field alongside setting the redirect URL. Same structural change as Upstox C3.

**C5 — ICICI Help Content step 2 "IP Whitelist" mention**: `src/UIComponents/BrokerConnectionUI/HelpUI/ICICIHelpContent.js` — step 2 now instructs the user to paste the dedicated static IP into Breeze's "IP Whitelist" field alongside the Redirect URL. Same structural change as Upstox C3 and HDFC C4.

See `docs/BROKER_CONNECTION.md` → *Per-broker polish (Group C)* for per-file rationale.

---

## [3.8.6] - 2026-04-20

### Fixed — DDPI authorize-for-sell race (await getUserDetails before reopening)

Ports web `e73bd81` Issue 3. Fixes the sporadic "authorize-for-sell checkbox isn't sticking" UX — user ticks Authorize for Sell in DDPI, modal closes, rebalance/review modal reopens and immediately re-fires DDPI as if the tick never happened.

**Root cause:** `DdpiModal.handleProceed` writes `PUT /api/update-edis-status` (server-side flip of `is_authorized_for_sell: true`) then calls `setIsOpen(false)` + `reopenRebalanceModal()`. `getUserDetails()` was **fire-and-forget** — the reopened modal read stale userDetails (`is_authorized_for_sell=false`) and re-triggered DDPI.

**Fix:** Added `await` to all 6 `handleProceed`-style callers in `src/components/DdpiModal.js`:

- `handleProceed` (main `DdpiModal` default export, line ~133)
- `AngleOneTpinModal.handleProceed` (line ~1115)
- `DhanTpinModal.handleProceed` (line ~1339)
- `OtherBrokerModel.handleContinue` (add-to-cart flow, line ~1902)
- `OtherBrokerModel.handleAcceptRebalance` (rebalance flow, line ~1966)
- `FyersTpinModal.handleProceed` (line ~2540)

All 6 containing functions were already `async`, so no function-signature changes were needed. `TradeContext.getUserDeatils` (the central source) is already `async` with `await axios.get(...)`, so it implicitly returns a Promise — `await` at the DdpiModal call site now properly waits. For unported parent pages whose `getUserDetails` doesn't yet return a promise, `await` on a sync function is a no-op — the fix degrades gracefully.

**Backend counterpart** (per web commit message, tracked server-side): `aq_backend_github/.../UpdateEdisStatus.js` returns `{new:true}` and only `$sets` the fields the client sent, so partial payloads stop clobbering sibling flags.

See `docs/BROKER_CONNECTION.md` → *DDPI authorize-for-sell* for the full rationale.

---

## [3.8.5] - 2026-04-20

### Docs — `angelone/verify-edis` dual-key contract (B3, no code change)

Ports web `e8b83eb` as a **doc-only port**. Web's commit added `user_email: userDetails?.email` to its own `DdpiModal.js` `AngleOneTpinModal` verify-edis call (a real miss on web that dropped `cid` resolution to `None`) AND locked in the **dual-key contract** — the ccxt-india egress hook accepts both `user_email` (snake_case) and `userEmail` (camelCase) so legacy callsites that have been sending camelCase for years keep working without a rewrite.

Audited all 5 app `angelone/verify-edis` callsites — **all 5 already send camelCase `userEmail`**:

- `src/components/DdpiModal.js:~1029` — AngleOneTpinModal auto-fetch EDIS status
- `src/components/AdviceScreenComponents/StockAdvices.js:~145` — bespoke flow
- `src/components/AdviceScreenComponents/AddtoCartModal.js:~272` — Add-to-Cart flow
- `src/components/AdviceScreenComponents/RebalanceAdviceContent.js:~307` — rebalance flow
- `src/screens/Drawer/MPPerformanceScreen.js:~577` — MP performance screen

All resolve `cid` correctly on the server per the dual-key contract and bind the right per-customer IPv6 for the Angel One verify-edis call. No payload change required — rewriting five well-tested snake_case-equivalent payloads for no behavioral gain would be churn.

**Contract boundary going forward:** legacy callsites keep camelCase `userEmail`; new callsites added from 2026-04-15 onward (B1 trade/basket payloads, B2 finish-connection endpoints, G Groww submit) use snake_case `user_email` — the new canonical.

**Note on payload shape vs web:** the app's AngleOneTpinModal verify-edis payload omits `clientCode` because the Angel One app API key on mobile is advisor-level (`configData.config.REACT_APP_ANGEL_ONE_API_KEY`), not per-user encrypted. Both shapes resolve the same server-side.

See `docs/BROKER_CONNECTION.md` → *angelone/verify-edis — camelCase/snake_case dual-key contract* for the full contract.

---

## [3.8.4] - 2026-04-20

### Changed — Groww migrated from partner OAuth to API-Key + API-Secret + IP whitelist

Ports web `9ee7aed` + `1b090e3` + the Groww-relevant parts of `e73bd81`. Groww deprecated partner-API order placement in 2026-04 — the only supported path is now user-created approval-mode keys at [`groww.in/trade-api/api-keys`](https://groww.in/trade-api/api-keys), with a per-customer Route64 IPv6 whitelisted against those keys. Web's intermediate `635b6ef` live-TOTP form was reverted same-day (Groww's dashboard actually exposes two opaque strings, not a TOTP QR, for approval-mode keys); the app ports directly to the end state without the intermediate commit.

**`src/components/BrokerConnectionModal/GrowwConnectModal.js` — full rewrite.** Dropped the InAppBrowser OAuth flow (`InAppBrowser.openAuth` + Linking deep-link race + `handleGrowwCallbackUrl`). New flow: `EgressIpCallout` at top (gates submit via `egressReady` + `unmetAck` — same pattern as Upstox/Fyers/Motilal/HDFC/ICICI/Kotak), 4-step scrollable instructions, two `TextInput`s for API Key + API Secret. `handleSubmit` AES-encrypts both with `'ApiKeySecret'` (symmetric with every other credential broker — backend `checkValidApiAnSecret()` decrypts) and POSTs `{uid, user_email, user_broker: 'Groww', apiKey, secretKey}` to `${server}api/groww/update-key`. Amber note in Step 2 explains Groww's **daily approval requirement** — access tokens reset at 6 AM IST, users must re-approve each morning.

**`src/components/BrokerConnectionModal/EgressIpCallout.js`** — added `'groww'` to `WHITELIST_BROKERS` plus entries in `BROKER_DISPLAY_NAMES` ("Groww"), `BROKER_DEV_PORTAL_URLS` (`groww.in/trade-api/api-keys`), and `BROKER_WHITELIST_HINT` ("Trade API → Create API Key + Secret → Whitelisted IPs").

**`src/components/TokenExpireBrokerModal.js`** — removed `'Groww'` from `OAUTH_BROKERS` AND added a `handleGrowwReconnect` handler + dedicated `broker === 'Groww'` reconnect button that dispatches `useModalStore.getState().openModal('Groww')` — the RN equivalent of web `e73bd81`'s `aq:open-broker-connect` DOM event pattern. Without this, Groww users with expired sessions would see the modal render neither the OAuth button nor a credential form and get stuck.

**`src/config/brokerRegistry.js`** — Groww `authType: OAUTH → CREDENTIAL`. Added `fields: [{apiKey}, {secretKey}]` for any generic registry-driven renderer.

**`src/utils/brokerAuth.js`** — Groww config `authType: 'oauth_pkce' → 'credential'`. Dropped `loginUrlEndpoint` / `callbackEndpoint` / `maxConnections` (OAuth-specific). Added `requiresApiKey`, `requiresSecretKey`, `tokenGenEndpoint: '/api/groww/update-key'`, `tokenExpiry: 'daily_6am_ist'`.

**Existing Groww users on partner OAuth tokens** keep working until their tokens expire (~24h), then flow through the new credential form on reconnect. No proactive migration UI — same approach as the web-side rollout. Deploy ordering: ccxt-india first (makes `/groww/generate-token` available), then `aq_backend_github` (new `/api/groww/update-key` + daily refresh cron), then this app build.

**Known follow-ups (deferred):** `SubscriptionScreen.js:77-97` still calls `${ccxtServer}groww/revoke` on disconnect — after migration that endpoint may not exist server-side; the call is already wrapped in try/catch so it's non-fatal, but should be dropped in a cleanup pass. `src/UIComponents/BrokerConnectionUI/GrowwConnectUI.js` + `GrowwConnectUI1.js` are vestigial (not imported anywhere) and should be deleted. Web `e73bd81` also fixed a DDPI / authorize-for-sell race (unrelated to Groww) — tracked as separate task.

**Vansh's `3d77710`** already added Groww to `ManageConnectionsModal.BROKER_MODAL_KEY_MAP` (`'Groww' → 'Groww'`), so the per-row Reconnect button on expired Groww sessions dispatches to `openModal('Groww')` → renders the new credential form. No additional changes needed in ManageConnectionsModal.

See `docs/BROKER_CONNECTION.md` → *Groww migration* for the full rationale.

---

## [3.8.3] - 2026-04-20

### Fixed — `user_email` at top level of post-OAuth finish-connection endpoints (egress IP hook) — B2

Ported web commit `d3f9078` (`fix(broker-connect): pass user_email on post-OAuth finish-connection calls`). After a broker OAuth WebView returns with an auth code/request token, the app POSTs to a ccxt-india "finish-connection" endpoint (e.g. `/zerodha/gen-access-token`) to exchange it for a session token. That outbound call proxies to the broker's API and needs the customer's whitelisted IPv6 — the ccxt egress hook resolves the customer from top-level `user_email` in the request body; without it, the call binds the shared `72.61.251.253` and brokers reject with session-mismatch / IP-not-whitelisted errors. On ICICI specifically this manifests as a Status:500 body returned as HTTP 200, so the frontend's `status === 200` check passes but `sessionToken` stays null and the success dialog never opens.

Added top-level `user_email` to 10 callsites across 10 files:

- **Zerodha** (`/zerodha/gen-access-token`, 5 sites): `src/UIComponents/BrokerConnectionUI/ZerodhaConnectUI.js` (step-1 access-token exchange), `src/UIComponents/BrokerConnectionUI/HelpUI/ZerodhaConnectModal.js`, `src/screens/Drawer/IgnoreTradesScreen.js`, `src/screens/Broker/BrokerAuthScreen.js` (generic WebView — Zerodha branch), `src/components/AdviceScreenComponents/StockAdvices.js` (connectZerodha). All parallel code paths patched per web-parity guidance since `BrokerModalRenderer` and the ignored-trades/advice flows still dispatch through the legacy UIs alongside the generic BrokerAuthScreen.
- **Upstox** (`/upstox/gen-access-token`, 1 site): `src/components/BrokerConnectionModal/upstoxModal.js` (connectUpstox).
- **Fyers** (`/fyers/gen-access-token`, 2 sites): `src/components/BrokerConnectionModal/FyersConnect.js` (connectFyers), `src/screens/Broker/BrokerCredentialScreen.js` (generic credential screen — Fyers branch).
- **IIFL** (`/iifl/login/client`, 2 sites): `src/components/iiflmodal.js`, `src/components/iiflproceedmodal.js` — both `handleIIFLLogin` postback handlers.

Every targeted file already had `userEmail` in scope (either via Firebase `getAuth().currentUser?.email`, a passed prop, or a local `const userEmail = user?.email` — no new imports needed).

**Already had `user_email` (no change):** `src/components/BrokerConnectionModal/HDFCconnectModal.js` was patched on 2026-04-18 as part of the HDFC payload-parity fix; `src/utils/ProcessTrades.js` already carried top-level `user_email` on trade payloads from an earlier port.

**Intentionally skipped:**
- **Groww** — prod migrated Groww from partner OAuth to API-key + IP whitelist (commits 9ee7aed + 635b6ef, 2026-04-20). The app's current Groww OAuth code path is being retired in the follow-up G1+G2 commits; adding `user_email` to a to-be-deleted path would be churn.
- **AliceBlue** — app uses a WebView redirect URL (`${ccxtServer}aliceblue/login?origin=…`), not a body POST, so there's no JSON body to carry `user_email`. Web's commit added it to a client-side `aliceblue/login` POST site that doesn't exist on the app after the 2026-04-18 AliceBlue WebView migration.
- **ICICI customer-details** — removed on app in the Option-B ICICI migration (2026-04-17), handled server-side in `icici/auth-callback/{subdomain}`.

See `docs/BROKER_CONNECTION.md` → *Finish-connection endpoints* for the full callsite table. B3 (verify-edis) is the follow-up.

---

## [3.8.2] - 2026-04-20

### Fixed — `user_email` at top level of `/api/process-trades/order-place` payloads (egress IP hook) — B1

Ported web commit `ea970e4` (`fix(broker-connect): top-level user_email in basket + trade payloads`). The ccxt-india egress request hook resolves the customer's Route64 IPv6 from `request.body.user_email` — when missing, the outbound broker call binds the shared `72.61.251.253` and whitelist-enforcing brokers (Upstox in particular) reject with `UDAPI1154 — static IP does not match request origin IP`. The Node backend's `Routes/Broker/ProcessTrades.js → createPayload()` only forwards `user_email` to ccxt if it was present on the incoming body at the **top level** (per-trade-row copies get stripped during payload construction). Three files carried basePayloads that constructed the trade-place payload without a top-level `user_email`:

- `src/components/AdviceScreenComponents/StockAdvices.js` — bespoke trade flow. Added `user_email: userEmail` to both the GTT `gttPayload` (line ~569) and regular `basePayload` (line ~586). The `userEmail` prop is already passed into the component (`StockAdvices = React.memo(({ userEmail, ... })`).
- `src/components/AdviceScreenComponents/AddtoCartModal.js` — Add-to-Cart review flow. Two payload sites: the broker-switch `basePayload` (line ~484) and the cart-path `getOrderPayload` returning `{trades: cartItems, user_broker, accessToken}` (line ~624). Both now include `user_email: userEmail` (already in scope via `const userEmail = user?.email;`).
- `src/screens/Drawer/IgnoreTradesScreen.js` — ignored-trades retry flow. Added `user_email: userEmail` to the `basePayload` at line ~484 (already in scope via `const userEmail = user && user.email;`).

`src/utils/ProcessTrades.js` already carried `user_email` at the top level of both GTT and regular payloads (lines 242, 270) — no change needed.

Without this fix, basket/bespoke order placement from these three flows would fail on whitelist-required brokers even after the customer's IPv6 was correctly provisioned, because the egress hook had no way to resolve the customer identity from the payload.

See `docs/BROKER_CONNECTION.md` → *Per-customer egress IP contract* for the full contract. B2 (OAuth finish-connection endpoints) and B3 (`verify-edis`) are follow-ups.

---

## [3.8.1] - 2026-04-17

### Fixed — LTP stream was never delivering prices; app showed ₹0 Total Current and N/A table rows (2026-04-20)

`src/FunctionCall/useWebSocketCurrentPrice.js` — the hook connected to the wrong socket server on the wrong namespace with the wrong handshake, so `getLTPForSymbol` returned 0 for every symbol. The only reason some screens looked like they had prices before yesterday was the `averagePrice` fallback in the MP Performance table (removed yesterday to match web's N/A behavior) — which exposed the underlying dataflow break.

Four divergences from `prod-alphaquark-github/src/context/MarketDataContext.js` fixed:

| Aspect | Before (broken) | After (matches web) |
|---|---|---|
| Server | `wss://ccxt.alphaquark.in` (from `serverConfig.ccxtWs.baseUrl`) | `https://websocket.alphaquark.in` — derived from `server.websocket.baseUrl` which was already in `serverConfig.js` but unused; matches web (`prod-alphaquark-github/src/utils/serverConfig.js:13` → `MarketDataContext.js:268`). The earlier attempt in 40b0dcb pointed at `ccxtprod.alphaquark.in` which hosts the same ccxt app but mounts the REST route at `/websocket/subscribe-array` (not `/subscribe-array`). `websocket.alphaquark.in` is the canonical host for the price feed and matches web's path layout. |
| Namespace | default `/` | `/ltp` — `io(`${ccxtUrl}/ltp`, …)` |
| Handshake | none | `socket.emit('subscribe_me', { userEmail, dbName })` on `connect`; `userEmail` from `getAuth().currentUser`, `dbName` from `Config.REACT_APP_HEADER_NAME || REACT_APP_URL || REACT_APP_ADVISOR_SUBDOMAIN` |
| Subscribe REST | per-symbol `POST /websocket/subscribe` (unrelated endpoint) | batched `POST ${ccxtUrl}/subscribe-array` with `{ symbolExchange, userEmail, dbName }` |
| Events | only `market_data` | both `ltp_update` (primary payload `{ symbol, ltp }`) AND `market_data` (alt payload `{ stockSymbol, last_traded_price }`) |

Kept the hook's public surface identical (`{ ltp, getLTPForSymbol }`) so all 7 callers (`AfterSubscriptionScreen`, `ModelPFCard`, `PortfolioScreen`, `MPStatusModal`, `RebalanceModal`, `MPReviewTradeModal`, `UserStrategySubscribeModal`) work without any call-site changes. Added queueing for subscriptions requested before the socket finishes connecting, and re-subscribe logic for the reconnect case. Prices now round-trip for all screens consuming the hook, so the MP Performance screen shows real Current Price / Returns / Total Current values instead of N/A / ₹0.

### Fixed — Duplicate tab bar + under-featured holdings table on MP Performance screen (2026-04-20)

`src/screens/Home/AfterSubscriptionScreen.js` — the Portfolio Distribution tab rendered `<DistributionGrid />` without a `type` prop, which made the child render its own internal "Portfolio Distribution / Portfolio Holdings" tab switcher on top of the screen's own outer TabView — two tab bars stacked, showing "Portfolio Holdings" twice. Additionally the outer Portfolio Holdings table was a 4-column simplified view (Stock / Current / Avg Buy / P&L %) while the inner duplicate one had a more detailed 6-column version (Stock / Current Price / Avg. Buy / Returns / Weight / Shares) users preferred.

Fix:
1. Pass `type="MPPerformanceScreen"` to `DistributionGrid` — `DistributionRowGrid.js:240-272` already branches on this and hides the inner tabs, rendering only the distribution grid. Removes the duplicate tab bar.
2. Rebuilt the outer holdings table to the 6-column detailed layout: Stock / Current Price / Avg. Buy / Returns / Weight / Shares, wrapped in a horizontal `ScrollView` since six columns don't fit on narrow phones. Kept the 2026-04-20 N/A fallback behavior (no `avg` fallback for current price), kept header/cell widths consistent, kept the "Prices may be delayed" footer. `MPPerformanceScreen.js` already passes `type={'MPPerformanceScreen'}` to its own `DistributionGrid` call, so only `AfterSubscriptionScreen` was affected.

Net effect: one tab bar ("Portfolio Holdings" / "Portfolio Distribution"), and the Portfolio Holdings tab now shows the fuller table users wanted.

### Fixed — MP Performance table rows silently fell back to avg when LTP missing (2026-04-20)

`src/screens/Home/AfterSubscriptionScreen.js` — the top-card `TOTAL CURRENT` correctly skips stocks without an LTP (matching web `StrategyDetailsWithPortfolioData.js:596-601`), but `tableData.currentPrice` was falling back to `averagePrice` when live WebSocket + saved snapshot + ccxt cache all missed. Symptom: MP plan showed "TOTAL CURRENT ₹0 / CURRENT RETURNS -100%" while the Portfolio Holdings rows read "GTLINFRA-EQ Current ₹1.24 / Avg Buy ₹1.24 / P&L +0.0%" — a user-confusing split signal where row-level "Current" was actually just the avg-buy number echoed back.

Aligned with web's `tableData` block (`StrategyDetailsWithPortfolioData.js:614-632`): added a `hasValidPrice` gate (`resolvedLtp !== null && !isNaN && !== 0 && avg !== 0`) and emit the string `'N/A'` for `currentPrice` / `returns` when LTP is unavailable. Kept the mobile-only snapshot + ccxt-cache fallbacks in the resolution chain (legitimate offline sources — mobile WebSocket isn't always connected); only the `avg` last-resort fallback was dropped. Row renderer updated to show literal `N/A` text and a neutral gray for the returns cell in those cases. `avgBuyPrice` still renders so users can see what they paid.

### Fixed — Broker header and Funds Info card show different brokers after aborted Reconnect (2026-04-20)

`src/screens/Home/SubscriptionScreen.js` — the `onReconnect` handler wired on 2026-04-18 did an optimistic `setBroker(expiredBroker)` before dispatching the per-broker modal. Symptom seen on 2026-04-20: header showed "**Dhan** Broker Connected" while the "Your Broker & Funds Info" card below still said "Broker: **Groww**" with Groww's ₹0 cash.

Root cause was classic optimistic-update-without-rollback. `TradeContext`'s `broker` and `userDetails.user_broker` are two copies of the same logical value — `getUserDeatils()` (`TradeContext.js:937-941`) always updates both atomically from the same backend response. They can only drift when `setBroker()` fires without an accompanying `setUserDetails()`. The optimistic `setBroker('Dhan')` in `onReconnect` did exactly that, and if the user then **aborted** the per-broker modal (closed it before finishing OAuth), nothing else would ever resync — `DhanConnectModal.js:170-174`'s `fetchBrokerStatusModal` + `getUserDeatils` calls only fire on successful `PUT /api/user/connect-broker`.

Fix: removed the `setBroker(expiredBroker)` line. The handler now only calls `fetchBrokerStatusModal()`, which is a no-op on abort (backend state unchanged). On a real reconnect, the per-broker modal's own `PUT /api/user/connect-broker` sets `user_broker` on the backend and the follow-up `getUserDeatils()` snaps both `broker` and `userDetails` to the new value in a single commit.

No parity concern with web: web's reconnect path writes via the same `/api/user/connect-broker` route and doesn't pre-switch active state either. Aligned behavior.

### Changed — Manage Connections Reconnect opens per-broker modal directly (2026-04-20)

Removed the one-tap detour introduced on 2026-04-18 where the Reconnect button funneled through `BrokerSelectionModal` (the broker picker). Now matches web's `TokenExpireBrokarModal` pattern: one tap → the expired broker's own connect modal opens directly.

- **`src/screens/Home/ManageConnectionsModal.js`** — added a `BROKER_MODAL_KEY_MAP` that translates the backend `connected_brokers[].broker` value to the `ModalManager` switch key (e.g., `'ICICI Direct' → 'ICICI'`, `'Hdfc Securities' → 'HDFC'`, `'Motilal Oswal' → 'Motilal'`, `'IIFL Securities' → 'IIFL'`). `handleReconnect()` now closes Manage Connections, optionally fires `registerCallback('angelone', '/stock-recommendation')` when the broker is Angel One (matching `BrokerSelectionModal.handleBrokerSelect:240-242`), calls `onReconnect?.(broker)` so the parent can refresh state, then dispatches `useModalStore.getState().openModal(modalKey)` — the globally mounted `ModalManager` (mounted at `App.js:217` inside `TradeProvider`) renders the per-broker modal. If a broker isn't in the map (shouldn't happen now that all 13 are covered), we fall back to the parent's `onReconnect` callback.
- **`src/screens/Home/SubscriptionScreen.js`** — the `onReconnect` callback no longer opens `BrokerSelectionModal` via `setTimeout(setModalVisible(true), 0)`. It just calls `setBroker(expiredBroker)` + `fetchBrokerStatusModal()` so the header reflects the newly-active broker while the per-broker modal is open. One fewer modal on screen, one fewer tap for the user.
- **`src/GlobalUIModals/ModalManager.js`** — added `case 'IIFL'` / `case 'IIFL Securities'` → `IIFLModal` (the import was already there; just the switch case was missing). `case 'Axis Securities'` was already added in the 2026-04-20 Axis-palette fix. All 13 supported brokers now route through `ModalManager`.

Behavior: user opens Manage Connections → sees expired brokers with amber "Session Expired" + "Reconnect" button → taps Reconnect → Manage Connections closes → the broker's own partner-OAuth consent flow (Angel One / Dhan / Groww / AliceBlue / Axis) or dev-credential form (Zerodha / Upstox / Fyers / ICICI / HDFC / Motilal / Kotak / IIFL) appears immediately. No picker in between. Matches web parity.

### Fixed
- **Axis Securities missing from broker palette** (2026-04-20): `BrokerSelectionModal.js:brokersmain` hard-codes 11 brokers and Axis wasn't among them, so the tile never rendered even though all downstream plumbing — `brokerRegistry.js`, `AxisConnectModal.js` (full SSO flow: `axis/login-url` → WebView → `ssoId` intercept → `axis/callback` → `PUT /api/user/connect-broker`), `brokerAuth.js`, `brokerSupport.js`, `ProcessTrades.js`, `fetchFunds.js`, `TokenExpireBrokerModal.js` — was already wired. Additionally `GlobalUIModals/ModalManager.js` had no `case 'Axis Securities'` branch, so even adding the tile wouldn't have opened anything. Fix: (1) copied `prod-alphaquark-github/src/assests/Broker/Axis.png` to `src/assets/axis.png`; (2) added Axis entry to `brokersmain` keyed as `'Axis Securities'` (matches the `user_broker` value the rest of the codebase expects) with `simplehai.axisdirect.in` URL; (3) imported `AxisConnectModal` in `ModalManager.js` and added the `case 'Axis Securities'`; (4) renamed the modal's prop `isOpen` → `isVisible` (consistent with every other modal the dispatcher renders) and moved `userEmail`/`userId`/`configData` sourcing to internal hooks (`getAuth()` + `useTrade()` + `GET /api/user/getUser/<email>`) to match `FyersConnect.js`, since `commonProps` in `ModalManager` doesn't spread them. No backend change; no flow change.
- **Limit-price lost on cart refresh + decimals silently truncated**: `StockAdvices.js:handleLimitOrderInputChange` — the handler called `parseInt(value)` and only updated local state, so a user-entered ₹123.45 became `123` and anything entered was wiped by the next `getCartAllStocks()` refresh. Aligned with web `NewStockCard.js:774-820`: validates input against `/^\d*\.?\d{0,2}$/` and stores the string as-is (no `parseInt`), then `POST ${server.server.baseUrl}api/cart/update` with `{ tradeId, price: formattedValue }` using the existing `generateToken` + `REACT_APP_HEADER_NAME` header pattern, and re-pulls cart state via `getCartAllStocks()` on success. Errors are logged and non-fatal — local state is already updated so the user sees their entry immediately.
- **Transient broker errors force re-login during maintenance windows**: `src/utils/rebalanceHelpers.js` — ported `TRANSIENT_NON_AUTH_BROKER_ERROR_CODES`, `isTransientFundsError` (alias `isTransientBrokerError`), and `detectTransientOrderWindowError` from web (`prod-alphaquark-github/src/utils/rebalanceHelpers.js:15-105`). Updated `isFundsErrorOrMissing` to short-circuit (`return false`) when the response is a known transient error (Upstox `UDAPI100072`/`UDAPI100074` during the nightly 00:00–05:30 IST funds/place-order maintenance window, plus message-based heuristics like "temporarily unavailable" / "try again" / "service window" / "market hours"). Rebalance flow now keeps cached funds instead of bouncing the user into the broker-reconnect modal when the failure is documented-transient. Wired `detectTransientOrderWindowError(response?.data)` at the two all-orders-failed sites to swap the internal failure modal for a soft "Broker service window" toast and clean exit: `RebalanceModal.js:~1417` (bespoke/MP rebalance via backend process-trade) and `MPReviewTradeModal.js:~486` (MP subscription order placement via `api/model-portfolio-place-order`). Both call `enrollStatusCheckQueue` / `getRebalanceRepair` so the failed rows come back ready for retry when the window reopens. Fyers publisher path at `MPReviewTradeModal.js:~1291` intentionally left unchanged — publisher SDK flow is mobile-specific and its status-recording chain must run even on transient failure.
- **Basket card color drift from web**: `BasketCard.js` — regular-state basket card was a pure green gradient (`#0F3E00 → #29A400`), while the web user-side uses a dark navy gradient (`#000C18 → #002C59 → #000C18`) with a translucent green accent border (`#1E9F40` @ 30%). Swapped `getGradientColors()` regular-state return to the navy palette and conditionally applied the green accent border when `!isExpired && !isClosureBasket`. Expired (gray) and closure (red) recolorings retained as app-specific visual cues — minimal parity, not full parity with web's badge-only differentiation.
- **Recommendation visibility window ignored on app (shows ~15 days regardless of admin 7-day setting)**: `TradeContext.js:134` — `fetchAdviceShowDays` was reading `response.data?.adviceShowLatestDays`, but `/api/admin/frontend-config` returns `{ success, data: { adviceShowLatestDays } }`. The wrong path yielded `undefined` → `Number(undefined) === NaN` → `setAdviceShowDays` never fired → the app kept the `useState(15)` fallback. Fixed to `response.data?.data?.adviceShowLatestDays` (matching web `AdminSettings.js:1311`). Paired with an `aq_backend_github` fix so the admin UI's saved value actually persists — `Routes/Admin/updateTermsConditions.js` now writes to both `AdminAccess.adviceShowLatestDays` (legacy) and `AllAdvisorDetails.advice_show_latest_days` (what `loginRoutes.js:92` reads first; previously the admin's POST never touched this field so refresh always reverted to the schema default `7`).
- **Research Report row action**: `ResearchReportScreen.js` — replaced the external-link icon with a download icon and swapped the tap handler from "open in in-app `WebView`" to a silent `RNFS.downloadFile` into `DownloadDirectoryPath` (iOS: `DocumentDirectoryPath`). Android WebView can't render PDF presigned URLs natively, so the prior flow opened a blank/closing modal. The new flow fetches the presigned URL (falling back to `comms/research-report-link/<advisorTag>/<symbol>`), streams the PDF to `<symbol>_report_<ts>.pdf`, and toasts on completion. Removed unused state (`showPdfModal`, `selectedPdfUrl`, `webViewLoading`, `shouldLoadPdf`) and the entire PDF `Modal`/`WebView` block.
- **Plans tab missing Model Portfolio tab**: `ModelPortfolioScreen.js` — tab visibility is now driven purely by the `config.bespokePlansEnabled` / `config.modelPortfolioEnabled` feature flags (defaulting to enabled when undefined, matching web). Previously a tab was hidden when its list had zero items, which collapsed the UI to a single full-width pill and hid MP entirely when an advisor had no MP strategies. Each tab's scene already renders its own empty state. Also aligned the bespoke flag source from `configData.config.REACT_APP_BESPOKE_PLANS_STATUS` to `config.bespokePlansEnabled` for consistency, and added `config` to the `useMemo` dep array.
- **Portfolio top card shows ₹0 P&L/Invested/Returns when plan selected**: `PortfolioScreen.js` — added a `planSummary` `useMemo` that aggregates `totalInvested` / `totalCurrent` / `totalReturns` / `returnsPercentage` client-side from `planHoldings` using live LTP, and wired `profitAndLoss` / `pnlPercentage` / `effectiveHoldingsData` to prefer it when the `All Holdings` tab is active AND a plan is selected. Previously these only switched on the MP tab (`selectedInnerTab === 1`), so plan-filtered rows rendered correctly in the list below but the summary card kept showing broker-wide aggregates (₹0 for test accounts with no direct broker holdings).

### Added
- **Bespoke Recommendations → Rejected tab**: `HomeScreen.js` — the "View All" page now has an Active / Rejected tab switcher above `<StockAdvices>`. Active renders `type='All'`; Rejected renders `type='OSrejected'` against `rejectedTrades`. `TradeContext.js` no longer double-pushes rejected bespoke into `recommended`, so rejected cards appear only in the Rejected tab (previously they showed in both). `StockCard.js` now renders `Ignore + Trade Now` buttons when `type === 'OSrejected'` (replacing `Add to Cart + Retry`) — Ignore wires into the existing `IgnoreAdviceModal` → `PUT /api/recommendation { trade_place_status: 'ignored' }`, Trade Now reuses `handleSingleSelectStock` to re-trigger the order via `ReviewTradeModal`. Basket-card behavior left unchanged (baskets never land in `rejectedTrades` today).

### Broker connection web-parity alignment (in progress)

Bringing every mobile broker-connection flow in line with the user-side web flow in `prod-alphaquark-github`. Container difference (WebView vs full-page redirect) is mobile-inherent and stays; everything else aligns. After a fresh per-file audit (replacing the initial plan which was based on incomplete data), the real state is:

**Decisions:**
- **Zerodha** — intentional divergence, no change. Mobile uses an advisor-shared Kite Connect app (`REACT_APP_ZERODHA_API_KEY`); web requires each user to register their own Kite Connect app and bring its apiKey + secretKey. Swapping would force adding a per-user credential form on mobile and break the simpler existing flow. Documented as "mobile variant".

**Verified already aligned (no change needed):**
- **Fyers** — `POST /api/fyers/update-key` with same payload as web.
- **Groww** — same `GET ccxt/groww/login/oauth?redirectUri=…` backend call as web; mobile uses `InAppBrowser` + Android App Links callback. Earlier "client-side PKCE" claim was incorrect.
- **Upstox / ICICI / HDFC entry points** — all already hit Node's `/api/<broker>/update-key` endpoints.
- **Angel One / Kotak / Dhan** — already aligned.

**Changed (2026-04-17):**
- **Motilal Oswal**: `MotilalModal.js:97-105` — added `user_broker: 'Motilal Oswal'` field to the `PUT /api/motilal-oswal/update-key` request body to match web's payload shape. Single-field payload parity fix, no UI change, no flow change.
- **Upstox**: `upstoxModal.js:114-119` — added `user_broker: 'Upstox'` field to the `POST /api/upstox/update-key` request body to match web's payload shape. Same pattern as Motilal.
- **AliceBlue**: `AliceBlueConnect.js` — swapped the hardcoded `https://ant.aliceblueonline.com/?appcode=7WMf5NotZe` authUrl for a new `buildAliceBlueAuthUrl()` that constructs `${ccxtServer}aliceblue/login?origin=…&returnPath=…` (matches web's `handleAliceBlueConnect` in `AllBrokerList.js:55-65`). `origin` + `returnPath` split from `REACT_APP_BROKER_CONNECT_REDIRECT_URL` via `URL` parser (fallback to static defaults if malformed). Existing WebView callback interception unchanged — the final redirect back to the mobile app still carries `user_broker=AliceBlue&status=0&access_token=…&client_id=…`. Now uses the same MongoDB origin-tracking flow web uses instead of going to AliceBlue's appcode URL directly.
- **ICICI Direct** (Option B — full web parity, breaking change): `icicimodal.js` + `HelpUI/ICICIHelpContent.js` — removed the client-side `apisession` interception → `ccxt/icici/customer-details` exchange → `PUT /api/user/connect-broker` chain. WebView now intercepts only the final `REACT_APP_BROKER_CONNECT_REDIRECT_URL` redirect after CCXT's server-side `/icici/auth-callback/{advisorSubdomain}` finishes the handshake and saves `session_token` server-side (matches web's `connectBroker.js:820-856` + instructions at `connectBroker.js:1697-1728`). Help content updated to show the new required Redirect URL `{ccxtServer}icici/auth-callback/{REACT_APP_HEADER_NAME}`. **Migration required**: existing mobile ICICI users must log into their ICICI developer dashboard and update the Redirect URL to the CCXT callback before reconnecting — the app shows a guided error if the legacy URL is still registered. No UI/form changes otherwise.
- **Axis Securities** (response-parsing bug fix, not a flow change): `AxisConnectModal.js` — on investigation, web's Axis flow also exchanges `ssoId` client-side (not server-side as the plan originally stated), so no Option-B shift was needed. But mobile's parsing of the `ccxt/axis/callback` response was stale: it read flat fields `authTokenAxis` / `refreshTokenAxis` off `.data` (which don't exist in the actual response), causing every Axis connect attempt to throw `"Missing auth token or account ID from Axis"`. Aligned to web (`StockRecommendation.js:1716-1728`): now reads the nested `.data.data` envelope, unwraps `authToken.token \|\| authToken` and `refreshToken.token \|\| refreshToken || ''`, and adds `metadata?.accounts?.[0]?.subAccountId` as a `subAccountId` fallback. Error messaging switched to "Missing credentials from Axis SSO response" to match web's wording.
- **HDFC Securities** (payload parity only): `HDFCconnectModal.js` — on investigation, web also does the `requestToken → accessToken` exchange client-side (`StockRecommendation.js:1500-1555`), so no Option-B shift was needed. Two payload fields aligned: (1) added `user_broker: 'Hdfc Securities'` to the `POST /api/hdfc/update-key` body (matching web `connectBroker.js:778-783`), (2) added `user_email` to the `POST ccxt/hdfc/access-token` body (matching web `StockRecommendation.js:1510-1515`). No UI/flow change.

### Fixed — Rebalance shows dead-end "Unable to Rebalance" for Groww 401 instead of Reconnect modal (2026-04-18)

`src/utils/rebalanceHelpers.js:170-189` — `isBrokerAuthError()` was missing several broker-forwarded 401 phrasings, which caused the rebalance flow to dead-end at `RebalanceModal.js:1972-2026` (the generic `calculatedPortfolioData.status === 1` empty state with a "Go Back" button) instead of routing into the `TokenExpireBrokerModal` for reconnection.

Reproduction seen on 2026-04-18 with Groww as the active broker: `POST ccxt/rebalance/calculate` returned `{ status: 1, message: "Please Login and Try Again (Error: 401)" }`. The existing keyword set (`invalid token`, `session expired`, `unauthorized`, `authentication`) matched **none** of that string, so `RebalanceAdvices.js:730-736` fell past the `setOpenTokenExpireModel(true)` branch and stored the response verbatim, leaving the user with no way forward short of killing the flow.

Added these case-insensitive keyword matches:
- `please login` / `please re-login` / `login required`
- `error: 401`
- `401 unauthorized`
- `token expired` (complement to existing `session expired`)

Now a Groww (or any broker) 401 routes into the per-broker reconnect modal automatically. Does NOT change any DB state — the stored `connected_brokers[].status` for Groww may still read `'connected'` in Manage Connections until the next reconcile; that's a separate backend concern tracked below.

**Backend reconciliation gap (not fixed here, documented for the next pass):** when the user sees an expired Groww token mid-rebalance, the backend route that surfaces the 401 doesn't currently write `status: 'expired'` back to the `connected_brokers[].status` field. So Manage Connections keeps showing Groww as "Active" until a successful reconnect resets state. A backend hook (in `ccxtprod.alphaquark.in`'s rebalance handler or a Node-side `api/user/brokers/{broker}/status` endpoint) is the correct fix — requires a separate backend PR and is out of scope for this mobile-only change.

### Added — Manage Connections surfaces session-expiry + Reconnect (2026-04-18)

Ports web's "expired broker" treatment into the mobile Manage Connections modal (`src/screens/Home/ManageConnectionsModal.js`), which previously showed a flat list of brokers and silently discarded the backend `status` field. Now matches web `BrokerCard.js:54-58`.

- **`ManageConnectionsModal.js`**:
  - Fetch mapping preserves `b.status` + `b.token_expire` from the `/api/user/brokers` response (previously stripped to only `broker`/`connected_at`/`is_active`/`has_credentials`). Added a derived `is_expired` flag covering `status === 'expired'` or `status === 'error'` (case-insensitive), matching the backend enum in `aq_backend_github/Models/userModel.js:78-82` and `MultiBrokerContext.js` BROKER_STATUS constants.
  - Renders an amber "Session Expired" badge next to the broker name when `is_expired` is true (same hue family as web's amber badge).
  - Renders a solid amber **Reconnect** button for expired rows. Clicking it fires `onReconnect(brokerName)` and closes the modal. For expired rows the Switch and Stored-Credentials badges are suppressed (Remove is still available to disconnect explicitly).
- **`SubscriptionScreen.js:499-512`**: wired a new `onReconnect` callback that calls `setBroker(expiredBroker)` to make the expired broker the active one in `TradeContext`, closes Manage Connections, then defers `setModalVisible(true)` via `setTimeout(..., 0)` so `BrokerSelectionModal` mounts after the previous modal has fully unmounted (matches the same RN commit-ordering pattern used in the Trade Now / review-modal fix in commit `ad68380`). From there the user taps the broker to start the correct per-broker auth path — partner OAuth for Angel One/Dhan/Groww/AliceBlue/Axis, dev-credential form for non-partners.

Scope note: mobile lacks per-broker modal state at `SubscriptionScreen` level (unlike web's inline connect flow), so Reconnect funnels through the existing `BrokerSelectionModal` rather than jumping straight into the per-broker modal. One extra tap vs web; no risk of mis-wiring individual broker modals. Deeper refactor (dispatching directly to the per-broker modal) deferred — `TokenExpireBrokerModal` still handles the mid-trade reconnect path that matters most.

### Fixed — Axis Securities missing from reconnect modal (2026-04-18)

`src/components/TokenExpireBrokerModal.js:10` — the `OAUTH_BROKERS` list omitted `'Axis Securities'`. When an Axis user's session expired, the modal would render with the generic title but **no button or form** — leaving the user stuck with no way to reconnect from the modal. Added `'Axis Securities'` to the list so the same partner-OAuth "Reconnect {broker}" button renders (matching web `TokenExpireBrokarModal.js:1027`). No other broker logic changed.

Note on wider reconnect-modal architecture (flagged, not fixed here): the `handleOAuthReconnect` callback wiring (the `checkValidApiAnSecret` prop) is vestigial — it closes the modal and calls an AES-decrypt helper with the broker name as input, which no-ops. Reconnection actually works only because closing the modal lets the parent flow re-trigger the broker-selection path on the next trade. Deeper fix deferred.

### Fixed — Bottom-bar "Trade (N)" counter stuck at 0 after Add to Cart (2026-04-17)

`src/components/AdviceScreenComponents/StockAdviceContent.js:740-745` — after the Option-B cart/trade-intent split (commit `ad68380`), the bottom-bar counter still read `stockDetails.length`, but `stockDetails` is no longer populated on Add-to-Cart — it's only set when the user hits a trade-intent boundary (single Trade Now or bottom-bar Trade N). Result: user tapped Add to Cart, cart grew, but the button label stayed "Trade (0)" and the button stayed disabled, making the cart-then-trade flow impossible.

Fix: the three references on that button (`disabled` check, the visual disabled style, and the label text) now read `cartContainer.length` — same source as the existing Select All / Deselect All toggle right next to it. When the user finally taps Trade (N), `handleTrade` already (since `ad68380`) merges `cartContainer` into `stockDetails` before opening the review modal, so the downstream flow is unchanged.

### Fixed — "Scale quantities by amount" Update button is a no-op (2026-04-17)

`src/components/ReviewTradeModal.js:handleFixSize` — entering an amount and tapping Update left all quantities at 1, silently doing nothing. Two root causes fixed together:

1. **Wrong price source.** The function read `getLastKnownPrice(symbol)` from `DynamicText/websocketPrice.js`, which is backed by a `WebSocketManager.lastPrices` Map populated by the legacy `market_data` socket event. The current deployment emits `ltp_update` instead, which writes to the Zustand `useLTPStore` (what `TotalAmountText` reads). The old Map stays empty, so `getLastKnownPrice` returned `null` for every symbol → `totalCurrentValue === 0` → fell into the fallback branch where the same null price meant quantities were set to `1`.

2. **Wrong allocation algorithm.** Even if the price source had worked, the proportional-by-current-value algorithm produced results inconsistent with the Note text above the button ("ensuring the total investment stays within the specified budget"). For a two-stock cart at ₹500 + ₹300 with a 2000 input, proportional gave 2 + 2 = ₹1600 (not maxing out budget); the label implied equal-budget split (2 + 3 = ₹1900, which is what users expect and what actually matches the Note). Web's `ReviewTradeModel.js:266-277` does something else again — `floor(2000/price)` per stock, producing ₹3800 on the same input, which exceeds the budget the user just entered. Mobile's Note text is correct; web's code contradicts its own label.

Fix: rewrote `handleFixSize` to (a) read prices from `useLTPStore.getState().ltps[symbol]` and (b) use equal-budget allocation — `amountPerStock = targetAmount / stockDetails.length`, then `quantity = Math.floor(amountPerStock / livePrice)`. Kept `Math.max(…, 1)` floor to avoid zero-qty orders. Dropped the unused `getLastKnownPrice` import (left a comment breadcrumb).

**Intentional divergence from web** on the algorithm — mobile matches the label it shows to the user, web's code doesn't. Flagged for a future web-side fix rather than porting web's bug to mobile.

### Fixed — "Trade Now" review modal shows extra cart items (2026-04-17)

`src/components/AdviceScreenComponents/StockAdvices.js` — tapping "Trade Now" on a single stock card was opening `ReviewTradeModal` with every item in the persistent cart (including stale rejected trades from prior sessions), not just the clicked stock. Root cause: mobile was using `stockDetails` as both "cart state" and "trade-intent state", which web keeps separate. `handleSingleSelectStock` calls `handleSelectStock('add')` first, which internally ran `updateCartStates(cartItems)` → `setStockDetails(cartItems)` — writing the full cart into trade-intent state right before the intended `setStockDetails([newStock])` reset. Because both writes happen post-`await`, React's commit ordering could leak the cart-write into the modal render.

Option-B structural fix (matches web `NewStockCard.js:561-587` + `StockRecommendation.js:544`):

- `updateCartStates` — now only writes `cartContainer`. The old `setStockDetails(items)` line is gone. `cartContainer` is the cart; `stockDetails` is the trade-intent payload the modal consumes. They stop sharing writes.
- `handleSingleSelectStock` — new inner `openReviewForSingle()` helper that sets `stockDetails` to `[newStock]` and defers `setOpenReviewTrade(true)` via `setTimeout(…, 0)`, matching web's one-tick deferral (`NewStockCard.js:585-587`). Applied to all 17 broker-specific branches in that function.
- `handleTrade` + `handleTradeNow1` (bottom-bar "Trade (N)") — now explicitly populate `stockDetails` from `cartContainer` before opening the modal, merging any in-flight `stockDetails` edits (quantity/price changes) so user edits are preserved. Since `updateCartStates` no longer mirrors cart → stockDetails, this sync has to happen at the trade-intent boundary.
- `syncCartWithStockDetails` useEffect — no longer writes `stockDetails`. Now populates `cartContainer` + `stocksWithoutSource` on mount/tab-change. `stockDetails` stays empty until the user actually triggers a trade-intent action (either single "Trade Now" or bottom-bar "Trade (N)"). Matches web's separation.

See `APP_ARCHITECTURE.md` §4.5.0 for the state-separation contract.

### DummyBroker — doc correction (no code change needed, 2026-04-17)

Audited DummyBroker handling on both sides. **It's already functionally aligned** — web and mobile hit the same endpoints with identical payload shapes, same retry-once-with-2s logic, same `HOLDINGS_REFRESH` event, same `getRebalanceRepair` call, same 2s/5s delayed resync. The prior `BROKER_CONNECTION.md` entry that labeled DummyBroker "mobile-only simulation" was incorrect — it's a cross-platform sentinel (`user_broker: "DummyBroker"`) for the "Continue without broker" and "manually placed" flows. Corrected the doc entry and added a "DummyBroker Flow" section to `BROKER_CONNECTION.md` with a per-step endpoint/payload parity table citing line numbers on both sides.

The only differences that remain are intentional platform-specific UX: toast library (react-hot-toast vs react-native-toast-message), wording ("Refresh the page" vs "Pull to refresh"), and header value source (`process.env.REACT_APP_URL` vs `configData.config.REACT_APP_HEADER_NAME`). Mobile also has an "already aligned" auto-execute optimization (`RebalanceModal.js:375-444`) that web doesn't — keeping it, since it's an improvement, not a drift.

### Trade placement — web-parity fixes (2026-04-17)

Audited `src/utils/ProcessTrades.js` against web's `prod-alphaquark-github/src/Home/ProcessTrades/ProcessTrades.js`. Per-broker credential payloads already matched exactly; three **response-handling** divergences found. Landed the two unambiguously safe fixes; two higher-risk GTT items and one EDIS-architecture item deferred pending a real GTT order test / product decision.

- **Case-insensitive rejection status detection**: `ProcessTrades.js:detectEdisFailures` — mobile was matching `orderStatus === 'REJECTED' \|\| orderStatus === 'FAILURE'` (uppercase-exact), silently treating `Rejected` / `cancelled` / `Failure` responses as successful and therefore never firing the TPIN/EDIS modal for them. Replaced the comparison with a `REJECTED_ORDER_STATUSES` set covering all 9 variants web checks (`ProcessTrades.js:363-373`): `REJECTED`/`Rejected`/`rejected`, `CANCELLED`/`Cancelled`/`cancelled`, `FAILURE`/`Failure`/`failure`. Strictly additive — catches cases previously missed, never un-catches anything.
- **HTTP-level session expiry detection**: `ProcessTrades.js:executeOrder` + caller — mobile previously only checked `regularResponse?.sessionExpired` body flag. Now also catches network-level errors (fetch throw) and HTTP `401`/`403` responses, throwing a tagged error (`err.sessionExpired = true`) that `placeOrders` routes through the `onSessionExpired` callback. Matches web's axios error handling at `ProcessTrades.js:449-454` which treats `ERR_NETWORK` / `ECONNABORTED` / 401 / 403 as session-class failures with the "reconnect your broker" toast. Body-level `sessionExpired` flag path preserved for backwards compatibility.

**Landed (2026-04-17, follow-up after user approval):**

- **GTT leg payload — ported web's per-trade structure**: `ProcessTrades.js:buildOrderPayload` — when `isGtt`, legs now live INSIDE each trade object (not at the payload top level) and field names are transformed: `Symbol` → `tradingSymbol`, `Exchange` → `exchange`, `Type` → `transactionType`, `OrderType` → `orderType`, `ProductType` → `productType`. `parseFloat()` applied to `triggerPrice` and `ltp` (both also feed `price`). `quantity` is pulled from `stock.quantity` per-trade. Matches web `ProcessTrades.js:93-144` exactly. The old top-level `payload.entryLeg/leg1/leg2` assignment is removed.
- **GTT response path — array body**: `ProcessTrades.js:placeOrders` — the CCXT `{broker}/process-trades` endpoint returns an array; mobile now spreads the whole array into `allResults` when it sees `Array.isArray(gttResponse)`. Web-compat fallback retained for the old `{ response: [...] }` envelope shape in case any backend version still returns it. Matches web `ProcessTrades.js:346`.
- **TPIN modal — drop keyword filter**: `ProcessTrades.js:detectEdisFailures` — removed the `EDIS_ERROR_KEYWORDS` substring match. Mobile now returns every rejected SELL and lets the caller fire the TPIN callback, matching web's explicit comment (`ProcessTrades.js:382-383`: "*Don't rely on CDSL keyword detection — error message formats can change*"). Trade-off: TPIN modal may now fire on market-hours/insufficient-funds rejections too — accepted, same as web, for reliability against changing broker error phrasings. `EDIS_ERROR_KEYWORDS` constant deleted.

**Remaining mobile-only / intentional divergences (unchanged):**

- **IIFL Securities** — kept as mobile-only (web has it commented out in `AllBrokerList.js`). No change.
- **Zerodha** — intentional divergence (Option B, advisor-shared Kite Connect app). No change.

**Still to do**: none — all 14 brokers either already aligned, intentionally diverged (Zerodha), or fixed under this pass.

**Out of scope**: order execution / `ProcessTrades.js` / broker order-book APIs; backend changes (every endpoint referenced already exists server-side); IIFL removal (mobile-only, pending product decision); DummyBroker (mobile-only simulation).

---

## [3.8.0] - 2026-04-08

### Changed — Web Consistency Alignment (Phase 1-2: Utilities)
- **rebalanceHelpers.js**: Aligned all 6 helper functions to match web app (source of truth):
  - `isFundsErrorOrMissing` now returns `boolean` (was `{isError, reason}` object)
  - `isSubscriptionAmountError` keywords aligned: `subscription_amount_raw`, `subscription amount`, `not set or has been cleared`
  - `isLowAllowedBalanceError` narrowed to single check: `low allowed balance`
  - `checkPortfolioShortfall` now uses message-based detection (`less than required minimum` + regex) instead of numeric comparison
  - `isBrokerAuthError` uses compound conditions matching web pattern
  - `buildBrokerPayloadFields` removed Angel One fallback, DummyBroker explicit case, default now returns `{}`
- **basketUtils.js**: `netBasketTrades` aligned with web:
  - Added `cancel !== true` filter for recommend trades
  - Added rejected trade deduplication by symbol (Map, keeps first occurrence)
  - Added `consolidatedClosures` to recommend-trades return path
- **fetchFunds.js**: Refactored to web's `userEmail` pattern — server fetches API keys from DB instead of decrypting client-side. Fixed IIFL Securities (was hardcoded unavailable). Removed Bearer prefix stripping for Motilal Oswal. Error return now passes `error?.response?.data` instead of `null`.
- **RebalanceAdvices.js**: Updated `isFundsErrorOrMissing` caller to handle boolean return (was branching on `reason` codes)

### Changed — Web Consistency Alignment (Phase 3: Rebalance Flow)
- **RebalanceCard.js**: Added broker validation + funds check before `handleCheckStatus`. Added zero-quantity holdings filter. Added `skipRepairRef` to bypass stale repair data on fresh rebalance.
- **RebalanceModal.js**: Added `caPendingInfo` to process-trade payload for split settlement tracking. Added sell-against-holdings filter (prevents selling stocks user doesn't own). Added `allOrdersFailed` detection from `orderErrors`/`fundsRequired` backend response. Added publisher timeout fallback (90s) for Zerodha WebView.
- **RebalanceAdvices.js**: Subscription amount error now navigates to AfterSubscriptionScreen with modify-investment option (was alert-only).

### Added
- **rebalanceDiffUtils.js**: Ported `computeRowsDiff` from web — compares two consecutive rebalance snapshots to show added/removed/increased/decreased stocks

---

## [3.7.2] - 2026-04-05

### Fixed
- **Phantom Accept Rebalance button**: `RebalanceCard.js` — `hasExecutionRecord` guard prevents phantom Accept Rebalance button when no execution record exists for selected broker. (`4c869c7`)
- **DummyBroker status update retry**: `DummyBrokerHoldingConfirmation.js` — subscriber-execution status update retries once with 2s delay, shows error toast on failure. (`4c869c7`)
- **Zerodha auth-sell per-user credentials**: `DdpiModal.js` — added `userEmail` + proper headers to Zerodha auth-sell request for per-user credential lookup. (`4c869c7`)

### Added
- **Basket expiry utilities**: `basketUtils.js` — ported `parseExpiryFromSymbol`, `isBasketExpired`, `netBasketTrades` from web. (`4c869c7`)
- **Bespoke manually_placed flow**: `StockAdvices.js` — added `handleContinueWithoutBrokerBespoke` and `handleConfirmManuallyPlaced`. "Continue without broker" now marks trades as `manually_placed` via `PUT /api/recommendation`. (`4c869c7`)

---

## [3.7.1] - 2026-04-04

### Fixed
- **Blog name appearing twice**: Removed duplicate `<h1>` title from blog detail WebView in `KnowledgeHub.js` and `EducationalBlogs.js` — title was already shown in the `LinkOpeningWeb` modal header.
- **Blog short description missing**: Added `description` field display in the blog detail WebView HTML template.
- **"Sign In" on RA ID screen**: Removed redundant "Already registered? Sign In" link from `SignUpRADetails.js` — user already authenticated on the previous screen.
- **Privacy Policy / T&C WebView back button**: In-page "Back" links were navigating the WebView to the advisor's landing page instead of going back in the app. Added `onShouldStartLoadWithRequest` navigation protection to `PrivacyPolicyScreen.js`, `TermandConditionsScreen.js`, `LinkOpeningWeb.js`, and `ResearchReportScreen.js`.
- **Model Portfolio / Bespoke Plans intermittent empty state**: `ModelPortfolioScreen` was fetching data with `useEffect([userEmail])` but the API call requires `advisorTag` (from `configData`). When config wasn't loaded yet, the fetch used `undefined` advisorTag and returned no data. Added `advisorTag` to the dependency array so the fetch waits for config and re-runs when it arrives.
- **TradeContext unnecessary re-fetches**: `adviceShowDays` in the main fetch useEffect dependency array caused all fetches (videos, trades, notifications, model portfolios) to re-trigger when only trades needed refreshing. Separated into its own effect.

### Added
- **Auto-resolve advisor (central email_advisor_map)**: New backend system that auto-maps clients to advisors during signup/login, skipping the RA ID screen when the client's email exists in only one advisor's clientList. Falls back to RA ID screen when email maps to multiple advisors or is not found.
  - Backend: `EmailAdvisorMap` model in common DB, `GET /api/user/resolve-advisor/:email` endpoint, sync hooks in clientList CRUD routes, migration script (1,017 existing mappings backfilled).
  - App: `tryResolveAdvisor()` utility in `storageUtils.js`, integrated into `SignupScreen.js`, `LoginScreen.js`, and `SplashScreen.js`.

---

## [3.7.0] - 2026-03-31

### Fixed
- **Rebalancing decryption bug**: `checkValidApiAnSecret` in `RebalanceAdvices.js` and `RebalanceModal.js` lacked try-catch error handling and returned `undefined` on empty decryption instead of falling back to original value. Replaced local implementations with `defaultDecrypt` from `rebalanceHelpers.js` which has proper error handling and fallback logic. This affected brokers requiring decrypted API keys: Upstox, ICICI Direct, Hdfc Securities, Kotak, Motilal Oswal.
- **Kotak/Motilal Oswal missing decryption in rebalanceHelpers**: `buildBrokerPayloadFields()` was sending raw encrypted API keys for Kotak (`consumerKey`, `consumerSecret`) and Motilal Oswal (`apiKey`). Now uses `decrypt()` to match prod web app.
- **Axis Securities field names**: `buildBrokerPayloadFields()` was sending `{authToken, subAccountId}` but prod sends `{accessToken}`. Aligned with prod.
- **Motilal Oswal URL slug**: `ProcessTrades.js` used `'motilal'` but backend expects `'motilal-oswal'`. Orders would 404. Fixed to match prod.
- **GTT broker filtering**: `ProcessTrades.js` was routing ALL brokers' GTT orders to the GTT endpoint. Prod only routes Upstox and Zerodha. Other brokers' GTT-flagged orders now go through regular `/process-trades` endpoint.
- **`isRebalanceErrorResponse(null)` logic inversion**: Mobile returned `true` for null, prod returns `false`. Aligned with prod.
- **MultiBrokerContext selectedBroker default**: Was `null` (causing empty holdings on first load), prod uses `'ALL'`. Fixed to match prod, `getSelectedBrokerHoldings()` now returns aggregated holdings when `'ALL'`.
- **Axis Securities missing from brokerSupport.js**: Added Axis Securities config with Market/Limit order support and name aliases.
- **brokerAuth.js missing `encodeURIComponent`**: OAuth state parameter was not URL-encoded in Angel One login URLs, could break if base64 contains `+`, `/`, `=`. Added `encodeURIComponent()` to match prod.
- **Config.js missing variants**: Added `alphaquark` and `rgxresearch` variants that were referenced throughout the codebase but missing from `Config.js`, causing "Cannot read property 'logo' of undefined" crash on app launch.
- **formatCurrency case mismatch**: Renamed `formatcurrency.js` → `formatCurrency.js` to match import casing across the codebase.
- **SignupScreen missing dependency**: `react-native-elements` was not installed but imported in `SignupScreen.js`. Installed the package.
- **SVG import path**: Fixed broken import `../LandingPage/assests/logo.svg` → `../assets/logo.svg` in `Config.js`.

### Changed
- **Version bumped**: `versionCode` 36→37, `versionName` 3.6.0→3.7.0 to match Play Store version and suppress false "Update Available" modal.
- **New Architecture enabled**: Set `newArchEnabled=true` in `gradle.properties` (required by `react-native-reanimated`).
- **Java home path**: Updated `org.gradle.java.home` from openjdk@17/17.0.16 to 17.0.17 in `gradle.properties`.

### Added
- **Architecture documentation**: Created `docs/BROKER_CONNECTION.md`, `docs/REBALANCING.md`, `docs/MODEL_PORTFOLIO.md` with detailed flow diagrams and per-broker details.
- **CLAUDE.md**: Created project orchestration file linking all architecture documents.
- **CHANGELOG.md**: This file — tracking all changes going forward.

---

## [3.6.0] - 2026-03-26 (Previous)

### Added
- Sync updates from RGX: auth improvements, MP performance, config, bespoke features
- IIFL/Kotak modal improvements
- Security token management
- Dependency upgrades
- Dummy broker flow aligned with prod
- DDPI support
- Multi-broker context (`MultiBrokerContext.js`)
- Broker auth utilities (`brokerAuth.js`)
- Broker publisher utilities (`brokerPublisher.js`)
- Portfolio events (`portfolioEvents.js`)
- Rebalance helpers (`rebalanceHelpers.js`)
- Process trades utilities (`ProcessTrades.js`)

---

## Changelog Format

Each entry follows:
```
## [version] - YYYY-MM-DD

### Added (new features)
### Changed (modifications to existing features)
### Fixed (bug fixes)
### Removed (removed features)
### Security (security-related changes)
```

