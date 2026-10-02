# SDK Trade-Execution Migration — Phase B Spec

> **Status:** Spec / pre-implementation. Phase A (architectural alignment) precedes this doc; Phase B (this doc) starts after Phase A lands and is dual-write-soaked.
> **Created:** 2026-05-01
> **Owner:** pratik@alphaquark.in
> **Related:** `docs/PHASE3_ARCHITECTURE.md` (broker-connect SDK migration — same pattern), `docs/APP_ARCHITECTURE.md`, `docs/MODEL_PORTFOLIO_ARCHITECTURE.md` (canonical MP doc; `docs/MODEL_PORTFOLIO.md` is now a pointer stub as of 2026-05-11), `docs/REBALANCING.md`

---

## What Phase B is

Phase B lifts trade-execution out of the legacy stack (`ProcessTrades.js` + Node `/api/process-trades/order-place` + ccxt `/<broker>/place-orders`) into the in-house SDK `@alphaquark/mobile-sdk` (RN package) and `alphaquark-mobile-sdk/packages/flutter` (Dart package). Mirrors what Phase 3 did for broker-connect:
- New SDK widgets and hooks for trade review / placement / result
- New backend routes under `aq_backend_github/Routes/sdk/v1/orders/` that proxy to the legacy execution path
- Feature-flagged migration (`REACT_APP_USE_SDK_TRADE_FLOW`) with a dual-write soak phase
- Eventually the legacy path is deprecated

**What Phase B is NOT:**
- A rewrite of per-broker execution logic. The broker-specific quirks (Motilal session rotation, ICICI string-error envelopes, Kotak baseUrl persistence, Angel One per-customer SmartAPI, Zerodha 302 race) live in `ccxt-india/brokers/<broker>/<broker>.py` regardless of who calls them. The SDK boundary sits ABOVE those, not below.
- A blocker on adding new brokers. Once the SDK contract exists, any new broker just needs ccxt-india support + an entry in `LEGACY_PER_BROKER_SLUG`.

## Why now

Three reasons converged on 2026-05-01:

1. **AMO display fix needs a normalized `variant` field** on every trade result. That field is the first piece of an SDK trade contract. Writing it well in legacy first (Phase 0, in flight as of this doc), then lifting it into the SDK in Phase B, is exactly the pattern that worked for connect (`reauthConfig` shape was settled in legacy first, then lifted into `Phase3SdkBrokerModal` props).
2. **Bespoke and MP execution paths have diverged.** MP's `MPReviewTradeModal.placeOrder` POSTs straight to `ccxt /rebalance/process-trade` (direct, no Node hop). Bespoke (`StockAdvices.js` → `ProcessTrades.js`) goes through Node's `/api/process-trades/order-place`. Two execution lanes for what should be one thing. Phase A (preceding this doc) ports bespoke to MP's direct-ccxt pattern; Phase B then lifts the unified path into SDK.
3. **tidi_new (Flutter) and Alphab2bapp (RN) are both consumers.** Future consumers (web, partner apps) will benefit from a single execution contract instead of re-inventing per-platform.

## Phase A — architectural alignment (precondition for Phase B)

Tracked separately. Summary:

- Bespoke single-trade (`StockAdvices.js` → `ProcessTrades.js`) and bespoke cart (`AddtoCartModal.js`) ported to call ccxt directly via the same pattern MP uses (`POST ${ccxtServer.baseUrl}rebalance/process-trade` or a parallel single-trade endpoint).
- Node `/api/process-trades/order-place` deprecated. Kept for one release as a fallback.
- App-side: `ProcessTrades.js` rewired to ccxt direct; success modal callers unchanged.

Phase A's app-side changes are **RN-only** because tidi_new (Flutter) has no bespoke execution path today. **However**, the SDK-package types and methods that Phase A uses to define the migrated bespoke contract (`Trade`, `TradeResult`, `executeBespokeTrade()`) MUST be added to BOTH the RN SDK package AND the Flutter SDK package in the same commit cycle — future Flutter consumers (a possible bespoke surface in tidi_new later, partner Flutter apps, web wrappers) need parity from day one. tidi_new just won't have a caller yet; that's fine.

