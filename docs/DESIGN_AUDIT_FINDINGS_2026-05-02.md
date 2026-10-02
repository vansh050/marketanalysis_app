# Design-system audit findings — 2026-05-02

> Compiled output of 4 parallel audit agents covering the remaining open audit tasks (A, C, E, F, G, H) from `DESIGN_COMPONENT_AUDIT.md § 9`. Doc-only — no code changes. Use this as the input for future migration commits (Phase G/H/I + cleanup PRs).
>
> **Verification reminder** (from the Phase D pivot lesson): every "migration candidate" verdict here was reached from data-dep analysis only. **Verify consumer count via grep before scheduling any of these surfaces for migration** — orphan files (`investContext.js`, `use.js`, `VideoPlayerModal.js`, `SubscriptionsScreen.js`) are flagged below but the same risk exists for any row.

---

## Audit-task A — `src/screens/Drawer/` per-file verdicts

Cross-checked against actual `ls` output. **Note:** the agent's filename list reflects the real folder contents — some files I'd named in the prompt (HistoryScreen, MySubscriptionsScreen, etc.) don't exist; the actual files are below. Already-audited surfaces (`ManageConnectionsModal`, `DisconnectBrokerModal`, `BrokerConnectionError` = `SDK-bound-skip`; `ModelPortfolioScreen`, `MPPerformanceScreen`, `CustomTabbarMPPerformance`, `EmptyStateMP` = MP rows) are excluded.

| Filename | Verdict | Phase | Reason | Data Deps |
|---|---|---|---|---|
| `BespokePerformanceScreen.js` | `needs-logic-extraction` | E.2 / G | Heavy `useTrade`, `useGstConfig`, axios calls; MP-coupled; data fetching + state management should move to container | `useTrade`, `useGstConfig`, axios, getAuth, EventEmitter, ModalContext |
| `CustomTabbar.js` | `defer` | cleanup | Shared utility tab component; consumed by ModelPortfolioScreen (already audited); extract to design kit later | `useConfig` |
| `CustomTabbarOrder.js` | `clean-extract` | F / H | Pure stateless presentational; no hooks | none (only RN base) |
| `DistributionRowGrid.js` | `needs-logic-extraction` | G | axios + server config + token generation; API logic should move to a hook | axios, server, generateToken, Config |
| `IgnoreTradesScreen.js` | `needs-logic-extraction` | G | Heavy hooks (`useTrade`, `useConfig`, `useModal`, `useCart`); axios; broker state machines | `useTrade`, `useConfig`, `useModal`, `useCart`, axios, getAuth, EventEmitter |
| `investContext.js` | `defer` | cleanup | **Orphan** (zero external imports) — likely dead code or intentional placeholder | none |
| `PaymentHistoryScreen.js` | `needs-logic-extraction` | G | `useTrade`, `useConfig`; axios invoice fetch; file I/O | `useTrade`, `useConfig`, axios, getAuth, generateToken |
| `PrivacyPolicyScreen.js` | `clean-extract` | F | Mostly presentation; `useTrade`/`useConfig` for theme passthrough only | `useTrade`, `useConfig` (config-only) |
| `ProductCatalogScreen.js` | `clean-extract` | F | Pure presentation; static catalog | navigation only |
| `ReviewScreen.js` | `clean-extract` | F | Pure presentation; hardcoded dummy review data | `useNavigation`, `Dropdown` |
| `SubscriptionsScreen.js` | `defer` | cleanup | **Stub/placeholder** (only renders "Subscriptions" text); zero functionality | none |
| `TermandConditionsScreen.js` | `clean-extract` | F | Mostly presentation; theme config only | `useTrade`, `useConfig` (config-only) |
| `use.js` | `defer` | cleanup | **Orphan data export** (zero external imports) — likely dead code or assets reference | none |

**Summary:** 4 files `needs-logic-extraction` (Phase G), 4 `clean-extract` (Phase F), 5 `defer` for cleanup. Heaviest candidates: `BespokePerformanceScreen` and `IgnoreTradesScreen` (multi-hook + axios flow).

---

## Audit-task C — `src/components/HomeScreenComponents/KnowledgeHubScreen/`

