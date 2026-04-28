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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
  BottomTabBar,
} from '@react-navigation/bottom-tabs';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  useDrawerStatus,
  DrawerItem,
} from '@react-navigation/drawer'; // Import Drawer Navigator
import {
  FolderClock,
  BookmarkPlus,
  LogOut,
  Shield,
  FileText,
  DollarSign,
  Activity,
  History,
  Notebook,
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
const Drawer = createDrawerNavigator();
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
  let IconComponent;
  if (name === 'Home') {
    IconComponent = Home;
  } else if (name === 'More') {
    IconComponent = BookmarkPlus;
  } else if (name === 'Orders') {
    IconComponent = Notebook;
  } else if (name === 'Portfolio') {
    IconComponent = Briefcase;
  } else if (name === 'News') {
    IconComponent = Newspaper;
  } else if (name === 'Plans') {
    IconComponent = Newspaper;
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
  return (
    <SafeAreaView style={{flex: 1}}>
      <CustomToolbar currentRoute={currentName} />
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
            options={{headerShown: false}}>
            {() => <ModelPortfolioScreen type="tab" />}
          </Tab.Screen>
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

const CustomDrawerContent = props => {
  const {configData} = useTrade();
  const navigation = useNavigation();
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const isDrawerOpen = useDrawerStatus(); // Use hook to determine drawer status
  useEffect(() => {
    if (auth.currentUser) {
      setUserEmail(auth.currentUser.email);
    }

    // Fetch the user profile when the drawer opens
    if (isDrawerOpen === 'open') {
      fetchUserProfile();
    }
  }, [isDrawerOpen]); // Dependency array includes drawer status
  const [complete, setcomplete] = useState(0);
  const fetchUserProfile = async () => {
    if (!userEmail || !server.server.baseUrl) {
      return;
    }
    console.log(
      'Profile Pictu:',
      `${server.server.baseUrl}api/user/getUser/${userEmail}`,
    );
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
      if (response.data && response.data.User) {
        const profile = response.data.User;
        // console.log('Profie::--------->>>>>>',profile);

        // Set profile data
        setUserName(profile.name || '');
        setImageUrl(profile.image_url);
        // console.log('prlkkkkkkk',profile.name.length);
        //  setcomplete(profile.profile_completion);
        // Determine current step
        let step = 0;
        if (profile.name.length > 0) step += 1;
        if (profile.email) step += 1;
        if (profile.phone_number) step += 1;

        //  if (profile.telegram_id) step = 4;
        setCurrentStep(step);

        // Calculate completion percentage
        const completionPercentage = (step / 3) * 100;
        setcomplete(completionPercentage);
      }
    } catch (error) {
      console.error(
        'Error fetching profile:',
        error.response?.data || error.message,
      );
    }
  };
  const [showModal, setModal] = useState(false);
  const [showModalHelp, setModalHelp] = useState(false);
  // console.log('app variant:',APP_VARIANTS);
  const getInitials = name => {
    return name.length > 0 ? name[0].toUpperCase() : '';
  };

  const handleDrawerItemPress = screenName => {
    if (props.state.routeNames[props.state.index] === screenName) {
      props.navigation.closeDrawer(); // Just close drawer if already on that screen
    } else {
      props.navigation.navigate(screenName); // Otherwise, navigate
    }
  };

  const CustomDrawerItem = ({label, isSelected, onPress, IconComponent}) => {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{
          marginBottom: 5,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          paddingHorizontal: 0,
          borderBottomWidth: 0.2,

          borderColor: '#c8c8c8',
          backgroundColor: 'transparent',
        }}>
        <View style={{flexDirection: 'row'}}>
          {/* Left Indicator */}
          {isSelected ? (
            <View
              style={{
                backgroundColor: 'white',
                width: 5,
                height: 25,
                borderTopRightRadius: 5,
                borderBottomRightRadius: 5,
                marginLeft: 0,
              }}
            />
          ) : (
            <View
              style={{
                backgroundColor: 'transparent',
                width: 5,
                height: 25,
                borderTopRightRadius: 5,
                borderBottomRightRadius: 5,
                marginLeft: 4,
              }}
            />
          )}

          {/* Icon and Label */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingTop: 10,
            }}>
            {/* Dynamic Icon */}
            {IconComponent && (
              <IconComponent color="#fff" style={{marginHorizontal: 30}} />
            )}
            <Text
              style={{
                color: '#fff',
                fontSize: 12,
                fontFamily: isSelected ? 'Poppins-Medium' : 'Poppins-Regular',
              }}>
              {label}
            </Text>
          </View>
        </View>

        {/* Chevron Icon */}
        <ChevronRight color="#fff" style={{marginRight: 10}} />
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient
      colors={['#012651', '#0157B8']} // Adjust gradient colors as needed
      start={{x: 1, y: 0}}
      end={{x: 0, y: 1}}
      style={{flex: 1}}>
      <SafeAreaView style={{flex: 1}}>
        {/* Scrollable Drawer Content */}

        {selectedVariant === 'magnus' && (
          <View
            style={{
              position: 'absolute',
              right: -20,
              top: 40,
              alignContent: 'flex-start',
              alignItems: 'flex-start',
              alignSelf: 'flex-end',
              width: 200,
              height: 200,
            }}>
            <Text
              style={{
                fontFamily:
                  Platform.OS === 'android'
                    ? 'Gillies'
                    : 'GilliesGothicW01-ExtraBold',
                fontSize: 140,
                overflow: 'hidden',
                color: '#fff',
                opacity: 0.07, // Makes it faded like a watermark
                textShadowColor: 'rgba(0, 0, 0, 0.1)', // Soft shadow for depth
                textShadowOffset: {width: 2, height: 2},
                textShadowRadius: 5,
              }}>
              {' '}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={{
            alignContent: 'flex-end',
            alignItems: 'flex-end',
            alignSelf: 'flex-end',
            paddingHorizontal: 20,
            marginTop: 40,
          }}
          onPress={() => {
            console.log('Drawer close triggered');
            props.navigation.closeDrawer();
          }}>
          <XIcon size={24} color={'#fff'} />
        </TouchableOpacity>

        <DrawerContentScrollView
          ond
          {...props}
          contentContainerStyle={{flexGrow: 1}}>
          {/* Logo and App Name */}
          <View
            style={{
              flexDirection: 'colum',
              alignContent: 'flex-start',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              marginBottom: 0,
              paddingBottom: 10,
              marginLeft: 20,
            }}>
            <View
              style={{
                marginHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 10,
              }}>
              <View
                style={{
                  backgroundColor: '#1D1D1F',
                  width: 40,
                  height: 40,
                  borderRadius: 25,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 15,
                }}>
                {/* Use initials or profile picture */}
                {imageUrl ? (
                  <Image
                    source={{uri: imageUrl}}
                    style={{width: 40, height: 40, borderRadius: 25}}
                  />
                ) : (
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 20,
                      fontFamily: 'Poppins-Regular',
                    }}>
                    {getInitials(userName)}
                  </Text>
                )}
              </View>
              <View>
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 13,
                    fontFamily: 'Poppins-Regular',
                  }}>
                  {userName}
                </Text>
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                  }}>
                  {userEmail}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                marginBottom: 10,
                marginTop: 20,
                marginLeft: 20,
                alignItems: 'center',
              }}>
              <ProgressBar
                steps={3}
                width={200}
                height={4}
                filledBarStyle={{
                  borderRadius: 10,
                  backgroundColor: '#F0C419',
                }}
                backgroundBarStyle={{
                  borderRadius: 10,
                  backgroundColor: '#D9D9D9',
                }}
                currentStep={currentStep}
                stepToStepAnimationDuration={1000}
                withDots={false}
              />
              <Text
                style={{
                  color: 'white',
                  fontFamily: 'Poppins-Regular',
                  marginLeft: 10,
                  fontSize: 12,
                }}>
                {complete.toFixed(2)}%
              </Text>
            </View>
            <View
              style={{
                alignItems: 'center',
                paddingVertical: 4,
                marginLeft: 20,
              }}>
              <TouchableOpacity
                onPress={() => setModal(true)}
                activeOpacity={0.8}
                style={{
                  backgroundColor: 'transparent',
                  padding: 0,
                  elevation: 0,
                  alignContent: 'center',
                  alignItems: 'center',
                  alignSelf: 'center',
                }}>
                <LinearGradient
                  colors={['#00000040', '#FFFFFF1A']}
                  start={{x: 0, y: 0}}
                  end={{x: 0, y: 1}}
                  style={{
                    borderRadius: 15,
                    elevation: 0,
                    paddingVertical: 0,
                    paddingHorizontal: 10,
                    borderColor: '#fff',
                    borderWidth: 0.5,
                  }}>
                  <Text
                    style={{
                      color: '#fff',
                      fontFamily: 'Satoshi-Medium',
                      fontSize: 10,
                      paddingVertical: 5,
                    }}>
                    Complete Profile
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <CustomDrawerItem
            label="Home"
            isSelected={props.state.routeNames[props.state.index] === 'HomeS'}
            onPress={() => handleDrawerItemPress('HomeS')}
            IconComponent={({color, style}) => (
              <Home color={color} style={style} />
            )}
          />
          <CustomDrawerItem
            label="Broker Setting"
            isSelected={
              props.state.routeNames[props.state.index] === 'Broker Setting'
            }
            onPress={() => handleDrawerItemPress('Broker Setting')}
            IconComponent={({color, style}) => (
              <FolderClock color={color} style={style} />
            )}
          />

          <CustomDrawerItem
            label="Plans"
            isSelected={
              props.state.routeNames[props.state.index] === 'Model Portfolio'
            }
            onPress={() => handleDrawerItemPress('Model Portfolio')}
            IconComponent={({color, style}) => (
              <GitFork color={color} style={style} />
            )}
          />

          <CustomDrawerItem
            label="Research Reports"
            isSelected={
              props.state.routeNames[props.state.index] ===
              'ResearchReportScreen'
            }
            onPress={() => handleDrawerItemPress('ResearchReportScreen')}
            IconComponent={({color, style}) => (
              <FileText color={color} style={style} />
            )}
          />

          {false && (
            <CustomDrawerItem
              label="Ignored Trades"
              isSelected={
                props.state.routeNames[props.state.index] === 'Ignored Trades'
              }
              onPress={() => handleDrawerItemPress('Ignored Trades')}
              IconComponent={({color, style}) => (
                <BanIcon color={color} style={style} />
              )}
            />
          )}

          {selectedVariant === 'arfs' && (
            <CustomDrawerItem
              label="Executed Trade History"
              isSelected={
                props.state.routeNames[props.state.index] === 'HistoryScreen'
              }
              onPress={() => handleDrawerItemPress('HistoryScreen')}
              IconComponent={({color, style}) => (
                <CreditCard color={color} style={style} />
              )}
            />
          )}

          <CustomDrawerItem
            label="Invoices"
            isSelected={
              props.state.routeNames[props.state.index] ===
              'PaymentHistoryScreen'
            }
            onPress={() => handleDrawerItemPress('PaymentHistoryScreen')}
            IconComponent={({color, style}) => (
              <CreditCard color={color} style={style} />
            )}
          />

          <View
            style={{
              elevation: 5,

              // iOS
              shadowColor: '#0000008d',
              shadowOffset: {
                width: 0,
                height: 0,
              },
              shadowOpacity: 0,
              shadowRadius: 0,
            }}>
            <CustomDrawerItem
              label="Privacy Policy"
              isSelected={
                props.state.routeNames[props.state.index] === 'Privacy Policy'
              }
              onPress={() => handleDrawerItemPress('Privacy Policy')}
              IconComponent={({color, style}) => (
                <Shield color={color} style={style} />
              )}
            />

            <CustomDrawerItem
              label="Terms & Conditions"
              isSelected={
                props.state.routeNames[props.state.index] ===
                'Terms & Conditions'
              }
              onPress={() => handleDrawerItemPress('Terms & Conditions')}
              IconComponent={({color, style}) => (
                <Activity color={color} style={style} />
              )}
            />
            <CustomDrawerItem
              label="Logout"
              isSelected={
                props.state.routeNames[props.state.index] === 'Logout'
              }
              onPress={() => handleDrawerItemPress('Logout')}
              IconComponent={({color, style}) => (
                <LogOut color={color} style={style} />
              )}
            />
          </View>
        </DrawerContentScrollView>

        <ProfileModal
          showModal={showModal}
          setShowModal={setModal}
          setModalHelp={setModalHelp}
          userEmail={userEmail}
          getUserDeatils={fetchUserProfile}
        />
        <ProfileModalHelp
          showModal={showModalHelp}
          setShowModal={setModalHelp}
        />

        {/* Profile Section at the Bottom */}
      </SafeAreaView>
    </LinearGradient>
  );
};

