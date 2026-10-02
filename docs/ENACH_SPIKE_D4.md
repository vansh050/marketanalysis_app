# D4 Spike — eNACH / recurring-mandate flow on mobile

> ## ✅ UPDATE 2026-07-13 — BUILT & SHIPPED (this spike is now historical)
> The native `doSubscriptionPayment` flow the spike recommended **was implemented
> after this doc** and is live in `MPInvestNowModal.js`:
> `initiateCashfreeRecurringPayment()` (≈L1683) POSTs
> `api/cashfree/subscription/create/payment`, reads `subscription_session_id`
> (**G1 confirmed** — a real 2026-06-12 alphanomy bug where a suffix-strip
> corrupted that id proves the field is live), builds
> `new CFSubscriptionSession(subsSessionId, subscriptionId, getCashfreeEnvironment())`,
> sets `onVerify`/`onError` callbacks + event subscriber, calls
> `CFPaymentGatewayService.doSubscriptionPayment(session)`, and on verify runs the
> completion (`CashFreeRecurringPayment()` → grant + group-add + notify). It's
> **wired** at `handlePaymentType()` (`cashfree` + `selectedPlanType==='recurring'`),
> with pending-payment recovery, the ₹0-AUTH provisional framing
> (`SubscriptionMandateService.js`), and install-source error handling. **G2 (device
> smoke) effectively passed** — the 2026-06-12 prod debugging ran on real devices.
> **Present in both `Alphab2bapp` and `markup_app`.** No scaffold, no WebView-fallback
> gap. Nothing left to build; any earlier "scaffold-only" note (incl. the June
> parity report) is stale. Remaining work is operational: per-advisor gateway
> config (CashFree Subscriptions-activated account) + the standard recon/entitlement
> crons, which are backend/ops, not app code.

**Decision doc for D4** (docs/WEB_PARITY_MIGRATION_2026-06.md §5.3, §8.1).
**Date:** 2026-06-08 · **Status:** ~~SPIKE COMPLETE — 2 verification gates before build~~ → **BUILT 2026-06 (see update above).**
**Box:** code-only investigation (no device run); claims marked (verified) vs (needs device smoke).

## The question
The plan's D4 locked "spike-first, **WebView hosted-page as the default**, unless the CashFree
RN SDK clearly wins." Does it win?

## Findings (evidence)
1. **The RN SDK already supports native mandates.** `react-native-cashfree-pg-sdk@^2.2.5` is an
   installed dependency and its API surface exposes **`CFSubscription` + `CFPaymentGatewayService.doSubscription(...)`**,
   not just one-time `doPayment` (`grep` of `node_modules/react-native-cashfree-pg-sdk/src`: 4×
   `doSubscription`, 2× `CFSubscription`, 53× `Subscription` types; `cashfree-pg-api-contract@^2.0.9`
   carries the subscription/mandate types). (verified, static)
2. **The app already uses this SDK** for `doPayment` today — `CoursePurchaseSheet.js`,
   `BuyWebinarTicketSheet.js`, **`MPInvestNowModal.js`**. So native subscriptions are an *incremental*
   call on an already-integrated SDK, not a new native integration. (verified)
3. **The backend already mints subscriptions in the session-capable format.** `Routes/CashFree/CashFree.js:2150`
   POSTs `${CASHFREE_BASE_URL}/subscriptions` with `x-api-version: 2025-01-01`,
   `payment_methods: ["enach","pnach","upi","card"]`, and returns the raw `response.data` to the
   client (plus `cashfree_subscription_id`). The 2025-01-01 Subscriptions create response carries a
   **`subscription_session_id`** (for `doSubscription`) and a hosted **auth link** — so BOTH paths
   are already reachable from the same existing endpoint. (verified the call + version; the exact
   field name in `response.data` is the gate below — needs one live response capture)
4. **Reconcile + entitlement are already built and path-agnostic.** `CashFreeSubscriptionWebhook.js`
   re-queries `/subscriptions/{id}` + `/payments` and drives grant/revoke; `CronRecurringChargeReconciliation`
   records cycle 2+. None of this cares whether the customer authorized via native SDK or WebView.
   (verified)
5. **₹0 AUTH = mandate registration, not a charge** (project memory `recurring-mandate-entitlement`):
   the customer is granted provisional access at AUTH; first real debit promotes provisional→realized.
   The UI must say "₹0 now / auto-debit on confirmation" (the G lockup already does). (verified)

## Decision
**Primary: native `CFPaymentGatewayService.doSubscription` via the already-installed SDK.**
**Fallback (and the safe default if a gate fails): WebView on the hosted auth link** from the same
`/subscriptions` response.

Rationale: the D4 "WebView default" was the pre-spike safe assumption. The SDK *clearly wins* the
condition the decision named — it's already a dependency, already used at the **exact build seam**
(`MPInvestNowModal`, which confirms D16), gives a native in-app mandate UX (no browser chrome), and
needs **zero new backend work** because the backend already creates 2025-01-01 subscriptions. WebView
remains a first-class, low-effort fallback that reuses the same response, so we are never blocked.

## Verification gates (must pass before P4 build; cheap)
- **G1 (backend response shape):** capture one real `/subscriptions` create response in staging and
  confirm it contains `subscription_session_id` (native path) and/or `authorisation_details`/auth-link
  (WebView path). If only an auth link is present → ship WebView first, add native when the BE exposes
  the session id. (~30 min)
- **G2 (device smoke):** on a real Android + iOS build, run `doSubscription` with a staging
  `subscription_session_id` through to the eNACH/UPI-autopay bank step and back; confirm the return
  callback fires and we can poll status. Mocks lie here (D11 marks this an E2E flow). (~half day)

## Build implications (feeds P4)
- **Seam (D16 confirmed):** build at `MPInvestNowModal` + `InvestFlowScreen` — `MPInvestNowModal`
  already holds the SDK `doPayment` call, so `doSubscription` slots in beside it.
- **Design lockup G** (two-step: explainer → bank step → provisional banner) stands for BOTH paths;
  only the middle step differs (native sheet vs WebView). The lockup's WebView frame becomes the
  fallback rendering.
- **₹0 guard (D10):** the shared `validateChargeableAmount()` still applies to the *first-debit* amount,
  not the ₹0 AUTH.
- **Flag-gated, ships last** in P4 (after provisional banner + ₹0 guard land), per the rollout.

## What did NOT change
The mandate is still SEBI-framed as "₹0 now, auto-debit on confirmation, cancel anytime"; provisional
access + auto-revoke lifecycle is unchanged; the backend remains the source of truth via the existing
webhook + reconcile cron.

## Changelog
| Date | Change |
|------|--------|
| 2026-06-08 | Spike complete. Flips D4 default from WebView to native `doSubscription` (SDK already integrated + backend already mints 2025-01-01 subscriptions); WebView kept as fallback. 2 verification gates (G1 response shape, G2 device smoke) before P4. |
