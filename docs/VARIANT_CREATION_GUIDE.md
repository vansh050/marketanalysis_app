# Variant Creation Guide — Build a New App on the AlphaQuark Stack

> **Audience**: Developers creating a new tenant app (different brand,
> different UI) on the AlphaQuark B2B platform. This guide covers both
> app-level design customization (DesignProvider) and SDK widget
> customization (component passthrough).

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Your App (new variant)                              │
│                                                      │
│  designs/yourcompany/                                │
│  ├── tokens/        ← colors, fonts, spacing         │
│  ├── primitives/    ← Button, Card, Input (optional) │
│  ├── composites/    ← OrderRow, TermsModal (optional)│
│  ├── screens/       ← HomeScreen, LoginScreen, etc   │
│  └── index.js       ← registry (what you override)   │
│                                                      │
│  Renders via: useComponent('screens.HomeScreen')     │
│  Resolution: yourcompany → default → error           │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  Shared Logic (never changes)                        │
│                                                      │
│  src/screens/       ← containers (hooks, state, API) │
│  src/components/    ← business logic components      │
│  src/utils/         ← helpers, formatters            │
│  src/context/       ← React contexts                 │
│  src/services/      ← API services                   │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  @alphaquark/mobile-sdk                              │
│                                                      │
│  Broker connect, trade execution, sell-auth,         │
│  rebalance — themed via SdkTheme + components prop   │
└─────────────────────────────────────────────────────┘
```

**Principle**: Logic is shared. Rendering is swappable. You design,
the platform orchestrates.

---

### Which change needs what

| You want to… | Where | Retest? |
|---|---|---|
| Change brand colours / fonts / spacing / logos | `designs/<variant>/tokens/` (builders + `literals.json`, §3 Layer 1) | visual only |
| Restyle or re-layout a screen, composite, primitive, header or tab bar | copy the file from `designs/default/` into `designs/<variant>/` and register the same key (§3 Layers 2–3) | visual only |
| Restyle trade/broker/sell-auth SDK widgets | `designs/<variant>/sdk/` (§3 Layer 4) | visual only |
| Change which tabs exist, their order/labels/icons, the first tab, the More menu, or skip the onboarding carousel | `designs/<variant>/navigation.js` data manifest (§3 Layer 5) | navigate every tab + More row once |
| Add a step, change what a button does, show new data | the `src/` container (and its tests), then expose it via `viewModel`/`actions` | **full functional test** |
| Change payment, auth or broker-connection behaviour | `src/` / SDK — never `designs/` | full functional test |

### The boundary rule (enforced)

A design file renders `viewModel` (data), calls `actions` (callbacks) and
places `slots` (app-owned components such as payment modals). It never
imports app logic. `npm run audit:design` (`scripts/audit-design-boundaries.js`,
CI `lint-imports`) rejects, anywhere under `designs/`: axios, AsyncStorage,
Firebase, React Navigation, `fetch`, contexts, services and `src/` screens or
components — **whether imported statically, with `require()`, or with a
dynamic `import()`** (a non-literal `import(expr)` is rejected outright). The
baseline is 0 and must stay 0: if a design needs app behaviour, the container
passes it in. Never widen the audit allowlist to make a design compile.

The style ratchet (`npm run audit:styles`) keeps `src/` at 0 hardcoded colours
and 0 font families; new visual values go into tokens.

---

## 2. Quick Start (30 minutes to first screen)

```bash
# 1. Create your variant folder
mkdir -p designs/yourcompany/{tokens,screens}

# 2. Create token builders in designs/yourcompany/tokens/index.js.
# Each exported build* function may override one family; omitted builders
# fall through to default. See §3 for the required export shape.

# 3. Create your registry
cat > designs/yourcompany/index.js << 'EOF'
import * as tokens from './tokens';
import sdk from './sdk';

export default {
  name: 'yourcompany',
  tokens,
  components: {
    // Override specific screens here. Everything else
    // falls through to designs/default/.
  },
  sdk,
};
EOF

# 4. Register your variant
# In designs/registry.js, add:
#   import yourcompany from './yourcompany';
#   export default { default: defaultVariant, yourcompany };

# 5. Set env vars
echo "DESIGN_VARIANT=yourcompany" >> .env
echo "APP_VARIANT=yourcompany" >> .env

