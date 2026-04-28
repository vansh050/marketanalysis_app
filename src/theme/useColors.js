import { useMemo } from 'react';
import { useConfig } from '../context/ConfigContext';
import { buildColors } from './colors';

/**
 * Hook that returns the resolved semantic color palette for the current
 * advisor. Memoized on the relevant config fields so components re-render
 * only when colors actually change.
 *
 * Usage:
 *   const colors = useColors();
 *   <Text style={{ color: colors.text.primary }}>Hello</Text>
 */
export const useColors = () => {
    const config = useConfig() || {};

    return useMemo(() => buildColors(config), [
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
