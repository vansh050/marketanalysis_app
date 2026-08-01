import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {NavigationContainer, useNavigation, useNavigationState, useRoute} from '@react-navigation/native';
import SdkSelfTestScreen from '../sdk/SdkSelfTestScreen';
import SdkBrokerTestScreen from '../sdk/SdkBrokerTestScreen';
import {isSdkIntegrationEnabled} from '../sdk/SdkProviderRoot';
// `Config` is imported below from '../utils/safeConfig' for the rest
// of this file — re-use that one for SDK env vars.
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabBar,
} from '@react-navigation/bottom-tabs';
import {
  FolderClock,
  LogOut,
  Shield,
  FileText,
  DollarSign,
  Activity,
  History,
  Newspaper,
  Briefcase,
  XIcon,
  CreditCard,
  Ban,
  BanIcon,
  GitFork,
  Home,
  ChevronRight,
  AlignEndHorizontal,
  Clipboard,
  User,
  Video,
  BookOpen,
  MessageSquare,
} from 'lucide-react-native';
import HomeScreen from '../screens/Home/HomeScreen';
import PhoneNumberScreen from '../screens/Authentication/PhoneNumberScreen';
import NotificationListScreen from './NotificationListScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NewsInfoScreen from '../screens/Home/NewsScreen/NewsInfoScreen';
import ProgressBar from 'react-native-progress-step-bar';
import LinearGradient from 'react-native-linear-gradient';
import Icon1 from 'react-native-vector-icons/Octicons';
import Icon2 from 'react-native-vector-icons/Ionicons';
import SignupScreen from '../screens/Authentication/SignupScreen';
import WebViewScreen from './WebViewScreen';
import LoginScreen from '../screens/Authentication/LoginScreen';
import LogOutScreen from '../screens/Authentication/LogOutScreen';
import ProfileScreen from '../screens/Home/ProfileScreen';
import ResetPasswordScreen from '../screens/Authentication/ResetPassword';
import SubscriptionScreen from '../screens/Home/SubscriptionScreen';
import TermandConditions from '../screens/Drawer/TermandConditionsScreen';
import OrderScreen from '../screens/Home/OrderScreen';
import WatchlistScreen from '../screens/Home/WatchlistScreen';
import WishSearch from '../screens/Home/WishSearch';
import CustomToolbar from './CustomToolbar';
import NatificationServiceNav from './NatificationServiceNav';
import {useConfig} from '../context/ConfigContext';
import HistoryScreen from '../screens/Home/HistoryScreen';
import AdviceScreen from '../screens/Home/HomeScreen';
import PaymentHistoryScreen from '../screens/Drawer/PaymentHistoryScreen';
import AdviceCartScreen from './AdviceScreenComponents/AdviceCartScreen';
import PortfolioScreen from '../screens/PortfolioScreen/PortfolioScreen';
import IgnoreTradesScreen from '../screens/Drawer/IgnoreTradesScreen';
import ProductCatalogScreen from '../screens/Drawer/ProductCatalogScreen';
import PrivacyPolicyScreen from '../screens/Drawer/PrivacyPolicyScreen'; // New screen
import {
  getAuth,
  signOut,
  onAuthStateChanged,
} from '@react-native-firebase/auth';
import ProfileModalHelp from './ProfileModalHelp';
import server from '../utils/serverConfig';
import axios from 'axios';
import eventEmitter from './EventEmitter';
import LogoutScreen from '../screens/Authentication/LogOutScreen';
import AddToCartModal from './AdviceScreenComponents/AddtoCartModal';
import {useModal} from '../components/ModalContext';
import ModelPortfolioScreen from '../screens/Drawer/ModelPortfolioScreen';
import MPPerformanceScreen from '../screens/Drawer/MPPerformanceScreen';
import ResearchReportScreen from '../screens/Home/ResearchReportScreen';
import RecommendationMessagesScreen from '../screens/Home/RecommendationMessagesScreen';
import PushNotificationScreen from '../screens/Home/PushNotificationScreen';
import TradePnLScreen from '../screens/Home/TradePnLScreen';

import ProfileModal from './ProfileModal';
import HoldingsMigrationModal from './HoldingsMigrationModal';

