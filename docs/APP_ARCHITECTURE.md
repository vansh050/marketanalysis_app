# Mobile App Architecture

> **Last updated**: 2026-04-05 (rev 4c869c7)
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

How old a recommendation can be and still appear on Home / Recommendations is controlled by the advisor-level setting **`advice_show_latest_days`** (`AllAdvisorDetails` in `aq_backend_github`; admin UI field: "Recommendation visibility"). The app fetches it via `GET /api/admin/frontend-config` inside `TradeContext.fetchAdviceShowDays` and reads it from **`response.data.data.adviceShowLatestDays`** (the payload shape is `{ success, data: { adviceShowLatestDays } }`). The value flows into `adviceShowDays` state, is applied as `cutoffDate = today - adviceShowDays` in the main reduce at `TradeContext.js:617`, and every recommended/rejected/ignored trade must satisfy `tradeDate >= cutoffDate` to be surfaced. If the fetch fails or returns an out-of-range value (1–365), the app falls back to `useState(15)`.

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
│       │  API: GET /api/user/trade-reco-for-user?user_email={email}│
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
| TPIN modal trigger | `detectEdisFailures` returns **every** rejected SELL with no keyword filtering — aligned with web 2026-04-17 | Web fires modal on any rejected SELL, explicitly avoiding keyword filter (`ProcessTrades.js:382-383`: "*Don't rely on CDSL keyword detection — error message formats can change*") |

The TPIN trigger is now aligned: both platforms fire the modal on any rejected SELL, not just ones whose error text matches a keyword list. Trade-off: TPIN may appear on market-hours / insufficient-funds rejections — accepted for reliability against changing broker error phrasings (Upstox, Dhan, Zerodha have all rephrased sell-auth errors at various points).

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
            ├── Multiple advisors → show RA ID screen (user picks)
            └── Not found → show RA ID screen (manual entry)
```

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

**Fallback rule:** If an email maps to multiple advisors, the RA ID screen is always shown to let the user choose.

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

### 8.3 Contexts (`src/context/`)

| File | Purpose |
|------|---------|
| `ConfigContext.js` | App-wide configuration (288 lines) — also surfaces semantic `colorTokens` overrides from the advisor config |
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
