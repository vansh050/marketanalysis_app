/**
 * ManualSellModal.js
 * For brokers (ICICI) that require manual stock authorization before selling.
 * Ported from prod-alphaquark-github for feature parity.
 *
 * The DDPI activation nudge inside this modal opens the shared
 * `BrokerDdpiHelpModal` via the global modal store — see
 * `src/components/BrokerDdpiHelpModal.js` and
 * `src/config/brokerDdpiHelp.js`. Do not duplicate DDPI step text here.
 */
import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import {X, AlertTriangle, ChevronLeft, ExternalLink} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import useModalStore from '../GlobalUIModals/modalStore';

import { designColor } from '../design/literalTokens';

const ManualSellModal = ({isOpen, onClose, onRetry, broker = 'ICICI Direct'}) => {
  const [isSellAllowed, setIsSellAllowed] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const openModal = useModalStore(state => state.openModal);

  const handleRetry = () => {
    if (isSellAllowed && onRetry) {
      onRetry();
      onClose();
    }
  };

  const openICICIPortfolio = () => {
    Linking.openURL(
      'https://secure.icicidirect.com/trading/equity/my-watchlist',
    );
  };

  if (showHowTo) {
    return (
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setShowHowTo(false)}>
        <SafeAreaView style={styles.overlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setShowHowTo(false)}>
              <ChevronLeft size={24} color={designColor('6b7280')} />
            </TouchableOpacity>

            <ScrollView style={styles.howToContent}>
              <Text style={styles.howToTitle}>
                ICICI Broker: Mandate Steps for Stock Selling
              </Text>

              <View style={styles.stepContainer}>
                <Text style={styles.stepText}>
                  <Text style={styles.stepBold}>1. </Text>
                  Visit the ICICI Direct portfolio page and click on the Portfolio tab.
                </Text>
                <TouchableOpacity onPress={openICICIPortfolio} style={styles.linkRow}>
                  <ExternalLink size={14} color={designColor('2563eb')} />
                  <Text style={styles.linkText}>
                    Open ICICI Direct Portfolio
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.stepContainer}>
                <Text style={styles.stepText}>
                  <Text style={styles.stepBold}>2. </Text>
                  Next to Refresh icon you will see Add Mandate text, just above the Overall Gain.
                </Text>
              </View>

              <View style={styles.stepContainer}>
                <Text style={styles.stepText}>
                  <Text style={styles.stepBold}>3. </Text>
                  Select the stock you received recommendation for and click Proceed. Enter your MPIN and click Submit. Check the box for T&C, enter the OTP, then click Submit. After completing, try selling again.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsSellAllowed(!isSellAllowed)}>
                <View style={[styles.checkbox, isSellAllowed && styles.checkboxChecked]}>
                  {isSellAllowed && <Text style={styles.checkmark}>{'✓'}</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  I've authorized the selling of these stocks
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.retryBtn, !isSellAllowed && styles.retryBtnDisabled]}
                onPress={handleRetry}
                disabled={!isSellAllowed}>
                <Text style={styles.retryBtnText}>Retry sell order</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={22} color={designColor('6b7280')} />
          </TouchableOpacity>

          <View style={styles.mainContent}>
            <View style={styles.alertRow}>
              <AlertTriangle size={24} color={designColor('dc2626')} />
              <View style={{flex: 1}}>
                <Text style={styles.alertTitle}>
                  Action Required: Stock Authorization to Sell
                </Text>
                <Text style={styles.alertText}>
                  {'\u2022'} Your broker does not allow selling authorization from the app.
                </Text>
                <Text style={styles.alertText}>
                  {'\u2022'} Please authorize your stocks manually on your {broker} portal before retrying sell orders. The best fix is to <Text style={styles.inlineLink} onPress={() => openModal('DdpiHelp', {broker})}>activate DDPI</Text> — one-time setup, no more per-sell authorization.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.ddpiNudgeRow}
              onPress={() => openModal('DdpiHelp', {broker})}
              activeOpacity={0.7}>
              <ExternalLink size={16} color={designColor('0a7a5a')} />
              <Text style={styles.ddpiNudgeText}>
                Show me how to activate DDPI on {broker}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsSellAllowed(!isSellAllowed)}>
              <View style={[styles.checkbox, isSellAllowed && styles.checkboxChecked]}>
                {isSellAllowed && <Text style={styles.checkmark}>{'✓'}</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                I've authorized the selling of these stocks
              </Text>
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.retryBtn, !isSellAllowed && styles.retryBtnDisabled]}
                onPress={handleRetry}
                disabled={!isSellAllowed}>
                <Text style={styles.retryBtnText}>Retry sell order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.howToBtn}
                onPress={() => setShowHowTo(true)}>
                <Text style={styles.howToBtnText}>How to Authorize {'>'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16},
  modalContainer: {backgroundColor: designColor('fff'), borderRadius: 12, maxHeight: '85%'},
  closeBtn: {position: 'absolute', top: 12, right: 12, zIndex: 1, padding: 4},
  backBtn: {padding: 12},
  mainContent: {padding: 20, paddingTop: 28},
  alertRow: {flexDirection: 'row', gap: 12, marginBottom: 20},
  alertTitle: {fontSize: 16, fontWeight: '600', color: designColor('111827'), marginBottom: 10},
  alertText: {fontSize: 13, color: designColor('6b7280'), marginBottom: 6, lineHeight: 18},
  checkboxRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 20, paddingLeft: 4},
  checkbox: {width: 20, height: 20, borderWidth: 1.5, borderColor: designColor('d1d5db'), borderRadius: 4, alignItems: 'center', justifyContent: 'center'},
  checkboxChecked: {backgroundColor: designColor('2563eb'), borderColor: designColor('2563eb')},
  checkmark: {color: designColor('fff'), fontSize: 14, fontWeight: '700'},
  checkboxLabel: {fontSize: 13, color: designColor('374151')},
  buttonRow: {flexDirection: 'row', gap: 12},
  retryBtn: {backgroundColor: designColor('dc2626'), paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6},
  retryBtnDisabled: {opacity: 0.5},
  retryBtnText: {color: designColor('fff'), fontSize: 13, fontWeight: '500'},
  howToBtn: {borderWidth: 1, borderColor: designColor('dc2626'), paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6},
  howToBtnText: {color: designColor('dc2626'), fontSize: 13, fontWeight: '500'},
  howToContent: {padding: 20},
  howToTitle: {fontSize: 15, fontWeight: '600', color: designColor('111827'), marginBottom: 16},
  stepContainer: {marginBottom: 12},
  stepText: {fontSize: 13, color: designColor('374151'), lineHeight: 18},
  stepBold: {fontWeight: '600'},
  linkRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6},
  linkText: {fontSize: 13, color: designColor('2563eb'), textDecorationLine: 'underline'},
  // DDPI nudge (opens BrokerDdpiHelpModal via global store).
  inlineLink: {color: designColor('0a7a5a'), fontWeight: '600', textDecorationLine: 'underline'},
  ddpiNudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: designColor('e5f7f0'),
    borderColor: designColor('b9e4d2'),
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  ddpiNudgeText: {fontSize: 13, color: designColor('0a7a5a'), fontWeight: '600', flexShrink: 1},
});

export default ManualSellModal;
