import React, { useState, useEffect, useCallback } from 'react';
import { Text, StyleSheet } from 'react-native';
import WebSocketManager from './WebSocketManager';
import formatCurrency from '../../../utils/formatCurrency';

import { designColor, designFont, designToken } from '../../../design/literalTokens';

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
      profitOrLoss > 0 ? designToken('holdingText.success') : profitOrLoss < 0 ? designToken('holdingText.danger') : designToken('holdingText.textMuted');

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

    // Indian grouping (1,23,456.70), always two decimals.
    const money = (value) => {
      const [whole, fraction] = Math.abs(value).toFixed(2).split('.');
      return `${formatCurrency(Number(whole))}.${fraction}`;
    };

    const formatRupee = (value) => {
      if (value > 0) return `+₹${money(value)}`;
      if (value < 0) return `-₹${money(value)}`;
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
      case 'currentValue':
        // What the holding is worth at the live price; falls back to the
        // invested amount until the first price arrives.
        return (
          <Text style={[styles.text, styles.value]}>
            {`₹${money(currentPrice ? currentPrice * qty : invested || 0)}`}
          </Text>
        );
      case 'pnlBoth':
        return (
          <Text style={[styles.text, styles.small, { color: pnlColor }]}>
            {currentPrice ? `${formatRupee(profitOrLoss)} (${formatPercent(pnlPercent)})` : '—'}
          </Text>
        );
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
    fontFamily: designFont('Satoshi-Medium'),
  },
  value: {
    fontSize: 15,
    fontFamily: designFont('Satoshi-Bold'),
    color: designToken('portfolio.text'),
  },
  small: {
    fontSize: 12,
  },
});

export default HoldingDynamicText;
