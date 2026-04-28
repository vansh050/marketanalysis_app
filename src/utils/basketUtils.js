/**
 * basketUtils.js
 * Utilities for basket/derivatives trade construction and lot size management.
 * Ported from prod-alphaquark-github for feature parity.
 */

/**
 * Parse F&O symbol to extract components.
 * e.g., "NIFTY23D2860CE" -> { underlying: "NIFTY", expiry: "23D28", strike: 60, optionType: "CE" }
 */
export function parseFnOSymbol(symbol) {
  if (!symbol) return null;

  // Match pattern: UNDERLYING + EXPIRY_DATE + STRIKE + OPTION_TYPE
  const match = symbol.match(
    /^([A-Z]+)(\d{2}[A-Z]\d{2})(\d+)(CE|PE|FUT)?$/i,
  );
  if (!match) return null;

  return {
    underlying: match[1],
    expiry: match[2],
    strike: parseInt(match[3], 10),
    optionType: match[4] || 'FUT',
    isOption: match[4] === 'CE' || match[4] === 'PE',
    isFuture: !match[4] || match[4] === 'FUT',
  };
}

/**
 * Calculate quantity adjusted for lot size.
 * @param {number} rawQuantity - Desired quantity
 * @param {number} lotSize - Lot size for the instrument
 * @returns {number} Adjusted quantity (multiple of lotSize)
 */
export function adjustForLotSize(rawQuantity, lotSize) {
  if (!lotSize || lotSize <= 0) return rawQuantity;
  return Math.max(lotSize, Math.round(rawQuantity / lotSize) * lotSize);
}

/**
 * Get number of lots from quantity and lot size.
 */
export function getLotsCount(quantity, lotSize) {
  if (!lotSize || lotSize <= 0) return quantity;
  return Math.floor(quantity / lotSize);
}

/**
 * Format quantity display with lot information.
 * e.g., "3 lots (75)" for lotSize=25, qty=75
 */
export function formatQuantityWithLots(quantity, lotSize) {
  if (!lotSize || lotSize <= 1) return `${quantity}`;
  const lots = getLotsCount(quantity, lotSize);
  return `${lots} lot${lots !== 1 ? 's' : ''} (${quantity})`;
}

/**
 * Build a basket of orders from trade recommendations.
 * @param {Array} trades - Trade recommendations
 * @param {string} broker - Broker name
 * @returns {Array} Formatted basket items
 */
export function buildBasket(trades, broker) {
  return trades.map((trade, index) => ({
    symbol: trade.tradingSymbol || trade.Symbol || trade.symbol,
    exchange: trade.exchange || trade.Exchange || 'NSE',
    transactionType: trade.transactionType || trade.Type || 'BUY',
    quantity: parseInt(trade.quantity || trade.Quantity || 0, 10),
    orderType: trade.orderType || trade.OrderType || 'MARKET',
    productType: trade.productType || trade.ProductType || 'DELIVERY',
    price: parseFloat(trade.price || trade.Price || 0),
    triggerPrice: parseFloat(trade.triggerPrice || 0),
    priority: trade.priority || index,
    tradeId: trade.tradeId,
    zerodhaTradeId: trade.zerodhaTradeId,
    token: trade.token || trade.symbolToken,
  }));
}

/**
 * Separate basket into BUY and SELL groups.
 */
export function separateByTransactionType(basket) {
  const buyOrders = basket.filter(
    t => (t.transactionType || '').toUpperCase() === 'BUY',
  );
  const sellOrders = basket.filter(
    t => (t.transactionType || '').toUpperCase() === 'SELL',
  );
  return {buyOrders, sellOrders};
}

/**
 * Calculate total basket value.
 * @param {Array} basket - Basket items with price and quantity
 * @param {function} getLTP - Optional function to get live price
 * @returns {{ buyValue: number, sellValue: number, netValue: number }}
 */
export function calculateBasketValue(basket, getLTP) {
  let buyValue = 0;
  let sellValue = 0;

  basket.forEach(item => {
    const price = getLTP
      ? getLTP(item.symbol) || item.price
      : item.price;
    const value = price * item.quantity;

    if ((item.transactionType || '').toUpperCase() === 'BUY') {
      buyValue += value;
    } else {
      sellValue += value;
    }
  });

  return {buyValue, sellValue, netValue: buyValue - sellValue};
}

/**
 * Validate basket before submission.
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateBasket(basket) {
  const errors = [];

  if (!basket || basket.length === 0) {
    errors.push('Basket is empty');
    return {isValid: false, errors};
  }

  basket.forEach((item, i) => {
    if (!item.symbol) errors.push(`Item ${i + 1}: Missing symbol`);
    if (!item.quantity || item.quantity <= 0)
      errors.push(`Item ${i + 1}: Invalid quantity`);
    if (!item.exchange) errors.push(`Item ${i + 1}: Missing exchange`);
  });

  return {isValid: errors.length === 0, errors};
}

/**
 * Parse expiry date from searchSymbol or symbol.
 * Examples: "NIFTY16DEC", "NIFTY16DEC25", "BANKNIFTY23JAN25"
 */
export function parseExpiryFromSymbol(searchSymbol) {
  if (!searchSymbol) return null;
  const pattern = /(\d{2})([A-Z]{3})(\d{2})?$/i;
  const match = searchSymbol.match(pattern);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthStr = match[2].toUpperCase();
  const yearSuffix = match[3];
  const months = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const month = months[monthStr];
  if (month === undefined) return null;
  let year;
  if (yearSuffix) {
    year = 2000 + parseInt(yearSuffix, 10);
  } else {
    const now = new Date();
    year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
  }
  return new Date(year, month, day, 23, 59, 59);
}

