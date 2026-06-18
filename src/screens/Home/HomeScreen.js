'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  Text,
  RefreshControl,
  BackHandler,
  SafeAreaView,
  Dimensions,
  Platform,
  PermissionsAndroid,
  FlatList,
  Image,
  Modal,
} from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import YoutubePlayer from 'react-native-youtube-iframe';
import Toast from 'react-native-toast-message';
import RNFS from 'react-native-fs';
import { decode as atob } from 'base-64';

import EducationalBlogs from '../../components/HomeScreenComponents/EducationalBlogs';
import EducationalVideos from '../../components/HomeScreenComponents/EducationalVideos';
import EducationalPDF from '../../components/HomeScreenComponents/EducationalPDF';

import StockAdvices from '../../components/AdviceScreenComponents/StockAdvices';
import Config from '../../utils/safeConfig';
import {
  ArrowLeft,
  Clock,
  Download,
  XIcon,
  BookOpen,
  Video,
  FileText,
} from 'lucide-react-native';
import RebalanceAdvices from '../../components/AdviceScreenComponents/RebalanceAdvices';
import useHomeScreenTabs from './hooks/useHomeScreenTabs';
import useHomeScreenModals from './hooks/useHomeScreenModals';
import useHomeMarketSummary from './hooks/useHomeMarketSummary';
import useHomePlanSummary from './hooks/useHomePlanSummary';
import { useComponent } from '../../design/useDesign';
// styles import retained — allTabData JSX subtrees reference styles from the
// container's scope (e.g. styles.StockTitle for section headers). The
// presentation imports the same styles file independently.
import styles from './HomeScreen.styles';
import messaging from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  AndroidStyle,
} from '@notifee/react-native';
import WebinarReminderHandler from '../../FunctionCall/services/WebinarReminderHandler';
import { ActivityIndicator } from 'react-native';

import server from '../../utils/serverConfig';
import axios from 'axios';

import { useSocialProof } from '../../components/SocialProofProvider';
import { useTrade } from '../TradeContext';
import { generateToken } from '../../utils/SecurityTokenManager';
import { useConfig } from '../../context/ConfigContext';
import { getAdvisorSubdomain } from '../../utils/variantHelper';
import APP_VARIANTS from '../../utils/Config';
import Icon1 from 'react-native-vector-icons/Fontisto';
import moment from 'moment';

import BestPerformerSection from '../../components/HomeScreenComponents/BestPerformerSection';
import LinkOpeningWeb from '../../screens/Home/NewsScreen/LinkOpeningWeb';
import AllPlanDetails from '../../components/HomeScreenComponents/AllPlansDetails';
import TradingViewTicker from '../../components/AdviceScreenComponents/DynamicText/TickerTape';
import AlphaQuarkBanner from '../../components/HomeScreenComponents/AlphaQuarkBanner';
import KnowledgeHub from '../../components/HomeScreenComponents/KnowledgeHub';
import ModelPortfolioScreen from '../Drawer/ModelPortfolioScreen';
import UpdateAppModal, {checkForAppUpdate} from '../../UpdateAppModal';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';

const pdfcicon = require('../../assets/pdf.png');

// Ethical List Configuration (parity with web)
const ETHICAL_CONFIG = {
  apiEndpoint:
    'https://opensheet.elk.sh/1CQsxO-jsel1YMAxzF-YXN8NmjNgLHrvN3DVTuL3ifVw/Sheet1',
  buttonText: '🕌 Halal Stocks List',
  modalTitle: 'Halal Stock List',
  searchPlaceholder: 'Search stocks...',
  columns: {
    srNo: 'Sr. No.',
    stockName: 'Stock Name',
    ticker: 'Ticker',
  },
};

