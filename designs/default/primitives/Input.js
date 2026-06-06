/**
 * Input — design-system primitive
 *
 * Variants:
 *   - text     default text input
 *   - password secureTextEntry on
 *   - numeric  numeric keyboard
 *   - otp      numeric keyboard, maxLength 6, no autocorrect
 *
 * Standard RN TextInput props passthrough (`value`, `onChangeText`,
 * `placeholder`, `autoFocus`, etc.). `style` merges over the variant's style.
 */

import React from 'react';
import { TextInput } from 'react-native';
import useTokens from '../../../src/theme/useTokens';

const Input = ({
    variant = 'text',
    value,
    onChangeText,
    placeholder,
    placeholderTextColor,
    style,
    ...rest
}) => {
    const tokens = useTokens();

    const isPassword = variant === 'password';
    const isNumeric = variant === 'numeric' || variant === 'otp';
    const isOtp = variant === 'otp';

    return (
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor || tokens.colors.text.muted}
            secureTextEntry={isPassword}
            keyboardType={isNumeric ? 'numeric' : 'default'}
            maxLength={isOtp ? 6 : undefined}
            autoCorrect={!isOtp}
            autoCapitalize={isOtp || isPassword ? 'none' : 'sentences'}
            style={[
                tokens.typography.body,
                {
                    color: tokens.colors.text.primary,
                    backgroundColor: tokens.colors.surface.subtle,
                    borderWidth: 1,
                    borderColor: tokens.colors.border.default,
                    borderRadius: tokens.radii.md,
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.sm,
                },
                style,
            ]}
            {...rest}
        />
    );
};

export default Input;