| Filename | Verdict | Phase | Reason | Data Deps |
|---|---|---|---|---|
| `BlogScreen.js` | `clean-extract` | G | Pure presentation wrapper that passes props to `KnowledgeHub` parent | `KnowledgeHub` |
| `VideoScreen.js` | `clean-extract` | G | Pure presentation wrapper passing props to `KnowledgeHub` | `KnowledgeHub` |
| `PdfScreen.js` | `clean-extract` | G | Pure presentation wrapper passing props to `KnowledgeHub` | `KnowledgeHub` |
| `VideoPlayerModal.js` | `defer` | cleanup | **Empty file** (0 bytes) — orphan dead code/placeholder | None |

All three screen wrappers are thin consumers of `KnowledgeHub.js` and delegate logic/state to the parent. Navigation hits them via `KnowledgeHub.js` (`navigate('VideosScreen' / 'BlogsScreen' / 'PDFsScreen')`).

---

## Audit-task E — `src/screens/AccountSettingScreen/`

**Important location correction:** the actual main `AccountSettingsScreen.js` lives at `src/screens/Home/AccountSettingsScreen.js`, NOT in `src/screens/AccountSettingScreen/`. The `AccountSettingScreen` folder only contains `ChangeAdvisor.js` (already migrated).

| Filename | Path | Verdict | Phase | Reason | Data Deps |
|---|---|---|---|---|---|
| `AccountSettingsScreen.js` | `src/screens/Home/` | `needs-logic-extraction` | F | Hooks: `useTrade`, `useConfig`; Firebase `getAuth`; conditional logic for feature flags (`REACT_APP_HIDE_CHANGE_MANAGER`) | `useTrade`, `useConfig`, Firebase Auth, `Config` (safeConfig) |

`ChangeAdvisor.js` was the only file in `src/screens/AccountSettingScreen/` and is already migrated (Phase F batch 4). The parent settings screen at `src/screens/Home/AccountSettingsScreen.js` is the next audit-doc row to add.

---

## Audit-task F — `src/UIComponents/StockAdvicesUI/` deeper audit

### `StockCard.js`

**Hooks (file:line):**
- `useLTPStore` (30 / 92) — Zustand: real-time LTP by symbol
- `useNavigation` (34 / 133)
- `useConfig` (35 / 126)
- `useModalStore` (39 / 410) — Zustand: modal state
- `useState` (line 91 — `showAttachmentModal`)
- `useEffect` (156 — `Animated.timing` on height change)
- `useRef` (153–154 — Animated; 164 — `ltpRef`)

**Services / EventEmitter:** `useLTPStore` selector; `useModalStore.getState().openModal()` (410–412) for DDPI help; utilities `isSellAuthRejection` / `getBrokerDdpiHelp`. **No** explicit axios or EventEmitter — state is prop-driven.

**Render shape (5–10 bullets):**
- Outer `TouchableOpacity` with conditional disable based on `advisedRangeCondition` + `planList`
- Glassomorphic border + background layers
- Status badge (CANCELLED / EDITED) overlaid top-right
- Header: symbol (with optional blurred overlay), attachment button, BUY/SELL action badge
- Collapsed content: symbol breakdown, order-type + price, recommended range, market LTP, SL/PT rows, P&L + change %, plan name + position status, date/time, rejection message + DDPI help link, action buttons
- Expanded content: range detail, market price, date/time, qty controls (–/+/input), action buttons
- Attachment modal (PDF/image/other detection, FlatList with `Linking.openURL`)

**Proposed viewModel:**

```js
{
  pnl: number | null,                 // ltp - advisedPrice
  changePercent: number | null,       // ((ltp - entry) / entry) * 100
  advisedRangeCondition: boolean,     // interaction gate
  formattedPlanName: string | null,   // "Plan_Name" -> "Plan Name"
  formattedSymbol: string,            // "INFY25JAN100CE" -> "INFY 25JAN | 100 | CE"
  themeColor: string,
  cardElevation: number,
  cardVerticalMargin: number,
}
```

**Proposed actions:** `onSelectStock`, `onIncreaseQty`, `onDecreaseQty`, `onQtyInputChange`, `onTrade`, `onIgnoreTrade`, `onToggleExpand`, `onDdpiHelpRequest`, `onAttachmentOpen`.

