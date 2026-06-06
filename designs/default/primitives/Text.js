/**
 * Text — design-system primitive
 *
 * Wraps RN <Text> with a typography-token variant.
 *
 * Variants: heading | title | subtitle | body | bodyEmphasis | caption | muted
 * (defaults: body)
 *
 * The `style` prop wins over the variant style — pass `{ color, fontSize, ... }`
 * to override anything the variant set.
 *
 * Token reads via useTokens(); colour stays caller-controlled (text colour is
 * not part of the typography role — pass `style={{ color: tokens.colors... }}`).
 */

import React from 'react';
import { Text as RNText } from 'react-native';
import useTokens from '../../../src/theme/useTokens';

const Text = ({ variant = 'body', style, children, ...rest }) => {
    const tokens = useTokens();
    const variantStyle = tokens.typography[variant] || tokens.typography.body;
    return (
        <RNText style={[variantStyle, style]} {...rest}>
            {children}
        </RNText>
    );
};

export default Text;
