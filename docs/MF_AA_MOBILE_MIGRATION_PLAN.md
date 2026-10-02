# Mobile Migration Plan — Account Aggregator (AA) + Mutual Fund (MF) Execution

**Status:** PLAN ONLY — no mobile code yet. Build is **gated on the web feature going live**.
**Created:** 2026-06-08
**Source:** prod-alphaquark-github MF/AA shells + `docs/SCOPE_MF_INTEGRATION.md` (this repo).
**Sibling:** `docs/WEB_PARITY_MIGRATION_2026-06.md` (RIA/NBA/payments — separate, in build).

> Decision (2026-06-08): keep AA/MF OUT of the current web-parity build; produce this
> plan for later. Rationale: on web/backend the AA aggregation + BSE/MFU execution cores
> shipped but are **dark, flag-gated** (`mf_config.aggregation_enabled` /
> `execution_enabled`, default false) — **nothing is live** (gated on Setu for AA, BSE
> UAT + demand for execution). Porting a mobile surface ahead of a not-yet-live web flow
> invites rework when the web flows finalize. **Do not start the build until the web
> feature is live for at least one advisor.**

## 1. What exists today (web) — the port source
- **Customer FE shells** (dark): `src/Home/MutualFundSection/*` (`MutualFundSection.js`,
  `useAaPortfolio.js`, `HeldAwayPortfolioView.js`, `CoverageStates.js`, `FlagForReviewCTA.js`,
  `mockPortfolio.js`), `src/Home/MutualFundOrder/*`, `src/services/MutualFundService.js`,
  gated `/mutual-funds*` routes in `src/App.js`.
- **Backend:** `AdvisorConfigModel.mf_config`, `AdvisorConfigRouter` (mf_config encrypt/save),
  `loginRoutes /api/admin/frontend-config` exposes `mfAggregationEnabled` + `mfExecutionEnabled`,
  `utilities/aa/*` + `Models/mf/mfAaModels.js` + `Routes/AA/AaWebhookRouter.js` (AA),
  `utilities/mfExec/*` (execution core).
- **supportAQ:** `AdvisorConfigPage.jsx` MF panel (per-advisor flags + BYO-key).

## 2. Regulatory frame (drives the architecture — do not skip)
- **MF execution = BSE StAR MF RIA channel** (no ARN; SEBI RIA registration only). EOP Cat-1/2
  is reference-only, NOT our path.
- **TSP model:** AlphaQuark registers NOTHING. Each RIA holds their own BSE membership / AA key,
  plugged in per-advisor exactly like the broker BYO-key pattern. For AA, the RIA is the regulated
  **FIU**; AlphaQuark is the unlicensed **TSP**.
- **OPEN QUESTION (blocker before execution build):** does MF advice need a **PaRRVA** surface?
  Surface routing is a SEBI correctness contract — resolve before any execution UI ships.

## 3. Scope (when build starts)
Two independently-flagged clusters, mirroring web:
- **AA aggregation** (`mfAggregationEnabled`): consent → held-away MF portfolio view (read-only
  aggregation of the investor's external MF holdings via the RIA's AA/FIU rail).
- **MF execution** (`mfExecutionEnabled`): advice → BSE StAR MF order (lumpsum/SIP) with
  investor↔ICCL direct settlement (no pooling).

## 4. The cheap enabler (already half-done)
The flags `mfAggregationEnabled` / `mfExecutionEnabled` are served by the SAME
`/api/admin/frontend-config` endpoint the P0/D3 work already wired into mobile `ConfigContext`.
**Adding them is a 2-line map** alongside `riaBillingEnabled` etc. — no new infra. (Do this only
when the build starts; default OFF.)

## 5. Per-cluster mobile design (follows the app's container/presentation + designs/default split)

### 5.1 AA aggregation
- **Service:** new `src/FunctionCall/services/MutualFundService.js` (mirror web) — AA consent
  start, consent status poll, held-away portfolio fetch. Node host; bearer auth (same D6 rule).
- **Consent flow:** AA consent is a redirect/handoff to the AA (Setu) — mobile uses a **WebView**
  (same idiom as broker OAuth + the eNACH WebView fallback). Watch the return/redirect.
- **Surfaces (`designs/default/`):** `MutualFundSection` composite (held-away portfolio summary +
  `CoverageStates` + `FlagForReviewCTA`), mounted on a gated `/mutual-funds` screen + a Home/Portfolio
  entry. Reuse CVL-KRA KYC (already integrated) for investor identity.
- **Reuse:** the broker BYO-key plumbing pattern for the per-advisor AA key; `useMultiBrokerHoldings`
  is NOT the source here (AA holdings are external MF, not broker equity).

### 5.2 MF execution
- **Surfaces:** `MutualFundOrder` flow (scheme pick → lumpsum/SIP → BSE UCC/CAN onboarding reuse →
  order review → status). New `mf_holdings[]` consumer on the portfolio view.
- **Settlement:** investor↔ICCL direct — the UI must communicate "you pay BSE/ICCL directly," no
  pooling. SIP mandate likely reuses the eNACH/mandate rail (D4 spike outcome — native
  `doSubscription` / WebView).
- **PaRRVA:** if §2's open question resolves to "yes," MF advice needs its surface routing wired
  BEFORE this ships (cross-repo).

## 6. Phasing
- **P0** — flag plumbing (2-line `ConfigContext` map) + `MutualFundService` skeleton. Inert.
- **P1** — AA aggregation read surfaces (consent WebView + held-away view). Gate `mfAggregationEnabled`.
- **P2** — MF execution (order flow + SIP mandate). Gate `mfExecutionEnabled`. After the PaRRVA
  question resolves.
Each ships flag-OFF; no advisor sees it until opt-in AND the web feature is live.

## 7. Design lockups needed (before build)
- AA consent + held-away MF portfolio view (net-new mobile layout).
- MF order flow (scheme search → lumpsum/SIP → review → status).
- SIP mandate (reuses the eNACH lockup G pattern).

## 8. Companion docs to co-update once build starts
`SCOPE_MF_INTEGRATION.md` (this repo), prod `DIRECT_MUTUAL_FUND_ARCHITECTURE.md`, RIA AUM Billing
(MF AUA folds into `under_advice_aum`, no fee-algorithm change), Customer Master, PaRRVA (if §2 = yes),
Broker Connection (BYO-key pattern).

## 9. Risks
- **R1 — Shipping ahead of a non-live web flow.** Highest risk; mitigated by the "don't build until
  web is live" gate.
- **R2 — PaRRVA open question (§2).** Could add a cross-repo dependency to execution. Resolve first.
- **R3 — AA consent native UX.** WebView handoff to Setu; return-capture is the unknown (same class
  as eNACH G2). Spike before P1.
- **R4 — Per-advisor BYO-key.** Each RIA's BSE/AA credentials must be plugged in per-advisor; reuse
  the broker BYO-key encryption pattern, don't centralize.

## Changelog
| Date | Change |
|------|--------|
| 2026-06-08 | Initial mobile AA/MF migration plan (no code). Build gated on web AA/MF going live; PaRRVA-for-MF open question flagged as a pre-execution blocker. |
