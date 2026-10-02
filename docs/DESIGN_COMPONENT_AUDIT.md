# Design System — Per-Surface Component Audit

> **Per-surface inventory + verdict matrix for the design-system migration.** Companion to `DESIGN_SYSTEM_ARCHITECTURE.md` (the design source of truth) and `DESIGN_MIGRATION_PROGRESS.md` (the chronological work log). Mirrors `PHASE3_BROKER_AUDIT.md` in spirit.
>
> **The migration order is derived from this table, not the other way around.** A row only moves to "in-flight" or "done" after its verdict is locked here. Don't migrate without a row.
>
> **Scope: this audit covers upstream `designs/default/` only.** As of Phase 3 of the whitelabel-sync work (2026-05-09), variant folders for non-default tenants live in per-tenant fork repos (Alphanomy, Zamzam, RGX, etc.), not upstream — so their per-surface verdict tables live in the fork repo's own audit doc, if any. Upstream's job is to ensure the **container-side viewModel + actions contract** is rich enough that any variant override can render the screen it needs. If a fork's variant override needs data the upstream container doesn't currently expose, that's an upstream change first (typically a row's verdict moves from `clean-extract` → `needs-logic-extraction` to widen the viewModel), then the fork's override consumes it. See `WHITELABEL_RECIPE.md`.

> **Cross-tracked composites (Courses/Webinars).** `composites.LiveRoom` and
> `composites.GumletPlayer` (`designs/default/composites/`) were added by the
> courses/webinars port and are audited primarily in
> `COURSES_WEBINARS_MOBILE_PORTING.md` (§4.2 / §4.5), not in the table below.
> 2026-06-19: `composites.LiveRoom` active-room presentation hardened to a
> full-screen RN `Modal` (parity with the web full-viewport webinar fix) — see
> `DESIGN_MIGRATION_PROGRESS.md` 2026-06-19 + `CHANGELOG.md`. `GumletPlayer`
> is already fluid (`width:100%, aspectRatio 16/9`) — no change.

## How to read this doc

Each surface (screen, modal, component, primitive) gets one row. Columns:

- **Surface** — file path or component name
- **Type** — `primitive` / `composite` / `screen` / `modal` / `container`
- **Data deps today** — what hooks/contexts/services it touches inline (this is the cost of splitting)
- **Proposed split** — what stays in `src/`, what moves to `designs/default/`
- **Verdict** — see verdict legend below
- **Notes**

### Verdict legend

| Verdict | Meaning |
|---|---|
| `clean-extract` | No data deps, pure presentation already (or close). Move to `designs/default/` as-is or with trivial container glue. |
| `needs-creation` | No shared component exists today — must be built fresh in `designs/default/primitives/`. Applies only to primitives. |
| `needs-logic-extraction` | Has data deps that must be lifted into a container before move. Standard split. |
| `SDK-bound-skip` | Phase 3 surface or SDK widget. Stays in `src/` (or SDK package). Never moves. |
| `SDK-pending` | Surface has an **active, committed SDK migration in flight** (a Phase 3 commit is open or imminent). DO NOT migrate to `designs/`. **As of 2026-05-01 the MP-freeze policy was lifted** — MP surfaces no longer get this verdict preemptively. They migrate alongside everything else; if the SDK MP plan firms up later, affected rows flip back to `SDK-pending` and the design work is unwound. |
| `defer` | Out of v1 scope for other reasons (e.g. dead code, scheduled removal, low-traffic edge case). Document why. |

### How to fill a row

1. Read the source file. Identify every hook call, context use, service call, AsyncStorage call, EventEmitter use.
2. Classify the surface (primitive / composite / screen / modal / container).
3. Decide the verdict. If `needs-logic-extraction`, sketch the props the presentation will receive (the viewModel shape) in **Notes**.
4. **MP surfaces are in scope as of 2026-05-01.** Verdict by data deps, not by MP-coupling. The earlier MP-freeze rule no longer applies. (Surfaces only get `SDK-pending` if a Phase 3 SDK migration is actively in flight for that exact surface.)
5. If the surface is a Phase 3 modal or SDK widget, verdict is `SDK-bound-skip`. No exceptions.

A row is **complete** when verdict is locked AND (for `needs-logic-extraction`) the proposed viewModel shape is documented. A row is **migrated** when the matching `designs/default/` file exists and the container has been split.

---

## Section 1 — Primitives (target: `designs/default/primitives/`)

The fixed catalog from `DESIGN_SYSTEM_ARCHITECTURE.md § Primitives`. **Phase C shipped 2026-05-01** — 9 primitives live in `designs/default/primitives/`, all registered in `designs/default/index.js`. Call-site updates remain opportunistic (no wholesale sweeps planned).

| Primitive | Status (post-Phase C) | Pre-existing call sites | File | Notes |
|---|---|---|---|---|
| `Text` | ✅ Shipped | 2,123 raw `<Text>` | `designs/default/primitives/Text.js` | Variants: `heading` / `title` / `subtitle` / `body` / `bodyEmphasis` / `caption` / `muted` / `button`. Reads typography role from tokens. |
| `Button` | ✅ Shipped | 1,248 raw `TouchableOpacity` / `Pressable` | `designs/default/primitives/Button.js` | Variants: `primary` / `secondary` / `ghost` / `destructive`. Wraps `TouchableOpacity` + auto-renders `Text variant="button"` for the label. |
| `Card` | ✅ Shipped | ~11 ad-hoc card-shaped containers | `designs/default/primitives/Card.js` | Variants: `default` (card shadow) / `elevated` (heavier shadow) / `outlined` (1px border). |
| `Input` | ✅ Shipped | 151 raw `TextInput` | `designs/default/primitives/Input.js` | Variants: `text` / `password` / `numeric` / `otp`. Auto-applies secureTextEntry / keyboardType / maxLength based on variant. |
| `Spinner` | ✅ Shipped | 199 raw `ActivityIndicator` | `designs/default/primitives/Spinner.js` | Variants: `inline` (bare ActivityIndicator) / `overlay` (full-screen scrim + centered spinner). |
| `Icon` | ✅ Shipped | 107+ lucide direct imports | `designs/default/primitives/Icon.js` | No variants. Caller passes the lucide component via `Component` prop (preserves Metro tree-shaking — a wildcard registry would force every lucide icon into the bundle). Default size 20, default color `tokens.colors.text.primary`. |
| `Pill` | ✅ Shipped | BUY/SELL badges + status tags (3–5 files) | `designs/default/primitives/Pill.js` | Variants: `neutral` / `profit` / `loss` / `warning`. Auto-sized to content via `alignSelf: 'flex-start'`. |
| `Divider` | ✅ Shipped | ad-hoc 1px Views (~5–10 instances) | `designs/default/primitives/Divider.js` | Variants: `solid` / `dashed`. |
| `Toast` | ✅ Shipped | `customToast.js` + 41 `Toast.show()` call sites | `designs/default/primitives/Toast.js` | Imperative API (not a component): `Toast.show(message, variant, options?)`. Wraps `react-native-toast-message`. Variants: `info` / `success` / `warning` / `error`. Existing `customToast.js` imports continue to work — no churn. |
| `ModalShell` | Deferred to Phase H | scattered RN `Modal` (~38 call sites) | — | Two existing shell candidates (`CrossPlatformOverlay`, `BrokerOverlay`) are SDK-bound or unused. Design fresh when first non-SDK-bound modal migrates (`DeleteAdviceModal` / `IgnoreAdviceModal`). Planned variants: `bottomSheet` / `fullScreen` / `centered`. |
| `Skeleton` | Deferred indefinitely | none | — | No current shimmer/skeleton loading-state in the codebase. Create on demand when a screen ships a designed loading state. |

**Call-site migration policy:** when a screen or component is touched for any reason, callers SHOULD migrate ad-hoc patterns to the matching primitive in the same commit. New code MUST use primitives. Wholesale sweeps (e.g. "replace every raw `<Text>`") are explicitly NOT scheduled — high-volume, regression-prone, no incremental user value over opportunistic migration.

**How to consume a primitive in new code:**

```js
// Direct import (always default variant — fastest in tests, fine in app code)
import Button from '../../designs/default/primitives/Button';
<Button variant="primary" label="Continue" onPress={...} />

// Via the registry (variant-aware — picks up custom-variant overrides if any)
import { useComponent } from '../design/useDesign';
const Button = useComponent('primitives.Button');
<Button variant="primary" label="Continue" onPress={...} />
```

For app code today (only `default` registered), both are equivalent. The registry path becomes meaningful when a tenant ships a custom variant.

---

## Section 2 — Composites (target: `designs/default/composites/`)

Domain-shaped, prop-driven. Phase D landed the first composite end-to-end on 2026-05-01.

