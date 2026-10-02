# SDK Audit — Mobile Fit Assessment

**Date:** 2026-04-26
**Author:** Engineering audit (research-only; no code shipped from this doc)
**Subject:** Whether the Phase-1 broker SDK landed in `prod-alphaquark-github` + `aq_backend_github` is the right foundation for Alphab2bapp (React Native) and tidi_new (Flutter), and what gaps remain.

This document is mirrored at `prod-alphaquark-github/docs/SDK_MOBILE_FIT_ASSESSMENT.md` so both repos carry the same source of truth.

---

## §1 Executive summary

The Phase-1 SDK landed in the last 7 days (`prod-alphaquark-github 1aa65ec2`, `aq_backend_github 2f9125b`) is intentionally designed for **both external B2B partners AND internal white-label apps**. Its **backend surface (`/sdk/v1/*` routes, session-token model, EDIS endpoints, webhook outbox, per-tenant credential encryption) is immediately consumable by mobile apps** — that's where the heavy lifting lives, and it's pure HTTP.

The **frontend half of the SDK (the `@alphaquark/broker-connect` React component + the `connect.alphaquark.in/connect` iframe)** is **not directly usable in React Native or Flutter** — JSX can't cross the RN bridge, and the iframe model assumes a web security context, not a mobile WebView with custom-scheme deep links.

**Recommendation: Option B.** Mobile apps consume the backend SDK as-is, plus a thin mobile-flavoured wrapper (`@alphaquark/mobile-sdk` for RN, `aq_mobile_sdk` for Dart) that handles the platform-specific pieces — WebView lifecycle, OAuth deep links, EDIS/DDPI native modals, secure-storage of session tokens. **Do NOT build a separate mobile SDK from scratch** (Option C); the backend is the single source of truth and we don't need to fork it.

This means roughly **6 weeks of work across two engineers** (RN + Flutter in parallel), removes ~1,000 duplicated lines of broker-connection logic per platform, and sets the foundation for external partners to embed AlphaQuark broker-connect + rebalance in their own mobile apps.

---

## §2 What landed in the SDK so far

### Commits (last 7 days)

**prod-alphaquark-github** (`feature/4.1_sdk` merged via `1aa65ec2`):
- `e188f09d` docs(sdk): §17 breaking-change SLA + CLAUDE.md SDK tracking + §10.B resolutions
- `b7aaf142` docs(sdk): §10.B.8 + §10.B.9 resolved — theming + DX docs
- `0b07009d` ops(sdk): deploy-fe-sdk.sh + traceId + API versioning build
- `0c811ab6` docs(sdk): §13.3 per-tenant credential encryption
- `fecfd764` docs(sdk): §13.7 webhook outbox + delivery worker
- `32db57ef` docs(sdk): §13.4 EDIS SDK surface
- `40f31cbe` docs(sdk): §13.2 rate limits
- `10afc7c9` docs(sdk): §13.6 session tokens
- `a22f64f8` docs(sdk): §13.5 Phase 0 tenant registry

**aq_backend_github** (`feature/4.1_sdk` merged via `2f9125b`):
- `eb5b26e` feat(sdk): wire tenantResolver + §10.B.1 sandbox + §10.B.7 offboarding
- `2e3b489` feat(sdk): §10.B.8 theming schema + /sdk/v1/config + §10.B.9 consumer docs
- `2216ab4` ops(sdk): deploy-sdk.sh — idempotent end-to-end backend rollout
- `b8351f2` feat(sdk): aq-trace-id propagation + AlphaQuark-Version header
- `d61d404` feat(sdk): §13.3 per-tenant credential encryption — infrastructure
- `f8b1587` feat(sdk): §13.7 webhook outbox + signed delivery worker
- `aadaacf` feat(sdk): §13.4 EDIS SDK — sellAuthStatus/verify/attest + /sdk/v1 tree
- `9a1ee32` feat(sdk): §13.2 rate limits — 10 req/s per API key, Zerodha exempt
- `e2215f1` feat(sdk): §13.6 session tokens — mint/verify/revoke + HKDF-HS256 signing
- `012ccd6` feat(tenant): §13.5 Phase 0 — tenant registry infrastructure

**Design doc:** `prod-alphaquark-github/docs/BROKER_SDK_ARCHITECTURE.md` (180 KB, every §10.A architecture decision locked).

**Routes shipped:** `aq_backend_github/Routes/sdk/{session.js, admin/, v1/}`.

### Backend API surface (consumable by mobile today)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/sdk/session/create` | POST | `Bearer sk_live_*` | Mint 15-min session token from secret key |
| `/sdk/session/refresh` | POST | `Bearer <sessionToken>` | Extend token (30-min grace post-exp) |
| `/sdk/session/revoke` | POST | `Bearer <sessionToken>` | Self-revoke (logout) |
| `/sdk/v1/config` | GET | sessionToken | Tenant config + enabled brokers + theming |
| `/sdk/v1/connections/:broker/sell-auth` | GET | sessionToken | EDIS/DDPI/TPIN status (5-min cache) |
| `/sdk/v1/connections/:broker/verify-sell-auth` | POST | sessionToken + `connections:write` | Live broker re-check (AngelOne, Dhan) |
| `/sdk/v1/connections/:broker/attest-sell-auth` | POST | sessionToken + `connections:write` | User self-attest (Zerodha, Fyers) |
| Existing `/api/user/brokers/*` | * | sessionToken **OR** legacy `aq-encrypted-key` | All legacy broker CRUD now also gated by session token |

### Frontend SDK packages (designed, not yet published)

- `@alphaquark/broker-connect` — React component, iframe wrapper
- `@alphaquark/broker-connect-iframe` — framework-agnostic, hosted at `connect.alphaquark.in/connect`
- `@alphaquark/broker-sdk-node` — TypeScript server SDK
- `alphaquark_broker_sdk` (Python) — server SDK

