import React, {useEffect, useState} from 'react';
import {
  BackHandler,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const {width: screenWidth} = Dimensions.get('window');

/**
 * Full-screen, in-app walkthrough overlay shared by SDK and legacy broker
 * setup guides. Keeping this as a normal overlay (rather than opening a URL)
 * preserves the user's connection progress and gives them an obvious Back / X.
 */
const BrokerWalkthroughPlayer = ({videoId, title, accent = '#0056B7', onClose}) => {
  const insets = useSafeAreaInsets();
  const [playerError, setPlayerError] = useState(false);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setPlayerError(false);
    // The user explicitly tapped Watch walkthrough. Start playback from
    // that in-app action instead of leaving a paused YouTube preview whose
    // "Watch on YouTube" affordance hands off to the external browser.
    setPlaying(true);
  }, [videoId]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !videoId) {
      return undefined;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [videoId, onClose]);

  if (!videoId) {
    return null;
  }

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={[styles.header, {backgroundColor: accent, paddingTop: 10 + insets.top}]}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerAction}
          accessibilityRole="button"
          accessibilityLabel="Back to broker setup">
          <Text style={styles.headerActionText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>IN-APP WALKTHROUGH</Text>
          <Text style={styles.title} numberOfLines={1}>
            {title || 'Broker setup walkthrough'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerAction}
          accessibilityRole="button"
          accessibilityLabel="Close walkthrough">
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        {playerError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Video could not load</Text>
            <Text style={styles.errorBody}>
              Check your connection and try the walkthrough again.
            </Text>
          </View>
        ) : (
          <YoutubePlayer
            height={screenWidth * 0.61}
            width={screenWidth}
            play={playing}
            videoId={videoId}
            forceAndroidAutoplay
            initialPlayerParams={{
              preventFullScreen: true,
              modestbranding: true,
              rel: false,
            }}
            onChangeState={(state) => {
              if (state === 'ended') {
                setPlaying(false);
              }
            }}
            onError={() => setPlayerError(true)}
          />
        )}
        <Text style={styles.hint}>Close this video to continue where you left off.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12000,
    elevation: 12000,
    backgroundColor: '#ffffff',
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  headerAction: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  headerActionText: {color: '#fff', fontSize: 34, fontWeight: '300', marginTop: -5},
  closeText: {color: '#fff', fontSize: 29, fontWeight: '300', marginTop: -3},
  headerCopy: {flex: 1, paddingHorizontal: 10},
  eyebrow: {color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8},
  title: {color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2},
  body: {flex: 1, paddingTop: 18, backgroundColor: '#f8fafc'},
  hint: {fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 28, marginTop: 6},
  errorCard: {margin: 20, padding: 18, borderRadius: 14, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3'},
  errorTitle: {fontSize: 15, fontWeight: '800', color: '#9f1239'},
  errorBody: {fontSize: 13, color: '#9f1239', marginTop: 6, lineHeight: 19},
});

export default BrokerWalkthroughPlayer;
