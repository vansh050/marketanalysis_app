import React, { useState, useEffect, useCallback, useRef } from "react";
import { Text, StyleSheet, View } from "react-native";
import axios from 'axios';
import { io } from "socket.io-client";
import server from '../../../utils/serverConfig';

// Create a singleton WebSocket manager
const WebSocketManager = (() => {
  let instance = null;
  let subscribers = new Map();
  let socket = null;
  
  return {
    getInstance() {
      if (!instance) {
        instance = {
          connect() {
            if (socket) return;
            
            socket = io(`${server.ccxtWs.baseUrl}/ltp`, {
              transports: ["websocket"],
              query: { EIO: "4" },
            });

            socket.on("market_data", (data) => {
              const callbacks = subscribers.get(data.stockSymbol) || [];
              callbacks.forEach(callback => callback(data.last_traded_price));
            });
          },
          
          subscribe(symbol, callback) {
            if (!subscribers.has(symbol)) {
              subscribers.set(symbol, []);
              // Subscribe via API only if this is the first subscriber
              this.subscribeToAPI(symbol);
            }
            subscribers.get(symbol).push(callback);
          },
          
          unsubscribe(symbol, callback) {
            const callbacks = subscribers.get(symbol) || [];
            subscribers.set(symbol, callbacks.filter(cb => cb !== callback));
            
            if (subscribers.get(symbol).length === 0) {
              subscribers.delete(symbol);
              // Could add API unsubscribe here if needed
            }
          },
          
          async subscribeToAPI(symbol) {
            try {
              await axios.post(`${server.ccxtWs.httpUrl}/websocket/subscribe`, {
                symbol,
                exchange: "NSE" // Adjust as needed
              });
            } catch (error) {
              console.error(`Error subscribing to ${symbol}:`, error);
            }
          },
          
          disconnect() {
            if (socket) {
              socket.disconnect();
              socket = null;
            }
            subscribers.clear();
          }
        };
      }
      return instance;
    }
  };
})();

const MissedGainText = React.memo(({ symbol,advisedRangeCondition,advisedPrice,type }) => {
  const [price, setPrice] = useState(null);
  const wsManager = WebSocketManager.getInstance();
  
  useEffect(() => {
    const handlePrice = (newPrice) => {
      setPrice(newPrice);
    };
    
    wsManager.connect();
    wsManager.subscribe(symbol, handlePrice);
    
    return () => {
      wsManager.unsubscribe(symbol, handlePrice);
    };
  }, [symbol]);

  let missedGainPercentage = null;

  // Ensure price and advisedPrice are valid before calculation
  if (price != null && advisedPrice != null) {
    const missedGain = price - advisedPrice;
    //console.log('ltp:', price, 'advised:', advisedPrice);

    // Calculate the percentage of missed gain
    missedGainPercentage = (missedGain / advisedPrice) * 100;
   // console.log('Missed Gain:', missedGain, 'Missed Gain Percentage:', missedGainPercentage.toFixed(2));
  } else {
   // console.log('Calculation skipped: Price or Advised Price is null/undefined.');
  }
 console.log('misss',missedGainPercentage,advisedPrice,price);
  return (
    <View>
    {!advisedRangeCondition ? (
      <Text
        style={[
          { fontSize: 10, fontFamily: 'Satoshi-Bold' },
         { color: 'red' }
        ]}
      >
        **Price is out of advised range**
      </Text>
    ) : price != null && advisedPrice != null && missedGainPercentage > 5 ? (
      <Text
        style={[
          { fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#16A085' }
        ]}
      >
        {missedGainPercentage.toFixed(2)}% Gain Missed, Buy Fast**
      </Text>
    ) : null}
  </View>
  

  );
});

const styles = StyleSheet.create({
  priceText: {
    fontSize: 16,
 
    padding:0,
    margin:0,
    fontFamily:'Satoshi-Bold',
    color: "black",
  },
});

export default MissedGainText;