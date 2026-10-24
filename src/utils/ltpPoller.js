/**
 * ltpPoller.js
 *
 * Shared last-traded-price feed for the older price helpers
 * (DynamicText/websocketPrice.js, DynamicText/WebsocketSubText.js,
 * ReviewZerodhaTradeModal). They used a socket.io feed on
 * `ccxt.alphaquark.in`; that service no longer exists (the host answers every
 * path with a static page), so those prices were always empty. This polls the
 * live REST endpoint `websocket.alphaquark.in/market-data/ltp` (via
 * marketDataLTP.fetchLTPBatch) for the symbols that currently have listeners.
 */
import {AppState} from 'react-native';
import {fetchLTPBatch} from './marketDataLTP';

export const POLL_INTERVAL_MS = 5000;

const listeners = new Map(); // SYMBOL -> {exchange, callbacks:Set, refs}
const lastPrices = new Map(); // SYMBOL -> price
const globalCallbacks = new Set();
let timer = null;
let appStateSub = null;

const keyOf = symbol => String(symbol || '').trim().toUpperCase();

function emit(symbol, price) {
  const entry = listeners.get(symbol);
  if (entry) entry.callbacks.forEach(cb => cb(price));
  globalCallbacks.forEach(cb => cb(symbol, price));
}

export async function pollOnce() {
  if (listeners.size === 0) return;
  const symbols = [...listeners.entries()].map(([symbol, e]) => ({symbol, exchange: e.exchange}));
  let result = {};
  try {
    result = (await fetchLTPBatch(symbols)) || {};
  } catch (_) {
    return;
  }
  Object.entries(result).forEach(([symbol, price]) => {
    const key = keyOf(symbol);
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0) return;
    if (lastPrices.get(key) === value) return;
    lastPrices.set(key, value);
    emit(key, value);
  });
}

function start() {
  if (timer) return;
  pollOnce();
  timer = setInterval(() => {
    if (AppState.currentState === 'active' || AppState.currentState == null) pollOnce();
  }, POLL_INTERVAL_MS);
  if (!appStateSub && AppState.addEventListener) {
    appStateSub = AppState.addEventListener('change', s => {
      if (s === 'active') pollOnce();
    });
  }
}

function stopIfIdle() {
  if (listeners.size > 0 || globalCallbacks.size > 0) return;
  if (timer) clearInterval(timer);
  timer = null;
  if (appStateSub && appStateSub.remove) appStateSub.remove();
  appStateSub = null;
}

/** Listen for a symbol's price. Returns an unsubscribe function (call once). */
export function subscribeLTP(symbol, exchange, callback) {
  const key = keyOf(symbol);
  if (!key) return () => {};
  let entry = listeners.get(key);
  if (!entry) {
    entry = {exchange: exchange || 'NSE', callbacks: new Set(), refs: 0};
    listeners.set(key, entry);
  }
  entry.refs += 1;
  if (callback) entry.callbacks.add(callback);
  start();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    release(key, callback);
  };
}

function release(key, callback) {
  const entry = listeners.get(key);
  if (!entry) return;
  if (callback) entry.callbacks.delete(callback);
  entry.refs -= 1;
  if (entry.refs <= 0) listeners.delete(key);
  stopIfIdle();
}

/** Keep a symbol polled without a per-symbol callback (totals, getters). */
export function watchLTP(symbol, exchange) {
  return subscribeLTP(symbol, exchange, null);
}

export function onAnyLTP(callback) {
  globalCallbacks.add(callback);
  start();
  return () => {
    globalCallbacks.delete(callback);
    stopIfIdle();
  };
}

export function getLastLTP(symbol) {
  return lastPrices.get(keyOf(symbol));
}

export function getAllLTPs() {
  return Object.fromEntries(lastPrices);
}

/** Tests only. */
export function _resetLTPPoller() {
  if (timer) clearInterval(timer);
  timer = null;
  listeners.clear();
  lastPrices.clear();
  globalCallbacks.clear();
  appStateSub = null;
}
