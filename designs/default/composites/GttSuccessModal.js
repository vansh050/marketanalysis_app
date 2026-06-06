/**
 * GttSuccessModal — design-system composite (Phase H, 2026-05-02)
 *
 * Pure presentation for GTT order placement success/failure display.
 * Uses ModalShell (centered variant) for the modal wrapper.
 *
 * Contract:
 *   viewModel = {
 *     visible, isError, isGTTOrder,
 *     title, subtitle,
 *     symbol, currentPrice, triggerValues, gttId, status,
 *     placedDate,
 *   }
 *   actions = { onClose }
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';
import ModalShell from '../primitives/ModalShell';
import Text from '../primitives/Text';

const GttSuccessModal = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        visible = false,
        isError = false,
        isGTTOrder = false,
        title = '',
        subtitle = '',
        symbol,
        currentPrice,
        triggerValues,
        gttId,
        status,
        placedDate,
    } = viewModel || {};
    const { onClose = () => {} } = actions || {};

    return (
        <ModalShell visible={visible} onClose={onClose} variant="centered">
            {/* Header row */}
            <View style={styles.headerRow}>
                {isError ? (
                    <XCircle size={40} color={tokens.colors.feedback.error || '#DC2626'} />
                ) : (
                    <CheckCircle size={40} color={tokens.colors.feedback.success || '#16A34A'} />
                )}
                <View style={styles.headerText}>
                    <Text
                        variant="title"
                        style={{
                            fontSize: 17,
                            fontWeight: '600',
                            marginBottom: 6,
                            color: isError
                                ? tokens.colors.feedback.error || '#DC2626'
                                : tokens.colors.text.primary,
                        }}
                    >
                        {title}
                    </Text>
                    <Text
                        variant="body"
                        style={{
                            fontSize: 13,
                            color: tokens.colors.text.muted,
                            lineHeight: 18,
                        }}
                    >
                        {subtitle}
                    </Text>
                </View>
            </View>

            {/* GTT Details box */}
            {isGTTOrder && (
                <View
                    style={[
                        styles.gttBox,
                        {
                            backgroundColor: isError
                                ? tokens.colors.feedback.errorBg || '#FEF2F2'
                                : '#EFF6FF',
                            borderColor: isError
                                ? '#FECACA'
                                : '#BFDBFE',
                        },
                    ]}
                >
                    <View style={styles.gttBoxHeader}>
                        {isError ? (
                            <XCircle size={18} color={tokens.colors.feedback.error || '#DC2626'} />
                        ) : (
                            <AlertCircle size={18} color="#2563EB" />
                        )}
                        <Text
                            variant="body"
                            style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: isError ? '#991B1B' : '#1E40AF',
                            }}
                        >
                            GTT Order Details
                        </Text>
                    </View>

                    {symbol && (
                        <View style={styles.gttDetail}>
                            <Text style={styles.gttLabel}>Symbol:</Text>
                            <Text style={styles.gttValue}>{symbol}</Text>
                        </View>
                    )}

                    {currentPrice && (
                        <View style={styles.gttDetail}>
                            <Text style={styles.gttLabel}>Current Price:</Text>
                            <Text style={styles.gttValue}>{'₹'}{currentPrice}</Text>
                        </View>
                    )}

                    {triggerValues && triggerValues.length > 0 && (
                        <View style={styles.gttDetail}>
                            <Text style={styles.gttLabel}>Trigger Prices:</Text>
                            <View style={styles.triggerRow}>
                                {triggerValues.map((price, index) => (
                                    <View
                                        key={index}
                                        style={[
                                            styles.triggerBadge,
                                            {
                                                backgroundColor: isError
                                                    ? tokens.colors.feedback.errorBg || '#FEE2E2'
                                                    : '#DBEAFE',
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 13,
                                                fontWeight: '600',
                                                color: isError
                                                    ? tokens.colors.feedback.error || '#DC2626'
                                                    : '#2563EB',
                                            }}
                                        >
                                            {'₹'}{price}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {gttId && (
                        <View style={styles.gttDetail}>
                            <Text style={styles.gttLabel}>GTT ID:</Text>
                            <Text style={styles.gttValue}>{gttId}</Text>
                        </View>
                    )}

                    {status !== undefined && (
                        <View style={styles.gttDetail}>
                            <Text style={styles.gttLabel}>Status:</Text>
                            <Text style={styles.gttValue}>{status}</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Footer */}
            {placedDate && (
                <View style={styles.footer}>
                    <Text
                        variant="caption"
                        style={{ fontSize: 12, color: tokens.colors.text.muted }}
                    >
                        Placed On: {placedDate}
                    </Text>
                </View>
            )}
        </ModalShell>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
        paddingRight: 24,
    },
    headerText: { flex: 1 },
    gttBox: {
        borderWidth: 1,
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
    },
    gttBoxHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    gttDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
        flexWrap: 'wrap',
    },
    gttLabel: { fontSize: 13, color: '#374151', fontWeight: '500' },
    gttValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
    triggerRow: { flexDirection: 'row', gap: 6 },
    triggerBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    footer: { alignItems: 'center', paddingTop: 8 },
});

export default GttSuccessModal;
