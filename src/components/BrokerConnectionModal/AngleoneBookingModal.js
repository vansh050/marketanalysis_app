import React, {useRef, useState, useEffect} from 'react';
import {StyleSheet, Dimensions} from 'react-native';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import axios from 'axios';
const {height: screenHeight} = Dimensions.get('window');
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import AngleOneConnectUI from '../../UIComponents/BrokerConnectionUI/AngelOneConnectUI';
import { useTrade } from '../../screens/TradeContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

const AngleOneBookingTrueSheet = ({
  isVisible,
  // setShowangleoneModal,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
}) => {
  const {configData} = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);
  const sdkBridge = useSdkBridge();

  const sheet = useRef(null);
  const scrollViewRef = useRef(null); // ScrollView ref for nested scrolling
  // The WebView opens at ccxt-india's `angelone/login-url`, NOT SmartAPI
  // directly. ccxt 302s through to SmartAPI publisher-login, but it now
  // appends &redirect_url=<server-side default> AND honors a frontend
  // &redirectUrl= override — without this, SmartAPI returns
  // "Invalid redirect URL" when the platform Trading credential has
  // multiple Apps registered (verified live 2026-04-28 in
  // prod-alphaquark-github commit 741d8412 / ccxt-india 81ff50f9 /
  // aq_backend_github 583876b). The mobile build was constructing
  // the SmartAPI URL directly which skipped this disambiguation —
  // same regression web hit before today's fix. We mirror web's
  // shared-mode parameters exactly:
  //   apiKey: advisor's platform-shared SmartAPI vendor app key
  //   origin: per-advisor web origin (used by ccxt for return-path
  //           construction; mobile passes prod.alphaquark.in default
  //           because the broker callback bounces through it)
  //   returnPath: legacy stock-recommendation page on the per-advisor
  //               web origin
  //   redirectUrl: legacy callback URL (URL-encoded). MUST match the
  //                URL registered in the broker dev portal under the
  //                shared SmartAPI app, or SmartAPI returns
  //                "Invalid redirect URL".
  const [authUrl, setauthurl] = useState('');
  const [authtoken, setAuthToken] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

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

  const parseQueryString = queryString => {
    const params = {};
    const query = queryString.startsWith('?')
      ? queryString.substring(1)
      : queryString;
    const pairs = query.split('&');

    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });

    return params;
  };

  const handleWebViewNavigationStateChange = newNavState => {
    const {url} = newNavState;
    if (url.includes('auth_token=')) {
      const queryParams = parseQueryString(url.split('?')[1]);
      const sessionToken = queryParams.auth_token;
      if (sessionToken) {
        setAuthToken(sessionToken);
        sheet.current?.dismiss(); // Close the TrueSheet when done
      }
    }
  };
  const angelApi = (configData?.config?.REACT_APP_ANGEL_ONE_API_KEY || Config?.REACT_APP_ANGEL_ONE_API_KEY);

  const isToastShown = useRef(false);
  const connectBrokerDbUpadte = () => {
    if (authtoken) {
      if (!isToastShown.current) {
        console.log('heref');
        isToastShown.current = true; // Prevent further execution
        let brokerData = {
          uid: userId,
          user_broker: 'Angel One',
          jwtToken: authtoken,
          apiKey: angelApi,
          ddpi_status: userDetails?.ddpi_status || 'empty', // Required for DB persistence
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
        console.log('Broker Data:', brokerData);
        axios
          .request(config)
          .then(response => {
            console.log('[AngelOne] Broker connected successfully, updating model portfolio...');

            // SDK pilot dual-write — see brokerSdkBridge.js. AngelOne
            // has no /api/AngelOne/update-key route on the legacy
            // backend, so we use connectBroker (PUT /sdk/v1/connections/Angel One/connect).
            if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
              sdkDualWriteSafely(
                sdkConnectBroker(sdkBridge.client, 'Angel One', brokerData),
                'Angel One',
                'connect',
              );
            }

            // Update model portfolio with broker information (non-critical)
            let newBrokerData = {
              user_email: userEmail,
              user_broker: 'AngelOne',
            };
            let A1_broker = {
              method: 'post',
              url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
              data: JSON.stringify(newBrokerData),
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            };

            // Execute the model portfolio broker update - catch separately so connection success isn't affected
            return axios.request(A1_broker).catch(err => {
              console.warn('[AngelOne] Model portfolio update failed (non-critical):', err);
              return null;
            });
          })
          .then(async response => {
            if (response) {
              console.log('[AngelOne] Model portfolio updated successfully');
            }
            // setShowangleoneModal(false);
            onClose();
            setShowBrokerModal(false);
            // Wrap post-success steps so a downstream throw doesn't bubble
            // to the outer .catch and get rewritten as "Connection Error".
            // See KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
            // § Broker-connect post-success hygiene.
            try {
              eventEmitter.emit('refreshEvent', { source: 'AngleOne broker connection' });
              const result = await fetchBrokerStatusModal();
              if (!result?.migrationWillShow) {
                showAlert('success', 'Connected Successfully', 'Your Angel One broker has been connected successfully!');
              }
            } catch (postSuccessErr) {
              console.warn(
                '[Angel One] post-success step threw (connection IS saved DB-side):',
                postSuccessErr?.message || postSuccessErr,
              );
            }
          })
          .catch(error => {
            console.log(error);
            const isHttpError = !!error?.response;
            const rawMessage =
              error.response?.data?.message ||
              error.response?.data?.details ||
              '';
            let alertTitle = 'Connection Error';
            let alertBody;
            if (isHttpError) {
              alertBody =
                rawMessage || 'Failed to connect to Angel One. Please try again.';
            } else {
              alertTitle = 'Connection Issue';
              alertBody =
                'We couldn\'t complete the connection because of a network or app error. Your credentials may already be saved — please refresh to check before retrying.';
            }
            showAlert('error', alertTitle, alertBody);
          });
      }
    }
  };

  useEffect(() => {
    if (userId !== undefined && authtoken) {
      connectBrokerDbUpadte();
    }
  }, [userId, authtoken]);

  useEffect(() => {
    if (isVisible) {
      const apiKey = (configData?.config?.REACT_APP_ANGEL_ONE_API_KEY || Config?.REACT_APP_ANGEL_ONE_API_KEY);
      if (apiKey) {
        // Mirror web exactly — open ccxt's `angelone/login-url`. ccxt
        // 302s through to SmartAPI publisher-login with redirect_url +
        // state nonce baked in. Web prod has been doing this since
        // commit 741d8412; mobile uses the same URL shape.
        //
        // Earlier 'Invalid URL' failures were caused by:
        //   1. Wrong REACT_APP_ANGEL_ONE_API_KEY in .env (jEYMXpNW
        //      instead of prod's J0v1kqJC). SmartAPI rejects when
        //      apiKey doesn't match the registered redirect URL.
        //   2. Force-stop missing — `monkey` only foregrounds; app's
        //      cached bundle held the old apiKey.
        // Both fixed; this is the canonical web-equivalent flow.
        const ccxtUrl = server.ccxtServer.baseUrl;
        const domainList = String(Config?.REACT_APP_DOMAIN || '').split(',');
        const webOrigin = (domainList[0] || 'https://prod.alphaquark.in').trim();
        const origin = encodeURIComponent(webOrigin);
        const returnPath = encodeURIComponent('stock-recommendation');
        // Legacy callback URL — registered in the broker dev portal
        // for the platform-shared SmartAPI app. Verbatim from
        // prod-alphaquark-github AllBrokerList.js handleAngelOneConnect
        // (commit 741d8412). REQUIRED — without it SmartAPI returns
        // 'Invalid redirect URL' when our shared Trading credential has
        // multiple Apps registered.
        const legacyRedirect = encodeURIComponent(
          'https://alphaquark.in/api/deploy/broker/callback',
        );
        setauthurl(
          `${ccxtUrl}angelone/login-url?apiKey=${apiKey}&origin=${origin}&returnPath=${returnPath}&redirectUrl=${legacyRedirect}`,
        );
      }
      sheet.current?.present(); // Show the TrueSheet if visible
    } else {
      sheet.current?.dismiss(); // Hide the TrueSheet if not visible
    }
  }, [isVisible, configData]);

  const handleClose = () => {
    // setShowangleoneModal(false);
    setauthurl('');
    // Update the state to reflect the sheet is closed
    onClose(); // Call the parent onClose function
  };

  return (
    <AngleOneConnectUI
      isVisible={isVisible}
      onClose={onClose}
      handleClose={handleClose}
      authUrl={authUrl}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
    />
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 10,
  },
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
    height: '100%', // Adjust modal height for proper scrolling
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 10,
  },
  handleIndicator: {
    width: 110,
    height: 6,
    borderRadius: 250,
    alignSelf: 'center',
    backgroundColor: '#f1f4f8',
    marginBottom: 5,
    marginTop: 20,
  },
  sheetContent: {
    flex: 1,
  },
  webView: {
    flex: 1,
    minHeight: screenHeight, // Ensure WebView has enough space for internal scrolling
  },
});

export default AngleOneBookingTrueSheet;
