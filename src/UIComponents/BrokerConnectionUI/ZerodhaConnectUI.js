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
  Platform,
  Linking,
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
import { getAuth } from '@react-native-firebase/auth';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../../utils/safeConfig';
import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useTrade } from '../../screens/TradeContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import useModalStore from '../../GlobalUIModals/modalStore';
import {
  useSdkBridge,
  sdkExchangeBrokerToken,
} from '../../sdk/brokerSdkBridge';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');

const ZerodhaConnectUI = ({
  isVisible,
  onClose,
  onConnectionSuccess,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const insets = useSafeAreaInsets();
  const hasProcessedCallback = useRef(false);
  const { configData } = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);
  const sdkBridge = useSdkBridge();

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  // Get common headers for API calls
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || Config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
    'aq-encrypted-key': Config?.REACT_APP_AQ_ENCRYPTED_KEY || generateToken(
      Config?.REACT_APP_AQ_KEYS,
      Config?.REACT_APP_AQ_SECRET
    ),
  });

  // Parse query string from URL
  const parseQueryString = (queryString) => {
    const params = {};
    if (!queryString) return params;
    const query = queryString.startsWith('?') ? queryString.substring(1) : queryString;
    const pairs = query.split('&');
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });
    return params;
  };

  // Fetch user details from DB (to get MongoDB _id)
  const fetchUserDetails = async () => {
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
        { headers: getHeaders() }
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
        { headers: getHeaders() }
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
          // Wrap post-success steps so a downstream throw (e.g. event
          // emit or onConnectionSuccess listener) doesn't bubble to the
          // outer catch and get rewritten as "Connection Error". See
          // KotakModal.js (commit 172767d) and BROKER_CONNECTION.md
          // § Broker-connect post-success hygiene.
          try {
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
        });
        console.log('[Zerodha] Model portfolio updated successfully');
      } catch (modelPortfolioError) {
        console.warn('[Zerodha] Model portfolio update failed (non-critical):', modelPortfolioError);
        // Don't fail the entire connection if model portfolio update fails
      }

      // Success!
      setShowWebView(false);
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
    }
  };

  // Handle Connect Zerodha button (simplified flow - uses company API key)
  const handleConnectZerodha = async () => {
    if (!userEmail) {
      Alert.alert('Error', 'User not found. Please login first.');
      return;
    }

    setIsLoading(true);
    hasProcessedCallback.current = false;
    try {
      const brokerConnectRedirectURL = configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL || Config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL;
      const zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY || Config?.REACT_APP_ZERODHA_API_KEY;

      if (!zerodhaApiKey) {
        throw new Error('Zerodha API key not configured');
      }

      const headers = getHeaders();

      // Call CCXT server login-url endpoint (same as RGX web app)
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}zerodha/login-url`,
        {
          apiKey: zerodhaApiKey,
          site: brokerConnectRedirectURL?.replace('https://', '') || '',
        },
        { headers }
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

  // Handle WebView navigation (detect when OAuth completes and extract request_token)
  const handleWebViewNavigationStateChange = (navState) => {
    const { url } = navState;
    console.log('[ZerodhaConnectUI] WebView URL:', url);

    // Check if URL contains OAuth callback parameters (same detection as production)
    if (
      (url.includes('status=') || url.includes('request_token=') || url.includes('type=')) &&
      !hasProcessedCallback.current
    ) {
      const queryString = url.split('?')[1];
      if (!queryString) return;

      const queryParams = parseQueryString(queryString);
      const status = queryParams.status;
      const requestToken = queryParams.request_token;
      const loginType = queryParams.type;

      console.log('[ZerodhaConnectUI] OAuth callback - status:', status, 'request_token:', requestToken, 'type:', loginType);

      // If we have a request_token, process the full broker connection flow
      if (requestToken) {
        hasProcessedCallback.current = true;
        processOAuthCallback(requestToken);
      }
    }
  };

  // Handle Android back button
  useEffect(() => {
    if (!isVisible) return;

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
              <ChevronLeft size={24} color="#000" />
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
          {showWebView ? (
            /* WebView for OAuth */
            <WebView
              source={{uri: authUrl}}
              style={{flex: 1}}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              thirdPartyCookiesEnabled={true}
              sharedCookiesEnabled={true}
              startInLoadingState={true}
              originWhitelist={['*']}
              renderLoading={() => (
                <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                  <ActivityIndicator size="large" color="#0056B7" />
                  <Text style={{marginTop: 10, color: '#6B7280'}}>Loading Zerodha login...</Text>
                </View>
              )}
            />
          ) : expanded ? (
            /* Full Screen Help when expanded */
            <View style={styles.fullScreenHelp}>
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
                      <ChevronUp size={14} color="#000" />
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
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
                    <ChevronDown size={14} color="#000" />
                  </View>
                </TouchableOpacity>

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
                      <ActivityIndicator size={27} color="#fff" />
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
  fullScreen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#E8E9EC',
    paddingVertical: 13,
  },
  headerLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    marginVertical: 5,
    color: 'black',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
    marginLeft: 20,
  },
  headerIcon: {
    width: 35,
    height: 35,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#fff',
    marginLeft: 4,
  },
  contentContainer: {
    flex: 1,
  },
  guideBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 8,
    marginTop: 8,
    padding: 12,
    elevation: 2,
    shadowColor: '#ccc',
  },
  fullScreenHelp: {flex: 1, backgroundColor: '#fff'},
  toggleWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#E8E9EC',
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
    elevation: 3,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    marginTop: 18,
    elevation: 3,
    shadowColor: '#ccc',
  },
  connectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 3,
    marginBottom: 10,
  },
  connectLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Poppins-SemiBold',
  },
  connectIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  infoDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 8,
    lineHeight: 20,
    fontFamily: 'Poppins-Regular',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  connectedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
    marginTop: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  notConnectedText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B7280',
    marginTop: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#0056B7',
    marginLeft: 8,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    borderColor: '#ccc',
  },
  inputStyles: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
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
    fontFamily: 'Poppins-SemiBold',
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
