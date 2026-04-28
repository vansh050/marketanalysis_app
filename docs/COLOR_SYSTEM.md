# COLOR_SYSTEM.md — How App Colors Work & Where to Change Them

> **TL;DR** — Every color in the mobile app resolves through a semantic token layer (`src/theme/colors.js`). Advisors change colors from **support.alphaquark.in → App Advisor Config → Theme Configuration → Semantic Color Tokens**. The override is saved to MongoDB (`appadvisors.colorTokens`) and served back via `GET /api/app-advisor/get`. No app rebuild is required.

---

## 1. Where to change colors (step-by-step)

1. Open **https://support.alphaquark.in**.
2. Go to **App Advisor Config**.
3. Enter the advisor **Subdomain** (e.g. `rgxresearch`) in the top bar and click **Fetch**.
4. Scroll to the **Theme Configuration** panel (the pink "Save Theme" header).
5. Inside that panel you'll see several sections:
    - **Theme Colors** — legacy branding fields (`Main Color`, `Secondary Color`, `Gradient 1/2`, `Placeholder Text`). These are the advisor's brand identity and flow into the `brand.*` semantic tokens automatically.
    - **Bottom Tab Styling / Basket Colors** — also legacy, also flow into semantic tokens.
    - **Semantic Color Tokens** *(new)* — fine-grained overrides grouped into `Text`, `Surface`, `Border`, `Status`, `P&L`, and an `Advanced (Raw JSON)` escape hatch.
6. Click **Save Theme** at the top of the panel.
7. Kill and reopen the mobile app (or pull-to-refresh on login) — the new colors load on next app start when `ConfigContext` fetches the config.

### What happens when a field is blank

**Blank = use the app default.** The system layers overrides: start from the app defaults, layer legacy branding fields on top, then layer `colorTokens`. Any field you leave blank keeps whatever was resolved by the earlier layer.

This means an advisor who only sets `Main Color` (legacy) still gets a coherent palette — `text.primary`, `surface.card`, `pnl.profit`, etc. all use their app defaults.

---

## 2. Data flow end-to-end

```
  ┌─────────────────────────────────────────────────────────────┐
  │ support.alphaquark.in   (supportAQ/AppAdvisorConfig.jsx)    │
  │                                                             │
  │   User edits Theme Configuration → clicks Save Theme        │
  │   → PUT /api/app-advisor/update-theme                       │
  │     { subdomain, ...legacy, colorTokens: {...} }            │
  └─────────────────────────────────────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ Backend   (aq_backend_github)                               │
  │                                                             │
  │   Routes/AppAdvisor/AppAdvisorRouter.js  /update-theme      │
  │   → themeUpdate.colorTokens = colorTokens                   │
  │   → Models/appAdvisorModel.js  `colorTokens: Mixed`         │
  │   → MongoDB collection `appadvisors`                        │
  └─────────────────────────────────────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ Mobile app on start   (Alphab2bapp)                         │
  │                                                             │
  │   ConfigContext.js fetches GET /api/app-advisor/get         │
  │   → config.colorTokens passed through ctx                   │
  │                                                             │
  │   useColors() → buildColors(config) in src/theme/colors.js  │
  │   = DEFAULT_TOKENS + legacy branding + colorTokens merge    │
  │                                                             │
  │   Components consume colors.text.primary / .pnl.profit / …  │
  └─────────────────────────────────────────────────────────────┘
```

Key files:

| Layer | File | What it does |
|---|---|---|
| Support UI | `supportAQ/src/components/AppAdvisorConfig.jsx` | Color picker form, posts to `/update-theme` |
| Backend schema | `aq_backend_github/Models/appAdvisorModel.js` | `colorTokens: Mixed` field |
| Backend route | `aq_backend_github/Routes/AppAdvisor/AppAdvisorRouter.js` | Reads `colorTokens` from body in `/update-theme`, returns in `/get` |
| App context | `src/context/ConfigContext.js` | Surfaces `colorTokens` in React context |
| App theme | `src/theme/colors.js` | `DEFAULT_TOKENS` + `buildColors(config)` merge |
| App hook | `src/theme/useColors.js` | Memoized `useColors()` for components |

