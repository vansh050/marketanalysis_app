# SDK Orchestration Contract — TS + Dart Parallel API Surface

## Order-result status amendment (2026-09-28)

Public rows use `FILLED`, `PARTIAL`, `REJECTED`, `CANCELLED`, `AMO_QUEUED`,
`PLACED`, or `PENDING`; `brokerOrderStatus` retains the adapter word. Explicit
zero-filled/full-pending evidence wins over `COMPLETE` and remains `PENDING`.
Status polling accepts the optional leg `exchange`. A capital-reservation
Calculate refusal uses `recompute:false` and
`customerAction.code=REVIEW_OTHER_PORTFOLIO`; clients must not loop Calculate.

> **2026-09-27 funding-state amendment:** the backend rebalance contract may
> return `funding.classification=INSUFFICIENT_BROKER_BALANCE`,
> `customerAction.code=ADD_FUNDS`, and `fundingConsent.options=["add_funds"]`
> after a successful broker balance read of zero. This is a calculated but
> non-executable result. Hosts must show target/available/shortfall, must not
> offer Continue with available funds, and must not call `executeAdvice`.

> **2026-08-28 durable amendment:** eligible non-model API orders return `status=queued`, `executionState=queued`, and `jobId`. Unknown outcomes are paused/`checking_broker` with `safeToRetryPlacement=false`; HTTP 409 is never automatically retried. Model portfolios remain guarded, SELL-before-BUY, and carry plan id/version/hash plus stable advice identity.

> **Status**: drafting (started 2026-05-02). Companion to
> `SDK_ORCHESTRATION_VISION.md`, `SDK_ORCHESTRATION_AUDIT.md`,
> `SDK_ORCHESTRATION_PHASES.md`.
>
> **Purpose**: lock the public API surface that both `@alphaquark/mobile-sdk`
> packages (RN/TypeScript and Flutter/Dart) expose to host apps. Every
> method here ships in BOTH packages with identical semantics.
> Drift between the two = bug. PR review checklist enforces parity.
>
> **Versioning**: orchestrator API is `v1` and ships under SDK package
> minor versions until Phase F lands; major version bump (`2.0.0`) at
> Phase F flag-flip per `SDK_ORCHESTRATION_PHASES.md § Phase F`.
>
> **Status enums**, **error codes**, and **shared types** are normative
> here — implementations in either package MUST use these names exactly.

---

## 1. Top-level facade

### TypeScript (RN)

```ts
import { useAqSdk } from '@alphaquark/mobile-sdk';

const { client } = useAqSdk();

// Public orchestrator methods on the client:
client.executeAdvice(advice: AdviceInput, opts?: ExecuteOpts): Promise<AdviceResult>;
client.connectBroker(brokerName: string, opts?: ConnectOpts): Promise<BrokerConnection>;
client.reauth(brokerName: string, opts?: ReauthOpts): Promise<BrokerConnection>;
client.disconnectBroker(brokerName: string): Promise<DisconnectResult>;

// Hook variants for screens that want React state during orchestration:
const { execute, progress, results, isExecuting, error } = useExecuteAdvice();
const { connect, isConnecting, error } = useConnectBroker();
const { reauth, isReauthing, error } = useReauth();
```

### Dart (Flutter)

```dart
import 'package:aq_mobile_sdk/aq_mobile_sdk.dart';

final client = AqSdkClient.of(context);

// Public orchestrator methods on the client:
Future<AdviceResult> executeAdvice(AdviceInput advice, {ExecuteOpts? opts});
Future<BrokerConnection> connectBroker(String brokerName, {ConnectOpts? opts});
Future<BrokerConnection> reauth(String brokerName, {ReauthOpts? opts});
Future<DisconnectResult> disconnectBroker(String brokerName);

// Streaming variants for in-flight progress:
Stream<ExecuteProgress> executeAdviceStream(AdviceInput advice, {ExecuteOpts? opts});
```

**Parity invariant**: both languages expose the same four entry points
with the same input + output shapes. Streaming variants exist in both
(RN: hook with `progress` state; Flutter: `Stream<ExecuteProgress>`).

---

## 2. `executeAdvice` — the central orchestrator

### Input — `AdviceInput`

