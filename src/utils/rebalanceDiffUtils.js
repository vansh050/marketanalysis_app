/**
 * rebalanceDiffUtils.js
 * Utilities for computing and displaying differences between current and target portfolio allocations.
 * Ported from prod-alphaquark-github for feature parity.
 */

/**
 * Compute rebalance diff between current holdings and target allocation.
 * @param {Array} currentHoldings - [{ symbol, quantity, avgPrice, exchange }]
 * @param {Array} targetAllocation - [{ symbol, value (% weight), price, exchange }]
 * @param {number} totalInvestment - Total investment amount
 * @returns {Array} [{ symbol, currentQty, targetQty, diffQty, action, currentWeight, targetWeight }]
 */
export function computeRebalanceDiff(
  currentHoldings = [],
  targetAllocation = [],
  totalInvestment = 0,
) {
  const holdingsMap = {};
  currentHoldings.forEach(h => {
    const sym = (h.symbol || '').toUpperCase();
    holdingsMap[sym] = {
      quantity: Number(h.quantity || 0),
      avgPrice: Number(h.avgPrice || h.averagePrice || 0),
      exchange: h.exchange || 'NSE',
    };
  });

  const currentTotalValue = currentHoldings.reduce(
    (sum, h) => sum + Number(h.quantity || 0) * Number(h.avgPrice || h.averagePrice || 0),
    0,
  );
  const effectiveTotal = totalInvestment || currentTotalValue;

  const diffs = [];

  // Process target allocation
  targetAllocation.forEach(target => {
    const sym = (target.symbol || '').toUpperCase();
    const targetWeight = Number(target.value || 0);
    const targetValue = (targetWeight / 100) * effectiveTotal;
    const price = Number(target.price || 0);
    const targetQty = price > 0 ? Math.floor(targetValue / price) : 0;

    const current = holdingsMap[sym];
    const currentQty = current ? current.quantity : 0;
    const currentValue = current ? current.quantity * current.avgPrice : 0;
    const currentWeight =
      effectiveTotal > 0 ? (currentValue / effectiveTotal) * 100 : 0;

    const diffQty = targetQty - currentQty;

    diffs.push({
      symbol: sym,
      exchange: target.exchange || current?.exchange || 'NSE',
      currentQty,
      targetQty,
      diffQty,
      action: diffQty > 0 ? 'BUY' : diffQty < 0 ? 'SELL' : 'HOLD',
      currentWeight: Math.round(currentWeight * 100) / 100,
      targetWeight: Math.round(targetWeight * 100) / 100,
      weightDiff: Math.round((targetWeight - currentWeight) * 100) / 100,
      currentValue: Math.round(currentValue),
      targetValue: Math.round(targetValue),
      price,
    });

    // Remove from map (remaining = stocks to exit)
    delete holdingsMap[sym];
  });

  // Stocks in holdings but not in target (should be sold)
  Object.entries(holdingsMap).forEach(([sym, holding]) => {
    const currentValue = holding.quantity * holding.avgPrice;
    const currentWeight =
      effectiveTotal > 0 ? (currentValue / effectiveTotal) * 100 : 0;

    diffs.push({
      symbol: sym,
      exchange: holding.exchange,
      currentQty: holding.quantity,
      targetQty: 0,
      diffQty: -holding.quantity,
      action: 'SELL',
      currentWeight: Math.round(currentWeight * 100) / 100,
      targetWeight: 0,
      weightDiff: -Math.round(currentWeight * 100) / 100,
      currentValue: Math.round(currentValue),
      targetValue: 0,
      price: holding.avgPrice,
    });
  });

  return diffs.sort((a, b) => {
    // Sort: SELL first, then BUY, then HOLD
    const order = {SELL: 0, BUY: 1, HOLD: 2};
    return (order[a.action] || 3) - (order[b.action] || 3);
  });
}

/**
 * Computes the diff between two consecutive rebalance row arrays.
 *
 * @param {Array} currentRows  - rows from the current (newer) rebalance
 * @param {Array|null} previousRows - rows from the previous (older) rebalance, or null/undefined for the first rebalance
 * @returns {{ added: Array, removed: Array, increased: Array, decreased: Array } | null}
 *   Returns null when there is no previous rebalance (i.e. the first/oldest rebalance).
 */
export function computeRowsDiff(currentRows, previousRows) {
  if (!previousRows || previousRows.length === 0) return null;
  if (!currentRows) return null;

  const THRESHOLD = 0.01; // ignore weight changes smaller than 0.01%

  const normalize = sym =>
    (sym || '')
      .toUpperCase()
      .replace(/-EQ$/, '')
      .trim();

  const isCash = sym => normalize(sym) === 'CASH';

  // Build lookup maps keyed by normalized symbol
  const prevMap = new Map();
  for (const row of previousRows) {
    if (isCash(row.symbol)) continue;
    prevMap.set(normalize(row.symbol), row);
  }

  const currMap = new Map();
  for (const row of currentRows) {
    if (isCash(row.symbol)) continue;
    currMap.set(normalize(row.symbol), row);
  }

  const added = [];
  const removed = [];
  const increased = [];
  const decreased = [];

  // Stocks in current but not in previous → added
  // Stocks in both → check weight change
  for (const [sym, curr] of currMap) {
    const prev = prevMap.get(sym);
    if (!prev) {
      added.push({
        symbol: curr.symbol,
        newWeight: curr.targetW,
      });
    } else {
      const delta = curr.targetW - prev.targetW;
      if (delta > THRESHOLD) {
        increased.push({
          symbol: curr.symbol,
          oldWeight: prev.targetW,
          newWeight: curr.targetW,
        });
      } else if (delta < -THRESHOLD) {
        decreased.push({
          symbol: curr.symbol,
          oldWeight: prev.targetW,
          newWeight: curr.targetW,
        });
      }
    }
  }

  // Stocks in previous but not in current → removed
  for (const [sym, prev] of prevMap) {
    if (!currMap.has(sym)) {
      removed.push({
        symbol: prev.symbol,
        oldWeight: prev.targetW,
      });
    }
  }

  return {added, removed, increased, decreased};
}

/**
 * Summarize rebalance diff.
 */
export function summarizeRebalanceDiff(diffs) {
  const buys = diffs.filter(d => d.action === 'BUY');
  const sells = diffs.filter(d => d.action === 'SELL');
  const holds = diffs.filter(d => d.action === 'HOLD');

  const totalBuyValue = buys.reduce(
    (sum, d) => sum + Math.abs(d.diffQty) * d.price,
    0,
  );
  const totalSellValue = sells.reduce(
    (sum, d) => sum + Math.abs(d.diffQty) * d.price,
    0,
  );

  return {
    buyCount: buys.length,
    sellCount: sells.length,
    holdCount: holds.length,
    totalBuyValue: Math.round(totalBuyValue),
    totalSellValue: Math.round(totalSellValue),
    netCashFlow: Math.round(totalSellValue - totalBuyValue),
    totalStocks: diffs.length,
  };
}
