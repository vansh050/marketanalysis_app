import {availableFundsOptions, availableFundsPayload, getFundingReview, insufficientFundsAttemptOptions} from '../../utils/fundingContinuation';
/**
 * RebalanceReviewScreen — Step 2 of rebalance flow.
 * Shows preference selection, calculates rebalance, displays buy/sell orders,
 * runs EDIS pre-check, then navigates to ExecutionStatusScreen.
 *
 * Route params:
 *   portfolio: { modelName, advisor, id, rebalanceHistory, ... }
 *   userEmail: string
 *   broker: string
 *   brokerCredentials: { jwtToken, apiKey, secretKey, clientCode, ... }
 *   heldSymbols: string[] (from CurrentHoldingsScreen)
 */
import React, { useCallback, useEffect, useState } from 'react';
import {Alert} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import LowFundsRebalanceWarning from '../../components/LowFundsRebalanceWarning';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getTenantSubdomain} from '../../utils/variantHelper';
import {
  buildBrokerPayloadFields,
  isRebalanceErrorResponse,
  isSubscriptionAmountError,
  isLowAllowedBalanceError,
  isBrokerAuthError,
  checkPortfolioShortfall,
} from '../../utils/rebalanceHelpers';
import useModalStore from '../../GlobalUIModals/modalStore';
import eventEmitter from '../../components/EventEmitter';
import {getCanonicalRebalanceTrades, getRebalanceContract} from '../../utils/rebalanceContract';
import {useComponent} from '../../design/useDesign';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getTenantSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