import ReviewScreen from '../screens/Drawer/ReviewScreen';
import AfterSubscriptionScreen from '../screens/Home/AfterSubscriptionScreen';
import MySubscriptionsScreen from '../screens/Home/MySubscriptionsScreen';
import NewsScreen from '../screens/Home/NewsScreen/NewsScreen';
import SplashScreen from './SplashScreen';
import {useTrade} from '../screens/TradeContext';
import Config from '../utils/safeConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import APP_VARIANTS from '../utils/Config';
import {style} from 'twrnc';
import VideosScreen from './HomeScreenComponents/KnowledgeHubScreen/VideoScreen';
import PDFsScreen from './HomeScreenComponents/KnowledgeHubScreen/PdfScreen';
import BlogsScreen from './HomeScreenComponents/KnowledgeHubScreen/BlogScreen';
import SignUpRADetails from '../screens/Authentication/SignUpRADetails';
import EmailScreenAppleLogin from '../screens/Authentication/EmailScreenAppleLogin';
import UpdateEmailScreen from '../screens/Home/UpdateEmailScreen';
import AccountSettingsScreen from '../screens/Home/AccountSettingsScreen';
import KnowledgeHub from './HomeScreenComponents/KnowledgeHub';
import BespokePerformanceScreen from '../screens/Drawer/BespokePerformanceScreen';
import ChangeAdvisor from '../screens/AccountSettingScreen/ChangeAdvisor';
import WebinarsListScreen from '../screens/Courses/WebinarsListScreen';
import WebinarDetailScreen from '../screens/Courses/WebinarDetailScreen';
import MyCoursesScreen from '../screens/Courses/MyCoursesScreen';
import CourseDetailScreen from '../screens/Courses/CourseDetailScreen';
import BrokerSelectionScreen from '../screens/Broker/BrokerSelectionScreen';
import BrokerAuthScreen from '../screens/Broker/BrokerAuthScreen';
import BrokerCredentialScreen from '../screens/Broker/BrokerCredentialScreen';
import InvestFlowScreen from '../screens/Invest/InvestFlowScreen';
import CurrentHoldingsScreen from '../screens/Rebalance/CurrentHoldingsScreen';
import RebalanceReviewScreen from '../screens/Rebalance/RebalanceReviewScreen';
import ExecutionStatusScreen from '../screens/Rebalance/ExecutionStatusScreen';
import {getAdvisorSubdomain} from '../utils/variantHelper';
import { useWebSocketInitializer } from '../utils/websocketInitializer';


const auth = getAuth();
const user = auth.currentUser;
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const {height: screenHeight} = Dimensions.get('window');

// Cart bottom-sheet geometry — place the sheet FULLY above the tab bar so
// its entire 100px height is visible. Earlier math only subtracted the tab
// bar height (60 + safe-area), leaving ~70px of the 100px sheet tucked
// behind the tab bar's zIndex:99 — the sheet was "opening" but almost
// entirely obscured, which read as "cart not opening" to the user.
const TAB_BAR_HEIGHT = 60;
const CART_SHEET_HEIGHT = 100;
const BOTTOM_SHEET_PADDING = 10;
const getBottomSheetPosition = (insets) => {
  const safeBottom = insets?.bottom || 0;
  return (
    screenHeight -
    TAB_BAR_HEIGHT -
    safeBottom -
    CART_SHEET_HEIGHT -
    BOTTOM_SHEET_PADDING
  );
};

const selectedVariant = Config?.APP_VARIANT || 'rgxresearch'; // Default to "rgxresearch" if not set
// Ensure the variant exists in APP_VARIANTS, otherwise use 'rgxresearch'
const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : 'rgxresearch';
const {
  logo: LogoComponent,
  themeColor,
  CardborderWidth,
  bottomTabbg,
  mainColor,
  secondaryColor,
  gradient1,
  bottomTabBorderTopWidth,
  gradient2,
  cardElevation,
  cardverticalmargin,
  placeholderText,
  tabIconColor,
} = APP_VARIANTS[validVariant];
const CustomTabBarIcon = ({name, focused}) => {
  // Bottom-nav icons mirror the alphanomy-improved.html mockup's app
  // chrome: house / file / briefcase / clipboard / user. The legacy
  // mapping (Notebook / BookmarkPlus / Newspaper) predates the rebrand.
  let IconComponent;
  if (name === 'Home') {
    IconComponent = Home;
  } else if (name === 'More') {
    IconComponent = User;
  } else if (name === 'Orders') {
    IconComponent = FileText;
  } else if (name === 'Portfolio') {
    IconComponent = Briefcase;
  } else if (name === 'News') {
    IconComponent = Newspaper;
  } else if (name === 'Plans') {
    IconComponent = Clipboard;
  }
  return (
    <View
      style={{
        alignItems: 'center', // Centers children horizontally
        flexDirection: 'column', // Stacks the icon and text vertically
        height: '100%', // Takes full height of parent
        alignContent: 'center',
        alignSelf: 'center',
        paddingTop: 8,
      }}>
      <View>
        <IconComponent size={22} color={focused ? tabIconColor : 'gray'} />
      </View>

      <View
        style={{
          alignContent: 'center',
          alignItems: 'center',
          alignSelf: 'center',
          justifyContent: 'center',
        }}>
        <Text
          style={{
            color: focused ? tabIconColor : 'gray', // Changes color based on focus
            fontSize: 10, // Sets font size for text
            marginTop: 2,
            textAlign: 'center',
            width: '100%', // Adds space between icon and text
            fontFamily: 'Satoshi-Medium', // Sets font style
            // Allows the text to wrap if needed
          }}>
          {name}
        </Text>
      </View>
    </View>
  );
};