const HomeScreen = ({ }) => {
  const {
    stockRecoNotExecutedfinal,
    recommendationStockfinal,
    isDatafetching,
    getModelPortfolioStrategyDetails,
    getAllTrades,
    modelPortfolioStrategyfinal,
    rejectedTrades,
    ignoredTrades,
    getUserDeatils,
    broker,
    funds,
    getAllFunds,
    isDatafetchinMP,
    getAllBestPerformers,
    fetchVideos,
    fetchPdf,
    fetchBlogs,
    pdf,
    blogs,
    videos,
    planList,
    configData,
    userDetails,
    modelPortfolioRepairTrades,
  } = useTrade();
  // console.log('configData', configData);

  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const mainColor = config?.mainColor || '#0056B7';
  const secondaryColor = config?.secondaryColor || '#F0F0F0';
  const gradient1 = config?.gradient1 || '#0056B7';
  const gradient2 = config?.gradient2 || '#002651';

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;
  // Resolve a displayable user name (alphanomy variant uses this for the
  // header greeting). Backend-stored `userDetails.name` is preferred (full
  // legal name); Firebase `user.displayName` is the fallback (Google /
  // Apple sign-in surface). Email-derived first-name remains the final
  // fallback, handled inside the variant presentation.
  const userName = userDetails?.name || user?.displayName || '';
  const [isLoading, setIsLoading] = useState(true);
  // Phase E prep (2026-05-01): tab + 7-overlay state consolidated behind a
  // single hook with backward-compat boolean shims; modal visibility
  // collapsed from 4 useState declarations into useHomeScreenModals. See
  // src/screens/Home/hooks/* — call sites unchanged.
  const {
    selectedTab,
    setSelectedTab,
    seeAllBespoke,
    setSeeAllBespoke,
    seeAllBespokeplan,
    setSeeAllBespokeplan,
    seeAllMP,
    setSeeAllMP,
    seeAllMPplan,
    setSeeAllMPplan,
    seeAllBlogs,
    setSeeAllBlogs,
    seeAllVideos,
    setSeeAllVideos,
    seeAllPDFs,
    setSeeAllPDFs,
  } = useHomeScreenTabs();
  const {
    showEthicalList,
    setShowEthicalList,
    showUpdateModal,
    setShowUpdateModal,
    videoModalVisible,
    setVideoModalVisible,
    pdfModalVisible,
    setPdfModalVisible,
  } = useHomeScreenModals();
  // Cache to store which tab has loaded data
  const isDataLoaded = useRef({ All: false, Bespoke: false, Rebalance: false });
  let c = 0;
  const onRenderCallback = (id, phase, actualDuration) => {
    c = c + 1;
    // console.log('count --->',c);
    //  console.log(`${id} [${phase}] rendered in ${actualDuration} ms`);
  };

  const animation = useRef(new Animated.Value(0)).current;

  // modelPortfolioRepairTrades is sourced from TradeContext (auto-fetched
  // alongside getModelPortfolioStrategyDetails). The previous local useState
  // + getRebalanceRepair fetch was removed 2026-05-12 — the local state was
  // shadowing the context-destructured value at line 128, causing two
  // redundant /rebalance/get-repair calls per portfolio load and bypassing
  // the centralisation. See docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g.
  const modelNames = modelPortfolioStrategyfinal?.map(item => item?.model_name);


  const filteredAndSortedStrategies = [...(modelPortfolioStrategyfinal || [])]
    .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
    .map(ele => {
      const allRebalances = ele?.model?.rebalanceHistory || [];
      const sortedRebalances = [...allRebalances].sort(
        (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
      );
      const latest = sortedRebalances[0];
      //  console.log('sorted',sortedRebalances[0]);
      if (!latest) return null;

      // 3-tier execution matching (mirrors RebalanceAdvices.js + tidi
      // RebalanceStatusService._matchExecution):
      //   Tier 1: exact (email + current broker)
      //   Tier 2: DummyBroker fallback
      //   Tier 3: any email match — entry exists for a different broker.
      //           If other broker's status is "executed", treat current
      //           broker as fresh toExecute (different broker = different
      //           holdings). Otherwise pass through (pending is pending
      //           regardless of broker tag).
      const userExecutionsFiltered =
        latest?.subscriberExecutions?.filter(
          execution => execution?.user_email === userEmail,
        ) || [];

      let userExecution =
        userExecutionsFiltered.find(
          ex => broker && ex?.user_broker === broker,
        ) ||
        userExecutionsFiltered.find(
          ex => ex?.user_broker === 'DummyBroker',
        );
      if (!userExecution && userExecutionsFiltered.length > 0) {
        // Tier 3: entry exists for a different broker
        const anyMatch = userExecutionsFiltered[0];
        const otherStatus = (anyMatch?.status || '').toLowerCase();
        if (otherStatus === 'executed') {
          // Executed on broker A ≠ executed on broker B
          userExecution = {...anyMatch, status: 'toExecute', user_broker: broker};
        } else {
          userExecution = anyMatch;
        }
      }

      const matchingFailedTrades = modelPortfolioRepairTrades?.find(
        trade =>
          trade.modelId === latest?.model_Id &&
          trade.failedTrades.length !== 0,
      );

      //  console.log('mathcignL',modelPortfolioRepairTrades);
      // Get user's latest investment amount from subscription_amount_raw
      const rawAmounts = ele?.subscription_amount_raw;
      const latestInvestment = Array.isArray(rawAmounts) && rawAmounts.length > 0
        ? [...rawAmounts].sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))[0]?.amount
        : null;

      return {
        ...ele,
        latestRebalance: latest,
        hasFailedTrades: matchingFailedTrades,
        matchingFailedTrades,
        userInvestmentAmount: latestInvestment,
      };
    })
    ?.filter(ele => ele !== null);
  // Interpolating start and end positions to create a moving gradient effect
  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timeout);
  }, []);
  const showNotification = useSocialProof();
  const navigation = useNavigation();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleUserDataAndFcm = async () => {
    try {
      const fcmToken = await messaging().getToken();
      //  console.log('fcm_token:', fcmToken);

      if (fcmToken) {
        // Define the payload
        const payload = {
          email: user.email,
          fcm_token: fcmToken.toString(),
        };
        console.log(' Fcm token:', fcmToken);
        //  console.log('Posting payload:', payload);
        const response = await axios.put(
          `${server.ccxtServer.baseUrl}comms/fcm/save`,
          payload,
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

        //  console.log('User data posted successfully:', response.data); // Alert as a success message or use any other notification library

        // Event Fanout Phase C (2026-05-18) — also register with the Node
        // backend's per-advisor user_devices collection so the new push
        // worker (CronJob/pushDelivery.js in aq_backend_github) can fan
        // out SDK events (broker.expired, advice.sent, etc.) to this
        // device. Parallel to the existing /comms/fcm/save call above
        // — the two paths serve different push sources for the same
        // device and we want both wired. Best-effort: failure here
        // doesn't break the existing fcm/save success.
        try {
          await axios.post(
            `${server.server.baseUrl}api/devices/register`,
            {
              user_email: user.email,
              app: 'alphab2b',
              platform: Platform.OS, // 'ios' | 'android'
              device_token: fcmToken.toString(),
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
        } catch (registerErr) {
          // Best-effort; ccxt-india /comms/fcm/save is still the primary path
          console.warn(
            '[devices/register] best-effort registration failed:',
            registerErr?.message || registerErr,
          );
        }
      }
    } catch (error) { }
  };

  useEffect(() => {
    handleUserDataAndFcm();
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      const handleBackPress = () => {
        const currentRoute =
          navigation.getState().routes[navigation.getState().index].name;
        const user = getAuth().currentUser;

        // If logged in and the current route is the login screen, prevent going back
        if (user && currentRoute === 'Home') {
          console.log('No back allowed');
          return true; // Prevent going back to login screen
        }
        console.log('yup :', currentRoute);
        navigation.goBack(); // Otherwise, allow back navigation
        return true; // Block the default behavior (no exit app or any other default behavior)
      };

      // Adding back handler event listener
      const backHandlerSubscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

      // Cleanup listener on unmount
      return () => {
        backHandlerSubscription.remove();
      };
    }, [navigation]),
  );

  // showEthicalList moved to useHomeScreenModals (Phase E prep)
  const [ethicalList, setEthicalList] = useState([]);
  const [ethicalLoading, setEthicalLoading] = useState(false);
  const [ethicalSearchQuery, setEthicalSearchQuery] = useState('');

  // App Update Modal State — showUpdateModal now in useHomeScreenModals (Phase E prep)
  const updateCheckDone = useRef(false);

  // Check for app updates when HomeScreen gains focus
  useFocusEffect(
    React.useCallback(() => {
      const checkUpdate = async () => {
        // Only check once per session or if explicitly requested
        if (updateCheckDone.current) return;

        try {
          const result = await checkForAppUpdate(config?.latestAppVersion);
          if (result.updateAvailable) {
            setShowUpdateModal(true);
            updateCheckDone.current = true;
          }
        } catch (error) {
          console.log('Update check error:', error);
        }
      };

      // Small delay to let the screen settle before showing modal
      const timer = setTimeout(checkUpdate, 1500);
      return () => clearTimeout(timer);
    }, []),
  );

  const fetchEthicalList = async () => {
    setEthicalLoading(true);
    try {
      const response = await fetch(ETHICAL_CONFIG.apiEndpoint);
      const data = await response.json();
      setEthicalList(data);
    } catch (e) {
      setEthicalList([]);
    }
    setEthicalLoading(false);
  };

  const [notificationData, setNotificationData] = useState(null);
  const isNotificationTriggered = useRef(false); // Prevent duplicate notifications

  // 🟢 Handle notification data parsing
  const handleNotification = remoteMessage => {
    const { data } = remoteMessage || {};
    const { stocks } = data || {};

    if (stocks) {
      try {
        const parsedStocks = JSON.parse(stocks);
        if (Array.isArray(parsedStocks) && parsedStocks.length > 0) {
          console.log('Parsed Stocks:', parsedStocks);
          setNotificationData(parsedStocks); // Save all stocks in state
        } else {
          console.error('Stocks data is empty or not an array');
        }
      } catch (error) {
        console.error('Error parsing stocks:', error.message);
      }
    }
  };

  const fetchCartItems = async () => {
    try {
      const cartItemsKey = 'cartItems';

      // Load cart items from AsyncStorage
      const cartData = await AsyncStorage.getItem(cartItemsKey);
      const cartItems = cartData ? JSON.parse(cartData) : [];

      // Set cart items into the state
      //setCartContainer(cartItems);
      //console.log('Cart items loaded:', cartItems);
    } catch (error) {
      console.error('Error loading cart items:', error);
    }
    //  console.timeEnd('computationTime1');
  };
  useEffect(() => {
    fetchCartItems();
  }, []);


  const formatOptionSymbol = (symbol) => {
    // Example: "NIFTY04NOV2522850PE" → "NIFTY 04 NOV 25 22850 PE"
    const regex = /^([A-Z]+)(\d{2})([A-Z]{3})(\d{2})(\d+)(CE|PE)$/;
    const match = symbol.match(regex);

    if (match) {
      const [, name, day, month, year, strike, type] = match;
      return `${name} ${day} ${month} ${year} ${strike} ${type}`;
    }
    return symbol; // fallback if doesn't match pattern
  };

  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('Foreground remoteMessage:', remoteMessage);
      console.log('Remote Message Data:', remoteMessage.data);

      getAllTrades();
      const NOTIFICATION_DELAY = 500; // 2 seconds threshold

      if (
        isNotificationTriggered.current &&
        Date.now() - isNotificationTriggered.current < NOTIFICATION_DELAY
      ) {
        console.warn('⏳ Blocking duplicate notification');
        return; // Block duplicate within delay window
      }

      isNotificationTriggered.current = Date.now(); // ✅ Store last notification timestamp

      // Webinar reminders (T-1hr / T-15min / T-1min push from
      // CronLiveClassReminders) — data.type === 'live_class_reminder'.
      // Render via notifee on our dedicated channel; skip the existing
      // notificationType switch so we don't fall into the default
      // "Unrecognized" warn branch.
      if (WebinarReminderHandler.matches(remoteMessage)) {
        await WebinarReminderHandler.displayInForeground(remoteMessage);
        setTimeout(() => { isNotificationTriggered.current = false; }, 500);
        return;
      }

      handleNotification(remoteMessage);

      const title =
        remoteMessage?.notification?.title ?? remoteMessage?.data?.title;
      const body =
        remoteMessage?.notification?.body ?? remoteMessage?.data?.body;

      const { notificationType, stocks, description, image } =
        remoteMessage.data || {};

      console.log('Extracted Image:', image);

      switch (notificationType) {
        case 'bespoke':
          await handleBespokeNotification(
            title,
            body,
            stocks,
            notificationType,
          );
          break;
        case 'news_alert':
          handleNewsNotification(
            title,
            body,
            notificationType,
            image,
            description,
          );
          break;
        case 'New Rebalance':
          handleRebalanceNotification(title, body, notificationType);
          break;
        case 'reco_message':
          await handleRecoMessageNotification(title, body);
          break;
        default:
          console.warn('Foreground: Unrecognized notification type');
      }

      setTimeout(() => {
        isNotificationTriggered.current = false; // Reset lock after delay
      }, 500); // Small delay to allow further notifications after processing
    });

    return unsubscribe;
  }, []);
  const handleNewsNotification = async (
    title,
    body,
    notificationType,
    image,
    description,
  ) => {
    if (!title || !body) return;

    console.log('News Notification:', title, body);
    const notificationConfig = {
      title: `${title}`,
      body: `<b style="color: #4caf50; font-size: 12px;">${description}</b>`,
      android: {
        channelId: 'default',
        style: { type: AndroidStyle.BIGPICTURE, picture: `${image}` },
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        color: '#E8210C',
      },
    };

    await notifee.displayNotification(notificationConfig);
  };

  // 🟢 Handle advisor "Investment Message" (Recommendation Message) push.
  // Background/quit notifications auto-display from the FCM notification block;
  // this surfaces it while the app is in the foreground too.
  const handleRecoMessageNotification = async (title, body) => {
    if (!title && !body) return;
    await notifee.displayNotification({
      title: `${title || 'New message from your advisor'}`,
      body: `${body || ''}`,
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        color: '#045DFF',
      },
    });
  };

  // 🟢 Handle Bespoke Notifications (Stock Advice)
  const handleBespokeNotification = async (
    title,
    body,
    stocks,
    notificationType,
  ) => {
    if (!stocks) return;

    getAllTrades();
    try {
      const parsedStocks = JSON.parse(stocks);
      if (Array.isArray(parsedStocks) && parsedStocks.length > 0) {
        if (parsedStocks.length > 1) {
          // ✅ Show a single summary notification for multiple stocks
          const stockCount = parsedStocks.length;
          const firstStock = parsedStocks[0];
          const newBody = `${firstStock.symbol} - ${firstStock.type} and ${stockCount - 1
            } more stocks`;
          console.log('Bespoke Notification:', title, newBody);
          await displayNotification(title, newBody, notificationType);
        } else {
          // ✅ Show a normal notification for a single stock
          const { symbol, type, price, tradeId } = parsedStocks[0];
          await displayStockNotification(
            title,
            body,
            notificationType,
            symbol,
            type,
            price,
            tradeId,
          );
        }
      }
    } catch (error) {
      console.error('Error parsing stocks:', error.message);
    }
  };

  // 🟢 Display Generic Notification
  const displayNotification = async (title, body, notificationType) => {
    if (!title || !body) return;

    console.log('General Notification:', title, body);
    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        color: '#E8210C',
      },
    });
  };

  // 🟢 Display Stock Advice Notification
  const displayStockNotification = async (
    title,
    body,
    notificationType,
    symbol,
    type,
    price,
    tradeId,
  ) => {
    if (!title || !body) return;

    await getAllTrades();
    console.log('Stock Advice Notification:', symbol, type, price);
    const notificationConfig = {
      title: `${title}`,
      body: `${symbol} - ${type}`,
      android: {
        channelId: 'default',
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        color: '#E8210C',
      },
    };

    await notifee.displayNotification(notificationConfig);
  };

  // 🟢 Handle New Rebalance Notifications
  const handleRebalanceNotification = async (title, body, notificationType) => {
    try {
      console.log('Rebalance Notification:', title, body);

      await notifee.displayNotification({
        title: title || 'New Rebalance!',
        body:
          body ||
          'You have received a new rebalance from your advisor. Tap to review.',
        android: {
          channelId: 'default',
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          color: '#E8210C',
        },
      });

      // Optionally refresh trades if needed
      getModelPortfolioStrategyDetails();
    } catch (error) {
      console.error('Error displaying rebalance notification:', error);
    }
  };


  const translateY = useRef(new Animated.Value(screenHeight)).current;

  useEffect(() => {
    async function createChannel() {
      await notifee.createChannel({
        id: 'default',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
      });
    }

    createChannel();
  }, []);

  useEffect(() => {
    // Set Android navigation bar styling
    if (Platform.OS === 'android') {
      const { StatusBar } = require('react-native');
      StatusBar.setBackgroundColor('#000000', true);
      StatusBar.setBarStyle('light-content', true);
    }
  }, []);

  const onRefresh = () => {
    setIsRefreshing(true);
    getAllFunds();
    getUserDeatils();
    getAllTrades();
    fetchBlogs();
    fetchPdf();
    fetchVideos();
    getModelPortfolioStrategyDetails();
    getAllBestPerformers();
    // Emit the refresh event

    //eventEmitter.emit('refreshEvent', { userEmail });

    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const [isNotificationPermissionGranted, setIsNotificationPermissionGranted] =
    useState(false);
  const [isMediaPermissionGranted, setIsMediaPermissionGranted] =
    useState(false);

  useEffect(() => {
    // Check permissions on mount
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    await checkNotificationPermission();
    await checkMediaPermission();
  };

  const checkNotificationPermission = async () => {
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus === AuthorizationStatus.AUTHORIZED) {
      setIsNotificationPermissionGranted(true);
    } else {
      setIsNotificationPermissionGranted(false);
      await requestNotificationPermission();
    }
  };

  const requestNotificationPermission = async () => {
    await notifee.requestPermission();
    const updatedSettings = await notifee.getNotificationSettings();
    if (
      updatedSettings.authorizationStatus === AuthorizationStatus.AUTHORIZED
    ) {
      setIsNotificationPermissionGranted(true);
    }
  };

  const checkMediaPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
      if (granted) {
        setIsMediaPermissionGranted(true);
      } else {
        await requestMediaPermission();
      }
    } else {
      setIsMediaPermissionGranted(true); // iOS handles permissions differently
    }
  };

  const requestMediaPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Media Permission',
          message: 'This app needs access to your media files.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setIsMediaPermissionGranted(true);
      } else {
        setIsMediaPermissionGranted(false);
      }
    }
  };
  const [searchQuery, setSearchQuery] = useState('');

  const OpenNewsScreen = () => {
    console.log('clocke');
    navigation.navigate('News');
  };

  // States for modal visibility
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [selectedPDF, setSelectedPDF] = useState(null);
  // videoModalVisible + pdfModalVisible moved to useHomeScreenModals (Phase E prep)
  const [blogModalVisible, setBlogModalVisible] = useState(false);

  // Helper functions
  const convertToTimeAgo = dateString => {
    return moment(dateString).fromNow();
  };

  const getTimeAgo = dateString => {
    const now = new Date();
    const videoDate = new Date(dateString);
    const diffInSeconds = Math.floor((now - videoDate) / 1000);

    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'week', seconds: 604800 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 },
    ];

    for (const interval of intervals) {
      const count = Math.floor(diffInSeconds / interval.seconds);
      if (count > 1) {
        return `${count} ${interval.label}s ago`;
      } else if (count === 1) {
        return `${count} ${interval.label} ago`;
      }
    }

    return 'just now';
  };

  // Empty State Components
  const EmptyStateBlogs = () => (
    <View style={styles.emptyStateWrapper}>
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyStateIconContainer}>
          <BookOpen size={32} color="#8B45FF" />
        </View>
        <Text style={styles.emptyStateTitle}>No Blogs Available</Text>
        <Text style={styles.emptyStateText}>
          We're working on adding valuable educational resources for you. Check
          back soon!
        </Text>
      </View>
    </View>
  );

  // Replace the EmptyStateVideos component with this centered version
  const EmptyStateVideos = () => (
    <View style={styles.emptyStateWrapper}>
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyStateIconContainer}>
          <Video size={32} color="#8B45FF" />
        </View>
        <Text style={styles.emptyStateTitle}>No Videos Available</Text>
        <Text style={styles.emptyStateText}>
          We're curating video tutorials and masterclasses for you. Check back
          soon for fresh content!
        </Text>
      </View>
    </View>
  );

  // Replace the EmptyStatePDFs component with this centered version
  const EmptyStatePDFs = () => (
    <View style={styles.emptyStateWrapper}>
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyStateIconContainer}>
          <FileText size={32} color="#8B45FF" />
        </View>
        <Text style={styles.emptyStateTitle}>No PDF Resources Yet</Text>
        <Text style={styles.emptyStateText}>
          We're preparing PDF guides and resources for your learning journey.
          Stay tuned!
        </Text>
      </View>
    </View>
  );

  // Carousel Components
  const BlogCarousel = () => {
    const renderBlogItem = ({ item }) => (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          setSelectedBlog(item);
          setBlogModalVisible(true);
        }}>
        <View style={styles.blogCard}>
          <Image
            source={{ uri: item.image_base64 || item.imageUrl }}
            style={styles.blogImage}
            defaultSource={require('../../assets/default.png')}
          />
          <View style={styles.textOverlay}>
            <Text numberOfLines={2} style={styles.blogTitle}>
              {item.title}
            </Text>
            <View style={styles.timestampContainer}>
              <Clock size={16} color={'white'} />
              <Text style={styles.timestampText}>
                {convertToTimeAgo(item.created_at)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );

    return (
      <View>
        <FlatList
          data={blogs?.slice(0, 5) || []}
          renderItem={renderBlogItem}
          keyExtractor={(item, index) => index.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 15 }}
          ListEmptyComponent={<EmptyStateBlogs />}
        />
      </View>
    );
  };

  const VideoCarousel = () => {
    const renderVideoItem = ({ item }) => (
      <TouchableOpacity
        style={{ marginBottom: 10 }}
        activeOpacity={0.9}
        onPress={() => {
          setSelectedVideo({ id: item.video_id, title: item.title });
          setVideoModalVisible(true);
        }}>
        <View style={styles.videoCard}>
          <Image
            style={styles.videoThumbnail}
            source={{ uri: item.thumbnail_url }}
          />
          <View style={styles.videoInfo}>
            <View>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={styles.videoTitle}>
                {item.title}
              </Text>
              <Text style={styles.videoDetails}>
                {getTimeAgo(item.created_at)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );

    return (
      <View>
        <FlatList
          // data={videos?.slice(0, 5) || []}
          data={[]}
          renderItem={renderVideoItem}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 15 }}
          ListEmptyComponent={<EmptyStateVideos />}
        />
      </View>
    );
  };

  const formatFileSize = bytes => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      const kb = bytes / 1024;
      return `${kb.toFixed(0)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const showToast = (message1, type, message2) => {
    Toast.show({
      type: type,
      text2: message2 + ' ' + message1,
      position: 'bottom',
      text1Style: {
        color: 'black',
        fontSize: 11,
        fontWeight: 0,
        fontFamily: 'Poppins-Medium',
      },
      text2Style: {
        color: 'black',
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
      },
    });
  };

  const completeDownloadStatement = async pdfData => {
    try {
      if (pdfData) {
        const fileName = `Educational_PDF_${new Date().getTime()}.pdf`;
        const path =
          Platform.OS === 'android'
            ? `${RNFS.DownloadDirectoryPath}/${fileName}`
            : `${RNFS.DocumentDirectoryPath}/${fileName}`;

        const binaryData = atob(pdfData);
        await RNFS.writeFile(path, binaryData, 'ascii');

        const fileExists = await RNFS.exists(path);
        if (fileExists) {
          showToast(
            'PDF downloaded successfully to downloads folder',
            'success',
            '',
          );
          console.log(`File successfully saved at ${path}`);
        } else {
          console.error('File not found after saving:', path);
          showToast('Failed to save PDF', 'error', '');
        }
      } else {
        console.error('PDF data is empty');
        showToast('PDF data is empty', 'error', '');
      }
    } catch (error) {
      console.error('Error saving PDF:', error);
      showToast('Error downloading PDF', 'error', '');
    }
  };

  const handleDirectDownload = async pdfID => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}/misc/pdfs/download/${pdfID}`,
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

      if (response.data && response.data.pdf_data) {
        await completeDownloadStatement(response.data.pdf_data);
      } else {
        showToast('PDF data not found', 'error', '');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast('Failed to download PDF', 'error', '');
    } finally {
      setIsLoading(false);
    }
  };

  // console.log('Hee i am --');
  const PDFCarousel = () => {
    const handleViewPDF = async pdfItem => {
      setSelectedPDF(pdfItem);
      setPdfModalVisible(true);
    };

    const renderPDFItem = ({ item }) => (
      <View style={styles.pdfCard}>
        <View style={styles.pdfContent}>
          <Image source={pdfcicon} style={styles.pdfIcon} />
          <View style={styles.pdfCardContent}>
            <Text numberOfLines={1} style={styles.pdfCardTitle}>
              {item.title}
            </Text>
            <Text style={styles.pdfCardDescription}>
              {item.pages ? `${item.pages} Pages` : 'PDF'} •{' '}
              {formatFileSize(item.file_size)}
            </Text>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => handleViewPDF(item)}>
              <Text style={styles.viewButtonText}>View PDF</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => handleDirectDownload(item._id)}
          disabled={isLoading}>
          <Download size={25} color={isLoading ? '#ccc' : 'black'} />
        </TouchableOpacity>
      </View>
    );

    return (
      <View>
        <FlatList
          data={pdf?.slice(0, 5) || []}
          renderItem={renderPDFItem}
          keyExtractor={item => item._id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 15 }}
          ListEmptyComponent={<EmptyStatePDFs />}
        />
      </View>
    );
  };

  // Animated Header Component
  const AnimatedSearchHeader = ({ scrollY }) => {
    const animatedTranslateY = scrollY.interpolate({
      inputRange: [0, 150],
      outputRange: [0, -290],
      extrapolate: 'clamp',
    });

    const animatedTextOpacity = scrollY.interpolate({
      inputRange: [0, 100],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const AnimatedLinearGradient =
      Animated.createAnimatedComponent(LinearGradient);

    const headerColors = [gradient1, gradient2];

    return (
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 11 }}>
        <AnimatedLinearGradient
          colors={headerColors}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            {
              paddingVertical: selectedVariant === 'arfs' ? 40 : 10,
              marginBottom: 10,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 11,
              transform: [{ translateY: animatedTranslateY }],
            },
          ]}>
          {/* Rest of the header content remains the same */}
          <View style={{ flex: 1 }}>
            <Animated.View
              style={{
                opacity: animatedTextOpacity,
                paddingVertical: 0,
                paddingHorizontal: 0,
              }}>
              <View
                style={[
                  styles.textContainer,
                  {
                    marginTop: selectedVariant === 'arfs' ? 45 : 0,
                    paddingHorizontal: 6,
                  },
                ]}>
                {selectedVariant === 'arfs' ? (
                  <>
                    <Text style={styles.headerText}>SMARTER INVESTING</Text>
                    <Text style={styles.headerText}>WITH {(configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || configData?.appName || getAdvisorSubdomain()).toUpperCase()}</Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignContent: 'flex-start',
                        alignItems: 'flex-start',
                        alignSelf: 'flex-start',
                      }}>
                      <View style={{ marginRight: 10 }}>
                        <Text>
                          <Text style={[styles.subText]}>
                            AI News | Auto Trading
                          </Text>
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.subText}>
                          Portfolio Health | Watchlist
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.subText, { marginTop: 10 }]}>
                      All in one app
                    </Text>
                  </>
                ) : selectedVariant === 'magnus' ? (
                  <>
                    <View style={styles.magnusHeaderContainer}>
                      <View style={styles.magnusTitleSection}>
                        <View
                          style={[
                            styles.magnusTitleRow,
                            {
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                            },
                          ]}>
                          <Text
                            style={[styles.headerText, styles.magnusMainText]}
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            minimumFontScale={0.5}>
                            ACCELERATE YOUR PORTFOLIO
                          </Text>
                          <Text
                            style={[
                              styles.headerText,
                              styles.magnusResearchText,
                            ]}
                            numberOfLines={1}
                            adjustsFontSizeToFit={true}
                            minimumFontScale={0.5}
                          />
                        </View>
                      </View>

                      <View style={styles.magnusCredentials}>
                        <View style={styles.magnusBadgeRow}>
                          <LinearGradient
                            colors={[mainColor, mainColor]} // Gold gradient for AI-POWERED
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.magnusAIBadge}>
                            <Text style={styles.magnusAIBadgeText}>
                              ALL-IN-ONE APP
                            </Text>
                          </LinearGradient>
                          <LinearGradient
                            colors={[mainColor, mainColor]} // Blue gradient for SEBI CERTIFIED
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.magnusVerified}>
                            <Text style={styles.magnusVerifiedText}>
                              🏛️ SEBI CERTIFIED
                            </Text>
                          </LinearGradient>
                        </View>
                        <Text style={styles.magnusTagline}>
                          Ethical Investing • Real-time Market Analysis
                        </Text>
                        <Text style={styles.magnusTagline}>
                          Expert Recommendations • Trusted Insights
                        </Text>
                      </View>
                      <View
                        style={{
                          alignItems: 'center',
                          alignContent: 'center',
                          alignSelf: 'center',
                          marginHorizontal: 15,
                          marginTop: 15,
                        }}>
                        {Config?.ADVISOR_RA_CODE === 'ZAMZAMCAPITAL' && (
                          <TouchableOpacity
                            onPress={() => {
                              setShowEthicalList(true);
                              fetchEthicalList();
                            }}>
                            <LinearGradient
                              colors={['#000000', '#3A3A3A']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: '#212121',
                                flexDirection: 'row',
                                elevation: 0,
                                paddingHorizontal: 8,
                                paddingVertical: 6,
                                position: 'relative',
                                overflow: 'hidden',
                              }}>
                              <Text
                                style={{
                                  color: '#fff',
                                  fontFamily: 'Satoshi-Bold',
                                  fontSize: 14,
                                }}>
                                {ETHICAL_CONFIG.buttonText}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.headerText}>DEFAULT TEXT</Text>
                    <Text style={styles.headerText}>FOR OTHER VARIANTS</Text>
                  </>
                )}
              </View>
            </Animated.View>
          </View>
        </AnimatedLinearGradient>
      </View>
    );
  };

  const scrollY = useRef(new Animated.Value(0)).current;

  // Track data availability for plan sections - must be before allTabData
  const [hasMPData, setHasMPData] = useState(false);
  const [hasBespokeData, setHasBespokeData] = useState(false);

  // Whether user has active recommendations or rebalances.
  // planList is truthy only when the user has an active subscription (set by
  // api/sendnotification). Unsubscribed users who received a demo reco must
  // still see the Plans section — so we gate on planList here to prevent a
  // blurred demo card from hiding the Plans discovery section.
  const hasActiveContent = !!planList && (filteredAndSortedStrategies.length > 0 || stockRecoNotExecutedfinal?.length > 0);

  // Data for All Tab
  // If user has active subscriptions (recos/rebalances), show those first, plans after.
  // Otherwise show plans first to encourage subscription.
  const allTabData = [

    // ── Active content first (only when user has subscriptions) ──
    ...(hasActiveContent && filteredAndSortedStrategies.length > 0
      ? [
        {
          key: 'RebalanceAdvicesTop',
          component: (
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginVertical: 10,
                  alignItems: 'center',
                  marginHorizontal: 15,
                }}>
                <View>
                  <Text style={styles.StockTitle}>
                    Portfolio Recommendations
                  </Text>
                  <Text style={styles.StockTitlebelow}>
                    Model Portfolio Active Rebalances
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSeeAllMP(true)}
                  style={styles.viewAll}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginLeft: 14 }}>
                <RebalanceAdvices userEmail={userEmail} type={'home'} />
              </View>
            </View>
          ),
        },
      ]
      : []),

    ...(hasActiveContent && stockRecoNotExecutedfinal?.length > 0
      ? [
        {
          key: 'StockAdvicesTop',
          component: (
            <View style={{ marginTop: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginVertical: 10,
                  alignItems: 'center',
                  marginHorizontal: 15,
                }}>
                <View>
                  <Text style={styles.StockTitle}>Recommendations</Text>
                  <Text style={styles.StockTitlebelow}>
                    Bespoke Active Recommendations
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSeeAllBespoke(true)}
                  style={styles.viewAll}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginLeft: 2 }}>
                <StockAdvices
                  userEmail={userEmail}
                  type={'home'}
                  tradeButtonColor="#3E3EFC"
                />
              </View>
            </View>
          ),
        },
      ]
      : []),

    // ── Plans section (hidden when user has active subscriptions) ──
    ...(!hasActiveContent && config?.modelPortfolioEnabled === true
      ? [
        {
          key: 'AllPlanDetailsmp',
          component: (
            <View>
              {hasMPData && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 20,
                    marginHorizontal: 15,
                  }}>
                  <View>
                    <Text style={styles.StockTitle}>Model Portfolios</Text>
                    <Text style={styles.StockTitlebelow}>
                      Ranked based of user feedbacks
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSeeAllMPplan(true)}
                    style={styles.viewAll}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ marginLeft: 0 }}>
                <ModelPortfolioScreen type="mphorizontal" onDataLoaded={setHasMPData} />
              </View>
            </View>
          ),
        },
      ]
      : []),
    ...(!hasActiveContent && configData?.config?.REACT_APP_BESPOKE_PLANS_STATUS === true
      ? [
        {
          key: 'AllPlanDetailsbespoke',
          component: (
            <View>
              {hasBespokeData && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 0,
                    marginTop: 20,
                    marginHorizontal: 15,
                  }}>
                  <View>
                    <Text style={styles.StockTitle}>Top Bespoke Plans</Text>
                    <Text style={styles.StockTitlebelow}>
                      Ranked based of user feedbacks
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSeeAllBespokeplan(true)}
                    style={styles.viewAll}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ marginLeft: 0 }}>
                <ModelPortfolioScreen type="bespokehorizontal" onDataLoaded={setHasBespokeData} />
              </View>
            </View>
          ),
        },
      ]
      : []),

    // Rebalance advices (only if not already shown at top)
    ...(!hasActiveContent && filteredAndSortedStrategies.length > 0
      ? [
        {
          key: 'RebalanceAdvices',
          component: (
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginVertical: 10,
                  alignItems: 'center',
                  marginHorizontal: 15,
                }}>
                <View>
                  <Text style={styles.StockTitle}>
                    Portfolio Recommendations
                  </Text>
                  <Text style={styles.StockTitlebelow}>
                    Model Portfolio Active Rebalances
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSeeAllMP(true)}
                  style={styles.viewAll}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginLeft: 14 }}>
                <RebalanceAdvices userEmail={userEmail} type={'home'} />
              </View>
            </View>
          ),
        },
      ]
      : []),
    {
      key: 'EthicalListLink',
      component: (
        <>
          {Config?.ADVISOR_RA_CODE === 'ZAMZAMCAPITAL' && (
            <View style={{ marginTop: 10, marginHorizontal: 15, alignItems: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => {
                  setShowEthicalList(true);
                  fetchEthicalList();
                }}
              >
                <LinearGradient
                  colors={['#000000', '#3A3A3A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#212121',
                    flexDirection: 'row',
                    elevation: 0,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                  <Text
                    style={{
                      color: '#fff',
                      fontFamily: 'Satoshi-Bold',
                      fontSize: 14,
                    }}>
                    {ETHICAL_CONFIG.buttonText}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </>
      ),
    },
    // Bespoke recommendations (only if not already shown at top)
    ...(!hasActiveContent
      ? [
        {
          key: 'StockAdvices',
          component: (
            <View style={{ marginTop: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginVertical: 10,
                  alignItems: 'center',
                  marginHorizontal: 15,
                }}>
                <View>
                  <Text style={styles.StockTitle}>Recommendations</Text>
                  <Text style={styles.StockTitlebelow}>
                    Bespoke Active Recommendations
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSeeAllBespoke(true)}
                  style={styles.viewAll}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              <View style={{ marginLeft: 2 }}>
                <StockAdvices
                  userEmail={userEmail}
                  type={'home'}
                  tradeButtonColor="#3E3EFC"
                />
              </View>
            </View>
          ),
        },
      ]
      : []),
    {
      key: 'KnowledgeHub',
      component: (
        <View style={{ marginTop: 10 }}>
          <KnowledgeHub type="home" />
        </View>
      ),
    },
    // {
    //   key: "LABEL",
    //   component: (
    //     <View style={styles.labelContainer}>
    //       <Text style={styles.labelText}>Made with ❤️ by AlphaQuark</Text>
    //     </View>
    //   ),
    // },
  ];

  const animatedFlatListPadding = scrollY.interpolate({
    inputRange: [0, 10],
    outputRange: [240, 10], // Adjust based on header height
    extrapolate: 'clamp',
  });
  // 7 see-all overlay booleans moved to useHomeScreenTabs (Phase E prep) —
  // exposed back via boolean shims so call sites below are unchanged.
  const [bespokeListTab, setBespokeListTab] = useState('active'); // 'active' | 'rejected'
  const [Openpdf, setOpenpdf] = useState(false);
  const [OpenBlogs, setOpenBlogs] = useState(false);
  const [Openvideos, setOpenvideos] = useState(false);

  // Video player modal
  const onStateChange = state => {
    if (state === 'ended') {
      setVideoModalVisible(false);
      setSelectedVideo(null);
    }
  };

  // Phase E.3 (2026-05-02): JSX render extracted to
  // designs/default/screens/HomeScreen.js. Container hands the entire
  // local scope (state + setters + handlers + Animated refs +
  // pre-computed allTabData) over as a single `home` prop bag.
  // Closures inside allTabData (which build JSX subtrees) resolve
  // against this container's scope, so they keep working unchanged.
  const Presentation = useComponent('screens.HomeScreen');

  // Variant-facing additions (alphanomy reads these; default ignores them).
  // Tickers: live LTPs from MarketDataContext + previous-close fetch for
  // change indicators. P&L: aggregated holdings sum from MultiBrokerContext.
  // See src/screens/Home/hooks/useHomeMarketSummary.js for the resolution.
  const { tickers, pnlSummary } = useHomeMarketSummary();
  // Plan summaries: top MP + bespoke plan from the catalogs
  // (mirrors getAllStrategy / getAllBespoke endpoints used by
  // src/screens/Drawer/ModelPortfolioScreen.js — same auth headers,
  // same advisorTag/userEmail dependencies). Returns nulls until the
  // user is authenticated AND the advisor config has resolved.
  const { heroPlan, bespokePlan, heroPlanRaw, bespokePlanRaw } = useHomePlanSummary({
    userEmail,
    advisorTag: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
    headerName: configData?.config?.REACT_APP_HEADER_NAME,
  });

  const home = {
    seeAllBespoke, setSeeAllBespoke,
    seeAllBespokeplan, setSeeAllBespokeplan,
    seeAllMP, setSeeAllMP,
    seeAllMPplan, setSeeAllMPplan,
    seeAllBlogs, setSeeAllBlogs,
    seeAllVideos, setSeeAllVideos,
    seeAllPDFs, setSeeAllPDFs,
    bespokeListTab, setBespokeListTab,
    userEmail, config,
    isRefreshing, onRefresh,
    searchQuery, setSearchQuery,
    OpenNewsScreen,
    scrollY,
    allTabData,
    Openvideos, setOpenvideos,
    Openpdf, setOpenpdf,
    OpenBlogs, setOpenBlogs,
    selectedVideo, setSelectedVideo,
    videoModalVisible, setVideoModalVisible,
    selectedBlog, blogModalVisible, setBlogModalVisible,
    selectedPDF, pdfModalVisible, setPdfModalVisible,
    showEthicalList, setShowEthicalList,
    ethicalLoading, ethicalList,
    ethicalSearchQuery, setEthicalSearchQuery,
    showUpdateModal, setShowUpdateModal,
    onStateChange, convertToTimeAgo,
    // Variant-facing market summary (additive — default presentation ignores).
    tickers, pnlSummary,
    // Variant-facing plan summaries.
    heroPlan, bespokePlan,
    heroPlanRaw, bespokePlanRaw,
    // Variant-facing user name for the greeting (full name preferred over
    // email-derived first-name fallback).
    userName,
    // Variant-facing active-portfolio sections (alphanomy variant only):
    //   rebalanceList — sorted MP rebalance items the user is subscribed to,
    //                   with `latestRebalance` + `userInvestmentAmount`
    //                   already merged in. Same shape that powers the legacy
    //                   <RebalanceAdvices> component on the default presentation.
    //   recommendationList — pending bespoke trade recos for this user. Same
    //                        array the legacy <StockAdvices type="home"> reads.
    // Default presentation ignores these — they're additive, not contract-breaking.
    rebalanceList: filteredAndSortedStrategies,
    recommendationList: stockRecoNotExecutedfinal,
    // Variant-facing tenant copy for Home section subtitles. Same
    // pattern as `taglines.login` / `taglines.signup` (see
    // `src/context/ConfigContext.js § TENANT TAGLINES` and
    // `docs/TENANT_TAGLINES.md`). Default presentation ignores;
    // alphanomy reads `home.taglines.modelPortfoliosSubtitle` etc.
    // and falls back per-field to its hardcoded copy.
    taglines: configData?.config?.taglines?.home || null,
    // Variant-facing knowledge data (blogs / videos / pdf). Default
    // presentation uses the KnowledgeHub component directly; alphanomy
    // variant renders its own inline cards from these arrays.
    blogs,
    videos,
    pdf,
  };

  return <Presentation home={home} />;
};


export default HomeScreen;