Phase A is **complete** when:
- [x] All `ProcessTrades.js` callers go to ccxt direct. — done 2026-05-01 (4 callsites flipped to `/orders/process-trade`; `ProcessTrades.js` deleted as dead code).
- [ ] Node `/api/process-trades/order-place` has zero hits in `journalctl -u alphaquark.service` for one trading day. — pending one release worth of soak with fallback flag default-on.
- [x] ccxt-india has a bespoke equivalent endpoint that handles every code path bespoke previously hit. — done 2026-05-01: new `/orders/process-trade` mirrors `/rebalance/process-trade`'s response envelope, calls `BrokerFactory` + `process_trades()`, runs `ProcessTradesDbMananger.update_trade_reco()` for `traderecos` writes, calls `/<broker>/basket/run` when `basketId` present.

### Phase A progress

**2026-05-01 — initial Phase A landing**

- ccxt-india: new endpoint `POST /orders/process-trade` in `apps/app_orders.py`. Internally:
  - `@async_extract_keys('trades', 'user_email', 'user_broker')` (minimal required set)
  - Resolves credentials via `ProcessTradesDbMananger.fetch_trading_credentials(...)` then `normalize_credentials_for_broker(...)` — same as `/rebalance/process-trade`
  - `BrokerFactory.get_broker(...)` + `await self.broker.process_trades(trades)`
  - DB write via `ProcessTradesDbMananger.update_trade_reco(email, results, broker)` (handles BOTH non-basket `traderecos` top-level rows AND `basket_advice[]` array elements)
  - When `basketId` present: HTTP call to ccxt's own `/<broker>/basket/run` to regen net-position arrays (mirrors Node legacy)
  - Response envelope: `{results, orderErrors, fundsRequired, sessionExpired, status}` — same shape as `/rebalance/process-trade`
  - Echoes `clientTradeId` per result row when caller provided it (Phase B-1 SDK correlation precursor)
- App: 4 callsites flipped — `StockAdvices.js`, `AddtoCartModal.js`, `OrderService.js`, `IgnoreTradesScreen.js`. Each retains its existing per-broker payload assembly (no helper consolidation per user direction). Each implements legacy-Node fallback gated by `Config.REACT_APP_BESPOKE_DIRECT_CCXT_FALLBACK` (default `'true'`).
- App: `src/utils/ProcessTrades.js` + `src/__tests__/utils/ProcessTrades.test.js` deleted (verified zero runtime callers via grep).
- App: `src/__tests__/integration/brokerTradeFlow.test.js` rewritten against direct-ccxt mock pattern.
- SDK: `alphaquark-mobile-sdk/packages/rn/src/orders/types.ts` (NEW) and `packages/flutter/lib/src/orders/types.dart` (NEW) — internal-only types matching the Phase B contract. NOT exported from public package surface.

**Commit hashes:**
- `alphaquark-mobile-sdk` (develop): `b2e2161` — types-only commit
- `ccxt-india` (feature/4.0_broker on tidi): `7f5eeca` — `/orders/process-trade` endpoint + `trading_logic/orders/order_processor.py`
- `aq_backend_github` (Ibt-branch on tidi): `cb08e5f` — cross-repo CHANGELOG note (bundled with concurrent AMO display fix)
- `Alphab2bapp` (worktree-agent-a4b1db20203ef6c5d): see this commit

## Phase B — SDK lift

### Architecture diagram

```
                     PRE-PHASE-B (post-Phase-A)
            ┌────────────┐                         ┌───────────────┐
            │ MP Review  │ ─── ccxt direct ──→     │ ccxt-india    │
            │ Bespoke    │                         │ /<broker>/    │
            │ Bespoke    │                         │  place-orders │
            │ cart       │                         └───────────────┘
            └────────────┘

                     POST-PHASE-B
            ┌────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────────┐
            │ MP Review  │    │ SDK         │    │ aq_backend  │    │ ccxt-india    │
            │ Bespoke    │ ─→ │ <TradeReview│ ─→ │ /sdk/v1/    │ ─→ │ /<broker>/    │
            │ Bespoke    │    │ Sheet>      │    │  orders/    │    │  place-orders │
            │ cart       │    │ widgets     │    │  place      │    │               │
            └────────────┘    └─────────────┘    └─────────────┘    └───────────────┘
                              SDK auth (JWT)     proxy to legacy    same backend
```

