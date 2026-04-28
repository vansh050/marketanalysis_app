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

const getStatusColor = (status) => {
  if (!status) return {text: '#6B7280', bg: '#F3F4F6'};
  const s = status.toUpperCase();
  if (['COMPLETE', 'COMPLETED', 'TRADED', 'FILLED'].includes(s))
    return {text: '#15803D', bg: '#DCFCE7'};
  if (['OPEN', 'PENDING', 'TRANSIT', 'TRIGGER PENDING', 'AFTER MARKET ORDER REQ RECEIVED'].includes(s))
    return {text: '#A16207', bg: '#FEF9C3'};
  if (['REJECTED', 'CANCELLED', 'CANCELED'].includes(s))
    return {text: '#B91C1C', bg: '#FEE2E2'};
  return {text: '#374151', bg: '#F3F4F6'};
};

const isOrderCancellable = (status) => {
  if (!status) return false;
  const s = status.toUpperCase();
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
}) => {
  if (!isOpen) return null;

  const isPublisher = broker === 'Zerodha';
  const brokerAppName = broker === 'Zerodha' ? 'Kite' : broker;
  const hasCancellableOrders = orders.some((o) => isOrderCancellable(o.orderStatus));
  const hasOrders = orders && orders.length > 0;

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
                      ? '#F0FDF4'
                      : '#FEF2F2',
                },
              ]}>
              <Text
                style={[
                  styles.txnText,
                  {
                    color:
                      (item.transactionType || '').toUpperCase() === 'BUY'
                        ? '#15803D'
                        : '#B91C1C',
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
        </View>
        <View
          style={[
            styles.statusBadge,
            {backgroundColor: colors.bg},
          ]}>
          <Text style={[styles.statusText, {color: colors.text}]}>
            {item.orderStatus || 'Unknown'}
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
            <Text style={styles.title}>Pending Orders</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <XIcon size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

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
            />
          )}

          {/* Publisher instructions */}
          {isPublisher && hasCancellableOrders && (
            <View style={styles.publisherNote}>
              <Text style={styles.publisherNoteText}>
                Please cancel pending orders from your{' '}
                <Text style={{fontFamily: 'Poppins-SemiBold'}}>{brokerAppName}</Text>{' '}
                app, then click "Retry" to re-execute.
              </Text>
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
                  style={[styles.actionButton, cancelLoading && styles.disabledButton]}>
                  {cancelLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={styles.actionRow}>
                      <RefreshCw size={14} color="#fff" />
                      <Text style={styles.actionButtonText}>Retry</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={onCancelAndRetry}
                  disabled={cancelLoading}
                  style={[styles.actionButton, cancelLoading && styles.disabledButton]}>
                  {cancelLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={styles.actionRow}>
                      <RefreshCw size={14} color="#fff" />
                      <Text style={styles.actionButtonText}>Cancel & Retry</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            )}

            {!hasCancellableOrders && hasOrders && (
              <TouchableOpacity
                onPress={onRetryOnly}
                disabled={cancelLoading}
                style={[styles.actionButton, cancelLoading && styles.disabledButton]}>
                {cancelLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.actionRow}>
                    <RefreshCw size={14} color="#fff" />
                    <Text style={styles.actionButtonText}>Retry</Text>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
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
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  orderList: {
    marginBottom: 16,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    color: '#111827',
  },
  txnBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  txnText: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
  },
  orderMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  metaText: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Poppins-Medium',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Poppins-Regular',
  },
  emptySubText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Poppins-Regular',
    marginTop: 4,
  },
  publisherNote: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
  },
  publisherNoteText: {
    fontSize: 12,
    color: '#92400E',
    fontFamily: 'Poppins-Regular',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: '#374151',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#2563EB',
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
    fontFamily: 'Poppins-SemiBold',
    color: '#fff',
  },
});

export default PendingOrdersModal;