```ts
type AdviceInput =
  | BespokeSingleAdvice
  | BespokeCartAdvice
  | MpRebalanceAdvice
  | MpInitialAllocationAdvice;

interface AdviceBase {
  /**
   * Stable client-generated UUID. Used for dual-write correlation
   * during the soak phase and as an idempotency key for retry.
   */
  clientAdviceId: string;

  /**
   * Optional broker override. Defaults to user's primary connected
   * broker. SDK falls back to broker-selection prompt if neither set
   * nor primary available.
   */
  brokerName?: string;
}

interface BespokeSingleAdvice extends AdviceBase {
  kind: 'bespokeSingle';
  trade: TradeIntent;
  adviceId: string;          // server-side advice ID — for backend correlation
}

interface BespokeCartAdvice extends AdviceBase {
  kind: 'bespokeCart';
  trades: TradeIntent[];
  cartId?: string;
}

interface MpRebalanceAdvice extends AdviceBase {
  kind: 'mpRebalance';
  modelId: string;
  uniqueId: string;          // rebalance-instance ID
  trades: TradeIntent[];
  basketId?: string;
}

interface MpInitialAllocationAdvice extends AdviceBase {
  kind: 'mpInitialAllocation';
  modelId: string;
  uniqueId: string;
  trades: TradeIntent[];
  subscriptionId: string;    // app-side persisted subscription ID
}

interface TradeIntent {
  symbol: string;            // canonical — SDK normalizes per broker
  exchange: 'NSE' | 'BSE';
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  price?: number;            // required for LIMIT/SL
  triggerPrice?: number;     // required for SL/SL-M
  productType: 'CNC' | 'MIS' | 'NRML';
  variant?: 'AMO' | 'REGULAR';  // SDK detects from market hours if absent
}
```

Dart equivalent: same field names, sealed-class for the `AdviceInput`
tagged union.

### Options — `ExecuteOpts`

```ts
interface ExecuteOpts {
  /**
   * Render the SDK's themed result modal at the end of the flow.
   * Default true. Set false when the host app wants to render its
   * own success card from the AdviceResult.
   */
  presentResult?: boolean;

  /**
   * Skip the funds availability pre-check. Default false. When true,
   * funds insufficiency surfaces as per-row REJECTED in the result
   * instead of as an early-exit OrchestrationError.
   */
  skipFundsCheck?: boolean;

  /**
   * Override polling cadence for in-flight orders. Default 5000ms (5s).
   */
  pollIntervalMs?: number;

  /**
   * Hard timeout per row of the polling phase. Default 3 minutes.
   * After this the row is left at its last known status and the
   * orchestrator returns; user can refresh order book later.
   */
  pollTimeoutMs?: number;
}
```

### Output — `AdviceResult`

```ts
interface AdviceResult {
  clientAdviceId: string;        // matches input

  /** Aggregated terminal status across all rows. */
  status: 'success' | 'partial' | 'all_rejected';

  /** One result row per input trade. */
  rows: TradeResultRow[];

  /** Per-broker order-book reference for follow-up. */
  brokerOrderIds: string[];

  /** Total funds debited from the broker (sum of fills × price). */
  capitalDeployed?: number;

  /** True when at least one row is AMO-queued (off-hours submission). */
  hasAmoRows: boolean;

  /** ISO 8601 of when the orchestrator received its terminal result. */
  completedAt: string;

  /** `paused` means some legs may be at the broker or were intentionally
   * withheld by a safety gate. Hosts MUST NOT invoke a legacy fallback. */
  executionState?: 'complete' | 'paused';

  recovery?: {
    reason:
      | 'existing_publisher_attempt'
      | 'publisher_unavailable'
      | 'publisher_unconfirmed'
      | 'sell_pending'
      | 'sell_failed'
      | 'funds_unverified'
      | 'settlement_shortfall'
      | 'customer_stopped';
    message: string;
    remainingTrades: TradeIntent[];
    safeToRetryPlacement: false;
  };

  settlementRiskAccepted?: boolean;
}

interface TradeResultRow {
  clientTradeId: string;         // SDK-generated per-row UUID; not in input
  brokerOrderId?: string;
  symbol: string;
  transactionType: 'BUY' | 'SELL';
  quantity: number;
  status: OrderStatus;
  variant: 'AMO' | 'REGULAR';
  filledQuantity?: number;
  averagePrice?: number;
  rejectionReason?: string;      // human-readable, already humanized
  rawError?: unknown;            // diagnostic only — do not display
  placedAt?: string;
  expectedFillAt?: string;       // for AMO
}

type OrderStatus =
  | 'PLACED'
  | 'FILLED'
  | 'PARTIAL'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PENDING'
  | 'AMO_QUEUED'
  | 'NOT_SUBMITTED';
```

