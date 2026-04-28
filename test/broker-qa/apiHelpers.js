/**
 * API call helpers for broker QA tests.
 * Thin wrappers around axios for ccxt and server backends.
 * Matches prod aq-api.sh helper functions.
 */
const axios = require('axios');

const CCXT_BASE = 'https://ccxtprod.alphaquark.in';
const SERVER_BASE = 'https://server.alphaquark.in';

// ── Generic request helpers ─────────────────────────────────────

async function ccxtGet(path, headers) {
  const url = `${CCXT_BASE}/${path}`;
  const res = await axios.get(url, {headers, timeout: 15000});
  return res.data;
}

async function ccxtPost(path, body, headers) {
  const url = `${CCXT_BASE}/${path}`;
  const res = await axios.post(url, body, {headers, timeout: 15000});
  return res.data;
}

async function serverGet(path, headers) {
  const url = `${SERVER_BASE}/${path}`;
  const res = await axios.get(url, {headers, timeout: 15000});
  return res.data;
}

async function serverPost(path, body, headers) {
  const url = `${SERVER_BASE}/${path}`;
  const res = await axios.post(url, body, {headers, timeout: 15000});
  return res.data;
}

// ── Domain-specific helpers (match prod aq-api.sh) ──────────────

async function getUserDetails(email, headers) {
  return serverGet(`api/user/getUser/${encodeURIComponent(email)}`, headers);
}

async function getUserPortfolio(email, model, headers, broker) {
  let path = `rebalance/user-portfolio/latest/${encodeURIComponent(email)}/${encodeURIComponent(model)}`;
  if (broker) path += `?broker=${encodeURIComponent(broker)}`;
  return ccxtGet(path, headers);
}

async function getOrderBook(broker, credentials, headers) {
  return ccxtPost(`${broker}/order-book`, credentials, headers);
}

async function getFunds(broker, credentials, headers) {
  return ccxtPost(`${broker}/funds`, credentials, headers);
}

async function getHoldings(broker, credentials, headers) {
  return ccxtPost(`${broker}/user-portfolio`, credentials, headers);
}

async function placeOrder(broker, orderPayload, headers) {
  return ccxtPost(`${broker}/place-order`, orderPayload, headers);
}

module.exports = {
  ccxtGet,
  ccxtPost,
  serverGet,
  serverPost,
  getUserDetails,
  getUserPortfolio,
  getOrderBook,
  getFunds,
  getHoldings,
  placeOrder,
};
