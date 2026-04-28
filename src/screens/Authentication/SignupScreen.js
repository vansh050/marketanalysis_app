// src/screens/SignupScreen.js
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import auth from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';
import {Mail, Lock, Eye, CheckIcon, User} from 'lucide-react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import {SvgUri} from 'react-native-svg';
import {useConfig} from '../../context/ConfigContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
// Import enhanced storage utilities
import {
  checkAndFetchAdvisorConfig,
  setUserData,
  refreshAllAppData,
  isUserDataComplete,
  updateRACodeAndConfig,
  tryResolveAdvisor,
} from '../../utils/storageUtils';
const { width: ScreenWidth } = Dimensions.get('window');
import {
  logLoginAttempt,
  trackAppUser,
} from '../../FunctionCall/services/LoginLoggingService';

// Assets
const AlphaQuarkLogo = require('../../assets/logo.png');

const SignupScreen = () => {
  const {
    reloadConfigData,
    setIsProfileCompleted,
    getAllTrades,
    getModelPortfolioStrategyDetails,
  } = useTrade();

  const config = useConfig();
  const {logo: LogoComponent, themeColor, configLoading} = config || {};

  // Get dynamic gradient colors from config
  const gradient1 = config?.gradient1 || 'rgba(0, 38, 81, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 86, 183, 1)';

  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorShow, setErrorShow] = useState(false);
  const [success, setSuccess] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const storeLoginTime = async () => {
    try {
      const now = moment().toISOString();
      await AsyncStorage.setItem('lastActiveTime', now);
      console.log('⏰ Login time stored:', now);
    } catch (error) {
      console.error('❌ Error storing login time:', error);
    }
  };

  // ENHANCED navigation handler with better synchronization (like ChangeAdvisor)
  const handlePostSignupNavigation = async (userDetails, userEmail) => {
    try {
      console.log('🚀 Starting ENHANCED post-signup navigation process');
      console.log(
        '👤 User Details:',
        JSON.stringify(userDetails?.data?.User, null, 2),
      );

      const hasAdvisorRaCode = Config?.ADVISOR_RA_CODE
        ? Config?.ADVISOR_RA_CODE
        : !!userDetails?.data?.User?.advisor_ra_code;
      console.log('✅ Has advisor_ra_code:', hasAdvisorRaCode);

      setIsProfileCompleted(hasAdvisorRaCode);
      await storeLoginTime();

      if (hasAdvisorRaCode) {
        // User has advisor_ra_code (unlikely for new signup, but possible)
        const advisorRaCode = Config?.ADVISOR_RA_CODE
          ? Config?.ADVISOR_RA_CODE
          : userDetails.data.User.advisor_ra_code;
        console.log('✨ New user already has advisor_ra_code:', advisorRaCode);

        // Store user data first
        await setUserData({
          email: userEmail,
          advisor_ra_code: advisorRaCode,
          profileCompleted: true,
          ...userDetails.data.User,
        });

        console.log('⏳ Checking and fetching advisor config...');

        // Use centralized config checking and fetching
        const configResult = await checkAndFetchAdvisorConfig(advisorRaCode);

        if (configResult.success) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const refreshResult = await refreshAllAppData();
          await reloadConfigData();
          if (refreshResult.isComplete) {
            await getAllTrades();
            await getModelPortfolioStrategyDetails();
            await new Promise(resolve => setTimeout(resolve, 500));
            navigation.replace('Home');
          } else {
            await getAllTrades();
            await getModelPortfolioStrategyDetails();
            navigation.replace('Home');
          }
        } else {
          if (configResult.advisorExists === false) {
            navigation.replace('SignUpRADetails', {
              userEmail: userEmail,
            });
          } else {
            await getAllTrades();
            await getModelPortfolioStrategyDetails();
            navigation.replace('Home');
          }
        }
      } else {
        // Store basic user data before navigation
        await setUserData({
          email: userEmail,
          profileCompleted: false,
          ...userDetails?.data?.User,
        });

        // Try to auto-resolve advisor from central mapping
        const resolveResult = await tryResolveAdvisor(userEmail);
        if (resolveResult.resolved) {
          console.log('🎯 Auto-resolved advisor for new signup:', resolveResult.advisor_ra_code);
          const configResult = await updateRACodeAndConfig(
            resolveResult.advisor_ra_code,
            userEmail,
          );
          if (configResult.success) {
            await reloadConfigData();
            getAllTrades().catch(err => console.error('Trade load error:', err));
            getModelPortfolioStrategyDetails().catch(err => console.error('Portfolio load error:', err));
            navigation.replace('Home');
            return;
          }
        }

        await getModelPortfolioStrategyDetails();
        navigation.replace('SignUpRADetails', {
          userEmail: userEmail,
        });
      }
    } catch (error) {
      // Still navigate to prevent app from being stuck
      await getModelPortfolioStrategyDetails();
      navigation.replace('SignUpRADetails', {
        userEmail: userEmail,
      });
    }
  };

  const handleSignup = async () => {
    if (!isChecked) {
      showToast();
      return;
    }

    setLoading(true);
    setErrorShow(false);

    if (!email || !password) {
      setError('Both fields are required');
      setErrorShow(true);
      setLoading(false);
      return;
    }

    if (!name || name.trim().length < 2) {
      setError('Please enter a valid name');
      setErrorShow(true);
      setLoading(false);
      return;
    }

    try {
      console.log('🔐 Creating Firebase user...');
      const response = await auth().createUserWithEmailAndPassword(
        email,
        password,
      );

      if (response) {
        const user = response.user;
        console.log('✅ Firebase user created successfully');

        console.log('👤 Creating user in database...');
        await axios.post(
          `${server.server.baseUrl}api/user/`,
          {
            email: user.email,
            name: name.trim() || user?.displayName || '',
            firebaseId: user.uid,
            phoneNumber: 0,
            telegramId: '',
            profileCompletion: 50,
            user_onBoard_from: Config?.REACT_APP_WHITE_LABEL_TEXT,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getAdvisorSubdomain(), // Fixed: use getAdvisorSubdomain() instead of dynamic header
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );

        console.log('✅ User created in database successfully');
        console.log('👤 Getting user details from API...');

        const userDetails = await axios.get(
          `${server.server.baseUrl}api/user/getUser/${user.email}`,
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

        console.log('✅ User details retrieved successfully');

        // Log successful signup (fire-and-forget)
        trackAppUser({
          email: user.email,
          firebase_id: user.uid,
          name: name.trim() || user.displayName,
          login_method: 'email',
        });
        logLoginAttempt({
          email: user.email,
          firebase_id: user.uid,
          status: 'success',
          login_method: 'email',
        });

        // Use enhanced navigation handler
        await handlePostSignupNavigation(userDetails, email);
      }
    } catch (error) {
      console.error('❌ Signup error:', error);

      // Log failed signup attempt (fire-and-forget)
      logLoginAttempt({
        email: email || 'unknown',
        status: 'failed',
        login_method: 'email',
        failure_reason: error.code?.includes('auth/') ? 'firebase_error' : 'api_error',
        error_message: error.message,
        error_code: error.code,
      });

      // Enhanced error handling
      let errorMessage = 'Failed to create account';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage =
          'This email is already registered. Please use a different email or sign in.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.response?.status === 409) {
        errorMessage = 'An account with this email already exists.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setErrorShow(true);
    } finally {
      setLoading(false);
    }
  };

  const dismissError = () => {
    setErrorShow(false);
    Keyboard.dismiss();
  };

  const showToast = () => {
    Toast.show({
      type: 'error',
      text1: '',
      text2: 'Please agree to the Terms & Conditions',
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{flex: 1,
         justifyContent: 'space-between',
      }}>
      <TouchableWithoutFeedback onPress={dismissError}>
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
         style={[styles.container, {justifyContent: 'space-between'}]}>
          <StatusBar barStyle="light-content" />

          {/* Decorative Circles */}
          <View style={[styles.backgroundCircleabove, styles.circleOne]} />
          <View style={[styles.backgroundCircle, styles.circleFour]} />
          <View style={[styles.backgroundCircle, styles.circleTwo]} />
          <View style={[styles.backgroundCircle, styles.circleThree]} />

          <View style={styles.content}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              {configLoading ? (
                <View style={styles.logo} />
              ) : LogoComponent && typeof LogoComponent === 'function' ? (
                <LogoComponent style={styles.logo} />
              ) : LogoComponent && typeof LogoComponent === 'string' && LogoComponent.endsWith('.svg') ? (
                <SvgUri
                  uri={LogoComponent}
                  width={styles.logo.width}
                  height={styles.logo.height}
                />
              ) : LogoComponent && typeof LogoComponent === 'string' ? (
                <Image
                  source={{uri: LogoComponent}}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : LogoComponent && typeof LogoComponent === 'object' && LogoComponent.uri ? (
                <Image
                  source={{uri: LogoComponent.uri}}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : LogoComponent && typeof LogoComponent === 'object' ? (
                <Image
                  source={LogoComponent}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : (
                <Image
                  source={AlphaQuarkLogo}
                  style={styles.logo}
                  resizeMode="contain"
                />
              )}

              <Text style={styles.logoText}>
                {Config?.REACT_APP_WHITE_LABEL_TEXT}
              </Text>
            </View>

            <View style={{alignItems: 'flex-start'}}>
              <Text style={styles.title}>
                Step into the Future with {Config?.REACT_APP_WHITE_LABEL_TEXT}!
              </Text>
              <View style={styles.underline} />
            </View>
            <Text style={styles.subtitle}>
              It only takes a minute to create your account
            </Text>

            {/* Name Input */}
            <View style={styles.inputContainer}>
              <User
                color="rgba(100, 199, 59, 1)"
                size={16}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#9E9E9E"
                value={name}
                onChangeText={setName}
                keyboardType="default"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Mail
                color="rgba(100, 199, 59, 1)"
                size={16}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#9E9E9E"
                value={email}
                onChangeText={text => setEmail(text.toLowerCase().trim())}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Lock
                color="rgba(100, 199, 59, 1)"
                size={16}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9E9E9E"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                <Eye color="#9E9E9E" size={20} />
              </TouchableOpacity>
            </View>

            {/* Terms & Conditions */}
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkboxWrapper}
                onPress={() => setIsChecked(!isChecked)}>
                <View style={styles.checkbox}>
                  {isChecked && (
                    <CheckIcon
                      size={14}
                      color={'rgba(0, 86, 183, 1)'}
                      style={{alignSelf: 'center'}}
                    />
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.tcTextContainer}>
                <Text style={styles.tcText}>
                  I agree to the {Config?.REACT_APP_WHITE_LABEL_TEXT}{' '}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Terms & Conditions')}>
                  <Text style={styles.tcText2}>Terms of Service</Text>
                </TouchableOpacity>
                <Text style={styles.tcText}> and </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Privacy Policy')}>
                  <Text style={styles.tcText2}>Privacy Policy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Loading Indicator */}
            {loading && (
              <ActivityIndicator
                size="large"
                color="#FFFFFF"
                style={styles.loader}
              />
            )}

            {/* Error Message */}
            {errorShow && <Text style={styles.errorText}>{error}</Text>}

            {/* Success Message */}
            {success && <Text style={styles.successText}>{success}</Text>}

            {/* Signup Button */}
            <TouchableOpacity
              style={[
                styles.signupButton,
                loading && styles.signupButtonDisabled,
              ]}
              onPress={handleSignup}
              disabled={loading}>
              <Text style={styles.signupButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Already have account */}


          <Toast />
              <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={loading}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableWithoutFeedback>

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
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1.5,
    fontFamily: Platform.select({
      ios: 'Azonix',
      android: 'Azonix',
      default: 'System',
    }),
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'left',
  },
  underline: {
    height: 2,
    width: '100%',
    backgroundColor: '#0D47A1',
    marginTop: 4,
  },
  subtitle: {
    color: '#BDCFFF',
    fontSize: 12,
    marginBottom: 35,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxWrapper: {
    marginRight: 10,
  },
  checkbox: {
    width: 15,
    height: 15,
    borderWidth: 1,
    borderRadius: 0,
    borderColor: 'white',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tcTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
    marginLeft: 5,
  },
  tcText: {
    color: '#fff',
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
  },
  tcText2: {
    color: 'rgba(133, 245, 0, 1)',
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  signupButton: {
    backgroundColor: 'rgba(41, 164, 0, 1)',
    paddingVertical: 5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    height: 45,
  },
  signupButtonDisabled: {
    backgroundColor: 'rgba(41, 164, 0, 0.6)',
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  loginContainer: {
   marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  loginLink: {
    color: 'rgba(133, 245, 0, 1)',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    marginLeft: 5,
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
    paddingHorizontal: 10,
  },
  successText: {
    color: 'lightgreen',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },
  loader: {
    marginVertical: 10,
  },
});

export default SignupScreen;