| Surface | Today's location | Type | Data deps today | Verdict | Notes |
|---|---|---|---|---|---|
| **RebalanceDetailsModal** | `designs/default/composites/RebalanceDetailsModal.js` | composite | none (was `useConfig` for one color — replaced by `useTokens`) | ✅ **Migrated (Phase D, 2026-05-01)** | First composite shipped. 164 lines, single consumer (`UIComponents/RebalanceAdvicesUI/RebalanceCard.js`). Legacy `src/components/AdviceScreenComponents/RebalanceDetailsModal.js` deleted. Registered as `composites.RebalanceDetailsModal`. Uses `Button` / `Icon` / `Text` primitives + `useTokens()`. |
| ~~IgnoreStockCard~~ | (deleted 2026-05-01) | — | — | DELETED — dead code | Was originally Phase D's planned candidate; migration discovered zero consumers (the only import was a dead line in `IgnoreTradesScreen.js`, which actually renders `<StockAdvices type="Ignore" />`). Both legacy file and dead import removed in the same commit. |
| BrokerCard | `src/components/BrokerConnectCard.js` | composite | TBD | TBD — likely **dead code** | Spot-audit found 0 consumers. Verify and delete in a cleanup PR if confirmed orphan. |
| StockCard | `src/UIComponents/StockAdvicesUI/StockCard.js` | composite | `useTrade`, `useConfig`, `useNavigation`, `useModalStore` | `needs-logic-extraction` | 1293 lines — too large for Phase D. Phase G (Advice screens). 2 consumers (`StockAdviceContent.js`, `AdviceCartScreen.js`). |
| BasketCard | `src/UIComponents/StockAdvicesUI/BasketCard.js` + `designs/default/composites/BasketCard.js` | composite | Container: `useTrade`, reconciliation + basket policy; presentation: props/tokens only | ✅ **Migrated (Phase G; policy contract widened 2026-08-16)** | Container owns lifecycle resolver output, five-second entry authorization refresh and execution handoff. Presentation consumes `isCancelled`, `isClosed`, `isClosurePending`, `entryBlocked`, `entryChecking`, and `entryGateMessage`; it never infers policy from raw flags. One consumer (`StockAdviceContent.js`). |
| OrderRow / OrderItem | Defined inline in `src/screens/Home/OrderScreen.js` (~line 254) | composite | uses pure utils + parent props | `clean-extract` (after extraction from OrderScreen) | Already nearly pure — its only state is per-row `showReason` toggle. Will be extracted alongside OrderScreen migration in Phase E. |
| HoldingRow | TBD (search PortfolioScreen sub-renders) | composite | `useLTPStore` (likely) | TBD — extract during PortfolioScreen Phase F/G | Lives inside `PortfolioScreen.js` today (not extracted). |
| FloatingAcceptRebalanceButton | `src/components/FloatingAcceptRebalanceButton.js` | composite | rebalance-flow callbacks | `needs-logic-extraction` | Phase I (rebalance flow). Container owns the accept-rebalance dispatch; presentation is the floating button. |
| ReviewTradeModal (composite mode) | `src/components/ReviewTradeModal.js` | composite | `useConfig`, axios surveillance + SELL-impact preview APIs, AsyncStorage, EventEmitter | `needs-logic-extraction` | Imported from `StockAdvices.js` and `AddtoCartModal.js` (both non-MP). Container owns surveillance, model-impact preview/choice state and events; presentation receives viewModel + actions. Phase G. |
| SellModelImpactNotice | `src/components/AdviceScreenComponents/SellModelImpactNotice.js` | composite | pure props + `modelReductionPlan` | `clean-extract` after parent split | Warn-only radio card shared by direct and Zerodha review. Uses design literal tokens. Its future presentation receives notice/choice/model plus `onChoose`; preview/reservation and `modelAuthorization` stay in the parent container. |
| Checkbox | `src/components/AdviceScreenComponents/Checkbox.js` | primitive-shaped composite | none | `clean-extract` | 34 lines — almost too small to be a composite. 1 consumer (`RebalanceCard.js`). Migrate opportunistically when RebalanceCard is touched again. |
| RepairConfimationModal | `src/components/AdviceScreenComponents/RepairConfimationModal.js` | composite | none | `clean-extract` | 108 lines, pure modal. 1 consumer (`RebalanceAdvices.js`). Phase I. |

**Phase D learning logged in the audit:** orphan-component discovery happens at migration time, not always at audit time. The audit's verdict pass relied on file-level data-dep analysis but didn't verify consumer existence. Future audit passes (queued audit-tasks B, G) MUST confirm consumer count for every row before recommending it as a migration target.

---

## Section 3 — Screens (target: `designs/default/screens/`)

ViewModel sketches captured in the audit-task pass (2026-05-01). The `viewModel` shapes below are **proposed contracts** — they may tighten during the actual migration once each screen's container lands.

### HomeScreen

- **File:** `src/screens/Home/HomeScreen.js` (~2631 lines)
- **Verdict:** `needs-logic-extraction`
- **Phase:** E
- **Data deps:** `useTrade()` (8+ fields), `useConfig()`, `useFocusEffect`, `useNavigation`, `useSocialProof()`, ~17 `useState` declarations, 8+ `useEffect` blocks (FCM token, notification setup, rebalance repair fetch, video/PDF listeners, update check), inline axios calls, `EventEmitter` subscription, `messaging()` (Firebase), `notifee` permissions, `AsyncStorage`.
- **Render outputs:** Animated search header (gradient, collapsing), 3-tab nav (All / Bespoke / Rebalance), 6 conditional full-screen overlays (`seeAllBespoke` / `seeAllMP` / `seeAllMPplan` / `seeAllBlogs` / `seeAllVideos` / `seeAllPDFs`), main `Animated.FlatList` with bespoke recos + repair card + MP carousel + halal-stocks button + ethical-list modal + Knowledge Hub + video/PDF/blog carousels, Video/PDF modal players.
- **Proposed viewModel:**
  ```js
  {
    user: { email, displayName },
    config: { themeColor, mainColor, secondaryColor, gradient1, gradient2 },
    advices: { bespoke: [...], rebalanceRepair: [...] },
    holdings: [...],
    funds: { available, used },
    modelPortfolios: [{ id, name, latestRebalance, hasFailedTrades, matchingFailedTrades, userInvestmentAmount }],
    blogs: [...], videos: [...], pdfs: [...],
    plans: [...], notifications: { unread, items: [...] },
    flags: {
      isLoading, isRefreshing, showEthicalList, hasNewAppUpdate,
      activeModal: 'video' | 'pdf' | 'ethical' | 'update' | null,
      activeOverlay: 'bespoke' | 'mp' | 'mpPlan' | 'blogs' | 'videos' | 'pdfs' | null,
      selectedTab: 'All' | 'Bespoke' | 'Rebalance',
    },
  }
  ```
- **Proposed actions:** `toggleTab`, `openOverlay(name)`, `closeOverlay`, `openModal(name, data)`, `closeModal`, `acceptAdvice` / `rejectAdvice` / `ignoreAdvice` / `viewAdviceDetail`, `retryFailedRebalanceTrade`, `playVideo` / `closeVideoPlayer`, `viewPdf` / `downloadPdf` / `closePdfViewer`, `openEthicalList` / `searchEthicalList`, `refreshAllData`, `checkAppUpdate`, `goBack`, `openNewsScreen`, `navigateToAdviceScreen`.
- **Risks:** 8+ `useEffect` blocks with overlapping deps (cascading refetch risk). ~~Modal state scattered across 4 booleans → unify into `{ activeModal, activeModalData }`.~~ ✅ Done 2026-05-01 in `useHomeScreenModals` hook. ~~Extract `useHomeScreenTabs` hook (selectedTab + 7 see-all overlay booleans).~~ ✅ Done 2026-05-01. EventEmitter subscriptions for video/PDF requests fire from sibling components (`AdviceScreenComponents`); container must own listener lifecycle. Animated header with scroll interpolation uses `Animated.Value` — container can either hand the scroll handler to presentation or accept a non-animated header in v1. **Phase E prep refactor shipped** — HomeScreen now holds 2 hook calls instead of 12 useState declarations for tab/overlay/modal state. Phase E.2 unblocked.

### OrderScreen ✅ Migrated (Phase E.1, 2026-05-01)