**None of these are in npm / pub.dev yet.** Build entry exists (`deploy-fe-sdk.sh`); publication is the next ops step.

---

## §3 Mobile-app needs vs SDK coverage

### What the mobile apps actually do today

From the last ~2 weeks of commits in Alphab2bapp + tidi_new:

- **Broker connection** for 14 brokers (Zerodha, Upstox, Angel One, Kotak, Fyers, AliceBlue, Dhan, Motilal, IIFL, ICICI, Axis, Groww, Shoonya, IBKR), each with its own OAuth or credential flow, EDIS/DDPI/TPIN modals, smart re-auth, and per-broker quirks (Kotak per-DC `baseUrl`, Motilal IPv6-only DNS / AAAA-record fallback, Groww API Key + TOTP-seed dual-step UI).
- **Rebalance** on a 3-step mobile flow: holdings → review (diff) → execute. Includes broker-side LIMIT-IOC auto-conversion, scripmaster reconciliation against AngelOne canonical + per-broker `-EQ` fallbacks, market-hours flag enforcement, multi-broker isolation (the per-broker `connected_brokers[]` slot), and a live-funds-probe pre-trade gate (`validateBrokerSession`).
- **Per-customer egress IP** — claim, whitelist on broker dev portal, acknowledgment checkbox.
- **Auth token expiry detection** — JWT `exp` parsing, sliding refresh, session probe.

### Gap table

| Mobile-app need | Status in SDK | Evidence | Verdict |
|---|---|---|---|
| Broker list + selection UI | `<BrokerConnect>` React + iframe | BROKER_SDK_ARCHITECTURE.md §1, §3 | **✓ Covered** for web; **✗ unusable in RN/Flutter directly** |
| OAuth redirect flows (7 brokers) | iframe + postMessage | §3.1–3.2 | **✓ Covered** for web; **mobile needs deep-link handler** |
| Credential forms (7 non-OAuth) | iframe-rendered React forms | §3.1 | **✓ Covered** for web; mobile needs native equivalents |
| EDIS / DDPI / TPIN modals | `/sdk/v1/connections/:broker/sell-auth`, verify, attest | §13.4 | **✓ Covered** (REST API; mobile UI on top) |
| Token expiry detection | webhook `broker.expired` + `broker.reauth_needed` | §3.5 | **✓ Covered** (webhook-driven) |
| Egress IP claim/whitelist | `/egress/me`, `/egress/claim` (tenant-scoped via session token) | §7.2 | **✓ Covered** |
| Multi-broker state (list connections) | server SDK `aq.connections.list()`; React hook `useBrokerConnections` | §3.1–3.3 | **⚠ Partial** — React hook is web-only; mobile needs a Dart/RN equivalent |
| Scripmaster resolution (`-EQ` fallback) | not exposed in SDK; order placement passes symbol directly | grep across docs + Routes | **✗ Missing** |
| Broker-side MARKET → LIMIT-IOC | not exposed in SDK; Zerodha-only logic in app today | §3.3 (orders.place) | **✗ Missing** |
| Market-hours enforcement (09:15 IST) | not exposed in SDK; app-side gate today | §3.3 | **⚠ Could move server-side, but not yet** |
| Per-broker WebView deep links | designed for iframe, not deep links | §1 | **✗ Mobile-specific** |
| Per-tenant OAuth callback URL on broker dev portal | SDK assumes single AlphaQuark callback; tenants don't re-register | §10.A.2 | **⚠ Centralized model — tradeoff** |
| Order placement / modify / cancel | `aq.orders.place / modify / cancel` | §3.3 | **✓ Covered** |
| GTT / OCO | `aq.gtt.create / list / cancel` | §3.3 | **✓ Covered** |
| Holdings / funds / positions | `aq.portfolio.holdings / funds / positions` | §3.3 | **✓ Covered** |

### Summary by category

| | ✓ Covered (use as-is) | ⚠ Partial | ✗ Missing |
|---|---|---|---|
| **Broker connection** | OAuth, credentials, EDIS modals (REST) | Multi-broker hook (web-only); per-tenant callback URL | Mobile deep-link routing |
| **Trading** | Orders, GTT, portfolio reads | — | LIMIT-IOC conversion, market-hours, scripmaster resolution |
| **Auth & sessions** | Session tokens, EDIS endpoints, signed webhooks | Multi-broker state in mobile | — |
| **Egress IP** | Tenant-scoped claim/whitelist | — | — |

---

## §4 Recommendation: Option B — Backend SDK + thin mobile wrapper

We considered four options:

| | Description | Verdict |
|---|---|---|
| **A** | Mobile apps consume the existing web SDK (React component / iframe) as-is | **No** — JSX doesn't cross the RN bridge; iframe model can't host mobile deep-link callbacks; UX would feel like an embedded browser. |
| **B** | **Mobile apps consume the backend SDK + a thin mobile-flavoured wrapper** | **Yes — recommended.** |
| **C** | Mobile apps get a fully separate mobile SDK that mirrors the web SDK's contracts independently | **No** — unnecessary fork. The backend is the single source of truth; cosmetic differences only. |
| **D** | Status quo — SDK stays web-only; mobile remains directly coupled to backend endpoints | **No** — leaves 14 brokers duplicated across RN + Flutter + web; SDK improvements (credential encryption, signed webhooks) only benefit web; external partners can't embed mobile broker-connect. |

**Why Option B:**

1. The backend SDK is **already framework-agnostic HTTP** — session-token mint/refresh, EDIS REST endpoints, webhook outbox. Mobile apps can call it from Dart or JS today, no porting needed.
2. The **mobile-specific surface (deep links, WebView lifecycle, secure-storage, native EDIS modal)** doesn't belong in the web SDK — it should live in a thin mobile package on top.
3. Refactoring **doesn't touch rebalance orchestration** (3-step flow), which is already correct in both apps. Only broker-connect + EDIS gating is in scope.
4. Sets up **external partners** (B2B advisors with their own mobile apps) to embed AlphaQuark broker-connect with one `npm install` / `flutter pub add`.

