# AlphaQuark Mobile App — Overall System Summary for Test Design

> **Last updated**: 2026-05-11
> **Branch**: `release/deploy_5.1` (Android + iOS build branch since 2026-09-29; previously `feature/sdk-plus-config_forkv2`)
> **iOS branch**: `feature/ios2.6`
> **Purpose**: Give QA, engineering, and test-design owners one cross-cutting view of how the mobile app behaves across React Native, the Node.js backend, the Python (ccxt-india) backend, broker APIs, payment gateways, and async recovery flows. Use this as the primary anchor when designing test suites so coverage is system-level, not just screen-level.

---

## 1. What this system is

The AlphaQuark B2B mobile app is a React Native application that lets advisory clients:

1. Authenticate (email+password, Google, Apple Sign-In on iOS)
2. Connect to 14 stock brokers and manage session lifetimes
3. Receive real-time trade recommendations pushed by an advisor
4. Execute single stock orders and bulk rebalance baskets against a connected broker
5. Subscribe to model portfolios and execute advisor-driven rebalance signals
6. Monitor portfolio holdings, P&L, and live prices via WebSocket
7. Pay for subscriptions (Razorpay, Cashfree, PayU) and manage renewal

The app shares its two backends with the AlphaQuark web app (`prod-alphaquark-github`). Backend state is canonical — the mobile app is a thin client for display and action trigger; critical state transitions (order placement, subscription activation, DDPI/TPIN, broker token refresh) complete in the backend.

---

## 2. Top-level architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native 0.76+)                         │
│                                                                             │
│  App.js → Navigation.js → Screen stack                                     │
│  Key contexts: TradeContext · ConfigContext · MultiBrokerContext            │
│                MarketDataContext · GstConfigContext                         │
│  SDK layer: @alphaquark/mobile-sdk (AqSdkProvider)                         │
│  State: AsyncStorage (persistence) + React state + EventEmitter             │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │  HTTPS / WebSocket
          ┌──────────────┴──────────────────┐
          ▼                                 ▼
┌──────────────────────┐       ┌─────────────────────────────────┐
│  NODE.JS BACKEND      │       │  PYTHON BACKEND (ccxt-india)    │
│  server.alphaquark.in │       │  ccxtprod.alphaquark.in         │
│                       │       │                                 │
│  • User/profile/auth  │       │  • Broker adapters (14)         │
│  • Subscription/plan  │       │  • Order placement              │
│  • Broker persist     │       │  • Rebalance engine             │
│  • SDK mint/session   │       │  • Recommendation delivery      │
│  • Admin settings     │       │  • LTP / symbol lookup          │
│  • Notification prefs │       │  • GTT / advanced orders        │
│  • Invoice/payment    │       │  • Sell-auth revoke detection   │
└──────────┬────────────┘       └──────────────┬──────────────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  EXTERNAL SYSTEMS                                                │
│  Firebase Auth · Zerodha · Angel One · Upstox · Fyers · ICICI  │
│  Dhan · Kotak · HDFC · Groww · Axis · AliceBlue · Motilal      │
│  IIFL · Razorpay · Cashfree · PayU · Digio · FCM / APNs        │
└──────────────────────────────────────────────────────────────────┘
```

### Server endpoints

| Backend | Base URL | Used for |
|---------|----------|----------|
| Node.js | `https://server.alphaquark.in/` | user, subscription, broker persist, admin |
| Python (ccxt) | `https://ccxtprod.alphaquark.in/` | broker APIs, orders, rebalance, reco delivery |
| WebSocket | `https://websocket.alphaquark.in/` | real-time LTP feeds (indices + holdings) |

---

## 3. Major functional layers

### 3.1 Authentication and session lifecycle

**Entry point**: `src/screens/Authentication/LoginScreen.js`

Supported login methods:
- Email + password (Firebase email/password auth)
- Google Sign-In (`@react-native-google-signin/google-signin`)
- Apple Sign-In (`@invertase/react-native-apple-authentication`) — **iOS only**, gated by `Platform.OS !== 'ios'` guard

Flow after successful Firebase auth:
1. Firebase `idToken` obtained → POST `/api/user/get-create-user` (Node backend creates or fetches the user document)
2. Backend returns full user profile including `appadvisors` config, plan tier, broker list, subscription state
3. `TradeContext.js` hydrates with this profile; `ConfigContext.js` merges backend advisor settings over `.env` defaults
4. `useAuthSessionValidator` starts a background interval (every 5 minutes) to call `/api/user/validate-session` and auto-logout on invalidation or version mismatch

**Email-only Apple Sign-In path**: if Apple returns no email (subsequent sign-ins), the app navigates to `EmailScreenAppleLogin` to collect the email from the user before completing the backend user-create call.

**Race condition area**: Firebase auth state and backend profile hydration are two separate async steps. If the backend call fails (network loss after Firebase success), the app user is Firebase-authenticated but has no profile — `TradeContext` is empty. The app must handle this gracefully and retry profile load.