- **Container:** `src/screens/Home/OrderScreen.js` (~120 lines after split — was 1195)
- **Presentation:** `designs/default/screens/OrderScreen.js` (registered as `screens.OrderScreen`)
- **Extracted composite:** `designs/default/composites/OrderRow.js` (registered as `composites.OrderRow`)
- **Extracted utils:** `src/utils/orderUtils.js` (`isToday`, `formatSymbol`, `formatOrderDate`, `getStatusColors`)
- **Dead code removed in same commit:** PanResponder + tab system + `imageUrl` / `isModalOpen` / `MODAL_STATE` EventEmitter listener — all unreachable in legacy. `renderStatusIcon` orphan helper. ~900 lines deleted.
- **Verdict:** `clean-extract` → ✅ migrated
- **Phase:** E.1 (shipped)
- **Data deps:** `useTrade()`, `useConfig()`, `useModalStore()` (Zustand `openModal`), `getAuth()` (Firebase), 17 `useState` declarations, 3 `useEffect` blocks (load trades, fetch advisor image, sort orders), `useMemo` for filtered orders, axios `api/user/trade-reco-for-user`, `eventEmitter` subscription on `MODAL_STATE`, `useRef` for tab pan animation, pure utility imports (`isOrderSuccess`, `isSellAuthRejection`, `getBrokerDdpiHelp`).
- **Render outputs:** Search row + filter expansion, `FlatList` of `OrderItem` rows (symbol + broker + buy/sell badge + qty/avg/exchange + timestamp + status badge + expandable rejection reason + DDPI help link on sell-auth failures), gradient empty state.
- **Proposed viewModel:**
  ```js
  {
    user: { email },
    config: { themeColor, mainColor, secondaryColor, gradient1, gradient2 },
    orders: [{ _id, Symbol, searchSymbol, Exchange, OptionType, Strike, Type, user_broker, trade_place_status, Lots, Quantity, AvgPrice, tradedPrice, tradedQty, purchaseDate, exitDate, orderStatusMessage, model_id, classification }],
    rejectedTrades: [...],
    filters: { searchText, lowPrice, highPrice },
    flags: { loading, isExpanded, activeTab },
    advisorImage: { url },
  }
  ```
- **Proposed actions:** `toggleOrderReason(id)`, `openOrderDetail(id)`, `updateSearchText` / `updateLowPrice` / `updateHighPrice` / `clearFilters` / `toggleFilterExpanded`, `openDdpiHelp(broker)` (routed via Zustand `openModal`), `refreshOrders`.
- **Risks:** 7-day filter math is inline in `getAllTrades` — extract to `src/utils/orderDateUtils.js`. `OrderItem` is defined inline as a const inside `OrderScreen`; extract to its own file in `designs/default/composites/OrderRow.js`. EventEmitter `MODAL_STATE` listener is murky — clarify what fires it before splitting.

### WatchlistScreen

- **File:** `src/screens/Home/WatchlistScreen.js` (~1253 lines)
- **Verdict:** `clean-extract`
- **Phase:** E or F
- **Data deps:** `useConfig`, `useTrade`, `useRoute`, `useFocusEffect` (reload watchlists on focus), 18+ `useState` declarations, `useRef` for `webSocket` (WebSocketManager singleton — shared service, not owned by this component), `useLTPStore()` (Zustand) inside `WatchlistRow`, `AsyncStorage` load/save (5 watchlist tabs), axios symbol search, `Toast`.
- **Render outputs:** Gradient header + back button, 5-tab strip, search bar with suggestions overlay, per-tab `FlatList` of `WatchlistRow` (symbol + company name + exchange + live LTP + change % + buy + delete), empty-state gradient card, delete confirm modal, edit-mode picker modal, toast notifications.
- **Proposed viewModel:**
  ```js
  {
    config: { themeColor, gradient1, gradient2 },
    watchlists: { 1: [{ id, symbol, name, companyName, exchange, advisedPrice, livePrice, changePercent, isPositive }], 2: [...], 3: [...], 4: [...], 5: [...] },
    search: { isOpen, query, suggestions: [...], isLoading },
    ui: { activeTab, fullScreen, showDeleteConfirm, selectedStockForDelete, editMode: { isOpen, selectedStock, targetWatchlistId }, showAlert },
    notifications: { isVisible, message, type },
  }
  ```
- **Proposed actions:** `switchTab(id)`, `openSearch` / `closeSearch` / `updateSearchQuery` / `selectSearchSuggestion` / `addToWatchlist`, `deleteStock` / `confirmDeleteStock` / `cancelDeleteStock`, `moveStock(from, to)` / `editStockTab` / `confirmEditStock`, `goBack`, `toggleFullScreen`, `dismissAlert` / `dismissToast`.
- **Risks:** AsyncStorage persistence in two `useEffect` blocks — container owns. WebSocket subscription is via `WebSocketManager` singleton (shared service) — read-only `useLTPStore` hook in `WatchlistRow` is safe to keep in presentation. Symbol search axios stays in container. Toast feedback is scattered — unify into one `{ message, type, visible }` state.

### PortfolioScreen

- **File:** `src/screens/PortfolioScreen/PortfolioScreen.js` (~600+ lines)
- **Verdict:** `needs-logic-extraction`
- **Phase:** F or G
- **Data deps:** `useTrade()` (`userDetails`, `getAllBrokerSpecificHoldings`, `BrokerHoldingsData`, `allHoldingsData`, `getAllHoldings`, `configData`), `useConfig`, `useNavigation`, 11+ `useState` declarations, 3+ `useEffect` blocks (WebSocket subscribe, model-portfolio strategy fetch, EventEmitter `OrderPlacedReferesh` listener), inline axios `axios.get` for MP strategies + `axios.request` for rebalance repair, Firebase `getAuth()`, `WebSocketManager` singleton, `formatCurrency` utility.
- **Render outputs:** Safe-area + gesture-handler-root wrapper, PortfolioCard (P&L + invested + returns), sticky tab switcher (Bespoke / Model Portfolio) via PortFolioCard2, Holdings `FlatList` with refresh control, conditional empty state, `HoldingScoreModal` bottom-sheet, 10+ broker-specific position-fetch branches (IIFL/ICICI/Upstox/Zerodha/Kotak/HDFC/Dhan/AliceBlue/Fyers/Groww/Motilal), live-price dynamic-text components. The summary is a display boundary: it rounds invested amounts to whole rupees and P&L to two decimals without mutating broker values used by calculations. It is a list header, not fixed chrome, and resolves the named broker account (or “Simulated portfolio — not a broker account”) in plain language. Portfolio-summary status badges consume the same `TradeContext` entitlement snapshot as plan cards, never their independent valuation response.
- **Proposed viewModel:**
  ```js
  {
    user: { email, brokerStatus: 'connected' | 'pending' | null, connectedBroker },
    holdings: [{ symbol, quantity, buyPrice, currentPrice, pl, plPercent, status }],
    summary: { totalInvested, totalCurrent, totalPL, totalPLPercent },
    availableFunds,
    subscribedModels: [{ modelName, advisor, repairTrades: [...] }],
    selectedTab: 0 | 1,
    isRefreshing,
    isLoadingScores,
    scoreModal: { visible, symbol },
  }
  ```
- **Proposed actions:** `onRefresh`, `onTabChange`, `onHoldingPress(symbol)`, `onViewScore(symbol)` / `onCloseScoreModal`, `onExecuteRepairTrade(trade)`.
- **Risks:** WebSocket subscription + EventEmitter listener cleanup must move with container. 10+ broker conditionals locked to container. Inline `formatCurrency` calls — pre-format in viewModel so presentation receives strings. Repair-trade flow brushes against MP-freeze; verify the **execution** path stays in container (or in MP-frozen surface) rather than in `designs/`.

### Authentication screens

| Screen | File | Verdict | Phase | viewModel highlights |
|---|---|---|---|---|
| **LoginScreen** | `src/screens/Authentication/LoginScreen.js` (~300+ lines) | `needs-logic-extraction` | F | `{ form: { email, password }, ui: { isPasswordVisible, isLoading, errorMessage, showError }, config: { logoComponent, themeColor, googleWebClientId } }`. Risks: `handlePostLoginNavigation` (~65 lines of orchestration) stays in container; Google/Apple sign-in branch points (Apple may hide email → fallback to `EmailScreenAppleLogin`); Firebase + storage utils + post-login `reloadConfigData` / `getAllTrades` / `getModelPortfolioStrategyDetails` chain. |
| **SignupScreen** | `src/screens/Authentication/SignupScreen.js` (~350+ lines) | `needs-logic-extraction` | F | `{ form: { email, name, password }, ui: { isPasswordVisible, isLoading, errorMessage, successMessage, termsAccepted, showTermsModal }, config: { logoComponent, themeColor } }`. Same orchestration shape as LoginScreen — ship together. |
| **ResetPassword** | `src/screens/Authentication/ResetPassword.js` (~150 lines) | `clean-extract` | F (first-shipped, confidence test) | `{ form: { email }, ui: { isLoading, errorMessage, isSuccess }, config: { logoComponent, themeColor } }`. Single Firebase `sendPasswordResetEmail` call. Lowest-risk migration in the screen catalog — recommended to ship first. |
| **SignUpRADetails** | `src/screens/Authentication/SignUpRADetails.js` (~200+ lines) | `needs-logic-extraction` | F | `{ form: { raId }, ui: { isLoading, statusMessage, isSuccessModalVisible, validationError }, config: { logoComponent, appName }, user: { email } }`. RA-ID validation regex can live in a util. Native Alert dialogs are a wrinkle — variant that wants custom modal styling needs alert callbacks from container. |
| **PhoneNumberScreen** | `src/screens/Authentication/PhoneNumberScreen.js` (~200+ lines) | `needs-logic-extraction` | F | `{ form: { email, phoneNumber, countryCode, userName, telegramId, showTelegram }, ui: { isLoading, profileCompletionPercent }, config: { logoComponent, appName } }`. Profile-completion math (`calculateProfileCompletion`) is pure logic — extract to util. |
| **LogOutScreen** | `src/screens/Authentication/LogOutScreen.js` (~100 lines) | `clean-extract` | F | `{ ui: { isLoggingOut }, config: { gradientColors } }`. Trivial — spinner + auto-fire logout on mount (Firebase `signOut` + `GoogleSignin.signOut` + AsyncStorage clear + 6 context-state resets). |
| **EmailScreenAppleLogin** | `src/screens/Authentication/EmailScreenAppleLogin.js` (~150 lines) | `clean-extract` | F | `{ form: { email }, ui: { isLoading }, config: { gradientColors } }`. Submit callback comes via `route.params.onSubmit` — container forwards. |
| **TermsModal** | `src/screens/Authentication/TermsModal.js` (~150 lines) | `clean-extract` | F | `{ termsData: [...], ui: { expandedIndex, isVisible } }`. Hardcoded terms data; only state is which section is expanded. Almost zero-risk extract. |

