/**
 * ReconciliationService.js
 *
 * Purpose: Detect pending (unfilled) orders before placing closure orders
 *
 * IMPORTANT NOTE:
 * - The backend's `to_trade_net` is the SOURCE OF TRUTH for positions
 * - `to_trade_net` already accounts for:
 *   - Executed orders (add to position)
 *   - Rejected orders (don't add since they failed)
 *   - Cancelled orders (don't add)
 * - `toTradeQty` represents the NET quantity to close
 * - `toTradeQty = 0` means no position to close (all orders rejected/cancelled)
 *
 * This service ONLY checks for PENDING orders that haven't executed yet:
 * - If a BUY order is still pending, and we try to SELL (close), warn user
 * - User can either cancel the pending order or refresh data to check if it executed
 */

import {findPendingOrdersForSymbol} from './BrokerOrderBookAPI';

/**
 * Conflict types - focused only on pending order conflicts
 */
export const CONFLICT_TYPES = {
  PENDING_ORDER_CONFLICT: 'PENDING_ORDER_CONFLICT',
  PARTIAL_FILL_CONFLICT: 'PARTIAL_FILL_CONFLICT',
};

/**
 * Recommendations for handling conflicts
 */
export const RECOMMENDATIONS = {
  CANCEL_PENDING: 'CANCEL_PENDING',
  REFRESH_AND_PROCEED: 'REFRESH_AND_PROCEED',
  ADJUST_QUANTITY: 'ADJUST_QUANTITY',
};

/**
 * Detect if a trade is a closure trade
 * @param {object} trade - Trade object
 * @returns {boolean}
 */
export const isClosureTrade = (trade) => {
  return (
    trade.isClosure === true ||
    (trade.closurestatus && trade.closurestatus !== '') ||
    trade.closurestatus === 'fullClose' ||
    trade.closurestatus === 'partialClose'
  );
};

/**
 * Get opposite transaction type
 * @param {string} type - BUY or SELL
 * @returns {string}
 */
const getOppositeType = (type) => {
  const upperType = type?.toUpperCase();
  return upperType === 'BUY' ? 'SELL' : 'BUY';
};

/**
 * Detect pending order conflicts for closure trades
 *
 * This checks if there are PENDING (unfilled) orders that would conflict with closures.
 * The backend's to_trade_net already handles rejected orders - we only need to catch
 * orders that are still pending in the broker's system.
 *
 * @param {Array} basketTrades - Array of trades in the basket
 * @param {Array} allOrders - All orders from broker order book
 * @returns {Array} - Array of conflicts
 */
export const detectConflicts = (basketTrades, allOrders) => {
  const conflicts = [];

  if (!allOrders || allOrders.length === 0) {
    return conflicts;
  }

  basketTrades.forEach((trade) => {
    // Only check closure trades
    if (!isClosureTrade(trade)) {
      return;
    }

    const tradeSymbol = trade.tradingSymbol || trade.Symbol || trade.symbol;
    const tradeType = trade.transactionType || trade.Type || trade.type;
    const closureQty = Math.abs(trade.quantity || trade.Quantity || trade.toTradeQty || 0);

    // For a closure trade (e.g., SELL to close), look for pending orders
    // of the opposite type (e.g., pending BUY) for the same symbol
    const oppositeType = getOppositeType(tradeType);

    // Find pending orders for this symbol with opposite transaction type
    const matchingPendingOrders = findPendingOrdersForSymbol(
      allOrders,
      tradeSymbol,
      oppositeType,
    );

    matchingPendingOrders.forEach((pendingOrder) => {
      const isUnfilled = pendingOrder.filledQuantity === 0;
      const isPartiallyFilled =
        pendingOrder.filledQuantity > 0 &&
        pendingOrder.filledQuantity < pendingOrder.quantity;

      if (isUnfilled) {
        // PENDING ORDER: Entry order hasn't executed yet
        // The backend's to_trade_net may have calculated position assuming this would execute
        // We should warn user and let them decide
        conflicts.push({
          type: CONFLICT_TYPES.PENDING_ORDER_CONFLICT,
          closureTrade: {
            symbol: tradeSymbol,
            quantity: closureQty,
            tradeId: trade.tradeId,
            type: tradeType,
            price: trade.price || trade.Price,
            orderType: trade.orderType || trade.OrderType,
          },
          pendingOrder: {
            orderId: pendingOrder.orderId,
            symbol: pendingOrder.symbol,
            quantity: pendingOrder.quantity,
            filledQuantity: pendingOrder.filledQuantity,
            pendingQuantity: pendingOrder.pendingQuantity,
            status: pendingOrder.status,
            normalizedStatus: pendingOrder.normalizedStatus,
            transactionType: pendingOrder.transactionType,
            price: pendingOrder.price,
            orderType: pendingOrder.orderType,
            placedAt: pendingOrder.placedAt,
            variety: pendingOrder.variety,
          },
          recommendation: RECOMMENDATIONS.CANCEL_PENDING,
          message: `Pending ${oppositeType} order for ${tradeSymbol} hasn't executed yet. The position may not be open.`,
        });
      } else if (isPartiallyFilled) {
        // PARTIAL FILL: Only some quantity has filled
        const actualPosition = pendingOrder.filledQuantity;

        if (closureQty > actualPosition) {
          conflicts.push({
            type: CONFLICT_TYPES.PARTIAL_FILL_CONFLICT,
            closureTrade: {
              symbol: tradeSymbol,
              quantity: closureQty,
              tradeId: trade.tradeId,
              type: tradeType,
            },
            pendingOrder: {
              orderId: pendingOrder.orderId,
              symbol: pendingOrder.symbol,
              quantity: pendingOrder.quantity,
              filledQuantity: pendingOrder.filledQuantity,
              pendingQuantity: pendingOrder.pendingQuantity,
              status: pendingOrder.status,
              transactionType: pendingOrder.transactionType,
              placedAt: pendingOrder.placedAt,
            },
            recommendation: RECOMMENDATIONS.ADJUST_QUANTITY,
            suggestedQuantity: actualPosition,
            message: `The ${oppositeType} order was only partially filled (${actualPosition} of ${pendingOrder.quantity}). Closure quantity may need adjustment.`,
          });
        }
      }
    });
  });

  return conflicts;
};

