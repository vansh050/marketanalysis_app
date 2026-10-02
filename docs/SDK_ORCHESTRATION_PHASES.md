# SDK Orchestration Phases — Sequenced Migration Plan

## 2026-09-29 work log — compact trade review

- The host review gives the trade rows the available height and moves optional
  funding explanation below them in the scroll region.
- Low-funds detail is collapsed behind an accessible disclosure; duplicate
  funding summaries were removed.
- Phase C must preserve an usable order list for long baskets. No public SDK
  API, rollout flag, or migration done-when changed.

## 2026-09-29 work log — Zerodha BUY continuation

- MARKET BUY legs are broker-priced before affordability refit, with the
  server calculate price retained as durable recovery fallback.
- BUY continuation is consumed only after Kite opens; refused/empty refits
  remain retryable and cannot collapse into Already Aligned.
- Removed the duplicate result modal that lacked the continuation callback.
- No public SDK API changed; Phase C must preserve this host-owned contract.

## 2026-09-28 work log — shared terminal classifier

Completed the RN/Flutter cross-broker status parity slice: both clients use one
row classifier, the Node compatibility boundary canonicalizes installed-client
responses, and ccxt polling delegates to production broker-book adapters.
Regression coverage pins COMPLETE fills, ICICI contradictory quantities, and
raw-status preservation.

## 2026-09-27 work log — verified-zero rebalance funding state

- Updated the host-owned `RebalanceModal`, `MPReviewTradeModal`, and
  `RebalanceReviewScreen` presentation of the canonical funding contract.
- A verified ₹0 broker balance shows the exact shortfall and Add Funds action;
  it cannot enter the available-funds recalculation or execution lanes.
- Non-zero server-fitted baskets preserve their existing continuation path.
- No SDK ownership, public API, rollout flag, or migration done-when changed.

## 2026-09-22 work log — RN sell-auth dispatch gate

- RN `executeAdvice` now resolves server-authoritative sell auth before an
  equity-delivery SELL.
- Host-owned reviews receive a typed failure instead of a hidden SDK modal.
- `RebalanceModal` clears loading on SDK rejection without replaying placement.
- Production trace confirmed the reported Groww attempt never reached Node or
  ccxt; SDK tests pin authorized dispatch and fail-closed behavior.

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

## Work log — 2026-08-28

Completed RN/Flutter durable acceptance/status/cancel for eligible API orders, queued/paused states, no blind retry, SELL-first model plans, and frozen-plan identity forwarding. Publisher stays separate.

## Work log — 2026-08-26

The legacy MP host now carries frozen identity into post-sell refit, accepts only
live or confirmed-fill fallback cash, and owns timed Repair reconciliation. No
public SDK contract changed. Phase-C MP migration must port these guards first.

> **Status**: drafted 2026-05-02. Companion to `SDK_ORCHESTRATION_VISION.md`,
> `SDK_ORCHESTRATION_AUDIT.md`, `SDK_ORCHESTRATION_CONTRACT.md`.
>
> **Numbering**: phases continue from existing track (Phase 3 = connect,
> Phase B = trade-exec mechanics). Orchestrator phases are **C** through **F**.
>
> **Done-when contract**: each phase has a hard "done-when" gate. A phase
> is incomplete if any item in its done-when list is unchecked, regardless
> of how much code shipped. Mirrors Phase 3's discipline.

---

## Pre-conditions (already in place)

- Phase 3 broker-connect SDK migration ≥ 95% (all 13 brokers route through
  SDK in default-on tenants; `SDK_LEGACY_FALLBACK` is empty).
- Phase B-1 trade-exec backend + SDK package landed (2026-05-01):
  - `aq_backend_github` `Routes/sdk/v1/orders/{place,status,book,cancel}`.
  - `@alphaquark/mobile-sdk` RN: `useExecuteTrades`, `useOrderBook`,
    `TradeReviewSheet`, `TradeResultModal`, `TradeExecutionProgress`.
  - Same surface in the Flutter SDK package.
  - Mint server `orders:read` + `orders:write` scopes whitelisted.