---

### 3.2 Config and multi-tenant whitelabeling

**Entry point**: `src/context/ConfigContext.js` + `src/utils/Config.js` + `src/utils/safeConfig.js`

Every app deployment is a "variant" keyed by `APP_VARIANT` in `.env`. The variant selects:
- A visual theme (`designs/<variant>/` tokens → primitives → screens)
- Advisor-specific backend overrides fetched from `appadvisors` collection on login (logo, colors, contact email, broker keys, feature flags)
- SDK integration level (`REACT_APP_SDK_INTEGRATION=true` enables `AqSdkProvider` in `App.js`)

**Android vs iOS**: the `.env` on the Android branch has `REACT_APP_ADVICE_SHOW_LATEST_DAYS=15` (iOS has 7), `REACT_APP_ANGEL_ONE_API_KEY=J0v1kqJC` (iOS has an older key), and a corrected CCXT URL (`ccxtprod.alphaquark.in` — iOS had a typo `ccxtpropd`).

---

### 3.3 Broker connection

**Key files**: `src/components/BrokerConnectionModal/`, `src/GlobalUIModals/ModalManager.js`, `src/utils/brokerAuth.js`, `src/screens/Broker/BrokerAuthScreen.js`

There are two routing paths for broker connections:
- **Legacy path**: per-broker modal in `src/components/BrokerConnectionModal/` (credential form or WebView OAuth)
- **SDK path** (Phase 3): `Phase3SdkBrokerModal.js` wrapping `@alphaquark/mobile-sdk` widgets, gated by `REACT_APP_USE_SDK_BROKER_FLOW` and per-broker `SDK_ELIGIBLE_MODALS` allowlist

**Broker connection methods** (by broker type):

| Type | Mechanism | Examples |
|------|-----------|----------|
| Credential form | User enters API key + secret, app posts to ccxt | Zerodha, Fyers, Kotak, IIFL, AliceBlue, Motilal, Angel One |
| WebView OAuth | App opens in-app WebView, intercepts redirect URL | Upstox, ICICI, HDFC, Dhan, Groww, Axis |
| DummyBroker | Paper-trading simulation, no real broker needed | DummyBroker |

**Android-specific deep links**: `AndroidManifest.xml` registers:
- `alphab2bapp://zerodha/callback` — custom scheme for Zerodha OAuth callback
- `https://app-links.alphaquark.in/broker-callback` (Android App Links, `autoVerify=true`) — HTTPS deep link for Groww and any broker using the App Links callback path

**iOS**: App Links are handled via Universal Links (`ios/AlphaQuark/Info.plist`). Apple Sign-In is an additional auth method that does not exist on Android.

**Broker connect state machine**:
```
User taps Connect
    → ModalManager routes to legacy or SDK modal
    → Credential modal OR BrokerAuthScreen (WebView)
    → On success: POST /api/user/broker-connect (Node backend persists broker creds)
    → TradeContext updates connected_brokers[]
    → Broker appears as "Connected"
    → Token refresh cron (Node) refreshes short-lived tokens (Upstox, etc.) every 30 min
```

**Race conditions**:
- Token refresh cron and manual reconnect can race to write `access_token` to the same user document
- Fyers has 4+ separate code paths to generate a login URL (see `docs/BROKER_CONNECTION.md`); fixing only one leaves others broken
- `connected_brokers[]` + top-level user fields (e.g. `user.clientCode`) are written by different paths — partial writes leave stale state

---

### 3.4 Trade recommendation flow

**Key files**: `src/screens/Home/HomeScreen.js`, `src/components/AdviceScreenComponents/StockAdvices.js`, `src/utils/ProcessTrades.js`

Flow:
1. `HomeScreen` loads on app open → fetches latest recommendations via GET `/api/trade-recos` (Node)
2. Recommendations are filtered by `REACT_APP_ADVICE_SHOW_LATEST_DAYS` (15 days on Android, 7 on iOS)
3. User taps a reco card → `ReviewTradeModal.js` opens
4. User confirms → `ProcessTrades.js` POST `/orders/process-trade` to Node (routed to ccxt)
5. ccxt places order at broker → returns order status

**Platform-specific behavior** (`HomeScreen.js:688,750,765`):
- Android uses `BackHandler` to intercept hardware back button in some flows
- Index subscription logic (`Platform.OS === 'android'` guards at lines 1002+) differs for Nifty/BankNifty WebSocket subscription

**Race condition areas**:
- User can open `ReviewTradeModal` for the same reco from two different entry points (StockAdvices list + push notification deep link) → duplicate order risk if not deduped
- Recommendation list polls at multiple levels (context re-fetch, pull-to-refresh) — can produce stale vs live mismatch if network is slow

---

### 3.5 Order execution and broker routing

**Key files**: `src/utils/ProcessTrades.js`, `src/services/OrderService.js`, `src/utils/brokerPublisher.js`

