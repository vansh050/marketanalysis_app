import React, { useState,useRef,useCallback,useEffect, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions,ActivityIndicator, TextInput,SafeAreaView, ScrollView, Pressable, FlatList } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { XIcon, Trash2Icon,CandlestickChartIcon, ChevronRight,Minus,Plus,ShoppingBag, AlertTriangle, Package } from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Feather';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getLastKnownPrice } from './AdviceScreenComponents/DynamicText/websocketPrice';
import ReviewTradeText from './AdviceScreenComponents/ReviewTradeText';
import { useTotalAmount } from './AdviceScreenComponents/DynamicText/websocketPrice';
import eventEmitter from './EventEmitter';
import { RadioButton } from 'react-native-paper';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTrade } from '../screens/TradeContext';
import { getAdvisorSubdomain } from '../utils/variantHelper';

import SliderButton from './SliderButton';
const { height: screenHeight } = Dimensions.get('window');

const BasketTradeModal = ({
  visible,
  onClose,
  stockDetails,
  setStockDetails,
  placeOrder,
  funds,
  loading,
  cartCount,
  setCartCount,
  getCartAllStocks,
  handleSelectStock,
  broker,
}) => {
 console.log("stock Detailss ----> ",stockDetails);
 const { configData } = useTrade();
 const [isBasket,setisBasket]=useState(false);
 const isBasketp = stockDetails.some(item => item.source === 'BasketStock');

 // Detect if this is a closure basket
 const isClosureBasket = useMemo(() => {
   return stockDetails.some(item => item.isClosure === true);
 }, [stockDetails]);

 // Individual quantities for closure baskets (keyed by tradeId)
 const [closureQuantities, setClosureQuantities] = useState({});

 // Initialize closure quantities when stockDetails changes
 useEffect(() => {
   if (isClosureBasket) {
     const initialQuantities = {};
     stockDetails.forEach(stock => {
       if (stock.isClosure) {
         // Default to the recommended quantity (from toTradeQty) or current holding
         const qtyToClose = Math.abs(stock.toTradeQty || stock.quantity || 1);
         initialQuantities[stock.tradeId] = qtyToClose;
       }
     });
     setClosureQuantities(initialQuantities);
   }
 }, [stockDetails, isClosureBasket]);

 useEffect(()=> {
  if(isBasketp) {
     setisBasket(true);
  }
 }, [isBasketp]);

 // Handlers for closure basket individual quantity controls
 const handleClosureQtyIncrease = (tradeId, maxQty) => {
   setClosureQuantities(prev => ({
     ...prev,
     [tradeId]: Math.min((prev[tradeId] || 0) + 1, maxQty),
   }));
 };

 const handleClosureQtyDecrease = (tradeId) => {
   setClosureQuantities(prev => ({
     ...prev,
     [tradeId]: Math.max((prev[tradeId] || 0) - 1, 1), // Minimum 1
   }));
 };

 const handleClosureQtyChange = (tradeId, value, maxQty) => {
   const newQty = parseInt(value) || 0;
   setClosureQuantities(prev => ({
     ...prev,
     [tradeId]: Math.min(Math.max(newQty, 0), maxQty),
   }));
 };

 const updatedStockDetails = stockDetails.map(item => {
   if (item.source === 'BasketStock') {
     const { source, ...rest } = item; // Destructure to exclude 'source'
     return rest; // Return the new object without the 'source' key
   }
   return item; // If 'source' is not 'BasketStock', return the item as is
 });

 // Compare the old stock details with the updated stock details to check if an update is necessary
 const isStockDetailsChanged = JSON.stringify(updatedStockDetails) !== JSON.stringify(stockDetails);

 // Only update stock details if they have changed
 if (isStockDetailsChanged) {
   setStockDetails(updatedStockDetails);
 }
  const { width } = useWindowDimensions();
  const [multiplier, setMultiplier] = useState('1');

  // Store base quantities for proper multiplier calculation (matching web implementation)
  const baseQuantitiesRef = useRef({});

  // Initialize base quantities and check for ImpliedMultiplier
  useEffect(() => {
    if (!isClosureBasket && stockDetails?.length > 0 && Object.keys(baseQuantitiesRef.current).length === 0) {
      const baseQtys = {};
      stockDetails.forEach(item => {
        baseQtys[item.tradeId] = item.quantity || 1;
      });
      baseQuantitiesRef.current = baseQtys;

      // Check for ImpliedMultiplier
      const tradeWithImpliedMultiplier = stockDetails.find(
        (item) =>
          item.ImpliedMultiplier !== undefined &&
          item.ImpliedMultiplier !== null &&
          item.ImpliedMultiplier !== ""
      );

      if (tradeWithImpliedMultiplier && multiplier === '1') {
        setMultiplier(tradeWithImpliedMultiplier.ImpliedMultiplier.toString());
      }
    }
  }, [stockDetails, isClosureBasket]);

  useEffect(() => {
    // Emit the modal state
    eventEmitter.emit('MODAL_STATE', visible);

    // Reset base quantities when modal closes (matching web behavior)
    if (!visible) {
      baseQuantitiesRef.current = {};
      setTotalQuantity(1);
    }
  }, [visible]);
  const handleIncreaseStockQty = (symbol, tradeId) => {
    const newData = stockDetails.map((stock) =>
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? { ...stock, quantity: stock.quantity + 1 }
        : stock
    );
  //  console.log('Updated Stock Details:', newData); // Debug log
    setStockDetails(newData);
  };
  const handleDecreaseStockQty = (symbol, tradeId) => {
    const newData = stockDetails.map((stock) =>
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? { ...stock, quantity: Math.max(stock.quantity - 1, 0) }
        : stock
    );
  //  console.log('Updated Stock Details:', newData); // Debug log
    setStockDetails(newData);
  };
  const handleQuantityInputChange = (symbol, value, tradeId) => {
    const newQuantity = parseInt(value) || 0;
    const newData = stockDetails.map((stock) => 
      stock.tradingSymbol === symbol && stock.tradeId === tradeId
        ? { ...stock, quantity: newQuantity }
        : stock
    );
    setStockDetails(newData);
  };




  const [totalQuantity, setTotalQuantity] = useState(1);  // State to track multiplier (matching web implementation)

  // Helper function to apply multiplier to base quantities (matching web implementation)
  const applyMultiplierToStockDetails = (newMultiplier) => {
    const newData = stockDetails.map((stock) => {
      const baseQty = baseQuantitiesRef.current[stock.tradeId] || stock.quantity || 1;
      return {
        ...stock,
        quantity: baseQty * newMultiplier,
      };
    });
    setStockDetails(newData);
  };

  const handleIncreaseAllStockQty = () => {
    const newMultiplier = totalQuantity + 1;  // Increase multiplier by 1
    setTotalQuantity(newMultiplier);  // Update multiplier state

    // Apply multiplier to base quantities (matching web: quantity * multiplier)
    applyMultiplierToStockDetails(newMultiplier);
  };

  const handleDecreaseAllStockQty = () => {
    if (totalQuantity > 1) {
      const newMultiplier = totalQuantity - 1;  // Decrease multiplier by 1
      setTotalQuantity(newMultiplier);  // Update multiplier state

      // Apply multiplier to base quantities (matching web: quantity * multiplier)
      applyMultiplierToStockDetails(newMultiplier);
    }
  };

  const handleQuantityInputChangeAll = (value) => {
    const newMultiplier = parseInt(value) || 1; // If invalid, fallback to 1
    setTotalQuantity(newMultiplier);  // Update multiplier state

    // Apply multiplier to base quantities (matching web: quantity * multiplier)
    applyMultiplierToStockDetails(newMultiplier);
  };

  const [ltp, setLtp] = useState([]);
  const socketRef = useRef(null);
  const subscribedSymbolsRef = useRef(new Set());
  const failedSubscriptionsRef = useRef({});
  const latestPricesRef = useRef({});
  let dataArray = [];
  
  const totalAmount = useTotalAmount(stockDetails);
 
  const handleRemoveStock = async (symbol, tradeId) => {
    console.log("Removing stock:-----------------=====", symbol, tradeId);
    const startTime = Date.now(); // Capture the start time
  
    const cartItemsKey = "cartItems";
  
    try {
      // Load cart items from AsyncStorage
      const cartData = await AsyncStorage.getItem(cartItemsKey);
      let cartItems = cartData ? JSON.parse(cartData) : [];
  
      // Filter out stock from state and AsyncStorage
      const updatedStockDetails = stockDetails.filter(
        (selectedStock) =>
          !(selectedStock.tradingSymbol === symbol && selectedStock.tradeId === tradeId)
      );
  
      const updatedCartItems = cartItems.filter(
        (selectedStock) =>
          !(selectedStock.tradingSymbol === symbol && selectedStock.tradeId === tradeId)
      );
  
      // Update state and AsyncStorage in parallel
      setStockDetails(updatedStockDetails);
  
      await AsyncStorage.setItem(cartItemsKey, JSON.stringify(updatedCartItems));
      const storedCartItems = await AsyncStorage.getItem(cartItemsKey);
console.log('Review Modal in AsyncStorage:', storedCartItems);
      console.log('Emitting stockRemoved event--------------------->>>>>>>>>>>>>>>>>>>>');
      eventEmitter.emit("stockRemoved", { symbol, tradeId });
  
    } catch (error) {
      console.error("Error removing stock:", error);
    }
  };
  
  
  
  
  const [selectedOption, setSelectedOption] = useState("");
  const [inputFixSizeValue, setInputFixValue] = useState("");

  const handleFixSize = () => {
    if (selectedOption === "fix" && inputFixSizeValue) {
      const fixedSize = parseFloat(inputFixSizeValue);
      const updatedStockDetails = stockDetails.map((stock) => {
      //  console.log('stock Symbol:',stock.tradingSymbol);
        const currentPrice = getLastKnownPrice(stock.tradingSymbol);
        // Only update quantity if we have a valid price
      //  console.log('Current Price:',currentPrice);
        if (currentPrice && currentPrice > 0) {
          const newQuantity = Math.floor(fixedSize / currentPrice);
          return { ...stock, quantity: newQuantity };
        }
        // If no valid price, return stock unchanged
        return stock;
      });
      setStockDetails(updatedStockDetails);
    }
  };

  const handleReset = () => {
    setSelectedOption("");
    setInputFixValue("");
  };
  const [isLoading, setIsLoading] = useState(false);
  const [buttonTitle, setButtonTitle] = useState('Slide To Place Order | ₹134.07');
  const handleSwipeSuccess = () => {
    //placeOrder();
    setButtonTitle('');
     // Adjust the timeout duration as needed
  };

  const scrollViewRef = useRef(null);
  

  const hasZeroQuantity = stockDetails.some((stock) => stock.quantity === 0);
  const [InputFixSizeValue,setInputFixSizeValue]=useState(0);



  // Render row for closure basket with individual quantity controls
  const renderClosureTradeRow = ({ item, index }) => {
    const symbol = item.tradingSymbol;
    const exe = item.exchange;
    const currentHolding = item.currentHolding || Math.abs(item.toTradeQty || item.quantity || 1);
    const qtyToClose = closureQuantities[item.tradeId] || 1;

    return (
      <View style={styles.tableRow} key={index}>
        <View style={[styles.tableCell, { flex: 1.5 }]}>
          <Text style={styles.symbol} numberOfLines={1}>{item.tradingSymbol}</Text>
          <Text style={[styles.tradeType, styles.sell]}>
            SELL (Close)
          </Text>
        </View>
        <View style={styles.tableCell}>
          <ReviewTradeText
            symbol={symbol || ""}
            orderType={item.orderType}
            exchange={exe}
            advisedPrice={0}
            stockDetails={stockDetails}
          />
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.holdingText}>{currentHolding}</Text>
          <Text style={styles.holdingLabel}>lots</Text>
        </View>
        <View style={[styles.tableCell, { flex: 1.2 }]}>
          <View style={styles.closureQtyControl}>
            <TouchableOpacity
              style={styles.closureQtyBtn}
              onPress={() => handleClosureQtyDecrease(item.tradeId)}
            >
              <Minus size={12} color="#000" />
            </TouchableOpacity>
            <TextInput
              style={styles.closureQtyInput}
              value={String(qtyToClose)}
              keyboardType="numeric"
              onChangeText={(val) => handleClosureQtyChange(item.tradeId, val, currentHolding)}
            />
            <TouchableOpacity
              style={styles.closureQtyBtn}
              onPress={() => handleClosureQtyIncrease(item.tradeId, currentHolding)}
            >
              <Plus size={12} color="#000" />
            </TouchableOpacity>
          </View>
          {qtyToClose > currentHolding && (
            <Text style={styles.qtyError}>Max: {currentHolding}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderTradeRow = ({ item, index }) => {
    console.log('the maine ITEM WE GET:',item);
    const symbol = item.tradingSymbol;
    const iniprice = 0;
    const exe = item.exchange;
    return (
      <View style={styles.tableRow} key={index}>
        <View style={styles.tableCell}>
          <Text style={styles.symbol}>{item.tradingSymbol}</Text>
          <Text style={[styles.tradeType, item.Type === 'SELL' ? styles.sell : styles.buy]}>
            {item.Type === 'SELL' ? 'SELL' : 'BUY'}
          </Text>
        </View>
        <View style={styles.tableCell}>
        <ReviewTradeText
              symbol={symbol || ""}
              orderType={item.orderType}
              exchange={exe}
              advisedPrice={iniprice || 0}
              stockDetails={stockDetails}
          />
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.quantity}>
            {item.quantity}
          </Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }) =>
    {
      console.log('item IK:',item);
      const symbol = item.tradingSymbol;
      const iniprice = 0;
      const exe = item.exchange;
      return(
   // console.log('stock ITem',item),
        <View style={styles.rowContainer}>
      {/* Left-aligned stock symbol and transaction type */}
      <View style={styles.leftContainer}>
        <Text style={styles.symbol}>
          {item.tradingSymbol.length > 18 ? `${item.tradingSymbol.substring(0, 18)}...` : item.tradingSymbol}
        </Text>
        <Text
          style={[
            styles.cellText,
            item.transactionType === 'BUY' ? styles.buyOrder : styles.sellOrder,
          ]}
        >
          {item.transactionType}
        </Text>
      </View>
      
      {/* Center-aligned quantity counter */}
      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={{ justifyContent: 'center',padding:5,paddingRight:0 }}
          onPress={() => handleDecreaseStockQty(item.tradingSymbol, item.tradeId)}
        >
          <Icon1 name="minus" size={14} color="#000" />
        </TouchableOpacity>
        <TextInput
          value={item.quantity.toString()}
          style={styles.quantityInput}
          keyboardType="numeric"
          onChangeText={(value) => handleQuantityInputChange(item.tradingSymbol, value, item.tradeId)}
        />
        <TouchableOpacity
          style={{ justifyContent: 'center',padding:5,paddingLeft:0, }}
          onPress={() => handleIncreaseStockQty(item.tradingSymbol, item.tradeId)}
        >
          <Icon1 name="plus" size={14} color="#000" />
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
      <TouchableOpacity style={{ marginRight: 10,padding:5,paddingRight:0, }} onPress={() => handleRemoveStock(item.tradingSymbol, item.tradeId)}>
  <Trash2Icon size={20} color={'black'} />
</TouchableOpacity>

    </View>
  );}



  // Validate closure quantities
  const hasInvalidClosureQty = isClosureBasket && stockDetails.some(stock => {
    if (!stock.isClosure) return false;
    const qty = closureQuantities[stock.tradeId] || 0;
    const maxQty = stock.currentHolding || Math.abs(stock.toTradeQty || 1);
    return qty <= 0 || qty > maxQty;
  });

  // Get stock details with closure quantities applied
  const getProcessedStockDetails = () => {
    if (!isClosureBasket) return stockDetails;
    return stockDetails.map(stock => {
      if (stock.isClosure) {
        return {
          ...stock,
          quantity: closureQuantities[stock.tradeId] || stock.quantity,
          closurestatus: 'fullClose',
        };
      }
      return stock;
    });
  };

  // Closure basket render
  if(isBasket && isClosureBasket) {
    return (
      <Modal
        transparent={true}
        visible={visible}
        onRequestClose={onClose}
        animationType="slide"
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View style={[styles.modalContainer, { width: width * 1 }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <XIcon size={24} color="#000" />
            </TouchableOpacity>
            <View style={styles.horizontal} />
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: '#DC3545' }]}>
                <Package size={24} color="white" />
              </View>
              <View>
                <Text style={styles.basketName}>CLOSE POSITIONS</Text>
                <Text style={styles.closureSubtitle}>Exit your current holdings</Text>
              </View>
            </View>

            {/* Warning banner */}
            <View style={styles.closureWarning}>
              <AlertTriangle size={16} color="#856404" />
              <Text style={styles.closureWarningText}>
                You are about to close your positions. Adjust quantities below.
              </Text>
            </View>

            <View style={{ borderWidth: 1, borderColor: '#E8E8E8', marginTop: 5 }}></View>

            <View style={styles.tableContainer}>
              {/* Closure basket header */}
              <View style={[styles.tableHeader, { backgroundColor: '#FFF3CD' }]}>
                <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Stocks</Text>
                <Text style={styles.tableHeaderText}>Price (₹)</Text>
                <Text style={styles.tableHeaderText}>Holding</Text>
                <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Qty to Close</Text>
              </View>

              <FlatList
                data={stockDetails.filter(s => s.isClosure)}
                renderItem={renderClosureTradeRow}
                keyExtractor={(item) => item.tradeId.toString()}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
                    <Text style={{ fontFamily: 'Satoshi-Medium', color: 'grey' }}>
                      No positions to close
                    </Text>
                  </View>
                }
                contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
              />
            </View>

            <View style={styles.closureNoteContainer}>
              <Text style={styles.closureNote}>
                Note: You can adjust the quantity to close for each position individually.
                Cannot close more than your current holding.
              </Text>
            </View>

            {stockDetails.filter(s => s.isClosure).length > 0 && (
              <GestureHandlerRootView style={{ flex: 0 }}>
                <View
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderTopColor: '#e4e4e4',
                    borderTopWidth: 0.5,
                    elevation: 1,
                    backgroundColor: '#fff',
                  }}
                >
                  <SliderButton
                    loading={loading}
                    text={`Slide to Close Positions || ₹${totalAmount || '0.00'}`}
                    onSlideComplete={() => placeOrder(getProcessedStockDetails())}
                    disabled={hasInvalidClosureQty}
                    backgroundColor="#DC3545"
                  />
                </View>
              </GestureHandlerRootView>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // Regular basket render
  if(isBasket)
{

  return (
    <Modal
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
    animationType="slide"
  >
    <View style={styles.modalOverlay} pointerEvents="box-none">
      <View style={[styles.modalContainer, { width: width * 1 }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <XIcon size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.horizontal} />
        <View style={styles.header}>
          <View style={styles.iconContainer}>
          <ShoppingBag size={24} color="white" />
          </View>
          <Text style={styles.basketName}>{(configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || getAdvisorSubdomain()).toUpperCase()} BASKET</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: '#E8E8E8', marginTop: 5 }}></View>


        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Stocks</Text>
            <Text style={styles.tableHeaderText}>Current Price (₹)</Text>
            <Text style={styles.tableHeaderText}>Quantity</Text>
          </View>

          <FlatList
          data={stockDetails}
          renderItem={renderTradeRow}
          keyExtractor={(item) => item.tradeId.toString()}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
              <View style={{ borderRadius: 50, backgroundColor: '#EBECEF', padding: 20 }}>
                <CandlestickChartIcon size={40} color={"black"} />
              </View>
              <Text style={{ fontFamily: 'Satoshi-SemiBold', color: 'black', fontSize: 18, marginVertical: 10 }}>
                No Orders to Place
              </Text>
              <Text style={{ fontFamily: 'Satoshi-Medium', color: 'grey' }}>
                Add item to cart to place order.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
        />
        </View>
        <View style={styles.multiplierContainer}>
          <Text style={styles.label}>Quantity Multiplier:</Text>
          <View style={styles.multiplierControl}>
            <TouchableOpacity onPress={() => handleDecreaseAllStockQty()}  style={styles.button}>
              <Minus size={16} />
            </TouchableOpacity>
            <TextInput
            value={totalQuantity.toString()}
            style={styles.quantityInput}
              keyboardType="numeric"
              onChangeText={(value) => handleQuantityInputChangeAll()}

            />
            <TouchableOpacity  onPress={() => handleIncreaseAllStockQty()}  style={styles.button}>
              <Plus size={16} />
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>
            Note: The multiplier adjusts all stock quantities proportionally. A value of 2 doubles all quantities, 3 triples them, and so on.
          </Text>
        </View>

{stockDetails.length > 0 && (
  <GestureHandlerRootView style={{ flex: 0 }}>
    <View
      style={{
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderTopColor: '#e4e4e4',
        borderTopWidth: 0.5,
        elevation: 1,
        backgroundColor: '#fff',
      }}
    >
      <SliderButton
        loading={loading}
        text={`Slide to Place Order || ₹${totalAmount || '0.00'}`}
        onSlideComplete={placeOrder}
        disabled={hasZeroQuantity}
      />
    </View>
  </GestureHandlerRootView>
)}
      </View>
    </View>
  </Modal>
  );
}  
  return (
    <Modal
    transparent={true}
    visible={visible}
    onRequestClose={onClose}
    animationType="slide"
  >
    <View style={styles.modalOverlay} pointerEvents="box-none">
      <View style={[styles.modalContainer, { width: width * 1 }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <XIcon size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.horizontal} />
        <Text style={styles.modalHeader1}>Review Trade Details</Text>
        <View style={{ borderWidth: 1, borderColor: '#E8E8E8', marginTop: 5 }}></View>
        
        <FlatList
          data={stockDetails}
          renderItem={renderItem}
          keyExtractor={(item) => item.tradeId.toString()}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
              <View style={{ borderRadius: 50, backgroundColor: '#EBECEF', padding: 20 }}>
                <CandlestickChartIcon size={40} color={"black"} />
              </View>
              <Text style={{ fontFamily: 'Satoshi-SemiBold', color: 'black', fontSize: 18, marginVertical: 10 }}>
                No Orders to Place
              </Text>
              <Text style={{ fontFamily: 'Satoshi-Medium', color: 'grey' }}>
                Add item to cart to place order.
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
        />
  
{!(stockDetails.length===0) && (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 20 }}>
    <View >
      <Text style={styles.cellText}>Scale Quantity By</Text>
      
      {/* Radio Button with Label */}
      <View style={{ flexDirection: 'row', alignItems: 'center',marginRight:0 }}>
        <RadioButton
          value="fix"
          status={selectedOption === "fix" ? "checked" : "unchecked"}
          onPress={() => setSelectedOption("fix")}
          color="black"
        />
        <Text style={{ color: 'grey', marginRight: 10 }}>Fix Size</Text>
      </View>
      </View>
      
      {/* Conditional Input and Buttons for "Fix Size" Option */}
      {selectedOption === "fix" && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <TextInput
            value={inputFixSizeValue}
            onChangeText={setInputFixValue}
            placeholder="Enter value"
            keyboardType="numeric"
            style={{
              color:'black',
              width: 80,
              paddingLeft: 5,
              fontSize:12,
              padding:0,
              fontFamily:'Satoshi-Medium',
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
                backgroundColor: inputFixSizeValue ? 'black' : 'gray',
                borderRadius: 5,
                marginRight: 8,
              },
              !inputFixSizeValue && { opacity: 0.6 }
            ]}
            disabled={!inputFixSizeValue}
          >
            <Text style={{ color: 'white', fontSize: 12 }}>Update</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} style={{ padding: 8 }}>
            <Text style={{ fontSize: 20, color: 'gray' }}>⟳</Text>
          </TouchableOpacity>
        </View>
      )}

  </View>
)}

