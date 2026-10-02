/**
 * OrderService.js
 * Centralized service for order execution and management across brokers.
 * Ported from prod-alphaquark-github for feature parity.
 */
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain, getTenantSubdomain} from '../utils/variantHelper';
import {prepareExecutionPayload} from '../utils/executionSafety';
import {getCustomerAuthHeaders} from '../utils/customerAuthHeaders';
import {
  durableOrderExecutionEnabled,
  isDurableDirectOrderEligible,
  submitDurableOrder,
} from './DurableOrderService';

const BROKER_URL_MAP = {
  Zerodha: 'zerodha/api',
  'Angel One': 'angelone',
  Upstox: 'upstox',
  'ICICI Direct': 'icici',
  Kotak: 'kotak',
  Dhan: 'dhan',
  Fyers: 'fyers',
  'IIFL Securities': 'iifl',
  AliceBlue: 'aliceblue',
  'Hdfc Securities': 'hdfc',
  Groww: 'groww',
  'DefinEdge Securities': 'definedge',
  'Motilal Oswal': 'motilal',
  'Axis Securities': 'axis',
};

const BROKER_ORDER_STATUS_SLUG_MAP = {
  'Axis Securities': 'axis',
  'Angel One': 'angelone',
  Zerodha: 'zerodha',
  Upstox: 'upstox',
  Dhan: 'dhan',
  Fyers: 'fyers',
  'ICICI Direct': 'icici',
  Kotak: 'kotak',
  AliceBlue: 'aliceblue',
  'Motilal Oswal': 'motilal-oswal',
  'HDFC Securities': 'hdfc',
  'Hdfc Securities': 'hdfc',
  'IIFL Securities': 'iifl',
  Groww: 'groww',
  'DefinEdge Securities': 'definedge',
};

/**
 * Resolve the ccxt route used by the read-only v2 single-order-status API.
 * Keep this in the shared service so result modals cannot drift from the
 * broker execution/portfolio maps (DefinEdge was missing from the modal's
 * private copy and its Refresh button silently returned).
 */
export function getBrokerOrderStatusSlug(broker) {
  return BROKER_ORDER_STATUS_SLUG_MAP[broker] || null;
}

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
 * Fetch the broker-authoritative status for one placed order.
 * The tenant header is mandatory: ccxt uses it to select the advisor DB from
 * which stored broker credentials are loaded.
 */
export async function refreshSingleOrderStatus(
  broker,
  userEmail,
  orderId,
  configData = null,
) {
  const slug = getBrokerOrderStatusSlug(broker);
  if (!slug) {
    throw new Error(`Broker ${broker || 'unknown'} does not support order-status refresh`);
  }

  const response = await axios.post(
    `${server.ccxtServer.baseUrl}${slug}/v2/single-order-status`,
    {user_email: userEmail, orderId},
    {headers: getHeaders(configData), timeout: 30000},
  );
  return response.data;
}

/**
 * Request cancellation of one recorded basket order through the durable
 * mutation boundary. A successful HTTP response is not necessarily terminal:
 * callers must keep retry blocked unless `terminal === true`.
 */
export async function cancelPendingBasketOrder({
  broker,
  userEmail,
  order,
  basketId,
  tradeId,
  mutationId,
  configData = null,
}) {
  const orderId = order?.orderId || order?.uniqueorderid;
  const resolvedTradeId = tradeId || order?.tradeId;
  if (!broker || !userEmail || !orderId || !mutationId || !basketId || !resolvedTradeId) {
    throw new Error('Broker, customer, basket ID, trade ID, order ID and mutation ID are required');
  }

  const response = await axios.post(
    `${server.ccxtServer.baseUrl}orders/mutate`,
    {
      mutationId,
      action: 'cancel',
      broker,
      user_email: userEmail,
      orderId,
      basketId,
      tradeId: resolvedTradeId,
      brokerPayload: {
        variety: 'NORMAL',
        basketId,
        symbol: order?.Symbol || order?.symbol || order?.tradingSymbol,
        tradingSymbol: order?.tradingSymbol || order?.Symbol || order?.symbol,
        exchange: order?.Exchange || order?.exchange || 'NSE',
      },
    },
    {headers: getHeaders(configData), timeout: 30000},
  );
  return response.data;
}

/**
 * Place regular orders via unified endpoint.
 *
 * Standalone orders always cross the authenticated Node boundary. Node
 * re-reads recommendation semantics, owns dedup and records broker outcomes.
 *
 * Caller-facing return shape preserved: response.data has either
 * `{results: [...]}`.
 */
