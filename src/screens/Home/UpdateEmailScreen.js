import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ArrowLeft, Mail, CheckCircle} from 'lucide-react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import server from '../../utils/serverConfig';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import {getAuth} from '@react-native-firebase/auth';
import {useTrade} from '../TradeContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';

const UpdateEmailScreen = () => {
  const navigation = useNavigation();
  const {getUserDeatils, userDetails} = useTrade();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const currentEmail = currentUser?.email || userDetails?.email || '';

  // States
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState(1); // 1: Enter email, 2: Verify OTP, 3: Success
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpSent, setOtpSent] = useState(false);

  // OTP input refs
  const otpInputs = useRef([]);

  // Resend timer countdown
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validateEmail = email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const showToast = (message, type = 'error') => {
    Toast.show({
      type: type,
      text2: message,
      position: 'top',
    });
  };

  // Send OTP to new email
  const handleSendOtp = async () => {
    if (!newEmail.trim()) {
      showToast('Please enter your new email address');
      return;
    }

    if (!validateEmail(newEmail)) {
      showToast('Please enter a valid email address');
      return;
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      showToast('New email must be different from current email');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/user/send-email-update-otp`,
        {
          currentEmail: currentEmail,
          newEmail: newEmail.toLowerCase(),
        },
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

      if (response.data.success) {
        setOtpSent(true);
        setStep(2);
        setResendTimer(60);
        showToast('OTP sent to your new email address', 'success');
      } else {
        showToast(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      const errorMessage =
        error.response?.data?.message ||
        'Failed to send OTP. Please try again.';
      showToast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and update email
  const handleVerifyOtp = async () => {
    const otpValue = otpArray.join('');
    if (otpValue.length < 6) {
      showToast('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/user/verify-email-update-otp`,
        {
          currentEmail: currentEmail,
          newEmail: newEmail.toLowerCase(),
          otp: otpValue,
        },
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

      if (response.data.success) {
        setStep(3);
        showToast('Email updated successfully!', 'success');
        // Refresh user details
        if (getUserDeatils) {
          getUserDeatils();
        }
      } else {
        showToast(response.data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to verify OTP';
      showToast(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input
  const handleOtpChange = (value, index) => {
    const newOtpArray = [...otpArray];
    newOtpArray[index] = value;
    setOtpArray(newOtpArray);
    setOtp(newOtpArray.join(''));

    // Move to next input
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // Resend OTP
  const handleResendOtp = () => {
    if (resendTimer === 0) {
      setOtpArray(['', '', '', '', '', '']);
      setOtp('');
      handleSendOtp();
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Render Step 1: Enter new email
  const renderEmailInput = () => (
    <>
      <Text style={styles.title}>Update Email Address</Text>
      <Text style={styles.subtitle}>
        Enter your new email address. We'll send a verification code to confirm
        it's yours.
      </Text>

      <View style={styles.currentEmailContainer}>
        <Text style={styles.currentEmailLabel}>Current Email</Text>
        <Text style={styles.currentEmailValue}>{currentEmail}</Text>
      </View>

      <View style={styles.inputContainer}>
        <Mail color="#0056B7" size={20} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Enter new email address"
          placeholderTextColor="#9CA3AF"
          value={newEmail}
          onChangeText={text => setNewEmail(text.toLowerCase())}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={true}
        />
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSendOtp}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Send Verification Code</Text>
        )}
      </TouchableOpacity>
    </>
  );

  // Render Step 2: Verify OTP
  const renderOtpVerification = () => (
    <>
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to{'\n'}
        <Text style={styles.emailHighlight}>{newEmail}</Text>
      </Text>

      <View style={styles.otpContainer}>
        {[0, 1, 2, 3, 4, 5].map(index => (
          <TextInput
            key={index}
            ref={ref => (otpInputs.current[index] = ref)}
            style={styles.otpInput}
            maxLength={1}
            keyboardType="number-pad"
            value={otpArray[index]}
            onChangeText={value => handleOtpChange(value, index)}
            onKeyPress={e => handleOtpKeyPress(e, index)}
          />
        ))}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleVerifyOtp}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Verify & Update Email</Text>
        )}
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        <TouchableOpacity
          onPress={handleResendOtp}
          disabled={resendTimer > 0}>
          <Text
            style={[
              styles.resendLink,
              resendTimer > 0 && styles.resendLinkDisabled,
            ]}>
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend'}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.changeEmailButton}
        onPress={() => {
          setStep(1);
          setOtpArray(['', '', '', '', '', '']);
          setOtp('');
        }}>
        <Text style={styles.changeEmailText}>Change email address</Text>
      </TouchableOpacity>
    </>
  );

  // Render Step 3: Success
  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <CheckCircle color="#10B981" size={80} />
      <Text style={styles.successTitle}>Email Updated!</Text>
      <Text style={styles.successSubtitle}>
        Your email has been successfully updated to{'\n'}
        <Text style={styles.emailHighlight}>{newEmail}</Text>
      </Text>
      <Text style={styles.successNote}>
        All future notifications and recommendations will be sent to this email.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.goBack()}>
        <Text style={styles.primaryButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}>
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Update Email</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {step === 1 && renderEmailInput()}
            {step === 2 && renderOtpVerification()}
            {step === 3 && renderSuccess()}
          </View>

          <Toast />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#000',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginBottom: 32,
    lineHeight: 22,
  },
  emailHighlight: {
    fontFamily: 'Poppins-SemiBold',
    color: '#0056B7',
  },
  currentEmailContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  currentEmailLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
    marginBottom: 4,
  },
  currentEmailValue: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#111827',
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
  },
  primaryButton: {
    backgroundColor: '#0056B7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
  resendLink: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#0056B7',
  },
  resendLinkDisabled: {
    color: '#9CA3AF',
  },
  changeEmailButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  changeEmailText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  successNote: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
});

export default UpdateEmailScreen;
