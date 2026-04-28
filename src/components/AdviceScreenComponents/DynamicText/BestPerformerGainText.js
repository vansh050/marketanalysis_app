import React, { useState, useEffect, useCallback } from "react";
import { Text, StyleSheet, View } from "react-native";
import WebSocketManager from "./WebSocketManager";

const MissedGainText = React.memo(({ symbol, advisedRangeCondition, advisedPrice, exchange, type }) => {
  const [price, setLtp] = useState(null);

  const updateLtp = useCallback((symbol, newPrice) => {
    // Handle both object {symbol, ltp} and direct number formats
    let actualPrice;
    
    if (typeof newPrice === 'object' && newPrice !== null) {
      // Try multiple possible property names
      actualPrice = newPrice.ltp ?? newPrice.last_traded_price ?? newPrice.price;
    } else {
      actualPrice = newPrice;
    }
    
    // Only update if we have a valid number
    if (typeof actualPrice === 'number' && !isNaN(actualPrice) && actualPrice > 0) {
      setLtp(actualPrice);
      console.log('Updated LTP for', symbol, ':', actualPrice);
    }
  }, []);

  useEffect(() => {
    const wsInstance = WebSocketManager.getInstance();

    wsInstance.subscribe(symbol, exchange || 'NSE', (newPrice) => 
      updateLtp(symbol, newPrice)
    );
    
    wsInstance
      .getLTP(symbol)
      .then((priceData) => updateLtp(symbol, priceData))
      .catch((error) => {
        console.log('LTP error for', symbol, ':', error);
      });

    return () => {
      wsInstance.unsubscribe?.(symbol, updateLtp);
    };
  }, [symbol, exchange, updateLtp]);

  console.log('Symbol, Exchange, Price:', symbol, exchange, price);

  // Helper to safely format price
  const formatPrice = (value) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    return !isNaN(numValue) && numValue > 0 ? numValue.toFixed(2) : '-';
  };

  // Helper to safely format percentage
  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '0.00';
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    return !isNaN(numValue) ? numValue.toFixed(2) : '0.00';
  };

  let missedGainPercentage = null;

  if (price != null && advisedPrice != null) {
    const numPrice = parseFloat(price);
    const numAdvisedPrice = parseFloat(advisedPrice);
    
    if (!isNaN(numPrice) && !isNaN(numAdvisedPrice) && numAdvisedPrice !== 0) {
      const missedGain = numPrice - numAdvisedPrice;
      missedGainPercentage = (missedGain / numAdvisedPrice) * 100;
    } else {
      missedGainPercentage = 0;
    }
  }

  const backgroundColor = missedGainPercentage != null && missedGainPercentage > 0
    ? '#338D72'
    : '#EF344A';

  return (
    <View>
      <View style={styles.priceContainer}>
        {type === 'performers' ? (
          <View style={{ flexDirection: 'row', marginLeft: 10 }}>
            <Text style={styles.price}>₹{formatPrice(price)}</Text>
            <View
              style={{
                backgroundColor,
                paddingHorizontal: 5,
                paddingVertical: 2,
                borderRadius: 20,
                marginLeft: 5,
                alignSelf: 'center',
              }}
            >
              <Text style={[styles.change, { color: '#fff' }]}>
                {formatPercentage(missedGainPercentage)}%
              </Text>
            </View>
          </View>
        ) : type === 'aftersub' ? (
          <Text style={styles.Aftersub}>₹{formatPrice(price)}</Text>
        ) : type === 'portfolio' ? (
          <Text style={styles.portfolio}>₹{formatPrice(price)}</Text>
        ) : type === 'watchlist' ? (
          <Text style={styles.watchlist}>₹{formatPrice(price)}</Text>
        ) : type === 'newsscreen' ? (
          <Text style={styles.newsscreen}>₹{formatPrice(price)}</Text>
        ) : (
          <Text style={styles.price}>₹{formatPrice(price)}</Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  price: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: "black",
  },
  newsscreen: {
    color: '#626262',
    fontFamily: 'Satoshi-Medium',
    fontSize: 18,
  },
  watchlist: {
    color: '#000',
    fontFamily: 'Satoshi-Medium',
    fontSize: 14,
  },
  portfolio: {
    fontSize: 14,
    color: '#A0A0A0',
    fontFamily: 'Satoshi-Medium',
  },
  Aftersub: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: "black",
  },
  change: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
  },
  priceContainer: {
    flexDirection: 'row',
  },
});

export default MissedGainText;