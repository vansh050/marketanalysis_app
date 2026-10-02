# SDK Orchestration Vision — North-Star Architecture for AlphaQuark Mobile SDK

## Cross-broker terminal truth (2026-09-28)

The Node boundary and both mobile packages expose one status vocabulary while
preserving raw broker words separately. Terminal classification uses the full
row, including requested, filled and unfilled quantity; a broker word alone
cannot contradict explicit quantity evidence. Broker polling is implemented
once through ccxt's production order-book adapters.

## Host-owned reconciliation bridge (2026-08-26)

Until MP execution moves fully into the SDK, the host owns frozen identity on
post-sell refit, verified-cash fail-closed behavior, timed Repair suppression and
the server-directed retry. A future SDK widget must preserve these semantics and must not treat
temporarily empty Repair legs as completion.

> **Status**: design source-of-truth (drafted 2026-05-02). Companion docs:
> `SDK_ORCHESTRATION_AUDIT.md` (per-flow code walks for both apps),
> `SDK_ORCHESTRATION_CONTRACT.md` (TS + Dart parallel API surface),
> `SDK_ORCHESTRATION_PHASES.md` (sequenced migration plan).
>
> **Scope**: covers the AlphaQuark mobile SDK (`@alphaquark/mobile-sdk` —
> RN package + Flutter package) and its two consumer apps:
> Alphab2bapp (React Native, multi-tenant) and tidi_new (Flutter, single
> tenant). Backend touch-points live in `aq_backend_github` and
> `ccxt-india`; this doc references them but does not redesign them.
>
> **Authorial discipline**: same blocking-doc rule as Phase 3 + the
> design-system migration. Any commit that touches an orchestrator
> surface in any of the four repos updates the relevant section of
> this doc, the AUDIT doc, the CONTRACT doc, and the PHASES doc in the
> SAME commit. Undocumented orchestrator deltas block the next
> orchestrator delta.

---

## 1. The vision in one paragraph

The AlphaQuark mobile SDK becomes the **single integration point** for
trade execution and broker management. When a tenant's app wants to
execute a stock advice, subscribe a customer to a model portfolio, or
manage broker connections, it calls **one** SDK method, passes the
business inputs, and receives **one** terminal result. Every step in
between — broker session validation, OAuth re-auth, DDPI / TPIN / EDIS
sell-authorization, per-broker payload assembly, order placement,
status polling, success rendering, error humanization — is owned by
the SDK. Tenants stop maintaining 14 broker-specific code paths and
3 modal-cascade state machines per app per platform.

In short: **the app describes intent; the SDK executes it.**

---

## 2. Where we are vs where we're going

### Today (post-2026-05-02)

```
┌──────────────────────────────────────────────────────────────────┐
│  Alphab2bapp / tidi_new                                          │
│                                                                  │
│  Advice screen → broker checks → DDPI checks → review modal →    │
│   per-broker payload build → axios → success modal → refresh     │
│  (≈ 700-2000 LOC of orchestration glue PER APP PER FLOW)         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             │ 14 callsites in Alphab2bapp,
                             │ ≈4 in tidi_new
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ccxt-india                                                      │
│  /orders/process-trade  (bespoke)                                │
│  /rebalance/process-trade (MP)                                   │
│  /<broker>/place-orders (per-broker)                             │
└──────────────────────────────────────────────────────────────────┘
```

### Vision

```
┌──────────────────────────────────────────────────────────────────┐
│  Alphab2bapp / tidi_new                                          │
│                                                                  │
│  Advice screen ─── sdk.executeAdvice(advice) ───────────────►    │
│  ◄─────────────── AdviceResult ─────────────────────────────     │
│  Show success card / refresh holdings.                           │
│  (≈ 5-30 LOC of glue PER APP PER FLOW)                           │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  @alphaquark/mobile-sdk                                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  executeAdvice() orchestrator                            │    │
│  │  1. Validate broker session (refresh / reauth handoff)   │    │
│  │  2. Sell-auth gate (DDPI / TPIN / EDIS — themed prompts) │    │
│  │  3. Trade review sheet (themed)                          │    │
│  │  4. Per-broker payload assembly                          │    │
│  │  5. Place orders via /sdk/v1/orders/place                │    │
│  │  6. Poll for terminal status                             │    │
│  │  7. Render result modal (themed)                         │    │
│  │  8. Return AdviceResult                                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  connectBroker() / reauth() / manageConnections()        │    │
│  │  (Phase 3 surface — already mostly there, gaps to close) │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  aq_backend_github                                               │
│  /sdk/v1/orders/{place,status,book,cancel}   ← Phase B-1 ✅      │
│  /sdk/v1/connections/* (broker connect)      ← Phase 3 ✅        │
│  /sdk/v1/sell-auth/{check,prompt}            ← Phase D (new)     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ (proxy via aq-encrypted-key)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ccxt-india  (per-broker execution stays here, unchanged)        │
└──────────────────────────────────────────────────────────────────┘
```

