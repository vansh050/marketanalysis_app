import React, { useState, useEffect, useCallback } from 'react';
import { Text, StyleSheet } from 'react-native';
import WebSocketManager from './WebSocketManager';

const HoldingDynamicText = React.memo(
  ({ symbol, exchange, investedAmount = 0, quantity = 0, type, isClosed = false }) => {
    const [price, setPrice] = useState(null);

    // Update price callback
   const updatePrice = useCallback((symbol, newPrice) => {
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
        setPrice(actualPrice);
      }
    }, []);

    const currentPrice = parseFloat(price ?? 0);
    const invested = parseFloat(investedAmount);
    const qty = parseFloat(quantity);

    const profitOrLoss = currentPrice && invested
      ? (currentPrice - invested / qty) * qty
      : 0;

    const pnlPercent = invested > 0
      ? (profitOrLoss / invested) * 100
      : 0;

    const pnlColor =
      profitOrLoss > 0 ? '#338D72' : profitOrLoss < 0 ? '#EF344A' : '#A0A0A0';

    // Fetch live LTP
    useEffect(() => {
      if (!symbol) return;
      const ws = WebSocketManager.getInstance();
      ws.subscribe(symbol, exchange ?? 'NSE', (newPrice) =>
        updatePrice(symbol, newPrice)
      );
      ws.getLTP(symbol)
        .then((priceData) => updatePrice(symbol, priceData))
        .catch((err) => console.log('LTP error for', symbol, err));

      return () => {
        ws.unsubscribe?.(symbol, updatePrice);
      };
    }, [symbol, exchange, updatePrice]);

    const formatRupee = (value) => {
      if (value > 0) return `+₹${value.toFixed(2)}`;
      if (value < 0) return `-₹${Math.abs(value).toFixed(2)}`;
      return '₹0.00';
    };

    const formatPercent = (value) => {
      if (value > 0) return `+${value.toFixed(2)}%`;
      if (value < 0) return `-${Math.abs(value).toFixed(2)}%`;
      return '0.00%';
    };

    // Render based on type
    switch (type) {
      case 'pnlRupee':
        return <Text style={[styles.text, { color: pnlColor }]}>{formatRupee(profitOrLoss)}</Text>;
      case 'pnlPercent':
        return <Text style={[styles.text, { color: pnlColor }]}>{formatPercent(pnlPercent)}</Text>;
      case 'currentPrice':
        return <Text style={[styles.text]}>{currentPrice ? `₹${currentPrice.toFixed(2)}` : '₹-'}</Text>;
      default:
        return <Text style={styles.text}>-</Text>;
    }
  }
);

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
  },
});

export default HoldingDynamicText;