/**
 * Check if basket is expired based on searchSymbol in trades.
 */
export function isBasketExpired(trades) {
  if (!trades || trades.length === 0) return false;
  for (const trade of trades) {
    const searchSymbol = trade.searchSymbol || trade.search_symbol;
    if (!searchSymbol) continue;
    const expiryDate = parseExpiryFromSymbol(searchSymbol);
    if (expiryDate && new Date() > expiryDate) return true;
  }
  return false;
}

/**
 * Net basket trades - cancels out equal BUY and SELL quantities for each symbol.
 * Only nets trades with "recommend" status.
 * For closure positions, consolidates by symbol to show net toTradeQty per symbol.
 *
 * @param {Array} trades - Array of basket trades
 * @returns {Array} Netted trades (only trades with net quantity > 0) + closure positions + rejected trades
 */
export function netBasketTrades(trades) {
  if (!trades || trades.length === 0) return [];

  const recommendTrades = trades.filter(
    t =>
      (t.trade_place_status === 'recommend' ||
        t.trade_place_status === 'RECOMMEND') &&
      t.cancel !== true,
  );

  const closurePositions = trades.filter(t => {
    const isRecommend =
      t.trade_place_status === 'recommend' ||
      t.trade_place_status === 'RECOMMEND';
    const isRejectedOrFailed =
      t.trade_place_status === 'rejected' ||
      t.trade_place_status === 'REJECTED' ||
      t.trade_place_status === 'FAILURE';
    const hasToTradeQty =
      t.toTradeQty !== undefined && t.toTradeQty !== null && t.toTradeQty !== 0;
    const hasClosureStatus = t.closurestatus && t.closurestatus !== '';
    return (hasClosureStatus || (hasToTradeQty && !isRecommend)) && !isRejectedOrFailed;
  });

  const rejectedFailedTradesRaw = trades.filter(
    t =>
      t.trade_place_status === 'rejected' ||
      t.trade_place_status === 'REJECTED' ||
      t.trade_place_status === 'FAILURE',
  );

  const rejectedSymbolMap = new Map();
  rejectedFailedTradesRaw.forEach(t => {
    const symbol = t.Symbol || t.symbol;
    if (!symbol) return;
    if (!rejectedSymbolMap.has(symbol)) {
      rejectedSymbolMap.set(symbol, t);
    }
  });
  const rejectedFailedTrades = Array.from(rejectedSymbolMap.values());

  const consolidatedClosures = [];
  if (closurePositions.length > 0 && recommendTrades.length === 0) {
    const symbolMap = new Map();

    closurePositions.forEach(t => {
      const symbol = t.Symbol || t.symbol;
      if (!symbol) return;

      if (!symbolMap.has(symbol)) {
        const toTradeQty = t.toTradeQty || 0;
        symbolMap.set(symbol, {
          ...t,
          toTradeQty: toTradeQty,
          Quantity: Math.abs(toTradeQty),
          quantity: Math.abs(toTradeQty),
          Type: toTradeQty < 0 ? 'SELL' : 'BUY',
        });
      }
    });

    symbolMap.forEach(t => {
      if (t.toTradeQty !== 0) {
        consolidatedClosures.push(t);
      }
    });
  }

  if (recommendTrades.length === 0) {
    return [...consolidatedClosures, ...rejectedFailedTrades];
  }

  const symbolGroups = {};

  recommendTrades.forEach(t => {
    const symbol = t.Symbol || t.symbol;
    if (!symbol) return;

    if (!symbolGroups[symbol]) {
      symbolGroups[symbol] = {
        buyQuantity: 0,
        sellQuantity: 0,
        trades: [],
      };
    }

    const quantity = parseFloat(t.Quantity || t.quantity || 0);
    const type = (t.Type || t.type || '').toUpperCase();

    if (type === 'BUY') {
      symbolGroups[symbol].buyQuantity += quantity;
    } else if (type === 'SELL') {
      symbolGroups[symbol].sellQuantity += quantity;
    }

    symbolGroups[symbol].trades.push(t);
  });

  const nettedTrades = [];

  Object.keys(symbolGroups).forEach(symbol => {
    const group = symbolGroups[symbol];
    const netQuantity = group.buyQuantity - group.sellQuantity;

    if (netQuantity > 0) {
      const buyTrade = group.trades.find(
        t =>
          (t.Type || t.type || '').toUpperCase() === 'BUY' &&
          t.trade_place_status === 'recommend',
      );

      if (buyTrade) {
        nettedTrades.push({
          ...buyTrade,
          Quantity: netQuantity,
          quantity: netQuantity,
          isNetted: true,
        });
      }
    } else if (netQuantity < 0) {
      const sellTrade = group.trades.find(
        t =>
          (t.Type || t.type || '').toUpperCase() === 'SELL' &&
          t.trade_place_status === 'recommend',
      );

      if (sellTrade) {
        nettedTrades.push({
          ...sellTrade,
          Quantity: Math.abs(netQuantity),
          quantity: Math.abs(netQuantity),
          isNetted: true,
        });
      }
    }
  });

  return [...nettedTrades, ...consolidatedClosures, ...rejectedFailedTrades];
}
