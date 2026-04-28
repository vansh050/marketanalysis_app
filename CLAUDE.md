# CLAUDE.md — AlphaQuark B2B Mobile App

## Project Overview

This is the **AlphaQuark B2B Mobile App** — a React Native application enabling advisory clients to connect stock brokers, receive trade recommendations, subscribe to model portfolios, and execute rebalance trades. It is the mobile counterpart to the web app at `../prod-alphaquark-github`.

## Architecture Documentation — MANDATORY (ABSOLUTE BLOCKER)

> **🔴 BLOCKING REQUIREMENT — NO EXCEPTIONS 🔴**
>
> Every code change that affects runtime behavior MUST ship with:
>
> 1. **An update to the relevant architecture `.md` file's content sections** (not just a changelog row — actual content describing current system state).
> 2. **A new `docs/CHANGELOG.md` entry** dated today, tagged with a short descriptive label, listing every file touched and the "why" of the change.
> 3. **A backend doc / server-side doc update** if the change touches ccxt-india, aq_backend_github, or any tidi-hosted service — even if the backend change was uploaded via scp (i.e. outside this repo), the docs here must still call it out so the repo is self-describing.
>
> If a change slipped in without docs, the NEXT code change by anyone (including you) MUST pause and retrospectively document the prior undocumented change before proceeding. An undocumented delta is treated as tech debt that blocks the next delta.
>
> **This applies to**: trade flow, rebalancing, broker connection, model portfolio, recommendation logic, scripmaster lookup, market-order protection, symbol resolution, LTP fetching, env vars, AndroidManifest, broker SDKs, WebView flows, Metro config, Gradle config, broker-specific API routes on ccxt-india, broker-specific MongoDB writes on aq_backend_github, and the tidi_new Flutter app when cross-synced.
>
> **Rationale**: this codebase has had multiple silent regressions traced to under-documented fan-out changes (`.env` var repurposed across 8 brokers; scripmaster schema collision affecting INFY; `convertSymbolsToZerodha` broken since day one with no callers because it was silently returning `{}`). Every one of those would have been caught at review if the committer had been forced to write down what they changed and which surfaces it touched. The documentation requirement is not bureaucracy — it's the regression-prevention contract.
>
> **Cross-repo sync**: This app shares backend APIs with `../prod-alphaquark-github` (web frontend) and the Flutter app at `../tidi_new/tidistockmobileapp`. When a backend change is made that affects multiple clients, ALL affected repos' architecture docs must be updated in the same commit cycle. When porting a fix from one repo to another, update the receiving repo's docs to describe the ported behavior — the copy in the source repo isn't enough because the target repo's docs are what future contributors to that repo will read.

### Every session's checklist before ending work

Run this mental pass at the end of a coding session:

- [ ] Have I updated `docs/CHANGELOG.md` with an entry covering what I shipped today?
- [ ] Have I updated the relevant architecture `.md` file's content (BROKER_CONNECTION.md for broker work, MODEL_PORTFOLIO.md for MP work, REBALANCING.md for rebalance flows, APP_ARCHITECTURE.md for anything system-level)?
- [ ] If I touched ccxt-india / aq_backend_github / scripmaster DB on tidi, did I document that here too (file paths on tidi, what was patched, why)?
- [ ] If I added a new file (hook, utility), did I describe it in the architecture doc AND add a header docstring that references the doc?
- [ ] If I changed the tidi_new Flutter app in parallel, did I update its `docs/BROKER_TRADING_ARCHITECTURE.md` as well?

If ANY box is unchecked, the session's work is not done.

## Shared env vars across brokers — BLOCKING GUARDRAIL

> **NEVER modify a broker-related env var (`.env`) without running the audit below.** A single env-var change can silently break multiple broker OAuth flows and publisher-basket WebViews simultaneously. **This has happened — commit `f9f5d0f` (Groww App Links) repurposed `REACT_APP_BROKER_CONNECT_REDIRECT_URL` from `https://prod.alphaquark.in/stock-recommendation` → `https://app-links.alphaquark.in/broker-callback` and silently broke Zerodha's publisher basket on prod, and OAuth for 8 brokers × 10 tenants that had no backend override.** See `docs/BROKER_CONNECTION.md § Per-broker redirect URL reference`.

