# AlphaQuark Mobile SDK — Developer Integration Guide

## Reading order results (2026-09-28)

Render `row.status` from the SDK vocabulary and use `brokerOrderStatus` only
for diagnostics. Do not interpret `COMPLETE` yourself: the SDK combines the
broker word with fill/pending quantities. Hosts should keep `PENDING` rows
pollable and route rejected/unfilled remainders through Repair, never resubmit
the full original basket.

## Durable order results (2026-08-28)

Render `status: queued` using its `jobId`, then call `getAsyncOrderStatus(jobId)` or `cancelAsyncOrder(jobId)`. A paused `checking_broker` result means “do not resubmit.” Never switch placement paths; HTTP 409 active/duplicate identities are also non-retryable.

The generic SDK contract is broker-agnostic, but registration, an explicit
quota policy, live/UAT certification and customer-app release are separate
states. The current configured direct-API set is Angel One, Upstox, Zerodha
API, Dhan, Kotak, Fyers, ICICI Direct, HDFC Securities, Motilal Oswal, Groww,
AliceBlue, Axis Securities, IIFL Securities, Arihant Capital and DefinEdge
Securities. Zerodha Publisher, DummyBroker/manual, GTT and model portfolios use
specialized paths. New broker registry entries must stay dispatch-allowlisted
until the backend enforces the YAML `certified` flag. RN/Flutter source changes
are not customer-live until the consuming app ships a signed OTA/store release.

> **Audience**: Third-party developers integrating the AlphaQuark SDK
> into their React Native or Flutter app. This is the single document
> you need to go from zero to a working integration.
>
> **SDK Packages**: `@alphaquark/mobile-sdk` (npm, React Native) and
> `aq_mobile_sdk` (pub, Flutter).
>
> **Version**: Phase C+D (2026-05-03). Types + orchestrator + sell-auth
> gate + component passthrough shipped.

---

## 1. Quick Start (React Native)

```tsx
import React from 'react';
import {
  AqSdkClient,
  AqSdkProvider,
  ExecuteAdviceOverlay,
} from '@alphaquark/mobile-sdk';

// 1. Create client — once per app lifetime
const client = new AqSdkClient({
  baseUrl: 'https://server.alphaquark.in',
  mintSession: async (userRef) => {
    // YOUR backend mints the session token:
    //   POST https://your-backend.com/sdk/mint
    //   Body: { user_ref: userRef, scopes: [...] }
    //   Your backend calls AlphaQuark's /sdk/session/create
    //   with your tenant secret (sk_live_...) server-side.
    const res = await fetch('https://your-backend.com/sdk/mint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': 'your-tenant-id',
      },
      body: JSON.stringify({
        user_ref: userRef,
        scopes: [
          'connections:read', 'connections:write',
          'portfolios:read',
          'orders:read', 'orders:write',
          'gtt:read', 'gtt:write',
          'sell_auth:read', 'sell_auth:write',
          'funds:read',
        ],
      }),
    });
    const data = await res.json();
    return {
      token: data.token,
      expires_at: data.expires_at,
      user_ref: data.user_ref || userRef,
      scopes: data.scopes,
    };
  },
});

// 2. Mount provider in your app tree
function App() {
  const userEmail = useCurrentUserEmail(); // your auth system

  return (
    <AqSdkProvider
      client={client}
      userRef={userEmail}
      theme={{
        colors: {
          primary: '#0056B7',
          primaryText: '#FFFFFF',
          surface: '#FFFFFF',
          surfaceText: '#1F2937',
          // ... see § 6 for full theme spec
        },
      }}
      components={{
        // Optional: replace any SDK widget with your own
        // tradeReviewSheet: YourCustomReviewSheet,
        // tradeResultModal: YourCustomResultModal,
      }}
    >
      <YourApp />
      <ExecuteAdviceOverlay />
    </AqSdkProvider>
  );
}
```

## 2. Quick Start (Flutter)

```dart
import 'package:aq_mobile_sdk/aq_mobile_sdk.dart';

final client = AqSdkClient(
  baseUrl: 'https://server.alphaquark.in',
  mintSession: (userRef) async {
    // Same mint pattern as RN — YOUR backend mints the token
    final res = await http.post(
      Uri.parse('https://your-backend.com/sdk/mint'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'user_ref': userRef, 'scopes': [...]}),
    );
    final data = jsonDecode(res.body);
    return SessionToken.fromJson(data);
  },
);

// Mount in widget tree
AqSdkScope(
  client: client,
  userRef: currentUserEmail,
  theme: PartialSdkTheme(colors: PartialSdkThemeColors(primary: Color(0xFF0056B7))),
  componentOverrides: AqSdkComponentOverrides(
    // tradeReviewSheet: (ctx, props) => YourReviewSheet(props),
  ),
  child: YourApp(),
)
```

