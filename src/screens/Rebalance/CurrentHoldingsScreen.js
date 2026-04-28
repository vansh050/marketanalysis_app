/**
 * CurrentHoldingsScreen — Step 1 of rebalance flow.
 * Fetches user's current portfolio holdings and lets them verify/edit before rebalancing.
 * Ported from Tidi's CurrentHoldingsPreviewPage.dart.
 *
 * Route params:
 *   portfolio: { modelName, advisor, id, ... }
 *   userEmail: string
 *   broker: string (broker name)
 *   brokerCredentials: { jwtToken, apiKey, secretKey, clientCode, ... }
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

const CurrentHoldingsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { portfolio, userEmail, broker, brokerCredentials } = route.params || {};

  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editableHoldings, setEditableHoldings] = useState([]);

  const modelName = portfolio?.modelName || portfolio?.model_name;

  const fetchHoldings = useCallback(async () => {
    try {
      const resp = await axios.get(
        `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(modelName)}`,
        { headers: getHeaders(), timeout: 15000 },
      );
      const data = resp.data?.data || resp.data;
      const netPf = data?.user_net_pf_model;

      if (Array.isArray(netPf) && netPf.length > 0) {
        // Get latest snapshot
        const latest = netPf[netPf.length - 1];
        const orderResults = latest?.order_results || latest;
        if (Array.isArray(orderResults)) {
          const parsed = orderResults
            .filter((o) => (o.quantity || 0) > 0)
            .map((o) => ({
              symbol: o.symbol || o.tradingSymbol || '',
              quantity: Number(o.quantity || 0),
              averagePrice: Number(o.averagePrice || o.average_price || 0),
              ltp: Number(o.ltp || o.lastPrice || o.averagePrice || 0),
              exchange: o.exchange || 'NSE',
            }));
          setHoldings(parsed);
          setEditableHoldings(parsed.map((h) => ({ ...h })));
        }
      }
    } catch (e) {
      console.warn('[CurrentHoldings] fetch error:', e.message);
    }
    setLoading(false);
  }, [userEmail, modelName]);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  const heldSymbols = editMode
    ? new Set(editableHoldings.filter((h) => h.quantity > 0).map((h) => h.symbol))
    : new Set(holdings.filter((h) => h.quantity > 0).map((h) => h.symbol));

  const handleContinue = () => {
    navigation.navigate('RebalanceReview', {
      portfolio,
      userEmail,
      broker,
      brokerCredentials,
      heldSymbols: Array.from(heldSymbols),
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A237E" />
        <Text style={styles.loadingText}>Loading holdings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify Your Holdings</Text>
        <TouchableOpacity onPress={() => setEditMode(!editMode)} style={styles.editBtn}>
          <Text style={styles.editBtnText}>{editMode ? 'Done' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Review your current holdings before rebalancing. These will be used to calculate buy/sell orders.
          </Text>
        </View>

        {holdings.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No existing holdings found. This appears to be a fresh portfolio.</Text>
          </View>
        ) : (
          <>
            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>Symbol</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Avg Price</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>LTP</Text>
            </View>

            {(editMode ? editableHoldings : holdings).map((h, idx) => (
              <View key={`${h.symbol}-${idx}`} style={styles.tableRow}>
                <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{h.symbol}</Text>
                {editMode ? (
                  <TextInput
                    style={[styles.td, styles.editInput, { flex: 1 }]}
                    value={String(h.quantity)}
                    onChangeText={(v) => {
                      const updated = [...editableHoldings];
                      updated[idx] = { ...updated[idx], quantity: parseInt(v, 10) || 0 };
                      setEditableHoldings(updated);
                    }}
                    keyboardType="number-pad"
                  />
                ) : (
                  <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>{h.quantity}</Text>
                )}
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                  ₹{h.averagePrice.toFixed(1)}
                </Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                  ₹{h.ltp.toFixed(1)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomSection}>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>Confirm & Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: '#1A237E',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  editBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  scrollContent: { padding: 16, paddingBottom: 100 },

  infoBox: { padding: 14, backgroundColor: '#E3F2FD', borderRadius: 12, marginBottom: 16 },
  infoText: { fontSize: 13, color: '#1565C0', lineHeight: 20 },

  emptyBox: { padding: 24, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },

  tableHeader: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#E8EAF6', borderRadius: 8 },
  th: { fontSize: 11, fontWeight: '700', color: '#555', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', backgroundColor: '#fff',
  },
  td: { fontSize: 13, color: '#333' },
  editInput: {
    backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, textAlign: 'center',
  },

  bottomSection: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16,
    backgroundColor: '#F8F9FC', borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  continueBtn: { backgroundColor: '#1A237E', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default CurrentHoldingsScreen;
