/**
 * adviceDisplay — advice-card DISPLAY label helpers (2026-07-17)
 *
 * Mirrors the authoritative advice-email formatting in ccxt-india
 * `advice/mailer.py` (`AdviceMailer.build_trade_row_data`, ~lines 320-360)
 * so every RN advice-card surface says the same thing the email says.
 *
 * Bug this fixes: advice cards were rendering a hardcoded
 * "{ACTION} AT {ORDERTYPE} PRICE" header regardless of whether the advice
 * carried a stop-loss and/or profit-target — e.g. a BUY with both an SL and
 * a PT showed "BUY AT MARKET PRICE", which is misleading (the advice is NOT
 * a bare market order, it has risk-management legs attached). The email has
 * always known better:
 *
 *   both SL + PT  -> "{ACTION} with STOP LOSS & PROFIT TARGET"
 *   SL only       -> "{ACTION} with STOP LOSS"
 *   PT only       -> "{ACTION} with PROFIT TARGET"
 *   neither       -> "{ACTION} at Market Price"  /  "{ACTION} at ₹<price>"
 *
 * This module is PRESENTATION ONLY. It must never be imported by order-
 * placement / broker-submission code paths (ReviewTradeModal, AddtoCartModal,
 * RebalanceModal, MPReviewTradeModal, IgnoreTradesScreen, BrokerOrderBookAPI,
 * etc.) — those decide what actually gets sent to the broker and are
 * intentionally untouched by this change.
 */

// Mirrors mailer.py's `order_type_display_map`. Keys are matched
// case-insensitively; both `SL_M` and the more common REST-API spelling
// `SL-M` are accepted (ccxt/broker payloads use both spellings in the wild).
const ORDER_TYPE_DISPLAY_MAP = {
  MARKET: 'Market',
  LIMIT: 'Limit',
  SL: 'Stop Loss',
  SL_M: 'Stop Loss Market',
  GTT: 'GTT',
  GTT_OCO: 'GTT OCO',
};

/**
 * Normalizes a raw OrderType value (any casing, '-' or '_' separator) to the
 * display-map lookup key, e.g. 'sl-m' -> 'SL_M'.
 */
function normalizeOrderTypeKey(orderType) {
  return String(orderType || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
}

/**
 * Display-friendly order type label. Mirrors mailer.py's
 * `order_type_display_map.get(order_type, order_type if order_type else 'Market')`.
 *
 *   orderTypeDisplay('MARKET')  -> 'Market'
 *   orderTypeDisplay('LIMIT')   -> 'Limit'
 *   orderTypeDisplay('SL')      -> 'Stop Loss'
 *   orderTypeDisplay('SL-M')    -> 'Stop Loss Market'
 *   orderTypeDisplay('SL_M')    -> 'Stop Loss Market'
 *   orderTypeDisplay('GTT')     -> 'GTT'
 *   orderTypeDisplay('GTT_OCO') -> 'GTT OCO'
 *   orderTypeDisplay('')        -> 'Market'
 *   orderTypeDisplay('WEIRD')   -> 'WEIRD' (raw fallback, matches mailer.py)
 */
export function orderTypeDisplay(orderType) {
  const key = normalizeOrderTypeKey(orderType);
  if (!key) {
    return 'Market';
  }
  return ORDER_TYPE_DISPLAY_MAP[key] || orderType;
}

/**
 * Truthiness test mirroring mailer.py's
 * `trade.get('stopLoss') and trade.get('stopLoss') != '-'`, adapted to JS:
 * treats undefined/null/''/'-'  and numeric 0 (incl. '0' string) as "absent".
 * This matches the `stopLoss > 0` convention already used at several
 * existing call sites in this app (e.g. PushNotificationScreen.js).
 */
function isPresentValue(v) {
  if (v === undefined || v === null || v === '' || v === '-') {
    return false;
  }
  const n = Number(v);
  if (!Number.isNaN(n) && n === 0) {
    return false;
  }
  return true;
}

/**
 * Formats the "at <price>" tail of the header, mirroring mailer.py:
 *   price = str(trade.get('Price','') or '').strip()
 *   if price in {'', '0', '0.00', '0.000', '-'}: price = 'Market Price'
 *   price_formatted = f"₹{price}" if price != 'Market Price' else price
 */
function formatPriceForHeader(price) {
  if (!isPresentValue(price)) {
    return 'Market Price';
  }
  return `₹${price}`;
}

/**
 * Builds the advice-card header label exactly like mailer.py's `_type`
 * (get_trade_type_label + the has_stop_loss/has_profit_target branching).
 *
 * @param {Object} params
 * @param {string} params.action - 'BUY' | 'SELL' (any casing; uppercased)
 * @param {string} [params.orderType] - 'MARKET' | 'LIMIT' | ... (unused when
 *   SL/PT is present, matching mailer.py — order type only affects the
 *   "at Market Price" / "at ₹X" branch, and even there it's the presence of
 *   a real `price` value that decides, not the OrderType label itself).
 * @param {number|string} [params.price] - the advised Price field (limit
 *   price when set; empty/0/'-' means "at Market Price").
 * @param {number|string} [params.stopLoss]
 * @param {number|string} [params.profitTarget]
 * @returns {string}
 *
 * Examples:
 *   adviceHeaderLabel({action:'SELL', stopLoss:1150, profitTarget:1542})
 *     -> 'SELL with STOP LOSS & PROFIT TARGET'
 *   adviceHeaderLabel({action:'SELL', stopLoss:1150})
 *     -> 'SELL with STOP LOSS'
 *   adviceHeaderLabel({action:'BUY', profitTarget:1542})
 *     -> 'BUY with PROFIT TARGET'
 *   adviceHeaderLabel({action:'BUY', orderType:'MARKET'})
 *     -> 'BUY at Market Price'
 *   adviceHeaderLabel({action:'BUY', orderType:'LIMIT', price:1234})
 *     -> 'BUY at ₹1234'
 */
export function adviceHeaderLabel(params = {}) {
  const {action = '', price, stopLoss, profitTarget} = params;
  // `orderType` is accepted (and documented above) for call-site clarity —
  // it is deliberately NOT used in the branching below, matching
  // mailer.py: only the presence of a real `price` value decides the
  // "at Market Price" vs "at ₹X" tail, not the OrderType label itself.
  const act = String(action || '').toUpperCase().trim();
  const hasStopLoss = isPresentValue(stopLoss);
  const hasProfitTarget = isPresentValue(profitTarget);

  if (hasStopLoss && hasProfitTarget) {
    return `${act} with STOP LOSS & PROFIT TARGET`;
  }
  if (hasStopLoss) {
    return `${act} with STOP LOSS`;
  }
  if (hasProfitTarget) {
    return `${act} with PROFIT TARGET`;
  }
  return `${act} at ${formatPriceForHeader(price)}`;
}

export default {
  orderTypeDisplay,
  adviceHeaderLabel,
};
