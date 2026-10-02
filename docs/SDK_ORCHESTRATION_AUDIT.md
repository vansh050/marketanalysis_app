# SDK Orchestration Audit — Per-Flow Code Walks

## 2026-09-29 Rebalance review layout audit

The host-owned `RebalanceModal` now reserves its flexible area for the trade
rows. Optional funding disclosures are list-footer content and the verbose
low-funds explanation is collapsed by default. The fixed action remains
reachable. Phase C's future TradeReviewSheet must retain this behavior for
large baskets; no SDK ownership or placement behavior changed in this slice.

## 2026-09-29 Zerodha continuation audit

The host-owned `RebalanceModal` now prices MARKET BUY legs before post-SELL
refit, preserves the priced durable attempt for recovery, and consumes a
continuation only after the Publisher surface opens. The result modal has one
owner (`RebalanceAdvices`); the nested callback-less copy was removed. These
guards remain required inputs to the future Phase-C orchestrator migration.

## 2026-09-28 cross-broker status audit

The Flutter and RN execute-advice clients formerly carried separate terminal
sets from their shared `order_status` modules. Those copies omitted broker
`COMPLETE` in Flutter and treated working broker words inconsistently in RN.
Both now call the shared evidence-aware classifier. The Node proxy additionally
projects canonical status for already-installed clients; raw persistence is
unchanged. ccxt status reads use the reconciliation adapters, fixing stale
Upstox and ICICI constructors and ICICI NSE/BSE lookup parity.

## 2026-09-27 verified-zero funding presentation

The host-owned rebalance review surfaces now consume the backend's additive
funding-consent options. A successfully verified zero broker balance remains a
calculated, non-executable result: the app shows target, available amount and
shortfall, offers only Add Funds, and never dispatches a zero-budget refresh or
an execution request. Non-zero fitted baskets retain the existing Continue
with available funds path. Ownership and SDK migration verdicts are unchanged.

## 2026-09-22 runtime correction: host-owned review + sell-auth

`AqSdkClient.executeAdvice` called `requireSellAuth` with `{}`. Groww SELL
rebalances therefore opened the SDK gate after the app had already validated
authorization; under `skipReview: true` it could be obscured by
`RebalanceModal`, leaving a spinner and sending no placement request. RN now
reads the authenticated sell-auth endpoint before dispatch and fails closed to
the host if needed. App SDK errors join the terminal handler and never fall
through to legacy placement.

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

## 2026-08-28 — Lost-response and async parity closure

RN, Flutter, AlphaB2B, and the Node SDK proxy agree on durable acceptance for eligible bespoke API orders and paused reconciliation for ambiguous placement. The legacy fallback is removed, rebalance helpers are SELL-first and frozen-plan metadata plus SDK request identity now reach CCXT.

## 2026-08-26 — Post-sell and Repair reconciliation audit

| Surface | Owner | Verdict |
|---|---|---|
| Frozen refit identity and cash usability | `RebalanceModal` host flow | Host-correct; migrate intact later |
| Repair review entry | `RebalanceCard` → `RebalanceModal` | Host opens frozen repair review directly after broker preflight; preference/holdings screens are not orchestration prerequisites |
| Pending/delay parsing and retry | `TradeContext` | Host-correct; additive backend contract |
| Reconciliation message | `RebalanceAdvices` | Host presentation; Repair stays hidden |

> **Status**: drafting (started 2026-05-02). Companion to
> `SDK_ORCHESTRATION_VISION.md` (north-star), `SDK_ORCHESTRATION_CONTRACT.md`
> (TS + Dart API surface), `SDK_ORCHESTRATION_PHASES.md` (sequencing).
>
> **Purpose**: walk every user-facing trading and broker-management flow
> in BOTH consumer apps (Alphab2bapp / RN, tidi_new / Flutter) step-by-step
> with file:line refs. Each flow's walk identifies: today's owner,
> vision-state owner, hidden coupling, and the per-step verdict
> (`stays-in-app`, `moves-to-sdk-orchestrator`, `moves-to-sdk-widget`,
> `moves-to-backend-route`).
>
> **Authorial discipline** (mirrors Phase 3 audit): every audit row is
> a literal trace of the actual code, not a summary. If a row reads
> "broker session is validated" without a file:line, that row is
> incomplete and blocks the next migration delta.
>
> **Audit-pass log**:
> - **2026-05-02 pass 1** — initial draft. 4 parallel exploration agents
>   walking bespoke (RN), MP (RN), connect/reauth (RN), all flows
>   (Flutter). Findings folded in below.
> - **2026-08-16 basket legacy-lane pass** — `StockAdvices`, BasketCard and
>   `ReviewZerodhaTradeModal` now consume a server lifecycle/range decision,
>   re-authorize at handoff and preserve explicit priority in one Kite window.
>   Phase C must absorb this policy; no SDK contract changed in this pass.
> - Future passes — date + commit hash here when re-audited.

---

## Index of flows

| # | Flow | RN (Alphab2bapp) | Flutter (tidi_new) | Section |
|---|---|---|---|---|
| 1 | Bespoke single trade | ✅ | ❌ (not implemented) | § 1 |
| 2 | Bespoke cart | ✅ | ❌ (not implemented) | § 2 |
| 3 | MP rebalance | ✅ | ✅ | § 3 |
| 4 | MP initial allocation (post-payment) | ✅ | ✅ | § 4 |
| 5 | Broker connect (fresh) | ✅ Phase 3 partial | ✅ Phase 3 partial | § 5 |
| 6 | Broker re-auth | ✅ legacy | ✅ smart-reauth + legacy | § 6 |
| 7 | Manage connections (list / disconnect / repair) | ✅ | ✅ | § 7 |
| 8 | Sell-auth gate (DDPI / TPIN / EDIS) | ✅ scattered across modals | ✅ unified DdpiAuthPage | § 8 |

---

## Per-step verdict legend

For each numbered step, an inline tag indicates the migration target:

- `[STAY]` — stays app-side forever (e.g. tenant business config, payment, navigation).
- `[ORCHESTRATOR]` — moves into an SDK orchestrator method (`executeAdvice`, `connectBroker`, `reauth`, etc.).
- `[SDK-WIDGET]` — moves into an SDK-rendered widget (review sheet, sell-auth prompt, result modal, etc.).
- `[BACKEND]` — moves into a new `/sdk/v1/...` backend route.
- `[GONE]` — gets deleted entirely (orchestrator subsumes the step; no replacement needed).

---

## § 1 Bespoke single trade — Alphab2bapp (RN)

> Drawn from the bespoke-RN audit agent's findings, 2026-05-02. Phase A shipped 2026-05-01 — direct ccxt is the path; Node fallback gated by `REACT_APP_BESPOKE_DIRECT_CCXT_FALLBACK`.

### Files involved

- `src/components/AdviceScreenComponents/StockAdvices.js:1619` — entry (`handleTradeNow`)
- `src/components/ReviewTradeModal.js:1057` — review modal `onPress → placeOrder`
- `src/services/OrderService.js:53` — direct-ccxt helper
- `src/screens/Drawer/IgnoreTradesScreen.js:560` — IgnoredAdvices→trade variant
- `src/components/AdviceScreenComponents/DummyBrokerHoldingConfirmation.js:110` — DummyBroker variant
- `src/utils/brokerSessionUtils.js:81` — `validateBrokerSession`
- `src/utils/rebalanceHelpers.js:141` — `classifyFundsResponse`
- `src/utils/SecurityTokenManager.js:109` — JWT signing
- Per-broker gate modals: `DdpiModal.js`, `AngleOneTpinModal.js`, `DhanTpinModal.js`, `FyersTpinModal.js`, `OtherBrokerModel.js`, `TokenExpireBrokerModal.js`, `BrokerSelectionModal.js`

### Step trace