- `SELL_AUTH_ARCHITECTURE.md` canonical reference exists (per-broker
  matrix + `sell_auth_set_at` day-check helper).
- `SDK_ORCHESTRATION_*` doc trio drafted, reviewed, locked.

---

## Phase C — `executeAdvice` orchestrator (the central one)

**Goal**: app calls one SDK method per advice; SDK orchestrates broker
session + sell-auth + review + place + poll + result. Replaces 14 RN
callsites + 4 Flutter callsites with ~4 RN calls + ~1 Flutter call.

### Pre-conditions

- Phase D (sell-auth orchestrator) and Phase E (session validation
  sub-orchestrator) MUST land first. Phase C is the integration step
  that wires them together.
- Backend `/sdk/v1/orders/place` validated with B-1 smoke tests (already
  done).
- Mint server scopes `orders:write`, `orders:read`, `sell_auth:read`,
  `sell_auth:write`, `funds:read` whitelisted.
- `requireFunds` sub-orchestrator (CONTRACT § 6) ships as part of
  Phase C — it's an internal step, not a separate phase. Funds check
  is gated by `executeAdvice`'s `skipFundsCheck` opt.
- Backend connect-validation cleanup landed (the AUDIT § 5 gap —
  `/sdk/v1/connections/:broker/connect` should call ccxt validation
  before persist; small Phase 3 follow-up, can land independently).

### Deliverables

**SDK package** (`@alphaquark/mobile-sdk` — both RN + Flutter same commit cycle):

- `executeAdvice(advice, opts)` public method on `AqSdkClient`.
- `useExecuteAdvice()` hook (RN) / `executeAdviceStream()` (Flutter)
  for in-flight progress.
- Internal `OrchestratorEngine` that sequences sub-steps from § 6 of
  CONTRACT (validateBrokerSession → requireSellAuth → review widget →
  place → poll → result widget).
- `<TradeReviewSheet>` enhanced with orchestrator-driven props (was
  caller-driven in B-1).
- `<TradeResultModal>` enhanced with `presentResult` opt-in.
- Per-broker payload assembly moved into SDK — `buildBrokerPayloadFields`
  ports from app to SDK; legacy ccxt-direct call signatures preserved.

**Backend** (`aq_backend_github`):

- `/sdk/v1/orders/place` accepts new optional fields:
  `clientAdviceId` (idempotency), `presentationHints` (broker for
  publisher-flow detection), `subscriptionId` (MP allocation
  correlation).
- Idempotency-key handling via `clientAdviceId` — repeat call with the
  same ID returns the original result row set.

**Alphab2bapp (RN)**:

- 14 callsites refactored to call `client.executeAdvice(advice)` once.
  Per-callsite removal map:

  | Today | After Phase C |
  |---|---|
  | `StockAdvices.js:1619 → handleTradeNow → ReviewTradeModal → axios POST /orders/process-trade` | `client.executeAdvice({kind:'bespokeSingle', trade, adviceId, clientAdviceId})` |
  | `AddtoCartModal.js:640 → placeOrder → axios POST /orders/process-trade` | `client.executeAdvice({kind:'bespokeCart', trades, cartId, clientAdviceId})` |
  | `OrderService.js:53 → axios POST /orders/process-trade` | Deleted; helper retired. |
  | `IgnoreTradesScreen.js:560 → axios POST /orders/process-trade` | `client.executeAdvice({kind:'bespokeSingle', ...})` |
  | `RebalanceModal.js:466,1039,1395 → axios POST /rebalance/process-trade` | `client.executeAdvice({kind:'mpRebalance', modelId, uniqueId, trades, clientAdviceId})` (3 callsites collapse to 1 path) |
  | `MPReviewTradeModal.js:368,1334 → axios POST /rebalance/process-trade` | Same as above. |
  | `UserStrategySubscribeModal.js:454,690,1054 → axios POST /rebalance/process-trade` | `client.executeAdvice({kind:'mpInitialAllocation', modelId, uniqueId, trades, subscriptionId})` |
  | `ModelPortfolioService.js:110 → axios POST /rebalance/process-trade` | Deleted; service retired. |
  | `ExecutionStatusScreen.js:97-98 → axios POST /rebalance/process-trade` | Removed — orchestrator owns the status screen via `<TradeExecutionProgress>` + `<TradeResultModal>`. |
  | `DummyBrokerHoldingConfirmation.js:110 → axios POST /rebalance/process-trade` | `client.executeAdvice` with DummyBroker branch handled in SDK. |