There are three order placement paths:
1. **Direct ccxt call**: `ProcessTrades.js` posts directly to `/orders/process-trade` on Node → ccxt routes to broker adapter
2. **Publisher SDK**: `brokerPublisher.js` calls Zerodha Kite Publisher or Fyers API Connect (in-browser JavaScript SDKs loaded in a WebView) — only for single-stock buy/sell via publisher basket
3. **SDK orchestrator** (Phase C, partially in progress): `@alphaquark/mobile-sdk` `executeAdvice()` call that wraps the above

**Sell authorization gate** (critical): before any sell order, the app checks `ddpi_enabled` + `is_authorized_for_sell` + `sell_auth_set_at` (is it today?). If none are true, the DDPI/TPIN modal fires. See `docs/SELL_AUTH_ARCHITECTURE.md`.

**Race condition areas**:
- `sell_auth_set_at` day-scope check: if the device clock is wrong or if IST midnight boundary is crossed mid-rebalance, some orders in the batch see `is_authorized_for_sell: true` and some see false → partial execution
- Parallel trade execution (bulk rebalance): broker-side rate limiting (Upstox: 10 orders/sec) causes throttle rejections that must be caught and retried without re-triggering the full batch
- Zerodha publisher basket: symbol conversion (`convertSymbolsToZerodha`) runs client-side with a local scripmaster cache — cache staleness causes silent wrong-symbol orders

---

### 3.6 Model portfolio subscription and rebalance

**Key files**: `src/components/ModelPortfolioComponents/`, `src/screens/Drawer/ModelPortfolioScreen.js`, `src/components/AdviceScreenComponents/RebalanceModal.js`, `src/components/ModelPortfolioComponents/MPReviewTradeModal.js`

**Subscription flow**:
```
User opens ModelPortfolioScreen
    → GET /api/model-portfolios (lists available strategies)
    → User taps Subscribe → UserStrategySubscribeModal
    → Payment gateway (Razorpay/Cashfree/PayU) OR free tier
    → POST /api/model-portfolio/subscribe
    → Backend creates modelPortfolioUser record
    → User sees portfolio in "My Portfolios"
```

**Rebalance signal flow**:
```
Advisor publishes rebalance on web dashboard
    → ccxt computes per-subscriber buy/sell diff
    → FCM push notification to subscribed users
    → User opens RebalanceAdvices tab (HomeScreen)
    → Diff is fetched: GET /rebalance/get-rebalance-trades (ccxt)
    → User opens MPReviewTradeModal
    → User approves → ProcessTrades.js executes bulk orders
    → Per-order status returned → MPStatusModal shows results
    → "Mark as Placed" available for broker-side failures
```

**Race condition areas**:
- `advisor` field normalization: if `modelPortfolioUser.advisor` was inserted without normalization to `REACT_APP_HEADER_NAME`, the rebalance diff API can return 0 trades (mismatch query) — the fix is at all insert callsites (`5ad2959`)
- Multiple simultaneous rebalance publishes: if advisor publishes twice before user executes the first, the second overwrites first in the DB and the first batch is silently lost
- Holdings fetch for diff computation can use stale broker holdings (last cached fetch) if the broker API is rate-limited — diff is wrong, user executes incorrect quantities

---

### 3.7 Real-time market data

**Key files**: `src/context/MarketDataContext.js`, `src/FunctionCall/useWebSocketCurrentPrice.js`

The app connects to `wss://websocket.alphaquark.in/` for:
- Index prices: Nifty 50, Bank Nifty (Sensex and FinNifty removed in `b91ea0f`)
- Per-holding LTP: subscribed to a token set derived from the user's connected broker holdings

**Android-specific**: `HomeScreen.js` explicitly guards index subscription logic with `Platform.OS === 'android'` checks. The WebSocket manager had a `connect_error` hang bug fixed in `b91ea0f` — the fix removes reconnection loops on FinNifty/BankNifty alias staleness.

**Race condition areas**:
- Stale-alias WebSocket subscriptions: if the symbol token set is rebuilt while a subscription is active, duplicate subscriptions can cause flicker (price oscillating between old and new subscription responses) — fixed in `2afd39b` for Nifty/BankNifty
- WebSocket reconnects on background/foreground cycle: app moving to background closes the socket; on foreground restore, re-subscription must complete before the user sees the holdings list or prices will show zero/stale

---

### 3.8 Sell-authorization (DDPI / TPIN / EDIS)

**Canonical doc**: `docs/SELL_AUTH_ARCHITECTURE.md`

The three mechanisms:
- **DDPI** (permanent): once set, no per-day prompt. Checked via broker live API at connect time.
- **TPIN/EDIS** (per-day): user must complete an OTP flow via CDSL/NSDL every trading day before selling.
- **POA** (legacy, honored but not set by new accounts)

Two flags on every user and every `connected_brokers[]` entry:
- `ddpi_enabled`: permanent, set by broker live check
- `is_authorized_for_sell`: day-scoped, set by TPIN completion; auto-revoked by `sell_auth_revoke.py` when a sell rejection is detected