---

## 3. Complete Public API Reference

### Client Methods — Broker Management

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| `connectBroker(name)` | POST `/sdk/v1/connections/:broker/login-url` + `/exchange-token` | `connections:write` | Fresh broker OAuth/credential connect |
| `reauth(name)` | POST `/sdk/v1/connections/:broker/reauth-url` | `connections:write` | Re-authenticate expired session |
| `disconnectBroker(name)` | DELETE `/sdk/v1/connections/:broker` | `connections:write` | Remove broker connection |
| `setBrokerPrimary(name)` | PUT `/sdk/v1/connections/:broker/primary` | `connections:write` | Set as primary broker |
| `getSellAuth(broker)` | GET `/sdk/v1/connections/:broker/sell-auth` | `sell_auth:read` | Check DDPI/EDIS status |
| `verifySellAuth(broker)` | POST `/sdk/v1/connections/:broker/verify-sell-auth` | `sell_auth:write` | Live broker-side EDIS check |
| `attestSellAuth(broker)` | POST `/sdk/v1/connections/:broker/attest-sell-auth` | `sell_auth:write` | Manual sell-auth confirmation |

### Client Methods — Trade Execution

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| `executeAdvice(advice, opts?)` | (orchestrator) | `orders:write` | **Primary entry point.** Place trades with full orchestration (sell-auth → review → place → poll → result). |
| `executeRebalance(params)` | (orchestrator) | `orders:write` | Convenience: calls `calculateRebalance` then `executeAdvice({kind:'mpRebalance'})` internally. |
| `placeOrders(body)` | POST `/sdk/v1/orders/place` | `orders:write` | Direct bespoke order placement (low-level). |
| `placeRebalanceOrders(body)` | POST `/sdk/v1/orders/place-rebalance` | `orders:write` | Direct MP order placement + post-chain (low-level). |
| `getOrderStatus(orderId)` | POST `/sdk/v1/orders/:id/status` | `orders:read` | Single order status check. |
| `getOrderBook(query?)` | GET `/sdk/v1/orders/book` | `orders:read` | Order history with filters. |
| `cancelOrder(orderId)` | POST `/sdk/v1/orders/:id/cancel` | `orders:write` | Cancel pending order. |
| `openPublisherIntent(body)` | POST `/sdk/v1/orders/publisher/intent` | `orders:write` | Internal/advanced: persist exact tagged Zerodha legs before Kite opens. |
| `getPublisherStatus(body)` | POST `/sdk/v1/orders/publisher/status` | `orders:read` | Internal/advanced: fetch only exact-tag broker orders. |
| `getPublisherFunding(body)` | POST `/sdk/v1/orders/publisher/funding` | `orders:read` | Internal/advanced: refresh live cash and server-price all protected BUYs. |
| `finalizePublisher(body)` | POST `/sdk/v1/orders/publisher/finalize` | `orders:write` | Internal/advanced: one exact-tag, idempotent reconciliation. Prefer `executeAdvice`. |

### Client Methods — Portfolio Management

| Method | Endpoint | Scope | Description |
|---|---|---|---|
| `subscribe(body)` | POST `/sdk/v1/portfolios/subscribe` | `connections:write` | Create/renew model portfolio subscription. Auto-creates user if missing. |
| `modifyInvestment(body)` | POST `/sdk/v1/rebalance/modify-investment` | `connections:write` | Update subscription capital amount; preserves optional `changeMode` and incremental `changeAmount`. |
| `calculateRebalance(body)` | POST `/sdk/v1/rebalance/calculate` | `connections:write` | Calculate rebalance trades for a model. |
| `getPortfolioPnl(modelName)` | GET `/sdk/v1/portfolios/:modelName/pnl` | `connections:read` | Get P&L: invested, current value, costs, net P&L. |
| `getSubscriptions()` | GET `/sdk/v1/portfolios/subscriptions` | `connections:read` | List user's subscribed model portfolios. |
| `getPortfolioDetail(id)` | GET `/sdk/v1/portfolios/:id` | `connections:read` | Strategy detail (holdings, allocation). |

---

## 4. AdviceInput — What to Pass to `executeAdvice`