The SDK boundary climbs **up** the stack, absorbing orchestration that
today lives in app code. The boundary at ccxt does NOT change — every
broker-specific quirk stays where it is. The SDK is the conductor;
ccxt is the orchestra.

---

## 3. The inversion principle

This is the single mental model that decides every scope question.

> **Today the app drives the SDK is a leaf utility. Vision: the SDK
> drives, the app is the host shell.**

What the host app keeps owning:

- Authentication (Firebase / Apple / Google) and the user-ref bound to
  the SDK provider.
- Navigation primitives (tab bars, drawer, stack).
- Tenant business config (advisor data, branding, pricing tables, GST,
  feature flags).
- Payment gateway integration (Razorpay, Cashfree, PayU, Stripe,
  Apple/Google IAP) — see § 5.
- The advice display surface itself (advice list, MP browse, watchlist,
  holdings).
- Notifications (FCM, Notifee).
- The custom screens unique to a tenant variant.

What the SDK absorbs:

- Broker session lifecycle (was app: `validateBrokerSession`,
  `restore-session`).
- Sell-auth gate orchestration (was app: 5-7 modal cascade across
  RebalanceModal / MPReviewTradeModal / RebalanceAdviceContent).
- Trade review UX (was app: `RebalanceModal` review section,
  `MPReviewTradeModal`, `ReviewTradeModal`).
- Per-broker payload assembly (was app: `buildBrokerPayloadFields` +
  10+ inline `if (broker === ...)` branches).
- Order placement against ccxt (was app: 14 direct callsites in
  Alphab2bapp, ≈4 in tidi_new).
- Status polling.
- Result rendering (was app: `RecommendationSuccessModal`,
  `MPReviewTradeModal` post-place flow).
- Token-expired retry path (was app: `TokenExpireBrokerModal`).
- Per-broker error humanization (was app: scattered).
- Basket execution policy: consume the server-projected lifecycle, authorize
  `(user_email,basketId)` at handoff, let EXIT bypass entry ranges, preserve
  explicit leg priority, and keep Zerodha inside one Publisher navigation.
  Publisher ordering is submission order only; the SDK must never claim a
  hedge-fill dependency that Kite cannot guarantee. This policy is host-owned
  in the 2026-08-16 legacy lane and moves into `executeAdvice` in Phase C.

What the SDK does NOT own:

- Payment gateways (firm — see § 5).
- MP subscription persistence (the `subscriptions` collection write
  stays with the app's existing backend route).
- GST / pricing / plan structures.
- Advisor-admin tooling.

---

## 4. Orchestrator entry points (the public API)

The SDK's orchestrator surface is exactly **four** methods, plus
internal sub-orchestrators that those four call.

### `executeAdvice(advice) → AdviceResult`

The single entry point for **all four** trade-placement flows:

| Today's flow | Today's caller(s) | Tomorrow's call |
|---|---|---|
| Bespoke single trade | `StockAdvices.js`, `OrderService.js`, `IgnoreTradesScreen.js` | `sdk.executeAdvice({ kind: 'bespokeSingle', ... })` |
| Bespoke cart | `AddtoCartModal.js` | `sdk.executeAdvice({ kind: 'bespokeCart', trades })` |
| MP rebalance | `RebalanceModal.js`, `MPReviewTradeModal.js`, `ExecutionStatusScreen.js`, `ModelPortfolioService.js` | `sdk.executeAdvice({ kind: 'mpRebalance', ... })` |
| MP initial allocation (post-payment) | `MPInvestNowModal` post-payment branch, `UserStrategySubscribeModal` | `sdk.executeAdvice({ kind: 'mpInitialAllocation', ... })` |

The orchestrator handles broker session, sell-auth gate, review,
place, poll, result. The app receives one terminal result and either
shows its own success card OR opts into the SDK's themed result
modal — that's a per-call decision via a `presentResult` flag.

For a mixed Zerodha MP basket, `place` is a guarded two-phase operation:
the SDK records immutable tagged intent, opens SELL baskets first, waits for
every requested sell quantity to be broker-confirmed, refreshes live buying
power, and only then opens BUY baskets. A verified numeric shortfall may be
continued explicitly because settlement credit can arrive later; unknown funds,
auth errors, partial sells, or missing broker tags pause without a fallback.

### `connectBroker(brokerName) → BrokerConnection`

Already mostly Phase 3. Gaps documented in AUDIT § Broker connect
gaps. This call goes through the SDK widget tree — credential form,
WebView OAuth, autojump from stored creds — and returns the
established connection. Bypasses re-auth (use `reauth()` for that).

### `reauth(brokerName) → BrokerConnection`

Lifts the legacy reauth bypass. Called either explicitly (user clicks
"Reconnect" on `ManageConnectionsModal`) or implicitly during
`executeAdvice` when session-validation fails. Same SDK widget tree as
fresh-connect; just pre-fills the broker and uses stored creds for
autojump where available.

### `manageConnections() → ConnectedBrokerList | DisconnectResult | RepairResult`

Optional — pending audit on whether this should be SDK-owned. Today
the list view is app-owned; the per-broker disconnect/repair calls
would benefit from SDK ownership for consistent error handling. **AUDIT
will determine the verdict.**

### Internal sub-orchestrators

Called by the public methods, not exposed to the host app:

- `validateBrokerSession(brokerName) → SessionStatus` — auto-refresh
  on expiry, hand off to `reauth()` if can't refresh, else proceed.
- `requireSellAuth(brokerName, trades) → SellAuthStatus` — DDPI / TPIN
  / EDIS check + themed prompt if missing. References
  `SELL_AUTH_ARCHITECTURE.md` for per-broker matrix. Returns
  authorized / declined / not-required.
- `requireFunds(brokerName, trades) → FundsStatus` — fetches funds via
  ccxt, compares against estimated cost, returns sufficient /
  insufficient / cannot-fetch.
- `placeWithPolling(payload) → TradeResult[]` — submits to
  `/sdk/v1/orders/place`, polls `/status` until terminal, returns the
  rows.

---

## 5. Payments — explicitly out of scope

The SDK package does **not** integrate any payment gateway.
Razorpay, Cashfree, PayU, Stripe, Apple IAP, Google IAP — every PG SDK
stays in the host app's bundle. Three blocking reasons:

1. **App-store policy** attaches to the host bundle. Apple and Google
   review the host app's payment UX; they cannot review SDK-only code
   paths. Putting payments in SDK creates an unreviewable surface.
2. **Merchant identity** is per-tenant. Each AlphaQuark tenant is its
   own merchant under RBI / SEBI rules. SDK-owned payment would make
   AlphaQuark a payment aggregator — different regulatory category
   (RBI PA license territory in India), not a path we want to take.
3. **Bundle weight**. Razorpay + Cashfree + PayU + Stripe + IAP libs
   add ~10MB to the bundle. Forcing every consumer to ship every PG —
   even those they don't use — is the wrong default.

**The MP subscribe boundary**:

```
APP (owns)                                SDK (owns)
───────────────────────────────────────────────────────────────
1. Show plan selection
2. paymentGateway.charge()                (app's PG impls)
3. POST /api/subscriptions                (app persists subscription)
4. Compute initial allocation trades
5. ────────────────────────────────►       sdk.executeAdvice({
                                            kind: 'mpInitialAllocation', ...
                                          })
                                          - validate broker session
                                          - sell-auth gate (typically none)
                                          - render review trade sheet
                                          - place orders
                                          - poll for completion
                                          - render result modal
6. ◄────────────────────────────────       return AdviceResult
7. Show subscription-success card
8. Refresh holdings
```

Steps 1-4 + 7-8 are app territory forever. Step 5 is the orchestrator.
Clean handoff at the trade boundary.

---

## 6. Transport — native SDK packages, not hosted iframe

The SDK ships as native packages — `@alphaquark/mobile-sdk` for RN
(npm) and a Dart Pub package for Flutter. Both packages render
**native widgets** (no WebView for the orchestrator itself). WebView
is a tool the orchestrator MAY open for sub-steps where web is the
right surface (Kite Publisher, payment gateway WebViews, OAuth WebView
in the connect flow), but the orchestrator transport itself is native.

Why not hosted iframe / WebView:

- WebView UX is measurably worse on mobile — keyboard, focus, modal
  layering, scroll, native feel. Phase 3 SDK's value comes from the
  native widget surface.
- postMessage bridge is the source of half of Phase 3's bugs (Zerodha
  302 race, three-intercept callback, scope-readiness timeout).
  Orchestration would multiply this risk across more flows.
