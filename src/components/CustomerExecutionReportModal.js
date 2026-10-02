import React, {useState} from 'react';
import {
  ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import {
  createCustomerExecutionReportId,
  reportDurableOrderOutcome,
} from '../services/DurableOrderService';

import { designColor, designFont } from '../design/literalTokens';

const OUTCOMES = [
  ['filled', 'Fully filled'],
  ['partially_filled', 'Partially filled'],
  ['not_filled', 'Not filled / rejected'],
  ['still_open', 'Still open at broker'],
  ['unknown', 'I am not sure'],
];

export default function CustomerExecutionReportModal({
  visible, onClose, jobId, requestId, tradeId, configData, onSubmitted,
}) {
  const [outcome, setOutcome] = useState('unknown');
  const [quantity, setQuantity] = useState('');
  const [averagePrice, setAveragePrice] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reportId, setReportId] = useState(createCustomerExecutionReportId);

  const submit = async () => {
    const reportedQuantity = Number(quantity);
    const reportedPrice = Number(averagePrice);
    if (outcome === 'partially_filled' && !(reportedQuantity > 0)) {
      setError('Enter the quantity that was filled.');
      return;
    }
    if (['filled', 'partially_filled'].includes(outcome) && !(reportedPrice > 0)) {
      setError('Enter the average price shown by your broker.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await reportDurableOrderOutcome({
        reportId,
        ...(jobId ? {jobId} : {requestId}),
        ...(tradeId ? {tradeId} : {}),
        reportedOutcome: outcome,
        ...(outcome === 'partially_filled' ? {reportedFilledQuantity: reportedQuantity} : {}),
        ...(['filled', 'partially_filled'].includes(outcome) ? {reportedAveragePrice: reportedPrice} : {}),
        note: note.trim() || undefined,
      }, configData);
      onSubmitted?.(response?.customerReconciliation);
      setReportId(createCustomerExecutionReportId());
      onClose?.();
    } catch (submissionError) {
      setError(submissionError?.response?.data?.message || submissionError?.message ||
        'We could not record this report. Please try again with the same details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'}}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight: '88%', backgroundColor: designColor('fff'),
          borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20}}>
          <Text style={{fontSize: 18, fontFamily: designFont('Poppins-SemiBold'), color: designColor('111827')}}>
            Tell us what happened at your broker
          </Text>
          <Text style={{fontSize: 12, lineHeight: 18, color: designColor('4b5563'), marginTop: 6}}>
            Your report starts verification; it does not mark the trade complete or permit a retry.
            Keep this order blocked until we confirm broker evidence.
          </Text>
          <View style={{marginTop: 14}}>
            {OUTCOMES.map(([value, label]) => (
              <TouchableOpacity key={value} onPress={() => setOutcome(value)}
                style={{padding: 11, marginBottom: 7, borderRadius: 8, borderWidth: 1,
                  borderColor: outcome === value ? designColor('2563eb') : designColor('d1d5db'),
                  backgroundColor: outcome === value ? designColor('eff6ff') : designColor('fff')}}>
                <Text style={{color: designColor('111827'), fontFamily: designFont('Poppins-Medium')}}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {outcome === 'partially_filled' ? <TextInput value={quantity} onChangeText={setQuantity}
            placeholder="How many were filled?" keyboardType="decimal-pad" style={inputStyle} /> : null}
          {['filled', 'partially_filled'].includes(outcome) ? <TextInput value={averagePrice}
            onChangeText={setAveragePrice} placeholder="Average price shown by your broker"
            keyboardType="decimal-pad" style={inputStyle} /> : null}
          <TextInput value={note} onChangeText={setNote} placeholder="Anything else we should know"
            multiline maxLength={1000} style={[inputStyle, {minHeight: 76, textAlignVertical: 'top'}]} />
          <Text style={{fontSize: 11, lineHeight: 16, color: designColor('92400e'), marginTop: 2}}>
            We first check broker trades and orders. If neither provides a price, your stated price becomes the
            recorded customer-attested fallback. Please do not retry until status is confirmed.
          </Text>
          {error ? <Text style={{color: designColor('b91c1c'), marginTop: 10}}>{error}</Text> : null}
          <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18, marginBottom: 28}}>
            <TouchableOpacity onPress={onClose} disabled={submitting}
              style={{paddingHorizontal: 18, paddingVertical: 11}}>
              <Text style={{color: designColor('374151')}}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={submit} disabled={submitting}
              style={{paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8,
                backgroundColor: designColor('2563eb'), minWidth: 130, alignItems: 'center'}}>
              {submitting ? <ActivityIndicator color={designColor('fff')} /> :
                <Text style={{color: designColor('fff'), fontFamily: designFont('Poppins-SemiBold')}}>Send for review</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const inputStyle = {
  borderWidth: 1, borderColor: designColor('d1d5db'), borderRadius: 8, paddingHorizontal: 12,
  paddingVertical: 10, marginBottom: 10, color: designColor('111827'), fontFamily: designFont('Poppins-Regular'),
};
