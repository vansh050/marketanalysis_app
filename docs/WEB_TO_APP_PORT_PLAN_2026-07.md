# Web → App Port Plan — IPv4 Dedicated-IP + June/July Parity (2026-07-17)

**Status**: PLAN (authored by Fable for Opus execution). Nothing here is built yet on mobile.
**Target repo**: `Alphab2bapp` (branch `feature/sdk-plus-config_forkv2`) FIRST; white-label forks later per §7.
**Companion docs**: `prod-alphaquark-github/docs/IPV4_EGRESS_BILLING_DESIGN.md` (the feature being ported, incl. backend contracts), `docs/WEB_PARITY_MIGRATION_2026-06.md` + memory `mobile-web-parity-and-markup-workstream` (what was already ported 07-13/16), `docs/GTT_MOBILE_CERT_CHECKLIST.md`.

## 0. Ground rules (from the established mobile workstream)

- **Parse-check every touched RN file**: `node -e '…@babel/core transformFileSync(FILE,{presets:["module:@react-native/babel-preset"]})'` run from inside the repo.
- **Per-feature commits** — the user explicitly wants the IPv4 port as its own reviewable commit set before anything else lands.
- Mobile config flags flow via `useConfig()` (`src/context/ConfigContext.js`), hydrated from `GET api/app-advisor/get` (AppAdvisorRouter) **plus** a parallel `api/admin/frontend-config` fetch for parity flags (ConfigContext.js:114-148). Both fetch paths are available for new flags.
- Fork propagation is **assertion-guarded exact-anchor content-port** (never whole-file copy), markup_app via its `SYNC.md`; **new_magnus_app EXCLUDED** per user 2026-07-16; tidi (Flutter) excluded; alphaquarkapp is a stale duplicate — skip.

## 1. Architecture decision — SDK impact: NONE (verified 2026-07-17)

Question raised: does the IPv4 port need `alphaquark-mobile-sdk` or `/sdk/v1/egress` changes?

