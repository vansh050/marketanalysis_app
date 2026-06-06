/**
 * Divider — design-system primitive
 *
 * Variants:
 *   - solid  1px filled line (default)
 *   - dashed 0.5px dashed border (RN renders dashed via borderStyle, so the
 *            backing element is a bordered View instead of a filled line)
 *
 * Default vertical margin: tokens.spacing.md. Override via `style`.
 */

import React from 'react';
import { View } from 'react-native';
import useTokens from '../../../src/theme/useTokens';

const Divider = ({ variant = 'solid', style, ...rest }) => {
    const tokens = useTokens();

    if (variant === 'dashed') {
        return (
            <View
                style={[
                    {
                        borderStyle: 'dashed',
                        borderWidth: 0.5,
                        borderColor: tokens.colors.border.default,
                        backgroundColor: 'transparent',
                        marginVertical: tokens.spacing.md,
                    },
                    style,
                ]}
                {...rest}
            />
        );
    }

    return (
        <View
            style={[
                {
                    height: 1,
                    backgroundColor: tokens.colors.border.default,
                    marginVertical: tokens.spacing.md,
                },
                style,
            ]}
            {...rest}
        />
    );
};

export default Divider;