- `RebalanceModal.js` (2650 → ~150 LOC) — most of the file deletes; what
  remains is the host review UI + the calculate-
  rebalance call. Trade execution flips to `executeAdvice`.
- `MPReviewTradeModal.js` (2151 → ~50 LOC) — replaced by
  `<TradeReviewSheet>` rendered by SDK orchestrator.
- `RecommendationSuccessModal.js` (1102 → 0 LOC, deleted) — replaced by
  `<TradeResultModal>` (when `presentResult: true`) or by host's
  rendering of `AdviceResult` (when `presentResult: false`).
  Until that migration lands, its OPEN-order Refresh action is delegated to
  `OrderService.refreshSingleOrderStatus`; the shared map includes DefinEdge
  and the request is tenant-scoped with `X-Advisor-Subdomain`. The SDK result
  widget must preserve those two guarantees when it replaces the host modal.
- `TokenExpireBrokerModal.js` (496 → 0 LOC, deleted) — orchestrator's
  session-validation sub-step handles token expiry inline.
- All sell-auth modals (`DdpiModal`, `AngleOneTpinModal`, `DhanTpinModal`,
  `FyersTpinModal`, `OtherBrokerModel`) — deleted; SDK `<SellAuthGate>`
  replaces (Phase D landing).
- Net deletion: ~6000 LOC of orchestration glue.

**tidi_new (Flutter)**:

- `RebalanceReviewPage.dart` `_executeOrders` flips to `client.executeAdvice`.
- `OrderExecutionService.dart` retired.
- `DdpiAuthPage.dart` retained briefly as a parity reference but routed
  internally via SDK widget tree post-Phase D landing.
- Net deletion: ~2000 LOC.

### Soak window

3 weeks dual-write (per VISION § 10). Per-tenant per-broker divergence
rate logged to `trade_dual_write_audit` Mongo collection. Default
SDK-shadow / legacy-active for the soak.

### Done-when

- [ ] All 15 RN callsites + all relevant Flutter callsites refactored. (Pass-2 corrected count: 4 bespoke + 11 MP = 15 URL constructs collapsing to 4 logical advice kinds.)
- [ ] Publisher pending-state (Zerodha `stockDetailsZerodhaOrder` + `zerodhaAdditionalPayload`, Fyers `stockDetailsFyersOrder`) migrated from AsyncStorage to backend DB or SDK-owned state — orchestrator's `<TradeExecutionProgress>` widget owns recovery on app-kill mid-WebView. The 2026-05-03 cross-cleanup patches in `RebalanceModal.js` are interim; Phase C deletes the AsyncStorage usage entirely.
- [ ] Publisher's submitted-but-not-yet-recorded state remains non-terminal:
      identity or `record-orders` transport failures render Pending and are
      reconciled from the broker order book, never rewritten as Rejected
      (host safety fix recorded 2026-07-27).
- [ ] Per-broker validation matrix passed for all 13 brokers in test
      tenant: BUY MARKET CNC during hours, BUY MARKET CNC after hours,
      cart of 3, MP rebalance basket (10+ trades), insufficient funds,
      unknown symbol, LIMIT at unreasonable price, cancel pending,
      order book read, mid-batch SDK auth expiry. (130 test runs.)
- [ ] Dual-write divergence rate < 0.1% on a representative tenant for
      14 trading days straight.
- [ ] No `OrchestrationError` of code `internal_error` reported in
      Sentry over the soak window.
- [ ] CONTRACT § 12 cross-platform parity rules confirmed via PR review.
- [ ] `REACT_APP_USE_SDK_EXECUTE_ADVICE` default flipped to `true` for
      one canary tenant; held for 1 week with no regressions.
- [ ] AUDIT § 1-§ 4 verdict columns updated to "MIGRATED".

