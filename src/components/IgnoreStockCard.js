import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import moment from 'moment';
import { BanIcon, CalendarDays, MinusIcon, PlusIcon ,ChevronDownIcon,Undo2Icon} from "lucide-react-native";
import Icon1 from 'react-native-vector-icons/Feather';
import { grey400 } from 'react-native-paper/lib/typescript/styles/themes/v2/colors';
const screenWidth = Dimensions.get('window').width;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375; // Assuming the design is based on a 375px wide screen (iPhone X)
const responsiveFontSize = (fontSize) => Math.round(fontSize * scale);
const IgnoreStockCard = ({
  id = '',
  symbol = '',
  title = '',
  ltp = undefined,
  OrderType = '',
  marketprice = '',
  Exchange = '',
  advisedRangeLower='',
  advisedRangeHigher='',
  Price = '',
  cmp = '',
  action = '',
  quantity = 1,
  advisedPrice = '',
  date = new Date(),
  isSelected = false,
  handleSingleSelectStock = () => {},
  handleSelectStock = () => {},
  handleDecreaseStockQty = () => {},
  handleIncreaseStockQty = () => {},
  handleTradePress=()=>{},
  handleIgnoreTradePress=()=>{},
  handleLimitOrderInputChange = () => {},
  handleQuantityInputChange = () => {},
  setOpenIgnoreTradeModel = () => {},
  setStockIgnoreId = () => {},
  onRevertBack = () => {},
  tradeId = '',
  
}) => {
  const isBuyAction = action.toLowerCase() === 'buy';
  const [inputPrice, setInputPrice] = useState(Price);
  const [market, setMarket] = useState(OrderType === 'LIMIT' ? 'LIMIT' : 'MARKET');

  

  useEffect(() => {
    setInputPrice(Price);
  }, [Price]);

  useEffect(() => {
    setMarket(OrderType === 'LIMIT' ? 'LIMIT' : 'MARKET');
  }, [OrderType]);

  const handleInputChange = (text) => {
    setInputPrice(text);
    handleLimitOrderInputChange(text); 
  };

  return (
    <View key={id} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.stockInfo}>
          <Text style={styles.symbol}>{symbol}</Text>
          <Text style={styles.ltp}>
            {ltp !== undefined ? `₹${ltp}` : '₹--'}
          </Text>
        </View>
        <View style={{flexDirection:'column',justifyContent:'space-between'}}>
        <View style={styles.actionContainer}>
          <View style={[styles.action, isBuyAction ? styles.buyAction : styles.sellAction]}>
            <Text style={[styles.actionText, isBuyAction ? styles.buyActiontext : styles.sellActiontext]}>
              {action}
            </Text>
          </View>
        </View>
        
        <Text style={[{fontSize: 11}, isBuyAction ? { color: '#0f9071' } : { color: '#ff0000' }]}>
          {isBuyAction ? "+30% Gain Missed, Buy Fast**" : "Sell before price drops further**"}
        </Text>
        </View>
      </View>
      <View style={styles.details}>
        <View style={styles.detailColumn}>
          <View style={{flexDirection:'row' ,alignContent:'center',alignSelf:'center',alignItems:'center',justifyContent:'space-between'}}>
          <Text style={styles.labelMarket}>ORDER TYPE</Text>
          {/* <ChevronDownIcon size={20} color={'black'} style={{marginTop:5}}/> */}
          </View>
          {OrderType === 'LIMIT' ? (
            <Text style={styles.valueMarket}>LIMIT</Text>
          ) : (
            <Text style={styles.valueMarket}>MARKET</Text>
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
      <View style={styles.footer}>
        <CalendarDays size={18} color='#49484c' style={styles.iconSpacing}/>
        <Text style={styles.dateText}>Date: {moment(date).format('Do MMM YYYY')} | </Text>
        <Text style={styles.dateText}>{moment(date).format('h:mm A')}</Text>
      </View>
      <View style={styles.buttonsContainer}>
     
        <TouchableOpacity
          style={styles.tradeBtn}
          onPress={() => onRevertBack(id)}
        >
        <View style={{flexDirection:'row',justifyContent:'center',paddingHorizontal:4,alignContent:'center',alignItems:'center',alignSelf:'center'}}>
        <Undo2Icon
                size={18} color={'black'}
                style={{marginRight:5,alignSelf:'center',marginBottom:3}}
                />
          <Text style={styles.tradeBtnText}>Revert To Home</Text>
        </View>
        </TouchableOpacity>
     
        <TouchableOpacity onPress={() => handleTradePress(symbol, id)} style={styles.addButton}>
          <Text style={styles.addButtonText}>Trade Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    
    borderRadius: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#00000010',
    shadowColor: '#000',
    backgroundColor: '#FFFFFF', // bg-white
 
    shadowOffset: { width: 3, height: 6 }, // shadow offset equivalent to shadow-[3px_6px_30px_0px]
    shadowOpacity: 0.15, // shadow opacity
    shadowRadius: 30, // shadow blur radius
    elevation: 6, 
    marginHorizontal:5,
    width: screenWidth * 0.93,// Use percentage for responsiveness
    alignSelf:'center',
 
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#262727',
  },
  ltp: {
    color: '#262727',
    marginTop: 4,
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
    borderRadius: 8,
    padding: 1,
  },
  buyAction: {
    backgroundColor: '#e7f6f3',
  },
  sellAction: {
    backgroundColor: '#FDEAEC',
  },
  buyActiontext: {
    padding: 5,
    color: '#0f9071',
    fontWeight: 'bold',
    fontSize: 18,
  },
  sellActiontext: {
    padding: 5,
    color: '#cf3a49',
    fontFamily:'Poppins-Regular',
    fontSize: 14,
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
    justifyContent:'center',
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
    fontSize: 15,
    color: '#000000',
    
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 5,
    flex: 1,
  },
  addButtonText: {
    fontFamily:'Poppins-Medium',
    fontSize: 15,
    alignSelf: 'center',
    color: '#FFFFFF',
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
    padding: 8,
    borderRadius: 5,
  },
});

export default IgnoreStockCard;