**Race condition areas**:
- Rebalance basket with mixed buy/sell orders: if the sell auth check runs once at the start but some orders take >30 seconds (rate-limited broker), the TPIN session can expire mid-batch
- `is_authorized_for_sell` written by both frontend (`update-edis-status` endpoint) AND ccxt auto-detection → concurrent writes can leave inconsistent state between top-level user doc and `connected_brokers[]`
- DDPI status response format varies by broker: Zerodha `save-ddpi-status`, Angel One `verify-dis`, Dhan `get-edis-status` each have different response shapes; parsing errors leave the flag unset silently

---

### 3.9 Push notifications

**Key file**: `index.js`, `src/components/NatificationServiceNav.js`

**Android**: uses `@notifee/react-native` directly with `@react-native-firebase/messaging`. The notification channel is created at startup.

**iOS**: uses `@notifee/react-native` but initialization is **deferred in a `setTimeout`** to avoid TurboModule crash on iOS (see `index.js` — this is the main iOS vs Android structural difference at the entry point). APNs registration happens via Firebase Messaging.

**Android-only package**: `react-native-notifications` (`^5.1.0`) exists only in the Android branch's `package.json` — not in iOS.

Push notifications navigate to specific screens via `NatificationServiceNav.js`. FCM deep-link payloads can include `screen` + `params`. If the app is backgrounded vs terminated, the navigation handling differs.

**Race condition areas**:
- Notification tapped while app is cold-starting: React Navigation may not be mounted yet; the deep-link dispatch must wait for navigation readiness
- Duplicate notification display: `notificationDisplayed` flag prevents double display but it is local to the JS runtime — on process restart (app killed and relaunched from notification), this flag resets

---

### 3.10 Payment and subscription

**Key files**: `src/screens/Home/TokenPurchaseModal.js`, `src/components/ModelPortfolioComponents/MPInvestNowModal.js`, `src/screens/Drawer/PaymentHistoryScreen.js`

Three payment gateways: Razorpay, Cashfree, and PayU (all tenants; selection is per-advisor config).

**Flow**:
```
User initiates purchase
    → POST /api/payment/create-order (Node) → returns gateway order ID
    → Native gateway SDK opens (RazorpayCheckout / CashfreeSDK / PayUBizSdk)
    → User completes payment
    → Gateway redirects/callbacks to app
    → App polls GET /api/payment/status (Node) with exponential backoff
    → On success: subscription activated on backend
    → ConfigContext + TradeContext refresh to reflect new plan tier
```

**Platform differences**:
- iOS payment history has a different rendering path at `PaymentHistoryScreen.js:147` (iOS-specific invoice display)
- Cashfree environment is set by `REACT_APP_PAYU_ENV=PRODUCTION` (both branches)

**Race condition areas**:
- User force-kills app immediately after payment completes but before the backend webhook: `PendingPaymentManager` stores a pending-payment record in AsyncStorage and re-tries the status check on next app launch
- Double-tap on payment button before gateway SDK captures the tap: can create two orders in the backend; idempotency depends on gateway order-ID uniqueness
- Subscription activation race: if the backend webhook fires before the frontend poll returns, the user profile is already updated and the frontend's poll response is a no-op — this is benign but can cause apparent UI delay

---

### 3.11 Design system and whitelabeling

**Key files**: `src/design/`, `designs/<variant>/`, `src/context/ConfigContext.js`

The app supports multiple visual variants via the `DesignProvider` system:
- `DESIGN_VARIANT` (or fallback to `APP_VARIANT`) selects the design tree
- Each variant has: `tokens/` (colors, spacing, typography) → `primitives/` → `composites/` → `screens/`
- SDK widget overrides live in `designs/<variant>/sdk/`

The whitelabel fork model (`docs/WHITELABEL_RECIPE.md`) keeps `src/` identical across forks; variant-specific code lives in `designs/` and `whitelabel/` overlays.

---

## 4. iOS 2.6 vs Android (feature/sdk-plus-config_forkv2) — branch delta

The two branches share the same `src/` code at the business logic level. All divergence is in platform shell, config, and test infrastructure.

### 4.1 Entry point (`index.js`)

| Area | Android branch | iOS 2.6 |
|------|---------------|---------|
| Native module init | Direct top-level `import notifee ...` | Wrapped in `setTimeout(() => { const notifee = require(...) ... }, 0)` to defer TurboModule init and avoid iOS crash |
| Notification handling | Executes immediately on module load | Deferred until after React Native bridge is ready |

### 4.2 iOS native shell (`ios/`)

| File | What differs |
|------|-------------|
| `AppDelegate.mm` | iOS 2.6 **removes** `RCTAppDependencyProvider` (TurboModules explicit wiring) and **adds** font-family debug logging. Android branch retains the dependency provider setup for RN 0.78+ TurboModules. |
| `Info.plist` | iOS-specific privacy descriptions (NSCameraUsageDescription, NSPhotoLibraryUsageDescription, NSFaceIDUsageDescription, etc.) |
| `Podfile` / `Podfile.lock` | iOS CocoaPods dependency resolution — no Android equivalent |

