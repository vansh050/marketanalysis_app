/**
 * brokerPublisher.js
 *
 * Broker Publisher SDK utilities for React Native.
 * Adapted from prod-alphaquark-github web app.
 *
 * In React Native, the publisher SDK is loaded inside a WebView
 * (see KitePublisherModal). These utilities handle the data
 * preparation layer outside the WebView.
 */

import server from './serverConfig';
import {generateToken} from './SecurityTokenManager';
import RNConfig from 'react-native-config';

// Fyers is intentionally NOT here. Fyers ships a Publisher SDK
// (api-connect-docs.fyers.in/fyers-lib.js), but on mobile we never
// invoked it — `RebalanceModal.handleFyersRedirect`,
// `UserStrategySubscribeModal.handleFyersRedirect`, and
// `MPReviewTradeModal.handleFyersRedirect` all post directly to
// ccxt-india's `${ccxtServer}rebalance/process-trade` (the same
// REST path ICICI / HDFC / Motilal use). This was de-facto the
// case before — but the registry stub was confusing.
//
// The tidi_new Flutter app explicitly retired its Fyers Publisher
// WebView path (commit `a063887`, 2026-04-25) after reproducing
// "Awaiting Confirmation forever" caused by `loadHtmlString`
// having no real origin → Fyers SDK domain validation silently
// failing. RN's WebView with `baseUrl` set has a similar risk
// surface, so don't reintroduce a Fyers Publisher path without
// also documenting why the origin check would pass on RN.
export const PUBLISHER_SUPPORTED_BROKERS = ['Zerodha'];

/**
 * Check that every stock has a non-empty exchange before building a basket.
 * Kite Publisher silently drops basket items with invalid symbol/exchange
 * combinations (e.g. sending a BSE-only symbol to NSE), so we must reject
 * the whole basket early with a clear user-facing list of offending symbols
 * instead of letting the broker silently no-op them.
 *
 * Returns { valid, missing } — missing is an array of trading symbols whose
 * exchange field is empty/whitespace/missing.
 */
export function validateStockExchanges(stockDetails) {
  const missing = [];
  for (const stock of stockDetails || []) {
    const exch = stock && stock.exchange ? String(stock.exchange).trim() : '';
    if (!exch) {
      missing.push(stock?.tradingSymbol || stock?.symbol || '(unknown)');
    }
  }
  return {valid: missing.length === 0, missing};
}

export const BROKER_PUBLISHER_CONFIG = {
  Zerodha: {
    scriptUrl: 'https://kite.trade/publisher.js?v=3',
    globalVar: 'KiteConnect',
    maxBasketSize: 60,
    appName: 'Kite',
  },
  // Fyers entry removed 2026-04-26 — see PUBLISHER_SUPPORTED_BROKERS comment.
};

/**
 * Check if a broker supports publisher SDK flow.
 */
export function isPublisherSupported(broker) {
  return PUBLISHER_SUPPORTED_BROKERS.includes(broker);
}

/**
 * Get publisher API key for a broker.
 */
export function getPublisherApiKey(broker, userBrokerClientCode) {
  if (broker === 'Zerodha') {
    return RNConfig.REACT_APP_ZERODHA_API_KEY || '';
  }
  // Fyers branch removed 2026-04-26 — Fyers is REST-only on mobile.
  return '';
}

/**
 * WebView `baseUrl` for Zerodha publisher-basket submissions. Kite rejects
 * POSTs to kite.zerodha.com/connect/basket with a generic
 * `Invalid 'api_key'` when the Referer doesn't match the Kite Connect
 * app's registered redirect-URL origin. React Native's `source={{ html }}`
 * defaults the Referer to `about:blank`, which trips that check — the web
 * app doesn't hit this because the form is served from the manager's own
 * domain. Setting `baseUrl` to the manager's web origin puts the WebView
 * on the origin Kite expects.
 *
 * Intentionally NOT sourced from `REACT_APP_BROKER_CONNECT_REDIRECT_URL`.
 * That var was repurposed for Groww's Android App Links flow
 * (commit f9f5d0f, 2026-04) and now points at `app-links.alphaquark.in`
 * for advisors that opted in — which is NOT a Kite-registered origin.
 * The Kite publisher origin and the OAuth callback origin are semantically
 * independent; conflating them means every Groww-side change risks
 * breaking Zerodha orders. Derive from `customDomain` / subdomain instead.
 *
 * Priority:
 *   1. `configData.customDomain` (custom advisor domain, if set)
 *   2. `https://{subdomain}.alphaquark.in` (canonical advisor web origin)
 *   3. `https://prod.alphaquark.in` (last-resort fallback)
 */
