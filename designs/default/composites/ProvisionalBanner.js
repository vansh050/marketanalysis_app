/**
 * ProvisionalBanner — composite (P4, web-parity, lockup G banner).
 *
 * Amber "access granted, bank confirmation pending" notice for CashFree eNACH
 * mandates that are authorized (₹0 AUTH) but not yet bank-confirmed. The customer
 * has full provisional access; the first real debit promotes provisional→realized.
 *
 * Pure presentation. The Home container owns the mandate lookup, tenant headers,
 * dismissal state, and date formatting, then supplies `{viewModel, actions}`.
 * Cross-ref: docs/WEB_PARITY_MIGRATION_2026-06.md §5.3.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
const ProvisionalBanner = ({ viewModel = {}, actions = {} }) => {
    const { visible = false, deadline = null } = viewModel;
    const { dismiss = () => {} } = actions;
    if (!visible) return null;

    return (
        <View style={styles.banner}>
            <Text style={styles.icon}>🕓</Text>
            <View style={{ flex: 1 }}>
                <Text style={styles.title}>You're in — access granted</Text>
                <Text style={styles.body}>
                    Your auto-pay mandate is awaiting bank confirmation
                    {deadline ? ` (by ${deadline})` : ' (usually 1–3 business days)'}. We'll
                    auto-collect the fee once your bank confirms.
                </Text>
            </View>
            <TouchableOpacity onPress={dismiss} hitSlop={8}>
                <Text style={styles.dismiss}>✕</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 9,
        backgroundColor: '#FEF3C7',
        borderColor: '#FACC7E',
        borderWidth: 1,
        borderRadius: 12,
        padding: 11,
        marginHorizontal: 16,
        marginTop: 12,
    },
    icon: { fontSize: 15, marginTop: 1 },
    title: { fontSize: 12.5, color: '#7A4408', fontFamily: 'Poppins-Medium' },
    body: {
        fontSize: 11,
        color: '#92560B',
        fontFamily: 'Satoshi-Regular',
        marginTop: 2,
        lineHeight: 16,
    },
    dismiss: { fontSize: 13, color: '#92560B', paddingHorizontal: 2 },
});

export default ProvisionalBanner;