The SDK route layer is a thin proxy (mirror of how `/sdk/v1/connections/...` proxies to `/api/<broker>/...` in Phase 3). All the per-broker quirks stay in `Routes/Broker/<broker>.js` and ccxt-india's `app_<broker>.py` / `brokers/<broker>/`.

### SDK module structure (RN + Flutter)

```
alphaquark-mobile-sdk/
├── packages/rn/src/
│   ├── orders/
│   │   ├── types.ts                 # Trade, TradeResult, OrderStatus, Position
│   │   ├── useExecuteTrades.ts      # hook — submit + observe progress
│   │   ├── useOrderBook.ts          # hook — pending + history fetch
│   │   ├── client.ts                # internal HTTP client (auth-mint + retry)
│   │   └── index.ts                 # barrel export
│   ├── components/
│   │   ├── TradeReviewSheet.tsx     # replaces RebalanceModal review section
│   │   ├── TradeExecutionProgress.tsx # running status during placement
│   │   ├── TradeResultModal.tsx     # replaces RecommendationSuccessModal (1102 LOC today)
│   │   └── ...                      # existing connect widgets unchanged
│   └── index.ts                     # add `orders` to public surface
└── packages/flutter/lib/src/
    ├── orders/
    │   ├── types.dart               # Trade, TradeResult, OrderStatus, Position
    │   ├── execute_trades.dart      # method — submit + Stream<TradeProgress>
    │   ├── order_book.dart          # method — pending + history fetch
    │   ├── client.dart              # internal HTTP client (auth-mint + retry)
    │   └── orders.dart              # barrel export
    ├── widgets/
    │   ├── trade_review_sheet.dart
    │   ├── trade_execution_progress.dart
    │   ├── trade_result_modal.dart
    │   └── ...
    └── alphaquark_mobile_sdk.dart   # add `orders` to public surface
```

### API contract — `Trade` and `TradeResult`

Trade (input):

```ts
type Trade = {
  symbol: string;          // canonical symbol — SDK normalizes per broker
  exchange: 'NSE' | 'BSE';
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  price?: number;          // required for LIMIT/SL
  triggerPrice?: number;   // required for SL/SL-M
  productType: 'CNC' | 'MIS' | 'NRML';
  variant: 'AMO' | 'REGULAR';     // NEW — added in AMO display fix (Phase 0)
  // Per-flow context (optional):
  modelId?: string;        // MP only
  uniqueId?: string;       // MP only
  adviceId?: string;       // bespoke only
  // Internal:
  clientTradeId: string;   // app-generated UUID for correlation across the dual-write soak
};
```

TradeResult (output, one per Trade):

```ts
type TradeResult = {
  clientTradeId: string;        // matches input
  brokerOrderId?: string;       // populated when broker accepted
  symbol: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  status: 'PLACED' | 'FILLED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED' | 'PENDING' | 'AMO_QUEUED';
  variant: 'AMO' | 'REGULAR';
  filledQuantity?: number;
  averagePrice?: number;
  rejectionReason?: string;     // human-readable, already-humanized by SDK route
  rawError?: unknown;           // for debug / Sentry only
  placedAt: string;             // ISO 8601
  expectedFillAt?: string;      // for AMO_QUEUED — next market open IST
};
```

**Status normalization:** SDK route maps every broker's status string into the enum above. Brokers expose 30+ distinct strings today (`open`, `OPEN`, `complete`, `EXECUTED`, `COMPLETE`, `Filled`, `placed`, `PLACED`, etc.). The map lives in `aq_backend_github/Routes/sdk/v1/orders/_normalizeStatus.js` (ported from / replacing piecemeal logic in `src/utils/orderStatusUtils.js`).

### SDK hook — `useExecuteTrades` (RN)

