import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';

const HoldingsMigrationModal = ({
  isOpen,
  onClose,
  userEmail,
  newBroker,
  onMigrationComplete,
  configHeaderName,
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [migrationData, setMigrationData] = useState(null);
  const [selections, setSelections] = useState({});

  useEffect(() => {
    if (isOpen && userEmail && newBroker) {
      fetchMigrationSummary();
    }
  }, [isOpen, userEmail, newBroker]);

  const authHeaders = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': configHeaderName || '',
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };

  const fetchMigrationSummary = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/model-portfolio-db-update/broker-migration-summary/${encodeURIComponent(userEmail)}`,
        {params: {newBroker}, headers: authHeaders},
      );
      const data = response.data?.data;
      setMigrationData(data);
      const initial = {};
      (data?.modelsWithHoldings || []).forEach(model => {
        initial[model.model_name] = model.existingNewBrokerRecord?.hasHoldings
          ? 'empty'
          : 'migrate';
      });
      setSelections(initial);
    } catch (err) {
      console.error('[HoldingsMigrationModal] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!migrationData) return;
    setSubmitting(true);
    try {
      const migrations = (migrationData.modelsWithHoldings || []).map(model => ({
        modelName: model.model_name,
        action: selections[model.model_name] || 'empty',
        sourceDocumentId:
          selections[model.model_name] === 'migrate'
            ? model.primaryBrokerId
            : null,
      }));
      await axios.post(
        `${server.server.baseUrl}api/model-portfolio-db-update/handle-broker-migration`,
        {userEmail, newBroker, migrations},
        {headers: authHeaders},
      );
      onMigrationComplete?.();
      onClose();
    } catch (err) {
      console.error('[HoldingsMigrationModal] submit failed:', err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const models = migrationData?.modelsWithHoldings || [];
  const isReconnection =
    models.length > 0 && models.every(m => m.existingNewBrokerRecord?.hasHoldings);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isReconnection ? `Reconnected to ${newBroker}` : `Switch to ${newBroker}`}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Checking your portfolios…</Text>
            </View>
          ) : isReconnection ? (
            <View style={styles.center}>
              <Text style={styles.reconnectText}>
                Your holdings are already set up for {newBroker}. You're good to go!
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          ) : models.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.reconnectText}>No portfolios to migrate.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>
                You have model portfolio holdings from a previous broker. Choose
                what to do for each portfolio:
              </Text>
              <ScrollView style={styles.list}>
                {models.map(model => (
                  <View key={model.model_name} style={styles.modelCard}>
                    <Text style={styles.modelName}>{model.model_name}</Text>
                    <Text style={styles.modelMeta}>
                      {model.holdingsCount} stock{model.holdingsCount !== 1 ? 's' : ''}
                      {model.primaryBroker ? ` · from ${model.primaryBroker}` : ''}
                      {model.totalValue > 0
                        ? ` · ₹${model.totalValue.toLocaleString('en-IN')}`
                        : ''}
                    </Text>
                    <View style={styles.optionRow}>
                      <TouchableOpacity
                        style={[
                          styles.optionBtn,
                          selections[model.model_name] === 'migrate' &&
                            styles.optionBtnActive,
                        ]}
                        onPress={() =>
                          setSelections(s => ({...s, [model.model_name]: 'migrate'}))
                        }>
                        <Text
                          style={[
                            styles.optionText,
                            selections[model.model_name] === 'migrate' &&
                              styles.optionTextActive,
                          ]}>
                          Carry Forward
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.optionBtn,
                          selections[model.model_name] === 'empty' &&
                            styles.optionBtnActive,
                        ]}
                        onPress={() =>
                          setSelections(s => ({...s, [model.model_name]: 'empty'}))
                        }>
                        <Text
                          style={[
                            styles.optionText,
                            selections[model.model_name] === 'empty' &&
                              styles.optionTextActive,
                          ]}>
                          Start Fresh
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Confirm & Continue</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  sheet: {backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%'},
  header: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  title: {fontSize: 18, fontWeight: '700', color: '#111827', flex: 1},
  closeBtn: {padding: 4},
  closeBtnText: {fontSize: 18, color: '#6B7280'},
  subtitle: {fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 20},
  list: {maxHeight: 320},
  modelCard: {borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 10},
  modelName: {fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 2},
  modelMeta: {fontSize: 12, color: '#6B7280', marginBottom: 10},
  optionRow: {flexDirection: 'row', gap: 8},
  optionBtn: {flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingVertical: 8, alignItems: 'center'},
  optionBtnActive: {borderColor: '#2563EB', backgroundColor: '#EFF6FF'},
  optionText: {fontSize: 13, color: '#374151'},
  optionTextActive: {color: '#2563EB', fontWeight: '600'},
  primaryBtn: {backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16},
  primaryBtnDisabled: {opacity: 0.6},
  primaryBtnText: {color: '#fff', fontSize: 15, fontWeight: '700'},
  center: {alignItems: 'center', paddingVertical: 24},
  loadingText: {marginTop: 12, color: '#6B7280', fontSize: 14},
  reconnectText: {fontSize: 14, color: '#374151', textAlign: 'center', marginBottom: 20, lineHeight: 22},
});

export default HoldingsMigrationModal;
