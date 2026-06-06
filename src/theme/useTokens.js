import { useMemo } from 'react';
import { useConfig } from '../context/ConfigContext';
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

    return useMemo(
        () => ({
            colors: buildColors(config),
            spacing: buildSpacing(config),
            typography: buildTypography(config),
            radii: buildRadii(config),
            shadows: buildShadows(config),
            assets: buildAssets(config),
        }),
        [
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
