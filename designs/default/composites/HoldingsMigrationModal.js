/**
 * HoldingsMigrationModal — design-system composite (Phase H, 2026-05-02)
 *
 * Pure presentation for the holdings-migration bottom sheet.
 * Uses ModalShell (bottomSheet variant) for the modal wrapper.
 *
 * Contract:
 *   viewModel = {
 *     visible, newBroker, loading, submitting,
 *     isReconnection, models: [{ model_name, holdingsCount, primaryBroker, totalValue, hasExistingNewBrokerRecord }],
 *     selections: { [model_name]: 'migrate' | 'empty' },
 *     subtitle,
 *   }
 *   actions = {
 *     onClose, onSubmit,
 *     onSelectMigrate(modelName), onSelectEmpty(modelName),
 *   }
 */

import React from 'react';
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import useTokens from '../../../src/theme/useTokens';
import ModalShell from '../primitives/ModalShell';
import Text from '../primitives/Text';
import Button from '../primitives/Button';

const HoldingsMigrationModal = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        visible = false,
        newBroker = '',
        loading = false,
        submitting = false,
        isReconnection = false,
        models = [],
        selections = {},
        subtitle = '',
    } = viewModel || {};
    const {
        onClose = () => {},
        onSubmit = () => {},
        onSelectMigrate = () => {},
        onSelectEmpty = () => {},
    } = actions || {};

    const title = isReconnection
        ? `Reconnected to ${newBroker}`
        : `Switch to ${newBroker}`;

    const renderContent = () => {
        if (loading) {
            return (
                <View style={styles.center}>
                    <ActivityIndicator
                        size="large"
                        color={tokens.colors.brand.gradientEnd || '#2563EB'}
                    />
                    <Text
                        variant="body"
                        style={{
                            marginTop: tokens.spacing.md,
                            color: tokens.colors.text.muted,
                            fontSize: 14,
                        }}
                    >
                        Checking your portfolios...
                    </Text>
                </View>
            );
        }

        if (isReconnection) {
            return (
                <View style={styles.center}>
                    <Text
                        variant="body"
                        style={{
                            fontSize: 14,
                            color: tokens.colors.text.primary,
                            textAlign: 'center',
                            marginBottom: tokens.spacing.xl,
                            lineHeight: 22,
                        }}
                    >
                        Your holdings are already set up for {newBroker}. You're good to go!
                    </Text>
                    <Button
                        variant="primary"
                        label="Continue"
                        onPress={onClose}
                        style={[
                            styles.primaryBtn,
                            { backgroundColor: tokens.colors.brand.gradientEnd || '#2563EB' },
                        ]}
                        labelStyle={styles.primaryBtnText}
                    />
                </View>
            );
        }

        if (models.length === 0) {
            return (
                <View style={styles.center}>
                    <Text
                        variant="body"
                        style={{
                            fontSize: 14,
                            color: tokens.colors.text.primary,
                            textAlign: 'center',
                            marginBottom: tokens.spacing.xl,
                            lineHeight: 22,
                        }}
                    >
                        No portfolios to migrate.
                    </Text>
                    <Button
                        variant="primary"
                        label="Continue"
                        onPress={onClose}
                        style={[
                            styles.primaryBtn,
                            { backgroundColor: tokens.colors.brand.gradientEnd || '#2563EB' },
                        ]}
                        labelStyle={styles.primaryBtnText}
                    />
                </View>
            );
        }

        return (
            <>
                <Text
                    variant="body"
                    style={{
                        fontSize: 13,
                        color: tokens.colors.text.muted,
                        marginBottom: tokens.spacing.lg,
                        lineHeight: 20,
                    }}
                >
                    {subtitle ||
                        'You have model portfolio holdings from a previous broker. Choose what to do for each portfolio:'}
                </Text>

                <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                    {models.map((model) => (
                        <View
                            key={model.model_name}
                            style={[
                                styles.modelCard,
                                { borderColor: tokens.colors.border.default },
                            ]}
                        >
                            <Text
                                variant="body"
                                style={{
                                    fontSize: 14,
                                    fontWeight: '600',
                                    color: tokens.colors.text.primary,
                                    marginBottom: 2,
                                }}
                            >
                                {model.model_name}
                            </Text>
                            <Text
                                variant="caption"
                                style={{
                                    fontSize: 12,
                                    color: tokens.colors.text.muted,
                                    marginBottom: tokens.spacing.sm,
                                }}
                            >
                                {model.holdingsCount} stock{model.holdingsCount !== 1 ? 's' : ''}
                                {model.primaryBroker ? ` · from ${model.primaryBroker}` : ''}
                                {model.totalValue > 0
                                    ? ` · ₹${model.totalValue.toLocaleString('en-IN')}`
                                    : ''}
                            </Text>
                            <View style={styles.optionRow}>
                                <Button
                                    variant={selections[model.model_name] === 'migrate' ? 'primary' : 'secondary'}
                                    label="Carry Forward"
                                    onPress={() => onSelectMigrate(model.model_name)}
                                    style={[
                                        styles.optionBtn,
                                        selections[model.model_name] === 'migrate'
                                            ? {
                                                  borderColor: tokens.colors.brand.gradientEnd || '#2563EB',
                                                  backgroundColor: '#EFF6FF',
                                              }
                                            : {
                                                  borderColor: tokens.colors.border.default,
                                                  backgroundColor: 'transparent',
                                              },
                                    ]}
                                    labelStyle={{
                                        fontSize: 13,
                                        color:
                                            selections[model.model_name] === 'migrate'
                                                ? tokens.colors.brand.gradientEnd || '#2563EB'
                                                : tokens.colors.text.primary,
                                        fontWeight:
                                            selections[model.model_name] === 'migrate' ? '600' : '400',
                                    }}
                                />
                                <Button
                                    variant={selections[model.model_name] === 'empty' ? 'primary' : 'secondary'}
                                    label="Start Fresh"
                                    onPress={() => onSelectEmpty(model.model_name)}
                                    style={[
                                        styles.optionBtn,
                                        selections[model.model_name] === 'empty'
                                            ? {
                                                  borderColor: tokens.colors.brand.gradientEnd || '#2563EB',
                                                  backgroundColor: '#EFF6FF',
                                              }
                                            : {
                                                  borderColor: tokens.colors.border.default,
                                                  backgroundColor: 'transparent',
                                              },
                                    ]}
                                    labelStyle={{
                                        fontSize: 13,
                                        color:
                                            selections[model.model_name] === 'empty'
                                                ? tokens.colors.brand.gradientEnd || '#2563EB'
                                                : tokens.colors.text.primary,
                                        fontWeight:
                                            selections[model.model_name] === 'empty' ? '600' : '400',
                                    }}
                                />
                            </View>
                        </View>
                    ))}
                </ScrollView>

                <Button
                    variant="primary"
                    label={submitting ? '' : 'Confirm & Continue'}
                    onPress={onSubmit}
                    disabled={submitting}
                    style={[
                        styles.primaryBtn,
                        {
                            backgroundColor: tokens.colors.brand.gradientEnd || '#2563EB',
                            marginTop: tokens.spacing.lg,
                        },
                        submitting && { opacity: 0.6 },
                    ]}
                    labelStyle={styles.primaryBtnText}
                >
                    {submitting && <ActivityIndicator color="#fff" />}
                </Button>
            </>
        );
    };

    return (
        <ModalShell visible={visible} onClose={onClose} variant="bottomSheet" title={title}>
            {renderContent()}
        </ModalShell>
    );
};

const styles = StyleSheet.create({
    center: { alignItems: 'center', paddingVertical: 24 },
    list: { maxHeight: 320 },
    modelCard: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
    },
    optionRow: { flexDirection: 'row', gap: 8 },
    optionBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
    },
    primaryBtn: {
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});

export default HoldingsMigrationModal;
