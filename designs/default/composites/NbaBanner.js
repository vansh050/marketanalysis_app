/**
 * NbaBanner — composite (P3, web-parity, lockup F "Slim banner + 3 pills").
 *
 * Self-gated on `config.nbaHomeEnabled` (default OFF). Derives NbaSignals from the
 * app's existing TradeContext state (broker / KYC / repair / recommendations), ranks
 * them with the PORTED pure engine (src/utils/nba/nbaRanking — drift-tripwire aligned
 * with web), and renders:
 *   - a SLIM action banner for the single focal action (rankActions()[0]), and
 *   - a Broker · KYC · Health status strip (3 pills).
 *
 * The banner CTA navigates best-effort (wrapped so an unknown route never crashes).
 * The Health pill shows the factual gap count (reuses the ported health engine) when
 * portfolioHealthEnabled. Cross-ref: docs/WEB_PARITY_MIGRATION_2026-06.md §5.2.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useConfig } from '../../../src/context/ConfigContext';
import { useTrade } from '../../../src/screens/TradeContext';
import { rankActions, NBA_KIND } from '../../../src/utils/nba/nbaRanking';
import { BROKER_STATUS } from '../../../src/utils/nba/brokerStatus';
import {
    computeHealthSubScores,
    DEFAULT_ENABLED,
} from '../../../src/utils/nba/portfolioHealth';

const deriveBrokerState = ({ broker, brokerStatus, isBrokerConnected, userDetails }) => {
    const ub = String(userDetails?.user_broker || broker || '').toLowerCase();
    const cbs = String(userDetails?.connect_broker_status || '').toLowerCase();
    if (ub.includes('dummy') || cbs === 'manual' || cbs === 'no_broker') {
        return BROKER_STATUS.MANUAL;
    }
    const st = String(brokerStatus || '').toLowerCase();
    if (st.includes('expire')) return BROKER_STATUS.TOKEN_EXPIRED;
    if (isBrokerConnected || st === 'connected') return BROKER_STATUS.OK;
    // No ACTIVE broker, but the user has a previously-connected broker whose token
    // expired (e.g. Zerodha's daily 5 AM IST reset clears user_broker + sets
    // connect_broker_status='Disconnected'). That's a RECONNECT case, not a first-time
    // connect — show "Reconnect", not "Connect". Detect via connected_brokers[].status
    // === 'expired'/'disconnected' or a past token_expire.
    const cb = Array.isArray(userDetails?.connected_brokers)
        ? userDetails.connected_brokers
        : [];
    const hasExpiredBroker = cb.some(b => {
        const s = String(b?.status || '').toLowerCase();
        const expiredByDate = b?.token_expire
            ? new Date(b.token_expire).getTime() < Date.now()
            : false;
        return s === 'expired' || s === 'disconnected' || expiredByDate;
    });
    if (hasExpiredBroker) return BROKER_STATUS.TOKEN_EXPIRED;
    return BROKER_STATUS.NOT_CONNECTED;
};

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
            symbol: h.symbol || h.tradingSymbol || h.tradingsymbol || h.symbolName || '',
            quantity: Number(h.quantity || h.qty || 0),
            ltp: Number(h.ltp || h.lastPrice || h.last_price || 0),
            value: Number(h.value || h.currentValue || h.holdingvalue || 0),
            avgPrice: Number(h.averagePrice || h.avgPrice || 0),
        }))
        .filter(h => h.symbol);
};

const Pill = ({ tone, label }) => (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
        <View style={[styles.dot, styles[`dot_${tone}`]]} />
        <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text>
    </View>
);

const NbaBanner = () => {
    const config = useConfig();
    const navigation = useNavigation();
    const trade = useTrade();
    const {
        broker,
        brokerStatus,
        isBrokerConnected,
        userDetails,
        modelPortfolioRepairTrades,
        stockRecoNotExecutedfinal,
        allHoldingsData,
    } = trade || {};

    const brokerState = deriveBrokerState({
        broker,
        brokerStatus,
        isBrokerConnected,
        userDetails,
    });

    const kycDone = userDetails?.digio_verification === true;

    const signals = useMemo(
        () => ({
            brokerState,
            repairTradesCount: Array.isArray(modelPortfolioRepairTrades)
                ? modelPortfolioRepairTrades.length
                : 0,
            newRecommendationsCount: Array.isArray(stockRecoNotExecutedfinal)
                ? stockRecoNotExecutedfinal.length
                : 0,
        }),
        [brokerState, modelPortfolioRepairTrades, stockRecoNotExecutedfinal],
    );

    const actions = rankActions(signals);
    const focal = actions[0] || null;

    // Health gap count (reuses the ported engine) — only when the tool is enabled.
    const healthGap = useMemo(() => {
        if (!config?.portfolioHealthEnabled) return null;
        const holdings = extractHoldings(allHoldingsData);
        if (holdings.length === 0) return null;
        const res = computeHealthSubScores(holdings, {
            enabled: config?.portfolioHealth?.enabled || DEFAULT_ENABLED,
            thresholds: config?.portfolioHealth?.thresholds,
        });
        return res.gapCount;
    }, [config, allHoldingsData]);

    if (!config?.nbaHomeEnabled) return null;

    const onAct = () => {
        if (!focal) return;
        // BROKER connect/reconnect → go to the 'Broker Setting' screen (= SubscriptionScreen,
        // Navigation.js:1070/1291), which OWNS the canonical broker-connect flow (the
        // logo-picker BrokerSelectionModal → per-broker SDK/legacy auth via
        // BrokerConnectModalDispatch). This is the same flow the rest of the app uses.
        // DO NOT navigate to the standalone 'BrokerSelection' route — that's a different,
        // plain letter-avatar screen (src/screens/Broker/BrokerSelectionScreen.js) and was
        // the bug (home banner opened the "wrong" broker screen). See docs/BROKER_CONNECTION.md
        // §"Connect-broker entry points" + docs/WEB_PARITY_MIGRATION_2026-06.md.
        // rebalance/repair → 'Model Portfolio' (with the space). Recommendations render on
        // the Home tab the user is already on → informational only, no navigation.
        if (
            focal.kind === NBA_KIND.RECONNECT_BROKER ||
            focal.kind === NBA_KIND.CONNECT_BROKER
        ) {
            try {
                navigation.navigate('Broker Setting');
            } catch (e) {
                /* route unavailable — banner stays informational */
            }
            return;
        }
        const routeFor = {
            [NBA_KIND.REVIEW_REPAIR_TRADES]: 'Model Portfolio',
            [NBA_KIND.ACCEPT_REBALANCE]: 'Model Portfolio',
        };
        const route = routeFor[focal.kind];
        if (!route) return;
        try {
            navigation.navigate(route);
        } catch (e) {
            /* unknown route — banner stays informational */
        }
    };

    const brokerPill = {
        [BROKER_STATUS.OK]: { tone: 'green', label: 'Broker Connected' },
        [BROKER_STATUS.TOKEN_EXPIRED]: { tone: 'amber', label: 'Broker Expired' },
        [BROKER_STATUS.NOT_CONNECTED]: { tone: 'grey', label: 'Broker —' },
        [BROKER_STATUS.MANUAL]: { tone: 'grey', label: 'Broker Manual' },
    }[brokerState] || { tone: 'grey', label: 'Broker —' };

    return (
        <View style={styles.wrap}>
            {focal && (
                <TouchableOpacity
                    style={styles.banner}
                    activeOpacity={0.85}
                    onPress={onAct}>
                    <View style={styles.accent} />
                    <View style={styles.bangIcon}>
                        <Text style={{ color: '#0056B7', fontWeight: '700' }}>!</Text>
                    </View>
                    <Text style={styles.bannerText} numberOfLines={2}>
                        {focal.title}
                    </Text>
                    {focal.ctaLabel ? (
                        <View style={styles.fixBtn}>
                            <Text style={styles.fixText}>{focal.ctaLabel}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            )}

            <View style={styles.strip}>
                <Pill tone={brokerPill.tone} label={brokerPill.label} />
                <Pill
                    tone={kycDone ? 'green' : 'amber'}
                    label={kycDone ? 'KYC Done' : 'KYC Pending'}
                />
                {healthGap !== null && (
                    <Pill
                        tone={healthGap > 0 ? 'amber' : 'green'}
                        label={`Health ${healthGap}`}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 12 },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingVertical: 9,
        paddingHorizontal: 11,
        marginBottom: 8,
        gap: 9,
        overflow: 'hidden',
    },
    accent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: '#0056B7',
    },
    bangIcon: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: '#EAF2FB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerText: { flex: 1, fontSize: 12.5, color: '#111827', fontFamily: 'Poppins-Medium' },
    fixBtn: {
        backgroundColor: '#0056B7',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    fixText: { color: '#fff', fontSize: 11, fontFamily: 'Poppins-Medium' },

    strip: { flexDirection: 'row', gap: 6 },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 18,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    pill_green: { backgroundColor: '#DCFCE7' },
    pill_amber: { backgroundColor: '#FEF3C7' },
    pill_grey: { backgroundColor: '#F0F0F0' },
    dot: { width: 6, height: 6, borderRadius: 3 },
    dot_green: { backgroundColor: '#16A34A' },
    dot_amber: { backgroundColor: '#B45309' },
    dot_grey: { backgroundColor: '#9CA3AF' },
    pillText: { fontSize: 10.5, fontFamily: 'Poppins-Medium' },
    pillText_green: { color: '#16A34A' },
    pillText_amber: { color: '#B45309' },
    pillText_grey: { color: '#6B7280' },
});

export default NbaBanner;
