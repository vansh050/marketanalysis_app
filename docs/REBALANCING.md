# Rebalancing Architecture

## 2026-10-02 One broker probe per Accept Rebalance tap

Before this change one Home-card **Accept Rebalance** tap ran, in series:
probe (getUser + broker funds) → `rebalance/get-repair` → the same probe in
`handleCheckBroker` → the same probe again in `handleAcceptRebalance`
(`directReview`) → `rebalance/calculate`. Three identical broker funds
round-trips, each with its own retry.

Now:

1. **Reuse.** `useRefreshBrokerStatus` accepts `{forceNetwork, reuseWithinMs}`
   and returns the last network probe (`reused: true`) when it is younger
   than `BROKER_PROBE_REUSE_MS` (30 s). Only a probe that proved a
   **connected** broker with **live funds** is cached; an expired, failed or
   disconnected probe always re-probes. `refreshEvent` (any connect /
   reconnect / disconnect / execution) and `OrderPlacedReferesh` clear the
   cache. Callers that must see the broker *now* (post-reconnect resume,
   trade/basket placement) do not pass `reuseWithinMs` and are unchanged.
2. **Overlap.** `RebalanceCard.handleRepairDiscovery` starts `get-repair`
   together with the probe, but only when the card already shows the broker
   `connected`. Its result is used only if the probe confirms the **same**
   broker is still connected; an expired probe opens reconnect and the
   overlapped result is discarded (no review opens from it); a broker switch
   re-runs `get-repair` for the new broker. When the card already shows the
   broker expired/disconnected, reconnect still precedes discovery.
3. **Hand-forward.** `handleCheckBroker` passes its probe as
   `onReviewRebalance({..., liveSession})`; `handleAcceptRebalance` uses it
   instead of probing again. `/rebalance/calculate` re-reads funds and
   holdings itself and its `sessionExpired` / `RECONNECT_BROKER` /
   `accountRecovery.reconnect` answers still open the reconnect sheet.

4. **Reuse the Home refresh's get-repair (added same day).** `TradeContext`
   keeps the last **clean** get-repair answer (`lastRepairResultRef`: not
   pending/unknown, account not blocked) with its time, email, broker and
   models. `getRecentRepairResult({modelName, broker, maxAgeMs = 30000})`
   returns it to the card when it covers that model + broker and is <30 s old;
   the card then skips its own get-repair (it measured 4–10 s server-side).
   `refreshEvent` / `OrderPlacedReferesh` bump `repairEpochRef` and clear it,
   and an answer whose request started before such an event is never stored.
   The reuse requires the probe to confirm the same broker is connected;
   otherwise the card asks the server as before. An expired card never reuses.

5. **One tap's broker reads are shared with its calculate (added same day).**
   `handleRepairDiscovery` creates one `brokerReadSession` id per Accept tap
   (`tapReadSessionRef`) and sends it with that tap's get-repair
   (`TradeContext.getModelPortfolioRepairTrades(..., {brokerReadSession})`)
   and its calculate (`onReviewRebalance` → `handleAcceptRebalance` payload).
   The server keeps the holdings/positions it read during get-repair for that
   id only, ≤15 s, and calculate reuses them; cash stays live. A tap that
   reused the Home answer (step 4) makes no get-repair call, so calculate
   reads live. ccxt `846e916e`, `rebalancing/utils/tap_broker_reads.py`.

6. **Calculate does not wait for the probe (added same day).** When the card
   already shows the broker connected and get-repair is in flight or reused,
   `handleRepairDiscovery` acts on get-repair's answer without waiting for the
   tap's probe. Only the two calculate paths (`requiresFreshRebalance`, and
   the verified-no-repair path) run early: `handleCheckBroker` hands the
   in-flight probe to `handleAcceptRebalance` as `pendingSession`, which sends
   `/rebalance/calculate` (broker = `expectedBroker`, context credentials) and
   then applies the same probe checks as before — refresh failure → alert,
   expired/not connected/funds preflight → reconnect, a different broker →
   `'broker_changed'` and the tap restarts step by step (`sequential`). On any
   failure the calculation is discarded and nothing is shown. Every other
   path (Repair review, holdings review, the "aligned" write, toasts) still
   confirms the probe first (`confirmSession`).

7. **Connection warm-up (added same day).** `useConnectionWarmup` (mounted in
   `RebalanceAdvices` while the customer has model portfolios) sends a tiny
   read-only `GET {ccxt}/health/live`: once when enabled, on returning to the
   foreground, then every 5 minutes in the foreground (never in the
   background, never twice within a minute). The first Accept tap after idle
   otherwise paid ~0.6–0.9 s opening a new TLS connection through Cloudflare —
   most Indian customers reach it via Singapore/Marseille, ~0.3 s per request
   even when warm (that leg can only change via Cloudflare routing/plan).

Net: one funds probe per tap (was three), and get-repair either reuses the
Home answer or no longer waits for the probe; when get-repair does run, its
holdings/positions/cash read serves the calculate too, and the calculate no
longer waits for the probe. Pinned by `src/__tests__/brokerProbeReuse.test.js` and
`src/__tests__/utils/actionReviewRouting.test.js`.

## 2026-09-29 Unaffordable target shares are not alignment

An empty Step 3 calculation carrying the backend-owned
`allocation.code = TARGET_SHARES_UNAFFORDABLE` is a blocked allocation, not a
successful alignment. `RebalanceModal` renders an amber **Target Allocation Is
Not Yet Reachable** state, explains that no orders were placed, and keeps the
existing target-share budget details visible. The zero-order acknowledgement
path explicitly excludes this state, so it cannot write
`subscriber-execution: executed` merely because both order arrays are empty.

Only an authoritative empty calculation without a funding, skipped-target,
sell-authorization, Publisher-continuation, or unaffordable-target blocker may
render **Already Aligned** and run the acknowledgement write.

## 2026-09-29 Compact order-first review

`RebalanceModal` treats the calculated orders as the primary review content.
Its `FlatList` owns the remaining vertical space and all optional funding
explanations scroll in the list footer after the orders. The low-funds warning
is collapsed by default and exposes its existing detail through **View
details**. The action button remains fixed and reachable.

The redundant **Funding used for this calculation** strip and duplicate
additional-funds sentence were removed. This is presentation-only: the frozen
plan, allocation warnings, funding consent, broker authorization, quantities
and dispatch contract are unchanged.

## 2026-09-29 Pending status requires an execution identity

The recommendation card does not treat a stale
`subscriberExecution.status = pending` value as sufficient broker-order
evidence. On **Check Order Status**, it first reads
`rebalance/user-portfolio/latest` and selects only:

- the attached current Publisher attempt; or
- a model-scoped `advice_executed` episode for the current recommendation.

Holdings snapshots and other recommendation IDs are excluded. The app calls
`add-user/status-check-queue` only when the selected attempt carries a
`uniqueId`, `planId`, or `attemptId`. Without one, it runs authoritative
`get-repair` recovery: a verified empty response reopens fresh Calculate;
unknown or in-flight evidence continues to hold. Calculate remains read-only
and never creates a pending broker attempt.

