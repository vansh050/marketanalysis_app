/**
 * BasketCard — design-system composite presentation (Phase G batch 4, 2026-05-02)
 *
 * Pure presentation for the gradient basket card rendered in FlatList rows.
 * Container owns useTrade (userDetails, broker, fetchBrokerOrderBook, configData),
 * reconcileBasket() async flow, isClosureTrade(), cancelOrder(), dynamic require
 * for ReconciliationService, modal callbacks.
 *
 * Contract:
 *   viewModel = {
 *     basketName, basketId, date,
 *     isEdited, isClosureBasket, isExpired, isRegularBasket,
 *     gradientColors,
 *     trades, firstThreeTrades, remainingCount,
 *     showMore, expandedTrades,
 *     isCheckingReconciliation,
 *     showWarningModal, reconciliationResult,
 *   }
 *   actions = {
 *     onToggleShowMore, onToggleTradeExpansion,
 *     onTradeNowBasket, onCancelBasket,
 *     onWarningModalConfirm, onWarningModalCancelAll, onWarningModalClose,
 *   }
 *   slots = {
 *     BasketRunningProfitSlot,  // pre-built <BasketRunningProfit>
 *     PendingOrderWarningSlot,  // pre-built <PendingOrderWarningModal>
 *   }
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import moment from 'moment';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Target,
  Edit3,
  AlertCircle,
  XCircle,
} from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';

// Default-variant faded logo now resolved via `useTokens().assets.logoFadedPng`
// — see Phase 2 (whitelabel-sync, 2026-05-09) and
// docs/DESIGN_SYSTEM_ARCHITECTURE.md § Variant assets.

// Badge component
const StatusBadge = ({ type }) => {
  const badgeConfig = {
    edited: { bg: 'rgba(255, 193, 7, 0.9)', text: 'Edited', icon: Edit3 },
    expired: { bg: 'rgba(220, 53, 69, 0.9)', text: 'Expired', icon: AlertCircle },
    closure: { bg: 'rgba(108, 117, 125, 0.9)', text: 'Close Position', icon: XCircle },
  };
  const config = badgeConfig[type];
  if (!config) return null;
  const IconComponent = config.icon;

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <IconComponent size={10} color="#fff" />
      <Text style={styles.badgeText}>{config.text}</Text>
    </View>
  );
};

// Trade item component
const TradeItem = ({ item, index, isInGrid, isExpanded, onToggle }) => {
  if (!item) return null;

  const isLimitOrder = item?.OrderType === 'LIMIT';
  const stopLossValue = item?.stopLoss || item?.SL || item?.sl;
  const targetValue = item?.Target || item?.profitTarget || item?.PT;
  const limitPrice = item?.Price || item?.LimitPrice;
  const hasStopLoss = stopLossValue != null && stopLossValue !== '';
  const hasTarget = targetValue != null && targetValue !== '';
  const hasExpandableContent = isLimitOrder || hasStopLoss || hasTarget;

  const symbolParts = [
    item?.searchSymbol || '',
    item?.Strike ? String(item.Strike) : '',
    item?.OptionType || ''
  ].filter(part => part).join(' ');

  return (
    <View style={isInGrid ? styles.tradeItemGrid : styles.tradeItemList}>
      <TouchableOpacity
        onPress={() => hasExpandableContent && onToggle(index)}
        activeOpacity={hasExpandableContent ? 0.7 : 1}
        disabled={!hasExpandableContent}
        style={styles.tradeButton}
      >
        <View style={styles.tradeHeader}>
          <View style={styles.tradeMainInfo}>
            <Text style={styles.tradeText} numberOfLines={isExpanded ? undefined : 1}>
              {symbolParts || 'N/A'}
            </Text>
            {isLimitOrder && (
              <View style={styles.orderTypeBadge}>
                <Text style={styles.orderTypeText}>LIMIT</Text>
              </View>
            )}
          </View>
          {hasExpandableContent && (
            <ChevronDown
              size={12}
              color={'#fff'}
              style={{
                transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                marginLeft: 4,
              }}
            />
          )}
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {isLimitOrder && limitPrice != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Limit Price</Text>
                <Text style={styles.detailValue}>₹{String(limitPrice)}</Text>
              </View>
            )}

            {hasStopLoss && (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWithIcon}>
                  <TrendingDown size={10} color={'#ff6b6b'} />
                  <Text style={[styles.detailLabel, {color: '#ff6b6b'}]}>Stop Loss</Text>
                </View>
                <Text style={[styles.detailValue, {color: '#ff6b6b'}]}>
                  ₹{String(stopLossValue)}
                </Text>
              </View>
            )}

            {hasTarget && (
              <View style={styles.detailRow}>
                <View style={styles.detailLabelWithIcon}>
                  <Target size={10} color={'#51cf66'} />
                  <Text style={[styles.detailLabel, {color: '#51cf66'}]}>Target</Text>
                </View>
                <Text style={[styles.detailValue, {color: '#51cf66'}]}>
                  ₹{String(targetValue)}
                </Text>
              </View>
            )}

            {item?.Quantity != null && item.Quantity > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quantity</Text>
                <Text style={styles.detailValue}>{String(item.Quantity)} lot(s)</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const BasketCard = ({ viewModel, actions, slots }) => {
  const tokens = useTokens();
  const {
    basketName = 'Basket',
    date = new Date(),
    isEdited = false,
    isClosureBasket = false,
    isExpired = false,
    isRegularBasket = true,
    gradientColors = ['#000C18', '#002C59', '#000C18'],
    trades = [],
    firstThreeTrades = [],
    remainingCount = 0,
    showMore = false,
    expandedTrades = {},
    isCheckingReconciliation = false,
    basket,
  } = viewModel || {};

  const {
    onToggleShowMore = () => {},
    onToggleTradeExpansion = () => {},
    onTradeNowBasket = () => {},
    onCancelBasket,
  } = actions || {};

  const {
    BasketRunningProfitSlot = null,
    PendingOrderWarningSlot = null,
  } = slots || {};

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        isRegularBasket && {
          borderWidth: 1,
          borderColor: 'rgba(30, 159, 64, 0.3)',
        },
      ]}
    >
      <View style={styles.contentContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <Text style={styles.basketTitle}>{basketName}</Text>
              {isExpired && <StatusBadge type="expired" />}
              {isEdited && !isExpired && <StatusBadge type="edited" />}
              {isClosureBasket && !isExpired && <StatusBadge type="closure" />}
            </View>
          </View>
          {BasketRunningProfitSlot}
        </View>

        <View style={styles.logoContainer} pointerEvents="none">
          <Image
            source={tokens.assets.logoFadedPng}
            style={[styles.logo, { tintColor: '#FFFFFF' }]}
            resizeMode="contain"
          />
        </View>

        {/* Custom two-column stock names */}
        <View style={styles.stocksContainer}>
          {!showMore ? (
            <View style={styles.gridContainer}>
              {/* First Row */}
              <View style={styles.stockRow}>
                {firstThreeTrades[0] && (
                  <TradeItem item={firstThreeTrades[0]} index={0} isInGrid={true} isExpanded={expandedTrades[0]} onToggle={onToggleTradeExpansion} />
                )}
                {firstThreeTrades[1] && (
                  <TradeItem item={firstThreeTrades[1]} index={1} isInGrid={true} isExpanded={expandedTrades[1]} onToggle={onToggleTradeExpansion} />
                )}
              </View>

              {/* Second Row */}
              <View style={styles.stockRow}>
                {firstThreeTrades[2] && (
                  <TradeItem item={firstThreeTrades[2]} index={2} isInGrid={true} isExpanded={expandedTrades[2]} onToggle={onToggleTradeExpansion} />
                )}
                {remainingCount > 0 && (
                  <View style={styles.tradeItemGrid}>
                    <Text style={[styles.tradeText, styles.boldText]}>
                      {String(remainingCount)}+ stocks
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <FlatList
              data={firstThreeTrades}
              renderItem={({item, index}) => (
                <TradeItem item={item} index={index} isInGrid={false} isExpanded={expandedTrades[index]} onToggle={onToggleTradeExpansion} />
              )}
              keyExtractor={(item, index) => index.toString()}
              scrollEnabled={false}
            />
          )}
        </View>

        {trades.length > 3 && (
          <TouchableOpacity
            onPress={onToggleShowMore}
            style={styles.showMoreButton}
          >
            <View style={styles.showMoreContent}>
              {showMore ? (
                <>
                  <ChevronUp size={12} color={'#fff'} />
                  <Text style={styles.clickAcceptText}>Show Less</Text>
                </>
              ) : (
                <>
                  <Text style={styles.clickAcceptText}>*Click to see all</Text>
                  <ChevronDown size={12} color={'#fff'} />
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }} />

          <View style={styles.dateRow}>
            <CalendarDays size={12} color="#fff" />
            <Text style={styles.dateText}>
              {moment(date).format('Do MMM, YYYY')} | {moment(date).format('h:mm A')}
            </Text>
          </View>
        </View>

        <View style={{flexDirection: 'row', gap: 8}}>
          {onCancelBasket && !isExpired && !basket?.cancel && !basket?.closurestatus && (
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => onCancelBasket(basket?.basketId)}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.acceptButton,
              {flex: 1},
              (isExpired || isCheckingReconciliation) && styles.acceptButtonDisabled,
            ]}
            onPress={onTradeNowBasket}
            disabled={isExpired || isCheckingReconciliation}
          >
            {isCheckingReconciliation ? (
              <>
                <ActivityIndicator size="small" color="rgba(41, 164, 0, 1)" style={{marginRight: 8}} />
                <Text style={styles.acceptButtonText}>Checking orders...</Text>
              </>
            ) : (
              <>
                <Text style={[
                  styles.acceptButtonText,
                  isExpired && styles.acceptButtonTextDisabled,
                ]}>
                  {isExpired ? 'Basket Expired' : (isClosureBasket ? 'Close Positions' : 'Accept Basket')}
                </Text>
                {!isExpired && <ArrowRight size={12} color={isClosureBasket ? 'rgba(139, 0, 0, 1)' : 'rgba(41, 164, 0, 1)'} />}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Pending Order Warning Modal */}
        {PendingOrderWarningSlot}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 6,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  contentContainer: {
    zIndex: 10,
  },
  basketTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  stocksContainer: {
    marginBottom: 12,
  },
  gridContainer: {
    gap: 8,
  },
  stockRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tradeItemGrid: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  tradeItemList: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  tradeButton: {
    flex: 1,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tradeMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    marginRight: 4,
  },
  tradeText: {
    fontSize: 11,
    fontFamily: 'Poppins-Small',
    color: '#fff',
  },
  orderTypeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  orderTypeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  expandedContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontWeight: '600',
  },
  detailValue: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  boldText: {
    fontWeight: '700',
    fontSize: 12,
  },
  showMoreButton: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
  showMoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clickAcceptText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 9,
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: '#D97706',
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#D97706',
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    paddingTop: 2,
  },
  acceptButton: {
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#fff',
    borderRadius: 4,
    paddingVertical: 7,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
  },
  acceptButtonText: {
    color: 'rgba(41, 164, 0, 1)',
    fontFamily: 'Poppins-Medium',
    paddingTop: 2,
    fontSize: 12,
    marginRight: 6,
  },
  acceptButtonDisabled: {
    backgroundColor: 'rgba(200, 200, 200, 0.8)',
    borderColor: 'rgba(150, 150, 150, 0.5)',
  },
  acceptButtonTextDisabled: {
    color: '#666',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  logoContainer: {
    position: 'absolute',
    top: '40%',
    left: '60%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    zIndex: 0,
    opacity: 1,
  },
  logo: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
  },
});

export default BasketCard;