**Risks:** Animated refs + useEffect coupling (153–162); inline `useModalStore.getState()` (410); fallback `navigation.navigate('Model Portfolio')` embedded in presentation (451–455, 492–496); `useLTPStore` selector reads prop `symbol` directly; complex `advisedRangeCondition` (8+ conditions, 104–123).

**Verdict:** `needs-logic-extraction` — Phase G (advice screens).

### `BasketCard.js`

**Hooks:** `useTrade` (18 / 46) — `userDetails`, `broker`, `fetchBrokerOrderBook`, `configData`.

**Services / EventEmitter:** `reconcileBasket()` (19), `isClosureTrade()` (19), `cancelOrder()` from BrokerOrderBookAPI (21), dynamic `require('../../services/ReconciliationService')` (169) for `applyUserResolutions`. **No** EventEmitter; state event-driven via modal callbacks.

**Render shape:**
- `LinearGradient` card with status-driven colours (gray / red / navy)
- Header: basket name, status badges (Expired / Edited / Closure), running profit
- Faded logo watermark (zIndex 0)
- Stocks: conditional grid (≤3 trades) or `FlatList`; expandable trade items (Limit / SL / Target / Qty)
- Show More button
- Date/time row + calendar icon
- Action buttons: Reject (conditional), Accept / Close / Expired (loading state)
- `PendingOrderWarningModal` overlay for reconciliation conflicts

**Proposed viewModel:**

```js
{
  isEdited: boolean,
  isClosureBasket: boolean,
  isExpired: boolean,
  basketHasClosures: boolean,
  basketName: string | null,
  basketId: string,
  gradientColors: string[],
  firstThreeTrades: Trade[],
  remainingCount: number,
  expandedTrades: { [index: number]: boolean },
  reconciliationResult: ReconcileResult | null,
  isCheckingReconciliation: boolean,
}
```

**Proposed actions:** `onAcceptBasket`, `onRejectBasket`, `onToggleShowMore`, `onToggleTradeExpansion`, `onResolveConflicts`, `onCancelConflictResolution`, `onNavigateModelPortfolio`.

**Risks:** Async reconciliation flow in `handleTradeNowBasket` (226–272) — heavy business logic + `useTrade` context; dynamic `require` (169) suggests missing DI; modal callback chain (164) tightly couples reconciliation resolution to broker API calls; complex inline `mapBasketToStockDetails` (101–140); state proliferation (4 reconciliation-related states).

**Verdict:** `needs-logic-extraction` — Phase G. Recommendation: extract `useBasketReconciliation` hook for the async flow; keep modal interaction in presentation.

---

## Audit-task H — `KitePublisherModal.js` verification

**Question:** does this proxy a broker SDK call (= stays in `src/`) or is it purely UX (= Phase I `needs-logic-extraction`)?

**Findings:**

1. **No broker-SDK imports.** File imports only RN primitives, `lucide-react-native` icons, and the RN `WebView`. Zero imports from `@kite/`, `kiteconnect`, native broker SDKs, or `src/utils/broker*`.
2. **WebView sandboxing** (207–214): the Kite Publisher SDK (`window.KiteConnect`) is loaded inside the WebView via inline HTML + external `https://kite.trade/publisher.js?v=3`, **not** as an npm package.
3. **postMessage bridge** (135–190): communication is event-driven via `onMessage`. Component converts props (`apiKey`, `basketItems`) to JSON, posts to WebView; WebView handles SDK init + basket open.
4. **No `brokerPublisher.js` dependency.**
5. **State management is pure** (`useState` for `isReady` / `error` / `isOpening`); no direct SDK method calls from the React layer.

**Verdict:** `needs-logic-extraction` (Phase I) — **NOT** SDK-bound. KitePublisherModal is a presentation-layer wrapper around a cross-origin WebView; basket prep / error handling / success-failure logic should move to a container, but the WebView bridge stays in presentation. Safe normal extraction.

---

## Audit-task G — Phase I MP-screen viewModel sketches

Hard prerequisite for Phase I. All 10 files verdict-ed `needs-logic-extraction` (with 2 `clean-extract` exceptions: `CustomTabbarMPPerformance`, `EmptyStateMP`).

