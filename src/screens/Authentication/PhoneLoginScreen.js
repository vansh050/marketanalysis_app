import React, {useState} from 'react';
import {Keyboard, Platform} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import TermsModal from './TermsModal';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useConfig} from '../../context/ConfigContext';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import useTokens from '../../theme/useTokens';
import {normalizePaymentPhone} from '../../utils/paymentPhone';
import {useComponent} from '../../design/useDesign';
import {designColor} from '../../design/literalTokens';

const PhoneLoginScreen = () => {
  const navigation = useNavigation();
  const config = useConfig();
  const tokens = useTokens();
  const Presentation = useComponent('screens.PhoneLoginScreen');
  const [countryCode, setCountryCode] = useState('+91');
  const [country, setCountry] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const showToast = (message, type = 'error') => Toast.show({
    type,
    text1: '',
    text2: message,
    position: 'top',
  });

  const handleContinue = async () => {
    if (!isChecked) {
      showToast('Please agree to the Terms & Conditions');
      return;
    }
    const normalizedPhone = normalizePaymentPhone(phoneNumber, countryCode);
    if (!normalizedPhone.e164) {
      showToast('Please enter a valid phone number');
      return;
    }
    const advisorName = config?.appName || config?.apiKeys?.advisorSpecificTag || getAdvisorSubdomain();
    try {
      let fcmToken = await AsyncStorage.getItem('fcm_token');
      if (!fcmToken) {
        try {
          fcmToken = await messaging().getToken();
          await AsyncStorage.setItem('fcm_token', fcmToken);
        } catch (error) {
          console.error('Failed to get FCM token:', error);
        }
      }
      if (fcmToken) {
        await axios.post(
          `${server.server.baseUrl}api/user/save-contact`,
          {
            phoneNumber: normalizedPhone.nationalNumber,
            countryCode: parseInt(normalizedPhone.countryCode.replace(/\+/g, ''), 10),
            fcmToken,
            advisorName,
            deviceInfo: {
              platform: Platform.OS,
              os_version: Platform.Version?.toString() || 'unknown',
              app_version: DeviceInfo.getVersion(),
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(),
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
          },
        );
      }
    } catch (error) {
      console.error('Failed to save contact:', error);
    }
    navigation.replace('Login', {
      phoneNumber: normalizedPhone.e164,
      countryCode: normalizedPhone.countryCode,
      phoneVerified: true,
    });
  };

  return (
    <Presentation
      viewModel={{
        LogoComponent: config?.logo,
        logoPng: tokens?.assets?.logoPng,
        gradient1: config?.gradient1 || designColor('1a1a2e'),
        gradient2: config?.gradient2 || designColor('16213e'),
        whiteLabelText: config?.whiteLabelText || config?.appName || 'AlphaQuark',
        countryCode,
        country,
        phoneNumber,
        isChecked,
        modalVisible,
      }}
      actions={{
        onCountryCodeChange: setCountryCode,
        onCountryChange: setCountry,
        onPhoneChange: setPhoneNumber,
        onToggleTerms: () => setIsChecked(value => !value),
        onOpenTerms: () => setModalVisible(true),
        onModalVisibleChange: setModalVisible,
        onTermsChange: setIsChecked,
        onContinue: handleContinue,
        onDismissKeyboard: Keyboard.dismiss,
      }}
      slots={{TermsModal, Toast}}
    />
  );
};

export default PhoneLoginScreen;
