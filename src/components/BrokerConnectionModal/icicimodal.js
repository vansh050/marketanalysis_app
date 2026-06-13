import React, { useState, useRef, useEffect } from 'react';

import { getAuth } from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import axios from 'axios';
import CryptoJS from 'react-native-crypto-js';

import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import ICICIConnectUI from '../../UIComponents/BrokerConnectionUI/ICICIConnectUI';
import { useTrade } from '../../screens/TradeContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

const ICICIUPModal = ({
  isVisible,
  setShowICICIUPModal,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
  reauthConfig,
}) => {
  const { configData } = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);
  const sdkBridge = useSdkBridge();
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isPasswordVisibleup, setIsPasswordVisibleup] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [helpVisible, setHelpVisible] = useState(false);

  const sheet = useRef(null);
  const scrollViewRef = useRef(null);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const checkValidApiAnSecretdecrypt = details => {
    const bytesKey = CryptoJS.AES.decrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };

  // Fetch user details
  useEffect(() => {
    if (userEmail) {
      axios
        .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        })
        .then(res => {
          setUserDetails(res.data.User);
        })
        .catch(err => console.log('Error fetching user details:', err));
    }
  }, [userEmail]);

  const isToastShown = useRef(false);
  const hasProcessedCallback = useRef(false);

  // Handle modal visibility
  useEffect(() => {
    if (isVisible) {
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
      setShowWebView(false);
      setAuthUrl('');
      isToastShown.current = false;
      hasProcessedCallback.current = false;
      reauthHydratedRef.current = false;
    }
  }, [isVisible]);

  // Smart-reauth hydration: jump past the credential form to the WebView
  // when ManageConnectionsModal hands us a pre-signed URL + stored creds.
  const reauthHydratedRef = useRef(false);
  useEffect(() => {
    if (!isVisible || !reauthConfig || reauthHydratedRef.current) return;
    if (!reauthConfig.authUrl || !reauthConfig.apiKey) return;
    reauthHydratedRef.current = true;
    setApiKey(reauthConfig.apiKey);
    if (reauthConfig.secretKey) setSecretKey(reauthConfig.secretKey);
    setAuthUrl(reauthConfig.authUrl);
    setShowWebView(true);
  }, [isVisible, reauthConfig]);

  // Called after the CCXT server-side callback has finished the apisession →
  // session_token exchange and saved to the user record. No client-side
  // credential exchange happens here — this just closes the WebView, updates
  // model portfolio, and refreshes state (matches web's post-redirect flow).
  const finalizeConnection = () => {
    if (isToastShown.current) return;
    isToastShown.current = true;
    setShowWebView(false);

    // Non-critical: sync model portfolio with the newly connected broker.
    try {
      axios.request({
        method: 'post',
        url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
        data: JSON.stringify({ user_email: userEmail, user_broker: 'ICICI Direct' }),
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
        },
      });
    } catch (err) {
      console.warn('[ICICI] Model portfolio update failed (non-critical):', err);
    }

    onClose();
    setShowBrokerModal?.(false);
    // Wrap post-success steps so a downstream throw doesn't bubble to
    // the outer .catch and get rewritten as "Connection Failed". See
    // KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
    // § Broker-connect post-success hygiene.
    (async () => {
      try {
        const result = await fetchBrokerStatusModal?.();
        eventEmitter.emit('refreshEvent', { source: 'ICICI Direct broker connection' });
        if (!result?.migrationWillShow) {
          showAlert('success', 'Connected Successfully', 'Your ICICI Direct broker has been connected successfully!');
        }
      } catch (postSuccessErr) {
        console.warn(
          '[ICICI Direct] post-success step threw (connection IS saved DB-side):',
          postSuccessErr?.message || postSuccessErr,
        );
      }
    })();
  };

  // WebView interception — mirrors StockRecommendation.js:connectIciciDirect.
  //
  // ICICI redirects to the registered callback URL with ?apisession=XXX as a
  // query param. We intercept that param on ANY URL (CCXT relay, direct web
  // URL, or any other registered redirect) and handle the session exchange
  // client-side — same as the web app.
  //
  // Flow:
  //   1. ICICI redirects browser/WebView to {registeredCallback}?apisession=XXX
  //   2. We detect apisession= in the URL, extract the token, close WebView.
  //   3. POST to icici/customer-details with apiKey + apisession → get session_token.
  //   4. PUT to api/user/connect-broker to save the connection.
  //   5. finalizeConnection() shows success toast and closes the modal.
  const handleWebViewNavigationStateChange = newNavState => {
    const { url } = newNavState;
    console.log('[ICICI] WebView URL:', url);
    if (!url || hasProcessedCallback.current) return;
    if (!url.includes('apisession=')) return;

    const match = url.match(/[?&]apisession=([^&]+)/);
    const apiSession = match ? decodeURIComponent(match[1]) : null;
    if (!apiSession) return;

    hasProcessedCallback.current = true;
    setShowWebView(false);

    if (!userDetails?._id) {
      showAlert('error', 'Connection Failed', 'User details not loaded. Please restart the app and try again.');
      return;
    }

    axios.request({
      method: 'post',
      url: `${server.ccxtServer.baseUrl}icici/customer-details`,
      data: JSON.stringify({
        user_email: userEmail,
        apiKey: apiKey,
        accessToken: apiSession,
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
      },
    })
      .then(response => {
        const sessionToken = response.data?.Success?.session_token;
        if (!sessionToken) {
          showAlert('error', 'Connection Failed', 'ICICI did not return a session token. Please try again.');
          return null;
        }
        const iciciBrokerData = {
          uid: userDetails._id,
          user_broker: 'ICICI Direct',
          jwtToken: sessionToken,
          apiKey: checkValidApiAnSecret(apiKey),
          secretKey: checkValidApiAnSecret(secretKey),
        };
        // SDK pilot dual-write — see brokerSdkBridge.js.
        if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
          sdkDualWriteSafely(
            sdkConnectBroker(sdkBridge.client, 'ICICI Direct', iciciBrokerData),
            'ICICI Direct',
            'connect',
          );
        }
        return axios.put(
          `${server.server.baseUrl}api/user/connect-broker`,
          JSON.stringify(iciciBrokerData),
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
          },
        );
      })
      .then(connectResponse => {
        if (connectResponse) finalizeConnection();
      })
      .catch(err => {
        console.error('[ICICI] session exchange error:', err);
        const isHttpError = !!err?.response;
        const rawMessage =
          err.response?.data?.message ||
          err.response?.data?.details ||
          '';
        let alertTitle = 'Connection Failed';
        let alertBody;
        if (isHttpError) {
          alertBody =
            rawMessage || 'Failed to connect ICICI Direct. Please try again.';
        } else {
          alertTitle = 'Connection Issue';
          alertBody =
            'We couldn\'t complete the connection because of a network or app error. Your credentials may already be saved — please refresh to check before retrying.';
        }
        showAlert('error', alertTitle, alertBody);
      });
  };

  const checkValidApiAnSecret = details => {
    const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');
    return bytesKey.toString();
  };

  // Egress-IP gate (see EgressIpCallout). ICICI requires a dedicated
  // static IP whitelisted in Breeze API app → IP Whitelist.
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);

  const initiateAuth = () => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    if (!userDetails?._id || !apiKey || !secretKey) {
      showAlert('error', 'Missing Fields', 'Please fill in all required fields.');
      return;
    }

    const data = {
      uid: userDetails._id,
      apiKey: checkValidApiAnSecret(apiKey),
      secretKey: checkValidApiAnSecret(secretKey),
    };

    axios
      .put(`${server.server.baseUrl}api/icici/update-key`, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      })
      .then(() => {
        const url = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(
          apiKey,
        )}`;
        setAuthUrl(url);
        setShowWebView(true);
      })
      .catch(error => {
        console.error('Error initiating auth:', error);
        showAlert('error', 'Authentication Failed', 'Failed to authenticate. Please check your credentials.');
      });
  };

  const [shouldRenderContent, setShouldRenderContent] = React.useState(false);
  useEffect(() => {
    if (isVisible) {
      setShouldRenderContent(true);
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
    }
  }, [isVisible]);

  const OpenHelpModal = () => {
    setHelpVisible(true);
  };
  const handleClose = () => {
    onClose();
    setShowBrokerModal(false);
  };

  return (
    <ICICIConnectUI
      isVisible={isVisible}
      onClose={onClose}
      apiKey={apiKey}
      secretKey={secretKey}
      isPasswordVisible={isPasswordVisible}
      isPasswordVisibleup={isPasswordVisibleup}
      showWebView={showWebView}
      authUrl={authUrl}
      helpVisible={helpVisible}
      loading={loading}
      setHelpVisible={setHelpVisible}
      setApiKey={setApiKey}
      setSecretKey={setSecretKey}
      setIsPasswordVisible={setIsPasswordVisible}
      setIsPasswordVisibleup={setIsPasswordVisibleup}
      setShowICICIUPModal={setShowBrokerModal}
      OpenHelpModal={OpenHelpModal}
      handleClose={handleClose}
      initiateAuth={initiateAuth}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
      shouldRenderContent={true}
      egressUserId={userDetails?._id}
      egressUserEmail={userEmail}
      egressReady={egressReady}
      setEgressReady={setEgressReady}
      unmetAck={unmetAck}
      setUnmetAck={setUnmetAck}
      configData={configData}
    />
  );
};

export default ICICIUPModal;
