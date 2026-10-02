/**
 * BasketCard — container (Phase G batch 4, 2026-05-02)
 *
 * Owns: useTrade (userDetails, broker, fetchBrokerOrderBook, configData),
 * reconcileBasket() async flow, isClosureTrade(), cancelOrder(),
 * dynamic require for ReconciliationService, modal callbacks,
 * show/hide state, trade expansion state, expiry detection.
 *
 * Renders presentation resolved from `composites.BasketCard`.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import BasketRunningProfit from '../../components/AdviceScreenComponents/DynamicText/BasketRunningProfit';
import {useTrade} from '../../screens/TradeContext';
import {reconcileBasket, isClosureTrade} from '../../services/ReconciliationService';
import PendingOrderWarningModal from '../../components/PendingOrderWarningModal';
import {cancelOrder} from '../../services/BrokerOrderBookAPI';
import {useComponent} from '../../design/useDesign';
import ManualBasketExitModal from '../../components/ManualBasketExitModal';
import Toast from 'react-native-toast-message';
import {
  authorizeBasketEntry,
  basketEntryGateMessage,
  requiresOutOfRangeConfirmation,
} from '../../services/BasketEntryGateService';
import {
  isRetiredEntryLeg,
  hasClosureContext,
  collapseRetiredEntries,
} from '../../utils/basketUtils';
import {cancelPendingBasketOrder} from '../../services/OrderService';
import PendingBasketOrdersPanel from './PendingBasketOrdersPanel';
import {
  basketOrderIdentity,
  isBasketInFlightStatus,
} from '../../utils/basketOrderState';
import {getBasketBrokerOwnership} from '../../utils/basketBrokerOwnership';
import useLTPStore from '../../components/AdviceScreenComponents/DynamicText/useLtpStore';

import { designColor } from '../../design/literalTokens';

const confirmOutOfRange = decision => {
  if (!requiresOutOfRangeConfirmation(decision)) return Promise.resolve(true);
  return new Promise(resolve => {
    Alert.alert(
      'Price outside advised range',
      'The current basket price is outside the manager\'s advised range. You may still place it, but the execution price can differ from the recommendation.',
      [
        {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
        {text: 'Continue', onPress: () => resolve(true)},
      ],
      {cancelable: true, onDismiss: () => resolve(false)},
    );
  });
};

const isRecordedManualExit = trade => {
  const status = String(trade?.trade_place_status || '').toLowerCase();
  const orderId = String(trade?.orderId || '').toLowerCase();
  const message = String(trade?.orderStatusMessage || '').toLowerCase();
  return Boolean(trade?.closurestatus) &&
    ['complete', 'executed', 'success', 'filled'].includes(status) &&
    (orderId.includes(':exit:') || message.includes('manually exited'));
};

const canonicalBasketTrades = trades => {
  // Entry-side collapse (2026-08-21): a manual reconciliation retires the
  // original advised leg (`manual_entry_completed_externally`, no explicit
  // fill) and records the customer's real size on a separate manual_entry
  // leg. The retired advice must not render as an extra "1 lot ✓" row next
  // to the "3 lot ✓" fill — it is history, not a fill. The manual-exit
  // collapse below keeps working on the live legs.
  const liveTrades = collapseRetiredEntries(trades);
  const exitsBySymbol = new Map();
  liveTrades.forEach(trade => {
    const symbol = trade?.Symbol || trade?.symbol;
    if (!symbol || !isRecordedManualExit(trade)) return;
    const existing = exitsBySymbol.get(symbol);
    if (!existing || new Date(trade.exitDate || trade.date || 0) > new Date(existing.exitDate || existing.date || 0)) {
      exitsBySymbol.set(symbol, trade);
    }
  });
  return liveTrades.filter(trade => {
    const symbol = trade?.Symbol || trade?.symbol;
    return !symbol || !exitsBySymbol.has(symbol) || exitsBySymbol.get(symbol) === trade;
  }).map(trade => {
    const symbol = trade?.Symbol || trade?.symbol;
    return exitsBySymbol.get(symbol) === trade
      ? {...trade, toTradeQty: 0, manualExitReconciled: true}
      : trade;
  });
};

const TERMINAL_COMPLETE_STATUSES = new Set(['complete', 'executed', 'success', 'filled']);
const RETRYABLE_ENTRY_STATUSES = new Set([
  'recommend',
  'recommended',
  'partial',
  'partially_filled',
  'rejected',
  'failure',
  'failed',
]);

const BasketCard = ({
  basket,
  setStockDetails,
  handleTradeNow,
  setisBasket,
  setbasketId,
  setbasketName,
  fullsetBasketData,
  setBasketData,
  handleTradeBasket,
  setOpenTokenExpireModel,
  setOpenBrokerModel,
  onCancelBasket,
}) => {
  console.log("Basket i Have ------",basket);
  const [showMore, setShowMore] = useState(false);
  const [expandedTrades, setExpandedTrades] = useState({});

  // Get trade context for reconciliation
  const {
    userDetails,
    broker,
    fetchBrokerOrderBook,
    configData,
    getAllTrades,
  } = useTrade();
  const livePrices = useLTPStore(state => state.ltps);

  // Reconciliation state
  const [isCheckingReconciliation, setIsCheckingReconciliation] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [pendingStockDetails, setPendingStockDetails] = useState(null);
  const [showManualExit, setShowManualExit] = useState(false);
  const [cancellingOrderIds, setCancellingOrderIds] = useState({});
  const displayedTrades = useMemo(
    () => canonicalBasketTrades(basket?.trades).map(trade => {
      const symbols = [
        trade?.tradingSymbol,
        trade?.searchSymbol,
        trade?.Symbol,
        trade?.symbol,
      ].filter(Boolean);
      const currentLtp = symbols
        .map(symbol => Number(livePrices[String(symbol).toUpperCase()]))
        .find(price => Number.isFinite(price) && price > 0);
      return {...trade, currentLtp: currentLtp || null};
    }),
    [basket?.trades, livePrices],
  );
  const inFlightTrades = useMemo(() => {
    return displayedTrades.filter(trade =>
      isBasketInFlightStatus(trade?.trade_place_status) &&
      trade?.cancel !== true && trade?.basketCancelled !== true,
    );
  }, [displayedTrades]);

  // Determine basket status
  const isEdited = basket?.trades?.some(t => t.isEdited === true) || false;
  const basketLifecycle = basket?.basketLifecycle || basket?.trades?.[0]?.basketLifecycle;
  const brokerOwnership = getBasketBrokerOwnership(basketLifecycle, broker);
  const basketName = basket?.basketName || basket?.trades?.[0]?.basketName || null;
  const basketId = basket?.basketId || basket?.trades?.[0]?.basketId || null;
  const basketUserEmail =
    userDetails?.email ||
    userDetails?.user_email ||
    basket?.trades?.[0]?.user_email;
  const isClosureBasket = basketLifecycle?.displayType === 'EXIT_BASKET' ||
    basket?.trades?.some(t => t.isClosure === true) || false;
  const isCancelled = basketLifecycle?.displayStatus === 'CANCELLED';
  const reconciledFlat = displayedTrades.length > 0 &&
    displayedTrades.every(trade => trade?.manualExitReconciled === true);
  const isClosed = basketLifecycle?.displayStatus === 'CLOSED' || reconciledFlat;
  const isClosurePending = basketLifecycle?.displayStatus === 'CLOSURE_PENDING' && !isClosed;
  const isPartialEntry =
    basketLifecycle?.displayStatus === 'PARTIAL_ENTRY' ||
    basketLifecycle?.reason === 'ENTRY_PARTIALLY_EXECUTED';
  // Reason fallback handles resolverVersion 1 payloads during rollout.
  const isCustomerOpenPosition =
    basketLifecycle?.displayStatus === 'POSITION_OPEN' ||
    basketLifecycle?.reason === 'CUSTOMER_HAS_OPEN_EXPOSURE';
  const entryGate = basket?.entryGate || basket?.trades?.[0]?.entryGate;
  const hasConfiguredEntryRange = Boolean(
    Number(entryGate?.lower) > 0 || Number(entryGate?.upper) > 0,
  );
  const [entryAuthorization, setEntryAuthorization] = useState(null);

  // Poll the server decision so quote movements immediately update the card.
  // This also closes the historical mobile hole where a cancelled unopened
  // basket could still be accepted from a stale screen.
  //
  // NOTE: `basket?.trades` is intentionally NOT in the dependency array. The
  // parent re-mints the trades array identity on refresh (LTP ticks, the 45s
  // trades/strategies poll), so depending on it re-ran this effect on every
  // render — the same unbounded authorizeBasketEntry loop that flooded
  // /orders/basket-entry/authorize and wedged ccxt_prod (2026-08-20). The
  // ref keeps the poll cadence at the 15s interval while still sending
  // current leg data. The 15s cadence pairs with the server's 20s Redis
  // decision cache (TTL > poll) so most polls are served from cache.
  const basketTradesRef = useRef(basket?.trades);
  basketTradesRef.current = basket?.trades;
  useEffect(() => {
    if (isClosureBasket || isCancelled || isClosed || !basketUserEmail || !basketId) {
      setEntryAuthorization(null);
      return undefined;
    }
    if (!hasConfiguredEntryRange) {
      setEntryAuthorization({
        allowed: true,
        code: 'NO_GATE',
        message: 'No entry range configured',
        checkedAt: Date.now(),
      });
      return undefined;
    }
    let active = true;
    const refresh = async () => {
      try {
        const decision = await authorizeBasketEntry({
          userEmail: basketUserEmail,
          basketId,
          trades: basketTradesRef.current || [],
          route: 'mobile_basket_card',
          configData,
        });
        if (active) setEntryAuthorization(decision);
      } catch (_) {
        if (active) {
          setEntryAuthorization({
            allowed: false,
            code: 'PRICE_UNAVAILABLE',
            message: 'Entry authorization is unavailable',
          });
        }
      }
    };
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isClosureBasket, isCancelled, isClosed, basketUserEmail, basketId, configData, hasConfiguredEntryRange]);

  const lifecycleBlocksEntry = Boolean(
    basketLifecycle &&
    basketLifecycle.displayType !== 'EXIT_BASKET' &&
    basketLifecycle.entryAllowedByLifecycle === false
  );
  const entryBlocked = !isClosureBasket && (
    lifecycleBlocksEntry || !entryAuthorization || entryAuthorization.allowed !== true
  );
  // A customer can have entered every leg directly with the broker, so this
  // must not depend on Markup-recorded fills or on the basket still being live.
  // Manual reconciliation must remain available whenever there is something to
  // record against this basket: (a) the customer still holds an open position
  // (POSITION_OPEN / CUSTOMER_HAS_OPEN_EXPOSURE) they may have closed directly
  // at the broker, or (b) some legs are not yet system-complete. It must NOT
  // appear on closed/cancelled/reconciled-flat baskets — a fully reconciled
  // basket (net position flat, all legs complete) has nothing left to record,
  // and the modal would dead-end at "already fully reconciled". Mirrors the
  // web BasketCard gating (web BasketCard.js hasReconciliationOpportunity).
  const hasIncompleteLeg = (basket?.trades || []).some(trade =>
    !TERMINAL_COMPLETE_STATUSES.has(String(trade?.trade_place_status || '').toLowerCase()) &&
    trade?.cancel !== true &&
    trade?.basketCancelled !== true,
  );
  const hasReconciliationOpportunity =
    (basket?.trades?.length || 0) > 0 &&
    (isCustomerOpenPosition ||
      isClosurePending ||
      hasIncompleteLeg) &&
    !isClosed &&
    !isCancelled;
  const manualTradeActionLabel = isCustomerOpenPosition || isClosurePending
    ? 'Report a manual exit'
    : 'Report a manual entry or exit';
  const entryProgress = useMemo(() => {
    const live = displayedTrades.filter(trade =>
      trade?.cancel !== true && trade?.basketCancelled !== true,
    );
    const completed = live.filter(trade =>
      TERMINAL_COMPLETE_STATUSES.has(String(trade?.trade_place_status || '').toLowerCase()) &&
      trade?.partial_fill !== true,
    ).length;
    const retryable = live.filter(trade =>
      RETRYABLE_ENTRY_STATUSES.has(String(trade?.trade_place_status || '').toLowerCase()) ||
      trade?.partial_fill === true,
    ).length;
    return {completed, retryable, total: live.length};
  }, [displayedTrades]);

  // Check if basket is expired (any trade has expired derivative symbol)
  const isExpired = basket?.trades?.some(trade => {
    if (trade.Exchange !== 'NFO' && trade.Exchange !== 'BFO') return false;
    const expiryRegex = /(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})/i;
    const match = trade.Symbol?.match(expiryRegex);
    if (!match) return false;

    const day = parseInt(match[1], 10);
    const monthStr = match[2].toUpperCase();
    const yearStr = match[3];
    const monthMap = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
    const monthIndex = monthMap[monthStr];
    const currentYear = new Date().getFullYear();
    const currentCentury = Math.floor(currentYear / 100) * 100;
    let year = currentCentury + parseInt(yearStr, 10);
    if (year < currentYear - 10) year += 100;

    const expiryDate = new Date(year, monthIndex, day, 23, 59, 59, 999);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiryDate < today;
  }) || false;

  const toggleShowMore = () => {
    setShowMore(!showMore);
    setExpandedTrades({});
  };

  const toggleTradeExpansion = (index) => {
    setExpandedTrades(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const firstThreeTrades = showMore ? displayedTrades : displayedTrades.slice(0, 3);
  const remainingCount = displayedTrades.length > 3 ? displayedTrades.length - 3 : 0;

  const mapBasketToStockDetails = (basketItem) => {
    const isRecommend = basketItem.trade_place_status === "recommend" || basketItem.trade_place_status === "RECOMMEND";
    // 2026-08-21: closure mode must come from REAL closure context (advisor
    // exit advice / executed closure), never from the feed's POSITION_OPEN
    // projection (isClosure flag + toTradeQty are stamped on EVERY leg of a
    // symbol the customer holds). Pre-fix, an executed entry leg with a
    // nonzero toTradeQty mapped as a SELL closure row, so a closure basket
    // showed duplicated rows and a recorded 3-lot entry could render as a
    // 3-lot SELL. The feed's isClosure flag is kept only as a second signal
    // when the leg carries no closure fields of its own.
    const isClosure = hasClosureContext(basketItem) || basketItem.isClosure === true;

    const currentHolding = isClosure
      ? (basketItem.currentHolding !== undefined ? basketItem.currentHolding : Math.abs(basketItem.toTradeQty || 0))
      : 0;
    const parsedToTradeQty = Number(basketItem.toTradeQty);
    const hasToTradeQty =
      basketItem.toTradeQty !== undefined &&
      basketItem.toTradeQty !== null &&
      Number.isFinite(parsedToTradeQty);
    // `toTradeQty` is already the signed order required to flatten the net
    // position. A customer-held position has no appended advisor EXIT leg, so
    // using the original advice side here would repeat the entry instead.
    const closureQuantity = hasToTradeQty
      ? Math.abs(Number(basketItem.toTradeQty))
      : (basketItem.Quantity || 1);
    const closureTransactionType = parsedToTradeQty < 0
      ? 'SELL'
      : parsedToTradeQty > 0
        ? 'BUY'
        : (basketItem.Type || 'BUY');

    return {
      exchange: basketItem.Exchange || 'NFO',
      orderType: basketItem.OrderType || basketItem.orderType || basketItem.order_type || 'MARKET',
      productType: basketItem.ProductType || 'CARRYFORWARD',
      quantity: isClosure ? closureQuantity : (basketItem.Quantity || 1),
      segment: basketItem.Segment || 'OPTIONS',
      tradeId: basketItem.tradeId || '',
      priority: basketItem.Priority ?? basketItem.priority ?? 0,
      trade_given_by: basketItem.trade_given_by || '',
      tradingSymbol: basketItem.Symbol || '',
      transactionType: isClosure ? closureTransactionType : (basketItem.Type || 'BUY'),
      // Preserve a broker already recorded on the leg. The old
      // current-broker-first mapping silently relabelled Zerodha basket state
      // as Fyers after an account switch.
      user_broker: basketItem.user_broker || broker || '',
      user_email: basketItem.user_email || '',
      zerodhaTradeId: basketItem.zerodhaTradeId || 'NA',
      price: basketItem.Price || basketItem.LimitPrice || null,
      stopLoss: basketItem.stopLoss || basketItem.sl || null,
      target: basketItem.profitTarget || basketItem.Target || null,
      searchSymbol: basketItem.searchSymbol || basketItem.search_symbol,
      closurestatus: basketItem.closurestatus || (isClosure ? 'fullClose' : undefined),
      purpose: basketItem.purpose || (isClosure ? 'EXIT' : 'ENTRY'),
      basketId: basketItem.basketId,
      basketName: basketItem.basketName,
      // Legacy persisted convention: Quantity is the lot COUNT; `Lots` is the
      // contract lot SIZE. Quantity=1 + Lots=65 means one lot / 65 units.
      // Preserve this on EXIT legs so broker fills of 65 are not read as 65 lots.
      Lots: basketItem.Lots || basketItem.lots || 1,
      isClosure: isClosure,
      toTradeQty: basketItem.toTradeQty,
      currentHolding: currentHolding,
      trade_place_status: basketItem.trade_place_status,
      partial_fill: basketItem.partial_fill,
      filledQty: basketItem.filledQty,
      remainingQty: basketItem.remainingQty,
      remainingQtyUnit: basketItem.remainingQtyUnit,
      orderStatusMessage: basketItem.orderStatusMessage,
    };
  };

  const hasClosureTrades = () => {
    return basket?.trades?.some(trade => isClosureTrade(trade));
  };

  const proceedWithTrade = async (stockDetails) => {
    if (!stockDetails?.length) {
      Toast.show({
        type: 'error',
        text1: 'Basket details are unavailable',
        text2: 'Refresh recommendations and try again.',
      });
      return;
    }
    setbasketId(basketId);
    setbasketName(basketName);
    setisBasket(true);
    fullsetBasketData(basket?.trades);
    // ReviewTradeModal chooses its basket renderer and order rows from
    // `basketData` (not `stockDetails`). Keep both states in sync with the
    // mapped executable legs; otherwise basket taps fall through to the
    // ordinary cart UI and show "No Orders to Place".
    setBasketData(stockDetails);
    setStockDetails(stockDetails);
    // Normal entry baskets also perform a network-fresh broker/funds probe
    // before the review modal opens. Surface that wait; previously only the
    // closure reconciliation path set this state, so an ordinary basket with
    // no range-confirmation dialog appeared to ignore the tap.
    setIsCheckingReconciliation(true);
    try {
      await handleTradeBasket(stockDetails);
    } catch (error) {
      console.error('[BasketCard] Unable to open basket review:', error);
      Toast.show({
        type: 'error',
        text1: 'Unable to open basket',
        text2: 'Please retry in a moment.',
      });
    } finally {
      setIsCheckingReconciliation(false);
    }
  };

  const handleWarningModalConfirm = async (userChoices) => {
    try {
      setIsCheckingReconciliation(true);

      const {applyUserResolutions} = require('../../services/ReconciliationService');
      const resolvedResult = applyUserResolutions(reconciliationResult, userChoices);

      if (resolvedResult.ordersToCancel?.length > 0 && userDetails) {
        const credentials = {
          clientCode: userDetails.clientCode,
          apiKey: userDetails.apiKey,
          jwtToken: userDetails.jwtToken,
          secretKey: userDetails.secretKey,
          sid: userDetails.sid,
          viewToken: userDetails.viewToken,
          serverId: userDetails.serverId,
        };

        for (const orderToCancel of resolvedResult.ordersToCancel) {
          console.log('[BasketCard] Cancelling order:', orderToCancel.orderId);
          await cancelOrder(broker, credentials, orderToCancel.orderId, {
            variety: orderToCancel.variety,
          }, configData);
        }
      }

      const tradesToPlaceDetails = resolvedResult.tradesToPlace.map(trade => ({
        ...mapBasketToStockDetails(trade),
        quantity: trade.quantity || trade.Quantity,
        wasAdjusted: trade.wasAdjusted,
        needsRefresh: trade.needsRefresh,
      }));

      setShowWarningModal(false);
      setReconciliationResult(null);

      if (tradesToPlaceDetails.length > 0) {
        proceedWithTrade(tradesToPlaceDetails);
      } else {
        console.log('[BasketCard] All trades skipped, no orders to place');
      }
    } catch (error) {
      console.error('[BasketCard] Error applying resolutions:', error);
    } finally {
      setIsCheckingReconciliation(false);
    }
  };

  const handleWarningModalCancelAll = () => {
    setShowWarningModal(false);
    setReconciliationResult(null);
    setPendingStockDetails(null);
    console.log('[BasketCard] User cancelled all trades');
  };

  const requestPendingOrderCancel = async (trade, suppliedIdentity) => {
    const identity = suppliedIdentity || basketOrderIdentity(trade, basketId, broker);
    const {orderId} = identity;
    if (!identity.canCancel || cancellingOrderIds[orderId]) return;
    setCancellingOrderIds(previous => ({...previous, [orderId]: true}));
    try {
      const result = await cancelPendingBasketOrder({
        broker: identity.broker,
        userEmail: basketUserEmail,
        order: trade,
        basketId: identity.basketId,
        tradeId: identity.tradeId,
        mutationId: [
          'mobile-basket-cancel', identity.basketId, identity.tradeId, orderId,
        ].join('-'),
        configData,
      });
      if (result?.terminal === true) {
        Toast.show({
          type: 'success',
          text1: 'Order cancellation confirmed',
          text2: 'Refreshing the basket. Retry will include only unfinished quantity.',
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Cancellation requested',
          text2: 'Retry remains blocked until the broker confirms cancellation.',
        });
      }
      await Promise.resolve(getAllTrades?.());
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Could not cancel the pending order',
        text2: error?.response?.data?.message || error?.message || 'Check your broker app and refresh.',
      });
    } finally {
      setCancellingOrderIds(previous => {
        const next = {...previous};
        delete next[orderId];
        return next;
      });
    }
  };

  const confirmPendingOrderCancel = (trade, identity) => {
    const symbol = trade?.Symbol || trade?.symbol || trade?.tradingSymbol || 'this leg';
    Alert.alert(
      'Cancel pending broker order?',
      'Cancel the live order for ' + symbol + '. Retry stays blocked until the broker confirms a terminal cancellation.',
      [
        {text: 'Keep order', style: 'cancel'},
        {text: 'Cancel order', style: 'destructive', onPress: () => requestPendingOrderCancel(trade, identity)},
      ],
    );
  };

  const handleTradeNowBasket = async () => {
    if (isClosureBasket && brokerOwnership.mismatch) {
      Toast.show({
        type: 'error',
        text1: `Switch to ${brokerOwnership.positionBroker || 'the position broker'}`,
        text2: `This basket position is not held in ${broker}. No exit order was sent.`,
        visibilityTime: 7000,
      });
      return;
    }
    if (isClosureBasket && brokerOwnership.ambiguous) {
      Toast.show({
        type: 'error',
        text1: 'Basket spans multiple brokers',
        text2: 'Reconcile the broker positions before placing an exit.',
        visibilityTime: 7000,
      });
      return;
    }
    // Holding a position is not an advisor exit recommendation. Keep this
    // guard even though the presentation has no CTA, so stale accessibility
    // events cannot open the order flow during a refresh.
    if (isCustomerOpenPosition) {
      Toast.show({
        type: 'info',
        text1: 'Position is open',
        text2: 'Manager has not recommended an exit.',
      });
      return;
    }

    // The card poll already owns the authorization that enables this CTA.
    // A second blocking request here made an enabled button appear dead when
    // the network briefly timed out. BasketTradeModal obtains a fresh decision
    // and the order endpoint authorizes again before any broker mutation.
    if (!isClosureBasket && !(await confirmOutOfRange(entryAuthorization))) return;

    // 2026-08-21: the trade flow operates on the live legs only — retired
    // manual-entry advice rows are history, and in closure mode only the
    // advisor's closure legs (real closure context) are actionable. Without
    // this, a recorded 3-lot entry on a 1-lot advice passed into the modal
    // as an extra (and wrongly SELL-mapped) row.
    const flowTrades = (basket?.trades || [])
      .filter((item) => !isRetiredEntryLeg(item))
      .filter((item) => {
        if (isClosureBasket) return hasClosureContext(item);
        const status = String(item?.trade_place_status || '').toLowerCase();
        return (RETRYABLE_ENTRY_STATUSES.has(status) || item?.partial_fill === true) &&
          item?.cancel !== true && item?.basketCancelled !== true;
      });
    const stockDetails = flowTrades
      .map((item) => ({
        ...mapBasketToStockDetails(item),
      }))
      .sort((a, b) => Number(a.priority) - Number(b.priority));

    const basketHasClosures = hasClosureTrades();
    if (basketHasClosures && broker) {
      setIsCheckingReconciliation(true);

      try {
        const {orders: allOrders} = await fetchBrokerOrderBook(true);

        console.log('[BasketCard] Fetched', allOrders?.length || 0, 'orders for reconciliation');

        const result = reconcileBasket(stockDetails, allOrders || []);

        if (result.hasConflicts) {
          console.log('[BasketCard] Conflicts detected:', result.conflicts.length);
          result.conflicts.forEach(c => console.log('[BasketCard] Conflict:', c.type, c.closureTrade?.symbol));
          setReconciliationResult(result);
          setPendingStockDetails(stockDetails);
          setShowWarningModal(true);
          setIsCheckingReconciliation(false);
          return;
        }

        setIsCheckingReconciliation(false);
        proceedWithTrade(stockDetails);
      } catch (error) {
        console.error('[BasketCard] Reconciliation check error:', error);
        setIsCheckingReconciliation(false);
        proceedWithTrade(stockDetails);
      }
    } else {
      proceedWithTrade(stockDetails);
    }
  };

  const date = basket?.trades?.[0]?.date || new Date();
  const closedAt = basketLifecycle?.closedAt || null;

  // Determine gradient colors based on basket type
  const getGradientColors = () => {
    if (isExpired) return ['rgba(100, 100, 100, 1)', 'rgba(150, 150, 150, 1)'];
    if (isCustomerOpenPosition) return [designColor('000c18'), designColor('002c59'), designColor('000c18')];
    // A closure/exit basket is an action, not a loss — teal, not red
    // (product 2026-08-21).
    if (isClosureBasket || isClosed || isCancelled) {
      return [designColor('0f3d3e'), designColor('134e4a'), designColor('0f3d3e')];
    }
    return [designColor('000c18'), designColor('002c59'), designColor('000c18')];
  };

  const isRegularBasket =
    !isExpired &&
    (!isClosureBasket || isCustomerOpenPosition) &&
    !isCancelled &&
    !isClosed;

  // ---------- presentation delegation ----------
  const BasketCardPresentation = useComponent('composites.BasketCard');

  const viewModel = {
    basketName: basketName || 'Basket',
    basketId,
    date,
    closedAt,
    isEdited,
    isClosureBasket,
    isExpired,
    isRegularBasket,
    isCancelled,
    isClosed,
    isClosurePending,
    isPartialEntry,
    isCustomerOpenPosition,
    brokerMismatch: isClosureBasket && brokerOwnership.mismatch,
    brokerOwnershipAmbiguous: isClosureBasket && brokerOwnership.ambiguous,
    positionBroker: brokerOwnership.positionBroker,
    currentBroker: broker,
    managerClosed:
      basketLifecycle?.reason === 'MANAGER_CLOSED_ZERO_FILL',
    entryBlocked,
    entryChecking: !isClosureBasket && !entryAuthorization,
    entryGateMessage: entryBlocked
      ? lifecycleBlocksEntry
        ? 'Reconciliation pending'
        : basketEntryGateMessage(entryAuthorization)
      : null,
    entryRangeWarning: requiresOutOfRangeConfirmation(entryAuthorization)
      ? basketEntryGateMessage(entryAuthorization)
      : null,
    gradientColors: getGradientColors(),
    trades: displayedTrades,
    firstThreeTrades,
    remainingCount,
    showMore,
    expandedTrades,
    isCheckingReconciliation,
    basket,
    entryProgress,
    actionLabel: isPartialEntry && entryProgress.total > 1
      ? `Retry ${entryProgress.retryable} of ${entryProgress.total} legs`
      : null,
  };

  const actions = {
    onToggleShowMore: toggleShowMore,
    onToggleTradeExpansion: toggleTradeExpansion,
    onTradeNowBasket: handleTradeNowBasket,
    onCancelBasket,
  };

  const slots = {
    BasketRunningProfitSlot: <BasketRunningProfit basket={basket} />,
    PendingOrderWarningSlot: (
      <PendingOrderWarningModal
        visible={showWarningModal}
        conflicts={reconciliationResult?.conflicts || []}
        onClose={() => {
          setShowWarningModal(false);
          setReconciliationResult(null);
        }}
        onConfirm={handleWarningModalConfirm}
        onCancelAll={handleWarningModalCancelAll}
        isLoading={isCheckingReconciliation}
      />
    ),
  };

  return (
    <View>
      <BasketCardPresentation viewModel={viewModel} actions={actions} slots={slots} />
      {inFlightTrades.length > 0 && !isCancelled && !isClosed && (
        <PendingBasketOrdersPanel
          trades={inFlightTrades}
          basketId={basketId}
          broker={broker}
          cancellingOrderIds={cancellingOrderIds}
          onCancel={confirmPendingOrderCancel}
        />
      )}
      {hasReconciliationOpportunity && !brokerOwnership.mismatch && !brokerOwnership.ambiguous && (
        <TouchableOpacity style={manualExitStyles.button} onPress={() => setShowManualExit(true)}>
          <Text style={manualExitStyles.text}>{manualTradeActionLabel}</Text>
        </TouchableOpacity>
      )}
      <ManualBasketExitModal
        visible={showManualExit}
        basketId={basketId}
        configData={configData}
        onClose={() => setShowManualExit(false)}
        onSuccess={getAllTrades}
      />
    </View>
  );
};

const manualExitStyles = StyleSheet.create({
  button: {alignSelf: 'flex-end', marginRight: 12, marginTop: -2, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 6},
  text: {fontSize: 11, color: designColor('b91c1c'), textDecorationLine: 'underline', fontWeight: '600'},
});

export default BasketCard;
