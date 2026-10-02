# Configurable Navigation — Design

> **Status**: P0–P3 BUILT 2026-10-01 (unreleased; see §8 and §11). P4 (fork
> adoption) not started. Written 2026-10-01.
> **Owner area**: Alphab2bapp shell (`src/components/Navigation.js`) + design
> system (`designs/`). Companion docs: `DESIGN_SYSTEM_ARCHITECTURE.md`,
> `SDK_DESIGN_PASSTHROUGH.md`.
> **Branch of record**: `release/deploy_5.1` (see root `CLAUDE.md`).

---

## 1. Problem

A tenant's design can change how screens look without touching shared code:
design tokens, component overrides and whole screen presentations under
`designs/<variant>/`. It **cannot** change the app's structure:

- which tabs exist, their order, labels and icons;
- which tab the app opens on;
- what the More menu contains and in what order;
- the order of the pre-login marketing screens.

All of that is hard-coded JSX in `src/components/Navigation.js` (903 lines).
Tenant differences are expressed as literal checks inside that file:

- `selectedVariant === 'arfs'` swaps the Plans tab for News;
- `HEADER_VARIANTS = new Set(['default', 'moneyman_app'])` decides whether the
  legacy toolbar shows.

The design system only owns how the tab bar is drawn (`shell.MainTabBar`),
not what's in it.

### 1.1 Evidence that this is already costing us

Every mobile fork carries its own copy of `Navigation.js`. Local clones,
compared on 2026-10-01 against Alphab2bapp `release/deploy_5.1`:

| Fork | Lines differing | Tab set |
|---|---|---|
| markup_app | 239 | Home, Orders, Portfolio, News/Plans, More |
| moneyman_app | 239 | same |
| zamzam_app | 246 | same |
| Kaizen_app | 274 | same |
| marketanalysis_app | 299 | same |
| new_magnus_app | 826 | Home, **Advices**, Orders, Portfolio, News, **History**, More, **Watchlist** |
| rgx_app | 947 | same as default |
| Alphanomy | 947 | same as default |
| arfs_app | 1,219 | Home, Orders, Portfolio, News, **History**, **Watchlist** |

P0 re-ran this against each fork's most recent remote release branch — see
§11 for the result. It confirms the picture above but reframes it: the
divergence is mostly lag, not deliberate navigation.

Two forks already restructured tabs, and every fork pays merge cost on each
sync. The next tenant redesign will ask for a different tab set, so this is
recurring demand, not a one-off.

---

## 2. Goals and non-goals

**Goals**

1. A variant declares its tabs (which, order, label, icon), initial tab, More
   menu sections, and pre-login screen order **as data**, with no fork of
   `Navigation.js`.
2. The default variant reproduces today's app exactly, down to route names.
3. Existing `navigate()` calls, deep links and push-notification routing keep
   working unchanged.
4. Navigation changes ship over OTA to OTA-capable binaries (JS-only).
5. Forks can delete their `Navigation.js` divergence once their manifest
   reproduces it.

**Non-goals**

- Reordering or skipping money/compliance steps (§5). Out of scope permanently.
- Server-driven tab *structure* at runtime (§6).
- The web app (`prod-alphaquark-github`) has its own layout system and is
  unaffected.
- New screens. This makes existing screens placeable; building a screen stays
  normal feature work.

---

## 3. Current state (facts the design depends on)

- **Root stack** (`Navigation`) registers about 50 `Stack.Screen`s: Splash,
  Login, Onboarding, PhoneLogin, `Home` (mounts `MainTabNavigator`),
  `HomeS` (the same tabs), `More`, subscription/payment/research/course screens.
- **Tab navigator** (`MainTabNavigator`) renders `Home` (AdviceScreen), `Orders`,
  `Portfolio`, `Plans` or `News`, and `More`. `More` is a **fake tab**: its
  `tabPress` is prevented and it navigates to the `More` stack screen.
