import React, { useState, useRef, useEffect } from 'react';
import { Dimensions } from 'react-native';

import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';

import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';

import { generateToken } from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import UpstoxConnectUI from '../../UIComponents/BrokerConnectionUI/UpstoxConnectUI';
import { useTrade } from '../../screens/TradeContext';
import { useConfig } from '../../context/ConfigContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const UpstoxModal = ({
  isVisible,
  setShowupstoxModal,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
  reauthConfig,
}) => {
  const { configData } = useTrade();
  const freshConfig = useConfig();
  const showAlert = useModalStore((state) => state.showAlert);
  const sdkBridge = useSdkBridge();
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [ispasswordVisibleup, setIsPasswordVisibleup] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const sheet = useRef(null);
  const scrollViewRef = useRef(null);

  // Must be the per-advisor web URL registered in Upstox's developer
  // portal (e.g. `https://prod.alphaquark.in/stock-recommendation`).
  // Upstox rejects with "Invalid redirect_uri" if it doesn't match.
  // Prefer fresh config from ConfigContext (fetches from API on app
  // start), fall back to TradeContext (cached in AsyncStorage from
  // login). No `.env` fallback — the bundled
  // `app-links.alphaquark.in/broker-callback` default does NOT match
  // the per-advisor URIs registered in each Upstox dev app, so falling
  // back to it silently breaks the connect. Empty → `updateSecretKey`
  // raises a "Broker redirect URL is not configured" alert instead of
  // sending a known-bad URL to Upstox.
  const brokerConnectRedirectURL =
    freshConfig?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    '';

  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [upstoxCode, setUpstoxCode] = useState(null);
  const [upstoxSessionToken, setUpstoxSessionToken] = useState(null);
  const hasConnectedUpstox = useRef(false);

  const checkValidApiAnSecret = details => {
    const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString();
    if (Key) {
      return Key;
    }
  };

  const parseQueryString = queryString => {
    const params = {};
    const query = queryString.startsWith('?')
      ? queryString.substring(1)
      : queryString;
    const pairs = query.split('&');
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value);
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
      .catch(err => console.log(err));
  };
  useEffect(() => {
    getUserDeatils();
  }, [userEmail, server.server.baseUrl]);

  const userId = userDetails && userDetails._id;

  const [helpVisible, setHelpVisible] = useState(false);
  const OpenHelpModal = () => {
    setHelpVisible(true);
  };

  // Egress-IP gate state (see EgressIpCallout.js). Upstox is on
  // WHITELIST_BROKERS; users MUST claim a dedicated IP and whitelist
  // it in their Upstox developer portal before connecting, otherwise
  // Upstox rejects with UDAPI1154 "static IP mismatch".
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);

  const updateSecretKey = () => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    // Validate redirect URL before proceeding
    if (!brokerConnectRedirectURL) {
      showAlert('error', 'Configuration Error', 'Broker redirect URL is not configured. Please contact support.');
      return;
    }

    setIsLoading(true);
    let data = JSON.stringify({
      uid: userId,
      apiKey: checkValidApiAnSecret(apiKey),
      secretKey: checkValidApiAnSecret(secretKey),
      redirect_uri: brokerConnectRedirectURL,
      user_broker: 'Upstox',
    });
    let config = {
      method: 'post',
      url: `${server.server.baseUrl}api/upstox/update-key`,

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
    console.log('[Upstox] updateSecretKey params:', userId, apiKey, secretKey, brokerConnectRedirectURL);
    axios
      .request(config)
      .then(response => {
        if (response) {
          console.log('[Upstox] Backend response:', JSON.stringify(response.data));
          const authUrlResponse = response.data.response || '';

          // Check if Upstox returned an error in the redirect URL
          if (authUrlResponse.includes('error_code') || authUrlResponse.includes('error_message')) {
            setIsLoading(false);
            // Defensive string-parse instead of `new URL()` +
            // `searchParams.get()`. React Native has no
            // react-native-url-polyfill installed and its built-in URL
            // is partial — `searchParams` can misbehave, which used to
            // silently fall into the catch and hide Upstox's real error
            // message (e.g. "IP not whitelisted", "Invalid redirect
            // uri", "Invalid client_id") behind the generic fallback.
            const qIdx = authUrlResponse.indexOf('?');
            const params = {};
            // Upstox form-encodes spaces as `+` (not `%20`), so replace
            // `+` with space BEFORE decodeURIComponent — otherwise the
            // error text shows up as "Check+your+'client_id'..." in
            // the alert (decodeURIComponent only handles `%XX`).
            const decode = s => {
              try { return decodeURIComponent(s.replace(/\+/g, ' ')); }
              catch { return s; }
            };
            if (qIdx >= 0) {
              authUrlResponse.slice(qIdx + 1).split('&').forEach(pair => {
                const eq = pair.indexOf('=');
                if (eq < 0) return;
                params[decode(pair.slice(0, eq))] = decode(pair.slice(eq + 1));
              });
            }
            const errorMsg = params.error_message || '';
            const errorCode = params.error_code || '';
            console.log('[Upstox] OAuth error:', {errorCode, errorMsg, raw: authUrlResponse});
            const detail = [errorMsg, errorCode && `(${errorCode})`]
              .filter(Boolean)
              .join(' ');
            showAlert(
              'error',
              'Upstox Connection Failed',
              detail ||
                'Please check your API Key, Secret Key and Redirect URI in your Upstox app settings and try again.',
            );
            return;
          }

          setAuthUrl(authUrlResponse);
          setShowWebView(true);
        }
      })
      .catch(error => {
        console.log('[Upstox] Error:', error?.response?.data || error?.message || error);
        setIsLoading(false);
        showAlert('error', 'Incorrect Credentials', 'Please check your API Key and Secret Key and try again.');
      });
  };

  const handleWebViewNavigationStateChange = newNavState => {
    const { url } = newNavState;
    console.log('[Upstox] WebView URL:', url);

    if (url.includes('code=')) {
      const queryString = url.split('?')[1];
      if (queryString) {
        const queryParams = parseQueryString(queryString);
        const authCode = queryParams.code;
        if (authCode) {
          console.log('[Upstox] Authorization code received');
          setUpstoxCode(authCode);
          setShowWebView(false);
        }
      }
    }
  };

  // Step 2: Exchange authorization code for access token
  const connectUpstox = () => {
    if (upstoxCode !== null && apiKey && secretKey && !hasConnectedUpstox.current) {
      hasConnectedUpstox.current = true;
      let data = JSON.stringify({
        user_email: userEmail,
        apiKey: apiKey,
        apiSecret: secretKey,
        code: upstoxCode,
        redirectUri: brokerConnectRedirectURL,
      });
      console.log('[Upstox] Exchanging code for access token...');
      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}upstox/gen-access-token`,
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
          const session_token = response.data?.access_token;
          if (!session_token) {
            console.error('[Upstox] gen-access-token returned no access_token:', response.data);
            setIsLoading(false);
            showAlert('error', 'Connection Error', 'Upstox token exchange failed. Check your API key, secret, and redirect URI in the Upstox developer portal.');
            return;
          }
          console.log('[Upstox] Access token received');
          setUpstoxSessionToken(session_token);
        })
        .catch(error => {
          console.error('[Upstox] Token exchange error:', error);
          setIsLoading(false);
          showAlert('error', 'Connection Error', 'Failed to connect to Upstox. Please try again.');
        });
    }
  };

  useEffect(() => {
    if (upstoxCode) {
      connectUpstox();
    }
  }, [upstoxCode, userDetails]);

  // Step 3: Save broker connection to DB
  const connectBrokerDbUpdate = () => {
    if (upstoxSessionToken) {
      setIsLoading(false);
      let brokerData = {
        uid: userId,
        user_broker: 'Upstox',
        jwtToken: upstoxSessionToken,
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
          console.log('[Upstox] Broker connection saved successfully');
          setIsLoading(false);

          // SDK pilot dual-write — see brokerSdkBridge.js.
          if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
            sdkDualWriteSafely(
              sdkConnectBroker(sdkBridge.client, 'Upstox', brokerData),
              'Upstox',
              'connect',
            );
          }

          // Update model portfolio with broker information
          try {
            axios.request({
              method: 'post',
              url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
              data: JSON.stringify({
                user_email: userEmail,
                user_broker: 'Upstox',
              }),
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            });
          } catch (modelPortfolioError) {
            console.warn('[Upstox] Model portfolio update failed (non-critical):', modelPortfolioError);
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
              eventEmitter.emit('refreshEvent', { source: 'Upstox broker connection' });
              if (!result?.migrationWillShow) {
                showAlert('success', 'Connected Successfully', 'Your Upstox broker has been connected successfully!');
              }
            } catch (postSuccessErr) {
              console.warn(
                '[Upstox] post-success step threw (connection IS saved DB-side):',
                postSuccessErr?.message || postSuccessErr,
              );
            }
          })();
        })
        .catch(error => {
          console.error('[Upstox] connect-broker error:', error);
          setIsLoading(false);
          const isHttpError = !!error?.response;
          const rawMessage =
            error.response?.data?.message ||
            error.response?.data?.details ||
            '';
          let alertTitle = 'Connection Error';
          let alertBody;
          if (isHttpError) {
            alertBody =
              rawMessage || 'Failed to save Upstox connection. Please try again.';
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
    if (userId !== undefined && upstoxSessionToken) {
      connectBrokerDbUpdate();
    }
  }, [userId, upstoxSessionToken]);

  const [shouldRenderContent, setShouldRenderContent] = React.useState(true);

  useEffect(() => {
    if (isVisible) {
      setShouldRenderContent(true);
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
    }
  }, [isVisible]);

  // Smart-reauth hydration: when reauthConfig is supplied by the caller
  // (ManageConnectionsModal → reauthHelpers.handleSmartReauth), skip the
  // credential form and jump straight to the WebView step using the
  // pre-signed authUrl + stored apiKey/secretKey.
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

  const handleWebViewClose = () => {
    setShowWebView(false);
  };

  return (
    <UpstoxConnectUI
      isVisible={isVisible}
      onClose={onClose}
      shouldRenderContent={true}
      showWebView={showWebView}
      apiKey={apiKey}
      secretKey={secretKey}
      isPasswordVisible={isPasswordVisible}
      isPasswordVisibleUp={ispasswordVisibleup}
      setApiKey={setApiKey}
      setSecretKey={setSecretKey}
      setIsPasswordVisible={setIsPasswordVisible}
      setIsPasswordVisibleUp={setIsPasswordVisibleup}
      updateSecretKey={updateSecretKey}
      isLoading={isLoading}
      OpenHelpModal={OpenHelpModal}
      handleWebViewClose={handleWebViewClose}
      authUrl={authUrl}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
      helpVisible={helpVisible}
      setHelpVisible={setHelpVisible}
      scrollViewRef={null}
      screenHeight={screenHeight}
      egressUserId={userId}
      egressUserEmail={userEmail}
      egressReady={egressReady}
      setEgressReady={setEgressReady}
      unmetAck={unmetAck}
      setUnmetAck={setUnmetAck}
      configData={configData}
      brokerConnectRedirectURL={brokerConnectRedirectURL}
    />
  );
};
export default UpstoxModal;