### `src/screens/Drawer/ModelPortfolioScreen.js` (1115 lines)

**Data deps:** `useTrade()` (`userDetails`, `broker`, `configData`, `getUserDeatils`), `useConfig()`, `useNavigation()`, axios (5+ endpoints: `getAllBespoke:114`, `getAllStrategy:138`, `getSingleStrategyDetails:163`, `getSpecificPlan:196`, `getAllSubscriptionData:323`), `useGstConfig()`, AsyncStorage, `uuid`, `Config`, `generateToken`.

**Render:** TabView (`bespoke` / `modelportfolio` routes); FlatList per tab with subscribed-first sort; modal overlay for plan details (pricing, duration, RenderHTML); inline `PaymentSuccessModal`, `RecommendationSuccessModal`.

**Proposed viewModel** (see Section 2 for full struct):
- `routes: Array<{key, title}>` (feature-flag driven)
- `allStrategy`, `allBespoke`, `subscriptionData`, `selectedPlan`, `modalContext`
- UI state: `index`, `paymentModal`, `paymentSuccess`, `isLoading`, `selectedCard`
- Pricing: `oneTimeAmount`, `oneTimeDurationPlan`, `selectedPlanType`
- Async: `refreshingMP`, `refreshingBespoke`

**Actions:** `openModal`, `handleCardClick`, `handleCardClickBespoke`, `handlePricingCardClick`, `handleCardClickSelect`, `closeInvestNowModal`, `setIndex`, `onDataLoaded`.

**Risks:** Heavy axios coupling in render callbacks; `modalContext` shape bloat (mixes 4 different shapes — unify into separate atoms); RefreshControl + tab-aware state needs `useCallback`-stable handlers; `PaymentSuccessModal` sibling coupling (resets state + refetches — order matters; use EventEmitter or callback to decouple).

**SDK risk:** medium — plan filtering/sorting is pure logic; modal/pricing UI candidate for SDK absorption (future MP subscription widget likely replaces `MPInvestNowModal` → mark for deprecation post-Phase-I).

### `src/screens/Drawer/MPPerformanceScreen.js` (2220 lines)

**Data deps:** `useTrade()` (`configData`, `userDetails`, `broker`, `funds`), `useNavigation()`, axios (5+ endpoints: `getStrategyDetails:378`, `getSingleStrategyDetails:427`, `getAllStrategy:468`, `getSpecificPlan:786`, `calculateRebalance:635`), `useGstConfig()`, `useConfig()`, Firebase `getAuth()`, `moment`, `useMemo()` (chart data), EventEmitter, ConfigContext colors.

**Render:** Header gradient + plan card; TabView (Portfolio distribution grid / Overview chart + methodology / Research links); ConsentPopup for CAGR unlock; modals: `MPInvestNowModal`, `RecommendationSuccessModal`, `DdpiModal`, `AngleOneTpinModal`, `DhanTpinModal`, `FyersTpinModal`, `OtherBrokerModel`.

**Proposed viewModel:** route params (`modelName`, `specificPlan`); strategy data; pricing (`selectedPricing`, `currentPrice`, `originalPrice`, `discount`, `pricingOptions`); chart (`chartData`, `chartConfig`, `colorMap`); UI (`index`, `tabHeights`, `globalConsent`, `isConsentPopupOpen`, `paymentModal`, `paymentSuccess`); rebalance flow (`calculatedPortfolioData`, `confirmOrder`, `calculatedLoading`, `openSuccessModal`, `orderPlacementResponse`, `lastSubmittedTrades`); EDIS/TPIN modal states (7 booleans).

**Actions:** `handleInvestNow`, `handleConsentAccept`, `calculateRebalance`, `setIndex`, `setSelectedPricing`, `getStrategyDetails`, `handleCardClickSelect`.

**Risks:** Heavy async orchestration with overlapping useEffect chains (race conditions, redundant requests); `useMemo(chartData)` deps include inline color palette (re-renders excessively); EventEmitter coupling; **deeply nested EDIS modal prop chain** (7 boolean state pairs → refactor to single `edisState` or global modal store); `calculateRebalance` axios in event handler with 10+ broker-specific payloads.

