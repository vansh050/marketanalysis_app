import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Dimensions,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';

import {getAuth} from '@react-native-firebase/auth';
import crashlytics from '@react-native-firebase/crashlytics';
import server from '../../utils/serverConfig';
import {
  isValidFyersAppId,
  fyersAppIdFieldError,
  normalizeFyersAppId,
  FYERS_APP_ID_ENTERED_MESSAGE,
} from '../../utils/fyersAppId';
import CryptoJS from 'react-native-crypto-js';
import axios from 'axios';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import FyersConnectUI from '../../UIComponents/BrokerConnectionUI/FyersConnectUI';
import BrokerConnectStepperSheet from './BrokerConnectStepperSheet';
import CrossPlatformOverlay from '../CrossPlatformOverlay';
import { useTrade } from '../../screens/TradeContext';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';
import {getAccountEmail} from '../../utils/accountEmail';
import {
  FYERS_REDIRECT_MISMATCH,
  isFyersRedirectMismatch,
} from '../../utils/fyersOAuthErrors';

import { designColor, designFont } from '../../design/literalTokens';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const commonHeight = screenHeight * 0.06;

const recordFyersBreadcrumb = (event, details = {}) => {
  const safe = {
    broker: 'Fyers',
    event,
    phase: details.phase || undefined,
    errorCode: details.errorCode || undefined,
  };
  try {
    crashlytics().log(`[BrokerConnect] ${JSON.stringify(safe)}`);
  } catch (_) {
    // Diagnostics must never interfere with broker connection.
  }
};

