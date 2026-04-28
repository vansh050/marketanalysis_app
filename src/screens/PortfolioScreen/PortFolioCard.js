import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle} from 'react-native-svg';
import {useConfig} from '../../context/ConfigContext';

const PortfolioCard = ({
  allHoldingsData,
  formatCurrency,
  profitAndLoss,
  pnlPercentage,
}) => {
  // Get dynamic colors from config
  const config = useConfig();
  const gradient1 = config?.gradient1 || 'rgba(0, 38, 81, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 86, 183, 1)';

  const invested = Number(allHoldingsData?.totalinvvalue) || 0;
  const pnl = Number(profitAndLoss) || 0;
  const returns = Number(pnlPercentage) || 0;

  const formatPnL = value => {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return '₹0';
    }
    const absValue = Math.abs(numValue);
    const formattedValue = formatCurrency(absValue);
    return numValue < 0 ? `-₹${formattedValue}` : `₹${formattedValue}`;
  };

  const isPositive = returns >= 0;
  const arrow = isPositive ? '▲' : '▼';
  const arrowColor = isPositive ? '#23C36A' : '#FF6B6B';
  const percentColor = isPositive ? '#5EEA99' : '#FF6B6B';

  return (
    <View style={portfolioCardStyles.pcWrapper}>
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={portfolioCardStyles.pcGradientCard}>
        {/* Background Circle */}
        <Svg
          width="180"
          height="133"
          viewBox="0 0 130 180"
          style={portfolioCardStyles.circleSvg}>
          <Circle cx="80" cy="96" r="96" fill="white" fillOpacity="0.1" />
          <Circle cx="130" cy="120" r="96" fill="white" fillOpacity="0.08" />
        </Svg>

        {/* Current Balance Label */}
        <Text style={portfolioCardStyles.pcLabel}>Current P&amp;L</Text>

        {/* ✅ Value with proper negative sign placement and NaN handling */}
        <Text style={portfolioCardStyles.pcAmount}>{formatPnL(pnl)}</Text>

        {/* Invested */}
        <Text style={portfolioCardStyles.pcSubLabel}>
          Invested&nbsp;{' '}
          <Text style={portfolioCardStyles.pcSubAmount}>
            ₹ {formatCurrency(invested)}
          </Text>
        </Text>

        {/* Right P&L pill, returns percent */}
        <View style={portfolioCardStyles.pcRightBox}>
          <View style={portfolioCardStyles.pcPLHolder}>
            <Text style={portfolioCardStyles.pcPLText}>P &amp; L</Text>
          </View>
          <View style={{marginTop: 4}}>
            <Text style={portfolioCardStyles.pcReturnsLabel}>
              Total Returns
            </Text>
            {/* ✅ Dynamic arrow and color with NaN handling */}
            <Text
              style={[
                portfolioCardStyles.pcReturnsPercent,
                {color: percentColor},
              ]}>
              <Text
                style={[portfolioCardStyles.pcUpArrow, {color: arrowColor}]}>
                {arrow}
              </Text>
              &nbsp;
              {Math.abs(returns).toFixed(2)}%
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const portfolioCardStyles = StyleSheet.create({
  pcWrapper: {
    marginTop: 17,
    marginHorizontal: 10,
  },
  pcGradientCard: {
    width: '97%',
    marginHorizontal: '1.5%',
    borderRadius: 15,
    overflow: 'hidden',
    minHeight: 120,
    elevation: 5,
    padding: 20,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  circleSvg: {
    position: 'absolute',
    right: -30,
    top: -10,
  },
  pcLabel: {
    position: 'absolute',
    top: 18,
    left: 22,
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Satoshi-Regular',
    opacity: 0.82,
    letterSpacing: 0.1,
  },
  pcAmount: {
    position: 'absolute',
    top: 40,
    left: 22,
    color: '#fff',
    fontSize: 32,
    fontFamily: 'Satoshi-Bold',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pcSubLabel: {
    position: 'absolute',
    top: 88,
    left: 22,
    color: '#fff',
    opacity: 0.81,
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    letterSpacing: 0.2,
  },
  pcSubAmount: {
    fontFamily: 'Satoshi-Regular',
    color: '#fff',
    opacity: 0.94,
    fontSize: 12,
    marginLeft: 2,
  },
  pcRightBox: {
    position: 'absolute',
    top: 18,
    right: 18,
    minWidth: 120,
    alignItems: 'flex-end',
  },
  pcPLHolder: {
    backgroundColor: '#ffffff44',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 0,
    marginBottom: 8,
  },
  pcPLText: {
    color: '#fff',
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    marginTop: 5,
  },
  pcReturnsLabel: {
    color: '#fff',
    fontFamily: 'Satoshi-Regular',
    fontSize: 12,
    opacity: 0.8,
    textAlign: 'right',
    marginBottom: 3,
    letterSpacing: 0.1,
  },
  pcReturnsPercent: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 12,
    letterSpacing: 0.12,
    textAlign: 'right',
  },
  pcUpArrow: {
    fontSize: 9,
    fontFamily: 'Satoshi-Medium',
  },
});

export default PortfolioCard;