### Rollback

`REACT_APP_USE_SDK_EXECUTE_ADVICE=false` flips per tenant via remote
config. Legacy ccxt-direct paths stay deletable-only-after Phase F.

---

## Phase D — `<SellAuthGate>` widget + `requireSellAuth` sub-orchestrator

**Goal**: collapse the 5-modal + 7-flag cascade into one SDK widget
modeled on Flutter's unified `DdpiAuthPage`.

### Pre-conditions

- `SELL_AUTH_ARCHITECTURE.md § 4 broker matrix` is the single source of
  truth for which brokers need DDPI vs TPIN vs EDIS, and what state
  flags + day-check semantics apply.
- Flutter `DdpiAuthPage.dart` reviewed as the design template.

### Deliverables

**SDK package**:

- `<SellAuthGate>` widget (RN + Flutter) with internal per-broker
  branches: Zerodha (`auth-sell` → WebView DDPI), Dhan
  (`generate-tpin` + `enter-tpin` → WebView), Fyers (`tpin` +
  `submit-holdings` → WebView), Angel One (`verify-dis` → optional
  CDSL form), special brokers (manual confirmation card).
- `requireSellAuth(brokerName, trades)` sub-orchestrator method called
  by `executeAdvice`.
- Cached `is_authorized_for_sell` lookup honoring `sell_auth_set_at`
  day-check.

**Backend**:

- `/sdk/v1/sell-auth/{check, prompt}` routes — proxy the per-broker
  ccxt verify-dis / edis-status / etc. through one SDK route shape.
- Mint server scopes `sell_auth:read`, `sell_auth:write` whitelisted.

**Alphab2bapp (RN)**:

- The 5 sell-auth modals (`DdpiModal`, `AngleOneTpinModal`,
  `DhanTpinModal`, `FyersTpinModal`, `OtherBrokerModel`) — deleted.
- The cascade booleans across `RebalanceModal`, `MPReviewTradeModal`,
  `RebalanceAdviceContent` — deleted.

**tidi_new (Flutter)**:

- `DdpiAuthPage.dart` retired in favor of SDK widget. (Flutter is
  already largely there — this lifts what's in the app into the SDK
  package.)

### Soak window

2 weeks. Sell-auth gate fires less frequently than trade-exec, so
shorter soak is acceptable.

### Done-when

- [ ] All 13 brokers validated through `<SellAuthGate>` with their
      legacy modal's behavior preserved (per-broker test plan).
- [ ] No regression in `is_authorized_for_sell` day-reset (the
      2026-05-02 fix).
- [ ] Zero "modal cascade" boolean references remaining in app code.
- [ ] AUDIT § 8 verdict updated to "MIGRATED".

### Rollback

`REACT_APP_USE_SDK_SELL_AUTH=false` keeps legacy modals. Until the
modals are deleted in Phase C+D combined cleanup, rollback is a flip.

---

## Phase E — `validateBrokerSession` + `reauth` orchestrator

**Goal**: SDK auto-handles session expiry mid-flow; explicit `reauth()`
exposed for ManageConnectionsModal.

### Pre-conditions

- Phase D landed (sell-auth gate in place — reauth flow may need to
  re-run sell-auth post-reconnect).
- Flutter `ReauthHelper.dart` reviewed as the design template.

### Deliverables

**SDK package**:

- `validateBrokerSession(brokerName) → SessionStatus` sub-orchestrator.
  Calls `/ccxt/<broker>/validate-session`; on `expired`, internally
  hands off to `reauth(brokerName)`; returns to caller only when
  `valid` or `unrecoverable`.
- `reauth(brokerName, opts)` public method. Pattern from Flutter's
  `ReauthHelper`: mark broker `expired` upfront, flip primary,
  silent-refresh (Groww), smart-reauth (ICICI/Upstox/Motilal/HDFC/Fyers),
  fall through to credential form / WebView (others).

**Backend**:

- No new routes required. Reuses Phase 3's `/sdk/v1/connections/*`
  surface and the smart-reauth `/api/<broker>/reauth-url` +
  silent-refresh `/api/groww/refresh-token` routes.

