# Integration Scope: Chatur.AI × AlphaQuark B2B
## Unified Equity + Mutual Fund Wealth Platform

**Version**: 0.1 (Client Review Draft)
**Date**: 15 May 2026
**Status**: Wireframe Scope — Pending Client Approval

---

## 1. Executive Summary

**Objective**: Combine Chatur.AI's existing mutual fund distribution infrastructure with AlphaQuark's equity advisory and trade-execution platform into a single, unified wealth management app for investors and RAs.

**Two deliverables in scope:**

| # | Deliverable | Base | What Gets Added |
|---|------------|------|-----------------|
| 1 | **Mobile App** (React Native) | AlphaQuark B2B mobile app | Mutual Fund module from Chatur.AI |
| 2 | **Web Platform** (React) | prod-alphaquark web app | Mutual Fund module (new section) via Chatur.AI MF APIs |

**Not in scope (this phase):** Back-office BSE StAR MF onboarding, KYC flow, MF order routing engine. Assumed provided by Chatur.AI's existing infrastructure.

---

## 2. What Each Side Brings

### 2a. Chatur.AI (MF side — existing)

Screens observed in the current app:

| Tab | What it shows |
|-----|--------------|
| **Explore Funds** | Fund discovery — AUM, Expense Ratio, Returns (1M/3M/1Y/3Y/5Y), Star ratings, Risk tag, AMC logo |
| **Dashboard** | Portfolio overview — Latest Value, Investment Cost, Unrealised Gain, Realised Gain, Other Income, Overall Gain, Allocation pie chart, Individual/Online toggle |
| **Holdings** | Folio-wise view — date filter, Consolidated Summary, Individual/Online toggle |
| **Profit-Loss** | Date-range P&L — Individual/Online, Folio Wise |
| **Tax** | Tax computation view |
| **Dividend** | Dividend history |

Header controls: Search, Bookmarks/Watchlist, Cart (SIP/Lumpsum basket), Profile

APIs assumed available from Chatur.AI backend:
- Fund master (NAV, returns, AUM, expense ratio, ratings)
- User portfolio data (holdings, transactions, gains)
- Order placement (SIP / Lumpsum)
- P&L, Tax, Dividend reports

---

### 2b. AlphaQuark B2B (Equity side — existing)

| Feature | What it provides |
|---------|----------------|
| **Broker Connect** | Connect 14 brokers (Zerodha, Angel One, Upstox, ICICI, Kotak, Dhan, Fyers, IIFL, AliceBlue, Motilal, HDFC, Groww, Axis, Dummy) |
| **Stock Recommendations** | RA-specific buy/sell/hold advice with quantity + price |
| **Model Portfolios** | Equity baskets (e.g. MAMM, MSRO, MFCC) with CAGR, Risk, Min Investment, Methodology, Rebalancing |
| **Trade Execution** | Direct broker execution (market/limit/AMO), basket ordering, rebalance |
| **Equity Holdings** | Multi-broker aggregated portfolio view, P&L, order book |
| **Subscriptions** | Plan-based subscription for model portfolios with payment gateway |

---

## 3. Mobile App — Information Architecture

### 3a. Bottom Navigation (5 Tabs)

```
┌─────────┬──────────────┬──────────┬───────────┬─────────┐
│  Home   │  Mutual Funds│  Stocks  │ Portfolio │ Account │
│  (🏠)   │     (📈)     │   (💹)   │   (📊)    │  (👤)  │
└─────────┴──────────────┴──────────┴───────────┴─────────┘
```

---

### 3b. Screen List — Mobile

---

#### TAB 1: Home