```ts
const { execute, progress, results, isExecuting, error } = useExecuteTrades({
  brokerName: 'Zerodha',         // optional — defaults to user's primary
});

// Caller:
await execute(trades);

// progress: { total: 5, completed: 2, currentSymbol: 'INFY-EQ' }
// results: TradeResult[] populated per-trade as they come back
// error: terminal SDK error (auth, network) — per-trade rejections live in results
```

Internally:
1. Mint SDK auth token via the connect mint server (same as Phase 3)
2. POST to `/sdk/v1/orders/place` with the trade list + brokerName
3. Stream-parse the response (or poll `/sdk/v1/orders/status` if the place endpoint returns immediately)
4. Update progress + results state

Flutter equivalent: `executeTrades(trades) → Stream<TradeProgress>`. Same wire shape.

### Backend SDK routes — `aq_backend_github/Routes/sdk/v1/orders/`

```
POST   /sdk/v1/orders/place              — accept normalized trades, dispatch per-broker
POST   /sdk/v1/orders/:orderId/status    — single-order status
GET    /sdk/v1/orders/book               — pending + history fetch (paginated)
GET    /sdk/v1/orders/:orderId           — single-order detail
POST   /sdk/v1/orders/:orderId/cancel    — cancel (where supported per-broker)
```

Each route:
- Validates SDK session via `sdkAuthSession({ scope: 'orders:write' | 'orders:read' })` middleware
- Resolves the user's broker from `connected_brokers[]` (or accepts `?broker=` override)
- Proxies to legacy via `_selfCallLegacy()` (same helper Phase 3 uses)
- Normalizes the response shape via `_normalizeStatus.js` + `_normalizeError.js`
- Echoes the input `clientTradeId` so the SDK can correlate

### Auth model — JWT vs aq-encrypted-key

**Today:** MP/bespoke direct-ccxt calls use `aq-encrypted-key` headers signed by `REACT_APP_AQ_KEYS`/`REACT_APP_AQ_SECRET`. Phase 3 SDK connect uses minted JWT via the mint server (`https://github.com/pk1762012/aq-sdk-mint-server`).

**Phase B decision:** SDK trade execution uses the **same minted JWT** as connect. Reasons:
- Single auth model for the SDK lane — simpler tenant onboarding
- JWT carries scope claims (`orders:write` / `orders:read`) that the route middleware enforces
- The mint server already handles tenant resolution + key rotation

**Backend impact:** ccxt-india must accept SDK-minted JWTs (in addition to the legacy `aq-encrypted-key`). One new middleware in ccxt-india's request pipeline. Estimate: 0.5 day.

**Migration safety:** the dual-write soak runs both auth models in parallel — old aq-encrypted-key path keeps working while SDK lane proves out.

### Per-broker rollout — single flag, not allowlist

Unlike Phase 3 (which has per-broker `OAUTH_REAUTH_AUTOJUMP_BROKERS` and historical `SDK_ELIGIBLE_MODALS`), trade execution is **all-13-or-nothing**. The per-broker quirks live in ccxt-india / Node legacy, downstream of the SDK boundary. There's no broker-specific work in the SDK trade widgets (the connect widgets had per-broker form fields; the trade widgets just take `Trade[]`).

So:
- Single feature flag `REACT_APP_USE_SDK_TRADE_FLOW` (RN) and `USE_SDK_TRADE_FLOW=true` in tidi_new `.env.production` (Flutter)
- When flipped, ALL trade flows (MP, bespoke, cart) route through SDK
- No per-broker fallback set

If a per-broker bug shows up post-flip, the fix is in ccxt-india / Node, not in the SDK widget tree.

### Dual-write soak phase

Mirror of Phase 2's connect dual-write. ~2-4 weeks running both paths in parallel:

- App calls **both** legacy and SDK execution paths for every trade submission
- Compares results: `clientTradeId` matches across, `status` agrees, `brokerOrderId` matches when both paths got one
- Logs divergences to Sentry / a tenant-keyed Mongo collection (`trade_dual_write_audit`)
- User sees only legacy results during the soak (SDK results are shadow)
- Goes wrong silently — divergence rate per broker per tenant is the success metric

This is the gate before flipping the flag for any tenant.

