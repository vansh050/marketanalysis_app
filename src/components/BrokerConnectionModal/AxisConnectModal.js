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
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../../sdk/brokerSdkBridge';

const AxisConnectModal = ({
  isVisible,
  onClose,
  fetchBrokerStatusModal,
}) => {
  const {configData} = useTrade();
  const sdkBridge = useSdkBridge();
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
  // web uses — Axis's `ssoId` callback lands there). Resolution order:
  //   1. Per-advisor backend override (configData.config) — authoritative.
  //   2. .env REACT_APP_BROKER_CONNECT_REDIRECT_URL — current default
  //      `https://prod.alphaquark.in/stock-recommendation` matches the
  //      legacy callback URL all OAuth brokers use, including Axis SSO
  //      registration for the platform advisors. This fallback was
  //      previously omitted because the env briefly held
  //      `app-links.alphaquark.in/broker-callback` (commit f9f5d0f
  //      Groww App Links) which was NOT registered with Axis SSO.
  //      Reverted to the canonical URL on 2026-04-23, so the env
  //      fallback is now safe.
  const brokerConnectRedirectURL =
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    Config.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    '';

  const handleAxisLogin = async () => {
    setLoading(true);
    try {
      if (!brokerConnectRedirectURL) {
        Toast.show({
          type: 'error',
          text1: 'Axis redirect URL not configured',
          text2:
            'No REACT_APP_BROKER_CONNECT_REDIRECT_URL — contact support.',
          visibilityTime: 6000,
        });
        return;
      }
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
        // Surface the actual upstream error if present. ccxt-india's
        // /axis/login-url returns 200 with `{error, status}` for some
        // failure modes (e.g. Axis env mismatch).
        const upstreamMsg =
          response.data?.error ||
          response.data?.message ||
          'Empty redirect URL from Axis backend';
        Toast.show({
          type: 'error',
          text1: 'Failed to get login URL from Axis Securities',
          text2: String(upstreamMsg),
          visibilityTime: 6000,
        });
      }
    } catch (error) {
      // Surface the actual error body so user (and we) can diagnose
      // whether it's redirectUrl validation (400), Axis SSO backend
      // failure (500), or network. Previously the toast was just
      // "Failed to initiate Axis login. Please try again." which
      // hides whether the redirectUrl was wrong or whether it was an
      // upstream Axis bug.
      console.error('Axis login-url error:', error);
      const status = error?.response?.status;
      const body = error?.response?.data;
      const upstreamMsg =
        body?.error || body?.message || error?.message || 'Network or app error';
      let text1 = 'Failed to initiate Axis login';
      if (status === 400) {
        text1 = 'Axis Securities — invalid redirect URL';
      } else if (status === 500 || status === 502) {
        text1 = 'Axis Securities upstream error';
      } else if (!status) {
        text1 = 'Connection Issue';
      }
      Toast.show({
        type: 'error',
        text1,
        text2: status ? `${status}: ${upstreamMsg}` : String(upstreamMsg),
        visibilityTime: 6000,
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
      // Upstream error envelope detection. Axis SSO returns a 200 with
      // an `error: {code, error, stackTrace}` body when the backend
      // rejects the request (observed live: code 1083 / "failed to
      // type cast user id" from sso/model.go:326). Without this guard,
      // the next block reports "Missing auth token from Axis SSO
      // response" — accurate but misleading; the actual cause is the
      // upstream rejection. Surface that to the user so they (and
      // support) know to investigate ccxt-india's /axis/callback or
      // Axis's SSO service rather than retrying client-side.
      if (data.error && typeof data.error === 'object') {
        const upstreamCode = data.error.code || 'unknown';
        const upstreamMsg = data.error.error || data.error.message || 'Upstream rejected the request';
        throw new Error(
          `Axis Securities SSO error ${upstreamCode}: ${upstreamMsg}`,
        );
      }
      // Axis returns the auth token under a wider set of paths than
      // we initially captured — re-auth in particular can wrap it
      // inside a `tokens` / `metadata` / `result` envelope. Walk all
      // known shapes before giving up. If none match, log the
      // top-level keys + truncated response so we can grow this
      // fallback list when a new shape surfaces.
      const authToken =
        data.authToken?.token ||
        data.authToken ||
        data.token ||
        data.access_token ||
        data.accessToken ||
        data.tokens?.authToken?.token ||
        data.tokens?.authToken ||
        data.tokens?.access_token ||
        data.metadata?.authToken?.token ||
        data.metadata?.authToken ||
        data.metadata?.tokens?.authToken ||
        data.result?.authToken?.token ||
        data.result?.authToken ||
        data.result?.token;
      const refreshToken =
        data.refreshToken?.token ||
        data.refreshToken ||
        data.refresh_token ||
        data.tokens?.refreshToken?.token ||
        data.tokens?.refreshToken ||
        data.tokens?.refresh_token ||
        data.metadata?.refreshToken?.token ||
        data.metadata?.refreshToken ||
        data.result?.refreshToken?.token ||
        data.result?.refreshToken ||
        '';
      if (!authToken) {
        // Diagnostic — surface what the response actually looked like
        // so we can extend the fallback list above.
        const preview = (() => {
          try {
            const s = JSON.stringify(data);
            return s.length > 600 ? s.slice(0, 600) + '…' : s;
          } catch {
            return '[unstringifiable]';
          }
        })();
        console.warn(
          '[Axis] callback response missing authToken. Top-level keys:',
          Object.keys(data || {}),
          'preview:',
          preview,
        );
      }
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

      const axisBrokerData = {
        uid: userId,
        user_broker: 'Axis Securities',
        clientCode: subAccountId,
        jwtToken: authToken,
        secretKey: refreshToken,
      };
      // Save broker connection
      await axios.put(
        `${server.server.baseUrl}api/user/connect-broker`,
        axisBrokerData,
        {headers: requestHeaders},
      );

      // SDK pilot dual-write — see brokerSdkBridge.js.
      if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
        sdkDualWriteSafely(
          sdkConnectBroker(sdkBridge.client, 'Axis Securities', axisBrokerData),
          'Axis Securities',
          'connect',
        );
      }

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

      onClose();
      // Wrap post-success steps so a downstream throw doesn't bubble to
      // the outer catch and surface as "Failed to connect Axis
      // Securities". See KotakModal.js (commit 172767d) and
      // BROKER_CONNECTION.md § Broker-connect post-success hygiene.
      try {
        Toast.show({
          type: 'success',
          text1: 'Axis Securities connected successfully!',
          visibilityTime: 3000,
        });

        await fetchBrokerStatusModal?.();
        eventEmitter.emit('refreshEvent', {source: 'Axis broker connection'});
      } catch (postSuccessErr) {
        console.warn(
          '[Axis Securities] post-success step threw (connection IS saved DB-side):',
          postSuccessErr?.message || postSuccessErr,
        );
      }
    } catch (error) {
      console.error('Axis callback error:', error);
      // Preserve Axis's existing 1083-envelope handling (the throw above
      // already carries the upstream code/message in error.message).
      // For HTTP errors, prefer the structured upstream body that
      // ccxt-india's /axis/callback returns (502 + {error, upstream:
      // {code, message}, status}) per ccxt commit c66e0daa.
      const isHttpError = !!error?.response;
      const body = error?.response?.data;
      const upstreamCode = body?.upstream?.code;
      const upstreamUpMsg = body?.upstream?.message;
      const bodyError = body?.error || body?.message;
      // Compose the most informative message we can.
      const upstreamMsg = upstreamCode
        ? `Axis SSO error ${upstreamCode}: ${upstreamUpMsg || bodyError}`
        : bodyError || error.message;
      let text1 = 'Failed to connect Axis Securities';
      let text2 = upstreamMsg;
      if (!isHttpError && !/Axis Securities SSO error/.test(error.message || '')) {
        text1 = 'Connection Issue';
        text2 =
          'Network or app error. Your credentials may already be saved — please refresh to check before retrying.';
      } else if (upstreamCode === '1083') {
        // Documented Axis upstream bug. Tell the user this is on
        // Axis's side (sso/model.go:326 type-cast bug) — retrying
        // won't help; needs Axis support contact.
        text1 = 'Axis Securities — temporary SSO issue';
        text2 =
          `Axis SSO returned error ${upstreamCode}. Their server is rejecting the SSO ID — please retry in a few minutes or contact support.`;
      }
      Toast.show({
        type: 'error',
        text1,
        text2,
        visibilityTime: 6000,
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