## 2026-09-29 Zerodha sell-to-buy price and continuation recovery

Before a dependent BUY is sent to `publisher/refit-buys`, mobile now refreshes
Kite-safe quotes and attaches that same snapshot to each MARKET leg. The
calculate response's server-owned `rebalancePrice` is persisted as the durable
fallback, so a foreground/app-restart continuation never reconstructs eight
zero-priced buys. Valid `applied`, `not_needed`, and
`attempt_with_shortfall` refit outcomes use the returned `submit` quantities.

A continuation is cleared only after the authorized Kite BUY window actually
opens. A refused or empty refit remains retryable, cannot auto-mark an empty
calculation as Already Aligned, and shows an explicit no-order-opened message.
`RebalanceAdvices` is the sole owner of the result modal; the nested duplicate
without the continuation callback was removed.

## 2026-09-28 broker result and reservation recovery

Broker result truth is normalized at the SDK boundary with quantity evidence;
raw adapter status remains available for audit. Protected cross-model cash
reservations expose the owning models and a review action instead of a retry
loop. Upstox explicit circuit-bound rejections with no order id may be retried
once at the broker-supplied legal edge; ambiguous or accepted attempts never
retry.

## 2026-09-28 Failed SELL before dependent BUYs

A rejected/cancelled SELL is recovered as an explicit SELL-only immutable
Repair. The customer sees `Review Failed SELL` and confirms the exact remainder;
no order is retried automatically. Completed SELLs are immutable. The accepted
BUY phase stays unavailable until broker truth makes the retry terminal, then
the next verification refits and presents only the remaining BUYs.

## 2026-09-18 Reduce-to-funded is anchored to the reviewed plan

The funding-consent choice "Update total investment to Rs R" writes through
`POST /rebalance/reduce-to-funded`, which pushes a `subscription_amount_raw` row
(`changeMode: "reduce_to_funding"`) and supersedes any unconsumed frozen plan
minted against the old intent. The amount is re-derived server-side: frozen-plan
continuity, then an open/partially-funded authorization (`targetAmount −
unfunded`), then the previous intent row (never raw live cash on a subsequent
rebalance — a later "Full Amount" reset against cash-as-intent would sell the
portfolio down to it), then live cash for a first rebalance.

Every call site sends `plan_id` (`rebalanceContract.plan.id`). Without it the
server re-reads the balance at tap time, so a settlement or deposit landing
between calculate and the tap changes the amount written and the button's quoted
figure no longer matches the account. A plan that fails the server's identity
check falls back to the live read unchanged.

## 2026-09-17 Canonical broker gate after connection

The broker picker, reconnect prompt, and post-connect rebalance continuation
share the canonical user record. A failed user refresh is not evidence that the
account is DummyBroker/brokerless and therefore cannot open the picker. After a
broker WebView or credentials flow succeeds, continuation waits for the shared
connection dispatcher to reread and verify the persisted selected broker. This
prevents a locally selected Zerodha flow from resuming while the database still
names an older Groww or DummyBroker state.

## 2026-09-17 Reconnect and CDSL modal ordering

Rebalance preflight repeats its funds check when broker login rotates the token
without changing the broker. During Zerodha sell authorization, the native
DDPI information modal is hidden before the app-root CDSL browser is displayed;
otherwise Android renders the native modal above the TPIN page and blocks it.

## 2026-09-08 Direct action review

Verified Repair, saved allocation and fresh allocation now open their required
review without obligatory holdings confirmation. Reconnect precedes fresh
verification; ownership blockers retain holdings resolution. See
[routing and release evidence](MODELPF_DIRECT_ACTION_ROUTING_2026-09-08.md).

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

## SDK invariant update (2026-08-28)

RN/Flutter convenience rebalances preserve the immutable backend plan and SELL phase before BUY. A lost response returns paused reconciliation with `safeToRetryPlacement=false`; AlphaB2B propagates it without legacy fallback.

## Verified post-sell transition to BUY (2026-08-26)

The native Zerodha queue opens dependent BUYs only after `publisher/refit-buys`
returns usable buying power. The request carries frozen `plan_id` and `unique_id`.
Confirmed-fill fallback cash is usable even with `cashReadOk:false`; abstain or
unusable cash closes the BUY phase. Repair stays hidden during broker reconciliation
and is automatically fetched again after the returned delay.

> **Last updated**: 2026-05-06

## Overview

Rebalancing allows model portfolio subscribers to realign their holdings with the advisor's target allocation. The flow involves:

1. Fetching current holdings from the connected broker
2. Calling the rebalance/calculate API to get buy/sell trades
3. Reviewing trades in a modal
4. Executing trades via the broker

## End-to-End Flow

```
User navigates to Model Portfolio screen
    │
    ▼
RebalanceAdvices.js renders rebalance cards
    │  Displays pending rebalance signals
    │
    ▼
User taps "Rebalance" → RebalanceModal.js opens
    │
    ▼
Fetches current holdings from broker API
    │  fetchBrokerSpecificHoldings(broker, credentials)
    │
    ▼
Calls rebalance/calculate API
    │  POST /api/model-portfolio/rebalance/calculate
    │  Body: { broker payload fields + portfolio info }
    │
    ▼
API returns buy/sell trades
    │  Displays in review UI
    │
    ▼
User confirms → ProcessTrades.js executes orders
    │  Routes to broker-specific order endpoints
    │
    ▼
Order results displayed → portfolio refreshed
```

## Key Files

| File | Purpose |
|------|---------|
| `src/components/AdviceScreenComponents/RebalanceAdvices.js` | Rebalance card list, initiates rebalance flow |
| `src/components/AdviceScreenComponents/RebalanceModal.js` | Rebalance review modal, broker payload building |
| `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` | MP rebalance review modal — Place Order execution (see § Known pitfalls) |
| `src/utils/rebalanceHelpers.js` | Pure helper functions (payload building, error detection, decryption) |
| `src/utils/ProcessTrades.js` | Trade execution across all brokers |
| `src/services/BrokerOrderBookAPI.js` | Order book fetching |

## Broker Payload Building

The `buildBrokerPayloadFields()` function in `rebalanceHelpers.js` builds broker-specific API payloads:

```javascript
buildBrokerPayloadFields(broker, credentials, decryptFn, angelOneApiKey)
```

### Per-Broker Payload Fields

| Broker | Fields |
|--------|--------|
| Zerodha | `accessToken` (jwtToken) |
| Angel One | `apiKey` (from config), `jwtToken` |
| Upstox | `apiKey` (decrypted), `apiSecret` (decrypted), `accessToken` |
| ICICI Direct | `apiKey` (decrypted), `secretKey` (decrypted), `accessToken` |
| Dhan | `clientId`, `accessToken` |
| Kotak | `consumerKey` (decrypted), `consumerSecret` (decrypted), `accessToken`, `viewToken`, `sid`, `serverId` |
| Hdfc Securities | `apiKey` (decrypted), `accessToken` |
| IIFL Securities | `clientCode` |
| AliceBlue | `clientId`, `accessToken`, `apiKey` |
| Fyers | `clientId`, `accessToken` |
| Motilal Oswal | `clientCode`, `accessToken`, `apiKey` (decrypted) |
| Groww | `accessToken` |
| Axis Securities | `accessToken` |