- **Tab bar presentation** comes from `useComponent('shell.MainTabBar')`, via
  `DesignTabBar`, which already passes `items[]` built from navigator state.
  The presentation layer won't need changes.
- **Coupling to route names is low.** About 25 `navigate()` calls target tab
  or root names (`Home` 14, `Orders` 3, `News` 3, `More` 3, `Plans` 1,
  `HomeS` 1, `Portfolio` 0). Only 3 nested `{screen: …}` targets exist, and
  none target a tab. `src/utils/smartLink.js` and push routing land on `Home`.
- **The More menu is already data-shaped.** `src/screens/Home/AccountSettingsScreen.js`
  builds `sections[]` (Account / Insights / More Links / Legal), gated by
  config flags (`coursesEnabled`, `webinarsEnabled`, config-driven links).
- **The pre-login order is already partly flag-driven.** `SplashScreen` routes
  to `Onboarding` → `PhoneLogin` only when `config.phoneFirstLoginEnabled`;
  otherwise it goes to `Login`.
- **Variant shape is `{ name, tokens, components }`** (`designs/registry.js`,
  `designs/default/index.js`), read via `useDesign()` / `useComponent(key)`.
  Unspecified keys fall back to the default variant.
- **Layout constant**: `TAB_BAR_HEIGHT = 60` positions the add-to-cart sheet
  (`getBottomSheetPosition`). A variant with a different tab-bar height
  currently mis-positions it.

---

## 4. Design

### 4.1 Screen catalog — `src/navigation/screenCatalog.js` (new, src-owned)

This is the one list of screens a variant is allowed to place in the tab bar
or the More menu. Each entry:

```js
advice: {
  component: AdviceScreen,        // src import — designs never import screens
  routeName: 'Home',              // legacy route name, kept stable (§4.4)
  placement: ['tab'],             // where it may appear: 'tab' | 'more'
  requires: null,                 // or a config flag key, e.g. 'coursesEnabled'
  defaultLabel: 'Home',
  defaultIcon: 'home',
},
```

Initial keys, derived from the default app plus the fork tabs in §1.1:

| Key | Route name | Placement | Notes |
|---|---|---|---|
| `advice` | `Home` | tab | AdviceScreen |
| `orders` | `Orders` | tab | |
| `portfolio` | `Portfolio` | tab | |
| `plans` | `Plans` | tab, more | `ModelPortfolioScreen type="tab"` |
| `news` | `News` | tab, more | |
| `watchlist` | `Watchlist` | tab | from arfs/magnus (`WatchlistScreen`) |
| `more` | `More` | tab (action) | fake tab → stack `More` |
| `brokerAccount`, `mySubscription`, `researchReport`, `invoices`, `knowledgeHub`, `recommendationMessages`, `courses`, `webinars`, `privacyPolicy`, `terms`, `deleteAccount`, `logout`, … | existing stack names | more | lifted from `AccountSettingsScreen` sections |

The catalog is `src/`-owned, so the design-boundary rule still holds: a design
names a key, and `src` resolves the component.

### 4.2 Navigation manifest — `designs/<variant>/navigation.js` (new, data only)

```js
export default {
  tabs: [
    { key: 'advice', label: 'Home', icon: 'home' },
    { key: 'orders' },
    { key: 'portfolio' },
    { key: 'plans' },
    { key: 'more' },
  ],
  initialTab: 'advice',
  moreMenu: [
    { title: 'Account',  items: ['brokerAccount', 'mySubscription', 'linkAccount', 'changeManager'] },
    { title: 'Insights', items: ['researchReport', 'watchlist', 'invoices', 'knowledgeHub',
                                 'recommendationMessages', 'courses', 'webinars'] },
    { title: 'More Links', items: ['$configLinks'] },  // placeholder for config-driven links
    { title: 'Legal',    items: ['privacyPolicy', 'terms', 'deleteAccount', 'logout'] },
  ],
  preLogin: ['onboardingCarousel', 'phoneLogin'],   // used only when the flow is enabled
  chrome: { legacyToolbar: true, tabBarHeight: 60 },
};
```