# 6. Run — your tokens apply immediately to every screen
npx react-native start
```

---

## 3. What You Can Override (per layer)

### Layer 1: Tokens (instant brand change)

`tokens/index.js` is a builder namespace, not a static default export. It may
export any subset of `buildColors`, `buildSpacing`, `buildTypography`,
`buildRadii`, `buildShadows`, and `buildAssets`; omitted builders fall back to
`designs/default`. Builders receive the advisor config, so nested backend token
overrides can remain the final layer.

Minimal spacing-only variant:

```js
import {DEFAULT_SPACING} from '../../../src/theme/spacing';

const VARIANT_SPACING = {
  ...DEFAULT_SPACING,
  md: 16,
  lg: 24,
  xl: 32,
};

export const buildSpacing = config => ({
  ...VARIANT_SPACING,
  ...(config?.spacingTokens || {}),
});
```

Follow the same pattern for the other families, deep-merging role objects for
typography/shadows and semantic groups for colors. Static RN images are
returned by `buildAssets()` and must use bundle-time `require()` calls.

Effect: every `useTokens()` consumer picks up the active variant's builder for
all six families. This used to work only for colors/assets; the complete
builder contract has been live since 2026-09-27.

**Build-time literal colours and fonts.** Legacy customer screens call
`designColor('<hex>')` / `designFont('<family>')` (`src/design/literalTokens.js`).
`scripts/babel-plugin-design-literals.js` replaces each call at build time with
the value from `designs/<variant>/tokens/literals.json`, merged over
`designs/default/tokens/literals.json`:

```json
{ "colors": { "0056b7": "#0B6E4F" }, "fonts": { "Satoshi-Medium": "Inter-Medium" } }
```

The plugin reads `DESIGN_VARIANT` (then `APP_VARIANT`) from the shell **or
`.env`**, and `metro.config.js` puts the variant + literal maps into Metro's
`cacheVersion`, so a normal Metro restart picks up changes.
`node scripts/validate-design-literal-compile.js` checks every call compiles.

### Layer 2: Primitives (change base components)

Override only the ones you want different. Each primitive receives
standard props:

```js
// designs/yourcompany/primitives/Button.js
export default function Button({ label, onPress, variant, disabled, style }) {
  // Your custom button implementation
  // variant: 'primary' | 'secondary' | 'ghost' | 'destructive'
}
```

Available primitives: `Text`, `Button`, `Card`, `Input`, `Spinner`,
`Icon`, `Pill`, `Divider`, `Toast`, `ModalShell`.

### Layer 3: Screens (change full layouts)

Each screen receives `({ viewModel, actions })`. The viewModel shape
is documented per screen:

```js
// designs/yourcompany/screens/HomeScreen.js
export default function HomeScreen({ viewModel, actions }) {
  const { advices, portfolios, broker, funds, tabs, modals, userName } = viewModel;
  const { onTabChange, onAdviceTap, onRefresh, onPortfolioTap } = actions;

  return (
    <YourLayout>
      <YourHeader user={userName} />
      <YourTabBar tabs={tabs} onSelect={actions.onTabChange} />
      <YourAdviceList data={advices} onTap={actions.onAdviceTap} />
    </YourLayout>
  );
}
```

### Layer 4: SDK Widgets (change trade/broker/sell-auth UX)

SDK widgets are overridden from `designs/<variant>/sdk/` — same
folder structure as screens. No separate configuration needed:

```
designs/yourcompany/sdk/
├── TradeReviewSheet.js       ← your trade review UI
├── SellAuthGate.js           ← your DDPI/EDIS prompt
├── BrokerCredentialForm.js   ← your broker credential form
└── index.js                  ← exports the overrides
```

```js
// designs/yourcompany/sdk/index.js
import TradeReviewSheet from './TradeReviewSheet';
import SellAuthGate from './SellAuthGate';
export default { tradeReviewSheet: TradeReviewSheet, sellAuthGate: SellAuthGate };
```

The `SdkProviderRoot` reads `designs/<variant>/sdk/` automatically
via `useDesign().sdk` and passes it to `<AqSdkProvider components={...}>`.

10 registered slots: tradeReviewSheet, tradeExecutionProgress,
tradeResultModal, sellAuthGate, brokerCredentialForm,
brokerWebViewHeader, brokerSelectionList, modifyInvestmentSheet,
rebalancePnlChoice, kitePublisherHeader.

The installed RN SDK currently consumes the first three trade-overlay slots.
The remaining seven are registered and passed through the provider but are
integration-pending in their owning SDK widgets. See
`SDK_DESIGN_PASSTHROUGH.md § 9` before promising a tenant that one of those
seven will render.

See `docs/SDK_DESIGN_PASSTHROUGH.md § 9` for the full props contract
per slot.

You can also pass overrides directly if you prefer:

```jsx
<AqSdkProvider
  client={client}
  userRef={email}
  theme={{ colors: { primary: '#FF6B00' } }}
  components={{
    tradeReviewSheet: YourReviewSheet,
    tradeResultModal: YourResultModal,
    sellAuthGate: YourSellAuth,
  }}