### Before touching ANY of these env vars

`REACT_APP_BROKER_CONNECT_REDIRECT_URL`, `REACT_APP_ZERODHA_API_KEY`, `REACT_APP_ANGEL_ONE_API_KEY`, `REACT_APP_HEADER_NAME`, `REACT_APP_ADVISOR_TAG`, `REACT_APP_DEEP_LINK_SCHEME`, any other `REACT_APP_*` var consumed by `brokerPublisher.js` / `brokerAuth.js` / `brokerSupport.js` / any `src/components/BrokerConnectionModal/*.js` / any `src/UIComponents/BrokerConnectionUI/*.js` — do ALL of these first:

1. **Grep every consumer** before editing:
   ```
   grep -rn "REACT_APP_<VAR_NAME>\|<nested.camelCase>" src --include='*.js' | grep -v __tests__ | grep -v __mocks__
   ```
   If you count more than one broker's flow in the output, the change is a **fan-out change** that affects all of them.
2. **Check `docs/BROKER_CONNECTION.md § Per-broker redirect URL reference`** — every consumer of the shared var is enumerated there with file:line, dev-portal registration requirement, and per-broker implications. If your change would break any row in that table, STOP.
3. **Check backend overrides** — many env vars are per-tenant overridable via `appadvisors.<camelCaseField>` in the backend DB (resolved in `src/context/ConfigContext.js`). A `.env` change is a no-op for tenants with a backend override but production-breaking for those without. Run the audit script in `docs/BROKER_CONNECTION.md § audit-script` to list which tenants currently have/don't have each override.
4. **Prefer a backend-per-tenant override to a `.env` change** — `.env` is the *last-resort fallback*, not the knob for per-tenant customization. If the change only applies to one tenant, update `appadvisors.<field>` in that tenant's backend doc instead of `.env`.
5. **Prefer a new purpose-specific var over repurposing a shared one** — if the new behavior is for ONE broker (e.g. Groww App Links), add a new var like `REACT_APP_GROWW_APP_LINKS_CALLBACK_URL` or hardcode in `AndroidManifest.xml` / `brokerRegistry.js`. Do not repurpose a var that other brokers read.
6. **Every broker dev-portal redirect-URL registration is independent** — if your change requires users to re-register a URL in the broker's dev portal (Zerodha, Upstox, Fyers, ICICI, HDFC, Motilal), that's a production migration, not a code change. Coordinate with support/ops before merging.

### If you must change a shared env var anyway

- Update `docs/BROKER_CONNECTION.md § Per-broker redirect URL reference` in the SAME commit, recording what the new value implies for every broker in the table.
- Update the in-code comment on the `.env` line explaining why and referencing the doc section.
- Add a `CHANGELOG.md` entry tagged "ENV-VAR CHANGE — CROSS-BROKER IMPACT" so it's searchable later.

All architecture docs are in the `docs/` folder:

| Document | Purpose |
|----------|---------|
| [APP_ARCHITECTURE.md](docs/APP_ARCHITECTURE.md) | System architecture, broker flows, trade execution, state management |
| [BROKER_CONNECTION.md](docs/BROKER_CONNECTION.md) | Per-broker auth details, WebView OAuth, credential flows |
| [REBALANCING.md](docs/REBALANCING.md) | Rebalancing flow, decryption, broker payload building |
| [MODEL_PORTFOLIO.md](docs/MODEL_PORTFOLIO.md) | Model portfolio subscription, basket execution, review trade flow |
| [CHANGELOG.md](docs/CHANGELOG.md) | All changes, fixes, and updates with dates |

### When to update these docs