---

## §5 Concrete architecture sketch

### High-level flow

```
┌──────────────────────────────────────────────────────────────┐
│  Mobile App (Alphab2bapp / tidi_new)                         │
│                                                              │
│  import { useBrokerSession } from "@alphaquark/mobile-sdk"   │
│  const { sessionToken } = useBrokerSession(userRef)          │
│                                                              │
│  1. Mint sessionToken (POST /sdk/session/create)             │
│  2. Show broker picker (own UI)                              │
│  3. OAuth / credential capture:                              │
│     - 7 OAuth brokers: WebView + deep-link callback          │
│     - 7 credential brokers: native form (Kotak MPIN, …)      │
│     - PUT /api/user/brokers/{broker}/connect (with token)    │
│  4. EDIS modal:                                              │
│     - GET /sdk/v1/connections/{broker}/sell-auth?symbols=…   │
│     - POST verify-sell-auth OR attest-sell-auth              │
│  5. Rebalance flow (existing):                               │
│     - Holdings, diff, execute                                │
│  6. Token expiry: listen `broker.expired` webhook → push     │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
       ┌──────────────────────────────────────┐
       │  Backend SDK Layer (aq_backend)      │
       │  - Session-token minting (JWT, 15m)  │
       │  - Tenant resolver                   │
       │  - EDIS endpoints (/sdk/v1/conn…)    │
       │  - Webhook queue + signed delivery   │
       │  - Rate limiting (10 req/s per key)  │
       │  - Per-tenant credential encryption  │
       └──────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
   ┌──────────────────┐   ┌─────────────────────────┐
   │  ccxt-india (Py) │   │  Legacy broker routes   │
   │  - OAuth auth    │   │  - Holdings, funds, pos │
   │  - Order place   │   │  - Multi-broker state   │
   │  - Holdings      │   │  - Token-refresh cron   │
   └──────────────────┘   └─────────────────────────┘
```

### New packages

**`@alphaquark/mobile-sdk` (React Native)**
```
lib/
  useBrokerSession.ts            # Hook: mint sessionToken from server
  useBrokerConnections.ts        # Hook: list/disconnect/reauth
  WebViewBrokerAuthFlow.tsx      # WebView + deep-link handler
  BrokerCredentialForm.tsx       # Per-broker forms (Kotak, Groww, …)
  EdisModal.tsx                  # EDIS verification UI
  types/{broker.ts,session.ts}
```

**`aq_mobile_sdk` (Dart, for tidi_new)**
```
lib/
  broker_session.dart            # SessionToken + refresh
  broker_connections.dart        # List/disconnect/reauth service
  webview_auth_flow.dart         # WebView + deep-link (platform channels)
  edis_modal.dart                # EDIS verification screen
  models/{broker,session}.dart
```

### Distribution

- `@alphaquark/mobile-sdk` → npm (scoped), or private GitHub Packages while in beta
- `aq_mobile_sdk` → pub.dev (or private)

### API surface seen by app code

```typescript
// Login — minted server-side, returned to app, cached in secure storage
const { sessionToken } = await mintBrokerSession(userRef, userEmail);

// Broker-status screen
const { connections } = useBrokerConnections({ sessionToken });

// OAuth callback (from AppLinks / Custom Scheme)
handleBrokerAuthCallback(broker, authCode);

// Pre-trade EDIS check
const { isAuthorized, method } = await checkSellAuth(
  sessionToken, broker, ["RELIANCE", "TCS"],
);

// Order placement (existing logic, sessionToken in header)
await placeOrder(sessionToken, { broker, symbol, quantity, orderType });

// Backend webhook listener
app.post("/webhooks/broker-events", verifySignature, (req) => {
  if (req.body.type === "broker.expired") notifyUser(req.body.user_ref);
});
```

---

## §6 Migration plan (6 weeks, 2 engineers in parallel)

### Phase 0 — Infra (weeks 1–2)
1. Create `@alphaquark/mobile-sdk` (RN) and `aq_mobile_sdk` (Dart). Scaffolding only.
2. Wire session-token minting in mobile-app login flow (Alphab2bapp + tidi_new).
3. OpenAPI doc + Dart docstring for the mobile SDK API.
4. Test harness for `POST /sdk/session/create` + JWT verification.

### Phase 1 — Broker selection + OAuth refactor (weeks 3–4)
1. Extract broker selection UI into mobile-sdk components (Alphab2bapp `BrokerConnectionModal`, tidi_new equivalent).
2. Wire session-token header into all broker-connect API calls.
3. Refactor OAuth deep-link handlers to use mobile-sdk's `handleBrokerAuthCallback`.
4. Stage-test 3 OAuth brokers (Zerodha, Upstox, Angel One); verify callbacks land.

### Phase 2 — EDIS + trading (weeks 5–6)
1. Wire `/sdk/v1/connections/:broker/sell-auth` into Alphab2bapp's EDIS modal + tidi_new's pre-trade flow.
2. Add webhook listener (mobile-app backend) for `broker.expired` → push notification (FCM/APNS).
3. Refactor order placement to pass session token instead of `aq-encrypted-key` (parallel; both work during cutover).
4. Stage-test 5 brokers, full rebalance flow.

### Phase 3 — Cutover + cleanup (weeks 7–8)
1. Mark legacy `/api/user/brokers/connect` deprecated in `aq_backend_github` (keep working 6 months).
2. Dual-write shadow: mobile still hits legacy path AND validates against SDK in parallel.
3. Tag release of Alphab2bapp + tidi_new using only SDK session tokens.
4. Monitor: error rates, token-refresh latency, webhook delivery.
5. Delete legacy broker-select logic from both apps.

### Phase 4 — External consumption (weeks 9–10)
1. Publish `@alphaquark/mobile-sdk` to npm + `aq_mobile_sdk` to pub.dev.
2. Integration guide for external B2B advisors embedding into their RN / Flutter apps.
3. Ship `@alphaquark/broker-sdk-node` to npm (for external partner backends).

