import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Info, Lightbulb} from 'lucide-react-native';

import { designToken } from '../design/literalTokens';

const AngelOneCautionaryWarning = ({visible, onAck, onCancel}) => {
  if (!visible) return null;
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Info size={22} color={designToken('angelWarning.color.92400e')} />
          </View>
          <Text style={styles.headerTitle}>Before connecting Angel One</Text>
        </View>

        <Text style={styles.sectionTitle}>Cautionary-listed stocks</Text>
        <Text style={styles.sectionBody}>
          Angel One does not allow stocks under "Exchange Cautionary Listing"
          to be placed through the broker API. If your portfolio includes
          such stocks during a rebalance, they will be skipped automatically
          — you'll need to place those orders manually inside the Angel One
          app or web platform.
        </Text>

        <View style={styles.tipBox}>
          <View style={styles.tipHeaderRow}>
            <Lightbulb size={16} color={designToken('angelWarning.color.1e40af')} />
            <Text style={styles.tipHeader}>What this means for you</Text>
          </View>
          <Text style={styles.tipBody}>
            • Most rebalance orders go through normally.{'\n'}
            • Orders for cautionary stocks (like some small-caps or stocks
            under exchange surveillance) will be marked as needing manual
            placement.{'\n'}
            • You'll see exactly which stocks need manual placement in the
            Trade Details screen after the rebalance runs.
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, styles.cancelBtn]}
            onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.ackBtn]}
            onPress={onAck}>
            <Text style={styles.ackBtnText}>Got it — Connect Angel One</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: designToken('angelWarning.backdrop.backgroundColor'),
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 9999,
  },
  sheet: {
    backgroundColor: designToken('angelWarning.sheet.backgroundColor'),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: designToken('angelWarning.handle.backgroundColor'),
    borderRadius: 2,
    marginBottom: 16,
  },
  headerRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 16},
  headerIconWrap: {
    padding: 10,
    backgroundColor: designToken('angelWarning.headerIconWrap.backgroundColor'),
    borderRadius: 10,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: designToken('angelWarning.headerTitle.color'),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: designToken('angelWarning.sectionTitle.color'),
    marginBottom: 6,
  },
  sectionBody: {fontSize: 13, color: designToken('angelWarning.sectionBody.color'), lineHeight: 20},
  tipBox: {
    backgroundColor: designToken('angelWarning.tipBox.backgroundColor'),
    borderColor: designToken('angelWarning.tipBox.borderColor'),
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  tipHeaderRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  tipHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: designToken('angelWarning.tipHeader.color'),
    marginLeft: 6,
  },
  tipBody: {fontSize: 12, color: designToken('angelWarning.tipBody.color'), lineHeight: 19},
  buttonRow: {flexDirection: 'row', marginTop: 20},
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: designToken('angelWarning.cancelBtn.borderColor'),
    marginRight: 10,
  },
  cancelBtnText: {fontSize: 14, fontWeight: '600', color: designToken('angelWarning.cancelBtnText.color')},
  ackBtn: {flex: 2, backgroundColor: designToken('angelWarning.ackBtn.backgroundColor')},
  ackBtnText: {fontSize: 14, fontWeight: '600', color: designToken('angelWarning.ackBtnText.color')},
});

export default AngelOneCautionaryWarning;
