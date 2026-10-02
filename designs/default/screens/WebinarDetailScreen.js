import React from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {designColor} from '../../../src/design/literalTokens';

const formatDateIST = iso => {
  if (!iso) return 'TBA';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'TBA';
    return `${date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })} IST`;
  } catch {
    return 'TBA';
  }
};

const WebinarDetailScreen = ({viewModel, actions, slots}) => {
  const {
    enabled,
    accent,
    loading,
    error,
    data,
    user,
    buyOpen,
    showJoinFlow,
    purchaseEmail,
    joinToken,
    isFree,
    isEnded,
    isVod,
    ctaLabel,
    emailMismatch,
  } = viewModel;
  const {LiveRoom, BuyTicketSheet} = slots;

  if (!enabled) {
    return (
      <View style={styles.notAvailableBox}>
        <Text style={styles.notAvailableTitle}>Not available</Text>
        <Text style={styles.notAvailableBody}>Webinars are not enabled for this manager.</Text>
      </View>
    );
  }
  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} /></View>;
  if (error || !data) {
    return (
      <View style={styles.center}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn&apos;t load this webinar</Text>
          <Text style={styles.errorBody}>{error || 'Unknown error'}</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.titleColumn}>
              <View style={styles.tagBadge}><Text style={styles.tagBadgeText}>LIVE WEBINAR</Text></View>
              <Text style={styles.title}>{data.title}</Text>
            </View>
            <View style={styles.priceColumn}>
              <Text style={isFree ? styles.priceFree : styles.pricePaid}>{isFree ? 'Free' : `₹${data.ticketPrice}`}</Text>
              <Text style={styles.priceMeta}>per attendee</Text>
            </View>
          </View>
          {!!data.description && <Text style={styles.description}>{data.description}</Text>}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>When</Text>
              <Text style={styles.metaValue}>{formatDateIST(data.scheduledStartTime)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>{data.scheduledDurationMinutes ? `${data.scheduledDurationMinutes} min` : '—'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Recording</Text>
              <Text style={styles.metaValue}>{data.recordingEnabled ? 'Available afterwards' : 'Live only'}</Text>
            </View>
          </View>
          {!showJoinFlow && !isEnded && !isVod && (
            <View style={styles.actionSection}>
              <TouchableOpacity onPress={actions.onOpenPurchase} style={[styles.buyBtn, {backgroundColor: accent}]}>
                <Text style={styles.buyBtnText}>{ctaLabel}</Text>
              </TouchableOpacity>
              <Text style={styles.buyMeta}>You&apos;ll get a confirmation email and reminders 24h, 1h, 15 min, and 1 min before the class starts.</Text>
            </View>
          )}
          {isEnded && !isVod && (
            <View style={styles.endedBox}>
              <Text style={styles.endedText}>This webinar has ended. {data.recordingEnabled ? 'A recording may be published shortly.' : 'No recording was made.'}</Text>
            </View>
          )}
          {(showJoinFlow || isVod) && (
            <View style={styles.joinSection}>
              {!user && !joinToken && (
                <View style={styles.signInBox}>
                  <Text style={styles.signInText}>{purchaseEmail ? `Sign in as ${purchaseEmail} to join the live class.` : 'Sign in with the email you used to register to join the live class.'}</Text>
                  <TouchableOpacity onPress={actions.onSignIn}><Text style={[styles.signInLink, {color: accent}]}>Sign in →</Text></TouchableOpacity>
                </View>
              )}
              {user && emailMismatch && !joinToken && (
                <View style={styles.warnBox}>
                  <Text style={styles.warnText}>You&apos;re signed in as {user.email} but registered as {purchaseEmail}. Either sign out and sign in with the registered email, or register again with this account below.</Text>
                  <TouchableOpacity onPress={actions.onRegisterCurrentAccount} style={[styles.warnCta, {borderColor: accent}]}>
                    <Text style={[styles.warnCtaText, {color: accent}]}>Register with this account instead</Text>
                  </TouchableOpacity>
                </View>
              )}
              {(joinToken || (user && !emailMismatch)) && (
                <LiveRoom
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
                  joinToken={joinToken}
                  actions={{onRequestJoinUrl: actions.onRequestJoinUrl}}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
      <BuyTicketSheet visible={buyOpen} onClose={actions.onClosePurchase} lesson={data} onPurchased={actions.onPurchased} />
    </>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: designColor('f9fafb')},
  content: {padding: 16, paddingBottom: 40},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16},
  errorBox: {backgroundColor: designColor('fef2f2'), borderColor: designColor('fecaca'), borderWidth: 1, borderRadius: 8, padding: 16, maxWidth: 360},
  errorTitle: {color: designColor('991b1b'), fontSize: 14, fontWeight: '700'},
  errorBody: {color: designColor('991b1b'), fontSize: 12, marginTop: 6},
  card: {backgroundColor: designColor('ffffff'), borderColor: designColor('e5e7eb'), borderWidth: 1, borderRadius: 8, padding: 20},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  titleColumn: {flex: 1},
  priceColumn: {alignItems: 'flex-end'},
  tagBadge: {alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: designColor('fef3c7'), marginBottom: 8},
  tagBadgeText: {color: designColor('b45309'), fontSize: 10, fontWeight: '700', letterSpacing: 0.6},
  title: {fontSize: 22, fontWeight: '700', color: designColor('111827')},
  priceFree: {fontSize: 22, fontWeight: '700', color: designColor('15803d')},
  pricePaid: {fontSize: 22, fontWeight: '700', color: designColor('111827')},
  priceMeta: {fontSize: 10, color: designColor('9ca3af'), marginTop: 2},
  description: {color: designColor('374151'), marginTop: 14, lineHeight: 20, fontSize: 14},
  metaGrid: {flexDirection: 'row', marginTop: 18, flexWrap: 'wrap'},
  metaItem: {width: '33.333%', paddingRight: 8, marginBottom: 8},
  metaLabel: {fontSize: 10, color: designColor('9ca3af'), textTransform: 'uppercase', letterSpacing: 0.6},
  metaValue: {fontSize: 13, color: designColor('1f2937'), fontWeight: '500', marginTop: 2},
  actionSection: {marginTop: 24},
  buyBtn: {paddingVertical: 14, borderRadius: 6, alignItems: 'center'},
  buyBtnText: {color: designColor('ffffff'), fontWeight: '700', fontSize: 15},
  buyMeta: {fontSize: 11, color: designColor('6b7280'), marginTop: 10, textAlign: 'center'},
  endedBox: {marginTop: 20, backgroundColor: designColor('fef3c7'), borderColor: designColor('fde68a'), borderWidth: 1, borderRadius: 8, padding: 12},
  endedText: {color: designColor('92400e'), fontSize: 13},
  joinSection: {marginTop: 20},
  signInBox: {backgroundColor: designColor('eff6ff'), borderColor: designColor('bfdbfe'), borderWidth: 1, borderRadius: 8, padding: 12},
  signInText: {color: designColor('1e40af'), fontSize: 13},
  signInLink: {marginTop: 6, fontWeight: '600'},
  warnBox: {backgroundColor: designColor('fef3c7'), borderColor: designColor('fde68a'), borderWidth: 1, borderRadius: 8, padding: 12},
  warnText: {color: designColor('92400e'), fontSize: 12},
  warnCta: {marginTop: 10, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, backgroundColor: designColor('ffffff')},
  warnCtaText: {fontSize: 12, fontWeight: '600'},
  notAvailableBox: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: designColor('f9fafb'), padding: 24},
  notAvailableTitle: {fontSize: 18, fontWeight: '700', color: designColor('1f2937')},
  notAvailableBody: {color: designColor('6b7280'), fontSize: 13, marginTop: 8, textAlign: 'center'},
});

export default WebinarDetailScreen;
