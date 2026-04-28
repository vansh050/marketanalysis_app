# Broker Connection Architecture

> **Last updated**: 2026-04-23 (scripmaster disambiguation for Zerodha & HDFC + centralized MARKET→LIMIT-IOC + new reusable DDPI/EDIS help module — see corresponding sections at the end of this doc)

## Overview

The app supports 14 stock brokers with two authentication patterns:

1. **OAuth/WebView**: Zerodha, Upstox, Fyers, Axis, Motilal Oswal, ICICI Direct, AliceBlue, Angel One, HDFC Securities, **Dhan** (as of 2026-04-07)
2. **Credential-form only**: Kotak, IIFL Securities, **Groww** (as of 2026-04-20 — migrated from partner OAuth to API-Key + API-Secret + per-customer IP whitelist)

### Broker picker display config

Which brokers appear in `BrokerSelectionModal` (and in what order) is driven by `src/config/brokerDisplayConfig.js` — a plain array of `{ name, key, logo }` entries. `BrokerSelectionModal.js` imports it as `brokersmain`; adding/removing/reordering a broker in the picker is a one-line edit in the config, no component changes needed. The `key` on each entry must match the key dispatched by `GlobalUIModals/ModalManager.js` (that is what `openModal(key)` routes on).

**Angel One is currently hidden from the picker** (commented-out in the config as of 2026-04-21). All Angel One auth plumbing (`AngleoneBookingModal`, `ModalManager` case, `registerCallback('angelone', ...)` in `handleBrokerSelect`, backend routes) is intact — re-enabling Angel One is purely uncommenting its entry in `brokerDisplayConfig.js`. Existing users with an Angel One connection continue to work; only the "Connect new broker" picker hides the tile.

## Authentication Flows

### OAuth Flow (Mobile-Specific)

Unlike the web app which uses browser redirects, the mobile app uses **in-app WebView** for OAuth:

```
User taps "Connect" for OAuth broker
    │
    ▼
BrokerConnectionModal/<BrokerName>Modal.js
    │  Sends API key/secret to Node.js backend
    │  PUT /api/zerodha/update-key (or broker-specific endpoint)
    │
    ▼
Backend calls Python: POST /{broker}/login-url
    │  Returns OAuth URL
    │
    ▼
WebView opens with OAuth URL
    │  handleWebViewNavigationStateChange() monitors URL
    │  Intercepts redirect URL containing auth_code/request_token
    │
    ▼
Frontend extracts token from URL query params
    │  POST /{broker}/gen-access-token
    │
    ▼
Token stored → broker status → "connected"
    brokerSessionUtils.saveBrokerSessionTime(broker)
```

### Credential Flow

```
User fills credentials form
    │
    ▼
PUT /api/user/connect-broker
    { broker, clientCode, jwtToken/apiKey/secretKey, ... }
    │
    ▼
Backend validates with Python, stores encrypted credentials
    │
    ▼
Returns success → Toast → Context updated
```

## Per-Broker Details

