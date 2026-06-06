/**
 * Button — design-system primitive
 *
 * Variants:
 *   - primary     CTA — brand colour bg + inverse text
 *   - secondary   muted bg + primary text
 *   - ghost       transparent bg + brand text (no fill)
 *   - destructive danger bg + inverse text
 *
 * Props:
 *   - label              string content (preferred over children for consistent typography)
 *   - children           if supplied, rendered as-is — caller owns layout
 *   - onPress, disabled  RN-standard
 *   - variant            see above
 *   - style              merged AFTER variant (caller wins)
 *   - labelStyle         merged AFTER variant text style (caller wins)
 *   - ...rest            passed to TouchableOpacity (accessibility, testID, etc.)
 *
 * Token reads via useTokens(); never reads colour hex directly.
 */

import React, { useMemo } from 'react';
import { TouchableOpacity } from 'react-native';
import useTokens from '../../../src/theme/useTokens';
import Text from './Text';

const buildVariantStyles = (tokens) => ({
    primary: {
        bg: tokens.colors.brand.primary,
        fg: tokens.colors.text.inverse,
    },
    secondary: {
        bg: tokens.colors.surface.muted,
        fg: tokens.colors.text.primary,
    },
    ghost: {
        bg: 'transparent',
        fg: tokens.colors.brand.primary,
    },
    destructive: {
        bg: tokens.colors.status.danger,
        fg: tokens.colors.text.inverse,
    },
});

const Button = ({
    variant = 'primary',
    label,
    children,
    onPress,
    disabled = false,
    style,
    labelStyle,
    ...rest
}) => {
    const tokens = useTokens();
    const variants = useMemo(() => buildVariantStyles(tokens), [tokens]);
    const v = variants[variant] || variants.primary;
    const bg = disabled ? tokens.colors.text.disabled : v.bg;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            style={[
                {
                    backgroundColor: bg,
                    paddingVertical: tokens.spacing.md,
                    paddingHorizontal: tokens.spacing.lg,
                    borderRadius: tokens.radii.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                style,
            ]}
            {...rest}
        >
            {children != null ? (
                children
            ) : (
                <Text variant="button" style={[{ color: v.fg }, labelStyle]}>
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
};

export default Button;
