import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
  Dimensions,
  BackHandler,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import WebView from 'react-native-webview';
import LinearGradient from 'react-native-linear-gradient';
import ZerodhaIcon from '../../assets/Zerodha.png';
import ZerodhaHelpContent from './HelpUI/ZerodhaHelpContent';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../../utils/safeConfig';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../../screens/TradeContext';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import useModalStore from '../../GlobalUIModals/modalStore';
import {getAccountEmail} from '../../utils/accountEmail';
import {
  parseBrokerCallbackUrl,
  validateZerodhaOAuthCallback,
} from '../../utils/brokerAuth';
import {
  useSdkBridge,
  sdkExchangeBrokerToken,
} from '../../sdk/brokerSdkBridge';

import { designColor, designFont } from '../../design/literalTokens';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');
const ZERODHA_API_TIMEOUT_MS = 30000;
const ZERODHA_NAV_MESSAGE_TYPE = 'AQ_ZERODHA_NAV';
const ZERODHA_LOCATION_BRIDGE_SCRIPT = `
  (function () {
    function postUrl() {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: '${ZERODHA_NAV_MESSAGE_TYPE}',
            url: String(window.location.href || '')
          }));
        }
      } catch (_) {}
    }
    postUrl();
    if (window.__aqZerodhaNavBridgeInstalled) return;
    window.__aqZerodhaNavBridgeInstalled = true;
    try {
      var originalPushState = history.pushState;
      history.pushState = function () {
        var result = originalPushState.apply(history, arguments);
        setTimeout(postUrl, 0);
        return result;
      };
    } catch (_) {}
    try {
      var originalReplaceState = history.replaceState;
      history.replaceState = function () {
        var result = originalReplaceState.apply(history, arguments);
        setTimeout(postUrl, 0);
        return result;
      };
    } catch (_) {}
    try {
      window.addEventListener('popstate', postUrl);
      window.addEventListener('hashchange', postUrl);
    } catch (_) {}
  })();
  true;
`;

