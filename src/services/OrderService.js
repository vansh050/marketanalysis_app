/**
 * OrderService.js
 * Centralized service for order execution and management across brokers.
 * Ported from prod-alphaquark-github for feature parity.
 */
import axios from 'axios';
import Config from 'react-native-config';
import server from '../utils/serverConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {getAdvisorSubdomain} from '../utils/variantHelper';

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
  'Motilal Oswal': 'motilal',
  'Axis Securities': 'axis',
};

function getHeaders(configData) {
  return {
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain':
      configData?.config?.REACT_APP_HEADER_NAME || getAdvisorSubdomain(),
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  };
}

/**
 * Place regular orders via unified endpoint.
 */
export async function placeOrders(payload, configData) {
  const response = await axios.post(
    `${server.server.baseUrl}api/process-trades/order-place`,
    payload,
    {headers: getHeaders(configData), timeout: 120000},
  );
  return response.data;
}

/**
 * Place GTT orders via broker-specific endpoint.
 */
export async function placeGTTOrders(broker, payload, configData) {
  const brokerUrl = BROKER_URL_MAP[broker] || broker.toLowerCase();
  const response = await axios.post(
    `${server.ccxtServer.baseUrl}${brokerUrl}/process-trades`,
    payload,
    {headers: getHeaders(configData), timeout: 120000},
  );
  return response.data;
}

/**
 * Update trade recommendation status.
 */
export async function updateTradeReco(stockDetails, configData) {
  const response = await axios.put(
    `${server.server.baseUrl}api/zerodha/update-trade-reco`,
    {
      stockDetails,
      leaving_datetime: new Date().toISOString(),
    },
    {headers: getHeaders(configData)},
  );
  return response.data;
}

/**
 * Record publisher orders (Zerodha/Fyers).
 */
export async function recordPublisherOrders(broker, payload, configData) {
  const endpoint =
    broker === 'Zerodha'
      ? 'api/zerodha/publisher/record-orders'
      : 'api/fyers/publisher/record-orders';
  const response = await axios.post(
    `${server.server.baseUrl}${endpoint}`,
    payload,
    {headers: getHeaders(configData), timeout: 30000},
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
