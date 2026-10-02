# Web → Mobile Parity Migration Plan — RIA Billing · NBA / Portfolio Health · Recurring Payments

**Status:** PLAN — not yet built. **Eng-reviewed 2026-06-08 (Claude + Codex outside-voice); 18 decisions LOCKED — see §8.1.** Design lockups gated (§9).
**Created:** 2026-06-08
**Source:** `prod-alphaquark-github` (React web, branch `feature/4.0`)
**Target:** `Alphab2bapp` (React Native, v3.9.69)
**Owner:** Pratik
**Template followed:** `docs/COURSES_WEBINARS_MOBILE_PORTING.md` (the canonical, already-shipped web→mobile port)

> ⚠️ This is a PLANNING document. Per the request: get on a plan → engineering review →
> lock designs → only then migrate. **No feature code is written yet.** Each workstream
> ships behind a per-advisor flag defaulting OFF, exactly like the Courses/Webinars port.

---

## 1. Executive Summary

Over the last ~5 weeks the web app shipped three significant customer-facing feature
clusters that the mobile app does **not** have:

| Cluster | Web status | Mobile status | Net effort |
|---|---|---|---|
| **RIA AUM Billing** (customer read surfaces: Performance value-history chart, Fee Statement / invoices, per-MP returns) | Phase 1–3 AS-BUILT, behind `riaBillingEnabled` (default OFF) | ❌ Absent | **Medium** (read-only; well-bounded API) |
| **NBA + Portfolio Health** (home Next-Best-Action card + status strip, consent-gated Portfolio Health tool, Transition diff) | On `feature/4.0`; flags default OFF; LIVE for Alphaquark tenant | ❌ Absent | **Medium-High** (pure engines port cleanly; UI is net-new) |
| **Recurring Payments** (CashFree eNACH mandate, Razorpay native subscription, PayU SI, provisional-access banner, coupon ₹0 guard) | LIVE | ⚠️ Partial (frequency-based subscribe exists; **no mandate / provisional / eNACH UI**) | **Medium-High** (native mandate flow is the hardest single item) |

**Smaller in-flight web items also worth porting** (see §7): rebalance "Buying Power"
readiness panel, course coupon UI + revenue-leak guard (mobile already has CashFree course
purchase; needs the ₹0 guard), broker reconnect / change-broker UX.

**The single most important enabler** (§4.1): the new web flags
(`nbaHomeEnabled`, `portfolioHealthEnabled`, `transitionEngineEnabled`, `riaBillingEnabled`)
are served to web by `/api/admin/frontend-config`, but mobile hydrates config from
`/api/app-advisor/get`. **Both read the same `ccxt_common_db.advisor_config` collection.**
`AppAdvisorRouter.js` already merges `courses_enabled` / `webinars_enabled` from there
(lines 342–365) — so exposing the new flags to mobile is a small, additive backend change
following a proven pattern, not new infrastructure.

---

## 2. Scope

### In scope (customer-facing only)
1. RIA Billing **read** surfaces — Performance chart, Fee Statement, invoices, per-MP returns.
2. NBA home card + status strip, Portfolio Health tool, Transition diff.
3. Recurring-payment customer flows — mandate registration, provisional-access banner,
   subscription-status surfacing, coupon UI + ₹0 guard.
4. Cross-cutting foundations (§4): flag parity, pure-engine port, charting, API clients.

### Out of scope (admin / backend — the app is customer-facing)
- All admin-dashboard surfaces: `RiaBillingConfig`, `RiaAumHealth`, `RiaCapLog`,
  AllInvoices admin tab, PaRRVA admin banner, Strike-Ladder picker, supportAQ.
- Backend-only machinery the app only needs to be **compatible** with, never replicate:
  `utilities/subscriptionEntitlement.js`, `CronRecurringChargeReconciliation.js`,
  `CashFreeSubscriptionWebhook.js`, the RIA snapshot/cashflow/invoice crons.
- RIA invoice **issuance** (advisor action) — customer only **views/downloads**.

### Explicitly deferred (decide during eng review)
- Per-MP XIRR/TWRR headline on the MP card — **not yet shipped on web** (web doc §13
  marks it PLANNED). Do not port ahead of web.
- Transition diff home-mount — web keeps it OFF / unmounted (Phase 2). Port the engine +
  card but gate behind `transitionEngineEnabled` and do not wire to home until web does.

---

## 3. Feature Inventory & Gap Matrix

### 3.1 RIA AUM Billing — customer surfaces

