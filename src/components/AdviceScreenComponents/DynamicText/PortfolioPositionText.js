import React, {useState, useEffect, useCallback} from 'react';
import {Text, StyleSheet} from 'react-native';
import WebSocketManager from './WebSocketManager';
import {calculatePositionPnl} from '../../../utils/positionPnl';

import { designColor, designFont } from '../../../design/literalTokens';

const PortfolioPositionText = React.memo(
  ({
    symbol,
    advisedRangeCondition,
    advisedPrice,
    exchange,
    liveLtp,
    type,
    data,
  }) => {
    const [price, setLtp] = useState(null);

    const updatePrice = useCallback((symbol, newPrice) => {
      const actualPrice = newPrice?.ltp ?? newPrice;

      // Add validation
      if (typeof actualPrice === 'number' && !isNaN(actualPrice)) {
        setLtp(actualPrice);
      }
    }, []);

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

    const currentPrice =
      Number.isFinite(Number(liveLtp)) && Number(liveLtp) > 0
        ? Number(liveLtp)
        : parseFloat(price ?? 0);
    const positionPnl = calculatePositionPnl(data, currentPrice);
    const profitOrLoss = positionPnl?.pnl ?? null;
    const pnlPercent = positionPnl?.pnlPercentage ?? null;

    const pnlColor =
      profitOrLoss > 0
        ? designColor('338d72')
        : profitOrLoss < 0
          ? designColor('ef344a')
          : designColor('a0a0a0');

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
          style={{color: pnlColor, fontSize: 14, fontFamily: designFont('Satoshi-Medium')}}>
          {pnlPercent === null ? '—' : `${formatWithSignpnl(pnlPercent)}%`}
        </Text>
      );
    } else if (type === 'positionpnlRupee') {
      return (
        <Text
          style={{color: pnlColor, fontSize: 14, fontFamily: designFont('Satoshi-Medium')}}>
          {profitOrLoss === null ? '—' : formatWithSign(profitOrLoss)}
        </Text>
      );
    } else if (type === 'arfsHoldingCalculationPnl') {
      return (
        <Text
          style={{color: pnlColor, fontSize: 14, fontFamily: designFont('Satoshi-Medium')}}>
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
          style={{color: pnlColor, fontSize: 14, fontFamily: designFont('Satoshi-Medium')}}>
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
          style={{fontSize: 14, color: designColor('000'), fontFamily: designFont('Satoshi-Medium')}}>
          {price ? `₹${price?.toFixed(2)}` : '₹-'}
        </Text>
      );
    }
  },
);

const styles = StyleSheet.create({
  price: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Bold'),
    color: 'black',
  },
  newsscreen: {
    color: designColor('626262'),
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 18,
  },
  watchlist: {
    color: designColor('000'),
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 14,
  },
  portfolio: {
    fontSize: 14,
    color: designColor('a0a0a0'),
    fontFamily: designFont('Satoshi-Medium'),
  },
  Aftersub: {
    fontSize: 12,
    fontFamily: designFont('Satoshi-Medium'),
    color: 'black',
  },
  change: {
    fontSize: 12,
    fontFamily: designFont('Satoshi-Bold'),
  },
  priceContainer: {
    flexDirection: 'row',
  },
  poschangeValue: {
    fontSize: 14,
    color: designColor('16a085'),
    fontFamily: designFont('Satoshi-Medium'),
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  negchangeValue: {
    fontSize: 14,
    color: designColor('e6626f'),
    fontFamily: designFont('Satoshi-Medium'),
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
});

export default PortfolioPositionText;
