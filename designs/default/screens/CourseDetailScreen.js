import React from 'react';
import {ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {designColor} from '../../../src/design/literalTokens';

const ModuleAccordion = ({module, isOpen, onToggle, onLessonPress, activeLessonId, accent}) => (
  <View style={styles.module}>
    <TouchableOpacity onPress={onToggle} style={styles.moduleHeader} activeOpacity={0.7}>
      <Text style={styles.moduleTitle}>{module.title}</Text>
      <Text style={styles.moduleChevron}>{isOpen ? '▾' : '▸'}</Text>
    </TouchableOpacity>
    {isOpen && (module.lessons || []).map(lesson => {
      const isActive = activeLessonId === lesson._id;
      const isLocked = lesson.status !== 'ready' && !lesson.isPreview;
      return (
        <TouchableOpacity
          key={lesson._id}
          onPress={() => onLessonPress(lesson)}
          style={[styles.lessonRow, isActive && {backgroundColor: `${accent}12`}]}
          activeOpacity={0.7}>
          <View style={styles.lessonBody}>
            <Text style={[styles.lessonTitle, isActive && {color: accent, fontWeight: '700'}]}>{lesson.title}</Text>
            <View style={styles.lessonMetaRow}>
              {lesson.type === 'live' && <Text style={styles.lessonBadge}>LIVE</Text>}
              {lesson.isPreview && <Text style={styles.lessonBadgePreview}>PREVIEW</Text>}
              {!!lesson.duration && <Text style={styles.lessonMeta}>{lesson.duration} min</Text>}
              {isLocked && <Text style={styles.lessonMetaWarn}>processing…</Text>}
            </View>
          </View>
          <Text style={[styles.lessonPlayIcon, isActive && {color: accent}]}>▶</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const CourseDetailScreen = ({viewModel, actions, slots}) => {
  const {
    accent,
    loading,
    error,
    course,
    openModuleIds,
    activeLesson,
    playback,
    playbackError,
    playbackLoading,
    purchaseOpen,
    isPurchased,
  } = viewModel;
  const {GumletPlayer, CoursePurchaseSheet} = slots;

  if (loading) return <View style={styles.center}><ActivityIndicator color={accent} /></View>;
  if (error || !course) {
    return (
      <View style={styles.center}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Couldn&apos;t load this course</Text>
          <Text style={styles.errorBody}>{error || 'Unknown error'}</Text>
          <TouchableOpacity onPress={actions.onRetry} style={[styles.retryBtn, {backgroundColor: accent}]}>
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
        {hasThumb && <Image source={{uri: course.thumbnailUrl}} style={styles.heroThumb} resizeMode="cover" />}
        <View style={styles.headerCard}>
          <Text style={styles.title}>{course.title}</Text>
          {!!course.description && <Text style={styles.description}>{course.description}</Text>}
          <View style={styles.headerMetaRow}>
            {!!course.level && <Text style={styles.headerMetaItem}>{course.level}</Text>}
            {!!course.duration && <Text style={styles.headerMetaItem}>⏱ {course.duration} hrs</Text>}
            {Array.isArray(course.modules) && <Text style={styles.headerMetaItem}>{course.modules.length} modules</Text>}
          </View>
          <View style={styles.enrollRow}>
            <View style={styles.priceColumn}>
              {Number(course.price) > 0 ? (
                <><Text style={styles.priceLabel}>Price</Text><Text style={styles.priceValue}>₹{Number(course.price).toLocaleString()}</Text></>
              ) : <Text style={styles.priceFree}>Free</Text>}
              {!!course.validityDurationDays && <Text style={styles.priceMeta}>{course.validityDurationDays}-day access</Text>}
            </View>
            <TouchableOpacity
              onPress={actions.onOpenPurchase}
              disabled={isPurchased}
              activeOpacity={isPurchased ? 1 : 0.7}
              style={[styles.enrollBtn, {backgroundColor: isPurchased ? designColor('9ca3af') : accent}]}>
              <Text style={styles.enrollBtnText}>{isPurchased ? 'Purchased' : Number(course.price) > 0 ? 'Enroll now' : 'Get free access'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {activeLesson && (
          <View style={styles.playerCard}>
            <Text style={styles.playerLabel}>Now playing</Text>
            <Text style={styles.playerLessonTitle}>{activeLesson.title}</Text>
            {playbackLoading && <View style={styles.playerLoading}><ActivityIndicator color={accent} /></View>}
            {!!playbackError && (
              <View style={styles.playbackErrorBox}>
                <Text style={styles.playbackErrorText}>{playbackError}</Text>
                {playbackError.startsWith('Please sign in') && (
                  <TouchableOpacity onPress={actions.onSignIn}><Text style={[styles.playbackErrorLink, {color: accent}]}>Sign in →</Text></TouchableOpacity>
                )}
                {playbackError.startsWith('Enroll') && (
                  <TouchableOpacity onPress={actions.onOpenPurchase}><Text style={[styles.playbackErrorLink, {color: accent}]}>Enroll now →</Text></TouchableOpacity>
                )}
              </View>
            )}
            {!playbackLoading && !playbackError && playback && <GumletPlayer lesson={activeLesson} playback={playback} />}
          </View>
        )}
        <View style={styles.modulesSection}>
          <Text style={styles.modulesHeading}>Course content</Text>
          {Array.isArray(course.modules) && course.modules.length > 0
            ? course.modules.map(module => (
                <ModuleAccordion
                  key={module._id}
                  module={module}
                  isOpen={openModuleIds.has(module._id)}
                  onToggle={() => actions.onToggleModule(module._id)}
                  onLessonPress={actions.onLessonPress}
                  activeLessonId={activeLesson?._id}
                  accent={accent}
                />
              ))
            : <Text style={styles.emptyText}>No modules yet.</Text>}
        </View>
      </ScrollView>
      <CoursePurchaseSheet
        visible={purchaseOpen}
        onClose={actions.onClosePurchase}
        course={course}
        onPurchased={actions.onPurchased}
      />
    </>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: designColor('f9fafb')},
  content: {paddingBottom: 40},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: designColor('f9fafb')},
  errorBox: {backgroundColor: designColor('fef2f2'), borderColor: designColor('fecaca'), borderWidth: 1, borderRadius: 8, padding: 16, maxWidth: 360, alignItems: 'center'},
  errorTitle: {color: designColor('991b1b'), fontSize: 14, fontWeight: '700'},
  errorBody: {color: designColor('991b1b'), fontSize: 12, marginTop: 6, textAlign: 'center'},
  retryBtn: {marginTop: 12, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 6},
  retryBtnText: {color: designColor('fff'), fontWeight: '600'},
  heroThumb: {width: '100%', height: 200, backgroundColor: designColor('e5e7eb')},
  headerCard: {backgroundColor: designColor('ffffff'), borderColor: designColor('e5e7eb'), borderBottomWidth: 1, padding: 16},
  title: {fontSize: 22, fontWeight: '700', color: designColor('111827')},
  description: {fontSize: 14, color: designColor('374151'), marginTop: 8, lineHeight: 20},
  headerMetaRow: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 12},
  headerMetaItem: {fontSize: 12, color: designColor('6b7280'), marginRight: 16, marginBottom: 4},
  enrollRow: {marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: designColor('f3f4f6'), flexDirection: 'row', alignItems: 'center'},
  priceColumn: {flex: 1},
  priceLabel: {fontSize: 10, color: designColor('9ca3af'), textTransform: 'uppercase', letterSpacing: 0.6},
  priceValue: {fontSize: 20, fontWeight: '700', color: designColor('111827'), marginTop: 2},
  priceFree: {fontSize: 20, fontWeight: '700', color: designColor('15803d')},
  priceMeta: {fontSize: 11, color: designColor('6b7280'), marginTop: 2},
  enrollBtn: {paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6},
  enrollBtnText: {color: designColor('ffffff'), fontWeight: '700', fontSize: 13},
  playerCard: {backgroundColor: designColor('111827'), padding: 16},
  playerLabel: {color: designColor('9ca3af'), fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6},
  playerLessonTitle: {color: designColor('ffffff'), fontSize: 16, fontWeight: '600', marginTop: 4},
  playerLoading: {paddingVertical: 24, alignItems: 'center'},
  playbackErrorBox: {backgroundColor: designColor('7f1d1d'), borderRadius: 6, padding: 10, marginTop: 12},
  playbackErrorText: {color: designColor('fecaca'), fontSize: 13},
  playbackErrorLink: {marginTop: 6, fontWeight: '700'},
  modulesSection: {padding: 16},
  modulesHeading: {fontSize: 16, fontWeight: '700', color: designColor('111827'), marginBottom: 12},
  module: {backgroundColor: designColor('ffffff'), borderColor: designColor('e5e7eb'), borderWidth: 1, borderRadius: 8, marginBottom: 10, overflow: 'hidden'},
  moduleHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14},
  moduleTitle: {fontSize: 14, fontWeight: '600', color: designColor('111827'), flex: 1},
  moduleChevron: {fontSize: 18, color: designColor('6b7280'), marginLeft: 8},
  lessonRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: designColor('f3f4f6')},
  lessonBody: {flex: 1},
  lessonTitle: {fontSize: 13, color: designColor('1f2937')},
  lessonPlayIcon: {fontSize: 16, color: designColor('9ca3af'), marginLeft: 8},
  lessonMetaRow: {flexDirection: 'row', alignItems: 'center', marginTop: 4},
  lessonBadge: {backgroundColor: designColor('fee2e2'), color: designColor('b91c1c'), fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginRight: 8, overflow: 'hidden'},
  lessonBadgePreview: {backgroundColor: designColor('dbeafe'), color: designColor('1d4ed8'), fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginRight: 8, overflow: 'hidden'},
  lessonMeta: {fontSize: 11, color: designColor('9ca3af'), marginRight: 8},
  lessonMetaWarn: {fontSize: 11, color: designColor('b45309')},
  emptyText: {color: designColor('6b7280'), fontSize: 13, padding: 12},
});

export default CourseDetailScreen;
