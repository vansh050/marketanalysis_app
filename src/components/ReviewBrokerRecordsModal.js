/**
 * ReviewBrokerRecordsModal.js
 * Shows broker execution records and allows portfolio migration between brokers.
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
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import {X, CheckCircle, AlertCircle, ArrowRight} from 'lucide-react-native';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../utils/variantHelper';
import Toast from 'react-native-toast-message';

import { designColor } from '../design/literalTokens';

const ReviewBrokerRecordsModal = ({
  userEmail,
  isOpen,
  onClose,
  newBroker,
  getUserDetails,
  configData,
}) => {
  const [fetchingRecords, setFetchingRecords] = useState(true);
  const [brokerRecords, setBrokerRecords] = useState([]);
  const [selectedRecords, setSelectedRecords] = useState({});
  const [migrating, setMigrating] = useState(false);

  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };

  useEffect(() => {
    if (isOpen && userEmail) {
      fetchBrokerRecords();
    }
  }, [isOpen, userEmail]);

  const fetchBrokerRecords = async () => {
    setFetchingRecords(true);
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/model-portfolio-db-update/user-broker-records?email=${encodeURIComponent(userEmail)}`,
        {headers: requestHeaders},
      );
      const records = response.data?.data?.records || [];
      const filtered = records.filter(
        r => r.user_broker !== newBroker && r.hasHoldings,
      );
      setBrokerRecords(filtered);
      const initial = {};
      filtered.forEach(r => {
        initial[r._id] = true;
      });
      setSelectedRecords(initial);
    } catch (error) {
      console.error('Error fetching broker records:', error);
      setBrokerRecords([]);
    } finally {
      setFetchingRecords(false);
    }
  };

  const toggleRecord = id => {
    setSelectedRecords(prev => ({...prev, [id]: !prev[id]}));
  };

  const selectedCount = Object.values(selectedRecords).filter(Boolean).length;

  const handleMigrate = async () => {
    const toMigrate = brokerRecords.filter(r => selectedRecords[r._id]);
    if (toMigrate.length === 0) {
      onClose();
      return;
    }

    setMigrating(true);
    try {
      await axios.post(
        `${server.server.baseUrl}api/model-portfolio-db-update/migrate-broker-records`,
        {
          userEmail,
          newBroker,
          recordIds: toMigrate.map(r => r._id),
        },
        {headers: requestHeaders},
      );

      Toast.show({
        type: 'success',
        text1: `Migrated ${toMigrate.length} record(s) to ${newBroker}`,
        visibilityTime: 4000,
      });

      getUserDetails?.();
      onClose();
    } catch (error) {
      console.error('Error migrating records:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to migrate records. Please try again.',
        visibilityTime: 5000,
      });
    } finally {
      setMigrating(false);
    }
  };

  // Group by broker
  const recordsByBroker = brokerRecords.reduce((acc, record) => {
    const broker = record.user_broker || 'Unknown';
    if (!acc[broker]) acc[broker] = [];
    acc[broker].push(record);
    return acc;
  }, {});

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <CheckCircle size={20} color={designColor('16a34a')} />
              <Text style={styles.headerTitle}>Broker Connected!</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              You've connected{' '}
              <Text style={styles.brokerHighlight}>{newBroker}</Text>. Would you
              like to apply existing portfolio records to this broker?
            </Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={designColor('6b7280')} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.body}>
            {fetchingRecords ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={designColor('6366f1')} />
                <Text style={styles.loadingText}>Loading portfolio records...</Text>
              </View>
            ) : brokerRecords.length === 0 ? (
              <View style={styles.centered}>
                <AlertCircle size={40} color={designColor('9ca3af')} />
                <Text style={styles.emptyText}>No existing records found.</Text>
                <Text style={styles.emptySubtext}>Start fresh with your new broker.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.recordCount}>
                  Found{' '}
                  <Text style={{fontWeight: '600'}}>{brokerRecords.length}</Text>{' '}
                  record(s) from other brokers
                </Text>

                {Object.entries(recordsByBroker).map(([broker, records]) => (
                  <View key={broker} style={styles.brokerGroup}>
                    <View style={styles.brokerGroupHeader}>
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              broker === 'DummyBroker' ? designColor('9ca3af') : designColor('f97316'),
                          },
                        ]}
                      />
                      <Text style={styles.brokerName}>
                        {broker === 'DummyBroker' ? 'Manual (No Broker)' : broker}
                      </Text>
                      <ArrowRight size={14} color={designColor('9ca3af')} />
                      <Text style={styles.newBrokerName}>{newBroker}</Text>
                    </View>

                    {records.map(record => (
                      <TouchableOpacity
                        key={record._id}
                        style={styles.recordRow}
                        onPress={() => toggleRecord(record._id)}>
                        <View
                          style={[
                            styles.checkbox,
                            selectedRecords[record._id] && styles.checkboxChecked,
                          ]}>
                          {selectedRecords[record._id] && (
                            <Text style={styles.checkmark}>{'✓'}</Text>
                          )}
                        </View>
                        <View style={{flex: 1}}>
                          <Text style={styles.modelName}>{record.model_name}</Text>
                          <Text style={styles.modelMeta}>
                            {record.holdingsCount || 0} holdings
                            {record.totalValue
                              ? ` \u2022 \u20B9${record.totalValue.toLocaleString()}`
                              : ''}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                <View style={styles.infoBox}>
                  <AlertCircle size={14} color={designColor('b45309')} />
                  <Text style={styles.infoText}>
                    Selected portfolio records will be associated with{' '}
                    <Text style={{fontWeight: '600'}}>{newBroker}</Text>. Future
                    rebalances will use your new broker.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onClose}
              disabled={migrating}>
              <Text style={styles.skipBtnText}>
                {brokerRecords.length === 0 ? 'Close' : 'Skip for Now'}
              </Text>
            </TouchableOpacity>
            {brokerRecords.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.migrateBtn,
                  (migrating || selectedCount === 0) && {opacity: 0.5},
                ]}
                onPress={handleMigrate}
                disabled={migrating || selectedCount === 0}>
                {migrating ? (
                  <ActivityIndicator size="small" color={designColor('fff')} />
                ) : (
                  <>
                    <Text style={styles.migrateBtnText}>
                      Migrate {selectedCount} Record(s)
                    </Text>
                    <ArrowRight size={16} color={designColor('fff')} />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16},
  modalContainer: {backgroundColor: designColor('fff'), borderRadius: 12, maxHeight: '85%'},
  header: {paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: designColor('e5e7eb'), backgroundColor: designColor('eef2ff')},
  headerRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6},
  headerTitle: {fontSize: 16, fontWeight: '600', color: designColor('111827')},
  headerSubtitle: {fontSize: 13, color: designColor('6b7280'), lineHeight: 18},
  brokerHighlight: {fontWeight: '600', color: designColor('4f46e5')},
  closeBtn: {position: 'absolute', top: 14, right: 14},
  body: {paddingHorizontal: 16, paddingVertical: 12, maxHeight: 350},
  centered: {alignItems: 'center', paddingVertical: 30, gap: 8},
  loadingText: {fontSize: 13, color: designColor('6b7280')},
  emptyText: {fontSize: 14, color: designColor('6b7280'), marginTop: 8},
  emptySubtext: {fontSize: 12, color: designColor('9ca3af')},
  recordCount: {fontSize: 13, color: designColor('6b7280'), marginBottom: 10},
  brokerGroup: {borderWidth: 1, borderColor: designColor('e5e7eb'), borderRadius: 8, marginBottom: 12, overflow: 'hidden'},
  brokerGroupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: designColor('f9fafb'),
    borderBottomWidth: 1, borderBottomColor: designColor('e5e7eb'),
  },
  dot: {width: 10, height: 10, borderRadius: 5},
  brokerName: {fontSize: 13, fontWeight: '500', color: designColor('374151')},
  newBrokerName: {fontSize: 13, fontWeight: '500', color: designColor('4f46e5')},
  recordRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: designColor('f3f4f6'),
  },
  checkbox: {width: 18, height: 18, borderWidth: 1.5, borderColor: designColor('d1d5db'), borderRadius: 4, alignItems: 'center', justifyContent: 'center'},
  checkboxChecked: {backgroundColor: designColor('4f46e5'), borderColor: designColor('4f46e5')},
  checkmark: {color: designColor('fff'), fontSize: 12, fontWeight: '700'},
  modelName: {fontSize: 13, fontWeight: '500', color: designColor('111827')},
  modelMeta: {fontSize: 11, color: designColor('9ca3af'), marginTop: 2},
  infoBox: {
    flexDirection: 'row', gap: 8, padding: 12, borderRadius: 8,
    backgroundColor: designColor('fffbeb'), borderWidth: 1, borderColor: designColor('fde68a'), marginTop: 8,
  },
  infoText: {flex: 1, fontSize: 11, color: designColor('92400e'), lineHeight: 16},
  footer: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: designColor('e5e7eb'), backgroundColor: designColor('f9fafb'),
  },
  skipBtn: {flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: designColor('d1d5db'), borderRadius: 8, alignItems: 'center'},
  skipBtnText: {fontSize: 13, fontWeight: '500', color: designColor('374151')},
  migrateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: designColor('4f46e5'), borderRadius: 8,
  },
  migrateBtnText: {fontSize: 13, fontWeight: '600', color: designColor('fff')},
});

export default ReviewBrokerRecordsModal;