### App migration — file-by-file

#### Alphab2bapp (RN)

| Today | After Phase B |
|---|---|
| `src/utils/ProcessTrades.js` (~700 LOC) | Deleted; thin wrapper around `useExecuteTrades` |
| `src/components/AdviceScreenComponents/RebalanceModal.js` (review section) | SDK `<TradeReviewSheet>` |
| `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` (1900+ LOC) | SDK `<TradeReviewSheet>` |
| `src/components/ModelPortfolioComponents/RecommendationSuccessModal.js` (1102 LOC) | SDK `<TradeResultModal>` |
| `src/components/AdviceScreenComponents/StockAdvices.js` (caller) | Same file; `ProcessTrades(...)` → `useExecuteTrades` hook |
| `src/components/AdviceScreenComponents/AddtoCartModal.js` (caller) | Same file; `ProcessTrades(...)` → `useExecuteTrades` hook |
| `src/screens/Rebalance/ExecutionStatusScreen.js` | Same file; uses `useOrderBook` + SDK `<TradeExecutionProgress>` |
| `src/utils/orderStatusUtils.js` | Deprecated; SDK owns status normalization |
| `src/services/OrderService.js` | Deprecated or thin wrapper around `useOrderBook` |
| `src/services/BrokerOrderBookAPI.js` | Deprecated |

Net deletion: ~2000-3000 LOC of app-side per-broker glue. SDK package gains ~2000 LOC for the equivalent contract.

#### tidi_new (Flutter)

tidi_new has **no bespoke execution path** — only MP rebalance. So the Flutter side is smaller:

| Today | After Phase B |
|---|---|
| `lib/components/.../MPReviewPage.dart` (or equivalent) | SDK `TradeReviewSheet` widget |
| `lib/components/.../RebalanceResultPage.dart` (or equivalent) | SDK `TradeResultModal` widget |
| `lib/service/OrderExecutionService.dart` | Deprecated; thin wrapper around SDK method |

Same field-by-field types and methods as RN. Use Dart's strong typing to catch divergence at compile time.

### Per-broker validation matrix (test before flag flip)

Run these in a test tenant (`testaccount@gmail.com`) for each of 13 brokers:

| # | Test | Pass criteria |
|---|---|---|
| 1 | Single bespoke BUY MARKET CNC during market hours | `status: PLACED`, then `FILLED` within 30s, `variant: REGULAR` |
| 2 | Single bespoke BUY MARKET CNC after market close | `status: AMO_QUEUED`, `variant: AMO`, `expectedFillAt` populated |
| 3 | Bespoke cart of 3 BUYs | All 3 placed; partial failures isolated to those rows |
| 4 | MP rebalance basket (10+ trades) | All placed; mixed BUY/SELL handled |
| 5 | Trade with insufficient funds | `status: REJECTED`, `rejectionReason` is human-readable (not raw broker JSON) |
| 6 | Trade for unknown symbol | `status: REJECTED`, `rejectionReason: 'Symbol not found on <Broker>'` |
| 7 | LIMIT order at unreasonable price | `status: PLACED` (broker accepts; user can cancel later) |
| 8 | Cancel a pending order | Per-broker cancel route works; `status: CANCELLED` |
| 9 | Order book — pending + history fetch | Both populated, `variant` field present, statuses are normalized enum |
| 10 | SDK auth expiry mid-batch | Auto-renew via mint server; user doesn't see auth error |

Each broker × 10 tests = 130 test runs. Allocate one trading day per broker pair.

### Sequencing