**Home Dashboard** (new screen — unified)
```
┌─────────────────────────────────────┐
│  Good Morning, [Name]          🔔   │
│  [Advisory / RA logo]               │
├─────────────────────────────────────┤
│  TOTAL WEALTH                       │
│  ₹ X,XX,XXX                         │
│  ▲ ₹XXX (X.XX%) Today               │
├──────────────┬──────────────────────┤
│  MF Value    │  Equity Value        │
│  ₹X,XXX      │  ₹X,XXX             │
├─────────────────────────────────────┤
│  MARKET PULSE                       │
│  NIFTY 50  ▲ 0.3%  SENSEX ▲ 0.2%   │
├─────────────────────────────────────┤
│  QUICK ACTIONS                      │
│  [Explore Funds] [Model Portfolios] │
│  [Stock Advice]  [Transactions]     │
├─────────────────────────────────────┤
│  RECENT ACTIVITY                    │
│  • New rebalance alert: MAMM        │
│  • Fund recommendation: ICICI MF    │
└─────────────────────────────────────┘
```
- Tapping MF Value → navigates to Mutual Funds tab / MF Dashboard
- Tapping Equity Value → navigates to Portfolio tab / Equity Holdings
- Market pulse is real-time (WebSocket, existing AlphaB2B infrastructure)

---

#### TAB 2: Mutual Funds

Sub-tabs: **Explore | Dashboard | Holdings | Reports**

---

**Explore Funds** (from Chatur.AI — preserve UI, rewire to APIs)
```
┌─────────────────────────────────────┐
│  🔍 Search funds...          Filter │
├─────────────────────────────────────┤
│  Showing 130 Mutual Funds           │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │ [AMC logo] ICICI Pru Midcap  │   │
│  │ Fund Regular Growth          │   │
│  │ Very High | Equity Schemes ★★★★★ │
│  │ AUM: ₹6569 Cr  ER: 1.77%    │   │
│  │ Total Return: 17.7%          │   │
│  │ 1M    3M     1Y    3Y    5Y  │   │
│  │ 6.76% 5.35% 20.96% 26.76% 20.88%│
│  │                 [🛒]   [🔖] │   │
│  └──────────────────────────────┘   │
│  (repeat for each fund)             │
├─────────────────────────────────────┤
│  ≡ Filters           ≡ Sort: 1Year  │
└─────────────────────────────────────┘
```
- Filter panel: AMC, Category (Equity/Debt/Hybrid/ELSS), Risk, Star Rating, Returns
- Cart icon → add for SIP or Lumpsum investment
- Bookmark → save to watchlist
- Fund card tap → Fund Detail screen

**Fund Detail Screen** (new)
```
┌─────────────────────────────────────┐
│  ← ICICI Pru Midcap Fund Regular   │
│  Very High Risk | Equity            │
├─────────────────────────────────────┤
│  NAV: ₹XXX.XX  (as of date)        │
├─────────────────────────────────────┤
│  [Performance Chart — line graph]  │
│  Toggle: 1M | 3M | 6M | 1Y | 3Y | 5Y│
├─────────────────────────────────────┤
│  Returns     Benchmark    Category  │
│  1Y: 20.96%  18.50%      18.20%    │
│  3Y: 26.76%  ...         ...       │
├─────────────────────────────────────┤
│  Fund Info                          │
│  AUM: ₹6,569 Cr  |  ER: 1.77%     │
│  Fund Manager: [Name]               │
│  Launch Date: [Date]                │
│  Min SIP: ₹500  Min Lumpsum: ₹5000 │
├─────────────────────────────────────┤
│  [  INVEST — SIP  ]  [ INVEST — LUMPSUM ] │
└─────────────────────────────────────┘
```

**MF Dashboard** (from Chatur.AI — preserve)
```
┌─────────────────────────────────────┐
│  All Figures in ₹                   │
│  [Individual]     [Online]          │
├─────────────────────────────────────┤
│  Latest Value    │  Investment Cost │
│  ₹ X,XX,XXX      │  ₹ X,XX,XXX    │
├─────────────────────────────────────┤
│  Unrealised Gain │  Realised Gain  │
│  ₹ X,XXX  X.XX%  │  ₹ X,XXX X.XX% │
├─────────────────────────────────────┤
│  Other Income    │  Overall Gain   │
│  ₹ X,XXX         │  ₹ X,XXX       │
├─────────────────────────────────────┤
│  ALLOCATION — LATEST VALUE          │
│  [Pie Chart — category-wise]        │
│  ■ Equity  ■ Debt  ■ Hybrid         │
├─────────────────────────────────────┤
│  [List view] [Grid view]            │
└─────────────────────────────────────┘
```

