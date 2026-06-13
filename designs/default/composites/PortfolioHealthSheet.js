/**
 * PortfolioHealthSheet — composite (P2, web-parity, lockup C "Consent → Checklist").
 *
 * Self-gated launcher + bottom sheet for the Portfolio Health TOOL. Renders null
 * unless `config.portfolioHealthEnabled`. SEBI boundary (CUSTOMER_JOURNEY_NBA_REDESIGN):
 * FACTUAL only — gap-count headline, plain factual rows, ZERO buy/hold/sell language.
 * The advice (Transition) is a different surface (P5).
 *
 * Data: the canonical holdings input is the broker holdings already in TradeContext
 * (D18 spirit — one normalized source; the mobile aggregate is `allHoldingsData`).
 * Compute is the PORTED pure engine (src/utils/nba/portfolioHealth) — byte-aligned with
 * web via the drift tripwire. After an instant client compute we fire a best-effort
 * server reconcile (POST /api/model-portfolio/portfolio-health) for auditability; the
 * client result is authoritative on the screen if the server call fails.
 *
 * Consent: holdings are read only AFTER explicit consent, persisted in AsyncStorage
 * ('aq_health_holdings_consent'). Cross-ref: docs/WEB_PARITY_MIGRATION_2026-06.md §5.2.
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Config from 'react-native-config';
import { getAuth } from '@react-native-firebase/auth';
import server from '../../../src/utils/serverConfig';
import { generateToken } from '../../../src/utils/SecurityTokenManager';
import { useConfig } from '../../../src/context/ConfigContext';
import { useTrade } from '../../../src/screens/TradeContext';
import {
    computeHealthSubScores,
    DEFAULT_ENABLED,
} from '../../../src/utils/nba/portfolioHealth';

const CONSENT_KEY = 'aq_health_holdings_consent';

// Pull a per-stock holdings array out of the broker aggregate, tolerating the
// various shapes fetchBrokerAllHoldings can return. Maps each row to the engine's
// forgiving {symbol, quantity, ltp, value} input.
const extractHoldings = blob => {
    if (!blob) return [];
    const arr =
        (Array.isArray(blob) && blob) ||
        blob.data ||
        blob.holdings ||
        blob.stocks ||
        blob.stockData ||
        blob.allStocks ||
        blob.totalHoldings ||
        [];
    if (!Array.isArray(arr)) return [];
    return arr
        .map(h => ({
            symbol:
                h.symbol || h.tradingSymbol || h.tradingsymbol || h.symbolName || '',
            quantity: Number(h.quantity || h.qty || 0),
            ltp: Number(h.ltp || h.lastPrice || h.last_price || 0),
            value: Number(
                h.value || h.currentValue || h.holdingvalue || h.marketValue || 0,
            ),
            avgPrice: Number(
                h.averagePrice || h.avgPrice || h.average_price || 0,
            ),
        }))
        .filter(h => h.symbol);
};

const PortfolioHealthSheet = () => {
    const config = useConfig();
    const { allHoldingsData, configData } = useTrade();
    const email = getAuth().currentUser?.email;

    const [open, setOpen] = useState(false);
    const [phase, setPhase] = useState('idle'); // idle | consent | analyzing | done | empty
    const [result, setResult] = useState(null);

    const healthCfg = config?.portfolioHealth || {};
    const enabled = healthCfg.enabled || DEFAULT_ENABLED;
    const thresholds = healthCfg.thresholds || undefined;

    const reconcile = useCallback(
        (holdings, clientResult) => {
            // Best-effort auditable server reconcile. Never blocks/clobbers the UI.
            axios
                .post(
                    `${server.server.baseUrl}api/model-portfolio/portfolio-health`,
                    { holdings, enabled, thresholds, email },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Advisor-Subdomain':
                                configData?.config?.REACT_APP_HEADER_NAME,
                            'aq-encrypted-key': generateToken(
                                Config.REACT_APP_AQ_KEYS,
                                Config.REACT_APP_AQ_SECRET,
                            ),
                        },
                    },
                )
                .catch(() => {
                    /* client result stands */
                });
            return clientResult;
        },
        [enabled, thresholds, email, configData],
    );

    const runAnalysis = useCallback(() => {
        setPhase('analyzing');
        const holdings = extractHoldings(allHoldingsData);
        if (holdings.length === 0) {
            setPhase('empty');
            return;
        }
        const res = computeHealthSubScores(holdings, { enabled, thresholds });
        setResult(res);
        reconcile(holdings, res);
        setPhase('done');
    }, [allHoldingsData, enabled, thresholds, reconcile]);

    const onLaunch = useCallback(async () => {
        setOpen(true);
        try {
            const consent = await AsyncStorage.getItem(CONSENT_KEY);
            if (consent === 'true') runAnalysis();
            else setPhase('consent');
        } catch (e) {
            setPhase('consent');
        }
    }, [runAnalysis]);

    const onAllow = useCallback(async () => {
        try {
            await AsyncStorage.setItem(CONSENT_KEY, 'true');
        } catch (e) {
            /* non-fatal */
        }
        runAnalysis();
    }, [runAnalysis]);

    const onClose = () => {
        setOpen(false);
        setPhase('idle');
    };

    if (!config?.portfolioHealthEnabled) return null;

    return (
        <>
            <TouchableOpacity style={styles.launcher} onPress={onLaunch}>
                <View style={styles.launcherIcon}>
                    <Text style={{ fontSize: 16 }}>🛡</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.launcherTitle}>Check your portfolio health</Text>
                    <Text style={styles.launcherSub}>
                        Factual concentration & spread — not advice
                    </Text>
                </View>
                <Text style={styles.launcherCta}>›</Text>
            </TouchableOpacity>

            <Modal
                visible={open}
                transparent
                animationType="slide"
                onRequestClose={onClose}>
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.grab} />

                    {phase === 'consent' && (
                        <View>
                            <View style={styles.consentCard}>
                                <Text style={styles.consentTitle}>
                                    🛡 Check your portfolio health
                                </Text>
                                <Text style={styles.consentBody}>
                                    We read your holdings from your broker to show factual
                                    concentration and spread. Nothing is shared.
                                </Text>
                                <TouchableOpacity style={styles.primaryBtn} onPress={onAllow}>
                                    <Text style={styles.primaryBtnText}>Allow & analyze</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {phase === 'analyzing' && (
                        <View style={styles.center}>
                            <ActivityIndicator color="#0056B7" />
                            <Text style={styles.muted}>Analyzing your holdings…</Text>
                        </View>
                    )}

                    {phase === 'empty' && (
                        <View style={styles.center}>
                            <Text style={styles.headline}>No holdings to analyze</Text>
                            <Text style={styles.muted}>
                                Connect a broker with holdings to see your portfolio health.
                            </Text>
                        </View>
                    )}

                    {phase === 'done' && result && (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.headline}>
                                {result.gapCount === 0
                                    ? 'Nothing to review'
                                    : `${result.gapCount} thing${result.gapCount !== 1 ? 's' : ''} to review`}
                            </Text>
                            <Text style={styles.factualTag}>Factual checks · not advice</Text>
                            {result.subScores.map(s => (
                                <View key={s.key} style={styles.checkRow}>
                                    <View
                                        style={[
                                            styles.flag,
                                            s.isGap ? styles.flagGap : styles.flagOk,
                                        ]}>
                                        <Text style={styles.flagText}>{s.isGap ? '⚑' : '✓'}</Text>
                                    </View>
                                    <Text style={styles.checkText}>{s.detail}</Text>
                                </View>
                            ))}
                            <Text style={styles.footer}>
                                Factual checks only — not investment advice.
                            </Text>
                        </ScrollView>
                    )}

                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    launcher: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EAF2FB',
        borderColor: '#CFE2F7',
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        margin: 16,
        gap: 10,
    },
    launcherIcon: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    launcherTitle: { fontSize: 13, color: '#111827', fontFamily: 'Poppins-Medium' },
    launcherSub: { fontSize: 11, color: '#6B7280', fontFamily: 'Satoshi-Regular' },
    launcherCta: { fontSize: 22, color: '#0056B7' },

    backdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.42)' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '80%',
    },
    grab: {
        width: 38,
        height: 4,
        borderRadius: 3,
        backgroundColor: '#E5E7EB',
        alignSelf: 'center',
        marginBottom: 12,
    },
    consentCard: {
        backgroundColor: '#EAF2FB',
        borderColor: '#CFE2F7',
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
    },
    consentTitle: { fontSize: 14, color: '#111827', fontFamily: 'Poppins-Medium' },
    consentBody: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        marginTop: 6,
        lineHeight: 18,
    },
    primaryBtn: {
        backgroundColor: '#0056B7',
        borderRadius: 10,
        paddingVertical: 11,
        alignItems: 'center',
        marginTop: 12,
    },
    primaryBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Poppins-SemiBold' },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, gap: 8 },
    headline: { fontSize: 20, color: '#111827', fontFamily: 'Satoshi-Bold' },
    factualTag: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        marginTop: 2,
        marginBottom: 8,
    },
    checkRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 9,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    flag: {
        width: 18,
        height: 18,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    flagGap: { backgroundColor: '#FEF3C7' },
    flagOk: { backgroundColor: '#DCFCE7' },
    flagText: { fontSize: 10 },
    checkText: { flex: 1, fontSize: 12.5, color: '#111827', fontFamily: 'Satoshi-Medium' },
    muted: { fontSize: 12, color: '#6B7280', fontFamily: 'Satoshi-Regular', textAlign: 'center' },
    footer: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        textAlign: 'center',
        marginTop: 12,
    },
    closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    closeText: { fontSize: 13, color: '#6B7280', fontFamily: 'Poppins-Medium' },
});

export default PortfolioHealthSheet;
