// EmailScreenAppleLogin.js - For Apple Sign-In email collection when Apple hides email
import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Toast from 'react-native-toast-message';
import {Mail} from 'lucide-react-native';
import {useConfig} from '../../context/ConfigContext';

const EmailScreenAppleLogin = ({route}) => {
  const navigation = useNavigation();
  const config = useConfig();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get dynamic gradient colors from config
  const gradient1 = config?.gradient1 || 'rgba(0, 38, 81, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 86, 183, 1)';

  // Get the onSubmit callback from route params
  const {onSubmit} = route.params || {};

  const validateEmail = emailToValidate => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailToValidate);
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      Toast.show({
        type: 'error',
        text1: '',
        text2: 'Please enter your email address',
      });
      return;
    }

    if (!validateEmail(email)) {
      Toast.show({
        type: 'error',
        text1: '',
        text2: 'Please enter a valid email address',
      });
      return;
    }

    try {
      setIsLoading(true);

      // Call the onSubmit callback with the email
      if (onSubmit) {
        onSubmit(email.toLowerCase());
      }

      // Navigate back to the previous screen
      navigation.goBack();
    } catch (error) {
      console.error('Error submitting email:', error);
      Toast.show({
        type: 'error',
        text1: '',
        text2: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Call onSubmit with null to indicate cancellation
    if (onSubmit) {
      onSubmit(null);
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{flex: 1}}>
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Decorative background circles */}
        <View style={[styles.backgroundCircle, styles.circleOne]} />
        <View style={[styles.backgroundCircle, styles.circleTwo]} />

        <View style={styles.content}>
          <Text style={styles.title}>Enter Your Email</Text>
          <Text style={styles.subtitle}>
            We need your email address to complete the Apple Sign-In process.
            Apple has hidden your email for privacy.
          </Text>

          <View style={styles.inputContainer}>
            <Mail
              color="rgba(100, 199, 59, 1)"
              size={16}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#9E9E9E"
              value={email}
              onChangeText={text => setEmail(text.toLowerCase())}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            style={styles.submitButton}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCancel}
            style={styles.cancelButton}
            disabled={isLoading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <Toast />
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  backgroundCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 500,
  },
  circleOne: {
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
  content: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#BDCFFF',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 15,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#000',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  submitButton: {
    backgroundColor: 'rgba(41, 164, 0, 1)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    marginBottom: 15,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelButtonText: {
    color: '#BDCFFF',
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
  },
});

export default EmailScreenAppleLogin;
