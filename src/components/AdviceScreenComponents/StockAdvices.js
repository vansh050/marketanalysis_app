import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity,
  LayoutAnimation,
  SafeAreaView,
} from 'react-native';
import axios from 'axios';
import server from '../../utils/serverConfig';
import { useCart } from '../CartContext';
import LottieView from 'lottie-react-native';
import RecommendationSuccessModal from '../ModelPortfolioComponents/RecommendationSuccessModal';
import IgnoreAdviceModal from '../IgnoreAdviceModal';
import StockAdviceContent from '../AdviceScreenComponents/StockAdviceContent';
import useSymbolSubscription from './DynamicText/useSymbolSubscription';
import Toast from 'react-native-toast-message';
import { getAuth } from '@react-native-firebase/auth';
import { isOrderSuccess, isOrderRejected } from '../../utils/orderStatusUtils';
import { createPlaceOrderFunction } from '../../FunctionCall/createPlaceOrderFunction';
import ZerodhaReviewModal from '../ReviewZerodhaTradeModal';
import CryptoJS from 'react-native-crypto-js';
import IIFLReviewTradeModal from '../IIFLReviewTradeModal';
import WebSocketManager from './DynamicText/WebSocketManager';
import { getLastKnownPrice } from './DynamicText/websocketPrice';
import { validateStockExchanges, applyKiteMarketProtection, resolveZerodhaSymbol } from '../../utils/brokerPublisher';
import useZerodhaSymbolMap from '../../hooks/useZerodhaSymbolMap';
import {useRefreshBrokerStatus} from '../../hooks/useRefreshBrokerStatus';
import {isFundsErrorOrMissing} from '../../utils/rebalanceHelpers';
import {classifyFundsResponse} from '../../utils/brokerSessionValidator';

import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ReviewTradeModal from '../ReviewTradeModal';
import { useModal } from '../../components/ModalContext';
import eventEmitter from '../EventEmitter';
import BrokerSelectionModal from '../BrokerSelectionModal';

import { OtherBrokerModel } from '../DdpiModal';
import { useTrade } from '../../screens/TradeContext';
import { useConfig } from '../../context/ConfigContext';
import IsMarketHours from '../../utils/isMarketHours';

import { ActivateNowModel } from '../DdpiModal';
import DdpiModal from '../DdpiModal';
import { DhanTpinModal } from '../DdpiModal';
import { AngleOneTpinModal } from '../DdpiModal';
import { FyersTpinModal } from '../DdpiModal';
import ICICIUPModal from '../BrokerConnectionModal/icicimodal';
import UpstoxModal from '../BrokerConnectionModal/upstoxModal';
import AngleOneBookingModal from '../BrokerConnectionModal/AngleoneBookingModal';
import ZerodhaConnectModal from '../BrokerConnectionModal/ZerodhaConnectModal';
import HDFCconnectModal from '../BrokerConnectionModal/HDFCconnectModal';
import DhanConnectModal from '../BrokerConnectionModal/DhanConnectModal';
import KotakModal from '../BrokerConnectionModal/KotakModal';
import IIFLModal from '../iiflmodal';
import Config from 'react-native-config';
import AliceBlueConnect from '../BrokerConnectionModal/AliceBlueConnect';
import FyersConnect from '../BrokerConnectionModal/FyersConnect';
import notifee, { EventType } from '@notifee/react-native';

import { generateToken } from '../../utils/SecurityTokenManager';
import MotilalModal from '../BrokerConnectionModal/MotilalModal';
import { getAdvisorSubdomain } from '../utils/variantHelper';

