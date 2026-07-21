/**
 * LiveRoom — composites.LiveRoom — viewer surface for LiveKit live classes.
 *
 * STATUS: LIVE (WebView bridge). The live class renders by loading the
 * existing web webinar room page inside a react-native-webview — the
 * browser's WebRTC stack runs LiveKit, so we DON'T install native LiveKit
 * deps. On "Join" we ask the backend for a short-lived magic join URL
 * (`POST /api/livekit/join-url/:lessonId`, Firebase + verifyEnrollment),
 * then load `https://<advisor>.alphaquark.in/webinar/<id>?joinToken=…` in a
 * full-screen Modal WebView. The web page's full-viewport overlay handles
 * the room + chat; viewers are subscribe-only (no camera/mic), so no media
 * permissions are required.
 *
 * This composite:
 *   - Shows a countdown until T-10min before scheduledStartTime.
 *   - From T-10min (or once live) shows a Join button → fetches the join
 *     URL → opens the full-screen WebView room.
 *   - On scheduledEndTime + duration grace, shows "This class has ended"
 *     (a promoted VOD replay plays via composites.GumletPlayer instead).
 *
 * joinToken prop: when the screen arrives via a magic-link deep link it can
 * pass a joinToken through; today the Firebase /join-url path is the live
 * one (the deep-link source isn't wired — see porting §4.2.1).
 *
 * Option A (alternative): NATIVE LiveKit via @livekit/react-native. Not
 * used — the WebView bridge avoids the native build. The native activation
 * snippet is preserved at the bottom of this file for a future upgrade.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.2.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import liveKitService from '../../../src/FunctionCall/services/LiveKitService';

const JOIN_GATE_MS = 10 * 60 * 1000; // T-10min

function useCountdown(targetIso) {
  const target = useMemo(() => {
    if (!targetIso) return null;
    const t = new Date(targetIso).getTime();
    return Number.isFinite(t) ? t : null;
  }, [targetIso]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);
  if (!target) return { msToStart: null, label: 'TBA' };
  const diff = target - now;
  if (diff <= 0) return { msToStart: 0, label: 'Starting now' };
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return { msToStart: diff, label: `${d}d ${h}h ${m}m` };
  if (h > 0) return { msToStart: diff, label: `${h}h ${m}m ${s}s` };
  if (m > 0) return { msToStart: diff, label: `${m}m ${s}s` };
  return { msToStart: diff, label: `${s}s` };
}

export default function LiveRoom({ lesson, courseId, host = false, joinToken = null }) {
  const [joinUrl, setJoinUrl] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [joining, setJoining] = useState(false);

  const { msToStart, label } = useCountdown(lesson?.scheduledStartTime);
  const scheduledEnd = useMemo(() => {
    if (!lesson?.scheduledStartTime || !lesson?.scheduledDurationMinutes) return null;
    const start = new Date(lesson.scheduledStartTime).getTime();
    return start + lesson.scheduledDurationMinutes * 60 * 1000;
  }, [lesson?.scheduledStartTime, lesson?.scheduledDurationMinutes]);
  const isPastEnd = scheduledEnd && Date.now() > scheduledEnd;
  const isLive = !!lesson?.liveStartedAt && !lesson?.liveEndedAt;
  const isEnded = !!lesson?.liveEndedAt || isPastEnd;
  const joinUnlocked = isLive || (msToStart != null && msToStart <= JOIN_GATE_MS);

  async function handleJoin() {
    if (!lesson?._id || !courseId) return;
    setJoining(true);
    setTokenError(null);
    try {
      // Ask the backend for the web join URL (server mints a magic
      // joinToken for the signed-in enrolled user + builds the per-advisor
      // URL). The WebView then renders the LiveKit room via browser WebRTC.
      const url = await liveKitService.getJoinUrl(lesson._id, courseId);
      if (!url) throw new Error('Could not get a join link');
      setJoinUrl(url);
    } catch (e) {
      setTokenError(e?.response?.data?.message || e?.message || 'Could not join');
    } finally {
      setJoining(false);
    }
  }

  if (isEnded) {
    return (
      <View style={styles.box}>
        <Text style={styles.bigLabel}>This class has ended</Text>
        {!!lesson?.scheduledStartTime && (
          <Text style={styles.smallMeta}>
            Started {new Date(lesson.scheduledStartTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </Text>
        )}
      </View>
    );
  }

  if (joinUrl) {
    return (
      <LiveRoomWebView
        lesson={lesson}
        url={joinUrl}
        onClose={() => setJoinUrl(null)}
      />
    );
  }

  return (
    <View style={styles.box}>
      {isLive ? (
        <Text style={styles.liveBadge}>LIVE NOW</Text>
      ) : (
        <Text style={styles.label}>Live class starts in</Text>
      )}
      {!isLive && <Text style={styles.bigLabel}>{label}</Text>}
      {!!tokenError && <Text style={styles.errorText}>{tokenError}</Text>}
      {joinUnlocked ? (
        <TouchableOpacity onPress={handleJoin} style={styles.joinBtn} disabled={joining}>
          {joining
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.joinBtnText}>{isLive ? 'Join now' : 'Join early'}</Text>}
        </TouchableOpacity>
      ) : (
        <Text style={styles.smallMeta}>Join button will appear 10 minutes before start.</Text>
      )}
    </View>
  );
}

// LiveRoomWebView — full-screen live room via the web webinar page.
//
// SIZING CONTRACT (parity with web courseDetailsPage.js / WebinarDetailPage
// 2026-06-19 full-viewport fix): the live class presents in a FULL-SCREEN
// Modal with a slim dark header (title + Close) and a flex:1 WebView body,
// so the room fills the device screen — NOT a small panel buried in the
// detail screen's ScrollView.
//
// The WebView loads the per-advisor web join URL; the web page's own
// full-viewport overlay renders the LiveKit room via the device browser's
// WebRTC. Viewers are subscribe-only (no getUserMedia), so no camera/mic
// permission prompts are triggered. `mediaPlaybackRequiresUserAction=false`
// + `allowsInlineMediaPlayback` let remote audio/video autoplay inline.
function LiveRoomWebView({ lesson, url, onClose }) {
  const [loading, setLoading] = useState(true);
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {lesson?.title || 'Live class'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose} accessibilityLabel="Close live class">
            <Text style={styles.modalCloseText}>✕  Close</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.roomBody}>
          <WebView
            source={{ uri: url }}
            style={styles.web}
            originWhitelist={['https://*']}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            // iOS WKWebView: let the LiveKit room reach the signalling +
            // media servers without app-bound-domain restriction.
            limitsNavigationsToAppBoundDomains={false}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          {loading && (
            <View style={styles.webLoading} pointerEvents="none">
              <ActivityIndicator color="#ffffff" />
              <Text style={[styles.smallMetaOnDark, { marginTop: 10 }]}>Joining live class…</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#f3f4f6', borderRadius: 8, padding: 20, alignItems: 'center' },
  label: { color: '#374151', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  bigLabel: { color: '#111827', fontSize: 22, fontWeight: '700', marginTop: 6 },
  liveBadge: { color: '#dc2626', fontSize: 14, fontWeight: '700', letterSpacing: 0.8 },
  smallMeta: { color: '#6b7280', fontSize: 12, marginTop: 10, textAlign: 'center' },
  errorText: { color: '#991b1b', marginTop: 10, fontSize: 12 },
  joinBtn: { backgroundColor: '#d97706', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 6, marginTop: 14 },
  joinBtnText: { color: '#ffffff', fontWeight: '700' },
  // Full-screen live-room presentation (parity with web full-viewport fix).
  modalRoot: { flex: 1, backgroundColor: '#000000' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#111827', borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  modalTitle: { color: '#f3f4f6', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 12 },
  modalClose: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  modalCloseText: { color: '#d1d5db', fontSize: 13, fontWeight: '600' },
  roomBody: { flex: 1, backgroundColor: '#000000' },
  web: { flex: 1, backgroundColor: '#000000' },
  webLoading: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000000',
  },
  smallMetaOnDark: { color: '#9ca3af', fontSize: 12, marginTop: 10, textAlign: 'center' },
});

/* =========================================================================
 * OPTION A (alternative) — NATIVE LiveKit. The live room currently renders
 * via the WebView bridge (LiveRoomWebView) above, which needs no native
 * deps. If you later want a native room (background audio, PiP), install
 * @livekit/react-native + @livekit/react-native-webrtc + livekit-client and
 * replace LiveRoomWebView with the snippet below (it uses
 * liveKitService.getViewerToken / getViewerToken({joinToken}) instead of
 * getJoinUrl). Keep the full-screen Modal + header wrapper. See porting
 * doc §4.2.1 for the full native-build runbook.
 * =========================================================================
 *
 * import {
 *   LiveKitRoom,
 *   AudioSession,
 *   useTracks,
 *   VideoTrack,
 * } from '@livekit/react-native';
 * import { Track } from 'livekit-client';
 *
 * function LiveRoomActive({ lesson, bundle, host, onClose }) {
 *   useEffect(() => {
 *     AudioSession.startAudioSession();
 *     return () => { AudioSession.stopAudioSession(); };
 *   }, []);
 *   // Keep the full-screen Modal + header wrapper (styles.modalRoot /
 *   // modalHeader / roomBody). Only the roomBody contents change — the
 *   // LiveKitRoom fills the flex:1 body so the video is full-screen, NOT a
 *   // fixed 360px panel (parity with the web 2026-06-19 full-viewport fix).
 *   return (
 *     <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
 *       <View style={styles.modalRoot}>
 *         <View style={styles.modalHeader}>
 *           <Text style={styles.modalTitle} numberOfLines={1}>{lesson?.title || 'Live class'}</Text>
 *           <TouchableOpacity onPress={onClose} style={styles.modalClose}>
 *             <Text style={styles.modalCloseText}>✕  Close</Text>
 *           </TouchableOpacity>
 *         </View>
 *         <View style={styles.roomBody}>
 *           <LiveKitRoom
 *             serverUrl={bundle.url}
 *             token={bundle.token}
 *             connect
 *             audio={host}
 *             video={host}
 *             style={{ flex: 1, width: '100%' }}
 *           >
 *             <RoomBody />
 *           </LiveKitRoom>
 *         </View>
 *       </View>
 *     </Modal>
 *   );
 * }
 *
 * function RoomBody() {
 *   const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
 *   return (
 *     <View style={{ flex: 1 }}>
 *       {tracks.map((t) => (
 *         <VideoTrack
 *           key={t.publication.trackSid}
 *           trackRef={t}
 *           style={{ flex: 1 }}
 *         />
 *       ))}
 *     </View>
 *   );
 * }
 */
