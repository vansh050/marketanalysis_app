/**
 * GttDetailsModal.js
 * Displays GTT (Good Till Triggered) order details.
 * Ported from prod-alphaquark-github for feature parity.
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {X, Clock} from 'lucide-react-native';

const Field = ({label, value}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value || '-'}</Text>
  </View>
);

const GttLeg = ({title, leg}) => {
  if (!leg) return null;
  return (
    <View style={styles.legContainer}>
      <View style={styles.legHeader}>
        <Text style={styles.legTitle}>{title}</Text>
      </View>
      <View style={styles.legBody}>
        <Field label="Type" value={leg?.Type} />
        <Field label="Order Type" value={leg?.OrderType} />
        <Field label="Price" value={leg?.Price ? `\u20B9${leg.Price}` : '-'} />
        <Field
          label="Trigger Price"
          value={leg?.triggerPrice ? `\u20B9${leg.triggerPrice}` : '-'}
        />
      </View>
    </View>
  );
};

const GttDetailsModal = ({isOpen, data, onClose}) => {
  if (!data) return null;

  const transaction = data?.transactionType || data?.Type;
  const isBuy = transaction?.toLowerCase() === 'buy';

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.clockBadge}>
                <Clock size={16} color="#92400E" />
              </View>
              <Text style={styles.headerTitle}>
                GTT Details — {data?.tradingSymbol || data?.Symbol || '-'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View style={styles.summaryGrid}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Transaction</Text>
                <View
                  style={[
                    styles.badge,
                    {backgroundColor: isBuy ? '#D1FAE5' : '#FEE2E2'},
                  ]}>
                  <Text
                    style={[
                      styles.badgeText,
                      {color: isBuy ? '#065F46' : '#991B1B'},
                    ]}>
                    {transaction?.toUpperCase() || '-'}
                  </Text>
                </View>
              </View>
              <Field
                label="Exchange / Segment"
                value={`${data?.exchange || data?.Exchange || '-'} / ${data?.segment || data?.Segment || '-'}`}
              />
              <Field
                label="Order Type"
                value={data?.orderType || data?.OrderType}
              />
              <Field
                label="Quantity"
                value={data?.quantity || data?.Quantity}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.legsSection}>
              <View style={styles.legsHeader}>
                <Clock size={16} color="#CA8A04" />
                <Text style={styles.legsTitle}>GTT Legs</Text>
              </View>
              <GttLeg title="Entry Leg" leg={data?.entryLeg} />
              <GttLeg title="StopLoss" leg={data?.leg1} />
              <GttLeg title="Target" leg={data?.leg2} />
            </View>
          </ScrollView>
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
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF9C3',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1},
  clockBadge: {
    backgroundColor: '#FDE68A',
    padding: 4,
    borderRadius: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  closeBtn: {padding: 4},
  content: {paddingHorizontal: 16, paddingVertical: 12},
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  field: {width: '46%', marginBottom: 8},
  fieldLabel: {fontSize: 11, color: '#6B7280', marginBottom: 2},
  fieldValue: {fontSize: 14, fontWeight: '500', color: '#111827'},
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  badgeText: {fontSize: 13, fontWeight: '600'},
  divider: {height: 1, backgroundColor: '#E5E7EB', marginVertical: 12},
  legsSection: {gap: 10},
  legsHeader: {flexDirection: 'row', alignItems: 'center', gap: 6},
  legsTitle: {fontSize: 14, fontWeight: '600', color: '#111827'},
  legContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  legHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  legTitle: {fontSize: 12, fontWeight: '600', color: '#374151'},
  legBody: {
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

export default GttDetailsModal;