### 4.3 Android shell (`android/`)

| File | What differs in Android branch |
|------|-------------------------------|
| `AndroidManifest.xml` | Adds Zerodha OAuth intent-filter (`alphab2bapp://zerodha/callback`) and App Links intent-filter for `https://app-links.alphaquark.in/broker-callback` with `android:autoVerify="true"`. iOS 2.6 does not have these intent-filters. Deep link host changed from `test.alphaquark.in` to `prod.alphaquark.in`. |
| `build.gradle` | Version / signing config differences |

### 4.4 Environment variables (`.env`)

| Variable | Android branch | iOS 2.6 |
|----------|---------------|---------|
| `REACT_APP_CCXT_SERVER_API_URL` | `https://ccxtprod.alphaquark.in/` (correct) | `https://ccxtpropd.alphaquark.in/` (typo — may hit wrong host) |
| `REACT_APP_ANGEL_ONE_API_KEY` | `J0v1kqJC` | `jEYMXpNW` (older key) |
| `REACT_APP_ADVICE_SHOW_LATEST_DAYS` | `15` | `7` |
| `REACT_APP_SDK_INTEGRATION` | `true` (SDK layer enabled) | Not set (SDK disabled) |
| SDK-related vars | Full block present (mint URL, broker flow flag, etc.) | Absent |
| Broker URL comment block | Full documentation inline | Absent |

### 4.5 Features present in Android, absent in iOS 2.6

| Feature | Status |
|---------|--------|
| Maestro end-to-end test suite (`.maestro/`) | Android only |
| Detox test suite (`e2e/`) | Android only |
| Broker-QA unit tests (`test/broker-qa/`) | Android only |
| `@alphaquark/mobile-sdk` full integration | Android (REACT_APP_SDK_INTEGRATION=true); iOS has provider wired in App.js but env flag absent |
| `react-native-notifications` package | Android only |
| App Links for broker callback | Android only (intent-filter + assetlinks.json backend) |
| Zerodha custom scheme deep link | Android only (intent-filter) |

### 4.6 Features present in iOS 2.6, absent in Android branch

| Feature | Status |
|---------|--------|
| Apple Sign-In (`@invertase/react-native-apple-authentication`) | Both branches have the code; iOS 2.6 has the native entitlement wired; Android branch has the import but `Platform.OS !== 'ios'` guard skips it |
| deferred TurboModule init in `index.js` | iOS 2.6 only |

---

## 5. Cross-cutting race conditions and async boundaries

This section is the primary test-design input for timing-sensitive test cases.

### 5.1 Auth + profile hydration race

**Scenario**: Firebase login succeeds; backend `/api/user/get-create-user` is slow or fails.

**Risk**: `TradeContext` is empty; `HomeScreen` renders with null broker list and null plan tier. User sees blank state or crashes if any component assumes non-null.

**Test**: mock the backend call to return 408 after Firebase success; verify app shows a recoverable error rather than a blank screen or crash.

---

### 5.2 Broker token expiry mid-session

**Scenario**: User has a connected broker. The short-lived access token (Upstox, Fyers) expires while the app is in the foreground during a rebalance flow.

**Risk**: The first order in the batch succeeds; subsequent orders hit "token expired" from the broker API. The error bubbles up as a "broker error" on some orders but not others — partial fill.

**Test**: mock the broker adapter to return a token-expired error on order N of a batch; verify the app surfaces per-order failure, not a full batch rollback, and does NOT re-attempt without a re-auth prompt.

---

### 5.3 TPIN/EDIS sell-auth expiry mid-rebalance

**Scenario**: User completes TPIN auth at 9:00 AM. Rebalance basket starts processing. Orders run slowly (rate limiting). IST day rolls over (3:30 PM + overnight) before the last sell order is placed on the next morning. OR — even within one session — the CDSL TPIN session has a 4-hour TTL.

**Risk**: Some sell orders succeed; later sell orders are rejected with a POA/EDIS error from the broker. The `is_authorized_for_sell` flag is still TRUE on the client because the day-check has not been re-run.

**Test**: set `sell_auth_set_at` to yesterday; verify that the TPIN prompt fires before a sell order, not after the order is already rejected.

---

### 5.4 Duplicate order from notification + manual tap

**Scenario**: A push notification deep-links the user into a `ReviewTradeModal` for recommendation R. Simultaneously, the user taps the same recommendation card in the `StockAdvices` list.

**Risk**: Two `ReviewTradeModal` instances open for the same reco; user confirms both; two orders placed.

**Test**: verify that opening `ReviewTradeModal` for a reco that is already open (or already submitted) either prevents the second open or deduplicates at the order placement layer.

---

### 5.5 Stale WebSocket price subscription after symbol set change

