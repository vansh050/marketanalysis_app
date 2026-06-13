import React, { useState, useRef, useEffect } from 'react';

import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';
import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';

import axios from 'axios';
import HDFCConnectUI from '../../UIComponents/BrokerConnectionUI/HDFCConnectUI';
import { useTrade } from '../../screens/TradeContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

const HDFCconnectModal = ({
  isVisible,
  setShowhdfcModal,
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
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const [isPasswordVisibleup, setIsPasswordVisibleup] = useState(false);
  const sheet = useRef(null);
  const scrollViewRef = useRef(null);

  const checkValidApiAnSecret = details => {
    const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString();
    if (Key) {
      return Key;
    }
  };

  const [helpVisible, setHelpVisible] = useState(false);
  const [hdfcRequestToken, setHdfcRequestToken] = useState(null);
  const [hdfcSessionToken, setHdfcSessionToken] = useState(null);
  const hasConnectedHdfc = useRef(false);
  const isToastShown = useRef(false);

  const OpenHelpModal = () => {
    setHelpVisible(true);
  };

  const handleWebViewClose = () => {
    setShowWebView(false);
  };

  const parseQueryString = queryString => {
    const params = {};
    const query = queryString?.startsWith('?') ? queryString.substring(1) : queryString;
    const pairs = query?.split('&') || [];
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });
    return params;
  };

  const [userDetails, setUserDetails] = useState();
  const getUserDeatils = () => {
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
      .catch(err => console.log('[HDFC] Error fetching user:', err));
  };
  useEffect(() => {
    getUserDeatils();
  }, [userEmail, server.server.baseUrl]);

  const userId = userDetails && userDetails._id;

  // Egress-IP gate (see EgressIpCallout). HDFC requires a dedicated
  // static IP whitelisted in InvestRight API app → Allowed IPs.
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);

  // Step 1: Extract requestToken from callback URL
  const handleWebViewNavigationStateChange = newNavState => {
    const { url } = newNavState;
    console.log('[HDFC] WebView URL:', url);

    if (url.includes('requestToken=')) {
      const queryString = url.split('?')[1];
      if (queryString) {
        const queryParams = parseQueryString(queryString);
        const requestToken = queryParams.requestToken;
        if (requestToken) {
          console.log('[HDFC] Request token received');
          setHdfcRequestToken(requestToken);
          setShowWebView(false);
        }
      }
    }
  };

  // Step 2: Exchange requestToken for access token
  const connectHdfc = () => {
    if (hdfcRequestToken !== null && apiKey && secretKey && !hasConnectedHdfc.current) {
      let data = JSON.stringify({
        user_email: userEmail,
        apiKey: apiKey,
        apiSecret: secretKey,
        requestToken: hdfcRequestToken,
      });
      console.log('[HDFC] Exchanging request token for access token...');
      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}hdfc/access-token`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data: data,
      };
      axios
        .request(config)
        .then(response => {
          if (response.data) {
            console.log('[HDFC] Access token received');
            const session_token = response.data.accessToken;
            setHdfcSessionToken(session_token);
          }
        })
        .catch(error => {
          console.error('[HDFC] Token exchange error:', error);
          showAlert('error', 'Connection Error', 'Failed to connect to HDFC. Please try again.');
        });
      hasConnectedHdfc.current = true;
    }
  };

  useEffect(() => {
    if (hdfcRequestToken !== null && apiKey && secretKey) {
      connectHdfc();
    }
  }, [hdfcRequestToken, userDetails]);

  // Step 3: Save broker connection to DB
  const connectBrokerDbUpdate = () => {
    if (hdfcSessionToken && !isToastShown.current) {
      isToastShown.current = true;
      let brokerData = {
        uid: userId,
        user_broker: 'Hdfc Securities',
        jwtToken: hdfcSessionToken,
        apiKey: checkValidApiAnSecret(apiKey),
        secretKey: checkValidApiAnSecret(secretKey),
      };
      let config = {
        method: 'put',
        url: `${server.server.baseUrl}api/user/connect-broker`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data: JSON.stringify(brokerData),
      };

      axios
        .request(config)
        .then(response => {
          console.log('[HDFC] Broker connection saved successfully');

          // SDK pilot dual-write — see brokerSdkBridge.js.
          if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
            sdkDualWriteSafely(
              sdkConnectBroker(sdkBridge.client, 'Hdfc Securities', brokerData),
              'Hdfc Securities',
              'connect',
            );
          }

          // Update model portfolio (non-critical)
          try {
            axios.request({
              method: 'post',
              url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
              data: JSON.stringify({ user_email: userEmail, user_broker: 'Hdfc Securities' }),
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
              },
            });
          } catch (err) {
            console.warn('[HDFC] Model portfolio update failed (non-critical):', err);
          }

          onClose();
          setShowBrokerModal(false);
          // Wrap post-success steps so a downstream throw doesn't bubble
          // to the outer .catch and get rewritten as "Connection Error".
          // See KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
          // § Broker-connect post-success hygiene.
          (async () => {
            try {
              const result = await fetchBrokerStatusModal();
              eventEmitter.emit('refreshEvent', { source: 'HDFC Securities broker connection' });
              if (!result?.migrationWillShow) {
                showAlert('success', 'Connected Successfully', 'Your HDFC broker has been connected successfully!');
              }
            } catch (postSuccessErr) {
              console.warn(
                '[Hdfc Securities] post-success step threw (connection IS saved DB-side):',
                postSuccessErr?.message || postSuccessErr,
              );
            }
          })();
        })
        .catch(error => {
          console.error('[HDFC] connect-broker error:', error);
          const isHttpError = !!error?.response;
          const rawMessage =
            error.response?.data?.message ||
            error.response?.data?.details ||
            '';
          let alertTitle = 'Connection Error';
          let alertBody;
          if (isHttpError) {
            alertBody =
              rawMessage || 'Failed to save HDFC connection. Please try again.';
          } else {
            alertTitle = 'Connection Issue';
            alertBody =
              'We couldn\'t complete the connection because of a network or app error. Your credentials may already be saved — please refresh to check before retrying.';
          }
          showAlert('error', alertTitle, alertBody);
        });
    }
  };

  useEffect(() => {
    if (userId !== undefined && hdfcSessionToken) {
      connectBrokerDbUpdate();
    }
  }, [userId, hdfcSessionToken]);

  const [shouldRenderContent, setShouldRenderContent] = React.useState(false);
  useEffect(() => {
    if (isVisible) {
      setShouldRenderContent(true);
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
      reauthHydratedRef.current = false;
    }
  }, [isVisible]);

  // Smart-reauth hydration — see reauthHelpers.handleSmartReauth.
  const reauthHydratedRef = useRef(false);
  useEffect(() => {
    if (!isVisible || !reauthConfig || reauthHydratedRef.current) return;
    if (!reauthConfig.authUrl || !reauthConfig.apiKey || !reauthConfig.secretKey) {
      return;
    }
    reauthHydratedRef.current = true;
    setApiKey(reauthConfig.apiKey);
    setSecretKey(reauthConfig.secretKey);
    setAuthUrl(reauthConfig.authUrl);
    setShowWebView(true);
  }, [isVisible, reauthConfig]);

  const initiateAuth = () => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    let data = JSON.stringify({
      uid: userId,
      apiKey: checkValidApiAnSecret(apiKey),
      secretKey: checkValidApiAnSecret(secretKey),
      user_broker: 'Hdfc Securities',
    });
    let config = {
      method: 'post',
      url: `${server.server.baseUrl}api/hdfc/update-key`,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },

      data: data,
    };
    axios
      .request(config)
      .then(response => {
        if (response) {
          setAuthUrl(response.data.response);
          setShowWebView(true);
        }
      })
      .catch(error => {
        console.log(error);
      });
  };

  return (
    <HDFCConnectUI
      isVisible={isVisible}
      onClose={onClose}
      handleClose={onClose}
      shouldRenderContent={true}
      showWebView={showWebView}
      scrollViewRef={scrollViewRef}
      apiKey={apiKey}
      setApiKey={setApiKey}
      secretKey={secretKey}
      setSecretKey={setSecretKey}
      isPasswordVisible={isPasswordVisible}
      handleWebViewClose={handleWebViewClose}
      setIsPasswordVisible={setIsPasswordVisible}
      isPasswordVisibleup={isPasswordVisibleup}
      setIsPasswordVisibleup={setIsPasswordVisibleup}
      OpenHelpModal={OpenHelpModal}
      initiateAuth={initiateAuth}
      authUrl={authUrl}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
      helpVisible={helpVisible}
      setHelpVisible={setHelpVisible}
      egressUserId={userId}
      egressUserEmail={userEmail}
      egressReady={egressReady}
      setEgressReady={setEgressReady}
      unmetAck={unmetAck}
      setUnmetAck={setUnmetAck}
      configData={configData}
    />
  );
};

export default HDFCconnectModal;
