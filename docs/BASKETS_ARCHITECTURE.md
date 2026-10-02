# Baskets Architecture

> **Last updated:** 2026-09-13 (server-owned EOD/reconnect recovery)
>
> **Branch:** feature/sdk-plus-config_forkv2
> **Covers:** Mobile app (Alphab2bapp), Web frontend (prod-alphaquark-github), Backend (aq_backend_github)

## 13 September 2026 recovery boundary

Basket and single/bespoke durable attempts are now checked by the backend's
read-only reconciler at EOD and when the customer later reconnects a broker.
Missing authentication keeps recovery queued. Neither the scheduler nor the app
automatically retries an uncertain quantity; customer execution stays behind the
existing review and guarded submit flow.

Positively identified non-model recovery does not block model-portfolio
Calculate/Repair on the same broker account. Unknown legacy scope remains
fail-closed. Basket net exposure also normalizes broker-reported units and manual
fills into lots before netting, preventing a unit/lot mismatch from displaying a
phantom open futures position. This does not change the customer's advised lots,
limit price or broker order.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Map](#2-component-map)
3. [MongoDB Schema — TradeReco with Baskets](#3-mongodb-schema--tradereco-with-baskets)
4. [Basket Lifecycle](#4-basket-lifecycle)
5. [Basket Data Ingestion & Display](#5-basket-data-ingestion--display)
6. [Basket Processing — Netting, Expiry, Conflict Logic](#6-basket-processing--netting-expiry-conflict-logic)
7. [Order Placement Flow](#7-order-placement-flow)
8. [GTT / SL / SLPT Order Types](#8-gtt--sl--slpt-order-types)
9. [Failure Handling](#9-failure-handling)
10. [Closure Baskets](#10-closure-baskets)
11. [Basket Status & DB Update](#11-basket-status--db-update)
12. [API Endpoint Reference](#12-api-endpoint-reference)
13. [Web vs Mobile Differences](#13-web-vs-mobile-differences)
14. [State Management](#14-state-management)
15. [Known Limitations](#15-known-limitations)

---

## 1. System Overview

A **Basket** is a multi-leg trade recommendation sent by an advisor to users. Unlike single-stock equity advices, a basket contains multiple instruments (equity, F&O, or mixed) that are intended to be executed together as a strategy. Common use cases: hedging strategies, pairs trades, spread positions, sector rotation baskets.

**Key properties:**
- A basket has a `basketId` (unique per recommendation event) and a `basketName`
- Each basket contains `basket_advice[]` — the individual legs
- Baskets also carry `to_trade_net[]` — pre-computed netting of BUY/SELL for the same symbol (used to handle partial closures)
- A basket may be **partial** (some legs executed, some not) or **full** (all legs executed)
- A basket may be a **closure basket** — it closes an existing position (sets `isClosure: true`)

**Data flow:**
```
Advisor publishes basket recommendation
  → Stored in traderecos collection (MongoDB, aq_backend_github)
  → Fetched by mobile/web via GET /api/user/trade-reco-for-user
  → TradeContext/StockRecommendation flattens + validates the legs
  → User reviews and executes via order placement API
  → Post-execution status written back to traderecos
```

---

## 2. Component Map

### Mobile (`src/`)

```
screens/TradeContext.js
  — Fetches all trade recommendations (includes basket_advice[])
  — Flattens baskets, handles netting/expiry/conflict filtering
  — Exports: netBasketTrades, isBasketExpired, isBasketEdited,
             isValidSymbolExpiry, filterConflictingOrders

components/AdviceScreenComponents/
├── StockAdvices.js             # Main advice screen — renders basket cards.
│                               # Zerodha branch (L578) routes basket execution
│                               # through Kite Publisher WebView (see § 7 Mobile
│                               # Zerodha Publisher fork). Non-Zerodha brokers
│                               # go through the REST path at L619 onward.
├── AddtoCartModal.js           # Cart-based execution. Same Zerodha-publisher
│                               # fork as StockAdvices (handleZerodhaRedirect
│                               # at L1059); REST otherwise.
└── OrderService.js             # Order management service

components/ModelPortfolioComponents/
└── MPReviewTradeModal.js       # MP rebalance review modal. Has its own Zerodha
                                # Publisher fork (handleZerodhaRedirect at L838)
                                # — same Kite SDK pattern as StockAdvices.

components/
└── KitePublisherModal.js       # WebView wrapper hosting the Kite Publisher
                                # form. Every Zerodha-publisher fork mounts
                                # this. baseUrl set per `getPublisherWebViewBaseUrl`
                                # so the Kite SDK's Referer check passes.

utils/
├── basketUtils.js              # Pure utility functions (no side effects)
│   ├── parseExpiryFromSymbol() # "NIFTY16DEC25" → Date
│   ├── isBasketExpired()       # Any leg past expiry?
│   └── netBasketTrades()       # Consolidate BUY/SELL pairs
├── brokerPublisher.js          # Kite Publisher helpers — `PUBLISHER_SUPPORTED_BROKERS`
│                               # (Zerodha only on mobile; Fyers retired
│                               # 2026-04-26 — see file header for context),
│                               # `convertSymbolsToZerodha`, `resolveZerodhaSymbol`,
│                               # `applyKiteMarketProtection`, `validateStockExchanges`,
│                               # `getPublisherWebViewBaseUrl`, `PUBLISHER_POLL_CONFIG`.
└── ProcessTrades.js            # Trade execution across all brokers (REST path)
```

### Web (`src/`)

```
Home/StockRecommendation/
├── StockRecommendation.js       # Main page — combines equity + basket recommendations
└── BasketCard/
    ├── BasketCard.js            # Individual basket card (expiry/cancel/closure status)
    └── BasketModal.js           # Order placement modal

utils/
├── basketUtils.js               # Same pure utility functions (shared code)
└── brokerPublisher.js           # Zerodha/Fyers publisher SDK (web only)

components/
└── BrokerPublisherButton.js     # Zerodha/Fyers broker publisher button
```

### Backend (`aq_backend_github`)

```
Routes/
├── tradeRecoRoutes.js (or equivalent)  # Trade recommendation CRUD
│   GET /api/user/trade-reco-for-user  # Returns all trade reco including baskets
└── (basket-specific routes identified in §12)

Models/
└── tradeReco.js                 # traderecos collection schema
```

---

## 3. MongoDB Schema — TradeReco with Baskets

Collection: `traderecos`

The same schema handles both single-stock equity trades and multi-leg baskets. A document is a basket if `basketId` is populated.

```javascript
{
  _id: ObjectId,
  user_email: String,
  advisor_name: String,
  date: Date,
  lastUpdated: Date,            // Used by isBasketEdited() — if diff > 60s, basket is "edited"

  // BASKET FIELDS
  basketId: String,             // Unique basket identifier (non-empty = basket)
  basketName: String,           // Display name: "Nifty Hedge Oct 2025"
  description: String,

  trade_place_status: "recommend" | "ignored" | "executed",

  basket_advice: [{             // Individual legs
    Symbol: String,             // "NIFTY25OCT25000CE" or "RELIANCE"
    Exchange: "NSE" | "BSE" | "NFO" | "BFO" | "MCX",
    Quantity: Number,
    Type: "BUY" | "SELL",
    Price: Number,              // Limit price (0 = market)
    trade_place_status: "recommend" | "ignored" | "executed" | "failed" | "rejected" | "manually_placed",
    tradeId: String,
    orderId: String,
    orderStatus: String,
    triggerPrice: Number,
    stopLoss: Number,
    profitTarget: Number,

    // GTT order configuration
    gttConfig: {
      enabled: Boolean,
      gttType: "SINGLE" | "OCO" | "MULTI_LEG",
      gttOrderId: String,
      gttStatus: String,
      entryLeg: {
        legType: String,
        triggerPrice: Number,
        limitPrice: Number,
        quantity: Number,
        status: String,
        brokerOrderId: String
      },
      stoplossLeg: { ... },     // Same shape as entryLeg
      targetLeg: { ... }
    },

    // Stop-Loss + Profit Target configuration
    slptConfig: {
      stopLoss: {
        enabled: Boolean,
        triggerPrice: Number,
        limitPrice: Number,
        status: String,
        orderId: String,
        executedPrice: Number,
        executedQty: Number
      },
      profitTarget: {
        enabled: Boolean,
        targetPrice: Number,
        status: String,
        orderId: String,
        executedPrice: Number,
        executedQty: Number
      },
      ocoEnabled: Boolean         // One-Cancels-Other mode
    },

    // Closure tracking
    closurestatus: "fullclose" | "partialclose" | "closed" | null,
    isClosure: Boolean            // Enriched by TradeContext from to_trade_net[]
  }],

  // Pre-computed netting (sent by advisor alongside basket_advice)
  to_trade_net: [{
    Symbol: String,
    toTradeQty: Number,           // Net signed qty (negative = net SELL)
    closure: Boolean
  }],

  isClosure: Boolean,             // True if this basket closes an existing position

  // SINGLE-TRADE FIELDS (not used for baskets)
  Symbol: String,
  Type: String,
  Exchange: String,
  Quantity: Number,
  Price: Number,
  trade_place_status: String,
  orderId: String,
  orderStatus: String,
  triggerPrice: Number,
  stopLoss: Number,
  profitTarget: Number,
  gttConfig: { ... },
  slptConfig: { ... },
  trailingStopLoss: {
    enabled: Boolean,
    trailValue: Number,
    trailType: "POINTS" | "PERCENTAGE"
  }
}
```

**Key status field meanings:**

| `trade_place_status` (basket-level) | Meaning |
|-------------------------------------|---------|
| `recommend` | Not yet acted on by user |
| `ignored` | User rejected this basket |
| `executed` | All legs placed (partial OK if some failed) |

| `trade_place_status` (per-leg) | Meaning |
|--------------------------------|---------|
| `recommend` | Pending placement |
| `executed` | Order successfully placed with broker |
| `failed` | Broker rejected |
| `rejected` | User skipped this leg |
| `manually_placed` | User placed manually, marked in UI |

---

## 4. Basket Lifecycle

```
CREATED
  Advisor publishes basket → stored in traderecos
  trade_place_status = "recommend"

DISPLAYED
  Mobile/Web fetches via GET /api/user/trade-reco-for-user
  TradeContext / StockRecommendation renders basket card

EDITED (optional)
  Advisor updates basket_advice[] → lastUpdated timestamp changes
  isBasketEdited() returns true (diff > 60s)
  → "Updated" badge shown on card

EXPIRED (auto)
  isBasketExpired() checks each leg's symbol for expiry date
  NFO/BFO options: parse "NIFTY16DEC25" format → check vs today
  → "Expired" badge shown; execution disabled

IGNORED
  User taps "Reject" / "Ignore"
  PUT /comms/reco/cancel/{basketId}  (sets all legs to "rejected")
  trade_place_status → "ignored" in local state

EXECUTED
  User reviews and places orders (see §7)
  All legs placed → trade_place_status → "executed"

CLOSURE
  isClosure: true on basket or any leg
  → Closure basket: closes an existing basket position
  → Displayed with different UI treatment
```

---

## 5. Basket Data Ingestion & Display

### Mobile — `TradeContext.getAllTrades()` (line ~443)

```javascript
GET /api/user/trade-reco-for-user?user_email={email}
Response: Array of traderecos documents (includes basket_advice[])

Post-fetch processing pipeline:
  1. filterConflictingOrders(basketAdvice)
     — Removes symbols where BOTH BUY and SELL legs have status "COMPLETE"
     — Prevents double-execution of fully-reconciled pairs

  2. netBasketTrades(trades)
     — Consolidates multiple BUY/SELL for same symbol
     — Uses to_trade_net[] as authoritative netting (overrides basket_advice qty)
     — Result: array with { Symbol, toTradeQty, isClosure, currentHolding }

  3. isBasketExpired(trades)
     — Iterates basket_advice[], calls isValidSymbolExpiry() on each
     — isValidSymbolExpiry: parses "AXISBANK30SEP251180CE" → extracts expiry date
     — Handles NFO/BFO; equity symbols always valid

  4. Basket-level deduplification
     — basketLegSymbols filter prevents same symbol appearing in both
       the basket card and a standalone equity advice card

Output shape per basket:
  {
    basketId, basketName, advisor_name,
    Symbol, Quantity, Type,       ← from basket_advice
    toTradeQty, isClosure,        ← from to_trade_net
    currentHolding,               ← from holdings context
    isEdited, trade_place_status,
    closurestatus
  }
```

### Web — `StockRecommendation.js`

Similar logic, but uses `basketUtils.js` standalone:
```javascript
import { parseExpiryFromSymbol, isBasketExpired, netBasketTrades } from '../../utils/basketUtils'
```

The web renders `BasketCard` components alongside equity `StockCard` components in a unified list. Filtering:
- `basketCancelled` flag hides rejected baskets
- `closurestatus` check shows closure badge
- `isBasketExpired()` disables "Accept" button

---

## 6. Basket Processing — Netting, Expiry, Conflict Logic

### 6a. Symbol Expiry Parsing (`isValidSymbolExpiry`)

```javascript
// Handles option symbol formats:
// "NIFTY25OCT25000CE"  → NIFTY, Oct 2025 expiry, 25000 CE
// "AXISBANK30SEP251180CE" → AXISBANK, Sep 2025 expiry, 1180 CE
// "RELIANCE"           → equity, always valid

Parsing steps:
  1. Regex match for month abbreviations (JAN-DEC)
  2. Extract 2-digit year, 2-digit day
  3. Construct Date: day-month-year
  4. Compare with today (currentDate from TradeContext)
  5. Return false if expiry < today (expired)

Edge cases:
  - Weekly expiry symbols (day present)
  - Monthly expiry symbols (no day in symbol, last Thursday rule)
  - BFO (BSE F&O): same parsing logic
  - MCX: handled separately (commodity expiry format differs)
```

### 6b. Trade Netting (`netBasketTrades`)

```javascript
// Purpose: when a basket has 2 BUY legs for RELIANCE and 1 SELL,
// consolidate to net position

Input:  basket_advice[]  +  to_trade_net[]
Output: netted trades[]

Logic:
  1. Build map from to_trade_net[]: { symbol → { toTradeQty, closure } }
  2. For each symbol in basket_advice:
     - If in to_trade_net: use toTradeQty (authoritative)
     - toTradeQty > 0 → BUY
     - toTradeQty < 0 → SELL (absolute value = qty)
     - toTradeQty = 0 → skip (net-zero, nothing to trade)
  3. Merge closure flag from to_trade_net into basket leg
```

### 6c. Conflict Filtering (`filterConflictingOrders`)

```javascript
// Prevents re-execution of already-reconciled positions
// Applied when a basket is re-displayed after partial execution

Rule:
  If a symbol has BOTH a BUY leg AND a SELL leg
    AND both have trade_place_status = "COMPLETE"
  → Remove both legs from the basket display (fully reconciled)
```

### 6d. Basket Edited Detection (`isBasketEdited`)

```javascript
// Detects when advisor modified basket after initial push

isBasketEdited(basket):
  diff = Math.abs(new Date(basket.lastUpdated) - new Date(basket.date))
  return diff > 60_000  // 60s threshold
  → Shows "Updated" badge on basket card
```

---

## 7. Order Placement Flow

### Mobile — Broker-dependent fork

Mobile execution has **two distinct paths** depending on the connected broker:
- **Zerodha** → Kite Publisher WebView (see "Mobile Zerodha Publisher fork" below)
- **Everything else** → REST path through `ProcessTrades.js` / ccxt-india `/{broker}/process-trades`

The fork happens in `StockAdvices.js:578` (and the parallel handler in `AddtoCartModal.js:1059`):

```js
if (broker === 'Zerodha') {
  // Kite Publisher path — handleZerodhaRedirect → WebView → record-orders
  return;
}
// fall through to REST path
```

### Mobile REST path (`ProcessTrades.js` + `StockAdvices.js`)

```
User taps "Accept Basket" on BasketCard
  ↓
STEP 1 — Broker session validation
  validateBrokerSession(broker, jwtToken)
  If expired → show TokenExpireBrokerModal, abort

STEP 2 — EDIS pre-check (SELL legs)
  Same logic as MP (§5c in MODEL_PORTFOLIO_ARCHITECTURE.md)
  Zerodha: ddpi_status check
  Angel One: ddpi_enabled check
  Others: optimistic (reject triggers TPIN modal)

STEP 3 — Order placement
  POST /api/process-trades/order-place   (OR ccxt-india /{broker}/process-trades)
  Payload:
    { user_email, user_broker, basketId, basketName,
      trades: [{ Symbol, Quantity, Type, Exchange, Price, orderType, variant }] }
  Response:
    { results: [{ symbol, orderStatus, orderId, executedQty, message }],
      orderErrors: [...] }

STEP 4 — DB update
  POST /api/model-portfolio-db-update  (records basket execution)
  OR direct update to traderecos via dedicated endpoint

STEP 5 — Emit refresh
  portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH)
```

### Mobile Zerodha Publisher fork (`StockAdvices.handleZerodhaRedirect`)

Used when the connected broker is Zerodha. The Kite Publisher SDK is the **only** way mobile can submit baskets to Kite — Kite blocks raw REST basket submissions without the SDK origin. Same overall structure used in:

- `StockAdvices.js:1206` — stock-advice basket fork
- `AddtoCartModal.js:1059` — cart-based fork
- `MPReviewTradeModal.js:838` — MP rebalance fork
- `RebalanceModal.js:690` — bespoke rebalance fork (this one also implements client-side polling fallback — see § 9)

**Kite basket quantity units — LOTS → SHARES (2026-08-13).** Kite expects
SHARES in the basket form payload. Mobile basket legs carry `quantity` in
LOTS plus a lot-size field (`Lots` on the leg, server-fetched `lotsize` via
`/zerodha/fno/symbol-lotsize`). Every Kite form builder MUST multiply:
`shares = quantity × lot-size`. Sites:

- `StockAdvices.handleZerodhaRedirect` + `AddtoCartModal` (cart fork):
  `kiteShares = quantity × (Lots || lots || 1)`.
- `ReviewZerodhaTradeModal` (slide-to-confirm builder): `finalQuantity =
  quantity × fetched lotsize`, falling back to `stock.Lots || stock.lots`
  when the server fetch misses.
- Before this fix `ReviewZerodhaTradeModal` set
  `finalQuantity = parseInt(lotsize)` — every derivative leg placed
  exactly ONE lot regardless of advised quantity. Additionally the
  review-modals' "quantity for all legs" multiplier collapsed mixed-size
  baskets (2-lot CE + 1-lot PE → (2,2), then (1,1) on the way back to 1) —
  the multiplier now scales off per-leg base lots captured on first load.
- The `readonly` gate (`> 100`) applies to SHARES, not lots.

```
STEP 1 — Pre-flight validation (synchronous)
  validateStockExchanges(stockDetails)       — reject if any exchange missing
                                                (Kite silently drops items)
  EDIS pre-check (Zerodha only):
    canSell = userDetails.is_authorized_for_sell
              || ddpi_status in ['physical', 'ddpi']
  Tag variant on stockDetails BEFORE storing to AsyncStorage
  (variant: "AMO" | "REGULAR" per § 4.5.2 APP_ARCHITECTURE.md;
   the AsyncStorage payload is what flows back into record-orders)

STEP 2 — Persist outgoing payload + open WebView
  Store stockDetails (variant-tagged) to AsyncStorage key 'stockDetailsZerodhaOrder'
  POST /api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf
    (MP path only — marks recos as placed-pending in DB)
  Build Kite basket items via resolveZerodhaSymbol + applyKiteMarketProtection
    — applyKiteMarketProtection: MARKET → LIMIT-IOC with 1% buffer +
      Kite tick rounding (required to avoid silent drops on GSM/T2T/BE)
  generateHtmlForm(basket, apiKey) — Kite Publisher submission form
  Mount KitePublisherModal (WebView) with baseUrl from
    getPublisherWebViewBaseUrl(configData)

STEP 3 — User completes in Kite (in WebView)
  Submits orders inside Kite's hosted form
  Kite redirects to status URL → WebView intercepts
  setZerodhaStatus('success'), setZerodhaRequestType('basket' | 'rebalance')

STEP 4 — Post-success ingestion (driven by useEffect on zerodhaStatus)
  POST /api/zerodha/publisher/record-orders
    Payload: { stockDetails: <from AsyncStorage>, publisherResults, broker, userEmail }
    Backend fetches Kite order book + matches against stockDetails
    Returns: per-leg orderStatus/orderId/message
  POST /api/model-portfolio-db-update  (MP path only)
  POST /zerodha/user-portfolio          (refresh holdings from Kite)
  PUT  /rebalance/update/subscriber-execution  (MP path: executed | partial | pending)
  POST /rebalance/record-publisher-results     (MP path: model_portfolio_user)
  POST /rebalance/add-user/status-check-queue  (server-side fallback enroll)

STEP 5 — Emit refresh
  portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH)
  portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED)   (MP path only)
  setOrderPlacementResponse + open RecommendationSuccessModal
  Cleanup AsyncStorage 'stockDetailsZerodhaOrder'
```

**WebView callback failure recovery:** the Kite WebView callback can fail to fire in cross-domain / app-backgrounded / 302-intercept-missed scenarios. Two recovery layers exist:

1. **Client-side polling** (RebalanceModal only as of 2026-05-12) — polls the broker order book every 5s for 90s, detects new orders by diffing baseline order IDs. See `RebalanceModal.js:148-217`.
2. **Server-side `status-check-queue`** (all four modals) — enrolled in STEP 4, picked up by a backend reconciler that polls the broker for the user's recent orders.

See § 9 "WebView callback missed" for details.

### Web (`BasketModal.js`)

```
STEP 1 — Margin estimate (web-only)
  POST /margin/basket-estimate
  Payload: { basketTrades: [{ symbol, Quantity, Type }], broker, ... }
  Response: { marginRequired, fundsAvailable, canExecute }
  Displayed to user before execution

STEP 2 — Live prices via WebSocket
  io(ccxtWs.baseUrl)
  POST /websocket/subscribe
  Receives: { stockSymbol, last_traded_price }
  Used for MARKET → LIMIT price conversion

STEP 3 — Cancel any conflicting LIMIT orders
  If broker has open LIMIT orders for the same symbol:
  POST /{broker}/cancel-order  (ccxt-india)

STEP 4 — Execute
  POST /api/process-trades/order-place
  (same as mobile)

STEP 5 — Broker Publisher path (Zerodha/Fyers, web-only)
  If broker supports publisher:
  Loads Kite Publisher SDK or FYERS API Connect
  Converts symbols if needed: GET /zerodha/convert-symbol
  User completes in broker popup
  Callback fires → records execution

STEP 6 — Refresh
  Emits PORTFOLIO_EVENTS.HOLDINGS_REFRESH
```

---

## 8. GTT / SL / SLPT Order Types

Baskets support advanced order types beyond simple MARKET/LIMIT.

### GTT (Good Till Triggered)

Supported on: Zerodha, Angel One, Kotak (broker-dependent)

```javascript
gttConfig: {
  enabled: true,
  gttType: "SINGLE",     // Entry only
           "OCO",        // Entry + stoploss (One Cancels Other)
           "MULTI_LEG",  // Full 3-leg (entry + SL + target)

  entryLeg: {
    legType: "entry",
    triggerPrice: 500.00,   // Price at which trigger fires
    limitPrice: 505.00,     // Limit price after trigger
    quantity: 10,
    status: "pending" | "triggered" | "complete",
    brokerOrderId: "..."
  },
  stoplossLeg: { ... },     // Fires if price drops to SL
  targetLeg: { ... }        // Fires if price reaches target
}
```

**Backend handling:** GTT orders are forwarded to broker via ccxt-india's `/{broker}/gtt/place` endpoint. ccxt polls GTT status and updates `gttConfig.*.status` in the traderecos document.

### SLPT (Stop-Loss + Profit Target)

Bracket-order style: a regular order with attached SL and PT orders.

```javascript
slptConfig: {
  stopLoss: {
    enabled: true,
    triggerPrice: 480.00,
    limitPrice: 475.00,     // SL-L order price
    status: "pending",
    orderId: null,
    executedPrice: null,
    executedQty: null
  },
  profitTarget: {
    enabled: true,
    targetPrice: 550.00,
    status: "pending",
    orderId: null
  },
  ocoEnabled: true           // If true: executing SL cancels PT and vice versa
}
```

### Trailing Stop-Loss (single-trade only)

```javascript
trailingStopLoss: {
  enabled: true,
  trailValue: 10.0,          // Trail amount
  trailType: "POINTS" | "PERCENTAGE"
}
```

---

## 9. Failure Handling

### Error Types

| Error | Detection | Response |
|-------|-----------|----------|
| Network timeout | `ERR_NETWORK` / `ECONNABORTED` | Reconnect toast |
| Expired token | HTTP 401/403 | Open re-auth modal, abort |
| All legs rejected | All `REJECTED/FAILED` | Failure modal with per-leg messages |
| EDIS required | All SELL rejected | Per-broker TPIN modal |
| Partial failure | Mixed SUCCESS/FAILED results | Show per-leg status, manual retry option |
| Symbol expired | `isBasketExpired() = true` | Disable "Accept", show "Expired" badge |
| Insufficient margin | `/margin/basket-estimate` returns `canExecute: false` | Show margin shortfall UI (web only) |
| LIMIT order conflict | Open LIMIT for same symbol | Auto-cancel before placing (web) |
| Missing exchange | `validateStockExchanges` returns invalid | Block submission, synthetic rejection per leg, error toast (Zerodha publisher path) |
| Kite SDK API key absent | `zerodhaApiKey` falsy at submit | Synthetic rejection, "reconnect Zerodha" copy (Zerodha publisher path) |
| WebView callback missed | No `zerodhaStatus='success'` fired within timeout | Two-layer recovery — see "WebView callback missed" below |
| `record-orders` HTTP failure | `axios.request` rejects after Kite callback | Synthetic 'Unknown' response: "Order sent via Kite. Please check your Kite app for actual status." Server-side `status-check-queue` still enrolled. |

### WebView callback missed (Zerodha publisher path)

Kite Publisher submits the basket form inside a WebView. The expected flow is:
1. User completes Kite's hosted form
2. Kite redirects to a status URL
3. WebView intercepts the redirect → app sets `zerodhaStatus='success'`
4. `checkZerodhaStatus()` runs the post-success ingestion chain

Step 3 can fail silently in three known scenarios:
- **Cross-domain intercept loss** — some Android WebView versions don't honor `shouldOverrideUrlLoading` for server-side 302s on URLs outside the configured `baseUrl` origin
- **App backgrounded mid-flow** — user switches to Kite app to complete authentication; OS may suspend the WebView before the redirect lands
- **AsyncStorage race** — the WebView callback fires before AsyncStorage has hydrated `zerodhaStockDetails`, causing `checkZerodhaStatus` to short-circuit and never re-run

**Recovery layer 1 — client-side polling** (RebalanceModal only as of 2026-05-12):

```
RebalanceModal.js:148-217
  POLL_INTERVAL_MS = 5000        // poll every 5s
  POLL_TIMEOUT_MS  = 90000       // give up after 90s

  startOrderPolling():
    baseline = fetchOrderBook(broker, creds)
    baselineOrderIdsRef = Set(baseline.map(o => o.orderId))
    setInterval(POLL_INTERVAL_MS):
      current = fetchOrderBook(broker, creds)
      newOrders = current.filter(o => !baseline.has(o.orderId))
      if (newOrders.length > 0):
        publisherProcessedRef = true  // prevents double-fire vs WebView callback
        setZerodhaStatus('success')
        return
    setTimeout(POLL_TIMEOUT_MS):
      if (!publisherProcessedRef):
        setZerodhaStatus('success')   // give up cleanly, let user see results
```

Three other publisher consumers (`StockAdvices`, `AddtoCartModal`, `MPReviewTradeModal`) do NOT implement client polling — they rely entirely on layer 2.

**Recovery layer 2 — server-side `status-check-queue`** (all four publisher consumers):

```
POST /rebalance/add-user/status-check-queue (ccxt-india)
Body: { userEmail, modelName, advisor, broker }

Backend behavior:
  Enrolls the user in a periodic reconciliation job
  Job polls broker's order book + recent fills
  Updates traderecos / model_portfolio_user records when matches found
  Eventual consistency — typical delay 1-5 minutes
```

This layer always runs. It is enrolled in STEP 4 of every publisher path regardless of whether STEP 4 succeeded — see e.g. `MPReviewTradeModal.js:1270` (enrolled even in the catch block of `record-orders`).

### Per-Leg Error Display

`RecommendationSuccessModal.js` (mobile) and `UpdateRebalanceModal.js` (web) both render per-leg status rows:
- GREEN: `SUCCESS` / `COMPLETE`
- RED: `REJECTED` / `FAILED` (with broker error message)
- ORANGE: `PENDING` (async IOC partial fill)

---

## 10. Closure Baskets

A closure basket is sent by the advisor to close an existing basket position. Examples:
- Closing a F&O position before expiry
- Exiting a pairs trade when the spread reverts

**Detection:**
```javascript
// Basket-level closure
basket.isClosure = true

// Leg-level closure (from to_trade_net[])
leg.closure = true

// Closure status
leg.closurestatus = "fullclose"   // Close entire position
                  | "partialclose" // Close part of position
                  | "closed"       // Already closed
```

**Processing in `netBasketTrades`:**
- Closure legs are type-inverted relative to the original position (original BUY → closure SELL)
- `to_trade_net[]` provides the net qty after accounting for already-executed closures
- If `toTradeQty = 0` for a symbol, nothing is traded (already fully closed)

**UI treatment:**
- Mobile: "Closure" badge on basket card
- Web: `closurestatus` drives different card styling
- Cannot ignore a closure basket (risk of unhedged position)

---

## 11. Basket Status & DB Update

### After Execution

```
POST /api/process-trades/order-place  (ccxt-india OR aq_backend via proxy)
Response: { results[] }

POST to update traderecos document:
  — For each leg in results:
    basket_advice[].trade_place_status = "executed" | "failed" | "rejected"
    basket_advice[].orderId = broker order ID
    basket_advice[].orderStatus = broker status
  — If all legs executed:
    basket.trade_place_status = "executed"
  — If all legs failed:
    basket.trade_place_status = "recommend"  (allow retry)
  — If partial:
    basket.trade_place_status = "partially_executed" (custom)
```

### Cancellation / Rejection

```
User taps "Ignore Basket"
  PUT /comms/reco/cancel/{basketId}
  → Sets all basket_advice[].trade_place_status = "rejected"
  → Sets basket.trade_place_status = "ignored"
```

### GTT Status Polling

ccxt-india background job polls GTT status from broker and updates:
```
model_portfolio_user or traderecos
  basket_advice[].gttConfig.entryLeg.status
  basket_advice[].gttConfig.stoplossLeg.status
  basket_advice[].gttConfig.targetLeg.status
```

---

## 12. API Endpoint Reference

### aq_backend_github (server.alphaquark.in)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user/trade-reco-for-user?user_email={email}` | All trade recommendations including baskets |
| PUT | `/comms/reco/cancel/{basketId}` | Reject/ignore a basket |
| GET | `/comms/reco/payload/advisor-name/basket/{advisorTag}/{page}/{limit}/fno` | Admin: all baskets for advisor |
| POST | `/api/process-trades/order-place` | Place basket orders |

### ccxt-india (ccxtprod.alphaquark.in)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/{broker}/process-trades` | Place trades via specific broker |
| POST | `/margin/basket-estimate` | Margin estimate for basket (web only) |
| POST | `/websocket/subscribe` | Subscribe to live prices for basket symbols |
| POST | `/{broker}/gtt/place` | Place GTT order |
| GET | `/{broker}/gtt/status/{gttOrderId}` | Check GTT status |
| POST | `/{broker}/cancel-order` | Cancel open order |
| GET | `/zerodha/convert-symbol` | Symbol format conversion (web only) |

### SDK Routes (aq_backend_github, /sdk/v1)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sdk/v1/orders/place` | Place basket trades via SDK |
| GET | `/sdk/v1/orders/book` | Get order book |
| POST | `/sdk/v1/orders/:orderId/status` | Single order status |
| POST | `/sdk/v1/orders/:orderId/cancel` | Cancel order |

---

## 13. Web vs Mobile Differences

| Feature | Mobile | Web |
|---------|--------|-----|
| Margin estimate | Not shown before execution | `POST /margin/basket-estimate` shows margin requirement |
| LIMIT order conflict check | Not implemented | Auto-cancels conflicting open LIMIT orders before placing |
| Broker publisher | **Zerodha Kite Publisher via WebView** — `KitePublisherModal` + `handleZerodhaRedirect` in StockAdvices/AddtoCartModal/MPReviewTradeModal/RebalanceModal. Fyers retired 2026-04-26 (Fyers REST-only on mobile per `brokerPublisher.js` header). | Zerodha Kite Publisher (script-loaded) + FYERS API Connect |
| Publisher polling fallback | RebalanceModal only (L148-217) — see § 7 Mobile Zerodha Publisher fork | Implemented in `BrokerPublisherButton` |
| Server-side status fallback | All four publisher consumers enroll in `/rebalance/add-user/status-check-queue` | Same |
| Symbol conversion | `POST /zerodha/convert-symbol` via `convertSymbolsToZerodha` (Angel One → Zerodha format) | `GET /zerodha/convert-symbol` |
| Live prices in modal | WebSocket via `useWebSocketCurrentPrice` hook | Direct Socket.IO in BasketModal |
| GTT order placement | Supported via ccxt; publisher path does NOT support GTT — `separateGttOrders` helper exists in `brokerPublisher.js` but is not wired into the four publisher forks (known gap, would silently drop GTT orders if placed via publisher) | Supported via ccxt |
| Market protection | `applyKiteMarketProtection` (MARKET → LIMIT-IOC + 1% buffer + Kite tick rounding) applied in all four publisher forks | `convertToBasketItem` applies same protection |
| Exchange validation | `validateStockExchanges` pre-flight in all four publisher forks (rejects basket if any exchange missing — prevents Kite silently dropping items) | Same helper |
| Variant (AMO/REGULAR) | Tagged on outgoing trades — **REST paths**: yes; **Publisher paths**: RebalanceModal yes (L958-963), StockAdvices/AddtoCartModal/MPReviewTradeModal **not yet** (tracked, see CHANGELOG 2026-05-12) | Web path drops variant in publisher today |
| SL/PT display | Per-leg in results modal | Per-leg in UpdateRebalanceModal |
| Basket edit badge | `isBasketEdited()` → "Updated" badge | Same |
| Expiry display | isBasketExpired → disabled card | Same |
| Closure badge | `isClosure` flag | `closurestatus` field |
| Order type selection | Market / Limit in modal | Market / Limit in modal |
| Retry after partial | Manual re-open basket modal | Manual re-open |

**Shared patterns:**
- Both use `basketUtils.js` (same logic: `parseExpiryFromSymbol`, `isBasketExpired`, `netBasketTrades`)
- Both use `to_trade_net[]` as authoritative netting source
- Both use `portfolioEvents.emit(HOLDINGS_REFRESH)` post-execution — see § 7 STEP 5 (RebalanceModal Zerodha publisher path emits at L969-977; MPReviewTradeModal Zerodha publisher path missing emit as of 2026-05-12; StockAdvices and AddtoCartModal don't emit structured events post-execution either — separate decision point)
- Both support GTT and SLPT config shapes

---

## 14. State Management

### Mobile — `TradeContext.js`

Basket-related state:

```javascript
// Raw trade recommendations (includes baskets)
allTrades                     // Full traderecos array

// Basket-specific processing outputs (computed in getAllTrades())
basketLegSymbols              // Set of symbols that are part of baskets
                              // (used to deduplicate standalone equity cards)

// Functions
netBasketTrades(trades)       // Consolidate multi-leg BUY/SELL
isBasketEdited(basket)        // Check lastUpdated vs date (>60s = edited)
isBasketExpired(trades)       // Check option expiry for any leg
isValidSymbolExpiry(sym, ex)  // Parse + validate individual symbol expiry
filterConflictingOrders(adv)  // Remove reconciled BUY/SELL pairs
```

### Web — Component Local State

`StockRecommendation.js` maintains:
- `baskets[]` — filtered basket recommendations
- `basketCancelled: Set` — locally-rejected basketIds (before server update resolves)
- Expiry check runs inline during render via `basketUtils.isBasketExpired()`

`BasketModal.js` maintains:
- `marginData` — from `/margin/basket-estimate`
- `prices` — WebSocket live prices per symbol
- `orderResults` — post-execution per-leg results

---

## 14.1 Lifecycle, entry gate and ordered Publisher convergence (2026-08-16)

`TradeContext` retains the parent `basketLifecycle`, intent and `entryGate`
metadata while flattening legs. `StockAdvices` groups those fields back onto
the basket card. The container polls the server authorization every five
seconds and re-checks on Accept, so quote changes automatically show **Advice
out of range** and disable entry. A cancelled unopened basket cannot be
accepted from a stale mobile screen. Confirmed entry exposure with a retryable
non-closure sibling renders as **Entry Basket / Partial Entry**. The card
shows executed progress and its Retry action sends only rejected, failed,
partial, or still recommended legs; completed/cancelled legs never enter the
order payload. An uncertain broker outcome remains **Reconciliation Pending**
and blocks retry. Confirmed exposure without an unfinished entry is
**Position Open**, or **Closure Pending** only when the advisor actually
requested a close or cancel. Only a never-exposed withdrawal renders
**Cancelled**.

`src/services/BasketEntryGateService.js` is the only mobile client for
`POST /orders/basket-entry/authorize`. `StockAdvices.executePlaceOrder` checks
again before REST or Publisher handoff, and ccxt re-checks at supported
execution boundaries. EXIT/closure legs pass purpose/closure evidence and
bypass the entry-price gate.

Zerodha remains Publisher-only. Both `StockAdvices` and
`ReviewZerodhaTradeModal` sort a basket by numeric priority and refuse more
than ten legs rather than splitting into a second WebView/navigation. This
preserves advised submission order, not fill order: Kite owns final acceptance
and execution, so a numeric priority cannot guarantee that a hedge fills
before a margin-dependent leg.

Admin global cancellation is distinct from customer Reject. The new backend
operation blocks entry for all recipients, verifies pending-order
cancellations against a fresh broker order book, and appends customer-specific
reverse EXIT legs where exposure exists. The existing mobile Reject remains
recipient-scoped.

## 15. Known Limitations

### Zerodha Publisher cancellation and submission invariant (2026-08-15)

Opening the Publisher is not proof of placement. Mobile must not write
`leaving_datetime` or change a basket leg when the WebView opens. The durable
AsyncStorage publisher-attempt record supports crash recovery; only the
post-callback/order-book `record-orders` flow may transition Mongo. An explicit
Kite cancel clears that attempt and immediately calls `getAllTrades()`, so the
unchanged `recommend` basket is rendered again. All placement entry points use
a synchronous ref latch around their async handler; React `loading` state is
presentation only and is not a concurrency control.


1. **No basket-specific order book:** After execution, the user can only see basket results in the success modal. There is no dedicated "basket order history" view that shows past basket executions. The broker order book shows individual legs, not grouped by basket.

2. **GTT UI (mobile):** GTT configuration is stored and sent but the mobile UI for configuring GTT parameters (trigger price, legs) is limited compared to web. Most GTT baskets are pre-configured by the advisor.

3. **Closure basket enforcement:** The mobile app shows a "closure" badge but does not block the user from ignoring a closure basket. If the user ignores a closure basket on an F&O position, they may hold an expired/worthless option.

4. **Partial re-execution:** A partially executed basket remains visible with executed-versus-total progress. Retry automatically builds the review and placement payload from unfinished legs only; terminal completed/cancelled legs are excluded. Ambiguous or still-placing broker outcomes remain blocked for reconciliation rather than being guessed safe to retry.
5. **Pending-order cancellation:** A basket leg in `placed`, `open`, `pending`,
   `transit`, trigger-pending, or Publisher-pending state is displayed with
   its broker order ID and a **Cancel order** action. Mobile calls the shared
   ccxt `POST /orders/mutate` boundary with basket, leg, and exact order
   identity. Broker acknowledgement alone does not unlock retry: the leg stays
   blocked until exact-ID read-back confirms terminal cancellation. Partial
   fills retain the confirmed fill and only their remaining quantity becomes
   retryable. A leg without an order ID remains blocked for reconciliation.
   `TradeContext` explicitly admits those in-flight statuses into the active
   recommendation collection; an execution attempt must never turn the whole
   basket into the empty-recommendations state.

The Node feed must resolve explicit basket cancellation directly from
`trade.basket_advice`; a 2026-08-28 regression referenced a nonexistent
`basketItems` local and failed the entire customer request. Production hotfix
`19d19a2` restored the route. This was a response failure only—stored
recommendations and broker execution evidence were unchanged.

5. **to_trade_net[] staleness:** `to_trade_net[]` is sent by the advisor at basket creation and not recomputed when the user's existing holdings change. If the user has traded some legs independently, `to_trade_net[]` may not reflect their actual net position. The mobile app uses it as-is.

6. **Margin estimate (mobile):** Web shows pre-trade margin requirement via `/margin/basket-estimate`. Mobile does not call this endpoint — users discover margin shortfall only when the broker rejects the order.

7. **MCX baskets:** `isValidSymbolExpiry` has custom handling for MCX commodity symbols. However, not all MCX expiry formats have been tested — commodity expiry convention differs from equity derivatives.

8. **No basket P&L:** Unlike Model Portfolio, baskets do not have a P&L view. There is no endpoint or UI that shows cumulative basket performance across multiple executed baskets.

9. **Canonical pending/cancel contract (2026-08-28):** Mobile now shares the
   backend vocabulary for requested/ordered/AM/AMO/pending-confirmation,
   partial-fill, manual-placement and reconciliation-pending aliases. Unknown
   nonempty states fail visible. Cancel is enabled only with broker, basket,
   trade and order identity; the broker stored on the leg overrides the current
   broker selection. Older installed builds receive the backend visibility
   projection but require an app/OTA update for this hardened control.
