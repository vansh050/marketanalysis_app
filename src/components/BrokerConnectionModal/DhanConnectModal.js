import React, {useEffect, useMemo, useRef, useState} from 'react';
import axios from 'axios';
import Config from 'react-native-config';
import {getAuth} from '@react-native-firebase/auth';

import server from '../../utils/serverConfig';
import DhanConnectUI from '../../UIComponents/BrokerConnectionUI/DhanConnectUI';
import DhanOAuthUI from '../../UIComponents/BrokerConnectionUI/DhanOAuthUI';
import {useTrade} from '../../screens/TradeContext';
import {useConfig} from '../../context/ConfigContext';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import {getAccountEmail} from '../../utils/accountEmail';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import BrokerConnectStepperSheet from './BrokerConnectStepperSheet';
import {
  generateDeviceTotpFromSeed,
  hasDeviceTotp,
  removeDeviceTotp,
  saveDeviceTotpSeed,
  unlockDeviceTotpLogin,
} from '../../services/DeviceTotpVault';
import {designColor} from '../../design/literalTokens';

const DhanConnectModal = ({
  isVisible,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
}) => {
  const {configData} = useTrade();
  const runtimeConfig = useConfig();
  const showAlert = useModalStore(state => state.showAlert);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();

  const [flowMode, setFlowMode] = useState('partner');
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [prefetchedAuthUrl, setPrefetchedAuthUrl] = useState(null);
  const [hasSavedTotp, setHasSavedTotp] = useState(false);
  const [clientId, setClientId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isClientIdVisible, setIsClientIdVisible] = useState(false);
  const [isAccessTokenVisible, setIsAccessTokenVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [deviceTotpSeed, setDeviceTotpSeed] = useState('');
  const [devicePin, setDevicePin] = useState('');
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);
  // Partner (Dhan browser) login is the default action on the chooser
  // (2026-10-01 owner decision). Direct API quick reconnect is opt-in: the
  // switch turns the primary button into its setup.
  const [directOptIn, setDirectOptIn] = useState(false);

  const hasProcessedCallback = useRef(false);
  const deviceReconnectStartedRef = useRef(false);
  const deviceTotpEnabled =
    runtimeConfig?.deviceTotpEnabled === true ||
    configData?.config?.deviceTotpEnabled === true;
  const totpIdentity = useMemo(
    () => ({
      advisor: getTenantSubdomain(configData),
      broker: 'Dhan',
      userEmail,
    }),
    [configData, userEmail],
  );

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  });

  const refreshUserDetails = async () => {
    if (!userEmail) return null;
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
        {headers: getHeaders()},
      );
      const details = response.data?.User || null;
      setUserDetails(details);
      const slot = (details?.connected_brokers || []).find(
        broker => broker?.broker === 'Dhan',
      );
      if (slot?.clientCode) setClientId(String(slot.clientCode));
      return details;
    } catch (error) {
      console.warn('[Dhan] user hydration failed:', error?.message);
      return null;
    }
  };

  useEffect(() => {
    refreshUserDetails();
    // Account-specific hydration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  useEffect(() => {
    if (!isVisible) return;
    hasProcessedCallback.current = false;
    deviceReconnectStartedRef.current = false;
    setPrefetchedAuthUrl(null);
    setEgressReady(false);
    setUnmetAck(false);
    setFlowMode(deviceTotpEnabled ? 'choose' : 'partner');
  }, [isVisible, deviceTotpEnabled]);

  useEffect(() => {
    if (!isVisible || !deviceTotpEnabled || !userEmail) return;
    hasDeviceTotp(totpIdentity)
      .then(setHasSavedTotp)
      .catch(() => setHasSavedTotp(false));
  }, [isVisible, deviceTotpEnabled, userEmail, totpIdentity]);

  const userId = userDetails?._id;
  const dhanSlot = (userDetails?.connected_brokers || []).find(
    broker => broker?.broker === 'Dhan',
  );
  const isDirectConnection = dhanSlot?.connection_mode === 'direct_api';
  const DHAN_OAUTH_URL = `${server.ccxtServer.baseUrl}dhan/login`;

  useEffect(() => {
    if (!isVisible || flowMode !== 'partner' || prefetchedAuthUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(DHAN_OAUTH_URL, {
          method: 'GET',
          redirect: 'follow',
        });
        const finalUrl = response?.url;
        if (
          !cancelled &&
          typeof finalUrl === 'string' &&
          finalUrl.includes('dhan.co') &&
          finalUrl !== DHAN_OAUTH_URL
        ) {
          setPrefetchedAuthUrl(finalUrl);
        }
      } catch (error) {
        console.warn('[Dhan] consent prefetch failed:', error?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVisible, flowMode, prefetchedAuthUrl, DHAN_OAUTH_URL]);

  const finishConnection = async (source, message) => {
    setShowBrokerModal?.(false);
    onClose?.();
    try {
      const result = await fetchBrokerStatusModal?.();
      eventEmitter.emit('refreshEvent', {source});
      if (!result?.migrationWillShow) {
        showAlert('success', 'Dhan connected', message);
      }
      await refreshUserDetails();
    } catch (error) {
      console.warn('[Dhan] post-success refresh failed:', error?.message);
    }
  };

  const savePartnerConnection = async (partnerClientId, jwtToken) => {
    let uid = userId;
    if (!uid) uid = (await refreshUserDetails())?._id;
    if (!uid) {
      showAlert('error', 'Error', 'User not found. Please sign in again.');
      return;
    }
    setLoading(true);
    try {
      await axios.put(
        `${server.server.baseUrl}api/user/connect-broker`,
        {
          uid,
          user_broker: 'Dhan',
          clientCode: partnerClientId,
          jwtToken,
          connectionMode: 'partner',
        },
        {headers: getHeaders()},
      );
      await removeDeviceTotp(totpIdentity).catch(() => {});
      setHasSavedTotp(false);
      await finishConnection(
        'Dhan partner connection',
        'Partner Login is active. Future reconnects continue through Dhan login.',
      );
    } catch (error) {
      showAlert(
        'error',
        'Connection failed',
        error.response?.data?.message ||
          error.response?.data?.msg ||
          'Dhan Partner Login could not be saved.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewNavigationStateChange = navState => {
    const url = navState?.url;
    if (!url || hasProcessedCallback.current) return;
    if (!url.includes('dhan_client_id=') || !url.includes('dhan_access_token=')) return;
    const query = url.split('?')[1];
    if (!query) return;
    const params = {};
    query.split('&').forEach(pair => {
      const index = pair.indexOf('=');
      if (index < 0) return;
      params[decodeURIComponent(pair.slice(0, index))] = decodeURIComponent(
        pair.slice(index + 1),
      );
    });
    if (params.dhan_client_id && params.dhan_access_token) {
      hasProcessedCallback.current = true;
      savePartnerConnection(params.dhan_client_id, params.dhan_access_token);
    }
  };

  const connectDirect = async () => {
    if (
      !clientId.trim() ||
      !deviceTotpSeed.trim() ||
      devicePin.length !== 6
    ) {
      showAlert('error', 'Missing details', 'Enter the Dhan Client ID, TOTP secret and PIN.');
      return;
    }
    setLoading(true);
    try {
      const generatedTotp = generateDeviceTotpFromSeed(deviceTotpSeed);
      const firebaseToken = await user?.getIdToken?.();
      if (!firebaseToken) throw new Error('Please sign in again before connecting.');
      await axios.post(
        `${server.server.baseUrl}api/dhan/device-totp-connect`,
        {clientId: clientId.trim(), pin: devicePin, totp: generatedTotp},
        {
          headers: {
            ...getHeaders(),
            Authorization: `Bearer ${firebaseToken}`,
          },
        },
      );
      await saveDeviceTotpSeed(
        totpIdentity,
        deviceTotpSeed,
        '',
        {pin: devicePin},
      );
      setHasSavedTotp(true);
      await finishConnection(
        'Dhan Direct API connection',
        'Direct API Quick Reconnect is active on this phone.',
      );
    } catch (error) {
      showAlert(
        'error',
        'Direct API setup failed',
        error.response?.data?.message || error.message || 'Check the Dhan details and static-IP whitelist.',
      );
    } finally {
      setLoading(false);
    }
  };

  const reconnectWithDeviceTotp = async () => {
    setLoading(true);
    try {
      const login = await unlockDeviceTotpLogin(totpIdentity);
      if (!login?.totp || !login?.pin) {
        throw new Error('The protected Dhan login is incomplete.');
      }
      const firebaseToken = await user?.getIdToken?.();
      if (!firebaseToken) throw new Error('Please sign in again before reconnecting.');
      await axios.post(
        `${server.server.baseUrl}api/dhan/device-totp-reconnect`,
        {totp: login.totp, pin: login.pin},
        {
          headers: {
            ...getHeaders(),
            Authorization: `Bearer ${firebaseToken}`,
          },
        },
      );
      await finishConnection(
        'Dhan Direct API reconnect',
        'Your protected Dhan Direct API login was unlocked on this phone.',
      );
      return true;
    } catch (error) {
      showAlert(
        'error',
        'Quick reconnect unavailable',
        error.response?.data?.message || error.message || 'Set up Direct API again or use Partner Login.',
      );
      setFlowMode('choose');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      !isVisible ||
      !deviceTotpEnabled ||
      !isDirectConnection ||
      deviceReconnectStartedRef.current
    ) return;
    deviceReconnectStartedRef.current = true;
    (async () => {
      const saved = await hasDeviceTotp(totpIdentity).catch(() => false);
      setHasSavedTotp(saved);
      if (saved) await reconnectWithDeviceTotp();
      else setFlowMode('direct');
    })();
    // One biometric attempt per modal open; failures return to mode choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, deviceTotpEnabled, isDirectConnection]);

  const forgetSavedTotp = async () => {
    await removeDeviceTotp(totpIdentity);
    setHasSavedTotp(false);
    setFlowMode('direct');
  };

  if (deviceTotpEnabled && flowMode === 'choose') {
    return (
      <BrokerConnectStepperSheet
        isVisible={!!isVisible}
        onClose={onClose}
        broker="Dhan"
        config={{
          monogram: 'D',
          brandFrom: designColor('0056b7'),
          brandTo: designColor('003f86'),
          hideStepChips: true,
          guideTitle: 'Choose how AlphaQuark connects to Dhan',
          guideSteps: [
            '<b>Partner Login:</b> use Dhan’s browser consent. No customer API app or static-IP setup is required.',
            '<b>Direct API Quick Reconnect:</b> use your own Dhan Individual Trader API with a free dedicated static IPv6, then reconnect using biometric-protected PIN + TOTP on this phone.',
          ],
          note: 'The two modes stay separate. Direct API credentials are never reused in the Partner Login channel.',
        }}
        fields={[]}
        deviceTotp={{
          enabled: true,
          placeBeforeFields: true,
          hasSaved: false,
          saveOnDevice: directOptIn,
          onToggleSave: () => setDirectOptIn(value => !value),
          protectLabel: 'Enable Dhan quick reconnect (Direct API) on this phone',
          pendingLabel:
            'Needs your own Dhan Individual Trader API and our static IPv6. Saved only after Dhan verifies the details.',
        }}
        canSubmit
        submitLabel={
          directOptIn ? 'Set up Direct API Quick Reconnect' : 'Continue with Dhan login'
        }
        loading={loading}
        onSubmit={() => setFlowMode(directOptIn ? 'direct' : 'partner')}
        alternateAction={
          directOptIn
            ? {
                label: 'Use Dhan login instead',
                onPress: () => setFlowMode('partner'),
              }
            : null
        }
      />
    );
  }

  if (deviceTotpEnabled && flowMode === 'direct') {
    return (
      <BrokerConnectStepperSheet
        isVisible={!!isVisible}
        onClose={() => setFlowMode('choose')}
        broker="Dhan Direct API"
        config={{
          monogram: 'D',
          brandFrom: designColor('0056b7'),
          brandTo: designColor('003f86'),
          portalUrl: 'https://web.dhan.co/',
          portalLabel: 'Open Dhan Web',
          guideTitle: 'One-time Direct API setup',
          guideSteps: [
            'In Dhan Web, open <b>My Profile → DhanHQ Trading APIs and Access</b> and enable Individual Trader API access.',
            'Enable TOTP and copy the <b>manual Base32 setup key</b> shown with the authenticator QR.',
            'Add the dedicated IPv6 shown below as your Dhan <b>Primary Static IP</b>. Dhan may lock IP changes for seven days.',
            'Enter your Client ID, Base32 setup key and six-digit Dhan PIN below. AlphaQuark generates the current TOTP automatically.',
          ],
          note: 'The TOTP secret and PIN stay in this phone’s protected keychain. AlphaQuark stores only the resulting session token.',
        }}
        egressBrokerKey="dhan_direct"
        customerId={userId}
        customerEmail={userEmail}
        egressReady={egressReady}
        setEgressReady={setEgressReady}
        unmetAck={unmetAck}
        setUnmetAck={setUnmetAck}
        fields={[
          {
            label: 'Dhan Client ID',
            value: clientId,
            onChange: setClientId,
            placeholder: 'Your Dhan Client ID',
          },
          {
            label: 'TOTP Secret Key (Base32)',
            value: deviceTotpSeed,
            onChange: value => setDeviceTotpSeed(String(value || '')),
            password: true,
            autoCapitalize: 'none',
            placeholder: 'Secret shown when enabling Dhan TOTP',
          },
          {
            label: 'Dhan PIN',
            value: devicePin,
            onChange: value => setDevicePin(value.replace(/\D/g, '').slice(0, 6)),
            password: true,
            keyboardType: 'number-pad',
            maxLength: 6,
            placeholder: 'Your 6-digit Dhan PIN',
          },
        ]}
        deviceTotp={hasSavedTotp ? {
          enabled: true,
          hasSaved: true,
          saveOnDevice: true,
          onUnlock: reconnectWithDeviceTotp,
          onForget: forgetSavedTotp,
          protectLabel: 'Quick reconnect is protected on this phone',
          savedLabel: 'Biometric or device passcode is required before the PIN and TOTP can be used.',
          unlockLabel: 'Reconnect with biometric unlock',
          forgetLabel: 'Forget Dhan Direct API login on this phone',
        } : null}
        phase="creds"
        canSubmit={
          Boolean(clientId.trim()) &&
          Boolean(deviceTotpSeed.trim()) &&
          devicePin.length === 6
        }
        submitLabel="Verify and enable quick reconnect"
        loading={loading}
        onSubmit={connectDirect}
        alternateAction={{
          label: 'Use Partner Login instead',
          onPress: () => setFlowMode('partner'),
        }}
      />
    );
  }

  // Flag-off compatibility: preserve the pre-existing manual Client ID /
  // access-token fallback exactly as an alternative to Partner Login.
  if (!deviceTotpEnabled && flowMode === 'manual') {
    return (
      <DhanConnectUI
        isVisible={isVisible}
        onClose={onClose}
        cliendId={clientId}
        accessToken={accessToken}
        setCliendId={setClientId}
        setaccessToken={setAccessToken}
        isPasswordVisible={isClientIdVisible}
        isPasswordVisibleup={isAccessTokenVisible}
        setIsPasswordVisible={setIsClientIdVisible}
        setIsPasswordVisibleup={setIsAccessTokenVisible}
        handleSubmit={() => {
          if (!clientId.trim() || !accessToken.trim()) {
            showAlert('error', 'Missing fields', 'Enter your Dhan Client ID and Access Token.');
            return;
          }
          savePartnerConnection(clientId.trim(), accessToken.trim());
        }}
        loading={loading}
        shouldRenderContent={!!isVisible}
        OpenHelpModal={() => setHelpVisible(true)}
        setHelpVisible={setHelpVisible}
        helpVisible={helpVisible}
      />
    );
  }

  return (
    <DhanOAuthUI
      isVisible={isVisible}
      onClose={deviceTotpEnabled ? () => setFlowMode('choose') : onClose}
      authUrl={prefetchedAuthUrl || DHAN_OAUTH_URL}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
      loading={loading}
      onSwitchToManual={() =>
        setFlowMode(deviceTotpEnabled ? 'direct' : 'manual')
      }
      switchLabel={
        deviceTotpEnabled
          ? 'Set up Direct API Quick Reconnect instead'
          : 'Enter Access Token manually instead'
      }
    />
  );
};

export default DhanConnectModal;
