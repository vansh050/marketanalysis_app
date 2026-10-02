import React, {useEffect, useRef, useState} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, StyleSheet} from 'react-native';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {normalizeInvestmentBroker, resolveInvestmentModelId} from '../../utils/investmentUpdate';
import {investmentTarget, investmentEntry} from '../../utils/investmentTarget';

import { designColor } from '../../design/literalTokens';

const money = value => Number(value || 0).toLocaleString('en-IN', {maximumFractionDigits: 2});
const signedMoney = value => `${Number(value) < 0 ? '−' : '+'}₹${money(Math.abs(Number(value)))}`;

export default function ModifyInvestment({modifyInvestmentModal, setModifyInvestmentModal,
  strategyDetails, userEmail, getStrategyDetails, latestRebalance, userBroker}) {
  const {configData} = useTrade();
  const config = useConfig();
  const theme = config?.themeColor || designColor('0056b7');
  const model = (strategyDetails?.model_name || strategyDetails?.name || '').trim();
  const broker = normalizeInvestmentBroker(userBroker) || 'DummyBroker';
  const advisor = configData?.config?.REACT_APP_HEADER_NAME || strategyDetails?.advisor;
  const modelId = resolveInvestmentModelId(latestRebalance, strategyDetails);
  const [mode, setMode] = useState('full');
  const [entered, setEntered] = useState('');
  const [includePnl, setIncludePnl] = useState(true);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const attempt = useRef(null);
  const pnlPreference = useRef(null);
  const headers = () => ({'Content-Type': 'application/json', 'X-Advisor-Subdomain': advisor,
    'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET)});

  useEffect(() => {
    setEntered(''); setMode('full'); setIncludePnl(true); attempt.current = null; pnlPreference.current = null;
  }, [modifyInvestmentModal, model, broker, userEmail]);

  useEffect(() => {
    let active = true;
    setIncludePnl(pnlPreference.current !== false); setPreview(null); attempt.current = null;
    if (!modifyInvestmentModal || !userEmail || !model) return undefined;
    setLoading(true);
    axios.post(`${server.ccxtServer.baseUrl}rebalance/investment-preview`, {
      userEmail, userBroker: broker, modelName: model, advisor, model_id: modelId || '',
    }, {headers: headers()}).then(({data}) => {
      if (active) {
        setPreview(data);
        setIncludePnl(data?.pnlAvailable === true && pnlPreference.current !== false);
      }
    }).catch(() => {
      if (active) { setIncludePnl(false); setPreview({status: 1, pnlAvailable: false,
        message: 'Preview unavailable. You can still enter a total without P&L.'}); }
    }).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifyInvestmentModal, userEmail, model, broker, advisor, modelId, refresh]);

  const target = investmentTarget({mode, entered, preview, includePnl});
  const min = Number(strategyDetails?.minInvestment) || 0;
  const max = Number(strategyDetails?.maxNetWorth) || Infinity;
  const disabled = busy || !target || target.total < min || target.total > max;
  const close = () => {if (!busy) setModifyInvestmentModal(false);};

  const confirm = async () => {
    if (disabled) return;
    try {
      const identity = JSON.stringify({mode, entered, includePnl, quote: preview?.pnlQuoteId});
      if (attempt.current?.identity !== identity) attempt.current = {identity, entry: investmentEntry({
        mode, entered, preview, includePnl, dateTime: new Date().toISOString(),
      })};
      setBusy(true);
      const {data} = await axios.post(`${server.ccxtServer.baseUrl}rebalance/insert-user-doc`, {
        userEmail, model, advisor, model_id: modelId, userBroker: broker,
        subscriptionAmountRaw: [attempt.current.entry],
      }, {headers: headers()});
      if (data?.status === 1 || data?.status === 2 || data?.success === false)
        throw new Error(data.message || 'Investment update was not saved.');
      getStrategyDetails?.();
      setModifyInvestmentModal(false);
      Toast.show({type: 'success', text1: 'Total investment instruction updated',
        text2: 'Calculate a fresh plan. No broker cash was transferred.'});
    } catch (error) {
      Toast.show({type: 'error', text1: 'Investment not updated',
        text2: error?.response?.data?.message || error.message || 'Please try again.'});
    } finally {setBusy(false);}
  };

  const choice = (label, selected, onPress, isDisabled = false) =>
    <TouchableOpacity accessibilityRole="radio" accessibilityState={{selected, disabled: isDisabled || busy}}
      disabled={isDisabled || busy} onPress={onPress} style={[styles.choice, selected && {borderColor: theme}, isDisabled && {opacity: .5}]}>
      <Text style={styles.text}>{selected ? '● ' : '○ '}{label}</Text>
    </TouchableOpacity>;

  return (
    <Modal visible={modifyInvestmentModal} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}><View style={styles.panel}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.title}>Update total investment</Text>
          <Text style={styles.text}>Choose an amount, then decide whether to include accrued trading P&L after costs. This does not add cash to your broker.</Text>
          {choice('Enter total amount', mode === 'full', () => setMode('full'))}
          {choice('Increase investment', mode === 'topup', () => setMode('topup'))}
          {mode === 'topup' && <Text style={styles.text}>Investment amount before P&L: {preview?.status === 0 ? `₹${money(preview.baseInvestmentAmount)}` : 'Loading or unavailable'}</Text>}
          <Text style={styles.label}>{mode === 'topup' ? 'Increase the investment amount by' : 'Total investment amount before P&L'}</Text>
          <TextInput testID="modify-investment-amount" accessibilityLabel="Investment amount" keyboardType="decimal-pad"
            value={entered} editable={!busy} placeholder="Enter amount" placeholderTextColor={designColor('666')} style={styles.input}
            onChangeText={value => {if (/^\d*(\.\d{0,2})?$/.test(value)) setEntered(value);}} />
          <Text style={styles.label}>P&L choice</Text>
          {choice('Do not include P&L — use the amount above', !includePnl, () => { pnlPreference.current = false; setIncludePnl(false); })}
          {choice('Include net trading P&L, including any loss', includePnl, () => { pnlPreference.current = true; setIncludePnl(true); }, preview?.pnlAvailable !== true || loading)}
          {loading ? <ActivityIndicator color={theme} /> : preview?.pnlAvailable ? <View style={styles.summary}>
            <Text style={styles.text}>Trading P&L: {signedMoney(preview.grossPnl)}</Text>
            <Text style={styles.text}>Estimated trading costs incurred: ₹{money(preview.estimatedIncurredCosts)}</Text>
            <Text style={styles.label}>Net P&L adjustment: {signedMoney(preview.netPnl)}</Text>
            <Text style={styles.small}>As of {new Date(preview.asOf).toLocaleString()}. Costs are estimates, not final broker charges. Excludes future exit charges, dividends and income tax.</Text>
          </View> : <Text style={styles.small}>{preview?.message || 'P&L unavailable. You can update without P&L.'}</Text>}
          <TouchableOpacity disabled={busy || loading} onPress={() => setRefresh(value => value + 1)}><Text style={[styles.label, {color: theme}]}>Refresh preview</Text></TouchableOpacity>
          {target && <View style={styles.summary}>
            <Text style={styles.text}>Investment amount before P&L: ₹{money(target.base)}</Text>
            <Text style={styles.text}>P&L included: {includePnl ? signedMoney(target.pnl) : 'No'}</Text>
            <Text style={styles.label}>Update total investment to ₹{money(target.total)}</Text>
            <Text style={styles.small}>This can increase or reduce the model allocation. Calculate checks available funding. Market changes will not silently change this confirmed target.</Text>
          </View>}
          {target && (target.total < min || target.total > max) && <Text accessibilityRole="alert" style={styles.text}>
            Final amount must be at least ₹{money(min)}{Number.isFinite(max) ? ` and no more than ₹${money(max)}` : ''}.
          </Text>}
          <TouchableOpacity testID="modify-investment-confirm" accessibilityRole="button" disabled={disabled} onPress={confirm}
            style={[styles.button, {backgroundColor: theme}, disabled && {opacity: .5}]}>
            {busy ? <ActivityIndicator color={designColor('fff')} /> : <Text style={styles.buttonText}>
              {target ? `Update total investment to ₹${money(target.total)}` : 'Update total investment'}
            </Text>}
          </TouchableOpacity>
          <TouchableOpacity testID="modify-investment-cancel" disabled={busy} onPress={close}><Text style={[styles.label, {textAlign: 'center'}]}>Cancel</Text></TouchableOpacity>
        </ScrollView>
      </View></View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, justifyContent: 'center', padding: 18, backgroundColor: designColor('0008')},
  panel: {maxHeight: '90%', backgroundColor: designColor('fff'), borderRadius: 14},
  content: {padding: 20, gap: 12},
  title: {fontSize: 21, fontWeight: '700', color: designColor('111')},
  text: {fontSize: 14, lineHeight: 21, color: designColor('333')},
  label: {fontSize: 14, fontWeight: '600', color: designColor('222')},
  small: {fontSize: 12, lineHeight: 18, color: designColor('555')},
  input: {borderWidth: 1, borderColor: designColor('aaa'), borderRadius: 8, padding: 12, fontSize: 18, color: designColor('111')},
  choice: {borderWidth: 1, borderColor: designColor('ddd'), borderRadius: 8, padding: 12},
  summary: {backgroundColor: designColor('f4f6f8'), borderRadius: 8, padding: 12, gap: 8},
  button: {borderRadius: 8, padding: 14},
  buttonText: {color: designColor('fff'), textAlign: 'center', fontWeight: '600'},
});