Rules:

- **Data only.** No imports except other data. Enforced by extending
  `scripts/audit-design-boundaries.js` (§8 P3).
- **Registration.** The variant object gains an optional fourth field:
  `{ name, tokens, components, navigation }`.
- **Fallback.** Any top-level manifest key the variant omits (`tabs`,
  `moreMenu`, …) falls back to the default variant's value, key by key. Arrays
  are replaced whole, never merged, so a variant that lists four tabs gets
  exactly four.
- **The default manifest must reproduce today's app exactly.** The arfs
  News-for-Plans swap is NOT an upstream manifest: per the fork convention
  (`DESIGN_SYSTEM_ARCHITECTURE.md` § "Where variant folders live"), non-default
  variants live in fork repos, and the arfs fork already owns
  `designs/arfs/index.js`. Its manifest ships with the arfs fork in P4 (§11).
- `chrome.legacyToolbar` replaces the `HEADER_VARIANTS` set, with a
  transitional gate: the toolbar also still requires `DESIGN_VARIANT` to be
  unset or `default`/`moneyman_app`, so a fork whose `DESIGN_VARIANT` isn't
  registered here keeps today's hidden toolbar until its own manifest declares
  `chrome.legacyToolbar` (then remove the gate).

### 4.3 Resolver — `src/navigation/resolveNavigation.js` (new, pure function)

`resolveNavigation(manifest, catalog, flags)` returns
`{ tabs, initialRouteName, moreSections, preLogin, chrome, warnings }`.

1. Map each manifest key to its catalog entry. **Drop unknown keys** and record
   a warning, which is emitted once per session as a `frontend_anomaly`
   (`nav_manifest_unknown_key`). Never crash on a bad manifest.
2. Drop entries whose `placement` doesn't allow the slot they were put in
   (e.g. `deleteAccount` as a tab).
3. Drop entries whose `requires` flag is off (runtime show/hide, §6).
4. Enforce **1–6 tabs**. If more remain, keep the first six and warn. If none
   remain, fall back to the default manifest's tabs. The resolver never
   returns an empty tab bar.
5. If `initialTab` was dropped, use the first resolved tab.
6. The result is memoised per `(variant, flags)`.

Because it's pure, it's fully unit-testable without React Navigation.

### 4.4 Route-name stability

- Resolved tabs register under the catalog's **`routeName`**, not the key, so
  `Home`, `Orders`, `Portfolio`, `Plans` and `News` keep their names and the
  ~25 existing `navigate()` calls are untouched.
- **Navigating to a route the active variant doesn't show.** An example is a
  push notification that opens `Orders` on a variant without an Orders tab.
  Tab routes that aren't shown stay registered on the root stack and open as a
  pushed screen, so the screen still opens. Anything not in the catalog falls
  back to `Home` (the smartLink behaviour today). A unit test pins both
  behaviours.

### 4.5 Rendering changes in `Navigation.js`

- `MainTabNavigator` maps `resolved.tabs` to `<Tab.Screen name={routeName}
  component={…} options={{ title: label, … }}>`. `DesignTabBar` and
  `shell.MainTabBar` already consume navigator state, so they need no change.
  Icons pass through `options` for the presentation layer to use.
- The `more` action tab keeps today's `tabPress` → `navigate('More')` listener.
- `selectedVariant === 'arfs'` is deleted. `HEADER_VARIANTS` stays as the
  transitional gate described in §4.2.
- `getBottomSheetPosition` reads `chrome.tabBarHeight` instead of the constant.
- `AccountSettingsScreen` builds `sections` from `resolved.moreSections`.
  Row behaviours (navigate target, modal, logout) come from the catalog; the
  existing flag gating moves into catalog `requires`.
- `SplashScreen` keeps deciding **whether** the pre-login flow runs
  (`phoneFirstLoginEnabled`). The manifest only decides the order of the
  screens within it.