- Cookie / auth / CORS complexity. Per-tenant subdomains compound it.
- Phase 3 already chose native. A two-tier SDK (native connect + web
  orchestrator) is incoherent UX.
- Native API access (clipboard, biometrics, secure storage) needs
  another bridge layer when WebView-hosted.

Why not headless SDK (state machine + actions, no widgets):

- Phase 3's primary value proposition is that every tenant gets the
  same connect UX **out of the box**. Headless mode means each tenant
  re-implements the UX and they drift. Orchestration would inherit the
  same problem at larger scale.

---

## 7. Theming and shell hooks (so tenants can still skin everything)

The SDK does not lock tenants into a single look. Two layers of
customization, mirroring Phase 3:

### Theme tokens (per `SdkTheme`)

Every SDK-rendered surface — review sheet, sell-auth prompt, result
modal, progress widget — pulls colors / typography / radii / spacing
from a theme object resolved at provider mount. Today the SDK exposes
`PartialSdkTheme`; that surface grows to cover orchestrator widgets
in Phase C+.

### Host hooks (callbacks the app provides)

For things tenants legitimately need to control:

- `onTradePlaced(result)` — host can fire its own analytics, refresh
  its own stores, etc.
- `onSessionExpired(brokerName)` — host can route to its own reauth
  screen if it wants to override the SDK's themed reauth prompt.
- `onSellAuthDeclined(brokerName, reason)` — host can show its own
  support-escalation banner instead of the SDK's default.
- `onError(error)` — host can log to its own Sentry, fire a toast in
  its own toast system, etc. SDK already shows themed error UI; this
  hook is for telemetry, not UI overrides.
- `presentResult` (per-call) — `false` if the host wants to render its
  own success card instead of the SDK's.

These hooks are optional. Defaults yield a complete SDK-driven UX out
of the box.

---

## 8. Failure semantics (the part most likely to cause bugs)

Before any external broker surface is opened, every public orchestrator method
either:

- **Resolves** with a terminal result envelope (success, partial,
  rejected — but always typed and complete), OR
- **Rejects** with a typed `OrchestrationError` whose `code` field is
  one of a fixed enum:
  - `user_cancelled` — user dismissed a modal / pressed back
  - `broker_disconnected` — needed a connected broker, didn't have one
  - `session_unrecoverable` — refresh + reauth both failed
  - `sell_auth_declined` — user actively declined the gate prompt
  - `funds_insufficient` — pre-flight funds check failed (when enabled)
  - `network_error` — terminal network failure after retry budget
  - `internal_error` — unexpected SDK bug; report to Sentry

After an external Publisher surface is opened, uncertainty cannot safely be
represented as a retryable exception: the order may already exist at Zerodha.
In that case `executeAdvice` resolves an `AdviceResult` with
`executionState: 'paused'`, exact per-leg rows, recovery guidance, and
`safeToRetryPlacement: false`. The host MUST show that result and MUST NOT call a
legacy placement fallback. Backend intent reconciliation remains the recovery
witness. This explicit paused state replaces the earlier, unsafe “no mid-flow
half-state” assumption.

The SDK never throws `Error` with a string message into the host's
catch block. Every error is one of the typed codes above with a
human-readable `message` (already humanized by the SDK) and an
optional `recoveryAction` (`'reconnect_broker'`, `'add_funds'`,
`'support_escalation'`, etc.).

---

## 9. Reversibility

Every orchestrator method ships behind a per-flow flag:

- `REACT_APP_USE_SDK_EXECUTE_ADVICE` (RN) / `USE_SDK_EXECUTE_ADVICE`
  (Flutter)
- `REACT_APP_USE_SDK_REAUTH` / `USE_SDK_REAUTH`
- `REACT_APP_USE_SDK_MANAGE_CONNECTIONS` / `USE_SDK_MANAGE_CONNECTIONS`

Default `false`. When off, the host app falls back to its existing
legacy code path. This means **rolling back is a one-line config
change**, not a deploy.

The legacy code paths stay intact for at least one release after the
SDK path goes default-on. Per-tenant rollout via remote config (each
tenant flips the flag when ready — same model as Phase 3).

Specific flags for sub-orchestrators (`useSdkSellAuthGate`,
`useSdkSessionValidation`) MAY land in finer-grained form during the
soak phase if early data shows one sub-step regressing more than
others.

---

## 10. Soak / dual-write (mirrors Phase 3)

