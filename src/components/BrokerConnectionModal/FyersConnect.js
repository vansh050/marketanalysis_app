import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';

import { getAuth } from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';
import axios from 'axios';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import FyersConnectUI from '../../UIComponents/BrokerConnectionUI/FyersConnectUI';
import { useTrade } from '../../screens/TradeContext';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const commonHeight = screenHeight * 0.06;

const FyersConnect = ({
  isVisible,
  setShowFyersModal,
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

  const [loading, setLoading] = useState(false);
  const [fyersAuthCode, setFyersAuthCode] = useState(null);
  const [fyersAccessToken, setFyersAccessToken] = useState(null);
  const hasConnectedFyers = useRef(false);

  const brokerConnectRedirectURL =
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL;

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const [helpVisible, setHelpVisible] = useState(false);

  const sheet = useRef(null);
  const scrollViewRef = useRef(null);

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

  // Egress-IP gate (see EgressIpCallout). Fyers requires a dedicated
  // static IP whitelisted in the user's Fyers API dashboard.
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);

  // Step 1: Extract auth_code from OAuth callback URL
  const handleWebViewNavigationStateChange = newNavState => {
    const { url } = newNavState;
    console.log('[Fyers] WebView URL:', url);

    if (url.includes('auth_code=')) {
      const queryString = url.split('?')[1];
      if (queryString) {
        const queryParams = parseQueryString(queryString);
        const authcode = queryParams.auth_code;
        if (authcode) {
          console.log('[Fyers] Authorization code received');
          setFyersAuthCode(authcode);
          setShowWebView(false);
        }
      }
    }
  };

  // Step 2: Exchange auth_code for access token
  const connectFyers = () => {
    if (fyersAuthCode !== null && apiKey && secretKey) {
      let data = JSON.stringify({
        user_email: userEmail,
        clientId: secretKey,
        clientSecret: apiKey,
        authCode: fyersAuthCode,
      });
      console.log('[Fyers] Exchanging auth code for access token...');
      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}fyers/gen-access-token`,
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
            const session_token = response.data.accessToken;
            console.log('[Fyers] Access token received');
            setFyersAccessToken(session_token);
          }
        })
        .catch(error => {
          console.error('[Fyers] Token exchange error:', error);
          showAlert('error', 'Connection Error', 'Failed to connect to Fyers. Please try again.');
        });
      hasConnectedFyers.current = true;
    }
  };

  useEffect(() => {
    if (fyersAuthCode !== null && apiKey && secretKey) {
      connectFyers();
    }
  }, [fyersAuthCode, userDetails]);

  // Step 3: Save broker connection to DB
  const connectBrokerDbUpdate = () => {
    if (fyersAccessToken) {
      let brokerData = {
        uid: userId,
        user_broker: 'Fyers',
        jwtToken: fyersAccessToken,
        clientCode: secretKey,
        secretKey: checkValidApiAnSecret(apiKey),
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

      // SDK pilot dual-write — see brokerSdkBridge.js. Fired
      // alongside the legacy save (PUT /api/user/connect-broker)
      // so we can verify /sdk/v1/connections/Fyers/connect in
      // production. Failure logged, never blocks legacy success.
      if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
        sdkDualWriteSafely(
          sdkConnectBroker(sdkBridge.client, 'Fyers', brokerData),
          'Fyers',
          'connect',
        );
      }

      axios
        .request(config)
        .then(async response => {
          console.log('[Fyers] Broker connection saved successfully');

          // Update model portfolio with broker information
          try {
            axios.request({
              method: 'post',
              url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
              data: JSON.stringify({
                user_email: userEmail,
                user_broker: 'Fyers',
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
            console.warn('[Fyers] Model portfolio update failed (non-critical):', modelPortfolioError);
          }

          onClose();
          setShowBrokerModal(false);
          // Wrap post-success steps so a downstream throw doesn't bubble
          // to the outer .catch and get rewritten as "Connection Error".
          // See KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
          // § Broker-connect post-success hygiene.
          try {
            const result = await fetchBrokerStatusModal();
            eventEmitter.emit('refreshEvent', { source: 'Fyers broker connection' });
            if (!result?.migrationWillShow) {
              showAlert('success', 'Connected Successfully', 'Your Fyers broker has been connected successfully!');
            }
          } catch (postSuccessErr) {
            console.warn(
              '[Fyers] post-success step threw (connection IS saved DB-side):',
              postSuccessErr?.message || postSuccessErr,
            );
          }
        })
        .catch(error => {
          console.error('[Fyers] connect-broker error:', error);
          const isHttpError = !!error?.response;
          const rawMessage =
            error.response?.data?.message ||
            error.response?.data?.details ||
            '';
          let alertTitle = 'Connection Error';
          let alertBody;
          if (isHttpError) {
            alertBody =
              rawMessage || 'Failed to save Fyers connection. Please try again.';
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
    if (userId !== undefined && fyersAccessToken) {
      connectBrokerDbUpdate();
    }
  }, [userId, fyersAccessToken]);

  const handleClose = () => {
    setShowWebView(false);
  };

  const checkValidApiAnSecret = details => {
    const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString();
    if (Key) {
      return Key;
    }
  };

  const updateSecretKey = () => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    setLoading(true);
    let data = JSON.stringify({
      uid: userId,
      redirect_url: brokerConnectRedirectURL,
      clientCode: secretKey,
      secretKey: checkValidApiAnSecret(apiKey),
    });
    let config = {
      method: 'post',
      url: `${server.server.baseUrl}api/fyers/update-key`,

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
    console.log(userId, apiKey, secretKey, brokerConnectRedirectURL);
    axios
      .request(config)
      .then(response => {
        if (response) {
          console.log('[Fyers] Auth URL received:', response.data);
          setAuthUrl(response.data.response);
          setShowWebView(true);
        }
      })
      .catch(error => {
        console.log(error);
        showAlert('error', 'Incorrect Credentials', 'Please check your API Key and Secret Key and try again.');
      });
  };

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

  // Smart-reauth hydration. Fyers swaps modal terminology vs. DB:
  //   modal `apiKey` state  = OAuth secret (stored as credentials.secretKey)
  //   modal `secretKey` state = clientId (stored as credentials.clientCode)
  // reauthConfig follows DB naming — we translate here.
  const reauthHydratedRef = useRef(false);
  useEffect(() => {
    if (!isVisible || !reauthConfig || reauthHydratedRef.current) return;
    if (!reauthConfig.authUrl || !reauthConfig.secretKey || !reauthConfig.clientCode) {
      return;
    }
    reauthHydratedRef.current = true;
    setApiKey(reauthConfig.secretKey);   // OAuth secret
    setSecretKey(reauthConfig.clientCode); // clientId
    setAuthUrl(reauthConfig.authUrl);
    setShowWebView(true);
  }, [isVisible, reauthConfig]);

  const [isPasswordVisibleup, setIsPasswordVisibleup] = useState(false);

  const OpenHelpModal = () => {
    setHelpVisible(true);
  };

  return (
    <FyersConnectUI
      isVisible={isVisible}
      onClose={onClose}
      showWebView={showWebView}
      screenHeight={screenHeight}
      scrollViewRef={scrollViewRef}
      handleClose={handleClose}
      setShowFyersModal={setShowBrokerModal}
      secretKey={secretKey}
      isPasswordVisibleup={isPasswordVisibleup}
      setIsPasswordVisibleup={setIsPasswordVisibleup}
      OpenHelpModal={OpenHelpModal}
      setSecretKey={setSecretKey}
      apiKey={apiKey}
      isPasswordVisible={isPasswordVisible}
      setIsPasswordVisible={setIsPasswordVisible}
      setApiKey={setApiKey}
      updateSecretKey={updateSecretKey}
      loading={loading}
      authUrl={authUrl}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
      helpVisible={helpVisible}
      setHelpVisible={setHelpVisible}
      styles={styles}
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

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flex: 1,
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 10,
    height: 'auto',
  },
  content: {
    padding: 0,
  },
  content1: {
    justifyContent: 'center',
  },
  closeButton: { position: 'absolute', top: 10, right: 10 },

  title: {
    fontSize: 20,
    marginHorizontal: 10,
    fontWeight: 'Poppins-SemiBold',
    color: 'black',
  },
  playerWrapper: {
    overflow: 'hidden',
    marginTop: 20,
    alignSelf: 'center',
    borderRadius: 20,
    marginBottom: 20,
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
    height: commonHeight + 5,
  },
  proceedButton: {
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 10,
    height: commonHeight,
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
    justifyContent: 'center',
  },
  proceedButtonText: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: 'white',
  },
  webViewContainer: {
    backgroundColor: '#fff',
    marginTop: 20,
    height: screenHeight / 1.7,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  webView: {
    flex: 1,
  },
});

export default FyersConnect;