**Alphab2bapp (RN)**:

- `TokenExpireBrokerModal.js` (496 LOC) — deleted. Orchestrator handles
  inline.
- `ManageConnectionsModal.js` "Reconnect" tap → `client.reauth(broker)`
  instead of opening dispatch directly.
- `BrokerConnectModalDispatch.js` — retained but simplified; reauth
  branch retired.

**tidi_new (Flutter)**:

- `ReauthHelper.dart` — retired; SDK absorbs the orchestration.
- `ManageBrokersPage.dart` `_reconnectBroker` → `client.reauth(broker)`.

### Done-when

- [ ] `validateBrokerSession` proven across 13 brokers in test tenant.
- [ ] `reauth` paths: silent (Groww), smart (ICICI/Upstox/Motilal/HDFC/
      Fyers), and credential-form (others) all exercised.
- [ ] `mark expired before reauth` ordering preserved (Flutter pattern).
- [ ] `flip primary up-front` preserved.
- [ ] AUDIT § 6 verdict updated to "MIGRATED".

### Rollback

`REACT_APP_USE_SDK_REAUTH=false` keeps `TokenExpireBrokerModal` +
direct dispatch. Rollback is a flip.

---

## Phase F — Legacy deletion + `2.0.0` bump

**Goal**: delete the legacy code paths and bump SDK package versions to
`2.0.0` to signal the cutover.

### Pre-conditions

- Phases C, D, E all default-on for ALL tenants for at least 4 weeks.
- Zero `OrchestrationError(code: 'internal_error')` reports for 4 weeks.
- All AUDIT verdict rows for orchestrated flows read "MIGRATED".

### Deliverables

**Alphab2bapp (RN)**:

- All 13 legacy `BrokerConnectionModal/<Broker>ConnectModal.js` files
  deleted (per `BrokerConnectModalDispatch.js`'s `renderLegacyModal`
  switch).
- `BrokerConnectModalDispatch.js` itself retired — direct SDK call.
- `OrderService.js`, `ModelPortfolioService.js` (trade-exec parts),
  `ProcessTrades.js` (already deleted in Phase A) confirmation.
- All `REACT_APP_USE_SDK_*` flags retired.

**Backend**:

- `/api/process-trades/order-place` Node legacy route — deleted.
- Per-broker `/api/<broker>/place-orders` Node routes — deleted.

**ccxt-india**:

- Legacy `/orders/place` routes (pre-`/orders/process-trade`) — audit and
  delete.

**SDK packages**:

- Major version bump `2.0.0`. Public type exports finalized.
- Migration guide doc: `MIGRATING_TO_2.x.md`.

### Done-when

- [ ] All legacy files deleted with no rebuild errors.
- [ ] All consumer apps on SDK `2.x`.
- [ ] CHANGELOG entry tagged `BREAKING — Phase F cutover`.

---

## Cross-cutting concerns (apply throughout C–F)

### Work log — 2026-07-27

`StockAdvices` hardened the existing host-owned Zerodha Publisher lane while
Phase C remains incomplete: reactive/async account identity resolution and
non-terminal record failure semantics. No SDK method or cross-platform contract
changed; this is the behavior the future orchestrator must absorb.

### Work log — 2026-08-16

The active legacy basket lane added server lifecycle/range authorization at
card, REST and Zerodha Publisher handoff; EXIT bypass, explicit-priority sort,
and the one-Kite-window limit are now migration requirements. Phase C remains
incomplete and no done-when checkbox flips: the policy is still host-owned and
must move into `executeAdvice` without weakening the server final check. No SDK
or Flutter contract changed in this patch.

### Work log — 2026-08-17

The host-owned Zerodha lane fixed an invisible-Publisher regression: current
callers pass `isVisible` while the modal previously rendered only `visible`,
allowing reconciliation polling to run without showing Kite. The legacy host
now normalizes both props, fails WebView load errors as not-sent, and enforces
Publisher-only routing for recommendation and cart execution irrespective of
stale GTT flags. Phase C remains incomplete; no SDK/Flutter contract or
done-when checkbox changes, but the future orchestrator must preserve these
visibility, fail-closed and no-REST-fallthrough semantics.

