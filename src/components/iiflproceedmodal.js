import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import Modal from 'react-native-modal';
import {XIcon, EyeOffIcon, EyeIcon} from 'lucide-react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import {WebView} from 'react-native-webview';
import {getAuth} from '@react-native-firebase/auth';
import {auth} from '../utils/firebaseConfig';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import Config from 'react-native-config';
import {useTrade} from '../screens/TradeContext';
import {getAdvisorSubdomain} from '../utils/variantHelper';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');
const commonHeight = screenHeight * 0.06; // Common height
const commonWidth = '100%'; // Common width

const IIFLProceedModal = ({
  isVisible,
  onClose,
  clientCode,
  fetchBrokerStatusModal,
}) => {
  const {configData} = useTrade();
  const [my2Pin, setMy2Pin] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [uid, setUid] = useState('');
  const [broker, setBroker] = useState('IIFL Securities');
  const [showWebView, setShowWebView] = useState(false); // State to control WebView visibility
  const [isLoading, setIsLoading] = useState(false); // State for loading indicator
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  useEffect(() => {
    if (isVisible && userEmail) {
      fetchUserEmailAndId();
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
      if (!response.data || !response.data.User) {
        console.error('Profile data not found in response');
        return;
      }
      const profile = response.data.User;
      setUid(profile._id);
    } catch (error) {
      console.error(
        'Error fetching user email and id:',
        error.response?.data || error.message,
      );
    }
  };

  // Function to handle opening IIFL WebView
  const connectIIFL = () => {
    const redirectUrl =
      configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL.replace(
        'https://',
        '',
      );
    const iiflUrl = `https://markets.iiflcapital.com/?v=1&appkey=nHjYctmzvrHrYWA&redirect_url=${redirectUrl}`;
    setShowWebView(true); // Show WebView
  };

  // Function to handle the IIFL login and postback parameters
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

      // Store the tokens and client info
      localStorage.setItem('iiflAccessToken', accessToken);
      localStorage.setItem('iiflClientCode', clientId);

      // Update the state with the IIFL details
      setState(prev => ({
        ...prev,
        iiflClientCode: clientId,
        accessToken: accessToken,
        brokerName: 'iifl',
      }));

      Toast.show({
        type: 'success',
        text1: 'Successfully connected to IIFL',
      });
      setBrokerModel(false);
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

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      style={styles.modal}
      backdropOpacity={0.5}
      useNativeDriver
      hideModalContentWhileAnimating
      animationIn="slideInUp"
      animationOut="slideOutDown"
      swipeDirection={['down']}
      onSwipeComplete={onClose}>
      {/* WebView to handle IIFL connection */}
      {showWebView && (
        <View style={{flex: 1}}>
          <WebView
            source={{
              uri: `https://markets.iiflcapital.com/?v=1&appkey=nHjYctmzvrHrYWA&redirect_url=${configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL.replace(
                'https://',
                '',
              )}`,
            }}
            onNavigationStateChange={event => {
              const params = new URLSearchParams(event.url.split('?')[1]);
              const authCode = params.get('authcode');
              const clientId = params.get('clientid');

              if (authCode && clientId) {
                handleIIFLLogin(authCode, clientId);
                setShowWebView(false); // Close WebView after login
              }
            }}
            style={{flex: 1}}
          />
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: screenWidth * 0.05,
    height: screenHeight / 1.5,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
  },
  horizontal: {
    width: 110,
    height: 6,
    borderRadius: 250,
    alignSelf: 'center',
    backgroundColor: '#f1f4f8',
    marginBottom: 20,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    marginTop: 30,
  },
  stepGuide: {
    fontSize: screenWidth * 0.045,
    fontWeight: '700',
    color: 'black',
    marginBottom: 10,
  },
  instruction: {
    fontSize: screenWidth * 0.04,
    color: 'black',
    marginBottom: 10,
  },
  title: {
    fontSize: screenWidth * 0.06,
    fontWeight: '700',
    color: 'black',
    marginVertical: 20,
  },
  label: {
    fontSize: screenWidth * 0.05,
    color: 'black',
    marginBottom: 5,
    fontWeight: '600',
  },
  inputContainer: {
    borderColor: '#d5d4d4',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    width: '106%',
    height: commonHeight,
  },
  input: {
    height: commonHeight,
    borderColor: '#d5d4d4',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 20,
    color: '#000101',
    width: commonWidth,
  },
  proceedButton: {
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 8,
    height: screenHeight * 0.06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedButtonText: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: 'white',
  },
});

export default IIFLProceedModal;
