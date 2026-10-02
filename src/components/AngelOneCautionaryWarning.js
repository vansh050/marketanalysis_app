import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {Info, Lightbulb} from 'lucide-react-native';

import { designColor } from '../design/literalTokens';

const AngelOneCautionaryWarning = ({visible, onAck, onCancel}) => {
  if (!visible) return null;
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <Info size={22} color={designColor('92400e')} />
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
            <Lightbulb size={16} color={designColor('1e40af')} />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999,
    elevation: 9999,
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    backgroundColor: designColor('e5e7eb'),
    borderRadius: 2,
    marginBottom: 16,
  },
  headerRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 16},
  headerIconWrap: {
    padding: 10,
    backgroundColor: designColor('fef3c7'),
    borderRadius: 10,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: designColor('1f2937'),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: designColor('1f2937'),
    marginBottom: 6,
  },
  sectionBody: {fontSize: 13, color: designColor('374151'), lineHeight: 20},
  tipBox: {
    backgroundColor: designColor('eff6ff'),
    borderColor: designColor('bfdbfe'),
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  tipHeaderRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  tipHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: designColor('1e40af'),
    marginLeft: 6,
  },
  tipBody: {fontSize: 12, color: designColor('1d4ed8'), lineHeight: 19},
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
    borderColor: designColor('9ca3af'),
    marginRight: 10,
  },
  cancelBtnText: {fontSize: 14, fontWeight: '600', color: designColor('374151')},
  ackBtn: {flex: 2, backgroundColor: designColor('1a237e')},
  ackBtnText: {fontSize: 14, fontWeight: '600', color: 'white'},
});

export default AngelOneCautionaryWarning;
