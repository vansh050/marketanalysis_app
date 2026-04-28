/**
 * BrokerSelectionScreen — Generic broker selection page.
 * Replaces GlobalBrokerModals dispatcher + 13 individual modal files.
 *
 * Usage:
 *   navigation.navigate('BrokerSelection', {
 *     onBrokerConnected: (brokerName) => { ... },  // optional callback
 *   });
 *
 * Or for modal-style usage, returns result via navigation:
 *   const result = await navigation.navigate('BrokerSelection');
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
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';

import { brokerRegistry, BROKER_AUTH_TYPE, getApiBrokerName } from '../../config/brokerRegistry';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import useModalStore from '../../GlobalUIModals/modalStore';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

const BrokerSelectionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { onBrokerConnected } = route.params || {};

  const auth = getAuth();
  const userEmail = auth.currentUser?.email;

  const [connectedBrokers, setConnectedBrokers] = useState({});
  const [loading, setLoading] = useState(true);
  const showAlert = useModalStore((state) => state.showAlert);

  // Fetch connected broker statuses
  const fetchBrokerStatuses = useCallback(async () => {
    if (!userEmail) { setLoading(false); return; }
    try {
      const resp = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${encodeURIComponent(userEmail)}`,
        { headers: getHeaders(), timeout: 10000 },
      );
      const user = resp.data?.data || resp.data;
      const status = {};
      // Check connect_broker_status for each broker
      if (user?.connect_broker_status) {
        for (const [broker, val] of Object.entries(user.connect_broker_status)) {
          if (val && val !== 'Disconnected') {
            status[broker.toLowerCase()] = {
              connected: true,
              tokenExpired: val === 'TokenExpired' || val === 'expired',
              broker: broker,
            };
          }
        }
      }
      setConnectedBrokers(status);
    } catch (e) {
      console.warn('[BrokerSelection] Failed to fetch statuses:', e.message);
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => { fetchBrokerStatuses(); }, [fetchBrokerStatuses]);

  const getBrokerStatus = (config) => {
    const entry = connectedBrokers[config.key] ||
                  connectedBrokers[config.name.toLowerCase()] ||
                  connectedBrokers[getApiBrokerName(config).toLowerCase()];
    if (!entry) return 'disconnected';
    if (entry.tokenExpired) return 'expired';
    return 'connected';
  };

  const handleBrokerTap = async (config) => {
    const status = getBrokerStatus(config);

    // If already connected and not expired, just return
    if (status === 'connected') {
      showAlert('info', 'Already Connected', `${config.name} is already connected.`);
      if (onBrokerConnected) onBrokerConnected(config.name);
      navigation.goBack();
      return;
    }

    // Navigate to auth or credential screen based on type
    if (config.authType === BROKER_AUTH_TYPE.OAUTH) {
      navigation.navigate('BrokerAuth', {
        brokerConfig: config,
        onSuccess: () => {
          fetchBrokerStatuses();
          if (onBrokerConnected) onBrokerConnected(config.name);
        },
      });
    } else if (config.authType === BROKER_AUTH_TYPE.CREDENTIAL) {
      navigation.navigate('BrokerCredential', {
        brokerConfig: config,
        onSuccess: () => {
          fetchBrokerStatuses();
          if (onBrokerConnected) onBrokerConnected(config.name);
        },
      });
    } else {
      // HYBRID — go to credential page first (it will open WebView after)
      navigation.navigate('BrokerCredential', {
        brokerConfig: config,
        onSuccess: () => {
          fetchBrokerStatuses();
          if (onBrokerConnected) onBrokerConnected(config.name);
        },
      });
    }
  };

  const handleContinueWithoutBroker = async () => {
    if (!userEmail) return;
    try {
      await axios.put(
        `${server.ccxtServer.baseUrl}comms/no-broker-required/save`,
        { userEmail, noBrokerRequired: true },
        { headers: getHeaders(), timeout: 10000 },
      );
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
        { user_email: userEmail, user_broker: 'DummyBroker' },
        { headers: getHeaders(), timeout: 10000 },
      ).catch(() => {}); // non-critical
    } catch (e) {
      console.warn('[BrokerSelection] no-broker save failed:', e.message);
    }
    if (onBrokerConnected) onBrokerConnected('DummyBroker');
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A237E" />
        <Text style={styles.loadingText}>Loading brokers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect Broker</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Actions and decisions are solely yours. We do not have access to your
          trading account credentials or the ability to execute trades on your behalf.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {brokerRegistry.map((config) => {
          const status = getBrokerStatus(config);
          return (
            <TouchableOpacity
              key={config.key}
              style={[
                styles.brokerCard,
                status === 'connected' && styles.brokerCardConnected,
                status === 'expired' && styles.brokerCardExpired,
              ]}
              onPress={() => handleBrokerTap(config)}
              activeOpacity={0.7}
            >
              <View style={styles.logoContainer}>
                <Text style={styles.logoFallback}>
                  {config.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.brokerName} numberOfLines={1}>
                {config.name}
              </Text>
              <Text
                style={[
                  styles.statusBadge,
                  status === 'connected' && styles.statusConnected,
                  status === 'expired' && styles.statusExpired,
                ]}
              >
                {status === 'connected'
                  ? 'Connected'
                  : status === 'expired'
                  ? 'Reconnect'
                  : 'Connect'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Continue without broker */}
      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => {
            Alert.alert(
              'Continue without broker?',
              'You can connect a broker later. Orders will need to be placed manually.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue', onPress: handleContinueWithoutBroker },
              ],
            );
          }}
        >
          <Text style={styles.skipBtnText}>Continue without connecting broker</Text>
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
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16,
    backgroundColor: '#1A237E',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  disclaimer: {
    margin: 16, padding: 12, backgroundColor: '#FFF8E1',
    borderRadius: 10, borderWidth: 1, borderColor: '#FFE082',
  },
  disclaimerText: { fontSize: 12, color: '#795548', lineHeight: 18 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingBottom: 100,
  },
  brokerCard: {
    width: '30%', margin: '1.66%', padding: 14,
    backgroundColor: '#fff', borderRadius: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  brokerCardConnected: { borderColor: '#4CAF50', borderWidth: 1.5 },
  brokerCardExpired: { borderColor: '#FF9800', borderWidth: 1.5 },

  logoContainer: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#E8EAF6', justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  logoFallback: { fontSize: 18, fontWeight: '700', color: '#3F51B5' },
  brokerName: { fontSize: 11, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 4 },
  statusBadge: { fontSize: 9, fontWeight: '600', color: '#999' },
  statusConnected: { color: '#4CAF50' },
  statusExpired: { color: '#FF9800' },

  bottomSection: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#F8F9FC',
    borderTopWidth: 1, borderTopColor: '#E0E0E0',
  },
  skipBtn: {
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#1A237E', alignItems: 'center',
  },
  skipBtnText: { fontSize: 14, fontWeight: '600', color: '#1A237E' },
});

export default BrokerSelectionScreen;
