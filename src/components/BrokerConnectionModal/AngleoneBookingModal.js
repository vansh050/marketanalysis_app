import React, {useRef, useState, useEffect} from 'react';
import {StyleSheet, Dimensions} from 'react-native';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import axios from 'axios';
const {height: screenHeight} = Dimensions.get('window');
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import AngleOneConnectUI from '../../UIComponents/BrokerConnectionUI/AngelOneConnectUI';
import { useTrade } from '../../screens/TradeContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import eventEmitter from '../EventEmitter';
import useModalStore from '../../GlobalUIModals/modalStore';

const AngleOneBookingTrueSheet = ({
  isVisible,
  // setShowangleoneModal,
  onClose,
  setShowBrokerModal,
  fetchBrokerStatusModal,
}) => {
  const {configData} = useTrade();
  const showAlert = useModalStore((state) => state.showAlert);

  const sheet = useRef(null);
  const scrollViewRef = useRef(null); // ScrollView ref for nested scrolling
  const [authUrl, setauthurl] = useState(
    `https://smartapi.angelbroking.com/publisher-login?api_key=${configData?.config?.REACT_APP_ANGEL_ONE_API_KEY}`,
  );
  const [authtoken, setAuthToken] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const [userDetails, setUserDetails] = useState();
  const getUserDeatils = () => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
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

  const handleWebViewNavigationStateChange = newNavState => {
    const {url} = newNavState;
    if (url.includes('auth_token=')) {
      const queryParams = parseQueryString(url.split('?')[1]);
      const sessionToken = queryParams.auth_token;
      if (sessionToken) {
        setAuthToken(sessionToken);
        sheet.current?.dismiss(); // Close the TrueSheet when done
      }
    }
  };
  const angelApi = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;

  const isToastShown = useRef(false);
  const connectBrokerDbUpadte = () => {
    if (authtoken) {
      if (!isToastShown.current) {
        console.log('heref');
        isToastShown.current = true; // Prevent further execution
        let brokerData = {
          uid: userId,
          user_broker: 'Angel One',
          jwtToken: authtoken,
          apiKey: angelApi,
          ddpi_status: userDetails?.ddpi_status || 'empty', // Required for DB persistence
        };
        let config = {
          method: 'put',
          url: `${server.server.baseUrl}api/user/connect-broker`,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          data: JSON.stringify(brokerData),
        };
        console.log('Broker Data:', brokerData);
        axios
          .request(config)
          .then(response => {
            console.log('[AngelOne] Broker connected successfully, updating model portfolio...');

            // Update model portfolio with broker information (non-critical)
            let newBrokerData = {
              user_email: userEmail,
              user_broker: 'AngelOne',
            };
            let A1_broker = {
              method: 'post',
              url: `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
              data: JSON.stringify(newBrokerData),
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
                'aq-encrypted-key': generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET,
                ),
              },
            };

            // Execute the model portfolio broker update - catch separately so connection success isn't affected
            return axios.request(A1_broker).catch(err => {
              console.warn('[AngelOne] Model portfolio update failed (non-critical):', err);
              return null;
            });
          })
          .then(response => {
            if (response) {
              console.log('[AngelOne] Model portfolio updated successfully');
            }
            fetchBrokerStatusModal();
            // Emit refresh event to update portfolio data in listening components
            eventEmitter.emit('refreshEvent', { source: 'AngleOne broker connection' });
            showAlert('success', 'Connected Successfully', 'Your Angel One broker has been connected successfully!');
            // setShowangleoneModal(false);
            onClose();
            setShowBrokerModal(false);
          })
          .catch(error => {
            console.log(error);
            showAlert('error', 'Connection Error', 'Failed to connect to Angel One. Please try again.');
          });
      }
    }
  };

  useEffect(() => {
    if (userId !== undefined && authtoken) {
      connectBrokerDbUpadte();
    }
  }, [userId, authtoken]);

  useEffect(() => {
    if (isVisible) {
      setauthurl(
        `https://smartapi.angelbroking.com/publisher-login?api_key=${configData?.config?.REACT_APP_ANGEL_ONE_API_KEY}`,
      );
      sheet.current?.present(); // Show the TrueSheet if visible
    } else {
      sheet.current?.dismiss(); // Hide the TrueSheet if not visible
    }
  }, [isVisible]);

  const handleClose = () => {
    // setShowangleoneModal(false);
    setauthurl('');
    // Update the state to reflect the sheet is closed
    onClose(); // Call the parent onClose function
  };

  return (
    <AngleOneConnectUI
      isVisible={isVisible}
      onClose={onClose}
      handleClose={handleClose}
      authUrl={authUrl}
      handleWebViewNavigationStateChange={handleWebViewNavigationStateChange}
    />
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

export default AngleOneBookingTrueSheet;
