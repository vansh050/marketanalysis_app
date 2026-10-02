# Mobile App Architecture

## 2026-09-29 Warn-mode model-owned SELL review

The two non-model trade review paths now ask the server for an ownership
preview before a SELL is submitted:

- `ReviewTradeModal` covers the normal direct-broker path.
- `ReviewZerodhaTradeModal` covers Kite Publisher and writes the reservation
  immediately before opening Kite.

The notice appears only when the requested quantity extends into shares saved
against one or more model portfolios. It offers two pre-calculated choices:
sell only the free shares, or sell the entered quantity and authorize an exact
per-model reduction. There is no free-text input. Choosing the second option
adds `modelAuthorization` to the affected SELL row; the broker payload never
receives that internal field. For Publisher, the returned
`sellReservationRef` is sent to `publisher/record-orders` so backend
reconciliation can close the same hold.

This is deliberately warn-only and fail-open. Preview/reservation failures do
not disable the existing Place Order action, and making no choice preserves
the entered order. After a confirmed fill, the backend lowers the selected
model's saved quantity exactly once without changing cash or target weights.
The copy therefore says that a future rebalance *may suggest buying the shares
back*; it does not claim that an immediate rebalance is required.

Corporate-action math remains backend-owned. The preview scales historical
recommendation fills for applicable splits/bonuses and suppresses the warning
while a demat credit is pending. Mobile renders the returned quantities and
does not independently infer corporate-action ratios.

## 2026-09-29 Server-authoritative broker disconnect/reconnect

`src/utils/brokerStateUtils.js` classifies quick reconnect from the refreshed
server document rather than array-entry presence alone. It returns only safe
metadata (`hasSlot`, status, count, credential readiness, reason and
`requiresOAuth`) and never returns credential values. `SubscriptionScreen` and
`ManageConnectionsModal` verify that a deleted broker slot is absent before
updating local UI or clearing the phone-owned TOTP/API-credential vaults. A
failed or stale server removal stops the workflow instead of creating a local
brokerless/server-connected contradiction.

Fyers keeps only the server user id during OAuth instead of duplicating the
entire account document beside the WebView. This limits account-size-dependent
memory pressure while leaving global TradeContext ownership unchanged.

## 2026-09-28 Design presentation boundary

Runtime behavior belongs to `src/`; replaceable UI belongs to `designs/**`.
Containers resolve registered presentations and supply display-ready
`viewModel`, event callbacks in `actions`, and app-owned collaborators in
`slots`. Design files must not import network/storage/Firebase/navigation,
contexts, services, or src-owned UI. `npm run audit:design` enforces this rule
and currently discovers zero forbidden edges. Payment, Digio, broker and SDK
behavior always remain src-owned even when their visible host is redesigned.
The navigator follows the same rule: it normalizes current-route/tab state and
events, then renders `shell.AppHeader` and `shell.MainTabBar` from the active
variant.

See `DESIGN_SYSTEM_ARCHITECTURE.md` for the full registry and variant contract.

## 2026-09-15 Android Publisher keyboard invariant

Broker Settings and order placement both open Zerodha pages, but they must use
the same focus-safe container. A broker login `WebView` must not be a child of
React Native's native `<Modal>` dialog on Android: the dialog can reassign
window focus as the IME opens, making the keyboard appear and immediately
close. All four order-Publisher entry points now early-return the shared
`src/components/PublisherWebViewOverlay.js` launcher. The launcher renders no
local UI; `PublisherWebViewHost`, mounted in `App.js` above Navigation, owns the
full-window WebView. This keeps the broker page outside both the native Modal
and the portfolio screen/card bounds. The generated HTML `source` also remains
memoized so live price/state renders do not reload the broker page. This is a
shared AlphaB2B/Markup/MoneyMan invariant.

### 2026-09-16 CDSL TPIN rerender isolation

The launcher also freezes the native WebView configuration for the complete
browser session, and the root host is `React.memo`-isolated from application
rerenders. Stable callback wrappers forward to the latest flow logic without
changing native props. This is required for the redirected CDSL TPIN input:
live quote or reconciliation renders must never make Android WebView drop IME
focus while the customer is typing.

As of 2026-09-29 this invariant also covers Fyers
`submit-holdings`: `FyersTpinModal` hides its native information sheet and
mounts the returned CDSL HTML through `PublisherWebViewOverlay`. Opening a
second nested native Modal is forbidden because it can leave the authorization
form visually behind the sheet and lose Android IME/touch focus.

## 2026-09-07 Publisher acknowledgement and foreground recovery

The host-owned model-portfolio Publisher paths in RebalanceModal,
MPReviewTradeModal and UserStrategySubscribeModal share
`src/utils/publisherAcknowledgement.js`: Node intent and Python activation
requests allow 15 seconds; activation requires status 0, recorded true,
reconciliationEnrolled true, and no explicit allowExecution denial. Activation
is not automatically retried on a timeout, and acknowledgement is not a fill.

TradeContext subscribes once to app resume through
`src/utils/portfolioResume.js`, using the current account/config callback.
It refreshes both subscriber status and Repair, with in-flight deduplication,
a 15-second resume throttle and listener cleanup. Normal silent polling still
skips Repair. No client execution-record writes or automatic retry placement
are introduced. Existing Publisher routing, plan identity and sell-auth remain
unchanged; this is host-lane hardening, not an SDK migration.

## Recommendation lifecycle partition

Terminal single-stock records are never active recommendations, even when a
legacy backend row still says `trade_place_status: recommend`. A `cancel`,
terminal trade status, or `closurestatus: fullclose/closed` returns before
Home-feed admission.

## Notification detail modal contract

Notification and recommendation details render inside one viewport-bounded
scroll region. The header and action footer do not shrink or participate in
scrolling; long recommendation/rationale content ends above the fixed action.
The modal uses live window dimensions so rotation, split screen, foldables and
system-bar changes cannot leave an unbounded or unreachable scroll area.
Android overscroll and iOS bounce are disabled for this detail surface so the
end of the recommendation is visually unambiguous.

## Repair reconciliation state lifecycle (2026-08-26)

`TradeContext` owns `{pending,retryAfterSeconds}` and one Repair retry timer.
Consumers never infer this state from empty trades. Customer/broker changes and
provider unmount cancel the timer. Resolution performs a silent strategy-status
refresh without recursively initiating another Repair request.

> **Last updated**: 2026-04-05 (rev 4c869c7)

## Signed OTA activation policy

The native application root is wrapped by Revopush CodePush in `index.js`.
Checks run on launch and app resume. Both optional and mandatory releases
activate on the next clean restart; downloading an update must never restart a
newly installed app while authentication and advisor configuration are being
restored. This keeps startup and active trading sessions free from forced
reloads. Mandatory still describes update priority, not an unsafe activation
mode.

The native Android binary embeds the Production deployment key and OTA public
verification key. OTA may change JavaScript and bundled assets only; native
dependencies, permissions and manifest changes require a new Play Store AAB.
The first eligible Android baseline for this signed OTA policy is
`3.9.108` (`versionCode 108`).

Android bundle ownership is build-type-specific: debug builds leave
`getJSBundleFile()` unset and connect to Metro, while release builds delegate
to CodePush for signed OTA or embedded fallback resolution. A debug APK never
requests the release-only `assets://index.android.bundle` path.
The debug source set permits cleartext solely for Metro's local HTTP endpoint;
the main/release network-security policy continues to reject cleartext.
The `index.js` root is also wrapped with CodePush only outside `__DEV__`, so an
OTA cannot restart a local Metro session into a release bundle.

## Native modal window lifecycle (2026-09-23)

On React Native 0.78 New Architecture, shared Android modal components remain
mounted with their visibility prop set to false. Do not conditionally remove a
native modal root on the same state transition that closes its window. The
v85/v86 OTA experiment that did this caused the Android process to terminate on
both Android 12 and Android 16 while users moved through Home, Broker, More and
broker reconnect screens.

`ProfileModal` remains mounted and performs its post-save parent refresh from
`onModalHide`. Broker disconnect/manage modals on `SubscriptionScreen` and the
tab-level holdings-migration modal likewise stay mounted and receive their
closed visibility state. New modal lifecycle changes need an authenticated
Android device test on both an older supported Android release and the current
release; source-contract tests alone cannot validate Fabric native-root
teardown.