1. **[STAY]** User taps "Trade Now" → `handleTradeNow()` (StockAdvices.js:1619). Sets `stockDetails`, opens `ReviewTradeModal`.
2. **[ORCHESTRATOR + SDK-WIDGET]** Angel One surveillance pre-check (ReviewTradeModal.js:83-120) — POST `/angelone/equity/surveillance`. Today: app-side. Tomorrow: SDK orchestrator step (only relevant if broker = Angel One; today inline in modal mount).
3. **[STAY]** User confirms review modal.
4. **[ORCHESTRATOR]** Market-hours gate + variant detection (`computeTradeVariant`, line 650). Today: helper inline. Tomorrow: orchestrator infers variant.
5. **[ORCHESTRATOR]** `validateBrokerSession(broker, jwtToken, {checkFreshness: true})` (line 641). Today: app util. Tomorrow: orchestrator sub-step.
6. **[ORCHESTRATOR]** `classifyFundsResponse(funds, brokerStatus, broker)` (line 388) — TRANSIENT / NOT_CONNECTED / OK. Today: app util. Tomorrow: orchestrator sub-step.
7. **[ORCHESTRATOR + SDK-WIDGET]** Per-broker modal cascade (lines 402-470) — Zerodha → DdpiModal if SELL/MIXED + `ddpi_status` invalid. Angel One → AngleOneTpinModal if `edisStatus !== true`. Dhan → DhanTpinModal if not all holdings have `edis: true`. Special brokers (IIFL, ICICI, Upstox, Kotak, HDFC, AliceBlue, Motilal, Groww) → OtherBrokerModel if rejectedSellCount=1. Today: 5+ separate modals + booleans. Tomorrow: SDK `<SellAuthGate>` widget (Flutter's unified shape).
8. **[BACKEND]** POST `${ccxtServer}orders/process-trade` (line 751) with `aq-encrypted-key` header. Body: `{trades: [{...trade, variant, clientTradeId}], user_broker, user_email, accessToken}`. Timeout 120s. Today: direct app call. Tomorrow: SDK calls `/sdk/v1/orders/place` (already shipped B-1).
9. **[ORCHESTRATOR]** Fallback to legacy Node `${server}api/process-trades/order-place` on 5xx/network (lines 781-796). Today: gated by env. Tomorrow: SDK absorbs the retry logic; the env flag retires.
10. **[SDK-WIDGET]** Per-broker post-placement Zerodha Publisher path (lines 1015-1161) — validate exchanges, build Kite basket, market-protection 1% buffer for GSM/T2T/BE, generate HTML form, open WebView, post-WebView record-orders. Today: app-screen-coupled WebView. Tomorrow: SDK orchestrator opens the WebView; host never sees the basket exception.
    - **2026-07-27 safety correction:** the host now re-resolves the account
      email immediately before `record-orders`. Once Kite Publisher has
      submitted, any identity/recording failure stays `pending`; it must never
      be converted into a synthetic broker rejection. Phase C must preserve
      this two-stage failure contract when ownership moves into the SDK.
    - **2026-08-16 basket policy correction:** before any basket REST or
      Publisher handoff, the host calls `/orders/basket-entry/authorize` with
      `(user_email,basketId)` and leg purpose; denied/stale/missing decisions
      fail closed, EXIT bypasses the entry range. Zerodha basket legs are
      sorted by explicit priority and more than ten legs are rejected rather
      than split. The future orchestrator must preserve these semantics and
      must not advertise Publisher fill-order guarantees.
    - **2026-08-17 visibility/routing correction:** both legacy callers pass
      `isVisible`, so the host now normalizes `visible ?? isVisible` before
      rendering either modal branch. Previously the hidden WebView still
      started its 90-second poll and could surface false pending. Zerodha is
      now Publisher-only even for GTT-flagged recommendations and cart
      execution; WebView load failures stop polling and fail as not sent.
11. **[ORCHESTRATOR]** Post-placement TPIN re-trigger (lines 878-889) — for sell/mixed with rejected≥1 + success=0, re-open broker's TPIN modal which re-calls `placeOrder` after auth. Today: 5-modal cascade with closure-bound stale state. Tomorrow: orchestrator-internal retry; host never sees the cascade.
12. **[SDK-WIDGET]** Success modal `RecommendationSuccessModal` (line 1102). Today: 1102-LOC component. Tomorrow: SDK `<TradeResultModal>` (already shipped B-1) when `presentResult: true`.
    - **2026-08-18 broker-confirmation correction:** OPEN-row refresh now calls
      the shared `OrderService.refreshSingleOrderStatus` path. Its canonical
      route map includes DefinEdge and its auth envelope includes
      `X-Advisor-Subdomain`; the former modal-local map omitted DefinEdge and
      silently made Refresh a no-op. Phase C's `<TradeResultModal>` must retain
      both broker-route coverage and tenant-scoped credential lookup.
13. **[STAY]** Holdings refresh side-effect (lines 897-908) — `updatePortfolioData()`, `getAllTrades()`, AsyncStorage clear cart, EventEmitter `cartUpdated`. Today: Promise.all in component. Tomorrow: host-app's `onTradePlaced` hook fires; host owns refresh.

### Hidden coupling (must be addressed in SDK design)

- **EventEmitter** (`src/components/EventEmitter.js`) — 6 events involved: `cartUpdated`, `stockRemoved`, `GetAllTradeReferesh`, `MODAL_STATE`, `OpenTradeModel`, `stockAction`. Unstructured plain-string keys; risk of typos. SDK should NOT depend on these.
- **AsyncStorage keys**: `cartItems` (cart persistence), `storedTradeType` (composition), `rejectedCount${broker}` (per-broker daily counter, reset 00:00 IST via `rejectedOrdersResetTime`), `stockDetailsZerodhaOrder` + `additionalPayload` (Zerodha publisher pending state), `openDhanPopup` (Dhan TPIN trigger). SDK owns its own state; doesn't read AsyncStorage.
- **Closure staleness**: `placeOrder` reads `broker` from closure; if user switched brokers between render and trade-attempt, stale value. AddtoCartModal mitigates with `refreshBrokerStatus({forceNetwork: true})` (line 379); StockAdvices doesn't always.
- **isReturningFromOtherBrokerModal flag** (line 638) — manual gate-skip on retry; manually cleared (line 1789). Brittle.
- **Zustand `useLTPStore`** — live LTP read in handleFixSize/handleZerodhaRedirect; if WebSocket stalls, falls to 0/cached.
- **`useModalStore`** — global broker-reconnect modal trigger from anywhere in the tree.

---

## § 2 Bespoke cart — Alphab2bapp (RN)

> Drawn from the same audit agent. Cart is structurally identical to single-trade post-entry; documented diffs only.

### Files involved

- `src/components/AdviceScreenComponents/AddtoCartModal.js:59` — modal entry, `placeOrder` at line 640.

### Diff vs § 1 (single-trade)

1. **[STAY]** Cart assembly is AsyncStorage-backed (lines 156-245). `cartItems` key. Stocks added via `handleSingleSelectStock()` in StockAdvices. EventEmitter `stockRemoved` keeps cart and screen in sync. **Not orchestrator concern.**
2. **[STAY]** `getCartAllStocks()` (line 522-567) classifies allBuy / allSell / isMixed; persisted to `storedTradeType`. **App keeps this — feeds the orchestrator's input.**
3. **[ORCHESTRATOR]** Same broker session + funds + sell-auth gates as single-trade.
4. **[ORCHESTRATOR]** Special-broker pre-gate (lines 725-744) — non-FNO + special-broker + sell/mixed + rejectedSellCount=1 → OtherBrokerModel. `isReturningFromOtherBrokerModal` flag skips re-pop on retry. Today: app-internal. Tomorrow: orchestrator-internal sub-orchestrator step.
5. **[BACKEND]** Same POST to `/orders/process-trade` with `clientTradeId` per trade (line 765-768).
6. **[ORCHESTRATOR]** Cart-specific Dhan CDSL/EDIS post-rejection check (lines 832-844) — error message contains "cdsl" / "edis" / "tpin" / "validate qty" → DhanTpinModal. Today: per-broker ad-hoc check. Tomorrow: orchestrator's broker-error-classifier.
7. **[STAY]** Cart clearing on success (lines 473-485, `clearCart`) — emits `GetAllTradeReferesh`, clears local + AsyncStorage. Host-app territory.

### Verdict

Cart and single-trade collapse to **one orchestrator method** (`executeAdvice` with `kind: 'bespokeCart' | 'bespokeSingle'`). The cart's hidden complexity is mostly in cart MAINTENANCE (add/remove/persist), not in execution — and maintenance stays app-side. Execution is identical to single-trade.

---

## § 3 MP rebalance — Alphab2bapp (RN)

> Drawn from the MP-RN audit agent's findings, 2026-05-02. Most complex flow in the app.

### Files involved

- `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js:752-795` — entry tap; `handleChangeCheck`, `handleCheckStatus`, `classifyFundsResponse`.
- `src/components/AdviceScreenComponents/RebalanceModal.js` (2650 LOC) — pre-order checks (553), DummyBroker auto-mark (438-504), Zerodha publisher (635-974), Fyers publisher (977-1211), direct-broker `placeOrder` (1215-1790).
- `src/components/AdviceScreenComponents/RebalanceAdviceContent.js:156-165, 224` — EventEmitter `closeBrokerRelatedModals`, `refreshEvent` listeners.
- `src/components/ModelPortfolioComponents/MPReviewTradeModal.js:91-142, 305-338, 420-685, 784-998` — surveillance, EDIS pre-check, placeOrder, Zerodha publisher.
- `src/services/ModelPortfolioService.js:110` — separate /rebalance/process-trade callsite.
- `src/screens/Rebalance/ExecutionStatusScreen.js:97-98` — separate /rebalance/process-trade callsite.

### Step trace

1. **[STAY]** User taps "Accept Rebalance" / "Repair Portfolio" on RebalanceCard (line 752-795) → `handleChangeCheck()` (515) → opens RebalanceChangeDetailModal.
2. **[ORCHESTRATOR]** Repair-path GET `/rebalance/user-portfolio/latest/{userEmail}/{modelName}` (lines 201-226) for current holdings reconciliation. Today: app-side. Tomorrow: orchestrator fetches inline.
3. **[ORCHESTRATOR]** `handleCheckBroker` (line 553) → session validation, broker-connected check, funds classification, token-expired check. Today: 4 separate utility calls in handler. Tomorrow: orchestrator sub-step.
4. **[ORCHESTRATOR]** DummyBroker special path (lines 235-236, 438-504) — when `brokerStatus === 'Disconnected'`, manual edit + `openDummyBrokerConfirmation`. If `dataArray.length === 0`, auto-mark already-aligned: POST `/rebalance/process-trade {trades:[], user_broker:'DummyBroker'}`, PUT `/rebalance/update/subscriber-execution {status:'executed'}`, delayed 1.5s/4s/8s refresh. Today: branch in app. Tomorrow: SDK orchestrator handles DummyBroker as a no-op trade kind.
5. **[ORCHESTRATOR]** WebSocket LTP fetch (lines 342, 396, 409) via `useWebSocketCurrentPrice(wsSymbols)` + REST fallback `POST /angelone/market-data` + `/zerodha/convert-symbol`. Today: app-side hook. **Stays app-side per VISION § 13** — LTP is not orchestrator territory; the SDK accepts pre-resolved prices.
6. **[ORCHESTRATOR + SDK-WIDGET]** Pre-order EDIS/TPIN/DDPI gates (lines 1233-1282) — Dhan checks live `dhanEdisStatus.data.some(h.edis)`; Zerodha checks `canSellZerodha` (DDPI status); Angel One checks `ddpi_enabled || is_authorized_for_sell`; Fyers checks `is_authorized_for_sell`; special brokers check `is_authorized_for_sell`. Each fails → corresponding modal opens. Today: 5+ booleans, 5+ modals, app-coupled. Tomorrow: SDK `<SellAuthGate>` widget.
7. **[ORCHESTRATOR]** Per-broker payload assembly `getBasePayload + getBrokerSpecificPayload` (lines 1299-1357) — different per-broker credential fields. Today: 11+ branches inline. Tomorrow: SDK builder owns this.
8. **[BACKEND]** POST `/rebalance/process-trade` with full payload (lines 1380+). Today: direct ccxt. Tomorrow: SDK `/sdk/v1/orders/place`.
9. **[SDK-WIDGET + ORCHESTRATOR]** Zerodha publisher lane (lines 635-974): validate exchanges, POST `/api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`, AsyncStorage write `stockDetailsZerodhaOrder`+`zerodhaAdditionalPayload`, basket form to `kite.zerodha.com/connect/basket`, market-protection 1% buffer (line 702), order-book polling fallback every 5s for 90s (line 168-193), post-WebView record-orders chain (5 backend calls: record-orders → update/subscriber-execution → record-publisher-results → user-portfolio → status-check-queue). Today: 339-line state machine + WebView in app. Tomorrow: SDK orchestrator opens the WebView and chains the calls; host receives one terminal result.
10. **[SDK-WIDGET + ORCHESTRATOR]** Fyers publisher lane (lines 977-1211): same shape as Zerodha, separate POST chain.
11. **[ORCHESTRATOR]** Direct-broker `placeOrder` post-response (lines 1410-1789): session-expired branch (1424-1437), empty-results branch with cautionary-listing detection (1441-1497), CDSL/EDIS error branch (1577-1677), all-buy branch (1640-1655), special-broker branch with `isReturningFromOtherBrokerModal` flag (1636-1656), mixed/sell rejection re-trigger (1656-1677). Today: 7 branches, all app-side. Tomorrow: orchestrator's broker-error-classifier.
12. **[BACKEND]** Chained POSTs on success (lines 1691-1727): `/api/model-portfolio-db-update`, `/rebalance/add-user/status-check-queue`, EventEmitter HOLDINGS_REFRESH + REBALANCE_EXECUTED. Today: app-fired. Tomorrow: SDK fires; host receives terminal result with refresh hints.

### EDIS/TPIN cascade — the highest-leverage simplification

The cascade involves these state flags + checks across 3 files:

| Flag | Purpose | Set by | Read by |
|---|---|---|---|
| `showDdpiModal` | Zerodha DDPI gate | pre-order check | DdpiModal |
| `showAngleOneTpinModel` | Angel One TPIN gate | pre + post-order | AngleOneTpinModal |
| `showDhanTpinModel` | Dhan EDIS gate | pre + post-order, CDSL error detector | DhanTpinModal |
| `showFyersTpinModal` | Fyers TPIN gate | pre + post-order | FyersTpinModal |
| `showOtherBrokerModel` | Special-broker EDIS gate | pre + post-order | OtherBrokerModel |
| `allSellPre`, `isMixedPre` | Trade composition | derived in handler | every gate |
| `hasCdslError` | Error message scan | post-response classifier | re-trigger |
| `rejectedSellCount` | Per-row count | post-response classifier | branch selector |
| `successCount` | Per-row count | post-response classifier | branch selector |
| `isReturningFromOtherBrokerModal` | Skip re-pop on retry | OtherBrokerModel.onContinue | special-broker pre-gate |

**Re-trigger sequence**: user taps Place → pre-gate triggers modal → user authorizes via WebView → modal calls `PUT /api/update-edis-status` → `getUserDetails()` refresh → reopen RebalanceModal → user taps Place again → pre-gate now passes → POST `/rebalance/process-trade` → response may STILL have rejected SELL rows → post-gate re-triggers modal → repeat. Up to 4 round-trips per attempt.

**Per-broker dual EDIS source** is the trickiest part: `dhanEdisStatus.data.some(h.edis)` (live, per-session) vs `userDetails.is_authorized_for_sell` (DB flag, persists across sessions). Pre-order check uses live; post-order may still reject on session expiry. Same problem for Angel One: BOTH `ddpi_enabled` AND `is_authorized_for_sell` checked.

**SDK absorption**: this entire cascade collapses to one sub-orchestrator step (`requireSellAuth` per CONTRACT § 6) calling one `<SellAuthGate>` widget (modeled on Flutter's unified `DdpiAuthPage`).

### Hidden coupling

- **`portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH)`** + `eventEmitter.emit('OrderPlacedReferesh')` (lines 907, 910-918) — sister components subscribe to refresh. Move to host hook.
- **`useModalStore.openModal`** (line 89) — global broker-reconnect trigger.
- **AsyncStorage publisher pending state** — `stockDetailsZerodhaOrder`, `zerodhaAdditionalPayload`, `stockDetailsFyersOrder`. Read on mount to recover pending Zerodha redirect after app kill.
- **Socket.io live LTP** — `ccxtWs.baseUrl` for `market_data`. App-owned; SDK accepts pre-resolved prices.
- **Status-check-queue poller** — backend-side; polls broker order-book every N sec for terminal status. App refreshes via `/rebalance/user-portfolio/latest`.

---

## § 3.tidi MP rebalance — tidi_new (Flutter)

> Drawn from the Flutter audit agent's findings, 2026-05-02.

### Files involved

- `lib/components/home/portfolio/RebalanceReviewPage.dart` — entry, broker-connection check, sell-auth gate, review trades, execute.
- `lib/service/OrderExecutionService.dart` — backend call, exchange validation, batch handling, Zerodha/Fyers basket exception path.
- `lib/components/home/portfolio/DdpiAuthPage.dart` — unified sell-auth prompt; per-broker branches inside one widget.
- `lib/components/home/portfolio/BrokerSelectionPage.dart` — pre-execution broker picker (when none active).
- `lib/components/home/portfolio/ExecutionStatusPage.dart` — post-place status polling + Zerodha/Fyers basket WebView orchestration.
- `lib/service/AqApiService.dart` — `/rebalance/process-trade` POST helper.
- `lib/service/BrokerSessionValidator.dart` — `/ccxt/<broker>/validate-session` proxy.

### Step trace

1. **[STAY]** User opens `RebalanceReviewPage` from a portfolio home tab tap or rebalance notification — Flutter Navigator push.
2. **[STAY]** `_prepareRebalanceData()` (RebalanceReviewPage.dart ~line 600) loads the proposed trade list — pure app concern (it's the user's MP holdings + the calculated rebalance from `/api/rebalance/calculate`).
3. **[ORCHESTRATOR]** `_checkBrokerConnection()` (lines 1577-1651) — GET `/api/user/getUser/:email`, validate active connected broker, fall back to `BrokerSelectionPage.show()` if missing. Today: app-side. Tomorrow: SDK does this internally.
4. **[ORCHESTRATOR]** Broker-credentials fetch via `getConnectedBrokers()` (line 1612), pick PRIMARY with first-fallback (line 1638). Today: app-side. Tomorrow: SDK reads from JWT-bound session.
5. **[ORCHESTRATOR]** `_validateBrokerSession()` (OrderExecutionService.dart line 300) → `BrokerSessionValidator.validate()` → `/ccxt/<broker>/validate-session`. Today: separate Dart class. Tomorrow: internal SDK sub-orchestrator step.
6. **[ORCHESTRATOR]** Pre-flight `_validateExchanges()` (OrderExecutionService.dart line 307) — checks every order has an `exchange` field set. Today: Dart-side. Tomorrow: SDK orchestrator owns.
7. **[ORCHESTRATOR + SDK-WIDGET]** `canSell` per-broker check (lines 1480-1551). Branches:
   - Zerodha (1501): `hasPermanentDdpi || isAuthorizedForSell`.
   - Dhan (1504): `_checkDhanEdisStatus()` → GET `/ccxt/dhan/edis-status`.
   - Angel One (1513-1517): `ddpiEnabled || isAuthorizedForSell` → fallback to `_checkAngelOneEdisStatus()` → POST `/ccxt/angelone/verify-dis`.
   - Fyers (1520): `isAuthorizedForSell` only.
   - Others (AliceBlue, Axis, ICICI, Upstox, Kotak, HDFC, Motilal, Groww): `isAuthorizedForSell`.
   If `!canSell` → navigate to `DdpiAuthPage`. Today: page transition. Tomorrow: SDK widget.
8. **[SDK-WIDGET]** `DdpiAuthPage` (lines 20-275) — unified per-broker sell-auth flow. Cleaner than the RN app's per-broker modal cascade (DdpiModal + AngleOneTpinModal + DhanTpinModal + FyersTpinModal + OtherBrokerModel). Today: Flutter page. Tomorrow: SDK sell-auth widget — Flutter's unified shape is the better template.
9. **[SDK-WIDGET]** Trade review UI (RebalanceReviewPage main render) — list of editable trades, totals, exchange warnings. Today: Dart screen. Tomorrow: SDK `<TradeReviewSheet>` (already shipped in B-1 SDK package, needs orchestration plumbing).
10. **[BACKEND]** `executeOrders()` → `AqApiService.processTrade()` → POST `/rebalance/process-trade` (OrderExecutionService.dart line 550). Today: direct ccxt-india. Tomorrow: SDK route `/sdk/v1/orders/place` (already shipped in B-1 backend, just needs caller wiring).
11. **[ORCHESTRATOR / partially STAY]** Zerodha and Fyers basket exception paths — `executeOrders` throws `ZerodhaBasketRequiredException` / `FyersBasketRequiredException` (lines 15, 39); `ExecutionStatusPage` catches and switches to WebView basket flow with ≤10-item batching. Today: exception-driven control flow. Tomorrow: orchestrator's per-broker branch internal — caller never sees it. (WebView itself stays — Kite Publisher is hosted; SDK wraps the WebView.)
12. **[SDK-WIDGET]** `ExecutionStatusPage` polls `/rebalance/user-executions` for terminal state. Today: Dart page. Tomorrow: SDK `<TradeExecutionProgress>` + final `<TradeResultModal>` (both already shipped in B-1).
13. **[STAY]** Success toast + Navigator pop back to portfolio home. App-side UX glue.
14. **[STAY]** Holdings refresh on success (host app's hooks fire).

### Hidden coupling

- **`canSell` derivation reads multiple sources** — `connected_brokers[broker].ddpi_enabled`, `.is_authorized_for_sell`, `.sell_auth_set_at` (per `SELL_AUTH_ARCHITECTURE.md`). Cross-checked on every render. SDK must own this lookup once and cache it.
- **Email resolution** (main.dart 266-272) — async polling of secure storage + Firebase auth state. SDK provider waits on this. `_schemaOverridePending` gate prevents a race where SDK init runs before email resolves. **Flutter handles this better than RN today.**
- **Backend mutates `is_authorized_for_sell` on `/ccxt/<broker>/verify-dis` success** — see ccxt verify-dis classifier. Flutter's `_checkAngelOneEdisStatus` exploits this to short-circuit the prompt.

### Verdict for § 3.tidi (Flutter MP rebalance)

Most steps **move to the SDK orchestrator**. The only app-side surface that remains is steps 1-2 (entry + load proposed trades) and 13-14 (post-flow refresh). 11-step flow shrinks to ~1 SDK call + 2 host hooks.

---

## § 4 MP initial allocation — Alphab2bapp (RN)

> Drawn from the MP-RN audit agent's findings, 2026-05-02. Two entry points share most of § 3's flow.

### Entry points

- `src/components/ModelPortfolioComponents/MPInvestNowModal.js:469-490, 778-857` — `handlePaymentSuccessWithTelegram()` post-payment-success path; Digio e-signature gate; opens UserStrategySubscribeModal.
- `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js:330-843` — three callsites (Fyers publisher 330-592, direct broker 605-778, Zerodha publisher equivalent).

### Diff vs § 3 (rebalance)

1. **[STAY]** Payment + subscription persistence (Razorpay/CashFree/PayU/IAP, GST, plan-tier selection). App-owned, not orchestrator territory per VISION § 5.
2. **[STAY]** Digio e-signature flow (MPInvestNowModal lines 778-857). DocumentId polling. Compliance, not trade-exec.
3. **[STAY]** Telegram-ID collection post-subscribe (UserStrategySubscribeModal lines 484-489). Tenant business config.
4. **[ORCHESTRATOR]** `calculateRebalance` initial allocation — POST `/rebalance/calculate` with `{user_email, modelName, investment_amount, model_id}`. Returns `{buy: [...], sell: [...], uniqueId}`. Today: app-side. Tomorrow: app calls this BEFORE `executeAdvice` and passes result as `trades`. (Calculate stays out of orchestrator — too plan-aware.)
5. **[ORCHESTRATOR]** Steps 6-12 of § 3 are identical from here. The SDK orchestrator absorbs them via `executeAdvice({kind: 'mpInitialAllocation', modelId, uniqueId, trades, subscriptionId})`.

### Verdict for § 4

The MP-subscribe boundary is at the trade-exec edge. App keeps payment + persistence + calculate; SDK absorbs validate + sell-auth + review + place + poll + result. Same orchestrator method as § 3.

---

## § 5 Broker connect (fresh) — Alphab2bapp (RN)

> Drawn from `src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js` (660 LOC) read directly.

### Files involved

- `src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js` — single dispatch function (line 157). Routes by `useSdkBrokerFlow()` flag + `SDK_LEGACY_FALLBACK` set.
- `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js` (923 LOC) — SDK lane shell wrapper.
- `src/components/BrokerConnectionModal/AngelOneCautionaryWarning.js` — Angel One pre-connect interstitial.
- `src/components/BrokerSelectionModal.js` — pre-connect entry / picker.
- 13 legacy modals (one per broker — `ZerodhaConnectModal.js`, `AngleoneBookingModal.js`, `UpstoxModal.js`, etc.) — kept as fallback when flag off.

### Step trace

1. **[STAY]** User taps a broker tile in BrokerSelectionModal. Triggers `BrokerConnectModalDispatch` with `brokerName + reauthConfig=null`.
2. **[ORCHESTRATOR]** `useSdkBrokerFlow()` reads `REACT_APP_USE_SDK_BROKER_FLOW`. Today: branch in app. Tomorrow: SDK is default; flag retired.
3. **[SDK-WIDGET]** When flag on AND broker not in `SDK_LEGACY_FALLBACK` (currently empty Set as of 2026-05-01) → `<Phase3SdkBrokerModal brokerName={key} />`. Renders SDK widget tree (`BrokerCredentialForm` + `WebViewBrokerAuthFlow`).
4. **[SDK-WIDGET]** Angel One special wrapping — `<AngelOneCautionaryWarning>` interstitial wraps the modal (lines 195-202). Skipped on re-auth (`reauthConfig` non-null).
5. **[BACKEND]** SDK lane calls `/sdk/v1/connections/<broker>/{login-url, exchange-token, connect, update-credentials}` per Phase 3 backend.
6. **[STAY]** Legacy fallback path (`SDK_LEGACY_FALLBACK` non-empty OR flag off) → `renderLegacyModal(key, commonProps)` switch (lines 207-238) — direct render of per-broker legacy modal. **Slated for deletion as Phase 3 reaches 100%.**

### Gaps from VISION

- **Backend `/sdk/v1/connections/:broker/connect` does not validate creds via ccxt before persist** (Flutter audit gap, applies to RN too) — bad creds are accepted, first trade fails. **Pre-Phase-C backend follow-up (Phase 3 cleanup ticket — small, can land independently).**
- **`SDK_LEGACY_FALLBACK` lives in app code** — fallback decisions split between app and SDK. Move the allowlist to SDK package so all consumer apps share one source of truth.
- **`AngelOneCautionaryWarning`** is app-coupled; should move into SDK widget tree as a pre-connect step the orchestrator owns.

### Verdict

Already largely SDK-owned. Three small lifts (SDK package owns fallback set, SDK widget owns cautionary warning, backend validates creds pre-persist) close the gap.

---

## § 6 Broker re-auth — Alphab2bapp (RN)

> Drawn from `BrokerConnectModalDispatch.js` comment block + targeted file reads.

### Files involved

- `src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js:184-187` — re-auth routes through SDK lane via `reauthConfig` prop (since 2026-04-29).
- `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js` — pre-fill via `schemaOverride.fields[].initialValue` from stored creds.
- `src/components/TokenExpireBrokerModal.js` (496 LOC) — auto-popup on session expiry mid-trade. Calls `fetchBrokerStatusModal()` → opens broker connect dispatch with `reauthConfig`.
- `src/screens/Home/ManageConnectionsModal.js` — explicit "Reconnect" tap entry.

### Step trace

1. **[STAY]** User taps "Reconnect" in ManageConnectionsModal OR session-expired auto-trigger via `TokenExpireBrokerModal`.
2. **[ORCHESTRATOR]** `BrokerConnectModalDispatch` receives `reauthConfig={authUrl, brokerName, ...}` non-null.
3. **[SDK-WIDGET]** Routes to `Phase3SdkBrokerModal` SAME as fresh-connect (no separate reauth modal as of 2026-04-29 — pre-fill is via SDK schema override, not a separate authUrl path).
4. **[BACKEND]** SDK lane backend handles re-auth via stored creds → autojump or partial-form. Same `/sdk/v1/connections/<broker>/*` routes.

### Gaps vs Flutter (per § 6.tidi)

- **Mark broker `expired` BEFORE reauth runs** — Flutter does (line 327 of `ReauthHelper.dart`). RN sets the flag only on failure. **Adopt Flutter pattern in SDK orchestrator.**
- **Flip primary broker up-front** — Flutter does (line 337 of `ReauthHelper.dart`). RN doesn't.
- **Silent refresh (Groww)** + **smart-reauth (ICICI/Upstox/Motilal/HDFC/Fyers)** — Flutter has `ReauthHelper` with both patterns. RN scattered. SDK orchestrator should expose `sdk.reauth(broker, {forceInteractive})`.

### Verdict

Re-auth routes through SDK widget now. Lift `ReauthHelper` orchestration logic (Flutter's well-factored shape) into the SDK orchestrator's `reauth()` method. RN catches up via the orchestrator landing.

---

## § 7 Manage connections — Alphab2bapp (RN)

### Files involved

- `src/screens/Home/ManageConnectionsModal.js` — list view, disconnect, re-auth entry.
- `src/screens/Drawer/DisconnectBrokerModal.js` — confirmation dialog.
- `src/screens/Drawer/BrokerConnectionError.js` — error screen.

### Verdict (same as § 7.tidi)

List view stays app-side — tenant-visual surface. Per-broker actions (disconnect, repair=reauth) move to SDK methods (`sdk.disconnectBroker(name)` calls `/api/user/disconnect-broker` + invalidates SDK session cache; `sdk.reauth(name)` per § 6). `manageConnections()` as a top-level method NOT recommended — would force list into SDK territory unnecessarily.

---

## § 8 Sell-auth gate — Alphab2bapp (RN)

The detailed walk lives in § 3 "EDIS/TPIN cascade" subsection above (it's the single most important orchestration target).

### Files involved (consolidating)

- `src/components/DdpiModal.js` (Zerodha)
- `src/components/AngleOneTpinModal.js`
- `src/components/DhanTpinModal.js`
- `src/components/FyersTpinModal.js`
- `src/components/OtherBrokerModel.js` (special brokers — AliceBlue, IIFL, ICICI, Upstox, Kotak, HDFC, Motilal, Groww)
- Plus the booleans + classifiers across `RebalanceModal.js`, `MPReviewTradeModal.js`, `RebalanceAdviceContent.js`, and the bespoke callers.

### Verdict

Highest-leverage simplification in the entire codebase. Today's 5 modals + 7-flag cascade collapse into one SDK widget — `<SellAuthGate>` modeled on Flutter's unified `DdpiAuthPage`. Owns Zerodha DDPI, Angel One verify-DIS, Dhan generate-TPIN/enter-TPIN, Fyers TPIN/submit-holdings, and special-broker manual-confirm cases in one widget with internal per-broker branches. Pre-order check + post-order re-trigger both call into the same widget. State `is_authorized_for_sell` cached in SDK; `sell_auth_set_at` day-check honored per `SELL_AUTH_ARCHITECTURE.md`.

---

## § 4.tidi MP initial allocation — tidi_new (Flutter)

The Flutter app's MP-subscribe path (per audit) reaches `/rebalance/process-trade` via the same `OrderExecutionService.executeTrade()` once payment + subscription persistence are done. Same code path as § 3.tidi from step 6 onward — the orchestrator absorbs both with one entry point (`sdk.executeAdvice({ kind: 'mpInitialAllocation', ... })`).

---

## § 5 Broker connect (fresh) — Alphab2bapp (RN)

**Status**: stub — agent walking `Phase3SdkBrokerModal.js`, `ModalManager.js` SDK_ELIGIBLE_MODALS, the legacy `BrokerConnectionModal/*` set, and per-broker variance.

---

## § 5.tidi Broker connect (fresh) — tidi_new (Flutter)

> Drawn from the Flutter audit agent's findings, 2026-05-02.

### Files involved

- `lib/components/home/portfolio/Phase3SdkConnectScreen.dart` — SDK lane shell.
- `lib/components/home/portfolio/BrokerSelectionPage.dart` — pre-connect picker.
- SDK package: `../../alphaquark-mobile-sdk/packages/flutter/lib/src/widgets/broker_form_schema.dart` — per-broker schemas.
- SDK package: `../../alphaquark-mobile-sdk/packages/flutter/lib/src/widgets/broker_credential_form.dart` — credential form widget.
- SDK package: `../../alphaquark-mobile-sdk/packages/flutter/lib/src/widgets/webview_broker_auth_flow.dart` — OAuth WebView.
- `main.dart` lines 142-143 — `AqSdkScope` mount + `_AqSdkScopeWrapper` async-email gate.

### Step trace

1. **[STAY]** User opens BrokerSelectionPage, sees broker grid, taps a broker tile.
2. **[STAY]** `_connect(config)` resolves SDK gating: if `USE_SDK_BROKER_FLOW=true` (dotenv), pushes `Phase3SdkConnectScreen(email, brokerConfig)` (line 92). Today: env flag. Tomorrow: SDK is default path; flag retired.
3. **[SDK-WIDGET]** Schema selection (Phase3SdkConnectScreen lines 132-150) — reads per-broker schema from `broker_form_schema.dart`. Schema declares one of four flows: `credentials`, `credentials_totp`, `oauth`, `stub`. Optional `_schemaOverride` for brokers needing pre-fill (Kotak reads saved mobileNumber).
4. **[SDK-WIDGET / partially BACKEND]** Credentials path (AliceBlue, Dhan, Groww, Angel One, Kotak, IIFL):
   - `BrokerCredentialForm` renders SDK schema fields.
   - On submit → `AqSdkClient.connectBroker()` (new) or `AqSdkClient.updateBrokerCredentials()` (existing) → POST `/sdk/v1/connections/:broker/connect` or `/update-credentials`.
   - **Known gap (lines 46-55)**: SDK `/connect` does NOT validate credentials via ccxt — just persists. Trades fail at execution time if creds are bad. RN's legacy path validates earlier. **Fix needed**: backend `/sdk/v1/connections/:broker/connect` extends to call ccxt validation BEFORE persist.
5. **[SDK-WIDGET]** OAuth path (Zerodha, Angel One alternative, Dhan alternative, AliceBlue alternative, Axis, Upstox, Fyers, HDFC, Motilal):
   - `BrokerCredentialForm` collects pre-OAuth fields where required (apiKey/secretKey for some brokers; empty for Zerodha).
   - On Continue → `WebViewBrokerAuthFlow`.
   - Step 1: POST `/sdk/v1/connections/:broker/login-url`.
   - Step 2: WebView opens OAuth URL.
   - Step 3: WebView captures redirect-URL navigation matching `appLinksRedirectUrl = https://app-links.alphaquark.in/broker-callback`.
   - Step 4: POST `/sdk/v1/connections/:broker/exchange-token` with query params + `extraExchangeBody`.
6. **[SDK-WIDGET]** Stub flow (DummyBroker): form auto-succeeds; no persistence.
7. **[STAY]** Success contract (line 71): `Navigator.pop(true)` → BrokerSelectionPage refreshes via `_fetchConnectedBrokers()`.

### Verdict for § 5.tidi (Flutter fresh-connect)

Already largely SDK-owned. Two gaps:

1. SDK `/connect` credential-validation gap (backend deficit — needs same-commit fix).
2. The schema-override mechanism for brokers with stored partial creds is Flutter-specific today; RN should mirror or the orchestrator should normalize.

---

## § 6 Broker re-auth — Alphab2bapp (RN)

**Status**: stub — agent walking `ManageConnectionsModal.js` reauth entry, `TokenExpireBrokerModal.js` mid-trade reauth popup, and the per-broker reauth-config plumbing.

---

## § 6.tidi Broker re-auth — tidi_new (Flutter)

> Drawn from the Flutter audit agent's findings, 2026-05-02.

### Files involved

- `lib/components/home/portfolio/ManageBrokersPage.dart` — entry (line 276 `_reconnectBroker()`).
- `lib/service/ReauthHelper.dart` — `handleSmartReauth()`, `markBrokerExpired()`, `flipPrimaryBroker()`, `performSilentRefresh()`.
- Backend routes: `/api/<broker>/reauth-url`, `/api/groww/refresh-token`, `/api/user/update-broker-status`, `/api/user/set-primary-broker`.

### Step trace

1. **[STAY]** User taps "Reconnect" on a broker card in ManageBrokersPage.
2. **[ORCHESTRATOR]** `_reconnectBroker()` → `_navigateToBrokerAuth(config, isReauth=true)` (line 276).
3. **[ORCHESTRATOR]** `ReauthHelper.markBrokerExpired()` (line 327) → PUT `/api/user/update-broker-status?status=expired`. Important: marked BEFORE reauth runs, so a backed-out reauth shows "Re-auth needed" rather than stale "Connected".
   - **Flutter ahead of RN here.** RN sets the expired flag only after failure.
4. **[ORCHESTRATOR]** `ReauthHelper.flipPrimaryBroker()` (line 337) → PUT `/api/user/set-primary-broker` — user tapped reconnect, they want this broker active.
5. **[ORCHESTRATOR]** `ReauthHelper.handleSmartReauth()`:
   - **Credential brokers** (`kCredentialReauthBrokers` = ICICI Direct, Upstox, Motilal, HDFC, Fyers): GET `/api/<broker>/reauth-url` → backend decrypts stored creds, builds OAuth URL.
   - **Silent refresh** (Groww only): `performSilentRefresh()` → GET `/api/groww/refresh-token` → backend mints fresh TOTP from stored Base32 seed → calls Groww `/v1/login` → persists new jwtToken. **No user interaction.**
   - **Partner OAuth** (Zerodha, Angel One, Dhan, etc.): falls through to full Phase3SdkConnectScreen.
6. **[SDK-WIDGET]** On smart-reauth fallthrough — opens normal Phase3SdkConnectScreen / BrokerAuthPage. Same surface as fresh-connect (§ 5).

### Verdict for § 6.tidi (Flutter reauth)

Smart-reauth orchestration is well-factored already — `ReauthHelper` is essentially the orchestrator's logic in Dart form. Should lift wholesale into the SDK as `sdk.reauth(brokerName)`. The `markBrokerExpired-before-reauth` ordering is a Flutter best-practice that the orchestrator should preserve and RN should adopt.

---

## § 7 Manage connections — Alphab2bapp (RN)

**Status**: stub — agent walking `ManageConnectionsModal.js` list, `DisconnectBrokerModal.js`, `BrokerConnectionError.js`.

---

## § 7.tidi Manage connections — tidi_new (Flutter)

> Drawn from the Flutter audit agent's findings, 2026-05-02.

### Files involved

- `lib/components/home/portfolio/ManageBrokersPage.dart` (lines 204-380).

### Step trace — disconnect (lines 204-274)

1. **[STAY]** User taps disconnect button on broker card.
2. **[STAY]** Confirmation dialog (line 204).
3. **[ORCHESTRATOR]** POST `/api/user/disconnect-broker?broker=<name>&email=<email>` (line 225).
4. **[ORCHESTRATOR]** Cache invalidation (lines 234-236).
5. **[STAY]** Optimistic UI removal (line 241). If no brokers left, set "no broker" preference (line 248).

### Step trace — repair / reconnect (lines 276-380)

Same as § 6.tidi reauth flow. Repair = reauth.

### Verdict for § 7.tidi (Flutter manage-connections)

The list view stays app-side — it's a tenant-visual surface. The actions (disconnect, repair) move to SDK methods (`sdk.disconnectBroker(name)`, `sdk.reauth(name)`) so the cache invalidation + status update are owned by SDK consistently. `manageConnections()` as a top-level SDK method is **NOT recommended** — it would force list rendering into SDK territory unnecessarily. Instead, the SDK exposes per-broker actions that the host app's list calls into.

---

## § 8 Sell-auth gate — Alphab2bapp (RN)

**Status**: stub — the EDIS / TPIN cascade (5-7 boolean state-flag interplay across `RebalanceModal.js` / `MPReviewTradeModal.js` / `RebalanceAdviceContent.js`) walk pending agent return. This is the most fragile part of the RN app and the highest-leverage target for orchestration.

---

## § 8.tidi Sell-auth gate — tidi_new (Flutter)

Already covered in § 3.tidi step 8 + § 4.tidi (initial allocation typically doesn't trigger sell-auth — first allocation is BUY-only). Flutter's `DdpiAuthPage` is the unified per-broker prompt; the RN app's split modal cascade is the complexity that orchestration removes.

---

## RN ↔ Flutter parity matrix (initial — pass 1)

| Flow | RN today | Flutter today | Parity verdict | Vision-state owner |
|---|---|---|---|---|
| MP rebalance entry | RebalanceReviewScreen.js | RebalanceReviewPage.dart | ✅ Same shape | App keeps entry; calls SDK |
| Broker selection | BrokerSelectionModal.js | BrokerSelectionPage.dart | ✅ Same | App keeps |
| Session validation | `validateBrokerSession()` util | `BrokerSessionValidator.dart` | ✅ Same backend route | SDK orchestrator |
| Sell-auth Zerodha | DdpiModal.js (auth-sell) | DdpiAuthPage.dart `_zerodhaFlow` | ✅ Same | SDK widget |
| Sell-auth Dhan | DdpiModal.js (dhan-tpin) | DdpiAuthPage.dart `_dhanFlow` | ✅ Same | SDK widget |
| Sell-auth Fyers | DdpiModal.js (fyers-tpin) | DdpiAuthPage.dart `_fyersFlow` | ✅ Same | SDK widget |
| Sell-auth Angel One | DdpiModal.js (angelone-verify-dis) | DdpiAuthPage.dart `_angelOneFlow` | ✅ Same; Flutter extracts clientCode from JWT locally | SDK widget |
| Per-broker TPIN modal shape | Split into DhanTpinModal, FyersTpinModal, AngleOneTpinModel, OtherBrokerModel | Unified DdpiAuthPage with internal switch | ⚠️ Flutter wins; SDK adopts unified shape | SDK widget |
| Broker connect (legacy) | BrokerAuthPage / BrokerCredentialPage | Same files exist | ⚠️ Both apps still have legacy paths | Delete both post-Phase 3 100% |
| Broker connect (SDK) | Phase3SdkBrokerModal.js | Phase3SdkConnectScreen.dart | ⚠️ Diverging — Flutter ahead on schema support; backend `/connect` validation gap on both | SDK orchestrator |
| Smart reauth | reauthHelpers.js | ReauthHelper.dart | ✅ Parallel; Flutter's `markBrokerExpired-before-reauth` is cleaner | SDK orchestrator |
| Silent refresh (Groww) | refreshGrowwToken() | ReauthHelper.performSilentRefresh() | ✅ Same backend route | SDK orchestrator |
| Disconnect | ManageConnectionsModal.js | ManageBrokersPage.dart | ✅ Same | App calls `sdk.disconnectBroker(name)` |
| Order execution standard | processTrade() util | OrderExecutionService.executeTrade() | ✅ Same payload to /rebalance/process-trade | SDK orchestrator |
| Zerodha basket | ZerodhaPublisher.js | ZerodhaBasketRequiredException + ExecutionStatusPage | ✅ Parallel; Flutter batches ≤10 explicitly | SDK orchestrator (internal branch) |
| Fyers basket | FyersPublisher.js | FyersBasketRequiredException | ✅ Parallel | SDK orchestrator (internal branch) |
| Bespoke trade flow | TradeReviewScreen + StockAdvices.js + AddtoCartModal.js | **NOT IMPLEMENTED** | ⚠️ Asymmetric | SDK orchestrator (RN only initially; Flutter onboards if needed) |
| Email resolution to SDK | Sync from Firebase | Async resolve from secure storage + Firebase | ⚠️ Flutter ahead — handles delayed-write race | SDK orchestrator (adopt Flutter pattern) |

Bold takeaway: **the Flutter app is structurally ahead of the RN app on three orchestration concerns** — unified sell-auth UI, mark-expired-before-reauth ordering, and async email resolution. The orchestrator design should adopt Flutter's patterns; the RN app catches up via the orchestrator landing.

---

## Cross-cutting findings (pass 1 — preliminary)

1. **The 14 RN ccxt-direct callsites collapse to 4 SDK calls.** One per advice-kind: `bespokeSingle`, `bespokeCart`, `mpRebalance`, `mpInitialAllocation`. Confirmed by RN audit (4 bespoke files + 10 MP files all hitting either `/orders/process-trade` or `/rebalance/process-trade`).
2. **Sell-auth cascade is the highest-leverage simplification.** Today's RN code distributes 5-7 boolean flags across 3 modals + 4 per-broker modal files. Flutter's unified `DdpiAuthPage` is the better template; SDK adopts it as `<SellAuthGate>`.
3. **SDK backend `/connect` validation gap blocks orchestrator confidence.** If a user enters bad creds, today the SDK lane silently persists and the FIRST trade fails. Backend fix needed: `/sdk/v1/connections/:broker/connect` calls ccxt validation pre-persist.
4. **Reauth-state ordering**: Flutter marks broker `expired` BEFORE reauth runs; RN marks it after failure. Adopt Flutter's pattern in the SDK orchestrator. Also flip primary broker up-front (Flutter does, RN doesn't).
5. **Zerodha + Fyers basket flows stay app-internal-WebView** but get SDK-wrapped — orchestrator opens the WebView, host app never sees the exception path.
6. **Email-binding race** (Flutter solved, RN to verify) — async-resolve email + gate orchestrator until ready. The orchestrator's `ready` flag MUST handle this in both packages.
7. **Bespoke flow is RN-only** today. Decision needed: do we add it to Flutter SDK now (parity-by-design), or ship orchestrator API rebalance-only initially? **CONTRACT doc default**: ship the bespoke kinds in the contract from day one (so Flutter SDK has the API), even if Flutter's host app doesn't call them yet. Same pattern as B-1's Flutter SDK package types.

---

## Open audit tasks (pass-1 follow-ups)

- [x] § 1, § 2 — bespoke RN walks (covered pass 1 + pass 2).
- [x] § 3, § 4 — MP RN walks (covered pass 1 + pass 2).
- [x] § 5, § 6, § 7, § 8 — RN walks (covered pass 1 + pass 2).
- [x] Pass 1 — internal consistency review (2026-05-02; two issues fixed in commit 157aed5).
- [x] Pass 2 — parallel-agent gap-finding (5 fresh agents 2026-05-03). Findings folded in below.
- [ ] Pass 3 — verify the Pass-2 suspected code defects before any code change. Branch off when ready.
- [ ] Cross-link every file:line ref to a verdict tag in `SDK_ORCHESTRATION_CONTRACT.md`.

---

## Pass 2 — independent verification (2026-05-03)

5 fresh Explore agents read the AUDIT's pass-1 claims and verified each against actual code FROM COLD (no priming from pass-1 conversation). One agent per area:

- **Agent A** — bespoke flows § 1 / § 2
- **Agent B** — MP rebalance / initial allocation / sell-auth § 3 / § 4 / § 8
- **Agent C** — broker connect / reauth / manage § 5 / § 6 / § 7
- **Agent D** — Flutter flows § *.tidi
- **Agent E** — cross-cutting (VISION + CONTRACT claims)

Findings split into three buckets: **doc corrections** (where AUDIT/VISION/CONTRACT misstated current code), **newly discovered detail** (real complexity Pass 1 missed), and **suspected code defects** (genuine bugs or gaps in the actual code, not in the doc).

### Doc corrections — AUDIT § 1 / § 2 (bespoke flows)

| AUDIT pass-1 claim | Pass-2 verification |
|---|---|
| Step 5: `validateBrokerSession(broker, jwtToken, {checkFreshness: true})` at StockAdvices.js:641 | **WRONG line / wrong call.** StockAdvices.js:1641 calls `refreshBrokerStatus({forceNetwork: true})` — a heavier op (refetches userDetails + funds, not just freshness). The lighter `validateBrokerSession` does exist in `src/utils/brokerSessionUtils.js:81` but is called only in AddtoCartModal.js:641. |
| Step 6: `classifyFundsResponse` at line 388 of ReviewTradeModal | **Wrong file.** `classifyFundsResponse` is called at StockAdvices.js:524, 1674, 2440 and AddtoCartModal.js:388. ReviewTradeModal does not call it. |
| `isReturningFromOtherBrokerModal` cleared at "line 1789" | **Wrong line.** In bespoke (StockAdvices.js): cleared at line 1114. In MP (RebalanceModal.js): cleared at 1789 (per Pass-2 Agent B). **There are TWO copies of this flag — one for bespoke, one for MP.** Pass 1 conflated them. |
| Step 10: Zerodha publisher applies to all bespoke callsites | **Misleading.** Zerodha publisher branch is in StockAdvices.js:562-569 ONLY. AddtoCartModal and IgnoreTradesScreen go direct-ccxt, no publisher branch. |
| Step 2: Angel One surveillance applies to all bespoke | **Misleading.** Surveillance check is in ReviewTradeModal.js:83-120 ONLY (single-trade path). AddtoCartModal has no surveillance check. |
| EventEmitter list (3 events) in § 1 hidden coupling | **Missed `'OrderPlacedReferesh'`.** Fired by StockAdvices.js:840, 918, 1032. AddtoCartModal doesn't emit it. IgnoreTradesScreen doesn't emit either — calls `getAllTrades()` directly. So **emission asymmetry across the 3 bespoke callers**. |
| "AsyncStorage clear cart on success" | **Misleading.** StockAdvices.js calls `filterCartAfterOrder()` (updates AsyncStorage, doesn't clear). AddtoCartModal has a `clearCart()` (line 473) that's called only on user-tap, NOT on trade success. |

### Doc corrections — AUDIT § 3 / § 4 (MP flows)

| AUDIT pass-1 claim | Pass-2 verification |
|---|---|
| § 3 EDIS matrix — per-broker pre-order checks | **Verified accurate** for `RebalanceModal.js`. Lines 1239 (Dhan), 1247-1248 (Zerodha), 1256-1258 (Angel One), 1266-1267 (Fyers), 1276-1277 (special) all match SELL_AUTH_ARCHITECTURE.md § 4. |
| § 3.tidi (Flutter) line 327 marks expired before reauth | Verified — Flutter `ReauthHelper.dart:144`. |
| § 3 polling cadence: "5s for 90s" | **Verified accurate.** RebalanceModal.js poll-interval / poll-timeout. |
| § 3 CDSL/EDIS error regex contains "cdsl / edis / tpin / validate qty" | **Verified accurate.** Exact strings present. |
| § 4 "Steps 6-12 of § 3 are identical from here" | **PARTIALLY WRONG.** Both `MPReviewTradeModal.js` and `UserStrategySubscribeModal.js` are MISSING pre-order EDIS checks present in RebalanceModal. Documented as **suspected code defect** below. |

### Doc corrections — AUDIT § 5 / § 6 / § 7 (broker connect / reauth / manage)

| AUDIT pass-1 claim | Pass-2 verification |
|---|---|
| § 5: `SDK_LEGACY_FALLBACK` empty as of 2026-05-01 | **Verified.** `BrokerConnectModalDispatch.js:131` = `new Set([])`. Comment block 56-130 documents the brief Angel-One-only entry 2026-04-30 → empty 2026-05-01 after backend gaps closed. |
| § 6: re-auth routes through SDK lane via `reauthConfig` prop | **MISLEADING.** `Phase3SdkBrokerModal` does NOT consume `reauthConfig`. Pre-fill is via `getStoredBrokerCreds(userDetails, brokerName)` + `buildSchemaOverride().fields[].initialValue` (Phase3SdkBrokerModal.js:342-348). The legacy `reauthConfig.authUrl` path is **fully retired** for the SDK lane. `reauthConfig` is consumed only by the LEGACY lane. **Update AUDIT § 6 step 3 wording.** |
| § 6: "Flutter has cleaner ReauthHelper, RN scattered" | **OUTDATED.** RN gained `src/utils/reauthHelpers.js` 2026-04-29 with `flipPrimaryBroker` (line 63), `markBrokerExpired` (line 96), `performSilentRefresh` (line 161), `handleSmartReauth` (line 194). RN reached parity with Flutter. The AUDIT's "Flutter ahead on mark-expired-before-reauth" claim no longer holds. |
| § 5: gating flags = `useSdkBrokerFlow` + `SDK_LEGACY_FALLBACK` | **Two more flags missed:** `OAUTH_REAUTH_AUTOJUMP_BROKERS` (Phase3SdkBrokerModal.js:178-188) — triggers `buildOauthReauthExtras()` for skip-form-jump-to-OAuth. `IP_WHITELIST_BROKERS` (Phase3SdkBrokerModal.js:106-116) — gates `EgressIpCallout`. |
| § 6 step claim: TokenExpireBrokerModal "calls fetchBrokerStatusModal then opens broker dispatch" | **WRONG.** TokenExpireBrokerModal.js (496 LOC) is a **parallel per-broker re-auth implementation** with its own handlers: IIFL direct API (lines 43-87), Kotak update-key + TOTP (lines 89-150+), OAuth list of 9 brokers (lines 12-17). It does NOT delegate to `BrokerConnectModalDispatch`. Real callers: StockAdvices.js, BrokerSelectionModal.js (imports). When session expires mid-trade, screens render this modal directly bypassing the unified dispatch. |
| § 7: BrokerConnectionError as a surface | **Dead code.** `src/screens/Drawer/BrokerConnectionError.js` is a stub (View + Text + TextInput placeholder). No callers found. Remove from AUDIT or flag as unused. |

### Doc corrections — AUDIT § *.tidi (Flutter)

| AUDIT pass-1 claim | Pass-2 verification |
|---|---|
| § 3.tidi step 11: Fyers basket flow operational | **WRONG.** Fyers Publisher SDK was disabled 2026-04-25 (loadHtmlString origin issue → Fyers SDK domain validation fails on mobile). Fallback to REST `processTrade`. `FyersBasketRequiredException` class + `_setupFyersWebView` are dead code. |
| Zerodha basket batches "≤10" | **WRONG.** OrderExecutionService.dart:450 sets `maxBatchSize = 60`. Comment at line 447: "earlier 10-cap was conservative; Kite basket reliably accepts 60." Update PHASES Phase C done-when test plan. |
| § 5.tidi: `_schemaOverridePending` flag prevents email-resolution race | **NO SUCH FLAG.** Reading main.dart 226-251: polling is real (2s for 60s, then 30s); gate is implicit (AqSdkScope handles null userRef internally). Lines 266-272 are actually the `_resolveEmail()` function body, not the polling loop. |
| § 6.tidi: ReauthHelper has flipPrimary, markExpired, silentRefresh, smartReauth | **Verified accurate.** Plus `kCredentialReauthBrokers` = {ICICI Direct, Upstox, Motilal Oswal, Hdfc Securities, Fyers}; `kSilentRefreshBrokers` = {Groww}. |

### Doc corrections — VISION + CONTRACT cross-cutting

| Claim | Verification |
|---|---|
| VISION § 12: `RecommendationSuccessModal.js` 1102 LOC | **WRONG.** Actual is 1152 LOC. Fix in VISION. |
| AUDIT § Cross-cutting #1: "14 RN ccxt-direct callsites" | **Actually 15** distinct URL construct lines. Logical flows still collapse to 4 (per CONTRACT § 2 AdviceInput tagged union — verified no 5th kind needed). Update count in AUDIT cross-cutting. The 15: StockAdvices/AddtoCartModal/IgnoreTradesScreen/OrderService for `/orders/process-trade` (4); RebalanceModal×3 + UserStrategySubscribeModal×3 + MPReviewTradeModal×2 + ExecutionStatusScreen×1 + DummyBrokerHoldingConfirmation×1 + ModelPortfolioService×1 for `/rebalance/process-trade` (11). |
| AUDIT § 8: "5 sell-auth modals" framed as 5 separate files | **Architecturally wrong.** All 5 are exported from `src/components/DdpiModal.js` (2802 LOC, single file). Files like `AngleOneTpinModal.js` / `DhanTpinModal.js` / `FyersTpinModal.js` / `OtherBrokerModel.js` named in AUDIT do not exist as separate files. Real exports from DdpiModal.js: `default DdpiModal` (line 49), `AngleOneTpinModal` (1024), `DhanTpinModal` (1298), `OtherBrokerModel` (1800), `AfterPlaceOrderDdpiModal` (2276 — **6th modal, missed by AUDIT**), `FyersTpinModal` (2536). The "5 modals + 7 booleans" cascade is real but lives in ONE 2802-LOC monolith — even higher leverage to delete than AUDIT implied. |
| CONTRACT § 2 OrderStatus enum (uppercase): PLACED / FILLED / PARTIAL / REJECTED / CANCELLED / PENDING / AMO_QUEUED | **Architectural mismatch with existing `src/utils/orderStatusUtils.js`** which uses lowercase categories (complete / pending / rejected / cancelled / partial / unknown) collapsing multiple broker states. The CONTRACT defines the NEW canonical enum the SDK route's `_normalizeStatus.js` produces; existing app utility is what the SDK replaces. **Add note to CONTRACT § 2** explaining this is the new canonical, not a description of today's app. |
| CONTRACT § 10 mint-server scope claim: "today's RN app requests connections:* + portfolios:read; B-1 added orders:* to mint server `ALL_SCOPES`" | **Backend whitelist is correct** (B-1 commits did add `orders:read` + `orders:write` to `aq_backend_github/utilities/sessionToken.js:56`). **But RN app's `mintSession` body still requests only 3 scopes** (`SdkProviderRoot.js:88-92`). When the orchestrator calls an `/sdk/v1/orders/*` route today, it would 401 on `scope_missing`. **This is the first concrete change for Phase C kickoff** — was already noted in CHANGELOG entry's "B-2.1" steps but worth a bold callout. |

### Newly discovered detail (Pass 1 missed; orchestrator design needs to absorb)

1. **GTT/triggered orders use a different endpoint**: StockAdvices.js:812 + OrderService.js:91 hit `${ccxtServer}/<broker>/process-trades` (per-broker). This is a DISTINCT code path from `/orders/process-trade` — GTT/SL/SL-M variants. AUDIT didn't enumerate. Orchestrator must support GTT routing, not just MARKET/LIMIT.
2. **`AfterPlaceOrderDdpiModal`** (DdpiModal.js:2276) — 6th modal in the cascade, fires AFTER an order rejection that surfaces sell-auth gaps. AUDIT only listed 5.
3. **JWT-extracted Angel One clientCode fallback** (Flutter DdpiAuthPage.dart:377-402) — when stored connection lacks `clientCode`, decode JWT `username` claim locally. Cleaner UX than RN's "credentials missing" error. SDK orchestrator should adopt.
4. **BrokerSessionService.isSessionFresh()** (Flutter) — proactive daily-auth check for Angel One / AliceBlue / Dhan, complementary to live funds probe. RN may lack this guard.
5. **Sealed exception types for basket flows** (Flutter `ZerodhaBasketRequiredException` / `FyersBasketRequiredException`) — typed exception with batches embedded, caught by type in `ExecutionStatusPage`. Cleaner than RN's likely string-based detection.
6. **Per-broker variance missed by AUDIT § 5**:
   - **Kotak** has `normaliseKotakMobile()` transformValue (Phase3SdkBrokerModal.js:149-163) — only broker with a transformValue applied.
   - **Fyers** field-naming inversion (lines 235-249): modal `apiKey` ↔ DB `secretKey`, modal `secretKey` ↔ DB `clientCode`. `buildOauthReauthExtras()` handles it; broker-specific logic in shared helper.
   - **Zerodha** apiKey env-seeding (lines 213-223): form is empty-fields OAuth, so `buildOauthReauthExtras()` seeds apiKey from `REACT_APP_ZERODHA_API_KEY`. No other broker needs this.
7. **Flutter `DdpiAuthPage` branches AUDIT missed**:
   - Broker DDPI help modal nudge (lines 865-898) — per-broker links into broker portal in-app WebView, only fires for brokers with a registered help entry.
   - Manual confirmation checkbox + attestation step (lines 902-928) before proceed for non-API brokers.
8. **Post-execution DDPI re-trigger** (Flutter ExecutionStatusPage.dart:509-563) — auto-opens DdpiAuthPage on rejected sells without requiring user navigation. RN's cascade requires multiple modal hops.
9. **Variant-field threading** (Flutter ExecutionStatusPage.dart:1069-1072, OrderExecutionService.dart:328-343, 465-479) — AMO/REGULAR pill carried through pending results explicitly. RN may not preserve variant as aggressively.
10. **`ManageConnectionsModal` status refresh** uses `isBrokerSessionExpired(b)` from `src/utils/brokerStateUtils.js` — function not mentioned in AUDIT.

### Suspected code defects (verify before fixing — branch off when ready)

These are **actual code issues**, not doc misalignments. Each needs verification before any code change. None blocks the orchestrator design — they describe the legacy state to migrate FROM, not bugs in the orchestrator design.

1. **✅ FIXED 2026-05-03 (commits on `fix/audit-pass2-edis-gaps`)**: `UserStrategySubscribeModal.js` lacked pre-order EDIS gate for the 4 API-driven brokers (Zerodha / Angel One / Dhan / Fyers). Initial allocations with SELL trades on those brokers were failing server-side without UX warning.
   - **First revision**: extended the existing `edisCheckBrokers` Toast pattern to all 13 brokers (mirroring RebalanceModal's pattern).
   - **Second revision (per user feedback 2026-05-03)**: applied DDPI-priority semantics per `SELL_AUTH_ARCHITECTURE.md § 7d`. Zerodha + Angel One pre-blocks remain (DDPI-aware via `ddpi_status` / `ddpi_enabled` cheap server-cached flags). **Dhan + Fyers softened to optimistic placement** — no pre-block; trade attempts and any EDIS rejection surfaces via existing placeOrder error path. 8 portal-side brokers' pre-block kept (pre-existing pattern, not introduced by this fix; Phase D `requireSellAuth` softens to optimistic-then-cascade). Reasoning: pre-blocking on `!is_authorized_for_sell` for Dhan + Fyers would falsely block users who have permanent DDPI at the broker portal but whose `is_authorized_for_sell` flag is false (day-rollover before broker live-check refresh, or stored flag never set).
2. **🟠 `MPReviewTradeModal.js` has only Dhan + Angel-One-surveillance pre-checks**; missing Zerodha/Fyers/Angel-One/special-broker pre-order EDIS gates that RebalanceModal has (lines 1247-1277). Looks like a copy-paste-then-partial-refactor at code-archaeology level. **Verify**: when is MPReviewTradeModal actually opened — only post-payment-success? If so, why does it have Dhan EDIS check at all?
3. **✅ FIXED 2026-05-03 (commit on `fix/audit-pass2-edis-gaps`)**: Cross-publisher AsyncStorage cleanup gap. Both Zerodha and Fyers entry/success paths in `RebalanceModal.js` now wipe each other's pending state — preventing stale replay if a user toggles brokers mid-flow or kills the app between attempts. Four call sites updated: line 651-660 (Zerodha entry), line 942-944 (Zerodha success), line 1004-1006 (Fyers entry), line 1166-1170 (Fyers success). User had asked whether this should pivot to backend DB ops instead of AsyncStorage; deferred — Phase C orchestrator absorbs publisher pending-state management entirely (`<TradeExecutionProgress>` widget + SDK route owns the recovery), so a localised AsyncStorage→DB migration is throw-away work. Documented as Phase C deliverable in `SDK_ORCHESTRATION_PHASES.md` Phase C done-when (TBD entry).
4. **🟠 EventEmitter unsubscribe verification** — RebalanceModal fires `'OrderPlacedReferesh'` (lines 907, 1083) but no verifiable unsubscribe on unmount. Listener in RebalanceAdviceContent.js:224. **Verify** whether listener is cleaned up; if not → memory leak / stale-handler risk.
5. **🟠 `publisherProcessedRef` + `pollingTimeoutRef` race** — if user closes WebView before the 90s polling timeout AND before any order detection, refs are orphaned. RebalanceModal cleanup (lines 209-225) depends on `setWebView(false)` being called.
6. **🟠 No per-trade idempotency on `/rebalance/process-trade`** — uses `payload.unique_id` (model-level, identifies the rebalance instance). Bespoke `/orders/process-trade` does inject `clientTradeId` per trade (Phase A). MP path does not. **Verify** whether this matters for the dual-write soak design (PHASES Phase C) — soak relies on `clientAdviceId` correlation, which this commit's CONTRACT § 2 + § 11 specifies but the legacy MP path doesn't generate.
7. **🟠 `BrokerConnectionError.js`** — dead-code stub component. Not surfaced in any user flow. Either wire it up (it appears intended for connection-error UX) or delete it. Cleanup PR candidate.
8. **🟠 `TokenExpireBrokerModal.js`** — a parallel re-auth implementation (496 LOC) that bypasses `BrokerConnectModalDispatch`. Per-broker handlers for IIFL/Kotak duplicate logic that exists in legacy connect modals + `reauthHelpers`. Either refactor to delegate or document the divergence as intentional. Phase E's `sdk.reauth()` should subsume this regardless.

### Updates to RN ↔ Flutter parity matrix (correcting AUDIT's pass-1 table)

| Concern | Pass-1 AUDIT verdict | Pass-2 verdict |
|---|---|---|
| Mark-expired-before-reauth ordering | "Flutter ahead, RN scattered" | **Parity reached 2026-04-29** — RN `src/utils/reauthHelpers.js:96` `markBrokerExpired()`. Pattern matches Flutter `ReauthHelper.dart:144`. |
| Smart-reauth orchestration | "Flutter cleaner" | **Parity reached 2026-04-29** — RN `reauthHelpers.js:194` `handleSmartReauth()` mirrors Flutter `ReauthHelper.dart:214`. |
| Silent-refresh (Groww) | "Flutter has it" | **Parity reached** — RN `reauthHelpers.js:161` `performSilentRefresh()`. |
| Async email resolution | "Flutter ahead with `_schemaOverridePending` gate" | **Flutter still ahead but no `_schemaOverridePending` flag exists** — gate is implicit via SDK's null-userRef handling. RN `SdkProviderRoot.js` reads email synchronously; race surfaces if Firebase auth is slow on cold start. RN to adopt Flutter's polling pattern when SDK orchestrator lands. |
| Unified sell-auth UI | "Flutter ahead with DdpiAuthPage" | **Flutter still ahead** — but RN's "5 separate modals" framing is wrong; all 5 (+ a 6th: `AfterPlaceOrderDdpiModal`) live in one 2802-LOC `DdpiModal.js`. Even higher consolidation leverage than AUDIT implied. |
| Fyers basket flow | "Both have it" | **Flutter behind** — Fyers basket disabled 2026-04-25 (mobile WebView origin issue). Fallback to REST. RN may still attempt the publisher flow; verify before next orchestrator landing. |
| JWT clientCode extraction | (not mentioned) | **Flutter ahead** — fallback when stored creds lack `clientCode`. |
| BrokerSessionService.isSessionFresh proactive check | (not mentioned) | **Flutter ahead** — daily-auth guard for Angel One / AliceBlue / Dhan. |
| Sealed exception types for basket | (not mentioned) | **Flutter ahead** — typed exceptions; cleaner catch-by-type. |

Net: Flutter is ahead on **5** orchestration concerns (was claimed 3 in pass-1). RN reached parity on **3** that pass-1 said Flutter was ahead. New baseline reflected in PHASES Phase C/D/E pre-conditions.

### Pass 2 verdict

The doc trio is **structurally sound**. Pass 2 found:

- **No design-level errors** in VISION / CONTRACT / PHASES — orchestrator boundary, in/out-of-scope, payment exclusion, native-not-iframe transport, four public methods all hold up.
- **~12 doc-vs-code mismatches** at the AUDIT detail level (line refs, file structure, claim phrasing). All folded into this Pass-2 section. AUDIT pass-1 sections kept intact for traceability; corrections ride on top.
- **8 suspected code defects** worth verifying. None block orchestrator design — they describe legacy bugs to migrate from, not the orchestrator's bugs.
- **5 newly discovered orchestration patterns** (GTT routing, AfterPlaceOrderDdpiModal, JWT clientCode fallback, BrokerSessionService.isSessionFresh, sealed exception types) that the contract should accommodate. None require contract changes — they're internal sub-orchestrator concerns.

**Branch policy**: Pass 2 is doc-only. The 8 suspected code defects need their own branch + verification + per-defect fix. Flagged but not addressed in this commit.

## 2026-08-15 order-entry concurrency follow-up

The legacy mobile entry points used React `loading` state as their broad submit
guard. Because state commits after the event handler returns, rapid taps could
enter the async broker path more than once. `StockAdvices` and `AddtoCartModal`
now wrap the full handler in a synchronous ref latch. This is a legacy-lane
hardening change; the SDK contract and payload schema are unchanged.

## 2026-08-18 rebalance identity-correlation follow-up

The active RN `RebalanceModal` legacy lane now resolves `plan_id`,
`plan_version`, `unique_id`, and model name from one reviewed attempt. When a
stale repair row coexists with a fresh calculate response, the fresh response
wins; repair identity is used only when the modal data has no fresh `uniqueId`.
The same resolved object feeds direct brokers, Fyers, Zerodha buy refit, and
DummyBroker. This is legacy-lane correctness only; the SDK contract is
unchanged, but the future orchestrator must preserve this correlation rule.

## 2026-09-27 verified-shortfall broker-attempt follow-up

The three active RN rebalance review surfaces now distinguish two explicit
shortfall choices. A positive funded budget can still be recalculated with
`continueWithAvailableFunds`; a verified zero budget instead offers
`attemptWithInsufficientFunds`, labelled **Review stocks and attempt buy**.
The latter asks the server to size and freeze the existing target basket while
retaining verified cash at zero. The reviewed basket is executable only when
the server returns `READY_WITH_FUNDING_RISK`; broker rejection remains a valid
terminal result. The choice is calculation-scoped and is recorded in the
frozen plan. Phase C must preserve this distinction and must never infer the
attempt choice from an empty balance alone.
