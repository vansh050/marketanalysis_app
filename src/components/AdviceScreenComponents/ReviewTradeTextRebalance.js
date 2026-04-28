import React, { useState, useEffect } from "react";
import { Text, StyleSheet,View } from "react-native";
import axios from 'axios';
import { io } from "socket.io-client";
import useLTPStore from "./DynamicText/useLtpStore";
// WebSocket Manager remains the same

const ReviewTradeTextRebalance = React.memo(({ symbol, orderType,exchange, limitPrice }) => {
  const price = useLTPStore((state) => state.ltps[symbol]);
  console.log('price----------',price,orderType);
    const renderPrice = () => {
    switch (orderType) {
      case 'MARKET':
        return <View style={{alignContent:'center',alignItems:'center',alignSelf:'center',flexDirection:'row'}}>
          <Text style={styles.cellTextmktprice}>₹{price !== null ? price?.toFixed(2) : '-'}</Text>
          <Text style={{color:'grey',fontSize:10,fontFamily:'Poppins-Small'}}> (Mkt)</Text>
          </View>;
      case 'LIMIT':
        return <View style={{alignContent:'center',alignItems:'center',alignSelf:'center',flexDirection:'row'}}>
             <Text style={styles.cellTextmktprice}>₹{price !== null ? price?.toFixed(2) : '-'}</Text>
             <Text style={{color:'grey',fontSize:10,fontFamily:'Poppins-Small'}}>{limitPrice !== null ? limitPrice : '-'} (Lmt)</Text>
            </View>
     ;
     case 'BUY':
        return <View style={{alignContent:'center',alignItems:'center',alignSelf:'center'}}>
          <Text style={styles.cellTextmktprice}>₹{price !== null ? price?.toFixed(2) : '-'}</Text>
        
          </View>;
    case 'SELL':
          return <View style={{alignContent:'center',alignItems:'center',alignSelf:'center'}}>
              <Text style={styles.cellTextmktprice}>₹{price !== null ? price?.toFixed(2) : '-'}</Text>
              </View>;
      default:
        return <View style={{alignContent:'center',alignItems:'center',alignSelf:'center'}}>
        <Text style={styles.fnostyle}>₹{price !== null ? price?.toFixed(2) : '-'}</Text>
        </View>;
    }
  };

  return renderPrice();
});

const styles = StyleSheet.create({
  cellTextmktprice: {
    alignSelf: 'flex-start',
    color: 'black',
    flexDirection: 'column',
    fontFamily: 'Poppins-Regular',
  },
  fnostyle : {
    fontSize: 13,
    marginLeft:5,
    alignContent:'center',
    alignItems:'center',
    alignSelf:'center',
    color: "#333333",
    fontFamily:'Satoshi-Medium',
    textAlign: "right",
  }
});

export default ReviewTradeTextRebalance;