## Decryption

Broker API keys are stored encrypted. The `defaultDecrypt` function in `rebalanceHelpers.js` handles decryption:

```javascript
export function defaultDecrypt(value) {
  if (!value) return value;
  try {
    const bytes = CryptoJS.AES.decrypt(value, 'ApiKeySecret');
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || value;  // Fallback to original if empty
  } catch {
    return value;  // Fallback on error
  }
}
```

**Important**: All components must use `defaultDecrypt` from `rebalanceHelpers.js` — never use local decryption functions without try-catch and fallback logic. This was a bug fixed on 2026-03-31.

## Error Detection Helpers

`rebalanceHelpers.js` provides granular error detection (aligned with web app as of 2026-04-08):

| Function | Returns | Detects |
|----------|---------|---------|
| `isFundsErrorOrMissing(funds, status)` | `boolean` | Missing/error fund data while broker is connected. Short-circuits via `isTransientFundsError` so documented transient codes (Upstox `UDAPI100072`/`UDAPI100074`) do **not** trigger the re-login modal. |
| `isTransientFundsError(resp)` / `isTransientBrokerError` | `boolean` | Known broker transient errors — looks up `error_code`/`errorCode` against `TRANSIENT_NON_AUTH_BROKER_ERROR_CODES` and falls back to message heuristics (`temporarily unavailable`, `try again`, `service window`, `market hours`, `service is accessible from`). Works for both funds responses and per-row trade-place results. |
| `detectTransientOrderWindowError(responseData)` | `string\|null` | Inspects a process-trade response — returns the first transient message iff every failed row is transient from the same maintenance window. Callers use this to swap the all-failed modal for a soft "retry at 5:30 AM IST" toast. Returns `null` when any row is a real failure or any row is a success (so partial/mixed paths fall through to existing UI). |
| `isRebalanceErrorResponse(data)` | `boolean` | Backend error in rebalance API response |
| `isSubscriptionAmountError(msg)` | `boolean` | Missing subscription amount (`subscription_amount_raw`, `subscription amount`, `not set or has been cleared`) |
| `isLowAllowedBalanceError(msg)` | `boolean` | Insufficient balance (`low allowed balance` only) |
| `checkPortfolioShortfall(data)` | `{isShortfall, hasTrades, currentValue, requiredAmount}` | Portfolio value below required minimum (message-based: checks for "less than required minimum") |
| `isBrokerAuthError(msg)` | `boolean` | Expired/invalid broker tokens. Matches (case-insensitive): compound `invalid` + `api_key`/`access_token`/`token`; standalone `session expired`, `token expired`, `unauthorized`, `authentication`; broker-forwarded 401 variants `please login`, `please re-login`, `login required`, `error: 401`, `401 unauthorized`. The 401-variant set was added 2026-04-18 after Groww rebalance errors surfaced as `"Please Login and Try Again (Error: 401)"` and bypassed all earlier keywords, dead-ending the user at the generic `Unable to Rebalance` empty state instead of opening `TokenExpireBrokerModal`. Mobile-only; web's `rebalanceHelpers.isBrokerAuthError` in `prod-alphaquark-github` still has the old keyword set (not synced in this session per user scope). |

**Maintenance-window contract (2026-04-17)**: `TRANSIENT_NON_AUTH_BROKER_ERROR_CODES` is the single source of truth for which broker error codes must bypass re-login. Add new codes here as they're discovered. Upstox's nightly 00:00–05:30 IST funds + place-order window is the current motivating case.

**"Update Investment" alert → auto-open contract (2026-08-11)**: when `isSubscriptionAmountError` fires, `RebalanceAdvices.js` shows the "subscription amount is not set or may have been cleared" alert whose **Update** button navigates to `AfterSubscriptionScreen` with `openModifyInvestment: true`. The screen consumes that param and auto-opens the **Update Investment Amount** modal once `strategyDetails` + the authenticated `user_broker` have loaded; optional rebalance history does not block it (one-shot `useRef` guard — fires once per navigation, never re-opens on dismiss). The broker gate prevents slow profile loading—more visible on iOS—from querying with an empty broker or writing to the former `DummyBroker` fallback, which left the real broker amount unset and repeated the rebalance alert. The lookup reruns when the broker arrives, writes require the real broker, and model ID resolution tolerates incomplete rebalance history. The persistent action footer uses the native bottom safe area so it stays above iOS and Android system navigation. Button + modal header are labelled **"Update Investment Amount"** (renamed from "Modify Investment" for clarity).

### Wire-up points for `detectTransientOrderWindowError`

Both all-orders-failed sites run the transient detector **before** rendering the internal failure modal so the customer sees a soft toast instead of the scary all-failed UI during a documented service window:

| Site | File | Trigger | On transient |
|---|---|---|---|
| Bespoke / MP rebalance via `rebalance/place-rebalance-order` | `src/components/AdviceScreenComponents/RebalanceModal.js` (right before the `if (allOrdersFailed && backendOrderErrors.length > 0)` block) | `detectTransientOrderWindowError(response?.data)` returns non-null | `Toast.show({ type: 'info', text1: 'Broker service window', text2: <msg> })`, close modal, call `getRebalanceRepair()` + `getModelPortfolioStrategyDetails()`, return. |
| MP subscription order placement via `api/model-portfolio-place-order` | `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` (before the `if (allOrdersFailed)` early-exit) | same | same toast, `enrollStatusCheckQueue()` (async reconciliation), `onCloseReviewTrade()`, return. |
| Fyers publisher path (post-SDK) | `MPReviewTradeModal.js` around the second `allOrdersFailed` block | **intentionally not wired** | Publisher-SDK responses have a different shape, and the status-recording chain (`rebalance/record-publisher-results`, `rebalance/update/subscriber-execution`, `rebalance/add-user/status-check-queue`) must run even on failure so later reconciliation can pick it up. |

## RebalanceCard Execution Status Guard

**File:** `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`

Each rebalance card derives its button state from the user's execution record in `latestRebalance.subscriberExecutions`. A critical guard (`hasExecutionRecord`) prevents phantom action buttons:

```
userExecution = subscriberExecutions.find(e => e.user_email === userEmail)
hasExecutionRecord = !!userExecution

// All status booleans require hasExecutionRecord to be true:
isRebalanceExecuted    = hasExecutionRecord && status === 'executed'  && brokerMatches
isPartiallyExecuted    = hasExecutionRecord && status === 'partial'   && brokerMatches
isPendingVerification  = hasExecutionRecord && status === 'pending'   && brokerMatches
```

