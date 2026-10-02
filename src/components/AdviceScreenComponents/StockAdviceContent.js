import React, {useRef, useState, useEffect, useMemo} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  FlatList,
  Dimensions,
  useWindowDimensions,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import StockCard from '../../UIComponents/StockAdvicesUI/StockCard';
import BasketCard from '../../UIComponents/StockAdvicesUI/BasketCard';
import {useNavigation} from '@react-navigation/native';
import StockCardLoading from './StockCardLoading';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import RecommendationSuccessModal from '../ModelPortfolioComponents/RecommendationSuccessModal';
import {useTrade} from '../../screens/TradeContext';

import eventEmitter from '../EventEmitter';
import useLTPStore from './DynamicText/useLtpStore';
import APP_VARIANTS from '../../utils/Config';
import LinearGradient from 'react-native-linear-gradient';
import { useConfig } from '../../context/ConfigContext';
import usePeriodicRefresh from '../../utils/usePeriodicRefresh';

import { designColor, designFont } from '../../design/literalTokens';

const StockAdviceContent = React.memo(
  ({
    type,
    planList,
    isDatafetching,
    handleRevertTrades,
    setisBasket,
    stocksWithoutSource,
    handleTradeBasket,
    handleCancelBasket,
    fullsetBasketData,
    setbasketId,
    setbasketName,
    isBasket,
    setBasketData,
    broker,
    setCartContainer,
    setOpenTokenExpireModel,
    funds,
    setOpenBrokerModel,
    handleTradeNow,
    setStockDetails,
    stockDetails,
    cartContainer,
    stockRecoNotExecuted,
    handleBuyPress,
    handleTradePress,
    handleSelectStock,
    handleSingleSelectStock,
    handleDecreaseStockQty,
    handleIncreaseStockQty,
    handleIgnoreTradePress,
    handleLimitOrderInputChange,
    handleQuantityInputChange,
    expandedCardIndex,
    toggleExpand,
    animatedHeight,
  }) => {
    const {
      stockRecoNotExecutedfinal,
      recommendationStockfinal,
      getAllTrades,
      rejectedTrades,
      ignoredTrades,
      getPlanList,
      markPnlRangeActivated,
    } = useTrade();
    const scrollX = useRef(new Animated.Value(0)).current;
    const navigation = useNavigation();

    // Get dynamic colors from config
    const config = useConfig();
    const gradient1 = config?.gradient1 || designColor('0076fb');
    const gradient2 = config?.gradient2 || designColor('002651');
    const mainColor = config?.mainColor || 'rgba(0, 86, 183, 1)';
    const animationRef = useRef(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTab, setSelectedTab] = useState('Bespoke');
    const [isSwitchOn, setIsSwitchOn] = useState(false);
    const [activeRecommendationIndex, setActiveRecommendationIndex] =
      useState(0);
    const recommendationViewabilityConfig = useRef({
      itemVisiblePercentThreshold: 60,
    }).current;
    const onRecommendationViewableItemsChanged = useRef(({viewableItems}) => {
      const visibleItem = viewableItems.find(item => item.isViewable);
      if (visibleItem?.index != null) {
        setActiveRecommendationIndex(visibleItem.index);
      }
    }).current;

    useEffect(() => {
      setActiveRecommendationIndex(currentIndex =>
        Math.min(currentIndex, Math.max(stockRecoNotExecuted.length - 1, 0)),
      );
    }, [stockRecoNotExecuted.length]);

    // Grouping the data in pairs of two
    const {width: screenWidth} = useWindowDimensions();
    const {ltps} = useLTPStore.getState();
    const defaultRationale =
      "This recommendation is based on a comprehensive analysis of the company's growth potential and value metrics. This recommendation also accounts for potential future risks, ensuring a balanced approach to maximizing returns while mitigating uncertainties. Please contact your manager for any queries.";

    const onRefresh = () => {
      setRefreshing(true);
      getAllTrades();
      getPlanList();
      setRefreshing(false);
    };

    // Web F-10 parity (prod StockRecommendation.js poll): refresh the
    // recommendation list on a 45s cadence while this screen is open and the
    // app is foregrounded. Silent — never flips isDatafetching, so no
    // skeleton flicker. Safe under manual-record modals (see
    // usePeriodicRefresh — drafts are stable-keyed local state).
    usePeriodicRefresh(() => getAllTrades({silent: true}));

    const [openSuccessModal, setOpenSucessModal] = useState(null);
    const [OrderPlacementResponse, setOrderPlacementResponse] = useState(null);

    // Utility to save cart items to AsyncStorage
    const saveCartToLocalStorage = async cartItems => {
      try {
        await AsyncStorage.setItem(cartItemsKey, JSON.stringify(cartItems));
      } catch (error) {
        console.error('Error saving cart items to local storage', error);
      }
    };

    // Utility to load cart items from AsyncStorage
    const loadCartFromLocalStorage = async () => {
      try {
        const cartData = await AsyncStorage.getItem(cartItemsKey);
        return cartData ? JSON.parse(cartData) : [];
      } catch (error) {
        console.error('Error loading cart items from local storage', error);
        return [];
      }
    };

    // Add all selected stocks to the cart
    handleSelectAllStocks = async () => {
      //
      try {
        const existingCartItems = [];

        const newStockDetails = stockRecoNotExecuted.reduce((acc, stock) => {
          // Held positions are read-only — never add them to the cart via
          // Select All (2026-08-25 open-position fix).
          if (stock?.isOpenPosition === true) {
            return acc;
          }
          const isSelected = existingCartItems.some(
            selectedStock =>
              selectedStock.tradingSymbol === stock.Symbol &&
              selectedStock.tradeId === stock.tradeId,
          );

          if (!isSelected) {
            const ltp = ltps[stock.Symbol];
            console.log(
              'price we are getting ---in inside of something',
              ltp,
              stock.Symbol,
            );
            // const ltp = price;
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

        const updatedCart = [...existingCartItems, ...newStockDetails];
        await saveCartToLocalStorage(updatedCart);
        setCartContainer(updatedCart);
        eventEmitter.emit('cartUpdated');
        setStockDetails(updatedCart); // Update state to reflect the changes in the UI
      } catch (error) {
        console.error('Error selecting all stocks', error);
      } finally {
      }
    };
    const cartItemsKey = 'cartItems'; // Key for local storage

    // Remove all stocks from the cart
    const handleDeselectAllStocks = async () => {
      try {
        // Clear local storage and update state
        await AsyncStorage.removeItem(cartItemsKey);
        eventEmitter.emit('cartUpdated');
        setCartContainer([]);
        setStockDetails([]); // Clear local state
      } catch (error) {
        console.error('Error removing all stocks', error);
      } finally {
      }
    };

    //handleDeselectAllStocks();

    const uniqueBasketIds = [
      ...new Set(stockRecoNotExecuted.map(trade => trade.basketId)),
    ];
    // Sort baskets by date, latest first
    const sortedBasketIds = uniqueBasketIds.sort((a, b) => {
      const dateA = new Date(
        stockRecoNotExecuted.find(trade => trade.basketId === a).date,
      );
      const dateB = new Date(
        stockRecoNotExecuted.find(trade => trade.basketId === b).date,
      );
      return dateB - dateA;
    });

    //console.log('sortedBasketID:',(type === 'All' || type === 'OSrejected') && stockRecoNotExecuted.length > 0);

    const groupedData = useMemo(() => {
      const startTime = new Date().getTime(); // Start time before filtering
      const grouped = [];
      for (let i = 0; i < stockRecoNotExecuted.length; i += 1) {
        grouped.push([stockRecoNotExecuted[i], stockRecoNotExecuted[i + 1]]);
      }
      const endTime = new Date().getTime();
      // console.log(Grouping took ${endTime - startTime} milliseconds);

      return grouped;
    }, [stockRecoNotExecuted]);

    const filteredAdvcideRangeStocks = useMemo(() => {
      const startTime = new Date().getTime(); // Start time before filtering
      const filtered = stockRecoNotExecuted.filter(ele => {
        // Held positions are read-only and never count toward Select All
        // (2026-08-25 open-position fix).
        if (ele?.isOpenPosition === true) return false;
        const ltp = ltps[ele.Symbol];
        const advisedRangeLower = parseFloat(ele.Advised_Range_Lower);
        const advisedRangeHigher = parseFloat(ele.Advised_Range_Higher);
        return (
          (advisedRangeHigher === 0 && advisedRangeLower === 0) ||
          (advisedRangeHigher === null && advisedRangeLower === null) ||
          (advisedRangeHigher > 0 &&
            advisedRangeLower > 0 &&
            parseFloat(advisedRangeHigher) > parseFloat(ltp) &&
            parseFloat(ltp) > parseFloat(advisedRangeLower)) ||
          (advisedRangeHigher > 0 &&
            advisedRangeLower === 0 &&
            advisedRangeLower === null &&
            parseFloat(advisedRangeHigher) > parseFloat(ltp)) ||
          (advisedRangeLower > 0 &&
            advisedRangeHigher === 0 &&
            advisedRangeHigher === null &&
            parseFloat(advisedRangeLower) < parseFloat(ltp))
        );
      });
      const endTime = new Date().getTime();
      //  console.log(`Filtering took ${endTime - startTime} milliseconds`);
      return filtered;
    }, [stockRecoNotExecuted]);

    // console.log('this length---',filteredAdvcideRangeStocks.length,cartContainer.length);

    //console.log('groupedData we get-->',groupedData);
    //   console.log('stock detoooo:::',stockDetails);
    // Initialize with stockDetails
    const [expandedCardId, setExpandedCardId] = useState(null);

    const renderItemOrder = ({item, index}) => {
      // console.log('item i get heer---:',item);
      const basket = item;

      if (basket?.basketId) {
          console.log('here basket i have---',basket);
        return (
          <View
            style={[
              styles.cardContainer,
              {
                width: screenWidth * 0.96,
                marginVertical: type === 'All' ? 5 : 0,
              },
            ]}>
            <BasketCard
              basket={basket}
              setisBasket={setisBasket}
              setbasketId={setbasketId}
              setbasketName={setbasketName}
              handleTradeBasket={handleTradeBasket}
              onCancelBasket={handleCancelBasket}
              fullsetBasketData={fullsetBasketData}
              setBasketData={setBasketData}
              setStockDetails={setStockDetails}
              handleTradeNow={handleTradeNow}
              setOpenTokenExpireModel={setOpenTokenExpireModel}
              funds={funds}
              setOpenBrokerModel={setOpenBrokerModel}
            />
          </View>
        );
      }

      if (item) {
        return (
          <View
            style={[
              styles.cardContainer,
              {
                width: screenWidth * 0.94,
                marginVertical: type === 'All' || type === 'OSrejected' ? 5 : 0,
                alignSelf: type === 'All' ? 'center' : 'flex-start',
              },
            ]}>
            <StockCard
              type={type}
              id={item._id}
              symbol={item.Symbol}
              ltp={item.LTP}
              stockRecoNotExecuted={stockRecoNotExecuted}
              planList={planList}
              action={item.Type}
              closurestatus={item.closurestatus}
              segment={item.Segment}
              strike={item.Strike}
              Exchange={item.Exchange}
              OptionType={item.OptionType}
              searchSymbol={item.searchSymbol}
              advisedPrice={item.price_when_send_advice}
              pnlRangeActivated={item.pnlRangeActivated}
              onPnlRangeActivate={markPnlRangeActivated}
              advisedRangeLower={item.Advised_Range_Lower}
              advisedRangeHigher={item.Advised_Range_Higher}
              OrderType={item.OrderType}
              quantity={item.Quantity}
              date={item.date}
              rationale={item.rationale}
              Price={item.Price}
              tradeId={item.tradeId}
              handleRevertTrades={handleRevertTrades}
              handleTradePress={handleTradePress}
              handleIgnoreTradePress={handleIgnoreTradePress}
              handleDecreaseStockQty={handleDecreaseStockQty}
              handleIncreaseStockQty={handleIncreaseStockQty}
              handleSelectStock={handleSelectStock}
              handleLimitOrderInputChange={handleLimitOrderInputChange}
              handleQuantityInputChange={handleQuantityInputChange}
              isSelected={cartContainer.some(
                stock =>
                  stock.tradingSymbol === item.Symbol &&
                  stock.tradeId === item.tradeId,
              )}
              index={index} // Pass index here
              isExpanded={expandedCardIndex === index} // Expansion logic
              onToggleExpand={() => toggleExpand(index)} // Toggle function
              animatedHeight={animatedHeight}
              stopLoss={item?.stopLoss}
              profitTarget={item?.profitTarget}
              cancel={item?.cancel}
              edit={item?.edit}
              tradePlaceStatus={item?.trade_place_status}
              rejectionMessage={item?.orderStatusMessage || item?.message_aq}
              rejectionClassification={item?.classification}
              rejectionBroker={item?.user_broker || broker}
              planName={item?.trade_given_by_fileName || item?.group}
              advisedPriceByAdvisor={item?.price_when_send_advice}
              positionStatus={item?.positionStatus}
              isOpenPosition={item?.isOpenPosition === true}
              tradedQty={item?.tradedQty}
              tradedPrice={item?.tradedPrice}
              positionBroker={item?.user_broker}
            />
          </View>
        );
      }
    };

    //console.log('filteredadvicerange---',filteredAdvcideRangeStocks.length,cartContainer.length);
    return (
      <SafeAreaView
        style={[
          styles.container,
          {backgroundColor: type === 'home' ? 'transparent' : 'transparent'},
        ]}>
        <FlatList
          data={stockRecoNotExecuted}
          renderItem={renderItemOrder}
          keyExtractor={(item, index) =>
            `${item.Symbol}_${item.tradeId}_${index}`
          }
          horizontal={type === 'home'}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={
            type === 'home' ? onRecommendationViewableItemsChanged : undefined
          }
          viewabilityConfig={
            type === 'home' ? recommendationViewabilityConfig : undefined
          }
          contentContainerStyle={
            type === 'home'
              ? {
                  marginLeft: stockRecoNotExecuted.length > 0 ? 10 : 0,
                  marginRight: 20,
                }
              : {} // Default to no margin if not 'home'
          }
          initialNumToRender={type === 'home' ? 2 : 10}
          maxToRenderPerBatch={type === 'home' ? 2 : 10}
          updateCellsBatchingPeriod={type === 'home' ? 80 : 50}
          windowSize={type === 'home' ? 3 : 5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="black" // Customize indicator color (optional)
            />
          }
          ListEmptyComponent={
            isDatafetching ? (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: screenWidth,
                  padding: 20,
                }}>
                <StockCardLoading />
              </View>
            ) : // <View style={{
            //   flex: 1,
            //   alignItems: 'center',
            //   justifyContent: 'center',
            //   width: screenWidth,
            //   padding: 20,
            // }}>
            //   <LottieView
            //     ref={animationRef}
            //     source={require('../../assets/EmptyAnimation.json')}
            //     autoPlay
            //     loop
            //     style={styles.lottie}
            //   />
            //   <Text style={{ fontFamily: 'Satoshi-Medium', color: 'grey', alignSelf: 'center' }}>
            //     No Bespoke Advice Found!
            //   </Text>
            // </View>
            type === 'OSrejected' ? (
              <LinearGradient
                colors={[gradient1, gradient2]}
                style={{
                  flex: 1,
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
                    shadowColor: designColor('001a40'),
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
                      <Text style={{fontSize: 28}}>📋</Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Title */}
                <Text
                  style={{
                    fontFamily: designFont('Satoshi-SemiBold'),
                    fontSize: 18,
                    color: 'white',
                    textAlign: 'center',
                    marginBottom: 12,
                  }}>
                  No Rejected Orders
                </Text>

                {/* Subtitle */}
                <Text
                  style={{
                    fontFamily: designFont('Satoshi-Medium'),
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.85)',
                    textAlign: 'center',
                    maxWidth: '85%',
                    lineHeight: 20,
                    marginBottom: 12,
                  }}>
                  You don’t have any rejected orders at the moment.
                </Text>

                {/* Extra info */}
                <Text
                  style={{
                    fontFamily: designFont('Satoshi-Regular'),
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.75)',
                    textAlign: 'center',
                    maxWidth: '85%',
                    lineHeight: 20,
                    marginBottom: 16,
                  }}>
                  All your order status information will appear here when
                  available.
                </Text>
              </LinearGradient>
            ) : (
              // Original Bespoke Advice Empty State
              (<LinearGradient
                colors={[gradient1, gradient2]}
                start={{x: 0, y: 1}}
                end={{x: 1, y: 1}}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: screenWidth,
                  padding: 24,
                  borderRadius: 10,
                }}>
                {/* Floating sparkles */}
                <Text
                  style={{
                    position: 'absolute',
                    top: '18%',
                    left: '18%',
                    fontSize: 20,
                    opacity: 0.9,
                  }}>
                  ✨
                </Text>
                <Text
                  style={{
                    position: 'absolute',
                    bottom: '20%',
                    right: '22%',
                    fontSize: 18,
                    opacity: 0.9,
                  }}>
                  ✨
                </Text>
                {/* Icon container */}
                <LinearGradient
                  colors={[gradient1, gradient2]}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 20,
                    shadowColor: designColor('000'),
                    shadowOffset: {width: 0, height: 6},
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}>
                  <Text style={{fontSize: 36, color: 'white'}}>💫</Text>
                </LinearGradient>
                {/* Headings */}
                <Text
                  style={{
                    fontFamily: designFont('Satoshi-Bold'),
                    fontSize: 24,
                    color: 'white',
                    textAlign: 'center',
                    marginBottom: 10,
                  }}>
                  Recommendations
                </Text>
                <Text
                  style={{
                    fontFamily: designFont('Satoshi-Medium'),
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.85)',
                    textAlign: 'center',
                    maxWidth: '85%',
                    lineHeight: 24,
                    marginBottom: 16,
                  }}>
                  Recommendations are not currently available
                </Text>
                <Text
                  style={{
                    fontFamily: designFont('Satoshi-Medium'),
                    fontSize: 16,
                    color: designColor('c2e0ff'),
                    textAlign: 'center',
                    maxWidth: '80%',
                    lineHeight: 22,
                    marginBottom: 8,
                  }}>
                  Hold tight!
                </Text>
                <Text
                  style={{
                    fontFamily: designFont('Satoshi-Regular'),
                    fontSize: 15,
                    color: 'rgba(255,255,255,0.7)',
                    textAlign: 'center',
                    maxWidth: '85%',
                    lineHeight: 22,
                    marginBottom: 24,
                  }}>
                  In the meantime, check out educational blogs, videos & PDFs.
                </Text>
                {/* Glassmorphism Resource Cards */}
                <View style={{width: '100%', marginTop: 8}}>
                  {[
                    {
                      icon: '📝',
                      text: 'Educational blogs with expert insights',
                    },
                    {icon: '🎬', text: 'Video tutorials and masterclasses'},
                    {icon: '📄', text: 'PDF guides and resources'},
                  ].map((item, index) => (
                    <View
                      key={index}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginBottom: 12,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        padding: 14,
                        borderRadius: 14,
                        borderLeftWidth: 3,
                        borderLeftColor: 'rgba(255,255,255,0.7)',
                      }}>
                      <View
                        style={{
                          width: 35,
                          height: 35,
                          borderRadius: 20,
                          backgroundColor: 'rgba(255,255,255,0.25)',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 12,
                        }}>
                        <Text style={{fontSize: 14}}>{item.icon}</Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: designFont('Satoshi-Medium'),
                          color: 'white',
                          flex: 1,
                          fontSize: 12,
                        }}>
                        {item.text}
                      </Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>)
            )
          }
          onEndReachedThreshold={0.5}
        />
        {type === 'home' && stockRecoNotExecuted.length > 1 && (
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Recommendation ${
              activeRecommendationIndex + 1
            } of ${stockRecoNotExecuted.length}. Swipe horizontally for more.`}
            style={styles.recommendationPagination}
            testID="bespoke-recommendation-pagination">
            {stockRecoNotExecuted.map((item, index) => {
              const isActive = index === activeRecommendationIndex;
              return (
                <View
                  key={`${item?.Symbol || 'recommendation'}_${
                    item?.tradeId || 'trade'
                  }_${index}_dot`}
                  style={[
                    styles.recommendationPaginationDot,
                    isActive && [
                      styles.recommendationPaginationDotActive,
                      {backgroundColor: mainColor},
                    ],
                  ]}
                  testID={
                    isActive
                      ? 'bespoke-recommendation-dot-active'
                      : 'bespoke-recommendation-dot'
                  }
                />
              );
            })}
          </View>
        )}
        {(type === 'All' || type === 'OSrejected') &&
          stockRecoNotExecuted.length > 0 && (
            <View style={[styles.buttonsContainer, {width: screenWidth}]}>
              {filteredAdvcideRangeStocks.length === cartContainer.length ? (
                <TouchableOpacity
                  disabled={!planList}
                  style={styles.TradeBtn}
                  onPress={handleDeselectAllStocks}>
                  <Text style={styles.tradeBtnText}>Deselect All</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  disabled={!planList}
                  style={styles.TradeBtn}
                  onPress={handleSelectAllStocks}>
                  <Text style={styles.tradeBtnText}>Select All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.Addbutton,
                  { backgroundColor: mainColor },
                  cartContainer.length === 0 && styles.disabledButton,
                ]}
                onPress={handleTradeNow}
                disabled={cartContainer.length === 0 || !planList}>
                <Text style={styles.addButtonText}>
                  Trade ({cartContainer.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}
        {openSuccessModal && (
          <RecommendationSuccessModal
            openSuccessModal={openSuccessModal}
            setOpenSucessModal={setOpenSucessModal}
            orderPlacementResponse={OrderPlacementResponse}
            currentBroker={broker}
          />
        )}
      </SafeAreaView>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: designColor('fff'),
    flex: 1,

    alignContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    // flex:1,
  },
  cardContainerReb: {
    flexDirection: 'column',
    marginBottom: 30,
    marginHorizontal: 50,
    marginLeft: 5,
  },
  StockTitle: {
    fontSize: 20,
    marginHorizontal: 5,
    fontFamily: designFont('Satoshi-Bold'),
    marginBottom: 5,
    color: 'black',
  },
  filterButton: {
    backgroundColor: 'white',
    borderColor: designColor('e6e6e6'),
    borderRadius: 20,
    marginLeft: 10,
    padding: 5,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  filterButtonText: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Regular'),
    color: 'black',
  },
  lottie: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    alignContent: 'center',
    alignItems: 'center',
  },
  filterButtonfade: {
    backgroundColor: designColor('eeeeee'),
    borderColor: designColor('e6e6e6'),
    borderRadius: 20,
    marginLeft: 10,
    padding: 5,
    borderWidth: 1,
    paddingHorizontal: 25,
  },

  filterButtonTextfade: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Regular'),
    color: 'grey',
  },

  buttonsContainer: {
    flexDirection: 'row',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'white', // Ensure a light background for shadow visibility
    paddingVertical: 10,
    justifyContent: 'space-evenly',
    padding: 5,
    // flex:1,

    shadowColor: 'black', // Shadow color
    shadowOffset: {width: 0, height: -2}, // Negative height to put shadow on top
    shadowOpacity: 0.3, // Opacity of the shadow
    shadowRadius: 5, // Blur radius
    // Shadow for Android
    elevation: 20, // Higher value for more shadow
    // Optional: color of the top border
  },
  Addbutton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '45%',
    backgroundColor: 'rgba(0, 86, 183, 1)',
    padding: 8,
    borderRadius: 3,
  },
  disabledButton: {
    backgroundColor: designColor('00000030'),
  },
  TradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent: 'center',
    alignSelf: 'center',
    backgroundColor: designColor('fff'),
    padding: 8,
    borderRadius: 3,
    width: '45%',
    borderWidth: 1,
    borderColor: designColor('cbcacb'),
    marginHorizontal: 8,
  },
  tradeBtnText: {
    textAlignVertical: 'center',
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('000'),
  },
  addButtonText: {
    textAlignVertical: 'center',
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('fff'),
  },

  seeAllText: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('4b8cee'),
    marginRight: 10,
  },
  carouselContainer: {
    flex: 1,
    alignItems: 'center',
    alignSelf: 'center',
  },
  paginationContainer: {
    alignSelf: 'center',
    marginHorizontal: 100,
  },
  recommendationPagination: {
    minHeight: 18,
    marginTop: 8,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationPaginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    backgroundColor: designColor('c5cbd3'),
  },
  recommendationPaginationDotActive: {
    width: 18,
    borderRadius: 3,
  },
  tabContainer: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  activeTabButton: {
    backgroundColor: designColor('fff'),
  },
  inactiveTabButton: {
    backgroundColor: designColor('f4f4f4'),
  },
  activeTabButtonText: {
    color: 'black',
  },
  inactiveTabButtonText: {
    color: designColor('ababab'),
  },
});

export default StockAdviceContent;
