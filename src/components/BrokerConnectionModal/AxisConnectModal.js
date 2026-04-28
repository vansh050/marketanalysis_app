/**
 * AxisConnectModal.js
 * Axis Securities SSO broker connection.
 * Ported from prod-alphaquark-github for feature parity.
 */
import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import {X, Shield, ExternalLink} from 'lucide-react-native';
import {WebView} from 'react-native-webview';
import axios from 'axios';
import Config from 'react-native-config';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import Toast from 'react-native-toast-message';
import eventEmitter from '../EventEmitter';
import {useTrade} from '../../screens/TradeContext';
import CrossPlatformOverlay from '../CrossPlatformOverlay';

const AxisConnectModal = ({
  isVisible,
  onClose,
  fetchBrokerStatusModal,
}) => {
  const {configData} = useTrade();
  const auth = getAuth();
  const userEmail = auth.currentUser?.email;
  const [userDetails, setUserDetails] = useState(null);
  const userId = userDetails?._id;
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const hasProcessedCallback = useRef(false);

  React.useEffect(() => {
    if (!userEmail) return;
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain':
            configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      })
      .then(res => setUserDetails(res.data.User))
      .catch(err => console.log('[Axis] getUser error:', err?.message));
  }, [userEmail, configData?.config?.REACT_APP_HEADER_NAME]);

  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain':
      configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };

  // Must be the per-advisor URL registered with Axis SSO (same URL
  // web uses — Axis's `ssoId` callback lands there). No `.env`
  // fallback: the bundled `app-links.alphaquark.in/broker-callback`
  // default is NOT registered in any advisor's Axis SSO config, so
  // sending it silently fails. Empty → `handleAxisLogin` shows the
  // "Failed to get login URL from Axis Securities" toast instead of
  // hitting Axis with a bad redirectUrl.
  const brokerConnectRedirectURL =
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL || '';

  const handleAxisLogin = async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}axis/login-url`,
        {redirectUrl: brokerConnectRedirectURL},
        {headers: requestHeaders},
      );

      const url = response.data?.data?.redirectURL;
      if (url) {
        setLoginUrl(url);
        setShowWebView(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to get login URL from Axis Securities',
          visibilityTime: 5000,
        });
      }
    } catch (error) {
      console.error('Axis login-url error:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to initiate Axis login. Please try again.',
        visibilityTime: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Parse the ssoId out of a callback URL without relying on React
  // Native's partial `URL` implementation (no polyfill is installed,
  // and `searchParams` can be undefined on intermediate navigations).
  // Matches the defensive string-parse pattern used by Upstox/Zerodha
  // in this app.
  const extractSsoId = url => {
    if (!url || (!url.includes('ssoId=') && !url.includes('spSsoId='))) {
      return null;
    }
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return null;
    const pairs = url.slice(qIndex + 1).split('&');
    const params = {};
    for (const pair of pairs) {
      const [k, v = ''] = pair.split('=');
      try {
        params[decodeURIComponent(k)] = decodeURIComponent(v);
      } catch {
        params[k] = v;
      }
    }
    return params.ssoId || params.spSsoId || null;
  };

  // Fires BEFORE the WebView loads a URL. Returning false here
  // prevents the redirect page (app-links.alphaquark.in/broker-callback)
  // from actually loading — we snatch the ssoId and close the WebView
  // instead of showing a blank landing page to the user.
  const handleShouldStartLoad = request => {
    const url = request?.url || '';
    if (hasProcessedCallback.current) return false;
    const ssoId = extractSsoId(url);
    if (ssoId) {
      processAxisCallback(ssoId);
      return false;
    }
    return true;
  };

  const handleWebViewNavigation = navState => {
    const {url} = navState;
    if (!url || hasProcessedCallback.current) return;
    const ssoId = extractSsoId(url);
    if (ssoId) {
      processAxisCallback(ssoId);
    }
  };

  const processAxisCallback = async ssoId => {
    if (hasProcessedCallback.current) return;
    hasProcessedCallback.current = true;
    setShowWebView(false);
    setLoading(true);
    try {
      // Exchange SSO ID for tokens (parsing matches web
      // StockRecommendation.js:1716-1728 — response is `{ data: { ... } }`
      // and `authToken` / `refreshToken` may each be a raw string or
      // `{ token: string }`).
      const callbackResponse = await axios.post(
        `${server.ccxtServer.baseUrl}axis/callback`,
        {ssoId},
        {headers: requestHeaders},
      );

      // Accept both wrapped (`{data: {...}}`) and flat responses —
      // Axis returns slightly different shapes on initial auth vs
      // re-auth, and ccxt-india's `jsonify(result)` forwards whatever
      // Axis gave it without rewrapping.
      const data = callbackResponse.data?.data || callbackResponse.data;
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from Axis Securities');
      }
      const authToken = data.authToken?.token || data.authToken || data.token;
      const refreshToken = data.refreshToken?.token || data.refreshToken || '';
      // Re-auth path for returning users: Axis sometimes omits the
      // accounts[] array entirely because the subAccountId is
      // invariant across re-auths. Fall back to (a) top-level
      // subAccountId / clientCode / clientId on the response, then
      // (b) the stored clientCode from the user's existing
      // connected_brokers[broker='Axis Securities'] slot — that was
      // the subAccountId used during the initial auth and is the
      // same value Axis would return again. Matches the fallback
      // pattern icicimodal.js uses for ICICI's analogous case.
      const existingAxisCode = Array.isArray(userDetails?.connected_brokers)
        ? userDetails.connected_brokers.find(b => b.broker === 'Axis Securities')
            ?.clientCode
        : null;
      const subAccountId =
        data.accounts?.[0]?.subAccountId ||
        data.metadata?.accounts?.[0]?.subAccountId ||
        data.subAccountId ||
        data.clientCode ||
        data.clientId ||
        existingAxisCode;

      if (!authToken) {
        throw new Error(
          'Missing auth token from Axis SSO response — please retry',
        );
      }
      if (!subAccountId) {
        throw new Error(
          'Missing subAccountId from Axis SSO response and no prior Axis connection on file — please contact support',
        );
      }
      console.log(
        '[Axis] callback ok — auth=yes sub=' +
          (data.accounts?.[0]?.subAccountId ? 'accounts' :
            data.metadata?.accounts?.[0]?.subAccountId ? 'metadata' :
            data.subAccountId ? 'top-level' :
            existingAxisCode ? 'existing' : 'unknown'),
      );

      // Save broker connection
      await axios.put(
        `${server.server.baseUrl}api/user/connect-broker`,
        {
          uid: userId,
          user_broker: 'Axis Securities',
          clientCode: subAccountId,
          jwtToken: authToken,
          secretKey: refreshToken,
        },
        {headers: requestHeaders},
      );

      // Update model portfolio broker (non-critical)
      try {
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
          {user_email: userEmail, user_broker: 'Axis Securities'},
          {headers: requestHeaders},
        );
      } catch (mpErr) {
        console.warn('Model portfolio broker update failed:', mpErr);
      }

      Toast.show({
        type: 'success',
        text1: 'Axis Securities connected successfully!',
        visibilityTime: 3000,
      });

      fetchBrokerStatusModal?.();
      eventEmitter.emit('refreshEvent', {source: 'Axis broker connection'});
      onClose();
    } catch (error) {
      console.error('Axis callback error:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to connect Axis Securities',
        text2: error?.response?.data?.message || error.message,
        visibilityTime: 5000,
      });
    } finally {
      setLoading(false);
      hasProcessedCallback.current = false;
    }
  };

  // Use CrossPlatformOverlay instead of <Modal>. On Android, native
  // Modal components have stacking bugs — opening one while another
  // Modal (ManageConnectionsModal) is in the process of unmounting
  // swallows the new one. CrossPlatformOverlay uses
  // absoluteFillObject + zIndex:9999 on Android (FullWindowOverlay on
  // iOS) which bypasses that issue. Matches the pattern used by
  // ZerodhaConnectUI / UpstoxConnectUI / every other broker WebView
  // in this app — only Axis was still on raw <Modal>, which is why
  // its re-auth path was invisible while every other broker worked.
  if (showWebView && loginUrl) {
    return (
      <CrossPlatformOverlay visible={isVisible}>
        <View style={styles.fullScreen}>
          <SafeAreaView style={{flex: 1}}>
            <View style={styles.webViewHeader}>
              <TouchableOpacity onPress={() => setShowWebView(false)}>
                <X size={22} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.webViewTitle}>Axis Securities Login</Text>
              <View style={{width: 22}} />
            </View>
            {/* WebView needs style={flex:1} + cookie/storage props to
                render at all. Copied from ZerodhaConnectUI. */}
            <WebView
              source={{uri: loginUrl}}
              style={{flex: 1}}
              onNavigationStateChange={handleWebViewNavigation}
              onShouldStartLoadWithRequest={handleShouldStartLoad}
              startInLoadingState
              javaScriptEnabled
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              originWhitelist={['*']}
              renderLoading={() => (
                <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                  <ActivityIndicator size="large" color="#059669" />
                </View>
              )}
            />
          </SafeAreaView>
        </View>
      </CrossPlatformOverlay>
    );
  }

  return (
    <CrossPlatformOverlay visible={isVisible}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.overlayInner}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={22} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.content}>
              <Text style={styles.title}>Login with Axis Securities</Text>
              <Text style={styles.subtitle}>
                You'll be securely redirected to Axis Direct to authorize your
                account. No credentials are shared with us.
              </Text>

              <TouchableOpacity
                style={[styles.loginBtn, loading && {opacity: 0.6}]}
                onPress={handleAxisLogin}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <ExternalLink size={18} color="#fff" />
                    <Text style={styles.loginBtnText}>Login with Axis Direct</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.securityNote}>
                <Shield size={16} color="#059669" />
                <View style={{flex: 1}}>
                  <Text style={styles.securityTitle}>Secure SSO Login</Text>
                  <Text style={styles.securityText}>
                    Your login credentials are entered directly on Axis Direct's secure page. We only receive a session token to execute trades on your behalf.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  fullScreen: {flex: 1, backgroundColor: '#fff'},
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16},
  overlayInner: {flex: 1, justifyContent: 'center'},
  modalContainer: {backgroundColor: '#fff', borderRadius: 12, maxHeight: '85%'},
  closeBtn: {position: 'absolute', top: 12, right: 12, zIndex: 1, padding: 4},
  content: {padding: 24, paddingTop: 36, alignItems: 'center'},
  title: {fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center'},
  subtitle: {fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 18},
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#059669', paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 10, width: '100%', marginBottom: 20,
  },
  loginBtnText: {color: '#fff', fontSize: 15, fontWeight: '600'},
  securityNote: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 10,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
  },
  securityTitle: {fontSize: 13, fontWeight: '600', color: '#065F46', marginBottom: 4},
  securityText: {fontSize: 12, color: '#047857', lineHeight: 16},
  webViewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  webViewTitle: {fontSize: 16, fontWeight: '600', color: '#111827'},
});

export default AxisConnectModal;