>
```

---

### Layer 5: Navigation manifest (change app structure)

Declare structure as **data** in `designs/<variant>/navigation.js` and register
it as `navigation` in your variant's `index.js`. Override only the keys you
need; omitted keys fall back to `designs/default/navigation.js`, and arrays
replace default's whole.

```js
// designs/yourcompany/navigation.js — no imports, no functions (audit-enforced)
export default {
  tabs: [
    {key: 'advice', label: 'Home', icon: 'home'},
    {key: 'portfolio', label: 'Holdings'},
    {key: 'news'},
    {key: 'watchlist'},
    {key: 'more'},
  ],
  initialTab: 'advice',
  preLogin: ['phoneLogin'],            // skip the onboarding carousel
  chrome: {tabBarHeight: 64},
};
```

- Keys come from `src/navigation/screenCatalog.js`. Tabs: `advice`, `orders`,
  `portfolio`, `plans`, `news`, `watchlist`, `more`. A screen that isn't in the
  catalog needs a `src/` change first.
- 1–6 tabs. `more` is required and re-added if you drop it (it is the only
  route to Log Out, legal pages and in-app account deletion). Privacy Policy,
  Terms, Delete Account and Log Out rows are likewise re-added to the More menu.
- You cannot express or reorder auth, KYC, MITC/payment or broker/trade steps.
- Unknown keys are dropped and reported as a `nav_manifest_warning` anomaly —
  check the device log after changing a manifest.
- Full contract: `docs/CONFIGURABLE_NAVIGATION_DESIGN.md`.

## 4. Migrated Surfaces (what's swappable today)

> **Source of truth:** the keys registered in `designs/default/index.js`
> (2026-09-29: 54 `screens.*`, 23 `composites.*`, 10 `primitives.*`, 2
> `shell.*` — `shell.AppHeader`, `shell.MainTabBar`). 50 of the 56 navigator
> screens resolve through the registry; the other six (broker auth/credential/
> selection, SDK self-tests, splash) are SDK-owned or non-customer by design.
> The per-surface tables below are historical detail; `DESIGN_COMPONENT_AUDIT.md`
> holds the current verdicts.

### Screens (22 surfaces)

| Screen | Registry Key | Container Location |
|---|---|---|
| HomeScreen | `screens.HomeScreen` | `src/screens/Home/HomeScreen.js` |
| OrderScreen | `screens.OrderScreen` | `src/screens/Home/OrderScreen.js` |
| LoginScreen | `screens.LoginScreen` | `src/screens/Authentication/LoginScreen.js` |
| SignupScreen | `screens.SignupScreen` | `src/screens/Authentication/SignupScreen.js` |
| ResetPassword | `screens.ResetPassword` | `src/screens/Authentication/ResetPassword.js` |
| EmailScreenAppleLogin | `screens.EmailScreenAppleLogin` | `src/screens/Authentication/EmailScreenAppleLogin.js` |
| PhoneNumberScreen | `screens.PhoneNumberScreen` | `src/screens/Authentication/PhoneNumberScreen.js` |
| SignUpRADetails | `screens.SignUpRADetails` | `src/screens/Authentication/SignUpRADetails.js` |
| LogOutScreen | `screens.LogOutScreen` | `src/screens/Authentication/LogOutScreen.js` |
| ChangeAdvisor | `screens.ChangeAdvisor` | `src/screens/AccountSettingScreen/ChangeAdvisor.js` |
| PrivacyPolicyScreen | `screens.PrivacyPolicyScreen` | `src/screens/Drawer/PrivacyPolicyScreen.js` |
| TermandConditionsScreen | `screens.TermandConditionsScreen` | `src/screens/Drawer/TermandConditionsScreen.js` |
| ProductCatalogScreen | `screens.ProductCatalogScreen` | `src/screens/Drawer/ProductCatalogScreen.js` |
| ReviewScreen | `screens.ReviewScreen` | `src/screens/Drawer/ReviewScreen.js` |
| CustomTabBarOrder | `screens.CustomTabBarOrder` | `src/screens/Drawer/CustomTabbarOrder.js` |
| PaymentHistoryScreen | `screens.PaymentHistoryScreen` | `src/screens/Drawer/PaymentHistoryScreen.js` |
| DistributionRowGrid | `screens.DistributionRowGrid` | `src/screens/Drawer/DistributionRowGrid.js` |
| AccountSettingsScreen | `screens.AccountSettingsScreen` | `src/screens/Home/AccountSettingsScreen.js` |
| BespokePerformanceScreen | `screens.BespokePerformanceScreen` | `src/screens/Drawer/BespokePerformanceScreen.js` |
| BlogScreen | `screens.BlogScreen` | `src/components/HomeScreenComponents/KnowledgeHubScreen/BlogScreen.js` |
| VideoScreen | `screens.VideoScreen` | `src/components/HomeScreenComponents/KnowledgeHubScreen/VideoScreen.js` |
| PdfScreen | `screens.PdfScreen` | `src/components/HomeScreenComponents/KnowledgeHubScreen/PdfScreen.js` |
| IgnoreTradesScreen | `screens.IgnoreTradesScreen` | `src/screens/Drawer/IgnoreTradesScreen.js` |
| WatchlistScreen | `screens.WatchlistScreen` | `src/screens/Home/WatchlistScreen.js` |
| ModelPortfolioScreen | `screens.ModelPortfolioScreen` | `src/screens/Drawer/ModelPortfolioScreen.js` |
| MPPerformanceScreen | `screens.MPPerformanceScreen` | `src/screens/Drawer/MPPerformanceScreen.js` |
| MPInvestNowModal | `screens.MPInvestNowModal` | `src/components/ModelPortfolioComponents/MPInvestNowModal.js` |

### Composites (17 surfaces)

| Composite | Registry Key |
|---|---|
| OrderRow | `composites.OrderRow` |
| RebalanceDetailsModal | `composites.RebalanceDetailsModal` |
| TermsModal | `composites.TermsModal` |
| DeleteAdviceModal | `composites.DeleteAdviceModal` |
| GttDetailsModal | `composites.GttDetailsModal` |
| GttSuccessModal | `composites.GttSuccessModal` |
| HoldingsMigrationModal | `composites.HoldingsMigrationModal` |
| BasketTradeModal | `composites.BasketTradeModal` |
| BrokerSelectionModal | `composites.BrokerSelectionModal` |
| StockCard | `composites.StockCard` |
| BasketCard | `composites.BasketCard` |
| CustomTabbarMPPerformance | `composites.CustomTabbarMPPerformance` |
| EmptyStateMP | `composites.EmptyStateMP` |
| ModelPFCard | `composites.ModelPFCard` |
| MPCard | `composites.MPCard` |

### Primitives (10 surfaces)

Text, Button, Card, Input, Spinner, Icon, Pill, Divider, Toast, ModalShell

### SDK Widgets (10 registered slots; 9 active, `brokerSelectionList` reserved — 2026-10-01)

Every active slot replaces **presentation only** (state + action callbacks;
the SDK keeps validation, encryption, sell-auth checks and API calls).
Contracts: `SDK_DESIGN_PASSTHROUGH.md § 9`. In your variant, a `null` entry
means the SDK built-in; `designs/default/sdk/` ships reference header /
P&L-choice files you can copy — they are not registered by default.

tradeReviewSheet, tradeExecutionProgress, tradeResultModal,
sellAuthGate, brokerCredentialForm, brokerWebViewHeader,
brokerSelectionList, modifyInvestmentSheet, rebalancePnlChoice,
kitePublisherHeader

tradeReviewSheet, tradeResultModal, sellAuthGate, tradeExecutionProgress

---

## 5. SDK-Replaced Surfaces (customized via `designs/sdk/`, not `designs/screens/`)

These surfaces are owned by the SDK orchestrator, NOT the design
system. They're customizable via `designs/<variant>/sdk/`:

| Surface | SDK Widget Slot | Why SDK-owned |
|---|---|---|
| MPReviewTradeModal (trade review) | `tradeReviewSheet` | SDK `executeAdvice` renders it |
| RebalanceModal (trade review) | `tradeReviewSheet` | Same — SDK renders review |
| RecommendationSuccessModal (result) | `tradeResultModal` | SDK renders result |
| DDPI/EDIS modals (6 modals) | `sellAuthGate` | SDK renders sell-auth gate |
| Trade progress spinner | `tradeExecutionProgress` | SDK renders during polling |
| Broker credential form | `brokerCredentialForm` | SDK renders on connect |

To customize these, put your components in `designs/<variant>/sdk/`
(not `designs/<variant>/screens/`). See § 4 Layer 4.

**MPInvestNowModal** is the one exception — it's in `designs/screens/`
because payment gateways stay app-owned. The plan selection / pricing /
wizard UI is customizable; payment callbacks are container-only.

**The A–I registry migration is complete, but presentation isolation is not.**
The default registry covers the migrated app surfaces; the executable boundary
audit still tracks 62 src/business-logic import edges across 17 design files.
New surfaces follow the container/presentation pattern and may not widen that
baseline.

---

## 6. Config & Env Variables

| Variable | Purpose |
|---|---|
| `DESIGN_VARIANT` | Which `designs/<variant>/` folder to load |
| `APP_VARIANT` | Fallback if `DESIGN_VARIANT` not set; also selects backend config |
| `REACT_APP_SDK_INTEGRATION` | Mount SDK provider (true/false) |
| `REACT_APP_USE_SDK_BROKER_FLOW` | Route broker connect through SDK |
| `REACT_APP_USE_SDK_EXECUTE_ADVICE` | Route trade execution through SDK |
| `REACT_APP_ZERODHA_API_KEY` | Kite Publisher basket (or resolved from DB via fetchConfig) |

---

## 7. Testing Your Variant

```bash
# Run with your variant
DESIGN_VARIANT=yourcompany npx react-native start

