/**
 * DdpiDeclarationPrompt — plan item 4 (2026-10-01). Asked ONCE per connected
 * broker, right after it is connected: "Selling needs DDPI or a daily TPIN.
 * Do you have DDPI?" Never blocks anything. The answer is stored on
 * connected_brokers[broker].ddpi_self_declared (PUT /api/sell-auth/
 * ddpi-declaration) as a DISPLAY hint only; it is never read as
 * authorization. Zerodha is skipped: its DDPI status is read from Kite.
 */
import React, {useEffect, useState} from 'react';
import {Modal, View, Text, TouchableOpacity, Linking, StyleSheet} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getTenantSubdomain} from '../../utils/variantHelper';
import {useTrade} from '../../screens/TradeContext';
import useSellAuthGuide from '../../hooks/useSellAuthGuide';
import {designColor, designFont} from '../../design/literalTokens';

const SKIP = new Set(['DummyBroker', 'Zerodha']);
const askedKey = (email, broker) => `aq.ddpiAsked.${String(email || '').toLowerCase()}.${broker}`;

export const brokerNeedingDdpiQuestion = userDetails => {
  const broker = userDetails?.user_broker;
  if (!broker || SKIP.has(broker)) return null;
  const entry = (userDetails?.connected_brokers || []).find(b => b?.broker === broker);
  if (!entry || entry.ddpi_self_declared) return null;
  if (String(entry.status || 'connected').toLowerCase() !== 'connected') return null;
  return broker;
};

export default function DdpiDeclarationPrompt() {
  const {userDetails, setUserDetails, configData} = useTrade();
  const broker = brokerNeedingDdpiQuestion(userDetails);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const {guide} = useSellAuthGuide(broker || undefined, configData);

  useEffect(() => {
    let cancelled = false;
    setVisible(false);
    if (!broker || !userDetails?.email) return undefined;
    // Let the connect success message finish first.
    const timer = setTimeout(async () => {
      try {
        const asked = await AsyncStorage.getItem(askedKey(userDetails.email, broker));
        if (!asked && !cancelled) setVisible(true);
      } catch (_) {
        /* storage unavailable: do not nag */
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [broker, userDetails?.email]);

  if (!broker) return null;

  const close = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(askedKey(userDetails?.email, broker), '1');
    } catch (_) {}
  };

  const answer = async value => {
    setSaving(true);
    try {
      await axios.put(
        `${server.server.baseUrl}api/sell-auth/ddpi-declaration`,
        {uid: userDetails?._id, broker, answer: value},
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
          },
        },
      );
      setUserDetails?.(prev =>
        prev
          ? {
              ...prev,
              connected_brokers: (prev.connected_brokers || []).map(b =>
                b?.broker === broker ? {...b, ddpi_self_declared: value} : b,
              ),
            }
          : prev,
      );
    } catch (_) {
      // Display hint only: a failed save must not block or re-nag this session.
    } finally {
      setSaving(false);
      await close();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="ddpi-declaration-prompt">
          <Text style={styles.title}>Selling from {broker}</Text>
          <Text style={styles.body}>
            To sell shares, CDSL needs either DDPI (a one-time authorization with your
            broker) or a TPIN approval each day you sell. Do you already have DDPI with{' '}
            {broker}?
          </Text>
          {!!guide?.ddpiUrl && (
            <Text style={styles.link} onPress={() => Linking.openURL(guide.ddpiUrl).catch(() => {})}>
              How to activate DDPI
            </Text>
          )}
          <View style={styles.row}>
            {[
              ['yes', 'Yes'],
              ['no', 'No'],
              ['unsure', 'Not sure'],
            ].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                disabled={saving}
                testID={`ddpi-declaration-${value}`}
                onPress={() => answer(value)}
                style={[styles.choice, saving && {opacity: 0.5}]}>
                <Text style={styles.choiceText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={close} style={styles.later}>
            <Text style={styles.laterText}>Ask me later</Text>
          </TouchableOpacity>
          <Text style={styles.small}>
            This only helps us show the right steps. It never blocks an order.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)'},
  sheet: {
    backgroundColor: designColor('fff'),
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  title: {fontSize: 16, color: designColor('111827'), fontFamily: designFont('Poppins-SemiBold')},
  body: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: designColor('374151'),
    fontFamily: designFont('Poppins-Regular'),
  },
  link: {
    marginTop: 8,
    fontSize: 13,
    color: designColor('2563eb'),
    textDecorationLine: 'underline',
    fontFamily: designFont('Poppins-Regular'),
  },
  row: {flexDirection: 'row', marginTop: 16, gap: 8},
  choice: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('2563eb'),
    alignItems: 'center',
  },
  choiceText: {fontSize: 14, color: designColor('2563eb'), fontFamily: designFont('Poppins-SemiBold')},
  later: {marginTop: 12, alignSelf: 'center', padding: 6},
  laterText: {fontSize: 13, color: designColor('6b7280'), fontFamily: designFont('Poppins-Regular')},
  small: {
    marginTop: 4,
    fontSize: 11,
    textAlign: 'center',
    color: designColor('9ca3af'),
    fontFamily: designFont('Poppins-Regular'),
  },
});
