import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { ChevronLeft, XIcon } from 'lucide-react-native';
import Config from 'react-native-config';

import { useColors } from '../../theme/useColors';
import LinkifiedUrl from '../../UIComponents/BrokerConnectionUI/HelpUI/LinkifiedUrl';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Themed broker-connect walkthrough — a numbered green-stepper guide.
 *
 * Presentational + data-driven: takes a `data` config from
 * `brokerHelpData.js` ({ title, videoId, steps[] }) and renders a
 * branded bottom-sheet body: header, embedded YouTube walkthrough, and
 * numbered step rows with a connector rail. All colour comes from
 * `useColors()` (per-advisor brand, NOT hard-coded) so the guide
 * matches whichever white-label tenant is running.
 *
 * Step segments (string | {u,d} | {redirect}) are resolved here:
 * "{app}" → white-label name, {redirect} → the broker-connect Redirect
 * URL, {u}/{d} → an inline open+copy link via the shared LinkifiedUrl.
 *
 * 2026-06-21: extracted from HelpModal.js's 9 hand-rolled per-broker
 * blocks; same content, themed + auto-numbered.
 */
const BrokerHelpStepper = ({ data, onClose }) => {
  const colors = useColors();
  const scrollRef = useRef(null);

  const appName = Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark';
  const redirectUrl = Config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL || '';

  const accent = colors?.brand?.primary || '#1e9f40';
  const onAccent = colors?.text?.onBrand || '#ffffff';
  const textPrimary = colors?.text?.primary || '#111827';
  const textMuted = colors?.text?.secondary || '#6B7280';
  const border = colors?.border?.default || '#E5E7EB';
  const cardFill = colors?.surface?.card || colors?.surface?.base || '#F9FAFB';

  if (!data) {
    return null;
  }

  const renderSegments = (step) => {
    const segs = Array.isArray(step) ? step : [step];
    return segs.map((seg, i) => {
      if (typeof seg === 'string') {
        return (
          <Text key={i} style={[styles.stepText, { color: textPrimary }]}>
            {seg.replace(/\{app\}/g, appName)}
          </Text>
        );
      }
      if (seg.redirect) {
        return (
          <LinkifiedUrl key={i} url={redirectUrl} style={{ color: accent }} />
        );
      }
      return (
        <LinkifiedUrl key={i} url={seg.u} display={seg.d} style={{ color: accent }} />
      );
    });
  };

  return (
    <>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <ChevronLeft size={24} color={textMuted} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: textPrimary }]} numberOfLines={2}>
          {data.title}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <XIcon size={22} color={textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        contentContainerStyle={styles.scrollBody}
        indicatorStyle="black"
        showsVerticalScrollIndicator>
        {/* Walkthrough video */}
        {!!data.videoId && (
          <View style={[styles.videoCard, { borderColor: border, backgroundColor: cardFill }]}>
            <YoutubePlayer
              height={screenHeight * 0.23}
              width={screenWidth * 0.84}
              play={false}
              videoId={data.videoId}
            />
          </View>
        )}

        {/* Numbered stepper */}
        <View style={styles.stepper}>
          {data.steps.map((step, idx) => {
            const isLast = idx === data.steps.length - 1;
            return (
              <View key={idx} style={styles.stepRow}>
                {/* number + connector rail */}
                <View style={styles.rail}>
                  <View style={[styles.circle, { backgroundColor: accent }]}>
                    <Text style={[styles.circleText, { color: onAccent }]}>
                      {idx + 1}
                    </Text>
                  </View>
                  {!isLast && (
                    <View style={[styles.connector, { backgroundColor: border }]} />
                  )}
                </View>
                {/* step body */}
                <View style={styles.stepBody}>
                  <Text style={[styles.stepText, { color: textPrimary }]}>
                    {renderSegments(step)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
    marginHorizontal: 10,
  },
  scrollBody: {
    flexGrow: 1,
    paddingBottom: 200,
    paddingHorizontal: 16,
  },
  videoCard: {
    overflow: 'hidden',
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 18,
    paddingVertical: 6,
  },
  stepper: {
    paddingHorizontal: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rail: {
    width: 26,
    alignItems: 'center',
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  circleText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
  },
  connector: {
    width: 2,
    flex: 1,
    marginVertical: 2,
  },
  stepBody: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 18,
  },
  stepText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Poppins-Regular',
  },
});

export default BrokerHelpStepper;
