import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Modal from 'react-native-modal';
import {WebView} from 'react-native-webview';
import {XIcon, ChevronLeft} from 'lucide-react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import {getAuth} from '@react-native-firebase/auth';
import {generateToken} from '../utils/SecurityTokenManager';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTrade} from '../screens/TradeContext';
import {getAdvisorSubdomain} from '../utils/variantHelper';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');
const commonHeight = screenHeight * 0.06;
const commonWidth = '100%';

const IIFLModal = ({isVisible, onClose, fetchBrokerStatusModal}) => {
  const {configData} = useTrade();
  const [authUrl, setAuthUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const webViewRef = useRef(null); // Reference for the WebView

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  useEffect(() => {
    if (isVisible && userEmail) {
      fetchUserEmailAndId();
      const redirectUrl =
        configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL.replace(
          'https://',
          '',
        );
      const iiflUrl = `https://markets.iiflcapital.com/?v=1&appkey=nHjYctmzvrHrYWA&redirect_url=${redirectUrl}`;
      console.log('iifl ___', iiflUrl);
      setAuthUrl(iiflUrl);
    }
  }, [isVisible, userEmail]);

  const fetchUserEmailAndId = async () => {
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/user/getUser/${userEmail}`,
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
      if (response.data && response.data.User) {
        // Handle the user info here if needed
      } else {
        console.error('Profile data not found in response');
      }
    } catch (error) {
      console.error('Error fetching user email and id:', error.message);
    }
  };

  const handleWebViewNavigationStateChange = newNavState => {
    const {url} = newNavState;
    console.log('url oi--:', url);
    if (url.includes('auth_token=')) {
      const queryParams = parseQueryString(url.split('?')[1]);
      const sessionToken = queryParams.auth_token;
      const clientId = queryParams.clientid;

      if (sessionToken && clientId) {
        handleIIFLLogin(sessionToken, clientId);
      }
    }
  };

  const handleIIFLLogin = async (authCode, clientId) => {
    if (!authCode || !clientId) return;

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}/iifl/login/client`,
        {
          user_email: userEmail,
          auth_token: authCode,
          client_code: clientId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );

      const accessToken = response.data.sessionToken;
      // Handle storing the access token
      AsyncStorage.setItem('iiflAccessToken', accessToken);
      AsyncStorage.setItem('iiflClientCode', clientId);

      Toast.show({
        type: 'success',
        text1: 'Successfully connected to IIFL',
      });
      // Re-hydrate funds + brokerStatus in TradeContext so the next
      // pre-trade check doesn't re-fire the reconnect modal with stale
      // pre-reconnect state. Same pattern every other broker modal
      // uses on connect-success — IIFL was the lone holdout.
      if (typeof fetchBrokerStatusModal === 'function') {
        try {
          fetchBrokerStatusModal();
        } catch (e) {
          console.warn('[IIFL] fetchBrokerStatusModal failed:', e?.message);
        }
      }
      onClose(); // Close the modal after success
    } catch (error) {
      console.error('IIFL Login failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to connect with IIFL',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const parseQueryString = queryString => {
    const params = {};
    const pairs = queryString.split('&');
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      params[key] = value;
    });
    return params;
  };

  const handleClose = () => {
    onClose();
    setAuthUrl('');
    // Update the state to reflect the sheet is closed
    onClose(); // Call the parent onClose function
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      style={styles.modal}
      backdropOpacity={0.1}
      useNativeDriver
      animationIn="slideInUp"
      animationOut="slideOutDown"
      onSwipeComplete={onClose}>
      <SafeAreaView style={styles.modalContent}>
        <View style={styles.header}>
          <ChevronLeft
            size={24}
            color={'black'}
            onPress={handleClose}
            style={{top: 10, right: 0}}
          />
          <View style={styles.handleIndicator} />
          <TouchableOpacity onPress={onClose} style={{top: 10, right: 10}}>
            <XIcon size={24} color="#000" />
          </TouchableOpacity>
        </View>
        <ScrollView
          nestedScrollEnabled
          contentContainerStyle={styles.content}
          indicatorStyle="black">
          <View style={styles.sheetContent}>
            <WebView
              source={{uri: authUrl}}
              style={styles.webView}
              nestedScrollEnabled
              onNavigationStateChange={handleWebViewNavigationStateChange}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 10,
  },
  modal: {
    justifyContent: 'flex-end',
    alignContent: 'center',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 10,
    height: '100%', // Adjust modal height for proper scrolling
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 10,
  },
  handleIndicator: {
    width: 110,
    height: 6,
    borderRadius: 250,
    alignSelf: 'center',
    backgroundColor: '#f1f4f8',
    marginBottom: 5,
    marginTop: 20,
  },
  sheetContent: {
    flex: 1,
  },
  webView: {
    flex: 1,
    minHeight: screenHeight, // Ensure WebView has enough space for internal scrolling
  },
});

export default IIFLModal;
