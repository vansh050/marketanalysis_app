import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  BackHandler,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {
  ChevronLeft,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import HelpModal from '../../components/BrokerConnectionModal/HelpModal';
import FyersHelpContent from './HelpUI/FyersHelpContent';
import EgressIpCallout from '../../components/BrokerConnectionModal/EgressIpCallout';
import fyersIcon from '../../assets/fyers.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';
import {FYERS_REDIRECT_MISMATCH} from '../../utils/fyersOAuthErrors';

import { designColor, designFont } from '../../design/literalTokens';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');
const commonHeight = 40;

// Fyers renders OAuth validation failures inside its JavaScript application;
// neither WebView's HTTP error callback nor the navigation URL exposes the
// message. Observe the rendered body and notify native code only for the
// redirect mismatch marker so users do not remain trapped on Fyers' generic
// error page.
const FYERS_OAUTH_ERROR_PROBE = `
  (function () {
    var sent = false;
    var inspect = function () {
      if (sent || !document || !document.body) {
        return;
      }
      var compact = String(document.body.innerText || document.body.textContent || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      if (compact.indexOf('redirecturlmismatch') !== -1 ||
          compact.indexOf('redirecturimismatch') !== -1) {
        sent = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: '${FYERS_REDIRECT_MISMATCH}'
        }));
      }
    };
    inspect();
    var observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, {childList: true, subtree: true, characterData: true});
    setTimeout(inspect, 500);
    setTimeout(inspect, 1500);
    setTimeout(inspect, 3000);
    true;
  })();
`;

const FyersConnectUI = ({
  isVisible,
  onClose,
  showWebView,
  authUrl,
  secretKey,
  isPasswordVisibleup,
  setIsPasswordVisibleup,
  apiKey,
  isPasswordVisible,
  setIsPasswordVisible,
  setSecretKey,
  setApiKey,
  updateSecretKey,
  loading,
  helpVisible,
  setHelpVisible,
  handleWebViewNavigationStateChange,
  handleWebViewMessage,
  handleWebViewRenderProcessGone,
  egressUserId,
  egressUserEmail,
  egressReady,
  setEgressReady,
  unmetAck,
  setUnmetAck,
  configData,
}) => {
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  // Handle Android back button
  React.useEffect(() => {
    if (!isVisible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => backHandler.remove();
  }, [isVisible, onClose]);

  return (
    <CrossPlatformOverlay visible={isVisible} onClose={onClose}>
      <View style={styles.fullScreen}>
        <View style={{flex: 1, paddingTop: insets.top}}>
          {/* Header */}
          <LinearGradient
            colors={[designColor('0b3d91'), designColor('0056b7')]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.headerRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Pressable onPress={onClose} style={styles.backButton}>
                <ChevronLeft size={24} color={designColor('000')} />
              </Pressable>
              <Text style={styles.headerTitle}>Connect Fyers</Text>
            </View>
            <Image source={fyersIcon} style={styles.headerIcon} />
          </LinearGradient>

          {showWebView ? (
            <WebView
              source={{uri: authUrl}}
              style={{flex: 1}}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              injectedJavaScript={FYERS_OAUTH_ERROR_PROBE}
              onMessage={handleWebViewMessage}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              onRenderProcessGone={handleWebViewRenderProcessGone}
              onContentProcessDidTerminate={handleWebViewRenderProcessGone}
            />
          ) : expanded ? (
            /* Full Screen Help when expanded */
            (<View style={styles.fullScreenHelp}>
              <ScrollView
                style={{flex: 1}}
                contentContainerStyle={{padding: 15, paddingBottom: 20}}
                showsVerticalScrollIndicator={true}>
                <FyersHelpContent expanded={expanded} />
                <View style={[styles.toggleWrapper, {marginTop: 15, paddingBottom: insets.bottom + 10}]}>
                  <Pressable
                    style={styles.toggleContainer}
                    onPress={() => setExpanded(false)}>
                    <Text style={styles.toggleText}>See Less</Text>
                    <View style={styles.toggleIconContainer}>
                      <ChevronUp size={14} color={designColor('000')} />
                    </View>
                  </Pressable>
                </View>
              </ScrollView>
            </View>)
          ) : (
            <KeyboardAvoidingView
              style={{flex: 1}}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
              <ScrollView
                style={{flex: 1}}
                contentContainerStyle={{padding: 15, paddingBottom: insets.bottom + 100}}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled">
                {/* Help Content */}
                <View style={[styles.guideBox, {maxHeight: 280}]}>
                  <FyersHelpContent expanded={expanded} />
                </View>

                {/* Read More */}
                <Pressable
                  style={styles.toggleContainer}
                  onPress={() => setExpanded(true)}>
                  <Text style={styles.toggleText}>Read More</Text>
                  <View style={styles.toggleIconContainer}>
                    <ChevronDown size={14} color={designColor('000')} />
                  </View>
                </Pressable>

                {/* Egress-IP gate (see EgressIpCallout). Fyers requires a
                    dedicated static IP whitelisted in the user's API
                    Dashboard → App Details → Allowed IPs. */}
                <EgressIpCallout
                  broker="fyers"
                  customerId={egressUserId}
                  customerEmail={egressUserEmail}
                  configData={configData}
                  onAcknowledgeChange={setEgressReady}
                  showUnmetAck={unmetAck}
                  onUnmetAckHandled={() => setUnmetAck && setUnmetAck(false)}
                />

                {/* Input Card */}
                <View style={styles.inputCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.connectLabel}>Connect to Fyers</Text>
                    <Image
                      source={fyersIcon}
                      style={styles.cardIcon}
                      resizeMode="contain"
                    />
                  </View>

                  {/* Input Fields */}
                  <View style={styles.inputSection}>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>App ID:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={secretKey}
                          placeholder="Enter your App ID"
                          placeholderTextColor={designColor('aaa')}
                          style={[styles.inputStyles, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={text => setSecretKey(text.trim())}
                        />
                      </View>
                    </View>

                    <View style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>Secret ID:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={apiKey}
                          placeholder="Enter your Secret ID"
                          placeholderTextColor={designColor('aaa')}
                          style={[styles.inputStyles, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={text => setApiKey(text.trim())}
                        />
                      </View>
                    </View>

                    <Pressable
                      style={[
                        styles.proceedButton,
                        {
                          backgroundColor:
                            apiKey && secretKey && egressReady
                              ? designColor('0056b7')
                              : designColor('d3d3d3'),
                        },
                      ]}
                      onPress={updateSecretKey}
                      disabled={!(apiKey && secretKey && egressReady)}>
                      {loading ? (
                        <ActivityIndicator size={27} color={designColor('fff')} />
                      ) : (
                        <Text style={styles.proceedButtonText}>
                          Connect Fyers
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          <HelpModal
            broker="Fyers"
            visible={helpVisible}
            onClose={() => setHelpVisible(false)}
          />
        </View>
      </View>
    </CrossPlatformOverlay>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: designColor('fff'),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: designColor('fff'),
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('fff'),
    marginLeft: 10,
  },
  headerIcon: {width: 35, height: 35, borderRadius: 3, backgroundColor: designColor('fff')},
  guideBox: {
    borderWidth: 1,
    borderColor: designColor('e8e9ec'),
    borderRadius: 8,
    padding: 10,
  },
  fullScreenHelp: {flex: 1, backgroundColor: designColor('fff')},
  toggleWrapper: {
    borderTopWidth: 1,
    borderTopColor: designColor('e8e9ec'),
    backgroundColor: designColor('fff'),
    paddingVertical: 5,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopColor: designColor('e8e9ec'),
    backgroundColor: designColor('fff'),
    justifyContent: 'flex-start',
    marginHorizontal: 20,
  },
  toggleText: {fontSize: 14, fontFamily: designFont('Poppins-SemiBold'), color: designColor('0056b7')},
  toggleIconContainer: {
    marginLeft: 5,
    borderRadius: 20,
    padding: 3,
    backgroundColor: designColor('fff'),
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 2,
  },
  bottomContainer: {
    borderTopWidth: 1,
    borderColor: designColor('e8e9ec'),
    padding: 15,
    backgroundColor: designColor('fff'),
  },
  inputCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: designColor('e8e9ec'),
    borderRadius: 12,
    backgroundColor: designColor('fff'),
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: designColor('f5f5f5'),
    padding: 12,
  },
  cardIcon: {
    width: 30,
    height: 30,
    backgroundColor: designColor('fff'),
    borderRadius: 3,
  },
  inputSection: {
    padding: 15,
  },
  inputWrapper: {marginBottom: 10},
  headerLabel: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('000'),
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: designColor('ccc'),
    borderRadius: 8,
    paddingHorizontal: 10,
    height: commonHeight,
  },
  inputStyles: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('000'),
    paddingVertical: 0,
  },
  proceedButton: {
    height: commonHeight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  proceedButtonText: {color: designColor('fff'), fontSize: 16, fontWeight: '600'},
  connectLabel: {
    fontSize: 16,
    color: designColor('000'),
    fontFamily: designFont('Poppins-SemiBold'),
  },
});

export default FyersConnectUI;
