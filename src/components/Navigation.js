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
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  FolderClock,
  LogOut,
  Shield,
  DollarSign,
  Activity,
  History,
  XIcon,
  CreditCard,
  Ban,
  BanIcon,
  GitFork,
  ChevronRight,
  AlignEndHorizontal,
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
import OnboardingScreen from '../screens/Authentication/OnboardingScreen';
import PhoneLoginScreen from '../screens/Authentication/PhoneLoginScreen';
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
import AdviceScreen from '../screens/Home/HomeScreen';
import PaymentHistoryScreen from '../screens/Drawer/PaymentHistoryScreen';
import AdviceCartScreen from './AdviceScreenComponents/AdviceCartScreen';
import PortfolioScreen from '../screens/PortfolioScreen/PortfolioScreen';
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
import {useNavigationLayout} from '../navigation/useNavigationLayout';
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
import DeleteAccountScreen from '../screens/Home/DeleteAccountScreen';
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
import {getAccountEmail} from '../utils/accountEmail';
import {useComponent} from '../design/useDesign';


import { designColor } from '../design/literalTokens';


const auth = getAuth();
const user = auth.currentUser;
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const DesignVisualLauncher = ({navigation}) => {
  const surfaces = [
    ['Open Home', 'Home'],
    ['Open News', 'DesignVisualNews'],
    ['Open Portfolio', 'DesignVisualPortfolio'],
    ['Open Subscriptions', 'DesignVisualSubscriptions'],
    ['Open Model Portfolio', 'Model Portfolio'],
  ];

  return (
    <SafeAreaView accessibilityLabel="Design visual surfaces">
      <Text>Design visual surfaces</Text>
      {surfaces.map(([label, route]) => (
        <TouchableOpacity key={route} onPress={() => navigation.navigate(route)}>
          <Text>{label}</Text>
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
};

// A stable, presentation-only fixture keeps screenshot CI independent of the
// subscriptions API. The launcher that reaches it is itself protected by both
// visual-build gates below, so production startup can never enter this path.
const DesignVisualSubscriptions = () => {
  const Presentation = useComponent('screens.MySubscriptionsScreen');

  return (
    <Presentation
      viewModel={{
        gradient1: designColor('002651'),
        gradient2: designColor('0076fb'),
        mainColor: designColor('0056b7'),
        activeColor: designColor('29a400'),
        cardElevation: 3,
        cardBorderWidth: 0,
        cardVerticalMargin: 12,
        bespokePlanLabel: 'Bespoke Plans',
        activeSubTab: 'mp',
        mpCount: 0,
        bespokeCount: 0,
        loading: false,
        refreshing: false,
        planCards: [],
      }}
      actions={{
        onBack: () => {},
        onOpenPlan: () => {},
        onTabChange: () => {},
        onBrowsePlans: () => {},
        onRefresh: () => {},
      }}
    />
  );
};
const {height: screenHeight} = Dimensions.get('window');

// Cart bottom-sheet geometry — place the sheet FULLY above the tab bar so
// its entire 100px height is visible. Earlier math only subtracted the tab
// bar height (60 + safe-area), leaving ~70px of the 100px sheet tucked
// behind the tab bar's zIndex:99 — the sheet was "opening" but almost
// entirely obscured, which read as "cart not opening" to the user.
// Tab-bar height now comes from the navigation manifest (`chrome.tabBarHeight`,
// default 60) so a variant with a taller bar keeps the sheet clear of it.
const CART_SHEET_HEIGHT = 100;
const BOTTOM_SHEET_PADDING = 10;
const getBottomSheetPosition = (insets, tabBarHeight = 60) => {
  const safeBottom = insets?.bottom || 0;
  return (
    screenHeight -
    tabBarHeight -
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
const PlansTabWrapper = () => <ModelPortfolioScreen type="tab" />;

// Tab key → screen component. Keys + route names live in the pure catalog
// (src/navigation/screenCatalog.js); variants choose tabs by key in
// designs/<variant>/navigation.js. `more` is an action tab (see below).
const TAB_COMPONENTS = {
  advice: AdviceScreen,
  orders: OrderScreen,
  portfolio: PortfolioScreen,
  plans: PlansTabWrapper,
  news: NewsScreen,
  watchlist: WatchlistScreen,
  more: View, // placeholder — tabPress is intercepted and opens the More stack screen
};

const DesignTabBar = ({state, descriptors, navigation, insets, height}) => {
  const Presentation = useComponent('shell.MainTabBar');
  const items = state.routes.map((route, index) => {
    const options = descriptors[route.key]?.options || {};
    const label = typeof options.tabBarLabel === 'string'
      ? options.tabBarLabel
      : typeof options.title === 'string'
        ? options.title
        : route.name;
    return {
      key: route.key,
      name: route.name,
      label,
      focused: state.index === index,
      params: route.params,
      accessibilityLabel: options.tabBarAccessibilityLabel,
      testID: options.tabBarButtonTestID,
      icon: options.aqIcon,
    };
  });

  const onSelect = item => {
    const event = navigation.emit({
      type: 'tabPress',
      target: item.key,
      canPreventDefault: true,
    });
    if (!item.focused && !event.defaultPrevented) {
      navigation.navigate(item.name, item.params);
    }
  };
  const onLongPress = item => navigation.emit({
    type: 'tabLongPress',
    target: item.key,
  });

  return (
    <Presentation
      viewModel={{
        items,
        activeColor: tabIconColor,
        backgroundColor: bottomTabbg,
        borderTopWidth: bottomTabBorderTopWidth,
        bottomInset: insets?.bottom || 0,
        height,
      }}
      actions={{onSelect, onLongPress}}
    />
  );
};

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
  const migrationUserEmail = getAccountEmail();
  const insets = useSafeAreaInsets();
  const navLayout = useNavigationLayout();
  const bottomSheetPosition = getBottomSheetPosition(
    insets,
    navLayout.chrome.tabBarHeight,
  );
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const [cartCount, setCartCount1] = useState(0);
  const navigation = useNavigation();
  const AppHeader = useComponent('shell.AppHeader');
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
  // it to avoid the duplicate-header look. Variants that only theme the
  // legacy chrome (moneyman_app — green paint, no bespoke header) opt into
  // showing it. Default keeps showing it.
  //
  // The manifest's `chrome.legacyToolbar` is the variant-facing switch. The
  // DESIGN_VARIANT allow-list is kept as a transitional gate so a fork that
  // sets DESIGN_VARIANT to a variant not registered here (it resolves to
  // default) keeps today's hidden toolbar. Remove once every fork declares
  // `chrome.legacyToolbar` in its own manifest (P4).
  const HEADER_VARIANTS = new Set(['default', 'moneyman_app']);
  const showLegacyToolbar =
    navLayout.chrome.legacyToolbar &&
    (!Config?.DESIGN_VARIANT || HEADER_VARIANTS.has(Config.DESIGN_VARIANT));

  return (
    <SafeAreaView style={{flex: 1}}>
      <AppHeader
        viewModel={{visible: showLegacyToolbar, currentRoute: currentName}}
        slots={{Toolbar: CustomToolbar}}
      />
      <Tab.Navigator
        initialRouteName={navLayout.initialRouteName}
        tabBar={props => (
          <DesignTabBar {...props} height={navLayout.chrome.tabBarHeight} />
        )}
        screenOptions={() => ({
          // Keep the tab bar visible and avoid installing an irrelevant
          // keyboard listener while broker OTP inputs are active on a stack
          // screen above this still-mounted tab navigator.
          tabBarHideOnKeyboard: false,
          // Account-wide context responses should not rerender every hidden
          // tab scene while the user is navigating on a slower device.
          freezeOnBlur: true,
        })}>
        {/* Tabs come from the variant's navigation manifest
            (designs/<variant>/navigation.js, resolved against
            src/navigation/screenCatalog.js). Route names stay the legacy
            ones (Home/Orders/Portfolio/Plans/News/More). */}
        {navLayout.tabs.map(tab =>
          tab.kind === 'action' ? (
            <Tab.Screen
              key={`${tab.key}-tab`}
              name={tab.routeName}
              component={TAB_COMPONENTS[tab.key] || View}
              listeners={{
                tabPress: e => {
                  e.preventDefault(); // prevent default tab behavior
                  navigation.navigate(tab.routeName); // navigate to stack screen
                },
              }}
              options={{headerShown: false, title: tab.label, aqIcon: tab.icon}}
            />
          ) : (
            <Tab.Screen
              key={`${tab.key}-screen`}
              name={tab.routeName}
              component={TAB_COMPONENTS[tab.key]}
              options={{headerShown: false, title: tab.label, aqIcon: tab.icon}}
            />
          ),
        )}
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
            borderColor: designColor('eee'),
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
  // Screenshot CI must not depend on a live Firebase customer account. Both
  // values are required: one comes from the safe visual env file and the other
  // is injected only by Gradle's explicitly opted-in designVisualTest build.
  // A normal release .env cannot enable this route by itself.
  const designVisualTestFirst =
    String(Config?.B2B_DESIGN_VISUAL_BUILD || '').toLowerCase() === 'true' &&
    String(Config?.REACT_APP_DESIGN_VISUAL_TEST_FIRST || '').toLowerCase() === 'true';

  return (
    <NavigationContainer
      linking={{
        prefixes: ['alphaquark://'],
        config: {screens: {NotificationScreen: 'recommendation/status'}},
      }}
      ref={(nav) => {
        // Expose the imperative navigator to index.js so notification-tap
        // handlers (FCM background + cold-start + notifee tap events) can
        // deep-link. Without this hookup, NatificationServiceNav.navigate
        // silently no-ops with "Navigator is not defined yet."
        if (nav) NatificationServiceNav.setTopLevelNavigator(nav);
      }}
    >
      <Stack.Navigator
        initialRouteName={
          designVisualTestFirst
            ? 'DesignVisualLauncher'
            : sdkBrokerTestFirst
              ? 'SdkBrokerTest'
              : 'Splash'
        }
        screenOptions={{headerShown: false, animation: 'none'}}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="DesignVisualLauncher"
          component={DesignVisualLauncher}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="DesignVisualNews"
          component={NewsScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="DesignVisualPortfolio"
          component={PortfolioScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="DesignVisualSubscriptions"
          component={DesignVisualSubscriptions}
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
        {/*
          Phone-first login flow (Onboarding video carousel → PhoneLogin
          capture), gated by config.phoneFirstLoginEnabled (default OFF).
          Registration here is inert — SplashScreen only navigation.replace()s
          to 'Onboarding' when the advisor has opted in; otherwise these
          screens are simply never routed to. See SplashScreen.js +
          ConfigContext.js.
        */}
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="PhoneLogin"
          component={PhoneLoginScreen}
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
          name="DeleteAccountScreen"
          component={DeleteAccountScreen}
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
