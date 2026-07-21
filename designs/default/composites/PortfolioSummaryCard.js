/**
 * PortfolioSummaryCard — composite (mobile port of the web "Client Performance
 * Summary" customer feature).
 *
 * Web sources ported (prod-alphaquark-github):
 *   • src/Home/PortfolioSummarySection/PortfolioSummarySection.js — fund-wise
 *     invested / current / net-of-cost returns per model portfolio (Phase 1).
 *   • src/Home/PortfolioSummarySection/PortfolioValueHistory.js — since-inception
 *     value-vs-invested chart + XIRR/TWRR (Phase 3).
 *   • src/Home/PortfolioSummarySection/RealisedPnlSection.js — realised P&L on
 *     sold positions per fund (Phase 2).
 * Backend contract: src/services/PortfolioSummaryService.js (3 GET endpoints).
 * Canonical doc: prod-alphaquark-github/docs/CLIENT_PERFORMANCE_SUMMARY_ARCHITECTURE.md.
 *
 * Self-contained + GATED (web "embedded" mode): renders null unless
 * `config.performanceSummaryEnabled` (default-ON, mirrors web) AND the endpoint
 * returns real data — so a customer with no model-portfolio holdings sees
 * nothing. Mounted as ONE line inside the already container/presentation-split
 * PortfolioScreen (ListHeaderComponent of the Model Portfolios tab), so it adds
 * the summary WITHOUT touching that screen's holdings/positions logic. Follows
 * the same shape as the sibling RIA AumPerformanceCard composite.
 *
 * Colour policy (doc §9): gains green, invested/informational grey/neutral —
 * RED reserved for an ACTUAL loss. Colours come from useTokens() (never
 * hardcoded), so per-advisor colorTokens overrides apply.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { getAuth } from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { useConfig } from '../../../src/context/ConfigContext';
import useTokens from '../../../src/theme/useTokens';
import PortfolioSummaryService from '../../../src/FunctionCall/services/PortfolioSummaryService';
import { useTrade } from '../../../src/screens/TradeContext';
import {useAccountEmail} from '../../../src/utils/accountEmail';

// ── formatters (mirror web's `inr` / `pct`) ────────────────────────────────
const inr = v => {
  if (v === null || v === undefined || isNaN(Number(v))) return '—';
  const n = Math.round(Number(v));
  const s = String(Math.abs(n));
  let last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  if (rest) last3 = ',' + last3;
  const body = (rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + last3);
  return `₹${n < 0 ? '-' : ''}${body}`;
};
const pct = n =>
  typeof n === 'number' && !isNaN(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—';
const entitlementKey = value =>
  String(value || '').toLowerCase().replace(/_/g, ' ').trim();

/**
 * Self-contained error boundary — this embedded widget must NEVER crash the
 * host Portfolio screen. Mirrors the web SummaryErrorBoundary (embedded mode:
 * disappear on failure).
 */
class SummaryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* swallow — embedded widget must not take down the screen */
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function PortfolioSummaryInner() {
  const navigation = useNavigation();
  const config = useConfig();
  const tokens = useTokens();
  const enabled = !!(config && config.performanceSummaryEnabled);
  // Apple users have no usable currentUser.email (null / relay alias);
  // this component gates its fetch on `email`, and the identity can
  // resolve AFTER mount — the reactive hook re-renders when it does.
  const email = useAccountEmail();
  const {
    modelPortfolioStrategyfinal,
    modelPortfolioEntitlementsLoaded,
  } = useTrade();

  const c = tokens.colors;
  // Red-for-losses-only tone helper.
  const tone = useCallback(
    v => (v > 0 ? c.pnl.profit : v < 0 ? c.pnl.loss : c.text.primary),
    [c],
  );

  const [summary, setSummary] = useState(null); // { totals..., portfolios[] }
  const [history, setHistory] = useState(null); // { series, by_model, summary, xirr, twrr }
  const [realised, setRealised] = useState(null); // { funds[], totals... }
  const [ready, setReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState(''); // '' = aggregate (value history)
  const [openFund, setOpenFund] = useState({}); // realised expand state

  const load = useCallback(async () => {
    if (!email) {
      setReady(true);
      return;
    }
    setReady(false);
    // Each read is independent — one failing must not blank the others.
    const [s, h, r] = await Promise.all([
      PortfolioSummaryService.getPortfolioSummary(email).catch(() => null),
      PortfolioSummaryService.getValueHistory(email).catch(() => null),
      PortfolioSummaryService.getRealisedPnl(email).catch(() => null),
    ]);
    setSummary(s);
    setHistory(h);
    setRealised(r);
    setReady(true);
  }, [email]);

  useEffect(() => {
    // Embedded: only fetch when the feature is enabled.
    if (!enabled) return;
    load();
  }, [enabled, load]);

  // ── derive: fund-wise summary ────────────────────────────────────────────
  const portfolios = summary?.portfolios || [];
  const hasSummary = portfolios.length > 0;
  const activeModelNames = useMemo(
    () =>
      new Set(
        (modelPortfolioStrategyfinal || []).map(portfolio =>
          entitlementKey(portfolio?.model_name),
        ),
      ),
    [modelPortfolioStrategyfinal],
  );
  const isSubscriptionActive = portfolio =>
    modelPortfolioEntitlementsLoaded
      ? activeModelNames.has(entitlementKey(portfolio?.modelName))
      : undefined;

  // ── derive: value history (aggregate vs single model) ────────────────────
  const byModel = history?.by_model || [];
  const activeHistory = selectedModel
    ? byModel.find(m => m.model_name === selectedModel)
    : {
        series: (history?.series || []).map(p => ({
          date: p.date,
          value: p.total_aum,
          invested: p.invested,
        })),
        summary: history?.summary,
      };
  const hSeries = selectedModel
    ? (activeHistory?.series || []).map(p => ({
        date: p.date,
        value: p.value,
        invested: p.invested,
      }))
    : activeHistory?.series || [];
  const hSummary = activeHistory?.summary || null;
  const hasHistory = hSeries && hSeries.length > 1;

  // ── derive: realised ─────────────────────────────────────────────────────
  const funds = (realised?.funds || []).filter(
    f =>
      f.closedCount > 0 ||
      Math.abs(f.customerRealised || 0) > 0 ||
      Math.abs(f.modelRealised || 0) > 0,
  );
  const hasRealised = funds.length > 0;

  const styles = useMemo(() => makeStyles(c), [c]);

  // Embedded gate (web parity): render nothing unless enabled AND some real
  // data across any of the three surfaces — never clutter the dashboard of a
  // customer with no model-portfolio holdings.
  if (!enabled) return null;
  if (!ready) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="small" color={c.brand.primary} />
      </View>
    );
  }
  if (!hasSummary && !hasHistory && !hasRealised) return null;

  const netReturns = summary?.totalReturnsNet ?? 0;
  const netPct = summary?.returnsPercentageNet ?? 0;
  const grossReturns = summary?.totalReturns ?? 0;
  const estCost = summary?.estTotalCost ?? 0;

  const chartWidth = Dimensions.get('window').width - 64;

  return (
    <View>
      {/* ── Fund-wise summary ─────────────────────────────────────────── */}
      {hasSummary && (
        <View style={styles.card}>
          <Text style={styles.title}>Portfolio summary</Text>
          <Text style={styles.subtitle}>
            How each of your model portfolios is doing
          </Text>

          {/* Grand totals */}
          <View style={styles.statRow}>
            <Stat styles={styles} label="Total invested" value={inr(summary?.totalInvested)} />
            <Stat styles={styles} label="Current value" value={inr(summary?.totalCurrent)} />
          </View>
          <View style={styles.statRow}>
            <Stat
              styles={styles}
              label="Net returns"
              value={inr(netReturns)}
              sub={pct(netPct)}
              color={tone(netReturns)}
            />
            <Stat
              styles={styles}
              label="Est. costs"
              value={inr(estCost)}
              sub="STT · brokerage · charges"
              color={c.text.muted}
            />
          </View>

          {/* Per-fund rows */}
          <View style={styles.tableHead}>
            <Text style={[styles.thCell, { flex: 2 }]}>Fund</Text>
            <Text style={[styles.thCell, styles.thRight]}>Net return</Text>
            <Text style={[styles.thCell, styles.thRight]}>Return %</Text>
          </View>
          {modelPortfolioEntitlementsLoaded &&
            portfolios.length > 0 &&
            portfolios.every(p => isSubscriptionActive(p) === false) && (
              <TouchableOpacity
                style={styles.expiredBanner}
                onPress={() => navigation?.navigate?.('Plans')}
                activeOpacity={0.8}>
                <View style={styles.expiredBannerCopy}>
                  <Text style={styles.expiredBannerTitle}>Expired subscriptions</Text>
                  <Text style={styles.expiredBannerText}>
                    These holdings remain visible for reference. Renew to start
                    receiving rebalances and recommendations again.
                  </Text>
                </View>
                <View style={styles.expiredBannerCta}>
                  <Text style={styles.expiredBannerCtaText}>Renew plans</Text>
                  <ChevronRight size={15} color={c.brand.primary} />
                </View>
              </TouchableOpacity>
            )}
          {portfolios.map(p => {
            const net = p.returnsNet ?? p.returns ?? 0;
            const netP = p.returnsPercentageNet ?? p.returnsPercentage ?? 0;
            const subscriptionActive = isSubscriptionActive(p);
            return (
              <View key={`${p.modelName}-${p.broker || ''}`} style={styles.row}>
                <View style={{ flex: 2 }}>
                  <View>
                    <Text style={styles.fundName} numberOfLines={1}>
                      {p.modelName}
                    </Text>
                    {subscriptionActive === false && (
                      <View style={styles.expiredBadge}>
                        <Text style={styles.expiredBadgeText}>Expired plan</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.fundMeta} numberOfLines={1}>
                    {p.stockCount
                      ? `${p.stockCount} holding${p.stockCount > 1 ? 's' : ''}`
                      : ''}
                    {p.broker ? ` · ${p.broker}` : ''}
                  </Text>
                  <Text style={styles.fundMeta}>Invested {inr(p.invested)}</Text>
                </View>
                <Text style={[styles.cellRight, { color: tone(net), fontFamily: 'Satoshi-Bold' }]}>
                  {inr(net)}
                </Text>
                <Text style={[styles.cellRight, { color: tone(netP) }]}>{pct(netP)}</Text>
              </View>
            );
          })}
          {/* Total row */}
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.fundName, { flex: 2 }]}>Total</Text>
            <Text style={[styles.cellRight, { color: tone(netReturns), fontFamily: 'Satoshi-Bold' }]}>
              {inr(netReturns)}
            </Text>
            <Text style={[styles.cellRight, { color: tone(netPct), fontFamily: 'Satoshi-Bold' }]}>
              {pct(netPct)}
            </Text>
          </View>

          <Text style={styles.note}>
            Returns are net of an estimated round-trip cost (STT, brokerage,
            exchange & statutory charges). Gross returns: {inr(grossReturns)}.
            Values use the latest available prices.
          </Text>
        </View>
      )}

      {/* ── Value since you started (chart + XIRR/TWRR) ───────────────── */}
      {hasHistory && (
        <View style={styles.card}>
          <Text style={styles.title}>Value since you started</Text>
          {hSummary?.has_executed_trades === false && (
            <View style={styles.projectedBadge}>
              <Text style={styles.projectedBadgeText}>
                Projected — based on declared capital; no trades executed yet
              </Text>
            </View>
          )}
          <Text style={styles.subtitle}>
            How your investment has grown, tracking the model
            {hSummary?.as_of ? ` · as of ${hSummary.as_of}` : ''}
          </Text>

          {byModel.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}>
              <Chip
                styles={styles}
                label="All portfolios"
                on={selectedModel === ''}
                onPress={() => setSelectedModel('')}
              />
              {byModel.map(m => (
                <Chip
                  key={m.model_name}
                  styles={styles}
                  label={m.model_name}
                  on={selectedModel === m.model_name}
                  onPress={() => setSelectedModel(m.model_name)}
                />
              ))}
            </ScrollView>
          )}

          <View style={styles.statRow}>
            <Stat styles={styles} label="Value" value={inr(hSummary?.total_aum)} />
            <Stat styles={styles} label="Invested" value={inr(hSummary?.invested)} />
          </View>
          <View style={styles.statRow}>
            <Stat
              styles={styles}
              label="Gain / Loss"
              value={inr(hSummary?.abs_gain ?? 0)}
              color={tone(hSummary?.abs_gain ?? 0)}
            />
            <Stat
              styles={styles}
              label="XIRR / TWRR"
              value={
                history?.xirr != null || history?.twrr != null
                  ? `${pct(history?.xirr)} / ${pct(history?.twrr)}`
                  : '—'
              }
              color={tone(typeof history?.xirr === 'number' ? history.xirr : 0)}
            />
          </View>

          <LineChart
            data={{
              labels: hSeries.map((p, i) => {
                const show =
                  i === 0 ||
                  i === hSeries.length - 1 ||
                  i === Math.floor(hSeries.length / 2);
                if (!show) return '';
                const d = new Date(p.date);
                return isNaN(d) ? '' : `${d.getDate()}/${d.getMonth() + 1}`;
              }),
              datasets: [
                {
                  data: hSeries.map(p => Number(p.value) || 0),
                  color: () => c.brand.primary,
                  strokeWidth: 2,
                },
                {
                  data: hSeries.map(p => Number(p.invested) || 0),
                  color: () => c.text.disabled,
                  strokeWidth: 1,
                },
              ],
              legend: ['Value', 'Invested'],
            }}
            width={chartWidth}
            height={180}
            withInnerLines={false}
            withOuterLines={false}
            withDots={false}
            chartConfig={{
              backgroundGradientFrom: c.surface.card,
              backgroundGradientTo: c.surface.card,
              decimalPlaces: 0,
              color: () => c.brand.primary,
              labelColor: () => c.text.muted,
              propsForBackgroundLines: { stroke: c.border.subtle },
            }}
            bezier
            style={styles.chart}
          />

          <Text style={styles.note}>
            Value assumes you tracked the model's rebalances since your first
            investment.
            {hSummary?.has_executed_trades === false
              ? ' This is a projection based on your declared capital — no trades have been executed yet.'
              : typeof hSummary?.actual_current === 'number'
              ? ` Your current broker-holdings value is ${inr(hSummary.actual_current)}.`
              : ''}{' '}
            XIRR is money-weighted; TWRR is time-weighted. Past performance
            doesn't guarantee future returns.
          </Text>
        </View>
      )}

      {/* ── Realised gains (sold positions) ──────────────────────────── */}
      {hasRealised && (
        <View style={styles.card}>
          <Text style={styles.title}>Realised gains (sold positions)</Text>
          <Text style={styles.subtitle}>
            Gain / loss booked on stocks that were sold
          </Text>

          <View style={styles.statRow}>
            <Stat
              styles={styles}
              label="Your realised P&L"
              value={inr(realised?.totalCustomerRealised ?? 0)}
              color={tone(realised?.totalCustomerRealised ?? 0)}
            />
            <Stat
              styles={styles}
              label="Model realised P&L"
              value={inr(realised?.totalModelRealised ?? 0)}
              sub="booked by the model"
              color={tone(realised?.totalModelRealised ?? 0)}
            />
          </View>

          <View style={styles.tableHead}>
            <Text style={[styles.thCell, { flex: 2 }]}>Fund</Text>
            <Text style={[styles.thCell, styles.thRight]}>Your realised</Text>
            <Text style={[styles.thCell, styles.thRight, { flex: 0.7 }]}>Lots</Text>
          </View>
          {funds.map(f => {
            const isOpen = !!openFund[f.modelName];
            return (
              <View key={f.modelName}>
                <TouchableOpacity
                  activeOpacity={f.closedCount ? 0.6 : 1}
                  onPress={() =>
                    f.closedCount &&
                    setOpenFund(o => ({ ...o, [f.modelName]: !o[f.modelName] }))
                  }
                  style={styles.row}>
                  <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center' }}>
                    {f.closedCount ? (
                      isOpen ? (
                        <ChevronDown size={15} color={c.text.muted} />
                      ) : (
                        <ChevronRight size={15} color={c.text.muted} />
                      )
                    ) : (
                      <View style={{ width: 15 }} />
                    )}
                    <Text style={[styles.fundName, { marginLeft: 4 }]} numberOfLines={1}>
                      {f.modelName}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.cellRight,
                      { color: tone(f.customerRealised), fontFamily: 'Satoshi-Bold' },
                    ]}>
                    {inr(f.customerRealised)}
                  </Text>
                  <Text style={[styles.cellRight, { flex: 0.7, color: c.text.muted }]}>
                    {f.closedCount || 0}
                  </Text>
                </TouchableOpacity>
                {isOpen &&
                  (f.closedPositions || []).map((cp, idx) => (
                    <View key={`${f.modelName}-${cp.symbol}-${idx}`} style={styles.subRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.subSymbol}>{cp.symbol}</Text>
                        <Text style={styles.fundMeta}>
                          {cp.qty} @ cost {inr(cp.avgCost)} → sold {inr(cp.exitPrice)}
                          {cp.exitDate ? ` · ${String(cp.exitDate).slice(0, 10)}` : ''}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.cellRight,
                          { color: tone(cp.realised) },
                        ]}>
                        {inr(cp.realised)}
                      </Text>
                    </View>
                  ))}
              </View>
            );
          })}

          <Text style={styles.note}>
            Realised P&L is booked when a position is sold, valued at the sale
            price against your average cost. Full exits only; small partial
            trims may not be included.
          </Text>
        </View>
      )}
    </View>
  );
}