> **Covers**: React Native mobile app (`Alphab2bapp`), Node.js backend (`aq_backend_github`), Python backend (`ccxt-india`)
> **Consistency with**: `prod-alphaquark-github` (web app)

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Broker Connection Architecture](#3-broker-connection-architecture)
4. [Trade Execution Architecture](#4-trade-execution-architecture)
5. [Model Portfolio Execution Architecture](#5-model-portfolio-execution-architecture)
6. [Broker Data Management](#6-broker-data-management)
7. [State Management](#7-state-management)
8. [File Reference](#8-file-reference)
9. [Web Parity Status](#9-web-parity-status)

---

## 1. Overview

The AlphaQuark B2B mobile app is a React Native application that enables advisory clients to:
- Connect to 14 stock brokers and manage sessions
- Receive and execute trade recommendations from advisors
- Subscribe to model portfolios and execute rebalance signals
- Track portfolio P&L with real-time WebSocket prices

**Supported brokers:** Zerodha, Angel One, Upstox, ICICI Direct, Kotak, Dhan, Fyers, IIFL Securities, AliceBlue, Motilal Oswal, Hdfc Securities, Groww, Axis Securities, DummyBroker (simulation)

**Shared backend:** The mobile app shares the same Node.js (`aq_backend_github`) and Python (`ccxt-india`) backends as the web app (`prod-alphaquark-github`).

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MOBILE APP (React Native)                          │
│  Alphab2bapp                                                            │
│                                                                         │
│  ┌─────────────────────┐  ┌────────────────────┐  ┌─────────────────┐  │
│  │ Screens              │  │ Components          │  │ State Mgmt      │  │
│  │                      │  │                     │  │                 │  │
│  │ Home/                │  │ BrokerConnection    │  │ TradeContext     │  │
│  │   HomeScreen         │  │   Modal/ (15 files) │  │ ConfigContext    │  │
│  │   OrderScreen        │  │                     │  │ MultiBroker     │  │
│  │   WatchlistScreen    │  │ AdviceScreen        │  │   Context       │  │
│  │                      │  │   Components/       │  │ GstConfig       │  │
│  │ Drawer/              │  │   (21 files)        │  │   Context       │  │
│  │   ModelPortfolio     │  │                     │  │                 │  │
│  │   Screen             │  │ ModelPortfolio      │  │ AsyncStorage    │  │
│  │   MPPerformance      │  │   Components/       │  │   (persistent)  │  │
│  │   Screen             │  │   (15 files)        │  │                 │  │
│  │                      │  │                     │  │ EventEmitter    │  │
│  │ PortfolioScreen/     │  │ ReviewTradeModal    │  │   (cross-comp)  │  │
│  │ Authentication/      │  │ DdpiModal           │  │                 │  │
│  │                      │  │ KitePublisherModal  │  │                 │  │
│  └──────────┬───────────┘  └─────────┬──────────┘  └────────┬────────┘  │
│             │                        │                       │           │
│  ┌──────────┴────────────────────────┴───────────────────────┴────────┐  │
│  │                      UTILITIES & SERVICES                          │  │
│  │                                                                    │  │
│  │  brokerSessionUtils  brokerAuth      brokerSupport                │  │
│  │  brokerPublisher     ProcessTrades   rebalanceHelpers             │  │
│  │  tradeUtils          orderStatusUtils portfolioEvents             │  │
│  │  SecurityTokenManager storageUtils    serverConfig                │  │
│  │  BrokerOrderBookAPI  ReconciliationService  ZerodhaOAuthService   │  │
│  └────────────────────────────┬──────────────────────────────────────┘  │
└───────────────────────────────┤──────────────────────────────────────────┘
                                │
              ┌─────────────────┤──────────────────┐
              ▼                                    ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────────┐
│  NODE.JS BACKEND                 │  │  PYTHON BACKEND (ccxt-india)         │
│  aq_backend_github               │  │                                      │
│                                  │  │  Per-Broker Apps:                    │
│  Routes:                         │  │  - apps/app_zerodha.py              │
│  - Routes/multiBrokerRoutes.js   │  │  - apps/app_angelone.py             │
│  - Routes/Broker/zerodha.js      │  │  - apps/app_upstox.py              │
│  - Routes/Broker/ProcessTrades.js│  │  - apps/app_icici.py               │
│  - Routes/Broker/Kotak.js        │  │  - apps/app_kotak.py               │
│  - Routes/Broker/Fyers.js        │  │  - ... (14 brokers)                 │
│  - Routes/Broker/upstox.js       │  │                                      │
│  - Routes/Broker/icici.js        │  │  Trading Logic:                      │
│  - Routes/Broker/Hdfc.js         │  │  - trading_logic/                   │
│  - Routes/Broker/Axis.js         │  │      buy_sell_all_brokers.py         │
│  - Routes/Broker/Motilaloswal.js │  │                                      │
│                                  │  │  Rebalancing:                        │
│  Models:                         │  │  - rebalancing/rebalancing.py        │
│  - Models/userModel.js           │  │  - rebalancing/utils/db_manager.py  │
│  - Models/tradeReco.js           │  │                                      │
│  - Models/modelPortfolioModel.js │  │  Broker Implementations:            │
│  - Models/modelPortfolioUser.js  │  │  - brokers/ directory               │
│                                  │  │  - BrokerInterface (ABC)             │
│  Brokers:                        │  │                                      │
│  - brokers/BrokerFactory.js      │  │  Advice Delivery:                   │
│  - brokers/ZerodhaBroker.js      │  │  - advice/send/reco.py              │
│  - brokers/AngelOneBroker.js     │  │  - advice/fcm_notifier.py           │
│  - ... (13 broker files)         │  │                                      │
│                                  │  │  Apps:                               │
│  Cron:                           │  │  - apps/app_order.py (GTT, orders)  │
│  - CronJob/brokerTokenRefresh.js │  │  - apps/app_gtt.py                  │
│                                  │  │  - apps/app_broker_capabilities.py  │
│  Utilities:                      │  │                                      │
│  - utilities/encryptionUtils.js  │  │                                      │
└──────────────────────────────────┘  └──────────────────────────────────────┘
```

**Server Endpoints:**
```
ccxtServer: https://ccxtprod.alphaquark.in/   (broker APIs, order execution)
server:     https://server.alphaquark.in/      (business logic, user management)
websocket:  https://websocket.alphaquark.in/   (real-time price feeds)
```

---

## 3. Broker Connection Architecture

### 3.1 Overview

The broker connection system manages authentication, credential storage, and session lifecycle for 14 supported brokers. The mobile app uses WebView-based OAuth (no deep linking) for OAuth brokers and direct credential forms for credential-based brokers.

### 3.2 Authentication Flows

#### OAuth-Based Brokers (WebView)

```
User enters credentials (API Key, Secret Key, etc.)
    │
    ▼
Frontend sends to Node.js backend
    │  e.g., PUT /api/zerodha/update-key
    │
    ▼
Node.js validates, stores encrypted credentials
    │  Calls Python: POST /{broker}/login-url
    │
    ▼
Python returns OAuth login URL
    │
    ▼
Mobile opens WebView with OAuth URL
    │  WebView monitors URL changes via
    │  handleWebViewNavigationStateChange()
    │
    ▼
User logs in at broker's OAuth page
    │
    ▼
Broker redirects to callback URL with auth code
    │  WebView intercepts redirect URL
    │  Extracts auth_code/request_token from query params
    │
    ▼
Frontend exchanges auth code for access token
    │  e.g., POST /zerodha/gen-access-token
    │
    ▼
Token stored → broker status updated → UI refreshed
    brokerSessionUtils.saveBrokerSessionTime(broker)
```

**OAuth brokers:** Zerodha, Upstox, Fyers, Groww, Axis, Motilal Oswal, ICICI Direct

#### Credential-Based Brokers

```
User enters credentials in form
    │
    ▼
Frontend sends to Node.js:
    │  PUT /api/user/connect-broker
    │  Body: { broker, clientCode, jwtToken/apiKey, ... }
    │
    ▼
Node.js validates with Python backend
    │  Stores encrypted credentials (AES-256-CBC)
    │
    ▼
Returns success → Toast notification → Context updated
```

**Credential-based brokers:** Angel One, AliceBlue, Dhan, IIFL Securities, Hdfc Securities, Kotak

### 3.3 Per-Broker Auth Details

| Broker | Auth Type | Credentials Required | Token Expiry | Special |
|--------|-----------|---------------------|--------------|---------|
| **Zerodha** | OAuth | apiKey, secretKey | Daily ~6AM IST | Kite Publisher SDK, GTT/OCO |
| **Angel One** | OAuth (nonce) | apiKey (from config) | ~24h | Surveillance check, EDIS/TPIN |
| **Upstox** | OAuth PKCE | apiKey, secretKey | ~24h | GTT, OCO |
| **ICICI Direct** | OAuth | apiKey, secretKey | Session | Manual mandate for SELLs |
| **Kotak** | Credential (MPIN+TOTP) | mobile, mpin, totp | ~1h | TOTP on every reconnect |
| **Dhan** | Credential | clientCode, jwtToken | Session | DDPI/TPIN for sells |
| **Fyers** | OAuth | clientCode, secretKey | Session | Publisher SDK, TPIN |
| **Groww** | OAuth PKCE | None (OAuth handles) | Session | Max 5 connections |
| **AliceBlue** | Credential | clientCode, apiKey | 24h | Daily API key regeneration |
| **Motilal Oswal** | OAuth | clientCode, apiKey | Session | — |
| **Axis Securities** | OAuth | None (OAuth handles) | Session | — |
| **Hdfc Securities** | Credential | accessToken | Session | — |
| **IIFL Securities** | Credential | clientCode, jwtToken | Session | — |
| **DummyBroker** | None | None | Never | Simulation only |

### 3.4 OAuth State Management

**File:** `src/utils/brokerAuth.js`

```
generateState(broker, returnPath):
    │
    ├── Creates JSON: { broker, returnPath, timestamp, nonce, platform }
    ├── Base64-encodes the JSON
    └── Returns: base64 string (passed as ?state= in OAuth URL)

registerCallback(broker, returnPath):
    │  For brokers that don't return state (Angel One, AliceBlue)
    ├── POST https://alphaquark.in/api/deploy/broker/register
    └── Returns: nonce string

saveOAuthState(broker, state):
    │  Stores in AsyncStorage for validation on callback
    └── Key: @broker:oauthState:{broker}

validateOAuthState(broker, returnedState):
    │  Compares returned state against stored state
    └── Expires after 10 minutes
```

### 3.5 Multi-Broker Context

Basket position ownership is broker-scoped. The recommendation feed may be
shared across the customer's linked accounts, but an executed leg retains its
recorded `user_broker`. `basketLifecycle.positionBroker(s)` identifies where
the open exposure lives. When another broker is active, the basket card shows
“Switch to <broker>” and does not open the exit review. The execution backend
independently enforces the same rule, so an older app cannot turn a close into
a new position in the wrong account.

**File:** `src/context/MultiBrokerContext.js`

```javascript
MultiBrokerContext = {
  // State
  connectedBrokers: [],              // Array of connected broker objects
  selectedBroker: null,              // Currently active broker
  brokerHoldings: {},                // { "Zerodha": [...], "Angel One": [...] }
  aggregatedHoldings: [],            // Combined across all brokers
  brokerFunds: {},                   // { "Zerodha": { availablecash: N }, ... }
  isLoading: Boolean,
  errors: {},                        // { "Zerodha": "Token expired", ... }

  // Methods
  setBrokerHoldings(broker, holdings),
  setBrokerFunds(broker, funds),
  setBrokerError(broker, error),
  getBrokerStatus(broker),           // Returns BROKER_STATUS enum
  getTotalValue(),                   // Sum across all brokers
  getTotalPnL(),                     // Aggregated P&L
  resetBrokerData(broker),
}
```

**Status Constants:**
```javascript
BROKER_STATUS = {
  CONNECTED: "connected",
  EXPIRED: "expired",
  ERROR: "error",
  DISCONNECTED: "disconnected",
}
```

### 3.6 Token Expiry Detection

Three mechanisms:

1. **Backend cron job** (every 30 minutes):
   - `CronJob/brokerTokenRefresh.js` → `checkExpiredTokens()`
   - Sets status to "expired" for tokens past `token_expire` date

2. **API call failure** (runtime):
   - `BrokerOrderBookAPI.js` detects `TOKEN_EXPIRED` in responses
   - Returns `{success: false, tokenExpired: true}`

3. **Session freshness check** (frontend):
   - `brokerSessionUtils.isBrokerSessionFresh(broker)`
   - Compares session date in AsyncStorage to today (IST)
   - Used before order placement

### 3.7 Credential Encryption

```
Frontend:
  CryptoJS.AES.encrypt(apiKey, "ApiKeySecret")  →  sends to Node.js

Node.js:
  CryptoJS.AES.decrypt(data, "ApiKeySecret")     →  recovers plaintext
  encryptionUtils.encrypt(plaintext)              →  AES-256-CBC for DB storage

What gets encrypted:
  apiKey: Yes (AES-256-CBC)
  secretKey: Yes (AES-256-CBC)
  jwtToken: No (rotated frequently)
  clientCode: No (not sensitive)
```

### 3.8 Broker Disconnection

```
User clicks "Disconnect" in ManageConnectionsModal
    │
    ▼
API: DELETE /api/user/disconnect-broker
    │  Body: { broker }
    │
    ├── Removes from connected_brokers array
    ├── Groww: POST /groww/revoke (frees connection slot)
    │
    ▼
MultiBrokerContext.resetBrokerData(broker)
```

### 3.8.1 Smart Re-auth Routing (2026-04-21)

Session-expired re-auth for credential brokers (Upstox / ICICI Direct / HDFC Securities / Motilal Oswal / Fyers) no longer re-prompts for API Key + Secret. Orchestration lives in `src/utils/reauthHelpers.js` (`handleSmartReauth`, `flipPrimaryBroker`) and flows payload through the modal store.

```
User taps "Reconnect" in ManageConnectionsModal
    │
    ▼
flipPrimaryBroker → PUT /api/user/brokers/{broker}/primary
    │  (intent-to-primary up-front — matches web)
    │
    ▼
handleSmartReauth(brokerName, ...)
    │
    ├── broker ∉ CREDENTIAL_REAUTH_BROKERS → returns {handled:false}
    │      (partner OAuth / Kotak / Groww / IIFL fall through)
    │
    ├── GET /api/user/brokers/{broker}/reauth-url
    │      response.requiresTotp  → Kotak path, {handled:false}
    │      response.requiresForm  → Groww path, {handled:false}
    │      response.url absent    → {handled:false}
    │
    ├── getStoredBrokerCreds(userDetails, broker)
    │      → decrypts entry.apiKey / entry.secretKey (AES 'ApiKeySecret')
    │      no creds readable      → {handled:false}
    │
    ▼
useModalStore.openModal(modalKey, { reauthConfig: { authUrl, apiKey, secretKey, clientCode } })
    │
    ▼
ModalManager forwards modalPayload.reauthConfig as prop to the per-broker modal
    │
    ▼
Modal's reauthConfig useEffect: setApiKey / setSecretKey / setAuthUrl / setShowWebView(true)
    │  (skips credential form entirely; existing WebView → code-exchange →
    │   connect-broker pipeline runs unchanged)
```

On any `{handled: false}` return, `ManageConnectionsModal.handleReconnect` falls back to the prior path: `openModal(modalKey)` with no payload, so the user sees the full credential form.

Supporting files:
- `src/utils/reauthHelpers.js` — orchestration (`CREDENTIAL_REAUTH_BROKERS` set, smart router, primary flip).
- `src/utils/brokerCredentials.js` — reads `userDetails.connected_brokers[]` and decrypts with the existing `'ApiKeySecret'` passphrase.
- `src/GlobalUIModals/modalStore.js` — `modalPayload` field; `openModal(name, payload)` accepts payload, `closeModal` clears it.
- `src/GlobalUIModals/ModalManager.js` — forwards `modalPayload.reauthConfig` to all per-broker modals.
- `src/components/BrokerConnectionModal/{upstoxModal, icicimodal, HDFCconnectModal, MotilalModal, FyersConnect}.js` — each accepts `reauthConfig` and hydrates WebView state in a `useEffect`.

See `BROKER_CONNECTION.md` → *Smart re-auth routing (2026-04-21)* for the per-broker breakdown and the Fyers naming-swap note.

### 3.8.2 "+ Connect new broker" CTA in Manage Connections (2026-04-21)

`ManageConnectionsModal` now renders a dashed-outline "+ Connect new broker" button above the connections list when the parent supplies an `onAddBroker` callback. `SubscriptionScreen.js` wires it to close Manage Connections and open `BrokerSelectionModal` (same modal path as the first-broker connect flow). Previously users had to exit Settings to add a 2nd/3rd broker because the top-level connect CTA only rendered when zero brokers were connected.

### 3.9 EDIS / DDPI / TPIN Authorization

Authorization required for SELL orders on certain brokers:

| Broker | Authorization | Detection | Modal |
|--------|--------------|-----------|-------|
| **Zerodha** | DDPI | `ddpi_status` field | `DdpiModal.js` |
| **Angel One** | EDIS/TPIN | `checkAngelOneEDIS()` API | TPIN modal in StockAdvices |
| **Dhan** | EDIS/TPIN | `is_authorized_for_sell` | Dhan TPIN modal |
| **Fyers** | TPIN | `is_authorized_for_sell` | Fyers TPIN modal |
| **ICICI Direct** | Manual Mandate | CDSL error detection | Manual sell instructions |

#### Zerodha DDPI / Auth-Sell Request

**File:** `src/components/DdpiModal.js`

The Zerodha auth-sell endpoint requires per-user credentials so the backend can fetch the correct per-user `apiKey` from the database (via `get_zerodha_credentials_with_fallback()`). The request must include:

```
POST {ccxtServer}/zerodha/auth-sell
Headers:
    Content-Type: application/json
    X-Advisor-Subdomain: configData.advisorTag
    aq-encrypted-key: configData.aqEncryptedKey
Body:
    accessToken: userDetails.jwtToken
    userEmail: userDetails.email          ← REQUIRED for per-user credential lookup
```

Without `userEmail`, the backend falls back to the shared `ZERODHA_API_KEY` environment variable, which may not match the user's registered Zerodha app. This was fixed in commit `4c869c7`.

### 3.10 Web-Parity Alignment Plan (2026-04-17)

Mobile broker-connection flows are being aligned endpoint-by-endpoint with the user-side web flow in `prod-alphaquark-github`. Same endpoints, same handshake owner (backend vs client), same credential persistence path. The WebView-vs-full-page-redirect container difference is mobile-inherent and stays.

Authoritative plan — per-broker actions, file list, and sequencing — lives in [`BROKER_CONNECTION.md` → Web-Parity Alignment Plan](BROKER_CONNECTION.md#web-parity-alignment-plan-2026-04-17). Summary of target state:

| Broker | Action | Risk |
|--------|--------|------|
| Zerodha, Fyers, Motilal | Swap `ccxt/X/login-url` entry for Node's `*/update-key` | Low |
| Upstox | Payload-shape parity audit | Low |
| ICICI Direct, Axis | Stop client-side handshake interception; let server callback finish | Medium |
| AliceBlue | Route through CCXT origin-tracking entry web uses | Medium |
| HDFC | Route entry through `/api/hdfc/update-key`; audit client-side token exchange | Medium-high |
| Groww | Drop client-side PKCE; use `ccxt/groww/login/oauth?redirectUri=…` | High |
| Angel One, Kotak, Dhan | Already aligned — no change | — |
| IIFL | Not on web; mobile-only, keep as-is (flag for product) | — |
| DummyBroker | Mobile-only simulation, keep | — |

Each broker lands in its own commit so regressions are bisectable.

### 3.11 Post-Connect Holdings Migration Flow

When a user switches their primary broker (e.g., Zerodha → AliceBlue), any model portfolio holdings recorded under the old broker become orphaned. The migration flow lets the user choose per-portfolio whether to carry those holdings forward or start fresh.

**Trigger:** `TradeContext.fetchBrokerStatusModal()` calls the migration-summary API immediately after a broker connection succeeds and funds refresh. If `requiresMigration: true`, `HoldingsMigrationModal` is shown.

**Timing fix (2026-04-24):** The modal is delayed 700 ms via `setTimeout` so `navigation.goBack()` animation (~300 ms) fully completes before the bottom sheet slides up. Without the delay the sheet rendered mid-navigation, its white background hiding the "Your Broker & Funds Info" card rows in `SubscriptionScreen` — the card appeared truncated (title only visible). Web prod equivalent: migration check fires only after the user clicks "Continue" on the broker-success dialog, guaranteeing the screen is settled.

**Component:** `src/components/HoldingsMigrationModal.js`

**Rendered at:** `src/components/Navigation.js` — inside `MainTabNavigator`, controlled by `showMigrationModal` / `setShowMigrationModal` / `migrationBroker` exported from `TradeContext`.

**Flow:**

```
Broker connects successfully
    │
    ▼
fetchBrokerStatusModal() in TradeContext
    ├── getUserDeatils()
    ├── fetchFunds() with fresh credentials
    └── GET /api/model-portfolio-db-update/broker-migration-summary/{email}?newBroker={broker}
            │
            ├── requiresMigration: false → nothing shown
            │
            └── requiresMigration: true
                    │
                    ▼  (after 700 ms delay)
                HoldingsMigrationModal slides up (bottom sheet)
                    │
                    ├── isReconnection (all models already have new-broker holdings)
                    │       → "You're good to go!" → user taps Continue
                    │
                    ├── modelsWithHoldings.length === 0
                    │       → "No portfolios to migrate." → user taps Continue
                    │
                    └── models with old-broker holdings to migrate
                            → per-model choice: Carry Forward | Start Fresh
                            → POST /api/model-portfolio-db-update/handle-broker-migration
                            → modal closes
```

**State in TradeContext:**
- `showMigrationModal` — Boolean, controls modal visibility
- `setShowMigrationModal` — setter (also used by modal's onClose / onMigrationComplete)
- `migrationBroker` — broker name string passed to modal as `newBroker`

**Parity with web:** `prod-alphaquark-github/src/Home/ModelPortfolioSection/HoldingsMigrationModal.js` — same API endpoints, same action vocabulary (`migrate`/`empty`). Web gates the check behind a "Continue" button click; mobile gates it behind the 700 ms navigation-settle delay. Functionally equivalent.

---

## 4. Trade Execution Architecture

### 4.1 Overview

The trade execution flow follows a recommendation → cart → review → execute pipeline. Advisors create BUY/SELL recommendations which are delivered to clients via email, WhatsApp, Telegram, and FCM push. Clients review, select, and place orders through their connected broker.

#### Recommendation visibility window

How old a recommendation can be and still appear on Home / Recommendations is controlled by the advisor-level setting **`advice_show_latest_days`** (`AllAdvisorDetails` in `aq_backend_github`; admin UI field: "Recommendation visibility"). The app fetches it via `GET /api/admin/frontend-config` inside `TradeContext.fetchAdviceShowDays` and reads it from **`response.data.data.adviceShowLatestDays`** (the payload shape is `{ success, data: { adviceShowLatestDays } }`). The value flows into `adviceShowDays` state, is clamped to 1–365, and is sent as `days` on `GET /api/user/trade-reco-for-user`. The backend therefore bounds historical data before JSON serialization and before it crosses the React Native bridge. Its history-window helper deliberately retains older executed/open positions, so live position and closure safety are not sacrificed. The same value is also applied as `cutoffDate = today - adviceShowDays` in the client reduce, and every recommended/rejected/ignored trade must satisfy the relevant visibility rules to be surfaced. If the frontend-config fetch fails or returns an out-of-range value, the app falls back to 15 days.

`TradeContext` includes the current account, advisor and recommendation-window value in its single-flight request key. A request generation token discards responses superseded by a newer window or by an account/advisor switch. At an identity boundary the in-memory recommendation, rejected, ignored, plan and fetch-completion state is cleared; encrypted device broker credentials are not cleared because their vault entries are independently scoped by advisor, broker and customer email.

Backend note: the admin UI POSTs to `/api/update-terms-conditions`, which writes to both `AdminAccess.adviceShowLatestDays` (legacy fallback) and `AllAdvisorDetails.advice_show_latest_days` (the field `/admin/frontend-config` reads first). Previously only the former was written, so refreshes reverted the UI to the schema default (`7`).

### 4.2 Recommendation Flow

```
┌───────────────────────────────────────────────────────────────────┐
│  ADVISOR SIDE (Backend)                                           │
│                                                                   │
│  advice/send/reco.py → Recommendation.send_advice_from_data()    │
│    1. Save to traderecos collection (per recipient)               │
│    2. Send email notification                                     │
│    3. Send WhatsApp via gateway                                   │
│    4. Send Telegram to group                                      │
│    5. Send FCM push notification                                  │
└──────────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  CLIENT SIDE (Mobile App)                                         │
│                                                                   │
│  [StockAdvices.js] ─ fetches recommendations                     │
│       │  API: GET /api/user/trade-reco-for-user                    │
│       │       ?user_email={email}&days={configuredWindow}          │
│       │                                                           │
│       ├── "Recommendations" Tab  (trade_place_status = "recommend")
│       ├── "Ignored" Tab          (trade_place_status = "ignored") │
│       └── "Rejected" Tab         (trade_place_status = "rejected")│
│                                                                   │
│  [AddtoCartModal.js] ─ individual recommendation card + cart      │
│       │  Checkbox to select, quantity adjustment                  │
│       │  Live LTP via WebSocket                                   │
│       │  Advised range, SL, PT display                            │
│       │                                                           │
│       ▼                                                           │
│  [ReviewTradeModal.js] ─ order review + execution                │
│       │  Angel One surveillance check (automatic)                 │
│       │  Fix Size algorithm (proportional allocation)             │
│       │  Slide-to-execute confirmation                            │
│       │                                                           │
│       ▼                                                           │
│  [ProcessTrades.js] ─ centralized order pipeline                 │
│       │  Builds broker-specific payload                           │
│       │  Separates GTT vs regular orders                          │
│       │  Routes to correct API endpoint                           │
│       │  Detects EDIS/TPIN failures → triggers auth modals        │
│       │                                                           │
│       ▼                                                           │
│  Post-order: refresh recommendations, clear cart, update holdings │
└───────────────────────────────────────────────────────────────────┘
```

### 4.3 Cart System

The mobile app uses AsyncStorage-based cart with event-driven sync:

```
Cart Operations:
    │
    ├── Add to cart:    AsyncStorage.setItem('cartItems', [...])
    ├── Remove:         Filter and save back
    ├── Clear:          AsyncStorage.removeItem('cartItems')
    │
    ├── Events:
    │   ├── 'cartUpdated'   → triggers cart count refresh
    │   └── 'stockRemoved'  → triggers individual removal
    │
    └── Zerodha-specific: 'stockDetailsZerodhaOrder' key
```

### 4.4 Centralized Trade Processing

**File:** `src/utils/ProcessTrades.js`

```
createPlaceOrderFunction({broker, credentials, userEmail, ...callbacks})
    │
    │  Returns: async placeOrders(stockDetails)
    │
    ├── 1. Separate GTT orders from regular orders
    │      gttOrders = stockDetails.filter(s => s.gttCheck)
    │      regularOrders = stockDetails.filter(s => !s.gttCheck)
    │
    ├── 2. Place GTT orders via broker-specific endpoint
    │      POST {ccxtServer}{brokerUrl}/process-trades
    │      Payload includes leg details (entry, SL, PT)
    │
    ├── 3. Place regular orders via unified endpoint
    │      POST {server}api/process-trades/order-place
    │
    ├── 4. Detect EDIS/TPIN failures
    │      Scans response for CDSL/EDIS/TPIN keywords
    │      Triggers onTpinRequired(broker, failedOrders) callback
    │
    ├── 5. Detect session expiry
    │      Triggers onSessionExpired() callback
    │
    └── 6. Return results
          { success, results, sessionExpired? }
```

**Broker credential mapping:**

| Broker | Fields Sent |
|--------|------------|
| Zerodha | `jwtToken` only (server fetches rest) |
| Angel One | `apiKey` (from config) + `accessToken` |
| Upstox | `apiKey` + `apiSecret` + `accessToken` (AES decrypted) |
| ICICI Direct | `apiKey` + `secretKey` + `accessToken` (AES decrypted) |
| Kotak | `apiKey` + `secretKey` + `jwtToken` + `sid` + `serverId` |
| IIFL Securities | `clientCode` + `jwtToken` |
| Dhan | `clientCode` + `accessToken` |
| Fyers | `clientCode` + `accessToken` |
| Motilal Oswal | `apiKey` + `clientCode` + `jwtToken` |
| AliceBlue | `clientCode` + `apiKey` + `accessToken` |
| Hdfc Securities | `apiKey` (AES decrypted) + `accessToken` |
| Groww | `accessToken` |
| Axis Securities | `authToken` + `subAccountId` |

### 4.5 GTT (Good Till Triggered) Orders

Supported by Zerodha and Upstox via the app.

```
GTT Order Structure:
    entryLeg: { Type: "BUY", orderType, price, triggerPrice }
    leg1 (SL): { Type: "SELL", orderType, price, triggerPrice }
    leg2 (PT): { Type: "SELL", orderType, price, triggerPrice }

GTT Flow:
    1. Advisor creates recommendation with gttOrdersCheck = true
    2. Client sees GTT details on recommendation card
    3. GTT orders separated: stockDetails.filter(s => s.gttCheck)
    4. Sent to broker-specific endpoint: POST {ccxtServer}/{broker}/process-trades
    5. Backend places GTT rule on broker
    6. GTT remains active until price trigger, cancellation, or expiry
```

**Aligned with web as of 2026-04-17** (`prod-alphaquark-github/src/Home/ProcessTrades/ProcessTrades.js:93-144, :346`):

- **Leg shape**: mobile now places each `{entryLeg, leg1, leg2}` object **inside** the per-trade object in `trades[]` (not at the payload top level) and transforms capitalized leg fields (`Symbol` → `tradingSymbol`, `Exchange` → `exchange`, `Type` → `transactionType`, `OrderType` → `orderType`, `ProductType` → `productType`). `parseFloat()` is applied to `triggerPrice` and `ltp`, both feeding `price`. `quantity` is pulled from `stock.quantity` per-trade. See `buildOrderPayload` in `src/utils/ProcessTrades.js`.
- **Response path**: mobile now treats the GTT response body as a top-level array (`Array.isArray(gttResponse)` → spread into `allResults`) matching web's `response.data[0]` reading. A backwards-compat branch retains the old `{response: [...]}` envelope path in case any backend version returns that shape.

#### Orders-history relevance rule (2026-07-18)

`src/screens/Home/OrderScreen.js` receives the mixed historic trade feed from
`GET /api/user/trade-reco-for-user`. Before it reaches the Orders presentation,
normal pending/AMO rows are retained only when their order date is today. A GTT
row is the explicit exception: it remains visible while pending because its
trigger is intentionally valid beyond a single trading day. The recogniser
accepts the legacy GTT shapes (`gttCheck`, `gtt_check`, `isGTT`, `gttId`,
`gtt_id`, nested `gtt.id`, and GTT order-type strings). `manually_placed` is
completed customer action, not pending history, and is retained. This prevents
stale pending rows from inflating the Orders Pending filter or presenting an
old inactionable order as current work.

Rows with no persisted broker/trade status are classified as **unavailable**,
not pending. They remain visible in All for historical transparency, but do not
inflate Pending or appear when the customer selects that actionable filter.

### 4.5.0 Cart vs Trade-Intent State Separation (2026-04-17)

**Files:** `src/components/AdviceScreenComponents/StockAdvices.js`

Mobile previously conflated two concepts that web keeps separate: **cart state** (the persistent set of stocks the user has selected to trade at some point) and **trade-intent state** (the exact list of stocks about to be submitted to the broker via `ReviewTradeModal`). `updateCartStates(items)` was writing BOTH `cartContainer` AND `stockDetails` from the same source, which meant that any "add to cart" side effect — including the one triggered internally by `handleSingleSelectStock` before opening the review modal — leaked the **entire cart** into the single-stock review. Users clicking "Trade Now" on one stock would see every stale cart item (including rejected trades from prior sessions) in the review modal.

**After 2026-04-17** the two states are separated, matching web (`prod-alphaquark-github/src/Home/StockRecommendation/NewStockCard.js:561-587` + `StockRecommendation.js:544` where `stockDetails` is its own state):

| State | Represents | Source of writes |
|-------|-----------|------------------|
| `cartContainer` | The live cart (AsyncStorage-backed on mobile; `/api/cart` on web) | `updateCartStates`, `fetchCartItems`, `syncCartWithStockDetails` effect, `handleRemoveAllSelectedStocks`. UI reads for badges, "Trade (N)" count, `isSelected` on each card. |
| `stocksWithoutSource` | Cart items for the "Ignore Trades" drawer view | `syncCartWithStockDetails` effect |
| `stockDetails` | Stocks about to be traded (`ReviewTradeModal` reads this) | Explicit writes only — never from cart sync. See boundary rules below. |

**Boundaries that write `stockDetails`:**

- `handleSingleSelectStock` — "Trade Now" on a single card → `setStockDetails([newStock])` then `setTimeout(() => setOpenReviewTrade(true), 0)`. The deferral matches web `NewStockCard.js:585-587` and ensures React commits the single-stock value before the modal reads it.
- `handleTrade` / `handleTradeNow1` — bottom-bar "Trade (N)" button → merges `cartContainer` with any existing `stockDetails` edits (quantity/price changes) before setting `stockDetails` to the merged list.
- `handleRemoveAllSelectedStocks` — clears to `[]` after successfully removing everything from cart.
- `syncCartWithStockDetails` useEffect — **no longer writes `stockDetails`**. Only populates `cartContainer` + `stocksWithoutSource` on mount/type-change.

### 4.5.1 Trade-Placement Response Handling

**File:** `src/utils/ProcessTrades.js`

Response parsing in `executeOrder` and `detectEdisFailures` aligns with web (`prod-alphaquark-github/src/Home/ProcessTrades/ProcessTrades.js`) as of 2026-04-17:

| Behavior | Mobile | Web reference |
|----------|--------|---------------|
| Rejected status match | Case-insensitive 9-variant set: `REJECTED`/`Rejected`/`rejected`, `CANCELLED`/`Cancelled`/`cancelled`, `FAILURE`/`Failure`/`failure` | `ProcessTrades.js:363-373` |
| Session expiry (HTTP) | 401 / 403 → `err.sessionExpired = true` → `onSessionExpired` callback fires | Web `error.response.status === 401 \|\| 403` at `:451` |
| Session expiry (network) | `fetch` throw (no response) → same tagged error as 401/403 | Web `error.code === 'ERR_NETWORK' \|\| 'ECONNABORTED'` at `:449` |
| Session expiry (body flag) | `regularResponse?.sessionExpired === true` → `onSessionExpired` (backwards-compat path) | Not present on web |
| Fyers TPIN modal trigger | `hasExplicitSellAuthRejection` accepts only backend `SELL_AUTH_REQUIRED` / `SELL_AUTH_REVOKED` classifications or equivalent explicit flags | Same broker-evidence-first rule on web; generic rejected SELLs retain their actual error |

For Fyers, keyword prose, an empty response, a timeout, insufficient funds,
restricted scrips or invalid API-app permissions must never drive recovery.
Those outcomes remain visible in the result/error UI. Other brokers retain
their existing broker-specific gates until migrated independently.

### 4.5.2 Trade `variant` field — AMO vs REGULAR (2026-05-01)

**Files:** `src/utils/ProcessTrades.js`, `src/components/AdviceScreenComponents/StockAdvices.js`, `src/components/AdviceScreenComponents/RebalanceModal.js`, `src/components/ModelPortfolioComponents/MPReviewTradeModal.js`, `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js`, `src/components/ModelPortfolioComponents/RecommendationSuccessModal.js`.

**Field contract** (intended to be the first piece of a future SDK trade contract — when bespoke + basket execution migrate from legacy ccxt/Node to the SDK lane the way Phase 3 broker-connect did, this field stays):

| Property | Value |
|----------|-------|
| Field name | `variant` |
| Values | `"AMO"` \| `"REGULAR"` (string literal — leaves room for future `"GTT"`, `"OCO"`, `"BO"`, `"CO"`) |
| Default fallback when missing | `"REGULAR"` (treat as live order — safer than treating regular as AMO) |
| Where computed | Frontend at submit time |
| Where echoed | Node `aq_backend_github/Routes/Broker/ProcessTrades.js` `/api/process-trades/order-place` echoes back from input → output |
| Where displayed | `RecommendationSuccessModal` (RN) — amber pill next to PLACED/PENDING/REJECTED status pill on every result card whose variant is AMO |

**Detection rule.**

```js
variant = (!IsMarketHours() && allowAfterHoursOrders === true) ? "AMO" : "REGULAR"
```

`IsMarketHours()` is the existing 09:15–15:30 IST gate at `src/utils/isMarketHours.js`. `allowAfterHoursOrders` flows from `appadvisors.allowAfterHoursOrders` / `featureFlags.allowAfterHoursOrders` through `ConfigContext`. The same `allowAfterHoursOrders` flag is already used by the review-trade `marketGateOpen` check (`src/components/ReviewTradeModal.js:71-72`, `src/components/AdviceScreenComponents/RebalanceModal.js:1764-1765`) to BLOCK submission when the flag is off — so:

- Tenant `allowAfterHoursOrders === false`: review-trade modal blocks after-hours submission. Variant is irrelevant — user never gets a result card.
- Tenant `allowAfterHoursOrders === true`: review-trade modal lets the order through. Variant is `AMO` and the success modal renders the amber pill.
- During market hours (any tenant): variant is `REGULAR`, no pill.

**Submit-time tagging.**

Every trade payload builder threads `variant` into each per-trade object:

- `ProcessTrades.js → buildOrderPayload()` — both regular orders (line 250) and GTT orders.
- `StockAdvices.js → getOrderPayload(isGtt)` — bespoke trade path doesn't go through `ProcessTrades.js`. `variant` is computed once via `IsMarketHours() + allowAfterHoursOrders` and merged into each `trade` object inside `trades[]` before the request fires.
- `RebalanceModal.js` — rebalance payload builder for `rebalance/process-trade` (hits ccxt-india directly, NOT Node).
- `MPReviewTradeModal.js`, `UserStrategySubscribeModal.js` — MP review/subscribe payload builders, also `rebalance/process-trade`.

**Backend echo (Node — bespoke lane only).**

The bespoke trade path goes through Node's `/api/process-trades/order-place`. After ccxt-india's `tradeDetails` array comes back, the existing `processTradeUpdate(trade, matchingTrade, ...)` flow finds the matching input trade by symbol+type+tradeId. We piggy-back on that lookup to copy `matchingTrade.variant || 'REGULAR'` onto each output trade row. **No DB persistence** — the field is request-scoped, used only for the response envelope to RN.

**Frontend fallback (rebalance + MP lane).**

The rebalance/MP lane hits ccxt-india directly (`rebalance/process-trade`). ccxt does NOT echo `variant` (per the "no ccxt-india changes needed" decision). The frontend instead:

1. Reads `variant` directly from the response item if present (Node lane provides this).
2. Falls back to looking up by symbol+tradeId+transactionType against the **outgoing** trade list it just submitted (which the frontend still has in scope).
3. Falls back to `"REGULAR"` if neither yields a match.

This three-tier fallback means rebalance/MP get the AMO badge without any ccxt-india change.

**Display.**

`RecommendationSuccessModal.js` renders an amber pill `AMO` next to the existing PLACED/PENDING/REJECTED status pill, only when `variant === "AMO"`. Colors are sourced from `theme.colors.status.warning` (`#F59E0B` text) and `theme.colors.status.warningBg` (`#FEF3C7` background) — both already in `src/theme/colors.js` § `DEFAULT_TOKENS.status`. No new tokens added.

**NOT in this commit (followups).**

- **Payload behavioural change.** This commit is display-only. The frontend does NOT explicitly send `orderVariety: "AMO"` in the place-order payload — every supported broker auto-converts to AMO server-side during after-hours, so the existing `orderVariety: "regular"` works. Sending explicit AMO is a behavioural change (broker accept windows + cancellation policies differ for explicit AMO orders). Tracked as a separate followup with a dual-write soak.
- **Pre-flight market-closed banner.** A "Market is closed — your order will be parked as AMO and execute at next open" banner on the review-trade modal was discussed but deferred. Users with `allowAfterHoursOrders=false` are already blocked at review; users with the flag ON have explicitly opted in but currently get no pre-flight warning — that's the gap the banner would close, but it's separate scope.
- **Persisting `variant` in `traderecos` collection.** Not done — the field is purely a request-scoped echo. If a future product surface needs to filter past trades by AMO status, the collection schema would need a deliberate migration.

### 4.6 Order Status Normalization

**File:** `src/utils/orderStatusUtils.js`

All broker-specific statuses are normalized to 6 canonical values:

| Canonical | Broker Statuses Mapped |
|-----------|----------------------|
| `complete` | COMPLETE, COMPLETED, TRADED, FILLED, EXECUTED, PLACED, ORDERED |
| `pending` | PENDING, TRIGGER PENDING, REQUESTED, OPEN, TRANSIT, AM |
| `rejected` | REJECTED, FAILED, FAILURE, ERROR, DECLINED |
| `cancelled` | CANCELLED, CANCELED, CANCELLED BY USER/SYSTEM |
| `partial` | PARTIALLY FILLED, PARTIAL |
| `unknown` | Everything else |

### 4.7 Ignore & Restore Flow

```
Ignore:
    PUT /api/recommendation { uid: tradeId, trade_place_status: "ignored", reason }
    Trade moves to "Ignored" tab

Restore:
    Select ignored trade → place order normally
    Status updated back to "recommend"
```

### 4.7.1 Bespoke Recommendations: Active vs Rejected Tabs

**Files:** `src/screens/Home/HomeScreen.js` (seeAllBespoke block), `src/screens/TradeContext.js`, `src/UIComponents/StockAdvicesUI/StockCard.js`

The bespoke "Recommendations → View All" screen has two tabs: **Active** and **Rejected**. They're backed by separate arrays in `TradeContext`:

| Tab | `StockAdvices` type prop | Data source | Button pair on each card |
|-----|--------------------------|-------------|--------------------------|
| Active | `'All'` | `stockRecoNotExecutedfinal` (`trade_place_status === 'recommend'`) | Add to Cart / Remove + Trade Now |
| Rejected | `'OSrejected'` | `rejectedTrades` (bespoke only — `isRejectedStatus(status) && !model_id && !Basket && !rebalance_status`) | Ignore + Trade Now |

Rejected bespoke trades are **not** pushed to `recommended` — they live exclusively in the Rejected tab. This prevents the same rejected card from appearing in both lists. The tab switcher is a local `bespokeListTab` state on `HomeScreen` that toggles the `type` prop on `<StockAdvices>`.

**Ignore** on a rejected card opens `IgnoreAdviceModal` → `PUT /api/recommendation { uid, trade_place_status: 'ignored', reason }` → refetches trades. **Trade Now** calls the same `handleSingleSelectStock` → broker/fund/TPIN checks → opens `ReviewTradeModal` for re-execution.

Note: Baskets (`trade.basketId && trade.toTradeQty`) are early-returned in `TradeContext` before the rejected branch — they never appear in `rejectedTrades`. Basket rejection handling is not wired (tracked for future work).

### 4.8 Bespoke "Continue Without Broker" (Manually Placed)

**File:** `src/components/AdviceScreenComponents/StockAdvices.js`

When a bespoke (non-model-portfolio) user has selected trades in the cart but does not have a broker connected, they can mark trades as "manually placed" instead of executing through the app. This flow is triggered from the BrokerSelectionModal's "Continue without broker" button.

```
User selects bespoke trades → opens BrokerSelectionModal
    │
    ├── User taps "Continue without broker"
    │     Calls: handleContinueWithoutBrokerBespoke()
    │
    │     1. If stockDetails is empty → close modal, return
    │     2. Set pendingManualTrade = stockDetails
    │     3. Set showManualConfirm = true → show confirmation UI
    │     4. Close BrokerSelectionModal
    │
    ├── User confirms manually placed
    │     Calls: handleConfirmManuallyPlaced()
    │
    │     For each trade in stockDetails:
    │       PUT {server}/api/recommendation
    │       Body: { uid: trade._id || trade.tradeId, trade_place_status: "manually_placed" }
    │
    │     On success: Toast "Trades marked as manually placed"
    │     Refresh: getAllTrades()
    │     Reset: pendingManualTrade = null, showManualConfirm = false
    │
    └── On failure: Toast error
```

**Prop wiring:** `handleContinueWithoutBrokerBespoke` is passed to `BrokerSelectionModal` as the `handleAcceptRebalanceWithoutBroker` prop. Previously, in the bespoke context this prop was `undefined`, so tapping "Continue without broker" did nothing. Fixed in commit `4c869c7`.

### 4.9 Cart Limit-Price Persistence (2026-04-17)

**File:** `src/components/AdviceScreenComponents/StockAdvices.js` — `handleLimitOrderInputChange`

LIMIT orders on the Recommendations cart let the user set a custom price per leg. Previously the handler called `parseInt(value)` and only updated local state — so `₹123.45` became `123` and the entered price was wiped on the next `getCartAllStocks()` refresh. Aligned with web (`prod-alphaquark-github/src/Home/StockRecommendation/NewStockCard.js:774-820`):

1. Validate via `/^\d*\.?\d{0,2}$/` — up to two decimals; reject silently otherwise so the input field behaves consistently.
2. Store the **string** in `Price` (no `parseInt`) so decimals round-trip.
3. `POST ${server.server.baseUrl}api/cart/update` with body `{ tradeId, price: formattedValue }` and the standard header triple (`Content-Type`, `X-Advisor-Subdomain: configData?.config?.REACT_APP_HEADER_NAME`, `aq-encrypted-key: generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)`).
4. On success → `getCartAllStocks()` to re-sync. Errors are logged and non-fatal (local state already reflects the entry).

Backend accepts lowercase `price` (not `Price`); the normalization happens client-side before the POST. This is the only place in the Recommendations cart flow that mutates `Price` server-side — `Add to Cart` / `Remove from Cart` uses separate endpoints.

**States added:**
- `pendingManualTrade` — holds the array of trades awaiting manual confirmation
- `showManualConfirm` — boolean controlling the manual confirmation UI

### 4.9 Reconciliation Service

**File:** `src/services/ReconciliationService.js`

Detects conflicts between pending orders and closure trades before placement:

```
detectConflicts(basketTrades, allOrders):
    For each closure trade (SELL):
        Check if pending BUY order exists for same symbol
        If unfilled → PENDING_ORDER_CONFLICT
        If partially filled → PARTIAL_FILL_CONFLICT

reconcileBasket(basketTrades, allOrders):
    Returns:
      hasConflicts, conflicts, tradesToPlace, tradesToSkip, warnings
```

---

## 5. Model Portfolio Execution Architecture

### 5.1 Overview

Advisors create reusable investment portfolios (strategies). Clients subscribe with a chosen investment amount and receive rebalance signals when the advisor updates allocations. The mobile app adds payment integration, digital signatures, and step-by-step UX on top of the shared backend.

### 5.2 Subscription Flow (Mobile-Specific Multi-Step)

```
┌─────────────────────────────────────────────────────────────────┐
│  [MPInvestNowModal.js] — 5,346 lines, core investment modal     │
│                                                                  │
│  Step 1: User Information                                        │
│    ├── Collect Date of Birth, PAN, Mobile Number                 │
│    └── Validate completeness                                     │
│                                                                  │
│  Step 2: Payment Processing                                      │
│    ├── Payment gateways: Razorpay | Cashfree | PayU              │
│    ├── Recurring/SIP: PayU SI | Cashfree recurring               │
│    ├── Coupon code validation                                    │
│    ├── GST calculation (useGstConfig context)                    │
│    └── PendingPaymentManager for recovery on failure             │
│                                                                  │
│  Step 3: Digital Signature (Digio)                               │
│    ├── Aadhaar-based authentication (preferred)                  │
│    ├── OTP-based fallback                                        │
│    ├── Configurable timing: beforePayment | afterPayment         │
│    ├── Polls document status for completion                      │
│    └── Downloads signed PDF on success                           │
│                                                                  │
│  Step 4: Order Execution                                         │
│    ├── Calculate rebalance: POST /ccxt/rebalance/calculate       │
│    ├── Display order preview (BUY/SELL lists)                    │
│    ├── Confirm and place orders                                  │
│    └── Subscribe: PUT /api/model-portfolio/subscribe-strategy    │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Rebalance Lifecycle

#### 5.3.1 Pre-Rebalance Validation

```
[RebalanceAdvices.js] opens
    │
    ├── 1. Refresh broker status (live, not cached)
    │      API: GET /api/user/getUser/{email}
    │
    ├── 2. Validate broker connection
    │      If not connected → Show connect broker modal
    │
    ├── 3. Fetch fresh funds
    │      fetchFunds() → broker API
    │      Check: isFundsErrorOrMissing(funds, brokerStatus)
    │        status 1 → Token expired
    │        status 2 → Backend error
    │
    └── 4. Check EDIS authorization for SELL orders
```

#### 5.3.2 Rebalance Calculation

```
User clicks "Rebalance"
    │
    ▼
Build broker-specific payload:
    buildBrokerPayloadFields(broker, credentials, decryptFn, angelOneApiKey)
    │  File: src/utils/rebalanceHelpers.js
    │
    ▼
API: POST {ccxtServer}/rebalance/calculate
    │
    │  Backend (ccxt-india/rebalancing/rebalancing.py):
    │    1. Fetch user's current holdings from broker
    │    2. Apply corporate action adjustments (splits, mergers, demergers)
    │    3. Compare current holdings vs target allocation
    │    4. Calculate BUY orders for underweight positions
    │    5. Calculate SELL orders for overweight positions
    │    6. Factor in available cash
    │    7. Skip stocks where cash is insufficient (partial rebalance)
    │
    │  Response:
    │  {
    │    buy: [{ symbol, quantity, price, token, exchange }],
    │    sell: [{ symbol, quantity, price, token, exchange }],
    │    status: 0|1|2,
    │    message, uniqueId, totalValue, minInvestmentValue
    │  }
    │
    ▼
Display order preview → User confirms → Place orders
```

#### 5.3.3 Order Placement

For real brokers (non-publisher, non-DummyBroker):

```
User clicks "Confirm Orders"
    │
    ├── Step 1: POST {ccxtServer}/rebalance/process-trade
    │     Places orders via broker API
    │     Returns: { results, status, orderErrors, fundsRequired }
    │
    ├── Step 2: PUT {ccxtServer}/rebalance/update/subscriber-execution
    │     Marks rebalance as "executed"
    │
    └── Step 3: POST {ccxtServer}/rebalance/add-user/status-check-queue
          Enrolls for async order status tracking
```

#### 5.3.4 Publisher SDK Flow (Zerodha / Fyers)

**Files:**
- `src/components/KitePublisherModal.js` — WebView wrapper for Kite SDK
- `src/utils/brokerPublisher.js` — SDK utilities

**Canonical basket-item boundary (2026-08-28).** Every native Publisher caller
delegates final Kite/Fyers item construction to
`convertToBasketItem(broker, stock, symbolMap, overrides)`. The converter alone
owns exchange-aware product mapping (`NFO`/`BFO` carry-forward → `NRML`), order
type, transaction casing, market-protection/tick rounding, readonly limits and
tag truncation. Callers may pass resolved derivative symbols, exchanges, LTP,
lot-adjusted quantities and flow tags through `overrides`; they continue to own
symbol lookup, lot sizing, batching/sequencing and flow-specific pricing. This
prevents screen-local product maps from drifting back to the invalid
`CNC`-for-F&O payload.

```
isPublisherSupported(broker) === true
    │
    ├── 1. Load publisher SDK in WebView
    │      Zerodha: kite.trade/publisher.js?v=3
    │      Fyers: api-connect-docs.fyers.in/fyers-lib.js
    │
    ├── 2. Convert symbols to broker format
    │      POST {ccxtServer}/zerodha/convert-symbol
    │
    ├── 3. Build basket items
    │      createBatches(stockDetails, broker) — respects max basket size
    │      convertToBasketItem(broker, stock, symbolMap)
    │
    ├── 4. WebView ↔ React Native postMessage communication
    │      Messages: loaded → init → ready → addItems → opened → finished
    │
    ├── 5a. Publisher callback fires (happy path)
    │      Record results: POST /{broker}/publisher/record-orders
    │
    └── 5b. Callback doesn't fire (iOS WebView issue)
           Polling fallback: every 5s, timeout 90s
           Compare new order IDs vs baseline
```

**Publisher path is session-independent (2026-08-18, ported from markup_app).**
The Kite basket is completed inside Kite (the user logs into Kite directly in
the WebView), so the app's broker API session is never used at placement time.
A `TOKEN_EXPIRED` funds-preflight must therefore NOT block the publisher from
opening — `shouldBlockTradeOnFundsPreflight(reason, broker)` in
`src/utils/brokerSessionValidator.js` returns `false` for
`Zerodha + TOKEN_EXPIRED`, and `StockAdvices.executePlaceOrder` skips
`_haltOnFundsCheckFailure` entirely on the publisher branch. REST/GTT paths
keep the check. Related: the retry guard in
`StockAdvices.reconcilePendingZerodhaAttempt` now offers an explicit
"Open Kite Again" confirmation when an OLD attempt (> 3 min) can't be
reconciled — the duplicate-order protection stays opt-out, never automatic.

#### 5.3.5 DummyBroker Flow

**File:** `src/components/AdviceScreenComponents/DummyBrokerHoldingConfirmation.js`

```
DummyBroker detected → editable order form
    │
    ├── User can: modify quantities, edit prices, add/remove stocks
    │
    ├── If dataArray.length === 0 (already aligned):
    │     POST /rebalance/process-trade (empty trades)
    ��
    └── User confirms → simulated execution
          │
          ├── Step 1: POST /rebalance/process-trade (record trades)
          │
          ├── Step 2: PUT /rebalance/update/subscriber-execution
          │     Body: { userEmail, modelName, model_id, executionStatus: 'executed', user_broker: 'DummyBroker' }
          │
          │     On failure → retry once after 2s delay
          │       ├── Retry succeeds → continue normally
          │       ��── Retry fails → Toast error:
          │             "Status update failed. Rebalance recorded but status may be stale. Pull to refresh."
          │
          └── COMPLETE status → refresh portfolio
```

**Retry rationale**: The subscriber-execution PUT may fail transiently (backend slow, network hiccup). Without the retry, a successful trade recording could leave the execution status stuck at "pending", causing the RebalanceCard to keep showing an action button even though trades were placed.

#### 5.3.6 RebalanceCard Execution Status Logic

**File:** `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`

The RebalanceCard determines which action button to show based on the user's execution record for the currently selected broker. A critical guard prevents phantom buttons when no execution record exists.

```
userExecution = latestRebalance.subscriberExecutions.find(
    e => e.user_email === userEmail
)

hasExecutionRecord = !!userExecution    ← GUARD: false when no record for this broker

Status derivation (all require hasExecutionRecord === true):
    isRebalanceExecuted    = hasExecutionRecord && status === 'executed'  && brokerMatches
    isPartiallyExecuted    = hasExecutionRecord && status === 'partial'   && brokerMatches
    isPendingVerification  = hasExecutionRecord && status === 'pending'   && brokerMatches

Button states:
    !hasExecutionRecord          → disabled, "No rebalance pending"
    isRebalanceExecuted          → disabled, "Rebalance Accepted" (grey)
    isPartiallyExecuted          → enabled,  "Retry Rebalance" (orange gradient)
    isPendingVerification        → enabled,  "Check Order Status" (yellow gradient)
    repair && status !== 'toExecute' → enabled, "View/action on updates" (red gradient)
    else (normal pending)        → enabled,  "Accept Rebalance" (default gradient)
```

**Why the guard matters**: When a user switches brokers in the dropdown, `userExecution` becomes `undefined` if no execution record exists for the newly selected broker. Without the `hasExecutionRecord` check, `undefined?.status !== 'executed'` evaluates to `true`, which made the repair-mode branch active and showed a phantom "Accept Rebalance" button that would fail on click. The guard was added in commit `4c869c7`.

### 5.4 Post-Rebalance Status Tracking

```
After orders placed
    │
    ├── Backend status-check-queue (async):
    │     Polls broker order book every 30-60s
    │     Updates user_net_pf_model in database
    │     Sends completion notification
    │
    ├── [MPStatusModal.js]
    │     API: GET {ccxtServer}/rebalance/user-portfolio/latest/{email}/{modelName}
    │     Status color-coding:
    │       Green:  COMPLETE, COMPLETED, TRADED, FILLED
    │       Yellow: OPEN, PENDING, TRANSIT, TRIGGER PENDING
    │       Red:    REJECTED, CANCELLED, FAILURE, FAILED
    │
    │     Mobile-specific features:
    │       - Edit failed orders (modify quantity/price)
    │       - Add new stocks to execution
    │       - Remove stocks
    │       - Explicit confirmation required per failed stock
    │
    └── Portfolio event emission:
          portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH)
```

### 5.5 Multi-Broker Order Routing

**File:** `src/utils/rebalanceHelpers.js` → `buildBrokerPayloadFields()`

```
Frontend                          Python Backend
────────                          ──────────────
buildBrokerPayloadFields()        1. Extract auth_params from request
  ↓                               2. Fetch DB credentials via ProcessTradesDbManager
Encrypt sensitive fields           3. If DB creds exist AND no fresh frontend token → use DB
(AES for ICICI, Upstox, etc.)     4. Else → use frontend tokens
  ↓                               5. Normalize to BrokerFactory fields
Send to API endpoint               6. Create Rebalancing instance → execute
```

### 5.6 Corporate Action Handling

Backend handles during rebalance calculation:

| CA Type | Handler | Logic |
|---------|---------|-------|
| Stock Split | `_handle_split()` | Adjust quantity by ratio, recalculate avg price |
| Demerger | `_handle_demerger_new_stock()` | Add new security with adjusted quantity |
| Merger | `_handle_merger_conversion()` | Convert old shares to merged entity |
| Rights Issue | `_handle_rights_issue()` | Add new shares from entitlement |
| Buyback | `_handle_buyback()` | Reduce quantity for bought-back shares |

### 5.7 Payment Integration (Mobile-Specific)

```
Payment Gateways:
    ├── Razorpay:  RazorpayCheckout native module
    ├── Cashfree:  CFPaymentGatewayService + CFDropCheckoutPayment
    └── PayU:      PayUService + PayUSIPayment (recurring/SIP)

Payment Recovery (PendingPaymentManager.js):
    ├── savePendingPayment(): Stores incomplete state to AsyncStorage
    ├── checkAndRecoverPendingPayment(): Auto-resumes on app reopen
    └── Tracks PaymentType enum: 'RAZORPAY', 'CASHFREE', 'PAYU'
```

### 5.8 Digital Signature — Digio (Mobile-Specific)

```
Configurable via: configData.digioCheck
    ├── 'beforePayment': Sign before payment step
    └── 'afterPayment':  Sign after payment step

Authentication Methods:
    ├── Aadhaar-based (preferred if aadhaarBasedAuthentication = true)
    └── OTP-based fallback (otpBasedAuthentication = true)

Process:
    1. Create document + access token via API
    2. Open Digio gateway in modal
    3. Poll document status for completion
    4. Download signed PDF on success
    5. Update user digio_verification flag
```

---

## 6. Broker Data Management

### 6.1 Holdings Fetching

**File:** `src/services/BrokerOrderBookAPI.js`

```
fetchOrderBook(broker, credentials, configData):
    │
    ├── Builds broker-specific request payload
    │     buildOrderBookPayload(broker, credentials, configData)
    │
    ├── Calls broker API via ccxtServer
    │
    ├── Normalizes response to common format:
    │     { orderId, symbol, exchange, transactionType, quantity,
    │       filledQuantity, pendingQuantity, price, orderType,
    │       status, normalizedStatus, placedAt, variety }
    │
    └── Detects TOKEN_EXPIRED → returns { success: false, tokenExpired: true }

Supported operations:
    fetchOrderBook()     → All orders
    fetchPendingOrders() → Pending only
    getOrderStatus()     → Single order by ID
    cancelOrder()        → Cancel order
    modifyOrder()        → Modify price/qty (AliceBlue, Angel One, Zerodha, Upstox, Dhan, Kotak)
```

### 6.1a When TradeContext re-fetches broker holdings (2026-09-29)

`TradeContext` loads live broker holdings with `getAllBrokerSpecificHoldings()`
(`/<broker>/holdings`) and `getAllHoldings()` (`/<broker>/all-holdings`). Both
are live calls to the broker's API through the customer's egress IP.

Triggers:

1. **Broker session change** — an effect keyed on
   `holdingsRefreshKey(userDetails)` (`src/utils/holdingsRefreshKey.js`):
   `email | user_broker | connect_broker_status | clientCode | jwtToken`.
   Login, broker switch, reconnect (new token) and disconnect re-fetch;
   a `getUser` refresh that returns the same session does **not**.
2. **Explicit refresh events** — `refreshAccountState` (listening to
   `refreshEvent` and `OrderPlacedReferesh`) calls both loaders alongside
   trades, model-portfolio details and funds, so holdings still update after
   an order.
3. Screen-level callers that invoke `getAllHoldings` from the context directly.

Before 2026-09-29 the effect depended on the `userDetails` object itself.
Every `getUser` refresh creates a new object, so each refresh re-fired both
broker calls — and the home-card "Accept rebalance" broker check refreshes the
user (`useRefreshBrokerStatus` → `getUserDeatils()`). One tap produced ~12
Fyers calls in 10 s (funds ×4, holdings ×3, all-holdings ×5) in production
logs; do not reintroduce an object-identity dependency here.

### 6.2 Holdings Aggregation

Via MultiBrokerContext:

```
For each connected broker:
    1. Fetch holdings from broker API
    2. Store in brokerHoldings[broker]
    3. Aggregate across all brokers into aggregatedHoldings

Metrics calculated:
    getTotalValue() → Σ(ltp × quantity) across all brokers
    getTotalPnL()   → Σ((ltp - avgPrice) × quantity) across all brokers
```

### 6.3 Funds Fetching

```
fetchFunds(broker, clientCode, apiKey, jwtToken, ...):
    │
    │  Returns: { status: 0|1|2, data: { availablecash } }
    │    status 0: Success
    │    status 1: Token expired
    │    status 2: Backend error
    │
    └── Check: isFundsErrorOrMissing(funds, brokerStatus)
              Returns: { isError, reason }
```

**Canonical helper:** `src/FunctionCall/fetchFunds.js` is the single source of truth for the per-broker funds-route map. It handles all 13 brokers (IIFL, ICICI, Upstox, Angel One, Motilal Oswal, Zerodha, HDFC, Kotak, Dhan, Groww, AliceBlue, Fyers, Axis Securities) with the correct URL + request shape for each (e.g. Kotak adds `sid`/`serverId`, Dhan/AliceBlue/Fyers/Axis add `clientId`).

**Inline fund-fetchers — proceed with caution.** A few screens still carry inline per-broker if/else chains predating `fetchFunds`:
- `src/screens/PortfolioScreen/PortfolioScreen.js` — `getAllFunds()` keeps inline branches for IIFL / ICICI / Upstox / Zerodha / Kotak (these have payload quirks worth preserving — e.g. Zerodha hardcodes the public app key, Kotak passes segment/product/exchange) and delegates everything else to `fetchFunds()`. The earlier catch-all `else` was POSTing to `${baseUrl}funds` (no broker prefix) and 404'd silently for Angel One / HDFC / Dhan / AliceBlue / Fyers / Groww / Motilal / Axis — fixed 2026-04-25 by routing those through `fetchFunds`.
- `src/screens/Drawer/IgnoreTradesScreen.js` — has inline branches per broker; the Angel One branch had the same `${baseUrl}funds` typo (no `angelone/` prefix) — fixed 2026-04-25.
- New funds call sites should call `fetchFunds()` directly instead of growing another inline if/else chain. If a broker needs special payload (e.g. Kotak segment), extend `fetchFunds` rather than inlining.

### 6.4 Broker Capability Matrix

**File:** `src/utils/brokerSupport.js`

```
BROKER_SUPPORT = {
  Zerodha:    { MARKET, LIMIT, SL, SL_M, GTT, GTT_OCO: all true },
  Upstox:     { MARKET, LIMIT, SL, SL_M, GTT, GTT_OCO: all true },
  AngelOne:   { MARKET, LIMIT, SL: true; GTT: single-leg only, no OCO },
  Dhan:       { MARKET, LIMIT, SL, GTT: true; no SL_M, no OCO },
  Fyers:      { MARKET, LIMIT, SL, SL_M, GTT, GTT_OCO: all true },
  ICICI:      { MARKET, LIMIT, SL, GTT: true; no SL_M, no OCO },
  Groww:      { MARKET, LIMIT, SL, GTT: true; no SL_M, no OCO },
  Kotak:      { MARKET, LIMIT, SL: true; no GTT },
  HDFC:       { MARKET, LIMIT, SL: true; no GTT },
  IIFL:       { MARKET, LIMIT, SL: true; no GTT },
  AliceBlue:  { MARKET, LIMIT, SL: true; no GTT },
  MotilalOswal: { MARKET, LIMIT, SL: true; no GTT },
}

Key exports:
  isOrderTypeSupported(broker, orderType) → boolean
  isFeatureSupported(broker, feature) → boolean
  getGTTSupportedBrokers() → string[]
  validateOrderConfig(order, broker) → { errors, warnings }
```

---

## 6.5 User Authentication & Advisor Resolution

### Runtime advisor contract (AlphaB2B master build)

Advisor selection is not only a plan filter. After RA resolution, the stored
advisor config becomes the session authority for:

- every authenticated `X-Advisor-Subdomain` header, including helpers that do
  not receive `TradeContext.configData` directly;
- SDK session minting, so SDK broker/order mutations use the same tenant as
  legacy REST reads;
- ConfigContext branding/feature fetches; and
- selection of a statically bundled design variant (currently MoneyMan's
  `moneyman_app` bundle).

`src/utils/runtimeAdvisor.js` owns the synchronous in-memory snapshot and
subscription. `storageUtils` publishes the config when it stores or restores
`@app:advisorConfig`, and clears it with advisor/login state. Callers with an
explicit config still win; the runtime snapshot is the fallback before build
environment values. This prevents a MoneyMan session in the AlphaB2B binary
from silently reading or writing `prod`.

`src/utils/advisorContentProfile.js` applies the same runtime identity to
tenant copy and catalog behavior that previously existed only in standalone
fork content: MoneyMan plan ordering/summaries, feed layout, Insights/More
links, and platform display name. Authentication/bootstrap calls deliberately
use `getBuildTenantSubdomain()` until advisor selection succeeds; post-login
calls use `getTenantSubdomain()`.

### Signup/Login Flow

```
User enters email + password
    │
    ▼
Firebase auth (createUser / signIn)
    │
    ▼
Backend: POST /api/users/ (create user record)
    │
    ▼
Check for advisor_ra_code on user record
    │
    ├── Has RA code (from env ADVISOR_RA_CODE or user record)
    │       → Fetch advisor config → Navigate to Home
    │
    └── No RA code
            │
            ▼
        Auto-resolve: GET /api/user/resolve-advisor/:email
            │  Looks up central email_advisor_map (common DB)
            │
            ├── Single advisor match → auto-set RA code → Home
            ├── Multiple advisors → disambiguate by the build's subdomain
            │       (X-Advisor-Subdomain): if exactly one mapping matches →
            │       auto-set RA code → Home; else show RA ID screen
            └── Not found → show RA ID screen (manual entry)
```

### International Phone Collection

`PhoneLoginScreen` (phone-first lead/login entry) and `PhoneNumberScreen`
(authenticated profile completion) use `src/utils/paymentPhone.js` to persist
the same canonical pair consumed by payments: a normalized `countryCode` and
national `phoneNumber`. Navigation to `Login` uses the helper's E.164 value.
Do not reintroduce global `length === 10` or `9..11` validation: UAE national
numbers are nine digits and other supported country-picker entries have
different lengths. The helper also repairs legacy profile values stored as
E.164 (with or without `+`) and avoids duplicating the calling code. Its
E.164-shape check is a transport guard; the backend/gateway remains the final
authority on whether a real number is valid.

### Auto-Resolve Advisor Architecture

The `email_advisor_map` collection in the `common` database maintains a central mapping of client emails to advisors. This eliminates the RA ID screen for clients whose advisors have already added them to their clientList.

**Data flow:**
- When an advisor adds a client (via admin panel, CSV upload, or subscription) → `syncEmailAdvisorMap()` upserts to the central map
- When a client's email changes → `updateEmailInAdvisorMap()` updates the central map
- When a client's account is deleted → `removeEmailAdvisorMap()` removes from the central map

**Key files:**
| File | Purpose |
|------|---------|
| `Models/EmailAdvisorMap.js` | Schema: `{email, advisor_subdomain, advisor_ra_code}` with compound unique index |
| `utils/emailAdvisorMapSync.js` | Sync utilities: `syncEmailAdvisorMap`, `removeEmailAdvisorMap`, `updateEmailInAdvisorMap` |
| `Routes/userRoutes.js` | `GET /resolve-advisor/:email` endpoint |
| App: `src/utils/storageUtils.js` | `tryResolveAdvisor()` — called from Signup, Login, and Splash screens |
| App: `src/utils/runtimeAdvisor.js` | Active advisor snapshot used by headers, SDK mint, branding, and design selection |

**Multi-advisor disambiguation (2026-06-22):** A single email can map to
several advisors (a client subscribed via multiple advisors, or an internal
test account — e.g. `pratik@alphaquark.in` maps to 5: `zamzamcapital`, `prod`,
`rgxresearch`, `demo-alphaquark`, `alphanomy`). Each whitelabel build is
dedicated to ONE advisor, so `resolve-advisor` now reads the request's
`X-Advisor-Subdomain` header (case-insensitive) and, when the email maps to
multiple advisors, **prefers the single mapping whose `advisor_subdomain`
matches the requesting build** (response includes `disambiguated_by:
"subdomain"`). Only when no single subdomain match exists does it fall back to
`reason: "multiple_advisors"` → RA ID screen.

> **Why this was broken (the "no Plans" bug):** the app's `tryResolveAdvisor()`
> previously sent `X-Advisor-Subdomain: REACT_APP_WHITE_LABEL_TEXT` — the
> *display name* (e.g. "Alphanomy" / "Zamzam Capital"), which never equals the
> subdomain ("alphanomy" / "zamzamcapital") — and the backend ignored the
> header entirely, returning `multiple_advisors` for any >1 mapping. Combined
> effect: the per-user advisor was never selected, so
> `configData.config.REACT_APP_ADVISOR_SPECIFIC_TAG` (advisorTag) stayed empty
> and `useHomePlanSummary`'s `fetchCatalog()` returned `[]` *without an API
> call* → **"Recommendations not available" / no Plans**, even though the
> alphanomy mapping existed. Fixed by (a) the app sending `REACT_APP_HEADER_NAME`
> (the real subdomain) in `src/utils/storageUtils.js` `tryResolveAdvisor()`,
> and (b) the backend disambiguating by that subdomain in
> `Routes/userRoutes.js` `GET /resolve-advisor/:email`. Reported 2026-06-22 on
> the alphanomy build. **Note:** the live index/LTP staleness reported at the
> same time is a *separate* issue — the index feed is scoped by the subdomain
> config (which loads fine), not by the per-user advisor.

---

## 7. State Management

### 7.1 Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                    State Management Layers                  │
│                                                            │
│  ┌──────────────────────┐  ┌───────────────────────────┐  │
│  │ React Context         │  │ AsyncStorage (Persistent)  │  │
│  │                       │  │                            │  │
│  │ TradeContext          │  │ @app:raId                  │  │
│  │   - recommendations   │  │ @app:userData              │  │
│  │   - holdings          │  │ @app:advisorConfig         │  │
│  │   - broker status     │  │ cartItems                  │  │
│  │   - config data       │  │ brokerSession:{broker}     │  │
│  │                       │  │ @broker:oauthState:{broker}│  │
│  │ ConfigContext         │  │ pendingPayment             │  │
│  │   - app config        │  │                            │  │
│  │   - feature flags     │  └───────────────────────────┘  │
│  │   - payment config    │                                 │
│  │   - theme/branding    │  ┌───────────────────────────┐  │
│  │                       │  │ Event System               │  │
│  │ MultiBrokerContext    │  │                            │  │
│  │   - multi-broker data │  │ portfolioEvents            │  │
│  │   - aggregated P&L    │  │   HOLDINGS_REFRESH         │  │
│  │                       │  │   REBALANCE_EXECUTED        │  │
│  │ GstConfigContext      │  │   DISTRIBUTION_REFRESH      │  │
│  │   - GST settings      │  │   BROKER_CONNECTED          │  │
│  └──────────────────────┘  │   ORDER_PLACED               │  │
│                             └───────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ WebSocket (Real-time)                                 │  │
│  │   - Live price feeds                                  │  │
│  │   - Symbol subscriptions                              │  │
│  │   - Server: wss://websocket.alphaquark.in             │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 7.2 Provider Hierarchy

```
<ConfigProvider>
  <GstConfigProvider>
    <MultiBrokerProvider>
      <TradeProvider>
        <NavigationContainer>
          <App />
        </NavigationContainer>
      </TradeProvider>
    </MultiBrokerProvider>
  </GstConfigProvider>
</ConfigProvider>
```

### 7.3 Event System

**File:** `src/utils/portfolioEvents.js`

```javascript
PORTFOLIO_EVENTS = {
  HOLDINGS_REFRESH: "HOLDINGS_REFRESH",
  REBALANCE_EXECUTED: "REBALANCE_EXECUTED",
  DISTRIBUTION_REFRESH: "DISTRIBUTION_REFRESH",
  BROKER_CONNECTED: "BROKER_CONNECTED",
  BROKER_DISCONNECTED: "BROKER_DISCONNECTED",
  ORDER_PLACED: "ORDER_PLACED",
  ORDER_STATUS_UPDATED: "ORDER_STATUS_UPDATED",
}

// Subscribe
const unsub = portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, (data) => {
  refetchHoldings();
});

// Emit after rebalance execution
portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, { userEmail, modelName });

// Cleanup
unsub();
```

### 7.5 Derivative basket policy projection

Basket display and entry policy are now server-projected rather than inferred
independently by each screen. `TradeContext` carries the parent
`basketLifecycle` and `entryGate`; the BasketCard container polls
`BasketEntryGateService` and supplies status/disabled state to the default
design composite. `StockAdvices` and `ReviewZerodhaTradeModal` re-authorize at
handoff, preserve numeric priority and keep Zerodha baskets inside one
Publisher navigation. REST remains protected by the server execution gate.
Exit legs are never blocked by an entry-price range. See
`BASKETS_ARCHITECTURE.md §14.1` and the cross-repo canonical
`prod-alphaquark-github/docs/DERIVATIVES_BASKET_ARCHITECTURE.md §19`.

### 7.6 Zerodha derivative quantity handoff

The basket review UI stores and edits derivative quantities in **lots** (for
example, `1` NIFTY lot), while Kite Publisher requires the final exchange
quantity in **shares/contracts** (for example, `65`). At Publisher handoff,
`ReviewZerodhaTradeModal` resolves the lot size in this order: the live
`/zerodha/fno/symbol-lotsize` result, the review-row fields, then the original
`fullbasketData` advice row matched by trade ID or symbol. It then calls
`getKiteBasketQuantity` from `basketUtils` exactly once. Equity quantities are
left unchanged. The original-advice fallback is required because the compact
review-row payload can omit `Lots`, and a failed or symbol-mismatched lookup
must not send a one-share option order that Kite rejects as not being a
multiple of the contract lot size.

---

## 8. File Reference

### 8.1 Utilities (`src/utils/`)

| File | Purpose | Lines |
|------|---------|-------|
| `brokerSessionUtils.js` | Broker session validation, token freshness | 112 |
| `brokerSupport.js` | Broker capability matrix, order validation | 614 |
| `brokerAuth.js` | OAuth state/nonce management, callback handling | ~230 |
| `brokerPublisher.js` | Publisher SDK utilities (Kite, Fyers) | ~180 |
| `ProcessTrades.js` | Centralized order placement pipeline | ~280 |
| `rebalanceHelpers.js` | Rebalance error detection, broker payload builder | ~210 |
| `tradeUtils.js` | Trade data standardization | 36 |
| `orderStatusUtils.js` | Order status normalization | 82 |
| `portfolioEvents.js` | Structured event emitter | ~75 |
| `SecurityTokenManager.js` | JWT token generation — HS256, payload `{apiKey, iat, exp}`, IST-offset timestamps, **300-sec expiry** (was 15-sec; widened to tolerate device clock drift — stale clocks > 15s drift cause server-side `Token has expired` 401s) | 133 |
| `storageUtils.js` | AsyncStorage wrapper with retry | 708 |
| `serverConfig.js` | Server endpoints | 24 |
| `Config.js` | App variant configuration | 68 |
| `isMarketHours.js` | Market hours check helper (9:15 AM - 3:30 PM IST). Re-wired into every order-placement surface behind the admin-controlled `allowAfterHoursOrders` feature flag (read from `ConfigContext`). Effective gate: `IsMarketHours() \|\| allowAfterHoursOrders`. Default flag value is `true`, so placement stays open 24×7 unless an admin explicitly sets the flag to `false` for an advisor (which restores the original "Market is Closed" block). | — |
| `gstHelpers.js` | GST calculation utilities | — |
| `cryptoUtils.js` | AES encryption/decryption | — |
| `websocketInitializer.js` | WebSocket connection setup | — |
| `basketUtils.js` | FnO basket utilities: expiry parsing, basket expiry check, trade netting | — |

### 8.1.1 basketUtils.js Functions

Ported from the web frontend (`prod-alphaquark-github/src/utils/basketUtils.js`) for parity.

| Function | Signature | Purpose |
|----------|-----------|---------|
| `parseExpiryFromSymbol` | `(searchSymbol) → Date \| null` | Parses expiry date from FnO symbol strings (e.g., "NIFTY16DEC25" → Dec 16, 2025). Handles 2-digit and 4-digit year formats. |
| `isBasketExpired` | `(trades) → boolean` | Returns `true` if any trade's `searchSymbol` / `search_symbol` indicates its expiry date has passed. Used to grey-out or hide expired baskets. |
| `netBasketTrades` | `(trades) → Trade[]` | Nets equal BUY/SELL quantities per symbol among "recommend"-status trades. Handles closure detection (full offset = both removed). Returns the reduced trade list. |

### 8.2 Services (`src/services/`)

| File | Purpose |
|------|---------|
| `BrokerOrderBookAPI.js` | Unified order book API across all brokers (782 lines) |
| `ReconciliationService.js` | Pending order conflict detection |
| `GstConfigService.js` | GST configuration fetcher |
| `ZerodhaOAuthService.js` | Zerodha OAuth flow management |
| `BasketEntryGateService.js` | Server-authoritative basket intent and quote-range authorization for cards, REST and Publisher handoff |

### 8.3 Contexts (`src/context/`)

| File | Purpose |
|------|---------|
| `ConfigContext.js` | App-wide configuration — also surfaces semantic token overrides from the advisor config. The provider value is memoized on `[config, loading]`, keeping downstream token hooks stable across unrelated provider renders. |
| `GstConfigContext.js` | GST settings (72 lines) |
| `MultiBrokerContext.js` | Multi-broker portfolio state |

### 8.3.1 Theme (`src/theme/`)

| File | Purpose |
|------|---------|
| `colors.js` | Semantic color token tree (`DEFAULT_TOKENS`) + `buildColors(config)` that layers legacy branding fields and advisor-supplied `colorTokens` overrides on the defaults. Canonical source of truth for every color used by the app. |
| `useColors.js` | `useColors()` hook — memoized wrapper around `buildColors(useConfig())`. Components read `colors.text.primary`, `colors.pnl.profit`, etc. instead of hardcoded hex. |

See `docs/COLOR_TOKENS.md` for the token catalog and `docs/COLOR_SYSTEM.md` for the data flow (support.alphaquark.in → backend schema → mobile `useColors()`).

### 8.4 Key Components

| Component | File | Purpose |
|-----------|------|---------|
| StockAdvices | `src/components/AdviceScreenComponents/StockAdvices.js` | Recommendation display (99.5 KB) |
| AddtoCartModal | `src/components/AdviceScreenComponents/AddtoCartModal.js` | Cart-based selection (49.1 KB) |
| ReviewTradeModal | `src/components/ReviewTradeModal.js` | Generic order review (48.8 KB) |
| ReviewZerodhaTradeModal | `src/components/ReviewZerodhaTradeModal.js` | Zerodha-specific review (47.0 KB) |
| IIFLReviewTradeModal | `src/components/IIFLReviewTradeModal.js` | IIFL-specific review (13.6 KB) |
| DdpiModal | `src/components/DdpiModal.js` | DDPI authorization (66.0 KB) |
| MPInvestNowModal | `src/components/ModelPortfolioComponents/MPInvestNowModal.js` | Investment flow (134 KB) |
| MPStatusModal | `src/components/AdviceScreenComponents/MPStatusModal.js` | Execution tracking (66.3 KB) |
| MPCard | `src/components/ModelPortfolioComponents/MPCard.js` | Portfolio display (20.9 KB) |
| KitePublisherModal | `src/components/KitePublisherModal.js` | Zerodha Publisher WebView |
| BrokerConnectionModal/ | `src/components/BrokerConnectionModal/` | 15 broker connection modals |
| ManageConnectionsModal | `src/screens/Home/ManageConnectionsModal.js` | Broker management |
| RebalanceCard | `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` | Rebalance action card with execution status guards |
| DummyBrokerHoldingConfirmation | `src/components/AdviceScreenComponents/DummyBrokerHoldingConfirmation.js` | DummyBroker trade confirmation with retry logic |

### 8.5 Screens

| Screen | File |
|--------|------|
| Home | `src/screens/Home/HomeScreen.js` |
| Orders | `src/screens/Home/OrderScreen.js` |
| Watchlist | `src/screens/Home/WatchlistScreen.js` |
| Model Portfolio | `src/screens/Drawer/ModelPortfolioScreen.js` |
| MP Performance | `src/screens/Drawer/MPPerformanceScreen.js` |
| Portfolio | `src/screens/PortfolioScreen/` |
| Authentication | `src/screens/Authentication/` |

---

## 9. Web Parity Status

### Features Consistent with Web

| Feature | Status | Notes |
|---------|--------|-------|
| 14 broker support | Done | All brokers supported |
| OAuth authentication | Done | Via WebView (web uses redirect) |
| Credential encryption (AES-256-CBC) | Done | Same algorithm |
| Order status normalization | Done | Same canonical values |
| Broker capability matrix | Done | Comprehensive support matrix |
| GTT order support | Done | Zerodha, Upstox |
| EDIS/DDPI/TPIN authorization | Done | Per-broker auth modals |
| Rebalance calculation | Done | Same backend API |
| Publisher SDK (Zerodha) | Done | Via WebView postMessage |
| Recommendation lifecycle | Done | Same backend flow |
| Multi-broker context | Done | New: `MultiBrokerContext.js` |
| Centralized trade processing | Done | New: `ProcessTrades.js` |
| OAuth state management | Done | New: `brokerAuth.js` |
| Rebalance helpers | Done | New: `rebalanceHelpers.js` |
| Portfolio event system | Done | New: `portfolioEvents.js` |
| Publisher SDK utilities | Done | New: `brokerPublisher.js` |
| Reconciliation service | Done | Pending order conflict detection |
| Basket utilities (FnO) | Done | `basketUtils.js` — same `parseExpiryFromSymbol`, `isBasketExpired`, `netBasketTrades` as web |
| Bespoke manually-placed flow | Done | "Continue without broker" marks trades as `manually_placed` |

### Mobile-Specific Enhancements (Kept)

| Feature | File | Reason Kept |
|---------|------|-------------|
| Slide-to-execute | ReviewTradeModal.js | Better mobile UX, prevents accidental taps |
| Surveillance on modal open | ReviewTradeModal.js, MPReviewTradeModal.js | Same as prod: triggered when review modal opens, shows non-blocking warning |
| Fix Size algorithm | ReviewTradeModal.js | Proportional allocation useful on mobile |
| Payment integration | MPInvestNowModal.js | Mobile payment gateways (Razorpay, Cashfree, PayU) |
| Digio signatures | MPInvestNowModal.js | Mobile-native digital signing |
| Pending payment recovery | PendingPaymentManager.js | Handles app backgrounding/crashes |
| GST handling | GstConfigContext.js | Dynamic GST calculation |
| Coupon codes | MPInvestNowModal.js | Discount application |
| Step-by-step modals | MPInvestNowModal.js | Better mobile navigation |
| Failed order confirmation | MPStatusModal.js | Explicit user consent per failed stock |
| AsyncStorage persistence | storageUtils.js | Mobile offline support |

### Integration Guide

To adopt the new utilities in existing components:

```javascript
// 1. Wrap app with MultiBrokerProvider
import { MultiBrokerProvider } from './context/MultiBrokerContext';
// Add to provider hierarchy (see Section 7.2)

// 2. Use portfolio events instead of generic EventEmitter
import portfolioEvents, { PORTFOLIO_EVENTS } from './utils/portfolioEvents';
portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, { userEmail });

// 3. Use centralized ProcessTrades
import { createPlaceOrderFunction } from './utils/ProcessTrades';
const placeOrders = createPlaceOrderFunction({ broker, credentials, ... });
const result = await placeOrders(stockDetails);

// 4. Use rebalance helpers for payload building
import { buildBrokerPayloadFields, isFundsErrorOrMissing } from './utils/rebalanceHelpers';
const payload = buildBrokerPayloadFields(broker, creds, decrypt, angelKey);

// 5. Use brokerAuth for OAuth flows
import { generateState, saveOAuthState, validateOAuthState } from './utils/brokerAuth';
const state = generateState('zerodha', '/recommendation');

// 6. Use publisher utilities for SDK flows
import { isPublisherSupported, createBatches, convertToBasketItem } from './utils/brokerPublisher';
if (isPublisherSupported(broker)) { ... }
```

## PortfolioScreen Top-Card Summary (2026-04-17)

### Entitlement-safe model holdings and legal URLs (2026-09-02)

`PortfolioScreen` no longer performs a parallel subscription fetch. It waits
for `modelPortfolioEntitlementsLoaded`, then uses only
`modelPortfolioStrategyfinal`; loading and empty snapshots clear model/plan
holdings. Broker connectivity is never subscription proof. Privacy and Terms
resolve the live legacy field, normalized `ConfigContext` semantic field, then
the build fallback.

**File:** `src/screens/PortfolioScreen/PortfolioScreen.js`

The `PortfolioCard` at the top of the Portfolio tab shows `Current P&L`, `Invested`, and `Total Returns`. Its data source is chosen to match the list rendered below it:

| Inner tab | Plan dropdown | Source | Memo |
|-----------|---------------|--------|------|
| `All Holdings` (0) | no plan selected | `allHoldingsData` (broker-wide aggregate) | — |
| `All Holdings` (0) | plan selected | `planSummary` (client-side aggregate over `planHoldings`) | `planSummary` |
| `Model Portfolios` (1) | — | `mpSummary` (client-side aggregate over `mpHoldings`) | `mpSummary` |

`planSummary` and `mpSummary` are both computed client-side by filtering holdings that have a live LTP from the WebSocket (`getLTPForSymbol`) and computing `totalInvested`, `totalCurrent`, `totalReturns`, `returnsPercentage`. The WebSocket subscribes to `mpHoldings` symbols; `planHoldings` symbols are a subset (both sourced from MP strategies via `fetchAllMPHoldings` / `fetchPlanHoldings`) so LTP coverage is shared. Previously the plan-selected case fell through to `allHoldingsData`, so the top card showed broker-wide totals (often ₹0 for test accounts) while the Holdings list below showed plan-scoped rows with correct per-row P&L — a visible inconsistency.

## Trade/basket payload `user_email` contract (2026-04-20)

Every trade-placement payload posted to `${server}api/process-trades/order-place` must carry **top-level `user_email`**. This is a hard contract with the ccxt-india egress request hook — when missing, the hook falls back to `cid=None` and binds the shared `72.61.251.253` IP; whitelist-enforcing brokers (Upstox, ICICI, Kotak, Hdfc, Motilal, IIFL, AliceBlue, Groww) reject the order with errors like Upstox's `UDAPI1154 — static IP does not match request origin IP`.

The Node backend's `Routes/Broker/ProcessTrades.js → createPayload()` forwards `user_email` into every per-broker body it constructs for ccxt-india — but only if it was present at the **top level** of the incoming body. Per-trade-row `user_email` copies inside `trades[]` get stripped during per-broker payload construction. The top-level requirement is the one that matters.

### Trade-flow callsites carrying `user_email`

| File | Function | Since |
|---|---|---|
| `src/utils/ProcessTrades.js` | `createPlaceOrderFunction` (regular + GTT helpers) | earlier port |
| `src/components/AdviceScreenComponents/StockAdvices.js` | `placeOrder → getOrderPayload` (GTT + regular paths) | B1 (2026-04-20, `b36d981`) |
| `src/components/AdviceScreenComponents/AddtoCartModal.js` | `placeOrder → getOrderPayload` + `cartItems` path | B1 (2026-04-20, `b36d981`) |
| `src/screens/Drawer/IgnoreTradesScreen.js` | `placeOrder → getOrderPayload` (basePayload) | B1 (2026-04-20, `b36d981`) |
| `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` | MP order placement | pre-existing |
| `src/components/AdviceScreenComponents/RebalanceModal.js` | `getBasePayload` (rebalance trade placement) | pre-existing |
| `src/screens/Rebalance/ExecutionStatusScreen.js` | status-check body | pre-existing |

### Dual-key contract for `verify-edis` and legacy `userEmail`

The ccxt-india egress hook accepts BOTH `user_email` (snake_case) and `userEmail` (camelCase). New callsites (B1 trade/basket payloads, B2 finish-connection endpoints, G Groww submit) use snake_case `user_email` — the new canonical. Legacy callsites sending camelCase `userEmail` for years (five app `angelone/verify-edis` sites audited in `[3.8.5]` — `DdpiModal.js`, `StockAdvices.js`, `AddtoCartModal.js`, `RebalanceAdviceContent.js`, `MPPerformanceScreen.js`) keep working without a rewrite.

See `docs/BROKER_CONNECTION.md` → *Per-customer egress IP contract* for the full broker-side contract and the finish-connection endpoint audit. See `docs/CHANGELOG.md` entries `[3.8.2]` (B1), `[3.8.3]` (B2), `[3.8.5]` (B3 verify-edis audit) for per-commit rationale.

## DDPI authorize-for-sell race (2026-04-20)

`src/components/DdpiModal.js` — all 6 `handleProceed` / `handleContinue` / `handleAcceptRebalance` callers now `await getUserDetails()` before `setIsOpen(false)` + `reopenRebalanceModal()`. Previously the refresh was fire-and-forget — the reopened rebalance/review modal would read pre-PUT `userDetails` (`is_authorized_for_sell=false`) and re-trigger the DDPI prompt immediately, making the authorize-for-sell checkbox appear to not stick.

`src/screens/TradeContext.js:getUserDeatils` is already `async` and returns the axios promise, so `await` at the DdpiModal call site now properly waits. Containing functions were all already `async`, so no signature changes were needed.

See `docs/BROKER_CONNECTION.md` → *DDPI authorize-for-sell* and `docs/CHANGELOG.md` entry `[3.8.6]` for full rationale.

## Trade execution architectural alignment (Phase A)

> **Status:** In progress (2026-05-01). Phase A precedes Phase B (SDK lift).
> **Spec:** `docs/SDK_TRADE_EXECUTION_MIGRATION.md § Phase A — architectural alignment`.

### Why Phase A exists

Pre-Phase-A, the app had **two divergent trade-execution lanes** for what is conceptually one operation:

| Flow | Pre-Phase-A endpoint | Hop count |
|---|---|---|
| Model Portfolio rebalance (`MPReviewTradeModal.placeOrder`) | `POST ${ccxtServer.baseUrl}rebalance/process-trade` | direct → ccxt |
| Bespoke single-trade (`StockAdvices.placeOrder`) | `POST ${server.baseUrl}api/process-trades/order-place` | app → Node → ccxt |
| Bespoke cart (`AddtoCartModal.placeOrder`) | `POST ${server.baseUrl}api/process-trades/order-place` | app → Node → ccxt |
| Ignore-trades reorder (`IgnoreTradesScreen.placeOrder`) | `POST ${server.baseUrl}api/process-trades/order-place` | app → Node → ccxt |
| `OrderService.placeOrders` (helper) | `POST ${server.baseUrl}api/process-trades/order-place` | app → Node → ccxt |

The Node hop ran `Routes/Broker/ProcessTrades.js → router.post("/order-place")` — a 200-LOC handler that:
1. Built per-broker payload via `createPayload()` and POSTed it to ccxt-india's `/<broker>/process-trades`
2. Ran `processTradeUpdate(...)` per result — top-level `traderecos.findOneAndUpdate` for non-basket trades, `processBasketTradeUpdate(...)` for `basket_advice[]` array updates with `$inc tradedQty`, ImpliedMultiplier accumulation, full-closure detection
3. If `basketId` was present, called ccxt-india `/<broker>/basket/run` to regen the net-position arrays
4. Wrapped the response as `{ response: tradeDetails, updatesProcessed, basketResult, testMode }`

Meanwhile MP's direct-ccxt call hit `/rebalance/process-trade` which:
1. Resolved credentials via `ProcessTradesDbMananger.fetch_trading_credentials(...)` (snake-cased per `BrokerKeys` enum)
2. Constructed a `Rebalancing(...)` instance, called `await rebalance2.process_trades(trades)` which dispatches per-broker via `BrokerFactory`
3. Called `_update_databases(...)` — MP-specific writes (`user_net_pf_model`, `subscriberExecutions`, `advice_executed`)
4. Returned `{ results, status, message, caPendingRecorded, orderErrors, fundsRequired, sessionExpired }`

**Two response envelopes** (`response[]` vs `results[]`), **two auth-resolution code paths**, **two error-humanization code paths**, **two flow signatures for caller consumption** in the app — all for the same conceptual operation. The Node hop existed because of legacy `traderecos` mongo writes; MP didn't need it because it had its own DB writers in ccxt-india.

### Post-Phase-A architecture

Post-Phase-A, both flows go **direct-to-ccxt**, with separate endpoints that share the response envelope:

```
       App                                        ccxt-india
  ┌────────────┐                                ┌──────────────────────────┐
  │ MP Review  │ ── /rebalance/process-trade ──→│ Rebalancing class        │
  │            │                                │ → BrokerFactory          │
  │            │                                │ → broker.process_trades()│
  │            │                                │ → _update_databases()    │
  ├────────────┤                                ├──────────────────────────┤
  │ Bespoke    │                                │ /orders/process-trade    │
  │  StockAd.. │                                │  handler (NEW Phase A):  │
  │  AddtoCart │ ── /orders/process-trade ─────→│ → ProcessTradesDbMananger│
  │  Ignore..  │                                │   .fetch_trading_creds   │
  │  OrderSvc  │                                │ → BrokerFactory          │
  └────────────┘                                │ → broker.process_trades()│
                                                │ → ProcessTradesDbMananger│
                                                │   .update_trade_reco()   │
                                                │   (top-level + basket    │
                                                │    array updates)        │
                                                │ → if basketId: call      │
                                                │   /<broker>/basket/run   │
                                                └──────────────────────────┘
```

Both endpoints internally call `BrokerFactory.create_from_credentials(...)` + `self.broker.process_trades(trades)` (the per-broker stack in `trading_logic/buy_sell_all_brokers.py`). That per-broker substrate is the shared base — _everything_ above it diverges by flow (MP-only DB writes vs bespoke-only DB writes); _nothing_ below it diverges (same broker classes, same per-customer egress IP resolution, same auth normalization).

### `/orders/process-trade` endpoint contract

**Path:** `POST https://ccxtprod.alphaquark.in/orders/process-trade`

**Headers:**
- `Content-Type: application/json`
- `X-Advisor-Subdomain: <tenant>` (resolved from `configData.config.REACT_APP_HEADER_NAME`)
- `aq-encrypted-key: <token>` (from `generateToken(REACT_APP_AQ_KEYS, REACT_APP_AQ_SECRET)` — same as MP)

**Required body fields:**
- `trades: Trade[]` — array of trade rows (each with `tradingSymbol`, `transactionType`, `quantity`, `tradeId`, `exchange`, `price`, etc.)
- `user_email: string` — top-level (NOT just inside `trades[*]` — see § "Trade/basket payload `user_email` contract")
- `user_broker: string` — canonical broker name (e.g. `"Zerodha"`, `"ICICI Direct"`)

**Optional broker-credential fields** (the per-callsite payload assembly inlined the same per-broker switch as legacy):
- `accessToken` / `jwtToken`
- `apiKey`, `secretKey`
- `clientCode`
- `viewToken`, `sid`, `serverId` (Kotak)

**Optional Phase B-precursor field:**
- `clientTradeId: string` — app-generated UUID per trade for SDK correlation across the dual-write soak. Echoed back in the response per row.

**Optional cart fields:**
- `basketId`, `basketName` — present only for cart placements (`AddtoCartModal`). When set, the handler calls ccxt's `/<broker>/basket/run` after placing trades to regen the net-position arrays.

**Response envelope:**

```json
{
  "results": [
    {
      "symbol": "INFY-EQ",
      "tradingSymbol": "INFY-EQ",
      "transactionType": "BUY",
      "tradeId": "...",
      "orderStatus": "complete",
      "orderId": "...",
      "uniqueOrderId": "...",
      "filledShares": 10,
      "averagePrice": 1450.5,
      "orderStatusMessage": "...",
      "user_broker": "Zerodha",
      "clientTradeId": "<echoed>",
      "session_expired": false
    }
  ],
  "orderErrors": [
    { "symbol": "...", "status": "REJECTED", "reason": "..." }
  ],
  "fundsRequired": 12500.0,
  "sessionExpired": false,
  "status": 0
}
```

**`results[]`** — one row per submitted trade, status-normalized broker output. Same key set as `/rebalance/process-trade.results[]` so the SDK Phase B contract has ONE response shape across both flows.

**`orderErrors[]`** — populated when at least one trade was rejected by the broker. Pre-humanized rejection reasons (extracted from `orderStatusMessage`). Null when all trades succeeded.

**`fundsRequired`** — number, populated when one or more rejections matched the `Rs. NNN` regex in the rejection message. Null otherwise.

**`sessionExpired`** — boolean, true if the broker session validation failed mid-batch.

### App-side migration (4 callsites)

Each callsite was edited inline — only the `axios.post` URL + body and the `response.data.results` read was changed. Surrounding logic (per-broker payload assembly, success-modal handoff, error-toast paths) is unchanged.

| File | Line (pre-Phase-A) | Pre-Phase-A URL | Post-Phase-A URL |
|---|---|---|---|
| `src/components/AdviceScreenComponents/StockAdvices.js` | 837 | `${server.server.baseUrl}api/process-trades/order-place` | `${server.ccxtServer.baseUrl}orders/process-trade` |
| `src/components/AdviceScreenComponents/AddtoCartModal.js` | 744 | same | same |
| `src/services/OrderService.js` | 45 | same | same |
| `src/screens/Drawer/IgnoreTradesScreen.js` | 552 | same | same |

Response-key shift: `response.data.response[]` → `response.data.results[]`. The success-modal handoff prop (`orderPlacementResponse`) carries the same per-row shape, so no downstream code paths needed updates.

### Direct-ccxt fallback (safety net)

Each callsite implements a **fallback to legacy Node** if the direct-ccxt call returns a 5xx or network error. Gated by env `Config.REACT_APP_BESPOKE_DIRECT_CCXT_FALLBACK` (default `'true'`). When the fallback fires, the callsite re-POSTs to the legacy `${server.baseUrl}api/process-trades/order-place` and reads `response.data.response[]` as before. This preserves trade-flow uptime if the new endpoint regresses; flip the env flag to `'false'` after one release of clean direct-ccxt traffic to retire the fallback path.

### Error humanization location

Phase A keeps error humanization at the same logical boundary as MP: ccxt-india writes pre-humanized rejection reasons into `orderErrors[].reason` (extracted by regex from broker's `orderStatusMessage`). The app's success-modal consumes both `results[]` (per-row) and `orderErrors[]` (humanized summary). No app-side string-matching of broker error JSON is needed.

For 5xx / network errors that bypass ccxt's per-broker try/catch (genuinely unreachable backend), the fallback to legacy Node provides a parallel path with its own error humanization. If the fallback also fails, the existing toast handler in each callsite shows the generic "There was an issue placing the trade…" copy.

### `ProcessTrades.js` deletion

`src/utils/ProcessTrades.js` (~700 LOC, 14.7K) was confirmed dead by prior agent investigation: only test fixtures imported it (`src/__tests__/utils/ProcessTrades.test.js`, `src/__tests__/integration/brokerTradeFlow.test.js`), no runtime caller. Phase A removes it. The integration test was rewritten against the new direct-ccxt mock pattern.

### Deprecation timeline for Node `/api/process-trades/order-place`

The legacy Node route is **kept in service for one full release** as the fallback target (see § Direct-ccxt fallback above). Once the next prod release ships and one trading day passes with zero direct-ccxt 5xx in `journalctl -u ccxt_prod.service` (no fallback hits in that window), the env flag flips to `'false'` and the next release after that removes the fallback branch from the four callsites and the Node route is deleted from `aq_backend_github`.

### SDK package types (Phase A precursor for Phase B)

The Phase B spec calls for `Trade` / `TradeResult` / `OrderStatus` types in BOTH RN and Flutter SDK packages. Phase A ships these as **internal-only** types — defined under `alphaquark-mobile-sdk/packages/rn/src/orders/types.ts` and `packages/flutter/lib/src/orders/types.dart` but NOT exported from the public package surface. tidi_new (Flutter) has no caller yet; Alphab2bapp (RN) gains callers in Phase B-1 when SDK widgets ship. Doing this in Phase A means the contract is locked in BEFORE the SDK widgets are built around it.

### Cross-repo files touched

| Repo | Path | Why |
|---|---|---|
| Alphab2bapp (this) | `src/components/AdviceScreenComponents/StockAdvices.js` | callsite migration |
| Alphab2bapp (this) | `src/components/AdviceScreenComponents/AddtoCartModal.js` | callsite migration |
| Alphab2bapp (this) | `src/services/OrderService.js` | callsite migration |
| Alphab2bapp (this) | `src/screens/Drawer/IgnoreTradesScreen.js` | callsite migration |
| Alphab2bapp (this) | `src/utils/ProcessTrades.js` | dead-code deletion |
| Alphab2bapp (this) | `src/__tests__/utils/ProcessTrades.test.js` | dead-code deletion |
| Alphab2bapp (this) | `src/__tests__/integration/brokerTradeFlow.test.js` | rewritten against direct-ccxt |
| ccxt-india (tidi) | `apps/app_orders.py` (NEW) | new `/orders/process-trade` handler |
| ccxt-india (tidi) | `trading_logic/orders/order_processor.py` (NEW) | bespoke trade DB writer (basket_advice + traderecos) |
| aq_backend_github (tidi) | `Routes/Broker/ProcessTrades.js` | unchanged in Phase A — kept as fallback target |

See `docs/CHANGELOG.md § PHASE-A-TRADE-EXEC-ALIGN` for the dated changelog entry.

---

## Phase B-1 — SDK proxy layer + hooks/widgets (2026-05-01)

> **Status:** B-1 landing — backend SDK proxy routes + RN/Flutter SDK package hooks/widgets. No app callers yet (those are Phase B-2). Spec: `docs/SDK_TRADE_EXECUTION_MIGRATION.md § Phase B-1 deliverables — concrete`.

### What B-1 ships

Three additive layers, no app-side caller wiring:

1. **Backend SDK proxy routes** at `/sdk/v1/orders/*` on `aq_backend_github` (`Ibt-branch`). Mirror of Phase 3's `/sdk/v1/connections/*` proxy pattern — thin pass-through over the existing legacy stack. JWT-authenticated via `sdkAuthSession({ scope: "orders:read" | "orders:write" })`. Routes:
   - `POST /sdk/v1/orders/place` — proxies to ccxt-india `POST /orders/process-trade` (Phase A endpoint)
   - `POST /sdk/v1/orders/:orderId/status` — proxies to ccxt-india `POST /order/status`
   - `GET /sdk/v1/orders/book` — proxies to ccxt-india `POST /order/book`, applies client-side `status?` / `broker?` filtering and `page`/`limit` pagination
   - `POST /sdk/v1/orders/:orderId/cancel` — proxies to ccxt-india `POST /order/cancel`

2. **`_selfCallLegacy` extracted to shared helper** at `Routes/sdk/v1/_helpers/selfCallLegacy.js`. Previously inline in `connections.js`. Same JWT-mint + `X-Advisor-Subdomain` header pattern; both `connections.js` and the new `orders/index.js` import from it. No behavior change; pure refactor.

3. **SDK package additions** in `alphaquark-mobile-sdk` (branch `develop`), both RN and Flutter:
   - **RN** (`packages/rn/src/orders/`):
     - `hooks/useExecuteTrades.ts` — `execute(trades)` posts to `/sdk/v1/orders/place`, polls `/status` for any `PENDING` results until terminal, exposes `{progress, results, isExecuting, error}`.
     - `hooks/useOrderBook.ts` — `GET /book` with cursor-style `loadMore` advancing `page`. Returns `{orders, isLoading, error, refresh, loadMore, total, hasMore}`.
     - `components/TradeReviewSheet.tsx` — pure-UI basket review (no API calls). Trade list, totals, confirm bar.
     - `components/TradeResultModal.tsx` — per-trade result rows with normalized status pills + AMO chip.
     - `components/TradeExecutionProgress.tsx` — spinner + "Placing N of M" while polling.
     - `index.ts` — barrel export. **Hooks + widgets are exported; types stay internal** (per spec § "Open questions — settled" #5; major version bump deferred to B-4).
   - **Flutter** (`packages/flutter/lib/src/orders/`): mirror of RN — `execute_trades.dart`, `order_book.dart`, plus three widgets under `widgets/`. Re-exported from `alphaquark_mobile_sdk.dart`.

### Auth + scope model

- Phase 3 `sdkAuthSession` middleware is generic; passing `{ scope: "orders:write" }` works because `ALL_SCOPES` in `aq_backend_github/utilities/sessionToken.js:56` already includes `orders:read` + `orders:write` (pre-existing — no enum extension needed).
- The mint server (`tidi:~/servers/server2/aq-sdk-mint-server/server.js`) is a thin proxy with no per-scope allowlist. **No mint server changes for B-1.** Token issuance for `orders:*` scopes works against the existing mint endpoint as-is.

### Why a thin proxy and not a rewrite

Same reasoning as Phase 3 connect: the per-broker quirks (Motilal session rotation, ICICI string-error envelopes, Kotak baseUrl persistence, Angel One per-customer SmartAPI, Zerodha 302 race) live in `ccxt-india/brokers/<broker>/<broker>.py` and stay there. The SDK boundary sits ABOVE those, not below. The Node SDK route layer adds:
- JWT-based authentication for SDK consumers (vs aq-encrypted-key for legacy)
- Future home for normalization helpers (`_normalizeStatus`, `_normalizeError` — landing in B-2/B-3)
- Versioned `/sdk/v1/*` namespace separable from legacy `/api/*`

### Pagination of `/sdk/v1/orders/book`

Broker order-book is a snapshot — no native pagination upstream from ccxt. The SDK route paginates **client-side** in the proxy layer:
1. Fetch full order list from ccxt `POST /order/book`
2. Apply `status?` filter (case-insensitive enum match)
3. Apply `broker?` filter (when caller wants a single broker rather than the user's primary)
4. Slice into `page` × `limit` window (default `page=1`, `limit=50`)
5. Return `{orders, total, page, limit, hasMore}`

This means total-count is exact (post-filter) but each page round-trips a full broker fetch. Acceptable for B-1; if MP soak shows order-book latency is the bottleneck, B-2 can add a 30s Redis cache keyed `(userId, broker, statusFilter)`.

### `userId` resolution

ccxt's `/order/{cancel,status,book}` endpoints take `userId: int`, NOT `user_email`. The SDK route handler resolves user once at route entry:
- `_resolveUserEmail(req)` from `req.sdkSession.user_email || req.sdkSession.user_ref`
- `User.findOne({email: userEmail}, {_id: 1})` against `req.tenant.db_name`
- Pass `userId: String(userDoc._id)` to ccxt

(Place uses `user_email` directly because ccxt's `/orders/process-trade` accepts that key — no extra resolution hop.)

### What B-1 does NOT do

- No app-side caller wiring (Phase B-2). `Alphab2bapp/src/**` and `tidi_new/lib/**` are unchanged.
- No `REACT_APP_USE_SDK_TRADE_FLOW` flag (Phase B-2).
- No `trade_dual_write_audit` Mongo collection (Phase B-2).
- No SDK semver bump — package stays on `1.x` minor; major bump (`2.0.0`) deferred to flag-flip in Phase B-4.

### Cross-repo files touched

| Repo | Branch | Path | Why |
|---|---|---|---|
| aq_backend_github (tidi) | Ibt-branch | `Routes/sdk/v1/_helpers/selfCallLegacy.js` (NEW) | extracted shared self-call helper |
| aq_backend_github (tidi) | Ibt-branch | `Routes/sdk/v1/connections.js` | refactored to import shared helper |
| aq_backend_github (tidi) | Ibt-branch | `Routes/sdk/v1/orders/index.js` (NEW) | the four SDK proxy routes |
| aq_backend_github (tidi) | Ibt-branch | `index.js` | mount `/sdk/v1/orders` sub-router |
| aq_backend_github (tidi) | Ibt-branch | `docs/CHANGELOG.md` | dated entry |
| alphaquark-mobile-sdk | develop | `packages/rn/src/orders/hooks/useExecuteTrades.ts` (NEW) | RN execute hook |
| alphaquark-mobile-sdk | develop | `packages/rn/src/orders/hooks/useOrderBook.ts` (NEW) | RN order-book hook |
| alphaquark-mobile-sdk | develop | `packages/rn/src/orders/components/TradeReviewSheet.tsx` (NEW) | review UI |
| alphaquark-mobile-sdk | develop | `packages/rn/src/orders/components/TradeResultModal.tsx` (NEW) | result UI |
| alphaquark-mobile-sdk | develop | `packages/rn/src/orders/components/TradeExecutionProgress.tsx` (NEW) | progress UI |
| alphaquark-mobile-sdk | develop | `packages/rn/src/orders/index.ts` (NEW) | barrel — exports hooks + widgets, NOT types |
| alphaquark-mobile-sdk | develop | `packages/rn/src/index.ts` | re-export `from './orders'` |
| alphaquark-mobile-sdk | develop | `packages/flutter/lib/src/orders/execute_trades.dart` (NEW) | Flutter mirror |
| alphaquark-mobile-sdk | develop | `packages/flutter/lib/src/orders/order_book.dart` (NEW) | Flutter mirror |
| alphaquark-mobile-sdk | develop | `packages/flutter/lib/src/orders/widgets/*.dart` (NEW) | Flutter widgets |
| alphaquark-mobile-sdk | develop | `packages/flutter/lib/src/orders/orders.dart` (NEW) | barrel |
| alphaquark-mobile-sdk | develop | `packages/flutter/lib/alphaquark_mobile_sdk.dart` | re-export |
| Alphab2bapp (this) | feature/sdk-plus-config-ui worktree | `docs/APP_ARCHITECTURE.md` (this section) | architecture doc |
| Alphab2bapp (this) | feature/sdk-plus-config-ui worktree | `docs/SDK_TRADE_EXECUTION_MIGRATION.md` | progress section |
| Alphab2bapp (this) | feature/sdk-plus-config-ui worktree | `docs/CHANGELOG.md` | dated entry |

See `docs/CHANGELOG.md § PHASE-B-1-SDK-LIFT` for the dated entry.

---

## Market-indices header — prev-close base & day-boundary refresh (2026-06-22)

The HomeScreen market-indices header (NIFTY / SENSEX / BANKNIFTY) shows each
index's live value plus its change vs **previous close**. Two surfaces render
this, with mirrored logic:

- `src/components/HomeScreenComponents/MarketIndices.js` — the scrollable index
  chips used across variants.
- `src/screens/Home/hooks/useHomeMarketSummary.js` — the alphanomy-variant Home
  header (tickers + P&L hero).

### Data sources

| Datum | Source | Cadence |
|-------|--------|---------|
| Live value (LTP) | WebSocket `ltp_update` via `WebSocketManager` singleton | continuous during market hours |
| Previous close (the **base**) | `POST ${ccxtServer}misc/indices-previous-close` (REST), body `{symbols:[{symbol,exchange}]}`, headers incl. `aq-encrypted-key` | fetched on mount + on foreground (see below) |

The WebSocket feed carries **only** the current LTP — never OHLC or any close
value. The change indicator is computed purely client-side:

```
change   = liveLTP − previousClose
change % = (change / previousClose) × 100
```

`previousClose` is the **last completed trading session's** settled close. It
rolls over to the new value shortly after each day's market close (settlement
publish), **not** at the next open. There is no 9:15 / market-open trigger
anywhere in the app — time of day is never the variable.

### Comparison modes

- `prevClose` — endpoint returned a valid base; chips show change vs yesterday.
- `opening` — base fetch failed after 3 retries; the FIRST live LTP per index
  becomes the baseline (change starts at 0, grows intraday). Degraded fallback.
- `loading` — before either resolves.

Both surfaces MERGE base values across (re)fetches rather than replacing, so a
partial endpoint response never drops an already-known base (see the inline
NIFTY-flicker / SENSEX-alias incident comments).

### Day-boundary / foreground refresh (2026-06-22) — the fix

**Bug:** the base was fetched **once on mount** and held in memory for the whole
session, with no day-boundary refresh. A session left open across the
close→open rollover kept a STALE base. Reported 2026-06-22: app opened Friday
*pre-close* → base = Thursday's close → still showing Thursday's close on Monday
morning; only a manual logout/login (which remounts → re-fetches) cleared it.

**Fix:** both surfaces re-fetch the prev-close base when the app returns to the
**foreground** (`AppState` `'active'`), throttled by `PREV_CLOSE_REFRESH_MS`
(15 min). The existing retry+merge fetch is left intact and exposed via a ref so
the `AppState` listener re-triggers it without duplicating logic:

- `lastPrevCloseFetchRef` — ms timestamp of the last successful fetch (0 = never).
- `fetchPrevCloseRef` (MarketIndices) / `fetchPrevRef` (useHomeMarketSummary) —
  holds the latest fetch fn.
- On `'active'`, if `Date.now() − lastFetch ≥ PREV_CLOSE_REFRESH_MS`, re-fetch.

A same-session refresh returns the same base (no chip flicker — the recompute
produces an identical change); the value only differs across a session that
spans a market close, which is exactly the stale-base case. The 15-min throttle
also makes a post-close foreground (>15 min after the last fetch) pick up
today's freshly-settled close, so the intraday close→evening rollover is covered
too, not just overnight/weekend.

**Not addressed (by design):** an app kept continuously in the foreground across
the 15:30 close without ever backgrounding won't refresh until the next
foreground transition — acceptable, since the reported failure mode
(overnight/weekend) always involves a background→foreground transition.

**Applies to both repos** — Alphanomy (whitelabel fork) and Alphab2bapp
(upstream); the two files are byte-identical and were patched together.

## Customer manual basket entry and exit (2026-08-12)

Every visible basket recommendation—including zero-system-fill and expired
baskets—exposes **I entered/exited this basket manually**. The sheet first
calls the customer preview endpoint with only the basket ID. Node verifies a
fresh per-tenant Firebase ID token and derives ownership from its email; the app
does not send or select a customer email. Preview resolves same-name,
exact-original-contract basket documents across superseded/reissued IDs and
returns the original indicative lots, already recorded entries, missing entry
lots, actual normalized open lots, whether the recommendation is cancelled, and
a state token.

Customers may record missing entry lots; contract and side are fixed by the
recommendation. **Basket lots are indicative only and are never a cap** — a
1-lot basket is routinely traded as 5 by a customer applying their own
multiplier, so entry lots validate as any positive whole number and the sheet
shows the indicative size as context, not a limit. Sizes above it are listed in
the confirm dialog before submission. Exit lots stay read-only and exact: they
must flatten precisely the resulting open position. A **cancelled**
recommendation shows an explanatory notice and offers no entry rows (the server
returns `RECOMMENDATION_CANCELLED`); exits remain available so an
already-recorded position can still be closed. Prices typed against the wrong
leg of the same basket are rejected server-side (`PRICE_LOOKS_SWAPPED`). They can save an entry-only open position or also
record the atomic full exit of every resulting open leg. Each selected entry
and exit requires broker order ID, price and execution time. The
backend simultaneously retires each manually completed original leg with zero
remaining quantity, preventing a later basket acceptance from re-entering it.
support/evidence reference is optional. Apply rechecks the family token and
writes audited COMPLETE entry fills and, when selected, COMPLETE/fullClose exit
fills; it never places a broker order. Order history remains visible and the
central position reflects the recorded open/closed state on app and web. The form refreshes
`getAllTrades` after success. Stale state, ambiguous opposing positions,
unrecommended entries, fractional or zero lots, partial exit evidence, invalid
prices/times, cross-leg price swaps, new entries on a cancelled recommendation,
and another customer's basket fail closed server-side.

Runtime files: `src/UIComponents/StockAdvicesUI/BasketCard.js`,
`src/components/ManualBasketExitModal.js`, and
`src/services/ManualBasketExitService.js`. Backend ownership and audit logic:
`aq_backend_github/Routes/Admin/BasketManualExit.js` and
`utilities/basketManualExit.js`.

## Customer document and report asset resolution (2026-07-28)

Customer-facing document surfaces must not assume that a historical URL is
still valid or still represents the current tenant brand:

- `PaymentHistoryScreen` passes the live `ConfigContext` logo and the bundled
  app-variant logo into its presentation. The row tries live tenant branding,
  bundled branding, then the logo snapshot stored in the historical invoice.
  This only affects the list UI; a logo baked into stored PDF bytes requires a
  targeted server-side regeneration.
- `ResearchReportScreen` merges CCXT, Node research-report, and uploaded-PDF
  sources. URL resolution accepts `reportLink`, `link`, presigned/PDF URL
  aliases and upload file URLs. Embedded `pdfData` is normalized as base64 and
  written first, so a dead historical object URL does not block a valid PDF.
  Rows with neither a URL nor embedded PDF are not presented as downloadable.
- Empty trade arrays are a submission invariant, not merely an empty-state
  label. Review footers are absent for empty standard/Zerodha carts, and all
  cart/MP submit handlers return before broker-session validation or order API
  calls when no placeable order exists.

## Basket Reject cancel-flag propagation (2026-08-12)

Customer "Reject" on a basket card calls `PUT /comms/reco/cancel/<basketId>`
(ccxt-india). That endpoint queues Celery work and returns **HTTP 202** —
it does not confirm completion. The worker sets `cancel: true` +
`customer_visible_until` (15:50 IST trade-day cutoff) on the basket's
parent `traderecos` row only; embedded `basket_advice` legs are untouched.

`GET /api/user/trade-reco-for-user` (aq_backend) keeps returning the
cancelled row until the `customer_visible_until` cutoff
(`utilities/tradeRecoVisibility.js`). For the card to visibly react before
that cutoff, the parent's `cancel` flag must survive the client flatten:

- `src/screens/TradeContext.js` flatten of `basket_advice` legs now sets two
  separate flags, mirroring web `StockRecommendation.js`:
  `cancel: advice.cancel === true` (leg-level) and
  `basketCancelled: item.cancel === true` (parent-level).
- The same `TradeContext` reduce now drops any leg whose
  `cancel === true || basketCancelled === true` from the recommended feed.
  A customer Reject is "I don't want this trade" — the basket card
  disappears entirely on the first post-Reject refetch (client-side),
  without waiting for the backend's `customer_visible_until` cutoff.
- `src/components/AdviceScreenComponents/StockAdvices.js` `groupTrades`
  carries both flags onto the grouped basket object (for any partially
  cancelled basket that still renders).
- `handleCancelBasket` treats the 202 honestly: toast reads
  "Basket rejection requested" (not "rejected successfully"), payload
  includes `cancel_scope: 'recipient'`, and a 3s-delayed second
  `getAllTrades()` absorbs the Celery worker race (the first refresh can
  land before the worker flips `cancel`).

Net effect: after Reject the basket card leaves the customer feed on the
next refetch (≈1–4s, worker permitting); the backend row remains stored
for audit and is hidden from the API response at its
`customer_visible_until` cutoff as before.
## Model-portfolio execution parity (2026-09-03)

The app now follows the same action boundaries as web:

- failedTrades from rebalance/get-repair is authoritative Repair evidence. It
  opens the exact frozen-leg review even if the derived subscriber execution
  row is missing or says toExecute.
- requiresFreshRebalance with no frozen failed legs is an allocation review,
  not an old-order retry. A partial row with neither result is held in Repair
  discovery and is never allowed to call Calculate by fallback.
- A mixed Zerodha plan is one durable attempt across sell and buy phases.
  Completion of the sell batch leaves status pending; exact broker evidence
  decides whether to continue buys, repair sells, or request authorization.
- Holdings confirmation reads user_net_pf_model; attempted-order history is
  never presented as current ownership. Any funds cache older than an order
  round-trip is invalid, and NFO/BFO lot counts are expanded before Publisher
  handoff.

These are JavaScript-only changes and are delivered by signed OTA. Backend
frozen plans, broker order IDs/tags, and reconciliation remain the financial
authority; the app only selects the correct customer action and renders it.

## Standalone exit delivery lineage (2026-09-24)

An EXIT recommendation is a new delivery with its own `advice_reco_id`.
`sourceAdviceRecoId` points to the original entry, and the customer API also
projects `positionAdviceRecoId` as the canonical position identity. The backend
is authoritative for execution-aware `positionStatus`; a delivered but unfilled
exit does not close a holding.

The app's withdrawn-unfilled-entry helper uses
`positionAdviceRecoId || sourceAdviceRecoId || advice_reco_id`, plus symbol, so
a manager full-close suppresses the stale unfilled entry even when entry and
exit delivery IDs differ. Legacy same-ID exits remain compatible.