```ts
// Bespoke single trade
sdk.executeAdvice({
  kind: 'bespokeSingle',
  clientAdviceId: 'unique-uuid',    // your idempotency key
  brokerName: 'Zerodha',            // optional; defaults to primary
  trade: {
    symbol: 'RELIANCE',
    exchange: 'NSE',
    transactionType: 'BUY',
    quantity: 10,
    orderType: 'MARKET',
    productType: 'CNC',
  },
  adviceId: 'your-advice-id',
});

// Bespoke cart (multiple trades)
sdk.executeAdvice({
  kind: 'bespokeCart',
  clientAdviceId: 'unique-uuid',
  trades: [
    { symbol: 'RELIANCE', exchange: 'NSE', transactionType: 'BUY', quantity: 10, orderType: 'MARKET', productType: 'CNC' },
    { symbol: 'INFY', exchange: 'NSE', transactionType: 'SELL', quantity: 5, orderType: 'MARKET', productType: 'CNC' },
  ],
});

// MP rebalance (pre-calculated trades)
sdk.executeAdvice({
  kind: 'mpRebalance',
  clientAdviceId: 'unique-uuid',
  modelId: 'abc123',
  modelName: 'Alpha 100',
  uniqueId: 'rebalance-instance-id',
  trades: [...],  // from calculateRebalance response
});

// MP initial allocation (post-payment)
sdk.executeAdvice({
  kind: 'mpInitialAllocation',
  clientAdviceId: 'unique-uuid',
  modelId: 'abc123',
  modelName: 'Alpha 100',
  uniqueId: 'allocation-id',
  trades: [...],
  subscriptionId: 'sub-id-from-subscribe',
});
```

---

## 5. AdviceResult — What You Get Back

```ts
{
  clientAdviceId: 'unique-uuid',
  status: 'success' | 'partial' | 'all_rejected',
  rows: [
    {
      clientTradeId: 'sdk-generated-uuid',
      brokerOrderId: '220503000123456',
      symbol: 'RELIANCE',
      transactionType: 'BUY',
      quantity: 10,
      status: 'FILLED',       // PLACED | FILLED | PARTIAL | REJECTED | CANCELLED | PENDING | AMO_QUEUED | NOT_SUBMITTED
      variant: 'REGULAR',     // REGULAR | AMO
      filledQuantity: 10,
      averagePrice: 2450.50,
      rejectionReason: null,
    },
  ],
  brokerOrderIds: ['220503000123456'],
  capitalDeployed: 24505.00,
  hasAmoRows: false,
  completedAt: '2026-05-03T10:30:00.000Z',
  executionState: 'complete' | 'paused',
  recovery: undefined | {
    reason: 'sell_pending' | 'sell_failed' | 'funds_unverified' | 'settlement_shortfall' | 'publisher_unconfirmed' | 'publisher_unavailable' | 'existing_publisher_attempt' | 'customer_stopped',
    message: 'Human-readable next step',
    remainingTrades: [...],
    safeToRetryPlacement: false,
  },
  settlementRiskAccepted: false,
}
```

`paused` is a successful SDK handoff, not an invitation to retry placement.
The host must display the rows/recovery message and must not invoke its legacy
route. `NOT_SUBMITTED` means the safety gate deliberately withheld that leg;
`PENDING` means a submitted exact tag is not yet fully reconciled.

For mixed Zerodha MP baskets, RN runs SELL → full broker fill → fresh live funds
→ BUY. If fresh funds show a numeric shortfall, the customer may explicitly
continue (T+1/settlement risk); later low-funds rejections say to use Repair once
margin releases. Auth, pricing, or unreadable-funds failures never expose that
Continue action.

---

## 6. Theme Specification

```ts
interface SdkTheme {
  colors: {
    primary: string;         // brand color — buttons, headers
    primaryText: string;     // text on primary bg
    surface: string;         // modal/card background
    surfaceText: string;     // body text
    border: string;          // input borders, dividers
    success: string;         // BUY, profit indicators
    successBg: string;       // success background
    danger: string;          // SELL, loss indicators
    dangerBg: string;        // danger background
    warning: string;         // AMO, pending indicators
    warningBg: string;
    muted: string;           // secondary text
    overlayBg: string;       // modal scrim
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
}
```

---

## 7. Error Handling

Every SDK method throws typed `OrchestrationError` on failure:

```ts
try {
  const result = await sdk.executeAdvice(advice);
} catch (err) {
  if (err.code === 'user_cancelled') {
    // User dismissed the review sheet — do nothing
  } else if (err.code === 'session_unrecoverable') {
    // Broker session expired, refresh failed — show reconnect UI
    // err.recoveryAction === 'reauth'
  } else if (err.code === 'sell_auth_declined') {
    // User declined EDIS/DDPI authorization
  } else if (err.code === 'network_error') {
    // Network failure — err.recoveryAction === 'retry'
  }
}
```

| Error Code | Meaning | Recovery Action |
|---|---|---|
| `user_cancelled` | User dismissed a modal | None |
| `broker_disconnected` | No connected broker | `reconnect_broker` |
| `broker_not_supported` | Unknown broker name | None |
| `invalid_credentials` | Broker rejected credentials | `check_credentials` |
| `session_unrecoverable` | Token expired, refresh failed | `reauth` |
| `silent_refresh_failed` | Groww silent-refresh expired | `reauth` |
| `sell_auth_declined` | User declined EDIS/DDPI prompt | None |
| `funds_insufficient` | Not enough broker funds | `add_funds` |
| `network_error` | Terminal network failure | `retry` |
| `rate_limited` | Too many requests | `retry` |
| `internal_error` | SDK bug | `support_escalation` |

---

## 8. Component Passthrough — Custom UI

Replace any SDK-rendered widget with your own component:

```tsx
<AqSdkProvider
  components={{
    tradeReviewSheet: MyReviewSheet,
    tradeResultModal: MyResultModal,
    sellAuthGate: MySellAuth,
    tradeExecutionProgress: MyProgress,
  }}
>
```

### Props your component receives

**tradeReviewSheet:**
```ts
{
  trades: Array<{ symbol, exchange, transactionType, quantity, orderType, price?, productType }>,
  brokerName?: string,
  totalEstimate?: number,
  isPlacing: boolean,
  onConfirm: () => void,   // MUST call to proceed
  onCancel: () => void,    // MUST call to abort
}
```

**tradeResultModal:**
```ts
{
  results: TradeResultRow[],  // same shape as AdviceResult.rows
  onClose: () => void,        // MUST call to dismiss
}
```

**sellAuthGate:**
```ts
{
  brokerName: string,
  userDetails: Record<string, unknown>,
  onAuthorized: () => void,   // MUST call to proceed
  onDeclined: () => void,     // MUST call to abort
  onDdpiHelpRequested?: (broker: string) => void,
}
```

---

## 9. Full Integration Flow (Third-Party App)

```ts
// Step 1: Connect broker
await sdk.connectBroker('Zerodha');

// Step 2: Subscribe to a model portfolio
const sub = await sdk.subscribe({
  modelId: 'abc123',
  modelName: 'Alpha 100',
  investmentAmount: 50000,
  duration: 'monthly',
  paymentProof: {
    transactionId: 'pay_xxx',
    gateway: 'razorpay',
    amount: 50000,
    currency: 'INR',
  },
});

// Step 3: Execute rebalance (SDK handles everything)
const result = await sdk.executeRebalance({
  modelId: 'abc123',
  modelName: 'Alpha 100',
  includePnl: true,  // include portfolio P&L in allocation
});

// Step 4: Modify investment amount later
await sdk.modifyInvestment({
  modelName: 'Alpha 100',
  model_id: 'abc123',
  amount: 75000,
});

// Step 5: Check P&L
const pnl = await sdk.getPortfolioPnl('Alpha 100');
console.log(`Invested: ₹${pnl.investedAmount}, Current: ₹${pnl.currentValue}, Net P&L: ₹${pnl.netPnl}`);
```

---

## 10. Mint Server Setup

Your backend needs a mint endpoint that signs SDK session tokens:

```
POST /sdk/mint
Body: { user_ref: "user@example.com", scopes: [...] }
Response: { token: "eyJ...", expires_at: "2026-05-03T11:00:00Z", user_ref: "user@example.com", scopes: [...] }
```

Your backend calls AlphaQuark's session-create endpoint with your tenant secret:

```
POST https://server.alphaquark.in/sdk/session/create
Headers:
  Authorization: Bearer sk_live_YOUR_TENANT_SECRET
  X-Advisor-Subdomain: your-tenant-id
Body: { user_ref: "user@example.com", scopes: [...] }
```