**Scenario**: User's holdings change (new purchase clears). `MarketDataContext` rebuilds the subscription token set. During the rebuild, the WebSocket continues to receive prices for the OLD token set.

**Risk**: Prices flicker between old and new subscription responses; portfolio P&L shows wrong values.

**Test**: trigger a holdings refresh while the WebSocket is active; verify that prices stabilize to the correct set within one tick (no lingering old-set prices).

---

### 5.6 Payment completed but app killed before backend confirmation

**Scenario**: Payment gateway completes. App is force-killed before polling `/api/payment/status` returns.

**Risk**: User relaunches app. Payment was successful at the gateway. If `PendingPaymentManager` does not re-run the status poll, the subscription is never activated on the client.

**Test**: simulate app kill after gateway success event but before status poll returns; relaunch app; verify `PendingPaymentManager` detects the pending record and re-polls until subscription is confirmed.

---

### 5.7 Broker connect race: concurrent credential write and token refresh cron

**Scenario**: User manually reconnects a broker (re-enters API credentials). Simultaneously, the Node.js token-refresh cron is running and reads the old token, refreshes it, and writes the new token back.

**Risk**: The cron's write (for the old key) overwrites the user's new credentials submitted via the connect flow.

**Test**: not directly testable from the mobile app, but the mobile app should surface "connection failed" gracefully if the backend responds with stale creds after a manual reconnect.

---

### 5.8 Model portfolio advisor field mismatch

**Scenario**: `modelPortfolioUser` record was inserted with `advisor` set to a raw advisor code (e.g. `"alphaquark"`) rather than normalized to `REACT_APP_HEADER_NAME` (e.g. `"prod"`). The rebalance diff query filters by `advisor === REACT_APP_HEADER_NAME` → returns empty diff → user sees "No trades to execute."

**Risk**: Silent zero-trade rebalance. No error displayed; user thinks rebalance is complete with nothing to do.

**Test**: verify that `advisor` normalization is applied at ALL subscribe and auto-subscribe callsites; verify that if the user somehow has a mis-normalized record, the diff API still returns their trades (via backend fix) rather than an empty set.

---

### 5.9 Rebalance holdings diff using stale cached broker holdings

**Scenario**: The rebalance diff endpoint (`/rebalance/get-rebalance-trades`) fetches broker holdings from the ccxt cache. The cache was last populated 30 minutes ago (rate limit from the previous fetch). The user has executed trades since then that change their current holdings.

**Risk**: The diff calculates incorrect buy/sell quantities based on stale holdings → user over-buys or over-sells.

**Test**: verify that the app triggers a fresh holdings fetch immediately before calling the rebalance diff endpoint, and that any cache staleness is surfaced as a warning (not silently used).

---

### 5.10 Android App Links verification failure

**Scenario**: The `assetlinks.json` at `https://app-links.alphaquark.in/.well-known/assetlinks.json` is missing or has an outdated SHA-256 signing fingerprint. Android cannot verify the App Link.

**Risk**: All `https://app-links.alphaquark.in/broker-callback` links open in a browser instead of the app. Broker OAuth fails because the secrets in the redirect URL are exposed to the browser and the app never intercepts the callback.

**Test**: run `adb shell pm get-app-links com.arpint.alphaquark` on a fresh install; verify `app-links.alphaquark.in: verified` before any broker OAuth test.

---

## 6. Critical data flows with file references

### 6.1 Trade execution (single stock)

```
StockAdvices.js (user taps reco)
    → ReviewTradeModal.js (confirms order)
    → ProcessTrades.js → POST /orders/process-trade (Node)
    → aq_backend_github/Routes/Broker/ProcessTrades.js
    → ccxt-india/trading_logic/buy_sell_all_brokers.py
    → Per-broker app (app_zerodha.py, app_angelone.py, etc.)
    → Broker API
    → Order status returned up the chain
    → TradeContext updated, result modal shown
```

### 6.2 Rebalance execution (model portfolio basket)

```
RebalanceAdvices.js (shows pending rebalance)
    → MPReviewTradeModal.js (user reviews diff)
    → ProcessTrades.js / OrderService.js (bulk loop)
    → POST /rebalance/process-trade (Node) per batch
    → ccxt-india/rebalancing/rebalancing.py
    → Per-broker order placement (with rate-limit throttle)
    → Per-order status collected
    → MPStatusModal.js (results with per-row mark-as-placed)
```

### 6.3 Broker connection (credential form path)

```
ModalManager.js → Phase3SdkBrokerModal.js (SDK) or per-broker modal (legacy)
    → User enters API key + secret
    → BrokerCredentialScreen.js or BrokerConnectUI component
    → POST /api/user/broker-connect (Node)
    → aq_backend_github/Routes/multiBrokerRoutes.js (stores encrypted creds)
    → ccxt-india login-url endpoint (validates key + returns auth URL if needed)
    → TradeContext.connected_brokers updated
```

### 6.4 Broker connection (WebView OAuth path)

