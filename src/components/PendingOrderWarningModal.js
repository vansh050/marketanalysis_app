/**
 * PendingOrderWarningModal.js
 * Warning modal displayed when closure orders conflict with pending (unexecuted) orders
 */

import React, {useState, useCallback} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {CONFLICT_TYPES} from '../services/ReconciliationService';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

/**
 * Individual conflict card component
 */
const ConflictCard = ({conflict, index, userChoice, onChoiceChange}) => {
  const {type, closureTrade, pendingOrder, message, suggestedQuantity} = conflict;

  const isPendingOrderConflict = type === CONFLICT_TYPES.PENDING_ORDER_CONFLICT;
  const isPartialFillConflict = type === CONFLICT_TYPES.PARTIAL_FILL_CONFLICT;

  return (
    <View style={styles.conflictCard}>
      {/* Header */}
      <View style={styles.conflictHeader}>
        <View style={[
          styles.conflictIconContainer,
          isPendingOrderConflict && styles.pendingIconContainer
        ]}>
          <Icon
            name={isPendingOrderConflict ? 'clock-alert-outline' : 'chart-pie'}
            size={24}
            color={isPendingOrderConflict ? '#F59E0B' : '#3B82F6'}
          />
        </View>
        <View style={styles.conflictHeaderText}>
          <Text style={styles.conflictTitle}>
            {isPendingOrderConflict ? 'Pending Order Found' : 'Partial Fill Warning'}
          </Text>
          <Text style={styles.conflictSymbol}>{closureTrade.symbol}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.conflictDetails}>
        {/* Pending Order Info */}
        <View style={styles.orderSection}>
          <Text style={styles.orderSectionTitle}>
            {isPendingOrderConflict ? 'Pending Order:' : 'Order Status:'}
          </Text>
          <View style={styles.orderInfo}>
            <Text style={styles.orderText}>
              {pendingOrder.transactionType} {pendingOrder.quantity} @{' '}
              {pendingOrder.orderType}
            </Text>
            <Text style={styles.orderStatus}>
              Status: {pendingOrder.status}
              {isPartialFillConflict &&
                ` (Filled: ${pendingOrder.filledQuantity}/${pendingOrder.quantity})`}
            </Text>
            {pendingOrder.placedAt && (
              <Text style={styles.orderTime}>
                Placed: {formatTime(pendingOrder.placedAt)}
              </Text>
            )}
          </View>
        </View>

        {/* Proposed Closure */}
        <View style={styles.orderSection}>
          <Text style={styles.orderSectionTitle}>Proposed Closure:</Text>
          <View style={styles.orderInfo}>
            <Text style={styles.orderText}>
              {closureTrade.type} {closureTrade.quantity}
            </Text>
            {isPartialFillConflict && suggestedQuantity !== undefined && (
              <Text style={styles.suggestedText}>
                Recommended: {closureTrade.type} {suggestedQuantity} (actual filled)
              </Text>
            )}
          </View>
        </View>

        {/* Message */}
        <View style={[
          styles.messageContainer,
          isPendingOrderConflict && styles.warningMessageContainer
        ]}>
          <Icon
            name={isPendingOrderConflict ? 'alert-circle-outline' : 'information-outline'}
            size={16}
            color={isPendingOrderConflict ? '#B45309' : '#6B7280'}
          />
          <Text style={[
            styles.messageText,
            isPendingOrderConflict && styles.warningMessageText
          ]}>
            {message}
          </Text>
        </View>
      </View>

      {/* Action Selection */}
      <View style={styles.actionSelection}>
        <Text style={styles.actionTitle}>Choose action:</Text>

        {isPendingOrderConflict && (
          <>
            <TouchableOpacity
              style={[
                styles.actionOption,
                userChoice === 'cancelPending' && styles.actionOptionSelected,
              ]}
              onPress={() => onChoiceChange(index, 'cancelPending')}>
              <View style={styles.radioOuter}>
                {userChoice === 'cancelPending' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.actionOptionText}>
                <Text style={styles.actionOptionLabel}>
                  Cancel Pending Order
                </Text>
                <Text style={styles.actionOptionDesc}>
                  Cancel the pending {pendingOrder.transactionType} order (Recommended)
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionOption,
                userChoice === 'refreshAndProceed' && styles.actionOptionSelected,
              ]}
              onPress={() => onChoiceChange(index, 'refreshAndProceed')}>
              <View style={styles.radioOuter}>
                {userChoice === 'refreshAndProceed' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.actionOptionText}>
                <Text style={styles.actionOptionLabel}>Refresh & Proceed</Text>
                <Text style={styles.actionOptionDesc}>
                  Check if order executed and proceed with updated data
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}

        {isPartialFillConflict && (
          <>
            <TouchableOpacity
              style={[
                styles.actionOption,
                userChoice === 'adjust' && styles.actionOptionSelected,
              ]}
              onPress={() => onChoiceChange(index, 'adjust')}>
              <View style={styles.radioOuter}>
                {userChoice === 'adjust' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.actionOptionText}>
                <Text style={styles.actionOptionLabel}>
                  Adjust to {suggestedQuantity}
                </Text>
                <Text style={styles.actionOptionDesc}>
                  Close only the actually filled quantity (Recommended)
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionOption,
                userChoice === 'refreshAndProceed' && styles.actionOptionSelected,
              ]}
              onPress={() => onChoiceChange(index, 'refreshAndProceed')}>
              <View style={styles.radioOuter}>
                {userChoice === 'refreshAndProceed' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.actionOptionText}>
                <Text style={styles.actionOptionLabel}>Refresh & Proceed</Text>
                <Text style={styles.actionOptionDesc}>
                  Refresh to get latest fill status
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

