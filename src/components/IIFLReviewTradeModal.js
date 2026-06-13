import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import YoutubePlayer from 'react-native-youtube-iframe';
import {
  XIcon,
  EyeIcon,
  EyeOffIcon,
  Info,
  AlertOctagon,
  ArrowRight,
} from 'lucide-react-native';
import CryptoJS from 'react-native-crypto-js';
import axios from 'axios';
import {useNavigation, useRoute} from '@react-navigation/native';
import server from '../utils/serverConfig';
import {getAuth} from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import {generateToken} from '../utils/SecurityTokenManager';
import {useTrade} from '../screens/TradeContext';
import {getAdvisorSubdomain} from '../utils/variantHelper';
const {width: screenWidth, height: screenHeight} = Dimensions.get('window');
const commonHeight = screenHeight * 0.06;
const commonWidth = '100%';
const ssh = screenHeight;

// Custom query string parsing function
const parseQueryString = queryString => {
  const params = {};
  const query = queryString.startsWith('?')
    ? queryString.substring(1)
    : queryString;
  const pairs = query.split('&');
  pairs.forEach(pair => {
    const [key, value] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value);
  });
  return params;
};

const IIFLReviewTradeModal = ({
  isVisible,
  onClose,
  openIIFLReviewModal,
  setOpenIIFLReviewModel,
  setOpenTokenExpireModel,
  setShowBrokerModal,
  fetchBrokerStatusModal,
  handleOpenBrokerModal,
  showIIFLModal,
  setShowIIFLModal,

  showICICIUPModal,
  setShowICICIUPModal,

  showupstoxModal,
  setShowupstoxModal,

  showangleoneModal,
  setShowangleoneModal,

  showzerodhamodal,
  setShowzerodhaModal,

  showhdfcModal,
  setShowhdfcModal,

  showDhanModal,
  setShowDhanModal,

  showKotakModal,
  setShowKotakModal,

  showAliceblueModal,
  showFyersModal,
  setShowAliceblueModal,
  setShowFyersModal,

  showMotilalModal,
  setShowMotilalModal,
}) => {
  const {configData} = useTrade();
  const [userDetails, setUserDetails] = useState();
  console.log('isvisible trueeeee------', isVisible);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user ? user.email : null; // Check if user exists

  const [loginLoading, setLoginLoading] = useState(false);

  const [clientCode, setClientCode] = useState('');
  const [my2pin, setMy2pin] = useState('');

  // user login
  //iifl
  const [showSuccessMsg, setShowSuccessMsg] = useState(false);
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
        //   console.log("here45", res.data.User);
        setUserDetails(res.data.User);
        // console.log('here1115',res.data.User.user_broker);
        setBrokerStatus(res.data.User.connect_broker_status);
      })
      .catch(err => console.log(err));
  };
  useEffect(() => {
    if (userEmail) {
      getUserDeatils();
      //  console.log("here11ppv-",userDetails,userEmail);
    }
  }, [userEmail]); // Only fetch details when userEmail is defined

  const [brokerStatus, setBrokerStatus] = useState(
    userDetails ? userDetails.connect_broker_status : null,
  );

  useEffect(() => {
    if (userDetails && userDetails.user_broker !== undefined) {
      setMy2pin(userDetails?.my2Pin);
      setClientCode(userDetails?.clientCode);
      setBrokerStatus(userDetails && userDetails.connect_broker_status);
    }
  }, [userDetails, brokerStatus]);

  const broker = userDetails?.user_broker;

  const handleOpen = broker => {
    handleOpenBrokerModal(broker);
  };

  const [showMessage, setShowMessage] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMessage(true);
    }, 1000); // 1 second delay

    return () => clearTimeout(timer); // Cleanup the timer on unmount
  }, []);

  useEffect(() => {
    // console.log("expiremodallll",broker);
    if (showSuccessMsg) {
      const timer = setTimeout(() => {
        setShowSuccessMsg(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessMsg]);

  // Deep link listener in your main component (e.g., App.js)
  return (
    <Modal
      isVisible={true}
      onBackdropPress={onClose}
      style={styles.modal}
      backdropOpacity={0.5}
      useNativeDriver
      hideModalContentWhileAnimating
      animationIn="slideInUp"
      animationOut="slideOutDown">
      <View
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: screenWidth * 0.05,
        }}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <XIcon size={24} color="#000" />
        </TouchableOpacity>

        {!showMessage || !broker ? (
          // Show loader while `showMessage` is false
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        ) : (
          // Show content when `showMessage` is true
          <View style={{marginTop: 10}}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignContent: 'center',
                alignItems: 'center',
              }}>
              <AlertOctagon
                style={{alignSelf: 'center', marginTop: 10}}
                size={60}
                color="black"
              />
              <Text style={styles.title}>
                Please login to your broker to continue investments
              </Text>
            </View>

            {broker === 'IIFL Securities' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowIIFLModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to IIFL</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}

            {broker === 'Kotak' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowKotakModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to Kotak</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}

            {/* Render other broker buttons similarly */}
            {broker === 'ICICI Direct' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowICICIUPModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>
                  Login to ICICI Direct
                </Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}

            {broker === 'Upstox' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowupstoxModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to Upstox</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}

            {broker === 'Zerodha' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => handleOpen(broker)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to Zerodha</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}

            {broker === 'Angel One' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowangleoneModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to AngelOne</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}
            {broker === 'Hdfc Securities' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowhdfcModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to HDFC</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}
            {broker === 'Dhan' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowDhanModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to Dhan</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}
            {broker === 'Fyers' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowFyersModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to Fyers</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}
            {broker === 'Aliceblue' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowAliceblueModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>Login to Aliceblue</Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}
            {broker === 'Motilal Oswal' && (
              <TouchableOpacity
                style={styles.proceedButton}
                onPress={() => setShowMotilalModal?.(true)}
                disabled={loginLoading}>
                <Text style={styles.proceedButtonText}>
                  Login to Motilal Oswal
                </Text>
                <ArrowRight size={18} color={'grey'} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
    backgroundColor: 'lightgray',
  },
  loaderContainer: {
    flex: 1,
    marginVertical: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  playerWrapper: {
    overflow: 'hidden',
    marginTop: 20,
    alignSelf: 'center',
    borderRadius: 20,
  },
  content: {
    marginTop: screenHeight * 0.01,
  },
  stepGuide: {
    fontSize: 20,
    color: 'black',
    fontFamily: 'Poppin-Bold',
  },
  instruction: {
    fontSize: 15,
    color: 'black',
    fontFamily: 'Poppin-Bold',
    marginVertical: 3,
  },
  link: {
    color: 'blue',
    textDecorationLine: 'underline',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    textAlign: 'center',
    flex: 1,
    color: 'black',
    marginBottom: 15,
  },
  label: {
    fontSize: 17,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 5,
  },
  inputContainer: {
    borderColor: '#d5d4d4',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    width: '106%',
    height: commonHeight, // Apply common height
  },
  proceedButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 20,
    alignItems: 'center',

    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'center',
    marginTop: 20,
  },
  proceedButtonText: {
    fontSize: 14, // Dynamic font size
    fontFamily: 'Satoshi-Medium',
    color: 'black',
  },
});

export default IIFLReviewTradeModal;