| Broker | Auth | Credentials | Token Expiry | WebView | Special Notes |
|--------|------|-------------|--------------|---------|---------------|
| Zerodha | OAuth | apiKey, secretKey | Daily ~6AM | Yes | Kite Publisher SDK, GTT/OCO support |
| Angel One | OAuth (nonce) | apiKey (from config) | ~24h | Yes | Surveillance check, EDIS/TPIN |
| Upstox | OAuth PKCE | apiKey, secretKey | ~24h | Yes | GTT, OCO support |
| ICICI Direct | OAuth | apiKey, secretKey | Session | Yes | Manual mandate for SELLs |
| Kotak | Credential | ucc, apiKey (API Access Token), mobile, mpin, totp | ~1h | No | Single UUID "API Access Token" from NEO → TradeAPI → API Dashboard. TOTP required on every reconnect. **No separate Consumer Secret** — aligned with web 2026-04-22. All downstream payloads (`kotak/order-book`, `kotak/order-cancel`, `kotak/positions`, `kotak/holdings`, `kotak/all-holdings`, `kotak/funds`, rebalance, ProcessTrades, MP/Bespoke performance, basket run) send `consumerKey` (= UUID) + `accessToken` + `viewToken` + `sid` + `serverId`; **no `consumerSecret`** field is sent anywhere. The ccxt `/kotak/v2/modify-order` endpoint was also realigned 2026-04-22 to match this shape (previously read `credentials.secretKey` and had inverted field mapping — see CHANGELOG 3.9.5). |
| Dhan | **OAuth (WebView)** | clientCode, jwtToken | Session (30 days) | **Yes** | Primary: CCXT partner OAuth; Fallback: manual credential form. DDPI/TPIN for sells. |
| Fyers | OAuth | clientCode, secretKey | Session | Yes | Publisher SDK, TPIN |
| Groww | **Credential + IP whitelist** | apiKey, totp_seed (Base32 secret stored server-side) | Daily 6 AM IST reset, one-tap refresh | No | **Migrated 2026-04-20 from partner OAuth → approval-mode; then 2026-04-21 approval-mode → TOTP-seed; then 2026-04-22 parsing hardening; then 2026-04-23 UX copy fix — see § Groww TOTP seed capture — which value to paste.** Groww deprecated partner-API order placement in 2026-04; the supported path is user-created **API Key + Base32 TOTP seed** via Groww's "Generate TOTP token" dialog on `groww.in/trade-api/api-keys` (not "Generate API Key & Secret"). The seed is the ~32-character Base32 string shown BELOW the QR code in that dialog — the `secret=` param encoded in the otpauth URI. **It is NOT the long JWT-style value in the "TOTP Token" field at the top of the same dialog** (that's a Groww-internal display token, not usable by us). Users paste the Base32 seed into the mobile form, backend AES-256-CBC-encrypts it server-side, and the daily cron mints fresh access tokens by calling `pyotp.TOTP(seed).now()` to produce a 6-digit code, then POSTing `{key_type:'totp', totp:'<6-digit>'}` to Groww's `/v1/token/api/access`. Requires a dedicated Route64 IPv6 whitelisted in Groww's "Whitelisted IPs" field. Dropped from `TokenExpireBrokerModal.OAUTH_BROKERS`; session-expired users see a "Refresh Groww session" button that one-tap calls `/api/groww/refresh-token`. Legacy (pre-2026-04-21) builds that still POST `secretKey` are auto-routed through the approval-mode fallback by ccxt-india's `_mint_groww_approval_mode`. |
| AliceBlue | OAuth (WebView) | clientCode, apiKey | 24h | Yes | Intercepts callback URL with access_token param |
| Motilal Oswal | OAuth (WebView) | clientCode, apiKey | Session | Yes | **Strict session affinity — see § Motilal session-affinity guard (2026-04-25).** WebView retry-on-error is gated: pre-load failures (DNS / IPv6 race) auto-retry once; post-load failures show "Restart connection" instead of silent reload (reload would rotate Motilal's session and invalidate any OTP / login the user already entered, surfacing as `Authorization is Invalid In Header Parameter` or `MO1007 Two Factor Authentication Failed`). 30s debounce on `/motilal-oswal/login` to stop spam-Connect from creating session N–1 / N OTP mismatch. |
| Axis Securities | OAuth (WebView) | None (SSO) | Session | Yes | ssoId intercepted in WebView; funds fetching via `axis/funds` (accessToken + clientCode). Palette tile + ModalManager dispatch added 2026-04-20 — all backend plumbing (`brokerAuth`/`brokerSupport`/`ProcessTrades`/`fetchFunds`/registry/modal) was already in place; only the `brokersmain` entry + `ModalManager` `case` + `axis.png` asset were missing. |
| Hdfc Securities | OAuth (WebView) | requestToken→accessToken | Session | Yes | 2-step: WebView→CCXT token exchange |
| IIFL Securities | Credential | clientCode, jwtToken | Session | No | — |
| DummyBroker | None | None | Never | No | **Not a real broker — sentinel for the "no broker" / "manually placed" flow.** Shared with web (`prod-alphaquark-github/src/Home/ModelPortfolioSection/DummyBrokerHoldingConfirmation.js`), not mobile-only. See "DummyBroker Flow" below. |

## Key Files

| File | Purpose |
|------|---------|
| `src/utils/brokerAuth.js` | OAuth state generation, callback registration |
| `src/utils/brokerSupport.js` | Per-broker feature matrix (order types, GTT, OCO) |
| `src/utils/brokerPublisher.js` | Kite/Fyers publisher SDK integration |
| `src/context/MultiBrokerContext.js` | Multi-broker state (holdings, funds, errors) |
| `src/components/BrokerConnectionModal/` | 15 per-broker auth modal components |
| `src/UIComponents/BrokerConnectionUI/HelpUI/LinkifiedUrl.js` | Inline URL helper for broker-help screens — renders a URL as a tap-to-open + tap-to-copy `<Text>` chain with a `react-native-toast-message` confirmation. Shared by all `HelpContent.js` files, `HelpModal.js` (legacy modal), and `EgressIpCallout.js` dev-portal link. Uses the same runtime-global `Clipboard` pattern as `MotilalConnectUI` / `KotakConsumerKeySteps` with a long-press-to-select fallback on RN 0.78 where core `Clipboard` is dropped |
| `src/components/BrokerSelectionModal.js` | Broker picker grid — reads `brokerDisplayConfig` for which tiles to render and in what order |
| `src/config/brokerDisplayConfig.js` | Display-order config for the broker picker (see "Broker picker display config" above) |
| `src/config/brokerRegistry.js` | Auth-type + credential-field metadata per broker (orthogonal to display config) |
| `src/screens/Home/ManageConnectionsModal.js` | Multi-broker connection list — Switch / Remove / **Reconnect** for expired sessions |
| `src/components/TokenExpireBrokerModal.js` | Mid-trade session-expiry modal (OAuth: single "Reconnect {broker}" button; Kotak/IIFL: credential form) |

## Manage Connections (mobile)

Opened from `SubscriptionScreen` ("Manage Connections" button, visible when a broker is connected). Fetches `${server.server.baseUrl}api/user/brokers?email={userEmail}` with advisor subdomain + AQ-encrypted-key headers and lists every entry in `connected_brokers[]`.

**Per-row UI**:
- **Active** badge (green) — `b.broker === currentBroker`.
- **Session Expired** badge (amber, outlined) — `b.status` is `'expired'` or `'error'` (backend enum from `connectedBrokerSchema`).
- **Stored Credentials** badge — otherwise.
- **Re-auth / Reconnect** button — shown on **every** row regardless of status, matching web `/subscriptions` where every broker card has a Re-auth button. Label is "Reconnect" (solid amber) when expired; "Re-auth" (blue outline) otherwise. Both go through the same smart-reauth router — see *Smart re-auth routing* below.
- **Switch** button — shown for non-active, non-expired rows. `PUT /api/user/brokers/{broker}/primary` sets that broker as primary.
- **Remove** button — `DELETE /api/user/brokers/{broker}` drops the stored credentials/session. Available in all states.
- **+ Connect new broker** CTA — dashed outline button above the list. Fires the `onAddBroker` callback which `SubscriptionScreen` wires to close Manage Connections and open `BrokerSelectionModal`. Lets users add a 2nd/3rd broker without leaving Settings (previously the "Connect Broker" CTA only appeared when zero brokers were connected).

**Backend name → ModalManager key map** (defined in `ManageConnectionsModal.js:BROKER_MODAL_KEY_MAP`, must stay in sync with `GlobalUIModals/ModalManager.js`):

| Backend `connected_brokers[].broker` / `user_broker` | `openModal` key |
|---|---|
| `Angel One` | `'Angel One'` (+ `registerCallback('angelone', '/stock-recommendation')` before dispatch) |
| `AngelOne` (alt writer — some code paths persist without space) | `'Angel One'` |
| `Zerodha` / `Upstox` / `Kotak` / `Dhan` / `Fyers` / `AliceBlue` / `Groww` | same |
| `Kotak Neo` (written by `KotakModal.js` on successful connect) | `'Kotak'` |
| `ICICI Direct` | `'ICICI'` |
| `Hdfc Securities` | `'HDFC'` |
| `Motilal Oswal` | `'Motilal'` |
| `Axis Securities` | `'Axis Securities'` |
| `IIFL Securities` | `'IIFL'` |

**Name-map is duplicated in three places** — all three must be updated together:
- `src/screens/Home/ManageConnectionsModal.js:BROKER_MODAL_KEY_MAP` — Manage Connections per-row Reconnect/Re-auth button.
- `src/utils/reauthHelpers.js:BROKER_MODAL_KEY_MAP` — smart re-auth router.
- `src/components/BrokerSelectionModal.js:USER_BROKER_TO_MODAL_KEY` — mid-trade TokenExpire modal's "Login to {broker}" button (added 2026-04-23; before that this path silently no-opped for ICICI Direct / Kotak Neo / Hdfc Securities / Motilal Oswal / AngelOne because it passed the raw display name into `openModal` and hit `default: return null` in `ModalManager`).

**Parity with web**: matches web's `TokenExpireBrokarModal` pattern where the per-broker Reconnect button directly invokes the broker's auth URL. Mobile's equivalent is the `openModal` dispatch. Prior implementation (2026-04-18) routed through `BrokerSelectionModal` as an intermediate broker-picker step — that detour was removed 2026-04-20 once `IIFL` + `Axis Securities` cases were added to `ModalManager`. The badge + button semantics still match web exactly.

## Motilal session-affinity guard (2026-04-25)

Motilal's OpenAPI binds three things to a single page-load: the OTP delivered to the user's mobile, the `Authorization` header their JS sends to the OTP-verify endpoint (apikey-derived), and the page-side session cookie. **Any one of those rotating mid-flow invalidates the other two.** Reloading the WebView, opening a fresh login URL, or letting the user spam the Connect button all rotate the session — and Motilal's server-side surfaces the rotation as one of two opaque errors:

- `Authorization is Invalid In Header Parameter` — page-side header doesn't match server-side session
- `{"status":"ERROR","message":"Two Factor Authentication Failed","errorcode":"MO1007"}` — OTP submitted is from session N–1 but server is now on session N

These are **not bugs in our payload** — Motilal's server is correctly rejecting a stale request. The user has no way to recover from inside the WebView; Resend OTP creates yet another rotation, deepening the problem.

**Trigger we observed (2026-04-25 production):** A single user fired `/motilal-oswal/login` 4 times in 4 minutes (12:18–12:22 UTC). Sequence: WebView hit `net::ERR_NAME_NOT_RESOLVED` (the IPv6 / DNS race we already auto-retry — see § Per-Broker Details Motilal row), they tapped Retry, got past it, entered credentials, got an OTP — but somewhere in the retry chain Motilal's session got rotated, so the OTP they submitted hit `Authorization Invalid` then `MO1007` on subsequent tries. Three different errors, one root cause.

### Two guards added

**(1) WebView post-load failure isolation** — `src/UIComponents/BrokerConnectionUI/MotilalConnectUI.js:MotilalWebViewWithRetry`

`pageLoadedOnceRef` is set true on the first successful `onLoadEnd`. After that, if `onError` fires, we DO NOT silently `setKey(k+1)` (which would unmount + remount the WebView and rotate the Motilal session). Instead, the wrapper renders a **"Restart connection"** UI explaining that reloading would invalidate the OTP, and offers a single primary CTA that calls `onRequestRestart` on the parent. Pre-load failures (DNS race, network down before Motilal's page even loaded) keep the existing auto-retry-once behaviour because nothing user-facing exists to disrupt yet.

**(2) Connect-button debounce — 30s cooldown** — `src/components/BrokerConnectionModal/MotilalModal.js:initiateAuth`

`lastConnectAtRef` tracks the timestamp of the last `/motilal-oswal/update-key` call. If the user fires Connect again within `_MOTILAL_CONNECT_COOLDOWN_MS = 30 * 1000`, the call is blocked with a `showAlert('warning', 'Please wait', ...)` that names the exact failure modes (`Authorization Invalid` / `Two Factor Authentication Failed`) so support can diagnose by error string. 30s was chosen empirically — Motilal's session state typically settles within ~15–20s after a previous attempt; 30s leaves margin without making the UX feel broken.

The "Restart connection" CTA (guard 1) calls `handleRequestRestart` on `MotilalModal`, which closes the WebView and clears `authUrl` / `jwtToken` / `isToastShown` so the next Connect goes through the full `/motilal-oswal/login` round-trip. The 30s debounce on `initiateAuth` gates the Restart→Connect path too.

### What we did NOT add (deferred)

A page-content sniff to detect Motilal's error pages from inside the WebView (via `injectedJavaScript` + `onMessage`) was considered but deferred — it's fragile (depends on Motilal's HTML never changing) and the two guards above cover the failure mode without touching Motilal's DOM. Revisit only if the 30s debounce + post-load Restart UI prove insufficient in production telemetry.

### Cross-repo

This is mobile-only. The web app's Motilal flow (`prod-alphaquark-github/src/Home/BrokerConnection/Motilal/`) uses `window.location.href` redirects rather than an embedded WebView, so the page-rotation trap doesn't exist — each navigation is a clean session by browser convention. tidi_new (Flutter) uses `webview_flutter` and SHOULD have the same vulnerability — flagged for future audit.

## Pre-trade session probe — `validateBrokerSession` / `classifyFundsResponse` (2026-04-24)

Every order-entry chokepoint (9 sites — see [CHANGELOG 3.9.19 §2](CHANGELOG.md)) calls this pair of helpers before firing the actual trade to the broker. Mirrors tidi_new `lib/utils/broker_session_validator.dart` and prod-alphaquark-github `src/utils/brokerSessionValidator.js` exactly.

**File**: `src/utils/brokerSessionValidator.js`

**Contract**:
```js
const result = await validateBrokerSession({broker, brokerStatus, userDetails, userEmail});
// result.ok === true → proceed
// result.reason ∈ {NOT_CONNECTED, TRANSIENT, TOKEN_EXPIRED, PROBE_FAILED}
// result.message: broker-supplied or synthesized user-facing message
// result.funds: the raw fetchFunds response when one came back
```

`validateBrokerSession` is async — fires its own fetchFunds. Most chokepoints already call `refreshBrokerStatus({forceNetwork: true})` upstream (to force-bypass the stale-cache fast path that caused the Fyers regression — see [CHANGELOG 3.9.19 §1](CHANGELOG.md)) and have fresh funds in hand; those use the sync companion `classifyFundsResponse(funds, brokerStatus, broker)` which returns the same `{ok, reason, message, funds}` shape without a second network round-trip. `validateBrokerSession` internally delegates to `classifyFundsResponse` for DRY.

**Reason routing at chokepoints** (the UX contract the 9 migrated sites agreed on):

| Reason | UX | Example trigger |
|---|---|---|
| `OK` | proceed | broker answered with `status: 0` + `data.availablecash` |
| `TRANSIENT` | soft toast ("{broker} temporarily unavailable — {message}"), no reconnect prompt | Upstox 00:00–05:30 IST maintenance (`UDAPI100072` / `UDAPI100074` or IST-clock fallback for no-keyword `status: 2` bodies), ICICI Breeze base-64 hiccup |
| `TOKEN_EXPIRED` | `setOpenTokenExpireModel(true)` → `BrokerSelectionModal` opens | real auth failure — `status: 1` without transient keyword, or null funds while brokerStatus === 'connected' |
| `NOT_CONNECTED` | `setOpenTokenExpireModel(true)` (treated as expired at chokepoint; upstream gates already caught no-broker-at-all) | brokerStatus !== 'connected' |
| `PROBE_FAILED` | log + let trade proceed (DNS blip; the actual order placement will surface any real issue) | async validator only; network fetch threw |

Previously the 9 sites used the boolean `isFundsErrorOrMissing(funds, brokerStatus, broker)` which collapsed TRANSIENT and TOKEN_EXPIRED into the same reconnect prompt. That misfired as "session expired" during Upstox's nightly maintenance window. The typed helper is what fixes it.

## Session-expired detection — client util + backend daily-reset cron (2026-04-21)

Both `ManageConnectionsModal` (per-row "Session Expired" badge / "Reconnect" button) and `SubscriptionScreen`'s top card ("{broker} Session Expired" state) derive their expired state from a single util:

- **`src/utils/brokerStateUtils.js`** — `isBrokerSessionExpired(entry)` returns true if `entry.status` is `'expired'` or `'error'` OR `entry.token_expire` timestamp is in the past. `getPrimaryBrokerEntry(userDetails)` looks up the primary broker's entry in `connected_brokers[]` (so the top card can show expired state when the primary-broker's session is dead, even if the top-level `connect_broker_status` is still `'connected'`).

On its own, the client util isn't enough for brokers that don't populate `token_expire` with the real daily-reset time — **ICICI** being the canonical offender, where backend `status` stays `'connected'` across the 8 AM IST daily reset. The backend fix lives in `aq_backend_github/CronJob/CronBrokerDailyResetExpiry.js`:

- Runs daily at **5 AM IST** (cron `0 5 * * *` with `timezone: "Asia/Kolkata"`).
- For every advisor database, iterates every user's `connected_brokers[]` and unconditionally flips `status: 'connected'` → `status: 'expired'` with `last_error: 'Daily 5 AM IST reset'`.
- Mirrors into the legacy `connect_broker_status = 'expired'` on the user doc when the primary is among the flipped entries.
- Complements the existing `CronJob/brokerTokenRefresh.js` (30-min `token_expire`-based check) — together they catch both token-timestamp-expired and daily-reset-expired cases.

By the time the mobile app fetches `/api/user/brokers` after 5 AM IST, every broker's `status` is `'expired'` regardless of what it was the previous day. The user re-auths via Manage Connections or SubscriptionScreen's top-card "Re-auth" button; the smart reauth router handles the rest.

## Smart re-auth routing (2026-04-21, extended to BrokerSelectionModal 2026-04-23)

Reached from **three** entry points, all funnelling through the same `flipPrimaryBroker` → `handleSmartReauth` → `openModal(modalKey, { reauthConfig })` chain:

1. `ManageConnectionsModal.handleReconnect` — per-row Reconnect / Re-auth button in Settings.
2. `SubscriptionScreen` top-card "Re-auth" button.
3. `BrokerSelectionModal.handleBrokerSelectOpenExpire` — the mid-trade "Login to {broker}" button that pops up when a user taps Retry Rebalance / Invest / Accept and the primary broker's session has expired. Added 2026-04-23; before that this entry point bypassed the router entirely and just called `openModal(raw user_broker)`, which (a) silently no-opped for `ICICI Direct`/`Kotak Neo`/`Hdfc Securities`/`Motilal Oswal`/`AngelOne` because of the key-mismatch and (b) even for the keys that matched, opened the blank credential form instead of jumping to the OAuth WebView with stored creds. **Groww branch (added 2026-04-23 in same commit as the router wire-up):** detected `broker === 'Groww'` short-circuits before the router and calls `refreshGrowwSession` directly — backend has the TOTP seed, so no WebView or credential paste is needed. Only falls back to `openModal('Groww')` on `NO_TOTP_SEED` / `INVALID_SEED`. Button label and security-note copy flip to "Refresh Groww session" / "Takes about 2 seconds, no credentials needed" for the same broker.

Mirrors web `prod-alphaquark-github/src/Home/Subscriptions/subscription.js:handleCredentialReauth` so that credential brokers with saved API keys skip the credential form on session expiry.

**Post-reconnect state re-hydration (2026-04-23).** Every entry point above ultimately lands in a per-broker modal whose success handler calls `fetchBrokerStatusModal` (from `TradeContext`). That function was rewritten on 2026-04-23 to await `getUserDeatils()` and then synchronously call `fetchFunds` with the fresh user object it returned — bypassing the `useEffect([userDetails, configData])` that previously re-fetched funds. The old effect gated on the stale `broker` state (not a dep) and `getAllFunds` closed over an uncommitted `userDetails` snapshot, so after a reconnect the funds object could remain at its pre-reconnect value. That stale funds state caused `RebalanceCard.handleCheckStatus`' `isFundsErrorOrMissing` check to re-pop the TokenExpire modal on the next Retry Rebalance tap — the infamous "Login to Zerodha loops forever after successful reconnect" bug. Every OAuth broker benefits because they all route through this helper.

**Files**:
- `src/utils/reauthHelpers.js` — `handleSmartReauth`, `flipPrimaryBroker`, `CREDENTIAL_REAUTH_BROKERS` set.
- `src/utils/brokerCredentials.js` — `getStoredBrokerCreds(userDetails, brokerName)` returns plaintext `{ apiKey, secretKey, clientCode }` by reading `connected_brokers[]` and decrypting with the `'ApiKeySecret'` passphrase (same AES-CryptoJS scheme used throughout the codebase).
- `src/GlobalUIModals/modalStore.js` — added optional `modalPayload` field; `openModal(name, payload)` accepts a payload and `closeModal` clears it.
- `src/GlobalUIModals/ModalManager.js` — forwards `modalPayload.reauthConfig` to each per-broker modal as the `reauthConfig` prop.
- `src/components/BrokerConnectionModal/{upstoxModal, icicimodal, HDFCconnectModal, MotilalModal, FyersConnect}.js` — each credential modal now accepts a `reauthConfig` prop. When `isVisible && reauthConfig` (and the hydration hasn't already fired), the modal pre-fills `apiKey/secretKey/clientCode`, sets `authUrl`, and flips `showWebView=true` in one `useEffect`, bypassing the credential form entirely. The per-broker WebView navigation handler, code-exchange, and `connect-broker` save all continue to run unchanged.

**Flow on Reconnect tap**:

1. `ManageConnectionsModal.handleReconnect(brokerName)` looks up `BROKER_MODAL_KEY_MAP[brokerName]`. No modal key → fallback to `onReconnect` parent callback.
2. `flipPrimaryBroker(brokerName, userEmail, configData)` → `PUT /api/user/brokers/{broker}/primary`. Matches web — clicking Reconnect signals intent to make this broker primary, even if the user backs out of the OAuth step that follows.
3. `handleSmartReauth(...)`:
   - If broker ∉ `CREDENTIAL_REAUTH_BROKERS` (i.e., not one of Upstox/ICICI Direct/Motilal Oswal/Hdfc Securities/HDFC Securities/Fyers) → returns `{ handled: false }` and the caller falls through to step 4.
   - Else calls `GET /api/user/brokers/{broker}/reauth-url?email=&redirectUrl=`. Backend uses saved credentials to build the broker's OAuth URL. Returns `{ url }` on success, `{ requiresTotp: true }` for Kotak, `{ requiresForm: true }` for Groww, or error.
   - If `requiresTotp`/`requiresForm`/no-`url` → returns `{ handled: false }` so the caller falls through.
   - If `url` present → decrypts stored creds via `getStoredBrokerCreds(userDetails, brokerName)`. If no local creds (stale `userDetails`), returns `{ handled: false }`.
   - Else → `useModalStore.getState().openModal(modalKey, { reauthConfig: { authUrl, apiKey, secretKey, clientCode } })`. Returns `{ handled: true }`.
4. Fallback path (not handled): Angel-One nonce (if applicable) + `openModal(modalKey)` without payload. User sees the full credential form / OAuth picker as before.

**Fyers naming swap**: Fyers' modal uses `apiKey` state for the OAuth secret and `secretKey` state for the clientId, opposite of its DB storage (`credentials.secretKey` = secret, `credentials.clientCode` = clientId). The hydration `useEffect` in `FyersConnect.js` does the swap internally — the `reauthConfig` payload itself uses DB field names (`apiKey`, `secretKey`, `clientCode`) to stay uniform with the other credential modals and with `getStoredBrokerCreds`.

**What a user sees on session expiry (before vs after)**:

| Broker | Before (every session expiry) | After (2026-04-21) |
|---|---|---|
| ICICI Direct / Upstox / HDFC / Motilal / Fyers | Re-enter API Key + Secret manually | Tap Reconnect → redirected straight into broker OAuth WebView; stored creds reused transparently |
| Kotak | Re-enter mobile + MPIN + TOTP | Unchanged — TOTP required every time (backend returns `requiresTotp`) |
| Groww | Re-enter API Key + Secret | Unchanged — backend returns `requiresForm` |
| Partner OAuth (Zerodha, Angel One, Dhan, AliceBlue, Axis) | OAuth consent flow | Unchanged (these brokers never had a credential form to skip) |

## Credential Encryption

Broker API keys and secrets are encrypted using AES with the key `ApiKeySecret`:

```javascript
// Encrypt (before storing)
CryptoJS.AES.encrypt(value, 'ApiKeySecret').toString()

// Decrypt (before using in API calls)
function defaultDecrypt(value) {
  if (!value) return value;
  try {
    const bytes = CryptoJS.AES.decrypt(value, 'ApiKeySecret');
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || value;  // Falls back to original if decryption fails
  } catch {
    return value;
  }
}
```

## WebView Differences from Web App

The web app (`prod-alphaquark-github`) uses browser-based OAuth redirects:
- Redirect URL: `https://prod.alphaquark.in/stock-recommendation` (or custom domain)
- Uses `window.location.origin` for state generation

The mobile app uses WebView with URL interception:
- Redirect URL configured in `.env` as `REACT_APP_BROKER_CONNECT_REDIRECT_URL`
- WebView `onNavigationStateChange` monitors for redirect
- Some brokers may need different redirect URLs than web

**Important**: Ensure `REACT_APP_BROKER_CONNECT_REDIRECT_URL` in `.env` matches what's configured in each broker's API dashboard.

## Zerodha DDPI / Auth-Sell Credential Handling

**File:** `src/components/DdpiModal.js`

The Zerodha DDPI auth-sell flow requires per-user credentials. The `POST {ccxtServer}/zerodha/auth-sell` request must include:

| Field | Source | Required |
|-------|--------|----------|
| `accessToken` | `userDetails.jwtToken` | Yes |
| `userEmail` | `userDetails.email` | Yes (added 2026-04-05) |
| `X-Advisor-Subdomain` header | `configData.advisorTag` | Yes (added 2026-04-05) |
| `aq-encrypted-key` header | `configData.aqEncryptedKey` | Yes (added 2026-04-05) |

**Why `userEmail` is required**: The backend's `get_zerodha_credentials_with_fallback()` function uses `userEmail` to look up per-user API keys from the database. Without it, the backend falls back to the shared `ZERODHA_API_KEY` environment variable, which may not match the user's registered Zerodha application and causes auth-sell to fail silently or use incorrect credentials.

## Dhan OAuth Flow (2026-04-07)

**Files:** `src/components/BrokerConnectionModal/DhanConnectModal.js`, `src/UIComponents/BrokerConnectionUI/DhanOAuthUI.js`

Dhan now uses OAuth via CCXT partner consent (matching the web app's primary path).

```
User taps "Connect Dhan"
    │
    ▼
DhanConnectModal — oauthMode=true (default)
    │  Opens DhanOAuthUI (WebView)
    │  URL: https://ccxtprod.alphaquark.in/dhan/login
    │
    ▼
CCXT /dhan/login — POST https://auth.dhan.co/partner/generate-consent
    │  Returns consent URL (redirect)
    │
    ▼
WebView → https://auth.dhan.co/consent-login?consentId=...
    │  User logs in on Dhan site (PIN + SMS OTP)
    │
    ▼
Dhan → CCXT /dhan/callback?tokenId=...
    │  CCXT consumes token, gets dhan_client_id + access_token
    │  Redirects to: prod.alphaquark.in/...?dhan_client_id=...&dhan_access_token=...
    │
    ▼
DhanOAuthUI.handleWebViewNavigationStateChange() detects callback URL
    │  Extracts dhan_client_id and dhan_access_token from query params
    │
    ▼
PUT /api/user/connect-broker { uid, user_broker: 'Dhan', clientCode, jwtToken }
    │
    ▼
POST /rebalance/change_broker_model_pf (non-critical)
    │
    ▼
Toast success → context refresh
```

**Fallback**: Tapping "Enter Access Token manually instead" at the bottom of the WebView switches to `DhanConnectUI` (credential form) for users with existing tokens.

**CCXT partner credentials**: `PARTNER_ID = "9ae1131d"`, stored server-side in ccxt-india.  
**IP whitelist note**: The CCXT server IP (`72.61.251.253`) must be whitelisted in Dhan's partner portal for order placement. This is a one-time setup required by Dhan (error code DH-905 if missing).

---

## Web-Parity Alignment Plan (2026-04-17)

**Goal**: make every mobile broker-connection flow match the user-side web flow in `prod-alphaquark-github` — same endpoints, same handshake owner (client vs backend), same credential persistence path. Container (WebView vs full-page redirect) stays mobile-specific; everything else aligns.

### Audit summary

Web references: `src/Home/BrokerConnection/<Broker>/…Connection.js`, `src/Home/LivePortfolioSection/connectBroker.js`, `src/Home/BrokerConnection/AllBrokerList.js`, `src/utils/brokerAuth.js`.

| Broker | Web entry | Handshake owner on web | Mobile entry today | Alignment action |
|--------|-----------|------------------------|--------------------|------------------|
| Zerodha | `PUT /api/zerodha/update-key` (user brings their own Kite Connect apiKey + secretKey) | Backend persists per-user creds; callback completed server-side at `ccxt.alphaquark.in/zerodha/callback` | `ccxt/zerodha/login-url` with advisor-shared `REACT_APP_ZERODHA_API_KEY` (no per-user form) | **Intentional divergence — no change (Option B, 2026-04-17).** Mobile uses one advisor-level Kite Connect app for all clients; web requires each user to register their own app (`developers.kite.trade/apps`). Aligning would force mobile to add an apiKey/secretKey form and break the simpler existing flow. Documented as "mobile variant" rather than resolved. |
| Angel One | `ccxt/angelone/login-url` | Backend | `ccxt/angelone/login-url` | None — already aligned. |
| Upstox | `POST /api/upstox/update-key` → redirect → backend exchange | Backend (full) | `POST /api/upstox/update-key` → WebView → client `upstox/gen-access-token` | **Payload parity fix 2026-04-17:** added `user_broker: 'Upstox'` to request body to match web. Client token exchange stays (inherent on mobile — no landing page). |
| ICICI Direct | `PUT /api/icici/update-key` → `api.icicidirect.com/apiuser/login` → ICICI → `ccxt/icici/auth-callback/{appURL}` → web frontend reads `apisession=` from URL → client-side `icici/customer-details` → `connect-broker` | **Client** (web also does client-side exchange) | **Reverted + fixed 2026-04-21.** Option B (server-side via CCXT) was attempted on 2026-04-17 but broken in three ways: (1) CCXT auth-callback route was POST-only; ICICI redirects via GET → 405. (2) CCXT only relays `apisession` to the web frontend URL — it never does a server-side exchange. (3) Mobile WebView watched for `REACT_APP_BROKER_CONNECT_REDIRECT_URL` which CCXT never redirects to on mobile. Reverted to client-side: WebView detects `apisession=` on ANY URL → `icici/customer-details` → `connect-broker`, matching web app exactly. CCXT `auth-callback` routes now accept GET+POST. Advisors register `https://ccxtprod.alphaquark.in/icici/auth-callback/{subdomain}` OR their web URL — both work. |
| Kotak | `PUT /api/user/connect-broker` (credential form: mobile + MPIN + TOTP) | N/A (no OAuth) | Same | None — already aligned. |
| Dhan | `getDhanLoginUrl()` → full-page redirect (CCXT partner consent) | Backend | `DhanOAuthUI` WebView with same CCXT partner consent | None — already aligned. Mobile keeps the credential-form fallback; web has no fallback. |
| Fyers | `POST /api/fyers/update-key` → redirect | Backend | `POST /api/fyers/update-key` (entry aligned, same payload shape) | **No change needed (verified 2026-04-17).** |
| Groww | `GET ccxt/groww/login/oauth?redirectUri=…` → `window.location.href = response.redirectUrl` | Backend generates redirect URL; client follows | `GET ccxt/groww/login/oauth?redirectUri=…` → `InAppBrowser` + Android App Links callback | **No change needed (verified 2026-04-17).** Earlier "client-side PKCE" assertion was wrong; mobile uses the same backend-generated redirect URL as web. Container (InAppBrowser vs full-page redirect) is inherent. |
| AliceBlue | `handleAliceBlueConnect` in `AllBrokerList.js:55-65` — routes through CCXT backend which records origin in MongoDB for multi-site callback routing | Backend (origin tracking) | `ccxt/aliceblue/login?origin=…&returnPath=…` via `buildAliceBlueAuthUrl()` (matches web) | **Done 2026-04-17.** Replaced hardcoded `https://ant.aliceblueonline.com/?appcode=7WMf5NotZe` with a CCXT-fronted URL that splits `REACT_APP_BROKER_CONNECT_REDIRECT_URL` into `origin` + `returnPath` and passes both as query params. Existing WebView callback interception (`user_broker=AliceBlue`…) unchanged; the final redirect shape is identical. |
| Motilal Oswal | `PUT /api/motilal-oswal/update-key` → redirect | Backend | `PUT /api/motilal-oswal/update-key` (entry already aligned; was missing `user_broker` field in body) | **Done 2026-04-17.** Added `user_broker: 'Motilal Oswal'` to the request body to match web payload shape. |
| Axis Securities | `POST ccxt/axis/login-url` → redirect → Axis redirects with `ssoId` query param → landing page calls `ccxt/axis/callback` client-side → `PUT /api/user/connect-broker` client-side | **Client** (web also does this client-side, not server) | `POST ccxt/axis/login-url` → WebView → intercepts `ssoId`/`spSsoId` → `ccxt/axis/callback` → `PUT /api/user/connect-broker` | **Already aligned in flow; fixed response-parsing bug 2026-04-17.** Web and mobile both exchange `ssoId` client-side — no Option-B shift needed. Mobile was reading the `axis/callback` response as flat fields (`authTokenAxis`, `refreshTokenAxis`) off `.data`; web reads the nested `.data.data` envelope with `authToken.token \|\| authToken` and same for `refreshToken`, and has a `metadata?.accounts?.[0]?.subAccountId` fallback for `subAccountId`. Mobile parsing aligned to web (`StockRecommendation.js:1716-1728`). |
| HDFC Securities | `POST /api/hdfc/update-key` → redirect → client-side `hdfc/access-token` → `PUT /api/user/connect-broker` (landing page, in `StockRecommendation.js:1500-1555`) | **Client** (not backend, contrary to the initial plan) | `POST /api/hdfc/update-key` → WebView → intercept `requestToken` → client-side `hdfc/access-token` → `PUT /api/user/connect-broker` | **Done 2026-04-17 — payload parity only.** On audit, web also exchanges `requestToken → accessToken` client-side (same flow as mobile), so no Option-B shift was needed. Two payload fields aligned: (1) added `user_broker: 'Hdfc Securities'` to `update-key` body (matching `connectBroker.js:778-783`), (2) added `user_email` to `hdfc/access-token` body (matching `StockRecommendation.js:1510-1515`). No UI/flow change. |
| IIFL Securities | **Not implemented** on web (commented out in `AllBrokerList.js`) | N/A | Credential form (clientCode + jwtToken) | **Keep mobile as-is.** Removing an active broker without a product decision is destructive. Flagged for product review. |
| DummyBroker | Present on web (`Home/ModelPortfolioSection/DummyBrokerHoldingConfirmation.js`) — same sentinel flow | Already aligned | Endpoint/payload parity | Keep. **Corrected 2026-04-17**: previous "mobile-only" label was wrong. See "DummyBroker Flow" section below. |

### Inherent container differences (cannot be aligned away)

- Web: full-page `window.location.href` redirect; callback parsed from `window.location.search` on the landing page.
- Mobile: `<WebView>` (or `InAppBrowser` for Groww) + `onNavigationStateChange` URL interception.
- Final-callback detection on mobile is always the app URL registered in `REACT_APP_BROKER_CONNECT_REDIRECT_URL`; that env var MUST match what's registered in each broker's developer console. This is the same constraint web has, just enforced client-side.

### Files to touch (per broker)

| Broker | Files |
|--------|-------|
| Zerodha | `src/UIComponents/BrokerConnectionUI/ZerodhaConnectUI.js` |
| Fyers | `src/components/BrokerConnectionModal/FyersConnect.js`, `src/UIComponents/BrokerConnectionUI/FyersConnectUI.js` |
| Motilal | `src/components/BrokerConnectionModal/MotilalModal.js`, `src/UIComponents/BrokerConnectionUI/MotilalConnectUI.js` |
| ICICI Direct | `src/components/BrokerConnectionModal/icicimodal.js` |
| Groww | `src/UIComponents/BrokerConnectionUI/GrowwConnectUI.js`, `GrowwConnectUI1.js`, `src/components/BrokerConnectionModal/GrowwConnectModal.js`, `src/utils/brokerAuth.js` |
| AliceBlue | `src/UIComponents/BrokerConnectionUI/AliceBlueConnectUI.js`, `src/components/BrokerConnectionModal/AliceBlueConnect.js` |
| Axis | `src/components/BrokerConnectionModal/AxisConnectModal.js` |
| HDFC | `src/components/BrokerConnectionModal/HDFCconnectModal.js`, `src/UIComponents/BrokerConnectionUI/HDFCConnectUI.js` |
| Upstox (audit only) | `src/components/BrokerConnectionModal/upstoxModal.js`, `src/UIComponents/BrokerConnectionUI/UpstoxConnectUI.js` |

### Out of scope (this plan)

- Order execution / `ProcessTrades.js` / broker order-book APIs — separate "execution parity" effort.
- Backend (`aq_backend_github`, `ccxt-india`) — no changes needed; all endpoints this plan references already exist server-side (web uses them).
- IIFL removal — product decision pending.

### Sequencing

Ordered by risk (low → high). Each broker in its own commit so regressions are bisectable:

1. **Zerodha, Fyers, Motilal** — single-endpoint swap (`ccxt/X/login-url` → Node `update-key`). Low risk.
2. **Upstox audit** — payload-shape parity verification.
3. **ICICI Direct, Axis** — stop client-side handshake interception; let server callback complete. Medium risk; needs dev-dashboard callback URI check per broker.
4. **AliceBlue** — origin-tracking entry switch. Medium risk.
5. **HDFC** — backend-persistence path switch; may need backend finalize endpoint audit. Medium-high risk.
6. **Groww** — PKCE removal + entry switch. Highest risk; needs Groww dashboard redirectUri verification before shipping.
7. Finalize: rewrite the top half of this doc to describe only the aligned flows, remove the per-broker divergence notes that are resolved.

---

## DummyBroker Flow (web-parity, both platforms)

**DummyBroker is a sentinel value, not a broker connection.** It's the shared marker both web and mobile use when a user proceeds through the trade/rebalance flow without connecting a real broker (either "Continue without broker" in the broker-selection modal, or "manually placed" for individual bespoke trades). No OAuth, no credentials, no WebView — it exists only as a string value that the backend recognizes and routes to stored-data fallbacks instead of live broker APIs.

### What triggers DummyBroker mode

**Rebalance flow**: User clicks "Continue without broker" in `BrokerSelectionModal`.
- Web: `connectBroker.js:898-940` `handleContinueWithoutBroker`
- Mobile: `StockAdvices.js:2129` `handleContinueWithoutBrokerBespoke`
- Both: `PUT ${ccxtServer}comms/no-broker-required/save` with `{ userEmail, noBrokerRequired: true }` — persists the decision server-side.

**Bespoke "manually placed"**: User marks individual stock trades as already placed outside the app.
- Web: `StockRecommendation.js` + `connectBroker.js:946-980` `handleConfirmManuallyPlaced`
- Mobile: `StockAdvices.js` `handleConfirmManuallyPlaced`
- Both: `PUT api/recommendation { uid: tradeId, trade_place_status: 'manually_placed' }`.

### DummyBrokerHoldingConfirmation — aligned endpoint-for-endpoint

| Step | Endpoint + payload | Web file:line | Mobile file:line |
|------|--------------------|---------------|-------------------|
| 1. Record trades | `POST ${ccxtServer}rebalance/process-trade` with calculated buy/sell rows, `user_broker: 'DummyBroker'` | DummyBrokerHoldingConfirmation.js:114-116 | DummyBrokerHoldingConfirmation.js:125-126 |
| 2. Update execution status | `PUT ${ccxtServer}rebalance/update/subscriber-execution` with `{ userEmail, modelName, model_id, executionStatus: 'executed', user_broker: 'DummyBroker' }` | :119-145 | :130-165 |
| 3. Retry status update on failure | Same payload, 2s delay, once | :132-153 | :143-165 |
| 4. Enroll in poll queue | `POST ${ccxtServer}rebalance/add-user/status-check-queue` with `broker: 'DummyBroker'` | :155-169 | :167-181 |
| 5. Emit refresh event | `HOLDINGS_REFRESH` (mobile: `portfolioEvents.emit`; web: equivalent) | :171-175 | :183-187 |
| 6. Call `getRebalanceRepair()` | — | :177 | :189 |
| 7. Success toast | "Rebalance recorded successfully!" (3s) | :179 | :191 |
| 8. Delayed resync (2s + 5s) | `getModelPortfolioStrategyDetails()` twice | :193-194 | :201-202 |

### Rebalance calculate

`POST ${ccxtServer}rebalance/calculate` with `userBroker: "DummyBroker"`, `userFund: "0"`.
- Web: `RebalanceCard.js:432-433` (auto-fallback when no broker/funds) and `:545-555` (explicit withoutBroker branch).
- Mobile: equivalent guard in `RebalanceModal.js:375-444`. Mobile also adds an "already aligned" auto-execute optimization (when `dataArray.length === 0` and buy/sell both empty, it skips the confirmation modal and records empty trades directly) — this is a mobile-only UX enhancement, not a divergence to unwind.

### What looks divergent but is intentional (platform-specific)

- Toast library: `react-hot-toast` (web) vs `react-native-toast-message` (mobile). Wording is platform-appropriate ("Refresh the page" vs "Pull to refresh").
- Success-toast styling: web sets explicit `style`/`iconTheme`; mobile uses default toast theme.
- Header value source: web pulls `X-Advisor-Subdomain` from `process.env.REACT_APP_URL`; mobile from `configData?.config?.REACT_APP_HEADER_NAME`. Functionally identical.

### Verdict

**DummyBroker is already functionally aligned between web and mobile** — same endpoints, same payload shapes, same retry logic, same refresh cadence. No code changes warranted. The `BROKER_CONNECTION.md` entry that previously called it "mobile-only simulation" was wrong; corrected 2026-04-17.

## Per-customer egress IP contract — `user_email` at payload top level (2026-04-20)

The ccxt-india server (`ccxt-india/common/egress_registry.py → request hook`) resolves the outbound source IP from the request body. For whitelist-enforcing brokers (Upstox, ICICI, Kotak, Hdfc, Motilal, IIFL, AliceBlue), the ccxt request must originate from the customer's Route64-assigned IPv6. Without `user_email` at the **top level** of the request body, the hook falls back to `cid=None` and binds the shared `72.61.251.253` — rejected by the broker with errors like Upstox's `UDAPI1154 — static IP does not match request origin IP`.

**Contract:** any request body that produces an outbound broker call on behalf of a specific customer must carry `user_email` at the top level. The hook also accepts legacy camelCase `userEmail` for backwards compatibility — new code uses snake_case `user_email` to match the web-side canonical contract (`prod-alphaquark-github/docs/TRADE_RECOMMENDATION_ARCHITECTURE.md §7.3.1–7.3.2`).

### `/api/process-trades/order-place` — trade/basket payloads

Node backend's `Routes/Broker/ProcessTrades.js → createPayload()` forwards the top-level `user_email` into every per-broker body it constructs for ccxt-india. Callsites in the app:

| File | Function | Path |
|---|---|---|
| `src/utils/ProcessTrades.js` | `createPlaceOrderFunction` + GTT helper | basePayload + gttTrades (already carried `user_email` since earlier port) |
| `src/components/AdviceScreenComponents/StockAdvices.js` | `placeOrder → getOrderPayload` | GTT + regular basePayload — **added `user_email: userEmail` 2026-04-20** |
| `src/components/AdviceScreenComponents/AddtoCartModal.js` | `placeOrder → getOrderPayload` + 2nd `getOrderPayload` (cart-path) | basePayload + cartItems payload — **added 2026-04-20** |
| `src/screens/Drawer/IgnoreTradesScreen.js` | `placeOrder → getOrderPayload` | basePayload — **added 2026-04-20** |

### Scope of this section

This section covers trade/basket payloads only (commit ea970e4 on web, ported here as B1). See the follow-up subsection for B2 (finish-connection).

### Finish-connection endpoints — `gen-access-token` / `iifl/login/client` / `hdfc/access-token` (B2)

Ports web commit `d3f9078`. After a broker OAuth WebView completes and the app intercepts the callback, it fires a "finish connection" POST to ccxt-india to exchange the short-lived auth code/request token for a longer-lived access token. That outbound call is proxied by ccxt-india to the broker's API and therefore needs to originate from the customer's whitelisted IPv6 — otherwise ICICI rejects it as a Status:500 session-mismatch disguised as HTTP 200, Upstox's `/v2/login/authorization/token` may 401, Fyers/IIFL/HDFC similarly fail with "IP not whitelisted" variants.

Per web's callsite inventory, the 7 endpoints needing top-level `user_email`: `/zerodha/gen-access-token`, `/upstox/gen-access-token`, `/fyers/gen-access-token`, `/hdfc/access-token`, `/iifl/login/client`, `/icici/customer-details` (restored 2026-04-21 — client-side exchange, same as web), `/aliceblue/login` (no POST site on app; AliceBlue uses a WebView redirect URL, not a body POST — skipped).

**App callsites patched 2026-04-20 (B2):**

| Broker | Endpoint | File | Notes |
|---|---|---|---|
| Zerodha | `/zerodha/gen-access-token` | `src/UIComponents/BrokerConnectionUI/ZerodhaConnectUI.js` | step-1 access-token exchange |
| Zerodha | `/zerodha/gen-access-token` | `src/UIComponents/BrokerConnectionUI/HelpUI/ZerodhaConnectModal.js` | help-content variant |
| Zerodha | `/zerodha/gen-access-token` | `src/screens/Drawer/IgnoreTradesScreen.js` | ignored-trades re-auth path |
| Zerodha | `/zerodha/gen-access-token` | `src/screens/Broker/BrokerAuthScreen.js` | generic OAuth WebView (Zerodha branch) |
| Zerodha | `/zerodha/gen-access-token` | `src/components/AdviceScreenComponents/StockAdvices.js` | advice-screen connectZerodha |
| Upstox | `/upstox/gen-access-token` | `src/components/BrokerConnectionModal/upstoxModal.js` | modal connectUpstox |
| Fyers | `/fyers/gen-access-token` | `src/components/BrokerConnectionModal/FyersConnect.js` | modal connectFyers |
| Fyers | `/fyers/gen-access-token` | `src/screens/Broker/BrokerCredentialScreen.js` | generic credential screen (Fyers branch) |
| IIFL | `/iifl/login/client` | `src/components/iiflmodal.js` | WebView callback postback |
| IIFL | `/iifl/login/client` | `src/components/iiflproceedmodal.js` | proceed-modal postback |
| HDFC | `/hdfc/access-token` | `src/components/BrokerConnectionModal/HDFCconnectModal.js` | **already had `user_email`** (ported earlier with 2026-04-18 HDFC payload-parity fix — no change) |

**Groww intentionally skipped.** Prod migrated Groww from partner OAuth to API-key + IP whitelist (commits 9ee7aed + 635b6ef, 2026-04-20). That migration is tracked separately on the app (tasks G1 + G2). Today's B2 would have added `user_email` to a code path that's being retired in the next commit pair.

**Follow-up:** B3 — `user_email` on `angelone/verify-edis` — web commit `e8b83eb`.

## Groww TOTP seed capture — which value to paste (2026-04-23)

**The field name collision that burned real users.** Groww's "Generate TOTP token" dialog shows **two distinct strings**, both confusingly adjacent to the QR code:

| Where in Groww's dialog | What it actually is | Can we use it? |
|---|---|---|
| Field labelled **"TOTP Token"** at the top (`eyJraWQi…` ~400 chars) | A JWT Groww mints as a display/activation token. Contains base64url chars (`-`, `_`, `0-9`) — fails Base32 validation. | **No.** |
| The **~32-character string shown below the QR code** (e.g. `HYSRYAALJ3NPKVQH2K4VW4FQH4AKEENP`) | The Base32 TOTP seed — the `secret=` param encoded in the otpauth URI of the QR. A-Z and 2-7 only. | **Yes — this is what we store.** |

**Why we need the seed, not the JWT or the 6-digit code.** Per [`groww.in/trade-api/docs/curl`](https://groww.in/trade-api/docs/curl), Groww's `POST /v1/token/api/access` expects `{key_type: 'totp', totp: '<6-digit-code>'}`. To mint a fresh access token every morning at 6 AM IST without human intervention, we need to generate that 6-digit code server-side — which requires the **seed** so `pyotp.TOTP(seed).now()` can produce the current code. If we only had the JWT (static) or a one-off 6-digit code (30-second window), we couldn't regenerate.

**What the client collects (as of 2026-04-23).** The form field in `GrowwConnectModal.js` and `brokerRegistry.js` is labelled **"TOTP Secret Key (Base32)"** specifically to break the naming collision with Groww's dialog. Step 2 of the instructions explicitly contrasts the JWT vs the Base32 secret and shows the example value. `NOT_BASE32` / `WRONG_LENGTH` / `GROWW_REJECTED` / `INVALID_SEED` error toasts all now explain the distinction so a user who pastes the JWT gets told exactly what to correct.

**Backend validation** (ccxt-india `app_groww.py:_normalize_totp_token`) strips whitespace and rejects non-Base32 chars with `error_code: NOT_BASE32`. Then rejects lengths outside Groww's min with `WRONG_LENGTH`. Then calls `pyotp.TOTP(seed).now()` and posts to `/v1/token/api/access` — any 4xx response is surfaced as `GROWW_REJECTED`.

**Historical note.** This was documented only implicitly in the migration section below until 2026-04-23, when a user pasted the JWT (because the app's instructions said "TOTP Token", matching Groww's field label exactly) and got the `NOT_BASE32` toast with a message that repeated "TOTP Token", sending them in circles. Fix shipped as `[3.9.14]`.

---

## Groww migration — OAuth → Credential + IP whitelist (2026-04-20)

Ports web commits `9ee7aed` (OAuth → credential), `1b090e3` (finalize on plain API Secret, not 6-digit TOTP — Groww's dashboard actually exposes two opaque strings, not a TOTP QR for approval-mode keys), and the Groww-relevant parts of `e73bd81` (kill remaining partner-OAuth entry points after migration). Web's intermediate `635b6ef` live-TOTP experiment was reverted same-day; the app jumps straight to the end state without the intermediate commit.

### Why
Groww deprecated partner-API order placement in 2026-04. The new supported path is **approval-mode keys**: each user creates their own API Key + API Secret at [`groww.in/trade-api/api-keys`](https://groww.in/trade-api/api-keys), choosing the "API Key & Secret" option (not "Access Token"). The backend SDK uses the secret to compute an HMAC-signed timestamp that Groww verifies to mint a daily access token. Access tokens reset at **6 AM IST daily** — users must re-approve the session each morning before reconnecting here.

Additionally, Groww requires the outbound request to originate from a **whitelisted IP**. We assign each customer a dedicated Route64 IPv6 via the existing egress registry and gate submit behind the `EgressIpCallout` acknowledgment (same contract as Upstox/ICICI/HDFC/Motilal/IIFL/Fyers/Kotak).

### App-side changes

| File | Change |
|---|---|
| `src/components/BrokerConnectionModal/GrowwConnectModal.js` | **Full rewrite.** Dropped the InAppBrowser OAuth flow (`InAppBrowser.openAuth` + Linking deep-link race + `handleGrowwCallbackUrl`). New layout: `EgressIpCallout` at top (gates submit via `egressReady` + `unmetAck`), 4-step scrollable instructions (open Groww portal → create approval-mode API Key + Secret → whitelist the dedicated IP → paste credentials), two `TextInput`s (API Key + API Secret). `handleSubmit` AES-encrypts both with `'ApiKeySecret'` (symmetric with every other credential broker — backend `checkValidApiAnSecret()` decrypts) and POSTs `{uid, user_email, user_broker: 'Groww', apiKey, secretKey}` to `${server}api/groww/update-key`. Uses `react-native-crypto-js` (existing dep), `showAlert` from the global modal store for toasts. `CrossPlatformOverlay` container retained. |
| `src/components/BrokerConnectionModal/EgressIpCallout.js` | Added `'groww'` to `WHITELIST_BROKERS`, plus `BROKER_DISPLAY_NAMES['groww'] = 'Groww'`, `BROKER_DEV_PORTAL_URLS['groww'] = 'https://groww.in/trade-api/api-keys'`, `BROKER_WHITELIST_HINT['groww'] = 'Trade API → Create API Key + Secret → Whitelisted IPs'`. |
| `src/components/TokenExpireBrokerModal.js` | Removed `'Groww'` from `OAUTH_BROKERS`. **Added a `handleGrowwReconnect` handler + `broker === 'Groww'` button** that dispatches `useModalStore.getState().openModal('Groww')` — the RN equivalent of web `e73bd81`'s `aq:open-broker-connect` DOM event pattern. Without this, Groww users with expired sessions would see the modal render neither the OAuth button nor a credential form, and get stuck. |
| `src/config/brokerRegistry.js` | Groww `authType: OAUTH → CREDENTIAL`. Added `fields: [{apiKey}, {secretKey}]` for any generic registry-driven renderer. Inline comment records the rationale. |
| `src/utils/brokerAuth.js` | Groww config `authType: 'oauth_pkce' → 'credential'`. Dropped `loginUrlEndpoint`/`callbackEndpoint`/`maxConnections` (OAuth-specific). Added `requiresApiKey: true`, `requiresSecretKey: true`, `tokenGenEndpoint: '/api/groww/update-key'`, `tokenExpiry: 'daily_6am_ist'`. |

### Migration for existing Groww users
Existing users on partner OAuth tokens keep working until their tokens expire (~24h / daily 6 AM IST reset), then flow through the new credential form on reconnect. No proactive migration UI — same pattern web is using.

### Deploy ordering
Same as web: ccxt-india first (makes `/groww/generate-token` available), then `aq_backend_github` (new `/api/groww/update-key` + daily refresh cron), then this app build. Do not ship the app before the backend — the new form's POST will 404.

### Known follow-ups (deferred)
- `src/screens/Home/SubscriptionScreen.js:77-97` — the "Disconnect" handler still calls `${ccxtServer}groww/revoke` for Groww. After migration, that endpoint may not exist server-side. The call is already wrapped in try/catch with a non-fatal warning, so disconnect still works; drop the whole block in a follow-up cleanup commit.
- ~~`src/UIComponents/BrokerConnectionUI/GrowwConnectUI.js` and `GrowwConnectUI1.js` (330 + 318 lines) — not imported anywhere in the current tree, vestigial from an earlier variant. Deletion deferred.~~ **Deleted 2026-04-23** along with `HelpUI/GrowwHelpContent.js` — three-file unreachable trio that still carried pre-migration "Generate API Key → Access Token" copy contradicting the current TOTP Token flow. Confirmed zero imports before removal.
- Web `e73bd81` also fixed a DDPI / authorize-for-sell race (unrelated to Groww itself). App-side port tracked as a separate task.

### Files intentionally left alone
- `src/GlobalUIModals/ModalManager.js` — `case 'Groww'` dispatcher unchanged; same key, new behavior.
- `src/components/BrokerSelectionModal.js` — Groww tile entry unchanged. Tap still dispatches `'Groww'`, just opens the new credential form instead of the OAuth WebView.
- `src/screens/Home/ManageConnectionsModal.js` — vansh's `3d77710` already added Groww to `BROKER_MODAL_KEY_MAP` (`'Groww' → 'Groww'`), so the per-row Reconnect button on expired Groww sessions dispatches to `openModal('Groww')` → renders the new credential form. No change needed here.

## `angelone/verify-edis` — camelCase/snake_case dual-key contract (B3)

Ports web `e8b83eb` as a **doc-only port** — no code change needed on the app side.

### Background
Web's `e8b83eb` added `user_email: userDetails?.email` to the web's `DdpiModal.js` `AngleOneTpinModal` verify-edis call (that specific web callsite was sending neither `user_email` nor `userEmail` — a real bug on web that dropped `cid` resolution to `None`). The commit's docs half explicitly locks in the **dual-key contract**:

> "the ccxt-india hook accepts both `user_email` (snake_case) and `userEmail` (camelCase) so legacy callsites (fetchFunds, AllHoldings, verify-edis effect) that have been sending camelCase `userEmail` for years keep working without a rewrite."

### App audit — all 5 `angelone/verify-edis` callsites already compliant

| File | Line | Payload fields | Status |
|---|---|---|---|
| `src/components/DdpiModal.js` | ~1029 | `apiKey, jwtToken, userEmail` | ✅ camelCase `userEmail` present |
| `src/components/AdviceScreenComponents/StockAdvices.js` | ~145 | `apiKey, jwtToken, userEmail` | ✅ |
| `src/components/AdviceScreenComponents/AddtoCartModal.js` | ~272 | `apiKey, jwtToken, userEmail` | ✅ |
| `src/components/AdviceScreenComponents/RebalanceAdviceContent.js` | ~307 | `apiKey, jwtToken, userEmail` | ✅ |
| `src/screens/Drawer/MPPerformanceScreen.js` | ~577 | `apiKey, jwtToken, userEmail` | ✅ |

All five callsites have been sending camelCase `userEmail` since before this audit. Per the dual-key contract, they resolve `cid` correctly on the server and bind the right per-customer IPv6 for the Angel One verify-edis call. **No payload change required.**

### Why not proactively rewrite to snake_case?
- The contract is stable — web's commit message explicitly calls out the legacy callsites as a supported form.
- Rewriting five well-tested payloads for no behavioral gain would be churn.
- New callsites (B1 trade/basket payloads, B2 finish-connection endpoints, Groww G submit) use snake_case `user_email` — the new canonical — so the boundary is clear: legacy callsites keep camelCase, new callsites use snake_case.

### Note on payload shape divergence from web
The web's AngleOneTpinModal verify-edis payload includes `clientCode: userDetails?.clientCode` alongside `apiKey`/`jwtToken`. The app's equivalent omits `clientCode` because the Angel One app API key on mobile is read from `configData.config.REACT_APP_ANGEL_ONE_API_KEY` (advisor-level), not per-user encrypted. Both shapes resolve to the same Angel One call server-side — the difference is in how the app key is sourced, not in what the endpoint needs. No action required.

## DDPI authorize-for-sell — `await getUserDetails` before reopening (2026-04-20)

Ports web `e73bd81` Issue 3. Fixes the authorize-for-sell checkbox appearing to "not stick" — user ticks it, DDPI modal closes, rebalance/review modal reopens, and the DDPI prompt re-fires immediately as if the checkbox was never ticked.

### Root cause
`DdpiModal.handleProceed` fires `PUT /api/update-edis-status` (the server write that flips `is_authorized_for_sell: true` on the user doc), then immediately calls `setIsOpen(false)` + `reopenRebalanceModal()`. `getUserDetails()` was **fire-and-forget** — the reopened modal read pre-PUT userDetails (`is_authorized_for_sell=false`) and re-triggered DDPI.

### Fix
All 6 `handleProceed`-style callers in `src/components/DdpiModal.js` now `await getUserDetails()` before closing:

| Line | Function | Modal |
|---|---|---|
| ~133 | `handleProceed` | main `DdpiModal` default export |
| ~1115 | `handleProceed` | `AngleOneTpinModal` |
| ~1339 | `handleProceed` | `DhanTpinModal` |
| ~1902 | `handleContinue` | `OtherBrokerModel` (add-to-cart flow) |
| ~1966 | `handleAcceptRebalance` | `OtherBrokerModel` (rebalance flow) |
| ~2540 | `handleProceed` | `FyersTpinModal` |

All 6 containing functions were already `async`, so no function-signature change was needed.

### Parent-side — already safe
`TradeContext.getUserDeatils` (the central source passed down to `DdpiModal` via trade flows) is already `async` with `await axios.get(...)`, so it implicitly returns a Promise — `await` at the DdpiModal call site now properly waits. Other parent pages (`MPPerformanceScreen.getUserDetails`, `HistoryScreen.getUserDeatils`, etc.) that don't yet return their axios promise remain safe — `await` on a sync function is a no-op, so the fix degrades gracefully on unported parents.

### Backend counterpart
Per web commit message: `UpdateEdisStatus.js` on `aq_backend_github` returns `{new:true}` and only `$sets` the fields the client sent, so partial payloads stop clobbering sibling flags. Tracked server-side — no app change needed here.

## Per-broker polish (Group C, 2026-04-20)

Four small per-broker UX fixes bundled, each ports a discrete web commit.

### C1 — Kotak mobile pre-fill on reconnect (web `933e9a4`)

**File:** `src/components/BrokerConnectionModal/KotakModal.js`.

Added a `useEffect` that runs when `userDetails` is available. Reads `userDetails.connected_brokers[broker=Kotak].mobileNumber` (primary) with fallback to the legacy top-level `userDetails.phone_number`. Strips the `+91` prefix (the form stores 10 digits; `updateKotakSecretKey` re-adds `+91` before sending to backend). Only fires if the user hasn't started typing (`!mobileNumber` guard), so in-progress edits aren't overwritten.

### C2 — Motilal server-IPv4 static callout (web `156589e`)

**File:** `src/UIComponents/BrokerConnectionUI/MotilalConnectUI.js`.

Motilal Oswal is IPv4-only — all API calls route through the server's shared static IPv4 (`72.61.251.253`) via an IPv4-pinned session on ccxt-india. Replaced the broker's `<EgressIpCallout broker="motilaloswal" ...>` render with an inline static callout:

- Shows the server IPv4 in a monospace row with a Copy button.
- Copy button uses the existing app-wide global-`Clipboard` pattern (same convention as `HelpModal.js`, `KotakConsumerKeySteps.js`, `DdpiModal.js` — all of which use `Clipboard.setString()` as a runtime global without an explicit import). Wrapped in try/catch so if the platform doesn't expose a Clipboard shim, a fallback toast tells the user to long-press to copy.
- Acknowledgment checkbox — tapping toggles `egressReady`, with red-flash styling (`motilalIpAckRowFlash`) when `unmetAck && !egressReady` (Connect was tapped without the tick).
- Dropped the `EgressIpCallout` import from this file. Other broker screens (Upstox, HDFC, ICICI, Fyers, Kotak, Groww) keep their `EgressIpCallout` wire-up — the Motilal swap is broker-specific.

### C3 — Upstox Help Content step 3: "Allowed IPs" mention (web `608c9d4`)

**File:** `src/UIComponents/BrokerConnectionUI/HelpUI/UpstoxHelpContent.js`.

Prepended a sentence to step 3 telling the user to paste the dedicated static IP (from the in-form whitelist panel) into Upstox's "Allowed IPs" field, with a note that Upstox rejects non-whitelisted orders with `UDAPI1154 "static IP mismatch"`. The existing Redirect URL text stays unchanged; the IP guidance now comes first so it's less likely to be missed while the user is on Upstox's "Create App" form.

### C4 — HDFC Help Content step 4: "Allowed IPs" mention

**File:** `src/UIComponents/BrokerConnectionUI/HelpUI/HDFCHelpContent.js`.

Step 4 now instructs the user to paste the dedicated static IP into the InvestRight "Allowed IPs" field alongside setting the redirect URL, explaining that HDFC rejects non-whitelisted orders. Aligned structure with the Upstox step-3 edit.

### C5 — ICICI Help Content step 2: "IP Whitelist" mention

**File:** `src/UIComponents/BrokerConnectionUI/HelpUI/ICICIHelpContent.js`.

Step 2 now instructs the user to paste the dedicated static IP into the Breeze "IP Whitelist" field alongside the Redirect URL, with the rejection rationale. Same structural change as C3/C4.

### Files not touched
- The 5 HDFC/ICICI/Upstox `*ConnectUI.js` files already contain `EgressIpCallout` + an inline comment about the purpose. No UI component change — only the HelpContent instructional text was updated, because that's the user-facing prose.
- Kotak's HelpContent was not updated — its credential form doesn't involve creating an app with an "Allowed IPs" field; Kotak's IP whitelist is configured on the consumer-key settings page which is already covered via `EgressIpCallout`.

## EgressIpCallout polish — parity audit (Group D, 2026-04-20)

Ports web `b25d105` (UI polish + visible error state + steps preamble), `0f1f3bf` (no-opt-out hard-gate), and `fca0620`'s red-flash half (the HDFC/ICICI step-text half was ported in Group C4/C5).

**Net code change: zero.** The app's `src/components/BrokerConnectionModal/EgressIpCallout.js` (706 lines) already implements every feature covered by these three web commits — they were ported piecewise during the earlier broker wire-up commits (`321fb92` wired 5 brokers + `99a0c69` wired Kotak). This audit confirms parity and documents where each web feature lives in the app file so future divergence is bisectable.

### Feature-by-feature audit

| Web feature (commit) | App file location | Evidence |
|---|---|---|
| `showUnmetAck` prop → red flash on checkbox (fca0620) | `EgressIpCallout.js:216-248` | `useEffect` keyed on `showUnmetAck` runs `Animated.sequence` (4-keyframe red pulse) + 2.5s timeout, then calls `onUnmetAckHandled` |
| Red-ring + warning text on flashing checkbox (fca0620) | `EgressIpCallout.js:441-472` | `Animated.View` with `flashBg` interpolation (#FEF3C7 → #FEE2E2), `"⚠ Please tick this box to confirm..."` shown when `flashAck && !acknowledged` |
| Hard-gate for `unclaimed` state (0f1f3bf) | `EgressIpCallout.js:213` | `onAcknowledgeChange(false)` fires for every state except `partner` and `claimed+acknowledged` |
| Hard-gate for `ipv4_provisioning` state (0f1f3bf) | `EgressIpCallout.js:213, 328-353` | Same `onAcknowledgeChange(false)` path; amber "connections temporarily unavailable" panel with SEBI-compliance rationale, no opt-out button |
| Visible error state with Retry button (b25d105) | `EgressIpCallout.js:308-326` | Red card with title, error body, Retry button wired to `fetchStatus`; shown when `errorMsg && !brokerState` |
| Steps preamble — "Whitelist this IP in your ... developer portal" (b25d105) | `EgressIpCallout.js:408-439` | `claimed` state renders step header + a/b/c numbered steps using `brokerDevPortal` + `brokerHint` from the maps above |
| Partner broker short-circuit (0f1f3bf) | `EgressIpCallout.js:205-207, 273-274` | `partner` state returns `null` + immediately fires `onAcknowledgeChange(true)` |
| Claim CTA on `unclaimed` (b25d105) | `EgressIpCallout.js:355-390` | Blue card with SEBI rationale, "Assign me a dedicated static IP" button, inline error row |
| Migration banner (b25d105) | `EgressIpCallout.js:276-290` | Renders above every state when `migrationBanner` present in backend response; shows expiry date |

### Wire-up count

7 app screens now wire `EgressIpCallout` in: Upstox, Fyers, HDFC, ICICI, Kotak (all via earlier commits), Groww (added in G), plus `src/screens/Broker/BrokerCredentialScreen.js` generic credential screen (Fyers branch). Motilal intentionally **does not** wire it (see Group C2 — swapped for the shared-server-IPv4 static callout).

### Parity verdict

Full parity with web. The 230-line delta between app (706) and web (936) is entirely cosmetic — web uses Tailwind classes + JSX helpers that are inline `StyleSheet` rules in the RN port, which compresses differently. No behavioural divergence.

## Groww TOTP Token — parsing hardening + UX fix (2026-04-22)

The 2026-04-21 migration moved Groww to `pyotp.TOTP(seed).now()`-based daily refresh, but left two rough edges that produced a confusing `"TOTP seed could not be parsed"` failure on most first-connect attempts:

1. **UI label mismatch with Groww's portal.** The mobile form asked for a "TOTP Seed (Base32)", but Groww's own dialog labels that value **"TOTP Token"**. Users hunting for a field literally called "Seed" on Groww's screen never found one — some pasted the API Secret (wrong value), some pasted the 6-digit live code (wrong form), some gave up.
2. **Backend called pyotp with the raw pasted value.** pyotp is strict — it rejects lowercase, whitespace, separator characters, missing padding, and `otpauth://` URLs, all of which are common paste forms. The rejection surfaced as a single opaque `INVALID_SEED` code so the mobile UI couldn't steer the user toward the specific fix.

### Fix

**ccxt-india (`apps/app_groww.py`)** — added `_normalize_totp_token(raw)` ahead of the `pyotp.TOTP(...)` call. It:

- extracts the `secret=` param when the user pastes an `otpauth://` URL (common when scanning Groww's QR with a generic scanner app instead of an authenticator);
- strips whitespace, hyphens, underscores;
- uppercases;
- pads to a multiple of 8 with `=`;
- validates the Base32 alphabet *before* pyotp touches it;
- length-checks against the minimum Groww token size.

Failure now returns one of three granular codes — `NOT_BASE32`, `WRONG_LENGTH`, or `GROWW_REJECTED` (from the downstream `GrowwAPI.get_access_token` call) — instead of collapsing everything into `INVALID_SEED`. The legacy `INVALID_SEED` / `INVALID_CREDENTIALS` codes are still handled by the mobile client for rollout compat (older backend builds).

**Mobile — `GrowwConnectModal.js`, `brokerRegistry.js`, `growwRefresh.js`.**

- Field relabeled **"TOTP Seed (Base32)" → "TOTP Token"** across all three surfaces (connect modal, settings-page credential screen via registry, refresh-error copy). State variable renamed `totpSeed` → `totpToken`.
- Step-2 instruction rewritten to point at Groww's actual label: *"Groww will show you a QR code and, next to it, the TOTP Token value. Copy both the API Key and the TOTP Token — the token is shown only once."*
- Error branches wired for the three new backend codes with targeted copy (format problem vs. incomplete paste vs. Groww rejection).
- Wire contract unchanged: the field the frontend POSTs is still `totp_seed` (AES-wrapped) to avoid a coordinated backend-field rename. Only the user-facing label moved.

### Migration compatibility

- Stored seeds from 2026-04-21 keep working — `_normalize_totp_token` is idempotent on already-clean Base32.
- Legacy mobile builds posting `secretKey` still flow through `_mint_groww_approval_mode` (unchanged).
- Error-code widening is additive — no backend client breakage.

### Files touched

| File | Change |
|---|---|
| `ccxt-india/apps/app_groww.py` (tidi:server2) | Added `_normalize_totp_token` helper; inserted normalization step in `_mint_groww_access_token`; switched error codes to `NOT_BASE32` / `WRONG_LENGTH` / `GROWW_REJECTED`. |
| `src/components/BrokerConnectionModal/GrowwConnectModal.js` | `totpSeed` → `totpToken`; field label + placeholder + helper + step-2 copy; three new error branches in `catch`. |
| `src/config/brokerRegistry.js` | `label: 'TOTP Seed (Base32)' → 'TOTP Token'`; placeholder updated. `key: 'totp_seed'` unchanged (wire contract). |
| `src/utils/growwRefresh.js` | User-facing copy uses "TOTP Token"; added `GROWW_REJECTED` to the "stored token rejected" branch. |

### Deploy ordering

ccxt-india first (so normalized parsing is live before any mobile build hits it), then the mobile build. Doing it in the other order is safe — the old backend still accepts clean Base32, which is what the new mobile UI encourages — but the granular error codes won't reach users until ccxt-india ships.

## Per-broker redirect URL reference (MANDATORY reading before touching `REACT_APP_BROKER_CONNECT_REDIRECT_URL`)

> **⚠️ READ THIS BEFORE EDITING `.env`'s `REACT_APP_BROKER_CONNECT_REDIRECT_URL` or any broker's `redirect_url` / `redirect_uri` argument.** This single env var is read by 8 independent broker OAuth flows. Changing it for one broker silently affects all others for any tenant whose backend `appadvisors.brokerConnectRedirectUrl` is unset. **On 2026-04-22 commit `f9f5d0f` repurposed this var for Groww App Links and broke the Zerodha publisher basket flow on prod (silent)** — see "Groww App Links / Zerodha publisher incident (2026-04-23)" below.

### Resolution chain (applies to every consumer below)

```
runtime value = configData.config.REACT_APP_BROKER_CONNECT_REDIRECT_URL    ← backend: appadvisors.brokerConnectRedirectUrl
              || Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL              ← .env (fallback, baked at build)
              || ''
```

Only 2 of 12 backend tenants currently set `appadvisors.brokerConnectRedirectUrl` (`prod`, `rgxresearch`); the other 10 (`arfs`, `japfinserve`, `alphaquark_demo_v1`, `test_app_advisor_final`, `tidi`, `wealthorigin`, `zamzam_app_v1`, `zamzamcapital`, etc.) fall through to `.env`. Any `.env` change is therefore a production change for 10 tenants simultaneously.

### Per-broker consumer map

| Broker | Auth type | Reads the shared var? | Where the URL is sent to the broker | Dev-portal registration (user action) | Publisher/basket WebView needs `baseUrl`? |
|---|---|---|---|---|---|
| **Zerodha** | OAuth (Kite Connect) + publisher basket | **Yes** — `ZerodhaConnectUI.js:216` (OAuth `site` param); publisher basket uses `baseUrl` derived from `subdomain`/`customDomain` via `brokerPublisher.getPublisherWebViewBaseUrl()` (isolated 2026-04-23) | `ZerodhaConnectUI.js:230` — POST `/zerodha/login-url` with `site: <url without https://>` | Kite Connect app redirect URL = `https://{advisor}.alphaquark.in/stock-recommendation` | **Yes** — Kite rejects `about:blank` Referer. 5 callsites fixed 2026-04-23: `ReviewZerodhaTradeModal.js:946,1073`, `UserStrategySubscribeModal.js:1266`, `MPReviewTradeModal.js:1632`, `RebalanceModal.js:1849` |
| **Upstox** | Hybrid (credential → OAuth) | **Yes** — `upstoxModal.js:56-57`; `BrokerCredentialScreen.js:137` via `getBrokerCallbackUrl()` | `upstoxModal.js:139,245` + `BrokerCredentialScreen.js:137` — `redirect_uri` in `/api/upstox/update-key` + `upstox/gen-access-token` | Upstox dev portal "Redirect URI" field = same URL | No — OAuth WebView only |
| **Fyers** | Hybrid (credential → OAuth) | **Yes** — `FyersConnect.js:40-41` | `FyersConnect.js:248` — `redirect_url` in `/api/fyers/update-key` | Fyers dev dashboard redirect URL = same URL | No — OAuth WebView only |
| **ICICI Direct** | Hybrid (credential → OAuth) | **Yes (help UI only)** — `HelpModal.js` displays to user; `icicimodal.js:136-150` intercepts `?apisession=` callback | No explicit `redirect_uri` sent in body — ICICI uses whatever's pre-registered in dev portal | ICICI developer portal registered callback = same URL | No |
| **HDFC Securities** | Hybrid (credential → OAuth) | **Yes (help UI only)** — `HDFCHelpContent.js:9` displays; `HDFCconnectModal.js:103-119` intercepts `?requestToken=` | No explicit `redirect_uri` in body — HDFC uses pre-registered URL | HDFC dev portal registered callback = same URL | No |
| **IIFL Securities** | OAuth WebView | **Yes** — `iiflmodal.js:42,46`, `iiflproceedmodal.js:88,168` | WebView loads `https://markets.iiflcapital.com/?v=1&appkey=nHjYctmzvrHrYWA&redirect_url=<url-without-https>` | IIFL portal registered against advisor URL | No |
| **Dhan** | OAuth (CCXT partner) | **Yes (help UI only)** — `DhanHelpContent.js:9` | Backend handles; client reads `?dhan_client_id=...&dhan_access_token=...` query on callback | Per `DhanConnectModal.js:125` — same URL | No |
| **AliceBlue** | OAuth WebView | **Hardcoded `prod.alphaquark.in`** — `AliceBlueConnect.js:buildAliceBlueAuthUrl` (2026-04-26 — no longer reads `REACT_APP_BROKER_CONNECT_REDIRECT_URL`) | `/aliceblue/login?origin=https://prod.alphaquark.in&returnPath=/stock-recommendation` | AliceBlue partner appcode `7WMf5NotZe` is allow-listed against `prod.alphaquark.in` ONLY — any other origin (e.g. `app-links.alphaquark.in`) silently bounces user back to password screen after OTP | No |
| **Axis Securities** | OAuth WebView | **Yes** — `AxisConnectModal.js:78-79` | `AxisConnectModal.js:86` — POST `/axis/login-url` with `redirectUrl` | Axis SSO portal registered callback | No |
| **Motilal Oswal** | Hybrid (credential → OAuth) | Partial — `MotilalModal.js:114,173` uses shared var; but `brokerRegistry.js:157` **hardcodes** `'https://ccxt.alphaquark.in/motilal-oswal/callback'` as `redirectUrl` override | PUT `/api/motilal-oswal/update-key` with `redirect_url` and `redirectUrl` | Motilal portal registered against **ccxt.alphaquark.in** (not advisor URL) | No |
| **Angel One** | OAuth publisher login | **No** — directly reads `REACT_APP_ANGEL_ONE_API_KEY`; no redirect URL parameter | WebView loads `https://smartapi.angelbroking.com/publisher-login?api_key=<key>` | SmartAPI dashboard | No |
| **Kotak** | Pure credential (no OAuth) | No | `PUT /api/kotak/connect-broker` with `ucc, apiKey, mobileNumber, mpin, totp` | N/A | No |
| **Groww** | Pure credential (API Key + TOTP seed) | **No** (confirmed `grep` on `GrowwConnectModal.js`, `growwRefresh.js` — zero hits) | `POST /api/groww/update-key` with `apiKey, totp_seed` | N/A — Android App Links uses AndroidManifest.xml hardcoded intent-filter for `app-links.alphaquark.in/broker-callback` | No |

### Shared-env-var coupling — 8 OAuth/hybrid brokers + 3 help-UI surfaces on one string

| Safety property | Mitigation |
|---|---|
| Changing `.env` value flips the redirect URL for all 8 OAuth/hybrid brokers on any tenant whose backend `brokerConnectRedirectUrl` is unset. | Always set `appadvisors.brokerConnectRedirectUrl` per tenant in backend. Audit: `cd ~/servers/server1/aq_backend_github && node -e '...' ` — see `docs/BROKER_CONNECTION.md § audit script` (below). |
| Help-content screens (`FyersHelpContent`, `KotakHelpContent`, `MotilalHelpContent`, `DhanHelpContent`, `UpstoxHelpContent`, `AliceblueHelpContent`, `HDFCHelpContent`) read `Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL` directly (not via ConfigContext) — they'll always show the `.env` value even for tenants with a backend override. | Display copy via `configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL || Config...` — ported to Upstox (see `UpstoxConnectUI.js:116`); replicate for the other help files in a follow-up. |
| Kite publisher basket WebView Referer check is **independent** of the OAuth redirect URL — Zerodha's basket endpoint validates Referer origin against the Kite app's registered redirect-URL origin. | Separate path: `brokerPublisher.getPublisherWebViewBaseUrl(configData)` derives from `customDomain` → `subdomain` → `prod.alphaquark.in`. Never reads `REACT_APP_BROKER_CONNECT_REDIRECT_URL`. Added 2026-04-23. |
| Groww does NOT need this env var — Android App Links is driven by AndroidManifest.xml's `<intent-filter>`. | AndroidManifest entry is the source of truth; do not add Groww reads of the shared var. |

### Audit script — "which tenants are affected by `.env`-fallback today?"

Run on `tidi:/home/ubuntu/servers/server1/aq_backend_github` (see CHANGELOG 3.9.7 section below):

```js
// SAFE, READ-ONLY — list every appadvisor + whether its brokerConnectRedirectUrl is set.
// Tenants with empty value silently fall through to the mobile build's .env.
require('dotenv').config();
const mongoose = require('mongoose');
// ... see docs/BROKER_CONNECTION.md § audit-script in repo for the full script.
```

### Groww App Links / Zerodha publisher incident (2026-04-23)

Root cause: commit `f9f5d0f` (2026-04, "feat: Groww OAuth via Android App Links") changed `.env`'s `REACT_APP_BROKER_CONNECT_REDIRECT_URL` from `https://prod.alphaquark.in/stock-recommendation` → `https://app-links.alphaquark.in/broker-callback`. The change was redundant for Groww's actual functionality (Groww uses AndroidManifest's intent-filter, not this env var) but repurposed a shared-across-8-brokers value.

Observable failure: Zerodha publisher basket returned `Invalid 'api_key'` on prod. Not because the api_key was wrong — because (a) the basket WebView was loading `source={{html}}` with no `baseUrl`, putting Referer at `about:blank`; (b) Kite's basket endpoint rejects Referer that doesn't match the Kite Connect app's registered redirect-URL origin. The prod tenant had a backend `brokerConnectRedirectUrl` override (`prod.alphaquark.in/stock-recommendation`), so OAuth redirects stayed correct — but the publisher Referer path was broken regardless (it had never been Referer-safe; just hadn't been exercised recently).

For any tenant WITHOUT a backend override (10 of 12 at time of audit), the `.env` flip ALSO broke OAuth redirect for every OAuth/hybrid broker simultaneously — silent, because no user happened to retry those brokers on those tenants during the incident window.

Fixes applied 2026-04-23:

1. `.env`: reverted `REACT_APP_BROKER_CONNECT_REDIRECT_URL` to `https://prod.alphaquark.in/stock-recommendation` with a blocking comment citing this doc.
2. `src/utils/brokerPublisher.js`: added `getPublisherWebViewBaseUrl(configData)` helper that derives the Zerodha basket WebView origin from `customDomain` / `subdomain` — intentionally NOT from `REACT_APP_BROKER_CONNECT_REDIRECT_URL`, so Groww-side changes can't re-contaminate Zerodha.
3. 5 Zerodha basket WebView callsites set `source.baseUrl` via the new helper (`ReviewZerodhaTradeModal.js:946,1073`, `UserStrategySubscribeModal.js:1266`, `MPReviewTradeModal.js:1632`, `RebalanceModal.js:1849`).
4. This section + CLAUDE.md guardrail added to prevent recurrence.

## Kite publisher symbol/exchange routing via `/zerodha/convert-symbol` (2026-04-23)

Kite's basket endpoint silently drops items whose `{tradingsymbol, exchange}` combo doesn't resolve against its scripmaster. Two axes of failure:

1. **Exchange mismatch**: advice-side tradeReco tags a stock as `NSE` but it's BSE-only (e.g. ADARSHPL), or the stock has been moved to NSE's BE (trade-to-trade) series and the advice still points at the EQ symbol. Kite drops the item with no error.
2. **Suffix mismatch**: tradeReco symbols include `-EQ` suffix (Angel One convention), Kite expects bare `RELIANCE` etc.

### Single source of truth

ccxt-india's `ZERODHA_SCRIP_MASTER.get_zerodha_symbol_from_angelone_symbol()` (invoked by `POST /zerodha/convert-symbol`) is the authoritative resolver. It reads NSE's daily circular (EQ ↔ BE transitions) and BSE's scripmaster to pick the correct `{zerodha_symbol, exchange, lot_size}` for TODAY. The response also includes a Redis-cached `ltp` so the mobile MARKET→LIMIT-IOC protection has a reference price even when the user's live WebSocket subscription is empty (common for BE / BSE-primary stocks subscribed on NSE).

**Never replicate this mapping client-side.** The NSE circular changes daily; any JS copy would go stale within 24h.

### Mobile wiring

| Layer | File | Role |
|---|---|---|
| Transport | `src/utils/brokerPublisher.js: convertSymbolsToZerodha()` | POST `/zerodha/convert-symbol`, parse `{results: [...]}` → map keyed by `angelone_symbol`. |
| Per-stock resolver | `src/utils/brokerPublisher.js: resolveZerodhaSymbol(stock, symbolMap)` | Returns `{tradingsymbol, exchange, cachedLtp}`. Strips `-EQ`; falls through to advice-side values when the map has no entry. |
| Hook | `src/hooks/useZerodhaSymbolMap.js` | Fetches the map on mount/when the advice symbol list changes. Memoized by sorted joined symbol list — no thrash from unrelated re-renders. |
| Publisher basket builders | `ReviewZerodhaTradeModal.js`, `UserStrategySubscribeModal.js`, `MPReviewTradeModal.js`, `RebalanceModal.js`, `StockAdvices.js`, `AddtoCartModal.js` | All 6 now use `resolveZerodhaSymbol` for the outgoing `tradingsymbol` + `exchange`, and prefer `live-ws on resolved → live-ws on raw → cachedLtp` for market protection. |
| LTP subscription | `RebalanceModal.js:307` (`wsSymbols`) | Rewrites `useWebSocketCurrentPrice` input symbols with the resolved exchange so live LTP flows for BE/BSE-primary stocks. Other 5 callsites rely on `cachedLtp` fallback for market protection (UI may show stale price in the review modal until ws catches up — deferred follow-up). |

### Historical bugs in `convertSymbolsToZerodha()` (fixed 2026-04-23)

The helper was added during the prod-web sync but had 3 defects that meant it silently returned `{}` to every caller — so the whole scripmaster path has been a dead no-op since day one:

1. Imported `Config from './Config'` (local `APP_VARIANTS` object) instead of `react-native-config` — `Config.AQ_KEY` and `Config.AQ_SECRET` were always `undefined`.
2. Sent `Authorization: Bearer <undefined>` header; the backend route expects `aq-encrypted-key` per `@validate_token` decorator.
3. Dereferenced `ccxtServer` as a named import from `serverConfig` but that file default-exports `server`. URL resolved to `"undefined/zerodha/convert-symbol"` → every request 404'd.
4. Returned the raw `{results: [...], status: 0}` response to callers expecting a keyed map.

Flutter (`tidi_new/tidistockmobileapp/lib/service/AqApiService.dart: convertSymbolsToZerodha`) had the same defect #4 and shipped a silently-empty map until fixed 2026-04-23.

## Per-broker scripmaster disambiguation (wrong-security risk class)

Every broker has its own scripmaster SQLite table keyed on a "natural" symbol/token pair. When that key is not naturally unique and the lookup code uses `cursor.fetchone()`, the resolver can silently return the wrong row — consequence is an order placed on the wrong security. Audit performed 2026-04-23 after Zerodha's `INFY-EQ → NIFTY TOP 20 EW` bug surfaced; two brokers were vulnerable, eight were not.

### Vulnerable (patched 2026-04-23)

| Broker | Lookup key | Collision type | Fix |
|---|---|---|---|
| Zerodha | `(exchange_token, exchange)` | INDICES segment row vs EQUITY segment row (e.g. `NIFTY TOP 20 EW` vs `INFY`) | Added `AND segment = exchange` filter with `segment != 'INDICES'` fallback. `brokers/zerodha/zerodha_scrip_master.py`. |
| HDFC | `(exch_security_id, exchange)` | Currency futures (`FUTCUR`) vs equity (`EQUITY`) — e.g. token 1011 → SCHAEFFLER or EURINR | Disambiguate by original AngelOne segment → filter `instrument_segment IN (...)` to the corresponding HDFC segment set. `brokers/hdfc/hdfcsec_scrip_master.py`. |

### Safe (verified 2026-04-23)

| Broker | Why safe |
|---|---|
| ICICI Direct | Schema keys on `(ExchangeCode, Series)` — naturally unique per scrip. Zero duplicates found in audit. |
| AliceBlue | Lookup filters by `Exch + ExchangeSegment + Symbol`. |
| Upstox | Lookup includes `instrument_type` + `exchange + segment` filter. |
| Fyers | Lookup by unique `Fytoken`. |
| Dhan | Lookup by `SEM_SMST_SECURITY_ID` (per-row unique) + `SEM_EXM_EXCH_ID`. |
| Groww | Lookup includes `series` filter alongside `trading_symbol`. |
| Motilal Oswal | Lookup by `scripcode` (per-exchange unique). |
| IIFL | Lookup by `(Name, Exch, Series)`. |
| Axis Securities | Lookup includes `AND segment = 'EQ'` filter. |
| Angel One | Source of truth — no resolver. |

### The pattern to avoid when adding a new broker

Whenever a new broker's `get_<broker>_symbol_from_angelone_symbol()` function runs a `SELECT … WHERE <key> = ?` and calls `fetchone()`, the author MUST verify that the key is naturally unique per scrip on that broker's scripmaster. If not, add a disambiguator (usually on `segment` / `instrument_type` / `series`) BEFORE accepting the PR. Otherwise a future data-import run could silently start returning the wrong security for some subset of symbols, exactly as happened with Zerodha's INDICES rows and HDFC's FUTCUR rows.

Audit script (run any time to re-check):

```sql
-- Zerodha
SELECT exchange_token, exchange, COUNT(*) n FROM zerodha_scrip_data
WHERE exchange_token IS NOT NULL GROUP BY exchange_token, exchange HAVING n > 1 LIMIT 10;

-- HDFC
SELECT exch_security_id, exchange, COUNT(*) n FROM hdfcsec_scrip_data
WHERE exch_security_id IS NOT NULL GROUP BY exch_security_id, exchange HAVING n > 1 LIMIT 10;
```

Any non-empty result means the lookup code for that broker MUST filter by a disambiguating column.

## Centralized MARKET → LIMIT-IOC conversion across brokers (ccxt-india)

**Single source of truth**: `ccxt-india/brokers/market_order_conversion.py` (tidi:server2). Every equity broker's `place_order()` that handles a MARKET-typed order MUST import from this module — no broker is allowed to reinvent the buffer / tick / validity math.

### Consumers (as of 2026-04-23)

| Broker | Why it needs the conversion | LTP source |
|---|---|---|
| **Zerodha** | Kite rejects MARKET on GSM / T2T / BE / circuit-limit stocks with *"Market orders are not allowed at this stage"* | `fetch_ltp_for_symbol` (shared helper, HTTP fetch to `websocket.alphaquark.in/market-data/ltp`) |
| **ICICI Direct** | Breeze rejects all MARKET orders with *"kindly pass 'limit' as parameter"* | Same shared helper |
| **AliceBlue** | API rejects MARKET with *"Market order not allowed"* | Same shared helper |
| **Motilal Oswal** | API rejects MARKET with *"M01108: Cannot place Market orders for Algo Orders"* | `_get_ltp_for_limit_fallback` (broker-local Redis cache — faster than HTTP, kept because Motilal place_order is on a tight latency budget) |

### What the shared helper provides

| Helper | Returns |
|---|---|
| `buffer_pct_for_ltp(ltp)` | 0.3% for LTP > ₹500, 0.5% for ₹50–500, 1.0% for < ₹50 |
| `tick_size_for_price(price)` | ₹0.10 for < ₹500, ₹0.20 for ₹500–5000, ₹0.50 for > ₹5000 — Kite-compatible schedule (superset of ICICI/AliceBlue tick sets, so it's safe for all three) |
| `compute_ioc_limit_price(ltp, action)` | Buffer + tick-snap combined, BUY rounds UP, SELL rounds DOWN |
| `converted_validity_for_exchange(exchange)` | `'ioc'` for NSE, `'day'` for BSE (BSE rejects IOC on LIMIT orders; DAY leaves unfilled orders in the book until session end, acceptable given the conservative buffer means fills are near-immediate in practice) |
| `fetch_ltp_for_symbol(symbol, exchange, broker_label)` | HTTP fetch to `websocket.alphaquark.in/market-data/ltp`, returns float or None |

### Pattern every new equity broker's `place_order` must follow

```python
from brokers.market_order_conversion import (
    compute_ioc_limit_price,
    converted_validity_for_exchange,
    fetch_ltp_for_symbol,
)

if order_type == "MARKET" and not is_derivative:
    ltp = fetch_ltp_for_symbol(symbol, exchange, broker_label="MyBroker")
    if ltp and ltp > 0:
        limit_price = compute_ioc_limit_price(ltp, action)
        validity = converted_validity_for_exchange(exchange)
        order_type = "LIMIT"
        price = limit_price
    # else: keep as MARKET; broker surfaces its own error, easier to triage than a silent ₹0 LIMIT
```

Derivatives (NFO/BFO) accept MARKET at the exchange level — skip the conversion for them.

### Client-side mirror (Alphab2bapp)

`src/utils/brokerPublisher.js` exports `applyKiteMarketProtection` + `roundToKiteTick` with the **same tick schedule and IOC/DAY split** as the server helper. Any change to buffer / tick rules on the server MUST be mirrored in the client so the Kite Publisher basket path (client-side) behaves identically to the REST-placement path (server-side). Client uses a flat 1% buffer for simplicity; server uses the tiered 0.3/0.5/1.0% table. Both snap to the identical tick schedule, so the maximum price divergence is ~0.7% on the buffer — acceptable given the tiered buffer is always more conservative on liquid stocks.

### Flutter mirror (tidi_new)

`tidi_new/tidistockmobileapp/lib/service/OrderExecutionService.dart` implements the same buffer/tick/validity logic inline in Dart (couldn't reuse the Python helper across language boundaries). Same schedule; any server-side change must be re-implemented there too.

## Backend scripmaster + LTP fallback (ccxt-india)

| File on `tidi:server2/ccxtprod/ccxt-india/` | What it does | Documented where |
|---|---|---|
| `apps/app_zerodha.py: _live_fetch_ltps()` | Batched Angel One live fetch for Redis-cache misses on `/zerodha/convert-symbol`. Fires after Redis returns None for any symbol; adds ≤ one round-trip (~200-500ms) regardless of basket size. | Changelog [3.9.12] section 2 |
| `apps/app_zerodha.py: _get_cached_ltp()` | Redis-cached LTP reader for the Kite Publisher MARKET→LIMIT conversion. Tries multiple key patterns per symbol (native exchange, `-EQ`, `-BE` suffix variants). Falls through to `_live_fetch_ltps` when all candidates miss. | Same |
| `brokers/zerodha/zerodha_scrip_master.py` | INDICES-segment disambiguation fix (INFY-EQ → `INFY`, not `NIFTY TOP 20 EW`). | "Per-broker scripmaster disambiguation" section above |
| `brokers/hdfc/hdfcsec_scrip_master.py` | FUTCUR vs EQUITY disambiguation by original AngelOne segment → `instrument_segment` filter. | Same |
| `brokers/zerodha/zerodha.py: place_order` | MARKET→LIMIT-IOC conversion via the centralized helper. | Section above |
| `brokers/motilal_oswal/motilal_oswal.py: place_order` | Migrated from inline LTP-as-price to the centralized helper's buffer+tick math. Retained Motilal's faster Redis-local LTP source. | Same |
| `brokers/market_order_conversion.py` | **Single source of truth.** Top-of-file docstring prescribes the template for all new equity brokers. | Section above |

## DDPI/EDIS Help module (2026-04-23)

Every sell-authorization error or EDIS prompt in the app now routes through a **single reusable help modal** that tells the user what DDPI is, why it beats EDIS, and the exact broker-specific steps to activate it. No screen is allowed to embed DDPI step-text inline anymore — duplication caused the "activate DDPI" nudge in `ManualSellModal.js` to drift away from the per-broker step list in `DdpiModal.js`, and neither nudged users on brokers that support online EDIS (Angel One, Dhan), where the DDPI upgrade is still the right long-term move.

### Module layout

| File | Role |
|---|---|
| `src/config/brokerDdpiHelp.js` | Per-broker registry. 14 entries (all currently supported brokers). Schema: `{title, intro, steps[], directLink, portalUrl, hasOnlineEdis, customerCare, videoId?}`. `getBrokerDdpiHelp(broker)` helper does case-insensitive lookup and returns `null` for unknown brokers (caller must degrade gracefully). |
| `src/components/BrokerDdpiHelpModal.js` | Reusable bottom-sheet. Reads the config, renders title + persuasive intro + EDIS callout (conditional on `hasOnlineEdis`) + numbered step list + customer-care footer + primary CTA ("Open {broker}'s DDPI page") + dismiss. Pure consumer of the config — no broker-specific strings hardcoded. |
| `src/GlobalUIModals/ModalManager.js` | Registered as `case 'DdpiHelp'`. Payload contract: `{broker: '<name>'}`. |

### Invocation patterns

```js
// 1. From any screen via the global modal store (preferred):
useModalStore.getState().openModal('DdpiHelp', { broker: userDetails.user_broker });

// 2. Embedded directly in a component (when you don't need the global store):
<BrokerDdpiHelpModal broker="Zerodha" visible={v} onClose={fn} />
```

### Persuasion copy — matters more than you think

The config holds a **broker-specific** `intro` paragraph on every entry. Three design choices baked in:

- The *generic* DDPI intro explains what DDPI is in one sentence ("one-time SEBI-approved authorization"), and a second sentence anchors *why it matters for this user now* ("without it, every sell you place here will require a per-session TPIN prompt on the broker's site, which often fails from third-party apps"). Generic enough to reuse; specific enough to feel relevant.
- For brokers with online EDIS (Angel One, Dhan — `hasOnlineEdis: true`), the modal renders an **additional callout** — *"Why DDPI even though {broker} has online EDIS?"* — acknowledging that EDIS works but is per-day and flaky, then pitching DDPI as the one-time upgrade. Without this callout, users on Angel One/Dhan assume DDPI is unnecessary and skip it — returning with the same problem next week.
- For HDFC (no self-serve DDPI flow), the `directLink` is explicitly `null` and `customerCare.email/phone` are surfaced prominently — the primary CTA degrades to "Open HDFC's portal" instead of pretending there's a direct activation page.

### Consumer surfaces (wired 2026-04-23)

| File | Before | After |
|---|---|---|
| `src/components/ManualSellModal.js` | Hardcoded ICICI-only text *"Please authorize your stocks manually on your ICICI broker ..."* (ignored the user's actual broker) | Accepts `broker` prop (default `'ICICI Direct'`), renders a prominent green "Show me how to activate DDPI on {broker}" nudge row that calls `openModal('DdpiHelp', {broker})`. The inline "activate DDPI" text is also clickable — opens the same modal. |
| `src/components/DdpiModal.js` | Generic *"Please authorize your stocks manually on your broker … activate DDPI"* text with no way to actually see the steps from this modal | Same paragraph, plus a new green "Show me how to activate DDPI on {broker}" nudge row below it that opens the shared modal. |

### Deferred (explicitly tech debt)

`DdpiModal.js` still contains **three separate inline copies** of a broker-instructions map (lines ~886, ~1799, ~2180). These are 2685 lines of legacy code with pre-existing eslint errors (conditional hooks, duplicate style keys) — migrating all three to consume `brokerDdpiHelp.js` is a 2-hour refactor best done as a separate PR to keep this one small. The new shared module is the canonical source of truth going forward; the inline copies in `DdpiModal.js` should be deleted in that follow-up.

### In-app WebView popup for `directLink` (2026-04-23)

Originally the CTA used `Linking.openURL` to open the broker's DDPI page in the OS browser. Two problems:

1. **UX:** leaves the app mid-flow — user has to manually come back to retry the sell.
2. **Reliability:** 9 of the 13 shipped URLs were already rotted when first verified ([3.9.15]) — kicking users to Chrome means a dead page lands in their browser history with no fallback path back to the in-app help sheet.

Now the CTA opens a second stacked overlay inside the help modal that renders the URL in a `react-native-webview` with a back-arrow header (returns to the help sheet) and an external-browser escape icon (still calls `Linking.openURL` for users who prefer Chrome). Android uses a desktop-Chrome UA string because several broker portals (ICICI, HDFC) return 404 to the default Android WebView UA.

### URL drift — don't trust without verifying

Every broker's `directLink` is a URL on **the broker's domain** and rots whenever the broker migrates their support portal. Dhan moved knowledge.dhan.co → dhan.freshdesk.com. Kotak moved kotaksecurities.com → kotakneo.com. AliceBlue exposed wp.aliceblueonline.com. Upstox migrated Freshdesk article IDs → `/t-XXXXXX/` slugs. Verified every URL via `curl -IL -A 'Mozilla/5.0 ... Chrome/120 ...'` (ICICI and HDFC block the default curl UA, but render in the WebView). If you update the config file, re-verify the URL you're putting in.

### When adding a new broker

1. Add the broker to `src/config/brokerDdpiHelp.js`. All 14 fields matter — take time to write the `intro` paragraph in the broker's voice.
2. If the broker has no self-serve DDPI flow (HDFC pattern), set `directLink: null` and fill `customerCare`.
3. If the broker supports online EDIS/TPIN (Angel One / Dhan pattern), set `hasOnlineEdis: true` — the modal will auto-render the "Why DDPI over EDIS?" callout.
4. Update the consumer table above with the new broker if it needs a nudge from a screen that doesn't currently have one.
5. No code changes to `BrokerDdpiHelpModal.js` should be needed — the config drives everything.
6. Verify the `directLink` URL using curl with a realistic Chrome UA (`Mozilla/5.0 ... Chrome/120 ...`) — not all broker portals respond to the bare curl UA. If the page 200s with Chrome UA, it'll render in the in-app WebView.