**SDK risk: HIGH** — `calculateRebalance` is a ccxt-india RPC entry point; if SDK absorbs order-placement later, this entire modal stack is a candidate for deprecation. Keep logic extraction minimal during Phase I.

### `src/screens/Drawer/CustomTabbarMPPerformance.js` (68 lines)

**Verdict:** `clean-extract` (memo component, props-only, no hooks).

**ViewModel:** `{ navigationState: {index, routes}, jumpTo, isSubscriptionActive }`. **Actions:** `jumpTo(routeKey)`. **Risks:** none.

### `src/screens/Drawer/EmptyStateMP.js` (53 lines)

**Verdict:** `clean-extract` (uses `useConfig` for theme only — could become viewModel from container).

**ViewModel:** `{ title, subtitle, themeColor, mainColor }`. **Actions:** none. **Risks:** none.

### `src/screens/PortfolioScreen/ModelPFCard.js` (335 lines)

**Data deps:** `useTrade()` (`configData`), `useNavigation()`, axios (`getStrategyDetails:53`, `getSubscriptionData:84`), `useWebSocketCurrentPrice`, EventEmitter (`portfolioEvents.on('HOLDINGS_REFRESH')`), `moment`, AsyncStorage (implicit).

**Render:** Card — image + model name + repair badge + invested amount + portfolio percentage.

**Proposed viewModel:** `modelName`, `userEmail`, `specificPlan`, `strategy`, `repair`; derived `strategyDetails`, `subscriptionAmount`, `net_portfolio_updated`, `validOrderResults`, `totalInvested`.

**Actions:** `handleCardClick`, `getStrategyDetails`, `getSubscriptionData`.

**Risks:** EventEmitter listener subscribes on mount (`HOLDINGS_REFRESH`) — must clean up; axios in useEffect without cleanup → state-update leak warning if unmount mid-fetch; `totalInvested` calc depends on sorted-by-execDate `[0]` — if rebalanceHistory empty/malformed, zero but renders.

**SDK risk:** medium — extractable to `usePortfolioValue` hook.

### `src/components/ModelPortfolioComponents/MPInvestNowModal.js` (5364 lines — largest)

**Data deps:** `useTrade()`, `useConfig()`, `useGstConfig()`, axios (28+ endpoints: stripe, razorpay, cashfree, IIFL, Upstox, Angel One, Kotak, HDFC, Fyers, etc.), `useRef` (WebView, payment gateway refs), `RNIap` (Apple/Google IAP), `RazorpayCheckout`, `CFPaymentGatewayService`, PayU WebView, `DisclaimerModal`, AsyncStorage, Toast.

**Render:** Multi-step modal — plan selection → amount/duration → payment method → order summary → payment gateway WebView/SDK (Razorpay / Stripe / Cashfree / PayU / Kite).

**Proposed viewModel:** input (`visible`, `userEmail`, `broker`, `plans`, `latestRebalance`, `strategyDetails`, `plandata`, `selectedCard`); step tracker (`currentStep: 1..5`); selection (`selectedPlan`, `selectedDuration`, `selectedAmount`, `selectedPaymentMethod`, `selectedOffer`, `isOfferApplied`); pricing (`baseAmount`, `discountedAmount`, `gstAmount`, `totalAmount`); payment-gateway state per-gateway (orderId / clientSecret / transactionId / status / error); subscription type; UI flags (`isLoading`, `showDisclaimer`, `disclaimerAccepted`, `webViewUrl`).

**Actions:** `onClose`, `setCurrentStep`, `initPayment(amount, method)`, per-gateway `handle*Callback`, `confirmPayment`, `setShowPaymentFail`, `setPaymentSuccess`.

**Risks:** **MASSIVE** cross-cutting payment integrations (28+ axios calls; payload structures differ per gateway — high complexity); deeply nested WebView state (4+ gateway-specific state atoms — refactor to `paymentState: {gateway, orderId, clientSecret, ...}`); GST logic scattered (`withGst()`, `gstLabel()` in render; amounts calculated in multiple places); AsyncStorage for pending payment recovery (orphan order risk if user closes app mid-payment); EventEmitter `refreshEvent` order matters (must fire AFTER subscription confirmed).

