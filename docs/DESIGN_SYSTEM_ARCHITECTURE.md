# Design System Architecture — Bring-Your-Own-UI

> **Source of truth for the swappable-UI design system.** Update this doc BEFORE writing the matching code change. See `CLAUDE.md § Architecture Documentation — MANDATORY` for the blocking-doc rule. Mirrors the Phase 3 doc trio: this file + `DESIGN_COMPONENT_AUDIT.md` (per-surface inventory) + `DESIGN_MIGRATION_PROGRESS.md` (chronological work log).

## What this is

A staged refactor that splits every UI surface in the app into **logic** (lives in `src/`, never swappable) and **presentation** (lives in `designs/<variant>/`, fully swappable). The goal is "bring your own UI": a tenant or partner can ship a custom skin — tokens only, primitives only, or all the way up to whole screens — without forking the app or touching business logic.

This is a **layered, opt-in extension of the existing theme system** (`src/theme/colors.js` + `useColors()`), not a replacement. Today only `colors` are swappable; this doc extends the same model to spacing/typography/primitives/composites/screens.

This is **not** a bundling change, not a package extraction, not a separate npm release. Everything ships in this repo. A future variant lives at `designs/<variant>/` next to `designs/default/`.

### Warn-mode SELL ownership notice (2026-09-29)

`SellModelImpactNotice` currently remains in `src/` beside the existing
non-model trade-review containers. The visible card is small, but its choices
mutate reviewed quantities and attach backend authorization metadata, so this
is a behavior-bearing surface rather than a token-only design override. Its
colors and fonts use `designColor` / `designFont`, keeping the source style
ratchet clean and allowing literal-token remapping per variant.

The eventual Phase G extraction must keep preview/reservation networking and
choice application in the `src` container. A registered presentation may
receive only display-ready notice rows plus `onChoose`; it must not call the
preview/reserve endpoints or construct `modelAuthorization` itself.

## The non-negotiable boundaries

These three rules are what keep the refactor safe. Every PR that touches `designs/` is reviewed against them.

### 1. SDK-bound surfaces are NEVER in `designs/`

The Phase 3 SDK migration is its own contract (`docs/PHASE3_ARCHITECTURE.md`). The following surfaces stay in `src/` and stay non-swappable:

- `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js` — the SDK modal shell wrapping `BrokerCredentialForm` / `WebViewBrokerAuthFlow`
- `../../alphaquark-mobile-sdk/packages/rn/src/components/BrokerCredentialForm` — owned by the SDK package
- `../../alphaquark-mobile-sdk/packages/rn/src/components/WebViewBrokerAuthFlow` — owned by the SDK package
- Any future SDK-routed widget added under `SDK_ELIGIBLE_MODALS`

A custom design CAN theme the visual chrome around these (the modal backdrop, the header bar, the close button, the page background). It CANNOT replace the form rendering itself. The SDK is sacred because it owns the legal/security/correctness contract with the backend. Skinning the SDK form would re-introduce every Phase 3 regression we just fixed.

### 2. No data fetching, no contexts, no services in `designs/`

Composites and screens in `designs/` are **pure presentation**: props in, JSX out. They never call:

- React hooks that touch context (`useTradeContext`, `useMultiBrokerContext`, `useConfig`, `useMarketData`, `useGstConfig`)
- Service modules (`ModelPortfolioService`, `OrderService`, `BrokerOrderBookAPI`, `ReconciliationService`, anything in `src/services/`, `src/FunctionCall/`)
- Async-storage / network / native modules
- `EventEmitter`, `portfolioEvents`, any cross-component bus

What they CAN call:

- Other components from the same `designs/<variant>/`
- Pure utility functions from `src/utils/` that take args and return a value (`formatCurrency`, `symbolNormalizer`) — these are not state.
- `useColors()` and any future `useTokens()` / `useTypography()` — design-system hooks only.

This is the rule that makes a design swappable. If a composite reaches into context, swapping the composite means swapping its data dependencies too, and the variant is now coupled to the app's internal state shape forever. Everything goes through props.

### 3. Containers own the data; presentation receives props

Every screen and feature surface gets split:

- **Container** (in `src/screens/` or `src/components/`) — calls hooks, contexts, services, services, services. Computes props. Renders the resolved presentation component from the registry. No JSX layout beyond the wrapper.
- **Presentation** (in `designs/<variant>/`) — receives those props. Renders layout + composites + primitives. No data calls.

The container is the only place business logic touches the screen tree. Swapping the design swaps the presentation; the container is unchanged.

## Layer model

| Layer | What it is | Swappable? | Lives in | Today |
|---|---|---|---|---|
| **Tokens** | colors, spacing, typography, radii, shadows, motion | yes | implementation in `src/theme/`, registry-facing surface in `designs/<variant>/tokens/` | **Phase A complete (2026-05-01)** — colors + spacing + typography + radii + shadows live in `src/theme/`; `useTokens()` composite hook available; `designs/default/tokens/index.js` re-exports. Backend overrides for non-color tokens still need ConfigContext passthrough (separate PR). |
| **Primitives** | `Button`, `Input`, `Text`, `Card`, `ModalShell`, `Toast`, `Spinner`, `Icon` | yes | `designs/<variant>/primitives/` | Scattered across `src/components/` and `src/UIComponents/`. To extract. |
| **Composites** | `BrokerCard`, `AdviceRow`, `RebalanceCard`, `MPCard`, `HoldingRow`, `OrderRow` | yes | `designs/<variant>/composites/` | Today these are coupled to contexts. To split into container + presentation. |
| **Screens** | layout shell + which composites to render where | yes (layout only) | `designs/<variant>/screens/` | Today screens both fetch and render. To split. |
| **Containers / hooks** | `TradeContext`, `useMultiBrokerHoldings`, `FunctionCall/*`, `services/*` | **no** | `src/` (unchanged) | Already isolated. Stays. |
| **SDK-bound surfaces** | `Phase3SdkBrokerModal`, SDK widgets | **no** | `src/components/BrokerConnectionModal/`, SDK package | Stays. Phase 3 owns this. |

