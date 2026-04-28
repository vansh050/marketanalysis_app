/**
 * ExecutionStatusScreen — Step 3 of rebalance flow.
 * Shows order preview with "Place Order" button (manual trigger, matching web master).
 * Handles Zerodha/Fyers WebView basket, DummyBroker, and normal broker execution.
 *
 * Route params:
 *   portfolio, userEmail, broker, brokerCredentials, orders[], modelId,
 *   modelName, advisor, uniqueId, caPendingInfo[]
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import useModalStore from '../../GlobalUIModals/modalStore';
import eventEmitter from '../../components/EventEmitter';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

// Market hours check (9:15 AM – 3:30 PM IST, Mon–Fri)
const isMarketOpen = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 555 && mins <= 930;
};

const ExecutionStatusScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    portfolio, userEmail, broker, brokerCredentials,
    orders, modelId, modelName, advisor, uniqueId, caPendingInfo,
  } = route.params || {};

  const showAlert = useModalStore((state) => state.showAlert);

  // States: confirm, executing, done, error
  const [state, setState] = useState('confirm');
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const executing = state === 'executing';

  const isDummyBroker = broker === 'DummyBroker' || !broker;

  // ── Execute orders ──
  const executeOrders = useCallback(async () => {
    setState('executing');
    setResults([]);
    setErrorMsg(null);

    try {
      const trades = orders.map((o) => ({
        tradingSymbol: o.symbol || o.tradingSymbol,
        transactionType: o.transactionType || 'BUY',
        exchange: o.exchange || 'NSE',
        quantity: o.quantity,
        price: o.price,
      }));

      const body = {
        user_broker: broker || 'DummyBroker',
        user_email: userEmail,
        trades,
        model_id: modelId,
        modelName,
        advisor,
        unique_id: uniqueId,
        caPendingInfo: caPendingInfo || [],
      };

      // Add broker credentials
      if (brokerCredentials && !isDummyBroker) {
        if (brokerCredentials.jwtToken) body.accessToken = brokerCredentials.jwtToken;
        if (brokerCredentials.apiKey) body.apiKey = brokerCredentials.apiKey;
        if (brokerCredentials.secretKey) body.secretKey = brokerCredentials.secretKey;
        if (brokerCredentials.clientCode) body.clientCode = brokerCredentials.clientCode;
      }

      const resp = await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/process-trade`,
        body,
        { headers: getHeaders(), timeout: 30000 },
      );

      const data = resp.data?.data || resp.data;
      const orderResults = data?.results || data?.response || data?.order_results || [];

      const parsed = Array.isArray(orderResults)
        ? orderResults.map((r) => ({
            symbol: r.symbol || r.tradingSymbol || '',
            transactionType: r.transactionType || '',
            quantity: r.quantity || 0,
            status: normalizeStatus(r.orderStatus || r.status || ''),
            message: r.message || r.error || '',
            orderId: r.orderId || '',
          }))
        : [];

      // Update subscriber execution status
      const successCount = parsed.filter((r) => r.status === 'success').length;
      const execStatus = successCount === parsed.length ? 'executed' :
                         successCount > 0 ? 'partial' : 'toExecute';

      await axios.put(
        `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
        { userEmail, modelName, model_id: modelId, executionStatus: execStatus, user_broker: broker || 'DummyBroker' },
        { headers: getHeaders(), timeout: 15000 },
      ).catch((e) => console.warn('[Execution] update status failed:', e.message));

      // Enroll in status check queue
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        { userEmail, modelName, advisor, broker: broker || 'DummyBroker' },
        { headers: getHeaders(), timeout: 10000 },
      ).catch(() => {});

      // Emit refresh event
      eventEmitter.emit('refreshEvent', { source: 'rebalance-execution' });

      setResults(parsed);
      setState('done');
    } catch (e) {
      console.error('[Execution] error:', e);
      setErrorMsg(e.response?.data?.message || e.message || 'Order placement failed');
      setState('error');
    }
  }, [orders, userEmail, broker, brokerCredentials, modelId, modelName, advisor, uniqueId, caPendingInfo, isDummyBroker]);

  const normalizeStatus = (raw) => {
    const s = (raw || '').toLowerCase();
    if (['success', 'complete', 'completed', 'traded', 'executed', 'filled'].includes(s)) return 'success';
    if (['rejected', 'failed', 'cancelled', 'expired'].includes(s)) return 'failed';
    return 'pending';
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  // ── Render ──
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (!executing) navigation.goBack(); }} style={styles.backBtn} disabled={executing}>
          <Text style={[styles.backBtnText, executing && { opacity: 0.3 }]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trade Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status section */}
        {state === 'confirm' && (
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>Review & Confirm Orders</Text>
            <Text style={styles.statusDesc}>{orders?.length || 0} orders ready. Tap "Place Order" below to execute.</Text>
          </View>
        )}

        {executing && (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color="#1A237E" />
            <Text style={[styles.statusTitle, { marginTop: 8 }]}>Placing orders...</Text>
          </View>
        )}

        {state === 'done' && (
          <View style={[styles.statusBox, failedCount === 0 ? styles.statusSuccess : styles.statusPartial]}>
            <Text style={styles.statusTitle}>
              {failedCount === 0 ? 'All Orders Placed' : `${successCount} Placed, ${failedCount} Failed`}
            </Text>
          </View>
        )}

        {state === 'error' && (
          <View style={[styles.statusBox, styles.statusError]}>
            <Text style={styles.statusTitle}>Execution Failed</Text>
            <Text style={styles.statusDesc}>{errorMsg}</Text>
          </View>
        )}

        {/* Order cards */}
        {state === 'confirm' && orders?.map((o, i) => (
          <View key={`order-${i}`} style={styles.orderRow}>
            <View style={[styles.badge, (o.transactionType || '').toUpperCase() === 'BUY' ? styles.badgeBuy : styles.badgeSell]}>
              <Text style={styles.badgeText}>{(o.transactionType || 'BUY').toUpperCase()}</Text>
            </View>
            <Text style={styles.orderSymbol} numberOfLines={1}>{o.symbol || o.tradingSymbol}</Text>
            <Text style={styles.orderQty}>Qty: {o.quantity}</Text>
            <Text style={styles.orderPrice}>₹{Number(o.price || 0).toFixed(1)}</Text>
          </View>
        ))}

        {state === 'done' && results.map((r, i) => (
          <View key={`result-${i}`} style={styles.orderRow}>
            <View style={[styles.badge,
              r.status === 'success' ? styles.badgeBuy :
              r.status === 'failed' ? styles.badgeSell : styles.badgePending]}>
              <Text style={styles.badgeText}>{r.status === 'success' ? '✓' : r.status === 'failed' ? '✗' : '...'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderSymbol}>{r.symbol}</Text>
              {r.message ? <Text style={styles.errorMsg}>{r.message}</Text> : null}
            </View>
            <Text style={styles.orderQty}>Qty: {r.quantity}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom CTAs */}
      <View style={styles.bottomSection}>
        {state === 'confirm' && (
          <>
            <TouchableOpacity
              style={[styles.placeOrderBtn, !isMarketOpen() && styles.placeOrderBtnDisabled]}
              onPress={isMarketOpen() ? executeOrders : null}
              disabled={!isMarketOpen()}
            >
              <Text style={styles.placeOrderBtnText}>
                {isMarketOpen() ? 'Place Order' : 'Market Closed'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.goBackBtnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}

        {state === 'done' && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => {
            navigation.popToTop();
          }}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}

        {state === 'error' && (
          <>
            <TouchableOpacity style={styles.retryBtn} onPress={executeOrders}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.goBackBtnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1A237E',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 140 },

  statusBox: {
    padding: 18, backgroundColor: '#E8EAF6', borderRadius: 14, marginBottom: 16, alignItems: 'center',
  },
  statusSuccess: { backgroundColor: '#E8F5E9' },
  statusPartial: { backgroundColor: '#FFF8E1' },
  statusError: { backgroundColor: '#FFEBEE' },
  statusTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  statusDesc: { fontSize: 13, color: '#666', marginTop: 6, textAlign: 'center', lineHeight: 20 },

  orderRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10 },
  badgeBuy: { backgroundColor: '#E8F5E9' },
  badgeSell: { backgroundColor: '#FFEBEE' },
  badgePending: { backgroundColor: '#FFF8E1' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  orderSymbol: { flex: 1, fontSize: 13, fontWeight: '600', color: '#333' },
  orderQty: { fontSize: 12, color: '#666', marginRight: 12 },
  orderPrice: { fontSize: 12, fontWeight: '500', color: '#555' },
  errorMsg: { fontSize: 11, color: '#EF5350', marginTop: 2 },

  bottomSection: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16,
    backgroundColor: '#F8F9FC', borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  placeOrderBtn: { backgroundColor: '#2E7D32', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  placeOrderBtnDisabled: { backgroundColor: '#999' },
  placeOrderBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  goBackBtn: { paddingVertical: 12, alignItems: 'center' },
  goBackBtnText: { color: '#1A237E', fontSize: 14, fontWeight: '600' },
  doneBtn: { backgroundColor: '#1A237E', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  retryBtn: { backgroundColor: '#FF9800', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ExecutionStatusScreen;
