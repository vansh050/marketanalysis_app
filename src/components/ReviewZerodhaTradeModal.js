import React, { useState,useRef,useCallback,useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions,ActivityIndicator, TextInput,SafeAreaView, ScrollView, Pressable, FlatList } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { XIcon, Trash2Icon,CandlestickChartIcon, ChevronRight,ShoppingBag,Minus,Plus } from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Feather';
import server from '../utils/serverConfig'
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import axios from 'axios';

import { io } from "socket.io-client";
import { useTotalAmount } from './AdviceScreenComponents/DynamicText/websocketPrice';
import eventEmitter from './EventEmitter';
import IsMarketHours from '../utils/isMarketHours';
import { RadioButton } from 'react-native-paper';

import { WebView } from 'react-native-webview';
import moment from 'moment';

import SliderButton from './SliderButton';
import Icon from 'react-native-vector-icons/FontAwesome';
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
import { getLastKnownPrice } from './AdviceScreenComponents/DynamicText/websocketPrice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReviewTradeText from './AdviceScreenComponents/ReviewTradeText';
import { generateToken } from '../utils/SecurityTokenManager';
import { useTrade } from '../screens/TradeContext';
import { useConfig } from '../context/ConfigContext';
import Toast from 'react-native-toast-message';
import { validateStockExchanges, getPublisherWebViewBaseUrl, resolveZerodhaSymbol } from '../utils/brokerPublisher';
import useZerodhaSymbolMap from '../hooks/useZerodhaSymbolMap';

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
}) => {
  const {configData}=useTrade();
  const config = useConfig();
  const { logo: LogoComponent, themeColor, mainColor, secondaryColor, toolbarlogo: Toolbarlogo1, allowAfterHoursOrders } = config || {};
  const marketGateOpen = IsMarketHours() || allowAfterHoursOrders;
  // Scripmaster-corrected Kite symbol/exchange map (handles -EQ suffix,
  // BE→BSE diversion, BSE-primary symbols mislabeled as NSE). Published
  // baskets read `resolveZerodhaSymbol(stock, symbolMap)` for the outgoing
  // `tradingsymbol`/`exchange`; `cachedLtp` covers applyKiteMarketProtection
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
  const [htmlContentfinal, setHtmlContent] = useState("");


  
  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState(null);
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);
  const handleWebViewNavigationStateChange = (newNavState) => {
    // Handle navigation state changes, e.g., success/failure redirects
    const { url } = newNavState;
    console.log('url at Review Modal :',url);
    if (url.includes('success') || url.includes('completed')) {
      console.log('success url at Review Modal :',url);
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


 // console.log('stock details i get zerodha--0',stockDetails);

  const handleZerodhaRedirect = async () => {
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
        text2: `Missing exchange for: ${missingList}. Please contact your advisor.`,
        visibilityTime: 8000,
      });
      return;
    }

    const storageKey = "stockDetailsZerodhaOrder";
    try {
      // Clear the existing value
      await AsyncStorage.removeItem(storageKey);
  
      // Set the new value
      await AsyncStorage.setItem(storageKey, JSON.stringify(stockDetails));
      console.log("Updated stockDetailsZerodhaOrder with:", stockDetails);
    } catch (error) {
      console.error("Error updating stockDetailsZerodhaOrder:", error);
    }
    const apiKey = zerodhaApiKey;
   // Fetch updated basket data
  const fetchedData = await getUpdatedBasket(stockDetails);

  const basket = stockDetails.map((stock) => {

    console.log('stock detailskkkkkk  i get here-',stock);

    // Scripmaster-resolved symbol/exchange (strips -EQ, routes BE→BSE, etc.)
    const resolved = resolveZerodhaSymbol(stock, symbolMap);

    // Use LTP for price calculation. Prefer live ws LTP on the resolved
    // symbol, fall back to live LTP on raw symbol, fall back to the
    // server-side Redis-cached LTP returned by /zerodha/convert-symbol.
    const liveLtp =
      getLastKnownPrice(resolved.tradingsymbol) ||
      getLastKnownPrice(stock.tradingSymbol);
    const ltp =
      liveLtp && liveLtp !== '-' && parseFloat(liveLtp) > 0
        ? liveLtp
        : resolved.cachedLtp || 0;
    const ltpNumeric = ltp && ltp !== "-" ? parseFloat(ltp) : 0;
    let orderPrice = 0;
    let kiteOrderType = mapKiteOrderType(stock.orderType);
    let kiteValidity = null;

    // MARKET -> LIMIT with 1% market-protection buffer (IOC on NSE, DAY on BSE).
    // Mirrors ICICI (48f1fb47) / AliceBlue (84a9bf94) / web fix to dodge Kite's
    // "MARKET orders are blocked — enable market protection" rejection on
    // GSM/T2T/BE-series stocks (e.g. VIKASECO). Falls through to plain MARKET
    // when no LTP is available.
    if (stock.orderType === "LIMIT") {
      orderPrice = parseFloat(stock.price || 0);
    } else if ((stock.orderType === "MARKET" || stock.orderType === "SL") && ltpNumeric > 0) {
      const isBuy = (stock.transactionType || "BUY").toUpperCase() === "BUY";
      const MARKET_PROTECTION_BUFFER_PCT = 0.01;
      const bufferedPrice = isBuy
        ? Math.round(ltpNumeric * (1 + MARKET_PROTECTION_BUFFER_PCT) * 100) / 100
        : Math.round(ltpNumeric * (1 - MARKET_PROTECTION_BUFFER_PCT) * 100) / 100;
      if (stock.orderType === "MARKET") {
        kiteOrderType = "LIMIT";
        kiteValidity = (resolved.exchange || "").toUpperCase() === "BSE" ? "DAY" : "IOC";
        orderPrice = bufferedPrice;
        console.log(`[ZerodhaPublisher] MARKET→LIMIT for ${resolved.tradingsymbol}: ltp=${ltpNumeric} ${isBuy ? "BUY" : "SELL"} limit=${bufferedPrice} validity=${kiteValidity}`);
      } else {
        // SL path — keep original (trigger-based, not MARKET-blocked)
        orderPrice = ltpNumeric;
      }
    } else if (stock.orderType === "MARKET" || stock.orderType === "SL") {
      orderPrice = 0;
      console.warn(`[ZerodhaPublisher] MARKET order for ${stock.tradingSymbol} has no LTP — sending as plain MARKET`);
    }

    // If the stock is in 'NFO' or 'BFO', update with fetched data. The
    // NFO/BFO branch overrides the scripmaster result since derivatives
    // need the exact lot-size-aligned tradingsymbol from getUpdatedBasket.
    let finalQuantity = stock.quantity;
    let finalSymbol = resolved.tradingsymbol;
    let finalExchange = resolved.exchange;
    if (fetchedData[stock.tradingSymbol]) {
      const { lotsize, new_symbol } = fetchedData[stock.tradingSymbol];
      finalSymbol = new_symbol;
      finalQuantity = parseInt(lotsize, 10);
      // Derivatives: preserve the advice-side exchange (NFO/BFO);
      // scripmaster's equity-side answer doesn't apply here.
      finalExchange = stock.exchange;
    }

    let baseOrder = {
      variety: "regular",
      tradingsymbol: finalSymbol,
      // exchange is guaranteed non-empty by validateStockExchanges() above
      exchange: finalExchange,
      transaction_type: (stock.transactionType || "BUY").toUpperCase(),
      order_type: kiteOrderType,
      quantity: finalQuantity,
      product: mapKiteProductType(stock.productType),
      readonly: false,
      price: orderPrice,
      tag: stock.zerodhaTradeId,
    };
    if (kiteValidity) baseOrder.validity = kiteValidity;

    if (stock.quantity > 100) {
      baseOrder.readonly = true;
    }
    console.log('[ZerodhaPublisher] final BaseOrder:', JSON.stringify(baseOrder));
    return baseOrder;
  });

    const currentISTDateTime = new Date();

    try {
      // Update the database with the current IST date-time
      await axios.put( `${server.server.baseUrl}api/zerodha/update-trade-reco`, {
        stockDetails: stockDetails,
        leaving_datetime: currentISTDateTime,
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
                          });

      // Generate HTML form content
      const htmlContent =await generateHtmlForm(basket, apiKey);
      if(htmlContent){
        console.log('html content we get--',htmlContent);
        setHtmlContent(htmlContent);
      }
      // Inject the HTML form into WebView
      setWebView(true);
      webViewRef.current.injectJavaScript(`
        document.open();
        document.write(\`${htmlContent}\`);
        document.close();
      `);
    
    } catch (error) {
      console.error("Failed to update trade recommendation:", error);
    }
  };

  useEffect(() => {
    if(htmlContent){
    
      setHtmlContent(htmlContent);
    }
  }, [htmlContent]);

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


  const [zerodhaStockDetails, setZerodhaStockDetails] = useState(null);
  const [zerodhaAdditionalPayload, setZerodhaAdditionalPayload] =
    useState(null);

 

    const fetchData = async () => { 
      try {
        const pendingOrderData = await AsyncStorage.getItem("stockDetailsZerodhaOrder");
        const payloadData = await AsyncStorage.getItem("additionalPayload");
    
        const zerodhaStockDetails = pendingOrderData ? JSON.parse(pendingOrderData) : null;
        const zerodhaAdditionalPayload = payloadData ? JSON.parse(payloadData) : null;
    
        return { zerodhaStockDetails, zerodhaAdditionalPayload };
      } catch (error) {
        console.error("Error fetching data from AsyncStorage:", error);
        return { zerodhaStockDetails: null, zerodhaAdditionalPayload: null };
      }
    };
    

    const checkZerodhaStatus = async () => {
      try {
        const { zerodhaStockDetails, zerodhaAdditionalPayload } = await fetchData();
        const currentISTDateTime = new Date();
        const istDatetime = moment(currentISTDateTime).format();
        
        console.log('hereeeee');
        console.log('Zerodha Stock CheckzerodhaStatus:', zerodhaStockDetails, "and ", zerodhaAdditionalPayload, "jwtToken:", jwtToken);
        
        if (zerodhaStatus === "success" && zerodhaRequestType === "basket") {
          try {
            // Use Publisher flow - call publisher/record-orders endpoint
            // This fetches order book from Zerodha and matches with our trades
            console.log('[ZerodhaPublisher] Recording publisher orders...');

            const recordConfig = {
              method: "post",
              url: `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
              data: JSON.stringify({
                stockDetails: zerodhaStockDetails,
                publisherResults: [{ status: 'success', batchIndex: 0 }],
                userEmail: userEmail,
                broker: 'Zerodha',
                // Include model portfolio info if available
                advisor: Config.REACT_APP_ADVISOR_SPECIFIC_TAG,
              }),
              headers: {
                "Content-Type": "application/json",
                "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                "aq-encrypted-key": generateToken(
                  Config.REACT_APP_AQ_KEYS,
                  Config.REACT_APP_AQ_SECRET
                ),
              },
            };

            // Make the publisher/record-orders API call
            const response = await axios.request(recordConfig);
            console.log('[ZerodhaPublisher] Record orders response:', response.data.response);

            const orderResults = response.data.response || response.data.results || [];

            // Update UI based on response
            setOrderPlacementResponse(orderResults);
            setOpenSucessModal(true);
            setBasketData([]);
            setOpenZerodhaModel(false);
            updatePortfolioData(broker, userEmail);
            await filterCartAfterOrder(),
            eventEmitter.emit('cartUpdated'),
            getCartAllStocks(),
            eventEmitter.emit('OrderPlacedReferesh');
            getAllTrades();
            
            // Make the second API call to update portfolio
            try {
              const portfolioConfig = {
                method: "post",
                url: `${server.ccxtServer.baseUrl}zerodha/user-portfolio`,
                headers: {
                  "Content-Type": "application/json",
                  "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
                  "aq-encrypted-key": generateToken(
                    Config.REACT_APP_AQ_KEYS,
                    Config.REACT_APP_AQ_SECRET
                  ),
                },
                data: JSON.stringify({ user_email: userEmail }),
              };
              
              const portfolioResponse = await axios.request(portfolioConfig);
              console.log("Portfolio updated successfully:", portfolioResponse.data);
              
              // Clean up storage
              await AsyncStorage.removeItem("stockDetailsZerodhaOrder");
              setflag(false);
              
              return portfolioResponse;
            } catch (portfolioError) {
              // Log detailed portfolio update error
              console.error("Error updating portfolio:", portfolioError.response?.data || portfolioError.message);
              // Continue execution even if portfolio update fails
              await AsyncStorage.removeItem("stockDetailsZerodhaOrder");
              setflag(false);
              return response; // Return the original response
            }
          } catch (orderError) {
            // Log detailed order placement error
            console.error("Order placement error:", orderError.response?.data || orderError.message);
            console.error("Status code:", orderError.response?.status || "No status");
            console.error("Full error:", orderError.response);

            // Build synthetic rejected response and show the modal
            const errorMessage =
              orderError.response?.data?.message ||
              orderError.message ||
              'Orders cannot be placed. Please try again later.';
            const { zerodhaStockDetails: savedStockDetails } = await fetchData();
            const syntheticResponse = (savedStockDetails || stockDetails || []).map(stock => ({
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
            setOpenZerodhaModel(false);

            setflag(false);
          }
        } else {
          console.log("Zerodha status conditions not met");
          return null;
        }
      } catch (error) {
        console.error("Error in checkZerodhaStatus:", error);

        // If the modal wasn't already opened by inner catch, show it now
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          'Orders cannot be placed. Please try again later.';
        const syntheticResponse = (stockDetails || []).map(stock => ({
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
        setOpenZerodhaModel(false);

        setflag(false);
      }
    };

  useEffect(() => {
    if (
      zerodhaStatus === "success" &&
      zerodhaRequestType === "basket" &&
      jwtToken !== undefined
    ) {
      checkZerodhaStatus();
    }
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);

  const totalAmount = useTotalAmount(stockDetails);

  const hasZeroQuantity = stockDetails.some((stock) => stock.quantity === 0);
  const [InputFixSizeValue,setInputFixSizeValue]=useState(0);

  const sheet = useRef(null);
  const scrollViewRef = useRef(null);



  const handleClose = () => {
    console.log('here i  am');
    setWebView(false);
  };



  const [totalQuantity, setTotalQuantity] = useState(1);
  const handleIncreaseAllStockQty = () => {
    const newQuantity = totalQuantity + 1;  // Increase total quantity by 1
    setTotalQuantity(newQuantity);  // Update total quantity state
  
    // Update stock quantities to match the total quantity
    const newData = basketData.map((stock) => ({
      ...stock,
      quantity: newQuantity,
    }));
    setBasketData(newData);
  };
  
  const handleDecreaseAllStockQty = () => {
    if (totalQuantity > 0) {
      const newQuantity = totalQuantity - 1;  // Decrease total quantity by 1
      setTotalQuantity(newQuantity);  // Update total quantity state
  
      // Update stock quantities to match the total quantity
      const newData = basketData.map((stock) => ({
        ...stock,
        quantity: newQuantity,
      }));
      setBasketData(newData);
    }
  };
  
  const handleQuantityInputChangeAll = (value) => {
    const newQuantity = parseInt(value) || 0; // If invalid, fallback to 0
    setTotalQuantity(newQuantity);  // Update total quantity state
  
    // Update stock quantities to match the total quantity
    const newData = basketData.map((stock) => ({
      ...stock,
      quantity: newQuantity,
    }));
    setBasketData(newData);
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


    return (

    console.log('current Price:', (getLTPForSymbol(item.tradingSymbol)),item.tradingSymbol),
        <View style={styles.rowContainer}>
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
          <Minus size={12} color="#000" />
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
          <Plus size={12} color="#000" />
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

    </View>
  );
}





if (basketData?.length > 0) {
  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      
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
                source={{
                  html: htmlContentfinal,
                  baseUrl: getPublisherWebViewBaseUrl(configData),
                }}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                onNavigationStateChange={handleWebViewNavigationStateChange}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onError={(e) =>
                  console.error('WebView error:', e.nativeEvent)
                }
              />
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
                  <XIcon style={{alignContent:'center',alignItems:'center',alignSelf:'center'}} size={24} color="#00000033" />
              </TouchableOpacity>
                      <View style={{ borderWidth: 1, borderColor: '#E8E8E8', marginTop: 5 }}></View>
            
                      <View style={styles.tableContainer}>
                
              
                        <FlatList
                        data={basketData}
                        renderItem={renderTradeRow}
                        keyExtractor={(item) => item.tradeId.toString()}
                        ListEmptyComponent={
                          <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
                            <View style={{ borderRadius: 50, backgroundColor: '#EBECEF', padding: 20 }}>
                              <CandlestickChartIcon size={40} color={"black"} />
                            </View>
                            <Text style={{ fontFamily: 'Satoshi-SemiBold', color: 'black', fontSize: 18, marginVertical: 10 }}>
                              No Orders to Place
                            </Text>
                            <Text style={{ fontFamily: 'Satoshi-Medium', color: 'grey' }}>
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
                            onChangeText={(value) => handleQuantityInputChangeAll()}
                     
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
                      borderTopColor: '#e4e4e4',
                      borderTopWidth: 0.5,
                      elevation: 1,
                      backgroundColor: '#fff',
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
      onRequestClose={onClose}
      animationType="slide"
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
               source={{
                 html: htmlContentfinal,
                 baseUrl: getPublisherWebViewBaseUrl(configData),
               }}
               onLoadStart={() => setIsLoading(true)}
               onLoadEnd={() => setIsLoading(false)}
               onNavigationStateChange={handleWebViewNavigationStateChange}
               javaScriptEnabled={true}
               domStorageEnabled={true}
               onError={(e) => console.error('WebView error:', e.nativeEvent)}
             />
           </View>
          ) : (
            <View style={[styles.modalContainer, { width: width * 1 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20,alignContent:'center',alignItems:'center',paddingVertical:10 }}>
                <Text style={styles.modalHeader1}>Zerodha Review Trade Details</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <XIcon style={{alignContent:'center',alignItems:'center',alignSelf:'center'}} size={24} color="#00000033" />
                </TouchableOpacity>
              </View>
  
         <View style={{ borderWidth: 0.4, borderColor: '#e4e4e4', marginTop: 5 }}/>
  
              <FlatList
                data={stockDetails}
                renderItem={renderItem}
                keyExtractor={(item) => item.tradeId.toString()}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
                    <View style={{ borderRadius: 50, backgroundColor: '#EBECEF', padding: 20 }}>
                      <CandlestickChartIcon size={40} color={"black"} />
                    </View>
                    <Text style={{ fontFamily: 'Poppins-SemiBold', color: 'black', fontSize: 18, marginVertical: 10 }}>
                      No Orders to Place
                    </Text>
                    <Text style={{ fontFamily: 'Poppins-Medium', color: 'grey' }}>
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
                          borderColor: '#ccc',
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
  
              <View style={{ paddingVertical: 0, borderTopColor: '#e4e4e4', borderTopWidth: 0.5, elevation: 1, backgroundColor: '#fff' }}>
              <GestureHandlerRootView style={{ flex: 0 }}>
<View style={{paddingVertical:5,paddingHorizontal:10,borderTopColor:'#e4e4e4',borderTopWidth:0.5,elevation:1,backgroundColor:'#fff'}}>
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
                    color="#ffffff"
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
    color: '#0d0c22',
    fontSize: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9e8e8',
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
    borderColor:'#000',
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
    color: '#fff',
    fontFamily:'Satoshi-Regular',
    paddingHorizontal:8,
    paddingVertical:1,
    backgroundColor:'#12D06C',
    alignSelf: 'flex-start',

    borderRadius:15,
 
  },
  sellOrder: {
    color: '#fff',
    fontFamily:'Satoshi-Regular',
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
    fontFamily: 'Satoshi-Bold',
  },
  cellText: {
    alignContent:'center',
    color: 'black',
    fontSize:10,
    fontFamily: 'Satoshi-Medium',
  },
  cellTextmktprice: {
    alignSelf: 'center',
    color: 'black',
    fontFamily: 'Satoshi-Regular',
  },
  quantityInput: {
    height:15,
    padding: 0,
    maxWidth:'30%',
    color: '#0d0c22',
    marginHorizontal:5,
    fontSize: 12,
    paddingHorizontal:0,
    fontFamily:'Satoshi-Bold',
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
    color: '#0d0c22',
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9e8e8',
    borderRadius: 7,
  },
  modalContainer: {
    backgroundColor:'#FFFEF7',
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
    fontFamily: 'Satoshi-Bold',
    alignSelf: 'flex-start',
    color: 'black',
  },
  orderButton: {
    backgroundColor: '#000',
    paddingVertical: 15,
    marginHorizontal: 0,
    borderRadius: 10,
    alignItems: 'center',
  },
  orderButtonText: {
    color: '#fff',
    fontFamily: 'Satoshi-Medium',
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
    borderColor: '#E8E8E8',
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
    fontFamily:'Satoshi-Bold',
    color: 'black',
  },
  tableContainer: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 5,
    paddingHorizontal: 5,
    marginBottom: 5,
  },
  tableHeaderText: {
    fontSize: 13,
    color: '#000000',
    fontFamily:'Satoshi-Bold',
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent:'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableCell: {

  },
  stockSymbol: {
    fontSize: 14,
    color: '#000000',
    fontFamily:'Satoshi-Medium',
  },
  tradeType: {
    marginTop: 5,
    fontSize: 12,
  },
  sell: {
    fontFamily:'Satoshi-Bold',
    color: '#EA2D3F',
  },
  buy: {
    fontFamily:'Satoshi-Bold',
    color: '#16A085',
  },
  price: {
    fontSize: 13,
    color: '#000000',
  },
  quantity: {
    fontSize: 15,
    color: '#000000',
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
    color: '#000000',
  },
  multiplierControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  button: {
    width: 30,
    height: 30,
    backgroundColor: '#e9e9e9',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiplierInput: {
    width: 60,
    height: 25,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  note: {
    fontSize: 12,
    color: '#888',
    marginTop: 10,
  },
  fundInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  fundLabel: {
    fontSize: 12,
    color: '#000000',
  },
  fundAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeOrderButton: {
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ReviewZerodhaTradeModal;