import React, {useRef, useState, useEffect} from 'react';
import {View, StyleSheet, Dimensions} from 'react-native';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import axios from 'axios';
import CryptoJS from 'react-native-crypto-js';
import Config from 'react-native-config';
import Toast from 'react-native-toast-message';
import {generateToken} from '../../utils/SecurityTokenManager';
import ZerodhaConnectUI from '../../UIComponents/BrokerConnectionUI/ZerodhaConnectUI';
import {useTrade} from '../../../screens/TradeContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
const {width: screenWidth, height: screenHeight} = Dimensions.get('window');
const commonHeight = screenHeight * 0.06;

const ZerodhaConnectModal = ({
  isVisible,
  setShowzerodhaModal,
  onClose,
  fetchBrokerStatusModal,
  setShowBrokerModal,
}) => {
  const {configData} = useTrade();
  const [authtoken, setAuthToken] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setLoading] = useState(false);

  const [helpVisible, setHelpVisible] = useState(false);
  const OpenHelpModal = () => {
    // console.log('modal:',helpVisible)
    setHelpVisible(true);
  };

  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [ispasswordVisibleup, setIsPasswordVisibleup] = useState(false);
  const [showWebView, setShowWebView] = useState(false); // Flag to toggle WebView display
  const [authUrl, setAuthUrl] = useState('');
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const sheet = useRef(null);
  const scrollViewRef = useRef(null);

  const showToast = (message1, type, message2) => {
    Toast.show({
      type: type,
      text2: message2 + ' ' + message1,
      position: 'top',
      visibilityTime: 4000, // Duration the toast is visible
      autoHide: true,
      topOffset: 60, // Adjust this value to position the toast
      bottomOffset: 80,

      text1Style: {
        color: 'black',
        fontSize: 12,
        fontWeight: 0,
        fontFamily: 'Poppins-Medium', // Customize your font
      },
      text2Style: {
        color: 'black',
        fontSize: 13,
        fontFamily: 'Poppins-Regular', // Customize your font
      },
    });
  };

  const checkValidApiAnSecret = details => {
    const bytesKey = CryptoJS.AES.encrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString();
    if (Key) {
      return Key;
    }
  };

  const [userDetails, setUserDetails] = useState();
  const getUserDeatils = () => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getAdvisorSubdomain(),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      })
      .then(res => {
        setUserDetails(res.data.User);
      })
      .catch(err => console.log(err));
  };
  useEffect(() => {
    getUserDeatils();
  }, [userEmail, server.server.baseUrl]);

  const userId = userDetails && userDetails._id;

  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  // Function to parse the query string from a URL
  // Function to parse the query string from a URL
  const parseQueryString = queryString => {
    const params = {};
    const query = queryString.startsWith('?')
      ? queryString.substring(1)
      : queryString;
    const pairs = query.split('&');

    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });

    return params;
  };
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState(null);
  // Function to handle WebView navigation state changes

  const checkValidApiAnSecretdecrypt = details => {
    const bytesKey = CryptoJS.AES.decrypt(details, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };

  const handleWebViewNavigationStateChange = newNavState => {
    const {url} = newNavState;

    console.log('url 1---', url, newNavState);
    // Check if URL contains parameters you are looking for
    if (
      url.includes('status=') ||
      url.includes('request_token=') ||
      url.includes('type=')
    ) {
      const queryParams = parseQueryString(url.split('?')[1]);
      console.log('url 2---', url);
      // Extract 'status', 'request_token', and 'type'
      const zerodhaStatus = queryParams.status;
      const zerodhaRequestLoginToken = queryParams.request_token;
      const zerodhaLoginType = queryParams.type;

      // Update the state with extracted values
      if (zerodhaStatus) {
        console.log('zerodha1', zerodhaStatus);
        setZerodhaStatus(zerodhaStatus);
      }

      if (zerodhaRequestLoginToken) {
        console.log('zerodha2', zerodhaRequestLoginToken);
        setZerodhaRequestToken(zerodhaRequestLoginToken);
      }

      if (zerodhaLoginType) {
        console.log('zerodha3', zerodhaLoginType);
        setZerodhaRequestType(zerodhaLoginType);
      }
      if (zerodhaRequestLoginToken) {
        console.log('zerodha success1');
        //  connectBrokerDbUpadte();
      }
    }
  };

  const brokerConnectRedirectURL =
    configData?.config?.REACT_APP_BROKER_CONNECT_REDIRECT_URL;

  const updateSecretKey = () => {
    const cleanRedirectUrl = brokerConnectRedirectURL.replace(
      /^https?:\/\//,
      '',
    );
    setLoading(true);
    let data = JSON.stringify({
      uid: userId,
      apiKey: checkValidApiAnSecret(apiKey),
      secretKey: checkValidApiAnSecret(secretKey),
      user_broker: 'Zerodha',
      redirect_url: cleanRedirectUrl,
    });
    console.log('--------->>>>>>>', data);
    let config = {
      method: 'post',
      url: `${server.server.baseUrl}api/zerodha/update-key`,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },

      data: data,
    };
    console.log('Data i send', userId, apiKey, secretKey, cleanRedirectUrl);
    axios
      .request(config)
      .then(response => {
        if (response) {
          console.log('here upstox:', response.data);
          setAuthUrl(response.data.response);
          console.log('url auth====', authUrl);
          setShowWebView(true);
        }
      })
      .catch(error => {
        console.log(error);
        showToast('Incorrect credential.Please try again', 'error', '');
      });
  };

  const [zerodhaAccessToken, setZerodhaAccessToken] = useState(null);
  const hasConnectedZerodha = useRef(false);
  const connectZerodha = () => {
    console.log(
      'has connec-t---',
      hasConnectedZerodha,
      zerodhaRequestToken,
      zerodhaRequestType,
    );
    if (
      zerodhaRequestToken !== null &&
      zerodhaRequestType === 'login' &&
      apiKey &&
      secretKey &&
      !hasConnectedZerodha.current
    ) {
      let data = JSON.stringify({
        user_email: userEmail,
        apiKey: apiKey,
        apiSecret: secretKey,
        requestToken: zerodhaRequestToken,
      });

      console.log('darta------------------------------>>>>>>>>', data);

      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}zerodha/gen-access-token`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data: data,
      };
      axios
        .request(config)
        .then(response => {
          if (response.data) {
            console.log('Response Data------------------:', response.data);
            if (response.data.status === 1) {
              setShowWebView(false);
              setLoading(false);
              showToast('Incorrect credential.Please try again', 'error', '');
            } else {
              const session_token = response.data.access_token;
              setZerodhaAccessToken(session_token);
            }
          }
        })
        .catch(error => {
          console.error(error);
          setShowWebView(false);
          setLoading(false);
          showToast('Error to connect.', 'error', '');
        });
      hasConnectedZerodha.current = true;
    }
  };

  useEffect(() => {
    if (zerodhaRequestToken && zerodhaRequestType && apiKey && secretKey) {
      console.log(
        'this gets true---',
        zerodhaRequestToken,
        zerodhaRequestType,
        apiKey,
        secretKey,
      );
      connectZerodha();
    }
  }, [zerodhaRequestToken, zerodhaRequestType, userDetails]);

  const isToastShown = useRef(false);
  const connectBrokerDbUpadte = () => {
    console.log('this get called 123;', zerodhaAccessToken);
    setLoading(false);
    if (zerodhaAccessToken) {
      console.log('heref');
      isToastShown.current = true; // Prevent further execution
      let brokerData = {
        uid: userId,
        user_broker: 'Zerodha',
        jwtToken: zerodhaAccessToken,
      };
      let config = {
        method: 'put',
        url: `${server.server.baseUrl}api/user/connect-broker`,

        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },

        data: JSON.stringify(brokerData),
      };

      axios
        .request(config)
        .then(response => {
          console.log('success brooooohh');
          setLoading(false);
          fetchBrokerStatusModal();
          showToast('Your Broker Connected Successfully!.', 'success', '');
          setShowzerodhaModal(false);
          setShowBrokerModal(false);
        })
        .catch(error => {
          console.log(error);
          showToast('Error to connect.', 'error', '');
        });
    }
  };

  useEffect(() => {
    if (userId !== undefined && zerodhaAccessToken) {
      console.log('zerodha accessTOken----', zerodhaAccessToken);
      connectBrokerDbUpadte();
    }
  }, [userId, zerodhaAccessToken]);

  const [shouldRenderContent, setShouldRenderContent] = React.useState(true);

  useEffect(() => {
    if (isVisible) {
      sheet.current?.present();
      setShouldRenderContent(true);
      // Show the TrueSheet if visible
    } else {
      sheet.current?.dismiss();
      // Hide the TrueSheet if not visible
    }
  }, [isVisible]);

  useEffect(() => {
    if (
      userId &&
      userDetails?.apiKey &&
      userDetails?.secretKey &&
      userDetails?.user_broker === 'Zerodha'
    ) {
      setApiKey(checkValidApiAnSecretdecrypt(userDetails?.apiKey));
      setSecretKey(checkValidApiAnSecretdecrypt(userDetails?.secretKey));
      let data = JSON.stringify({
        uid: userId,
        apiKey: userDetails?.apiKey,
        secretKey: userDetails?.secretKey,
      });
      let config = {
        method: 'post',
        url: `${server.server.baseUrl}api/zerodha/update-key`,

        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },

        data: data,
      };
      axios
        .request(config)
        .then(response => {
          if (response) {
            setAuthUrl(response.data.response);
            setShowWebView(true);
          }
        })
        .catch(error => {
          console.log(error);
        });
    }
  }, [isVisible, userDetails]);

  const handleWebViewClose = () => {
    setShowWebView(false); // Close WebView and return to the form
  };
  return (
    <ZerodhaConnectUI
      isVisible={isVisible}
      onClose={() => {
        setShowzerodhaModal(false);
        setShowBrokerModal(false);
      }}
      shouldRenderContent={shouldRenderContent}
      showWebView={showWebView}
      apiKey={apiKey}
      secretKey={secretKey}
      isPasswordVisible={isPasswordVisible}
      isPasswordVisibleUp={ispasswordVisibleup}
      setApiKey={setApiKey}
      setSecretKey={setSecretKey}
      setIsPasswordVisible={setIsPasswordVisible}
      setIsPasswordVisibleUp={setIsPasswordVisibleup}
      updateSecretKey={updateSecretKey}
      isLoading={isLoading}
      authUrl={authUrl}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
      scrollViewRef={scrollViewRef}
    />
  );
};

const styles = StyleSheet.create({
  webView: {},
});

export default ZerodhaConnectModal;
