import { useContext, useMemo } from 'react';
import { useConfig } from '../context/ConfigContext';
import { DesignContext } from '../design/DesignProvider';
import { buildColors } from './colors';
import { buildSpacing } from './spacing';
import { buildTypography } from './typography';
import { buildRadii } from './radii';
import { buildShadows } from './shadows';
import { buildAssets } from './assets';

/**
 * Hook that returns the full resolved design-token bundle for the current
 * advisor: colors + spacing + typography + radii + shadows. Memoized on the
 * config value and active variant builders so a config or design change
 * rebuilds the complete bundle atomically.
 *
 * Usage:
 *   const tokens = useTokens();
 *   <View style={{
 *     padding: tokens.spacing.lg,
 *     borderRadius: tokens.radii.md,
 *     backgroundColor: tokens.colors.surface.card,
 *     ...tokens.shadows.card,
 *   }}>
 *     <Text style={[tokens.typography.title, { color: tokens.colors.text.primary }]}>
 *       Hello
 *     </Text>
 *   </View>
 *
 * Existing `useColors()` continues to work unchanged for components that only
 * need colors. New components SHOULD prefer `useTokens()` so they're ready for
 * the design-system migration's primitive layer.
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Tokens.
 */
export const useTokens = () => {
    const config = useConfig();
    // Resolve every token family through the active design variant. useContext
    // (not useDesign) keeps this hook safe outside DesignProvider and lets each
    // family fall back independently when a variant only overrides a subset.
    // This is the runtime half of the designs/<variant>/tokens contract: a
    // variant's spacing/typography/radii/shadows must be just as effective as
    // its colors and static assets.
    const design = useContext(DesignContext);
    const buildVariantAssets = design?.tokens?.buildAssets || buildAssets;
    // Variant-aware color builder. Default variant re-exports src/theme/colors,
    // so `design.tokens.buildColors` is functionally the same as the local
    // `buildColors` for default. A custom variant (moneyman_app, etc.) exports
    // its own builder with hard-coded brand defaults, so its color palette
    // persists even when `src/` is copied over from Alphab2bapp.
    const buildVariantColors = design?.tokens?.buildColors || buildColors;
    const buildVariantSpacing = design?.tokens?.buildSpacing || buildSpacing;
    const buildVariantTypography =
        design?.tokens?.buildTypography || buildTypography;
    const buildVariantRadii = design?.tokens?.buildRadii || buildRadii;
    const buildVariantShadows = design?.tokens?.buildShadows || buildShadows;

    return useMemo(
        () => {
            const resolvedConfig = config || {};
            return {
                colors: buildVariantColors(resolvedConfig),
                spacing: buildVariantSpacing(resolvedConfig),
                typography: buildVariantTypography(resolvedConfig),
                radii: buildVariantRadii(resolvedConfig),
                shadows: buildVariantShadows(resolvedConfig),
                assets: buildVariantAssets(resolvedConfig),
            };
        },
        [
            config,
            buildVariantAssets,
            buildVariantColors,
            buildVariantSpacing,
            buildVariantTypography,
            buildVariantRadii,
            buildVariantShadows,
        ]
    );
};

export default useTokens;
