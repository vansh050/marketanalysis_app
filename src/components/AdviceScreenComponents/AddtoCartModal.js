import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import server from '../../utils/serverConfig';
import {getAuth} from '@react-native-firebase/auth';
import axios from 'axios';
import ZerodhaReviewModal from '../ReviewZerodhaTradeModal';
import IIFLReviewTradeModal from '../IIFLReviewTradeModal';
import {
  AlignCenterVertical,
  AlignJustifyIcon,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react-native';
import ReviewTradeModal from '../ReviewTradeModal';
import moment from 'moment';
import Toast from 'react-native-toast-message';
import IsMarketHours from '../../utils/isMarketHours';
import { computeTradeVariant } from '../../utils/tradeVariant';
import { isOrderSuccess, isOrderRejected } from '../../utils/orderStatusUtils';
import { validateBrokerSession } from '../../utils/brokerSessionUtils';
import { validateStockExchanges, convertToBasketItem, fetchFreshKiteProtectionPrices, resolveZerodhaSymbol } from '../../utils/brokerPublisher';
import useZerodhaSymbolMap from '../../hooks/useZerodhaSymbolMap';
import {useCart} from '../CartContext';
import {getLastKnownPrice} from './DynamicText/websocketPrice';
import eventEmitter from '../EventEmitter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RecommendationSuccessModal from '../../components/ModelPortfolioComponents/RecommendationSuccessModal';
import { designColor, designFont } from '../../design/literalTokens';
const {height: screenHeight} = Dimensions.get('window');
import {useTrade} from '../../screens/TradeContext';
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import {useRefreshBrokerStatus} from '../../hooks/useRefreshBrokerStatus';
import {isFundsErrorOrMissing} from '../../utils/rebalanceHelpers';
import {classifyFundsResponse, shouldBlockTradeOnFundsPreflight} from '../../utils/brokerSessionValidator';
import DdpiModal from '../DdpiModal';
import {DhanTpinModal} from '../DdpiModal';
import {AngleOneTpinModal} from '../DdpiModal';
import {ActivateNowModel} from '../DdpiModal';
import {FyersTpinModal} from '../DdpiModal';
import {OtherBrokerModel} from '../DdpiModal';
import CryptoJS from 'react-native-crypto-js';
import Config from 'react-native-config';
import { useConfig } from '../../context/ConfigContext';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useModal} from '../ModalContext';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import {hasExplicitSellAuthRejection} from '../../utils/sellAuthMessage';
import {isDhanSellAuthorizationReady} from '../../utils/dhanEdis';
import {
  isAmbiguousPlacementError,
  isReconciliationResponse,
  prepareExecutionPayload,
  reconciliationMessage,
} from '../../utils/executionSafety';
import BrokerSelectionModal from '../BrokerSelectionModal';
import TotalAmountTextRebalance from './DynamicText/totalAmountRebalance';
import CartFullAmountText from './DynamicText/CartFullAmountText';
import TotalAmountText from './DynamicText/totalAmount';
import useSdkClient from '../../sdk/useSdkClient';
import {getAccountEmail} from '../../utils/accountEmail';
import {
  durableOrderExecutionEnabled,
  isDurableDirectOrderEligible,
  submitDurableOrder,
} from '../../services/DurableOrderService';
import {sellOrdersForAuth} from '../../utils/sellAuthOrders';

const isSdkExecuteAdviceEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_EXECUTE_ADVICE || '').trim().toLowerCase();
  return v === 'true' || v === '1';
};

