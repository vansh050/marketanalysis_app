/**
 * ExecutionStatusScreen — Step 3 of rebalance flow.
 * Shows order preview with "Place Order" button (manual trigger, matching web master).
 * Handles Zerodha/Fyers WebView basket, DummyBroker, and normal broker execution.
 *
 * Route params:
 *   portfolio, userEmail, broker, brokerCredentials, orders[], modelId,
 *   modelName, advisor, uniqueId, caPendingInfo[]
 */
import React, { useCallback, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import { generateToken } from '../../utils/SecurityTokenManager';
import {getTenantSubdomain} from '../../utils/variantHelper';
import useModalStore from '../../GlobalUIModals/modalStore';
import eventEmitter from '../../components/EventEmitter';
import useSdkClient from '../../sdk/useSdkClient';
import {canAttemptRebalancePlacement} from '../../utils/rebalanceMarketGate';
import {useComponent} from '../../design/useDesign';
import {planRefusalMessage} from '../../utils/planRefusalMessage';

const isSdkExecuteAdviceEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_EXECUTE_ADVICE || '').trim().toLowerCase();
  return v === 'true' || v === '1';
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Advisor-Subdomain': getTenantSubdomain(),
  'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
});

// Market hours check (9:15 AM – 3:30 PM IST, Mon–Fri)
const isMarketOpen = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 555 && mins <= 930;
};