/**
 * Reconcile basket trades against pending orders
 * @param {Array} basketTrades - Array of trades in the basket
 * @param {Array} allOrders - Array of all orders from broker
 * @returns {object} - Reconciliation result
 */
export const reconcileBasket = (basketTrades, allOrders) => {
  if (!basketTrades || basketTrades.length === 0) {
    return {
      hasConflicts: false,
      conflicts: [],
      tradesToPlace: basketTrades || [],
      tradesToSkip: [],
      warnings: [],
    };
  }

  // Detect conflicts
  const conflicts = detectConflicts(basketTrades, allOrders);

  // Build set of conflicted symbols for quick lookup
  const conflictedSymbols = new Set(
    conflicts.map((c) => c.closureTrade.symbol?.toUpperCase()),
  );

  // Categorize trades
  const tradesToPlace = [];
  const tradesToSkip = [];
  const warnings = [];

  basketTrades.forEach((trade) => {
    const tradeSymbol = (
      trade.tradingSymbol ||
      trade.Symbol ||
      trade.symbol
    )?.toUpperCase();

    // Check if this trade has a conflict
    const hasConflict = conflictedSymbols.has(tradeSymbol) && isClosureTrade(trade);

    if (hasConflict) {
      // Find the specific conflict for this trade
      const conflict = conflicts.find(
        (c) => c.closureTrade.symbol?.toUpperCase() === tradeSymbol,
      );

      if (conflict) {
        tradesToSkip.push({
          ...trade,
          skipReason: conflict.message,
          conflict: conflict,
        });
      }
    } else {
      // No conflict - can place this trade
      tradesToPlace.push(trade);
    }
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    tradesToPlace,
    tradesToSkip,
    warnings,
    summary: {
      totalTrades: basketTrades.length,
      tradesToPlace: tradesToPlace.length,
      tradesToSkip: tradesToSkip.length,
      conflictsDetected: conflicts.length,
    },
  };
};

/**
 * Generate user-friendly conflict messages
 * @param {Array} conflicts - Array of conflicts
 * @returns {Array} - Array of formatted messages
 */
export const formatConflictMessages = (conflicts) => {
  return conflicts.map((conflict) => {
    const {closureTrade, pendingOrder, type} = conflict;

    switch (type) {
      case CONFLICT_TYPES.PENDING_ORDER_CONFLICT:
        return {
          title: 'Pending Order Found',
          symbol: closureTrade.symbol,
          severity: 'high',
          details: [
            `Symbol: ${closureTrade.symbol}`,
            `Pending ${pendingOrder.transactionType}: ${pendingOrder.quantity} @ ${pendingOrder.orderType}`,
            `Status: ${pendingOrder.status} (not executed)`,
            `Placed: ${formatTime(pendingOrder.placedAt)}`,
            ``,
            `Proposed closure: ${closureTrade.type} ${closureTrade.quantity}`,
          ],
          actions: [
            {
              key: 'cancelPending',
              label: 'Cancel Pending Order',
              description: `Cancel the pending ${pendingOrder.transactionType} order`,
              recommended: true,
            },
            {
              key: 'refreshAndProceed',
              label: 'Refresh & Proceed',
              description: 'Refresh order status and proceed with updated data',
              recommended: false,
            },
          ],
        };

      case CONFLICT_TYPES.PARTIAL_FILL_CONFLICT:
        return {
          title: 'Partial Fill Warning',
          symbol: closureTrade.symbol,
          severity: 'medium',
          details: [
            `Symbol: ${closureTrade.symbol}`,
            `Order partially filled: ${pendingOrder.filledQuantity} of ${pendingOrder.quantity}`,
            `You are trying to close: ${closureTrade.quantity}`,
            `Actual position: ${pendingOrder.filledQuantity}`,
          ],
          actions: [
            {
              key: 'adjust',
              label: `Adjust to ${pendingOrder.filledQuantity}`,
              description: 'Close only the filled quantity',
              recommended: true,
            },
            {
              key: 'refreshAndProceed',
              label: 'Refresh & Proceed',
              description: 'Refresh to get latest fill status',
              recommended: false,
            },
          ],
        };

      default:
        return {
          title: 'Order Conflict',
          symbol: closureTrade.symbol,
          severity: 'medium',
          details: [conflict.message],
          actions: [
            {key: 'skip', label: 'Skip', recommended: true},
            {key: 'proceed', label: 'Proceed', recommended: false},
          ],
        };
    }
  });
};

/**
 * Format timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string} - Formatted time
 */
const formatTime = (timestamp) => {
  if (!timestamp) return 'Unknown';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
};

/**
 * Apply user's resolution to conflicts
 * @param {object} reconciliationResult - Result from reconcileBasket
 * @param {object} userChoices - Map of conflict index to user's choice
 * @returns {object} - Updated reconciliation with user's choices applied
 */
export const applyUserResolutions = (reconciliationResult, userChoices) => {
  const {conflicts, tradesToSkip, tradesToPlace} = reconciliationResult;

  const finalTradesToPlace = [...tradesToPlace];
  const finalTradesToSkip = [...tradesToSkip];
  const ordersToCancel = [];

  conflicts.forEach((conflict, index) => {
    const choice = userChoices[index] || 'cancelPending';

    if (choice === 'refreshAndProceed') {
      // User chose to refresh and proceed - move from skipped to place
      const skippedIndex = finalTradesToSkip.findIndex(
        (t) =>
          (t.tradingSymbol || t.Symbol || t.symbol)?.toUpperCase() ===
          conflict.closureTrade.symbol?.toUpperCase(),
      );

      if (skippedIndex !== -1) {
        const trade = finalTradesToSkip.splice(skippedIndex, 1)[0];
        finalTradesToPlace.push({
          ...trade,
          userOverride: true,
          needsRefresh: true,
          overrideReason: 'User chose to refresh and proceed',
        });
      }
    } else if (choice === 'cancelPending') {
      // User chose to cancel pending order
      if (conflict.pendingOrder) {
        ordersToCancel.push(conflict.pendingOrder);
      }
      // Trade stays in skipped (can't close a position that wasn't opened)
    } else if (choice === 'adjust') {
      // User chose to adjust quantity
      const skippedIndex = finalTradesToSkip.findIndex(
        (t) =>
          (t.tradingSymbol || t.Symbol || t.symbol)?.toUpperCase() ===
          conflict.closureTrade.symbol?.toUpperCase(),
      );

      if (skippedIndex !== -1 && conflict.suggestedQuantity) {
        const trade = finalTradesToSkip.splice(skippedIndex, 1)[0];
        finalTradesToPlace.push({
          ...trade,
          quantity: conflict.suggestedQuantity,
          Quantity: conflict.suggestedQuantity,
          wasAdjusted: true,
        });
      }
    }
  });

  return {
    ...reconciliationResult,
    tradesToPlace: finalTradesToPlace,
    tradesToSkip: finalTradesToSkip,
    ordersToCancel,
    userResolutionsApplied: true,
  };
};

export default {
  reconcileBasket,
  detectConflicts,
  formatConflictMessages,
  applyUserResolutions,
  isClosureTrade,
  CONFLICT_TYPES,
  RECOMMENDATIONS,
};
