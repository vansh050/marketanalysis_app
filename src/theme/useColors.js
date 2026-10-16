import { useContext, useMemo } from 'react';
import { useConfig } from '../context/ConfigContext';
import { DesignContext } from '../design/DesignProvider';
import { buildColors } from './colors';

/**
 * Hook that returns the resolved semantic color palette for the current
 * advisor. Memoized on the relevant config fields so components re-render
 * only when colors actually change.
 *
 * Colors resolve through the active design variant's `tokens.buildColors`
 * (same rule as `useTokens()`): the default design re-exports
 * `src/theme/colors`, so nothing changes there, while a variant that owns its
 * palette (e.g. Kyzen, which ignores the web `mainColor`) keeps it on shared
 * host surfaces that read `useColors()`.
 *
 * Usage:
 *   const colors = useColors();
 *   <Text style={{ color: colors.text.primary }}>Hello</Text>
 */
export const useColors = () => {
    const config = useConfig() || {};
    const design = useContext(DesignContext);
    const buildVariantColors = design?.tokens?.buildColors || buildColors;

    return useMemo(() => buildVariantColors(config), [
        buildVariantColors,
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
    ]);
};

export default useColors;
