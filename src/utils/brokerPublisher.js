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
import axios from 'axios';
import {generateToken} from './SecurityTokenManager';
import RNConfig from 'react-native-config';
import {getAccountEmailAsync} from './accountEmail';
import {getAdvisorSubdomain, getTenantSubdomain} from './variantHelper';
import {Alert} from 'react-native';

const warnBeforeKiteReview = warnings => {
  const details = warnings.slice(0, 3).join('\n');
  const remaining = warnings.length > 3 ? `\nAnd ${warnings.length - 3} more instruments.` : '';
  Alert.alert('Review prices and liquidity in Kite', `${details}${remaining}\nThe basket will open for your review.`);
};

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
 *   1. runtime `customDomain` (top-level or nested advisor config)
 *   2. the first production origin in the build's `REACT_APP_DOMAIN`
 *   3. `https://{subdomain}.alphaquark.in` (canonical advisor web origin)
 *   4. `https://prod.alphaquark.in` (last-resort fallback)
 *
 * `REACT_APP_DOMAIN` is the advisor web-origin allow-list, not the shared
 * broker redirect variable. This distinction matters for Markup: Kite is
 * registered against `research.markup.club`, while the advisor subdomain is
 * `markup`; falling straight through to `markup.alphaquark.in` makes Kite
 * reject the publisher form before an order is created.
 */