const PlansTabWrapper = () => <ModelPortfolioScreen type="tab" />;

const MainTabNavigator = () => {
  const {
    isModalVisible,
    hideAddToCartModal,
    setsuccessclosemodel,
    successclosemodel,
  } = useModal();
  const {
    showMigrationModal,
    setShowMigrationModal,
    migrationBroker,
    configData,
    userDetails,
  } = useTrade();
  const migrationUserEmail = userDetails?.email;
  const insets = useSafeAreaInsets();
  const bottomSheetPosition = getBottomSheetPosition(insets);
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const [cartCount, setCartCount1] = useState(0);
  const navigation = useNavigation();
  // console.log('cartOpentdd');
  // Load cart items and count from AsyncStorage when the modal is opened
  useEffect(() => {
    const handleCartUpdate = async () => {
      const startTime = global.performance.now();

      const cartData = await AsyncStorage.getItem('cartItems');
      const items = cartData ? JSON.parse(cartData) : [];
      console.log('CARTTTTT lengethhhhhhhhhhhhhh:vvvv', items.length);
      setCartCount1(items.length);

      const endTime = global.performance.now();
      console.log(`Handle Cart Update took ${endTime - startTime}ms`);
    };
    eventEmitter.on('cartUpdated', handleCartUpdate);
    return () => {
      eventEmitter.off('cartUpdated', handleCartUpdate);
    };
  }, []);

  const slideUp = () => {
    console.log('succcesss:', successclosemodel);
    setsuccessclosemodel(false);
    console.log('success after:', successclosemodel);
    const startTime = global.performance.now();
    Animated.timing(translateY, {
      toValue: bottomSheetPosition,
      duration: 300,
      isInteraction: false,
      useNativeDriver: true,
    }).start(() => {
      const endTime = global.performance.now();
      console.log(`Slide Up animation took ${endTime - startTime}ms`);
    });
  };

  const slideDown = () => {
    const startTime = global.performance.now();
    Animated.timing(translateY, {
      toValue: screenHeight * 2,
      duration: 300,
      useNativeDriver: true,
      isInteraction: false,
    }).start(() => {
      const endTime = global.performance.now();
      // console.log(`Slide Down animation took ${endTime - startTime}ms`);
      hideAddToCartModal();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => gestureState.dy > 10,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(bottomSheetPosition + gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 50) {
          slideDown();
        } else {
          slideUp();
        }
      },
    }),
  ).current;

  useEffect(() => {
    const startTime = global.performance.now();
    if (isModalVisible) {
      slideUp();
    } else if (cartCount === 0 && isModalVisible && successclosemodel) {
      slideDown();
    }
    const endTime = global.performance.now();
    // console.log(`Modal Visibility Effect took ${endTime - startTime}ms`);
  }, [isModalVisible, cartCount]);

  useEffect(() => {
    // If cartCount transitions from 1 to 0, slide down the modal
    if (cartCount === 0 && successclosemodel) {
      slideDown();
    } else if (cartCount > 0 && isModalVisible) {
      // If cartCount is greater than 0 and modal is not visible, open modal
      slideUp();
    }
  }, [cartCount]);
const state = useNavigationState(state => state);

let currentTabRoute = null;
if (state.routes[state.index]?.state) {
  // nested tab navigator inside stack
  const tabState = state.routes[state.index].state;
  currentTabRoute = tabState.routes[tabState.index];
} else {
  // single-level tab navigator
  currentTabRoute = state.routes[state.index];
}