**SDK risk: VERY HIGH** — payment integrations are a prime candidate for SDK absorption (abstract PG layer; signature verification in secure context). Post-Phase-I expect this modal to be partially or fully replaced. Break Phase I work into:
1. PG abstraction layer (`PaymentGatewayService`)
2. Step-based wizard (form-data validation)
3. Signature verification (backend-only post-migration)

### `src/components/ModelPortfolioComponents/MPCard.js` (554 lines)

**Data deps:** `useConfig()`, `useGstConfig()`, `useNavigation()`, `useRef(Animated.Value)` for height animation.

**Render:** Card with gradient header (logo, title, price), pricing-period buttons, stats grid (min investment, volatility, CAGR), action buttons (View More, Subscribe / Subscribed / Renew / Resubscribe), consent popup.

**Proposed viewModel:** input (`modelName`, `data`, `image`, `description`, `isSubscribed`, `subscriptionData`); pricing options + selection; status (`active` / `renew` / `expired` / `none`); volatility/CAGR consent state; animation `animatedHeight` ref + `isExpanded`.

**Actions:** `handleSubscribe`, `handleCardClick`, `handleConsentOpen`, `handleConsentAccept`, `setSelectedPricing`, `setIsExpanded`.

**Risks:** Animated.Value ref must be memoized (else animation breaks on re-render); subscription status logic fragile (`getSubscriptionStatus()` tries 2 sources — if misaligned, wrong badge shown — add logging); `ConsentPopup` is nested modal — consent state should be lifted to parent or React Context.

**SDK risk:** low–medium — pricing logic (`getPricingOptions`, `getCurrentPrice`, `getOriginalPrice`) extractable to `usePricingOptions` hook.

### `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` (2151 lines)

**Data deps:** `useTrade()`, `useConfig()` (`allowAfterHoursOrders`), axios (70+ endpoints: Angel One surveillance, Zerodha/Fyers/Dhan publishers, status-check-queue, model-portfolio-db-update, etc.), socket.io (158 — live LTP), WebView (Kite Publisher, broker auth), AsyncStorage (trade-recovery storage), `useZerodhaSymbolMap()`, `useModalStore()`, `moment`, EventEmitter.

**Render:** Modal — trade list `FlatList` (buy/sell, qty/price editable), total investment, exchange warnings, action buttons (Place Order / Cancel); nested WebView for Kite Publisher basket; broker-specific TPIN modals.

**Proposed viewModel:** input (`visible`, `dataArray`, `totalArray`, `confirmOrder`, `broker`, `userEmail`, `userDetails`, `strategyDetails`, `latestRebalance`, `calculatedPortfolioData`); live prices (`ltp`); trade editing (`editableData`); payment/order (`loading`, `paymentStatus`); publisher state (`isWebView`, `htmlContent`, `zerodhaStatus`, `zerodhaRequestType`, `zerodhaStockDetails`); surveillance (`surveillanceData`, `surveillanceLoading`); EDIS/TPIN modal flags.

**Actions:** `placeOrder`, `onCloseReviewTrade`, `setOpenSucessModal`, `setOrderPlacementResponse`, `handleZerodhaRedirect`, `handleFyersRedirect`, `checkAngelOneSurveillance`, `getLTPForSymbol`, `getCurrentPrice`.

**Risks:** Massive broker-specific branching in `placeOrder()` (7+ branches: IIFL, ICICI, Upstox, Angel One, Kotak, HDFC, Zerodha, Fyers, Dhan, DummyBroker — extract `brokerService(broker, payload)`); socket.io for live LTP (subscribes per-symbol, manages `failedSubscriptionsRef` — if modal unmounts mid-subscription, socket hangs); Zerodha Publisher form-submission flow fragile (HTML form + WebView injection); state machine for multi-step flows (race conditions); EDIS modal cascade (Zerodha sell rejection → DDPI flow → reopen RebalanceModal → call placeOrder again — state not rolled back between attempts).

**SDK risk: HIGHEST** — critical order-placement pipeline. Post-Phase-I expect:
1. Order variant tagging refactored to SDK (`computeTradeVariant` already extracted)
2. Broker auth + session validation abstracted to SDK
3. Publisher flows (Zerodha/Fyers) may move to backend SSR + WebView host
4. EDIS/TPIN flows may be absorbed into broker onboarding