> **Courses/Webinars composites note.** `composites.LiveRoom` and
> `composites.GumletPlayer` (`designs/default/composites/`) were added by the
> courses/webinars port; their per-surface verdicts live in
> `COURSES_WEBINARS_MOBILE_PORTING.md`. Sizing contract (2026-06-19): the
> live class room presents **full-screen** (RN `Modal`, `flex:1` body) so an
> activated LiveKit room fills the device — parity with the web full-viewport
> webinar fix. See `DESIGN_MIGRATION_PROGRESS.md` 2026-06-19.

### Tokens

Tokens live in two layers:

- **Implementation** in `src/theme/` (existing pattern — integrates with `ConfigContext` for advisor overrides). Phase A (2026-05-01) shipped `colors.js`, `spacing.js`, `typography.js`, `radii.js`, `shadows.js`, plus a composite `useTokens()` hook.
- **Registry-facing surface** at `designs/<variant>/tokens/index.js` — re-exports the `DEFAULT_*` objects + `build*()` builders. The `DesignProvider` (Phase B) imports from here. A custom variant ships `designs/<variant>/tokens/index.js` with variant-specific values in the same shape.

The source style migration is complete as of 2026-09-28: the CI ratchet is at
zero raw hex colours and zero literal `fontFamily` declarations outside the
token layer. New semantic work should use `useTokens()`. Existing screens that
have not yet received semantic names use build-time compatibility markers:
`designColor('0056b7')` and `designFont('Satoshi-Medium')`. The Babel compiler
resolves those markers back to their byte-equivalent defaults, or to entries in
`designs/<variant>/tokens/literals.json`, and removes the marker import. This
makes every migrated colour/font variant-controlled without adding runtime
lookups to thousands of React Native style objects.

`literals.json` is a compatibility bridge, not the preferred vocabulary for
new UI. Variants may remap brand colours and fonts there. They must not remap
profit, loss, warning, or error values globally; those belong to the semantic
tokens in `src/theme/colors.js`. Run `npm run validate:design-literals` after
changing the compiler or a literal-token map.

The compiler resolves `DESIGN_VARIANT` / `APP_VARIANT` from the shell first and
then from the repository `.env`; this is intentionally independent of Babel's
later `dotenv-import` pass. Metro's `cacheVersion` includes the resolved variant
and the contents of the default and selected `literals.json` files. After
changing either value, restart Metro normally; `--reset-cache` is not required.

Default values shipped in Phase A:

```js
// src/theme/spacing.js
DEFAULT_SPACING = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 }

// src/theme/radii.js
DEFAULT_RADII = { none: 0, sm: 4, md: 8, lg: 12, xl: 16, pill: 999 }

// src/theme/typography.js — Poppins (full weight set shipped in
// android/app/src/main/assets/fonts/). Roles: heading / title / subtitle /
// body / bodyEmphasis / caption / muted / button. Each is an RN style object
// with fontFamily / fontSize / lineHeight / fontWeight.

// src/theme/shadows.js — RN style objects (iOS shadow* keys + Android
// elevation, both set). Roles: none / card / elevated / modal / floating.

// src/theme/assets.js — Phase 2 (whitelabel-sync, 2026-05-09). Static
// `require(...)`-resolved RN asset references that variants can swap.
// Logo-only first pass: { logoPng, logoFadedPng }. Future slots (splash,
// app-icon-preview, empty-state illustrations) get added here.
```

Backend overrides (already supported for colors via `appadvisors.colorTokens`) extend to spacing/typography/radii/shadows in the same shape. Resolution order is unchanged from `COLOR_TOKENS.md`: default → legacy fields → backend tokens (deep merge). The `build*()` functions accept config and look for `spacingTokens` / `typographyTokens` / `radiiTokens` / `shadowTokens` — but `ConfigContext` does NOT yet passthrough these fields, so today they're undefined and resolution falls to defaults. Wiring them through `ConfigContext` is a separate, additive PR (zero behavior change for existing tenants).

Components SHOULD prefer the composite hook `useTokens()` going forward; the existing `useColors()` continues to work unchanged for color-only consumers.

#### Variant assets

Asset tokens are deliberately distinct from the other token families because RN's static `require(...)` resolves at bundle time and cannot be swapped at runtime by a config field. The asset-token slot exists so that a variant overlay repo's `designs/<variant>/tokens/assets.js` can re-export a different `DEFAULT_ASSETS` const pointing at the variant's own image files (typically under `designs/<variant>/assets/`). The variant's bundle then picks up those `require()`d references instead of upstream's defaults.

`buildAssets(config)` accepts a config arg for symmetry with the other token builders but currently ignores it — backend-driven asset overrides require a different mechanism (`<Image source={{ uri }}>` reading from `configData`), which is out of Phase 2 scope. Today the upstream default is the AlphaQuark logos at `src/assets/logo.png` and `src/assets/fadedlogo.png`. A whitelabel overlay repo overrides those via its own `tokens/assets.js`; it does NOT overwrite `src/assets/*` (doing so would also break the default variant's appearance — that anti-pattern was the leak Phase 2 was created to close).

**Consumers MUST go through `useTokens().assets.<key>`** rather than module-level `require(...)` of the same image files. Module-level `require()` is variant-blind by definition. The first round of consumer migrations (Phase 2) covered:

- `designs/default/screens/LoginScreen.js`
- `designs/default/screens/SignupScreen.js`
- `designs/default/screens/ResetPassword.js`
- `designs/default/screens/ChangeAdvisor.js`
- `designs/default/composites/BasketCard.js`

**2026-08-16 — BasketCard policy contract widened without moving business
logic into the design layer.** The `src/UIComponents/StockAdvicesUI/BasketCard.js`
container owns lifecycle/range polling and click authorization. The default
composite receives presentation-only fields (`isCancelled`, `isClosed`,
`isClosurePending`, `entryBlocked`, `entryChecking`, `entryGateMessage`) and
renders badges/CTA state. Variant implementations must treat these fields as
authoritative and must not re-infer lifecycle from legacy cancel flags.

**2026-06-10 — `useTokens()` became variant-aware for the `assets` slot.** It reads the active variant's `buildAssets` via `DesignContext` (`design.tokens.buildAssets`, from `resolveDesign`'s token-namespace merge), falling back to the default builder when called outside a `DesignProvider`. This closed the gap where `useTokens().assets.*` returned the default (AlphaQuark) logos even under a non-default `DESIGN_VARIANT`. The brand-logo `src/`-side consumers migrated in the same change: `BrandLogo`, `LogoSection`, and `SplashScreen` now render `useTokens().assets.logoPng` with no hardcoded variant name (`SplashScreen` is a Navigation stack screen, so it IS inside the providers — the earlier "renders before providers" note was inaccurate). The tenant-specific `src/components/AlphanomyLogo.js` was deleted (it was a brand leak in the default repo); each variant now supplies its own mark through `designs/<variant>/tokens/assets.js`.