1. **APP_ARCHITECTURE.md** — update when changing:
   - `src/screens/TradeContext.js` (core context, state management)
   - `src/components/AdviceScreenComponents/StockAdvices.js` (bespoke trade flow)
   - `src/components/AdviceScreenComponents/DummyBrokerHoldingConfirmation.js`
   - `src/screens/Home/HomeScreen.js`, `src/screens/Home/OrderScreen.js`
   - `src/utils/basketUtils.js`, `src/utils/portfolioEvents.js`
   - Any new screen, context, or global state change

2. **MODEL_PORTFOLIO.md** — update when changing:
   - `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`
   - `src/components/AdviceScreenComponents/RebalanceAdvices.js`
   - `src/components/ModelPortfolioComponents/` (any file)
   - `src/screens/PortfolioScreen/ModelPFCard.js`
   - `src/screens/Drawer/MPPerformanceScreen.js`

3. **REBALANCING.md** — update when changing:
   - `src/components/AdviceScreenComponents/RebalanceModal.js`
   - `src/components/AdviceScreenComponents/RebalanceAdviceContent.js`
   - `src/components/ModelPortfolioComponents/MPReviewTradeModal.js`
   - Rebalance calculation, execution, or status logic

4. **BROKER_CONNECTION.md** — update when changing:
   - `src/components/BrokerConnectionModal/` (any broker modal)
   - `src/components/BrokerSelectionModal.js`
   - `src/components/DdpiModal.js` (EDIS/TPIN)
   - `src/components/TokenExpireBrokerModal.js`

## Key Directories

```
src/
├── components/
│   ├── AdviceScreenComponents/   # Trade advices, rebalancing UI (21 files)
│   ├── BrokerConnectionModal/    # Per-broker auth modals (15 files)
│   ├── ModelPortfolioComponents/ # MP subscription, review trade (15 files)
│   ├── HomeScreenComponents/    # Home screen widgets, Knowledge Hub
│   ├── CustomHomeTabs/          # Custom tab components
│   ├── Navigation.js            # React Navigation setup (Stack/Tab/Drawer)
│   ├── AppProvider.js           # Global context providers wrapper
│   └── ReviewTradeModal.js      # Trade review modal
├── screens/
│   ├── Authentication/          # Login, Signup, Reset Password, RA Details (8 files)
│   ├── Home/                    # HomeScreen, OrderScreen, Watchlist, Advice (31 files)
│   ├── PortfolioScreen/         # Portfolio holdings view (6 files)
│   ├── Drawer/                  # Model Portfolio, MP Performance, Settings (19 files)
│   ├── AccountSettingScreen/    # Account settings
│   └── TradeContext.js          # CORE CONTEXT — 1456 lines, 40+ exports
├── context/
│   ├── ConfigContext.js         # App config from API + static variants
│   ├── MultiBrokerContext.js    # Multi-broker state management
│   ├── MarketDataContext.js     # Real-time prices via WebSocket
│   └── GstConfigContext.js      # GST configuration
├── utils/                       # 42 utility files
│   ├── rebalanceHelpers.js      # Rebalance logic, broker payload, decryption
│   ├── rebalanceDiffUtils.js    # Portfolio diff computation (buy/sell/hold)
│   ├── brokerAuth.js            # OAuth state, callback registration
│   ├── brokerSupport.js         # Per-broker feature matrix (GTT, OCO, etc.)
│   ├── brokerPublisher.js       # Kite/Fyers publisher SDK integration
│   ├── brokerSessionUtils.js    # Token expiry validation
│   ├── ProcessTrades.js         # Trade execution across all brokers
│   ├── SecurityTokenManager.js  # AQ encrypted key generation (JWT, 15s expiry)
│   ├── Config.js                # Static app variant definitions
│   ├── safeConfig.js            # Environment variable wrapper
│   ├── storageUtils.js          # AsyncStorage wrappers
│   ├── portfolioEvents.js       # EventEmitter for cross-component communication
│   ├── formatCurrency.js        # INR currency formatting
│   ├── symbolNormalizer.js      # Cross-broker symbol normalization
│   ├── orderStatusUtils.js      # Order status mapping
│   └── marketDataLTP.js         # Angel One LTP helpers
├── FunctionCall/                # API call functions
│   ├── fetchFunds.js            # Broker cash balance
│   ├── fetchBrokerAllHoldings.js    # Multi-broker aggregated holdings
│   ├── fetchBrokerSpecificHoldings.js # Single broker holdings
│   ├── PaymentHandle.js         # Razorpay/Cashfree/PayU
│   └── useWebSocketCurrentPrice.js  # Real-time price hook
├── services/
│   ├── BrokerOrderBookAPI.js    # Unified order book for all brokers
│   ├── ModelPortfolioService.js # MP backend operations (15+ functions)
│   ├── OrderService.js          # Order management
│   ├── ZerodhaOAuthService.js   # Zerodha OAuth
│   ├── ReconciliationService.js # Trade reconciliation
│   └── GstConfigService.js      # GST config
├── hooks/
│   ├── useMultiBrokerHoldings.js # Multi-broker data aggregation
│   └── useSymbolSearch.js        # Symbol search
├── GlobalUIModals/              # Global modal management (Zustand store)
├── UIComponents/                # Reusable UI components
└── assets/                      # Images, fonts, logos
```

