import React, {useState, useEffect, useCallback} from 'react';
import {Text, StyleSheet} from 'react-native';
import WebSocketManager from './WebSocketManager';

const PortfolioPositionText = React.memo(
  ({
    symbol,
    advisedRangeCondition,
    advisedPrice,
    exchange,
    type,
    data,
    isClosed,
  }) => {
    const [price, setLtp] = useState(null);

const updatePrice = useCallback((symbol, newPrice) => {
  const actualPrice = newPrice?.ltp ?? newPrice;
  
  // Add validation
  if (typeof actualPrice === 'number' && !isNaN(actualPrice)) {
    setLtp(actualPrice);
  }
}, []);

    const buyQuantity = parseFloat(data?.buyQuantity || 0);
    const sellQuantity = parseFloat(data?.sellQuantity || 0);
    const netQuantity = parseFloat(data?.netQuantity || 0);
    const buyPrice = parseFloat(data?.buyAvgPrice ?? 0);
    const sellPrice = parseFloat(data?.sellAvgPrice ?? 0);

    useEffect(() => {
      const wsInstance = WebSocketManager.getInstance();
      const portfolioItem = [
        {
          Symbol: symbol,
          Exchange: exchange || 'NSE',
        },
      ];

      portfolioItem.forEach(item => {
        const symbolToUse = item.Symbol;
        const exchangeToUse = item.Exchange;

        wsInstance.subscribe(symbolToUse, exchangeToUse, newPrice =>
          updatePrice(symbolToUse, newPrice),
        );
        wsInstance
          .getLTP(symbolToUse)
          .then(priceData => updatePrice(symbolToUse, priceData))
          .catch(error => {
            console.log('LTP error for', symbolToUse, ':', error);
          });
      });

      // Cleanup - same pattern as BasketCard
      return () => {
        portfolioItem.forEach(item => {
          const symbolToUse = item.Symbol;
          wsInstance.unsubscribe?.(symbolToUse, updatePrice);
        });
      };
    }, [symbol, exchange, updatePrice]);

    const isPositionClosed = buyQuantity === sellQuantity || isClosed;
    const isShortPosition =
      netQuantity < 0 || (sellQuantity > 0 && buyQuantity === 0);

    let profitOrLoss = 0;
    let pnlPercent = 0;

    const currentPrice = parseFloat(price ?? 0);

    if (isShortPosition) {
      if (isPositionClosed && buyQuantity > 0) {
        // Closed short position: sold first, then bought back
        profitOrLoss = (sellPrice - buyPrice) * Math.abs(sellQuantity);
        pnlPercent =
          sellPrice > 0 ? ((sellPrice - buyPrice) / sellPrice) * 100 : 0;
      } else {
        // Open short position: only sold, not bought back yet
        profitOrLoss = currentPrice
          ? (sellPrice - currentPrice) * Math.abs(sellQuantity)
          : 0;
        pnlPercent =
          sellPrice > 0 && currentPrice
            ? ((sellPrice - currentPrice) / sellPrice) * 100
            : 0;
      }
    } else {
      // Long position logic (existing)
      if (isPositionClosed) {
        profitOrLoss = (sellPrice - buyPrice) * buyQuantity;
        pnlPercent =
          buyPrice > 0 ? ((sellPrice - buyPrice) / buyPrice) * 100 : 0;
      } else {
        profitOrLoss = currentPrice
          ? (currentPrice - buyPrice) * buyQuantity
          : 0;
        pnlPercent =
          buyPrice > 0 && currentPrice
            ? ((currentPrice - buyPrice) / buyPrice) * 100
            : 0;
      }
    }

    const pnlColor =
      profitOrLoss > 0 ? '#338D72' : profitOrLoss < 0 ? '#EF344A' : '#A0A0A0';

    const formatWithSign = value => {
      if (value > 0) return `+₹${value.toFixed(2)}`;
      if (value < 0) return `-₹${Math.abs(value).toFixed(2)}`;
      return '₹0.00';
    };

    const formatWithSignpnl = value => {
      if (value > 0) return `+${value.toFixed(2)}`;
      if (value < 0) return `-${Math.abs(value).toFixed(2)}`;
      return '0.00';
    };

    if (type === 'positionpnlPercent') {
      return (
        <Text
          style={{color: pnlColor, fontSize: 14, fontFamily: 'Satoshi-Medium'}}>
          {/* Fixed condition for short positions */}
          {isPositionClosed || buyQuantity > 0 || isShortPosition
            ? `${formatWithSignpnl(pnlPercent)}%`
            : '0.00%'}
        </Text>
      );
    } else if (type === 'positionpnlRupee') {
      return (
        <Text
          style={{color: pnlColor, fontSize: 14, fontFamily: 'Satoshi-Medium'}}>
          {/* Fixed condition for short positions */}
          {isPositionClosed || buyQuantity > 0 || isShortPosition
            ? `${formatWithSign(profitOrLoss)}`
            : '-'}
        </Text>
      );
    } else if (type === 'arfsHoldingCalculationPnl') {
      return (
        <Text
          style={{color: pnlColor, fontSize: 14, fontFamily: 'Satoshi-Medium'}}>
          {(price - data?.avgPrice) * data?.quantity > 0 ? (
            <Text style={styles.poschangeValue}>
              +
              {Math.abs(
                ((price - data?.avgPrice) / data?.avgPrice) * 100,
              ).toFixed(2)}
              %
            </Text>
          ) : (price - data?.avgPrice) * data?.quantity < 0 ? (
            <Text style={styles.negchangeValue}>
              -
              {Math.abs(
                ((price - data?.avgPrice) / data?.avgPrice) * 100,
              ).toFixed(2)}
              %
            </Text>
          ) : (
            <Text>-</Text>
          )}
        </Text>
      );
    } else if (type === 'arfsHoldingCalculationRupee') {
      return (
        <Text
          style={{color: pnlColor, fontSize: 14, fontFamily: 'Satoshi-Medium'}}>
          {(price - data?.avgPrice) * data?.quantity > 0 ? (
            <Text style={styles.poschangeValue}>
              + ₹
              {Math.abs((price - data?.avgPrice) * data?.quantity).toFixed(2)}
            </Text>
          ) : (price - data?.avgPrice) * data?.quantity < 0 ? (
            <Text style={styles.negchangeValue}>
              -₹
              {Math.abs((price - data?.avgPrice) * data?.quantity).toFixed(2)}
            </Text>
          ) : (
            <Text>-</Text>
          )}
        </Text>
      );
    } else {
      return (
        <Text
          style={{fontSize: 14, color: '#000', fontFamily: 'Satoshi-Medium'}}>
          {price ? `₹${price?.toFixed(2)}` : '₹-'}
        </Text>
      );
    }
  },
);

const styles = StyleSheet.create({
  price: {
    fontSize: 14,
    fontFamily: 'Satoshi-Bold',
    color: 'black',
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
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    color: 'black',
  },
  change: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
  },
  priceContainer: {
    flexDirection: 'row',
  },
  poschangeValue: {
    fontSize: 14,
    color: '#16A085',
    fontFamily: 'Satoshi-Medium',
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  negchangeValue: {
    fontSize: 14,
    color: '#E6626F',
    fontFamily: 'Satoshi-Medium',
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
});

export default PortfolioPositionText;