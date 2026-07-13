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
 * relevant config fields so components re-render only when tokens actually
 * change.
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
    const config = useConfig() || {};
    // Variant-aware asset slot. RN's static require(...) can't be swapped by a
    // backend config field, so per-variant brand images (logoPng/logoFadedPng)
    // are resolved through the DesignProvider's variant token module instead.
    // useContext (not useDesign) so this stays safe if ever called outside the
    // provider — it falls back to the default-variant assets. Other token
    // families (colors/typography/…) already vary per-tenant via ConfigContext
    // legacy-branding, so only `assets` needs the variant builder here.
    const design = useContext(DesignContext);
    const buildVariantAssets = design?.tokens?.buildAssets || buildAssets;
    // Variant-aware color builder. Default variant re-exports src/theme/colors,
    // so `design.tokens.buildColors` is functionally the same as the local
    // `buildColors` for default. A custom variant (moneyman_app, etc.) exports
    // its own builder with hard-coded brand defaults, so its color palette
    // persists even when `src/` is copied over from Alphab2bapp.
    const buildVariantColors = design?.tokens?.buildColors || buildColors;

    return useMemo(
        () => ({
            colors: buildVariantColors(config),
            spacing: buildSpacing(config),
            typography: buildTypography(config),
            radii: buildRadii(config),
            shadows: buildShadows(config),
            assets: buildVariantAssets(config),
        }),
        [
            buildVariantAssets,
            buildVariantColors,
            // Colors deps (mirror useColors.js)
            config.mainColor,
            config.secondaryColor,
            config.themeColor,
            config.gradient1,
            config.gradient2,
            config.placeholderText,
            config.bottomTabbg,
            config.tabIconColor,
            config.selectedTabcolor,
            config.basket1,
            config.basket2,
            config.basketcolor,
            config.basketsymbolbg,
            config.EmptyStateUi,
            config.colorTokens,
            // Future backend-override deps (no-op until ConfigContext exposes
            // these fields). Listed here so the memoization is correct the
            // moment they land.
            config.spacingTokens,
            config.typographyTokens,
            config.radiiTokens,
            config.shadowTokens,
            config.assetTokens,
        ]
    );
};

export default useTokens;
