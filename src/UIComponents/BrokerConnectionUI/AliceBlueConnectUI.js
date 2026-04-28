import React, {useRef} from 'react';
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

// AliceBlue OTP-validate interceptor (workaround for AliceBlue's broken
// post-OTP redirect, 2026-04-26).
//
// AliceBlue's SPA flow:
//   1. POST /omk/auth/access/v1/otp/validate → returns {result:[{redirectUrl,
//      accessToken, authorized}]}
//   2. SPA calls /omk/client-rest/profile/getUser to populate profile data
//   3. ONLY THEN does the SPA navigate to the redirectUrl
//
// Step 2 returns 401 because AliceBlue's Keycloak `alice-kb` client config
// only allow-lists localhost origins (`http:/​/localhost:3002,5050,9943,9000` in
// the JWT's `allowed-origins` claim). When the SPA calls getUser from
// `ant.aliceblueonline.com`, Keycloak rejects the cross-origin call with
// 401 — AliceBlue's own production origin isn't in their own client config.
// The SPA aborts the redirect on this 401, and the user stays stuck on
// the OTP screen which falls back to the password screen on retry.
//
// Workaround: monkey-patch fetch + XHR before the SPA loads, intercept
// the OTP-validate RESPONSE, extract `result[0].redirectUrl`, and
// force-navigate via `window.location` — bypassing the broken getUser
// step. We DON'T need profile data; we only need the redirectUrl which
// AliceBlue already sends in the OTP-validate response.
//
// This works for any origin AliceBlue's portal might be hosted at,
// because we patch on the WebView side, not via origin headers.
const ALICEBLUE_REDIRECT_INTERCEPTOR = `
(function () {
  if (window.__aqAliceblueIntercept) return;
  window.__aqAliceblueIntercept = true;

  function maybeRedirect(bodyText) {
    try {
      var data = JSON.parse(bodyText);
      var url = data && data.result && data.result[0] && data.result[0].redirectUrl;
      if (url && typeof url === 'string' && url.indexOf('authCode=') !== -1) {
        // Defer slightly to let the SPA settle, then force the redirect.
        setTimeout(function () { window.location.href = url; }, 50);
      }
    } catch (e) { /* not JSON / not the response we care about */ }
  }

  // Patch fetch
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var p = origFetch.apply(this, arguments);
      if (url.indexOf('/otp/validate') !== -1) {
        p.then(function (resp) {
          try { resp.clone().text().then(maybeRedirect); } catch (e) {}
        }).catch(function () {});
      }
      return p;
    };
  }

  // Patch XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__aqUrl = url;
    return origOpen.apply(this, arguments);
  };
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    var xhr = this;
    if (xhr.__aqUrl && xhr.__aqUrl.indexOf('/otp/validate') !== -1) {
      xhr.addEventListener('load', function () {
        try { maybeRedirect(xhr.responseText); } catch (e) {}
      });
    }
    return origSend.apply(this, arguments);
  };

  console.log('[AQ] AliceBlue OTP-validate interceptor armed');
})();
true;
`;

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');

const AliceBlueConnectUI = ({
  isVisible,
  onClose,
  authUrl,
  handleWebViewNavigationStateChange,
  loading,
}) => {
  const webViewRef = useRef(null);
  const insets = useSafeAreaInsets();

  // Handle Android back button
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
          <Text style={styles.headerTitle}>Connect to AliceBlue</Text>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <XIcon size={24} color="#000" />
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0056B7" />
            <Text style={styles.loadingText}>
              Connecting AliceBlue...
            </Text>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{uri: authUrl}}
            style={styles.webView}
            nestedScrollEnabled={true}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            // Inject before any AliceBlue page script runs, so our
            // fetch / XHR monkey-patches are in place before the SPA
            // makes its OTP-validate call.
            injectedJavaScriptBeforeContentLoaded={ALICEBLUE_REDIRECT_INTERCEPTOR}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            cacheEnabled={true}
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
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0056B7" />
                <Text style={styles.loadingText}>
                  Loading AliceBlue login...
                </Text>
              </View>
            )}
          />
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
  webView: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
  },
});

export default AliceBlueConnectUI;