**No.** Verified facts:
- `alphaquark-mobile-sdk` (`@alphaquark/mobile-sdk`, `file:../../alphaquark-mobile-sdk/packages/rn`) wraps `/sdk/v1/*` for broker connect / EDIS / rebalance / orders. It contains **no egress, paywall, or payment code** (only a cosmetic whitelist-instruction string at `packages/rn/src/components/brokerFormSchema.ts:251`).
- Node `Routes/sdk/v1/egress.js` (thin proxy over ccxt `/egress/me|claim`) has **zero consumers today** — Alphab2bapp's `EgressIpCallout.js` calls ccxt **directly** (`server.ccxtServer.baseUrl` = ccxtprod) and will call Node `/api/egress-ipv4/*` directly, exactly like web.
- Therefore: **the entire port lives in Alphab2bapp app code + one small Node backend addition (§2.A0).** The SDK stays untouched. (Future note, non-blocking: if any consumer ever adopts `/sdk/v1/egress`, that proxy forwards ccxt's 402 verbatim with no paywall semantics — it would need a `plan` passthrough contract then. Out of scope now.)

## 2. PHASE A — Dedicated-IPv4 broker port (FIRST; own commit series)

Backend rails are already live (Phase 0–2 web workstream, 2026-07-17): ccxt `/egress/me` (mode-aware statuses), `/egress/claim` (402 + `{plan}` for `customer_pays`; instant grant for `sponsored`), Node `POST /api/egress-ipv4/subscribe` (CashFree native subscription ₹99/mo on the platform account → `subscription_session_id`) and `POST /api/egress-ipv4/verify` (poll CF; on SUCCESS charge → grant → returns `{granted, ip}`). **Zero backend changes needed for the paywall itself.** The app-side gaps, in dependency order:

### A0. Backend (aq_backend_github, tiny): emit `useSharedAngelOneKey` from `AppAdvisorRouter /get`
- File: `Routes/AppAdvisor/AppAdvisorRouter.js` `/get` route (lines ~307-377). Today it returns `apiKeys.angelOneApiKey` but NOT the mode flag; the app *infers* shared-mode from key presence (`Phase3SdkBrokerModal.buildSchemaOverride:439-451`) — which breaks now that prod has the key set AND `useSharedAngelOneKey:false`.
- Add to the response: `useSharedAngelOneKey: admin.useSharedAngelOneKey === false ? false : true` — mirror the exact semantics of `Routes/Admin/loginRoutes.js:162-163` (read the same admin doc the route already loads; if it only loads AdvisorConfig, add the admin lookup the same way loginRoutes does).
- Doc: BROKER_CONNECTION_ARCHITECTURE changelog row (AppAdvisor surface is broker-connect-adjacent).
- Deploy: `alphaquark.service` + `aq-cron-jobs.service` restart.

### A1. ConfigContext: carry the flag
- File: `src/context/ConfigContext.js` — in `fetchConfig`'s `newConfig` mapping (~line 355 where `REACT_APP_ANGEL_ONE_API_KEY` is mapped), add `useSharedAngelOneKey: apiData.useSharedAngelOneKey === false ? false : true`. Also persist into the AsyncStorage `@app:advisorConfig` snapshot (line ~523) so cold-start uses the cached value.
- Default `true` (legacy-safe): missing field must never flip an advisor to per-customer.

### A2. AngelOne routing: honor the flag (both paths)
Current state: legacy path `AngleoneBookingModal.js` is the shared publisher-login **WebView** (`angelone/login-url?apiKey=<shared>`); SDK path `Phase3SdkBrokerModal.buildSchemaOverride` (439-451) returns the empty-fields OAuth override whenever `REACT_APP_ANGEL_ONE_API_KEY` is present. Neither knows the flag.
1. `Phase3SdkBrokerModal.js buildSchemaOverride`: change the AngelOne branch to `if (angelOneKeyPresent && config.useSharedAngelOneKey !== false) → shared override; else → fall through to the per-customer apiKey+secretKey+clientCode schema` (the SDK `BrokerCredentialForm` fallback schema already exists — that IS the per-customer form; no SDK change).
2. `BrokerConnectModalDispatch.js`: when `config.useSharedAngelOneKey === false`, Angel One must NOT render the legacy shared WebView. Recommended: route `'Angel One'` to `Phase3SdkBrokerModal` in that case even when `REACT_APP_USE_SDK_BROKER_FLOW` is off (a one-broker exception mirroring the existing `SDK_LEGACY_FALLBACK` mechanism, inverted). Alternative (more work, not recommended): build a legacy per-customer AngelOne credentials UI.
3. `Phase3SdkBrokerModal.js IP_WHITELIST_BROKERS` (lines 106-116): **add `'Angel One'`** so the EgressIpCallout renders + gates the AngelOne connect (web parity — `EGRESS_BROKER_KEY` already maps `'Angel One' → 'angelone'` at 130-142, and the RN callout's `WHITELIST_BROKERS` already includes `angelone`). Gate this addition on `useSharedAngelOneKey === false` — shared-key mode has no per-customer IP story.
4. Reauth: `Phase3SdkBrokerModal` comment (196-202) says AngelOne reauth runs the legacy sheet — apply the same flag branch to the reauth dispatch (`USER_BROKER_TO_MODAL_KEY` path in `BrokerSelectionModal.handleBrokerSelectOpenExpire`, 206-266).

### A3. EgressIpCallout (RN): port the 402 paywall + native CashFree subscription
- File: `src/components/BrokerConnectionModal/EgressIpCallout.js` (815 lines; has partner/loading/error/unclaimed/claiming/claimed/shared_ip/ipv4_provisioning; **no 402 handling**).
- Port from web `prod-alphaquark-github/src/Home/BrokerConnection/EgressIpCallout.js` (commit `c5781a66`):
  - State: `paymentInfo` (the 402 body incl. `{plan}`), `paymentStarted`, `subscribing`, `verifying`, `verifyMsg`.
  - `handleClaim` catch: `err.response?.status === 402 && err.response?.data?.plan → setPaymentInfo(...)` (else existing error path).
  - `handleSubscribe`: POST `${server.server.baseUrl}api/egress-ipv4/subscribe` `{broker, customer_id, email}` (web also sends `return_url` — send the advisor web URL or omit; the CF native SDK controls the return flow on mobile). On `already_active` → straight to verify. Extract `subscription_session_id` + `subscription_id`.
  - **Checkout — the mobile-specific part**: instead of web's `window.Cashfree.subscriptionsCheckout`, use the app's existing native pattern from `MPInvestNowModal.initiateCashfreeRecurringPayment` (lines 1802-1967): imports `CFPaymentGatewayService` (react-native-cashfree-pg-sdk) + `CFSubscriptionSession` (cashfree-pg-api-contract) + `getCashfreeEnvironment()` (`src/utils/cashfreeEnv.js`); `setCallback({onVerify, onError})`, `new CFSubscriptionSession(subsSessionId /*RAW — do not strip suffix*/, subscriptionId, getCashfreeEnvironment())`, `CFPaymentGatewayService.doSubscriptionPayment(session)`, plus `isInstallSourceError`/`friendlyPaymentError` guard. **Mobile advantage over web**: `onVerify` fires in-app → call `handleVerifyPayment()` automatically instead of relying on the manual "I've paid — verify" button (keep the manual button too as the fallback for `onError`/app-restart cases).
  - `handleVerifyPayment`: POST `${server.server.baseUrl}api/egress-ipv4/verify` → `{granted, ip}` → on granted clear paymentInfo + `fetchStatus()` (→ claimed panel). Not-granted → show `message` (mandate pending etc.).
  - Render: a paywall card mirroring the web copy (₹`plan.amount`/month, 3 bullets: your own static IP / covers all IPv4 brokers / auto-renews via CashFree + cancel anytime + 7-day grace, brand billing footnote) with `Subscribe — ₹99/month` and conditional `I've paid — verify` buttons, using the component's existing RN card/tone styles.
- Also verify the RN callout's per-broker dev-portal/whitelist-hint maps include `angelone` ("SmartAPI Apps → (your app) → Whitelisted IPs", portal `https://smartapi.angelone.in/`) — web has them; add if the RN port predates the AngelOne entries.

### A4. Payments plumbing checks (no code expected, verify only)
- `server.server.baseUrl` (Node) + `server.ccxtServer.baseUrl` already exist in `src/utils/serverConfig.js`. Headers via existing `buildHeaders` (X-Advisor-Subdomain + aq-encrypted-key) — the Node router self-applies `validateHeaders`, same contract. ✔ no change.
- CF SDK env: `getCashfreeEnvironment()` already resolves PRODUCTION/SANDBOX. ✔.

### A5. Verification matrix (emulator `Pixel_3a_API_35`, windowed `DISPLAY=:1`; Metro `adb reverse tcp:8081`)
| Advisor mode (set via supportAQ/mongo on a test advisor) | Expected app behavior |
|---|---|
| `disabled` (default) | AngelOne: whatever the flag says (shared WebView if `useSharedAngelOneKey` true; per-customer form + shared_ip callout if false). Motilal/Upstox etc.: unchanged shared_ip/claimed states. |
| `sponsored` | Per-customer connect → callout `unclaimed` → "Assign me a dedicated static IP" → instant `claimed` with dedicated IP + ack gate. |
| `customer_pays` | Callout → claim → **402 → paywall card** → native CF subscription sheet → pay (test ₹99) → auto-verify (`onVerify`) → claimed with dedicated IP. Re-open app mid-payment → manual verify button path. |
Plus: existing granted customer sees `claimed` in all modes; partner brokers render nothing; regression pass on Upstox/Kotak/ICICI/Motilal callout states. Use advisor `prod` (already `customer_pays`, ₹99 live) with test account `pratik1762012@gmail.com` — its IP `23.26.51.86` sits in quarantine and the SAME IP returns on payment.
- **Commit series** (suggested): `A0 backend flag` (aq_backend) → `A1+A2 routing` → `A3 paywall` → `A5 fixes` — each parse-checked, each its own commit for reviewability.

## 3. PHASE B — KYC gate fail-closed policy delta (small, do right after A)

The base KYC blocking gate was ported 07-13 (`runKycBlockingGate` in `MPInvestNowModal`), but web hardened the policy 07-16 (commits `b85eccc8`, `c4f2217b`, `25d229cd`, `17025913`, `8ac21f37`, `2f27a034`): **`verified` is now the ONLY pass state** — block `mismatch`, `not_found`, `unavailable`, `service_error` (CVL WEBERR), and never fail-open on silent config-load bypass; DOB must serialize as YYYY-MM-DD (Date-object crash fix). Port the final policy into the mobile gate (and its markup_app copy). One commit.

## 4. PHASE C — remaining June/July parity items (ordered by value)

| # | Item | Web source | Mobile target | Size |
|---|---|---|---|---|
| C1 | **F&O buy-first ordering** (exits exempt) + **customer per-leg MARKET/LIMIT control** on basket execute | `f75fd863` (`NewStockCard.js`), `dfad4085` | `src/components/AdviceScreenComponents/StockAdvices.js` / basket execute sheet | M |
| C2 | **Deep-link /x rails delta** — async enqueue+retry job rails, "connect broker" CTA, reauth result states, focused trade card (07-12 set: `34ee88f1` + 9 commits) | `src/Home/DeepLink/RebalanceDeepLinkLanding.js`, `DeepLinkService.js` | App already executes natively via /l/ smart-links (mobile-deeplink Phase 1a); port only the RESULT-STATE/retry semantics into the native review screen — do NOT clone the web page. Audit first. | M–L |
| C3 | **Subscribe/checkout overhaul** — GST opt-in toggle, guest checkout, MITC pre-payment Digio gate, QR fallback (`6267e2e4`, `50f0633e`, `411efc99`, `0c9442d7`, `64ba27de`…) | `PlanSubscribeModal.jsx`, `useStrategyDetails.js` | `MPInvestNowModal.js` (the live subscribe path). Audit which pieces already exist (eNACH/recurring shipped; MITC gate status unknown on mobile). | L |
| C4 | **MP holdings/rebalance card polish** — as-of stamp + refresh-on-focus, live current value, T+1 settlement explain-only copy, low-funds warning, calculation-TTL stale-trade gate (`995fa9b5`, `d173a8ed`, `c2e23b36`, `24bfe5c5`, `c7c2f7cb`, `9eaf3b2f`) | `ModalPFList.js`, `ModalPFCard.js`, `BrokerPublisherButton.js` | PortfolioScreen MP cards + publisher button equivalent | M |
| C5 | **ReferShare** (refer-a-friend, subscription-extension reward, `76f72414`, `e2bf2e44`) | `src/Home/Grow/ReferShare.js`, `GrowService.js` | New screen + nav entry (flag-gated) | M |
| C6 | **Webinars/Courses customer delta** — enrolled courses on /user-courses, webinar coupon UI, payment-history/download-invoice (`5ac54ee1`, `30344e32`, `5180caba`, `23b6be17`) | `Home/Course/*`, `BuyWebinarTicketModal.jsx` | Only if the app ships the courses/webinars surface (check `COURSES_WEBINARS_MOBILE_PORTING.md` state) | M–L |
| C7 | Misc: Google-only login hint (`f38742d3`); confirm in-app account-deletion parity with `/delete-account` (`185b6c75`, Play data-safety) | `SignInEmail.js`, `DeleteAccount.js` | Login screen; settings | S |

**Explicitly NOT portable** (verified): all `src/AdminDashboard/**` work (Responses tab, MP-Execution page, WhatsApp inbox, customer master, plan-performance dashboards, PaRRVA close-out, F&O close defaults admin-side), web version-poll reload banner, firebase env→config web plumbing, DOM a11y passes, kaizen tenant web redesigns (unless kaizen mobile ever exists — it doesn't), `/grow` public capture page (web landing).

## 5. Execution order & discipline

1. **A0→A5 (IPv4)** — own commit series, verified on emulator against prod's live `customer_pays` mode, THEN user sign-off before anything else. This doubles as the mobile leg of the AngelOne SG-IP certification.
2. **B (KYC policy)** — one commit.
3. **C1, C4** (execution + MP polish) → **C3 audit-then-port** → **C2 audit-then-port** → **C5** → **C6/C7**.
4. Each phase: parse-check, build `com.aq.alphab2b` debug on emulator, functional pass, commit, push to `feature/sdk-plus-config_forkv2`.

## 6. Fleet propagation (AFTER Alphab2bapp sign-off)

Per the established pattern (memories `mobile-web-parity-and-markup-workstream` + `mobile-fork-fleet-port-20260716`): assertion-guarded exact-anchor content-port, per-app agents, SKIP-and-report on divergence. Targets: markup_app (content-port per SYNC.md), moneyman_app, rgx_app, zamzam_app (⚠ parityFlags inert — flag-gated features dormant), arfs_app (⚠ divergent MPInvestNowModal, Razorpay-only — the CF subscription paywall may be INAPPLICABLE; decide per-tenant whether IPv4 customer_pays is even offered), Alphanomy (⚠ designs/default overrides inert for variant screens), Kaizen_app (port only; no build until keys supplied). **new_magnus_app EXCLUDED per user.** Note: the IPv4 paywall only matters for advisors flipped to `customer_pays`/`sponsored` — fleet forks can take the code dormant (all advisors default `disabled`).

## 7. Open decisions for the user

1. **A2 routing choice**: route flag-false AngelOne through the SDK modal (recommended, reuses BrokerCredentialForm) vs building a legacy per-customer UI.
2. **C-phase scope**: confirm priority order (suggested C1/C4 first) and whether C6 (courses/webinars) is in scope for the app at all.
3. **arfs_app**: Razorpay-only fork — offer IPv4 `customer_pays` there or keep those advisors on `disabled`/`sponsored` only?
4. iOS: all of the above is Android-verified first (existing pattern); CF native SDK subscription support on iOS to be confirmed during A5.

## 8. Rebalance Plan Freeze parity (2026-07-24, out-of-band — full detail in `docs/REBALANCING.md`)

Not part of the IPv4/June-July matrix above, but landed on this branch the same way: `ConfigContext` gained `rebalanceFreezePlan`/`repairFreezePlan` (same `parityFlagsPromise` pattern as the 5 flags in §4 Cross-Cutting Foundations), and every mobile surface that POSTs `/rebalance/process-trade` with legs from a `/rebalance/calculate` response now forwards the additive `plan_id`/`plan_version` fields + handles the `409 {recompute:true}` guard failure. Full surface table, the Publisher-vs-direct-API split rationale, and the 409-recovery mechanism per screen are documented in `docs/REBALANCING.md` § "Rebalance plan freeze — mobile parity port". `src/components/AdviceScreenComponents/RebalanceModal.js` and `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` were NOT in the task's original 3-file scope but were pulled in after investigation found they are the live, actively-maintained "subsequent rebalance + repair" surfaces (repair data confirmed to carry `planId`/`planVersion`/`attempt` per ccxt's `/rebalance/get-repair` Phase 3 P3.0 mint) — leaving them unwired would have reproduced the exact "0 plans consumed fleet-wide" coverage-gap class the web port fixed in commit `a4cb3c23`.