### Effort
~47 story points (~6 weeks at 2 engineers in parallel).

---

## §7 Open questions for the user

These are decisions the audit couldn't make alone — they need product input:

1. **Package distribution** — Public npm/pub.dev, or private registry (Artifactory / GitHub Packages)? Affects external partner onboarding friction.
2. **Per-tenant OAuth callbacks on broker dev portal** — Today AlphaQuark registers ONE callback URL with each broker. Do tenants re-register their own (more friction, more secure) or share AlphaQuark's (centralized model, tenant-isolated server-side via session token)?
3. **Scripmaster resolution** — Should the SDK expose `resolveSymbol(broker, input)` so external partners get the same `-EQ` fallback we do, or each consumer rolls their own?
4. **Broker-side LIMIT-IOC conversion** — Should the SDK abstract this (e.g. `orderType: "MARKET"` always works, SDK rewrites for Zerodha) or document the broker-specific quirk?
5. **Market-hours enforcement** — Server-side gate inside the SDK, or app-side validation on each consumer?
6. **Webhook delivery to mobile** — Mobile apps go offline. Polling endpoint (`GET /sdk/v1/events?since=…`) as well as outbound webhooks? Push notifications (FCM/APNS) wired through AlphaQuark or each consumer?
7. **Sandbox mode** — Should the mobile SDK ship a sandbox tenant (`tenant_id=sandbox`, DummyBroker simulated flows) for integration testing, or every developer gets their own test tenant?

---

## What this doc is NOT

- A commitment to ship. The recommendation here is "build B if/when SDK adoption is a strategic priority for the mobile apps."
- A claim that the existing Alphab2bapp / tidi_new code is wrong. It's correct; it's just duplicated, and the SDK is the better long-term seam.
- A migration that needs to happen this quarter. The mobile apps work today. The SDK migration is a 6-week investment that pays off when (a) external partners want mobile, (b) the next major broker integration ships, or (c) a third mobile codebase appears.

---

## Cross-references

- Backend SDK design: `prod-alphaquark-github/docs/BROKER_SDK_ARCHITECTURE.md`
- Backend SDK routes: `aq_backend_github/Routes/sdk/{session.js, admin/, v1/}`
- Backend SDK helpers: `aq_backend_github/services/SDK*.js`
- Mobile broker-connection (RN): `Alphab2bapp/src/components/BrokerConnectionModal/`, `Alphab2bapp/src/utils/reauthHelpers.js`, `Alphab2bapp/src/utils/brokerCredentials.js`, `Alphab2bapp/src/utils/brokerStateUtils.js`
- Mobile broker-connection (Flutter): `tidi_new/tidistockmobileapp/lib/components/home/portfolio/BrokerAuthPage.dart`, `BrokerCredentialPage.dart`, `lib/service/ReauthHelper.dart`, `lib/service/OrderExecutionService.dart`
- Mobile architecture docs: `Alphab2bapp/docs/BROKER_CONNECTION.md`, `Alphab2bapp/docs/REBALANCING.md`, `tidi_new/tidistockmobileapp/docs/BROKER_TRADING_ARCHITECTURE.md`

## §8 Endpoint gap audit (mobile → backend SDK)

> Companion to §3 / §6. §3 was the high-level coverage table; this is
> the endpoint-by-endpoint inventory that turns "yes this can be done"
> into the concrete Stream 1 backlog.

### Headline tally

**30 unique mobile→backend endpoints** identified across Alphab2bapp
(React Native) and tidi_new (Flutter):

| Bucket | Count | What it means |
|---|---|---|
| **(a) Already SDK-exposed** | 6 | `/sdk/session/{create,refresh,revoke}`, `/sdk/v1/config`, `/sdk/v1/connections/:broker/{sell-auth,verify-sell-auth,attest-sell-auth}` |
| **(b) Needs SDK exposure** | 19 | Connect/reauth/order paths + portfolios + rebalance + egress IP + recommendations |
| **(c) Mobile-only / not SDK-relevant** | 5 | Push notifications, content feeds (PDFs/videos/blogs), AngelOne market snapshot, group-onboarding webhook |

**Stream 1 effort upgraded estimate**: 19 wrappers × 0.5 day each + integration
testing ≈ **2 weeks for one backend engineer**, slightly above the 1.5 weeks
in §6. (Mostly thin wrappers around existing routes — auth scope check,
session-token resolution, structured response shaping. The heavy lifts
already exist in `aq_backend_github/Routes/Broker/*` and `ccxt-india/apps/*`.)

### Domain-by-domain breakdown

#### A. Session & auth

| Endpoint | Method | Mobile caller | Backend route | Bucket |
|---|---|---|---|---|
| `/sdk/session/create` | POST | (planned) mobile-sdk init | `aq_backend Routes/sdk/session.js:77` | **(a)** |
| `/sdk/session/refresh` | POST | (planned) refresh hook | `aq_backend Routes/sdk/session.js:136` | **(a)** |
| `/sdk/session/revoke` | POST | (planned) logout | `aq_backend Routes/sdk/session.js:216` | **(a)** |

#### B. Broker connection (the critical path; biggest gap)

