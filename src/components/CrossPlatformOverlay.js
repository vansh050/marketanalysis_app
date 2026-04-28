import React, { useEffect } from 'react';
import { Platform, View, StyleSheet, BackHandler } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

/**
 * CrossPlatformOverlay - Cross-platform overlay for broker connection UIs
 * Uses FullWindowOverlay on iOS, direct rendering on Android
 *
 * This is used for full-screen broker connection modals
 */
const CrossPlatformOverlay = ({ children, visible, onClose }) => {
  // On Android the overlay is a plain absoluteFillObject View, not a Modal,
  // so React Navigation's back-press handling fires before this component
  // gets a chance to close itself — leaving a ghost overlay painted over the
  // next screen. Register a BackHandler while visible so the first back press
  // closes the overlay (return true consumes the event) instead of navigating.
  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  // FullWindowOverlay only works on iOS
  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay>
        {children}
      </FullWindowOverlay>
    );
  }

  // For Android, render children directly with absolute positioning
  // The broker UIs already have full-screen styling
  return (
    <View style={styles.androidOverlay}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  androidOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});

export default CrossPlatformOverlay;