**MF Holdings** (from Chatur.AI — preserve)
```
┌─────────────────────────────────────┐
│  All Figures in ₹                   │
│  [Individual]     [Online]          │
│  [15 May 2026  ▼]  ☑ Folio Wise   │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │  Consolidated Summary       │   │
│  │  Current Value: ₹X,XX,XXX   │   │
│  │  Invested: ₹X,XX,XXX        │   │
│  │  Gain: ₹X,XXX (X.XX%)       │   │
│  └──────────────────────────────┘   │
│  [Fund-wise holdings list]          │
│  Each card: Fund name, Units,       │
│  Avg NAV, Current NAV, Gain%       │
├─────────────────────────────────────┤
│  ≡ Filters                         │
└─────────────────────────────────────┘
```

**MF Reports** (merged from Chatur.AI tabs)

Sub-tabs: **P&L | Tax | Dividend**

```
┌─────────────────────────────────────┐
│  [P&L]  [Tax]  [Dividend]           │
├─────────────────────────────────────┤
│  [Individual]     [Online]          │
│  [15-May-2025] → [15-May-2026  ▼]  │
│  ☑ Folio Wise                       │
├─────────────────────────────────────┤
│  (P&L tab)                          │
│  Short Term Gain:  ₹X,XXX           │
│  Long Term Gain:   ₹X,XXX           │
│  Total Realised P&L: ₹X,XXX        │
│  [Transaction-level breakup list]  │
└─────────────────────────────────────┘
```

**MF Cart / Order** (from Chatur.AI — cart icon in header)
```
┌─────────────────────────────────────┐
│  ← My Cart / Invest                 │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │ ICICI Pru Midcap Fund        │   │
│  │ ● SIP  ○ Lumpsum             │   │
│  │ Amount: [₹ _____]            │   │
│  │ SIP Date: [5th ▼]  [🗑]     │   │
│  └──────────────────────────────┘   │
│  + Add more funds                   │
├─────────────────────────────────────┤
│  Total: ₹X,XXX/month               │
│  [   PLACE ORDER   ]                │
└─────────────────────────────────────┘
```

---

#### TAB 3: Stocks (Equity)

Sub-tabs: **Advice | Model Portfolios | Orders**

---

**Stock Recommendations / Advice** (from AlphaB2B — preserve)
```
┌─────────────────────────────────────┐
│  [RA/Strategy tabs]                 │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │  BUY · RELIANCE INDUSTRIES   │   │
│  │  NSE: RELIANCE               │   │
│  │  Target: ₹3,200 | SL: ₹2,800│   │
│  │  Qty: 10  |  LTP: ₹2,950    │   │
│  │  [Add to Cart]  [Execute]   │   │
│  └──────────────────────────────┘   │
│  (more advice cards)                │
├─────────────────────────────────────┤
│  [🛒 Execute All]                   │
└─────────────────────────────────────┘
```

**Model Portfolios** (from AlphaB2B — like Moneyman MAMM/MSRO/MFCC)
```
┌─────────────────────────────────────┐
│  INVESTMENT STRATEGIES              │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │ [Logo] MONEYMAN ALPHA        │   │
│  │ MOMENTUM MULTIPLIER [MAMM]   │   │
│  │                  model portfolio │
│  │ Opportunity to generate      │   │
│  │ consistent alpha...          │   │
│  │ ┌──────┬──────┬────────────┐│   │
│  │ │ CAGR │ Risk │ Min. Invest ││   │
│  │ │  XX% │ High │ ₹20,00,000 ││   │
│  │ └──────┴──────┴────────────┘│   │
│  │  View Portfolio Methodology  │   │
│  │  ₹3,330/month               │   │
│  │  [      INVEST NOW →       ] │   │
│  └──────────────────────────────┘   │
│  (more portfolio cards)             │
└─────────────────────────────────────┘
```

**My Orders** (from AlphaB2B — preserve)
```
┌─────────────────────────────────────┐
│  ← My Orders          Filter | Date │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │  RELIANCE | BUY | NSE        │   │
│  │  10 qty @ ₹2,950             │   │
│  │  Broker: Zerodha             │   │
│  │  Status: ✅ COMPLETE         │   │
│  │  15 May 2026, 10:32 AM      │   │
│  └──────────────────────────────┘   │
│  (more order rows)                  │
└─────────────────────────────────────┘
```

