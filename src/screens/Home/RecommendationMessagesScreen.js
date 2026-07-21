import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { ChevronLeft, MessageSquare } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import {getAccountEmail} from '../../utils/accountEmail';

// The backend serializes BSON dates as a naive UTC wall-clock (no offset).
// JS parses an offset-less ISO string as *local* time, which would show the
// raw UTC value as if it were IST. Append 'Z' when no timezone is present so
// it's parsed as UTC and then rendered/relativised in the device's local
// (IST) zone.
const parseAsUtcMs = (iso) => {
  if (!iso) return NaN;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasTz ? iso : `${iso}Z`).getTime();
};

// Lightweight relative-time so we don't depend on a date lib being present.
const timeAgo = (iso) => {
  const then = parseAsUtcMs(iso);
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
};

// Absolute timestamp in the device's local (IST) time.
const formatLocal = (iso) => {
  const ms = parseAsUtcMs(iso);
  if (Number.isNaN(ms)) return '';
  try {
    return new Date(ms).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return new Date(ms).toLocaleString();
  }
};

// Message "type" → badge label + colours. Keep in sync with the web
// utils/messageTypes.js + the backend AqMsg.message_type.
const TYPE_META = {
  info: { label: 'Info', bg: '#dbeafe', fg: '#1d4ed8', border: '#bfdbfe' },
  action_required: { label: 'Action Required', bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
  market_update: { label: 'Market Update', bg: '#d1fae5', fg: '#047857', border: '#a7f3d0' },
  alert: { label: 'Alert', bg: '#fee2e2', fg: '#b91c1c', border: '#fecaca' },
};
const typeMetaFor = (t) => TYPE_META[t] || TYPE_META.info;

const RecommendationMessagesScreen = () => {
  const navigation = useNavigation();
  const { configData } = useTrade();
  const config = useConfig();
  const mainColor = config?.mainColor || '#045DFF';

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchMessages = useCallback(async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      const res = await fetch(
        `${server.ccxtServer.baseUrl}comms/get-aq-message/20?email=${encodeURIComponent(
          userEmail,
        )}`,
        { method: 'GET', headers },
      );
      const json = await res.json();
      // 404 with status:1 means "no messages" — treat as empty, not an error.
      setMessages(Array.isArray(json?.result) ? json.result : []);
    } catch (e) {
      console.error('Error fetching recommendation messages:', e);
      setError('Failed to load messages. Please try again later.');
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail, configData]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft color="#1e293b" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recommendation Messages</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={mainColor} />
          <Text style={styles.muted}>Loading messages...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[mainColor]} />
          }>
          {error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.center}>
              <MessageSquare color="#cbd5e1" size={40} />
              <Text style={styles.emptyTitle}>No Messages Yet</Text>
              <Text style={styles.muted}>
                Investment messages from your manager will appear here.
              </Text>
            </View>
          ) : (
            messages.map((m) => {
              const isCancelled = m?.status === 'cancelled';
              const tm = typeMetaFor(m?.messageType);
              return (
              <View
                key={m._id || `${m.title}-${m.createdAt}`}
                style={[styles.card, isCancelled && styles.cardCancelled]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: mainColor }]}>
                    <MessageSquare color="#fff" size={16} />
                  </View>
                  <Text
                    style={[styles.cardTitle, isCancelled && styles.strikeMuted]}
                    numberOfLines={2}>
                    {m.title || 'Untitled Message'}
                  </Text>
                  <Text style={styles.cardTime}>{timeAgo(m.createdAt)}</Text>
                </View>

                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: tm.bg, borderColor: tm.border }]}>
                    <Text style={[styles.badgeText, { color: tm.fg }]}>{tm.label}</Text>
                  </View>
                  {!!m.linkedSymbol && (
                    <View style={[styles.badge, styles.symbolBadge]}>
                      <Text style={styles.symbolBadgeText}>{m.linkedSymbol}</Text>
                    </View>
                  )}
                  {isCancelled && (
                    <View style={[styles.badge, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]}>
                      <Text style={[styles.badgeText, { color: '#b91c1c' }]}>Withdrawn</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.cardBody, isCancelled && styles.strikeMuted]}>
                  {m.message || ''}
                </Text>

                {!!m.cta && !isCancelled && (
                  <Text style={[styles.cardCta, { color: mainColor }]}>{`→ ${m.cta}`}</Text>
                )}

                <Text style={styles.cardDate}>{formatLocal(m.createdAt)}</Text>
              </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f3',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', fontFamily: 'Poppins-SemiBold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  muted: { marginTop: 10, color: '#64748b', fontSize: 13, textAlign: 'center' },
  errorText: { color: '#e43d3d', fontSize: 14, textAlign: 'center' },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', color: '#334155' },
  listContent: { padding: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 12,
  },
  cardCancelled: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  cardTime: { fontSize: 11, color: '#94a3b8', marginLeft: 8 },
  cardBody: { fontSize: 13, color: '#374151', lineHeight: 20 },
  strikeMuted: { color: '#9ca3af', textDecorationLine: 'line-through' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
    marginBottom: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  symbolBadge: { backgroundColor: '#f3f4f6', borderColor: '#e5e7eb' },
  symbolBadgeText: { fontSize: 10, fontWeight: '700', color: '#4b5563' },
  cardCta: { marginTop: 8, fontSize: 13, fontWeight: '700' },
  cardDate: { marginTop: 10, fontSize: 11, color: '#94a3b8' },
});

export default RecommendationMessagesScreen;
