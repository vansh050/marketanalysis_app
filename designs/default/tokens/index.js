/**
 * ============================================================================
 * designs/default/tokens — DEFAULT VARIANT TOKEN BUNDLE
 * ============================================================================
 *
 * Re-exports the canonical token implementations from `src/theme/`. The
 * implementations live in `src/theme/` because they integrate with
 * `ConfigContext` (advisor-overridable colorTokens, future spacing/typography/
 * radii/shadow tokens). This folder is the registry-facing surface — when the
 * `DesignProvider` (Phase B) resolves the default variant's tokens, it imports
 * from here.
 *
 * To create a custom variant: add `designs/<variant>/tokens/index.js` that
 * exports the same shape (`DEFAULT_*` objects + `build*()` builders) with
 * variant-specific values. The DesignProvider will merge the variant's
 * tokens over default's at mount.
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Tokens and § Registry.
 * ============================================================================
 */

export {
    DEFAULT_TOKENS as DEFAULT_COLORS,
    buildColors,
    isValidColor,
} from '../../../src/theme/colors';

export { DEFAULT_SPACING, buildSpacing } from '../../../src/theme/spacing';
export { DEFAULT_TYPOGRAPHY, buildTypography } from '../../../src/theme/typography';
export { DEFAULT_RADII, buildRadii } from '../../../src/theme/radii';
export { DEFAULT_SHADOWS, buildShadows } from '../../../src/theme/shadows';
export { DEFAULT_ASSETS, buildAssets } from '../../../src/theme/assets';
