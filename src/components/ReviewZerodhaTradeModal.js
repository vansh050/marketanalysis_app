import React, { useState,useRef,useCallback,useEffect,useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions,ActivityIndicator, TextInput,SafeAreaView, ScrollView, Pressable, FlatList } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { XIcon, Trash2Icon,CandlestickChartIcon, ChevronRight,ShoppingBag,Minus,Plus } from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Feather';
import server from '../utils/serverConfig'
import Config from 'react-native-config';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import axios from 'axios';

import { io } from "socket.io-client";
import { useTotalAmount } from './AdviceScreenComponents/DynamicText/websocketPrice';
import eventEmitter from './EventEmitter';
import IsMarketHours from '../utils/isMarketHours';
import { RadioButton } from 'react-native-paper';

import { WebView } from 'react-native-webview';
import SliderButton from './SliderButton';
import Icon from 'react-native-vector-icons/FontAwesome';
import { designColor, designFont } from '../design/literalTokens';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
import { getLastKnownPrice } from './AdviceScreenComponents/DynamicText/websocketPrice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReviewTradeText from './AdviceScreenComponents/ReviewTradeText';
import { generateToken } from '../utils/SecurityTokenManager';
import { useTrade } from '../screens/TradeContext';
import { useConfig } from '../context/ConfigContext';
import Toast from 'react-native-toast-message';
import { validateStockExchanges, fetchFreshKiteProtectionPrices, getPublisherWebViewBaseUrl, resolveZerodhaSymbol, convertToBasketItem } from '../utils/brokerPublisher';
import { computeTradeVariant } from '../utils/tradeVariant';
import useZerodhaSymbolMap from '../hooks/useZerodhaSymbolMap';
import useKitePublisherPolling from '../hooks/useKitePublisherPolling';
import useKiteHandoffGuard from '../hooks/useKiteHandoffGuard';
import { getAccountEmailAsync } from '../utils/accountEmail';
import { getCustomerAuthHeaders } from '../utils/customerAuthHeaders';
import {
  applyClosureClamps,
  fetchClosureClamps,
  isClosureLeg,
  REMOVED_EXIT_MESSAGE,
  CLAMPED_EXIT_MESSAGE,
  CLAMP_UNAVAILABLE_MESSAGE,
} from '../utils/closureClamp';
import { logZerodhaDiagnostic } from '../utils/Logging';
import {executionBundleHeaders, handleStaleExecutionBundle} from '../utils/executionBundleSafety';
import {
  authorizeBasketEntry,
  basketEntryGateMessage,
} from '../services/BasketEntryGateService';
import {
  ZERODHA_PUBLISHER_ATTEMPT_KEY,
  ZERODHA_PUBLISHER_ORDER_KEY,
  buildUnconfirmedPublisherResults,
  classifyPublisherRecordResults,
  createZerodhaPublisherAttempt,
  getKitePublisherTag,
  isZerodhaPublisherRetryGuarded,
  parseKiteRedirectStatus,
  parseZerodhaPublisherAttempt,
  resolvePublisherSettlement,
  sanitizePublisherRecordResults,
  selectPublisherStockDetails,
} from '../utils/publisherOutcome';
import {getKiteBasketQuantity} from '../utils/basketUtils';
import PublisherWebViewOverlay from './PublisherWebViewOverlay';
import SellModelImpactNotice from './AdviceScreenComponents/SellModelImpactNotice';
import useSellModelImpact, {reserveSellHoldsForPublisher} from '../hooks/useSellModelImpact';
import {canonicalSymbol} from '../utils/sellModelImpact';

