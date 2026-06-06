/**
 * WebinarsListScreen — public /webinars discovery surface.
 *
 * Three buckets: LIVE NOW (pulsing red), UPCOMING (amber), REPLAYS (green).
 * Each card pushes to WebinarDetail with the lessonId. Pull-to-refresh.
 * Per-advisor webinarsEnabled gate is currently NOT wired on mobile — the
 * advisor controls visibility by including / excluding the navigator entry.
 * The screen still renders cleanly when all three buckets are empty.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.3.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useConfig } from '../../context/ConfigContext';
import liveKitService from '../../FunctionCall/services/LiveKitService';

const SECTIONS = [
  { key: 'live',     title: 'Live now',                cta: 'Join now',     badge: 'LIVE',     color: '#dc2626' },
  { key: 'upcoming', title: 'Upcoming',                cta: 'Register',     badge: 'UPCOMING', color: '#d97706' },
  { key: 'replay',   title: 'Past webinars (replays)', cta: 'Watch replay', badge: 'REPLAY',   color: '#16a34a' },
];

function formatStartIST(iso) {
  if (!iso) return 'TBA';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'TBA';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' IST';
  } catch {
    return 'TBA';
  }
}

function WebinarCard({ card, section, onPress, accent }) {
  const isFree = Number(card.ticketPrice || 0) <= 0;
  return (
    <TouchableOpacity onPress={onPress} style={styles.card} activeOpacity={0.85}>
      <View style={styles.cardHeaderRow}>
        <View style={[styles.badge, { backgroundColor: section.color + '15' }]}>
          <Text style={[styles.badgeText, { color: section.color }]}>{section.badge}</Text>
        </View>
        {isFree ? (
          <Text style={styles.priceFree}>Free</Text>
        ) : (
          <Text style={styles.pricePaid}>₹{card.ticketPrice}</Text>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>{card.title}</Text>
      {!!card.description && (
        <Text style={styles.description} numberOfLines={2}>{card.description}</Text>
      )}
      <Text style={styles.meta}>
        {formatStartIST(card.scheduledStartTime)}
        {card.scheduledDurationMinutes ? ` · ${card.scheduledDurationMinutes} min` : ''}
      </Text>
      <Text style={[styles.cta, { color: accent }]}>{section.cta} →</Text>
    </TouchableOpacity>
  );
}

export default function WebinarsListScreen() {
  const navigation = useNavigation();
  const config = useConfig();
  const accent = config?.mainColor || config?.themeColor || '#b45309';
  const [data, setData] = useState({ upcoming: [], live: [], replay: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ pullToRefresh = false } = {}) => {
    if (pullToRefresh) setRefreshing(true); else setLoading(true);
    try {
      const d = await liveKitService.listPublicWebinars();
      setData(d || { upcoming: [], live: [], replay: [] });
      setError('');
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Could not load webinars');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Per-advisor gate. Placed AFTER all hooks above to respect
  // rules-of-hooks (matches the web WebinarsListPage pattern).
  if (config?.webinarsEnabled === false) {
    return (
      <View style={styles.notAvailableBox}>
        <Text style={styles.notAvailableTitle}>Not available</Text>
        <Text style={styles.notAvailableBody}>
          Webinars are not enabled for this advisor.
        </Text>
      </View>
    );
  }

  const renderSection = (section) => {
    const items = data[section.key] || [];
    // Hide LIVE + REPLAY sections entirely when empty; show UPCOMING with an
    // empty-state copy so the page never reads as "broken".
    if (section.key !== 'upcoming' && items.length === 0) return null;
    return (
      <View key={section.key} style={styles.section}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No upcoming webinars scheduled. Check back soon.</Text>
          </View>
        ) : items.map((c) => (
          <WebinarCard
            key={c.lessonId}
            card={c}
            section={section}
            accent={accent}
            onPress={() => navigation.navigate('WebinarDetail', { lessonId: c.lessonId })}
          />
        ))}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load({ pullToRefresh: true })} />
      }
    >
      <View style={styles.heading}>
        <Text style={styles.headingTitle}>Live Webinars</Text>
        <Text style={styles.headingSubtitle}>
          Join interactive live classes. Replays are available afterwards for ticket holders.
        </Text>
      </View>

      {loading && !refreshing && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={accent} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Couldn't load webinars: {error}</Text>
        </View>
      ) : null}

      {!loading && !error && SECTIONS.map(renderSection)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  contentContainer: { padding: 16, paddingBottom: 40 },
  heading: { marginBottom: 16 },
  headingTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  headingSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  loadingText: { marginLeft: 8, color: '#6b7280' },
  notAvailableBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24 },
  notAvailableTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  notAvailableBody: { color: '#6b7280', fontSize: 13, marginTop: 8, textAlign: 'center' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: '#991b1b', fontSize: 13 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 10 },
  emptyBox: { backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 8, padding: 20, alignItems: 'center' },
  emptyText: { color: '#6b7280', fontSize: 13 },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  priceFree: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  pricePaid: { fontSize: 13, fontWeight: '700', color: '#111827' },
  title: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 8 },
  description: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  meta: { fontSize: 11, color: '#9ca3af', marginTop: 8 },
  cta: { fontSize: 13, fontWeight: '600', marginTop: 8 },
});