### 4.6 What a manifest can never express (by construction)

The manifest can link to the **entry point** of a flow (e.g. a `plans` tab)
but has no vocabulary for the steps inside it. These stay hard-wired in `src/`
and aren't in the catalog as placeable steps:

- the auth gate, and whether the app requires login;
- KYC gate → **MITC e-sign before payment** → payment → subscription activation;
- broker connect → sell authorization (EDIS/DDPI/TPIN) → trade review → placement;
- forced-update gate, account deletion flow, risk disclosures.

These orders are also enforced server-side or by the SDK orchestrator. Keeping
them out of the manifest means a design can't create a compliance regression
even by mistake.

---

## 5. Why structure is build-time (decision)

**Decision (recommended, pending sign-off):** structure comes only from the
bundled manifest. Runtime config may only **hide** a catalog entry through its
`requires` flag (the existing `advisor_config` flags). It may never add,
reorder or rename.

Why:

- **Old app versions.** A server-side tab list could name a screen an older
  installed version doesn't have. Show/hide of screens that already exist is
  always safe.
- **One tenant per binary.** Each mobile binary is pinned to one tenant
  (root `CLAUDE.md`, mobile tenant header). Per-build structure matches that
  model.
- **OTA still covers most changes.** Navigation is JS-only, so a manifest
  change ships over Revopush to OTA-capable binaries without a store release.
  Follow `prod-alphaquark-github/docs/MOBILE_OTA_RELEASES.md`.

A later phase could add server-driven ordering, gated on a minimum app version
reported by the client. That needs its own design.

---

## 6. Testing

| Test | Pins |
|---|---|
| Resolver unit tests (`src/__tests__/navigation/resolveNavigation.test.js`) | unknown/duplicate keys dropped + warning, required More tab and legal rows re-added, flag-gated hide, 1–6 bounds, initial-tab fallback, never-empty tabs, no vocabulary for compliance steps, pre-login and chrome bounds |
| **Default-manifest snapshot** (`defaultNavigationSnapshot.test.js`) | the resolved tabs, first tab and every More row + route for the default variant equal the hand-written pre-refactor app, with optional flags off and on |
| arfs target (in the resolver tests) | the arfs P4 manifest resolves to Home, Orders, Portfolio, News, More |
| Registry + audit contract (`navigationManifestContract.test.js`) | per-key merge, unknown manifest key throws, manifest with any import / function / identifier / computed key / no default export fails the audit; ordinary design files unaffected |
| Existing string contract (`designVariantContract.test.js`) | tab bar still routes through `DesignTabBar`/`shell.MainTabBar`; tabs come from `navLayout.tabs`; no `selectedVariant === 'arfs'` |
| Not yet built | a render-level test of the route fallback (§4.4) and screenshot-CI coverage of a non-default manifest |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Fork `Navigation.js` changes contain non-navigation code (hotfixes, modals, providers) that would be lost | P0 classifies every fork change as nav / non-nav / fix before any fork migrates. Non-nav fixes are upstreamed separately |
| A variant hides a tab that push/deep links target | §4.4 fallback + test |
| Cart sheet mis-positioned on a different tab-bar height | `chrome.tabBarHeight` (§4.5) |
| A manifest drifts into behaviour (functions, conditionals) | audit rule: data only |
| `freezeOnBlur` / tab lifecycle differences when tab count changes | keep `screenOptions` unchanged; smoke-test each migrated fork on device |

---

## 8. Phases