### Work log — 2026-09-27

The host-owned rebalance lane added an explicit verified-shortfall choice:
customers with zero broker buying power can review the target stocks and ask
the broker to attempt the frozen BUY basket after a clear rejection warning.
The choice is server-authoritative, calculation-scoped, and audited in the
frozen plan; it does not rewrite verified cash or the investment target.
Phase C remains incomplete and no checkbox flips. The future orchestrator must
carry this as a typed funding decision distinct from both add-funds and
continue-with-positive-available-funds.

### Backwards-compatibility window

For each phase, legacy path stays deletable-only-after the NEXT phase's
soak completes. So Phase C's legacy path stays through Phase D's soak;
Phase D's stays through Phase E's; Phase F is the deletion phase.

### Per-tenant rollout (mirrors Phase 3)

Each phase's flag flips per-tenant via remote config. Pilot tenant →
3 representative tenants → all tenants. ~1 week between expansion steps.

### Cross-platform same-commit discipline

Every contract change ships in BOTH SDK packages (`@alphaquark/mobile-sdk`
RN + Flutter) in the same commit cycle. PR review checklist enforces.

### Doc-update gating

Every commit to an orchestrator surface in any of the 4 repos updates
VISION (if architectural), AUDIT (always — verdict rows + new files),
CONTRACT (if contract-affecting), and PHASES (always — work-log entry)
in the SAME commit. No exceptions.

### Sentry breadcrumb model

Every public orchestrator method adds a Sentry breadcrumb on entry +
exit (success / typed error). Internal sub-orchestrator transitions add
breadcrumbs at each step. When `internal_error` fires, the full
breadcrumb trail is on the report — no guessing.

---

## Estimate

Conservative, with discipline:

| Phase | Calendar weeks | Notes |
|---|---|---|
| Doc trio finalization | 1-2 | This work |
| Phase C | 6-8 | The big one. Includes per-broker validation matrix (130 test runs) and dual-write soak. |
| Phase D | 3-4 | Sell-auth widget + sub-orchestrator. Flutter ahead. |
| Phase E | 3-4 | Session validation + reauth lift. |
| Phase F | 2-3 | Cleanup + 2.0.0 bump. |
| Total | 15-21 weeks (~4-5 months) | Comparable to Phase 3 connect tempo. |

This assumes parallel work across SDK package + backend + both apps.
Doc-first discipline pays off in fewer regressions during soak —
Phase 3 had 5+ production regressions that traced to undocumented
gaps; this plan exists specifically to avoid that.

---

## What's NOT in this plan (deferred)

- Web frontend (`prod-alphaquark-github`) SDK lift — separate decision
  tracked elsewhere.
- Order-modify (price/qty update on pending order) — Phase G if user
  demand surfaces.
- Multi-leg / cover orders — out of MVP.
- Smart order routing — out of scope.
- Position management (intraday squaring off) — stays app-side.

---

## Cross-references

- Architecture: `SDK_ORCHESTRATION_VISION.md`
- Code walks: `SDK_ORCHESTRATION_AUDIT.md`
- API contract: `SDK_ORCHESTRATION_CONTRACT.md`
- Sell-auth: `SELL_AUTH_ARCHITECTURE.md`
- Phase 3 (template): `PHASE3_ARCHITECTURE.md`, `PHASE3_PROGRESS.md`
- Phase B-1 (foundation): `SDK_TRADE_EXECUTION_MIGRATION.md`

### 2026-08-15 legacy-lane safety patch

Before further SDK migration, the active legacy order entry points gained a
synchronous one-request-at-a-time latch. No phase boundary or SDK API contract
changed; this pins safe behavior during the migration window.

### 2026-08-18 legacy MP identity-correlation patch

The RN rebalance lane now derives plan and rebalance identity from one source
before any broker-specific branch. A fresh calculate response takes precedence
over a stale repair row; a repair identity is selected only for repair-built
data. Phase C must retain this invariant when the three legacy callsites
collapse into `executeAdvice`.
