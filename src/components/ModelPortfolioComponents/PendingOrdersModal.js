import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {XIcon, RefreshCw} from 'lucide-react-native';
import useTokens from '../../theme/useTokens';

import { designFont, designToken } from '../../design/literalTokens';
import {isPastAttemptWithNothingBought} from '../../utils/pastAttemptSummary';

const normalizedStatus = status =>
  String(status || '').trim().toUpperCase().replace(/_/g, ' ');

const getStatusColor = (status) => {
  if (!status) return {text: designToken('pendingOrders.status.neutral.textColor'), bg: designToken('pendingOrders.status.neutral.backgroundColor')};
  const s = normalizedStatus(status);
  if (['COMPLETE', 'COMPLETED', 'TRADED', 'FILLED'].includes(s))
    return {text: designToken('pendingOrders.status.success.textColor'), bg: designToken('pendingOrders.status.success.backgroundColor')};
  if (['OPEN', 'PENDING', 'TRANSIT', 'TRIGGER PENDING', 'AFTER MARKET ORDER REQ RECEIVED'].includes(s))
    return {text: designToken('pendingOrders.status.pending.textColor'), bg: designToken('pendingOrders.status.pending.backgroundColor')};
  if (['REJECTED', 'CANCELLED', 'CANCELED', 'FAILED', 'FAILURE', 'NOT SENT', 'NOT OBSERVED'].includes(s))
    return {text: designToken('pendingOrders.status.failure.textColor'), bg: designToken('pendingOrders.status.failure.backgroundColor')};
  return {text: designToken('pendingOrders.status.other.textColor'), bg: designToken('pendingOrders.status.other.backgroundColor')};
};

const isOrderCancellable = (status) => {
  if (!status) return false;
  const s = normalizedStatus(status);
  return ['OPEN', 'PENDING', 'TRANSIT', 'TRIGGER PENDING', 'AFTER MARKET ORDER REQ RECEIVED'].includes(s);
};