const ExecutionStatusScreen = () => {
  const Presentation = useComponent('screens.ExecutionStatusScreen');
  const navigation = useNavigation();
  const route = useRoute();
  const {
    portfolio, userEmail, broker, brokerCredentials,
    orders, modelId, modelName, advisor, uniqueId, caPendingInfo,
    planId, planVersion, planHash,
  } = route.params || {};

  const showAlert = useModalStore((state) => state.showAlert);
  const sdkClient = useSdkClient();
  const sdkExecuteAdviceEnabled = isSdkExecuteAdviceEnabled() && !!sdkClient;

  // States: confirm, executing, done, error
  const [state, setState] = useState('confirm');
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [requiresGuardedPublisher, setRequiresGuardedPublisher] = useState(false);
  // Frozen-plan 409 (PLAN_DRIFTED / expired / ALREADY_CONSUMED — see
  // REBALANCE_PLAN_FREEZE_PLAN.md §4.4): the plan_id we hold is dead, so a
  // plain "Retry" would just resubmit the same stale plan_id and 409 again.
  // When true, the error CTA routes back to RebalanceReviewScreen for a
  // fresh calculate instead of offering Retry.
  const [needsRecompute, setNeedsRecompute] = useState(false);
  const executing = state === 'executing';
  const executionInFlightRef = useRef(false);

  const isDummyBroker = broker === 'DummyBroker' || !broker;
  const marketGateOpen = canAttemptRebalancePlacement({
    broker,
    marketOpen: isMarketOpen(),
  });

  // ── Execute orders ──
  const executeOrders = useCallback(async () => {
    if (executionInFlightRef.current) return;
    executionInFlightRef.current = true;
    setState('executing');
    setResults([]);
    setErrorMsg(null);
    setNeedsRecompute(false);
    setRequiresGuardedPublisher(false);

    try {
      const hasSell = (orders || []).some(
        order => String(order?.transactionType || '').toUpperCase() === 'SELL',
      );
      const hasBuy = (orders || []).some(
        order => String(order?.transactionType || '').toUpperCase() === 'BUY',
      );
      if (broker === 'Zerodha' && hasSell && hasBuy) {
        setRequiresGuardedPublisher(true);
        setErrorMsg(
          'This Zerodha rebalance contains both sells and buys. Go back to the model portfolio and use its Rebalance action so buys remain locked until Zerodha confirms every sell fill and refreshes available margin.',
        );
        setState('error');
        return;
      }

      const sellsFirst = [...(orders || [])].sort((a, b) => {
        const rank = o => (String(o.transactionType || 'BUY').toUpperCase() === 'SELL' ? 0 : 1);
        return rank(a) - rank(b);
      });
      const trades = sellsFirst.map((o) => ({
        tradingSymbol: o.symbol || o.tradingSymbol,
        transactionType: o.transactionType || 'BUY',
        exchange: o.exchange || 'NSE',
        quantity: o.quantity,
        price: o.price,
        settledQuantity: o.settledQuantity,
        t1Quantity: o.t1Quantity,
        sameDayCredit: o.sameDayCredit,
      }));

      // Phase 1 plan freeze (docs/REBALANCE_PLAN_FREEZE_PLAN.md §4.4/§4.5):
      // forward the frozen plan_id/plan_version RebalanceReviewScreen's
      // calculate minted so ccxt executes the server-frozen, re-validated
      // plan instead of these client-built `trades`. We still send `trades`
      // (backend ignores them on the frozen path) so nothing breaks if the
      // backend flag is off / plan missing. Flag off / no planId ⇒ fields
      // absent ⇒ byte-identical legacy payload.
      const frozenPlanFields = planId
        ? { plan_id: planId, plan_version: planVersion, plan_hash: planHash }
        : {};

      const body = {
        user_broker: broker || 'DummyBroker',
        user_email: userEmail,
        trades,
        model_id: modelId,
        modelName,
        advisor,
        unique_id: uniqueId,
        caPendingInfo: caPendingInfo || [],
        ...frozenPlanFields,
      };

      // Add broker credentials
      if (brokerCredentials && !isDummyBroker) {
        if (brokerCredentials.jwtToken) body.accessToken = brokerCredentials.jwtToken;
        if (brokerCredentials.apiKey) body.apiKey = brokerCredentials.apiKey;
        if (brokerCredentials.secretKey) body.secretKey = brokerCredentials.secretKey;
        if (brokerCredentials.clientCode) body.clientCode = brokerCredentials.clientCode;
      }

      // SDK executeAdvice dual-path (Phase C). When the flag is on and SDK
      // client is available, route through the SDK orchestrator. Legacy
      // direct-ccxt path stays below as fallback.
      let resp;
      if (sdkExecuteAdviceEnabled) {
        try {
          const sdkResult = await sdkClient.executeAdvice({
            kind: 'mpRebalance',
            clientAdviceId: `mp-rebalance:${broker || 'DummyBroker'}:${planId || uniqueId || modelId}`,
            brokerName: broker || 'DummyBroker',
            modelId,
            modelName,
            uniqueId,
            planId,
            planVersion,
            planHash,
            trades,
          });
          const mappedRows = (sdkResult?.rows || []).map(row => ({
            ...row,
            orderStatus: row.status,
            tradingSymbol: row.symbol,
          }));
          resp = { data: { results: mappedRows } };
          console.log('[ExecutionStatusScreen] SDK executeAdvice result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
        } catch (sdkErr) {
          console.error('[ExecutionStatusScreen] SDK owns this attempt; legacy fallback blocked:', sdkErr?.message);
          throw sdkErr;
        }
      }
      if (!resp) {
        resp = await axios.post(
          `${server.ccxtServer.baseUrl}rebalance/process-trade`,
          body,
          { headers: getHeaders(), timeout: 30000 },
        );
      }

      const data = resp.data?.data || resp.data;
      const orderResults = data?.results || data?.response || data?.order_results || [];

      const parsed = Array.isArray(orderResults)
        ? orderResults.map((r) => ({
            symbol: r.symbol || r.tradingSymbol || '',
            transactionType: r.transactionType || '',
            quantity: r.quantity || 0,
            status: normalizeStatus(r.orderStatus || r.status || ''),
            message: r.message || r.error || '',
            orderId: r.orderId || '',
          }))
        : [];

      // Update subscriber execution status
      const successCount = parsed.filter((r) => r.status === 'success').length;
      const execStatus = successCount === parsed.length ? 'executed' :
                         successCount > 0 ? 'partial' : 'toExecute';

      await axios.put(
        `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
        { userEmail, modelName, model_id: modelId, executionStatus: execStatus, user_broker: broker || 'DummyBroker' },
        { headers: getHeaders(), timeout: 15000 },
      ).catch((e) => console.warn('[Execution] update status failed:', e.message));

      // Enroll in status check queue
      await axios.post(
        `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
        { userEmail, modelName, advisor, broker: broker || 'DummyBroker' },
        { headers: getHeaders(), timeout: 10000 },
      ).catch(() => {});

      // Emit refresh event
      eventEmitter.emit('refreshEvent', { source: 'rebalance-execution' });

      setResults(parsed);
      setState('done');
    } catch (e) {
      console.error('[Execution] error:', e);
      if (e?.response?.status === 409 && e?.response?.data?.recompute) {
        setNeedsRecompute(true);
        const refusal = planRefusalMessage(e.response.data.code, broker, e.response.data.message);
        setErrorMsg(`${refusal.title}. ${refusal.message}`);
      } else {
        setErrorMsg(e.response?.data?.message || e.message || 'Order placement failed');
      }
      setState('error');
    } finally {
      executionInFlightRef.current = false;
    }
  }, [orders, userEmail, broker, brokerCredentials, modelId, modelName, advisor, uniqueId, caPendingInfo, isDummyBroker, sdkExecuteAdviceEnabled, sdkClient, planId, planVersion, planHash]);

  // Frozen-plan recompute recovery: tell RebalanceReviewScreen (still mounted
  // underneath in the stack) to re-run calculateRebalance, then pop back to it.
  const handleRecomputeNavigate = () => {
    eventEmitter.emit('rebalancePlanRecompute');
    navigation.goBack();
  };

  const normalizeStatus = (raw) => {
    const s = (raw || '').toLowerCase();
    if (['success', 'complete', 'completed', 'traded', 'executed', 'filled'].includes(s)) return 'success';
    if (['rejected', 'failed', 'cancelled', 'expired'].includes(s)) return 'failed';
    return 'pending';
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  return (
    <Presentation
      viewModel={{
        state,
        executing,
        results,
        orders,
        errorMsg,
        requiresGuardedPublisher,
        needsRecompute,
        marketGateOpen,
        successCount,
        failedCount,
      }}
      actions={{
        onBack: () => { if (!executing) navigation.goBack(); },
        onPlaceOrder: executeOrders,
        onDone: () => navigation.popToTop(),
        onRecompute: handleRecomputeNavigate,
        onRetry: executeOrders,
      }}
    />
  );
};

export default ExecutionStatusScreen;
