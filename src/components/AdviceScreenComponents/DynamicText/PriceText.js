import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, StyleSheet, View } from "react-native";
import Config from "react-native-config";
import { IndianRupee } from "lucide-react-native";
import Icon1 from 'react-native-vector-icons/FontAwesome';
// Import the WebSocketManager
import WebSocketManager from "./WebSocketManager";

const PriceText = React.memo(({ closurestatus, type, symbol, advisedPrice, advisedRangeCondition, Exchange,advisedRangeHigher, advisedRangeLower }) => {
 // const [price, setPrice] = useState(null);
  const wsManagerRef = useRef(WebSocketManager.getInstance());
  const configPercentage = Config.REACT_APP_PERCENTAGE_GAIN;
  
  const [price, setLtp] = useState(null);
  
  const updateLtp = useCallback((newLtp) => {
    setLtp(newLtp);
  }, []);

  useEffect(() => {
    const wsInstance = WebSocketManager.getInstance();

    wsInstance.subscribe(symbol, Exchange, updateLtp);
    wsInstance.getLTP(symbol).then(setLtp).catch(() => {});

    // Optional cleanup if unsubscribe is supported
    return () => {
      wsInstance.unsubscribe?.(symbol, updateLtp);  // only if unsubscribe exists
    };
  }, [symbol, Exchange, updateLtp]);

  let missedGainPercentage = null;
  let percent = null;
  
  if (price != null && advisedPrice != null) {
    const missedGain = price - advisedPrice;
    missedGainPercentage = (((missedGain / advisedPrice) * 100)*100000)/100;
    percent = (missedGain / advisedPrice) * 100;
  }

  const advisedRangeConditionfinal =
  (advisedRangeHigher === 0 && advisedRangeLower === 0) ||
  (advisedRangeHigher === null && advisedRangeLower === null) ||
  (advisedRangeHigher > 0 &&
    advisedRangeLower > 0 &&
    parseFloat(advisedRangeHigher) >= parseFloat(price) &&
    parseFloat(price) >= parseFloat(advisedRangeLower)) ||
  (advisedRangeHigher > 0 &&
    advisedRangeLower === 0 &&
    advisedRangeLower === null &&
    parseFloat(advisedRangeHigher) >= parseFloat(price)) ||
  (advisedRangeLower > 0 &&
    advisedRangeHigher === 0 &&
    advisedRangeHigher === null &&
    parseFloat(advisedRangeLower) <= parseFloat(price));

  const priceTextStyle = [
    styles.priceText,
    type === "mainLTP" ? styles.priceText1 :
    type === "marketLTP" ? styles.value :
    type === "News" ? styles.headerCardPriceDate :
    type === "bestP1" ? styles.bestP1 :
    styles.value1,
  ];
  

  return (
    <View style={{ flexDirection: "row", alignItems:'baseline', justifyContent:'space-between', alignContent:'flex-end'}}>
      {type==='mainLTP' && (
        <View style={{flexDirection:'row',justifyContent:'space-between',flex:1,}}>
           <Text style={priceTextStyle}>₹ {price !== null ? price : '-'}</Text>
          {
            !advisedRangeConditionfinal && (
              <Text style={styles.redalert}>**Advice out of range</Text>
            )
          }
        </View>
      )}
       
      {type === "mainLTP" && missedGainPercentage !== null && percent > configPercentage && !closurestatus && (
        <View style={{flexDirection:'row', justifyContent:'center', alignContent:'center', alignItems:'center'}}>
          <View style={{borderWidth:1, borderColor:'#33D37C', padding:2, borderRadius:20}}>
            <IndianRupee style={{borderWidth:1, borderRadius:20, padding:3}} size={9} color={'#33D37C'}/>
          </View>
          <Icon1 name="angle-double-up" size={12} color={'#33D37C'} style={{paddingHorizontal:4}}/>
          <Text style={[styles.gainText, {fontSize:10}]}>Running Profit</Text>
          <Text style={[styles.gainText, { color: "#33D37C", marginLeft: 2 }]}>
            {missedGainPercentage.toFixed(2)}
          </Text>
        </View>
      )}
      {type==='aftersubCP' && (
         <View style={{flexDirection:'row', justifyContent:'center', alignContent:'center', alignItems:'center'}}>
          <Text style={priceTextStyle}>₹ {price !== null ? price : '-'}</Text>
       </View>
      )}
      {type==='News' && (
         <View style={{flexDirection:'row', justifyContent:'center', alignContent:'center', alignItems:'center'}}>
          <Text style={priceTextStyle}>₹ {price !== null ? price : '-'}</Text>
       </View>
      )}
         {type==='bestP1' && (
         <View style={{flexDirection:'row', justifyContent:'space-between',flex:1}}>
          <Text style={priceTextStyle}>₹ {price !== null ? price : '-'}</Text>
          <Text style={styles.bestP1change}>₹ {price !== null ? price : '-'}</Text>
       </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  priceText: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    color: '#6B46C1',
  },
  bestP1: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: '#fff',
  },
  bestP1: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily:'Satoshi-Medium',
    marginTop: 2,
  },
  bestP1change: {
    fontSize: 16,
    color: "#14C46F",
    fontFamily:'Satoshi-Medium',
    marginTop: 4,
    marginLeft:20,
  },
  priceText1: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    color: '#6B46C1',
    marginTop: 4,
  },
  redalert: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
    color: 'red',
    marginTop: 4,
  },
  headerCardPriceDate: {
    color: '#626262',
    fontFamily: 'Satoshi-Medium',
    fontSize: 18,
  },
  value: {
    fontSize: 15,
    color: '#C7C7C7',
    marginBottom: 4,
    fontFamily: 'Satoshi-Regular',
  },
  value1: {
    fontSize: 13,
    color: '#000',
    marginBottom: 4,
    fontFamily: 'Satoshi-Medium',
  },
  gainText : {
    fontSize: 12,
    color: '#33D37C',
    fontFamily: 'Satoshi-Medium',
  }
});

export default PriceText;