Mark for potential SDK redesign; keep Phase I logic extraction minimal.

### `src/components/AdviceScreenComponents/RebalanceModal.js` (2650 lines)

**Data deps:** `useTrade()` (`brokerStatus`, `configData`, `userDetails`, `funds`), `useConfig()`, `useNavigation()`, axios (60+ endpoints: validate-broker-session, calculate-rebalance, process-trade, status-check-queue, publisher flows), socket.io (LTP), EventEmitter (`orderPlaced` listener), WebView (Kite Publisher), AsyncStorage, `useZerodhaSymbolMap()`, `useModalStore()`, `moment`, Toast.

**Render:** Wizard — Step 3 (review trades) → Step 4 (order summary) → Step 5 (submit + result); step progress bar; trade list with edit/remove; Publisher flows (WebView for Zerodha/Fyers); TPIN modals for EDIS.

**Proposed viewModel:** input (`visible`, `userEmail`, `broker`, `data`, `calculatedPortfolioData`); step tracker (`currentStep: 3..5`); trade state (`editableData`, `stockDetails`, `totalArray`); live prices (`ltp`, `restPrices`); payment/order (`loading`, `paymentStatus`, `showDummyBrokerModal`); publisher (`isWebView`, `htmlContent`, `zerodhaStatus`, `zerodhaStockDetails`, `showKitePublisher`, `publisherBasketItems`); EDIS/TPIN flags; result (`orderPlacementResponse`).

**Actions:** `startOrderPolling`, `stopOrderPolling`, `placeOrder`, `handleZerodhaRedirect`, `onCloseRebalanceModal`.

**Risks:** Order-polling orchestration (ref-based timer; if unmount during polling, timer continues — use AbortController or cleanup flag); broker-specific payload building still has 10+ branches in `placeOrder` (consolidate via `buildBrokerPayloadFields`); Zerodha Publisher state machine prone to race conditions; EDIS modal reopen loop (state not rolled back); socket.io + WebView + EventEmitter interleaving (3 async channels can fire out of sync).

**SDK risk: HIGHEST** — rebalance order submission hub. Post-Phase-I factorise:
1. Pre-submission validation (broker session, market hours, exchange availability)
2. Broker payload builder
3. Order submission + polling
4. EDIS/TPIN handling (may move to advisor-specific SDK)
5. Publisher flows (Zerodha/Fyers) — strong candidate for backend SSR

Very large refactoring scope post-Phase-I.

### `src/components/AdviceScreenComponents/RebalanceAdviceContent.js` (799 lines)

**Data deps:** `useTrade()`, axios (Angel One / Dhan / Zerodha EDIS-status), EventEmitter (`refreshEvent`), AsyncStorage, `moment`, `useNavigation()`.

**Render:** FlatList — carousel (horizontal) or list (vertical) of `RebalanceCard` per portfolio; empty state (Lottie); overlay modals (DDPI, AngleOne TPIN, Dhan TPIN, Fyers TPIN, OtherBroker, RecommendationSuccess).

**Proposed viewModel:** input (`type: 'home' | 'All'`, `userEmail`); data (`modelPortfolioStrategy`, `modelPortfolioRepairTrades`); derived `filteredAndSortedStrategies`; UI (`selectedTab`, `isSwitchOn`, `refreshing`, `isLoading`); trade metadata (`stockDetails`, `stockTypeAndSymbol`, `singleStockTypeAndSymbol`, `storedTradeType`, `types`); EDIS/TPIN states; result (`orderPlacementResponse`, `openSuccessModal`).

**Actions:** `onRefresh`, `renderPortfolioVerticalList`, `handleCloseDdpiModal`, `updateTradeType`.

**Risks:** EventEmitter listener (`refreshEvent`) cleanup needed; multiple EDIS-status fetches in 3 separate useEffect blocks (potential API storm on `userDetails` change); AsyncStorage `storedTradeType` doesn't propagate across tabs; `RebalanceCard` prop drilling (20+ props — needs context or custom hook).

**SDK risk:** medium — primarily data-aggregation + list-rendering. EDIS checks app-specific; may be absorbed into SDK onboarding.

---

## Summary of net surface counts (post-2026-05-02 audit pass)

