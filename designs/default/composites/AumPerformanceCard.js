/**
 * AumPerformanceCard — composite (P1, web-parity D14→C / "Cashflow-Story" lockup B).
 *
 * Self-contained + GATED: renders null unless `config.riaBillingEnabled` AND the RIA
 * value-history endpoint returns data. Mounted as one line inside the (already
 * container/presentation-split) MPPerformanceScreen presentation, so it adds the AUM
 * value-history section WITHOUT touching that screen's rebalance/payment logic.
 *
 * Shows: 3 stat cards (current / invested / gain), a per-MP selector chip row, and an
 * invested-vs-value line chart. NO benchmark line (SEBI — same rule as web). Chart is
 * intentionally isolated to ONE component so the chart lib can be swapped to
 * victory-native (D8) in a single-file change once that native dep is verified; ships
 * now on react-native-chart-kit (already a working dependency — see §4.3 deviation note).
 *
 * Cross-ref: docs/WEB_PARITY_MIGRATION_2026-06.md §5.1.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getAuth } from '@react-native-firebase/auth';
import { useConfig } from '../../../src/context/ConfigContext';
import RiaBillingService from '../../../src/FunctionCall/services/RiaBillingService';

const inr = v => {
    if (v === null || v === undefined || isNaN(Number(v))) return '—';
    const n = Math.round(Number(v));
    const s = String(Math.abs(n));
    let last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    if (rest) last3 = ',' + last3;
    return `₹${n < 0 ? '-' : ''}${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3}`;
};

const compact = v => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
    if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
    if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
    return `₹${n}`;
};

const AumPerformanceCard = () => {
    const config = useConfig();
    const email = getAuth().currentUser?.email;
    const [data, setData] = useState(null);
    const [model, setModel] = useState('all');

    useEffect(() => {
        let alive = true;
        if (!config?.riaBillingEnabled || !email) return undefined;
        RiaBillingService.getValueHistory(email)
            .then(res => {
                if (alive && res?.ok !== false) setData(res || null);
            })
            .catch(e =>
                console.warn('[AumPerformanceCard] value-history unavailable:', e?.message),
            );
        return () => {
            alive = false;
        };
    }, [config?.riaBillingEnabled, email]);

    const byModel = useMemo(() => data?.by_model || [], [data]);
    const activeSeries = useMemo(() => {
        if (model !== 'all') {
            const m = byModel.find(x => (x.model_name || x.modelName) === model);
            return m?.series || [];
        }
        return data?.series || [];
    }, [data, model, byModel]);

    const summary = (model !== 'all'
        ? byModel.find(x => (x.model_name || x.modelName) === model)?.summary
        : data?.summary) || data?.summary || {};

    // Gate: nothing to show.
    if (!config?.riaBillingEnabled) return null;
    if (!data || (activeSeries.length === 0 && !summary.total_aum)) return null;

    const width = Dimensions.get('window').width - 32;
    const valuePts = activeSeries.map(p => Number(p.total_aum) || 0);
    const investedPts = activeSeries.map(p => Number(p.invested) || 0);
    const labels = activeSeries.map((p, i) => {
        // Show ~4 sparse date labels, blank the rest to avoid clutter.
        const show = i === 0 || i === activeSeries.length - 1 ||
            i === Math.floor(activeSeries.length / 2);
        if (!show) return '';
        const d = new Date(p.date);
        return isNaN(d) ? '' : `${d.getDate()}/${d.getMonth() + 1}`;
    });

    const gain = Number(summary.abs_gain) || 0;
    const gainPct =
        summary.invested > 0 ? (gain / Number(summary.invested)) * 100 : null;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Performance</Text>

            <View style={styles.statRow}>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Current</Text>
                    <Text style={styles.statValue}>{compact(summary.total_aum)}</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Invested</Text>
                    <Text style={styles.statValue}>{compact(summary.invested)}</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>Gain</Text>
                    <Text
                        style={[
                            styles.statValue,
                            { color: gain >= 0 ? '#16A34A' : '#DC2626' },
                        ]}>
                        {gainPct === null
                            ? inr(gain)
                            : `${gain >= 0 ? '+' : ''}${gainPct.toFixed(1)}%`}
                    </Text>
                </View>
            </View>

            {byModel.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}>
                    <Chip
                        label="All portfolios"
                        on={model === 'all'}
                        onPress={() => setModel('all')}
                    />
                    {byModel.map(m => {
                        const name = m.model_name || m.modelName;
                        return (
                            <Chip
                                key={name}
                                label={name}
                                on={model === name}
                                onPress={() => setModel(name)}
                            />
                        );
                    })}
                </ScrollView>
            )}

            {valuePts.length > 1 && (
                <LineChart
                    data={{
                        labels,
                        datasets: [
                            { data: valuePts, color: () => '#0056B7', strokeWidth: 2 },
                            {
                                data: investedPts,
                                color: () => 'rgba(156,163,175,0.9)',
                                strokeWidth: 1,
                            },
                        ],
                        legend: ['Value', 'Invested'],
                    }}
                    width={width}
                    height={170}
                    withInnerLines={false}
                    withOuterLines={false}
                    withDots={false}
                    chartConfig={{
                        backgroundGradientFrom: '#fff',
                        backgroundGradientTo: '#fff',
                        decimalPlaces: 0,
                        color: () => '#0056B7',
                        labelColor: () => '#9CA3AF',
                        propsForBackgroundLines: { stroke: '#F0F0F0' },
                    }}
                    bezier
                    style={styles.chart}
                />
            )}
        </View>
    );
};

const Chip = ({ label, on, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        style={[styles.chip, on && styles.chipOn]}>
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 14,
        margin: 16,
    },
    title: {
        fontSize: 15,
        fontFamily: 'Poppins-SemiBold',
        color: '#111827',
        marginBottom: 10,
    },
    statRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    stat: {
        flex: 1,
        backgroundColor: '#F8F9FC',
        borderRadius: 10,
        paddingVertical: 9,
        alignItems: 'center',
    },
    statLabel: { fontSize: 11, color: '#6B7280', fontFamily: 'Satoshi-Regular' },
    statValue: {
        fontSize: 14,
        color: '#111827',
        fontFamily: 'Satoshi-Bold',
        marginTop: 2,
    },
    chips: { gap: 6, paddingVertical: 4, marginBottom: 4 },
    chip: {
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
    },
    chipOn: { backgroundColor: '#0056B7', borderColor: '#0056B7' },
    chipText: { fontSize: 11, color: '#6B7280', fontFamily: 'Poppins-Medium' },
    chipTextOn: { color: '#fff' },
    chart: { marginTop: 8, borderRadius: 12 },
});

export default AumPerformanceCard;
