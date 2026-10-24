import React, { useState, useEffect } from "react";
import { Text, StyleSheet, View } from "react-native";
import { subscribeLTP } from '../../../utils/ltpPoller';

import { designColor, designFont } from '../../../design/literalTokens';

// Prices come from the shared REST poller (utils/ltpPoller.js); the socket.io
// feed on ccxt.alphaquark.in this used no longer exists.
const WebSocketManager = (() => {
  let instance = null;
  const releases = new Map(); // callback -> release function
  return {
    getInstance() {
      if (!instance) {
        instance = {
          connect() {},
          subscribe(symbol, exchange, callback) {
            releases.set(callback, subscribeLTP(symbol, exchange || 'NSE', callback));
          },
          unsubscribe(symbol, callback) {
            const release = releases.get(callback);
            if (release) release();
            releases.delete(callback);
          },
          disconnect() {
            releases.forEach(release => release());
            releases.clear();
          },
        };
      }
      return instance;
    },
  };
})();

const WebsocketSubText = React.memo(({ symbol, advisedRangeCondition, advisedPrice, exchange, type }) => {
  const [price, setPrice] = useState(null);
  const wsManager = WebSocketManager.getInstance();
  
  useEffect(() => {
    const handlePrice = (newPrice) => {
     // console.log('New Price:', newPrice);
      setPrice(newPrice);
    };
    
    wsManager.connect();
    wsManager.subscribe(symbol, exchange, handlePrice);
    
    return () => {
      wsManager.unsubscribe(symbol, handlePrice);
    };
  }, [symbol, exchange]); 
  
  let missedGainPercentage = null;
  //console.log('advisePrice:',advisedPrice);
  if (price != null && advisedPrice != null) {
    const missedGain = price - advisedPrice;
    missedGainPercentage = (missedGain / advisedPrice) * 100;
   // console.log('missed:',missedGainPercentage);
  }
  const backgroundColor = missedGainPercentage != null && missedGainPercentage > 0 ? designColor('338d72') : designColor('ef344a');

  return (
    <View>
      <View style={styles.priceContainer}>
        <Text style={styles.price}>₹{price}</Text>
        {type==='performers' ? (
          <View style={{ backgroundColor: backgroundColor, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 20, marginLeft: 5, alignSelf: 'center' }}>
          <Text style={[styles.change, { color: designColor('fff') }]}>
          {missedGainPercentage ? missedGainPercentage.toFixed(2) : "N/A"}%
          </Text>
        </View>) : null }
     
      </View>
    </View>
  );
});


const styles = StyleSheet.create({
  priceText: {
    fontSize: 16,
 
    padding:0,
    margin:0,
    fontFamily:designFont('Satoshi-Bold'),
    color: "black",
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: designColor('fff'),
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: designColor('e6e6e6'),
  },
  stockName: {
    fontSize: 14,
    color: 'black',
    fontFamily: designFont('Satoshi-Bold'),
    textAlign: 'left',
  },
  chartContainer: {
    width: 100, // Adjust container width
    justifyContent: 'flex-start', // Align the chart to the start
  },
  chart: {
    alignContent:'center',
    alignItems:'center',
    alignSelf:'center',
    justifyContent:'flex-start',
    width:0
  },
  priceContainer: {
    flexDirection: 'row', 
    alignItems: 'center',
    alignSelf: 'center',
    marginLeft: 10,
  },
  price: {
    fontSize: 16,
    color: 'black',
    textAlign: 'center',
    fontFamily: designFont('Satoshi-Medium'),
  },
  change: {
    fontSize: 12,
    color: designColor('fff'),
    textAlign: 'center',
    fontFamily: designFont('Satoshi-Regular'),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  headerTitle: {
    fontSize: 20,
    fontFamily: designFont('Satoshi-Bold'),
    marginBottom: 10,
    color: 'black',
  },
});

export default WebsocketSubText;