# When DESIGN_VARIANT is stored in .env, a normal Metro restart is sufficient
# after changing the variant or tokens/literals.json. The transform cache key
# includes both; --reset-cache is not required.

# Verify token resolution
# In any component: const tokens = useTokens();
# console.log(tokens.colors.brand.primary); // should be YOUR color

# Verify screen resolution
# Navigate to any migrated screen — should render YOUR presentation
# Navigate to non-migrated screen — renders default (expected)

# Verify SDK theming
# Connect a broker — SDK modal should use YOUR theme colors
# Place a test trade — review sheet should be YOUR component (if overridden)

# Contract / architecture gates (must pass for every variant branch)
npm test -- --runInBand --no-watchman src/__tests__/designVariantContract.test.js
npm run audit:design
```

**Visual regression (Maestro).** `npm run test:design:maestro`
(`scripts/run-maestro-design-variants.sh` + `scripts/compare-maestro-screenshots.js`)
captures Home, News, Portfolio, Subscriptions and Model Portfolio on an
emulator and compares each with `.maestro/design-variants/baselines/<variant>/`
(≤1.5% changed pixels; diffs under `artifacts/design-variants/diffs/`). A
missing baseline fails. After an intentional design change, capture and review
candidates, then commit them:

```bash
UPDATE_VISUAL_BASELINES=1 DESIGN_VARIANT=<variant> npm run test:design:maestro
```

In CI, dispatch the **Android Build** workflow with `capture_design_baselines:
true` (it builds the debug fixture APK and runs the comparison on a
KVM-accelerated `pixel_6` / API 35 emulator). Baselines must be captured in
that same emulator profile. Every new variant needs its own baseline folder.
Details: `.maestro/README.md` § Design visual baselines.

The goal is to test shared business logic once and limit each variant to
contract checks plus visual review. The design-boundary baseline is zero; any
new network, storage, navigation, context or app-logic dependency in
`designs/**` fails CI. A design that changes the flow (steps, required actions,
payment/auth behavior) is always a product logic change and still requires
functional testing.

---

## 8. Maintenance

When the platform ships a new feature:
- If the feature is in a **migrated** screen → your variant's
  presentation receives the new viewModel fields automatically.
  You MAY need to render them (or ignore them — both work).
- If the feature is in a **non-migrated** screen → renders via
  the legacy code. Your variant isn't affected.
- If the feature adds a new **SDK widget** → your component
  passthrough still works. New SDK props are additive.

When you want to update your variant:
- Pull the latest from the platform repo
- Check `docs/DESIGN_MIGRATION_PROGRESS.md` for newly migrated surfaces
- Override any new screens you want to customize
- Existing overrides continue to work (viewModel contract is stable)
