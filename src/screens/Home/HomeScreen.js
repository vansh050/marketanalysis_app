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
import messaging from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  AndroidStyle,
} from '@notifee/react-native';
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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('All');
  // Cache to store which tab has loaded data
  const isDataLoaded = useRef({ All: false, Bespoke: false, Rebalance: false });
  let c = 0;
  const onRenderCallback = (id, phase, actualDuration) => {
    c = c + 1;
    // console.log('count --->',c);
    //  console.log(`${id} [${phase}] rendered in ${actualDuration} ms`);
  };

  const animation = useRef(new Animated.Value(0)).current;

  const modelNames = modelPortfolioStrategyfinal?.map(item => item?.model_name);
  const [modelPortfolioRepairTrades, setModelPortfolioRepairTrades] = useState(
    [],
  );
  const getRebalanceRepair = () => {
    let repairData = JSON.stringify({
      modelName: modelNames,
      advisor: modelPortfolioStrategyfinal[0]['advisor'],
      userEmail: userEmail,
      userBroker: broker,
    });
    let config2 = {
      method: 'post',
      url: `${server.ccxtServer.baseUrl}rebalance/get-repair`,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },

      data: repairData,
    };
    axios
      .request(config2)
      .then(response => {
        setModelPortfolioRepairTrades(response.data.models);
      })
      .catch(error => {
        console.log(error);
      });
  };
  // console.log("Broker value being sent:", broker);
  useEffect(() => {
    if (modelPortfolioStrategyfinal.length !== 0) {
      getRebalanceRepair();
    }
  }, [modelPortfolioStrategyfinal]);


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

      // Find execution for this user AND current broker
      // A user may execute the same rebalance with multiple brokers,
      // so we check broker match to allow re-execution with a different broker
      // Also match DummyBroker executions when broker is not connected
      const userExecutionsFiltered =
        latest?.subscriberExecutions?.filter(
          execution => execution?.user_email === userEmail,
        ) || [];

      const userExecution =
        userExecutionsFiltered.find(
          ex => broker && ex?.user_broker === broker,
        ) ||
        userExecutionsFiltered.find(
          ex => ex?.user_broker === 'DummyBroker',
        ) ||
        (!broker ? userExecutionsFiltered[0] : undefined);

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

  const [showEthicalList, setShowEthicalList] = useState(false);
  const [ethicalList, setEthicalList] = useState([]);
  const [ethicalLoading, setEthicalLoading] = useState(false);
  const [ethicalSearchQuery, setEthicalSearchQuery] = useState('');

  // App Update Modal State
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const updateCheckDone = useRef(false);

  // Check for app updates when HomeScreen gains focus
  useFocusEffect(
    React.useCallback(() => {
      const checkUpdate = async () => {
        // Only check once per session or if explicitly requested
        if (updateCheckDone.current) return;

        try {
          const result = await checkForAppUpdate();
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
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [blogModalVisible, setBlogModalVisible] = useState(false);
  const [pdfModalVisible, setPdfModalVisible] = useState(false);

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

  // Whether user has active recommendations or rebalances
  const hasActiveContent = filteredAndSortedStrategies.length > 0 || stockRecoNotExecutedfinal?.length > 0;

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
  const [seeAllBespoke, setSeeAllBespoke] = useState(false);
  const [bespokeListTab, setBespokeListTab] = useState('active'); // 'active' | 'rejected'
  const [seeAllBespokeplan, setSeeAllBespokeplan] = useState(false); // Toggle between full HomeScreen and StockAdvices
  const [seeAllMP, setSeeAllMP] = useState(false);
  const [seeAllMPplan, setSeeAllMPplan] = useState(false);
  const [seeAllBlogs, setSeeAllBlogs] = useState(false);
  const [seeAllVideos, setSeeAllVideos] = useState(false);
  const [seeAllPDFs, setSeeAllPDFs] = useState(false);
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

  return (
    <SafeAreaView style={styles.container}>
      {!(
        seeAllBespoke ||
        seeAllMP ||
        seeAllBespokeplan ||
        seeAllMPplan ||
        seeAllBlogs ||
        seeAllVideos ||
        seeAllPDFs
      ) && (
          <View
            style={{
              backgroundColor: 'transparent',
              paddingBottom: 0,
              zIndex: 13,
              borderBottomLeftRadius: 30,
              borderBottomRightRadius: 30,
            }}>
            {/* Gradient Border */}
            {selectedVariant === 'arfs' && (
              <LinearGradient
                colors={['#212121', '#212121']} // Border gradient colors arfs: '#6A29CA', '#773D9A'
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.borderGradient} // Border gradient container
              >
                <TouchableOpacity
                  onPress={OpenNewsScreen}
                  style={styles.searchBarContainer}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onPress={OpenNewsScreen}
                    textAlignVertical="bottom"
                    placeholderTextColor={'#fff'}
                    style={styles.searchBar}
                    placeholder="India's First AI News Search. Just Ask"
                  />
                  <Icon1 name="search" size={12} color={'#fff'} />
                </TouchableOpacity>
              </LinearGradient>
            )}
          </View>
        )}

      {/* Animated Header */}
      {/* {!(seeAllBespoke || seeAllMP || seeAllBlogs || seeAllVideos || seeAllPDFs) && (
        <AnimatedSearchHeader scrollY={scrollY} />
      )} */}

      <SafeAreaView style={{ flex: 1 }}>
        {seeAllMPplan && (
          <View style={{ flex: 1, display: seeAllMPplan ? 'flex' : 'none' }}>
            <View style={styles.backButton}>
              <TouchableOpacity onPress={() => setSeeAllMPplan(false)}>
                <ArrowLeft size={20} color={'black'} />
              </TouchableOpacity>
              <Text style={styles.StockTitle}>Model Portfolios</Text>
            </View>
            <ModelPortfolioScreen type={'mpvertical'} />
          </View>
        )}

        {seeAllBespokeplan && (
          <View style={{ flex: 1, display: seeAllBespokeplan ? 'flex' : 'none' }}>
            <View style={styles.backButton}>
              <TouchableOpacity onPress={() => setSeeAllBespokeplan(false)}>
                <ArrowLeft size={20} color={'black'} />
              </TouchableOpacity>
              <Text style={styles.StockTitle}>Top Bespoke Plans</Text>
            </View>
            <ModelPortfolioScreen type={'bespokevertical'} />
          </View>
        )}

        {seeAllBespoke && (
          <View style={{ flex: 1 }}>
            <View style={styles.backButton}>
              <TouchableOpacity
                style={{
                  marginRight: 15,
                  alignContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                  marginBottom: 5,
                }}
                onPress={() => setSeeAllBespoke(false)}>
                <ArrowLeft size={20} color={'black'} />
              </TouchableOpacity>
              <Text style={styles.StockTitle}>Recommendations</Text>
            </View>
            <View style={styles.bespokeTabRow}>
              {['active', 'rejected'].map(tab => {
                const isActive = bespokeListTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setBespokeListTab(tab)}
                    activeOpacity={0.85}
                    style={[
                      styles.bespokeTabPill,
                      {
                        backgroundColor: isActive
                          ? config?.mainColor || '#0056B7'
                          : '#F4F4F4',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.bespokeTabPillText,
                        {color: isActive ? '#fff' : '#808080'},
                      ]}>
                      {tab === 'active' ? 'Active' : 'Rejected'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <StockAdvices
              userEmail={userEmail}
              type={bespokeListTab === 'rejected' ? 'OSrejected' : 'All'}
            />
          </View>
        )}

        <View style={{ flex: 1, display: seeAllMP ? 'flex' : 'none' }}>
          <View style={[styles.backButton]}>
            <TouchableOpacity
              style={{ marginRight: 10 }}
              onPress={() => setSeeAllMP(false)}>
              <ArrowLeft size={20} color={'black'} />
            </TouchableOpacity>
            <Text style={styles.StockTitle}>Portfolio Recommendations</Text>
          </View>
          <RebalanceAdvices userEmail={userEmail} type={'All'} />
        </View>

        {seeAllBlogs && (
          <View style={{ flex: 1 }}>
            <View style={styles.backButton}>
              <TouchableOpacity onPress={() => setSeeAllBlogs(false)}>
                <ArrowLeft size={20} color={'black'} />
              </TouchableOpacity>
              <Text style={styles.StockTitle}>Latest Blogs</Text>
            </View>
            <EducationalBlogs
              type={'allblogs'}
              visible={true}
              setOpenBlogs={setSeeAllBlogs}
            />
          </View>
        )}

        {seeAllVideos && (
          <View style={{ flex: 1 }}>
            <View style={styles.backButton}>
              <TouchableOpacity onPress={() => setSeeAllVideos(false)}>
                <ArrowLeft size={20} color={'black'} />
              </TouchableOpacity>
              <Text style={styles.StockTitle}>Educational Videos</Text>
            </View>
            <EducationalVideos visible={true} setOpenvideos={setSeeAllVideos} />
          </View>
        )}

        {seeAllPDFs && (
          <View style={{ flex: 1 }}>
            <View style={styles.backButton}>
              <TouchableOpacity onPress={() => setSeeAllPDFs(false)}>
                <ArrowLeft size={20} color={'black'} />
              </TouchableOpacity>
              <Text style={styles.StockTitle}>PDF Resources</Text>
            </View>
            <EducationalPDF visible={true} setOpenpdf={setSeeAllPDFs} />
          </View>
        )}

        <View
          style={{
            display:
              seeAllBespoke ||
                seeAllMP ||
                seeAllMPplan ||
                seeAllBespokeplan ||
                seeAllBlogs ||
                seeAllVideos ||
                seeAllPDFs
                ? 'none'
                : 'flex',
            flex: 1,
          }}>
          <Animated.FlatList
            data={
              seeAllBespoke ||
                seeAllMPplan ||
                seeAllMP ||
                seeAllBespokeplan ||
                seeAllBlogs ||
                seeAllVideos ||
                seeAllPDFs
                ? []
                : allTabData
            } // Ensure data is always an array
            nestedScrollEnabled={true}
            keyExtractor={item => item.key}
            style={{ zIndex: 11, paddingLeft: 0 }}
            refreshControl={
              <RefreshControl
                style={{ borderBlockColor: 'red' }}
                refreshing={isRefreshing}
                onRefresh={onRefresh}
              />
            }
            renderItem={({ item }) => <View>{item.component}</View>}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              zIndex: 1000,

              paddingBottom: 20,
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
          />

          {/* Modal components for full-screen viewing */}
          {Openvideos && (
            <EducationalVideos
              visible={Openvideos}
              setOpenvideos={setOpenvideos}
            />
          )}

          {Openpdf && (
            <EducationalPDF visible={Openpdf} setOpenpdf={setOpenpdf} />
          )}

          {OpenBlogs && (
            <EducationalBlogs
              type={'allblogs'}
              visible={OpenBlogs}
              setOpenBlogs={setOpenBlogs}
            />
          )}

          {/* Video Player Modal */}
          {selectedVideo && (
            <Modal
              visible={videoModalVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => {
                setVideoModalVisible(false);
                setSelectedVideo(null);
              }}>
              <View style={styles.videoModalBackground}>
                <View style={styles.videoModalContent}>
                  <View style={styles.videoModalHeader}>
                    <Text style={styles.videoModalTitle} numberOfLines={1}>
                      {selectedVideo.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setVideoModalVisible(false);
                        setSelectedVideo(null);
                      }}>
                      <XIcon size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <YoutubePlayer
                    height={250}
                    play={true}
                    videoId={selectedVideo.id}
                    onChangeState={onStateChange}
                  />
                </View>
              </View>
            </Modal>
          )}

          {/* Blog Viewer Modal */}
          {selectedBlog && (
            <LinkOpeningWeb
              symbol={selectedBlog.title}
              setWebview={setBlogModalVisible}
              webViewVisible={blogModalVisible}
              currentUrl={
                selectedBlog.content && selectedBlog.content.trim().length > 0
                  ? `data:text/html;charset=utf-8,${encodeURIComponent(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  margin: 0;
                  padding: 20px;
                  background-color: #ffffff;
                  color: #333;
                }
                h1, h2, h3, h4, h5, h6 {
                  color: #2c3e50;
                  margin-top: 24px;
                  margin-bottom: 16px;
                }
                p { margin-bottom: 16px; }
                img { max-width: 100%; height: auto; border-radius: 8px; }
                .ql-video { width: 100%; height: 200px; border-radius: 8px; }
                a { color: #3498db; text-decoration: none; }
                a:hover { text-decoration: underline; }
                strong { font-weight: 600; }
                em { font-style: italic; }
                ol, ul { padding-left: 20px; margin-bottom: 16px; }
                li { margin-bottom: 8px; }
              </style>
            </head>
            <body>
              <h1>${selectedBlog.title}</h1>
              <div style="color: #666; font-size: 14px; margin-bottom: 20px;">
                ${convertToTimeAgo(selectedBlog.created_at)}
              </div>
              ${selectedBlog.content}
            </body>
            </html>
          `)}`
                  : selectedBlog.link ||
                  selectedBlog.videoUrl ||
                  `data:text/html;charset=utf-8,${encodeURIComponent(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  text-align: center;
                  padding: 40px 20px;
                  background-color: #f8f9fa;
                  color: #666;
                }
                .message {
                  background: white;
                  padding: 30px;
                  border-radius: 12px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
              </style>
            </head>
            <body>
              <div class="message">
                <h2>${selectedBlog.title}</h2>
                <p>Content is not available for this blog post.</p>
                <p style="font-size: 14px; color: #999;">Published ${convertToTimeAgo(
                    selectedBlog.created_at,
                  )}</p>
              </div>
            </body>
            </html>
          `)}`
              }
            />
          )}

          {/* PDF Viewer Modal */}
          {selectedPDF && (
            <EducationalPDF
              visible={pdfModalVisible}
              setOpenpdf={setPdfModalVisible}
              selectedPDF={selectedPDF}
            />
          )}
        </View>
      </SafeAreaView>
      <Modal
        visible={showEthicalList}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEthicalList(false)}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 24,
              padding: 24,
              width: '92%',
              maxHeight: '100%',
              minHeight: 700,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 8,
            }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Satoshi-Bold',
                  color: '#00639C',
                }}>
                {ETHICAL_CONFIG.modalTitle}
              </Text>
              <TouchableOpacity onPress={() => setShowEthicalList(false)}>
                <Text style={{ fontSize: 18, color: '#00639C' }}>Close</Text>
              </TouchableOpacity>
            </View>
            {ethicalLoading ? (
              <ActivityIndicator
                size="large"
                color="#00639C"
                style={{ marginTop: 40 }}
              />
            ) : (
              <View style={{ flex: 1, minHeight: 200 }}>
                <TextInput
                  value={ethicalSearchQuery}
                  onChangeText={setEthicalSearchQuery}
                  placeholder={ETHICAL_CONFIG.searchPlaceholder}
                  placeholderTextColor="#8AA7C4"
                  style={{
                    borderColor: '#E0E0E0',
                    borderWidth: 1,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginBottom: 8,
                    color: '#003A5C',
                    fontFamily: 'Satoshi-Regular',
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: '#F0F4FF',
                    borderRadius: 6,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    marginBottom: 4,
                  }}>
                  <Text style={{ flex: 1, fontWeight: 'bold', color: '#00639C' }}>
                    {ETHICAL_CONFIG.columns.srNo}
                  </Text>
                  <Text style={{ flex: 3, fontWeight: 'bold', color: '#00639C' }}>
                    {ETHICAL_CONFIG.columns.stockName}
                  </Text>
                  <Text style={{ flex: 2, fontWeight: 'bold', color: '#00639C' }}>
                    {ETHICAL_CONFIG.columns.ticker}
                  </Text>
                </View>
                <FlatList
                  data={
                    ethicalList.filter(item => {
                      const q = (ethicalSearchQuery || '').trim().toLowerCase();
                      if (!q) return true;
                      const name = String(item[ETHICAL_CONFIG.columns.stockName] || '').toLowerCase();
                      const ticker = String(item[ETHICAL_CONFIG.columns.ticker] || '').toLowerCase();
                      return name.includes(q) || ticker.includes(q);
                    })
                  }
                  keyExtractor={(_, idx) => idx.toString()}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={{ paddingBottom: 10 }}
                  renderItem={({ item }) => (
                    <View
                      style={{
                        flexDirection: 'row',
                        backgroundColor: '#F8F9FF',
                        borderRadius: 6,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        marginBottom: 2,
                      }}>
                      <Text style={{ flex: 1, color: '#333' }}>
                        {item[ETHICAL_CONFIG.columns.srNo]}
                      </Text>
                      <Text style={{ flex: 3, color: '#333' }}>
                        {item[ETHICAL_CONFIG.columns.stockName]}
                      </Text>
                      <Text style={{ flex: 2, color: '#333' }}>
                        {item[ETHICAL_CONFIG.columns.ticker]}
                      </Text>
                    </View>
                  )}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* App Update Modal */}
      <UpdateAppModal
        visible={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  headerBP: {
    marginTop: 25,
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Satoshi-Bold',
    color: '#000',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  backButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
  },
  bespokeTabRow: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginTop: 12,
    marginBottom: 6,
  },
  bespokeTabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    height: 40,
  },
  bespokeTabPillText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  headerContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'center',
    paddingBottom: 0,
    overflow: 'hidden',
    width: '100%',
  },
  StockTitle: {
    fontSize: 18,
    color: '#1A1A1A',
    fontFamily: 'Poppins-SemiBold',
  },
  StockTitlebelow: {
    fontSize: 12,

    fontFamily: 'Satoshi-Bold',
    marginBottom: 5,
    color: 'grey',
  },
  viewAllText: {
    fontSize: 10,
    marginTop: 2,
    marginHorizontal: 5,
    fontFamily: 'Poppins-Regular',
    color: '#1F7AE0',
  },

  viewAll: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontFamily: 'Poppins-Medium',
    marginBottom: 5,
    borderWidth: 1,
    borderRadius: 3,
    borderColor: '#1F7AE0',
  },

  borderGradient: {
    borderRadius: 10,
    padding: 2, // This creates the border effect
    marginHorizontal: 15,
    marginTop: 15,
  },
  linearGradient: {
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden', // Ensures child components don't overflow
  },
  searchBarContainer: {
    flexDirection: 'row', // Ensures TextInput and Icon are in a row
    alignItems: 'center', // Vertically centers them
    paddingHorizontal: 10,
    borderRadius: 60,
  },
  searchBar: {
    fontFamily: 'Satoshi-Regular',
    textAlignVertical: 'center',
    alignContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'center',
    flex: 1,
    fontSize: 13,
    padding: 0,
    borderRadius: 30,
    marginHorizontal: 5,
    paddingVertical: 6,
    color: 'white',
  },
  textContainer: {
    alignItems: 'flex-start',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    paddingRight: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerText: {
    fontFamily: 'ObviouslyNarrow-Black',
    fontSize: selectedVariant === 'arfs' ? 45 : 45,
    lineHeight: 55, // Adjust this value to reduce line spacing
    color: '#fff',
    // Example scaling if the font looks squished
  },
  subText: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 10,
    color: '#fff',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  filterButton: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginLeft: 10,
    paddingVertical: 2,
    paddingHorizontal: 15,
    borderColor: '#E6E6E6',
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 12,
    paddingVertical: 3,
    marginBottom: 1,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: 'Satoshi-Regular',
    color: 'black',
  },
  activeTabButton: {
    borderWidth: 1.5,
    borderColor: '#000',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#002A5C1A',
  },
  inactiveTabButton: {
    backgroundColor: '#fff',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 1.5,
  },
  activeTabButtonText: {
    color: '#000',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  inactiveTabButtonText: {
    color: '#00000080',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  labelContainer: {
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  labelText: {
    fontFamily: 'Satoshi-Medium',
    color: '#888',
    marginBottom: 5,
    fontSize: 14,
  },
  magnusHeaderContainer: {
    alignItems: 'flex-start',
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  magnusTitleSection: {
    alignItems: 'flex-start',
  },
  magnusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  magnusMainText: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 22,
    color: '#fff',
  },
  magnusResearchText: {
    fontFamily: 'ObviouslyNarrow-Black',
    fontSize: 36,
    lineHeight: 42,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  magnusSecondaryText: {
    fontFamily: 'ObviouslyNarrow-Black',
    fontSize: 36,
    lineHeight: 42,
    color: 'rgba(255, 255, 255, 0.95)',
    letterSpacing: -0.2,
    marginLeft: 2,
  },
  magnusCredentials: {
    alignItems: 'center',

    alignContent: 'center',
    alignSelf: 'center',
  },
  magnusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignContent: 'center',
    alignSelf: 'center',

    marginBottom: 8,
  },
  magnusAIBadge: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  magnusAIBadgeText: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  magnusVerified: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 0,
  },
  magnusVerifiedText: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    fontWeight: '700',
  },
  magnusTagline: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.1,
    lineHeight: 16,
    marginLeft: 2,
  },
  // Carousel Styles
  carouselWrapper: {
    paddingLeft: 15, // Add consistent left padding
  },
  carouselContainer: {
    paddingRight: 15, // Add right padding to balance the left padding
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: screenWidth - 30, // Full width minus padding
  },
  emptyText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 14,
    color: '#888',
  },
  // Empty State Styles
  emptyStateContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: screenWidth - 60,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  emptyStateIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  emptyStateTitle: {
    fontFamily: 'Satoshi-Bold',
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontFamily: 'Satoshi-Regular',
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Blog Styles
  blogCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    width: 260,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    marginBottom: 10,
    elevation: 3,
    marginLeft: 11,
  },
  blogImage: {
    width: '100%',
    height: 150,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  blogTitle: {
    fontSize: 18,
    fontFamily: 'Satoshi-Bold',
    color: 'white',
  },
  textOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 15,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  timestampText: {
    fontSize: 12,
    color: 'white',
    fontFamily: 'Satoshi-Regular',
    marginLeft: 5,
  },
  // Video Styles
  videoCard: {
    borderRadius: 10,
    overflow: 'hidden',
    width: 300,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    marginLeft: 11, // Consistent alignment
  },
  videoThumbnail: {
    width: '100%',
    height: 150,
    borderRadius: 10,
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  videoTitle: {
    fontSize: 14,
    lineHeight: 15,
    fontFamily: 'Satoshi-Medium',
    fontWeight: 'normal',
    color: 'black',
  },
  videoDetails: {
    fontSize: 12,
    color: '#888',
    fontFamily: 'Satoshi-Light',
  },
  // PDF Styles
  pdfCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    marginRight: 15,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
    marginLeft: 11, // Consistent alignment
  },
  pdfContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pdfIcon: {
    width: 40,
    height: 50,
  },
  pdfCardContent: {
    marginLeft: 10,
    flex: 1,
    flexShrink: 1,
  },
  pdfCardTitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Medium',
    color: '#333',
    flexShrink: 1,
  },
  pdfCardDescription: {
    fontSize: 12,
    fontFamily: 'Satoshi-Light',
    color: '#858585',
    marginTop: 5,
  },
  downloadButton: {
    padding: 10,
  },
  // Video Modal Styles
  videoModalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalContent: {
    width: '90%',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#111',
  },
  videoModalTitle: {
    color: '#fff',
    fontFamily: 'Satoshi-Bold',
    fontSize: 16,
    flex: 1,
    marginRight: 10,
  },
  emptyStateWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    minWidth: screenWidth - 30,
  },
  viewButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  viewButtonText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    color: '#666',
  },
});

export default HomeScreen;