**Tenant provisioning** (one-time per tenant):
1. Generate tenant API keys: `node aq_backend_github/scripts/create_tenant_api_keys.js --tenant=your-tenant-id`
2. Add to mint server `.env`: `AQ_SDK_TENANT_SECRET_YOURTENANT=sk_live_...`
3. Restart mint server: `sudo systemctl restart aq-sdk-mint.service`

### Runtime tenant switching

Treat `(tenant id, user_ref)` as the SDK session identity. A host that can
change advisor tenant at runtime must discard its existing `AqSdkClient` and
remount/rebind `AqSdkProvider` when the tenant changes, even when `user_ref`
stays the same. Otherwise the provider's same-user optimization can retain a
JWT minted for the previous tenant and route connection writes to the wrong
database. Bind the mint callback to the resolved tenant value rather than
reading mutable global configuration after the mint begins.

AlphaB2B implements this in `src/sdk/SdkProviderRoot.js`: it subscribes to the
runtime-advisor authority, creates a tenant-bound client, and keys the provider
by `REACT_APP_HEADER_NAME`. Single-tenant hosts do not need extra handling.

---

## 11. Required Scopes

| Scope | What it gates |
|---|---|
| `connections:read` | List connected brokers, check sell-auth status |
| `connections:write` | Connect/disconnect/reauth brokers, attest sell-auth |
| `portfolios:read` | List portfolios, get P&L |
| `orders:read` | Order book, order status |
| `orders:write` | Place orders, cancel orders, execute advice |
| `gtt:read` | GTT order status |
| `gtt:write` | Place GTT orders |
| `sell_auth:read` | Check DDPI/EDIS status |
| `sell_auth:write` | Verify/attest sell authorization |
| `funds:read` | Check broker available funds |

---

## 12. Feature Flags

| Flag | Platform | Default | Purpose |
|---|---|---|---|
| `REACT_APP_SDK_INTEGRATION` | RN | `true` | Mount `<AqSdkProvider>` in the app tree |
| `REACT_APP_USE_SDK_BROKER_FLOW` | RN | `true` | Route broker connect through SDK widgets |
| `REACT_APP_USE_SDK_EXECUTE_ADVICE` | RN | `false` | Route trade execution through SDK orchestrator |
| `USE_SDK_EXECUTE_ADVICE` | Flutter | `false` | Same for Flutter |

Set in `.env` (RN) or `.env.test`/`.env.prod` (Flutter). Per-tenant rollout via remote config.

---

## 13. Supported Brokers

| Broker | Connect | DDPI Check | In-App EDIS | Notes |
|---|---|---|---|---|
| Zerodha | ✅ OAuth | ✅ `ddpi_status` | ✅ `auth-sell` WebView | Kite Publisher basket for MP |
| Angel One | ✅ OAuth/creds | ✅ `ddpi_enabled` | ✅ `verify-dis` CDSL form | Shared-mode SmartAPI |
| Dhan | ✅ Creds | ✅ `ddpi` from profile | ✅ `generate-tpin` WebView | Per-holding EDIS |
| Upstox | ✅ OAuth | ✅ `ddpi`+`poa` from profile | ❌ (portal only) | DDPI required for API sells |
| Fyers | ✅ OAuth/creds | ❌ | ✅ `tpin` + `submit-holdings` | Online DDPI free |
| ICICI Direct | ✅ OAuth | ❌ | ❌ | Online DDPI now available |
| HDFC Securities | ✅ OAuth | ❌ | ❌ | Online DDPI for most accounts |
| Kotak | ✅ Neo API | ❌ | ❌ | Neo TOTP auth |
| AliceBlue | ✅ Creds | ❌ | ❌ | BOT platform DDPI |
| IIFL Securities | ✅ Creds | ❌ | ❌ | XTS/Blaze API |
| Motilal Oswal | ✅ Creds | ❌ | ❌ | |
| Axis Securities | ✅ OAuth | ❌ | ❌ | RAPID API |
| Groww | ✅ Creds | ❌ | ❌ | Silent-refresh supported |

---

## 14. Trading Cost Model

The SDK includes a built-in cost calculator (`tradingCosts.ts`) for
Indian equity delivery (CNC) trades:

| Component | Rate |
|---|---|
| Brokerage | ₹20 per executed order (flat) |
| STT (sell) | 0.1% of turnover |
| STT (buy) | 0.025% of turnover |
| Transaction charges (NSE) | 0.00297% |
| Transaction charges (BSE) | 0.00375% |
| GST | 18% on (brokerage + transaction charges) |
| SEBI turnover fee | 0.0001% |
| Stamp duty (buy) | 0.015% |

