import React, { useState, useEffect } from "react";
import { Text, StyleSheet,View } from "react-native";
import axios from 'axios';
import { io } from "socket.io-client";
import useLTPStore from "./DynamicText/useLtpStore";
import { designColor, designFont } from '../../design/literalTokens';
// WebSocket Manager remains the same

const ReviewTradeText = React.memo(({ symbol, orderType, exchange, limitPrice, triggerPrice, transactionType }) => {
  const price = useLTPStore((state) => state.ltps[symbol]);

  // Ensure price is always a number or null
  const numericPrice = typeof price === "number" ? price : Number(price);
  const finalPrice = isNaN(numericPrice) ? null : numericPrice;

  const renderPrice = () => {
    const formatted = finalPrice !== null ? finalPrice.toFixed(2) : "-";

    switch (orderType) {
      case "MARKET":
        return (
          <View style={styles.row}>
            <Text style={styles.cellTextmktprice}>₹{formatted}</Text>
            <Text style={styles.mutedText}> (Mkt)</Text>
          </View>
        );

      case "LIMIT":
        return (
          <View style={styles.row}>
            <Text style={styles.cellTextmktprice}>₹{formatted}</Text>
            <Text style={styles.mutedText}>
               (Lmt)
            </Text>
          </View>
        );

      case "SL": {
        // Stop-limit (trigger) entry: the order waits at the broker until
        // the price reaches the trigger, then works as a limit order.
        const trigger = Number(triggerPrice);
        const isSell = String(transactionType || "").toUpperCase() === "SELL";
        return (
          <View>
            <View style={styles.row}>
              <Text style={styles.cellTextmktprice}>₹{formatted}</Text>
              <Text style={styles.mutedText}> (Trigger)</Text>
            </View>
            {trigger > 0 ? (
              <Text style={styles.mutedText}>
                {isSell ? "Sell only if price falls to" : "Buy only if price rises to"} ₹{trigger}
                {Number(limitPrice) > 0 ? ` (limit ₹${limitPrice})` : ""}, valid today
              </Text>
            ) : null}
          </View>
        );
      }

      case "BUY":
      case "SELL":
        return (
          <View style={styles.center}>
            <Text style={styles.cellTextmktprice}>₹{formatted}</Text>
          </View>
        );

      default:
        return (
          <View style={styles.center}>
            <Text style={styles.fnostyle}>₹{formatted}</Text>
          </View>
        );
    }
  };

  return renderPrice();
});


const styles = StyleSheet.create({
  cellTextmktprice: {
    fontSize: 12,
    color: designColor('333333'),
    fontFamily:designFont('Poppins-Small'),
    textAlign: "right",
  },
  fnostyle : {
    fontSize: 13,
    marginLeft:5,
    alignContent:'center',
    alignItems:'center',
    alignSelf:'center',
    color: designColor('333333'),
    fontFamily:designFont('Satoshi-Medium'),
    textAlign: "right",
  },
  mutedText : {
    color:'grey',fontSize:10,fontFamily:designFont('Poppins-Small'),
  }
});

export default ReviewTradeText;