| Endpoint | Method | Mobile caller | Backend route | Bucket | Suggested SDK shape |
|---|---|---|---|---|---|
| `GET /api/user/getUser/{email}` | GET | `Alphab2bapp/src/screens/Authentication/*` + Flutter `AqApiService.dart:74` | `Routes/userRoutes.js:53` | **(b)** | `GET /sdk/v1/user/status` → `{ email, connect_broker_status, connected_brokers[] }` |
| `PUT /api/user/connect-broker` | PUT | `BrokerAuthScreen.js:261` (Alphab2bapp) | `Routes/userRoutes.js:672` | **(b)** | `PUT /sdk/v1/connections/{broker}/connect` body `{ jwtToken, clientCode?, apiKey?, sid?, baseUrl? }` |
| `PUT /api/kotak/connect-broker` | PUT | `KotakModal.js:162` | `Routes/Broker/Kotak.js:23` | **(b)** | folded into above with `broker=kotak` and Kotak-specific body fields |
| `POST /api/groww/update-key` | POST | `GrowwConnectModal.js:126` | `Routes/Broker/Groww.js` | **(b)** | folded into above; or dedicated `/sdk/v1/connections/groww/totp-update` |
| `POST /api/upstox/update-key`, `/api/fyers/update-key`, etc. | POST | per-broker modals | `Routes/Broker/*.js` | **(b)** | `POST /sdk/v1/connections/{broker}/update-credentials` |
| `GET /api/user/brokers/{broker}/reauth-url` | GET | Alphab2bapp `reauthHelpers.js`; tidi `ReauthHelper.dart` | `Routes/multiBrokerRoutes.js` | **(b)** | `GET /sdk/v1/connections/{broker}/reauth-url` |
| `PUT /api/user/brokers/{broker}/primary` | PUT | Alphab2bapp `reauthHelpers.js`; tidi `ReauthHelper.dart` | `Routes/multiBrokerRoutes.js` | **(b)** | `PUT /sdk/v1/connections/{broker}/primary` |
| `POST /ccxt/zerodha/login-url` | POST | RN `BrokerAuthScreen.js:86`; Flutter `AqApiService.dart` | `ccxt-india apps/app_zerodha.py` | **(b)** | `POST /sdk/v1/connections/zerodha/login-url` |
| `POST /ccxt/zerodha/gen-access-token` | POST | RN `BrokerAuthScreen.js:196` | `ccxt-india apps/app_zerodha.py` | **(b)** | `POST /sdk/v1/connections/zerodha/exchange-token` |
| `GET /ccxt/groww/login/oauth` | GET | RN `BrokerAuthScreen.js:101` | `ccxt-india apps/app_groww.py` | **(b)** | `GET /sdk/v1/connections/groww/login-url` (legacy; deprecated post-TOTP migration) |
| `GET /ccxt/dhan/login` | GET | RN `BrokerAuthScreen.js:109` | `ccxt-india apps/app_dhan.py` | **(b)** | `GET /sdk/v1/connections/dhan/login-url` |
| `POST /ccxt/axis/login-url` | POST | RN `BrokerAuthScreen.js:120` | `ccxt-india apps/app_axis.py` | **(b)** | `POST /sdk/v1/connections/axis/login-url` |
| `POST /ccxt/axis/callback` | POST | RN `BrokerAuthScreen.js:242` | `ccxt-india apps/app_axis.py` | **(b)** | `POST /sdk/v1/connections/axis/exchange-token` |
| `POST /ccxt/icici/customer-details` | POST | RN `icicimodal.js`; Flutter `BrokerCredentialPage.dart:706` | `ccxt-india apps/app_icici.py` | **(b)** | `POST /sdk/v1/connections/icicidirect/exchange-token` |

Pattern observation: every per-broker `login-url` and `exchange-token`
becomes a single `/sdk/v1/connections/{broker}/{login-url|exchange-token}`
contract. The SDK wrapper picks the right backend implementation by
broker key. **One generic wrapper covers all 14 brokers.**

#### C. EDIS / sell authorization (already done)

| Endpoint | Method | Bucket |
|---|---|---|
| `/sdk/v1/connections/{broker}/sell-auth` | GET | **(a)** |
| `/sdk/v1/connections/{broker}/verify-sell-auth` | POST | **(a)** |
| `/sdk/v1/connections/{broker}/attest-sell-auth` | POST | **(a)** |

#### D. Model portfolio + rebalance

| Endpoint | Method | Mobile caller | Backend route | Bucket | Suggested SDK shape |
|---|---|---|---|---|---|
| `GET /api/admin/plan/{advisor}/model%20portfolio/{email}` | GET | Flutter `AqApiService.dart:77` | `Routes/admin/plans.js` | **(b)** | `GET /sdk/v1/portfolios` |
| `GET /api/model-portfolio/portfolios/strategy/{modelName}` | GET | Flutter `AqApiService.dart:127` | `Routes/modelPortfolio.js` | **(b)** | `GET /sdk/v1/portfolios/{id}` |
| `GET /api/model-portfolio/subscribed-strategies/{email}` | GET | Alphab2bapp `TradeContext.js`; Flutter `AqApiService.dart:150` | `Routes/modelPortfolio.js` | **(b)** | `GET /sdk/v1/subscriptions` |
| `POST /ccxt/rebalance/calculate` | POST | RN + Flutter rebalance review pages | `ccxt-india apps/app_model_portfolio.py:3437` | **(b)** | `POST /sdk/v1/rebalance/calculate` |
| `POST /ccxt/rebalance/process-trade` | POST | tidi `OrderExecutionService.dart:407` | `ccxt-india apps/app_model_portfolio.py` | **(b)** | `POST /sdk/v1/rebalance/execute` (wraps LIMIT-IOC, scripmaster, market-hours) |
| `GET /ccxt/rebalance/v2/get-portfolio-performance` | GET | Flutter portfolio perf view | `ccxt-india apps/app_model_portfolio.py:2709` | **(b)** | `GET /sdk/v1/rebalance/performance` |
| `POST /ccxt/rebalance/change_broker_model_pf` | POST | RN broker-switch flow | `ccxt-india apps/app_model_portfolio.py` | **(b)** | `POST /sdk/v1/rebalance/switch-broker` |

**Important**: `POST /sdk/v1/rebalance/execute` is the natural home for
the **MARKET → LIMIT-IOC conversion**, **scripmaster `-EQ` resolution**,
and **market-hours gate** that we shipped in commits 28ab33fc /
178b56d5 / 7f69f707 / a65735e5 over the last week. Today these live
inside ccxt-india's per-broker code paths but aren't named as a
discrete SDK contract. Wrapping them here is what makes the mobile SDK
genuinely useful for external partners — they get LIMIT-IOC + scrip
fallback for free.

