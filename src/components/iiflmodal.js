/**
 * Customer-owned IIFL direct OAuth connection flow.
 *
 * The app collects the customer's IIFL App Key/App Secret, stores only the
 * encrypted values through the Node API, and completes OAuth in an in-app
 * WebView. The App Secret never comes back to JavaScript during callback
 * exchange. See docs/BROKER_CONNECTION.md, "IIFL Securities — direct flow".
 */

import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'react-native-crypto-js';
import {ChevronLeft, XIcon} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import axios from 'axios';
import Config from 'react-native-config';
import Toast from 'react-native-toast-message';

import BrokerConnectStepperSheet from './BrokerConnectionModal/BrokerConnectStepperSheet';
import {getBrokerGuideConfig} from './BrokerConnectionModal/brokerGuideConfigs';
import CrossPlatformOverlay from './CrossPlatformOverlay';
import {useConfig} from '../context/ConfigContext';
import {useTrade} from '../screens/TradeContext';
import {getAccountEmail} from '../utils/accountEmail';
import {parseIiflCallbackUrl} from '../utils/iiflDirectFlow';
import {generateToken} from '../utils/SecurityTokenManager';
import server from '../utils/serverConfig';
import {getTenantSubdomain} from '../utils/variantHelper';

import { designColor } from '../design/literalTokens';

const {height: screenHeight} = Dimensions.get('window');
const BROKER = 'IIFL Securities';