```
ModalManager.js → BrokerAuthScreen.js (WebView)
    → GET /api/broker/login-url from Node
    → Redirects to broker's OAuth page in WebView
    → User logs in; broker redirects to REACT_APP_BROKER_CONNECT_REDIRECT_URL
         (or app-links.alphaquark.in/broker-callback on Android)
    → App intercepts redirect URL (onNavigationStateChange or App Links deep link)
    → Extracts auth code / token from URL params
    → POST /api/broker/exchange-token (Node → ccxt)
    → TradeContext.connected_brokers updated
```

---

## 7. Key env-var dependencies for test environments

| Variable | Purpose | Test impact |
|----------|---------|-------------|
| `REACT_APP_CCXT_SERVER_API_URL` | Python backend URL | Must point to a test ccxt instance; Android has the correct prod URL; iOS 2.6 has a typo |
| `REACT_APP_NODE_SERVER_API_URL` | Node backend URL | Must point to test backend |
| `REACT_APP_ANGEL_ONE_API_KEY` | Angel One API key | Must be a valid test-environment key |
| `REACT_APP_ADVICE_SHOW_LATEST_DAYS` | How far back to show recos | 15 (Android) vs 7 (iOS) — affects which recos appear in test |
| `REACT_APP_SDK_INTEGRATION` | SDK layer toggle | Must be `true` to test SDK broker connect flows |
| `REACT_APP_USE_SDK_BROKER_FLOW` | Phase 3 SDK broker modal | Must be `true` to test SDK modal routing |
| `REACT_APP_BROKER_CONNECT_REDIRECT_URL` | OAuth redirect URL | Must match broker dev-portal registration; do NOT change without updating all broker portals |

---

## 8. Test infrastructure (Android branch)

The Android branch has three test layers that iOS 2.6 does not:

### 8.1 Maestro (`.maestro/`)

YAML-based end-to-end UI tests. Covers:
- Auth flows: launch, email login, validation, forgot password, signup, logout
- Broker connection: list display, connect modal, status display
- Home: screen load, reco cards, tab switching, pull-to-refresh
- Model portfolio: list, strategy detail, rebalance review
- Navigation: bottom tabs, drawer, back navigation
- Orders: screen load, tab switching
- Payment: subscription screen, gateway flow
- Portfolio: screen load, holdings display, broker filter
- Settings: screen, legal pages
- Edge cases: no network, empty states, app backgrounding, rapid tab switching, screen rotation

Run with: `maestro test .maestro/<flow>.yaml`

### 8.2 Detox (`e2e/`)

Jest + Detox E2E tests for: auth, broker connection, edge cases, home, model portfolio, navigation, orders, portfolio. Run after native build with `detox test`.

### 8.3 Broker QA unit tests (`test/broker-qa/__tests__/`)

Per-broker unit tests (AliceBlue, Angel One, Axis, Dhan, DummyBroker, Fyers, Groww, HDFC, ICICI, Kotak, Motilal, Upstox, Zerodha). These test the broker-specific connect/trade logic in isolation.

---

## 9. Shared backend race conditions (not mobile-specific)

These affect the mobile app even though the root cause is in the backend:

| Scenario | Risk | Where to look |
|----------|------|--------------|
| Concurrent broker token refresh cron + manual connect | Cron overwrites fresh credentials | `CronJob/brokerTokenRefresh.js` in Node |
| Two rebalance publishes before execution | First batch silently lost | `rebalancing.py` in ccxt |
| Sell-auth auto-revoke + TPIN completion race | `is_authorized_for_sell` flipped by two paths simultaneously | `trading_logic/sell_auth_revoke.py` + `Routes/UpdateEdisStatus.js` |
| ModelPortfolio subscribe + plan-tier check race | User subscribes to a paid MP; plan-tier check runs before subscription write completes | `Routes/sdk/v1/connections.js` + `ModelPortfolioService.js` |
| Angel One SmartAPI per-customer key rejection | A single shared key is used for multiple customers; one customer's order rejection blocks others | `app_angelone.py` — each customer must have their own registered SmartAPI key |
| Upstox rate limiting (10 orders/sec) | Bulk rebalance triggers 429; some orders are dropped | `app_upstox.py` throttle / retry logic |

---

## 10. Document update contract

Every commit that touches a system described in this document should update the relevant subsection here if:
- A new platform-specific divergence is introduced (iOS vs Android)
- A new race condition is discovered (add to § 5)
- A new env var is added that affects test environments (update § 7)
- A backend behavior changes that the mobile app depends on (update § 6 or § 3)
- A new test layer is added (update § 8)

Cross-reference canonical domain docs:
- Broker connection: `docs/BROKER_CONNECTION.md`
- Sell-auth: `docs/SELL_AUTH_ARCHITECTURE.md`
- Model portfolio: `docs/MODEL_PORTFOLIO_ARCHITECTURE.md`
- Rebalancing: `docs/REBALANCING.md`
- Phase 3 SDK: `docs/PHASE3_ARCHITECTURE.md`, `docs/PHASE3_BROKER_AUDIT.md`, `docs/PHASE3_PROGRESS.md`
- Design system: `docs/DESIGN_SYSTEM_ARCHITECTURE.md`

