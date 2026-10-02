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
  Alert,
} from 'react-native';
import axios from 'axios';
import moment from 'moment';
import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';
import Toast from 'react-native-toast-message';
import {classifyFundsResponse} from '../../utils/brokerSessionValidator';
import {hasVerifiedExecutionCompletion} from '../../utils/modelPortfolioExecution';
import {isPublisherLegTerminal} from '../../utils/publisherOrderLabel';
import {accountRecoveryTitle, holdingsReviewCanResolve} from '../../utils/accountRecoveryUx';
import eventEmitter from '../../components/EventEmitter';
import LinearGradient from 'react-native-linear-gradient';
import RenderHTML from 'react-native-render-html';
import Config from 'react-native-config';
import {useNavigation} from '@react-navigation/native';
import { designColor, designFont } from '../../design/literalTokens';
const Alpha100 = require('../../assets/mpf_1.png');
const screenWidth = Dimensions.get('window').width;

// API returns overView with HTML tags (e.g. `<p><span style="...">text</span></p>`).
// Render as plain text — entities decoded, tags stripped, whitespace collapsed.
const stripHtml = (input) => {
  if (!input) return '';
  return String(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};
import {XIcon, Calendar, Check, X, Info} from 'lucide-react-native';
import { useConfig } from '../../context/ConfigContext';
import logo from '../../assets/fadedlogo.png';

import {generateToken} from '../../utils/SecurityTokenManager';
import { useComponent } from '../../design/useDesign';
import {useTokens} from '../../theme/useTokens';
import RebalanceChangeDetailModal from '../../components/RebalanceChangeDetailModal';
import PendingOrdersModal from '../../components/ModelPortfolioComponents/PendingOrdersModal';
import {cancelOrder} from '../../services/BrokerOrderBookAPI';
import {useTrade} from '../../screens/TradeContext';
import {isFundsErrorOrMissing} from '../../utils/rebalanceHelpers';
import {acceptTimingStart, acceptTimingMark} from '../../utils/acceptTiming';
import {
  useRefreshBrokerStatus,
  BROKER_PROBE_REUSE_MS,
} from '../../hooks/useRefreshBrokerStatus';
import {
  extractLatestModelPortfolioOrderAttempt,
  extractLatestModelPortfolioOrderResults,
  extractCurrentModelPortfolioHoldings,
} from '../../utils/modelPortfolioOrderStatus';

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
  onReviewRebalance,
  setStockTypeAndSymbol,
  setRepairmessageModal,
  setuserExecution,
  setmatchingFailedTrades,
  setRebalanceExecutionStatus,
  userExecutionFinal,
  getUserDetails,
  onContinuePublisherBuys,
}) => {
  const tokens = useTokens();
  const {
    configData,
    getModelPortfolioRepairTrades,
    getRecentRepairResult,
    getModelPortfolioStrategyDetails,
    modelPortfolioStrategyfinal,
    repairReconciliation,
  } = useTrade();
  const angelOneApiKey = configData?.config.REACT_APP_ANGEL_ONE_API_KEY;
  const zerodhaApiKey = configData?.config.REACT_APP_ZERODHA_API_KEY;

  // Inline-fresh {brokerStatus, broker, funds} — closure lag would re-pop
  // the TokenExpire modal immediately after a successful reconnect.
  // See `docs/REBALANCING.md § Closure-bound funds`.
  const refreshBrokerStatus = useRefreshBrokerStatus(userEmail);

  // Get dynamic config from API
  const config = useConfig();
  const RebalanceDetailsModal = useComponent('composites.RebalanceDetailsModal');
  const themeColor = config?.themeColor || designColor('0056b7');
  const mainColor = config?.mainColor || designColor('4caaa0');
  const gradient1 = config?.gradient1 || designColor('002651');
  const gradient2 = config?.gradient2 || designColor('0672edff');
  const CardborderWidth = config?.CardborderWidth || 0;
  const cardElevation = config?.cardElevation || 3;
  const cardverticalmargin = config?.cardverticalmargin || 3;
  const navigation = useNavigation();
  const [allRebalanceHoldingData, setallRebalanceHoldingData] = useState(null);
  const [isChangeModal, setisChangeModal] = useState(false);
  // Flag to bypass repair shortcut for fresh rebalances (matching web skipRepairRef)
  const skipRepairRef = useRef(false);
  const actionOpeningRef = useRef(false);
  const pendingActionRef = useRef(null);
  const tapReadSessionRef = useRef(null);
  // 2026-10-02: a calculate path may start before this tap's broker probe
  // returns; handleCheckBroker hands the in-flight probe to calculate.
  const speculativeProbeRef = useRef(null);
  const restartSequentialRef = useRef(null);
  const repairDiscoveryRef = useRef(null);
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
        fontFamily: designFont('Poppins-Medium'),
      },
      text2Style: {
        color: 'black',
        fontSize: 12,
        fontFamily: designFont('Poppins-Regular'),
      },
    });
  };

  // Pending orders modal state
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingAttempt, setPendingAttempt] = useState(null);
  // Per-leg truth from the Refresh the customer just pressed. Separate from
  // `pendingOrders`, which is display state for the modal and survives it.
  const [refreshedLegTruth, setRefreshedLegTruth] = useState(null);
  const [pendingRefreshLoading, setPendingRefreshLoading] = useState(false);
  const [cancelRetryLoading, setCancelRetryLoading] = useState(false);
  // Why the last Cancel & Retry stopped (shown inside the modal).
  const [cancelError, setCancelError] = useState(null);
  // get-repair can prove that a legacy partial execution has no remaining
  // broker legs before the refreshed strategy catalogue reaches this card.
  // Keep the card aligned with that authoritative result immediately instead
  // of leaving a stale "Retry Rebalance" action visible until another reload.
  const [locallyResolvedAligned, setLocallyResolvedAligned] = useState(false);

  useEffect(() => {
    setLocallyResolvedAligned(false);
  }, [data?.model_Id]);

  const [, setShowCheckboxModal] = useState(false);
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

  const handleCheckStatus = async freshStatusOverride => {
    try {
      // handleCheckBroker already performs the mandatory live preflight. Reuse
      // that result instead of making the customer wait for the same Groww
      // funds request twice. Direct callers can still request their own probe.
      const freshStatus = freshStatusOverride ||
        (await refreshBrokerStatus({forceNetwork: true}));
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
        return;
      } else if (!_fundsPreflight.ok) {
        if (setOpenTokenExpireModel) {
          setOpenTokenExpireModel(true);
        }
        return;
      }

      const response = await axios.get(
        `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${userEmail}/${modelName}`,
        {
          params: {broker: freshStatus?.broker || broker},
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
      const orderResults = extractCurrentModelPortfolioHoldings(response);
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
    try {
      const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
      const Key = bytesKey.toString(CryptoJS.enc.Utf8);
      return Key || data;
    } catch (error) {
      // Decrypt-or-passthrough: plaintext credentials (e.g. Zerodha's API
      // key) must be sent as-is (2026-08-13).
      return data;
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
      // Resolve the exact current attempt before enrolling it. A calculation
      // creates no broker order, so a legacy model-only queue request can turn
      // a stale `subscriberExecution: pending` projection into a false block.
      const statusUrl =
        `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${userEmail}/${modelName}`;
      const before = await axios.get(
        statusUrl,
        {headers: requestHeaders, params: {broker}, timeout: 15000},
      );
      const selectedAttempt = extractLatestModelPortfolioOrderAttempt(
        before,
        data?.model_Id,
      );
      if (!selectedAttempt.queueIdentity) {
        setRefreshedLegTruth({attemptId: null, nonTerminal: false});
        // get-repair/account recovery is the authority when no dispatch
        // identity exists. A verified empty result returns to Calculate;
        // unknown or in-flight broker evidence remains fail-closed.
        await repairDiscoveryRef.current?.({
          allowFresh: true,
          allowPendingClear: true,
        });
        return;
      }

      setPendingAttempt(selectedAttempt);

      // Trigger live order status refresh only for the resolved attempt.
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        {
          userEmail: userEmail,
          modelName: modelName,
          advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          broker: broker,
          model_id: data?.model_Id,
          ...selectedAttempt.queueIdentity,
        },
        {headers: requestHeaders, timeout: 15000},
      );

      // 2. Wait for the poller to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Refresh account data independently. The broker-status result below is
      // the authority for this button; an unrelated user-details request must
      // not hold the card spinner indefinitely when it is slow or stalled.
      if (getUserDetails) {
        Promise.resolve()
          .then(() => getUserDetails())
          .catch(error => console.warn('Background user refresh failed:', error));
      }

      // Re-check execution status after the queue has had time to process.
      const latestResponse = await axios.get(
        statusUrl,
        {headers: requestHeaders, params: {broker}, timeout: 15000},
      );

      const orderAttempt = extractLatestModelPortfolioOrderAttempt(
        latestResponse,
        data?.model_Id,
      );
      const orderResults = orderAttempt.orders;
      const latestStatus = latestResponse.data?.data?.subscriberExecution?.status;

      // The freshest per-leg evidence this card will ever hold: a server read
      // of the latest attempt for exactly this model, taken on the customer's
      // own tap. `get-repair` is not re-run here, so without this the card goes
      // on ranking its state off whatever get-repair last said.
      setRefreshedLegTruth({
        attemptId: orderAttempt.attemptId || orderAttempt.uniqueId || null,
        nonTerminal: orderResults.length > 0 &&
          orderResults.some(row => !isPublisherLegTerminal(row)),
      });

      // A reconciliation write can make the completed SELL row newer than the
      // still-open Publisher attempt. The current action is nevertheless the
      // exact frozen BUY continuation, not a sell-only "0 need action" modal.
      if (
        broker === 'Zerodha' &&
        orderAttempt.continuation &&
        typeof onContinuePublisherBuys === 'function'
      ) {
        setShowPendingModal(false);
        setPendingOrders([]);
        setPendingAttempt(null);
        setRefreshedLegTruth(null);
        setModelPortfolioModelId?.(data?.model_Id || data?.model_id);
        setStoreModalName?.(modelName);
        onContinuePublisherBuys({
          ...orderAttempt.continuation,
          context: {
            ...orderAttempt.continuation.context,
            modelId: data?.model_Id || data?.model_id,
            modelName,
            advisor: advisorName,
          },
        });
        return;
      }

      // A Publisher page can be opened and then closed/interrupted before the
      // customer presses Kite's final submit button.  In that case the frozen
      // attempt is real, but every leg is broker-proven NOT SENT.  Make the
      // Refresh button finish that exact attempt instead of leaving the card on
      // an endless "Awaiting Broker Confirmation" projection.  The endpoint is
      // fail-closed: it resolves only after checking broker evidence and never
      // retries an uncertain quantity.
      const allPublisherLegsNotSent =
        orderAttempt.source === 'publisher' &&
        orderResults.length > 0 &&
        orderResults.every(order =>
          ['NOT SENT', 'NOT OBSERVED'].includes(
            String(order?.orderStatus || '').toUpperCase().replace(/_/g, ' '),
          ),
        );
      if (
        broker === 'Zerodha' &&
        allPublisherLegsNotSent &&
        orderAttempt.uniqueId &&
        orderAttempt.planId
      ) {
        const cancellation = await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/publisher/cancelled`,
          {
            unique_id: orderAttempt.uniqueId,
            user_email: userEmail,
            plan_id: orderAttempt.planId,
          },
          {headers: requestHeaders, timeout: 15000},
        );
        if (getUserDetails) {
          await getUserDetails();
        }
        if (cancellation?.data?.resolved === true) {
          setShowPendingModal(false);
          setPendingOrders([]);
          setPendingAttempt(null);
          setRefreshedLegTruth(null);
          await getModelPortfolioStrategyDetails?.({silent: true});
          Alert.alert(
            'No Zerodha order was placed',
            'The unfinished attempt was safely cleared. Continue to Repair to place only these quantities again.',
            [
              {
                text: 'Open Repair',
                onPress: () => {
                  repairDiscoveryRef.current?.({allowFresh: false});
                },
              },
            ],
          );
        } else {
          Alert.alert(
            'Still checking Zerodha',
            'Nothing was retried. Refresh again after broker verification completes.',
          );
        }
        return;
      }

      if (latestStatus === 'toExecute' && orderResults.length === 0) {
        Alert.alert(
          'No broker orders are pending',
          'You can open Repair and place only the unfinished quantities again.',
        );
        return;
      }

      if (orderResults.length > 0) {
        // Show broker truth for terminal as well as pending rows. In particular,
        // all-rejected attempts live only in advice_executed and must remain
        // visible so the customer can understand and repair them.
        setPendingOrders(orderResults);
        setPendingAttempt(orderAttempt);
        setShowPendingModal(true);
        return;
      }

      // A pending summary with no broker rows is not execution evidence. Ask
      // authoritative recovery before either reopening Calculate or continuing
      // to wait; never manufacture another order or a model-only queue entry.
      await repairDiscoveryRef.current?.({
        allowFresh: true,
        allowPendingClear: true,
      });
    } catch (error) {
      console.error('Error refreshing pending orders:', error);
      Alert.alert(
        'Could not refresh order status',
        error?.response?.data?.message || 'Please check the broker connection and try again.',
      );
    } finally {
      // Every early-return branch above must release the card spinner.
      setPendingRefreshLoading(false);
    }
  };

  // Cancel open orders via API and re-open rebalance flow
  // Cancel the still-open broker orders, then re-read broker truth.
  // 2026-10-01 (Fyers): the cancel was refused (wrong tenant DB on the
  // server), the failure toast rendered behind this native modal, and the
  // handler then wrote `toExecute` itself and recalculated — which the
  // reconciliation barrier correctly refused, leaving the card on "Awaiting
  // Broker Confirmation". Now: any failed cancel stops here and says why in
  // the modal; a successful cancel re-reads order status (backend-owned) so
  // the modal offers the retry of only what was cancelled.
  const handleCancelAndRetry = async () => {
    setCancelRetryLoading(true);
    setCancelError(null);

    try {
      const cancellableStatuses = ['OPEN', 'PENDING', 'TRANSIT', 'TRIGGER PENDING', 'AFTER MARKET ORDER REQ RECEIVED'];
      const ordersToCancelList = pendingOrders.filter(
        (o) => o.orderId && cancellableStatuses.includes((o.orderStatus || '').toUpperCase()),
      );

      const failures = [];
      for (const order of ordersToCancelList) {
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}order/cancel`,
            {
              userId: userEmail,
              brokerName: broker,
              // The tenant DATABASE (`prod` on AlphaPro), not the display tag.
              advisorDb:
                configData?.config?.REACT_APP_HEADER_NAME ||
                configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
              orderId: order.orderId,
            },
            {headers: requestHeaders, timeout: 20000},
          );
        } catch (cancelErr) {
          console.error(`Failed to cancel order ${order.orderId}:`, cancelErr);
          const body = cancelErr?.response?.data || {};
          failures.push({
            symbol: order.tradingSymbol || order.symbol || order.orderId,
            reason: body?.data?.message || body?.error || body?.message || '',
          });
        }
      }

      if (failures.length > 0) {
        const first = failures[0];
        setCancelError(
          `Could not cancel ${failures.map(f => f.symbol).join(', ')} at ${broker}` +
            `${first.reason ? ` (${first.reason})` : ''}. Nothing was retried. ` +
            `You can cancel it in the ${broker} app, then tap Refresh.`,
        );
        return;
      }

      // Broker truth decides what happens next: the refresh re-reads the
      // attempt and reopens this modal with the cancelled rows, whose retry
      // goes through Repair (only the unfinished quantities).
      await handlePendingRefresh();
    } catch (error) {
      console.error('Error in cancel and retry:', error);
      setCancelError('Something went wrong while cancelling. Nothing was retried. Please try again.');
    } finally {
      setCancelRetryLoading(false);
    }
  };

  // Retry without cancelling (for publisher brokers or when no cancellable orders remain)
  const handleRetryOnly = async () => {
    setCancelRetryLoading(true);

    try {
      // A Publisher window can reach Kite without producing an order/callback.
      // Resolve that exact frozen attempt against broker evidence before asking
      // Repair for retryable quantities. Never manufacture `toExecute` locally:
      // that false transition was what made an unsubmitted attempt appear to be
      // awaiting broker confirmation.
      if (
        broker === 'Zerodha' &&
        pendingAttempt?.source === 'publisher' &&
        pendingAttempt?.uniqueId &&
        pendingAttempt?.planId
      ) {
        const cancellation = await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/publisher/cancelled`,
          {
            unique_id: pendingAttempt.uniqueId,
            user_email: userEmail,
            plan_id: pendingAttempt.planId,
          },
          {headers: requestHeaders, timeout: 15000},
        );
        if (cancellation?.data?.resolved !== true) {
          Alert.alert(
            'Still checking Zerodha',
            'Nothing was retried. Refresh again after broker verification completes.',
          );
          return;
        }
      }

      if (getUserDetails) {
        await getUserDetails();
      }

      setShowPendingModal(false);
      await repairDiscoveryRef.current?.({allowFresh: false});
    } catch (error) {
      console.error('Error in retry:', error);
      Toast.show({
        type: 'error',
        text1: 'Something went wrong during retry',
        text2: 'Please try again.',
      });
    } finally {
      setCancelRetryLoading(false);
    }
  };

  // Whether the server sent an execution row for this subscriber on the latest
  // rebalance. This must NOT gate the Accept button: `subscriberExecutions` is a
  // one-shot snapshot taken at rebalance-push time and never reconciled, so a
  // subscriber added to `subscribed_by` after the push — or one who switched
  // broker — legitimately has no row while the rebalance is genuinely pending.
  // Gating on it rendered a DISABLED "No rebalance pending" over a live
  // rebalance that the WEB card happily executed (Markup RA, 2026-08-08; 14
  // stranded subscribers, 147 rows fleet-wide). Web has no such gate — it reads
  // `userExecution?.status` and lets a missing row fall through to "Accept
  // Rebalance". We now match that. See MODEL_PORTFOLIO_ARCHITECTURE.md §17.
  const hasExecutionRecord = !!userExecution;
  // If the user executed with a different broker than the currently connected one,
  // treat it as not executed so they can re-execute with the new broker
  const brokerMatchesExecution = !userExecution?.user_broker ||
    userExecution?.user_broker === broker ||
    (!broker && userExecution?.user_broker === 'DummyBroker');
  // Broker/order truth wins over the summary flag. A Publisher attempt can
  // leave the subscriber summary at `executed` while reconciliation has
  // already produced failed legs (for example, Kite rejected a derivative
  // quantity). Such a card must remain actionable for Repair, never grey out
  // as "No actions required".
  const hasRepairTrades =
    (matchingFailedTrades?.failedTrades?.length || 0) > 0;
  const requiresFreshRebalance =
    matchingFailedTrades?.requiresFreshRebalance === true && !hasRepairTrades;
  const verifiedExecutionComplete = hasVerifiedExecutionCompletion(matchingFailedTrades, data?.model_Id);
  // get-repair can return an account-wide pending barrier with no model rows.
  // In that state matchingFailedTrades is intentionally empty, but starting a
  // fresh execution is still unsafe. Preserve cards already known complete;
  // the global barrier must not visually regress them to pending.
  const accountReconciliationPending =
    repairReconciliation?.pending === true &&
    !hasRepairTrades &&
    !requiresFreshRebalance &&
    !verifiedExecutionComplete &&
    !locallyResolvedAligned &&
    !(hasExecutionRecord &&
      userExecution?.status === 'executed' &&
      brokerMatchesExecution);
  // `repairReconciliation` and `matchingFailedTrades` refresh only when repair
  // discovery runs, so they can be minutes older than what the customer sees.
  // On 2026-09-18 the last get-repair answered "ready" at 10:51:55, seconds
  // before the reconciliation cases were written, and was never called again:
  // the card read that stale all-clear, saw `status: 'partial'`, and offered
  // Retry Rebalance while SWASTIVI was still a live DAY limit at Zerodha.
  // Retrying there re-buys 16 shares the resting order can still fill. Newer
  // evidence wins, under the same completion guards as the account barrier
  // above so a settled card cannot regress to pending.
  const refreshedLegsNonTerminal =
    refreshedLegTruth?.nonTerminal === true &&
    !hasRepairTrades &&
    !requiresFreshRebalance &&
    !verifiedExecutionComplete &&
    !locallyResolvedAligned;
  const brokerReconciliationPending =
    matchingFailedTrades?.reconciliationPending === true ||
    accountReconciliationPending ||
    refreshedLegsNonTerminal;
  const isRebalanceExecuted =
    (verifiedExecutionComplete || locallyResolvedAligned ||
      (hasExecutionRecord && userExecution?.status === 'executed')) &&
    brokerMatchesExecution &&
    !hasRepairTrades &&
    !brokerReconciliationPending &&
    !requiresFreshRebalance;
  const isPartiallyExecuted =
    !verifiedExecutionComplete &&
    !locallyResolvedAligned &&
    hasExecutionRecord &&
    userExecution?.status === 'partial' &&
    brokerMatchesExecution &&
    !brokerReconciliationPending;
  const isPendingVerification = !verifiedExecutionComplete &&
    !hasRepairTrades &&
    !requiresFreshRebalance &&
    ((hasExecutionRecord && userExecution?.status === 'pending' && brokerMatchesExecution) ||
      brokerReconciliationPending);
  // Broker/frozen-plan verified failed legs are the Repair authority. The
  // subscriber summary is only a projection and can be absent, duplicated, or
  // reset to `toExecute` during consolidation. Requiring that row here made
  // Retry Rebalance enter the full Calculate flow even though get-repair had
  // already returned the exact remaining legs. A user-specific get-repair
  // match is sufficient; never-executed subscribers have no such legs.
  const isRepairMode = hasRepairTrades;
  const isSellRetryPhase =
    matchingFailedTrades?.repairStatus === 'sell_retry_required' ||
    matchingFailedTrades?.recoveryPhase === 'sell_retry_required';
  const needsRepairDiscovery = isPartiallyExecuted && !hasRepairTrades &&
    !requiresFreshRebalance;

  const selectedRepairPortfolios = (() => {
    if (rebalanceDetails?.model_name === modelName) {
      return [rebalanceDetails];
    }
    const matches = (modelPortfolioStrategyfinal || []).filter(
      portfolio => portfolio?.model_name === modelName,
    );
    return matches.length > 0
      ? matches
      : [{model_name: modelName, advisor: advisorName}];
  })();

  const handleRepairDiscovery = async ({
    allowFresh = false,
    allowPendingClear = false,
    sequential = false,
  } = {}) => {
    if (actionOpeningRef.current || isRebalanceExecuted) return;
    // The dashboard already obtained these exact frozen legs from the
    // authoritative get-repair response. Opening their review is read-only;
    // do not start another account reconciliation/funds round trip on tap.
    // The order modal retains its live placement preflight.
    if (hasRepairTrades && matchingFailedTrades) {
      await handleAcceptClick(matchingFailedTrades);
      return;
    }
    actionOpeningRef.current = true;
    acceptTimingStart(typeof modelName === 'string' ? modelName : modelName?.name);
    setStoreModalName(modelName);
    setModelPortfolioModelId(data?.model_Id);
    setisChangeModal(false);
    setLoading(true);
    try {
      // The earlier-orders reconcile (get-repair) does not depend on the
      // funds probe, so when the app already shows this broker connected run
      // both together (2026-10-02 latency fix). Its result is used only if
      // the probe confirms the SAME broker is still connected; otherwise it
      // is ignored and the flow behaves exactly as before.
      // One id per Accept tap, sent with get-repair AND this tap's calculate
      // so the server may reuse the holdings it just read (2026-10-02).
      const brokerReadSession = `tap_${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 12)}`;
      tapReadSessionRef.current = brokerReadSession;
      const runRepairCheck = () =>
        getModelPortfolioRepairTrades?.(selectedRepairPortfolios, {
          manual: true,
          brokerReadSession,
        });
      // The Home refresh usually ran this exact check seconds ago. Reuse a
      // clean answer under 30 s old for this model + broker instead of a second
      // 4-10 s round-trip (TradeContext drops it on any reconnect/order).
      const cardModelName =
        typeof modelName === 'string' ? modelName : modelName?.name;
      const recentRepair =
        !sequential && brokerStatus === 'connected' && broker
          ? getRecentRepairResult?.({modelName: cardModelName, broker})
          : null;
      const overlapBroker =
        !sequential && !recentRepair && brokerStatus === 'connected' && broker ? broker : null;
      const overlappedRepair = overlapBroker ? runRepairCheck() : null;
      overlappedRepair?.catch?.(() => {});
      const probePromise = refreshBrokerStatus({forceNetwork: true});
      probePromise?.catch?.(() => {});
      // 2026-10-02: when the card already shows this broker connected and
      // get-repair is in flight (or reused from Home), act on its answer
      // without waiting for the probe. Only the two calculate paths may run
      // before the probe returns — calculate validates the probe before it
      // shows anything. Every other path confirms the probe first, exactly
      // as before; a changed broker restarts this tap step by step.
      const earlyBroker = recentRepair ? broker : overlapBroker;
      let session = null;
      const confirmSession = async () => {
        if (session) return session;
        const probed = await probePromise;
        acceptTimingMark('broker_check_done');
        if (probed?.refreshFailed && !probed?.broker) {
          Toast.show({
            type: 'info',
            text1: 'Unable to verify broker connection',
            text2: 'Please retry. Your broker selection was not changed.',
            visibilityTime: 4500,
            position: 'bottom',
          });
          return null;
        }
        if (!probed?.broker || probed.brokerStatus !== 'connected') {
          pendingActionRef.current = {allowFresh, broker, jwtToken};
          if (probed?.broker) setOpenTokenExpireModel?.(true);
          else setBrokerModel?.(true);
          return null;
        }
        if (earlyBroker && probed.broker !== earlyBroker) {
          restartSequentialRef.current = {allowFresh, allowPendingClear};
          return null;
        }
        session = probed;
        return probed;
      };
      let result;
      if (earlyBroker) {
        result = recentRepair || (await overlappedRepair);
      } else {
        if (!(await confirmSession())) return;
        result = await runRepairCheck();
      }
      acceptTimingMark(recentRepair ? 'repair_reused_home' : 'repair_done');
      const speculate = () => {
        speculativeProbeRef.current = session || !earlyBroker
          ? null
          : {promise: probePromise, expectedBroker: earlyBroker};
      };
      if (!result || result.cancelled || result.skipped) return;
      if (result.accountRecovery?.blocked) {
        if (!(await confirmSession())) return;
        const action = result.accountRecovery.nextAction?.code;
        if (action === 'reconnect') {
          pendingActionRef.current = {allowFresh, broker, jwtToken};
          setOpenTokenExpireModel?.(true);
        } else if (action === 'review_holdings' &&
          holdingsReviewCanResolve(result.accountRecovery)) {
          setStoreModalName(modelName);
          setModelPortfolioModelId(data?.model_Id);
          await handleCheckStatus(await confirmSession());
        } else {
          // Includes `review_holdings` when a holdings edit cannot settle the
          // block. Naming the real reason beats sending the customer to a
          // screen whose only button re-triggers the same refusal.
          Toast.show({type: 'info', text1: accountRecoveryTitle(result.accountRecovery),
            text2: result.accountRecovery.message || 'Please refresh once broker verification completes.'});
        }
        return;
      }
      if (
        result?.unknown ||
        result?.unavailable ||
        result?.superseded
      ) {
        if (!(await confirmSession())) return;
        Toast.show({
          type: 'info',
          text1: `${broker || 'Broker'} temporarily slow`,
          text2: 'The remaining orders could not be verified. Nothing was changed; please try again.',
          position: 'bottom',
        });
        return;
      }

      const normalize = value =>
        String(value ?? '').replace(/_/g, ' ').trim().toLowerCase();
      const verifiedRepair = result?.models?.find(item =>
        (!item?.executionComplete || String(item.completionRecommendationId) === String(data?.model_Id)) &&
        ((item?.modelId && data?.model_Id &&
          String(item.modelId) === String(data.model_Id)) ||
        normalize(item?.modelName) === normalize(modelName)),
      );
      const discoveredFailedTrades =
        verifiedRepair?.failedTrades?.length > 0;
      if (result.pending && !verifiedRepair) {
        if (!(await confirmSession())) return;
        Toast.show({type:'info',text1:'Awaiting broker confirmation',text2:'No new orders were calculated.'});
        return;
      }
      pendingActionRef.current = null;
      if (hasVerifiedExecutionCompletion(verifiedRepair, data?.model_Id)) {
        if (!(await confirmSession())) return;
        setLocallyResolvedAligned(true);
        return;
      }
      if (verifiedRepair?.reconciliationPending || verifiedRepair?.planStatus === 'attempt_in_flight') {
        if (!(await confirmSession())) return;
        Toast.show({
          type: 'info',
          text1: 'Broker order status is pending',
          text2: verifiedRepair?.message || 'No new orders were prepared. We will refresh this automatically.',
          position: 'bottom',
        });
        return;
      }
      const requiresFreshCalculation =
        verifiedRepair?.requiresFreshRebalance === true;
      const resolvedModel = result?.resolvedModels?.find(item =>
        (item?.modelId && data?.model_Id &&
          String(item.modelId) === String(data.model_Id)) ||
        normalize(item?.modelName) === normalize(modelName),
      );

      setCalculatedPortfolioData?.(null);
      setStoreModalName(modelName);
      if (data?.model_Id) setModelPortfolioModelId(data.model_Id);
      setmatchfailed(verifiedRepair || null);
      setmatchingFailedTrades?.(verifiedRepair || null);
      if (setRebalanceExecutionStatus) {
        setRebalanceExecutionStatus(userExecution?.status);
      }

      if (discoveredFailedTrades || (verifiedRepair?.allocationReviewReady && verifiedRepair?.pendingAllocation?.plan_id)) {
        // Continue on this tap with the just-returned frozen plan; waiting for
        // React state would otherwise require a second customer tap.
        if (!(await confirmSession())) return;
        await handleAcceptClick(verifiedRepair);
        return;
      }
      if (requiresFreshCalculation) {
        if (['MODEL_REBALANCE_CHANGED', 'CAPITAL_INTENT_CHANGED'].includes(verifiedRepair?.freshRebalanceReason)) {
          Toast.show({
            type: 'info',
            text1: 'Review a fresh rebalance',
            text2: 'The model or investment amount changed. We will use reconciled holdings and cash; old Repair orders will not be retried.',
            visibilityTime: 8000,
          });
        }
        if (verifiedRepair?.freshRebalanceReason === 'HOLDINGS_RECOVERED') {
          Toast.show({
            type: 'info',
            text1: 'Portfolio verified from broker holdings',
            text2: 'Calculate a fresh rebalance. No old order will be retried.',
            visibilityTime: 8000,
          });
        }
        // Only the server's explicit allocation classification may leave
        // Repair and enter a fresh holdings/calculate flow (web parity).
        acceptTimingMark('to_check_broker');
        speculate();
        await handleCheckBroker(false, true);
        return;
      }
      if (
        !resolvedModel &&
        allowFresh &&
        !isPartiallyExecuted &&
        (!isPendingVerification || allowPendingClear) &&
        !isRepairMode
      ) {
        speculate();
        await handleAcceptClick({verifiedNoRepair: true});
        return;
      }
      if (resolvedModel) {
        if (!(await confirmSession())) return;
        await axios.put(
          `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
          {
            userEmail,
            modelName,
            model_id: data?.model_Id,
            executionStatus: 'executed',
            user_broker: resolvedModel?.userBroker || broker,
          },
          {headers: requestHeaders, timeout: 15000},
        );
        setLocallyResolvedAligned(true);
        await Promise.all([
          getUserDetails?.(),
          getModelPortfolioStrategyDetails?.({silent: true, skipRepair: true}),
        ]);
        Toast.show({
          type: 'success',
          text1: 'Portfolio already aligned',
          text2: 'No broker orders remain to be repaired.',
          position: 'bottom',
        });
        return;
      }

      if (!(await confirmSession())) return;
      Toast.show({
        type: 'info',
        text1: 'No repair result available yet',
        text2: 'No new rebalance was calculated. Please refresh and try again.',
        position: 'bottom',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not refresh Repair',
        text2: 'No new rebalance was calculated. Please try again.',
        position: 'bottom',
      });
    } finally {
      actionOpeningRef.current = false;
      speculativeProbeRef.current = null;
      setLoading(false);
      const restart = restartSequentialRef.current;
      restartSequentialRef.current = null;
      if (restart && !sequential) {
        // The probe found a different broker than the early get-repair
        // answer was for: redo this tap step by step (probe first).
        await repairDiscoveryRef.current?.({...restart, sequential: true});
      }
    }
  };
  repairDiscoveryRef.current = handleRepairDiscovery;

  const handleAcceptClick = async repairOverride => {
    try {
      const effectiveRepair = repairOverride || matchingFailedTrades;
      const hasVerifiedRepair =
        (effectiveRepair?.failedTrades?.length || 0) > 0;
      setisChangeModal(false);
      if (data?.model_Id) {
        setModelPortfolioModelId(data.model_Id);
      }
      setmatchfailed(effectiveRepair || null);
      setStoreModalName(modelName);
      // Repair already has frozen failed legs and verified holdings. Skip the
      if (effectiveRepair?.allocationReviewReady && effectiveRepair?.pendingAllocation?.plan_id) {
        const pendingAllocation = effectiveRepair.pendingAllocation;
        const buy = pendingAllocation.buy || [];
        const sell = pendingAllocation.sell || [];
        setStockTypeAndSymbol([
          ...buy.map(item => ({Symbol: item.symbol, Type: 'BUY', Exchange: item.exchange, Quantity: item.quantity})),
          ...sell.map(item => ({Symbol: item.symbol, Type: 'SELL', Exchange: item.exchange, Quantity: item.quantity})),
        ]);
        setCalculatedPortfolioData?.({
          ...pendingAllocation, buy, sell,
          _rebalanceModelName: modelName,
          _rebalanceModelId: data?.model_Id,
        });
        await handleCheckBroker(true);
        return;
      }
      // Repair already has frozen failed legs and verified holdings. Skip the
      // preference and holdings-edit screens and open the order review after
      // the normal live broker preflight.
      if (hasVerifiedRepair && !skipRepairRef.current) {
        if (setRebalanceExecutionStatus) {
          setRebalanceExecutionStatus(userExecution?.status);
        }
        await handleCheckBroker(true);
      } else {
        skipRepairRef.current = false;
        // The calculator mode is advisor-owned. The former customer choice
        // between >2% and full rebalance was redundant and is intentionally
        // skipped, matching the current web flow.
        await handleCheckBroker(false);
      }
    } catch (error) {
      console.error('Error in handleAcceptClick:', error);
      setLoading(false);
    }
  };

  // Portfolio-tab "Invest" CTA (ModelPFCard pending state) routes here: it
  // switches to the Home tab and emits this event so the matching card runs
  // the same Accept Rebalance click. Registered every render (no deps) so the
  // handler never closes over stale state; cleanup keeps it single-subscribed.
  useEffect(() => {
    const normalize = (v) => String(v ?? '').replace(/_/g, ' ').trim().toLowerCase();
    const handleOpenRebalanceFlow = (payload) => {
      // _claimed: HomeScreen can mount more than one RebalanceCard for the
      // same model (multiple sections). Listeners run synchronously on the
      // same payload object, so the first matching card claims the event —
      // otherwise every twin opens its own (stacked, touch-eating) modal.
      if (!payload?.modelName || payload._claimed) return;
      const myName = typeof modelName === 'string' ? modelName : modelName?.name;
      if (normalize(payload.modelName) === normalize(myName)) {
        payload._claimed = true;
        // Mirror the Accept Rebalance button exactly (same handler pair) —
        // handleChangeCheck opens the conditionally-mounted change-detail
        // modal, which is safe to re-open repeatedly. Jumping straight to
        // handleAcceptClick re-showed the always-mounted preference Modal,
        // which renders BLANK on re-show under the new architecture and
        // freezes the screen behind an invisible window.
        if (isRepairMode) {
          handleRepairDiscovery();
        } else if (isPendingVerification) {
          handlePendingRefresh();
        } else {
          handleChangeCheck();
        }
      }
    };
    eventEmitter.on('openRebalanceFlow', handleOpenRebalanceFlow);
    return () => {
      eventEmitter.off('openRebalanceFlow', handleOpenRebalanceFlow);
    };
  });

  const handleChangeCheck = () => {
    try {
      console.log("Here DATA----", userExecutionFinal, matchingFailedTrades);

      // Calculation data is shared by the parent modal. Clear the previous
      // portfolio before selecting this card so a direct Repair open cannot
      // inherit another model's low-balance/min-investment warning.
      setCalculatedPortfolioData?.(null);

      // Set the values regardless of whether they're defined or not
      if (setuserExecution) {
        setuserExecution(userExecutionFinal || null);
      }
      if (setmatchingFailedTrades) {
        setmatchingFailedTrades(matchingFailedTrades || null);
      }

      // Proceed with opening the change modal (no date restriction for repair/multiple executions)
      handleRepairDiscovery({allowFresh: true});
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
  const handleCheckBroker = async (openRepairDirectly = false, allocationReviewRequested = false) => {
    try {
      setLoading(true);
      const speculative = openRepairDirectly ? null : speculativeProbeRef.current;
      speculativeProbeRef.current = null;
      if (speculative) {
        // Calculate now; RebalanceAdvices validates the in-flight probe before
        // using the answer (expired -> reconnect, other broker -> restart).
        setShowCheckboxModal(false);
        acceptTimingMark('to_calculate');
        const advanced = await onReviewRebalance({
          modelName,
          modelId: data?.model_Id,
          executionStatus: userExecution?.status,
          allocationReviewRequested,
          pendingSession: speculative.promise,
          expectedBroker: speculative.expectedBroker,
          brokerReadSession: tapReadSessionRef.current || undefined,
        });
        tapReadSessionRef.current = null;
        if (advanced === 'reconnect') {
          pendingActionRef.current = {allowFresh: true, broker, jwtToken};
        } else if (advanced === 'broker_changed') {
          restartSequentialRef.current = {allowFresh: true};
        } else if (advanced === 'review_holdings') {
          await handleCheckStatus(await speculative.promise);
        }
        setLoading(false);
        return;
      }

      // Refresh broker status from API to get latest connection state
      // Same tap as the discovery probe: reuse it when it is under 30 s old
      // and proved a connected broker with live funds (2026-10-02).
      const freshStatus = await refreshBrokerStatus({
        forceNetwork: !openRepairDirectly,
        reuseWithinMs: BROKER_PROBE_REUSE_MS,
      });
      const currentBroker = freshStatus?.broker;
      const currentBrokerStatus = freshStatus?.brokerStatus;

      if (freshStatus?.refreshFailed && !currentBroker) {
        Toast.show({
          type: 'info',
          text1: 'Unable to verify broker connection',
          text2: 'Please retry. Your broker selection was not changed.',
          visibilityTime: 4500,
          position: 'bottom',
        });
        setLoading(false);
        return;
      }

      if (currentBrokerStatus !== 'connected' || !currentBroker) {
        pendingActionRef.current = {allowFresh: !openRepairDirectly, broker, jwtToken};
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
        const _fundsPreflight = openRepairDirectly
          ? {ok: true}
          : classifyFundsResponse(currentFunds, currentBrokerStatus, freshStatus?.broker || broker);
        if (_fundsPreflight.reason === 'TRANSIENT') {
          Toast.show({
            type: 'info',
            text1: `${freshStatus?.broker || broker || 'Broker'} temporarily unavailable`,
            text2: _fundsPreflight.message,
            visibilityTime: 4500,
            position: 'bottom',
          });
          setLoading(false);
          return;
        } else if (!_fundsPreflight.ok) {
          pendingActionRef.current = {allowFresh: !openRepairDirectly, broker, jwtToken};
          setShowCheckboxModal(false);
          if (setOpenTokenExpireModel) {
            setOpenTokenExpireModel(true);
          }
          setLoading(false);
          return;
        }
        {
          setShowCheckboxModal(false);
          if (openRepairDirectly) {
            setOpenRebalanceModal(true);
          } else {
            acceptTimingMark('to_calculate');
            const advanced = await onReviewRebalance({
              modelName,
              modelId: data?.model_Id,
              executionStatus: userExecution?.status,
              allocationReviewRequested,
              // Hand the probe forward so calculate does not re-probe.
              liveSession: freshStatus,
              brokerReadSession: tapReadSessionRef.current || undefined,
            });
            tapReadSessionRef.current = null;
            if (advanced === 'reconnect') {
              pendingActionRef.current = {allowFresh: true, broker, jwtToken};
            } else if (advanced === 'review_holdings') {
              await handleCheckStatus(freshStatus);
            }
          }
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error in handleCheckBroker:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const pending = pendingActionRef.current;
    if (pending && brokerStatus === 'connected' &&
        (pending.broker !== broker || pending.jwtToken !== jwtToken)) {
      pendingActionRef.current = null;
      repairDiscoveryRef.current?.(pending);
    }
  }, [brokerStatus, broker, jwtToken]);

  useEffect(() => {
    const resume = event => {
      if (!/broker connection| connect/i.test(event?.source || '')) return;
      const pending = pendingActionRef.current;
      if (!pending || actionOpeningRef.current || storeModalName !== modelName) return;
      pendingActionRef.current = null;
      repairDiscoveryRef.current?.(pending);
    };
    eventEmitter.on('refreshEvent', resume);
    return () => eventEmitter.off('refreshEvent', resume);
  });

  return (
    <View>
      <View>
        <LinearGradient
          colors={
            isRebalanceExecuted
              ? [designColor('9ca3af'), designColor('6b7280')]
              : isPartiallyExecuted
                ? [designColor('2a2a2a'), designColor('de8846')]
                : isPendingVerification
                  ? [designColor('2a2a2a'), designColor('d4a843')]
                  : isRepairMode
                    ? [designColor('2a2a2a'), designColor('de8846')]
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
                        isRepairMode
                          ? designColor('fff')
                          : designColor('fff'),
                    },
                  ]}>
                  <Text
                    style={{
                      color: designColor('fff'),
                      fontFamily: designFont('Satoshi-Regular'),
                    }}></Text>
                  {(() => {
                    const plainOverview = stripHtml(overView);
                    return plainOverview.length > 50
                      ? isExpanded
                        ? plainOverview
                        : `${plainOverview.substring(0, 50)}...`
                      : plainOverview;
                  })()}
                  {stripHtml(overView).length > 50 && (
                    <Text
                      onPress={openModal}
                      style={{
                        fontFamily: designFont('Satoshi-Regular'),
                        color: designColor('4b8cee'),
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
                  isRepairMode
                    ? designColor('fff')
                    : designColor('fff'),
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
                style={[styles.logo, { tintColor: designColor('ffffff') }]}
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
                  color: designColor('dbd8d8'),
                  fontSize: 12,
                  fontFamily: designFont('Satoshi-Medium'),
                  marginRight: 10,
                }}>
                Minimum Investment Required
              </Text>
              <Text
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: 14,
                  fontFamily: designFont('Satoshi-Bold'),
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
                <Text style={{color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: designFont('Satoshi-Medium')}}>
                  No actions required
                </Text>
              </View>
            </View>
          )}
          {isPartiallyExecuted && (
            <View style={{alignItems: 'center', marginBottom: 4, marginTop: 4}}>
              <View style={{backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12}}>
                <Text style={{color: designColor('de8846'), fontSize: 12, fontFamily: designFont('Satoshi-Medium')}}>
                  Partially Executed
                </Text>
              </View>
            </View>
          )}
          {isSellRetryPhase && (
            <View style={{alignItems: 'center', marginBottom: 4, marginTop: 4}}>
              <View style={{backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12}}>
                <Text style={[tokens.typography.caption, {color: tokens.colors.text.inverse, fontSize: 12}]}>
                  Retry failed orders
                </Text>
              </View>
            </View>
          )}
          {isPendingVerification && (
            <View style={{alignItems: 'center', marginBottom: 4, marginTop: 4}}>
              <View style={{backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12}}>
                <Text style={{color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: designFont('Satoshi-Medium')}}>
                  Awaiting Broker Confirmation
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
              onPress={
                isRepairMode
                  ? () => handleRepairDiscovery()
                  : isPendingVerification
                    ? handlePendingRefresh
                    : needsRepairDiscovery
                    ? handleRepairDiscovery
                    : handleChangeCheck
              }
              disabled={loading || pendingRefreshLoading || isRebalanceExecuted}
              style={[
                styles.button,
                isPendingVerification && {borderWidth: 1, borderColor: designColor('eab308')},
                isRebalanceExecuted && {backgroundColor: designColor('d1d5db')},
              ]}>
              {loading || pendingRefreshLoading ? (
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
                  <ActivityIndicator size={14} color={gradient2} />
                  <Text style={[styles.buttonText, {color: gradient2, marginLeft: 6}]}>Checking broker...</Text>
                </View>
              ) : (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignContent: 'center',
                    alignItems: 'center',
                    alignSelf: 'center',
                  }}>
                  <Text style={[styles.buttonText, {color: isRebalanceExecuted ? designColor('6b7280') : gradient2}]}>
                    {isRebalanceExecuted
                      ? 'Rebalance Executed'
                      : requiresFreshRebalance
                        ? 'Review Allocation'
                      : isRepairMode
                        ? isSellRetryPhase ? 'Review Failed Orders' : 'Repair Portfolio'
                      : isPartiallyExecuted
                        ? 'Retry Rebalance'
                        : isPendingVerification
                          ? 'Refresh Order Status'
                          : 'Accept Rebalance'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
      {modalVisible && <Modal
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
            {typeof overView === 'string' && /<[a-z][\s\S]*>/i.test(overView) ? (
              <RenderHTML
                contentWidth={screenWidth - 80}
                source={{html: overView}}
                baseStyle={styles.readMoreModalText}
              />
            ) : (
              <Text style={styles.readMoreModalText}>{overView}</Text>
            )}
          </View>
        </View>
      </Modal>}
      {modalVisibleDetails && <RebalanceDetailsModal
        visible={modalVisibleDetails}
        onClose={() => setModalVisibleDetails(false)}
        data={rebalanceDetails || {}}
      />}
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
        onClose={() => {
          setShowPendingModal(false);
          setCancelError(null);
        }}
        orders={pendingOrders}
        attemptedAt={pendingAttempt?.attemptedAt}
        broker={broker}
        onCancelAndRetry={handleCancelAndRetry}
        onRetryOnly={handleRetryOnly}
        cancelLoading={cancelRetryLoading}
        cancelError={cancelError}
        onRefresh={handlePendingRefresh}
        refreshLoading={pendingRefreshLoading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    paddingVertical: 20,
    borderRadius: 15,
    shadowColor: designColor('000'),
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
  viewMoreText: {color: designColor('fff'), fontSize: 12, fontFamily: designFont('Poppins-Medium')},
  textContent: {
    flex: 1,
  },
  titleText: {
    color: designColor('ffffff'),
    fontSize: 18,
    fontFamily: designFont('Poppins-SemiBold'),
    marginBottom: 5,
  },
  subText: {
    fontSize: 10,
    fontFamily: designFont('Satoshi-Regular'),
  },
  rebalanceText: {
    fontSize: 12,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    color: designColor('fff'),
    marginTop: 2,
    fontFamily: designFont('Poppins-Regular'),
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
    color: designColor('ffffff'),
    fontSize: 11,
    fontFamily: designFont('Satoshi-Regular'),
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
    color: designColor('002651'),
    fontSize: 12,
    fontFamily: designFont('Poppins-Medium'),
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
    shadowColor: designColor('000'),
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
    color: designColor('111827'),
  },
  optionsContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  optionCard: {
    backgroundColor: designColor('f8f9fa'),
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOptionCard: {
    borderColor: designColor('3b82f6'),
    backgroundColor: designColor('eff6ff'),
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
    color: designColor('111827'),
    lineHeight: 20,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 12,
    color: designColor('6b7280'),
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
    backgroundColor: designColor('f3f4f6'),
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: designColor('374151'),
    fontWeight: '500',
    fontSize: 14,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: designColor('3b82f6'),
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
    fontFamily: designFont('Poppins-Bold'),
  },
  readMoreModalText: {
    fontSize: 12,
    textAlign: 'left',
    color: designColor('858585'),
    marginBottom: 20,
    fontFamily: designFont('Satoshi-Regular'),
  },
});

export default RebalanceCard;
