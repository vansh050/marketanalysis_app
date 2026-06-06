/**
 * LiveRoom — composites.LiveRoom — viewer surface for LiveKit live classes.
 *
 * STATUS: PLACEHOLDER. The @livekit/react-native + livekit-client packages
 * are NOT yet installed in this repo. Once they are, replace the body of
 * `LiveRoomActive` with the LiveKitRoom block in the comment at the
 * bottom of this file.
 *
 * Until then this composite:
 *   - Fetches the viewer token (which validates server-side enrollment).
 *   - Shows a countdown until T-10min before scheduledStartTime.
 *   - From T-10min onwards shows a "Class will appear here once you tap
 *     Join" CTA (which currently shows an alert; the real Join wires up
 *     to LiveKitRoom in the activation step).
 *   - On scheduledEndTime + duration grace, shows "This class has ended".
 *
 * The T-10min gate, error states, and AudioSession lifecycle are part of
 * the contract — preserve them when activating.
 *
 * To activate (single-file change):
 *   1. yarn add @livekit/react-native @livekit/react-native-webrtc livekit-client
 *   2. cd ios && pod install
 *   3. Replace `LiveRoomActive` body with the commented snippet at file end.
 *   4. iOS Info.plist: NSCameraUsageDescription, NSMicrophoneUsageDescription,
 *      UIBackgroundModes: [audio, voip].
 *   5. AndroidManifest.xml: RECORD_AUDIO, CAMERA, MODIFY_AUDIO_SETTINGS,
 *      BLUETOOTH, BLUETOOTH_CONNECT, INTERNET.
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
  Alert,
} from 'react-native';
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

export default function LiveRoom({ lesson, courseId, host = false }) {
  const [tokenBundle, setTokenBundle] = useState(null);
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
      const bundle = await liveKitService.getViewerToken(lesson._id, courseId);
      setTokenBundle(bundle);
      // Once @livekit/react-native is installed, the `LiveRoomActive`
      // block below will render the LiveKitRoom against this bundle.
      // For now we surface success so the operator can validate the
      // token round-trip without a native dependency.
      Alert.alert(
        'Live class ready',
        'LiveKit native client is not installed yet. See LiveRoom.js header for activation steps.',
      );
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

  if (tokenBundle) {
    return <LiveRoomActive lesson={lesson} bundle={tokenBundle} host={host} />;
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

// Placeholder body — see the comment block at the bottom of the file
// for the @livekit/react-native version to drop in once installed.
function LiveRoomActive({ lesson, bundle, host }) {
  return (
    <View style={styles.box}>
      <Text style={styles.bigLabel}>Live class ready</Text>
      <Text style={styles.smallMeta}>Token: {bundle?.token?.slice(0, 12)}… (ttl {bundle?.ttlSeconds}s)</Text>
      <Text style={[styles.smallMeta, { marginTop: 8 }]}>
        Install @livekit/react-native + react-native-webrtc to render the actual room.
      </Text>
    </View>
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
});

/* =========================================================================
 * ACTIVATION SNIPPET — paste in place of LiveRoomActive after installing
 * @livekit/react-native + @livekit/react-native-webrtc + livekit-client.
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
 * function LiveRoomActive({ lesson, bundle, host }) {
 *   useEffect(() => {
 *     AudioSession.startAudioSession();
 *     return () => { AudioSession.stopAudioSession(); };
 *   }, []);
 *   return (
 *     <View style={{ width: '100%', height: 360 }}>
 *       <LiveKitRoom
 *         serverUrl={bundle.url}
 *         token={bundle.token}
 *         connect
 *         audio={host}
 *         video={host}
 *       >
 *         <RoomBody />
 *       </LiveKitRoom>
 *     </View>
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
