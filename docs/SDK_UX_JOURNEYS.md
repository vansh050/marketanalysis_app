# SDK UX Journeys — Where the SDK Enters and Returns

> **Audience**: Product managers, developers, and designers understanding
> exactly which parts of the user experience are SDK-owned vs app-owned.
>
> **Principle**: The app owns surfaces that SHOW information and COLLECT
> intent. The SDK owns the EXECUTION between "user intends to act" and
> "action is complete."

---

## Journey 1: Connect a Broker

```
APP → user taps broker tile
SDK ENTERS → sdk.connectBroker("Zerodha")
  SDK: resolves schema (credentials / OAuth / TOTP)
  SDK: renders BrokerCredentialForm OR WebViewBrokerAuthFlow
  SDK: user enters creds / completes OAuth
  SDK: POST /sdk/v1/connections/:broker/login-url → exchange-token
  SDK: persists connection in connected_brokers[]
SDK RETURNS → { status: 'connected', brokerClientId }
APP → refreshes broker list, shows "Connected"
```

**Customizable**: brokerCredentialForm, brokerWebViewHeader, brokerSelectionList (via `designs/sdk/`)

---

## Journey 2: Accept a Rebalance (the full MP flow)

```
APP → user taps "Accept Rebalance" on card
SDK ENTERS → sdk.executeRebalance({ modelId, modelName })
  SDK STEP -2: resolve broker
    → GET /sdk/v1/user/status → find connected brokers
    → If no broker specified: use primary or first connected
    → If NO broker connected: show broker selection + connect (internal)
  SDK STEP -1: validate broker session
    → If expired: attempt reauth internally (smart-reauth / silent-refresh)
    → If reauth succeeds: continue seamlessly
    → If reauth fails: throw OrchestrationError(session_unrecoverable)
  SDK STEP 2: calculate rebalance (POST /sdk/v1/rebalance/calculate)
    → resolves broker creds from DB
    → fetches user holdings from broker
    → computes buy/sell trades for target allocation
    → PnL-adjusted if includePnl=true
  SDK STEP 3: show TradeReviewSheet
    → user sees trade list, confirms or cancels
  SDK STEP 4: sell-auth gate (if SELL trades)
    → checks DDPI (Zerodha/Angel One/Dhan/Upstox: server-cached flag)
    → DDPI active → proceeds silently
    → DDPI not active → shows SellAuthGate widget
  SDK STEP 5: place orders
    → Zerodha: KitePublisherWebView (basket form)
    → Others: POST /sdk/v1/orders/place-rebalance
      → backend runs post-chain (DB update + status queue)
  SDK STEP 6: poll for terminal status (5s intervals, 3min timeout)
  SDK STEP 7: show TradeResultModal (per-row status)
SDK RETURNS → AdviceResult { status, rows[], capitalDeployed }
APP → refreshes holdings via onTradePlaced hook
```

**Customizable**: tradeReviewSheet, tradeExecutionProgress, tradeResultModal, sellAuthGate (via `designs/sdk/`)

---

## Journey 3: Bespoke Single Trade

```
APP → user taps "Trade Now" on stock advice card
SDK ENTERS → sdk.executeAdvice({ kind: 'bespokeSingle', trade, adviceId })
  SDK: steps 1, 3, 4, 5 (direct API), 6, 7 same as Journey 2
SDK RETURNS → AdviceResult
APP → shows success, refreshes advice list
```

---

## Journey 4: Bespoke Cart

```
APP → user adds stocks to cart, taps "Place All"
SDK ENTERS → sdk.executeAdvice({ kind: 'bespokeCart', trades[] })
  SDK: same flow, multiple trades
SDK RETURNS → AdviceResult with multiple rows
APP → clears cart, refreshes
```

---

## Journey 5: Subscribe to Model Portfolio