export function getPublisherWebViewBaseUrl(configData) {
  const custom = configData?.customDomain;
  if (typeof custom === 'string' && custom) {
    const withScheme = /^https?:\/\//i.test(custom) ? custom : `https://${custom}`;
    const match = withScheme.match(/^https?:\/\/[^/]+/);
    if (match) return match[0];
  }
  const subdomain =
    configData?.subdomain ||
    configData?.config?.REACT_APP_HEADER_NAME;
  if (subdomain) return `https://${subdomain}.alphaquark.in`;
  return 'https://prod.alphaquark.in';
}

/**
 * Get user-facing broker app name.
 */
export function getBrokerAppName(broker) {
  return BROKER_PUBLISHER_CONFIG[broker]?.appName || broker;
}

/**
 * Convert Angel-One-style trading symbols (e.g. `VIKASECO-EQ`) to the
 * canonical Kite/Zerodha `{zerodha_symbol, exchange}` pair via
 * ccxt-india's scripmaster endpoint `POST /zerodha/convert-symbol`.
 *
 * This is the single source of truth for BE-series / BSE-only / EQ-stripping
 * decisions — never replicate the mapping in JS. Returns a map keyed by the
 * original `angelone_symbol` so callers can do
 * `symbolMap[stock.tradingSymbol]` directly.
 *
 * Response also carries `ltp` (Redis-cached server-side) so the publisher
 * MARKET→LIMIT conversion has a reference price even for symbols outside
 * the user's live WebSocket subscription (VIKASECO-EQ is a repeat offender
 * because -EQ subscribes to NSE but the stock is BSE-primary → no live LTP).
 *
 * @param {string[]} symbols - trading symbols from advice (may include `-EQ`).
 * @returns {Promise<Record<string, {zerodha_symbol:string, exchange:string, lot_size:number, ltp:number|null}>>}
 */
export async function convertSymbolsToZerodha(symbols) {
  const unique = [...new Set((symbols || []).filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const aqToken = generateToken(
      RNConfig.REACT_APP_AQ_KEYS,
      RNConfig.REACT_APP_AQ_SECRET,
    );
    const response = await fetch(
      `${server.ccxtServer.baseUrl}zerodha/convert-symbol`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'aq-encrypted-key': aqToken,
          'X-Advisor-Subdomain':
            RNConfig.REACT_APP_HEADER_NAME || RNConfig.REACT_APP_URL || '',
        },
        body: JSON.stringify({symbols: unique}),
      },
    );
    if (!response.ok) {
      console.warn(
        '[brokerPublisher] /zerodha/convert-symbol',
        response.status,
      );
      return {};
    }
    const data = await response.json();
    const map = {};
    (data?.results || []).forEach(r => {
      if (r.success && r.angelone_symbol && r.zerodha_symbol) {
        map[r.angelone_symbol] = {
          zerodha_symbol: r.zerodha_symbol,
          exchange: r.exchange,
          lot_size: r.lot_size,
          ltp: typeof r.ltp === 'number' ? r.ltp : null,
        };
      }
    });
    return map;
  } catch (err) {
    console.warn(
      '[brokerPublisher] convertSymbolsToZerodha failed:',
      err?.message,
    );
    return {};
  }
}

/**
 * Resolve a stock's advice-side `{tradingSymbol, exchange}` to the Kite basket
 * `{tradingsymbol, exchange, cachedLtp}` using a scripmaster-sourced
 * `symbolMap` from `convertSymbolsToZerodha`. Falls through to advice-side
 * values when the map has no entry for this symbol (advice is trusted).
 *
 * Publisher basket builders and `useWebSocketCurrentPrice` callers should
 * both go through this helper so the symbol/exchange sent to Kite matches
 * the LTP the UI subscribed to — otherwise `applyKiteMarketProtection` falls
 * through to plain MARKET and Kite rejects GSM/T2T/BE stocks.
 */
export function resolveZerodhaSymbol(stock, symbolMap) {
  const adviceSymbol =
    stock?.tradingSymbol || stock?.symbol || stock?.Trading_Symbol || '';
  const info = (symbolMap && adviceSymbol && symbolMap[adviceSymbol]) || null;
  let tradingsymbol = info?.zerodha_symbol || adviceSymbol;
  if (typeof tradingsymbol === 'string' && tradingsymbol.endsWith('-EQ')) {
    // Kite uses the base symbol for NSE equity (no -EQ suffix). Matches
    // convertToBasketItem() which also strips -EQ below.
    tradingsymbol = tradingsymbol.replace(/-EQ$/, '');
  }
  const exchange = info?.exchange || stock?.exchange || '';
  return {
    tradingsymbol,
    exchange,
    cachedLtp: info?.ltp ?? null,
  };
}

