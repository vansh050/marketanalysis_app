/**
 * RebalanceReviewScreen — Step 2 of rebalance flow.
 * Shows preference selection, calculates rebalance, displays buy/sell orders,
 * runs EDIS pre-check, then navigates to ExecutionStatusScreen.
 *
 * Route params:
 *   portfolio: { modelName, advisor, id, rebalanceHistory, ... }
 *   userEmail: string
 *   broker: string
 *   brokerCredentials: { jwtToken, apiKey, secretKey, clientCode, ... }
 *   heldSymbols: string[] (from CurrentHoldingsScreen)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import {
  buildBrokerPayloadFields,
  isFundsErrorOrMissing,
  isRebalanceErrorResponse,
  isSubscriptionAmountError,
  isLowAllowedBalanceError,
  isBrokerAuthError,
  checkPortfolioShortfall,
} from '../../utils/rebalanceHelpers';
import useModalStore from '../../GlobalUIModals/modalStore';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

const RebalanceReviewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { portfolio, userEmail, broker, brokerCredentials, heldSymbols } = route.params || {};
  const showAlert = useModalStore((state) => state.showAlert);

  const modelName = portfolio?.modelName || portfolio?.model_name;
  const advisor = portfolio?.advisor;
  const modelId = portfolio?.id || portfolio?.model_id ||
    (portfolio?.rebalanceHistory?.length > 0 ? portfolio.rebalanceHistory[portfolio.rebalanceHistory.length - 1].model_Id : '');

  // ── State ──
  const [rebalanceFlag, setRebalanceFlag] = useState(null); // null = show preference, 0 or 1
  const [loading, setLoading] = useState(false);
  const [buyOrders, setBuyOrders] = useState([]);
  const [sellOrders, setSellOrders] = useState([]);
  const [uniqueId, setUniqueId] = useState(null);
  const [caPendingInfo, setCaPendingInfo] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [alreadyAligned, setAlreadyAligned] = useState(false);

  const isDummyBroker = broker === 'DummyBroker' || !broker;

  // ── Calculate rebalance ──
  const calculateRebalance = useCallback(async (flag) => {
    setLoading(true);
    setErrorMsg(null);
    setBuyOrders([]);
    setSellOrders([]);

    try {
      const body = {
        userEmail,
        modelName,
        advisor,
        model_id: modelId,
        userBroker: broker || 'DummyBroker',
        userFund: '0',
        flag,
      };

      // Add broker-specific credentials
      if (brokerCredentials && broker && broker !== 'DummyBroker') {
        const brokerFields = buildBrokerPayloadFields(
          broker, brokerCredentials, null, Config.REACT_APP_ANGEL_ONE_API_KEY,
        );
        Object.assign(body, brokerFields);
      }

      const resp = await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/calculate`,
        body,
        { headers: getHeaders(), timeout: 30000 },
      );

      const data = resp.data?.data || resp.data;

      // Portfolio shortfall — INFORMATIONAL ONLY, never a blocker.
      // Backend tags shortfall responses with status === 1, which would
      // otherwise be intercepted by `isRebalanceErrorResponse` below. Detect
      // and short-circuit the error path here so trades (or the
      // "already aligned" state with 0 trades) render normally.
      // See ccxt-india/rebalancing/rebalancing.py:1826 for backend rationale.
      const shortfall = checkPortfolioShortfall(data);
      if (shortfall?.isShortfall) {
        Alert.alert(
          'Market Value Below Locked Investment',
          `Your portfolio is worth ₹${shortfall.currentValue?.toLocaleString?.() || shortfall.currentValue}, below the ₹${shortfall.requiredAmount?.toLocaleString?.() || shortfall.requiredAmount} you locked in for this model. This is informational only — your share counts still match the model and rebalance proceeds normally.`,
        );
        // Do NOT return — fall through to render trades / already-aligned UI.
      } else if (isRebalanceErrorResponse(data)) {
        // Genuine error path (only when no shortfall is signalled)
        const msg = data?.message || 'Calculation failed';
        if (isBrokerAuthError(msg)) {
          setErrorMsg('Broker session expired. Please reconnect.');
        } else if (isSubscriptionAmountError(msg)) {
          setErrorMsg('Subscription amount not set. Please update your investment amount.');
        } else if (isLowAllowedBalanceError(msg)) {
          setErrorMsg('Investment amount is below the minimum required.');
        } else {
          setErrorMsg(msg);
        }
        setLoading(false);
        return;
      }

      const buy = data?.buy || [];
      const sell = data?.sell || [];

      // Filter sells by held symbols
      const heldSet = new Set((heldSymbols || []).map((s) => s?.toUpperCase()));
      const filteredSell = sell.filter((s) => {
        const sym = (s.symbol || s.tradingSymbol || '').toUpperCase();
        return heldSet.has(sym) || heldSet.size === 0;
      });

      if (buy.length === 0 && filteredSell.length === 0) {
        setAlreadyAligned(true);
      }

      setBuyOrders(buy);
      setSellOrders(filteredSell);
      setUniqueId(data?.uniqueId || data?.unique_id);
      setCaPendingInfo(data?.caPendingInfo || []);
    } catch (e) {
      setErrorMsg(e.response?.data?.message || e.message || 'Failed to calculate rebalance');
    }
    setLoading(false);
  }, [userEmail, modelName, advisor, modelId, broker, brokerCredentials, heldSymbols]);

  // ── Auto-calculate when preference selected ──
  useEffect(() => {
    if (rebalanceFlag !== null) {
      calculateRebalance(rebalanceFlag);
    }
  }, [rebalanceFlag, calculateRebalance]);

  // ── Execute: navigate to ExecutionStatusScreen ──
  const handleExecute = () => {
    const orders = [
      ...buyOrders.map((o) => ({
        ...o, transactionType: 'BUY',
        symbol: o.symbol || o.tradingSymbol,
      })),
      ...sellOrders.map((o) => ({
        ...o, transactionType: 'SELL',
        symbol: o.symbol || o.tradingSymbol,
      })),
    ];

    navigation.navigate('ExecutionStatus', {
      portfolio,
      userEmail,
      broker,
      brokerCredentials,
      orders,
      modelId,
      modelName,
      advisor,
      uniqueId,
      caPendingInfo,
    });
  };

  // ── Mark as already aligned ──
  const handleAlreadyAligned = async () => {
    try {
      await axios.put(
        `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
        { userEmail, modelName, model_id: modelId, executionStatus: 'executed', user_broker: broker || 'DummyBroker' },
        { headers: getHeaders(), timeout: 15000 },
      );
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        { userEmail, modelName, advisor, broker: broker || 'DummyBroker' },
        { headers: getHeaders(), timeout: 10000 },
      ).catch(() => {});
      showAlert('success', 'Already Aligned', 'Your portfolio is already aligned with the model.');
      navigation.goBack();
    } catch (e) {
      showAlert('error', 'Error', 'Failed to update status.');
    }
  };

  // ── Preference selection ──
  if (rebalanceFlag === null) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rebalance Preference</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.prefContent}>
          <Text style={styles.prefTitle}>Choose your rebalance strategy</Text>

          <TouchableOpacity style={styles.prefCard} onPress={() => setRebalanceFlag(1)}>
            <Text style={styles.prefCardTitle}>Optimize Costs (2% Threshold)</Text>
            <Text style={styles.prefCardDesc}>
              Only rebalance stocks where the change exceeds 2% of your capital. Fewer trades, lower brokerage.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.prefCard} onPress={() => setRebalanceFlag(0)}>
            <Text style={styles.prefCardTitle}>Full Rebalance</Text>
            <Text style={styles.prefCardDesc}>
              Align portfolio exactly to the model. Includes all changes, even small ones. Higher trade frequency.
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A237E" />
        <Text style={styles.loadingText}>Calculating rebalance...</Text>
      </View>
    );
  }

  // ── Error ──
  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Calculation Failed</Text>
        <Text style={styles.errorDesc}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => calculateRebalance(rebalanceFlag)}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Already aligned ──
  if (alreadyAligned) {
    return (
      <View style={styles.center}>
        <Text style={styles.alignedIcon}>✓</Text>
        <Text style={styles.alignedTitle}>Already Aligned</Text>
        <Text style={styles.alignedDesc}>Your portfolio matches the model allocation. No trades needed.</Text>
        <TouchableOpacity style={styles.continueBtn} onPress={handleAlreadyAligned}>
          <Text style={styles.continueBtnText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Review trades ──
  const totalOrders = buyOrders.length + sellOrders.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Rebalance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{buyOrders.length} BUY + {sellOrders.length} SELL = {totalOrders} orders</Text>
        </View>

        {/* Buy orders */}
        {buyOrders.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>BUY Orders</Text>
            {buyOrders.map((o, i) => (
              <View key={`buy-${i}`} style={styles.orderRow}>
                <View style={[styles.badge, styles.badgeBuy]}><Text style={styles.badgeText}>BUY</Text></View>
                <Text style={styles.orderSymbol} numberOfLines={1}>{o.symbol || o.tradingSymbol}</Text>
                <Text style={styles.orderQty}>Qty: {o.quantity}</Text>
                <Text style={styles.orderPrice}>₹{Number(o.price || 0).toFixed(1)}</Text>
              </View>
            ))}
          </>
        )}

        {/* Sell orders */}
        {sellOrders.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>SELL Orders</Text>
            {sellOrders.map((o, i) => (
              <View key={`sell-${i}`} style={styles.orderRow}>
                <View style={[styles.badge, styles.badgeSell]}><Text style={styles.badgeText}>SELL</Text></View>
                <Text style={styles.orderSymbol} numberOfLines={1}>{o.symbol || o.tradingSymbol}</Text>
                <Text style={styles.orderQty}>Qty: {o.quantity}</Text>
                <Text style={styles.orderPrice}>₹{Number(o.price || 0).toFixed(1)}</Text>
              </View>
            ))}
          </>
        )}

        {/* Terms */}
        <TouchableOpacity style={styles.checkboxRow} onPress={() => setTermsAccepted(!termsAccepted)}>
          <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
            {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>
            I understand the risks and confirm these orders should be placed.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.executeBtn, !termsAccepted && styles.executeBtnDisabled]}
          onPress={handleExecute}
          disabled={!termsAccepted}
        >
          <Text style={styles.executeBtnText}>
            {isDummyBroker ? 'Confirm Manual Execution' : 'Accept & Execute Rebalance'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1A237E',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Preference selection
  prefContent: { flex: 1, padding: 24, justifyContent: 'center' },
  prefTitle: { fontSize: 20, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 24 },
  prefCard: {
    padding: 20, backgroundColor: '#fff', borderRadius: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E0E0E0',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  prefCardTitle: { fontSize: 16, fontWeight: '700', color: '#1A237E', marginBottom: 8 },
  prefCardDesc: { fontSize: 13, color: '#666', lineHeight: 20 },

  // Error
  errorIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF5350',
    color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center', lineHeight: 56, marginBottom: 16,
  },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  errorDesc: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryBtn: { backgroundColor: '#1A237E', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, marginBottom: 12 },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  goBackBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  goBackBtnText: { color: '#1A237E', fontSize: 14, fontWeight: '600' },

  // Already aligned
  alignedIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#4CAF50',
    color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center', lineHeight: 56, marginBottom: 16,
  },
  alignedTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  alignedDesc: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  continueBtn: { backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12 },
  continueBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Orders review
  scrollContent: { padding: 16, paddingBottom: 100 },
  summaryBox: { padding: 14, backgroundColor: '#E8EAF6', borderRadius: 12, marginBottom: 16, alignItems: 'center' },
  summaryText: { fontSize: 14, fontWeight: '600', color: '#1A237E' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginTop: 12, marginBottom: 8 },

  orderRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  badgeBuy: { backgroundColor: '#E8F5E9' },
  badgeSell: { backgroundColor: '#FFEBEE' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  orderSymbol: { flex: 1, fontSize: 13, fontWeight: '600', color: '#333' },
  orderQty: { fontSize: 12, color: '#666', marginRight: 12 },
  orderPrice: { fontSize: 12, fontWeight: '500', color: '#555' },

  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, paddingHorizontal: 4 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#CCC',
    justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#1A237E', borderColor: '#1A237E' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkboxLabel: { flex: 1, fontSize: 13, color: '#555', lineHeight: 20 },

  bottomSection: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16,
    backgroundColor: '#F8F9FC', borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  executeBtn: { backgroundColor: '#1A237E', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  executeBtnDisabled: { opacity: 0.4 },
  executeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default RebalanceReviewScreen;