**Phase F migration order (recommended):** ResetPassword → EmailScreenAppleLogin + TermsModal → LogOutScreen → LoginScreen + SignupScreen (paired) → SignUpRADetails + PhoneNumberScreen (paired) → ChangeAdvisor (Account section).

### Account Settings screen

| Screen | File | Verdict | Phase | viewModel highlights |
|---|---|---|---|---|
| **AccountSettingsScreen** | `src/screens/Home/AccountSettingsScreen.js` | `needs-logic-extraction` | F (after ChangeAdvisor) | Builds account/insight menu items from `useTrade` and configuration gates; route targets must use the navigator's registered names. **2026-07-18:** the customer-facing “Change Manager” item now navigates to registered route `Advisor Change`; its label remains manager-facing copy. **2026-10-01:** menu STRUCTURE (sections, order, rows) now comes from the variant navigation manifest (`designs/<variant>/navigation.js` `moreMenu`, resolved by `src/navigation/resolveNavigation.js`); the container keeps only flag computation and row handlers. Delete Account / Log Out / legal rows are catalog-required. |
| **MainTabNavigator (tab structure)** | `src/components/Navigation.js` | `migrated (data manifest)` | 2026-10-01 | Tabs, order, labels, icons, first tab, tab-bar height come from the navigation manifest (`tabs` / `initialTab` / `chrome`), not JSX. Chrome still renders via `shell.AppHeader` / `shell.MainTabBar` (MainTabBar now honours `item.icon` + `viewModel.height`). See `CONFIGURABLE_NAVIGATION_DESIGN.md`. |
| **ChangeAdvisor** | `src/screens/AccountSettingScreen/ChangeAdvisor.js` (~250+ lines) | `needs-logic-extraction` | F (after primary auth) | `{ form: { currentRAId, newRAId }, ui: { isLoading, isInitialLoading, statusMessage }, user: { email } }`. RA-ID input formatting (uppercase + remove spaces) can live in presentation; validation + `updateRACodeAndConfig` + `RNRestart` stay in container. Native Alert dialogs → callbacks if a variant wants custom dialogs. |

### Model Portfolio screens (in scope as of 2026-05-01 — Phase I)

**Policy update:** previously frozen as `SDK-pending`; now in scope. Each row's verdict is provisional pending a viewModel-sketch audit-task pass before Phase I starts (audit-task G in the new queue below).

| Surface | File | Verdict (provisional) | Phase | Notes |
|---|---|---|---|---|
| ModelPortfolioScreen | `src/screens/Drawer/ModelPortfolioScreen.js` | `needs-logic-extraction` | I | Calls `ModelPortfolioService` + likely `useTrade`. ViewModel sketch needed before migration. |
| MPPerformanceScreen | `src/screens/Drawer/MPPerformanceScreen.js` | `needs-logic-extraction` | I | Performance data + chart fetching in container. |
| CustomTabbarMPPerformance | `src/screens/Drawer/CustomTabbarMPPerformance.js` | `needs-logic-extraction` | I | Tab navigation + per-tab data dispatch. |
| EmptyStateMP | `src/screens/Drawer/EmptyStateMP.js` | `clean-extract` | I | Static empty-state UI; only consumes config theme. |
| ModelPFCard | `src/screens/PortfolioScreen/ModelPFCard.js` | `needs-logic-extraction` | I | MP card on Portfolio screen; calls `ModelPortfolioService`. **2026-07-11:** container now also reads `useTokens().colors.mpCardColorCycle` + row `index` → passes a resolved `cardColor` into `viewModel.cardColor`. Default variant leaves the cycle `null` (no change); `moneyman_app` cycles green/blue/purple by row. Presentation applies `cardColor` as left-border accent + model-name tint. |

**Reminder**: if the SDK MP plan firms up before Phase I starts, these flip back to `SDK-pending` and Phase I is dropped instead. The risk is acknowledged; see `DESIGN_SYSTEM_ARCHITECTURE.md § Note on MP and the SDK`.

### Other Drawer screens (TBD — pending follow-up audit pass)

The `src/screens/Drawer/` folder has ~15 screens not covered by the 2026-05-01 audit pass. Each needs its own verdict. **Until audited, treat as out-of-scope.** Queued for the next audit pass before Phase G.

| Surface | File | Verdict | Notes |
|---|---|---|---|
| HistoryScreen | `src/screens/Drawer/HistoryScreen.js` | TBD | |
| MySubscriptionsScreen | `src/screens/Drawer/MySubscriptionsScreen.js` | TBD | Subscription / IAP flow — likely `needs-logic-extraction`. |
| AfterSubscriptionScreen | `src/screens/Drawer/AfterSubscriptionScreen.js` | TBD | |
| SubscriptionScreen | `src/screens/Drawer/SubscriptionScreen.js` | TBD | |
| TerminateStrategyModal | `src/screens/Drawer/TerminateStrategyModal.js` | TBD | If it's MP-coupled → `SDK-pending`. Audit. |
| TokenPurchaseModal | `src/screens/Drawer/TokenPurchaseModal.js` | TBD | |
| TradePnLScreen | `src/screens/Drawer/TradePnLScreen.js` | TBD | |
| UpdateEmailScreen | `src/screens/Drawer/UpdateEmailScreen.js` | TBD | |
| ProfileScreen | `src/screens/Drawer/ProfileScreen.js` | TBD | Likely tiny wrapper. |
| NotificationScreen | `src/screens/Drawer/NotificationScreen.js` | TBD | |
| PushNotificationScreen | `src/screens/Drawer/PushNotificationScreen.js` | TBD | |
| PaymentHistoryScreen | `src/screens/Drawer/PaymentHistoryScreen.js` + `designs/default/screens/PaymentHistoryScreen.js` | **migrated** | Container owns config, invoice/RIA fetches, PDF I/O and navigation. **2026-07-28:** viewModel adds `advisorLogo` + `advisorLogoFallback`; presentation owns the three-source image-error fallback. |
| ResearchReportScreen | `src/screens/Home/ResearchReportScreen.js` | TBD | Data fetch, merge/filter, and RNFS download remain screen-owned; 2026-07-28 asset-shape normalization is runtime logic, not a presentation migration. |
| NewsSearch / NewsScreen / WishSearch | `src/screens/Drawer/NewsSearch.js` etc. | TBD | |
| ManageConnectionsModal | `src/screens/Drawer/ManageConnectionsModal.js` | **`SDK-bound-skip`** | Phase 3 surface — drives reauth routing, owned by Phase 3 contract. |
| DisconnectBrokerModal | `src/screens/Drawer/DisconnectBrokerModal.js` | **`SDK-bound-skip`** | Phase 3 surface. |
| BrokerConnectionError | `src/screens/Drawer/BrokerConnectionError.js` | **`SDK-bound-skip`** | Phase 3 surface. |
| ModifyInvestment1 | `src/screens/Drawer/ModifyInvestment1.js` | TBD — likely `needs-logic-extraction` (Phase I if MP-coupled, else G). Audit. | |
| stepGuideModal | `src/screens/Drawer/stepGuideModal.js` | TBD | Onboarding-ish. Probably `clean-extract`. |
| PositionLTPText | `src/screens/Drawer/PositionLTPText.js` | TBD | Live-price text wrapper — likely `clean-extract` (uses Zustand LTP store, read-only). |
| QuotesCorousel | `src/screens/Drawer/QuotesCorousel.js` | TBD | |
| RebalanceNotificationComponent | `src/screens/Drawer/RebalanceNotificationComponent.js` | likely `needs-logic-extraction` | Phase I (rebalance flow). Audit before migrating. |
| PlacedOrderLoadingCard | `src/screens/Drawer/PlacedOrderLoadingCard.js` | TBD | Probably `clean-extract`. |

