import {availableFundsOptions, fundingPanelCopy, getFundingReview, insufficientFundsAttemptOptions} from '../../utils/fundingContinuation';
import { isPublisherExecutionComplete, includeUnconfirmedPublisherLegs } from '../../utils/publisherCompletionAuthority';
import {createPublisherBatchDispatcher} from '../../utils/publisherBatchDispatch';
import React, {useState, useRef, useEffect, useCallback, useMemo} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useWindowDimensions} from 'react-native';
import {XIcon, Trash2Icon, CandlestickChartIcon, AlertTriangleIcon} from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Feather';
import server from '../../utils/serverConfig';
import axios from 'axios';
import {PUBLISHER_ACK_TIMEOUT_MS, isPublisherActivationAcknowledged} from '../../utils/publisherAcknowledgement';
import {WebView} from 'react-native-webview';
import KitePublisherModal from './KitePublisherModal';
import CryptoJS from 'react-native-crypto-js';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Config from 'react-native-config';
import { designColor, designFont } from '../../design/literalTokens';
const {height: screenHeight} = Dimensions.get('window');
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../../screens/TradeContext';
import { isOrderSuccess, isOrderRejected } from '../../utils/orderStatusUtils';
import { detectTransientOrderWindowError, isBrokerAuthError } from '../../utils/rebalanceHelpers';
import { validateBrokerSession } from '../../utils/brokerSessionUtils';
import { validateStockExchanges, fetchFreshKiteProtectionPrices, getPublisherWebViewBaseUrl, resolveZerodhaSymbol, convertToBasketItem, createModelPortfolioPublisherBatches, voidUnsentPublisherRecos } from '../../utils/brokerPublisher';
import useZerodhaSymbolMap from '../../hooks/useZerodhaSymbolMap';
import useKitePublisherPolling from '../../hooks/useKitePublisherPolling';
import useKiteHandoffGuard from '../../hooks/useKiteHandoffGuard';
import {executionBundleHeaders, handleStaleExecutionBundle} from '../../utils/executionBundleSafety';
import {accountRecoveryMetadata} from '../../utils/accountRecoveryUx';
import {
  createZerodhaPublisherAttempt,
  parseKiteRedirectStatus,
  resolvePublisherSettlement,
} from '../../utils/publisherOutcome';
import { convertResponse } from '../../utils/tradeUtils';
import {getAdvisorSubdomain, getTenantSubdomain} from '../../utils/variantHelper';
import moment from 'moment';
import useModalStore from '../../GlobalUIModals/modalStore';
import { useConfig } from '../../context/ConfigContext';
import { computeTradeVariant } from '../../utils/tradeVariant';
import useSdkClient from '../../sdk/useSdkClient';
import PublisherWebViewOverlay from '../PublisherWebViewOverlay';
import portfolioEvents, { PORTFOLIO_EVENTS } from '../../utils/portfolioEvents';
import { isZerodhaSellAuthorized } from '../../utils/zerodhaDdpiGate';
import {hasExplicitSellAuthRejection} from '../../utils/sellAuthMessage';
import {isDhanSellAuthorizationReady} from '../../utils/dhanEdis';
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
  getRebalanceContract,
  getRebalanceBlockReason,
} from '../../utils/rebalanceContract';
import {planRefusalMessage} from '../../utils/planRefusalMessage';
import {throwIfSdkNotSent} from '../../utils/sdkNotSent';

const isSdkExecuteAdviceEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_EXECUTE_ADVICE || '').trim().toLowerCase();
  return v === 'true' || v === '1';
};

