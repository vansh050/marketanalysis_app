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

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');
const commonHeight = 40;

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
            colors={['#0B3D91', '#0056B7']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.headerRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Pressable onPress={onClose} style={styles.backButton}>
                <ChevronLeft size={24} color="#000" />
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
              onNavigationStateChange={handleWebViewNavigationStateChange}
            />
          ) : expanded ? (
            /* Full Screen Help when expanded */
            <View style={styles.fullScreenHelp}>
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
                      <ChevronUp size={14} color="#000" />
                    </View>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
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
                    <ChevronDown size={14} color="#000" />
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
                          placeholderTextColor="#aaa"
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
                          placeholderTextColor="#aaa"
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
                              ? '#0056B7'
                              : '#d3d3d3',
                        },
                      ]}
                      onPress={updateSecretKey}
                      disabled={!(apiKey && secretKey && egressReady)}>
                      {loading ? (
                        <ActivityIndicator size={27} color="#fff" />
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderTopColor: '#E8E9EC',
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
    marginHorizontal: 20,
  },
  toggleText: {fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#0056B7'},
  toggleIconContainer: {
    marginLeft: 5,
    borderRadius: 20,
    padding: 3,
    backgroundColor: '#fff',
    elevation: 2,
  },
  bottomContainer: {
    borderTopWidth: 1,
    borderColor: '#E8E9EC',
    padding: 15,
    backgroundColor: '#fff',
  },
  inputCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E8E9EC',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 12,
  },
  cardIcon: {
    width: 30,
    height: 30,
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  inputSection: {
    padding: 15,
  },
  inputWrapper: {marginBottom: 10},
  headerLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#000',
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: commonHeight,
  },
  inputStyles: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#000',
    paddingVertical: 0,
  },
  proceedButton: {
    height: commonHeight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  proceedButtonText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  connectLabel: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Poppins-SemiBold',
  },
});

export default FyersConnectUI;
