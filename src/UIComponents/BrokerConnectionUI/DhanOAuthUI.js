import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native';
import WebView from 'react-native-webview';
import {ChevronLeft, XIcon} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');

const DhanOAuthUI = ({
  isVisible,
  onClose,
  authUrl,
  handleWebViewNavigationStateChange,
  loading,
  onSwitchToManual,
}) => {
  const webViewRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Opt 3: Progress-driven overlay. Dhan's partner-login page has heavy
  // JS/fonts/analytics — `onLoadEnd` doesn't fire for 5-10s. Show the
  // "Loading Dhan login…" overlay only until the WebView reports 30%
  // progress, then let Dhan's partial page render through while assets
  // continue downloading. `loadedOnce` is a latch so reloads from
  // partner-login.dhan.co's own nav don't re-flash the overlay.
  const [progress, setProgress] = useState(0);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const overlayVisible = !loadedOnce && progress < 0.3;

  React.useEffect(() => {
    if (!isVisible) return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );

    return () => backHandler.remove();
  }, [isVisible, onClose]);

  return (
    <CrossPlatformOverlay visible={isVisible} onClose={onClose}>
      <View style={styles.fullScreen}>
        <View style={[styles.header, {paddingTop: insets.top}]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connect to Dhan</Text>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <XIcon size={24} color="#000" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0056B7" />
            <Text style={styles.loadingText}>Connecting Dhan...</Text>
          </View>
        ) : (
          // Opt 2: WebView mounts in parallel with the modal so its
          // Chromium instance is warm by the time the URL resolves.
          <View style={styles.webViewWrap}>
            <WebView
              ref={webViewRef}
              source={{uri: authUrl}}
              style={styles.webView}
              nestedScrollEnabled={true}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              // startInLoadingState={false} — we manage the overlay
              // ourselves via onLoadProgress so the user sees Dhan's
              // partial page at 30% instead of a blank screen until
              // every last asset finishes.
              startInLoadingState={false}
              onLoadProgress={({nativeEvent}) => setProgress(nativeEvent.progress)}
              onLoadEnd={() => setLoadedOnce(true)}
              cacheEnabled={false}
              sharedCookiesEnabled={true}
              thirdPartyCookiesEnabled={true}
              scrollEnabled={true}
              originWhitelist={['*']}
              mixedContentMode="compatibility"
              setSupportMultipleWindows={false}
              userAgent={
                Platform.OS === 'android'
                  ? 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36'
                  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile Safari/604.1'
              }
            />
            {overlayVisible && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#0056B7" />
                <Text style={styles.loadingText}>Loading Dhan login...</Text>
              </View>
            )}
          </View>
        )}
        {onSwitchToManual && (
          <TouchableOpacity onPress={onSwitchToManual} style={styles.manualLink}>
            <Text style={styles.manualLinkText}>
              Enter Access Token manually instead
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#fff',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerButton: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#000',
  },
  webViewWrap: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  webView: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
  },
  manualLink: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  manualLinkText: {
    color: '#0056B7',
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});

export default DhanOAuthUI;
