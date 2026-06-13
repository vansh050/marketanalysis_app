import {useState, useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import axios from 'axios';
import moment from 'moment';
import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';
import Toast from 'react-native-toast-message';
import {classifyFundsResponse} from '../../utils/brokerSessionValidator';
import eventEmitter from '../../components/EventEmitter';
import LinearGradient from 'react-native-linear-gradient';
import Config from 'react-native-config';
import StepProgressBar from './StepProgressBar';
import Checkbox from '../../components/AdviceScreenComponents/Checkbox';
import {useNavigation} from '@react-navigation/native';
const Alpha100 = require('../../assets/mpf_1.png');
const screenWidth = Dimensions.get('window').width;
import {XIcon, Calendar, Check, X, Info} from 'lucide-react-native';
import { useConfig } from '../../context/ConfigContext';
import MPStatusModal from '../../components/AdviceScreenComponents/MPStatusModal';
import logo from '../../assets/fadedlogo.png';

import {generateToken} from '../../utils/SecurityTokenManager';
import RebalancePreferenceModal from './RebalancePreferenceModal';
import { useComponent } from '../../design/useDesign';
import RebalanceChangeDetailModal from '../../components/RebalanceChangeDetailModal';
import PendingOrdersModal from '../../components/ModelPortfolioComponents/PendingOrdersModal';
import {cancelOrder} from '../../services/BrokerOrderBookAPI';
import {useTrade} from '../../screens/TradeContext';
import {isFundsErrorOrMissing} from '../../utils/rebalanceHelpers';
import {useRefreshBrokerStatus} from '../../hooks/useRefreshBrokerStatus';

const RebalanceCard = ({
  openRebalModal,
  data,
  mininvestvalue,
  frequency,
  setOpenRebalanceModal,
  modelName,
  imageUrl,
  userEmail,
  apiKey,
  setmatchfailed,
  jwtToken,
  secretKey,
  clientCode,
  sid,
  matchingFailedTrades,
  serverId,
  viewToken,
  setCalculatedPortfolioData,
  repair,
  advisorName,
  setModelPortfolioModelId,
  storeModalName,
  setStoreModalName,
  setOpenTokenExpireModel,
  broker,
  brokerStatus,
  rebalanceDetails,
  setBrokerModel,
  sortedRebalances,
  funds,
  overView,
  userExecution,
  showstatusModal,
  setShowstatusModal,
  stockDataForModal,
  setStockDataForModal,
  setLatestRebalanceData,
  setRepairmessageModal,
  setuserExecution,
  setmatchingFailedTrades,
  userExecutionFinal,
  getUserDetails,
  selectedOption,
  setSelectedOption,
}) => {
  const {configData} = useTrade();
  const angelOneApiKey = configData?.config.REACT_APP_ANGEL_ONE_API_KEY;
  const zerodhaApiKey = configData?.config.REACT_APP_ZERODHA_API_KEY;

  // Inline-fresh {brokerStatus, broker, funds} — closure lag would re-pop
  // the TokenExpire modal immediately after a successful reconnect.
  // See `docs/REBALANCING.md § Closure-bound funds`.
  const refreshBrokerStatus = useRefreshBrokerStatus(userEmail);

  // Get dynamic config from API
  const config = useConfig();
  const RebalanceDetailsModal = useComponent('composites.RebalanceDetailsModal');
  const themeColor = config?.themeColor || '#0056B7';
  const mainColor = config?.mainColor || '#4CAAA0';
  const gradient1 = config?.gradient1 || '#002651';
  const gradient2 = config?.gradient2 || '#0672edff';
  const CardborderWidth = config?.CardborderWidth || 0;
  const cardElevation = config?.cardElevation || 3;
  const cardverticalmargin = config?.cardverticalmargin || 3;
  const navigation = useNavigation();
  const [allRebalanceHoldingData, setallRebalanceHoldingData] = useState(null);
  const [isChangeModal, setisChangeModal] = useState(false);
  // Flag to bypass repair shortcut for fresh rebalances (matching web skipRepairRef)
  const skipRepairRef = useRef(false);
  const showToast = (message1, type, message2) => {
    Toast.show({
      type: type,
      text2: message2 + ' ' + message1,
      position: 'bottom',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 60,
      bottomOffset: 80,
      text1Style: {
        color: 'black',
        fontSize: 12,
        fontWeight: '400',
        fontFamily: 'Poppins-Medium',
      },
      text2Style: {
        color: 'black',
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
      },
    });
  };

  // Pending orders modal state
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingRefreshLoading, setPendingRefreshLoading] = useState(false);
  const [cancelRetryLoading, setCancelRetryLoading] = useState(false);

  const [showCheckboxModal, setShowCheckboxModal] = useState(false);
  const [apiResponseData, setApiResponseData] = useState(null);
  const [latestUpdatedResponse, setLatestUpdatedResponse] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [modalVisibleDetails, setModalVisibleDetails] = useState(false);
  // Define 3 steps data to match web
  const stepsData = [
    {label: 'Rebalance Preference'},
    {label: 'Current holdings'},
    {label: 'Final Rebalance'},
  ];

  // Listen for event to close RebalancePreferenceModal when broker modal opens
  useEffect(() => {
    const handleCloseBrokerRelatedModals = () => {
      setShowCheckboxModal(false);
    };

    eventEmitter.on('closeBrokerRelatedModals', handleCloseBrokerRelatedModals);

    return () => {
      eventEmitter.off('closeBrokerRelatedModals', handleCloseBrokerRelatedModals);
    };
  }, []);

  const handleCheckStatus = async () => {
    try {
      // Refresh broker status before checking (matching web)
      const freshStatus = await refreshBrokerStatus({forceNetwork: true});
      const currentBrokerStatus = freshStatus?.brokerStatus || brokerStatus;

      if (currentBrokerStatus !== 'connected') {
        if (freshStatus?.broker && setOpenTokenExpireModel) {
          setOpenTokenExpireModel(true);
        } else if (setBrokerModel) {
          setBrokerModel(true);
        }
        return;
      }

      // Check funds validity (matching web). Use freshStatus.funds, not
      // the closure-bound `funds` prop — the prop lags by one render
      // cycle after a reconnect and would trigger a false TokenExpire.
      const currentFunds = freshStatus?.funds ?? funds;
      const _fundsPreflight = classifyFundsResponse(currentFunds, currentBrokerStatus, freshStatus?.broker || broker);
      if (_fundsPreflight.reason === 'TRANSIENT') {
        Toast.show({
          type: 'info',
          text1: `${freshStatus?.broker || broker || 'Broker'} temporarily unavailable`,
          text2: _fundsPreflight.message,
          visibilityTime: 4500,
          position: 'bottom',
        });
      } else if (!_fundsPreflight.ok) {
        if (setOpenTokenExpireModel) {
          setOpenTokenExpireModel(true);
        }
        return;
      }

      const response = await axios.get(
        `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${userEmail}/${modelName}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          timeout: 15000,
        },
      );
      // Handle user_net_pf_model as array (matching prod) — sort by date, take latest
      const userNetPfModel = response.data?.data?.user_net_pf_model;
      let orderResults = [];
      if (Array.isArray(userNetPfModel) && userNetPfModel.length > 0) {
        const latestPortfolio = [...userNetPfModel].sort(
          (a, b) => new Date(b.execDate) - new Date(a.execDate),
        )[0];
        orderResults = latestPortfolio?.order_results || [];
      } else if (userNetPfModel?.order_results) {
        // Fallback: single object format
        orderResults = userNetPfModel.order_results;
      }
      // Final fallback: advice_executed.order_results — populated by
      // ccxt-india `_save_results` for ALL attempts (success + failed).
      // user_net_pf_model is empty when ALL trades were rejected (e.g.
      // margin shortfall) because `_save_successful_trades` returns
      // early when there are no successes (rebalancing.py:1453).
      if (orderResults.length === 0) {
        const ae = response.data?.data?.advice_executed;
        const aeLatest = Array.isArray(ae) ? ae[ae.length - 1] : ae;
        orderResults = aeLatest?.order_results || [];
      }
      if (setApiResponseData) {
        setApiResponseData(response.data);
      }
      // Filter out zero-quantity holdings (matching web)
      const nonZeroHoldings = orderResults.filter(
        h => Number(h.quantity || 0) > 0,
      );
      if (setStockDataForModal) {
        setStockDataForModal(nonZeroHoldings);
      }
    } catch (error) {
      console.warn('Error fetching stock data:', error?.message);
    }
    if (setShowstatusModal) {
      setShowstatusModal(true);
    }
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const openModal = () => {
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const checkValidApiAnSecret = data => {
    if (!data) return null;
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };

  const handleexpire = () => {
    eventEmitter.emit('openExpireModel', {isOpen: true});
  };

  const handleBrokerConnect = () => {
    eventEmitter.emit('openBrokerConnect', {isOpen2: true});
  };

  const requestHeaders = {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };

  // Refresh pending order statuses from broker and show modal if still pending
  const handlePendingRefresh = async () => {
    setPendingRefreshLoading(true);

    try {
      // 1. Trigger live order status refresh from broker
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        {
          userEmail: userEmail,
          modelName: modelName,
          advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          broker: broker,
        },
        {headers: requestHeaders},
      );

      // 2. Wait for the poller to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 3. Re-fetch strategy data
      if (getUserDetails) {
        await getUserDetails();
      }

      // 4. Re-check execution status after refresh
      const latestResponse = await axios.get(
        `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${userEmail}/${modelName}`,
        {headers: requestHeaders},
      );

      const userNetPfModel = latestResponse.data?.data?.user_net_pf_model;
      let latestPortfolio;
      if (Array.isArray(userNetPfModel)) {
        latestPortfolio = userNetPfModel.sort(
          (a, b) => new Date(b.execDate) - new Date(a.execDate),
        )[0];
      } else {
        latestPortfolio = userNetPfModel;
      }

      const orderResults = latestPortfolio?.order_results || [];
      const latestStatus = latestResponse.data?.data?.subscriberExecution?.status;

      if (latestStatus === 'executed' || latestStatus === 'partial') {
        Toast.show({
          type: 'success',
          text1: latestStatus === 'executed'
            ? 'All orders have been executed successfully!'
            : 'Some orders were partially executed. You can retry the remaining ones.',
        });
        setPendingRefreshLoading(false);
        return;
      }

      // 5. Still pending — show PendingOrdersModal with order details
      setPendingOrders(orderResults);
      setShowPendingModal(true);
    } catch (error) {
      console.error('Error refreshing pending orders:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to refresh order status',
        text2: 'Please try again.',
      });
    }

    setPendingRefreshLoading(false);
  };

  // Cancel open orders via API and re-open rebalance flow
  const handleCancelAndRetry = async () => {
    setCancelRetryLoading(true);

    try {
      const cancellableStatuses = ['OPEN', 'PENDING', 'TRANSIT', 'TRIGGER PENDING', 'AFTER MARKET ORDER REQ RECEIVED'];
      const ordersToCancelList = pendingOrders.filter(
        (o) => o.orderId && cancellableStatuses.includes((o.orderStatus || '').toUpperCase()),
      );

      let cancelSuccess = 0;
      let cancelFail = 0;

      for (const order of ordersToCancelList) {
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}order/cancel`,
            {
              userId: userEmail,
              brokerName: broker,
              advisorDb: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
              orderId: order.orderId,
            },
            {headers: requestHeaders},
          );
          cancelSuccess++;
        } catch (cancelErr) {
          console.error(`Failed to cancel order ${order.orderId}:`, cancelErr);
          cancelFail++;
        }
      }

      if (cancelFail > 0) {
        Toast.show({
          type: 'error',
          text1: `Cancelled ${cancelSuccess} orders, ${cancelFail} failed`,
          text2: 'Proceeding with retry...',
        });
      } else if (cancelSuccess > 0) {
        Toast.show({
          type: 'success',
          text1: `Cancelled ${cancelSuccess} pending orders.`,
        });
      }

      // Reset execution status to toExecute
      await axios.put(
        `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
        {
          userEmail: userEmail,
          modelName: modelName,
          executionStatus: 'toExecute',
          user_broker: broker,
        },
        {headers: requestHeaders},
      );

      // Refresh data
      if (getUserDetails) {
        await getUserDetails();
      }

      // Close pending modal and open normal rebalance flow
      setShowPendingModal(false);
      setCancelRetryLoading(false);
      handleAcceptClick();
    } catch (error) {
      console.error('Error in cancel and retry:', error);
      Toast.show({
        type: 'error',
        text1: 'Something went wrong during cancel & retry',
        text2: 'Please try again.',
      });
      setCancelRetryLoading(false);
    }
  };

  // Retry without cancelling (for publisher brokers or when no cancellable orders remain)
  const handleRetryOnly = async () => {
    setCancelRetryLoading(true);

    try {
      // Reset execution status to toExecute
      await axios.put(
        `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
        {
          userEmail: userEmail,
          modelName: modelName,
          executionStatus: 'toExecute',
          user_broker: broker,
        },
        {headers: requestHeaders},
      );

      // Refresh data
      if (getUserDetails) {
        await getUserDetails();
      }

      // Close pending modal and open normal rebalance flow
      setShowPendingModal(false);
      setCancelRetryLoading(false);
      handleAcceptClick();
    } catch (error) {
      console.error('Error in retry:', error);
      Toast.show({
        type: 'error',
        text1: 'Something went wrong during retry',
        text2: 'Please try again.',
      });
      setCancelRetryLoading(false);
    }
  };

  // If there's no execution record for this broker, don't show rebalance actions.
  // Prevents undefined status from incorrectly triggering repair flows.
  const hasExecutionRecord = !!userExecution;
  // If the user executed with a different broker than the currently connected one,
  // treat it as not executed so they can re-execute with the new broker
  const brokerMatchesExecution = !userExecution?.user_broker ||
    userExecution?.user_broker === broker ||
    (!broker && userExecution?.user_broker === 'DummyBroker');
  const isRebalanceExecuted = hasExecutionRecord && userExecution?.status === 'executed' && brokerMatchesExecution;
  const isPartiallyExecuted = hasExecutionRecord && userExecution?.status === 'partial' && brokerMatchesExecution;
  const isPendingVerification = hasExecutionRecord && userExecution?.status === 'pending' && brokerMatchesExecution;

  const handleAcceptClick = async () => {
    try {
      setisChangeModal(false);
      if (data?.model_Id) {
        setModelPortfolioModelId(data.model_Id);
      }
      setmatchfailed(matchingFailedTrades || null);
      // When skipRepairRef is set, bypass repair path for fresh rebalance (matching web)
      if (repair && userExecution?.status !== 'toExecute' && !skipRepairRef.current) {
        setStoreModalName(modelName);
        setCurrentStep(2);
        setLoading(true);
        await handleCheckStatus();
        setLoading(false);
      } else {
        skipRepairRef.current = false;
        setShowCheckboxModal(true);
        setStoreModalName(modelName);
      }
    } catch (error) {
      console.error('Error in handleAcceptClick:', error);
      setLoading(false);
    }
  };

  const handleChangeCheck = () => {
    try {
      console.log("Here DATA----", userExecutionFinal, matchingFailedTrades);

      // Set the values regardless of whether they're defined or not
      if (setuserExecution) {
        setuserExecution(userExecutionFinal || null);
      }
      if (setmatchingFailedTrades) {
        setmatchingFailedTrades(matchingFailedTrades || null);
      }

      // Proceed with opening the change modal (no date restriction for repair/multiple executions)
      setisChangeModal(true);
      setStoreModalName(modelName);
      if (setLatestRebalanceData) {
        setLatestRebalanceData(data);
      }
    } catch (error) {
      console.error('Error in handleChangeCheck:', error);
    }
  };

  const handleViewMore = () => {
    navigation.navigate('MPPerformanceScreen', {
      modelName: modelName.name,
      specificPlan: modelName,
    });
  };
  const handleConfirmPreference = async () => {
    try {
      await handleCheckBroker();
    } catch (error) {
      console.error('Error in handleConfirmPreference:', error);
      setLoading(false);
    }
  };

  const handleCheckBroker = async () => {
    try {
      setLoading(true);

      // Refresh broker status from API to get latest connection state
      const freshStatus = await refreshBrokerStatus({forceNetwork: true});
      const currentBroker = freshStatus?.broker || broker;
      const currentBrokerStatus = freshStatus?.brokerStatus || brokerStatus;

      if (currentBrokerStatus !== 'connected' || !currentBroker) {
        setShowCheckboxModal(false);
        setCurrentStep(2);
        if (currentBroker && setOpenTokenExpireModel) {
          setOpenTokenExpireModel(true);
        } else if (setBrokerModel) {
          setBrokerModel(true);
        }
        setLoading(false);
      } else {
        // Use freshStatus.funds — closure `funds` lags after reconnect.
        // Typed pre-flight: TRANSIENT (Upstox 00:00–05:30 IST maintenance,
        // ICICI base-64 hiccup) → soft toast, no reconnect modal.
        // TOKEN_EXPIRED → TokenExpire modal as before.
        const currentFunds = freshStatus?.funds ?? funds;
        const _fundsPreflight = classifyFundsResponse(currentFunds, currentBrokerStatus, freshStatus?.broker || broker);
        if (_fundsPreflight.reason === 'TRANSIENT') {
          Toast.show({
            type: 'info',
            text1: `${freshStatus?.broker || broker || 'Broker'} temporarily unavailable`,
            text2: _fundsPreflight.message,
            visibilityTime: 4500,
            position: 'bottom',
          });
        } else if (!_fundsPreflight.ok) {
          setShowCheckboxModal(false);
          if (setOpenTokenExpireModel) {
            setOpenTokenExpireModel(true);
          }
          setLoading(false);
          return;
        }
        {
          setShowCheckboxModal(false);
          setCurrentStep(2);
          await handleCheckStatus();
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error in handleCheckBroker:', error);
      setLoading(false);
    }
  };

  return (
    <View>
      <View>
        <LinearGradient
          colors={
            isRebalanceExecuted
              ? ['#9CA3AF', '#6B7280']
              : isPartiallyExecuted
                ? ['#2a2a2a', '#DE8846']
                : isPendingVerification
                  ? ['#2a2a2a', '#D4A843']
                  : repair && userExecution?.status !== 'toExecute'
                    ? ['#2a2a2a', '#DE8846']
                    : [gradient1, gradient2]
          }
          start={{x: 0, y: 1}}
          end={{x: 1, y: 1}}
          style={[styles.cardContainer, {borderRadius: isExpanded ? 0 : 6, opacity: (isRebalanceExecuted || isPartiallyExecuted || isPendingVerification) ? 0.85 : 1}]}>
          <View style={styles.cardContent}>
            <View style={styles.textContent}>
              <Text style={styles.titleText}>{modelName}</Text>
              <View style={{flexDirection: 'column'}}>
                <Text
                  style={[
                    styles.subText,
                    {
                      color:
                        repair && userExecution?.status !== 'toExecute'
                          ? '#fff'
                          : '#fff',
                    },
                  ]}>
                  <Text
                    style={{
                      color: '#fff',
                      fontFamily: 'Satoshi-Regular',
                    }}></Text>
                  {overView?.length > 50
                    ? isExpanded
                      ? overView
                      : `${overView?.substring(0, 50)}...`
                    : overView}
                  {overView?.length > 50 && (
                    <Text
                      onPress={openModal}
                      style={{
                        fontFamily: 'Satoshi-Regular',
                        color: '#4B8CEE',
                        padding: 1,
                        fontSize: 10,
                      }}>
                      {isExpanded ? ' Read Less' : ' Read More'}
                    </Text>
                  )}
                </Text>
              </View>
            </View>
            <View
              style={{
                borderWidth: 1,
                borderColor:
                  repair && userExecution?.status !== 'toExecute'
                    ? '#fff'
                    : "#fff",
                alignContent: 'center',
                alignItems: 'center',
                alignSelf: 'center',
                borderRadius: 15,
                paddingHorizontal: 10,
              }}>
              <Text style={styles.rebalanceText}>
                Rebalance: {frequency}
              </Text>
            </View>
            <View style={styles.logoContainer} pointerEvents="none">
              <Image
                source={logo}
                style={[styles.logo, { tintColor: '#FFFFFF' }]}
                resizeMode="contain"
              />
            </View>
          </View>
          <View
            style={{
              paddingVertical: 5,
            }}>
            <View style={{ paddingHorizontal: 10 }}>
              <Text
                style={{
                  color: '#DBD8D8',
                  fontSize: 12,
                  fontFamily: 'Satoshi-Medium',
                  marginRight: 10,
                }}>
                Minimum Investment Required
              </Text>
              <Text
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: 14,
                  fontFamily: 'Satoshi-Bold',
                  marginLeft: 5,
                }}>
                ₹ {Number.parseFloat(mininvestvalue).toFixed(2)}
              </Text>
            </View>
          </View>
          {/* Status badges */}
          {isRebalanceExecuted && (
            <View style={{alignItems: 'center', marginBottom: 4, marginTop: 4}}>
              <View style={{backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12}}>
                <Text style={{color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: 'Satoshi-Medium'}}>
                  No actions required
                </Text>
              </View>
            </View>
          )}
          {isPartiallyExecuted && (
            <View style={{alignItems: 'center', marginBottom: 4, marginTop: 4}}>
              <View style={{backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12}}>
                <Text style={{color: '#DE8846', fontSize: 12, fontFamily: 'Satoshi-Medium'}}>
                  Partially Executed
                </Text>
              </View>
            </View>
          )}
          {isPendingVerification && (
            <View style={{alignItems: 'center', marginBottom: 4, marginTop: 4}}>
              <View style={{backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12}}>
                <Text style={{color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: 'Satoshi-Medium'}}>
                  Verifying Order Status...
                </Text>
              </View>
            </View>
          )}

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 12,
              paddingHorizontal: 10,
              marginTop: 10,
            }}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('AfterSubscriptionScreen', {
                  fileName: modelName,
                })
              }
              style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>Detail on portfolio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={isPendingVerification ? handlePendingRefresh : handleChangeCheck}
              disabled={pendingRefreshLoading || isRebalanceExecuted || !hasExecutionRecord}
              style={[
                styles.button,
                isPendingVerification && {borderWidth: 1, borderColor: '#EAB308'},
                isRebalanceExecuted && {backgroundColor: '#D1D5DB'},
              ]}>
              {loading || pendingRefreshLoading ? (
                <ActivityIndicator size={14} color={gradient2} />
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignContent: 'center',
                    alignItems: 'center',
                    alignSelf: 'center',
                  }}>
                  <Text style={[styles.buttonText, {color: isRebalanceExecuted ? '#6B7280' : gradient2}]}>
                    {!hasExecutionRecord
                      ? 'No rebalance pending'
                      : isRebalanceExecuted
                      ? 'Rebalance Accepted'
                      : isPartiallyExecuted
                        ? 'Retry Rebalance'
                        : isPendingVerification
                          ? 'Check Order Status'
                          : repair && userExecution?.status !== 'toExecute'
                            ? 'Repair Portfolio'
                            : 'Accept Rebalance'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Step 1: Rebalance Preference Modal */}
      <RebalancePreferenceModal
        showCheckboxModal={showCheckboxModal}
        setShowCheckboxModal={setShowCheckboxModal}
        setSelectedOption={setSelectedOption}
        selectedOption={selectedOption}
        handleConfirmPreference={handleConfirmPreference}
      />

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}>
        <View style={styles.readMoreModalContainer}>
          <View style={styles.readMoreModalContent}>
            <View
              style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <Text style={styles.readMoreModalTitle}>
                {'Overview for ' + modelName}
              </Text>
              <XIcon onPress={closeModal} size={20} color={'black'} />
            </View>
            <Text style={styles.readMoreModalText}>{overView}</Text>
          </View>
        </View>
      </Modal>
      <RebalanceDetailsModal
        visible={modalVisibleDetails}
        onClose={() => setModalVisibleDetails(false)}
        data={rebalanceDetails || {}}
      />

      {isChangeModal && (
        <RebalanceChangeDetailModal
          isVisible={isChangeModal}
          modelName={modelName}
          onClose={() => setisChangeModal(false)}
          handleAcceptClick={handleAcceptClick}
          rebalanceDetails={rebalanceDetails}
          holdingsData={allRebalanceHoldingData}
        />
      )}

      <PendingOrdersModal
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        orders={pendingOrders}
        broker={broker}
        onCancelAndRetry={handleCancelAndRetry}
        onRetryOnly={handleRetryOnly}
        cancelLoading={cancelRetryLoading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    paddingVertical: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    marginRight: 10,
    flex: 1,
  },
  cardContent: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    flex: 1,
  },
  viewMoreButton: {
    flex: 1,
    backgroundColor: 'rgba(232, 232, 232, 0.58)',
    borderRadius: 3,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMoreText: {color: '#fff', fontSize: 12, fontFamily: 'Poppins-Medium'},
  textContent: {
    flex: 1,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 5,
  },
  subText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Regular',
  },
  rebalanceText: {
    fontSize: 12,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    color: '#fff',
    marginTop: 2,
    fontFamily: 'Poppins-Regular',
  },
  dateContainer: {
    flex: 1,
    flexDirection: 'row',
    alignContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    position: 'absolute',
    top: '100%',
    left: '60%',
    transform: [{translateX: -50}, {translateY: -50}], // centers it
    zIndex: 0,
    opacity: 1,
  },
  logo: {
    width: 110,
    height: 110,
    resizeMode: 'contain', // makes sure it fits nicely
  },

  dateText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
    marginLeft: 5,
  },
  button: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 3,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#002651',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },

  // Enhanced Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  optionsContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOptionCard: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 20,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '500',
    fontSize: 14,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },

  // Read More Modal Styles
  readMoreModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  readMoreModalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  readMoreModalTitle: {
    fontSize: 18,
    marginBottom: 10,
    color: 'black',
    fontFamily: 'Poppins-Bold',
  },
  readMoreModalText: {
    fontSize: 12,
    textAlign: 'left',
    color: '#858585',
    marginBottom: 20,
    fontFamily: 'Satoshi-Regular',
  },
});

export default RebalanceCard;
