# SDK Subscription + Full-Rebalance Orchestration Design

## Trade review presentation contract (2026-09-29)

The review's trade list is the primary content and must retain usable height
for long sell/buy baskets. Optional funding disclosures follow the rows inside
the scrollable region, detailed low-funds copy starts collapsed, and the
required action stays reachable. The future SDK-owned sheet must preserve this
composition together with the frozen-plan and sell-before-buy contracts.

## Host Retry/Repair contract (2026-09-05)

The host must preserve SDK/server placement identity and route Retry only from
broker-authoritative repair classification. OPEN orders remain pending,
verified failed legs reuse the frozen Repair plan, and only an explicit
requiresFreshRebalance result may create a new calculation. A verified terminal
result updates the subscriber projection without submitting an empty real-broker
order. Calculation state is tagged by model ID/name so it cannot cross portfolio
boundaries.


## Rebalance completion bridge (2026-08-26)

Subscription execution is not repairable immediately after broker submission.

The host model-portfolio repair entry is a direct review action: after broker
session/funds preflight it opens the already-frozen repair order list. It does
not ask for calculator preference or re-confirm persisted holdings. Fresh
rebalance accept likewise uses the advisor-owned calculator mode rather than a
customer “2% vs full” override. These are host navigation changes; SDK advice
identity, frozen-plan fields, and placement ownership are unchanged.
The host observes the reconciliation window, retries after the supplied delay and
refreshes strategy status when the difference disappears. Only a material residual
after that pass is offered as Repair.

> **Status**: design draft (2026-05-03). Extends `SDK_ORCHESTRATION_CONTRACT.md`
> with subscription management and calculate-rebalance integration.
>
> **Context**: Phase C shipped `executeAdvice` which takes pre-calculated
> trades. This doc designs the next layer: SDK owns the full flow from
> "user taps Accept Rebalance" to completion, including the calculate
> step. Also covers third-party SDK consumers who need to create
> subscriptions programmatically.

---

## 1. The gap today

```
TODAY (app orchestrates):
  User taps "Accept Rebalance" on card
  → App calls POST /rebalance/calculate (with modelId, userEmail, investment)
  → App receives {buy: [...], sell: [...], uniqueId}
  → App calls sdk.executeAdvice({kind:'mpRebalance', trades, modelId, ...})
  → SDK handles placement + polling + result

VISION (SDK orchestrates):
  User taps "Accept Rebalance" on card
  → App calls sdk.executeRebalance({modelId, modelName})
  → SDK calls calculate internally
  → SDK shows review sheet with the calculated trades
  → SDK handles sell-auth → placement → polling → result
  → App gets terminal result
```

The gap is TWO things:
1. `calculate-rebalance` call is app-side
2. For third-party SDK consumers, the subscription must exist first

---

## 2. New SDK method: `executeRebalance`

```ts
// Convenience method that wraps calculate + executeAdvice
client.executeRebalance({
  modelId: string,
  modelName: string,
  investmentAmount?: number,  // for initial allocation; omitted for rebalance
}): Promise<AdviceResult>
```

Internally:
1. Call `/sdk/v1/portfolios/calculate-rebalance` (new backend route)
2. Receives `{buy, sell, uniqueId}`
3. Calls `executeAdvice({kind: 'mpRebalance', trades: [...buy, ...sell], modelId, modelName, uniqueId})`
4. Returns `AdviceResult`

The existing `executeAdvice({kind: 'mpRebalance', trades})` stays for
callers who want to pre-calculate (e.g. custom allocation logic).

### Mixed Zerodha execution safety

`executeRebalance` must pass the calculate response into the same guarded
`executeAdvice` lane; it must not create its own Publisher shortcut. The SDK
persists exact tagged intent before opening Kite, submits SELL baskets first,
waits for full requested sell quantities, refreshes Zerodha buying power, then
opens BUY baskets. A verified numeric shortfall may be explicitly continued so
settlement-dependent buys can be attempted and repaired later. Unknown funds,
pricing/auth failures, and partial sells pause with `safeToRetryPlacement:false`.
The original calculated leg identities and quantities remain the recovery
source; the host never recomputes or silently places a second basket.

`modifyInvestment` also forwards `changeMode` plus incremental `changeAmount` so
a top-up remains distinct from an absolute reset on both RN and Flutter clients.

---

## 3. New SDK method: `subscribe`

For third-party apps that handle payment themselves and need to register
the subscription in our system.

```ts
client.subscribe({
  modelId: string,
  modelName: string,
  planId?: string,          // specific pricing plan
  investmentAmount: number,
  duration?: string,        // "monthly" | "quarterly" | "yearly"
  paymentProof?: {          // optional — third-party's own payment ref
    transactionId: string,
    gateway: string,        // "razorpay" | "stripe" | "custom"
    amount: number,
    currency: string,
  },
}): Promise<SubscriptionResult>

interface SubscriptionResult {
  subscriptionId: string,
  userId: string,
  modelId: string,
  status: 'active',
  subscribedAt: string,
  expiresAt?: string,
}
```

### Backend route: `POST /sdk/v1/portfolios/subscribe`

1. **Resolve or create user** — if no user doc exists for `userEmail`
   (from SDK session), create one with minimal fields. Same for
   `connected_brokers[]` sub-doc if broker is connected via SDK.
2. **Create subscription record** in the model portfolio's
   `subscribedBy` array (or whatever collection the MP system uses).