For the React Native and Flutter mixed-Zerodha MP lane, `executeAdvice` persists
uniquely tagged intent before opening Kite, requires broker-confirmed full SELL
quantities, refreshes live funds and server-prices all BUY legs, then reconciles
the same tags. Only a verified numeric shortfall may offer an explicit
"Continue with buys" choice. Redirect completion and mere order detection are
not fill signals. If Publisher cannot open, both return paused `NOT_SUBMITTED`
rows and do not direct-place the mixed basket.

`OrderStatus` is normalized by the SDK route layer in
`aq_backend_github/Routes/sdk/v1/orders/_normalizeStatus.js`. Brokers
expose 30+ distinct status strings today; this enum is the canonical
set host apps see.

**Note on existing app utilities (Pass 2 alignment, 2026-05-03)**: the
existing `src/utils/orderStatusUtils.js` in Alphab2bapp uses a LOOSER
6-category lowercase set (`complete | pending | rejected | cancelled |
partial | unknown`). That utility is what the SDK orchestrator
REPLACES — when `executeAdvice` ships, the host app reads
`TradeResultRow.status` against this contract's UPPERCASE enum, and
`orderStatusUtils.js` retires. Until then, dual-write soak code paths
must accept BOTH enums and normalize before comparing.

---

## 3. `connectBroker` — fresh-connect entry point

### Input

```ts
function connectBroker(
  brokerName: string,
  opts?: ConnectOpts,
): Promise<BrokerConnection>;

interface ConnectOpts {
  /**
   * If true, skips the SDK's broker-selection prompt when the
   * brokerName is unknown to the SDK schema. Caller-managed.
   */
  strict?: boolean;
}

interface BrokerConnection {
  brokerName: string;
  status: 'connected';
  connectedAt: string;
  /** Server-resolved client identifier (broker user ID, NOT SDK userRef). */
  brokerClientId?: string;
  /** True when stored creds are sufficient for autojump on next reauth. */
  hasStoredCreds: boolean;
}
```

### Behavior

- SDK renders the credential form (or pre-OAuth fields) per the
  broker's schema — `BrokerCredentialForm` widget.
- Submits to `/sdk/v1/connections/<broker>/login-url` (OAuth) or
  `/sdk/v1/connections/<broker>/connect` (credentials).
- Handles WebView OAuth via `WebViewBrokerAuthFlow` when applicable.
- Backend runs ccxt-side credential validation (post-Phase D fix —
  see AUDIT § 5.tidi gap).
- Persists the connection on `connected_brokers[]`.
- Resolves with `BrokerConnection`.

### Errors

Rejects with `OrchestrationError` codes:
- `user_cancelled` — user closed the form / WebView before terminal.
- `invalid_credentials` — backend ccxt validation failed.
- `network_error` — terminal network failure.
- `broker_not_supported` — `brokerName` not in SDK schema registry.

---

## 4. `reauth` — re-authentication entry point

### Input

```ts
function reauth(
  brokerName: string,
  opts?: ReauthOpts,
): Promise<BrokerConnection>;

interface ReauthOpts {
  /** Force the user-facing flow even if silent-refresh would succeed. */
  forceInteractive?: boolean;
}
```

### Behavior

1. Marks broker status `expired` upfront (Flutter pattern).
2. Flips the broker to primary if it isn't already (Flutter pattern).
3. Tries silent-refresh first (Groww — backend mints fresh TOTP).
4. Tries smart-reauth via stored creds (ICICI Direct, Upstox, Motilal,
   HDFC, Fyers — backend builds OAuth URL from decrypted creds).
5. Falls through to full credential form / WebView (other brokers).
6. On success — resolves with updated `BrokerConnection`. The orchestrator
   marks status `connected` and clears `expired`.

### Errors

Same enum as `connectBroker` plus:
- `silent_refresh_failed` — Groww refresh expired upstream; user must re-enter creds.

---

## 5. `disconnectBroker`

### Input

```ts
function disconnectBroker(
  brokerName: string,
): Promise<DisconnectResult>;

interface DisconnectResult {
  brokerName: string;
  disconnectedAt: string;
}
```

### Behavior

POST `/api/user/disconnect-broker?broker=...&email=...`. SDK invalidates
its internal session cache for the broker. Host app refreshes its
broker list view from a hook callback (`onBrokerDisconnected`).

---

## 6. Internal sub-orchestrators (NOT public)

These are implementation details called by the four public methods.
Documented here so the AUDIT doc can reference them.

### `validateBrokerSession(brokerName) → SessionStatus`

