# Model Portfolio Architecture

> **Last updated**: 2026-04-17

## Overview

Model portfolios allow advisors to create curated stock baskets that subscribers can invest in. The system handles subscription, trade execution, rebalancing, and performance tracking.

## Flow

### 1. Subscription Flow

```
User browses available model portfolios
    │  Screen: PlansScreen / ModelPortfolioScreen
    │
    ▼
User taps "Subscribe" on a portfolio
    │  Opens UserStrategySubscribeModal.js
    │
    ▼
Payment processing (if required)
    │  Razorpay / Cashfree / PayU
    │
    ▼
Subscription created on backend
    │  POST /api/model-portfolio/subscribe
    │
    ▼
Portfolio appears in user's subscriptions
```

### 2. Trade Execution Flow

```
Advisor publishes rebalance signal
    │  Backend calculates buy/sell trades per subscriber
    │
    ▼
User sees rebalance notification
    │  RebalanceAdvices.js shows pending trades
    │
    ▼
User opens review modal → MPReviewTradeModal.js
    │  Shows buy/sell trades with quantities and prices
    │
    ▼
User confirms execution
    │  ProcessTrades.js routes to broker-specific endpoints
    │
    ▼
Orders placed → Results displayed
    │  Success/failure per stock shown
    │
    ▼
Portfolio holdings updated
```

### 3. Rebalancing Flow

See [REBALANCING.md](REBALANCING.md) for detailed rebalancing architecture.

## Key Files

| File | Purpose |
|------|---------|
| `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` | Review and execute model portfolio trades |
| `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js` | Subscribe to a model portfolio |
| `src/services/ModelPortfolioService.js` | API calls for model portfolio operations |
| `src/screens/Drawer/ModelPortfolioScreen.js` | Model portfolio listing screen |
| `src/screens/Drawer/MPPerformanceScreen.js` | Portfolio performance tracking |
| `src/components/AdviceScreenComponents/RebalanceAdvices.js` | Rebalance trade cards |
| `src/components/AdviceScreenComponents/RebalanceModal.js` | Rebalance review modal |

## Trade Types

Model portfolio trades can be:
- **Buy**: New positions or adding to existing
- **Sell**: Reducing or exiting positions
- **Rebalance**: Adjusting weights to match target allocation

## Broker Integration

Trade execution goes through the same broker infrastructure as regular stock advices:
- `ProcessTrades.js` handles all broker-specific API routing
- `buildBrokerPayloadFields()` constructs broker-specific payloads
- `defaultDecrypt()` handles credential decryption

## Backend APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/model-portfolio/strategies` | List available model portfolios |
| `POST /api/model-portfolio/subscribe` | Subscribe to a portfolio |
| `POST /api/model-portfolio/rebalance/calculate` | Calculate rebalance trades |
| `POST /api/model-portfolio/execute` | Execute model portfolio trades |
| `GET /api/model-portfolio/performance` | Get portfolio performance data |

## Parity with Web App

Both mobile and web apps:
- Use the same backend APIs for model portfolio operations
- Share the same `buildBrokerPayloadFields()` logic
- Support the same set of brokers for trade execution

Differences:
- Mobile uses `MPReviewTradeModal.js`, web uses `ReviewBrokerRecordsModal.js`
- Mobile navigation is stack-based, web uses route-based navigation
- Mobile has `DummyBrokerHoldingConfirmation` for simulation mode

## Transient Service-Window Handling in MPReviewTradeModal (2026-04-17)

Before the existing `allOrdersFailed` early-exit in the primary backend-order path (`api/model-portfolio-place-order`), `MPReviewTradeModal.js` now calls `detectTransientOrderWindowError(response?.data)` from `rebalanceHelpers.js`. When every failed row is a documented transient broker code (e.g. Upstox `UDAPI100074` during the 00:00–05:30 IST maintenance window), the modal:

1. Shows a `Toast.show({ type: 'info', text1: 'Broker service window', text2: <message from detector> })`.
2. Calls `enrollStatusCheckQueue()` so the failed rows reconcile when the broker reopens.
3. Closes the review modal via `onCloseReviewTrade()` and clears loading.
4. Returns — bypassing the `openSucess()` all-failed UI.

The Fyers publisher path (second `allOrdersFailed` block in the same file) is intentionally **not wired** because the publisher SDK response shape differs and the status-recording chain (`rebalance/record-publisher-results`, `rebalance/update/subscriber-execution`) must run regardless of per-row outcome.

