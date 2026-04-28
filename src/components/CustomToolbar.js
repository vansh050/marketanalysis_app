import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Platform,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import {
  AlignCenterVertical,
  AlignJustifyIcon,
  ShoppingBag,
  Wallet,
  Bell,
  ShoppingBasket,
  ShoppingCart,
  SearchIcon,
  BookMarkedIcon,
  Bookmark,
} from 'lucide-react-native';
import React, {useState, useEffect, useRef} from 'react';
import {useNavigation} from '@react-navigation/native';
import {getAuth} from '@react-native-firebase/auth';
import axios from 'axios';
import Icon from 'react-native-vector-icons/AntDesign';
import server from '../utils/serverConfig';
import {useCart} from '../components/CartContext';
import LinearGradient from 'react-native-linear-gradient';
import formatCurrency from '../utils/formatCurrency';
import BrokerSelectionModal from './BrokerSelectionModal';
import IIFLReviewTradeModal from './IIFLReviewTradeModal';
import {useConfig} from '../context/ConfigContext';
import moment from 'moment';

import ICICIUPModal from './BrokerConnectionModal/icicimodal';
import UpstoxModal from './BrokerConnectionModal/upstoxModal';
import AngleOneBookingModal from './BrokerConnectionModal/AngleoneBookingModal';
import ZerodhaConnectModal from './BrokerConnectionModal/ZerodhaConnectModal';
import HDFCconnectModal from './BrokerConnectionModal/HDFCconnectModal';
import DhanConnectModal from './BrokerConnectionModal/DhanConnectModal';
import KotakModal from './BrokerConnectionModal/KotakModal';
import IIFLModal from './iiflmodal';
import AliceBlueConnect from './BrokerConnectionModal/AliceBlueConnect';
import FyersConnect from './BrokerConnectionModal/FyersConnect';
import {useModal} from './ModalContext';
import {useTrade} from '../screens/TradeContext';

import Config from '../utils/safeConfig';
import APP_VARIANTS from '../utils/Config';
import MotilalModal from './BrokerConnectionModal/MotilalModal';
import MarketIndices from './HomeScreenComponents/MarketIndices';
import ProfileModal from './ProfileModal';
import {getAdvisorSubdomain} from '../utils/variantHelper';
const {width, height} = Dimensions.get('window');

