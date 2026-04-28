import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  TextInput,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {WebView} from 'react-native-webview';
import {
  EyeIcon,
  EyeOffIcon,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import HelpModal from '../../components/BrokerConnectionModal/HelpModal';
import LinearGradient from 'react-native-linear-gradient';
import iciciIcon from '../../assets/icici.png';
import ICICIHelpContent from './HelpUI/ICICIHelpContent';
import EgressIpCallout from '../../components/BrokerConnectionModal/EgressIpCallout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');
const commonHeight = 40;

const ICICIConnectUI = ({
  isVisible,
  onClose,
  apiKey,
  secretKey,
  isPasswordVisible,
  isPasswordVisibleup,
  showWebView,
  authUrl,
  helpVisible,
  loading,
  setApiKey,
  setSecretKey,
  setHelpVisible,
  setIsPasswordVisible,
  setIsPasswordVisibleup,
  initiateAuth,
  handleWebViewNavigationStateChange,
  shouldRenderContent,
  egressUserId,
  egressUserEmail,
  egressReady,
  setEgressReady,
  unmetAck,
  setUnmetAck,
  configData,
}) => {
  const scrollViewRef = useRef(null);
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
      <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['rgba(0, 38, 81, 1)', 'rgba(0, 86, 183, 1)']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.headerRow}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Connect to ICICI</Text>
          </View>
          <Image
            source={iciciIcon}
            style={{
              width: 35,
              height: 35,
              backgroundColor: '#fff',
              borderRadius: 3,
            }}
            resizeMode="contain"
          />
        </LinearGradient>
        {shouldRenderContent && !showWebView && expanded && (
          /* Full Screen Help when expanded */
          <View style={styles.fullScreenHelp}>
            <ScrollView
              ref={scrollViewRef}
              style={{flex: 1}}
              contentContainerStyle={{padding: 10, paddingBottom: 20}}
              showsVerticalScrollIndicator={true}>
              <ICICIHelpContent expanded={expanded} onExpandChange={setExpanded} />
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
        )}

        {shouldRenderContent && !showWebView && !expanded && (
          <KeyboardAvoidingView
            style={{flex: 1}}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <ScrollView
              style={{flex: 1}}
              contentContainerStyle={{...styles.content, paddingBottom: insets.bottom + 100}}
              ref={scrollViewRef}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled">
              {/* Help Section */}
              <View style={[styles.guideBox, {maxHeight: 280}]}>
                <ICICIHelpContent expanded={expanded} onExpandChange={setExpanded} />
              </View>
              <TouchableOpacity
                onPress={() => setExpanded(true)}
                style={styles.toggleContainer}>
                <Text style={styles.toggleText}>Read More</Text>
                <View style={styles.toggleIconContainer}>
                  <ChevronDown size={14} color="#000" />
                </View>
              </TouchableOpacity>

              {/* Egress-IP gate (see EgressIpCallout). ICICI requires a
                  dedicated static IP whitelisted in Breeze API app → IP
                  Whitelist. */}
              <EgressIpCallout
                broker="icicidirect"
                customerId={egressUserId}
                customerEmail={egressUserEmail}
                configData={configData}
                onAcknowledgeChange={setEgressReady}
                showUnmetAck={unmetAck}
                onUnmetAckHandled={() => setUnmetAck && setUnmetAck(false)}
              />

              {/* API & Secret Inputs */}
              <View style={styles.inputCard}>
                <View style={styles.connectRow}>
                  <Text style={styles.connectLabel}>Connect to ICICI</Text>
                  <Image
                    source={iciciIcon}
                    style={{width: 30, height: 30, borderRadius: 3}}
                    resizeMode="contain"
                  />
                </View>
                <View style={{paddingHorizontal: 10}}>
                  <View>
                    <Text style={styles.headerLabel}>API Key :</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        value={apiKey}
                        placeholder="Enter your API key"
                        placeholderTextColor="grey"
                        style={[styles.inputStyles, {color: 'grey', flex: 1}]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={text => setApiKey(text.trim())}
                      />
                    </View>
                  </View>

                  <View>
                    <Text style={styles.headerLabel}>Secret Key :</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        value={secretKey}
                        placeholder="Enter your Secret key"
                        placeholderTextColor="grey"
                        style={[styles.inputStyles, {color: 'grey', flex: 1}]}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onChangeText={text => setSecretKey(text.trim())}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.proceedButton,
                      {
                        backgroundColor:
                          apiKey && secretKey && egressReady
                            ? '#0056B7'
                            : '#d3d3d3',
                      },
                    ]}
                    onPress={initiateAuth}
                    disabled={!(apiKey && secretKey && egressReady)}>
                    {loading ? (
                      <ActivityIndicator size={27} color="#fff" />
                    ) : (
                      <Text style={styles.proceedButtonText}>Connect ICICI</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* WebView Section */}
        {shouldRenderContent && showWebView && (
          <View style={styles.webViewWrapper}>
            {/* Header */}
            <View style={styles.webViewHeader}>
              <TouchableOpacity
                onPress={onClose}
                style={{flexDirection: 'row', alignItems: 'center'}}>
                <ChevronLeft size={24} color="black" />
                <Text style={{marginLeft: 5, color: '#000'}}>Back</Text>
              </TouchableOpacity>
            </View>

            {/* WebView */}
            <WebView
              source={{uri: authUrl}}
              style={styles.webView}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <ActivityIndicator
                  size="large"
                  color="#0056B7"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    marginLeft: -15,
                    marginTop: -15,
                  }}
                />
              )}
              onNavigationStateChange={handleWebViewNavigationStateChange}
            />
          </View>
        )}

        {/* Help Modal */}
        <HelpModal
          broker="ICICI"
          visible={helpVisible}
          onClose={() => setHelpVisible(false)}
        />
      </View>
    </CrossPlatformOverlay>
  );
};

export default ICICIConnectUI;

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
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
    marginLeft: 20,
  },
  guideBox: {
    margin: 10,
    borderWidth: 1,
    borderColor: '#E8E9EC',
    borderRadius: 8,
  },
  fullScreenHelp: {flex: 1, backgroundColor: '#fff'},
  toggleWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#E8E9EC',
    backgroundColor: '#fff',
    paddingVertical: 5,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 5,
  },
  toggleText: {fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#0056B7'},
  inputCard: {
    padding: 0,
    marginHorizontal: 15,
    borderWidth: 0.3,
    borderRadius: 8,
    borderColor: '#c8c8c8',
  },
  connectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 3,
    marginBottom: 10,
  },
  connectLabel: {fontSize: 16, fontWeight: '700', color: '#000'},
  headerLabel: {
    fontSize: 14,
    marginVertical: 5,
    color: 'black',
    fontFamily: 'Poppins-Medium',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    borderColor: '#ccc',
    marginBottom: 10,
  },
  proceedButton: {
    padding: 10,
    borderRadius: 8,
    height: commonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  proceedButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: 'white',
  },
  webViewWrapper: {flex: 1, backgroundColor: '#fff'},
  webViewHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E9EC',
  },
  webView: {flex: 1},
  content: {paddingBottom: 20},
  toggleIconContainer: {
    backgroundColor: '#fff',
    elevation: 3,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  inputStyles: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    paddingVertical: 5,
  },
});
