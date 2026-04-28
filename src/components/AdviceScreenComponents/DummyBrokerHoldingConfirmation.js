import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import axios from 'axios';
import {X} from 'lucide-react-native';
import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import Config from 'react-native-config';
import {useTrade} from '../../screens/TradeContext';
import Toast from 'react-native-toast-message';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

const DummyBrokerHoldingConfirmation = ({
  userEmail,
  isOpen,
  onClose,
  dummyBrokerConfirmationStockDetails,
  storeModalName,
  modelObjectId,
  modelPortfolioModelId,
  getModelPortfolioStrategyDetails,
  setOpenRebalanceModal,
  getRebalanceRepair,
  modelPortfolioRepairTrades,
  dummyBrokerCalculatedUniqueId,
}) => {
  const {configData} = useTrade();
  const [loading, setLoading] = useState(false);

  const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;

  const matchingRepairTrade =
    modelPortfolioRepairTrades &&
    modelPortfolioRepairTrades?.find(
      trade => trade.modelId === modelPortfolioModelId,
    );

  const convertResponse = dataArray => {
    return dataArray.map(item => {
      const responseObj = {
        transactionType: item.orderType,
        exchange: item.exchange || '',
        segment: 'EQUITY',
        productType: 'DELIVERY',
        orderType: 'MARKET',
        price: item?.editablePrice ? item?.editablePrice : 0,
        tradingSymbol: item.symbol,
        token: item?.token ? item?.token : '',
        quantity: item.editableQty,
        priority: 0,
        user_broker: 'DummyBroker',
      };

      return responseObj;
    });
  };

  const stockDetails = convertResponse(dummyBrokerConfirmationStockDetails);

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const getBasePayload = () => ({
        user_broker: 'DummyBroker',
        user_email: userEmail,
        trades: stockDetails,
        model_id: modelPortfolioModelId,
      });

      const getAdditionalPayload = () => {
        if (matchingRepairTrade) {
          return {
            modelName: matchingRepairTrade.modelName,
            advisor: advisorTag,
            unique_id: matchingRepairTrade?.uniqueId,
          };
        } else {
          return {
            modelName: storeModalName,
            advisor: advisorTag,
            unique_id: dummyBrokerCalculatedUniqueId,
          };
        }
      };

      const payload = {
        ...getBasePayload(),
        ...getAdditionalPayload(),
      };

      const config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}rebalance/process-trade`,
        data: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };

      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      // Step 1: Process trade
      const response = await axios.request(config);

      // Step 2: Update subscriber execution status to 'executed' (matching prod)
      try {
        await axios.put(
          `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
          {
            userEmail: userEmail,
            modelName: storeModalName,
            model_id: modelPortfolioModelId,
            executionStatus: 'executed',
            user_broker: 'DummyBroker',
          },
          {headers: requestHeaders},
        );
      } catch (statusErr) {
        console.error('Error updating subscriber execution status for DummyBroker:', statusErr);
        // Retry once after 2 seconds
        try {
          await new Promise(r => setTimeout(r, 2000));
          await axios.put(
            `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
            {
              userEmail: userEmail,
              modelName: storeModalName,
              model_id: modelPortfolioModelId,
              executionStatus: 'executed',
              user_broker: 'DummyBroker',
            },
            {headers: requestHeaders},
          );
        } catch (retryErr) {
          console.error('Retry also failed:', retryErr);
          Toast.show({
            type: 'error',
            text1: 'Status update failed',
            text2: 'Rebalance recorded but status may be stale. Pull to refresh.',
          });
        }
      }

      // Step 3: Enroll in status-check-queue
      try {
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          {
            userEmail: userEmail,
            modelName: storeModalName,
            advisor: advisorTag,
            broker: 'DummyBroker',
          },
          {headers: requestHeaders},
        );
      } catch (queueErr) {
        console.error('Error adding DummyBroker to status-check-queue:', queueErr);
      }

      // Emit HOLDINGS_REFRESH event (matching prod — only this event, not REBALANCE_EXECUTED)
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName: storeModalName,
      });

      getRebalanceRepair();

      Toast.show({
        type: 'success',
        text1: 'Rebalance recorded successfully!',
        visibilityTime: 3000,
      });

      // Success actions
      setLoading(false);
      setOpenRebalanceModal(false);
      // Delayed refresh to allow cross-server DB sync (matching prod: 2s, 5s)
      setTimeout(() => getModelPortfolioStrategyDetails(), 2000);
      setTimeout(() => getModelPortfolioStrategyDetails(), 5000);
      onClose();
    } catch (error) {
      setLoading(false);
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to record trades';
      Toast.show({
        type: 'error',
        text1: errorMessage,
        visibilityTime: 5000,
      });
      console.error('Trade recording error:', error);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.title}>{storeModalName} Rebalance</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={loading}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.messageText}>
              Confirm that you have executed the orders manually in your broker
              account. We will record these transactions as EXECUTED.
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={loading}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.confirmButton,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: screenWidth * 0.9,
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    fontFamily: 'Poppins-Bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 10,
  },
  content: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    minHeight: 80,
    justifyContent: 'center',
  },
  messageText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    fontFamily: 'Poppins-Regular',
    textAlign: 'left',
  },
  footer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  confirmButton: {
    backgroundColor: '#0056B7',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.7,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
});

export default DummyBrokerHoldingConfirmation;