export async function placeOrders(payload, configData) {
  const authoritativeUrl = `${server.server.baseUrl}api/process-trades/order-place`;
  const enrichedPayload = prepareExecutionPayload(payload);
  if (
    durableOrderExecutionEnabled(configData) &&
    isDurableDirectOrderEligible(enrichedPayload)
  ) {
    return submitDurableOrder(enrichedPayload, configData);
  }
  const customerAuthHeaders = await getCustomerAuthHeaders();
  if (!customerAuthHeaders) {
    throw new Error('Please sign in again before placing this trade.');
  }
  const response = await axios.post(authoritativeUrl, enrichedPayload, {
    headers: {
      ...getHeaders(configData),
      ...customerAuthHeaders,
      'x-request-id': enrichedPayload.requestId,
    },
    timeout: 120000,
  });
  return response.data;
}

/**
 * Place GTT orders via broker-specific endpoint.
 */
export async function placeGTTOrders(broker, payload, configData) {
  const enrichedPayload = prepareExecutionPayload(payload);
  const customerAuthHeaders = await getCustomerAuthHeaders();
  if (!customerAuthHeaders) {
    throw new Error('Please sign in again before placing this trade.');
  }
  const response = await axios.post(
    `${server.server.baseUrl}api/process-trades/gtt/process-trades`,
    enrichedPayload,
    {headers: {
      ...getHeaders(configData),
      ...customerAuthHeaders,
      'x-request-id': enrichedPayload.requestId,
    }, timeout: 120000},
  );
  return response.data;
}

/**
 * Update trade recommendation status.
 */
export async function updateTradeReco(stockDetails, configData) {
  throw new Error(
    'Client-side execution updates are disabled; the backend records broker-confirmed outcomes.',
  );
}

/**
 * Record publisher orders (Zerodha/Fyers).
 */
export async function recordPublisherOrders(broker, payload, configData) {
  const endpoint =
    broker === 'Zerodha'
      ? 'api/zerodha/publisher/record-orders'
      : 'api/fyers/publisher/record-orders';
  const customerAuthHeaders = await getCustomerAuthHeaders();
  if (!customerAuthHeaders) {
    throw new Error('Please sign in again before confirming this trade.');
  }
  const response = await axios.post(
    `${server.server.baseUrl}${endpoint}`,
    payload,
    {headers: {...getHeaders(configData), ...customerAuthHeaders}, timeout: 30000},
  );
  return response.data;
}

/**
 * Update portfolio data for a broker after order execution.
 */
export async function updatePortfolioData(broker, userEmail, configData) {
  const BROKER_ENDPOINTS = {
    'IIFL Securities': 'iifl',
    Kotak: 'kotak',
    Upstox: 'upstox',
    'ICICI Direct': 'icici',
    'Angel One': 'angelone',
    Zerodha: 'zerodha',
    Fyers: 'fyers',
    AliceBlue: 'aliceblue',
    Dhan: 'dhan',
    'Motilal Oswal': 'motilal',
    Groww: 'groww',
    'DefinEdge Securities': 'definedge',
    'Hdfc Securities': 'hdfc',
  };

  const endpoint = BROKER_ENDPOINTS[broker];
  if (!endpoint) return null;

  try {
    const response = await axios.post(
      `${server.ccxtServer.baseUrl}${endpoint}/user-portfolio`,
      {user_email: userEmail},
      {headers: getHeaders(configData)},
    );
    return response.data;
  } catch (err) {
    console.warn(`[OrderService] updatePortfolioData failed for ${broker}:`, err.message);
    return null;
  }
}

/**
 * Get user's trade recommendations.
 */
export async function getTradeRecos(userEmail, configData) {
  const response = await axios.get(
    `${server.server.baseUrl}api/user/trade-reco-for-user?user_email=${encodeURIComponent(userEmail)}`,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Fetch order book from broker.
 */
export async function fetchOrderBook(broker, credentials, configData) {
  const brokerUrl = BROKER_URL_MAP[broker] || broker.toLowerCase();
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}${brokerUrl.replace('/api', '')}/order-book`,
    credentials,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Check Angel One surveillance for symbols.
 */
export async function checkSurveillance(symbols, configData) {
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}angelone/equity/surveillance`,
    symbols,
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Get broker URL slug.
 */
export function getBrokerUrlSlug(broker) {
  return BROKER_URL_MAP[broker] || broker.toLowerCase();
}
