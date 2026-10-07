import {availableFundsOptions, fundingPanelCopy, getFundingReview, insufficientFundsAttemptOptions} from '../../utils/fundingContinuation';
import { isPublisherExecutionComplete, includeUnconfirmedPublisherLegs } from '../../utils/publisherCompletionAuthority';
import {createPublisherBatchDispatcher} from '../../utils/publisherBatchDispatch';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {PUBLISHER_ACK_TIMEOUT_MS, isPublisherActivationAcknowledged} from '../../utils/publisherAcknowledgement';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { XIcon, CandlestickChartIcon, AlertOctagon, CheckIcon, AlertTriangle } from 'lucide-react-native';
import server from '../../utils/serverConfig';
import IsMarketHours from '../../utils/isMarketHours';
import { computeTradeVariant } from '../../utils/tradeVariant';
import {canAttemptRebalancePlacement} from '../../utils/rebalanceMarketGate';
import { useConfig } from '../../context/ConfigContext';
import axios from 'axios';
import DummyBrokerHoldingConfirmation from './DummyBrokerHoldingConfirmation';
import Config from 'react-native-config';
import { generateToken } from '../../utils/SecurityTokenManager';
import WebView from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import eventEmitter from '../../components/EventEmitter';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';
import {
  buildBrokerPayloadFields,
  defaultDecrypt,
  isBrokerAuthError,
  detectTransientOrderWindowError,
  isCautionaryListingMessage,
  isInsufficientFundsMessage,
  isPendingSellAuthorizationCalculation,
} from '../../utils/rebalanceHelpers';
import useModalStore from '../../GlobalUIModals/modalStore';
import { designColor, designFont } from '../../design/literalTokens';
const { height: screenHeight } = Dimensions.get('window');
import StepProgressBar from '../../UIComponents/RebalanceAdvicesUI/StepProgressBar';
import { useTrade } from '../../screens/TradeContext';
import Toast from 'react-native-toast-message';
import debounce from 'lodash.debounce';
import { isOrderSuccess, isOrderRejected } from '../../utils/orderStatusUtils';
import useAngelOneSurveillance from '../../hooks/useAngelOneSurveillance';
import SurveillanceWarning from '../SurveillanceWarning';
import { validateBrokerSession } from '../../utils/brokerSessionUtils';
import { validateStockExchanges, convertToBasketItem, enrichPublisherLegPrices, fetchFreshKiteProtectionPrices, getPublisherWebViewBaseUrl, resolveZerodhaSymbol, createBatches, createModelPortfolioPublisherBatches, voidUnsentPublisherRecos } from '../../utils/brokerPublisher';
import useZerodhaSymbolMap from '../../hooks/useZerodhaSymbolMap';
import useKitePublisherPolling from '../../hooks/useKitePublisherPolling';
import useKiteHandoffGuard from '../../hooks/useKiteHandoffGuard';
import {executionBundleHeaders, handleStaleExecutionBundle} from '../../utils/executionBundleSafety';
import {accountRecoveryMetadata} from '../../utils/accountRecoveryUx';
import {summarizeFundingPendingLegs} from '../../utils/fundPendingGap';
import {recordFundPendingInstruction} from '../../services/ModelPortfolioService';
import {
  createZerodhaPublisherAttempt,
  parseKiteRedirectStatus,
  resolvePublisherSettlement,
} from '../../utils/publisherOutcome';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import { convertResponse } from '../../utils/tradeUtils';
import { isZerodhaSellAuthorized } from '../../utils/zerodhaDdpiGate';
import {hasExplicitSellAuthRejection} from '../../utils/sellAuthMessage';
import {isDhanSellAuthorizationReady} from '../../utils/dhanEdis';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import useSdkClient from '../../sdk/useSdkClient';
import LowFundsRebalanceWarning from '../LowFundsRebalanceWarning';
import PublisherWebViewOverlay from '../PublisherWebViewOverlay';
import {isPostSellCashUsable} from '../../utils/rebalanceReconciliation';
import { resolveRebalancePlanCorrelation } from '../../utils/rebalancePlanCorrelation';
import {planRefusalMessage} from '../../utils/planRefusalMessage';
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import {
  SELL_GATE_POLL_INTERVAL_MS,
  SELL_GATE_TIMEOUT_MS,
  annotateSettlementRiskResults,
  canOfferSettlementProceed,
  estimateProtectedBuyCost,
  evaluateSellBatchOrders,
  extractAvailableCash,
} from '../../utils/zerodhaSellFundingGate';
import {
  canExecuteRebalance,
  getRebalanceBlockReason,
  getRebalanceContract,
} from '../../utils/rebalanceContract';

const isSdkExecuteAdviceEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_EXECUTE_ADVICE || '').trim().toLowerCase();
  return v === 'true' || v === '1';
};

