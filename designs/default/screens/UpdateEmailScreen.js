import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {ArrowLeft, Mail, CheckCircle} from 'lucide-react-native';
import {designColor, designFont} from '../../../src/design/literalTokens';

const UpdateEmailScreen = ({viewModel, actions, slots}) => {
  const {currentEmail, newEmail, otpArray, step, loading, resendTimer, otpInputs} = viewModel;
  const {Toast} = slots;

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
        <Mail color={designColor('0056b7')} size={20} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Enter new email address"
          placeholderTextColor={designColor('9ca3af')}
          value={newEmail}
          onChangeText={actions.onEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={true}
        />
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={actions.onSendOtp}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color={designColor('fff')} />
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
            onChangeText={value => actions.onOtpChange(value, index)}
            onKeyPress={event => actions.onOtpKeyPress(event, index)}
          />
        ))}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={actions.onVerifyOtp}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color={designColor('fff')} />
        ) : (
          <Text style={styles.primaryButtonText}>Verify & Update Email</Text>
        )}
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        <Text style={styles.resendText}>Didn't receive the code? </Text>
        <TouchableOpacity
          onPress={actions.onResendOtp}
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
        onPress={actions.onChangeEmail}>
        <Text style={styles.changeEmailText}>Change email address</Text>
      </TouchableOpacity>
    </>
  );

  // Render Step 3: Success
  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <CheckCircle color={designColor('10b981')} size={80} />
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
        onPress={actions.onBack}>
        <Text style={styles.primaryButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={actions.onDismissKeyboard}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={actions.onBack}>
              <ArrowLeft size={24} color={designColor('000')} />
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
    backgroundColor: designColor('fff'),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: designColor('f0f0f0'),
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('000'),
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
    fontFamily: designFont('Poppins-Bold'),
    color: designColor('000'),
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('6b7280'),
    marginBottom: 32,
    lineHeight: 22,
  },
  emailHighlight: {
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('0056b7'),
  },
  currentEmailContainer: {
    backgroundColor: designColor('f3f4f6'),
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  currentEmailLabel: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('6b7280'),
    marginBottom: 4,
  },
  currentEmailValue: {
    fontSize: 16,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('111827'),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: designColor('f9fafb'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
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
    color: designColor('111827'),
    fontSize: 16,
    fontFamily: designFont('Poppins-Medium'),
  },
  primaryButton: {
    backgroundColor: designColor('0056b7'),
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: designColor('fff'),
    fontSize: 16,
    fontFamily: designFont('Poppins-SemiBold'),
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
    borderColor: designColor('e5e7eb'),
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: designFont('Poppins-Bold'),
    color: designColor('111827'),
    backgroundColor: designColor('f9fafb'),
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('6b7280'),
  },
  resendLink: {
    fontSize: 14,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('0056b7'),
  },
  resendLinkDisabled: {
    color: designColor('9ca3af'),
  },
  changeEmailButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  changeEmailText: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('6b7280'),
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
    fontFamily: designFont('Poppins-Bold'),
    color: designColor('111827'),
    marginTop: 24,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('6b7280'),
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  successNote: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('9ca3af'),
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
});

export default UpdateEmailScreen;