| Web file | Renders | API | Flag | Live? |
|---|---|---|---|---|
| `src/Home/PerformanceSection/PerformanceSection.js` | Value-over-time line chart (recharts) + 3 stat cards (current / invested / gain) + portfolio selector | `GET /api/ria-billing/me/value-history?email=` → `{summary, series[], by_model[]}` | `riaBillingEnabled` | Phase 1 AS-BUILT |
| `src/Home/FeeStatementSection/FeeStatementSection.js` | Contract strip + invoice table (Period/#/Status/AUA/Fee/GST/Total/View) | `GET /api/ria-billing/me/invoices?email=`, `GET /api/ria-billing/me/contract?email=`, `GET /api/ria-billing/me/invoice/{id}/pdf?email=` | `riaBillingEnabled` + `billing_mode=="AUA"` | Phase 3 AS-BUILT |
| `src/Home/ModelPortfolioSection/ModalPFCard.js` | (Planned) XIRR/TWRR readouts | existing MP endpoints | `showPerformance` | **NOT shipped — do not port yet** |

All three endpoints are **read-only**, no auth changes. PDF is a server-rendered blob.

### 3.2 NBA + Portfolio Health

| Web file | Renders | API | Flag |
|---|---|---|---|
| `src/components/NbaCard/NbaCard.jsx` + `NbaPreview.jsx`, mounted in `src/Home/RootSection/DashboardLayout.js` | One ranked action card + Broker·KYC·Health status strip | composes existing user/trade/rebalance endpoints | `nbaHomeEnabled` |
| `src/utils/nbaRanking.js` | **Pure** signal-ranking engine (no DOM) | — | — |
| `src/components/PortfolioHealth/PortfolioHealthModal.jsx` + `PortfolioHealthCard.jsx` | Consent-gated factual gap checklist (SEBI: facts only, no advice) | `POST /api/model-portfolio/portfolio-health {holdings, enabled, thresholds, email}` | `portfolioHealthEnabled` + `portfolioHealth` sub-config |
| `src/utils/portfolioHealth.js` | **Pure** `computeHealthSubScores()` | — | — |
| `src/hooks/usePortfolioHealth.js` | instant client compute + background server reconcile | same POST | — |
| `src/components/PortfolioTransition/PortfolioTransitionCard.jsx` | Alignment % + keep/trim/exit/add/topup buckets (RA-attributed advice) | none (pure) | `transitionEngineEnabled` (Phase 2, unmounted) |
| `src/utils/portfolioTransition.js` | **Pure** `computeTransition()` + `blendTargets()` | — | — |
| `src/context/CustomerStateContext.js` | Single source of truth: broker status (75s TTL), user, trades, rebalances, holdings-for-health | `/api/user/getUser/{email}`, `/api/user/trade-reco-for-user`, `/api/model-portfolio/subscribed-strategies` | — |

**The three pure engines (`nbaRanking`, `portfolioHealth`, `portfolioTransition`) have zero
React/DOM dependencies and port verbatim to RN.** This is the lowest-risk, highest-leverage
part of the whole migration.

### 3.3 Recurring Payments

| Web file | Renders | API | Port? |
|---|---|---|---|
| `src/Home/PricingSection/PricingPage.js` + `PlanSubscribeModal.js` | Plan cards + frequency selector + gateway selector + recurring init | `/api/admin/plan/...`, `/api/cashfree/initiate-recurring`, `/api/admin/subscription/complete-payment`, `/api/payu/si/register` | YES (extend existing `PaymentHandle.js`) |
| `src/components/ProvisionalAccessBanner/ProvisionalAccessBanner.js` | Amber "access granted, bank confirmation pending" banner | `GET /api/subscription-check/provisional/{email}` | YES (net-new) |
| coupon UI in `PlanSubscribeModal.js` + Step4 | Coupon apply + ₹0 (100%-discount) guard | coupon validate endpoint | YES (mobile lacks the ₹0 guard) |
| **Backend-only** | `subscriptionEntitlement.js`, recon cron, subscription webhook | — | **NO — compatibility only** |

Mobile today: `src/FunctionCall/PaymentHandle.js` (Razorpay RN SDK, CashFree via WebView,
PayU backend), `subscribeToPlan()` for frequency plans. **Missing:** eNACH mandate
registration, provisional banner, the ₹0 coupon guard.

---

## 4. Cross-Cutting Foundations (build these first — they unblock everything)

### 4.1 Flag parity — `advisor_config` → mobile config  *(do this first)*
**Problem:** new flags reach web via `/api/admin/frontend-config`; mobile uses
`/api/app-advisor/get`.
**Fact:** `AppAdvisorRouter.js` already reads `ccxt_common_db.advisor_config` (lines 342–365)
and merges `courses_enabled` / `webinars_enabled`. Web's flags come from the **same**
collection keys: `nba_home_enabled`, `portfolio_health_enabled`, `transition_engine_enabled`,
`aum_billing.enabled`, `portfolio_health` (sub-config object).
**Work (backend, aq_backend_github):** in `AppAdvisorRouter.js`, alongside the existing
`config.coursesEnabled = advisorConfig.courses_enabled ?? false` block, add:
```js
config.nbaHomeEnabled         = advisorConfig.nba_home_enabled === true;
config.portfolioHealthEnabled = advisorConfig.portfolio_health_enabled === true;
config.transitionEngineEnabled= advisorConfig.transition_engine_enabled === true;
config.portfolioHealth        = advisorConfig.portfolio_health || undefined;
config.riaBillingEnabled      = advisorConfig.aum_billing?.enabled === true;
```
**Work (mobile, ConfigContext.js):** mirror lines 211–212 (`coursesEnabled`):
```js
nbaHomeEnabled:          apiData.nbaHomeEnabled         ?? false,
portfolioHealthEnabled:  apiData.portfolioHealthEnabled ?? false,
transitionEngineEnabled: apiData.transitionEngineEnabled?? false,
portfolioHealth:         apiData.portfolioHealth        ?? undefined,
riaBillingEnabled:       apiData.riaBillingEnabled      ?? false,
```
Cache them in the AsyncStorage persist block too (mirror lines 359–362).
**LOCKED (D3):** mobile calls `/api/admin/frontend-config` directly (reuses web's exact
response shape, zero backend change) rather than extending `AppAdvisorRouter`.
**P0 gates that come WITH this choice (Codex T5/T7):**
- Confirm `/api/admin/frontend-config` does NOT require admin auth and accepts the mobile
  `X-Advisor-Subdomain` header. If it gates on admin → fall back to extending `AppAdvisorRouter`.
- The flags must ALSO be written into the AsyncStorage / `TradeContext` cache path, not only
  `ConfigContext`. Today `ConfigContext` syncs just 3 broker fields back to storage
  (`ConfigContext.js:370`), so `useConfig()` and `configData` (read by `TradeContext.js:59`)
  can DISAGREE on a new gate. Persist every new flag through both or the gate is non-deterministic.
- Parallelize the two launch config fetches (`/app-advisor/get` + `/admin/frontend-config`) so
  cold-start latency doesn't grow serially.
**Risk:** Low-medium (was Low — the dual-config split raises it). Proven pattern, additive, default-OFF.

### 4.2 Pure-engine port  *(copy + pin + drift tripwire — LOCKED D2)*
Copy `nbaRanking.js`, `portfolioHealth.js`, `portfolioTransition.js` into
`src/utils/` (or `src/FunctionCall/engines/`). They have **no DOM/React deps**.
**LOCKED (D2):** (a) header-comment each engine file with the **source web commit hash** it was
copied from; (b) **port the web unit tests verbatim** into `__tests__/utils/` so a behavioral
mismatch fails CI loudly — this is the drift tripwire, not human memory. When web changes an engine,
the pinned hash + failing test force a conscious re-sync. This guarantees the SEBI-sensitive logic
(factual-only health, RA-attributed transition) stays byte-aligned with web instead of silently
diverging on regulated behavior.

### 4.3 Charting
Web uses **recharts** (not available in RN). Mobile already ships **react-native-chart-kit**
(line/bar) + **react-native-pie-chart**. The value-history surface is a single time-series
line. **LOCKED (D8): use `victory-native`** for the AUM history (richer touch tooltips/gestures,
room for future XIRR overlays). Adds a new native dep (`react-native-svg`/skia) — verify the iOS pod
+ Android gradle wiring during P1, and standardize future charts on victory-native rather than running
it alongside chart-kit long-term (one innovation token spent, not two).

### 4.4 RIA billing API client
New service `src/FunctionCall/services/RiaBillingService.js` mirroring web's
`RiaBillingService` — `getValueHistory`, `getMyInvoices`, `getMyContract`, `openInvoicePdf`.
Reuse the established `getAuthedHeaders()` pattern from the courses port
(`X-Advisor-Subdomain` + `aq-encrypted-key` + Firebase `Authorization: Bearer`).
**LOCKED (D6, security):** send the Firebase bearer; do NOT trust a client-passed `?email=` for
identity. Backend hardening item (see §8.2): `/api/ria-billing/me/*` must derive email from the
token (or verify query-email == token-email) before returning financial data — otherwise it is an
IDOR on invoices/AUA/fees. **P0 gate (Codex T7):** confirm which HOST owns these routes —
`server.alphaquark.in` (Node) vs `ccxtprod.alphaquark.in` (ccxt comms). Existing mobile invoice/PDF
calls go to ccxt comms (`PaymentHistoryScreen.js:40`), so do NOT assume a single Node base URL;
resolve the host via `serverConfig.js` before building the client.

---

## 5. Per-Feature Migration Design

> Every screen follows the app's **container/presentation + design-system split**
> (tokens → primitives → composites → screens; `designs/default/`). Per CLAUDE.md, the
> default variant ships upstream; tenant forks override in their own `designs/<variant>/`.

### 5.0 Design-folder placement (MANDATORY — match the existing convention)

All **presentation** lives under `designs/default/` and is pulled into `src` via the design
registry (`src/design/useDesign.js` `useComponent(...)` / `resolveDesign.js` / `DesignProvider`),
exactly like `designs/default/screens/HomeScreen.js` and the `PortfolioScreen` container at
`src/screens/PortfolioScreen/PortfolioScreen.js` (which imports its body via `useComponent`).
**Do NOT drop new screens directly in `src/screens`.** Thin container in `src`, presentation in
`designs/default`, wired through the registry so white-label variants can override.

| Surface | Presentation (`designs/default/`) | Container / wiring (`src/`) | Logic (`src/`, not design) |
|---|---|---|---|
| Fee Statement | extend `designs/default/screens/` PaymentHistoryScreen presentation | `src/screens/Drawer/PaymentHistoryScreen.js` (container) | `src/FunctionCall/services/RiaBillingService.js` |
| AUM Performance | new `designs/default/composites/AumPerformanceCard.js`, consumed by the refactored `MPPerformanceScreen` presentation | `src/screens/Drawer/MPPerformanceScreen.js` (container) | RiaBillingService |
| Portfolio Health | new `designs/default/composites/PortfolioHealthSheet.js` | mounted from `HomeScreen` container | `src/utils/portfolioHealth.js` (engine), `src/context/CustomerStateContext.js` |
| NBA banner + strip | new `designs/default/composites/NbaBanner.js` + `NbaStatusStrip.js` | `designs/default/screens/HomeScreen.js` slot | `src/utils/nbaRanking.js` (engine) |
| eNACH mandate | new `designs/default/screens/AutoPaySetupScreen.js` + `composites/ProvisionalBanner.js` | container at the live seam (`MPInvestNowModal`/`InvestFlowScreen`) | shared `validateChargeableAmount()` helper |

Engines (`nbaRanking`/`portfolioHealth`/`portfolioTransition`) and the service are **logic, not
design** → they stay in `src/utils` / `src/FunctionCall/services`. Only the visual components go in
`designs/default/`. Register each new composite/screen in `designs/default/index.js` + the registry
so `useComponent` resolves it and tenant variants can override.

> **Lockup artifacts** (the wireframe board) live in the gstack designs store
> (`~/.gstack/projects/<slug>/designs/`), NOT in the repo — they're design references, not shipped
> code. Only the built `designs/default/` components are committed.

### 5.1 RIA Billing (read surfaces)
- **Service:** `RiaBillingService.js` (§4.4).
- **Fee Statement — LOCKED (D15): EXTEND the existing `PaymentHistoryScreen.js`** (reachable from
  `AccountSettingsScreen`) rather than building a new `FeeStatementScreen`. Add the RIA
  invoice/contract data + AUA/fee/GST columns into that screen and REUSE its existing PDF
  save/open/share helper. This supersedes the old "new screen" + new-PDF-path plan — the app already
  has working invoice-list + PDF plumbing; don't duplicate it.
- **PDF — LOCKED (D7, narrowed by D15):** reuse `PaymentHistoryScreen`'s existing fetch→cache→native
  viewer/share helper for the authed blob. (Net effect of D7 + D15: no new PDF path at all.)
- **Performance value-history — LOCKED (D14→C):** **refactor `MPPerformanceScreen` into composites
  FIRST** ("make the change easy, then make the easy change" — Beck), THEN add the AUM
  value-history + stat-cards + per-MP selector as a gated section. The screen is a 2220-line
  rebalance/payment/chart surface (repo design audit); the decomposition is a P1 prerequisite and
  the biggest single effort add from the review. Add regression coverage on the screen since we touch it.
- **Discoverability — LOCKED (D17):** the right drawer is currently unreachable
  (`swipeEnabled:false`, no `openDrawer()` caller). **Re-enable the drawer first** (investigate WHY
  it was disabled before flipping it), and keep the HomeScreen NBA card as the primary discovery path.
- **Flags:** `riaBillingEnabled` gates everything; Fee Statement additionally requires
  `billing_mode === "AUA"` from the contract response. Default OFF.
- **Mobile deltas:** invoice table → vertical stacked cards inside PaymentHistoryScreen.
  **Needs design lockup (§9).**

### 5.2 NBA + Portfolio Health
- **Engines:** §4.2 (already copied).
- **State context:** port `CustomerStateContext` logic into an RN context
  (`src/context/CustomerStateContext.js`). Replace `localStorage` consent
  (`aq_health_holdings_consent`) with **AsyncStorage**; replace the `aq:broker-connected`
  window event with the app's existing broker-connect callback / nav event.
  **LOCKED (D5):** revalidate on TTL + RN `AppState` foreground + screen `useFocusEffect` +
  broker-connect callback (web's `window`-focus/event analogues). **LOCKED (D12):** coalesce with a
  single in-flight promise + ~300ms debounce + last-write-wins by request timestamp, so
  foreground+focus+event don't stampede 3 overlapping fetches.
- **NBA card:** new composite `designs/default/composites/NbaCard.js` + a `NbaPreview`
  container mounted on `HomeScreen`. Status strip = Broker · KYC · Health chips reusing
  broker-status classification already present in the app (Phase 3 broker work).
- **Portfolio Health:** present as a **bottom sheet** (RN idiom), not a modal — mirrors the
  `BuyWebinarTicketSheet` pattern from the courses port. Consent step → holdings fetch →
  instant client compute + background `POST /api/model-portfolio/portfolio-health` reconcile.
  **LOCKED (D18):** the canonical holdings input is the normalized **`useMultiBrokerHoldings()`**
  aggregate (NOT raw `allHoldingsData` or plan-scoped summaries) — map it once to the shape the pure
  engine expects, so SEBI gap-scores don't drift by surface.
- **Transition:** port engine + `PortfolioTransitionCard` composite, gate `transitionEngineEnabled`,
  **do not mount on home** until web does. RA-attribution header is mandatory (SEBI).
- **Flags:** `nbaHomeEnabled`, `portfolioHealthEnabled` (independent), `transitionEngineEnabled`.
- **Mobile deltas:** broker reconnect uses WebView OAuth (not web redirect events); consent =
  AsyncStorage; card layout is net-new. **Needs design lockup (§9).**

### 5.3 Recurring Payments
- **Build seam — LOCKED (D16):** add recurring/mandate/provisional logic at the **live** payment
  seam — `src/components/ModelPortfolioComponents/MPInvestNowModal.js` + `src/screens/Invest/
  InvestFlowScreen.js` — NOT legacy `PaymentHandle.js` (structurally poor, likely not the live path).
  CashFree eNACH → ₹0 AUTH = mandate registration (communicate clearly: "₹0 now, auto-debit on
  confirmation", **not** a charge).
- **P0 gate (Codex T8):** `paymentPlatform` is not a stable contract today — `PayUService` exists in
  code but `API_REFERENCE.md` documents `razorpay | cashfree` only. Reconcile the contract (code vs
  doc) BEFORE building gateway routing on `config.paymentPlatform`.
- **Coupon ₹0 guard — LOCKED (D10, DRY):** one shared `validateChargeableAmount()` helper called by
  BOTH the subscription seam AND the existing course-purchase path — if final amount ≤ ₹0, refuse the
  gateway call and show "100% discount requires manual activation; contact your advisor." Adding it to
  the existing course path is a behavior change → **regression test required (CRITICAL, §11).**
- **Provisional banner:** new composite fed by `GET /api/subscription-check/provisional/{email}`
  → amber notice + grace deadline. Surface on Home + relevant subscription screens. (Same bearer-auth
  identity rule as D6 — don't trust client `?email=`.)
- **eNACH mandate — LOCKED (D4): spike-first, WebView default.** Time-boxed spike (CashFree RN SDK
  mandate API vs hosted-page-in-WebView) → 1-page decision doc + the design lockup; default to the
  WebView hosted page unless the SDK clearly wins. Ships LAST, flag-gated. The spike also confirms
  the D16 live seam.
- **Mobile deltas:** the eNACH mandate consent UX is the **highest-risk** item. **Needs design lockup +
  the spike (§9).**

---

## 6. Phased Rollout (slice methodology, mirrors the Courses port)

Each phase is independently shippable, behind flags default-OFF, doc-updated per CLAUDE.md.

- **P0 — Foundations:** §4.1 flag parity (backend + ConfigContext) · §4.2 pure-engine copy
  + tests · §4.4 RiaBillingService skeleton. *No user-visible change.*
- **P1 — RIA Billing read (lowest risk):** Performance value-history card + Fee Statement
  screen + invoice list. PDF view. Gate `riaBillingEnabled`. **Ship first** — read-only,
  bounded, no native-flow risk.
- **P2 — Portfolio Health tool:** consent sheet + health engine + server reconcile. Gate
  `portfolioHealthEnabled`. Factual-only (SEBI).
- **P3 — NBA home card + status strip:** ranking engine + card + Broker·KYC·Health strip.
  Gate `nbaHomeEnabled`. Reuses P2 health signal.
- **P4 — Recurring payments:** provisional banner + coupon ₹0 guard first (low risk), then
  the eNACH mandate flow (after the §8-D4 spike). Gated by existing payment config.
- **P5 (deferred) — Transition diff:** engine + card, unmounted; activate only when web does.

**Sequencing rationale:** P1 delivers value with the least risk and proves the flag-parity +
charting + API-client foundations. The risky native mandate flow (P4) lands last, after a spike.

---

## 7. Smaller / Adjacent Web Items (sweep during the above)

| Web change | Mobile action | Phase |
|---|---|---|
| Rebalance "Buying Power" readiness panel (`feat(rebalance-ui)` 06-08) | Port into `RebalanceReviewScreen` — connect/refresh/proceed states for no-broker/manual | P3/P4 |
| Course coupon ₹0 revenue-leak guard (`fix(courses,payment)` 06-08) | Add guard to mobile course purchase (CashFreeOrderService) | P4 |
| Coupon-validate response-shape tolerance | Mirror in mobile CouponService | P4 |
| Broker reconnect / change-broker UX (NBA-adjacent) | Verify Phase-3 broker work covers it; gap-fill | P3 |

---

## 8. Engineering Review (embedded — also run interactive `/plan-eng-review` before build)

### Risks
- **R1 — Flag source split.** *Mitigated* (§4.1): same `advisor_config` source, proven
  `courses_enabled` pattern. Verify each advisor that wants the feature has the key set;
  default-OFF protects everyone else.
- **R2 — Engine drift.** Web engines evolve; mobile copies could diverge. *Mitigation:* port
  the web unit tests verbatim; treat the three engines as a shared contract; add a CHANGELOG
  note to re-sync on any web engine change.
- **R3 — PDF rendering.** No browser tab on mobile (§8-D2).
- **R4 — eNACH mandate native UX.** Highest risk; web uses hosted-page redirect, mobile needs
  a WebView or native SDK mandate flow (§8-D4). De-risk with a spike before P4.
- **R5 — SEBI boundary.** Portfolio Health must stay factual (no buy/hold/sell); Transition
  must carry RA attribution. Porting the pure engines unchanged preserves this — **do not
  "improve" the copy** in the mobile UI.
- **R6 — Holdings normalization.** Health/Transition need holdings across broker shapes; reuse
  the app's existing multi-broker holdings path, don't re-derive.

### 8.1 LOCKED Decisions (eng review 2026-06-08, Claude + Codex outside-voice)

| # | Decision | Outcome |
|---|---|---|
| D1 | Build scope | **Full four-cluster program** (user override of the "core-first" rec). Phasing = rollout sequencing only. |
| D2 | Engine sharing | **Copy + pin source commit hash + port web unit tests as CI drift tripwire.** Not a shared package. |
| D3 | Flag source | **Mobile calls `/api/admin/frontend-config` directly.** P0: verify no admin-auth gate; ALSO persist flags to AsyncStorage/`TradeContext` path (not just `ConfigContext`); parallelize launch fetches. |
| D4 | eNACH flow | **SPIKE DONE (docs/ENACH_SPIKE_D4.md) — flips default to NATIVE `doSubscription`.** The RN SDK (`react-native-cashfree-pg-sdk`, already used for `doPayment` at the `MPInvestNowModal` seam) exposes `CFSubscription`/`doSubscription`, and the backend already mints 2025-01-01 `/subscriptions`. Native primary; WebView hosted-link kept as fallback. 2 gates before P4: G1 confirm `subscription_session_id` in the create response, G2 device smoke. Confirms the D16 seam. Ships last, flag-gated. |
| D5 | State refresh | **Revalidate on TTL + AppState-foreground + screen-focus + broker-connect callback.** |
| D6 | Billing auth | **Firebase bearer; backend derives/verifies email server-side** (closes IDOR). Do not trust client `?email=`. |
| D7 | PDF | Reuse existing `PaymentHistoryScreen` PDF helper — **net effect with D15: no new PDF path.** |
| D8 | Chart lib | **victory-native** (user override of chart-kit rec). New native dep — verify pod/gradle; standardize future charts on it. |
| D9→D14 | Perf placement | Superseded: **refactor `MPPerformanceScreen` into composites FIRST, then add the gated RIA section** (D14 option C). |
| D10 | ₹0 guard | **One shared `validateChargeableAmount()` helper** for subscription + course paths (DRY). |
| D11 | Test depth | **Unit + E2E** on the two highest-consequence flows (Portfolio Health consent→gaps; money flows). |
| D12 | Refetch coalescing | **In-flight guard + ~300ms debounce + last-write-wins.** |
| D15 | Fee Statement | **Extend existing `PaymentHistoryScreen`** (reachable today) instead of a new `FeeStatementScreen`; reuse its invoice-list + PDF plumbing. |
| D16 | Payment seam | **Build at the live seam** (`MPInvestNowModal` + `InvestFlowScreen`), NOT legacy `PaymentHandle.js`. |
| D17 | Discoverability | **Re-enable the right drawer first** (investigate why it was disabled); HomeScreen NBA card stays the primary discovery path. |
| D18 | Holdings contract | **`useMultiBrokerHoldings()` normalized aggregate** is the single canonical input to the engines. |

**Recorded dissent (Codex, NOT adopted — D1 stands):** Codex argued to (a) drop Transition from
scope and (b) split into three plans because the clusters don't share a clean foundation. User chose
the full program; Transition stays minimized (engine + card, unmounted, flag-OFF). Revisit if Transition
upkeep proves not worth it.

### 8.2 Backend dependencies & hardening items (confirm host + auth before P1)
- `/api/ria-billing/me/{value-history,invoices,contract,invoice/:id/pdf}` — **confirm HOST** (Node
  `server.alphaquark.in` vs `ccxtprod` — existing mobile invoices hit ccxt comms). Resolve via `serverConfig.js`.
- **HARDENING (D6):** make `/api/ria-billing/me/*` + `/api/subscription-check/provisional/*` derive/verify
  email from the auth token before returning financial data — backend ticket, fixes web + mobile IDOR.
- `/api/model-portfolio/portfolio-health` (POST) — health reconcile.
- `/api/admin/frontend-config` — **confirm reachable from mobile without admin auth** (D3).
- `paymentPlatform` contract — reconcile `PayUService` (code) vs `API_REFERENCE.md` (`razorpay|cashfree`) before routing.

### 8.3 What already exists (reuse, don't rebuild)
- **Courses/Webinars port** — the proven web→mobile template (services + screens + sheets).
- **`PaymentHistoryScreen`** — invoice list + PDF save/open/share (D15/D7 reuse it).
- **`MPInvestNowModal` + `InvestFlowScreen`** — live payment orchestration (D16 builds here).
- **`useMultiBrokerHoldings()`** — normalized holdings aggregate (D18 canonical input).
- **`ConfigContext` + `/app-advisor/get`** flag plumbing, Phase-3 broker-status classification.
- **The 3 web pure engines** — copied, not rewritten (D2).

### 8.4 NOT in scope (explicitly deferred)
- All admin surfaces (RIA config/health/cap, PaRRVA banner, strike-ladder, supportAQ) — customer app only.
- Backend machinery (entitlement util, recon cron, subscription webhook, RIA snapshot/invoice crons) —
  compatibility only, never replicated.
- RIA invoice **issuance** (advisor action) — customer only views/downloads.
- Per-MP XIRR/TWRR headline on the MP card — **not yet shipped on web**; do not port ahead.
- Transition home-mount — engine + card only, unmounted until web mounts it.

### 8.5 Failure modes (new codepaths)
| Codepath | Realistic failure | Test? | Error handling? | Silent? |
|---|---|---|---|---|
| RiaBillingService | wrong host / 401 from bearer mismatch | D11 service test | needs explicit empty/error state | would be silent → **handle** |
| CustomerStateContext refetch | overlapping triggers → stale write | D12 unit test | in-flight guard | covered |
| Portfolio Health holdings | broker shape mismatch → wrong gap score | D18 + engine tests | normalize once | **critical if unhandled** |
| ₹0 guard on course path | regression: guard breaks existing purchase | **CRITICAL regression test** | shared helper | covered |
| eNACH mandate callback | WebView return not captured → phantom-pending | E2E post-spike | spike defines | risk until spike |

### 8.6 Parallelization (worktree lanes)
- **Lane A (foundations, blocks all):** D2 engine copy+tests · D3 flag plumbing · D6/8.2 backend host+auth verify. Sequential, do first.
- **Lane B (RIA read):** `MPPerformanceScreen` refactor → RIA section · `PaymentHistoryScreen` Fee Statement. Shared = perf/invoice screens; sequential within lane. Independent of C/D after Lane A.
- **Lane C (Health/NBA):** CustomerStateContext · Health sheet · NBA card. Shares the context with nothing in B/D. Parallel to B.
- **Lane D (payments):** drawer re-enable (D17, independent) ‖ ₹0 guard + provisional (live seam) → eNACH spike → mandate. Conflict flag: Lane B + Lane D both eventually touch invoice/payment surfaces — coordinate.
- **Order:** A first → B + C + D17 in parallel worktrees → eNACH last.

---

## 9. Design Lockups Required (before coding each surface)

Web layouts (tables, side-by-side recharts, modals) do **not** map 1:1 to a phone. The
following need a mobile mockup signed off **before** the corresponding phase starts. Surfaces
that reuse an existing composite need **no** new mockup.

| Surface | Mockup needed? | Why |
|---|---|---|
| **Fee Statement (in `PaymentHistoryScreen`)** | ✅ Yes | RIA invoice rows + AUA/GST/total hierarchy as vertical cards INSIDE the existing invoice screen (D15); reuses its PDF helper |
| **Performance value-history (in refactored `MPPerformanceScreen`)** | ✅ Yes | victory-native line + stat cards + per-MP selector as a gated section after the screen is decomposed (D14→C); chart interaction model |
| **Portfolio Health sheet** | ✅ Yes | Bottom-sheet (not modal): consent step → gap checklist; SEBI-safe factual tone |
| **NBA card + status strip** | ✅ Yes | Net-new focal-action card + Broker·KYC·Health chips on HomeScreen; ranking presentation |
| **Provisional-access banner** | ◻️ Light | Reuse existing banner/Toast/Pill primitive; copy + amber token only |
| **eNACH mandate flow** | ✅ Yes (after D4 spike) | Native mandate consent/OTP UX; depends on WebView-vs-SDK decision |
| **Transition diff card** | ✅ Yes (P5) | Alignment % + keep/trim/exit buckets + mandatory RA-attribution header |
| Coupon ₹0 guard | ◻️ No | Inline validation/error in existing payment sheet |
| Rebalance Buying-Power panel | ◻️ Light | Extend existing RebalanceReviewScreen states |

Recommended: produce lockups with `/design-shotgun` (mobile variants) or hand to design,
using `docs/DESIGN_SYSTEM_ARCHITECTURE.md` + `docs/COLOR_TOKENS.md` tokens, then iterate.

---

## 10. Documentation Obligations (per both repos' CLAUDE.md)

- **Mobile (this repo):** update `APP_ARCHITECTURE.md`, add per-feature sections; this file is
  the porting spec (mirror of `COURSES_WEBINARS_MOBILE_PORTING.md`); update CHANGELOG per phase.
- **Backend (`aq_backend_github`):** the `AppAdvisorRouter` flag addition (§4.1) touches the
  mobile-config contract — note it; no tracked-doc area is affected by a pure additive read field,
  but `RIA_AUM_BILLING_ARCHITECTURE.md` (in prod repo) should get a changelog row noting the
  mobile read-surface parity once P1 ships.
- **Prod web repo:** if any web pure-engine (`nbaRanking`/`portfolioHealth`/`portfolioTransition`)
  changes after we copy it, the mobile copy must re-sync (R2) — record the source commit hash in
  the mobile engine files' header.

## 11. Test / Verification Plan (D11)
- **Engine parity (drift tripwire, D2):** port the web unit tests for all three engines verbatim into
  `__tests__/utils/`; a mismatch must fail CI.
- **`validateChargeableAmount()` unit tests:** amount = 0 / < 0 / > 0 / 100%-coupon boundaries.
- **CRITICAL regression test:** adding the ₹0 guard to the EXISTING course-purchase path is a
  behavior change — assert the happy purchase still completes AND a ₹0 total is refused.
- **Service tests:** `RiaBillingService` against recorded fixtures; assert bearer header present (D6).
- **CustomerStateContext:** unit tests for TTL/AppState/focus/event triggers + in-flight-guard/debounce coalescing (D5/D12).
- **E2E (Detox/Maestro — D11):** Portfolio Health consent→holdings→gaps journey (factual-only copy
  assertion); payment journeys (provisional banner + grace date, ₹0 guard, post-spike mandate return).
- Manual QA per phase behind a dogfood flag; flags default OFF until an advisor opts in via `advisor_config`.
- `/qa` pass on each shipped screen; before/after health score.

---

## Changelog
| Date | Change | Commit |
|---|---|---|
| 2026-06-08 | Initial migration plan (RIA billing, NBA/Portfolio Health, recurring payments) drafted with embedded eng review + design-lockup gating | — |
| 2026-06-08 | **P0 scaffold shipped (uncommitted, files only):** 3 pure engines + enums copied to `src/utils/nba/` pinned @ web `de22d67e`, with 3 drift-tripwire suites in `__tests__/utils/` (42 tests passing); `RiaBillingService.js` (bearer auth D6, Node host T7); `ConfigContext` flag plumbing (D3 — parallel `/api/admin/frontend-config` fetch, 5 flags mapped + persisted to the TradeContext blob per T5, default-OFF, 46 additive lines, 0 new lint errors). supportAQ already exposes the nba/health/transition toggles. | — |
| 2026-06-08 | **D4 eNACH spike complete** (`docs/ENACH_SPIKE_D4.md`): default flipped from WebView to native `doSubscription` (SDK already integrated + backend already mints 2025-01-01 subscriptions); WebView kept as fallback; 2 verification gates before P4. | — |
| 2026-06-08 | **P1 AS-BUILT** (`c1f6b1a`): Fee Statement tab in PaymentHistoryScreen (D15, reuses PDF helper), self-gated `AumPerformanceCard` composite mounted in MPPerformanceScreen (chart-kit — deviation from D8, noted), right drawer re-enabled (D17). All gated `riaBillingEnabled`. |
| 2026-06-08 | **P2 AS-BUILT** (`b550d54`): `PortfolioHealthSheet` composite — consent→factual checklist (lockup C), ported health engine, defensive holdings extract from `allHoldingsData`, best-effort server reconcile. Mount lands with P3. Gated `portfolioHealthEnabled`. |
| 2026-06-08 | **P3 AS-BUILT** (`6685112`): `NbaBanner` (lockup F) — signals from TradeContext, ported `rankActions`, Broker·KYC·Health strip; mounted with PortfolioHealthSheet as HomeScreen ListHeader. Gated `nbaHomeEnabled`. |
| 2026-06-08 | **P4 AS-BUILT** (`5d81806`): shared `validateChargeableAmount` ₹0 guard (D10) wired into course-purchase chokepoint + unit/regression test (5/5); `ProvisionalBanner` (lockup G) on Home; `SubscriptionMandateService` scaffold (backend create + WebView fallback; native `doSubscription` gated on G1/G2). |
| 2026-06-08 | **P5 AS-BUILT** (`c7551bd`): `PortfolioTransitionCard` (RA-attributed, ported engine) — registered, DELIBERATELY UNMOUNTED/gated `transitionEngineEnabled` (don't ship advice ahead of web). Coupon response-shape tolerance + discount→finalAmount normalization (fixes 30%-coupon-₹0 class). Buying-Power panel deferred. |
| 2026-06-08 | Release APK built (v3.9.69, signed) with all P0–P5; full util suite green for new tests (47), AA/MF plan written separately (`MF_AA_MOBILE_MIGRATION_PLAN.md`). |
| 2026-06-08 | Eng review (Claude + Codex outside-voice): 18 decisions locked (§8.1). Key reversals — extend `PaymentHistoryScreen` not new screen (D15), refactor `MPPerformanceScreen` first (D14→C), build at live payment seam not legacy `PaymentHandle.js` (D16), re-enable drawer (D17), `useMultiBrokerHoldings` canonical (D18), victory-native (D8), bearer-not-email auth + IDOR hardening (D6). Added §8.2-8.6 (backend/hardening, what-exists, NOT-in-scope, failure modes, parallelization). | — |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | not run (scope set by user in D1) |
| Outside Voice | Codex | Independent challenge | 1 | ISSUES_FOUND | 11 findings; 6 reversed plan decisions, 4 became P0 gates |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_OPEN→RESOLVED | 12 issues, 18 decisions locked, 1 critical gap (course ₹0 regression) covered by mandated test |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | next: /design-shotgun for 5 lockup screens |
| DX Review | `/plan-devex-review` | Developer experience | 0 | n/a | not a dev-facing surface |

- **CODEX:** outside voice was high-value — caught wrong payment seam, duplicate invoice/PDF infra, unreachable drawer, ambiguous holdings contract, and the dual-config split. 6 of its findings changed locked decisions.
- **CROSS-MODEL:** all substantive tensions surfaced to user; D14/D15/D16/D17/D18 reflect Codex-informed choices. D1 scope dissent (3-plans / drop-Transition) recorded but not adopted.
- **UNRESOLVED:** 0 (all 18 decisions answered).
- **CRITICAL GAP:** 1 — ₹0 guard on existing course path is a regression; covered by a mandated CRITICAL regression test (§11), not left open.
- **VERDICT:** ENG REVIEW COMPLETE — plan ready for design lockups (`/design-shotgun`) then phased build. Build starts only after the 5 design lockups + the eNACH spike.
