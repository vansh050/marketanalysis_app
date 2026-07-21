import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Modal from 'react-native-modal';

import { useColors } from '../../theme/useColors';
import { getBrokerHelp } from './brokerHelpData';
import BrokerHelpStepper from './BrokerHelpStepper';

const { height: screenHeight } = Dimensions.get('window');

/**
 * Broker-connect walkthrough bottom sheet.
 *
 * Thin themed shell: resolves the per-broker guide from
 * `brokerHelpData.js` and renders it via the green-stepper
 * `BrokerHelpStepper`. Brand colour + surface come from `useColors()`
 * so the sheet matches the running white-label tenant.
 *
 * 2026-06-21 rebuild: replaced ~600 lines of hand-rolled per-broker JSX
 * (and dead `mpin`/`otp`/`handleCopy` state that referenced unimported
 * globals) with the data-driven stepper. Same content, themed +
 * auto-numbered; refreshed walkthrough video IDs live in the data module.
 */
const HelpModal = ({ broker, visible, onClose }) => {
  const colors = useColors();
  const data = getBrokerHelp(broker);
  const sheetBg = colors?.surface?.base || '#ffffff';

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      style={styles.modal}
      propagateSwipe={true}
      useNativeDriverForBackdrop={true}>
      <View style={[styles.modalContainer, { backgroundColor: sheetBg }]}>
        <View style={styles.sheet}>
          <BrokerHelpStepper data={data} onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.85,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});

export default HelpModal;