const PendingOrdersModal = ({
  isOpen,
  onClose,
  orders = [],
  broker,
  onCancelAndRetry,
  onRetryOnly,
  cancelLoading,
  attemptedAt,
  cancelError = null,
  onRefresh,
  refreshLoading = false,
}) => {
  const brandPrimary = useTokens().colors.brand.primary;
  if (!isOpen) return null;

  const isPublisher = broker === 'Zerodha';
  const brokerAppName = broker === 'Zerodha' ? 'Kite' : broker;
  const hasCancellableOrders = orders.some((o) => isOrderCancellable(o.orderStatus));
  const hasOrders = orders && orders.length > 0;
  const successStatuses = ['COMPLETE', 'COMPLETED', 'TRADED', 'FILLED', 'EXECUTED'];
  const retryableStatuses = ['REJECTED', 'CANCELLED', 'CANCELED', 'FAILED', 'FAILURE', 'NOT SENT', 'NOT OBSERVED'];
  const completedCount = orders.filter(order =>
    successStatuses.includes(normalizedStatus(order?.orderStatus)),
  ).length;
  const retryableOrders = orders.filter(order =>
    retryableStatuses.includes(normalizedStatus(order?.orderStatus)),
  );
  // Still open at the broker: neither done nor actionable yet. Counting these
  // separately stops "16 completed · 0 need action" while a SELL is pending.
  const openCount = orders.filter(order => isOrderCancellable(order?.orderStatus)).length;
  const hasFailedSell = retryableOrders.some(order =>
    String(order?.transactionType || '').toUpperCase() === 'SELL',
  );
  const pastAttemptNothingBought = isPastAttemptWithNothingBought({
    attemptedAt,
    completedCount,
    openCount,
    orderCount: orders.length,
    retryableCount: retryableOrders.length,
  });
  const attemptDateLabel = attemptedAt && !Number.isNaN(new Date(attemptedAt).getTime())
    ? new Date(attemptedAt).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})
    : null;
  const attemptLabel = attemptedAt && !Number.isNaN(new Date(attemptedAt).getTime())
    ? new Date(attemptedAt).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : null;

  const renderOrder = ({item, index}) => {
    const colors = getStatusColor(item.orderStatus);
    return (
      <View style={styles.orderRow}>
        <View style={styles.orderInfo}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderSymbol} numberOfLines={1}>
              {item.tradingSymbol || item.symbol || 'Unknown'}
            </Text>
            <View
              style={[
                styles.txnBadge,
                {
                  backgroundColor:
                    (item.transactionType || '').toUpperCase() === 'BUY'
                      ? designToken('pendingOrders.txn.buy.backgroundColor')
                      : designToken('pendingOrders.txn.sell.backgroundColor'),
                },
              ]}>
              <Text
                style={[
                  styles.txnText,
                  {
                    color:
                      (item.transactionType || '').toUpperCase() === 'BUY'
                        ? designToken('pendingOrders.txn.buy.textColor')
                        : designToken('pendingOrders.txn.sell.textColor'),
                  },
                ]}>
                {(item.transactionType || '').toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.orderMeta}>
            <Text style={styles.metaText}>
              Qty: {item.quantity || item.qty || '-'}
            </Text>
            {item.orderId && (
              <Text style={styles.metaText} numberOfLines={1}>
                ID: {item.orderId}
              </Text>
            )}
          </View>
          {!!item.orderStatusMessage && (
            <Text style={styles.orderMessage}>{item.orderStatusMessage}</Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: colors.bg},
          ]}>
          <Text
            testID={`order-status-${item.orderId || item.tradingSymbol || item.symbol || 'unknown'}`}
            style={[styles.statusText, {color: colors.text}]}>
            {normalizedStatus(item.orderStatus) === 'NOT OBSERVED'
              ? 'NOT PLACED'
              : item.orderStatus || 'Unknown'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Order Status</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <XIcon size={20} color={designToken('pendingOrders.closeIcon.color')} />
            </TouchableOpacity>
          </View>

          {(attemptLabel || hasOrders) && (
            <View style={styles.attemptSummary}>
              <Text style={styles.attemptSummaryTitle}>
                {pastAttemptNothingBought
                  ? `Last attempt on ${attemptDateLabel} · nothing was bought`
                  : `${completedCount} completed`
                    + (openCount > 0 ? ` · ${openCount} still open at ${brokerAppName || 'the broker'}` : '')
                    + ` · ${retryableOrders.length} need${retryableOrders.length === 1 ? 's' : ''} action`}
              </Text>
              {pastAttemptNothingBought ? (
                <Text style={styles.attemptSummaryMeta}>
                  None of these orders went through, so you hold nothing from that attempt. No order is being placed right now.
                </Text>
              ) : attemptLabel && (
                <Text style={styles.attemptSummaryMeta}>
                  Attempted {attemptLabel}
                </Text>
              )}
            </View>
          )}

          {/* Order List */}
          {!hasOrders ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No pending orders found.</Text>
              <Text style={styles.emptySubText}>
                Orders may have already been processed.
              </Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              renderItem={renderOrder}
              keyExtractor={(item, idx) => item.orderId || `${idx}`}
              style={styles.orderList}
              contentContainerStyle={styles.orderListContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            />
          )}

          {/* Publisher instructions */}
          {isPublisher && hasCancellableOrders && (
            <View style={styles.publisherNote}>
              <Text style={styles.publisherNoteText}>
                Please cancel pending orders from your{' '}
                <Text style={{fontFamily: designFont('Poppins-SemiBold')}}>{brokerAppName}</Text>{' '}
                app, then click "Retry" to re-execute.
              </Text>
            </View>
          )}

          {hasFailedSell && !hasCancellableOrders && (
            <View style={styles.publisherNote}>
              <Text style={styles.publisherNoteText}>
                Review and retry only the failed SELL first. Completed SELLs will not be repeated,
                and BUY orders stay blocked until this SELL finishes.
              </Text>
            </View>
          )}

          {!!cancelError && (
            <View style={styles.cancelErrorBox} testID="pending-orders-cancel-error">
              <Text style={styles.cancelErrorText}>{cancelError}</Text>
              {typeof onRefresh === 'function' && (
                <TouchableOpacity
                  onPress={onRefresh}
                  disabled={refreshLoading}
                  style={styles.cancelErrorRefresh}>
                  {refreshLoading ? (
                    <ActivityIndicator size="small" color={designToken('pendingOrders.error.textColor')} />
                  ) : (
                    <Text style={styles.cancelErrorRefreshText}>Refresh</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>

            {hasCancellableOrders && (
              isPublisher ? (
                <TouchableOpacity
                  onPress={onRetryOnly}
                  disabled={cancelLoading}
                  style={[styles.actionButton, { backgroundColor: brandPrimary }, cancelLoading && styles.disabledButton]}>
                  {cancelLoading ? (
                    <ActivityIndicator size="small" color={designToken('pendingOrders.actionButton.textColor')} />
                  ) : (
                    <View style={styles.actionRow}>
                      <RefreshCw size={14} color={designToken('pendingOrders.actionButton.textColor')} />
                      <Text style={styles.actionButtonText}>Retry</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={onCancelAndRetry}
                  disabled={cancelLoading}
                  style={[styles.actionButton, { backgroundColor: brandPrimary }, cancelLoading && styles.disabledButton]}>
                  {cancelLoading ? (
                    <ActivityIndicator size="small" color={designToken('pendingOrders.actionButton.textColor')} />
                  ) : (
                    <View style={styles.actionRow}>
                      <RefreshCw size={14} color={designToken('pendingOrders.actionButton.textColor')} />
                      <Text style={styles.actionButtonText}>Cancel & Retry</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            )}

            {!hasCancellableOrders && retryableOrders.length > 0 && (
              <TouchableOpacity
                onPress={onRetryOnly}
                disabled={cancelLoading}
                style={[styles.actionButton, { backgroundColor: brandPrimary }, cancelLoading && styles.disabledButton]}>
                {cancelLoading ? (
                  <ActivityIndicator size="small" color={designToken('pendingOrders.actionButton.textColor')} />
                ) : (
                  <View style={styles.actionRow}>
                    <RefreshCw size={14} color={designToken('pendingOrders.actionButton.textColor')} />
                    <Text style={styles.actionButtonText}>
                      {hasFailedSell
                        ? 'Review failed SELL'
                        : pastAttemptNothingBought
                        ? 'Place these orders again'
                        : 'Continue to order placement'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  cancelErrorBox: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: designToken('pendingOrders.error.backgroundColor'),
    borderWidth: 1,
    borderColor: designToken('pendingOrders.error.borderColor'),
  },
  cancelErrorText: {
    fontSize: 12,
    lineHeight: 17,
    color: designToken('pendingOrders.error.textColor'),
    fontFamily: designFont('Poppins-Regular'),
  },
  cancelErrorRefresh: {alignSelf: 'flex-start', marginTop: 6, paddingVertical: 4},
  cancelErrorRefreshText: {
    fontSize: 12,
    color: designToken('pendingOrders.error.textColor'),
    fontFamily: designFont('Poppins-SemiBold'),
    textDecorationLine: 'underline',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: designToken('pendingOrders.surface.backgroundColor'),
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designToken('pendingOrders.text.color'),
  },
  closeBtn: {
    padding: 4,
  },
  orderList: {
    marginBottom: 16,
    flexShrink: 1,
    maxHeight: 420,
  },
  orderListContent: {paddingBottom: 4},
  attemptSummary: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: designToken('pendingOrders.summary.backgroundColor'),
    borderWidth: 1,
    borderColor: designToken('pendingOrders.summary.borderColor'),
  },
  attemptSummaryTitle: {
    color: designToken('pendingOrders.summary.titleColor'),
    fontSize: 12,
    fontFamily: designFont('Poppins-SemiBold'),
  },
  attemptSummaryMeta: {
    color: designToken('pendingOrders.summary.metaColor'),
    fontSize: 10,
    fontFamily: designFont('Poppins-Regular'),
    marginTop: 2,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: designToken('pendingOrders.row.backgroundColor'),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designToken('pendingOrders.row.borderColor'),
    marginBottom: 8,
  },
  orderInfo: {
    flex: 1,
    marginRight: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderSymbol: {
    fontFamily: designFont('Poppins-Medium'),
    fontSize: 13,
    color: designToken('pendingOrders.text.color'),
  },
  txnBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txnText: {
    fontSize: 11,
    fontFamily: designFont('Poppins-SemiBold'),
  },
  orderMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    color: designToken('pendingOrders.mutedText.color'),
    fontFamily: designFont('Poppins-Regular'),
  },
  orderMessage: {
    marginTop: 5,
    fontSize: 10,
    color: designToken('pendingOrders.error.textColor'),
    fontFamily: designFont('Poppins-Regular'),
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Medium'),
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    color: designToken('pendingOrders.mutedText.color'),
    fontFamily: designFont('Poppins-Regular'),
  },
  emptySubText: {
    fontSize: 11,
    color: designToken('pendingOrders.closeIcon.color'),
    fontFamily: designFont('Poppins-Regular'),
    marginTop: 4,
  },
  publisherNote: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: designToken('pendingOrders.note.backgroundColor'),
    borderWidth: 1,
    borderColor: designToken('pendingOrders.note.borderColor'),
    borderRadius: 8,
  },
  publisherNoteText: {
    fontSize: 12,
    color: designToken('pendingOrders.note.textColor'),
    fontFamily: designFont('Poppins-Regular'),
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: designToken('pendingOrders.closeButton.backgroundColor'),
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Medium'),
    color: designToken('pendingOrders.closeButton.textColor'),
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: designToken('pendingOrders.actionButton.backgroundColor'),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designToken('pendingOrders.actionButton.textColor'),
  },
});

export default PendingOrdersModal;
