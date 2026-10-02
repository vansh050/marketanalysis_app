import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle} from 'react-native-svg';
import {useConfig} from '../../context/ConfigContext';
import useTokens from '../../theme/useTokens';

import { designColor, designFont } from '../../design/literalTokens';

const PortfolioCard = ({
  allHoldingsData,
  formatCurrency,
  profitAndLoss,
  pnlPercentage,
  broker,
  isPositions,
  availableCash,
}) => {
  const config = useConfig();
  const tokens = useTokens();
  const gradient1 = tokens.colors.brand.gradientStart;
  const gradient2 = tokens.colors.brand.gradientEnd;

  const invested = Number(allHoldingsData?.totalinvvalue) || 0;
  const pnl = Number(profitAndLoss) || 0;
  const returns = Number(pnlPercentage) || 0;
  const hasAvailableCash = Number.isFinite(Number(availableCash));

  // Broker APIs can return IEEE floating-point artefacts such as
  // 16575.190000000002. Keep the raw numbers for calculations, but never
  // expose those implementation details in the customer-facing summary.
  const formatDisplayedMoney = (value, fractionDigits = 2) =>
    formatCurrency(Number((Number(value) || 0).toFixed(fractionDigits)));

  const formatDisplayedRupees = value =>
    formatCurrency(Math.round(Number(value) || 0));

  const getHoldingSource = brokerName => {
    const source = typeof brokerName === 'string' ? brokerName.trim() : '';
    if (!source) {
      return 'No broker account is connected';
    }
    if (/dummy|demo|paper/i.test(source)) {
      return 'Simulated portfolio — not a broker account';
    }
    return `${source} broker account`;
  };

  const holdingSource = getHoldingSource(broker);
  const hasSummaryValues =
    allHoldingsData &&
    ['totalinvvalue', 'totalprofitandloss', 'totalpnlpercentage'].some(key =>
      Object.prototype.hasOwnProperty.call(allHoldingsData, key),
    );
  const summaryTitle = isPositions
    ? 'Broker Positions P&L'
    : 'Broker Holdings P&L';

  const formatPnL = value => {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return '₹0';
    }
    const absValue = Math.abs(numValue);
    const formattedValue = formatDisplayedMoney(absValue);
    return numValue < 0 ? `-₹${formattedValue}` : `₹${formattedValue}`;
  };

  const isPositive = returns >= 0;
  const arrow = isPositive ? '▲' : '▼';
  const arrowColor = isPositive ? designColor('23c36a') : designColor('ff6b6b');
  const percentColor = isPositive ? designColor('5eea99') : designColor('ff6b6b');

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

        {/* This card measures LIVE BROKER HOLDINGS (allHoldingsData from the
            connected broker) — NOT the model-portfolio records below it. An
            unlabeled ₹0 here right above a summary card showing real value
            read as contradictory data (2026-07-18 report), so: label the
            source, and when there are no broker holdings say why instead of
            bare zeros. */}
        <Text style={portfolioCardStyles.pcLabel}>{summaryTitle}</Text>

        {invested === 0 && pnl === 0 ? (
          <>
            <Text style={portfolioCardStyles.pcAmount}>—</Text>
            <Text style={portfolioCardStyles.pcSubLabel}>
              Source: {holdingSource}{'\n'}
              Available cash:{' '}
              <Text style={portfolioCardStyles.pcSubAmount}>
                {hasAvailableCash
                  ? `₹ ${formatDisplayedMoney(availableCash)}`
                  : 'Unavailable'}
              </Text>
            </Text>
          </>
        ) : (
          <>
            {/* ✅ Value with proper negative sign placement and NaN handling */}
            <Text style={portfolioCardStyles.pcAmount}>{formatPnL(pnl)}</Text>

            {/* Invested */}
            <Text style={portfolioCardStyles.pcSubLabel}>
              Source: {holdingSource}{'\n'}
              {isPositions ? 'Capital basis' : 'Invested'}&nbsp;{' '}
              <Text style={portfolioCardStyles.pcSubAmount}>
                ₹ {formatDisplayedRupees(invested)}
              </Text>
              {'\n'}Available cash:{' '}
              <Text style={portfolioCardStyles.pcSubAmount}>
                {hasAvailableCash
                  ? `₹ ${formatDisplayedMoney(availableCash)}`
                  : 'Unavailable'}
              </Text>
            </Text>
          </>
        )}

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
            {hasSummaryValues ? (
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
            ) : (
              <Text style={portfolioCardStyles.pcReturnsPercent}>—</Text>
            )}
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
    minHeight: 138,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
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
    color: designColor('fff'),
    fontSize: 15,
    fontFamily: designFont('Satoshi-Regular'),
    opacity: 0.82,
    letterSpacing: 0.1,
  },
  pcAmount: {
    position: 'absolute',
    top: 40,
    left: 22,
    color: designColor('fff'),
    fontSize: 32,
    fontFamily: designFont('Satoshi-Bold'),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pcSubLabel: {
    position: 'absolute',
    top: 88,
    left: 22,
    color: designColor('fff'),
    opacity: 0.81,
    fontSize: 12,
    fontFamily: designFont('Satoshi-Regular'),
    letterSpacing: 0.2,
    width: '55%',
    lineHeight: 16,
  },
  pcSubAmount: {
    fontFamily: designFont('Satoshi-Regular'),
    color: designColor('fff'),
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
    backgroundColor: designColor('ffffff44'),
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 0,
    marginBottom: 8,
  },
  pcPLText: {
    color: designColor('fff'),
    fontFamily: designFont('Poppins-Medium'),
    fontSize: 13,
    marginTop: 5,
  },
  pcReturnsLabel: {
    color: designColor('fff'),
    fontFamily: designFont('Satoshi-Regular'),
    fontSize: 12,
    opacity: 0.8,
    textAlign: 'right',
    marginBottom: 3,
    letterSpacing: 0.1,
  },
  pcReturnsPercent: {
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 12,
    letterSpacing: 0.12,
    textAlign: 'right',
  },
  pcUpArrow: {
    fontSize: 9,
    fontFamily: designFont('Satoshi-Medium'),
  },
});

export default PortfolioCard;
