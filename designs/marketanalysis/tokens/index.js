/**
 * ============================================================================
 * designs/marketanalysis/tokens — VARIANT TOKEN BUNDLE
 * ============================================================================
 *
 * Re-exports the upstream default token bundle (colors / spacing / typography
 * / radii / shadows), then overrides the asset slot with marketanalysis-brand
 * binaries served out of `designs/marketanalysis/assets/`.
 *
 * To override another token family (e.g. a brand color):
 *   1. Create `designs/marketanalysis/tokens/<family>.js` exporting
 *      `DEFAULT_<FAMILY>` and `build<Family>` with the variant values.
 *   2. Replace the corresponding `export ... from '../../default/tokens'`
 *      line below with the local re-export.
 *
 * See `docs/DESIGN_SYSTEM_ARCHITECTURE.md` § Tokens and
 * `docs/WHITELABEL_RECIPE.md` § "Variant tokens".
 * ============================================================================
 */

// Color, spacing, typography, radii, shadow tokens flow through to upstream
// default. Brand colors are still surfaced from `Config` (per-variant
// themeColor / mainColor etc.) via ConfigContext until/unless a variant
// elects to override the token implementation.
export {
    DEFAULT_COLORS,
    buildColors,
    isValidColor,
    DEFAULT_SPACING,
    buildSpacing,
    DEFAULT_TYPOGRAPHY,
    buildTypography,
    DEFAULT_RADII,
    buildRadii,
    DEFAULT_SHADOWS,
    buildShadows,
} from '../../default/tokens';

// Asset token override — marketanalysis brand logo.
export { DEFAULT_ASSETS, buildAssets } from './assets';