**2026-07-11 — `useTokens()` is now variant-aware for the `colors` slot too.** Same pattern as assets: `useTokens()` reads `design.tokens.buildColors` from `DesignContext` and falls back to the local `buildColors` from `src/theme/colors.js`. This lets a fork variant ship hard-coded brand-color defaults (e.g. `designs/moneyman_app/tokens/index.js` starts from a green palette instead of upstream purple) that survive `src/` copies from Alphab2bapp. The advisor-config legacy-branding + `colorTokens` overrides still layer on top inside the variant's `buildColors`, so per-tenant admin-UI overrides continue to work unchanged. `src/theme/colors.js` also gained an optional `mpCardColorCycle` token slot (array of hex strings, or `null` for feature-off) — consumed by `src/screens/PortfolioScreen/ModelPFCard.js` to cycle a per-index accent color across the Portfolio-tab subscribed-MP rows. Default variant leaves the cycle `null` (no visual change); `moneyman_app` sets it to `['#005A00', '#00005A', '#5A005A']`.

**2026-09-27 — every token family is variant-aware.** `useTokens()` now
resolves `buildSpacing`, `buildTypography`, `buildRadii`, and `buildShadows`
from `DesignContext` in addition to `buildColors` and `buildAssets`. Every
family falls back independently to the canonical `src/theme/` builder, so a
variant can override only typography (for example) without copying any other
token implementation. This closes the prior contract gap where a variant
could export non-color builders but the runtime silently ignored them.

### Primitives

A fixed catalog. The names are part of the design contract — adding a new primitive is a doc change first.

| Primitive | Variants | Phase C status |
|---|---|---|
| `Text`    | `body` (default) / `title` / `heading` / `subtitle` / `bodyEmphasis` / `caption` / `muted` / `button` | ✅ Shipped |
| `Button`  | `primary` (default) / `secondary` / `ghost` / `destructive` | ✅ Shipped |
| `Card`    | `default` / `elevated` / `outlined` | ✅ Shipped |
| `Input`   | `text` (default) / `password` / `numeric` / `otp` | ✅ Shipped |
| `Spinner` | `inline` (default) / `overlay` | ✅ Shipped |
| `Icon`    | (no variants — caller passes the lucide-react-native component via the `Component` prop; preserves Metro tree-shaking) | ✅ Shipped |
| `Pill`    | `neutral` (default) / `profit` / `loss` / `warning` | ✅ Shipped |
| `Divider` | `solid` (default) / `dashed` | ✅ Shipped |
| `Toast`   | `info` / `success` / `warning` / `error` (imperative API: `Toast.show(msg, variant, options?)`) | ✅ Shipped |
| `ModalShell` | `bottomSheet` / `fullScreen` / `centered` | Deferred to Phase H — design fresh when the first non-SDK-bound modal migrates. |
| `Skeleton` | `line` / `block` / `card` | Deferred indefinitely — no current loading-state pattern uses skeletons. |

Every primitive accepts a `variant` prop, a `style` prop (RN style override that the variant cannot block — caller wins), and standard accessibility props (passed through `...rest`). Token reads via `useTokens()`; never reads colour hex directly. Variants are documented in each primitive's file-level docstring; adding a new variant requires updating this table AND the audit doc Section 1.

**Component-key naming**: dot-namespaced. `primitives.Button`, `primitives.Text`, etc. The same convention applies for composites and screens (`composites.IgnoreStockCard`, `screens.Home`). Registered in `designs/default/index.js`'s `components` map.

**Call-site migration policy (Phase C+):** when a screen or component is touched for any reason, callers SHOULD migrate ad-hoc `<TouchableOpacity>` / `<Text>` / `<TextInput>` / `<View>` patterns to the matching primitive in the same commit. New code MUST use primitives. Wholesale call-site sweeps (e.g. "replace every `<Text>` in `src/`") are explicitly NOT scheduled — they're high-volume, regression-prone, and provide no incremental user value over opportunistic migration.

### Composites

Composites are domain-shaped: they know about brokers, holdings, advices, rebalances. But they only know **about** these concepts — they don't fetch them. A `BrokerCard` takes a `broker` prop with a fixed shape; it doesn't call `useMultiBrokerContext`.

The composite contract per surface lives in the audit (`DESIGN_COMPONENT_AUDIT.md`). Each row spells out: what props the composite receives, what callbacks it emits, and the shape contract that the container must honour.

### Screens

Screens in `designs/<variant>/screens/` receive a `viewModel` prop (everything the container computed) and `actions` prop (callbacks). They lay out composites. Example:

```js
// designs/default/screens/Home.js
export default function HomeScreen({ viewModel, actions }) {
  return (
    <ScreenShell>
      <Greeting name={viewModel.user.name} />
      <BrokerStrip brokers={viewModel.brokers} onConnect={actions.connectBroker} />
      <AdviceList advices={viewModel.advices} onAccept={actions.acceptAdvice} />
      ...
    </ScreenShell>
  );
}
```

A custom variant can re-arrange these, drop sections, or re-skin them. It CANNOT make `viewModel` deeper or expect callbacks the container doesn't emit — that's a contract change, not a design change, and goes through the audit.

## Registry: the `DesignProvider`

A single React context at the app root, mounted just inside `GestureHandlerRootView` and outside every other app provider. Resolves a key (e.g. `"primitives.Button"`) to a component implementation.

**Shipped Phase B (2026-05-01)** — files:

- `src/design/DesignProvider.js` — the provider component. Explicit `variant`
  props and fork `DESIGN_VARIANT` values remain build-owned. The AlphaB2B
  master build may additionally select a bundled runtime design after advisor
  resolution; the selected advisor config is the authority and the provider
  re-resolves only when that advisor identity changes.