| Verdict | Pre-pass | Post-pass | Notes |
|---|---|---|---|
| `clean-extract` (Drawer) | (TBD) | 4 + 3 (KH subfolder) + 2 (MP) = **9 newly classified** | + Phase F batch ready |
| `needs-logic-extraction` (Drawer/MP) | (TBD) | 4 (Drawer) + 1 (Account parent) + 8 (MP screens + modals) + 2 (StockAdvicesUI) + 1 (KitePublisherModal) = **16 newly classified** | Phases G + I |
| `defer` (cleanup) | 2 (Skeleton, BrokerOverlay) | 2 + 5 (Drawer dead code) + 1 (KH empty) = **8 total** | Cleanup PR candidates |
| `SDK-bound-skip` | ~30 | unchanged | Phase 3 lane |

**Total new in-scope:** ~25 surfaces newly classified (some `clean-extract`, most `needs-logic-extraction`). Adding to the ~88 from earlier audit gives **~113 surfaces in scope** across the design-system migration.

---

## Open follow-ups

1. **Update `DESIGN_COMPONENT_AUDIT.md`** — append a "2026-05-02 audit pass" section that cross-references this file. Each new row above should land as a row in the appropriate section (Drawer screens / KnowledgeHubScreen / StockAdvicesUI / MP-screen viewModel sketches). User will likely do this manually; this doc serves as the input.
2. **Cleanup PR** for the 8 `defer` files (orphans + empty + stub):
   - `src/screens/Drawer/investContext.js` (orphan)
   - `src/screens/Drawer/SubscriptionsScreen.js` (stub)
   - `src/screens/Drawer/use.js` (orphan)
   - `src/components/HomeScreenComponents/KnowledgeHubScreen/VideoPlayerModal.js` (empty file)
   - `src/components/BrokerOverlay.js` (already flagged — 0 imports)
   - `src/components/IgnoreStockCard.js` (already deleted in Phase D)
   - Plus check `src/screens/Drawer/CustomTabbar.js` and `CustomTabbarMPPerformance.js` for whether they're cleanup-candidates or design-kit candidates.
3. **Phase G migration order** (advice screens + drawer screens that aren't MP-coupled):
   - Lowest-risk first: Drawer `clean-extract` rows (`PrivacyPolicyScreen`, `TermandConditionsScreen`, `ProductCatalogScreen`, `ReviewScreen`, `CustomTabbarOrder`).
   - Then `needs-logic-extraction` Drawer rows: `BespokePerformanceScreen`, `IgnoreTradesScreen`, `PaymentHistoryScreen`, `DistributionRowGrid`.
   - Then KnowledgeHubScreen wrappers (`BlogScreen`, `VideoScreen`, `PdfScreen`).
   - Then `AccountSettingsScreen.js`.
   - Then `StockAdvicesUI/StockCard.js` and `BasketCard.js` (with `useBasketReconciliation` hook extraction).
4. **Phase I migration order** (MP + rebalance):
   - Clean-extracts first: `CustomTabbarMPPerformance`, `EmptyStateMP`.
   - Then `MPCard`, `ModelPFCard` (smaller components).
   - Then `ModelPortfolioScreen`, `MPPerformanceScreen` (screens).
   - Then modals — but BEFORE the big modals, decouple the EDIS/TPIN modal cascade (5 booleans → unified state). Without that, every MP modal inherits the same fragile cascade.
   - `MPInvestNowModal` (5364 lines, payment gateways) — break into PG abstraction layer + step-based wizard. **Highest SDK risk.**
   - `MPReviewTradeModal` + `RebalanceModal` (similar broker-specific logic — refactor to a shared `brokerService`). **Highest SDK risk.**
   - `RebalanceAdviceContent`.
5. **KitePublisherModal verified** as `needs-logic-extraction` (Phase I), NOT `SDK-bound-skip`. Audit-doc Section 7 row should be updated.
6. **MP modal cascade refactor** (mentioned in MPPerformanceScreen + RebalanceModal risks): the 5–7 EDIS/TPIN modal flags appear in multiple files, all manage the same flow. A pre-Phase-I refactor into a single `useEdisModalCascade` hook would dramatically reduce per-modal complexity.
