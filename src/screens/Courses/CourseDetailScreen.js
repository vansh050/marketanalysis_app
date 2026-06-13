/**
 * CourseDetailScreen — course header + modules + lesson list.
 *
 * Renders the course returned by GET /api/gumlet/collections/:courseId.
 * Modules are collapsible. Tapping a video lesson:
 *   1. Calls GumletService.getPlaybackToken(lessonId, courseId) (Firebase
 *      Bearer; server-side verifyEnrollment).
 *   2. On success — renders the composites.GumletPlayer with the
 *      returned embedUrl.
 *   3. On 403 — shows "Enroll to watch" (Phase 3 wires the purchase CTA).
 *   4. On 503 — shows "Video still processing" + retry.
 *   5. On 401 — prompts sign-in.
 *
 * Lesson comments, attachments, reviews UI are out of scope for v1 — see
 * docs §5 / §6 Phase plan.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.5.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { useConfig } from '../../context/ConfigContext';
import { useDesign } from '../../design/useDesign';
import gumletService from '../../FunctionCall/services/GumletService';
import CoursePurchaseSheet from '../../components/CoursePurchaseSheet';

function GumletPlayerLazy(props) {
  const design = useDesign();
  const Cmp = design?.components?.['composites.GumletPlayer'];
  if (!Cmp) {
    return (
      <View style={styles.playerPlaceholder}>
        <Text style={styles.playerPlaceholderText}>
          Player module not registered. See COURSES_WEBINARS_MOBILE_PORTING.md §4.5.
        </Text>
      </View>
    );
  }
  return <Cmp {...props} />;
}

function ModuleAccordion({ module, isOpen, onToggle, onLessonPress, activeLessonId, accent }) {
  return (
    <View style={styles.module}>
      <TouchableOpacity onPress={onToggle} style={styles.moduleHeader} activeOpacity={0.7}>
        <Text style={styles.moduleTitle}>{module.title}</Text>
        <Text style={styles.moduleChevron}>{isOpen ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {isOpen && (module.lessons || []).map((lesson) => {
        const isActive = activeLessonId === lesson._id;
        const isLocked = lesson.status !== 'ready' && !lesson.isPreview;
        return (
          <TouchableOpacity
            key={lesson._id}
            onPress={() => onLessonPress(lesson)}
            style={[styles.lessonRow, isActive && { backgroundColor: accent + '12' }]}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.lessonTitle, isActive && { color: accent, fontWeight: '700' }]}>
                {lesson.title}
              </Text>
              <View style={styles.lessonMetaRow}>
                {lesson.type === 'live' && <Text style={styles.lessonBadge}>LIVE</Text>}
                {lesson.isPreview && <Text style={styles.lessonBadgePreview}>PREVIEW</Text>}
                {!!lesson.duration && <Text style={styles.lessonMeta}>{lesson.duration} min</Text>}
                {isLocked && <Text style={styles.lessonMetaWarn}>processing…</Text>}
              </View>
            </View>
            <Text style={[styles.lessonPlayIcon, isActive && { color: accent }]}>▶</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function CourseDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { courseId } = route.params || {};
  const config = useConfig();
  const accent = config?.mainColor || config?.themeColor || '#16a34a';

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openModuleIds, setOpenModuleIds] = useState(new Set());
  const [activeLesson, setActiveLesson] = useState(null);
  const [playback, setPlayback] = useState(null);
  const [playbackError, setPlaybackError] = useState('');
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  // Enrollment state — flipped true by fetchClientCourseDetails when the
  // user has an active CourseClientList row within the validity window.
  // Without this query the CTA stays as "Get free access" / "Enroll now"
  // forever, even after the user successfully enrolled. Mirrors web
  // courseDetailsPage.js `isPurchased`.
  const [isPurchased, setIsPurchased] = useState(false);
  const [user, setUser] = useState(() => getAuth().currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => setUser(u));
    return () => { if (unsub) unsub(); };
  }, []);

  const fetchCourse = useCallback(async () => {
    if (!courseId) { setError('Missing courseId'); setLoading(false); return; }
    setLoading(true);
    try {
      const result = await gumletService.getCourse(courseId);
      if (result?.success) {
        const c = result.data;
        setCourse(c);
        const firstId = c?.modules?.[0]?._id;
        if (firstId) setOpenModuleIds(new Set([firstId]));
        setError('');
      } else {
        setError(result?.message || 'Course not found');
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  // Enrollment lookup — mirrors web courseDetailsPage.fetchClientCourseDetails.
  // 404 = not enrolled (expected). Anything else: stay un-purchased.
  const fetchClientCourse = useCallback(async () => {
    const userEmail = user?.email;
    if (!userEmail || !course?._id) return;
    try {
      const res = await gumletService.getClientCourseDetails(userEmail, course._id);
      const data = res?.data;
      if (!data) { setIsPurchased(false); return; }
      const today = new Date();
      const start = data?.course?.startDate ? new Date(data.course.startDate) : null;
      const end = data?.course?.endDate ? new Date(data.course.endDate) : null;
      const active = (!start || today >= start) && (!end || today <= end);
      setIsPurchased(!!active);
      // Once enrolled, expand every module so the user lands on a
      // browseable curriculum (parity with web courseDetailsPage:530).
      if (active && Array.isArray(course?.modules)) {
        setOpenModuleIds(new Set(course.modules.map((m) => m._id)));
      }
    } catch (e) {
      // 404 = no enrollment row → un-purchased. Any other failure: stay
      // un-purchased; the user can still tap "Get free access" to enroll.
      setIsPurchased(false);
    }
  }, [user?.email, course?._id, course?.modules]);

  useEffect(() => { fetchClientCourse(); }, [fetchClientCourse]);

  const toggleModule = (moduleId) => {
    setOpenModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId);
      return next;
    });
  };

  const handleLessonPress = useCallback(async (lesson) => {
    // Live lesson — bypass the VOD playback-token path and open the
    // per-lesson WebinarDetail screen. That screen owns the
    // pre-live countdown, the LiveRoom join flow, and the post-end
    // replay messaging (parity with web courseDetailsPage.js:83 — web
    // sets `selectedLesson` and renders <LiveRoom /> inline; mobile
    // routes to its dedicated WebinarDetailScreen instead since the
    // course screen doesn't host a LiveRoom slot today). The previous
    // behaviour — a generic "Live class" Alert for every live lesson
    // — meant every webinar inside the auto-managed Webinars
    // container felt identical and unclickable.
    //
    // Exception: if the live session has been promoted to VOD
    // (gumletAssetId set), play it inline as a regular VOD instead —
    // the live is over and the replay is what the viewer wants.
    if (lesson.type === 'live' && !lesson.gumletAssetId) {
      navigation.navigate('WebinarDetail', { lessonId: lesson._id });
      return;
    }
    if (lesson.status !== 'ready' && !lesson.isPreview) {
      Alert.alert('Still processing', 'This lesson is still being prepared. Please try again shortly.');
      return;
    }
    setActiveLesson(lesson);
    setPlayback(null);
    setPlaybackError('');
    setPlaybackLoading(true);
    try {
      const bundle = await gumletService.getPlaybackToken(lesson._id, courseId);
      setPlayback(bundle);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        setPlaybackError('Please sign in to watch this lesson.');
      } else if (status === 403) {
        setPlaybackError('Enroll in this course to watch.');
      } else if (status === 503) {
        setPlaybackError('Video is still being processed. Try again shortly.');
      } else {
        setPlaybackError(e?.response?.data?.message || e?.message || 'Could not load video');
      }
    } finally {
      setPlaybackLoading(false);
    }
  }, [courseId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }
  if (error || !course) {
    return (
      <View style={styles.center}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn't load this course</Text>
          <Text style={styles.errorBody}>{error || 'Unknown error'}</Text>
          <TouchableOpacity onPress={fetchCourse} style={[styles.retryBtn, { backgroundColor: accent }]}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasThumb = course.thumbnailUrl && String(course.thumbnailUrl).trim() !== '';

  return (
    <>
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {hasThumb && (
        <Image source={{ uri: course.thumbnailUrl }} style={styles.heroThumb} resizeMode="cover" />
      )}
      <View style={styles.headerCard}>
        <Text style={styles.title}>{course.title}</Text>
        {!!course.description && (
          <Text style={styles.description}>{course.description}</Text>
        )}
        <View style={styles.headerMetaRow}>
          {!!course.level && <Text style={styles.headerMetaItem}>{course.level}</Text>}
          {!!course.duration && <Text style={styles.headerMetaItem}>⏱ {course.duration} hrs</Text>}
          {Array.isArray(course.modules) && (
            <Text style={styles.headerMetaItem}>{course.modules.length} modules</Text>
          )}
        </View>
        <View style={styles.enrollRow}>
          <View style={{ flex: 1 }}>
            {Number(course.price) > 0 ? (
              <>
                <Text style={styles.priceLabel}>Price</Text>
                <Text style={styles.priceValue}>₹{Number(course.price).toLocaleString()}</Text>
              </>
            ) : (
              <Text style={styles.priceFree}>Free</Text>
            )}
            {!!course.validityDurationDays && (
              <Text style={styles.priceMeta}>{course.validityDurationDays}-day access</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              if (isPurchased) return;
              setPurchaseOpen(true);
            }}
            disabled={isPurchased}
            activeOpacity={isPurchased ? 1 : 0.7}
            style={[
              styles.enrollBtn,
              { backgroundColor: isPurchased ? '#9ca3af' : accent },
            ]}
          >
            <Text style={styles.enrollBtnText}>
              {isPurchased
                ? 'Purchased'
                : Number(course.price) > 0
                  ? 'Enroll now'
                  : 'Get free access'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeLesson && (
        <View style={styles.playerCard}>
          <Text style={styles.playerLabel}>Now playing</Text>
          <Text style={styles.playerLessonTitle}>{activeLesson.title}</Text>
          {playbackLoading && (
            <View style={styles.playerLoading}><ActivityIndicator color={accent} /></View>
          )}
          {!!playbackError && (
            <View style={styles.playbackErrorBox}>
              <Text style={styles.playbackErrorText}>{playbackError}</Text>
              {playbackError.startsWith('Please sign in') && (
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={[styles.playbackErrorLink, { color: accent }]}>Sign in →</Text>
                </TouchableOpacity>
              )}
              {playbackError.startsWith('Enroll') && (
                <TouchableOpacity onPress={() => setPurchaseOpen(true)}>
                  <Text style={[styles.playbackErrorLink, { color: accent }]}>Enroll now →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {!playbackLoading && !playbackError && playback && (
            <GumletPlayerLazy
              lesson={activeLesson}
              playback={playback}
            />
          )}
        </View>
      )}

      <View style={styles.modulesSection}>
        <Text style={styles.modulesHeading}>Course content</Text>
        {Array.isArray(course.modules) && course.modules.length > 0
          ? course.modules.map((m) => (
              <ModuleAccordion
                key={m._id}
                module={m}
                isOpen={openModuleIds.has(m._id)}
                onToggle={() => toggleModule(m._id)}
                onLessonPress={handleLessonPress}
                activeLessonId={activeLesson?._id}
                accent={accent}
              />
            ))
          : <Text style={styles.emptyText}>No modules yet.</Text>}
      </View>
    </ScrollView>
    <CoursePurchaseSheet
      visible={purchaseOpen}
      onClose={() => setPurchaseOpen(false)}
      course={course}
      onPurchased={(result) => {
        setPurchaseOpen(false);
        // Refresh course (no per-user enrollment state on the public
        // course payload, but the playback-token retry below picks up
        // the new enrollment when the user taps the lesson again).
        fetchCourse();
        // Re-query the per-user enrollment so the CTA flips to
        // "Purchased". Without this the same "Get free access" /
        // "Enroll now" stays put even after a successful enrollment
        // write.
        fetchClientCourse();
        // If a lesson was already active and stuck on a 403, clear the
        // error so the next tap re-runs getPlaybackToken.
        if (playbackError) {
          setPlaybackError('');
          setActiveLesson(null);
        }
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#f9fafb' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 16, maxWidth: 360, alignItems: 'center' },
  errorTitle: { color: '#991b1b', fontSize: 14, fontWeight: '700' },
  errorBody: { color: '#991b1b', fontSize: 12, marginTop: 6, textAlign: 'center' },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 6 },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  heroThumb: { width: '100%', height: 200, backgroundColor: '#e5e7eb' },
  headerCard: { backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderBottomWidth: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  description: { fontSize: 14, color: '#374151', marginTop: 8, lineHeight: 20 },
  headerMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  headerMetaItem: { fontSize: 12, color: '#6b7280', marginRight: 16, marginBottom: 4 },
  enrollRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6', flexDirection: 'row', alignItems: 'center' },
  priceLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6 },
  priceValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 2 },
  priceFree: { fontSize: 20, fontWeight: '700', color: '#15803d' },
  priceMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  enrollBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6 },
  enrollBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  playerCard: { backgroundColor: '#111827', padding: 16, marginTop: 0 },
  playerLabel: { color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  playerLessonTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginTop: 4 },
  playerLoading: { paddingVertical: 24, alignItems: 'center' },
  playerPlaceholder: { paddingVertical: 40, alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 6, marginTop: 12 },
  playerPlaceholderText: { color: '#9ca3af', fontSize: 12, paddingHorizontal: 12, textAlign: 'center' },
  playbackErrorBox: { backgroundColor: '#7f1d1d', borderRadius: 6, padding: 10, marginTop: 12 },
  playbackErrorText: { color: '#fecaca', fontSize: 13 },
  playbackErrorLink: { marginTop: 6, fontWeight: '700' },
  modulesSection: { padding: 16 },
  modulesHeading: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  module: { backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 8, marginBottom: 10, overflow: 'hidden' },
  moduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  moduleTitle: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  moduleChevron: { fontSize: 18, color: '#6b7280', marginLeft: 8 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  lessonTitle: { fontSize: 13, color: '#1f2937' },
  lessonPlayIcon: { fontSize: 16, color: '#9ca3af', marginLeft: 8 },
  lessonMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  lessonBadge: { backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginRight: 8, overflow: 'hidden' },
  lessonBadgePreview: { backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginRight: 8, overflow: 'hidden' },
  lessonMeta: { fontSize: 11, color: '#9ca3af', marginRight: 8 },
  lessonMetaWarn: { fontSize: 11, color: '#b45309' },
  emptyText: { color: '#6b7280', fontSize: 13, padding: 12 },
});