```
APP → user browses models, selects plan, completes payment (app-owned)
SDK ENTERS → sdk.subscribe({ modelId, modelName, investmentAmount, paymentProof })
  SDK: POST /sdk/v1/portfolios/subscribe
    → auto-creates user if missing
    → creates Subscription doc
    → adds to model_portfolio.subscribed_by[]
    → tracks in sdk_subscriptions collection
SDK RETURNS → { subscriptionId, status: 'active', expiresAt }
APP → shows "Subscribed!" card
```

---

## Journey 6: Re-authenticate Expired Broker

```
APP → broker token expires OR user taps "Reconnect"
SDK ENTERS → sdk.reauth("Angel One")
  SDK: marks broker 'expired' upfront
  SDK: tries silent-refresh (Groww: backend TOTP mint)
  SDK: tries smart-reauth (ICICI/Upstox/Motilal/HDFC/Fyers: stored creds)
  SDK: falls through to credential form / WebView
SDK RETURNS → { status: 'connected' }
APP → refreshes broker list
```

---

## Journey 7: Modify Investment

```
APP → user taps "Modify Investment" on portfolio
SDK ENTERS → renders ModifyInvestmentSheet
  SDK: fetches P&L (GET /sdk/v1/portfolios/:model/pnl)
  SDK: shows current investment, portfolio value, net P&L
  SDK: "Include P&L?" toggle
  SDK: user enters amount, confirms
  SDK: POST /sdk/v1/rebalance/modify-investment
SDK RETURNS → success
APP → refreshes portfolio card
```

**Customizable**: modifyInvestmentSheet (via `designs/sdk/`)

---

## Journey 8: Check Portfolio P&L

```
APP → portfolio screen or modify-investment flow
SDK ENTERS → sdk.getPortfolioPnl("Alpha 100")
  SDK: GET /sdk/v1/portfolios/Alpha%20100/pnl
  SDK: reads user_net_pf_model, computes value from holdings × LTP
  SDK: deducts estimated costs (brokerage + STT + GST)
SDK RETURNS → { investedAmount, currentValue, grossPnl, estimatedCosts, netPnl }
APP → displays P&L card
```

---

## What the SDK Does NOT Touch

| Surface | Owner | Why |
|---|---|---|
| Advice list display | App | Tenant-specific UI layout |
| Portfolio browse / model catalog | App | Tenant-specific content |
| Payment gateway (Razorpay/Cashfree/etc) | App | Merchant identity, store policy |
| Cart management (add/remove/persist) | App | Tenant UX, AsyncStorage |
| Navigation (tabs, drawer, stack) | App | App-level routing |
| User authentication (Firebase/Apple/Google) | App | Identity provider |
| Market data (LTP, WebSocket feeds) | App | Real-time infra |
| Notifications (FCM, Notifee) | App | Push notification infra |
| KYC / account opening | Never SDK | Regulatory, per-broker |

---

## SDK Backend Routes Summary

| Route | Method | Journey | What it does |
|---|---|---|---|
| `/sdk/v1/connections/:broker/login-url` | POST | 1 | Get OAuth URL |
| `/sdk/v1/connections/:broker/exchange-token` | POST | 1 | Complete OAuth |
| `/sdk/v1/connections/:broker/connect` | PUT | 1 | Direct credential persist |
| `/sdk/v1/connections/:broker/reauth-url` | GET | 6 | Smart-reauth URL |
| `/sdk/v1/user/status` | GET | 2,3,4 | Session + broker status |
| `/sdk/v1/rebalance/calculate` | POST | 2 | Compute trades |
| `/sdk/v1/orders/place` | POST | 3,4 | Bespoke placement |
| `/sdk/v1/orders/place-rebalance` | POST | 2 | MP placement + post-chain |
| `/sdk/v1/orders/:id/status` | POST | 2,3,4 | Order status poll |
| `/sdk/v1/orders/book` | GET | 2 | Order book |
| `/sdk/v1/portfolios/subscribe` | POST | 5 | Create subscription |
| `/sdk/v1/portfolios/:model/pnl` | GET | 7,8 | Portfolio P&L |
| `/sdk/v1/rebalance/modify-investment` | POST | 7 | Update capital |
| `/sdk/v1/config` | GET | all | Tenant config + broker API keys |
