import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {XIcon, ChevronLeft} from 'lucide-react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import {getAuth} from '@react-native-firebase/auth';
import {generateToken} from '../utils/SecurityTokenManager';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTrade} from '../screens/TradeContext';
import {getAdvisorSubdomain} from '../utils/variantHelper';
import server from '../utils/serverConfig';
import {useConfig} from '../context/ConfigContext';
import {useColors} from '../theme/useColors';
import EgressIpCallout from './BrokerConnectionModal/EgressIpCallout';
import BrokerGuideCard, {
  getBrokerGuideConfig,
} from './BrokerConnectionModal/brokerGuideConfigs';
import CrossPlatformOverlay from './CrossPlatformOverlay';
import {
  useSdkBridge,
  sdkConnectBroker,
  sdkDualWriteSafely,
} from '../sdk/brokerSdkBridge';
import {getAccountEmail} from '../utils/accountEmail';

const {height: screenHeight} = Dimensions.get('window');
// The live backend still exposes the retired v1 partner endpoint and does
// not mount a verified IIFL connection service. Keep existing credentials
// untouched, but never send a customer into its invalid-App-Key WebView.
const IIFL_CONNECTION_ENABLED = false;

const IIFLModal = ({isVisible, onClose, fetchBrokerStatusModal}) => {
  const {configData} = useTrade();
  const insets = useSafeAreaInsets();
  const runtimeConfig = useConfig();
  const colors = useColors();
  const sdkBridge = useSdkBridge();
  const [authUrl, setAuthUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [egressReady, setEgressReady] = useState(false);
  const exchangeStartedRef = useRef(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();
  const accent =
    colors?.brand?.primary ||
    runtimeConfig?.mainColor ||
    runtimeConfig?.gradient2 ||
    runtimeConfig?.buttonColor ||
    '#0056B7';
  const guideConfig = getBrokerGuideConfig('IIFL Securities', {
    whiteLabelText: Config?.REACT_APP_WHITE_LABEL_TEXT || 'AlphaQuark',
  });

  useEffect(() => {
    if (IIFL_CONNECTION_ENABLED && isVisible && userEmail) {
      exchangeStartedRef.current = false;
      setEgressReady(false);
      fetchUserEmailAndId();
      const redirectUrl = String(
        configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL || '',
      ).replace('https://', '');
      const iiflUrl = `https://markets.iiflcapital.com/?v=1&appkey=nHjYctmzvrHrYWA&redirect_url=${redirectUrl}`;
      setAuthUrl(iiflUrl);
    }
  }, [isVisible, userEmail, configData]);

  const fetchUserEmailAndId = async () => {
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      if (response.data && response.data.User) {
        // Handle the user info here if needed
      } else {
        console.error('Profile data not found in response');
      }
    } catch (error) {
      console.error('Error fetching user email and id:', error.message);
    }
  };

  const handleWebViewNavigationStateChange = newNavState => {
    const {url = ''} = newNavState;
    if (url.includes('auth_token=') && !exchangeStartedRef.current) {
      const queryParams = parseQueryString(url.split('?')[1]);
      const sessionToken = queryParams.auth_token;
      const clientId = queryParams.clientid;

      if (sessionToken && clientId) {
        exchangeStartedRef.current = true;
        handleIIFLLogin(sessionToken, clientId);
      }
    }
  };

  const handleIIFLLogin = async (authCode, clientId) => {
    if (!authCode || !clientId) return;

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}/iifl/login/client`,
        {
          user_email: userEmail,
          auth_token: authCode,
          client_code: clientId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

      const accessToken = response.data.sessionToken;
      // Handle storing the access token
      await AsyncStorage.multiSet([
        ['iiflAccessToken', accessToken],
        ['iiflClientCode', clientId],
      ]);

      // SDK pilot dual-write — see brokerSdkBridge.js. IIFL persists
      // session info via AsyncStorage on this client (the actual
      // broker save lives upstream in ccxt-india's /iifl/login/client),
      // so the SDK call mirrors that persistence to MongoDB via
      // /sdk/v1/connections/IIFL Securities/connect for parity with
      // every other broker.
      if (sdkBridge.enabled && sdkBridge.ready && sdkBridge.client) {
        sdkDualWriteSafely(
          sdkConnectBroker(sdkBridge.client, 'IIFL Securities', {
            user_broker: 'IIFL Securities',
            clientCode: clientId,
            jwtToken: accessToken,
          }),
          'IIFL Securities',
          'connect',
        );
      }

      handleClose(); // Close the overlay after success.
      // Wrap post-success steps so a downstream throw doesn't bubble to
      // the outer catch and get rewritten as "Failed to connect with
      // IIFL". See KotakModal.js (commit 172767d) and
      // BROKER_CONNECTION.md § Broker-connect post-success hygiene.
      try {
        Toast.show({
          type: 'success',
          text1: 'Successfully connected to IIFL',
        });
        // Re-hydrate funds + brokerStatus in TradeContext so the next
        // pre-trade check doesn't re-fire the reconnect modal with stale
        // pre-reconnect state. Same pattern every other broker modal
        // uses on connect-success — IIFL was the lone holdout.
        if (typeof fetchBrokerStatusModal === 'function') {
          fetchBrokerStatusModal();
        }
      } catch (postSuccessErr) {
        console.warn(
          '[IIFL Securities] post-success step threw (connection IS saved DB-side):',
          postSuccessErr?.message || postSuccessErr,
        );
      }
    } catch (error) {
      exchangeStartedRef.current = false;
      console.error('IIFL Login failed:', error);
      const isHttpError = !!error?.response;
      const upstreamMsg =
        error?.response?.data?.message ||
        error?.response?.data?.details ||
        error?.message;
      let text1 = 'Failed to connect with IIFL';
      let text2;
      if (isHttpError) {
        text2 = upstreamMsg;
      } else {
        text1 = 'Connection Issue';
        text2 =
          'Network or app error. Your credentials may already be saved — please refresh to check before retrying.';
      }
      Toast.show({
        type: 'error',
        text1,
        text2,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const parseQueryString = queryString => {
    const params = {};
    const pairs = (queryString || '').split('&');
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) params[key] = decodeURIComponent(value || '');
    });
    return params;
  };

  const handleClose = () => {
    setAuthUrl('');
    onClose?.();
  };

  if (!IIFL_CONNECTION_ENABLED) {
    return (
      <CrossPlatformOverlay visible={isVisible} onClose={handleClose}>
        <View style={[styles.fullScreen, {paddingTop: insets.top}]}> 
          <View style={styles.modalContent}>
            <View style={[styles.header, {backgroundColor: accent}]}> 
              <TouchableOpacity
                onPress={handleClose}
                style={styles.headerAction}
                accessibilityLabel="Back">
                <ChevronLeft size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerCopy}>
                <Text style={styles.headerEyebrow}>BROKER CONNECTION</Text>
                <Text style={styles.headerTitle}>IIFL Securities</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.headerAction}
                accessibilityLabel="Close">
                <XIcon size={21} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.unavailableWrap}>
              <Text style={styles.unavailableEyebrow}>TEMPORARILY UNAVAILABLE</Text>
              <Text style={styles.unavailableTitle}>IIFL connection is being rebuilt</Text>
              <Text style={styles.unavailableBody}>
                IIFL’s previous partner authorisation is returning an invalid App Key. To avoid a failed sign-in or incorrect IP instructions, new IIFL connections are paused for now.
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={[styles.unavailableButton, {backgroundColor: accent}]}
                accessibilityRole="button">
                <Text style={styles.unavailableButtonText}>Choose another broker</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </CrossPlatformOverlay>
    );
  }

  // Do not use react-native-modal / React Native <Modal> here. On this
  // Android New Architecture build, a broker modal can render as the tiny
  // white top-left window in the screenshot and wedge the app's touch
  // surface. Arihant hit the same failure; CrossPlatformOverlay is the
  // established full-screen, WebView-safe primitive used by its fixed flow.
  return (
    <CrossPlatformOverlay visible={isVisible} onClose={handleClose}>
      <View style={[styles.fullScreen, {paddingTop: insets.top}]}> 
        <View style={styles.modalContent}>
          <View style={[styles.header, {backgroundColor: accent}]}> 
          <TouchableOpacity
            onPress={handleClose}
            style={styles.headerAction}
            accessibilityLabel="Back">
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>BROKER CONNECTION</Text>
            <Text style={styles.headerTitle}>Connect IIFL Securities</Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.headerAction}
            accessibilityLabel="Close">
            <XIcon size={21} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView
          nestedScrollEnabled
          contentContainerStyle={[styles.content, {paddingBottom: 30 + insets.bottom}]}
          indicatorStyle="black">
          <View style={styles.sheetContent}>
            <BrokerGuideCard
              config={guideConfig}
              accent={accent}
              brokerName="IIFL Securities"
            />
            <EgressIpCallout
              broker="iifl"
              customerEmail={userEmail || ''}
              configData={configData}
              onAcknowledgeChange={ready => setEgressReady(!!ready)}
            />
            {egressReady ? (
              <View style={[styles.webViewShell, {borderColor: accent}]}> 
                <View style={styles.webViewHeading}>
                  <View style={[styles.stepBadge, {backgroundColor: accent}]}> 
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <View style={styles.webViewHeadingCopy}>
                    <Text style={[styles.webViewEyebrow, {color: accent}]}>SECURE SIGN-IN</Text>
                    <Text style={styles.webViewTitle}>Authorise your IIFL account</Text>
                  </View>
                </View>
                <WebView
                  source={{uri: authUrl}}
                  style={styles.webView}
                  nestedScrollEnabled
                  onNavigationStateChange={handleWebViewNavigationStateChange}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={true}
                />
                {isLoading ? (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={accent} />
                    <Text style={styles.loadingText}>Saving your IIFL connection…</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={[styles.lockedStep, {borderColor: accent}]}> 
                <Text style={[styles.lockedStepTitle, {color: accent}]}>Step 2 is locked</Text>
                <Text style={styles.lockedStepText}>
                  Claim and whitelist your static IP above, then tick the confirmation box to open IIFL’s secure sign-in.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
        </View>
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalContent: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
    elevation: 4,
  },
  headerAction: {width: 40, height: 44, alignItems: 'center', justifyContent: 'center'},
  headerCopy: {flex: 1, marginHorizontal: 4},
  headerEyebrow: {color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '800', letterSpacing: 0.7},
  headerTitle: {color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2},
  sheetContent: {
    flex: 1,
  },
  lockedStep: {marginTop: 4, borderWidth: 1, borderRadius: 14, padding: 14, backgroundColor: '#FFFFFF'},
  lockedStepTitle: {fontSize: 14, fontWeight: '800', marginBottom: 4},
  lockedStepText: {fontSize: 13, lineHeight: 19, color: '#475569'},
  webViewShell: {marginTop: 8, borderWidth: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF'},
  webViewHeading: {padding: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E2E8F0'},
  stepBadge: {width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 9},
  stepBadgeText: {color: '#fff', fontSize: 13, fontWeight: '800'},
  webViewHeadingCopy: {flex: 1},
  webViewEyebrow: {fontSize: 10, fontWeight: '800', letterSpacing: 0.6},
  webViewTitle: {fontSize: 14, fontWeight: '800', color: '#1E293B', marginTop: 2},
  webView: {
    height: screenHeight * 0.78,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  unavailableWrap: {flex: 1, padding: 24, justifyContent: 'center'},
  unavailableEyebrow: {color: '#B45309', fontSize: 11, fontWeight: '800', letterSpacing: 0.7},
  unavailableTitle: {color: '#1E293B', fontSize: 22, fontWeight: '800', marginTop: 8},
  unavailableBody: {color: '#475569', fontSize: 14, lineHeight: 21, marginTop: 10},
  unavailableButton: {alignSelf: 'flex-start', borderRadius: 10, marginTop: 20, paddingHorizontal: 16, paddingVertical: 12},
  unavailableButtonText: {color: '#fff', fontSize: 14, fontWeight: '800'},
});

export default IIFLModal;