const currentKey = currentTabRoute?.key || "";
const currentName = currentTabRoute?.name || "";
  // Variant-gated chrome: the legacy CustomToolbar (greeting + cart + bell +
  // avatar + ticker strip) wraps every tab screen in the default variant.
  // Variants that ship their own in-screen header (e.g. alphanomy's _AppHeader
  // helper used by HomeScreen / OrderScreen / ModelPortfolioScreen) suppress
  // it to avoid the duplicate-header look. Tenants who want the legacy
  // chrome simply leave DESIGN_VARIANT unset (or set it to "default").
  const showLegacyToolbar =
    !Config?.DESIGN_VARIANT || Config.DESIGN_VARIANT === 'default';

  return (
    <SafeAreaView style={{flex: 1}}>
      {showLegacyToolbar && <CustomToolbar currentRoute={currentName} />}
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({route}) => ({
          tabBarIcon: ({focused}) => (
            <CustomTabBarIcon name={route.name} focused={focused} />
          ),
          tabBarStyle: {
            borderTopLeftRadius: 15,
            borderTopRightRadius: 15,
            backgroundColor: bottomTabbg,
            height: 60 + insets.bottom,
            zIndex: 99,
            elevation: 99,
            marginBottom: 0,
            paddingBottom: insets.bottom,
            borderTopColor: '#e9e9e9',
            borderTopWidth: bottomTabBorderTopWidth,
          },
          tabBarItemStyle: {
            padding: 0,
            margin: 0,
          },
          tabBarShowLabel: false,
        })}>
        <Tab.Screen
          key="home-screen"
          name="Home"
          options={{headerShown: false}}
          component={AdviceScreen}
        />
        <Tab.Screen
          key="orders-screen"
          name="Orders"
          component={OrderScreen}
          options={{headerShown: false}}
        />
        <Tab.Screen
          key="portfolio-screen"
          name="Portfolio"
          component={PortfolioScreen}
          options={{headerShown: false}}
        />
        {selectedVariant === 'arfs' ? (
          <Tab.Screen
            key="news-screen"
            name="News"
            component={NewsScreen}
            options={{headerShown: false}}
          />
        ) : (
          <Tab.Screen
            key="plans-screen"
            name="Plans"
            options={{headerShown: false}}
            component={PlansTabWrapper}
          />
        )}
        <Tab.Screen
          name="More"
          component={View} // just a placeholder
          listeners={{
            tabPress: e => {
              e.preventDefault(); // prevent default tab behavior
              navigation.navigate('More'); // navigate to stack screen
            },
          }}
          options={{headerShown: false}}
        />
      </Tab.Navigator>

      {isModalVisible && (
        <Animated.View
          style={{
            position: 'absolute',
            transform: [{translateY}], // Use transform with translateY instead of top
            left: 0,
            right: 0,
            height: 100,
            elevation: 98,
            shadowColor: 'black',
            borderColor: '#eee',
            borderWidth: 1.6,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: 'rgb(255, 255, 255)',
            zIndex: 98,
          }}
          {...panResponder.panHandlers} // Attach PanResponder handlers
        >
          <AddToCartModal
            isVisible={isModalVisible}
            onClose={hideAddToCartModal}
            setsuccessmodel={setsuccessclosemodel}
            successmodel={successclosemodel}
          />
        </Animated.View>
      )}
      <HoldingsMigrationModal
        isOpen={showMigrationModal}
        onClose={() => setShowMigrationModal(false)}
        userEmail={migrationUserEmail}
        newBroker={migrationBroker}
        onMigrationComplete={() => setShowMigrationModal(false)}
        configHeaderName={configData?.config?.REACT_APP_HEADER_NAME}
      />
    </SafeAreaView>
  );
};

