/**
 * WebinarDetailScreen — public /webinar/:lessonId equivalent.
 *
 * Three states:
 *   1. Not signed in + not bought → Buy CTA opens BuyWebinarTicketSheet.
 *   2. Signed in + enrolled       → LiveRoom composite (countdown / live / ended).
 *   3. Signed in + not enrolled   → Buy CTA.
 *
 * The T-10min join-gating lives in the LiveRoom composite, not here.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.4.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { useDesign } from '../../design/useDesign';
import { useConfig } from '../../context/ConfigContext';
import liveKitService from '../../FunctionCall/services/LiveKitService';
import BuyWebinarTicketSheet from '../../components/BuyWebinarTicketSheet';

// Lazy LiveRoom resolution — once Phase 1c registers
// composites.LiveRoom in designs/default/index.js, this renders the
// real viewer. Until then it shows a "Join button will appear here"
// placeholder so the screen doesn't crash.
function LiveRoomLazy(props) {
  const design = useDesign();
  const Cmp = design?.components?.['composites.LiveRoom'];
  if (!Cmp) {
    return (
      <View style={styles.liveRoomPlaceholder}>
        <Text style={styles.liveRoomPlaceholderText}>
          You're registered. The Join Live button will appear here ~10 minutes before the class starts.
        </Text>
      </View>
    );
  }
  return <Cmp {...props} />;
}

function formatDateIST(iso) {
  if (!iso) return 'TBA';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'TBA';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) + ' IST';
  } catch {
    return 'TBA';
  }
}

export default function WebinarDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { lessonId } = route.params || {};
  const config = useConfig();
  const accent = config?.mainColor || config?.themeColor || '#d97706';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(() => getAuth().currentUser);
  const [buyOpen, setBuyOpen] = useState(false);
  const [showJoinFlow, setShowJoinFlow] = useState(false);
  const [purchaseEmail, setPurchaseEmail] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => setUser(u));
    return () => { if (unsub) unsub(); };
  }, []);

  const fetchPublic = useCallback(async () => {
    if (!lessonId) { setError('Missing lesson id'); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const d = await liveKitService.getPublicWebinar(lessonId);
      setData(d);
      // Backend returns isEnrolled=true when the signed-in caller already
      // has a per-lesson registration. Flip into join mode so a returning
      // registrant doesn't get prompted to re-register (matches web's
      // WebinarDetailPage behaviour). When isEnrolled=false (e.g. the
      // user signed out + back in as a different account), clear any
      // stale session state — otherwise the warn box would persist
      // pointing at the OLD purchaseEmail.
      if (d?.isEnrolled) {
        setShowJoinFlow(true);
        if (d.enrolledEmail) setPurchaseEmail(d.enrolledEmail);
      } else {
        setShowJoinFlow(false);
        setPurchaseEmail('');
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Could not load webinar');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  // Re-fetch when sign-in state flips — the /public endpoint only returns
  // isEnrolled when a Firebase Bearer is attached, so a fresh sign-in (or
  // a sign-out) needs a re-query.
  useEffect(() => { fetchPublic(); }, [fetchPublic, user?.uid]);

  const handlePurchased = useCallback((res) => {
    setBuyOpen(false);
    if (res?.buyerEmail) setPurchaseEmail(res.buyerEmail);
    setShowJoinFlow(true);
    fetchPublic();
  }, [fetchPublic]);

  // Per-advisor gate (after all hooks; matches web WebinarDetailPage).
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={styles.center}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn't load this webinar</Text>
          <Text style={styles.errorBody}>{error || 'Unknown error'}</Text>
        </View>
      </View>
    );
  }

  const isFree = Number(data.ticketPrice || 0) <= 0;
  const isEnded = !!data.liveEndedAt;
  const isVod = data.recordingStorageTier === 'promoted' && data.gumletAssetId;
  const ctaLabel = isFree ? 'Register for free' : `Buy ticket — ₹${data.ticketPrice}`;
  const emailMismatch = user?.email && purchaseEmail
    && user.email.toLowerCase() !== purchaseEmail.toLowerCase();

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>LIVE WEBINAR</Text>
              </View>
              <Text style={styles.title}>{data.title}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {isFree ? (
                <Text style={styles.priceFree}>Free</Text>
              ) : (
                <Text style={styles.pricePaid}>₹{data.ticketPrice}</Text>
              )}
              <Text style={styles.priceMeta}>per attendee</Text>
            </View>
          </View>

          {!!data.description && (
            <Text style={styles.description}>{data.description}</Text>
          )}

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>When</Text>
              <Text style={styles.metaValue}>{formatDateIST(data.scheduledStartTime)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>
                {data.scheduledDurationMinutes ? `${data.scheduledDurationMinutes} min` : '—'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Recording</Text>
              <Text style={styles.metaValue}>
                {data.recordingEnabled ? 'Available afterwards' : 'Live only'}
              </Text>
            </View>
          </View>

          {!showJoinFlow && !isEnded && !isVod && (
            <View style={{ marginTop: 24 }}>
              <TouchableOpacity
                onPress={() => setBuyOpen(true)}
                style={[styles.buyBtn, { backgroundColor: accent }]}
              >
                <Text style={styles.buyBtnText}>{ctaLabel}</Text>
              </TouchableOpacity>
              <Text style={styles.buyMeta}>
                You'll get a confirmation email and reminders 24h, 1h, 15 min, and 1 min before the class starts.
              </Text>
            </View>
          )}

          {isEnded && !isVod && (
            <View style={styles.endedBox}>
              <Text style={styles.endedText}>
                This webinar has ended. {data.recordingEnabled
                  ? 'A recording may be published shortly.'
                  : 'No recording was made.'}
              </Text>
            </View>
          )}

          {(showJoinFlow || isVod) && (
            <View style={{ marginTop: 20 }}>
              {!user && (
                <View style={styles.signInBox}>
                  <Text style={styles.signInText}>
                    {purchaseEmail
                      ? `Sign in as ${purchaseEmail} to join the live class.`
                      : 'Sign in with the email you used to register to join the live class.'}
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={[styles.signInLink, { color: accent }]}>Sign in →</Text>
                  </TouchableOpacity>
                </View>
              )}
              {user && emailMismatch && (
                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>
                    You're signed in as {user.email} but registered as {purchaseEmail}. Either sign out and sign in with the registered email, or register again with this account below.
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      // Clear the stale purchase state so handlePurchased
                      // can land cleanly, then reopen the sheet — it will
                      // pre-fill + lock the email to user.email.
                      setPurchaseEmail('');
                      setShowJoinFlow(false);
                      setBuyOpen(true);
                    }}
                    style={[styles.warnCta, { borderColor: accent }]}
                  >
                    <Text style={[styles.warnCtaText, { color: accent }]}>
                      Register with this account instead
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {user && !emailMismatch && (
                <LiveRoomLazy
                  lesson={{
                    _id: data.lessonId,
                    type: 'live',
                    title: data.title,
                    scheduledStartTime: data.scheduledStartTime,
                    scheduledDurationMinutes: data.scheduledDurationMinutes,
                    liveStartedAt: data.liveStartedAt,
                    liveEndedAt: data.liveEndedAt,
                  }}
                  courseId={data.courseId}
                  host={false}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <BuyWebinarTicketSheet
        visible={buyOpen}
        onClose={() => setBuyOpen(false)}
        lesson={data}
        onPurchased={handlePurchased}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 16, maxWidth: 360 },
  errorTitle: { color: '#991b1b', fontSize: 14, fontWeight: '700' },
  errorBody: { color: '#991b1b', fontSize: 12, marginTop: 6 },
  card: { backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 8, padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tagBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#fef3c7', marginBottom: 8 },
  tagBadgeText: { color: '#b45309', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  priceFree: { fontSize: 22, fontWeight: '700', color: '#15803d' },
  pricePaid: { fontSize: 22, fontWeight: '700', color: '#111827' },
  priceMeta: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  description: { color: '#374151', marginTop: 14, lineHeight: 20, fontSize: 14 },
  metaGrid: { flexDirection: 'row', marginTop: 18, flexWrap: 'wrap' },
  metaItem: { width: '33.333%', paddingRight: 8, marginBottom: 8 },
  metaLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6 },
  metaValue: { fontSize: 13, color: '#1f2937', fontWeight: '500', marginTop: 2 },
  buyBtn: { paddingVertical: 14, borderRadius: 6, alignItems: 'center' },
  buyBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  buyMeta: { fontSize: 11, color: '#6b7280', marginTop: 10, textAlign: 'center' },
  endedBox: { marginTop: 20, backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 8, padding: 12 },
  endedText: { color: '#92400e', fontSize: 13 },
  signInBox: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 8, padding: 12 },
  signInText: { color: '#1e40af', fontSize: 13 },
  signInLink: { marginTop: 6, fontWeight: '600' },
  warnBox: { backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, borderRadius: 8, padding: 12 },
  warnText: { color: '#92400e', fontSize: 12 },
  warnCta: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, backgroundColor: '#ffffff' },
  warnCtaText: { fontSize: 12, fontWeight: '600' },
  liveRoomPlaceholder: { padding: 16, backgroundColor: '#f3f4f6', borderRadius: 8, alignItems: 'center' },
  liveRoomPlaceholderText: { color: '#374151', fontSize: 13, textAlign: 'center' },
  notAvailableBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', padding: 24 },
  notAvailableTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  notAvailableBody: { color: '#6b7280', fontSize: 13, marginTop: 8, textAlign: 'center' },
});