const ZerodhaConnectUI = ({
  isVisible,
  onClose,
  onConnectionSuccess,
  quickReconnectPending = false,
  onBackToQuickReconnect,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [webViewAttemptKey, setWebViewAttemptKey] = useState(0);
  const [isCompletingAuth, setIsCompletingAuth] = useState(false);
  const insets = useSafeAreaInsets();
  const hasProcessedCallback = useRef(false);
  const webViewRef = useRef(null);
  const { configData } = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);
  const sdkBridge = useSdkBridge();

  const userEmail = getAccountEmail();

  // Get common headers for API calls
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': Config?.REACT_APP_AQ_ENCRYPTED_KEY || generateToken(
      Config?.REACT_APP_AQ_KEYS,
      Config?.REACT_APP_AQ_SECRET
    ),
  });

  const getConfiguredRedirectUrl = () =>
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    Config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL ||
    '';

  // Fetch user details from DB (to get MongoDB _id)
  const fetchUserDetails = async () => {
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
        {
          headers: getHeaders(),
          timeout: ZERODHA_API_TIMEOUT_MS,
        },
      );
      return response.data.User;
    } catch (error) {
      console.error('[ZerodhaConnectUI] Failed to fetch user details:', error);
      return null;
    }
  };

  // Step 1: Generate access token from request_token (same as production)
  const generateAccessToken = async (requestToken, apiKey) => {
    try {
      console.log('[ZerodhaConnectUI] Generating access token...');
      const payload = {
        user_email: userEmail,
        apiKey: apiKey,
        requestToken: requestToken,
      };
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}zerodha/gen-access-token`,
        JSON.stringify(payload),
        {
          headers: getHeaders(),
          timeout: ZERODHA_API_TIMEOUT_MS,
        },
      );

      if (response.data && response.data.status !== 1) {
        console.log('[ZerodhaConnectUI] Access token generated successfully');
        return response.data.access_token;
      } else {
        throw new Error('Invalid credentials or token exchange failed');
      }
    } catch (error) {
      console.error('[ZerodhaConnectUI] gen-access-token failed:', error);
      throw error;
    }
  };

  // Step 2: Save broker connection to DB (same as production /api/user/connect-broker)
  const saveBrokerConnection = async (uid, accessToken, apiKey) => {
    try {
      console.log('[ZerodhaConnectUI] Saving broker connection...');
      const brokerData = {
        uid: uid,
        user_broker: 'Zerodha',
        jwtToken: accessToken,
        apiKey: apiKey,
      };

      const response = await axios.request({
        method: 'put',
        url: `${server.server.baseUrl}api/user/connect-broker`,
        headers: getHeaders(),
        data: JSON.stringify(brokerData),
        timeout: ZERODHA_API_TIMEOUT_MS,
      });

      console.log('[ZerodhaConnectUI] Broker connection saved successfully');
      return response.data;
    } catch (error) {
      console.error('[ZerodhaConnectUI] connect-broker failed:', error);
      throw error;
    }
  };

  // Full post-OAuth flow: extract token -> gen access token -> save connection
  const processOAuthCallback = async (requestToken) => {
    try {
      setIsLoading(true);
      setIsCompletingAuth(true);
      const zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY || Config?.REACT_APP_ZERODHA_API_KEY;

      // SDK pilot single-path swap — when REACT_APP_SDK_INTEGRATION=true,
      // route through /sdk/v1/connections/Zerodha/exchange-token. The
      // backend does gen-access-token + persistence in one round trip,
      // so we cannot dual-write here (Zerodha's requestToken is a
      // single-use OAuth code; calling gen-access-token twice fails the
      // second time with "Token is invalid or has expired"). When the
      // bridge isn't ready (flag off, or token mint pending), the
      // legacy two-step (gen-access-token then save) below runs as
      // the canonical path.
      if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
        try {
          await sdkExchangeBrokerToken(sdkBridge.client, 'Zerodha', {
            requestToken,
            apiKey: zerodhaApiKey,
          });
          console.log('[Zerodha] SDK exchange-token persisted broker connection');
          setIsLoading(false);
          setIsCompletingAuth(false);
          setShowWebView(false);
          setAuthUrl('');
          // Wrap post-success steps so a downstream throw (e.g. event
          // emit or onConnectionSuccess listener) doesn't bubble to the
          // outer catch and get rewritten as "Connection Error". See
          // KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
          // § Broker-connect post-success hygiene.
          try {
            onClose();
            if (onConnectionSuccess) {
              onConnectionSuccess();
            }
            showAlert('success', 'Connected Successfully', 'Your Zerodha broker has been connected successfully!');
          } catch (postSuccessErr) {
            console.warn(
              '[Zerodha] post-success step threw (connection IS saved DB-side):',
              postSuccessErr?.message || postSuccessErr,
            );
          }
          return;
        } catch (sdkErr) {
          // Fall through to legacy. Token may already have been spent
          // by the failed SDK request — the legacy gen-access-token
          // call below will then return "invalid token" and the user
          // will retry. This is the same failure mode as a network
          // blip on the legacy path; surface a clear message.
          console.warn('[Zerodha] SDK exchange-token failed, falling back to legacy:', sdkErr?.message || sdkErr);
        }
      }

      // Get user's MongoDB _id
      const userDetails = await fetchUserDetails();
      if (!userDetails || !userDetails._id) {
        throw new Error('Could not fetch user details');
      }

      // Generate access token via CCXT server (same as production)
      const accessToken = await generateAccessToken(requestToken, zerodhaApiKey);

      if (!accessToken) {
        throw new Error('Failed to generate access token');
      }

      // Save broker connection to DB (same as production PUT /api/user/connect-broker)
      await saveBrokerConnection(userDetails._id, accessToken, zerodhaApiKey);

      // Update model portfolio with broker information
      console.log('[Zerodha] Broker connected successfully, updating model portfolio...');
      try {
        const newBrokerData = {
          user_email: userEmail,
          user_broker: 'Zerodha',
        };
        await axios.request({
          method: 'post',
          url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
          data: JSON.stringify(newBrokerData),
          headers: getHeaders(),
          timeout: ZERODHA_API_TIMEOUT_MS,
        });
        console.log('[Zerodha] Model portfolio updated successfully');
      } catch (modelPortfolioError) {
        console.warn('[Zerodha] Model portfolio update failed (non-critical):', modelPortfolioError);
        // Don't fail the entire connection if model portfolio update fails
      }

      // Success!
      setShowWebView(false);
      setAuthUrl('');
      onClose();
      // Wrap post-success steps so a downstream throw doesn't bubble to
      // the outer catch and get rewritten as "Connection Error". See
      // KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
      // § Broker-connect post-success hygiene.
      try {
        showAlert('success', 'Connected Successfully', 'Your Zerodha broker has been connected successfully!');
        if (onConnectionSuccess) {
          onConnectionSuccess();
        }
      } catch (postSuccessErr) {
        console.warn(
          '[Zerodha] post-success step threw (connection IS saved DB-side):',
          postSuccessErr?.message || postSuccessErr,
        );
      }
    } catch (error) {
      console.error('[ZerodhaConnectUI] OAuth callback processing failed:', error);
      setShowWebView(false);
      setAuthUrl('');
      const isHttpError = !!error?.response;
      const rawMessage =
        error.response?.data?.msg ||
        error.response?.data?.message ||
        error.message;
      let alertTitle = 'Connection Error';
      let alertBody;
      if (isHttpError) {
        alertBody =
          rawMessage || 'Failed to complete Zerodha connection. Please try again.';
      } else {
        alertTitle = 'Connection Issue';
        alertBody =
          'We couldn\'t complete the connection because of a network or app error. Your credentials may already be saved — please refresh to check before retrying.';
      }
      showAlert('error', alertTitle, alertBody);
    } finally {
      setIsLoading(false);
      setIsCompletingAuth(false);
    }
  };

  // Handle Connect Zerodha button (simplified flow - uses company API key)
  const handleConnectZerodha = async () => {
    if (!userEmail) {
      Alert.alert('Error', 'User not found. Please login first.');
      return;
    }

    setIsLoading(true);
    setIsCompletingAuth(false);
    setShowWebView(false);
    setAuthUrl('');
    setWebViewAttemptKey(key => key + 1);
    hasProcessedCallback.current = false;
    try {
      const brokerConnectRedirectURL = getConfiguredRedirectUrl();
      const zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY || Config?.REACT_APP_ZERODHA_API_KEY;

      if (!zerodhaApiKey) {
        throw new Error('Zerodha API key not configured');
      }
      if (!brokerConnectRedirectURL) {
        throw new Error('Zerodha redirect URL not configured');
      }

      const headers = getHeaders();

      // Call CCXT server login-url endpoint (same as RGX web app)
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}zerodha/login-url`,
        {
          apiKey: zerodhaApiKey,
          site: brokerConnectRedirectURL?.replace('https://', '') || '',
        },
        {
          headers,
          timeout: ZERODHA_API_TIMEOUT_MS,
        },
      );

      if (response.data) {
        // Store user email in AsyncStorage for callback handler
        await AsyncStorage.setItem('zerodha_connecting_user_email', userEmail);

        // Open OAuth URL in WebView
        setAuthUrl(response.data);
        setShowWebView(true);
      } else {
        throw new Error('Failed to get OAuth URL');
      }
    } catch (error) {
      console.error('[ZerodhaConnectUI] Connection error:', error);
      Alert.alert('Error', error.response?.data?.msg || error.message || 'Failed to connect');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle every WebView URL callback through one idempotent path. Android
  // WebView can omit a server redirect from onNavigationStateChange, so the
  // WebView below also calls this from onShouldStartLoadWithRequest and
  // onLoadStart. Returning true tells the pre-load hook to stop the hosted
  // callback page once its single-use request_token has been captured.
  const handleWebViewCallbackUrl = (url) => {
    if (!url) {
      return false;
    }
    const parsedUrl = parseBrokerCallbackUrl(url);
    if (parsedUrl) {
      console.log(
        '[ZerodhaConnectUI] WebView navigation:',
        `${parsedUrl.origin}${parsedUrl.pathname}`,
        'query keys:',
        parsedUrl.paramKeys,
      );
    } else {
      console.log('[ZerodhaConnectUI] WebView navigation: unparseable URL');
    }

    const callback = validateZerodhaOAuthCallback(
      url,
      getConfiguredRedirectUrl(),
    );
    if (!callback.isCallback) {
      return false;
    }
    // Multiple WebView hooks can observe the same redirect. Keep blocking the
    // hosted callback after the first hook starts the single token exchange.
    if (hasProcessedCallback.current) {
      return true;
    }

    hasProcessedCallback.current = true;
    if (callback.valid) {
      console.log(
        '[ZerodhaConnectUI] Verified successful OAuth callback; exchanging token',
      );
      // Unmount the hosted callback page immediately. Its unauthenticated
      // fallback intentionally shows "Completing broker authentication…",
      // but it cannot finish the native app's token exchange and otherwise
      // looks like an infinite loader.
      setShowWebView(false);
      setAuthUrl('');
      setIsCompletingAuth(true);
      processOAuthCallback(callback.requestToken);
      return true;
    }

    console.warn(
      '[ZerodhaConnectUI] Rejected unsuccessful OAuth callback:',
      callback.reason,
    );
    setShowWebView(false);
    setAuthUrl('');
    setIsLoading(false);
    setIsCompletingAuth(false);
    showAlert(
      'error',
      'Zerodha Login Failed',
      'Zerodha did not confirm this login. Please check the OTP and try again.',
    );
    return true;
  };

  // Post-navigation fallback for WebView implementations that report the
  // callback only after it starts loading.
  const handleWebViewNavigationStateChange = (navState) => {
    handleWebViewCallbackUrl(navState?.url);
  };

  const handleWebViewMessage = event => {
    try {
      const message = JSON.parse(event?.nativeEvent?.data || '{}');
      if (
        message?.type === ZERODHA_NAV_MESSAGE_TYPE &&
        typeof message?.url === 'string'
      ) {
        handleWebViewCallbackUrl(message.url);
      }
    } catch {
      // Broker pages can post their own non-JSON messages. Ignore anything
      // that is not from the location bridge above.
    }
  };

  // Native Android WebView callbacks can miss a server-side 302 transition.
  // Probe the document location from inside the WebView as the primary
  // recovery path. This mirrors the production-tested SDK WebView flow and
  // catches the hosted callback even when every native navigation hook skips
  // its intermediate URL.
  useEffect(() => {
    if (!showWebView || !authUrl) {
      return undefined;
    }

    const probeCurrentLocation = () => {
      webViewRef.current?.injectJavaScript(ZERODHA_LOCATION_BRIDGE_SCRIPT);
    };
    const initialProbe = setTimeout(probeCurrentLocation, 250);
    const probeInterval = setInterval(probeCurrentLocation, 1000);

    return () => {
      clearTimeout(initialProbe);
      clearInterval(probeInterval);
    };
  }, [showWebView, authUrl, webViewAttemptKey]);

  // Handle Android back button
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isLoading) {
        // Don't allow back during OAuth processing
        return true;
      }
      if (showWebView) {
        // Go back from WebView to help content instead of closing modal
        setShowWebView(false);
        setAuthUrl('');
        hasProcessedCallback.current = false;
        return true;
      }
      if (expanded) {
        // Collapse expanded help content
        setExpanded(false);
        return true;
      }
      onClose();
      return true;
    });

    return () => backHandler.remove();
  }, [isVisible, onClose, showWebView, isLoading, expanded]);

  return (
    <CrossPlatformOverlay visible={isVisible} onClose={onClose}>
      <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
        {/* HEADER */}
        <LinearGradient
          colors={['rgba(0, 38, 81, 1)', 'rgba(0, 86, 183, 1)']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.headerRow}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <ChevronLeft size={24} color={designColor('000')} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Connect to Zerodha</Text>
          </View>
          <Image
            source={ZerodhaIcon}
            style={styles.headerIcon}
            resizeMode="contain"
          />
        </LinearGradient>

        {/* CONTENT */}
        <View style={styles.contentContainer}>
          {isCompletingAuth ? (
            <View style={styles.authCompletionContainer}>
              <ActivityIndicator size="large" color={designColor('0056b7')} />
              <Text style={styles.authCompletionTitle}>
                Completing Zerodha connection...
              </Text>
              <Text style={styles.authCompletionDescription}>
                Keep this screen open. This normally takes only a few seconds.
              </Text>
            </View>
          ) : showWebView ? (
            /* WebView for OAuth */
            (<WebView
              ref={webViewRef}
              key={`zerodha-auth-${webViewAttemptKey}`}
              source={{uri: authUrl}}
              style={{flex: 1}}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              onShouldStartLoadWithRequest={(request) =>
                !handleWebViewCallbackUrl(request?.url)
              }
              onLoadStart={(event) => {
                handleWebViewCallbackUrl(event?.nativeEvent?.url);
              }}
              onLoadProgress={(event) => {
                handleWebViewCallbackUrl(event?.nativeEvent?.url);
              }}
              onLoadEnd={(event) => {
                handleWebViewCallbackUrl(event?.nativeEvent?.url);
                webViewRef.current?.injectJavaScript(
                  ZERODHA_LOCATION_BRIDGE_SCRIPT,
                );
              }}
              onMessage={handleWebViewMessage}
              injectedJavaScript={ZERODHA_LOCATION_BRIDGE_SCRIPT}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={false}
              incognito={true}
              cacheEnabled={false}
              startInLoadingState={true}
              originWhitelist={['*']}
              renderLoading={() => (
                <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                  <ActivityIndicator size="large" color={designColor('0056b7')} />
                  <Text style={{marginTop: 10, color: designColor('6b7280')}}>Loading Zerodha login...</Text>
                </View>
              )}
            />)
          ) : expanded ? (
            /* Full Screen Help when expanded */
            (<View style={styles.fullScreenHelp}>
              <ScrollView
                style={{flex: 1}}
                contentContainerStyle={{padding: 10, paddingBottom: 20}}
                showsVerticalScrollIndicator={true}>
                <ZerodhaHelpContent expanded={expanded} onExpandChange={setExpanded} />
                <View style={[styles.toggleWrapper, {marginTop: 15, paddingBottom: insets.bottom + 10}]}>
                  <TouchableOpacity
                    style={styles.toggleContainer}
                    onPress={() => setExpanded(false)}>
                    <Text style={styles.toggleText}>See Less</Text>
                    <View style={styles.toggleIconContainer}>
                      <ChevronUp size={14} color={designColor('000')} />
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>)
          ) : (
            <ScrollView
              style={{flex: 1}}
              contentContainerStyle={{padding: 10, paddingBottom: insets.bottom + 100}}
              showsVerticalScrollIndicator={true}>
                {/* Help content */}
                <View style={[styles.guideBox, {maxHeight: 280}]}>
                  <ZerodhaHelpContent expanded={expanded} onExpandChange={setExpanded} />
                </View>
                <TouchableOpacity
                  onPress={() => setExpanded(true)}
                  style={styles.toggleContainer}>
                  <Text style={styles.toggleText}>Read More</Text>
                  <View style={styles.toggleIconContainer}>
                    <ChevronDown size={14} color={designColor('000')} />
                  </View>
                </TouchableOpacity>

                {/* Quick-reconnect (TOTP) setup continues after this login.
                    Without this note the TOTP/QR flow looked abandoned
                    (2026-10-01 report): Zerodha needs ONE normal login to
                    create the session; the gate then saves quick reconnect. */}
                {quickReconnectPending && (
                  <View style={styles.quickReconnectNote} testID="zerodha-quick-reconnect-step">
                    <Text style={styles.quickReconnectTitle}>
                      Step 2 of 2: log in to Zerodha once
                    </Text>
                    <Text style={styles.quickReconnectText}>
                      Your TOTP key is ready. Zerodha needs one normal login to connect this
                      account. As soon as it succeeds, quick reconnect is switched on
                      automatically — after that you won't need to log in or enter codes.
                    </Text>
                    {typeof onBackToQuickReconnect === 'function' && (
                      <TouchableOpacity onPress={onBackToQuickReconnect}>
                        <Text style={styles.quickReconnectBack}>
                          Back to quick reconnect setup
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Simplified Connection Card */}
                <View style={styles.inputCard}>
                  <View style={styles.connectRow}>
                    <Text style={styles.connectLabel}>Login to Zerodha</Text>
                    <Image
                      source={ZerodhaIcon}
                      style={styles.connectIcon}
                      resizeMode="contain"
                    />
                  </View>

                  <Text style={styles.infoDescription}>
                    Click the button below to securely connect your Zerodha account. You'll be redirected to Zerodha's login page to authorize access.
                  </Text>

                  <TouchableOpacity
                    style={styles.proceedButton}
                    onPress={handleConnectZerodha}
                    disabled={isLoading}>
                    {isLoading ? (
                      <ActivityIndicator size={27} color={designColor('fff')} />
                    ) : (
                      <Text style={styles.proceedButtonText}>Login to Zerodha</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
          )}
        </View>
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  quickReconnectNote: {
    marginHorizontal: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: designColor('eff6ff'),
    borderWidth: 1,
    borderColor: designColor('bfdbfe'),
  },
  quickReconnectTitle: {
    fontSize: 13,
    color: designColor('1e3a8a'),
    fontFamily: designFont('Poppins-SemiBold'),
    marginBottom: 4,
  },
  quickReconnectText: {
    fontSize: 12,
    lineHeight: 18,
    color: designColor('1e40af'),
    fontFamily: designFont('Poppins-Regular'),
  },
  quickReconnectBack: {
    marginTop: 8,
    fontSize: 12,
    color: designColor('1d4ed8'),
    fontFamily: designFont('Poppins-SemiBold'),
    textDecorationLine: 'underline',
  },
  fullScreen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: designColor('fff'),
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: designColor('fff'),
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: designColor('e8e9ec'),
    paddingVertical: 13,
  },
  headerLabel: {
    fontFamily: designFont('Poppins-Medium'),
    fontSize: 14,
    marginVertical: 5,
    color: 'black',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('fff'),
    marginLeft: 20,
  },
  headerIcon: {
    width: 35,
    height: 35,
    backgroundColor: designColor('fff'),
    borderRadius: 3,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('fff'),
    marginLeft: 4,
  },
  contentContainer: {
    flex: 1,
  },
  authCompletionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: designColor('fff'),
  },
  authCompletionTitle: {
    marginTop: 16,
    fontSize: 16,
    color: designColor('111827'),
    fontFamily: designFont('Poppins-SemiBold'),
    textAlign: 'center',
  },
  authCompletionDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: designColor('6b7280'),
    fontFamily: designFont('Poppins-Regular'),
    textAlign: 'center',
  },
  guideBox: {
    flex: 1,
    backgroundColor: designColor('fff'),
    borderRadius: 8,
    marginHorizontal: 8,
    marginTop: 8,
    padding: 12,
    elevation: 2,
    shadowColor: designColor('ccc'),
  },
  fullScreenHelp: {flex: 1, backgroundColor: designColor('fff')},
  toggleWrapper: {
    borderTopWidth: 1,
    borderTopColor: designColor('e8e9ec'),
    backgroundColor: designColor('fff'),
    paddingVertical: 5,
  },
  helpScrollContent: {
    paddingBottom: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0, 86, 183, 1)',
    marginRight: 8,
  },
  toggleIconContainer: {
    backgroundColor: designColor('fff'),
    elevation: 3,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  inputCard: {
    backgroundColor: designColor('fff'),
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    marginTop: 18,
    elevation: 3,
    shadowColor: designColor('ccc'),
  },
  connectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    alignItems: 'center',
    backgroundColor: designColor('f5f5f5'),
    padding: 10,
    borderRadius: 3,
    marginBottom: 10,
  },
  connectLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: designColor('000'),
    fontFamily: designFont('Poppins-SemiBold'),
  },
  connectIcon: {
    width: 30,
    height: 30,
    backgroundColor: designColor('fff'),
    borderRadius: 3,
  },
  infoDescription: {
    fontSize: 14,
    color: designColor('6b7280'),
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 20,
    fontFamily: designFont('Poppins-Regular'),
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  connectedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: designColor('10b981'),
    marginTop: 12,
    fontFamily: designFont('Poppins-SemiBold'),
  },
  notConnectedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: designColor('6b7280'),
    marginTop: 12,
    fontFamily: designFont('Poppins-SemiBold'),
  },
  statusText: {
    fontSize: 14,
    color: designColor('6b7280'),
    marginTop: 8,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 14,
    color: designColor('6b7280'),
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColor('ebf5ff'),
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: designColor('0056b7'),
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    borderColor: designColor('ccc'),
  },
  inputStyles: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Regular'),
    paddingVertical: 5,
  },
  proceedButton: {
    marginTop: 28,
    backgroundColor: 'black',
    padding: 11,
    borderRadius: 4,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    fontFamily: designFont('Poppins-SemiBold'),
  },
  webViewContainer: {
    flex: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
  },
});

export default ZerodhaConnectUI;