const IIFLModal = ({
  isVisible,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
  reauthConfig,
}) => {
  const {configData} = useTrade();
  const runtimeConfig = useConfig();
  const insets = useSafeAreaInsets();
  const userEmail = getAccountEmail();

  const [userId, setUserId] = useState(null);
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [showWebView, setShowWebView] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [egressReady, setEgressReady] = useState(false);
  const [unmetAck, setUnmetAck] = useState(false);
  const exchangeStartedRef = useRef(false);
  const savedReauthStartedRef = useRef(false);

  const redirectUrl =
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    '';
  const accent =
    runtimeConfig?.mainColor ||
    runtimeConfig?.gradient2 ||
    runtimeConfig?.buttonColor ||
    designColor('0056b7');

  const buildHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  });

  const guideConfig = getBrokerGuideConfig(BROKER, {
    whiteLabelText:
      configData?.config?.REACT_APP_WHITE_LABEL_TEXT ||
      Config.REACT_APP_WHITE_LABEL_TEXT ||
      'AlphaQuark',
    brokerConnectRedirectURL: redirectUrl,
  });

  const openAuthUrl = url => {
    if (!url) return false;
    exchangeStartedRef.current = false;
    setAuthUrl(url);
    setShowWebView(true);
    setError('');
    return true;
  };

  const startSavedReauth = async uid => {
    if (!uid || !redirectUrl || savedReauthStartedRef.current) return false;
    savedReauthStartedRef.current = true;
    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/iifl/reauth-url`,
        {uid, redirectUrl},
        {headers: buildHeaders()},
      );
      return openAuthUrl(response.data?.url);
    } catch (reauthError) {
      savedReauthStartedRef.current = false;
      console.warn(
        '[IIFL] Saved-credential re-auth unavailable:',
        reauthError?.response?.data?.message || reauthError?.message,
      );
      return false;
    }
  };

  useEffect(() => {
    if (!isVisible) {
      setShowWebView(false);
      setAuthUrl('');
      setError('');
      setLoading(false);
      setEgressReady(false);
      setUnmetAck(false);
      exchangeStartedRef.current = false;
      savedReauthStartedRef.current = false;
      return;
    }

    let cancelled = false;
    const loadAccount = async () => {
      if (!userEmail) {
        setError('Unable to identify the signed-in AlphaQuark account.');
        return;
      }
      setLoading(true);
      try {
        const response = await axios.get(
          `${server.server.baseUrl}api/user/getUser/${userEmail}`,
          {headers: buildHeaders()},
        );
        if (cancelled) return;

        const account = response.data?.User;
        const uid = account?._id;
        if (!uid) {
          setError('Unable to load your AlphaQuark account. Please try again.');
          return;
        }
        setUserId(uid);

        if (reauthConfig?.authUrl) {
          openAuthUrl(reauthConfig.authUrl);
          return;
        }

        // Mid-trade and token-expiry entry points do not always carry a
        // reauthConfig. If the direct credentials already exist, reuse the
        // saved App Key through Node and go straight to the daily browser
        // login. A first-time customer has no slot and remains on the form.
        const slot = (account.connected_brokers || []).find(
          item => item?.broker === BROKER,
        );
        if (slot?.apiKey && slot?.secretKey) {
          await startSavedReauth(uid);
        }
      } catch (accountError) {
        if (!cancelled) {
          setError(
            accountError?.response?.data?.message ||
              'Unable to load your account. Please check your connection.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAccount();
    return () => {
      cancelled = true;
    };
    // Opening the sheet is the lifecycle boundary. Runtime config changes
    // while it is already visible must not restart the OAuth WebView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, userEmail]);

  const encryptCredential = value =>
    CryptoJS.AES.encrypt(String(value || '').trim(), 'ApiKeySecret').toString();

  const startFirstConnection = async () => {
    if (!egressReady) {
      setUnmetAck(true);
      return;
    }
    if (!userId || !redirectUrl) {
      setError(
        !redirectUrl
          ? 'Broker redirect URL is not configured. Please contact support.'
          : 'Your account is still loading. Please try again.',
      );
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/iifl/update-key`,
        {
          uid: userId,
          apiKey: encryptCredential(appKey),
          secretKey: encryptCredential(appSecret),
          redirect_uri: redirectUrl,
        },
        {headers: buildHeaders()},
      );
      if (!openAuthUrl(response.data?.response)) {
        throw new Error('IIFL did not return a login URL.');
      }
    } catch (connectError) {
      setError(
        connectError?.response?.data?.message ||
          connectError?.message ||
          'Unable to start IIFL login. Please verify your App Key and App Secret.',
      );
    } finally {
      setLoading(false);
    }
  };

  const finishConnection = async (authCode, clientCode) => {
    if (!authCode || !clientCode || !userId || exchangeStartedRef.current) {
      return;
    }
    exchangeStartedRef.current = true;
    setLoading(true);
    setError('');

    try {
      const exchange = await axios.post(
        `${server.server.baseUrl}api/iifl/exchange`,
        {uid: userId, clientCode, authCode},
        {headers: buildHeaders()},
      );
      const accessToken = exchange.data?.accessToken;
      if (!accessToken) {
        throw new Error('IIFL did not issue a session. Please login again.');
      }

      await axios.put(
        `${server.server.baseUrl}api/user/connect-broker`,
        {
          uid: userId,
          user_broker: BROKER,
          clientCode,
          jwtToken: accessToken,
        },
        {headers: buildHeaders()},
      );

      await AsyncStorage.multiSet([
        ['iiflAccessToken', accessToken],
        ['iiflClientCode', clientCode],
      ]);

      // Model-portfolio broker attribution is best-effort and must not turn a
      // successfully persisted broker connection into a false failure.
      axios
        .post(
          `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
          {user_email: userEmail, user_broker: BROKER},
          {headers: buildHeaders()},
        )
        .catch(modelError =>
          console.warn(
            '[IIFL] Model portfolio broker update failed:',
            modelError?.message,
          ),
        );

      try {
        await fetchBrokerStatusModal?.();
      } catch (refreshError) {
        console.warn(
          '[IIFL] Connection saved but status refresh failed:',
          refreshError?.message,
        );
      }

      Toast.show({
        type: 'success',
        text1: 'Successfully connected to IIFL Securities',
        text2: 'A fresh IIFL browser login is required each trading day.',
        visibilityTime: 4000,
      });
      setShowBrokerModal?.(false);
      onClose?.();
    } catch (exchangeError) {
      exchangeStartedRef.current = false;
      const message =
        exchangeError?.response?.data?.message ||
        exchangeError?.response?.data?.error ||
        exchangeError?.message ||
        'Unable to complete IIFL login.';
      setError(message);
      Toast.show({type: 'error', text1: 'IIFL connection failed', text2: message});
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = url => {
    // Ignore similarly shaped query strings from pages inside the broker
    // login journey. Only our registered callback may complete the exchange.
    if (redirectUrl && !String(url || '').startsWith(redirectUrl)) return false;
    const {authCode, clientCode} = parseIiflCallbackUrl(url);
    if (!authCode || !clientCode) return false;
    finishConnection(authCode, clientCode);
    return true;
  };

  const handleClose = () => {
    setShowWebView(false);
    setAuthUrl('');
    onClose?.();
  };

  if (!showWebView) {
    return (
      <BrokerConnectStepperSheet
        isVisible={isVisible}
        onClose={handleClose}
        broker={BROKER}
        config={guideConfig}
        egressBrokerKey="iifl"
        customerId={userId}
        customerEmail={userEmail || ''}
        fields={[
          {
            label: 'App Key',
            value: appKey,
            onChange: value => setAppKey(value.trim()),
            password: true,
            placeholder: 'Paste your IIFL App Key',
          },
          {
            label: 'App Secret',
            value: appSecret,
            onChange: value => setAppSecret(value.trim()),
            password: true,
            placeholder: 'Paste your IIFL App Secret',
          },
        ]}
        error={error}
        canSubmit={Boolean(appKey && appSecret && userId && redirectUrl)}
        submitLabel="Connect IIFL Securities"
        onSubmit={startFirstConnection}
        loading={loading}
        egressReady={egressReady}
        setEgressReady={setEgressReady}
        unmetAck={unmetAck}
        setUnmetAck={setUnmetAck}
      />
    );
  }

  return (
    <CrossPlatformOverlay visible={isVisible} onClose={handleClose}>
      <View style={[styles.fullScreen, {paddingTop: insets.top}]}>
        <View style={[styles.header, {backgroundColor: accent}]}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.headerAction}
            accessibilityLabel="Back">
            <ChevronLeft size={24} color={designColor('fff')} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>SECURE BROKER LOGIN</Text>
            <Text style={styles.headerTitle}>IIFL Securities</Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.headerAction}
            accessibilityLabel="Close">
            <XIcon size={21} color={designColor('fff')} />
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.errorBanner}>{error}</Text>}
        <WebView
          source={{uri: authUrl}}
          style={styles.webView}
          onShouldStartLoadWithRequest={request => !handleNavigation(request.url)}
          onNavigationStateChange={navigation => handleNavigation(navigation.url)}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={accent} />
              <Text style={styles.loadingText}>Opening IIFL secure login…</Text>
            </View>
          )}
        />
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={styles.loadingText}>Saving your IIFL connection…</Text>
          </View>
        )}
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  fullScreen: {flex: 1, backgroundColor: designColor('f8fafc')},
  header: {
    minHeight: 72,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
  },
  headerAction: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {flex: 1, marginHorizontal: 4},
  headerEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  headerTitle: {color: designColor('fff'), fontSize: 17, fontWeight: '800', marginTop: 2},
  webView: {flex: 1, minHeight: screenHeight * 0.75},
  errorBanner: {
    backgroundColor: designColor('fee2e2'),
    color: designColor('991b1b'),
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  loadingText: {marginTop: 10, color: designColor('334155'), fontSize: 13, fontWeight: '600'},
});

export default IIFLModal;