const { height: screenHeight } = Dimensions.get('window');
const StockAdvices = React.memo(({ userEmail, orderscreen, type }) => {
  // Network-fresh {broker, brokerStatus, funds} — protects every handler that
  // gates a TokenExpire / broker-selection modal from re-popping right after
  // a successful reconnect. See `docs/REBALANCING.md § Closure-bound funds`.
  const refreshBrokerStatus = useRefreshBrokerStatus(userEmail);
  const {
    stockRecoNotExecutedfinal,
    planList,
    recommendationStockfinal,
    isDatafetching,
    getAllTrades,
    rejectedTrades,
    ignoredTrades,
    userDetails,
    broker,
    brokerStatus,
    getUserDeatils,
    funds,
    getAllFunds,
    configData,
  } = useTrade();
  const { allowAfterHoursOrders } = useConfig() || {};
  const [stockRecoNotExecuted, setStockRecoNotExecuted] = useState([]);
  const [recommendationStock, setrecommendationStock] = useState([]);
  const { showAddToCartModal } = useModal();
  const { setCartCount } = useCart();
  const [isToggleOn, setIsToggleOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isModalVisibleignore, setModalVisible] = useState(false);
  const [stockIgnoreId, setStockIgnoreId] = useState(null);

  const [brokerModel, setBrokerModel] = useState(null);

  const [basketId, setbasketId] = useState(null);
  const [basketName, setbasketName] = useState(null);

  const [OpenRebalanceModal, setOpenRebalanceModal] = useState(false);
  const [showIIFLModal, setShowIIFLModal] = useState(false);
  const [showICICIUPModal, setShowICICIUPModal] = useState(false);
  const [showupstoxModal, setShowupstoxModal] = useState(false);
  const [showangleoneModal, setShowangleoneModal] = useState(false);
  const [showzerodhamodal, setShowzerodhaModal] = useState(false);
  const [showhdfcModal, setShowhdfcModal] = useState(false);
  const [showDhanModal, setShowDhanModal] = useState(false);
  const [showKotakModal, setShowKotakModal] = useState(false);

  const animationRef = useRef(null);
  const [openReviewTrade, setOpenReviewTrade] = useState(false);
  const [openZerodhaReviewModal, setOpenZerodhaModel] = useState(false);
  const [openIIFLReviewModal, setOpenIIFLReviewModel] = useState(false); // Ensure initial value is false
  const auth = getAuth(); // Get the Firebase auth instance
  const user = auth.currentUser; // Get the currently signed-in user
  const [stockDetails, setStockDetails] = useState([]);

  const [OpenBasketReview, setOpenBasketReview] = useState(false);

  const [isBasket, setisBasket] = useState(false);
  const [basketData, setBasketData] = useState([]);
  const [fullbasketData, fullsetBasketData] = useState([]);
  const angelOneApiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;
  const [showDdpiModal, setShowDdpiModal] = useState(false);
  const [showActivateNowModel, setActivateNowModel] = useState(false);
  const [showAngleOneTpinModel, setShowAngleOneTpinModel] = useState(false);
  const [showFyersTpinModal, setShowFyersTpinModal] = useState(false);
  const [showDhanTpinModel, setShowDhanTpinModel] = useState(false);
  const [showOtherBrokerModel, setShowOtherBrokerModel] = useState(false);
  const [showActivateTopModel, setActivateTopModel] = useState(false);

  const [singleStockTypeAndSymbol, setSingleStockTypeAndSymbol] =
    useState(null);
  const [edisStatus, setEdisStatus] = useState(null);
  const [dhanEdisStatus, setDhanEdisStatus] = useState(null);
  const [zerodhaDdpiStatus, setZerodhaDdpiStatus] = useState(null);
  const [types, setTypes] = useState([]);

  const handleActivateDDPI = () => {
    setActivateNowModel(false);
  };

  const verifyEdis = async () => {
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}angelone/verify-edis`,
        {
          apiKey: angelOneApiKey,
          jwtToken: userDetails.jwtToken,
          userEmail: userDetails?.email,
        },
      );
      setEdisStatus(response.data);
      console.log('AngleOne response', response.data);
    } catch (error) {
      //  console.error("Error verifying eDIS status:", error);
    }
  };

  const verifyDhanEdis = async () => {
    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}dhan/edis-status`,
        {
          clientId: clientCode,
          accessToken: userDetails.jwtToken,
        },
      );
      console.log('Dhan Reponse', response.data);
      setDhanEdisStatus(response.data);
    } catch (error) {
      //  console.error("Error verifying eDIS status:", error);
    }
  };

  const [storedTradeType, setStoredTradeType] = useState({
    allSell: false,
    allBuy: false,
    isMixed: false,
  });

  const updateTradeType = newTradeType => {
    setTradeType(newTradeType);
    setStoredTradeType(newTradeType);
    AsyncStorage.setItem('storedTradeType', JSON.stringify(newTradeType));
  };

  const [tradeType, setTradeType] = useState({
    allSell: false,
    allBuy: false,
    isMixed: false,
  });

  const [tradeClickCount, setTradeClickCount] = useState(0);

  const today = new Date();
  const todayDate = moment(today).format('YYYY-MM-DD HH:mm:ss');

  const dateString = userDetails?.token_expire;

  const clientCode = userDetails && userDetails?.clientCode;
  const apiKey = userDetails && userDetails?.apiKey;
  const jwtToken = userDetails && userDetails?.jwtToken;
  const my2pin = userDetails && userDetails?.my2Pin;
  const secretKey = userDetails && userDetails?.secretKey;
  const viewToken = userDetails && userDetails?.viewToken;
  const sid = userDetails && userDetails?.sid;
  const serverId = userDetails && userDetails?.serverId;
  const mobileNumber = userDetails && userDetails?.phone_number;
  const panNumber = userDetails && userDetails?.panNumber;
  const userId = userDetails && userDetails?._id;
  const [stockloading, setstockloading] = useState(false);
  const [OpenTokenExpireModel, setOpenTokenExpireModel] = useState(false);

  const [authToken, setAuthToken] = useState(null);
  // const zerodha Login
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState(null);
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);
  const [zerodhaStatus, setZerodhaStatus] = useState(null);

  const [showFyersModal, setShowFyersModal] = useState(false);

  const [showMotilalModal, setShowMotilalModal] = useState(false);

  const [showAliceblueModal, setShowAliceblueModal] = useState(false);

  const zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY;

  // Scripmaster symbol/exchange map from ccxt-india. Enabled whenever
  // stockDetails has items (placeOrder basket-build path depends on this).
  const symbolMap = useZerodhaSymbolMap(stockDetails, stockDetails?.length > 0);

  const checkValidApiAnSecret = data => {
    if (!data) return null;
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };

  // zerodha start
  const [zerodhaAccessToken, setZerodhaAccessToken] = useState(null);
  const hasConnectedZerodha = useRef(false);
  const connectZerodha = () => {
    if (zerodhaRequestToken !== null && !hasConnectedZerodha.current) {
      let data = JSON.stringify({
        user_email: userEmail,
        apiKey: checkValidApiAnSecret(apiKey),
        apiSecret: checkValidApiAnSecret(secretKey),
        requestToken: zerodhaRequestToken,
      });

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
            const session_token = response.data.access_token;
            setZerodhaAccessToken(session_token);
          }
        })
        .catch(error => {
          console.error(error);
          Toast.show({
            type: 'error',
            text1: 'Failed',
            text2: 'Something went wrong.',
            visibilityTime: 5000,
            position: 'bottom',
            bottomOffset: 40,
            style: {
              backgroundColor: 'white',
              borderLeftColor: 'green',
              borderLeftWidth: 5,
              padding: 10,
            },
            textStyle: {
              color: 'green',
              fontWeight: 'bold',
              fontSize: 16,
            },
          });
        });
      hasConnectedZerodha.current = true;
    }
  };

  const isToastShown = useRef(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [upstoxSessionToken, setUpstoxSessionToken] = useState(null);
  const connectBrokerDbUpadte = () => {
    if (
      sessionToken ||
      upstoxSessionToken ||
      authToken ||
      (zerodhaAccessToken && zerodhaRequestType === 'login')
    ) {
      if (!isToastShown.current) {
        isToastShown.current = true; // Prevent further execution
        let brokerData = {
          uid: userId,
          user_broker: sessionToken
            ? 'ICICI Direct'
            : upstoxSessionToken
              ? 'Upstox'
              : authToken
                ? 'Angel One'
                : 'Zerodha',
          jwtToken:
            sessionToken ||
            upstoxSessionToken ||
            zerodhaAccessToken ||
            authToken,
        };

        if (authToken) {
          brokerData = {
            ...brokerData,
            apiKey: angelOneApiKey,
          };
        }

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
            setLoading(false);
            setIciciSuccessMsg(true);
            setOpenTokenExpireModel(false);
            setBrokerModel(false);
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'You have successfully ignored your trade.',
              visibilityTime: 5000,
              position: 'bottom',
              bottomOffset: 40,
              style: {
                backgroundColor: 'white',
                borderLeftColor: 'green',
                borderLeftWidth: 5,
                padding: 10,
              },
              textStyle: {
                color: 'green',
                fontWeight: 'bold',
                fontSize: 16,
              },
            });
          })
          .catch(error => {
            setLoading(false);
            Toast.show({
              type: 'error',
              text1: 'Failed',
              text2: 'Incorrect Credentials.',
              visibilityTime: 5000,
              position: 'bottom',
              bottomOffset: 40,
              style: {
                backgroundColor: 'white',
                borderLeftColor: 'green',
                borderLeftWidth: 5,
                padding: 10,
              },
              textStyle: {
                color: 'green',
                fontWeight: 'bold',
                fontSize: 16,
              },
            });
          });
      }
    }
  };

  const [orderPlacementResponse, setOrderPlacementResponse] = useState();
  const [openSuccessModal, setOpenSucessModal] = useState(false);
  const [gttOpenSucessModal, setGttOpenSucessModal] = useState(false);

  const BROKER_URL_MAP = {
    'IIFL Securities': 'iifl',
    Kotak: 'kotak',
    Upstox: 'upstox',
    'ICICI Direct': 'icici',
    'Angel One': 'angelone',
    Zerodha: 'zerodha',
    Fyers: 'fyers',
    AliceBlue: 'aliceblue',
    Dhan: 'dhan',
    Groww: 'groww',
    'Motilal Oswal': 'motilal',
    'Hdfc Securities': 'hdfc',
  };

  const BROKER_ENDPOINTS = {
    'IIFL Securities': 'iifl',
    Kotak: 'kotak',
    Upstox: 'upstox',
    'ICICI Direct': 'icici',
    'Angel One': 'angelone',
    Zerodha: 'zerodha',
    Fyers: 'fyers',
    AliceBlue: 'aliceblue',
    Dhan: 'dhan',
    Groww: 'groww',
    'Motilal Oswal': 'motilal',
  };

  const updatePortfolioData = async (brokerName, userEmail) => {
    try {
      const endpoint = BROKER_ENDPOINTS[brokerName];
      if (!endpoint) {
        console.error(`Unsupported broker: ${brokerName}`);
        return;
      }

      const config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}${endpoint}/user-portfolio`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data: JSON.stringify({ user_email: userEmail }),
      };

      console.log(
        'config i get here----------------------------------------------',
        config,
      );

      const response = await axios.request(config);

      if (response?.status === 200) {
        console.log('✅ Portfolio updated successfully');
      } else {
        console.log(
          '⚠️ Portfolio update failed with status:',
          response?.status,
        );
      }

      return response;
    } catch (error) {
      console.error(`Error updating portfolio for ${brokerName}:`, error);
    }
  };

  const getRejectedCount = async () => {
    const rejectedKey = `rejectedCount${broker?.replace(/ /g, '')}`;

    let rejectedCountFromStorage = await AsyncStorage.getItem(rejectedKey);

    if (
      !rejectedCountFromStorage ||
      isNaN(parseInt(rejectedCountFromStorage, 10))
    ) {
      await AsyncStorage.setItem(rejectedKey, '0');
      rejectedCountFromStorage = '0';
    }

    console.log(
      'Value of rejectedKey in AsyncStorage:',
      rejectedCountFromStorage,
    );

    const currentRejectedCount = parseInt(rejectedCountFromStorage, 10);
    console.log('Parsed currentRejectedCount:', currentRejectedCount);

    return currentRejectedCount;
  };
  // getRejectedCount();
  const [isReturningFromOtherBrokerModal, setIsReturningFromOtherBrokerModal] =
    useState(false);

  const [failedSellAttempts, setFailedSellAttempts] = useState(0);
  const getAllTradesUpdate = async () => { };

  // Centralized funds-result branching used by every order chokepoint
  // below. Returns true if the trade flow should HALT (caller `return`s
  // immediately); false to continue. TRANSIENT errors (Upstox 00:00–05:30
  // IST maintenance, ICICI Breeze base-64 hiccup, etc.) show a soft
  // toast WITHOUT prompting reconnect — the user's session is fine.
  // Real auth failures (TOKEN_EXPIRED / NOT_CONNECTED) open the existing
  // TokenExpireBrokerModal so the user can reconnect in-place.
  const _haltOnFundsCheckFailure = (currentFunds, currentBrokerStatus, currentBroker) => {
    const check = classifyFundsResponse(currentFunds, currentBrokerStatus, currentBroker);
    if (check.ok) return false;
    if (check.reason === 'TRANSIENT') {
      Toast.show({
        type: 'info',
        text1: `${currentBroker || 'Broker'} temporarily unavailable`,
        text2: check.message,
        visibilityTime: 4500,
        position: 'bottom',
      });
      return true;
    }
    setOpenTokenExpireModel(true);
    return true;
  };

  const placeOrder = async stockDetails => {
    setLoading(true);

    // Market-hours gate — bypassed when advisor has allowAfterHoursOrders enabled.
    if (!IsMarketHours() && !allowAfterHoursOrders) {
      Toast.show({
        type: 'error',
        text1: 'Orders cannot be placed outside Market hours',
        text2: 'Market hours: 9:15 AM - 3:30 PM IST',
        visibilityTime: 4000,
      });
      setLoading(false);
      return;
    }

    if (_haltOnFundsCheckFailure(funds, brokerStatus, broker)) {
      setOpenReviewTrade(false);
      setLoading(false);
      return;
    }

    // Zerodha: use Publisher flow (Kite basket) instead of direct API
    if (broker === 'Zerodha') {
      setLoading(false);
      setOpenReviewTrade(false);
      // Save stockDetails for checkZerodhaStatus callback
      setZerodhaStockDetails(stockDetails);
      await handleZerodhaRedirect();
      setOpenZerodhaModel(true);
      return;
    }

    // Pre-order EDIS check for brokers without a dedicated EDIS API
    const allSellPre = stockDetails.every(s => s.transactionType === 'SELL');
    const isMixedPre = stockDetails.some(s => s.transactionType === 'BUY') &&
      stockDetails.some(s => s.transactionType === 'SELL');
    if (
      ['AliceBlue', 'IIFL Securities', 'ICICI Direct', 'Upstox', 'Kotak', 'Hdfc Securities', 'Motilal Oswal', 'Groww'].includes(broker) &&
      (allSellPre || isMixedPre) &&
      !userDetails?.is_authorized_for_sell
    ) {
      setShowOtherBrokerModel(true);
      setOpenReviewTrade(false);
      setLoading(false);
      return;
    }

    // Split into GTT and regular orders
    const gttOrders = stockDetails.filter(
      stock => stock.gttCheck === true && ['upstox', 'zerodha'].includes(broker.toLowerCase()),
    );
    const regularOrders = stockDetails.filter(
      stock => !(stock.gttCheck === true && ['upstox', 'zerodha'].includes(broker.toLowerCase())),
    );

    const getOrderPayload = (isGtt = false) => {
      const trades = isGtt ? gttOrders : (regularOrders.length > 0 ? regularOrders : stockDetails);

      // GTT payload path — decrypt credentials matching prod
      if (isGtt) {
        const gttPayload = {
          trades,
          user_broker: broker,
          user_email: userEmail,
        };
        switch (broker) {
          case 'Upstox':
            return { ...gttPayload, apiKey: checkValidApiAnSecret(apiKey), jwtToken, secretKey: checkValidApiAnSecret(secretKey) };
          case 'Zerodha':
            return { ...gttPayload, apiKey: checkValidApiAnSecret(apiKey), secretKey: checkValidApiAnSecret(secretKey), jwtToken };
          case 'AliceBlue':
            return { ...gttPayload, clientCode, apiKey: checkValidApiAnSecret(apiKey), accessToken: jwtToken };
          default:
            return { ...gttPayload, apiKey: checkValidApiAnSecret(apiKey), jwtToken };
        }
      }

      // Regular payload path
      let basePayload = {
        trades,
        user_broker: broker, // Common fields
        user_email: userEmail,
      };

      // Add basket info if available
      if (allFNO && basketId && basketName) {
        basePayload.basketId = basketId;
        basePayload.basketName = basketName;
      }

      switch (broker) {
        case 'IIFL Securities':
          return {
            ...basePayload,
            clientCode,
          };
        case 'ICICI Direct':
          return {
            ...basePayload,
            apiKey,
            secretKey,
            jwtToken,
          };
        case 'Upstox':
          return {
            ...basePayload,
            apiKey,
            jwtToken,
            secretKey,
          };
        case 'Kotak':
          return {
            ...basePayload,
            apiKey,
            secretKey,
            jwtToken,
            viewToken,
            sid,
            serverId,
          };
        case 'Hdfc Securities':
          return {
            ...basePayload,
            apiKey,
            jwtToken,
          };
        case 'Groww':
          return { ...basePayload, jwtToken };
        case 'Dhan':
          return {
            ...basePayload,
            clientCode,
            jwtToken,
          };
        case 'AliceBlue':
          return {
            ...basePayload,
            clientCode,
            jwtToken,
            apiKey: checkValidApiAnSecret(apiKey),
          };
        case 'Fyers':
          return {
            ...basePayload,
            clientCode,
            jwtToken,
          };

        case 'Angel One':
          return {
            ...basePayload,
            apiKey: angelOneApiKey,
            secretKey,
            jwtToken,
          };
        case 'Motilal Oswal':
          return {
            ...basePayload,
            apiKey: apiKey,
            clientCode: clientCode,
            jwtToken: jwtToken,
          };
        case 'Zerodha':
          return { ...basePayload, apiKey, secretKey, jwtToken };
        default:
          return {
            ...basePayload,
            apiKey,
            jwtToken,
          };
      }
    };
    const allBuy = stockDetails.every(stock => stock.transactionType === 'BUY');
    const allSell = stockDetails.every(
      stock => stock.transactionType === 'SELL',
    );
    const isMixed = !allBuy && !allSell;
    const specialBrokers = [
      'IIFL Securities',
      'ICICI Direct',
      'Upstox',
      'Kotak',
      'Hdfc Securities',
      'AliceBlue',
      "Motilal Oswal",
      "Groww",
    ];
    console.log('all buy or sell--', allBuy, allSell);
    function checkAndResetRejectedCount() {
      const resetTime = AsyncStorage.getItem('rejectedOrdersResetTime');
      const currentTime = new Date().getTime();

      // If there's no resetTime or it's past the reset time, reset the count

      if (!resetTime || currentTime >= parseInt(resetTime)) {
        console.log('Resetting all broker rejected counts');
        [
          'Dhan',
          'IIFL Securities',
          'ICICI Direct',
          'Upstox',
          'Kotak',
          'Hdfc Securities',
          'AliceBlue',
          'Fyers',
          'Angel One',
        ].forEach(broker => {
          AsyncStorage.setItem(
            `rejectedCount${broker?.replace(/ /g, '')}`,
            '0',
          );
        });

        // Set the next reset time to 12:00 AM of the next day
        const nextResetTime = new Date();
        nextResetTime.setDate(nextResetTime.getDate() + 1); // Move to the next day
        nextResetTime.setHours(0, 0, 0, 0); // Set to midnight (12:00 AM)
        AsyncStorage.setItem(
          'rejectedOrdersResetTime',
          nextResetTime.getTime().toString(),
        );
        console.log('Next reset time set to:', nextResetTime.toLocaleString());
      }
    }

    // Call the function at the start
    checkAndResetRejectedCount();

    // Retrieve the rejected count from localStorage
    // const rejectedSellCount = parseInt(localStorage.getItem("rejectedOrdersCount") || "0");

    const rejectedKey = `rejectedCount${broker?.replace(/ /g, '')}`;
    const rejectedSellCount = parseInt(
      (await AsyncStorage.getItem(rejectedKey)) || '0',
    );
    const allFNO = stockDetails.every(
      item => item.exchange === 'NFO' || item.exchange === 'BFO',
    );

    if (!allFNO) {
      if (!isReturningFromOtherBrokerModal && specialBrokers.includes(broker)) {
        if (allBuy) {
          console.log('All trades are BUY for broker:', broker);
          // Proceed with order placement for BUY
        } else if ((allSell || isMixed) && rejectedSellCount === 1) {
          console.log(
            allSell ? 'All trades are SELL' : 'Trades are Mixed',
            'for broker:',
            broker,
          );
          setShowOtherBrokerModel(true);
          console.log('Show log:', showOtherBrokerModel);
          setOpenReviewTrade(false);
          setLoading(false);
          return; // Exit the function early
        }
      }
    }

    try {
      // Handle GTT orders first if present
      if (gttOrders.length > 0) {
        const brokerUrl = BROKER_URL_MAP[broker];
        const gttEndpoint = `${server.ccxtServer.baseUrl}${brokerUrl}/process-trades`;
        const gttResponse = await axios.request({
          method: 'post',
          url: gttEndpoint,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          data: JSON.stringify(getOrderPayload(true)),
        });
        console.log('GTT response:', gttResponse.data);
        setOrderPlacementResponse(gttResponse.data[0]);
        setGttOpenSucessModal(true);

        // If no regular orders, finish here
        if (regularOrders.length === 0) {
          setLoading(false);
          setOpenReviewTrade(false);
          await Promise.all([
            updatePortfolioData(broker, userEmail),
            getAllTrades(),
            filterCartAfterOrder(),
            getCartAllStocks(),
          ]);
          eventEmitter.emit('OrderPlacedReferesh');
          eventEmitter.emit('cartUpdated');
          return;
        }
      }

      // Regular order endpoint
      const regularEndpoint = `${server.server.baseUrl}api/process-trades/order-place`;
      const response = await axios.request({
        method: 'post',
        url: regularEndpoint,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data: JSON.stringify(getOrderPayload(false)),
      });

      setLoading(false);
      console.log('the pay load we are sending ::::', getOrderPayload(false));
      // setOpenSucessModal(true);
      console.log('respoiiinsi:', response.data.response);
      setOrderPlacementResponse(response.data.response);

      console.log('stock details here ', stockDetails, allFNO);
      if (allFNO) {
        console.log('All items are FNO. Skipping re-sell logic.');
        setOpenSucessModal(true);
        setOpenReviewTrade(false);
        setBasketData([]);
        //  console.log('basket data now--',basketData);
        await Promise.all([
          updatePortfolioData(broker, userEmail),
          getAllTrades(),
          filterCartAfterOrder(),
          getCartAllStocks(),
        ]);

        eventEmitter.emit('OrderPlacedReferesh');
        eventEmitter.emit('cartUpdated');

        return;
      }

      // Handle empty response as a failed sell order
      if (!response.data.response || response.data.response.length === 0) {
        if (allSell || isMixed) {
          if (broker === 'Dhan') {
            setShowDhanTpinModel(true);
            setOpenReviewTrade(false);
            setLoading(false);
            return;
          } else if (broker === 'Angel One') {
            setShowAngleOneTpinModel(true);
            setOpenReviewTrade(false);
            setLoading(false);
            return;
          } else if (broker === 'Fyers') {
            setShowFyersTpinModal(true);
            setOpenReviewTrade(false);
            setLoading(false);
            return;
          } else if (specialBrokers.includes(broker)) {
            setShowOtherBrokerModel(true);
            setOpenReviewTrade(false);
            setLoading(false);
            return;
          }
        }
      }

      const rejectedSellCount = response.data.response.reduce(
        (count, order) => {
          return isOrderRejected(order?.orderStatus) &&
            order.transactionType === 'SELL'
            ? count + 1
            : count;
        },
        0,
      );

      const successCount = response.data.response.reduce((count, order) => {
        return isOrderSuccess(order?.orderStatus) &&
          (order.transactionType === 'SELL' || tradeType.isMixed)
          ? count + 1
          : count;
      }, 0);

      console.log(`${broker} Rejected Sell Count:`, rejectedSellCount, 'Success Count:', successCount);

      // Special brokers (IIFL, ICICI, Upstox, Kotak, HDFC, AliceBlue, etc.)
      if (
        !isReturningFromOtherBrokerModal &&
        specialBrokers.includes(broker)
      ) {
        if (allBuy) {
          console.log('All trades are BUY for broker:', broker);
          setOpenSucessModal(true);
        } else if ((allSell || isMixed) && rejectedSellCount >= 1) {
          // Match prod: trigger TPIN modal whenever any sell order is rejected
          // Don't gate on successCount — even partial rejection needs TPIN auth
          console.log(
            allSell ? 'All trades are SELL' : 'Trades are Mixed',
            'for broker:',
            broker,
          );
          setShowOtherBrokerModel(true);
          setOpenReviewTrade(false);
          setLoading(false);
          return; // Exit the function early
        } else {
          setOpenSucessModal(true);
        }
      } else if (
        (allSell || isMixed) &&
        rejectedSellCount >= 1
      ) {
        // Match prod: trigger TPIN modal whenever any sell order is rejected.
        // Always show broker-specific TPIN modal for rejected sell orders.
        console.log('Setting TPIN modal to true for', broker);
        setOpenSucessModal(false);
        setOpenReviewTrade(false);

        if (broker === 'Angel One') {
          setShowAngleOneTpinModel(true);
        } else if (broker === 'Dhan') {
          setShowDhanTpinModel(true);
        } else if (broker === 'Fyers') {
          setShowFyersTpinModal(true);
        } else if (broker === 'Zerodha') {
          setShowDdpiModal(true);
        } else {
          // Fallback: show success modal with rejection details
          setOrderPlacementResponse(response.data.response);
          setOpenSucessModal(true);
        }
        return;
      } else {
        console.log('Setting openSuccessModal to true');
        setOrderPlacementResponse(response.data.response);
        setOpenSucessModal(true);
      }
      setOpenReviewTrade(false);
      await Promise.all([
        updatePortfolioData(broker, userEmail),
        getAllTrades(),
        // await clearCart(),
        //  handleCartUpdate(),
        await filterCartAfterOrder(),
        //setStockDetails([]),
        // setCartItems([]),
        setBasketData([]),
        eventEmitter.emit('OrderPlacedReferesh'),
        eventEmitter.emit('cartUpdated'),
        getCartAllStocks(),
      ]);

      //capture fail attempts

      //  if (tradeType.allSell || tradeType.isMixed ) {
      //   setFailedSellAttempts((prev) => {
      //     const newValue = prev + 1;
      //     console.log(`Incrementing failedSellAttempts. New value: ${newValue}`);
      //     return newValue;
      //   });
      // }
    } catch (error) {
      console.error('Error placing order:', error);
      setLoading(false);

      // Check for token expiry / session expired signals
      if (
        error.response?.status === 401 ||
        error.response?.data?.warning?.type === 'TOKEN_EXPIRED' ||
        error.response?.data?.data?.tokenExpired ||
        error.response?.data?.tokenExpired ||
        error.response?.data?.data?.brokerConnected === false ||
        error.response?.data?.message?.toLowerCase()?.includes('token') ||
        error.response?.data?.message?.toLowerCase()?.includes('session')
      ) {
        setOpenTokenExpireModel(true);
        setOpenReviewTrade(false);
        setLoading(false);
        return;
      }

      const edisMessage =
        error.response?.data?.details?.[0]?.message_aq ||
        error.response?.data?.details?.[0]?.message ||
        "There was an issue in placing the trade, please try again later.";

      // Trigger broker-specific TPIN modals for sell order failures
      // Don't gate on is_authorized_for_sell or ddpi_enabled — EDIS expires per-session
      if (allSell || isMixed) {
        if (broker === 'Dhan') {
          setShowDhanTpinModel(true);
          setOpenReviewTrade(false);
          return;
        } else if (broker === 'Angel One') {
          setShowAngleOneTpinModel(true);
          setOpenReviewTrade(false);
          return;
        } else if (broker === 'Fyers') {
          setShowFyersTpinModal(true);
          setOpenReviewTrade(false);
          return;
        } else if (broker === 'Zerodha') {
          setShowDdpiModal(true);
          setOpenReviewTrade(false);
          return;
        } else if (specialBrokers.includes(broker)) {
          setShowOtherBrokerModel(true);
          setOpenReviewTrade(false);
          return;
        }
      }

      // Build synthetic rejected response from stockDetails for the modal
      const syntheticResponse = stockDetails.map(stock => ({
        symbol: stock.tradingSymbol,
        tradingSymbol: stock.tradingSymbol,
        transactionType: stock.transactionType || 'BUY',
        quantity: stock.quantity,
        orderType: stock.orderType || 'MARKET',
        exchange: stock.exchange || 'NSE',
        orderStatus: 'rejected',
        orderPlacement: 'failed',
        orderStatusMessage: edisMessage,
        message_aq: edisMessage,
      }));
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);
      setOpenReviewTrade(false);
    }
    setIsReturningFromOtherBrokerModal(false);
  };

  const processOrderCounts = async response => {
    let rejectedSellCount = 0;
    let successCount = 0;

    response?.data?.response?.forEach(order => {
      const status = order?.orderStatus || '';
      const transactionType = order?.transactionType || '';

      if (isOrderRejected(status) && transactionType === 'SELL') {
        rejectedSellCount++;
      }

      if (isOrderSuccess(status) && transactionType === 'SELL') {
        successCount++;
      }
    });

    return { rejectedSellCount, successCount };
  };

  const appURL = configData?.config?.REACT_APP_HEADER_NAME;
  // zerodha start
  const [webViewVisible, setWebViewVisible] = useState(false); // Track success status
  const [mbasket, setmbasket] = useState(null);
  const webViewRef = useRef(null);
  const [htmlContentfinal, setHtmlContent] = useState('');

  // Helper function to map product type to Kite product type
  const mapKiteProductType = (productType) => {
    if (!productType) return "CNC";
    const upper = productType.toUpperCase();
    if (upper === "DELIVERY" || upper === "CNC") return "CNC";
    if (upper === "INTRADAY" || upper === "MIS") return "MIS";
    if (upper === "BO") return "BO";
    if (upper === "CO") return "CO";
    return "CNC";
  };

  // Helper function to map order type to Kite order type
  const mapKiteOrderType = (orderType) => {
    if (!orderType) return "MARKET";
    const upper = orderType.toUpperCase();
    if (upper === "MARKET") return "MARKET";
    if (upper === "LIMIT") return "LIMIT";
    if (upper === "SL" || upper === "SL_M" || upper === "STOP") return "SL";
    return "MARKET";
  };

  const handleZerodhaRedirect = async () => {
    // Pre-flight: refuse to send orders with missing exchange. Kite Publisher
    // silently drops basket items whose symbol/exchange combo it can't resolve.
    const exchangeCheck = validateStockExchanges(stockDetails);
    if (!exchangeCheck.valid) {
      const missingList = exchangeCheck.missing.join(', ');
      console.error('[ZerodhaPublisher] Blocked due to missing exchange:', missingList);
      Toast.show({
        type: 'error',
        text1: 'Order blocked — missing exchange',
        text2: `Missing exchange for: ${missingList}. Please contact your advisor.`,
        visibilityTime: 8000,
      });
      setOpenReviewTrade(false);
      return;
    }

    const apiKey = zerodhaApiKey;

    const basket = stockDetails.map(stock => {
      // Scripmaster-resolved symbol/exchange (-EQ strip, BE→BSE, etc).
      const resolved = resolveZerodhaSymbol(stock, symbolMap);
      // LTP: live ws on resolved → live on raw → server-cached fallback.
      const liveLtp = getLastKnownPrice(resolved.tradingsymbol) || getLastKnownPrice(stock.tradingSymbol);
      const ltp = liveLtp && liveLtp !== '-' && parseFloat(liveLtp) > 0
        ? liveLtp
        : resolved.cachedLtp || 0;
      let orderPrice = 0;

      if (stock.orderType === 'LIMIT') {
        orderPrice = parseFloat(stock.price || 0);
      } else if (stock.orderType === 'MARKET' || stock.orderType === 'SL') {
        orderPrice = ltp && ltp !== '-' ? parseFloat(ltp) : 0;
      }

      let baseOrder = {
        variety: 'regular',
        tradingsymbol: resolved.tradingsymbol,
        // exchange from scripmaster (stock.exchange is the fallback — guaranteed non-empty by validateStockExchanges()).
        exchange: resolved.exchange,
        transaction_type: (stock.transactionType || 'BUY').toUpperCase(),
        order_type: mapKiteOrderType(stock.orderType),
        quantity: parseInt(stock.quantity, 10) || 1,
        product: mapKiteProductType(stock.productType),
        readonly: false,
        price: orderPrice,
        zerodhaTradeId: stock.zerodhaTradeId,
      };

      if (stock.quantity > 100) {
        baseOrder.readonly = true;
      }

      // MARKET → LIMIT-IOC with 1% market-protection buffer (dodges Kite's
      // "MARKET orders are blocked — enable market protection" on GSM/T2T/BE stocks).
      const protectedOrder = applyKiteMarketProtection(baseOrder, ltp, stock.transactionType);

      console.log('[ZerodhaPublisher] Basket item:', JSON.stringify(protectedOrder));

      return protectedOrder;
    });
    const currentISTDateTime = new Date();

    try {
      // Update the database with the current IST date-time
      await axios.put(`${server.server.baseUrl}api/zerodha/update-trade-reco`, {
        stockDetails: stockDetails,
        leaving_datetime: currentISTDateTime,
      });

      // Generate HTML form content
      const htmlContent = generateHtmlForm(basket, apiKey);
      setHtmlContent(htmlContent);
      // Inject the HTML form into WebView
    } catch (error) {
      console.error('Failed to update trade recommendation:', error);
    }
  };

  const generateHtmlForm = (basket, apiKey) => {
    return `<html>
        <body>
          <form id="zerodhaForm" method="POST" action="https://kite.zerodha.com/connect/basket">
            <input type="hidden" name="api_key" value="${apiKey}" />
            <input type="hidden" name="data" value='${JSON.stringify(
      basket,
    )}' />
            <input type="hidden" name="redirect_params" value="${appURL}=true" />
          </form>
          <script>
            document.getElementById('zerodhaForm').submit();
          </script>
        </body>
      </html>
    `;
  };

  const [zerodhaStockDetails, setZerodhaStockDetails] = useState(null);
  const [zerodhaAdditionalPayload, setZerodhaAdditionalPayload] =
    useState(null);

  const checkZerodhaStatus = async () => {
    const currentISTDateTime = new Date();
    const istDatetime = moment(currentISTDateTime).format();

    if (zerodhaStatus !== null && zerodhaRequestType === 'basket') {
      // Use Publisher flow - call publisher/record-orders endpoint
      // This fetches order book from Zerodha and matches with our trades
      console.log('[ZerodhaPublisher] Recording publisher orders...');

      const recordConfig = {
        method: 'post',
        url: `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
        data: JSON.stringify({
          stockDetails: zerodhaStockDetails,
          publisherResults: [{ status: 'success', batchIndex: 0 }],
          userEmail: userEmail,
          broker: 'Zerodha',
          advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
        }),
      };

      try {
        const response = await axios.request(recordConfig);
        console.log('[ZerodhaPublisher] Record orders response:', response.data.response);

        const orderResults = response.data.response || response.data.results || [];

        setOrderPlacementResponse(orderResults);
        setOpenSucessModal(true);
        setOpenReviewTrade(false);
        getAllTrades();
        updatePortfolioData();

        // Await AsyncStorage removal for confirmation
        await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      } catch (error) {
        console.error('Order placement failed:', error);
        // Build synthetic rejected response from stockDetails for the modal
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          'Orders cannot be placed. Please try again later.';
        const syntheticResponse = (zerodhaStockDetails || []).map(stock => ({
          symbol: stock.tradingSymbol,
          tradingSymbol: stock.tradingSymbol,
          transactionType: stock.transactionType || 'BUY',
          quantity: stock.quantity,
          orderType: stock.orderType || 'MARKET',
          exchange: stock.exchange || 'NSE',
          orderStatus: 'rejected',
          orderPlacement: 'failed',
          orderStatusMessage: errorMessage,
          message_aq: errorMessage,
        }));
        setOrderPlacementResponse(syntheticResponse);
        setOpenSucessModal(true);
        setOpenReviewTrade(false);
      }
    }
  };

  const fetchBrokerStatusModal = async () => {
    getAllFunds();
    getUserDeatils();
    if (userEmail) {
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
        const userData = response.data.User;
        setcreateDate(userData.created_at);
        //setIsBrokerConnected(!!userData?.user_broker);
        // console.log('corrected');
      } catch (error) {
        //   console.error('Error fetching broker status:', error.response?.data || error.message);
        // setIsBrokerConnected(false); // Handle error by setting default status
      } finally {
        setLoading(false);
      }
    }
  };

  const handleIgnoredTrades = (id, ignoreText) => {
    setLoading(true);
    let data = JSON.stringify({
      uid: id,
      trade_place_status: 'ignored',
      reason: ignoreText,
    });
    let config = {
      method: 'put',
      url: `${server.server.baseUrl}api/recommendation`,

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
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'You have successfully ignored your trade.',
          visibilityTime: 5000,
          position: 'bottom',
          bottomOffset: 40,
          style: {
            backgroundColor: 'white',
            borderLeftColor: 'green',
            borderLeftWidth: 5,
            padding: 10,
          },
          textStyle: {
            color: 'green',
            fontWeight: 'bold',
            fontSize: 16,
          },
        });
        //  console.log("After Toast");
        setLoading(false);
        setModalVisible(false);
        getAllTrades();
      })
      .catch(error => {
        console.error(`Error ignoring the trade:`, error.response.data);
        setLoading(false);
      });
  };

  const handleQuantityInputChange = (symbol, value, tradeId) => {
    if (!value || value === '') {
      const newData = stockRecoNotExecuted.map(stock =>
        stock.Symbol === symbol && stock.tradeId === tradeId
          ? { ...stock, Quantity: '' }
          : stock,
      );
      setStockRecoNotExecuted(newData);
      setrecommendationStock(newData);
    } else {
      const newData = stockRecoNotExecuted.map(stock =>
        stock.Symbol === symbol && stock.tradeId === tradeId
          ? { ...stock, Quantity: parseInt(value) }
          : stock,
      );
      setStockRecoNotExecuted(newData);
      setrecommendationStock(newData);
    }
  };

  const handleLimitOrderInputChange = (symbol, value, tradeId) => {
    // Match web: accept up to 2 decimals, reject silently otherwise so the
    // field behaves consistently. Keeps the value as a string so ₹123.45
    // round-trips instead of being truncated by parseInt.
    let formattedValue = value;
    if (value) {
      const regex = /^\d*\.?\d{0,2}$/;
      if (!regex.test(value)) {
        return;
      }
      formattedValue = value;
    } else {
      formattedValue = '';
    }

    const newData = stockRecoNotExecuted.map(stock =>
      stock.Symbol === symbol && stock.tradeId === tradeId
        ? { ...stock, Price: formattedValue }
        : stock,
    );
    setStockRecoNotExecuted(newData);
    setrecommendationStock(newData);

    // Persist to cart so the limit price survives refresh / app restart
    // (web does this in NewStockCard.handleLimitOrderInputChange).
    axios
      .post(
        `${server.server.baseUrl}api/cart/update`,
        { tradeId, price: formattedValue },
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
      )
      .then(() => getCartAllStocks())
      .catch(error => {
        console.error('Error updating cart limit price:', error?.response?.data || error?.message);
      });
  };

  const handleSelectAllStocks = async () => {
    const newStockDetails = stockRecoNotExecuted.reduce((acc, stock) => {
      const isSelected = stockDetails.some(
        selectedStock =>
          selectedStock.tradingSymbol === stock.Symbol &&
          selectedStock.tradeId === stock.tradeId,
      );

      if (!isSelected) {
        const ltp = 0; //getLTPForSymbol(stock.Symbol);
        const advisedRangeLower = stock.Advised_Range_Lower;
        const advisedRangeHigher = stock.Advised_Range_Higher;

        const shouldDisableTrade =
          (advisedRangeHigher === 0 && advisedRangeLower === 0) ||
          (advisedRangeHigher === null && advisedRangeLower === null) ||
          (advisedRangeHigher > 0 &&
            advisedRangeLower > 0 &&
            parseFloat(advisedRangeHigher) >= parseFloat(ltp) &&
            parseFloat(ltp) >= parseFloat(advisedRangeLower)) ||
          (advisedRangeHigher > 0 &&
            advisedRangeLower === 0 &&
            advisedRangeLower === null &&
            parseFloat(advisedRangeHigher) >= parseFloat(ltp)) ||
          (advisedRangeLower > 0 &&
            advisedRangeHigher === 0 &&
            advisedRangeHigher === null &&
            parseFloat(advisedRangeLower) <= parseFloat(ltp));

        if (shouldDisableTrade) {
          const newStock = {
            user_email: stock.user_email,
            trade_given_by: stock.trade_given_by,
            tradingSymbol: stock.Symbol,
            transactionType: stock.Type,
            exchange: stock.Exchange,
            segment: stock.Segment,
            productType:
              stock.Exchange === 'NFO' || stock.Exchange === 'BFO'
                ? 'CARRYFORWARD'
                : stock.ProductType, //
            orderType: stock.OrderType,
            price: stock.Price,
            quantity: stock.Quantity,
            priority: stock.Priority,
            tradeId: stock.tradeId,
            user_broker: broker,
            zerodhaTradeId: stock.zerodhaTradeId,
          };
          acc.push(newStock);
        }
      }

      return acc;
    }, []);

    if (newStockDetails.length > 0) {
      try {
        await axios.post(
          `${server.server.baseUrl}api/cart/add/add-multiple-to-cart`,
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
          {
            stocks: newStockDetails,
          },
        );
        getCartAllStocks();
      } catch (error) {
        console.error('Error adding stocks to cart', error);
      }
    }
  };

  const handleRemoveAllSelectedStocks = async () => {
    try {
      // Use all stock details in the cart for removal
      const stocksToRemove = [...stockDetails];

      if (stocksToRemove.length > 0) {
        await axios.post(
          `${server.server.baseUrl}api/cart/cart-items/remove/multiple/remove-multiple-from-cart`,
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
          {
            stocks: stocksToRemove,
          },
        );
        // Clear stockDetails since all stocks are removed
        setStockDetails([]);
        getCartAllStocks(); // Refresh the cart
      }
    } catch (error) {
      console.error('Error removing stocks from cart', error);
    }
  };

  const handleIncreaseStockQty = (symbol, tradeId) => {
    const newData = stockRecoNotExecuted.map(stock =>
      stock.Symbol === symbol && stock.tradeId === tradeId
        ? { ...stock, Quantity: stock.Quantity + 1 }
        : stock,
    );
    setStockRecoNotExecuted(newData);
    setrecommendationStock(newData);
  };

  const handleDecreaseStockQty = (symbol, tradeId) => {
    const newData = stockRecoNotExecuted.map(stock =>
      stock.Symbol === symbol && stock.tradeId === tradeId
        ? { ...stock, Quantity: Math.max(stock.Quantity - 1, 0) }
        : stock,
    );
    setStockRecoNotExecuted(newData);
    setrecommendationStock(newData);
  };

  const handleTradeNow = () => {
    console.log('trades presssss');
    setOpenReviewTrade(true); // Set the state to open the modal
  };

  //console.log('TYPEEE ITEMSSSS:',types);
  const hasBuy = types.every(type => type === 'BUY');
  const hasSell = types.every(type => type === 'SELL');
  const allSell = hasSell && !hasBuy;
  const allBuy = hasBuy && !hasSell;
  const isMixed = hasSell && hasBuy;

  const handleTrade = async () => {
    setTradeClickCount(prevCount => prevCount + 1);
    fetchCart();
    // Stale-closure fix (2026-04-18, extended 2026-04-22):
    // `useRefreshBrokerStatus` fetches fresh user + funds inline. Shadows
    // the closure `broker` / `brokerStatus` / `funds` so every downstream
    // check in this handler reads post-reconnect state, not stale context.
    const _closureBroker = broker;
    const _closureBrokerStatus = brokerStatus;
    const _closureFunds = funds;
    const freshStatus = await refreshBrokerStatus({forceNetwork: true});
    const freshUser = freshStatus?.userDetails;
    // eslint-disable-next-line no-shadow
    const broker = freshStatus?.broker ?? _closureBroker;
    // eslint-disable-next-line no-shadow
    const brokerStatus = freshStatus?.brokerStatus ?? _closureBrokerStatus;
    // eslint-disable-next-line no-shadow
    const funds = freshStatus?.funds ?? _closureFunds;
    // Populate stockDetails from cartContainer before opening the review
    // modal. cartContainer is the live cart; stockDetails is the trade-intent
    // payload ReviewTradeModal reads. We merge any existing stockDetails
    // entries (which may carry in-flight quantity / price edits) on top of
    // the cart so user edits are preserved. This bottom-bar "Trade (N)"
    // path is how multi-select cart trades reach the review modal — since
    // 2026-04-17 updateCartStates no longer writes stockDetails, so this
    // sync must happen here explicitly.
    const mergedTradeIntent = (cartContainer || []).map(cartItem => {
      const edited = stockDetails.find(
        s =>
          s.tradingSymbol === cartItem.tradingSymbol &&
          s.tradeId === cartItem.tradeId,
      );
      return edited ? {...cartItem, ...edited} : cartItem;
    });
    setStockDetails(mergedTradeIntent);

    // Transient-aware — Upstox funds/place-order endpoints return status=1
    // Typed pre-flight — TRANSIENT (Upstox 00:00–05:30 IST maintenance,
    // ICICI base-64 hiccup, etc.) shows a soft toast and bails out
    // without prompting reconnect; TOKEN_EXPIRED opens the existing
    // TokenExpire modal. `isFundsEmpty` retained for downstream
    // broker-branch checks below — true only on real auth failure,
    // false on TRANSIENT (those bail above) and OK.
    const _fundsPreflight = classifyFundsResponse(funds, brokerStatus, broker);
    if (_fundsPreflight.reason === 'TRANSIENT') {
      Toast.show({
        type: 'info',
        text1: `${broker || 'Broker'} temporarily unavailable`,
        text2: _fundsPreflight.message,
        visibilityTime: 4500,
        position: 'bottom',
      });
      return;
    }
    const isFundsEmpty = !_fundsPreflight.ok;

    const currentBroker = freshUser?.user_broker ?? userDetails?.user_broker;
    const currentBrokerRejectedCount = await getRejectedCount();
    if (isFundsEmpty) {
      setOpenTokenExpireModel(true);
      return; // Exit as funds are empty
    } else if (brokerStatus === null || brokerStatus === undefined) {
      setBrokerModel(true);
      return;
    }

    if (broker === 'Zerodha') {
      if (isFundsEmpty) {
        setOpenTokenExpireModel(true);
        return; // Exit as funds are empty
      } else if (brokerStatus === null) {
        setBrokerModel(true);
        return;
      }
      // If not funds empty, proceed with Zerodha-specific logic
      if (allBuy) {
        console.log('hrere');
        setOpenReviewTrade(true);
      } else if (tradeType?.allSell || tradeType?.isMixed) {
        console.log('All sells got');

        // Handle DDPI modal logic for SELL or mixed trades
        // If user has completed TPIN authorization or has active DDPI, proceed
        const canSell = userDetails?.is_authorized_for_sell ||
          ['physical', 'ddpi'].includes(userDetails?.ddpi_status);
        if (canSell) {
          console.log('Valid DDPI status, no modal needed');
          setShowDdpiModal(false); // Hide DDPI Modal
          setOpenReviewTrade(true); // Proceed with Zerodha modal
        } else {
          console.log('Show DDPI modal');
          setShowDdpiModal(true); // Show DDPI Modal for invalid or missing status
          setOpenReviewTrade(false); // Ensure Zerodha modal is closed
        }
      } else {
        setOpenReviewTrade(true);
      }
    } else if (broker === 'Angel One') {
      if (allBuy) {
        console.log('All trades are BUY for Angel One');
        setOpenReviewTrade(true);
      } else if (
        (allSell || isMixed) &&
        !userDetails?.ddpi_enabled &&
        !userDetails?.is_authorized_for_sell
      ) {
        console.log('DDPI not enabled and not authorized for sell for Angel One.');
        setShowAngleOneTpinModel(true); // Show TPIN modal
      } else {
        console.log(
          `All trades for Angel One: ${allBuy ? 'BUY' : allSell ? 'SELL' : 'Mixed'}`,
        );
        setOpenReviewTrade(true);
      }
    } else if (broker === 'Dhan') {
      if (dhanEdisStatus && dhanEdisStatus?.data && dhanEdisStatus?.data?.length > 0 && dhanEdisStatus?.data?.every((h) => h.edis === true)) {
        console.log(
          `All trades for Dhan: ${allBuy ? 'BUY' : allSell ? 'SELL' : 'Mixed'}`,
        );
        setOpenReviewTrade(true); // All holdings authorized, proceed
      } else if (
        (allSell || isMixed) &&
        (!dhanEdisStatus || !dhanEdisStatus?.data || dhanEdisStatus?.data?.length === 0 || dhanEdisStatus?.data?.some((h) => h.edis === false))
      ) {
        console.log(
          'edisStatus is missing or not valid for Dhan.',
          allSell,
          isMixed,
        );
        setShowDhanTpinModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    } else if (broker === 'Fyers') {
      if (isFundsEmpty) {
        setOpenTokenExpireModel(true);
        return; // Exit as funds are empty
      } else if (brokerStatus === null) {
        setBrokerModel(true);
        return;
      } else {
        setOpenReviewTrade(true);
      }
    } else {
      // Fallback for brokers not mentioned above
      console.log(
        'Fallback: Broker not explicitly handled. Opening review modal.',
      );
      setOpenReviewTrade(true);
    }
  };

  const handleTradeBasket = async () => {
    // Inline-fresh broker + funds (closure lags one render after a reconnect).
    const _closureBroker = broker;
    const _closureBrokerStatus = brokerStatus;
    const _closureFunds = funds;
    const freshStatus = await refreshBrokerStatus({forceNetwork: true});
    // eslint-disable-next-line no-shadow
    const broker = freshStatus?.broker ?? _closureBroker;
    // eslint-disable-next-line no-shadow
    const brokerStatus = freshStatus?.brokerStatus ?? _closureBrokerStatus;
    // eslint-disable-next-line no-shadow
    const funds = freshStatus?.funds ?? _closureFunds;

    // Broker check FIRST (matching web BasketModal.js)
    if (brokerStatus !== 'connected') {
      setBrokerModel(true);
      return;
    }

    if (_haltOnFundsCheckFailure(funds, brokerStatus, broker)) {
      return;
    }

    if (broker === 'Zerodha') {
      if (allBuy) {
        setOpenReviewTrade(true);
      } else if (allSell || isMixed) {
        // If user has completed TPIN authorization or has active DDPI, proceed
        const canSellZerodha = userDetails?.is_authorized_for_sell ||
          ['physical', 'ddpi'].includes(userDetails?.ddpi_status);
        if (canSellZerodha) {
          setShowDdpiModal(false);
          setOpenReviewTrade(true);
        } else {
          setShowDdpiModal(true);
          setOpenReviewTrade(false);
        }
      } else {
        setOpenReviewTrade(true);
      }
    } else if (broker === 'Angel One') {
      if (allBuy) {
        setOpenReviewTrade(true);
      } else if (
        (allSell || isMixed) &&
        !userDetails?.ddpi_enabled &&
        !userDetails?.is_authorized_for_sell
      ) {
        setShowAngleOneTpinModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    } else if (broker === 'Dhan') {
      if (dhanEdisStatus && dhanEdisStatus?.data && dhanEdisStatus?.data?.length > 0 && dhanEdisStatus?.data?.every((h) => h.edis === true)) {
        setOpenReviewTrade(true);
      } else if (
        (allSell || isMixed) &&
        (!dhanEdisStatus || !dhanEdisStatus?.data || dhanEdisStatus?.data?.length === 0 || dhanEdisStatus?.data?.some((h) => h.edis === false))
      ) {
        setShowDhanTpinModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    } else {
      setOpenReviewTrade(true);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
  };

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
        fontFamily: 'Satoshi-Medium', // Customize your font
      },
      text2Style: {
        color: 'black',
        fontSize: 12,
        fontFamily: 'Satoshi-Regular', // Customize your font
      },
    });
  };

  const [cartContainer, setCartContainer] = useState([]);

  const fetchCartItems = async () => {
    try {
      const cartItemsKey = 'cartItems';

      // Load cart items from AsyncStorage
      const cartData = await AsyncStorage.getItem(cartItemsKey);
      const cartItems = cartData ? JSON.parse(cartData) : [];

      // Set cart items into the state
      setCartContainer(cartItems);
     // console.log('Cart items loaded:', cartItems);
    } catch (error) {
      console.error('Error loading cart items:', error);
    }
    //  console.timeEnd('computationTime1');
  };
  useEffect(() => {
    // Listen for the event and call clearCart when triggered
    const handleEvent = cartItems => {
      console.log('Event received, clearing cart...');
      fetchCartItems();
    };

    eventEmitter.on('GetAllTradeReferesh', handleEvent);

    // Cleanup function
    return () => {
      eventEmitter.off('GetAllTradeReferesh', handleEvent);
    };
  }, []);

  const cartItemsKey = 'cartItems'; // Key for local storage
  const loadCartFromLocalStorage = async () => {
    try {
      const cartData = await AsyncStorage.getItem(cartItemsKey);
      return cartData ? JSON.parse(cartData) : [];
    } catch (error) {
      console.error('Error loading cart items from local storage', error);
      return [];
    }
  };
  const [stocksWithoutSource, setStocksWithoutSource] = useState(stockDetails); // Initialize with stockDetails
  const fetchCart = async () => {
    const filteredStocks = await loadCartFromLocalStorage();
    setStocksWithoutSource(filteredStocks);
  };

  // On mount (and when `type` changes), hydrate React cart state from
  // AsyncStorage. cartContainer drives UI (badges, "Trade (N)" count,
  // isSelected). stocksWithoutSource drives the "Ignore Trades" screen's
  // cart view. Both mirror the persistent cart.
  //
  // stockDetails is intentionally NOT set here — it's trade-intent state,
  // populated explicitly by handleSingleSelectStock (single) or handleTrade /
  // handleTradeNow1 (bottom-bar Trade (N)) at the moment the user asks to
  // open the review modal. Matches web where the server cart and the
  // modal's trade payload are separate concepts.
  useEffect(() => {
    const syncCartWithStockDetails = async () => {
      const localCart = await loadCartFromLocalStorage();
      setCartContainer(localCart);
      setStocksWithoutSource(localCart);
    };

    syncCartWithStockDetails();
  }, [type]);

  // Mirrors the server/local cart into React state for UI display (badges,
  // "Trade (N)" button count, isSelected flag on each card).
  //
  // IMPORTANT: this function only updates `cartContainer` — it does NOT touch
  // `stockDetails`. `stockDetails` is the "trade-intent" state (what the user
  // is about to submit in the ReviewTradeModal), a separate concept from the
  // cart. Web does the same separation (web's cart is server-side via
  // `/api/cart` and never pollutes local `stockDetails`).
  //
  // Trade-intent is set explicitly at each boundary:
  //   - `handleSingleSelectStock`      → setStockDetails([newStock])   (single)
  //   - `handleTrade` / `handleTradeNow1` → merge cartContainer + edits (Trade N)
  //   - `handleRemoveAllSelectedStocks`  → setStockDetails([])
  //   - `syncCartWithStockDetails` effect → initial mount populate
  //
  // Before 2026-04-17 this function ALSO wrote `setStockDetails(items)`,
  // which caused a single Trade-Now click to open the review modal with
  // EVERY item in the cart (including stale rejected trades) because
  // `handleSelectStock('add')` runs before the subsequent
  // `setStockDetails([newStock])` reset — the cart-sync write leaked into
  // the modal render. See CHANGELOG 2026-04-17 "Trade Now modal shows
  // extra cart items".
  const updateCartStates = useCallback(items => {
    setCartContainer(items);
  }, []);

  //const cartItemsCallback = useCallback((items) => items, []);

  const handleSelectStock = async (symbol, tradeId, action, screen) => {
    // await fetchCartItems();
    const startTotal = performance.now();
    const timings = {};
    try {
      console.log('Starting handleSelectStock:', {
        symbol,
        tradeId,
        action,
        screen,
      });

      // Timing: Initial setup
      const startSetup = performance.now();
      // const cartItemsKey = 'cartItems';
      const cartItemsString = await AsyncStorage.getItem('cartItems');
      let cartItems = cartItemsString ? JSON.parse(cartItemsString) : [];

      console.log('CART CONTAINER I HAVE-----', cartItems);
      const itemKey = `${symbol}-${tradeId}`;
      timings.setup = performance.now() - startSetup;

      // Timing: Map creation
      const startMapCreation = performance.now();
      const cartItemMap = new Map(
        cartItems.map(item => [`${item.tradingSymbol}-${item.tradeId}`, item]),
      );
      timings.mapCreation = performance.now() - startMapCreation;

      // Timing: Action processing
      const startAction = performance.now();
      if (action === 'remove') {
        console.log('Removing item:', itemKey);
        cartItemMap.delete(itemKey);
      } else if (action === 'add') {
        if (!cartItemMap.has(itemKey)) {
          console.log('Finding stock in recommendations...');
          const startFindStock = performance.now();
          const updatedStock = recommendationStock.find(
            item => item.Symbol === symbol && item.tradeId === tradeId,
          );
          timings.findStock = performance.now() - startFindStock;

          if (updatedStock) {
            console.log('Creating new stock object...');
            const startCreateStock = performance.now();
            const newStock = {
              user_email: updatedStock.user_email,
              trade_given_by: updatedStock.trade_given_by,
              tradingSymbol: updatedStock.Symbol,
              transactionType: updatedStock.Type,
              exchange: updatedStock.Exchange,
              segment: updatedStock.Segment,
              productType:
                updatedStock.Exchange === 'NFO' ||
                  updatedStock.Exchange === 'BFO'
                  ? 'CARRYFORWARD'
                  : updatedStock.ProductType,
              orderType: updatedStock.OrderType,
              price: updatedStock.Price,
              quantity: updatedStock.Quantity,
              priority: updatedStock.Priority || 1,
              tradeId: updatedStock.tradeId,
              user_broker: broker,
              zerodhaTradeId: updatedStock.zerodhaTradeId,
            };
            cartItemMap.set(itemKey, newStock);
            timings.createStock = performance.now() - startCreateStock;
          }
        }
      }
      timings.actionProcessing = performance.now() - startAction;

      // Timing: Map to array conversion
      const startConversion = performance.now();
      cartItems = Array.from(cartItemMap.values());
      timings.mapToArray = performance.now() - startConversion;
      console.log('CART BEFORE SETTING---', cartItems);
      // Timing: AsyncStorage operation
      const startStorage = performance.now();
      await AsyncStorage.setItem(cartItemsKey, JSON.stringify(cartItems));

      const storedCartItems = await AsyncStorage.getItem(cartItemsKey);
      //console.log('Stored Cart Items in AsyncStorage:', storedCartItems);
      fetchCart();
      console.log('cart items i get::', storedCartItems);
      timings.asyncStorage = performance.now() - startStorage;

      // Timing: State updates
      const startStateUpdates = performance.now();
      updateCartStates(cartItems);
      timings.stateUpdates = performance.now() - startStateUpdates;
      const cartLength = cartItems.length;
      // Timing: Event emission
      const startEvent = performance.now();
      eventEmitter.emit('cartUpdated');
      timings.eventEmission = performance.now() - startEvent;

      // UX feedback — the cart icon in the top toolbar updates via the
      // cartUpdated listener, but a toast makes the action visible on the
      // current screen too (the icon can be out of frame on scroll).
      if (action === 'add') {
        Toast.show({
          type: 'success',
          text1: 'Added to cart',
          text2: `${symbol} · ${cartItems.length} item${cartItems.length === 1 ? '' : 's'} in cart`,
          position: 'bottom',
          visibilityTime: 2000,
        });
      } else if (action === 'remove') {
        Toast.show({
          type: 'info',
          text1: 'Removed from cart',
          text2: `${symbol} · ${cartItems.length} item${cartItems.length === 1 ? '' : 's'} left`,
          position: 'bottom',
          visibilityTime: 1800,
        });
      }

      const startModal = performance.now();
      //  console.log('Updated cartContainer state:', cartContainer);
      if (type === 'home' && screen !== 'handlesingle') {
        console.log(
          'Action we get:;;;;;;;;;;;;;;;;;;:::::::::::::::::::::::::::;',
          action,
        );
        showAddToCartModal(() => cartItems);
      }
      timings.modalHandling = performance.now() - startModal;

      // Calculate total time
      const totalTime = performance.now() - startTotal;

      // Log all timings
      console.log('Performance Breakdown (in milliseconds):', {
        totalTime: totalTime.toFixed(2),
        setup: timings.setup.toFixed(2),
        mapCreation: timings.mapCreation.toFixed(2),
        actionProcessing: timings.actionProcessing.toFixed(2),
        findStock: timings.findStock?.toFixed(2) || 'N/A',
        createStock: timings.createStock?.toFixed(2) || 'N/A',
        mapToArray: timings.mapToArray.toFixed(2),
        asyncStorage: timings.asyncStorage.toFixed(2),
        stateUpdates: timings.stateUpdates.toFixed(2),
        eventEmission: timings.eventEmission.toFixed(2),
        modalHandling: timings.modalHandling.toFixed(2),
      });

      // Identify slow operations (more than 100ms)
      const slowOperations = Object.entries(timings)
        .filter(([_, time]) => time > 100)
        .map(([operation, time]) => `${operation}: ${time.toFixed(2)}ms`);

      if (slowOperations.length > 0) {
        console.warn('Slow operations detected:', slowOperations);
      }
    } catch (error) {
      console.error('Error in handleSelectStock:', error);
      const errorTime = performance.now() - startTotal;
      console.log(`Function failed after ${errorTime.toFixed(2)}ms`);
      throw error;
    }
  };

  const filterCartAfterOrder = async () => {
    try {
      const cartItemsString = await AsyncStorage.getItem('cartItems');

      if (cartItemsString) {
        let cartItems = JSON.parse(cartItemsString);
        //  console.log('cart items in -----',cartItemsString);
        //  console.log('cart items in -----stock',stockDetails);
        // Filter out items in stockDetails that are also in cartItems
        const updatedCartItems = cartItems.filter(
          cartItem =>
            !stockDetails.some(
              stockDetail =>
                stockDetail.tradingSymbol === cartItem.tradingSymbol &&
                stockDetail.tradeId === cartItem.tradeId,
            ),
        );

        // Save updated cart to AsyncStorage
        await AsyncStorage.setItem(
          'cartItems',
          JSON.stringify(updatedCartItems),
        );

        // Now update stockDetails too by removing the items that are not in updatedCartItems
        const updatedStockDetails = stockDetails.filter(stockDetail =>
          updatedCartItems.some(
            item =>
              item.tradingSymbol === stockDetail.tradingSymbol &&
              item.tradeId === stockDetail.tradeId,
          ),
        );
        console.log('updated cart items---->>>>>>>>>>>', updatedCartItems);
        console.log('updated stock details---->>>>>', updatedStockDetails);
        // Update the state to reflect changes in UI
        setStockDetails(updatedStockDetails);
      } else {
        console.log('No cartItems found in AsyncStorage');
      }
    } catch (error) {
      console.error('Error filtering cart items after order placement:', error);
    }
  };

  // Helper function to get the cart items from AsyncStorage
  const getCartAllStocks = async () => {
    // Start timer before the computation block
    console.log('this get called------------>>>>>>>>>>>>>>>>.');
    const cartData = await AsyncStorage.getItem('cartItems');
    if (cartData) {
      const parsedCartData = JSON.parse(cartData);
      // console.log('Parredeeddddddddddddddddd:',parsedCartData);

      // Extract types from cart data
      const extractedTypes = parsedCartData.map(stock => stock.transactionType);
      setTypes(extractedTypes);

      // Determine if SELL or BUY types exist
      const hasSell = extractedTypes.some(type => type === 'SELL');
      const hasBuy = extractedTypes.some(type => type === 'BUY');
      const allSell = hasSell && !hasBuy;
      const allBuy = hasBuy && !hasSell;
      const isMixed = hasSell && hasBuy;

      const newTradeType = {
        allSell: allSell,
        allBuy: allBuy,
        isMixed: isMixed,
      };

      // Set the new trade type and store it in localStorage
      setTradeType(newTradeType);
      AsyncStorage.setItem('storedTradeType', JSON.stringify(newTradeType));

      // Create an array of type and symbol for each stock
      const typeAndSymbol = parsedCartData.map(stock => ({
        Symbol: stock.tradingSymbol,
        Type: stock.transactionType,
        Exchange: stock.exchange,
      }));

      setStockTypeAndSymbol(typeAndSymbol);
    } else {
      // Handle case where cartData is null or empty
      setTypes([]);
      setTradeType({});
      setStockTypeAndSymbol([]);
    }
    return cartData ? JSON.parse(cartData) : [];
  };

  const handleexpire = () => {
    setOpenTokenExpireModel(true);
  };
  const openBrokerSelectionModal = () => {
    setModalVisible1(true);
  };

  const [stockTypeAndSymbol, setStockTypeAndSymbol] = useState([]);
  const [pendingManualTrade, setPendingManualTrade] = useState(null);
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const [isManualConfirmLoading, setIsManualConfirmLoading] = useState(false);

  // Auto-show confirm modal when broker modal closes with a pending trade (matching web)
  const prevBrokerModel = useRef(brokerModel);
  useEffect(() => {
    if (prevBrokerModel.current === true && brokerModel === false && pendingManualTrade) {
      setTimeout(() => setShowManualConfirm(true), 300);
    }
    prevBrokerModel.current = brokerModel;
  }, [brokerModel, pendingManualTrade]);

  // Reject/cancel a basket recommendation (matching web StockRecommendation.js)
  const handleCancelBasket = async (basketId) => {
    try {
      await axios.put(
        `${server.ccxtServer.baseUrl}comms/reco/cancel/${basketId}`,
        {},
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
      Toast.show({type: 'success', text1: 'Basket rejected successfully'});
      await getAllTrades();
    } catch (err) {
      console.error('Error cancelling basket:', err);
      Toast.show({type: 'error', text1: 'Failed to reject basket'});
    }
  };

  // "Continue without broker" for bespoke — save preference, refresh as DummyBroker, then proceed
  const handleContinueWithoutBrokerBespoke = async () => {
    try {
      // Step 1: Save no-broker preference (matching web connectBroker.js)
      await axios.put(
        `${server.ccxtServer.baseUrl}comms/no-broker-required/save`,
        {userEmail: userEmail, noBrokerRequired: true},
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

      // Step 2: Refresh user details so broker becomes DummyBroker
      await getUserDeatils();

      // Step 3: Close broker modal and proceed
      setBrokerModel(false);

      // For basket orders, open review trade modal — DummyBroker handles placement
      if (isBasket) {
        setOpenReviewTrade(true);
        return;
      }

      // For single bespoke trades, show manual confirmation
      if (stockDetails.length === 0 && !pendingManualTrade) return;
      setShowManualConfirm(true);
    } catch (err) {
      console.error('Error saving no-broker preference:', err);
      Toast.show({type: 'error', text1: 'Failed to continue. Try again.'});
      setBrokerModel(false);
    }
  };

  const handleConfirmManuallyPlaced = async () => {
    if (!pendingManualTrade && stockDetails.length === 0) return;
    setIsManualConfirmLoading(true);
    try {
      // If single pending trade (from card action), mark just that one
      // If batch (from continue without broker), mark all stockDetails
      const tradesToMark = pendingManualTrade ? [pendingManualTrade] : stockDetails;

      for (const trade of tradesToMark) {
        await axios.put(
          `${server.server.baseUrl}api/recommendation`,
          {uid: trade._id || trade.tradeId, trade_place_status: 'manually_placed'},
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
      }

      // Build synthetic order response so the success modal shows status (matching web)
      const syntheticResponse = tradesToMark.map(trade => ({
        symbol: trade.Symbol || trade.tradingSymbol,
        searchSymbol: trade.searchSymbol || trade.Symbol || trade.tradingSymbol,
        transactionType: trade.Type || trade.transactionType,
        quantity: trade.Quantity || trade.quantity,
        orderType: trade.OrderType || trade.orderType || 'MARKET',
        orderPlacement: 'success',
        orderStatus: 'Placed',
        message_aq: 'Manually placed',
      }));
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);

      setPendingManualTrade(null);
      await Promise.all([
        getAllTrades(),
        getCartAllStocks(),
      ]);
    } catch (err) {
      Toast.show({type: 'error', text1: 'Failed to save. Try again.'});
    } finally {
      setIsManualConfirmLoading(false);
      setShowManualConfirm(false);
    }
  };

  const handleCloseDdpiModal = () => {
    setShowDdpiModal(false);
  };

  const handleProceedWithTpin = () => {
    setShowDdpiModal(false);

    setOpenReviewTrade(true);
  };

  const subscribeToSymbols = async () => {
    const wsManager = WebSocketManager.getInstance();

    // Flatten the symbols from both non-basket and basket trades
    const allTrades = stockRecoNotExecuted.flatMap(item => {
      if (item?.type === 'basket') {
        // Handle trades inside a basket

        return item?.trades;
      } else {
        //  console.log('here i get---',item);
        // Non-basket trade
        return [item];
      }
    });

    // Optional: filter unique symbols if needed
    const uniqueTrades = [];
    const seenSymbols = new Set();

    // console.log('Subscribing to symbols:', uniqueTrades.map(t => t.Symbol));

    // Now subscribe to all trades (flattened and unique)
    await wsManager.subscribeToAllSymbols(allTrades);
  };

  useEffect(() => {
    subscribeToSymbols();
  }, [stockRecoNotExecuted]);

  const handleSingleSelectStock = async (symbol, tradeId, action) => {
    // Stale-closure fix (2026-04-18): `broker` / `brokerStatus` from the
    // top-level `useTrade()` destructure are captured at render time.
    // If the user taps Trade Now before the initial `getUserDeatils()` in
    // TradeContext has finished, the closure holds `null` for both, and
    // the `!broker` check below would fire the broker-selection palette
    // even when the user is actually connected.
    //
    // `getUserDeatils` updates context state AND returns the fresh user
    // object (TradeContext.js:955). We shadow the closure bindings with
    // the fresh values so every subsequent check in this function — the
    // no-broker gate below AND the per-broker branches (Angel One,
    // Dhan, Zerodha, etc.) further down — reads the current broker.
    // Latent since commit aee4f10 added this await.
    const _closureBroker = broker;
    const _closureBrokerStatus = brokerStatus;
    const _closureFunds = funds;
    // Use shared hook — fetches user AND funds inline, so downstream
    // isFundsEmpty reads post-reconnect value, not stale context.
    const freshStatus = await refreshBrokerStatus({forceNetwork: true});
    await getRejectedCount();
    // eslint-disable-next-line no-shadow
    const broker = freshStatus?.broker ?? _closureBroker;
    // eslint-disable-next-line no-shadow
    const brokerStatus = freshStatus?.brokerStatus ?? _closureBrokerStatus;
    // eslint-disable-next-line no-shadow
    const funds = freshStatus?.funds ?? _closureFunds;

    const rejectedKey = `rejectedCount${broker}`;
    //const rejectedCountFromStorage = await AsyncStorage.getItem(rejectedKey);
    const currentBrokerRejectedCount = await getRejectedCount();
    // Typed pre-flight: surface TRANSIENT (Upstox maintenance, etc.) as a
    // toast and bail; otherwise reuse `isFundsEmpty` for the existing
    // expired-session branch below.
    const _fundsPreflight = classifyFundsResponse(funds, brokerStatus, broker);
    if (_fundsPreflight.reason === 'TRANSIENT') {
      Toast.show({
        type: 'info',
        text1: `${broker || 'Broker'} temporarily unavailable`,
        text2: _fundsPreflight.message,
        visibilityTime: 4500,
        position: 'bottom',
      });
      return;
    }
    const isFundsEmpty = !_fundsPreflight.ok && _fundsPreflight.reason !== 'NOT_CONNECTED';

    // Check order must match web: no broker → broker selection, then expired → token expire
    if (!broker) {
      // No broker connected at all → save pending trade and show broker selection (matching web)
      const tradeToSave = recommendationStock.find(
        item => item.Symbol === symbol && item.tradeId === tradeId,
      );
      if (tradeToSave) setPendingManualTrade(tradeToSave);
      setBrokerModel(true);
      return;
    } else if (brokerStatus !== 'connected' || isFundsEmpty) {
      // Broker set but session expired or funds empty → re-login to same broker
      setOpenTokenExpireModel(true);
      return;
    } else {
      console.log('broker status--', brokerStatus);
      // Market-hours gate — bypassed when advisor has allowAfterHoursOrders enabled.
      if (!IsMarketHours() && !allowAfterHoursOrders) {
        showToast('Orders cannot be placed after Market hours.', 'error', '');
        return;
      }
      const isStockSelected = stockDetails.some(
        selectedStock =>
          selectedStock.tradingSymbol === symbol &&
          selectedStock.tradeId === tradeId,
      );

      const updatedStock = recommendationStock.find(
        item => item.Symbol === symbol && item.tradeId === tradeId,
      );

      if (!updatedStock) {
        console.error('Stock not found in recommendationStock.');
        return;
      }
      const newStock = {
        user_email: updatedStock.user_email,
        trade_given_by: updatedStock.trade_given_by,
        tradingSymbol: updatedStock.Symbol,
        transactionType: updatedStock.Type,
        exchange: updatedStock.Exchange,
        segment: updatedStock.Segment,
        productType:
          updatedStock.Exchange === 'NFO' || updatedStock.Exchange === 'BFO'
            ? 'CARRYFORWARD'
            : updatedStock.ProductType,
        orderType: updatedStock.OrderType,
        price: updatedStock.Price,
        quantity: updatedStock.Quantity,
        priority: updatedStock.Priority || 1,
        tradeId: updatedStock.tradeId,
        user_broker: broker,
        zerodhaTradeId: updatedStock.zerodhaTradeId,
      };

      // Open the ReviewTradeModal for this ONE stock only. Defers the
      // modal open to the next tick via setTimeout(…, 0) so React commits
      // setStockDetails([newStock]) before ReviewTradeModal reads the
      // stockDetails prop. Matches web NewStockCard.js:585-587 exactly —
      // without the deferral, any prior setState that touched stockDetails
      // (e.g. the old updateCartStates → setStockDetails(cart)) could
      // leak into the modal render, causing "Trade Now on X" to open the
      // review with every cart item instead of just X.
      const openReviewForSingle = () => {
        setStockDetails([newStock]);
        setTimeout(() => setOpenReviewTrade(true), 0);
      };

      // If stock is already selected
      if (isStockSelected) {
        const isBuyOrder = action.toUpperCase() === 'BUY';
        const isSellOrder = action.toUpperCase() === 'SELL';
        if (broker === 'Angel One') {
          if (isBuyOrder) {
            openReviewForSingle();
          } else if (isSellOrder) {
            if (!userDetails?.ddpi_enabled && !userDetails?.is_authorized_for_sell) {
              setShowAngleOneTpinModel(true);
            } else {
              openReviewForSingle();
            }
          } else {
            openReviewForSingle();
          }
        } else if (broker === 'Dhan') {
          if (isBuyOrder) {
            openReviewForSingle();
          } else if (isSellOrder) {
            if (dhanEdisStatus && dhanEdisStatus?.data && dhanEdisStatus?.data?.length > 0 && dhanEdisStatus?.data?.every((h) => h.edis === true)) {
              openReviewForSingle();
            } else if (!dhanEdisStatus || !dhanEdisStatus?.data || dhanEdisStatus?.data?.length === 0 || dhanEdisStatus?.data?.some((h) => h.edis === false)) {
              setShowDhanTpinModel(true);
            } else {
              openReviewForSingle();
            }
          }
        } else if (broker === 'Zerodha') {
          const allFNO = stockDetails.every(
            item => item.exchange === 'NFO' || item.exchange === 'BFO',
          );
          if (isBuyOrder) {
            openReviewForSingle();
          } else if (isSellOrder && !allFNO) {
            const canSellSingle = userDetails?.is_authorized_for_sell ||
              ['physical', 'ddpi'].includes(userDetails?.ddpi_status);
            if (canSellSingle) {
              setShowDdpiModal(false);
              openReviewForSingle();
            } else {
              setShowDdpiModal(true);
            }
          } else {
            openReviewForSingle();
          }
        } else {
          openReviewForSingle();
        }
        return;
      }

      const isBuyOrder = action.toUpperCase() === 'BUY';
      const isSellOrder = action.toUpperCase() === 'SELL';
      await handleSelectStock(symbol, tradeId, 'add', 'handlesingle');
      // Broker-specific auth gating before opening the review modal.
      if (broker === 'Zerodha') {
        const canSellBatch = userDetails?.is_authorized_for_sell ||
          ['physical', 'ddpi'].includes(userDetails?.ddpi_status);
        if (isSellOrder && !canSellBatch) {
          setShowDdpiModal(true);
        } else {
          openReviewForSingle();
        }
      } else if (broker === 'Angel One') {
        if (isBuyOrder) {
          openReviewForSingle();
        } else if (isSellOrder) {
          if (!userDetails?.ddpi_enabled && !userDetails?.is_authorized_for_sell) {
            setShowAngleOneTpinModel(true);
          } else {
            openReviewForSingle();
          }
        }
      } else if (broker === 'Dhan') {
        if (isBuyOrder) {
          openReviewForSingle();
        } else if (isSellOrder) {
          if (dhanEdisStatus && dhanEdisStatus?.data && dhanEdisStatus?.data?.length > 0 && dhanEdisStatus?.data?.every((h) => h.edis === true)) {
            openReviewForSingle();
          } else if (!dhanEdisStatus || !dhanEdisStatus?.data || dhanEdisStatus?.data?.length === 0 || dhanEdisStatus?.data?.some((h) => h.edis === false)) {
            setShowDhanTpinModel(true);
          } else {
            openReviewForSingle();
          }
        }
      } else {
        openReviewForSingle();
      }
    }
  };

  const [modalVisible, setModalVisible1] = useState(false);

  // Trades---

//  console.log("BROKER MODAL OPEN---", brokerModel);
  const [isRebalModalVisible, setRebalModalVisible] = useState(false);
  const [calculatedPortfolioData, setCalculatedPortfolioData] = useState([]);
  const [modelPortfolioModelId, setModelPortfolioModelId] = useState();
  const [storeModalName, setStoreModalName] = useState();

  const openRebalModal = () => {
    setRebalModalVisible(true);
  };

  const handleTradeNow1 = () => {
    // Populate stockDetails from cartContainer (matches handleTrade; same
    // rationale — cart/trade-intent separation as of 2026-04-17).
    const mergedTradeIntent = (cartContainer || []).map(cartItem => {
      const edited = stockDetails.find(
        s =>
          s.tradingSymbol === cartItem.tradingSymbol &&
          s.tradeId === cartItem.tradeId,
      );
      return edited ? {...cartItem, ...edited} : cartItem;
    });
    setStockDetails(mergedTradeIntent);

    if (broker === 'Zerodha') {
      setOpenReviewTrade(true);
    } else {
      if (brokerStatus === null) {
        setBrokerModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    }
  };

  const openReviewModal = () => {
    setOpenReviewTrade(true);
  };

  const [ignoreTradesLoading, setIgnoreTradesLoading] = useState(false);
  const handleRevertTrades = async id => {
    console.log('id of ignore:', id);
    setIgnoreTradesLoading(true);
    let data = JSON.stringify({
      uid: id,
      trade_place_status: 'recommend',
    });

    let orderConfig = {
      method: 'put',
      url: `${server.server.baseUrl}api/recommendation`,
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
      .request(orderConfig)
      .then(response => {
        setIgnoreTradesLoading(false);
        Toast.show({
          type: 'success',
          text1: 'Success',
          text2: 'You have successfully reverted your trade.',
          text2Style: { fontFamily: 'Poppins-Medium', fontSize: 12 },
          visibilityTime: 5000,
          position: 'bottom',
          bottomOffset: 40,
          style: {
            backgroundColor: 'white',
            borderLeftColor: 'green',
            borderLeftWidth: 5,
            padding: 10,
          },
          textStyle: {
            color: 'green',
            fontFamily: 'Poppins-Medium',
            fontSize: 20,
          },
        });
        getAllTrades();
      })
      .catch(error => {
        setIgnoreTradesLoading(false);
        console.error('Error reverting trade:', error);
      });
  };

  //////////////////////////

  useEffect(() => {
    if (userDetails && userDetails.user_broker === 'Angel One') {
      // console.log('Verify edis called:');
      verifyEdis();
    }
  }, [userDetails, broker]);

  useEffect(() => {
    // console.log('This Called, user',userDetails);
    if (userDetails && userDetails.user_broker === 'Dhan') {
      verifyDhanEdis();
    }
  }, [userDetails, broker]);

  useEffect(() => {
    if (userDetails && userDetails.user_broker === 'Zerodha') {
      const verifyZerodhaDdpi = async () => {
        try {
          const response = await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/save-ddpi-status`,
            {
              apiKey: zerodhaApiKey,
              accessToken: userDetails.jwtToken,
              userEmail: userDetails.email,
            },
          );
          setZerodhaDdpiStatus(response.data);
        } catch (error) {
          //    console.error("Error verifying eDIS status:", error);
        }
      };

      verifyZerodhaDdpi();
    }
  }, [userDetails, broker]);

  useEffect(() => {
    if (userDetails && userDetails.user_broker === 'Zerodha') {
      const verifyZerodhaEdis = async () => {
        try {
          const response = await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/save-edis-status`,
            {
              userEmail: userDetails.email,
              edis: userDetails.edis,
            },
          );
          console.log('response edit::', response.data);
          setZerodhaDdpiStatus(response.data);
        } catch (error) {
          //   console.error("Error verifying eDIS status:", error);
        }
      };

      verifyZerodhaEdis();
    }
  }, [userDetails, broker]);

  useEffect(() => {
    const loadTradeType = async () => {
      try {
        const savedTradeType = await AsyncStorage.getItem('storedTradeType');
        if (savedTradeType) {
          setStoredTradeType(JSON.parse(savedTradeType));
        }
      } catch (error) {
        console.error('Failed to load trade type from storage', error);
      }
    };

    loadTradeType();
  }, []);

  useEffect(() => {
    if (types.length > 0) {
      const hasSell = types.some(type => type === 'SELL');
      const hasBuy = types.some(type => type === 'BUY');
      const allSell = hasSell && !hasBuy;
      const allBuy = hasBuy && !hasSell;
      const isMixed = hasSell && hasBuy;

      const newTradeType = {
        allSell: allSell,
        allBuy: allBuy,
        isMixed: isMixed,
      };

      updateTradeType(newTradeType);
    } else {
      updateTradeType(storedTradeType);
    }
  }, [types]);

useEffect(() => {
  if (!isDatafetching) {
    let transformedData = []; // To hold the transformed data

    // Function to group trades by basketId
    const groupTrades = (trades) => {
      const basketGroups = {};
      const stockCards = [];

      trades.forEach(item => {
        // Check if this is a basket trade
        // Basket trades have: basketId AND toTradeQty property (even if it's 0)
       const isBasketTrade =
  item.Basket === true ||
  (item.basketId && item.basketName);


        // ============================
        // BASKET TRADE (from flattened basket_advice)
        // ============================
        if (isBasketTrade) {
          // Initialize basket group if it doesn't exist
          if (!basketGroups[item.basketId]) {
            basketGroups[item.basketId] = {
              type: "basket",
              basketId: item.basketId,
              basketName: item.basketName,
              advisor_name: item.advisor_name,
              date: item.date,
              lastUpdated: item.lastUpdated,
              description: item.description,
              trades: []
            };
          }

          // Ensure trade has all required fields for BasketCard
          const trade = {
            ...item,
            // Ensure these fields exist for BasketCard compatibility
            searchSymbol: item.searchSymbol || item.Symbol?.split(/\d/)[0] || '',
            Strike: item.Strike || '',
            OptionType: item.OptionType || '',
            stopLoss: item.stopLoss || item.sl || item.SL || null,
            profitTarget: item.profitTarget || item.Target || item.PT || null,
            LimitPrice: item.Price || item.LimitPrice || null,
          };

          // Add trade to basket group
          basketGroups[item.basketId].trades.push(trade);

          return;
        }

        // ============================
        // INDIVIDUAL STOCK TRADE
        // ============================
        stockCards.push({
          ...item,
          type: "stock"
        });
      });

      // Convert basket groups to array and combine with stocks
      const basketArray = Object.values(basketGroups);
      
      console.log('📊 Grouping Summary:', {
        totalBaskets: basketArray.length,
        totalStocks: stockCards.length,
        baskets: basketArray.map(b => ({
          name: b.basketName,
          tradeCount: b.trades.length,
          sampleTrade: b.trades[0] ? {
            symbol: b.trades[0].searchSymbol,
            strike: b.trades[0].Strike,
            optionType: b.trades[0].OptionType
          } : null
        }))
      });

      return [
        ...basketArray,
        ...stockCards,
      ];
    };

    // Depending on the `type`, fetch the respective data and transform it
    if (type === 'OSrejected' && rejectedTrades) {
      transformedData = groupTrades(rejectedTrades);
    }
    if (type === 'Ignore' && ignoredTrades) {
      transformedData = groupTrades(ignoredTrades);
    }
    if ((type === 'All' || type === 'home') && stockRecoNotExecutedfinal) {
      transformedData = groupTrades(stockRecoNotExecutedfinal);
    }

    // Set the transformed data to the state
    setStockRecoNotExecuted(transformedData);
    setrecommendationStock(transformedData);
  }
}, [
  type,
  stockRecoNotExecutedfinal,
  rejectedTrades,
  ignoredTrades,
  isDatafetching,
]);

  useEffect(() => {
    if (!userDetails) {
      getUserDeatils();
    }

    if (broker === 'Angel One') {
      verifyEdis();
    } else if (broker === 'Dhan') {
      verifyDhanEdis();
    }
  }, [broker, userDetails]);

  useEffect(() => {
    //  console.log('Counnnnnnnnnnnnnnnnnnnt----------------------3');
    if (zerodhaRequestToken && zerodhaRequestType === 'login') {
      connectZerodha();
    }
  }, [zerodhaRequestToken, zerodhaRequestType]);

  useEffect(() => {
    // console.log('Counnnnnnnnnnnnnnnnnnnt----------------------4');
    if (
      userId !== undefined &&
      (sessionToken ||
        upstoxSessionToken ||
        authToken ||
        (zerodhaAccessToken && zerodhaRequestType === 'login'))
    ) {
      connectBrokerDbUpadte();
    }
  }, [userId, sessionToken, upstoxSessionToken, zerodhaAccessToken, authToken]);

  useEffect(() => {
    //console.log('Counnnnnnnnnnnnnnnnnnnt----------------------5');
    const fetchData = async () => {
      try {
        // Fetch and parse the pending order data
        const pendingOrderData = await AsyncStorage.getItem(
          'stockDetailsZerodhaOrder',
        );
        if (pendingOrderData) {
          setZerodhaStockDetails(JSON.parse(pendingOrderData));
        }

        // Fetch and parse the additional payload data
        const payloadData = await AsyncStorage.getItem('additionalPayload');
        if (payloadData) {
          setZerodhaAdditionalPayload(JSON.parse(payloadData));
        }
      } catch (error) {
        console.error('Error loading data from AsyncStorage:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    // console.log('Counnnnnnnnnnnnnnnnnnnt----------------------6');
    if (
      zerodhaStatus !== null &&
      zerodhaRequestType === 'basket' &&
      jwtToken !== undefined
    ) {
      checkZerodhaStatus();
    }
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);

  useEffect(() => {
    //   console.log('Counnnnnnnnnnnnnnnnnnnt----------------------8');
    //   console.time('computationTime1');

    const fetchCartItems = async () => {
      try {
        const cartItemsKey = 'cartItems';

        // Load cart items from AsyncStorage
        const cartData = await AsyncStorage.getItem(cartItemsKey);
        const cartItems = cartData ? JSON.parse(cartData) : [];

        // Set cart items into the state
        setCartContainer(cartItems);
        //  console.log('Cart items loaded:', cartItems);
      } catch (error) {
        console.error('Error loading cart items:', error);
      }
      //  console.timeEnd('computationTime1');
    };

    fetchCartItems();
  }, []);

  const stockRemovedListenerRef = useRef(null);
  useEffect(() => {
    const stockRemovedListener = async ({ symbol, tradeId }) => {
      const cartItemsKey = 'cartItems';

      // Log the initial cartContainer
      //   console.log('Initial cartContainer:', cartContainer);

      // Clone the current cart items
      let cartItems = [...cartContainer];

      // Generate the key for the item to be removed
      const itemKey = `${symbol}-${tradeId}`;

      // Convert the cart items to a Map for efficient key-based deletion
      const cartItemMap = new Map(
        cartItems.map(item => [`${item.tradingSymbol}-${item.tradeId}`, item]),
      );

      // Log the generated keys and the item key
      console.log(
        'Generated Map Keys:',
        cartItems.map(item => `${item.tradingSymbol}-${item.tradeId}`),
      );
      console.log('Item Key to Remove:', itemKey);

      // Log the Map before deletion
      console.log('Map before deletion:', cartItemMap);

      // Remove the specified item
      cartItemMap.delete(itemKey);

      // Convert the updated Map back to an array
      cartItems = Array.from(cartItemMap.values());

      // Log the updated cartItems
      console.log('Updated cart items:', cartItems);

      try {
        // Use Promise.all to wait for both operations to complete
        await Promise.all([
          AsyncStorage.setItem(cartItemsKey, JSON.stringify(cartItems)),
          new Promise(resolve => {
            updateCartStates(cartItems);
            resolve();
          }),
        ]);

        // Emit the event only after both operations are complete
        eventEmitter.emit('cartUpdated');
      } catch (error) {
        console.error('Error updating cart:', error);
      }
    };

    eventEmitter.on('stockRemoved', stockRemovedListener);
    return () => {
      eventEmitter.off('stockRemoved', stockRemovedListener);
    };
  }, [stockDetails]);

  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ event }) => {
      //   console.log('details i get---------------->>>>>>>>:',event);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleStockAction = ({ symbol, tradeId }) => {
      console.log('Received data in StockAdvices:', { symbol, tradeId });
      // Perform your desired action with symbol and tradeId here
      handleSingleSelectStock(symbol, tradeId, 'add');
    };

    eventEmitter.on('stockAction', handleStockAction);

    return () => {
      eventEmitter.off('stockAction', handleStockAction); // Cleanup on unmount
    };
  }, []);

  useEffect(() => {
    eventEmitter.on('OpenTradeModel', handleTradeNow1);
    return () => {
      eventEmitter.off('OpenTradeModel', handleTradeNow1);
    };
  }, []);

  //////////////////////////////

  const closeReviewTradeModal = () => {
    //  console.log('stockDetials))))))---->',stockDetails);

    setBasketData([]);
    setOpenReviewTrade(false);
  };

  const closeZerodhaTradeModal = () => {
    console.log('stockDetials))))))---->', stockDetails);

    setBasketData([]);
    setOpenReviewTrade(false);
  };
  const animatedHeight = useRef(new Animated.Value(10)).current;
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);

  const toggleExpand = useCallback(index => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCardIndex(prev => (prev === index ? null : index));
  }, []);
  const handleConnectAndPlaceOrder = async () => {
    if (_haltOnFundsCheckFailure(funds, brokerStatus, broker)) return;
    placeOrder();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StockAdviceContent
        type={type}
        broker={broker}
        stocksWithoutSource={stocksWithoutSource}
        getUserDeatils={getUserDeatils}
        userDetails={userDetails}
        setbasketId={setbasketId}
        setbasketName={setbasketName}
        isBasket={isBasket}
        basketData={basketData}
        planList={planList}
        fullsetBasketData={fullsetBasketData}
        setBasketData={setBasketData}
        setisBasket={setisBasket}
        isDatafetching={isDatafetching}
        onOpenRebalModal={openRebalModal}
        orderscreen={orderscreen}
        stockRecoNotExecuted={stockRecoNotExecuted}
        handleIgnoreTradePress={id => {
          setStockIgnoreId(id);
          setModalVisible(true);
        }}
        recommendationStock={stockRecoNotExecuted && stockRecoNotExecuted}
        isSelected={cartContainer.some(
          stock => stock.tradingSymbol === Symbol && stock.tradeId === tradeId,
        )}
        setRecommendationStock={setStockRecoNotExecuted}
        setStockDetails={setStockDetails}
        stockDetails={stockDetails}
        cartContainer={cartContainer}
        setCartContainer={setCartContainer}
        setStockRecoNotExecuted
        loading={loading}
        userEmail={userEmail}
        handleTradeBasket={handleTradeBasket}
        handleCancelBasket={handleCancelBasket}
        getAllTrades={getAllTrades}
        handleSelectAllStocks={handleSelectAllStocks}
        handleRemoveAllSelectedStocks={handleRemoveAllSelectedStocks}
        handleSelectStock={handleSelectStock}
        handleSingleSelectStock={handleSingleSelectStock}
        handleTradeNow={handleTrade}
        handleRevertTrades={handleRevertTrades}
        handleDecreaseStockQty={handleDecreaseStockQty}
        handleIncreaseStockQty={handleIncreaseStockQty}
        handleLimitOrderInputChange={handleLimitOrderInputChange}
        handleQuantityInputChange={handleQuantityInputChange}
        handleTradePress={handleSingleSelectStock} // Call handleTrade when trade button is pressed
        expandedCardIndex={expandedCardIndex}
        toggleExpand={toggleExpand}
        animatedHeight={animatedHeight}
      />

      {isModalVisibleignore && (
        <IgnoreAdviceModal
          handleIgnore={handleIgnoredTrades}
          stockIgnoreId={stockIgnoreId}
          isVisible={isModalVisibleignore}
          onClose={closeModal}
        />
      )}

      {openZerodhaReviewModal && (
        <ZerodhaReviewModal
          isVisible={openZerodhaReviewModal}
          onClose={closeZerodhaTradeModal}
          setOpenZerodhaModel={setOpenZerodhaModel}
          stockDetails={stockDetails}
          isBasket={isBasket}
          basketData={basketData}
          setBasketData={setBasketData}
          mbasket={mbasket}
          htmlContent={htmlContentfinal}
          appURL={appURL}
          userEmail={userEmail}
          fullbasketData={fullbasketData}
          setOpenSucessModal={setOpenSucessModal}
          setOrderPlacementResponse={setOrderPlacementResponse} //setOrderPlacementResponse
          getAllTrades={getAllTrades}
          userDetails={userDetails}
          zerodhaApiKey={zerodhaApiKey}
          filterCartAfterOrder={filterCartAfterOrder}
          getCartAllStocks={getCartAllStocks}
          webViewVisible={webViewVisible}
          updatePortfolioData={updatePortfolioData}
          setCartContainer={setCartContainer}
          setWebViewVisible={setWebViewVisible}
          handleZerodhaRedirect={handleZerodhaRedirect}
          openZerodhaReviewModal={openZerodhaReviewModal}
          setStockDetails={setStockDetails}
          broker={broker}
        />
      )}

      {openReviewTrade && (
        <ReviewTradeModal
          isVisible={openReviewTrade}
          onClose={closeReviewTradeModal}
          stockDetails={stockDetails}
          setStockDetails={setStockDetails}
          loading={loading}
          isBasket={isBasket}
          fullbasketData={fullbasketData}
          basketData={basketData}
          setBasketData={setBasketData}
          setisBasket={setisBasket}
          placeOrder={placeOrder}
          getCartAllStocks={getCartAllStocks}
          handleSelectStock={handleSelectStock}
          funds={funds}
          broker={broker}
        />
      )}

      {openSuccessModal && (
        <RecommendationSuccessModal
          openSuccessModal={openSuccessModal}
          setOpenSucessModal={setOpenSucessModal}
          orderPlacementResponse={orderPlacementResponse}
          currentBroker={broker}
        />
      )}

      {/* Manual Trade Confirmation — shown after broker modal closes with pending trade (matching web) */}
      <Modal
        visible={showManualConfirm && (!!pendingManualTrade || stockDetails.length > 0)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowManualConfirm(false);
          setPendingManualTrade(null);
        }}
      >
        <View style={styles.manualConfirmOverlay}>
          <View style={styles.manualConfirmContainer}>
            <Text style={styles.manualConfirmTitle}>Confirm Manually Placed</Text>
            <Text style={styles.manualConfirmSubtitle}>Have you manually placed {pendingManualTrade ? 'this trade' : 'these trades'}?</Text>
            {pendingManualTrade ? (
              <View style={styles.manualConfirmTradeInfo}>
                <Text style={styles.manualConfirmTradeText}>
                  {pendingManualTrade.Type || pendingManualTrade.transactionType}  ·  {pendingManualTrade.Symbol || pendingManualTrade.tradingSymbol}  ·  Qty: {pendingManualTrade.Quantity || pendingManualTrade.quantity}
                </Text>
              </View>
            ) : stockDetails.length > 0 ? (
              <View style={styles.manualConfirmTradeInfo}>
                <Text style={styles.manualConfirmTradeText}>
                  {stockDetails.length} trade{stockDetails.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
            ) : null}
            <View style={styles.manualConfirmButtons}>
              <TouchableOpacity
                style={styles.manualConfirmNoBtn}
                disabled={isManualConfirmLoading}
                onPress={() => {
                  setShowManualConfirm(false);
                  setPendingManualTrade(null);
                }}
              >
                <Text style={styles.manualConfirmNoBtnText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualConfirmYesBtn}
                disabled={isManualConfirmLoading}
                onPress={handleConfirmManuallyPlaced}
              >
                <Text style={styles.manualConfirmYesBtnText}>
                  {isManualConfirmLoading ? 'Saving...' : 'Yes, Placed'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {OpenTokenExpireModel && (
        <IIFLReviewTradeModal
          isVisible={OpenTokenExpireModel}
          onClose={() => setOpenTokenExpireModel(false)}
          openIIFLReviewModal={openIIFLReviewModal}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
          setOpenIIFLReviewModel={setOpenReviewTrade}
          setOpenTokenExpireModel={setOpenTokenExpireModel}
          stockDetails={stockDetails}
          setStockDetails={setStockDetails}
          userId={userId}
          apiKey={apiKey}
          secretKey={secretKey}
          checkValidApiAnSecret={checkValidApiAnSecret}
          clientCode={clientCode}
          my2pin={my2pin}
          panNumber={panNumber}
          mobileNumber={mobileNumber}
          broker={broker}
          getUserDeatils={getUserDeatils}
          showIIFLModal={showIIFLModal}
          setShowIIFLModal={setShowIIFLModal}
          showICICIUPModal={showICICIUPModal}
          setShowICICIUPModal={setShowICICIUPModal}
          showupstoxModal={showupstoxModal}
          setShowupstoxModal={setShowupstoxModal}
          showangleoneModal={showangleoneModal}
          setShowangleoneModal={setShowangleoneModal}
          showzerodhamodal={showzerodhamodal}
          setShowzerodhaModal={setShowzerodhaModal}
          showhdfcModal={showhdfcModal}
          setShowhdfcModal={setShowhdfcModal}
          showDhanModal={showDhanModal}
          setShowDhanModal={setShowDhanModal}
          showKotakModal={showKotakModal}
          setShowKotakModal={setShowKotakModal}
          showAliceblueModal={showAliceblueModal}
          setShowAliceblueModal={setShowAliceblueModal}
          showFyersModal={showFyersModal}
          setShowFyersModal={setShowFyersModal}
          showMotilalModal={showMotilalModal}
          setShowMotilalModal={setShowMotilalModal}
        />
      )}

      {(brokerModel || OpenTokenExpireModel) && (
        <BrokerSelectionModal
          showBrokerModal={brokerModel}
          OpenTokenExpireModel={OpenTokenExpireModel}
          setShowBrokerModal={setBrokerModel}
          setOpenTokenExpireModel={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
          handleAcceptRebalanceWithoutBroker={handleContinueWithoutBrokerBespoke}
        />
      )}

      {showDdpiModal && (
        <DdpiModal
          isOpen={showDdpiModal}
          setIsOpen={handleCloseDdpiModal}
          proceedWithTpin={handleProceedWithTpin}
          userDetails={userDetails && userDetails}
          setOpenReviewTrade={setOpenReviewTrade}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
        />
      )}

      {false && (
        <ActivateNowModel
          isOpen={false}
          setIsOpen={setActivateNowModel}
          onActivate={handleActivateDDPI}
          userDetails={userDetails}
        />
      )}

      {showAngleOneTpinModel && (
        <AngleOneTpinModal
          isOpen={showAngleOneTpinModel}
          setIsOpen={setShowAngleOneTpinModel}
          userDetails={userDetails}
          edisStatus={edisStatus}
          tradingSymbol={stockDetails.map(stock => stock.tradingSymbol)}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
        />
      )}

      {showFyersTpinModal && (
        <FyersTpinModal
          isOpen={showFyersTpinModal}
          setIsOpen={setShowFyersTpinModal}
          userDetails={userDetails}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
        />
      )}

      {showDhanTpinModel && (
        <DhanTpinModal
          isOpen={showDhanTpinModel}
          setIsOpen={setShowDhanTpinModel}
          userDetails={userDetails}
          dhanEdisStatus={dhanEdisStatus}
          stockTypeAndSymbol={stockTypeAndSymbol}
          singleStockTypeAndSymbol={singleStockTypeAndSymbol}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
        />
      )}

      {showOtherBrokerModel && (
        <OtherBrokerModel
          userDetails={userDetails}
          onContinue={() => {
            setIsReturningFromOtherBrokerModal(true);
            setShowOtherBrokerModel(false);
          }}
          setShowOtherBrokerModel={setShowOtherBrokerModel}
          showActivateNowModel={showActivateNowModel}
          openReviewModal={openReviewModal}
          setActivateNowModel={setActivateNowModel}
          setOpenReviewTrade={setOpenReviewTrade}
          setOpenRebalanceModal={setOpenRebalanceModal}
          userEmail={userEmail}
          apiKey={apiKey}
          jwtToken={jwtToken}
          secretKey={secretKey}
          clientCode={clientCode}
          broker={broker}
          sid={sid}
          viewToken={viewToken}
          serverId={serverId}
          visible={showOtherBrokerModel}
          setCaluculatedPortfolioData={setCalculatedPortfolioData}
          setModelPortfolioModelId={setModelPortfolioModelId}
          modelPortfolioModelId={modelPortfolioModelId}
          setStoreModalName={setStoreModalName}
          storeModalName={storeModalName}
          funds={funds}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
        />
      )}

      {showIIFLModal && (
        <IIFLModal
          isVisible={showIIFLModal}
          onClose={() => setShowIIFLModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showICICIUPModal && (
        <ICICIUPModal
          isVisible={showICICIUPModal}
          showICICIUPModal={showICICIUPModal}
          setShowICICIUPModal={setShowICICIUPModal}
          onClose={() => setShowICICIUPModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showupstoxModal && (
        <UpstoxModal
          isVisible={showupstoxModal}
          onClose={() => setShowupstoxModal(false)}
          setShowupstoxModal={setShowupstoxModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showangleoneModal && (
        <AngleOneBookingModal
          isVisible={showangleoneModal}
          onClose={() => setShowangleoneModal(false)}
          setShowangleoneModal={setShowangleoneModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showzerodhamodal && (
        <ZerodhaConnectModal
          isVisible={showzerodhamodal}
          onClose={() => setShowzerodhaModal(false)}
          setShowzerodhaModal={setShowzerodhaModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showhdfcModal && (
        <HDFCconnectModal
          isVisible={showhdfcModal}
          onClose={() => setShowhdfcModal(false)}
          setShowhdfcModal={setShowhdfcModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showDhanModal && (
        <DhanConnectModal
          isVisible={showDhanModal}
          onClose={() => setShowDhanModal(false)}
          setShowDhanModal={setShowDhanModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showAliceblueModal && (
        <AliceBlueConnect
          isVisible={showAliceblueModal}
          showAliceblueModal={showAliceblueModal}
          setShowAliceblueModal={setShowAliceblueModal}
          onClose={() => setShowAliceblueModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showFyersModal && (
        <FyersConnect
          isVisible={showFyersModal}
          showFyersModal={showFyersModal}
          setShowFyersModal={setShowFyersModal}
          onClose={() => setShowFyersModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showKotakModal && (
        <KotakModal
          isVisible={showKotakModal}
          onClose={() => setShowKotakModal(false)}
          setShowKotakModal={setShowKotakModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showMotilalModal && (
        <MotilalModal
          isVisible={showMotilalModal}
          onClose={() => setShowMotilalModal(false)}
          setMotilalModal={setShowMotilalModal}
          setShowBrokerModal={setModalVisible}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  StockTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: 'black',
  },
  lottie: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    marginTop: 20,
  },
  manualConfirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  manualConfirmContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 340,
    padding: 22,
  },
  manualConfirmTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  manualConfirmSubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#475569',
    marginBottom: 4,
  },
  manualConfirmTradeInfo: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
    marginTop: 6,
  },
  manualConfirmTradeText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#334155',
  },
  manualConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  manualConfirmNoBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  manualConfirmNoBtnText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#475569',
  },
  manualConfirmYesBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  manualConfirmYesBtnText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#fff',
  },
});

export default StockAdvices;