---

### SDK widget slots (design passthrough, 2026-10-01)

| Surface | Location | Verdict | Notes |
|---|---|---|---|
| SDK slots `sellAuthGate`, `brokerCredentialForm`, `brokerWebViewHeader`, `modifyInvestmentSheet`, `rebalancePnlChoice`, `kitePublisherHeader` | `designs/<variant>/sdk/` → `AqSdkProvider components` | `SDK-bound-skip` for logic; presentation overridable | Wired in SDK `7dc0fda`. Presentation-only contracts (`SDK_DESIGN_PASSTHROUGH.md § 9`). Default registry maps headers + P&L choice to `null` (SDK built-in). `brokerSelectionList` reserved (no SDK widget). |

## Section 4 — Modals (target: `designs/default/composites/` or `designs/default/screens/`)

Most modals are independent surfaces. Modal-shell consolidation is **deferred to Phase H** (the only existing "shell" candidates are `CrossPlatformOverlay` — used 14× but exclusively in SDK-bound BrokerConnectionUI surfaces — and `BrokerOverlay` — defined but unused).

### Modal-shell consolidation findings (audit-task #11)

| Modal candidate | Prop signature | Wraps | Call sites | Verdict |
|---|---|---|---|---|
| **`BottomSheetModal.js`** | n/a (file refers to form content, not a shell) | — | — | not a shell |
| **`CrossPlatformOverlay.js`** | `{ children, visible, onClose }` | iOS: `FullWindowOverlay` (`react-native-screens`); Android: `View` with `absoluteFillObject` + BackHandler | 14 imports — ALL in `BrokerConnectionUI/*` or legacy `BrokerConnectionModal/*` | **`SDK-bound-skip`** — stays in `src/`, never moves. |
| **`BrokerOverlay.js`** | `{ children, visible, onClose }` | iOS: `FullWindowOverlay`; Android: RN `Modal` with `transparent`, `fade` | **0 imports** | **DELETED** 2026-05-02 — confirmed orphan; cleanup PR. |

**Recommendation:** Do NOT extract `ModalShell` from these candidates. When the first non-SDK-bound modal migrates in Phase H (`DeleteAdviceModal` / `IgnoreAdviceModal` / etc.), design `ModalShell` fresh in `designs/default/primitives/ModalShell.js` with props `{ visible, onClose, children, variant: 'bottomSheet' | 'fullScreen' | 'centered' }`. Until then, scattered RN `Modal` direct usage (~38 imports) coexists.

### Per-modal verdicts

| Surface | Today's location | Verdict | Notes |
|---|---|---|---|
| **Phase3SdkBrokerModal** | `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js` | **`SDK-bound-skip`** | Phase 3 surface. Visual chrome (backdrop, header) MAY be themed via primitives, but the form rendering stays SDK-owned. |
| **All `src/components/BrokerConnectionModal/*` legacy modals** | per file | **`SDK-bound-skip`** | Scheduled for deletion as Phase 3 reaches 100% — see `PHASE3_PROGRESS.md`. Do not invest design-system work here. |
| **All `src/UIComponents/BrokerConnectionUI/*`** | per file (12 files) | **`SDK-bound-skip`** | Same — die with the legacy lane. |
| BrokerSelectionModal | `src/components/BrokerSelectionModal.js` | `needs-logic-extraction` | Pre-Phase-3 entry point. Container takes broker list from config. |
| BasketTradeModal | `src/components/BasketTradeModal.js` | `needs-logic-extraction` | |
| BottomSheetModal | `src/components/BottomSheetModal.js` | TBD (audit during Phase H) | Filename misleading — not a shell. |
| ~~BrokerOverlay~~ | ~~`src/components/BrokerOverlay.js`~~ | **DELETED** 2026-05-02 | Confirmed 0 imports; cleanup PR. |
| CrossPlatformOverlay | `src/components/CrossPlatformOverlay.js` | **`SDK-bound-skip`** | All 14 call sites are SDK-bound. Stays as SDK support utility. |
| DdpiModal | `src/components/DdpiModal.js` | `needs-logic-extraction` | EDIS/TPIN flow. Container stays in `src/`, presentation moves. |
| DeleteAdviceModal | `src/components/DeleteAdviceModal.js` | `needs-logic-extraction` | |
| GttDetailsModal | `src/components/GttDetailsModal.js` | `needs-logic-extraction` | |
| GttSuccessModal | `src/components/GttSuccessModal.js` | `clean-extract` (likely) | Audit during Phase H. |
| HoldingsMigrationModal | `src/components/HoldingsMigrationModal.js` | `needs-logic-extraction` | |
| IgnoreAdviceModal | `src/components/IgnoreAdviceModal.js` | `needs-logic-extraction` | |
| MPReviewTradeModal | `src/components/ModelPortfolioComponents/MPReviewTradeModal.js` | `needs-logic-extraction` | Phase I. Trade-review flow; container owns trade payload + axios. |
| RebalanceModal | `src/components/AdviceScreenComponents/RebalanceModal.js` | `needs-logic-extraction` | Phase I. Largest modal in this set (~91 KB). Container owns rebalance decryption + trade orchestration. **High SDK-migration risk** — if MP moves to SDK, this is the most likely thrown-away surface. |
| RebalanceAdviceContent | `src/components/AdviceScreenComponents/RebalanceAdviceContent.js` | `needs-logic-extraction` | Phase I. Container owns useTrade + DdpiModal coordination + RebalanceCard render orchestration. |
| RebalancePreferenceModal | `src/UIComponents/RebalanceAdvicesUI/RebalancePreferenceModal.js` | `needs-logic-extraction` | Phase I. |
| RebalanceCard | `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` | `needs-logic-extraction` | Phase I. Calculate-rebalance UX — high SDK-migration risk if MP moves to SDK. The 2026-09-28 SELL-retry badge now uses resolved color/typography tokens; the surrounding legacy presentation remains pending extraction. |
| StepProgressBar (rebalance) | `src/UIComponents/RebalanceAdvicesUI/StepProgressBar.js` | `clean-extract` | Phase I. All 4 import sites are MP/rebalance flows but the component itself is a pure step UI. Migrates with the rest of the rebalance set. |
| ReviewTradeModal | `src/components/ReviewTradeModal.js` | `needs-logic-extraction` | Imported from `StockAdvices.js` (non-MP) and `AddtoCartModal.js` (non-MP). Surveillance + SELL-impact preview APIs and EventEmitter stay container-owned. Phase G. |
| TokenExpireBrokerModal | `src/components/TokenExpireBrokerModal.js` | `needs-logic-extraction` | |
| iiflmodal / iiflproceedmodal | `src/components/iifl*.js` | `needs-logic-extraction` | IIFL on legacy lane (Phase 3 audit). Audit during Phase G to see if Phase 3 will eat them first. |
| IIFLReviewTradeModal | `src/components/IIFLReviewTradeModal.js` | `needs-logic-extraction` | Same as above. |
| customToast | `src/components/customToast.js` | `clean-extract` | Becomes `Toast` primitive (Section 1). |
| GlassmorphicText | `src/components/GlassmorphicText.js` | candidate primitive variant | Either a `Text` variant (`heading-glass`) or a separate primitive. Decide during Phase C. |

---

## Section 5 — `src/components/AdviceScreenComponents/` (20 files)

