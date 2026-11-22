import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, {Circle} from 'react-native-svg';
import useTokens from '../../theme/useTokens';

import { designColor, designFont } from '../../design/literalTokens';

/**
 * Broker portfolio summary at the top of the Holdings / Positions list.
 *
 * Reads LIVE BROKER HOLDINGS (allHoldingsData from the connected broker) —
 * NOT the model-portfolio records. An unlabeled ₹0 above a model summary read
 * as contradictory data (2026-07-18 report), so the card always names its
 * source, and with no broker holdings says so instead of showing bare zeros.
 *
 * Layout (2026-11-22): one flowing column — label + source, the headline
 * figure, then Invested / P&L / Cash side by side. Earlier versions placed
 * every line with absolute offsets inside a 138px card, which clipped the
 * cash line and overlapped with larger phone font sizes.
 */
const PortfolioCard = ({
  allHoldingsData,
  formatCurrency,
  profitAndLoss,
  pnlPercentage,
  broker,
  isPositions,
  availableCash,
}) => {
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
  const summaryTitle = isPositions ? 'Broker Positions P&L' : 'Broker Holdings value';

  const signedMoney = value => {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return '₹0';
    }
    const formattedValue = formatDisplayedMoney(Math.abs(numValue));
    if (numValue > 0) {
      return `+₹${formattedValue}`;
    }
    return numValue < 0 ? `-₹${formattedValue}` : `₹${formattedValue}`;
  };

  const isEmpty = invested === 0 && pnl === 0;
  // Holdings lead with what the holdings are worth now; positions have no
  // meaningful "value", so they lead with their P&L.
  const headline = isEmpty
    ? '—'
    : isPositions
      ? signedMoney(pnl)
      : `₹${formatDisplayedMoney(invested + pnl)}`;

  const isPositive = returns >= 0;
  const pnlColor = pnl === 0
    ? designColor('fff')
    : pnl > 0
      ? designColor('5eea99')
      : designColor('ffb3b3');
  const returnsText = hasSummaryValues
    ? `${isPositive ? '▲' : '▼'} ${Math.abs(returns).toFixed(2)}%`
    : '—';
  const cashText = hasAvailableCash
    ? `₹ ${formatDisplayedMoney(availableCash)}`
    : 'Unavailable';

  return (
    <View style={portfolioCardStyles.pcWrapper}>
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={portfolioCardStyles.pcGradientCard}>
        <Svg
          width="180"
          height="133"
          viewBox="0 0 130 180"
          style={portfolioCardStyles.circleSvg}>
          <Circle cx="80" cy="96" r="96" fill="white" fillOpacity="0.1" />
          <Circle cx="130" cy="120" r="96" fill="white" fillOpacity="0.08" />
        </Svg>

        <Text style={portfolioCardStyles.pcLabel} maxFontSizeMultiplier={1.3}>
          {summaryTitle}
        </Text>
        <Text style={portfolioCardStyles.pcSource} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {holdingSource}
        </Text>

        <View style={portfolioCardStyles.pcHeadlineRow}>
          <Text
            style={portfolioCardStyles.pcAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.2}>
            {headline}
          </Text>
          {!isEmpty && !isPositions ? (
            <Text style={[portfolioCardStyles.pcReturns, {color: pnlColor}]} maxFontSizeMultiplier={1.3}>
              {returnsText}
            </Text>
          ) : null}
        </View>

        <View style={portfolioCardStyles.pcStats}>
          {isEmpty ? null : (
            <>
              <View style={portfolioCardStyles.pcStat}>
                <Text style={portfolioCardStyles.pcStatLabel} maxFontSizeMultiplier={1.3}>
                  {isPositions ? 'Capital basis' : 'Invested'}
                </Text>
                <Text style={portfolioCardStyles.pcStatValue} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
                  ₹ {formatDisplayedRupees(invested)}
                </Text>
              </View>
              {isPositions ? null : (
                <View style={portfolioCardStyles.pcStat}>
                  <Text style={portfolioCardStyles.pcStatLabel} maxFontSizeMultiplier={1.3}>
                    Total P&amp;L
                  </Text>
                  <Text
                    style={[portfolioCardStyles.pcStatValue, {color: pnlColor}]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    maxFontSizeMultiplier={1.3}>
                    {signedMoney(pnl)}
                  </Text>
                </View>
              )}
            </>
          )}
          <View style={portfolioCardStyles.pcStat}>
            <Text style={portfolioCardStyles.pcStatLabel} maxFontSizeMultiplier={1.3}>
              Available cash
            </Text>
            <Text style={portfolioCardStyles.pcStatValue} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
              {cashText}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const portfolioCardStyles = StyleSheet.create({
  pcWrapper: {
    marginTop: 14,
    marginHorizontal: 12,
    marginBottom: 6,
  },
  pcGradientCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: designColor('000'),
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 5,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  circleSvg: {
    position: 'absolute',
    right: -30,
    top: -10,
  },
  pcLabel: {
    color: designColor('fff'),
    fontSize: 13,
    fontFamily: designFont('Satoshi-Medium'),
    opacity: 0.9,
  },
  pcSource: {
    color: designColor('fff'),
    fontSize: 11,
    fontFamily: designFont('Satoshi-Regular'),
    opacity: 0.7,
    marginTop: 1,
  },
  pcHeadlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  pcAmount: {
    color: designColor('fff'),
    fontSize: 28,
    lineHeight: 34,
    fontFamily: designFont('Satoshi-Bold'),
    fontWeight: '700',
    marginRight: 10,
    flexShrink: 1,
  },
  pcReturns: {
    fontSize: 14,
    fontFamily: designFont('Satoshi-Bold'),
  },
  pcStats: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: designColor('ffffff55'),
  },
  pcStat: {
    flex: 1,
    paddingRight: 8,
  },
  pcStatLabel: {
    color: designColor('fff'),
    opacity: 0.75,
    fontSize: 11,
    fontFamily: designFont('Satoshi-Regular'),
    marginBottom: 2,
  },
  pcStatValue: {
    color: designColor('fff'),
    fontSize: 14,
    fontFamily: designFont('Satoshi-Bold'),
  },
});

export default PortfolioCard;