const FyersConnect = ({
  isVisible,
  setShowFyersModal,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
  reauthConfig,
  initialCredentials,
  initialEgressReady = false,
  autoStart = false,
  initialUserId,
  onBackToQuickReconnect,
}) => {
  const { configData } = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);
  const sdkBridge = useSdkBridge();
  const [apiKey, setApiKey] = useState(() => initialCredentials?.appSecret || '');
  const [secretKey, setSecretKey] = useState(() => initialCredentials?.appId || '');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [fyersAuthCode, setFyersAuthCode] = useState(null);
  const [fyersAccessToken, setFyersAccessToken] = useState(null);
  const hasConnectedFyers = useRef(false);
  const redirectMismatchHandled = useRef(false);
  const autoStartHandled = useRef(false);
  // Set when the staged (auto-start) hand-off cannot finish — update-key
  // rejected, redirect mismatch, token exchange failed, or the WebView
  // renderer died. Only then does the credential sheet render; until then the
  // hand-off shows one lightweight surface instead of a second full sheet.
  const [autoStartFailed, setAutoStartFailed] = useState(false);

  const brokerConnectRedirectURL =
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL;

  const userEmail = getAccountEmail();
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
      const separator = pair.indexOf('=');
      if (separator <= 0) return;
      try {
        const key = decodeURIComponent(pair.slice(0, separator));
        const value = decodeURIComponent(pair.slice(separator + 1));
        params[key] = value;
      } catch (_) {
        // Ignore malformed third-party query segments instead of crashing the
        // JS runtime while the Fyers WebView is navigating.
      }
    });
    return params;
  };

  // The Fyers flow only needs the Mongo id. Keeping an account's entire user
  // document in this modal doubled a large account's live object graph while
  // mounting the OAuth WebView and made low-memory Android crashes more likely.
  // DeviceTotpReconnectGate passes the id it already fetched (initialUserId),
  // so the combined onboarding path downloads the user document only once.
  const [userId, setUserId] = useState(initialUserId);
  const getUserDeatils = () => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      })
      .then(res => {
        setUserId(res.data?.User?._id);
        recordFyersBreadcrumb('user_id_loaded', {phase: 'prepare'});
      })
      .catch(error => {
        setAutoStartFailed(true);
        recordFyersBreadcrumb('user_id_load_failed', {
          phase: 'prepare',
          errorCode: error?.response?.status
            ? `http_${error.response.status}`
            : 'client_error',
        });
      });
  };
  useEffect(() => {
    if (initialUserId) {
      recordFyersBreadcrumb('user_id_reused', {phase: 'prepare'});
      return;
    }
    getUserDeatils();
  }, [initialUserId, userEmail, server.server.baseUrl]);

  // Egress-IP gate (see EgressIpCallout). Fyers requires a dedicated
  // static IP whitelisted in the user's Fyers API dashboard.
  const [egressReady, setEgressReady] = useState(Boolean(initialEgressReady));
  const [unmetAck, setUnmetAck] = useState(false);

  // Step 1: Extract auth_code from OAuth callback URL
  const handleWebViewNavigationStateChange = newNavState => {
    const { url } = newNavState;

    if (typeof url === 'string' && url.includes('auth_code=')) {
      const queryString = url.split('?')[1];
      if (queryString) {
        const queryParams = parseQueryString(queryString);
        const authcode = queryParams.auth_code;
        if (authcode) {
          recordFyersBreadcrumb('oauth_callback_received', {phase: 'oauth'});
          setFyersAuthCode(authcode);
          setShowWebView(false);
        }
      }
    }
  };

  const handleWebViewMessage = event => {
    if (redirectMismatchHandled.current) return;

    const raw = event?.nativeEvent?.data || '';
    let type = '';
    try {
      type = JSON.parse(raw)?.type || '';
    } catch (_error) {
      // Keep compatibility with a plain-text message if WebView serialisation
      // changes in a future react-native-webview upgrade.
    }

    if (
      type !== FYERS_REDIRECT_MISMATCH &&
      !isFyersRedirectMismatch(raw)
    ) {
      return;
    }

    redirectMismatchHandled.current = true;
    setShowWebView(false);
    setLoading(false);
    setAutoStartFailed(true);
    showAlert(
      'error',
      'Fyers Redirect URL Needs Update',
      `Open your Fyers API Dashboard and set the Redirect URL for this App ID exactly to:\n\n${brokerConnectRedirectURL}\n\nSave it, then tap Connect Fyers again.`,
    );
  };

  // Android can kill (or crash) the WebView renderer under memory pressure
  // while the Fyers login page is open. A dead WebView left mounted is a blank
  // or crashing surface, so unmount it and let the customer retry. iOS
  // reports the same event as a terminated content process.
  const handleWebViewRenderProcessGone = event => {
    recordFyersBreadcrumb('webview_render_process_gone', {
      phase: 'oauth',
      errorCode: event?.nativeEvent?.didCrash ? 'renderer_crashed' : 'renderer_killed',
    });
    setShowWebView(false);
    setLoading(false);
    setAutoStartFailed(true);
    showAlert(
      'error',
      'Fyers login page closed',
      'Your phone closed the Fyers login page to free memory. Tap Connect Fyers to try again.',
    );
  };

  // Step 2: Exchange auth_code for access token
  const connectFyers = () => {
    if (
      fyersAuthCode !== null &&
      userId &&
      apiKey &&
      secretKey &&
      !hasConnectedFyers.current
    ) {
      hasConnectedFyers.current = true;
      recordFyersBreadcrumb('token_exchange_started', {phase: 'exchange'});
      Promise.resolve(getAuth().currentUser?.getIdToken?.())
        .then(firebaseToken => {
          if (!firebaseToken) {
            throw new Error('Please sign in again before connecting Fyers.');
          }
          return axios.request({
            method: 'post',
            url: `${server.server.baseUrl}api/fyers/exchange-token`,
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
              Authorization: `Bearer ${firebaseToken}`,
            },
            data: JSON.stringify({uid: userId, authCode: fyersAuthCode}),
          });
        })
        .then(response => {
          if (response.data) {
            const session_token = response.data.accessToken;
            recordFyersBreadcrumb('token_exchange_succeeded', {phase: 'exchange'});
            setFyersAccessToken(session_token);
          }
        })
        .catch(error => {
          hasConnectedFyers.current = false;
          setAutoStartFailed(true);
          recordFyersBreadcrumb('token_exchange_failed', {
            phase: 'exchange',
            errorCode: error?.response?.status
              ? `http_${error.response.status}`
              : 'client_error',
          });
          showAlert('error', 'Connection Error', 'Failed to connect to Fyers. Please try again.');
        });
    }
  };

  useEffect(() => {
    if (fyersAuthCode !== null && apiKey && secretKey) {
      connectFyers();
    }
  }, [apiKey, fyersAuthCode, secretKey, userId]);

  // Step 3: Save broker connection to DB
  const connectBrokerDbUpdate = () => {
    if (fyersAccessToken) {
      let brokerData = {
        uid: userId,
        user_broker: 'Fyers',
        jwtToken: fyersAccessToken,
        clientCode: normalizeFyersAppId(secretKey),
        secretKey: checkValidApiAnSecret(apiKey),
      };
      let config = {
        method: 'put',
        url: `${server.server.baseUrl}api/user/connect-broker`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
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
          recordFyersBreadcrumb('connection_saved', {phase: 'persist'});

          // Update model portfolio with broker information
          recordFyersBreadcrumb('reconciliation_started', {phase: 'post_connect'});
          axios.request({
            method: 'post',
            url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
            data: JSON.stringify({
              user_email: userEmail,
              user_broker: 'Fyers',
            }),
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          }).then(() => {
            recordFyersBreadcrumb('reconciliation_completed', {phase: 'post_connect'});
          }).catch(error => {
            recordFyersBreadcrumb('reconciliation_failed', {
              phase: 'post_connect',
              errorCode: error?.response?.status
                ? `http_${error.response.status}`
                : 'client_error',
            });
          });

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
          recordFyersBreadcrumb('connection_save_failed', {
            phase: 'persist',
            errorCode: error?.response?.status
              ? `http_${error.response.status}`
              : 'client_error',
          });
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
    // Fyers places orders only from an activated Algo-trading app whose
    // App ID ends in -200; any other app connects and reads funds fine,
    // then rejects every order (-50) and every eDIS call (-96). Catch it
    // here so the customer is told now, not at their first SELL.
    if (!isValidFyersAppId(secretKey)) {
      showAlert('error', 'Check your Fyers App ID', FYERS_APP_ID_ENTERED_MESSAGE);
      return;
    }
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    setLoading(true);
    let data = JSON.stringify({
      uid: userId,
      redirect_url: brokerConnectRedirectURL,
      clientCode: normalizeFyersAppId(secretKey),
      secretKey: checkValidApiAnSecret(apiKey),
    });
    let config = {
      method: 'post',
      url: `${server.server.baseUrl}api/fyers/update-key`,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': getTenantSubdomain(configData),
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
          recordFyersBreadcrumb('oauth_url_received', {phase: 'oauth'});
          setAuthUrl(response.data.response);
          setShowWebView(true);
        }
      })
      .catch(error => {
        recordFyersBreadcrumb('oauth_url_failed', {
          phase: 'oauth',
          errorCode: error?.response?.status
            ? `http_${error.response.status}`
            : 'client_error',
        });
        setLoading(false);
        setAutoStartFailed(true);
        showAlert('error', 'Incorrect Credentials', 'Please check your API Key and Secret Key and try again.');
      });
  };

  // First-time device-TOTP onboarding already collected the API app fields
  // and static-IP acknowledgement. Start the canonical OAuth request directly
  // instead of displaying a second credential form. Normal-login callers do
  // not pass autoStart and retain the existing form.
  useEffect(() => {
    if (
      !isVisible ||
      !autoStart ||
      autoStartHandled.current ||
      !userId ||
      !apiKey ||
      !isValidFyersAppId(secretKey) ||
      !egressReady
    ) {
      return;
    }
    autoStartHandled.current = true;
    updateSecretKey();
  }, [apiKey, autoStart, egressReady, isVisible, secretKey, userId]);

  const [shouldRenderContent, setShouldRenderContent] = React.useState(false);
  useEffect(() => {
    if (isVisible) {
      setShouldRenderContent(true);
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
      reauthHydratedRef.current = false;
      redirectMismatchHandled.current = false;
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    recordFyersBreadcrumb(showWebView ? 'webview_mounted' : 'webview_unmounted', {
      phase: 'oauth',
    });
  }, [isVisible, showWebView]);

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

  const fyersSheetConfig = useMemo(
    () => ({
      monogram: 'F',
      brandFrom: designColor('3d5afe'),
      brandTo: designColor('1e40af'),
      portalUrl: 'https://fyers.in/web/api-dashboard/user-apps',
      portalLabel: 'Open Fyers API Dashboard',
      redirectUrl: brokerConnectRedirectURL,
      walkthroughVideoId: 'TdadXSWAxeY',
      guideSteps: [
        'Log in with your <b>mobile number</b>, OTP/TOTP and <b>PIN</b>',
        'Open <b>fyers.in/web/api-dashboard/user-apps</b>',
        'On that list, click the app named <b>“Algo trading app”</b> (it sits at the top). <b>Do not</b> press <b>Create App</b> — that makes an ordinary app which can never place orders',
        'Set the <b>Redirect URL</b> below',
        'Paste the <b>static IP</b> below into <b>Static IP</b> — it must match exactly',
        'Tick the permissions, including <b>Order Placement</b>',
        'Click <b>Activate</b>',
        'Fyers now issues a <b>new App ID and Secret</b>. Copy the <b>App ID</b> — it ends in <b>-200</b> and is <b>not</b> your YR…/XL… login ID',
        'Copy the new <b>Secret ID</b>',
      ],
      note:
        'Since April 2026 Fyers only accepts orders from the <b>activated “Algo trading app”</b> — its App ID ends in <b>-200</b>. Any older app still logs in and shows your holdings, then rejects every order with "algo orders are not allowed". Ticking Order Placement on an older app does <b>not</b> fix it: open the “Algo trading app” entry and Activate it, which issues a <b>new App ID and Secret ID</b>. A static IP that does not match the one shown here causes the same error.',
    }),
    [brokerConnectRedirectURL],
  );

  // OAuth phase: keep the existing FyersConnectUI WebView flow untouched.
  // Credential phase: shared web-parity stepper (RN port of web
  // BrokerConnectStepper / FyersConnection.js — same guide steps, redirect
  // URL copy row, and egress static-IP gating). NOTE Fyers naming swap:
  // "App ID" lives in `secretKey` state (DB clientCode), the OAuth secret
  // in `apiKey` state (DB secretKey) — see the reauth-hydration comment.
  if (showWebView) {
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
        handleWebViewMessage={handleWebViewMessage}
        handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
        handleWebViewRenderProcessGone={handleWebViewRenderProcessGone}
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
  }

  // Staged hand-off from DeviceTotpReconnectGate: the gate already showed the
  // guide, egress callout and credential fields. Rendering the full sheet
  // again would remount EgressIpCallout (another /egress/me) on the way to the
  // WebView, so show a single light progress surface until OAuth opens or the
  // token exchange completes.
  if (autoStart && initialCredentials && !autoStartFailed) {
    return (
      <CrossPlatformOverlay visible={!!isVisible} onClose={onClose}>
        <View style={styles.handoff}>
          <ActivityIndicator size="large" color={designColor('3d5afe')} />
          <Text style={styles.handoffText}>
            {fyersAuthCode ? 'Connecting Fyers…' : 'Opening Fyers login…'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.handoffCancel}>
            <Text style={styles.handoffCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </CrossPlatformOverlay>
    );
  }

  return (
    <BrokerConnectStepperSheet
      isVisible={!!isVisible}
      onClose={onClose}
      broker="Fyers"
      config={fyersSheetConfig}
      egressBrokerKey="fyers"
      customerId={userId}
      customerEmail={userEmail}
      egressReady={egressReady}
      setEgressReady={setEgressReady}
      unmetAck={unmetAck}
      setUnmetAck={setUnmetAck}
      fields={[
        {
          label: 'App ID',
          value: secretKey,
          onChange: (t) => setSecretKey(t.trim()),
          placeholder: 'e.g. ABCDE12345-200',
          error: fyersAppIdFieldError(secretKey),
        },
        {
          label: 'Secret ID',
          value: apiKey,
          onChange: (t) => setApiKey(t.trim()),
          password: true,
          placeholder: 'Paste your Fyers Secret ID',
        },
      ]}
      phase="creds"
      canSubmit={isValidFyersAppId(secretKey) && Boolean(apiKey)}
      submitLabel="Connect Fyers"
      loading={loading}
      onSubmit={updateSecretKey}
      alternateAction={onBackToQuickReconnect ? {
        label: 'Back to quick reconnect setup',
        onPress: onBackToQuickReconnect,
      } : null}
    />
  );
};

// The credential step uses BrokerConnectStepperSheet, but the OAuth phase
// still renders the legacy FyersConnectUI. Keep its style contract local to
// this container. Removing this object made both fresh connect (after the
// credential submit) and smart re-auth crash as soon as showWebView became
// true because `styles` was evaluated as an undefined identifier.
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
    backgroundColor: designColor('fff'),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 10,
    height: 'auto',
  },
  content: {padding: 0},
  content1: {justifyContent: 'center'},
  closeButton: {position: 'absolute', top: 10, right: 10},
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
    fontFamily: designFont('Poppins-Regular'),
  },
  link: {color: 'blue', textDecorationLine: 'underline'},
  stepGuide: {
    fontSize: 16,
    color: 'black',
    marginRight: 10,
    marginLeft: 10,
    fontFamily: designFont('Poppins-SemiBold'),
  },
  label: {
    fontSize: 17,
    fontWeight: 'bold',
    color: 'black',
    marginHorizontal: 10,
    marginBottom: 5,
  },
  inputContainer: {
    borderColor: designColor('d5d4d4'),
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
    backgroundColor: designColor('fff'),
    marginTop: 20,
    height: screenHeight / 1.7,
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
  },
  webView: {flex: 1},
  handoff: {
    flex: 1,
    backgroundColor: designColor('fff'),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  handoffText: {
    marginTop: 16,
    fontSize: 16,
    color: designColor('111827'),
    fontFamily: designFont('Poppins-SemiBold'),
  },
  handoffCancel: {marginTop: 24, padding: 10},
  handoffCancelText: {fontSize: 15, color: designColor('6b7280')},
});

export default FyersConnect;