**Broker Connect** (from AlphaB2B — under Account tab, accessible from Stocks)
- Entry point: banner/CTA in Stocks tab if no broker connected
- Full flow in Account tab (see below)

---

#### TAB 4: Portfolio (Unified)

Sub-tabs: **Summary | Equity | Mutual Funds**

---

**Portfolio Summary** (new screen — stitches both worlds)
```
┌─────────────────────────────────────┐
│  TOTAL WEALTH                       │
│  ₹ XX,XX,XXX                        │
│  Today: ▲ ₹X,XXX (X.XX%)           │
├─────────────────────────────────────┤
│  ASSET ALLOCATION                   │
│  [Donut chart]                      │
│  ■ Equity (Direct)  XX%             │
│  ■ Mutual Funds     XX%             │
│  ■ Cash/Others      XX%             │
├──────────────┬──────────────────────┤
│  MF Summary  │  Equity Summary      │
│  ₹X,XX,XXX   │  ₹X,XX,XXX          │
│  Gain: X.XX% │  Gain: X.XX%         │
├─────────────────────────────────────┤
│  [View MF Portfolio →]              │
│  [View Equity Portfolio →]          │
└─────────────────────────────────────┘
```

**Equity Holdings** (from AlphaB2B — multi-broker aggregated)
```
┌─────────────────────────────────────┐
│  EQUITY PORTFOLIO                   │
│  Total: ₹X,XX,XXX  Gain: ▲ X.XX%   │
├─────────────────────────────────────┤
│  [Broker tabs: All | Zerodha | ...]  │
├─────────────────────────────────────┤
│  ┌──────────────────────────────┐   │
│  │  RELIANCE           ▲ 2.3%  │   │
│  │  10 qty × ₹2,950 = ₹29,500  │   │
│  │  Buy avg: ₹2,700  P&L: ▲₹2,500│  │
│  └──────────────────────────────┘   │
│  (more stock rows)                  │
└─────────────────────────────────────┘
```

**MF Holdings** (same as Mutual Funds tab → Holdings, accessible from Portfolio tab)

---

#### TAB 5: Account / Profile

```
┌─────────────────────────────────────┐
│  [Avatar]  [User Name]              │
│  pratik@alphaquark.in               │
├─────────────────────────────────────┤
│  BROKER CONNECTIONS                 │
│  [Zerodha ✅]  [Angel One ✅]       │
│  [+ Connect a Broker]               │
├─────────────────────────────────────┤
│  MF ACCOUNT                         │
│  KYC Status: ✅ Verified            │
│  Folios: [X active]                 │
├─────────────────────────────────────┤
│  SETTINGS                           │
│  Notifications                      │
│  Theme                              │
│  Language                           │
├─────────────────────────────────────┤
│  SUPPORT                            │
│  Help & FAQ                         │
│  Contact Us                         │
├─────────────────────────────────────┤
│  [Logout]                           │
└─────────────────────────────────────┘
```

---

## 4. Web Platform — Information Architecture

Extend **prod-alphaquark** with a new **Mutual Funds** section in the top navigation.

### 4a. New Navigation Item

```
[Home] [Recommendations] [Model Portfolios] [Portfolio] [Mutual Funds ← NEW] [Profile]
```

### 4b. Web Screen List

---

