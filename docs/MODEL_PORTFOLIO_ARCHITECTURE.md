# Model Portfolio Architecture

## 2026-10-06 — a resolved model never acknowledges a different rebalance

When the customer taps Accept, `RebalanceCard.handleRepairDiscovery` reads
`get-repair`. If a model in `resolvedModels` (from `normalizeRepairResponse`)
matches the current rebalance, the card sends
`PUT /rebalance/update/subscriber-execution {executionStatus:'executed'}` and
places nothing. That lookup matched by rebalance id **or model name**, so an
operator-resolved **previous** rebalance (same model name, different
`modelId`) acknowledged today's rebalance as executed. The server parks such a
browser claim as `pending` / `frontend_terminal_hint_awaiting_server_evidence`,
evidence that can never arrive, and the card stays on "awaiting confirmation"
with no Accept (markup uagaskar, DefinEdge, 2026-10-06: September `bfc6d856`
resolved October `ca653c31`).

**Rule:** `findResolvedModelForRecommendation` (`src/utils/rebalanceReconciliation.js`)
is the only matcher. Identity wins whenever both sides carry one: an item whose
`modelId` or `completionRecommendationId` differs from the card's `model_Id` is
never a match. The model name is a fallback only when an id is missing. This is
the same guard `verifiedRepair` already applies via `completionRecommendationId`.
Pinned by `src/__tests__/utils/rebalanceReconciliation.test.js`.

## 2026-10-01 — Cancel & Retry is driven by broker truth (3.9.168)

`RebalanceCard.handleCancelAndRetry` cancels each still-open order via
`POST order/cancel`, sending the tenant DB (`REACT_APP_HEADER_NAME`) as
`advisorDb`; the server also resolves it (ccxt `3b093e0f`).
- Any refused cancel stops: the reason shows inside the Order Status modal
  ("Nothing was retried") with a Refresh action.
- A successful cancel runs `handlePendingRefresh`, so the modal then offers
  Repair for only the cancelled quantities.

