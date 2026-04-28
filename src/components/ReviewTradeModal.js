import React, {useState, useRef, useCallback, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  ScrollView,
  Pressable,
  FlatList,
} from 'react-native';
import {useWindowDimensions} from 'react-native';
import { XIcon, Trash2Icon, CandlestickChartIcon, ChevronRight, ChevronDown, Minus, Plus, ShoppingBag, MinusIcon, PlusIcon, AlertTriangleIcon } from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Feather';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import axios from 'axios';

// getLastKnownPrice previously used by handleFixSize; dropped 2026-04-17 in
// favor of reading from useLTPStore (the live Zustand source). Kept this
// comment as a breadcrumb — if you need a sync price read inside this file,
// use `useLTPStore.getState().ltps[symbol]`.
import ReviewTradeText from './AdviceScreenComponents/ReviewTradeText';
import {useTotalAmount} from './AdviceScreenComponents/DynamicText/websocketPrice';
import eventEmitter from './EventEmitter';
import IsMarketHours from '../utils/isMarketHours';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';

import CheckBox from '@react-native-community/checkbox';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import SliderButton from './SliderButton';
import LinearGradient from 'react-native-linear-gradient';
const {height: screenHeight} = Dimensions.get('window');
import { useConfig } from '../context/ConfigContext';
import useLTPStore from './AdviceScreenComponents/DynamicText/useLtpStore';
import TotalAmountText from './AdviceScreenComponents/DynamicText/totalAmount';
const ReviewTradeModal = ({
  visible,
  onClose,
  stockDetails,
  setStockDetails,
  placeOrder,
  basketData,
  setBasketData,
  fullbasketData,
  funds,
  loading,
  setisBasket,
  isBasket,
  cartCount,
  setCartCount,
  getCartAllStocks,
  handleSelectStock,
  broker,
}) => {
  //console.log("stock Detailss ----> ",stockDetails);

  // Get dynamic config from API
  const config = useConfig();
  const themeColor = config?.themeColor || '#0056B7';
  const mainColor = config?.mainColor || '#4CAAA0';
  const secondaryColor = config?.secondaryColor || '#F0F0F0';
  const gradient1 = config?.gradient1 || '#F0F0F0';
  const gradient2 = config?.gradient2 || '#F0F0F0';
  const allowAfterHoursOrders = config?.allowAfterHoursOrders;
  const marketGateOpen = IsMarketHours() || allowAfterHoursOrders;

  const {width} = useWindowDimensions();
  const [multiplier, setMultiplier] = useState('1');

  // Surveillance state for Angel One
  const [surveillanceData, setSurveillanceData] = useState(null);
  const [surveillanceLoading, setSurveillanceLoading] = useState(false);
  const [surveillanceChecked, setSurveillanceChecked] = useState(false);

  // Function to check surveillance for AngelOne
  const checkAngelOneSurveillance = async (stocks) => {
    if (broker !== 'Angel One') return null;
    if (surveillanceLoading || surveillanceChecked) return surveillanceData;
    if (!stocks || stocks.length === 0) return null;

    const symbols = stocks.map((stock) => ({
      symbol: stock.tradingSymbol,
      exchange: stock.exchange,
    }));

    setSurveillanceLoading(true);
    try {
      const config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}angelone/equity/surveillance`,
        data: symbols,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': Config.REACT_APP_URL,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };

      const response = await axios.request(config);
      setSurveillanceData(response.data);
      setSurveillanceChecked(true);
      return response.data;
    } catch (error) {
      console.error('Error checking surveillance:', error);
      setSurveillanceChecked(true);
      return null;
    } finally {
      setSurveillanceLoading(false);
    }
  };

  // Check surveillance when modal opens and broker is AngelOne
  useEffect(() => {
    if (
      visible &&
      broker === 'Angel One' &&
      stockDetails.length > 0 &&
      !surveillanceChecked &&
      !surveillanceLoading
    ) {
      checkAngelOneSurveillance(stockDetails);
    }
  }, [visible, broker, stockDetails.length, surveillanceChecked, surveillanceLoading]);

  // Reset surveillance check when modal closes or broker changes
  useEffect(() => {
    if (!visible || broker !== 'Angel One') {
      setSurveillanceChecked(false);
      setSurveillanceData(null);
    }
  }, [visible, broker]);

  useEffect(() => {
    // Emit the modal state
    eventEmitter.emit('MODAL_STATE', visible);
  }, [visible]);
  const handleIncreaseStockQty = (symbol, tradeId) => {
    const newData = stockDetails.map(stock =>
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? {...stock, quantity: stock.quantity + 1}
        : stock,
    );
    //  console.log('Updated Stock Details:', newData); // Debug log
    setStockDetails(newData);
  };
  const handleDecreaseStockQty = (symbol, tradeId) => {
    const newData = stockDetails.map(stock =>
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? {...stock, quantity: Math.max(stock.quantity - 1, 0)}
        : stock,
    );
    //  console.log('Updated Stock Details:', newData); // Debug log
    setStockDetails(newData);
  };
  const handleQuantityInputChange = (symbol, value, tradeId) => {
    const newQuantity = parseInt(value) || 0;
    const newData = stockDetails.map(stock =>
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? {...stock, quantity: newQuantity}
        : stock,
    );
    setStockDetails(newData);
  };

  const [totalQuantity, setTotalQuantity] = useState(1); // State to track total quantity

  const handleIncreaseAllStockQty = () => {
    const newQuantity = totalQuantity + 1; // Increase total quantity by 1
    setTotalQuantity(newQuantity); // Update total quantity state

    // Update stock quantities to match the total quantity
    const newData = basketData.map(stock => ({
      ...stock,
      quantity: newQuantity,
    }));
    setBasketData(newData);
  };

  const handleDecreaseAllStockQty = () => {
    if (totalQuantity > 0) {
      const newQuantity = totalQuantity - 1; // Decrease total quantity by 1
      setTotalQuantity(newQuantity); // Update total quantity state

      // Update stock quantities to match the total quantity
      const newData = basketData.map(stock => ({
        ...stock,
        quantity: newQuantity,
      }));
      setBasketData(newData);
    }
  };

  const handleQuantityInputChangeAll = value => {
    const newQuantity = parseInt(value) || 0; // If invalid, fallback to 0
    setTotalQuantity(newQuantity); // Update total quantity state

    // Update stock quantities to match the total quantity
    const newData = basketData.map(stock => ({
      ...stock,
      quantity: newQuantity,
    }));
    setBasketData(newData);
  };

  const [ltp, setLtp] = useState([]);
  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());
  const failedSubscriptionsRef = useRef({});
  const latestPricesRef = useRef({});
  let dataArray = [];

  const totalAmount = 0;

  const totalAmountBasket = 0;

  const handleRemoveStock = async (symbol, tradeId) => {
    console.log('Removing stock:-----------------=====', symbol, tradeId);
    const startTime = Date.now(); // Capture the start time

    const cartItemsKey = 'cartItems';

    try {
      // Load cart items from AsyncStorage
      const cartData = await AsyncStorage.getItem(cartItemsKey);
      let cartItems = cartData ? JSON.parse(cartData) : [];

      // Filter out stock from state and AsyncStorage
      const updatedStockDetails = stockDetails.filter(
        selectedStock =>
          !(
            selectedStock.tradingSymbol === symbol &&
            selectedStock.tradeId === tradeId
          ),
      );

      const updatedCartItems = cartItems.filter(
        selectedStock =>
          !(
            selectedStock.tradingSymbol === symbol &&
            selectedStock.tradeId === tradeId
          ),
      );

      // Update state and AsyncStorage in parallel
      setStockDetails(updatedStockDetails);

      await AsyncStorage.setItem(
        cartItemsKey,
        JSON.stringify(updatedCartItems),
      );
      const storedCartItems = await AsyncStorage.getItem(cartItemsKey);
      console.log('Review Modal in AsyncStorage:', storedCartItems);
      console.log(
        'Emitting stockRemoved event--------------------->>>>>>>>>>>>>>>>>>>>',
      );
      eventEmitter.emit('stockRemoved', {symbol, tradeId});
    } catch (error) {
      console.error('Error removing stock:', error);
    }
  };

  const [selectedOption, setSelectedOption] = useState('');
  const [inputFixSizeValue, setInputFixValue] = useState('');

  const [originalQuantities, setOriginalQuantities] = useState({});

  // Handle checkbox change - FIRST set all quantities to 1 when checked
  const handleCheckboxChange = value => {
    if (value) {
      // When checking the checkbox, FIRST set all quantities to 1
      const initializedStockDetails = stockDetails.map(stock => ({
        ...stock,
        quantity: stock.quantity === 0 ? 1 : stock.quantity, // Set to 1 if currently 0
      }));

      setStockDetails(initializedStockDetails);
      setSelectedOption('fix');
    } else {
      // When unchecking, reset to original quantities (or 1 if no original)
      const resetStockDetails = stockDetails.map(stock => {
        const key = `${stock.tradingSymbol}-${stock.tradeId}`;
        const originalQty = originalQuantities[key] || 1;
        return {...stock, quantity: originalQty};
      });

      setStockDetails(resetStockDetails);
      setSelectedOption('');
      setInputFixValue('');
      setOriginalQuantities({});
    }
  };

  // Equal-budget allocation: splits the user-entered amount equally across
  // stocks and computes each stock's quantity as floor(amountPerStock /
  // livePrice). Keeps the total within the specified budget — matches the
  // mobile Note text shown next to the input ("ensuring the total investment
  // stays within the specified budget").
  //
  // Intentionally divergent from web's `ReviewTradeModel.js:266-277` which
  // treats the input as per-stock (floor(amount/price) for every stock), so
  // a 2-stock cart at ₹500 + ₹300 with a 2000 input produces a 3800 basket
  // on web but 1900 on mobile. Mobile's behavior matches the label; web's
  // does not. See CHANGELOG 2026-04-17 for the divergence rationale.
  //
  // Reads live prices from `useLTPStore` (the Zustand store that
  // `TotalAmountText` also uses). The older `getLastKnownPrice` helper was
  // reading from a separate `WebSocketManager.lastPrices` Map that the
  // current socket payload (`ltp_update` event) never populates — that's
  // why the Update button was a no-op before 2026-04-17.
  const handleFixSize = () => {
    if (selectedOption !== 'fix' || !inputFixSizeValue) return;
    const targetAmount = parseFloat(inputFixSizeValue);
    if (!targetAmount || stockDetails.length === 0) return;

    // Save current quantities so the "uncheck checkbox" restore works.
    const original = {};
    stockDetails.forEach(stock => {
      original[`${stock.tradingSymbol}-${stock.tradeId}`] = stock.quantity;
    });
    setOriginalQuantities(original);

    const ltps = useLTPStore.getState().ltps;
    const amountPerStock = targetAmount / stockDetails.length;

    const updatedStockDetails = stockDetails.map(stock => {
      const price = parseFloat(ltps[stock.tradingSymbol]);
      if (price > 0) {
        const newQuantity = Math.floor(amountPerStock / price);
        return {...stock, quantity: Math.max(newQuantity, 1)};
      }
      // No live price yet (WebSocket hasn't delivered one) — leave at 1.
      return {...stock, quantity: 1};
    });

    setStockDetails(updatedStockDetails);
  };

  // Reset function
  const handleReset = () => {
    // Reset to quantity 1 for all stocks
    const resetStockDetails = stockDetails.map(stock => ({
      ...stock,
      quantity: 1,
    }));

    setStockDetails(resetStockDetails);
    setSelectedOption('');
    setInputFixValue('');
    setOriginalQuantities({});
  };

  const [buttonTitle, setButtonTitle] = useState(
    'Slide To Place Order | ₹134.07',
  );
  const handleSwipeSuccess = () => {
    //placeOrder();
    setButtonTitle('');
  };

  const scrollViewRef = useRef(null);

  const hasZeroQuantity = stockDetails?.some(
    stock =>
      stock.quantity === 0 ||
      stock.quantity === undefined ||
      stock.quantity === null,
  );

  const hasZeroQuantityBasket = basketData?.some(
    stock => stock?.quantity === 0,
  );
  const [InputFixSizeValue, setInputFixSizeValue] = useState(0);

  const NoteCard = ({text}) => {
    return (
      <View style={styles.card}>
        <View style={styles.line} />
        <Text style={styles.text}>
          <Text style={styles.bold}>Note: </Text>
          {text}
        </Text>
      </View>
    );
  };


  const [expandedTrades, setExpandedTrades] = useState({});

  const toggleTradeExpansion = (tradeId) => {
      setExpandedTrades(prev => ({
        ...prev,
        [tradeId]: !prev[tradeId]
      }));
    };


    const renderTradeRow = ({ item, index }) => {
      const symbol = item.tradingSymbol;
      const iniprice = 0;
      const exe = item.exchange;
      const isExpanded = expandedTrades[item.tradeId] !== false; // Changed this line

      const matchingData = fullbasketData.find(
        (data) => data.Symbol === symbol && data.tradeId === item.tradeId
      );
      console.log("Matching Data---",matchingData);
      const lots = matchingData?.Lots || 1;
      const optionType = matchingData?.OptionType || 'N/A';
      const searchSymbol = matchingData?.searchSymbol || 'N/A';
      const strike = matchingData?.Strike || 'N/A';

      const isLimitOrder = item.orderType === 'LIMIT';
      const hasStopLoss = item.stopLoss;
      const hasTarget = item.target;
      const limitPrice = item.price;

      return (
        <TouchableOpacity
          style={styles.tableRow}
          key={index}
          onPress={() => toggleTradeExpansion(item.tradeId)}
          activeOpacity={0.7}
        >
          <View style={styles.tableCell}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
              <View style={{flex: 1}}>
                <Text style={styles.symbol}>{searchSymbol} {strike} {optionType}</Text>
                <View style={{flexDirection:'row', alignItems: 'center'}}>
                  <View style={[styles.tradeType, item.transactionType === 'SELL' ? styles.sell : styles.buy]}>
                    <Text style={[styles.tradeType1, item.transactionType === 'SELL' ? styles.sell : styles.buy]}>
                      {item.transactionType === 'SELL' ? 'SELL' : 'BUY'}
                    </Text>
                  </View>
                  {isLimitOrder && (
                    <View style={styles.orderTypeBadge}>
                      <Text style={styles.orderTypeText}>LIMIT</Text>
                    </View>
                  )}
                  <ReviewTradeText
                    symbol={symbol || ""}
                    orderType={optionType}
                    exchange={exe}
                    advisedPrice={iniprice || 0}
                    stockDetails={basketData}
                  />
                </View>
              </View>

              <View style={styles.tableCellqtylot}>
                <Text style={styles.tableHeaderText}>Qty/Lot</Text>
                <Text style={styles.quantity}>
                  {item.quantity * lots}/{item.quantity}
                </Text>
              </View>


            </View>

            {/* Show expanded content by default or when expanded */}
            {(isLimitOrder || hasStopLoss || hasTarget) && (
              <View style={styles.expandedContent}>
                {isLimitOrder && limitPrice && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabelText}>Limit Price</Text>
                    <Text style={styles.detailValue}>₹{limitPrice}</Text>
                  </View>
                )}

                {hasStopLoss && (
                  <View style={styles.detailRow}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={[styles.detailLabelText, {color: '#ff6b6b'}]}>Stop Loss</Text>
                    </View>
                    <Text style={[styles.detailValue, {color: '#ff6b6b'}]}>
                      ₹{hasStopLoss}
                    </Text>
                  </View>
                )}

                {hasTarget && (
                  <View style={styles.detailRow}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Text style={[styles.detailLabelText, {color: '#51cf66'}]}>Target</Text>
                    </View>
                    <Text style={[styles.detailValue, {color: '#51cf66'}]}>
                      ₹{hasTarget}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    };

  const renderItem = ({ item }) => {
      const symbol = item.tradingSymbol;
      const iniprice = 0;
      const exe = item.exchange;
      const isExpanded = expandedTrades[item.tradeId];

      const isLimitOrder = item.orderType === 'LIMIT';
      const hasStopLoss = item.stopLoss;
      const hasTarget = item.target;
      const limitPrice = item.price;

      // Format symbol like in StockCard
      const formatSymbol = (symbol) => {
        const regex = /(.*?)(\d{2}[A-Z]{3}\d{2})(\d+)(CE|PE)$/;
        const match = symbol.match(regex);
        if (match) {
          return {
            base: match[1],
            expiry: match[2],
            strike: match[3],
            type: match[4]
          };
        }
        return null;
      };

      const formattedParts = formatSymbol(symbol);

      return (
        <TouchableOpacity
          style={styles.rowContainer}
          onPress={() => toggleTradeExpansion(item.tradeId)}
          activeOpacity={0.7}
        >
          <View style={styles.leftContainer}>
            {formattedParts ? (
              <View style={{flexDirection: 'column'}}>
                <Text style={styles.symbol}>
                  {formattedParts.base}{formattedParts.expiry}
                </Text>
                <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 2}}>
                  <Text style={[styles.symbol, {fontSize: 11, color: '#666'}]}>
                    {formattedParts.strike} {formattedParts.type}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.symbol} numberOfLines={2}>
                {item.tradingSymbol}
              </Text>
            )}

            <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap'}}>
              <View style={[
                styles.cellText1,
                item.transactionType === 'BUY' ? styles.buyOrder : styles.sellOrder,
              ]}>
                <Text style={[
                  styles.cellText,
                  item.transactionType === 'BUY' ? styles.buyOrder : styles.sellOrder,
                ]}>
                  {item.transactionType}
                </Text>
              </View>

              {item?.orderType && (
                <View style={[styles.orderTypeBadge, {marginLeft: 5}]}>
                  <Text style={styles.orderTypeText}>{item.orderType}</Text>
                </View>
              )}
            </View>

            {/* Expandable Content for SL/PT/Limit */}
            {isExpanded && (isLimitOrder || hasStopLoss || hasTarget) && (
              <View style={[styles.expandedContent, {marginTop: 8}]}>
                {isLimitOrder && limitPrice && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabelText}>Limit Price</Text>
                    <Text style={styles.detailValue}>₹{limitPrice}</Text>
                  </View>
                )}

                {hasStopLoss && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabelText, {color: '#ff6b6b'}]}>Stop Loss</Text>
                    <Text style={[styles.detailValue, {color: '#ff6b6b'}]}>
                      ₹{hasStopLoss}
                    </Text>
                  </View>
                )}

                {hasTarget && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabelText, {color: '#51cf66'}]}>Target</Text>
                    <Text style={[styles.detailValue, {color: '#51cf66'}]}>
                      ₹{hasTarget}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.quantitySection}>
        <TouchableOpacity
          onPress={() =>
            handleDecreaseStockQty(item.tradingSymbol, item.tradeId)
          }
          style={styles.iconBtn}>
          <MinusIcon size={14} color="#222" />
        </TouchableOpacity>
        <TextInput
          value={item?.quantity?.toString()}
          style={styles.quantityInput}
          keyboardType="numeric"
          onChangeText={value =>
            handleQuantityInputChange(item.tradingSymbol, value, item.tradeId)
          }
        />
        <TouchableOpacity
          onPress={() =>
            handleIncreaseStockQty(item.tradingSymbol, item.tradeId)
          }
          style={styles.iconBtn}>
          <PlusIcon size={14} color="#222" />
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

          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {(isLimitOrder || hasStopLoss || hasTarget) && (
              <TouchableOpacity
                onPress={() => toggleTradeExpansion(item.tradeId)}
                style={{padding: 5}}
              >
                <ChevronDown
                  size={14}
                  color={'#000'}
                  style={{
                    transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                  }}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={{ marginRight: 10, padding:5, paddingRight:0}}
              onPress={() => handleRemoveStock(item.tradingSymbol, item.tradeId)}
            >
              <Trash2Icon size={18} color={'black'} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    };

  if (basketData?.length > 0) {
    return (
      <Modal
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        animationType="slide">
        <SafeAreaView style={styles.modalOverlay} pointerEvents="box-none">
          <View style={[styles.modalContainer, {width: width * 1}]}>
            <LinearGradient
              colors={['rgba(0, 38, 81, 1)', 'rgba(0, 86, 183, 1)']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 10,
                paddingVertical: 20,
                alignItems: 'center',
              }}>
              <View style={styles.iconContainer}>
                <ShoppingBag
                  style={{marginRight: 10}}
                  size={24}
                  color="white"
                />
                <Text style={styles.basketName}>
                  {fullbasketData[0]?.basketName}
                  {' \u2022'} BASKET
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <XIcon size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            <View style={styles.tableContainer}>
              <FlatList
                data={basketData}
                renderItem={renderTradeRow}
                keyExtractor={item => item.tradeId.toString()}
                ListEmptyComponent={
                  <View
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 20,
                    }}>
                    <View
                      style={{
                        borderRadius: 50,
                        backgroundColor: '#EBECEF',
                        padding: 20,
                      }}>
                      <CandlestickChartIcon size={40} color={'black'} />
                    </View>
                    <Text
                      style={{
                        fontFamily: 'Satoshi-SemiBold',
                        color: 'black',
                        fontSize: 18,
                        marginVertical: 10,
                      }}>
                      No Orders to Place
                    </Text>
                    <Text style={{fontFamily: 'Satoshi-Medium', color: 'grey'}}>
                      Add item to cart to place order.
                    </Text>
                  </View>
                }
                contentContainerStyle={{
                  paddingHorizontal: 10,
                  marginBottom: 10,
                }}
              />
            </View>

            <View style={styles.tradeButton}>
              <Text style={styles.tradeButtonText}>Quantity Multiplier : </Text>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity onPress={handleDecreaseAllStockQty}>
                  <Minus size={16} />
                </TouchableOpacity>

                <TextInput
                  value={totalQuantity?.toString() || ''}
                  onChangeText={value => handleQuantityInputChangeAll(value)}
                  style={styles.quantityInput2}
                  keyboardType="numeric"
                />

                <TouchableOpacity onPress={handleIncreaseAllStockQty}>
                  <Plus size={16} />
                </TouchableOpacity>
              </View>
            </View>

            {basketData?.length > 0 && (
              <View style={styles.buttonContainer}>
                {/* Left Side: Total Amount */}
                <View>
                  <Text style={styles.buttonorderlabel}>Total Amount :</Text>
                  <TotalAmountText
                    stockDetails={basketData}
                    type={'reviewTrade'}
                  />
                </View>

                {/* Right Side: Button */}
                <TouchableOpacity
                  style={[
                    styles.buttonPlace,
                    (hasZeroQuantityBasket || !marketGateOpen) && styles.buttonDisabled,
                    loading && styles.buttonLoading,
                  ]}
                  disabled={hasZeroQuantityBasket || !marketGateOpen || loading}
                  onPress={() => placeOrder(basketData)}>
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonTextPlace}>
                      {!marketGateOpen ? 'Market is Closed' : 'Place Order'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
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
      style={{height: screenHeight}}
      animationType="slide">
      <SafeAreaView style={styles.modalOverlay} pointerEvents="box-none">
        <View style={[styles.modalContainer, {width: width * 1}]}>
          <SafeAreaView style={styles.horizontal} />
          <SafeAreaView>
            <LinearGradient
              colors={['rgba(0, 38, 81, 1)', 'rgba(0, 86, 183, 1)']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 10,
                paddingVertical: 20,
                alignItems: 'center',
              }}>
              <Text style={styles.modalHeader1}>Review Trade Details</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <XIcon size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </SafeAreaView>

          <View style={{borderWidth: 1, borderColor: '#E8E8E8'}}></View>

          {/* Surveillance Warning for Angel One */}
          {broker === 'Angel One' &&
            surveillanceData?.surveillance &&
            (() => {
              const surveillanceStocks = surveillanceData.surveillance.filter(
                (stock) =>
                  stock.found === true &&
                  stock.surveillance &&
                  stock.surveillance !== '' &&
                  stock.surveillance !== 'N',
              );

              if (surveillanceStocks.length > 0) {
                return (
                  <View style={styles.surveillanceWarning}>
                    <View style={styles.surveillanceHeader}>
                      <AlertTriangleIcon size={18} color="#DC2626" />
                      <Text style={styles.surveillanceTitle}>
                        Surveillance Alert
                      </Text>
                    </View>
                    <Text style={styles.surveillanceText}>
                      The following stocks are under Angel One surveillance measures
                      and may be rejected via API:
                    </Text>
                    {surveillanceStocks.map((stock, index) => (
                      <Text key={index} style={styles.surveillanceStock}>
                        • <Text style={{fontFamily: 'Satoshi-Bold'}}>{stock.symbol}</Text>{' '}
                        (Surveillance: {stock.surveillance})
                      </Text>
                    ))}
                    <Text style={styles.surveillanceNote}>
                      Please trade these stocks manually through the Angel One mobile
                      app or web platform.
                    </Text>
                  </View>
                );
              }
              return null;
            })()}

          <FlatList
            data={stockDetails}
            extraData={stockDetails}
            renderItem={renderItem}
            keyExtractor={item => item.tradeId.toString()}
            ListFooterComponent={
              <View style={styles.Notecontainer}>
                <NoteCard text="Your cart can include both equity and derivatives. Please enter the quantity in shares for equity and in lots for derivatives." />
                {selectedOption === 'fix' && (
                  <NoteCard text="Scale by quantity adjusts the quantity of each stock based on the given amount, ensuring the total investment stays within the specified budget." />
                )}
              </View>
            }
            ListEmptyComponent={
              <SafeAreaView
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 20,
                }}>
                <View
                  style={{
                    borderRadius: 50,
                    backgroundColor: '#EBECEF',
                    padding: 20,
                  }}>
                  <CandlestickChartIcon size={40} color={'black'} />
                </View>
                <Text
                  style={{
                    fontFamily: 'Satoshi-SemiBold',
                    color: 'black',
                    fontSize: 18,
                    marginVertical: 10,
                  }}>
                  No Orders to Place
                </Text>
                <Text style={{fontFamily: 'Satoshi-Medium', color: 'grey'}}>
                  Add item to cart to place order.
                </Text>
              </SafeAreaView>
            }
            contentContainerStyle={{
              paddingHorizontal: 10,
              marginBottom: 10,
              borderRadius: 3,
            }}
          />

          {!(stockDetails.length === 0) && (
            <View
              style={{
                flexDirection: 'colum',
                justifyContent: 'space-between',
                marginHorizontal: 20,
                marginBottom: 20,
                backgroundColor: 'transparent',
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignContent: 'flex-start',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  justifyContent: 'center',
                  marginTop: 10,
                }}>
                {/* <CheckBox
                  value={selectedOption === 'fix'}
                  onValueChange={handleCheckboxChange} // Updated to use new handler
                  style={{marginRight: 20, height: 24, width: 24}}
                  boxType="square"
                /> */}

                <TouchableOpacity
                  onPress={handleCheckboxChange}
                  style={styles.checkboxContainer}
                  activeOpacity={0.7}
                  hitSlop={{top: 15, bottom: 15, left: 15, right: 15}} // Increases touch area
                >
                  <CheckBox
                    value={selectedOption === 'fix'}
                    onValueChange={handleCheckboxChange}
                    style={styles.checkbox}
                    boxType="square"
                    // ✅ Android styling props
                    tintColors={{
                      true: '#0056B7', // Checked color
                      false: '#999999', // Unchecked border color
                    }}
                    // ✅ iOS styling props (fallback)
                    onCheckColor="#FFFFFF" // Checkmark color on iOS
                    onFillColor="#0056B7" // Fill color when checked on iOS
                    onTintColor="#0056B7" // Border color when checked on iOS
                    tintColor="#999999" // Border color when unchecked on iOS
                    // ✅ Additional props for better visibility
                    animationDuration={0.2}
                    lineWidth={2}
                  />
                </TouchableOpacity>
                <Text
                  style={{
                    alignContent: 'center',
                    color: 'black',
                    fontSize: 12,

                    fontFamily: 'Satoshi-Medium',
                  }}>
                  Scale quantities by amount
                </Text>
              </View>

              {selectedOption === 'fix' && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 8,
                  }}>
                  <TextInput
                    value={inputFixSizeValue}
                    onChangeText={setInputFixValue}
                    placeholder="Enter value"
                    keyboardType="numeric"
                    placeholderTextColor={'grey'}
                    style={{
                      color: 'black',
                      width: 120,
                      height: 32,
                      paddingLeft: 5,
                      fontSize: 14,
                      padding: 0,

                      fontFamily: 'Satoshi-Medium',
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
                        backgroundColor: inputFixSizeValue
                          ? 'rgba(0, 86, 183, 1)'
                          : 'gray',
                        borderRadius: 5,
                        marginRight: 8,
                      },
                      !inputFixSizeValue && {opacity: 0.6},
                    ]}
                    disabled={!inputFixSizeValue}>
                    <Text style={{color: 'white', fontSize: 14}}>Update</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleReset} style={{padding: 8}}>
                    <Text style={{fontSize: 20, color: 'gray'}}>⟳</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <View style={styles.buttonContainer}>
            {/* Left Side: Total Amount */}
            <View>
              <Text style={styles.buttonorderlabel}>Total Amount :</Text>
              <TotalAmountText
                stockDetails={stockDetails}
                type={'reviewTrade'}
              />
            </View>

            {/* Right Side: Button */}
            <TouchableOpacity
              style={[
                styles.buttonPlace,
                (hasZeroQuantity || !marketGateOpen) && styles.buttonDisabled,
                loading && styles.buttonLoading,
              ]}
              disabled={hasZeroQuantity || !marketGateOpen || loading}
              onPress={() => placeOrder(stockDetails)}>
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonTextPlace}>
                  {!marketGateOpen ? 'Market is Closed' : 'Place Order'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  tradeButton: {
    marginHorizontal: 10,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 30,
    paddingVertical: 5,

    paddingHorizontal: 20,
    alignItems: 'center',
    alignContent: 'center',

    alignSelf: 'flex-start',
    textAlign: 'center',
  },
  tradeButtonText: {
    color: '#000',
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
  },

  quantityInput2: {
    height: 15,
    padding: 0,
    maxWidth: '50%',
    color: '#0d0c22',
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    textAlign: 'center',
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: '#e9e8e8',
    borderRadius: 4,
  },

  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 5,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
    minHeight: 48,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // Increases touchable area
    paddingHorizontal: 10, // Increases touchable area
    marginRight: 10,
  },
  checkbox: {
    height: 16,
    width: 16,
    // ✅ Android specific styling
    transform: [{scaleX: 1.2}, {scaleY: 1.2}], // Makes it bigger
  },
  leftSection: {
    paddingRight: 12,
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  symbol: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#212121',
  },
  orderType: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
    marginTop: 2,
  },
  buyText: {
    color: '#21A862',
  },
  sellText: {
    color: '#E22525',
  },
  quantitySection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  iconBtn: {
    width: 26,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
  },
  quantityInput: {
    height: 20,
    padding: 0,
    maxWidth: '60%',
    width: 45,
    color: '#0d0c22',
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E1E1E1',
    borderRadius: 3,
    textAlign: 'center',
    fontSize: 12,
    marginHorizontal: 3,
    color: '#222',
    backgroundColor: '#F8F8F8',
    fontWeight: '600',
  },
  priceSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: 4,
  },
  currency: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
    marginRight: 2,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
  },
  trashSection: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  fixSizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  containerbutton: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: 'center',
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

  buttonDisabled: {
    backgroundColor: '#7f9cbf', // lighter or greyed out
  },
  buttonTextPlace: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLoading: {
    opacity: 0.7, // slightly faded when loading
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignContent: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 20,
    paddingVertical: 3,
  },
  quantityContainer1: {
    flexDirection: 'row',
    paddingVertical: 5,
    marginHorizontal: 25,
  },
  closeButton: {},
  buyOrder: {
    color: '#fff',
    fontFamily: 'Satoshi-Regular',
    paddingHorizontal: 3,
    paddingVertical: 1,
    backgroundColor: '#12D06C',
    alignSelf: 'flex-start',
    borderRadius: 15,
  },
  sellOrder: {
    color: '#fff',
    fontFamily: 'Satoshi-Regular',
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 15,
    backgroundColor: 'red',
  },
  cell: {
    borderWidth: 1,
    borderColor: 'grey',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },

  cellText: {
    alignContent: 'center',
    color: 'black',
    fontSize: 9,
    padding: 0,
    fontFamily: 'Satoshi-Medium',
  },
  cellText1: {},
  cellTextmktprice: {
    alignSelf: 'center',
    color: 'black',
    fontFamily: 'Satoshi-Regular',
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
    backgroundColor: '#EFF0EE',
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,

    overflow: 'hidden',

    maxHeight: screenHeight * 0.9,
  },
  horizontal: {},
  card: {
    flexDirection: 'row',
    backgroundColor: '#F4F8FE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  line: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#3B82F6', // blue line
    marginRight: 8,
  },
  text: {
    flex: 1,
    color: '#374151',
    fontSize: 12,
    lineHeight: 20,
    fontFamily: 'Poppins-small',
  },
  Notecontainer: {
    backgroundColor: '#F5F5F5', // matches screenshot bg
    padding: 16,
  },
  bold: {
    fontWeight: 'bold',
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
    color: 'white',
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
    marginRight: 5,
    alignItems: 'flex-start',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
  },

  /////////

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconContainer: {
    backgroundColor: 'transparent',
    marginLeft: 10,
    borderRadius: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginRight: 10,
  },
  basketName: {
    fontSize: 17,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
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
    color: '#D2D1CC',
    fontFamily: 'Satoshi-Bold',
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  tableCell: {},
  tableCellqtylot: {
    alignContent: 'flex-end',
    alignItems: 'flex-end',
  },
  stockSymbol: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'Satoshi-Medium',
  },
  tradeType: {
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    fontSize: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 0.8,
    borderRadius: 20,
  },
  tradeType1: {
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    fontSize: 10,

    paddingVertical: 1,

    borderRadius: 20,
  },
  sell: {
    fontFamily: 'Satoshi-Bold',
    color: 'red',
  },
  buy: {
    fontFamily: 'Satoshi-Bold',
    color: '#16A085',
  },
  price: {
    fontSize: 13,
    color: '#000000',
  },
  quantity: {
    fontSize: 13,
    color: '#000000',
    fontFamily: 'Satoshi-Medium',
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
    marginHorizontal: 10,
  },
  label: {
    fontSize: 14,
    color: '#000000',
  },
  multiplierControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    alignContent: 'center',
    alignSelf: 'flex-start',
    height: 25,
    padding: 2,
    marginHorizontal: 4,
    color: '#0d0c22',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#e9e8e8',
    borderRadius: 7,
  },
  button: {
    width: 25,
    height: 25,
    borderRadius: 20,
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

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E5E7EB', // light border
  },
  buttonorderlabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Small',
    color: '#374151', // gray-700
  },
  buttonamount: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#000',
    marginTop: 2,
  },
  buttonPlace: {
    backgroundColor: 'rgba(0, 86, 183, 1)', // blue
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 3,
    flex: 1,
    alignContent: 'center',
    alignItems: 'center',
    marginLeft: 100,
  },
  buttonTextPlace: {
    color: '#fff',
    fontFamily: 'Poppins-Medium',
    paddingTop: 2,
    fontSize: 13,
  },
   orderTypeBadge: {
  backgroundColor: 'rgba(0, 0, 0, 0.1)',
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 10,
  marginLeft: 8,
    },
    orderTypeText: {
      color: '#000',
      fontSize: 9,
      fontFamily: 'Satoshi-Bold',
    },
    expandedContent: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 0.5,
      borderTopColor: '#E8E8E8',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
      paddingHorizontal: 5,
    },
    detailLabelText: {
      color: '#666',
      fontSize: 11,
      fontFamily: 'Satoshi-Regular',
    },
    detailValue: {
      color: '#000',
      fontSize: 12,
      fontFamily: 'Satoshi-Bold',
    },
    rowContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start', // Changed from center
      marginHorizontal: 10,
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: '#E8E8E8',
    },
    leftContainer: {
      flex: 2, // Increased to give more space
      justifyContent: 'flex-start',
      marginRight: 5,
      alignItems: 'flex-start',
    },
    symbol: {
      alignSelf: 'flex-start',
      color: 'black',
      fontSize: 13, // Slightly increased
      fontFamily: 'Satoshi-Bold',
      flexWrap: 'wrap',
    },
    orderTypeBadge: {
      backgroundColor: 'rgba(0, 0, 0, 0.08)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      marginLeft: 5,
    },
    orderTypeText: {
      color: '#000',
      fontSize: 8,
      fontFamily: 'Satoshi-Bold',
    },
    expandedContent: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 0.5,
      borderTopColor: '#E8E8E8',
      width: '100%',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      paddingHorizontal: 2,
    },
    detailLabelText: {
      color: '#666',
      fontSize: 11,
      fontFamily: 'Satoshi-Regular',
    },
    detailValue: {
      color: '#000',
      fontSize: 11,
      fontFamily: 'Satoshi-Bold',
    },
    // Surveillance Warning Styles
    surveillanceWarning: {
      marginHorizontal: 10,
      marginVertical: 8,
      padding: 12,
      backgroundColor: '#FEF2F2',
      borderLeftWidth: 4,
      borderLeftColor: '#DC2626',
      borderRadius: 4,
    },
    surveillanceHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    surveillanceTitle: {
      fontSize: 14,
      fontFamily: 'Satoshi-Bold',
      color: '#DC2626',
      marginLeft: 8,
    },
    surveillanceText: {
      fontSize: 12,
      fontFamily: 'Satoshi-Regular',
      color: '#991B1B',
      marginBottom: 6,
    },
    surveillanceStock: {
      fontSize: 12,
      fontFamily: 'Satoshi-Regular',
      color: '#B91C1C',
      marginLeft: 8,
      marginBottom: 2,
    },
    surveillanceNote: {
      fontSize: 11,
      fontFamily: 'Satoshi-Regular',
      color: '#DC2626',
      marginTop: 6,
      fontStyle: 'italic',
    },
});

export default ReviewTradeModal;