{
  /* <Drawer.Navigator
drawerContent={(props) => <CustomDrawerContent {...props} />}
screenOptions={{
  drawerStyle: {
    width: '100%', // Makes the drawer full-screen width
    height: '100%', // Makes the drawer full-screen height
    backgroundColor: 'transparent', // To make the content fully customizable with your background color
  },
  drawerType: 'front', // Ensures the drawer slides over the content, covering the full screen
  overlayColor: 'transparent', // Optional: to remove the background dim when the drawer opens
}}
>  */
}

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        swipeEnabled: false,
        drawerPosition: 'right',
        drawerStyle: {
          backgroundColor: 'red',
          width: '100%',
          height: '100%',
        },
        drawerLabelStyle: {
          fontSize: 18,
          fontFamily: 'Poppins-Regular',
        },
        drawerType: 'front', // Ensures the drawer slides over the content, covering the full screen
        overlayColor: 'transparent',
      }}>
      <Drawer.Screen
        name="HomeS"
        component={MainTabNavigator}
        options={{headerShown: false}}
      />
      <Drawer.Screen
        name="Broker Setting"
        component={SubscriptionScreen}
        options={{headerShown: false}}
      />
      <Drawer.Screen
        name="Product Catalog"
        component={ProductCatalogScreen}
        options={{headerShown: false}}
      />
      <Drawer.Screen
        name="Model Portfolio"
        component={ModelPortfolioScreen}
        options={{headerShown: false}}
      />
      <Drawer.Screen
        name="Ignored Trades"
        component={IgnoreTradesScreen}
        options={{headerShown: false}}
      />
      <Drawer.Screen
        name="Privacy Policy"
        component={PrivacyPolicyScreen}
        options={{headerShown: false}}
      />
      <Drawer.Screen
        name="Terms & Conditions"
        component={TermandConditions}
        options={{headerShown: false}}
      />
      <Drawer.Screen
        name="Logout"
        component={LogOutScreen}
        options={{headerShown: false}}
      />
    </Drawer.Navigator>
  );
};
const Navigation = ({userEmail, isAuthenticated}) => {
  const auth = getAuth();
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isCheckingUserDetails, setIsCheckingUserDetails] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Login');
  useWebSocketInitializer();

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{headerShown: false, animation: 'none'}}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{headerShown: false}}
        />
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
          component={DrawerNavigator}
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
          component={DrawerNavigator}
          options={{headerShown: false}}
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
