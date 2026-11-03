import React, {useCallback, useRef} from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {X} from 'lucide-react-native';
import CrossPlatformOverlay from '../CrossPlatformOverlay';
import {classifyKiteAuthorizeUrl} from '../../utils/kiteAppAuthorize';
import {designColor} from '../../design/literalTokens';

/**
 * Full-screen Kite login for ONE purpose: the one-time "Authorize" of the
 * customer's own Kite Connect app. The request_token in the final redirect is
 * not used here; consent is all that is needed, and the caller retries the
 * server-side quick-reconnect login afterwards. CrossPlatformOverlay, never
 * RN <Modal> (Android modal-stacking freeze, see AxisConnectModal).
 */
const KiteAppAuthorizeWebView = ({url, onDone}) => {
  const doneRef = useRef(false);
  const finish = useCallback(
    result => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone?.(result);
    },
    [onDone],
  );
  const inspect = useCallback(
    target => {
      const outcome = classifyKiteAuthorizeUrl(target);
      if (outcome) finish(outcome === 'authorized');
      return outcome;
    },
    [finish],
  );

  if (!url) return null;
  return (
    <CrossPlatformOverlay visible onClose={() => finish(false)}>
      <View style={styles.fullScreen}>
        <SafeAreaView style={{flex: 1}}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => finish(false)} accessibilityLabel="Close">
              <X size={22} color={designColor('374151')} />
            </TouchableOpacity>
            <Text style={styles.title}>Authorize your Kite app</Text>
            <View style={{width: 22}} />
          </View>
          <Text style={styles.note}>
            One-time step: log in and tap Authorize. Quick reconnect continues automatically.
          </Text>
          <WebView
            source={{uri: url}}
            style={{flex: 1}}
            onShouldStartLoadWithRequest={request => !inspect(request?.url)}
            onNavigationStateChange={state => inspect(state?.url)}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            originWhitelist={['*']}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={designColor('059669')} />
              </View>
            )}
          />
        </SafeAreaView>
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  fullScreen: {flex: 1, backgroundColor: designColor('fff')},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: designColor('e5e7eb'),
  },
  title: {fontSize: 16, fontWeight: '600', color: designColor('111827')},
  note: {fontSize: 12, color: designColor('6b7280'), paddingHorizontal: 16, paddingVertical: 8},
  loading: {flex: 1, justifyContent: 'center', alignItems: 'center'},
});

export default KiteAppAuthorizeWebView;
