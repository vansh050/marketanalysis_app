/**
 * DeleteAdviceModal — design-system composite (Phase H, 2026-05-02)
 *
 * Pure presentation for the delete-advice confirmation dialog.
 * Uses ModalShell (bottomSheet variant) for the modal wrapper.
 *
 * Contract:
 *   viewModel = { visible, stockName }
 *   actions   = { onConfirm, onClose }
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import useTokens from '../../../src/theme/useTokens';
import ModalShell from '../primitives/ModalShell';
import Text from '../primitives/Text';
import Button from '../primitives/Button';

const DeleteAdviceModal = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const { visible = false, stockName = '' } = viewModel || {};
    const { onConfirm = () => {}, onClose = () => {} } = actions || {};

    return (
        <ModalShell visible={visible} onClose={onClose} variant="bottomSheet">
            {/* Drag indicator */}
            <View
                style={[
                    styles.indicator,
                    { backgroundColor: tokens.colors.border.default },
                ]}
            />

            <Text
                variant="title"
                style={{
                    fontSize: 18,
                    fontWeight: '600',
                    textAlign: 'center',
                    marginBottom: tokens.spacing.xl,
                    color: tokens.colors.text.primary,
                }}
            >
                {`Are you sure you want to delete ${stockName}?`}
            </Text>

            <Button
                variant="primary"
                label="Delete"
                onPress={onConfirm}
                style={{
                    backgroundColor: tokens.colors.feedback.error,
                    borderRadius: tokens.radii.sm,
                    paddingVertical: tokens.spacing.md,
                    paddingHorizontal: tokens.spacing.xl,
                    width: '100%',
                    alignItems: 'center',
                    marginTop: tokens.spacing.lg,
                }}
                labelStyle={{
                    color: tokens.colors.text.inverse,
                    fontSize: 16,
                    fontWeight: '600',
                }}
            />
        </ModalShell>
    );
};

const styles = StyleSheet.create({
    indicator: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        marginBottom: 15,
        alignSelf: 'center',
    },
});

export default DeleteAdviceModal;