1. **Phase 0 (in flight, Day 0):** AMO display fix — defines `variant` field in legacy paths. Display-only.
2. **Phase A (Days 1-5):** Bespoke + cart ported to MP's direct-ccxt pattern. Eliminates the bespoke-vs-MP divergence. App-side changes are RN-only (no Flutter caller exists today), but the SDK-package contract (`Trade`, `TradeResult`, helper methods) ships in BOTH RN AND Flutter SDK packages so future Flutter consumers have parity.
3. **Phase B-1 (Days 6-10):** SDK module added — types, hooks, widgets — built in `alphaquark-mobile-sdk` against the `dev` branch. Backend SDK routes added under `/sdk/v1/orders/`. Auth-mint extended to `orders:*` scopes. Both RN and Flutter SDK packages get the new module.
4. **Phase B-2 (Days 11-15):** App-side migration — Alphab2bapp + tidi_new wired to SDK widgets behind `REACT_APP_USE_SDK_TRADE_FLOW` flag. Dual-write logging added.
5. **Phase B-3 (Days 16-30):** Dual-write soak. Per-tenant divergence audit. Per-broker validation matrix executed.
6. **Phase B-4 (Day 30+):** Flag flip per-tenant. Legacy `ProcessTrades.js` and Node `/api/process-trades/order-place` deprecation announced.
7. **Phase B-5 (Day 60+):** Legacy paths deleted from RN + Node.

### Out of scope (explicitly)

- **Pre-flight market-closed banner** at the review-trade step. Tracked separately.
- **Web frontend (`prod-alphaquark-github`) trade execution.** Web has its own execution stack today; will be evaluated for SDK lift after mobile soak.
- **Order modify** (changing price/quantity on a pending order). Per-broker support varies; can be added in Phase C.
- **Multi-leg / cover orders.** Some brokers support; UX needs design work; out of MVP.
- **Smart order routing** (split between brokers). Out of scope.
- **Position management** (squaring off intraday positions). Existing flow unchanged.

### Open questions — settled 2026-05-01 before Phase B-1 kickoff

1. **Auth mint server load — short-TTL JWT, mint per trade-batch (not per trade).** Phase 3 connect peaks ~50 mint/min per tenant. Phase B will ~5-10x that during active trading hours if every trade re-mints. **Decision:** mint once per `useExecuteTrades(...)` invocation (covers an entire batch — basket of N trades or a single bespoke trade). TTL stays short (15s, same as Phase 3 connect mint). If mint server actually struggles in soak, revisit with refresh-token pattern in B-2.
2. **WebSocket-driven progress vs polling — polling for B-1 MVP.** Today MP's `placeOrder` is fire-and-forget; UI doesn't show per-trade progress. **Decision:** client-side polling on `/sdk/v1/orders/status` at 2-3s intervals while in-flight. WebSocket upgrade can come in B-2 once we know the actual UX gap. Polling is good enough for the typical 5-15s broker round-trip.
3. **`clientTradeId` correlation across dual-write — solved in Phase A.** Phase A `76b44cb` already added `clientTradeId` (UUID per trade) to every outgoing payload. SDK route layer passes through unchanged.
4. **Shadow vs visible during soak — shadow.** Default. Lower risk for production trades. SDK lane runs in background, divergences logged to a tenant-keyed Mongo collection (`trade_dual_write_audit`). User sees legacy results during the soak. Per-broker per-tenant divergence rate is the success metric.
5. **SDK package versioning — `2.0.0` on flag flip, not B-1.** B-1 lands the new `orders/` module as additive (no breaking changes, internal-only types still). The actual major version bump happens at the flag flip in B-4. Until then, B-1 ships under `1.x` minor bumps.

### Phase B-1 deliverables — concrete

Server-side:
- `aq_backend_github/Routes/sdk/v1/orders/` — new SDK proxy routes: `POST /place`, `POST /:orderId/status`, `GET /book`, `POST /:orderId/cancel`. Each authenticates via `sdkAuthSession({ scope: 'orders:write' | 'orders:read' })` (existing middleware from Phase 3 connect — extend the scope enum), then proxies to ccxt-india `/orders/process-trade` (Phase A endpoint) using internal `aq-encrypted-key`. ccxt-india unchanged — it doesn't need to know about JWTs.
- Mint server (`tidi:~/servers/server2/aq-sdk-mint-server`) — extend scopes whitelist to include `orders:write` and `orders:read`. Token-mint endpoint already accepts a scope claim; just needs the new strings allowlisted.

