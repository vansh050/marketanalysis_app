/**
 * Card — design-system primitive
 *
 * Variants:
 *   - default  card surface + soft card shadow
 *   - elevated card surface + elevated shadow
 *   - outlined card surface + 1px border, no shadow
 *
 * Default padding is `tokens.spacing.lg`; pass `style={{ padding: 0 }}` for
 * full-bleed children. Default radius is `tokens.radii.lg`.
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import useTokens from '../../../src/theme/useTokens';

const Card = ({ variant = 'default', style, children, ...rest }) => {
    const tokens = useTokens();

    const variantStyle = useMemo(() => {
        const base = { backgroundColor: tokens.colors.surface.card };
        switch (variant) {
            case 'elevated':
                return { ...base, ...tokens.shadows.elevated };
            case 'outlined':
                return {
                    ...base,
                    borderWidth: 1,
                    borderColor: tokens.colors.border.default,
                };
            case 'default':
            default:
                return { ...base, ...tokens.shadows.card };
        }
    }, [tokens, variant]);

    return (
        <View
            style={[
                {
                    padding: tokens.spacing.lg,
                    borderRadius: tokens.radii.lg,
                },
                variantStyle,
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
};

export default Card;
