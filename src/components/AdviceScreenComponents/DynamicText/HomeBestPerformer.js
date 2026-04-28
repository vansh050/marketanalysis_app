import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, StyleSheet, View } from "react-native";
import Config from "react-native-config";
import { IndianRupee } from "lucide-react-native";
import Icon1 from 'react-native-vector-icons/FontAwesome';
// Import the WebSocketManager
import WebSocketManager from "./WebSocketManager";

const BestPerformerText= React.memo(({ closurestatus, type, symbol, advisedPrice, advisedRangeCondition, Exchange,advisedRangeHigher, advisedRangeLower,buysell, entryprice,quantity }) => {
  const [price, setPrice] = useState(null);
  const wsManagerRef = useRef(WebSocketManager.getInstance());
  const configPercentage = Config.REACT_APP_PERCENTAGE_GAIN;

  const handlePrice = useCallback((data) => {
    if (data?.last_traded_price !== undefined) {
      setPrice(data.last_traded_price);
    //       console.log('dataaa------',price);
    }
  }, []);

  useEffect(() => {
    if(symbol && Exchange) {
    wsManagerRef.current.subscribe(symbol, Exchange, handlePrice);
    }
  
  }, [symbol, Exchange, handlePrice]);

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


  let pnl = 0;
  let profitPercent = 0;
  


  
  // Ensure all values are numbers
  const priceNum = parseFloat(price);
  const entryPriceNum = parseFloat(entryprice);
  const qty = parseInt(quantity); // or parseFloat if needed
 // console.log('entry price----',symbol,entryPriceNum);
  //let pnl = 0;
  //let profitPercent = 0;
  let pnlOn1Lac = 0;
  
  if (!isNaN(priceNum) && !isNaN(entryPriceNum) && !isNaN(qty)) {
    const entryValue = entryPriceNum * qty;
  
    if (buysell === 'BUY') {
      pnl = (priceNum - entryPriceNum) * qty;
      profitPercent = ((priceNum - entryPriceNum) / entryPriceNum) * 100;
    } else if (buysell === 'SELL') {
      pnl = (entryPriceNum - priceNum) * qty;
      profitPercent = ((entryPriceNum - priceNum) / entryPriceNum) * 100;
    }
  
    if (entryValue > 0) {
      pnlOn1Lac = (pnl / entryValue) * 100000;
    }
  
    // Optional logging
    // console.log('Actual P&L:', pnl);
    // console.log('P&L on 1 Lac:', pnlOn1Lac);
    // console.log('Profit %:', profitPercent.toFixed(2));
  } else {
    // console.log('Invalid inputs:', { price, entryprice, quantity });
  }
  
  //console.log('price i get hereeeeeeeee:',symbol,price)
  return (
    <View style={{ flexDirection: "row", alignItems:'baseline', justifyContent:'space-between', alignContent:'flex-end',flex:1,}}>
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
         <View style={{flexDirection:'row', justifyContent:'space-between',flex:1,}}>
          <Text style={priceTextStyle}></Text>
          <Text style={priceTextStyle}>₹ {price !== null ? price : '-'}</Text>
       </View>
      )}
      {type==='bestP2' && (
            <View style={[styles.percentageBadge,{backgroundColor:pnl<0 ? '#9D2115' :'#14C46F'}]}>
                        <Text style={styles.percentageText}>
                          {profitPercent ? `${profitPercent.toFixed(2)}%` : "N/A"}
                        </Text>
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
  },
  percentageBadge: {
    backgroundColor: "#14C46F",
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  percentageText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily:'Satoshi-Bold',
  },
});

export default BestPerformerText;