SDK package side (RN + Flutter, both in `alphaquark-mobile-sdk` repo):
- `packages/rn/src/orders/hooks/useExecuteTrades.ts` — submits trades, polls `/sdk/v1/orders/status` until terminal, exposes `{progress, results, isExecuting, error}`.
- `packages/rn/src/orders/hooks/useOrderBook.ts` — paginated pending + history fetch.
- `packages/rn/src/orders/components/TradeReviewSheet.tsx` — basket review UI (visual surface; integration in B-2).
- `packages/rn/src/orders/components/TradeResultModal.tsx` — per-trade result list with normalized status pills + AMO chip.
- `packages/rn/src/orders/components/TradeExecutionProgress.tsx` — running progress while polling.
- `packages/rn/src/orders/index.ts` — barrel export. Hooks + widgets exported; types stay internal until B-4 (per #5 above).
- `packages/flutter/lib/src/orders/` — Dart mirrors with `executeTrades()` returning `Stream<TradeProgress>`.

Out of scope for B-1 (deferred to B-2):
- Wiring the new hooks/widgets into Alphab2bapp + tidi_new app code.
- `REACT_APP_USE_SDK_TRADE_FLOW` feature flag.
- Dual-write logging into `trade_dual_write_audit` Mongo collection.

### Phase B-1 progress

**2026-05-01 — initial Phase B-1 landing**

Backend (`aq_backend_github`, branch `Ibt-branch`, on tidi):

- New `Routes/sdk/v1/_helpers/selfCallLegacy.js` — extracted from `connections.js` lines 119–177 verbatim. Mints a fresh `aq-encrypted-key` JWT via `SecurityTokenManager(encryptionApiKey, encryptionSecretKey)`, calls `http://localhost:${PORT}${path}` with `Content-Type: application/json`, `X-Advisor-Subdomain: <tenant>`, `aq-encrypted-key: <minted JWT>`. Same `validateStatus: () => true` pass-through, same 25s timeout. Single source of truth — both `connections.js` and the new orders routes import from it.
- `Routes/sdk/v1/connections.js` refactored to `const { _selfCallLegacy } = require("./_helpers/selfCallLegacy");`. Inline helper deleted. Behavior unchanged.
- New `Routes/sdk/v1/orders/index.js` — the four SDK proxy routes:
  - `POST /sdk/v1/orders/place` — `sdkAuthSession({ scope: "orders:write" })`. Body `{trades, brokerName?, basketId?, basketName?}`. Resolves user_email from `req.sdkSession`, resolves broker from body or user's primary `connected_brokers[]`. `_selfCallLegacy({ method: "POST", path: "/orders/process-trade", body: {trades, user_email, user_broker, basketId, basketName} })`. Returns the ccxt envelope verbatim (`{results, orderErrors, fundsRequired, sessionExpired, status}`).
  - `POST /sdk/v1/orders/:orderId/status` — `sdkAuthSession({ scope: "orders:read" })`. Resolves `userId` (Mongo ObjectId of user). `_selfCallLegacy({ method: "POST", path: "/order/status", body: {userId, brokerName, advisorDb, orderId} })`. Returns ccxt's `{success, data}`.
  - `GET /sdk/v1/orders/book?status=&broker=&page=&limit=` — `sdkAuthSession({ scope: "orders:read" })`. Resolves `userId`. `_selfCallLegacy({ method: "POST", path: "/order/book", body: {userId, brokerName, advisorDb} })`. Applies client-side `status` filter (case-insensitive), `broker` filter, then slices `page` × `limit` (defaults 1 / 50). Returns `{orders, total, page, limit, hasMore}`.
  - `POST /sdk/v1/orders/:orderId/cancel` — `sdkAuthSession({ scope: "orders:write" })`. Resolves `userId`. `_selfCallLegacy({ method: "POST", path: "/order/cancel", body: {userId, brokerName, advisorDb, orderId} })`. Returns `{cancelled: bool, orderId, raw}`.
- `index.js` — mount `app.use("/sdk/v1/orders", require("./Routes/sdk/v1/orders"));` next to the existing `/sdk/v1/connections` line.
- Mint server (`aq-sdk-mint-server`): **no changes**. `ALL_SCOPES` in `aq_backend_github/utilities/sessionToken.js:56` already includes `orders:read` + `orders:write`; the mint server is a thin proxy with no per-scope allowlist.

SDK package (`alphaquark-mobile-sdk`, branch `develop`):

- RN — `packages/rn/src/orders/`:
  - `hooks/useExecuteTrades.ts` — `useExecuteTrades({ brokerName? })` returns `{ execute, progress, results, isExecuting, error }`. `execute(trades)` POSTs `{trades, brokerName}` to `/sdk/v1/orders/place`. For each result row with `orderStatus === "PENDING"`, polls `POST /sdk/v1/orders/${brokerOrderId}/status` at 2.5s interval until terminal (`FILLED | PARTIAL | REJECTED | CANCELLED | AMO_QUEUED`). Updates `progress: {total, completed, currentSymbol?}`. Auth via the SDK package's existing `AqSdkClient` (Phase 3 mint pattern reused).
  - `hooks/useOrderBook.ts` — `useOrderBook({ status?, broker?, page?, limit? })` returns `{ orders, isLoading, error, refresh, loadMore, total, hasMore }`. Cursor `loadMore` advances `page`.
  - `components/TradeReviewSheet.tsx` — props `{ trades, onConfirm, onCancel, brokerName?, totalEstimate?, isPlacing? }`. Pure UI; no API calls.
  - `components/TradeResultModal.tsx` — props `{ results, onClose, originalStockDetails? }`. Per-trade row with normalized status pills + AMO chip via `theme.colors.status.warning(Bg)` (with hardcoded amber fallback `#fbbf24` / `#fef3c7` matching Alphab2bapp commit `c83f1a5`).
  - `components/TradeExecutionProgress.tsx` — props `{ progress, results }`. Spinner + "Placing N of M: SYMBOL" + per-row mini status.
  - `index.ts` — barrel: exports the 2 hooks + 3 components. **Types stay internal** per spec § "Open questions — settled" #5.
  - `packages/rn/src/index.ts` extended with `export * from "./orders";`.
- Flutter — `packages/flutter/lib/src/orders/`:
  - `execute_trades.dart` — `Stream<TradeProgress> executeTrades(List<Trade> trades, {String? brokerName})`.
  - `order_book.dart` — `Future<OrderBookPage> fetchOrderBook(...)`.
  - `widgets/trade_review_sheet.dart`, `widgets/trade_result_modal.dart`, `widgets/trade_execution_progress.dart`.
  - `orders.dart` — barrel.
  - `packages/flutter/lib/alphaquark_mobile_sdk.dart` extended with the orders re-export.

**Commit hashes:**
- `aq_backend_github` (Ibt-branch on tidi): see commit
- `alphaquark-mobile-sdk` (develop): see commit
- `Alphab2bapp` (worktree off `feature/sdk-plus-config-ui`): docs-only commit, see commit

**Smoke verification:**
- `POST /sdk/v1/orders/place` without Bearer → 401 `missing_session_token`.
- `POST /sdk/v1/orders/place` with malformed body → 400 with validation envelope.
- Real-credential E2E test deferred to Phase B-2 when caller wiring lands; for B-1 the routes verify only auth + validation envelopes (no tenant JWT available in this commit's verification step).

**Restart:** `alphaquark.service` restarted on tidi after backend commit; verified `is-active` + prod root curl returns 200/302 (live).

## Pointers

- AMO display contract (Phase 0): `docs/APP_ARCHITECTURE.md § AMO display contract`
- Phase A spec / progress: `docs/APP_ARCHITECTURE.md § Trade execution architectural alignment` (TBD when Phase A starts)
- Phase 3 connect SDK (template for this work): `docs/PHASE3_ARCHITECTURE.md`
- ProcessTrades current implementation: `src/utils/ProcessTrades.js`
- MP review-trade direct-ccxt pattern: `src/components/ModelPortfolioComponents/MPReviewTradeModal.js#placeOrder` (line 294)
- SDK package home: `../../alphaquark-mobile-sdk/` (RN: `packages/rn/src/`, Flutter: `packages/flutter/lib/src/`)
- Backend SDK routes home: `../aq_backend_github/Routes/sdk/v1/`
- Mint server: https://github.com/pk1762012/aq-sdk-mint-server