const RebalanceModal = ({
  userEmail,
  visible,
  setOpenRebalanceModal,
  data,
  calculatedPortfolioData,
  recalculateRebalance,
  broker,
  apiKey,
  userDetails,
  jwtToken,
  secretKey,
  clientCode,
  sid,
  serverId,
  viewToken,
  setOpenSucessModal,
  setOrderPlacementResponse,
  // Optional — sibling setter for the outgoing trade list at submit
  // time. Lets RecommendationSuccessModal recover `variant` per row when
  // ccxt-india doesn't echo it (rebalance/MP lane). See
  // utils/tradeVariant.js § resolveResultVariant.
  setLastSubmittedTrades,
  modelPortfolioModelId,
  modelPortfolioRepairTrades,
  getRebalanceRepair,
  storeModalName,
  getModelPortfolioStrategyDetails,
  setShowAngleOneTpinModel,
  setShowFyersTpinModal,
  setShowDhanTpinModel,
  setShowOtherBrokerModel,
  setIsReturningFromOtherBrokerModal,
  isReturningFromOtherBrokerModal,
  rebalanceExecutionStatus,
  edisStatus,
  dhanEdisStatus,
  setShowDdpiModal,
  getUserDeatils,
  publisherBuyContinuation,
  onPublisherContinuationConsumed,
}) => {
  const { brokerStatus, configData } = useTrade();
  const openBrokerModal = useModalStore(state => state.openModal);
  // Hoist `allowAfterHoursOrders` to the top of the component body so it's
  // in scope for the trade `variant` computations in the submit handlers
  // below. There used to be a second `useConfig()` destructure further down
  // (used by the `marketGateOpen` review-trade gate) — that's been removed
  // since both refer to the same value. See docs/APP_ARCHITECTURE.md
  // § 4.5.2 Trade variant field.
  const { allowAfterHoursOrders, rebalanceFreezePlan, repairFreezePlan } = useConfig() || {};
  const brokerAfterHoursOrdersAllowed = canAttemptRebalancePlacement({
    broker,
    marketOpen: false,
    allowAfterHoursOrders,
  });

  const sdkClient = useSdkClient();
  const sdkExecuteAdviceEnabled = isSdkExecuteAdviceEnabled() && !!sdkClient;
  const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
  // Add fallback for API key
  let zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY || Config?.REACT_APP_ZERODHA_API_KEY;
  if (!zerodhaApiKey) {
    console.log('[RebalanceModal] WARNING: API key not found!');
  } else {
    console.log('[RebalanceModal] Using API key:', zerodhaApiKey.substring(0, 4) + '...');
  }
  const angelOneApiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;

  // Zerodha WebView state
  const webViewRef = useRef(null);
  const [webView, setWebView] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const publisherWebViewBaseUrl = getPublisherWebViewBaseUrl(configData);
  const publisherWebViewSource = useMemo(
    () => ({html: htmlContent, baseUrl: publisherWebViewBaseUrl}),
    [htmlContent, publisherWebViewBaseUrl],
  );
  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  const [zerodhaRequestType, setZerodhaRequestType] = useState(null);

  // Two-phase publisher batch queue (sells → buys) — mirrors web's Fix C
  // (prod brokerPublisher.js `separateSellsFromBuys`, 2026-06-24) + the
  // terminal-batch polling gate (web §16.ac, 2026-08-06 moneyman/vgangan).
  // SELL quantities must broker-complete before BUY baskets are exposed.
  // Refreshed margin is checked next; a verified settlement shortfall is an
  // explicit customer choice, and record-back preserves any rejected buys for
  // Repair. Only the TERMINAL batch can settle the publisher run.
  const pendingKiteBatchesRef = useRef([]);
  const currentKiteBatchIndexRef = useRef(0);
  const batchAdvancingRef = useRef(false);
  const advanceKiteBatchRef = useRef(null);
  const publisherGateCancelledRef = useRef(false);
  const settlementRiskAcceptedRef = useRef(false);
  const publisherLaunchPendingRef = useRef(false);
  const publisherIntentFiredRef = useRef(false);
  const publisherFullLegsRef = useRef([]);
  const publisherBatchDispatcherRef = useRef(createPublisherBatchDispatcher());
  const publisherAttemptRef = useRef(null);
  const publisherContinuationContextRef = useRef(null);
  const publisherContinuationLaunchRef = useRef(null);
  const orderActionInFlightRef = useRef(false);
  const kiteHandoff = useKiteHandoffGuard({
    visible: webView,
    webViewRef,
    configData,
    flow: 'model_rebalance',
    attemptId: publisherAttemptRef.current?.attemptId,
  });

  useEffect(() => {
    publisherIntentFiredRef.current = false;
    publisherAttemptRef.current = null;
  }, [calculatedPortfolioData?.uniqueId, calculatedPortfolioData?.unique_id,
      calculatedPortfolioData?.plan_id]);

  const publisherHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
    ...executionBundleHeaders(),
  });

  const recordPublisherIntent = async (publisherLegs, attempt, activationLegs, activationId) => {
    publisherIntentFiredRef.current = true;
    try {
      const continuationContext = publisherContinuationContextRef.current || {};
      const context = {
        source: 'mobile-active-rebalance',
        attemptId: attempt.attemptId,
        modelId: continuationContext.modelId || modelPortfolioModelId,
        modelName: continuationContext.modelName || storeModalName,
        advisor: continuationContext.advisor || advisorTag,
        uniqueId: continuationContext.uniqueId || additionalPayload.unique_id || null,
        planId: continuationContext.planId || additionalPayload.plan_id || null,
      };
      const nodeResponse = await axios.post(
        `${server.server.baseUrl}api/process-trades/execution-intent`,
        {
          userEmail,
          broker: 'Zerodha',
          flow: 'rebalance',
          lifecycle: 'popup_opened',
          attemptId: attempt.attemptId,
          context,
          legs: publisherLegs,
        },
        {timeout: PUBLISHER_ACK_TIMEOUT_MS, headers: publisherHeaders()},
      );
      if (
        !nodeResponse?.data?.intentId ||
        nodeResponse?.data?.attemptId !== attempt.attemptId ||
        nodeResponse?.data?.payloadMismatch
      ) {
        throw new Error('Execution session acknowledgement was incomplete');
      }

      const reconciliation = await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/publisher/intent`,
        {
          unique_id: continuationContext.uniqueId || additionalPayload.unique_id,
          user_email: userEmail,
          user_broker: 'Zerodha',
          modelName: continuationContext.modelName || storeModalName,
          model_id: continuationContext.modelId || modelPortfolioModelId,
          advisor: continuationContext.advisor || advisorTag,
          legs: publisherLegs,
          kind: 'rebalance',
          attempt_id: attempt.attemptId,
          plan_id: continuationContext.planId || additionalPayload.plan_id || null,
          plan_version: additionalPayload.plan_version ?? null,
          prepare_only: false,
          activation_legs: activationLegs,
          activation_id: activationId,
        },
        {timeout: PUBLISHER_ACK_TIMEOUT_MS, headers: publisherHeaders()},
      );
      if (!isPublisherActivationAcknowledged(reconciliation?.data) ||
          reconciliation?.data?.dispatchReserved !== true || reconciliation?.data?.activationId !== activationId) {
        throw new Error('Publisher reconciliation was not durably enrolled');
      }
      return true;
    } catch (error) {
      publisherIntentFiredRef.current = false;
      // Refused before the dispatch boundary — nothing reached the broker, so
      // the reco rows this attempt just wrote must not reach the Orders screen.
      await voidUnsentPublisherRecos({
        legs: activationLegs,
        email: userEmail,
        headers: publisherHeaders(),
        error,
      });
      await handleStaleExecutionBundle(error);
      throw error;
    }
  };

  const fetchPublisherAttemptStatus = async ({
    publisherFinished = false,
    submittedSide = 'SELL',
  } = {}) => {
    const attemptId = publisherAttemptRef.current?.attemptId;
    if (!attemptId) return null;
    const response = await axios.post(
      `${server.server.baseUrl}api/zerodha/publisher/attempt-status`,
      {userEmail, attemptId, publisherFinished, submittedSide},
      {timeout: 15000, headers: publisherHeaders()},
    );
    return response?.data || null;
  };

  // Publisher order-book polling fallback for Kite Publisher WebView
  // callback misses. Canonical implementation lives in
  // `src/hooks/useKitePublisherPolling.js` — see
  // docs/REBALANCING.md § Kite Publisher polling fallback for the
  // full contract (failure modes, double-fire protection, layer-2
  // server-side `add-user/status-check-queue` fallback). The hook keeps
  // detected-order and timeout outcomes distinct; only a detected order
  // is publisher success, while timeout triggers an unconfirmed final check.
  const {
    start: startOrderPolling,
    stop: stopOrderPolling,
    getNewOrders: getNewPublisherOrders,
  } = useKitePublisherPolling({
    broker,
    brokerCreds: { clientCode, apiKey, jwtToken, secretKey, sid, serverId },
    configData,
    onPublisherSettled: async settlement => {
      const publisherStatus = resolvePublisherSettlement(settlement);
      // TWO-PHASE GATE (2026-08-06, moneyman/vgangan web incident ported to
      // mobile): while more Kite baskets remain in the queue, a detected order
      // for a PREVIOUS side must NOT settle the whole run — that stamped
      // never-placed buys as "sent". Delegate to the shared advance function;
      // it returns true only when it advanced to the next batch. A TIMEOUT
      // must never advance (it is "unconfirmed", not "that side is done"), so
      // only `orders-detected` (publisherStatus === 'success') advances. If
      // nothing is left (terminal batch) or the settlement isn't a detected
      // order, fall through to the normal record-back path.
      if (publisherStatus === 'success') {
        const advanced =
          advanceKiteBatchRef.current &&
          (await advanceKiteBatchRef.current({newOrders: settlement?.newOrders || []}));
        if (advanced) return;
      }
      if (publisherStatus !== 'success') {
        Toast.show({
          type: 'info',
          text1: 'Waiting for Zerodha confirmation',
          text2: 'Complete login and review in Kite, or close to cancel.',
          visibilityTime: 6000,
        });
        return;
      }
      setWebView(false);
      setZerodhaStatus(publisherStatus);
      setZerodhaRequestType('rebalance');
    },
  });
  console.log("Calculated Portfolio Data---", calculatedPortfolioData);

  // Calculation state lives in the parent and is reused by this modal. Only
  // render calculation-level warnings when the response is tagged for the
  // portfolio currently open; repair rows have their own status metadata.
  const calculationMatchesPortfolio = Boolean(
    calculatedPortfolioData &&
      ((calculatedPortfolioData?._rebalanceModelId &&
        String(calculatedPortfolioData._rebalanceModelId) ===
          String(modelPortfolioModelId)) ||
        (calculatedPortfolioData?._rebalanceModelName &&
          String(calculatedPortfolioData._rebalanceModelName).trim() ===
            String(storeModalName || '').trim())),
  );
  // Repair rows are the Repair authority (see isRepairMode below). When they
  // are shown, a calculation still held by the parent belongs to the attempt
  // that produced them: its plan was already sent, so neither its plan_id nor
  // its funding/warning metadata may describe this screen. Re-sending it was
  // refused `409 PLAN_ALREADY_CONSUMED` (moneyman ICICI, 7 Oct 2026).
  const matchingRepairTrade =
    modelPortfolioRepairTrades &&
    modelPortfolioRepairTrades?.find(
      trade => trade.modelId === modelPortfolioModelId,
    );

  const repairStatus =
    matchingRepairTrade &&
    matchingRepairTrade.failedTrades &&
    matchingRepairTrade.failedTrades.length > 0;

  const activeCalculatedPortfolioData =
    calculationMatchesPortfolio && !repairStatus
      ? calculatedPortfolioData
      : null;
  const rebalanceContract = getRebalanceContract(activeCalculatedPortfolioData);
  const fundingConsent = getFundingReview(rebalanceContract, activeCalculatedPortfolioData);

  // Parse skipped stocks message
  const skippedStocksMessage = activeCalculatedPortfolioData?.message;
  const hasSkippedStocks =
    skippedStocksMessage &&
    skippedStocksMessage.includes('Stocks not bought due to low allowed balance');

  const skippedStocksList = hasSkippedStocks
    ? skippedStocksMessage
      .split('Stocks not bought due to low allowed balance:')[1]
      ?.split(',')
      .map(s => s.trim())
      .filter(s => s)
    : [];

  // Get minimum investment from model portfolio data
  const minInvestment = activeCalculatedPortfolioData?.minInvestmentValue;
  console.log("min investment", minInvestment)
  const [currentStep, setCurrentStep] = useState(3);
  const stepsData = [1, 2, 3];

  // NEW: Check if broker is disconnected
  const isBrokerDisconnected =
    brokerStatus === 'Disconnected' || brokerStatus === undefined;

  const [editableData, setEditableData] = useState([]);

  const additionalFundsRequired = Math.max(
    0,
    Number(activeCalculatedPortfolioData?.additionalFundsRequired) || 0,
  );
  const fundingGapToday = Math.max(
    0,
    Number(activeCalculatedPortfolioData?.fundingGapToday) || 0,
  );
  const deferredSellProceeds = Math.max(
    0,
    Number(activeCalculatedPortfolioData?.marginProjection?.deferredSellProceeds) || 0,
  );
  const t1RiskBuys = activeCalculatedPortfolioData?.t1RiskBuys ||
    activeCalculatedPortfolioData?.marginProjection?.t1RiskBuys || [];
  const t1RiskCost = Math.max(
    0,
    Number(activeCalculatedPortfolioData?.t1RiskCost) ||
      Number(activeCalculatedPortfolioData?.marginProjection?.t1RiskCost) ||
      0,
  );
  // The funding banner must quote the MODEL-ADMITTED buying power the
  // calculator actually fitted the basket to, not whole-account broker cash
  // that may belong to another portfolio. Quoting `liveAvailableCash` told
  // testaccount/agust test portfolio (2026-09-17) the basket was "limited to
  // verified buying power of ₹367.30" while the real gate was ₹35.91 — which
  // reads as a broken calculation. Mirrors the web fallback chain in
  // prod-alphaquark-github UpdateRebalanceModal.js. When none of these are
  // present the banner omits the amount rather than showing a wrong one.
  const displayAvailableCash =
    activeCalculatedPortfolioData?.marginProjection?.estBuyingPowerToday ??
    activeCalculatedPortfolioData?.marginProjection
      ?.estBuyingPowerAfterSettlement ??
    activeCalculatedPortfolioData?.calculationCashAvailable ??
    activeCalculatedPortfolioData?.verifiedModelCash;
  const allocationExplanation =
    activeCalculatedPortfolioData?.rebalanceContract?.allocation ||
    activeCalculatedPortfolioData?.allocationExplanation;
  const showUnaffordableTargetsExplanation =
    allocationExplanation?.code === 'TARGET_SHARES_UNAFFORDABLE';
  const formatAllocationMoney = value =>
    Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });


  // NEW: State for DummyBroker modal
  const [showDummyBrokerModal, setShowDummyBrokerModal] = useState(false);

  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState();
  const [reducingFunding, setReducingFunding] = useState(false);

  const retryAfterAddingFunds = async () => {
    if (typeof recalculateRebalance !== 'function') {
      return;
    }
    try {
      setLoading(true);
      await recalculateRebalance();
    } finally {
      setLoading(false);
    }
  };

  const showAddFundsInstructions = () => {
    Alert.alert(
      `Add balance to ${broker || 'your broker'}`,
      `Add at least ₹${Number(fundingConsent?.shortfall || 0).toLocaleString('en-IN')} to your ${broker || 'broker'} account. Once the balance is available, return here and retry the rebalance.\n\nYour investment amount will remain unchanged.`,
      [
        {text: 'Not now', style: 'cancel'},
        {text: "I've added funds — Retry", onPress: retryAfterAddingFunds},
      ],
    );
  };

  const [fundingPlanToReplace, setFundingPlanToReplace] = useState(null);

  const continueWithAvailableFunds = async () => {
    if (reducingFunding) return;
    try {
      setReducingFunding(true);
      setFundingPlanToReplace(rebalanceContract?.plan?.id || null);
      await recalculateRebalance(availableFundsOptions());
    } catch (error) {
      Alert.alert('Could not refresh calculation', 'Your investment target is unchanged. Please try again.');
    } finally {
      setReducingFunding(false);
    }
  };

  const attemptWithInsufficientFunds = async () => {
    if (reducingFunding) return;
    try {
      setReducingFunding(true);
      setFundingPlanToReplace(rebalanceContract?.plan?.id || null);
      await recalculateRebalance(insufficientFundsAttemptOptions());
    } catch (error) {
      Alert.alert('Could not prepare orders', 'No orders were placed. Your investment target is unchanged. Please try again.');
    } finally {
      setReducingFunding(false);
    }
  };

  const showFundingDecision = () => {
    const canContinue = fundingConsent?.canContinueWithAvailableFunds === true;
    const canAttempt = fundingConsent?.canAttemptWithInsufficientFunds === true;
    Alert.alert(
      rebalanceContract?.presentation?.title || 'Investment amount needs review',
      `Your full plan needs ₹${Number(fundingConsent?.desiredAmount || 0).toLocaleString('en-IN')} but only ₹${Number(fundingConsent?.fundedAmount || 0).toLocaleString('en-IN')} is available today (cash + sale proceeds). Add ₹${Number(fundingConsent?.shortfall || 0).toLocaleString('en-IN')}${canContinue ? ' to include everything, or continue with available funds for this calculation' : canAttempt ? ', or review the target stocks and attempt the buy. The broker may reject orders that exceed your buying power' : ' to your broker, then calculate again'}. Your investment target stays unchanged.`,
      canContinue
        ? [
            {text: 'Not now', style: 'cancel'},
            {text: 'Add funds instead', onPress: showAddFundsInstructions},
            {text: 'Continue with available funds', onPress: continueWithAvailableFunds},
          ]
        : canAttempt
          ? [
              {text: 'Not now', style: 'cancel'},
              {text: 'How to add funds', onPress: showAddFundsInstructions},
              {text: 'Review stocks and attempt buy', onPress: attemptWithInsufficientFunds},
            ]
          : [
            {text: 'Not now', style: 'cancel'},
            {text: 'How to add funds', onPress: showAddFundsInstructions},
          ],
    );
  };

  const ensureRebalanceExecutable = () => {
    if (reducingFunding || (fundingPlanToReplace && fundingPlanToReplace === rebalanceContract?.plan?.id)) {
      Alert.alert('Refresh calculation', 'Please retry Calculate and review the new basket before accepting.');
      return false;
    }
    if (canExecuteRebalance(activeCalculatedPortfolioData)) {
      return true;
    }
    if (fundingConsent?.required) {
      showFundingDecision();
    } else {
      Toast.show({
        type: 'info',
        text1: rebalanceContract?.presentation?.title || 'Rebalance needs attention',
        text2:
          rebalanceContract?.customerAction?.label ||
          getRebalanceBlockReason(activeCalculatedPortfolioData),
      });
    }
    return false;
  };

  const filteredData = data.filter(item => item.model_name === storeModalName);

  // Check if modelPortfolioRepairTrades exists and has trades
  let dataArray = [];
  // Failed frozen-plan legs are the Repair authority. Do not depend on the
  // subscriber-status projection: it may be absent or reset to `toExecute`
  // while these broker-verified legs still require direct repair.
  const isRepairMode = repairStatus;
  // P3.2 (2026-09-23) — on a Repair the customer may take FEWER shares on a
  // BUY than the advisor approved. A frozen BUY they cannot afford is rejected
  // WHOLE by the broker (a liquidation into one instrument has no tail leg to
  // drop), and Repair then re-offers the same unaffordable quantity forever.
  // Keyed by symbol; absent = take the approved quantity, so this stays inert
  // until the customer types. ccxt clamps DOWN only and ignores anything at or
  // above the frozen quantity, so the advisor's number is the ceiling on both
  // sides of the wire.
  const [customerQty, setCustomerQty] = useState({});

  const repairApprovedQty = item => {
    const n = Number(item?.qty);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };

  // BUY only: a short SELL strands the proceeds the paired BUY is sized
  // against -- the exact failure this exists to prevent -- and leaves the
  // customer holding stock the model has exited.
  const isRepairQtyEditable = item =>
    isRepairMode &&
    String(item?.orderType || '').toUpperCase() === 'BUY' &&
    repairApprovedQty(item) > 0;

  const repairChosenQty = item => {
    const approved = repairApprovedQty(item);
    const chosen = customerQty[item?.symbol];
    return chosen == null ? approved : Math.min(chosen, approved);
  };

  const handleRepairQtyChange = (item, raw) => {
    const approved = repairApprovedQty(item);
    const parsed = parseInt(raw, 10);
    const next = Number.isFinite(parsed)
      ? Math.max(0, Math.min(parsed, approved))
      : approved;
    setCustomerQty(prev => ({...prev, [item.symbol]: next}));
  };

  // Only genuine reductions travel. An untouched row, or one typed back up to
  // the approved quantity, sends nothing at all.
  const customerReductionPayload = () =>
    Object.entries(customerQty)
      .map(([symbol, quantity]) => {
        const row = (dataArray || []).find(x => x?.symbol === symbol);
        if (!row || !isRepairQtyEditable(row)) return null;
        const approved = repairApprovedQty(row);
        const q = Math.max(0, Math.min(Number(quantity), approved));
        return q < approved
          ? {symbol, transactionType: 'BUY', quantity: q}
          : null;
      })
      .filter(Boolean);
  // FUNDING_PENDING summary (Phase 2). Computed from the raw failed trades so
  // it is available before dataArray is assembled below.
  const fundingPending = summarizeFundingPendingLegs(
    isRepairMode
      ? (matchingRepairTrade?.failedTrades || []).map(trade => ({
          symbol: trade?.advSymbol,
          qty: parseInt(trade?.advQTY, 10),
          orderType: String(trade?.transactionType || '').toUpperCase(),
          isFundingPending: !!trade?.isFundingPending,
          fundingRequired: trade?.fundingRequired,
          frozenPrice: trade?.frozenPrice,
        }))
      : [],
  );
  const [fundPendingRecording, setFundPendingRecording] = useState(false);
  const [fundPendingRecorded, setFundPendingRecorded] = useState(false);
  const recordFundPendingGap = async () => {
    if (fundPendingRecording || !(fundingPending.total > 0)) return;
    setFundPendingRecording(true);
    try {
      await recordFundPendingInstruction(
        {
          userEmail,
          userBroker: broker || 'DummyBroker',
          modelName: storeModalName,
          modelId: modelPortfolioModelId,
          advisor: advisorTag,
          gapAmount: fundingPending.total,
        },
        configData,
      );
      setFundPendingRecorded(true);
      Toast.show({
        type: 'success',
        text1: 'Funding instruction recorded',
        text2: `Transfer ₹${Math.ceil(fundingPending.total).toLocaleString('en-IN')} to your broker, then tap Repair.`,
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not record the funding instruction',
        text2: error?.response?.data?.message || error?.message || 'Please try again.',
      });
    } finally {
      setFundPendingRecording(false);
    }
  };
  if (isRepairMode) {
    dataArray =
      matchingRepairTrade?.failedTrades
        ?.filter((trade) => !trade?.advSymbol?.includes("CASH-EQ"))
        ?.map((trade) => ({
          symbol: trade?.advSymbol,
          qty: parseInt(trade?.advQTY, 10),
          orderType: trade?.transactionType.toUpperCase(),
          exchange: trade?.advExchange,
          zerodhaTradeId: trade?.zerodhaTradeId,
          token: trade?.token ? trade?.token : "",
          // Carry original-rejection fields through to row-render so the
          // cautionary / LOW_FUNDS chip can be marked per-row. ccxt-india
          // `rebalancing/utils/db_manager.repair()` populates these from
          // `order_results[i]` on the latest advice. See
          // docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g.
          orderStatusMessage: trade?.orderStatusMessage || '',
          classification: trade?.classification,
          // Repair metadata for the row tooltip / "what was filled vs
          // requested" affordance (partial-fill case from db_manager).
          originalQty: trade?.originalQty,
          filledQty: trade?.filledQty,
          isPartialFill: trade?.isPartialFill,
          isDeferredT1: !!trade?.isDeferredT1,
          deferredReason: trade?.deferredReason,
          // FUNDING_PENDING (Phase 2, 2026-09-20): an exact frozen quantity
          // the last plan could not fund even after settlement. Placed by
          // Repair once broker cash covers it; never recomputed.
          isFundingPending: !!trade?.isFundingPending,
          fundingRequired: trade?.fundingRequired,
          frozenPrice: trade?.frozenPrice,
          sourcePlanId: trade?.sourcePlanId,
        })) || [];
  } else if (activeCalculatedPortfolioData && activeCalculatedPortfolioData?.length !== 0) {
    dataArray =
      activeCalculatedPortfolioData?.length !== 0
        ? [
          ...(activeCalculatedPortfolioData?.sell
            ?.filter((item) => !item?.symbol?.includes("CASH-EQ"))
            ?.map((item) => ({
              symbol: item.symbol,
              token: item?.token ? item?.token : "",
              qty: item.quantity,
              orderType: "SELL",
              exchange: item.exchange,
              zerodhaTradeId: item.zerodhaTradeId,
              rebalancePrice: item.rebalance_price,
              settledQuantity: item.settledQuantity,
              t1Quantity: item.t1Quantity,
              sameDayCredit: item.sameDayCredit,
            })) || []),
          ...(activeCalculatedPortfolioData?.buy
            ?.filter((item) => !item?.symbol?.includes("CASH-EQ"))
            ?.map((item) => ({
              symbol: item.symbol,
              token: item?.token ? item?.token : "",
              qty: item.quantity,
              orderType: "BUY",
              exchange: item.exchange,
              zerodhaTradeId: item.zerodhaTradeId,
              rebalancePrice: item.rebalance_price,
            })) || []),
        ]
        : [];
  }

  // Angel One pre-trade surveillance (web parity: UpdateRebalanceModal).
  // Run only after the current model's rows have been derived; referring to
  // dataArray above its declaration crashes the screen during initialization.
  const {surveillanceStocks} = useAngelOneSurveillance({
    broker,
    stocks: dataArray,
    enabled: visible,
    configData,
  });

  // Scripmaster-corrected symbol/exchange map from ccxt-india. Used to
  // (a) subscribe the LTP websocket on the *corrected* exchange for
  // BE-series / BSE-primary stocks (e.g. VIKASECO-EQ → VIKASECO on BSE),
  // and (b) rewrite `tradingsymbol`/`exchange` in the Kite publisher basket
  // so Kite doesn't silently drop the item. See brokerPublisher.js
  // `resolveZerodhaSymbol()` for the fallthrough rules.
  const symbolMap = useZerodhaSymbolMap(dataArray, visible);

  // Real-time prices via WebSocket (matching web app pattern). Symbols are
  // mapped through `resolveZerodhaSymbol` so the hook subscribes with the
  // corrected exchange — otherwise the NSE feed returns nothing for a
  // BSE-primary symbol and canonical basket market protection falls through.
  const wsSymbols = visible
    ? dataArray.map(item => {
        const resolved = resolveZerodhaSymbol(item, symbolMap);
        return {
          ...item,
          symbol: resolved.tradingsymbol || item.symbol,
          tradingSymbol: resolved.tradingsymbol || item.tradingSymbol,
          exchange: resolved.exchange || item.exchange,
        };
      })
    : [];
  const { getLTPForSymbol: wsGetLTP } = useWebSocketCurrentPrice(wsSymbols);

  // REST fallback for initial load (WebSocket may take a moment to connect).
  // Uses advice-side {symbol, exchange} — but note that for BE-series / BSE-
  // primary stocks whose advice is stale (VIKASECO-EQ tagged NSE but
  // actually BSE-primary), Angel One returns no LTP on NSE. The authoritative
  // fix is server-side: /zerodha/convert-symbol's `ltp` field falls through
  // to a live fetch on the resolved exchange when the Redis cache is cold.
  // See ccxt-india app_zerodha.py: _get_cached_ltp / convert_symbol().
  const [restPrices, setRestPrices] = useState({});
  useEffect(() => {
    if (!visible || dataArray.length === 0) return;
    const fetchInitialPrices = async () => {
      try {
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}angelone/market-data`,
          {
            Orders: dataArray.map(item => ({
              exchange: item.exchange || 'NSE',
              segment: '',
              tradingSymbol: item.symbol,
            })),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        const pricesMap = {};
        response?.data?.data?.fetched?.forEach(item => {
          pricesMap[item.tradingSymbol] = item.ltp;
        });
        setRestPrices(pricesMap);
      } catch (error) {
        console.error('Error fetching initial market prices:', error);
      }
    };
    fetchInitialPrices();
  }, [visible]);

  // Unified LTP getter. Preference order:
  //   1. WebSocket on the scripmaster-resolved symbol (e.g. 'VIKASECO' subscribed on BSE)
  //   2. WebSocket on the raw advice-side symbol ('VIKASECO-EQ' on NSE)
  //   3. REST-fetched (Angel One) market-data price on the raw symbol
  //   4. Scripmaster Redis-cached `ltp` from /zerodha/convert-symbol
  // (4) is load-bearing for BE-series / BSE-primary stocks whose NSE ws
  // feed never emits — without it the Step-3 review shows ₹0 for
  // VIKASECO-EQ even though Kite's own confirmation page has the LTP.
  const getLTPForSymbol = useCallback(
    symbol => {
      if (!symbol) return null;
      const info = symbolMap?.[symbol];
      const resolvedSym = info?.zerodha_symbol;
      if (resolvedSym) {
        const wsResolved = wsGetLTP(resolvedSym);
        if (wsResolved && wsResolved > 0) return wsResolved;
      }
      const wsPrice = wsGetLTP(symbol);
      if (wsPrice && wsPrice > 0) return wsPrice;
      const restPrice = restPrices[symbol];
      if (restPrice && restPrice > 0) return restPrice;
      if (info?.ltp && info.ltp > 0) return info.ltp;
      return null;
    },
    [wsGetLTP, restPrices, symbolMap],
  );

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    if (
      visible &&
      isBrokerDisconnected &&
      dataArray.length > 0
    ) {
      // Initialize as soon as market prices are available, or fallback to rebalance prices
      if (Object.keys(restPrices).length > 0) {
        initializeEditableData();
      } else if (dataArray.some(item => item.rebalancePrice)) {
        // Use rebalance prices from API response as fallback
        initializeEditableData();
      }
    }
  }, [visible, restPrices, isBrokerDisconnected, dataArray]);

  // A fresh, portfolio-tagged zero-trade calculation is broker truth that the
  // rebalance is complete. Persist that for real brokers too; otherwise an old
  // `partial` subscriberExecution keeps the card on "Retry Rebalance" even
  // while this modal correctly says "Already Aligned".
  const alreadyAlignedMarkedRef = useRef(false);
  const hasPendingSellAuthorization =
    isPendingSellAuthorizationCalculation(activeCalculatedPortfolioData);
  const isAlreadyAlignedCalculation = Boolean(
    dataArray.length === 0 &&
      !hasPendingSellAuthorization &&
      !showUnaffordableTargetsExplanation &&
      !publisherBuyContinuation?.attemptId &&
      activeCalculatedPortfolioData &&
      !Array.isArray(activeCalculatedPortfolioData) &&
      activeCalculatedPortfolioData?.status !== 1 &&
      activeCalculatedPortfolioData?.status !== 2 &&
      Array.isArray(activeCalculatedPortfolioData?.buy) &&
      Array.isArray(activeCalculatedPortfolioData?.sell),
  );
  useEffect(() => {
    if (
      !visible ||
      !calculationMatchesPortfolio ||
      hasSkippedStocks ||
      showUnaffordableTargetsExplanation
    ) return;

    if (!isAlreadyAlignedCalculation || alreadyAlignedMarkedRef.current) return;
    alreadyAlignedMarkedRef.current = true;

    const requestHeaders = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    };

    const markAsExecuted = async () => {
      try {
        // This is an empty-plan acknowledgement, not order placement. Keep it
        // on the acknowledgement endpoint; executeAdvice correctly rejects an
        // empty plan and must never own this non-placement operation.
        let alreadyAlignedDone = false;

        const effectiveBroker = broker || 'DummyBroker';
        if (effectiveBroker === 'DummyBroker' && !alreadyAlignedDone) {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/process-trade`,
            {
              user_broker: effectiveBroker,
              user_email: userEmail,
              trades: [],
              model_id: modelPortfolioModelId,
              modelName: storeModalName,
              advisor: advisorTag,
              unique_id: activeCalculatedPortfolioData?.uniqueId,
            },
            {headers: requestHeaders},
          );
        }

        await axios.put(
          `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
          {
            userEmail: userEmail,
            modelName: storeModalName,
            model_id: modelPortfolioModelId,
            executionStatus: 'executed',
            user_broker: effectiveBroker,
          },
          {headers: requestHeaders},
        );

        portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED, {
          userEmail,
          modelName: storeModalName,
          broker: effectiveBroker,
          alreadyAligned: true,
        });

        // Delayed refresh to allow cross-server DB sync (matching prod: 1.5s, 4s, 8s)
        setTimeout(() => getModelPortfolioStrategyDetails(), 1500);
        setTimeout(() => getModelPortfolioStrategyDetails(), 4000);
        setTimeout(() => getModelPortfolioStrategyDetails(), 8000);
      } catch (err) {
        console.error('Error auto-marking already-aligned as executed:', err);
      }
    };

    markAsExecuted();
  }, [visible, calculationMatchesPortfolio, hasSkippedStocks, showUnaffordableTargetsExplanation, activeCalculatedPortfolioData, isAlreadyAlignedCalculation, userEmail, storeModalName, modelPortfolioModelId, broker, advisorTag, configData, getModelPortfolioStrategyDetails]);

  // Reset already-aligned flag when modal closes
  useEffect(() => {
    if (!visible) {
      alreadyAlignedMarkedRef.current = false;
    }
  }, [visible]);

  // Clear on modal close
  useEffect(() => {
    if (!visible) {
      setEditableData([]);
      initializedRef.current = false;
      publisherGateCancelledRef.current = true;
    }
  }, [visible]);

  const initializeEditableData = useCallback(() => {
    if (initializedRef.current) return;

    const initialData = dataArray.map(item => ({
      ...item,
      editablePrice: getLTPForSymbol(item.symbol) || item.rebalancePrice || 0,
      editableQty: item.qty,
      id: item.symbol,
    }));

    setEditableData(initialData);
    initializedRef.current = true;
  }, [dataArray, getLTPForSymbol, restPrices]);

  // NEW: Function to open DummyBroker confirmation modal

  const [showPriceErrorModal, setShowPriceErrorModal] = useState(false);

  const validatePriceBeforeConfirm = () => {
    const anyZeroPrice = editableData.some(
      item => parseFloat(item.editablePrice) === 0,
    );
    if (anyZeroPrice) {
      setShowPriceErrorModal(true);
      return false;
    }
    return true;
  };

  const openDummyBrokerConfirmation = () => {
    if (validatePriceBeforeConfirm()) {
      setShowDummyBrokerModal(true);
    }
  };

  // NEW: Function to close DummyBroker confirmation modal
  const closeDummyBrokerConfirmation = () => {
    setShowDummyBrokerModal(false);
  };

  const rawStockDetails = convertResponse(dataArray, broker);

  // SELLs in the rebalance response are already netted by the backend against
  // the user's actual holdings (resultant_of_net_and_holding), so any SELL the
  // backend emits is a real exit of a held position. The previous client-side
  // filter required an EXACT match on the FULL symbol (incl. -EQ/-BE/-SM
  // suffix), which SILENTLY dropped a SELL whenever the held symbol's
  // exchange-series suffix differed (e.g. holdings stored as "GTLINFRA-EQ" vs
  // a post-series-migration "GTLINFRA-BE" sell). Silently hiding an exit is
  // the worst failure mode — the backend still executes the SELL, but the
  // user never reviews it. We now keep ALL backend SELLs and only LOG (never
  // drop) when a sell's BASE symbol isn't found in holdings, for
  // observability. Ported from web parity commit 344b7766.
  const stockDetails = (() => {
    const userHoldings = calculatedPortfolioData?.userHoldings || calculatedPortfolioData?.user_net_pf_model;
    if (!Array.isArray(userHoldings) || userHoldings.length === 0) return rawStockDetails;
    const baseSym = (s) => (s || '').toUpperCase().split('-')[0];
    const heldBaseSymbols = new Set();
    userHoldings.forEach(h => {
      const sym = h?.symbol || h?.tradingSymbol || '';
      const qty = h?.quantity || h?.qty || 0;
      if (sym && qty > 0) heldBaseSymbols.add(baseSym(sym));
    });
    if (heldBaseSymbols.size === 0) return rawStockDetails;
    rawStockDetails.forEach(item => {
      if ((item.transactionType || '').toUpperCase() !== 'SELL') return;
      const sym = item.tradingSymbol || item.symbol || '';
      if (!heldBaseSymbols.has(baseSym(sym))) {
        console.warn(
          `[RebalanceModal] SELL ${sym} not matched in current holdings (base-symbol) — showing anyway; backend nets sells against holdings.`,
        );
      }
    });
    return rawStockDetails;
  })();

  // --- Zerodha Publisher Flow Functions ---

  const generateHtmlForm = (basket, apiKey) => {
    return `<html>
      <body>
        <form id="zerodhaForm" method="POST" action="https://kite.zerodha.com/connect/basket">
          <input type="hidden" name="api_key" value="${apiKey}" />
          <input type="hidden" name="data" value='${JSON.stringify(basket)}' />
          <input type="hidden" name="redirect_params" value="test=true" />
        </form>
        <script>
          document.getElementById('zerodhaForm').submit();
        </script>
      </body>
    </html>`;
  };

  // Keep plan_id, plan_version and unique_id on one reviewed attempt. A stale
  // repair row can coexist with a fresh calculate response; the fresh response
  // wins because those are the legs currently shown to the customer.
  const additionalPayload = {
    ...resolveRebalancePlanCorrelation({
      calculatedPortfolioData,
      matchingRepairTrade,
      repairRowsShown: isRepairMode,
      activeModelName: filteredData[0]?.model_name || storeModalName,
      advisorTag,
      rebalanceFreezePlan,
      repairFreezePlan,
    }),
    model_id: modelPortfolioModelId,
    broker,
  };
  const reconcileClosedPublisher = async () => {
    if (!additionalPayload.unique_id || !additionalPayload.plan_id) return null;
    try {
      return await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/publisher/cancelled`,
        {
          unique_id: additionalPayload.unique_id,
          user_email: userEmail,
          plan_id: additionalPayload.plan_id,
        },
        {headers: publisherHeaders(), timeout: 15000},
      );
    } catch (error) {
      console.warn('[ZerodhaPublisher] close reconciliation failed:', error?.message);
      return null;
    }
  };
  const handlePublisherClose = async () => {
    // Hiding the WebView is not enough: an active poll timeout used to fire
    // later and turn an abandoned password/TOTP screen into false success.
    stopOrderPolling();
    publisherGateCancelledRef.current = true;
    // Two-phase: wipe the queued baskets so a stale queue can't replay a
    // partially-completed run on the next open.
    pendingKiteBatchesRef.current = [];
    refittedKiteBatchesRef.current = new Set();
    currentKiteBatchIndexRef.current = 0;
    setWebView(false);
    setLoading(false);
    setZerodhaStatus(null);
    setZerodhaRequestType(null);
    const reconciliation = await reconcileClosedPublisher();
    await getModelPortfolioStrategyDetails?.();
    if (reconciliation?.data?.resolved === true) {
      Alert.alert(
        'No Zerodha order was placed',
        'The unfinished attempt was safely cleared. You can reopen Repair and try again.',
      );
    } else {
      Alert.alert(
        'Checking Zerodha order status',
        'Nothing was retried. Refresh once broker verification completes.',
      );
    }
  };

  const handleWebViewNavigationStateChange = async newNavState => {
    const { url } = newNavState;
    console.log('Rebalance WebView URL:', url);
    const redirectStatus = parseKiteRedirectStatus(url);
    if (redirectStatus === 'cancelled') {
      handlePublisherClose();
      return;
    }
    if (redirectStatus === 'success') {
      console.log('Zerodha success redirect detected:', url);
      stopOrderPolling();
      // A Publisher redirect proves submission, not execution. The shared
      // advance function now waits for broker-confirmed SELL fills and a live
      // margin refresh before it can expose a BUY basket.
      const advanced =
        advanceKiteBatchRef.current &&
        (await advanceKiteBatchRef.current({newOrders: []}));
      if (advanced) return;
      setWebView(false);
      setZerodhaStatus('success');
      setZerodhaRequestType('rebalance');
    }
  };

  // Build a Kite basket item array for a batch of legs (symbol resolution,
  // LTP enrichment, MARKET→LIMIT protection). Extracted from the single-basket
  // handleZerodhaRedirect so the two-phase queue can rebuild per batch.
  const buildKiteBasket = (batch, freshProtectionPrices) => {
    return batch.map(stock => {
      const resolved = resolveZerodhaSymbol(stock, symbolMap);
      const freshLtp = Number(
        freshProtectionPrices?.[String(resolved.tradingsymbol || '').toUpperCase()],
      );
      const isMarket = String(stock.orderType || '').toUpperCase() === 'MARKET';
      const displayLtp = getLTPForSymbol(resolved.tradingsymbol)
        || getLTPForSymbol(stock.tradingSymbol)
        || Number(stock.referencePrice);
      // The dedicated quote refresh is preferable, but a provider can return
      // RTNPOWER while the frozen plan carries RTNPOWER-EQ (or briefly omit a
      // quote). The review screen already has a valid live LTP. Do not turn
      // that known amount into zero and trap a completed SELL phase behind an
      // endless "buying power could not be verified" loop.
      const ltp = isMarket
        ? (Number.isFinite(freshLtp) && freshLtp > 0
          ? freshLtp
          : (displayLtp && displayLtp > 0 ? displayLtp : (resolved.cachedLtp || 0)))
        : (displayLtp && displayLtp > 0 ? displayLtp : (resolved.cachedLtp || 0));
      let orderPrice = 0;

      if (stock.orderType === 'LIMIT') {
        orderPrice = parseFloat(stock.price || 0);
      } else if (stock.orderType === 'MARKET' || stock.orderType === 'SL') {
        orderPrice = ltp && ltp !== '-' ? parseFloat(ltp) : 0;
      }

      const tradeTag = (stock.zerodhaTradeId || stock.tradeId || '').substring(0, 20);

      const basketItem = convertToBasketItem('Zerodha', stock, symbolMap, {
        tradingsymbol: resolved.tradingsymbol,
        exchange: resolved.exchange,
        ltp,
        price: orderPrice,
        quantity: parseInt(stock.quantity, 10) || 1,
        tag: tradeTag,
      });
      console.log('[RebalanceModal] Basket item:', JSON.stringify(basketItem));
      return basketItem;
    });
  };

  // Submit one Kite basket from the queue: build its order items, render the
  // WebView form, restart order-book polling (fresh baseline per basket so a
  // previous side's orders are absorbed, never re-detected), open the WebView.

  // Trim a pending Kite BUY batch to server-verified buying power. Once sells
  // have executed, an unreadable live balance may use the backend's frozen-plan
  // confirmed-fill fallback; every other unreadable response keeps BUYs closed.
  const refitPendingBatch = useCallback(
    async (index, freshProtectionPrices = {}) => {
      try {
        const batch = pendingKiteBatchesRef.current?.[index];
        if (!batch || !batch.length) return;
        const pricedBatch = enrichPublisherLegPrices(
          batch,
          freshProtectionPrices,
          symbolMap,
        );
        pendingKiteBatchesRef.current[index] = pricedBatch;
        const buys = pricedBatch.filter(
          b => String(b.transactionType || '').toUpperCase() === 'BUY',
        );
        if (!buys.length) return;

        const publisherRefitHeaders = {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        };

        const {data} = await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/publisher/refit-buys`,
          {
            user_email: userEmail,
            user_broker: broker,
            modelName: storeModalName,
            advisor: advisorTag,
            model_id: modelPortfolioModelId,
            unique_id: additionalPayload.unique_id || undefined,
            plan_id: additionalPayload.plan_id || undefined,
            buys,
            settlementPending: true,
          },
          {headers: publisherRefitHeaders},
        );

        if (!isPostSellCashUsable(data)) {
          Toast.show({
            type: 'info',
            text1: 'Buying power is still being verified',
            text2: data?.message || 'Your sells are recorded. Repair will appear only if something remains incomplete.',
            visibilityTime: 8000,
          });
          return false;
        }

        const affordable = new Map(
          data.submit.map(l => [
            String(l.tradingSymbol || l.symbol || '').toUpperCase(),
            Number(l.quantity) || 0,
          ]),
        );
        pendingKiteBatchesRef.current[index] = pricedBatch
          .map(leg => {
            if (String(leg.transactionType || '').toUpperCase() !== 'BUY') return leg;
            const q = affordable.get(
              String(leg.tradingSymbol || leg.symbol || '').toUpperCase(),
            );
            return q > 0 ? {...leg, quantity: q} : null;
          })
          .filter(Boolean);

        if (data.message) {
          Toast.show({type: 'info', text1: 'Order sizes adjusted',
            text2: data.message, visibilityTime: 8000});
        }
        return true;
      } catch (e) {
        console.warn('[refit] BUY batch held; buying power is unverified:', e?.message);
        Toast.show({
          type: 'info',
          text1: 'Buying power is still being verified',
          text2: 'Your sells are recorded. We will check what remains before offering Repair.',
          visibilityTime: 8000,
        });
        return false;
      }
    },
    [userEmail, broker, storeModalName, advisorTag, modelPortfolioModelId,
     matchingRepairTrade, calculatedPortfolioData, additionalPayload.plan_id,
     additionalPayload.unique_id, configData?.config?.REACT_APP_HEADER_NAME,
     configData?.subdomain, symbolMap],
  );
  const refitPendingBatchRef = useRef(null);
  useEffect(() => {
    refitPendingBatchRef.current = refitPendingBatch;
  }, [refitPendingBatch]);
  // Which queued batches have already been sized against live buying power.
  // Cleared with the queue itself, so a fresh run always re-verifies.
  const refittedKiteBatchesRef = useRef(new Set());

  const submitKiteBatch = async (index, {finishOnHold = true} = {}) => {
    const queued = pendingKiteBatchesRef.current[index];
    if (!queued) return false;
    // The affordability service values MARKET legs from `price`. Refresh the
    // broker quote before refit and use that same snapshot to build Kite's
    // protected LIMIT. Refit-before-quotes silently valued every MARKET buy at
    // zero and withheld the entire post-sell basket.
    const freshProtectionPrices = await fetchFreshKiteProtectionPrices(
      queued,
      symbolMap,
    );
    // Size a BUY basket to verified buying power BEFORE Kite opens.
    //
    // 2026-09-23 (moneyman/share2anand, MFCC): the refit lived only inside the
    // sell-gate branches — `sells-partial-terminal` and the "Continue anyway"
    // choice — so it never ran when the gate was happy, and never at all for a
    // buy-only Repair basket, which has no sells for the gate to wait on. His
    // Repair went to Kite at the frozen 8489 and Zerodha rejected the whole
    // ₹9.95L order for a ₹1,629 shortfall; the same customer's web attempt an
    // hour earlier refitted correctly to 8475. Web calls this before EVERY buy
    // batch (`BrokerPublisherButton.onBeforeBuyBatch`); doing it here covers
    // every caller — both initial launches and the batch-advance path — and a
    // future caller cannot reintroduce the gap by forgetting it.
    //
    // Idempotent by index: the two sell-gate callers above still run first and
    // simply make this a no-op, so no basket is sized twice.
    const hasBuyLeg = queued.some(
      leg => String(leg?.transactionType || '').toUpperCase() === 'BUY',
    );
    if (hasBuyLeg && !refittedKiteBatchesRef.current.has(index)) {
      const affordable = await refitPendingBatchRef.current?.(
        index,
        freshProtectionPrices,
      );
      if (affordable === false) {
        // The refit already told the customer why; never open Kite with an
        // unverified basket.
        setLoading(false);
        if (finishOnHold) finishKitePublisherRun();
        return false;
      }
      refittedKiteBatchesRef.current.add(index);
    }
    // Re-read: a refit replaces the queued batch in place.
    const batch = pendingKiteBatchesRef.current[index];
    if (!batch || !batch.length) {
      Toast.show({
        type: 'info',
        text1: 'Nothing left to buy',
        text2: 'Your available funds do not cover any of the remaining orders. Use Repair once funds are available.',
        visibilityTime: 8000,
      });
      if (finishOnHold) finishKitePublisherRun();
      return false;
    }
    // Capture broker truth before activating the intent. Previously this
    // network read ran after activation, creating an `intent_open`/spinner gap.
    // Tell polling how many legs this basket carries: it must not settle (and
    // close the Kite page) while Kite is still placing the rest of them.
    await startOrderPolling({ expectedOrderCount: batch.length });
    try {
      await publisherBatchDispatcherRef.current.run({
        attemptId: publisherAttemptRef.current?.attemptId, index, legs: batch,
        authorize: activationId => recordPublisherIntent(
          publisherFullLegsRef.current, publisherAttemptRef.current, batch, activationId,
        ),
        open: async () => {
          const basket = buildKiteBasket(batch, freshProtectionPrices);
          const htmlForm = generateHtmlForm(basket, zerodhaApiKey);
          currentKiteBatchIndexRef.current = index;
          setHtmlContent(htmlForm);
          setWebView(true);
          setLoading(false);
        },
      });
    } catch (error) {
      stopOrderPolling();
      throw error;
    }
    return true;
  };

  const finishKitePublisherRun = () => {
    setWebView(false);
    setLoading(false);
    setZerodhaStatus('success');
    setZerodhaRequestType('rebalance');
  };

  const waitForSellBatchAndMargin = async ({
    batches,
    currentIndex,
    nextIndex,
    initialNewOrders = [],
  }) => {
    const currentSellOrders = buildKiteBasket(batches[currentIndex] || []);
    let newOrders = initialNewOrders;
    let firstPass = true;
    let exactSellsConfirmed = false;
    const startedAt = Date.now();
    const sellDeadline = Date.now() + SELL_GATE_TIMEOUT_MS;

    while (
      !publisherGateCancelledRef.current &&
      Date.now() <= sellDeadline
    ) {
      try {
        const attemptStatus = await fetchPublisherAttemptStatus({
          publisherFinished: Date.now() - startedAt >= 10000,
          submittedSide: 'SELL',
        });
        if (attemptStatus?.nextAction === 'CONTINUE_BUYS') {
          exactSellsConfirmed = true;
          break;
        }
        if (attemptStatus?.nextAction === 'REPAIR_SELLS') {
          return {status: 'failed', attemptStatus};
        }
        if (attemptStatus?.nextAction === 'AUTHORIZE_OR_CHECK_ACCOUNT') {
          return {status: 'linked-account-orders-absent', attemptStatus};
        }
      } catch (error) {
        console.warn('[ZerodhaSellGate] Attempt status refresh failed:', error?.message);
      }
      try {
        if (!firstPass || newOrders.length === 0) {
          newOrders = await getNewPublisherOrders();
        }
      } catch (error) {
        console.warn('[ZerodhaSellGate] Order-book refresh failed:', error?.message);
      }
      firstPass = false;

      const readiness = evaluateSellBatchOrders(currentSellOrders, newOrders);
      if (readiness.state === 'failed') {
        // THREE-STATE GATE (2026-08-13). Locking the buys whenever ANY sell
        // failed was too blunt: if the rest completed, most of the money IS
        // there and the customer's portfolio stays entirely un-rebalanced for
        // want of one leg. Only hold when something is still in flight.
        if (readiness.allTerminal) {
          return {status: 'sells-partial-terminal', readiness};
        }
        return {status: 'failed', readiness};
      }
      if (readiness.ready) break;
      await new Promise(resolve => setTimeout(resolve, SELL_GATE_POLL_INTERVAL_MS));
    }

    if (publisherGateCancelledRef.current) return {status: 'cancelled'};
    const sellReadiness = evaluateSellBatchOrders(currentSellOrders, newOrders);
    if (!exactSellsConfirmed && !sellReadiness.ready) {
      return {status: 'sell-timeout', readiness: sellReadiness};
    }

    const nextBatch = batches[nextIndex] || [];
    const nextIsBuy = nextBatch.some(
      leg => String(leg?.transactionType || '').toUpperCase() === 'BUY',
    );
    if (!nextIsBuy) return {status: 'ready'};

    // Require enough live margin for every remaining protected BUY limit, not
    // merely the first 20-order Kite basket. If any protected limit cannot be
    // priced, fail closed instead of underestimating required buying power.
    const protectedBuyBaskets = batches
      .slice(nextIndex)
      .map(batch => buildKiteBasket(batch));
    const protectedBuyOrders = protectedBuyBaskets
      .flat()
      .filter(
        order => String(order?.transaction_type || '').toUpperCase() === 'BUY',
      );
    const allBuyLimitsPriced =
      protectedBuyOrders.length > 0 &&
      protectedBuyOrders.every(
        order => Number(order?.price) > 0 && Number(order?.quantity) > 0,
      );
    const protectedBuyCost = estimateProtectedBuyCost(protectedBuyBaskets);
    const requiredBuyingPower = allBuyLimitsPriced ? protectedBuyCost : 0;
    if (!(requiredBuyingPower > 0)) {
      return {status: 'funds-unverified', requiredBuyingPower: null, availableCash: null};
    }

    const marginDeadline = Date.now() + SELL_GATE_TIMEOUT_MS;
    let availableCash = null;
    while (
      !publisherGateCancelledRef.current &&
      Date.now() <= marginDeadline
    ) {
      const fundsResponse = await fetchFunds(
        'Zerodha',
        clientCode,
        apiKey,
        jwtToken,
        secretKey,
        sid,
        serverId,
        userEmail,
      );
      availableCash = extractAvailableCash(fundsResponse);
      if (
        availableCash !== null &&
        availableCash + 1 >= requiredBuyingPower
      ) {
        return {status: 'ready', requiredBuyingPower, availableCash};
      }
      const fundsMessage = JSON.stringify(fundsResponse || {});
      if (isBrokerAuthError(fundsMessage)) {
        return {status: 'broker-session', requiredBuyingPower, availableCash};
      }
      await new Promise(resolve => setTimeout(resolve, SELL_GATE_POLL_INTERVAL_MS));
    }

    if (publisherGateCancelledRef.current) return {status: 'cancelled'};
    return {status: 'margin-timeout', requiredBuyingPower, availableCash};
  };

  const showSellGatePausedAlert = (gateResult, retry, proceedWithBuys) => {
    const settlementShortfall = canOfferSettlementProceed(gateResult);
    const marginProblem = ['margin-timeout', 'funds-unverified', 'broker-session']
      .includes(gateResult?.status);
    const availableText = Number.isFinite(gateResult?.availableCash)
      ? ` Zerodha currently shows ₹${Math.round(gateResult.availableCash).toLocaleString('en-IN')} available.`
      : '';
    const requiredText = Number.isFinite(gateResult?.requiredBuyingPower)
      ? ` The protected buy baskets need about ₹${Math.ceil(gateResult.requiredBuyingPower).toLocaleString('en-IN')}.`
      : '';
    const message = settlementShortfall
      ? `All sells are complete, but Zerodha currently shows less buying power than the protected buy baskets need.${availableText}${requiredText} The difference may be temporarily unavailable because of settlement. You can continue, but Zerodha may reject the unfunded buys; any rejected quantity will remain for Repair after funds settle.`
      : marginProblem
        ? `All sells are complete, but the app could not verify usable Zerodha margin.${availableText}${requiredText} Reconnect or check again before opening buys.`
        : 'Zerodha has not confirmed the full SELL quantity yet. BUY baskets will remain locked to prevent insufficient-funds rejections.';
    const actions = [
      {text: 'Stop and review', style: 'cancel', onPress: finishKitePublisherRun},
      {text: 'Check again', onPress: retry},
    ];
    if (settlementShortfall) {
      actions.push({text: 'Continue with buys', onPress: proceedWithBuys});
    }
    Alert.alert(
      settlementShortfall
        ? 'Buying power may still be settling'
        : marginProblem
          ? 'Buying power could not be verified'
          : 'Sell orders are still pending',
      message,
      actions,
      {cancelable: false},
    );
  };

  // Advance to the next queued Kite basket. A SELL basket must be fully
  // broker-confirmed first. After that, live margin is checked. If it is short
  // despite confirmed sells, the customer may knowingly submit the buys: the
  // broker decides what is fundable now and reconciliation leaves rejected
  // quantities for Repair after settlement.
  const advanceKiteBatch = async ({newOrders = []} = {}) => {
    const batches = pendingKiteBatchesRef.current;
    const next = currentKiteBatchIndexRef.current + 1;
    if (!batches || next >= batches.length) return false;
    if (batchAdvancingRef.current) return true; // already moving — treat as consumed
    batchAdvancingRef.current = true;
    setWebView(false);
    try {
      const currentIndex = currentKiteBatchIndexRef.current;
      const currentBatch = batches[currentIndex] || [];
      const currentIsSell = currentBatch.some(
        leg => String(leg?.transactionType || '').toUpperCase() === 'SELL',
      );

      if (currentIsSell) {
        setLoading(true);
        Toast.show({
          type: 'info',
          text1: 'Waiting for confirmed sells',
          text2: 'Buy baskets wait for Zerodha to fill the sells; buying power is checked next.',
          visibilityTime: 5000,
        });
        const gateResult = await waitForSellBatchAndMargin({
          batches,
          currentIndex,
          nextIndex: next,
          initialNewOrders: newOrders,
        });
        if (gateResult.status === 'cancelled') return true;
        if (gateResult.status === 'linked-account-orders-absent') {
          Toast.show({
            type: 'error',
            text1: 'Zerodha orders were not found',
            text2: gateResult?.attemptStatus?.message ||
              'Complete CDSL authorization and verify that Kite opened the same account linked to this app.',
            visibilityTime: 9000,
          });
          finishKitePublisherRun();
          return true;
        }
        if (gateResult.status === 'failed') {
          Toast.show({
            type: 'error',
            text1: 'A sell order is still working',
            text2: 'Buy orders are on hold until it completes. Nothing was lost — use Repair once it settles.',
            visibilityTime: 7000,
          });
          finishKitePublisherRun();
          return true;
        }
        if (gateResult.status === 'sells-partial-terminal') {
          // Some sells failed outright but nothing is still in flight, so the
          // money that is coming has arrived. Place the buys the proceeds can
          // actually fund rather than holding the whole basket.
          settlementRiskAcceptedRef.current = true;

          const canSubmitBuys = await refitPendingBatchRef.current?.(next);
          if (canSubmitBuys === false) {
            finishKitePublisherRun();
            return true;
          }
          const trimmed = pendingKiteBatchesRef.current?.[next] || [];
          if (!trimmed.length) {
            Toast.show({
              type: 'info',
              text1: 'Sales did not raise enough to buy',
              text2: 'Your sells are done. Use Repair once funds are available.',
              visibilityTime: 8000,
            });
            finishKitePublisherRun();
            return true;
          }
          await submitKiteBatch(next);
          return true;
        }
        if (gateResult.status !== 'ready') {
          setLoading(false);
          showSellGatePausedAlert(
            gateResult,
            () => advanceKiteBatchRef.current?.({newOrders: []}),
            async () => {
              settlementRiskAcceptedRef.current = true;

              // "Continue" must mean "continue with what your money covers",
              // not "continue and let the broker reject the tail". The server
              // re-reads the broker balance itself and returns the affordable
              // subset — one endpoint for web + both apps, so no client
              // re-derives affordability (which is how one basket ended up
              // with five different funding behaviours in Aug 2026).
              const canSubmitBuys = await refitPendingBatchRef.current?.(next);
              if (canSubmitBuys === false) {
                finishKitePublisherRun();
                return;
              }
              await submitKiteBatch(next);
            },
          );
          return true;
        }
      }

      await submitKiteBatch(next);
      return true;
    } catch (error) {
      setLoading(false);
      Alert.alert('Order batch not opened',
        error?.response?.data?.message || error?.message || 'Refresh order status and try the remaining batch.',
        [{text: 'Close', style: 'cancel'},
         {text: 'Check again', onPress: () => advanceKiteBatchRef.current?.({newOrders: []})}]);
      return true;
    } finally {
      batchAdvancingRef.current = false;
    }
  };
  advanceKiteBatchRef.current = advanceKiteBatch;

  const handleZerodhaRedirect = async () => {
    if (publisherLaunchPendingRef.current) return;
    publisherLaunchPendingRef.current = true;
    try {
    const sessionValid = await validateBrokerSession('Zerodha', jwtToken, {
      checkFreshness: true,
    });
    if (!sessionValid) {
      setOpenRebalanceModal(false);
      setTimeout(() => openBrokerModal('Zerodha'), 500);
      return;
    }
    const hasZerodhaEquitySells = stockDetails.some(stock => {
      const side = String(stock?.transactionType || '').toUpperCase();
      const exchange = String(stock?.exchange || '').toUpperCase();
      const product = String(stock?.productType || 'CNC').toUpperCase();
      return side === 'SELL' && !['NFO', 'BFO', 'MCX'].includes(exchange) &&
        !['MIS', 'NRML', 'CARRYFORWARD'].includes(product);
    });
    if (hasZerodhaEquitySells) {
      const liveUserDetails = getUserDeatils
        ? await getUserDeatils()
        : userDetails;
      if (!liveUserDetails || !isZerodhaSellAuthorized(liveUserDetails)) {
        setLoading(false);
        setOpenRebalanceModal(false);
        setShowDdpiModal?.(true);
        Toast.show({
          type: 'info',
          text1: 'Authorize Zerodha sells first',
          text2: 'Complete CDSL/TPIN authorization, then return to place the sell basket.',
          visibilityTime: 7000,
        });
        return;
      }
    }
    // Pre-flight: refuse to send orders with missing exchange. Kite Publisher
    // silently drops basket items whose symbol/exchange combo it can't resolve.
    const exchangeCheck = validateStockExchanges(stockDetails);
    if (!exchangeCheck.valid) {
      const missingList = exchangeCheck.missing.join(', ');
      console.error('[ZerodhaPublisher] Blocked due to missing exchange:', missingList);
      Toast.show({
        type: 'error',
        text1: 'Order blocked — missing exchange',
        text2: `Missing exchange for: ${missingList}. Please contact your manager.`,
        visibilityTime: 8000,
      });
      return;
    }

    publisherGateCancelledRef.current = false;
    settlementRiskAcceptedRef.current = false;
    setLoading(true);
    try {
      // Cross-publisher cleanup — also wipe Fyers pending state so a
      // prior partial Fyers attempt doesn't replay on next mount.
      // Per SDK_ORCHESTRATION_AUDIT.md § Pass 2 / Suspected defect #3.
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('zerodhaAdditionalPayload');
      await AsyncStorage.removeItem('stockDetailsFyersOrder');
      const currentISTDateTime = new Date();
      // The reco endpoint persists and echoes `price`. MARKET order prices
      // used to be sent as zero, which also poisoned the durable attempt used
      // by sell→buy recovery. The calculate response's rebalance price is the
      // server-owned fallback until the broker quote is refreshed immediately
      // before the BUY refit.
      const intentProtectionPrices = await fetchFreshKiteProtectionPrices(
        stockDetails,
        symbolMap,
      );
      const pricedStockDetails = enrichPublisherLegPrices(
        stockDetails,
        intentProtectionPrices,
        symbolMap,
      );

      const recoResponse = await axios.post(
        `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
        {
          stockDetails: pricedStockDetails,
          leaving_datetime: currentISTDateTime,
          email: userEmail,
          trade_given_by: advisorTag,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': getTenantSubdomain(configData),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      const allStockDetails = Array.isArray(recoResponse?.data?.data)
        ? recoResponse.data.data
        : [];
      if (allStockDetails.length === 0) {
        throw new Error('Could not prepare Zerodha order records.');
      }
      const filteredStockDetails = allStockDetails.map(detail => ({
        user_email: detail.user_email,
        trade_given_by: detail.trade_given_by,
        tradingSymbol: detail.Symbol,
        transactionType: detail.Type,
        exchange: detail.Exchange,
        segment: detail.Segment,
        productType: detail.ProductType,
        orderType: detail.OrderType,
        price: detail.Price,
        referencePrice: detail.Price,
        ltp: detail.Price,
        quantity: detail.Quantity,
        priority: detail.Priority,
        tradeId: detail.tradeId,
        zerodhaTradeId: detail.zerodhaTradeId,
        publisherTag: detail.zerodhaTradeId,
        modelId: modelPortfolioModelId,
        modelName: storeModalName,
        advisor: advisorTag,
        uniqueId: additionalPayload.unique_id,
        planId: additionalPayload.plan_id,
        user_broker: 'Zerodha',
      }));
      const publisherAttempt = createZerodhaPublisherAttempt({
        stockDetails: filteredStockDetails,
        userEmail,
        flow: 'rebalance',
      });
      publisherAttemptRef.current = publisherAttempt;
      publisherFullLegsRef.current = JSON.parse(JSON.stringify(filteredStockDetails));
      // Await persistence before opening Kite. A fast redirect must never
      // race checkZerodhaStatus against an unfinished AsyncStorage write.
      await AsyncStorage.multiSet([
        ['stockDetailsZerodhaOrder', JSON.stringify(filteredStockDetails)],
        ['zerodhaAdditionalPayload', JSON.stringify({
          ...additionalPayload,
          modelName: storeModalName,
          advisor: advisorTag,
          attemptId: publisherAttempt.attemptId,
        })],
      ]);

      // TWO-PHASE PUBLISHER (2026-08-06, mirrors web Fix C): split the legs
      // into [sellBaskets..., buyBaskets...]. Submit sells first; a publisher
      // redirect only starts broker fill verification. After full fills, live
      // margin either opens buys or shows the explicit settlement-risk choice.
      pendingKiteBatchesRef.current = createModelPortfolioPublisherBatches(
        filteredStockDetails,
        'Zerodha',
      );
      refittedKiteBatchesRef.current = new Set();
      currentKiteBatchIndexRef.current = 0;
      await submitKiteBatch(0);
    } catch (error) {
      console.error('Failed to handle Zerodha redirect:', error);
      setLoading(false);
      stopOrderPolling();
      if (publisherIntentFiredRef.current) {
        await reconcileClosedPublisher();
        await getModelPortfolioStrategyDetails?.();
      }
      // This component is a native full-screen Modal. A root Toast can render
      // behind it and make a fail-closed preflight look like a dead button.
      // Keep the safety refusal, but surface it in the active modal window.
      Alert.alert(
        'Could not prepare Zerodha order',
        error?.message || 'Please try again.',
        [{text: 'OK'}],
      );
    }

    } finally { publisherLaunchPendingRef.current = false; }
  };

  const resumeZerodhaBuyPublisher = async continuation => {
    const buys = (continuation?.buyLegs || []).filter(
      leg => String(leg?.transactionType || '').toUpperCase() === 'BUY',
    );
    if (!continuation?.attemptId || buys.length === 0) {
      throw new Error('The pending Zerodha buy session could not be restored.');
    }
    const allLegs = continuation?.allLegs?.length
      ? continuation.allLegs
      : buys;
    publisherAttemptRef.current = {
      attemptId: continuation.attemptId,
      stockDetails: allLegs,
    };
    publisherContinuationContextRef.current = continuation.context || {};
    publisherFullLegsRef.current = JSON.parse(JSON.stringify(allLegs));
    pendingKiteBatchesRef.current = createBatches(buys, 'Zerodha', false);
    refittedKiteBatchesRef.current = new Set();
    currentKiteBatchIndexRef.current = 0;
    await AsyncStorage.multiSet([
      ['stockDetailsZerodhaOrder', JSON.stringify(allLegs)],
      ['zerodhaAdditionalPayload', JSON.stringify({
        ...additionalPayload,
        ...(continuation.context || {}),
        model_id: continuation.context?.modelId || modelPortfolioModelId,
        modelName: continuation.context?.modelName || storeModalName,
        unique_id: continuation.context?.uniqueId || additionalPayload.unique_id,
        plan_id: continuation.context?.planId || additionalPayload.plan_id,
        advisor: continuation.context?.advisor || advisorTag,
        attemptId: continuation.attemptId,
      })],
    ]);
    const opened = await submitKiteBatch(0, {finishOnHold: false});
    if (opened) {
      onPublisherContinuationConsumed?.();
    } else {
      publisherContinuationLaunchRef.current = null;
      Alert.alert(
        'Buy basket was not opened',
        'The remaining buys are still saved. Check available funds and tap Continue again; no order was lost.',
      );
    }
    return opened;
  };

  // "Continue with N Buy" is itself the customer's approval of the exact
  // remaining frozen legs. Launch the buy-only Publisher immediately; showing
  // the four-leg review again made completed sells appear retryable and added
  // a second, misleading Place Order step.
  useEffect(() => {
    const attemptId = publisherBuyContinuation?.attemptId;
    if (
      !visible ||
      broker !== 'Zerodha' ||
      !attemptId ||
      !publisherBuyContinuation?.buyLegs?.length ||
      webView ||
      publisherContinuationLaunchRef.current === attemptId
    ) {
      return;
    }
    publisherContinuationLaunchRef.current = attemptId;
    let active = true;
    const launch = async () => {
      setLoading(true);
      try {
        const sessionValid = await validateBrokerSession('Zerodha', jwtToken, {
          checkFreshness: true,
        });
        if (!active) return;
        if (!sessionValid) {
          setOpenRebalanceModal(false);
          setTimeout(() => openBrokerModal('Zerodha'), 500);
          return;
        }
        await resumeZerodhaBuyPublisher(publisherBuyContinuation);
      } catch (error) {
        if (!active) return;
        publisherContinuationLaunchRef.current = null;
        setLoading(false);
        Alert.alert(
          'Could not open the remaining Zerodha buys',
          error?.message || 'Refresh order status and try again.',
        );
      }
    };
    launch();
    return () => {
      active = false;
    };
  }, [
    visible,
    broker,
    webView,
    publisherBuyContinuation,
    jwtToken,
  ]);

  const fetchZerodhaData = async () => {
    try {
      const pendingOrderData = await AsyncStorage.getItem(
        'stockDetailsZerodhaOrder',
      );
      const payloadData = await AsyncStorage.getItem(
        'zerodhaAdditionalPayload',
      );
      const zerodhaStockDetails = pendingOrderData
        ? JSON.parse(pendingOrderData)
        : null;
      const zerodhaAdditionalPayload = payloadData
        ? JSON.parse(payloadData)
        : null;
      return { zerodhaStockDetails, zerodhaAdditionalPayload };
    } catch (error) {
      console.error('Error fetching Zerodha data from AsyncStorage:', error);
      return { zerodhaStockDetails: null, zerodhaAdditionalPayload: null };
    }
  };

  const checkZerodhaStatus = async () => {
    // Stop polling — normal WebView callback is proceeding. The hook's
    // stop() flips the internal processed flag so any in-flight poll
    // tick short-circuits before re-firing onPublisherSettled.
    stopOrderPolling();

    const { zerodhaStockDetails, zerodhaAdditionalPayload } =
      await fetchZerodhaData();

    if (
      zerodhaStatus !== null &&
      zerodhaStatus !== 'cancelled' &&
      zerodhaAdditionalPayload !== null &&
      zerodhaStockDetails !== null &&
      zerodhaRequestType === 'rebalance'
    ) {
      try {
        // Use publisher/record-orders endpoint - this fetches order book from Zerodha
        // and matches orders with our trade list
        const requestHeaders = {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': getTenantSubdomain(configData),
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        };

        console.log('[RebalanceModal] Recording publisher orders...');

        const activePublisherBatch =
          pendingKiteBatchesRef.current?.[currentKiteBatchIndexRef.current] || [];
        const submittedSide = activePublisherBatch.some(
          leg => String(leg?.transactionType || '').toUpperCase() === 'BUY',
        ) ? 'BUY' : 'SELL';

        const recordResponse = await axios.post(
          `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
          {
            stockDetails: zerodhaStockDetails,
            // Preserve the real client outcome. The backend performs the
            // authoritative order-book lookup; timeout/cancel + no match must
            // become order_not_found, never PENDING-by-assumption.
            publisherResults: [{ status: zerodhaStatus, batchIndex: 0 }],
            userEmail: userEmail,
            broker: 'Zerodha',
            model_id: zerodhaAdditionalPayload.model_id,
            modelName: zerodhaAdditionalPayload.modelName,
            advisor: zerodhaAdditionalPayload.advisor,
            unique_id: zerodhaAdditionalPayload.unique_id,
            plan_id: zerodhaAdditionalPayload.plan_id,
            attemptId: zerodhaAdditionalPayload.attemptId,
            submittedSide,
            caPendingInfo: calculatedPortfolioData?.caPendingInfo || [],
          },
          { headers: requestHeaders }
        );

        console.log('[RebalanceModal] Record orders response:', recordResponse.data);

        let exactAttemptStatus = null;
        try {
          publisherAttemptRef.current = publisherAttemptRef.current || {
            attemptId: zerodhaAdditionalPayload.attemptId,
          };
          exactAttemptStatus = await fetchPublisherAttemptStatus({
            publisherFinished: true,
            submittedSide,
          });
        } catch (statusError) {
          console.warn('[ZerodhaPublisher] exact attempt refresh failed:', statusError?.message);
        }
        const orderResults = annotateSettlementRiskResults(
          exactAttemptStatus?.legs?.length
            ? exactAttemptStatus.legs
            : (recordResponse.data.response || recordResponse.data.results || []),
          settlementRiskAcceptedRef.current,
        );

        // Update subscriber execution status (matching web app)
        let backendExecutionComplete = false;
        let backendRecordBody;

        // Record publisher results (matching prod)
        try {
          const canonicalRecord = await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
            {
              modelName: zerodhaAdditionalPayload.modelName,
              model_id: zerodhaAdditionalPayload.model_id,
              unique_id: zerodhaAdditionalPayload.unique_id,
              advisor: zerodhaAdditionalPayload.advisor,
              order_results: orderResults,
              user_email: userEmail,
              user_broker: 'Zerodha',
              plan_id: zerodhaAdditionalPayload.plan_id,
              plan_version: zerodhaAdditionalPayload.plan_version,
            },
            { headers: requestHeaders },
          );
          backendRecordBody = canonicalRecord.data;
          backendExecutionComplete = isPublisherExecutionComplete(backendRecordBody);
        } catch (err) {
          console.warn('[ZerodhaPublisher] record-publisher-results failed:', err);
        }

        setOrderPlacementResponse(includeUnconfirmedPublisherLegs(orderResults, zerodhaStockDetails, backendRecordBody));
        // Zerodha publisher lane — outgoing trades variant-tagged below
        // would normally come from `tradesWithVariant`, but at this point
        // in the function scope only `zerodhaStockDetails` is available.
        // Tag them on the spot for the fallback lookup.
        setLastSubmittedTrades?.(
          (zerodhaStockDetails || []).map(t => ({
            ...t,
            variant: t?.variant || computeTradeVariant(brokerAfterHoursOrdersAllowed),
          })),
        );
        setOpenSucessModal(true);
        setOpenRebalanceModal(false);
        eventEmitter.emit('OrderPlacedReferesh');

        // Emit structured portfolio events (matching prod)
        portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
          userEmail,
          modelName: zerodhaAdditionalPayload?.modelName || storeModalName,
        });
        if (backendExecutionComplete) {
          portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED, {
            userEmail,
            modelName: zerodhaAdditionalPayload?.modelName || storeModalName,
            broker: 'Zerodha',
          });
        }

        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/user-portfolio`,
            { user_email: userEmail },
            { headers: requestHeaders }
          );

          const statusCheckData = {
            userEmail: userEmail,
            modelName: zerodhaAdditionalPayload.modelName,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: 'Zerodha',
            unique_id: zerodhaAdditionalPayload.unique_id,
            model_id: zerodhaAdditionalPayload.model_id || modelPortfolioModelId,
            plan_id: zerodhaAdditionalPayload.plan_id,
            attempt_id: zerodhaAdditionalPayload.attemptId,
          };
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
            statusCheckData,
            { headers: requestHeaders }
          );
        } catch (error) {
          console.error('Error updating Zerodha portfolio:', error);
        }

        AsyncStorage.removeItem('stockDetailsZerodhaOrder');
        AsyncStorage.removeItem('zerodhaAdditionalPayload');
        // Cross-publisher cleanup — drop Fyers pending state too.
        AsyncStorage.removeItem('stockDetailsFyersOrder');
        setZerodhaStatus(null);
        setZerodhaRequestType(null);
        getRebalanceRepair();
        getModelPortfolioStrategyDetails();
      } catch (error) {
        console.log('Error in checkZerodhaStatus:', error);
        console.log('Error response:', error.response?.data);
      }
    }
  };

  // Watch zerodhaStatus changes
  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        const { zerodhaStockDetails, zerodhaAdditionalPayload } =
          await fetchZerodhaData();
        if (
          zerodhaStatus !== null &&
          zerodhaStatus !== 'cancelled' &&
          zerodhaAdditionalPayload !== null &&
          zerodhaStockDetails !== null &&
          zerodhaRequestType === 'rebalance' &&
          jwtToken !== undefined
        ) {
          checkZerodhaStatus();
        }
      } catch (error) {
        console.error('Error in fetchAndProcessData:', error);
      }
    };
    fetchAndProcessData();
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);

  // --- End Zerodha Publisher Flow Functions ---

  // --- Fyers Publisher Flow Functions ---

  const handleFyersRedirect = async () => {
    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) {
      setOpenRebalanceModal(false);
      setTimeout(() => openBrokerModal(broker), 500);
      return;
    }

    setLoading(true);
    try {
      const currentISTDateTime = new Date();
      const istDatetime = moment(currentISTDateTime).format();

      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': getTenantSubdomain(configData),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      // Store stock details for post-processing.
      // Cross-publisher cleanup — also wipe Zerodha pending state.
      // Per SDK_ORCHESTRATION_AUDIT.md § Pass 2 / Suspected defect #3.
      await AsyncStorage.removeItem('stockDetailsFyersOrder');
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('zerodhaAdditionalPayload');
      await AsyncStorage.setItem(
        'stockDetailsFyersOrder',
        JSON.stringify(stockDetails),
      );

      // Record trade intent
      await axios.post(
        `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
        {
          stockDetails: stockDetails,
          leaving_datetime: currentISTDateTime,
          email: userEmail,
          trade_given_by: advisorTag,
        },
        { headers: requestHeaders },
      );

      // Place orders via Fyers API through process-trade.
      // Trade variant tagged on every per-trade object — see
      // docs/APP_ARCHITECTURE.md § 4.5.2 Trade variant field.
      const fyersVariant = computeTradeVariant(brokerAfterHoursOrdersAllowed);
      const payload = {
        clientId: clientCode,
        accessToken: jwtToken,
        user_email: userEmail,
        user_broker: 'Fyers',
        modelName: additionalPayload.modelName,
        advisor: additionalPayload.advisor,
        model_id: additionalPayload.model_id || modelPortfolioModelId,
        unique_id: additionalPayload.unique_id,
        ...(additionalPayload.plan_id
          ? { plan_id: additionalPayload.plan_id, plan_version: additionalPayload.plan_version }
          : {}),
        returnDateTime: istDatetime,
        trades: stockDetails.map(stock => ({ ...stock, variant: fyersVariant })),
        caPendingInfo: calculatedPortfolioData?.caPendingInfo || [],
      };

      // SDK executeAdvice dual-path (Phase C) — Fyers publisher path.
      let checkData;
      if (sdkExecuteAdviceEnabled) {
        try {
          const sdkResult = await sdkClient.executeAdvice(
            {
              kind: 'mpRebalance',
              clientAdviceId: `mp-rebalance:Fyers:${additionalPayload.plan_id || additionalPayload.unique_id || additionalPayload.model_id || modelPortfolioModelId}`,
              brokerName: 'Fyers',
              modelId: additionalPayload.model_id || modelPortfolioModelId,
              modelName: additionalPayload.modelName,
              uniqueId: additionalPayload.unique_id,
              // Same contract as the main path above: never let the SDK
              // route drop the reviewed plan.
              ...(additionalPayload.plan_id
                ? {
                    planId: additionalPayload.plan_id,
                    ...(additionalPayload.plan_version != null
                      ? {planVersion: additionalPayload.plan_version}
                      : {}),
                  }
                : {}),
              trades: payload.trades,
            },
            // skipReview + presentResult=false — host owns both UIs.
            { skipReview: true, presentResult: false },
          );
          // 2026-05-07: SDK now passes through ccxt's original
          // `orderStatus` / `errorCode` / `message_aq` /
          // `orderStatusMessage` / `tradingSymbol` via spread (see
          // AqSdkClient.ts Step 3). Previously we overwrote
          // `orderStatus: row.status` with the SDK enum, which
          // erased the broker-side rejection code (e.g. AB4036
          // cautionary listing) — RecommendationSuccessModal then
          // showed "All Orders Placed Successfully" for orders the
          // broker had actually rejected. Pass through unchanged.
          // A server refusal before dispatch (MARKET_CLOSED, expired
          // session, drifted plan) sent nothing. Its empty rows must not be
          // padded into "submission not yet verified" legs (moneyman Fyers,
          // 7 Oct 2026, 15:30:56 IST: all five legs shown pending).
          if (sdkResult?.notSent === true) {
            setLoading(false);
            setOpenRebalanceModal(false);
            Alert.alert(
              'Orders not placed',
              sdkResult?.recovery?.message ||
                'Nothing was sent to Fyers. Please try again during market hours.',
            );
            getRebalanceRepair();
            getModelPortfolioStrategyDetails();
            return;
          }
          checkData = sdkResult?.rows || [];
          console.log('[RebalanceModal] SDK executeAdvice (Fyers) result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
        } catch (sdkErr) {
          console.error('[RebalanceModal] SDK owns this Fyers attempt; legacy fallback blocked:', sdkErr?.message);
          throw sdkErr;
        }
      }

      if (!checkData) {
        const response = await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/process-trade`,
          payload,
          { headers: requestHeaders, timeout: 120000 },
        );
        checkData = response?.data?.results;
      }

      setOrderPlacementResponse(includeUnconfirmedPublisherLegs(checkData, stockDetails));
      // Capture outgoing trade list (variant-tagged) so the success modal
      // can recover `variant` per row when ccxt-india doesn't echo it.
      setLastSubmittedTrades?.(payload.trades);

      // Handle TPIN rejection for Fyers sell orders — equity delivery only
      if (checkData && checkData.length > 0) {
        const eqSells = checkData.filter(s => {
          const txnType = (s.transactionType || s.TransactionType || '').toUpperCase();
          if (txnType !== 'SELL') return false;
          const exchange = (s.exchange || s.Exchange || '').toUpperCase();
          const productType = (s.productType || s.ProductType || 'CNC').toUpperCase();
          if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
          if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
          return true;
        })
        const allSell = eqSells.length > 0 && checkData.every(s => s.transactionType === 'SELL');
        const isMixed = eqSells.length > 0 && checkData.some(s => s.transactionType === 'BUY');
        const rejectedSellCount = checkData.reduce((count, order) => {
          return isOrderRejected(order?.orderStatus) &&
            order.transactionType === 'SELL'
            ? count + 1
            : count;
        }, 0);
        const successCount = checkData.reduce((count, order) => {
          return isOrderSuccess(order?.orderStatus) &&
            (order.transactionType === 'SELL' || isMixed)
            ? count + 1
            : count;
        }, 0);

        if (
          (allSell || isMixed) &&
          rejectedSellCount >= 1 &&
          successCount === 0 &&
          hasExplicitSellAuthRejection(checkData)
        ) {
          setShowFyersTpinModal(true);
          setOpenRebalanceModal(false);
          setLoading(false);
          return;
        }
      }

      setOpenSucessModal(true);
      setOpenRebalanceModal(false);
      eventEmitter.emit('OrderPlacedReferesh');

      // Update model portfolio DB
      const updateData = {
        modelId: modelPortfolioModelId,
        orderResults: checkData,
        userEmail: userEmail,
        modelName: filteredData[0]['model_name'],
      };
      await axios.post(
        `${server.server.baseUrl}api/model-portfolio-db-update`,
        updateData,
        { headers: requestHeaders },
      );

      // Update subscriber execution status (matching web app)
      if (checkData && checkData.length > 0) {
        // Backend record-back publishes the authoritative status.

        // Record publisher results
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
            {
              modelName: filteredData[0]['model_name'],
              model_id: modelPortfolioModelId,
              unique_id: additionalPayload.unique_id,
              advisor: advisorTag,
              order_results: checkData,
              user_email: userEmail,
              user_broker: 'Fyers',
            },
            { headers: requestHeaders },
          );
        } catch (err) {
          console.warn('[FyersPublisher] record-publisher-results failed:', err);
        }
      }

      // Enroll in status-check-queue
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        {
          userEmail: userEmail,
          modelName: filteredData[0]['model_name'],
          advisor: advisorTag,
          broker: 'Fyers',
        },
        { headers: requestHeaders },
      );

      await AsyncStorage.removeItem('stockDetailsFyersOrder');
      // Cross-publisher cleanup — drop Zerodha pending state too.
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('zerodhaAdditionalPayload');

      // Emit structured portfolio events (matching prod)
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName: filteredData[0]?.['model_name'] || storeModalName,
      });
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName: filteredData[0]?.['model_name'] || storeModalName,
        broker: 'Fyers',
      })

      getRebalanceRepair();
      getModelPortfolioStrategyDetails();
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error('[FyersPublisher] Error:', error);

      const recovery = accountRecoveryMetadata(error);
      if (
        error?.response?.status === 409 &&
        (error?.response?.data?.code === 'RECHECK_UNAVAILABLE' || recovery.running)
      ) {
        if (recovery.operationId) {
          console.info('[AccountRecovery] Waiting for operation', recovery.operationId);
        }
        setOpenRebalanceModal(false);
        getRebalanceRepair();
        getModelPortfolioStrategyDetails();
        setTimeout(() => {
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
        }, recovery.retryAfterSeconds * 1000);
        return;
      }

      // Refused before dispatch (legacy, non-SDK path): nothing was sent.
      if (
        error?.response?.status === 409 &&
        (error?.response?.data?.code === 'MARKET_CLOSED' ||
          error?.response?.data?.dispatchState === 'NOT_SENT')
      ) {
        setOpenRebalanceModal(false);
        Alert.alert(
          'Orders not placed',
          error?.response?.data?.message ||
            'Nothing was sent to Fyers. Please try again during market hours.',
        );
        getRebalanceRepair();
        getModelPortfolioStrategyDetails();
        return;
      }

      // Frozen-plan 409 (PLAN_DRIFTED / expired / ALREADY_CONSUMED — see
      // REBALANCE_PLAN_FREEZE_PLAN.md §4.4): the plan_id we hold is dead.
      // Refresh repair/strategy data (mints a fresh calculate/repair plan on
      // next open) instead of just toasting a generic failure.
      if (error?.response?.status === 409 && error?.response?.data?.recompute) {
        setOpenRebalanceModal(false);
        const refusal = planRefusalMessage(
          error?.response?.data?.code,
          'Fyers',
          error?.response?.data?.message,
        );
        Alert.alert(refusal.title, refusal.message);
        getRebalanceRepair();
        getModelPortfolioStrategyDetails();
        return;
      }

      // The SDK checked sell authorization BEFORE placing and got a positive
      // "not authorized" for today's Fyers session (OrchestrationError
      // sell_auth_declined). Nothing was sent to Fyers. Open the guided TPIN
      // flow instead of a dead-end error; after TPIN the customer returns to
      // a fresh review.
      if (error?.code === 'sell_auth_declined') {
        setOpenRebalanceModal(false);
        setShowFyersTpinModal(true);
        Toast.show({
          type: 'info',
          text1: 'Authorize your Fyers sells first',
          text2: 'No orders were placed. Enter your Fyers TPIN, then place the order again.',
          visibilityTime: 7000,
        });
        return;
      }

      let errorMessage;
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') {
        errorMessage =
          'Unable to connect to Fyers trading server. Please reconnect your broker and try again.';
      } else if (
        error?.response?.status === 401 ||
        error?.response?.status === 403
      ) {
        errorMessage =
          'Fyers session has expired. Please reconnect your broker and try again.';
      } else {
        errorMessage =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          'Order placement failed';
      }

      Toast.show({
        type: 'error',
        text1: 'Order Failed',
        text2: errorMessage,
      });
      getModelPortfolioStrategyDetails();
    }
  };

  // --- End Fyers Publisher Flow Functions ---

  const placeOrder = async () => {
    console.log('[RebalanceModal] placeOrder called');
    console.log('[RebalanceModal] dataArray:', JSON.stringify(dataArray));
    console.log('[RebalanceModal] stockDetails:', JSON.stringify(stockDetails));
    console.log('[RebalanceModal] calculatedPortfolioData keys:', calculatedPortfolioData ? Object.keys(calculatedPortfolioData) : 'null');
    console.log('[RebalanceModal] calculatedPortfolioData buy:', JSON.stringify(calculatedPortfolioData?.buy));
    console.log('[RebalanceModal] calculatedPortfolioData sell:', JSON.stringify(calculatedPortfolioData?.sell));

    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) {
      // Open broker connection modal so user can re-authenticate
      setOpenRebalanceModal(false);
      setTimeout(() => openBrokerModal(broker), 500);
      return;
    }

    if (
      broker === 'Zerodha' &&
      publisherBuyContinuation?.attemptId &&
      publisherBuyContinuation?.buyLegs?.length
    ) {
      setLoading(true);
      try {
        await resumeZerodhaBuyPublisher(publisherBuyContinuation);
      } catch (error) {
        setLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Could not continue Zerodha buys',
          text2: error?.message || 'Please check the attempt again.',
          visibilityTime: 7000,
        });
      }
      return;
    }

    // Pre-order EDIS checks — only for equity delivery (CNC) sells.
    // Derivatives (NFO/BFO/MIS/NRML) do NOT need EDIS/DDPI authorization.
    const equityDeliverySells = stockDetails?.filter(s => {
      const txnType = (s.transactionType || s.TransactionType || '').toUpperCase();
      if (txnType !== 'SELL') return false;
      const exchange = (s.exchange || s.Exchange || '').toUpperCase();
      const productType = (s.productType || s.ProductType || 'CNC').toUpperCase();
      if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
      if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
      return true;
    }) || [];
    const hasEquitySells = equityDeliverySells.length > 0;
    const allSellPre = hasEquitySells && stockDetails?.every(s => s.transactionType === 'SELL');
    const isMixedPre = hasEquitySells && stockDetails?.some(s => s.transactionType === 'BUY');
    let liveUserDetails = userDetails;
    // Fyers status is advisory: its profile has returned ddpi_enabled:false
    // for accounts whose broker UI shows DDPI active. Let the broker attempt
    // the SELL and react only to an explicit backend sell-auth classification.
    if (hasEquitySells && broker !== 'Fyers' && getUserDeatils) {
      liveUserDetails = await getUserDeatils();
      if (!liveUserDetails) {
        Toast.show({
          type: 'error',
          text1: 'Sell authorization could not be verified',
          text2: 'Reconnect your broker or try again. No Publisher order was opened.',
          visibilityTime: 7000,
        });
        return;
      }
    }

    setLoading(true);

    if (broker === 'Dhan' && (allSellPre || isMixedPre) &&
      !isDhanSellAuthorizationReady(dhanEdisStatus, equityDeliverySells)) {
      setShowDhanTpinModel(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    // If user has completed TPIN authorization or has active DDPI, proceed
    const canSellZerodha = isZerodhaSellAuthorized(liveUserDetails);
    if (broker === 'Zerodha' && (allSellPre || isMixedPre) && !canSellZerodha) {
      setShowDdpiModal && setShowDdpiModal(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    if (broker === 'Angel One' && (allSellPre || isMixedPre) &&
      !liveUserDetails?.ddpi_enabled &&
      !liveUserDetails?.is_authorized_for_sell) {
      setShowAngleOneTpinModel(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    // AliceBlue / other brokers: check DB flag before placing sell orders
    // (AliceBlue has no EDIS API — relies on user authorizing at broker portal)
    if (['AliceBlue', 'IIFL Securities', 'ICICI Direct', 'Upstox', 'Kotak', 'Hdfc Securities', 'Motilal Oswal', 'Groww'].includes(broker) &&
      (allSellPre || isMixedPre) && !liveUserDetails?.is_authorized_for_sell) {
      setShowOtherBrokerModel(true);
      setOpenRebalanceModal(false);
      setLoading(false);
      return;
    }

    const hasDeferredT1Sell = stockDetails.some(
      stock => stock.transactionType === 'SELL' && Number(stock.t1Quantity || 0) > 0,
    );
    if (isMixedPre && hasDeferredT1Sell) {
      Toast.show({
        type: 'info',
        text1: 'T1-funded buys are preserved',
        text2:
          "Settled sells are usable immediately. Place today's fitted basket, then use Repair after the T1 portion settles for the frozen remainder.",
        visibilityTime: 9000,
      });
    }

    // Trade variant — `"AMO" | "REGULAR"`. Tagged on every per-trade
    // object at submit. See docs/APP_ARCHITECTURE.md § 4.5.2 Trade
    // variant field. Display-only — drives the amber AMO pill in
    // RecommendationSuccessModal. ccxt-india doesn't echo this field on
    // rebalance/process-trade; the success modal falls back to looking
    // it up against `originalStockDetails` (passed below).
    const variant = computeTradeVariant(brokerAfterHoursOrdersAllowed);
    const tradesWithVariant = stockDetails.map(stock => ({ ...stock, variant }));

    const getBasePayload = () => ({
      user_broker: broker,
      user_email: userEmail,
      trades: tradesWithVariant,
      model_id: modelPortfolioModelId,
      // Present only when the customer actually reduced something. ccxt
      // applies it as a clamp-DOWN on the frozen repair plan and stamps
      // `customer_reduction` on that plan, so the declined part is settled
      // rather than re-offered as a fresh Repair on the next poll.
      ...(customerReductionPayload().length
        ? {customerQuantities: customerReductionPayload()}
        : {}),
    });

    const getBrokerSpecificPayload = () => {
      if (broker === 'AliceBlue') {
        return { clientId: clientCode, accessToken: jwtToken, apiKey: apiKey };
      } else if (broker === 'Upstox') {
        return { apiKey: defaultDecrypt(apiKey), apiSecret: defaultDecrypt(secretKey), accessToken: jwtToken };
      } else if (broker === 'Dhan') {
        return { clientId: clientCode, accessToken: jwtToken };
      } else if (broker === 'Angel One') {
        return { apiKey: angelOneApiKey, jwtToken: jwtToken };
      } else if (broker === 'IIFL Securities') {
        return { clientCode: clientCode };
      } else if (broker === 'ICICI Direct') {
        return { apiKey: defaultDecrypt(apiKey), secretKey: defaultDecrypt(secretKey), accessToken: jwtToken };
      } else if (broker === 'Hdfc Securities') {
        return { apiKey: defaultDecrypt(apiKey), accessToken: jwtToken };
      } else if (broker === 'Kotak') {
        // Kotak NEO UUID flow (2026-04-22) — no consumer secret.
        return {
          apiKey: defaultDecrypt(apiKey),
          apiAccessToken: defaultDecrypt(apiKey),
          jwtToken,
          accessToken: jwtToken,
          sid,
          serverId,
          baseUrl: userDetails?.baseUrl,
        };
      } else if (broker === 'Fyers') {
        return { clientId: clientCode, accessToken: jwtToken };
      } else if (broker === 'Motilal Oswal') {
        return { clientCode: clientCode, accessToken: jwtToken, apiKey: defaultDecrypt(apiKey) };
      } else if (broker === 'Groww') {
        return { accessToken: jwtToken };
      } else {
        return { accessToken: jwtToken };
      }
    };

    const payload = {
      ...getBasePayload(),
      ...getBrokerSpecificPayload(),
      ...additionalPayload,
      // Include CA pending info for partial trade recording (matching web)
      caPendingInfo: calculatedPortfolioData?.caPendingInfo || [],
    };

    console.log('[RebalanceModal] Final payload trades count:', payload.trades?.length);
    console.log('[RebalanceModal] Final payload:', JSON.stringify({
      user_broker: payload.user_broker,
      user_email: payload.user_email,
      model_id: payload.model_id,
      modelName: payload.modelName,
      unique_id: payload.unique_id,
      tradesCount: payload.trades?.length,
      trades: payload.trades,
    }));

    // Guard: Don't send empty trades to broker
    if (!payload.trades || payload.trades.length === 0) {
      console.warn('[RebalanceModal] ERROR: trades array is empty! Aborting order placement.');
      Toast.show({
        type: 'error',
        text1: 'No Trades to Execute',
        text2: 'The trade list is empty. Please go back and try again.',
      });
      setLoading(false);
      return;
    }

    const specialBrokers = [
      'IIFL Securities',
      'ICICI Direct',
      'Upstox',
      'Kotak',
      'Hdfc Securities',
      'AliceBlue',
      'Motilal Oswal',
      'Groww',
    ];

    const config = {
      method: 'post',
      url: `${server.ccxtServer.baseUrl}rebalance/process-trade`,
      timeout: 120000,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': getTenantSubdomain(configData),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },

      data: JSON.stringify(payload),
    };

    // SDK executeAdvice dual-path (Phase C) — main broker path.
    // When SDK is enabled, it owns the placement attempt. The SDK result is
    // wrapped in a response-shaped object so the downstream handler works
    // unchanged. SDK failures join that same handler too: never fall through
    // to a second placement request, but always release the loading state.
    let sdkResponse = null;
    let sdkExecutionError = null;
    if (sdkExecuteAdviceEnabled) {
      try {
        const sdkResult = await sdkClient.executeAdvice(
          {
            kind: 'mpRebalance',
            clientAdviceId: `mp-rebalance:${broker}:${payload.plan_id || payload.unique_id || payload.model_id}`,
            brokerName: broker,
            modelId: payload.model_id,
            modelName: payload.modelName,
            uniqueId: payload.unique_id,
            // The frozen plan the customer reviewed. The legacy axios path
            // forwards these (they are part of `additionalPayload`); the SDK
            // path dropped them, so ccxt saw no `plan_id` and fell back to
            // server correlation — which deliberately excludes `kind:
            // "repair"` plans. A Repair placement was therefore refused
            // `409 PLAN_REQUIRED` with nothing dispatched (markup /
            // DefinEdge, 21 and 22 Sep 2026).
            ...(payload.plan_id
              ? {
                  planId: payload.plan_id,
                  ...(payload.plan_version != null
                    ? {planVersion: payload.plan_version}
                    : {}),
                  ...(payload.plan_hash ? {planHash: payload.plan_hash} : {}),
                }
              : {}),
            trades: payload.trades,
            // The SDK arg list is an explicit allowlist; this is how the
            // frozen plan ids went missing above. Forward the reduction too.
            ...(payload.customerQuantities
              ? {customerQuantities: payload.customerQuantities}
              : {}),
          },
          // 2026-05-07:
          // - skipReview=true: RebalanceModal Step 3 already shows
          //   the trade list + Note + Place Order button — SDK
          //   review sheet would be a redundant second confirmation.
          // - presentResult=false: legacy RecommendationSuccessModal
          //   (rendered by RebalanceAdvices on order completion)
          //   already shows the per-row success/failure breakdown +
          //   cautionary-listing banner + manual-placement guidance.
          //   Letting the SDK ALSO render its TradeResultModal stacks
          //   two result UIs and leaves a phantom Modal-window white
          //   patch on the left edge that intercepts touches (the
          //   SDK overlay's `phase: 'result'` never transitions back
          //   to `idle` once the result fires, so the Modal stays
          //   mounted indefinitely).
          { skipReview: true, presentResult: false },
        );
        // 2026-05-07: pass through SDK rows verbatim. The SDK now
        // preserves ccxt's original `orderStatus` / `errorCode` /
        // `message_aq` / `tradingSymbol` via spread, so frontend
        // utilities (orderStatusUtils.normalizeOrderStatus, the
        // cautionary-listing detection in RecommendationSuccessModal,
        // etc.) consume the broker-flavoured fields directly — same
        // code path as the legacy axios flow, no second translation.
        // A refusal before dispatch (MARKET_CLOSED, expired broker session,
        // drifted plan) comes back with zero rows and the server's own
        // sentence in `recovery.message`. Carry it into the legacy envelope
        // so the empty-results branch below says why instead of "No orders
        // were processed by the broker. Please try again." (2026-09-22).
        sdkResponse = {
          data: {
            results: sdkResult?.rows || [],
            ...(sdkResult?.notSent === true
              ? {
                  code: sdkResult.code,
                  message: sdkResult?.recovery?.message,
                  notSent: true,
                  sessionExpired:
                    sdkResult?.recovery?.reason === 'broker_session_expired',
                }
              : {}),
          },
        };
        console.log('[RebalanceModal] SDK executeAdvice (main) result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
      } catch (sdkErr) {
        console.error('[RebalanceModal] SDK owns this attempt; legacy fallback blocked:', sdkErr?.message);
        sdkExecutionError = sdkErr;
      }
    }

    await (sdkExecutionError
      ? Promise.reject(sdkExecutionError)
      : sdkResponse
        ? Promise.resolve(sdkResponse)
        : axios.request(config))
      .then(async response => {
        const checkData = response?.data?.results;
        console.log('[RebalanceModal] process-trade response:', JSON.stringify({
          resultsCount: checkData?.length,
          status: response?.data?.status,
          message: response?.data?.message,
          error: response?.data?.error,
        }));
        setOrderPlacementResponse(response?.data?.results);
        setLastSubmittedTrades?.(tradesWithVariant);

        // Handle session expired - broker needs reconnection
        if (response?.data?.sessionExpired) {
          setOpenRebalanceModal(false);
          setLoading(false);
          Toast.show({
            type: 'error',
            text1: 'Session Expired',
            text2: `Your ${broker} session has expired. Please reconnect your broker.`,
            visibilityTime: 5000,
          });
          // Open broker connection modal so user can re-authenticate
          setTimeout(() => {
            openBrokerModal(broker);
          }, 500);
          return;
        }

        // Guard: If backend returned empty results, check for cautionary listing or show error
        if (!checkData || checkData.length === 0) {
          const errorMsg = response?.data?.message || response?.data?.error || '';
          const isCautionaryError = errorMsg.toLowerCase().includes('cautionary') && errorMsg.toLowerCase().includes('listing');
          console.warn('[RebalanceModal] Empty results from process-trade:', errorMsg, 'isCautionary:', isCautionaryError);

          if (isCautionaryError) {
            const syntheticResults = (payload.trades || []).map(trade => ({
              symbol: trade.tradingSymbol || trade.symbol || trade.Trading_Symbol || '',
              searchSymbol: trade.tradingSymbol || trade.symbol || '',
              transactionType: trade.transactionType || trade.transaction_type || 'BUY',
              quantity: trade.quantity || trade.qty || 0,
              orderType: trade.orderType || trade.order_type || 'MARKET',
              exchange: trade.exchange || 'NSE',
              orderStatus: 'REJECTED',
              orderStatusMessage: errorMsg,
              message_aq: errorMsg,
              // Carry variant through synthetic-rejection rendering too.
              variant: trade.variant || 'REGULAR',
            }));
            setOrderPlacementResponse(syntheticResults);
            setLastSubmittedTrades?.(payload.trades);
            setOpenRebalanceModal(false);
            setLoading(false);
            setOpenSucessModal(true);
            getModelPortfolioStrategyDetails();
            return;
          }

          // A server refusal before dispatch is not a TPIN problem and not a
          // broker rejection: nothing was sent. Say why and let them retry
          // when the reason clears (market hours, reconnect, recalculate).
          if (response?.data?.notSent === true) {
            // An Alert, not a toast: a toast over a closing screen looked
            // like nothing happened.
            Alert.alert(
              'Orders not placed',
              errorMsg || 'Your broker did not receive these orders. Nothing was placed.',
            );
            setOpenRebalanceModal(false);
            setLoading(false);
            return;
          }

          // An empty Fyers response is not proof of missing sell
          // authorization. Preserve the actual processing failure instead of
          // replacing it with a TPIN screen.
          if ((allSellPre || isMixedPre) && broker !== 'Fyers') {
            if (broker === 'Dhan') {
              setShowDhanTpinModel(true);
            } else if (broker === 'Angel One') {
              setShowAngleOneTpinModel(true);
            } else if (broker === 'Zerodha') {
              setShowDdpiModal && setShowDdpiModal(true);
            } else {
              setShowOtherBrokerModel(true);
            }
            setOpenRebalanceModal(false);
            setLoading(false);
            return;
          }

          // Non-sell empty results: show error toast
          Toast.show({
            type: 'error',
            text1: 'Order Processing Failed',
            text2: errorMsg || 'No orders were processed by the broker. Please try again.',
            visibilityTime: 5000,
          });
          setOpenRebalanceModal(false);
          setLoading(false);
          getModelPortfolioStrategyDetails();
          return;
        }

        // Equity delivery sells only — derivatives don't need EDIS/DDPI
        const eqSellsPost = (checkData || []).filter(s => {
          const txnType = (s.transactionType || s.TransactionType || '').toUpperCase();
          if (txnType !== 'SELL') return false;
          const exchange = (s.exchange || s.Exchange || '').toUpperCase();
          const productType = (s.productType || s.ProductType || 'CNC').toUpperCase();
          if (['NFO', 'BFO', 'MCX'].includes(exchange)) return false;
          if (['MIS', 'NRML', 'CARRYFORWARD'].includes(productType)) return false;
          return true;
        });
        const isMixed = eqSellsPost.length > 0 && checkData?.some(stock => stock.transactionType === 'BUY');
        const allBuy = checkData?.every(stock => stock.transactionType === 'BUY');
        const allSell = eqSellsPost.length > 0 && checkData?.every(stock => stock.transactionType === 'SELL');

        const rejectedSellCount = (checkData || []).reduce(
          (count, order) => {
            return isOrderRejected(order?.orderStatus) &&
              order.transactionType === 'SELL'
              ? count + 1
              : count;
          },
          0,
        );

        const successCount = (checkData || []).reduce((count, order) => {
          return isOrderSuccess(order?.orderStatus) &&
            (order.transactionType === 'SELL' || isMixed)
            ? count + 1
            : count;
        }, 0);

        // Detect all orders failed with rich error data from backend (matching web)
        const backendOrderErrors = response?.data?.orderErrors || [];
        const backendFundsRequired = response?.data?.fundsRequired;
        const allOrdersFailed = (checkData || []).every(order => {
          const s = (order?.orderStatus || '').toUpperCase();
          return s === 'REJECTED' || s === 'CANCELLED' || s === 'FAILURE' || s === 'FAILED';
        });
        const sellAuthRejected = hasExplicitSellAuthRejection({
          ...(response?.data || {}),
          results: checkData,
        });

        // Transient service-window short-circuit: if every failed row is a
        // known broker maintenance-window error (e.g. Upstox UDAPI100074
        // between 00:00–05:30 IST), show a soft toast and close the modal
        // instead of the all-failed modal. Broker session is fine — just
        // retry after the window reopens.
        const transientServiceWindowMsg = detectTransientOrderWindowError(response?.data);
        if (transientServiceWindowMsg) {
          Toast.show({
            type: 'info',
            text1: 'Broker service window',
            text2:
              transientServiceWindowMsg ||
              `${broker} order placement is temporarily unavailable. Try again during the broker's service hours.`,
            visibilityTime: 8000,
          });
          setOpenRebalanceModal(false);
          setLoading(false);
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          return;
        }

        if (
          allOrdersFailed &&
          backendOrderErrors.length > 0 &&
          !(broker === 'Fyers' && sellAuthRejected)
        ) {
          // Show success modal with failure details (matches web behavior)
          setOrderPlacementResponse(checkData);
          setLastSubmittedTrades?.(tradesWithVariant);
          setOpenSucessModal(true);
          setOpenRebalanceModal(false);
          setLoading(false);
          if (backendFundsRequired) {
            Toast.show({
              type: 'error',
              text1: 'Insufficient Funds',
              text2: `Amount needed: \u20B9${parseFloat(backendFundsRequired).toFixed(2)}. Please add funds and retry.`,
              visibilityTime: 6000,
            });
          }
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          return;
        }

        // Check for CDSL/EDIS/TPIN error messages in rejected orders
        const hasCdslError = (checkData || []).some((order) => {
          const msg = (order?.orderStatusMessage || order?.message_aq || order?.message || "").toLowerCase();
          return msg.includes("cdsl") || msg.includes("edis") || msg.includes("tpin") || msg.includes("validate qty");
        });
        // Check for cautionary listing rejections - these should bypass TPIN/EDIS modals
        const hasCautionaryRejection = (checkData || []).some((order) => {
          const msg = (order?.orderStatusMessage || order?.message_aq || order?.message || "").toLowerCase();
          return msg.includes("cautionary") && msg.includes("listing");
        });

        // If cautionary listing rejection, go directly to success modal to show the alert
        if (hasCautionaryRejection) {
          setOpenSucessModal(true);
          setOpenRebalanceModal(false);
          setLoading(false);
          // Still do db update and status check
          try {
            await axios.post(
              `${server.server.baseUrl}api/model-portfolio-db-update`,
              {
                modelId: modelPortfolioModelId,
                orderResults: checkData,
                userEmail: userEmail,
                modelName: filteredData[0]['model_name'],
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  'X-Advisor-Subdomain': getTenantSubdomain(configData),
                  'aq-encrypted-key': generateToken(
                    Config.REACT_APP_AQ_KEYS,
                    Config.REACT_APP_AQ_SECRET,
                  ),
                },
              },
            );
          } catch (dbErr) {
            console.warn('Error updating db after cautionary rejection:', dbErr);
          }
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          return;
        }

        // Dhan: Check CDSL error messages first
        if (
          broker === 'Dhan' &&
          (allSell || isMixed) &&
          rejectedSellCount >= 1 &&
          hasCdslError
        ) {
          setShowDhanTpinModel(true);
          setOpenRebalanceModal(false);
          setLoading(false);
          return;
        }

        if (
          !isReturningFromOtherBrokerModal &&
          specialBrokers.includes(broker)
        ) {
          if (allBuy) {
            setOpenSucessModal(true);
            setOpenRebalanceModal(false);
          } else if (
            (allSell || isMixed) &&
            rejectedSellCount >= 1 &&
            successCount === 0
          ) {
            setShowOtherBrokerModel(true);
            setOpenRebalanceModal(false);
            setLoading(false);
            return;
          } else {
            setOpenSucessModal(true);
            setOpenRebalanceModal(false);
          }
        } else if (
          (allSell || isMixed) &&
          rejectedSellCount >= 1 &&
          (broker !== 'Fyers' || sellAuthRejected)
        ) {
          // Always show broker-specific TPIN modal for rejected sell orders
          // Don't rely on CDSL keyword detection - error message formats can change
          setOpenSucessModal(false);
          setLoading(false);
          setOpenRebalanceModal(false);

          if (broker === 'Dhan') {
            setShowDhanTpinModel(true);
          } else if (broker === 'Angel One') {
            setShowAngleOneTpinModel(true);
          } else if (broker === 'Zerodha') {
            setShowDdpiModal && setShowDdpiModal(true);
          } else if (broker === 'Fyers') {
            setShowFyersTpinModal(true);
          } else {
            setShowOtherBrokerModel(true);
          }
          return;
        } else {
          setOpenSucessModal(true);
          setOpenRebalanceModal(false);
        }

        getRebalanceRepair();
        const updateData = {
          modelId: modelPortfolioModelId,
          orderResults: checkData,
          userEmail: userEmail,
          modelName: filteredData[0]['model_name'],
        };

        return axios.post(
          `${server.server.baseUrl}api/model-portfolio-db-update`,
          updateData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
      })
      .then(() => {
        // Add user to status check queue for async order status polling (matching web frontend)
        const statusCheckData = {
          userEmail: userEmail,
          modelName: filteredData[0]['model_name'],
          advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          broker: broker,
        };
        return axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          statusCheckData,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
      })
      .then(() => {
        setLoading(false);
        setOpenRebalanceModal(false);

        // Emit structured portfolio events (matching prod)
        portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
          userEmail,
          modelName: filteredData[0]?.['model_name'] || storeModalName,
        });
        portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED, {
          userEmail,
          modelName: filteredData[0]?.['model_name'] || storeModalName,
          broker,
        });

        getModelPortfolioStrategyDetails();
      })
      .catch(error => {
        setLoading(false);

        // A server-side pre-dispatch refusal (most importantly MARKET_CLOSED)
        // deliberately has no broker result rows because no broker API was
        // called.  Previously this fell through to a short-lived toast, so the
        // customer never saw the same durable Trade Details screen used for a
        // broker rejection.  Render local, explicitly NOT-SENT rows instead;
        // do not enqueue status polling or persist them as broker orders.
        const refusalCode = String(
          error?.response?.data?.code || error?.response?.data?.error || '',
        ).toUpperCase();
        const refusalMessage =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'The order was rejected before it reached the broker.';
        const isDefinitivePreDispatchRefusal = [
          'MARKET_CLOSED',
          'PUBLISHER_ROUTE_REQUIRED',
        ].includes(refusalCode);

        if (isDefinitivePreDispatchRefusal) {
          const returnedRows = error?.response?.data?.results;
          const rejectedRows = Array.isArray(returnedRows) && returnedRows.length
            ? returnedRows
            : (tradesWithVariant || payload.trades || []).map(trade => ({
                ...trade,
                symbol:
                  trade.tradingSymbol ||
                  trade.symbol ||
                  trade.Trading_Symbol ||
                  '',
                searchSymbol:
                  trade.searchSymbol ||
                  trade.tradingSymbol ||
                  trade.symbol ||
                  '',
                transactionType:
                  trade.transactionType || trade.transaction_type || 'BUY',
                quantity: trade.quantity || trade.qty || 0,
                orderType: trade.orderType || trade.order_type || 'MARKET',
                orderStatus: 'FAILURE',
                orderStatusMessage: refusalMessage,
                message_aq: refusalMessage,
                errorCode: refusalCode,
                orderId: '',
                brokerDispatchState: 'NOT_SENT',
              }));

          setOrderPlacementResponse(rejectedRows);
          setLastSubmittedTrades?.(tradesWithVariant || payload.trades);
          setOpenRebalanceModal(false);
          setOpenSucessModal(true);
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          return;
        }

        const recovery = accountRecoveryMetadata(error);
        if (
          error?.response?.status === 409 &&
          (error?.response?.data?.code === 'RECHECK_UNAVAILABLE' || recovery.running)
        ) {
          if (recovery.operationId) {
            console.info('[AccountRecovery] Waiting for operation', recovery.operationId);
          }
          setOpenRebalanceModal(false);
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          setTimeout(() => {
            getRebalanceRepair();
            getModelPortfolioStrategyDetails();
          }, recovery.retryAfterSeconds * 1000);
          return;
        }

        // Frozen-plan 409 (PLAN_DRIFTED / expired / ALREADY_CONSUMED — see
        // REBALANCE_PLAN_FREEZE_PLAN.md §4.4): the plan_id we hold is dead,
        // so re-sliding "Place Order" would 409 forever. Close the modal and
        // refresh repair/strategy data so the next open mints a fresh plan —
        // mirrors web's recompute handling.
        // An Alert, not a toast: closing the screen with a short-lived toast
        // looked like the order silently vanished (moneyman ICICI, 7 Oct 2026).
        if (error?.response?.status === 409 && error?.response?.data?.recompute) {
          setOpenRebalanceModal(false);
          const refusal = planRefusalMessage(
            error?.response?.data?.code,
            broker,
            error?.response?.data?.message,
          );
          Alert.alert(refusal.title, refusal.message);
          getRebalanceRepair();
          getModelPortfolioStrategyDetails();
          return;
        }

        // Determine a user-friendly error message
        let errorMessage;
        if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') {
          errorMessage = `Unable to connect to ${broker} trading server. This could be due to broker session expiry or a temporary server issue. Please reconnect your broker and try again.`;
        } else if (error?.response?.status === 401 || error?.response?.status === 403) {
          errorMessage = `${broker} session has expired. Please reconnect your broker.`;
          // Open broker connection modal so user can re-authenticate
          setOpenRebalanceModal(false);
          setTimeout(() => {
            openBrokerModal(broker);
          }, 500);
        } else {
          errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Order placement failed';
        }

        // Fyers recovery is broker-evidence-first. A timeout, session error or
        // generic SELL failure must keep its real error instead of opening
        // TPIN. Other broker behavior remains unchanged here.
        if (
          (allSellPre || isMixedPre) &&
          (broker !== 'Fyers' ||
            hasExplicitSellAuthRejection(error?.response?.data))
        ) {
          if (broker === 'Dhan') {
            setShowDhanTpinModel(true);
          } else if (broker === 'Angel One') {
            setShowAngleOneTpinModel(true);
          } else if (broker === 'Zerodha') {
            setShowDdpiModal && setShowDdpiModal(true);
          } else if (broker === 'Fyers') {
            setShowFyersTpinModal(true);
          } else {
            setShowOtherBrokerModel(true);
          }
          setOpenRebalanceModal(false);
          return;
        }

        Toast.show({
          type: 'error',
          text1: 'Order Failed',
          text2: errorMessage,
        });
        getModelPortfolioStrategyDetails();
      });
    setIsReturningFromOtherBrokerModal(false);
  };

  const handleClose = () => {
    stopOrderPolling();
    setWebView(false);
    setZerodhaStatus(null);
    setZerodhaRequestType(null);
    setOpenRebalanceModal(false);
  };

  const onSlideComplete = async () => {
    // React state does not disable the button until the next render. Guard the
    // current frame too so a double tap cannot start two session checks/order
    // attempts before `loading` becomes visible.
    if (orderActionInFlightRef.current) return;
    orderActionInFlightRef.current = true;
    try {
      if (!isRepairMode && !ensureRebalanceExecutable()) {
        return;
      }
      if (broker === 'Zerodha') {
        if (publisherBuyContinuation?.attemptId) {
          await placeOrder();
        } else {
          await handleZerodhaRedirect();
        }
      } else if (broker === 'Fyers') {
        await handleFyersRedirect();
      } else {
        await placeOrder();
      }
    } finally {
      orderActionInFlightRef.current = false;
    }
  };

  // `allowAfterHoursOrders` is destructured at the top of the component
  // body — single source of truth (see comment at top).
  const marketGateOpen = canAttemptRebalancePlacement({
    broker,
    marketOpen: IsMarketHours(),
    allowAfterHoursOrders,
  });

  // The Kite run returns before record-back and the order-book check finish.
  // Re-showing a placeable review in that window reads as "nothing happened,
  // place them again" while the orders are already sitting with the broker
  // (moneyman tester, 2026-09-17). Closing the modal still ends the wait.
  const awaitingOrderStatus = zerodhaStatus === 'success' && !webView;

  const ListItem = React.memo(
    ({
      item,
      index,
      isBrokerDisconnected,
      handlePriceSave,
      handleQtySave,
      getLTPForSymbol,
      // Repair-mode props — see § 6g
      isRepairMode,
      recordManualPlacement,
      manualPlacementInFlight,
      manuallyPlacedSymbols,
      // P3.2 repair-time customer quantity
      isRepairQtyEditable,
      repairApprovedQty,
      repairChosenQty,
      onRepairQtyChange,
    }) => {
      // 🧠 Local state for TextInput values
      const [localPrice, setLocalPrice] = React.useState(
        item.editablePrice?.toString() ?? '',
      );
      const [localQty, setLocalQty] = React.useState(
        item.editableQty?.toString() ?? '',
      );

      const displayPrice = isBrokerDisconnected
        ? localPrice
        : getLTPForSymbol(item.symbol)?.toString() ?? '0';

      const displayQuantity = isBrokerDisconnected
        ? localQty
        : item.qty?.toString() ?? '0';

      // Classify the row for the chip. Cautionary takes precedence over
      // LOW_FUNDS in the chip copy — cautionary requires placing manually
      // by definition, whereas LOW_FUNDS may be transient (user adds
      // funds → retry succeeds).
      const isCautionary = isRepairMode && isCautionaryListingMessage(item);
      const isLowFunds =
        isRepairMode && !isCautionary && isInsufficientFundsMessage(item);
      const isPartialFill = isRepairMode && item.isPartialFill;
      const isFundingPending = isRepairMode && item.isFundingPending;
      const isDeferredT1 = isRepairMode && item.isDeferredT1 && !isFundingPending;
      const showChip =
        isCautionary || isLowFunds || isPartialFill || isDeferredT1 || isFundingPending;
      const isThisRowSubmitting = manualPlacementInFlight === item.symbol;
      const isAlreadyMarked = !!manuallyPlacedSymbols?.[item.symbol];

      // Only a cautionary listing offers "Mark as placed": the broker API will
      // never accept it, so the customer has to place it in the broker app.
      // Funds / partial / funding-pending / T1 rows are re-placed by Repair
      // itself; recording them by hand as well would book a fill Repair then
      // buys again (same rule as RecommendationSuccessModal, 2026-09-23).
      const canMarkAsPlaced = isCautionary && !isAlreadyMarked;
      const [placementEditorOpen, setPlacementEditorOpen] =
        React.useState(false);
      const [placedQty, setPlacedQty] = React.useState('');
      const [placedPrice, setPlacedPrice] = React.useState('');
      const [placementError, setPlacementError] = React.useState('');
      const maxPlacedQty = Number(item.qty) || 0;

      const openPlacementEditor = () => {
        const ltp = Number(getLTPForSymbol(item.symbol));
        setPlacedQty(maxPlacedQty > 0 ? String(maxPlacedQty) : '');
        // LTP is only a starting point; the customer confirms the price the
        // broker actually filled at, because it becomes the cost basis.
        setPlacedPrice(Number.isFinite(ltp) && ltp > 0 ? ltp.toFixed(2) : '');
        setPlacementError('');
        setPlacementEditorOpen(true);
      };

      const confirmPlacement = async () => {
        const qty = Number(placedQty);
        const price = Number(placedPrice);
        if (!Number.isInteger(qty) || qty < 1 || qty > maxPlacedQty) {
          setPlacementError(
            `Enter the shares you actually ${item.orderType === 'SELL' ? 'sold' : 'bought'} (1 to ${maxPlacedQty}).`,
          );
          return;
        }
        if (!Number.isFinite(price) || price <= 0) {
          setPlacementError('Enter the average price shown in your broker app.');
          return;
        }
        setPlacementError('');
        const saved = await recordManualPlacement(item, {qty, price});
        if (saved) setPlacementEditorOpen(false);
      };

      const chipLabel = isAlreadyMarked
        ? 'Marked as placed ✓'
        : isCautionary
        ? 'Cautionary listing — place manually'
        : isLowFunds
        ? 'Insufficient funds last time'
        : isPartialFill
        ? `Partial fill last time (${item.filledQty}/${item.originalQty})`
        : isFundingPending
        ? `Waiting for funds${Number(item.fundingRequired) > 0 ? ` · ₹${Math.round(Number(item.fundingRequired)).toLocaleString('en-IN')}` : ''}`
        : isDeferredT1
        ? 'T1 proceeds — Repair after settlement'
        : '';

      const chipStyle = isAlreadyMarked
        ? styles.chipDone
        : isCautionary
        ? styles.chipCautionary
        : isLowFunds
        ? styles.chipLowFunds
        : isFundingPending
        ? styles.chipCautionary
        : isDeferredT1
        ? styles.chipPartial
        : styles.chipPartial;

      return (
        <View style={styles.rowContainer}>
          <View style={{flex: 1}}>
            <View style={styles.leftContainer}>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text
                style={[
                  styles.cellText,
                  item.orderType === 'BUY' ? styles.buyOrder : styles.sellOrder,
                ]}>
                {item.orderType}
              </Text>
            </View>
            {showChip && (
              <TouchableOpacity
                onPress={
                  canMarkAsPlaced && !isThisRowSubmitting
                    ? openPlacementEditor
                    : undefined
                }
                disabled={!canMarkAsPlaced || isThisRowSubmitting}
                activeOpacity={canMarkAsPlaced ? 0.6 : 1}
                style={[styles.chipBase, chipStyle]}>
                {isThisRowSubmitting ? (
                  <ActivityIndicator size="small" color={designColor('9a3412')} />
                ) : (
                  <>
                    {!isAlreadyMarked && <AlertTriangle size={11} color={designColor('9a3412')} />}
                    <Text
                      style={[
                        styles.chipText,
                        isAlreadyMarked && styles.chipTextDone,
                      ]}>
                      {chipLabel}
                      {canMarkAsPlaced && !placementEditorOpen
                        ? ' · Mark as placed'
                        : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {canMarkAsPlaced && placementEditorOpen && (
              <View style={styles.placementEditor}>
                <Text style={styles.placementEditorHint}>
                  Only after the {item.orderType} order shows as executed in
                  your broker app. Enter what you actually{' '}
                  {item.orderType === 'SELL' ? 'sold' : 'bought'}.
                </Text>
                <View style={styles.placementEditorRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.placementEditorLabel}>
                      Shares (max {maxPlacedQty})
                    </Text>
                    <TextInput
                      style={styles.placementEditorInput}
                      value={placedQty}
                      onChangeText={text =>
                        setPlacedQty(text.replace(/[^0-9]/g, ''))
                      }
                      keyboardType="number-pad"
                      editable={!isThisRowSubmitting}
                    />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.placementEditorLabel}>
                      Avg price (₹)
                    </Text>
                    <TextInput
                      style={styles.placementEditorInput}
                      value={placedPrice}
                      onChangeText={text =>
                        setPlacedPrice(text.replace(/[^0-9.]/g, ''))
                      }
                      keyboardType="decimal-pad"
                      placeholder="e.g. 51.20"
                      editable={!isThisRowSubmitting}
                    />
                  </View>
                </View>
                {!!placementError && (
                  <Text style={styles.placementEditorError}>
                    {placementError}
                  </Text>
                )}
                <View style={styles.placementEditorRow}>
                  <TouchableOpacity
                    onPress={() => setPlacementEditorOpen(false)}
                    disabled={isThisRowSubmitting}
                    style={styles.placementCancelButton}>
                    <Text style={styles.placementCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmPlacement}
                    disabled={isThisRowSubmitting}
                    style={styles.placementConfirmButton}>
                    {isThisRowSubmitting ? (
                      <ActivityIndicator size="small" color={designColor('ffffff')} />
                    ) : (
                      <Text style={styles.placementConfirmText}>
                        Confirm placed
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          <View style={styles.rightContainer}>
            {isBrokerDisconnected ? (
              <TextInput
                style={styles.quantityInput}
                value={displayPrice}
                onChangeText={setLocalPrice} // only local change
                onEndEditing={() => handlePriceSave(index, localPrice)} // save to parent once done
                keyboardType="numeric"
                placeholder="Price"
                returnKeyType="done"
                blurOnSubmit={false}
              />
            ) : (
              <Text style={styles.qty}>{displayPrice}</Text>
            )}
          </View>
          <View style={styles.rightContainer}>
            {isBrokerDisconnected ? (
              <TextInput
                style={styles.quantityInput}
                value={displayQuantity}
                onChangeText={setLocalQty}
                onEndEditing={() => handleQtySave(index, localQty)}
                keyboardType="numeric"
                placeholder="Qty"
                returnKeyType="done"
                blurOnSubmit={false}
              />
            ) : isRepairQtyEditable?.(item) ? (
              <View style={{alignItems: 'flex-end'}}>
                <TextInput
                  style={styles.quantityInput}
                  value={String(repairChosenQty(item))}
                  onChangeText={text => onRepairQtyChange(item, text)}
                  keyboardType="numeric"
                  returnKeyType="done"
                  blurOnSubmit={false}
                  accessibilityLabel={`Quantity to buy for ${item.symbol}, up to ${repairApprovedQty(item)}`}
                />
                <Text style={styles.repairQtyHint}>
                  of {repairApprovedQty(item)}
                </Text>
                {repairChosenQty(item) < repairApprovedQty(item) ? (
                  <Text style={styles.repairQtyReduced}>
                    {repairApprovedQty(item) - repairChosenQty(item)} not bought
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.qty}>{item.qty}</Text>
            )}
          </View>
        </View>
      );
    },
  );

  const renderListItem = useCallback(
    ({ item, index }) => (
      <ListItem
        isRepairQtyEditable={isRepairQtyEditable}
        repairApprovedQty={repairApprovedQty}
        repairChosenQty={repairChosenQty}
        onRepairQtyChange={handleRepairQtyChange}
        item={item}
        index={index}
        isBrokerDisconnected={isBrokerDisconnected}
        handlePriceSave={handlePriceSave}
        handleQtySave={handleQtySave}
        getLTPForSymbol={getLTPForSymbol}
        isRepairMode={isRepairMode}
        recordManualPlacement={markRowAsManuallyPlaced}
        manualPlacementInFlight={manualPlacementInFlight}
        manuallyPlacedSymbols={manuallyPlacedSymbols}
      />
    ),
    [
      isBrokerDisconnected,
      handlePriceSave,
      handleQtySave,
      getLTPForSymbol,
      isRepairMode,
      markRowAsManuallyPlaced,
      manualPlacementInFlight,
      manuallyPlacedSymbols,
    ],
  );

  const debouncedHandlePriceSave = useCallback(
    debounce((index, price) => {
      setEditableData(prev =>
        prev.map((item, i) =>
          i === index ? { ...item, editablePrice: price } : item,
        ),
      );
    }, 300),
    [],
  );

  const debouncedHandleQtySave = useCallback(
    debounce((index, qty) => {
      setEditableData(prev =>
        prev.map((item, i) =>
          i === index ? { ...item, editableQty: qty } : item,
        ),
      );
    }, 300),
    [],
  );

  const handlePriceSave = (index, price) => {
    debouncedHandlePriceSave(index, parseFloat(price) || 0);
  };

  const handleQtySave = (index, qty) => {
    debouncedHandleQtySave(index, parseInt(qty) || 0);
  };

  // Mark a repair-mode row as manually placed. Calls aq_backend's
  // /api/model-portfolio-db-update/manual-placement so the manager's
  // model_portfolio.rebalanceHistory[].adviceEntries[].status flips to
  // "executed" + manually_placed_at is stamped, then mutates the local
  // dataArray to remove the row visually. Mirrors mobile MP success
  // modal's per-row editor (RecommendationSuccessModal.js:290): the row's
  // inline editor collects the shares and average price the broker actually
  // filled. Both are required — the server books them as the holding's cost
  // basis and rejects a missing/zero price. (Until 2026-10-07 this sent the
  // live LTP, or null when no LTP had arrived, which 400'd.)
  // See docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g.
  const [manuallyPlacedSymbols, setManuallyPlacedSymbols] = useState({});
  const [manualPlacementInFlight, setManualPlacementInFlight] = useState(null);
  const markRowAsManuallyPlaced = useCallback(
    async (item, actual) => {
      if (!modelPortfolioModelId || !item?.symbol) {
        Toast.show({
          type: 'error',
          text1: 'Cannot record placement',
          text2: 'Missing rebalance reference. Please retry from the portfolio.',
          visibilityTime: 4000,
        });
        return false;
      }
      const actualQty = Number(actual?.qty);
      const actualPrice = Number(actual?.price);
      if (
        !Number.isInteger(actualQty) ||
        actualQty < 1 ||
        !Number.isFinite(actualPrice) ||
        actualPrice <= 0
      ) {
        return false;
      }
      try {
        setManualPlacementInFlight(item.symbol);
        await axios.put(
          `${server.server.baseUrl}api/model-portfolio-db-update/manual-placement`,
          {
            userEmail,
            modelId: modelPortfolioModelId,
            modelName: storeModalName,
            user_broker: broker || 'DummyBroker',
            symbol: item.symbol,
            exchange: item.exchange,
            transactionType: item.orderType,
            actualQty,
            actualPrice,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getTenantSubdomain(configData),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        setManuallyPlacedSymbols(prev => ({...prev, [item.symbol]: true}));
        // Refresh the repair list so the row vanishes on next render.
        if (typeof getRebalanceRepair === 'function') {
          getRebalanceRepair();
        }
        portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
          userEmail,
          modelName: storeModalName,
          broker,
        });
        Toast.show({
          type: 'success',
          text1: 'Marked as placed',
          text2: `${item.symbol} recorded as manually placed.`,
          visibilityTime: 3000,
        });
        return true;
      } catch (e) {
        console.error(
          '[RebalanceModal manual-placement] error:',
          e?.response?.data || e?.message,
        );
        Toast.show({
          type: 'error',
          text1: 'Could not save',
          text2:
            e?.response?.data?.message ||
            e?.message ||
            'Try again in a moment.',
          visibilityTime: 4000,
        });
        return false;
      } finally {
        setManualPlacementInFlight(null);
      }
    },
    [
      modelPortfolioModelId,
      userEmail,
      storeModalName,
      broker,
      configData,
      getRebalanceRepair,
    ],
  );

  const renderFundingConsentPanel = () => {
    if (!fundingConsent?.show) {
      return null;
    }

    const panelCopy = fundingPanelCopy(fundingConsent);
    if (panelCopy.warning) {
      return (
        <View style={styles.fundingConsentContainer}>
          <Text style={styles.fundingConsentTitle}>{panelCopy.title}</Text>
          <Text style={styles.fundingConsentText}>{panelCopy.body}</Text>
          <TouchableOpacity
            disabled={reducingFunding || loading}
            onPress={showAddFundsInstructions}
            style={styles.fundingSecondaryButton}>
            <Text style={styles.fundingSecondaryButtonText}>How to add funds</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.fundingConsentContainer}>
        <Text style={styles.fundingConsentTitle}>{panelCopy.title}</Text>
        <Text style={styles.fundingConsentText}>
          Add ₹{Number(fundingConsent.shortfall || 0).toLocaleString('en-IN')}{fundingConsent.canContinueWithAvailableFunds ? ' to include everything, or continue with available funds for this calculation' : fundingConsent.canAttemptWithInsufficientFunds ? ', or review the target stocks and attempt the buy. Your broker may reject the orders' : ' to your broker, then calculate again'}. Your investment target stays unchanged. Closing this screen makes no change.
        </Text>
        {fundingConsent.canContinueWithAvailableFunds && (
          <TouchableOpacity
            disabled={reducingFunding || loading}
            onPress={continueWithAvailableFunds}
            style={styles.fundingPrimaryButton}>
            <Text style={styles.fundingPrimaryButtonText}>
              Continue with available funds
            </Text>
          </TouchableOpacity>
        )}
        {fundingConsent.canAttemptWithInsufficientFunds && (
          <TouchableOpacity
            disabled={reducingFunding || loading}
            onPress={attemptWithInsufficientFunds}
            style={styles.fundingPrimaryButton}>
            <Text style={styles.fundingPrimaryButtonText}>
              Review stocks and attempt buy
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          disabled={reducingFunding || loading}
          onPress={showAddFundsInstructions}
          style={styles.fundingSecondaryButton}>
          <Text style={styles.fundingSecondaryButtonText}>
            {fundingConsent.canContinueWithAvailableFunds || fundingConsent.canAttemptWithInsufficientFunds ? 'Add funds instead' : 'How to add funds'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (visible && webView) {
    return (
      <PublisherWebViewOverlay
        source={publisherWebViewSource}
        webViewRef={webViewRef}
        onClose={handlePublisherClose}
        onLoadStart={kiteHandoff.onLoadStart}
        onLoadEnd={kiteHandoff.onLoadEnd}
        onNavigationStateChange={state => {
          kiteHandoff.onNavigationStateChange(state);
          handleWebViewNavigationStateChange(state);
        }}
        onError={kiteHandoff.onError}
        onHttpError={kiteHandoff.onHttpError}
      />
    );
  }

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
      hardwareAccelerated={true}>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { width: width * 1 }]}>
          {webView ? (
            <View style={{ flex: 1, backgroundColor: 'white', padding: 10 }}>
              <View style={{ alignContent: 'flex-end', alignItems: 'flex-end' }}>
                <TouchableOpacity
                  onPress={handlePublisherClose}
                  style={styles.closeButton}>
                  <XIcon size={24} color={designColor('000')} />
                </TouchableOpacity>
              </View>
              <WebView
                ref={webViewRef}
                style={{ flex: 1 }}
                source={publisherWebViewSource}
                onLoadStart={kiteHandoff.onLoadStart}
                onLoadEnd={kiteHandoff.onLoadEnd}
                onNavigationStateChange={state => {
                  kiteHandoff.onNavigationStateChange(state);
                  handleWebViewNavigationStateChange(state);
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                androidLayerType="hardware"
                setSupportMultipleWindows={false}
                thirdPartyCookiesEnabled={true}
                sharedCookiesEnabled={true}
                keyboardDisplayRequiresUserAction={false}
                onError={kiteHandoff.onError}
                onHttpError={kiteHandoff.onHttpError}
              />
            </View>
          ) : (
          <View style={{ flex: 1 }}>
            {/* Angel One refuses API orders on scrips under surveillance. Warn
                BEFORE the rebalance is fired — web has always done this on the
                equivalent surface (UpdateRebalanceModal); the app previously
                only learned from the post-hoc rejection message. */}
            <SurveillanceWarning surveillanceStocks={surveillanceStocks} />
            <FlatList
              style={styles.orderList}
              data={isBrokerDisconnected ? editableData : dataArray}
              keyExtractor={item => item.symbol}
              renderItem={renderListItem}
              // ✅ This is CRUCIAL — prevents full re-render on typing
              extraData={editableData}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              contentContainerStyle={{
                paddingBottom: 12,
              }}
              // ✅ HEADER COMPONENT (all top section)
              ListHeaderComponent={
                <>
                  {/* Header bar */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingTop: 20,
                      justifyContent: 'space-between',
                    }}>
                    <Text></Text>
                    <TouchableOpacity
                      onPress={handleClose}
                      style={styles.closeButton}>
                      <XIcon size={24} color={designColor('000')} />
                    </TouchableOpacity>
                  </View>

                  {/* Step progress bar */}
                  {currentStep === 3 && !isRepairMode && (
                    <View style={styles.progressBarContainer}>
                      <StepProgressBar
                        steps={stepsData}
                        currentStep={currentStep}
                      />
                    </View>
                  )}

                  <View style={{ borderColor: designColor('e8e8e8'), marginTop: 5 }} />

                  {/* Skipped Stocks Warning */}
                  {hasSkippedStocks && (
                    <View style={styles.warningContainer}>
                      <View style={styles.warningHeader}>
                        <AlertOctagon size={20} color={designColor('d97706')} />
                        <Text style={styles.warningTitle}>
                          Stocks Skipped Due to Low Balance
                        </Text>
                      </View>
                      <Text style={styles.warningText}>
                        Following stocks could not be considered in the allocation
                        as balance allocated to the portfolio is close to or lower than minimum investment required:
                      </Text>
                      <View style={styles.skippedStocksList}>
                        {skippedStocksList?.map((stock, idx) => (
                          <Text key={idx} style={styles.skippedStockItem}>
                            • {stock}
                          </Text>
                        ))}
                      </View>
                      {minInvestment && (
                        <Text style={styles.minInvestmentText}>
                          Recommended Minimum Investment: ₹
                          {parseFloat(minInvestment).toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* The backend owns this explanation. A sell-only basket is
                      not labelled "aligned" when the model budget simply cannot
                      afford one target share. */}
                  {showUnaffordableTargetsExplanation && (
                    <View style={styles.warningContainer}>
                      <View style={styles.warningHeader}>
                        <AlertOctagon size={20} color={designColor('d97706')} />
                        <Text style={styles.warningTitle}>
                          {allocationExplanation?.noTargetSharesAffordable
                            ? 'Why there are no buy orders'
                            : allocationExplanation?.title}
                        </Text>
                      </View>
                      <Text style={styles.warningText}>
                        Only ₹{formatAllocationMoney(allocationExplanation?.modelCapital)} is assigned to this model.
                        {' '}Your broker has ₹{formatAllocationMoney(allocationExplanation?.liveBrokerCash)} cash,
                        {' '}but ₹{formatAllocationMoney(allocationExplanation?.authorisedCash)} of that cash was authorised for this calculation,
                        {' '}so the order budget remained ₹{formatAllocationMoney(allocationExplanation?.orderBudget)}.
                      </Text>
                      <Text style={styles.warningText}>
                        After keeping {Number(allocationExplanation?.cashTargetPercent || 0).toLocaleString('en-IN')}% in cash,
                        {' '}₹{formatAllocationMoney(allocationExplanation?.investableBudget)} was available across the target stocks—not enough to buy one share at their target weights.
                      </Text>
                      {(allocationExplanation?.skippedTargets || []).map(target => (
                        <Text
                          key={`allocation-${target.symbol}`}
                          style={styles.skippedStockItem}>
                          • {target.symbol}: target ₹{formatAllocationMoney(target.allocatedAmount)}; one share ₹{formatAllocationMoney(target.oneSharePrice)}
                        </Text>
                      ))}
                      <Text style={[styles.warningText, {fontFamily: designFont('Satoshi-Bold'), marginTop: 8, marginBottom: 0}]}>
                        This does not mean the portfolio is already in the correct state.
                      </Text>
                    </View>
                  )}

                  {/* CA Pending Info Warning (split settlement) */}
                  {activeCalculatedPortfolioData?.caPendingInfo?.length > 0 && (
                    <View style={[styles.warningContainer, {borderLeftColor: designColor('f97316'), borderLeftWidth: 4, backgroundColor: designColor('fff7ed')}]}>
                      <View style={styles.warningHeader}>
                        <Text style={{fontSize: 14}}>⏳</Text>
                        <Text style={[styles.warningTitle, {color: designColor('9a3412')}]}>
                          Split Settlement Pending
                        </Text>
                      </View>
                      <Text style={[styles.warningText, {color: designColor('9a3412')}]}>
                        The following stocks have a recent split, but your broker hasn't credited all shares yet.
                      </Text>
                      {activeCalculatedPortfolioData.caPendingInfo.map((item, index) => (
                        <View key={`ca-${index}`} style={{flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: index < activeCalculatedPortfolioData.caPendingInfo.length - 1 ? 1 : 0, borderBottomColor: designColor('fed7aa')}}>
                          <Text style={{fontSize: 12, fontFamily: designFont('Poppins-Medium'), color: designColor('9a3412'), flex: 1}}>{item.symbol}</Text>
                          <Text style={{fontSize: 11, color: designColor('ea580c'), flex: 1, textAlign: 'center'}}>Expected: {item.expected_qty}</Text>
                          <Text style={{fontSize: 11, color: designColor('16a34a'), flex: 1, textAlign: 'right'}}>Can sell: {item.sell_qty_possible}</Text>
                        </View>
                      ))}
                      <Text style={{fontSize: 10, color: designColor('ea580c'), marginTop: 8, fontFamily: designFont('Poppins-Regular')}}>
                        We'll sell {activeCalculatedPortfolioData.caPendingInfo.reduce((sum, item) => sum + (item.sell_qty_possible || 0), 0)} shares now. The remaining will be marked for "Repair" — you can sell them once your broker credits the split shares.
                      </Text>
                    </View>
                  )}

                  {/* Header row */}
                  {!(dataArray.length === 0) && (
                    <View
                      style={[
                        styles.rowContainerhead,
                        {
                          backgroundColor: designColor('fff'),
                          paddingVertical: 8,
                          borderRadius: 8,
                          marginHorizontal: 20,
                          marginBottom: 10,
                        },
                      ]}>
                      <View style={styles.leftContainerhead}>
                        <Text style={styles.headerTexthead}>Stocks</Text>
                      </View>
                      <View style={styles.rightContainerhead}>
                        <Text style={styles.headerTexthead}>
                          {isBrokerDisconnected ? 'Price' : 'Current Price'}
                        </Text>
                      </View>
                      <View style={styles.quantityContainerhead}>
                        <Text style={styles.headerTexthead}>Quantity</Text>
                      </View>
                    </View>
                  )}
                  {activeCalculatedPortfolioData?._sellAuthorizationRetry === true &&
                    dataArray.length > 0 && (
                    <View
                      testID="sell-auth-retry-note"
                      style={{
                        marginHorizontal: 20,
                        marginBottom: 8,
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: designColor('eff6ff'),
                        borderWidth: 1,
                        borderColor: designColor('bfdbfe'),
                      }}>
                      <Text style={{fontSize: 12, color: designColor('1e3a8a')}}>
                        Updated after your sell authorization. No orders have
                        been placed yet — review the orders and tap Place Order.
                      </Text>
                    </View>
                  )}
                  {dataArray.length > 3 && (
                    <View
                      style={{
                        marginHorizontal: 20,
                        marginBottom: 8,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                      <Text style={{fontSize: 12, color: designColor('4b5563')}}>
                        {dataArray.length} orders to review
                      </Text>
                      <Text style={{fontSize: 12, color: designColor('2563eb'), fontWeight: '600'}}>
                        Scroll to see all ↓
                      </Text>
                    </View>
                  )}
                </>
              }
              // Empty state — Portfolio Already Aligned or API error message
              ListEmptyComponent={
                <View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 40,
                    paddingHorizontal: 24,
                  }}>
                  {(fundingConsent?.required || hasSkippedStocks ||
                    showUnaffordableTargetsExplanation ||
                    hasPendingSellAuthorization ||
                    ((activeCalculatedPortfolioData?.status === 1 ||
                      activeCalculatedPortfolioData?.status === 2) &&
                      activeCalculatedPortfolioData?.message)) ? (
                    <>
                      {/* Error/warning icon */}
                      <View
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 36,
                          backgroundColor: designColor('fef3c7'),
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 20,
                        }}>
                        <AlertOctagon size={36} color={designColor('d97706')} />
                      </View>
                      <Text
                        style={{
                          fontFamily: designFont('Poppins-SemiBold'),
                          color: designColor('d97706'),
                          fontSize: 18,
                          textAlign: 'center',
                          marginBottom: 12,
                        }}>
                        {fundingConsent?.required
                          ? 'Choose how to fund your full plan'
                          : hasPendingSellAuthorization
                          ? 'Sell Authorization Still Pending'
                          : showUnaffordableTargetsExplanation
                          ? 'Target Allocation Is Not Yet Reachable'
                          : hasSkippedStocks
                          ? 'Investment Amount Needs Review'
                          : 'Unable to Rebalance'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: designFont('Poppins-Regular'),
                          color: 'rgba(0,0,0,0.6)',
                          textAlign: 'center',
                          marginBottom: 24,
                          fontSize: 14,
                          lineHeight: 22,
                          paddingHorizontal: 10,
                        }}>
                        {fundingConsent?.required
                          ? `Your full plan remains ₹${Number(fundingConsent.desiredAmount || 0).toLocaleString('en-IN')}. Add ₹${Number(fundingConsent.shortfall || 0).toLocaleString('en-IN')} to your broker, or continue with available funds. Your investment target stays unchanged.`
                          : hasPendingSellAuthorization
                          ? `The sell orders reviewed earlier were not confirmed by ${activeCalculatedPortfolioData?._sellAuthorizationBroker || broker || 'your broker'}, so this rebalance is not complete and your portfolio is not yet aligned. Authorize those stocks for selling, then return and retry. Dependent buy orders remain unplaced until the sells complete.`
                          : showUnaffordableTargetsExplanation
                          ? 'The current model budget cannot buy even one share of the target stocks at their target weights. No orders were placed, so this portfolio is not aligned yet. Go back and increase the investment amount or review the allocation before trying again.'
                          : hasSkippedStocks
                          ? `This amount cannot buy any of the portfolio positions at their target weights right now. Increase the investment amount and retry; this is not an “already aligned” result.${minInvestment ? ` The latest reference minimum is ₹${parseFloat(minInvestment).toLocaleString('en-IN')}.` : ''}`
                          : activeCalculatedPortfolioData.message}
                      </Text>
                      <TouchableOpacity
                        onPress={
                          fundingConsent?.required
                            ? showFundingDecision
                            : hasPendingSellAuthorization
                            ? () => {
                                setOpenRebalanceModal(false);
                                setShowOtherBrokerModel(true);
                              }
                            : handleClose
                        }
                        style={{
                          backgroundColor: designColor('000'),
                          paddingHorizontal: 24,
                          paddingVertical: 12,
                          borderRadius: 8,
                        }}>
                        <Text
                          style={{
                            color: designColor('fff'),
                            fontFamily: designFont('Poppins-Medium'),
                            fontSize: 14,
                          }}>
                          {fundingConsent?.required
                            ? 'Review funding options'
                            : hasPendingSellAuthorization
                            ? 'Retry Sell Authorization'
                            : 'Go Back'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : !isAlreadyAlignedCalculation ? (
                    // "Already Aligned" is a claim about a zero-trade
                    // calculation. With no such calculation the list is empty
                    // for another reason, typically Repair rows clearing right
                    // after placement while the broker confirms them (moneyman
                    // Groww, 7 Oct 2026, showed "Already Aligned" with an
                    // order still open).
                    <>
                      {matchingRepairTrade?.reconciliationPending === true ? (
                        <ActivityIndicator
                          size="large"
                          color={designColor('2563eb')}
                          style={{marginBottom: 20}}
                        />
                      ) : null}
                      <Text
                        testID="rebalance-empty-not-aligned"
                        style={{
                          fontFamily: designFont('Poppins-SemiBold'),
                          color: designColor('1f2937'),
                          fontSize: 18,
                          textAlign: 'center',
                          marginBottom: 12,
                        }}>
                        {matchingRepairTrade?.reconciliationPending === true
                          ? 'Orders sent, checking with the broker'
                          : 'Nothing to place right now'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: designFont('Poppins-Regular'),
                          color: 'rgba(0,0,0,0.6)',
                          textAlign: 'center',
                          marginBottom: 24,
                          fontSize: 14,
                          lineHeight: 22,
                          paddingHorizontal: 10,
                        }}>
                        {matchingRepairTrade?.reconciliationPending === true
                          ? `Your orders were sent to ${broker || 'your broker'}. We are confirming them now. Anything that does not go through will appear under Repair Portfolio.`
                          : 'Go back and open the portfolio again to see its latest orders.'}
                      </Text>
                      <TouchableOpacity
                        onPress={handleClose}
                        style={{
                          backgroundColor: designColor('000'),
                          paddingHorizontal: 24,
                          paddingVertical: 12,
                          borderRadius: 8,
                        }}>
                        <Text
                          style={{
                            color: designColor('fff'),
                            fontFamily: designFont('Poppins-Medium'),
                            fontSize: 14,
                          }}>
                          Go Back
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {/* Green checkmark circle */}
                      <View
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 36,
                          backgroundColor: designColor('def7ec'),
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 20,
                        }}>
                        <CheckIcon size={36} color={designColor('15803d')} />
                      </View>
                      <Text
                        style={{
                          fontFamily: designFont('Poppins-SemiBold'),
                          color: designColor('15803d'),
                          fontSize: 20,
                          textAlign: 'center',
                          marginBottom: 12,
                        }}>
                        Your Portfolio is Already Aligned!
                      </Text>
                      <Text
                        style={{
                          fontFamily: designFont('Poppins-Regular'),
                          color: 'rgba(0,0,0,0.6)',
                          textAlign: 'center',
                          marginBottom: 10,
                          fontSize: 14,
                          lineHeight: 22,
                          paddingHorizontal: 10,
                        }}>
                        Great news! Based on your current holdings and the latest model
                        portfolio recommendations, no trades are needed right now. Your
                        investments are already in sync with your manager's strategy.
                      </Text>
                      <Text
                        style={{
                          fontFamily: designFont('Poppins-Regular'),
                          color: 'rgba(0,0,0,0.4)',
                          textAlign: 'center',
                          marginBottom: 24,
                          fontSize: 13,
                          lineHeight: 20,
                        }}>
                        Want to increase your investment or make changes? Go back and
                        modify your investment amount.
                      </Text>
                      <TouchableOpacity
                        onPress={handleClose}
                        style={{
                          backgroundColor: designColor('000'),
                          paddingHorizontal: 24,
                          paddingVertical: 12,
                          borderRadius: 8,
                        }}>
                        <Text
                          style={{
                            color: designColor('fff'),
                            fontFamily: designFont('Poppins-Medium'),
                            fontSize: 14,
                          }}>
                          Go Back
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              }
              ListFooterComponent={dataArray.length > 0 ? (
                <View style={styles.orderListFooter}>
                  {isRepairMode && fundingPending.count > 0 && (
                    <View style={styles.fundingPendingBox}>
                      <Text style={styles.fundingPendingTitle}>
                        ₹{Math.round(fundingPending.total).toLocaleString('en-IN')} across{' '}
                        {fundingPending.count} buy leg{fundingPending.count === 1 ? '' : 's'} is waiting for funds
                      </Text>
                      <Text style={styles.fundingPendingBody}>
                        These quantities could not be funded when your plan was calculated, even after your
                        sales settle. They are fixed — nothing is recalculated. Transfer the amount to your
                        broker and tap Repair; the broker places them as soon as the cash is there.
                      </Text>
                      {!fundPendingRecorded ? (
                        <TouchableOpacity
                          style={styles.fundingPendingButton}
                          disabled={fundPendingRecording}
                          onPress={recordFundPendingGap}>
                          <Text style={styles.fundingPendingButtonText}>
                            {fundPendingRecording
                              ? 'Recording…'
                              : `Add ₹${Math.ceil(fundingPending.total).toLocaleString('en-IN')} to complete this allocation`}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.fundingPendingRecorded}>
                          Recorded ✓ — transfer the funds, then refresh Repair. The same frozen legs are used;
                          no other holding is recalculated.
                        </Text>
                      )}
                    </View>
                  )}
                  <LowFundsRebalanceWarning
                    availableCash={displayAvailableCash}
                    additionalFundsRequired={additionalFundsRequired}
                    fundingGapToday={fundingGapToday}
                    deferredSellProceeds={deferredSellProceeds}
                    t1RiskCost={t1RiskCost}
                    t1RiskLegCount={t1RiskBuys.length}
                    fundingAdjusted={!!activeCalculatedPortfolioData?.fundingAdjusted}
                    attemptingDespiteShortfall={!!fundingConsent?.attemptingDespiteShortfall}
                  />
                  {renderFundingConsentPanel()}
                </View>
              ) : null}
            />
            {dataArray.length === 0 && renderFundingConsentPanel()}
            {awaitingOrderStatus && (
              <View
                style={[
                  styles.notecontainer,
                  { marginHorizontal: 20, marginTop: 10 },
                ]}>
                <Text style={styles.noteTitle}>Checking your order status</Text>
                <Text style={styles.noteText}>
                  Your orders have been submitted to your broker. We are confirming
                  them now — this screen updates on its own. Please do not place
                  them again.
                </Text>
              </View>
            )}

            {/* Action buttons */}
            {dataArray.length > 0 && !fundingConsent?.required && (
              <>
                {isBrokerDisconnected ? (
                  <View
                    style={[
                      styles.brokerDisconnectedFooter,
                      { marginHorizontal: 20 },
                    ]}>
                    <View style={styles.fundsContainer}>
                      <View style={styles.fundItem}>
                        <Text style={styles.fundLabel}>Additional Fund Needed</Text>
                        <Text style={styles.fundValue}>
                          ₹{additionalFundsRequired.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={openDummyBrokerConfirmation}
                      style={styles.confirmButton}>
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={onSlideComplete}
                    style={[
                      styles.nextStepButton,
                      (!marketGateOpen || loading || awaitingOrderStatus) && styles.buttonDisabled,
                      loading && styles.buttonLoading,
                    ]}
                    disabled={!marketGateOpen || loading || awaitingOrderStatus}>
                    {loading || awaitingOrderStatus ? (
                      <ActivityIndicator size="small" color={designColor('fff')} />
                    ) : (
                      <Text style={styles.nextStepButtonText}>
                        {!marketGateOpen ? 'Market is Closed' : 'Place Order'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Loading overlay */}
            {loading && (
              <ActivityIndicator
                size="small"
                color={designColor('ffffff')}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              />
            )}
          </View>
          )}
        </View>
      </SafeAreaView>
      {/* NEW: DummyBroker Confirmation Modal */}
      <DummyBrokerHoldingConfirmation
        userEmail={userEmail}
        isOpen={showDummyBrokerModal}
        onClose={closeDummyBrokerConfirmation}
        dummyBrokerConfirmationStockDetails={editableData}
        storeModalName={storeModalName}
        modelObjectId={modelPortfolioModelId}
        modelPortfolioModelId={modelPortfolioModelId}
        getModelPortfolioStrategyDetails={getModelPortfolioStrategyDetails}
        setOpenRebalanceModal={setOpenRebalanceModal}
        getRebalanceRepair={getRebalanceRepair}
        executionCorrelation={additionalPayload}
      />
      <Modal transparent visible={showPriceErrorModal} animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: 20,
          }}>
          <View
            style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 8,
              width: '100%',
              maxWidth: 300,
              alignItems: 'center',
            }}>
            <Text
              style={{
                fontSize: 14,
                marginBottom: 12,
                textAlign: 'center',
                color: designColor('000000'),
              }}>
              Buying Price cannot be "Zero" Kindly enter your correct Buying
              Price to confirm
            </Text>
            <TouchableOpacity
              onPress={() => setShowPriceErrorModal(false)}
              style={{
                backgroundColor: designColor('0056b7'),
                paddingVertical: 10,
                paddingHorizontal: 20,
                borderRadius: 5,
              }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Toast host INSIDE this native Modal. The app-level <Toast /> in
          App.js renders underneath any open native Modal, so every
          "Order Failed" / validation toast fired from this screen was
          invisible ("tapped Place Order, nothing happened", 2026-10-01).
          react-native-toast-message keeps a stack of hosts: this one wins
          while mounted and hands back to the root host on close. */}
      <Toast />
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Repair-mode chip on individual trade rows. See § 6g.
  chipBase: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  chipText: {
    fontSize: 10,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('9a3412'),
  },
  chipTextDone: {
    color: designColor('166534'),
  },
  // Inline "Mark as placed" editor on a cautionary Repair row.
  placementEditor: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('fcd34d'),
    backgroundColor: designColor('fffbeb'),
    gap: 6,
  },
  placementEditorHint: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('92400e'),
  },
  placementEditorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  placementEditorLabel: {
    fontSize: 10,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('4b5563'),
    marginBottom: 2,
  },
  placementEditorInput: {
    borderWidth: 1,
    borderColor: designColor('d1d5db'),
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: designColor('111827'),
    backgroundColor: designColor('ffffff'),
  },
  placementEditorError: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('b91c1c'),
  },
  placementCancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: designColor('d1d5db'),
  },
  placementCancelText: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Medium'),
    color: designColor('374151'),
  },
  placementConfirmButton: {
    flex: 2,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: designColor('15803d'),
  },
  placementConfirmText: {
    fontSize: 12,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('ffffff'),
  },
  // Cautionary listing — yellow/amber to match RecommendationSuccessModal.
  chipCautionary: {
    backgroundColor: designColor('fef3c7'),
    borderColor: designColor('fcd34d'),
  },
  // Insufficient funds last time — softer red.
  chipLowFunds: {
    backgroundColor: designColor('fee2e2'),
    borderColor: designColor('fca5a5'),
  },
  // Partial fill last time — neutral gray-amber.
  chipPartial: {
    backgroundColor: designColor('fef3c7'),
    borderColor: designColor('fcd34d'),
  },
  // FUNDING_PENDING panel (Phase 2, 2026-09-20).
  fundingPendingBox: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('fcd34d'),
    backgroundColor: designColor('fffbeb'),
  },
  fundingPendingTitle: {
    fontFamily: designFont('Poppins-SemiBold'),
    fontSize: 12,
    color: designColor('92400e'),
    marginBottom: 4,
  },
  fundingPendingBody: {
    fontFamily: designFont('Poppins-Regular'),
    fontSize: 11,
    color: designColor('92400e'),
    lineHeight: 16,
  },
  fundingPendingButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: designColor('f59e0b'),
    backgroundColor: designColor('ffffff'),
  },
  fundingPendingButtonText: {
    fontFamily: designFont('Poppins-SemiBold'),
    fontSize: 11,
    color: designColor('92400e'),
  },
  fundingPendingRecorded: {
    marginTop: 8,
    fontFamily: designFont('Poppins-Medium'),
    fontSize: 11,
    color: designColor('166534'),
  },
  orderList: {
    flex: 1,
    flexShrink: 1,
    minHeight: 140,
  },
  orderListFooter: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  // Once user has marked the row manually placed.
  chipDone: {
    backgroundColor: designColor('dcfce7'),
    borderColor: designColor('86efac'),
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  notecontainer: {
    borderWidth: 1,
    borderColor: designColor('f9a825'),
    borderRadius: 8,
    padding: 12,
    margin: 16,
    backgroundColor: designColor('fff'),
  },
  buttonDisabled: {
    backgroundColor: designColor('7f9cbf'),
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: designColor('f9a825'),
    marginBottom: 4,
  },
  noteText: {
    fontSize: 11,
    color: designColor('333'),
    fontFamily: designFont('Poppins-Regular'),
    lineHeight: 20,
  },
  noteAmountText: {
    fontWeight: '600',
    color: designColor('0056b7'),
  },
  fundingConsentContainer: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: designColor('cbd5e1'),
    borderRadius: 8,
    padding: 12,
    backgroundColor: designColor('f8fafc'),
  },
  fundingConsentTitle: {
    color: designColor('0f172a'),
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  fundingConsentText: {
    color: designColor('475569'),
    fontSize: 11,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 10,
  },
  fundingPrimaryButton: {
    backgroundColor: designColor('0f172a'),
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  fundingPrimaryButtonText: {
    color: designColor('ffffff'),
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  fundingSecondaryButton: {
    borderWidth: 1,
    borderColor: designColor('cbd5e1'),
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: designColor('ffffff'),
  },
  fundingSecondaryButtonText: {
    color: designColor('334155'),
    fontSize: 12,
    fontWeight: '600',
  },

  // NEW: Broker disconnected styles

  brokerDisconnectedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: designColor('f9fafb'),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
  },
  fundsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fundItem: {
    flexDirection: 'column',
  },
  fundLabel: {
    fontSize: 12,
    color: designColor('6b7280'),
    fontWeight: '500',
  },
  fundValue: {
    fontSize: 16,
    color: designColor('111827'),
    fontWeight: '600',
  },

  confirmButton: {
    backgroundColor: designColor('0056b7'),
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  rowContainerhead: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  nextStepButton: {
    backgroundColor: designColor('0056b7'),
    marginHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  leftContainerhead: {
    flex: 1,
    justifyContent: 'flex-start',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
  },
  rightContainerhead: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityContainerhead: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTexthead: {
    fontFamily: designFont('Poppins-SemiBold'),
    fontSize: 12,
    color: designColor('333'),
    textAlign: 'center',
  },
  // NEW: Styles for warning message and skipped stocks
  warningContainer: {
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
    backgroundColor: designColor('fffbeb'),
    borderWidth: 1,
    borderColor: designColor('fcd34d'),
    borderRadius: 8,
    padding: 12,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontFamily: designFont('Satoshi-Bold'),
    fontSize: 14,
    color: designColor('d97706'),
    marginLeft: 8,
  },
  warningText: {
    fontFamily: designFont('Satoshi-Regular'),
    fontSize: 13,
    color: designColor('92400e'),
    marginBottom: 8,
  },
  skippedStocksList: {
    marginLeft: 4,
    marginBottom: 8,
  },
  skippedStockItem: {
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 13,
    color: designColor('b45309'),
    marginBottom: 2,
  },
  minInvestmentText: {
    fontFamily: designFont('Satoshi-Bold'),
    fontSize: 13,
    color: designColor('d97706'),
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: designColor('fde68a'),
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    marginLeft: 0,
    flex: 1,
  },

  buyOrder: {
    color: designColor('0056b7'),
    alignSelf: 'flex-start',
  },
  sellOrder: {
    color: 'red',
  },
  cell: {
    borderWidth: 1,
    borderColor: 'grey',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  symbol: {
    alignSelf: 'flex-start',
    color: 'black',
    flexDirection: 'column',
    fontFamily: designFont('Poppins-Medium'),
  },
  qty: {
    alignSelf: 'center',
    color: 'black',
    flexDirection: 'column',
    fontFamily: designFont('Poppins-Regular'),
  },
  cellText: {
    alignSelf: 'flex-start',
    color: 'black',
    fontFamily: designFont('Poppins-SemiBold'),
    fontSize: 12,
  },

  repairQtyHint: {
    fontSize: 10,
    color: designColor('9ca3af'),
    marginTop: 2,
  },
  repairQtyReduced: {
    fontSize: 10,
    color: designColor('b45309'),
    marginTop: 1,
  },
  quantityInput: {
    width: 50,
    height: 30,
    padding: 2,
    marginHorizontal: 4,
    color: designColor('0d0c22'),
    fontSize: 12,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: designColor('e9e8e8'),
    borderRadius: 7,
  },

  modalContainer: {
    backgroundColor: designColor('fff'),
    maxHeight: screenHeight,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 5,
    flex: 1,
  },

  orderButton: {
    backgroundColor: designColor('000'),
    paddingVertical: 15,
    marginHorizontal: 0,
    borderRadius: 10,
    alignItems: 'center',
  },
  orderButtonText: {
    color: designColor('fff'),
    fontFamily: designFont('Poppins-Medium'),
    fontSize: 16,
  },
  leftContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    marginRight: 5,
    alignItems: 'flex-start',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    alignSelf: 'center',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: designColor('e8e8e8'),
    paddingHorizontal: 16,
  },
});

export default RebalanceModal;