/**
 * Format timestamp for display
 */
const formatTime = timestamp => {
  if (!timestamp) return 'Unknown';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
};

/**
 * Main Modal Component
 */
const PendingOrderWarningModal = ({
  visible,
  conflicts = [],
  onClose,
  onConfirm,
  onCancelAll,
  isLoading = false,
}) => {
  // Initialize user choices - default to recommended actions
  const [userChoices, setUserChoices] = useState(() => {
    const choices = {};
    conflicts.forEach((conflict, index) => {
      if (conflict.type === CONFLICT_TYPES.PENDING_ORDER_CONFLICT) {
        choices[index] = 'cancelPending';
      } else if (conflict.type === CONFLICT_TYPES.PARTIAL_FILL_CONFLICT) {
        choices[index] = 'adjust';
      }
    });
    return choices;
  });

  // Update choices when conflicts change
  React.useEffect(() => {
    const choices = {};
    conflicts.forEach((conflict, index) => {
      if (conflict.type === CONFLICT_TYPES.PENDING_ORDER_CONFLICT) {
        choices[index] = 'cancelPending';
      } else if (conflict.type === CONFLICT_TYPES.PARTIAL_FILL_CONFLICT) {
        choices[index] = 'adjust';
      }
    });
    setUserChoices(choices);
  }, [conflicts]);

  const handleChoiceChange = useCallback((index, choice) => {
    setUserChoices(prev => ({
      ...prev,
      [index]: choice,
    }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (onConfirm) {
      onConfirm(userChoices);
    }
  }, [onConfirm, userChoices]);

  if (!conflicts || conflicts.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {/* Header */}
              <View style={styles.indicator} />
              <View style={styles.modalHeader}>
                <Icon name="clock-alert-outline" size={28} color="#F59E0B" />
                <Text style={styles.modalTitle}>Pending Orders Found</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                {conflicts.length === 1
                  ? '1 pending order found that needs your attention'
                  : `${conflicts.length} pending orders found that need your attention`}
              </Text>

              {/* Info Banner */}
              <View style={styles.infoBanner}>
                <Icon name="information" size={18} color="#1E40AF" />
                <Text style={styles.infoBannerText}>
                  The position may not be open yet. Cancel the pending order or refresh to check status.
                </Text>
              </View>

              {/* Conflicts List */}
              <ScrollView
                style={styles.conflictsList}
                showsVerticalScrollIndicator={false}>
                {conflicts.map((conflict, index) => (
                  <ConflictCard
                    key={index}
                    conflict={conflict}
                    index={index}
                    userChoice={userChoices[index]}
                    onChoiceChange={handleChoiceChange}
                  />
                ))}
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelAllButton}
                  onPress={onCancelAll}
                  disabled={isLoading}>
                  <Text style={styles.cancelAllButtonText}>Cancel All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={isLoading}>
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>
                      Apply & Continue
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '100%',
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: screenHeight * 0.85,
  },
  indicator: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Poppins-SemiBold',
    color: '#1F2937',
    marginLeft: 10,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoBannerText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#1E40AF',
    marginLeft: 10,
    flex: 1,
  },
  conflictsList: {
    maxHeight: screenHeight * 0.45,
  },
  conflictCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  conflictIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingIconContainer: {
    backgroundColor: '#FEF3C7',
  },
  conflictHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
    color: '#1F2937',
  },
  conflictSymbol: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
  },
  conflictDetails: {
    marginBottom: 12,
  },
  orderSection: {
    marginBottom: 10,
  },
  orderSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
    color: '#374151',
    marginBottom: 4,
  },
  orderInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#1F2937',
    fontWeight: '500',
  },
  orderStatus: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  orderTime: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#9CA3AF',
    marginTop: 2,
  },
  suggestedText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#059669',
    marginTop: 4,
    fontWeight: '500',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  warningMessageContainer: {
    backgroundColor: '#FEF3C7',
  },
  messageText: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  warningMessageText: {
    color: '#B45309',
  },
  actionSelection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
    color: '#374151',
    marginBottom: 10,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  actionOptionSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
  },
  actionOptionText: {
    flex: 1,
  },
  actionOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
    color: '#1F2937',
  },
  actionOptionDesc: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  cancelAllButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-Medium',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default PendingOrderWarningModal;