| File | Verdict | Reason | Data deps |
|---|---|---|---|
| AddtoCartModal.js | `needs-logic-extraction` | Phase I (renders MP modals — migrate together). | `useTrade`, `useConfig`, `ModelPortfolioComponents` |
| AdviceCartScreen.js | `clean-extract` | Pure listing, only native + `FlatList` | — |
| Checkbox.js | `clean-extract` | Pure checkbox primitive | — |
| DummyBrokerHoldingConfirmation.js | `needs-logic-extraction` | Calls useTrade, portfolioEvents, network | `useTrade`, `portfolioEvents`, axios |
| EducationalCard.js | `clean-extract` | Pure card display, local state only | — |
| EducationalContent.js | `clean-extract` | Tab UI with `useState`, no external hooks | — |
| MPStatusModal.js | `needs-logic-extraction` | Phase I. Embedded in rebalance flow. | `useTrade`, `useConfig`, `useWebSocketCurrentPrice` |
| NewsCard.js | `clean-extract` | Pure props-driven card | — |
| RebalanceAdviceContent.js | `needs-logic-extraction` | Phase I. Orchestrates rebalance flow. | `useTrade`, `DdpiModal`, `RebalanceCard`, MP components |
| RebalanceAdvices.js | `needs-logic-extraction` | Phase I. Orchestrates entire rebalance-advices surface. | `useTrade`, `RebalanceModal`, `RecommendationSuccessModal`, `BrokerConnectModalDispatch` |
| RebalanceDetailsModal.js | `clean-extract` | Phase I (migrates with the rest of the rebalance set). | `useConfig` only. Earlier "borderline" flag resolved — even though name suggests rebalance coupling, the component itself is a pure modal shell and the policy now allows MP migration anyway. |
| RebalanceModal.js | `needs-logic-extraction` | Phase I. **High SDK-migration risk** — decryption + trade orchestration is the core SDK candidate. | `useTrade`, portfolioEvents, eventEmitter, services |
| ref.js | `clean-extract` | (Phase D candidate, low priority — utility WebView shell) | — |
| RepairConfimationModal.js | `clean-extract` | Phase I (migrates with the rest of the rebalance set). | Earlier "borderline" flag resolved — pure confirmation UI; MP-coupling no longer disqualifies. |
| ReviewTradeText.js | `needs-logic-extraction` | Phase G or I. | `useLTPStore` (Zustand), socket.io price feed |
| ReviewTradeTextRebalance.js | `needs-logic-extraction` | Phase I (rebalance variant of ReviewTradeText). | `useLTPStore`, socket.io |
| StockAdviceContent.js | `needs-logic-extraction` | useTrade, eventEmitter, LTP websocket, trade state | `useTrade`, `useConfig`, eventEmitter, `useLTPStore` |
| StockAdvices.js | `needs-logic-extraction` | useTrade, eventEmitter, orchestrates stock-advice flow with broker dispatch | `useTrade`, `useConfig`, useCart, FunctionCall services. Renders `Phase3SdkBrokerModal` inline — that render stays unchanged; only surrounding UX migrates. |
| StockCardLoading.js | `needs-logic-extraction` | useModal, socket.io live data | `useModal`, socket.io |
| websocketPriceMP.js | `clean-extract` (utility, not UI) | Pure WebSocket stream-handling utility (no state) | — |

**Net for AdviceScreenComponents (post-MP-unfreeze 2026-05-01):** 8 `clean-extract`, 11 `needs-logic-extraction`, 1 utility (`websocketPriceMP.js` — not UI). Zero frozen.

---

## Section 6 — `src/components/HomeScreenComponents/` (14 files + KnowledgeHubScreen subfolder)

| File | Verdict | Reason | Data deps |
|---|---|---|---|
| AllEducationalBlogs.js | `clean-extract` | Pure `FlatList` render of props | — |
| AllEducationalPDF.js | `clean-extract` | Pure `FlatList` + download UI, useState only | — |
| AllEducationalVideos.js | `clean-extract` | Pure YouTube list render | — |
| AllPlansDetails.js | `needs-logic-extraction` | useTrade, useGstConfig; fetches plan list | `useTrade`, `useGstConfig`, `useNavigation`, axios |
| AlphaQuarkBanner.js | `needs-logic-extraction` | useTrade, renders ProfileModal | `useTrade`, `useNavigation` |
| BestPerformerscard.js | `needs-logic-extraction` | useTrade, fetches top performers | `useTrade`, FunctionCall services |
| BestPerformerSection.js | `needs-logic-extraction` | useTrade, renders PriceText (price feed) | `useTrade`, `useNavigation`, EventEmitter |
| EducationalBlogs.js | `needs-logic-extraction` | useTrade for content fetch | `useTrade` |
| EducationalPDF.js | `needs-logic-extraction` | useTrade + file download | `useTrade`, axios, `RNFS`, `Share` |
| EducationalVideos.js | `needs-logic-extraction` | useTrade for video fetch + YouTube embed | `useTrade`, useWindowDimensions |
| ExploreSection.js | `clean-extract` | Pure listing, no context | — |
| KnowledgeHub.js | `needs-logic-extraction` | useTrade; routes to educational sub-screens | `useTrade`, `useNavigation` |
| MarketIndices.js | `needs-logic-extraction` | useTrade; live market data | `useTrade` |
| PlanCard.js | `needs-logic-extraction` | useConfig, useGstConfig for pricing | `useConfig`, `useGstConfig` |

**Net for HomeScreenComponents:** 4 `clean-extract`, 10 `needs-logic-extraction`. The `KnowledgeHubScreen/` subfolder is queued for a follow-up audit pass.

---

## Section 7 — `src/components/ModelPortfolioComponents/` (20 files)

**Policy update 2026-05-01: MP-freeze lifted.** All 20 files are now in scope, with verdicts based on actual data deps. Phase I migrates these last so the rest of the app's pattern is settled before tackling MP's complexity.

| File | Verdict | Phase | Data deps | Notes |
|---|---|---|---|---|
| ConsentPopUp.js | `clean-extract` | I | — | Pure modal/popup. |
| DatePickerSection.js | `clean-extract` | I | — | Pure date-picker UI. |
| DigioModal.js | `needs-logic-extraction` | I | `useConfig` + WebView/Digio flow | Container owns Digio handshake; presentation is the WebView shell + status. |
| DigioSuccessModal.js | `clean-extract` | I | `useConfig`, Toast | Toast becomes a primitive in Phase C; useConfig→useTokens. |
| DisclaimerModal.js | `clean-extract` | I | — | Static text + accept button. |
| KitePublisherModal.js | `needs-logic-extraction` | I | broker order execution flow | **Verify before migrating** — if this proxies a broker SDK call, may need to stay in `src/`. Audit during Phase I prep. |
| MPCardBespoke.js | `needs-logic-extraction` | I | `useNavigation` | Container holds navigation, presentation is card layout. |
| MPCard.js | **migrated** | I | `useTrade`, `useGstConfig`, `useConfig` | Container supplies plan/pricing/config data to `designs/default/composites/MPCard.js`. **2026-07-28:** container owns remote-image failure state; presentation reports `actions.onImageError` and renders `fallbackImage`. |
| MPInvestNowModal.js | **migrated** | I | `useTrade`, `useConfig`, `useGstConfig`, axios, Razorpay, Cashfree, PayU, RNIap, Digio | **Migrated 2026-05-02.** Largest MP modal (5364 LOC). Container at `src/components/ModelPortfolioComponents/MPInvestNowModal.js` owns ALL payment gateway SDKs (Razorpay, Cashfree, PayU, Apple IAP, Google Play), ALL payment callbacks/state, ALL API calls, Digio e-signature, coupon validation, subscription creation, investment amount math. Presentation at `designs/default/screens/MPInvestNowModal.js` renders the 3-step wizard (Personal Info / Investment+KYC / Plan Selection), plan cards, coupon input, GST breakdown, consent checkbox, disclaimer modal, Digio modal shell, PayU WebView shell, Telegram collection modal, Digio success modal. Payment SDKs NEVER touched by presentation. Registered as `screens.MPInvestNowModal`. |
| MPReviewTradeModal.js | `needs-logic-extraction` | I | `useConfig`, axios | Trade-review for MP; container handles trade payload, presentation renders the review table. |
| PaymentSuccessModal.js | `clean-extract` | I | — | Static success UI. |
| PendingOrdersModal.js | `clean-extract` | I | — | List render of orders passed via props. |
| PerformanceChart.js | `needs-logic-extraction` | I | `useTrade`, `useConfig`, axios | Chart data fetched in container; presentation is the chart component. |
| PerformanceDisclaimer.js | `clean-extract` | I | — | Static disclaimer text. |
| PricingCard.js | `needs-logic-extraction` | I | `useConfig`, `useGstConfig` | Pricing math in container, presentation is the card. |
| RebalanceTimelineModal.js | `clean-extract` | I | — | Timeline UI from props. |
| RecommendationSuccessModal.js | `needs-logic-extraction` | G or I | `useConfig`, `useModal` | Cross-imported by 5 non-MP advice surfaces (`StockAdvices`, `RebalanceAdvices`, `RebalanceAdviceContent`, `StockAdviceContent`, `AddtoCartModal`). Migrate alongside Phase G advice screens; the same presentation serves MP and non-MP success cases. |
| TelegramCollectionModal.js | `clean-extract` | I | `useConfig` | useConfig→useTokens; otherwise pure form. |
| UserStrategySubscribeModal.js | `needs-logic-extraction` | I | `useTrade`, axios, WebView | Subscription flow with WebView broker step; container owns the orchestration. |
| VerificationMethodCheck.js | `clean-extract` | I | `useConfig` | useConfig→useTokens; otherwise method-picker UI. |

**Net for ModelPortfolioComponents:** 9 `clean-extract`, 11 `needs-logic-extraction`. Zero frozen.

If the SDK MP plan firms up before Phase I starts (or mid-flight), affected rows flip to `SDK-pending` and the migration unwinds for those surfaces.

---

## Section 7c — Asset tokens (Phase 2 — whitelabel sync, 2026-05-09)