/**
 * Create order batches based on broker's max basket size.
 */
export function createBatches(stockDetails, broker) {
  const config = BROKER_PUBLISHER_CONFIG[broker];
  if (!config) return [stockDetails];

  const maxSize = config.maxBasketSize;
  const batches = [];
  for (let i = 0; i < stockDetails.length; i += maxSize) {
    batches.push(stockDetails.slice(i, i + maxSize));
  }
  return batches;
}

/**
 * Separate GTT orders from regular orders.
 * Publisher SDKs don't support GTT, so these must go through regular API.
 */
export function separateGttOrders(stockDetails) {
  const gtt = stockDetails.filter(s => s.gttCheck === true);
  const regular = stockDetails.filter(s => !s.gttCheck);
  return {regular, gtt};
}

/**
 * Map order type to Kite SDK format.
 */
function mapKiteOrderType(orderType) {
  if (!orderType) return 'MARKET';
  const upper = orderType.toUpperCase();
  if (upper === 'MARKET') return 'MARKET';
  if (upper === 'LIMIT') return 'LIMIT';
  if (upper === 'SL' || upper === 'SL_M' || upper === 'STOP') return 'SL';
  return 'MARKET';
}

/**
 * Map product type to Kite SDK format.
 *
 * B-28 (2026-05-18 web → 2026-05-19 mobile migration): F&O legs
 * (exchange NFO/BFO) MUST use NRML for overnight positions or MIS for
 * intraday — Kite hard-rejects CNC on F&O. Pre-B-28 this mapper
 * defaulted F&O CARRYFORWARD basket entries to "CNC" because it didn't
 * know about exchange context; result was Kite silently rejecting every
 * F&O basket leg with "Invalid product type for exchange".
 *
 * The exchange parameter is optional for back-compat — callers that
 * don't pass it (existing equity flows) get the legacy mapping; the
 * derivatives basket caller passes exchange so we branch correctly.
 */
function mapKiteProductType(productType, exchange) {
  const isFnO =
    typeof exchange === 'string' &&
    (exchange.toUpperCase() === 'NFO' || exchange.toUpperCase() === 'BFO');
  if (!productType) return isFnO ? 'NRML' : 'CNC';
  const upper = productType.toUpperCase();
  if (isFnO) {
    // F&O segment — Kite only accepts NRML / MIS here.
    if (upper === 'INTRADAY' || upper === 'MIS') return 'MIS';
    // CARRYFORWARD / DELIVERY / NRML / MARGIN all → NRML overnight.
    return 'NRML';
  }
  if (upper === 'DELIVERY' || upper === 'CNC') return 'CNC';
  if (upper === 'INTRADAY' || upper === 'MIS') return 'MIS';
  if (upper === 'BO') return 'BO';
  if (upper === 'CO') return 'CO';
  return 'CNC';
}

/**
 * Round a price to the nearest valid LIMIT tick.
 *
 * B-35a (2026-05-19 mobile migration): 3-band safety schedule per Pratik,
 * strictly coarser than the actual NSE/NFO exchange tick (0.05 for most
 * scrips), trading a tiny amount of price precision for guaranteed
 * tick-validity across every broker's quirks:
 *
 *   price ≤ ₹1000           → tick ₹0.10
 *   ₹1000 < price ≤ ₹4000   → tick ₹0.50
 *   price > ₹4000           → tick ₹1.00
 *
 * Pre-B-35a used 0.10/0.20/0.50 buckets which could produce LIMIT prices
 * that weren't multiples of the real 0.05 exchange tick — e.g. 1200.40
 * (multiple of 0.20 but not 0.05) could be rejected on a scrip whose
 * exchange tick is 0.05. The B-35a schedule is strictly safer: all snap
 * values are multiples of 0.05 so they remain valid on any scrip on the
 * real 0.05 tick.
 *
 * Without this snap, `applyKiteMarketProtection` produces e.g.
 * `1.45 * 1.015 = 1.47175` and Kite responds with "invalid price" for the
 * basket item (and silently drops it in some cases). Call this on the
 * limit price only — the LTP itself is reported verbatim.
 *
 * Rounding is to the NEAREST tick (not floor/ceil), then we normalize to
 * 2 decimals to avoid float drift artifacts (0.30000000001).
 *
 * BUY callers can use Math.ceil(price/tick)*tick (snap UP); SELL callers
 * Math.floor(price/tick)*tick (snap DOWN) if directional snap matters.
 * The default here is nearest-tick — appropriate for applyKiteMarketProtection
 * which already applies a 1.0% (equity) or 1.5% (derivative) buffer.
 */
