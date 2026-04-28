// src/screens/ResetPasswordScreen.js
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
} from 'react-native';
import {ArrowLeft, Mail} from 'lucide-react-native';
import auth from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {Image} from 'react-native';
import {SvgUri} from 'react-native-svg';
import {useConfig} from '../../context/ConfigContext';
// --- ASSETS ---
const AlphaQuarkLogo = require('../../assets/logo.png');

const ResetPasswordScreen = () => {
  const config = useConfig();
  const {logo: LogoComponent, themeColor, mainColor, configLoading} = config || {};

  // Dynamic colors from config with fallbacks
  const gradient1 = config?.gradient1 || 'rgba(0, 38, 81, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 86, 183, 1)';
  const iconColor = mainColor || themeColor || 'rgba(100, 199, 59, 1)';

  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorShow, setErrorShow] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    console.log('🔄 handleResetPassword called');
    console.log('📧 Email entered:', email);

    setLoading(true);
    setErrorShow(false);
    setSuccess(false);

    if (!email) {
      setError('Email is required');
      setErrorShow(true);
      setLoading(false);
      return;
    }

    try {
      const trimmedEmail = email.trim();
      console.log('📤 Sending password reset email to:', trimmedEmail);
      await auth().sendPasswordResetEmail(trimmedEmail);
      console.log('✅ Password reset email sent successfully');
      setSuccess(true);
    } catch (error) {
      console.log('❌ Error sending reset email:', error.code, error.message);
      setError(error.message);
      setErrorShow(true);
    } finally {
      setLoading(false);
    }
  };

  const dismissError = () => {
    setErrorShow(false);
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{flex: 1}}>
      <TouchableWithoutFeedback onPress={dismissError}>
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={styles.container}>
          <StatusBar barStyle="light-content" />

          {/* Decorative background circles */}
          <View style={[styles.backgroundCircleabove, styles.circleOne]} />
          <View style={[styles.backgroundCircle, styles.circleFour]} />
          <View style={[styles.backgroundCircle, styles.circleTwo]} />
          <View style={[styles.backgroundCircle, styles.circleThree]} />

          <View style={styles.content}>
            {/* Back Button */}
            <TouchableOpacity
              style={{marginBottom: 20}}
              onPress={() => navigation.navigate('Login')}>
              <ArrowLeft size={22} color="#fff" />
            </TouchableOpacity>

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
                {' '}
                {config?.REACT_APP_WHITE_LABEL_TEXT}
              </Text>
            </View>

            {/* Title */}
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your registered email to reset your password
            </Text>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Mail
                color={iconColor}
                size={16}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#9E9E9E"
                value={email}
                onChangeText={text => setEmail(text.toLowerCase())}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Messages */}
            {success && (
              <Text style={styles.successText}>
                Password reset email sent successfully.
              </Text>
            )}
            {loading && (
              <ActivityIndicator
                size="large"
                color="#FFFFFF"
                style={styles.loader}
              />
            )}
            {errorShow && <Text style={styles.errorText}>{error}</Text>}

            {/* Reset Button */}
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetPassword}
              disabled={loading}>
              <Text style={styles.resetButtonText}>Send Link</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  inputIcon: {
    marginRight: 10,
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
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 10,
    textAlign: 'left',
  },
  subtitle: {
    color: '#BDCFFF',
    fontSize: 12,
    marginBottom: 25,
    textAlign: 'left',
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
  input: {
    height: '100%',
    color: '#000',
    fontSize: 13,
  },
  resetButton: {
    backgroundColor: 'rgba(41, 164, 0, 1)',
    paddingVertical: 5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    height: 45,
    marginTop: 15,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  successText: {
    color: '#16A085',
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 13,
  },
  errorText: {
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 13,
  },
  loader: {
    marginVertical: 10,
  },
});

export default ResetPasswordScreen;