| Phase | Work | Size (rough) | Exit criterion |
|---|---|---|---|
| **P0** ✅ | Using the forks' **remote** deploy branches, catalog every tab and More row each fork added, and classify each fork's `Navigation.js` changes as nav / non-nav / fix | 0.5–1 day | §11 |
| **P1** ✅ | `screenCatalog.js`, `resolveNavigation.js`, `designs/default/navigation.js`, `Navigation.js` renders from the resolver, hard-coded arfs swap removed (manifest ships with the fork in P4), `chrome.legacyToolbar` + transitional gate, `chrome.tabBarHeight` | 2–3 days | default snapshot identical; resolver tests green |
| **P2** ✅ | More menu from the manifest (`AccountSettingsScreen`) | ~1 day | More screen visually unchanged for default |
| **P3** ✅ | Design audit rule for manifests; update `DESIGN_SYSTEM_ARCHITECTURE.md` (+ changelog) and add a "Change navigation" section to the variant how-to | 0.5–1 day | audit fails on a bad fixture manifest |
| **P4** | Migrate forks one at a time (arfs and magnus first, as they differ most): add `designs/<fork>/navigation.js`, delete the nav part of the fork's `Navigation.js` changes | 0.5–1 day per fork | fork's route-tree snapshot matches its pre-migration tree |

Core (P1–P3): about one week. P4 depends on P0's findings.

Release: P1–P3 ship in an Alphab2bapp release. Each fork takes them on its next
sync, and OTA-capable binaries can receive them over Revopush.

---

## 9. App Store: does per-tenant UX avoid Apple's "copycat" rejections?

Short answer: **it helps, but it isn't the thing that decides it.** Two App
Review guidelines are relevant:

- **4.2.6 — apps from a commercialised template or app-generation service.**
  These are rejected **unless the app is submitted by the provider of the
  app's content**. For us, each advisor's app must be published from **that
  advisor's own Apple Developer (organization) account**, not from an
  AlphaQuark account. This is the controlling requirement, and a different
  navigation doesn't change it. Current practice already matches it: each brand
  has its own Apple account and App Store Connect key (e.g. rgx =
  `4AK2LVPBUS`). Never publish two tenants from one account.
- **4.3 — spam.** Apple rejects many near-identical apps, including across
  accounts when they judge them to be the same app. Reviewers look at the
  whole product: purpose, content, branding, screenshots, metadata and
  structure. Distinct navigation and screen designs make each app visibly its
  own product, and that reduces 4.3 risk. It doesn't guarantee approval if the
  content and features are otherwise identical.

What reduces 4.3 risk most, in order:

1. Submitted from the advisor's own organization account, with the advisor's
   legal entity as seller (4.2.6).
2. Genuinely distinct content: the advisor's own research, recommendations,
   plans, branding and support contacts. Real, different advice is the
   strongest differentiator.
3. Distinct metadata and screenshots: name, description, keywords, icon and
   screenshots written for that advisor. Never reuse another tenant's
   screenshots or copy.
4. Distinct structure and UX. **This design adds this one**: different tabs,
   home layout and design variant.

If a review raises 4.2.6/4.3, the usual response is to show that the app is
submitted by the content provider under their own account and to explain what
is unique to that advisor. Keep that explanation per tenant in the release
notes for review.

This section is guidance, not legal advice. Apple's guidelines change, so
re-read 4.2.6 and 4.3 on developer.apple.com before each new tenant's first
submission.

---

## 10. Open questions

1. **Sign-off on §5**: build-time structure, runtime show/hide only.
2. **magnus's `Advices` tab** is a separate `AdvicesScreen` that doesn't exist
   upstream, and magnus is excluded from fleet sync. Not catalogued; revisit
   only if magnus rejoins the upstream shell.
3. **Should `HomeS` (a second mount of the same tabs) be retired?** It has one
   caller, `PushNotificationScreen`. Out of scope unless it blocks P1.
4. **Home-screen section order** (which cards the Home tab shows, in what order)
   is a natural next step using the same catalog-plus-manifest pattern, but it's
   a separate design.

---

## 11. P0 findings (2026-10-01, fork remotes)

Each fork's `Navigation.js` was read from its most recent remote release branch
and compared with Alphab2bapp `origin/release/deploy_5.1`:

| Fork (remote branch) | Tabs | Current shell? | Extra stack screens vs upstream |
|---|---|---|---|
| markup_app (`main`) | default (Plans) | no | — |
| moneyman_app (`main`) | default | no | — |
| zamzam_app (`zamzam/v2-test`) | default | no | — |
| Kaizen_app (`main`) | default | no | HistoryScreen, Ignored Trades |
| marketanalysis_app (`main`) | default | no | HistoryScreen, Ignored Trades |
| rgx_app (`feature/ios2.0`) | default | no | HistoryScreen, Ignored Trades |
| Alphanomy (`sync/from-upstream-20260513`) | default | no | HistoryScreen, Ignored Trades |
| arfs_app (`prod/ios2.6-sync`) | Home, Orders, Portfolio, News, **Watchlist** — **no More tab** | no | HistoryScreen, Ignored Trades, PrivacyPolicyWeb |
| new_magnus_app (`main`) | Home, **Advices**, Orders, Portfolio, **More (real screen)**, **Watchlist** | no | 11 own screens; lacks 33 upstream screens |

"Current shell" = uses `DesignTabBar` + `shell.MainTabBar`. **No fork does.**
All still carry the older `CustomTabBarIcon` tab bar. So:

1. Most per-fork `Navigation.js` divergence is **lag behind upstream**, not
   deliberate navigation. P4 is mainly "adopt the current upstream shell", and
   the manifest is what lets a fork keep its tab choices while doing that.
2. Only **arfs** and **magnus** deliberately changed the tab set. Magnus is a
   separate generation and excluded from sync (not in P4 scope).
3. `History` / `Ignored Trades` stack screens in older forks were removed
   upstream on 2026-08-17; they are not catalogued.
4. ⚠️ **Compliance check for arfs:** its shipped tab bar has no More tab, which
   upstream is the only general route to Log Out, legal pages and in-app
   Delete Account (Apple 5.1.1(v)). Verify the arfs build exposes these some
   other way (e.g. header). On the upstream shell the resolver would re-add More.

### P4 checklist per fork

1. Merge current upstream (brings the shell, catalog, resolver).
2. Add `navigation` to the fork's own `designs/<variant>/index.js` (and resolve
   the conventional `designs/registry.js` conflict).
3. Declare only what differs. arfs:
   ```js
   // arfs_app designs/arfs/navigation.js
   export default {
     tabs: [
       {key: 'advice', label: 'Home', icon: 'home'},
       {key: 'orders', label: 'Orders', icon: 'orders'},
       {key: 'portfolio', label: 'Portfolio', icon: 'portfolio'},
       {key: 'news', label: 'News', icon: 'news'},
       {key: 'watchlist', label: 'Watchlist', icon: 'watchlist'},
       {key: 'more', label: 'More', icon: 'more'},  // required; re-added anyway
     ],
     chrome: {legacyToolbar: false},  // arfs sets DESIGN_VARIANT=arfs → hidden today
   };
   ```
4. Delete the navigation part of the fork's `Navigation.js` changes. Upstream
   non-navigation fixes separately (P0 found none unique to nav).
5. Run the resolver on the fork manifest (the arfs case is already a test) and
   tap every tab + More row on a device.

## Changelog

| Date | Change | Section(s) | Commit |
|---|---|---|---|
| 2026-10-01 | Initial design: screen catalog + data-only variant navigation manifest + pure resolver; build-time structure / runtime show-hide; locked compliance flows; fork evidence; App Store 4.2.6/4.3 guidance | all | (uncommitted) |
| 2026-10-01 | P0 findings (§11) + P1–P3 built: catalog, resolver, `useNavigationLayout`, default manifest, Navigation/AccountSettings/Splash wired, MainTabBar icon+height, registry merge + key validation, data-only audit rule, tests. arfs manifest moved to the fork (P4); `history`/`advices` not catalogued; transitional `DESIGN_VARIANT` toolbar gate | status, §1.1, §4.1, §4.2, §4.5, §6, §8, §10, §11 | (uncommitted) |
