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
import {Alert} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useConfig } from '../../context/ConfigContext';
import {useComponent} from '../../design/useDesign';
import gumletService from '../../FunctionCall/services/GumletService';
import CoursePurchaseSheet from '../../components/CoursePurchaseSheet';
import {useAccountEmail} from '../../utils/accountEmail';

import { designColor } from '../../design/literalTokens';

export default function CourseDetailScreen() {
  const Presentation = useComponent('screens.CourseDetailScreen');
  const GumletPlayer = useComponent('composites.GumletPlayer');
  const route = useRoute();
  const navigation = useNavigation();
  const { courseId } = route.params || {};
  const config = useConfig();
  const accent = config?.mainColor || config?.themeColor || designColor('16a34a');

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
  // Reactive: the enrollment lookup below gates on this email, and the
  // identity can resolve AFTER mount (cold start / fresh Apple sign-in) —
  // a one-shot read would capture null and never refetch.
  const userEmail = useAccountEmail();

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
  }, [userEmail, course?._id, course?.modules]);

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

  const handlePurchased = () => {
    setPurchaseOpen(false);
    fetchCourse();
    fetchClientCourse();
    if (playbackError) {
      setPlaybackError('');
      setActiveLesson(null);
    }
  };

  return (
    <Presentation
      viewModel={{
        accent, loading, error, course, openModuleIds, activeLesson, playback,
        playbackError, playbackLoading, purchaseOpen, isPurchased,
      }}
      actions={{
        onRetry: fetchCourse,
        onOpenPurchase: () => { if (!isPurchased) setPurchaseOpen(true); },
        onClosePurchase: () => setPurchaseOpen(false),
        onPurchased: handlePurchased,
        onSignIn: () => navigation.navigate('Login'),
        onToggleModule: toggleModule,
        onLessonPress: handleLessonPress,
      }}
      slots={{GumletPlayer, CoursePurchaseSheet}}
    />
  );
}