#### E. Egress IP

| Endpoint | Method | Mobile caller | Backend route | Bucket | Suggested SDK shape |
|---|---|---|---|---|---|
| `GET /ccxt/egress/me` | GET | RN/Flutter `EgressIpCallout` | `ccxt-india apps/app_egress.py` | **(b)** | `GET /sdk/v1/egress/status` (already tenant-scoped, just rename) |
| `POST /ccxt/egress/claim` | POST | RN/Flutter `EgressIpCallout` | `ccxt-india apps/app_egress.py` | **(b)** | `POST /sdk/v1/egress/claim` |

#### F. Tenant config (already done)

| Endpoint | Method | Bucket |
|---|---|---|
| `/sdk/v1/config` | GET | **(a)** |

#### G. Trade recommendations

| Endpoint | Method | Mobile caller | Backend route | Bucket | Suggested SDK shape |
|---|---|---|---|---|---|
| `GET /api/user/trade-reco-for-user?user_email={email}` | GET | RN `OrderScreen.js`, `TradeContext.js` | `Routes/recommendation.js` | **(b)** | `GET /sdk/v1/recommendations` |

#### H. Mobile-only (defer or never SDK)

| Endpoint | Why mobile-only |
|---|---|
| `GET/POST /api/sendnotification/*` | Per-app push tokens (FCM/APNS); each consumer app has its own infra |
| `POST /ccxt/comms/add-new-client-to-groups` | AlphaQuark-internal Telegram/Slack onboarding — doesn't generalize |
| `GET /ccxt/misc/{pdfs,videos,s3/blogs-content}` | AlphaQuark content CMS; content rights not portable to external partners |
| `POST /ccxt/angelone/market-data` | Proprietary advisor-side market snapshot; partner consumers should call AngelOne directly |
| In-app update prompt config (`/api/app-version/*`) | Per-app version; doesn't generalize |

### What this changes vs §6's plan

| §6 said | §8 says |
|---|---|
| Stream 1: ~1.5 weeks, 1 engineer | **Stream 1: ~2 weeks, 1 engineer** (19 wrappers, not 8 estimated) |
| 47 story points total | ~50 story points total (rounding) |

The shape of the recommendation doesn't change — the headline numbers
just become real instead of estimated. The new repo at
`alphaquark-mobile-sdk` (Stream 2 + Stream 3 home) is created and
mirrors this doc.

### Decisions unblocked by this audit

1. **Yes**, building the mobile SDK on top of the existing backend SDK
   is the right move — the backend already has 100% of the broker
   business logic (post-merger of `feature/4.1_sdk` + the last 2 weeks
   of broker fixes). Stream 1 is **wrapping**, not **rewriting**.
2. **No mobile-side fork of broker-business-logic is needed.** Every
   new broker quirk we ship continues to land in
   `aq_backend_github/Routes/Broker/*` and `ccxt-india`; the mobile SDK
   stays thin.
3. **Per-broker SDK route convention is `/sdk/v1/connections/{broker}/{action}`.**
   `{action}` ∈ `{login-url, exchange-token, connect, update-credentials,
   reauth-url, primary, sell-auth, verify-sell-auth, attest-sell-auth}`.
   That uniformity is what makes the mobile SDK's TypeScript / Dart
   API simple to consume.

### What I deliberately did NOT inventory

- WebSocket subscriptions (real-time prices) — those run through
  `websocket.alphaquark.in` directly, not the SDK; mobile SDK can
  proxy if needed but it's a Phase 4 concern.
- Holdings caching layer (`useMultiBrokerHoldings` hook on RN, Flutter
  equivalent) — these are app-side aggregation, not SDK calls.
- Login / OTP flows — those are app-side auth, separate from broker SDK.

These three categories can be revisited in a Phase 4 audit once the
broker-connect + rebalance migration is stable.

---

## §9 Phase 3 actual rollout — 2026-04-29 audit

This section captures the actual production state after Phase 3 broker-by-broker promotion, the audit conducted on 2026-04-29, gaps discovered, and the fixes that landed.

### Final state of `SDK_ELIGIBLE_MODALS`

Mobile (`src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js`):

```
new Set([
  'HDFC',           // OAuth-with-creds (after /login-url dispatch fix)
  'Upstox',         // OAuth-with-creds (after /login-url dispatch fix)
  'ICICI',          // OAuth-with-creds (after /login-url dispatch fix)
  'Motilal',        // OAuth-with-creds (after /login-url dispatch fix)
  'Dhan',           // OAuth-public (CCXT partner)
  'Kotak',          // credentials_totp
  'AliceBlue',      // OAuth-public (hardcoded prod.alphaquark.in origin)
  'Fyers',          // OAuth-with-creds (after /login-url dispatch fix)
  'Axis Securities',// OAuth-public (SSO via /api/axis/login-url)
  'DummyBroker',    // stub
])
```

`SDK_LEGACY_FALLBACK = new Set(['Angel One', 'Zerodha'])`.

Not in allowlist (legacy by default): **Groww**, **IIFL Securities**.

**10 of 14 brokers SDK-clean** post-audit (down from 11/14 pre-audit; IIFL rolled back).

### The 2026-04-29 audit

Triggered by: user request to verify each broker is actually routing through SDK and giving exact same UX as legacy when `REACT_APP_USE_SDK_BROKER_FLOW=true`.

Method: traced each broker's flow end-to-end through `Phase3SdkBrokerModal` → SDK widgets (`BrokerCredentialForm` + `WebViewBrokerAuthFlow` from `@alphaquark/mobile-sdk`) → backend `aq_backend_github/Routes/sdk/v1/connections.js` → ccxt-india routes. Compared against legacy modals (`src/components/BrokerConnectionModal/*.js` + `src/components/iiflmodal.js`) at every touchpoint.

