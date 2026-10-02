/**
 * App-root, focus-safe host for broker Publisher WebViews.
 *
 * PublisherWebViewOverlay is a launcher rendered by the owning trade flow; it
 * deliberately renders no local UI. PublisherWebViewHost is mounted once next
 * to Navigation in App.js and owns the actual full-window WebView. This avoids
 * both Android's native Modal focus bug and child-layout clipping.
 */
import React, {useEffect, useRef} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {XIcon} from 'lucide-react-native';
import {create} from 'zustand';

import { designColor } from '../design/literalTokens';

const usePublisherWebViewStore = create(set => ({
  owner: null,
  config: null,
  open: (owner, config) => set({owner, config}),
  close: owner =>
    set(state =>
      state.owner === owner ? {owner: null, config: null} : state,
    ),
}));

const PublisherWebViewOverlay = props => {
  const ownerRef = useRef({});
  const latestPropsRef = useRef(props);
  const sessionConfigRef = useRef(null);
  const open = usePublisherWebViewStore(state => state.open);
  const close = usePublisherWebViewStore(state => state.close);

  latestPropsRef.current = props;

  // Freeze every native WebView prop for the lifetime of this browser session.
  // Live prices and order-state polling can rerender the owning trade screen;
  // pushing a new config object into the host on each render makes Android
  // WebView drop IME focus, especially on the CDSL TPIN redirect. Callback
  // wrappers stay stable while forwarding to the latest owning-screen logic.
  if (!sessionConfigRef.current) {
    sessionConfigRef.current = Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        typeof value === 'function'
          ? (...args) => latestPropsRef.current[key]?.(...args)
          : value,
      ]),
    );
  }

  useEffect(() => {
    const owner = ownerRef.current;
    open(owner, sessionConfigRef.current);
    return () => close(owner);
    // Ownership and native WebView configuration are tied to this mount.
  }, [open, close]);

  return null;
};

export const PublisherWebViewHost = React.memo(() => {
  const config = usePublisherWebViewStore(state => state.config);
  if (!config) {
    return null;
  }

  const {
    source,
    webViewRef,
    onClose,
    webViewStyle,
    ...webViewProps
  } = config;

  return (
    <SafeAreaView style={styles.overlay} testID="publisher-webview-host">
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Close broker order window"
          hitSlop={12}
          onPress={onClose}
          style={styles.closeButton}>
          <XIcon size={24} color={designColor('000')} />
        </TouchableOpacity>
      </View>
      <WebView
        ref={webViewRef}
        style={[styles.webView, webViewStyle]}
        source={source}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        setSupportMultipleWindows={false}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        keyboardDisplayRequiresUserAction={false}
        {...webViewProps}
      />
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: designColor('fff'),
    elevation: 10000,
    zIndex: 10000,
  },
  header: {
    height: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: designColor('e5e7eb'),
    backgroundColor: designColor('fff'),
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  webView: {
    flex: 1,
    backgroundColor: designColor('fff'),
  },
});

export default PublisherWebViewOverlay;
