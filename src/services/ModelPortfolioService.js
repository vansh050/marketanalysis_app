/**
 * ModelPortfolioService.js
 * Centralized service for model portfolio backend operations.
 * Ported from prod-alphaquark-github for feature parity.
 */
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../utils/variantHelper';

function getHeaders(configData) {
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };
}

/**
 * Get subscribed strategies for a user.
 */
export async function getSubscribedStrategies(userEmail, configData) {
  const response = await axios.get(
    `${server.server.baseUrl}api/model-portfolio/subscribed-strategies/${userEmail}`,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Get strategy details by name.
 */
export async function getStrategyDetails(strategyName, configData) {
  const response = await axios.get(
    `${server.server.baseUrl}api/model-portfolio/portfolios/strategy/${encodeURIComponent(strategyName)}`,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Subscribe to a strategy.
 */
export async function subscribeStrategy(strategyId, email, configData) {
  const response = await axios.put(
    `${server.server.baseUrl}api/model-portfolio/subscribe-strategy/${strategyId}`,
    {email, action: 'subscribe'},
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Get subscription amount data.
 */
export async function getSubscriptionAmount(userEmail, modelName, userBroker, configData) {
  const params = new URLSearchParams({email: userEmail, modelName});
  if (userBroker) params.append('user_broker', userBroker);
  const response = await axios.get(
    `${server.server.baseUrl}api/model-portfolio-db-update/subscription-raw-amount?${params}`,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Update model portfolio DB after execution.
 */
export async function updateModelPortfolioDB(payload, configData) {
  const response = await axios.post(
    `${server.server.baseUrl}api/model-portfolio-db-update`,
    payload,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Get latest user portfolio for a model.
 */
export async function getLatestUserPortfolio(userEmail, modelName, configData) {
  const response = await axios.get(
    `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(modelName)}`,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Calculate rebalance.
 */
export async function calculateRebalance(payload, configData) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/calculate`,
    payload,
    {headers: getHeaders(configData), timeout: 120000},
  );
  return response.data;
}

const isSdkExecuteAdviceEnabled = () => {
  const v = String(Config?.REACT_APP_USE_SDK_EXECUTE_ADVICE || '').trim().toLowerCase();
  return v === 'true' || v === '1';
};

/**
 * Process rebalance trade.
 *
 * Phase C SDK path: when sdkClient is passed (third arg) and the
 * REACT_APP_USE_SDK_EXECUTE_ADVICE flag is on, routes through
 * sdkClient.executeAdvice({ kind: 'mpRebalance' }). Falls back to
 * Never falls through to legacy after SDK placement starts: a timeout may
 * mean the broker accepted the order and a second path could duplicate it.
 * Service file — can't use hooks, so callers must pass useSdkClient() result.
 */
export async function processRebalanceTrade(payload, configData, sdkClient) {
  // SDK executeAdvice dual-path (Phase C).
  if (isSdkExecuteAdviceEnabled() && sdkClient) {
    try {
      const clientAdviceId = String(
        payload.attempt_id ||
        payload.requestId ||
        payload.plan_id ||
        payload.unique_id ||
        `${payload.model_id}:${payload.modelName}`
      );
      const sdkResult = await sdkClient.executeAdvice({
        kind: 'mpRebalance',
        clientAdviceId,
        brokerName: payload.user_broker,
        modelId: payload.model_id,
        modelName: payload.modelName,
        uniqueId: payload.unique_id,
        planId: payload.plan_id,
        planVersion: payload.plan_version,
        planHash: payload.plan_hash,
        trades: payload.trades || [],
      });
      const placementResults = (sdkResult?.rows || []).map(row => ({
        ...row,
        orderStatus: row.status,
        tradingSymbol: row.symbol,
      }));
      console.log('[ModelPortfolioService] SDK executeAdvice result:', sdkResult?.status, sdkResult?.rows?.length, 'rows');
      return {
        results: placementResults,
        executionState: sdkResult?.executionState || 'complete',
        // `notSent` = the server refused before any order reached the
        // broker (MARKET_CLOSED, expired session, drifted plan). Nothing is
        // in flight, so it is not a reconciliation and IS safe to retry.
        reconciliationRequired:
          sdkResult?.executionState === 'paused' && sdkResult?.notSent !== true,
        retryAllowed:
          sdkResult?.executionState !== 'paused' || sdkResult?.notSent === true,
        notSent: sdkResult?.notSent === true,
        code: sdkResult?.code,
        message: sdkResult?.notSent === true ? sdkResult?.recovery?.message : undefined,
        recovery: sdkResult?.recovery,
      };
    } catch (sdkErr) {
      console.error('[ModelPortfolioService] SDK executeAdvice failed; legacy fallback blocked:', sdkErr?.message);
      throw sdkErr;
    }
  }

  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/process-trade`,
    payload,
    {headers: getHeaders(configData), timeout: 120000},
  );
  return response.data;
}

/**
 * Update subscriber execution status.
 */
export async function updateSubscriberExecution(payload, configData) {
  const response = await axios.put(
    `${server.ccxtServer.baseUrl}rebalance/update/subscriber-execution`,
    payload,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Record publisher results.
 */
export async function recordPublisherResults(payload, configData) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/record-publisher-results`,
    payload,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Enroll in status check queue.
 */
export async function addToStatusCheckQueue(payload, configData) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/add-user/status-check-queue`,
    payload,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Get rebalance repair data.
 */
export async function getRebalanceRepair(modelNames, advisor, userEmail, userBroker, configData) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/get-repair`,
    {modelName: modelNames, advisor, userEmail, userBroker},
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Insert user doc for new subscription.
 */
export async function insertUserDoc(payload, configData) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/insert-user-doc`,
    payload,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Read the customer's current investment base for a model (same preview
 * the Modify Investment screen uses).
 */
export async function getInvestmentPreview(payload, configData) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/investment-preview`,
    payload,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Record a `fund_pending` capital instruction (Phase 2, 2026-09-20): the
 * customer agreed to add exactly the recorded allocation gap. Refreshing
 * Repair mints those same frozen legs linked to the new funding authority; a
 * pre-instruction Repair plan must be refreshed. A later Calculate is only a
 * buy-only fallback for a still-unresolved gap.
 */
export async function recordFundPendingInstruction(
  {userEmail, userBroker, modelName, modelId, advisor, gapAmount},
  configData,
) {
  const {fundPendingEntry} = require('../utils/fundPendingGap');
  const preview = await getInvestmentPreview(
    {userEmail, userBroker, modelName, advisor, model_id: modelId || ''},
    configData,
  );
  const entry = fundPendingEntry({preview, gapAmount, dateTime: new Date().toISOString()});
  const data = await insertUserDoc(
    {userEmail, model: modelName, advisor, model_id: modelId, userBroker, subscriptionAmountRaw: [entry]},
    configData,
  );
  if (data?.status === 1 || data?.status === 2 || data?.success === false) {
    throw new Error(data?.message || 'The funding instruction was not saved.');
  }
  return entry;
}

/**
 * Change broker for model portfolio.
 */
export async function changeBrokerModelPF(userEmail, userBroker, configData) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/change_broker_model_pf`,
    {user_email: userEmail, user_broker: userBroker},
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Start server-owned reconciliation after a successful broker connection.
 * This is a non-blocking latency optimization; Calculate has its own
 * synchronous admission barrier and remains safe if this beacon fails.
 */
export async function startAccountReconciliation(
  userEmail,
  userBroker,
  configData,
  trigger = 'app_broker_connected',
) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}rebalance/reconcile-account`,
    {
      userEmail,
      userBroker,
      trigger,
    },
    {headers: getHeaders(configData), timeout: 10000},
  );
  return response.data;
}

/**
 * Update latest user portfolio.
 */
export async function updateLatestUserPortfolio(payload, configData) {
  const response = await axios.put(
    `${server.ccxtServer.baseUrl}rebalance/update/user-portfolio/latest`,
    payload,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Get available brokers for a model.
 */
export async function getAvailableBrokers(userEmail, modelName, configData) {
  const response = await axios.get(
    `${server.server.baseUrl}api/model-portfolio-db-update/available-brokers?email=${encodeURIComponent(userEmail)}&modelName=${encodeURIComponent(modelName)}`,
    {headers: getHeaders(configData)},
  );
  return response.data;
}
