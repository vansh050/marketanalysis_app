import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import useModalStore from '../../GlobalUIModals/modalStore';
import { registerCallback } from '../../utils/brokerAuth';
import {
  handleSmartReauth,
  flipPrimaryBroker,
  markBrokerExpired,
} from '../../utils/reauthHelpers';
import { isBrokerSessionExpired } from '../../utils/brokerStateUtils';

// Backend `connected_brokers[].broker` → ModalManager switch key. Keep in
// sync with src/GlobalUIModals/ModalManager.js. Brokers not listed here
// fall back to the onReconnect parent callback.
const BROKER_MODAL_KEY_MAP = {
  'Angel One': 'Angel One',
  'Zerodha': 'Zerodha',
  'Upstox': 'Upstox',
  'Kotak': 'Kotak',
  'Dhan': 'Dhan',
  'Fyers': 'Fyers',
  'AliceBlue': 'AliceBlue',
  'Groww': 'Groww',
  'ICICI Direct': 'ICICI',
  'Hdfc Securities': 'HDFC',
  'Motilal Oswal': 'Motilal',
  'Axis Securities': 'Axis Securities',
  'IIFL Securities': 'IIFL',
};

const ManageConnectionsModal = ({
  visible,
  onClose,
  onConnectionRemoved,
  onBrokerSwitched,
  onReconnect,
  onAddBroker,
}) => {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const fetchingRef = React.useRef(false);
  const [removing, setRemoving] = useState(null);
  const [switching, setSwitching] = useState(null);
  const [reauthing, setReauthing] = useState(null);
  const { configData, broker: currentBroker, userDetails } = useTrade();
  const freshConfig = useConfig();

  // brokerConnectRedirectURL is what the broker redirects to after OAuth.
  // Must match the per-advisor URL registered in each broker's dev
  // portal — no `.env` fallback (the bundled
  // `app-links.alphaquark.in/broker-callback` isn't registered
  // anywhere, so using it silently fails reauth with "Invalid
  // redirect_uri"). Same chain as upstoxModal / AxisConnectModal.
  const brokerConnectRedirectURL =
    freshConfig?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    '';

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const fetchConnections = async () => {
    if (!userEmail || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      // Use main backend (aq_backend_github) which stores broker connections
      const response = await axios.get(
        `${server.server.baseUrl}api/user/brokers`,
        {
          params: { email: userEmail },
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        }
      );

      if (response.data?.data?.connected_brokers) {
        const brokers = response.data.data.connected_brokers.map(b => ({
          broker: b.broker,
          connected_at: b.connected_at,
          status: b.status,
          token_expire: b.token_expire,
          is_active: b.broker === currentBroker,
          has_credentials: true,
          // Cross-check status AND token_expire — backend sometimes
          // keeps status='connected' past the token's actual expiry
          // (e.g., ICICI after the daily morning reset), so the
          // timestamp is the authoritative signal.
          is_expired: isBrokerSessionExpired(b),
        }));
        setConnections(brokers);
      } else {
        setConnections([]);
      }
    } catch (error) {
      console.error('[ManageConnections] Failed to fetch:', error);
      Alert.alert('Error', 'Failed to load connections');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (visible && userEmail) {
      fetchConnections();
    }
    if (!visible) {
      fetchingRef.current = false;
    }
  }, [visible, userEmail]);

  const handleDisconnect = async (broker) => {
    Alert.alert(
      'Disconnect Broker',
      `Are you sure you want to disconnect ${broker}? This will remove the connection and allow you to reconnect.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setRemoving(broker);
            try {
              // Use main backend (aq_backend_github) to remove broker
              await axios.delete(
                `${server.server.baseUrl}api/user/brokers/${encodeURIComponent(broker)}`,
                {
                  params: { email: userEmail },
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
                    'aq-encrypted-key': generateToken(
                      Config.REACT_APP_AQ_KEYS,
                      Config.REACT_APP_AQ_SECRET,
                    ),
                  },
                }
              );

              // Remove from local list
              setConnections(prev => prev.filter(c => c.broker !== broker));
              onConnectionRemoved?.(broker);
              Alert.alert('Success', `${broker} disconnected successfully`);
            } catch (error) {
              console.error('[ManageConnections] Disconnect failed:', error);
              Alert.alert('Error', 'Failed to disconnect. Please try again.');
            } finally {
              setRemoving(null);
            }
          },
        },
      ]
    );
  };

  const handleSwitch = async (brokerName) => {
    setSwitching(brokerName);
    try {
      // Set as primary broker in backend
      await axios.put(
        `${server.server.baseUrl}api/user/brokers/${encodeURIComponent(brokerName)}/primary`,
        { email: userEmail },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        }
      );

      // Update local list to reflect new active broker
      setConnections(prev =>
        prev.map(c => ({
          ...c,
          is_active: c.broker === brokerName,
        }))
      );
      onBrokerSwitched?.(brokerName);
      Alert.alert(
        'Switched',
        `${brokerName} is now your active broker. If the connection has expired, you will be prompted to reconnect when you transact.`,
      );
    } catch (error) {
      console.error('[ManageConnections] Switch failed:', error);
      Alert.alert('Error', 'Failed to switch broker. Please try again.');
    } finally {
      setSwitching(null);
    }
  };

  const handleReconnect = async (brokerName) => {
    const modalKey = BROKER_MODAL_KEY_MAP[brokerName];
    if (!modalKey) {
      // Broker not registered in ModalManager — let the parent handle it
      // (e.g., open BrokerSelectionModal as a fallback).
      onClose?.();
      onReconnect?.(brokerName);
      return;
    }

    setReauthing(brokerName);
    try {
      // Step 1: Flip primary to this broker up-front. Clicking Reconnect
      // is the user's signal that they want this broker to be active,
      // even if they back out of the OAuth step that follows. Mirrors
      // web subscription.js:161 (setPrimaryBrokerRequest).
      await flipPrimaryBroker(brokerName, userEmail, configData);

      // Step 1b: Mark broker as `status=expired` so UI shows "Re-auth
      // needed" until the subsequent OAuth/credentials flow succeeds.
      // The per-broker connect-broker route will overwrite to 'connected'
      // on success; on failure / back-out the expired state correctly
      // sticks. Without this, brokers with future-dated token_expire
      // (e.g. AliceBlue's hardcoded +24h) lingered as "Connected" even
      // after a failed reconnect.
      await markBrokerExpired(brokerName, userEmail, configData);

      // Step 2: Try the smart credential-reauth path (Upstox/ICICI/HDFC/
      // Motilal/Fyers). It hits /reauth-url, decrypts stored creds, and
      // opens the per-broker modal with a reauthConfig payload so the
      // user skips the credential form entirely.
      const result = await handleSmartReauth({
        brokerName,
        userEmail,
        userDetails,
        configData,
        brokerConnectRedirectURL,
      });

      if (result.handled && result.silent) {
        // Groww silent refresh — backend regenerated the session token
        // from stored Base32 seed; no per-broker modal needed at all.
        // Refresh broker status + close ManageConnections; show a
        // success toast.
        console.log('[ManageConnections] silent refresh OK:', brokerName);
        try {
          if (typeof Toast?.show === 'function') {
            Toast.show({
              type: 'success',
              text1: `${brokerName} reconnected`,
              text2: 'Session refreshed using saved credentials.',
              visibilityTime: 3000,
            });
          }
        } catch (_) {}
        // Tell parent to refresh broker status (no modal to open).
        onReconnect?.(brokerName, null, null);
        onClose?.();
        return;
      }

      if (result.handled) {
        // Credential broker — hand dispatch to parent, don't openModal
        // here (would race with the parent's ManageConnections close).
        console.log('[ManageConnections] credential reauth handed to parent:', brokerName, result.modalKey);
        onReconnect?.(brokerName, result.modalKey, result.payload);
        onClose?.();
        return;
      }

      // Step 3: Fall back to the full per-broker modal (partner OAuth
      // brokers, Kotak TOTP, Groww fresh creds, or any failure in the
      // smart path — e.g., backend said requiresTotp/requiresForm, or
      // we couldn't read local creds).
      if (brokerName === 'Angel One') {
        try {
          await registerCallback('angelone', '/stock-recommendation');
        } catch (err) {
          console.warn('[ManageConnections] Angel One nonce registration failed:', err);
        }
      }
      // Two transparent Modals can't be stacked on Android — opening
      // the per-broker Modal while this one is still mounted just
      // swallows it. Hand the broker key up to the parent via
      // onReconnect; SubscriptionScreen opens the per-broker Modal from
      // a useEffect that fires after this modal has fully unmounted.
      console.log('[ManageConnections] handing reconnect to parent:', brokerName, 'modalKey:', modalKey);
      onReconnect?.(brokerName, modalKey);
      onClose?.();
    } finally {
      setReauthing(null);
    }
  };

  const renderConnection = ({ item }) => (
    <View style={styles.connectionItem}>
      <View style={styles.connectionInfo}>
        <Text style={styles.brokerName}>{item.broker}</Text>
        {item.is_active && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
        {item.is_expired && (
          <View style={styles.expiredBadge}>
            <Text style={styles.expiredBadgeText}>Session Expired</Text>
          </View>
        )}
        {item.has_credentials && !item.is_active && !item.is_expired && (
          <View style={styles.credentialsBadge}>
            <Text style={styles.credentialsBadgeText}>Stored Credentials</Text>
          </View>
        )}
      </View>
      <View style={styles.actionButtons}>
        {!item.is_active && !item.is_expired && (
          <TouchableOpacity
            style={[styles.switchBtn, switching === item.broker && styles.switchBtnDisabled]}
            onPress={() => handleSwitch(item.broker)}
            disabled={
              switching === item.broker ||
              removing === item.broker ||
              reauthing === item.broker
            }
          >
            {switching === item.broker ? (
              <ActivityIndicator size="small" color="#0056B7" />
            ) : (
              <Text style={styles.switchBtnText}>Switch</Text>
            )}
          </TouchableOpacity>
        )}
        {/* Re-auth shows on every row — matches web /subscriptions where
            every broker has a Re-auth button regardless of status. Button
            uses the amber style when expired to draw attention, blue otherwise. */}
        <TouchableOpacity
          style={[
            item.is_expired ? styles.reconnectBtn : styles.reauthBtn,
            reauthing === item.broker && styles.reconnectBtnDisabled,
          ]}
          onPress={() => handleReconnect(item.broker)}
          disabled={
            removing === item.broker ||
            switching === item.broker ||
            reauthing === item.broker
          }
        >
          {reauthing === item.broker ? (
            <ActivityIndicator size="small" color={item.is_expired ? '#fff' : '#0056B7'} />
          ) : (
            <Text style={item.is_expired ? styles.reconnectBtnText : styles.reauthBtnText}>
              {item.is_expired ? 'Reconnect' : 'Re-auth'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.disconnectBtn, removing === item.broker && styles.disconnectBtnDisabled]}
          onPress={() => handleDisconnect(item.broker)}
          disabled={
            removing === item.broker ||
            switching === item.broker ||
            reauthing === item.broker
          }
        >
          {removing === item.broker ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <Text style={styles.disconnectBtnText}>Remove</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Manage Connections</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Manage your broker connections. Remove connections to free up slots for OAuth-based brokers like Groww.
          </Text>

          {onAddBroker && (
            <TouchableOpacity
              style={styles.addBrokerBtn}
              onPress={() => {
                onClose?.();
                onAddBroker();
              }}
            >
              <Text style={styles.addBrokerBtnText}>+ Connect new broker</Text>
            </TouchableOpacity>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0056B7" />
            </View>
          ) : connections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No broker connections found</Text>
            </View>
          ) : (
            <FlatList
              data={connections}
              renderItem={renderConnection}
              keyExtractor={item => item.broker}
              style={styles.list}
            />
          )}

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 20,
    color: '#6b7280',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingTop: 12,
    lineHeight: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  connectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  connectionInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  brokerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  credentialsBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  credentialsBadgeText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  expiredBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  expiredBadgeText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },
  reconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f59e0b',
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reconnectBtnDisabled: {
    opacity: 0.7,
  },
  reconnectBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  reauthBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0056B7',
    backgroundColor: '#fff',
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reauthBtnText: {
    fontSize: 13,
    color: '#0056B7',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  switchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0056B7',
  },
  switchBtnDisabled: {
    opacity: 0.5,
  },
  switchBtnText: {
    fontSize: 13,
    color: '#0056B7',
    fontWeight: '500',
  },
  disconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  disconnectBtnDisabled: {
    opacity: 0.5,
  },
  disconnectBtnText: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '500',
  },
  addBrokerBtn: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#0056B7',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 86, 183, 0.06)',
  },
  addBrokerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0056B7',
  },
  doneBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#0056B7',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ManageConnectionsModal;
