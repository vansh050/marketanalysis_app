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

import React, { useState, useEffect } from 'react';
import BasketRunningProfit from '../../components/AdviceScreenComponents/DynamicText/BasketRunningProfit';
import {useTrade} from '../../screens/TradeContext';
import {reconcileBasket, isClosureTrade} from '../../services/ReconciliationService';
import PendingOrderWarningModal from '../../components/PendingOrderWarningModal';
import {cancelOrder} from '../../services/BrokerOrderBookAPI';
import {useComponent} from '../../design/useDesign';

const BasketCard = ({
  basket,
  setStockDetails,
  handleTradeNow,
  setisBasket,
  setbasketId,
  setbasketName,
  fullsetBasketData,
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
  } = useTrade();

  // Reconciliation state
  const [isCheckingReconciliation, setIsCheckingReconciliation] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState(null);
  const [pendingStockDetails, setPendingStockDetails] = useState(null);

  // Determine basket status
  const isEdited = basket?.trades?.some(t => t.isEdited === true) || false;
  const isClosureBasket = basket?.trades?.some(t => t.isClosure === true) || false;

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

  const basketName = basket?.trades?.length > 0 ? basket.trades[0].basketName : null;
  const basketId = basket?.trades?.length > 0 ? basket.trades[0].basketId : null;

  const firstThreeTrades = showMore ? basket?.trades || [] : (basket?.trades || []).slice(0, 3);
  const remainingCount = basket?.trades?.length > 3 ? basket.trades.length - 3 : 0;

  const mapBasketToStockDetails = (basketItem) => {
    const isRecommend = basketItem.trade_place_status === "recommend" || basketItem.trade_place_status === "RECOMMEND";
    const hasToTradeQty = basketItem.toTradeQty !== undefined && basketItem.toTradeQty !== null && basketItem.toTradeQty !== 0;
    const hasClosureStatus = basketItem.closurestatus && basketItem.closurestatus !== "";
    const isClosure = basketItem.isClosure === true || hasClosureStatus || (hasToTradeQty && !isRecommend);

    const currentHolding = isClosure
      ? (basketItem.currentHolding !== undefined ? basketItem.currentHolding : Math.abs(basketItem.toTradeQty || 0))
      : 0;

    return {
      exchange: basketItem.Exchange || 'NFO',
      orderType: basketItem.OrderType || basketItem.orderType || basketItem.order_type || 'MARKET',
      productType: basketItem.ProductType || 'CARRYFORWARD',
      quantity: basketItem.Quantity || 1,
      segment: basketItem.Segment || 'OPTIONS',
      tradeId: basketItem.tradeId || '',
      priority: basketItem.Priority || 0,
      trade_given_by: basketItem.trade_given_by || '',
      tradingSymbol: basketItem.Symbol || '',
      transactionType: basketItem.Type || 'BUY',
      user_broker: broker || basketItem.user_broker || '',
      user_email: basketItem.user_email || '',
      zerodhaTradeId: basketItem.zerodhaTradeId || 'NA',
      price: basketItem.Price || basketItem.LimitPrice || null,
      stopLoss: basketItem.stopLoss || basketItem.sl || null,
      target: basketItem.profitTarget || basketItem.Target || null,
      searchSymbol: basketItem.searchSymbol || basketItem.search_symbol,
      closurestatus: basketItem.closurestatus || (isClosure ? 'fullClose' : undefined),
      basketId: basketItem.basketId,
      basketName: basketItem.basketName,
      Lots: basketItem.Lots || basketItem.lots || 1,
      isClosure: isClosure,
      toTradeQty: basketItem.toTradeQty,
      currentHolding: currentHolding,
    };
  };

  const hasClosureTrades = () => {
    return basket?.trades?.some(trade => isClosureTrade(trade));
  };

  const proceedWithTrade = (stockDetails) => {
    setbasketId(basketId);
    setbasketName(basketName);
    setisBasket(true);
    fullsetBasketData(basket?.trades);
    setStockDetails(stockDetails);
    handleTradeBasket(stockDetails);
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

  const handleTradeNowBasket = async () => {
    const stockDetails = basket?.trades?.map((item) => ({
      ...mapBasketToStockDetails(item),
    })) || [];

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

  // Determine gradient colors based on basket type
  const getGradientColors = () => {
    if (isExpired) return ['rgba(100, 100, 100, 1)', 'rgba(150, 150, 150, 1)'];
    if (isClosureBasket) return ['rgba(139, 0, 0, 1)', 'rgba(200, 50, 50, 1)'];
    return ['#000C18', '#002C59', '#000C18'];
  };

  const isRegularBasket = !isExpired && !isClosureBasket;

  // ---------- presentation delegation ----------
  const BasketCardPresentation = useComponent('composites.BasketCard');

  const viewModel = {
    basketName: basketName || 'Basket',
    basketId,
    date,
    isEdited,
    isClosureBasket,
    isExpired,
    isRegularBasket,
    gradientColors: getGradientColors(),
    trades: basket?.trades || [],
    firstThreeTrades,
    remainingCount,
    showMore,
    expandedTrades,
    isCheckingReconciliation,
    basket,
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

  return <BasketCardPresentation viewModel={viewModel} actions={actions} slots={slots} />;
};

export default BasketCard;
