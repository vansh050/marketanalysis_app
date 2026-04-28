import React, { useState, useEffect } from "react";
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
              reconnection: true,
              reconnectionAttempts: 5,
              reconnectionDelay: 1000
            });

            socket.on("connect", () => {
              // Resubscribe to all existing symbols when connection is established
              subscribers.forEach((callbacks, symbol) => {
                if (callbacks.length > 0) {
                  this.subscribeToAPI(symbol, callbacks[0].exchange);
                }
              });
            });

            socket.on("market_data", (data) => {
              const callbacks = subscribers.get(data.stockSymbol) || [];
              callbacks.forEach(callback => callback(data.last_traded_price));
            });

            socket.on("disconnect", (reason) => {
              // WebSocket disconnected - silent
            });

            socket.on("connect_error", (error) => {
              // WebSocket connection error - silent
            });
          },
          
          subscribe(symbol, exchange, callback) {
            // Attach exchange information to the callback
            callback.exchange = exchange;

            if (!subscribers.has(symbol)) {
              subscribers.set(symbol, []);
            }
            subscribers.get(symbol).push(callback);

            // Immediately subscribe to API for this symbol
            this.subscribeToAPI(symbol, exchange);
          },
          
          unsubscribe(symbol, callback) {
            const callbacks = subscribers.get(symbol) || [];
            subscribers.set(symbol, callbacks.filter(cb => cb !== callback));
            
            if (subscribers.get(symbol).length === 0) {
              subscribers.delete(symbol);
              // Optional: Add API unsubscribe logic here
            }
          },
          
          async subscribeToAPI(symbol, exchange, retries = 3, delay = 3000) {
            // Ensure socket is connected before subscribing
            if (!socket || !socket.connected) {
              this.connect();
              await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay to ensure connection
            }

            for (let attempt = 1; attempt <= retries; attempt++) {
              try {
                const response = await axios.post(`${server.ccxtWs.httpUrl}/websocket/subscribe`, {
                  symbol: symbol,
                  exchange: exchange
                }, {
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });

               // console.log(`Successfully subscribed to ${symbol} on ${exchange}`, response.data);
                return; // Exit early if subscription is successful
              } catch (error) {
                //console.error(`Attempt ${attempt} failed: Error subscribing to ${symbol} on ${exchange}:`, error);
                
                // If it's the last attempt, stop retrying
                if (attempt === retries) {
                  //console.error(`All ${retries} attempts failed for ${symbol}. Subscription failed.`);
                  break;
                }
                
                // Wait for the specified delay before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
              }
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
  const backgroundColor = missedGainPercentage != null && missedGainPercentage > 0 ? '#338D72' : '#EF344A';

  return (
    <View>
      <View style={styles.priceContainer}>
        <Text style={styles.price}>₹{price}</Text>
        {type==='performers' ? (
          <View style={{ backgroundColor: backgroundColor, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 20, marginLeft: 5, alignSelf: 'center' }}>
          <Text style={[styles.change, { color: '#fff' }]}>
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
    fontFamily:'Satoshi-Bold',
    color: "black",
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E6',
  },
  stockName: {
    fontSize: 14,
    color: 'black',
    fontFamily: 'Satoshi-Bold',
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
    fontFamily: 'Satoshi-Medium',
  },
  change: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'Satoshi-Regular',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  headerTitle: {
    fontSize: 20,
    fontFamily: 'Satoshi-Bold',
    marginBottom: 10,
    color: 'black',
  },
});

export default WebsocketSubText;