const MPReviewTradeModal = ({
  visible,
  onCloseReviewTrade,
  dataArray,
  confirmOrder,
  setconfirmOrder,
  fileName,
  totalArray,
  setOpenSucessModal,
  openSuccessModal,
  setOpenSubscribeModel,
  calculatedLoading,
  latestRebalance,
  setOrderPlacementResponse,
  userEmail,
  userDetails,
  strategyDetails,
  calculatedPortfolioData,
  calculateRebalance,
  broker,
  edisStatus,
  dhanEdisStatus,
  setShowDdpiModal,
  setShowAngleOneTpinModel,
  setShowDhanTpinModel,
  setShowFyersTpinModal,
  setShowOtherBrokerModel,
  isReturningFromOtherBrokerModal,
  setIsReturningFromOtherBrokerModal,
  // Optional — sibling setter for the outgoing trade list at submit
  // time (used by RecommendationSuccessModal to recover the trade
  // `variant` per row when ccxt-india doesn't echo it). See
  // utils/tradeVariant.js § resolveResultVariant.
  setLastSubmittedTrades,
}) => {
  const {configData} = useTrade();
  const openBrokerModal = useModalStore(state => state.openModal);
  // For trade `variant` computation at submit. See
  // docs/APP_ARCHITECTURE.md § 4.5.2 Trade variant field.
  const { allowAfterHoursOrders, rebalanceFreezePlan } = useConfig() || {};
  const sdkClient = useSdkClient();
  const sdkExecuteAdviceEnabled = isSdkExecuteAdviceEnabled() && !!sdkClient;
  const rebalanceContract = getRebalanceContract(calculatedPortfolioData);
  const fundingConsent = getFundingReview(rebalanceContract, calculatedPortfolioData);

  // Phase 1 plan freeze (prod-alphaquark-github docs/REBALANCE_PLAN_FREEZE_PLAN.md
  // §4.4/§4.5; this repo's docs/WEB_TO_APP_PORT_PLAN_2026-07.md rebalance-freeze
  // entry): forward the frozen plan_id/plan_version rebalance/calculate
  // returned so ccxt executes the server-frozen, re-validated plan instead of
  // the client-posted `trades`. This modal has no repair-mode branch (no
  // `modelPortfolioRepairTrades` prop) — every plan_id it ever holds came from
  // THIS calculate, so there is no repair-vs-fresh ambiguity to guard. Flag
  // off / no plan_id ⇒ fields absent ⇒ byte-identical legacy payload.
  const frozenPlanFields = rebalanceContract?.plan?.id || (rebalanceFreezePlan === true && calculatedPortfolioData?.plan_id)
    ? {
        plan_id: rebalanceContract?.plan?.id || calculatedPortfolioData.plan_id,
        plan_version: rebalanceContract?.plan?.version || calculatedPortfolioData.plan_version,
        plan_hash: rebalanceContract?.plan?.hash,
      }
    : {};

  // Frozen-plan 409 (PLAN_DRIFTED / expired / ALREADY_CONSUMED — see
  // REBALANCE_PLAN_FREEZE_PLAN.md §4.4): the plan_id we hold is dead, so
  // re-submitting would 409 forever. Close the review step and re-run
  // calculateRebalance (mints a fresh plan) — mirrors web's recompute
  // handling. Returns true if it handled the error (caller should stop).
  const handleFrozenPlanRecompute = (error) => {
    const recovery = accountRecoveryMetadata(error);
    // Refused before anything reached the broker (market closed, expired
    // session, ...). Never a sell-authorization problem: say why and stop,
    // before the caller's TPIN branch can treat it as a rejected SELL.
    const refusedData = error?.response?.data || {};
    if (error?.response?.status === 409 && !refusedData.recompute &&
        (refusedData.dispatchState === 'NOT_SENT' || refusedData.notSent === true ||
         refusedData.code === 'MARKET_CLOSED')) {
      Alert.alert(
        'Orders not placed',
        refusedData.message || 'Nothing was sent to your broker. Please try again later.',
      );
      onCloseReviewTrade();
      return true;
    }
    if (error?.response?.status === 409 &&
        (error?.response?.data?.recompute || recovery.running)) {
      const verificationPending =
        error?.response?.data?.code === 'RECHECK_UNAVAILABLE' || recovery.running;
      if (recovery.operationId) {
        console.info('[AccountRecovery] Waiting for operation', recovery.operationId);
      }
      if (verificationPending) {
        Toast.show({
          type: 'info',
          text1: 'Checking your broker',
          text2: 'Nothing was sent. We will refresh this automatically.',
          visibilityTime: 6000,
        });
      } else {
        const refusal = planRefusalMessage(
          error?.response?.data?.code,
          broker,
          error?.response?.data?.message,
        );
        Alert.alert(refusal.title, refusal.message);
      }
      onCloseReviewTrade();
      if (typeof calculateRebalance === 'function') {
        const delay = verificationPending
          ? recovery.retryAfterSeconds * 1000
          : 0;
        setTimeout(() => calculateRebalance(), delay);
      }
      return true;
    }
    return false;
  };
  console.log('MPBROKER:', broker);
  const {width} = useWindowDimensions();

  // Surveillance state for Angel One
  const [surveillanceData, setSurveillanceData] = useState(null);
  const [surveillanceLoading, setSurveillanceLoading] = useState(false);
  const [surveillanceChecked, setSurveillanceChecked] = useState(false);

  // Function to check surveillance for AngelOne
  const checkAngelOneSurveillance = async (stocks) => {
    if (broker !== 'Angel One') return null;
    if (surveillanceLoading || surveillanceChecked) return surveillanceData;
    if (!stocks || stocks.length === 0) return null;

    const symbols = stocks.map((stock) => ({
      symbol: stock.symbol,
      exchange: stock.exchange,
    }));

    setSurveillanceLoading(true);
    try {
      const config = {
        method: 'post',
        url: `${server.ccxtServer.baseUrl}angelone/equity/surveillance`,
        data: symbols,
        headers: {
          'Content-Type': 'application/json',
          'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain,
          'aq-encrypted-key': generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };

      const response = await axios.request(config);
      setSurveillanceData(response.data);
      setSurveillanceChecked(true);
      return response.data;
    } catch (error) {
      console.error('Error checking surveillance:', error);
      setSurveillanceChecked(true);
      return null;
    } finally {
      setSurveillanceLoading(false);
    }
  };

  // Check surveillance when modal opens and broker is AngelOne
  useEffect(() => {
    const stocksToCheck = totalArray.length > 0 ? totalArray : dataArray;
    if (
      visible &&
      broker === 'Angel One' &&
      stocksToCheck.length > 0 &&
      !surveillanceChecked &&
      !surveillanceLoading
    ) {
      checkAngelOneSurveillance(stocksToCheck);
    }
  }, [visible, broker, totalArray.length, dataArray.length, surveillanceChecked, surveillanceLoading]);

  // Reset surveillance check when modal closes or broker changes
  useEffect(() => {
    if (!visible || broker !== 'Angel One') {
      setSurveillanceChecked(false);
      setSurveillanceData(null);
    }
  }, [visible, broker]);

  // The old local socket never subscribed this model's symbols: getCurrentPrice
  // was declared but never called, and it targeted the unrelated per-symbol
  // endpoint. Reuse the authenticated /ltp + /subscribe-array hook, which now
  // also performs missing/stale REST recovery and preserves exchange on reconnect.
  const {ltp, getLTPForSymbol} = useWebSocketCurrentPrice(totalArray);

  const totalInvestmentValue = totalArray
    .filter(item => item.orderType === 'BUY')
    .reduce((total, item) => {
      const currentPrice = getLTPForSymbol(item.symbol);
      const investment = item.qty * currentPrice;
      return total + investment;
    }, 0);
  // const handleRemoveStock = (symbol, tradeId) => {
  //   console.log('tra',symbol,tradeId);
  //   setStockDetails(
  //     stockDetails.filter(
  //       (stock) => stock.tradingSymbol !== symbol || stock.tradeId !== tradeId
  //     )
  //   );
  //   cartCount-=1;
  //   handleSelectStock(symbol,tradeId);
  // };

  //////////////////////////////////////////////////////////////////

  const openSucess = () => {
    // console.log('inside success');
    onCloseReviewTrade();
    setOpenSucessModal(true);
  };
  const onCloseReview = () => {
    // console.log('inside success');
    setOpenSucessModal(false);
  };

  const stockDetails = convertResponse(totalArray, broker);
  // ccxt-india scripmaster map — see brokerPublisher.resolveZerodhaSymbol.
  const symbolMap = useZerodhaSymbolMap(stockDetails, visible);
  const [loading, setLoading] = useState(false);
  const [reducingFunding, setReducingFunding] = useState(false);
  const clientCode = userDetails && userDetails?.clientCode;
  const apiKey = userDetails && userDetails?.apiKey;
  const jwtToken = userDetails && userDetails?.jwtToken;
  const my2pin = userDetails && userDetails?.my2Pin;
  const secretKey = userDetails && userDetails?.secretKey;
  const userId = userDetails && userDetails?._id;
  const mobileNumber = userDetails && userDetails?.phone_number;
  const panNumber = userDetails && userDetails?.panNumber;
  const serverId = userDetails && userDetails?.serverId;
  const viewToken = userDetails && userDetails?.viewToken;
  const sid = userDetails && userDetails?.sid;
  const dateString = userDetails && userDetails.token_expire;
  ///////////////////////////////////////////////
  //console.log('details--->',strategyDetails?.model_name,strategyDetails?.advisor,latestRebalance.model_Id,calculatedPortfolioData?.uniqueId,broker,userEmail,stockDetails)
  const checkValidApiAnSecret = data => {
    if (!data) return null;
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };
  // Refresh only this calculation; the saved capital instruction stays unchanged.
  const [fundingPlanToReplace, setFundingPlanToReplace] = useState(null);

  const continueWithAvailableFunds = async () => {
    if (reducingFunding) return;
    try {
      setReducingFunding(true);
      setFundingPlanToReplace(rebalanceContract?.plan?.id || null);
      await calculateRebalance(availableFundsOptions());
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
      await calculateRebalance(insufficientFundsAttemptOptions());
    } catch (error) {
      Alert.alert('Could not prepare orders', 'No orders were placed. Your investment target is unchanged. Please try again.');
    } finally {
      setReducingFunding(false);
    }
  };

  const retryAfterAddingFunds = async () => {
    if (typeof calculateRebalance !== 'function') {
      return;
    }
    try {
      setLoading(true);
      await calculateRebalance({forceRefresh: true});
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
    if (canExecuteRebalance(calculatedPortfolioData)) {
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
          getRebalanceBlockReason(calculatedPortfolioData),
      });
    }
    return false;
  };

  const placeOrder = async () => {
    if (!ensureRebalanceExecutable()) {
      return;
    }
    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) return;

    setLoading(true);

    try {
    // Pre-order: validate exchange information
    const hasExchangeEmpty = stockDetails.some((item) => item.exchange === ' ');
    if (hasExchangeEmpty) {
      Toast.show({
        type: 'error',
        text1: 'Exchange Error',
        text2: 'Error in exchange information, please try again',
      });
      setLoading(false);
      return;
    }

    // Pre-order: Dhan EDIS/DDPI check for sell orders
    // Use LIVE edis status from Dhan API, not the DB flag (is_authorized_for_sell persists
    // across sessions but Dhan EDIS authorization expires per-session)
    const allSellPreCheck = stockDetails.every(s => s.transactionType === 'SELL');
    const isMixedPreCheck =
      stockDetails.some(s => s.transactionType === 'BUY') &&
      stockDetails.some(s => s.transactionType === 'SELL');
    if (
      broker === 'Dhan' &&
      (allSellPreCheck || isMixedPreCheck) &&
      !isDhanSellAuthorizationReady(dhanEdisStatus, stockDetails)
    ) {
      setShowDhanTpinModel(true);
      onCloseReviewTrade();
      setLoading(false);
      return;
    }

    // Trade variant tagged on every per-trade object — see
    // docs/APP_ARCHITECTURE.md § 4.5.2 Trade variant field. Display-only.
    const variant = computeTradeVariant(allowAfterHoursOrders);
    const tradesWithVariant = stockDetails.map(s => ({ ...s, variant }));

    const getBasePayload = () => ({
      modelName: strategyDetails?.model_name,
      advisor: strategyDetails?.advisor,
      model_id: latestRebalance?.model_Id,
      unique_id: calculatedPortfolioData?.uniqueId,
      ...frozenPlanFields,
      user_broker: broker,
      user_email: userEmail,
      trades: tradesWithVariant,
    });

    const getBrokerSpecificPayload = () => {
      return {
        accessToken: jwtToken,
      };
    };

    const payload = {
      ...getBasePayload(),
      ...getBrokerSpecificPayload(),
    };

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

    const statusCheckHeaders = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': getTenantSubdomain(configData),
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    };

    const enrollStatusCheckQueue = async () => {
      try {
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          {
            userEmail: userEmail,
            modelName: strategyDetails?.model_name,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: broker,
          },
          { headers: statusCheckHeaders },
        );
      } catch (queueErr) {
        console.log('[OrderPlacement] status-check-queue error (non-fatal):', queueErr?.message);
      }
    };

    // SDK executeAdvice dual-path (Phase C) — main broker path.
      // When the SDK is enabled, try the orchestrator first. On failure,
      // fall through to legacy. SDK result wrapped to match response shape.
      let response;
      if (sdkExecuteAdviceEnabled) {
        try {
          const sdkResult = await sdkClient.executeAdvice({
            kind: 'mpRebalance',
            clientAdviceId: `mp-rebalance:${broker}:${rebalanceContract?.plan?.id || calculatedPortfolioData?.uniqueId || latestRebalance?.model_Id}:${rebalanceContract?.plan?.version || 0}`,
            brokerName: broker,
            modelId: latestRebalance?.model_Id,
            modelName: strategyDetails?.model_name,
            uniqueId: calculatedPortfolioData?.uniqueId,
            planId: rebalanceContract?.plan?.id,
            planVersion: rebalanceContract?.plan?.version,
            planHash: rebalanceContract?.plan?.hash,
            trades: payload.trades,
          });
          throwIfSdkNotSent(sdkResult);
          const mappedRows = (sdkResult?.rows || []).map(row => ({
            ...row,
            orderStatus: row.status,
            tradingSymbol: row.symbol,
          }));
          response = { data: { results: mappedRows } };
          console.log('[MPReviewTradeModal] SDK executeAdvice result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
        } catch (sdkErr) {
          console.error('[MPReviewTradeModal] SDK owns this attempt; legacy fallback blocked:', sdkErr?.message);
          throw sdkErr;
        }
      }
      if (!response) {
        response = await axios.request(config);
      }
      console.log('[OrderPlacement] API Response full:', JSON.stringify(response.data));
      console.log('[OrderPlacement] Results:', response.data.results);
      const checkData = response?.data?.results;

      // Handle session expired - broker needs reconnection
      if (response?.data?.sessionExpired) {
        onCloseReviewTrade();
        setLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: `Your ${broker} session has expired. Please reconnect your broker.`,
          visibilityTime: 5000,
        });
        setTimeout(() => {
          openBrokerModal(broker);
        }, 500);
        return;
      }

      // 1. Validate for empty or invalid results before processing (matching web)
      if (!checkData || !Array.isArray(checkData) || checkData.length === 0) {
        console.error('[OrderPlacement] API returned empty or invalid response:', response?.data);

        // Empty results are not sell-authorization evidence for Fyers.
        if ((allSellPreCheck || isMixedPreCheck) && broker !== 'Fyers') {
          if (broker === 'Dhan') {
            setShowDhanTpinModel(true);
          } else if (broker === 'Angel One') {
            setShowAngleOneTpinModel(true);
          } else if (broker === 'Zerodha') {
            setShowDdpiModal && setShowDdpiModal(true);
          } else {
            setShowOtherBrokerModel(true);
          }
          onCloseReviewTrade();
          setLoading(false);
          return;
        }

        // Show toast error for empty response
        Toast.show({
          type: 'error',
          text1: 'Order Processing Issue',
          text2: response?.data?.message || 'No orders were processed. Please check your broker app and try again.',
        });
        onCloseReviewTrade();

        // Still enroll in status-check-queue for async reconciliation
        await enrollStatusCheckQueue();
        setLoading(false);
        return;
      }

      const results = checkData;
      setOrderPlacementResponse(results);
      // Outgoing trade list (variant-tagged) — fallback source for the
      // success modal's `variant` lookups.
      setLastSubmittedTrades?.(tradesWithVariant);

      // 2. Always call model-portfolio-db-update first (before EDIS checks)
      const updateData = {
        modelId: latestRebalance.model_Id,
        orderResults: results,
        modelName: strategyDetails?.model_name,
        userEmail: userEmail,
        user_broker: broker,
      };
      try {
        await axios.post(
          `${server.server.baseUrl}api/model-portfolio-db-update`,
          updateData,
          { headers: statusCheckHeaders },
        );
      } catch (dbErr) {
        console.log('[OrderPlacement] model-portfolio-db-update error (non-fatal):', dbErr?.message);
      }

      // 3. Check if ALL orders failed — show results modal directly (matching web)
      const allOrdersFailed = checkData.every((order) => {
        const s = (order?.orderStatus || '').toUpperCase();
        return s === 'REJECTED' || s === 'CANCELLED' || s === 'FAILURE' || s === 'FAILED';
      });
      const sellAuthRejected = hasExplicitSellAuthRejection(response?.data);

      // Transient service-window short-circuit: if every failed row is a
      // documented broker maintenance-window error (e.g. Upstox
      // UDAPI100074 between 00:00–05:30 IST), show a soft toast instead
      // of the all-failed modal. Broker session is fine — just retry
      // after the window reopens. Matches web UpdateRebalanceModal.
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
        await enrollStatusCheckQueue();
        onCloseReviewTrade();
        setLoading(false);
        return;
      }

      if (!(broker === 'Fyers' && sellAuthRejected) && allOrdersFailed) {
        // All orders rejected — show results modal with rejection details, skip EDIS checks
        await enrollStatusCheckQueue();
        setLoading(false);
        openSucess();
        return;
      }

      // 4. Post-order EDIS rejection handling — set flag instead of returning
      let edisTriggered = false;
      if (checkData.length > 0) {
        const isMixed =
          checkData.some(s => s.transactionType === 'BUY') &&
          checkData.some(s => s.transactionType === 'SELL');
        const allSell = checkData.every(s => s.transactionType === 'SELL');

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

        // Special brokers
        if (
          !edisTriggered &&
          !isReturningFromOtherBrokerModal &&
          specialBrokers.includes(broker)
        ) {
          if ((allSell || isMixed) && rejectedSellCount >= 1 && successCount === 0 && setShowOtherBrokerModel) {
            setShowOtherBrokerModel(true);
            onCloseReviewTrade();
            setIsReturningFromOtherBrokerModal && setIsReturningFromOtherBrokerModal(false);
            edisTriggered = true;
          }
        } else if (
          (allSell || isMixed) &&
          rejectedSellCount >= 1 &&
          (broker !== 'Fyers' || sellAuthRejected)
        ) {
          // Always show broker-specific TPIN modal for rejected sell orders
          setOpenSucessModal(false);
          setLoading(false);

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
          onCloseReviewTrade();
          edisTriggered = true;
        } else {
          setOpenSucessModal(true);
        }
      }

      // 5. Always call status-check-queue
      await enrollStatusCheckQueue();

      // 6. Only show success modal if no EDIS modal was triggered
      if (!edisTriggered) {
        openSucess();
      }
      setLoading(false);

      // 7. Notify portfolio listeners (MPCard / RebalanceAdvices / AfterSubscriptionScreen)
      //    that an MP rebalance just executed so they re-fetch holdings/order-book.
      //    Mirrors the bespoke RebalanceModal emit pattern (RebalanceModal.js:949-957).
      const mpModelName = strategyDetails?.model_name || strategyDetails?.modelName;
      portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED, {
        userEmail,
        modelName: mpModelName,
        broker,
      });
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName: mpModelName,
        broker,
      });

      // 8. Refresh rebalance data to reflect current DB state
      if (typeof calculateRebalance === 'function') {
        calculateRebalance();
      }
    } catch (error) {
      console.log('[OrderPlacement] Error:', error?.response?.data || error.message);
      setLoading(false);

      if (handleFrozenPlanRecompute(error)) {
        return;
      }

      const responseData = error?.response?.data;
      const orderErrors = responseData?.orderErrors || [];

      // Determine a user-friendly error message
      let errorMessage;
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') {
        errorMessage = `Unable to connect to ${broker} trading server. This could be due to broker session expiry or a temporary server issue. Please reconnect your broker and try again.`;
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        errorMessage = `${broker} session has expired. Please reconnect your broker and try again.`;
      } else {
        errorMessage = responseData?.error || responseData?.message || error?.message || 'Order placement failed';
      }

      // Fyers recovery requires a stable backend classification; transport and
      // generic broker failures retain their original result.
      if (
        (allSellPreCheck || isMixedPreCheck) &&
        (broker !== 'Fyers' || hasExplicitSellAuthRejection(responseData))
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
        onCloseReviewTrade();
        return;
      }

      // If backend returned per-order error details, build response from those
      if (orderErrors.length > 0) {
        const errorResponse = orderErrors.map(err => ({
          symbol: err.symbol || err.tradingSymbol,
          tradingSymbol: err.tradingSymbol || err.symbol,
          transactionType: err.transactionType || 'BUY',
          quantity: err.quantity,
          orderType: err.orderType || 'MARKET',
          exchange: err.exchange || 'NSE',
          orderStatus: err.orderStatus || 'rejected',
          orderPlacement: 'failed',
          orderStatusMessage: err.reason || err.message || errorMessage,
          message_aq: err.reason || err.message || errorMessage,
        }));
        setOrderPlacementResponse(errorResponse);
        setOpenSucessModal(true);
        onCloseReviewTrade();
        return;
      }

      // Fallback: Build synthetic rejected response from stockDetails for the modal
      const syntheticVariant = computeTradeVariant(allowAfterHoursOrders);
      const syntheticResponse = stockDetails.map(stock => ({
        symbol: stock.tradingSymbol,
        tradingSymbol: stock.tradingSymbol,
        transactionType: stock.transactionType || 'BUY',
        quantity: stock.quantity,
        orderType: stock.orderType || 'MARKET',
        exchange: stock.exchange || 'NSE',
        orderStatus: 'rejected',
        orderPlacement: 'failed',
        orderStatusMessage: errorMessage,
        message_aq: errorMessage,
        variant: syntheticVariant,
      }));
      setOrderPlacementResponse(syntheticResponse);
      setLastSubmittedTrades?.(syntheticResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
    }
    //  console.log('yahan6');
  };

  const getBasePayload = () => ({
    modelName: strategyDetails?.model_name,
    advisor: strategyDetails?.advisor,
    model_id: latestRebalance.model_Id,
    unique_id: calculatedPortfolioData?.uniqueId,
    ...frozenPlanFields,
    broker: broker,
  });

  const additionalPayload = getBasePayload();

  const [isWebView, setWebView] = useState(false);
  const webViewRef = useRef(null);
  const [htmlContentfinal, setHtmlContent] = useState('');
  // Live prices keep updating while Kite is open. A fresh `source` object on
  // each render makes Android reconnect the page input and dismiss the IME.
  const publisherWebViewBaseUrl = getPublisherWebViewBaseUrl(configData);
  const publisherWebViewSource = useMemo(
    () => ({html: htmlContentfinal, baseUrl: publisherWebViewBaseUrl}),
    [htmlContentfinal, publisherWebViewBaseUrl],
  );

  const [zerodhaStatus, setZerodhaStatus] = useState(null);
  const [zerodhaRequestToken, setZerodhaRequestToken] = useState(null);
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
  const publisherLaunchPendingRef = useRef(false);
  const publisherIntentFiredRef = useRef(false);
  const publisherFullLegsRef = useRef([]);
  const publisherBatchDispatcherRef = useRef(createPublisherBatchDispatcher());
  const publisherAttemptRef = useRef(null);
  const kiteHandoff = useKiteHandoffGuard({
    visible: isWebView,
    webViewRef,
    configData,
    flow: 'model_initial_allocation_review',
    attemptId: publisherAttemptRef.current?.attemptId,
  });

  useEffect(() => {
    publisherIntentFiredRef.current = false;
    publisherAttemptRef.current = null;
  }, [calculatedPortfolioData?.uniqueId, frozenPlanFields.plan_id]);

  const recordPublisherIntent = async (publisherLegs, attempt, activationLegs, activationId) => {
    if (
      !calculatedPortfolioData?.uniqueId ||
      !userEmail
    ) {
      throw new Error('Refresh the portfolio to restore the execution identity.');
    }
    publisherIntentFiredRef.current = true;
    const headers = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': getTenantSubdomain(configData),
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
      ...executionBundleHeaders(),
    };
    try {
      const context = {
        source: 'mobile-model-portfolio-rebalance',
        attemptId: attempt.attemptId,
        modelId: latestRebalance?.model_Id,
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        uniqueId: calculatedPortfolioData?.uniqueId,
        planId: frozenPlanFields.plan_id || null,
      };
      const nodeIntentResponse = await axios.post(
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
        {timeout: PUBLISHER_ACK_TIMEOUT_MS, headers},
      );
      if (
        !nodeIntentResponse?.data?.intentId ||
        nodeIntentResponse?.data?.attemptId !== attempt.attemptId ||
        nodeIntentResponse?.data?.payloadMismatch
      ) {
        throw new Error('Execution session acknowledgement was incomplete');
      }

      const response = await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/publisher/intent`,
        {
          unique_id: calculatedPortfolioData.uniqueId,
          user_email: userEmail,
          user_broker: 'Zerodha',
          modelName: strategyDetails?.model_name,
          model_id: latestRebalance?.model_Id,
          advisor: strategyDetails?.advisor,
          legs: publisherLegs,
          kind: 'rebalance',
          attempt_id: attempt.attemptId,
          plan_id: frozenPlanFields.plan_id || null,
          plan_version: frozenPlanFields.plan_version ?? null,
          prepare_only: false,
          activation_legs: activationLegs,
          activation_id: activationId,
        },
        {
          timeout: PUBLISHER_ACK_TIMEOUT_MS,
          headers,
        },
      );
      if (!isPublisherActivationAcknowledged(response?.data) ||
          response?.data?.dispatchReserved !== true || response?.data?.activationId !== activationId) {
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
        headers,
        error,
      });
      await handleStaleExecutionBundle(error);
      throw error;
    }
  };
  const batchAdvancingRef = useRef(false);
  const advanceKiteBatchRef = useRef(null);
  const publisherGateCancelledRef = useRef(false);
  const settlementRiskAcceptedRef = useRef(false);

  useEffect(() => {
    if (!visible) publisherGateCancelledRef.current = true;
  }, [visible]);

  // Kite Publisher Modal state
  const [showKitePublisher, setShowKitePublisher] = useState(false);
  const [publisherBasketItems, setPublisherBasketItems] = useState([]);

  // Publisher order-book polling fallback for Kite Publisher WebView
  // callback misses. Canonical implementation lives in
  // `src/hooks/useKitePublisherPolling.js` — see
  // docs/REBALANCING.md § Kite Publisher polling fallback. Three known
  // scenarios where the WebView intercept silently fails:
  // cross-domain 302 loss on some Android WebView versions, OS-suspended
  // WebView when the user backgrounds to complete authentication in the
  // Kite app, and AsyncStorage hydration races. When the hook detects
  // new orders OR times out, it preserves that outcome for the downstream
  // order-book verification. Only detected orders are promoted to success.
  const {
    start: startKitePolling,
    stop: stopKitePolling,
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
      // never-placed buys as "sent". Only `orders-detected` (success) may
      // advance; a timeout is "unconfirmed" and must never advance.
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
      setZerodhaRequestType('basket');
    },
  });

  const handlePublisherClose = () => {
    stopKitePolling();
    publisherGateCancelledRef.current = true;
    // Two-phase: wipe the queued baskets so a stale queue can't replay a
    // partially-completed run on the next open.
    pendingKiteBatchesRef.current = [];
    currentKiteBatchIndexRef.current = 0;
    setWebView(false);
    setLoading(false);
    setZerodhaStatus(null);
    setZerodhaRequestType(null);
    Toast.show({
      type: 'info',
      text1: 'Order placement cancelled',
      text2: 'No order is marked placed until Zerodha confirms it.',
      visibilityTime: 4000,
    });
  };

  const handleModalRequestClose = () => {
    stopKitePolling();
    publisherGateCancelledRef.current = true;
    setZerodhaStatus(null);
    setZerodhaRequestType(null);
    if (isWebView) {
      setWebView(false);
      setLoading(false);
      return;
    }
    onCloseReviewTrade();
  };

  const handleWebViewNavigationStateChange = async newNavState => {
    // Handle navigation state changes, e.g., success/failure redirects
    const {url} = newNavState;
    console.log('[ZerodhaPublisher] Navigation URL:', url);

    const redirectStatus = parseKiteRedirectStatus(url);
    if (redirectStatus === 'cancelled') {
      console.log('[ZerodhaPublisher] Cancel redirect detected');
      handlePublisherClose();
      return false;
    }
    if (redirectStatus === 'success') {
      console.log('[ZerodhaPublisher] Success redirect detected');
      // Stop polling here too so it doesn't double-fire. The hook's
      // stop() flips its internal processed flag — any in-flight poll
      // tick will short-circuit instead of running onPublisherSettled.
      stopKitePolling();
      // Submission is not execution. The shared advance function waits for
      // full SELL fills and refreshed live margin before exposing BUY baskets.
      const advanced =
        advanceKiteBatchRef.current &&
        (await advanceKiteBatchRef.current({newOrders: []}));
      if (advanced) return false;
      setZerodhaStatus('success');
      setZerodhaRequestType('basket');
      setWebView(false); // Close WebView
      // checkZerodhaStatus will be called via useEffect when zerodhaStatus changes
      return false; // Prevent navigation
    }

    return true; // Allow navigation
  };

  // The Kite run returns before record-back and the order-book check finish.
  // Re-showing a placeable review in that window reads as "nothing happened,
  // place them again" while the orders are already sitting with the broker
  // (prod/arulthakur, 2026-09-17: a second launch minted the orphan rows).
  // Closing the modal still ends the wait.
  const awaitingOrderStatus = zerodhaStatus === 'success' && !isWebView;

  // Use configData first, fallback to Config env variable
  // Debug: Log all possible sources for API key
  console.log('[ZerodhaPublisher] ===== API KEY DEBUG =====');
  console.log('[ZerodhaPublisher] configData:', configData ? 'exists' : 'null');
  console.log('[ZerodhaPublisher] configData.config:', configData?.config ? 'exists' : 'null');
  console.log('[ZerodhaPublisher] configData.config.REACT_APP_ZERODHA_API_KEY:', configData?.config?.REACT_APP_ZERODHA_API_KEY || 'EMPTY');
  console.log('[ZerodhaPublisher] Config:', Config ? 'exists' : 'null');
  console.log('[ZerodhaPublisher] Config.REACT_APP_ZERODHA_API_KEY:', Config.REACT_APP_ZERODHA_API_KEY || 'EMPTY');

  // Try multiple sources for API key
  let zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY || Config.REACT_APP_ZERODHA_API_KEY;

  // If still empty, log warning
  if (!zerodhaApiKey) {
    console.log('[ZerodhaPublisher] WARNING: API Key not found!');
  } else {
    console.log('[ZerodhaPublisher] Using API key:', zerodhaApiKey.substring(0, 4) + '...');
  }

  console.log('[ZerodhaPublisher] Using API Key:', zerodhaApiKey ? `${zerodhaApiKey.substring(0, 4)}...` : 'UNDEFINED!');
  console.log('[ZerodhaPublisher] ===== END DEBUG =====');

  // Helper function to get last known price
  const getLastKnownPrice = (symbol) => {
    const price = getLTPForSymbol(symbol);
    return price !== null ? price : '-';
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
      const displayLtp = [
        getLastKnownPrice(resolved.tradingsymbol),
        getLastKnownPrice(stock.tradingSymbol),
        Number(stock.referencePrice),
      ].find(value => value !== '-' && Number(value) > 0);
      const ltp = isMarket ? freshLtp : (displayLtp || resolved.cachedLtp || 0);
      let orderPrice = 0;

      if (stock.orderType === 'LIMIT') {
        orderPrice = parseFloat(stock.price || 0);
      } else if (stock.orderType === 'MARKET' || stock.orderType === 'SL') {
        orderPrice = ltp && ltp !== '-' ? parseFloat(ltp) : 0;
      }

      const basketItem = convertToBasketItem('Zerodha', stock, symbolMap, {
        tradingsymbol: resolved.tradingsymbol,
        exchange: resolved.exchange,
        ltp,
        price: orderPrice,
        quantity: parseInt(stock.quantity, 10) || 1,
      });
      console.log('[ZerodhaPublisher] Basket item:', JSON.stringify(basketItem));
      return basketItem;
    });
  };

  // Submit one Kite basket from the queue: build its order items, render the
  // WebView form, restart order-book polling (fresh baseline per basket so a
  // previous side's orders are absorbed, never re-detected), open the WebView.
  const submitKiteBatch = async index => {
    const batch = pendingKiteBatchesRef.current[index];
    if (!batch) return;
    const freshProtectionPrices = await fetchFreshKiteProtectionPrices(
      batch,
      symbolMap,
    );
    await publisherBatchDispatcherRef.current.run({
      attemptId: publisherAttemptRef.current?.attemptId, index, legs: batch,
      authorize: activationId => recordPublisherIntent(
        publisherFullLegsRef.current, publisherAttemptRef.current, batch, activationId,
      ),
      open: async () => {
        const basket = buildKiteBasket(batch, freshProtectionPrices);
        const htmlContent = generateHtmlForm(basket, zerodhaApiKey);
        // Whole-basket polling: settling on the first visible order closed
        // the Kite page mid-basket and silently dropped the remaining legs.
        await startKitePolling({ expectedOrderCount: batch.length });
        currentKiteBatchIndexRef.current = index;
        setHtmlContent(htmlContent);
        setWebView(true);
        setLoading(false);
      },
    });
  };

  const finishKitePublisherRun = () => {
    setWebView(false);
    setLoading(false);
    setZerodhaStatus('success');
    setZerodhaRequestType('basket');
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
    const sellDeadline = Date.now() + SELL_GATE_TIMEOUT_MS;

    while (!publisherGateCancelledRef.current && Date.now() <= sellDeadline) {
      try {
        if (!firstPass || newOrders.length === 0) {
          newOrders = await getNewPublisherOrders();
        }
      } catch (error) {
        console.warn('[ZerodhaSellGate] Order-book refresh failed:', error?.message);
      }
      firstPass = false;
      const readiness = evaluateSellBatchOrders(currentSellOrders, newOrders);
      if (readiness.state === 'failed') return {status: 'failed', readiness};
      if (readiness.ready) break;
      await new Promise(resolve => setTimeout(resolve, SELL_GATE_POLL_INTERVAL_MS));
    }

    if (publisherGateCancelledRef.current) return {status: 'cancelled'};
    const sellReadiness = evaluateSellBatchOrders(currentSellOrders, newOrders);
    if (!sellReadiness.ready) return {status: 'sell-timeout', readiness: sellReadiness};

    const nextBatch = batches[nextIndex] || [];
    const nextIsBuy = nextBatch.some(
      leg => String(leg?.transactionType || '').toUpperCase() === 'BUY',
    );
    if (!nextIsBuy) return {status: 'ready'};

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
    while (!publisherGateCancelledRef.current && Date.now() <= marginDeadline) {
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
      if (availableCash !== null && availableCash + 1 >= requiredBuyingPower) {
        return {status: 'ready', requiredBuyingPower, availableCash};
      }
      if (isBrokerAuthError(JSON.stringify(fundsResponse || {}))) {
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
        if (gateResult.status === 'failed') {
          Toast.show({
            type: 'error',
            text1: 'A sell order did not complete',
            text2: 'Buy baskets were not opened. Review the broker results before repairing.',
            visibilityTime: 7000,
          });
          finishKitePublisherRun();
          return true;
        }
        if (gateResult.status !== 'ready') {
          setLoading(false);
          showSellGatePausedAlert(
            gateResult,
            () => advanceKiteBatchRef.current?.({newOrders: []}),
            async () => {
              settlementRiskAcceptedRef.current = true;
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
    if (!ensureRebalanceExecutable()) {
      return;
    }
    publisherGateCancelledRef.current = false;
    settlementRiskAcceptedRef.current = false;
    setLoading(true);
    const storageKey = 'stockDetailsZerodhaOrder';

    // Pre-check: Zerodha DDPI/EDIS authorization for sell orders
    const allBuyZerodha = stockDetails.every(s => s.transactionType === 'BUY');
    const allSellZerodha = stockDetails.every(s => s.transactionType === 'SELL');
    const isMixedZerodha =
      stockDetails.some(s => s.transactionType === 'BUY') &&
      stockDetails.some(s => s.transactionType === 'SELL');

    if ((allSellZerodha || isMixedZerodha) && !allBuyZerodha) {
      const canSell = isZerodhaSellAuthorized(userDetails);
      if (!canSell && setShowDdpiModal) {
        setShowDdpiModal(true);
        onCloseReviewTrade();
        setLoading(false);
        return;
      }
    }

    // Pre-flight: refuse to send orders with missing exchange. Kite Publisher
    // silently drops basket items whose symbol/exchange combo it can't resolve
    // (e.g. a BSE-only symbol sent with exchange=NSE), leaving the user with
    // a mystery "not in order book" state. Fail here with the offending symbols.
    const exchangeCheck = validateStockExchanges(stockDetails);
    if (!exchangeCheck.valid) {
      const missingList = exchangeCheck.missing.join(', ');
      const userMsg = `Cannot place order — exchange is missing for: ${missingList}. Please contact your manager to correct the trade before retrying.`;
      console.error('[ZerodhaPublisher] Blocked due to missing exchange:', missingList);
      const syntheticResponse = stockDetails.map(stock => {
        const stockMissing = !(stock.exchange && String(stock.exchange).trim());
        const perStockMsg = stockMissing
          ? 'Exchange missing — manager must correct this trade.'
          : 'Blocked: another trade in this batch was missing exchange.';
        return {
          symbol: stock.tradingSymbol,
          tradingSymbol: stock.tradingSymbol,
          transactionType: stock.transactionType || 'BUY',
          quantity: stock.quantity,
          orderType: stock.orderType || 'MARKET',
          exchange: stock.exchange || '',
          orderStatus: 'rejected',
          orderPlacement: 'failed',
          orderStatusMessage: perStockMsg,
          message_aq: perStockMsg,
        };
      });
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Order blocked — missing exchange',
        text2: userMsg,
        visibilityTime: 8000,
      });
      return;
    }

    // Debug: Verify API key is available
    console.log('[ZerodhaPublisher] handleZerodhaRedirect called, API Key:', zerodhaApiKey);
    if (!zerodhaApiKey) {
      console.error('[ZerodhaPublisher] FATAL: No API key available!');
      const syntheticResponse = stockDetails.map(stock => ({
        symbol: stock.tradingSymbol,
        tradingSymbol: stock.tradingSymbol,
        transactionType: stock.transactionType || 'BUY',
        quantity: stock.quantity,
        orderType: stock.orderType || 'MARKET',
        exchange: stock.exchange || 'NSE',
        orderStatus: 'rejected',
        orderPlacement: 'failed',
        orderStatusMessage: 'Zerodha API key not configured. Please reconnect your Zerodha account and try again.',
        message_aq: 'Zerodha API key not configured. Please reconnect your Zerodha account and try again.',
      }));
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
      setLoading(false);
      return;
    }

    // Tag `variant` on every per-trade object BEFORE the AsyncStorage write.
    // The REST path at L353 tags `tradesWithVariant` for ccxt's process-trade
    // call; the Zerodha publisher path needs the same tagging so the field
    // survives the AsyncStorage round-trip and lands in the record-orders
    // payload at L1141 → backend persists variant alongside the rest of the
    // order in model_portfolio_user. Variant is display-only per
    // docs/APP_ARCHITECTURE.md § 4.5.2 Trade variant field.
    const zerodhaVariant = computeTradeVariant(allowAfterHoursOrders);
    const zerodhaTrades = stockDetails.map(s => ({ ...s, variant: zerodhaVariant }));

    try {
      // Clear the existing value
      await AsyncStorage.removeItem(storageKey);

      // Set the new value (variant-tagged)
      await AsyncStorage.setItem(storageKey, JSON.stringify(zerodhaTrades));

      console.log('[ZerodhaPublisher] Stored stock details:', zerodhaTrades);
    } catch (error) {
      console.error('[ZerodhaPublisher] Error storing stock details:', error);
    }
    const apiKey = zerodhaApiKey;

    const currentISTDateTime = new Date();

    try {
      // Step 1: Update the database with the current IST date-time (mark as placed)
      console.log('[ZerodhaPublisher] Updating trade recommendations...');
      const res = await axios.post(
        `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
        {
          // Send variant-tagged trades so the DB record carries the same
          // AMO/REGULAR tag the AsyncStorage write does — keeps the two
          // persistence layers consistent.
          stockDetails: zerodhaTrades,
          leaving_datetime: currentISTDateTime,
          email: userEmail,
          trade_given_by: strategyDetails?.advisor || configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
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
        }
      );

      const allStockDetails = res?.data?.data;
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
        quantity: detail.Quantity,
        priority: detail.Priority,
        tradeId: detail.tradeId,
        // This is the exact tag written into the Kite basket. Dropping it
        // forced record-back to guess from symbol/side/qty, which is unsafe
        // when the same demat account executes multiple models.
        zerodhaTradeId: detail.zerodhaTradeId,
        publisherTag: detail.zerodhaTradeId,
        modelId: latestRebalance?.model_Id,
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        uniqueId: calculatedPortfolioData?.uniqueId,
        user_broker: 'Zerodha',
      }));

      const publisherAttempt = createZerodhaPublisherAttempt({
        stockDetails: filteredStockDetails,
        userEmail,
        flow: 'rebalance',
      });
      publisherAttemptRef.current = publisherAttempt;
      publisherFullLegsRef.current = JSON.parse(JSON.stringify(filteredStockDetails));

      // Store updated stock details for post-order processing
      await AsyncStorage.multiSet([
        ['stockDetailsZerodhaOrder', JSON.stringify(filteredStockDetails)],
        ['additionalPayload', JSON.stringify({
          ...additionalPayload,
          attemptId: publisherAttempt.attemptId,
        })],
      ]);

      console.log('[ZerodhaPublisher] Using form submission flow...');
      console.log('[ZerodhaPublisher] API Key being used:', apiKey);

      // TWO-PHASE PUBLISHER (2026-08-06, mirrors web Fix C): split the legs
      // into [sellBaskets..., buyBaskets...]. Submit sells first; a publisher
      // redirect only starts broker fill verification. After full fills, live
      // margin either opens buys or shows the explicit settlement-risk choice.
      pendingKiteBatchesRef.current = createModelPortfolioPublisherBatches(
        filteredStockDetails,
        'Zerodha',
      );
      currentKiteBatchIndexRef.current = 0;
      // Mobile WebView submission does not depend on a browser popup gesture,
      // so wait for durable intent + reconciliation acknowledgement and fail
      // closed before Kite can receive the basket.
      await submitKiteBatch(0);
    } catch (error) {
      console.error('[ZerodhaPublisher] Failed to update trade recommendation:', error);
      setLoading(false);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to prepare basket order. Please try again.';
      // A batch refused AFTER the dispatch boundary may already be with the
      // broker. Reporting every leg "rejected" there is a claim we cannot
      // support, and it invites the retry that double-places — so an uncertain
      // outcome is reported as pending, with the broker named as the source of
      // truth. Ordinary preparation failures still report as rejected.
      const dispatchUncertain = error?.dispatchUncertain === true;
      const syntheticResponse = stockDetails.map(stock => ({
        symbol: stock.tradingSymbol,
        tradingSymbol: stock.tradingSymbol,
        transactionType: stock.transactionType || 'BUY',
        quantity: stock.quantity,
        orderType: stock.orderType || 'MARKET',
        exchange: stock.exchange || 'NSE',
        orderStatus: dispatchUncertain ? 'pending' : 'rejected',
        orderPlacement: dispatchUncertain ? 'pending' : 'failed',
        orderStatusMessage: errorMsg,
        message_aq: errorMsg,
      }));
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
    }

    } finally { publisherLaunchPendingRef.current = false; }
  };

  // Redirect URL for Kite to return after order placement
  const appURL = 'success';
  const generateHtmlForm = (basket, apiKey) => {
    const basketJson = JSON.stringify(basket);
    console.log('[ZerodhaPublisher] Form submission basket:', basketJson);
    return `<html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div id="debug-info" style="padding: 20px; font-family: monospace;">
            <p>API Key: ${apiKey?.substring(0, 4)}...</p>
            <p>Basket Items: ${basket.length}</p>
            <p>Basket: ${basketJson}</p>
          </div>
          <form id="zerodhaForm" method="POST" action="https://kite.zerodha.com/connect/basket">
            <input type="hidden" name="api_key" value="${apiKey}" />
            <input type="hidden" name="data" value='${basketJson}' />
            <input type="hidden" name="redirect_params" value="${appURL}=true" />
          </form>
          <script>
            console.log('Submitting form with api_key: ${apiKey}');
            console.log('Basket data:', '${basketJson.replace(/'/g, "\\'")}');
            try {
              document.getElementById('zerodhaForm').submit();
            } catch(e) {
              console.log('Form submit error:', e);
              document.body.innerHTML = '<p style="color:red">Error submitting form. Please try again.</p>';
            }
          </script>
        </body>
      </html>
    `;
  };

  const fetchData = async () => {
    try {
      // Fetch pending order data
      const pendingOrderData = await AsyncStorage.getItem(
        'stockDetailsZerodhaOrder',
      );
      const storedStockDetails = pendingOrderData
        ? JSON.parse(pendingOrderData)
        : null;
      if (storedStockDetails) {
        console.log('Pending Order Zerodha:', storedStockDetails);
      }

      // Fetch additional payload data
      const payloadData = await AsyncStorage.getItem('additionalPayload');
      const storedAdditionalPayload = payloadData
        ? JSON.parse(payloadData)
        : null;
      return {
        zerodhaStockDetails: storedStockDetails,
        zerodhaAdditionalPayload: storedAdditionalPayload,
      };
    } catch (error) {
      console.error('Error fetching data from AsyncStorage:', error);
      return {
        zerodhaStockDetails: null,
        zerodhaAdditionalPayload: null,
      };
    }
  };

  const checkZerodhaStatus = async () => {
    // Stop the publisher polling — either the WebView callback fired or
    // polling already settled. Idempotent: if polling already stopped,
    // this is a no-op.
    stopKitePolling();

    const {zerodhaStockDetails, zerodhaAdditionalPayload} = await fetchData();
    const publisherStockDetails =
      (Array.isArray(zerodhaStockDetails) && zerodhaStockDetails.length > 0
        ? zerodhaStockDetails
        : null) ||
      (Array.isArray(stockDetails) ? stockDetails : []);

    console.log('[ZerodhaPublisher] checkZerodhaStatus - Status:', zerodhaStatus, 'Type:', zerodhaRequestType);
    console.log('[ZerodhaPublisher] Stock Details:', publisherStockDetails);

    if (
      zerodhaStatus !== null &&
      zerodhaStatus !== 'cancelled' &&
      zerodhaRequestType === 'basket'
    ) {
      setLoading(true);

      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': getTenantSubdomain(configData),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      let orderResponse;
      let hasConfirmedExecution = false;
      let backendRecordBody;

      try {
        if (publisherStockDetails.length === 0 || !userEmail) {
          throw new Error(
            'Order was sent to Kite, but its details could not be loaded for status verification.',
          );
        }

        // Step 1: Record orders and fetch actual statuses from Zerodha
        console.log('[ZerodhaPublisher] Step 1: Recording publisher orders...');
        const recordResponse = await axios.post(
          `${server.server.baseUrl}api/zerodha/publisher/record-orders`,
          {
            stockDetails: publisherStockDetails,
            publisherResults: [{ status: zerodhaStatus, batchIndex: 0 }],
            userEmail: userEmail,
            broker: 'Zerodha',
            attemptId:
              publisherAttemptRef.current?.attemptId ||
              zerodhaAdditionalPayload?.attemptId,
            model_id: latestRebalance?.model_Id,
            modelName: strategyDetails?.model_name,
            advisor: strategyDetails?.advisor,
            unique_id: calculatedPortfolioData?.uniqueId,
          },
          { headers: requestHeaders }
        );

        console.log('[ZerodhaPublisher] Record orders response:', recordResponse.data);
        orderResponse = annotateSettlementRiskResults(
          recordResponse.data.response || recordResponse.data.results || [],
          settlementRiskAcceptedRef.current,
        );

        // Step 2: Update model portfolio database with order results
        console.log('[ZerodhaPublisher] Step 2: Updating model portfolio DB...');
        try {
          await axios.post(
            `${server.server.baseUrl}api/model-portfolio-db-update`,
            {
              modelId: latestRebalance?.model_Id,
              orderResults: orderResponse,
              modelName: strategyDetails?.model_name,
              userEmail: userEmail,
              user_broker: 'Zerodha',
            },
            { headers: requestHeaders }
          );
        } catch (dbErr) {
          console.warn('[ZerodhaPublisher] model-portfolio-db-update error (non-fatal):', dbErr?.message);
        }

        // Step 3: Update portfolio holdings from Zerodha
        console.log('[ZerodhaPublisher] Step 3: Updating portfolio holdings...');
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}zerodha/user-portfolio`,
            { user_email: userEmail },
            { headers: requestHeaders }
          );
        } catch (holdingsErr) {
          console.warn('[ZerodhaPublisher] portfolio holdings update error (non-fatal):', holdingsErr?.message);
        }

        // Step 4: Update subscriber execution status
        if (orderResponse && orderResponse.length > 0) {
        let backendExecutionComplete = false;

          // Step 5: Record order results in model_portfolio_user
          try {
            const canonicalRecord = await axios.post(
              `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
              {
                modelName: strategyDetails?.model_name,
                model_id: latestRebalance?.model_Id,
                unique_id: calculatedPortfolioData?.uniqueId,
                advisor: strategyDetails?.advisor,
                order_results: orderResponse,
                user_email: userEmail,
                user_broker: 'Zerodha',
                ...frozenPlanFields,
              },
              { headers: requestHeaders }
            );
            backendRecordBody = canonicalRecord.data;
          backendExecutionComplete = isPublisherExecutionComplete(backendRecordBody);

            hasConfirmedExecution = backendExecutionComplete;
          } catch (recordErr) {
            console.error('[ZerodhaPublisher] Error recording publisher results:', recordErr);
          }
        }

      } catch (error) {
        console.error('[ZerodhaPublisher] Error recording publisher orders:', error);
        console.error('[ZerodhaPublisher] Error details:', error.response?.data);

        // On error: show as "Unknown" — orders may have been placed in Kite,
        // we just can't confirm status (matching web frontend)
        orderResponse = publisherStockDetails.map(stock => ({
          tradingSymbol: stock.tradingSymbol,
          symbol: stock.tradingSymbol,
          transactionType: stock.transactionType || 'BUY',
          quantity: stock.quantity,
          orderType: stock.orderType || 'MARKET',
          exchange: stock.exchange || 'NSE',
          orderStatus: 'Unknown',
          orderStatusMessage: 'Order sent via Kite. Please check your Kite app for actual status.',
          message_aq: 'Order sent via Kite. Please check your Kite app for actual status.',
        }));

        // Queue enrollment below triggers backend verification; do not overwrite status on a client error.

      }

      // Always enroll in status-check-queue regardless of record-orders success/failure
      try {
        console.log('[ZerodhaPublisher] Adding to status check queue...');
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          {
            userEmail: userEmail,
            modelName: strategyDetails?.model_name,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: 'Zerodha',
          },
          { headers: requestHeaders }
        );
      } catch (queueErr) {
        console.error('[ZerodhaPublisher] Error adding to status-check-queue:', queueErr);
      }

      // Always show results modal (matching web frontend pattern)
      setOrderPlacementResponse(includeUnconfirmedPublisherLegs(orderResponse, publisherStockDetails, backendRecordBody));
      setOpenSucessModal(true);
      onCloseReviewTrade();
      setLoading(false);

      // Notify portfolio listeners (MPCard / RebalanceAdvices /
      // AfterSubscriptionScreen) that an MP rebalance just executed so they
      // re-fetch holdings/order-book. Mirrors the REST-path emit at L649-658
      // and the Fyers-publisher emit at L1613-1620 — without this, the MP
      // Zerodha publisher success path was the only success branch in this
      // file that didn't fire the portfolio refresh events, leaving the
      // holdings widgets stale until next manual refresh. Also fires on
      // the synthetic "Unknown" response below (record-orders HTTP failure)
      // since orders may still have placed in Kite. RebalanceModal does the
      // same emit pattern for its Zerodha publisher path at L969-977.
      const mpModelNameZerodha = strategyDetails?.model_name || strategyDetails?.modelName;
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName: mpModelNameZerodha,
        broker: 'Zerodha',
      });
      if (hasConfirmedExecution) {
        portfolioEvents.emit(PORTFOLIO_EVENTS.REBALANCE_EXECUTED, {
          userEmail,
          modelName: mpModelNameZerodha,
          broker: 'Zerodha',
        });
      }

      // Refresh rebalance data to reflect current DB state
      if (typeof calculateRebalance === 'function') {
        calculateRebalance();
      }

      // Clean up AsyncStorage
      await AsyncStorage.removeItem('stockDetailsZerodhaOrder');
      await AsyncStorage.removeItem('additionalPayload');

      // Reset state
      setZerodhaStatus(null);
      setZerodhaRequestType(null);
    }
  };

  useEffect(() => {
    if (
      zerodhaStatus !== null &&
      zerodhaStatus !== 'cancelled' &&
      zerodhaRequestType === 'basket' &&
      jwtToken !== undefined
    ) {
      checkZerodhaStatus();
    }
  }, [zerodhaStatus, zerodhaRequestType, userEmail, jwtToken]);

  // --- Fyers Publisher Flow ---

  const handleFyersRedirect = async () => {
    if (!ensureRebalanceExecutable()) {
      return;
    }
    const sessionValid = await validateBrokerSession(broker, jwtToken, { checkFreshness: true });
    if (!sessionValid) return;

    // Pre-flight: refuse to send orders with missing exchange. Fyers symbols
    // encode the exchange in the form "NSE:SBIN-EQ"; a blank exchange would
    // produce ":SBIN-EQ" which Fyers rejects or mis-routes silently.
    const exchangeCheck = validateStockExchanges(stockDetails);
    if (!exchangeCheck.valid) {
      const missingList = exchangeCheck.missing.join(', ');
      console.error('[FyersPublisher] Blocked due to missing exchange:', missingList);
      Toast.show({
        type: 'error',
        text1: 'Order blocked — missing exchange',
        text2: `Missing exchange for: ${missingList}. Please contact your manager.`,
        visibilityTime: 8000,
      });
      onCloseReviewTrade();
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

      // Record trade intent
      try {
        await axios.post(
          `${server.server.baseUrl}api/zerodha/model-portfolio/update-reco-with-zerodha-model-pf`,
          {
            stockDetails: stockDetails,
            leaving_datetime: currentISTDateTime,
            email: userEmail,
            trade_given_by: strategyDetails?.advisor || configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
          },
          { headers: requestHeaders },
        );
      } catch (recoErr) {
        console.warn('[FyersPublisher] update-reco failed (non-critical):', recoErr);
      }

      // Place orders via Fyers API through process-trade.
      // Variant tagged per-trade — see docs/APP_ARCHITECTURE.md § 4.5.2.
      const fyersVariant = computeTradeVariant(allowAfterHoursOrders);
      const fyersTrades = stockDetails.map(s => ({ ...s, variant: fyersVariant }));
      const payload = {
        clientId: clientCode,
        accessToken: jwtToken,
        user_email: userEmail,
        user_broker: 'Fyers',
        modelName: strategyDetails?.model_name,
        advisor: strategyDetails?.advisor,
        model_id: latestRebalance?.model_Id,
        unique_id: calculatedPortfolioData?.uniqueId,
        ...frozenPlanFields,
        returnDateTime: istDatetime,
        trades: fyersTrades,
      };

      // SDK executeAdvice dual-path (Phase C) — Fyers publisher path.
      let response;
      if (sdkExecuteAdviceEnabled) {
        try {
          const sdkResult = await sdkClient.executeAdvice({
            kind: 'mpRebalance',
            clientAdviceId: `mp-rebalance:Fyers:${rebalanceContract?.plan?.id || calculatedPortfolioData?.uniqueId || latestRebalance?.model_Id}:${rebalanceContract?.plan?.version || 0}`,
            brokerName: 'Fyers',
            modelId: latestRebalance?.model_Id,
            modelName: strategyDetails?.model_name,
            uniqueId: calculatedPortfolioData?.uniqueId,
            planId: rebalanceContract?.plan?.id,
            planVersion: rebalanceContract?.plan?.version,
            planHash: rebalanceContract?.plan?.hash,
            trades: fyersTrades,
          })
          throwIfSdkNotSent(sdkResult);
          const mappedRows = (sdkResult?.rows || []).map(row => ({
            ...row,
            orderStatus: row.status,
            tradingSymbol: row.symbol,
          }));
          response = { data: { results: mappedRows } };
          console.log('[MPReviewTradeModal] SDK executeAdvice (Fyers) result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
        } catch (sdkErr) {
          console.error('[MPReviewTradeModal] SDK owns this Fyers attempt; legacy fallback blocked:', sdkErr?.message);
          throw sdkErr;
        }
      }
      if (!response) {
        response = await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/process-trade`,
          payload,
          { headers: requestHeaders, timeout: 120000 },
        );
      }

      const checkData = response?.data?.results;

      // Handle session expired - broker needs reconnection
      if (response?.data?.sessionExpired) {
        onCloseReviewTrade();
        setLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: `Your Fyers session has expired. Please reconnect your broker.`,
          visibilityTime: 5000,
        });
        setTimeout(() => {
          openBrokerModal('Fyers');
        }, 500);
        return;
      }

      // 1. Validate for empty or invalid results
      if (!checkData || !Array.isArray(checkData) || checkData.length === 0) {
        console.error('[FyersPublisher] API returned empty or invalid response:', response?.data);
        Toast.show({
          type: 'error',
          text1: 'Order Processing Issue',
          text2: response?.data?.message || 'No orders were processed. Please check your Fyers app and try again.',
        });
        onCloseReviewTrade();

        // Still enroll in status-check-queue for async reconciliation
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
            {
              userEmail: userEmail,
              modelName: strategyDetails?.model_name,
              advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
              broker: 'Fyers',
            },
            { headers: requestHeaders },
          );
        } catch (queueErr) {
          console.warn('[FyersPublisher] status-check-queue failed:', queueErr);
        }
        setLoading(false);
        return;
      }

      setOrderPlacementResponse(includeUnconfirmedPublisherLegs(checkData, stockDetails));

      // 2. Always update model portfolio DB first (before EDIS checks)
      try {
        await axios.post(
          `${server.server.baseUrl}api/model-portfolio-db-update`,
          {
            modelId: latestRebalance?.model_Id,
            orderResults: checkData,
            modelName: strategyDetails?.model_name,
            userEmail: userEmail,
            user_broker: 'Fyers',
          },
          { headers: requestHeaders },
        );
      } catch (dbErr) {
        console.warn('[FyersPublisher] model-portfolio-db-update error (non-fatal):', dbErr?.message);
      }

      // 3. Update subscriber execution status
      if (checkData.length > 0) {
        // Backend record-back publishes the authoritative status.

        // Record publisher results
        try {
          await axios.post(
            `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
            {
              modelName: strategyDetails?.model_name,
              model_id: latestRebalance?.model_Id,
              unique_id: calculatedPortfolioData?.uniqueId,
              advisor: strategyDetails?.advisor,
              order_results: checkData,
              user_email: userEmail,
              user_broker: 'Fyers',
              ...frozenPlanFields,
            },
            { headers: requestHeaders },
          );
        } catch (err) {
          console.warn('[FyersPublisher] record-publisher-results failed:', err);
        }
      }

      // 4. EDIS/TPIN check — only explicit backend evidence may interrupt.
      let edisTriggered = false;
      if (checkData.length > 0) {
        const allSell = checkData.every(s => s.transactionType === 'SELL');
        const isMixed =
          checkData.some(s => s.transactionType === 'BUY') &&
          checkData.some(s => s.transactionType === 'SELL');
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
          hasExplicitSellAuthRejection(response?.data) &&
          setShowFyersTpinModal
        ) {
          setShowFyersTpinModal(true);
          onCloseReviewTrade();
          edisTriggered = true;
        }
      }

      // 5. Always enroll in status-check-queue
      try {
        await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
          {
            userEmail: userEmail,
            modelName: strategyDetails?.model_name,
            advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
            broker: 'Fyers',
          },
          { headers: requestHeaders },
        );
      } catch (queueErr) {
        console.warn('[FyersPublisher] status-check-queue failed:', queueErr);
      }

      // 6. Only show success modal if no EDIS modal was triggered
      if (!edisTriggered) {
        openSucess();
      }
      setLoading(false);

      // 8. Notify portfolio listeners — Fyers publisher success path.
      const mpModelNameFyers = strategyDetails?.model_name || strategyDetails?.modelName;
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName: mpModelNameFyers,
        broker: 'Fyers',
      });
      portfolioEvents.emit(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, {
        userEmail,
        modelName: mpModelNameFyers,
        broker: 'Fyers',
      })

      // 9. Refresh rebalance data to reflect current DB state
      if (typeof calculateRebalance === 'function') {
        calculateRebalance();
      }
    } catch (error) {
      setLoading(false);
      console.error('[FyersPublisher] Error:', error);

      if (handleFrozenPlanRecompute(error)) {
        return;
      }

      const responseData = error?.response?.data;
      const orderErrors = responseData?.orderErrors || [];

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
          responseData?.error || responseData?.message ||
          error?.message || 'Order placement failed';
      }

      // If backend returned per-order error details, build response from those
      if (orderErrors.length > 0) {
        const errorResponse = orderErrors.map(err => ({
          symbol: err.symbol || err.tradingSymbol,
          tradingSymbol: err.tradingSymbol || err.symbol,
          transactionType: err.transactionType || 'BUY',
          quantity: err.quantity,
          orderType: err.orderType || 'MARKET',
          exchange: err.exchange || 'NSE',
          orderStatus: err.orderStatus || 'rejected',
          orderPlacement: 'failed',
          orderStatusMessage: err.reason || err.message || errorMessage,
          message_aq: err.reason || err.message || errorMessage,
        }));
        setOrderPlacementResponse(errorResponse);
        setOpenSucessModal(true);
        onCloseReviewTrade();
        return;
      }

      // Fallback: Build synthetic rejected response from stockDetails for the modal
      const syntheticResponse = stockDetails.map(stock => ({
        symbol: stock.tradingSymbol,
        tradingSymbol: stock.tradingSymbol,
        transactionType: stock.transactionType || 'BUY',
        quantity: stock.quantity,
        orderType: stock.orderType || 'MARKET',
        exchange: stock.exchange || 'NSE',
        orderStatus: 'rejected',
        orderPlacement: 'failed',
        orderStatusMessage: errorMessage,
        message_aq: errorMessage,
      }));
      setOrderPlacementResponse(syntheticResponse);
      setOpenSucessModal(true);
      onCloseReviewTrade();
    }
  };

  // --- End Fyers Publisher Flow ---

  const [isLoading, setIsLoading] = useState(false);
  const hasZeroQuantity = stockDetails.some(stock => stock.quantity === 0);
  const [InputFixSizeValue, setInputFixSizeValue] = useState(0);

  const sheet = useRef(null);
  const scrollViewRef = useRef(null);
  /////////////////////////////////////////////////////////////////

  const renderItem = ({item}) => {
    //console.log('main Item,',item);
    if (!item) {
      return null; // or a fallback UI element if desired
    }
    return (
      <View style={styles.rowContainer}>
        <View style={styles.leftContainer}>
          <Text style={styles.symbol}>{item.symbol}</Text>
          <Text style={styles.buyOrder}>BUY</Text>
        </View>
        <View style={styles.quantityContainer}>
          <Text
            style={{
              color: 'black',
              fontFamily: designFont('Poppins-Regular'),
              alignContent: 'center',
              alignItems: 'center',
              alignSelf: 'center',
            }}>
            {getLTPForSymbol(item.symbol)
              ? `₹${getLTPForSymbol(item.symbol)}`
              : '₹--'}
          </Text>
        </View>
        <View style={styles.rightContainer}>
          {!confirmOrder ? (
            <Text style={styles.cellTextmktprice}>
              {parseFloat(item.value * 100).toFixed(2)}%
            </Text>
          ) : (
            <Text style={styles.cellTextmktprice}>Qty-{item.qty}</Text>
          )}
        </View>
      </View>
    );
  };

  if (visible && isWebView) {
    return (
      <PublisherWebViewOverlay
        source={publisherWebViewSource}
        webViewRef={webViewRef}
        onClose={handlePublisherClose}
        onLoadStart={event => {
          setIsLoading(true);
          kiteHandoff.onLoadStart(event);
        }}
        onLoadEnd={event => {
          setIsLoading(false);
          kiteHandoff.onLoadEnd(event);
        }}
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
      onRequestClose={handleModalRequestClose}
      animationType="slide"
      hardwareAccelerated={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, {width: width * 1}]}>
          {isWebView ? (
            <View
              style={{
                flex: 0,
                height: 600,
                borderTopRightRadius: 10,
                borderTopLeftRadius: 10,
                backgroundColor: 'white',
                padding: 10,
              }}>
              <View style={{alignContent: 'flex-end', alignItems: 'flex-end'}}>
                <TouchableOpacity onPress={handlePublisherClose}>
                  <XIcon size={16} color={'black'} />
                </TouchableOpacity>
              </View>
              <WebView
                ref={webViewRef}
                style={{
                  flex: 1,
                  borderTopRightRadius: 10,
                  borderTopLeftRadius: 10,
                }}
                source={publisherWebViewSource}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
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
            <>
              {/* Loading Overlay */}
              {(calculatedLoading || loading || isLoading || reducingFunding) && (
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  zIndex: 999,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                }}>
                  <ActivityIndicator size="large" color={designColor('000')} />
                  <Text style={{
                    marginTop: 15,
                    fontSize: 16,
                    fontFamily: designFont('Satoshi-Medium'),
                    color: designColor('333'),
                  }}>
                    {reducingFunding
                      ? 'Refreshing calculation...'
                      : loading
                        ? 'Placing Order...'
                        : 'Calculating Rebalance...'}
                  </Text>
                  <Text style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontFamily: designFont('Satoshi-Regular'),
                    color: designColor('666'),
                  }}>
                    Please wait while we process your request
                  </Text>
                </View>
              )}
              <View style={styles.horizontal} />
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                <Text style={styles.modalHeader1}>
                  Review Trade Details {fileName}
                </Text>
                <TouchableOpacity
                  style={{marginRight: 20}}
                  onPress={onCloseReviewTrade}>
                  <XIcon size={24} color={designColor('000')} />
                </TouchableOpacity>
              </View>

              <View style={{backgroundColor: designColor('f8f8f8')}}></View>
              <View
                style={{
                  borderWidth: 0.5,
                  borderColor: 'grey',
                  marginTop: 5,
                }}></View>

              {/* Surveillance Warning for Angel One */}
              {broker === 'Angel One' &&
                surveillanceData?.surveillance &&
                (() => {
                  const surveillanceStocks = surveillanceData.surveillance.filter(
                    (stock) =>
                      stock.found === true &&
                      stock.surveillance &&
                      stock.surveillance !== '' &&
                      stock.surveillance !== 'N',
                  );

                  if (surveillanceStocks.length > 0) {
                    return (
                      <View style={styles.surveillanceWarning}>
                        <View style={styles.surveillanceHeader}>
                          <AlertTriangleIcon size={18} color={designColor('dc2626')} />
                          <Text style={styles.surveillanceTitle}>
                            Surveillance Alert
                          </Text>
                        </View>
                        <Text style={styles.surveillanceText}>
                          The following stocks are under Angel One surveillance measures
                          and may be rejected via API:
                        </Text>
                        {surveillanceStocks.map((stock, index) => (
                          <Text key={index} style={styles.surveillanceStock}>
                            • <Text style={{fontFamily: designFont('Poppins-Bold')}}>{stock.symbol}</Text>{' '}
                            (Surveillance: {stock.surveillance})
                          </Text>
                        ))}
                        <Text style={styles.surveillanceNote}>
                          Please trade these stocks manually through the Angel One mobile
                          app or web platform.
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })()}

              <FlatList
                data={totalArray.length > 0 ? totalArray : dataArray}
                renderItem={renderItem}
                keyExtractor={item => item.symbol}
                ListEmptyComponent={
                  <View
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 20,
                    }}>
                    <View
                      style={{
                        borderRadius: 50,
                        backgroundColor: designColor('ebecef'),
                        padding: 20,
                      }}>
                      <CandlestickChartIcon size={40} color={'black'} />
                    </View>
                    <Text
                      style={{
                        fontFamily: designFont('Poppins-SemiBold'),
                        color: 'black',
                        fontSize: 18,
                        marginVertical: 10,
                      }}>
                      {fundingConsent?.required ? 'Choose how to fund your full plan' : 'No Orders to Place'}
                    </Text>
                    <Text style={{fontFamily: designFont('Poppins-Medium'), color: 'grey'}}>
                      {fundingConsent?.required
                        ? fundingConsent.canContinueWithAvailableFunds
                          ? `Add ₹${Number(fundingConsent.shortfall || 0).toLocaleString('en-IN')} or continue with available funds. Your investment target stays unchanged.`
                          : fundingConsent.canAttemptWithInsufficientFunds
                            ? `Add ₹${Number(fundingConsent.shortfall || 0).toLocaleString('en-IN')}, or review the target stocks and attempt the buy. Your broker may reject the orders.`
                            : `Add ₹${Number(fundingConsent.shortfall || 0).toLocaleString('en-IN')} to your broker, then calculate again. Your investment target stays unchanged.`
                        : 'Add item to cart to place order.'}
                    </Text>
                  </View>
                }
                contentContainerStyle={{
                  paddingHorizontal: 10,
                  marginBottom: 10,
                }}
              />

              {fundingConsent?.show && (
                <View style={{
                  marginHorizontal: 10,
                  marginBottom: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: designColor('cbd5e1'),
                  borderRadius: 8,
                  backgroundColor: designColor('f8fafc'),
                }}>
                  <Text style={{fontFamily: designFont('Poppins-SemiBold'), color: designColor('0f172a'), fontSize: 13, lineHeight: 20}}>
                    {fundingPanelCopy(fundingConsent).title}
                  </Text>
                  <Text style={{fontFamily: designFont('Poppins-Regular'), color: designColor('475569'), fontSize: 11, lineHeight: 18, marginTop: 4, marginBottom: 10}}>
                    {fundingConsent.attemptingDespiteShortfall ? fundingPanelCopy(fundingConsent).body : <>Closing makes no change. {fundingConsent.canContinueWithAvailableFunds ? 'Add funds and retry, or continue with available funds for this calculation.' : fundingConsent.canAttemptWithInsufficientFunds ? 'Add funds, or review the target stocks and attempt the buy. The broker may reject the orders.' : 'Add funds to your broker, then calculate again.'} Your investment target stays unchanged.</>}
                  </Text>
                  {fundingConsent.canContinueWithAvailableFunds && (
                    <TouchableOpacity onPress={continueWithAvailableFunds} disabled={reducingFunding || loading} style={{backgroundColor: designColor('0f172a'), padding: 10, borderRadius: 8, alignItems: 'center'}}>
                      <Text style={{color: designColor('fff'), fontFamily: designFont('Poppins-SemiBold'), fontSize: 12, textAlign: 'center'}}>
                        Continue with available funds
                      </Text>
                    </TouchableOpacity>
                  )}
                  {fundingConsent.canAttemptWithInsufficientFunds && (
                    <TouchableOpacity onPress={attemptWithInsufficientFunds} disabled={reducingFunding || loading} style={{backgroundColor: designColor('0f172a'), padding: 10, borderRadius: 8, alignItems: 'center'}}>
                      <Text style={{color: designColor('fff'), fontFamily: designFont('Poppins-SemiBold'), fontSize: 12, textAlign: 'center'}}>
                        Review stocks and attempt buy
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={showAddFundsInstructions} disabled={reducingFunding || loading} style={{backgroundColor: designColor('fff'), padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: designColor('cbd5e1'), marginTop: 8}}>
                    <Text style={{color: designColor('334155'), fontFamily: designFont('Poppins-SemiBold'), fontSize: 12}}>{fundingConsent.canContinueWithAvailableFunds || fundingConsent.canAttemptWithInsufficientFunds ? 'Add funds instead' : 'How to add funds'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {awaitingOrderStatus && (
                <View style={styles.notecontainer}>
                  <Text style={styles.noteTitle}>Checking your order status</Text>
                  <Text style={styles.noteText}>
                    Your orders have been submitted to your broker. We are
                    confirming them now — this screen updates on its own. Please
                    do not place them again.
                  </Text>
                </View>
              )}

              {confirmOrder && !fundingConsent?.required ? (
                <TouchableOpacity
                  disabled={calculatedLoading || loading || awaitingOrderStatus}
                  onPress={() => {
                    if (!ensureRebalanceExecutable()) {
                      return;
                    }
                    // Pre-order EDIS checks
                    const hasSellOrders = stockDetails?.some(s => s.transactionType === 'SELL');
                    if (hasSellOrders) {
                      // Zerodha DDPI check (before Kite redirect or server-side)
                      // If user has completed TPIN authorization (is_authorized_for_sell), allow sell
                      // If DDPI is active (physical/ddpi status), allow sell
                      if (broker === 'Zerodha' &&
                        !isZerodhaSellAuthorized(userDetails) &&
                        setShowDdpiModal) {
                        setShowDdpiModal(true);
                        onCloseReviewTrade();
                        return;
                      }
                      // Angel One DDPI check
                      if (broker === 'Angel One' && !userDetails?.ddpi_enabled && !userDetails?.is_authorized_for_sell && setShowAngleOneTpinModel) {
                        setShowAngleOneTpinModel(true);
                        onCloseReviewTrade();
                        return;
                      }
                      // Dhan EDIS check
                      if (broker === 'Dhan' && !isDhanSellAuthorizationReady(dhanEdisStatus, stockDetails) && setShowDhanTpinModel) {
                        setShowDhanTpinModel(true);
                        onCloseReviewTrade();
                        return;
                      }
                    }

                    // Use Publisher flow for Zerodha and Fyers
                    // Use server-side API for other brokers
                    if (broker === 'Zerodha') {
                      console.log('[PlaceOrder] Using Kite Publisher for Zerodha');
                      handleZerodhaRedirect();
                    } else if (broker === 'Fyers') {
                      console.log('[PlaceOrder] Using Publisher flow for Fyers');
                      handleFyersRedirect();
                    } else {
                      console.log('[PlaceOrder] Using server-side API for', broker);
                      placeOrder();
                    }
                  }}
                  style={[
                    styles.orderButton,
                    awaitingOrderStatus && styles.buttonDisabled,
                  ]}>
                  {0 > 1 ? (
                    <View>
                      <Text>
                        Note : Orders may be rejected due to insufficient broker
                        balance of {parseFloat(funds?.availablecash).toFixed(2)}
                        .
                      </Text>
                    </View>
                  ) : null}

                  {loading || awaitingOrderStatus ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="white" />
                    </View>
                  ) : (
                    <Text style={styles.orderButtonText}>
                      {broker === 'Zerodha' ? 'Open Kite Basket' : broker === 'Fyers' ? 'Place Order via Fyers' : 'Place Order'} (₹{' '}
                      {parseFloat(totalInvestmentValue).toFixed(2)})
                    </Text>
                  )}
                </TouchableOpacity>
              ) : !fundingConsent?.required ? (
                <TouchableOpacity
                  disabled={calculatedLoading}
                  onPress={() => {
                    calculateRebalance();
                  }}
                  style={styles.orderButton}>
                  {0 > 1 ? (
                    <View>
                      <Text>
                        Note : Orders may be rejected due to insufficient broker
                        balance of {parseFloat(funds?.availablecash).toFixed(2)}
                        .
                      </Text>
                    </View>
                  ) : null}

                  {calculatedLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="white" />
                    </View>
                  ) : (
                    <Text style={styles.orderButtonText}>Confirm Details</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>
      {/* Kite Publisher Modal (Publisher SDK flow) */}
      <KitePublisherModal
        visible={showKitePublisher}
        apiKey={zerodhaApiKey}
        basketItems={publisherBasketItems}
        onClose={() => {
          setShowKitePublisher(false);
          setLoading(false);
        }}
        onSuccess={(requestToken) => {
          console.log('[ZerodhaPublisher] Publisher success, requestToken:', requestToken);
          setShowKitePublisher(false);
          setZerodhaStatus('success');
          setZerodhaRequestType('basket');
          // checkZerodhaStatus will be called via useEffect
        }}
        onError={(error) => {
          console.error('[ZerodhaPublisher] Publisher error:', error);
          setShowKitePublisher(false);
          setLoading(false);
          const errorMsg = typeof error === 'string' ? error : (error?.message || 'Order placement failed via Zerodha. Please check your Kite app.');
          const syntheticResponse = stockDetails.map(stock => ({
            symbol: stock.tradingSymbol,
            tradingSymbol: stock.tradingSymbol,
            transactionType: stock.transactionType || 'BUY',
            quantity: stock.quantity,
            orderType: stock.orderType || 'MARKET',
            exchange: stock.exchange || 'NSE',
            orderStatus: 'rejected',
            orderPlacement: 'failed',
            orderStatusMessage: errorMsg,
            message_aq: errorMsg,
          }));
          setOrderPlacementResponse(syntheticResponse);
          setOpenSucessModal(true);
          onCloseReviewTrade();
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginLeft: 40,
    // borderWidth:1,
    // flex: 1, // Center alignment
  },
  buyOrder: {
    color: 'green',
    alignSelf: 'flex-start',
  },
  quantityContainer1: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 5,
    marginHorizontal: 25,
  },

  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  buyOrder: {
    color: 'green',
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
    fontFamily: designFont('Poppins-SemiBold'),
  },
  cellText: {
    alignSelf: 'flex-start',
    color: 'black',
    fontFamily: designFont('Poppins-Regular'),
  },
  cellTextmktprice: {
    alignSelf: 'flex-end',
    color: 'black',
    fontFamily: designFont('Poppins-Regular'),
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
  quantityInputup: {
    width: 80,
    height: 35,
    padding: 2,
    alignSelf: 'center',
    marginHorizontal: 4,
    color: designColor('0d0c22'),
    fontSize: 14,
    fontFamily: designFont('Poppins-Bold'),
    textAlign: 'center',
    borderWidth: 1,
    borderColor: designColor('e9e8e8'),
    borderRadius: 7,
  },
  modalContainer: {
    backgroundColor: designColor('fff'),
    borderRadius: 10,
    height: screenHeight / 1.8,
    shadowColor: designColor('000'),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 5,
  },
  horizontal: {
    width: 110,
    height: 6,
    marginBottom: 20,
    borderRadius: 250,
    alignSelf: 'center',
    backgroundColor: designColor('f1f4f8'),
  },
  modalHeader: {
    fontSize: 18,
    marginTop: 3,
    fontWeight: 'bold',
    alignSelf: 'flex-start',
    color: 'black',
  },
  modalHeader1: {
    fontSize: 17,
    fontFamily: designFont('Poppins-Bold'),
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    color: 'black',
    marginBottom: 10,
  },
  orderButton: {
    backgroundColor: designColor('002a5c'),
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
  buttonDisabled: {
    backgroundColor: designColor('7f9cbf'),
  },
  notecontainer: {
    borderWidth: 1,
    borderColor: designColor('f9a825'),
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 10,
    marginBottom: 12,
    backgroundColor: designColor('fff'),
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
  leftContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    marginRight: 5,
    alignItems: 'flex-start',
  },
  rightContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    alignContent: 'flex-end',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: designColor('e8e8e8'),
  },
  // Surveillance Warning Styles
  surveillanceWarning: {
    marginHorizontal: 10,
    marginVertical: 8,
    padding: 12,
    backgroundColor: designColor('fef2f2'),
    borderLeftWidth: 4,
    borderLeftColor: designColor('dc2626'),
    borderRadius: 4,
  },
  surveillanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  surveillanceTitle: {
    fontSize: 14,
    fontFamily: designFont('Poppins-Bold'),
    color: designColor('dc2626'),
    marginLeft: 8,
  },
  surveillanceText: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('991b1b'),
    marginBottom: 6,
  },
  surveillanceStock: {
    fontSize: 12,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('b91c1c'),
    marginLeft: 8,
    marginBottom: 2,
  },
  surveillanceNote: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('dc2626'),
    marginTop: 6,
    fontStyle: 'italic',
  },
});

export default MPReviewTradeModal;
