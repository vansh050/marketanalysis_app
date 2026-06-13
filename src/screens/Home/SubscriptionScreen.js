import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import { getAuth } from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Pencil } from 'lucide-react-native';
import { FadeLoading } from 'react-native-fade-loading';
import ThinkingSvg from '../../assets/thinking.svg';
import BrokerSelectionModal from '../../components/BrokerSelectionModal';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import Toast from 'react-native-toast-message';
import DisconnectBrokerModal from './DisconnectBrokerModal';
import ManageConnectionsModal from './ManageConnectionsModal';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import eventEmitter from '../../components/EventEmitter';
import {
  isBrokerSessionExpired,
  getPrimaryBrokerEntry,
} from '../../utils/brokerStateUtils';

const cross = require('../../assets/cross.png');
const tick = require('../../assets/checked.png');

// Module-scoped `Dimensions.get('window')` was frozen at RN init time
// and diverged from the live screen width on foldables, split-screen,
// Samsung DeX, and Android 15 edge-to-edge devices — producing the
// "narrow content column + thick bottom black band" distortion. Width
// is now read inside the component via `useWindowDimensions()` so it
// updates on rotation / fold / multi-window, and the root uses
// `SafeAreaView` so the header clears notches and the scroll area
// ends above the gesture bar.

const SubscriptionScreen = () => {
  const {
    userDetails,
    broker,
    getUserDeatils,
    funds,
    setBroker,
    isBrokerConnected,
    brokerStatus,
    configData,
    getAllFunds,
    getAllBrokerSpecificHoldings,
    getAllHoldings,
  } = useTrade();

  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const gradient1 = config?.gradient1 || 'rgba(0, 86, 183, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 38, 81, 1)';

  const [loading, setLoading] = useState(true);
  const [brokername, setBrokerName] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const navigation = useNavigation();

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const [showDisconnectBroker, setShowDisconnectBroker] = useState(false);
  const [withoutBrokerLoader, setWithoutBrokerLoader] = useState(false);
  const [showManageConnections, setShowManageConnections] = useState(false);
  // Queue for a per-broker Modal to open AFTER ManageConnectionsModal has
  // fully unmounted. Android can't stack two transparent Modals, so
  // ManageConnectionsModal.handleReconnect hands us the modalKey via
  // onReconnect and then closes itself; the useEffect below fires
  // openModal once showManageConnections flips to false.
  const pendingReauthModalKey = React.useRef(null);
  const pendingReauthPayload = React.useRef(null);

  React.useEffect(() => {
    if (showManageConnections || !pendingReauthModalKey.current) return;
    const modalKey = pendingReauthModalKey.current;
    const payload = pendingReauthPayload.current;
    pendingReauthModalKey.current = null;
    pendingReauthPayload.current = null;
    // One animation frame after the modal's slide-out completes.
    setTimeout(() => {
      console.log('[SubscriptionScreen] opening queued modal:', modalKey, 'hasPayload:', !!payload);
      require('../../GlobalUIModals/modalStore').default
        .getState()
        .openModal(modalKey, payload || null);
    }, 250);
  }, [showManageConnections]);

  const handleContinueWithoutBrokerSave = async () => {
    try {
      setWithoutBrokerLoader(true);

      // Revoke OAuth token for Groww before disconnecting (frees up connection slot)
      const currentBroker = broker || brokername;
      if (currentBroker === 'Groww') {
        console.log('[Disconnect] Revoking Groww OAuth token...');
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}groww/revoke`,
            { user_email: userEmail },
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': getAdvisorSubdomain(),
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            }
          );
          console.log('[Disconnect] Groww token revoked successfully');
        } catch (revokeError) {
          // Continue with disconnect even if revoke fails (token may already be invalid)
          console.warn('[Disconnect] Groww revoke failed (continuing anyway):', revokeError.message);
        }
      }

      // Step 1: Remove broker connection via Node backend (clears credentials + connected_brokers)
      if (currentBroker && currentBroker !== 'DummyBroker') {
        try {
          await axios.delete(
            `${server.server.baseUrl}api/user/brokers/${encodeURIComponent(currentBroker)}`,
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
            },
          );
        } catch (removeErr) {
          console.warn('[Disconnect] removeBrokerConnection failed (continuing):', removeErr.message);
        }
      }

      // Step 2: Set no-broker-required flag (sets connect_broker_status: Disconnected, user_broker: "")
      await axios.put(
        `${server.ccxtServer.baseUrl}comms/no-broker-required/save`,
        {
          userEmail: userEmail,
          noBrokerRequired: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

      Toast.show({
        type: 'success',
        text1: 'Your preference has been stored successfully.',
        visibilityTime: 3000,
      });

      // Second API call
      const newBrokerData = {
        user_email: userEmail,
        user_broker: 'DummyBroker',
      };

      const brokerReqConfig = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
        data: JSON.stringify(newBrokerData),
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };

      const checkResponse = await axios.request(brokerReqConfig);

      console.log('Broker change response:', checkResponse.data);
      await Promise.all([
        getUserDeatils(), // Refresh user details
        fetchBrokerStatusModal(), // Refresh broker status
        getAllFunds(), // Refresh funds
        getSubscribedPlans(), // Refresh subscribed plans
        getAllBrokerSpecificHoldings(),
        getAllHoldings(),
      ]);
      setWithoutBrokerLoader(false);
      setShowDisconnectBroker(false);
      setModalVisible(false);
    } catch (err) {
      setWithoutBrokerLoader(false);
      Toast.show({
        type: 'error',
        text1: 'Something went wrong. Please try again.',
        visibilityTime: 4000,
      });
    }
  };

  const getSubscribedPlans = async () => {
    try {
      const url = `${server.ccxtServer.baseUrl}comms/subscribed/plans/${userEmail}`;
      await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      });
    } catch (error) {
      console.error('Error fetching subscribed plans:', error);
    }
  };

  const fetchBrokerStatusModal = async () => {
    setLoading(true);
    if (userEmail) {
      try {
        const updatedUserDetails = await getUserDeatils();
        setBrokerName(updatedUserDetails?.user_broker || '');
      } catch (error) {
      } finally {
        setLoading(false);
      }
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await getUserDeatils();
      await fetchBrokerStatusModal();
      await getSubscribedPlans();
      // await getAllFunds(); // Removed to avoid race condition
    } catch (e) {
      // Handle error if needed
    }
    setRefreshing(false);
  }, [userEmail]);

  useEffect(() => {
    fetchBrokerStatusModal();
    getSubscribedPlans();
  }, [userEmail]);

  // Optimized: Call getAllFunds when broker is present (ignoring status for AngelOne)
  useEffect(() => {
    if (broker) {
      getAllFunds();
    }
  }, [broker]);

  useEffect(() => {
    if (brokername) {
      setBroker(brokername);
    }
  }, [brokername]);

  const handleOpen = () => {
    setModalVisible(true);
  };

  // DEBUG: Monitor brokerStatus changes
  useEffect(() => {
    console.log('🔍 [SUBSCRIPTION SCREEN] brokerStatus changed:', brokerStatus);
    console.log('🔍 [SUBSCRIPTION SCREEN] broker:', broker);
    console.log('🔍 [SUBSCRIPTION SCREEN] userDetails?.user_broker:', userDetails?.user_broker);
    console.log('🔍 [SUBSCRIPTION SCREEN] isBrokerConnected:', isBrokerConnected);
  }, [brokerStatus, broker, userDetails, isBrokerConnected]);

  // Listen for broker connection events and refresh data
  useEffect(() => {
    const handleRefresh = async (data) => {
      console.log('🔄 [SUBSCRIPTION SCREEN] Refresh event received:', data);
      // Refresh all data after broker connection
      try {
        await getUserDeatils();
        await fetchBrokerStatusModal();
        await getAllFunds();
        console.log('✅ [SUBSCRIPTION SCREEN] Data refreshed successfully after broker connection');
      } catch (error) {
        console.error('❌ [SUBSCRIPTION SCREEN] Error refreshing data:', error);
      }
    };

    eventEmitter.on('refreshEvent', handleRefresh);

    return () => {
      eventEmitter.off('refreshEvent', handleRefresh);
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.headerGradient}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              getAllBrokerSpecificHoldings(),
                getAllHoldings(),
                getAllFunds(),
                navigation.goBack();
            }}
            activeOpacity={0.7}>
            <ChevronLeft size={24} color="#004A94" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Broker Screen</Text>
            <Text style={styles.headerSubtitle}>
              You can connect to Brokers here
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#004A94"
          />
        }>
        {/* Broker Connection Status */}
        <View style={styles.statusContainer}>
          {loading ? (
            <FadeLoading
              style={styles.loadingBar}
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : !(
            !brokerStatus ||
            brokerStatus === null ||
            brokerStatus === 'Disconnected'
          ) ? (
            // Primary is set — but its session may be expired even if
            // the top-level connect_broker_status still says connected.
            // Check the actual primary entry's status + token_expire.
            (() => {
              const primaryEntry = getPrimaryBrokerEntry(userDetails);
              const primaryExpired = isBrokerSessionExpired(primaryEntry);
              if (primaryExpired) {
                return (
                  <View style={styles.expiredContainer}>
                    <View style={styles.errorMessage}>
                      <Image source={cross} style={styles.crossIcon} />
                      <View>
                        <Text style={styles.brokerExpiredText}>
                          {broker} Session Expired
                        </Text>
                        <Text style={styles.brokerSubDisText}>{userEmail}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.changeButtonDis, {borderColor: '#f59e0b'}]}
                      onPress={() => setShowManageConnections(true)}
                      activeOpacity={0.8}>
                      <Text style={[styles.changeButtonTextDis, {color: '#f59e0b'}]}>Re-auth</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
              return (
                <LinearGradient
                  colors={[gradient1, gradient2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.brokerStatusCard}>
                  <View style={styles.brokerStatusContent}>
                    <View style={styles.brokerStatusLeft}>
                      <Image source={tick} style={styles.statusIcon} />
                      <View>
                        <Text style={styles.brokerConnectedText}>
                          {broker} Broker Connected
                        </Text>
                        <Text style={styles.brokerSubText}>{userEmail}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.changeButton}
                      onPress={handleOpen}
                      activeOpacity={0.8}>
                      <Pencil size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              );
            })()
          ) : (
            <View style={styles.errorContainer}>
              <View style={styles.errorMessage}>
                <Image source={cross} style={styles.crossIcon} />
                <View>
                  <Text style={styles.brokerDisconnectedText}>
                    Broker Disconnected
                  </Text>
                  <Text style={styles.brokerSubDisText}>{userEmail}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.changeButtonDis, {borderColor: themeColor}]}
                onPress={handleOpen}
                activeOpacity={0.8}>
                <Text style={[styles.changeButtonTextDis, {color: themeColor}]}>Connect Broker</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Broker & Funds Info Card.
            Pre-2026-05-01 wrapped these rows in a <LinearGradient>;
            user-reported on a real Android phone after connecting
            Dhan that the title rendered but every row below was
            invisible (zero height in the gradient subtree).
            react-native-linear-gradient v3 has known Android cases
            where multiple Text children inside the gradient lose
            measurement when LinearGradient's native view is mounted
            before its children's text has loaded, leaving the rows
            sized to 0. Switched to a plain View with the solid
            darker-end of the same gradient as backgroundColor —
            decorative-only difference, robust on every device. */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Your Broker & Funds Info</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Broker:</Text>
            <Text style={styles.infoValue}>
              {userDetails?.user_broker || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Available Cash:</Text>
            <Text style={styles.infoValue}>
              {!broker || broker === null
                ? 'N/A'
                : `₹ ${parseFloat(funds?.data?.availablecash || 0).toFixed(2)}`}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>
              {userDetails?.phone_number || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{userDetails?.email || 'N/A'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PAN:</Text>
            <Text style={styles.infoValue}>
              {userDetails?.panNumber || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Created:</Text>
            <Text style={styles.infoValue}>
              {userDetails?.created_at
                ? new Date(userDetails.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
                : 'N/A'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Manage Connections visible whenever the user has ANY saved broker
          credentials, not just when the primary session is active.
          brokerStatus='Disconnected' only means no active primary — the
          user may still have other brokers in connected_brokers[] whose
          sessions/credentials we want to expose for Re-auth / Remove.
          Mirrors web /subscriptions which lists every connected_brokers[]
          entry regardless of primary status. Disconnect button still
          gated on an active primary since it only makes sense then. */}
      {(userDetails?.connected_brokers || []).some(
        b => b?.broker && b.broker !== 'DummyBroker',
      ) && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.manageButton]}
              onPress={() => setShowManageConnections(true)}
              activeOpacity={0.8}>
              <Text style={styles.manageButtonText}>Manage Connections</Text>
            </TouchableOpacity>
            {!(
              !brokerStatus ||
              brokerStatus === null ||
              brokerStatus === 'Disconnected'
            ) && (
                <TouchableOpacity
                  style={[styles.button, styles.disconnectButton]}
                  onPress={() => setShowDisconnectBroker(true)}
                  activeOpacity={0.8}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              )}
          </View>
        )}

      {/* Bottom doodle & info section */}
      <View style={styles.bottomDoodleContainer}>
        {/* Example doodle shape, you can replace with an SVG or Image */}
        <View style={styles.doodleShape}>
          <ThinkingSvg width="100%" height="100%" />
        </View>
        <View style={styles.doodleContent}>
          <Text style={styles.doodleTitle}>Did You Know?</Text>
          <Text style={styles.doodleText}>
            Connecting your broker helps you manage investments seamlessly and
            stay updated with your portfolio.
          </Text>
        </View>
      </View>

      <DisconnectBrokerModal
        showDisconnectBroker={showDisconnectBroker}
        setShowDisconnectBroker={setShowDisconnectBroker}
        handleContinueWithoutBrokerSave={handleContinueWithoutBrokerSave}
        withoutBrokerLoader={withoutBrokerLoader}
      />

      {/* Broker Selection Modal */}
      {modalVisible && (
        <BrokerSelectionModal
          showBrokerModal={modalVisible}
          OpenTokenExpireModel={false}
          setOpenTokenExpireModel={() => { }}
          setShowBrokerModal={setModalVisible}
          handleAcceptRebalanceWithoutBroker={handleContinueWithoutBrokerSave}
          withoutBrokerLoader={withoutBrokerLoader}
        />
      )}

      {/* Manage Connections Modal */}
      <ManageConnectionsModal
        visible={showManageConnections}
        onClose={() => setShowManageConnections(false)}
        onConnectionRemoved={(removedBroker) => {
          console.log('[ManageConnections] Removed:', removedBroker);
          fetchBrokerStatusModal();
        }}
        onBrokerSwitched={(switchedBroker) => {
          console.log('[ManageConnections] Switched to:', switchedBroker);
          setBroker(switchedBroker);
          fetchBrokerStatusModal();
          getAllFunds();
        }}
        onReconnect={(expiredBroker, modalKey, payload) => {
          console.log('[ManageConnections] Reconnect requested for:', expiredBroker, 'modalKey:', modalKey);
          // Queue the per-broker modal — the useEffect on
          // showManageConnections will open it after this modal
          // unmounts. payload carries reauthConfig for credential
          // brokers; null for partner OAuth.
          if (modalKey) {
            pendingReauthModalKey.current = modalKey;
            pendingReauthPayload.current = payload || null;
          }
          // No optimistic setBroker(expiredBroker) here — it created stale
          // state (broker='Dhan' locally but userDetails.user_broker='Groww'
          // from backend) whenever the user aborted the per-broker modal.
          // Per-broker modals' success path already calls
          // fetchBrokerStatusModal + getUserDeatils, which sets broker and
          // userDetails atomically from the same backend response.
          fetchBrokerStatusModal();
        }}
        onAddBroker={() => {
          // Close ManageConnections and open BrokerSelectionModal so the
          // user can add a second/third broker without leaving Settings.
          setShowManageConnections(false);
          setTimeout(() => setModalVisible(true), 150);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  scrollContent: {
    paddingBottom: 150, // Space for "Did You Know?" section at bottom
    flexGrow: 1,
  },
  button: {
    // No fixed width — buttons sit inside `buttonRow` (flexDirection:
    // row + paddingHorizontal:20) and the composed `manageButton` /
    // `disconnectButton` set `flex: 1` which overrides any width
    // here. The prior `screenWidth - 100` was dead code *and* made
    // the screen vulnerable to the frozen-Dimensions distortion on
    // foldables/split-screen.
    paddingVertical: 10,
    borderRadius: 8,
    alignContent: 'center',
    alignSelf: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginRight: 14,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Medium',
    color: '#fff',
    marginBottom: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  manageButton: {
    flex: 1,
    backgroundColor: '#0056B7',
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  disconnectButton: {
    flex: 1,
    backgroundColor: '#dc2626',
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#d9e4f5',
  },
  statusContainer: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  loadingBar: {
    // `alignSelf: 'stretch'` fills the parent (`statusContainer` has
    // `marginHorizontal: 20`) at live width instead of the frozen
    // `screenWidth - 60`, which broke on foldables / split-screen.
    alignSelf: 'stretch',
    height: 20,
    borderRadius: 8,
  },
  brokerStatusCard: {
    borderRadius: 6,
    paddingVertical: 18,
    paddingHorizontal: 20,
    elevation: 6,
    shadowColor: '#1A3BFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  brokerStatusContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brokerStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 28,
    height: 28,
    marginRight: 14,
  },
  brokerConnectedText: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'Poppins-Medium',
  },
  brokerDisconnectedText: {
    fontSize: 12,
    color: '#090909ff',
    fontFamily: 'Poppins-Medium',
  },
  brokerSubText: {
    fontSize: 12,
    color: '#CFE4FF',
    marginTop: 2,
    fontFamily: 'Satoshi-Regular',
  },
  brokerSubDisText: {
    fontSize: 12,
    color: '#575859ff',
    marginTop: 2,
    fontFamily: 'Satoshi-Regular',
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
  },
  changeButtonDis: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0056B7',
  },
  changeButtonTextDis: {
    color: '#0056B7',
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FCE9EB',
    elevation: 3,
    shadowColor: '#d45',
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  expiredContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    elevation: 3,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  brokerExpiredText: {
    fontSize: 14,
    color: '#92400E',
    fontFamily: 'Poppins-Medium',
  },
  errorMessage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crossIcon: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  errorTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#A92327',
  },
  errorSubtitle: {
    fontSize: 12,
    color: '#7e7e7e',
    marginTop: 2,
    fontFamily: 'Satoshi-Regular',
  },
  connectButton: {
    backgroundColor: '#000',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
  },
  infoCard: {
    marginHorizontal: 20,
    marginTop: 30,
    borderRadius: 6,
    paddingVertical: 22,
    paddingHorizontal: 25,
    // Solid backgroundColor — same darker end of the original
    // [gradient1, gradient2] pair the LinearGradient used. Switched
    // away from LinearGradient 2026-05-01 after the on-device
    // rows-invisible bug.
    backgroundColor: '#002651',
    elevation: 8,
    shadowColor: '#2a4bd7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  infoCardTitle: {
    fontSize: 18,
    fontFamily: 'Satoshi-Bold',
    color: 'white',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: '#D1D9FF',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: 'white',
    maxWidth: '55%',
    textAlign: 'right',
  },

  /* Bottom doodle & info styles */
  bottomDoodleContainer: {
    backgroundColor: '#E6F0FA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    elevation: 10,
    shadowColor: '#aed0f7',
    shadowRadius: 20,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: -5 },
  },
  doodleShape: {
    width: 80,
    height: 80,
    backgroundColor: '#6494ed65',
    borderRadius: 40,
    marginRight: 18,
  },
  doodleContent: {
    flex: 1,
  },
  doodleTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#214EAC',
    marginBottom: 6,
  },
  doodleText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#4F5E7D',
    marginBottom: 8,
  },
  doodleInfo: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#2F3E6B',
  },
});

export default SubscriptionScreen;
