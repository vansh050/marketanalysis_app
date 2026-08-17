import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';

import {recordStandaloneManualPlacement} from '../services/StandaloneManualPlacementService';

const messageOf = error => error?.response?.data?.message || error?.message || 'Unable to record manual trade.';

export default function StandaloneManualPlacementModal({visible, trade, configData, onClose, onSuccess}) {
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [brokerOrderId, setBrokerOrderId] = useState('');
  const [executedAt, setExecutedAt] = useState(new Date().toISOString());
  const [evidenceReference, setEvidenceReference] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !trade) return;
    setQuantity(String(trade.quantity || trade.Quantity || 1));
    setPrice('');
    setBrokerOrderId('');
    setExecutedAt(new Date().toISOString());
    setEvidenceReference('');
  }, [visible, trade]);

  const submit = () => {
    const filledQuantity = Number(quantity);
    const averagePrice = Number(price);
    const executionDate = new Date(executedAt);
    if (!Number.isInteger(filledQuantity) || filledQuantity < 1 || !(averagePrice > 0) || !brokerOrderId.trim() || Number.isNaN(executionDate.getTime())) {
      return Alert.alert('Details required', 'Enter filled quantity, average price, broker order ID and a valid execution time.');
    }
    Alert.alert('Confirm manual trade', 'Record this already-completed broker trade? This does not place an order.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Record', onPress: async () => {
        try {
          setBusy(true);
          const result = await recordStandaloneManualPlacement({
            recommendationId: trade.id || trade._id,
            quantity: filledQuantity,
            price: averagePrice,
            brokerOrderId: brokerOrderId.trim(),
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

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.overlay}><View style={styles.sheet}>
    <View style={styles.header}><View style={styles.heading}><Text style={styles.title}>Record manually placed trade</Text><Text style={styles.help}>{trade?.action || trade?.Type} {trade?.symbol || trade?.Symbol}. Copy the details from your broker trade book.</Text></View><TouchableOpacity onPress={onClose}><Text style={styles.close}>Close</Text></TouchableOpacity></View>
    <ScrollView keyboardShouldPersistTaps="handled">
      <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="Filled quantity" />
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Average entry price" />
      <TextInput style={styles.input} value={brokerOrderId} onChangeText={setBrokerOrderId} autoCapitalize="none" placeholder="Broker order ID" />
      <TextInput style={styles.input} value={executedAt} onChangeText={setExecutedAt} autoCapitalize="none" placeholder="Execution time (ISO)" />
      <TextInput style={styles.input} value={evidenceReference} onChangeText={setEvidenceReference} placeholder="Evidence/support reference (optional)" />
      <Text style={styles.note}>This records an already completed broker trade. It never places an order.</Text>
      <TouchableOpacity disabled={busy} style={[styles.submit, busy && styles.disabled]} onPress={submit}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Record trade</Text>}</TouchableOpacity>
    </ScrollView>
  </View></View></Modal>;
}

const styles = StyleSheet.create({overlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)'}, sheet: {maxHeight: '90%', borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#fff', padding: 18}, header: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'}, heading: {flex: 1, paddingRight: 12}, title: {fontSize: 18, fontWeight: '700', color: '#111827'}, help: {fontSize: 12, color: '#6B7280', marginTop: 5}, close: {color: '#2563EB', padding: 8}, input: {borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10, color: '#111827'}, note: {fontSize: 12, color: '#6B7280', marginTop: 12}, submit: {backgroundColor: '#1D4ED8', borderRadius: 8, alignItems: 'center', padding: 13, marginTop: 16, marginBottom: 8}, disabled: {opacity: 0.55}, submitText: {color: '#fff', fontWeight: '700'}});