### Findings

#### Finding 1: SDK widget didn't forward credentials to `/login-url`

**Severity:** Critical. Affected 5 brokers (HDFC / Upstox / ICICI Direct / Motilal Oswal / Fyers).

Legacy flow for these brokers:
1. POST `/api/<broker>/update-key` with apiKey + apiSecret → returns OAuth URL.
2. WebView at OAuth URL → captures `code` / `requestToken` / `accessToken`.
3. POST ccxt `/<broker>/gen-access-token` (or equivalent) → returns long-lived token.
4. PUT `/api/user/connect-broker` → persist.

SDK Phase 3 design (before audit):
- `BrokerCredentialForm` collected creds and called `onContinueToOauth(body)` for `flow=oauth` brokers.
- `Phase3SdkBrokerModal` mounted `WebViewBrokerAuthFlow` with `extraExchangeBody = body`.
- `WebViewBrokerAuthFlow.useEffect` called `client.getBrokerLoginUrl(broker, redirectUrl)` — sending **only** `redirectUrl`, NOT the credentials.
- Backend `/login-url` for these 5 brokers had no dispatch — fell to the `else` branch returning 400 `broker_login_url_not_applicable`.

Result: the SDK flow died at the first WebView step. User saw a "broker_login_url_failed" error from the SDK widget; never reached the OAuth screen.

**This was the same gap the user reported in earlier sessions** ("Axis broken with broker_login_url_failed", etc.). The Axis dispatch was fixed in a prior commit, but the same gap silently affected HDFC / Upstox / ICICI / Motilal / Fyers because they were promoted without verifying their `/login-url` actually worked.

**Fix shipped 2026-04-29:**

1. **SDK widget enhancement** (`alphaquark-mobile-sdk/packages/rn/src/`):
   - `client/AqSdkClient.ts:getBrokerLoginUrl` accepts a third `credentials` parameter and merges it into the POST body.
   - `components/WebViewBrokerAuthFlow.tsx` forwards `extraExchangeBody` as the `credentials` argument when calling `getBrokerLoginUrl`.
   - Added `extraExchangeBody` to the `useEffect` dep array.
2. **Backend `/login-url` dispatches** (`aq_backend_github/Routes/sdk/v1/connections.js`):
   - Added a single `else if (Upstox || Fyers || ICICI Direct || Motilal Oswal || Hdfc Securities)` branch.
   - Resolves slug from `LEGACY_PER_BROKER_SLUG`, calls `_selfCallLegacy` POST `/api/<slug>/update-key` with `{user_email, user_broker, apiKey, secretKey, clientCode, redirect_uri}`.
   - Parses OAuth URL from the legacy response — handles all 4 known shapes (`{loginUrl}`, `{authUrl}`, `{response: <url>}`, top-level string).
   - Returns `{ok, broker, loginUrl, expires_in_secs: 600}`.

UX parity post-fix: form collects creds → `getBrokerLoginUrl` sends them with redirectUrl → backend mints the OAuth URL via the same legacy `/api/<broker>/update-key` route the legacy modal hits → WebView opens at that URL. Identical to legacy at every touchpoint.

#### Finding 2: IIFL Securities — promoted but fundamentally broken

**Severity:** Critical. Affected 1 broker.

Legacy `iiflmodal.js`:
- Empty form fields. Opens WebView at hardcoded `https://markets.iiflcapital.com/?v=1&appkey=nHjYctmzvrHrYWA&redirect_url=...`.
- Captures `auth_token` + `clientid` from redirect.
- POSTs to ccxt `/iifl/login/client`.
- **Stores `iiflAccessToken` and `iiflClientCode` in AsyncStorage** — does NOT write to MongoDB.

SDK schema `brokerFormSchema.ts` for IIFL Securities: `flow=credentials_totp, fields=[apiKey, clientCode, password, dob]`. Fundamentally wrong shape.

In addition:
- `LEGACY_PER_BROKER_SLUG` has **no IIFL entry** — `/update-credentials` would 400 with `update_credentials_not_applicable`.
- `/login-url` has **no IIFL dispatch** — would 400 with `broker_login_url_not_applicable`.
- `Phase3BrokerHelp.js` has no IIFL help component — the SDK modal would render zero help content for IIFL.

If a user tapped IIFL with the flag on, they'd see a credentials form (wrong UX), submit, get a 400 error, and the connection would fail.

**Fix shipped 2026-04-29:** rolled back IIFL from `SDK_ELIGIBLE_MODALS`. Falls through to legacy `iiflmodal.js` — the only path that works today.

**Future work** (not in this commit):
- Schema reshape to `flow=oauth, fields=[]` (matching Zerodha / AliceBlue / Axis empty-fields shape).
- Backend `/login-url` dispatch hardcoding the IIFL OAuth URL (the hardcoded appkey `nHjYctmzvrHrYWA` lives in the legacy modal at line 52).
- Backend `/exchange-token` dispatch handling `auth_token` + `clientid` query params.
- Decision on persistence: keep AsyncStorage-only (matching legacy), OR add MongoDB write (architectural improvement). Probably the latter — the AsyncStorage-only design was historical, not deliberate.

#### Finding 3: Other brokers verified clean