export function getPublisherWebViewBaseUrl(configData) {
  const custom =
    configData?.customDomain ||
    configData?.config?.customDomain;
  if (typeof custom === 'string' && custom) {
    const withScheme = /^https?:\/\//i.test(custom) ? custom : `https://${custom}`;
    const match = withScheme.match(/^https?:\/\/[^/]+/);
    if (match) return match[0];
  }

  const buildDomains = String(RNConfig.REACT_APP_DOMAIN || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  for (const domain of buildDomains) {
    try {
      const parsed = new URL(
        /^https?:\/\//i.test(domain) ? domain : `https://${domain}`,
      );
      if (
        parsed.protocol === 'https:' &&
        parsed.hostname &&
        parsed.hostname !== 'localhost'
      ) {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed entries and continue to the canonical subdomain.
    }
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
  // A SELL must go to the exchange the demat holding is tagged with, which
  // the calculator already resolved from the broker snapshot onto the leg.
  // Kite validates a CNC sell against that exchange's holding: on
  // 2026-09-18 the scripmaster mapped VIKASECO-EQ to NSE (its -EQ series),
  // the customer's 82 shares were held as BSE, and Kite rejected the NSE sell
  // with "Holding quantity: 0". BUYs keep the scripmaster's preferred
  // listing — that mapping is what makes Kite accept BE / BSE-only scrips.
  const side = String(
    stock?.transactionType || stock?.type || stock?.side || '',
  ).toUpperCase();
  const heldExchange = String(stock?.exchange || '').trim();
  const exchange =
    side === 'SELL' && heldExchange
      ? heldExchange
      : info?.exchange || stock?.exchange || '';
  return {
    tradingsymbol,
    exchange,
    cachedLtp: info?.ltp ?? null,
  };
}

/**
 * Attach the price snapshot used by the Kite basket to Publisher intent legs.
 *
 * MARKET orders intentionally remain MARKET here; `price` is only the
 * valuation/reference price used by the post-sell affordability refit and by
 * durable continuation recovery. The final Kite item is still converted to a
 * protected LIMIT by `convertToBasketItem`.
 */
export function enrichPublisherLegPrices(
  stockDetails,
  freshPrices = {},
  symbolMap = {},
) {
  return (stockDetails || []).map(stock => {
    const resolved = resolveZerodhaSymbol(stock, symbolMap);
    const resolvedSymbol = String(resolved.tradingsymbol || '').toUpperCase();
    const freshPrice = Number(freshPrices?.[resolvedSymbol]);
    const fallbackPrice = [
      stock?.referencePrice,
      stock?.ltp,
      stock?.rebalancePrice,
      stock?.frozenPrice,
      stock?.price,
      resolved.cachedLtp,
    ]
      .map(Number)
      .find(value => Number.isFinite(value) && value > 0);
    const referencePrice =
      Number.isFinite(freshPrice) && freshPrice > 0
        ? freshPrice
        : fallbackPrice;

    if (!referencePrice) return stock;
    const isMarket = mapKiteOrderType(stock?.orderType) === 'MARKET';
    const submittedPrice = Number(stock?.price);
    return {
      ...stock,
      price:
        isMarket || !Number.isFinite(submittedPrice) || submittedPrice <= 0
          ? referencePrice
          : submittedPrice,
      referencePrice,
      ltp: referencePrice,
    };
  });
}

/**
 * Create order batches based on broker's max basket size.
 *
 * Two-phase publisher (mirrors prod-alphaquark-github/src/utils/brokerPublisher.js
 * §Fix C, 2026-06-24 dgopujkar/MFCC): when `separateSellsFromBuys` is set,
 * SELL legs are batched into their own Kite basket(s) BEFORE the BUY legs,
 * and a batch never mixes the two. The customer approves the sell basket
 * first, so its proceeds can settle as margin before the buy basket is
 * placed — otherwise a rebalance that sells and buys in the SAME basket
 * bounces every buy on "insufficient funds" (sell proceeds aren't usable
 * as margin in the same instant). Sells-first also matches the sequencing
 * for API brokers (buys_sell_all_brokers.py: sells → confirm → buys). Any
 * buy that still bounces (settlement not instant) is fully recoverable via
 * the repair completeness pass. SCOPED via the flag — FNO multi-leg baskets
 * (where leg order is intentional) must NOT be reordered, so they pass false.
 */
export function createBatches(stockDetails, broker, separateSellsFromBuys = false) {
  const config = BROKER_PUBLISHER_CONFIG[broker];
  if (!config) return [stockDetails];

  const maxSize = config.maxBasketSize;
  const sliceInto = (items) => {
    const out = [];
    for (let i = 0; i < items.length; i += maxSize) {
      out.push(items.slice(i, i + maxSize));
    }
    return out;
  };

  if (separateSellsFromBuys) {
    const isSell = (s) =>
      (s.transactionType || s.orderType || s.transaction_type || '').toUpperCase() === 'SELL';
    const sells = stockDetails.filter(isSell);
    const buys = stockDetails.filter((s) => !isSell(s));
    return [...sliceInto(sells), ...sliceInto(buys)];
  }

  return sliceInto(stockDetails);
}

/**
 * Model-portfolio Zerodha invariant: a mixed rebalance must expose every SELL
 * batch before any BUY batch.  Keep this assertion at the mobile boundary as
 * well as inside createBatches so a future mapper/refactor cannot silently
 * regress to the legacy one-window flow (prod/testaccount, 2026-09-04: BUY
 * placed while four unauthorized SELL legs never reached Kite).
 */
export function createModelPortfolioPublisherBatches(stockDetails, broker = 'Zerodha') {
  const rows = Array.isArray(stockDetails) ? stockDetails : [];
  const batches = createBatches(rows, broker, true);
  const sideOf = row => String(
    row?.transactionType || row?.transaction_type || row?.orderType || '',
  ).toUpperCase();
  const hasSell = rows.some(row => sideOf(row) === 'SELL');
  const hasBuy = rows.some(row => sideOf(row) === 'BUY');

  if (hasSell && hasBuy) {
    let buySeen = false;
    for (const batch of batches) {
      const sides = new Set((batch || []).map(sideOf));
      if (sides.size !== 1 || (!sides.has('SELL') && !sides.has('BUY'))) {
        throw new Error('Unsafe Zerodha rebalance batch: BUY and SELL legs were mixed.');
      }
      if (sides.has('BUY')) buySeen = true;
      if (sides.has('SELL') && buySeen) {
        throw new Error('Unsafe Zerodha rebalance batch: SELL must be placed before BUY.');
      }
    }
    if (!batches.length || sideOf(batches[0]?.[0]) !== 'SELL') {
      throw new Error('Unsafe Zerodha rebalance batch: the first basket is not SELL.');
    }
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
 *   price < ₹250            → tick ₹0.01
 *   ₹250 ≤ price ≤ ₹1000    → tick ₹0.05
 *   ₹1000 < price ≤ ₹5000   → tick ₹0.10
 *   ₹5000 < price ≤ ₹10000  → tick ₹0.50
 *   ₹10000 < price ≤ ₹20000 → tick ₹1.00
 *   price > ₹20000          → tick ₹5.00
 *
 * This is the conservative NSE price-band fallback used by the web publisher.
 * It includes the ₹5 increment above ₹20,000 that the earlier mobile
 * 0.10/0.50/1.00 fallback omitted.
 *
 * Without this snap, `applyKiteMarketProtection` produces e.g.
 * `1.45 * 1.015 = 1.47175` and Kite responds with "invalid price" for the
 * basket item (and silently drops it in some cases). Call this on the
 * limit price only — the LTP itself is reported verbatim.
 *
 * Rounding defaults to the NEAREST tick, then we normalize to
 * 2 decimals to avoid float drift artifacts (0.30000000001).
 *
 * BUY callers can use Math.ceil(price/tick)*tick (snap UP); SELL callers
 * Math.floor(price/tick)*tick (snap DOWN) if directional snap matters.
 * The default here is nearest-tick — appropriate for applyKiteMarketProtection
 * which already applies a 1.0% (equity) or 1.5% (derivative) buffer.
 */
export function roundToKiteTick(price, mode = 'nearest') {
  if (!Number.isFinite(price) || price <= 0) return price;
  let tick;
  if (price > 20000) tick = 5.0;
  else if (price > 10000) tick = 1.0;
  else if (price > 5000) tick = 0.5;
  else if (price > 1000) tick = 0.1;
  else if (price >= 250) tick = 0.05;
  else tick = 0.01;
  let rounded;
  if (mode === 'ceil') rounded = Math.ceil(price / tick) * tick;
  else if (mode === 'floor') rounded = Math.floor(price / tick) * tick;
  else rounded = Math.round(price / tick) * tick;
  // Normalize to 2 decimals; all three ticks have at most 1 decimal so
  // this drops float-drift trailing digits without losing precision.
  return Math.round(rounded * 100) / 100;
}

/**
 * Circuit bands from the last `publisher-safe-quotes` call, keyed
 * `EXCHANGE:SYMBOL`.
 *
 * Held here rather than threaded through `overrides` because the fetch and the
 * conversion happen back-to-back in the same flow at seven call sites; routing
 * the band through every one of them would be a far larger change than the
 * defect warrants. Entries are replaced on every fetch and ignored once stale,
 * so a band can never outlive the basket it was read for.
 */
const _circuitBands = new Map();
const CIRCUIT_BAND_TTL_MS = 5 * 60 * 1000;

function rememberCircuitBands(bands) {
  _circuitBands.clear();
  if (!bands || typeof bands !== 'object') return;
  const at = Date.now();
  Object.keys(bands).forEach(instrument => {
    const band = bands[instrument];
    if (!band || typeof band !== 'object') return;
    const lower = Number(band.lower);
    const upper = Number(band.upper);
    _circuitBands.set(String(instrument).toUpperCase(), {
      lower: Number.isFinite(lower) && lower > 0 ? lower : null,
      upper: Number.isFinite(upper) && upper > 0 ? upper : null,
      at,
    });
  });
}

/** The remembered band for one instrument, or null when absent or stale. */
export function getCircuitBand(exchange, symbol) {
  if (!exchange || !symbol) return null;
  const entry = _circuitBands.get(`${exchange}:${symbol}`.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.at > CIRCUIT_BAND_TTL_MS) return null;
  if (entry.lower == null && entry.upper == null) return null;
  return {lower: entry.lower, upper: entry.upper};
}

/** Test seam. */
export function __setCircuitBandsForTest(bands) {
  rememberCircuitBands(bands);
}

/**
 * Hold a protective LIMIT inside the instrument's circuit band.
 *
 * The buffer moves the price in our favour so a MARKET-intent leg still fills;
 * the clamp keeps it inside the range the exchange will accept. Without the
 * clamp a scrip sitting AT its circuit is refused outright and places nothing:
 * 2026-09-18, tidi/prikc1333, BSE TAPARIA ltp 14.03 == upper circuit 14.03,
 * protected to 14.18, and Kite replied "Your order price is higher than the
 * current upper circuit limit of 14.03" — no order id, no rejection, and no
 * reason the customer could see.
 *
 * After clamping we round AWAY from the breach (a BUY pinned to the upper
 * circuit rounds DOWN to the tick) so tick rounding cannot push the price back
 * over the edge it was just clamped to. A band narrower than one tick falls
 * back to the edge itself. No band ⇒ the price is returned untouched, which is
 * exactly the behaviour before this change.
 */
export function clampToCircuitBand(price, isBuy, band) {
  if (!Number.isFinite(price) || price <= 0 || !band) return price;
  const upper = Number.isFinite(band.upper) && band.upper > 0 ? band.upper : null;
  const lower = Number.isFinite(band.lower) && band.lower > 0 ? band.lower : null;
  let out = price;
  if (upper != null && out > upper) out = roundToKiteTick(upper, 'floor');
  if (lower != null && out < lower) out = roundToKiteTick(lower, 'ceil');
  if (upper != null && out > upper) out = upper;
  if (lower != null && out < lower) out = lower;
  return out;
}

/** Batch Kite quote lookup for advisory last price and opposite-side depth. */
export async function fetchFreshKiteProtectionPrices(
  stockDetails,
  symbolMap = {},
) {
  const marketLegs = (stockDetails || [])
    .filter(stock => mapKiteOrderType(stock?.orderType) === 'MARKET')
    .map(stock => {
      const resolved = resolveZerodhaSymbol(stock, symbolMap);
      const resolvedSymbol = String(resolved.tradingsymbol || '').toUpperCase();
      return {
        symbol: resolvedSymbol,
        exchange: resolved.exchange,
        side: String(stock?.transactionType || stock?.transaction_type || stock?.side || 'BUY').toUpperCase(),
      };
    })
    .filter(leg => leg.symbol && leg.exchange);

  // Drop anything remembered from an earlier basket before we start. Every
  // early return below then leaves the registry empty, so a failed or skipped
  // quote can never clamp a later price with stale data.
  _circuitBands.clear();

  if (marketLegs.length === 0) return {};

  const userEmail = await getAccountEmailAsync();
  if (!userEmail) {
    warnBeforeKiteReview(['Zerodha prices and depth could not be checked.']);
    return {};
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  let response;
  try {
    response = await fetch(`${server.ccxtServer.baseUrl}zerodha/publisher-safe-quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': getTenantSubdomain(),
        'aq-encrypted-key': generateToken(
          RNConfig.REACT_APP_AQ_KEYS,
          RNConfig.REACT_APP_AQ_SECRET,
        ),
      },
      body: JSON.stringify({
        userEmail,
        orders: marketLegs.map(leg => ({
          symbol: leg.symbol,
          exchange: leg.exchange,
          transactionType: leg.side,
        })),
      }),
      signal: controller.signal,
    });
  } catch (_) {
    warnBeforeKiteReview(['Zerodha prices and depth could not be checked.']);
    return {};
  } finally {
    clearTimeout(timeout);
  }
  let payload;
  try { payload = await response.json(); } catch (_) { payload = null; }
  if (!response.ok || payload?.status !== 0) {
    warnBeforeKiteReview(['Zerodha prices and depth could not be checked.']);
    return {};
  }
  const fetchedPrices = payload.prices || {};
  // Circuit limits, so the protective LIMIT can be clamped into a range the
  // exchange will accept. Additive on the server side, so an older backend
  // simply yields no band and the buffer behaves exactly as before.
  rememberCircuitBands(payload.bands);
  const freshPrices = {};
  const warnings = (payload.warnings || []).map(item => `${item.symbol}: ${item.reason}`);
  marketLegs.forEach(leg => {
    const price = Number(fetchedPrices?.[`${leg.exchange}:${leg.symbol}`]);
    if (price > 0) {
      freshPrices[leg.symbol] = price;
    } else {
      if (!warnings.some(warning => warning.startsWith(`${leg.exchange}:${leg.symbol}:`))) {
        warnings.push(`${leg.symbol}: last price unavailable`);
      }
    }
  });

  if (warnings.length > 0) {
    warnBeforeKiteReview(warnings);
  }

  return freshPrices;
}

/**
 * Convert a stock to Kite/Fyers basket item format.
 */
/**
 * Apply MARKET→LIMIT-DAY conversion with a 1% market-protection buffer to a
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
  // Keep BUY limits above and SELL limits below the reference price. Nearest
  // rounding can cross to the wrong side for low-priced shares (for example,
  // VIKASECO at ₹1.11 used to become a non-marketable BUY at ₹1.10).
  const limitPrice = roundToKiteTick(
    rawBuffered,
    isBuy ? 'ceil' : 'floor',
  );
  // Kite Publisher does not reliably accept LIMIT+CNC+IOC basket legs. The
  // production web flow uses DAY for every exchange; keep mobile identical.
  const validity = 'DAY';
  console.log(
    `[ZerodhaPublisher] MARKET→LIMIT for ${baseOrder.tradingsymbol}: ltp=${ltpNumeric} ` +
      `${isBuy ? 'BUY' : 'SELL'} ` +
      `${isDerivative ? 'derivative buffer 1.5%' : 'equity buffer 1.0%'} ` +
      `limit=${limitPrice} validity=${validity}`
  );
  return { ...baseOrder, order_type: 'LIMIT', price: limitPrice, validity };
}

export function convertToBasketItem(broker, stock, symbolMap, overrides = {}) {
  if (broker === 'Zerodha') {
    const adviceSymbol = stock?.tradingSymbol || stock?.symbol || '';
    const symbolInfo = symbolMap?.[adviceSymbol] || {};
    // BUY: prefer the scripmaster's exchange over stock.exchange — it handles
    // BSE-primary stocks mislabeled as NSE in tradeReco (e.g. VIKASECO).
    // SELL: the leg's exchange wins when present. The calculator resolved it
    // from the broker's own holdings row, i.e. where the shares actually sit,
    // and Kite validates a CNC sell against THAT exchange's holding. On
    // 2026-09-18 the scripmaster said VIKASECO-EQ → NSE while the customer's
    // 82 shares were held as BSE; Kite rejected the NSE sell with "Holding
    // quantity: 0" even though both the book and the snapshot said 82.
    const legSide = String(
      stock?.transactionType || stock?.type || stock?.side || '',
    ).toUpperCase();
    const heldExchange = String(stock?.exchange || '').trim();
    const exchange =
      overrides.exchange ||
      (legSide === 'SELL' && heldExchange ? heldExchange : null) ||
      symbolInfo.exchange ||
      stock.exchange;
    // Strip -EQ suffix if present for Zerodha symbol
    let tradingsymbol =
      overrides.tradingsymbol || symbolInfo.zerodha_symbol || adviceSymbol;
    if (typeof tradingsymbol === 'string' && tradingsymbol.endsWith('-EQ')) {
      tradingsymbol = tradingsymbol.replace(/-EQ$/, '');
    }

    // MARKET -> LIMIT-DAY with a market-protection buffer.
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
    let price = overrides.price ?? stock.price ?? 0;
    let validity = null;
    const ltp = parseFloat(
      overrides.ltp ??
        stock.ltp ??
        stock.lastPrice ??
        stock.currentPrice ??
        stock.last_price ??
        0
    );
    if (orderType === 'MARKET' && ltp > 0) {
      const isBuy = (stock.transactionType || 'BUY').toUpperCase() === 'BUY';
      const rawBuffered = isBuy
        ? ltp * (1 + MARKET_PROTECTION_BUFFER_PCT)
        : ltp * (1 - MARKET_PROTECTION_BUFFER_PCT);
      // Snap to the tick-safe schedule (0.10/0.50/1.00 — see roundToKiteTick).
      const bufferedPrice = roundToKiteTick(
        rawBuffered,
        isBuy ? 'ceil' : 'floor',
      );
      // Hold it inside the circuit band when the broker reported one. This
      // touches ONLY the price synthesised here for a MARKET leg; an explicit
      // LIMIT never reaches this branch. With no band the value is returned
      // unchanged, which is the behaviour before this change.
      const band = getCircuitBand(exchange, tradingsymbol);
      const limitPrice = clampToCircuitBand(bufferedPrice, isBuy, band);
      orderType = 'LIMIT';
      price = limitPrice;
      validity = 'DAY';
      console.log(
        `[BrokerPublisher] MARKET→LIMIT for ${tradingsymbol}: ltp=${ltp} ` +
          `${isBuy ? 'BUY' : 'SELL'} ` +
          `${isDerivative ? 'derivative 1.5%' : 'equity 1.0%'} ` +
          `limit=${limitPrice} validity=${validity}` +
          (limitPrice !== bufferedPrice
            ? ` (clamped from ${bufferedPrice} to the circuit band ` +
              `${band?.lower ?? '-'}..${band?.upper ?? '-'})`
            : '')
      );
    }

    const quantity = overrides.quantity ?? stock.quantity;
    const transactionType = (
      overrides.transactionType || stock.transactionType || 'BUY'
    ).toUpperCase();
    const tag = String(
      overrides.tag ??
        stock.publisherTag ??
        stock.tag ??
        stock.zerodhaTradeId ??
        stock.tradeId ??
        '',
    ).substring(0, 20);
    const item = {
      tradingsymbol,
      // No silent default — callers must validate via validateStockExchanges()
      // before building the basket. Kite silently drops items with the wrong
      // exchange, which has caused live orders (e.g. BSE-only ADARSHPL) to
      // vanish without an error.
      exchange,
      transaction_type: transactionType,
      quantity,
      order_type: orderType,
      // B-28: pass exchange so F&O (NFO/BFO) maps CARRYFORWARD → NRML
      // instead of CNC. Equity (NSE/BSE) is unchanged.
      product: mapKiteProductType(stock.productType, exchange),
      price,
      trigger_price: overrides.triggerPrice ?? stock.triggerPrice ?? 0,
      variety: 'regular',
      readonly: overrides.readonly ?? Number(quantity) > 100,
      tag,
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
 * Void the `traderecos` rows written by `update-reco-with-zerodha-model-pf`
 * when the attempt was refused BEFORE the dispatch boundary.
 *
 * The rows are created before anything authorises the attempt, so a refusal
 * (ccxt 409 on a consumed plan, a missing execution identity) leaves status-less
 * rows that no reconciler owns — the Orders screen then renders them as
 * "Unknown" forever. prod/arulthakur, 2026-09-17: a refused second launch left
 * five such rows. See
 * prod-alphaquark-github/docs/server_issues/2026-09-17-arul-zerodha-orders-unknown-orphan-rows.md.
 *
 * A definitive client refusal (4xx) is the only proof the basket never opened.
 * An ambiguous outcome — timeout, connection reset, 5xx — must NOT be voided:
 * the plan may be consumed and the basket may still open, which is the same
 * rule `publisherBatchDispatch` applies past `authorize()`.
 *
 * Never throws, and returns the number of rows voided: this runs while an error
 * is already being reported to the customer, so a failed cleanup must not
 * replace the real reason.
 */
export async function voidUnsentPublisherRecos({legs, email, headers, error}) {
  const status = error?.response?.status;
  if (!(status >= 400 && status < 500)) return 0;

  const tradeIds = (Array.isArray(legs) ? legs : [])
    .map(leg => leg?.tradeId)
    .filter(Boolean)
    .map(String);
  if (tradeIds.length === 0) return 0;

  try {
    const response = await axios.post(
      `${server.server.baseUrl}api/zerodha/model-portfolio/void-reco-with-zerodha-model-pf`,
      {tradeIds, email},
      {headers},
    );
    return response?.data?.data?.voided ?? 0;
  } catch (cleanupError) {
    console.warn(
      '[Publisher] Could not void unsent trade recos:',
      cleanupError?.message || cleanupError,
    );
    return 0;
  }
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