const RebalanceReviewScreen = () => {
  const Presentation = useComponent('screens.RebalanceReviewScreen');
  const navigation = useNavigation();
  const route = useRoute();
  const { portfolio, userEmail, broker, brokerCredentials } = route.params || {};
  const showAlert = useModalStore((state) => state.showAlert);

  const modelName = portfolio?.modelName || portfolio?.model_name;
  const advisor = portfolio?.advisor;
  const modelId = portfolio?.id || portfolio?.model_id ||
    (portfolio?.rebalanceHistory?.length > 0 ? portfolio.rebalanceHistory[portfolio.rebalanceHistory.length - 1].model_Id : '');

  // ── State ──
  // Calculator mode is advisor-owned; customers no longer choose between a
  // 2% threshold and full rebalance. Preserve the established default payload.
  const [rebalanceFlag] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buyOrders, setBuyOrders] = useState([]);
  const [sellOrders, setSellOrders] = useState([]);
  const [uniqueId, setUniqueId] = useState(null);
  const [caPendingInfo, setCaPendingInfo] = useState([]);
  // Rebalance plan freeze (docs/REBALANCE_PLAN_FREEZE_PLAN.md §4.2/§4.4):
  // additive fields on the calculate response. Forwarded on Accept
  // (ExecutionStatusScreen) only when rebalanceFreezePlan is on.
  const [planId, setPlanId] = useState(null);
  const [planVersion, setPlanVersion] = useState(null);
  const [planHash, setPlanHash] = useState(null);
  const [customerAction, setCustomerAction] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [alreadyAligned, setAlreadyAligned] = useState(false);
  const [funding, setFunding] = useState({});
  const [reducingFunding, setReducingFunding] = useState(false);

  const rebalanceContract = getRebalanceContract(funding);
  const fundingConsent = getFundingReview(rebalanceContract, funding);

  const isDummyBroker = broker === 'DummyBroker' || !broker;

  // ── Calculate rebalance ──
  const calculateRebalance = useCallback(async (flag, options = {}) => {
    setLoading(true);
    setTermsAccepted(false);
    setErrorMsg(null);
    setBuyOrders([]);
    setSellOrders([]);
    setAlreadyAligned(false);

    try {
      const body = {
        userEmail,
        modelName,
        advisor,
        model_id: modelId,
        userBroker: broker || 'DummyBroker',
        userFund: '0',
        flag,
        ...(options?.forceRefresh ? {forceRefresh: true} : {}),
        ...availableFundsPayload(options),
      };

      // Add broker-specific credentials
      if (brokerCredentials && broker && broker !== 'DummyBroker') {
        const brokerFields = buildBrokerPayloadFields(
          broker, brokerCredentials, null, Config.REACT_APP_ANGEL_ONE_API_KEY,
        );
        Object.assign(body, brokerFields);
      }

      const resp = await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/calculate`,
        body,
        { headers: getHeaders(), timeout: 30000 },
      );

      const data = resp.data?.data || resp.data;

      // Broker session expired — surface a reconnect prompt instead of
      // silently rendering a trade list that can't be placed (DefinEdge
      // 2026-08-14: rebalance returned no error but placed nothing).
      if (data?.sessionExpired === true) {
        setErrorMsg('Broker session expired. Please reconnect your broker and try again.');
        setLoading(false);
        return;
      }

      const decision = getRebalanceContract(data);
      setCustomerAction(decision?.customerAction || null);
      if (decision?.customerAction?.blocking && !decision?.fundingConsent?.required) {
        setErrorMsg(decision.presentation?.message || data?.message || decision.presentation?.title);
        setLoading(false);
        return;
      }

      // Portfolio shortfall — INFORMATIONAL ONLY, never a blocker.
      // Backend tags shortfall responses with status === 1, which would
      // otherwise be intercepted by `isRebalanceErrorResponse` below. Detect
      // and short-circuit the error path here so trades (or the
      // "already aligned" state with 0 trades) render normally.
      // See ccxt-india/rebalancing/rebalancing.py:1826 for backend rationale.
      const shortfall = checkPortfolioShortfall(data);
      if (shortfall?.isShortfall) {
        Alert.alert(
          'Market Value Below Locked Investment',
          `Your portfolio is worth ₹${shortfall.currentValue?.toLocaleString?.() || shortfall.currentValue}, below the ₹${shortfall.requiredAmount?.toLocaleString?.() || shortfall.requiredAmount} you locked in for this model. This is informational only — your share counts still match the model and rebalance proceeds normally.`,
        );
        // Do NOT return — fall through to render trades / already-aligned UI.
      } else if (isRebalanceErrorResponse(data)) {
        // Genuine error path (only when no shortfall is signalled)
        const msg = data?.message || 'Calculation failed';
        if (isBrokerAuthError(msg)) {
          setErrorMsg('Broker session expired. Please reconnect.');
        } else if (isSubscriptionAmountError(msg)) {
          setErrorMsg('Subscription amount not set. Please update your investment amount.');
        } else if (isLowAllowedBalanceError(msg)) {
          setErrorMsg('Investment amount is below the minimum required.');
        } else {
          setErrorMsg(msg);
        }
        setLoading(false);
        return;
      }

      const {buy, sell} = getCanonicalRebalanceTrades(data);

      // Calculate already verified and netted sells against live holdings.
      // Keeping its rows avoids silently dropping EQ/BE series migrations.
      const filteredSell = sell;

      if (buy.length === 0 && filteredSell.length === 0 && !decision?.fundingConsent?.required) {
        setAlreadyAligned(true);
      }

      setBuyOrders(buy);
      setSellOrders(filteredSell);
      setUniqueId(data?.uniqueId || data?.unique_id);
      setCaPendingInfo(data?.caPendingInfo || []);
      // Additive plan-freeze fields (absent when the backend flag is off).
      setPlanId(decision?.plan?.id || data?.plan_id || null);
      setPlanVersion(decision?.plan?.version || data?.plan_version || null);
      setPlanHash(decision?.plan?.hash || null);
      setFunding(data || {});
    } catch (e) {
      setErrorMsg(e.response?.data?.message || e.message || 'Failed to calculate rebalance');
    }
    setLoading(false);
  }, [userEmail, modelName, advisor, modelId, broker, brokerCredentials]);

  // ── Auto-calculate when preference selected ──
  useEffect(() => {
    if (rebalanceFlag !== null) {
      calculateRebalance(rebalanceFlag);
    }
  }, [rebalanceFlag, calculateRebalance]);

  const retryAfterAddingFunds = () =>
    calculateRebalance(rebalanceFlag, {forceRefresh: true});

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

  const continueWithAvailableFunds = async () => {
    if (reducingFunding) return;
    try {
      setReducingFunding(true);
      await calculateRebalance(rebalanceFlag, availableFundsOptions());
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
      await calculateRebalance(rebalanceFlag, insufficientFundsAttemptOptions());
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

  // ── Frozen-plan 409 recovery (docs/REBALANCE_PLAN_FREEZE_PLAN.md §4.4) ──
  // ExecutionStatusScreen emits this before navigating back when
  // process-trade 409s with `recompute:true` — the plan_id it held is dead
  // (drifted/expired/consumed). Re-run calculate to mint a fresh plan,
  // mirroring web's "Continue re-runs calculateRebalance" recovery.
  useEffect(() => {
    const onRecompute = () => {
      if (rebalanceFlag !== null) {
        calculateRebalance(rebalanceFlag);
      }
    };
    eventEmitter.on('rebalancePlanRecompute', onRecompute);
    return () => eventEmitter.removeListener('rebalancePlanRecompute', onRecompute);
  }, [rebalanceFlag, calculateRebalance]);

  // ── Execute: navigate to ExecutionStatusScreen ──
  const handleExecute = () => {
    if (fundingConsent?.required) {
      showFundingDecision();
      return;
    }
    if (customerAction && customerAction.code !== 'EXECUTE') {
      Alert.alert('Rebalance needs attention', customerAction.label);
      return;
    }
    const orders = [
      ...sellOrders.map((o) => ({
        ...o, transactionType: 'SELL',
        symbol: o.symbol || o.tradingSymbol,
      })),
      ...buyOrders.map((o) => ({
        ...o, transactionType: 'BUY',
        symbol: o.symbol || o.tradingSymbol,
      })),
    ];

    navigation.navigate('ExecutionStatus', {
      portfolio,
      userEmail,
      broker,
      brokerCredentials,
      orders,
      modelId,
      modelName,
      advisor,
      uniqueId,
      caPendingInfo,
      planId,
      planVersion,
      planHash,
    });
  };

  // ── Mark as already aligned ──
  const handleAlreadyAligned = async () => {
    try {
      await axios.put(
        `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
        { userEmail, modelName, model_id: modelId, executionStatus: 'executed', user_broker: broker || 'DummyBroker' },
        { headers: getHeaders(), timeout: 15000 },
      );
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        { userEmail, modelName, advisor, broker: broker || 'DummyBroker' },
        { headers: getHeaders(), timeout: 10000 },
      ).catch(() => {});
      showAlert('success', 'Already Aligned', 'Your portfolio is already aligned with the model.');
      navigation.goBack();
    } catch (e) {
      showAlert('error', 'Error', 'Failed to update status.');
    }
  };

  return (
    <Presentation
      viewModel={{
        loading,
        errorMsg,
        alreadyAligned,
        buyOrders,
        sellOrders,
        funding,
        fundingConsent,
        reducingFunding,
        termsAccepted,
        isDummyBroker,
      }}
      actions={{
        onRetry: () => calculateRebalance(rebalanceFlag),
        onBack: () => navigation.goBack(),
        onConfirmAligned: handleAlreadyAligned,
        onContinueAvailableFunds: continueWithAvailableFunds,
        onAttemptInsufficientFunds: attemptWithInsufficientFunds,
        onShowAddFunds: showAddFundsInstructions,
        onToggleTerms: () => setTermsAccepted(value => !value),
        onExecute: handleExecute,
      }}
      slots={{LowFundsWarning: LowFundsRebalanceWarning}}
    />
  );
};

export default RebalanceReviewScreen;