Variant-overridable static images. Implementation at `src/theme/assets.js`; registry surface at `designs/default/tokens/index.js`; consumed via `useTokens().assets.<key>`.

| Slot | Default value | Status | Consumers (designs/-side) |
|---|---|---|---|
| `logoPng` | `src/assets/logo.png` (AlphaQuark) | live (Phase 2) | LoginScreen, SignupScreen, ResetPassword |
| `logoFadedPng` | `src/assets/fadedlogo.png` | live (Phase 2) | ChangeAdvisor, BasketCard |
| (future) `splashPng` | TBD | not yet shipped | SplashScreen — out of Phase 2 scope |
| (future) `appIconPreviewPng` | TBD | not yet shipped | — |

`src/`-side direct imports of the same files (`src/components/SplashScreen.js`, `src/components/HomeScreenComponents/PlanCard.js`, `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`, `src/utils/Config.js`, `src/context/ConfigContext.js`) intentionally NOT migrated in Phase 2 — those sit either outside the variant-resolution path (SplashScreen renders pre-providers) or already theme via `configData.logo` from ConfigContext. They migrate in a later pass if/when split into container + presentation.

---

## Section 7b — `src/components/Navigation.js` (out-of-scope plumbing)

`Navigation.js` is the React Navigation root (Stack + Drawer + Tab). It is NOT a UI surface in the design-system sense — variants don't override the navigator structure, they override the screens *behind* it.

| File | Verdict | Notes |
|---|---|---|
| `src/components/Navigation.js` | **`out-of-scope-plumbing`** (not in `designs/`) | Render-stable Tab.Screen `component` prop convention applies. Inline render-prop children are forbidden — they remount the nested screen tree on every parent render and would manifest as state-loss in variant presentations. See `DESIGN_SYSTEM_ARCHITECTURE.md § Navigator convention`. The `PlansTabWrapper` hoist (2026-05-09) was the first enforcement of this rule. |

Adding a new tab/screen to `Navigation.js` does NOT require a design-audit row — but the navigator-convention check above is mandatory at code-review time.

---

## Section 8 — UIComponents folder

`src/UIComponents/` is partially presentation-only — but most subfolders are SDK-bound or MP-frozen.

| Subfolder | Files | Verdict | Notes |
|---|---|---|---|
| `BrokerConnectionUI/` | 12 broker-specific UIs (AliceBlue, AngelOne, Dhan, Fyers, HDFC, ICICI, Kotak, Motilal, Upstox, Zerodha + DhanOAuth) + `HelpUI/` | **`SDK-bound-skip`** | Back the legacy broker modals (Phase 3 SDK is replacing). Will be deleted as Phase 3 reaches 100%. |
| `RebalanceAdvicesUI/` | RebalanceCard, RebalancePreferenceModal, StepProgressBar | mixed (Phase I) | RebalanceCard + RebalancePreferenceModal → `needs-logic-extraction`; StepProgressBar → `clean-extract`. All migrate in Phase I. High SDK-migration risk for the first two if MP moves to SDK. |
| `StockAdvicesUI/` | StockCard (`AdviceRow`), BasketCard | mixed: StockCard `needs-logic-extraction`; BasketCard migrated | BasketCard container/presentation split is live and its basket-policy viewModel was widened on 2026-08-16. StockCard remains queued. |

---

## Section 9 — Audit-task pass log (2026-05-01)

The 11 audit tasks from the initial draft of this doc were the gate before any Phase A code. Status:

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Primitive inventory pass | **Done** | Section 1 filled. 8 `needs-creation`, 1 `clean-extract` (Toast), 1 `defer` (Skeleton), 1 deferred to Phase H (ModalShell). |
| 2 | HomeScreen viewModel sketch | **Done** | Section 3 § HomeScreen. Verdict: `needs-logic-extraction`. |
| 3 | OrderScreen viewModel sketch | **Done** | Section 3 § OrderScreen. Verdict: `clean-extract`. |
| 4 | PortfolioScreen viewModel sketch | **Done** | Section 3 § PortfolioScreen. Verdict: `needs-logic-extraction`. |
| 5 | Authentication screens viewModel sketch | **Done** | Section 3 § Authentication. 4 `clean-extract`, 4 `needs-logic-extraction`. |
| 6 | AdviceScreenComponents per-file audit | **Done** | Section 5 — 20 files audited. |
| 7 | HomeScreenComponents per-file audit | **Done** | Section 6 — 14 files audited. `KnowledgeHubScreen/` subfolder queued for next pass. |
| 8 | ModelPortfolioComponents per-file audit | **Done** | Section 7 — all 20 frozen. |
| 9 | StepProgressBar usage audit | **Done** | All 4 import sites are MP/rebalance — `SDK-pending`. |
| 10 | ReviewTradeModal usage audit | **Done** | Imported from `StockAdvices.js` + `AddtoCartModal.js` (both non-MP) — `needs-logic-extraction`. (Note: `MPReviewTradeModal` is a separate file in `ModelPortfolioComponents/` and stays frozen; `IIFLReviewTradeModal` is its own file too.) |
| 11 | Modal-shell consolidation audit | **Done** | No consolidation candidate today. `ModalShell` deferred to Phase H — design fresh when first non-SDK-bound modal migrates. |

### New audit-task queue (post-2026-05-01)

These open up after Phase A/B/C land:

- A. **Drawer screens audit** — 15+ surfaces in `src/screens/Drawer/` (see Section 3 § Other Drawer screens). Run before Phase G.
- B. **Composite catalog audit** — `BrokerCard`, `AdviceRow`, `BasketCard`, `IgnoreStockCard`, `HoldingRow`, `OrderRow`, `RebalanceCard`. Run during Phase D prep.
- C. **`KnowledgeHubScreen/` subfolder audit** — files inside `src/components/HomeScreenComponents/KnowledgeHubScreen/`. Run before Phase G.
- D. ~~RebalanceDetailsModal + RepairConfimationModal call-site verification~~ — **resolved 2026-05-01** by the MP-unfreeze policy change. Both confirmed `clean-extract`, migrate in Phase I with the rest of the rebalance set.
- E. **`AccountSettingScreen/` audit** — `AccountSettingsScreen.js` itself (the parent), plus any other files in `src/screens/AccountSettingScreen/`. Currently only `ChangeAdvisor.js` is audited.
- F. **`UIComponents/StockAdvicesUI/` deeper audit** — `StockCard`, `BasketCard` props inventory + viewModel sketches before they become first migrated composites in Phase D.
- G. **MP-screen viewModel sketches** (post-2026-05-01 — opens up because of MP-unfreeze). For `ModelPortfolioScreen`, `MPPerformanceScreen`, `CustomTabbarMPPerformance`, `EmptyStateMP`, `ModelPFCard`, `ModelPortfolioComponents/MPInvestNowModal`, `MPCard`, `RebalanceModal`, `RebalanceAdviceContent`, `MPReviewTradeModal`. Run before Phase I starts.
- H. **KitePublisherModal verification** — confirm whether it proxies a broker SDK call (in which case it stays in `src/`) or is purely UX (in which case `needs-logic-extraction` for Phase I). Run during Phase I prep.

---

## Verdict tally — 2026-05-01 (post-MP-unfreeze)

