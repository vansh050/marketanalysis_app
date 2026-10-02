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
  Alert,
} from 'react-native';
import axios from 'axios';
import server from '../../utils/serverConfig';
import { useCart } from '../CartContext';
import LottieView from 'lottie-react-native';
import RecommendationSuccessModal from '../ModelPortfolioComponents/RecommendationSuccessModal';
import StandaloneManualPlacementModal from '../StandaloneManualPlacementModal';
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
import { validateStockExchanges, convertToBasketItem, fetchFreshKiteProtectionPrices, resolveZerodhaSymbol } from '../../utils/brokerPublisher';
import useZerodhaSymbolMap from '../../hooks/useZerodhaSymbolMap';
import {useRefreshBrokerStatus} from '../../hooks/useRefreshBrokerStatus';
import {isFundsErrorOrMissing} from '../../utils/rebalanceHelpers';
import {classifyFundsResponse, shouldBlockTradeOnFundsPreflight} from '../../utils/brokerSessionValidator';
import {executionBundleHeaders, handleStaleExecutionBundle} from '../../utils/executionBundleSafety';

import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ReviewTradeModal from '../ReviewTradeModal';
import { useModal } from '../../components/ModalContext';
import eventEmitter from '../EventEmitter';
import BrokerSelectionModal from '../BrokerSelectionModal';

import { useTrade } from '../../screens/TradeContext';
import { useConfig } from '../../context/ConfigContext';
import IsMarketHours from '../../utils/isMarketHours';
import { computeTradeVariant } from '../../utils/tradeVariant';
import {
  ZERODHA_PUBLISHER_ATTEMPT_KEY,
  ZERODHA_PUBLISHER_ORDER_KEY,
  buildUnconfirmedPublisherResults,
  classifyPublisherRecordResults,
  createZerodhaPublisherAttempt,
  getKitePublisherTag,
  isZerodhaPublisherRetryGuarded,
  parseZerodhaPublisherAttempt,
  sanitizePublisherRecordResults,
} from '../../utils/publisherOutcome';

// Single merged import — six separate `from '../DdpiModal'` lines made
// Metro's inline-requires transform assign the file's LAST dependency two
// different indices (pre/post-dedupe), leaving one call site pointing past
// the registered dependency array -> release-only hard crash
// 'Requiring unknown module "undefined"' on the Zerodha sell gate
// (2026-07-18, proven via unminified release bundle inspection).
import DdpiModal, { OtherBrokerModel, ActivateNowModel, DhanTpinModal, AngleOneTpinModal, FyersTpinModal } from '../DdpiModal';
import BrokerConnectModalDispatch from '../BrokerConnectionModal/BrokerConnectModalDispatch';
import Config from 'react-native-config';
import notifee, { EventType } from '@notifee/react-native';

import { generateToken } from '../../utils/SecurityTokenManager';
import { isZerodhaSellAuthorized } from '../../utils/zerodhaDdpiGate';
import {hasExplicitSellAuthRejection} from '../../utils/sellAuthMessage';
import {isDhanSellAuthorizationReady} from '../../utils/dhanEdis';
import { isGttNativeBroker, isGttOcoLeg } from '../../utils/gttSupport';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import {
  isAmbiguousPlacementError,
  isReconciliationResponse,
  prepareExecutionPayload,
  reconciliationMessage,
} from '../../utils/executionSafety';
import useSdkClient from '../../sdk/useSdkClient';
import {getAccountEmailAsync} from '../../utils/accountEmail';
import {getCustomerAuthHeaders} from '../../utils/customerAuthHeaders';
import {
  durableOrderExecutionEnabled,
  isDurableDirectOrderEligible,
  submitDurableOrder,
} from '../../services/DurableOrderService';
import {
  authorizeBasketEntry,
  basketEntryGateMessage,
} from '../../services/BasketEntryGateService';

import { designColor, designFont } from '../../design/literalTokens';
import {sellOrdersForAuth} from '../../utils/sellAuthOrders';

const isSdkExecuteAdviceEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_EXECUTE_ADVICE || '').trim().toLowerCase();
  return v === 'true' || v === '1';
};

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
  const { allowAfterHoursOrders, deviceTotpEnabled } = useConfig() || {};
  const sdkClient = useSdkClient();
  const sdkExecuteAdviceEnabled = isSdkExecuteAdviceEnabled() && !!sdkClient;
  const [stockRecoNotExecuted, setStockRecoNotExecuted] = useState([]);
  // User-typed card inputs (limit price / qty) keyed by tradeId. The 45s
  // background poll replaces the recommendation list wholesale; without this
  // overlay a half-typed limit price or qty reverts to the server value on
  // the next tick — the same clobber class we fixed on web for the rebalance
  // review (mergeEditableDraft). Merged in the re-derivation effect below.
  const [cardInputOverrides, setCardInputOverrides] = useState({});
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
  const zerodhaSubmissionInFlightRef = useRef(false);
  const orderSubmissionInFlightRef = useRef(false);
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
      //  console.log('[edis] status sync failed (handled):', error?.message);
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
      //  console.log('[edis] status sync failed (handled):', error?.message);
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
  const pendingReconnectActionRef = useRef(null);

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
  const queueBrokerReconnect = (resume, currentBroker) => {
    pendingReconnectActionRef.current = {
      broker: currentBroker,
      expiresAt: Date.now() + 2 * 60 * 1000,
      resume,
    };
    setOpenTokenExpireModel(true);
  };

  useEffect(() => {
    const resumeAfterReconnect = async event => {
      if (!/broker connection|connect|reconnect/i.test(event?.source || '')) return;
      const pending = pendingReconnectActionRef.current;
      if (!pending) return;
      if (pending.expiresAt <= Date.now()) {
        pendingReconnectActionRef.current = null;
        return;
      }
      const session = await refreshBrokerStatus({forceNetwork: true});
      if (session?.brokerStatus !== 'connected') return;
      if (pending.broker && session?.broker && pending.broker !== session.broker) return;
      pendingReconnectActionRef.current = null;
      setOpenTokenExpireModel(false);
      await pending.resume?.(session);
    };
    eventEmitter.on('refreshEvent', resumeAfterReconnect);
    return () => eventEmitter.off('refreshEvent', resumeAfterReconnect);
  }, [refreshBrokerStatus]);

  const _haltOnFundsCheckFailure = (
    currentFunds,
    currentBrokerStatus,
    currentBroker,
    resume,
  ) => {
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
      return false;
    }
    queueBrokerReconnect(resume, currentBroker);
    return true;
  };

  const reconcilePendingZerodhaAttempt = async (
    attempt,
    resolvedUserEmail,
  ) => {
    const pendingTrades = attempt.stockDetails;
    const pendingMessage =
      'A previous Zerodha order is still being confirmed. Do not place the same order again; check Kite Orders for the actual status.';

    // Explicit user consent to re-open Kite when the previous attempt can't
    // be confirmed. The duplicate-order risk is real (2026-07-29 incident),
    // so this is opt-in — never automatic.
    const confirmReopenKite = () =>
      new Promise(resolve => {
        Alert.alert(
          'Previous Zerodha order unconfirmed',
          'We could not confirm whether your previous order reached Kite. If it was actually placed, opening Kite again could duplicate it.',
          [
            {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
            {
              text: 'Open Kite Again',
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ],
          {cancelable: true, onDismiss: () => resolve(false)},
        );
      });

    try {
      const callbackConfirmed = [
        'success',
        'orders_detected',
      ].includes(attempt.publisherStatus);
      const customerAuthHeaders = await getCustomerAuthHeaders();
      if (!customerAuthHeaders) {
        throw new Error('Please sign in again before confirming this trade.');
      }
      const response = await axios.post(
        `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
        {
          stockDetails: pendingTrades,
          publisherResults: [
            {
              status: callbackConfirmed ? 'success' : 'unknown',
              source: 'mobile-retry-guard',
            },
          ],
          userEmail: resolvedUserEmail,
          broker: 'Zerodha',
          advisor: Config.REACT_APP_ADVISOR_SPECIFIC_TAG,
          attemptId: attempt.attemptId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain':
              configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
            ...customerAuthHeaders,
          },
          timeout: 90000,
        },
      );

      const results =
        response?.data?.response || response?.data?.results || [];
      const outcome = classifyPublisherRecordResults(results);

      if (outcome === 'recorded') {
        await AsyncStorage.multiRemove([
          ZERODHA_PUBLISHER_ORDER_KEY,
          ZERODHA_PUBLISHER_ATTEMPT_KEY,
        ]);
        setOrderPlacementResponse(results);
        setOpenSucessModal(true);
        setOpenReviewTrade(false);
        await Promise.allSettled([
          getAllTrades(),
          filterCartAfterOrder(pendingTrades),
          getCartAllStocks(),
          updatePortfolioData('Zerodha', resolvedUserEmail),
        ]);
        eventEmitter.emit('cartUpdated');
        eventEmitter.emit('OrderPlacedReferesh');
        Toast.show({
          type: 'success',
          text1: 'Previous Zerodha order found',
          text2: 'Its broker status has been restored. No duplicate was placed.',
          visibilityTime: 6000,
        });
        return true;
      }

      if (outcome === 'not_found') {
        await AsyncStorage.multiRemove([
          ZERODHA_PUBLISHER_ORDER_KEY,
          ZERODHA_PUBLISHER_ATTEMPT_KEY,
        ]);
        if (isZerodhaPublisherRetryGuarded(attempt)) {
          // Fresh attempt, order book is empty so far — block this slide
          // and ask the user to verify Kite before sliding again.
          const unconfirmedResults = buildUnconfirmedPublisherResults(
            pendingTrades,
            pendingMessage,
          );
          setOrderPlacementResponse(unconfirmedResults);
          setOpenSucessModal(true);
          setOpenReviewTrade(false);
          Toast.show({
            type: 'info',
            text1: 'Zerodha confirmation pending',
            text2: 'Please do not retry this order. Check Kite Orders first.',
            visibilityTime: 8000,
          });
          return true;
        }
        // Old attempt, no order in Kite — the current slide is a clean
        // placement. Proceed straight into the publisher.
        Toast.show({
          type: 'info',
          text1: 'No previous Zerodha order found',
          text2: 'Opening Kite for your new order.',
          visibilityTime: 6000,
        });
        return false;
      }

      // outcome 'pending'/'empty' — backend kept rows non-terminal.
      if (isZerodhaPublisherRetryGuarded(attempt)) {
        const unconfirmedResults =
          results.length > 0
            ? sanitizePublisherRecordResults(results, pendingMessage)
            : buildUnconfirmedPublisherResults(pendingTrades, pendingMessage);
        setOrderPlacementResponse(unconfirmedResults);
        setOpenSucessModal(true);
        setOpenReviewTrade(false);
        Toast.show({
          type: 'info',
          text1: 'Zerodha confirmation pending',
          text2: 'Please do not retry this order. Check Kite Orders first.',
          visibilityTime: 8000,
        });
        return true;
      }

      const reopen = await confirmReopenKite();
      if (!reopen) {
        const unconfirmedResults =
          results.length > 0
            ? sanitizePublisherRecordResults(results, pendingMessage)
            : buildUnconfirmedPublisherResults(pendingTrades, pendingMessage);
        setOrderPlacementResponse(unconfirmedResults);
        setOpenSucessModal(true);
        setOpenReviewTrade(false);
        return true;
      }
      await AsyncStorage.multiRemove([
        ZERODHA_PUBLISHER_ORDER_KEY,
        ZERODHA_PUBLISHER_ATTEMPT_KEY,
      ]);
      return false;
    } catch (error) {
      console.error(
        '[ZerodhaPublisher] Retry-guard reconciliation failed:',
        error.response?.data || error.message,
      );
      if (isZerodhaPublisherRetryGuarded(attempt)) {
        setOrderPlacementResponse(
          buildUnconfirmedPublisherResults(pendingTrades, pendingMessage),
        );
        setOpenSucessModal(true);
        setOpenReviewTrade(false);
        Toast.show({
          type: 'info',
          text1: 'Zerodha confirmation pending',
          text2: 'Please do not retry this order. Check Kite Orders first.',
          visibilityTime: 8000,
        });
        return true;
      }
      const reopen = await confirmReopenKite();
      if (!reopen) {
        setOrderPlacementResponse(
          buildUnconfirmedPublisherResults(pendingTrades, pendingMessage),
        );
        setOpenSucessModal(true);
        setOpenReviewTrade(false);
        return true;
      }
      await AsyncStorage.multiRemove([
        ZERODHA_PUBLISHER_ORDER_KEY,
        ZERODHA_PUBLISHER_ATTEMPT_KEY,
      ]);
      return false;
    }
  };

  const executePlaceOrder = async (stockDetails, verifiedSession = null) => {
    setLoading(true);

    const effectiveBasketId = basketId || stockDetails?.[0]?.basketId;
    if (isBasket || effectiveBasketId) {
      try {
        const gateTrades = (stockDetails || []).map(trade => ({
          ...trade,
          purpose:
            trade.purpose ||
            (trade.isClosure === true ||
            ['fullclose', 'partialclose'].includes(
              String(trade.closurestatus || '').toLowerCase(),
            )
              ? 'EXIT'
              : 'ENTRY'),
        }));
        const gateDecision = await authorizeBasketEntry({
          userEmail: userEmail || userDetails?.email,
          basketId: effectiveBasketId,
          trades: gateTrades,
          route: broker === 'Zerodha'
            ? 'mobile_zerodha_publisher'
            : 'mobile_basket_rest',
          configData,
        });
        if (!gateDecision.allowed) {
          Toast.show({
            type: 'info',
            text1: basketEntryGateMessage(gateDecision),
            text2: 'No order was sent.',
          });
          setLoading(false);
          return;
        }
      } catch (_) {
        Toast.show({
          type: 'error',
          text1: 'Entry is temporarily unavailable',
          text2: 'No order was sent. Please retry.',
        });
        setLoading(false);
        return;
      }
    }

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

    // Zerodha: MUST use Kite Publisher WebView for order placement —
    // EXCEPT when the basket contains GTT orders. Kite Publisher's HTML
    // form (`POST kite.zerodha.com/connect/basket`) does NOT support GTT
    // semantics — it only accepts regular variety orders. If we routed
    // GTT orders through the publisher, the GTT config (trigger price,
    // stop-loss, target) would silently degrade to plain MARKET/LIMIT
    // and the user's intent would be lost without any visible error.
    // The REST path below (L624-632 split) correctly routes GTT orders
    // through ccxt-india's `/{broker}/process-trades` GTT endpoint, so
    // when GTT is present we fall through to REST for the whole basket.
    // Trade-off: mixed GTT+regular baskets lose the Kite Publisher UX,
    // but order correctness is preserved.
    const hasGttOrders = stockDetails.some(s => s.gttCheck === true);
    const usesZerodhaPublisher =
      broker === 'Zerodha' && (!hasGttOrders || isBasket);

    // Funds/session preflight is SKIPPED on the Zerodha publisher path:
    // the Kite basket is completed inside Kite and never touches the
    // app's broker API session, so an expired token must not stop the
    // publisher from opening (2026-08-18 — Markup user stuck at the
    // token-expire modal while the publisher flow would have worked).
    // REST/GTT paths keep the check.
    if (
      !usesZerodhaPublisher &&
      _haltOnFundsCheckFailure(
        verifiedSession?.funds ?? funds,
        verifiedSession?.brokerStatus ?? brokerStatus,
        verifiedSession?.broker ?? broker,
        session => placeOrder(stockDetails, session),
      )
    ) {
      setOpenReviewTrade(false);
      setLoading(false);
      return;
    }

    if (usesZerodhaPublisher) {
      if (zerodhaSubmissionInFlightRef.current) {
        setLoading(false);
        Toast.show({
          type: 'info',
          text1: 'Zerodha order already opening',
          text2: 'Please complete the current order before trying again.',
        });
        return;
      }

      zerodhaSubmissionInFlightRef.current = true;
      try {
        const resolvedUserEmail =
          (await getAccountEmailAsync()) ||
          userEmail ||
          userDetails?.email;
        if (!resolvedUserEmail) {
          throw new Error(
            'Your account identity is still loading. Please try again in a moment.',
          );
        }

        // Never overwrite an unresolved attempt. Reconcile it against Kite's
        // order book first; this is what prevents a second slide from creating
        // the duplicate order seen in the 2026-07-29 incident. When the guard
        // can't confirm an old attempt, the user may explicitly choose to
        // re-open Kite — reconcile returns false and we fall through to a
        // fresh publisher handoff.
        const storedAttempt = parseZerodhaPublisherAttempt(
          await AsyncStorage.getItem(ZERODHA_PUBLISHER_ATTEMPT_KEY),
        );
        if (storedAttempt) {
          const reconciled = await reconcilePendingZerodhaAttempt(
            storedAttempt,
            resolvedUserEmail,
          );
          if (reconciled) return;
        }

        // Tag `variant` before persisting the exact payload handed to Kite.
        // The modal is mounted only after both recovery records are durable,
        // so a missing AsyncStorage value can never become a null record-back.
        const zerodhaVariant = computeTradeVariant(allowAfterHoursOrders);
        const zerodhaTrades = stockDetails.map(s => ({
          ...s,
          variant: s.variant || zerodhaVariant,
        })).sort(
          (a, b) => Number(a.priority ?? a.Priority ?? 0) - Number(b.priority ?? b.Priority ?? 0),
        );
        if (isBasket && zerodhaTrades.length > 10) {
          throw new Error(
            `This basket has ${zerodhaTrades.length} legs; Zerodha supports 10 in one Publisher window.`,
          );
        }
        const attempt = createZerodhaPublisherAttempt({
          stockDetails: zerodhaTrades,
          userEmail: resolvedUserEmail,
          flow: isBasket ? 'basket' : 'single',
        });

        const publisherReady = await handleZerodhaRedirect(zerodhaTrades);
        if (!publisherReady) return;

        try {
          await AsyncStorage.multiSet([
            [
              ZERODHA_PUBLISHER_ORDER_KEY,
              JSON.stringify(zerodhaTrades),
            ],
            [
              ZERODHA_PUBLISHER_ATTEMPT_KEY,
              JSON.stringify(attempt),
            ],
          ]);
        } catch (storageError) {
          await AsyncStorage.multiRemove([
            ZERODHA_PUBLISHER_ORDER_KEY,
            ZERODHA_PUBLISHER_ATTEMPT_KEY,
          ]).catch(() => {});
          throw new Error(
            'The order could not be saved safely before opening Zerodha. Please try again.',
          );
        }

        // Standalone Publisher is a two-phase server-owned execution:
        // reserve the exact recommendation first, then bind the imminent
        // WebView opening to a one-use activation. No browser-side pre-write
        // is allowed to mark the recommendation as executed.
        const intentPayload = {
          userEmail: resolvedUserEmail,
          broker: 'Zerodha',
          flow: attempt.flow,
          attemptId: attempt.attemptId,
          context: {
            source: 'mobile-stock-advices',
            attemptId: attempt.attemptId,
            basketId: effectiveBasketId || '',
            basketName: basketName || '',
          },
          legs: zerodhaTrades.map(stock => ({
            symbol: stock.tradingSymbol || stock.symbol,
            type: stock.transactionType || stock.type,
            quantity: stock.quantity,
            exchange: stock.exchange || stock.Exchange || '',
            orderType: stock.orderType || stock.OrderType || '',
            tradeId: stock.tradeId || '',
            zerodhaTradeId: stock.zerodhaTradeId || '',
            publisherTag: stock.publisherTag || stock.zerodhaTradeId || '',
            basketId: stock.basketId || effectiveBasketId || '',
            basketName: stock.basketName || basketName || '',
            lotsize: stock.lotsize || stock.Lots || 1,
            quantity_unit: isBasket ? 'lots' : (stock.quantity_unit || 'shares'),
            appliedMultiplier: stock.appliedMultiplier,
            closurestatus: stock.closurestatus || '',
            purpose: stock.purpose || '',
            productType: stock.productType || stock.ProductType || '',
          })),
        };
        const customerAuthHeaders = await getCustomerAuthHeaders();
        if (!customerAuthHeaders) {
          throw new Error('Please sign in again before opening Zerodha.');
        }
        const intentConfig = {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain':
              configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
            ...customerAuthHeaders,
            ...executionBundleHeaders(),
          },
          timeout: 4000,
        };
        const preparedResponse = await axios.post(
          `${server.server.baseUrl}api/process-trades/execution-intent`,
          {...intentPayload, lifecycle: 'prepared'},
          intentConfig,
        );
        if (
          !preparedResponse?.data?.intentId ||
          preparedResponse?.data?.attemptId !== attempt.attemptId ||
          preparedResponse?.data?.payloadMismatch
        ) {
          throw new Error(
            'The execution session could not be reserved safely. Please try again.',
          );
        }
        const activationId =
          `mobile-${attempt.attemptId}-${Date.now()}`;
        const intentResponse = await axios.post(
          `${server.server.baseUrl}api/process-trades/execution-intent`,
          {
            ...intentPayload,
            lifecycle: 'popup_opened',
            activationId,
          },
          intentConfig,
        );
        if (
          !intentResponse?.data?.intentId ||
          intentResponse?.data?.attemptId !== attempt.attemptId ||
          intentResponse?.data?.payloadMismatch ||
          intentResponse?.data?.allowExecution !== true ||
          intentResponse?.data?.activationId !== activationId
        ) {
          await AsyncStorage.multiRemove([
            ZERODHA_PUBLISHER_ORDER_KEY,
            ZERODHA_PUBLISHER_ATTEMPT_KEY,
          ]).catch(() => {});
          throw new Error(
            'The execution session could not be acknowledged safely. Please try again.',
          );
        }

        setZerodhaStockDetails(zerodhaTrades);
        setOpenReviewTrade(false);
        setOpenZerodhaModel(true);
      } catch (error) {
        console.error(
          '[ZerodhaPublisher] Safe handoff failed:',
          error?.message || error,
        );
        if (await handleStaleExecutionBundle(error)) return;
        Toast.show({
          type: 'error',
          text1: 'Could not safely open Zerodha',
          text2:
            error?.message ||
            'Please try again. No order was sent to Zerodha.',
          visibilityTime: 7000,
        });
      } finally {
        zerodhaSubmissionInFlightRef.current = false;
        setLoading(false);
      }
      return;
    }
    if (broker === 'Zerodha' && hasGttOrders) {
      // Zerodha customer-GTT is OFF (Kite Publisher can't place GTT — see
      // gttSupport.js). `isGttNativeBroker('Zerodha')` is false, so these
      // gttCheck orders fall through to regularOrders and place as REGULAR via
      // REST — matching web. The advisor-side synthetic price-alert rail carries
      // the GTT intent for Zerodha customers. Log only.
      console.log('[StockAdvices] Zerodha basket contains GTT-flagged orders — Zerodha customer-GTT is OFF; placing as REGULAR orders via REST (advisor price-alert rail covers the trigger intent).');
    }

    // Pre-order EDIS check — equity delivery (CNC) sells only.
    // Derivatives (NFO/BFO/MIS/NRML) do NOT need EDIS/DDPI.
    const eqDeliverySells = stockDetails.filter(s => {
      const txnType = (s.transactionType || s.TransactionType || '').toUpperCase();
      if (txnType !== 'SELL') return false;
      const exchange = (s.exchange || s.Exchange || '').toUpperCase();
      const productType = (s.productType || s.ProductType || 'CNC').toUpperCase();
      if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
      if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
      return true;
    });
    const allSellPre = eqDeliverySells.length > 0 && stockDetails.every(s => s.transactionType === 'SELL');
    const isMixedPre = eqDeliverySells.length > 0 && stockDetails.some(s => s.transactionType === 'BUY');
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

    // Split into GTT and regular orders — the customer-facing GTT gate is the
    // SHARED source of truth `isGttNativeBroker` (src/utils/gttSupport.js,
    // ported from web / GTT_ARCHITECTURE §4). This replaced the stale hardcoded
    // ['upstox','zerodha'] list (2026-07-13): Zerodha customer-GTT is OFF (Kite
    // Publisher can't place GTT), and Upstox/Angel One/Groww/Dhan/ICICI Direct
    // are native with PER-LEG segment + OCO gating (ICICI = F&O only; Angel One /
    // Dhan = single-trigger only → an OCO leg is NOT native). A non-native leg
    // falls into regularOrders exactly like web.
    const gttOrders = stockDetails.filter(
      stock =>
        stock.gttCheck === true &&
        isGttNativeBroker(broker, stock.Exchange || stock.exchange, isGttOcoLeg(stock)),
    );
    const regularOrders = stockDetails.filter(
      stock =>
        !(
          stock.gttCheck === true &&
          isGttNativeBroker(broker, stock.Exchange || stock.exchange, isGttOcoLeg(stock))
        ),
    );

    if (isBasket && stockDetails.some(stock => stock.gttCheck === true)) {
      Toast.show({
        type: 'error',
        text1: 'Basket GTT is not available',
        text2: 'No order was sent. Turn off GTT and place the basket as MARKET or LIMIT.',
        visibilityTime: 7000,
      });
      setLoading(false);
      setOpenReviewTrade(false);
      return;
    }

    if (!isBasket && gttOrders.length > 0 && regularOrders.length > 0) {
      Toast.show({
        type: 'error',
        text1: 'Place GTT and regular trades separately',
        text2: 'No order was sent. Select only one order type and try again.',
        visibilityTime: 6000,
      });
      setLoading(false);
      setOpenReviewTrade(false);
      return;
    }

    const getOrderPayload = (isGtt = false) => {
      const sourceTrades = isGtt ? gttOrders : (regularOrders.length > 0 ? regularOrders : stockDetails);

      // Trade variant — `"AMO" | "REGULAR"`. Computed once per submit and
      // tagged on every per-trade object. See docs/APP_ARCHITECTURE.md
      // § 4.5.2 Trade variant field. Display-only — no behavioural change
      // to the place-order payload (every supported broker auto-converts
      // after-hours to AMO server-side; explicit `orderVariety: "AMO"`
      // is a deferred followup with its own dual-write soak).
      const variant = computeTradeVariant(allowAfterHoursOrders);
      const trades = sourceTrades.map(stock => ({ ...stock, variant }));

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
          // GTT customer-enabled 2026-07-13 (GTT_ARCHITECTURE §4 shared truth).
          // Credential shapes mirror each broker's REGULAR payload; apiKey/secretKey
          // use the GTT path's decrypt convention (checkValidApiAnSecret), except
          // Angel One's apiKey which is the platform config key (angelOneApiKey),
          // not an encrypted user credential.
          // ⚠️ Each of these needs a place+cancel GTT cert on-device (GTT_ARCHITECTURE
          // §6) before customer-live — flag `kycBlockingEnabled`-style rollout gating
          // is server-side; verify the credential shape against the ccxt
          // /{broker}/process-trades GTT handler on first live-fire.
          case 'Groww':
            return { ...gttPayload, jwtToken };
          case 'Dhan':
            return { ...gttPayload, clientCode, jwtToken };
          case 'Angel One':
            return { ...gttPayload, apiKey: angelOneApiKey, secretKey: checkValidApiAnSecret(secretKey), jwtToken };
          case 'ICICI Direct':
            return { ...gttPayload, apiKey: checkValidApiAnSecret(apiKey), secretKey: checkValidApiAnSecret(secretKey), jwtToken };
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
    const allFNO = stockDetails.every(item => {
      const exchange = String(item.exchange || item.Exchange || '').toUpperCase();
      const productType = String(item.productType || item.ProductType || 'CNC').toUpperCase();
      return ['NFO', 'BFO', 'MCX'].includes(exchange) || ['MIS', 'NRML', 'CARRYFORWARD'].includes(productType);
    });

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
        const gttEndpoint = isBasket
          ? `${server.ccxtServer.baseUrl}${brokerUrl}/process-trades`
          : `${server.server.baseUrl}api/process-trades/gtt/process-trades`;
        const gttPayload = prepareExecutionPayload(getOrderPayload(true));
        const customerAuthHeaders = await getCustomerAuthHeaders();
        if (!customerAuthHeaders) {
          throw new Error('Please sign in again before placing this trade.');
        }
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
            ...customerAuthHeaders,
            'x-request-id': gttPayload.requestId,
          },
          data: JSON.stringify(gttPayload),
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

      // Phase C SDK orchestrator path — when REACT_APP_USE_SDK_EXECUTE_ADVICE
      // is on AND SDK integration is active, route through the SDK's
      // executeAdvice method. This calls /sdk/v1/orders/place via the SDK
      // client (minted JWT auth, typed result). Legacy direct-ccxt path
      // stays below for when the flag is off (default).
      // Per docs/SDK_ORCHESTRATION_PHASES.md Phase C.
      const basePayload = getOrderPayload(false);
      const payloadWithClientIds = {
        ...prepareExecutionPayload(basePayload),
        ...(isBasket ? {
          basketId: basePayload.basketId || effectiveBasketId,
          basketName: basePayload.basketName || basketName,
        } : {}),
      };
      let placementResults;
      let placementEnvelope;
      let placementHttpStatus;

      if (
        durableOrderExecutionEnabled(configData) &&
        isDurableDirectOrderEligible(payloadWithClientIds)
      ) {
        placementEnvelope = await submitDurableOrder(
          payloadWithClientIds,
          configData,
        );
        placementResults = placementEnvelope?.results || [];
      } else if (isBasket && sdkExecuteAdviceEnabled) {
        try {
          const sdkResp = await sdkClient.placeOrders({
            trades: payloadWithClientIds.trades,
            brokerName: broker,
            requestId: payloadWithClientIds.requestId,
            basketId: payloadWithClientIds.basketId || effectiveBasketId,
            basketName: payloadWithClientIds.basketName || basketName,
          });
          placementEnvelope = sdkResp;
          placementResults = sdkResp?.results || [];
          console.log('[StockAdvices] SDK placeOrders result:', placementResults.length, 'rows');
        } catch (sdkErr) {
          console.error('[StockAdvices] SDK placeOrders outcome unavailable:', sdkErr?.message);
          throw sdkErr;
        }
      }

      if (!placementResults) {
        // Legacy direct-ccxt path (Phase A, 2026-05-01)
        const directCcxtUrl = `${server.server.baseUrl}api/process-trades/order-place`;
        const customerAuthHeaders = await getCustomerAuthHeaders();
        if (!customerAuthHeaders) {
          throw new Error('Please sign in again before placing this trade.');
        }
        const placeOrderHeaders = {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
          ...customerAuthHeaders,
        };
        let response;
        response = await axios.request({
          method: 'post',
          url: directCcxtUrl,
          headers: {...placeOrderHeaders, 'x-request-id': payloadWithClientIds.requestId},
          data: JSON.stringify(payloadWithClientIds),
          timeout: 120000,
        });
        placementEnvelope = response.data;
        placementHttpStatus = response.status;
        placementResults = response.data?.results || [];
      }

      if (isReconciliationResponse(placementHttpStatus, placementEnvelope)) {
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
      console.log('the pay load we are sending ::::', payloadWithClientIds);
      // setOpenSucessModal(true);
      console.log('respoiiinsi:', placementResults);
      setOrderPlacementResponse(placementResults);

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

      if (!placementResults || placementResults.length === 0) {
        if ((allSell || isMixed) && !allFNO && broker === 'Fyers') {
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
          setLoading(false);
          return;
        }
        if ((allSell || isMixed) && !allFNO) {
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
          } else if (specialBrokers.includes(broker)) {
            setShowOtherBrokerModel(true);
            setOpenReviewTrade(false);
            setLoading(false);
            return;
          }
        }
      }

      const rejectedSellCount = placementResults.reduce(
        (count, order) => {
          return isOrderRejected(order?.orderStatus) &&
            order.transactionType === 'SELL'
            ? count + 1
            : count;
        },
        0,
      );

      const successCount = placementResults.reduce((count, order) => {
        return isOrderSuccess(order?.orderStatus) &&
          (order.transactionType === 'SELL' || tradeType.isMixed)
          ? count + 1
          : count;
      }, 0);

      console.log(`${broker} Rejected Sell Count:`, rejectedSellCount, 'Success Count:', successCount);
      const sellAuthRejected = hasExplicitSellAuthRejection({
        ...(placementEnvelope || {}),
        results: placementResults,
      });

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
        !allFNO &&
        rejectedSellCount >= 1 &&
        (broker !== 'Fyers' || sellAuthRejected)
      ) {
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

      if (error?.response?.data?.error === 'BASKET_BROKER_MISMATCH') {
        const expected = error.response?.data?.expectedBrokers?.join(', ');
        Toast.show({
          type: 'error',
          text1: expected ? `Switch to ${expected}` : 'Wrong broker selected',
          text2:
            error.response?.data?.message ||
            'This basket position belongs to another broker. No order was sent.',
          visibilityTime: 8000,
        });
        setOpenReviewTrade(false);
        return;
      }
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

  const placeOrder = async (stockDetails, verifiedSession = null) => {
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
      await executePlaceOrder(stockDetails, verifiedSession);
    } finally {
      orderSubmissionInFlightRef.current = false;
    }
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

  const handleZerodhaRedirect = async (tradesToPlace) => {
    const trades = tradesToPlace || stockDetails;
    const exchangeCheck = validateStockExchanges(trades);
    if (!exchangeCheck.valid) {
      const missingList = exchangeCheck.missing.join(', ');
      console.error('[ZerodhaPublisher] Blocked due to missing exchange:', missingList);
      Toast.show({
        type: 'error',
        text1: 'Order blocked — missing exchange',
        text2: `Missing exchange for: ${missingList}. Please contact your manager.`,
        visibilityTime: 8000,
      });
      setOpenReviewTrade(false);
      return false;
    }

    const apiKey = zerodhaApiKey;

    let freshProtectionPrices;
    try {
      freshProtectionPrices = await fetchFreshKiteProtectionPrices(
        trades,
        symbolMap,
      );
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Live price is unavailable',
        text2: error?.message || 'Please retry. No order was sent.',
        visibilityTime: 7000,
      });
      return false;
    }

    const basket = trades.map(stock => {
      // Scripmaster-resolved symbol/exchange (-EQ strip, BE→BSE, etc).
      const resolved = resolveZerodhaSymbol(stock, symbolMap);
      // LTP: live ws on resolved → live on raw → server-cached fallback.
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
        tag: getKitePublisherTag(stock),
      });

      console.log('[ZerodhaPublisher] Basket item:', JSON.stringify(basketItem));

      return basketItem;
    });
    const htmlContent = generateHtmlForm(basket, apiKey);
    setHtmlContent(htmlContent);

    // Merely opening Kite is not an order state transition. Recovery uses the
    // durable publisher-attempt breadcrumb; record-orders updates Mongo only
    // after broker confirmation.
    return true;
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

      const resolvedUserEmail =
        (await getAccountEmailAsync()) ||
        userEmail ||
        userDetails?.email;

      if (!resolvedUserEmail) {
        const identityError = new Error(
          'Order was submitted to Zerodha, but confirmation is still pending because your account identity is loading.',
        );
        identityError.code = 'PUBLISHER_IDENTITY_PENDING';
        throw identityError;
      }

      const storedAttempt = parseZerodhaPublisherAttempt(
        await AsyncStorage.getItem(ZERODHA_PUBLISHER_ATTEMPT_KEY),
      );
      const customerAuthHeaders = await getCustomerAuthHeaders();
      if (!customerAuthHeaders) {
        throw new Error('Please sign in again before confirming this trade.');
      }

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
          ...customerAuthHeaders,
        },
        data: JSON.stringify({
          stockDetails: zerodhaStockDetails,
          publisherResults: [{ status: 'success', batchIndex: 0 }],
          userEmail: resolvedUserEmail,
          broker: 'Zerodha',
          advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          attemptId: storedAttempt?.attemptId || '',
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
        // Kite Publisher has already submitted the basket at this point.
        // A failure in our recording/reconciliation call is not evidence that
        // Zerodha rejected the order; keep it non-terminal until the order
        // book/reconciliation path confirms the broker outcome.
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
          orderStatus: 'pending',
          orderPlacement: 'pending',
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
              'X-Advisor-Subdomain': getTenantSubdomain(),
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
      setCardInputOverrides(prev => ({
        ...prev,
        [tradeId]: {...prev[tradeId], Quantity: ''},
      }));
    } else {
      const newData = stockRecoNotExecuted.map(stock =>
        stock.Symbol === symbol && stock.tradeId === tradeId
          ? { ...stock, Quantity: parseInt(value) }
          : stock,
      );
      setStockRecoNotExecuted(newData);
      setrecommendationStock(newData);
      setCardInputOverrides(prev => ({
        ...prev,
        [tradeId]: {...prev[tradeId], Quantity: parseInt(value)},
      }));
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
    // Stamp the override so the 45s poll / list re-derivation re-applies it.
    setCardInputOverrides(prev => ({
      ...prev,
      [tradeId]: {...prev[tradeId], Price: formattedValue},
    }));

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
    const updated = newData.find(s => s.tradeId === tradeId);
    if (updated) {
      setCardInputOverrides(prev => ({
        ...prev,
        [tradeId]: {...prev[tradeId], Quantity: updated.Quantity},
      }));
    }
  };

  const handleDecreaseStockQty = (symbol, tradeId) => {
    const newData = stockRecoNotExecuted.map(stock =>
      stock.Symbol === symbol && stock.tradeId === tradeId
        ? { ...stock, Quantity: Math.max(stock.Quantity - 1, 0) }
        : stock,
    );
    setStockRecoNotExecuted(newData);
    setrecommendationStock(newData);
    const updated = newData.find(s => s.tradeId === tradeId);
    if (updated) {
      setCardInputOverrides(prev => ({
        ...prev,
        [tradeId]: {...prev[tradeId], Quantity: updated.Quantity},
      }));
    }
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
    }
    const isFundsEmpty = !_fundsPreflight.ok && _fundsPreflight.reason !== 'TRANSIENT';

    const currentBroker = freshUser?.user_broker ?? userDetails?.user_broker;
    const currentBrokerRejectedCount = await getRejectedCount();
    if (shouldBlockTradeOnFundsPreflight(_fundsPreflight.reason, broker)) {
      queueBrokerReconnect(() => handleTrade(), broker);
      return;
    } else if (brokerStatus === null || brokerStatus === undefined) {
      setBrokerModel(true);
      return;
    }

    const tradeHasEquityDeliverySells = mergedTradeIntent.some(item => {
      const txnType = String(item.transactionType || item.TransactionType || '').toUpperCase();
      if (txnType !== 'SELL') return false;
      const exchange = String(item.exchange || item.Exchange || '').toUpperCase();
      const productType = String(item.productType || item.ProductType || 'CNC').toUpperCase();
      if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
      if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
      return true;
    });

    if (broker === 'Zerodha') {
      if (shouldBlockTradeOnFundsPreflight(_fundsPreflight.reason, broker)) {
        queueBrokerReconnect(() => handleTrade(), broker);
        return;
      } else if (brokerStatus === null) {
        setBrokerModel(true);
        return;
      }
      if (allBuy) {
        setOpenReviewTrade(true);
      } else if ((tradeType?.allSell || tradeType?.isMixed) && tradeHasEquityDeliverySells) {
        const canSell = isZerodhaSellAuthorized(userDetails);
        if (canSell) {
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
        tradeHasEquityDeliverySells &&
        !userDetails?.ddpi_enabled &&
        !userDetails?.is_authorized_for_sell
      ) {
        setShowAngleOneTpinModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    } else if (broker === 'Dhan') {
      if (isDhanSellAuthorizationReady(dhanEdisStatus, stockDetails)) {
        setOpenReviewTrade(true);
      } else if (
        (allSell || isMixed) &&
        tradeHasEquityDeliverySells
      ) {
        setShowDhanTpinModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    } else if (broker === 'Fyers') {
      if (isFundsEmpty) {
        queueBrokerReconnect(() => handleTrade(), broker);
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

  const handleTradeBasket = async (basketTrades) => {
    // basketTrades is passed from BasketCard.proceedWithTrade — use it
    // directly because setStockDetails(basketTrades) hasn't flushed yet.
    const trades = basketTrades || stockDetails;

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

    if (brokerStatus !== 'connected') {
      if (broker) {
        queueBrokerReconnect(() => handleTradeBasket(trades), broker);
      } else {
        setBrokerModel(true);
      }
      return;
    }

    if (
      _haltOnFundsCheckFailure(
        funds,
        brokerStatus,
        broker,
        () => handleTradeBasket(trades),
      )
    ) {
      return;
    }

    const basketHasEquityDeliverySells = trades.some(item => {
      const txnType = String(item.transactionType || item.TransactionType || '').toUpperCase();
      if (txnType !== 'SELL') return false;
      const exchange = String(item.exchange || item.Exchange || '').toUpperCase();
      const productType = String(item.productType || item.ProductType || 'CNC').toUpperCase();
      if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
      if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
      return true;
    });

    if (broker === 'Zerodha') {
      if ((allSell || isMixed) && basketHasEquityDeliverySells) {
        const canSellZerodha = isZerodhaSellAuthorized(userDetails);
        if (!canSellZerodha) {
          setShowDdpiModal(true);
          return;
        }
      }
      setOpenReviewTrade(true);
    } else if (broker === 'Angel One') {
      if (allBuy) {
        setOpenReviewTrade(true);
      } else if (
        (allSell || isMixed) &&
        basketHasEquityDeliverySells &&
        !userDetails?.ddpi_enabled &&
        !userDetails?.is_authorized_for_sell
      ) {
        setShowAngleOneTpinModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    } else if (broker === 'Dhan') {
      if (isDhanSellAuthorizationReady(dhanEdisStatus, trades)) {
        setOpenReviewTrade(true);
      } else if (
        (allSell || isMixed) &&
        basketHasEquityDeliverySells
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
        fontFamily: designFont('Satoshi-Medium'), // Customize your font
      },
      text2Style: {
        color: 'black',
        fontSize: 12,
        fontFamily: designFont('Satoshi-Regular'), // Customize your font
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

  const filterCartAfterOrder = async (placedTrades = stockDetails) => {
    try {
      const cartItemsString = await AsyncStorage.getItem('cartItems');

      if (cartItemsString) {
        let cartItems = JSON.parse(cartItemsString);
        //  console.log('cart items in -----',cartItemsString);
        //  console.log('cart items in -----stock',stockDetails);
        // Filter out items in stockDetails that are also in cartItems
        const updatedCartItems = cartItems.filter(
          cartItem =>
            !placedTrades.some(
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
        {user_email: userEmail, cancel_scope: 'recipient'},
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
      // The cancel endpoint queues Celery work and returns HTTP 202.  Do not
      // present that acknowledgement as a completed cancellation.
      Toast.show({
        type: 'success',
        text1: 'Basket rejection requested',
        text2: 'Your recommendation will update shortly.',
      });
      await getAllTrades();
      // The first refresh can race a busy worker; refetch once after the
      // normal worker window so the card reflects the durable result.
      setTimeout(() => {
        getAllTrades();
      }, 3000);
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

      // Refresh DummyBroker state in the background. The save above is the
      // authoritative transition; blocking review on a second host's user
      // fetch added several seconds and made the broker picker appear stuck.
      // This matches web, which proceeds after the save and refreshes later.
      getUserDeatils().catch(error => {
        console.warn('Background no-broker user refresh failed:', error?.message);
      });

      // Close broker modal and proceed as soon as the preference is durable.
      setBrokerModel(false);

      // For basket orders, open review trade modal — DummyBroker handles placement
      if (isBasket) {
        setOpenReviewTrade(true);
        return;
      }

      // For single bespoke trades, show manual confirmation
      if (stockDetails.length === 0 && !pendingManualTrade) return;
      if (!pendingManualTrade && stockDetails.length !== 1) {
        Toast.show({
          type: 'info',
          text1: 'Record manual trades individually',
          text2: 'Open each recommendation and enter its broker order ID.',
        });
        return;
      }
      if (!pendingManualTrade) setPendingManualTrade(stockDetails[0]);
      setShowManualConfirm(true);
    } catch (err) {
      console.error('Error saving no-broker preference:', err);
      Toast.show({type: 'error', text1: 'Failed to continue. Try again.'});
      setBrokerModel(false);
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
    }
    const isFundsEmpty = !_fundsPreflight.ok && _fundsPreflight.reason !== 'NOT_CONNECTED' && _fundsPreflight.reason !== 'TRANSIENT';

    // Check order must match web: no broker → broker selection, then expired → token expire
    if (!broker) {
      // No broker connected at all → save pending trade and show broker selection (matching web)
      const tradeToSave = recommendationStock.find(
        item => item.Symbol === symbol && item.tradeId === tradeId,
      );
      if (tradeToSave) setPendingManualTrade(tradeToSave);
      setBrokerModel(true);
      return;
    } else if (
      brokerStatus !== 'connected' ||
      shouldBlockTradeOnFundsPreflight(_fundsPreflight.reason, broker)
    ) {
      // Broker set but session expired or funds empty → re-login to same broker
      queueBrokerReconnect(
        () => handleSingleSelectStock(symbol, tradeId, action),
        broker,
      );
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
      // Set stockDetails to ONLY this stock immediately — clears any
      // stale cart/basket items from previous failed attempts. Even if
      // the EDIS modal opens and user closes without auth, stockDetails
      // is already clean for the next "Trade Now" tap.
      setStockDetails([newStock]);

      const openReviewForSingle = () => {
        setTimeout(() => setOpenReviewTrade(true), 0);
      };

      // If stock is already selected
      if (isStockSelected) {
        // `action` was undefined whenever a caller (e.g. StockCardLoading's
        // "Trade Now" button) didn't pass it through — action.toUpperCase()
        // on undefined threw and crashed the app. Trade Now now forwards its
        // own action prop, but default-safe here too for any other caller.
        const safeAction = (action || '').toUpperCase();
        const isBuyOrder = safeAction === 'BUY';
        const isSellOrder = safeAction === 'SELL';
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
            if (isDhanSellAuthorizationReady(dhanEdisStatus, [newStock])) {
              openReviewForSingle();
            } else {
              setShowDhanTpinModel(true);
            }
          }
        } else if (broker === 'Zerodha') {
          const isDerivative = ['NFO', 'BFO', 'MCX'].includes((newStock.exchange || '').toUpperCase())
            || ['MIS', 'NRML', 'CARRYFORWARD'].includes((newStock.productType || 'CNC').toUpperCase());
          if (isBuyOrder) {
            openReviewForSingle();
          } else if (isSellOrder && !isDerivative) {
            const canSellSingle = isZerodhaSellAuthorized(userDetails);
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

      const safeAction = (action || '').toUpperCase();
      const isBuyOrder = safeAction === 'BUY';
      const isSellOrder = safeAction === 'SELL';
      await handleSelectStock(symbol, tradeId, 'add', 'handlesingle');
      // Broker-specific auth gating before opening the review modal.
      if (broker === 'Zerodha') {
        const isDerivativeSingle = ['NFO', 'BFO', 'MCX'].includes((newStock.exchange || '').toUpperCase())
          || ['MIS', 'NRML', 'CARRYFORWARD'].includes((newStock.productType || 'CNC').toUpperCase());
        const canSellBatch = isZerodhaSellAuthorized(userDetails);
        if (isSellOrder && !isDerivativeSingle && !canSellBatch) {
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
          if (isDhanSellAuthorizationReady(dhanEdisStatus, [newStock])) {
            openReviewForSingle();
          } else {
            setShowDhanTpinModel(true);
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
          text2Style: { fontFamily: designFont('Poppins-Medium'), fontSize: 12 },
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
            fontFamily: designFont('Poppins-Medium'),
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
            { headers: ccxtHeaders },
          );
          setZerodhaDdpiStatus(response.data);
        } catch (error) {
          //    console.log('[edis] status sync failed (handled):', error?.message);
        }
      };

      verifyZerodhaDdpi();
    }
  }, [userDetails, broker]);

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
          console.log('response edit::', response.data);
          setZerodhaDdpiStatus(response.data);
        } catch (error) {
          //   console.log('[edis] status sync failed (handled):', error?.message);
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
       const resolvedBasketId = item.basketId || item.basket_id;
       // basketName is presentation metadata, not identity. Older/flattened
       // payloads can omit it while retaining basketId; treating those legs
       // as standalone cards made "Trade Now" on one NIFTY leg unexpectedly
       // open its parent basket.
       const isBasketTrade = item.Basket === true || Boolean(resolvedBasketId);


        // ============================
        // BASKET TRADE (from flattened basket_advice)
        // ============================
        if (isBasketTrade) {
          // Initialize basket group if it doesn't exist
          if (!basketGroups[resolvedBasketId]) {
            basketGroups[resolvedBasketId] = {
              type: "basket",
              basketId: resolvedBasketId,
              basketName: item.basketName || item.basket_name || 'Basket order',
              advisor_name: item.advisor_name,
              date: item.date,
              lastUpdated: item.lastUpdated,
              description: item.description,
              basketLifecycle: item.basketLifecycle,
              basketSchemaVersion: item.basketSchemaVersion,
              recommendationIntent: item.recommendationIntent,
              entryBlockedAt: item.entryBlockedAt,
              entryBlockedReason: item.entryBlockedReason,
              entryGate: item.entryGate,
              entryNarrative: item.entryNarrative,
              exitNarrative: item.exitNarrative,
              // Cancel state propagates from the parent tradereco row via the
              // TradeContext flatten (cancel = leg-level, basketCancelled =
              // parent-level). `cancel` here is the combined flag the
              // BasketCard uses to hide the Reject button / mark the card
              // rejected immediately after a customer Reject — the row stays
              // visible only until the backend's customer_visible_until
              // cutoff, so without this the UI never reflects the rejection.
              cancel: false,
              basketCancelled: false,
              trades: []
            };
          }

          basketGroups[resolvedBasketId].cancel =
            basketGroups[resolvedBasketId].cancel || item.cancel === true || item.basketCancelled === true;
          basketGroups[resolvedBasketId].basketCancelled =
            basketGroups[resolvedBasketId].basketCancelled || item.basketCancelled === true;

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
          basketGroups[resolvedBasketId].trades.push(trade);

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

    // Re-apply user-typed card inputs (limit price / qty) on top of the fresh
    // server list. The 45s background poll lands here; without this a
    // half-typed value reverts on the next tick (web parity fix — see
    // cardInputOverrides).
    const applyCardOverrides = trades =>
      trades.map(trade => {
        const override = trade?.tradeId
          ? cardInputOverrides[trade.tradeId]
          : null;
        if (!override) return trade;
        return {
          ...trade,
          ...(override.Price !== undefined ? {Price: override.Price} : {}),
          ...(override.Quantity !== undefined ? {Quantity: override.Quantity} : {}),
        };
      });

    // Set the transformed data to the state
    setStockRecoNotExecuted(applyCardOverrides(transformedData));
    setrecommendationStock(applyCardOverrides(transformedData));
  }
}, [
  type,
  stockRecoNotExecutedfinal,
  rejectedTrades,
  ignoredTrades,
  isDatafetching,
  cardInputOverrides,
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
    setBasketData([]);
    setOpenZerodhaModel(false);
    setOpenReviewTrade(false);
  };
  const animatedHeight = useRef(new Animated.Value(10)).current;
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);

  const toggleExpand = useCallback(index => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCardIndex(prev => (prev === index ? null : index));
  }, []);
  const handleConnectAndPlaceOrder = async () => {
    if (
      _haltOnFundsCheckFailure(
        funds,
        brokerStatus,
        broker,
        session => placeOrder(stockDetails, session),
      )
    ) return;
    placeOrder(stockDetails);
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
          skipToWebView={true}
          stockDetails={zerodhaStockDetails || stockDetails}
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
          visible={openReviewTrade}
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
          // Outgoing trades — used by RecommendationSuccessModal as the
          // fallback source for `variant` lookups when the response item
          // doesn't carry the field (rebalance/MP lane via ccxt-india).
          // See utils/tradeVariant.js § resolveResultVariant.
          originalStockDetails={stockDetails}
        />
      )}

      <StandaloneManualPlacementModal
        visible={showManualConfirm && !!pendingManualTrade}
        trade={pendingManualTrade}
        broker={broker}
        configData={configData}
        onClose={() => {
          setShowManualConfirm(false);
          setPendingManualTrade(null);
        }}
        onSuccess={async () => {
          await Promise.all([getAllTrades(), getCartAllStocks()]);
        }}
      />

      {OpenTokenExpireModel && (
        <IIFLReviewTradeModal
          isVisible={OpenTokenExpireModel}
          onClose={() => {
            pendingReconnectActionRef.current = null;
            setOpenTokenExpireModel(false);
          }}
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
          onReconnectCancel={() => {
            pendingReconnectActionRef.current = null;
          }}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
          handleAcceptRebalanceWithoutBroker={handleContinueWithoutBrokerBespoke}
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
        <BrokerConnectModalDispatch
          brokerName="IIFL"
          isVisible={showIIFLModal}
          onClose={() => setShowIIFLModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showICICIUPModal && (
        <BrokerConnectModalDispatch
          brokerName="ICICI"
          isVisible={showICICIUPModal}
          onClose={() => setShowICICIUPModal(false)}
          setShowICICIUPModal={setShowICICIUPModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showupstoxModal && (
        <BrokerConnectModalDispatch
          brokerName="Upstox"
          isVisible={showupstoxModal}
          onClose={() => setShowupstoxModal(false)}
          setShowupstoxModal={setShowupstoxModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showangleoneModal && (
        <BrokerConnectModalDispatch
          brokerName="Angel One"
          isVisible={showangleoneModal}
          onClose={() => setShowangleoneModal(false)}
          setShowangleoneModal={setShowangleoneModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showzerodhamodal && (
        <BrokerConnectModalDispatch
          brokerName="Zerodha"
          isVisible={showzerodhamodal}
          onClose={() => setShowzerodhaModal(false)}
          setShowzerodhaModal={setShowzerodhaModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showhdfcModal && (
        <BrokerConnectModalDispatch
          brokerName="HDFC"
          isVisible={showhdfcModal}
          onClose={() => setShowhdfcModal(false)}
          setShowhdfcModal={setShowhdfcModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showDhanModal && (
        <BrokerConnectModalDispatch
          brokerName="Dhan"
          isVisible={showDhanModal}
          onClose={() => setShowDhanModal(false)}
          setShowDhanModal={setShowDhanModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showAliceblueModal && (
        <BrokerConnectModalDispatch
          brokerName="AliceBlue"
          isVisible={showAliceblueModal}
          onClose={() => setShowAliceblueModal(false)}
          setShowAliceblueModal={setShowAliceblueModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showFyersModal && (
        <BrokerConnectModalDispatch
          brokerName="Fyers"
          isVisible={showFyersModal}
          onClose={() => setShowFyersModal(false)}
          setShowFyersModal={setShowFyersModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showKotakModal && (
        <BrokerConnectModalDispatch
          brokerName="Kotak"
          isVisible={showKotakModal}
          onClose={() => setShowKotakModal(false)}
          setShowKotakModal={setShowKotakModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showMotilalModal && (
        <BrokerConnectModalDispatch
          brokerName="Motilal"
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
    fontFamily: designFont('Poppins-Bold'),
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
    backgroundColor: designColor('fff'),
    borderRadius: 14,
    width: '100%',
    maxWidth: 340,
    padding: 22,
  },
  manualConfirmTitle: {
    fontSize: 16,
    fontFamily: designFont('Poppins-Bold'),
    color: designColor('1e293b'),
    marginBottom: 8,
  },
  manualConfirmSubtitle: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('475569'),
    marginBottom: 4,
  },
  manualConfirmTradeInfo: {
    backgroundColor: designColor('f1f5f9'),
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
    marginTop: 6,
  },
  manualConfirmTradeText: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('334155'),
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
    borderColor: designColor('cbd5e1'),
    alignItems: 'center',
  },
  manualConfirmNoBtnText: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('475569'),
  },
  manualConfirmYesBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: designColor('2563eb'),
    alignItems: 'center',
  },
  manualConfirmYesBtnText: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('fff'),
  },
});

export default StockAdvices;