For each new orchestrator method, before flipping default-on for any
tenant:

1. **B-2 style shadow**: app calls both legacy and SDK paths, compares
   results, returns legacy to user, logs divergences to
   `trade_dual_write_audit` Mongo collection.
2. **Per-tenant per-broker divergence rate** is the success metric.
3. **Per-broker validation matrix** runs in a test tenant before the
   flag flip — 13 brokers × N tests per orchestrator method.
4. After soak window (~2-4 weeks), per-tenant flip in stages.

The legacy path is deprecated **after** divergence rate is < 0.1% for
two trading weeks straight on a representative tenant.

---

## 11. Cross-platform parity discipline

The two SDK packages — RN and Flutter — must keep identical contract
surfaces. Risk: drift. Mitigation:

- Every `executeAdvice` / `connectBroker` / etc. signature change ships
  in BOTH packages in the same commit cycle.
- The CONTRACT doc (`SDK_ORCHESTRATION_CONTRACT.md`) shows TS + Dart
  side-by-side for every method. PR review checklist requires
  reviewers to confirm parity.
- A new orchestrator method is gated on Flutter parity — RN-only ships
  cause drift.
- Broker capability gaps fail closed. Both packages host the guarded Zerodha
  Publisher UI and return `publisher_unavailable` with affected legs
  `NOT_SUBMITTED` when the UI or Kite key cannot open; neither emulates safety
  by direct-placing the mixed basket.
- AUDIT-pass refresh after every major orchestrator landing — the
  same parallel-agent technique that worked for the design-system
  audit on 2026-05-02 works here.

---

## 12. What success looks like (concrete)

- `MPReviewTradeModal.js` (2151 LOC today) replaced by ~50 LOC that
  calls `sdk.executeAdvice({kind: 'mpRebalance', ...})` and renders the
  caller-side success card from the returned result.
- `RebalanceModal.js` (2650 LOC today) — same.
- `RecommendationSuccessModal.js` (1152 LOC) — host app's call goes
  through SDK's themed result modal (when `presentResult: true`) OR
  the host renders its own card from `AdviceResult` (when
  `presentResult: false`). Either way, this 1102-LOC component shrinks
  to <100 LOC of presentational glue.
- The 14 direct ccxt callsites in Alphab2bapp collapse to ≈4 (one per
  advice kind).
- `TokenExpireBrokerModal.js`, `DdpiModal.js`,
  `AngleOneTpinModal.js`, `DhanTpinModal.js`, `FyersTpinModal.js`,
  `OtherBrokerModel.js` — all replaced by the SDK's sell-auth +
  session-validation orchestration.
- tidi_new MP rebalance flow shrinks similarly.
- A new tenant onboarding to AlphaQuark integrates by mounting
  `<AqSdkProvider>`, calling `sdk.executeAdvice()` on advice tap, and
  shipping a theme. No per-broker code, no modal cascade, no payload
  builders.

---

## 13. What this doc does NOT cover

- Tenant onboarding mechanics (mint server tenant provisioning is
  already documented in `SdkProviderRoot.js` comments).
- ccxt-india internals (broker-specific endpoint reorganization is
  out of scope for the orchestration migration).
- The web frontend (`prod-alphaquark-github`) — SDK lift for web is a
  separate decision tracked elsewhere. The contract designed here
  should be web-compatible, but no web work is in this plan.
- Real-time price feeds (LTP) — those stay app-owned via socket.io.
- KYC, account opening — never in SDK scope.

---

## 14. References

- `docs/PHASE3_ARCHITECTURE.md` — broker-connect SDK migration (the
  template)
- `docs/PHASE3_BROKER_AUDIT.md` — per-broker verdict matrix
- `docs/PHASE3_PROGRESS.md` — Phase 3 commit log
- `docs/SDK_TRADE_EXECUTION_MIGRATION.md` — Phase B (now subsumed by
  this doc; B-1 deliverables remain valid as foundation)
- `docs/SELL_AUTH_ARCHITECTURE.md` — sell-auth canonical reference
- `docs/SDK_MOBILE_FIT_ASSESSMENT.md` — pre-orchestration fit study
- `docs/SDK_PARITY_AUDIT.md` — RN vs Flutter parity log
- `docs/SDK_ORCHESTRATION_AUDIT.md` — the per-flow walks (this doc's
  sibling — read it next)
- `docs/SDK_ORCHESTRATION_CONTRACT.md` — TS + Dart API contract
- `docs/SDK_ORCHESTRATION_PHASES.md` — sequenced migration plan