| Verdict | Count | Notes |
|---|---|---|
| `clean-extract` | ~30 | Includes Toast (primitive), simple modals, OrderScreen, WatchlistScreen, ResetPassword, EmailScreenAppleLogin, TermsModal, LogOutScreen, HoldingScoreModal, EmptyStateMP, RebalanceDetailsModal, RepairConfimationModal, StepProgressBar, several MP modals (ConsentPopUp, DatePickerSection, DigioSuccessModal, DisclaimerModal, PaymentSuccessModal, PendingOrdersModal, PerformanceDisclaimer, RebalanceTimelineModal, TelegramCollectionModal, VerificationMethodCheck), several AdviceScreenComponents (Checkbox, NewsCard, EducationalCard, EducationalContent, AdviceCartScreen, ref, websocketPriceMP), 4 HomeScreenComponents leaves. |
| `needs-creation` | 0 (was 8 pre-Phase-C) | All 8 `needs-creation` primitives shipped 2026-05-01: Text, Button, Card, Input, Spinner, Icon, Pill, Divider. Plus Toast (was `clean-extract`). 9 total live in `designs/default/primitives/`. |
| `needs-logic-extraction` | ~50 | All non-MP screens with data deps (HomeScreen, PortfolioScreen, LoginScreen, SignupScreen, SignUpRADetails, PhoneNumberScreen, ChangeAdvisor) + standalone modals (BrokerSelectionModal, BasketTradeModal, DdpiModal, DeleteAdviceModal, GttDetailsModal, HoldingsMigrationModal, IgnoreAdviceModal, ReviewTradeModal, TokenExpireBrokerModal, iifl modals × 3) + advice components with data deps (DummyBrokerHoldingConfirmation, ReviewTradeText, StockAdviceContent, StockAdvices, StockCardLoading) + HomeScreenComponents data-bound (AllPlansDetails, AlphaQuarkBanner, BestPerformerscard, BestPerformerSection, EducationalBlogs, EducationalPDF, EducationalVideos, KnowledgeHub, MarketIndices, PlanCard) + **all MP needs-logic-extraction rows**: ModelPortfolioScreen, MPPerformanceScreen, CustomTabbarMPPerformance, ModelPFCard, RecommendationSuccessModal, MPCardBespoke, MPCard, MPInvestNowModal, MPReviewTradeModal, PerformanceChart, PricingCard, UserStrategySubscribeModal, DigioModal, KitePublisherModal* (verify), AddtoCartModal, MPStatusModal, RebalanceAdviceContent, RebalanceAdvices, RebalanceModal, ReviewTradeTextRebalance, RebalanceCard, RebalancePreferenceModal, FloatingAcceptRebalanceButton, RebalanceNotificationComponent. |
| `SDK-bound-skip` | ~30 | Unchanged. All Phase 3 surfaces — `Phase3SdkBrokerModal`, all legacy `BrokerConnectionModal/*` (~13), all `UIComponents/BrokerConnectionUI/*` (12), `CrossPlatformOverlay`, `ManageConnectionsModal`, `DisconnectBrokerModal`, `BrokerConnectionError`. |
| `SDK-pending` | 0 | **Empty as of 2026-05-01.** Verdict definition narrowed: now applies only to surfaces with an active, committed Phase 3 SDK migration. The earlier ~38 MP-pending rows all moved to `clean-extract` or `needs-logic-extraction`. If the SDK MP plan firms up later, affected rows flip back here and the design work for those surfaces unwinds. |
| `defer` | 1 | `Skeleton` primitive (no current loading-state pattern). 5 dead/orphan files (`BrokerOverlay.js`, `investContext.js`, `SubscriptionsScreen.js` stub, `use.js`, empty `VideoPlayerModal.js`) DELETED 2026-05-02 — cleanup PR. |
| TBD | ~20 | Most of `src/screens/Drawer/` (non-MP), `KnowledgeHubScreen/` subfolder, `UIComponents/StockAdvicesUI/` deeper audit, `AccountSettingScreen/` parent, MP-screen viewModel sketches (Audit-task G). Queued — see Section 9 § New audit-task queue. |
| **Total in scope** (excluding `SDK-bound-skip`) | **~88** | Phase A→I workload. Roughly doubled from the pre-unfreeze count of ~50; the full ~38 previously-frozen MP/rebalance surfaces are now in scope. Phase I (MP screens) is the largest single phase by surface count. |

Numbers will be re-counted at the end of every audit-task PR.

---

## 2026-07-18 audit addendum

| Surface | Verdict | Change recorded |
|---|---|---|
| `designs/default/screens/PortfolioScreen.js` | needs-logic-extraction | Presentation placement correction only: Trade P&L now scrolls with Model Portfolio content, avoiding a frozen-on-screen CTA. |
| `designs/default/screens/MPInvestNowModal.js` | migrated | Header close control is absolutely positioned with title-safe padding so it stays fully visible on narrow Android screens. Container payment/Digio code unchanged by this presentation edit. |
| `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js` | SDK-bound-skip | Host chrome updated for guide/IP/form hierarchy and tenant theme; SDK credentials widget remains authoritative. |
| `src/UIComponents/BrokerConnectionUI/HDFCConnectUI.js`, `ICICIConnectUI.js` | SDK-bound-skip | Legacy OAuth WebView header alignment only; retain as rollback/legacy surfaces. |
| `src/screens/Home/NewsScreen/LinkOpeningWeb.js` | needs-logic-extraction | Blog-reader header uses a flexing title plus a fixed, padded close target so long article titles cannot push the close control beyond the right edge. |
| `designs/default/composites/PortfolioSummaryCard.js` | migrated | Expired-plan state is a compact renewable notice and subordinate row metadata; table, supporting copy, and values use one Poppins scale aligned with PortfolioScreen. |
| Customer-facing plan, portfolio, knowledge and broker callouts | presentation maintenance | Visible “advisor” terminology is manager-facing; transport/config identifiers are intentionally unchanged. |
| `designs/default/composites/MPCard.js` + Model Portfolio list | migrated | Plan cards require top list clearance below the tab bar, contained discount/status pills, readable metric values, and balanced action buttons; retain current plan/payment behaviour. |
| `src/screens/Home/AfterSubscriptionScreen.js` | needs-logic-extraction | Subscribed MP detail explains current holdings versus target allocation, protects persistent Exit/Modify actions with safe-area-aware sizing, and shows neutral value placeholders plus a broker-confirmation loader until holdings requests settle instead of flashing ₹0 / “No Holdings Yet.” |
| `designs/default/screens/MPPerformanceScreen.js` + `src/screens/Drawer/MPPerformanceScreen.js` | migrated | Overview owns the scrollable model summary; historical performance is disclosure-led (not headline CAGR), volatility is described as manager-selected, and consent routes directly to the chart. |

## 2026-09-27 executable boundary-audit addendum

`scripts/audit-design-boundaries.js` now turns the presentation-only rule into
a CI gate. Its initial baseline contains **62 forbidden import edges in 17
files**. The count is intentionally import-edge based: removing one service or
context dependency removes one explicit exception even when a large surface
needs several extraction passes.

| Surface group | Forbidden edges | Verdict / next extraction |
|---|---:|---|
| `PortfolioHealthSheet` | 8 | `needs-logic-extraction` — move consent persistence, holdings reads and health API into a `src/` container. |
| `PortfolioSummaryCard` | 6 | `needs-logic-extraction` — move auth/navigation/config/service/context reads into its Portfolio container. |
| `ProvisionalBanner` | 6 | `needs-logic-extraction` — container owns mandate request and tenant headers. |
| `AumPerformanceCard` | 4 | `needs-logic-extraction` — container owns identity/config and RIA billing service. |
| `NbaBanner` | 3 | `needs-logic-extraction` — container supplies ranked actions and navigation callbacks. |
| `LiveRoom` | 1 | `needs-logic-extraction` — container owns join-URL service call; presentation owns countdown/WebView layout. |
| Other composite imports | 5 | Existing `BasketTradeModal`, `PortfolioTransitionCard`, and `StockCard` src-owned child/config dependencies. |
| Screen presentations | 29 | Existing Home/Bespoke/MP/Portfolio/Knowledge Hub child-container imports. Split incrementally without widening the baseline. |

No baseline row changes a surface to `clean-extract`; it records the exact debt
that prevents “test logic once, review screenshots per variant” today.

## 2026-09-28 boundary-extraction addendum

The ratchet is now **55 forbidden import edges in 15 files**.

| Surface | Previous edges | Current edges | Verdict / container contract |
|---|---:|---:|---|
| `ProvisionalBanner` | 6 | 0 | `migrated` — `src/screens/Home/HomeScreen.js` owns identity, tenant headers, the mandate request, dismissal state and deadline formatting. The design receives `{viewModel: {visible, deadline}, actions: {dismiss}}`. |
| `PortfolioTransitionCard` | 1 | 0 | `migrated` — the src-owned caller must supply `enabled`; the design owns only the RA-attributed transition rendering. The component remains deliberately unmounted. |
| Remaining boundary debt | 55 | 55 | `needs-logic-extraction` across 15 files; every exception remains exact and ratcheted. |

`ConfigContext.Provider` also memoizes its public value on `[config, loading]`,
so the complete token bundle is no longer rebuilt merely because the provider
component re-rendered for unrelated work.

## 2026-09-28 boundary-completion addendum

The audit now discovers **0 forbidden import edges in 0 design files**.

| Surface group | Previous edges | Current edges | Result |
|---|---:|---:|---|
| Direct-side-effect composites | 22 | 0 | NBA, Portfolio Health and Portfolio Summary use src containers; Live Room receives its join action; the unreachable AUM card was removed. |
| App-owned composite collaborators | 4 | 0 | Stock and basket collaborators are injected as slots by their src wrappers. |
| Screen presentation collaborators | 29 | 0 | Home, Bespoke, MP invest, Portfolio, Knowledge Hub and phone-logo components are supplied by their containers. |
| **Total** | **55** | **0** | No design presentation imports network, storage, Firebase, navigation, context, services, or src-owned UI. |

Payment, Digio, broker/SDK execution and navigation remain deliberately
src-owned. Variants can replace the registered presentation while consuming
the same `viewModel`, `actions`, and `slots` contract.

## 2026-09-29 dynamic-import audit addendum

The boundary audit now also resolves dynamic `import()` (string or
no-substitution template literal) and rejects non-literal `import(expr)`. On
prod web the same gap hid five edges behind a zero baseline; this app had
**none** — re-running the widened audit over `designs/**` still reports
**0 edges across 0 files**. No verdict changes.
