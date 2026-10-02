/**
 * Opt-in durable execution for direct normal and basket orders.
 *
 * A request receipt is stored before submission. If acceptance is ambiguous,
 * recovery uses the same requestId and never falls through to another route.
 * Model portfolios, Publisher, GTT/OCO, test and manual brokers are excluded.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getTenantSubdomain} from '../utils/variantHelper';
import {getCustomerAuthHeaders} from '../utils/customerAuthHeaders';

const STORAGE_PREFIX = '@aq/durable-order/v1/';
const TERMINAL_STATES = new Set(['completed', 'failed', 'partial', 'cancelled', 'expired']);
const MANUAL_BROKERS = new Set(['dummybroker', 'no_broker', 'no broker', 'zerodha publisher']);
const enabledValue = value => ['1', 'true', 'yes', 'on'].includes(
  String(value ?? '').trim().toLowerCase(),
);

export const durableOrderExecutionEnabled = configData => {
  const remote = configData?.config?.asyncOrderExecutionV1 ??
    configData?.asyncOrderExecutionV1;
  if (remote !== undefined && remote !== null && remote !== '') {
    return enabledValue(remote);
  }
  return enabledValue(Config?.REACT_APP_ASYNC_ORDER_EXECUTION_V1);
};

export const isDurableDirectOrderEligible = payload => {
  const trades = Array.isArray(payload?.trades) ? payload.trades : [];
  const broker = String(payload?.user_broker || payload?.broker || '')
    .trim().toLowerCase();
  if (!trades.length || !broker || MANUAL_BROKERS.has(broker)) return false;
  if (payload?.testMode || payload?.publisher === true) return false;
  if (payload?.model_id || payload?.modelId || payload?.unique_id) return false;
  return trades.every(trade => {
    const orderType = String(trade?.orderType || trade?.OrderType || '')
      .trim().toUpperCase();
    return !(
      trade?.model_id || trade?.modelId || trade?.unique_id ||
      trade?.publisher === true || orderType === 'GTT' || orderType === 'OCO'
    );
  });
};

const storageKey = requestId => `${STORAGE_PREFIX}${encodeURIComponent(requestId)}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
const instructionFingerprint = payload => JSON.stringify({
  user: String(payload?.user_email || payload?.userEmail || '').trim().toLowerCase(),
  broker: String(payload?.user_broker || payload?.broker || '').trim().toLowerCase(),
  basketId: String(payload?.basketId || payload?.basket_id || '').trim(),
  trades: (payload?.trades || []).map(trade => ({
    id: String(trade?.tradeId || trade?.advice_reco_id || trade?.legId || trade?.clientTradeId || ''),
    symbol: String(trade?.tradingSymbol || trade?.Symbol || trade?.symbol || ''),
    exchange: String(trade?.exchange || trade?.Exchange || '').toUpperCase(),
    side: String(trade?.transactionType || trade?.Type || '').toUpperCase(),
    quantity: trade?.quantity ?? trade?.Quantity ?? trade?.qty,
    orderType: String(trade?.orderType || trade?.OrderType || 'MARKET').toUpperCase(),
    product: String(trade?.productType || trade?.ProductType || trade?.product || '').toUpperCase(),
    price: trade?.price ?? trade?.Price ?? null,
  })),
});

const safePendingRecord = (payload, requestId, changes = {}) => ({
  requestId,
  jobId: changes.jobId || null,
  state: changes.state || 'acceptance_unknown',
  fingerprint: instructionFingerprint(payload),
  userEmail: String(payload?.user_email || payload?.userEmail || '').trim().toLowerCase(),
  broker: String(payload?.user_broker || payload?.broker || '').trim(),
  basketId: String(payload?.basketId || payload?.basket_id || '').trim() || null,
  createdAt: changes.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const persistPending = async (payload, requestId, changes = {}) => {
  const key = storageKey(requestId);
  let previous = {};
  try {
    previous = JSON.parse((await AsyncStorage.getItem(key)) || '{}');
  } catch (_) {
    previous = {};
  }
  const record = safePendingRecord(payload, requestId, {...previous, ...changes});
  await AsyncStorage.setItem(key, JSON.stringify(record));
  return record;
};

const clearPending = requestId => AsyncStorage.removeItem(storageKey(requestId));
const authenticatedHeaders = async configData => {
  const customerHeaders = await getCustomerAuthHeaders();
  if (!customerHeaders) {
    const error = new Error('Please sign in again before placing this trade.');
    error.code = 'customer_session_required';
    throw error;
  }
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': getTenantSubdomain(configData),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
    ...customerHeaders,
  };
};

const normalizeEnvelope = (job, requestId) => {
  const state = String(job?.state || job?.executionState || 'acceptance_unknown');
  const terminal = TERMINAL_STATES.has(state);
  const result = job?.result && typeof job.result === 'object' ? job.result : {};
  const jobId = job?.job_id || job?.jobId || null;
  const rawResults = Array.isArray(result.results) ? result.results :
    (Array.isArray(job?.results) ? job.results : []);
  const reconciliationMeta = {
    directAsyncJobId: jobId,
    directAsyncRequestId: requestId,
    executionState: state,
    reconciliationRequired: !terminal,
  };
  const results = rawResults.length ? rawResults.map(row => ({
    ...row,
    ...reconciliationMeta,
    directAsyncTradeId: row?.tradeId || row?.clientTradeId || null,
  })) : (!terminal ? [{
    ...reconciliationMeta,
    orderStatus: 'PENDING_CONFIRMATION',
    orderStatusMessage: 'Broker outcome is still being verified. Do not place this order again.',
    transactionType: 'PENDING',
    quantity: 0,
    symbol: 'Order request',
  }] : []);
  return {
    ...result,
    ...job,
    results,
    requestId,
    jobId,
    executionState: state,
    state,
    accepted: state === 'acceptance_unknown' ? null : true,
    reconciliationRequired: !terminal,
    retryAllowed: false,
  };
};

export async function getDurableOrderStatus(identifier, configData) {
  const jobId = String(identifier?.jobId || '').trim();
  const requestId = String(identifier?.requestId || '').trim();
  if (!jobId && !requestId) {
    const error = new Error('jobId or requestId is required');
    error.code = 'job_identifier_required';
    throw error;
  }
  const response = await axios.post(
    `${server.server.baseUrl}api/process-trades/order-place-async-v1/status`,
    jobId ? {jobId} : {requestId},
    {headers: await authenticatedHeaders(configData), timeout: 15000},
  );
  return response.data;
}

export const createCustomerExecutionReportId = () =>
  `customer-report-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

export async function reportDurableOrderOutcome(payload, configData) {
  const reportId = String(payload?.reportId || '').trim();
  const jobId = String(payload?.jobId || '').trim();
  const requestId = String(payload?.requestId || '').trim();
  const outcome = String(payload?.reportedOutcome || '').trim();
  const filledOutcome = ['filled', 'partially_filled'].includes(outcome);
  if (!reportId || (!jobId && !requestId)) {
    const error = new Error('reportId and either jobId or requestId are required');
    error.code = 'customer_report_identity_required';
    throw error;
  }
  const report = {
    reportId,
    ...(jobId ? {jobId} : {requestId}),
    ...(String(payload?.tradeId || '').trim() ? {legId: String(payload.tradeId).trim()} : {}),
    reportedOutcome: outcome,
    ...(outcome === 'partially_filled' && payload?.reportedFilledQuantity !== undefined ?
      {reportedFilledQuantity: payload.reportedFilledQuantity} : {}),
    ...(filledOutcome && payload?.reportedAveragePrice !== undefined ?
      {reportedAveragePrice: payload.reportedAveragePrice} : {}),
    ...(String(payload?.note || '').trim() ? {note: String(payload.note).trim()} : {}),
  };
  const response = await axios.post(
    `${server.server.baseUrl}api/process-trades/order-place-async-v1/reconciliation-report`,
    report,
    {headers: await authenticatedHeaders(configData), timeout: 20000},
  );
  return response.data;
}

export async function recoverDurableOrderByRequestId(
  requestId,
  configData,
  {attempts = 4, delayMs = 750} = {},
) {
  const stableId = String(requestId || '').trim();
  if (!stableId) throw new Error('requestId is required');
  const boundedAttempts = Math.max(1, Math.min(Number(attempts) || 1, 6));
  for (let attempt = 1; attempt <= boundedAttempts; attempt += 1) {
    try {
      return await getDurableOrderStatus({requestId: stableId}, configData);
    } catch (error) {
      const retryable = !error?.response || error?.response?.status === 404 ||
        error?.response?.status >= 500;
      if (!retryable || attempt === boundedAttempts) throw error;
      await sleep(delayMs * attempt);
    }
  }
  return null;
}

async function pollDurableOrder(job, requestId, payload, configData, options) {
  const attempts = Math.max(1, Math.min(Number(options.pollAttempts) || 6, 12));
  const configuredDelay = options.delayMs === undefined ? 750 : Number(options.delayMs);
  const delayMs = Math.max(0, Number.isFinite(configuredDelay) ? configuredDelay : 750);
  let current = job;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const normalized = normalizeEnvelope(current, requestId);
    await persistPending(payload, requestId, {
      jobId: normalized.jobId,
      state: normalized.state,
    });
    if (TERMINAL_STATES.has(normalized.state)) {
      await clearPending(requestId);
      return normalized;
    }
    if (attempt === attempts) return normalized;
    await sleep(Math.min(delayMs * attempt, 4000));
    try {
      current = await getDurableOrderStatus(
        normalized.jobId ? {jobId: normalized.jobId} : {requestId},
        configData,
      );
    } catch (_) {
      // Keep the receipt: a later attempt recovers it and never resubmits.
    }
  }
  return normalizeEnvelope(current, requestId);
}

async function recoverMatchingPending(payload, configData, options) {
  const fingerprint = instructionFingerprint(payload);
  const keys = (await AsyncStorage.getAllKeys()).filter(key =>
    key.startsWith(STORAGE_PREFIX),
  );
  if (!keys.length) return null;
  const rows = await AsyncStorage.multiGet(keys);
  for (const [key, raw] of rows) {
    let record;
    try {
      record = JSON.parse(raw || '{}');
    } catch (_) {
      continue;
    }
    if (record?.fingerprint !== fingerprint || !record?.requestId) continue;
    try {
      const job = await getDurableOrderStatus(
        record.jobId ? {jobId: record.jobId} : {requestId: record.requestId},
        configData,
      );
      const normalized = normalizeEnvelope(job, record.requestId);
      if (TERMINAL_STATES.has(normalized.state)) {
        await AsyncStorage.removeItem(key);
        return normalized;
      }
      return pollDurableOrder(job, record.requestId, payload, configData, options);
    } catch (_) {
      return normalizeEnvelope({
        job_id: record.jobId,
        state: record.state || 'acceptance_unknown',
        message: 'The earlier order request is still being checked. Do not resubmit.',
      }, record.requestId);
    }
  }
  return null;
}

export async function submitDurableOrder(payload, configData, options = {}) {
  if (!durableOrderExecutionEnabled(configData)) {
    const error = new Error('Durable queued execution is disabled');
    error.code = 'async_execution_disabled';
    throw error;
  }
  if (!isDurableDirectOrderEligible(payload)) {
    const error = new Error('This order requires its dedicated execution path');
    error.code = 'async_flow_not_supported';
    throw error;
  }
  const requestId = String(payload?.requestId || '').trim();
  if (!requestId) throw new Error('requestId is required');

  const existing = await recoverMatchingPending(payload, configData, options);
  if (existing) return existing;
  await persistPending(payload, requestId);

  let accepted;
  try {
    const response = await axios.post(
      `${server.server.baseUrl}api/process-trades/order-place-async-v1`,
      payload,
      {
        headers: {...await authenticatedHeaders(configData), 'x-request-id': requestId},
        timeout: 20000,
      },
    );
    accepted = response.data;
  } catch (error) {
    const status = error?.response?.status;
    if (status && status < 500 && status !== 408) {
      await clearPending(requestId);
      throw error;
    }
    try {
      accepted = await recoverDurableOrderByRequestId(requestId, configData, {
        attempts: options.recoveryAttempts,
        delayMs: options.delayMs,
      });
    } catch (_) {
      return normalizeEnvelope({
        state: 'acceptance_unknown',
        error: 'durable_acceptance_unknown',
        message: 'Acceptance is being checked. Do not resubmit.',
      }, requestId);
    }
  }

  if (accepted?.error === 'durable_acceptance_unknown') {
    try {
      accepted = await recoverDurableOrderByRequestId(requestId, configData, {
        attempts: options.recoveryAttempts,
        delayMs: options.delayMs,
      });
    } catch (_) {
      return normalizeEnvelope(accepted, requestId);
    }
  }
  return pollDurableOrder(accepted || {}, requestId, payload, configData, options);
}