```ts
type SessionStatus =
  | { state: 'valid' }
  | { state: 'refreshable'; refreshedAt: string }
  | { state: 'expired'; needsReauth: true }
  | { state: 'unrecoverable'; reason: string };
```

Calls `/ccxt/<broker>/validate-session` via the SDK route. If
`expired`, hands off to `reauth(brokerName)` internally before
returning to the calling orchestrator.

### `requireSellAuth(brokerName, trades) → SellAuthStatus`

```ts
type SellAuthStatus =
  | { state: 'authorized' }
  | { state: 'not_required' }     // no SELL legs in trades
  | { state: 'declined' }         // user said no on the prompt
  | { state: 'unrecoverable'; reason: string };
```

When SELL legs exist, runs the per-broker check from
`SELL_AUTH_ARCHITECTURE.md § 4 broker matrix`. If unauthorized, opens
the SDK `<SellAuthGate>` widget — modeled after Flutter's
`DdpiAuthPage` (unified per-broker prompts in one widget).

### `requireFunds(brokerName, trades) → FundsStatus`

```ts
type FundsStatus =
  | { state: 'sufficient'; available: number; required: number }
  | { state: 'insufficient'; available: number; required: number; shortfall: number }
  | { state: 'cannot_fetch'; reason: string };
```

Calls `/ccxt/<broker>/funds`. When `insufficient`, surfaces a themed
prompt giving the user a choice: proceed anyway (broker will reject
per-row) or cancel.

---

## 7. The provider — `AqSdkProvider` / `AqSdkScope`

### TypeScript (RN)

```tsx
<AqSdkProvider
  client={client}
  userRef={currentUser.email}
  theme={theme}
  hooks={{
    onBrokerDisconnected: (brokerName) => void,
    onSessionExpired: (brokerName) => void,
    onTradePlaced: (result) => void,
    onSellAuthDeclined: (brokerName, reason) => void,
    onError: (err) => void,
    onNavigateToSupport: () => void,           // host's support route
  }}
>
  <App />
</AqSdkProvider>
```

### Dart (Flutter)

```dart
AqSdkScope(
  client: client,
  userRef: currentUser.email,
  theme: theme,
  hooks: AqSdkHooks(
    onBrokerDisconnected: (brokerName) {},
    onSessionExpired: (brokerName) {},
    onTradePlaced: (result) {},
    onSellAuthDeclined: (brokerName, reason) {},
    onError: (err) {},
    onNavigateToSupport: () {},
  ),
  child: App(),
);
```

**Parity invariant**: same hook names, same signatures. Hooks are all
optional; defaults are no-ops.

---

## 8. Theme

The orchestrator-rendered widgets all read from `SdkTheme`. Shape:

```ts
interface SdkTheme {
  colors: {
    primary: string;
    primaryText: string;
    surface: string;
    surfaceText: string;
    border: string;
    success: string;
    successBg: string;
    danger: string;
    dangerBg: string;
    warning: string;
    warningBg: string;
    muted: string;
    overlayBg: string;             // modal scrim
  };
  typography: {
    heading: TextStyle;
    title: TextStyle;
    body: TextStyle;
    caption: TextStyle;
    button: TextStyle;
  };
  radii: { sm: number; md: number; lg: number; pill: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  // Per-flow overrides (optional):
  components?: {
    tradeReviewSheet?: { headerHeight?: number };
    sellAuthGate?: { iconSize?: number };
    resultModal?: { animation?: 'fade' | 'slide' };
  };
}
```

Tenants pass a `PartialSdkTheme` to the provider; SDK merges with
defaults. The provider re-resolves on `theme` prop change.

---

## 9. Errors — `OrchestrationError`

Every public method rejects (RN) / throws (Dart) with this typed
envelope on failure. Never a bare string error.

```ts
class OrchestrationError extends Error {
  code: OrchestrationErrorCode;
  recoveryAction?: RecoveryAction;
  brokerName?: string;
  raw?: unknown;
}

type OrchestrationErrorCode =
  | 'user_cancelled'
  | 'broker_disconnected'
  | 'broker_not_supported'
  | 'invalid_credentials'
  | 'session_unrecoverable'
  | 'silent_refresh_failed'
  | 'sell_auth_declined'
  | 'funds_insufficient'           // only when explicitly raised; default behaviour is per-row REJECTED
  | 'network_error'
  | 'rate_limited'
  | 'internal_error';

type RecoveryAction =
  | 'reconnect_broker'
  | 'reauth'
  | 'add_funds'
  | 'check_credentials'
  | 'support_escalation'
  | 'retry'
  | null;
```

