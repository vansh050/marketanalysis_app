/**
 * MyCoursesScreen — course catalog (mirrors web src/Home/Course/UserCourses.js).
 *
 * Lists all advisor courses with kind !== 'webinar' (the auto-managed
 * webinar container course is filtered out — webinar discovery lives at
 * WebinarsListScreen). Tap → CourseDetail. Pull-to-refresh.
 *
 * Despite the name "My Courses", this is actually the manager's full
 * course catalog — enrollment is checked when the viewer opens a lesson
 * via /api/gumlet/playback-token (server-side verifyEnrollment). That
 * matches the web naming + flow.
 *
 * Cross-ref: Alphab2bapp/docs/COURSES_WEBINARS_MOBILE_PORTING.md §4.6.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useConfig } from '../../context/ConfigContext';
import gumletService from '../../FunctionCall/services/GumletService';

function CourseCard({ course, accent, onPress }) {
  const hasThumb = course?.thumbnailUrl && String(course.thumbnailUrl).trim() !== '';
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      {hasThumb ? (
        <Image source={{ uri: course.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: accent + '15' }]}>
          <Text style={[styles.thumbFallbackText, { color: accent }]}>Course</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>{course.title}</Text>
        {!!course.description && (
          <Text style={styles.description} numberOfLines={2}>{course.description}</Text>
        )}
        <View style={styles.metaRow}>
          {!!course.duration && (
            <Text style={styles.metaItem}>⏱ {course.duration} hrs</Text>
          )}
          {!!course.level && (
            <View style={[styles.levelPill, levelColor(course.level)]}>
              <Text style={[styles.levelText, levelColor(course.level, true)]}>{course.level}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function levelColor(level, isText = false) {
  if (level === 'Beginner') return isText ? { color: '#15803d' } : { backgroundColor: '#dcfce7' };
  if (level === 'Intermediate') return isText ? { color: '#a16207' } : { backgroundColor: '#fef9c3' };
  if (level === 'Advanced') return isText ? { color: '#b91c1c' } : { backgroundColor: '#fee2e2' };
  return isText ? { color: '#374151' } : { backgroundColor: '#f3f4f6' };
}

export default function MyCoursesScreen() {
  const navigation = useNavigation();
  const config = useConfig();
  const accent = config?.mainColor || config?.themeColor || '#16a34a';
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async ({ pullToRefresh = false } = {}) => {
    if (pullToRefresh) setRefreshing(true); else setLoading(true);
    try {
      const result = await gumletService.listCollections();
      if (result?.success) {
        // Hide the auto-managed webinar container course — matches web's
        // UserCourses.js filter. Webinar discovery is at WebinarsListScreen.
        setCourses((result.data || []).filter((c) => c.kind !== 'webinar'));
        setError('');
      } else {
        setError(result?.message || 'Failed to load courses');
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Error fetching courses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ pullToRefresh: true })} />}
    >
      <View style={styles.heading}>
        <Text style={styles.headingTitle}>Courses</Text>
        <Text style={styles.headingSubtitle}>
          Curated content to deepen your investment knowledge.
        </Text>
      </View>

      {loading && !refreshing && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={accent} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      )}

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()} style={styles.retryBtn}>
            <Text style={[styles.retryBtnText, { color: accent }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && courses.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No courses yet</Text>
          <Text style={styles.emptyBody}>
            Courses are being prepared. Please check back later.
          </Text>
        </View>
      )}

      {!loading && !error && courses.length > 0 && courses.map((c) => (
        <CourseCard
          key={c._id}
          course={c}
          accent={accent}
          onPress={() => navigation.navigate('CourseDetail', { courseId: c._id })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  heading: { marginBottom: 16 },
  headingTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  headingSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  loadingText: { marginLeft: 8, color: '#6b7280' },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 12 },
  errorText: { color: '#991b1b', fontSize: 13 },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start' },
  retryBtnText: { fontWeight: '600' },
  emptyBox: { backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 8, padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#111827', fontWeight: '700', fontSize: 15 },
  emptyBody: { color: '#6b7280', marginTop: 6, fontSize: 13, textAlign: 'center' },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: 160, backgroundColor: '#f3f4f6' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbFallbackText: { fontSize: 16, fontWeight: '600' },
  cardBody: { padding: 14 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827' },
  description: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  metaItem: { fontSize: 12, color: '#6b7280', marginRight: 12 },
  levelPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  levelText: { fontSize: 11, fontWeight: '600' },
});
