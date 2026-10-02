import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';

import {recordStandaloneManualPlacement} from '../services/StandaloneManualPlacementService';

import { designColor } from '../design/literalTokens';

const messageOf = error => error?.response?.data?.message || error?.message || 'Unable to record manual trade.';

// Local date-time in a user-friendly "YYYY-MM-DDTHH:mm" form (mirrors the web
// StandaloneManualPlacementModal). Avoids the raw UTC ISO timestamp
// (e.g. "2026-08-17T18:00:00.000Z") that previously defaulted the field to an
// unreadable UTC value.
const localDateTime = () => {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
};

// Field must live at MODULE scope (not inside the modal) so its component
// identity stays stable across re-renders. An inline Field was recreated on
// every keystroke, remounting the TextInputs and dropping the keyboard.
const Field = ({label, optional, ...inputProps}) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}{optional ? <Text style={styles.optional}> (optional)</Text> : null}</Text>
    <TextInput style={styles.input} placeholderTextColor={designColor('9ca3af')} {...inputProps} />
  </View>
);

export default function StandaloneManualPlacementModal({visible, trade, broker, configData, onClose, onSuccess}) {
  const initializedTradeRef = useRef(null);
  const [brokerName, setBrokerName] = useState('');
  const [brokerOrderId, setBrokerOrderId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [executedAt, setExecutedAt] = useState(localDateTime());
  const [evidenceReference, setEvidenceReference] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !trade) {
      initializedTradeRef.current = null;
      return;
    }

    const tradeKey = String(
      trade.id ||
      trade._id ||
      `${trade.symbol || trade.Symbol || ''}:${trade.date || trade.createdAt || ''}`,
    );
    if (initializedTradeRef.current === tradeKey) return;
    initializedTradeRef.current = tradeKey;

    setBrokerName(String(broker || trade.broker || trade.user_broker || ''));
    setBrokerOrderId('');
    setQuantity(String(trade.quantity || trade.Quantity || ''));
    setPrice('');
    setExecutedAt(localDateTime());
    setEvidenceReference('');
  }, [visible, trade, broker]);

  const submit = () => {
    const filledQuantity = Number(quantity);
    const averagePrice = Number(price);
    const executionDate = new Date(executedAt);
    if (!brokerName.trim() || !brokerOrderId.trim() || !Number.isInteger(filledQuantity) || filledQuantity < 1 || !(averagePrice > 0) || Number.isNaN(executionDate.getTime())) {
      return Alert.alert('Details required', 'Enter broker, broker order ID, filled quantity, average price and a valid execution time.');
    }
    Alert.alert('Confirm manual trade', 'Record this already-completed broker trade? This does not place an order.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Record', onPress: async () => {
        try {
          setBusy(true);
          const result = await recordStandaloneManualPlacement({
            recommendationId: trade.id || trade._id,
            broker: brokerName.trim(),
            brokerOrderId: brokerOrderId.trim(),
            quantity: filledQuantity,
            price: averagePrice,
            executedAt: executionDate.toISOString(),
            evidenceReference: evidenceReference.trim(),
          }, configData);
          Alert.alert('Trade updated', `${trade.symbol || trade.Symbol} recorded at ₹${averagePrice}.`);
          await onSuccess?.(result.trade);
          onClose?.();
        } catch (error) {
          Alert.alert('Unable to record trade', messageOf(error));
        } finally {
          setBusy(false);
        }
      }},
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.header}><View style={styles.heading}><Text style={styles.title}>Record manually placed trade</Text><Text style={styles.help}>{trade?.action || trade?.Type} {trade?.symbol || trade?.Symbol}. Enter details exactly as shown in your broker trade book.</Text></View><TouchableOpacity onPress={onClose}><Text style={styles.close}>Close</Text></TouchableOpacity></View>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Field label="Broker" value={brokerName} onChangeText={setBrokerName} autoCapitalize="words" />
        <Field label="Broker order ID" value={brokerOrderId} onChangeText={setBrokerOrderId} autoCapitalize="characters" />
        <Field label="Filled quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
        <Field label="Average entry price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
        <Field label="Execution time" value={executedAt} onChangeText={setExecutedAt} autoCapitalize="none" />
        <Field label="Evidence reference" optional value={evidenceReference} onChangeText={setEvidenceReference} placeholder="Trade-book or support reference" />
        <Text style={styles.note}>This records an already completed broker trade. It never places an order.</Text>
        <TouchableOpacity disabled={busy} style={[styles.submit, busy && styles.disabled]} onPress={submit}>{busy ? <ActivityIndicator color={designColor('fff')} /> : <Text style={styles.submitText}>Record trade</Text>}</TouchableOpacity>
      </ScrollView>
    </View></View></Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)'},
  sheet: {maxHeight: '90%', borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: designColor('fff'), padding: 18},
  header: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'},
  heading: {flex: 1, paddingRight: 12},
  title: {fontSize: 18, fontWeight: '700', color: designColor('111827')},
  help: {fontSize: 12, color: designColor('6b7280'), marginTop: 5},
  close: {color: designColor('2563eb'), padding: 8},
  field: {marginTop: 12},
  label: {fontSize: 13, fontWeight: '600', color: designColor('374151'), marginBottom: 5},
  optional: {fontWeight: '400', color: designColor('9ca3af')},
  input: {borderWidth: 1, borderColor: designColor('d1d5db'), borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: designColor('111827')},
  note: {fontSize: 12, color: designColor('6b7280'), marginTop: 12},
  submit: {backgroundColor: designColor('1d4ed8'), borderRadius: 8, alignItems: 'center', padding: 13, marginTop: 16, marginBottom: 8},
  disabled: {opacity: 0.55},
  submitText: {color: designColor('fff'), fontWeight: '700'},
});
