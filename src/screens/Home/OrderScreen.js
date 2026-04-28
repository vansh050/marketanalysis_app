import React, {useState, useEffect, useRef, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
// TabView removed — single order list matching web behavior
import {getAuth} from '@react-native-firebase/auth';
import axios from 'axios';
import server from '../../utils/serverConfig';
import Icon from 'react-native-vector-icons/AntDesign';
import {
  Clock,
  CandlestickChartIcon,
  ChevronUp,
  ChevronDown,
  CarTaxiFront,
  ShoppingBasket,
  Binoculars,
  OptionIcon,
  SearchIcon,
} from 'lucide-react-native';
// StockAdvices import removed — rejected orders now shown inline
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import eventEmitter from '../../components/EventEmitter';
import {getAdvisorSubdomain} from '../../utils/variantHelper';

const {width} = Dimensions.get('window');
import { useConfig } from '../../context/ConfigContext';

import CustomTabBar from '../Drawer/CustomTabbar';
import LinearGradient from 'react-native-linear-gradient';
import {useTrade} from '../TradeContext';
import {isOrderSuccess, isOrderRejected, isOrderPending, isOrderCancelled, getOrderStatusDisplay} from '../../utils/orderStatusUtils';
import {isSellAuthRejection} from '../../utils/sellAuthMessage';
import {getBrokerDdpiHelp} from '../../config/brokerDdpiHelp';
import useModalStore from '../../GlobalUIModals/modalStore';

export default function OrderScreen() {
  const {configData} = useTrade();
  const openModal = useModalStore(state => state.openModal);

  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const mainColor = config?.mainColor || '#4CAAA0';
  const secondaryColor = config?.secondaryColor || '#F0F0F0';
  const gradient1 = config?.gradient1 || '#F0F0F0';
  const gradient2 = config?.gradient2 || '#F0F0F0';

  const [imageUrl, setImageUrl] = useState(null);

  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const [allTrades, setAllTrades] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [allOrders1, setAllOrders1] = useState([]);
  const [loading, isLoading] = useState(false);
  const [rejectedTrades, setRejectedTrades] = useState([]);
  const [rejectedTradesToday, setRejectedTradesToday] = useState([]);

  const isToday = date => {
    const today = new Date();
    const inputDate = new Date(date);
    return today.toDateString() === inputDate.toDateString();
  };


  const getAllTrades = () => {
    isLoading(true);
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
        const trades = response.data.trades;

        const executedTrades = trades.filter(
          trade =>
            trade.trade_place_status !== 'recommend' &&
            trade.trade_place_status !== 'ignored',
        );
        const sortedTrades = [...executedTrades].sort((a, b) => {
          const dateA = new Date(a.exitDate || a.purchaseDate || a.date);
          const dateB = new Date(b.exitDate || b.purchaseDate || b.date);

          // Check if either date is invalid
          if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;

          return dateB - dateA; // Sort in descending order (latest date first)
        });

        //  console.log('All sorted Orders:',sortedTrades);
        setAllOrders(sortedTrades);
        setAllOrders1(sortedTrades);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // console.log("all Trades bro",sortedTrades);
        const rejectedOrders = trades.filter(trade => {
          const tradeDate = new Date(trade.date);
          return (
            isOrderRejected(trade.trade_place_status) &&
            (trade.rebalance_status === undefined ||
              trade.rebalance_status === null) &&
            !trade.model_id &&
            tradeDate >= sevenDaysAgo
          );
        });
        const todaysDate = new Date().toLocaleDateString();
        setRejectedTrades(rejectedOrders);
        const rejectedOrdersToday = trades
          .map(trade => ({
            ...trade,
            date: new Date(trade.date).toLocaleDateString(),
          }))
          .filter(
            trade =>
              trade.date === todaysDate &&
              isOrderRejected(trade.trade_place_status) &&
              (trade.rebalance_status === undefined ||
                trade.rebalance_status === null) &&
              !trade.model_id,
          );
        setRejectedTradesToday(rejectedOrdersToday);
        isLoading(false);
      })
      .catch(error => {
        isLoading(false);
        // console.log(error);
      });
  };
  const todaysDate = new Date().toLocaleDateString();
  const filterTodaysExecutedTrades = allOrders
    .map(trade => ({
      ...trade,
      date: new Date(trade.exitDate || trade.purchaseDate || trade.date).toLocaleDateString(),
    }))
    .filter(trade => trade.date === todaysDate);

  useEffect(() => {
    if (userEmail) {
      getAllTrades();
    }
  }, [userEmail]);

  useEffect(() => {
    const handlePortfolioUpdate = async () => {
      getAllTrades();
    };

    // Add event listener for 'cartUpdated' event
    eventEmitter.on('cartUpdated', handlePortfolioUpdate);

    // Cleanup the event listener when the component unmounts
    return () => {
      eventEmitter.off('cartUpdated', handlePortfolioUpdate);
    };
  }, []);

  const renderStatusIcon = () => {
    if (isOrderSuccess(item.trade_place_status)) {
      return <Icon name="check" size={18} color={color2} />;
    } else if (isOrderRejected(item.trade_place_status)) {
      return <Icon name="close" size={18} color={color2} />;
    }
    return null;
  };

  const fetchUserProfile = async () => {
    if (!userEmail || !server?.baseUrl) {
      return;
    }
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
      if (!response.data || !response.data.User) {
        return;
      }
      const profile = response.data.User;
      setImageUrl(profile.image_url);
    } catch (error) {
      // console.error('Error fetching profile:', error.response?.data || error.message);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const formatSymbol = symbol => {
    const regex = /(.*?)(\d{2}[A-Z]{3}\d{2})(\d+)(CE|PE)$/;
    const match = symbol.match(regex);
    if (match) {
      return `${match[1]}${match[2]} | ${match[3]} | ${match[4]}`;
    }
    return symbol;
  };

  const formatOrderDate = isoDate => {
    const dt = new Date(isoDate);
    const optionsDate = {day: '2-digit', month: 'short', year: 'numeric'};
    const optionsTime = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };

    const datePart = dt
      .toLocaleDateString('en-US', optionsDate)
      .replace(',', '');
    const timePart = dt.toLocaleTimeString('en-US', optionsTime);

    return `${datePart} | ${timePart}`;
  };

  const OrderItem = ({item, color1, color2}) => {
    const [showReason, setShowReason] = useState(false);
    const isRejected = isOrderRejected(item.trade_place_status);
    const rejectionReason = item.orderStatusMessage || item.message_aq || '';
    const totalQty = item.Lots || item.Quantity || '';
    const avgPrice = item.AvgPrice || item.tradedPrice || '';

    return (
      <TouchableOpacity
        activeOpacity={isRejected ? 0.7 : 1}
        onPress={() => {
          if (isRejected) setShowReason(prev => !prev);
        }}
        style={styles.orderContainer}>
        <View style={styles.row}>
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            {(item?.Exchange === 'NFO' || item?.Exchange === 'BFO') &&
            item?.OptionType !== 'FUT' ? (
              <Text style={styles.symbol}>
                {item.searchSymbol}
                {(item.Exchange === 'NFO' || item.Exchange === 'BFO') &&
                  ` | ${item.Strike} | ${item.OptionType}`}
              </Text>
            ) : (
              <Text style={styles.symbol}>{item.Symbol}</Text>
            )}
            {item?.model_id ? (
              <View style={styles.mpBadge}>
                <Text style={styles.mpBadgeText}>MP</Text>
              </View>
            ) : null}
          </View>

          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.brokerName}>
              {item?.user_broker || '-'}
            </Text>
            <View
              style={[
                styles.button,
                item.Type === 'BUY' ? styles.buyButton : styles.sellButton,
              ]}>
              <Text style={styles.buttonText}>
                {item.Type === 'BUY' ? 'Buy' : 'Sell'}
              </Text>
            </View>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignContent: 'center',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <View style={styles.detailsRow}>
            <Text style={styles.detailsText}>
              Qty. {item.tradedQty || 0}/{totalQty || '-'}
              {'  '}|{'  '}
              Avg. {avgPrice || '-'}
              {'  '}|{'  '}
              {item.Exchange}
            </Text>
          </View>
          <View style={styles.timestampRow}>
            <Text style={styles.timestampText}>
              {formatOrderDate(
                item.Type === 'BUY'
                  ? (item.purchaseDate || item.date)
                  : (item.exitDate || item.purchaseDate || item.date)
              )}
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 10,
            borderRadius: 3,
            backgroundColor: color1,
            alignItems: 'flex-end',
            alignContent: 'flex-end',
            alignSelf: 'flex-end',
            marginTop: 10,
          }}>
          <Icon
            style={{
              maginRight: 15,
              alignContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
            }}
            name={
              isOrderSuccess(item.trade_place_status)
                ? 'check'
                : isOrderPending(item.trade_place_status)
                ? 'pause'
                : 'close'
            }
            size={13}
            color={color2}
          />
          <Text style={[styles.status, {color: color2}]}>
            {getOrderStatusDisplay(item.trade_place_status)}{' '}
          </Text>
        </View>
        {showReason && rejectionReason ? (
          <View style={styles.rejectionReasonContainer}>
            <Text style={styles.rejectionReasonText}>
              Reason: {rejectionReason}
            </Text>
            {isSellAuthRejection(rejectionReason, item.classification) &&
            getBrokerDdpiHelp(item?.user_broker) ? (
              <TouchableOpacity
                onPress={(e) => {
                  e?.stopPropagation?.();
                  openModal('DdpiHelp', {broker: item.user_broker});
                }}
                hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}
                style={styles.ddpiLearnLink}>
                <Text style={styles.ddpiLearnLinkText}>
                  What is DDPI / EDIS? How to enable →
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };
  const getStatusColors = status => {
    if (isOrderSuccess(status)) {
      return {color1: '#F0FFE8', color2: '#16A085'};
    }
    if (isOrderPending(status)) {
      return {color1: '#F9F0E6', color2: '#D49244'};
    }
    if (isOrderCancelled(status)) {
      return {color1: '#F3F4F6', color2: '#6B7280'};
    }
    // Default for rejected, failure, etc.
    return {color1: '#FDEAEC', color2: '#EA2D3F'};
  };

  const [sortedOrders, setSortedOrders] = useState([]);

  // This effect runs whenever the incoming 'allOrders1' data changes.
  useEffect(() => {
    // Make sure we have data to sort to avoid errors
    if (allOrders1 && allOrders1.length > 0) {
      // 1. Create a shallow copy of the array. It's important not to modify the original prop directly.
      const dataToSort = [...allOrders1];

      // 2. Sort the copied array.
      dataToSort.sort((a, b) => {
        // Create Date objects from the date strings for accurate comparison
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);

        // To sort from latest to earliest (descending), subtract dateA from dateB.
        return dateB - dateA;
      });

      // 3. Update our state with the newly sorted array.
      setSortedOrders(dataToSort);
    } else {
      // If the incoming data is empty, clear our state as well.
      setSortedOrders([]);
    }
  }, [allOrders1]);

  const BasketOrderItem = ({item}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!item.basket_advice || item.basket_advice.length === 0) {
      return null; // Don't render if there's no advice in the basket
    }

    return (
      <View style={styles.basketContainer}>
        <TouchableOpacity
          style={styles.basketHeader}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}>
          <View
            style={{
              flexDirection: 'row',
              alignContent: 'center',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ShoppingBasket style={{marginRight: 10}} size={20} />
            <View>
              <Text style={styles.basketTitle}>{item.basketName}</Text>
              <Text style={styles.basketLegs}>
                {item.basket_advice.length} Orders
              </Text>
            </View>
          </View>

          {isExpanded ? (
            <ChevronUp size={28} color="#333" />
          ) : (
            <ChevronDown size={28} color="#333" />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.basketDetailsContainer}>
            {item.basket_advice.map(subItem => {
              const {color1, color2} = getStatusColors(
                subItem.trade_place_status,
              );
              return (
                <OrderItem
                  key={subItem._id}
                  item={subItem}
                  color1={color1}
                  color2={color2}
                />
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({item}) => {
    const isBasket =
      Array.isArray(item.basket_advice) && item.basket_advice.length > 0;
    if (isBasket) {
      return <BasketOrderItem item={item} />;
    } else {
      const {color1, color2} = getStatusColors(item.trade_place_status);
      return <OrderItem item={item} color1={color1} color2={color2} />;
    }
  };
  const PlacedOrders = () => {
    const [searchText, setSearchText] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [lowPrice, setLowPrice] = useState('');
    const [highPrice, setHighPrice] = useState('');

    const toggleFilter = () => setFilterOpen(prev => !prev);

    // Filtering & search logic including price filters
    const filteredOrders = useMemo(() => {
      const low = parseFloat(lowPrice);
      const high = parseFloat(highPrice);

      return sortedOrders.filter(order => {
        const text = searchText.toLowerCase();
        const matchSymbol = order?.Symbol?.toLowerCase().includes(text);

        // Price filters are applied only if valid numbers entered
        const orderAvgPrice = parseFloat(order?.AvgPrice);
        const passesLowPrice = !isNaN(low) ? orderAvgPrice >= low : true;
        const passesHighPrice = !isNaN(high) ? orderAvgPrice <= high : true;

        return matchSymbol && passesLowPrice && passesHighPrice;
      });
    }, [searchText, lowPrice, highPrice, sortedOrders]);

    return (
      <View style={{flex: 1}}>
        {/* Search Row */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <SearchIcon style={{marginRight: 5}} size={18} color="#9FA5B5" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for Orders"
              placeholderTextColor="#9FA5B5"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        <FlatList
          data={
            filteredOrders.length > 0 || lowPrice || highPrice || searchText
              ? filteredOrders
              : sortedOrders
          } //filteredOrders.length > 0 || (lowPrice || highPrice || searchText) ? filteredOrders : sortedOrders
          keyExtractor={item => item._id}
          renderItem={renderItem}
          ListEmptyComponent={
            loading ? (
              <View
                style={{
                  borderRadius: 16,
                  marginHorizontal: 20,
                  marginVertical: 40,
                  paddingVertical: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <ActivityIndicator size="large" color="#000" />
                <Text
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    color: 'grey',
                    fontFamily: 'Poppins-Medium',
                  }}>
                  Loading your orders...
                </Text>
              </View>
            ) : (
              <LinearGradient
                colors={[gradient1, gradient2]}
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  marginVertical: 20,
                  marginHorizontal: 20,
                  borderRadius: 20,
                  overflow: 'hidden',
                  width: '90%',
                  alignSelf: 'center',
                }}>
                {/* Glow circles */}
                <View
                  style={{
                    position: 'absolute',
                    top: -100,
                    right: -100,
                    width: 300,
                    height: 300,
                    borderRadius: 150,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    bottom: -80,
                    left: -80,
                    width: 250,
                    height: 250,
                    borderRadius: 125,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  }}
                />

                {/* Icon container */}
                <LinearGradient
                  colors={[gradient1, gradient2]}
                  style={{
                    width: 90,
                    height: 90,
                    borderRadius: 45,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 20,
                    shadowColor: '#001A40',
                    shadowOffset: {width: 0, height: 4},
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 6,
                  }}>
                  <View
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: 'rgba(255,255,255,0.85)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                      <Text style={{fontSize: 28}}>🛒</Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Title */}
                <Text
                  style={{
                    fontFamily: 'Satoshi-SemiBold',
                    fontSize: 18,
                    color: 'white',
                    textAlign: 'center',
                    marginBottom: 12,
                  }}>
                  No Orders Data
                </Text>

                {/* Subtitle */}
                <Text
                  style={{
                    fontFamily: 'Satoshi-Medium',
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.85)',
                    textAlign: 'center',
                    maxWidth: '85%',
                    lineHeight: 20,
                    marginBottom: 12,
                  }}>
                  Orders that are placed will appear here.
                </Text>
              </LinearGradient>
            )
          }
        />
      </View>
    );
  };

  const [activeTab, setActiveTab] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const indicatorTranslateX = useRef(new Animated.Value(0)).current;
  const lastOffsetX = useRef(0);

  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleModalState = state => {
      console.log('Trueee here', state);
      if (isModalOpen === true) setIsModalOpen(false);
      else {
        setIsModalOpen(true);
      }
    };

    eventEmitter.on('MODAL_STATE', handleModalState);

    return () => {
      eventEmitter.removeListener('MODAL_STATE', handleModalState);
    };
  }, []);

  const tabs = [
    {id: 0, title: 'Placed Orders'},
    {id: 1, title: 'Rejected Orders'},
  ];

  const animateToTab = index => {
    lastOffsetX.current = -index * width;

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: lastOffsetX.current,
        useNativeDriver: true,
        stiffness: 800,
        damping: 80,
        restDisplacementThreshold: 0.001,
        restSpeedThreshold: 0.001,
      }),
      Animated.spring(indicatorTranslateX, {
        toValue: (width / 2) * index,
        useNativeDriver: true,
        stiffness: 800,
        damping: 80,
        restDisplacementThreshold: 0.001,
        restSpeedThreshold: 0.001,
      }),
    ]).start();
  };

  useEffect(() => {
    animateToTab(activeTab);
  }, [activeTab]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (true) {
          console.log('ismodal', isModalOpen);
          return false;
        }

        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 5
        );
      },
      onPanResponderGrant: () => {
        if (true) {
          console.log('ismodal', isModalOpen);
          return false;
        }
        translateX.stopAnimation();
        indicatorTranslateX.stopAnimation();
        translateX.setOffset(lastOffsetX.current);
      },
      onPanResponderMove: (_, gestureState) => {
        if (true) {
          console.log('ismodal', isModalOpen);
          return false;
        }
        let dx = gestureState.dx;

        // Prevent swiping beyond bounds with resistance
        if (activeTab === 0 && dx > 0) {
          dx *= 0.3;
        } else if (activeTab === tabs.length - 1 && dx < 0) {
          dx *= 0.3;
        }

        translateX.setValue(dx);

        // Update indicator position smoothly
        const progress = -lastOffsetX.current / width - dx / width;
        indicatorTranslateX.setValue((width / 2) * progress);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (true) {
          console.log('ismodal', isModalOpen);
          return false;
        }
        translateX.flattenOffset();

        const velocity = gestureState.vx;
        const isQuickSwipe = Math.abs(velocity) > 0.3;

        let newTab = activeTab;

        // Determine new tab based on gesture
        if (
          (gestureState.dx > width * 0.25 || (isQuickSwipe && velocity > 0)) &&
          activeTab > 0
        ) {
          newTab = activeTab - 1;
        } else if (
          (gestureState.dx < -width * 0.25 || (isQuickSwipe && velocity < 0)) &&
          activeTab < tabs.length - 1
        ) {
          newTab = activeTab + 1;
        }

        setActiveTab(newTab);
        animateToTab(newTab);
      },
      onPanResponderTerminate: () => {
        if (true) {
          console.log('ismodal', isModalOpen);
          return false;
        }
        animateToTab(activeTab);
      },
    }),
  ).current;
  const [showFullSymbol, setShowFullSymbol] = useState(false);

  return (
    <View style={styles.container}>
      <PlacedOrders />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: 'black',
    paddingHorizontal: 15,
  },
  lazylist: {
    borderWidth: 0.5,
    borderColor: '#e4e4e4',
    marginHorizontal: 10,
    paddingVertical: 10,
    marginTop: 5,
  },
  subHeader: {
    fontSize: 13,
    color: 'grey',
    fontFamily: 'Satoshi-Regular',
    paddingHorizontal: 15,
    marginBottom: 8,
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    backgroundColor: '#fff',
    borderBottomColor: '#eee',
  },
  row: {
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  buyButton: {
    alignSelf: 'center',
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    color: '#16A085',
    borderRadius: 4,
  },
  title: {
    fontSize: 13,
    color: '#68666d',

    fontFamily: 'Satoshi-Medium',
  },
  type: {
    fontSize: 10,
    color: 'grey',
    fontFamily: 'Satoshi-Light',
    textAlignVertical: 'bottom',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  symbolCard: {
    margin: 0,
  },
  time: {
    fontSize: 13,
    color: '#68666d',
    marginRight: 10,
    marginLeft: 5,
  },
  status: {
    fontSize: 13,
    color: '#73BE4A',
    fontFamily: 'Satoshi-Medium',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginLeft: 3,
  },
  avg: {
    marginTop: 8,
    fontSize: 12,
    color: 'grey',
    fontFamily: 'Satoshi-Regular',
    alignSelf: 'flex-end',
  },
  avg1: {
    fontSize: 13,
    color: 'grey',
    fontFamily: 'Satoshi-Light',
  },
  avgnum: {
    marginTop: 8,
    fontSize: 13,
    color: 'black',
    fontFamily: 'Satoshi-Regular',
    alignSelf: 'flex-end',
  },

  labelStyle1: {
    color: 'white',
    fontSize: 15,
    fontFamily: 'Satoshi-Medium',
  },
  labelStyle2: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    textAlign: 'center',
    padding: '13%',
    textAlignVertical: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#EFF0EE',
    overflow: 'hidden',
  },
  tabBarGradient: {
    flexDirection: 'row',
    height: 48,
    position: 'relative',
    backgroundColor: '#F0F0F0', // Default, override with inline style using gradient1
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
  },
  indicatorContainer: {
    height: 2,
    backgroundColor: '#E0E0E0',
    position: 'relative',
  },
  tabBar: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 0,
    overflow: 'hidden',
    marginHorizontal: 0,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    height: 44,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  tabButtonActive: {
    backgroundColor: '#2ca327', // Green fill
    borderColor: '#2ca327',
  },
  tabText: {
    color: '#212121',
    fontWeight: '500',
    fontSize: 16,
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  leftTab: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  rightTab: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  indicator: {
    position: 'absolute',
    bottom: 2,
    left: 20,
    width: width / 2.5,
    height: 3,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flexDirection: 'row',
    width: width * 2,
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  tabContent1: {
    flex: 1,
    alignContent: 'center',
  },

  ////
  basketContainer: {
    backgroundColor: '#F0F8FF',

    marginVertical: 6,
    borderRadius: 10,
    elevation: 2,
    borderColor: '#c8c8c8',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 2.5,
  },
  basketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  basketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  basketIcon: {
    marginRight: 12,
  },
  basketTitle: {
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
    fontWeight: '600',
    color: '#1A1A1A',
  },
  basketLegs: {
    fontSize: 13,
    fontFamily: 'Satoshi-Medium',
    color: '#666',
    marginTop: 2,
  },
  basketDetailsContainer: {
    paddingBottom: 5,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FAFAFA', // A slightly different background for the expanded content
  },
  mpBadge: {
    marginLeft: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: '#EEF2FF',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  mpBadgeText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Medium',
    color: '#4F46E5',
  },
  brokerName: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
    color: '#6B7280',
    marginRight: 8,
  },
  orderContainer: {
    backgroundColor: 'transparent',

    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderColor: '#0000000D',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbol: {
    fontSize: 14,
    color: '#232323',
    fontFamily: 'Poppins-Medium',
  },
  button: {
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0,
    elevation: 0,
  },
  buyButton: {
    backgroundColor: '#23bb3e',
  },
  sellButton: {
    backgroundColor: '#ef344a',
  },
  buttonText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
    marginTop: 2,
    paddingHorizontal: 14,
  },
  detailsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  detailsText: {
    color: '#7d7d7d',
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  timestampRow: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  timestampText: {
    color: '#7D7D7D',
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
  },
  rejectionReasonContainer: {
    marginTop: 8,
    backgroundColor: '#FFF5F5',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#EA2D3F',
  },
  rejectionReasonText: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
  },
  ddpiLearnLink: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  ddpiLearnLinkText: {
    color: '#1E7E34',
    fontSize: 11,
    fontFamily: 'Satoshi-Bold',
    textDecorationLine: 'underline',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    marginHorizontal: 15,
  },
  searchInputContainer: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    borderRadius: 6,
    borderColor: '#ecf1f8',
  },
  searchIcon: {
    marginHorizontal: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    backgroundColor: 'transparent',
  },
  filterBtn: {
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    height: 45,
    backgroundColor: '#176FF2',
    borderRadius: 6,
    justifyContent: 'center',
  },
  filterBtnText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
});
