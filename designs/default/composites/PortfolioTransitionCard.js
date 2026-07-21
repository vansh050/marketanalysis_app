/**
 * PortfolioTransitionCard — composite (P5, web-parity, lockup deferred).
 *
 * The ADVICE surface: alignment % + keep/trim/exit/add/top-up buckets between the
 * customer's holdings and an RA model target. Compute = the ported pure engine
 * (src/utils/nba/portfolioTransition — drift-tripwire aligned).
 *
 * ⚠️ DEFERRED / UNMOUNTED (matches web): per docs/WEB_PARITY_MIGRATION_2026-06.md §2 +
 * D6-timing, this is built for parity but NOT mounted on home until web mounts it.
 * Self-gated on `transitionEngineEnabled` (default OFF) AND requires a `target` model;
 * with no target it renders null (never a fabricated alignment number).
 *
 * SEBI boundary: buckets are value judgments (sell/buy), legitimate ONLY because the
 * target is the RA's model — so the RA-attribution header renders ABOVE the diff, and
 * we communicate ALIGNMENT to the model, never a returns forecast.
 *
 * Contract (pure-presentation when given props; self-gated wrapper otherwise):
 *   props = { transition, modelName, advisorName }
 *     transition = computeTransition(holdings, target, opts) result, or null
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useConfig } from '../../../src/context/ConfigContext';
import { TRANSITION_BUCKET } from '../../../src/utils/nba/portfolioTransition';

const BUCKET_META = {
    [TRANSITION_BUCKET.KEEP]: { label: 'Keep', tone: '#16A34A' },
    [TRANSITION_BUCKET.TOPUP]: { label: 'Top up', tone: '#2563EB' },
    [TRANSITION_BUCKET.ADD]: { label: 'Add', tone: '#0056B7' },
    [TRANSITION_BUCKET.TRIM]: { label: 'Trim', tone: '#B45309' },
    [TRANSITION_BUCKET.EXIT]: { label: 'Exit', tone: '#DC2626' },
};

const PortfolioTransitionCard = ({ transition, modelName, advisorName }) => {
    const config = useConfig();

    // Deferred + gated: render nothing unless explicitly enabled AND a target exists.
    if (!config?.transitionEngineEnabled) return null;
    if (!transition || !transition.hasTarget) return null;

    const { alignmentPct, buckets } = transition;

    return (
        <View style={styles.card}>
            {/* RA attribution MUST render above the advice diff (SEBI). */}
            <Text style={styles.attribution}>
                {advisorName ? `${advisorName} · ` : ''}
                Recommended alignment to {modelName || 'your model'}
            </Text>

            <View style={styles.alignRow}>
                <Text style={styles.alignPct}>{alignmentPct}%</Text>
                <Text style={styles.alignLabel}>aligned to your model</Text>
            </View>
            <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, alignmentPct))}%` }]} />
            </View>

            <View style={styles.bucketWrap}>
                {Object.keys(BUCKET_META).map(key => {
                    const rows = buckets?.[key] || [];
                    if (rows.length === 0) return null;
                    const meta = BUCKET_META[key];
                    return (
                        <View key={key} style={styles.bucketRow}>
                            <View style={[styles.bucketDot, { backgroundColor: meta.tone }]} />
                            <Text style={styles.bucketLabel}>{meta.label}</Text>
                            <Text style={styles.bucketSyms} numberOfLines={1}>
                                {rows.map(r => r.symbol).join(', ')}
                            </Text>
                        </View>
                    );
                })}
            </View>

            <Text style={styles.footer}>
                Shows alignment to your manager's model — not a returns forecast.
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 16,
        padding: 14,
        margin: 16,
    },
    attribution: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Poppins-Medium',
        marginBottom: 8,
    },
    alignRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    alignPct: { fontSize: 26, color: '#111827', fontFamily: 'Satoshi-Bold' },
    alignLabel: { fontSize: 12, color: '#6B7280', fontFamily: 'Satoshi-Regular' },
    bar: {
        height: 6,
        borderRadius: 4,
        backgroundColor: '#F0F0F0',
        overflow: 'hidden',
        marginTop: 6,
        marginBottom: 12,
    },
    barFill: { height: '100%', backgroundColor: '#0056B7' },
    bucketWrap: { gap: 6 },
    bucketRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    bucketDot: { width: 8, height: 8, borderRadius: 4 },
    bucketLabel: {
        width: 54,
        fontSize: 12,
        color: '#111827',
        fontFamily: 'Satoshi-Medium',
    },
    bucketSyms: { flex: 1, fontSize: 12, color: '#374151', fontFamily: 'Satoshi-Regular' },
    footer: {
        fontSize: 11,
        color: '#6B7280',
        fontFamily: 'Satoshi-Regular',
        marginTop: 12,
    },
});

export default PortfolioTransitionCard;
