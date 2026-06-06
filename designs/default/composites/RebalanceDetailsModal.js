/**
 * RebalanceDetailsModal — design-system composite
 *
 * Migrated from src/components/AdviceScreenComponents/RebalanceDetailsModal.js
 * as Phase D's first end-to-end composite. The legacy version was already
 * pure presentation (props in, JSX out, only `useConfig()` for the gradient2
 * color); this migration is a token-and-primitives refactor with no
 * behavior change.
 *
 * Contract — same as the legacy file (back-compat for RebalanceCard):
 *   { visible, onClose, data }
 *
 * data shape (best-effort reconstruction from legacy reads):
 *   {
 *     advisor, model_name, frequency, overView,
 *     rebalanceMethodologyText, whyThisStrategy,
 *     latestRebalance: { updatedModelName, rebalanceDate, totalInvestmentvalue },
 *   }
 *
 * Primitive usage:
 *   - <Button variant="primary"> for the bottom Close button
 *   - <Icon> for the lucide X close icon
 *   - <Text> primitive for title / labels / values / tag / button text
 *   - Modal from RN — ModalShell primitive is deferred to Phase H
 *   - infoCard rows kept as raw <View> with token-driven styles (subtle,
 *     borderless-shadow look that doesn't match Card primitive's variants —
 *     using Card here would visually drift)
 *
 * Visual deltas vs legacy (intentional, design-system goal):
 *   - Tag bg / Close button bg flow from tokens.colors.brand.gradientEnd
 *     (replaces config.gradient2 with the corresponding token — same value
 *     for tenants that haven't customized).
 *   - All hardcoded colors (#fff, #111827, #6B7280, #F9FAFB, #E5E7EB)
 *     flow from tokens.colors.* mappings.
 *   - Border radius for the modal container, tag, and infoCard now uses
 *     tokens.radii.lg (was 20 / 12 / 12 — minor delta to 12 for the
 *     modal container).
 */

import React from 'react';
import { Modal, View, ScrollView, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';
import Button from '../primitives/Button';
import Icon from '../primitives/Icon';

const RebalanceDetailsModal = ({ visible, onClose, data }) => {
    const tokens = useTokens();
    const accentBg = tokens.colors.brand.gradientEnd;
    const latest = data?.latestRebalance;

    const rows = [
        { label: 'Advisor', value: data?.advisor },
        {
            label: 'Rebalance Date',
            value: latest?.rebalanceDate
                ? new Date(latest.rebalanceDate).toLocaleDateString()
                : '-',
        },
        {
            label: 'Total Investment Value',
            value: latest?.totalInvestmentvalue != null ? `₹ ${latest.totalInvestmentvalue}` : '-',
        },
        { label: 'Frequency', value: data?.frequency },
        { label: 'Overview', value: data?.overView },
        { label: 'Rebalance Methodology', value: data?.rebalanceMethodologyText },
        { label: 'Why This Strategy', value: data?.whyThisStrategy },
    ];

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View
                style={[
                    StyleSheet.absoluteFillObject,
                    {
                        backgroundColor: tokens.colors.overlay.modal,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: tokens.spacing.lg,
                    },
                ]}
            >
                <View
                    style={{
                        width: '100%',
                        backgroundColor: tokens.colors.surface.card,
                        borderRadius: tokens.radii.lg,
                        padding: tokens.spacing.lg,
                        maxHeight: '85%',
                        ...tokens.shadows.modal,
                    }}
                >
                    {/* Header */}
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: tokens.spacing.lg,
                        }}
                    >
                        <Text
                            variant="title"
                            style={{ flex: 1, color: tokens.colors.text.primary, fontWeight: '700' }}
                        >
                            {latest?.updatedModelName || data?.model_name}
                        </Text>
                        <View
                            style={{
                                backgroundColor: accentBg,
                                borderRadius: tokens.radii.lg,
                                paddingHorizontal: tokens.spacing.sm + 2,
                                paddingVertical: tokens.spacing.xs,
                                marginRight: tokens.spacing.sm,
                            }}
                        >
                            <Text
                                variant="caption"
                                style={{ color: tokens.colors.text.inverse, fontWeight: '600' }}
                            >
                                Rebalance
                            </Text>
                        </View>
                        <View style={{ padding: tokens.spacing.xs + 2 }}>
                            <Icon
                                Component={X}
                                size={22}
                                color={tokens.colors.text.secondary}
                                onPress={onClose}
                            />
                        </View>
                    </View>

                    {/* Body */}
                    <ScrollView style={{ marginBottom: tokens.spacing.lg }} showsVerticalScrollIndicator={false}>
                        {rows.map(
                            (item, idx) =>
                                item.value && (
                                    <View
                                        key={idx}
                                        style={{
                                            backgroundColor: tokens.colors.surface.subtle,
                                            borderRadius: tokens.radii.lg,
                                            padding: tokens.spacing.md,
                                            marginBottom: tokens.spacing.md,
                                            borderWidth: 1,
                                            borderColor: tokens.colors.border.default,
                                        }}
                                    >
                                        <Text
                                            variant="caption"
                                            style={{ color: tokens.colors.text.muted, marginBottom: 4 }}
                                        >
                                            {item.label}
                                        </Text>
                                        <Text
                                            variant="body"
                                            style={{
                                                color: tokens.colors.text.primary,
                                                fontWeight: '500',
                                                lineHeight: 20,
                                            }}
                                        >
                                            {item.value}
                                        </Text>
                                    </View>
                                )
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <Button
                        variant="primary"
                        label="Close"
                        onPress={onClose}
                        style={{
                            alignSelf: 'center',
                            marginTop: tokens.spacing.xs,
                            paddingVertical: tokens.spacing.md,
                            paddingHorizontal: 40,
                            backgroundColor: accentBg,
                            borderRadius: tokens.radii.lg,
                            ...tokens.shadows.elevated,
                        }}
                        labelStyle={{ fontSize: 16, letterSpacing: 0.5 }}
                    />
                </View>
            </View>
        </Modal>
    );
};

export default RebalanceDetailsModal;
