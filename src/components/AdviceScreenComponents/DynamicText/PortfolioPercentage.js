import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import WebSocketManager from './WebSocketManager';
import formatCurrency from '../../../utils/formatCurrency';

const PortfolioPercentage = React.memo(
  ({ type, totalInvested, net_portfolio_updated }) => {
    const [prices, setPrices] = useState({});
    const wsManagerRef = useRef(WebSocketManager.getInstance());

    // ----------------------------
    // 🔥 Always store LTP as Number
    // ----------------------------
    const handlePriceUpdate = useCallback((symbol, newLtp) => {
      const safeLtp = Number(newLtp) || 0;
      setPrices(prev => ({ ...prev, [symbol]: safeLtp }));
    }, []);

    // ----------------------------
    // 🔥 Subscribe to symbols safely
    // ----------------------------
    useEffect(() => {
      const portfolioSymbols =
        net_portfolio_updated?.order_results?.map(stock => ({
          symbol: stock.symbol,
          exchange: stock.exchange,
        })) || [];

      if (portfolioSymbols.length > 0) {
        wsManagerRef.current?.subscribeToAllSymbols(portfolioSymbols);

        portfolioSymbols.forEach(({ symbol, exchange }) => {
          wsManagerRef.current.subscribe(symbol, exchange, data => {
            let ltp = 0;

            try {
              // Your WebSocket now sends:
              // { symbol: "TATAINVEST", ltp: 776.8 }
              if (data?.ltp !== undefined) {
                ltp = Number(data.ltp) || 0;
              }
            } catch (err) {
              console.error('Error parsing LTP: ', err);
            }

            handlePriceUpdate(symbol, ltp);
          });
        });
      }

      return () => {
        portfolioSymbols.forEach(({ symbol }) => {
          wsManagerRef.current?.unsubscribe?.(symbol);
        });
      };
    }, [net_portfolio_updated, handlePriceUpdate]);

    // ----------------------------
    // 🔥 totalCurrent (safe — fallback to averagePrice when LTP not yet received)
    // ----------------------------
    let hasAllLTPs = true;
    const totalCurrent = (net_portfolio_updated?.order_results ?? []).reduce(
      (total, stock) => {
        const liveLtp = Number(prices[stock.symbol]);
        const avg = Number(stock.averagePrice) || 0;
        // Use live LTP if available, otherwise fall back to averagePrice
        const effectivePrice = (!isNaN(liveLtp) && liveLtp > 0) ? liveLtp : avg;
        if (isNaN(liveLtp) || liveLtp <= 0) hasAllLTPs = false;
        const qty = Number(stock.quantity) || 0;
        return total + effectivePrice * qty;
      },
      0
    );

    // ----------------------------
    // 🔥 % Difference (safe)
    // ----------------------------
    const percentageDifference =
      totalInvested > 0
        ? ((totalCurrent - totalInvested) / totalInvested) * 100
        : 0;

    // ----------------------------
    // 🔥 totalNetReturns safe
    // ----------------------------
    const totalNetReturns = (net_portfolio_updated?.order_results ?? []).reduce(
      (total, stock) => {
        const liveLtp = Number(prices[stock.symbol]);
        const avg = Number(stock.averagePrice) || 0;
        const effectivePrice = (!isNaN(liveLtp) && liveLtp > 0) ? liveLtp : avg;
        const qty = Number(stock.quantity) || 0;
        return total + (effectivePrice - avg) * qty;
      },
      0
    );

    const netReturnsPercentage =
      totalInvested > 0 ? (totalNetReturns / totalInvested) * 100 : 0;

    const backgroundColor = percentageDifference > 0 ? '#338D72' : '#EF344A';

    return (
      <View>
        {/* -------------------- 🔥 TOTAL CURRENT -------------------- */}
        {type === 'totalcurrent' && (
          <View>
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontFamily: 'Poppins-SemiBold',
                marginTop: 2,
              }}>
              {totalCurrent
                ? `₹${formatCurrency(Math.round(totalCurrent))}`
                : '-'}
            </Text>
            {!hasAllLTPs && totalCurrent > 0 && (
              <Text style={{color: 'rgba(255,255,255,0.6)', fontSize: 9, fontFamily: 'Poppins-Regular', marginTop: -2}}>
                Prices may be delayed
              </Text>
            )}
          </View>
        )}

        {/* -------------------- 🔥 NET RETURNS % -------------------- */}
        {type === 'totalnet' && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontFamily: 'Poppins-Medium' }}>
              {totalNetReturns === 0 ? (
                <Text style={styles.subNeutral}>{netReturnsPercentage.toFixed(2)}%</Text>
              ) : totalNetReturns >= 0 ? (
                <Text style={styles.subPositive}>+{netReturnsPercentage.toFixed(2)}%</Text>
              ) : (
                <Text style={styles.subNegative}>-{Math.abs(netReturnsPercentage.toFixed(2))}%</Text>
              )}
            </Text>
          </View>
        )}

        {/* -------------------- 🔥 NET RETURNS AMOUNT -------------------- */}
        {type === 'totalnetreturns' &&
          (totalNetReturns > 0 ? (
            <View style={styles.flexRow}>
              <Text style={styles.subPositive1}>₹{formatCurrency(Math.round(totalInvested))}</Text>
            </View>
          ) : totalNetReturns < 0 ? (
            <View style={styles.flexRow}>
              <Text style={styles.subNegative1}>₹{formatCurrency(Math.round(totalInvested))}</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.neutralText}>No Returns</Text>
            </View>
          ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  subNeutral: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontFamily: 'Satoshi-Medium',
    marginLeft: 4,
  },
  subPositive: {
    color: '#2ECC71',
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
  },
  subNegative: {
    color: '#E43D3D',
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
  },
  subPositive1: {
    color: '#16A085',
    fontSize: 16,
    fontFamily: 'Satoshi-Medium',
  },
  subNegative1: {
    color: '#E43D3D',
    fontSize: 16,
    fontFamily: 'Satoshi-Medium',
  },
  neutralText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Satoshi-Medium',
  },
  flexRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});

export default PortfolioPercentage;