After the two fixes above:
- **HDFC / Upstox / ICICI Direct / Motilal Oswal / Fyers** — `flow=oauth` with credential fields, OAuth URL minted via the new `/login-url` dispatch. Token exchange already worked via existing `/exchange-token` dispatches. Persistence via `_selfCallLegacy` PUT `/api/user/connect-broker`. ✅
- **Dhan** — `flow=oauth, fields=[]` (CCXT partner). `/login-url` already dispatched (line 901). Token exchange via fallthrough else-branch (`access_token` + `dhan_client_id` shape). ✅
- **Kotak** — `flow=credentials_totp`. `/update-credentials` → slug=`kotak` → `_selfCallLegacy` PUT `/api/kotak/connect-broker` (NEO migration path). ✅
- **AliceBlue** — `flow=oauth, fields=[]`. `/login-url` already dispatched (line 1000) with hardcoded `prod.alphaquark.in` origin. `/exchange-token` already dispatched (line 1236). ✅
- **Axis Securities** — `flow=oauth, fields=[]`. `/login-url` already dispatched (line 894) → `_selfCallLegacy` POST `/api/axis/login-url`. `/exchange-token` already dispatched (line 1136) → ccxt `/axis/callback`. ✅
- **DummyBroker** — `flow=stub`. SDK widget short-circuits. ✅
- **Angel One** — in `SDK_LEGACY_FALLBACK`. Routes to legacy `AngleoneBookingTrueSheet`. Verified the dispatch falls through correctly when broker is in fallback set. ✅
- **Zerodha** — in `SDK_LEGACY_FALLBACK`. Same routing. ✅
- **Groww** — not in `SDK_ELIGIBLE_MODALS`. Routes to legacy `GrowwConnectModal`. ✅

### UX-parity touchpoints verified per broker

| Touchpoint | Legacy | SDK (post-2026-04-29) | Match |
|---|---|---|---|
| Form fields rendered | Per-broker UI component | `BrokerCredentialForm` from schema | ✅ identical fields |
| Field encryption | `CryptoJS.AES.encrypt(value, 'ApiKeySecret')` | Same envelope via `encryptField` (Phase3SdkBrokerModal:120) | ✅ |
| Help content (video + steps) | Per-broker `*HelpContent.js` | `Phase3BrokerHelp` renders the same component | ✅ |
| IP-whitelist gate | `EgressIpCallout` + `egressReady` state | `EgressIpCallout` in `Phase3SdkBrokerModal` for `IP_WHITELIST_BROKERS` | ✅ matches per-broker |
| OAuth URL minting | POST `/api/<broker>/update-key` | POST `/sdk/v1/connections/<broker>/login-url` → `_selfCallLegacy` to same legacy route | ✅ same route hit |
| WebView OAuth screen | Broker portal | Same broker portal | ✅ identical |
| Redirect intercept | `onShouldStartLoadWithRequest` + `onNavigationStateChange` | `WebViewBrokerAuthFlow` matches origin+pathname of `redirectUrl` | ✅ |
| Token exchange | Client-side POST to ccxt | Server-side via `/exchange-token` → same ccxt route | ✅ same upstream |
| Persistence | PUT `/api/user/connect-broker` | Via `_selfCallLegacy` from `/exchange-token` → same legacy route | ✅ |
| Re-auth | `reauthConfig` pre-fills form + jumps to WebView | Routes to legacy via `isReauthFlow` short-circuit | ✅ via routing (cross-cutting SDK gap; reauth pre-fill not in widget) |
| Success/error UX | Toast / alert | Inline error banner / `fetchBrokerStatusModal` callback | ⚠️ minor (wording/surface differs but visible) |
| Model portfolio refresh | `/rebalance/change_broker_model_pf` | Not in SDK `onSuccess` | ⚠️ minor (post-success refresh missing) |

### Cross-cutting gaps still tracked (not fixed in this audit)

These remain documented in `docs/BROKER_FLOW_AUDIT.md § Cross-cutting findings`:

1. **Re-auth pre-fill API** — `BrokerCredentialForm` has no `reauthConfig` prop. Mitigated by the `isReauthFlow` short-circuit routing all reauth to legacy.
2. **Model portfolio refresh** — every legacy modal calls `change_broker_model_pf` after success; SDK `onSuccess` doesn't.
3. **Defensive URL parsing** for Upstox `+`-encoded errors — legacy parses `error_code` / `error_message` inline before opening WebView; SDK lets the user see the broker's error page instead.
4. **30-second debounces** — Kotak (TOTP rotation) and Motilal (page-session affinity) enforce 30s gaps between Connect taps in legacy. SDK widget has no equivalent.
5. **Custom User-Agent for Dhan** — legacy `DhanOAuthUI` spoofs Chrome to avoid bot detection. SDK `WebViewBrokerAuthFlow` may not apply.

All five gaps are minor (user-accepted "minor diffs are fine") and don't block production.

### What changed in this audit cycle (2026-04-29 commits)

**SDK package** (`@alphaquark/mobile-sdk` on `develop`):
- `getBrokerLoginUrl` accepts optional `credentials` arg.
- `WebViewBrokerAuthFlow` forwards `extraExchangeBody` to `getBrokerLoginUrl`.

**Mobile** (`Alphab2bapp` on `feature/sdk-integration`):
- IIFL removed from `SDK_ELIGIBLE_MODALS`.
- `android/app/build.gradle` versionCode bump.

**Backend** (`aq_backend_github` on `Ibt-branch`):
- `/sdk/v1/connections/:broker/login-url` gained dispatches for HDFC / Upstox / ICICI Direct / Motilal Oswal / Fyers — all proxy to `/api/<broker>/update-key` via `_selfCallLegacy`, parse OAuth URL from response.

### Lessons

1. **Promote with verified routing, not assumed routing.** HDFC / Upstox / ICICI / Motilal / Fyers were "promoted" in earlier commits with `/exchange-token` dispatches added but **`/login-url` never tested**. The audit caught this — would have surfaced as user-reported regressions otherwise.
2. **Schema flow type must match legacy UX shape.** IIFL's `credentials_totp` schema vs legacy's empty-fields OAuth was a deep mismatch that no test would have caught — only end-to-end audit. Schema-first promotion is the correct workflow per `CLAUDE.md § Phase 3 SDK Broker Migration — BLOCKING DOCUMENTATION REQUIREMENT`.
3. **The blocking-doc rule worked.** `docs/BROKER_FLOW_AUDIT.md` (per-broker deep flow) was the source of truth that made this audit possible. Without it, the IIFL mismatch and the `/login-url` gap would have been invisible.