// The right-side drawer was RETIRED 2026-08-01.
//
// It was a second, never-migrated copy of the More menu: `CustomDrawerContent`
// hardcoded `colors={['#012651','#0157B8']}` (AlphaQuark blue) and ignored the
// tenant brand tokens entirely, so on a white-label build an edge-swipe opened a
// visibly foreign screen next to the themed More tab.
//
// It had been deliberately unreachable for a long time (swipeEnabled:false, no
// openDrawer() caller). D17 re-enabled the right-edge swipe to make PaymentHistory /
// MPPerformance discoverable — which exposed the unthemed surface AND reintroduced
// the gesture conflict with horizontal card rows that the same commit warned about.
//
// Every Drawer.Screen it registered (HomeS, Broker Setting, Product Catalog,
// Model Portfolio, Ignored Trades, Privacy Policy, Terms & Conditions, Logout) was
// ALREADY registered on the Stack, so nothing lost a route. The three menu rows that
// had no other caller anywhere — Recommendation Messages, Executed Trade History,
// Ignored Trades — were adopted into AccountSettingsScreen's Insights section.
//
// `Home` and `HomeS` now mount MainTabNavigator directly.
const Navigation = ({userEmail, isAuthenticated}) => {
  const auth = getAuth();
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isCheckingUserDetails, setIsCheckingUserDetails] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');
  useWebSocketInitializer();

  // SDK integration test flag — when true, the app boots straight into
  // SdkBrokerTest so QA can hit each pilot broker without traversing
  // login + drawer. Off by default (Splash → Login → Home).
  const sdkBrokerTestFirst =
    isSdkIntegrationEnabled() &&
    String(Config?.REACT_APP_SDK_BROKER_TEST_FIRST || '').toLowerCase() === 'true';

  return (
    <NavigationContainer
      ref={(nav) => {
        // Expose the imperative navigator to index.js so notification-tap
        // handlers (FCM background + cold-start + notifee tap events) can
        // deep-link. Without this hookup, NatificationServiceNav.navigate
        // silently no-ops with "Navigator is not defined yet."
        if (nav) NatificationServiceNav.setTopLevelNavigator(nav);
      }}
    >
      <Stack.Navigator
        initialRouteName={sdkBrokerTestFirst ? 'SdkBrokerTest' : 'Splash'}
        screenOptions={{headerShown: false, animation: 'none'}}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{headerShown: false}}
        />
        {isSdkIntegrationEnabled() ? (
          <>
            <Stack.Screen
              name="SdkSelfTest"
              component={SdkSelfTestScreen}
              options={{headerShown: true, title: 'SDK self-test'}}
            />
            <Stack.Screen
              name="SdkBrokerTest"
              component={SdkBrokerTestScreen}
              options={{headerShown: true, title: 'SDK Broker test'}}
            />
          </>
        ) : null}
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="EmailScreenAppleLogin"
          component={EmailScreenAppleLogin}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Home"
          component={MainTabNavigator}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="SubscriptionScreen"
          component={SubscriptionScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="WishSearch"
          component={WishSearch}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="AdviceCartScreen"
          component={AdviceCartScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="MPPerformanceScreen"
          component={MPPerformanceScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="WebViewScreen"
          component={WebViewScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="NotificationListScreen"
          component={NotificationListScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="NewsInfoScreen"
          component={NewsInfoScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="PaymentHistoryScreen"
          component={PaymentHistoryScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ReviewScreen"
          component={ReviewScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="AfterSubscriptionScreen"
          component={AfterSubscriptionScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="MySubscriptionsScreen"
          component={MySubscriptionsScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="HistoryScreen"
          component={HistoryScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="RecommendationMessages"
          component={RecommendationMessagesScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ResearchReportScreen"
          component={ResearchReportScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="PushNotificationScreen"
          component={PushNotificationScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="TradePnLScreen"
          component={TradePnLScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="PhoneNumberScreen"
          component={PhoneNumberScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Signup"
          component={SignupScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="SignUpRADetails"
          component={SignUpRADetails}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="HomeS"
          component={MainTabNavigator}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="WebinarsList"
          component={WebinarsListScreen}
          options={{headerShown: true, title: 'Live Webinars'}}
        />
        <Stack.Screen
          name="WebinarDetail"
          component={WebinarDetailScreen}
          options={{headerShown: true, title: 'Webinar'}}
        />
        <Stack.Screen
          name="MyCourses"
          component={MyCoursesScreen}
          options={{headerShown: true, title: 'Courses'}}
        />
        <Stack.Screen
          name="CourseDetail"
          component={CourseDetailScreen}
          options={{headerShown: true, title: 'Course'}}
        />
        <Stack.Screen
          name="Broker Setting"
          component={SubscriptionScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="More"
          component={AccountSettingsScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="UpdateEmailScreen"
          component={UpdateEmailScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Advisor Change"
          component={ChangeAdvisor}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Product Catalog"
          component={ProductCatalogScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Model Portfolio"
          component={ModelPortfolioScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Ignored Trades"
          component={IgnoreTradesScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Privacy Policy"
          component={PrivacyPolicyScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Terms & Conditions"
          component={TermandConditions}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="WatchList"
          component={WatchlistScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="VideosScreen"
          component={VideosScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="PDFsScreen"
          component={PDFsScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="BlogsScreen"
          component={BlogsScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="KnowledgeHub"
          component={KnowledgeHub}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Orders"
          component={OrderScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="BespokePerformanceScreen"
          component={BespokePerformanceScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Logout"
          component={LogOutScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="BrokerSelection"
          component={BrokerSelectionScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="BrokerAuth"
          component={BrokerAuthScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="BrokerCredential"
          component={BrokerCredentialScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="InvestFlow"
          component={InvestFlowScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="CurrentHoldings"
          component={CurrentHoldingsScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="RebalanceReview"
          component={RebalanceReviewScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="ExecutionStatus"
          component={ExecutionStatusScreen}
          options={{headerShown: false}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
export default Navigation;