export function roundToKiteTick(price) {
  if (!Number.isFinite(price) || price <= 0) return price;
  let tick;
  if (price > 4000) tick = 1.0;
  else if (price > 1000) tick = 0.5;
  else tick = 0.10;
  const rounded = Math.round(price / tick) * tick;
  // Normalize to 2 decimals; all three ticks have at most 1 decimal so
  // this drops float-drift trailing digits without losing precision.
  return Math.round(rounded * 100) / 100;
}

/**
 * Convert a stock to Kite/Fyers basket item format.
 */
/**
 * Apply MARKET→LIMIT-IOC conversion with a 1% market-protection buffer to a
 * Kite basket order. Returns a new order dict with order_type / price / validity
 * updated when conditions are met; returns the input unchanged otherwise.
 *
 * Use this after building the baseOrder in any caller that posts to
 * https://kite.zerodha.com/connect/basket. Mirrors the web frontend fix
 * and the ICICI/AliceBlue patterns on the Python side.
 *
 *   const baseOrder = { tradingsymbol, exchange, order_type: 'MARKET', ... };
 *   return applyKiteMarketProtection(baseOrder, ltp, stock.transactionType);
 */
export function applyKiteMarketProtection(baseOrder, ltp, transactionType) {
  if (!baseOrder || baseOrder.order_type !== 'MARKET') return baseOrder;
  const ltpNumeric = parseFloat(ltp) || 0;
  if (ltpNumeric <= 0) return baseOrder;
  const isBuy = (transactionType || baseOrder.transaction_type || 'BUY').toUpperCase() === 'BUY';

  // B-35 (2026-05-19 mobile migration): buffer policy is exchange-aware:
  //   • Equity (NSE/BSE):     1.0% (mobile retained legacy 1% — web is tiered 0.3/0.5/1.0)
  //   • Derivative (NFO/BFO): 1.5% (uniform — matches the proven AliceBlue policy)
  // Wider derivative buffer because option premiums have wider bid-ask
  // spreads (especially near-the-money strikes at open/close), and a 1%
  // buffer was unreliable for fills.
  const exchangeUpper = (baseOrder.exchange || '').toUpperCase();
  const isDerivative = exchangeUpper === 'NFO' || exchangeUpper === 'BFO';
  const bufferPct = isDerivative ? 0.015 : 0.01;

  const rawBuffered = isBuy
    ? ltpNumeric * (1 + bufferPct)
    : ltpNumeric * (1 - bufferPct);
  // Snap to the nearest valid tick for this price bucket. Required —
  // Kite rejects LIMIT orders whose price isn't on a valid increment.
  const limitPrice = roundToKiteTick(rawBuffered);
  // Validity: IOC on NSE/NFO, DAY on BSE/BFO (BSE+BFO reject LIMIT+IOC).
  const validity = (exchangeUpper === 'BSE' || exchangeUpper === 'BFO') ? 'DAY' : 'IOC';
  console.log(
    `[ZerodhaPublisher] MARKET→LIMIT for ${baseOrder.tradingsymbol}: ltp=${ltpNumeric} ` +
      `${isBuy ? 'BUY' : 'SELL'} ` +
      `${isDerivative ? 'derivative buffer 1.5%' : 'equity buffer 1.0%'} ` +
      `limit=${limitPrice} validity=${validity}`
  );
  return { ...baseOrder, order_type: 'LIMIT', price: limitPrice, validity };
}