{stockDetails.length > 0 && (
  <GestureHandlerRootView style={{ flex: 0 }}>
    <View
      style={{
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderTopColor: '#e4e4e4',
        borderTopWidth: 0.5,
        elevation: 1,
        backgroundColor: '#fff',
      }}
    >
      <SliderButton
        loading={loading}
        text={`Slide to Place Order || ₹${totalAmount || '0.00'}`}
        onSlideComplete={placeOrder}
        disabled={hasZeroQuantity}
      />
    </View>
  </GestureHandlerRootView>
)}
      </View>
    </View>
  </Modal>
  
  );
};

const styles = StyleSheet.create({
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:'transparent',
    marginLeft:0,
    flex: 1, // Center alignment
  },
  quantityContainer1: {
    flexDirection: 'row',
    paddingVertical: 5,
    marginHorizontal: 25,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  buyOrder: {
    color: '#16A085',
    fontFamily:'Satoshi-SemiBold',
    alignSelf: 'flex-start',
 
  },
  sellOrder: {
    color: 'red',
  },
  cell: {
    
    borderWidth:1,
    borderColor:'grey',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  symbol: {
    alignSelf: 'flex-start',
    color: 'black',
    flexDirection:'column',
    fontFamily: 'Satoshi-SemiBold',
  },
  cellText: {
    alignSelf: 'flex-start',
    color: 'black',
    fontSize:12,
    fontFamily: 'Satoshi-Medium',
  },
  cellTextmktprice: {
    alignSelf: 'center',
    color: 'black',
    fontFamily: 'Satoshi-Regular',
  },
  quantityInput: {
    width: 50,
    height: 30,
    padding: 2,
    marginHorizontal: 4,
    color: '#0d0c22',
    fontSize: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9e8e8',
    borderRadius: 7,
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
    backgroundColor:'#fff',
    borderTopRightRadius:20,borderTopLeftRadius:20,
    maxHeight:screenHeight,
    elevation: 50,
    borderTopWidth:1,
    borderTopColor:'#e9e9e9',
  },
  horizontal: {
    width: 110,
    height: 6,
    marginBottom: 20,
    borderRadius: 250,
    alignSelf: 'center',
    backgroundColor: '#f1f4f8',
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
    marginHorizontal: 25,
    color: 'black',
    marginBottom: 10,
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
    marginRight:5,
    alignItems: 'flex-start',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    alignContent:'flex-end',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal:10,
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#E8E8E8',
  },

  /////////
 
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    backgroundColor: '#4A7AAF',
    padding: 10,
    marginLeft:10,
    borderRadius: 50,
    marginRight: 10,
  },
  basketName: {
    fontSize: 18,
    fontFamily:'Satoshi-Bold',
    color: 'black',
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
    color: '#000000',
    fontFamily:'Satoshi-Bold',
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockSymbol: {
    fontSize: 14,
    color: '#000000',
    fontFamily:'Satoshi-Medium',
  },
  tradeType: {
    marginTop: 5,
    fontSize: 12,
  },
  sell: {
    fontFamily:'Satoshi-Bold',
    color: '#EA2D3F',
  },
  buy: {
    fontFamily:'Satoshi-Bold',
    color: '#16A085',
  },
  price: {
    fontSize: 13,
    color: '#000000',
  },
  quantity: {
    fontSize: 15,
    color: '#000000',
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
    marginHorizontal:10,
  },
  label: {
    fontSize: 14,
    color: '#000000',
  },
  multiplierControl: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  button: {
    width: 30,
    height: 30,
    backgroundColor: '#e9e9e9',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiplierInput: {
    width: 60,
    height: 30,
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
  // Closure basket specific styles
  closureSubtitle: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Satoshi-Regular',
  },
  closureWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 10,
    marginTop: 10,
    borderRadius: 6,
    gap: 8,
  },
  closureWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#856404',
    fontFamily: 'Satoshi-Medium',
  },
  closureNoteContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  closureNote: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'Satoshi-Regular',
    lineHeight: 16,
  },
  closureQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closureQtyBtn: {
    width: 24,
    height: 24,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closureQtyInput: {
    width: 40,
    height: 28,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Satoshi-Bold',
    color: '#000',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginHorizontal: 4,
    padding: 0,
  },
  holdingText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: '#000',
    textAlign: 'center',
  },
  holdingLabel: {
    fontSize: 10,
    fontFamily: 'Satoshi-Regular',
    color: '#666',
    textAlign: 'center',
  },
  qtyError: {
    fontSize: 9,
    color: '#DC3545',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default BasketTradeModal;
