import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import IgnoreStockCard from '../../components/IgnoreStockCard';
import Toast from 'react-native-toast-message';
import {ChevronLeft} from 'lucide-react-native';
import CustomToolbar from '../../components/CustomToolbar';
import MPCard from '../../components/ModelPortfolioComponents/MPCard';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import { validateStockExchanges } from '../../utils/brokerPublisher';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import EmptyMP from '../../assets/emptyModelPortfolio.svg';
import {Alert} from 'react-native';
import StockAdvices from '../../components/AdviceScreenComponents/StockAdvices';

import CryptoJS from 'react-native-crypto-js';

import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import eventEmitter from '../../components/EventEmitter';
import {useModal} from '../../components/ModalContext';
import {useCart} from '../../components/CartContext';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
const {width: SCREEN_WIDTH} = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375; // Assuming the design is based on a 375px wide screen (iPhone X)
const responsiveFontSize = fontSize => Math.round(fontSize * scale);

const IgnoreTradesScreen = () => {
  const {configData} = useTrade();
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user && user.email;

  const {showAddToCartModal} = useModal();
  const {setCartCount} = useCart();

  const [ignoredTrades, setIgnoredTrades] = useState([]);
  const [ignoreTradesLoading, setIgnoreTradesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  const [loading, setLoading] = useState(false);
  const [stockRecoNotExecuted, setStockRecoNotExecuted] = useState([]);
  const [isModalVisible, setModalVisible] = useState(false);
  const [stockIgnoreId, setStockIgnoreId] = useState(null);
  const [broker, setBroker] = useState();
  const [brokerModel, setBrokerModel] = useState(null);
  const [brokerStatus, setBrokerStatus] = useState();

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

  // Ensure initial value is false

  const [stockDetails, setStockDetails] = useState([]);
  const [recommendationStock, setrecommendationStock] = useState([]);
  const [isDatafetching, setisDatafetching] = useState(true);

  // Format the moment object as desired

  const today = new Date();
  const todayDate = moment(today).format('YYYY-MM-DD HH:mm:ss');

  useEffect(() => {
    getAllTrades();

    getCartAllStocks();
  }, [userEmail]);

  // User Details-
  const [userDetails, setUserDetails] = useState();
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

  const [authToken, setAuthToken] = useState(null);

  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  // icici
  const [apiSession, setApiSession] = useState(null);
  // upstox code
  const [upstoxCode, setUpstoxCode] = useState(null);

  // const zerodha Login
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState(null);
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);

  const zerodhaApiKey = Config.REACT_APP_ZERODHA_API_KEY;

  const checkValidApiAnSecret = data => {
    if (!data) return null;
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };
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
        setBroker(res.data.User.user_broker);

        setBrokerStatus(res.data.connect_broker_status);
      })
      .catch(err => console.log(err));
  };
  // zerodha start
  const [zerodhaAccessToken, setZerodhaAccessToken] = useState(null);
  const hasConnectedZerodha = useRef(false);
  const connectZerodha = () => {
    if (zerodhaRequestToken !== null && !hasConnectedZerodha.current) {
      let data = JSON.stringify({
        user_email: userEmail,
        apiKey: 'b0g1r806oitsamoe',
        apiSecret: 'u4lw9zhl3iqafay2s6salc800bs8pzjd',
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

  useEffect(() => {
    if (zerodhaRequestToken && zerodhaRequestType === 'login') {
      connectZerodha();
    }
  }, [zerodhaRequestToken, zerodhaRequestType, userDetails]);

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
            apiKey: configData?.config?.REACT_APP_ANGEL_ONE_API_KEY,
            ddpi_status: userDetails?.ddpi_status || 'empty', // Required for DB persistence
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

  useEffect(() => {
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

  const [funds, setFunds] = useState({});
  const [orderPlacementResponse, setOrderPlacementResponse] = useState();
  const [openSuccessModal, setOpenSucessModal] = useState(false);

  const updatePortfolioData = () => {
    if (broker === 'IIFL Securities') {
      let data = JSON.stringify({
        user_email: userEmail,
      });
      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}iifl/user-portfolio`,

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
        .then(response => {})
        .catch(error => {
          console.log(error);
        });
    } else if (broker === 'Kotak') {
      let data = JSON.stringify({
        user_email: userEmail,
      });

      let config = {
        method: 'post',

        url: `${server.ccxtServer.baseUrl}kotak/user-portfolio`,

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
        .then(response => {})
        .catch(error => {
          console.log(error);
        });
    } else if (broker === 'Upstox') {
      let data = JSON.stringify({
        user_email: userEmail,
      });

      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}upstox/user-portfolio`,

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
        .then(response => {})
        .catch(error => {
          console.log(error);
        });
    } else if (broker === 'ICICI Direct') {
      let data = JSON.stringify({
        user_email: userEmail,
      });

      let config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}icici/user-portfolio`,

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
        .then(response => {})
        .catch(error => {
          console.log(error);
        });
    } else if (broker === 'Angel One') {
      let data = JSON.stringify({
        user_email: userEmail,
      });

      let config = {
        method: 'post',

        url: `${server.ccxtServer.baseUrl}user-portfolio`,

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
        .then(response => {})
        .catch(error => {
          console.log(error);
        });
    }
  };

  const placeOrder = () => {
    setLoading(true);
    // Prepare the payload based on broker
    const getOrderPayload = () => {
      const basePayload = {
        trades: stockDetails,
        user_broker: broker, // Add user_broker to identify the broker
        user_email: userEmail,
      };

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
        default:
          return {
            ...basePayload,
            apiKey,
            jwtToken,
          };
      }
    };

    const orderConfig = {
      method: 'post',
      url: `${server.server.baseUrl}api/process-trades/order-place`, // Single unified endpoint

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },

      data: JSON.stringify(getOrderPayload()),
    };

    // Make the API call
    axios
      .request(orderConfig)
      .then(response => {
        setOrderPlacementResponse(response.data.response);

        setOpenSucessModal(true);
        setLoading(false);
        setOpenReviewTrade(false);

        // Update all necessary data
        getAllTrades();
        updatePortfolioData();
        getCartAllStocks();
      })
      .catch(error => {
        console.error('Error placing order:', error);
        setLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Failed',
          text2:
            'There was an issue in placing the trade, please try again after sometime or contact your advisor',
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
  };

  const [ltp, setLtp] = useState([]);
  // const socketRef = useRef(null);
  // const subscribedSymbolsRef = useRef(new Set());
  // const failedSubscriptionsRef = useRef({});
  // let dataArray = [];
  // // WebSocket connection for market data
  // useEffect(() => {
  //   socketRef.current = io("wss://ccxt.alphaquark-case.com", {
  //     transports: ["websocket"],
  //     query: { EIO: "4" },
  //   });

  //   const handleMarketData = (data) => {
  //     setLtp((prev) => {
  //       const index = prev.findIndex(
  //         (item) => item.tradingSymbol === data.stockSymbol
  //       );

  //       if (index !== -1) {
  //         const existingItem = prev[index];

  //         // Update state only if the price has changed
  //         if (existingItem.lastPrice !== data.last_traded_price) {
  //           const newLtp = [...prev];
  //           newLtp[index] = {
  //             ...existingItem,
  //             lastPrice: data.last_traded_price,
  //           };
  //           return newLtp;
  //         } else {
  //           return prev; // No change, return previous state
  //         }
  //       } else {
  //         // Add new stock price if not present in the state
  //         return [
  //           ...prev,
  //           {
  //             tradingSymbol: data.stockSymbol,
  //             lastPrice: data.last_traded_price,
  //           },
  //         ];
  //       }
  //     });
  //   };

  //   socketRef.current.on("market_data", handleMarketData);

  //   return () => {
  //     if (socketRef.current) {
  //       socketRef.current.off("market_data", handleMarketData);
  //       socketRef.current.disconnect();
  //     }
  //   };
  // }, []);

  // // Subscribe to symbols via API
  // const getCurrentPrice = useCallback(() => {
  //   if (!dataArray || dataArray.length === 0) return;

  //   const symbolsToSubscribe = dataArray.filter(
  //     (trade) =>
  //       !subscribedSymbolsRef.current.has(trade.symbol) &&
  //       (!failedSubscriptionsRef.current[trade.symbol] ||
  //         failedSubscriptionsRef.current[trade.symbol] < 3)
  //   );

  //   symbolsToSubscribe.forEach((trade) => {
  //     const data = { symbol: trade.symbol, exchange: trade.exchange };

  //     axios
  //       .post("https://ccxt.alphaquark-case.com/websocket/subscribe", data)
  //       .then(() => {
  //         subscribedSymbolsRef.current.add(trade.symbol);
  //         delete failedSubscriptionsRef.current[trade.symbol];
  //       })
  //       .catch((error) => {
  //         console.error(`Error subscribing to ${trade.symbol}:`, error);
  //         failedSubscriptionsRef.current[trade.symbol] =
  //           (failedSubscriptionsRef.current[trade.symbol] || 0) + 1;
  //       });
  //   });
  // }, [dataArray]);

  // // Fetch current price when dataArray changes
  // useEffect(() => {
  //   if (dataArray && dataArray.length > 0) {
  //     getCurrentPrice();
  //   }
  // }, [dataArray, getCurrentPrice]);

  // // Utility to get the last traded price for a symbol

  // const getLTPForSymbol = useCallback(
  //   (symbol) => {
  //     const ltpItem = ltp.find((item) => item.tradingSymbol === symbol);
  //     return ltpItem ? ltpItem.lastPrice : null;
  //   },
  //   [ltp]
  // );

  const appURL = 'test';
  // zerodha start
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(null); // Track success status
  const [mbasket, setmbasket] = useState(null);

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

  const handlefinal = async () => {
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
      return;
    }

    try {
      // Store stockDetails in AsyncStorage (similar to localStorage)
      await AsyncStorage.setItem(
        'stockDetailsZerodhaOrder',
        JSON.stringify(stockDetails),
      );

      const basket = stockDetails.map(stock => {
        // Get LTP for price calculation (default to 0 if not available)
        const ltp = 0;
        let orderPrice = 0;

        if (stock.orderType === 'LIMIT') {
          orderPrice = stock.limitPrice || parseFloat(stock.price) || 0;
        } else if (stock.orderType === 'MARKET' || stock.orderType === 'SL') {
          orderPrice = ltp !== '-' ? parseFloat(ltp) : 0;
        }

        let baseOrder = {
          variety: 'regular',
          tradingsymbol: stock.tradingSymbol,
          // exchange is guaranteed non-empty by validateStockExchanges() above
          exchange: stock.exchange,
          transaction_type: (stock.transactionType || 'BUY').toUpperCase(),
          order_type: mapKiteOrderType(stock.orderType),
          quantity: parseInt(stock.quantity, 10) || 1,
          product: mapKiteProductType(stock.productType),
          readonly: false,
          price: orderPrice,
        };

        if (stock.quantity > 100) {
          baseOrder.readonly = true;
        }

        console.log('[ZerodhaPublisher] Basket item:', JSON.stringify(baseOrder));

        return baseOrder;
      });

      // Send data to the server (for updating the trade recommendation)
      const currentISTDateTime = new Date();
      await axios.put(
        `${server.server.baseUrl}api/zerodha/update-trade-reco`,
        {
          stockDetails: stockDetails,
          leaving_datetime: currentISTDateTime,
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

      // Prepare the redirect URL with the required parameters
      const redirectUrl = `https://kite.zerodha.com/connect/basket?api_key=${zerodhaApiKey}&data=${encodeURIComponent(
        JSON.stringify(basket),
      )}&redirect_params=${encodeURIComponent(`${appURL}=true`)}`;

      return redirectUrl; // This URL will be loaded in the WebView
    } catch (error) {
      console.error('Error handling Zerodha redirect:', error);
      Alert.alert('Error', 'Failed to initiate trade.');
    }
  };

  const [url, setUrl] = useState('');

  const handleZerodhaRedirect = async () => {
    try {
      const redirectUrl = await handlefinal(); // Wait for the redirect URL
      setUrl(redirectUrl); // Set the URL for the WebView
      console.log('url', redirectUrl); // Log the URL
    } catch (error) {
      console.error('Error fetching redirect URL:', error);
    }
  };

  useEffect(() => {
    handleZerodhaRedirect(); // Call the function when the component mounts
  }, []);

  const [zerodhaStockDetails, setZerodhaStockDetails] = useState(null);
  const [zerodhaAdditionalPayload, setZerodhaAdditionalPayload] =
    useState(null);
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

  useEffect(() => {
    if (
      zerodhaStatus !== null &&
      zerodhaRequestType === 'basket' &&
      jwtToken !== undefined
    ) {
      checkZerodhaStatus();
    }
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);

  // const calculateTotalAmount = () => {
  //   let totalAmount = 0;
  //   stockDetails.forEach((ele) => {
  //     if (ele.transactionType === "BUY") {
  //       const ltp = getLTPForSymbol(ele.tradingSymbol); // Get LTP for current symbol
  //       if (ltp !== "-") {
  //         totalAmount += parseFloat(ltp) * ele.quantity; // Calculate total amount for this trade
  //       }
  //     }
  //   });
  //   return totalAmount.toFixed(2); // Return total amount formatted to 2 decimal places
  // };

  const [isBrokerConnected, setIsBrokerConnected] = useState(false);

  const [brokername, setBrokerName] = useState('');
  const [createdDate, setcreateDate] = useState('');

  const fetchBrokerStatusModal = async () => {
    getAllFunds();
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
        setBrokerName(userData.user_broker);
        setcreateDate(userData.created_at);
        setIsBrokerConnected(!!userData?.user_broker);
        // console.log('corrected');
      } catch (error) {
        //   console.error('Error fetching broker status:', error.response?.data || error.message);
        setIsBrokerConnected(false); // Handle error by setting default status
      } finally {
        setLoading(false);
      }
    }
  };

  const getAllFunds = () => {
    if (broker === 'IIFL Securities') {
      if (clientCode) {
        let data = JSON.stringify({
          clientCode: clientCode,
        });
        let config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}iifl/margin`,

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
            setFunds(response.data.data);
          })
          .catch(error => {
            // console.log(error);
          });
      }
    } else if (broker === 'ICICI Direct') {
      if (apiKey && jwtToken && secretKey) {
        let data = JSON.stringify({
          apiKey: checkValidApiAnSecret(apiKey),
          sessionToken: jwtToken,
          secretKey: checkValidApiAnSecret(secretKey),
        });
        let config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}icici/funds`,

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
            setFunds(response.data.data);
          })
          .catch(error => {
            console.log(error);
          });
      }
    } else if (broker === 'Upstox') {
      if (apiKey && jwtToken && secretKey) {
        let data = JSON.stringify({
          apiKey: checkValidApiAnSecret(apiKey),
          accessToken: jwtToken,
          apiSecret: checkValidApiAnSecret(secretKey),
        });
        let config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}upstox/funds`,

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
            setFunds(response.data.data);
          })
          .catch(error => {
            console.log(error);
          });
      }
    } else if (broker === 'Angel One') {
      if (apiKey && jwtToken) {
        let data = JSON.stringify({
          apiKey: apiKey,
          jwtToken: jwtToken,
        });
        let config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}funds`,

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
            setFunds(response.data.data);
          })
          .catch(error => {
            console.log(error);
          });
      }
    } else if (broker === 'Zerodha') {
      if (jwtToken) {
        let data = JSON.stringify({
          apiKey: 'b0g1r806oitsamoe',
          accessToken: jwtToken,
        });
        let config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}zerodha/funds`,

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
            setFunds(response.data.data);
          })
          .catch(error => {
            console.log(error);
          });
      }
    } else if (broker === 'Kotak') {
      if (jwtToken) {
        // Kotak NEO UUID flow (2026-04-22) — no consumer secret.
        let data = JSON.stringify({
          consumerKey: checkValidApiAnSecret(apiKey),
          accessToken: jwtToken,
          viewToken: viewToken,
          exchange: 'NSE',
          segment: 'CASH',
          product: 'ALL',
          sid: sid,
          serverId: serverId,
        });
        let config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}kotak/funds`,

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
            // console.log("res", response);
            setFunds(response.data.data);
          })
          .catch(error => {
            console.log(error);
          });
      }
    }
  };

  useEffect(() => {
    getUserDeatils();
  }, [userEmail, server.baseUrl]);
  const [selectedLength, setSelectedLength] = useState();
  const [singleStockSelectState, setSingleStockSelectState] = useState(false);
  const [lengthstock, setlengthstock] = useState(1);

  // const getCartAllStocks = () => {
  //   let config = {
  //     method: "get",
  //     url: `${server.server.baseUrl}api/cart/${userEmail}?trade_place_status=recommend`,
  //   };

  //   axios
  //     .request(config)
  //     .then((response) => {
  //       const transformedStockDetails = response?.data?.map((stock) => ({
  //         user_email: stock.user_email,
  //         trade_given_by: stock.trade_given_by,
  //         tradingSymbol: stock.Symbol,
  //         transactionType: stock.Type,
  //         exchange: stock.Exchange,
  //         segment: stock.Segment,
  //         productType: stock.ProductType,
  //         orderType: stock.OrderType,
  //         price: stock.Price,
  //         quantity: stock.Quantity,
  //         priority: stock.Priority,
  //         tradeId: stock.tradeId,
  //         user_broker: broker, // Assuming you want to set this from the existing context
  //       }));

  //       setStockDetails(transformedStockDetails);
  //       setSelectedLength(transformedStockDetails.length);
  //       setCartCount(transformedStockDetails.length);
  //     })
  //     .catch((error) => {
  //       console.log("errpr",error);
  //     });
  // };
  // useEffect(() => {
  //   getCartAllStocks();
  // }, [setCartCount]);

  const handleQuantityInputChange = (symbol, value, tradeId) => {
    if (!value || value === '') {
      const newData = stockRecoNotExecuted.map(stock =>
        stock.Symbol === symbol && stock.tradeId === tradeId
          ? {...stock, Quantity: ''}
          : stock,
      );
      setStockRecoNotExecuted(newData);
    } else {
      const newData = stockRecoNotExecuted.map(stock =>
        stock.Symbol === symbol && stock.tradeId === tradeId
          ? {...stock, Quantity: parseInt(value)}
          : stock,
      );
      setIgnoredTrades(newData);
    }
  };

  const handleLimitOrderInputChange = (symbol, value, tradeId) => {
    if (!value || value === '') {
      const newData = ignoredTrades.map(stock =>
        stock.Symbol === symbol && stock.tradeId === tradeId
          ? {...stock, Price: ''}
          : stock,
      );
      setIgnoredTrades(newData);
    } else {
      const newData = stockRecoNotExecuted.map(stock =>
        stock.Symbol === symbol && stock.tradeId === tradeId
          ? {...stock, Price: parseInt(value)}
          : stock,
      );
      setIgnoredTrades(newData);
    }
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
            productType: stock.ProductType,
            orderType: stock.OrderType,
            price: stock.Price,
            quantity: stock.Quantity,
            priority: stock.Priority,
            tradeId: stock.tradeId,
            user_broker: broker,
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
        // Optionally, update the state to reflect the changes in the UI
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
    const newData = ignoredTrades.map(stock =>
      stock.Symbol === symbol && stock.tradeId === tradeId
        ? {...stock, Quantity: stock.Quantity + 1}
        : stock,
    );
    setIgnoredTrades(newData);
  };

  const handleDecreaseStockQty = (symbol, tradeId) => {
    const newData = ignoredTrades.map(stock =>
      stock.Symbol === symbol && stock.tradeId === tradeId
        ? {...stock, Quantity: Math.max(stock.Quantity - 1, 0)}
        : stock,
    );
    setIgnoredTrades(newData);
  };

  const handleTradeNow = () => {
    console.log('trades presssss');
    setOpenReviewTrade(true); // Set the state to open the modal
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const showToast = (message1, type, message2) => {
    Toast.show({
      type: type,
      text2: message2 + ' ' + message1,
      //position:'bottom',
      position: 'bottom', // Duration the toast is visible
      text1Style: {
        color: 'black',
        fontSize: 11,
        fontWeight: 0,
        fontFamily: 'Poppins-Medium', // Customize your font
      },
      text2Style: {
        color: 'black',
        fontSize: 12,
        fontFamily: 'Poppins-Regular', // Customize your font
      },
    });
  };

  const IsMarketHours = () => {
    // Get the current time in IST and format it
    const currentTimeIST = moment()
      .utcOffset('+05:30')
      .format('DD-MM-YYYY HH:mm:ss');

    // Define the cutoff time of 3:15 PM in IST and format it
    const endTimeIST = moment()
      .utcOffset('+05:30')
      .set({hour: 15, minute: 30, second: 0, millisecond: 0})
      .format('DD-MM-YYYY HH:mm:ss');

    // Define the cutoff time of 3:15 PM in IST and format it
    const startTimeIST = moment()
      .utcOffset('+05:30')
      .set({hour: 9, minute: 15, second: 0, millisecond: 0})
      .format('DD-MM-YYYY HH:mm:ss');

    // Compare current time with the cutoff time
    if (
      moment(currentTimeIST, 'DD-MM-YYYY HH:mm:ss').isAfter(
        moment(startTimeIST, 'DD-MM-YYYY HH:mm:ss'),
      ) &&
      moment(currentTimeIST, 'DD-MM-YYYY HH:mm:ss').isBefore(
        moment(endTimeIST, 'DD-MM-YYYY HH:mm:ss'),
      )
    ) {
      return true;
    }

    return false;
  };

  // Helper function to get the cart items from AsyncStorage
  const getCartAllStocks = async () => {
    const cartData = await AsyncStorage.getItem('cartItems');
    return cartData ? JSON.parse(cartData) : [];
  };
  const handleexpire = () => {
    setOpenTokenExpireModel(true);
  };
  const openBrokerSelectionModal = () => {
    setModalVisible1(true);
  };

  useEffect(() => {
    const openExpireModelListener = ({isOpen}) => {
      handleexpire();
      // Update the state to open the modal
    };
    // Listen to the 'openExpireModel' event
    eventEmitter.on('openExpireModel', openExpireModelListener);
    // Cleanup the listener when the component unmounts
    return () => {
      eventEmitter.off('openExpireModel', openExpireModelListener);
    };
  }, []);

  useEffect(() => {
    console.log('Listener registered for openBrokerConnect');
    const openBrokerConnectModelListener = ({isOpen2}) => {
      console.log('Open Broker Selection event caught:', isOpen2);
      openBrokerSelectionModal();
    };

    eventEmitter.on('openBrokerConnect', openBrokerConnectModelListener);

    return () => {
      console.log('Listener removed for openBrokerConnect');
      eventEmitter.off('openBrokerConnect', openBrokerConnectModelListener);
    };
  }, []);

  const [tradeitems, settradeitems] = useState([]);
  const cartItemsKey = 'cartItems';

  const [modalVisible, setModalVisible1] = useState(false);

  // Trades---
  const handleTrade = () => {
    // console.log('HIIiiiiiiiiiiiiii',broker);

    if (broker === 'Zerodha') {
      setOpenZerodhaModel(true); // Open the Zerodha modal only when broker is Zerodha and trade button is pressed
    } else {
      if (brokerStatus === null) {
        setBrokerModel(true);
      } else {
        setOpenReviewTrade(true);
      }
    }
  };

  const [isRebalModalVisible, setRebalModalVisible] = useState(false);

  const openRebalModal = () => {
    setRebalModalVisible(true);
  };

  const closeRebalModal = () => {
    setRebalModalVisible(false);
  };

  const getUserDetails = () => {
    axios
      .get(`${server.baseUrl}api/user/getUser/${userEmail}`)
      .then(res => setUserDetails(res.data.User))
      .catch(err => console.log(err));
  };

  const getAllTrades = () => {
    let config = {
      method: 'get',
      url: `${server.server.baseUrl}api/user/trade-reco-for-user?user_email=${userEmail}`,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    };

    axios
      .request(config)
      .then(response => {
        // Filter trades with the ignored status
        const filteredTrades = response?.data?.trades.filter(
          trade => trade.trade_place_status === 'ignored',
        );
        console.log('Ignored trades:', filteredTrades);

        // Map the filtered trades to the newStock format
        const mappedStockDetails = filteredTrades.map(trade => ({
          user_email: trade.user_email,
          trade_given_by: trade.trade_given_by,
          tradingSymbol: trade.Symbol,
          transactionType: trade.Type,
          exchange: trade.Exchange,
          segment: trade.Segment,
          productType: trade.ProductType,
          orderType: trade.OrderType,
          price: trade.Price,
          quantity: trade.Quantity,
          priority: trade.Priority || 1,
          tradeId: trade._id,
          user_broker: broker, // Assuming broker is defined in the parent scope
        }));

        // Set state for ignored trades and stock details
        setIgnoredTrades(filteredTrades);
        setStockDetails(mappedStockDetails);

        console.log('Mapped Stock Details:', mappedStockDetails);
      })
      .catch(error => console.log(error));
  };

  const renderModelPortfolio = () => (
    <View style={styles.emptyContainer}>
      <EmptyMP />
      <Text style={styles.noDataText}>No Ignored Trades</Text>
      <Text style={styles.noDataSubtitle}>
        Explore our curated Model Portfolios and start investing today!
      </Text>
    </View>
  );

  const [openReviewTrade, setOpenReviewTrade] = useState(false);
  const [openZerodhaReviewModal, setOpenZerodhaModel] = useState(false);
  const [openIIFLReviewModal, setOpenIIFLReviewModel] = useState(false);

  const handleIgnoredTrades = id => {
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
          text2Style: {fontFamily: 'Poppins-Medium', fontSize: 12},
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

  const onRefresh = () => {
    setRefreshing(true);
    getAllTrades();
    setRefreshing(false);
  };

  useEffect(() => {
    getUserDetails();
    getAllTrades();
  }, []);

  return (
    <View style={{backgroundColor: '#F9F9F9', flex: 1}}>
      <View
        style={{
          flexDirection: 'row',
          alignContent: 'center',
          alignItems: 'center',
          padding: 20,
          backgroundColor: 'white',
          borderBottomWidth: 0.5,
          borderBottomColor: '#DEECE9',
        }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft
            style={{
              marginRight: 10,
              alignContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
              marginTop: 3,
            }}
            size={20}
            color={'black'}
          />
        </TouchableOpacity>

        <Text
          style={{fontFamily: 'Satoshi-Bold', fontSize: 20, color: 'black'}}>
          Ignored Trades
        </Text>
      </View>
      <StockAdvices userEmail={userEmail} type={'Ignore'} />
    </View>
  );
};
const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: responsiveFontSize(22),
    color: 'black',
    paddingHorizontal: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 20,
  },
  noDataImage: {
    width: 150,
    height: 150,
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 18,
    marginTop: 40,
    fontFamily: 'Satoshi-Bold',
    color: '#000000',
  },
  noDataSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Satoshi-Medium',
    textAlign: 'center',
    marginVertical: 8,
    marginHorizontal: 10,
  },
});

export default IgnoreTradesScreen;
