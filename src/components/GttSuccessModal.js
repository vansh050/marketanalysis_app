/**
 * GttSuccessModal.js
 * Shows GTT order placement success/failure with details.
 * Ported from prod-alphaquark-github for feature parity.
 */
import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {X, AlertCircle, XCircle, CheckCircle} from 'lucide-react-native';
import moment from 'moment';

const GttSuccessModal = ({
  orderPlacementResponse,
  gttOpenSuccessModal,
  setGttOpenSucessModal,
}) => {
  const [orderResponse, setOrderResponse] = useState(orderPlacementResponse);

  useEffect(() => {
    setOrderResponse(orderPlacementResponse);
  }, [orderPlacementResponse]);

  const gttData = orderResponse?.data || orderResponse;
  const isGTTOrder = gttData && (gttData.type === 'two-leg' || gttData.legs);

  const isError =
    orderResponse?.status === 1 ||
    gttData?.status === 1 ||
    gttData?.orderStatus === 'REJECTED';
  const errorMessage =
    orderResponse?.message || gttData?.message || 'An error occurred';

  const handleClose = () => {
    setGttOpenSucessModal(false);
  };

  return (
    <Modal
      visible={gttOpenSuccessModal}
      transparent
      animationType="fade"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <X size={22} color="#6B7280" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerRow}>
            {isError ? (
              <XCircle size={40} color="#DC2626" />
            ) : (
              <CheckCircle size={40} color="#16A34A" />
            )}
            <View style={styles.headerText}>
              <Text
                style={[
                  styles.headerTitle,
                  {color: isError ? '#DC2626' : '#111827'},
                ]}>
                {isError
                  ? isGTTOrder
                    ? 'GTT Order Rejected'
                    : 'Order Failed'
                  : isGTTOrder
                  ? 'GTT Order Placed Successfully'
                  : 'All Orders Placed Successfully'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isError
                  ? errorMessage
                  : isGTTOrder
                  ? 'Your GTT order is now active and will trigger when market conditions are met.'
                  : 'Please review the order details below.'}
              </Text>
            </View>
          </View>

          {/* GTT Details */}
          {isGTTOrder && (
            <View
              style={[
                styles.gttBox,
                {
                  backgroundColor: isError ? '#FEF2F2' : '#EFF6FF',
                  borderColor: isError ? '#FECACA' : '#BFDBFE',
                },
              ]}>
              <View style={styles.gttBoxHeader}>
                {isError ? (
                  <XCircle size={18} color="#DC2626" />
                ) : (
                  <AlertCircle size={18} color="#2563EB" />
                )}
                <Text
                  style={[
                    styles.gttBoxTitle,
                    {color: isError ? '#991B1B' : '#1E40AF'},
                  ]}>
                  GTT Order Details
                </Text>
              </View>

              <View style={styles.gttDetail}>
                <Text style={styles.gttLabel}>Symbol:</Text>
                <Text style={styles.gttValue}>
                  {gttData?.symbol || gttData?.condition?.tradingsymbol || '-'}
                </Text>
              </View>

              {gttData?.condition?.last_price && (
                <View style={styles.gttDetail}>
                  <Text style={styles.gttLabel}>Current Price:</Text>
                  <Text style={styles.gttValue}>
                    {'\u20B9'}
                    {gttData.condition.last_price}
                  </Text>
                </View>
              )}

              {(gttData?.condition?.trigger_values ||
                gttData?.triggerValues) && (
                <View style={styles.gttDetail}>
                  <Text style={styles.gttLabel}>Trigger Prices:</Text>
                  <View style={styles.triggerRow}>
                    {(
                      gttData?.condition?.trigger_values ||
                      gttData?.triggerValues
                    )?.map((price, index) => (
                      <View
                        key={index}
                        style={[
                          styles.triggerBadge,
                          {
                            backgroundColor: isError ? '#FEE2E2' : '#DBEAFE',
                          },
                        ]}>
                        <Text
                          style={[
                            styles.triggerText,
                            {color: isError ? '#DC2626' : '#2563EB'},
                          ]}>
                          {'\u20B9'}
                          {price}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {gttData?.id && (
                <View style={styles.gttDetail}>
                  <Text style={styles.gttLabel}>GTT ID:</Text>
                  <Text style={styles.gttValue}>{gttData.id}</Text>
                </View>
              )}

              {gttData?.status !== undefined && (
                <View style={styles.gttDetail}>
                  <Text style={styles.gttLabel}>Status:</Text>
                  <Text style={styles.gttValue}>
                    {typeof gttData.status === 'number'
                      ? gttData.status === 0
                        ? 'Active'
                        : 'Failed'
                      : gttData.status}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerDate}>
              Placed On: {moment().format('Do MMM YYYY')}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '85%',
  },
  closeBtn: {position: 'absolute', top: 12, right: 12, zIndex: 1, padding: 4},
  headerRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16, paddingRight: 24},
  headerText: {flex: 1},
  headerTitle: {fontSize: 17, fontWeight: '600', marginBottom: 6},
  headerSubtitle: {fontSize: 13, color: '#6B7280', lineHeight: 18},
  gttBox: {borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 16},
  gttBoxHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10},
  gttBoxTitle: {fontSize: 14, fontWeight: '600'},
  gttDetail: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap'},
  gttLabel: {fontSize: 13, color: '#374151', fontWeight: '500'},
  gttValue: {fontSize: 13, fontWeight: '600', color: '#111827'},
  triggerRow: {flexDirection: 'row', gap: 6},
  triggerBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4},
  triggerText: {fontSize: 13, fontWeight: '600'},
  footer: {alignItems: 'center', paddingTop: 8},
  footerDate: {fontSize: 12, color: '#9CA3AF'},
});

export default GttSuccessModal;
