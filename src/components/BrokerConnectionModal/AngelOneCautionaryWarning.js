/**
 * AngelOneCautionaryWarning
 * -------------------------
 * Pre-connect interstitial that explains Angel One's exchange-cautionary
 * stock restriction BEFORE the user enters the OAuth/credentials flow.
 *
 * 2026-05-01 user-reported (mirror of tidi_new fix shipped same day):
 * when an Angel One user runs a rebalance that includes a stock
 * currently flagged as cautionary by the exchange, the broker
 * silently rejects ONLY those stocks while placing the rest. The
 * Trade Details screen then shows a confusing mix of green PLACED
 * rows + a red FAILED row + a "place these manually in your broker
 * app" cautionary banner. Telling the user up-front sets the right
 * expectation.
 *
 * Behaviour:
 *   - On mount: renders a centered modal sheet with the warning copy
 *     and two CTAs ("Cancel" / "Got it — Connect Angel One").
 *   - On "Got it": transitions to `acked=true` and renders `children`
 *     (the actual broker modal — Phase3SdkBrokerModal or
 *     AngleOneBookingTrueSheet) for the rest of the connect flow.
 *   - On "Cancel": calls `onClose` to abort the whole dispatch.
 *
 * Re-auth fast-path: when `reauthConfig` is non-null the warning is
 * skipped (the user already acked it on the original connect; re-auth
 * is just a token refresh — surfacing the warning every reconnect
 * would be noise). Mirrors tidi's `!isReauth` gate in
 * `ManageBrokersPage._navigateToBrokerAuth`.
 *
 * Pairs with tidi `lib/components/home/portfolio/BrokerSelectionPage.dart`
 * `showAngelOneCautionaryWarning(context)` — same copy, same CTAs.
 */

import React, {useState} from 'react';
import {Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet} from 'react-native';

import { designToken } from '../../design/literalTokens';

const AngelOneCautionaryWarning = ({
  reauthConfig,
  onClose,
  onCancel,
  onAck,
  visible = true,
  children,
}) => {
  const skipWarning = !!reauthConfig;
  const [acked, setAcked] = useState(skipWarning);
  const controlled = typeof onAck === 'function';
  const close = onCancel || onClose;

  if (!visible) return controlled ? null : children;
  if (acked) return children;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <View style={styles.iconBubble}>
                <Text style={styles.iconText}>!</Text>
              </View>
              <Text style={styles.title}>Before connecting Angel One</Text>
            </View>

            <Text style={styles.sectionTitle}>Cautionary-listed stocks</Text>
            <Text style={styles.body}>
              Angel One does not allow stocks under "Exchange Cautionary
              Listing" to be placed through the broker API. If your portfolio
              includes such stocks during a rebalance, they will be skipped
              automatically — you'll need to place those orders manually
              inside the Angel One app or web platform.
            </Text>

            <View style={styles.calloutBlue}>
              <Text style={styles.calloutTitle}>What this means for you</Text>
              <Text style={styles.calloutBullet}>
                • Most rebalance orders go through normally.
              </Text>
              <Text style={styles.calloutBullet}>
                • Orders for cautionary stocks (small-caps under exchange
                surveillance, stocks in the GSM/ASM list, etc.) will be
                marked as needing manual placement.
              </Text>
              <Text style={styles.calloutBullet}>
                • You'll see exactly which stocks need manual placement in
                the Trade Details screen after the rebalance runs.
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={close}
                activeOpacity={0.8}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.proceedBtn}
                onPress={() => controlled ? onAck() : setAcked(true)}
                activeOpacity={0.85}>
                <Text style={styles.proceedText}>
                  Got it — Connect Angel One
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: designToken('angelWarningSheet.scrim.backgroundColor'),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: designToken('angelWarningSheet.sheet.backgroundColor'),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: designToken('angelWarningSheet.iconBubble.backgroundColor'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    color: designToken('angelWarningSheet.iconText.color'),
    fontSize: 22,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: designToken('angelWarningSheet.title.color'),
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: designToken('angelWarningSheet.sectionTitle.color'),
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    color: designToken('angelWarningSheet.body.color'),
    lineHeight: 19,
    marginBottom: 12,
  },
  calloutBlue: {
    backgroundColor: designToken('angelWarningSheet.calloutBlue.backgroundColor'),
    borderColor: designToken('angelWarningSheet.calloutBlue.borderColor'),
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: designToken('angelWarningSheet.calloutTitle.color'),
    marginBottom: 8,
  },
  calloutBullet: {
    fontSize: 12,
    color: designToken('angelWarningSheet.calloutBullet.color'),
    lineHeight: 19,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designToken('angelWarningSheet.cancelBtn.borderColor'),
    alignItems: 'center',
    marginRight: 10,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: designToken('angelWarningSheet.cancelText.color'),
  },
  proceedBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: designToken('angelWarningSheet.proceedBtn.backgroundColor'),
    alignItems: 'center',
  },
  proceedText: {
    fontSize: 14,
    fontWeight: '600',
    color: designToken('angelWarningSheet.proceedText.color'),
  },
});

export default AngelOneCautionaryWarning;
