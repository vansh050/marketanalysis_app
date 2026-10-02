import React, {useEffect, useRef, useState} from 'react';
import {Keyboard} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import {getAuth} from '@react-native-firebase/auth';

import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import {getTenantSubdomain} from '../../utils/variantHelper';
import {useComponent} from '../../design/useDesign';

const EMPTY_OTP = ['', '', '', '', '', ''];

const UpdateEmailScreen = () => {
  const navigation = useNavigation();
  const {getUserDeatils, userDetails} = useTrade();
  const currentEmail = getAuth().currentUser?.email || userDetails?.email || '';
  const Presentation = useComponent('screens.UpdateEmailScreen');
  const [newEmail, setNewEmail] = useState('');
  const [otpArray, setOtpArray] = useState(EMPTY_OTP);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputs = useRef([]);

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const interval = setInterval(() => setResendTimer(previous => previous - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const showToast = (message, type = 'error') => Toast.show({type, text2: message, position: 'top'});
  const headers = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(),
    'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
  });

  const handleSendOtp = async () => {
    if (!newEmail.trim()) return showToast('Please enter your new email address');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return showToast('Please enter a valid email address');
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) return showToast('New email must be different from current email');
    setLoading(true);
    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/user/send-email-update-otp`,
        {currentEmail, newEmail: newEmail.toLowerCase()},
        {headers: headers()},
      );
      if (response.data.success) {
        setStep(2);
        setResendTimer(60);
        showToast('OTP sent to your new email address', 'success');
      } else showToast(response.data.message || 'Failed to send OTP');
    } catch (error) {
      console.error('Send OTP error:', error);
      showToast(error.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpArray.join('');
    if (otp.length < 6) return showToast('Please enter the complete 6-digit OTP');
    setLoading(true);
    try {
      const response = await axios.post(
        `${server.server.baseUrl}api/user/verify-email-update-otp`,
        {currentEmail, newEmail: newEmail.toLowerCase(), otp},
        {headers: headers()},
      );
      if (response.data.success) {
        setStep(3);
        showToast('Email updated successfully!', 'success');
        getUserDeatils?.();
      } else showToast(response.data.message || 'Invalid OTP');
    } catch (error) {
      console.error('Verify OTP error:', error);
      showToast(error.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value, index) => {
    setOtpArray(current => current.map((item, itemIndex) => itemIndex === index ? value : item));
    if (value && index < 5) otpInputs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  return (
    <Presentation
      viewModel={{currentEmail, newEmail, otpArray, step, loading, resendTimer, otpInputs}}
      actions={{
        onEmailChange: text => setNewEmail(text.toLowerCase()),
        onSendOtp: handleSendOtp,
        onVerifyOtp: handleVerifyOtp,
        onOtpChange: handleOtpChange,
        onOtpKeyPress: handleOtpKeyPress,
        onResendOtp: () => {
          if (resendTimer === 0) {
            setOtpArray(EMPTY_OTP);
            handleSendOtp();
          }
        },
        onChangeEmail: () => {
          setStep(1);
          setOtpArray(EMPTY_OTP);
        },
        onBack: () => navigation.goBack(),
        onDismissKeyboard: Keyboard.dismiss,
      }}
      slots={{Toast}}
    />
  );
};

export default UpdateEmailScreen;
