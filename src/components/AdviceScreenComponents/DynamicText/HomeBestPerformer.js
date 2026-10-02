import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, StyleSheet, View } from "react-native";
import Config from "react-native-config";
import { IndianRupee } from "lucide-react-native";
import Icon1 from 'react-native-vector-icons/FontAwesome';
// Import the WebSocketManager
import WebSocketManager from "./WebSocketManager";
import { isPriceInRecommendedRange } from "../../../utils/recommendationPnl";

import { designColor, designFont } from '../../../design/literalTokens';

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

  const advisedRangeConditionfinal = isPriceInRecommendedRange(
    price,
    advisedRangeLower,
    advisedRangeHigher,
  );

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
              <Text style={styles.redalert}>**Recommendation out of range</Text>
            )
          }
        </View>
      )}
      {type === "mainLTP" && missedGainPercentage !== null && percent > configPercentage && !closurestatus && (
        <View style={{flexDirection:'row', justifyContent:'center', alignContent:'center', alignItems:'center'}}>
          <View style={{borderWidth:1, borderColor:designColor('33d37c'), padding:2, borderRadius:20}}>
            <IndianRupee style={{borderWidth:1, borderRadius:20, padding:3}} size={9} color={designColor('33d37c')}/>
          </View>
          <Icon1 name="angle-double-up" size={12} color={designColor('33d37c')} style={{paddingHorizontal:4}}/>
          <Text style={[styles.gainText, {fontSize:10}]}>Running Profit</Text>
          <Text style={[styles.gainText, { color: designColor('33d37c'), marginLeft: 2 }]}>
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
            <View style={[styles.percentageBadge,{backgroundColor:pnl<0 ? designColor('9d2115') :designColor('14c46f')}]}>
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
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('6b46c1'),
  },
  bestP1: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('fff'),
  },
  bestP1: {
    fontSize: 16,
    color: designColor('ffffff'),
    fontFamily:designFont('Satoshi-Medium'),
    marginTop: 2,
  },
  bestP1change: {
    fontSize: 16,
    color: designColor('14c46f'),
    fontFamily:designFont('Satoshi-Medium'),
    marginTop: 4,
    marginLeft:20,
  },
  priceText1: {
    fontSize: 18,
    fontFamily: designFont('Satoshi-Medium'),
    color: designColor('6b46c1'),
    marginTop: 4,
  },
  redalert: {
    fontSize: 11,
    fontFamily: designFont('Satoshi-Medium'),
    color: 'red',
    marginTop: 4,
  },
  headerCardPriceDate: {
    color: designColor('626262'),
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 18,
  },
  value: {
    fontSize: 15,
    color: designColor('c7c7c7'),
    marginBottom: 4,
    fontFamily: designFont('Satoshi-Regular'),
  },
  value1: {
    fontSize: 13,
    color: designColor('000'),
    marginBottom: 4,
    fontFamily: designFont('Satoshi-Medium'),
  },
  gainText : {
    fontSize: 12,
    color: designColor('33d37c'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  percentageBadge: {
    backgroundColor: designColor('14c46f'),
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  percentageText: {
    color: designColor('ffffff'),
    fontSize: 10,
    fontFamily:designFont('Satoshi-Bold'),
  },
});

export default BestPerformerText;