Dart mirror: same enum names, same field shape.

### Host-app contract

The host catches `OrchestrationError` exactly once per orchestrator
call. The SDK never surfaces a half-state — every public method either:

- resolves with a typed result envelope (success, partial, all_rejected
  — but always complete and complete-shape), OR
- rejects with `OrchestrationError`.

If the SDK encounters an internal bug, it surfaces `internal_error` with
diagnostic `raw` and posts to the SDK's own Sentry; **never silently
returns a malformed result**.

---

## 10. Auth and scopes

### Mint server scopes

The SDK mints a session JWT at provider mount. Scopes required:

- `connections:read`
- `connections:write`
- `orders:read`
- `orders:write`
- `portfolios:read`
- `sell_auth:read`
- `sell_auth:write`           // NEW — required by `requireSellAuth` sub-orchestrator
- `funds:read`                // NEW — required by `requireFunds`

Existing host apps already request the first three (Phase 3) plus
`portfolios:read`. Phase D adds the rest. Mint server already
whitelists `orders:*` per Phase B-1; sell_auth + funds need to be
appended.

### JWT lifecycle

- TTL 15 minutes
- Auto-refresh on 401 — orchestrator catches, re-mints, retries once.
- `forceInteractive: true` on `reauth()` skips the silent-refresh check.

---

## 11. Idempotency

### `clientAdviceId`

Required on every `executeAdvice` call. Backend stores the result
keyed on this ID; a retry with the same ID returns the original result
rather than re-placing trades. Crucial during dual-write soak — if
the SDK lane partially succeeds and the legacy lane is the user-facing
result, a retry on the SDK lane MUST NOT double-place.

### `clientTradeId`

Per-row UUID generated by the SDK (not by the host). Backend echoes
it back in `TradeResultRow.clientTradeId`. Used for dual-write
divergence detection.

---

## 12. Cross-platform parity rules (enforced)

1. Every public method exists in BOTH packages with identical name +
   identical input/output shape (allowing for language idioms — RN
   `Promise<T>`, Dart `Future<T>`).
2. Every error code exists in BOTH packages.
3. Every theme key exists in BOTH packages.
4. Every host-hook name exists in BOTH packages.
5. A new contract change ships in BOTH packages in the same commit
   cycle. PR review checklist requires reviewer to confirm parity.
6. The CONTRACT doc (this file) is updated FIRST, then the packages
   change to match. Same-commit doc updates required.

Drift is the #1 risk of cross-platform SDK design. These rules exist
because Phase 3 had two regressions traceable to RN / Flutter contract
drift (Fyers form fields, Angel One scope-readiness).

---

## 13. Versioning

- SDK orchestrator API is `v1`.
- All orchestrator additions until Phase F lands ship as **minor**
  semver bumps in the SDK packages (1.X.Y).
- Phase F flag-flip = `2.0.0` major bump (signals legacy code-path
  removal).
- Internal type changes that don't affect the public contract are
  patch bumps (1.X.Y).
- Breaking contract changes after `2.0.0` require a `3.0.0` bump and
  a migration guide. Aim never to do this.

---

## 14. Deferred items (deliberately not in v1 contract)

- **Order modify** (price / quantity update on a pending order). Per-broker
  support varies. Add in v2 if user demand surfaces.
- **Multi-leg / cover orders.** Complex per-broker UX; out of MVP.
- **Smart order routing** (split between brokers). Out of scope.
- **Position management** (intraday squaring off). Stays app-side.

### Legacy rebalance funding-choice extension (2026-09-27)

Until the rebalance lane moves behind the SDK orchestrator, its calculate
request accepts exactly one of these calculation-scoped booleans:

- `continueWithAvailableFunds: true` — size to a positive verified funded
  budget and preserve the higher investment target.
- `attemptWithInsufficientFunds: true` — after a verified zero/insufficient
  warning, size the existing target for review and deliberately allow broker
  submission. The broker may reject some or all BUY orders.

The second choice is not a cash assertion. The response retains
`activeBudget: 0`, returns `funding.classification =
READY_WITH_FUNDING_RISK`, and records `fundingContinuation.choice =
attempt_broker`. It is executable only with non-empty server-generated frozen
legs. A client-supplied execution request cannot manufacture this state.
- **`manageConnections()` as a top-level method.** Per AUDIT § 7.tidi
  verdict, the list view is host-territory; SDK exposes per-broker
  actions instead.