Used by `getPortfolioPnl()` to compute net P&L and by
`ModifyInvestmentSheet` to show cost-adjusted returns.

---

## 15. Flutter / Dart API Reference

All client methods exist on the Dart `AqSdkClient` with identical names
and semantics. Key Dart types:

```dart
// AdviceInput — sealed class hierarchy
sealed class AdviceInput {
  final String clientAdviceId;
  final String? brokerName;
}

class BespokeSingleAdvice extends AdviceInput { ... }
class BespokeCartAdvice extends AdviceInput { ... }
class MpRebalanceAdvice extends AdviceInput { ... }
class MpInitialAllocationAdvice extends AdviceInput { ... }

// TradeIntent
class TradeIntent {
  final String symbol, exchange, transactionType, orderType, productType;
  final int quantity;
  final double? price, triggerPrice;
  final String? variant;
  Map<String, dynamic> toJson() => { ... };
}

// AdviceResult — returned as Map<String, dynamic>
// Fields: clientAdviceId, status, rows[], brokerOrderIds[],
//         hasAmoRows, completedAt

// OrchestrationError
class OrchestrationError implements Exception {
  final String code;     // same 11 codes as TypeScript
  final String message;
  final String? recoveryAction, brokerName;
}
```

### Flutter client methods

```dart
final client = AqSdkClient(baseUrl: '...', mintSession: (ref) async => ...);

// Broker management
await client.connectBroker('Zerodha');
await client.disconnectBroker('Zerodha');

// Trade execution
final result = await client.executeAdvice({
  'kind': 'bespokeSingle',
  'clientAdviceId': 'uuid',
  'trade': {'symbol': 'RELIANCE', 'exchange': 'NSE', ...},
  'adviceId': 'advice123',
});

// Rebalance (SDK handles calculate → place → poll)
final result = await client.executeRebalance(
  modelId: 'abc123',
  modelName: 'Alpha 100',
);

// Portfolio
await client.subscribe(modelId: 'abc', modelName: 'Alpha 100', investmentAmount: 50000);
await client.modifyInvestment(modelName: 'Alpha 100', modelId: 'abc', amount: 75000);
await client.modifyInvestment(
  modelName: 'Alpha 100',
  modelId: 'abc',
  amount: 75000,
  changeMode: 'topup',
  changeAmount: 25000,
);
final pnl = await client.getPortfolioPnl('Alpha 100');
```

### Flutter component overrides

```dart
AqSdkScope(
  client: client,
  userRef: email,
  componentOverrides: AqSdkComponentOverrides(
    tradeReviewSheet: (context, props) {
      final trades = props['trades'] as List;
      final onConfirm = props['onConfirm'] as VoidCallback;
      final onCancel = props['onCancel'] as VoidCallback;
      return YourReviewWidget(trades: trades, onConfirm: onConfirm, onCancel: onCancel);
    },
    tradeResultModal: (context, props) {
      final results = props['results'] as List;
      final onClose = props['onClose'] as VoidCallback;
      return YourResultWidget(results: results, onClose: onClose);
    },
  ),
  child: YourApp(),
)
```

Lookup overrides in your widgets: `SdkComponentOverridesInherited.of(context)`

---

## 16. Known RN ↔ Flutter Divergences

| Area | RN | Flutter | Status |
|---|---|---|---|
| Bespoke trade flow | ✅ Full support | ❌ Not implemented | Flutter app has no bespoke path |
| Email resolution | Sync from Firebase | Async polling (secure storage + Firebase) | Flutter ahead — cleaner race handling |
| Sell-auth UI | 6 modals in `DdpiModal.js` | Unified `DdpiAuthPage.dart` | Flutter ahead — SDK adopts Flutter's pattern |
| Fyers Publisher WebView | REST fallback | Disabled (loadHtmlString origin issue) | Both use REST |
| Zerodha mixed MP Publisher | ✅ Guarded 60-leg batches, sells-first/full-fill/funds gate | ✅ Same guarded offsite Publisher flow | Parity; missing UI/key fails closed with no direct fallback |
| Mark-expired-before-reauth | ✅ via `reauthHelpers.js` | ✅ via `ReauthHelper.dart` | Parity reached 2026-04-29 |
| `BrokerSessionService.isSessionFresh` | Not implemented | ✅ Proactive daily check | Flutter ahead |
| JWT clientCode extraction (Angel One) | Not implemented | ✅ Fallback for missing clientCode | Flutter ahead |
