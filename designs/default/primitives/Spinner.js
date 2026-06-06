/**
 * Spinner — design-system primitive
 *
 * Variants:
 *   - inline  bare ActivityIndicator (caller controls layout)
 *   - overlay full-screen scrim + centered ActivityIndicator (use for blocking
 *             loading states; e.g. login submit, payment in flight)
 *
 * `size` and `color` accept RN ActivityIndicator values; defaults pull from
 * tokens (size 'small' / 'large', color brand.primary).
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import useTokens from '../../../src/theme/useTokens';

const Spinner = ({ variant = 'inline', size, color, style, ...rest }) => {
    const tokens = useTokens();
    const resolvedColor = color || tokens.colors.brand.primary;

    if (variant === 'overlay') {
        const resolvedSize = size || 'large';
        return (
            <View
                style={[
                    StyleSheet.absoluteFillObject,
                    {
                        backgroundColor: tokens.colors.overlay.scrim,
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                    style,
                ]}
            >
                <ActivityIndicator size={resolvedSize} color={resolvedColor} {...rest} />
            </View>
        );
    }

    return (
        <ActivityIndicator
            size={size || 'small'}
            color={resolvedColor}
            style={style}
            {...rest}
        />
    );
};

export default Spinner;
