import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import Config from '../../utils/safeConfig';
import {useConfig} from '../../context/ConfigContext';
import APP_VARIANTS from '../../utils/Config';
import {Key} from 'lucide-react-native';
import {getAuth} from '@react-native-firebase/auth';

import {
  updateRACodeAndConfig,
} from '../../utils/storageUtils';
import {useTrade} from '../TradeContext';
import {
  logLoginAttempt,
  trackAppUser,
} from '../../FunctionCall/services/LoginLoggingService';

const SignUpRADetails = ({route}) => {
  const {reloadConfigData} = useTrade();
  const navigation = useNavigation();
  const config = useConfig();
  const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';
  const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : 'rgxresearch';
  const fallbackConfig = APP_VARIANTS[validVariant] || {};

  // Get logo and app name from config (S3) or fallback
  const logo = config?.logo || fallbackConfig.logo;
  const appName = config?.appName || Config.REACT_APP_WHITE_LABEL_TEXT || 'RGX Research';

  // Get dynamic gradient colors from config
  const gradient1 = config?.gradient1 || fallbackConfig.gradient1 || '#03275B';
  const gradient2 = config?.gradient2 || fallbackConfig.gradient2 || '#0156B7';

  const [raId, setRaId] = useState(''); // Default to rgxresearch
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email || route?.params?.userEmail;

  const {getAllTrades, getModelPortfolioStrategyDetails} = useTrade();

  // Validate RA ID format
  const validateRaId = raId => {
    if (!raId || raId.trim().length < 4) {
      return {
        isValid: false,
        message: 'RA ID must be at least 4 characters long',
      };
    }

    const raIdPattern = /^[A-Za-z0-9]+$/;
    if (!raIdPattern.test(raId.trim())) {
      return {isValid: false, message: 'RA ID contains invalid characters'};
    }

    return {isValid: true};
  };

  const handleCreateAccount = async () => {
    try {
      if (!raId) {
        Alert.alert('Error', 'Please enter your RA ID');
        return;
      }

      if (!userEmail) {
        Alert.alert('Error', 'User email not found. Please login again.');
        return;
      }

      // Validate RA ID format
      const validation = validateRaId(raId);
      if (!validation.isValid) {
        Alert.alert('Invalid RA ID', validation.message);
        return;
      }

      setLoading(true);
      setStatusMessage('Verifying advisor details...');

      // Step 1: Update RA code and fetch config (necessary)
      const result = await updateRACodeAndConfig(raId.trim(), userEmail);

      if (result.success) {
        setStatusMessage('Configuration stored successfully!');

        // Get the advisor subdomain from the config
        // Try multiple possible locations for the subdomain
        const advisorSubdomain = result.configData?.config?.REACT_APP_HEADER_NAME ||
                                  result.configData?.config?.subdomain ||
                                  result.configData?.subdomain ||
                                  raId.toLowerCase().trim();

        // Log to the advisor's database (fire-and-forget)
        if (advisorSubdomain && user) {
          trackAppUser({
            email: userEmail,
            firebase_id: user.uid,
            name: user.displayName,
            login_method: 'email',
            advisor_subdomain: advisorSubdomain,
          });
          logLoginAttempt({
            email: userEmail,
            firebase_id: user.uid,
            status: 'success',
            login_method: 'email',
            advisor_subdomain: advisorSubdomain,
          });
          console.log('Login logged to advisor database:', advisorSubdomain);
        }

        // Reload config immediately
        await reloadConfigData();

        // Load trades and portfolio in background (don't wait)
        getAllTrades().catch(err => console.error('Trade load error:', err));
        getModelPortfolioStrategyDetails().catch(err => console.error('Portfolio load error:', err));

        // Navigate immediately - data loads in background
        setSuccessModalVisible(true);
      } else {
        // Handle specific error cases
        if (result.advisorExists === false) {
          Alert.alert(
            'Invalid RA ID',
            'The RA ID you entered is not registered in our system. Please contact your financial advisor for the correct RA ID.',
            [{text: 'OK'}],
          );
        } else if (result.error.includes('Network Error')) {
          Alert.alert(
            'Network Error',
            'Please check your internet connection and try again.',
            [{text: 'OK'}],
          );
        } else if (result.error.includes('Server Error: 400')) {
          Alert.alert(
            'Error',
            'Invalid RA ID format. Please check and try again.',
            [{text: 'OK'}],
          );
        } else if (result.error.includes('Server Error: 409')) {
          Alert.alert(
            'Error',
            'This RA ID is already registered. Please use a different one or contact support.',
            [{text: 'OK'}],
          );
        } else {
          Alert.alert(
            'Error',
            result.error || 'Failed to create account. Please try again.',
            [{text: 'OK'}],
          );
        }
        setStatusMessage('');
      }
    } catch (error) {
      console.error('❌ Unexpected error in handleCreateAccount:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.', [
        {text: 'OK'},
      ]);
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  };

  // Clear status message after 5 seconds
  React.useEffect(() => {
    if (statusMessage && !loading) {
      const timer = setTimeout(() => {
        setStatusMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage, loading]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{flex: 1}}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.container}>
          <StatusBar barStyle="light-content" />

          {/* Background Circles */}
          <View style={[styles.backgroundCircleabove, styles.circleOne]} />
          <View style={[styles.backgroundCircle, styles.circleFour]} />
          <View style={[styles.backgroundCircle, styles.circleTwo]} />
          <View style={[styles.backgroundCircle, styles.circleThree]} />

          {/* Content */}
          <View style={styles.content}>
            {/* Logo - Dynamic from S3/Config */}
            <View style={styles.logoContainer}>
              {logo && typeof logo === 'string' ? (
                <Image
                  source={{uri: logo}}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : logo && typeof logo === 'function' ? (
                (() => {
                  const LogoComponent = logo;
                  return <LogoComponent width={180} height={50} />;
                })()
              ) : logo ? (
                <Image
                  source={logo}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.logoText}>{appName}</Text>
              )}
            </View>

            {/* Status Message */}
            {statusMessage ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>{statusMessage}</Text>
                {loading && (
                  <ActivityIndicator
                    color="#85F500"
                    size="small"
                    style={styles.statusLoader}
                  />
                )}
              </View>
            ) : null}

            {/* Input Field */}
            <Text style={styles.label}>Enter your Unique RA ID</Text>
            <View style={styles.inputContainer}>
              <Key
                color="rgba(100, 199, 59, 1)"
                size={16}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="XXXXXXXX1112"
                placeholderTextColor="#C8D1E1"
                value={raId}
                onChangeText={setRaId}
                keyboardType="default"
                autoCapitalize="characters"
                editable={!loading}
              />
            </View>

            {/* Create Account Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCreateAccount}
              disabled={loading}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.loadingText}>Processing...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </TouchableOpacity>

            {/* Help Text */}
            <Text style={styles.helpText}>
              Don't have an RA ID? Contact your financial advisor.
            </Text>
          </View>

          {/* Sign In Link removed - user already authenticated on previous screen */}
        </LinearGradient>
      </TouchableWithoutFeedback>
      <Modal
        transparent
        animationType="fade"
        visible={successModalVisible}
        onRequestClose={() => setSuccessModalVisible(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 10,
              padding: 24,
              alignItems: 'center',
              width: 280,
            }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                marginBottom: 10,
                color: '#29A400',
              }}>
              Account Created
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: '#222',
                textAlign: 'center',
                marginBottom: 20,
              }}>
              Your account has been created successfully!
            </Text>
            {modalLoading ? (
              <ActivityIndicator size="large" color="#29A400" />
            ) : (
              <TouchableOpacity
                onPress={async () => {
                  setModalLoading(true);
                  // add any additional async work if needed
                  await new Promise(res => setTimeout(res, 1000));
                  setModalLoading(false);
                  setSuccessModalVisible(false);
                  navigation.replace('Home');
                }}
                activeOpacity={0.7}
                hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                style={{
                  backgroundColor: '#29A400',
                  paddingHorizontal: 40,
                  paddingVertical: 14,
                  borderRadius: 8,
                  minWidth: 120,
                  minHeight: 48,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Text style={{color: '#fff', fontWeight: '600', fontSize: 16}}>
                  OK
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  backgroundCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 500,
  },
  backgroundCircleabove: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 500,
  },
  circleOne: {
    width: 350,
    height: 350,
    top: -80,
    right: -80,
  },
  circleFour: {
    width: 300,
    height: 300,
    top: -80,
    right: -80,
  },
  circleTwo: {
    width: 250,
    height: 250,
    bottom: -50,
    left: -50,
  },
  circleThree: {
    width: 250,
    height: 250,
    bottom: -100,
    left: -100,
  },
  content: {
    marginTop: 90,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
    justifyContent: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  logoImage: {
    width: 180,
    height: 50,
  },
  logoText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 22,
    letterSpacing: 1.2,
  },
  statusContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: '#85F500',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
    flex: 1,
  },
  statusLoader: {
    marginLeft: 8,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 40,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#000',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#29A400',
    borderRadius: 4,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  helpText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  signInContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  signInText: {
    color: '#fff',
    fontSize: 15,
  },
  signInLink: {
    color: '#85F500',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SignUpRADetails;