const CustomToolbar = React.memo(({count, currentRoute}) => {
  const {configData, configLoading} = useTrade();
  const config = useConfig();
  const selectedVariant = Config?.APP_VARIANT || 'rgxresearch';
  const validVariant = APP_VARIANTS[selectedVariant] ? selectedVariant : 'rgxresearch';
  const fallbackConfig = APP_VARIANTS[validVariant] || {};

  // Get toolbarlogo from config (S3) or fallback
  const toolbarLogo = config?.toolbarlogo || fallbackConfig.toolbarlogo || config?.logo || fallbackConfig.logo;

  // Get dynamic gradient colors from config
  const gradient1 = config?.gradient1 || fallbackConfig.gradient1 || 'rgba(0, 86, 183, 1)';
  const gradient2 = config?.gradient2 || fallbackConfig.gradient2 || 'rgba(0, 38, 81, 1)';

  const {
    userDetails,
    getUserDeatils,
    broker,
    funds,
    getAllFund,
    allNotifications,
  } = useTrade();
  const {cartCount} = useCart();
  const [cartItemCount, setCartItemCount] = useState(0);
  const navigation = useNavigation();

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  // Use Firebase displayName as fallback if userDetails not loaded yet
  const name = userDetails?.name || user?.displayName || user?.email?.split('@')[0];

  const [modalVisible, setModalVisible] = useState(false);

  const imageUrl = user?.photoURL;

  const [showCartModal, setShowCartModal] = useState(false);
  const [OpenTokenExpireModel, setOpenTokenExpireModel] = useState(false);

  const [showModal, setShowModal] = useState(false);

  const dateString = userDetails && userDetails.token_expire;

  // Format the moment object as desired

  const {showAddToCartModal} = useModal();

  // console.log('funds::::::::::::::;;;;;;;;;;;ccccc=======',broker,funds);

  const shineAnim = useRef(new Animated.Value(0)).current;

  const fetchBrokerStatusModal = async () => {
    //setLoading(true);
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
        await getUserDeatils();
        // await getAllFunds();
      } catch (error) {
        //   console.error('Error fetching broker status:', error.response?.data || error.message);
        //  setIsBrokerConnected(false); // Handle error by setting default status
      } finally {
        console.log('Here i Reached :');
        await getUserDeatils();
        // await getAllFunds();
        // setLoading(false);
      }
    }
  };

  //console.log('broker000000-----------:',showupstoxModal);
  //  console.log('l1',broker && broker !== "" );
  //console.log('l1',todayDate > expireTokenDate,todayDate,expireTokenDate );
  const dotStyle = {
    width: 3,
    height: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    left: shineAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, width - (width - 105)], // Move from left to right (to the edge of the button)
    }),
    top: 0, // Keep it at the top of the button
  };

  const buttonSize = 100; // Example size of your button
  const radius = buttonSize / 2;

  //console.log('funddds:',funds);

  const handleOpenCart = async () => {
    showAddToCartModal(() => 1);
  };

  const getUnreadNotificationsCount = () => {
    if (!allNotifications || !allNotifications.notifications) return 0;

    return allNotifications.notifications.filter(
      notification => !notification.isRead,
    ).length;
  };
  //console.log('funds i am getting:---------------------',funds);
  //  console.log('showwwww::::',showKotakModal)
 // console.log('current route-00000000--', currentRoute);
  const getInitials = name => {
    return name?.length > 0 ? name[0]?.toUpperCase() : '';
  };
  return (
    <LinearGradient
      colors={[gradient1, gradient2]}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={{
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
      }}>
      <View style={styles.toolbar}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
              width: 40,
              height: 40,
              borderRadius: 20, // half of width/height for perfect circle
              overflow: 'hidden',
              backgroundColor: '#fff',
              marginRight: 10, // spacing between logo and text
            }}>
            {toolbarLogo && typeof toolbarLogo === 'string' ? (
              <Image
                source={{uri: toolbarLogo}}
                style={{
                  width: 30,
                  height: 30,
                  resizeMode: 'cover',
                }}
              />
            ) : toolbarLogo ? (
              <Image
                source={toolbarLogo}
                style={{
                  width: 30,
                  height: 30,
                  resizeMode: 'cover',
                }}
              />
            ) : (
              <View style={{width: 30, height: 30, backgroundColor: '#ddd'}} />
            )}
          </View>

          <Text style={styles.toolbarText}>Hello, {name}</Text>
        </View>
        <View style={{}}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <TouchableOpacity
              onPress={handleOpenCart}
              style={styles.iconButton}
              accessibilityLabel={`Open cart, ${cartCount} items`}>
              <View style={styles.iconCircle}>
                <ShoppingCart size={18} color="#FFFFFF" />
                {cartCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText} numberOfLines={1}>
                      {cartCount > 99 ? '99+' : cartCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('PushNotificationScreen')}
              style={styles.iconButton}>
              <View style={styles.iconCircle}>
                <Bell size={18} color="#FFFFFF" />

                {getUnreadNotificationsCount() > 0 && (
                  <View style={styles.notificationDot} />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              style={styles.logoContainer}
              pointerEvents="none">
              {imageUrl ? (
                <Image
                  source={{uri: imageUrl}}
                  style={{width: 35, height: 35, borderRadius: 25}}
                />
              ) : (
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 20,
                    marginTop: 2,
                    fontFamily: 'Poppins-Regular',
                  }}>
                  {getInitials(name)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {(modalVisible || OpenTokenExpireModel) && (
          <BrokerSelectionModal
            showBrokerModal={modalVisible}
            OpenTokenExpireModel={OpenTokenExpireModel}
            setShowBrokerModal={setModalVisible}
            setOpenTokenExpireModel={setOpenTokenExpireModel}
            fetchBrokerStatusModal={fetchBrokerStatusModal}
          />
        )}

        {/* Profile Modal */}
        <ProfileModal
          showModal={showModal}
          setShowModal={setShowModal}
          userEmail={userEmail}
          getUserDeatils={getUserDeatils}
        />
      </View>

      <MarketIndices />
    </LinearGradient>
  );
});

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  iconButton: {
    padding: 4,
    marginRight: 5,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#FF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Poppins-Medium',
    lineHeight: 12,
  },
  toolbarText: {
    fontSize: 17,
    fontFamily: 'Satoshi-Medium',
    color: '#fff',
  },
  logoContainer: {
    width: 40, // fixed width
    height: 40, // same as width
    borderWidth: 1,
    borderColor: '#c8c8c8',
    borderRadius: 30, // half of width/height
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // optional
  },
  logo: {
    marginLeft: 5,
    width: 128,
    height: 28,
  },
  profileContainer: {
    backgroundColor: '#1D1D1F',
    width: 35,
    height: 35,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 35,
    height: 35,
    borderRadius: 20,
  },

  balanceWrapper: {
    flexDirection: 'column',
    marginRight: 10,
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },

  balanceAmountContainer: {
    marginBottom: 2,
  },

  balanceAmount: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 1,
  },

  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    marginRight: 3,
  },

  balanceLabel: {
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    color: '#FFFFFF',
    opacity: 0.9,
  },

  positive: {
    color: '#4AFF83',
  },

  negative: {
    color: '#FF5252',
  },

  neutral: {
    color: '#FFFFFF',
  },

  notificationContainer: {
    position: 'relative',
    marginLeft: 10,
  },

  unreadBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default CustomToolbar;
