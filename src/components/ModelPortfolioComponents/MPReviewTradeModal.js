import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {useWindowDimensions} from 'react-native';
import {XIcon, Trash2Icon, CandlestickChartIcon, AlertTriangleIcon} from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Feather';
import server from '../../utils/serverConfig';
import axios from 'axios';
import {WebView} from 'react-native-webview';
import KitePublisherModal from './KitePublisherModal';
import CryptoJS from 'react-native-crypto-js';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import {io} from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
const {height: screenHeight} = Dimensions.get('window');
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../../screens/TradeContext';
import { isOrderSuccess, isOrderRejected } from '../../utils/orderStatusUtils';
import { detectTransientOrderWindowError } from '../../utils/rebalanceHelpers';
import { validateBrokerSession } from '../../utils/brokerSessionUtils';
import { validateStockExchanges, getPublisherWebViewBaseUrl, resolveZerodhaSymbol, applyKiteMarketProtection } from '../../utils/brokerPublisher';
import useZerodhaSymbolMap from '../../hooks/useZerodhaSymbolMap';
import { convertResponse } from '../../utils/tradeUtils';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import moment from 'moment';
import useModalStore from '../../GlobalUIModals/modalStore';
const MPReviewTradeModal = ({
  visible,
  onCloseReviewTrade,
  dataArray,
  confirmOrder,
  setconfirmOrder,
  fileName,
  totalArray,
  setOpenSucessModal,
  openSuccessModal,
  setOpenSubscribeModel,
  calculatedLoading,
  latestRebalance,
  setOrderPlacementResponse,
  userEmail,
  userDetails,
  strategyDetails,
  calculatedPortfolioData,
  calculateRebalance,
  broker,
  edisStatus,
  dhanEdisStatus,
  setShowDdpiModal,
  setShowAngleOneTpinModel,
  setShowDhanTpinModel,
  setShowFyersTpinModal,
  setShowOtherBrokerModel,
  isReturningFromOtherBrokerModal,
  setIsReturningFromOtherBrokerModal,
}) => {
  const {configData} = useTrade();
  const openBrokerModal = useModalStore(state => state.openModal);
  console.log('MPBROKER:', broker);
  const {width} = useWindowDimensions();

  // Surveillance state for Angel One
  const [surveillanceData, setSurveillanceData] = useState(null);
  const [surveillanceLoading, setSurveillanceLoading] = useState(false);
  const [surveillanceChecked, setSurveillanceChecked] = useState(false);

  // Function to check surveillance for AngelOne
  const checkAngelOneSurveillance = async (stocks) => {
    if (broker !== 'Angel One') return null;
    if (surveillanceLoading || surveillanceChecked) return surveillanceData;
    if (!stocks || stocks.length === 0) return null;

    const symbols = stocks.map((stock) => ({
      symbol: stock.symbol,
      exchange: stock.exchange,
    }));

    setSurveillanceLoading(true);
    try {
      const config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}angelone/equity/surveillance`,
        data: symbols,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };

      const response = await axios.request(config);
      setSurveillanceData(response.data);
      setSurveillanceChecked(true);
      return response.data;
    } catch (error) {
      console.error('Error checking surveillance:', error);
      setSurveillanceChecked(true);
      return null;
    } finally {
      setSurveillanceLoading(false);
    }
  };

  // Check surveillance when modal opens and broker is AngelOne
  useEffect(() => {
    const stocksToCheck = totalArray.length > 0 ? totalArray : dataArray;
    if (
      visible &&
      broker === 'Angel One' &&
      stocksToCheck.length > 0 &&
      !surveillanceChecked &&
      !surveillanceLoading
    ) {
      checkAngelOneSurveillance(stocksToCheck);
    }
  }, [visible, broker, totalArray.length, dataArray.length, surveillanceChecked, surveillanceLoading]);

  // Reset surveillance check when modal closes or broker changes
  useEffect(() => {
    if (!visible || broker !== 'Angel One') {
      setSurveillanceChecked(false);
      setSurveillanceData(null);
    }
  }, [visible, broker]);

  const [ltp, setLtp] = useState([]);
  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());
  const failedSubscriptionsRef = useRef({});

  // WebSocket connection for market data
  useEffect(() => {
    socketRef.current = io(server.ccxtWs.baseUrl, {
      transports: ['websocket'],
      query: {EIO: '4'},
    });

    const handleMarketData = data => {
      setLtp(prev => {
        const index = prev.findIndex(
          item => item.tradingSymbol === data.stockSymbol,
        );

        if (index !== -1) {
          const existingItem = prev[index];

          // Update state only if the price has changed
          if (existingItem.lastPrice !== data.last_traded_price) {
            const newLtp = [...prev];
            newLtp[index] = {
              ...existingItem,
              lastPrice: data.last_traded_price,
            };
            return newLtp;
          } else {
            return prev; // No change, return previous state
          }
        } else {
          // Add new stock price if not present in the state
          return [
            ...prev,
            {
              tradingSymbol: data.stockSymbol,
              lastPrice: data.last_traded_price,
            },
          ];
        }
      });
    };

    socketRef.current.on('market_data', handleMarketData);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('market_data', handleMarketData);
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Subscribe to symbols via API
  const getCurrentPrice = useCallback(() => {
    if (!totalArray || totalArray.length === 0) return;

    const symbolsToSubscribe = totalArray.filter(
      trade =>
        !subscribedSymbolsRef.current.has(trade.symbol) &&
        (!failedSubscriptionsRef.current[trade.symbol] ||
          failedSubscriptionsRef.current[trade.symbol] < 3),
    );

    symbolsToSubscribe.forEach(trade => {
      const data = {symbol: trade.symbol, exchange: trade.exchange};

      axios
        .post(`${server.ccxtWs.httpUrl}/websocket/subscribe`, data)
        .then(() => {
          subscribedSymbolsRef.current.add(trade.symbol);
          delete failedSubscriptionsRef.current[trade.symbol];
        })
        .catch(error => {
          console.error(`Error subscribing to ${trade.symbol}:`, error);
          failedSubscriptionsRef.current[trade.symbol] =
            (failedSubscriptionsRef.current[trade.symbol] || 0) + 1;
        });
    });
  }, [totalArray]);

  // Fetch current price when dataArray changes

  // Utility to get the last traded price for a symbol
  const getLTPForSymbol = useCallback(
    symbol => {
      // console.log('Tt',ltp);
      const ltpItem = ltp.find(item => item.tradingSymbol === symbol);
      //console.log("ltp ",ltpItem);
      return ltpItem ? ltpItem.lastPrice : null;
    },
    [ltp],
  );

  const totalInvestmentValue = totalArray
    .filter(item => item.orderType === 'BUY')
    .reduce((total, item) => {
      const currentPrice = getLTPForSymbol(item.symbol);
      const investment = item.qty * currentPrice;
      return total + investment;
    }, 0);
  // const handleRemoveStock = (symbol, tradeId) => {
  //   console.log('tra',symbol,tradeId);
  //   setStockDetails(
  //     stockDetails.filter(
  //       (stock) => stock.tradingSymbol !== symbol || stock.tradeId !== tradeId
  //     )
  //   );
  //   cartCount-=1;
  //   handleSelectStock(symbol,tradeId);
  // };

  //////////////////////////////////////////////////////////////////

  const openSucess = () => {
    // console.log('inside success');
    onCloseReviewTrade();
    setOpenSucessModal(true);
  };
  const onCloseReview = () => {
    // console.log('inside success');
    setOpenSucessModal(false);
  };

  const stockDetails = convertResponse(totalArray, broker);
  // ccxt-india scripmaster map — see brokerPublisher.resolveZerodhaSymbol.
  const symbolMap = useZerodhaSymbolMap(stockDetails, visible);
  const [loading, setLoading] = useState(false);
  const clientCode = userDetails && userDetails?.clientCode;
  const apiKey = userDetails && userDetails?.apiKey;
  const jwtToken = userDetails && userDetails?.jwtToken;
  const my2pin = userDetails && userDetails?.my2Pin;
  const secretKey = userDetails && userDetails?.secretKey;
  const userId = userDetails && userDetails?._id;
  const mobileNumber = userDetails && userDetails?.phone_number;
  const panNumber = userDetails && userDetails?.panNumber;
  const serverId = userDetails && userDetails?.serverId;
  const viewToken = userDetails && userDetails?.viewToken;
  const sid = userDetails && userDetails?.sid;
  const dateString = userDetails && userDetails.token_expire;
  ///////////////////////////////////////////////
  //console.log('details--->',strategyDetails?.model_name,strategyDetails?.advisor,latestRebalance.model_Id,calculatedPortfolioData?.uniqueId,broker,userEmail,stockDetails)
  const checkValidApiAnSecret = data => {
    if (!data) return null;
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };
  const placeOrder = async () => {
    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) return;

    setLoading(true);

    // Pre-order: validate exchange information
    const hasExchangeEmpty = stockDetails.some((item) => item.exchange === ' ');
    if (hasExchangeEmpty) {
      Toast.show({
        type: 'error',
        text1: 'Exchange Error',
        text2: 'Error in exchange information, please try again',
      });
      setLoading(false);
      return;
    }

    // Pre-order: Dhan EDIS/DDPI check for sell orders
    // Use LIVE edis status from Dhan API, not the DB flag (is_authorized_for_sell persists
    // across sessions but Dhan EDIS authorization expires per-session)
    const allSellPreCheck = stockDetails.every(s => s.transactionType === 'SELL');
    const isMixedPreCheck =
      stockDetails.some(s => s.transactionType === 'BUY') &&
      stockDetails.some(s => s.transactionType === 'SELL');
    if (
      broker === 'Dhan' &&
      (allSellPreCheck || isMixedPreCheck) &&
      (!dhanEdisStatus || !dhanEdisStatus?.data || dhanEdisStatus?.data?.length === 0 || dhanEdisStatus?.data?.some((h) => h.edis === false))
    ) {
      setShowDhanTpinModel(true);
      onCloseReviewTrade();
      setLoading(false);
      return;
    }

    const getBasePayload = () => ({
      modelName: strategyDetails?.model_name,
      advisor: strategyDetails?.advisor,
      model_id: latestRebalance.model_Id,
      unique_id: calculatedPortfolioData?.uniqueId,
      user_broker: broker,
      user_email: userEmail,
      trades: stockDetails,
    });

    const getBrokerSpecificPayload = () => {
      return {
        accessToken: jwtToken,
      };
    };

    const payload = {
      ...getBasePayload(),
      ...getBrokerSpecificPayload(),
    };

    const config = {
      method: 'post',
      url: `${server.ccxtServer.baseUrl}rebalance/process-trade`,
      timeout: 120000,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },

      data: JSON.stringify(payload),
    };

    const specialBrokers = [
      'IIFL Securities',
      'ICICI Direct',
      'Upstox',
      'Kotak',
      'Hdfc Securities',
      'AliceBlue',
      'Motilal Oswal',
      'Groww',
    ];

    const statusCheckHeaders = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    };

    const enrollStatusCheckQueue = async () => {
      try {
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          {
            userEmail: userEmail,
            modelName: strategyDetails?.model_name,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: broker,
          },
          { headers: statusCheckHeaders },
        );
      } catch (queueErr) {
        console.log('[OrderPlacement] status-check-queue error (non-fatal):', queueErr?.message);
      }
    };

    try {
      const response = await axios.request(config);
      console.log('[OrderPlacement] API Response full:', JSON.stringify(response.data));
      console.log('[OrderPlacement] Results:', response.data.results);
      const checkData = response?.data?.results;

      // Handle session expired - broker needs reconnection
      if (response?.data?.sessionExpired) {
        onCloseReviewTrade();
        setLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: `Your ${broker} session has expired. Please reconnect your broker.`,
          visibilityTime: 5000,
        });
        setTimeout(() => {
          openBrokerModal(broker);
        }, 500);
        return;
      }

      // 1. Validate for empty or invalid results before processing (matching web)
      if (!checkData || !Array.isArray(checkData) || checkData.length === 0) {
        console.error('[OrderPlacement] API returned empty or invalid response:', response?.data);

        // Show TPIN modal for all brokers when sell orders get empty response
        if (allSellPreCheck || isMixedPreCheck) {
          if (broker === 'Dhan') {
            setShowDhanTpinModel(true);
          } else if (broker === 'Angel One') {
            setShowAngleOneTpinModel(true);
          } else if (broker === 'Zerodha') {
            setShowDdpiModal && setShowDdpiModal(true);
          } else if (broker === 'Fyers') {
            setShowFyersTpinModal(true);
          } else {
            setShowOtherBrokerModel(true);
          }
          onCloseReviewTrade();
          setLoading(false);
          return;
        }

        // Show toast error for empty response
        Toast.show({
          type: 'error',
          text1: 'Order Processing Issue',
          text2: response?.data?.message || 'No orders were processed. Please check your broker app and try again.',
        });
        onCloseReviewTrade();

        // Still enroll in status-check-queue for async reconciliation
        await enrollStatusCheckQueue();
        setLoading(false);
        return;
      }

      const results = checkData;
      setOrderPlacementResponse(results);

      // 2. Always call model-portfolio-db-update first (before EDIS checks)
      const updateData = {
        modelId: latestRebalance.model_Id,
        orderResults: results,
        modelName: strategyDetails?.model_name,
        userEmail: userEmail,
        user_broker: broker,
      };
      try {
        await axios.post(
          `${server.server.baseUrl}api/model-portfolio-db-update`,
          updateData,
          { headers: statusCheckHeaders },
        );
      } catch (dbErr) {
        console.log('[OrderPlacement] model-portfolio-db-update error (non-fatal):', dbErr?.message);
      }

      // 3. Check if ALL orders failed — show results modal directly (matching web)
      const allOrdersFailed = checkData.every((order) => {
        const s = (order?.orderStatus || '').toUpperCase();
        return s === 'REJECTED' || s === 'CANCELLED' || s === 'FAILURE' || s === 'FAILED';
      });

      // Transient service-window short-circuit: if every failed row is a
      // documented broker maintenance-window error (e.g. Upstox
      // UDAPI100074 between 00:00–05:30 IST), show a soft toast instead
      // of the all-failed modal. Broker session is fine — just retry
      // after the window reopens. Matches web UpdateRebalanceModal.
      const transientServiceWindowMsg = detectTransientOrderWindowError(response?.data);
      if (transientServiceWindowMsg) {
        Toast.show({
          type: 'info',
          text1: 'Broker service window',
          text2:
            transientServiceWindowMsg ||
            `${broker} order placement is temporarily unavailable. Try again during the broker's service hours.`,
          visibilityTime: 8000,
        });
        await enrollStatusCheckQueue();
        onCloseReviewTrade();
        setLoading(false);
        return;
      }

      if (allOrdersFailed) {
        // All orders rejected — show results modal with rejection details, skip EDIS checks
        await enrollStatusCheckQueue();
        setLoading(false);
        openSucess();
        return;
      }

      // 4. Post-order EDIS rejection handling — set flag instead of returning
      let edisTriggered = false;
      if (checkData.length > 0) {
        const isMixed =
          checkData.some(s => s.transactionType === 'BUY') &&
          checkData.some(s => s.transactionType === 'SELL');
        const allSell = checkData.every(s => s.transactionType === 'SELL');

        const rejectedSellCount = checkData.reduce((count, order) => {
          return isOrderRejected(order?.orderStatus) &&
            order.transactionType === 'SELL'
            ? count + 1
            : count;
        }, 0);

        const successCount = checkData.reduce((count, order) => {
          return isOrderSuccess(order?.orderStatus) &&
            (order.transactionType === 'SELL' || isMixed)
            ? count + 1
            : count;
        }, 0);

        // Special brokers
        if (
          !edisTriggered &&
          !isReturningFromOtherBrokerModal &&
          specialBrokers.includes(broker)
        ) {
          if ((allSell || isMixed) && rejectedSellCount >= 1 && successCount === 0 && setShowOtherBrokerModel) {
            setShowOtherBrokerModel(true);
            onCloseReviewTrade();
            setIsReturningFromOtherBrokerModal && setIsReturningFromOtherBrokerModal(false);
            edisTriggered = true;
          }
        } else if (
          (allSell || isMixed) &&
          rejectedSellCount >= 1
        ) {
          // Always show broker-specific TPIN modal for rejected sell orders
          setOpenSucessModal(false);
          setLoading(false);

          if (broker === 'Dhan') {
            setShowDhanTpinModel(true);
          } else if (broker === 'Angel One') {
            setShowAngleOneTpinModel(true);
          } else if (broker === 'Zerodha') {
            setShowDdpiModal && setShowDdpiModal(true);
          } else if (broker === 'Fyers') {
            setShowFyersTpinModal(true);
          } else {
            setShowOtherBrokerModel(true);
          }
          onCloseReviewTrade();
          edisTriggered = true;
        } else {
          setOpenSucessModal(true);
        }
      }

      // 5. Always call status-check-queue
      await enrollStatusCheckQueue();

      // 6. Only show success modal if no EDIS modal was triggered
      if (!edisTriggered) {
        openSucess();
      }
      setLoading(false);

      // 7. Refresh rebalance data to reflect current DB state
      if (typeof calculateRebalance === 'function') {
        calculateRebalance();
      }
    } catch (error) {
      console.log('[OrderPlacement] Error:', error?.response?.data || error.message);
      setLoading(false);

      const responseData = error?.response?.data;
      const orderErrors = responseData?.orderErrors || [];

      // Determine a user-friendly error message
      let errorMessage;
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') {
        errorMessage = `Unable to connect to ${broker} trading server. This could be due to broker session expiry or a temporary server issue. Please reconnect your broker and try again.`;
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        errorMessage = `${broker} session has expired. Please reconnect your broker and try again.`;
      } else {
        errorMessage = responseData?.error || responseData?.message || error?.message || 'Order placement failed';
      }

      // Show TPIN modal for all brokers when sell orders fail
      if (allSellPreCheck || isMixedPreCheck) {
        if (broker === 'Dhan') {
          setShowDhanTpinModel(true);
        } else if (broker === 'Angel One') {
          setShowAngleOneTpinModel(true);
        } else if (broker === 'Zerodha') {
          setShowDdpiModal && setShowDdpiModal(true);
        } else if (broker === 'Fyers') {
          setShowFyersTpinModal(true);
        } else {
          setShowOtherBrokerModel(true);
        }
        onCloseReviewTrade();
        return;
      }

      // If backend returned per-order error details, build response from those
      if (orderErrors.length > 0) {
        const errorResponse = orderErrors.map(err => ({
          symbol: err.symbol || err.tradingSymbol,
          tradingSymbol: err.tradingSymbol || err.symbol,
          transactionType: err.transactionType || 'BUY',
          quantity: err.quantity,
          orderType: err.orderType || 'MARKET',
          exchange: err.exchange || 'NSE',
          orderStatus: err.orderStatus || 'rejected',
          orderPlacement: 'failed',
          orderStatusMessage: err.reason || err.message || errorMessage,
          message_aq: err.reason || err.message || errorMessage,
        }));
        setOrderPlacementResponse(errorResponse);
        setOpenSucessModal(true);
        onCloseReviewTrade();
        return;
      }

      // Fallback: Build synthetic rejected response from stockDetails for the modal
      const syntheticResponse = stockDetails.map(stock => ({
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
      onCloseReviewTrade();
    }
    //  console.log('yahan6');
  };

  const getBasePayload = () => ({
    modelName: strategyDetails?.model_name,
    advisor: strategyDetails?.advisor,
    model_id: latestRebalance.model_Id,
    unique_id: calculatedPortfolioData?.uniqueId,
    broker: broker,
  });

  const additionalPayload = getBasePayload();

  const [isWebView, setWebView] = useState(false);
  const webViewRef = useRef(null);
  const [htmlContentfinal, setHtmlContent] = useState('');

  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState(null);
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);

  // Kite Publisher Modal state
  const [showKitePublisher, setShowKitePublisher] = useState(false);
  const [publisherBasketItems, setPublisherBasketItems] = useState([]);

  const handleWebViewNavigationStateChange = newNavState => {
    // Handle navigation state changes, e.g., success/failure redirects
    const {url} = newNavState;
    console.log('[ZerodhaPublisher] Navigation URL:', url);

    // Check for Kite redirect patterns after successful order placement
    if (url.includes('success') || url.includes('completed') || url.includes('basket/success')) {
      console.log('[ZerodhaPublisher] Success redirect detected - orders placed in Kite');
      setZerodhaStatus('success');
      setZerodhaRequestType('basket');
      setWebView(false); // Close WebView
      // checkZerodhaStatus will be called via useEffect when zerodhaStatus changes
      return false; // Prevent navigation
    }

    // Check for cancel
    if (url.includes('cancelled') || url.includes('cancel')) {
      console.log('[ZerodhaPublisher] User cancelled basket order');
      setZerodhaStatus('cancelled');
      setWebView(false);
      setLoading(false);
      return false;
    }

    return true; // Allow navigation
  };
  // Use configData first, fallback to Config env variable
  // Debug: Log all possible sources for API key
  console.log('[ZerodhaPublisher] ===== API KEY DEBUG =====');
  console.log('[ZerodhaPublisher] configData:', configData ? 'exists' : 'null');
  console.log('[ZerodhaPublisher] configData.config:', configData?.config ? 'exists' : 'null');
  console.log('[ZerodhaPublisher] configData.config.REACT_APP_ZERODHA_API_KEY:', configData?.config?.REACT_APP_ZERODHA_API_KEY || 'EMPTY');
  console.log('[ZerodhaPublisher] Config:', Config ? 'exists' : 'null');
  console.log('[ZerodhaPublisher] Config.REACT_APP_ZERODHA_API_KEY:', Config.REACT_APP_ZERODHA_API_KEY || 'EMPTY');

  // Try multiple sources for API key
  let zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY || Config.REACT_APP_ZERODHA_API_KEY;

  // If still empty, log warning
  if (!zerodhaApiKey) {
    console.log('[ZerodhaPublisher] WARNING: API Key not found!');
  } else {
    console.log('[ZerodhaPublisher] Using API key:', zerodhaApiKey.substring(0, 4) + '...');
  }

  console.log('[ZerodhaPublisher] Using API Key:', zerodhaApiKey ? `${zerodhaApiKey.substring(0, 4)}...` : 'UNDEFINED!');
  console.log('[ZerodhaPublisher] ===== END DEBUG =====');

  // Helper function to get last known price
  const getLastKnownPrice = (symbol) => {
    const price = getLTPForSymbol(symbol);
    return price !== null ? price : '-';
  };

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
    setLoading(true);
    const storageKey = 'stockDetailsZerodhaOrder';

    // Pre-check: Zerodha DDPI/EDIS authorization for sell orders
    const allBuyZerodha = stockDetails.every(s => s.transactionType === 'BUY');
    const allSellZerodha = stockDetails.every(s => s.transactionType === 'SELL');
    const isMixedZerodha =
      stockDetails.some(s => s.transactionType === 'BUY') &&
      stockDetails.some(s => s.transactionType === 'SELL');

    if ((allSellZerodha || isMixedZerodha) && !allBuyZerodha) {
      const canSell = userDetails?.is_authorized_for_sell ||
        ['physical', 'ddpi'].includes(userDetails?.ddpi_status);
      if (!canSell && setShowDdpiModal) {
        setShowDdpiModal(true);
        onCloseReviewTrade();
        setLoading(false);
        return;
      }
    }

    // Pre-flight: refuse to send orders with missing exchange. Kite Publisher
    // silently drops basket items whose symbol/exchange combo it can't resolve
    // (e.g. a BSE-only symbol sent with exchange=NSE), leaving the user with
    // a mystery "not in order book" state. Fail here with the offending symbols.
    const exchangeCheck = validateStockExchanges(stockDetails);
    if (!exchangeCheck.valid) {
      const missingList = exchangeCheck.missing.join(', ');
      const userMsg = `Cannot place order — exchange is missing for: ${missingList}. Please contact your advisor to correct the trade before retrying.`;
      console.error('[ZerodhaPublisher] Blocked due to missing exchange:', missingList);
      const syntheticResponse = stockDetails.map(stock => {
        const stockMissing = !(stock.exchange && String(stock.exchange).trim());
        const perStockMsg = stockMissing
          ? 'Exchange missing — advisor must correct this trade.'
          : 'Blocked: another trade in this batch was missing exchange.';
        return {
          symbol: stock.tradingSymbol,
          tradingSymbol: stock.tradingSymbol,
          transactionType: stock.transactionType || 'BUY',
          quantity: stock.quantity,
          orderType: stock.orderType || 'MARKET',
          exchange: stock.exchange || '',
          orderStatus: 'rejected',
          orderPlacement: 'failed',
          orderStatusMessage: perStockMsg,
          message_aq: perStockMsg,
        };
      });
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Order blocked — missing exchange',
        text2: userMsg,
        visibilityTime: 8000,
      });
      return;
    }

    // Debug: Verify API key is available
    console.log('[ZerodhaPublisher] handleZerodhaRedirect called, API Key:', zerodhaApiKey);
    if (!zerodhaApiKey) {
      console.error('[ZerodhaPublisher] FATAL: No API key available!');
      const syntheticResponse = stockDetails.map(stock => ({
        symbol: stock.tradingSymbol,
        tradingSymbol: stock.tradingSymbol,
        transactionType: stock.transactionType || 'BUY',
        quantity: stock.quantity,
        orderType: stock.orderType || 'MARKET',
        exchange: stock.exchange || 'NSE',
        orderStatus: 'rejected',
        orderPlacement: 'failed',
        orderStatusMessage: 'Zerodha API key not configured. Please reconnect your Zerodha account and try again.',
        message_aq: 'Zerodha API key not configured. Please reconnect your Zerodha account and try again.',
      }));
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
      setLoading(false);
      return;
    }

    try {
      // Clear the existing value
      await AsyncStorage.removeItem(storageKey);

      // Set the new value
      await AsyncStorage.setItem(storageKey, JSON.stringify(stockDetails));

      console.log('[ZerodhaPublisher] Stored stock details:', stockDetails);
    } catch (error) {
      console.error('[ZerodhaPublisher] Error storing stock details:', error);
    }
    const apiKey = zerodhaApiKey;
    const basket = stockDetails.map(stock => {
      // Scripmaster-resolved symbol/exchange (-EQ strip, BE→BSE, etc).
      const resolved = resolveZerodhaSymbol(stock, symbolMap);
      // LTP: live ws → live raw → server-cached from /zerodha/convert-symbol.
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
        // exchange from scripmaster; validateStockExchanges() above
        // guarantees stock.exchange was non-empty as a fallback.
        exchange: resolved.exchange,
        transaction_type: (stock.transactionType || 'BUY').toUpperCase(),
        order_type: mapKiteOrderType(stock.orderType),
        quantity: parseInt(stock.quantity, 10) || 1,
        product: mapKiteProductType(stock.productType),
        readonly: false,
        price: orderPrice,
      };

      // Set readonly for large quantities (over 100 shares)
      if (stock.quantity > 100) {
        baseOrder.readonly = true;
      }

      // MARKET → LIMIT-IOC with 1% market-protection buffer (GSM/T2T/BE stocks).
      const protectedOrder = applyKiteMarketProtection(baseOrder, ltp, stock.transactionType);
      console.log('[ZerodhaPublisher] Basket item:', JSON.stringify(protectedOrder));
      return protectedOrder;
    });

    const currentISTDateTime = new Date();

    try {
      // Step 1: Update the database with the current IST date-time (mark as placed)
      console.log('[ZerodhaPublisher] Updating trade recommendations...');
      const res = await axios.post(
        `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
        {
          stockDetails: stockDetails,
          leaving_datetime: currentISTDateTime,
          email: userEmail,
          trade_given_by: strategyDetails?.advisor || configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        }
      );

      const allStockDetails = res?.data?.data;
      const filteredStockDetails = allStockDetails.map(detail => ({
        user_email: detail.user_email,
        trade_given_by: detail.trade_given_by,
        tradingSymbol: detail.Symbol,
        transactionType: detail.Type,
        exchange: detail.Exchange,
        segment: detail.Segment,
        productType: detail.ProductType,
        orderType: detail.OrderType,
        price: detail.Price,
        quantity: detail.Quantity,
        priority: detail.Priority,
        tradeId: detail.tradeId,
        user_broker: 'Zerodha',
      }));

      // Store updated stock details for post-order processing
      await AsyncStorage.setItem(
        'stockDetailsZerodhaOrder',
        JSON.stringify(filteredStockDetails),
      );

      console.log('[ZerodhaPublisher] Using form submission flow...');
      console.log('[ZerodhaPublisher] Basket data:', JSON.stringify(basket, null, 2));
      console.log('[ZerodhaPublisher] API Key being used:', apiKey);

      // Use form submission approach (more reliable in WebView than SDK)
      const htmlContent = generateHtmlForm(basket, apiKey);
      setHtmlContent(htmlContent);
      setWebView(true);
      setLoading(false);
    } catch (error) {
      console.error('[ZerodhaPublisher] Failed to update trade recommendation:', error);
      setLoading(false);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to prepare basket order. Please try again.';
      const syntheticResponse = stockDetails.map(stock => ({
        symbol: stock.tradingSymbol,
        tradingSymbol: stock.tradingSymbol,
        transactionType: stock.transactionType || 'BUY',
        quantity: stock.quantity,
        orderType: stock.orderType || 'MARKET',
        exchange: stock.exchange || 'NSE',
        orderStatus: 'rejected',
        orderPlacement: 'failed',
        orderStatusMessage: errorMsg,
        message_aq: errorMsg,
      }));
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
    }
  };

  // Redirect URL for Kite to return after order placement
  const appURL = 'success';
  const generateHtmlForm = (basket, apiKey) => {
    const basketJson = JSON.stringify(basket);
    console.log('[ZerodhaPublisher] Form submission basket:', basketJson);
    return `<html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div id="debug-info" style="padding: 20px; font-family: monospace;">
            <p>API Key: ${apiKey?.substring(0, 4)}...</p>
            <p>Basket Items: ${basket.length}</p>
            <p>Basket: ${basketJson}</p>
          </div>
          <form id="zerodhaForm" method="POST" action="https://kite.zerodha.com/connect/basket">
            <input type="hidden" name="api_key" value="${apiKey}" />
            <input type="hidden" name="data" value='${basketJson}' />
            <input type="hidden" name="redirect_params" value="${appURL}=true" />
          </form>
          <script>
            console.log('Submitting form with api_key: ${apiKey}');
            console.log('Basket data:', '${basketJson.replace(/'/g, "\\'")}');
            try {
              document.getElementById('zerodhaForm').submit();
            } catch(e) {
              console.log('Form submit error:', e);
              document.body.innerHTML = '<p style="color:red">Error submitting form. Please try again.</p>';
            }
          </script>
        </body>
      </html>
    `;
  };

  const [zerodhaStockDetails, setZerodhaStockDetails] = useState(null);
  const [zerodhaAdditionalPayload, setZerodhaAdditionalPayload] =
    useState(null);

  const fetchData = async () => {
    try {
      // Fetch pending order data
      const pendingOrderData = await AsyncStorage.getItem(
        'stockDetailsZerodhaOrder',
      );
      if (pendingOrderData) {
        console.log('Pending Order Zerodha:', JSON.parse(pendingOrderData));
        setZerodhaStockDetails(JSON.parse(pendingOrderData));
      }

      // Fetch additional payload data
      const payloadData = await AsyncStorage.getItem('additionalPayload');
      if (payloadData) {
        setZerodhaAdditionalPayload(JSON.parse(payloadData));
      }
    } catch (error) {
      console.error('Error fetching data from AsyncStorage:', error);
    }
  };

  const checkZerodhaStatus = async () => {
    await fetchData();

    console.log('[ZerodhaPublisher] checkZerodhaStatus - Status:', zerodhaStatus, 'Type:', zerodhaRequestType);
    console.log('[ZerodhaPublisher] Stock Details:', zerodhaStockDetails);

    if (zerodhaStatus === 'success' && zerodhaRequestType === 'basket') {
      setLoading(true);

      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      let orderResponse;

      try {
        // Step 1: Record orders and fetch actual statuses from Zerodha
        console.log('[ZerodhaPublisher] Step 1: Recording publisher orders...');
        const recordResponse = await axios.post(
          `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
          {
            stockDetails: zerodhaStockDetails,
            publisherResults: [{ status: 'success', batchIndex: 0 }],
            userEmail: userEmail,
            broker: 'Zerodha',
          },
          { headers: requestHeaders }
        );

        console.log('[ZerodhaPublisher] Record orders response:', recordResponse.data);
        orderResponse = recordResponse.data.response || recordResponse.data.results || [];

        // Step 2: Update model portfolio database with order results
        console.log('[ZerodhaPublisher] Step 2: Updating model portfolio DB...');
        try {
          await axios.post(
            `${server.server.baseUrl}api/model-portfolio-db-update`,
            {
              modelId: latestRebalance?.model_Id,
              orderResults: orderResponse,
              modelName: strategyDetails?.model_name,
              userEmail: userEmail,
              user_broker: 'Zerodha',
            },
            { headers: requestHeaders }
          );
        } catch (dbErr) {
          console.warn('[ZerodhaPublisher] model-portfolio-db-update error (non-fatal):', dbErr?.message);
        }

        // Step 3: Update portfolio holdings from Zerodha
        console.log('[ZerodhaPublisher] Step 3: Updating portfolio holdings...');
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/user-portfolio`,
            { user_email: userEmail },
            { headers: requestHeaders }
          );
        } catch (holdingsErr) {
          console.warn('[ZerodhaPublisher] portfolio holdings update error (non-fatal):', holdingsErr?.message);
        }

        // Step 4: Update subscriber execution status
        if (orderResponse && orderResponse.length > 0) {
          const successStatuses = ['complete', 'executed', 'traded'];
          const pubSuccessCount = orderResponse.filter(r =>
            successStatuses.includes((r.orderStatus || '').toLowerCase())
          ).length;

          let executionStatus;
          if (pubSuccessCount === orderResponse.length) {
            executionStatus = 'executed';
          } else if (pubSuccessCount > 0) {
            executionStatus = 'partial';
          }

          try {
            await axios.put(
              `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
              {
                userEmail: userEmail,
                modelName: strategyDetails?.model_name,
                model_id: latestRebalance?.model_Id,
                executionStatus: executionStatus || 'pending',
                user_broker: 'Zerodha',
              },
              { headers: requestHeaders }
            );
          } catch (statusErr) {
            console.error('[ZerodhaPublisher] Error updating subscriber execution status:', statusErr);
          }

          // Step 5: Record order results in model_portfolio_user
          try {
            await axios.post(
              `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
              {
                modelName: strategyDetails?.model_name,
                model_id: latestRebalance?.model_Id,
                unique_id: calculatedPortfolioData?.uniqueId,
                advisor: strategyDetails?.advisor,
                order_results: orderResponse,
                user_email: userEmail,
                user_broker: 'Zerodha',
              },
              { headers: requestHeaders }
            );
            console.log('[ZerodhaPublisher] Successfully recorded order results in model_portfolio_user');
          } catch (recordErr) {
            console.error('[ZerodhaPublisher] Error recording publisher results:', recordErr);
          }
        }

      } catch (error) {
        console.error('[ZerodhaPublisher] Error recording publisher orders:', error);
        console.error('[ZerodhaPublisher] Error details:', error.response?.data);

        // On error: show as "Unknown" — orders may have been placed in Kite,
        // we just can't confirm status (matching web frontend)
        orderResponse = (zerodhaStockDetails || stockDetails || []).map(stock => ({
          tradingSymbol: stock.tradingSymbol,
          symbol: stock.tradingSymbol,
          transactionType: stock.transactionType || 'BUY',
          quantity: stock.quantity,
          orderType: stock.orderType || 'MARKET',
          exchange: stock.exchange || 'NSE',
          orderStatus: 'Unknown',
          orderStatusMessage: 'Order sent via Kite. Please check your Kite app for actual status.',
          message_aq: 'Order sent via Kite. Please check your Kite app for actual status.',
        }));

        // Mark as pending so the async poller knows to check broker order book
        try {
          await axios.put(
            `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
            {
              userEmail: userEmail,
              modelName: strategyDetails?.model_name,
              model_id: latestRebalance?.model_Id,
              executionStatus: 'pending',
              user_broker: 'Zerodha',
            },
            { headers: requestHeaders }
          );
        } catch (statusErr) {
          console.error('[ZerodhaPublisher] Error updating subscriber execution status:', statusErr);
        }
      }

      // Always enroll in status-check-queue regardless of record-orders success/failure
      try {
        console.log('[ZerodhaPublisher] Adding to status check queue...');
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          {
            userEmail: userEmail,
            modelName: strategyDetails?.model_name,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: 'Zerodha',
          },
          { headers: requestHeaders }
        );
      } catch (queueErr) {
        console.error('[ZerodhaPublisher] Error adding to status-check-queue:', queueErr);
      }

      // Always show results modal (matching web frontend pattern)
      setOrderPlacementResponse(orderResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
      setLoading(false);

      // Refresh rebalance data to reflect current DB state
      if (typeof calculateRebalance === 'function') {
        calculateRebalance();
      }

      // Clean up AsyncStorage
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('additionalPayload');

      // Reset state
      setZerodhaStatus(null);
      setZerodhaRequestType(null);
    }
  };

  useEffect(() => {
    if (
      zerodhaStatus === 'success' &&
      zerodhaRequestType === 'basket' &&
      jwtToken !== undefined
    ) {
      checkZerodhaStatus();
    }
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);

  // --- Fyers Publisher Flow ---

  const handleFyersRedirect = async () => {
    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) return;

    // Pre-flight: refuse to send orders with missing exchange. Fyers symbols
    // encode the exchange in the form "NSE:SBIN-EQ"; a blank exchange would
    // produce ":SBIN-EQ" which Fyers rejects or mis-routes silently.
    const exchangeCheck = validateStockExchanges(stockDetails);
    if (!exchangeCheck.valid) {
      const missingList = exchangeCheck.missing.join(', ');
      console.error('[FyersPublisher] Blocked due to missing exchange:', missingList);
      Toast.show({
        type: 'error',
        text1: 'Order blocked — missing exchange',
        text2: `Missing exchange for: ${missingList}. Please contact your advisor.`,
        visibilityTime: 8000,
      });
      onCloseReviewTrade();
      return;
    }

    setLoading(true);
    try {
      const currentISTDateTime = new Date();
      const istDatetime = moment(currentISTDateTime).format();

      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      // Record trade intent
      try {
        await axios.post(
          `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
          {
            stockDetails: stockDetails,
            leaving_datetime: currentISTDateTime,
            email: userEmail,
            trade_given_by: strategyDetails?.advisor || configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          },
          { headers: requestHeaders },
        );
      } catch (recoErr) {
        console.warn('[FyersPublisher] update-reco failed (non-critical):', recoErr);
      }

      // Place orders via Fyers API through process-trade
      const payload = {
        clientId: clientCode,
        accessToken: jwtToken,
        user_email: userEmail,
        user_broker: 'Fyers',
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        model_id: latestRebalance?.model_Id,
        unique_id: calculatedPortfolioData?.uniqueId,
        returnDateTime: istDatetime,
        trades: stockDetails,
      };

      const response = await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/process-trade`,
        payload,
        { headers: requestHeaders, timeout: 120000 },
      );

      const checkData = response?.data?.results;

      // Handle session expired - broker needs reconnection
      if (response?.data?.sessionExpired) {
        onCloseReviewTrade();
        setLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: `Your Fyers session has expired. Please reconnect your broker.`,
          visibilityTime: 5000,
        });
        setTimeout(() => {
          openBrokerModal('Fyers');
        }, 500);
        return;
      }

      // 1. Validate for empty or invalid results
      if (!checkData || !Array.isArray(checkData) || checkData.length === 0) {
        console.error('[FyersPublisher] API returned empty or invalid response:', response?.data);
        Toast.show({
          type: 'error',
          text1: 'Order Processing Issue',
          text2: response?.data?.message || 'No orders were processed. Please check your Fyers app and try again.',
        });
        onCloseReviewTrade();

        // Still enroll in status-check-queue for async reconciliation
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
            {
              userEmail: userEmail,
              modelName: strategyDetails?.model_name,
              advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
              broker: 'Fyers',
            },
            { headers: requestHeaders },
          );
        } catch (queueErr) {
          console.warn('[FyersPublisher] status-check-queue failed:', queueErr);
        }
        setLoading(false);
        return;
      }

      setOrderPlacementResponse(checkData);

      // 2. Always update model portfolio DB first (before EDIS checks)
      try {
        await axios.post(
          `${server.server.baseUrl}api/model-portfolio-db-update`,
          {
            modelId: latestRebalance?.model_Id,
            orderResults: checkData,
            modelName: strategyDetails?.model_name,
            userEmail: userEmail,
            user_broker: 'Fyers',
          },
          { headers: requestHeaders },
        );
      } catch (dbErr) {
        console.warn('[FyersPublisher] model-portfolio-db-update error (non-fatal):', dbErr?.message);
      }

      // 3. Check if ALL orders failed — show results modal directly, skip EDIS
      const allOrdersFailed = checkData.every((order) => {
        const s = (order?.orderStatus || '').toUpperCase();
        return s === 'REJECTED' || s === 'CANCELLED' || s === 'FAILURE' || s === 'FAILED';
      });

      // 4. Update subscriber execution status
      if (checkData.length > 0) {
        const successStatuses = ['complete', 'executed', 'traded'];
        const pubSuccessCount = checkData.filter(r =>
          successStatuses.includes((r.orderStatus || '').toLowerCase()),
        ).length;
        let executionStatus;
        if (pubSuccessCount === checkData.length) {
          executionStatus = 'executed';
        } else if (pubSuccessCount > 0) {
          executionStatus = 'partial';
        } else {
          executionStatus = 'pending';
        }

        try {
          await axios.put(
            `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
            {
              userEmail: userEmail,
              modelName: strategyDetails?.model_name,
              model_id: latestRebalance?.model_Id,
              executionStatus: executionStatus,
              user_broker: 'Fyers',
            },
            { headers: requestHeaders },
          );
        } catch (err) {
          console.warn('[FyersPublisher] subscriber-execution update failed:', err);
        }

        // Record publisher results
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
            {
              modelName: strategyDetails?.model_name,
              model_id: latestRebalance?.model_Id,
              unique_id: calculatedPortfolioData?.uniqueId,
              advisor: strategyDetails?.advisor,
              order_results: checkData,
              user_email: userEmail,
              user_broker: 'Fyers',
            },
            { headers: requestHeaders },
          );
          console.log('[FyersPublisher] Successfully recorded publisher results');
        } catch (err) {
          console.warn('[FyersPublisher] record-publisher-results failed:', err);
        }
      }

      // 5. EDIS/TPIN check — only if NOT allOrdersFailed (set flag instead of returning)
      let edisTriggered = false;
      if (!allOrdersFailed && checkData.length > 0) {
        const allSell = checkData.every(s => s.transactionType === 'SELL');
        const isMixed =
          checkData.some(s => s.transactionType === 'BUY') &&
          checkData.some(s => s.transactionType === 'SELL');
        const rejectedSellCount = checkData.reduce((count, order) => {
          return isOrderRejected(order?.orderStatus) &&
            order.transactionType === 'SELL'
            ? count + 1
            : count;
        }, 0);
        const successCount = checkData.reduce((count, order) => {
          return isOrderSuccess(order?.orderStatus) &&
            (order.transactionType === 'SELL' || isMixed)
            ? count + 1
            : count;
        }, 0);

        if (
          (allSell || isMixed) &&
          rejectedSellCount >= 1 &&
          successCount === 0 &&
          setShowFyersTpinModal
        ) {
          setShowFyersTpinModal(true);
          onCloseReviewTrade();
          edisTriggered = true;
        }
      }

      // 6. Always enroll in status-check-queue
      try {
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          {
            userEmail: userEmail,
            modelName: strategyDetails?.model_name,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: 'Fyers',
          },
          { headers: requestHeaders },
        );
      } catch (queueErr) {
        console.warn('[FyersPublisher] status-check-queue failed:', queueErr);
      }

      // 7. Only show success modal if no EDIS modal was triggered
      if (!edisTriggered) {
        openSucess();
      }
      setLoading(false);

      // 8. Refresh rebalance data to reflect current DB state
      if (typeof calculateRebalance === 'function') {
        calculateRebalance();
      }
    } catch (error) {
      setLoading(false);
      console.error('[FyersPublisher] Error:', error);

      const responseData = error?.response?.data;
      const orderErrors = responseData?.orderErrors || [];

      let errorMessage;
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') {
        errorMessage =
          'Unable to connect to Fyers trading server. Please reconnect your broker and try again.';
      } else if (
        error?.response?.status === 401 ||
        error?.response?.status === 403
      ) {
        errorMessage =
          'Fyers session has expired. Please reconnect your broker and try again.';
      } else {
        errorMessage =
          responseData?.error || responseData?.message ||
          error?.message || 'Order placement failed';
      }

      // If backend returned per-order error details, build response from those
      if (orderErrors.length > 0) {
        const errorResponse = orderErrors.map(err => ({
          symbol: err.symbol || err.tradingSymbol,
          tradingSymbol: err.tradingSymbol || err.symbol,
          transactionType: err.transactionType || 'BUY',
          quantity: err.quantity,
          orderType: err.orderType || 'MARKET',
          exchange: err.exchange || 'NSE',
          orderStatus: err.orderStatus || 'rejected',
          orderPlacement: 'failed',
          orderStatusMessage: err.reason || err.message || errorMessage,
          message_aq: err.reason || err.message || errorMessage,
        }));
        setOrderPlacementResponse(errorResponse);
        setOpenSucessModal(true);
        onCloseReviewTrade();
        return;
      }

      // Fallback: Build synthetic rejected response from stockDetails for the modal
      const syntheticResponse = stockDetails.map(stock => ({
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
      onCloseReviewTrade();
    }
  };

  // --- End Fyers Publisher Flow ---

  const [isLoading, setIsLoading] = useState(false);
  const hasZeroQuantity = stockDetails.some(stock => stock.quantity === 0);
  const [InputFixSizeValue, setInputFixSizeValue] = useState(0);

  const sheet = useRef(null);
  const scrollViewRef = useRef(null);
  /////////////////////////////////////////////////////////////////

  const renderItem = ({item}) => {
    //console.log('main Item,',item);
    if (!item) {
      return null; // or a fallback UI element if desired
    }
    return (
      <View style={styles.rowContainer}>
        <View style={styles.leftContainer}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.buyOrder}>BUY</Text>
        </View>
        <View style={styles.quantityContainer}>
          <Text
            style={{
              color: 'black',
              fontFamily: 'Poppins-Regular',
              alignContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
            }}>
            {getLTPForSymbol(item.symbol)
              ? `₹${getLTPForSymbol(item.symbol)}`
              : '₹--'}
          </Text>
        </View>
        <View style={styles.rightContainer}>
          {!confirmOrder ? (
            <Text style={styles.cellTextmktprice}>
              {parseFloat(item.value * 100).toFixed(2)}%
            </Text>
          ) : (
            <Text style={styles.cellTextmktprice}>Qty-{item.qty}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onCloseReviewTrade}
      animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, {width: width * 1}]}>
          {isWebView ? (
            <View
              style={{
                flex: 0,
                height: 600,
                borderTopRightRadius: 10,
                borderTopLeftRadius: 10,
                backgroundColor: 'white',
                padding: 10,
              }}>
              <View style={{alignContent: 'flex-end', alignItems: 'flex-end'}}>
                <TouchableOpacity onPress={() => {
                  setWebView(false);
                  setLoading(false);
                  setZerodhaStatus(null);
                  setZerodhaRequestType(null);
                }}>
                  <XIcon size={16} color={'black'} />
                </TouchableOpacity>
              </View>
              <WebView
                ref={webViewRef}
                style={{
                  flex: 1,
                  borderTopRightRadius: 10,
                  borderTopLeftRadius: 10,
                }}
                source={{
                  html: htmlContentfinal,
                  baseUrl: getPublisherWebViewBaseUrl(configData),
                }}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                onNavigationStateChange={handleWebViewNavigationStateChange}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onError={e => console.error('WebView error:', e.nativeEvent)}
              />
            </View>
          ) : (
            <>
              {/* Loading Overlay */}
              {(calculatedLoading || loading || isLoading) && (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  zIndex: 999,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                }}>
                  <ActivityIndicator size="large" color="#000" />
                  <Text style={{
                    marginTop: 15,
                    fontSize: 16,
                    fontFamily: 'Satoshi-Medium',
                    color: '#333',
                  }}>
                    {loading ? 'Placing Order...' : 'Calculating Rebalance...'}
                  </Text>
                  <Text style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontFamily: 'Satoshi-Regular',
                    color: '#666',
                  }}>
                    Please wait while we process your request
                  </Text>
                </View>
              )}
              <View style={styles.horizontal} />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                <Text style={styles.modalHeader1}>
                  Review Trade Details {fileName}
                </Text>
                <TouchableOpacity
                  style={{marginRight: 20}}
                  onPress={onCloseReviewTrade}>
                  <XIcon size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <View style={{backgroundColor: '#f8f8f8'}}></View>
              <View
                style={{
                  borderWidth: 0.5,
                  borderColor: 'grey',
                  marginTop: 5,
                }}></View>

              {/* Surveillance Warning for Angel One */}
              {broker === 'Angel One' &&
                surveillanceData?.surveillance &&
                (() => {
                  const surveillanceStocks = surveillanceData.surveillance.filter(
                    (stock) =>
                      stock.found === true &&
                      stock.surveillance &&
                      stock.surveillance !== '' &&
                      stock.surveillance !== 'N',
                  );

                  if (surveillanceStocks.length > 0) {
                    return (
                      <View style={styles.surveillanceWarning}>
                        <View style={styles.surveillanceHeader}>
                          <AlertTriangleIcon size={18} color="#DC2626" />
                          <Text style={styles.surveillanceTitle}>
                            Surveillance Alert
                          </Text>
                        </View>
                        <Text style={styles.surveillanceText}>
                          The following stocks are under Angel One surveillance measures
                          and may be rejected via API:
                        </Text>
                        {surveillanceStocks.map((stock, index) => (
                          <Text key={index} style={styles.surveillanceStock}>
                            • <Text style={{fontFamily: 'Poppins-Bold'}}>{stock.symbol}</Text>{' '}
                            (Surveillance: {stock.surveillance})
                          </Text>
                        ))}
                        <Text style={styles.surveillanceNote}>
                          Please trade these stocks manually through the Angel One mobile
                          app or web platform.
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

              <FlatList
                data={totalArray.length > 0 ? totalArray : dataArray}
                renderItem={renderItem}
                keyExtractor={item => item.symbol}
                ListEmptyComponent={
                  <View
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 20,
                    }}>
                    <View
                      style={{
                        borderRadius: 50,
                        backgroundColor: '#EBECEF',
                        padding: 20,
                      }}>
                      <CandlestickChartIcon size={40} color={'black'} />
                    </View>
                    <Text
                      style={{
                        fontFamily: 'Poppins-SemiBold',
                        color: 'black',
                        fontSize: 18,
                        marginVertical: 10,
                      }}>
                      No Orders to Place
                    </Text>
                    <Text style={{fontFamily: 'Poppins-Medium', color: 'grey'}}>
                      Add item to cart to place order.
                    </Text>
                  </View>
                }
                contentContainerStyle={{
                  paddingHorizontal: 10,
                  marginBottom: 10,
                }}
              />

              {confirmOrder ? (
                <TouchableOpacity
                  disabled={calculatedLoading || loading}
                  onPress={() => {
                    // Pre-order EDIS checks
                    const hasSellOrders = stockDetails?.some(s => s.transactionType === 'SELL');
                    if (hasSellOrders) {
                      // Zerodha DDPI check (before Kite redirect or server-side)
                      // If user has completed TPIN authorization (is_authorized_for_sell), allow sell
                      // If DDPI is active (physical/ddpi status), allow sell
                      if (broker === 'Zerodha' &&
                        !userDetails?.is_authorized_for_sell &&
                        !['physical', 'ddpi'].includes(userDetails?.ddpi_status) &&
                        setShowDdpiModal) {
                        setShowDdpiModal(true);
                        onCloseReviewTrade();
                        return;
                      }
                      // Angel One DDPI check
                      if (broker === 'Angel One' && !userDetails?.ddpi_enabled && !userDetails?.is_authorized_for_sell && setShowAngleOneTpinModel) {
                        setShowAngleOneTpinModel(true);
                        onCloseReviewTrade();
                        return;
                      }
                      // Dhan EDIS check
                      if (broker === 'Dhan' && (!dhanEdisStatus || !dhanEdisStatus?.data || dhanEdisStatus?.data?.length === 0 || dhanEdisStatus?.data?.some((h) => h.edis === false)) && setShowDhanTpinModel) {
                        setShowDhanTpinModel(true);
                        onCloseReviewTrade();
                        return;
                      }
                    }

                    // Use Publisher flow for Zerodha and Fyers
                    // Use server-side API for other brokers
                    if (broker === 'Zerodha') {
                      console.log('[PlaceOrder] Using Kite Publisher for Zerodha');
                      handleZerodhaRedirect();
                    } else if (broker === 'Fyers') {
                      console.log('[PlaceOrder] Using Publisher flow for Fyers');
                      handleFyersRedirect();
                    } else {
                      console.log('[PlaceOrder] Using server-side API for', broker);
                      placeOrder();
                    }
                  }}
                  style={styles.orderButton}>
                  {0 > 1 ? (
                    <View>
                      <Text>
                        Note : Orders may be rejected due to insufficient broker
                        balance of {parseFloat(funds?.availablecash).toFixed(2)}
                        .
                      </Text>
                    </View>
                  ) : null}

                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="white" />
                    </View>
                  ) : (
                    <Text style={styles.orderButtonText}>
                      {broker === 'Zerodha' ? 'Open Kite Basket' : broker === 'Fyers' ? 'Place Order via Fyers' : 'Place Order'} (₹{' '}
                      {parseFloat(totalInvestmentValue).toFixed(2)})
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  disabled={calculatedLoading}
                  onPress={() => {
                    calculateRebalance();
                  }}
                  style={styles.orderButton}>
                  {0 > 1 ? (
                    <View>
                      <Text>
                        Note : Orders may be rejected due to insufficient broker
                        balance of {parseFloat(funds?.availablecash).toFixed(2)}
                        .
                      </Text>
                    </View>
                  ) : null}

                  {calculatedLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="white" />
                    </View>
                  ) : (
                    <Text style={styles.orderButtonText}>Confirm Details</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {/* Kite Publisher Modal (Publisher SDK flow) */}
      <KitePublisherModal
        visible={showKitePublisher}
        apiKey={zerodhaApiKey}
        basketItems={publisherBasketItems}
        onClose={() => {
          setShowKitePublisher(false);
          setLoading(false);
        }}
        onSuccess={(requestToken) => {
          console.log('[ZerodhaPublisher] Publisher success, requestToken:', requestToken);
          setShowKitePublisher(false);
          setZerodhaStatus('success');
          setZerodhaRequestType('basket');
          // checkZerodhaStatus will be called via useEffect
        }}
        onError={(error) => {
          console.error('[ZerodhaPublisher] Publisher error:', error);
          setShowKitePublisher(false);
          setLoading(false);
          const errorMsg = typeof error === 'string' ? error : (error?.message || 'Order placement failed via Zerodha. Please check your Kite app.');
          const syntheticResponse = stockDetails.map(stock => ({
            symbol: stock.tradingSymbol,
            tradingSymbol: stock.tradingSymbol,
            transactionType: stock.transactionType || 'BUY',
            quantity: stock.quantity,
            orderType: stock.orderType || 'MARKET',
            exchange: stock.exchange || 'NSE',
            orderStatus: 'rejected',
            orderPlacement: 'failed',
            orderStatusMessage: errorMsg,
            message_aq: errorMsg,
          }));
          setOrderPlacementResponse(syntheticResponse);
          setOpenSucessModal(true);
          onCloseReviewTrade();
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginLeft: 40,
    // borderWidth:1,
    // flex: 1, // Center alignment
  },
  buyOrder: {
    color: 'green',
    alignSelf: 'flex-start',
  },
  quantityContainer1: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 5,
    marginHorizontal: 25,
  },

  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  buyOrder: {
    color: 'green',
    alignSelf: 'flex-start',
  },
  sellOrder: {
    color: 'red',
  },
  cell: {
    borderWidth: 1,
    borderColor: 'grey',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  symbol: {
    alignSelf: 'flex-start',
    color: 'black',
    flexDirection: 'column',
    fontFamily: 'Poppins-SemiBold',
  },
  cellText: {
    alignSelf: 'flex-start',
    color: 'black',
    fontFamily: 'Poppins-Regular',
  },
  cellTextmktprice: {
    alignSelf: 'flex-end',
    color: 'black',
    fontFamily: 'Poppins-Regular',
  },
  quantityInput: {
    width: 50,
    height: 30,
    padding: 2,
    marginHorizontal: 4,
    color: '#0d0c22',
    fontSize: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9e8e8',
    borderRadius: 7,
  },
  quantityInputup: {
    width: 80,
    height: 35,
    padding: 2,
    alignSelf: 'center',
    marginHorizontal: 4,
    color: '#0d0c22',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9e8e8',
    borderRadius: 7,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    height: screenHeight / 1.8,
    elevation: 5,
  },
  horizontal: {
    width: 110,
    height: 6,
    marginBottom: 20,
    borderRadius: 250,
    alignSelf: 'center',
    backgroundColor: '#f1f4f8',
  },
  modalHeader: {
    fontSize: 18,
    marginTop: 3,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    color: 'black',
  },
  modalHeader1: {
    fontSize: 17,
    fontFamily: 'Poppins-Bold',
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    color: 'black',
    marginBottom: 10,
  },
  orderButton: {
    backgroundColor: '#002a5c',
    paddingVertical: 15,
    marginHorizontal: 0,
    borderRadius: 10,
    alignItems: 'center',
  },
  orderButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
  },
  leftContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    marginRight: 5,
    alignItems: 'flex-start',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E8E8E8',
  },
  // Surveillance Warning Styles
  surveillanceWarning: {
    marginHorizontal: 10,
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    borderRadius: 4,
  },
  surveillanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  surveillanceTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    color: '#DC2626',
    marginLeft: 8,
  },
  surveillanceText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#991B1B',
    marginBottom: 6,
  },
  surveillanceStock: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#B91C1C',
    marginLeft: 8,
    marginBottom: 2,
  },
  surveillanceNote: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#DC2626',
    marginTop: 6,
    fontStyle: 'italic',
  },
});

export default MPReviewTradeModal;
