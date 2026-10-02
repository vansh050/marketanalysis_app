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

// Format a datetime in IST (UTC+5:30, no DST) — the advisor-facing clock.
// Backend stores UTC; raw moment() renders device-local, which for a non-IST
// viewer shows the wrong wall time. Product rule 2026-08-21: closed baskets
// stamp entry AND exit in IST.
const formatIST = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const hours = ist.getUTCHours();
  const displayHours = hours % 12 || 12;
  return `${ist.getUTCDate()} ${moment(value).format('MMM YYYY')}, ${displayHours}:${pad(ist.getUTCMinutes())} ${hours >= 12 ? 'PM' : 'AM'} IST`;
};
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
    closurePending: { bg: 'rgba(217, 119, 6, 0.95)', text: 'Closure Pending', icon: XCircle },
    positionOpen: { bg: 'rgba(37, 99, 235, 0.95)', text: 'Position Open', icon: Target },
    partialEntry: { bg: 'rgba(217, 119, 6, 0.95)', text: 'Position Incomplete', icon: AlertCircle },
    cancelled: { bg: 'rgba(220, 53, 69, 0.9)', text: 'Cancelled', icon: XCircle },
    closed: { bg: 'rgba(108, 117, 125, 0.9)', text: 'Closed', icon: XCircle },
    closedByManager: { bg: 'rgba(108, 117, 125, 0.9)', text: 'Closed by manager', icon: XCircle },
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
  const orderTypeLabel = isLimitOrder ? 'LIMIT' : (item?.OrderType || item?.orderType || 'MARKET');
  const stopLossValue = item?.stopLoss || item?.SL || item?.sl;
  const targetValue = item?.Target || item?.profitTarget || item?.PT;
  const limitPrice = item?.Price || item?.LimitPrice;
  const hasStopLoss = stopLossValue != null && stopLossValue !== '';
  const hasTarget = targetValue != null && targetValue !== '';
  // Expand whenever there is anything to show: order type, price, SL/Target,
  // or lot detail — entry AND exit legs alike.
  const hasExpandableContent =
    isLimitOrder ||
    hasStopLoss ||
    hasTarget ||
    item?.Price != null ||
    item?.exitPrice != null ||
    item?.tradedPrice != null;

  // FUT legs carry a junk Strike value ("Order") that must not render as a
  // strike; options show strike + type so a PE is distinguishable from the FUT.
  const isFuture = item?.OptionType === 'FUT';
  const strikeValue =
    isFuture || !item?.Strike || String(item.Strike).toLowerCase() === 'order'
      ? ''
      : String(item.Strike);
  const symbolParts = [
    item?.searchSymbol || '',
    strikeValue,
    item?.OptionType || ''
  ].filter(part => part).join(' ');

  const isBuy = String(item?.Type || '').toUpperCase() === 'BUY';
  // Exit rows show the actual exit price; entries show the fill/advised price.
  const rawDisplayPrice = isBuy
    ? item?.tradedPrice ?? item?.Price ?? item?.price
    : item?.exitPrice ?? item?.tradedPrice ?? item?.Price ?? item?.price;
  const displayPrice = Number(rawDisplayPrice) > 0 ? Number(rawDisplayPrice) : null;
  const currentLtp = Number(item?.currentLtp) > 0 ? Number(item.currentLtp) : null;
  // Quantity = number of lots (1/2/3); Lots = contract lot size (e.g. 625).
  const qtyValue = item?.tradedQty ?? item?.Quantity ?? item?.quantity;
  const lotSize = item?.Lots || item?.lotSize;

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
            <View style={styles.orderTypeBadge}>
              <Text style={styles.orderTypeText}>{orderTypeLabel}</Text>
            </View>
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

        {/* Always-visible lot + price line so a closed/exit leg still shows
            its lots and price without requiring the row to be expanded. */}
        {(
          <View style={styles.alwaysVisibleDetail}>
            <Text style={styles.alwaysVisibleText}>
              {qtyValue != null ? `${isBuy ? 'Lot' : 'Exit Lot'} ${qtyValue}` : ''}
              {lotSize ? ` · Lot size ${lotSize}` : ''}
              {displayPrice != null ? ` · ${isBuy ? 'Advice ₹' : 'Exit ₹'}${String(displayPrice)}` : ''}
              {` · ${currentLtp != null ? `LTP ₹${String(currentLtp)}` : 'LTP unavailable'}`}
            </Text>
          </View>
        )}

        {isExpanded && (
          <View style={styles.expandedContent}>
            {isLimitOrder && limitPrice != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Limit Price</Text>
                <Text style={styles.detailValue}>₹{String(limitPrice)}</Text>
              </View>
            )}

            {qtyValue != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Quantity</Text>
                <Text style={styles.detailValue}>{String(qtyValue)} lot(s)</Text>
              </View>
            )}

            {lotSize != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Lot Size</Text>
                <Text style={styles.detailValue}>{String(lotSize)}</Text>
              </View>
            )}

            {displayPrice != null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{isBuy ? 'Price' : 'Exit Price'}</Text>
                <Text style={styles.detailValue}>₹{String(displayPrice)}</Text>
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
    closedAt = null,
    isEdited = false,
    isClosureBasket = false,
    isExpired = false,
    isRegularBasket = true,
    isCancelled = false,
    isClosed = false,
    isClosurePending = false,
    isPartialEntry = false,
    isCustomerOpenPosition = false,
    brokerMismatch = false,
    brokerOwnershipAmbiguous = false,
    positionBroker = null,
    currentBroker = null,
    managerClosed = false,
    entryBlocked = false,
    entryChecking = false,
    entryGateMessage = null,
    entryRangeWarning = null,
    gradientColors = ['#000C18', '#002C59', '#000C18'],
    trades = [],
    firstThreeTrades = [],
    remainingCount = 0,
    showMore = false,
    expandedTrades = {},
    isCheckingReconciliation = false,
    basket,
    entryProgress = null,
    actionLabel = null,
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
              {isClosureBasket && !isClosed && !isClosurePending && !isCustomerOpenPosition && !isExpired && <StatusBadge type="closure" />}
              {isClosurePending && !isCustomerOpenPosition && !isExpired && <StatusBadge type="closurePending" />}
              {isCustomerOpenPosition && !isExpired && <StatusBadge type="positionOpen" />}
              {isPartialEntry && !isExpired && <StatusBadge type="partialEntry" />}
              {isCancelled && !isExpired && <StatusBadge type="cancelled" />}
              {isClosed && !isExpired && <StatusBadge type={managerClosed ? 'closedByManager' : 'closed'} />}
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
            {isClosed && closedAt ? (
              <Text style={styles.dateText}>
                Entry {formatIST(date)} · Exit {formatIST(closedAt)}
              </Text>
            ) : (
              <Text style={styles.dateText}>
                {formatIST(date)}
              </Text>
            )}
          </View>
        </View>

        {entryRangeWarning && !entryBlocked && (
          <View style={styles.rangeWarning}>
            <Text style={styles.rangeWarningText}>{entryRangeWarning}. You can still continue.</Text>
          </View>
        )}
        {isPartialEntry && entryProgress && (
          <View style={styles.partialEntryNotice}>
            <Text style={styles.partialEntryNoticeText}>
              {`Position incomplete — ${entryProgress.completed} of ${entryProgress.total} legs executed. Retry places only ${entryProgress.retryable} unfinished leg${entryProgress.retryable === 1 ? '' : 's'}.`}
            </Text>
          </View>
        )}
        {(brokerMismatch || brokerOwnershipAmbiguous) && (
          <View style={styles.brokerOwnershipNotice}>
            <Text style={styles.brokerOwnershipNoticeText}>
              {brokerOwnershipAmbiguous
                ? 'This basket has positions across multiple brokers. Reconcile them before exiting.'
                : `Position held in ${positionBroker}. Switch from ${currentBroker || 'the current broker'} to ${positionBroker} to exit.`}
            </Text>
          </View>
        )}
        <View style={{flexDirection: 'row', gap: 8}}>
          {onCancelBasket && !isExpired && !isClosureBasket && !isCancelled && !isClosed && !basket?.cancel && !basket?.closurestatus && (
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => onCancelBasket(basket?.basketId)}
            >
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
          )}
          {isCustomerOpenPosition ? (
            <View style={{flex: 1, minHeight: 44, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 39, 78, 0.72)', borderWidth: 1, borderColor: 'rgba(147, 197, 253, 0.35)'}}>
              <Text style={{color: '#DBEAFE', fontSize: 13, fontWeight: '600'}}>
                Manager has not advised an exit.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.acceptButton,
                {flex: 1},
                (isExpired || isCheckingReconciliation || entryBlocked || isCancelled || isClosed || brokerMismatch || brokerOwnershipAmbiguous) && styles.acceptButtonDisabled,
              ]}
              onPress={onTradeNowBasket}
              disabled={isExpired || isCheckingReconciliation || entryBlocked || isCancelled || isClosed || brokerMismatch || brokerOwnershipAmbiguous}
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
                  {isExpired
                    ? 'Basket Expired'
                    : isCancelled
                      ? 'Basket Cancelled'
                      : isClosed
                        ? 'Basket Closed'
                        : brokerOwnershipAmbiguous
                          ? 'Reconcile broker positions'
                          : brokerMismatch
                            ? `Switch to ${positionBroker}`
                        : isClosureBasket
                          ? 'Exit Basket'
                          : entryChecking
                            ? 'Checking entry range...'
                            : entryBlocked
                              ? entryGateMessage
                              : actionLabel || 'Accept Basket'}
                </Text>
                {!isExpired && !entryBlocked && !isCancelled && !isClosed && <ArrowRight size={12} color={isClosureBasket ? 'rgba(139, 0, 0, 1)' : 'rgba(41, 164, 0, 1)'} />}
              </>
            )}
            </TouchableOpacity>
          )}
        </View>

        {/* Pending Order Warning Modal */}
        {PendingOrderWarningSlot}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  partialEntryNotice: {
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  partialEntryNoticeText: {
    color: '#FEF3C7',
    fontSize: 11,
    fontWeight: '600',
  },
  brokerOwnershipNotice: {
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    backgroundColor: 'rgba(127, 29, 29, 0.28)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  brokerOwnershipNoticeText: {
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: '600',
  },
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
  rangeWarning: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(146, 64, 14, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.55)',
  },
  rangeWarningText: {color: '#FDE68A', fontSize: 11, lineHeight: 16},
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
  alwaysVisibleDetail: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  alwaysVisibleText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontFamily: 'Poppins-Regular',
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
