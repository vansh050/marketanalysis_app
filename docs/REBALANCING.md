# Rebalancing Architecture

> **Last updated**: 2026-04-07

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

The rebalance flow invokes `DdpiModal` / `AngleOneTpinModal` / `DhanTpinModal` / `FyersTpinModal` / `OtherBrokerModel` as a SELL-side precheck. If the user hasn't authorized for sell on their broker, the modal fires a `PUT /api/update-edis-status` and calls `reopenRebalanceModal()` to return the user to the rebalance review.

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
