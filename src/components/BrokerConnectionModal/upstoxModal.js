import React, { useState, useRef, useEffect } from 'react';
import { Dimensions } from 'react-native';

import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';

import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';

import { generateToken } from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import UpstoxConnectUI from '../../UIComponents/BrokerConnectionUI/UpstoxConnectUI';
import BrokerConnectStepperSheet from './BrokerConnectStepperSheet';
import { useTrade } from '../../screens/TradeContext';
import { useConfig } from '../../context/ConfigContext';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';
import {getAccountEmail} from '../../utils/accountEmail';
import {
  generateDeviceTotpFromSeed,
  hasDeviceTotp,
  normalizeDeviceTotpSeedInput,
  removeDeviceTotp,
  saveDeviceTotpSeed,
  unlockDeviceTotpLogin,
} from '../../services/DeviceTotpVault';
import {
  isRetryableEnrollmentError,
  isWrongPinError,
  waitForNextTotpWindow,
} from '../../utils/deviceTotpEnrollment';

import { designColor } from '../../design/literalTokens';

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
  const userEmail = getAccountEmail();
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
  const quickReconnectStartedRef = useRef(false);
  const reauthHydratedRef = useRef(false);
  const pendingTotpEnrollmentRef = useRef(null);
  const deviceTotpEnabled =
    freshConfig?.deviceTotpEnabled === true ||
    configData?.config?.deviceTotpEnabled === true;
  const [hasSavedTotp, setHasSavedTotp] = useState(false);
  const [saveTotpOnDevice, setSaveTotpOnDevice] = useState(false);
  const [deviceTotpSeed, setDeviceTotpSeed] = useState('');
  const [devicePin, setDevicePin] = useState('');
  const [quickReconnectStatus, setQuickReconnectStatus] = useState('');
  const totpIdentity = React.useMemo(
    () => ({
      advisor: getTenantSubdomain(configData),
      broker: 'Upstox',
      userEmail,
    }),
    [configData, userEmail],
  );

  useEffect(() => {
    if (!isVisible || !deviceTotpEnabled || !userEmail) return;
    hasDeviceTotp(totpIdentity)
      .then(setHasSavedTotp)
      .catch(() => setHasSavedTotp(false));
  }, [isVisible, deviceTotpEnabled, userEmail, totpIdentity]);

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
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
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

  const isRetryableUpstoxEnrollmentError = error => {
    if (isRetryableEnrollmentError(error)) return true;
    const code = String(error?.response?.data?.error_code || '');
    return [
      'UPSTOX_TOTP_LOGIN_FAILED',
      'UDAPI100097',
      'UDAPI1242',
      'UDAPI100099',
    ].includes(code);
  };

  const verifyAndSaveQuickReconnect = async () => {
    const pending = pendingTotpEnrollmentRef.current;
    if (!pending) return false;
    const firebaseToken = await user?.getIdToken?.();
    if (!firebaseToken) {
      throw new Error('Please sign in again before enabling quick reconnect.');
    }

    const verifyFreshCode = () =>
      axios.post(
        `${server.server.baseUrl}api/upstox/device-totp-reconnect`,
        {
          totp: generateDeviceTotpFromSeed(pending.seed),
          pin: pending.pin,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${firebaseToken}`,
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

    setQuickReconnectStatus('Connected. Waiting for a fresh TOTP code…');
    await waitForNextTotpWindow();
    try {
      await verifyFreshCode();
    } catch (error) {
      if (!isRetryableUpstoxEnrollmentError(error)) throw error;
      setQuickReconnectStatus('Retrying with the next fresh TOTP code…');
      await waitForNextTotpWindow();
      await verifyFreshCode();
    }

    setQuickReconnectStatus('Protecting quick reconnect on this phone…');
    // Upstox has just accepted a code generated from this seed, which is the
    // real proof the seed is correct. Pass no typed code: the vault generates
    // its own from the seed for its format check.
    await saveDeviceTotpSeed(totpIdentity, pending.seed, '', {pin: pending.pin});
    pendingTotpEnrollmentRef.current = null;
    setHasSavedTotp(true);
    return true;
  };

  const updateSecretKey = (skipQuickReconnect = false) => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    // Validate redirect URL before proceeding
    if (!brokerConnectRedirectURL) {
      showAlert('error', 'Configuration Error', 'Broker redirect URL is not configured. Please contact support.');
      return;
    }

    if (
      !skipQuickReconnect &&
      deviceTotpEnabled &&
      saveTotpOnDevice &&
      !hasSavedTotp
    ) {
      const normalizedSeed = normalizeDeviceTotpSeedInput(deviceTotpSeed);
      try {
        generateDeviceTotpFromSeed(normalizedSeed);
      } catch (_) {
        showAlert(
          'error',
          'Check the Upstox TOTP secret',
          'This is not a valid Base32 TOTP setup key. Uppercase and lowercase are both accepted. Use the secret encoded in the Upstox TOTP QR (or its manual setup key), not your Upstox API Secret; Base32 uses letters A–Z and digits 2–7.',
        );
        return;
      }
      pendingTotpEnrollmentRef.current = {
        seed: normalizedSeed,
        pin: devicePin,
      };
    } else {
      pendingTotpEnrollmentRef.current = null;
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
        'X-Advisor-Subdomain': getTenantSubdomain(configData),
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
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data: JSON.stringify(brokerData),
      };

      axios
        .request(config)
        .then(async response => {
          console.log('[Upstox] Broker connection saved successfully');
          let quickReconnectSaved = false;
          if (pendingTotpEnrollmentRef.current) {
            try {
              quickReconnectSaved = await verifyAndSaveQuickReconnect();
            } catch (vaultError) {
              console.warn('[Upstox] quick reconnect enrolment failed:', vaultError?.message);
              pendingTotpEnrollmentRef.current = null;
              showAlert(
                'error',
                isWrongPinError(vaultError)
                  ? 'Upstox connected; PIN not accepted for quick reconnect'
                  : 'Upstox connected; quick reconnect needs setup again',
                vaultError?.response?.data?.message ||
                  vaultError?.message ||
                  'The normal Upstox connection is active, but Upstox did not accept the generated TOTP/PIN. Re-open the connection and enable quick reconnect again.',
              );
            }
          }
          setQuickReconnectStatus('');
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
                'X-Advisor-Subdomain': getTenantSubdomain(configData),
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
              if (!result?.migrationWillShow && !(saveTotpOnDevice && !quickReconnectSaved)) {
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
      quickReconnectStartedRef.current = false;
      reauthHydratedRef.current = false;
      setQuickReconnectStatus('');
      sheet.current?.present();
    } else {
      pendingTotpEnrollmentRef.current = null;
      setQuickReconnectStatus('');
      sheet.current?.dismiss();
    }
  }, [isVisible]);

  const continueWithBrokerLogin = () => {
    if (!reauthConfig?.authUrl || !reauthConfig?.apiKey || !reauthConfig?.secretKey) return;
    setApiKey(reauthConfig.apiKey);
    setSecretKey(reauthConfig.secretKey);
    setAuthUrl(reauthConfig.authUrl);
    setShowWebView(true);
  };

  const reconnectWithDeviceTotp = async () => {
    try {
      setIsLoading(true);
      const login = await unlockDeviceTotpLogin(totpIdentity);
      if (!login?.totp || !login?.pin) {
        throw new Error('The protected Upstox login is incomplete.');
      }
      const firebaseToken = await user?.getIdToken?.();
      if (!firebaseToken) throw new Error('Please sign in again before reconnecting.');
      await axios.post(
        `${server.server.baseUrl}api/upstox/device-totp-reconnect`,
        {totp: login.totp, pin: login.pin},
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${firebaseToken}`,
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      onClose?.();
      setShowBrokerModal?.(false);
      const result = await fetchBrokerStatusModal?.();
      eventEmitter.emit('refreshEvent', {source: 'Upstox device TOTP reconnect'});
      if (!result?.migrationWillShow) {
        showAlert('success', 'Upstox reconnected', 'Your protected login was unlocked on this phone.');
      }
      return true;
    } catch (error) {
      showAlert(
        'error',
        'Quick reconnect unavailable',
        error?.response?.data?.message || error?.message || 'Continue with Upstox login.',
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Smart re-auth prefers the protected TOTP route when this advisor enables
  // it. Cancelling biometrics or any broker rejection falls back to the normal
  // OAuth WebView; the feature never removes broker-controlled login.
  useEffect(() => {
    if (!isVisible || !reauthConfig || reauthHydratedRef.current) return;
    reauthHydratedRef.current = true;
    (async () => {
      const saved = deviceTotpEnabled
        ? await hasDeviceTotp(totpIdentity).catch(() => false)
        : false;
      setHasSavedTotp(saved);
      if (saved && !quickReconnectStartedRef.current) {
        quickReconnectStartedRef.current = true;
        if (await reconnectWithDeviceTotp()) return;
      }
      if (
        reauthConfig.authUrl &&
        reauthConfig.apiKey &&
        reauthConfig.secretKey
      ) {
        continueWithBrokerLogin();
      }
    })();
    // Deliberately once per reauth payload. Broker/vault failures fall back
    // to OAuth and must not trigger another biometric prompt in this open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, reauthConfig]);

  const forgetSavedTotp = async () => {
    await removeDeviceTotp(totpIdentity);
    setHasSavedTotp(false);
    setSaveTotpOnDevice(false);
  };

  const handleWebViewClose = () => {
    setShowWebView(false);
  };

  // OAuth phase keeps the existing UpstoxConnectUI WebView flow untouched;
  // credential phase renders the shared web-parity stepper (mirrors web
  // connectBroker.js Upstox config: guide steps, redirect copy row, egress
  // static-IP gating). NEVER React Native <Modal> here (Android freeze).
  if (showWebView) {
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
  }

  return (
    <BrokerConnectStepperSheet
      isVisible={!!isVisible}
      onClose={onClose}
      broker="Upstox"
      config={{
        monogram: 'U',
        brandFrom: designColor('8b54ff'),
        brandTo: designColor('5b21d6'),
        portalUrl: 'https://account.upstox.com/developer/apps',
        portalLabel: 'Open Upstox developer portal',
        redirectUrl: brokerConnectRedirectURL,
        walkthroughVideoId: 'qYgpZTYYdyk',
        guideSteps: [
          'Log in with your <b>mobile number</b> and OTP, then your <b>PIN</b>',
          'Go to <b>Apps → My Apps</b> and click <b>New App</b>',
          `Name the app <b>${Config.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark'}</b> (keep to 2 apps max)`,
          'Set the <b>Redirect URL</b> shown below',
          'Paste your <b>IP</b> into <b>Allowed IPs</b>, accept T&C, Continue',
          'Open the new app and copy the <b>API key</b> and <b>Secret key</b>',
        ],
      }}
      egressBrokerKey="upstox"
      customerId={userId}
      customerEmail={userEmail}
      egressReady={egressReady}
      setEgressReady={setEgressReady}
      unmetAck={unmetAck}
      setUnmetAck={setUnmetAck}
      fields={[
        {
          label: 'API Key',
          value: apiKey,
          onChange: (t) => setApiKey(t.trim()),
          password: true,
          placeholder: 'Paste your Upstox API key',
        },
        {
          label: 'Secret Key',
          value: secretKey,
          onChange: (t) => setSecretKey(t.trim()),
          password: true,
          placeholder: 'Paste your Upstox secret key',
        },
        ...(deviceTotpEnabled && saveTotpOnDevice && !hasSavedTotp ? [
          {
            label: 'TOTP Secret Key (Base32)',
            value: deviceTotpSeed,
            // Preserve exactly what the customer typed/pasted. Base32 is
            // case-insensitive; canonicalisation belongs at submit/storage,
            // not in the visible input where it looks like data corruption.
            onChange: t => setDeviceTotpSeed(String(t || '')),
            password: true,
            autoCapitalize: 'none',
            placeholder: 'Secret shown below the authenticator QR',
          },
          {
            label: 'Upstox PIN',
            value: devicePin,
            onChange: t => setDevicePin(t.replace(/\D/g, '').slice(0, 6)),
            password: true,
            keyboardType: 'number-pad',
            maxLength: 6,
            placeholder: 'Your 6-digit Upstox PIN',
          },
        ] : []),
      ]}
      deviceTotp={{
        enabled: deviceTotpEnabled,
        placeBeforeFields: true,
        hasSaved: hasSavedTotp,
        saveOnDevice: saveTotpOnDevice,
        onToggleSave: () => setSaveTotpOnDevice(value => !value),
        onUnlock: reauthConfig ? reconnectWithDeviceTotp : undefined,
        onForget: forgetSavedTotp,
        protectLabel: 'Enable quick reconnect on this phone',
        savedLabel:
          'The TOTP key and PIN are protected on this phone. Normal Upstox login remains available.',
        pendingLabel:
          'Stores the TOTP key and PIN in this phone’s protected keychain. The TOTP key is never copied to AlphaQuark servers.',
        setup: {
          title: 'Enable Upstox TOTP and copy its setup key',
          portalUrl:
            'https://upstox.com/help-center/what-is-totp-and-how-to-enable-totp-for-my-upstox-account-260343/',
          portalLabel: 'Open Upstox TOTP instructions',
          steps: [
            'In the Upstox app, open <b>Upstox icon → My account → Profile → Time-based OTP (TOTP) → Enable TOTP</b>.',
            'Enter the six-digit OTP sent to your registered mobile number.',
            'When the QR appears, use the <b>Base32 secret encoded in that TOTP QR</b> (or the manual setup key if Upstox shows one) below, and scan the same QR in your authenticator app. Do not paste the separate developer API Secret.',
            'Enter the newest <b>six-digit authenticator code</b> in Upstox to finish enabling TOTP. AlphaQuark will generate its verification code from the setup key automatically.',
          ],
          note:
            'The Base32 setup key is fixed. The six-digit TOTP changes every 30 seconds; the app generates and verifies a fresh code after OAuth before saving quick reconnect.',
        },
        unlockLabel: 'Reconnect with biometric unlock',
        forgetLabel: 'Forget Upstox quick reconnect on this phone',
      }}
      phase="creds"
      canSubmit={
        Boolean(apiKey) &&
        Boolean(secretKey) &&
        (!saveTotpOnDevice || hasSavedTotp ||
          (Boolean(deviceTotpSeed) && devicePin.length === 6))
      }
      submitLabel={
        quickReconnectStatus ||
        (saveTotpOnDevice && !hasSavedTotp
          ? 'Continue to Upstox login'
          : 'Connect Upstox')
      }
      loading={isLoading}
      onSubmit={() => updateSecretKey(false)}
      alternateAction={
        saveTotpOnDevice && !hasSavedTotp
          ? {
              label: 'Continue with normal Upstox login',
              onPress: () => {
                pendingTotpEnrollmentRef.current = null;
                updateSecretKey(true);
              },
            }
          : undefined
      }
    />
  );
};
export default UpstoxModal;
