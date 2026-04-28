# COLOR_TOKENS.md — Semantic Color Token Catalog

> Canonical list of every semantic color token the app uses. The defaults here are the source of truth and live in `src/theme/colors.js`. Advisors can override any of these via `colorTokens` in the AppAdvisor config (edited from **support.alphaquark.in**).

## Resolution order

Every color in the app resolves in this order (last wins):

1. **Default** — hardcoded in `src/theme/colors.js` (`DEFAULT_TOKENS`).
2. **Legacy branding override** — fields the backend already has (`themeColor`, `mainColor`, `secondaryColor`, `gradient1`, `gradient2`, `placeholderText`, `bottomTabbg`, `tabIconColor`, `selectedTabcolor`, `basket1`, `basket2`, `basketcolor`, `basketsymbolbg`, `EmptyStateUi`).
3. **Semantic override** — `colorTokens` nested object from `GET /api/app-advisor/get`. Partial overrides are merged deeply; unset keys keep the default.

Components never read hex values directly. They call `useColors()` and read `colors.<group>.<token>`.

## How to use in a component

```js
import { useColors } from '../theme/useColors';

const MyCard = () => {
    const colors = useColors();

    const styles = useMemo(() => StyleSheet.create({
        card: {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.default,
            borderWidth: 1,
        },
        title: { color: colors.text.primary },
        meta:  { color: colors.text.muted },
        gain:  { color: colors.pnl.profit },
    }), [colors]);

    return (...)
};
```

---

## Token catalog

### `brand` — advisor identity

Advisor-customisable brand identity. Backed by the existing branding fields; the semantic names are aliases.

| Token | Legacy field | Default | Used for |
|---|---|---|---|
| `brand.primary` | `mainColor` | `#0D021F` | Primary action color, highlight accents |
| `brand.secondary` | `secondaryColor` | `#ffffff` | Secondary UI, alt highlights |
| `brand.accent` | `themeColor` | `#ff0000` | Status accents, brand flourish |
| `brand.gradientStart` | `gradient1` | `#F0F0F0` | Hero/CTA gradient start |
| `brand.gradientEnd` | `gradient2` | `#773D9A` | Hero/CTA gradient end |
| `brand.onBrand` | — | `#ffffff` | Foreground (text/icons) placed on brand surfaces |
| `brand.placeholder` | `placeholderText` | `#B893F1` | Input placeholders on branded surfaces |

### `text` — typography colors

| Token | Default | Used for |
|---|---|---|
| `text.primary` | `#111827` | Body text, headlines |
| `text.secondary` | `#374151` | Sub-headings |
| `text.muted` | `#6B7280` | Captions, metadata, timestamps |
| `text.disabled` | `#9CA3AF` | Disabled labels/inputs |
| `text.inverse` | `#ffffff` | Text on dark surfaces |
| `text.link` | `#0056B7` | Inline links |
| `text.onBrand` | `#ffffff` | Text on brand surfaces |

### `surface` — background layers

| Token | Default | Used for |
|---|---|---|
| `surface.base` | `#ffffff` | Screen background |
| `surface.card` | `#ffffff` | Card/tile background |
| `surface.elevated` | `#ffffff` | Modals, floating elements |
| `surface.subtle` | `#F8F9FC` | Section backgrounds, list stripes |
| `surface.muted` | `#F0F0F0` | Chips, input fields |
| `surface.strong` | `#E5E7EB` | Hover/pressed states |
| `surface.inverse` | `#111827` | Dark surfaces (e.g. tooltips, snackbars) |

### `border`

| Token | Default | Used for |
|---|---|---|
| `border.default` | `#E5E7EB` | Regular dividers, card outlines |
| `border.subtle` | `#F0F0F0` | Hairline separators |
| `border.strong` | `#CCCCCC` | Emphasised borders |
| `border.focus` | `#0056B7` | Focused input outlines |

### `status` — semantic status (non-trading)

For banners, toasts, form validation. **Trading P&L uses the `pnl` group** instead.

| Token | Default | Used for |
|---|---|---|
| `status.success` | `#16A34A` | Success icon/border |
| `status.successBg` | `#DCFCE7` | Success banner background |
| `status.danger` | `#DC2626` | Error icon/border |
| `status.dangerBg` | `#FEE2E2` | Error banner background |
| `status.warning` | `#F59E0B` | Warning icon/border |
| `status.warningBg` | `#FEF3C7` | Warning banner background |
| `status.info` | `#2563EB` | Info icon/border |
| `status.infoBg` | `#DBEAFE` | Info banner background |

