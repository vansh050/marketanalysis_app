/**
 * GttDetailsModal — design-system composite (Phase H, 2026-05-02)
 *
 * Pure presentation for GTT order details display.
 * Uses ModalShell (centered variant) for the modal wrapper.
 *
 * Contract:
 *   viewModel = {
 *     visible, tradingSymbol, transaction, isBuy,
 *     exchange, segment, orderType, quantity,
 *     entryLeg, leg1 (stopLoss), leg2 (target)
 *   }
 *   actions = { onClose }
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';
import ModalShell from '../primitives/ModalShell';
import Text from '../primitives/Text';

const Field = ({ label, value, tokens }) => (
    <View style={styles.field}>
        <Text
            variant="caption"
            style={{ fontSize: 11, color: tokens.colors.text.muted, marginBottom: 2 }}
        >
            {label}
        </Text>
        <Text
            variant="body"
            style={{ fontSize: 14, fontWeight: '500', color: tokens.colors.text.primary }}
        >
            {value || '-'}
        </Text>
    </View>
);

const GttLeg = ({ title, leg, tokens }) => {
    if (!leg) return null;
    return (
        <View
            style={[
                styles.legContainer,
                { borderColor: tokens.colors.border.default },
            ]}
        >
            <View
                style={[
                    styles.legHeader,
                    {
                        backgroundColor: tokens.colors.surface.subtle,
                        borderBottomColor: tokens.colors.border.default,
                    },
                ]}
            >
                <Text
                    variant="caption"
                    style={{ fontSize: 12, fontWeight: '600', color: tokens.colors.text.primary }}
                >
                    {title}
                </Text>
            </View>
            <View style={styles.legBody}>
                <Field label="Type" value={leg?.Type} tokens={tokens} />
                <Field label="Order Type" value={leg?.OrderType} tokens={tokens} />
                <Field
                    label="Price"
                    value={leg?.Price ? `₹${leg.Price}` : '-'}
                    tokens={tokens}
                />
                <Field
                    label="Trigger Price"
                    value={leg?.triggerPrice ? `₹${leg.triggerPrice}` : '-'}
                    tokens={tokens}
                />
            </View>
        </View>
    );
};

const GttDetailsModal = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        visible = false,
        tradingSymbol = '-',
        transaction,
        isBuy,
        exchange,
        segment,
        orderType,
        quantity,
        entryLeg,
        leg1,
        leg2,
    } = viewModel || {};
    const { onClose = () => {} } = actions || {};

    return (
        <ModalShell
            visible={visible}
            onClose={onClose}
            variant="centered"
            style={{ padding: 0, overflow: 'hidden' }}
        >
            {/* Header */}
            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: '#FEF9C3',
                        borderBottomColor: tokens.colors.border.default,
                    },
                ]}
            >
                <View style={styles.headerLeft}>
                    <View style={styles.clockBadge}>
                        <Clock size={16} color="#92400E" />
                    </View>
                    <Text
                        variant="title"
                        style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: tokens.colors.text.primary,
                            flex: 1,
                        }}
                    >
                        GTT Details — {tradingSymbol}
                    </Text>
                </View>
            </View>

            {/* Body */}
            <ScrollView
                style={{ paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.md }}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.summaryGrid}>
                    <View style={styles.field}>
                        <Text
                            variant="caption"
                            style={{ fontSize: 11, color: tokens.colors.text.muted, marginBottom: 2 }}
                        >
                            Transaction
                        </Text>
                        <View
                            style={[
                                styles.badge,
                                {
                                    backgroundColor: isBuy
                                        ? tokens.colors.feedback.successBg || '#D1FAE5'
                                        : tokens.colors.feedback.errorBg || '#FEE2E2',
                                },
                            ]}
                        >
                            <Text
                                variant="caption"
                                style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: isBuy
                                        ? tokens.colors.feedback.success || '#065F46'
                                        : tokens.colors.feedback.error || '#991B1B',
                                }}
                            >
                                {transaction?.toUpperCase() || '-'}
                            </Text>
                        </View>
                    </View>
                    <Field
                        label="Exchange / Segment"
                        value={`${exchange || '-'} / ${segment || '-'}`}
                        tokens={tokens}
                    />
                    <Field label="Order Type" value={orderType} tokens={tokens} />
                    <Field label="Quantity" value={quantity} tokens={tokens} />
                </View>

                <View
                    style={[
                        styles.divider,
                        { backgroundColor: tokens.colors.border.default },
                    ]}
                />

                <View style={styles.legsSection}>
                    <View style={styles.legsHeader}>
                        <Clock size={16} color="#CA8A04" />
                        <Text
                            variant="body"
                            style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: tokens.colors.text.primary,
                            }}
                        >
                            GTT Legs
                        </Text>
                    </View>
                    <GttLeg title="Entry Leg" leg={entryLeg} tokens={tokens} />
                    <GttLeg title="StopLoss" leg={leg1} tokens={tokens} />
                    <GttLeg title="Target" leg={leg2} tokens={tokens} />
                </View>
            </ScrollView>
        </ModalShell>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    clockBadge: {
        backgroundColor: '#FDE68A',
        padding: 4,
        borderRadius: 6,
    },
    summaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    field: { width: '46%', marginBottom: 8 },
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    divider: { height: 1, marginVertical: 12 },
    legsSection: { gap: 10, marginBottom: 16 },
    legsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legContainer: {
        borderWidth: 1,
        borderRadius: 8,
        overflow: 'hidden',
    },
    legHeader: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    legBody: {
        padding: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
});

export default GttDetailsModal;
