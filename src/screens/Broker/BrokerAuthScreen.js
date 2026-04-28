/**
 * BrokerAuthScreen — Generic OAuth WebView handler for all brokers.
 * Replaces broker-specific OAuth modals (Zerodha, Angel One, Groww, Dhan, AliceBlue, Axis).
 *
 * Route params:
 *   brokerConfig: BrokerConfig from brokerRegistry
 *   onSuccess: () => void (callback after connection)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import {
  generateState,
  registerCallback,
  getBrokerCallbackUrl,
} from '../../utils/brokerAuth';
import { getApiBrokerName } from '../../config/brokerRegistry';
import useModalStore from '../../GlobalUIModals/modalStore';
import CryptoJS from 'react-native-crypto-js';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getAdvisorSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

const encrypt = (val) => CryptoJS.AES.encrypt(val, 'ApiKeySecret').toString();

const BrokerAuthScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { brokerConfig, onSuccess } = route.params || {};

  const auth = getAuth();
  const userEmail = auth.currentUser?.email;
  const showAlert = useModalStore((state) => state.showAlert);

  const [state, setState] = useState('loading'); // loading, webview, success, error
  const [loginUrl, setLoginUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const hasConnected = useRef(false);

  const brokerName = brokerConfig?.name;
  const brokerKey = brokerConfig?.key;
  const apiBrokerName = getApiBrokerName(brokerConfig);

  // ---------------------------------------------------------------------------
  // Get user ID from backend
  // ---------------------------------------------------------------------------
  const getUserId = useCallback(async () => {
    if (!userEmail) return null;
    try {
      const resp = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${encodeURIComponent(userEmail)}`,
        { headers: getHeaders(), timeout: 10000 },
      );
      return resp.data?.data?._id || resp.data?._id;
    } catch { return null; }
  }, [userEmail]);

  // ---------------------------------------------------------------------------
  // Generate login URL per broker
  // ---------------------------------------------------------------------------
  const getLoginUrl = useCallback(async () => {
    try {
      const callbackUrl = getBrokerCallbackUrl();

      switch (brokerKey) {
        case 'zerodha': {
          const resp = await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/login-url`,
            { apiKey: Config.REACT_APP_ZERODHA_API_KEY, site: getAdvisorSubdomain() },
            { headers: getHeaders(), timeout: 10000 },
          );
          return resp.data?.data?.loginUrl || resp.data?.loginUrl ||
                 resp.data?.response?.loginUrl || resp.data?.data?.response?.loginUrl;
        }

        case 'angelone': {
          const nonce = await registerCallback('angelone', '/stock-recommendation');
          const apiKey = Config.REACT_APP_ANGEL_ONE_API_KEY;
          return `https://smartapi.angelbroking.com/publisher-login?api_key=${apiKey}&state=${nonce}`;
        }

        case 'groww': {
          const resp = await axios.get(
            `${server.ccxtServer.baseUrl}groww/login/oauth?redirectUri=${encodeURIComponent(callbackUrl)}`,
            { headers: getHeaders(), timeout: 10000, maxRedirects: 0, validateStatus: (s) => s < 400 },
          );
          return resp.data?.loginUrl || resp.data?.redirectUrl || resp.headers?.location;
        }

        case 'dhan': {
          return `${server.ccxtServer.baseUrl}dhan/login?origin=${encodeURIComponent(
            getAdvisorSubdomain()
          )}&returnPath=/stock-recommendation`;
        }

        case 'aliceblue': {
          await registerCallback('aliceblue', '/stock-recommendation');
          return 'https://ant.aliceblueonline.com/?appcode=7WMf5NotZe';
        }

        case 'axis': {
          const resp = await axios.post(
            `${server.ccxtServer.baseUrl}axis/login-url`,
            { redirectUrl: callbackUrl },
            { headers: getHeaders(), timeout: 10000 },
          );
          return resp.data?.data?.redirectURL;
        }

        default:
          throw new Error(`No OAuth flow for ${brokerName}`);
      }
    } catch (e) {
      throw new Error(`Failed to get login URL: ${e.message}`);
    }
  }, [brokerKey, brokerName]);

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const url = await getLoginUrl();
        if (url) {
          setLoginUrl(url);
          setState('webview');
        } else {
          throw new Error('Login URL is empty');
        }
      } catch (e) {
        setErrorMsg(e.message);
        setState('error');
      }
    })();
  }, [getLoginUrl]);

  // ---------------------------------------------------------------------------
  // Detect callback URL
  // ---------------------------------------------------------------------------
  const isCallbackUrl = (url) => {
    const patterns = [
      'broker-callback', 'request_token', 'auth_token', 'auth_code',
      'access_token', 'status=success', 'user_broker=',
      'dhan_client_id', 'stock-recommendation', 'zerodha/callback',
      'motilal-oswal/callback', 'icici/auth-callback',
      'api/deploy/broker/callback', 'ssoId', 'spSsoId',
    ];
    return patterns.some((p) => url.includes(p));
  };

  // ---------------------------------------------------------------------------
  // Handle callback — extract tokens and save connection
  // ---------------------------------------------------------------------------
  const handleCallback = useCallback(async (url) => {
    if (hasConnected.current) return;
    hasConnected.current = true;
    setState('loading');

    try {
      const params = {};
      const queryString = url.includes('?') ? url.split('?')[1] : '';
      queryString.split('&').forEach((pair) => {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });

      const userId = await getUserId();
      if (!userId) throw new Error('User not found');

      let saveBody = { uid: userId, user_broker: apiBrokerName };

      switch (brokerKey) {
        case 'zerodha': {
          const requestToken = params.request_token || params.auth_code || params.code;
          if (!requestToken) throw new Error('No request token received');
          // Exchange for access token
          const resp = await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/gen-access-token`,
            { user_email: userEmail, apiKey: Config.REACT_APP_ZERODHA_API_KEY, requestToken },
            { headers: getHeaders(), timeout: 15000 },
          );
          saveBody.jwtToken = resp.data?.data?.accessToken || resp.data?.accessToken;
          break;
        }

        case 'angelone': {
          const authToken = params.auth_token || params.jwtToken || params.token;
          if (!authToken) throw new Error('No auth token received');
          saveBody.jwtToken = authToken;
          saveBody.apiKey = Config.REACT_APP_ANGEL_ONE_API_KEY;
          break;
        }

        case 'groww': {
          const token = params.access_token || params.jwtToken;
          if (!token) throw new Error('No access token received');
          saveBody.jwtToken = token;
          break;
        }

        case 'dhan': {
          const clientId = params.dhan_client_id;
          const token = params.dhan_access_token || params.access_token;
          if (!clientId || !token) throw new Error('Dhan credentials missing');
          saveBody.clientCode = clientId;
          saveBody.jwtToken = token;
          break;
        }

        case 'aliceblue': {
          const clientId = params.client_id || params.clientId;
          const token = params.access_token;
          if (!token) throw new Error('AliceBlue token missing');
          saveBody.clientCode = clientId;
          saveBody.jwtToken = token;
          break;
        }

        case 'axis': {
          const ssoId = params.ssoId || params.spSsoId;
          if (!ssoId) throw new Error('Axis SSO ID missing');
          // Exchange SSO for tokens
          const resp = await axios.post(
            `${server.ccxtServer.baseUrl}axis/callback`,
            { ssoId },
            { headers: getHeaders(), timeout: 15000 },
          );
          const data = resp.data?.data || resp.data;
          saveBody.jwtToken = data?.authTokenAxis;
          saveBody.secretKey = data?.refreshTokenAxis;
          if (data?.accounts?.[0]?.subAccountId) {
            saveBody.clientCode = data.accounts[0].subAccountId;
          }
          break;
        }

        default:
          throw new Error(`Unhandled callback for ${brokerName}`);
      }

      // Save broker connection
      await axios.put(
        `${server.server.baseUrl}api/user/connect-broker`,
        saveBody,
        { headers: getHeaders(), timeout: 15000 },
      );

      // Switch model portfolio to new broker (non-critical)
      axios.post(
        `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
        { user_email: userEmail, user_broker: apiBrokerName },
        { headers: getHeaders(), timeout: 10000 },
      ).catch(() => {});

      showAlert('success', 'Connected', `${brokerName} connected successfully.`);
      if (onSuccess) onSuccess();
      navigation.goBack();
    } catch (e) {
      console.error(`[BrokerAuth:${brokerKey}] callback error:`, e.message);
      setErrorMsg(e.message);
      setState('error');
      hasConnected.current = false;
    }
  }, [brokerKey, brokerName, apiBrokerName, getUserId, userEmail, onSuccess, navigation, showAlert]);

  // ---------------------------------------------------------------------------
  // WebView navigation handler
  // ---------------------------------------------------------------------------
  const onNavStateChange = useCallback((navState) => {
    const { url } = navState;
    if (url && isCallbackUrl(url)) {
      handleCallback(url);
    }
  }, [handleCallback]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (state === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1A237E" />
        <Text style={styles.loadingText}>Connecting to {brokerName}...</Text>
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Connection Failed</Text>
        <Text style={styles.errorMsg}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => {
          hasConnected.current = false;
          setState('loading');
          getLoginUrl().then((url) => { setLoginUrl(url); setState('webview'); })
            .catch((e) => { setErrorMsg(e.message); setState('error'); });
        }}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // WebView state
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connect {brokerName}</Text>
        <View style={{ width: 40 }} />
      </View>
      <WebView
        source={{ uri: loginUrl }}
        onNavigationStateChange={onNavStateChange}
        onShouldStartLoadWithRequest={(request) => {
          if (isCallbackUrl(request.url)) {
            handleCallback(request.url);
            return false; // prevent WebView from loading callback URL
          }
          return true;
        }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator style={styles.webviewLoading} size="large" color="#1A237E" />
        )}
        style={styles.webview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F8F9FC' },
  loadingText: { marginTop: 12, color: '#666', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12,
    backgroundColor: '#1A237E',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },

  webview: { flex: 1 },
  webviewLoading: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 },

  errorIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF5350',
    color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center', lineHeight: 56,
    marginBottom: 16,
  },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
  errorMsg: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryBtn: {
    paddingVertical: 12, paddingHorizontal: 32, backgroundColor: '#1A237E',
    borderRadius: 12, marginBottom: 12,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  goBackBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  goBackBtnText: { color: '#1A237E', fontSize: 14, fontWeight: '600' },
});

export default BrokerAuthScreen;
