import React, { useState, useEffect,useRef,useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions ,Modal,TouchableWithoutFeedback,ActivityIndicator,Keyboard} from 'react-native';
import moment from 'moment';
import {XIcon, BanIcon, CalendarDays, MinusIcon, PlusIcon ,ChevronDownIcon,CandlestickChartIcon,
  Share2Icon,
  TimerIcon,
  TrendingUpIcon,
} from "lucide-react-native";
import Icon1 from 'react-native-vector-icons/Feather';
import { grey400 } from 'react-native-paper/lib/typescript/styles/themes/v2/colors';
import { Item } from 'react-native-paper/lib/typescript/components/Drawer/Drawer';
import io from 'socket.io-client';
import server from '../../utils/serverConfig';
import axios from 'axios';
import { FadeLoading } from 'react-native-fade-loading';
const screenWidth = Dimensions.get('window').width;
import { useModal } from '../../components/ModalContext';

const StockCardLoading = ({
  id = '',
  symbol = '',
  title = '',
  rationale='',
  OrderType = '',
  marketprice = '',
  Exchange = '',
  advisedRangeLower='',
  advisedRangeHigher='',
  getCartAllStocks,
  setSingleStockSelectState,
  Price = '',
  cmp = '',
  action = '',
  quantity = 1,
  advisedPrice = '',
  date = new Date(),
  isSelected = false,
  setStockDetails,
  stockDetails,
  recommendationStock,
  loading,
  setrecommendationStock,
  handleSingleSelectStock = () => {},
  handleSelectStock = () => {},
  handleDecreaseStockQty = () => {},
  handleIncreaseStockQty = () => {},
  handleTradePress=()=>{},
  handleAddToCartPress=()=>{},
  handleIgnoreTradePress=()=>{},
  handleLimitOrderInputChange = () => {},
  handleQuantityInputChange = () => {},
  setOpenIgnoreTradeModel = () => {},
  setStockIgnoreId = () => {},
  tradeId = '',
  
}) => {

  
  const isBuyAction = action.toLowerCase() === 'buy';
  const [inputPrice, setInputPrice] = useState(Price);
  const [market, setMarket] = useState(OrderType === 'LIMIT' ? 'Limit' : 'Market');
  const [isExpanded, setIsExpanded] = useState(false); 
  const [modalVisible, setModalVisible] = useState(false);
  const shouldShowReadMore = rationale.length > 60;
  const [showFullSymbol, setShowFullSymbol] = useState(false);

  const [ltp, setLtp] = useState([]); 
  const [socket, setSocket] = useState(null);
  const [loadingcart,setloadingcart]=useState(false);
  const [isLoading, setIsLoading] = useState(true);


  const getLTPForSymbol = useCallback(
    (symbol) => {
      const ltpItem = ltp.find((item) => item.tradingSymbol === symbol);
      return ltpItem ? ltpItem.lastPrice : null;
    },
    [ltp]
  );
  useEffect(() => {
    setInputPrice(Price);
  }, [Price]);

  useEffect(() => {
    setMarket(OrderType === 'LIMIT' ? 'Limit' : 'Market');
  }, [OrderType]);

  const handleInputChange = (text) => {
    setInputPrice(text);
    handleLimitOrderInputChange(text); 
  };

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  const openModal = () => {
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };
  const handleSymbolClick = (symbol) => {
    if(symbol.length>15){
    setShowFullSymbol(true);
    }
    else{
      console.log('not allowed');
    }
  };

  const handleCloseSymbolCard = () => {
    setShowFullSymbol(false);
  };
  
  const handleTouchOutside = () => {
    setShowFullSymbol(false);
    Keyboard.dismiss(); // Dismiss keyboard if it is open
  };
  const handleAddToCart = (symbol, tradeId,action) => {
    setloadingcart(true);
    const timeout = setTimeout(() => {
      setloadingcart(false);
      handleSelectStock(symbol, tradeId,action);
    }, 500);

  };

  return (
    
    <TouchableWithoutFeedback onPress={handleTouchOutside}>
    <View style={styles.card}>
      {/* {isLoading ? (
        <FadeLoading
          style={styles.loading}
          primaryColor="#f0f0f0"
          secondaryColor="#e0e0e0"
          duration={500}
        />
      ) : (
        <> */}
      <View style={styles.header}>
        <View style={styles.stockInfo}>
     
            <View onPress={() => handleSymbolClick(symbol)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {isLoading ? (
                <FadeLoading
                  style={{ width: 60, height: 10 }} // Adjust width for symbol loading
                  primaryColor="#f0f0f0"
                  secondaryColor="#e0e0e0"
                  duration={500}
                />
              ) : (
                <>
                  <Text style={styles.symbol}>
                    {symbol.length > 15 ? `${symbol.substring(0, )}...` : symbol}
                  </Text>
                  <Text style={{fontSize:11,alignSelf:'bottom',marginLeft:3,marginTop:3}}>{Exchange}</Text>
                </>
              )}
            </View>
        
          {isLoading ? (
  <FadeLoading
    style={{ width: 50, height: 10, marginTop: 5 }} // Adjust width for price loading
    primaryColor="#f0f0f0"
    secondaryColor="#e0e0e0"
    duration={500}
  />
) : (
  <>
    {showFullSymbol ? (
      <View style={styles.symbolCard}>
        <TouchableOpacity onPress={handleCloseSymbolCard} style={{backgroundColor:'white',elevation:4,padding:5,borderRadius:5,}}>
          <Text style={{fontFamily:'Poppins-Regular',marginTop:2,color:'black'}}>{symbol}</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <>
 
        <Text style={styles.ltp}>{getLTPForSymbol(symbol) ? `₹${getLTPForSymbol(symbol)}` : '₹--'}</Text>
      </>
    )}
  </>
)}

        </View>

        <View style={{flexDirection:'column',justifyContent:'space-between'}}>
        {isLoading ? (
            <FadeLoading
              style={{ width: 50, height: 10,marginTop:5,}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
          
        <View style={styles.actionContainer}>
        <View style={[styles.action, isBuyAction ? styles.buyAction : styles.sellAction]}>
          <Text style={[styles.actionText, isBuyAction ? styles.buyActiontext : styles.sellActiontext]}>
            {action}
          </Text>
        </View>
      </View>
          )}

{isLoading ? (
            <FadeLoading
              style={{ width: 100, height: 10,marginTop:5,}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
 
            <Text style={[{fontSize: 11}, isBuyAction ? { color: '#73BE4A' } : { color: '#ff0000' }]}>
          
          </Text>
          )} 
        </View> 
      </View>
      {isLoading ? (
            <FadeLoading
              style={{ width: 200, height: 10,marginTop:5, marginLeft:15}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
 
            <View style={{ flexDirection: 'column', }}>
            <Text style={{ paddingHorizontal:15,marginTop:5,textAlign:'left', fontFamily: 'Poppins-Light', fontSize: 12, color: '#858585' }}>
              <Text style={{color:'#4C4C4C',fontFamily:'Poppins-Regular'}}>Rationale : </Text>
              {isExpanded
                ? rationale
                : `${rationale.substring(0, 60)}...`}
              <Text onPress={openModal} style={{ fontFamily: 'Poppins-Regular',color: '#4B8CEE', padding: 1 }}>
                {isExpanded ? ' Read Less' : ' Read More'}
              </Text>
            </Text>
          </View>
          )} 

      
{isLoading ? (
            <FadeLoading
              style={{ justifyContent:'center', width: screenWidth*0.70, height: 55,marginTop:10, marginLeft:15}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <View style={styles.details}>
            <View style={styles.detailColumn}>
              <View style={{flexDirection:'row' ,alignContent:'flex-start',alignSelf:'flex-start',justifyContent:'space-between'}}>
              <Text style={styles.labelMarket}>{market}</Text>
              </View>
              {OrderType === 'LIMIT' ? (
                <View style={styles.inputContainer}> 
                  <Text style={styles.currencySymbol}>₹ </Text>
                  <TextInput
                    value={inputPrice ? `${inputPrice.toString()}` : ''}
                    onChangeText={handleInputChange}
                    style={styles.quantityInputLimit}
                    keyboardType="numeric"
                  />
                </View>
              ) : (
                <Text style={styles.valueMarket}>{OrderType === 'MARKET' && Exchange === -1 ? Exchange : '----'}</Text>
              )}
    
            </View>
            <View style={styles.quantitySection}>
              <View style={styles.detailColumn}>
                <Text style={styles.labelQuant}>Quantity</Text>
                <View style={styles.quantityContainer}>
                  <TouchableOpacity
                    onPress={() => handleDecreaseStockQty(symbol, tradeId)}
                    disabled={quantity <= 1}
                  >
                    <Icon1 name="minus" size={14} color="#000" />
                  </TouchableOpacity>
                  <TextInput
                    value={quantity.toString()}
                    onChangeText={(value) => handleQuantityInputChange(symbol, value, tradeId)}
                    style={styles.quantityInput}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity onPress={() => handleIncreaseStockQty(symbol, tradeId)}>
                    <Icon1 name="plus" size={14} color="#000" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.advisedRangeContainer}>
              <Text style={styles.label2}>Advised Range</Text>
              <Text style={styles.value2}>
                {advisedRangeLower && advisedRangeHigher ? (
                  `₹${advisedRangeLower}- ₹${advisedRangeHigher}`
                ) : advisedRangeLower ? (
                  `₹${advisedRangeLower}`
                ) : advisedRangeHigher ? (
                  `₹${advisedRangeHigher}`
                ) : (
                  `-`
                )}
              </Text>
            </View>
          </View>
          )}   
      {isLoading ? (
            <FadeLoading
              style={{ width: screenWidth*0.30, height: 10,marginTop:5, marginLeft:15}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <View style={styles.footer}>
            <CalendarDays size={18} color='#49484c' style={styles.iconSpacing}/>
            <Text style={styles.dateText}>{moment(date).format('Do MMM YYYY')} | </Text>
            <Text style={styles.dateText}>{moment(date).format('h:mm A')}</Text>
          </View>
          )}
      {isLoading ? (
            <FadeLoading
              style={{ width: screenWidth-110, height: 30,marginVertical:10, marginLeft:15}} // Adjust width for price loading
              primaryColor="#f0f0f0"
              secondaryColor="#e0e0e0"
              duration={500}
            />
          ) : (
            <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.discardBtn}
              onPress={() => handleIgnoreTradePress(id)} 
            >
            <BanIcon color={'#49484c'} size={26} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tradeBtn}
              onPress={() => handleTradePress(symbol, tradeId)}
            >
              <Text style={styles.tradeBtnText}>Trade Now</Text>
    
            </TouchableOpacity>
            <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { handleAddToCart(symbol, tradeId, isSelected ? "remove" : "add") }}
      style={[styles.addButton, isSelected && styles.undoButton]} // Apply the undoButton style conditionally
    >
    {loadingcart ? (
                  <ActivityIndicator size="small" color="#fff" /> // Show loading indicator
                ) : (
                  <>
    {isSelected ? (
            <MinusIcon size={16} color={'white'} /> // Show minus icon when isSelected is true
          ) : (
            <PlusIcon size={16} color={'white'} /> // Show plus icon when isSelected is false
          )}
      <Text style={styles.addButtonText}>
        {isSelected ? 'Undo Add' : 'Add to Cart'} 
      </Text>
                  </>
                )}  
    
    </TouchableOpacity>
       
          </View>
          )}


      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
            <Text style={styles.modalTitle}>{'Rationale for '+symbol}</Text>
            <XIcon onPress={closeModal} size={20} color={'black'}/>
            </View>
            <Text style={styles.modalRationale}>
            {rationale}
            </Text>
          </View>
        </View>
      </Modal>
 
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#00000010',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.06,
    padding:3,
    elevation:3,
    shadowColor:'black',
    shadowRadius: 4,
    marginHorizontal:5,
    width: screenWidth * 0.87,// Use percentage for responsiveness
    maxWidth: screenWidth-10,
 
  },
  loadingaddcart: {
    flexDirection: 'row',

    backgroundColor: '#f8f8f8',
    padding: 4,
    marginHorizontal:10,
    height:40,
    width:50,
 
  },
  loadingtradenow: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    padding: 4,
    marginHorizontal:10,
    height:40,
    width:50,
   
  },
  undoButton: {
    backgroundColor: '#E6626F', // red background for undo button
  },
  quantityContainer: {
    alignSelf:'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop:10,
  },
  stockInfo: {
    flexDirection: 'column',
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#262727',
  },
  ltp: {
    color: '#262727',
    fontSize: 18,
 
    fontWeight: 'bold',
  },
  actionContainer: {
    alignSelf: 'flex-end',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 2,
    borderRadius: 20,
    padding: 1,
  },
  symbolCard: {
    
  },
  buyAction: {
    backgroundColor: '#16A085',
  },
  sellAction: {
    backgroundColor: '#FDEAEC',
  },
  buyActiontext: {
    padding: 5,
    color: '#fff',
    fontFamily:'Poppins-Regular',
    fontSize: 16,
  },
  sellActiontext: {
    padding: 5,
    color: '#cf3a49',
    fontFamily:'Poppins-Regular',
    fontSize: 16,
    marginBottom: 1,
  },
  actionText: {
    fontSize: 20,
    padding: 0,
    fontWeight: 'bold',
    color: '#010001',
  },
  details: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#00000010',
    marginTop: 6,
    paddingHorizontal: 14,
  },
  detailColumn: {
    justifyContent: 'center',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  currencySymbol: {
    position: 'absolute',
    alignSelf: 'center',
    textAlign: 'center',
    padding: 4,
    fontSize: 14,
    color: '#000',
  },
  quantityInputLimit: {
    height: 22,
    width: 60,
    padding: 2,
    marginTop: 8,
    marginBottom: 8,
    color: '#0d0c22',
    fontSize: 14,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9e8e8',
    borderRadius: 4,
  },
  quantityInput: {
    width: '50%',
    height: 22,
    padding: 2,
    marginHorizontal: 4,
    color: '#0d0c22',
    fontSize: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e9e8e8',
    borderRadius: 4,
  },
  quantitySection: {
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: '#cbcacb',
    width: '40%',
    alignSelf: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  labelQuant: {
    fontSize: 12,
    alignSelf: 'center',
    marginVertical: 6,
    color: '#262727',
  },
  labelMarket: {
    fontSize: 12,
    alignSelf: 'flex-start',
    color: '#262727',
    marginTop: 6,
  },
  valueMarket: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#5a5a5a',
    marginTop: 8,
  },
  advisedRangeContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
    width: '33.33%',
  },
  label2: {
    fontSize: 12,
    color: '#00000070',
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    color: '#262727',
  },
  label3: {
    fontSize: 12,
    color: '#00000070',
    fontFamily: 'Poppins-Regular',
    fontWeight: '400',
    alignSelf:'flex-start',
 
    color: '#262727',
  },
  value2: {
    fontSize: 12,
    color: '#000000',
    marginTop: 6,
    fontFamily: 'Poppins-SemiBold',
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 14,
  },
  iconSpacing: {
    marginRight: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#49484c',
    fontWeight: '600',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  tradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignContent:'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#cbcacb',
    marginHorizontal: 6,
    flex: 1,
  },
  tradeBtnText: {
    fontFamily:'Poppins-Medium',
    fontSize: 14,
    color: '#000000',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#002a5c',
    padding: 8,
    borderRadius: 5,
    flex: 1,
  },
  addButtonText: {
    fontFamily:'Poppins-Medium',
    fontSize: 14,
    alignSelf: 'center',
    marginTop:1,
    color: '#FFFFFF',
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignContent:'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
    padding: 8,
    flex:0.25,
    borderRadius: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 10,
    color:'black',
    fontFamily:'Poppins-Bold'
  },
  modalRationale: {
    fontSize: 12,
    textAlign:'left',
    color: '#858585',
    marginBottom: 20,
    fontFamily:'Poppins-Regular'
  },
  closeButton: {
    backgroundColor: 'transparent',
    borderRadius: 5,
    padding: 5,
    alignSelf:'flex-end',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },

});

export default StockCardLoading;
