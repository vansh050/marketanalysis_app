# Design System Migration — Progress Log

> **Chronological work log for the swappable-UI design-system migration.** Companion to `DESIGN_SYSTEM_ARCHITECTURE.md` (design source of truth) and `DESIGN_COMPONENT_AUDIT.md` (per-surface inventory). Mirrors `PHASE3_PROGRESS.md` in spirit.
>
> Every commit that touches design-system surfaces gets an entry here. Same rule as Phase 3 — undocumented deltas block the next delta.

## Entry format

```
## YYYY-MM-DD — <commit subject>

- **Phase**: A / B / C / D / E / F / G / H / I (per `DESIGN_SYSTEM_ARCHITECTURE.md § Migration order`)
- **Surfaces touched**: file paths
- **Verdict changes**: e.g. "HomeScreen: needs-logic-extraction → migrated"
- **What shipped**: 1–3 sentences on the actual delta
- **Regressions / rollbacks**: anything that didn't go to plan
- **Next**: what unblocks
```

---

## 2026-10-01 — SDK design-passthrough slots consumed (SDK `7dc0fda`); default registry keeps SDK built-ins

- **Phase**: SDK passthrough 7e/7f (`SDK_DESIGN_PASSTHROUGH.md § 7`)
- **Surfaces touched**: `designs/default/sdk/index.js` (headers, `rebalancePnlChoice`, `brokerSelectionList` → `null`), `jest.config.js` (babel-runtime / React / React Native / webview mappings so tests can render the symlinked SDK package), `src/__tests__/sdkSlotPassthrough.render.test.js` (new, 11 tests)
- **Verdict changes**: new audit row "SDK widget slots"
- **What shipped**: the SDK now consumes every declared slot as a presentation-only override. Without the registry change, AlphaPro would have switched its broker-login and Kite headers to the never-rendered standalone files on its next build; `null` keeps the SDK built-ins. Registry entries that re-export SDK widgets are ignored by the SDK's `resolveSlot` guard.
- **Tests**: 11/11 slot render tests; full Jest 1406/1407 (the one failure, `brokerTradeFlow` Kotak payload, pre-existing); audits pass.
- **Next**: visual regression per slot (7g).

## 2026-10-01 — configurable navigation: data-only manifest for tabs, More menu, pre-login order