const ReviewZerodhaTradeModal = ({
  visible,
  onClose,
  stockDetails,
  setStockDetails,
  fullbasketData,
  setBasketData,
  basketData,
  placeOrder,
  funds,
  htmlContent,
  getAllTrades,
  zerodhaApiKey,
  mbasket,
  isVisible,
  updatePortfolioData,
  filterCartAfterOrder,
  getCartAllStocks,
  setOpenZerodhaModel,
  openZerodhaReviewModal,
  loading,
  appURL,
  setCartContainer,
  userDetails,
  userEmail,
  setOpenSucessModal,
  setOrderPlacementResponse,
  clearCart,
  webViewVisible,
  setWebViewVisible,
  cartCount,
  setCartCount,
  handleSelectStock,
  broker,
  skipToWebView = false,
}) => {
  const {configData}=useTrade();
  // SELL legs that would use model-owned shares get a warn-mode notice; the
  // hold is written just before Kite opens and released by record-orders.
  const sellImpact = useSellModelImpact({
    visible: !!(visible || isVisible),
    stockDetails,
    setStockDetails,
    broker: 'Zerodha',
    configData,
  });
  const sellReservationRef = useRef(null);
  const config = useConfig();
  const { logo: LogoComponent, themeColor, mainColor, secondaryColor, toolbarlogo: Toolbarlogo1, allowAfterHoursOrders } = config || {};
  const marketGateOpen = IsMarketHours() || allowAfterHoursOrders;
  const hasStockOrders = Array.isArray(stockDetails) && stockDetails.length > 0;
  const hasBasketOrders = Array.isArray(basketData) && basketData.length > 0;
  // Scripmaster-corrected Kite symbol/exchange map (handles -EQ suffix,
  // BE→BSE diversion, BSE-primary symbols mislabeled as NSE). Published
  // baskets read `resolveZerodhaSymbol(stock, symbolMap)` for the outgoing
  // `tradingsymbol`/`exchange`; `cachedLtp` covers canonical market protection
  // when the websocket hasn't emitted a price (common for BE-series).
  const symbolMap = useZerodhaSymbolMap(stockDetails, isVisible);
  //console.log('trade id i am getting---',stockDetails);
  useEffect(()=>{
    if(basketData?.length>0){
      setStockDetails(basketData);
    }
  },[basketData])
  const [flag,setflag]=useState(false);
  //console.log('Stock Zerodha Detais:',stockDetails);
  //const pendingOrderData =AsyncStorage.getItem("stockDetailsZerodhaOrder");
 // console.log('Here yours pending Data:',JSON.parse(pendingOrderData));
  const { width } = useWindowDimensions();
  const handleIncreaseStockQty = (symbol, tradeId) => {
    const newData = stockDetails.map((stock) =>
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? { ...stock, quantity: stock.quantity + 1 }
        : stock
    );
    console.log('Updated Stock Details:', newData); // Debug log
    setStockDetails(newData);
  };
  const handleDecreaseStockQty = (symbol, tradeId) => {
    const newData = stockDetails.map((stock) =>
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? { ...stock, quantity: Math.max(stock.quantity - 1, 0) }
        : stock
    );
    console.log('Updated Stock Details:', newData); // Debug log
    setStockDetails(newData);
  };
  const handleQuantityInputChange = (symbol, value, tradeId) => {
    const newQuantity = parseInt(value) || 0;
    const newData = stockDetails.map((stock) =>
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? { ...stock, quantity: newQuantity }
        : stock
    );
    setStockDetails(newData);
  };


  const jwtToken = userDetails && userDetails.jwtToken;

  const [ltp, setLtp] = useState([]);
  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());
  const failedSubscriptionsRef = useRef({});
  let dataArray = [];
  // WebSocket connection for market data
  useEffect(() => {
    socketRef.current = io(server.ccxtWs.baseUrl, {
      transports: ["websocket"],
      query: { EIO: "4" },
    });

    const handleMarketData = (data) => {
      setLtp((prev) => {
        const index = prev.findIndex(
          (item) => item.tradingSymbol === data.stockSymbol
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

    socketRef.current.on("market_data", handleMarketData);

    return () => {
      if (socketRef.current) {
        socketRef.current.off("market_data", handleMarketData);
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Subscribe to symbols via API
  const getCurrentPrice = useCallback(() => {
    if (!dataArray || dataArray.length === 0) return;

    const symbolsToSubscribe = dataArray.filter(
      (trade) =>
        !subscribedSymbolsRef.current.has(trade.symbol) &&
        (!failedSubscriptionsRef.current[trade.symbol] ||
          failedSubscriptionsRef.current[trade.symbol] < 3)
    );

    symbolsToSubscribe.forEach((trade) => {
      const data = { symbol: trade.symbol, exchange: trade.exchange };

      axios
        .post(`${server.ccxtWs.httpUrl}/websocket/subscribe`, data)
        .then(() => {
          subscribedSymbolsRef.current.add(trade.symbol);
          delete failedSubscriptionsRef.current[trade.symbol];
        })
        .catch((error) => {
          console.error(`Error subscribing to ${trade.symbol}:`, error);
          failedSubscriptionsRef.current[trade.symbol] =
            (failedSubscriptionsRef.current[trade.symbol] || 0) + 1;
        });
    });
  }, [dataArray]);

  // Fetch current price when dataArray changes
  useEffect(() => {
    if (dataArray && dataArray.length > 0) {
      getCurrentPrice();
    }
  }, [dataArray, getCurrentPrice]);

  // Utility to get the last traded price for a symbol
  const getLTPForSymbol = useCallback(
    (symbol) => {
      const ltpItem = ltp.find((item) => item.tradingSymbol === symbol);
      return ltpItem ? ltpItem.lastPrice : null;
    },
    [ltp]
  );

  const calculateTotalAmount = () => {
    let totalAmount = 0;
    stockDetails.forEach((ele) => {
      if (ele.transactionType === "BUY") {
        const ltp = getLTPForSymbol(ele.tradingSymbol); // Get LTP for current symbol
        if (ltp !== "-") {
          totalAmount += parseFloat(ltp) * ele.quantity; // Calculate total amount for this trade
        }
      }
    });
    return totalAmount.toFixed(2); // Return total amount formatted to 2 decimal places
  };

  const handleRemoveStock = async (symbol, tradeId) => {
    console.log("Removing stock:-----------------=====", symbol, tradeId);
    const startTime = Date.now(); // Capture the start time

    const cartItemsKey = "cartItems";

    try {
      // Load cart items from AsyncStorage
      const cartData = await AsyncStorage.getItem(cartItemsKey);
      let cartItems = cartData ? JSON.parse(cartData) : [];

      // Filter out stock from state and AsyncStorage
      const updatedStockDetails = stockDetails.filter(
        (selectedStock) =>
          !(selectedStock.tradingSymbol === symbol && selectedStock.tradeId === tradeId)
      );

      const updatedCartItems = cartItems.filter(
        (selectedStock) =>
          !(selectedStock.tradingSymbol === symbol && selectedStock.tradeId === tradeId)
      );

      // Update state and AsyncStorage in parallel
      setStockDetails(updatedStockDetails);

      await AsyncStorage.setItem(cartItemsKey, JSON.stringify(updatedCartItems));
      const storedCartItems = await AsyncStorage.getItem(cartItemsKey);
console.log('Review Modal in AsyncStorage:', storedCartItems);
      console.log('Emitting stockRemoved event--------------------->>>>>>>>>>>>>>>>>>>>');
      eventEmitter.emit("stockRemoved", { symbol, tradeId });

    } catch (error) {
      console.error("Error removing stock:", error);
    }
  };



  const [selectedOption, setSelectedOption] = useState("");
  const [inputFixSizeValue, setInputFixValue] = useState("");

  const handleFixSize = () => {
    if (selectedOption === "fix" && inputFixSizeValue) {
      const fixedSize = parseFloat(inputFixSizeValue);
      const updatedStockDetails = stockDetails.map((stock) => {
        const currentPrice = parseFloat(getLTPForSymbol(stock.tradingSymbol)) || 0;
        const newQuantity = currentPrice > 0 ? Math.floor(fixedSize / currentPrice) : 0;
        return { ...stock, quantity: newQuantity };
      });
      setStockDetails(updatedStockDetails);
    }
  };

  const handleReset = () => {
    setSelectedOption("");
    setInputFixValue("");
  };
  const [isLoading, setIsLoading] = useState(false);
  const [buttonTitle, setButtonTitle] = useState('Slide To Place Order | ₹134.07');
  const handleSwipeSuccess = () => {
    //placeOrder();
    setButtonTitle('');
     // Adjust the timeout duration as needed
  };

  const [isWebView,setWebView]=useState(false);
  const webViewRef = useRef(null);
  const kiteHandoff = useKiteHandoffGuard({
    visible: isWebView,
    webViewRef,
    configData,
    flow: 'advice_or_basket',
  });
  const [htmlContentfinal, setHtmlContent] = useState(htmlContent || "");
  const publisherWebViewBaseUrl = getPublisherWebViewBaseUrl(configData);
  const publisherWebViewSource = useMemo(
    () => ({html: htmlContentfinal, baseUrl: publisherWebViewBaseUrl}),
    [htmlContentfinal, publisherWebViewBaseUrl],
  );



  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState(null);
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);
  const zerodhaStatusCheckInFlightRef = useRef(false);

  const updateStoredPublisherAttempt = useCallback(
    async (status, publisherStatus) => {
      try {
        const stored = await AsyncStorage.getItem(
          ZERODHA_PUBLISHER_ATTEMPT_KEY,
        );
        const attempt = parseZerodhaPublisherAttempt(stored);
        if (!attempt) return;
        const now = Date.now();
        await AsyncStorage.setItem(
          ZERODHA_PUBLISHER_ATTEMPT_KEY,
          JSON.stringify({
            ...attempt,
            status,
            publisherStatus:
              publisherStatus || attempt.publisherStatus || 'unknown',
            updatedAt: now,
          }),
        );
      } catch (error) {
        console.warn(
          '[ZerodhaPublisher] Could not update local attempt:',
          error?.message,
        );
      }
    },
    [],
  );

  const clearStoredPublisherAttempt = useCallback(async () => {
    await AsyncStorage.multiRemove([
      ZERODHA_PUBLISHER_ORDER_KEY,
      ZERODHA_PUBLISHER_ATTEMPT_KEY,
    ]);
  }, []);

  // Publisher order-book polling fallback for Kite Publisher WebView
  // callback misses. Canonical implementation lives in
  // `src/hooks/useKitePublisherPolling.js` — see
  // docs/REBALANCING.md § Kite Publisher polling fallback. Three known
  // failure scenarios: cross-domain 302 loss, OS-suspended WebView
  // during broker-app authentication, and AsyncStorage hydration races.
  // For Zerodha, jwtToken is the access_token used by fetchOrderBook;
  // other broker creds are passed through for shape parity. The hook
  // preserves whether an order was detected or polling merely timed out;
  // only detected orders are promoted to publisher success.
  const { start: startKitePolling, stop: stopKitePolling } = useKitePublisherPolling({
    broker,
    brokerCreds: {
      clientCode: userDetails?.clientCode,
      apiKey: userDetails?.apiKey,
      jwtToken,
      secretKey: userDetails?.secretKey,
      sid: userDetails?.sid,
      serverId: userDetails?.serverId,
    },
    configData,
    onPublisherSettled: settlement => {
      const publisherStatus = resolvePublisherSettlement(settlement);
      logZerodhaDiagnostic('zerodha_mobile_basket_settled', {
        step: 'publisher_settled',
        reason: settlement?.reason,
        newOrders: Array.isArray(settlement?.newOrders) ? settlement.newOrders.length : 0,
        publisherStatus,
      }, configData);
      updateStoredPublisherAttempt(
        settlement?.reason === 'orders-detected'
          ? 'orders_detected'
          : settlement?.reason || 'publisher_settled',
        publisherStatus,
      );
      // A polling timeout only means the user has not completed the hosted
      // Kite flow yet. It is not an order submission signal. Keep the WebView
      // open so login/TOTP/review can continue; only broker evidence may enter
      // record-back and the order-result UI.
      if (publisherStatus !== 'success') {
        Toast.show({
          type: 'info',
          text1: 'Waiting for Zerodha confirmation',
          text2: 'Complete login and review in Kite, or close to cancel.',
          visibilityTime: 6000,
        });
        return;
      }
      setWebView(false);
      setZerodhaStatus(publisherStatus);
      setZerodhaRequestType('basket');
    },
  });

  const dismissPublisher = () => {
    stopKitePolling();
    clearStoredPublisherAttempt().catch(error =>
      console.warn(
        '[ZerodhaPublisher] Cancel cleanup failed:',
        error?.message,
      ),
    );
    setWebView(false);
    setZerodhaStatus(null);
    setZerodhaRequestType(null);
    setflag(false);
    // Cancellation leaves every leg in recommend; refresh immediately so the
    // basket card returns without waiting for polling or EOD reconciliation.
    try {
      if (typeof getAllTrades === 'function') getAllTrades();
    } catch (_) { /* best-effort refresh */ }
    Toast.show({
      type: 'info',
      text1: 'Order placement cancelled',
      text2: 'No order is marked placed until Zerodha confirms it.',
      visibilityTime: 4000,
    });
  };

  const handleWebViewNavigationStateChange = (newNavState) => {
    // Handle navigation state changes, e.g., success/failure redirects
    const { url } = newNavState;
    console.log('url at Review Modal :',url);
    logZerodhaDiagnostic('zerodha_mobile_basket_nav', {
      url,
      baseUrl: getPublisherWebViewBaseUrl(configData),
    }, configData);
    const redirectStatus = parseKiteRedirectStatus(url);
    if (redirectStatus === 'cancelled') {
      console.log('cancelled url at Review Modal :',url);
      dismissPublisher();
      return;
    }
    if (redirectStatus === 'success') {
      console.log('success url at Review Modal :',url);
      stopKitePolling();
      updateStoredPublisherAttempt('callback_success', 'success');
      setWebView(false);
      setZerodhaStatus('success');
      setZerodhaRequestType('basket');
    }
  };


  const getUpdatedBasket = async (stockDetails) => {
    const apiUrl = `${server.ccxtWs.httpUrl}/zerodha/fno/symbol-lotsize`;


    // Filter relevant symbols
    const symbolsToFetch = stockDetails
      .filter(stock => stock.exchange === 'NFO' || stock.exchange === 'BFO')
      .map(stock => ({
        symbol: stock.tradingSymbol,
        exchange: stock.exchange,
        transactionType: stock.transactionType
      }));

    let fetchedData = {};

    if (symbolsToFetch.length > 0) {
      try {
        const response = await axios.post(apiUrl,
          {
            symbols: symbolsToFetch,
            userEmail: userEmail
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
              "aq-encrypted-key": generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET
              ),
            },
          }
        );

        const data = response.data;
        console.log('data i got yayyy------',data);
        if (data.status === 0) {
          fetchedData = data.results.reduce((acc, result) => {
            acc[result.previous_symbol] = result;
            console.log('data ofcccc zerodha:', acc);
            return acc;
          }, {});
        }

      } catch (error) {
        console.error("Error fetchi........ng lotsize and new_symbol:", error);
      }
    }

    console.log('Fetched new symbol:', fetchedData);
    return fetchedData;
  };


 // console.log('stock details i get zerodha--0',stockDetails);

  const handleZerodhaRedirect = async () => {
    if (!hasStockOrders) {
      Toast.show({
        type: 'error',
        text1: 'No Orders to Place',
        text2: 'Add item to cart to place order.',
      });
      return;
    }

    // Pre-flight: refuse to send orders with missing exchange. Kite Publisher
    // silently drops basket items whose symbol/exchange combo it can't resolve
    // (e.g. a BSE-only symbol sent with exchange=NSE).
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

    // Belt-and-braces variant tagging — `StockAdvices.handleTrade` already tags
    // variant before passing stockDetails into this modal, but defensive
    // tagging here covers (a) any future caller that doesn't pre-tag,
    // (b) the recovery path where this modal's AsyncStorage write is the
    // only persistence (e.g. user kills app mid-WebView, comes back, and
    // checkZerodhaStatus rehydrates from disk). Each item keeps its
    // upstream-supplied variant when present; otherwise the modal's own
    // submit-time computation fills in. See docs/APP_ARCHITECTURE.md
    // § 4.5.2 Trade variant field.
    const fallbackVariant = computeTradeVariant(allowAfterHoursOrders);
    let taggedStockDetails = (stockDetails || []).map(s => ({
      ...s,
      variant: s?.variant || fallbackVariant,
    })).sort(
      (a, b) => Number(a.priority ?? a.Priority ?? 0) - Number(b.priority ?? b.Priority ?? 0),
    );

    const resolvedUserEmail =
      (await getAccountEmailAsync()) ||
      userEmail ||
      userDetails?.email;
    if (!resolvedUserEmail) {
      Toast.show({
        type: 'error',
        text1: 'Account is still loading',
        text2: 'Please try again in a moment. No order was sent to Zerodha.',
        visibilityTime: 6000,
      });
      return;
    }

    // B-38b (ported 2026-09-21): size closure legs to THIS customer's open
    // position before the Kite window opens. The Publisher path never reaches
    // /order-place, so this is the only clamp a Zerodha single-leg exit gets.
    // Basket legs are excluded — basket.py already sizes those per customer.
    // See utils/closureClamp.js for the contract and the fail-closed rule.
    if (!hasBasketOrders) {
      const clampTradeIds = taggedStockDetails
        .map(stock => stock?.tradeId)
        .filter(id => id != null && id !== '');
      const cartHasExit = taggedStockDetails.some(isClosureLeg);
      if (clampTradeIds.length > 0) {
        try {
          const customerAuthHeaders = await getCustomerAuthHeaders();
          if (!customerAuthHeaders) {
            throw new Error('signed-in customer session required');
          }
          const clamps = await fetchClosureClamps({
            baseUrl: server.server.baseUrl,
            userEmail: resolvedUserEmail,
            tradeIds: clampTradeIds,
            broker: 'Zerodha',
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
              ...customerAuthHeaders,
            },
          });
          const {next, removed, clamped} = applyClosureClamps(
            taggedStockDetails,
            clamps,
          );
          if (removed.length) {
            Toast.show({
              type: 'error',
              text1: 'Exit skipped',
              text2: REMOVED_EXIT_MESSAGE(removed),
              visibilityTime: 8000,
            });
          }
          if (clamped.length) {
            Toast.show({
              type: 'info',
              text1: 'Exit quantity adjusted',
              text2: CLAMPED_EXIT_MESSAGE(clamped),
              visibilityTime: 6000,
            });
          }
          if (next.length === 0) {
            return;
          }
          taggedStockDetails = next;
        } catch (clampError) {
          console.warn(
            '[ZerodhaPublisher] B-38b closure clamp unavailable:',
            clampError?.message,
          );
          if (cartHasExit) {
            Toast.show({
              type: 'error',
              text1: 'Exit is blocked',
              text2: CLAMP_UNAVAILABLE_MESSAGE,
              visibilityTime: 7000,
            });
            return;
          }
        }
      }
    }

    if (hasBasketOrders) {
      if (taggedStockDetails.length > 10) {
        Toast.show({
          type: 'error',
          text1: 'Basket is too large for one Zerodha window',
          text2: `${taggedStockDetails.length} legs found; Zerodha supports 10. No order was sent.`,
          visibilityTime: 8000,
        });
        return;
      }
      try {
        const gateTrades = taggedStockDetails.map(trade => ({
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
          userEmail: resolvedUserEmail,
          basketId: taggedStockDetails[0]?.basketId,
          trades: gateTrades,
          route: 'mobile_zerodha_review_publisher',
          configData,
        });
        if (!gateDecision.allowed) {
          Toast.show({
            type: 'info',
            text1: basketEntryGateMessage(gateDecision),
            text2: 'No order was sent.',
          });
          return;
        }
      } catch (_) {
        Toast.show({
          type: 'error',
          text1: 'Entry is temporarily unavailable',
          text2: 'No order was sent. Please retry.',
        });
        return;
      }
    }

    let freshProtectionPrices;
    try {
      freshProtectionPrices = await fetchFreshKiteProtectionPrices(
        taggedStockDetails,
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

    let existingAttempt = null;
    try {
      existingAttempt = parseZerodhaPublisherAttempt(
        await AsyncStorage.getItem(ZERODHA_PUBLISHER_ATTEMPT_KEY),
      );
    } catch (storageError) {
      console.error(
        '[ZerodhaPublisher] Could not read the previous attempt:',
        storageError?.message,
      );
      Toast.show({
        type: 'error',
        text1: 'Could not safely open Zerodha',
        text2: 'Please try again. No order was sent to Zerodha.',
        visibilityTime: 6000,
      });
      return;
    }
    if (isZerodhaPublisherRetryGuarded(existingAttempt)) {
      Toast.show({
        type: 'info',
        text1: 'Previous Zerodha order is pending',
        text2: 'Check Kite Orders before placing the same order again.',
        visibilityTime: 8000,
      });
      return;
    }

    const attempt = createZerodhaPublisherAttempt({
      stockDetails: taggedStockDetails,
      userEmail: resolvedUserEmail,
      flow: hasBasketOrders ? 'basket' : 'single',
    });
    try {
      // The recovery payload and attempt guard must be durable before Kite is
      // opened. Fail closed if persistence is unavailable.
      await AsyncStorage.multiSet([
        [
          ZERODHA_PUBLISHER_ORDER_KEY,
          JSON.stringify(taggedStockDetails),
        ],
        [
          ZERODHA_PUBLISHER_ATTEMPT_KEY,
          JSON.stringify(attempt),
        ],
      ]);
      console.log("Updated stockDetailsZerodhaOrder with:", taggedStockDetails);
    } catch (error) {
      console.error("Error updating stockDetailsZerodhaOrder:", error);
      Toast.show({
        type: 'error',
        text1: 'Could not safely open Zerodha',
        text2: 'Please try again. No order was sent to Zerodha.',
        visibilityTime: 6000,
      });
      return;
    }

    try {
      const intentResponse = await axios.post(
        `${server.server.baseUrl}api/process-trades/execution-intent`,
        {
          userEmail: resolvedUserEmail,
          broker: 'Zerodha',
          flow: attempt.flow,
          lifecycle: 'popup_opened',
          attemptId: attempt.attemptId,
          context: {
            source: 'mobile-review-zerodha',
            attemptId: attempt.attemptId,
          },
          legs: taggedStockDetails.map(stock => ({
            symbol: stock.tradingSymbol || stock.symbol,
            type: stock.transactionType || stock.type,
            quantity: stock.quantity,
          })),
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
            ...executionBundleHeaders(),
          },
          timeout: 4000,
        },
      );
      if (
        !intentResponse?.data?.intentId ||
        intentResponse?.data?.attemptId !== attempt.attemptId ||
        intentResponse?.data?.payloadMismatch
      ) {
        throw new Error('Execution session acknowledgement was incomplete');
      }
    } catch (error) {
      await AsyncStorage.multiRemove([
        ZERODHA_PUBLISHER_ORDER_KEY,
        ZERODHA_PUBLISHER_ATTEMPT_KEY,
      ]).catch(() => {});
      const staleBundleHandled = await handleStaleExecutionBundle(error);
      if (staleBundleHandled) return;
      Toast.show({
        type: 'error',
        text1: 'Could not safely open Zerodha',
        text2: 'The server could not prepare order recovery. Please try again.',
        visibilityTime: 6000,
      });
      return;
    }

    const apiKey = zerodhaApiKey;
   // Fetch updated basket data
  const fetchedData = await getUpdatedBasket(taggedStockDetails);

  const basket = taggedStockDetails.map((stock) => {

    console.log('stock detailskkkkkk  i get here-',stock);

    // Scripmaster-resolved symbol/exchange (strips -EQ, routes BE→BSE, etc.)
    const resolved = resolveZerodhaSymbol(stock, symbolMap);

    // Use LTP for price calculation. Prefer live ws LTP on the resolved
    // symbol, fall back to live LTP on raw symbol, fall back to the
    // server-side Redis-cached LTP returned by /zerodha/convert-symbol.
    const freshLtp = Number(
      freshProtectionPrices?.[String(resolved.tradingsymbol || '').toUpperCase()],
    );
    const isMarket = String(stock.orderType || '').toUpperCase() === 'MARKET';
    const liveLtp =
      getLastKnownPrice(resolved.tradingsymbol) ||
      getLastKnownPrice(stock.tradingSymbol);
    const ltp = isMarket
      ? freshLtp
      : (liveLtp && liveLtp !== '-' && parseFloat(liveLtp) > 0
        ? liveLtp
        : resolved.cachedLtp || 0);
    const ltpNumeric = ltp && ltp !== "-" ? parseFloat(ltp) : 0;
    const orderPrice = stock.orderType === "LIMIT"
      ? parseFloat(stock.price || 0)
      : stock.orderType === "SL"
        ? ltpNumeric
        : 0;

    // If the stock is in 'NFO' or 'BFO', update with fetched data. The
    // NFO/BFO branch overrides the scripmaster result since derivatives
    // need the exact lot-size-aligned tradingsymbol from getUpdatedBasket.
    let finalQuantity = stock.quantity;
    let finalSymbol = resolved.tradingsymbol;
    let finalExchange = resolved.exchange;
    const fetchedLeg = fetchedData[stock.tradingSymbol];
    const adviceLeg = (fullbasketData || []).find(
      leg =>
        (stock.tradeId && leg.tradeId === stock.tradeId) ||
        (leg.Symbol || leg.tradingSymbol) === stock.tradingSymbol,
    );
    if (fetchedLeg) {
      const {new_symbol} = fetchedLeg;
      finalSymbol = new_symbol;
      // Derivatives: preserve the advice-side exchange (NFO/BFO);
      // scripmaster's equity-side answer doesn't apply here.
      finalExchange = stock.exchange;
    }
    // The review-row payload intentionally stores quantity in LOTS and may
    // omit `Lots`. Use the scripmaster response first, then the original
    // advice row displayed by this modal. Without the latter fallback a
    // failed/mismatched symbol-lotsize lookup handed `1` to Kite for a
    // 65-share NIFTY lot, which Kite rejected as "multiple of 65".
    const adviceExchange = adviceLeg?.Exchange || adviceLeg?.exchange;
    const publisherExchange =
      ['NFO', 'BFO'].includes(String(adviceExchange || '').toUpperCase())
        ? adviceExchange
        : stock.exchange || finalExchange;
    const lotSize =
      fetchedLeg?.lotsize ||
      stock.Lots ||
      stock.lots ||
      adviceLeg?.Lots ||
      adviceLeg?.lots ||
      1;
    finalQuantity = getKiteBasketQuantity(
      stock.quantity,
      publisherExchange,
      lotSize,
    );
    if (['NFO', 'BFO'].includes(String(publisherExchange).toUpperCase())) {
      finalExchange = publisherExchange;
    }

    const basketItem = convertToBasketItem('Zerodha', stock, symbolMap, {
      tradingsymbol: finalSymbol,
      exchange: finalExchange,
      ltp: ltpNumeric,
      price: orderPrice,
      quantity: finalQuantity,
      tag: getKitePublisherTag(stock),
    });
    console.log('[ZerodhaPublisher] final basket item:', JSON.stringify(basketItem));
    return basketItem;
  });

    try {
      // Generate HTML form content
      const htmlContent =await generateHtmlForm(basket, apiKey);
      if(htmlContent){
        console.log('html content we get--',htmlContent);
        setHtmlContent(htmlContent);
      }
      // Show the WebView — its `source={{ html: htmlContentfinal }}` loads the
      // form whose inline <script> auto-submits to kite.zerodha.com/connect/basket.
      // The old `webViewRef.current.injectJavaScript(document.write(...))` here ran
      // SYNCHRONOUSLY, before the WebView had mounted (ref still null), so it threw
      // a TypeError that the catch below swallowed as "Could not open Zerodha" —
      // the basket never reached Kite (no order, app shows "pending").
      sellReservationRef.current = hasBasketOrders
        ? null
        : await reserveSellHoldsForPublisher({
            rows: taggedStockDetails,
            broker: 'Zerodha',
            configData,
            requestId: attempt?.attemptId,
          });
      setWebView(true);
      logZerodhaDiagnostic('zerodha_mobile_basket_settled', {
        step: 'redirect_started',
        baseUrl: getPublisherWebViewBaseUrl(configData),
        orders: basket.length,
      }, configData);

    } catch (error) {
      console.error("Failed to prepare Zerodha publisher:", error);
      await clearStoredPublisherAttempt().catch(() => {});
      setWebView(false);
      Toast.show({
        type: 'error',
        text1: 'Could not open Zerodha',
        text2: 'No order was sent. Please try again.',
        visibilityTime: 6000,
      });
    }
  };

  useEffect(() => {
    if(htmlContent){
      setHtmlContent(htmlContent);
      if (skipToWebView) {
        setWebView(true);
        // Start client-side order-book polling as the WebView-callback-missed
        // fallback. See docs/REBALANCING.md § Kite Publisher polling fallback.
        // Pass the leg count so polling waits for the whole basket instead of
        // closing the Kite page on the first order it sees.
        startKitePolling({
          expectedOrderCount: Array.isArray(stockDetails) ? stockDetails.length : 0,
        });
      }
    }
  }, [htmlContent, skipToWebView, startKitePolling]);

  const generateHtmlForm = async (basket, apiKey) => {
    return `<html>
        <body>
          <form id="zerodhaForm" method="POST" action="https://kite.zerodha.com/connect/basket">
            <input type="hidden" name="api_key" value="${apiKey}" />
            <input type="hidden" name="data" value='${JSON.stringify(basket)}' />
            <input type="hidden" name="redirect_params" value="${appURL}=true" />
          </form>
          <script>
            document.getElementById('zerodhaForm').submit();
          </script>
        </body>
      </html>
    `;
  };

  const fetchData = async () => {
    let persistedStockDetails = null;
    let attempt = null;
    try {
      const [pendingOrderData, attemptData] = await Promise.all([
        AsyncStorage.getItem(ZERODHA_PUBLISHER_ORDER_KEY),
        AsyncStorage.getItem(ZERODHA_PUBLISHER_ATTEMPT_KEY),
      ]);
      if (pendingOrderData) {
        try {
          persistedStockDetails = JSON.parse(pendingOrderData);
        } catch (parseError) {
          console.warn(
            '[ZerodhaPublisher] Ignoring malformed recovery payload:',
            parseError?.message,
          );
        }
      }
      attempt = parseZerodhaPublisherAttempt(attemptData);
    } catch (error) {
      // Storage is only one recovery source. The exact prop payload remains
      // valid for the current mounted flow.
      console.error('Error fetching Zerodha recovery data:', error);
    }

    return {
      zerodhaStockDetails: selectPublisherStockDetails(
        persistedStockDetails,
        attempt?.stockDetails || stockDetails,
      ),
      attempt,
    };
  };

  const checkZerodhaStatus = async () => {
    if (zerodhaStatusCheckInFlightRef.current) return;
    zerodhaStatusCheckInFlightRef.current = true;

    // Stop polling before record-back so a late tick cannot start a duplicate
    // request while this one is fetching the broker order book.
    stopKitePolling();

    let submittedStockDetails = selectPublisherStockDetails([], stockDetails);
    try {
      if (
        zerodhaStatus === null ||
        zerodhaStatus === 'cancelled' ||
        zerodhaRequestType !== 'basket'
      ) {
        return;
      }

      const {
        zerodhaStockDetails: recoveredStockDetails,
        attempt,
      } = await fetchData();
      submittedStockDetails = recoveredStockDetails;
      const resolvedUserEmail =
        (await getAccountEmailAsync()) ||
        userEmail ||
        userDetails?.email;

      if (submittedStockDetails.length === 0) {
        throw new Error(
          'The submitted Zerodha basket could not be recovered.',
        );
      }
      if (!resolvedUserEmail) {
        throw new Error(
          'Your account identity is still loading, so broker confirmation could not be recorded.',
        );
      }

      const callbackStatus =
        zerodhaStatus === 'success' ? 'success' : zerodhaStatus || 'unknown';
      await updateStoredPublisherAttempt('recording', callbackStatus);

      console.log(
        '[ZerodhaPublisher] Recording',
        submittedStockDetails.length,
        'publisher order(s)',
      );
      const response = await axios.post(
        `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
        {
          stockDetails: submittedStockDetails,
          publisherResults: [
            {status: callbackStatus, batchIndex: 0},
          ],
          userEmail: resolvedUserEmail,
          broker: 'Zerodha',
          advisor: Config.REACT_APP_ADVISOR_SPECIFIC_TAG,
          attemptId: attempt?.attemptId,
          sellReservationRef: sellReservationRef.current,
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
          },
          timeout: 90000,
        },
      );

      const orderResults =
        response?.data?.response || response?.data?.results || [];
      const outcome = classifyPublisherRecordResults(orderResults);
      const confirmationMessage =
        'Zerodha may have accepted this order, but its final status is not confirmed yet. Check Kite Orders and do not place the same order again.';
      const shouldShowUnconfirmed =
        outcome === 'empty';
      const displayedResults = shouldShowUnconfirmed
        ? buildUnconfirmedPublisherResults(
            submittedStockDetails,
            confirmationMessage,
          )
        : sanitizePublisherRecordResults(
            orderResults,
            confirmationMessage,
          );

      setOrderPlacementResponse(displayedResults);
      setOpenSucessModal(true);
      setOpenZerodhaModel(false);

      if (outcome === 'recorded') {
        await clearStoredPublisherAttempt();
      } else if (outcome === 'pending') {
        await updateStoredPublisherAttempt(
          'reconciliation_pending',
          callbackStatus,
        );
      } else {
        await updateStoredPublisherAttempt(
          'recording_unconfirmed',
          callbackStatus,
        );
      }

      // Once Zerodha or the backend has a concrete order/pending record, take
      // it out of the cart so the user cannot submit a duplicate. A mere
      // order_not_found/empty response is not concrete, so the local retry
      // guard remains the protection instead.
      if (outcome === 'recorded' || outcome === 'pending') {
        setBasketData([]);
        await Promise.allSettled([
          filterCartAfterOrder(),
          getCartAllStocks(),
          getAllTrades(),
          updatePortfolioData(broker, resolvedUserEmail),
        ]);
        eventEmitter.emit('cartUpdated');
        eventEmitter.emit('OrderPlacedReferesh');
      } else {
        await getAllTrades();
      }
    } catch (error) {
      console.error(
        '[ZerodhaPublisher] Record-back failed; broker status is unknown:',
        error.response?.data || error.message,
      );
      await updateStoredPublisherAttempt(
        'recording_failed',
        zerodhaStatus === 'success' ? 'success' : zerodhaStatus || 'unknown',
      );

      const confirmationMessage =
        'Zerodha may have accepted this order, but our confirmation request failed. Check Kite Orders and do not place the same order again.';
      setOrderPlacementResponse(
        buildUnconfirmedPublisherResults(
          submittedStockDetails,
          confirmationMessage,
        ),
      );
      setOpenSucessModal(true);
      setOpenZerodhaModel(false);
    } finally {
      setflag(false);
      setZerodhaStatus(null);
      setZerodhaRequestType(null);
      zerodhaStatusCheckInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (
      zerodhaStatus !== null &&
      zerodhaStatus !== "cancelled" &&
      zerodhaRequestType === "basket"
    ) {
      checkZerodhaStatus();
    }
  }, [zerodhaStatus, zerodhaRequestType, userEmail]);

  const totalAmount = useTotalAmount(stockDetails);

  const hasZeroQuantity = stockDetails.some((stock) => stock.quantity === 0);
  const [InputFixSizeValue,setInputFixSizeValue]=useState(0);

  const sheet = useRef(null);
  const scrollViewRef = useRef(null);



  const handleClose = () => {
    stopKitePolling();
    setWebView(false);
    setZerodhaStatus(null);
    setZerodhaRequestType(null);
    onClose();
  };



  const [totalQuantity, setTotalQuantity] = useState(1);
  // Per-leg base quantities (lots) captured on first load. The multiplier
  // must scale each leg off its OWN advised size — the old handlers set
  // every leg to the raw multiplier, collapsing a 2-lot CE + 1-lot PE
  // basket to (2,2) and then (1,1) on the way back to "1".
  const baseBasketQuantitiesRef = useRef({});

  useEffect(() => {
    if (Array.isArray(basketData) && basketData.length > 0) {
      const base = {...baseBasketQuantitiesRef.current};
      basketData.forEach(stock => {
        const key = `${stock.tradeId || 'noTradeId'}__${stock.tradingSymbol || stock.Symbol || ''}`;
        if (!(key in base)) {
          base[key] = stock.quantity || stock.Quantity || 1;
        }
      });
      baseBasketQuantitiesRef.current = base;
    }
  }, [basketData]);

  const applyMultiplierToBasket = (multiplier) => {
    const newData = basketData.map((stock) => {
      const key = `${stock.tradeId || 'noTradeId'}__${stock.tradingSymbol || stock.Symbol || ''}`;
      const baseQty =
        baseBasketQuantitiesRef.current[key] || stock.quantity || stock.Quantity || 1;
      return {...stock, quantity: baseQty * multiplier};
    });
    setBasketData(newData);
  };

  const handleIncreaseAllStockQty = () => {
    const newQuantity = totalQuantity + 1;  // Increase total quantity by 1
    setTotalQuantity(newQuantity);  // Update total quantity state
    applyMultiplierToBasket(newQuantity);
  };

  const handleDecreaseAllStockQty = () => {
    if (totalQuantity > 0) {
      const newQuantity = totalQuantity - 1;  // Decrease total quantity by 1
      setTotalQuantity(newQuantity);  // Update total quantity state
      applyMultiplierToBasket(newQuantity);
    }
  };

  const handleQuantityInputChangeAll = (value) => {
    const newQuantity = parseInt(value) || 0; // If invalid, fallback to 0
    setTotalQuantity(newQuantity);  // Update total quantity state
    applyMultiplierToBasket(newQuantity);
  };




  const renderTradeRow = ({ item, index }) => {
   // console.log('the maine ITEM WE GET in Review Trade Modal:',item);
    const symbol = item.tradingSymbol;
    const iniprice = 0;
    const exe = item.exchange;
    const matchingData = fullbasketData.find(
      (data) =>
        data.Symbol === symbol && data.tradeId === item.tradeId
    );
    // Extract required fields if `matchingData` exists
    const lots = matchingData?.Lots || 'N/A';
    const optionType = matchingData?.OptionType || 'N/A';
    const searchSymbol = matchingData?.searchSymbol || 'N/A';
    const strike = matchingData?.Strike || 'N/A';
    return (
      <View style={styles.tableRow} key={index}>
        <View style={styles.tableCell}>
          <Text style={styles.symbol}>{searchSymbol} {strike} {optionType==='CE' ? 'CALL' : 'PUT'}</Text>
          <View style={{flexDirection:'row'}}>
            <View style={[styles.tradeType, item.transactionType === 'SELL' ? styles.sell : styles.buy]}>
            <Text style={[styles.tradeType, item.transactionType === 'SELL' ? styles.sell : styles.buy]}>
            {item.transactionType === 'SELL' ? 'SELL' : 'BUY'}{' \u2022'}
          </Text>
            </View>
          <ReviewTradeText
              symbol={symbol || ""}
              orderType={optionType}
              exchange={exe}
              advisedPrice={iniprice || 0}
              stockDetails={basketData}
          />
          </View>
        </View>
        <View style={styles.tableCell}>

        </View>
        <View style={styles.tableCell}>
        <Text style={styles.tableHeaderText}>Qty/Lot</Text>
          <Text style={styles.quantity}>
            {item.quantity * lots}/{item.quantity}
          </Text>
        </View>
      </View>
    );
  };

//console.log('kjjiooolo:',basketData,"llllllllll---=",stockDetails);

  const renderItem = ({ item }) => {
  //  console.log('item IK:',item);
    const symbol = item.tradingSymbol;
    const iniprice = 0;
    const exe = item.exchange;


    return (console.log('current Price:', (getLTPForSymbol(item.tradingSymbol)),item.tradingSymbol), <View style={styles.rowContainer}>
  {/* Left-aligned stock symbol and transaction type */}
  <View style={styles.leftContainer}>
    <Text style={styles.symbol}>
      {item.tradingSymbol.length > 18 ? `${item.tradingSymbol.substring(0, 18)}...` : item.tradingSymbol}
    </Text>
    <View  style={[
        styles.cellText,
        item.transactionType === 'BUY' ? styles.buyOrder : styles.sellOrder,
      ]}>
    <Text
      style={[
        styles.cellText,
        item.transactionType === 'BUY' ? styles.buyOrder : styles.sellOrder,
      ]}
    >
      {item.transactionType}
    </Text>
    </View>

  </View>

  {/* Center-aligned quantity counter */}
  <View style={styles.quantityContainer}>
    <TouchableOpacity
      style={{ justifyContent: 'center' }}
      onPress={() => handleDecreaseStockQty(item.tradingSymbol, item.tradeId)}
    >
      <Minus size={12} color={designColor('000')} />
    </TouchableOpacity>
    <TextInput
      value={item.quantity.toString()}
      style={styles.quantityInput}
      keyboardType="numeric"
      onChangeText={(value) => handleQuantityInputChange(item.tradingSymbol, value, item.tradeId)}
    />
    <TouchableOpacity
      style={{ justifyContent: 'center' }}
      onPress={() => handleIncreaseStockQty(item.tradingSymbol, item.tradeId)}
    >
      <Plus size={12} color={designColor('000')} />
    </TouchableOpacity>
  </View>

  <View style={styles.rightContainer}>
  <ReviewTradeText
        symbol={symbol || ""}
        orderType={item.orderType}
        exchange={exe}
        advisedPrice={iniprice || 0}
        stockDetails={stockDetails}
      />
  </View>
  <TouchableOpacity style={{ marginRight: 10 }} onPress={() => handleRemoveStock(item.tradingSymbol, item.tradeId)}>
<Trash2Icon size={20} color={'black'} />
</TouchableOpacity>

</View>);
}





if (visible && isWebView) {
  return (
    <PublisherWebViewOverlay
      source={publisherWebViewSource}
      webViewRef={webViewRef}
      onClose={handleClose}
      onLoadStart={event => {
        setIsLoading(true);
        kiteHandoff.onLoadStart(event);
      }}
      onLoadEnd={event => {
        setIsLoading(false);
        kiteHandoff.onLoadEnd(event);
      }}
      onNavigationStateChange={state => {
        kiteHandoff.onNavigationStateChange(state);
        handleWebViewNavigationStateChange(state);
      }}
      onError={event => {
        kiteHandoff.onError(event);
        console.error('WebView error:', event.nativeEvent);
        logZerodhaDiagnostic('zerodha_mobile_basket_error', {
          step: 'webview_onError_focus_safe_overlay',
          error: JSON.stringify(event?.nativeEvent || {}),
        }, configData);
      }}
      onHttpError={kiteHandoff.onHttpError}
    />
  );
}

if (basketData?.length > 0) {
  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
      animationType="slide"
      hardwareAccelerated={true}

    >
      <SafeAreaView style={styles.modalOverlay} >
        <View style={[styles.modalContainer, { width: width * 1 }]}>
          {isWebView ? (
            <View
              style={{
                flex: 0,
                height: 600,
                borderTopRightRadius: 10,
                borderTopLeftRadius: 10,
                backgroundColor: 'white',
                padding: 10,
              }}
            >
              <View style={{ alignContent: 'flex-end', alignItems: 'flex-end' }}>
                <XIcon onPress={handleClose} size={16} color={'black'} />
              </View>

              <WebView
                ref={webViewRef}
                style={{
                  flex: 1,
                  borderTopRightRadius: 10,
                  borderTopLeftRadius: 10,
                }}
                source={publisherWebViewSource}
                onLoadStart={event => {
                  setIsLoading(true);
                  kiteHandoff.onLoadStart(event);
                }}
                onLoadEnd={event => {
                  setIsLoading(false);
                  kiteHandoff.onLoadEnd(event);
                }}
                onNavigationStateChange={state => {
                  kiteHandoff.onNavigationStateChange(state);
                  handleWebViewNavigationStateChange(state);
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                androidLayerType="hardware"
                setSupportMultipleWindows={false}
                thirdPartyCookiesEnabled={true}
                sharedCookiesEnabled={true}
                keyboardDisplayRequiresUserAction={false}
                onError={(e) => {
                  kiteHandoff.onError(e);
                  console.error('WebView error:', e.nativeEvent);
                  logZerodhaDiagnostic('zerodha_mobile_basket_error', {
                    step: 'webview_onError',
                    error: JSON.stringify(e?.nativeEvent || {}),
                  }, configData);
                }}
                onHttpError={kiteHandoff.onHttpError}
              />
            </View>
          ) : skipToWebView ? (
            <View style={{ height: 300, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderTopRightRadius: 10, borderTopLeftRadius: 10 }}>
              <ActivityIndicator size="large" color={designColor('0056b7')} />
              <Text style={{ marginTop: 12, fontFamily: designFont('Satoshi-Medium'), color: designColor('666') }}>Preparing Kite Publisher...</Text>
              <TouchableOpacity onPress={handleClose} style={{ marginTop: 20 }}>
                <Text style={{ color: designColor('0056b7'), fontFamily: designFont('Satoshi-Medium') }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
           <SafeAreaView
           >

          <View style={styles.horizontal} />
                      <View style={styles.header}>
                        <View style={styles.iconContainer}>
                        <ShoppingBag size={24} color="white" />
                        </View>
                        <Text style={styles.basketName}>{fullbasketData[0]?.basketName}{' \u2022'} BASKET</Text>
                      </View>
                      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <XIcon style={{alignContent:'center',alignItems:'center',alignSelf:'center'}} size={24} color={designColor('00000033')} />
              </TouchableOpacity>
                      <View style={{ borderWidth: 1, borderColor: designColor('e8e8e8'), marginTop: 5 }}></View>

                      <View style={styles.tableContainer}>


                        <FlatList
                        data={basketData}
                        renderItem={renderTradeRow}
                        keyExtractor={(item) => item.tradeId.toString()}
                        ListEmptyComponent={
                          <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
                            <View style={{ borderRadius: 50, backgroundColor: designColor('ebecef'), padding: 20 }}>
                              <CandlestickChartIcon size={40} color={"black"} />
                            </View>
                            <Text style={{ fontFamily: designFont('Satoshi-SemiBold'), color: 'black', fontSize: 18, marginVertical: 10 }}>
                              No Orders to Place
                            </Text>
                            <Text style={{ fontFamily: designFont('Satoshi-Medium'), color: 'grey' }}>
                              Add item to cart to place order.
                            </Text>
                          </View>
                        }
                        contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
                      />
                      </View>
                      <View style={styles.multiplierContainer}>
                        <Text style={styles.label}>Quantity Multiplier:</Text>
                        <View style={styles.multiplierControl}>
                          <TouchableOpacity onPress={() => handleDecreaseAllStockQty()}  style={styles.button}>
                            <Minus size={16} />
                          </TouchableOpacity>
                          <TextInput
                          value={totalQuantity.toString()}
                          style={styles.quantityInput}
                            keyboardType="numeric"
                            onChangeText={(value) => handleQuantityInputChangeAll(value)}

                          />
                          <TouchableOpacity  onPress={() => handleIncreaseAllStockQty()}  style={styles.button}>
                            <Plus size={16} />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.note}>
                          Note: The multiplier adjusts all stock quantities proportionally. A value of 2 doubles all quantities, 3 triples them, and so on.
                        </Text>
                      </View>

              {basketData?.length > 0 && (
                <GestureHandlerRootView style={{ flex: 0 }}>
                  <View
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderTopColor: designColor('e4e4e4'),
                      borderTopWidth: 0.5,
                      elevation: 1,
                      backgroundColor: designColor('fff'),
                    }}
                  >
                    <SliderButton
                      loading={loading}
                      text={
                        !marketGateOpen
                          ? 'Market is Closed'
                          : `Slide to Place Order || ₹${totalAmount || '0.00'}`
                      }
                      onSlideComplete={handleZerodhaRedirect}
                      disabled={hasZeroQuantity || !marketGateOpen}
                    />
                  </View>
                </GestureHandlerRootView>
              )}
          </SafeAreaView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}





  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
      animationType="slide"
      hardwareAccelerated={true}
    >
      <SafeAreaView style={styles.modalOverlay}  >
        <View style={[styles.modalContainer, { width: width * 1 }]}>
          {isWebView ? (
             <View style={{flex:0,height:600,borderTopRightRadius:10,borderTopLeftRadius:10,backgroundColor:'white',padding:10 }}>
              <View style={{alignContent:'flex-end',alignItems:'flex-end' }}>
              <XIcon onPress={handleClose} size={16} color={'black'}/>
              </View>

             <WebView
               ref={webViewRef}
               style={{ flex: 1,borderTopRightRadius:100,borderTopLeftRadius:100,}}
               source={publisherWebViewSource}
               onLoadStart={event => {
                 setIsLoading(true);
                 kiteHandoff.onLoadStart(event);
               }}
               onLoadEnd={event => {
                 setIsLoading(false);
                 kiteHandoff.onLoadEnd(event);
               }}
               onNavigationStateChange={state => {
                 kiteHandoff.onNavigationStateChange(state);
                 handleWebViewNavigationStateChange(state);
               }}
               javaScriptEnabled={true}
                domStorageEnabled={true}
                androidLayerType="hardware"
                setSupportMultipleWindows={false}
                thirdPartyCookiesEnabled={true}
                sharedCookiesEnabled={true}
                keyboardDisplayRequiresUserAction={false}
                onError={(e) => {
                  kiteHandoff.onError(e);
                  console.error('WebView error:', e.nativeEvent);
                  logZerodhaDiagnostic('zerodha_mobile_basket_error', {
                    step: 'webview_onError_single',
                    error: JSON.stringify(e?.nativeEvent || {}),
                  }, configData);
                }}
                onHttpError={kiteHandoff.onHttpError}
              />
           </View>
          ) : (
            <View style={[styles.modalContainer, { width: width * 1 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20,alignContent:'center',alignItems:'center',paddingVertical:10 }}>
                <Text style={styles.modalHeader1}>Zerodha Review Trade Details</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <XIcon style={{alignContent:'center',alignItems:'center',alignSelf:'center'}} size={24} color={designColor('00000033')} />
                </TouchableOpacity>
              </View>

         <View style={{ borderWidth: 0.4, borderColor: designColor('e4e4e4'), marginTop: 5 }}/>

              <FlatList
                data={stockDetails}
                renderItem={renderItem}
                keyExtractor={(item) => item.tradeId.toString()}
                ListHeaderComponent={
                  sellImpact.notices.length ? (
                    <View>
                      {sellImpact.notices.map(notice => {
                        const key = canonicalSymbol(notice.symbol);
                        return (
                          <SellModelImpactNotice
                            key={`sell-impact-${key}`}
                            notice={notice}
                            choice={sellImpact.choices[key]?.choice}
                            chosenModel={sellImpact.choices[key]?.modelName}
                            onChoose={(choice, modelName) =>
                              sellImpact.choose(notice, choice, modelName)
                            }
                          />
                        );
                      })}
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
                    <View style={{ borderRadius: 50, backgroundColor: designColor('ebecef'), padding: 20 }}>
                      <CandlestickChartIcon size={40} color={"black"} />
                    </View>
                    <Text style={{ fontFamily: designFont('Poppins-SemiBold'), color: 'black', fontSize: 18, marginVertical: 10 }}>
                      No Orders to Place
                    </Text>
                    <Text style={{ fontFamily: designFont('Poppins-Medium'), color: 'grey' }}>
                      Add item to cart to place order.
                    </Text>
                  </View>
                }
                contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
              />

              {stockDetails.length > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 20 }}>
                  <View>
                    <Text style={styles.cellText}>Scale Quantity By</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <RadioButton
                        value="fix"
                        status={selectedOption === "fix" ? "checked" : "unchecked"}
                        onPress={() => setSelectedOption("fix")}
                        color="black"
                      />
                      <Text style={{ color: 'grey', marginRight: 10 }}>Fix Size</Text>
                    </View>
                  </View>

                  {selectedOption === "fix" && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 10 }}>
                      <TextInput
                        value={inputFixSizeValue}
                        onChangeText={setInputFixValue}
                        placeholder="Enter value"
                        keyboardType="numeric"
                        style={{
                          width: 70,
                          marginLeft: 10,
                          color: 'black',
                          paddingLeft: 5,
                          paddingVertical: 1,
                          borderWidth: 1,
                          borderColor: designColor('ccc'),
                          borderRadius: 5,
                          marginRight: 8,
                        }}
                      />
                      <TouchableOpacity
                        onPress={handleFixSize}
                        style={[
                          {
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            backgroundColor: inputFixSizeValue ? 'black' : 'gray',
                            borderRadius: 5,
                            marginRight: 8,
                          },
                          !inputFixSizeValue && { opacity: 0.6 }
                        ]}
                        disabled={!inputFixSizeValue}
                      >
                        <Text style={{ color: 'white', fontSize: 14 }}>Update</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleReset} style={{ padding: 8 }}>
                        <Text style={{ fontSize: 20, color: 'gray' }}>⟳</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <View style={{ paddingVertical: 0, borderTopColor: designColor('e4e4e4'), borderTopWidth: 0.5, elevation: 1, backgroundColor: designColor('fff') }}>
              <GestureHandlerRootView style={{ flex: 0 }}>
<View style={{paddingVertical:5,paddingHorizontal:10,borderTopColor:designColor('e4e4e4'),borderTopWidth:0.5,elevation:1,backgroundColor:designColor('fff')}}>
        <SliderButton
        loading={loading}
        disabled={hasZeroQuantity || !marketGateOpen}
        text={!marketGateOpen ? 'Market is Closed' : `Slide to Place Order || ₹${totalAmount || '0.00'}`}
        onSlideComplete={handleZerodhaRedirect} />
      </View>
    </GestureHandlerRootView>
                {loading && (
                  <ActivityIndicator
                    size="small"
                    color={designColor('ffffff')}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fixSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  input: {
    width: 100,
    height: 32,
    padding: 2,
    marginHorizontal: 4,
    color: designColor('0d0c22'),
    fontSize: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: designColor('e9e8e8'),
    borderRadius: 7,
  },
  updateButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'black',
    borderRadius: 5,
    marginRight: 8,
  },
  buttonDisabled: {
    backgroundColor: 'gray',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
  },
  resetButton: {
    padding: 8,
  },
  resetIcon: {
    fontSize: 18,
    color: 'gray',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopRightRadius:10,
    borderTopLeftRadius:10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignContent:'center',
    justifyContent:'center',
    alignItems:'center',
    alignSelf:'center',
    backgroundColor:'transparent',
    borderWidth:1,
    borderColor:designColor('000'),
    borderRadius:20,
    paddingVertical:3,
  },
  quantityContainer1: {
    flexDirection: 'row',
    paddingVertical: 5,
    marginHorizontal: 25,
  },
  closeButton: {

  },
  buyOrder: {
    color: designColor('fff'),
    fontFamily:designFont('Satoshi-Regular'),
    paddingHorizontal:8,
    paddingVertical:1,
    backgroundColor:designColor('12d06c'),
    alignSelf: 'flex-start',

    borderRadius:15,

  },
  sellOrder: {
    color: designColor('fff'),
    fontFamily:designFont('Satoshi-Regular'),
    paddingHorizontal:8,
    paddingVertical:1,    borderRadius:15,
    backgroundColor:'red',
  },
  cell: {

    borderWidth:1,
    borderColor:'grey',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  symbol: {
    alignSelf: 'flex-start',
    color: 'black',
    fontSize:12,
    flexDirection:'column',
    fontFamily: designFont('Satoshi-Bold'),
  },
  cellText: {
    alignContent:'center',
    color: 'black',
    fontSize:10,
    fontFamily: designFont('Satoshi-Medium'),
  },
  cellTextmktprice: {
    alignSelf: 'center',
    color: 'black',
    fontFamily: designFont('Satoshi-Regular'),
  },
  quantityInput: {
    height:15,
    padding: 0,
    maxWidth:'30%',
    color: designColor('0d0c22'),
    marginHorizontal:5,
    fontSize: 12,
    paddingHorizontal:0,
    fontFamily:designFont('Satoshi-Bold'),
    textAlign: 'center',
    alignContent:'center',
    alignItems:'center',
    alignSelf:'center',
    borderRadius: 8,
  },
  quantityInputup: {
    width: 80,
    height: 35,
    padding: 2,
    alignSelf: 'center',
    marginHorizontal: 4,
    color: designColor('0d0c22'),
    fontSize: 14,
    fontFamily: designFont('Satoshi-Bold'),
    textAlign: 'center',
    borderWidth: 1,
    borderColor: designColor('e9e8e8'),
    borderRadius: 7,
  },
  modalContainer: {
    backgroundColor:designColor('fffef7'),
    borderTopRightRadius:20,borderTopLeftRadius:20,
    maxHeight:screenHeight,
 overflow:'hidden'
  },
  horizontal: {

  },
  modalHeader: {
    fontSize: 18,
    marginTop: 3,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    color: 'black',
  },
  modalHeader1: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Bold'),
    alignSelf: 'flex-start',
    color: 'black',
  },
  orderButton: {
    backgroundColor: designColor('000'),
    paddingVertical: 15,
    marginHorizontal: 0,
    borderRadius: 10,
    alignItems: 'center',
  },
  orderButtonText: {
    color: designColor('fff'),
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 16,
  },
  leftContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    marginRight:5,
    alignItems: 'flex-start',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    alignContent:'flex-end',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal:10,
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: designColor('e8e8e8'),
  },

  /////

  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    backgroundColor: 'transparent',
    padding: 10,
    marginLeft:10,
    borderRadius: 50,
    flexDirection:'row',
    justifyContent:'space-between',
    marginRight: 10,
  },
  basketName: {
    fontSize: 18,
    fontFamily:designFont('Satoshi-Bold'),
    color: 'black',
  },
  tableContainer: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: designColor('f5f5f5'),
    paddingVertical: 5,
    paddingHorizontal: 5,
    marginBottom: 5,
  },
  tableHeaderText: {
    fontSize: 13,
    color: designColor('000000'),
    fontFamily:designFont('Satoshi-Bold'),
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent:'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: designColor('ddd'),
  },
  tableCell: {

  },
  stockSymbol: {
    fontSize: 14,
    color: designColor('000000'),
    fontFamily:designFont('Satoshi-Medium'),
  },
  tradeType: {
    marginTop: 5,
    fontSize: 12,
  },
  sell: {
    fontFamily:designFont('Satoshi-Bold'),
    color: designColor('ea2d3f'),
  },
  buy: {
    fontFamily:designFont('Satoshi-Bold'),
    color: designColor('16a085'),
  },
  price: {
    fontSize: 13,
    color: designColor('000000'),
  },
  quantity: {
    fontSize: 15,
    color: designColor('000000'),
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  multiplierContainer: {
    marginVertical: 5,
    marginHorizontal:10,
  },
  label: {
    fontSize: 14,
    color: designColor('000000'),
  },
  multiplierControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  button: {
    width: 30,
    height: 30,
    backgroundColor: designColor('e9e9e9'),
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiplierInput: {
    width: 60,
    height: 25,
    borderColor: designColor('ccc'),
    borderWidth: 1,
    borderRadius: 5,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  note: {
    fontSize: 12,
    color: designColor('888'),
    marginTop: 10,
  },
  fundInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  fundLabel: {
    fontSize: 12,
    color: designColor('000000'),
  },
  fundAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: designColor('000000'),
  },
  placeOrderButton: {
    backgroundColor: designColor('000'),
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderText: {
    color: designColor('fff'),
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ReviewZerodhaTradeModal;
