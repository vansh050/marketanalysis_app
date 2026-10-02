/** Audited customer manual basket entry/exit form; see docs/APP_ARCHITECTURE.md. */
import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View} from 'react-native';

import {applyManualBasketExit, previewManualBasketExit} from '../services/ManualBasketExitService';

import { designColor } from '../design/literalTokens';

const messageOf = error => error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Request failed';
const evidence = (row, enabled = true) => ({symbol: row.symbol, quantity: row.quantity, price: '', executedAt: new Date().toISOString(), enabled});
const badLots = item => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1;
const invalid = item => badLots(item) || !(Number(item.price) > 0) || Number.isNaN(new Date(item.executedAt).getTime());

const ManualBasketExitModal = ({visible, basketId, configData, onClose, onSuccess}) => {
  const [preview, setPreview] = useState(null);
  const [entries, setEntries] = useState([]);
  const [exitEvidence, setExitEvidence] = useState({});
  const [recordExit, setRecordExit] = useState(false);
  const [supportReference, setSupportReference] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !basketId) return;
    let active = true;
    setBusy(true);
    setPreview(null);
    setSupportReference('');
    previewManualBasketExit(basketId, configData)
      .then(payload => {
        if (!active) return;
        const next = payload?.preview;
        setPreview(next);
        // A cancelled recommendation may still need its recorded position flattened, but it must not accept a new entry.
        setEntries(next?.recommendationCancelled ? [] : (next?.contracts || []).filter(contract => contract.missingEntryLots > 0).map(contract => evidence({symbol: contract.symbol, quantity: contract.missingEntryLots}, false)));
        setRecordExit((next?.positions || []).length > 0);
      })
      .catch(error => active && Alert.alert('Unable to inspect basket', messageOf(error)))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [visible, basketId, configData]);

  const projectedExits = useMemo(() => {
    if (!preview) return [];
    const rows = new Map(preview.positions.map(position => [position.symbol, {symbol: position.symbol, quantity: position.openLots, exitSide: position.exitSide}]));
    entries.filter(entry => entry.enabled).forEach(entry => {
      const contract = preview.contracts.find(item => item.symbol === entry.symbol);
      const row = rows.get(entry.symbol);
      rows.set(entry.symbol, {symbol: entry.symbol, quantity: (row?.quantity || 0) + Number(entry.quantity), exitSide: row?.exitSide || (contract.entrySide === 'BUY' ? 'SELL' : 'BUY')});
    });
    return [...rows.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [preview, entries]);

  useEffect(() => {
    setExitEvidence(current => Object.fromEntries(projectedExits.map(row => [row.symbol, {...evidence(row), ...(current[row.symbol] || {}), quantity: row.quantity}])));
  }, [projectedExits]);

  const updateEntry = (symbol, field, value) => setEntries(current => current.map(item => item.symbol === symbol ? {...item, [field]: value} : item));
  const updateExit = (symbol, field, value) => setExitEvidence(current => ({...current, [symbol]: {...current[symbol], [field]: value}}));

  const submitConfirmed = async () => {
    const selectedEntries = entries.filter(item => item.enabled);
    const exits = recordExit ? projectedExits.map(row => exitEvidence[row.symbol]) : [];
    try {
      setBusy(true);
      const normalize = item => ({symbol: item.symbol, quantity: Number(item.quantity), price: Number(item.price), executedAt: new Date(item.executedAt).toISOString()});
      await applyManualBasketExit({basketId, familyToken: preview.familyToken, evidenceReference: supportReference.trim(), entries: selectedEntries.map(normalize), exits: exits.map(normalize)}, configData);
      Alert.alert('Basket updated', 'Your manual broker trades have been recorded.');
      await onSuccess?.();
      onClose?.();
    } catch (error) {
      Alert.alert('Unable to record trades', messageOf(error));
    } finally {
      setBusy(false);
    }
  };

  const indicativeLotsFor = symbol => preview?.contracts?.find(row => row.symbol === symbol)?.indicativeLots || 0;

  const submit = () => {
    const selectedEntries = entries.filter(item => item.enabled);
    const exits = recordExit ? projectedExits.map(row => exitEvidence[row.symbol]) : [];
    if (!selectedEntries.length && !exits.length) return Alert.alert('Select a trade', 'Select a manual entry or the full basket exit.');
    const badQuantity = selectedEntries.find(badLots);
    if (badQuantity) return Alert.alert('Check lots', `Lots for ${badQuantity.symbol} must be a whole number of 1 or more.`);
    const badExitQuantity = exits.find(badLots);
    if (badExitQuantity) return Alert.alert('Check exit lots', `Exit lots for ${badExitQuantity.symbol} must be a whole number of 1 or more.`);
    const exitAboveOpenLots = exits.find(item => {
      const openLots = projectedExits.find(row => row.symbol === item.symbol)?.quantity || 0;
      return Number(item.quantity) > Number(openLots);
    });
    if (exitAboveOpenLots) {
      const openLots = projectedExits.find(row => row.symbol === exitAboveOpenLots.symbol)?.quantity || 0;
      return Alert.alert(
        'Exit lots exceed open position',
        `You can report at most ${openLots} lot(s) for ${exitAboveOpenLots.symbol}, because that is the recorded open position. Reduce the exit lots to continue.`,
      );
    }
    const missing = [...selectedEntries, ...exits].find(invalid);
    if (missing) return Alert.alert('Details required', `Enter a positive price and valid execution time for ${missing.symbol}.`);
    // Basket lots are indicative, so a multiple is normal — but an audited position record is not easily undone, so show anything above the indicative size before confirming.
    const scaled = selectedEntries
      .map(item => ({item, indicative: indicativeLotsFor(item.symbol)}))
      .filter(({item, indicative}) => indicative > 0 && Number(item.quantity) > indicative);
    const scaleNote = scaled.length ? `\n\n${scaled.map(({item, indicative}) => `${item.symbol}: ${item.quantity} lot(s), indicative size ${indicative}`).join('\n')}` : '';
    Alert.alert('Confirm manual trades', `Record these completed broker executions centrally? Historical order details will remain visible.${scaleNote}`, [{text: 'Cancel', style: 'cancel'}, {text: 'Confirm', style: 'destructive', onPress: submitConfirmed}]);
  };

  const inputs = (item, update, options = {}) => <>
    <Text style={styles.inputLabel}>
      {options.quantityLabel || 'Filled lots'}
      {options.maxQuantity ? ` (maximum ${options.maxQuantity})` : ''}
    </Text>
    <TextInput
      style={styles.input}
      value={String(item.quantity)}
      onChangeText={value => {
        const digits = value.replace(/[^0-9]/g, '');
        const capped = options.maxQuantity && Number(digits) > Number(options.maxQuantity)
          ? String(options.maxQuantity)
          : digits;
        update(item.symbol, 'quantity', capped);
      }}
      keyboardType="number-pad"
      placeholder="Number of lots"
    />
    {options.maxQuantity ? <Text style={styles.fieldHelp}>Prefilled from your recorded open position. You may reduce it for a partial manual exit, but cannot exceed {options.maxQuantity} lot(s).</Text> : null}
    <Text style={styles.inputLabel}>{options.priceLabel || 'Average entry price'}</Text>
    <TextInput style={styles.input} value={item.price} onChangeText={value => update(item.symbol, 'price', value)} keyboardType="decimal-pad" placeholder="Price shown in broker order book" />
    <Text style={styles.inputLabel}>Execution time</Text>
    <TextInput style={styles.input} value={item.executedAt} onChangeText={value => update(item.symbol, 'executedAt', value)} placeholder="YYYY-MM-DDTHH:mm:ss" autoCapitalize="none" />
  </>;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.header}><Text style={styles.title}>Record manual basket entry / exit</Text><TouchableOpacity onPress={onClose}><Text style={styles.close}>Close</Text></TouchableOpacity></View>
      <Text style={styles.help}>Use this only to report a completed trade placed directly in your broker account. This form never places an order.</Text>
      {busy && !preview ? <ActivityIndicator style={styles.loader} /> : preview ? <ScrollView keyboardShouldPersistTaps="handled">
        {preview && <Text style={styles.family}>Related basket IDs: {preview.relatedBasketIds.join(', ')}</Text>}
        {preview?.recommendationCancelled && <Text style={styles.cancelled}>This recommendation was cancelled, so a new entry cannot be recorded against it. Contact support if you executed it before it was cancelled. Any position already recorded can still be exited below.</Text>}
        {entries.map(item => { const contract = preview.contracts.find(row => row.symbol === item.symbol); return <View key={`entry-${item.symbol}`} style={styles.leg}><View style={styles.toggle}><Text style={styles.symbol}>Record {contract.entrySide} entry: {item.symbol}</Text><Switch value={item.enabled} onValueChange={value => updateEntry(item.symbol, 'enabled', value)} /></View>{item.enabled && <><Text style={styles.help}>Indicative size {contract.indicativeLots} lot(s) — baskets are indicative only. Enter the lots you actually filled at your broker, whatever size you traded.</Text>{inputs(item, updateEntry)}</>}</View>; })}
        {projectedExits.length > 0 && (
          <View style={[styles.toggle, styles.exitToggle]}><Text style={styles.toggleText}>I also manually exited the entire resulting open basket</Text><Switch value={recordExit} onValueChange={setRecordExit} /></View>
        )}
        {recordExit && projectedExits.map(row => <View key={`exit-${row.symbol}`} style={styles.leg}><Text style={styles.symbol}>{row.exitSide} exit: {row.symbol}</Text>{inputs(exitEvidence[row.symbol] || evidence(row), updateExit, {quantityLabel: 'Exit lots', priceLabel: 'Average exit price', maxQuantity: row.quantity})}</View>)}
        {!preview?.positions?.length && !entries.length && !preview?.recommendationCancelled && <Text style={styles.empty}>This basket is already fully reconciled.</Text>}
        {(entries.length > 0 || preview?.positions?.length > 0) && <><TextInput style={styles.input} value={supportReference} onChangeText={setSupportReference} placeholder="Support/evidence reference (optional)" /><Text style={styles.help}>Entries create audited Markup position records; exits flatten the resulting position. Order history remains visible.</Text><TouchableOpacity style={[styles.submit, busy && styles.disabled]} disabled={busy} onPress={submit}>{busy ? <ActivityIndicator color={designColor('fff')} /> : <Text style={styles.submitText}>Record manual trades</Text>}</TouchableOpacity></>}
      </ScrollView> : null}
    </View></View></Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end'}, sheet: {backgroundColor: designColor('fff'), maxHeight: '90%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}, title: {fontSize: 18, fontWeight: '700', color: designColor('111827'), flex: 1}, close: {color: designColor('2563eb'), padding: 8}, help: {fontSize: 12, color: designColor('6b7280'), marginVertical: 10}, loader: {marginVertical: 40},
  family: {fontSize: 11, color: designColor('92400e'), backgroundColor: designColor('fffbeb'), padding: 10, borderRadius: 6, marginBottom: 10}, empty: {color: designColor('047857'), marginVertical: 16}, cancelled: {fontSize: 11, color: designColor('9f1239'), backgroundColor: designColor('fff1f2'), padding: 10, borderRadius: 6, marginBottom: 10}, leg: {borderWidth: StyleSheet.hairlineWidth, borderColor: designColor('d1d5db'), borderRadius: 8, padding: 12, marginBottom: 10}, symbol: {fontSize: 13, fontWeight: '700', color: designColor('111827'), flex: 1}, inputLabel: {fontSize: 12, fontWeight: '600', color: designColor('374151'), marginTop: 10}, fieldHelp: {fontSize: 11, color: designColor('6b7280'), lineHeight: 16, marginTop: 5},
  toggle: {flexDirection: 'row', alignItems: 'center', gap: 8}, toggleText: {fontSize: 13, fontWeight: '600', color: designColor('7f1d1d'), flex: 1}, exitToggle: {backgroundColor: designColor('fff1f2'), borderRadius: 8, padding: 12, marginBottom: 10}, input: {borderWidth: 1, borderColor: designColor('d1d5db'), borderRadius: 7, paddingHorizontal: 11, paddingVertical: 9, marginTop: 7, color: designColor('111827')}, fixedQty: {fontSize: 12, color: designColor('374151'), marginTop: 5},
  submit: {backgroundColor: designColor('b91c1c'), borderRadius: 7, alignItems: 'center', padding: 12, marginTop: 14, marginBottom: 8}, disabled: {opacity: 0.55}, submitText: {color: designColor('fff'), fontWeight: '700'},
});

export default ManualBasketExitModal;