const AddToCartModal = ({
  isVisible,
  onClose,
  setsuccessmodel,
  successmodel,
}) => {
  const {hideAddToCartModal, successclosemodel, setsuccessclosemodel} =
    useModal();
  const {
    stockRecoNotExecutedfinal,
    recommendationStockfinal,
    isDatafetching,
    broker,
    getAllTrades,
    funds,
    getAllFunds,
    userDetails,
    getUserDeatils,
    brokerStatus,
    configData,
  } = useTrade();

  const sdkClient = useSdkClient();
  const sdkExecuteAdviceEnabled = isSdkExecuteAdviceEnabled() && !!sdkClient;

  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || designColor('0056b7');
  const mainColor = config?.mainColor || designColor('4caaa0');
  const secondaryColor = config?.secondaryColor || designColor('f0f0f0');
  const allowAfterHoursOrders = config?.allowAfterHoursOrders;

  const [openReviewTrade, setOpenReviewTrade] = useState(false);
  const [openZerodhaReviewModal, setOpenZerodhaModel] = useState(false);
  const [openSuccessModal, setOpenSucessModal] = useState(false);
  const {setCartCount} = useCart();
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();
  const [cartItemCount, setCartItemCount] = useState();
  //const [brokerStatus, setBrokerStatus] = useState();

  const [cartItems, setCartItems] = useState([]);
  const [cartCount, setCartCount1] = useState(0);

  const [showIIFLModal, setShowIIFLModal] = useState(false);
  const [showICICIUPModal, setShowICICIUPModal] = useState(false);
  const [showupstoxModal, setShowupstoxModal] = useState(false);
  const [showangleoneModal, setShowangleoneModal] = useState(false);
  const [showzerodhamodal, setShowzerodhaModal] = useState(false);
  const [showhdfcModal, setShowhdfcModal] = useState(false);
  const [showDhanModal, setShowDhanModal] = useState(false);
  const [showKotakModal, setShowKotakModal] = useState(false);
  const [showFyersModal, setShowFyersModal] = useState(false);
  const [showAliceblueModal, setShowAliceblueModal] = useState(false);
  const [showMotilalModal, setShowMotilalModal] = useState(false);

  // console.log('cartOpentdd');
  // Load cart items and count from AsyncStorage when the modal is opened

  const fetchBrokerStatusModal = async () => {
    //setLoading(true);
    if (userEmail) {
      try {
        const response = await axios.get(
          `${server.server.baseUrl}api/user/getUser/${userEmail}`,
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
        const userData = response.data.User;
        getUserDeatils();
        getAllFunds();
        // console.log('corrected');
      } catch (error) {
        //   console.error('Error fetching broker status:', error.response?.data || error.message);
        // setIsBrokerConnected(false); // Handle error by setting default status
      } finally {
        setLoading(false);
      }
    }
  };

  const checkValidApiAnSecret = data => {
    if (!data) return null;
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };

  const [translateY] = useState(new Animated.Value(0));
  const handleCartUpdate = async () => {
    const cartData = await AsyncStorage.getItem('cartItems');
    const items = cartData ? JSON.parse(cartData) : [];
    setCartItems(items); // Update cart items state
    setCartCount1(items.length); // Update cart count
  };
  // Handling swipe down to close the modal
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (event, gestureState) => {
      return gestureState.dy > 50; // Swipe down to close
    },
    onPanResponderMove: (event, gestureState) => {
      if (gestureState.dy > 0) {
        translateY.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (event, gestureState) => {
      if (gestureState.dy > 100) {
        onClose(); // Close the modal when swiped down
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    },
  });

  const [loading, setLoading] = useState(false);
  const [stockRecoNotExecuted, setStockRecoNotExecuted] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [stockIgnoreId, setStockIgnoreId] = useState(null);
  const [orderPlacementResponse, setOrderPlacementResponse] = useState();
  const [brokerModel, setBrokerModel] = useState(null);

  const zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY;

  const animationRef = useRef(null);
  const orderSubmissionInFlightRef = useRef(false);

  const [openIIFLReviewModal, setOpenIIFLReviewModel] = useState(false); // Ensure initial value is false
  const [stockDetails, setStockDetails] = useState([]);
  const [recommendationStock, setrecommendationStock] = useState([]);
  // Scripmaster symbol/exchange map (see brokerPublisher.resolveZerodhaSymbol).
  const symbolMap = useZerodhaSymbolMap(stockDetails, stockDetails?.length > 0);

  // Format the moment object as desired

  const today = new Date();
  const todayDate = moment(today).format('YYYY-MM-DD HH:mm:ss');

  // User Details-

  const dateString = userDetails?.token_expire;
  const expireTokenDate = dateString
    ? moment(dateString).format('YYYY-MM-DD HH:mm:ss')
    : null;
  const clientCode = userDetails && userDetails.clientCode;
  const apiKey = userDetails && userDetails.apiKey;
  const jwtToken = userDetails && userDetails.jwtToken;
  const my2pin = userDetails && userDetails.my2Pin;
  const secretKey = userDetails && userDetails.secretKey;
  const viewToken = userDetails && userDetails?.viewToken;
  const sid = userDetails && userDetails?.sid;
  const serverId = userDetails && userDetails?.serverId;
  const mobileNumber = userDetails && userDetails?.phone_number;
  const panNumber = userDetails && userDetails?.panNumber;
  const userId = userDetails && userDetails._id;
  const [stockloading, setstockloading] = useState(false);
  const [OpenTokenExpireModel, setOpenTokenExpireModel] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  if (!isVisible) return null;

  const fetchCartItems = async () => {
    // console.log('This time  ---------------1');
    try {
      const cartData = await AsyncStorage.getItem('cartItems');
      const items = cartData ? JSON.parse(cartData) : [];
      setCartItems(items);
      setStockDetails(items);
      setCartCount1(items.length);
      console.log('items i get in cart noww-----', items, items.length);
      //setCartCount(items.length);
    } catch (error) {
      console.error(
        'Error fetching cart items:',
        error.response?.data || error.message,
      );
    }
  };

  ///

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

  const angelOneApiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;
  //fetching edis status for AngleOne

  const ccxtHeaders = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
    'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
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
        { headers: ccxtHeaders },
      );
      setEdisStatus(response.data);
      console.log('AngleOne response', response.data);
    } catch (error) {
      console.log('[edis] status sync failed (handled):', error?.message);
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
        { headers: ccxtHeaders },
      );
      console.log('Dhan Reponse', response.data);
      setDhanEdisStatus(response.data);
    } catch (error) {
      console.log('[edis] status sync failed (handled):', error?.message);
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

  // console.log("broker",broker)

  //

  const getRejectedCount = async () => {
    const rejectedKey = `rejectedCount${broker?.replace(/ /g, '')}`;

    let rejectedCountFromStorage = await AsyncStorage.getItem(rejectedKey);

    // Handle null, undefined, or invalid values (like empty string)
    if (
      !rejectedCountFromStorage ||
      isNaN(parseInt(rejectedCountFromStorage, 10))
    ) {
      console.log('Initializing rejected count to 0...');
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

  //console.log('TYPEEE ITEMSSSS:',types);
  const hasBuy = types.every(type => type === 'BUY');
  const hasSell = types.every(type => type === 'SELL');
  const allSell = hasSell && !hasBuy;
  const allBuy = hasBuy && !hasSell;
  const isMixed = hasSell && hasBuy;
  const handleActivateDDPI = () => {
    setActivateNowModel(false);
  };
  const refreshBrokerStatus = useRefreshBrokerStatus(userEmail);

  const handleTrade = async () => {
    setTradeClickCount(prevCount => prevCount + 1);

    // Market-hours gate — bypassed when advisor has allowAfterHoursOrders enabled.
    if (!IsMarketHours() && !allowAfterHoursOrders) {
      Toast.show({
        type: 'error',
        text1: 'Market Closed',
        text2: 'Orders cannot be placed after market hours.',
        position: 'top',
        visibilityTime: 3000,
      });
      return;
    }

    // Inline-fresh broker + funds — closure lag would re-pop the TokenExpire
    // modal right after a successful reconnect. See `docs/REBALANCING.md §
    // Closure-bound funds`.
    const freshStatus = await refreshBrokerStatus({forceNetwork: true});
    const currentFunds = freshStatus?.funds ?? funds;
    const currentBroker = freshStatus?.broker || broker;
    const currentBrokerStatus = freshStatus?.brokerStatus ?? brokerStatus;
    // Typed pre-flight — TRANSIENT (Upstox 00:00–05:30 IST maintenance,
    // ICICI base-64 hiccup, etc.) shows a soft toast + bails without
    // re-popping the TokenExpire modal. `isFundsEmpty` retained for the
    // existing per-broker branches below — true only on real auth
    // failure, false on TRANSIENT (we already bailed) and OK.
    const _fundsPreflight = classifyFundsResponse(currentFunds, currentBrokerStatus, currentBroker);
    if (_fundsPreflight.reason === 'TRANSIENT') {
      Toast.show({
        type: 'info',
        text1: `${currentBroker || 'Broker'} temporarily unavailable`,
        text2: _fundsPreflight.message,
        visibilityTime: 4500,
        position: 'bottom',
      });
    }
    const isFundsEmpty = !_fundsPreflight.ok && _fundsPreflight.reason !== 'NOT_CONNECTED' && _fundsPreflight.reason !== 'TRANSIENT';

    const currentBrokerRejectedCount = await getRejectedCount();

    const cartHasEquityDeliverySells = cartItems.some(item => {
      const txnType = String(item.transactionType || item.TransactionType || '').toUpperCase();
      if (txnType !== 'SELL') return false;
      const exchange = String(item.exchange || item.Exchange || '').toUpperCase();
      const productType = String(item.productType || item.ProductType || 'CNC').toUpperCase();
      if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
      if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
      return true;
    });

    if (currentBroker === 'Zerodha') {
      // Zerodha places via the Kite Publisher — an expired API token must
      // not block the review modal / publisher from opening (2026-08-18).
      if (
        shouldBlockTradeOnFundsPreflight(
          _fundsPreflight.reason,
          currentBroker,
        )
      ) {
        setOpenTokenExpireModel(true);
        return; // Exit as funds are empty
      } else if (currentBrokerStatus === null) {
        setBrokerModel(true);
        return;
      }
      if (allBuy) {
        setOpenReviewTrade(true);
      } else if ((tradeType?.allSell || tradeType?.isMixed) && cartHasEquityDeliverySells) {
        if (
          ['physical', 'ddpi'].includes(userDetails?.ddpi_status)
        ) {
          setShowDdpiModal(false);
          setOpenReviewTrade(true);
        } else {
          setShowDdpiModal(true);
          setOpenReviewTrade(false);
        }
      } else {
        setOpenReviewTrade(true);
      }
    } else if (currentBroker === 'Angel One') {
      if (edisStatus && edisStatus.edis === true) {
        setOpenReviewTrade(true);
      } else if (
        edisStatus &&
        edisStatus.edis === false &&
        (allSell || isMixed) &&
        cartHasEquityDeliverySells
      ) {
        setShowAngleOneTpinModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    } else if (currentBroker === 'Dhan') {
      if (isDhanSellAuthorizationReady(dhanEdisStatus, cartItems)) {
        setOpenReviewTrade(true);
      } else if (
        (allSell || isMixed) &&
        cartHasEquityDeliverySells
      ) {
        setShowDhanTpinModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    } else if (currentBroker === 'Fyers') {
      if (isFundsEmpty) {
        setOpenTokenExpireModel(true);
        return; // Exit as funds are empty
      } else if (currentBrokerStatus === null) {
        setBrokerModel(true);
        return;
      } else {
        setOpenReviewTrade(true);
      }
    } else {
      if (isFundsEmpty) {
        setOpenTokenExpireModel(true);
        return; // Exit as funds are empty
      } else if (currentBrokerStatus === null) {
        setBrokerModel(true);
        return;
      } else {
        setOpenReviewTrade(true);
      }
    }
  };

  const clearCart = async () => {
    try {
      eventEmitter.emit('GetAllTradeReferesh', cartItems);
      //  await AsyncStorage.removeItem('cartItems');
      setCartItems([]); // Clear state
      setStockDetails([]); // Clear stock details
      setCartCount1(0);
      setCartCount(0);
      console.log('Cart cleared successfully!');
    } catch (error) {
      console.error('Failed to clear the cart:', error);
    }
  };

  const [stockTypeAndSymbol, setStockTypeAndSymbol] = useState([]);

  const filterCartAfterOrder = async () => {
    try {
      // Retrieve cartItems from AsyncStorage
      const cartItemsString = await AsyncStorage.getItem('cartItems');

      if (cartItemsString) {
        let cartItems1 = JSON.parse(cartItemsString);

        // Filter out items in stockDetails from cartItems
        const updatedCartItems = cartItems1.filter(
          cartItem =>
            !cartItems.some(
              stockDetail =>
                stockDetail.tradingSymbol === cartItem.tradingSymbol &&
                stockDetail.tradeId === cartItem.tradeId,
            ),
        );

        // Save updated cartItems back to AsyncStorage
        await AsyncStorage.setItem(
          'cartItems',
          JSON.stringify(updatedCartItems),
        );
        setCartItems(updatedCartItems);
        // console.log('Cart items updated after filtering stockDetails');
      } else {
        console.log('No cartItems found in AsyncStorage');
      }
    } catch (error) {
      console.error('Error filtering cart items after order placement:', error);
    }
  };

  const getCartAllStocks = async () => {
    // Start timer before the computation block

    const cartData = await AsyncStorage.getItem('cartItems');
    if (cartData) {
      const parsedCartData = JSON.parse(cartData);
      console.log('Parredeeddddddddddddddddd:', parsedCartData);

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
      console.log('Parsed Cart:', typeAndSymbol);
      // Set stock type and symbol state
      setStockTypeAndSymbol(typeAndSymbol);
    } else {
      // Handle case where cartData is null or empty
      setTypes([]);
      setTradeType({});
      setStockTypeAndSymbol([]);
    }
    return cartData ? JSON.parse(cartData) : [];
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
      console.log('Update portfolio Endpoint---', endpoint);
      const config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}${endpoint}/user-portfolio`,

        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },

        data: JSON.stringify({user_email: userEmail}),
      };

      return await axios.request(config);
    } catch (error) {
      console.error(`Error updating portfolio for ${brokerName}:`, error);
    }
  };

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
        fontFamily: designFont('Poppins-Medium'), // Customize your font
      },
      text2Style: {
        color: 'black',
        fontSize: 12,
        fontFamily: designFont('Poppins-Regular'), // Customize your font
      },
    });
  };

  const [basketData, setBasketData] = useState([]);

  const [isReturningFromOtherBrokerModal, setIsReturningFromOtherBrokerModal] =
    useState(false);
  const executePlaceOrder = async cartItems => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Orders to Place',
        text2: 'Add item to cart to place order.',
      });
      return;
    }

    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) return;

    setLoading(true);

    const getOrderPayload = () => {
      // Trade variant — `"AMO" | "REGULAR"`. Tagged on every per-trade
      // object at submit. See docs/APP_ARCHITECTURE.md § 4.5.2 Trade
      // variant field. Display-only — no behavioural change.
      const variant = computeTradeVariant(allowAfterHoursOrders);
      return {
        trades: cartItems.map(item => ({ ...item, variant })),
        user_broker: broker,
        user_email: userEmail,
        accessToken: jwtToken,
      };
    };
    const allBuy = cartItems.every(stock => stock.transactionType === 'BUY');
    const allSell = cartItems.every(stock => stock.transactionType === 'SELL');
    const isMixed = !allBuy && !allSell;
    const specialBrokers = [
      // "Dhan",
      'IIFL Securities',
      'ICICI Direct',
      'Upstox',
      'Kotak',
      'Hdfc Securities',
      'AliceBlue',
          "Motilal Oswal",
      "Groww",
    ];

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

    const allFNO = cartItems.every(item => {
      const exchange = String(item.exchange || item.Exchange || '').toUpperCase();
      const productType = String(item.productType || item.ProductType || 'CNC').toUpperCase();
      return ['NFO', 'BFO', 'MCX'].includes(exchange) || ['MIS', 'NRML', 'CARRYFORWARD'].includes(productType);
    });
    console.log('i am here broooo---', allFNO);
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
      // Phase A trade-exec alignment: cart placements POST directly to ccxt.
      // Never dispatch a second route after an unknown first outcome.
      const directCcxtUrl = `${server.ccxtServer.baseUrl}orders/process-trade`;
      const placeOrderHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };
      const basePayload = getOrderPayload();
      const payloadWithClientIds = prepareExecutionPayload(basePayload);
      let response;
      let placementResults;
      let placementEnvelope;

      if (
        durableOrderExecutionEnabled(configData) &&
        isDurableDirectOrderEligible(payloadWithClientIds)
      ) {
        placementEnvelope = await submitDurableOrder(
          payloadWithClientIds,
          configData,
        );
        placementResults = placementEnvelope?.results || [];
      } else if (sdkExecuteAdviceEnabled) {
        try {
          const sdkResp = await sdkClient.placeOrders({
            trades: payloadWithClientIds.trades,
            brokerName: broker,
            requestId: payloadWithClientIds.requestId,
          });
          placementEnvelope = sdkResp;
          placementResults = sdkResp?.results || [];
          console.log('[AddtoCartModal] SDK placeOrders result:', placementResults.length, 'rows');
        } catch (sdkErr) {
          console.error('[AddtoCartModal] SDK placeOrders outcome unavailable:', sdkErr?.message);
          throw sdkErr;
        }
      }

      if (!placementResults) {
        response = await axios.request({
          method: 'post',
          url: directCcxtUrl,
          timeout: 120000,
          headers: {...placeOrderHeaders, 'x-request-id': payloadWithClientIds.requestId},
          data: JSON.stringify(payloadWithClientIds),
        });
        placementEnvelope = response.data;
        placementResults = response.data?.results || [];
      }

      if (isReconciliationResponse(response?.status, placementEnvelope)) {
        setLoading(false);
        setOrderPlacementResponse(placementResults);
        if (placementResults.length) setOpenSucessModal(true);
        setOpenReviewTrade(false);
        Toast.show({
          type: 'info',
          text1: 'Checking with broker',
          text2: reconciliationMessage(placementEnvelope),
          visibilityTime: 7000,
        });
        return;
      }

      setLoading(false);

      // setOpenSucessModal(true);
      console.log('respoiiinsi:', placementResults);
      setOrderPlacementResponse(placementResults);
      if (
        (!placementResults || placementResults.length === 0) &&
        (allSell || isMixed) &&
        !allFNO &&
        broker === 'Fyers'
      ) {
        Toast.show({
          type: 'error',
          text1: 'Order Processing Failed',
          text2:
            placementEnvelope?.message ||
            placementEnvelope?.error ||
            'No order result was received from Fyers. Please check Order Details before retrying.',
          visibilityTime: 6000,
        });
        setOpenReviewTrade(false);
        return;
      }
      // setShowAfterPlaceOrderDdpiModal(true)
      // Calculate the rejected sell count from the response

      const rejectedSellCount = (placementResults || []).reduce(
        (count, order) => {
          return isOrderRejected(order?.orderStatus) &&
            order.transactionType === 'SELL'
            ? count + 1
            : count;
        },
        0,
      );

      const successCount = (placementResults || []).reduce((count, order) => {
        return isOrderSuccess(order?.orderStatus) &&
          (order.transactionType === 'SELL' || tradeType.isMixed)
          ? count + 1
          : count;
      }, 0);

      // Check for CDSL/EDIS/TPIN error messages in rejected orders
      const hasCdslError = (placementResults || []).some((order) => {
        const msg = (order?.orderStatusMessage || order?.message_aq || order?.message || "").toLowerCase();
        return msg.includes("cdsl") || msg.includes("edis") || msg.includes("tpin") || msg.includes("validate qty");
      });

      console.log(`${broker} Rejected Sell Count:`, rejectedSellCount, 'Success Count:', successCount, 'CDSL Error:', hasCdslError);
      const sellAuthRejected = hasExplicitSellAuthRejection({
        ...(placementEnvelope || {}),
        results: placementResults,
      });

      // Dhan: Check CDSL error messages in rejected orders
      if (
        broker === 'Dhan' &&
        (allSell || isMixed) &&
        rejectedSellCount >= 1
      ) {
        if (hasCdslError) {
          setShowDhanTpinModel(true);
          setOpenReviewTrade(false);
          setLoading(false);
          return;
        }
      }

      // Special brokers (IIFL, ICICI, Upstox, Kotak, HDFC, AliceBlue, etc.)
      if (
        !isReturningFromOtherBrokerModal &&
        specialBrokers.includes(broker)
      ) {
        if (allBuy) {
          console.log('All trades are BUY for broker:', broker);
          setOpenSucessModal(true);
        } else if ((allSell || isMixed) && rejectedSellCount >= 1 && successCount === 0) {
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
        !allFNO &&
        rejectedSellCount >= 1 &&
        successCount === 0 &&
        (broker !== 'Fyers' || sellAuthRejected)
      ) {
        console.log('Setting TPIN modal to true for', broker);
        setOpenSucessModal(false);
        setOpenReviewTrade(false);

        if (broker === 'Angel One') {
          setShowAngleOneTpinModel(true);
        } else if (currentBroker === 'Dhan') {
          setShowDhanTpinModel(true);
        } else if (broker === 'Fyers') {
          setShowFyersTpinModal(true);
        } else if (broker === 'Zerodha') {
          setShowDdpiModal && setShowDdpiModal(true);
        } else {
          setOrderPlacementResponse(placementResults);
          setOpenSucessModal(true);
        }
        return;
      } else {
        console.log('Setting openSuccessModal to true');
        setOrderPlacementResponse(placementResults);
        setOpenSucessModal(true);
      }
      setOpenReviewTrade(false);
      await Promise.all([
        updatePortfolioData(broker, userEmail),
        getAllTrades(),
        await AsyncStorage.setItem('cartItems', JSON.stringify([])),
        await clearCart(),
        //  handleCartUpdate(),

        //setStockDetails([]),
        // setCartItems([]),
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

      if (error?.response?.status === 409) {
        Toast.show({
          type: 'info',
          text1: 'Order already processing',
          text2: error.response?.data?.message || 'Do not submit this order again.',
          visibilityTime: 6000,
        });
        setOpenReviewTrade(false);
        return;
      }
      if (error?.response?.status === 503 && error?.response?.data?.retryAllowed === true) {
        Toast.show({
          type: 'error',
          text1: 'Order not sent',
          text2: error.response?.data?.message || 'Refresh and try again shortly.',
          visibilityTime: 6000,
        });
        return;
      }
      if (isAmbiguousPlacementError(error)) {
        Toast.show({
          type: 'info',
          text1: 'Checking with broker',
          text2: reconciliationMessage(error?.response?.data),
          visibilityTime: 7000,
        });
        setOpenReviewTrade(false);
        return;
      }

      // Determine a user-friendly error message
      let errorMessage;
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') {
        errorMessage = `The response from ${broker} was not received. Check Order Details before taking any action.`;
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        errorMessage = `${broker} session has expired. Please reconnect your broker and try again.`;
      } else {
        errorMessage =
          error.response?.data?.details?.[0]?.message_aq ||
          error.response?.data?.details?.[0]?.message ||
          'There was an issue in placing the trade, please try again after sometime or contact your manager';
      }

      if (
        (allSell || isMixed) &&
        !allFNO &&
        (broker !== 'Fyers' ||
          hasExplicitSellAuthRejection(error?.response?.data))
      ) {
        if (broker === 'Dhan') {
          setShowDhanTpinModel(true);
          setOpenReviewTrade(false);
          return;
        } else if (currentBroker === 'Angel One') {
          setShowAngleOneTpinModel(true);
          setOpenReviewTrade(false);
          return;
        } else if (broker === 'Fyers') {
          setShowFyersTpinModal(true);
          setOpenReviewTrade(false);
          return;
        } else if (broker === 'Zerodha') {
          setShowDdpiModal && setShowDdpiModal(true);
          setOpenReviewTrade(false);
          return;
        } else if (specialBrokers.includes(broker)) {
          setShowOtherBrokerModel(true);
          setOpenReviewTrade(false);
          return;
        }
      }

      Toast.show({
        type: 'error',
        text1: 'Order Failed',
        text2: errorMessage,
      });
    }
    setIsReturningFromOtherBrokerModal(false);
  };

  const placeOrder = async cartItems => {
    if (orderSubmissionInFlightRef.current) {
      Toast.show({
        type: 'info',
        text1: 'Order already being placed',
        text2: 'Please wait for the current request to finish.',
      });
      return;
    }
    orderSubmissionInFlightRef.current = true;
    try {
      await executePlaceOrder(cartItems);
    } finally {
      orderSubmissionInFlightRef.current = false;
    }
  };

  const [mbasket, setmbasket] = useState(null);

  // Was the literal 'test' — Kite's connect/basket redirect_params carried
  // "test=true" so the post-order redirect-back never carried the advisor
  // origin (basket showed "pending" with no confirm). Use the same resolved
  // header name StockAdvices uses; REACT_APP_HEADER_NAME is a build-time env
  // (markup_app .env → "markup") so it is always available — no 'prod' literal.
  const appURL = configData?.config?.REACT_APP_HEADER_NAME || Config.REACT_APP_HEADER_NAME;
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

  const [htmlContentfinal, setHtmlContent] = useState('');

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
        text2: `Missing exchange for: ${missingList}. Please contact your manager.`,
        visibilityTime: 8000,
      });
      return;
    }

    const apiKey = zerodhaApiKey;

    let freshProtectionPrices;
    try {
      freshProtectionPrices = await fetchFreshKiteProtectionPrices(
        stockDetails,
        symbolMap,
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Live price is unavailable',
        text2: error?.message || 'Please retry. No order was sent.',
        visibilityTime: 7000,
      });
      return;
    }

    const basket = stockDetails.map(stock => {
      // Scripmaster-resolved symbol/exchange (-EQ strip, BE→BSE, etc).
      const resolved = resolveZerodhaSymbol(stock, symbolMap);
      // LTP: live on resolved → live on raw → server-cached fallback.
      const freshLtp = Number(
        freshProtectionPrices?.[String(resolved.tradingsymbol || '').toUpperCase()],
      );
      const isMarket = String(stock.orderType || '').toUpperCase() === 'MARKET';
      const liveLtp = getLastKnownPrice(resolved.tradingsymbol) || getLastKnownPrice(stock.tradingSymbol);
      const ltp = isMarket
        ? freshLtp
        : (liveLtp && liveLtp !== '-' && parseFloat(liveLtp) > 0
          ? liveLtp
          : resolved.cachedLtp || 0);
      let orderPrice = 0;

      if (stock.orderType === 'LIMIT') {
        orderPrice = parseFloat(stock.price || 0);
      } else if (stock.orderType === 'MARKET' || stock.orderType === 'SL') {
        orderPrice = ltp && ltp !== '-' ? parseFloat(ltp) : 0;
      }

      // Build tag from zerodhaTradeId for order tracking/reconciliation (matching prod)
      const tradeTag = (stock.zerodhaTradeId || stock.tradeId || '').substring(0, 20);

      // Kite Publisher expects SHARES. Basket legs carry quantity in LOTS
      // plus the `Lots` lot-size field — multiply so a 2-lot NIFTY leg
      // reaches Kite as 150 shares, not 2. Single stocks have no `Lots`
      // field and stay unchanged (their quantity is already shares).
      const kiteShares =
        (parseInt(stock.quantity, 10) || 1) *
        (parseInt(stock.Lots || stock.lots || 1, 10) || 1);

      const basketItem = convertToBasketItem('Zerodha', stock, symbolMap, {
        tradingsymbol: resolved.tradingsymbol,
        exchange: resolved.exchange,
        ltp,
        price: orderPrice,
        quantity: kiteShares,
        tag: tradeTag,
      });
      console.log('[ZerodhaPublisher] Basket item:', JSON.stringify(basketItem));

      return basketItem;
    });

    try {
      // F&O/basket margin safety (web parity — BasketModal.js buys-first
      // sort): place BUY legs before SELL on the Kite/Zerodha Publisher
      // path so buys reserve margin before sells free it. The ccxt
      // /order-place path already enforces this server-side; this covers
      // ONLY the client-side Kite basket, which bypasses the orchestrator.
      // Stable sort (Hermes/V8) — legs keep their relative order within
      // each side; closure/exit baskets never reach this publisher path.
      basket.sort((a, b) => {
        const aBuy = String(a.transaction_type || '').toUpperCase() === 'BUY' ? 0 : 1;
        const bBuy = String(b.transaction_type || '').toUpperCase() === 'BUY' ? 0 : 1;
        return aBuy - bBuy;
      });

      // Generate HTML form content
      const htmlContent = generateHtmlForm(basket, apiKey);
      setHtmlContent(htmlContent);
      // Inject the HTML form into WebView
    } catch (error) {
      console.error('Failed to prepare Zerodha publisher:', error);
    }
  };

  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);
  const [zerodhaStatus, setZerodhaStatus] = useState(null);

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
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
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
          advisor: Config.REACT_APP_ADVISOR_SPECIFIC_TAG,
        }),
      };

      try {
        const response = await axios.request(recordConfig);
        console.log('[ZerodhaPublisher] Record orders response:', response.data.response);

        const orderResults = response.data.response || response.data.results || [];

        setOpenSucessModal(true);
        setOrderPlacementResponse(orderResults);
        setOpenReviewTrade(false);
        getAllTrades();
        updatePortfolioData();

        // Await AsyncStorage removal for confirmation
        await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      } catch (error) {
        console.error('Order placement failed:', error);
        showToast('Orders cannot be placed.', 'error', '');
      }
    }
  };

  const totalAmount = 0;

  const [openRebalanceModal, setOpenRebalanceModal] = useState(false);
  const [calculatedPortfolioData, setCaluculatedPortfolioData] = useState(null);
  const [modelPortfolioModelId, setModelPortfolioModelId] = useState('');
  const [storeModalName, setStoreModalName] = useState('');
  // Function to handle closing
  const handleCloseDdpiModal = () => {
    setShowDdpiModal(false); // Or toggle the state as per your logic
  };
  const openReviewModal = () => {
    setOpenReviewTrade(true); // Or toggle the state as per your logic
  };

  const handleConnectAndPlaceOrder = async cartItems => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'No Orders to Place',
        text2: 'Add item to cart to place order.',
      });
      return;
    }

    if (
      brokerStatus === undefined ||
      brokerStatus !== 'connected' ||
      brokerStatus === 'Disconnected'
    ) {
      setModalVisible(true);
      return;
    } else if (
      (funds.status === false || funds.status === 1) &&
      // Zerodha publisher path doesn't need the API session — Kite enforces
      // funds. Only block non-Zerodha brokers on a stale funds object.
      broker !== 'Zerodha'
    ) {
      setOpenReviewTrade(false);
      setOpenZerodhaModel(false);
      setOpenTokenExpireModel(true);
    } else {
      // If status is not false or 1, you can directly place the order or show some message
      placeOrder(cartItems);
    }
  };

  ////////

  useEffect(() => {
    // Function to reload the cart when the 'cartUpdated' eventcartUpdated is emitted
    const handleCartUpdate = async () => {
      const cartData = await AsyncStorage.getItem('cartItems');
      const items = cartData ? JSON.parse(cartData) : [];
      setCartItems(items); // Update cart items state
      setCartCount1(items.length); // Update cart count
    };

    // Add event listener for 'cartUpdated' event
    eventEmitter.on('cartUpdated', handleCartUpdate);
    // Cleanup the event listener when the component unmounts
    return () => {
      eventEmitter.off('cartUpdated', handleCartUpdate);
    };
  }, []);

  useEffect(() => {
    fetchCartItems();
  }, []); // Corrected to use an empty dependency array

  useEffect(() => {
    if (userDetails && userDetails.user_broker === 'Angel One') {
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
            { headers: ccxtHeaders },
          );
          setZerodhaDdpiStatus(response.data);
        } catch (error) {
          console.log('[edis] status sync failed (handled):', error?.message);
        }
      };

      verifyZerodhaDdpi();
    }
  }, [userDetails]);

  useEffect(() => {
    if (
        userDetails &&
        userDetails.user_broker === 'Zerodha' &&
        // Server @extract_keys requires `edis`; the user doc has no such
        // field today, so an unguarded POST is a guaranteed 400 on every
        // load. Only sync when a boolean status actually exists.
        typeof userDetails.edis === 'boolean'
      ) {
      const verifyZerodhaEdis = async () => {
        try {
          const response = await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/save-edis-status`,
            {
              userEmail: userDetails.email,
              edis: userDetails.edis,
            },
            { headers: ccxtHeaders },
          );
          setZerodhaDdpiStatus(response.data);
        } catch (error) {
          console.log('[edis] status sync failed (handled):', error?.message);
        }
      };

      verifyZerodhaEdis();
    }
  }, [userDetails]);

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
    getCartAllStocks();
  }, []);

  useEffect(() => {
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
    if (
      zerodhaStatus !== null &&
      zerodhaRequestType === 'basket' &&
      jwtToken !== undefined
    ) {
      checkZerodhaStatus();
    }
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);
 

  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <View style={styles.middleSection}>
        <View style={styles.itemInfo}>
          <Text>
            <Text
              style={{fontFamily: designFont('Satoshi-Bold'), fontSize: 16, color: designColor('000')}}>
              {cartCount}
            </Text>
            <Text style={styles.itemText}> Stocks | </Text>
              <TotalAmountText
                  stockDetails={cartItems}
                  type={'reviewTrade'}
                />
          </Text>
        </View>
        <TouchableOpacity onPress={handleTrade} style={styles.cartButton}>
          <Text style={styles.cartButtonText}>View Cart</Text>
        </TouchableOpacity>
      </View>
      {openZerodhaReviewModal && (
        <ZerodhaReviewModal
          isVisible={openZerodhaReviewModal}
          onClose={() => setOpenZerodhaModel(false)}
          stockDetails={cartItems}
          setOpenZerodhaModel={setOpenZerodhaModel}
          mbasket={mbasket}
          htmlContent={htmlContentfinal}
          appURL={appURL}
          loading={loading}
          getAllTrades={getAllTrades}
          zerodhaApiKey={zerodhaApiKey}
          userEmail={userEmail}
          userDetails={userDetails}
          filterCartAfterOrder={filterCartAfterOrder}
          getCartAllStocks={getCartAllStocks}
          updatePortfolioData={updatePortfolioData}
          broker={broker}
          setCartCount={setCartCount}
          setOpenSucessModal={setOpenSucessModal}
          setOrderPlacementResponse={setOrderPlacementResponse}
          setStockDetails={setCartItems}
          clearCart={clearCart}
        />
      )}
      {openReviewTrade && (
        <ReviewTradeModal
          visible={openReviewTrade}
          onClose={() => setOpenReviewTrade(false)}
          stockDetails={cartItems}
          basketData={basketData}
          setBasketData={setBasketData}
          placeOrder={handleConnectAndPlaceOrder}
          loading={loading}
          getCartAllStocks={getCartAllStocks}
          cartCount={cartCount}
          setStockDetails={setCartItems}
        />
      )}
      {openSuccessModal && (
        <RecommendationSuccessModal
          openSuccessModal={openSuccessModal}
          setOpenSucessModal={setOpenSucessModal}
          orderPlacementResponse={orderPlacementResponse}
          currentBroker={broker}
          // Outgoing trades — fallback source for `variant` lookups when
          // the response item doesn't carry the field (rebalance/MP lane).
          // See utils/tradeVariant.js § resolveResultVariant.
          originalStockDetails={cartItems}
        />
      )}
      {showDdpiModal && (
        <DdpiModal
          sellOrders={sellOrdersForAuth(orderPlacementResponse, stockDetails)}
          isOpen={showDdpiModal}
          setIsOpen={handleCloseDdpiModal}
          proceedWithTpin={handleProceedWithTpin}
          userDetails={userDetails && userDetails}
          setOpenReviewTrade={setOpenReviewTrade}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
        />
      )}
      {showActivateNowModel && (
        <ActivateNowModel
          isOpen={showActivateNowModel}
          setIsOpen={setActivateNowModel}
          onActivate={handleActivateDDPI}
          userDetails={userDetails}
        />
      )}
      {showAngleOneTpinModel && (
        <AngleOneTpinModal
          sellOrders={sellOrdersForAuth(orderPlacementResponse, stockDetails)}
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
          sellOrders={sellOrdersForAuth(orderPlacementResponse, stockDetails)}
          isOpen={showFyersTpinModal}
          setIsOpen={setShowFyersTpinModal}
          userDetails={userDetails}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
        />
      )}
      {showDhanTpinModel && (
        <DhanTpinModal
          sellOrders={sellOrdersForAuth(orderPlacementResponse, stockDetails)}
          isOpen={showDhanTpinModel}
          setIsOpen={setShowDhanTpinModel}
          userDetails={userDetails}
          dhanEdisStatus={dhanEdisStatus}
          stockTypeAndSymbol={stockTypeAndSymbol}
          singleStockTypeAndSymbol={singleStockTypeAndSymbol}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
          onEdisStatusRefresh={setDhanEdisStatus}
        />
      )}
      {showOtherBrokerModel && (
        <OtherBrokerModel
          sellOrders={sellOrdersForAuth(orderPlacementResponse, stockDetails)}
          userDetails={userDetails}
          onContinue={() => {
            setIsReturningFromOtherBrokerModal(true);
            setShowOtherBrokerModel(false);
          }}
          setShowOtherBrokerModel={setShowOtherBrokerModel}
          openReviewModal={openReviewModal}
          setOpenReviewTrade={setOpenReviewTrade}
          setActivateNowModel={setActivateNowModel}
          userEmail={userEmail}
          apiKey={apiKey}
          jwtToken={jwtToken}
          secretKey={secretKey}
          clientCode={clientCode}
          broker={broker}
          sid={sid}
          viewToken={viewToken}
          serverId={serverId}
          setOpenRebalanceModal={setOpenRebalanceModal}
          setCaluculatedPortfolioData={setCaluculatedPortfolioData}
          setModelPortfolioModelId={setModelPortfolioModelId}
          modelPortfolioModelId={modelPortfolioModelId}
          setStoreModalName={setStoreModalName}
          storeModalName={storeModalName}
          funds={funds}
          reopenRebalanceModal={() => setOpenRebalanceModal(true)}
          getUserDetails={getUserDeatils}
        />
      )}
      {(modalVisible || OpenTokenExpireModel) && (
        <BrokerSelectionModal
          showBrokerModal={modalVisible}
          OpenTokenExpireModel={OpenTokenExpireModel}
          setShowBrokerModal={setModalVisible}
          setOpenTokenExpireModel={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
    backgroundColor: designColor('fff'),
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25,
    marginTop: 10,
    elevation: 10,
    shadowColor: 'black',
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  horizontal: {
    marginBottom: 20,
    borderRadius: 250,
    alignSelf: 'center',
  },
  deliveryText: {
    fontSize: 16,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('000'),
  },
  divider: {
    borderRadius: 20,
    marginVertical: 0,
    position: 'absolute',
    //  top: screenHeight*0.84, // Adjust as needed
    //  left: 0,
    // right: 0,
    justifyContent: 'center',
    zIndex: 0,
  },
  middleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    //marginTop:5,
    // borderWidth:1,
    alignContent: 'center',
    alignSelf: 'center',
    //  marginVertical:0,
  },
  itemInfo: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    color: designColor('000'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  cartButton: {
    backgroundColor: designColor('fff'),
    paddingVertical: 4,
    alignItems: 'center',

    // paddingHorizontal: 10,
    flexDirection: 'row',
    paddingHorizontal: 15,
    justifyContent: 'space-between',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: designColor('000'),
  },
  cartButtonText: {
    color: designColor('000'),
    fontSize: 14,
    marginRight: 15,
    fontFamily: designFont('Satoshi-Bold'),
  },
});

export default AddToCartModal;