**Button behavior when `!hasExecutionRecord`:**
- Button is **disabled**
- Label shows "No rebalance pending"
- Prevents phantom "Accept Rebalance" that appeared when broker dropdown was switched to a broker without an execution record

**Bug this fixed (4c869c7):** When `userExecution` is `undefined`, `undefined?.status !== 'executed'` evaluates to `true`, causing the repair-mode branch to activate and display a clickable "Accept Rebalance" button that would fail on interaction.

## DummyBroker Status Update Retry

**File:** `src/components/AdviceScreenComponents/DummyBrokerHoldingConfirmation.js`

After DummyBroker trade recording (POST `/rebalance/process-trade`), the component updates the subscriber-execution status to "executed" via:

```
PUT {ccxtServer}/rebalance/update/subscriber-execution
Body: { userEmail, modelName, model_id, executionStatus: 'executed', user_broker: 'DummyBroker' }
```

If this PUT fails, the component retries once after a 2-second delay. If the retry also fails, it shows a Toast error: "Status update failed. Rebalance recorded but status may be stale. Pull to refresh."

**Why**: The backend may be slow under load. Without the retry, a successful trade recording could leave the execution status stuck at "pending", making the RebalanceCard continue to show an action button despite trades already being placed.

## Parity with Web App

The rebalancing flow in this mobile app mirrors `prod-alphaquark-github`:
- Same `buildBrokerPayloadFields()` function
- Same `rebalanceHelpers.js` utilities
- Same backend API endpoints
- Same decryption logic (`defaultDecrypt`)
- Same `hasExecutionRecord` guard logic in RebalanceCard (added 2026-04-05)

Differences:
- Mobile uses React Native modals, web uses React modals
- Mobile uses `react-native-toast-message`, web uses `react-hot-toast`
- Mobile fetches holdings via `fetchBrokerSpecificHoldings`, web may have different fetch patterns

## Array Mutation Safety Rule

**ALWAYS use spread copy before sorting state-derived arrays:**

```js
// WRONG — mutates state object in-place, causes stale render bugs
const sorted = stateObj?.someArray?.sort((a, b) => ...)

// CORRECT
const sorted = [...(stateObj?.someArray || [])].sort((a, b) => ...)
```

Files fixed (2026-04-07):
- `AfterSubscriptionScreen.js:197-204` — `subscription_amount_raw` and `user_net_pf_model` sorts
- `ModelPortfolioScreen.js:182` — `rebalanceHistory` sort

## DDPI authorize-for-sell — `await getUserDetails` before reopening rebalance modal (2026-04-20)

### Empty manual-authorization retry is not alignment (2026-09-29)

`OtherBrokerModel.handleAcceptRebalance` recalculates after a portal broker
user confirms that the reviewed SELLs were authorized. Some Groww sessions can
return `{buy: [], sell: []}` when the customer checks the confirmation box but
the broker authorization was not actually completed. That response is
ambiguous: no broker execution or reconciliation evidence says that the
original SELLs filled.

The recovery request therefore tags its response with UI-only
`_sellAuthorizationRetry`, broker, model-name and model-id metadata. When that
tagged response has no orders, `RebalanceModal` renders **Sell Authorization
Still Pending**, explains that dependent BUYs remain unplaced, and excludes the
response from the `isAlreadyAlignedCalculation` auto-acknowledgement path. A
normal, portfolio-correlated zero-trade calculation without this recovery tag
remains authoritative and continues to render **Already Aligned**. The pending
state's **Retry Sell Authorization** action returns directly to the manual
authorization sheet.

The rebalance flow invokes `DdpiModal` / `AngleOneTpinModal` /
`DhanTpinModal` as broker-specific SELL-side prechecks where reliable status is
available. Fyers is broker-evidence-first: its SELL is submitted and
`FyersTpinModal` opens only after `SELL_AUTH_REQUIRED` or
`SELL_AUTH_REVOKED`. The modal fires `PUT /api/update-edis-status` and calls
`reopenRebalanceModal()` after successful authorization.

For Dhan, completion must refresh `/dhan/edis-status` before review reopens.
The fresh result is lifted into the parent state, and the gate checks only the
selected equity-delivery SELLs (symbol/ISIN plus sufficient approved quantity),
not `every()` holding in the customer's account. This prevents both stale-state
TPIN loops and unrelated unauthorized holdings blocking the current basket.

The Fyers `submit-holdings` HTML is mounted through the app-root
`PublisherWebViewOverlay`; the informational native Modal is hidden for that
browser session. This is required on Android so the CDSL TPIN field stays
visible, touchable and keyboard-focusable.

Before the 2026-04-20 fix (commit `a6bbeae`, ports web `e73bd81` Issue 3), the internal `getUserDetails()` call after the PUT was **fire-and-forget** — the reopened rebalance modal read pre-PUT `userDetails.is_authorized_for_sell=false` and re-triggered DDPI immediately, making the authorize-for-sell tick appear to not stick.

**Fix:** all 6 `handleProceed`-style callers in `src/components/DdpiModal.js` now `await getUserDetails()` before closing:

| Line | Function | Context |
|---|---|---|
| ~133 | `handleProceed` | main `DdpiModal` default export |
| ~1115 | `handleProceed` | `AngleOneTpinModal` (invoked from bespoke + rebalance SELL flows) |
| ~1339 | `handleProceed` | `DhanTpinModal` |
| ~1902 | `handleContinue` | `OtherBrokerModel` (add-to-cart flow) |
| ~1966 | `handleAcceptRebalance` | `OtherBrokerModel` (rebalance flow — direct relevance) |
| ~2540 | `handleProceed` | `FyersTpinModal` |

`src/screens/TradeContext.js:getUserDeatils` is already `async` with `await axios.get(...)`, so it returns a Promise — `await` at the DdpiModal call site now properly waits before `reopenRebalanceModal()` runs.

See `docs/BROKER_CONNECTION.md` → *DDPI authorize-for-sell* for the full rationale and `docs/CHANGELOG.md` entry `[3.8.6]` for the commit-scoped summary.

## Rebalance-flow broker-auth error detection — expanded keyword set (2026-04-20, via vansh merge)

`src/utils/rebalanceHelpers.js:isBrokerAuthError` — expanded the keyword set to catch broker-forwarded 401 patterns. Groww (migrated to approval-mode credentials per `[3.8.4]`) surfaces 401s as `"Please Login and Try Again (Error: 401)"`; the older keyword set missed this, so the rebalance flow rendered a dead-end "Unable to Rebalance" dialog instead of opening the `TokenExpireBrokerModal` reconnect path. Added: `please login`, `please re-login`, `login required`, `error: 401`, `401 unauthorized`, `token expired`. Imported via merge of vansh's `3d77710` on 2026-04-20.

## Closure-bound funds — inline `refreshBrokerStatus` pattern (2026-04-22)

Any handler that reads `funds` / `brokerStatus` from React closure immediately after a broker reconnect sees stale values. `TradeContext.setFunds` has committed, but the enclosing component hasn't re-rendered before the handler runs, so `isFundsErrorOrMissing(funds, brokerStatus)` returns `true` against the pre-reconnect `{status:1}` object while the connection is actually live. The observable symptom is the `TokenExpireBrokerModal` ("Authentication Required — Login to {broker}") re-popping on the very next user tap after a successful OAuth reconnect.

