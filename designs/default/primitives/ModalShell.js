/**
 * ModalShell — design-system primitive (Phase H, 2026-05-02)
 *
 * Reusable modal wrapper with three layout variants:
 *
 *   - `bottomSheet`  — slides up from the bottom with borderTopRadius,
 *                       85% maxHeight. Default variant.
 *   - `fullScreen`   — covers the full screen.
 *   - `centered`     — centered dialog with backdrop, 85% maxHeight.
 *
 * Props:
 *   visible   (bool)    — controls Modal visibility
 *   onClose   (func)    — called on backdrop press + Android back button
 *   variant   (string)  — 'bottomSheet' | 'fullScreen' | 'centered'
 *   title     (string?) — optional header title (rendered with close icon)
 *   children  (node)    — modal body
 *   style     (object?) — override styles on the inner content container
 *
 * Primitive usage:
 *   - Text primitive for the optional title
 *   - Icon primitive for the close "X"
 *   - All colors/spacing/radii/shadows from tokens
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Primitives.
 */

import React, { useMemo } from 'react';
import {
    Modal,
    View,
    TouchableWithoutFeedback,
    StyleSheet,
    SafeAreaView,
} from 'react-native';
import { X } from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';
import Text from './Text';
import Icon from './Icon';

const ModalShell = ({
    visible = false,
    onClose,
    variant = 'bottomSheet',
    title,
    children,
    style,
}) => {
    const tokens = useTokens();

    const animationType = variant === 'centered' ? 'fade' : 'slide';

    const overlayStyle = useMemo(() => {
        const base = {
            flex: 1,
            backgroundColor: tokens.colors.overlay.modal,
        };
        switch (variant) {
            case 'fullScreen':
                return base;
            case 'centered':
                return {
                    ...base,
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: tokens.spacing.lg,
                };
            case 'bottomSheet':
            default:
                return {
                    ...base,
                    justifyContent: 'flex-end',
                };
        }
    }, [tokens, variant]);

    const contentStyle = useMemo(() => {
        const base = {
            backgroundColor: tokens.colors.surface.card,
            padding: tokens.spacing.lg,
            ...tokens.shadows.modal,
        };
        switch (variant) {
            case 'fullScreen':
                return {
                    ...base,
                    flex: 1,
                };
            case 'centered':
                return {
                    ...base,
                    width: '100%',
                    maxHeight: '85%',
                    borderRadius: tokens.radii.lg,
                };
            case 'bottomSheet':
            default:
                return {
                    ...base,
                    maxHeight: '85%',
                    borderTopLeftRadius: tokens.radii.xl,
                    borderTopRightRadius: tokens.radii.xl,
                };
        }
    }, [tokens, variant]);

    const renderHeader = () => {
        if (!title && !onClose) return null;
        return (
            <View style={headerStyles.row}>
                {title ? (
                    <Text
                        variant="title"
                        style={{
                            flex: 1,
                            color: tokens.colors.text.primary,
                            fontWeight: '700',
                        }}
                    >
                        {title}
                    </Text>
                ) : (
                    <View style={{ flex: 1 }} />
                )}
                {onClose && (
                    <Icon
                        Component={X}
                        size={22}
                        color={tokens.colors.text.secondary}
                        onPress={onClose}
                    />
                )}
            </View>
        );
    };

    // For bottomSheet and centered, tapping the backdrop closes the modal.
    // For fullScreen, no backdrop tap — user must use the close button.
    const wrapWithBackdrop = (content) => {
        if (variant === 'fullScreen') return content;
        return (
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={overlayStyle}>
                    <TouchableWithoutFeedback>
                        {content}
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType={animationType}
            onRequestClose={onClose}
        >
            {variant === 'fullScreen' ? (
                <SafeAreaView style={[overlayStyle, { backgroundColor: tokens.colors.surface.card }]}>
                    <View style={[contentStyle, style]}>
                        {renderHeader()}
                        {children}
                    </View>
                </SafeAreaView>
            ) : (
                wrapWithBackdrop(
                    <View style={[contentStyle, style]}>
                        {renderHeader()}
                        {children}
                    </View>
                )
            )}
        </Modal>
    );
};

const headerStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
});

export default ModalShell;