- `src/design/resolveDesign.js` — pure resolution function. Throws at startup if `designs/default/` is missing from the registry. Warns in dev when a non-default variant is requested via `DESIGN_VARIANT` or the `variant` prop but isn't registered.
- `src/design/useDesign.js` — exports `useDesign()` (returns `{ variant, tokens, components, sdk, navigation }`) and `useComponent(key)` (throws if key is missing in active variant or default).
- `designs/registry.js` — static map of all variants. To add a custom variant, add an import + entry here.
- `designs/default/index.js` — default variant root. `tokens` re-exported from `designs/default/tokens/`. `components` map is empty as of Phase B; Phase C populates it.

The `DesignContext` defaults to `null` so calling `useDesign()` outside the provider throws a clear error rather than returning a misleading empty bundle.

### Resolution

For variant `"acme"`:

1. Start with `designs/default/` (every key MUST exist here — default is the contract floor).
2. Shallow-merge `designs/acme/`'s `components` and `sdk` maps over the
   corresponding default maps. Tokens layer-merge by namespace (variant's
   `tokens.X` replaces default's `tokens.X` if exported; otherwise default wins).
   The `navigation` manifest merges per top-level key (`tabs`, `initialTab`,
   `moreMenu`, `preLogin`, `chrome`): a key the variant declares replaces
   default's value whole (arrays are never merged); an omitted key falls back.
3. Validate every registered variant at startup. A variant may override only
   component and SDK slot keys declared by `designs/default/`, and only the
   five navigation manifest keys; an unknown key throws with a contract error
   instead of becoming a tenant-only API.
4. Fork builds remain fixed to their explicit `DESIGN_VARIANT`. In the
   AlphaB2B master build, a registered runtime advisor design may replace the
   env fallback after login/restore. The design changes atomically with the
   active advisor config; unknown runtime variants fall back to `default`.

The default variant is the canonical source. **Adding a primitive, composite,
screen, or SDK slot always lands in `designs/default/index.js` first.** Variants
opt in by overriding; they cannot add new keys that default doesn't have.

`SdkProviderRoot` consumes the resolved `sdk` map and passes it to
`<AqSdkProvider components={...}>`. This makes the design registry the single
build-time selection point for both app-owned presentations and SDK-owned
presentations. See `SDK_DESIGN_PASSTHROUGH.md § 9` for the slot status and
props contracts.

**Since 2026-10-01 the SDK consumes every slot** (except the reserved
`brokerSelectionList`), so a non-null `sdk` entry changes what renders. Slots
replace presentation only; the SDK keeps the logic. In `designs/default/sdk/`
a `null` entry means "SDK built-in" — the default registry maps both headers,
`rebalancePnlChoice` and `brokerSelectionList` to `null` so AlphaPro keeps
the chrome it has always shown; entries that re-export an SDK widget are
ignored by the SDK's `resolveSlot` guard. Pinned by
`src/__tests__/sdkSlotPassthrough.render.test.js`, which renders through the
real package (see `jest.config.js` for the single-React/React-Native mapping
needed because the package is a symlink outside `node_modules`).

### Variant selection

Sources, in order of precedence (resolved by `pickSelection()` in
`DesignProvider.js`):

1. `<DesignProvider variant="...">` prop — wins over env. Mostly useful for tests and Storybook.
2. `DESIGN_VARIANT` env var — set this in `.env` to ship a tenant skin.
3. Registered runtime advisor design — AlphaB2B master build only; derived
   from the stored advisor config (`DESIGN_VARIANT`, or the approved mapping
   from `APP_VARIANT`, currently `moneyman` → `moneyman_app`).
4. `APP_VARIANT` env var — fallback only.
5. `default`.

A name with no matching entry in `designs/registry.js` falls back to `default`. The dev-only warning fires only when the source is `prop` or `DESIGN_VARIANT` (those are explicit design selectors). When the source is `APP_VARIANT` and there's no matching folder, fallback is silent — `APP_VARIANT` is primarily a business-config selector; not having a design folder for every business variant is the normal case.

Arbitrary backend component names are still not executable. Runtime selection
can choose only a design statically imported in `designs/registry.js`; no code
or component is downloaded. Standalone tenant builds continue to ship with
`DESIGN_VARIANT` set.

### Where variant folders live — upstream-default + per-tenant fork repos

Phase 3 of the whitelabel-sync work (2026-05-09) formalized this rule:
**`designs/<variant>/` folders for non-default tenants live in per-tenant fork
repos, not upstream.** Upstream (this repo) ships only `designs/default/` plus
the variant-resolution infrastructure. Each whitelabel — Alphanomy, Zamzam,
RGX, ARFS, future tenants — is its own fork repo whose entire contribution
on top of upstream is:

1. A `designs/<variant>/` folder (tokens, composites, screens, sdk, assets).
2. A native shell delta (icons, `applicationId`, signing, splash, build
   number, display name).
3. A 2-line patch on `designs/registry.js` adding the variant to the static
   `VARIANTS` map.
4. A `.env` setting `DESIGN_VARIANT=<variant>`.
5. A `SYNC.md` documenting the upstream merge cadence.

Forks merge upstream regularly. **The conventional merge conflict on
`designs/registry.js`** is the chosen registry-extension mechanism (over a
`registry.local.js` extension-point pattern, over npm-package variants):
forks accept that every upstream pull will produce a 2-line conflict on
`registry.js` to be resolved by re-applying their `import` + map entry. The
conflict is mechanical and predictable; the alternatives carry indirection
or contract-version costs we judged worse for the current state of the
design-system contract.

**A fork that edits any `src/` file is drift, not customization.** Tenant-
specific behavior must enter upstream as a new variant override mechanism
first, then the fork uses it. The full contract — what stays here, what
goes downstream, the sync workflow, the `SYNC.md` template, the step-by-step
recipe to bootstrap a new whitelabel — is in `docs/WHITELABEL_RECIPE.md`.

## Navigation manifest — app structure as data (2026-10-01)

Which bottom tabs exist, their order, labels and icons, the first tab, the
More-menu sections, the phone-first pre-login order and the tab-bar height are
declared by the variant's **data-only** manifest, `designs/<variant>/navigation.js`
(registered as the variant's `navigation` field). Full design and rationale:
[`CONFIGURABLE_NAVIGATION_DESIGN.md`](./CONFIGURABLE_NAVIGATION_DESIGN.md).

- **Catalog** — `src/navigation/screenCatalog.js` is the pure-data list of
  placeable keys (`TAB_CATALOG`, `MORE_ITEM_CATALOG`, `PRE_LOGIN_CATALOG`).
  Route names stay the legacy ones (`Home`, `Orders`, `Portfolio`, `Plans`,
  `News`, `More`) so existing `navigate()` calls, deep links and push routing
  are unaffected.
- **Resolver** — `src/navigation/resolveNavigation.js` (pure) drops unknown or
  duplicate keys with warnings, enforces 1–6 tabs, never returns an empty tab
  bar, re-adds **required** entries (the More tab; Privacy Policy, Terms,
  Delete Account, Log Out rows — the More tab is the only general entry to
  in-app deletion, Apple 5.1.1(v)), and lets runtime flags only **hide**
  flag-gated rows (`coursesEnabled`, `webinarsEnabled`, `changeManagerVisible`,
  `appleRelayIdentity`).
- **Consumers** — `useNavigationLayout(flags)` (`src/navigation/`) feeds
  `MainTabNavigator` in `src/components/Navigation.js` (tabs, initial route,
  tab-bar height, legacy toolbar), `AccountSettingsScreen` (More menu) and
  `SplashScreen` (first phone-first pre-login route). Manifest warnings are
  reported once per session as a `nav_manifest_warning` frontend anomaly.
- **Locked** — the catalog has no keys for auth, KYC, MITC → payment, or broker
  connect → sell-auth → review → place steps; a manifest can link to a flow's
  entry screen but cannot reorder its steps.
- **Enforced** — `npm run audit:design` rejects any import in a
  `navigation.js` manifest and any non-literal default export (functions,
  identifiers, spreads, computed keys).
- **Transitional** — the legacy toolbar still also requires `DESIGN_VARIANT`
  to be unset or in the `default`/`moneyman_app` allow-list, so a fork that
  sets an unregistered `DESIGN_VARIANT` keeps today's hidden toolbar until it
  declares `chrome.legacyToolbar` in its own manifest.
- Fork variants (per § "Where variant folders live") add `navigation` to their
  own `designs/<variant>/index.js`; the former hard-coded arfs News-for-Plans
  swap now belongs in the arfs fork's manifest.

## Container / presentation split — the worked example

Today's `HomeScreen.js`:

```js
// src/screens/Home/HomeScreen.js — 600+ lines, mixed
export default function HomeScreen() {
  const { advices, holdings, funds } = useTradeContext();
  const { brokers } = useMultiBrokerContext();
  // ... 100 lines of state and handlers ...
  return (
    <View style={...}>
      <Text style={...}>Hi {name}</Text>
      {/* 400 lines of inline JSX */}
    </View>
  );
}
```

After:

```js
// src/screens/Home/HomeScreen.js — container, ~80 lines
export default function HomeScreen() {
  const { advices, holdings, funds } = useTradeContext();
  const { brokers } = useMultiBrokerContext();
  // ... handlers ...
  const HomePresentation = useComponent('screens.Home');
  const viewModel = { user: { name }, advices, holdings, funds, brokers };
  const actions = { connectBroker, acceptAdvice, ... };
  return <HomePresentation viewModel={viewModel} actions={actions} />;
}
```

```js
// designs/default/screens/Home.js — pure presentation
export default function Home({ viewModel, actions }) {
  /* layout + composites */
}
```

A custom variant overrides `designs/acme/screens/Home.js` and gets a different visual without ever touching `TradeContext`.

## What surfaces are in scope vs deferred

### In scope for v1

Effectively the entire app **except** the SDK-bound Phase 3 surfaces (see "Out of scope" below). Concretely:

- `screens/Home/*`
- `screens/PortfolioScreen/*`
- `screens/AccountSettingScreen/*`
- `screens/Authentication/*`
- `screens/Drawer/*` — including the Model Portfolio screens (`ModelPortfolioScreen`, `MPPerformanceScreen`, `CustomTabbarMPPerformance`, `EmptyStateMP`)
- `components/AdviceScreenComponents/*` — except inline broker-modal renders (Phase 3 surface)
- `components/ModelPortfolioComponents/*` (all 20 files) — **policy reversal 2026-05-01: MP surfaces are now in scope** (was previously frozen — see "Note on MP and the SDK" below)
- `UIComponents/StockAdvicesUI/*`, `UIComponents/RebalanceAdvicesUI/*`
- All standalone modals not in the SDK lane (`BasketTradeModal`, `DeleteAdviceModal`, `IgnoreAdviceModal`, `GttDetailsModal`, `GttSuccessModal`, `DdpiModal`, `TokenExpireBrokerModal`, `HoldingsMigrationModal`, `RebalanceModal`, `RebalanceAdviceContent`, `RebalancePreferenceModal`, `MPReviewTradeModal`, `MPInvestNowModal`, etc.)

### What does NOT belong in a variant — third-party WebView surfaces

**Rule (2026-08-01): a surface whose entire body is a third-party web page is
not a design surface. The container renders it directly; it never travels
through `viewModel` / `actions`.**

The test is "could an advisor meaningfully restyle this?" For a WebView hosting
someone else's UI the answer is no — the only thing we own is a header bar and
a close button. A `designs/<variant>` override of such a surface can only ever
be a stale copy of the default.

The cost of getting this wrong is specific and severe: **every prop crossing the
design boundary defaults to a no-op.** The presentation destructures with
`onFoo = () => {}` / `foo = false` defaults, so a variant fork that overrides
the screen and forgets a prop doesn't crash — it silently does nothing. On a
payment or compliance path that is a data-loss-class bug that no test and no
error report will surface.

That is not hypothetical. `DigioModal` (the Digio e-sign WebView) lived in
`designs/default/screens/MPInvestNowModal.js` and needed seven props
(`digioModalOpen`, `authUrl`, `onDigioModalClose`, `onDigioVerifyDocument`,
`onDigioVerificationComplete`, `onDigioSuccess`, `onDigioError`). Dropping any
one of them reinstates the 2026-08-01 defect where a customer completes their
MITC signature and is never carried to payment. It is now rendered by the
container (`src/components/ModelPortfolioComponents/MPInvestNowModal.js`),
alongside `<Presentation/>` in a fragment, and those seven keys are gone from
the contract.

**In scope by contrast:** `DigioSuccessModal` stays in the presentation. It is
our own UI — brand tokens, accent colour, a progress rail — and an advisor
restyling it is legitimate. Its `afterPayment` prop is a normal presentation
prop.

Applies today to `DigioModal`. Apply the same reasoning to any future
WebView-wrapping surface (gateway checkout pages, KYC vendor flows, broker
OAuth) before adding it to a `screens.*` key.

### Out of scope — SDK-bound Phase 3 surfaces

The only surfaces that NEVER migrate to `designs/`:

- `src/components/BrokerConnectionModal/Phase3SdkBrokerModal.js`
- All `src/components/BrokerConnectionModal/*` legacy modals (scheduled for deletion as Phase 3 reaches 100%)
- All `src/UIComponents/BrokerConnectionUI/*` (12 broker-specific UIs — same fate)
- `src/components/CrossPlatformOverlay.js` (used by SDK-bound surfaces only)
- `src/screens/Drawer/ManageConnectionsModal.js`, `DisconnectBrokerModal.js`, `BrokerConnectionError.js`
- The SDK package's own widgets (`BrokerCredentialForm`, `WebViewBrokerAuthFlow`) at `../../alphaquark-mobile-sdk/packages/rn/src/components/`

These have their own contract under `docs/PHASE3_*.md`. The design-system migration may theme the visual chrome around them (modal backdrop, header bar) via primitives, but cannot replace the form rendering itself.

### Note on MP and the SDK — accept the risk

There is a non-trivial chance the Model Portfolio flows (calculate-rebalance, MP review trade, MP performance, basket subscription) migrate into the `@alphaquark/mobile-sdk` package alongside broker-connect later — see `docs/SDK_MOBILE_FIT_ASSESSMENT.md`. **The 2026-05-01 product decision is to migrate MP surfaces into the design system anyway**, accepting that some or all of that design-system work gets thrown away if/when MP moves to SDK.

Why migrate them now even with that risk:

- A consistent, fully-tenant-skinnable app today is more valuable than waiting on an undecided SDK plan.
- A two-tier UX where MP screens look different from the rest of the app is a worse user experience than a unified design.
- The container/presentation split work has reuse value even if presentation goes — the container shape (data deps, viewModel) is what the future SDK widget will consume.

When the SDK MP plan resolves:

- **If MP ships as SDK**: the affected rows in `DESIGN_COMPONENT_AUDIT.md` flip from `clean-extract` / `needs-logic-extraction` / migrated → **`SDK-pending`**, and the design work for those surfaces is unwound or absorbed into the SDK widget. A `DESIGN_MIGRATION_PROGRESS.md` entry records the unwind.
- **If MP plan is dropped**: nothing changes. MP surfaces stay in the design system.

The verdict `SDK-pending` is **kept in the legend** but its meaning narrows — it now applies only to surfaces that have an active, committed SDK migration in flight (i.e. a Phase 3 commit is open or imminent for that surface). It is no longer applied preemptively for "this might move to SDK someday".

## Migration order

Strictly sequential. Each phase ships, soaks, and is reviewed before the next starts. Each phase has its own progress log entry.

1. **Phase A — Tokens absorption. ✅ Shipped 2026-05-01.** Extended `src/theme/` to a full token bundle (`spacing.js` / `typography.js` / `radii.js` / `shadows.js` on top of existing `colors.js`). `useTokens()` composite hook live. `designs/default/tokens/index.js` re-exports the canonical values. No component changes. ConfigContext passthrough for non-color overrides deferred to a follow-up PR.
2. **Phase B — `DesignProvider` skeleton. ✅ Shipped 2026-05-01.** Provider at `src/design/DesignProvider.js`, resolver at `src/design/resolveDesign.js`, hooks at `src/design/useDesign.js`, registry at `designs/registry.js`, default variant root at `designs/default/index.js`. Wired under `GestureHandlerRootView` in `App.js`. Variant selection: prop → `DESIGN_VARIANT` → `APP_VARIANT` → `default`. Empty components map. Frozen-at-mount via `useRef`.
3. **Phase C — Primitives. ✅ Shipped 2026-05-01.** 9 primitives shipped in one drop at `designs/default/primitives/`: `Text`, `Button`, `Card`, `Input`, `Spinner`, `Icon`, `Pill`, `Divider`, `Toast`. All registered in `designs/default/index.js` with dot-namespaced keys (`primitives.Text`, etc.). `ModalShell` deferred to Phase H per the audit; `Skeleton` deferred indefinitely (no current loading-state pattern in the codebase). Call-site updates are NOT bundled with this drop — they happen opportunistically (new code uses primitives; old code migrates as it's touched).
4. **Phase D — One composite end-to-end. ✅ Shipped 2026-05-01.** First composite migrated: `RebalanceDetailsModal` (164 lines, single consumer in `RebalanceCard.js`, pure presentation). Pivoted from the originally-planned `IgnoreStockCard` after the migration discovered it was orphan dead code (zero consumers — deleted in the same commit). New file at `designs/default/composites/RebalanceDetailsModal.js`, registered as `composites.RebalanceDetailsModal`. Consumer (`src/UIComponents/RebalanceAdvicesUI/RebalanceCard.js`) updated to resolve via `useComponent`. Legacy `src/components/AdviceScreenComponents/RebalanceDetailsModal.js` deleted.
5. **Phase E — Home + Order screens.**
   - **E.1 — OrderScreen ✅ Shipped 2026-05-01.** Container at `src/screens/Home/OrderScreen.js` (1195 lines → ~120 lines after dropping dead code: PanResponder + tab system + `imageUrl` / `isModalOpen` / `MODAL_STATE` listener that was never reached). Presentation at `designs/default/screens/OrderScreen.js`. `OrderRow` composite extracted to `designs/default/composites/OrderRow.js`. Date / symbol / status-color helpers extracted to `src/utils/orderUtils.js`. Sets the container/presentation template for whole-screen migrations.
   - **E.1.5 — HomeScreen prep refactor ✅ Shipped 2026-05-01.** Two new hooks at `src/screens/Home/hooks/`: `useHomeScreenTabs` (consolidates `selectedTab` + 7 see-all overlay booleans behind a single `overlay: string | null` state with backward-compat boolean shims) and `useHomeScreenModals` (consolidates 4 modal-visibility booleans behind `{ activeModal, activeModalData }` with shims). HomeScreen.js sheds 12 useState declarations; call sites unchanged thanks to the shims. No `designs/` migration in this commit — internal refactor only, prepares the surface for E.2.
   - **E.2 — HomeScreen registry hookup ✅ Shipped 2026-05-02.** **Minimal scope.** `src/screens/Home/HomeScreen.js` is now a thin registry resolver (`useComponent('screens.HomeScreen')`). The legacy implementation moved to `src/screens/Home/HomeScreenLegacy.js`; default variant re-exports it. Custom variants can fully replace HomeScreen by shipping `designs/<variant>/screens/HomeScreen.js` (variants take responsibility for re-calling useTrade / useConfig / useNavigation themselves).
   - **E.3 — HomeScreen deep container/presentation split ✅ Shipped 2026-05-02.** Container at `src/screens/Home/HomeScreen.js` (~1654 lines — all hooks, state, effects, handlers, `allTabData` builder, FCM/notifee, EventEmitter). Presentation at `designs/default/screens/HomeScreen.js` (~642 lines — JSX render + 4 modals). Styles in shared `src/screens/Home/HomeScreen.styles.js`. `HomeScreenLegacy.js` deleted. The split passes a single ~50-key `home` prop bag from container to presentation. Variant overridability now works end-to-end. Sub-steps shipped: E.3.1 (styles extraction), E.3 deep split (JSX extraction).
6. **Phase F — Authentication / Account settings.**
   - **Batch 1 ✅ Shipped 2026-05-01.** 4 clean-extracts: `ResetPassword`, `EmailScreenAppleLogin`, `TermsModal` (composite), `LogOutScreen`. All container/presentation split + registered. ~470 lines of presentation across 4 files.
   - **Batch 2 ✅ Shipped 2026-05-01.** `LoginScreen` + `SignupScreen` — paired auth screens, container/presentation split. All Firebase / Google / Apple / post-login orchestration preserved exactly in containers. Render-extraction only.
   - **Batch 3 ✅ Shipped 2026-05-01.** `SignUpRADetails` + `PhoneNumberScreen` — paired onboarding. Container/presentation split. PhoneNumberScreen migration also fixed a pre-existing missing-`Config`-import ReferenceError bug.
   - **Batch 4 ✅ Shipped 2026-05-01.** `ChangeAdvisor` (Account section). All Phase F surfaces complete.
7. **Phase G — Advice screens (non-MP).** Rebalance flows excluded (deferred).
8. **Phase H — Modals (non-SDK-bound).** The long tail.
9. **Phase I — MP screens. ✅ Shipped 2026-05-03.** ModelPortfolioScreen (1115 LOC), MPPerformanceScreen (2220 LOC), MPCard, ModelPFCard, CustomTabbarMPPerformance, EmptyStateMP — all container/presentation split. MPInvestNowModal (5364 LOC) — container/presentation split with payment gateway code in container.
   - **NOT in `designs/`** (SDK-replaced): `MPReviewTradeModal` (2151 LOC), `RebalanceModal` (2650 LOC), `RebalanceAdviceContent` — these are replaced by SDK orchestrator widgets (`tradeReviewSheet`, `tradeResultModal`, `tradeExecutionProgress`, `sellAuthGate`). Customizable via `designs/<variant>/sdk/` instead. See `docs/SDK_DESIGN_PASSTHROUGH.md § 9`.

**All A–I registry phases are complete.** The design system covers 61+
registered surfaces. This means the resolution path exists; it does not mean
every registered presentation is isolated yet. The 2026-09-27 boundary audit
tracks the remaining container/service imports. Any new surface follows the
same pattern: container at `src/`, presentation at `designs/default/`,
registered in `designs/default/index.js`, with no new baseline exception.

Each phase is the smallest atomic unit that ships value and can be reverted cleanly. Don't bundle them.

## Backend overrides

Tokens already integrate with `appadvisors.colorTokens`. The same per-tenant override pattern extends to:

- `appadvisors.spacingTokens` — partial override of the `spacing` object
- `appadvisors.typographyTokens` — partial override of the `typography` object
- `appadvisors.radiiTokens` — partial override of the `radii` object

Component-level overrides (e.g. "use `MyBrokerCard` for advisor X") are **not** backend-driven in v1. They require a build-time `DESIGN_VARIANT`. This is a deliberate scope cut: per-tenant component swaps would need either (a) bundle splitting or (b) shipping every variant in every build, both of which are non-trivial.

## Testing strategy

- **Snapshot tests per primitive** in `designs/default/`. A variant ships its own snapshots.
- **Container-only tests** for screens in `src/` — mock the resolved presentation, assert the container builds the right viewModel.
- **Visual regression** (Storybook or similar) lives at `designs/default/.storybook/`. Variants get their own. Out of scope for v1 — flag for follow-up.
- **Registry contract test** (`src/__tests__/designVariantContract.test.js`) checks token/component/SDK fallback and rejects private component or SDK keys.
- **Presentation-boundary CI audit** (`npm run audit:design`) rejects new imports from `designs/**` into network, storage, Firebase, navigation, contexts, services, or src-owned UI — by static `import`, `require()` **or dynamic `import()`** (non-literal `import(expr)` is rejected as unresolvable; added 2026-09-29, pinned by `src/__tests__/designBoundaryDynamicImport.test.js`). The exact historical debt is recorded in `scripts/design-boundary-baseline.json`; both new violations and stale baseline entries fail CI, so cleanup only moves the count down.
- **Source-style CI ratchet** (`npm run audit:styles`) enforces zero production
  `src/` hex/font literals. Token definitions, comments, tests, and
  `designs/**` are excluded intentionally. `npm run validate:design-literals`
  also compiles every source file and proves build-time markers disappear.

### How to change a variant's design or UX

The operational procedure (which change needs what, tokens incl. build-time
`literals.json`, component overrides, visual baselines) is
[`VARIANT_CREATION_GUIDE.md`](./VARIANT_CREATION_GUIDE.md) § "Which change
needs what" and § 7. Flow changes (steps, actions, data) are `src/` container
changes and need functional testing; design-folder changes need visual
verification only.

### Presentation boundary (completed 2026-09-28)

The first executable audit found 62 forbidden import edges across 17 design
files. After the Provisional/Transition extraction and the final container/slot
pass, the audit discovers **0 edges across 0 files**. Design presentations no
longer import network, storage, Firebase, navigation, contexts, services, or
src-owned UI.

The permanent contract is:

- `src/` containers own state, effects, navigation, service calls, payment,
  Digio, broker and SDK behavior;
- `designs/**` receives display-ready `viewModel`, callbacks in `actions`, and
  any app-owned visual/behavioral collaborator through `slots`;
- the visible navigator chrome resolves `shell.AppHeader` and
  `shell.MainTabBar`; route state and navigation events remain src-owned;
  navigator STRUCTURE (which tabs, order, More menu) is the data-only
  navigation manifest (§ Navigation manifest), resolved in `src/`;
- new forbidden imports — static, `require()` or dynamic `import()` — fail
  `npm run audit:design`; and
- removing a registered component is safe only after proving it has no caller,
  as done for the unreachable `AumPerformanceCard`.

## Navigator convention — render-stable Tab.Screen components

`src/components/Navigation.js` (and any future navigators) MUST pass screens via `component={ModuleScopedRef}` rather than inline render-prop children. Inline children (e.g. `<Tab.Screen>{() => <Foo />}</Tab.Screen>`) recreate the component identity on every parent render, which forces React Navigation to remount the nested screen tree — a perf cost AND a state-loss hazard for any screen that holds a tab-local view-model.

When a screen needs to be parameterized at the navigator level (e.g. `<ModelPortfolioScreen type="tab" />`), wrap it in a module-scope component:

```js
const PlansTabWrapper = () => <ModelPortfolioScreen type="tab" />;
// ...
<Tab.Screen name="Plans" component={PlansTabWrapper} options={{headerShown: false}} />
```

This convention exists because variant designs sit *behind* the navigator — a remount-on-render bug at the navigator layer would manifest as state-loss in every variant's `screens.ModelPortfolioScreen` presentation, which is impossible to debug by reading the variant's code.

## What's NOT in this design

Calling these out so they don't get smuggled in:

- No CSS-in-JS / styled-components migration. RN `StyleSheet` stays.
- No new state-management library. Zustand + contexts stay.
- No package extraction. `designs/` is part of this repo.
- No arbitrary/runtime-downloaded designs. The AlphaB2B master build may
  switch only among statically registered variants when its authenticated
  advisor config changes; fork builds remain fixed by `DESIGN_VARIANT`.
- No per-component backend override. v1 = build-time only.
- No codegen, bundle splitting, or runtime component download. The static CI
  boundary audit is allowed because it enforces this architecture; it does not
  alter the runtime bundle.
- No refactor of business logic, hooks, or services. Containers MAY be cleaned up incidentally during the split, but cleanup is not the goal — separation is.

## When to update this doc

Same rule as Phase 3: this doc is the design source of truth, the audit is the per-surface implementation tracker, the progress log is the work history. Update this file BEFORE the matching code change. Specifically:

- Adding/removing a primitive from the catalog
- Changing the registry resolution rules
- Changing the provider API or adding a new hook
- Changing the variant selection precedence
- Changing the SDK boundary (surfaces in/out of `designs/`)
- Changing the container/presentation contract
- Promoting or freezing a screen group (e.g. lifting the MP freeze)

Cosmetic-only changes (token defaults, internal primitive layout) need an audit row update + progress log entry, not necessarily an architecture-doc change.

---

## 2026-07-18 — Current presentation boundary notes

The Portfolio and MP investment presentations remain in `designs/default/`; the
containers retain navigation, payment, subscription and data behaviour. The
current fixes are presentation-level: Portfolio renders the Trade P&L control
with the scrollable Model Portfolio list rather than above it, and the MP modal
reserves a non-overlapping header area for its close control. No payment or
Digio implementation moved into `designs/`.

The broker SDK remains a `src/` host/SDK-bound surface. Its advisor-theme skin
and in-app walkthrough shell are host chrome, not a replacement for SDK form
rendering or security logic.

PortfolioSummaryCard is likewise presentation-only. Its portfolio-state label,
fund-row typography, and explanatory copy must use the Portfolio screen's
Poppins hierarchy; an expired subscription status is subordinate metadata, never
an inline suffix that competes with or wraps a fund name.

`MPPerformanceScreen` remains a container/presentation split. Its navigational
bar stays fixed for safe back navigation, while the portfolio summary belongs
inside the Overview scroll surface. The summary may link to the consent-gated
historical-performance section, but it must not promote CAGR as a standalone
headline return; risk wording identifies volatility as manager-selected.

The subscribed detail (`AfterSubscriptionScreen`) follows the same customer
mental model: current holdings, manager target mix, then strategy/performance.
Its action bar is a safe-area-aware control region, not content that can be
clipped by a device's gesture area. While its broker and subscription snapshots
are loading, the value hero uses neutral placeholders and the Holdings tab uses
an explicit progress state; a loading request must never be presented as ₹0 or
as a confirmed empty portfolio.

### Customer terminology — Manager (2026-07-18)

All customer-visible labels, helper copy, alerts and empty states use
**manager** (including “financial manager” where that is clearer), not
“advisor”. This is a presentation rule only: API headers, routes, config keys,
database fields and variable names such as `X-Advisor-Subdomain`, `advisor`,
and `advisorName` remain unchanged for compatibility.

### Remote-image failure contracts (2026-07-28)

Remote asset health belongs to the container/action boundary, while fallback
layout belongs to the presentation:

- `screens.PaymentHistoryScreen` receives `advisorLogo` and
  `advisorLogoFallback`; its presentation may advance through those supplied
  sources plus a row's historical logo, but performs no config lookup.
- `composites.MPCard` receives the already-resolved `imageUri` and
  `fallbackImage`, and reports `actions.onImageError`. The container owns the
  failed-source state and re-renders with `imageUri: null`.

This keeps tenant configuration and error state outside `designs/` without
allowing a broken remote URL to create a blank customer-facing surface.