## Core Contexts

| Context | File | Purpose |
|---------|------|---------|
| TradeContext | `screens/TradeContext.js` | Core trading state — 40+ exports, all trades/orders/holdings/funds |
| ConfigContext | `context/ConfigContext.js` | Branding & features from backend API |
| MultiBrokerContext | `context/MultiBrokerContext.js` | Multi-broker portfolio aggregation |
| MarketDataContext | `context/MarketDataContext.js` | Real-time prices via WebSocket |

## Server Endpoints

| Server | URL | Purpose |
|--------|-----|---------|
| API Server | `https://server.alphaquark.in/` | Business logic, user management |
| CCXT Server | `https://ccxtprod.alphaquark.in/` | Broker APIs, order execution |
| WebSocket | `https://ccxtprod.alphaquark.in/` | Real-time price feeds |

## Supported Brokers (14)

Zerodha, Angel One, Upstox, ICICI Direct, Kotak, Dhan, Fyers, IIFL Securities, AliceBlue, Motilal Oswal, Hdfc Securities, Groww, Axis Securities, DummyBroker (simulation)

## Build & Run

```bash
# Install dependencies
cd /Users/pratik/PycharmProjects/Alphab2bapp && npm install

# Start Metro bundler
npx react-native start

# Run on Android emulator (separate terminal)
cd android && ./gradlew app:installDebug -PreactNativeDevServerPort=8081

# Launch on device
adb shell monkey -p com.arpint.alphaquark -c android.intent.category.LAUNCHER 1
```

## Important Notes

- **Java version**: gradle.properties must point to the correct Java 17 path (check `/usr/local/Cellar/openjdk@17/` for actual version)
- **New Architecture**: `newArchEnabled=true` is required (react-native-reanimated dependency)
- **App variant**: Set via `APP_VARIANT` in `.env` — must have a matching entry in `src/utils/Config.js`
- **Shared backend**: Same Node.js (`aq_backend_github`) and Python (`ccxt-india`) as the web app
- **Broker WebViews**: OAuth brokers use in-app WebView for auth, not deep linking. Redirect URLs may differ between web and mobile.

## Relationship to Web App (prod-alphaquark-github)

The web app is at `../prod-alphaquark-github`. Both share:
- Same backend APIs (server.alphaquark.in, ccxtprod.alphaquark.in)
- Same `rebalanceHelpers.js` functions (buildBrokerPayloadFields, decryption)
- Same `brokerSupport.js` feature matrix
- Same `MultiBrokerContext` state shape

Key differences:
- Web uses `react-hot-toast`, mobile uses `react-native-toast-message`
- Web uses `window.location` for OAuth, mobile uses WebView with URL interception
- Web has `AppConfigContext`, mobile has `ConfigContext` (similar but different implementation)
- Some broker auth flows require WebView-specific handling on mobile