export function convertToBasketItem(broker, stock, symbolMap) {
  if (broker === 'Zerodha') {
    const symbolInfo = symbolMap?.[stock.tradingSymbol] || {};
    // Prefer API-returned exchange over stock.exchange — handles BSE-primary
    // stocks mislabeled as NSE in tradeReco (e.g. VIKASECO).
    const exchange = symbolInfo.exchange || stock.exchange;
    // Strip -EQ suffix if present for Zerodha symbol
    let tradingsymbol = symbolInfo.zerodha_symbol || stock.tradingSymbol;
    if (tradingsymbol.endsWith('-EQ')) {
      tradingsymbol = tradingsymbol.replace(/-EQ$/, '');
    }

    // MARKET -> LIMIT with market-protection buffer (IOC on NSE/NFO,
    // DAY on BSE/BFO).
    //
    // B-35 (2026-05-19 mobile migration): exchange-aware buffer policy:
    //   • Equity (NSE/BSE):     1.0% (mobile retained legacy)
    //   • Derivative (NFO/BFO): 1.5% (uniform — matches AliceBlue policy)
    // B-35a tick-safe snap via roundToKiteTick (was raw Math.round to 2dp)
    // so the LIMIT price is always a valid multiple of the exchange tick.
    //
    // Mirrors ICICI / AliceBlue / web (commits c85d6ea4 + aafe1830 +
    // b7f7ccd0 on ccxt-india feature/4.0_broker). Falls through to plain
    // MARKET when no LTP is available.
    const exchangeUpper = (exchange || '').toUpperCase();
    const isDerivative = exchangeUpper === 'NFO' || exchangeUpper === 'BFO';
    const MARKET_PROTECTION_BUFFER_PCT = isDerivative ? 0.015 : 0.01;
    let orderType = mapKiteOrderType(stock.orderType);
    let price = stock.price || 0;
    let validity = null;
    const ltp = parseFloat(
      stock.ltp || stock.lastPrice || stock.currentPrice || stock.last_price || 0
    );
    if (orderType === 'MARKET' && ltp > 0) {
      const isBuy = (stock.transactionType || 'BUY').toUpperCase() === 'BUY';
      const rawBuffered = isBuy
        ? ltp * (1 + MARKET_PROTECTION_BUFFER_PCT)
        : ltp * (1 - MARKET_PROTECTION_BUFFER_PCT);
      // Snap to the tick-safe schedule (0.10/0.50/1.00 — see roundToKiteTick).
      const limitPrice = roundToKiteTick(rawBuffered);
      orderType = 'LIMIT';
      price = limitPrice;
      validity = (exchangeUpper === 'BSE' || exchangeUpper === 'BFO') ? 'DAY' : 'IOC';
      console.log(
        `[BrokerPublisher] MARKET→LIMIT for ${tradingsymbol}: ltp=${ltp} ` +
          `${isBuy ? 'BUY' : 'SELL'} ` +
          `${isDerivative ? 'derivative 1.5%' : 'equity 1.0%'} ` +
          `limit=${limitPrice} validity=${validity}`
      );
    }

    const item = {
      tradingsymbol,
      // No silent default — callers must validate via validateStockExchanges()
      // before building the basket. Kite silently drops items with the wrong
      // exchange, which has caused live orders (e.g. BSE-only ADARSHPL) to
      // vanish without an error.
      exchange,
      transaction_type: stock.transactionType,
      quantity: stock.quantity,
      order_type: orderType,
      // B-28: pass exchange so F&O (NFO/BFO) maps CARRYFORWARD → NRML
      // instead of CNC. Equity (NSE/BSE) is unchanged.
      product: mapKiteProductType(stock.productType, exchange),
      price,
      trigger_price: stock.triggerPrice || 0,
      variety: 'regular',
      readonly: false,
      tag: stock.zerodhaTradeId || stock.tradeId || '',
    };
    if (validity) item.validity = validity;
    return item;
  }

  // Fyers basket-item branch removed 2026-04-26 — Fyers is REST-only
  // on mobile. See PUBLISHER_SUPPORTED_BROKERS comment for context.

  return stock;
}

/**
 * Get the endpoint for recording publisher-placed orders.
 */
export function getPublisherRecordEndpoint(broker, baseUrl) {
  const base = baseUrl || server.server.baseUrl;
  if (broker === 'Zerodha') {
    return `${base}api/zerodha/publisher/record-orders`;
  }
  // Fyers branch removed 2026-04-26 — Fyers REST path through
  // /rebalance/process-trade records its own results server-side.
  return `${base}api/publisher/record-orders`;
}

/**
 * Map publisher callback order statuses to normalized statuses.
 */
export const SUCCESS_ORDER_MAPPING = {
  success: 'COMPLETE',
  COMPLETE: 'COMPLETE',
  TRADED: 'COMPLETE',
  FILLED: 'COMPLETE',
  failed: 'REJECTED',
  REJECTED: 'REJECTED',
  cancelled: 'CANCELLED',
  CANCELLED: 'CANCELLED',
};

/**
 * Poll constants for publisher fallback.
 */
export const PUBLISHER_POLL_CONFIG = {
  POLL_INTERVAL_MS: 5000,
  POLL_TIMEOUT_MS: 90000,
};