**Explore Funds** (`/mutual-funds/explore`)
```
┌──────────────────────────────────────────────────────────────┐
│  MUTUAL FUNDS                            [🔍 Search funds]   │
├──────────────────────────────────────────────────────────────┤
│  Filter Panel (left sidebar)     │  Fund Results (main area) │
│  ─────────────────────           │  ──────────────────────── │
│  Category                        │  Showing 130 Mutual Funds │
│  ☐ Equity  ☐ Debt  ☐ Hybrid     │                            │
│  ☐ ELSS    ☐ Liquid              │  ┌────────────────────┐   │
│                                  │  │ ICICI Pru Midcap   │   │
│  Risk                            │  │ Very High | Equity │   │
│  ☐ Low  ☐ Moderate  ☐ High      │  │ ★★★★★              │   │
│                                  │  │ AUM: ₹6569 Cr      │   │
│  Returns                         │  │ ER: 1.77%          │   │
│  Min 1Y Return: [slider]         │  │ 1Y: 20.96%         │   │
│                                  │  │ 3Y: 26.76%         │   │
│  AMC                             │  │ [+ Cart]  [Watch]  │   │
│  ☐ ICICI ☐ HDFC ☐ SBI ☐ Axis   │  └────────────────────┘   │
│  ☐ Mirae ☐ Nippon ☐ Kotak       │  (grid or list view)      │
│  [+ More]                        │                            │
│                                  │  Sort by: [1 Year ▼]      │
└──────────────────────────────────────────────────────────────┘
```

**Fund Detail Page** (`/mutual-funds/fund/:fundId`)
```
┌──────────────────────────────────────────────────────────────┐
│  ← Back   ICICI Prudential Midcap Fund — Regular Growth      │
│           Very High Risk | Equity — Mid Cap                   │
├──────────────────────────────────────────────────────────────┤
│  NAV: ₹XXX.XX  |  AUM: ₹6,569 Cr  |  ER: 1.77%             │
├──────────────────────────────────────────────────────────────┤
│  [Performance Chart — large, interactive]                    │
│  1M  3M  6M  1Y  3Y  5Y  MAX                                 │
├──────────────────────────────────────────────────────────────┤
│  Returns       Fund      Benchmark    Category Avg           │
│  1 Month      6.76%      6.10%        6.20%                  │
│  3 Month      5.35%      4.90%        5.00%                  │
│  1 Year      20.96%     18.50%       18.20%                  │
│  3 Year      26.76%     24.10%       23.80%                  │
│  5 Year      20.88%     18.90%       18.50%                  │
├──────────────────────────────────────────────────────────────┤
│  Fund Details                                                 │
│  Fund Manager: [Name]   |  Launch Date: DD-MM-YYYY           │
│  Min SIP: ₹500          |  Min Lumpsum: ₹5,000               │
│  Exit Load: 1% if < 1Y  |  Lock-in: None                     │
├──────────────────────────────────────────────────────────────┤
│  [ INVEST — SIP ]                   [ INVEST — LUMPSUM ]     │
└──────────────────────────────────────────────────────────────┘
```

**MF Portfolio Dashboard** (`/mutual-funds/portfolio`)
```
┌──────────────────────────────────────────────────────────────┐
│  MY MUTUAL FUND PORTFOLIO          [Individual ▼]  [Online]  │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Latest Value    Investment Cost   Overall Gain     │     │
│  │  ₹X,XX,XXX       ₹X,XX,XXX        ₹X,XXX (X.XX%)  │     │
│  │                                                     │     │
│  │  Unrealised Gain  Realised Gain   Other Income     │     │
│  │  ₹X,XXX  X.XX%   ₹X,XXX  X.XX%  ₹X,XXX            │     │
│  └─────────────────────────────────────────────────────┘     │
├────────────────────────────┬─────────────────────────────────┤
│  Allocation (Pie Chart)    │  Fund-wise Breakdown Table       │
│  ■ Equity  ■ Debt         │  Fund | Units | Cur. Value | Gain│
│  ■ Hybrid  ■ ELSS         │  ──────────────────────────────  │
│                            │  ICICI Mid | 100 | ₹X,XXX | ▲X%│
│                            │  HDFC Flex | 200 | ₹X,XXX | ▲X%│
└────────────────────────────┴─────────────────────────────────┘
```

