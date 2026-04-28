// KotakConnectUI.js
import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import {
  EyeIcon,
  EyeOffIcon,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import HelpModal from '../../components/BrokerConnectionModal/HelpModal';
import EgressIpCallout from '../../components/BrokerConnectionModal/EgressIpCallout';
import kotakIcon from '../../assets/kotak_securities.png';
import KotakHelpContent from './HelpUI/KotakHelpContent';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import CrossPlatformOverlay from '../../components/CrossPlatformOverlay';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('screen');
const commonHeight = 40;

const KotakConnectUI = ({
  isVisible,
  onClose,
  helpVisible,
  setHelpVisible,
  shouldRenderContent,
  mpin,
  setMpin,
  totp,
  settotp,
  mobileNumber,
  setMobileNumber,
  apiKey,
  setApiKey,
  ucc,
  setucc,
  iskeyVisible,
  setIskeyVisible,
  ismpinVisible,
  setIsmpinVisible,
  updateKotakSecretKey,
  isLoading,
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
      <View style={styles.fullScreen}>
        <View style={{flex: 1, paddingTop: insets.top}}>
          {/* Gradient Header */}
          <LinearGradient
            colors={['#0B3D91', '#0056B7']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.headerRow}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <ChevronLeft size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Connect to Kotak</Text>
            </View>
            <Image source={kotakIcon} style={styles.headerIcon} />
          </LinearGradient>

          {/* If expanded → Show HelpContent Fullscreen */}
          {expanded ? (
            <View style={styles.fullScreenHelp}>
              <ScrollView
                ref={scrollViewRef}
                style={{flex: 1}}
                contentContainerStyle={{padding: 10, paddingBottom: 20}}
                showsVerticalScrollIndicator={true}>
                <KotakHelpContent expanded={expanded} />
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
                {/* Help Box */}
                <View style={[styles.guideBox, {maxHeight: 280}]}>
                  <KotakHelpContent expanded={expanded} />
                </View>

                {/* Toggle Read More */}
                <TouchableOpacity
                  style={styles.toggleContainer}
                  onPress={() => setExpanded(true)}>
                  <Text style={styles.toggleText}>Read More</Text>
                  <View style={styles.toggleIconContainer}>
                    <ChevronDown size={14} color="#000" />
                  </View>
                </TouchableOpacity>

                {/* Egress-IP gate — shows "claim your dedicated static IP"
                    CTA, then the assigned IP + acknowledgment checkbox once
                    claimed. Parent's Connect button is gated on egressReady.
                    Returns null for partner brokers (not applicable to Kotak). */}
                <EgressIpCallout
                  broker="kotak"
                  customerId={egressUserId}
                  customerEmail={egressUserEmail}
                  configData={configData}
                  onAcknowledgeChange={setEgressReady}
                  showUnmetAck={unmetAck}
                  onUnmetAckHandled={() => setUnmetAck && setUnmetAck(false)}
                />

                {/* Input Fields — matches web source of truth:
                    single API Access Token (UUID from NEO → TradeAPI →
                    API Dashboard), UCC, Mobile, M-PIN, TOTP. */}
                <View style={styles.inputCard}>
                  {[
                    {
                      label: 'Unique Client Code',
                      value: ucc,
                      setValue: setucc,
                      placeholder: 'Enter your UCC Code',
                    },
                    {
                      label: 'API Access Token',
                      value: apiKey,
                      setValue: setApiKey,
                      placeholder: 'e.g. ec6a746c-e44b-455e-abf2-c13352b2fc45',
                      secure: !iskeyVisible,
                      toggle: () => setIskeyVisible(!iskeyVisible),
                    },
                    {
                      label: 'Mobile Number',
                      value: mobileNumber,
                      setValue: setMobileNumber,
                      placeholder: 'Enter 10-digit mobile number',
                    },
                    {
                      label: 'M-PIN',
                      value: mpin,
                      setValue: setMpin,
                      placeholder: 'Enter 6-digit M-PIN',
                      secure: !ismpinVisible,
                      toggle: () => setIsmpinVisible(!ismpinVisible),
                    },
                    {
                      label: 'TOTP',
                      value: totp,
                      setValue: settotp,
                      placeholder: 'Enter 6-digit TOTP',
                    },
                  ].map((input, idx) => (
                    <View key={idx} style={styles.inputWrapper}>
                      <Text style={styles.headerLabel}>{input.label}:</Text>
                      <View style={styles.inputContainer}>
                        <TextInput
                          value={input.value}
                          placeholder={input.placeholder}
                          placeholderTextColor="grey"
                          style={[styles.inputStyles, {flex: 1}]}
                          secureTextEntry={input.secure}
                          autoCapitalize="none"
                          autoCorrect={false}
                          onChangeText={input.setValue}
                        />
                        {input.toggle && input.value ? (
                          <TouchableOpacity onPress={input.toggle}>
                            {input.secure ? (
                              <EyeOffIcon size={22} color="#000" />
                            ) : (
                              <EyeIcon size={22} color="#000" />
                            )}
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ))}

                  {/* Connect Button. Also gated on egressReady — the
                      user cannot proceed until they've claimed a
                      dedicated IP AND ticked the "I've whitelisted this
                      IP" acknowledgment in EgressIpCallout above. */}
                  <TouchableOpacity
                    onPress={updateKotakSecretKey}
                    style={[
                      styles.proceedButton,
                      (!apiKey || !mobileNumber || !mpin || !ucc || !totp || !egressReady || isLoading) && {
                        backgroundColor: '#d3d3d3',
                      },
                    ]}
                    // `isLoading` MUST be in the disabled list — without it
                    // the button stays tappable while the spinner is up,
                    // letting users fire a second Connect mid-request. Kotak
                    // rejects TOTP reuse / TOTPs older than ~30s, so the
                    // second submit lands an "Incorrect credentials" alert
                    // ON TOP of the first request's "Reconnected" migration
                    // sheet (the first call had already succeeded server-
                    // side). Single-flight gate fixes the conflicting-UI
                    // class that produced the 2026-04-25 screenshot.
                    disabled={!apiKey || !mobileNumber || !mpin || !ucc || !totp || !egressReady || isLoading}>
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.proceedButtonText}>Connect Kotak</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* Help Modal */}
          <HelpModal
            broker={'Kotak'}
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
    padding: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
    marginLeft: 10,
  },
  headerIcon: {width: 35, height: 35, borderRadius: 3, backgroundColor: '#fff'},
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    elevation: 4,
  },
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
    alignItems: 'center',
    padding: 10,
  },
  toggleText: {fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#0056B7'},
  toggleIconContainer: {
    marginLeft: 5,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 3,
    elevation: 3,
  },
  bottomContainer: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#E8E9EC',
    backgroundColor: '#fff',
  },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E8E9EC',
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
    paddingVertical: 5,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    fontFamily: 'Poppins-Regular',
    marginBottom: 10,
  },
  proceedButton: {
    height: commonHeight,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#0056B7',
  },
  proceedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
});

export default KotakConnectUI;