**Contract:** any code path that gates on `(funds, brokerStatus)` to open a broker-auth modal should fetch fresh state inline via a local `refreshBrokerStatus` helper instead of reading the closure value. The helper pattern (first introduced in `RebalanceCard.js`, now mirrored in `RebalanceAdvices.js`):

1. GET `api/user/getUser/{userEmail}` → `freshUserDetails`.
2. Call `fetchFunds(freshUserDetails.user_broker, ...)` inline with the just-fetched user object.
3. Return `{brokerStatus, broker, funds}` synchronously to the caller.
4. Caller reads `freshStatus.funds ?? funds` — network value wins, closure value is a fallback on fetch error only.

**Shared hook** (source of truth since [3.9.15]): `src/hooks/useRefreshBrokerStatus.js` — `useRefreshBrokerStatus(userEmail)` → `async () => ({brokerStatus, broker, userDetails, funds})`. New handlers must consume this hook instead of writing a local refresh helper.

**Known call sites applying this pattern:**
- `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` — `handleCheckStatus` + `handleCheckBroker` (fixed [3.9.11], refactored to shared hook [3.9.15]).
- `src/components/AdviceScreenComponents/RebalanceAdvices.js` — `handleAcceptRebalance` pre-check (fixed [3.9.14], refactored to shared hook [3.9.15]).
- `src/components/AdviceScreenComponents/AddtoCartModal.js` — `handleTrade` (basket flow, fixed [3.9.15]).
- `src/components/AdviceScreenComponents/StockAdvices.js` — `handleTrade`, `handleTradeBasket`, `handleSingleSelectStock` (bespoke flows, fixed [3.9.15]).

**Known remaining call sites with the same latent bug (not yet ported):** `UserStrategySubscribeModal.js:213`, `MPPerformanceScreen.js:640`, `BespokePerformanceScreen.js:548`, `IgnoreTradesScreen.js:1441`. Port the helper pattern if the modal-re-pop symptom recurs from any of those surfaces.

## Kotak NEO migration — rebalance auth-params shape (BACKEND, ccxt-india, 2026-04-27)

The 2026-04-22 Kotak NEO TradeAPI migration switched the connect flow to store **`apiKey` (UUID API access token)**, **`jwtToken` (view/session token)**, **`sid`**, **`serverId`** in the user document — retiring the legacy `consumerKey`/`consumerSecret` pair. Three downstream consumers in ccxt-india were missed during that migration and continued to map `apiKey → consumerKey` and `secretKey → consumerSecret` (where `secretKey` no longer exists → `None`). Result: rebalance Step 3 raised the user-facing alert

> Unable to Rebalance — You must provide a consumer key and a consumer secret to generate access token or provide an access token.

The error string is verbatim from `neo_api_client/brokers/kotak/kotak.py:99-103` — raised when `Kotak(...)` is instantiated with `access_token=None` AND `consumer_key=None`/`consumer_secret=None`.

### Patched in [3.9.35]

| File | What changed |
|------|--------------|
| `ccxt-india/apps/app_model_portfolio.py` § `normalize_credentials_for_broker` (Kotak branch) | Emits `apiKey` + `jwtToken` + `sid` + `serverId`; stops emitting `consumerKey`/`consumerSecret`. Feeds every rebalance broker class via `BrokerFactory.get_broker(...)`. |
| `ccxt-india/rebalancing/brokers.py` § `KotakBroker` | `__init__` reads `apiKey → self.access_token`, `jwtToken (or accessToken fallback) → self.view_token`. `_get_kotak_instance()` + `process_trades()` pass `access_token=` to `Kotak(...)` / `TradingLogicKotak(...)`. Dropped `consumer_key=`/`consumer_secret=` kwargs. |
| `ccxt-india/rebalancing/order_status_updater/order_book_factory.py` § `KotakBroker` | Same migration. Pre-fix gate raised `Missing required authentication parameters for Kotak` on every status refresh post-NEO; new gate is `if not self.access_token or not self.view_token or not self.sid` (serverId is optional — Kotak() class falls back to `"server1"`). |

### Auth-params shape contract (canonical, post-migration)

Anywhere ccxt-india constructs a Kotak rebalance/holdings/order-status client from a NEO-migrated user, it MUST source these four fields and pass through to `Kotak(...)` as shown:

```python
access_token = db_creds['apiKey']            # UUID API access token
view_token   = db_creds['jwtToken']          # view/session token (Auth header)
sid          = db_creds['sid']
server_id    = db_creds.get('serverId', '')  # may be empty for some account types

Kotak(access_token=access_token, view_token=view_token, sid=sid, server_id=server_id)
TradingLogicKotak(access_token=access_token, view_token=view_token, sid=sid, server_id=server_id)
```

DO NOT pass `consumer_key=`/`consumer_secret=` for NEO-migrated users — those kwargs trigger the SDK's old OAuth `_generate_access_token()` path which expects `developer.kotaksecurities.com/openapi/v1/oauth2/token`, an endpoint the new accounts can't authenticate against.

### Resolved follow-ups ([3.9.37], 2026-04-27)

The four un-migrated call sites originally listed as known follow-ups in `[3.9.35]` are now ported. See `docs/CHANGELOG.md` `[3.9.37]` for the full per-file diff, but in summary:

| File | What was patched |
|------|------------------|
| `ccxt-india/common/utils.py:418` (`Mapping.BROKER_AUTH_KEYS["Kotak"]`) | `["consumerKey","consumerSecret","jwtToken","sid","serverId"]` → `["apiKey","jwtToken","sid","serverId"]`. Schema source-of-truth for projection + validation. |
| `ccxt-india/portfolio/portfolio_all_brokers.py` § Kotak `get_holdings` | Projection + `Kotak(...)` construction migrated to NEO 4-arg shape. `apiKey` decrypted via `CryptoJSWrapper`. |
| `ccxt-india/portfolio/user/holding_allbroker_user.py` § per-user Kotak `get_holdings` | Same migration. Pre-fix code mislabeled `apiKey` as `consumer_key`. |
| `ccxt-india/portfolio/limit_order_status_update.py` § `get_order_status_kotak` | Unpack changed from 6-tuple → 4-tuple (`access_token`, `view_token`, `sid`, `server_id`). |

In addition, `[3.9.37]` patched a related decrypt-correctness bug in `ccxt-india/rebalancing/order_status_updater/status_update.py` § `_get_auth_keys` that became load-bearing once `BROKER_AUTH_KEYS["Kotak"]` introduced plaintext fields (`sid`, `serverId`) — narrowed the decrypt set from "everything except `jwtToken` / Angel One" to the four fields actually encrypted at rest (`apiKey`, `secretKey`, `consumerKey`, `consumerSecret`).

## Rebalance trade `variant` field — AMO vs REGULAR (2026-05-01)