---

## 3. How a component uses colors

```js
import { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useColors } from '../theme/useColors';

export default function StockRow({ ltpChangePct }) {
    const colors = useColors();

    const styles = useMemo(() => StyleSheet.create({
        row:   { backgroundColor: colors.surface.card, borderColor: colors.border.default },
        name:  { color: colors.text.primary },
        sub:   { color: colors.text.muted },
        chip:  {
            color: ltpChangePct >= 0 ? colors.pnl.profit : colors.pnl.loss,
            backgroundColor: ltpChangePct >= 0 ? colors.pnl.profitBg : colors.pnl.lossBg,
        },
    }), [colors, ltpChangePct]);

    return (...)
}
```

**Rules for component authors:**

- **Never write a hex literal.** Always read through `useColors()`.
- **Never fall back to a hex.** If a token doesn't exist, add it to `DEFAULT_TOKENS` rather than writing `colors.x.y || '#someHex'`.
- **Memoize your styles on `colors`** so the sheet is only rebuilt when the palette actually changes.

See `docs/COLOR_TOKENS.md` for the full catalog and available tokens.

---

## 4. Migration roadmap (existing hardcoded colors)

The mobile app currently has ~4,618 hardcoded hex references across 224 files. They keep working — the theme module is additive and does not touch components. Migration is phased:

| Wave | Scope | Status |
|---|---|---|
| A | `src/UIComponents/` — shared primitives | ⏳ not started |
| B | Global modals (`ReviewTradeModal`, `BasketTradeModal`, `GlobalUIModals/`) | ⏳ not started |
| C | Broker + auth (`BrokerConnectionModal/`, `Authentication/`) | ⏳ not started |
| D | Home + portfolio (`HomeScreen`, `OrderScreen`, `PortfolioScreen`, `WatchlistScreen`) | ⏳ not started |
| E | Model portfolio (`ModelPortfolioComponents/`, `MPPerformanceScreen`, `MPInvestNowModal`, `MPStatusModal`) | ⏳ not started |
| F | Remaining (`Drawer/`, `Invest/`, etc.) | ⏳ not started |

Each wave: replace `StyleSheet.create` static objects with a `makeStyles(colors)` function and inline `style={{ color: '#...' }}` with `style={{ color: colors.text.primary }}`. Commit per wave. Architecture docs (`APP_ARCHITECTURE.md`, `MODEL_PORTFOLIO.md`, etc.) updated per the `CLAUDE.md` blocking requirement.

**Enforcement (post-migration):** add an ESLint rule that bans hex literals anywhere outside `src/theme/` and `src/utils/Config.js`. Until then, the theme module is opt-in per file.

---

## 5. FAQ

**Q. Does changing a color require an app rebuild?**
No. `ConfigContext` fetches on app start, so the next cold launch picks up new colors.

**Q. Can I preview colors before saving?**
Not yet from support.alphaquark.in. Install the app variant locally and edit `DEFAULT_TOKENS` in `src/theme/colors.js` for a live preview during development.

**Q. Which colors does the advisor control vs. which stay branded across advisors?**
Advisors control everything via `colorTokens`. The UX recommendation is that advisors only customise `brand.*`, `nav.*`, `basket.*`, `chart.series[]`, and optionally `text.link` + `status.info` (for brand alignment). `pnl.*` and `status.success`/`status.danger` should stay at the defaults — Indian market users read green=profit/red=loss regardless of brand.

**Q. What happens if the advisor sets an invalid hex?**
The value is stored as-is in Mongo and returned to the app. React Native ignores invalid color strings (renders transparent). The support UI includes a hex validator in `isValidColor` (exported from `src/theme/colors.js`) — add a validation check to the form if you want hard enforcement.

**Q. Where is the MongoDB document for a given advisor?**
Collection: `appadvisors`. Query: `{ subdomain: "<subdomain>" }`. The `colorTokens` field is a nested object.

**Q. Does the web app (`prod-alphaquark-github`) share this system?**
No — the web app has its own `AppConfigContext` and has not been migrated to semantic tokens yet. The backend `colorTokens` slot is shared, so when the web app adopts the same pattern it can consume the same field.