The app no longer writes `subscriber-execution: toExecute` or jumps to
Calculate (the reconciliation barrier refused that). `PendingOrdersModal`
counts still-open orders separately ("16 completed · 1 still open at Fyers ·
0 need action"). Duplicate rows ("0 completed · 117 need action") were a
server merge defect, fixed in ccxt `a7852af4`.

## 2026-09-29 — customer-authorized reduction from an outside-model SELL

An ordinary recommendation/cart SELL can overlap shares attributed to a model
portfolio. The app's non-model review modals now show a warn-only server
preview only for that overlap. The customer can trim the order to the free
quantity or keep the full SELL and choose which named model supplies the
shortfall; the quantities are pre-filled and no free-text entry is accepted.

The latter choice is not a rebalance. After fill evidence, the backend reduces
the chosen model's saved quantity exactly once through the canonical customer
book writer. Cash and target weights are unchanged, so a later model rebalance
may recommend buying the shares back. Preview and reservation reads fail open
and the screen never introduces a new placement block in warn mode.

Corporate-action attribution is also backend-owned: recommendation fills are
scaled for applicable bonuses/splits, and the model-impact notice is withheld
while a credit is pending. The app neither calculates ratios nor writes model
books itself.

## 2026-09-29 — unaffordable target allocation cannot complete

`TARGET_SHARES_UNAFFORDABLE` means the model budget could not purchase one
share at one or more target weights; it is not evidence that holdings match the
model. When such a calculation has no executable orders, mobile Step 3 shows
**Target Allocation Is Not Yet Reachable** with the server-provided allocation
breakdown. It does not show the green **Already Aligned** panel and does not
auto-publish `subscriberExecution.status = executed`.

The aligned acknowledgement remains available only for an authoritative empty
calculation with no allocation/funding/authorization/continuation blocker.

## 2026-09-29 — compact order-first review surface

The host review reserves flexible height for the order list, including long
sell/buy baskets. Informational funding panels follow the orders inside the
scroll region, and the detailed low-funds explanation is opt-in through
**View details**. The fixed footer contains the required action/status only.
Future design variants and the eventual SDK review widget must preserve this
order-first composition without changing frozen-plan or execution semantics.

## 2026-09-29 — execution-identity gate for pending cards

`subscriberExecutions[].status` is a summary projection, not proof that an
order was dispatched. Mobile therefore resolves status from the current
recommendation's attached Publisher attempt or model-scoped
`advice_executed` episode before calling `add-user/status-check-queue`.
`user_net_pf_model` is holdings state and is never eligible as an execution
attempt. Queue enrollment requires a `uniqueId`, `planId`, or `attemptId`.

When a pending summary has no execution identity, the card runs manual
`get-repair`/account recovery instead. Verified absence of an active attempt
returns the customer to fresh Calculate/review, which places no order.
Unknown, reconciling, or in-flight broker evidence remains blocked to prevent
duplicate execution.

## 2026-09-29 — priced Zerodha BUY continuation

The post-SELL BUY refit receives a positive server/broker price snapshot before
affordability is calculated. MARKET remains the customer-approved order type;
the snapshot is valuation/recovery metadata and the Kite builder still applies
its protected LIMIT at handoff. Durable attempt status preserves `price`,
`referencePrice`, `ltp`, and `rebalancePrice` for app-restart recovery.

The host consumes the continuation only after Kite opens. A zero-leg/refused
refit keeps the attempt and retry action, and its empty calculation is not
eligible for Already Aligned acknowledgement. One parent-owned result modal
handles `Continue with N Buy`, avoiding a callback-less native modal layered
above it.

## 2026-09-28 protected cash-reservation action

When another accepted/executing model owns required account cash, Calculate
returns `CAPITAL_CASH_ALREADY_RESERVED`, sanitized owner metadata,
`recompute:false`, and blocking `REVIEW_OTHER_PORTFOLIO`. The customer reviews
that model or adds funds; a no-change Calculate retry is not offered.

## 2026-09-28 — sell-first terminal recovery

When submitted SELLs are terminal but one was rejected or cancelled, the server
returns `repairStatus/recoveryPhase: sell_retry_required` and only the exact
failed SELL remainder. The app opens the normal immutable Repair review; it
never automatically places the retry and never repeats completed SELLs. BUYs
remain blocked until the SELL retry is terminal, after which a fresh Repair
read returns the safely refitted remaining BUY quantities.

`WAITING_FOR_SELLS` BUY rows have no broker order id. They remain unfinished
accepted-plan work but no longer masquerade as a broker order under
reconciliation. Status refresh also sends plan/execution identity when known;
an older identity-less request is resolved by the server only within the exact
broker document, preventing a Zerodha episode from blocking AliceBlue.

Available-funds continuation (2026-09-25): [calculation scope, preserved target and acceptance guards](AVAILABLE_FUNDS_CONTINUATION.md).

## 2026-09-22 — SDK sell-auth boundary for reviewed rebalances

The app owns Step 3 review while the RN SDK performs a fresh authenticated
sell-auth read before dispatching equity-delivery SELL legs. Authorization
continues to placement; an unavailable or negative verdict fails closed to the
app with no broker request and no SDK modal behind the app modal. An SDK error
is terminal for that attempt and cannot trigger legacy axios placement.

## 2026-09-13 Server-owned recovery and frozen-price boundary

The app continues to Calculate, show the exact review and submit only after the
customer accepts. The backend freezes symbol, side and quantity as the approval
ceiling. A final funds/current-price check may reduce an unaffordable BUY after
SELL execution, but it cannot increase a leg or replace the accepted basket.
Only a genuinely fresh Calculate can produce newly priced quantities.

Order identity, completion and Repair are not inferred from price movement.
They use exact broker order/tag and cumulative-fill evidence. If DAY order
history has rolled away, EOD or a later authenticated reconnect may use the
strict pre-dispatch-versus-current holdings delta; current holdings overlap
without that complete baseline is not proof.

EOD and reconnect recovery now also heal a stale current-recommendation
`toExecute`/`partial` status from canonical plan evidence. The app's existing
resume and broker-reconnect refresh receives the corrected result; it does not
write completion or retry an uncertain quantity itself. Identified single/
bespoke/basket recovery continues independently and no longer blocks a model
portfolio merely because it shares the broker account. Ambiguous legacy scope
remains fail-closed.

## 2026-09-08 Verified action routing

The selected model's verified action controls navigation, not its generic
incomplete summary. Broker reconnect is followed by re-verification; Repair
never silently becomes Calculate, and saved allocation keeps its plan identity.
See [direct action review](MODELPF_DIRECT_ACTION_ROUTING_2026-09-08.md).

## 2026-09-08 Per-batch Publisher authorization

RebalanceModal, MPReviewTradeModal and UserStrategySubscribeModal now use the
same per-batch dispatcher as Markup. The request preserves the full reviewed
`legs` and sends the current batch separately as `activation_legs`, with
`activation_id = attemptId:side:index`. Opening the broker requires successful
recording/enrollment plus `dispatchReserved=true` and the matching activation ID.

SELL and BUY batches each obtain permission. The existing server checks exact
SELL completion, plan identity and cash before allowing dependent BUYs. The app
does not infer BUY authority from a SELL callback. A rejected authorization can
be checked again under the same batch identity; duplicate taps are suppressed,
and an exception after authorization/opening does not permit another form submit.
Batch position advances only inside the authorized open callback. Resumed BUY
continuation retains the original full plan and attempt identity.

This ports Markup commit `3cbcf4d9a` without changing native dependencies,
financial attribution or direct-broker execution. Eight focused suites pass
35 checks, including actual request callbacks, refusal-to-open integration and
batch-position preservation during refused BUY continuation.
Signed OTA deployment evidence is recorded separately in `docs/OTA_RELEASE.md`.

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

## Portfolio-scoped Retry state machine (2026-09-05)

Calculation responses carry model name and ID and are ignored by other model
modals. Retry never treats an empty or unknown repair response as permission to
calculate: pending stays in verification, failed broker legs open Repair,
requiresFreshRebalance alone enters Calculate, and verified completion persists
executed. The entitlement request is bounded to 10 seconds and manual repair
discovery to 15 seconds; successful status refreshes continue in the background
after the customer-visible result is known.


## Detail facts and holdings authorization (2026-09-02)

The detail view treats empty strings and non-positive minimums as missing,
prefers selected Plan facts before sparse strategy projections, and shows the
authored risk profile before volatility fallback. Portfolio model holdings are
fetched only for models in TradeContext's completed canonical entitlement
snapshot; connecting a broker cannot grant access.

## Mobile placement boundary (2026-08-28)

Model portfolios stay on `/sdk/v1/orders/place-rebalance`, not the generic dispatcher. SDK plans are SELL-before-BUY, carry plan id/version/hash, and use a stable advice id forwarded to CCXT as `attempt_id`. Unknown responses pause for reconciliation and cannot fall back or resubmit.

## Post-sell buying power and Repair reconciliation (2026-08-26)

The mobile Zerodha publisher binds `publisher/refit-buys` to the frozen
`plan_id` plus `unique_id`. Live cash remains preferred; the app also accepts
`cashFallbackUsed:true`, which the backend derives only from previously verified
model cash and all expected confirmed SELL fills after credit factor and reserve.
Any other unreadable response holds BUYs. `get-repair` pending or HTTP 503
unknown/archive-only responses expose no legs. `TradeContext` shows Verifying,
makes at most one automatic retry, then exposes a user-controlled **Check
again** action. Only a live-verified response can expose the genuine residual
repair legs. The backend independently re-verifies plan ownership and the live
broker state at execution, so older clients cannot bypass this fail-closed
contract. Timers are cancelled on unmount and customer/broker identity changes.
An execution-time `409 RECHECK_UNAVAILABLE` quietly closes the order modal and
refreshes that inline state; it must not emit an error toast or open TPIN,
because the backend confirms that no order was submitted.

```mermaid
flowchart TD
    A[Portfolio screen loads] --> B[TradeContext calls get-repair]
    B --> C{Backend verification state}
    C -->|verified_live| D[Store verified failedTrades<br/>Repair becomes available]
    C -->|reconciliationPending| E[Store no legs<br/>show Verifying]
    C -->|HTTP 503 unknown/archive_only| E
    E --> F[One automatic retry only]
    F --> G{Verified?}
    G -->|Yes| D
    G -->|No| H[Show Check again]
    H --> B
    D --> I[Customer opens review modal and submits]
    I --> J{Backend execution-time recheck}
    J -->|Verified| K[Place verified residual legs]
    J -->|RECHECK_UNAVAILABLE| L[No order; HTTP 409 results=[]]
    L --> M[Close only review modal quietly<br/>refresh inline verification]
    M --> E
```

Closing the modal is deliberate: its displayed broker snapshot is no longer
verified, and leaving the Place Order control visible encourages repeat clicks.
The portfolio screen remains open. After verification succeeds, the customer
can reopen Repair from a fresh verified state. This is different from a normal
broker rejection after submission, where the result UI must remain available
because an order may exist at the broker.

Older released apps remain execution-safe without this UI: the backend returns
no lookup legs on unknown state and refuses execution before broker placement.
They may show their legacy generic error presentation until the next signed app
release; the quiet modal-close/Check again UX is additive client behavior.

> **Canonical doc.** Merged from the older `MODEL_PORTFOLIO.md` on 2026-05-11.
> **Last updated:** 2026-07-18
> **Branch:** feature/sdk-plus-config-ui
> **Covers:** Mobile app (Alphab2bapp), Web frontend (prod-alphaquark-github), Backend (aq_backend_github), and ccxt-india
> **Mirrors:** `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (~80 K, independent), `ccxt-india/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (pointer-grade). Update all three on any MP backend/schema change.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Map](#2-component-map)
3. [MongoDB Schemas](#3-mongodb-schemas)
4. [Subscribe / Unsubscribe Flow](#4-subscribe--unsubscribe-flow)
   - 4a Subscribe • 4b Unsubscribe • 4c MPInvestNowModal (payment + Digio) • 4d Plans tab visibility
5. [Rebalance Flow (Calculate → Execute)](#5-rebalance-flow-calculate--execute)
   - 5a MP Performance trigger • 5b Rebalance Advices trigger • 5c Order execution
   - 5d Pre-flight exchange-gate • 5e RebalanceCard status • 5f Broker-connect intent TTL
6. [Failure Handling & Repair](#6-failure-handling--repair)
   - 6a Error classification • 6b TPIN/EDIS modals • 6c Repair flow
   - 6d Transient service-window • 6e Cautionary + LOW_FUNDS banners • 6f DummyBroker retry
7. [Manual Override](#7-manual-override)
8. [DB Update Chain (Post-Execution)](#8-db-update-chain-post-execution)
9. [Refresh & Status Polling](#9-refresh--status-polling)
   - 9a Initial load • 9b Order book • 9c Post-rebalance refresh (⚠ MP-gap) • 9d LTP snapshot
   - 9e AfterSubscriptionScreen + stale-broker banner
10. [Broker Migration Flow](#10-broker-migration-flow)
    - 10a Holdings data-source discrepancy
11. [Performance & P&L](#11-performance--pl)
12. [SDK Integration (Phase C/D)](#12-sdk-integration-phase-cd)
13. [API Endpoint Reference](#13-api-endpoint-reference)
14. [Web vs Mobile Differences](#14-web-vs-mobile-differences)
    - 14a Differences table • 14b Truly shared • 14c Not shared even though claimed • 14d Cross-repo doc parity
15. [State Management](#15-state-management) (+ basket-leg dedup)
16. [Security & Encryption](#16-security--encryption)
17. [Known Limitations](#17-known-limitations) (🔴 blocking / 🟡 functional gaps / 🟢 accepted trade-offs)

---

## 1. System Overview

Model Portfolio (MP) is a strategy-subscription product where an advisor curates a basket of stocks (a "model portfolio"), users subscribe and pay, and then periodically execute rebalancing trades to align their actual holdings with the target allocation.

**Three tiers of data:**
- **Model tier**: advisor-owned target allocation, stored in `model_portfolio` collection via `aq_backend_github`
- **Subscription tier**: user's payment record and subscription status, stored in `subscriptions` collection
- **Execution tier**: user's actual executed trades per broker, stored in `model_portfolio_user` collection via ccxt-india

### Entitlement boundary (Home and subscribed portfolios)

`model_portfolio.subscribed_by` is retained as a relationship/history list; it
is **not** proof that a customer may view or execute a paid model portfolio.
`GET /api/model-portfolio/subscribed-strategies/:email` must join it to a
`Subscription` whose `status` is `active`, `is_active` is true,
`is_cancelled` is false, and `end_date` is in the future. Pending checkouts,
abandoned carts, cancelled records and expired records must therefore fall back
to the plans/subscription surface rather than appearing as rebalance cards on
Home.

Home consumes this as the model-portfolio entitlement source. Its broad legacy
`planList` flag may still gate bespoke recommendations, but it must not decide
whether a model portfolio is an active rebalance: an unrelated legacy plan
cannot unlock or hide the model-portfolio purchase catalogue.

Mobile exposes this result once through `TradeContext` as
`modelPortfolioStrategyfinal` plus `modelPortfolioEntitlementsLoaded`. Both
the browse-card action state and the embedded Portfolio summary status badges
must consume that snapshot. Holdings, the catalog's historical `subscription`
field, and `ClientList.subscriptions` are not alternative entitlement sources.
Until the server query resolves, the browse card says **“Checking status…”**;
it must not label a plan active or expired speculatively.

The Portfolio and Research tabs on `MPPerformanceScreen` are protected by the
same entitlement. Research reports are a subscriber benefit: before an active
subscription is confirmed, mobile must not expose report links or metadata and
instead explains the benefit with a route into the subscription flow.

On the mobile detail screen, historical performance is consent-gated in the
Performance section. The summary header does not promote CAGR as a headline
return: it links to the contextual performance view and identifies volatility
as a manager-selected risk profile, not realised performance.

The model-detail header must never show a stale rebalance date as the next
event. If `nextRebalanceDate` is missing or before the current day, mobile
shows **“Schedule to be announced”** until the manager publishes the next
rebalance.

Accepting the historical-performance consent from the header (or the inline
disclaimer) selects the Overview tab and scrolls directly to the Performance
section after the chart is revealed. Consent must never leave the customer at
their old scroll position with no indication of what changed.

For an active portfolio, the customer detail surface distinguishes **Holdings**
(stocks currently recorded for the customer), **Target mix** (the manager's
latest intended allocation), and **Strategy** (methodology and historical
performance). The date shown as an upcoming rebalance is never labelled as an
expiry date. Exit and investment actions use safe-area-aware minimum touch
targets so they remain fully reachable on short phones.

**Four server boundaries:**
| Server | Role | Auth |
|--------|------|------|
| `server.alphaquark.in` (aq_backend_github) | Business logic, subscriptions, MP metadata | JWT / session |
| `ccxtprod.alphaquark.in` (ccxt-india) | Broker order execution, rebalance calculation, status queue | `aq-encrypted-key` header |
| `ccxtprod.alphaquark.in` WebSocket | Live market prices | Socket.IO |
| Broker APIs | Actual order placement | Per-broker OAuth/API key |

---

## 2. Component Map

### Mobile App (`src/`)

```
components/ModelPortfolioComponents/
├── MPCard.js                     # Subscription list card (subscription status logic)
├── MPInvestNowModal.js           # Payment gateway modal (Razorpay/Cashfree/PayU/IAP/Play)
├── MPReviewTradeModal.js         # Trade execution modal (main rebalance executor)
├── UserStrategySubscribeModal.js # Subscribe + initial investment calculation
├── RecommendationSuccessModal.js # Post-execution results + manual override
├── HoldingsMigrationModal.js     # Broker migration UI
└── (shared with Rebalance lane):
    RebalanceAdvices.js           # Entry point for rebalance flow
    RebalanceModal.js             # Alternate execution modal (Zerodha publisher support)

screens/Drawer/
└── MPPerformanceScreen.js        # Performance charts + initiate rebalance

services/
└── ModelPortfolioService.js      # All MP API wrappers (248 lines)

screens/
└── TradeContext.js               # Core context — holds modelPortfolioStrategyfinal, basket state
```

### Web App (`src/`)

```
Home/ModelPortfolioSection/
├── ModalPFList.js                # List container (calls subscribed-strategies)
├── ModalPFCard.js                # Individual strategy card (calls strategy details + subscription-raw-amount)
├── RebalanceCard.js              # Rebalance calculation orchestration
├── UpdateRebalanceModal.js       # Trade execution modal
├── MPStatusModal.js              # Post-execution status display
├── DummyBrokerHoldingConfirmation.js  # Manual execution confirmation
└── HoldingsMigrationModal.js     # Broker migration

Home/Strategy/
├── useStrategyDetailsWithPortfolioData.js  # Strategy hook (all data fetching)
├── UserStrategySubscribeModal.js # Subscribe modal
└── TerminateStrategyModal.js     # Unsubscribe flow

services/
└── ModelPFServices.js            # API service layer
```

### Backend (`aq_backend_github`)

```
Routes/
├── modelPortfolio.js             # Mount: /api/model-portfolio
├── modalPortfolioOrderPlace.js   # Mount: /api/model-portfolio-db-update
├── sdk/v1/rebalance.js           # Mount: /sdk/v1/rebalance
├── sdk/v1/portfolios.js          # Mount: /sdk/v1/portfolios
└── sdk/v1/orders/index.js        # Mount: /sdk/v1/orders

Models/
├── modelPortfolioModel.js        # model_portfolio collection
├── modelPortfolioUser.js         # model_portfolio_user collection (strict:false)
├── ModelPortfolioLivePerformance.js  # performance_live_portfolio
└── ModelPortfolioEODPnl.js       # performance_eod_pnl
```

---

## 3. MongoDB Schemas

### 3a. `model_portfolio` Collection

Owned by advisors. Contains strategy definition, target allocation, rebalance history.

```javascript
{
  advisor: String,
  model_name: String,            // "Growth Leaders" — fuzzy-matched on read
  minInvestment: Number,
  maxNetWorth: Number,
  frequency: String,             // "Monthly", "Quarterly"
  nextRebalanceDate: Date,
  subscribed_by: [String],       // Array of user emails (addToSet / pull for atomicity)
  image: String,                 // S3 URL

  model: {
    modelName: String,
    rebalanceHistory: [{
      model_Id: String,          // Unique rebalance event identifier
      rebalanceDate: Date,
      rr_link_mpf: String,       // Research report PDF link
      totalInvestmentvalue: Number,
      adviceEntries: [{
        symbol: String,
        exchange: String,
        value: Number,           // Target weight (%)
        price: Number,
        date: Date,
        status: "pending" | "toExecute" | "executed" | "partial" | "failed",
        manually_placed_at: Date,   // Set when user manually overrides
        actual_quantity: Number,
        actual_price: Number
      }],
      subscriberExecutions: [{
        user_email: String,
        user_broker: String,
        status: "pending" | "toExecute" | "executed" | "partial" | "failed",
        executionDate: Date
      }]
    }]
  },

  graph_history: [{
    stock_list: [{ stock_name, allocated_percentage, price }],
    graph_url: String,
    created_at: Date
  }]
}
```

**Key write operations:**
- `$addToSet: { subscribed_by: email }` — subscribe (atomic, no dupes)
- `$pull: { subscribed_by: email }` — unsubscribe
- `findByIdAndUpdate` on `model.rebalanceHistory[].adviceEntries[].status` — after execution

### 3b. `model_portfolio_user` Collection

Per-user, per-model, **per-broker** execution records. One document = (user × model × broker).

An investment update must not assume this broker-scoped document was already
materialized by an earlier screen read. The ccxt `insert-user-doc` route now
idempotently prepares the exact `(email, model, broker)` book before applying a
v2 investment intent. Mobile disables the manual Update Investment action while
the portfolio/broker identity is loading. A missing target allocation renders
as unavailable data, never as the unrelated “Premium Access Required” default.

```javascript
{
  email: String,
  model_name: String,
  advisor: String,
  user_broker: String,           // "Zerodha", "Angel One", etc.

  // strict: false — allows ad-hoc fields
  advice_detail: [Mixed],        // Initial recommendations
  advice_executed: [Mixed],      // Full execution history
                                 // v3 entries (2026-05-11 onward, default for all advisors)
                                 // additionally carry:
                                 //   calculator_version: "v3"
                                 //   dividend_rollover_cash: Number  // prior-period divs folded into this rebal's cash
                                 //   dividend_events: [{ symbol, amount, ex_date, ... }]

  user_net_pf_model: [{          // Source of truth for current holdings
    execDate: Date,
    subscription_amount: Number,
    order_results: [{
      symbol: String,
      quantity: Number,
      averagePrice: Number,
      orderStatus: "complete" | "rejected" | "pending",
      exchange: String,
      user_broker: String
    }]
  }],

  user_net_pf_updated: [Mixed],  // Stale reconciliation data (rarely used)

  subscription_amount_raw: [{    // Investment amount history
    amount: Number,
    dateTime: Date
  }],

  ltp_snapshot: {                // Last-seen prices (saves bandwidth, avoids real-time fetch on every load)
    prices: { "RELIANCE": 2500.00, ... },
    timestamp: Date
  }
}
```

**Multi-broker note:** A user who switches brokers gets a NEW document for the new broker. Portfolio-summary queries select the "best" document (prefer connected broker, then latest execution date).

### 3c. `performance_live_portfolio` Collection

Advisor-maintained live portfolio (not per-user). Updated by ccxt-india on every rebalance.

```javascript
{
  _id: String,                   // modelName or advisor+modelName
  advisor: String,
  model_name: String,
  balance_cash: Number,
  securities: [{
    stock: String,
    exchange: String,
    weightage: Number,
    qty: Number,
    avg_entry_price: Number,
    ltp: Number,
    realized_pnl: Number,
    unrealized_pnl: Number,
    corporate_actions: { splits, dividends, symbol_changes }
  }]
}
```

### 3d. `performance_eod_pnl` Collection

End-of-day performance snapshots for charting.

```javascript
{
  date: Date,
  model_name: String,
  advisor: String,
  equity_portfolio_value: Number,
  net_portfolio_value: Number,
  nifty_50: Number,              // Benchmark
  equity_realized_pnl: Number,
  equity_unrealized_pnl: Number,
  cash_balance: Number
}
```

---

## 4. Subscribe / Unsubscribe Flow

### 4a. Subscribe

**Mobile entry point:** `MPCard.js` subscribe button → `MPInvestNowModal.js`
**Web entry point:** Strategy list → `UserStrategySubscribeModal.js`

```
STEP 1 — Payment
  MPInvestNowModal.js
  ├─ POST /comms/validate-coupon            (optional coupon check)
  ├─ Create payment order (Razorpay/Cashfree/PayU/Google Play/Apple IAP)
  ├─ Digio e-signature (if required)
  └─ POST /comms/validate-payment          (webhook verification)

STEP 2 — Strategy activation
  ├─ PUT /api/model-portfolio/subscribe-strategy/{strategyId}
  │   Body: { email, action: "subscribe" }
  │   MongoDB: $addToSet on model_portfolio.subscribed_by
  │
  └─ POST /rebalance/insert-user-doc       (ccxt-india)
      Body: { userEmail, model, advisor, model_id, userBroker, subscriptionAmountRaw[] }
      Creates model_portfolio_user document

STEP 3 — CRM upsert
  └─ POST /api/add-subscriptions/check-client  (record in CRM)

STEP 4 — Refresh
  └─ TradeContext.getModelPortfolioStrategyDetails()
      GET /api/model-portfolio/subscribed-strategies/{userEmail}
```

**Subscription status computation** (`MPCard.js:getSubscriptionStatus()`):
```
1. Check element.subscription.status
   - 'deleted' → 'none'
   - null expiry → 'active' (lifetime plan)
2. Fallback: match subscriptionData.subscriptions[] by normalized plan name
   - No match || status='deleted' → 'none'
   - daysLeft < 0               → 'expired'
   - 0 < daysLeft ≤ 7           → 'renew'
   - daysLeft > 7               → 'active'
```

### 4b. Unsubscribe

**Mobile:** `TerminateStrategyModal` (if it exists) or via Settings
**Web:** `TerminateStrategyModal.js` (`Routes/Strategy/TerminateStrategyModal.js`)

```
STEP 1
  PUT /api/model-portfolio/subscribe-strategy/{strategyId}
  Body: { email, action: "unsubscribe" }
  MongoDB: $pull from model_portfolio.subscribed_by

STEP 2 — Optional notifications
  POST /comms/whatsapp/send-template
  POST /comms/telegram/send-template
```

**Important:** Unsubscribing does NOT delete the `model_portfolio_user` document — the user's holdings history is preserved for P&L and audit purposes.

### 4c. MPInvestNowModal — payment + Digio orchestration (mobile only)

`MPInvestNowModal.js` (108 K, 3530 lines — largest MP file) owns the mobile subscribe pre-flight. Distinct sub-flows it orchestrates:

**Payment-platform switcher** (`MPInvestNowModal.js:161-188`)
```
adminpaymentPlatform ←  GET /api/adminControl/get-payment-platform
                    OR  config.paymentPlatform   (fallback: 'cashfree')
```
Routes to one of `react-native-razorpay`, `react-native-cashfree-pg-sdk`, `PayUOneTimePayment`, `react-native-iap` (Play Store / App Store). Switcher is tenant-overridable via `appadvisors.paymentPlatform` in the backend.

> **⚠️ THREE payment-platform sources exist per tenant — they MUST agree (incident 2026-06-12).**
> The live value the APP obeys is **`admin.paymentPlatform`** (the `is_primary` doc in the tenant DB's `admin` collection), served by `GET /api/adminControl/get-payment-platform` (`Routes/Admin/AdminControl/AdminControl.js:20`, default `'razorpay'` when unset). `appadvisors.paymentPlatform` is only the app's offline fallback, and the v3 `payment_gateway_configs.active_gateway` is what the **web** reads (`PaymentGatewayConfigService`). **Alphanomy incident:** `admin.paymentPlatform` was `'razorpay'` while only Cashfree was configured (`razorpay.key_id: null`) → app silently took the Razorpay branch → endless spinner on every payment, web fine (web read the v3 config). Evidence: server logs showed `POST /lead_user` then NO gateway-create call at all. Fix: set `admin.paymentPlatform: 'cashfree'` in the `alphanomy` DB (2026-06-12). **When debugging "payment spinner, no error": first compare `admin.paymentPlatform` vs `payment_gateway_configs.active_gateway` + `is_configured` in the tenant DB.** Backend hardening worth doing: make `get-payment-platform` derive from the v3 config when present, so the three sources can't drift.

**Cashfree environment + install-source handling** (`MPInvestNowModal.js` one-time seam L1348, recurring seam L1659; helpers in `src/utils/cashfreeEnv.js`)

Both Cashfree seams (one-time `doPayment`, recurring `doSubscriptionPayment`) resolve the SDK environment through `getCashfreeEnvironment()` — the single source of truth shared with `CoursePurchaseSheet` / `BuyWebinarTicketSheet`. It honours `REACT_APP_CASHFREE_ENV`, defaults to `SANDBOX` in Metro debug, else maps `REACT_APP_ENV`. **Do not inline `Config.REACT_APP_ENV === 'production' ? …` or hardcode `CFEnvironment.PRODUCTION` again** — both were removed 2026-06-11 because they ran the PRODUCTION anti-fraud path even in dev.

Cashfree's native AAR enforces a **Play-Store-only install-source check in PRODUCTION**: a sideloaded APK (installer = `com.google.android.packageinstaller`, i.e. `adb install` / manual APK tap) makes `doPayment` / `doSubscriptionPayment` throw synchronously. The seam catches now run `isInstallSourceError(err)` → `friendlyPaymentError(err)` and show an *"install from Play Store"* alert (the one-time seam also clears `paymentPollingMessage` and stops the 30s + 54×5s background poll, so the spinner no longer runs ~5 min on a build that can never open the sheet). **The DB payment config is unrelated** — verified 2026-06-11 that both `prod` and `alphanomy` have `paymentPlatform: 'cashfree'`, `active_gateway: 'cashfree'` (configured), and `features.recurring_enabled: true`; the gateway is fine, the block is purely the install source. Legitimate fixes: install via Play Store Internal Testing, or whitelist the installer at Cashfree dashboard → Settings → Whitelisted Install Sources.

**Cashfree failure diagnostics — remote payment log (2026-06-18)**

Release / Play-Store builds can't be inspected with `adb logcat`, and a failed
GPay/UPI attempt leaves **no backend trace** (order is minted fine, no terminal
webhook fires — the failure is reported only to the SDK `onError` on-device). To
make release-build failures diagnosable server-side, the one-time Cashfree seam
in `MPInvestNowModal.js` calls `logPayment(type, data, configData)` (POST
`api/log-payment` → `aq_backend_github/Logs/payments/<IST-date>.log` on tidi) at
every terminal: `CASHFREE_ONETIME_START` (with resolved `cashfreeEnv` +
platform), `CASHFREE_ONETIME_ERROR` (SDK `onError` code/type/message +
`isInstallSourceError`), `CASHFREE_ONETIME_SDK_ERROR` (synchronous `doPayment`
throw), `CASHFREE_ONETIME_POLL_FAILED`, and `CASHFREE_RECURRING_ERROR` on the
recurring seam. The `api/log-payment` route already runs in production — no
backend deploy needed for the logging. Operator read:
`ssh tidi 'grep CASHFREE servers/server1/aq_backend_github/Logs/payments/$(date +%F).log'`.
The `cashfreeEnv` field exists specifically to catch a SANDBOX-SDK-vs-PRODUCTION-order
mismatch (see install-source paragraph above + `cashfreeEnv.js`).

**`customer_details.customer_name` person-name sanitize (backend, fixed + deployed 2026-08-07).**
Cashfree rejects `customer_details.customer_name` that isn't a "person name"
(`customer_details.customer_name_invalid` — "should be a person name"). Any
parenthetical / company suffix trips it: the markup client `Sateesh Chelikani
(EquityBowl)` (Google signup name) hit this 8× on 2026-08-07 — every
`POST /api/cashfree/subscription/create/payment` returned HTTP 500
`{message: "Failed to create order"}` → no `subscription_session_id` → app stuck at
the payment step (Digio was already signed). Root cause: `aq_backend_github
Routes/CashFree/CashFree.js` forwarded the profile name verbatim to Cashfree.
Fix: `sanitizePersonName(rawName, userEmail)` helper (next to
`formatPhoneForCashfree`) strips `(...)` suffixes, company/legal tokens
(pvt/ltd/llp/co/trust/fund/group/services…), dangling `&`, and junk chars;
falls back to the email prefix, then `"Customer"`. Applied at **both** write
sites Cashfree validates: the recurring subscription-create
(`customer_name: sanitizePersonName(name, user_email)` — the sateesh path) and
the payment-links create (`/links` endpoint). The one-time `/orders` path only
sends `name` in `order_tags` (metadata, not validated) — no change needed
there. Debug signature: journal shows `Error creating order:
{ code: 'customer_details.customer_name_invalid', … }` + HTTP 500 to the app;
today's successful clients all had plain names (Kartikay, Mahesh, Shruti).
Any future path that sends a customer name to a gateway MUST route it through
the same sanitizer (same rule as the `customer_id` sanitize above).


**`order_tags.mobileNumber` comma bug (backend, fixed + deployed 2026-06-18).**
`aq_backend_github Routes/CashFree/CashFree.js` minted the Cashfree phone
metadata as `` `${countryCode},${mobileNumber}` `` → the malformed
`"+91,7276689226"` (seen in the live order create). Fixed to space-separated
`.trim()` at **all three** write sites (L479 one-time `order_tags`, L717
admin-token-purchase, L2269 recurring `subscription_tags`). `customer_phone`
(the field Cashfree validates, sanitized via `formatPhoneForCashfree`) was never
affected, and the tag is **not read back** anywhere — pure data-hygiene.
Deployed to `tidi:servers/server1/aq_backend_github`, `alphaquark.service`
restarted.

**International payment phones (mobile, fixed 2026-08-11).**
The payment APIs take phone data as two fields: `countryCode` (for example
`+971`) and the national `mobileNumber` (`585346724`). The backend combines
them into the E.164 `customer_phone` sent to the gateway. Do not send the full
E.164 value in `mobileNumber` while also sending its country code; that can
double-prefix the number. `src/utils/paymentPhone.js` is the canonical mobile
normalizer: it accepts national, E.164, and legacy E.164-without-`+` profile
shapes and returns `{countryCode, nationalNumber, e164}`. Both live MP payment
seams (`MPInvestNowModal` and `InvestFlowScreen`) send the separated parts to
Cashfree/PayU/Razorpay order APIs, use `e164` only for direct SDK prefills and
communication calls, and refuse checkout when a usable E.164 value cannot be
formed. `MPInvestNowModal` derives the calling code from the profile and can
recover an embedded calling code, rather than silently defaulting every user
to `+91`. The two phone-collection producers (`PhoneLoginScreen` and
`PhoneNumberScreen`) use the same helper, so newly written profiles already
have the split shape checkout expects.

Production evidence (ZamZam, 2026-08-11): the app sent a UAE profile phone as
country `+91` + mobile `971585…`; Cashfree rejected order creation with
`customer_details.customer_phone_invalid`. The website later sent country
`+971` + national mobile `585…`; Cashfree created the order and the payment was
verified paid. This was phone-shaping drift, not Cashfree merchant KYC or
Digio balance.

**Payment-log retention (backend cron, 2026-06-18).** `Logs/payments/<date>.log`
(written by `api/log-payment`) had no rotation; entries carry PII. New
`CronJob/CronPaymentLogCleanup.js` prunes files older than 90 days (daily 03:37 +
startup), registered in `CronJob/index.js`, deployed + live (pruned 22 stale
files on first run).

**Digio e-signature** (`@digiotech/react-native`, lines 88-93, 904-1099)
- `Digio` SDK gates the strategy activation behind a signed advisory PDF
- PDF buffer fetched from `${ccxtServer.baseUrl}misc/pdf/s3/digio/download` (L1054)
- Polled via `pollDigioStatus` until `DigioStatus.COMPLETED`
- `savePendingDigio` / `getPendingDigio` persist a pending state in AsyncStorage so the modal can recover from app kill mid-signing
- `digioSuccessModal` UI confirms completion before payment commit

**Backend-owned Digio enablement and payment gate (2026-07-27).**
`AppAdvisor.digioConfig.digioEnabled` is the only enablement source. Shared
checkout evaluates the runtime value with an explicit boolean check
(`=== true`); missing, stale, string, and malformed values are disabled. No
tenant name or `REACT_APP_DIGIO_ENABLED` build variable is consulted. Markup
is explicitly `true` in the backend; AlphaB2B is explicitly `false`.

`ConfigContext` fetches the nested value from `/api/app-advisor/get`, and
AsyncStorage persists the normalized boolean. Both
`MPInvestNowModal.handleDigioPayment()` and `InvestFlowScreen` recovery
metadata consume the same helper. The backend independently enforces
`digioEnabled === true && digioCheck === "beforePayment"` on CashFree, PayU,
and Razorpay order/mandate creation. An unsigned required request is refused
before gateway creation with `code: "DIGIO_REQUIRED"`.

> **Incident and superseded hotfix.** Upstream sync `31fe66b5` copied an
> AlphaB2B build-variable opt-in into Markup, whose builds omitted that
> variable, bypassing Digio for a new customer. Commit `35bb8f84` immediately
> changed Markup to a default-on fork-specific rule. This architecture replaces
> that tactical rule: the backend value is now authoritative and the payment
> gate prevents stale clients from bypassing it.

**Digio skip check — `isDigioAlreadyCompleted(planId)` (authoritative, matches web; 2026-06-18)**

At pay-time `handleDigioPayment()` MUST decide whether the signer already has a
valid signature and skip Digio. The correct source of truth is the backend
endpoint **`GET /api/digio/check-digio-status/{email}/{planId?}`** — `needsDigio
=== false` ⇒ skip. That handler (`aq_backend_github
Routes/Digio/SignatureCompletion.js:604`) encodes all three policies in priority
order: (1) `mitc_resign_every_payment` window, (2) `per_plan_digio` (signed
within `DIGIO_SIGNATURE_VALIDITY_DAYS` = 10d **or** active sub for the plan),
(3) default `user.digio_verification === true`. The planId is appended when
available so the per-plan "active subscription" rule is honoured.

> **🔴 Regression fixed 2026-06-18 (pratik@alphaquark.in).** The app previously
> gated only on the **locally-cached** `advisorSpecificUserDetails
> .digio_verification === true`, fetched ONCE on mount via `getUser`. That cache
> is `undefined` during the fetch race **and** blind to the per-plan / 10-day /
> MITC policies — so an already-signed user was re-prompted in the app even
> though **web skipped correctly** (web calls `check-digio-status` in
> `PricingPage.js handleOk → checkUserDigioVerification`). Because the user had
> already signed, Digio short-circuited after the first OTP → "signature done"
> with **no agreement view and no Aadhaar OTP**. Fix: `MPInvestNowModal.js`
> `isDigioAlreadyCompleted()` now calls the same endpoint; on API error it falls
> back to the cached flag so a transient outage can't force a re-sign.
> **Known follow-up:** the `afterPayment` branch in
> `handlePaymentSuccessWithTelegram()` still uses the cached flag (sync, ~6
> callsites) — same staleness class, lower blast radius; migrate when that
> function is made async.

**Pending-payment recovery** (L428-588)
```
checkPendingPaymentRecovery()
  ├─ Read AsyncStorage 'pending_mp_payment_*' keys
  ├─ Detect: app killed AFTER payment SDK callback but BEFORE backend validate-payment
  ├─ Re-invoke handlePendingPaymentCompletion → POST /comms/validate-payment
  └─ On success: complete the subscribe-strategy + insert-user-doc chain
```
Without this guard, a user who Force-Quits during the Razorpay/Cashfree callback can be billed without becoming subscribed.

**GST handling** — `withGst()`, `gstLabel()` from `src/utils/gstHelpers.js`. Adds 18% GST to displayed strategy price and embeds GST line items in payment payload (per `GstConfigContext.js`).

> ⚠️ **Bespoke card pricing must always start from the PRE-GST base.**
> `MPCardBespoke.js` `getPricingOptions()` builds each frequency option from
> `data.pricingWithoutGst.<freq>` (the base). The card then renders the base +
> a `+ GST` / `including GST` suffix driven by `gstConfigure` /
> `gstWithTextConfigure`. **Do NOT read `data.pricing.<freq>`** here — that
> field is GST-**inclusive**, so pairing it with the `+ GST` label
> double-counts GST. This was the 2026-07-03 bug where a ₹20000/yr plan showed
> `₹23600 + GST` (20000 × 1.18) — the **yearly** branch alone was reading
> `data.pricing.yearly` while monthly/quarterly/half-yearly read
> `pricingWithoutGst`. Fixed to `pricingWithoutGst.yearly` (fallback to
> `pricing.yearly` only for legacy plans without the without-GST field).

**Telegram collection** (L221-1271)
```
handlePaymentSuccessWithTelegram(telegramId)
  → validateTelegramId() regex check
  → POST /api/user/update-telegram-id with email + telegramId
  → triggers `comms/telegram/send-template` invite
```
Optional but gated when advisor has `requireTelegram` config flag.

**PAN verification** (L676)
- Fixes PAN at subscribe time when missing from user record
- Reuses the broader PAN verification flow under `Routes/users.js`; not MP-specific

**Design-system container/presentation split** (header comment L2-11)
- `MPInvestNowModal.js` is declared a **container** — all data fetching, payment SDK glue, Digio orchestration, recovery logic
- Presentation lives in `designs/<variant>/screens/MPInvestNowModal.js` per the `DesignProvider` registry
- Variants override layout, copy, theming; container is invariant

**Subscribe via Zerodha publisher (bypass path)** — `UserStrategySubscribeModal.js` (1766 lines) holds a parallel subscribe path that publishes via Zerodha's basket SDK directly:
- `useWebSocketCurrentPrice` for live LTP refresh (L33, L105)
- `generateToken` JWT mint for ccxt-india auth (L145, L417, L500)
- `POST /rebalance/record-publisher-results` callback ingestion (L640)
- `POST api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf` (L509)

This path **bypasses Digio + pending-payment recovery** — it is invoked when the user opts to send orders via Kite Publisher rather than the integrated SDK path. Listed as 🟢 §17.11 trade-off.

### 4d. Plans tab visibility (mobile)

`src/screens/Drawer/ModelPortfolioScreen.js` renders the Plans bottom-tab as a `TabView` with "Bespoke Plan" and "Model Portfolio" tabs. Tab visibility is purely feature-flag driven:

```js
// ModelPortfolioScreen.js:80-83
if (config?.bespokePlansEnabled !== false) routes.push({key: 'bespoke', ...});
if (config?.modelPortfolioEnabled !== false) routes.push({key: 'modelportfolio', ...});
```

Both flags default to enabled when undefined (matching web `Home.js`). Each tab renders its own empty state when the underlying list is empty — users always see both tabs as long as both features are enabled, even when one list is empty. (Earlier behavior hid the tab when its list had zero items, collapsing the UI to a single full-width pill and hiding the feature from users; that was reverted on 2026-04-17.)

**Bespoke tab title is per-tenant configurable (2026-07-06):** both `ModelPortfolioScreen.js` and `ProductCatalogScreen.js` (the catalog/explore variant of this tab view) render `config?.bespokePlanLabel || 'Bespoke Plan'` instead of a hardcoded literal. `bespokePlanLabel` is a plain field on the per-variant `whitelabel/appVariants.js` object — same mechanism as `themeColor`/`logo` — so it needs no backend or `ConfigContext.js` wiring; it flows through via `initialConfig`'s spread. Set today for the `zamzam_app` fork's `zamzamcapital` variant (`bespokePlanLabel: 'Stock Plans'`); every other tenant is unaffected and still shows `'Bespoke Plan'`.

---

## 5. Rebalance Flow (Calculate → Execute)

Rebalancing has three distinct sub-flows on mobile; all converge on the same ccxt-india endpoints.

### 5a. Triggered from MP Performance Screen

```
MPPerformanceScreen.js → calculateRebalance()
  POST /rebalance/calculate (ccxt-india)
  Timeout: 120s
  Payload:
    { userEmail, userBroker, modelName, advisor, model_id,
      userFund, flag:1, useExactAmount:true }
  Response:
    { buy: {symbol: qty}, sell: {symbol: qty},
      uniqueId: string,          ← critical: ties execution to this calculation
      user_net_pf_model: [...],
      availableFunds, requiredFunds }
  ↓
  Opens MPReviewTradeModal
```

### 5b. Triggered from Rebalance Advices Screen

```
RebalanceAdvices.js

  STEP 1: Fetch current holdings
  ─────────────────────────────
  GET /rebalance/user-portfolio/latest/{userEmail}/{modelName}
  Response: { adviceEntries, status: 'toExecute'|'executed', ... }
  ↓
  Show MPStatusModal (holdings review)

  STEP 2: User accepts → calculate
  ─────────────────────────────────
  RebalanceAdvices.handleAcceptRebalance()
  POST /rebalance/calculate  (same as 5a)
  ↓
  Opens RebalanceModal or MPReviewTradeModal
```

### 5c. Order Execution in MPReviewTradeModal

```
MPReviewTradeModal.placeOrder()

  PRE-FLIGHT CHECKS
  ─────────────────
  1. validateBrokerSession(broker, jwtToken)       — token freshness
  2. Check funds object (status 1/2 = expired)
  3. EDIS pre-check for SELL orders:
     Zerodha:   ddpi_status ∈ {'physical','ddpi'} OR is_authorized_for_sell
     Angel One: ddpi_enabled OR is_authorized_for_sell
     Dhan/Fyers: optimistic (rejection triggers TPIN modal)
     Portal:    is_authorized_for_sell

  SURVEILLANCE CHECK (Angel One only)
  ─────────────────────────────────────
  POST /angelone/equity/surveillance
  Payload: [{ symbol, exchange }]
  If any symbol flagged → show warning overlay

  EXECUTE
  ───────
  [REACT_APP_USE_SDK_EXECUTE_ADVICE = true]
    sdkClient.executeAdvice({
      kind: 'mpRebalance',
      clientAdviceId: '{timestamp}-{random}',
      brokerName, modelId, modelName, uniqueId, trades: []
    })
    → SDK POST /sdk/v1/orders/place-rebalance
    → Fallback to legacy /rebalance/process-trade on SDK failure

  [REACT_APP_USE_SDK_EXECUTE_ADVICE = false]
    POST /rebalance/process-trade (ccxt-india)
    Payload:
      { modelName, advisor, model_id, unique_id, user_broker, user_email,
        trades: [{ symbol, qty, exchange, orderType, variant }] }
    Timeout: 120s
    Response:
      { results: [{ orderStatus, tradingSymbol, orderPlacement, quantity,
                    transactionType, exchange, message_aq, sessionExpired? }] }
```

**Trade variant** (`REGULAR` vs `AFTER_HOURS`) is computed at submission time (`tradeVariant.js`) and attached to each trade. The response from process-trade does NOT echo variant back — `RecommendationSuccessModal` resolves it from `originalStockDetails` (passed as prop from the review modal).

### 5d. Pre-flight exchange-gate

A Kite/Fyers Publisher basket containing a symbol with missing or blank `exchange` is silently dropped by the broker — no order is created, no error surfaces, and the mobile status-poll later shows "not in order book" with no actionable reason. A BSE-only symbol (e.g. `ADARSHPL`) sent with `exchange: 'NSE'` triggers this.

**Helper:** `src/utils/brokerPublisher.js → validateStockExchanges(stockDetails)` returns `{ valid, missing }` — `missing` is the list of trading symbols whose `exchange` is empty/whitespace.

**Gate is applied at every order-placement entry point:**

| File | Function |
|------|----------|
| `src/components/ModelPortfolioComponents/MPReviewTradeModal.js:848,1310` | `handleZerodhaRedirect`, `handleFyersRedirect` |
| `src/components/ReviewZerodhaTradeModal.js` | `handleZerodhaRedirect` |
| `src/components/AdviceScreenComponents/StockAdvices.js` | `handleZerodhaRedirect` |
| `src/components/AdviceScreenComponents/RebalanceModal.js` | `handleZerodhaRedirect` |
| `src/components/AdviceScreenComponents/AddtoCartModal.js` | `handleZerodhaRedirect` |
| `src/screens/Drawer/IgnoreTradesScreen.js` | `handlefinal` |

If `valid === false`, the gate shows a Toast listing the offending symbols and aborts before any payload is built. The `|| 'NSE'` silent defaults in the downstream basket builders were removed — post-validation, `stock.exchange` is guaranteed populated.

**Upstream fix (backend side):** `/api/zerodha/publisher/record-orders` and `/api/fyers/publisher/record-orders` preserve `exchange` in the `orderResult` they return. Previously they omitted the field, causing `user_net_pf_model.order_results[*].exchange` to be stored blank — so subsequent Repair Trades flows re-entered the app with missing exchange and hit the same silent-drop bug.

### 5e. RebalanceCard execution status (button states)

**File:** `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`

The rebalance card shows different button states depending on the user's execution record:

| Condition | Button Label | Enabled | Color |
|-----------|-------------|---------|-------|
| No execution record (`!hasExecutionRecord`) | "No rebalance pending" | No | Default |
| `status === 'executed'` and no reconciled failed legs | "Rebalance Executed" | No | Grey |
| `status === 'partial'` | "Retry Rebalance" | Yes | Orange |
| `status === 'pending'` | "Check Order Status" | Yes | Yellow |
| Reconciled failed legs, including a stale `executed` summary | "Repair Portfolio" | Yes | Orange |
| SELL-first recovery (`sell_retry_required`) | "Review Failed SELL" | Yes | Variant-resolved action color; inverse badge text uses design tokens |
| Normal pending | "Accept Rebalance" | Yes | Default gradient |

The `hasExecutionRecord` guard prevents phantom buttons when no execution record exists for the selected broker (regression fixed in commit `4c869c7`).

The summary status is not allowed to override broker reconciliation. Publisher
preparation and asynchronous reconciliation can briefly disagree: the
subscriber row may say `executed` while `modelPortfolioRepairTrades` already
contains rejected/failed legs. `RebalanceCard` checks those failed legs before
deriving the terminal state; when any exist, it suppresses the grey executed
state and exposes Repair instead.

The SELL-first recovery badge and label do not introduce a second execution
path. `RebalanceCard` derives the copy from the server-owned recovery phase and
opens the same immutable Repair review. Its new badge style resolves through
`useTokens()` so the status remains variant-aware while the rest of this
legacy card awaits its Phase I container/presentation split.

### 5f. Rebalance broker-connect intent TTL

**File:** `src/components/AdviceScreenComponents/RebalanceAdvices.js`

`RebalanceAdvices` has two coupled effects for the "user tapped rebalance card → prompted to connect broker → auto-continue to Step 2 after connect" flow:

1. **Setter** (~L266): when `brokerModel && storeModalName`, captures the intent timestamp.
2. **Auto-continue** (~L272): when the broker modal closes with `brokerStatus === 'connected'` AND the intent is fresh AND `storeModalName` is set, fetches holdings and opens the rebalance flow.

**Previous bug:** `storeModalName` was never cleared. If the user dismissed the rebalance-initiated broker modal without connecting, then later connected a broker from Settings → Broker (an unrelated entry point), `brokerStatus` flipping to `connected` would fire the auto-continue on the stale intent — opening a rebalance the user never asked for.

**Fix:** replaced boolean `wasBrokerModalOpenForRebalance` with timestamp ref `rebalanceBrokerModalOpenedAt` (RebalanceAdvices.js:333-354). Auto-continue only fires if the intent is less than `REBALANCE_BROKER_INTENT_TTL_MS` (2 min) old. Legitimate auth flows complete well inside this window; stale intent from dismissed modals expires automatically.

---

## 6. Failure Handling & Repair

### 6a. Error Classification

| Error | Detection | Response |
|-------|-----------|----------|
| Network timeout | `error.code === 'ERR_NETWORK' \|\| 'ECONNABORTED'` | Reconnect toast, user retries |
| Auth expired (401/403) | HTTP status | Opens broker re-auth modal |
| All orders rejected | All results have `REJECTED/FAILED` status | Show failure modal |
| Transient service window | `detectTransientOrderWindowError()` — checks `error_code` in response | Soft toast: "markets closed / try later" |
| EDIS/TPIN required | Explicit backend `SELL_AUTH_REQUIRED` / `SELL_AUTH_REVOKED` for Fyers; legacy broker-specific rules elsewhere | Opens the applicable authorization modal |
| Per-order errors | `error.response.data.orderErrors[]` | Build per-row status from errors |
| Partial fills (IOC) | Mixed SUCCESS/PENDING in results | Show "X of Y filled", retry option |

### 6a.1 Account recovery and broker-health wording

Persisted broker credentials prove that an account is **linked**, not that a
current broker session or broker read is healthy. The home pill therefore uses
three distinct states:

- **Broker Linked**: credentials/connection metadata exist, but there is no
  recent live proof for the exact current email and broker.
- **Broker Live**: a numeric funds response was verified for that exact account
  and broker within the last five minutes.
- **Broker Linked · Check**: credentials exist and the recovery API reports an
  active blocker.

`TradeContext.repairReconciliation.accountRecovery` retains the backend-owned
state, reason, message and next action. The NBA ranking presents this blocker
before the generic Repair action. Rebalance alerts map the state to an
authentication, ownership, order-status, snapshot or stale-escalation title
and retain the backend message as the detail. The client must not promise that
another automatic retry can repair a deterministic credential, attribution or
stale-projection conflict.

### 6b. Per-Broker TPIN/EDIS Modals

| Broker | Modal | Trigger |
|--------|-------|---------|
| Zerodha | `DdpiModal` | All SELL rejected |
| Angel One | `AngleOneTpinModal` | All SELL rejected |
| Dhan | `DhanTpinModel` | Pre-flight OR rejection |
| Fyers | `FyersTpinModal` | Explicit `SELL_AUTH_REQUIRED` / `SELL_AUTH_REVOKED` only |
| Portal brokers (8+) | `OtherBrokerModel` | All SELL rejected |

**Empty portal-authorization retry contract (2026-09-29).** A customer checking
the manual authorization confirmation is not broker execution evidence. The
calculation opened by `OtherBrokerModel` is tagged with UI-only recovery and
portfolio-correlation metadata. If that calculation returns empty BUY and SELL
arrays, `RebalanceModal` shows **Sell Authorization Still Pending**, offers a
direct retry, and must not run the zero-trade `subscriber-execution: executed`
auto-acknowledgement. Untagged authoritative zero-trade calculations continue
to represent an already-aligned portfolio.

### 6c. Repair Flow

After a partial execution, the user can request repair trades:

```
POST /rebalance/get-repair (ccxt-india)
Payload: { modelName[], advisor, userEmail, userBroker }
Response: repair trades (delta between executed and target)
```

**⚠️ Current limitation:** The `get-repair` endpoint exists in `ModelPortfolioService.js` but the mobile UI for surfacing these repairs is not yet fully implemented. Web is at parity.

### 6d. Transient service-window handling

Before the existing `allOrdersFailed` early-exit in the primary backend-order path (`api/model-portfolio-place-order`), `MPReviewTradeModal.js:551` calls `detectTransientOrderWindowError(response?.data)` from `rebalanceHelpers.js`. When every failed row is a documented transient broker code (e.g. Upstox `UDAPI100074` during the 00:00–05:30 IST maintenance window), the modal:

1. Shows `Toast.show({ type: 'info', text1: 'Broker service window', text2: <message from detector> })`.
2. Calls `enrollStatusCheckQueue()` so the failed rows reconcile when the broker reopens.
3. Closes the review modal via `onCloseReviewTrade()` and clears loading.
4. Returns — bypassing the `openSucess()` all-failed UI.

The Fyers publisher path (second `allOrdersFailed` block in the same file) is intentionally **not wired** because the publisher SDK response shape differs and the status-recording chain (`rebalance/record-publisher-results`, `rebalance/update/subscriber-execution`) must run regardless of per-row outcome.

See [REBALANCING.md](REBALANCING.md#wire-up-points-for-detecttransientorderwindowerror) for the full helper-and-wiring contract.

### 6e. Post-Execution Trade Details Modal — cautionary + LOW_FUNDS banners (mobile)

**File:** `src/components/ModelPortfolioComponents/RecommendationSuccessModal.js`

Renders the post-execution status of a model-portfolio rebalance batch. Owns:

- **Status header summary** (`:469-…`) — drives one of: "All Orders Placed Successfully" / "Order Failed" / "Some orders are not placed" / "No Orders Placed". Header subtitle branches on which per-reason banners are showing, so it never claims orders are pending when every order is in a terminal state.
- **Cautionary Listing alert** (yellow, `:389-409`) — fires when any rejected order's `orderStatusMessage` contains both `cautionary` and `listing` (Angel One AB4036 / NSE GSM-equivalent). Lists the affected stocks as pill chips and instructs the user to place those manually via the broker app.
- **Insufficient Funds alert** (red, `:410-469`) — fires when any rejected order's message contains `insufficient fund`, `low fund`, `insufficient margin` (Zerodha/Kotak), or `insufficient balance` (Upstox/Fyers), OR the response carries `classification: 'LOW_FUNDS'` from the SDK route. Parses Angel One's "Available funds - Rs. {x} . You require Rs. {y}" pattern when present, summing Required across all rejected rows. Negative Available is rendered red to highlight margin-debit balances.
- **Per-order list** — each `renderOrderItem` row shows the broker's `message_aq` / `orderStatusMessage` as the failure reason chip.
- **Broker-confirmation refresh** — OPEN rows call the shared
  `OrderService.refreshSingleOrderStatus(broker, userEmail, orderId)` helper.
  The service owns the display-name → `/<slug>/v2/single-order-status` map,
  including `DefinEdge Securities → definedge`, and always sends
  `X-Advisor-Subdomain` so ccxt reads credentials from the correct tenant DB.
  A terminal response updates the modal row immediately; model-portfolio
  callers additionally keep the existing fire-and-forget
  `/rebalance/resolve-single-order` persistence step, now with the same tenant
  header. The modal must not keep a
  private broker map: that previously omitted DefinEdge, so its Refresh button
  returned silently while the broker and Mongo already showed COMPLETE.
- **Manual placement editor** (`:669-…`) — inline qty/price editor gated on `modalId`; on save calls `PUT /api/model-portfolio-db-update/manual-placement` (`:290`) and `POST /rebalance/resolve-single-order` (`:190`).

**Coexistence rule.** Cautionary and Insufficient Funds banners are independent — both can render at once when a single batch hits both reasons (production case 2026-04-29 Angel One: 7 cautionary + 19 LOW_FUNDS). The status header summary points the user at whichever banners are showing, rather than repeating their content.

**Cross-repo parity.** Mirrors `tidi_new lib/components/home/portfolio/ExecutionStatusPage.dart` (commit `c6c61de` for the LOW_FUNDS banner + status-header fix). The tidi_new version additionally has a Retry Failed Orders button with cautionary/LOW_FUNDS filtering — Alphab2bapp's modal is read-only, so that filter doesn't apply here.

**AMO badge.** Amber **AMO** pill renders next to the existing PLACED/PENDING/REJECTED status pill on every per-order row whose `variant === "AMO"`. Uses `theme.colors.status.warning` text on `status.warningBg` background — both already in `src/theme/colors.js`. `variant` is resolved with a three-tier fallback (response field → match against `originalStockDetails` prop → default `"REGULAR"`). Display-only — no change to the place-order payload.

### 6f. DummyBroker execution with retry

`DummyBrokerHoldingConfirmation` retries the `PUT /rebalance/update/subscriber-execution` status update **once (2 s delay) on failure**, then surfaces a user-visible Toast error if the retry also fails. This prevents the status from being stuck at "pending" after a successful manual trade recording.

### 6g. Repair-trades shortcut (active 2026-05-11)

After a partial rebalance, the user can re-attempt the specific orders that failed via the **repair shortcut** on `RebalanceCard`. Backend already excludes manually-placed rows (via § Task 1 / manual-placement endpoint) so the repair list shows only what's still unfilled.

**Auto-fetch (TradeContext.js):**
- `getModelPortfolioRepairTrades(portfolios)` runs after `getModelPortfolioStrategyDetails` succeeds. Posts to `/rebalance/get-repair` with the user's broker, models, advisor. Best-effort — failures don't block strategy load.
- DummyBroker is skipped (backend returns 404). 404 in general is silenced (not an error — just means nothing needs repair).
- Result stored in `modelPortfolioRepairTrades` context state; consumed by `RebalanceAdvices`, `HomeScreen`, `PortfolioScreen` via `useTrade()`.
- Pending/unknown broker verification stays fail-closed and may retry once, but
  it is deliberately silent on Home. A page-level warning for a background
  discovery check was distracting and repeatedly appeared above terminal
  “Rebalance Accepted” cards. Only verified non-empty repair legs create a
  customer-facing action.

**Card-level shortcut (RebalanceCard.handleAcceptClick:498):**
```js
if (repair && userExecution?.status !== 'toExecute' && !skipRepairRef.current) {
  // live broker preflight, then open frozen repair orders directly
  await handleCheckBroker(true);
} else {
  skipRepairRef.current = false;
  // skip obsolete customer preference; continue to holdings verification
  await handleCheckBroker(false);
}
```

Repair does not reopen the preference or holdings-edit screens: those inputs
already produced the frozen failed legs. Reconnect continuation preserves this
direct route. Fresh Accept also no longer offers “2% vs full”; calculator mode
is advisor-owned, while the existing holdings verification remains available
for a fresh calculation.

`skipRepairRef.current` is set to `true` from the parent when the user explicitly clicks Accept on a fresh (non-repair) rebalance. The TradeContext also exposes `markSkipRepairForModelId(modelId)` / `shouldSkipRepairForModelId(modelId)` for cross-card scoping, mirroring the web `skipRepairRef` pattern.

**Delta-pre-populate (RebalanceAdvices.handleAcceptRebalance:770-787):**
```js
} else if ((matchingFailedTrades ? "repair" : null) && userExecution?.status !== "toExecute") {
  const { failedTrades } = matchingFailedTrades;
  const updatedStockTypeAndSymbol = failedTrades?.map(trade => ({
    Symbol: trade.advSymbol,
    Type: trade.transactionType,
    Exchange: trade.advExchange,
    Quantity: trade.advQTY,
  }));
  setStockTypeAndSymbol(updatedStockTypeAndSymbol);
  setOpenRebalanceModal(true);
  // — bypasses fresh /rebalance/calculate
}
```

**Failed-trade payload from ccxt:** each `failedTrades[i]` carries `advSymbol`, `advQTY` (unfilled portion only), `advExchange`, `transactionType`, `originalQty`, `filledQty`, `isPartialFill`, and — added 2026-05-11 — `orderStatusMessage` + `classification` for client-side cautionary-row marking via `isCautionaryListingMessage` / `isInsufficientFundsMessage` (`src/utils/rebalanceHelpers.js`).

**No TTL:** when the advisor publishes a new rebalance, the new event lands in `rebalanceHistory[]` and `getModelPortfolioRepairTrades` returns no failed trades for the old event (because the new rebalance's `model_Id` is different and the old execution is no longer the "latest advice" the backend reads from). The shortcut naturally fades; no time-based hide needed.

**Cross-repo parity:** mirrors web `prod-alphaquark-github/src/Home/LivePortfolioSection/Home.js:364-393` (auto-fetch), `Home/ModelPortfolioSection/ModalPFList.js:236` (card flagging), and `Home/ModelPortfolioSection/RebalanceCard.js:143,672-727` (delta pre-populate + skipRepairRef).

**LTP refresh on repair-mode open (active 2026-05-11):**
- `useWebSocketCurrentPrice(wsSymbols)` and the `angelone/market-data` REST fallback inside `RebalanceModal.js:339-394` both fire when the modal opens, regardless of how `dataArray` was built. Repair-mode rows get the same live-price treatment as fresh-calculate rows. `getLTPForSymbol(item.symbol)` is the single read-site used by both display and submit.

**Cautionary / LOW_FUNDS chip + Mark-as-Placed CTA on repair rows (active 2026-05-11):**
- `RebalanceModal.ListItem` renders a chip when `isRepairMode === true` AND either:
  - `isCautionaryListingMessage(item)` → yellow "Cautionary listing — place manually"
  - `isInsufficientFundsMessage(item)` → red "Insufficient funds last time"
  - `item.isPartialFill === true` → amber "Partial fill last time (X/Y)"
- **Only the cautionary chip is tappable (since 2026-10-07).** The funds, partial-fill, funding-pending and T1 chips are informational: Repair re-places those legs itself, so recording them by hand as well would book a fill that Repair then buys again (same rule as the Trade Details modal, 2026-09-23).
- Tap on the cautionary chip → an **inline editor in the row** (no nested Modal) asks for the shares actually filled (pre-filled with the leg qty, capped at it) and the average fill price (pre-filled with LTP when one has arrived, otherwise empty and required). Confirm → `PUT /api/model-portfolio-db-update/manual-placement` with those values. The server books them as the holding's cost basis and rejects a missing or non-positive price; until 2026-10-07 this path sent `item.qty` at the live LTP, or `actualPrice: null` before any LTP arrived, which 400'd. Local state flips the chip to "Marked as placed ✓" (green) and `getRebalanceRepair()` refreshes the repair list. Emits `portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, …)` after success. Pinned by `src/__tests__/utils/repairManualPlacementPrice.test.js`. Ported from Alphab2bapp `9d80b736`.
- Data source: `failedTrades[i].orderStatusMessage` + `failedTrades[i].classification`, shipped by ccxt-india `rebalancing/utils/db_manager.repair()` since 2026-05-11.

---

## 7. Manual Override

When an order is rejected or fails, the user can manually place it in their broker app and then mark it as executed.

### Mobile: `RecommendationSuccessModal.js:82-95`

```
User taps "Mark as Placed" on a FAILURE row
  → Inline editor: qty, price
  → PUT /api/model-portfolio-db-update/manual-placement
      Body: { userEmail, modelId, uniqueId, symbol, exchange,
              transactionType, actualQty, actualPrice }
  Response:
    { message, symbol, actualQty, actualPrice,
      executionStatus: "executed"|"partial", idempotent: false }
```

**Idempotency:** Re-calling for an already-executed entry returns `idempotent: true` with no DB change. The execution status is recomputed from all `adviceEntries[]` — if all are "executed" → status = "executed", otherwise "partial".

**DB operations:**
1. Find `model_portfolio.model.rebalanceHistory[]` by `model_Id`
2. Flip matching `adviceEntry.status` → "executed"
3. Stamp `manually_placed_at`, `actual_quantity`, `actual_price`
4. Recompute `subscriberExecutions[]` status for this user

---

## 8. DB Update Chain (Post-Execution)

This chain runs after every successful or partial order placement. The mobile SDK route (`/sdk/v1/orders/place-rebalance`) orchestrates all three steps with retry logic.

```
STEP 1 — Record execution in backend
  POST /api/model-portfolio-db-update
  Body: { modelId, orderResults[], modelName, userEmail, user_broker }
  Operations:
    - Finds rebalanceHistory entry by modelId
    - Updates adviceEntries[].status = "executed" for each SUCCESS
    - Creates/updates subscriberExecutions[] for this user+broker
    - Writes to model_portfolio collection

STEP 2 — Update ccxt-india MP dashboard status
  PUT /rebalance/update/subscriber-execution (ccxt-india)
  Body: { model_id, user_email, user_broker, status, executedTrades[] }
  Updates ccxt's internal MP tracking

STEP 3 — Enroll in async status polling
  POST /rebalance/add-user/status-check-queue (ccxt-india)
  Enrolls the user for background order reconciliation
  ccxt-india polls broker order books and reconciles PENDING → COMPLETE/FAILED
```

> **Zerodha Kite Publisher path note.** When the user's connected broker is
> Zerodha, MP rebalance routes through `MPReviewTradeModal.handleZerodhaRedirect`
> (Kite Publisher WebView) instead of the REST `process-trade` path. The
> status-check-queue enrollment above happens in BOTH paths — see
> `MPReviewTradeModal.js:1272`. Client-side order-book polling as a
> WebView-callback-missed fallback exists in `RebalanceModal` (bespoke
> rebalance) but is NOT yet implemented in `MPReviewTradeModal`; the
> server-side queue is the only recovery layer for MP. Full polling contract,
> failure modes, and consumer recovery-posture matrix: see
> `docs/REBALANCING.md — Kite Publisher polling fallback`. Failure-mode
> taxonomy: see `docs/BASKETS_ARCHITECTURE.md § 9 — WebView callback missed`.

> **Payload ownership (2026-08-28).** `MPReviewTradeModal` and
> `RebalanceModal` retain model-portfolio sequencing, derivative symbol
> resolution, lot sizing and batch transitions, but delegate each final
> Publisher item to `brokerPublisher.convertToBasketItem()`. Product/order-type
> policy is no longer duplicated in either screen; the shared exchange-aware
> mapper guarantees that `NFO`/`BFO` carry-forward legs are sent as `NRML`.
> This refactor does not change the two-phase sells-first/fill-gated lifecycle.

On SDK path (`/sdk/v1/orders/place-rebalance`):
- All three steps run sequentially inside the route
- Failures in steps 2 or 3 are logged in `_postChain` in the response but do not fail the overall call
- Frontend receives both `results[]` and `_postChain` status

---

## 9. Refresh & Status Polling

### 9a. Initial Load Sequence (mobile `TradeContext.js`)

```
1. loadStoredData()             — read config (3 retries, 1s delay)
2. getUserDetails()             — GET /api/user/getUser/{email}
3. getAllTrades()                — GET /api/user/trade-reco-for-user?user_email={email}
4. getModelPortfolioStrategyDetails() — GET /api/model-portfolio/subscribed-strategies/{email}
5. getAllFunds()                 — broker cash balance
6. getAllBrokerSpecificHoldings() — holdings per broker
```

### 9b. Broker Order Book Refresh

```
TradeContext.fetchBrokerOrderBook(forceRefresh)
  Cache: 10s freshness check
  GET /{broker}/order-book
  Returns: { orders[], pending[], error }

Auto-refresh:
  startAutoRefresh() — 30s polling for pending orders
  stopAutoRefresh()  — called on modal close / unmount
```

### 9c. Post-Rebalance Refresh

The MP rebalance lane emits both portfolio events on success, matching the bespoke rebalance contract:

| Emit site | Event(s) | Payload |
|---|---|---|
| `MPReviewTradeModal.js:644-655` (main `placeOrder` success branch) | `HOLDINGS_REFRESH` + `REBALANCE_EXECUTED` | `{ userEmail, modelName, broker }` |
| `MPReviewTradeModal.js:1585-1596` (Fyers publisher success branch) | `HOLDINGS_REFRESH` + `REBALANCE_EXECUTED` | `{ userEmail, modelName, broker: 'Fyers' }` |
| `RecommendationSuccessModal.js:340` (manual-placement PUT success) | `HOLDINGS_REFRESH` only | `{ userEmail, modelName, broker: currentBroker }` |

The bespoke rebalance path emits the same events at `RebalanceModal.js:949+953, 1260+1264, 1886+1890`. `DummyBrokerHoldingConfirmation.js:227` emits `HOLDINGS_REFRESH` only.

`TradeContext` also treats `refreshEvent` and `OrderPlacedReferesh` as an
account-wide invalidation boundary. It re-fetches the user first (so a broker
switch cannot send a funds request with old credentials), then force-refreshes
cash, recommendations and model-portfolio state. Cash is checked again after
two seconds to cover brokers whose buying power trails the final order
acknowledgement. The Broker screen therefore cannot reuse a pre-switch or
pre-trade confirmed-funds snapshot.

**Listeners:**
- `RebalanceAdvices.js:117` — `HOLDINGS_REFRESH` → re-fetch holdings for the current model
- `RebalanceAdvices.js:121` — `REBALANCE_EXECUTED` → trigger calculate-rebalance refresh
- `ModalPFCard` / `MPCard` — subscribe via `portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, ...)`

**Why HOLDINGS_REFRESH only on manual placement:** a per-row manual-placement PUT mutates a single order record (flips status → `manually_placed`); it is not a fresh rebalance event. Emitting `REBALANCE_EXECUTED` here would (mis-)trigger a fresh calculate-rebalance call on listeners.

### 9d. LTP Snapshot

LTP is NOT fetched live on every load. Instead:
1. `MPReviewTradeModal` fetches live prices via WebSocket during the review phase
2. After execution, prices are saved via: `PUT /api/model-portfolio/ltp-snapshot`
   Body: `{ email, modelName, ltpMap: { symbol: price } }`
3. Future loads use the stored snapshot for P&L display

### 9f. value-history NAV-gap fallback — "Value since you started" ₹0 incident (backend, 2026-08-07)

`GET /api/model-portfolio/value-history/:email` (admin By-Client tiles/chart +
client dashboard) reconstructs the since-inception curve from the **model NAV
index** (`portfolio_daily_values.dailyValues`, produced by ccxt-india
`cron_model_pf.py` — daily 12:30 UTC Mon–Fri, `performance_2` pipeline) scaled
by the customer's dated contributions (`subscription_amount_raw`, which is
CUMULATIVE budget snapshots — `_contributionsFromRaw` converts to incremental
deltas; verified correct for markup's data). **Markup MQ incident:** the MQ
models launched 2026-08-06; the cron had written exactly one provisional bar
per model, dated `2026-08-06T15:30Z` — BEFORE every client's first
contribution (subscriptions recorded 18:03+ UTC Aug 6). `_reconstructModelSeries`
skips bars with `date < firstContrib` → zero points → the endpoint returned
`total_aum/invested/abs_gain = 0` and the admin tiles showed **₹0 / ₹0 / ₹0 /
"—" for every client** (the summary card above them was fine — verified
byte-for-byte against an independent recompute from `user_net_pf_model`
order_results × live LTP feed). **Fix (backend commit `fb5f63f`):** when a
model has executed trades but reconstruction yields no points, emit a single
fallback point from the live-holdings summary (`_summarizeCustomerModel`) so
the tiles show real numbers immediately; XIRR additionally requires
`aggSeries.length >= 2` (a <1-day span would annualize into nonsense). The
cron appends bars daily (v3 path recomputes from scratch each run — no manual
backfill needed), so the curve/XIRR populate as history accrues. Debug
signature: `value-history` with `points: 0` + `has_executed_trades: true` +
non-zero `actual_current` ⇒ NAV index gap, not holdings math.

### 9e. AfterSubscriptionScreen data flow + stale-broker detection (mobile)

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

Merge rule: use CCXT whenever it contains a valid dated holdings snapshot,
including a snapshot whose `order_results` is empty. A newer dated empty
snapshot is authoritative evidence of a complete model exit; falling back to
an older non-empty subscription mirror would resurrect sold holdings (the
POLYSPIN incident on 2026-09-30). An undated empty row is only a legacy
placeholder and is ignored in favour of a real execution. The subscription
mirror is used only when CCXT has no valid snapshot at all. The pure selection
rules live in `src/utils/rebalanceHelpers.js` and
`src/utils/modelPortfolioHoldings.js`.

The Calculate backend also values same-day positions through their actual
broker symbol and exchange before mapping the verified price back to the model
symbol. This covers cross-exchange Zerodha aliases such as a BSE `PATELENG`
target represented by an NSE `PATELENG-EQ` T1 position; a valid same-day
holding must not fail price verification merely because the model spelling is
different.

The screen starts in a real loading state and does not render ₹0 or “No
Holdings Yet” until both requests settle. It refreshes this data whenever the
screen regains focus and on `HOLDINGS_REFRESH`, so returning after a completed
rebalance cannot retain a pre-execution snapshot. The pure source resolver is
`src/utils/modelPortfolioHoldings.js`.

`getSubscriptionData` must wait for `userDetails` (and thus `user_broker`) before running — the `useEffect` depends on both `strategyDetails` and `userDetails`. Race condition fixed 2026-04-24 — previously triggering on `[strategyDetails]` alone could fire with `userDetails = undefined`, sending `user_broker = ""` to aq_backend, which returned wrong-broker data.

**Stale-broker banner.** When CCXT returns empty for the current broker but the subscription endpoint returns data from another broker (`isStalebrokerData = true`, `:159`), a yellow warning banner renders in the Portfolio Holdings tab (`:603`). Web has no equivalent banner — silently shows wrong-broker holdings (logged as 🟡 §17.7).

---

## 10. Broker Migration Flow

When a user switches their connected broker, their existing MP holdings (stored under the old broker) need to be linked to the new broker.

```
STEP 1 — Detect migration requirement
  GET /api/model-portfolio-db-update/broker-migration-summary/{userEmail}?newBroker={broker}
  Response: { modelsWithHoldings[], requiresMigration: boolean }
  Shows HoldingsMigrationModal if requiresMigration=true

STEP 2 — User selects strategy per model: migrate / empty / skip
  POST /api/model-portfolio-db-update/handle-broker-migration
  Body: { userEmail, newBroker, migrations: [{ modelName, action, sourceDocumentId }] }
  Operations per model:
    "migrate": copy holdings to new broker document
    "empty":   create empty new-broker document
    "skip":    no action

STEP 3 — Update primary broker in ccxt
  POST /rebalance/change_broker_model_pf (ccxt-india)
  Body: { user_email, user_broker }
  Updates ccxt's internal broker assignment
```

**Multi-broker records:** After migration, the `model_portfolio_user` collection has documents for BOTH the old and new broker. `portfolio-summary` queries prefer the currently-connected broker.

### 10a. Holdings data-source discrepancy on broker switch

When a user switches to a new broker, the backend creates a fresh empty `model_portfolio_user` record for the new broker via `user_changed_broker()`. This creates a systematic mismatch between two data sources:

| Screen | Data source | Broker filter | Shows stale data? |
|--------|-------------|---------------|-------------------|
| Portfolio Holdings tab (`AfterSubscriptionScreen`) | CCXT `rebalance/user-portfolio/latest` + aq_backend `subscription-raw-amount` | CCXT: uses `user_doc.user_broker`; aq_backend: tries current broker, falls back to ANY | **Yes** — fallback can serve old-broker holdings |
| Rebalance Step 2 (`MPStatusModal`) | CCXT `rebalance/user-portfolio/latest` (no broker param) | Uses `user_doc.user_broker` | No — gets correct (empty) current-broker record |

The yellow stale-broker banner (§9e) detects and surfaces this on mobile.

---

## 11. Performance & P&L

### Portfolio Summary

```
GET /api/model-portfolio/portfolio-summary/{email}?broker=Zerodha
Response:
  { totalInvested, totalCurrent, totalReturns, returnsPercentage, portfolioCount,
    portfolios: [{ modelName, broker, invested, current, returns, returnsPercentage }] }

Calculation:
  invested  = qty × averagePrice      (from user_net_pf_model[].order_results)
  current   = qty × ltpPrice          (from ltp_snapshot, or fallback to averagePrice)
  returns   = current − invested
```

### Trade P&L

```
GET /api/model-portfolio/trade-pnl/{email}?broker=Zerodha
Returns per-symbol P&L across all subscribed MPs
Includes: entryPrice, currentPrice, holdingDays, pnl, pnlPercentage, isLtpLive
```

### EOD Performance Charts

`performance_eod_pnl` is populated by ccxt-india's background job. The web frontend renders this as a chart comparing model returns vs Nifty 50.

### Calculation Engine — performance_2 / v3 (default since 2026-05-11)

All MP performance numbers consumed by mobile (`MPPerformanceScreen`, `AfterSubscriptionScreen` portfolio cards) and web (`StrategyDetailsWithPortfolioDataView`) ultimately come from ccxt-india's `performance_2/` package. As of 2026-05-11, **v3** (`portfolio_back_calculator_v3.py`) is the default for every advisor — see ccxt-india changelog rows below.

Key behaviors mobile / FE should be aware of:

- **Intent-preserving rebalances.** v3 trades only stocks whose advisor weight changed; unchanged stocks have qty preserved exactly. v1's `_adjust_weights_for_held_stocks` re-normalisation drag (≈5%/9 rebalances) is gone.
- **Dividend roll-over.** Prior-period dividends fold into the next rebalance's `balance_cash` (instead of being dropped at the boundary). Visible to FE as `advice_executed[].dividend_rollover_cash` and `dividend_events[]` — no UI uses them today but they're audit-grade fields.
- **Delisted-symbol handling.** ccxt-india `ccxt_common_db.delisted_symbols` holds symbols that lose all live price feeds (e.g. `HCLTD` 2025-09). Daily-value loop drops them from the LTP retry (no more wedging) and values them at `delisted_at_ltp` (operator-set, defaults to last cached LTP). Mobile portfolio views may see a delisted holding hold its last good price indefinitely; operator can zero it out via `scripts/manage_delisted_symbols.py add SYM --ltp 0`.
- **Excluded advisor DBs.** `5circles`, `aceink`, `alokdaiya`, `profitx`, `japfinserve`, `asminsights` are permanently skipped by the perf cron. FE calls for these advisors' performance return whatever was last computed (typically nothing).
- **Retro-backfill 2026-05-11.** 32 production models / 214 rebalances were wiped and re-replayed with v3 in 37.9 min on tidi. Mobile clients fetching `/api/model-portfolio/performance` after that timestamp see v3 numbers; clients with cached responses from before 2026-05-11 should refresh.

Full engine reference: `ccxt-india/docs/PERFORMANCE_CALCULATION_ARCHITECTURE.md`.

---

## 12. SDK Integration (Phase C/D)

### Phase C — Execute Advice via SDK

Controlled by: `REACT_APP_USE_SDK_EXECUTE_ADVICE=true`

```javascript
sdkClient.executeAdvice({
  kind: 'mpRebalance',
  clientAdviceId: `${Date.now()}-${Math.random()}`,
  brokerName,
  modelId,
  modelName,
  uniqueId,
  trades: []    // SDK fetches from pre-calculated payload
})
```

SDK route: `POST /sdk/v1/orders/place-rebalance`
The SDK route runs the full post-execution chain (steps 1–3 from §8) internally.
Fallback: if SDK call fails, mobile falls back to legacy `/rebalance/process-trade`.

### SDK Portfolio Routes

```
GET  /sdk/v1/portfolios                    — List available strategies
GET  /sdk/v1/portfolios/subscriptions      — User's subscribed strategies
GET  /sdk/v1/portfolios/:modelName/pnl     — P&L for a specific model
POST /sdk/v1/portfolios/subscribe          — Subscribe (SDK payment proof)
```

### SDK Rebalance Routes

```
POST /sdk/v1/rebalance/calculate           — Compute trades
POST /sdk/v1/rebalance/execute             — Place orders
POST /sdk/v1/rebalance/switch-broker       — Change broker
POST /sdk/v1/rebalance/modify-investment   — Update investment amount
POST /sdk/v1/rebalance/performance         — Portfolio performance
```

---

## 13. API Endpoint Reference

### aq_backend_github (server.alphaquark.in)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/model-portfolio/portfolios/:advisor` | All strategies for advisor |
| GET | `/api/model-portfolio/portfolios/strategy/:modelName` | Strategy details |
| GET | `/api/model-portfolio/subscribed-strategies/:email` | User's active subscriptions |
| PUT | `/api/model-portfolio/subscribe-strategy/:id` | Subscribe / unsubscribe |
| PUT | `/api/model-portfolio/ltp-snapshot` | Save LTP for holdings display |
| GET | `/api/model-portfolio/portfolio-summary/:email` | Aggregate P&L |
| GET | `/api/model-portfolio/trade-pnl/:email` | Per-trade P&L |
| POST | `/api/model-portfolio/add-graph-history/:modelName` | Add allocation chart |
| POST | `/api/model-portfolio-db-update` | Record executed orders |
| PUT | `/api/model-portfolio-db-update/manual-placement` | Mark order as manually placed |
| GET | `/api/model-portfolio-db-update/subscription-raw-amount` | Subscription + holdings data |
| GET | `/api/model-portfolio-db-update/available-brokers` | Brokers with holdings for user |
| GET | `/api/model-portfolio-db-update/subscription-by-id/:documentId` | Holdings by document |
| GET | `/api/model-portfolio-db-update/user-broker-records` | All broker records for user |
| GET | `/api/model-portfolio-db-update/broker-migration-summary/:email` | Migration summary |
| POST | `/api/model-portfolio-db-update/handle-broker-migration` | Execute broker migration |
| POST | `/api/model-portfolio-db-update/migrate-broker-records` | Migrate records |
| POST | `/api/model-portfolio-db-update/cleanup-duplicate-broker-records` | Dedup broker records |
| GET | `/api/model-portfolio-db-update/user-portfolio/all/:email/:modelName` | Full history |
| POST | `/api/model-portfolio/newPlanImage` (and `/plan/newPlanImage`) | Strategy image upload (advisor surface) |

### ccxt-india (ccxtprod.alphaquark.in)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/rebalance/calculate` | Calculate rebalance diff |
| POST | `/rebalance/process-trade` | Execute orders (legacy path) |
| GET | `/rebalance/user-portfolio/latest/:email/:modelName` | Current MP holdings |
| PUT | `/rebalance/update/subscriber-execution` | Update execution status |
| PUT | `/rebalance/update/user-portfolio/latest` | Update holdings after exec |
| POST | `/rebalance/record-publisher-results` | Advisor publisher results |
| POST | `/rebalance/add-user/status-check-queue` | Enroll async reconciliation |
| POST | `/rebalance/get-repair` | Get repair trades |
| POST | `/rebalance/insert-user-doc` | Create/update subscription record |
| POST | `/rebalance/change_broker_model_pf` | Change primary broker |
| POST | `/angelone/equity/surveillance` | Angel One surveillance check |
| POST | `/angelone/market-data` | Live LTP fetch |
| POST | `/rebalance/resolve-single-order` | Manual single-order re-evaluation (mobile-only consumer; see §7, §17 🔴) |
| PUT | `/rebalance/update/user-portfolio/latest` | Update holdings after exec |
| PUT | `/rebalance/update/user-portfolio/latest/keys` | Update specific keys on latest portfolio entry |
| POST | `/rebalance/check-broker-holdings` | Reconciliation snapshot for current broker |
| POST | `/rebalance/group-execution-status` | Bulk status query for grouped users |
| GET | `/rebalance/user-execution-history` | Past executions for the user |
| POST | `/rebalance/push-update` | Push-update broadcast for an advisor's rebalance |
| POST | `/rebalance/send-notifications` | Notification fan-out post-execution |
| POST | `/rebalance/v2/get-portfolio-performance` | EOD performance series (consumed by web charts) |
| GET | `/rebalance/get-portfolio-live-weightage` | Live weightage snapshot |
| POST | `/rebalance/create-strategy` | Advisor strategy create |
| POST | `/rebalance/draft` | Advisor strategy draft save |
| POST | `/rebalance/minimum-portfolio-amount-new` | Minimum-amount computation for new subscriber |
| POST | `/rebalance/insert-sip` | SIP subscription insert |
| GET | `/rebalance/performance/cagr` | CAGR series |
| POST | `/rebalance/manual_correction` | Admin correction surface |
| GET | `/rebalance/list-broker-connections` | Connected brokers for MP user |
| POST | `/rebalance/disconnect-broker` | Disconnect broker from MP record |

> **Note:** ccxt-india `apps/app_model_portfolio.py` exposes ~30 `/rebalance/*` routes; the doc enumerates the subset consumed by mobile + web clients today. Routes not yet client-consumed (advisor-only, admin-only) are not in scope here — see `ccxt-india/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` for the full inventory.

### SDK Routes (aq_backend_github, /sdk/v1)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sdk/v1/portfolios` | List strategies |
| GET | `/sdk/v1/portfolios/subscriptions` | User subscriptions |
| GET | `/sdk/v1/portfolios/:id` | Strategy detail |
| GET | `/sdk/v1/portfolios/:modelName/pnl` | P&L |
| POST | `/sdk/v1/portfolios/subscribe` | Subscribe |
| POST | `/sdk/v1/rebalance/calculate` | Calculate |
| POST | `/sdk/v1/rebalance/execute` | Execute |
| POST | `/sdk/v1/rebalance/switch-broker` | Switch broker |
| POST | `/sdk/v1/rebalance/modify-investment` | Modify amount |
| POST | `/sdk/v1/rebalance/performance` | EOD performance proxy for ccxt v2 portfolio-performance |
| POST | `/sdk/v1/orders/place` | Place trades (non-rebalance lane; proxies ccxt `/orders/process-trade`) |
| POST | `/sdk/v1/orders/place-rebalance` | Place + post-chain |
| GET | `/sdk/v1/orders/book` | Order book |
| POST | `/sdk/v1/orders/:orderId/status` | Order status |
| POST | `/sdk/v1/orders/:orderId/cancel` | Cancel order |

---

## 14. Web vs Mobile Differences

Both clients consume the **same** ccxt-india `/rebalance/*` endpoints and `aq_backend_github` MP endpoints; differences are entirely in client orchestration, payment surface, and post-execution UX.

### 14a. Differences table (corrected 2026-05-11)

| Feature | Mobile (Alphab2bapp) | Web (prod-alphaquark-github) |
|---------|---------------------|------------------------------|
| Broker publisher | **Used.** `KitePublisherModal` for Zerodha (`MPReviewTradeModal.js:21,1983`); Fyers publisher via separate SDK executeAdvice path (`MPReviewTradeModal.js:1375`). Native modules, not dynamic script. | `BrokerPublisherButton` shared component (`UpdateRebalanceModal.js:22`); Kite Publisher + FYERS API Connect loaded as dynamic `<script>` tags. |
| DummyBroker flow | `DummyBrokerHoldingConfirmation.js` (`src/components/AdviceScreenComponents/`) — confirms manual placement of full target portfolio. | Same component name (`Home/ModelPortfolioSection/DummyBrokerHoldingConfirmation.js`); web has an explicit "Continue without broker" entry point in `UpdateRebalanceModal.js:250-295`. |
| Symbol conversion | **Used.** `/zerodha/convert-symbol` consumed via `src/utils/brokerPublisher.js:154` and `src/hooks/useZerodhaSymbolMap.js` for Angel One → Zerodha publisher format. | Same endpoint, module-scope in-memory cache. |
| Order-book fallback | `TradeContext.startAutoRefresh()` 30 s polling. | `UpdateRebalanceModal.startOrderPolling()` 90 s window with `publisherProcessedRef` flag to detect missed Kite callbacks. **Mobile has no Kite-callback fallback** — relies on `add-user/status-check-queue`. |
| BrokerPublisher remount | N/A — `KitePublisherModal` mounts/unmounts on `visible` prop. | `key` increment on each modal open forces remount (prevents stale Kite Publisher state). |
| Config source | `src/context/ConfigContext.js` + `.env`. | `AppConfigContext.js` + environment. |
| State management | `TradeContext.js` (React Context, ~1565 lines, 40+ exports). | Local component hooks + `portfolioEvents` emitter; no central context. |
| Redux usage | None. | Minimal (`auth` slice only); MP state is local/hook. |
| Broker migration UI | `HoldingsMigrationModal.js` (mobile). | `HoldingsMigrationModal.js` (web — same name, different impl). |
| Payment gateways (MP subscribe) | **Razorpay + Cashfree + PayU + Google Play IAP + Apple IAP.** Switcher driven by `config.paymentPlatform` and `GET /api/adminControl/get-payment-platform` (`MPInvestNowModal.js:36, 45, 61, 29, 161-188`). | **Razorpay only.** `Home/Strategy/useStrategyDetails.js:11,197` loads Razorpay; no Cashfree/PayU imports in `Home/Strategy/` or `Home/ModelPortfolioSection/`. (CF/PayU exist elsewhere in web for plans/courses, not for MP subscribe.) |
| Digio e-signature | `@digiotech/react-native` native SDK invoked from `MPInvestNowModal.js:88-93, 1036` with `pollDigioStatus`, `savePendingDigio` / `getPendingDigio` persistence. | Web equivalent in `Home/Strategy/useStrategyDetails.js` flow — confirm before merging. |
| Margin estimate | Not in MP flow (bespoke basket only). | `/margin/basket-estimate` called from basket modal (not MP). |
| WebSocket LTP | `useWebSocketCurrentPrice` hook + `MarketDataContext` provider. | Direct Socket.IO inside `UpdateRebalanceModal.js:305`. |
| EDIS pre-flight | Per-broker (Zerodha/Angel One/Dhan/Fyers/Portal) in `MPReviewTradeModal.js:1888-1908`. | Per-broker in `UpdateRebalanceModal.js:629-697`. |
| Surveillance check | `POST /angelone/equity/surveillance` (Angel One only) `MPReviewTradeModal.js:114`. | Same (`UpdateRebalanceModal.js:1727-1776`). |
| Repair trades UI | Not implemented end-to-end. `GET /rebalance/get-repair` wired in `ModelPortfolioService.js` but no modal surfaces repairs to user. | Partial — endpoint consumed; UI incomplete. |
| Manual override (post-rejection) | **Mobile-only.** `RecommendationSuccessModal.js:190` calls `POST /rebalance/resolve-single-order`; `:290` calls `PUT /api/model-portfolio-db-update/manual-placement`. Web has **no callers** of either endpoint. | Not implemented. |
| Cautionary-listing banner | **Mobile-only.** `RecommendationSuccessModal.js:389-409` classifies on `cautionary` + `listing` in `orderStatusMessage`. | Web `MPStatusModal.js` has zero cautionary/LOW_FUNDS classification. |
| Insufficient-funds banner (LOW_FUNDS) | **Mobile-only.** `RecommendationSuccessModal.js:410-469` parses `classification: 'LOW_FUNDS'` plus regex on Angel One's "Available funds … You require …" pattern. | Not implemented. |
| AMO pill | **Mobile-only.** Amber AMO pill in `RecommendationSuccessModal.js` driven by `variant === 'AMO'` resolved via `resolveResultVariant` from `utils/tradeVariant.js`. | Not implemented (web does not render AMO badge). |
| LTP snapshot | `PUT /api/model-portfolio/ltp-snapshot` written from review modal post-execution. | Same endpoint. |
| SDK execute (Phase C) | **Mobile-only.** Gated on `REACT_APP_USE_SDK_EXECUTE_ADVICE=true` (`.env:128`); `sdkClient.executeAdvice({kind: 'mpRebalance'})` at `MPReviewTradeModal.js:436, 1375`. | **Not implemented.** Zero references to `REACT_APP_USE_SDK_EXECUTE_ADVICE`, `sdkClient`, or `executeAdvice` anywhere in `prod-alphaquark-github/src/`. Web always hits legacy `/rebalance/process-trade`. |
| Strategy details hook | Monolithic logic in `MPInvestNowModal.js` + `UserStrategySubscribeModal.js` + `TradeContext.js`. | Split: `useStrategyDetails.js` (subscribe + Razorpay), `useStrategyDetailsWithPortfolioData.js` (32 K — strategy details + portfolio data). |
| Strategy progress visualization | None. | `StepProgressBar.js` (`Home/ModelPortfolioSection/`) — multi-step strategy onboarding UI. |
| Strategy info modal | None (info shown inline). | `MPInfoModel.js` — dedicated modal for strategy metadata. |
| Allocation pie chart | None in MP screen. | `PortfolioDistributionChart.js`. |

### 14b. Truly shared (identical on both)

- ccxt-india `/rebalance/*` endpoint surface and request/response shapes
- aq_backend `/api/model-portfolio/*` + `/api/model-portfolio-db-update/*` endpoint surface and shapes
- `subscriberExecutions[]` and `user_net_pf_model[]` MongoDB shapes (source of truth for holdings)
- `detectTransientOrderWindowError()` helper (imported on both — `UpdateRebalanceModal.js:24`, `MPReviewTradeModal.js:32`)
- `validateStockExchanges()` exchange-gate (mobile entry points enumerated in §6c)

### 14c. NOT shared even though docs implied so

| Was claimed shared | Actually | Risk |
|--------------------|----------|------|
| `portfolioEvents` for MP refresh | Bespoke-only — MP lane never emits (§9c) | MP screens don't auto-refresh after rebalance |
| `REACT_APP_USE_SDK_EXECUTE_ADVICE` flag | Mobile-only — web ignores | Web cannot exercise the SDK execute path; feature drift |
| MP payment gateways CF/PayU/IAP | Mobile-only on MP subscribe lane | Web cannot offer non-Razorpay options for MP |
| Manual placement + cautionary/LOW_FUNDS UX | Mobile-only | Web users who hit rejections have no inline recovery |
| Symbol conversion | Both — was incorrectly listed as web-only | (No drift, doc was wrong) |
| Broker publisher | Both — was incorrectly listed as web-only | (No drift, doc was wrong) |

### 14d. Cross-repo doc parity

The web app has its own `prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (~80 K, last touched 2026-04-28). The two docs are **independent** — neither is canonical for the other. Cross-repo MP changes (backend route, schema, ccxt endpoint) must update both. The `ccxt-india/docs/MODEL_PORTFOLIO_ARCHITECTURE.md` copy is a third pointer-grade doc — keep it in sync or replace with a one-line pointer back to this canonical.

---

## 15. State Management

### Mobile — `TradeContext.js`

MP-specific state exported from `TradeContext`:

```javascript
// Strategy list
modelPortfolioStrategyfinal    // Array of subscribed strategies (from subscribed-strategies API)
isDatafetchinMP                // Loading flag

// Order book (for reconciliation)
brokerOrders                   // Latest order book
pendingOrders                  // Orders in PENDING state
isOrderBookLoading
lastOrderBookRefresh           // Timestamp (10s cache)
orderBookError

// Market prices
marketPrices                   // { symbol: ltp }

// Functions
getModelPortfolioStrategyDetails()
fetchBrokerOrderBook(forceRefresh)
getPendingOrdersForSymbol(symbol, type)
startAutoRefresh()
stopAutoRefresh()
fetchMarketPrices(symbols)
```

### Web — Local Hooks + Events

- `useStrategyDetails.js` — subscribe + Razorpay glue (~15 K)
- `useStrategyDetailsWithPortfolioData.js` — strategy data + portfolio data fetching (~32 K)
- `RebalanceCard.js` — local state for calculation results
- `UpdateRebalanceModal.js` — local state for trade execution
- `portfolioEvents` emitter — cross-component refresh signals:
  - `PORTFOLIO_EVENTS.HOLDINGS_REFRESH`
  - `PORTFOLIO_EVENTS.REBALANCE_EXECUTED`
  - `PORTFOLIO_EVENTS.DISTRIBUTION_REFRESH`

### Basket-leg deduplication in `TradeContext.flattenResponse` (mobile)

**File:** `src/screens/TradeContext.js:499-…` (around the `flattenResponse` function)

When the backend returns both a basket parent (with `basket_advice[]`) AND a standalone recommendation for the same symbol, the app previously showed both a BasketCard and a duplicate StockCard. Fixed by pre-computing a `basketLegSymbols` Set from all basket parents (`:505`) and filtering out matching standalone trades:

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

---

## 16. Security & Encryption

All API requests to ccxt-india require:
- `aq-encrypted-key` header — `SecurityTokenManager.generateToken()` (JWT, 15s expiry)
- `X-Advisor-Subdomain` header — isolates MP data per advisor/tenant

Broker credentials stored in `User.connected_brokers[]` (encrypted via `checkValidApiAnSecret`). The SDK routes decrypt credentials server-side before forwarding to ccxt.

---

## 17. Known Limitations

Limitations are classified by impact:
- 🔴 **Blocking** — silently breaks user-visible behavior; ship a fix before next MP-affecting commit.
- 🟡 **Functional gap** — feature exists but is incomplete; tracked for follow-up.
- 🟢 **Accepted trade-off** — by-design limitation that needs no immediate change.

### 🔴 Blocking

1. ~~**MP rebalance lane never emits `REBALANCE_EXECUTED` / `HOLDINGS_REFRESH`.**~~ ✅ **Fixed 2026-05-11.** Both events now emitted at `MPReviewTradeModal.js:648-655` (main success), `:1589-1596` (Fyers publisher success), and `HOLDINGS_REFRESH` only at `RecommendationSuccessModal.js:340` (manual-placement success). See § 9c for the full emit/listen map.

2. ~~**`manual-placement` + `resolve-single-order` are mobile-only.**~~ ✅ **Partially resolved 2026-05-11.** Web already had a checkbox-based manual-confirm flow (`MPStatusModal.confirmManualOrders` → `PUT /rebalance/update/user-portfolio/latest/keys`); the missing piece was advisor-side stamping. Web now also calls `PUT /api/model-portfolio-db-update/manual-placement` per confirmed stock for `manually_placed_at` + `adviceEntries[].status` + `subscriberExecutions[]` recomputation. `RebalanceCard` threads `modelId={modelPortfolioModelId}` to `MPStatusModal`. Remaining (🟡 not blocking): web has checkbox-only confirm, mobile has per-row qty/price editor — UX polish tracked in `docs/WEB_MP_PARITY_TASKS.md § Task 1`.

### 🟡 Functional gaps

3. ~~**Repair trades UI.**~~ ✅ **Fully shipped 2026-05-11 (mobile).** Repair shortcut, delta-pre-populate, LTP refresh on modal open, cautionary / LOW_FUNDS / partial-fill chip with two-step Mark-as-Placed CTA — all active. ccxt-india `db_manager.repair()` ships the `orderStatusMessage` + `classification` fields needed for client classification. See § 6g for the full contract. **Remaining**: web parity refinements (LTP refresh + chip) tracked in `docs/WEB_MP_PARITY_TASKS.md § Task 4` for whoever owns the web repo.

4. ~~**Trade variant missing in `/rebalance/process-trade` response.**~~ ✅ **Fixed 2026-05-11.** ccxt-india `rebalancing/rebalancing.py:1191-` now builds a per-symbol variant map from inbound trades and stamps each result row with `variant` before returning. `resolveResultVariant` (`src/utils/tradeVariant.js`) keeps its three-tier resolution as defensive code for older deploys / cached responses, but tier-1 (server-echoed) is now the primary source. Bespoke lane (`RebalanceModal.js`) also benefits — the same ccxt route serves both lanes, and the helper falls back to outgoing trades when `originalStockDetails` isn't threaded through.

5. **LTP staleness on portfolio screens.** `ltp_snapshot` is written at rebalance commit time only. P&L cards on `AfterSubscriptionScreen`, `MPPerformanceScreen`, and `ModalPFCard` read the snapshot without checking age. **Fix candidates**: (a) re-fetch LTP via `MarketDataContext` on screen focus, (b) attach a staleness timestamp to the snapshot and refresh if older than N hours.

6. **Multi-broker UI single-selection.** Schema and backend fully support multi-broker MP (`model_portfolio_user` docs are per-broker, `subscriberExecutions[]` keyed on `{user_email, user_broker}`), but both clients show a single primary broker. Broker switch creates orphaned documents per §10. **Fix**: surface aggregated multi-broker holdings in the portfolio summary card, with broker breakdown.

7. **AfterSubscriptionScreen stale-data banner (mobile-only).** Mobile shows the yellow `isStalebrokerData` banner when CCXT returns empty for the current broker but the subscription endpoint returns data from another broker (`AfterSubscriptionScreen.js:159, 603`). Web has no equivalent banner — silently shows wrong-broker holdings.

### 🟢 Accepted trade-offs

8. **After-hours orders broker-coverage.** `allowAfterHoursOrders` config flag is global; not all brokers support AMO. Variant field tracks intent but no broker-level UI guardrail exists. By design — broker-level support matrix lives in `brokerSupport.js`.

9. **EDIS pre-checks for portal brokers.** Portal-side brokers (~8) use optimistic EDIS — rejection triggers `OtherBrokerModel`. By design (no live-check API on those brokers), accepting one wasted broker round-trip.

10. **Two parallel MP docs across repos.** Web (`prod-alphaquark-github/docs/MODEL_PORTFOLIO_ARCHITECTURE.md`) and ccxt-india (`ccxt-india/docs/MODEL_PORTFOLIO_ARCHITECTURE.md`) maintain their own MP docs. There is no single canonical. **Mitigation**: cross-link from each; update all three on any MP backend / schema change.

11. **`UserStrategySubscribeModal.js` (mobile) bypasses `MPInvestNowModal` for the publisher-direct subscribe path.** Reads `aq-encrypted-key`, calls `record-publisher-results` (L640) and `api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf` (L509) directly. By design (Zerodha publisher requires its own flow), but creates a second subscribe path that bypasses Digio/PendingPayment recovery.

## 18. Plan logo resolution

The MP/plan logo is stored on **two** collections and the two clients read
different ones — the source of a recurring "wrong logo on mobile" bug:

| Surface | Reads | Field |
|---|---|---|
| **Web** (plans/portfolios pages) | `plans` | `plans.image` |
| **Mobile** MP detail (`MPPerformanceScreen.js`) | `model_portfolio` | `strategyDetails.image` → `${server.baseUrl}${image}`; fallback `Alpha100 = src/assets/alpha-100.png` (red "100") |

Admin "upload logo" writes `plans.image`. The two `newPlanImage` upload
endpoints in `aq_backend_github/Routes/modelPortfolio.js` mirror to **both**
collections, but **admin plan-only edits** (Plans admin routes) write
`plans.image` only, leaving `model_portfolio.image` `""`/null → mobile shows the
red `Alpha100` placeholder while web looks correct.

**Resolution (server-side, 2026-07-07, commit `ac56f8a`):** both read endpoints
now backfill an empty `model_portfolio.image` from the matching plan
(`plan_id` first, then normalized `model_name`) at response time:
- `GET /portfolios/:advisor` (listing) — pre-existing.
- `GET /portfolios/strategy/:modelName` (detail — what mobile reads) — added
  2026-07-07. Row shape here is `{ originalData: {...} }`, so the image lives at
  `originalData.image`.

Because resolution is backend-side, **every client (Alphab2bapp, Alphanomy fork,
tidi_new, all forks) and both platforms get the correct logo with no app
rebuild**, and it self-heals for new plans.

**Source-side fix (also shipped 2026-07-07, ccxt commit `79555160`):**
`model_portfolio` docs are created lazily by ccxt
(`ccxt-india/apps/app_model_portfolio.py` `create_modelpf_strategy`) on first
rebalance — often AFTER the admin uploads the logo, so the mirror in Node's
`/plan/newPlanImage` (which only updates an already-existing `model_portfolio`
doc) misses and the doc is born with `image=None`. The creation code now seeds
`image` from the matching plan (same block that already seeds `plan_id` +
`volatility`) when the create request carries no image file. So the field is now
populated **at rest** at creation; the Node read-side backfill above stays as the
display safety net for any doc created before this fix.

---

## 2026-07-18 — Mobile MP presentation corrections

- **Trade P&L navigation:** the Model Portfolio list owns the Trade P&L CTA in
  its `ListHeaderComponent`. It therefore scrolls with the page instead of
  remaining frozen over the content; it still navigates to `TradePnLScreen`.
- **MP invest close affordance:** the presentation header reserves space and
  absolutely positions the close action inside its bounds. This is visual only;
  payment, Cashfree/Razorpay/PayU/IAP, Digio and subscription state remain in
  `src/components/ModelPortfolioComponents/MPInvestNowModal.js`.
- **Portfolio summary presentation:** expired subscriptions remain visible for
  reference, but the expiry state is displayed as subordinate plan metadata and
  a clear renewable notice. It must not be appended to a model name or distort
  fund-row widths; summary/body typography follows the Portfolio tab. Customer
  copy calls the resumed service **recommendations**, never “advice”.
- **Plan-card presentation:** the Model Portfolio plan list gives its first card
  explicit clearance below the tabs. Pricing, saving badge, metrics and actions
  are presentation-only and must remain within the card bounds; the container
  continues to own selected pricing and subscription actions.
## 2026-08-11 — "Update Investment" auto-open + clearer label (rebalance alert dead-end)

**Problem (RA 2026-08-11 markup):** when a rebalance `calculate` returns a
subscription-amount error, `RebalanceAdvices.js` alerts *"Your subscription amount is
not set or may have been cleared. Would you like to update it now?"* and its **Update**
button navigates to `AfterSubscriptionScreen` with `openModifyInvestment: true` — but the
screen never read the param, so the user landed with no obvious next step and the bottom
button was easily missed / misread as non-clickable.

**Fix:** `AfterSubscriptionScreen.js` now consumes `route.params.openModifyInvestment` and
auto-opens the modal once `strategyDetails` + the authenticated `user_broker` have loaded;
optional rebalance history does not block the modal (one-shot `useRef` guard — fires once per navigation, never
re-opens on dismiss). The broker readiness gate is data-integrity critical: the old modal
could mount before the profile request completed, query with an empty broker, then save to
the `DummyBroker` fallback. The actual broker subscription remained unset, causing the same
rebalance alert to recur. The modal now retries its lookup when the real broker arrives,
never invents a broker for writes, and safely resolves a model ID when history is missing.
The persistent footer is wrapped in the native bottom safe-area boundary so it remains
above iOS and Android system navigation. Button + modal header are named **"Update
Investment Amount"** (formerly "Modify Investment") so the action matches the alert's ask.
Files: `src/screens/Home/AfterSubscriptionScreen.js`,
`src/screens/Home/ModifyInvestment1.js`. Ported to `markup_app` (content port `a107d17b`,
initial upstream `40cdb72`; loop and safe-area hardening upstream `c4b12bf`). See
`docs/REBALANCING.md` "Update Investment alert → auto-open contract".

## 2026-08-28 — Gain-aware top-up parity with web

ModifyInvestment1 reads costModelGainAwareTopup from the shared
/frontend-config response and, when enabled, requests the authoritative
POST /rebalance/current-value valuation for the selected broker/model.
A reliable positive value is the Top Up base; unavailable/unreliable valuation
falls back to the nominal subscription amount. Full Amount remains an explicit
reset. The snapshot-derived optional P&L control is hidden and ignored while
the authoritative gain-aware path is active. Pure gain/loss/rounding/fallback
fixtures pin the same calculation used by web.

## 2026-08-18 — Mobile frozen-plan identity correlation

`RebalanceModal` resolves execution identity once and reuses it across direct
brokers, Fyers, Zerodha buy refit, and DummyBroker. If `calculatedPortfolioData`
has a fresh `uniqueId`, its `plan_id`/`plan_version`/`uniqueId` win even when an
older repair row remains in `TradeContext`. Repair fields are used only when the
review data has no fresh `uniqueId`. This prevents executing or recording an old
repair attempt while the customer is reviewing a newly calculated portfolio.
## Temporary broker-scoped after-hours admission (22 September 2026)

The Step-3 `ExecutionStatusScreen` and the legacy `RebalanceModal` previously
disabled **Place Order** from the device clock before an approved temporary
window could reach the backend. They now allow Groww, Kotak and Fyers to submit
the attempt after hours while the backend remains authoritative for the
broker-scoped absolute expiry. Missing or expired backend policy still fails
closed as `MARKET_CLOSED`; Zerodha and every other broker retain the local
closed-market button gate. This does not guarantee acceptance or a fill—the
broker may queue or reject a DAY/CNC order under its own rules.