Every trade in the rebalance payload sent to `rebalance/process-trade` (ccxt-india) now carries a `variant: "AMO" | "REGULAR"` string, computed at submit time on the frontend:

```js
variant = (!IsMarketHours() && allowAfterHoursOrders === true) ? "AMO" : "REGULAR"
```

- `IsMarketHours()` — `src/utils/isMarketHours.js`, 09:15–15:30 IST gate.
- `allowAfterHoursOrders` — from `appadvisors.allowAfterHoursOrders` / `featureFlags.allowAfterHoursOrders` via `ConfigContext`.

The field is **display-only** (no behavioural change to the placement payload — every supported broker auto-converts after-hours orders to AMO server-side anyway). It feeds the amber **AMO** pill rendered next to the status pill on each result card in `RecommendationSuccessModal`.

ccxt-india does NOT need to echo `variant` — the frontend looks up `variant` from its own outgoing trade list when the response item doesn't carry it (three-tier fallback: response field → outgoing payload match by symbol+tradeId+transactionType → default `"REGULAR"`).

See `docs/APP_ARCHITECTURE.md § 4.5.2 Trade variant field` for the full contract, fallback rules, and followups deferred to a later commit (explicit `orderVariety: "AMO"` in payload, pre-flight market-closed banner).

### Why the connect itself worked despite this

The connect route (`aq_backend_github/Routes/Broker/Kotak.js`) calls ccxt's `/kotak/login/totp` directly, which uses Kotak's new `/login/1.0/tradeApiLogin` endpoint and never goes through `normalize_credentials_for_broker`. That's why the bug-report screenshot showed a green "Kotak Broker Connected" card with cash + phone + PAN populated, but rebalance (which DOES go through the normalizer + `KotakBroker`) failed at Step 3.

## Kite Publisher polling fallback — WebView callback recovery (2026-05-12)

### Durable execution session before WebView open (2026-08-29)

The AlphaB2B, Markup, and Moneyman apps now fail closed before mounting the
Kite WebView. Stock/basket execution awaits the shared Node
`/execution-intent` acknowledgement with the exact top-level `attemptId` used
for record-back. Model Portfolio and initial allocation await the Python
`/rebalance/publisher/intent` response and require both the intent write and
durable reconciliation enrollment. No order is sent when either acknowledgement
is missing or reports a payload mismatch.

Mobile can await this boundary directly because its in-app WebView submission
does not depend on a transient browser popup gesture. Existing installed builds
remain accepted by the backward-compatible endpoints; historical orders without
a session continue through legacy reconciliation and are never inferred merely
from the absence of a new session.

Bespoke rebalance via Zerodha runs through Kite Publisher in a WebView. The expected flow is:

1. User completes Kite's hosted form
2. Kite redirects to a status URL
3. WebView intercepts the redirect → app sets `zerodhaStatus='success'`
4. `useEffect` watching `zerodhaStatus` fires the post-success ingestion chain (record-orders → DB update → events)

Step 3 can fail silently in three known scenarios:

- **Cross-domain intercept loss** — some Android WebView versions don't honor `shouldOverrideUrlLoading` for server-side 302s on URLs outside the configured `baseUrl` origin (the Kite SDK Referer-check workaround in `getPublisherWebViewBaseUrl` mitigates but doesn't eliminate this)
- **App backgrounded mid-flow** — user switches to Kite app to complete authentication; OS may suspend the WebView before the redirect lands
- **AsyncStorage race** — WebView callback fires before AsyncStorage has hydrated `zerodhaStockDetails`, causing `checkZerodhaStatus` to short-circuit and never re-run

The result is "WebView returned but app never noticed" — the user is left on the loading spinner with no status. Two recovery layers exist.

### Layer 1 — client-side order-book polling (shared hook)

Canonical implementation lives in `src/hooks/useKitePublisherPolling.js`. Constants are sourced from `PUBLISHER_POLL_CONFIG` in `src/utils/brokerPublisher.js` (single source of truth). Three consumers as of 2026-05-12: `RebalanceModal.js` (bespoke rebalance), `MPReviewTradeModal.js` (MP rebalance — added in Phase E), `ReviewZerodhaTradeModal.js` (stock-advice basket via Kite Publisher — added in Phase E). `AddtoCartModal.js` does NOT integrate the hook because its publisher path is dead code (the `setOpenZerodhaModel(true)` setter is never invoked from the cart flow; the cart routes all execution through the REST path).

```
POLL_INTERVAL_MS = 5000        // poll every 5s
POLL_TIMEOUT_MS  = 90000       // give up after 90s

startOrderPolling():
  // Capture baseline BEFORE the WebView opens, so any later order with an
  // ID not in the baseline is by definition a publisher-placed order.
  baseline = fetchOrderBook(broker, creds)
  baselineOrderIdsRef = Set(baseline.map(o => o.orderId))

  setInterval(POLL_INTERVAL_MS):
    if (publisherProcessedRef) { stopOrderPolling(); return }
    current = fetchOrderBook(broker, creds)
    newOrders = current.filter(o => !baselineOrderIdsRef.has(o.orderId))
    if (newOrders.length > 0):
      publisherProcessedRef = true     // guards against double-fire
                                       // with the WebView callback
      stopOrderPolling()
      setWebView(false)
      setZerodhaStatus('success')      // drives the same useEffect the
      setZerodhaRequestType('rebalance')// callback would have driven

  setTimeout(POLL_TIMEOUT_MS):
    if (!publisherProcessedRef):
      // 90s expired — fall through to success with no detected orders.
      // The status-check-queue (layer 2) catches anything that arrived later.
      setZerodhaStatus('success')
```

**Double-fire protection.** `publisherProcessedRef.current` is the gate. Either polling-detects-orders OR WebView-callback-fires sets it to `true`; the other path's setter then short-circuits. Without this guard, both the callback and the polling loop would race to call `setZerodhaStatus('success')` and `checkZerodhaStatus` could run the entire post-success chain twice (double DB writes, duplicate event emissions).

**Cleanup contract.** Polling timers MUST be cleared on:
- success path (whichever of the two recovery paths wins)
- timeout path
- modal unmount (the `useEffect` cleanup at L220-222 holds the contract)
- new submit (the next `startOrderPolling` call captures a fresh baseline)

### Layer 2 — server-side `status-check-queue` (all publisher consumers)

Enrolled by every publisher consumer in the post-success chain (or in the catch block if the publisher chain fails). Lives in ccxt-india.

```
POST /rebalance/add-user/status-check-queue
Body: { userEmail, modelName, advisor, broker }

Backend behavior:
  Enrolls the user in a periodic reconciliation job
  Job polls broker's order book + recent fills
  Updates traderecos / model_portfolio_user records when matches found
  Eventual consistency — typical delay 1-5 minutes
```

This layer always runs regardless of whether the client callback or polling fired. It's the last-resort safety net for cases where:
- both client recovery paths failed (e.g. user killed the app mid-WebView)
- orders were placed in Kite but client never received any signal