function Stat({ styles, label, value, sub, color }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function Chip({ styles, label, on, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = c =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface.card,
      borderWidth: 1,
      borderColor: c.border.default,
      borderRadius: 16,
      padding: 14,
      marginHorizontal: 16,
      marginTop: 12,
    },
    title: {
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
      color: c.text.primary,
      marginBottom: 3,
    },
    subtitle: {
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Poppins-Regular',
      color: c.text.muted,
      marginBottom: 12,
    },
    statRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    stat: {
      flex: 1,
      backgroundColor: c.surface.subtle,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 10,
    },
    statLabel: { fontSize: 11, color: c.text.muted, fontFamily: 'Satoshi-Regular' },
    statValue: {
      fontSize: 15,
      color: c.text.primary,
      fontFamily: 'Satoshi-Bold',
      marginTop: 2,
    },
    statSub: { fontSize: 10, color: c.text.muted, fontFamily: 'Satoshi-Regular', marginTop: 1 },
    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: c.border.default,
      paddingBottom: 6,
      marginTop: 10,
      marginBottom: 2,
    },
    thCell: {
      flex: 1,
      fontSize: 11,
      fontFamily: 'Poppins-Medium',
      color: c.text.muted,
      textTransform: 'uppercase',
    },
    thRight: { textAlign: 'right' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: c.border.subtle,
    },
    totalRow: { borderBottomWidth: 0, borderTopWidth: 1.5, borderTopColor: c.border.default },
    fundName: { fontSize: 13, fontFamily: 'Poppins-SemiBold', color: c.text.primary },
    fundMeta: { fontSize: 11, fontFamily: 'Poppins-Regular', color: c.text.muted, marginTop: 2 },
    cellRight: {
      flex: 1,
      textAlign: 'right',
      fontSize: 13,
      fontFamily: 'Poppins-Medium',
      color: c.text.primary,
    },
    subRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      paddingLeft: 19,
      backgroundColor: c.surface.subtle,
      borderBottomWidth: 1,
      borderBottomColor: c.border.subtle,
    },
    subSymbol: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: c.text.primary },
    chips: { gap: 6, paddingVertical: 4, marginBottom: 6 },
    chip: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border.default,
      backgroundColor: c.surface.card,
    },
    chipOn: { backgroundColor: c.brand.primary, borderColor: c.brand.primary },
    chipText: { fontSize: 11, color: c.text.muted, fontFamily: 'Poppins-Medium' },
    chipTextOn: { color: c.text.inverse },
    chart: { marginTop: 8, borderRadius: 12, marginLeft: -8 },
    projectedBadge: {
      alignSelf: 'flex-start',
      marginBottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border.default,
      backgroundColor: c.surface.subtle,
    },
    projectedBadgeText: {
      fontSize: 11,
      fontFamily: 'Poppins-Medium',
      color: c.text.muted,
    },
    note: {
      marginTop: 10,
      fontSize: 11,
      lineHeight: 16,
      fontFamily: 'Poppins-Regular',
      color: c.text.muted,
    },
    expiredBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 4,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#FCD34D',
      backgroundColor: '#FFFBEB',
    },
    expiredBannerCopy: { flex: 1, paddingRight: 10 },
    expiredBannerTitle: {
      fontSize: 12,
      fontFamily: 'Poppins-SemiBold',
      color: '#92400E',
    },
    expiredBannerText: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 16,
      fontFamily: 'Poppins-Regular',
      color: '#92400E',
    },
    expiredBannerCta: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
    },
    expiredBannerCtaText: {
      fontSize: 11,
      fontFamily: 'Poppins-SemiBold',
      color: c.brand.primary,
    },
    expiredBadge: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: '#FEF3C7',
    },
    expiredBadgeText: {
      fontSize: 10,
      fontFamily: 'Poppins-Medium',
      color: '#92400E',
    },
  });

export default function PortfolioSummaryCard(props) {
  return (
    <SummaryErrorBoundary>
      <PortfolioSummaryInner {...props} />
    </SummaryErrorBoundary>
  );
}