- **Phase**: registry-contract extension (new `navigation` variant field) + P0–P3 of `CONFIGURABLE_NAVIGATION_DESIGN.md`
- **Surfaces touched**: `src/navigation/{screenCatalog,resolveNavigation,useNavigationLayout}.js` (new), `designs/default/navigation.js` (new), `designs/default/index.js`, `designs/default/shell/MainTabBar.js`, `src/design/resolveDesign.js`, `src/components/Navigation.js`, `src/screens/Home/AccountSettingsScreen.js`, `src/components/SplashScreen.js`, `src/utils/Logging.js`, `scripts/audit-design-boundaries.js`
- **Verdict changes**: MainTabNavigator tab structure → `migrated (data manifest)` (new audit row); AccountSettingsScreen menu structure now manifest-driven
- **What shipped**: tabs, first tab, More-menu sections, phone-first pre-login order and tab-bar height are declared per variant as a data-only manifest and resolved against a src-owned catalog (legacy route names kept; required More tab + legal/delete/logout rows re-added if dropped; money/compliance steps have no catalog keys). The hard-coded arfs News swap was removed from upstream (it belongs in the arfs fork's manifest). Default manifest reproduces the prior app exactly — pinned by `src/__tests__/navigation/defaultNavigationSnapshot.test.js`.
- **P0 finding**: every mobile fork's remote `Navigation.js` predates `DesignTabBar`/`shell.MainTabBar`; most divergence is lag, not deliberate navigation. Only arfs (no More tab; News + Watchlist) and magnus changed the tab set. The arfs fork's shipped tab bar has no More tab — verify it still exposes Log Out / Delete Account elsewhere (Apple 5.1.1(v)).
- **Tests**: 3 new suites (resolver, default-manifest snapshot, manifest contract incl. audit rule); full Jest 1391/1392 (the 1 failure, `brokerTradeFlow` Kotak payload, also fails on clean HEAD); Android release JS bundle builds; `audit:design` / `audit:styles` / `audit:imports` pass.
- **Regressions / rollbacks**: none known. Rollback = revert the commit (JS-only; OTA-able).
- **Next**: P4 — each fork adopts the current shell and declares its manifest (arfs first).

## 2026-09-29 — warn when a recommendation SELL uses model-owned shares

- **Phase**: Phase G behavior added before the planned review-modal extraction.
- **Surfaces touched**: `src/components/ReviewTradeModal.js`,
  `src/components/ReviewZerodhaTradeModal.js`,
  `src/components/AdviceScreenComponents/SellModelImpactNotice.js`, and
  `src/hooks/useSellModelImpact.js`.
- **Verdict changes**: `ReviewTradeModal` remains
  `needs-logic-extraction`; `SellModelImpactNotice` is pure enough to extract
  after the parent container split.
- **What shipped**: a token-compatible warn card renders only for a SELL that
  reaches model-attributed shares. It offers pre-filled free-only or exact
  model-reduction choices. Network/state/authorization logic remains in
  `src/`; the card uses `designColor` and `designFont`, so the style ratchet
  stays clean.
- **Regressions / rollbacks**: none observed; warn mode never disables Place
  Order and failed preview/reservation calls preserve the old flow.
- **Next**: when Phase G extracts the review presentation, expose notice rows
  and `onChoose` via viewModel/actions without moving API calls into
  `designs/`.

---

## 2026-09-29 — audit dynamic import() in the design boundary

- **Phase**: boundary hardening (post Phase I).
- **Surfaces touched**: `scripts/audit-design-boundaries.js`,
  `src/__tests__/designBoundaryDynamicImport.test.js`,
  `docs/VARIANT_CREATION_GUIDE.md`, `docs/DESIGN_SYSTEM_ARCHITECTURE.md`,
  `docs/DESIGN_COMPONENT_AUDIT.md`, `CLAUDE.md`, `AGENTS.md`.
- **Verdict changes**: none.
- **What shipped**: the audit inspects `import()` as a dependency edge
  (string / template literal resolved like a static import; non-literal
  rejected). `auditSource()` is exported for tests and the CLI runs only as
  `main`. The variant guide gained a "which change needs what" table, the
  boundary rule, build-time literal tokens and the current Maestro baseline
  procedure; CLAUDE.md/AGENTS.md now route design work to it.
- **Regressions / rollbacks**: none — baseline remains 0; the new test passes.
  (`__tests__/maestroVisualBaseline.test.js` needs `npm install` for the
  `pngjs`/`pixelmatch` devDependencies added in `c7a4d54`.)
- **Next**: first green KVM Maestro comparison run; per-variant baselines as
  real variants are added.

---

## 2026-09-28 — restore the source style ratchet after SELL-retry UI

- **Phase**: Phase I debt containment before RebalanceCard extraction.
- **Surfaces touched**: `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`.
- **Verdict changes**: none; RebalanceCard remains `needs-logic-extraction`.
- **What shipped**: the newly added SELL-retry badge reads its inverse text
  color and caption typography from `useTokens()` instead of adding one color
  and one font literal. The enforced baseline is restored to 4,409 colors and
  1,147 font-family literals.
- **Regressions / rollbacks**: no behavior or copy change; 30 rebalance
  lifecycle contracts and all three CI audits pass.
- **Next**: split RebalanceCard into a src behavior container and registered
  presentation before converting its remaining legacy styles.

---

## 2026-09-28 — clear the design presentation boundary

- **Phase**: G–I boundary completion.
- **Surfaces touched**: app header/bottom tabs, Home, Bespoke Performance, MP invest, Portfolio,
  Knowledge Hub, authentication, stock/basket cards, Live Room, NBA,
  Portfolio Health, and Portfolio Summary presentations and their src-owned
  containers.
- **Verdict changes**: the executable audit discovers **0 forbidden import
  edges in 0 design files**, down from 55 edges in 15 files.
- **What shipped**: app-owned visual collaborators are injected through
  container-owned `slots`; network, storage, context, navigation, payment,
  Digio, and SDK behavior stays in `src/`. New src containers own NBA ranking,
  Portfolio Health consent/reconciliation, and Portfolio Summary fetching.
  The unreferenced `AumPerformanceCard` registration was removed instead of
  preserving an unreachable service consumer. The navigator now resolves
  `shell.AppHeader` and `shell.MainTabBar`, while src retains route state and
  tab event handling.
- **Regressions / rollbacks**: the presentations retain their existing markup
  and callbacks. Focused design/portfolio contracts pass 19/19; targeted lint
  passes. Repository-wide lint remains blocked by the existing unrelated lint
  backlog.
- **Next**: establish a hardcoded-style ratchet/codemod, then add fixture-render
  and screenshot coverage per variant.

The first style-literal ratchet is now active in the same CI workflow:
`npm run audit:styles` pins production `src/` at 4,409 hex-color literals and
1,147 `fontFamily` literals (token definitions and tests excluded). Either
count increasing fails; a decrease is also stale until the baseline is lowered.
This is debt containment, not completion of tokenization.

---

## 2026-09-28 — extract provisional-banner logic and stabilize config tokens

- **Phase**: G — container/presentation boundary reduction and contract hardening.
- **Surfaces touched**: `src/context/ConfigContext.js`, the Home container and
  presentation, `ProvisionalBanner`, `PortfolioTransitionCard`, the boundary
  baseline, and the design contract test.
- **Verdict changes**: `ProvisionalBanner` and `PortfolioTransitionCard` move
  from `needs-logic-extraction` to `migrated`; the ratchet falls from 62 edges
  in 17 files to 55 edges in 15 files.
- **What shipped**: the Home container now owns the provisional mandate request,
  identity/tenant headers, dismissal state and date formatting; variants receive
  a stable `{viewModel, actions}` contract. The deferred transition presentation
  receives its feature gate as `enabled`. `ConfigContext.Provider` memoizes its
  value so unrelated provider renders do not rebuild every token family.
- **Regressions / rollbacks**: the provisional banner retains the same endpoint,
  headers, copy and hidden-on-error behavior. The transition card remains disabled
  and unmounted unless a future src-owned caller explicitly enables it.
- **Next**: extract `PortfolioHealthSheet`, then `PortfolioSummaryCard`; add real
  fixture rendering and visual regression once those direct-side-effect surfaces
  are prop-driven.

---

## 2026-09-27 — enforce the complete variant contract and stop new design-layer logic

- **Phase**: post A–I contract hardening.
- **Surfaces touched**: `src/theme/useTokens.js`, `src/design/resolveDesign.js`,
  `src/design/useDesign.js`, `src/sdk/SdkProviderRoot.js`,
  `scripts/audit-design-boundaries.js`,
  `scripts/design-boundary-baseline.json`, the design contract test, npm script,
  and the import-lint workflow.
- **Verdict changes**: no historical leak is promoted to migrated. The first
  machine audit classifies 62 forbidden import edges across 17 design files as
  explicit `needs-logic-extraction` debt.
- **What shipped**: all six token families now resolve through the active
  variant; the registry merges app components and SDK slots over the default
  floor; all registered variants fail fast on private component/SDK keys; and
  `SdkProviderRoot` forwards the resolved SDK map to `AqSdkProvider`. CI now
  blocks any new network/storage/Firebase/navigation/context/service/src-UI
  dependency in `designs/**` while requiring baseline entries to be removed as
  extractions land.
- **Regressions / rollbacks**: default tokens and default SDK widgets fall back
  to the same implementations, so the default build has no intended visual or
  workflow change. Existing design-layer debt remains functional but visible.
- **Next**: extract the six direct side-effect composites in the priority order
  recorded in the architecture/audit docs, then remove src-owned child
  containers from screen presentations. Add screenshot regression coverage
  once the presentation boundary reaches zero.

---

## 2026-08-16 — BasketCard lifecycle and entry-gate presentation contract

- **Phase**: G — existing container/presentation split extension.
- **Surfaces touched**: `src/UIComponents/StockAdvicesUI/BasketCard.js`,
  `designs/default/composites/BasketCard.js`.
- **Verdict changes**: BasketCard stale `needs-logic-extraction` row corrected
  to migrated; StockAdvicesUI folder now records mixed status.
- **What shipped**: the container owns canonical lifecycle and five-second
  server entry authorization; the presentation receives status badges,
  disabled state and customer copy. Variants must consume those fields and
  must not reinterpret raw cancel/closure flags.
- **Regressions / rollbacks**: none. Zerodha remains one Publisher WebView;
  the design layer does not own ordering or broker execution.
- **Next**: custom variants may adjust visual treatment while preserving the
  expanded viewModel contract.

## 2026-07-28 — QA asset-fallback hardening for Payment History and MP cards

- **Phase**: G (screen container/presentation refinement) + I (Model Portfolio
  composite refinement).
- **Surfaces touched**:
  - `src/screens/Drawer/PaymentHistoryScreen.js` supplies
    `advisorLogo`/`advisorLogoFallback`; the container remains responsible for
    tenant configuration and invoice I/O.
  - `designs/default/screens/PaymentHistoryScreen.js` owns the visual fallback
    chain and advances to the next source on `Image.onError`.
  - `src/components/ModelPortfolioComponents/MPCard.js` owns remote-image
    failure state; `designs/default/composites/MPCard.js` only reports
    `onImageError` and renders the supplied fallback source.
- **Verdict changes**: `MPCard` is recorded as migrated in the component audit;
  Payment History remains a container/presentation split.
- **What shipped**: stale or missing remote image URLs no longer render retired
  branding or an empty plan-logo tile. Presentation components remain free of
  config contexts and network calls.
- **Regressions / rollbacks**: the historical invoice logo remains the final
  fallback for tenants with neither live nor bundled branding. A new image prop
  resets the MP failure state, so list-cell reuse does not pin the prior
  fallback.
- **Next**: device smoke-test both rows after the next mobile build.

---

## 2026-07-24 — client "markup" PDF UPDATE 1 / 6 / 7 / 8 — design-system side of the fix batch

- **Phase**: G (screen container/presentation splits, refinement) + I (Model Portfolio surfaces).
- **Surfaces touched**:
  - `designs/default/composites/MPCard.js` — added `marginRight: 10` to `styles.container` so horizontal MP carousels (Home tab) render with gaps between cards, matching the existing `MPCardBespoke` treatment. Vertical lists are unaffected because the card already had `marginBottom: 14`.
  - `src/screens/Drawer/BespokePerformanceScreen.js` (container) — added `useTokens()` import; extracts `colors.brand.gradientStart / gradientEnd / primary` into local `gradient1 / gradient2 / mainColor`; adds those three fields to the viewModel passed into the `screens.BespokePerformanceScreen` presentation. Fixes the OverView-tab label casing to "Overview".
  - `designs/default/screens/BespokePerformanceScreen.js` (presentation) — destructures `gradient1 / gradient2 / mainColor` from viewModel with the previous hardcoded fallbacks (`'#002651'`, `'#0076fb'`, `'#0056B7'`); header `LinearGradient` swapped from the hardcoded pair to `[gradient1, gradient2]`; Invest-now button gets an inline `{ backgroundColor: mainColor }` override on top of `styles.investButton`. Also refactored the two tab render functions from concise-body arrow returns to block bodies so we could add defensive shape normalization for `strategyDetails.keyFeature` / `keyBenefit` (Update 4) and read the admin-configured `investmentManagement` + `researchInvestment` fields into the Overview tab (Update 7). Fallback promo-block preserved for empty admin content.
  - `src/components/ReviewTradeModal.js` — this modal is NOT under `designs/` today (it's still in `src/components/`); noted here because Update 8 substitutes `useConfig()` `gradient1 / gradient2 / mainColor` (already destructured but previously unused) into the two `LinearGradient` headers, the Fix-Size button, and the two Place-Order CTAs. When this file eventually moves under `designs/default/composites/` per Phase G/H, the switch will already be token-driven.
- **Verdict changes**: none. All rows were already `migrated` (`MPCard`, `BespokePerformanceScreen` presentation). This is a **refinement pass** on already-migrated surfaces — same shape as the earlier 2026-07-11 MP hardcoded-color sweep. `DESIGN_COMPONENT_AUDIT.md` verdicts unchanged.
- **What shipped**: cross-tenant fix for a clashing hardcoded blue that ignored `useTokens()` — every whitelabel gets its own header tone from `colors.brand.gradientStart/End` without any per-tenant fork edit. Bespoke-detail Overview tab now surfaces two admin content blocks (`investmentManagement`, `researchInvestment`) that were previously unread by mobile despite being required inputs on the admin plan editor.
- **Regressions / rollbacks**: none expected. Every color read has the prior hardcoded value as a fallback, so a tenant without tokens (or a token bundle missing `brand.gradient*`) renders exactly as before. The two arrow-body-to-block-body refactors preserved JSX output byte-for-byte; only the closing `),` became `);\n},` per JS syntax.
- **Next**: markup fork picks this up via content-port; see `../markup_app/docs/CHANGELOG.md` 2026-07-24 entry — a follow-up decision on markup's header color mismatch (light-gray tokens vs. dark home hardcode) is open. Watch for whether markup opts to migrate the Home screen off its hardcoded `['#000000', '#3A3A3A']` gradient onto the same tokens — that would close the loop cleanly without per-file overrides.

---

## 2026-07-11 — `moneyman_app` variant + variant-aware `buildColors` + `mpCardColorCycle` for Portfolio-tab MP rows

- **Phase**: B (registry / variant plumbing) + I (Model Portfolio surfaces).
- **Surfaces touched**:
  - `src/theme/colors.js` — added `mpCardColorCycle: null` slot in `DEFAULT_TOKENS`.
  - `src/theme/useTokens.js` — reads `design.tokens.buildColors` from `DesignContext`, falls back to local `buildColors`. Mirrors the existing `buildAssets` variant-aware pattern from 2026-06-10.
  - `src/screens/PortfolioScreen/ModelPFCard.js` (container) — new `index` prop; reads `useTokens().colors.mpCardColorCycle`; computes `cardColor = cycle[index % cycle.length]`; passes into `viewModel.cardColor`.
  - `src/screens/PortfolioScreen/PortfolioScreen.js` — passes `index` from `FlatList.renderItem` into the container.
  - `designs/default/composites/ModelPFCard.js` — accepts `viewModel.cardColor`; when non-null, applies a 4px left-border accent + tints the model-name text. Default variant behavior unchanged (cycle is `null`).
  - `designs/moneyman_app/` (NEW) — `tokens/index.js` with `MONEYMAN_DEFAULTS` (green `#005A00` brand.primary/accent/gradientStart, `#003300` gradientEnd, green nav.tabIconActive, green+dark-green basket, green border.focus, `mpCardColorCycle: ['#005A00', '#00005A', '#5A005A']`) + `applyLegacyBranding` + `merge` for backend overrides; `index.js` variant root with empty `components` (falls back to default).
  - `designs/registry.js` — registered `moneyman_app`.
- **Verdict changes**: `ModelPFCard` row in `DESIGN_COMPONENT_AUDIT.md` updated with the new `cardColor` viewModel prop.
- **What shipped**: enables a portable fork palette for the `moneyman_app` sibling repo. Because `designs/moneyman_app/` lives outside `src/`, copying `src/` from upstream Alphab2bapp into moneyman_app no longer overwrites the fork's brand green. Activation on the fork side is `DESIGN_VARIANT=moneyman_app` in that repo's `.env`. The 3-color cycle (green/blue/purple) appears only on the Portfolio-tab subscribed-MP rows; it cycles by row index and repeats for lists longer than 3.
- **Regressions / rollbacks**: none expected. Default variant renders identically — `mpCardColorCycle` defaults to `null`, and the presentation's `cardColor && …` gates keep the accent styles behind a truthy check.
- **Next**: user copies `src/` + `designs/moneyman_app/` into the moneyman_app repo; sets `DESIGN_VARIANT=moneyman_app` in that repo's `.env`; runs the app to confirm green theme + 3-color card cycle. If the fork later needs a custom home hero or MP subscribe card, register it under `designs/moneyman_app/composites/` or `screens/` — the empty `components: {}` map is intentionally the extension point.

### Follow-up in the same session: MP hardcoded-color sweep

Purpose: token-migrated the fallback hex in every MP surface that was doing `const gradient1 = config?.gradient1 || '#hex'`. `useTokens()` already layers backend legacy branding (`config.gradient1 → brand.gradientStart`), so switching the fallback from a literal hex to `tokens.colors.brand.*` gives us: variant default (moneyman green) → tenant admin-UI override → `colorTokens` override — all through one hook. Non-brand semantic colors (P&L greens/reds, status success/danger, gray neutrals) left untouched.

**MP surfaces migrated to `useTokens()` for brand-color fallbacks (all default variant appearance unchanged):**

- `src/components/ModelPortfolioComponents/MPCard.js` — subscription-screen card. `gradient1/2/mainColor` fallbacks now read from `tokens.colors.brand.{gradientStart, gradientEnd, primary}`.
- `src/components/ModelPortfolioComponents/MPCardBespoke.js` — bespoke subscription-screen card. Same replacement. `#ECF3FE` static-accent bgs in the expanded section (4 spots) left as-is — small, non-primary chrome.
- `src/components/ModelPortfolioComponents/MPInvestNowModal.js` — invest-flow modal. Same replacement.
- `src/components/ModelPortfolioComponents/RecommendationSuccessModal.js` — post-recommendation success. Same replacement + inline `#0056B7` and `#2563EB` in the manual-edit and inline-Info flows now read `brandPrimary` / `infoColor` from `tokens.colors.status.info`.
- `src/components/ModelPortfolioComponents/UserStrategySubscribeModal.js` — subscribe flow. `mainColor` fallback (previously `'#000'`) now reads `brand.primary`.
- `src/components/ModelPortfolioComponents/DigioModal.js` — Digio auth WebView. `mainColor` + `gradient2` fallbacks now read from tokens. Static `#002651` header bg is dead default (overridden inline by `gradient2`).
- `src/components/ModelPortfolioComponents/DigioSuccessModal.js` — Digio success. `mainColor` fallback now reads `brand.primary`. Static-sheet `#2563EB` occurrences are dead defaults (overridden inline).
- `src/components/ModelPortfolioComponents/TelegramCollectionModal.js` — Telegram-ID collector. Same. Static-sheet blues are dead defaults.
- `src/components/ModelPortfolioComponents/VerificationMethodCheck.js` — auth-method picker. Same. Static-sheet blues are dead defaults.
- `src/components/ModelPortfolioComponents/PricingCard.js` — plan pricing tile. Same. Static-sheet blues are dead defaults.
- `src/components/ModelPortfolioComponents/PendingOrdersModal.js` — pending-orders retry modal. Static `#2563EB` on `actionButton` was NOT overridden inline; migrated by capturing `brandPrimary` in the component and overriding via inline style at all 3 call sites.
- `src/screens/Home/AfterSubscriptionScreen.js` — post-subscription content screen. `gradient1/gradient2/themeColor` fallbacks now read from tokens. The Overview `methodTitleBar`/`methodTitle` overrides moved to inline reads of `themeColor` at that call site. The re-used `MethodSection` helper's static-sheet copy of the same styles left as-is — self-contained tail (only 2 usages, unlikely to be prominent under moneyman).
- `src/screens/Drawer/MPPerformanceScreen.js` — MP performance. Same 3-color replacement.
- `src/screens/Drawer/ModelPortfolioScreen.js` — MP subscription list. Same 3-color replacement.
- `src/screens/PortfolioScreen/PortfolioScreen.js` — Portfolio tab container. `mainColor` fallback now reads `brand.primary`.
- `src/screens/PortfolioScreen/PortFolioCard.js` — Portfolio-tab hero card. `gradient1/gradient2` fallbacks now read from tokens.
- `src/screens/PortfolioScreen/EmptyMessageCard.js` — empty state. Same 3-color replacement.

**Left as follow-up (not in this pass):**
- Static-`StyleSheet.create` `#2563EB` / `#0056B7` occurrences that ARE overridden by inline `mainColor` at every use site — dead defaults; no visual effect. Safe.
- Small light-blue accents like `#ECF3FE`, `#DBEAFE`, `#EFF6FF` — used for expanded-section bg / badge tints. Small enough to skip; a future pass can add a `surface.brandTint` token.
- Non-MP surfaces (Home hero, Login/Signup chrome, Drawer, broker connect, Advice, rebalance): out of scope for this sweep per user direction.
- Phase-3 SDK-bound broker modals (`src/components/BrokerConnectionModal/*`), sell-auth modals (`DdpiModal`, TPIN modals), SDK Phase C surfaces (`RebalanceModal`, `MPReviewTradeModal` — the latter is MP-adjacent but Phase-C-bound so intentionally skipped): not touched per the CLAUDE.md blocking rules.

**Parse verification**: all 17 modified files pass `@babel/parser` (JSX+Flow) parse without errors.

---

## 2026-06-19 — `composites.LiveRoom` renders the live class via WebView bridge (no native LiveKit)

- **Phase**: Courses/Webinars composites (tracked primarily by `COURSES_WEBINARS_MOBILE_PORTING.md` §4.2).
- **Surfaces touched**: `designs/default/composites/LiveRoom.js` (placeholder `LiveRoomActive` → `LiveRoomWebView`), plus non-design `src/FunctionCall/services/LiveKitService.js` (`getJoinUrl`) and backend `aq_backend_github/Routes/livekit.js` (`/join-url`).
- **Verdict changes**: `composites.LiveRoom` live render: placeholder (native LiveKit not installed) → **live via full-screen Modal `react-native-webview`** loading the web join URL; browser WebRTC runs the room. Native LiveKit demoted to optional Option A.
- **What shipped**: closes the last courses/webinar parity gap without native deps. `handleJoin` → `getJoinUrl` → `POST /api/livekit/join-url/:lessonId` → full-screen WebView at `…/webinar/:id?joinToken=…`. Viewers subscribe-only → no media permissions. `react-native-webview` already installed (GumletPlayer).
- **Regressions / rollbacks**: none; JS-only, babel-parses clean. Needs real-iOS-device WebRTC-in-WKWebView verification.
- **Next**: device test on iOS; optionally adopt native Option A (§4.2.1) for background-audio/PiP.

## 2026-06-19 — `composites.LiveRoom` gains `joinToken` (magic-link join port)

- **Phase**: Courses/Webinars composites (tracked primarily by `COURSES_WEBINARS_MOBILE_PORTING.md` §4.2/§4.2.1).
- **Surfaces touched**: `designs/default/composites/LiveRoom.js` (`joinToken` prop → `getViewerToken`), plus non-design `src/FunctionCall/services/LiveKitService.js` + `src/screens/Courses/WebinarDetailScreen.js`.
- **What shipped**: ported the web 2026-06-06 magic-link join — `getViewerToken(lessonId, courseId, { joinToken })` hits `/token-magic` (no Firebase) when a signed join JWT is present; `LiveRoom` forwards a new `joinToken` prop. Part of the 3-week courses/webinar web-parity audit (see `CHANGELOG.md` + porting §10 matrix). Deep-link source not yet wired.
- **Regressions / rollbacks**: none; JS-only, babel-parses clean.
- **Next**: configure the Android App Link / iOS Universal Link that routes `…/webinar/:id?joinToken=` into `WebinarDetailScreen`; install LiveKit native deps per porting §4.2.1.

## 2026-06-19 — `composites.LiveRoom` live-class presents full-screen (parity with web full-viewport webinar fix)

- **Phase**: Courses/Webinars composites (tracked primarily by `COURSES_WEBINARS_MOBILE_PORTING.md §4.2`; logged here because `designs/default/composites/LiveRoom.js` is a design-system surface).
- **Surfaces touched**: `designs/default/composites/LiveRoom.js` (the `LiveRoomActive` render + activation snippet + styles).
- **Verdict changes**: `composites.LiveRoom` active-room presentation: inline fixed-height panel (activation snippet was `height: 360`) → **full-screen RN `Modal`** (`presentationStyle="fullScreen"`, slim dark header with title + Close, `flex:1` `roomBody`).
- **What shipped**: ported the *intent* of the web 2026-06-19 fix (web live webinars moved out of a cramped `max-w-3xl` modal into a `fixed inset-0` overlay). On mobile the actual LiveKit video is still a placeholder (`@livekit/react-native` not installed), and live lessons already route to a dedicated full-screen `WebinarDetailScreen` — so there was no live runtime bug. The change hardens the sizing **contract** so that when LiveKit is activated, the room fills the screen instead of rendering as a small fixed box (the mobile equivalent of the "webinar fits very small / maximize doesn't help" report). VOD `composites.GumletPlayer` was already fluid (`width:100%, aspectRatio 16/9`) — unchanged.
- **Regressions / rollbacks**: none; behavior is dark (placeholder feature). `LiveRoom.js` babel-parses clean. No native deps added.
- **Next**: when activating LiveKit, drop `<LiveKitRoom style={{ flex:1 }}>` into the `roomBody` slot per the updated activation snippet — keep the Modal wrapper.

## 2026-06-10 — `useTokens()` asset slot made variant-aware; brand logo extracted from shared src/

- **Phase**: Tokens (closes the deferred "useTokens variant-awareness" follow-up noted on 2026-05-04 and in `SYNC.md`).
- **Surfaces touched**: `src/theme/useTokens.js`, `src/components/BrandLogo.js`, `src/components/LogoSection.js`, `src/components/SplashScreen.js`; **deleted** `src/components/AlphanomyLogo.js`. (Same edits applied in both this repo and upstream `Alphab2bapp` — these `src/` files are now byte-identical.)
- **Verdict changes**: `BrandLogo` / `LogoSection` / `SplashScreen`: hardcoded-`'alphanomy'`-branch → token-driven (clean). `AlphanomyLogo`: removed (was a tenant-brand leak in shared src/).
- **What shipped**: `useTokens()` now resolves the `assets` slot from the active variant's `buildAssets` via `DesignContext` (`design.tokens.buildAssets`, from `resolveDesign`'s token-namespace merge), falling back to the default builder outside a provider. The three brand-logo consumers now read `useTokens().assets.logoPng` instead of branching on `DESIGN_VARIANT === 'alphanomy'`. The alphanomy mark is now the PNG at `designs/alphanomy/assets/logo.png` via `designs/alphanomy/tokens/assets.js`. Default-variant `logoPng` is the same `src/assets/logo.png` as before → no AlphaQuark visual change. Only `assets` was made variant-aware (colors/typography already vary via ConfigContext legacy-branding).
- **Regressions / rollbacks**: none observed; all changed files babel-parse clean. Visual verification on the alphanomy emulator pending (logo should now render the finalized PNG on splash, login, plan card, and the faded watermark on RebalanceCard/BasketCard).
- **Next**: optionally make the remaining token families (colors/typography) consume the variant builder via the same `DesignContext` path, for variants that don't fully express their palette through ConfigContext legacy fields.

## 2026-05-09 — Whitelabel Phase 3: variant-overlay model formalized (docs-only)

- **Phase**: meta — codifies the upstream-default + per-tenant fork-repo pattern.
- **Surfaces touched**:
  - `docs/WHITELABEL_RECIPE.md` (NEW) — canonical playbook. Covers what stays upstream vs in the fork, the native shell delta, the conventional `designs/registry.js` 2-line merge-conflict strategy (chosen over a `registry.local.js` extension point and over npm-package variants — rationale documented), the step-by-step "add a new whitelabel" procedure, the upstream sync workflow, and a `SYNC.md` template each fork ships.
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md` — new "Where variant folders live — upstream-default + per-tenant fork repos" subsection under § Variant selection. Documents the conventional merge-conflict registry strategy with reasons. Asserts: a fork that edits any `src/` file is drift, not customization.
  - `docs/DESIGN_COMPONENT_AUDIT.md` — added a scope note at the top: this audit covers upstream `designs/default/` only; per-fork audits live in fork repos. Upstream's job is the container-side viewModel + actions contract; widening verdicts (e.g. `clean-extract` → `needs-logic-extraction`) is the upstream side of a fork's override needing more data.
  - `docs/CHANGELOG.md` — entry 13.
  - (NOT done in this commit, intentionally) `CLAUDE.md` pointer — the recipe doc is referenced from arch + audit + this log; no need to add it to the top-level blocking-doc list yet because there's no _ongoing_ surface change rule attached to it. If WHITELABEL_RECIPE.md grows surfaces that need same-commit doc updates (similar to Phase 3 / SDK orchestration), revisit then.
- **Verdict changes**: none — Phase 3 is docs-only.
- **What shipped**: a written contract for whitelabeling. Anyone bootstrapping a new tenant fork can now follow `WHITELABEL_RECIPE.md` step-by-step. Anyone editing this repo knows what's the upstream's responsibility (the contract, the default variant, the infrastructure) vs the fork's responsibility (the variant folder, the native shell, the `.env`, the registry patch). The Alphanomy fork — which today still carries `src/assets/*` overwrites and lacks a `SYNC.md` — gets cleaned up in a separate session against that repo.
- **Why a 2-line merge conflict on `designs/registry.js` instead of a `registry.local.js` extension point**: predictable, no infrastructure, no Metro-bundler dependency on conditional-require behavior, no "is the variant in the bundle or not" silent footgun. The conflict resolution is mechanical (keep both upstream's default and the fork's variant lines). The trade-off is real but small.
- **Backend / ccxt**: no changes.
- **Behavior change in app**: zero. Docs-only.
- **Validation**: docs cross-link cleanly (CHANGELOG → arch + audit + recipe; recipe → arch + audit + progress + CLAUDE; arch + audit reference the recipe).
- **Next**: cleanup pass against the Alphanomy fork repo (separate session): rebase fork onto upstream so it picks up Phase 1 + 2 + 3, revert its `src/assets/*` overwrites, add `designs/alphanomy/tokens/assets.js` pointing at `designs/alphanomy/assets/*` for its own logos, add a `SYNC.md`, and verify `designs/alphanomy/index.js` still resolves cleanly through the inherited registry shape.

---

## 2026-05-09 — Whitelabel Phase 2: logo asset-token slot (default-only)

- **Phase**: A-extension (token bundle gains an `assets` family — same shape as `colors` / `spacing` / `typography` / `radii` / `shadows`)
- **Surfaces touched**:
  - `src/theme/assets.js` (NEW) — `DEFAULT_ASSETS = { logoPng, logoFadedPng }` + `buildAssets(config)` (config arg ignored, kept for builder symmetry).
  - `src/theme/useTokens.js` — `useTokens()` now exposes `.assets`. Memo deps include `config.assetTokens` for future-symmetry (the field doesn't exist on `ConfigContext` today; resolution falls to defaults).
  - `designs/default/tokens/index.js` — re-exports `DEFAULT_ASSETS` + `buildAssets`.
  - `designs/default/screens/LoginScreen.js` — module-scope `const AlphaQuarkLogo = require(...)` removed; `renderLogo()` now takes `defaultLogo` as a third arg, fed by `tokens.assets.logoPng`.
  - `designs/default/screens/SignupScreen.js` — same pattern.
  - `designs/default/screens/ResetPassword.js` — same pattern.
  - `designs/default/screens/ChangeAdvisor.js` — module-scope `const logo = require(...)` removed; component reads `tokens.assets.logoFadedPng` directly.
  - `designs/default/composites/BasketCard.js` — top-level `import logo from ...` removed; component reads `tokens.assets.logoFadedPng` directly.
- **Verdict changes**: new Section 7c in `DESIGN_COMPONENT_AUDIT.md` enumerates the asset slots and per-consumer status. No screen verdicts flipped.
- **What shipped**: A variant overlay repo can now ship `designs/<variant>/tokens/assets.js` re-exporting `DEFAULT_ASSETS` with the variant's own logo paths, and the 5 design-side logo consumers above will pick up the variant's logo without any further code change. Closes the Phase 2 leak Alphanomy ran into when it overwrote `src/assets/AppLogo/logo.png`, `src/assets/logo.png`, and `src/assets/fadedlogo.png` directly — both repos can keep their own brand without stomping each other's shared files.
- **Why these 5 consumers, not all 12 logo callsites**: `src/`-side consumers (SplashScreen, PlanCard, RebalanceCard, Config.js, ConfigContext.js) sit outside the variant-resolution surface. SplashScreen renders before providers; PlanCard and RebalanceCard already theme via `configData.logo` from `ConfigContext` (a parallel theming path that predates the design system). Migrating those without first splitting them into container + presentation would either crash (SplashScreen pre-providers) or redundantly theme (PlanCard / RebalanceCard already config-driven). Out of Phase 2 scope.
- **Backend / ccxt**: no changes.
- **Behavior change in app**: zero for default variant. A custom variant overlay gains the ability to swap the two logos without overwriting shared `src/assets/*` files.
- **Validation**: grep confirms zero remaining direct logo imports in `designs/`. Default variant's `tokens.assets.logoPng` resolves to the same `src/assets/logo.png` that the old module-scope require did — byte-identical render output.
- **Next**: Phase 3 — formalize the variant-overlay pattern in `docs/WHITELABEL_RECIPE.md`, document the conventional merge-conflict registry strategy in `DESIGN_SYSTEM_ARCHITECTURE.md`, and update audit docs to reflect that variant folders live in overlay repos, not upstream.

---

## 2026-05-09 — Whitelabel Phase 1: Navigation.js Plans-tab wrapper hoist

- **Phase**: G-adjacent (Navigation surface is `clean-extract`-eligible plumbing, not a screen migration)
- **Surfaces touched**:
  - `src/components/Navigation.js` — hoisted `PlansTabWrapper` (`() => <ModelPortfolioScreen type="tab" />`) to module scope. The Plans `<Tab.Screen>` now passes `component={PlansTabWrapper}` instead of an inline render-prop child. Pure cleanup.
- **Verdict changes**: `src/components/Navigation.js` is unaffected by the design-system migration scope (it's a navigator, not a UI surface), but the wrapper hoist is a generic perf cleanup that any variant benefits from.
- **What shipped**: Inline render functions on `<Tab.Screen>` create a fresh component identity on every parent render → React Navigation remounts the nested screen tree every time. Hoisting to module scope makes the reference stable. Zero behavior change.
- **Origin**: cherry-picked from the Alphanomy fork's `feature/prince` (commit `f30695a`). The other four pieces of Alphanomy's Phase 1 plumbing changes (HomeScreen viewModel enrichment, useHomePlanSummary raw exports, useHomeMarketSummary debug silencing, ModelPortfolioScreen tab-switch fix) all sit on top of a *prior* hook-extraction refactor (`src/screens/Home/hooks/useHomeMarketSummary.js`, `useHomePlanSummary.js`, `useNotificationFeed.js`) that exists only in Alphanomy. Those changes are deliberately deferred — backporting them without the hook extraction base is meaningless.
- **Whitelabel context**: This is the first commit of the whitelabel-sync work. The model is: upstream (this repo) ships the `default` variant + design-system infrastructure only; each whitelabel (Alphanomy, future variants) lives in a fork repo containing its own `designs/<variant>/` folder + native shell. The pattern is being formalized in Phase 3 of the sync work; see `docs/WHITELABEL_RECIPE.md` (TBD).
- **Validation**: change is a 5-line transformation; render-stable Tab.Screen `component` prop is a documented React Navigation idiom.
- **Behavior change in app**: zero for default variant; eliminates a Plans-tab remount on every MainTabNavigator parent render.
- **Next**: Phase 2 — logo asset-token slot in `designs/default/tokens/assets.js`. Phase 3 — formalize the variant-overlay pattern in `WHITELABEL_RECIPE.md` and update arch docs.

---

## 2026-05-02 — Phase I: MPInvestNowModal container/presentation split (5364 LOC)

- **Phase**: I — Model Portfolio (MP subscription + payment modal)
- **Surfaces touched**:
  - `src/components/ModelPortfolioComponents/MPInvestNowModal.js` — rewritten as container. Removed ALL JSX rendering, StyleSheet, lucide-react-native presentation icons, LinearGradient, ScrollView, Modal, FlatList. Added `useComponent('screens.MPInvestNowModal')`. Builds `viewModel` (50+ fields) and `actions` (25+ callbacks) and renders `<Presentation viewModel={viewModel} actions={actions} />`.
  - `designs/default/screens/MPInvestNowModal.js` — NEW. Pure presentation. Contains CouponCodeInput, StepProgressBar, StepCard sub-components and the 3-step wizard UI (Personal Info / Investment+KYC / Plan Selection). Renders plan cards, coupon input, GST breakdown, consent checkbox, disclaimer modal, Digio modal shell, PayU WebView shell, Telegram collection modal, Digio success modal. NEVER touches payment SDKs or payment callbacks.
  - `designs/default/index.js` — registered `screens.MPInvestNowModal`.
- **Verdict changes**: `MPInvestNowModal.js` row in `DESIGN_COMPONENT_AUDIT.md` — `needs-logic-extraction` -> **migrated**.
- **Critical invariant preserved**: ALL payment gateway code (Razorpay, Cashfree, PayU, Apple IAP, Google Play) stays ENTIRELY in the container. The presentation NEVER touches payment SDKs, payment callbacks, or payment state. ALL API calls (axios), Digio e-signature flow, subscription creation, coupon validation, and investment amount calculation stay in the container.
- **What shipped**: The largest file in the app (5364 LOC) split into container (~3600 LOC of pure logic/state/effects/payment) and presentation (~1200 LOC of JSX/styles). All payment flows (one-time, recurring, iOS IAP, PayU WebView, Cashfree drop-in, Razorpay) call the exact same SDK methods with the exact same parameters — only the JSX rendering moved.
- **Validation**: Both files Babel-parse cleanly. Runtime smoke-test pending.
- **Behavior change in app**: zero for default variant. Custom variants gain ability to restyle the entire MP subscription wizard.
- **Next**: remaining Model Portfolio composites (MPReviewTradeModal, PricingCard, PerformanceChart).

---

## 2026-05-02 — Cleanup pass: 5 dead/orphan files deleted

- **Phase**: cleanup (parallel to Phase F/G — no migration semantics)
- **Surfaces touched**: deletions only. `src/screens/Drawer/{investContext,SubscriptionsScreen,use}.js`, `src/components/HomeScreenComponents/KnowledgeHubScreen/VideoPlayerModal.js`, `src/components/BrokerOverlay.js`.
- **Verdict changes**: `BrokerOverlay` row in audit Section 4 (Modal-shell consolidation findings + Per-modal verdicts) marked DELETED. Verdict tally `defer` count: ~2 → 1.
- **What shipped**: 5 file deletions (each ≤ 3.3KB; one was 0 bytes). Zero runtime callers across the repo — verified per file with grep against the symbol(s) each exported. Origin-doc for the cleanup is `docs/DESIGN_AUDIT_FINDINGS_2026-05-02.md` § Open follow-ups #2.
- **Why these specifically**: `investContext.js` exposed `InvestAmountContext` / `InvestAmountProvider` — every `invetAmount` reference in the app reads from local state or route params, not this context. `SubscriptionsScreen.js` was a 20-line `<Text>` stub never wired into Navigation. `use.js` was a dummy `payments` array import. `VideoPlayerModal.js` was 0 bytes. `BrokerOverlay.js` had zero imports — `CrossPlatformOverlay.js` (14 imports, all SDK-bound) is the live shell.
- **Validation**: grep confirms zero remaining imports of any deleted symbol or path. App builds unaffected (no entries removed from registries / Navigation / providers).
- **Behavior change in app**: zero.
- **Next**: Phase G batch 1 — Drawer `clean-extract` rows (PrivacyPolicy, T&C, ProductCatalog, ReviewScreen, CustomTabbarOrder).

---

## 2026-05-02 — Phase E.2: HomeScreen registry hookup (minimal — deep split deferred to E.3)

- **Phase**: E.2 — minimal registry hookup
- **Surfaces touched**: rename `src/screens/Home/HomeScreen.js` → `src/screens/Home/HomeScreenLegacy.js`; new thin resolver at `src/screens/Home/HomeScreen.js`; new re-export at `designs/default/screens/HomeScreen.js`; registry update.
- **Verdict changes**: HomeScreen row in audit Section 3 — partial migration (registry hookup ✅; container/presentation split deferred to Phase E.3).
- **Why minimal scope**: the legacy HomeScreen is 2657 lines with 8+ useEffect chains, Firebase messaging + notifee, EventEmitter listeners (cartUpdated + video/PDF requests), 4 Animated.Value refs (scrollY / animation / translateY / animatedFlatListPadding), and a hand-built `allTabData` array that mixes container logic with JSX subtrees. A render-extraction migration carries very high regression risk and is best done in a dedicated session with thorough emulator validation, not bundled with other phase work.
- **What this delivers**: HomeScreen is now resolvable via the design registry as `screens.HomeScreen`. A custom variant CAN ship its own `designs/<variant>/screens/HomeScreen.js` to fully replace the home screen — variants take responsibility for re-calling useTrade / useConfig / useNavigation themselves. Default variant re-exports HomeScreenLegacy so behaviour is unchanged for the default tenant.
- **Navigation.js consumers**: HomeScreen is imported twice (as `Home` route and as `Adv` route — same component for both). Both routes now dispatch through the resolver; both will pick up a custom variant if one is registered.
- **What's deferred to Phase E.3**: container / presentation split with clean viewModel + actions, token-driven colour migration, modal-shell extraction (most modals belong in Phase H once ModalShell primitive lands), `allTabData` decomposition into per-section composites (RebalanceSection, BespokeSection, KnowledgeHubSection).
- **Validation**: all 4 touched files Babel-parse cleanly. Runtime smoke-test pending — most important since the resolver layer is new.
- **Behavior change in app**: zero for default variant (re-export of legacy file). Custom variants gain replacement capability.
- **Next**: Phase E.3 (HomeScreen deep split) when scheduled. Until then, Phase E is functionally complete — variant overridability is the key architectural value, and that's now in place for HomeScreen.

---

## 2026-05-01 — Phase F batch 4: ChangeAdvisor (Phase F complete)

- **Phase**: F (batch 4 of 4 — final)
- **Surfaces touched**: 1 new presentation file in `designs/default/screens/`, 1 container rewritten in `src/screens/AccountSettingScreen/`, registry update.
- **Verdict changes**: ChangeAdvisor row in audit Section 3 moved from `needs-logic-extraction` → ✅ Migrated.
- **What shipped**: ~190-line presentation + ~190-line container (was 536 in legacy). All restart-app orchestration (RNRestart → DevSettings.reload → softRestart) and Alert dialogs preserved verbatim.
- **Phase F status**: complete. 9 surfaces migrated across 4 batches in a single day. Container/presentation pattern proven across 8 screens + 1 composite (TermsModal).
- **Validation**: all 3 touched files Babel-parse cleanly.
- **Next**: Phase E.2 — HomeScreen migration (the last big one).

---

## 2026-05-01 — Phase F batch 3: SignUpRADetails + PhoneNumberScreen migrations

- **Phase**: F (batch 3 of 4)
- **Surfaces touched**: 2 new presentation files in `designs/default/screens/`, 2 containers rewritten in `src/screens/Authentication/`, registry update.
- **Verdict changes**: SignUpRADetails + PhoneNumberScreen rows in audit Section 3 moved from `needs-logic-extraction` → ✅ Migrated.
- **What shipped**: see CHANGELOG entry. Standard pattern (handlers preserved in container, JSX moved to presentation).
- **Incidental fix**: PhoneNumberScreen container added the missing `import Config from 'react-native-config'`. Legacy file referenced `Config.*` without importing it — would have crashed if reached. Now functional.
- **Validation**: all 5 touched files Babel-parse cleanly.
- **Next**: batch 4 — ChangeAdvisor. Then Phase E.2 — HomeScreen.

---

## 2026-05-01 — Phase F batch 2: LoginScreen + SignupScreen migrations

- **Phase**: F (batch 2 of 4)
- **Surfaces touched**: 2 new presentation files in `designs/default/screens/`, 2 containers rewritten in `src/screens/Authentication/`, registry update.
- **Verdict changes**: LoginScreen + SignupScreen rows in audit Section 3 moved from `needs-logic-extraction` → ✅ Migrated.
- **What shipped**: see CHANGELOG entry for the file-by-file delta. LoginScreen ~1022 lines split into ~280-line presentation + ~430-line container. SignupScreen ~730 lines split into ~230-line presentation + ~270-line container. Render-extraction only — every Firebase / Google / Apple / orchestration handler preserved exactly.
- **Critical-path note**: these are the auth gates. Container preserved every code path bit-for-bit. Visual fidelity preserved — `Text`/`Icon`/`Spinner` primitives wrap legacy components; gradient hero + saturated CTA buttons unchanged.
- **Validation**: all 5 touched files Babel-parse cleanly.
- **Behavior change in app**: zero. Runtime smoke-test pending.
- **Next**: batch 3 — SignUpRADetails + PhoneNumberScreen (paired onboarding). Then batch 4 — ChangeAdvisor. Then Phase E.2 — HomeScreen.

---

## 2026-05-01 — Phase F batch 1: 4 clean-extract auth screens (ResetPassword, EmailScreenAppleLogin, TermsModal, LogOutScreen)

- **Phase**: F (batch 1 of 4)
- **Surfaces touched**: 4 new files in `designs/default/screens|composites/`, 4 containers rewritten in `src/screens/Authentication/`, registry update.
- **Verdict changes**: 3 screens + 1 modal moved from `clean-extract` → ✅ Migrated.
- **What shipped**: see CHANGELOG entry for the file-by-file delta.
- **Pattern**: same container/presentation contract from Phase E.1. Container = hooks + state + effects + orchestration; presentation = `({ viewModel, actions }) → JSX`. Token-driven colors where mapping is unambiguous; legacy hex retained for the gradient hero + saturated-green submit button (no current token equivalent).
- **Behavior change in app**: zero — functionally equivalent. Visual minor (token-driven text colors, primitive button base). Runtime smoke-test pending.
- **Validation**: all 9 touched files Babel-parse cleanly.
- **Next**: batch 2 — LoginScreen + SignupScreen (paired). Same orchestration shape (Firebase auth → post-login config reload + data load + nav).

---

## 2026-05-01 — Phase E prep: HomeScreen modal-state consolidation + useHomeScreenTabs

- **Phase**: E prep (E.1.5 — internal refactor, no `designs/` migration)
- **Surfaces touched**: `src/screens/Home/HomeScreen.js`, `src/screens/Home/hooks/useHomeScreenTabs.js` (new), `src/screens/Home/hooks/useHomeScreenModals.js` (new).
- **Verdict changes**: HomeScreen audit row's "Risks" subsection updated — both consolidations shown as ✅ Done. Phase E.2 marked unblocked.
- **What shipped (code)**:
  - `src/screens/Home/hooks/useHomeScreenTabs.js` (~70 lines) — owns `selectedTab` + a single `overlay: string | null` state where overlay name is one of `'bespoke' | 'bespokePlan' | 'mp' | 'mpPlan' | 'blogs' | 'videos' | 'pdfs' | null`. Exposes the canonical `overlay` / `setOverlay(name)` API AND backward-compat boolean shims for the 7 legacy `seeAllX` booleans + setters with the exact same names. The `setSeeAllX(false)` shim is idempotent — only closes if THIS overlay is the active one (so a stray `setSeeAllVideos(false)` from one place doesn't dismiss an unrelated overlay).
  - `src/screens/Home/hooks/useHomeScreenModals.js` (~70 lines) — owns `{ activeModal, activeModalData }` for 4 mutually-exclusive modals (`'ethical' | 'update' | 'video' | 'pdf' | null`). Exposes canonical `openModal(name, data)` / `closeModal()` API AND backward-compat shims for `showEthicalList` / `showUpdateModal` / `videoModalVisible` / `pdfModalVisible` + setters. Same idempotent-close behaviour as the tabs hook.
  - `src/screens/Home/HomeScreen.js` — 12 useState declarations replaced by 2 hook calls (destructured to expose the same legacy names). Call sites (~30+ references to the consolidated names across the 2631-line file) are unchanged thanks to the shims.
- **What did NOT change (intentional)**:
  - HomeScreen's other 30+ useState declarations (advices, ethical list data, video/PDF data, FCM token, etc.) — those touch unrelated state. Phase E.2 will tackle the broader split.
  - Every JSX usage of `seeAllX`, `showEthicalList`, `videoModalVisible`, etc. — they continue to read/write through the shims.
  - 8+ `useEffect` blocks — Phase E.2 will untangle their deps. Outside this prep's scope.
  - Animated header / scroll interpolation — Phase E.2 decision.
  - EventEmitter listeners for video/PDF requests from sibling components — Phase E.2 decision.
- **Why shims-with-same-names instead of a real refactor of every call site**:
  - The hook + shim approach changes 2 declarations + adds 2 imports. ~30 line diff in HomeScreen.
  - A real refactor would touch every `seeAllX` / `setSeeAllX` / `showXModal` / `setShowXModal` call site — ~60+ references in 2631 lines. High regression risk for a prep step that's supposed to make Phase E.2 SAFER.
  - Phase E.2 will do the real refactor when it splits the screen — at that point the shim usages naturally migrate to the canonical viewModel API in the presentation, and the shims can be dropped.
- **Validation**: all 3 touched files Babel-parse cleanly. `useState` grep against the consolidated names returns zero residual declarations in HomeScreen.js. Runtime smoke-test pending next emulator boot.
- **Behavior change in app**: zero. Shims preserve legacy semantics exactly (true → open, false → close-if-active).
- **What this unblocks**: Phase E.2 (HomeScreen migration). The viewModel can now expose `overlay`, `activeModal`, `activeModalData` cleanly instead of trying to flatten 12 booleans into the contract.
- **Regressions / rollbacks**: none caught in static analysis. If a runtime issue surfaces, the rollback is trivial — the hooks are net-additive in shape, so reverting the HomeScreen.js diff restores the 12 useState declarations without dropping any consumed state.
- **Next**:
  1. Phase E.2 — HomeScreen container/presentation split, using the new consolidated state as the viewModel basis.
  2. Audit-task queue (parallel): Drawer screens, composite catalog, KnowledgeHubScreen subfolder, AccountSettingScreen parent, MP-screen viewModel sketches.

---

## 2026-05-01 — Phase E.1: OrderScreen migration (container/presentation split + OrderRow composite)

- **Phase**: E.1 — Order screen migration
- **Surfaces touched**:
  - **Added**: `designs/default/composites/OrderRow.js`, `designs/default/screens/OrderScreen.js`, `src/utils/orderUtils.js`
  - **Modified**: `designs/default/index.js` (registered `composites.OrderRow` + `screens.OrderScreen`), `src/screens/Home/OrderScreen.js` (rewrote as ~120-line container)
  - **Net deletion**: ~900 lines of dead code removed from `OrderScreen.js`
- **Verdict changes**: OrderScreen `clean-extract` → ✅ Migrated. OrderRow added to Section 2 as Migrated.
- **What shipped (code)**:
  - **Container** (`src/screens/Home/OrderScreen.js`, ~120 lines, was 1195):
    - Owns `useTrade()`, `useConfig()`, `useModalStore()`, Firebase `getAuth()`, `useState` for `allOrders` + `loading`, two `useEffect`s (fetch on userEmail change, EventEmitter `cartUpdated` listener with cleanup).
    - Computes viewModel (`{ orders, isLoading, gradient: { start, end } }`) and actions (`{ openDdpiHelp({ broker }) }`) and renders the presentation resolved via `useComponent('screens.OrderScreen')`.
    - **Dead code removed in same commit:** PanResponder system (every callback returned `false` — pan never fired); `tabs` array + `animateToTab` + `Animated.Value` refs (defunct tab UI never rendered — JSX only renders `<PlacedOrders />`); `imageUrl` state + `fetchUserProfile` (set but never read); `isModalOpen` state + `MODAL_STATE` EventEmitter listener (consumed only by the dead PanResponder); `renderStatusIcon` (orphan, references undefined `item`/`color2`).
  - **Presentation** (`designs/default/screens/OrderScreen.js`, ~250 lines): receives viewModel + actions; renders the search row + FlatList. Includes inline `BasketRow` helper for orders with `basket_advice`. Empty-state hero uses LinearGradient with `viewModel.gradient` (advisor-themable). Search + price-range filter state stays as local UI state in presentation (filter math is `useMemo`).
  - **Composite** (`designs/default/composites/OrderRow.js`, ~180 lines): the legacy `OrderItem` extracted. Uses `Pill` (variant=profit / loss for BUY / SELL), `Icon` (lucide Check / X / Pause for status icons — replaces vector-icons AntDesign), `Text` primitives, `useTokens()` for colours where mapping is unambiguous. Owns its `showReason` UI state internally. Receives `onDdpiHelpPress` callback for the rejection-reason DDPI help link.
  - **2026-07-18 visual follow-up:** the presentation now uses the shared
    page/canvas/search/card hierarchy; `OrderRow` is a contained white card
    with an explicit broker, side and status grouping. This is visual-only:
    filtering, data fetch and DDPI-help behaviour remain in the container.
    Production-parity broker/type/status filters are intentionally local
    presentation state, so opening or leaving Orders does not mutate trade
    data, fetch state or the selected broker elsewhere in the app.
  - **2026-07-18 scrolling follow-up:** the screen title is the only compact
    fixed chrome. Search, count and broker/type/status filters are rendered as
    `FlatList.ListHeaderComponent`, so they scroll with the list and cannot
    permanently consume the area needed to read order cards on short phones.
    The empty state distinguishes an intentionally filtered empty result from
    a genuinely empty order history and states the current pending-order rule.
    Legacy rows with no stored status are deliberately excluded from the
    actionable Pending count rather than silently being treated as pending.
    Broker/type/status chip counts are cascading local derivations of the
    already-fetched order array; they update without a backend request.
  - **Utils** (`src/utils/orderUtils.js`, ~60 lines): `isToday`, `formatSymbol`, `formatOrderDate`, `getStatusColors`. Pure helpers — no hooks, no side effects. `getStatusColors` keeps the legacy hex pairs (`#F0FFE8` / `#16A085` for success, etc.) — a future PR may token-ify these.
- **What shipped (docs)**:
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § Migration order`: Phase E split into E.1 (shipped) and E.2 (HomeScreen — pending prep).
  - `docs/DESIGN_COMPONENT_AUDIT.md § Section 3 OrderScreen`: marked migrated with file paths + dead-code summary. Section 2 OrderRow row updated.
- **Visual deltas vs legacy** (intentional, design-system goal):
  - BUY/SELL pill bgs are now `tokens.colors.pnl.profitBg` / `lossBg` (was `#23bb3e` / `#ef344a` — pure greens/reds, slight delta to pastel via Pill primitive's variant).
  - Pill text colour now from primitive (`tokens.colors.pnl.profit` / `loss`) — was hardcoded white-on-saturated. **This is a noticeable change** — BUY/SELL labels go from white-on-green/red to dark-green/red on pastel-bg. Documented as intentional; revert by passing `style` override on Pill if pixel-perfect parity is needed.
  - Status icons switched from `react-native-vector-icons/AntDesign` to lucide (Check / X / Pause). Glyph sizes match (13pt).
  - All other styles preserved (orderContainer dimensions, search row, empty-state hero shape).
- **Validation**: all 5 touched files Babel-parse cleanly with project config. Runtime smoke-test pending next emulator boot.
- **Behavior change in app**: visible — the BUY/SELL pills are visually softer (pastel bg + colored text instead of saturated bg + white text). Functionally equivalent. Status pills unchanged. Empty state, search, list layout unchanged.
- **Pattern validation (Phase E.1's goal)**: ✅ confirmed end-to-end:
  1. Container holds all data deps + state + effects + viewModel + actions.
  2. Presentation receives viewModel + actions, renders pure JSX.
  3. Composite (OrderRow) extracted with own internal UI state, no data deps.
  4. Pure helpers extracted to `src/utils/`.
  5. Variant-aware: a custom `designs/<variant>/screens/OrderScreen.js` would now flow through the registry and override default for tenants on that variant.
- **Regressions / rollbacks**: none caught in static analysis. Runtime smoke-test pending.
- **Next**:
  1. **Phase E prep** (next commit): HomeScreen modal-state consolidation + `useHomeScreenTabs` hook extraction. No `designs/` migration yet — just internal refactor of `src/screens/Home/HomeScreen.js` to reduce surface area before Phase E.2 splits it.
  2. Phase E.2 — HomeScreen migration (after the prep refactor lands).

---

## 2026-05-01 — Phase D: RebalanceDetailsModal end-to-end (pivoted from IgnoreStockCard, which was orphan)

- **Phase**: D — One composite end-to-end
- **Surfaces touched**:
  - **Added**: `designs/default/composites/RebalanceDetailsModal.js` (migrated composite)
  - **Modified**: `designs/default/index.js` (registered `composites.RebalanceDetailsModal`), `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` (consumer updated to `useComponent`), `src/screens/Drawer/IgnoreTradesScreen.js` (dead import removed)
  - **Deleted**: `src/components/AdviceScreenComponents/RebalanceDetailsModal.js` (replaced by the new composite), `src/components/IgnoreStockCard.js` (dead code — zero consumers)
- **Verdict changes**:
  - `RebalanceDetailsModal`: `clean-extract` → ✅ **Migrated** (Section 2 row updated; Section 4 "RebalanceDetailsModal" row also flagged migrated). Note this surface is in scope post-MP-unfreeze policy reversal earlier today.
  - `IgnoreStockCard`: `clean-extract` (Phase D candidate per audit) → **DELETED** as dead code. Section 2 row reflects deletion.
  - `BrokerConnectCard`: flagged "likely **dead code**" — Phase D's audit found 0 consumers. Verify and delete in a cleanup PR if confirmed.
- **Pivot story** (worth documenting because it changes how future audit passes work):
  - The audit doc had recommended `IgnoreStockCard` as Phase D's first composite (small, pure-ish, near-clean).
  - I migrated it cleanly using primitives + tokens (`Card` / `Button` / `Icon` / `Text` / `useTokens`) and updated `IgnoreTradesScreen.js`'s import to use `useComponent('composites.IgnoreStockCard')`.
  - **Then discovered** the import in `IgnoreTradesScreen.js` was DEAD — the screen actually renders `<StockAdvices type="Ignore" />`, never the IgnoreStockCard component. Grep confirmed zero render-site consumers across the entire repo.
  - **Pivoted** to `RebalanceDetailsModal` (164 lines, real consumer in `RebalanceCard.js`, audit verdict `clean-extract`). Reverted the IgnoreStockCard registry registration, deleted the orphan composite file, deleted the orphan legacy `src/components/IgnoreStockCard.js`. Kept the dead-import removal in `IgnoreTradesScreen.js` as a small cleanup win.
  - **Audit doc fix in same commit**: Section 2 row for `RebalanceDetailsModal` updated to "Migrated"; `IgnoreStockCard` row flagged DELETED with explanation; `BrokerConnectCard` flagged "likely dead code" with a follow-up. New blanket note added at the end of Section 2: future audit passes MUST verify consumer count, not just data-dep analysis.
- **What shipped (code)**:
  - `designs/default/composites/RebalanceDetailsModal.js` — uses `Button` (primary, for the Close CTA), `Icon` (X for close), `Text` (title / labels / values / tag / button text), `useTokens()` for colors / spacing / radii / shadows. RN `Modal` kept as the shell (`ModalShell` primitive deferred to Phase H per the audit).
  - `designs/default/index.js` — `components` map now registers `composites.RebalanceDetailsModal`.
  - `src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js` — replaced direct import line with `import { useComponent } from '../../design/useDesign';` + added `const RebalanceDetailsModal = useComponent('composites.RebalanceDetailsModal');` next to the existing `const config = useConfig();` hook call.
  - `src/screens/Drawer/IgnoreTradesScreen.js` — removed dead `import IgnoreStockCard ...` line.
  - **Deleted**: legacy `src/components/AdviceScreenComponents/RebalanceDetailsModal.js` (replaced by the new composite — single consumer migrated). Orphan `src/components/IgnoreStockCard.js` (zero consumers, dead code cleanup).
- **Visual deltas vs legacy** (intentional, design-system goal — documented in the new composite's docstring):
  - Tag bg / Close button bg flow from `tokens.colors.brand.gradientEnd` (replaces `config.gradient2` with the corresponding token — same value for tenants that haven't customised).
  - All hardcoded colors (`#fff`, `#111827`, `#6B7280`, `#F9FAFB`, `#E5E7EB`) flow from `tokens.colors.*` mappings.
  - Border radius for the modal container is now `tokens.radii.lg` (12) — was 20. Minor delta.
- **Validation**: all 4 touched files Babel-parse cleanly with project config. Smoke-test deferred until next emulator boot.
- **Behavior change in app**: visible-but-minor — when the user opens the rebalance details modal in `RebalanceCard` it should look near-identical (corner radius slightly tighter, colors token-driven instead of hardcoded). Functionally equivalent.
- **Pattern validation (the goal of Phase D)**: ✅ confirmed end-to-end:
  1. Composite migrated to `designs/default/composites/`
  2. Registered with dot-namespaced key (`composites.RebalanceDetailsModal`)
  3. Consumer resolves it via `useComponent`
  4. Legacy file deleted
  5. Variant-aware: a custom `designs/<variant>/composites/RebalanceDetailsModal.js` would now flow through the same registry and override default for tenants on that variant.
- **Regressions / rollbacks**: none caught in static analysis. Runtime smoke-test pending next emulator boot.
- **Next**:
  1. Phase E — HomeScreen. Recommended to land alongside `OrderScreen` (already `clean-extract` per audit, simpler). HomeScreen needs the prep refactor noted in the audit (consolidate 4 modal booleans, extract `useHomeScreenTabs`).
  2. Audit-task queue (parallel, hard prerequisite for Phase G/I): Drawer screens, composite catalog (Audit-task B — partially advanced today by Phase D's pivot finding), KnowledgeHubScreen subfolder, AccountSettingScreen parent, MP-screen viewModel sketches.
  3. Cleanup PR candidate: confirm `BrokerConnectCard.js` is dead and delete if so.
  4. **New audit policy** (added Section 2 footer): every future migration row MUST verify consumer count, not just data-dep analysis. The IgnoreStockCard pivot was caused by trusting the audit's verdict without grep-confirming consumers.

---

## 2026-05-01 — Phase C: 9 primitives shipped (Text, Button, Card, Input, Spinner, Icon, Pill, Divider, Toast)

- **Phase**: C — Primitives
- **Surfaces touched**: `designs/default/primitives/` (new folder, 9 files), `designs/default/index.js` (registry update — registers all 9 primitives under `primitives.<Name>` keys). No call-site updates.
- **Verdict changes**: Section 1 of `DESIGN_COMPONENT_AUDIT.md` — all 8 `needs-creation` primitives moved to "shipped"; the 1 `clean-extract` (Toast) moved to "shipped". Net 9 primitives now in scope. `ModalShell` remains deferred to Phase H. `Skeleton` remains deferred indefinitely.
- **What shipped (code)**:
  - `designs/default/primitives/Text.js` — wraps RN `<Text>` with typography-token variant. Variants: `heading` / `title` / `subtitle` / `body` / `bodyEmphasis` / `caption` / `muted` / `button`.
  - `designs/default/primitives/Button.js` — wraps `TouchableOpacity`, auto-renders `Text variant="button"` for label. Variants: `primary` / `secondary` / `ghost` / `destructive`. Disabled state uses `text.disabled` for bg.
  - `designs/default/primitives/Card.js` — `<View>` wrapper. Variants: `default` (card shadow) / `elevated` (heavier shadow) / `outlined` (1px border, no shadow). Default padding `tokens.spacing.lg`, default radius `tokens.radii.lg`.
  - `designs/default/primitives/Input.js` — wraps `TextInput`. Variants auto-apply `secureTextEntry` / `keyboardType` / `maxLength` / `autoCorrect` / `autoCapitalize`.
  - `designs/default/primitives/Spinner.js` — `inline` returns bare `ActivityIndicator`; `overlay` returns absolute-positioned scrim + centered spinner.
  - `designs/default/primitives/Icon.js` — caller-passes-component pattern (`Component` prop) instead of name registry. **Why**: a wildcard `import * as Lucide from 'lucide-react-native'` registry would force every lucide icon into the Metro bundle (~500 KB+). Caller imports the specific icon at the call site; primitive only owns size/color defaults.
  - `designs/default/primitives/Pill.js` — `<View>` + nested `<Text variant="caption">`. Variants: `neutral` / `profit` (BUY/P&L positive) / `loss` (SELL/P&L negative) / `warning`.
  - `designs/default/primitives/Divider.js` — `solid` is filled 1px line; `dashed` is `borderStyle: 'dashed'` on a bordered View (RN's only way to render dashed lines).
  - `designs/default/primitives/Toast.js` — **imperative API, not a component**. `Toast.show(message, variant, options?)`. Wraps `react-native-toast-message`. Variants map: `info` → `info`, `success` → `success`, `warning` → `error` (RN-toast-message has no `warning` type by default), `error` → `error`. Existing `src/components/customToast.js` continues to work unchanged — Phase C is additive.
  - `designs/default/index.js` — `components` map now registers all 9 primitives under `primitives.<Name>` keys (e.g. `primitives.Button`).
- **What shipped (docs)**:
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § Primitives` — table replaces the prose catalog. Each primitive lists its variants and Phase C status. New § "How to consume a primitive in new code" subsection (direct import vs registry pattern). § "Call-site migration policy" subsection codifies the opportunistic-migration rule.
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § Migration order` — Phase C marked shipped.
  - `docs/DESIGN_COMPONENT_AUDIT.md § Section 1` — full rewrite. All shipped primitives now show "✅ Shipped" with file path + pre-existing call-site count. Verdict tally row for `needs-creation` updated to 0.
- **Validation**: all 10 new/updated files Babel-parse cleanly with the project's babel config. No runtime smoke-test possible without booting the app — primitives are passive until a consumer renders one.
- **Behavior change in app**: zero. No call sites updated. The 9 primitives are registered in the registry but no component currently calls `useComponent('primitives.*')`. Existing `customToast.js`, `<TouchableOpacity>`, `<Text>`, `<TextInput>`, `<ActivityIndicator>` patterns all continue to render exactly as before.
- **Bundle size impact**: minimal. 9 small files (~60 lines each) + their imports. Lucide is NOT wildcard-imported (Icon takes a `Component` prop), so no extra icon weight. `react-native-toast-message` was already imported via `customToast.js`.
- **Why ship 9 in one drop instead of one-at-a-time**: each primitive is small and the API conventions are uniform (variant prop, style prop wins, useTokens for token reads, ...rest passthrough). Designing them together produces a coherent surface; piecemeal would create 9 PR cycles for no review-confidence gain. Risk is low because zero call sites change.
- **Regressions / rollbacks**: none — pure addition.
- **Next**:
  1. Phase D — one composite end-to-end. Recommended: `IgnoreStockCard` (small, pure-ish per the audit) or `BasketCard` / `StockCard` from `UIComponents/StockAdvicesUI/`. Validates the container/presentation split + the `composites.<Name>` namespace.
  2. Audit-task queue (parallel): Drawer screens, composite catalog (Audit-task B — required before Phase D), KnowledgeHubScreen subfolder, AccountSettingScreen parent, MP-screen viewModel sketches (Audit-task G — required before Phase I).
  3. Opportunistic primitive call-site migrations as part of regular work — no scheduled sweep.

---

## 2026-05-01 — Phase B: DesignProvider skeleton shipped

- **Phase**: B — DesignProvider skeleton
- **Surfaces touched**: `src/design/` (new folder, 3 files), `designs/default/index.js` (new), `designs/registry.js` (new), `App.js` (1-line import + provider wrap).
- **Verdict changes**: none (no UI surface migrated — Phase B is foundation).
- **What shipped (code)**:
  - `src/design/DesignProvider.js` — React context provider. `useRef` freezes the resolved registry at mount. The `variant` prop, if provided, takes precedence over env vars (mostly for tests). `pickSelection()` orders sources: prop → `DESIGN_VARIANT` → `APP_VARIANT` → `default`. Each selection carries a `source` field so the resolver can shape its dev-warning correctly.
  - `src/design/resolveDesign.js` — pure resolver. Throws at startup if `designs/default/` is missing from the registry (the contract floor must exist). Shallow-merges variant's `components` over default's; layer-merges tokens by top-level key. Dev-warning fires only when source is `prop` or `DESIGN_VARIANT` and the requested variant isn't registered. Silent fallback for `APP_VARIANT` source (APP_VARIANT is a business-config selector, not a design selector — no matching design folder is normal).
  - `src/design/useDesign.js` — exports `useDesign()` and `useComponent(key)`. Both throw clear errors when used outside the provider or on missing keys.
  - `designs/default/index.js` — default variant root. `tokens` re-exported from existing `designs/default/tokens/`. `components` map empty (Phase C populates).
  - `designs/registry.js` — static variant map. Today: just `default`. Tenants register custom variants by adding an import line.
  - `App.js` — added `import DesignProvider from './src/design/DesignProvider';`. Wrapped existing provider tree (`SocialProofProvider` and below) with `<DesignProvider>`, placed inside `GestureHandlerRootView` and outside `SafeAreaView`.
- **What shipped (docs)**:
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § Registry` — rewritten. Old pseudocode replaced with actual file paths + the design rules that landed (frozen-at-mount via `useRef`, null default context, `pickSelection` source-aware warnings). § Migration order Phase B marked shipped with the actual deliverables.
- **Validation**: all 6 new/modified files Babel-parse cleanly with the project's babel config. Stub-registry smoke test of `resolveDesign` confirmed: (1) default fallback returns default tokens, (2) registered variant overrides default, (3) missing variant + `DESIGN_VARIANT` source warns and falls back, (4) missing variant + `APP_VARIANT` source silently falls back. Behavior matches the architecture-doc spec.
- **Behavior change in app**: zero. The provider is mounted but its `components` map is empty, so no component currently calls `useComponent`. The app behaves identically to pre-Phase-B.
- **Where the new context sits in the provider stack** (App.js):
  ```
  SafeAreaProvider
    GestureHandlerRootView
      DesignProvider          ← new (Phase B)
        SocialProofProvider
          CartProvider
            ConfigProvider
              TradeProvider
                GstConfigProvider
                  ModalProvider
                    SdkRootWrapper
                      Navigation
  ```
  Outside `ConfigProvider` because the variant is determined at build time from env vars, NOT from the advisor config (per architecture doc — backend per-tenant variant override is deferred to a future PR).
- **Regressions / rollbacks**: none. App start path is unchanged; the new provider is a no-op until something calls `useComponent`.
- **Next**:
  1. Phase C — primitives. Order: `Toast` (only existing `clean-extract`) → `Text` → `Button` → `Card` → `Input` → `Spinner` → `Icon` → `Pill` → `Divider`. Each lands as: implementation in `designs/default/primitives/<Name>.js` → registered in `designs/default/index.js` `components` map → opportunistic call-site updates in subsequent commits.
  2. Audit-task queue (parallel): Drawer screens, composite catalog, KnowledgeHubScreen subfolder, AccountSettingScreen parent, MP-screen viewModel sketches (Audit-task G — required before Phase I).

---

## 2026-05-01 — Policy reversal: MP-freeze lifted, MP surfaces in scope

- **Phase**: cross-cutting policy update
- **Surfaces touched**: none (docs only)
- **Verdict changes**: ~38 surfaces previously flagged `SDK-pending` are now re-verdict-ed by data deps. Net: ~12 of them flip to `clean-extract`, ~26 to `needs-logic-extraction`. Zero remain `SDK-pending`. (`SDK-pending` is retained as a verdict but its definition narrows — it now applies only to surfaces with an active, committed Phase 3 SDK migration in flight, not preemptively for "this might move to SDK someday".)
- **What changed (policy)**:
  - **Decision**: Model Portfolio / rebalance surfaces are pulled back into the design-system migration scope. They get migrated alongside everything else, on the same container/presentation contract.
  - **Risk accepted**: if the SDK MP plan firms up later (per `docs/SDK_MOBILE_FIT_ASSESSMENT.md`), the design-system work on the affected surfaces will be partially or fully thrown away. Highest-risk surfaces flagged in their audit notes (`RebalanceModal`, `RebalanceCard` — calculate-rebalance UX is the most likely SDK absorption target).
  - **Rationale**: a consistent, fully-tenant-skinnable app today is more valuable than a two-tier UX (where MP screens look different from the rest) waiting on an undecided SDK plan. Container/presentation split work has some reuse value even if presentation goes — the viewModel shape is what a future SDK widget would consume.
- **What changed (docs)**:
  - `CLAUDE.md § Design System Migration` — removed the blocking-rule preventing MP migration. Replaced with an "MP-aware" note that records the future-SDK risk explicitly.
  - `CLAUDE.md § Every session's checklist` — design-system checklist box updated: "MP surfaces are in scope as of 2026-05-01 — verdict by data deps, not by MP-coupling."
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § What surfaces are in scope vs deferred` — rewrote the section. MP screens explicitly listed as **in scope**. New § "Note on MP and the SDK — accept the risk" subsection records the policy decision, the trade-off, and what happens if/when the SDK MP plan resolves either way. § Migration order Phase I redefined: was "Reassess MP freeze", now "MP screens" (the largest single phase by surface count, scheduled last so the rest of the app's pattern is settled by then).
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § Verdict legend` — `SDK-pending` definition narrowed (see above).
  - `docs/DESIGN_COMPONENT_AUDIT.md`:
    - Section 7 (`ModelPortfolioComponents/`) — full rewrite. All 20 files re-verdict-ed: 9 `clean-extract`, 11 `needs-logic-extraction`. Each row gets a phase (mostly Phase I) and a note. `RecommendationSuccessModal` flagged for Phase G/I (cross-imported).
    - Section 4 (Modals) — 6 rows re-verdict-ed: `MPReviewTradeModal`, `RebalanceModal`, `RebalanceAdviceContent`, `RebalancePreferenceModal`, `RebalanceCard`, `StepProgressBar`. `RebalanceModal` + `RebalanceCard` flagged "high SDK-migration risk".
    - Section 5 (`AdviceScreenComponents/`) — 6 rows re-verdict-ed: `AddtoCartModal`, `MPStatusModal`, `RebalanceAdviceContent`, `RebalanceAdvices`, `RebalanceModal`, `ReviewTradeTextRebalance`. Two earlier "borderline" rows (`RebalanceDetailsModal`, `RepairConfimationModal`) resolved to `clean-extract`.
    - Section 3 (Screens) — "Frozen MP screens" subsection retitled and rewritten as "Model Portfolio screens (in scope as of 2026-05-01 — Phase I)" with provisional verdicts pending viewModel-sketch audit-task (Audit-task G in the queue).
    - Section 8 (UIComponents folder) — `RebalanceAdvicesUI/` row updated.
    - Drawer screens TBD list — `RebalanceNotificationComponent`, `ModifyInvestment1` no longer auto-frozen.
    - Verdict legend — `SDK-pending` row rewritten.
    - "How to fill a row" rule #4 rewritten.
    - Audit-task queue — task D (RebalanceDetailsModal/RepairConfimationModal verification) marked resolved by the policy change. Two new audit tasks added: G (MP-screen viewModel sketches before Phase I) and H (KitePublisherModal SDK-call verification).
    - Verdict tally rewritten: ~30 `clean-extract`, 8 `needs-creation`, ~50 `needs-logic-extraction`, 0 `SDK-pending`, ~30 `SDK-bound-skip`, ~2 `defer`, ~20 TBD. Total in scope ~88 (roughly doubled from pre-unfreeze ~50).
- **What did NOT change**:
  - Phase 3 SDK-bound surfaces (`Phase3SdkBrokerModal`, legacy `BrokerConnectionModal/*`, `UIComponents/BrokerConnectionUI/*`, `CrossPlatformOverlay`, `ManageConnectionsModal`, `DisconnectBrokerModal`, `BrokerConnectionError`) remain `SDK-bound-skip`. Phase 3 contract is unchanged.
  - Token bundle (Phase A) is unchanged.
  - The architecture's 4-layer model, registry contract, container/presentation split rule, and SDK boundary are all unchanged.
  - The fix-the-prior-undocumented-delta-before-the-next rule still holds.
- **Updated memory record**: `~/.claude/projects/-home-pratik-PycharmProjects-Alphab2bapp/memory/project_mp_sdk_pending.md` rewritten to reflect the new policy. The memory now records "MP surfaces ARE in scope; future SDK migration is a known risk" rather than the previous freeze.
- **Regressions / rollbacks**: none — docs only.
- **Next**:
  1. Phase B — `DesignProvider` skeleton (unchanged plan).
  2. Phase C — primitives starting with `Toast` (unchanged plan).
  3. Audit-task queue gains tasks G + H. The MP-screen viewModel sketches (Audit-task G) become a hard prerequisite for Phase I.

---

## 2026-05-01 — Phase A: token bundle shipped (no component changes)

- **Phase**: A — Tokens absorption
- **Surfaces touched**: `src/theme/` (additions), `designs/default/tokens/` (new folder), no consumers updated.
- **Verdict changes**: none (no surface migrated yet — Phase A is foundation).
- **What shipped (code)**:
  - `src/theme/spacing.js` — `DEFAULT_SPACING` (`none` / `xs` / `sm` / `md` / `lg` / `xl` / `xxl` / `xxxl`) + `buildSpacing(config)`. Reads `config?.spacingTokens` for future backend override.
  - `src/theme/typography.js` — `DEFAULT_TYPOGRAPHY` (8 roles: `heading` / `title` / `subtitle` / `body` / `bodyEmphasis` / `caption` / `muted` / `button`). Each role is an RN style object with `fontFamily` / `fontSize` / `lineHeight` / `fontWeight`. **Default fontFamily is Poppins** (Poppins-Bold / Poppins-SemiBold / Poppins-Medium / Poppins-Regular — all shipped in `android/app/src/main/assets/fonts/`). `buildTypography(config)` reads `config?.typographyTokens` for future override.
  - `src/theme/radii.js` — `DEFAULT_RADII` (`none` / `sm` / `md` / `lg` / `xl` / `pill`) + `buildRadii(config)`.
  - `src/theme/shadows.js` — `DEFAULT_SHADOWS` (`none` / `card` / `elevated` / `modal` / `floating`). Each token sets BOTH iOS (`shadowColor` / `shadowOffset` / `shadowOpacity` / `shadowRadius`) AND Android (`elevation`) keys so the same token works on both platforms. `buildShadows(config)` reads `config?.shadowTokens`.
  - `src/theme/useTokens.js` — composite hook returning `{ colors, spacing, typography, radii, shadows }`. Memoized on the same colors deps as `useColors.js` plus the four future override fields (`spacingTokens` / `typographyTokens` / `radiiTokens` / `shadowTokens`) so memoization is correct the moment ConfigContext passes them through.
  - `designs/default/tokens/index.js` — registry-facing re-exports of all five token modules. The `DesignProvider` (Phase B) will import from this path.
- **What shipped (docs)**:
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § Tokens` — corrected the example: it cited `Inter-Regular` etc., but the repo ships **Poppins + Satoshi**, not Inter. Section now describes the actual two-layer setup (implementation in `src/theme/`, surface in `designs/<variant>/tokens/`) and lists the `DEFAULT_*` shapes shipped today.
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § Layer model` — Tokens row now reads "Phase A complete (2026-05-01)" instead of "Colors only — to absorb".
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md § Migration order` — Phase A marked shipped with the actual deliverables.
- **Existing `useColors()` continues to work unchanged** — Phase A is purely additive. No call sites updated. Components opt into `useTokens()` going forward.
- **Backend override wiring deferred** — `ConfigContext.js` does NOT yet expose `spacingTokens` / `typographyTokens` / `radiiTokens` / `shadowTokens`. The `build*()` functions are config-aware (they look for these fields) but ConfigContext explicitly enumerates picked apiData fields, so today these resolve to `undefined` and defaults apply. Wiring them is a small additive PR — separate from Phase A so a regression in token plumbing doesn't conflate with a regression in ConfigContext's existing colorTokens path.
- **Regressions / rollbacks**: none — pure addition, zero call-site changes.
- **Next**:
  1. Phase B — `DesignProvider` skeleton at `src/design/DesignProvider.js`. Wire under `AppProvider`. Empty registry. Resolution rules + frozen-at-mount semantics. No component registrations yet.
  2. Phase C — primitives, starting with `Toast` (only existing `clean-extract`), then `Text` → `Button` → `Card` → `Input` → `Spinner` → `Icon` → `Pill` / `Divider`.
  3. Audit-task queue (parallel): Drawer screens, composite catalog, KnowledgeHubScreen subfolder, AccountSettingScreen parent.
  4. Optional follow-up: ConfigContext passthrough for `spacingTokens` / `typographyTokens` / `radiiTokens` / `shadowTokens` so backend overrides become live (zero-risk wiring once a tenant requests it).

---

## 2026-05-01 — Audit-task pass complete (doc-only)

- **Phase**: pre-A (audit gate before code)
- **Surfaces touched**: none — docs only
- **Verdict changes**: all 11 audit tasks from the initial draft of `DESIGN_COMPONENT_AUDIT.md` resolved. New verdict counts (in scope, ~50 surfaces): ~18 `clean-extract`, 8 `needs-creation` (primitives), ~22 `needs-logic-extraction`, ~2 `defer`. Frozen / out-of-scope: ~30 `SDK-bound-skip`, ~38 `SDK-pending`. Still TBD: ~20 (most `src/screens/Drawer/`, `KnowledgeHubScreen/` subfolder, composite catalog, `AccountSettingScreen/` parent — queued as a new audit-task list, Section 9 § New audit-task queue).
- **What shipped (docs)**:
  - `docs/DESIGN_COMPONENT_AUDIT.md` rewritten end-to-end. Section 1 (Primitives), Section 3 (Screens — HomeScreen, OrderScreen, WatchlistScreen, PortfolioScreen, HoldingScoreModal, all 8 Authentication screens, ChangeAdvisor, MP-frozen rows, Drawer TBD list), Section 4 (Modals + modal-shell consolidation findings), Section 5 (AdviceScreenComponents — 20 files), Section 6 (HomeScreenComponents — 14 files), Section 7 (ModelPortfolioComponents — all 20 frozen), Section 8 (UIComponents folder), Section 9 (audit-task pass log + new queue), and verdict tally — all filled in.
- **Key findings worth flagging up the chain**:
  1. **Primitive fragmentation is high.** ~1,248 raw `TouchableOpacity` usages, ~2,123 raw `Text` usages, ~199 `ActivityIndicator` usages, ~151 raw `TextInput` usages — almost no shared wrappers exist. Phase C will be high-volume call-site updates, not light extraction. Only `customToast.js` is a usable existing primitive (becomes `Toast`).
  2. **Modal-shell consolidation deferred to Phase H.** The two existing shell candidates (`CrossPlatformOverlay`, `BrokerOverlay`) are SDK-bound or unused. Design `ModalShell` fresh when the first non-SDK modal migrates.
  3. **`ResetPassword` is the recommended first-shipped screen migration in Phase F.** Smallest, lowest-risk, single Firebase call. Use it as the pattern-prove for screen-level container/presentation splits before tackling `LoginScreen` / `SignupScreen`.
  4. **`OrderScreen` and `WatchlistScreen` are `clean-extract`** — they're candidate proof-of-concept screens for Phase E alongside (or even before) `HomeScreen`. `HomeScreen` itself is `needs-logic-extraction` and needs a prep refactor (consolidate 4 modal booleans → `{ activeModal, activeModalData }`; extract `useHomeScreenTabs`).
  5. **All 20 `ModelPortfolioComponents/` are `SDK-pending`.** `RecommendationSuccessModal` is cross-imported by 5 non-MP advice surfaces but its spec is locked to MP/rebalance trade-success display — frozen with the rest. If MP migrates to SDK, this modal goes with it.
  6. **`StepProgressBar` all 4 call sites are MP/rebalance** — `SDK-pending`, no exception.
  7. **`ReviewTradeModal` is `needs-logic-extraction`** (used in non-MP `StockAdvices.js` and `AddtoCartModal.js`). Surveillance API + EventEmitter + AsyncStorage all live inside — container owns. Phase G.
  8. **Two borderline rows pending verification (Audit-task D, queued):** `RebalanceDetailsModal.js` and `RepairConfimationModal.js`. Names suggest rebalance-flow coupling but agent flagged both `clean-extract`. Verify call sites before migrating; default to `SDK-pending` if exclusively used by rebalance code.
  9. **`BrokerOverlay.js` is unused (0 imports).** Candidate for deletion in a separate cleanup PR.
  10. **Font correction**: `DESIGN_SYSTEM_ARCHITECTURE.md § Tokens` cited `Inter-Regular` etc. in its example. The repo actually ships **Poppins** + **Satoshi**. Phase A will use Poppins/Satoshi and the architecture doc will be corrected in the same commit.
- **Regressions / rollbacks**: none — docs only.
- **Next**:
  1. Phase A — extend `src/theme/` to a full token bundle (spacing/typography/radii/shadows on top of existing colors). Create `designs/default/tokens/index.js` re-exporting them. Add `useTokens()`. Correct the Inter→Poppins/Satoshi typo in the architecture doc. Single PR.
  2. Phase B — `DesignProvider` skeleton. Empty registry under `AppProvider`. No component registrations.
  3. Audit-task queue (parallel to Phase B/C): Drawer screens, composite catalog, KnowledgeHubScreen subfolder, AccountSettingScreen parent.

---

## 2026-05-01 — Architecture docs created (no code change)

- **Phase**: pre-A (documentation foundation)
- **Surfaces touched**: none (docs only)
- **Verdict changes**: n/a — initial audit. ~25 surfaces flagged `SDK-bound-skip` (all Phase 3 broker surfaces), ~25 surfaces flagged `SDK-pending` (Model Portfolio + rebalance flows — likely future SDK migration per `SDK_MOBILE_FIT_ASSESSMENT.md`), ~15 surfaces flagged `needs-logic-extraction` (in-scope screens/modals), ~40 still TBD pending audit-task pass.
- **What shipped**:
  - `docs/DESIGN_SYSTEM_ARCHITECTURE.md` — full design: 4-layer model (tokens / primitives / composites / screens), `DesignProvider` registry contract, container/presentation split rule, SDK boundary, MP-freeze rule, variant resolution, migration phases A–I.
  - `docs/DESIGN_COMPONENT_AUDIT.md` — per-surface verdict matrix (this file's companion), 11 open audit tasks listed.
  - `docs/DESIGN_MIGRATION_PROGRESS.md` — this file.
  - `CLAUDE.md` — added the design-system blocking-doc rule (mirrors the Phase 3 rule) and listed the new doc trio.
  - `docs/CHANGELOG.md` — entry tagged "design-system architecture".
- **Key decisions locked**:
  - Builds on top of existing `src/theme/` + `useColors()` (already advisor-overridable). Tokens layer absorbs spacing/typography/radii alongside colors.
  - SDK-bound surfaces (`Phase3SdkBrokerModal`, all SDK widgets) NEVER move to `designs/`. The legacy `src/components/BrokerConnectionModal/*` and `src/UIComponents/BrokerConnectionUI/*` are also `SDK-bound-skip` — they're scheduled to be deleted as Phase 3 reaches 100%, no investment there.
  - **Model Portfolio surfaces are FROZEN as `SDK-pending`** — calculate-rebalance, MP review trade, MP performance, ModelPortfolioComponents/* (all 15 files), RebalanceCard, RebalancePreferenceModal, RebalanceModal, RebalanceAdviceContent, RebalanceAdvices, MPReviewTradeModal, ModelPFCard, ModelPortfolioScreen, MPPerformanceScreen, CustomTabbarMPPerformance, EmptyStateMP. These are likely future SDK migrations and migrating them to `designs/` now would be thrown-away work.
  - Variant selection via `DESIGN_VARIANT` env var (falls back to `APP_VARIANT`, then to `default`). Build-time only in v1; no runtime variant switching, no per-tenant component overrides via backend (tokens stay backend-overridable as they are today).
  - No package extraction. `designs/` is part of this repo.
- **Regressions / rollbacks**: none — docs-only.
- **Next**:
  1. Run audit-task pass (the 11 tasks in `DESIGN_COMPONENT_AUDIT.md § Open audit tasks`) to fill in TBD rows. This is doc work, not code.
  2. Once audit is complete for Phase A surfaces, start Phase A — extend `src/theme/` to a full token bundle (spacing/typography/radii on top of existing colors). Create `designs/default/tokens/` re-exporting them.
  3. Phase B — `DesignProvider` skeleton. No component registrations yet.
  4. Phase C onward — primitives, then one composite, then HomeScreen.
- **Reassess MP freeze**: revisit when the SDK MP plan firms up (tracked separately, see `docs/SDK_MOBILE_FIT_ASSESSMENT.md`). If SDK MP is dropped, the freeze lifts and these surfaces enter `designs/` migration. If SDK MP ships, the freeze becomes permanent and these surfaces follow the Phase 3 contract instead.

---

## 2026-07-18 — Portfolio/MP presentation corrections

- `PortfolioCard`: normalises currency only at render time (whole rupees for
  invested, two decimals for P&L), preventing exposed IEEE floating-point
  artefacts while preserving underlying broker calculation precision.
- `PortfolioCard` is now the scrolling header of holdings and positions rather
  than fixed chrome. Its source label resolves a named broker account and
  describes dummy/demo/paper data as a simulated portfolio, so the data origin
  is unambiguous without consuming most of a short screen.
- `MPCard` Home presentation uses a bounded horizontal card width and two-line
  title clamp. This is a layout contract for both Android and iOS, not a
  platform-specific workaround. Entitlement copy on both this card and the
  embedded Portfolio summary is sourced only from the server-filtered
  `TradeContext` model-portfolio entitlement snapshot.
- `MPPerformanceScreen` uses the same snapshot for the Portfolio and Research
  tabs. Non-subscribers receive a clear report-benefit explanation and
  subscription action, rather than an ambiguous “No reports” empty state.
- `PortfolioScreenPresentation`: moved the Trade P&L entry into the Model
  Portfolio list header so it participates in normal scrolling; removed the
  duplicate fixed placement and an empty-state conflict.
- `MPInvestNowModal` presentation: reserved header space and fixed the close
  control position so it cannot be clipped beyond the right edge.
- No registry, token, primitive, provider, or container/presentation ownership
  change. This is a focused presentation-maintenance entry.
- `LinkOpeningWeb` blog reader: constrains the article title and reserves a
  fixed padded close target, preventing the close icon from being clipped by a
  long title on narrow screens.
- `PortfolioSummaryCard`: align the summary table, status treatment and helper
  copy with the Portfolio screen’s Poppins hierarchy; expired status remains
  available but never attaches to or wraps the fund name.
- `MPCard` plan selection: add list clearance below tabs and correct card
  containment/metric/action hierarchy without changing pricing or subscription
  mechanics.
- `MPPerformanceScreen`: moved the detailed summary into the Overview scroll
  path, standardised header/action typography and tap targets, replaced the
  headline CAGR treatment with a contextual historical-performance entry,
  labelled volatility as manager-selected, and scrolls to the chart after
  performance consent. Subscription, payment and chart-fetching logic remain
  in the container.
- `AfterSubscriptionScreen`: clarified the holdings/target/strategy hierarchy,
  removed the duplicate/misleading expiry presentation, and moved Exit/Modify
  into an adaptive safe-area action bar. The detail hero and Holdings tab now
  keep a dedicated loading presentation until broker/subscription data settles,
  preventing a completed portfolio from briefly appearing empty. Data ownership
  remains unchanged.