**Latency trade-off.** Layer 1 (client polling) detects placed orders within 5s of placement. Layer 2 catches everything else within 1-5 minutes. The combination gives sub-5s UX when client polling is present, and eventual consistency when it isn't.

### Consumers and their recovery posture (mobile, after Phase E 2026-05-12)

| Caller | Path | Client polling? | Server queue? | portfolioEvents on Zerodha success? | Variant tagged on publisher payload? |
|--------|------|-----------------|---------------|-------------------------------------|--------------------------------------|
| `RebalanceModal.js` | bespoke rebalance | ✅ via `useKitePublisherPolling` hook | ✅ | ✅ | ✅ |
| `MPReviewTradeModal.js` | MP rebalance | ✅ via hook (Phase E) | ✅ | ✅ (Phase C) | ✅ (Phase B) |
| `ReviewZerodhaTradeModal.js` | stock-advice basket via Kite Publisher (opened by StockAdvices) | ✅ via hook (Phase E) | ✅ (via backend record-orders) | ❌ (non-MP flow — uses `getAllTrades` + `updatePortfolioData` instead; `REBALANCE_EXECUTED` event semantically doesn't apply) | ✅ (Phase B — belt-and-braces tag at L420) |
| `AddtoCartModal.js` | cart-based execution | N/A — publisher path is dead code | ✅ (REST path) | ❌ (same rationale as ReviewZerodhaTradeModal) | N/A (publisher path unused) |

**Phase B / C / E rollout summary:**
- Phase A (2026-05-12) — docs alignment, `BASKETS_ARCHITECTURE.md` corrections, this section created
- Phase B (2026-05-12) — variant threading in five publisher-using mobile callers
- Phase C (2026-05-12) — `portfolioEvents.emit` added to MP Zerodha publisher success path
- Phase D (2026-05-12) — `PUBLISHER_POLL_CONFIG` single source of truth in `brokerPublisher.js`
- Phase E (2026-05-12) — `useKitePublisherPolling` shared hook; RebalanceModal refactored to use it; MPReviewTradeModal + ReviewZerodhaTradeModal added as new consumers; GTT-in-publisher silent-failure guard in `StockAdvices.js` (Zerodha branch falls through to REST when basket contains GTT orders)

### Cross-references

- Failure-mode taxonomy: `docs/BASKETS_ARCHITECTURE.md § 9 — WebView callback missed`
- Server-side reconciler architecture: `docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 9 — Refresh & Status Polling`
- Symbol conversion + market protection helpers: `src/utils/brokerPublisher.js`
- WebView baseUrl rationale (why we can't use `REACT_APP_BROKER_CONNECT_REDIRECT_URL`): `getPublisherWebViewBaseUrl` JSDoc in `brokerPublisher.js`

### Canonical Publisher item construction (2026-08-28)

The two rebalance consumers (`RebalanceModal.js` and
`MPReviewTradeModal.js`) no longer maintain private Zerodha product/order-type
mappers. After each flow resolves its derivative symbol, exchange, lot-adjusted
quantity, LTP and tag, it passes those values as overrides to
`brokerPublisher.convertToBasketItem()`. The shared converter is the final
payload authority and enforces `NRML` for `NFO`/`BFO` carry-forward orders.
Sell-first/buy-next queueing, fill confirmation, funds refresh and batching are
unchanged and remain owned by the rebalance screens.

## Two-phase Zerodha publisher (sells-first) + confirmed-fill gate (updated 2026-08-12)

**Port of web Fix C + the §16.ac terminal-batch gate** (`prod-alphaquark-github` `docs/MODEL_PORTFOLIO_ARCHITECTURE.md` §16.3/§16.7/§16.ac). Before this change the mobile Kite Publisher path built **one** basket with BUY and SELL legs mixed (`RebalanceModal.js` and `MPReviewTradeModal.js` → `generateHtmlForm` → a single POST to `kite.zerodha.com/connect/basket`). A rebalance that sells and buys in the SAME basket bounces every buy on "insufficient funds" because sell proceeds aren't usable as margin in the same instant (web fixed this 2026-06-24; mobile never got it).

**Change (mirrors web `brokerPublisher.js` Fix C):**

1. `createBatches(stockDetails, broker, separateSellsFromBuys=true)` now splits legs into `[sellBaskets..., buyBaskets...]` (a batch never mixes the two), instead of only slicing by `maxBasketSize`. Signature is backward-compatible — the third arg defaults to `false`, preserving the existing size-slice behaviour for callers that pass two args (advice baskets, where leg order is intentional).
2. `RebalanceModal.js` + `MPReviewTradeModal.js` submit the **first** basket (sells) via the WebView. A publisher redirect or detected order merely starts verification; it does not unlock buys. The app polls the fresh broker order book until every expected SELL symbol and quantity is fully `COMPLETE`/`TRADED`/`FILLED`. Open, pending, partial, rejected, cancelled, missing, and timed-out sells keep the BUY step closed.
3. After every sell is complete, the app refreshes Zerodha funds and compares live available cash with the cost of every remaining protected BUY limit. Enough cash opens the next BUY basket automatically. Missing prices, an expired broker session, or an unreadable funds response remain hard verification stops and are never described as T1.
4. A verified cash shortfall after completed sells is treated as a possible settlement-timing condition, not as proof that the allocation is wrong. The customer sees available cash, required buying power, and three choices: **Check again**, **Stop and review**, or **Continue with buys**. Continuing sends the approved BUY baskets to Zerodha; Zerodha may accept the currently funded legs and reject the rest. Authoritative record-back preserves rejected/missing quantities for Repair after settlement. The app does not claim that every such shortfall is definitely T1.
5. Only the **terminal** basket's success closes the WebView and runs record-back (`checkZerodhaStatus` → `/api/zerodha/publisher/record-orders` with the full leg list). `handlePublisherClose` wipes the queue so a cancelled run cannot replay.

**Scope:** Zerodha Kite Publisher execution in the two MP rebalance consumers
only (`RebalanceModal.js`, `MPReviewTradeModal.js`). Direct-API brokers continue
through backend `process-trade`; they do not use this WebView/order-book dialog.
The frozen plan emits sells before buys for those brokers, but a universal
cross-broker wait-for-fill-and-refresh-margin contract is separate backend work.
`ReviewZerodhaTradeModal.js` (advice basket) and `AddtoCartModal.js` (dead
publisher path) are deliberately untouched—advice baskets keep leg order,
matching web.

**Files:** `src/utils/brokerPublisher.js` (`createBatches`), `src/components/AdviceScreenComponents/RebalanceModal.js`, `src/components/ModelPortfolioComponents/MPReviewTradeModal.js`.

## Known pitfalls — MPReviewTradeModal.js `placeOrder` error-handling (2026-05-06)

`MPReviewTradeModal.js:placeOrder` is an `async` function called without `await` or `.catch()` from the Place Order button's `onPress`. Any unhandled exception inside `placeOrder` that occurs before `setLoading(true)`, or any exception that escapes the try-catch, becomes a silent promise rejection — `setLoading(false)` never fires, the spinner sticks forever, and no HTTP request reaches the server.

**Guard rule**: the `try {` block MUST immediately follow `setLoading(true)`. Do not add synchronous setup code between `setLoading(true)` and `try {`; if new pre-flight logic is needed, add it inside the existing try block. The catch block's FIRST statement must remain `setLoading(false)`.

This was the root cause of the "Place Order stuck forever" regression confirmed on Axis Securities and Dhan (2026-05-06). Nginx logs showed zero `okhttp` requests for `/rebalance/process-trade` — the request never left the device. Fixed by moving `try {` from line 429 to line 319 (immediately after `setLoading(true)`). See `docs/CHANGELOG.md — 2026-05-06` for the full commit description.

### Future Kotak credential-shape changes

Treat any change to `BrokerKeysSchema["Kotak"]`, `normalize_credentials_for_broker` Kotak branch, or the `KotakBroker` constructors in `rebalancing/brokers.py` / `rebalancing/order_status_updater/order_book_factory.py` as a **fan-out change** — same class as the env-var guardrail in `CLAUDE.md` § "Shared env vars across brokers — BLOCKING GUARDRAIL". Grep all four follow-up files above before merging; Python's `dict.get('<key>')` returns `None` silently so there's no compile-time signal that a downstream consumer fell off the migration.

## Rebalance plan freeze — mobile parity port (2026-07-24)

Server-side rebalance plan freeze (canonical design: `prod-alphaquark-github/docs/REBALANCE_PLAN_FREEZE_PLAN.md`) shipped on web in 2026-07 (`UpdateRebalanceModal.js` §4.4/§4.5, `UserStrategySubscribeModal.js` commit `a4cb3c23`). `/rebalance/calculate` additively returns `plan_id`/`plan_version`; forwarding them on `/rebalance/process-trade` makes ccxt execute the server-frozen, re-validated plan instead of trusting client-posted `trades`; a guard failure returns HTTP 409 `{status:3, code, recompute:true, message, results:[]}`. This app had **zero** freeze wiring before this port (verified: no `rebalanceFreezePlan`/`repairFreezePlan` flags, no `plan_id` forwarding, no 409 handling anywhere in `src/`).

**Two new ConfigContext flags** (`src/context/ConfigContext.js`, same `parityFlagsPromise` + `newConfig` + AsyncStorage-persist pattern as `kycBlockingEnabled`/`useSharedAngelOneKey`): `rebalanceFreezePlan` and `repairFreezePlan`, both `=== true` gated (DEFAULT OFF — a missing/failed `/api/admin/frontend-config` fetch leaves both off, byte-identical legacy payloads). Exact key names confirmed against `aq_backend_github/Routes/Admin/loginRoutes.js` (`rebalanceFreezePlan: (platformSettings?.rebalance_freeze_plan === true) || (advisorConfig?.rebalance_freeze_plan === true)`, `repairFreezePlan` two-lever OPT-OUT shape) on `ssh tidi` 2026-07-24.

**Every mobile surface that POSTs `/rebalance/process-trade` with legs sourced from a `/rebalance/calculate` response** now forwards `plan_id`/`plan_version` when the flag is on and the field is present (never otherwise — byte-identical to the pre-port payload):

| Surface | File | Repair-aware? |
|---|---|---|
| Deep-link rebalance review→execute | `src/screens/Rebalance/RebalanceReviewScreen.js` (captures `plan_id`/`plan_version` from calculate) → `src/screens/Rebalance/ExecutionStatusScreen.js` (forwards, gated `rebalanceFreezePlan`) | No (this flow has no repair source) |
| First-time subscribe (Model Portfolio initial investment) | `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js` — Fyers direct, main token-broker `placeOrder`, and the persisted `additionalPayload` feeding the Zerodha WebView-completion `process-trade` call | No — `matchingRepairTrade` in this file is unreachable dead code (`getAdditionalPayload` is defined but never called) |
| Advice-list "Update Rebalance" (subsequent rebalance + repair retries) | `src/components/AdviceScreenComponents/RebalanceModal.js` | **Yes** — `matchingRepairTrade.planId`/`.planVersion` (camelCase; stamped by ccxt's `/rebalance/get-repair` Phase 3 P3.0 mint, gated `repairFreezePlan`) vs `calculatedPortfolioData.plan_id`/`.plan_version` (snake_case; gated `rebalanceFreezePlan`) — the existing `matchingRepairTrade` branch in `getAdditionalPayload()` already decided repair-vs-fresh, so the plan_id choice rides the same branch ("approve what you see": a fresh calculate's legs never carry a stale repair plan_id, and vice versa) |
| Model-portfolio detail screen "Review Trade" (subsequent rebalance) | `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` | No — no `modelPortfolioRepairTrades` prop in this modal |

**Zerodha and Fyers "Publisher" flows are split by mechanism, not by broker name** — this app's Zerodha flow varies by call-site: `RebalanceModal.js`/`MPReviewTradeModal.js`'s Zerodha path is a genuine Kite Publisher (WebView basket → `api/zerodha/publisher/record-orders` reads the actual Kite order book back; no `process-trade` call, out of scope per the web design doc's Publisher exemption). `UserStrategySubscribeModal.js`'s Zerodha path, and every file's "Fyers" path, POST directly to `process-trade` (ccxt executes server-side via the stored broker token) — these DO carry `plan_id`/`plan_version` when the flag is on, same as any token broker. DummyBroker's "already aligned" (empty `trades`) auto-mark calls are left untouched (no money moves, nothing to freeze).

**409 recompute handling** (`{recompute:true}` — PLAN_DRIFTED / expired / ALREADY_CONSUMED, see PLAN_FREEZE doc §4.4): every wired call site's catch/error branch detects this shape BEFORE the generic error-toast logic and routes back to a fresh calculate instead of retrying with the now-dead `plan_id` (which would 409 forever): `ExecutionStatusScreen` shows a "Recalculate" CTA (no plain Retry) that emits `rebalancePlanRecompute` on the shared `EventEmitter` and pops back to `RebalanceReviewScreen`, which listens for that event and re-runs `calculateRebalance`; `UserStrategySubscribeModal`/`MPReviewTradeModal` flip back to their pre-confirm review step (`setConfirmOrder(false)` / re-invoke the `calculateRebalance` prop) whose existing "Confirm"/"Continue" button re-mints a fresh plan; `RebalanceModal` closes the rebalance modal and re-fetches repair/strategy data so the next open starts clean.

**Not wired (confirmed out of scope, no process-trade payload built from a calculate/repair response)**: `src/components/AdviceScreenComponents/DummyBrokerHoldingConfirmation.js` (DummyBroker, not money-moving — mirrors the web precedent), `src/utils/brokerPublisher.js` / `src/utils/tradeVariant.js` (pure helpers, build no payload), `src/services/ModelPortfolioService.js` (`processRebalanceTrade` is a generic pass-through — callers already own `plan_id` inclusion).