**MF Holdings** (`/mutual-funds/holdings`)
```
┌──────────────────────────────────────────────────────────────┐
│  MF HOLDINGS                As of: [15 May 2026 ▼]   ☑ Folio│
│  [Individual]  [Online]                                      │
├──────────────────────────────────────────────────────────────┤
│  Consolidated Summary                                        │
│  Current Value: ₹X,XX,XXX  |  Invested: ₹X,XX,XXX          │
│  Total Gain: ₹X,XXX  (X.XX%)                                │
├──────────────────────────────────────────────────────────────┤
│  FUND                 UNITS    AVG NAV  CUR NAV  VALUE  GAIN │
│  ICICI Pru Midcap    100.00   ₹500.00  ₹XXX.XX  ₹X,XXX  ▲X%│
│  HDFC Flexi Cap      200.00   ₹300.00  ₹XXX.XX  ₹X,XXX  ▲X%│
│  (full table)                                                │
├──────────────────────────────────────────────────────────────┤
│  [Export to CSV]                          [≡ Filters]       │
└──────────────────────────────────────────────────────────────┘
```

**MF Reports** (`/mutual-funds/reports`)

Sub-tabs: **P&L | Tax | Dividend**

```
┌──────────────────────────────────────────────────────────────┐
│  [P&L]  [Tax]  [Dividend]                                    │
│  [Individual]  [Online]   From: [──────] To: [──────]        │
│  ☑ Folio Wise                                                │
├──────────────────────────────────────────────────────────────┤
│  (P&L tab)                                                   │
│  Short Term Capital Gain (< 1 year):  ₹X,XXX                │
│  Long Term Capital Gain (> 1 year):   ₹X,XXX                │
│  Total Realised P&L:                  ₹X,XXX                │
├──────────────────────────────────────────────────────────────┤
│  Transaction Details                                         │
│  Date | Fund | Type | Units | NAV | Amount | Gain | Period  │
│  (table rows)                                                │
├──────────────────────────────────────────────────────────────┤
│  [Export to CSV]  [Export to PDF]                            │
└──────────────────────────────────────────────────────────────┘
```