---

## 11. Explicit test suites

Keep the suite structure small and stable:

| Suite | Scope | Priority |
|---|---|---|
| `Auth + Boot` | app launch, login, logout, config hydration, deep-link entry | P0 |
| `Broker Connect` | connect, reconnect, expiry, maintenance/transient states | P0 |
| `Bespoke Trade` | single/basket execute, sell-auth, duplicate-tap protection | P0 |
| `Model Portfolio` | subscribe, rebalance, execute, refresh status, repair/manual override | P0 |
| `Portfolio + Orders` | holdings, funds, order book, aggregation, broker switch | P1 |
| `Payments` | provider handoff, resume, completion, entitlement reconciliation | P0 |
| `Notifications + Lifecycle` | foreground/background/cold start, press navigation, app resume | P1 |
| `Content + Home` | news, knowledge hub, plans, home composition | P2 |

### Priority meaning

- **P0**: release-blocking, money/execution/auth impact
- **P1**: important correctness and lifecycle behavior
- **P2**: lower operational risk, but still worth covering

---

## 12. Platform matrix

| Area | Android | iOS |
|---|---|---|
| Auth + boot | Required | Required |
| Broker connect | Required | Required |
| Bespoke trade | Required | Required |
| Model portfolio | Required | Required |
| Payment resume from external/app-switch flow | Required | Required |
| Push notification display/press behavior | Strongly required | Strongly required |
| Background/foreground lifecycle stress | Strongly required | Strongly required |
| Build/config validation | Gradle / manifest / Google services | Pods / Info.plist / Xcode project |

Rule of thumb:

- test business-flow parity on both platforms
- test lifecycle and notification behavior separately on both platforms
- do not assume Android validation covers iOS callback/resume issues

---

## 13. Backend dependency matrix

| Flow | Node backend | ccxt-india | External provider |
|---|---|---|---|
| Login / user profile | Yes | No | Firebase |
| Broker connect | Yes | Yes | Broker OAuth / broker auth pages |
| Funds / holdings / order book | Minimal | Yes | Broker APIs |
| Bespoke execution | Sometimes | Yes | Broker APIs |
| Model portfolio metadata | Yes | No | No |
| Rebalance calc / execute / status | Some | Yes | Broker APIs |
| Payment completion | Yes | Sometimes | Payment provider |
| Notifications | Minimal | No | Firebase / Notifee |
| Live prices | No | Yes | WebSocket server |

Testing implication:

- first classify whether the failing authority is app-only, Node-owned, ccxt-owned, or provider-owned
- many apparent UI bugs are actually cross-boundary state-sync bugs

---

## 14. Known non-deterministic / racy scenarios to keep repeating

- app launch while auth is ready but config/user context is still loading
- reconnect flow where cached broker state and live probe disagree
- sell flow when DDPI/TPIN status changed outside the app
- WebSocket reconnect after backgrounding or network flap
- repeated tap on connect / trade / rebalance / pay
- broker execution success with delayed status/writeback refresh
- payment success with partial downstream completion
- notification press before navigation stack is fully ready
- deep-link/OAuth callback received on cold start and again after resume

---

## 15. Suggested automation ownership

Keep ownership by failure type, not by screen:

| Layer | Best fit |
|---|---|
| Pure helpers, classifiers, mapping logic | Jest unit tests |
| service wrappers and result-shape handling | Jest service/integration tests |
| broker API contract confidence | `test/broker-qa/` |
| full user flows on app UI | Detox / Maestro |
| lifecycle/manual broker edge cases | targeted manual QA |

Recommended split:

- **Jest** for normalization, status classification, sell-auth helpers, reconciliation logic, and service fallbacks
- **Detox/Maestro** for launch, auth, navigation, broker connect, trade/rebalance happy paths, and major lifecycle checks
- **Manual QA** for broker-specific OAuth pages, payment-provider edge cases, and production-only transient behavior

---

## 16. How to use this doc

1. Start here for suite design and failure-mode mapping.
2. Use `docs/BROKER_CONNECTION.md` for broker-specific auth/session detail.
3. Use `docs/SELL_AUTH_ARCHITECTURE.md` for DDPI / TPIN / EDIS semantics.
4. Use `docs/MODEL_PORTFOLIO_ARCHITECTURE.md` for rebalance and writeback detail.
5. Use `e2e/`, `.maestro/`, and `test/broker-qa/` as executable starting points.

---

## 17. Bottom line

This app should be tested as a **distributed trading workflow client**, not just a set of screens.

The most valuable coverage is in:

- state transitions
- retries and reconnects
- duplicate actions
- lifecycle interruptions
- backend/app divergence
- broker-specific failure handling