### `pnl` — trading profit / loss

Separate from `status` because Indian market convention (green=up/red=down) must never be overridden with brand colors.

| Token | Default | Used for |
|---|---|---|
| `pnl.profit` | `#16A34A` | Positive change, profit text |
| `pnl.profitBg` | `#DCFCE7` | Profit chip background |
| `pnl.loss` | `#DC2626` | Negative change, loss text |
| `pnl.lossBg` | `#FEE2E2` | Loss chip background |
| `pnl.neutral` | `#6B7280` | Zero-change, unknown |

### `nav` — bottom tabs / navigation

| Token | Legacy field | Default | Used for |
|---|---|---|---|
| `nav.tabBg` | `bottomTabbg` | `#242424` | Bottom tab bar background |
| `nav.tabBorder` | — | `transparent` | Tab bar top border |
| `nav.tabIcon` | `tabIconColor` | `#ffffff` | Unselected tab icon |
| `nav.tabIconActive` | `selectedTabcolor` | `#8555EF` | Selected tab icon |

### `basket` — model portfolio / basket cards

| Token | Legacy field | Default |
|---|---|---|
| `basket.start` | `basket1` | `#6A29CA` |
| `basket.end` | `basket2` | `#4F0A9E` |
| `basket.card` | `basketcolor` | `#600CC0` |
| `basket.symbolBg` | `basketsymbolbg` | `#6D0DD6` |

### `chart.series[]` — chart palette

Ordered list used for pie charts and multi-series graphs. The MPPerformanceScreen allocation pie cycles through this array.

Default first 5: `#EAE7DC, #F5F3F4, #D4ECDD, #FFDDC1, #F8E9A1` (20 values total — see `src/theme/colors.js`).

To override, provide the full array:
```json
{ "colorTokens": { "chart": { "series": ["#...", "#...", "..."] } } }
```

### `emptyState` — empty / onboarding screens

Mirrors the existing `EmptyStateUi` schema — `backgroundColor`, `darkerColor`, `mediumColor`, `brighterColor`, `mutedColor`, `lightColor`, `mediumLightShade`, `lightWarmColor`.

### `overlay` / `shadow`

| Token | Default | Used for |
|---|---|---|
| `overlay.scrim` | `rgba(0,0,0,0.4)` | Modal/sheet backdrop |
| `overlay.modal` | `rgba(0,0,0,0.5)` | Heavier backdrop for alerts |
| `overlay.light` | `rgba(0,0,0,0.1)` | Subtle hover/focus veils |
| `shadow.color` | `#000000` | Elevation shadow color |
| `shadow.subtle` | `rgba(0,0,0,0.05)` | Low elevation |
| `shadow.medium` | `rgba(0,0,0,0.15)` | Card elevation |

---

## Full advisor override shape

Every field is optional. Send only what you want to override.

```json
{
    "colorTokens": {
        "brand":       { "primary": "#0B1F4A", "accent": "#F0A41A" },
        "text":        { "primary": "#0B1F4A", "muted": "#737373" },
        "surface":     { "card": "#FFFFFF", "subtle": "#FAFAFA" },
        "border":      { "default": "#E5E5E5" },
        "status":      { "danger": "#B00020" },
        "pnl":         { "profit": "#00A86B", "loss": "#CC0000" },
        "nav":         { "tabBg": "#FFFFFF", "tabIconActive": "#0B1F4A" },
        "basket":      { "card": "#1E293B" },
        "chart":       { "series": ["#0B1F4A", "#F0A41A", "..."] },
        "emptyState":  { "backgroundColor": "#F4F4F5" },
        "overlay":     { "scrim": "rgba(11,31,74,0.5)" },
        "shadow":      { "color": "#000000", "subtle": "rgba(0,0,0,0.04)" }
    }
}
```

## Adding a new token

1. Add the default to `DEFAULT_TOKENS` in `src/theme/colors.js`.
2. Add a row to the catalog above.
3. If the token belongs to an existing group, no schema or support UI changes are required — the backend stores `colorTokens` as a `Mixed` type.
4. If you want a dedicated color picker in the support UI, add a `ColorTokenInput` row to `supportAQ/src/components/AppAdvisorConfig.jsx` under the appropriate `<details>` section.

## Adding a new group

1. Add the group to `DEFAULT_TOKENS` in `src/theme/colors.js`.
2. Document the group above.
3. Add a new `<details>` section in the support UI.

No mobile app rebuild is required when advisors change colors — `ConfigContext` re-reads on app start and the `useColors()` hook re-memoizes.
