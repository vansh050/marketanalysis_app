import React from 'react';
import {View, Text, TouchableOpacity, Modal, StyleSheet} from 'react-native';
import {ShieldAlert} from 'lucide-react-native';

import { designColor, designFont } from '../../design/literalTokens';

const ConsentPopup = ({
  isConsentPopupOpen,
  setIsConsentPopupOpen,
  handleConsentAccept,
}) => {
  return (
    <Modal
      visible={isConsentPopupOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setIsConsentPopupOpen(false)}>
      {/* Semi-transparent background */}
      <View style={styles.overlay} />
      {/* Centered popup */}
      <View style={styles.container}>
        <View style={styles.popup}>
          <View style={styles.iconRow}>
            <ShieldAlert size={22} color={designColor('f59e0b')} />
            <Text style={styles.title}>Important Disclaimer</Text>
          </View>
          <Text style={styles.message}>
            By proceeding, I acknowledge that past performance data shown is
            simulated and does not guarantee future results. Investments in the
            securities market are subject to market risks. For newer portfolios,
            data may be limited and CAGR may not be available.
          </Text>
          <Text style={styles.sebiNote}>
            Registration with SEBI is no guarantee of performance or assurance
            of returns to investors.
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setIsConsentPopupOpen(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.agreeButton]}
              onPress={handleConsentAccept}>
              <Text style={styles.agreeButtonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 50,
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  popup: {
    backgroundColor: designColor('fff'),
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: designColor('000'),
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('1a1a1a'),
  },
  message: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('374151'),
    marginBottom: 10,
    lineHeight: 20,
  },
  sebiNote: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('9ca3af'),
    marginBottom: 20,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: designColor('f3f4f6'),
  },
  cancelButtonText: {
    color: designColor('374151'),
    fontFamily: designFont('Poppins-Medium'),
    fontSize: 13,
  },
  agreeButton: {
    backgroundColor: designColor('1a1a1a'),
  },
  agreeButtonText: {
    color: designColor('fff'),
    fontFamily: designFont('Poppins-Medium'),
    fontSize: 13,
  },
});

export default ConsentPopup;
