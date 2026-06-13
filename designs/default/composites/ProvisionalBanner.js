/**
 * ProvisionalBanner — composite (P4, web-parity, lockup G banner).
 *
 * Amber "access granted, bank confirmation pending" notice for CashFree eNACH
 * mandates that are authorized (₹0 AUTH) but not yet bank-confirmed. The customer
 * has full provisional access; the first real debit promotes provisional→realized.
 *
 * Self-contained + best-effort: fetches GET /api/subscription-check/provisional/:email
 * and renders ONLY when there's a pending mandate. Any failure / no data → null, so
 * mounting it is inert by default. Cross-ref: docs/WEB_PARITY_MIGRATION_2026-06.md §5.3.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import axios from 'axios';
import Config from 'react-native-config';
import { getAuth } from '@react-native-firebase/auth';
import server from '../../../src/utils/serverConfig';
import { generateToken } from '../../../src/utils/SecurityTokenManager';
import { useTrade } from '../../../src/screens/TradeContext';

const fmtDate = d => {
    const dt = new Date(d);
    if (isNaN(dt)) return null;
    return dt.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const ProvisionalBanner = () => {
    const { configData } = useTrade();
    const email = getAuth().currentUser?.email;
    const [pending, setPending] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!email) return undefined;
        axios
            .get(
                `${server.server.baseUrl}api/subscription-check/provisional/${encodeURIComponent(email)}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                        'aq-encrypted-key': generateToken(
                            Config.REACT_APP_AQ_KEYS,
                            Config.REACT_APP_AQ_SECRET,
                        ),
                    },
                },
            )
            .then(res => {
                if (!alive) return;
                const d = res?.data || {};
                const items = d.provisional || d.mandates || d.data || [];
                const first = Array.isArray(items) ? items[0] : items;
                if (first && (first.mandate_status === 'pending' || first.entitlement_mode === 'provisional')) {
                    setPending(first);
                }
            })
            .catch(() => {
                /* no provisional endpoint / no mandate → banner stays hidden */
            });
        return () => {
            alive = false;
        };
    }, [email, configData]);

    if (!pending || dismissed) return null;

    const deadline = fmtDate(pending.grace_deadline || pending.grace_until);

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
            <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={8}>
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
