import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Image,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  EyeIcon,
  EyeOffIcon,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import {WebView} from 'react-native-webview';
import HelpModal from '../../components/BrokerConnectionModal/HelpModal';
import LinearGradient from 'react-native-linear-gradient';
import hdfcIcon from '../../assets/hdfc_securities.png';
import HDFCHelpContent from './HelpUI/HDFCHelpContent';
import EgressIpCallout from '../../components/BrokerConnectionModal/EgressIpCallout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');
const commonHeight = 40;

const HDFCConnectUI = ({
  isVisible,
  onClose,
  apiKey,
  secretKey,
  isPasswordVisible,
  isPasswordVisibleup,
  showWebView,
  authUrl,
  helpVisible,
  setHelpVisible,
  loading,
  setApiKey,
  setSecretKey,
  setIsPasswordVisible,
  setIsPasswordVisibleup,
  initiateAuth,
  handleWebViewNavigationStateChange,
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
        {/* Header */}
        <LinearGradient
          colors={['#0B3D91', '#0056B7']}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.headerRow}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Connect to HDFC</Text>
          </View>
          <Image source={hdfcIcon} style={styles.headerIcon} />
        </LinearGradient>

        {/* WebView Full Screen */}
        {showWebView ? (
          <View style={styles.webViewFullWrapper}>
            <WebView
              source={{uri: authUrl}}
              style={styles.webViewFull}
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
        ) : expanded ? (
          /* Full Screen Help when expanded */
          <View style={styles.fullScreenHelp}>
            <ScrollView
              ref={scrollViewRef}
              style={{flex: 1}}
              contentContainerStyle={{padding: 10, paddingBottom: 20}}
              showsVerticalScrollIndicator={true}>
              <HDFCHelpContent expanded={expanded} onExpandChange={setExpanded} />
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
          <KeyboardAvoidingView
            style={{flex: 1}}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <ScrollView
              ref={scrollViewRef}
              style={{flex: 1}}
              contentContainerStyle={{padding: 10, paddingBottom: insets.bottom + 100}}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled">
              {/* Help Content */}
              <View style={[styles.guideBox, {maxHeight: 280}]}>
                <HDFCHelpContent expanded={expanded} onExpandChange={setExpanded} />
              </View>

              {/* Read More Button */}
              <TouchableOpacity
                onPress={() => setExpanded(true)}
                style={styles.toggleContainer}>
                <Text style={styles.toggleText}>Read More</Text>
                <View style={styles.toggleIconContainer}>
                  <ChevronDown size={14} color="#000" />
                </View>
              </TouchableOpacity>

              {/* Egress-IP gate (see EgressIpCallout). HDFC requires a
                  dedicated static IP whitelisted in InvestRight API app
                  → Allowed IPs. */}
              <EgressIpCallout
                broker="hdfcsec"
                customerId={egressUserId}
                customerEmail={egressUserEmail}
                configData={configData}
                onAcknowledgeChange={setEgressReady}
                showUnmetAck={unmetAck}
                onUnmetAckHandled={() => setUnmetAck && setUnmetAck(false)}
              />

              {/* Input Card */}
              <View style={styles.inputCard}>
                <View style={styles.connectRow}>
                  <Text style={styles.connectLabel}>Connect to HDFC</Text>
                  <Image
                    source={hdfcIcon}
                    style={styles.connectIcon}
                    resizeMode="contain"
                  />
                </View>

                  {/* API Key */}
                  <View style={{paddingHorizontal: 10}}>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>API Key:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={apiKey}
                          placeholder="Enter your API key"
                          placeholderTextColor="grey"
                          style={[styles.inputStyles, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={text => setApiKey(text.trim())}
                        />
                      </View>
                    </View>

                    {/* Secret Key */}
                    <View style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>Secret Key:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={secretKey}
                          placeholder="Enter your Secret key"
                          placeholderTextColor="grey"
                          style={[styles.inputStyles, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={text => setSecretKey(text.trim())}
                        />
                      </View>
                    </View>

                    {/* Connect Button */}
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
                        <Text style={styles.proceedButtonText}>Connect HDFC</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        <HelpModal
          broker="HDFC"
          visible={helpVisible}
          onClose={() => setHelpVisible(false)}
        />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
    marginLeft: 10,
  },
  headerIcon: {width: 35, height: 35, borderRadius: 3, backgroundColor: '#fff'},
  guideBox: {
    borderWidth: 1,
    borderColor: '#E8E9EC',
    borderRadius: 8,
    padding: 10,
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
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderTopColor: '#E8E9EC',
  },
  toggleText: {fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#0056B7'},
  toggleIconContainer: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    marginLeft: 5,
  },
  content: {paddingBottom: 20},
  bottomContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E8E9EC',
    backgroundColor: '#fff',
  },
  inputCard: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E8E9EC',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  connectCard: {
    paddingVertical: 10,
    marginHorizontal: 10,
    borderWidth: 0.3,
    borderColor: '#c8c8c8',
    borderRadius: 8,
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
  inputWrapper: {paddingVertical: 0},
  headerLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    marginVertical: 5,
    color: 'black',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    borderColor: '#ccc',
    marginBottom: 5,
    height: commonHeight,
  },
  inputStyles: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: 'grey',
    paddingVertical: 0,
  },
  proceedButton: {
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
    height: commonHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonText: {fontSize: 16, fontWeight: '600', color: '#fff'},
  webViewFullWrapper: {flex: 1, backgroundColor: '#fff'},
  webViewFull: {flex: 1},
});

export default HDFCConnectUI;
