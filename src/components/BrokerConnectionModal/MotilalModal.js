import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';

import { generateToken } from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import MotilalConnectUI from '../../UIComponents/BrokerConnectionUI/MotilalConnectUI';
import { useTrade } from '../../screens/TradeContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const commonHeight = screenHeight * 0.06;

const MotilalModal = ({
  isVisible,
  setMotilalModal,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
  reauthConfig,
}) => {
  const { configData } = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);
  const [apiKey, setApiKey] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [ispasswordVisibleup, setIsPasswordVisibleup] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const sheet = useRef(null);
  const scrollViewRef = useRef(null);

  const [loading, setLoading] = useState(false);

  const checkValidApiAnSecret = details => {
    const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString();
    if (Key) {
      return Key;
    }
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
  const [jwtToken, setjwtToken] = useState(null);
  const isToastShown = useRef(false);

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

  // Egress-IP gate (see EgressIpCallout). Motilal is IPv4-only — on
  // web the callout renders an "ipv4_provisioning" hard-block until
  // the IPv4 pool is ready. Mobile gets the same behaviour via the
  // shared callout component (no special-case code needed here).
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);

  // Debounce gate for /motilal-oswal/login. Motilal binds the OTP +
  // Authorization header + page session to a single page-load — back-
  // to-back logins (e.g. user spam-clicks Connect or hits Restart
  // immediately after a session-rotated WebView error) leave OTPs
  // from session N–1 still on screen while the active session has
  // already rotated to N, surfacing as "Authorization is Invalid In
  // Header Parameter" or `MO1007 Two Factor Authentication Failed`.
  // 30s is empirically enough for Motilal's session state to settle.
  // (Production trigger: 2026-04-25 user fired 4 logins in 4 minutes
  // and got all three Motilal failure modes in succession — see
  // BROKER_CONNECTION.md § Motilal session-affinity guard.)
  const lastConnectAtRef = useRef(0);
  const _MOTILAL_CONNECT_COOLDOWN_MS = 30 * 1000;

  const initiateAuth = () => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    const now = Date.now();
    const sinceLast = now - lastConnectAtRef.current;
    if (sinceLast < _MOTILAL_CONNECT_COOLDOWN_MS) {
      const wait = Math.ceil((_MOTILAL_CONNECT_COOLDOWN_MS - sinceLast) / 1000);
      showAlert(
        'warning',
        'Please wait',
        `Motilal needs ~${wait}s between login attempts to settle the session. ` +
          'Tapping Connect again immediately is what causes "Authorization Invalid" ' +
          'and "Two Factor Authentication Failed" errors.',
      );
      return;
    }
    console.log('[Motilal] Initiating auth:', apiKey, clientCode, userDetails?._id);
    if (!userDetails?._id || !apiKey || !clientCode) {
      showAlert('error', 'Missing Fields', 'Please fill in all required fields.');
      return;
    }
    lastConnectAtRef.current = now;
    const data = {
      uid: userDetails?._id,
      apiKey: checkValidApiAnSecret(apiKey),
      user_broker: 'Motilal Oswal',
      clientCode: clientCode,
      redirect_url: `${configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL.replace(
        'https://',
        '',
      )}`,
    };
    axios
      .put(`${server.server.baseUrl}api/motilal-oswal/update-key`, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      })
      .then(response => {
        if (response && response.data && response.data.response) {
          setAuthUrl(response.data.response);
          setShowWebView(true);
        } else {
          console.error('[Motilal] Unexpected response format', response);
        }
      })
      .catch(error => {
        console.error('[Motilal] Error during update key request:', error);
        showAlert('error', 'Incorrect Credentials', 'Please check your credentials and try again.');
      });
  };

  // Step 1: Extract accessToken from callback URL
  const handleWebViewNavigationStateChange = newNavState => {
    const { url } = newNavState;
    console.log('[Motilal] WebView URL:', url);

    if (url.includes('accessToken=')) {
      const queryString = url.split('?')[1];
      if (queryString) {
        const queryParams = parseQueryString(queryString);
        const accessToken = queryParams.accessToken;
        if (accessToken) {
          console.log('[Motilal] Access token received');
          setjwtToken(accessToken);
          setShowWebView(false);
        }
      }
    }
  };

  // Step 2: Save broker connection to DB (Motilal returns accessToken directly, no gen-access-token needed)
  const connectBrokerDbUpdate = () => {
    if (jwtToken && !isToastShown.current) {
      isToastShown.current = true;
      let brokerData = {
        uid: userId,
        jwtToken: jwtToken,
        apiKey: checkValidApiAnSecret(apiKey),
        user_broker: 'Motilal Oswal',
        clientCode: clientCode,
        redirectUrl: configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL,
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
          console.log('[Motilal] Broker connection saved successfully');

          // Update model portfolio (non-critical)
          try {
            axios.request({
              method: 'post',
              url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
              data: JSON.stringify({ user_email: userEmail, user_broker: 'Motilal Oswal' }),
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
              },
            });
          } catch (err) {
            console.warn('[Motilal] Model portfolio update failed (non-critical):', err);
          }

          fetchBrokerStatusModal();
          eventEmitter.emit('refreshEvent', { source: 'Motilal Oswal broker connection' });
          showAlert('success', 'Connected Successfully', 'Your Motilal Oswal broker has been connected successfully!');
          onClose();
          setShowBrokerModal(false);
        })
        .catch(error => {
          console.error('[Motilal] connect-broker error:', error);
          showAlert('error', 'Connection Error', 'Failed to save Motilal Oswal connection. Please try again.');
        });
    }
  };

  useEffect(() => {
    if (userId !== undefined && jwtToken) {
      connectBrokerDbUpdate();
    }
  }, [userId, jwtToken]);

  const [shouldRenderContent, setShouldRenderContent] = React.useState(true);

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
    if (!reauthConfig.authUrl || !reauthConfig.apiKey) return;
    reauthHydratedRef.current = true;
    setApiKey(reauthConfig.apiKey);
    if (reauthConfig.clientCode) setClientCode(reauthConfig.clientCode);
    setAuthUrl(reauthConfig.authUrl);
    setShowWebView(true);
  }, [isVisible, reauthConfig]);

  const handleWebViewClose = () => {
    setShowWebView(false);
  };

  // Called by MotilalConnectUI's "Restart connection" button when
  // the WebView errored AFTER Motilal's page had loaded once (i.e.
  // the session is rotated and reload would compound the problem).
  // Closes the WebView and wipes the stored authUrl + auth-token
  // staging state so the next user-initiated Connect goes through
  // the full /motilal-oswal/login round-trip and gets a fresh URL,
  // not a stale one. The 30s debounce on `initiateAuth` still
  // applies — protects against rapid Restart→Connect→Restart loops.
  const handleRequestRestart = () => {
    setShowWebView(false);
    setAuthUrl('');
    setjwtToken(null);
    isToastShown.current = false;
  };

  return (
    <MotilalConnectUI
        isVisible={isVisible}
        onClose={onClose}
        apiKey={apiKey}
        setApiKey={setApiKey}
        clientCode={clientCode}
        setClientCode={setClientCode}
        isPasswordVisible={isPasswordVisible}
        setIsPasswordVisible={setIsPasswordVisible}
        isPasswordVisibleup={ispasswordVisibleup}
        setIsPasswordVisibleup={setIsPasswordVisibleup}
        handleConnect={initiateAuth}
        loading={loading}
        helpVisible={helpVisible}
        setHelpVisible={setHelpVisible}
        showWebView={showWebView}
        authUrl={authUrl}
        handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
        handleWebViewClose={handleWebViewClose}
        onRequestRestart={handleRequestRestart}
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

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    alignContent: 'center',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 10,
    height: '100%',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
  },
  instruction: {
    fontSize: 15,
    color: 'black',
    marginVertical: 3,
    fontFamily: 'Poppins-Regular',
  },
  link: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  stepGuide: {
    fontSize: 16,
    color: 'black',
    marginRight: 10,
    marginLeft: 10,
    fontFamily: 'Poppins-SemiBold',
  },
  content: {
    padding: 10,
  },
  content1: {
    padding: 10,
    flex: 1,
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  playerWrapper: {
    overflow: 'hidden',
    marginTop: 20,
    alignSelf: 'center',
    borderRadius: 20,
    marginBottom: 20,
  },

  title: {
    fontSize: 20,
    marginHorizontal: 10,
    fontFamily: 'Poppins-SemiBold',
    color: 'black',
    marginVertical: 15,
  },
  label: {
    fontSize: 17,
    fontWeight: 'bold',
    color: 'black',
    marginHorizontal: 10,
    marginBottom: 5,
  },
  inputContainer: {
    borderColor: '#d5d4d4',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    width: '100%',
    height: commonHeight,
  },
  proceedButton: {
    backgroundColor: 'black',
    padding: 10,
    marginBottom: 10,
    marginTop: 5,
    borderRadius: 8,
    height: commonHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonText: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: 'white',
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {},
});

export default MotilalModal;