**MF Transaction Cart / Order Placement** (`/mutual-funds/cart`)
```
┌──────────────────────────────────────────────────────────────┐
│  ← INVEST                                                    │
├──────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐       │
│  │  ICICI Pru Midcap Fund — Regular Growth           │       │
│  │  ● SIP  ○ Lumpsum                                 │       │
│  │  SIP Amount: [₹ _____]  SIP Date: [5th ▼]        │       │
│  │  Start: [Auto — next date]  [Remove 🗑]           │       │
│  └───────────────────────────────────────────────────┘       │
│  [+ Add another fund]                                        │
├──────────────────────────────────────────────────────────────┤
│  TOTAL  ₹X,XXX/month SIP                                     │
│  Payment via: [Net Banking ▼]                                │
│  [   CONFIRM & PLACE ORDER   ]                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Integration Points

### 5a. MF APIs (from Chatur.AI / BSE StAR MF infrastructure)

| API | Method | Purpose |
|-----|--------|---------|
| Fund Master | `GET /mf/funds` | All funds: NAV, AUM, ER, returns, ratings, category |
| Fund Detail | `GET /mf/funds/:isin` | Single fund full details + historical NAV |
| User Portfolio | `GET /mf/portfolio` | Aggregated portfolio: value, cost, gains |
| Holdings | `GET /mf/holdings` | Folio-wise holdings with units, avg NAV |
| P&L | `GET /mf/pnl?from=&to=` | Realised/unrealised gains with date filter |
| Tax | `GET /mf/tax?year=` | STCG/LTCG computation |
| Dividend | `GET /mf/dividend` | Dividend history |
| Place Order | `POST /mf/orders` | SIP / Lumpsum order placement |
| Watchlist | `GET/POST /mf/watchlist` | Save/retrieve user's fund watchlist |

*Note: Exact endpoint shapes to be confirmed with Chatur.AI tech team.*

### 5b. AlphaB2B APIs (existing — no changes needed)

| Feature | Existing endpoint | Status |
|---------|-----------------|--------|
| Stock recommendations | `GET /api/advices` | ✅ Existing |
| Model portfolios | `GET /api/model-portfolios` | ✅ Existing |
| Broker connect | `POST /api/user/brokers/:broker/connect` | ✅ Existing |
| Trade execution | `POST /api/process-trades/order-place` | ✅ Existing |
| Equity holdings | `GET /api/broker/holdings` | ✅ Existing |
| Rebalance | `POST /api/rebalance/process-trade` | ✅ Existing |

### 5c. Unified Auth

- Single login for both MF + equity
- JWT token from AlphaQuark backend includes MF scope
- MF API calls proxied through AlphaQuark backend (avoids CORS, adds auth layer)
- Optionally: MF API key stored per-user in AlphaQuark DB

---

## 6. New Screens Summary

| # | Screen | Platform | Source |
|---|--------|----------|--------|
| 1 | Unified Home Dashboard | Mobile + Web | New |
| 2 | Explore Funds | Mobile + Web | Chatur.AI (port) |
| 3 | Fund Detail | Mobile + Web | New |
| 4 | MF Dashboard | Mobile + Web | Chatur.AI (port) |
| 5 | MF Holdings | Mobile + Web | Chatur.AI (port) |
| 6 | MF Reports (P&L / Tax / Dividend) | Mobile + Web | Chatur.AI (port) |
| 7 | MF Cart / Order Placement | Mobile + Web | Chatur.AI (port) |
| 8 | Unified Portfolio Summary | Mobile + Web | New |
| 9 | Model Portfolios (Equity) | Mobile | AlphaB2B (existing) |
| 10 | Stock Recommendations | Mobile | AlphaB2B (existing) |
| 11 | Equity Holdings | Mobile + Web | AlphaB2B (existing) |
| 12 | Broker Connect | Mobile | AlphaB2B (existing) |

---

## 7. Screens Preserved As-Is (No Changes Needed)

**From AlphaB2B mobile app:**
- Broker Connection Modals (all 14 brokers)
- Model Portfolio Subscribe / Invest Now flow
- Rebalance Modal
- Order Book / Order History
- Trade Execution flow
- Login / Onboarding

**From AlphaB2B web (prod-alphaquark):**
- All existing equity flows
- Broker management
- RA dashboard
- Admin panel

---

## 8. Open Questions for Client

| # | Question | Impact |
|---|----------|--------|
| 1 | What is the final brand name for the integrated app? "Chatur.AI" or a new name? | App icon, splash, header |
| 2 | Is Chatur.AI's MF API self-hosted or via a third-party MF platform (e.g. BSE StAR MF, MFU, Karvy)? | API integration design |
| 3 | Should MF order placement be within the app or redirect to an external BSE StAR MF flow? | Cart/order screen scope |
| 4 | What is the target user base — retail investors (B2C) or advisory clients (B2B)? | Onboarding/KYC flow |
| 5 | Should the app show BOTH equity and MF for all users, or can some users be equity-only or MF-only? | Tab visibility logic |
| 6 | Is Moneyman Investments a separate advisory firm or the same client? | Model portfolio assignment |
| 7 | Does the web platform need the full MF module or just a portfolio summary widget? | Web scope size |
| 8 | Are there any existing users with data in the Chatur.AI MF app who need migration? | Data migration scope |

---

## 9. Out of Scope (Phase 1)

- BSE StAR MF account opening / KYC flow
- MF redemption / switch / STP flows (can be added in Phase 2)
- Goal-based investing / robo-advisory
- Tax filing / CAS statement generation
- NPS, FD, bonds, or other asset classes
- Admin/RA-side MF recommendation tooling

---

## 10. Indicative Effort Estimate (High Level)

| Component | Effort |
|-----------|--------|
| Mobile: New Home Dashboard | 3–4 days |
| Mobile: MF Module (Explore, Dashboard, Holdings, Reports) | 8–10 days |
| Mobile: MF Cart & Order Placement | 3–4 days |
| Mobile: Unified Portfolio Tab | 3–4 days |
| Mobile: API integration (MF APIs proxy + auth) | 4–5 days |
| Web: MF Module (all 5 screens) | 8–10 days |
| Web: API integration | 3–4 days |
| Backend: MF API proxy + auth layer | 4–5 days |
| QA + UAT | 5–7 days |
| **Total** | **~6–8 weeks** |

*This is a rough estimate. Final estimate requires API documentation from Chatur.AI and backend architecture review.*

---

*Document prepared by AlphaQuark for client review. Subject to change based on client feedback.*
