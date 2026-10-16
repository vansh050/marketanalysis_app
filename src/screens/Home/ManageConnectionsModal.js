import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import useModalStore from '../../GlobalUIModals/modalStore';
import { registerCallback } from '../../utils/brokerAuth';
import {
  handleSmartReauth,
  flipPrimaryBroker,
} from '../../utils/reauthHelpers';
import {
  getServerBrokerReconnectState,
  isBrokerSessionExpired,
} from '../../utils/brokerStateUtils';
import {getAccountEmail} from '../../utils/accountEmail';
import {startAccountReconciliation} from '../../services/ModelPortfolioService';
import {removeDeviceTotp} from '../../services/DeviceTotpVault';
import {removePersistedBrokerCredentials} from '../../services/DeviceBrokerCredentialVault';
import { designToken } from '../../design/literalTokens';
import BackupStaticIp from '../../components/BrokerConnectionModal/BackupStaticIp';


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
  // 2026-07-17 — Arihant Capital + DefinEdge Securities were missing here,
  // so handleReconnect's `if (!modalKey)` fallback fired for both: the
  // modal closed and onReconnect(brokerName) was called with no modalKey,
  // silently bouncing the user instead of opening their connect modal.
  // Identity mapping is correct — BrokerConnectModalDispatch.normalizeBrokerKey
  // passes both strings through unchanged and its renderLegacyModal switch
  // has cases for exactly these two ('Arihant Capital' -> ArihantConnectModal,
  // 'DefinEdge Securities' -> DefinEdgeConnectModal). Matches the backend
  // connected_brokers[].broker slot names (brokerRegistry.js apiBrokerName).
  'Arihant Capital': 'Arihant Capital',
  'DefinEdge Securities': 'DefinEdge Securities',
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
  const userEmail = getAccountEmail();

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
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
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
              const requestHeaders = {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': getTenantSubdomain(configData),
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              };
              // Use main backend (aq_backend_github) to remove broker
              await axios.delete(
                `${server.server.baseUrl}api/user/brokers/${encodeURIComponent(broker)}`,
                {
                  params: {email: userEmail},
                  headers: requestHeaders,
                }
              );

              const refreshed = await axios.get(
                `${server.server.baseUrl}api/user/getUser/${userEmail}`,
                {
                  params: {disconnectVerification: Date.now()},
                  headers: requestHeaders,
                },
              );
              const reconnectState = getServerBrokerReconnectState(
                refreshed.data?.User,
                broker,
              );
              if (reconnectState.hasSlot) {
                throw new Error('The broker is still present after disconnect.');
              }

              const deviceIdentity = {
                advisor: getTenantSubdomain(configData),
                broker,
                userEmail,
              };
              await Promise.allSettled([
                removeDeviceTotp(deviceIdentity),
                removePersistedBrokerCredentials(deviceIdentity),
              ]);

              // Update local state only after the refreshed server document
              // confirms the slot is gone.
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
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        }
      );

      // Switching to an already-connected broker has no connection-success
      // callback, so enqueue reconciliation explicitly. This remains
      // non-blocking; Calculate has the authoritative admission barrier.
      startAccountReconciliation(
        userEmail,
        brokerName,
        configData,
        'app_primary_broker_switch',
      ).catch(error => {
        console.warn(
          '[ManageConnections] account reconciliation enqueue failed:',
          error?.message,
        );
      });

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
      // Kyzen QA 2026-10-14: Reconnect changes NOTHING on the account
      // until the login succeeds. It used to flip primary_broker up-front
      // and mark the broker status=expired; a backed-out or abandoned
      // login then left an expired broker as primary and labelled a live
      // session "Session Expired" (Fyers, token still valid). A successful
      // login makes the broker primary server-side (SDK exchange-token
      // always sets primary_broker; legacy connect routes do too). A dead
      // session is shown by the live funds check (brokerSessionRejected on
      // the Broker connection screen), i.e. on positive evidence only.

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
        console.log('[ManageConnections] silent/active OK:', brokerName, result.alreadyConnected ? '(already connected)' : '(refreshed)');
        // No login screen ran, so no connect route made it primary. The
        // session is confirmed live — switch now.
        await flipPrimaryBroker(brokerName, userEmail, configData);
        try {
          if (typeof Toast?.show === 'function') {
            Toast.show({
              type: 'success',
              text1: result.alreadyConnected
                ? `${brokerName} is already connected`
                : `${brokerName} reconnected`,
              text2: result.alreadyConnected
                ? 'Session is still active — no re-verification needed.'
                : 'Session refreshed using saved credentials.',
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

  const renderConnection = item => (
    <React.Fragment key={item.broker}>
    <View style={styles.connectionItem}>
      <View style={styles.connectionInfo}>
        <Text style={styles.brokerName}>{item.broker}</Text>
        {item.is_active && (
          <View testID={`broker-status-${item.broker}`} accessibilityLabel={`${item.broker} connected`} style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
        {item.is_expired && (
          <View testID={`broker-status-${item.broker}`} accessibilityLabel={`${item.broker} expired`} style={styles.expiredBadge}>
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
              <ActivityIndicator size="small" color={designToken('manageConnections.accent')} />
            ) : (
              <Text style={styles.switchBtnText}>Switch</Text>
            )}
          </TouchableOpacity>
        )}
        {/* Re-auth shows on every row — matches web /subscriptions where
            every broker has a Re-auth button regardless of status. Button
            uses the amber style when expired to draw attention, blue otherwise. */}
        <TouchableOpacity
          testID={`broker-reauth-${item.broker}`}
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
            <ActivityIndicator size="small" color={item.is_expired ? designToken('manageConnections.surface') : designToken('manageConnections.accent')} />
          ) : (
            <Text style={item.is_expired ? styles.reconnectBtnText : styles.reauthBtnText}>
              {item.is_expired ? 'Reconnect' : 'Re-auth'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          testID={`broker-remove-${item.broker}`}
          style={[styles.disconnectBtn, removing === item.broker && styles.disconnectBtnDisabled]}
          onPress={() => handleDisconnect(item.broker)}
          disabled={
            removing === item.broker ||
            switching === item.broker ||
            reauthing === item.broker
          }
        >
          {removing === item.broker ? (
            <ActivityIndicator size="small" color={designToken('manageConnections.danger')} />
          ) : (
            <Text style={styles.disconnectBtnText}>Remove</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
    {/* Second whitelisted IP (backup) for this broker — renders nothing when not applicable */}
    <BackupStaticIp
      broker={item.broker}
      customerId={userDetails?._id}
      customerEmail={userEmail}
      configData={configData}
    />
    </React.Fragment>
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
              <ActivityIndicator size="large" color={designToken('manageConnections.accent')} />
            </View>
          ) : connections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No broker connections found</Text>
            </View>
          ) : (
            <>
              {/* This modal contains only the user's handful of broker slots,
                  so virtualization provides no benefit. Keeping a FlatList in
                  an invisible native Modal left its Batchinator callback alive
                  after close on some Samsung/Android 12 devices, causing a
                  maximum-update-depth loop while the app was idle. */}
              <ScrollView style={styles.list} nestedScrollEnabled>
                {connections.map(renderConnection)}
              </ScrollView>
            </>
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
    backgroundColor: designToken('manageConnections.surface'),
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
    borderBottomColor: designToken('manageConnections.border'),
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: designToken('manageConnections.text'),
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 20,
    color: designToken('manageConnections.textSecondary'),
  },
  subtitle: {
    fontSize: 14,
    color: designToken('manageConnections.textSecondary'),
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
    color: designToken('manageConnections.textSecondary'),
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
    borderBottomColor: designToken('manageConnections.border'),
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
    color: designToken('manageConnections.text'),
  },
  activeBadge: {
    backgroundColor: designToken('manageConnections.successSoft'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 12,
    color: designToken('manageConnections.successStrong'),
    fontWeight: '500',
  },
  credentialsBadge: {
    backgroundColor: designToken('manageConnections.warningSoft'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  credentialsBadgeText: {
    fontSize: 12,
    color: designToken('manageConnections.warningStrong'),
    fontWeight: '500',
  },
  expiredBadge: {
    backgroundColor: designToken('manageConnections.warningSoft'),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: designToken('manageConnections.warning'),
  },
  expiredBadgeText: {
    fontSize: 12,
    color: designToken('manageConnections.warningStrong'),
    fontWeight: '600',
  },
  reconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: designToken('manageConnections.warning'),
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reconnectBtnDisabled: {
    opacity: 0.7,
  },
  reconnectBtnText: {
    fontSize: 13,
    color: designToken('manageConnections.surface'),
    fontWeight: '600',
  },
  reauthBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: designToken('manageConnections.accent'),
    backgroundColor: designToken('manageConnections.surface'),
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reauthBtnText: {
    fontSize: 13,
    color: designToken('manageConnections.accent'),
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
    borderColor: designToken('manageConnections.accent'),
  },
  switchBtnDisabled: {
    opacity: 0.5,
  },
  switchBtnText: {
    fontSize: 13,
    color: designToken('manageConnections.accent'),
    fontWeight: '500',
  },
  disconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: designToken('manageConnections.danger'),
  },
  disconnectBtnDisabled: {
    opacity: 0.5,
  },
  disconnectBtnText: {
    fontSize: 13,
    color: designToken('manageConnections.danger'),
    fontWeight: '500',
  },
  addBrokerBtn: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: designToken('manageConnections.accent'),
    alignItems: 'center',
    backgroundColor: 'rgba(0, 86, 183, 0.06)',
  },
  addBrokerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: designToken('manageConnections.accent'),
  },
  doneBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: designToken('manageConnections.accent'),
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: designToken('manageConnections.surface'),
  },
});

export default ManageConnectionsModal;