See [REBALANCING.md](REBALANCING.md#wire-up-points-for-detecttransientorderwindowerror) for the full helper-and-wiring contract.

## RebalanceCard Execution Status

**File:** `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`

The rebalance card shows different button states depending on the user's execution record:

| Condition | Button Label | Enabled | Color |
|-----------|-------------|---------|-------|
| No execution record (`!hasExecutionRecord`) | "No rebalance pending" | No | Default |
| `status === 'executed'` | "Rebalance Accepted" | No | Grey |
| `status === 'partial'` | "Retry Rebalance" | Yes | Orange |
| `status === 'pending'` | "Check Order Status" | Yes | Yellow |
| Repair mode | "View/action on updates" | Yes | Red |
| Normal pending | "Accept Rebalance" | Yes | Default gradient |

The `hasExecutionRecord` guard (added in commit `4c869c7`) prevents phantom buttons when no execution record exists for the selected broker. See [REBALANCING.md](REBALANCING.md#rebalancecard-execution-status-guard) for details.

## DummyBroker Execution with Retry

The `DummyBrokerHoldingConfirmation` component now retries the subscriber-execution status update once (2s delay) on failure, with a user-visible Toast error if the retry also fails. This prevents the status from being stuck at "pending" after a successful trade recording. See [REBALANCING.md](REBALANCING.md#dummybroker-status-update-retry) for the full flow.

## Plans Tab Visibility (2026-04-17)

**File:** `src/screens/Drawer/ModelPortfolioScreen.js`

The Plans bottom-tab screen renders a `TabView` with a "Bespoke Plan" tab and a "Model Portfolio" tab. Tab visibility is driven purely by the advisor's feature flags from `ConfigContext`, not by data presence:

```js
if (config?.bespokePlansEnabled !== false) routes.push({key: 'bespoke', ...});
if (config?.modelPortfolioEnabled !== false) routes.push({key: 'modelportfolio', ...});
```

This matches the web app (`prod-alphaquark-github` `Home.js`): both flags default to enabled when undefined. Each tab's scene renders its own empty state when the underlying list is empty, so users always see both tabs if both features are enabled — even when one list is empty. Previously the tab was hidden when its list had zero items, which collapsed the UI to a single full-width pill and hid the feature's existence from users.

## Holdings Data Source Discrepancy — Broker Switch (2026-04-24)

When a user switches to a new broker, the backend creates a fresh empty `model_portfolio_user` record for the new broker via `user_changed_broker()`. This creates a systematic mismatch between two data sources:

| Screen | Data source | Broker filter | Shows stale data? |
|--------|-------------|---------------|-------------------|
| Portfolio Holdings tab (`AfterSubscriptionScreen`) | CCXT `rebalance/user-portfolio/latest` + aq_backend `subscription-raw-amount` | CCXT: uses `user_doc.user_broker`; aq_backend: tries current broker, falls back to ANY | **Yes** — fallback can serve old-broker holdings |
| Rebalance Step 2 (`MPStatusModal`) | CCXT `rebalance/user-portfolio/latest` (no broker param) | Uses `user_doc.user_broker` | No — gets correct (empty) current-broker record |

**Stale data detection:** `AfterSubscriptionScreen` now sets `isStalebrokerData = true` when CCXT returns empty for the current broker but the subscription endpoint returns data from another broker. A yellow warning banner appears in the Portfolio Holdings tab.

**Race condition fix (2026-04-24):** `getSubscriptionData` now depends on `[strategyDetails, userDetails]`. Previously triggering on `[strategyDetails]` alone could fire with `userDetails = undefined`, sending `user_broker = ""` to aq_backend, which returned wrong-broker data.

## AfterSubscriptionScreen Data Flow (2026-04-24)

**File:** `src/screens/Home/AfterSubscriptionScreen.js`

This screen (reached via "Detail on portfolio" in `RebalanceCard`) fetches from two sources in parallel:

```
1. CCXT  GET rebalance/user-portfolio/latest/{email}/{model}
         → returns last user_net_pf_model entry for user_doc.user_broker
         → priority source for user_net_pf_model

2. aq_backend  GET api/model-portfolio-db-update/subscription-raw-amount
               ?email=&modelName=&user_broker=<current_broker>
               → returns subscription_amount_raw + fallback user_net_pf_model
               → falls back to ANY broker if current broker has no record
```

Merge rule: `user_net_pf_model = CCXT_data ?? subscription_data ?? []`

`getSubscriptionData` must wait for `userDetails` (and thus `user_broker`) before running — the `useEffect` now depends on both `strategyDetails` and `userDetails`.

## Basket Leg Deduplication (2026-04-07)

**File:** `src/screens/TradeContext.js` (inside `flattenResponse`)

When the backend returns both a basket parent (with `basket_advice[]`) AND a standalone recommendation for the same symbol, the app previously showed both a BasketCard and a duplicate StockCard. Fixed by pre-computing a `basketLegSymbols` Set from all basket parents and filtering out matching standalone trades:

```js
const basketLegSymbols = new Set();
rawTrades.forEach(item => {
  if (item?.basket_advice?.length > 0) {
    item.basket_advice.forEach(advice => {
      if (advice.Symbol) basketLegSymbols.add(advice.Symbol);
    });
  }
});
// In regular trade path: if (basketLegSymbols.has(item?.Symbol)) return [];
```

Ported from web commit `158eddb` (prod-alphaquark-github `StockRecommendation.js`).

## Exchange Validation at Order Entry (2026-04-21)

**Why:** a Kite/Fyers Publisher basket containing a symbol with missing or blank `exchange` is silently dropped by the broker — no order is created, no error surfaces, and the mobile status-poll later shows "not in order book" with no actionable reason. A BSE-only symbol (e.g. ADARSHPL) sent with `exchange: 'NSE'` is a typical trigger.

**Helper:** `src/utils/brokerPublisher.js → validateStockExchanges(stockDetails)` returns `{ valid, missing }` — `missing` is the list of trading symbols whose `exchange` is empty/whitespace.

**Gate applied at every order-placement entry point:**

| File | Function |
|------|----------|
| `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` | `handleZerodhaRedirect`, `handleFyersRedirect` |
| `src/components/ReviewZerodhaTradeModal.js` | `handleZerodhaRedirect` |
| `src/components/AdviceScreenComponents/StockAdvices.js` | `handleZerodhaRedirect` |
| `src/components/AdviceScreenComponents/RebalanceModal.js` | `handleZerodhaRedirect` |
| `src/components/AdviceScreenComponents/AddtoCartModal.js` | `handleZerodhaRedirect` |
| `src/screens/Drawer/IgnoreTradesScreen.js` | `handlefinal` |

If `valid === false`, the gate shows a Toast listing the offending symbols and aborts before any payload is built. The `|| 'NSE'` silent defaults in the downstream basket builders were removed — post-validation, `stock.exchange` is guaranteed populated.

**Upstream fix:** the backend `/api/zerodha/publisher/record-orders` and `/api/fyers/publisher/record-orders` endpoints now preserve `exchange` in the `orderResult` they return. Previously they omitted the field, which caused `user_net_pf_model.order_results[*].exchange` to be stored as blank — so subsequent Repair Trades flows re-entered the app with missing exchange and hit the same silent-drop bug.

## Rebalance Broker-Connect Intent TTL (2026-04-21)

**File:** `src/components/AdviceScreenComponents/RebalanceAdvices.js`

`RebalanceAdvices` had two coupled effects for the "user tapped rebalance card → prompted to connect broker → auto-continue to Step 2 after connect" flow:

1. **Setter** (line ~266): when `brokerModel && storeModalName`, sets `wasBrokerModalOpenForRebalance.current = true`.
2. **Auto-continue** (line ~272): when the broker modal closes with `brokerStatus === 'connected'` AND the intent ref is true AND `storeModalName` is set, fetches holdings and opens the rebalance flow.

**Bug:** `storeModalName` is never cleared. If the user dismissed the rebalance-initiated broker modal without connecting, then later connected a broker from the Settings → Broker screen (a totally unrelated entry point), `brokerStatus` flipping to `connected` would fire the auto-continue on the stale intent — opening a rebalance the user never asked for.

**Fix:** replaced the boolean `wasBrokerModalOpenForRebalance` with a timestamp ref `rebalanceBrokerModalOpenedAt`. The auto-continue only fires if the intent is less than `REBALANCE_BROKER_INTENT_TTL_MS` (2 min) old. Legitimate auth flows complete well inside this window; stale intent from dismissed modals expires automatically.
