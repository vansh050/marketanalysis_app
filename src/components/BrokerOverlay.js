import React from 'react';
import { Platform, Modal } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

/**
 * BrokerOverlay - Cross-platform overlay for broker alerts/errors
 * Uses FullWindowOverlay on iOS, Modal on Android
 */
const BrokerOverlay = ({ children, visible, onClose }) => {
  if (!visible) return null;

  // FullWindowOverlay only works on iOS
  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay>
        {children}
      </FullWindowOverlay>
    );
  }

  // For Android, use React Native Modal
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      hardwareAccelerated={true}
      onRequestClose={onClose || (() => {})}>
      {children}
    </Modal>
  );
};

export default BrokerOverlay;
