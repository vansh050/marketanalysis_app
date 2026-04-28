import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import axios from 'axios';
import {getAuth} from '@react-native-firebase/auth';
import LogoSection from '../../components/LogoSection';
import server from '../../utils/serverConfig';
import Toast from 'react-native-toast-message';
import {useTrade} from '../TradeContext';
import CountryCodeDropdownPicker from 'react-native-dropdown-country-picker';

import {generateToken} from '../../utils/SecurityTokenManager';
import {useConfig} from '../../context/ConfigContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';

const PhoneNumberScreen = () => {
  const config = useConfig();
  const {logo: LogoComponent, themeColor} = config || {};
  const advisorName = config?.appName || config?.apiKeys?.advisorSpecificTag || getAdvisorSubdomain();

  const {userEmail, setIsProfileCompleted} = useTrade();
  const navigation = useNavigation();
  const [countryCode, setSelected] = React.useState('+91');
  const [country, setCountry] = React.useState('');
  const [phoneNumber, setPhone] = React.useState('');
  const [showTelegram, setShowTelegram] = useState(false); // Telegram flag
  const [userTelegram, setUserTelegram] = useState(''); // Example telegram ID

  const auth = getAuth();
  const user = auth.currentUser;
  // const userEmail = user?.email;

  const showToast = (message1, type, message2) => {
    Toast.show({
      type: type,
      text2: message2 + ' ' + message1,
      //position:'bottom',
      position: 'top', // Duration the toast is visible
      text1Style: {
        color: 'black',
        fontSize: 11,
        fontWeight: 0,
        fontFamily: 'Poppins-Medium', // Customize your font
      },
      text2Style: {
        color: 'black',
        fontSize: 12,
        fontFamily: 'Poppins-Regular', // Customize your font
      },
    });
  };

  const calculateProfileCompletion = (
    email,
    name,
    phone,
    telegram = false,
    telegramId = '',
  ) => {
    let completedFields = 0;
    let totalFields = 3; // email, name, phone are required

    if (email) completedFields++;
    if (name) completedFields++;
    if (phone) completedFields++;
    if (telegram && telegramId) completedFields++;
    console.log('Complete :', completedFields, totalFields);
    return Math.round((completedFields / totalFields) * 100);
  };

  const [isLoading, setIsLoading] = useState(false);

  const [userName, setUserName] = useState('');
  const handleProceed = async () => {
    try {
      if (!phoneNumber.trim()) {
        Toast.show({
          type: 'error',
          text1: '',
          text2: 'Please enter a phone number.',
        });
        return;
      }
      if (
        phoneNumber.length !== 9 &&
        phoneNumber.length !== 10 &&
        phoneNumber.length !== 11
      ) {
        Toast.show({
          type: 'error',
          text1: '',
          text2: 'Phone number must be between 9 and 11 numbers.',
        });
        return;
      }

      setIsLoading(true); // Start loading

      const profileCompletion = calculateProfileCompletion(
        userEmail,
        userName,
        phoneNumber,
        showTelegram,
        showTelegram ? userTelegram : '',
      );

      const response = await axios.put(
        `${server.server.baseUrl}api/user/update-profile`,
        {
          email: userEmail,
          advisorName,
          phoneNumber,
          countryCode,
          telegramId: showTelegram ? userTelegram : '',
          userName,
          profileCompletion,
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

      if (response.status === 200) {
        setIsProfileCompleted(true);
        showToast('Phone Number Updated Successfully', 'success', '');
        navigation.navigate('Home');
      } else {
        Toast.show({
          type: 'error',
          text1: '',
          text2: 'Something went wrong. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Toast.show({
        type: 'error',
        text1: '',
        text2: 'Failed to update profile.',
      });
    } finally {
      setIsLoading(false); // Stop loading
    }
  };

  return (
    <View style={{flex: 1}}>
      <View style={styles.container}>
        <LogoSection />
        <CountryCodeDropdownPicker
          selected={countryCode}
          setSelected={setSelected}
          setCountryDetails={setCountry}
          phone={phoneNumber}
          searchTextStyles={{color: 'black', fontSize: 14}}
          phoneStyles={{
            padding: 0,
            color: 'black',
            fontFamily: 'Satoshi-Medium',
          }}
          countryCodeContainerStyles={{padding: 8}}
          setPhone={setPhone}
          dropdownTextStyles={{color: 'black', fontFamily: 'Satoshi-Medium'}}
          countryCodeTextStyles={{
            fontSize: 13,
            fontFamily: 'Satoshi-Medium',
            color: 'black',
          }}
        />
        <TouchableOpacity
          onPress={handleProceed}
          style={styles.button}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Proceed</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 50,
    backgroundColor: '#fff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignContent: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 10,
    width: '50%',
    marginTop: 20,
    borderRadius: 5,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  orText: {
    color: '#9ca2ae',
    textAlign: 'center',
    marginVertical: 10,
  },
  input: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    color: '#000101',
    marginBottom: 15,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  signupTextBold: {
    color: '#010100',
    textAlign: 'center',
    marginTop: 20,
    textDecorationLine: 'underline',
    fontWeight: 'bold',
  },
  forgotPassword: {
    color: '#656564',
    textAlign: 'center',
    marginBottom: 20,
  },
  signupText: {
    color: '#656564',
    textAlign: 'center',
    marginTop: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default PhoneNumberScreen;
