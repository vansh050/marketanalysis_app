import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ThinkingSvg from '../../assets/thinking.svg';
import BrokerSelectionModal from '../../components/BrokerSelectionModal';
import { useTrade } from '../TradeContext';
import { useConfig } from '../../context/ConfigContext';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import Toast from 'react-native-toast-message';
import crashlytics from '@react-native-firebase/crashlytics';
import DisconnectBrokerModal from './DisconnectBrokerModal';
import ManageConnectionsModal from './ManageConnectionsModal';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import eventEmitter from '../../components/EventEmitter';
import {
  isBrokerSessionExpired,
  getPrimaryBrokerEntry,
  getServerBrokerReconnectState,
} from '../../utils/brokerStateUtils';
import {getAccountEmail} from '../../utils/accountEmail';
import {removeDeviceTotp} from '../../services/DeviceTotpVault';
import {removePersistedBrokerCredentials} from '../../services/DeviceBrokerCredentialVault';
import {
  availableCashText,
  fundsVerificationText,
} from '../../utils/fundsDisplay';

import {designColor} from '../../design/literalTokens';
import {useComponent} from '../../design/useDesign';


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
    confirmedFunds,
    fundsLoading,
    fundsError,
    setBroker,
    brokerStatus,
    configData,
    getAllFunds,
    getAllBrokerSpecificHoldings,
    getAllHoldings,
  } = useTrade();

  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || designColor('0056b7');
  const gradient1 = config?.gradient1 || 'rgba(0, 86, 183, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 38, 81, 1)';

  const [loading, setLoading] = useState(true);
  const [brokername, setBrokerName] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const navigation = useNavigation();

  const userEmail = getAccountEmail();

  const [showDisconnectBroker, setShowDisconnectBroker] = useState(false);
  const [withoutBrokerLoader, setWithoutBrokerLoader] = useState(false);
  const [showManageConnections, setShowManageConnections] = useState(false);
  const openManageConnections = () => {
    // Breadcrumb immediately before the Android native-modal transition that
    // was implicated in the 2026-09-23 process-crash reports.
    crashlytics().log('SubscriptionScreen: opening Manage Connections');
    setShowManageConnections(true);
  };
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
                'X-Advisor-Subdomain': getTenantSubdomain(),
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
        const requestHeaders = {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        };
        await axios.delete(
          `${server.server.baseUrl}api/user/brokers/${encodeURIComponent(currentBroker)}`,
          {
            params: {email: userEmail},
            headers: requestHeaders,
          },
        );

        // The server document is authoritative. Do not continue into the
        // brokerless flow until a fresh read proves the slot was removed.
        const refreshed = await axios.get(
          `${server.server.baseUrl}api/user/getUser/${userEmail}`,
          {
            params: {disconnectVerification: Date.now()},
            headers: requestHeaders,
          },
        );
        const reconnectState = getServerBrokerReconnectState(
          refreshed.data?.User,
          currentBroker,
        );
        if (reconnectState.hasSlot) {
          throw new Error('The broker is still present after disconnect.');
        }

        const deviceIdentity = {
          advisor: getTenantSubdomain(configData),
          broker: currentBroker,
          userEmail,
        };
        await Promise.allSettled([
          removeDeviceTotp(deviceIdentity),
          removePersistedBrokerCredentials(deviceIdentity),
        ]);
        try {
          crashlytics().log(
            `[BrokerDisconnect] ${JSON.stringify({
              broker: currentBroker,
              event: 'server_slot_removal_verified',
              remainingSlots: reconnectState.slotCount,
            })}`,
          );
        } catch (_) {
          // Diagnostics must never block a confirmed disconnect.
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
            'X-Advisor-Subdomain': getTenantSubdomain(),
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

      await axios.request(brokerReqConfig);
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
      const updatedUserDetails = await getUserDeatils();
      setBrokerName(updatedUserDetails?.user_broker || '');
      await getSubscribedPlans();
      await getAllFunds({
        force: true,
        userDetailsOverride: updatedUserDetails || userDetails,
      });
    } catch (e) {
      // Handle error if needed
    }
    setRefreshing(false);
  }, [userEmail]);

  useEffect(() => {
    fetchBrokerStatusModal();
    getSubscribedPlans();
  }, [userEmail]);

  // Funds are demand-driven: refresh when this funds-sensitive screen becomes
  // active, but reuse a recent confirmed value when navigating back quickly.
  // Trade execution performs its own force-network session/funds preflight.
  useFocusEffect(useCallback(() => {
    if (broker) {
      getAllFunds({maxAgeMs: 30000});
    }
  }, [broker, userDetails?.jwtToken]));

  useEffect(() => {
    if (brokername) {
      setBroker(brokername);
    }
  }, [brokername]);

  const handleOpen = () => {
    setModalVisible(true);
  };

  // TradeContext owns the single account-wide refreshEvent listener. Keeping
  // a second listener here caused three sequential getUser calls after a
  // broker login and could race the new connection back to an expired card.

  const displayFunds =
    confirmedFunds?.requestKey === `${userEmail || ''}:${broker}`
      ? confirmedFunds
      : null;
  const cashText = availableCashText({
    broker,
    snapshot: displayFunds,
    loading: fundsLoading,
  });
  const cashVerification = fundsVerificationText({
    snapshot: displayFunds,
    loading: fundsLoading,
    error: fundsError,
  });

  const Presentation = useComponent('screens.SubscriptionScreen');
  const modalSlot = (
    <>
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
      {showManageConnections && <ManageConnectionsModal
        visible
        onClose={() => setShowManageConnections(false)}
        onConnectionRemoved={(removedBroker) => {
          console.log('[ManageConnections] Removed:', removedBroker);
          fetchBrokerStatusModal();
        }}
        onBrokerSwitched={async (switchedBroker) => {
          console.log('[ManageConnections] Switched to:', switchedBroker);
          const updatedUser = await getUserDeatils();
          const activeBroker = updatedUser?.user_broker || switchedBroker;
          setBroker(activeBroker);
          setBrokerName(activeBroker);
          await getAllFunds({
            force: true,
            userDetailsOverride: updatedUser,
          });
          eventEmitter.emit('refreshEvent', {
            source: 'primary-broker-switch',
            broker: activeBroker,
          });
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
      />}

    </>
  );
  const handleBack = () => {
    getAllBrokerSpecificHoldings();
    getAllHoldings();
    getAllFunds();
    navigation.goBack();
  };
  return (
    <Presentation
      viewModel={{
        gradient1, gradient2, loading, brokerStatus, userDetails, broker,
        userEmail, themeColor, cashText, cashVerification, refreshing,
      }}
      actions={{
        onBack: handleBack,
        onRefresh,
        openManageConnections,
        handleOpen,
        setShowDisconnectBroker,
        getPrimaryBrokerEntry,
        isBrokerSessionExpired,
      }}
      slots={{ThinkingIllustration: ThinkingSvg, Modals: modalSlot}}
    />
  );
};

export default SubscriptionScreen;