3. **Record the SDK subscription event** — write to a new
   `sdk_subscriptions` collection:
   ```
   {
     tenant: req.tenant.advisor_subdomain,
     sdkSessionId: req.sdkSession.session_id,
     userEmail: resolved,
     modelId, modelName, planId,
     investmentAmount,
     paymentProof,
     subscribedAt: new Date(),
     source: "sdk"  // vs "app" for direct subscriptions
   }
   ```
4. **Return** `SubscriptionResult` with the generated `subscriptionId`.

### Tracking / billing

The `sdk_subscriptions` collection serves as the audit trail:
- Per-tenant: how many subscriptions were created via SDK
- Per-session: which mint session created which subscriptions
- Per-user: subscription history (for de-duplication, renewal)
- Source tagging: `source: "sdk"` vs `source: "app"` distinguishes
  SDK-originated subscriptions from direct app subscriptions

This collection is queryable by the advisor dashboard for reporting.

---

## 4. User record creation for SDK consumers

When a third-party app uses the SDK, their users may not exist in our
MongoDB. The SDK backend must handle this gracefully.

### Email as identifier

Both `user_email` and `email` are used across collections. The SDK
session carries `user_ref` (= email). The backend resolves:

```
user_ref → email lookup in users collection
  → if found: use existing user doc
  → if not found: create minimal user doc:
    {
      email: user_ref,
      created_at: new Date(),
      source: "sdk",
      advisor: tenant.advisor_subdomain,
      // No broker, no password, no Firebase UID
      // Broker connection comes later via sdk.connectBroker()
    }
```

### Collections that need records

| Collection | When needed | Created by |
|---|---|---|
| `users` | Always (identifier) | Auto-created on first SDK call if missing |
| `connected_brokers[]` (sub-doc on user) | Before trade execution | `sdk.connectBroker()` (Phase 3) |
| `subscriptions` / subscriber array | Before MP rebalance | `sdk.subscribe()` (new) |
| `traderecos` | On bespoke trade | Auto-created by ccxt /orders/process-trade |
| `rebalance_history` | On MP trade | Auto-created by ccxt /rebalance/process-trade |

### Edge case: empty subscription

If a third-party app calls `executeRebalance` without first calling
`subscribe`, the calculate-rebalance endpoint will fail because the
user has no subscription. The SDK should surface this as:

```ts
throw new OrchestrationError(
  "subscription_required",
  "User is not subscribed to this model portfolio. Call sdk.subscribe() first.",
  { recoveryAction: "subscribe" }
);
```

---

## 5. Full third-party integration flow

```
Third-party app:
  1. Mount <AqSdkProvider client={client} userRef={userEmail}>
  2. sdk.connectBroker("Zerodha")     → user connects broker
  3. sdk.subscribe({                  → creates subscription record
       modelId: "abc",
       modelName: "Alpha 100",
       investmentAmount: 50000,
       paymentProof: { transactionId: "pay_xxx", gateway: "razorpay", ... }
     })
  4. sdk.executeRebalance({           → full flow: calculate → review → place
       modelId: "abc",
       modelName: "Alpha 100",
     })
  5. Receive AdviceResult → show in their own UI
```

Steps 2-4 each return typed results. The third-party app needs NO
knowledge of trade mechanics, EDIS gates, broker payload assembly,
or post-placement chains. They pay, subscribe, and execute.

---

## 6. Sequencing

| Step | What | Estimate |
|---|---|---|
| 6a | Backend: `POST /sdk/v1/portfolios/subscribe` + user auto-creation | 2-3 days |
| 6b | Backend: `POST /sdk/v1/portfolios/calculate-rebalance` (proxy) | 1 day |
| 6c | SDK: `client.subscribe()` + `client.executeRebalance()` methods | 1-2 days |
| 6d | SDK: `executeRebalance` wires calculate → executeAdvice internally | 1 day |
| 6e | App: `RebalanceCard` "Accept" tap → `sdk.executeRebalance()` | 1 day |
| 6f | Tracking: `sdk_subscriptions` collection + advisor dashboard query | 2 days |

---

## 7. Open questions

1. **Subscription renewal** — does `subscribe()` handle renewals
   (same modelId, new payment) or is that a separate `renew()` method?
2. **Plan pricing** — does the SDK need to expose plan details
   (pricing tiers, durations) or is that app-side UI only?
3. **Unsubscribe** — does the SDK expose `unsubscribe(subscriptionId)`?
4. **Multiple models** — can a user subscribe to multiple models
   simultaneously? If yes, `executeRebalance` needs to handle
   portfolio-level rebalance vs model-level.
5. **Investment amount source** — **RESOLVED 2026-05-03**. For subsequent
   rebalances, the ccxt-india `Rebalancing` class uses the stored
   `subscription_amount` from the user's model portfolio DB record
   (set during subscribe / initial allocation), plus incremental PnL.
   The `userFund` field passed from the app is the broker's available
   cash (for a funds-sufficiency check), NOT the invested capital.
   The SDK's `executeRebalance` passes `userFund: "0"` and the backend
   resolves the actual subscription amount from DB. This was initially
   documented incorrectly as "derived from broker funds" — corrected
   per user feedback.

## 2026-08-18 reviewed-attempt identity invariant

`executeRebalance` must submit the `plan_id`, `plan_version`, and `unique_id`
belonging to the same calculation the customer reviewed. An outstanding repair
row does not override a fresh calculate response. Repair identity is valid only
when the review was built from repair data and therefore has no fresh
calculation `uniqueId`.
