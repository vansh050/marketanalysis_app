/**
 * StockCard — container (Phase G batch 4, 2026-05-02)
 *
 * Owns: useLTPStore (Zustand live LTP), useConfig (theme), useNavigation,
 * useModalStore, Animated.Value refs + useEffect coupling,
 * advisedRangeCondition useMemo (8+ conditions), formatSymbol helper.
 *
 * Renders presentation resolved from `composites.StockCard`.
 */

import React, {useState, useEffect, useRef} from 'react';
import {Animated, Alert} from 'react-native';
import useLTPStore from '../../components/AdviceScreenComponents/DynamicText/useLtpStore';
import {useNavigation} from '@react-navigation/native';
import {useConfig} from '../../context/ConfigContext';
import {isSellAuthRejection} from '../../utils/sellAuthMessage';
import {getBrokerDdpiHelp} from '../../config/brokerDdpiHelp';
import useModalStore from '../../GlobalUIModals/modalStore';
import {useComponent} from '../../design/useDesign';
import StandaloneManualPlacementModal from '../../components/StandaloneManualPlacementModal';
import {useTrade} from '../../screens/TradeContext';
import {
  calculateRecommendationPnl,
  getRecommendedEntryPrice,
  getRecommendedRange,
  isPriceInRecommendedRange,
} from '../../utils/recommendationPnl';
import BlurredComponent from '../../components/GlassmorphicText';
import PriceTextAdvice from '../../components/AdviceScreenComponents/DynamicText/PriceTextAdvice';

import { designColor } from '../../design/literalTokens';

const StockCard = React.memo(
  ({
    id = '',
    symbol = '',
    planList,
    rationale = '',
    OrderType = '',
    OptionType = '',
    segment = '',
    strike = '',
    searchSymbol = '',
    Exchange = '',
    closurestatus,
    advisedRangeLower = '',
    advisedRangeHigher = '',
    Price = '',
    cmp = '',
    action = '',
    quantity = 1,
    type,
    date = new Date(),
    getLTPForSymbol,
    advisedPrice,
    advisedPriceByAdvisor,
    pnlRangeActivated = false,
    onPnlRangeActivate = () => {},
    stockRecoNotExecuted,
    stopLoss,
    profitTarget,
    isSelected = false,
    handleSelectStock = () => {},
    handleDecreaseStockQty = () => {},
    handleIncreaseStockQty = () => {},
    handleTradePress = () => {},
    handleRevertTrades = () => {},
    handleIgnoreTradePress = () => {},
    handleLimitOrderInputChange = () => {},
    handleQuantityInputChange = () => {},
    tradeId = '',
    index,
    isExpanded,
    onToggleExpand,
    tradePlaceStatus,
    isOpenPosition = false,
    tradedQty,
    tradedPrice,
    positionBroker,
    rejectionMessage,
    rejectionClassification,
    rejectionBroker,
    planName,
    positionStatus,
    animatedHeight,
    cancel,
    edit,
    fileUrls = [],
  }) => {
    const [showAttachmentModal, setShowAttachmentModal] = useState(false);
    const [showManualPlacement, setShowManualPlacement] = useState(false);
    const {getAllTrades, broker} = useTrade();
    const [isPnlActivated, setIsPnlActivated] = useState(
      Boolean(pnlRangeActivated),
    );
    const price = useLTPStore(state => state.ltps[symbol]);

    const {hasRange: hasRecommendedRange} = getRecommendedRange(
      advisedRangeLower,
      advisedRangeHigher,
    );
    const entryPrice = getRecommendedEntryPrice({
      recommendedPrice: Price,
      advisedRangeLower,
      advisedRangeHigher,
      action,
    });
    const ltp = Number.parseFloat(price);
    const advisedRangeCondition = isPriceInRecommendedRange(
      price,
      advisedRangeLower,
      advisedRangeHigher,
    );
    const pnlIsActive = !hasRecommendedRange || isPnlActivated;
    const {pnl, changePercent} = calculateRecommendationPnl({
      ltp,
      entryPrice,
      action,
      isActivated: pnlIsActive,
    });
    const formattedPlanName = planName
      ? planName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      : null;

    useEffect(() => {
      setIsPnlActivated(Boolean(pnlRangeActivated));
    }, [id, pnlRangeActivated]);

    useEffect(() => {
      if (
        hasRecommendedRange &&
        !isPnlActivated &&
        advisedRangeCondition &&
        Number.isFinite(ltp)
      ) {
        setIsPnlActivated(true);
        onPnlRangeActivate({id, marketPrice: ltp});
      }
    }, [
      advisedRangeCondition,
      hasRecommendedRange,
      id,
      isPnlActivated,
      ltp,
      onPnlRangeActivate,
    ]);

    // Get dynamic config from API
    const config = useConfig();
    const themeColor = config?.themeColor || designColor('0056b7');
    const CardborderWidth = config?.CardborderWidth || 0;
    const cardElevation = config?.cardElevation || 3;
    const cardverticalmargin = config?.cardverticalmargin || 3;

    const [loadingcart, setloadingcart] = useState(false);
    const navigation = useNavigation();

    const formatSymbol = sym => {
      const regex = /(.*?)(\d{2}[A-Z]{3}\d{2})(\d+)(CE|PE)$/;
      const match = sym.match(regex);
      if (match) {
        return `${match[1]}${match[2]} | ${match[3]} | ${match[4]}`;
      }
      return sym;
    };

    const handleAddToCart = (sym, tid, act) => {
      // Removing from cart is a rollback — never gate it on the advised range.
      if (act === 'remove') {
        handleSelectStock(sym, tid, act);
        return;
      }
      if (!confirmOutOfRangePlacement()) return;
      handleSelectStock(sym, tid, act);
    };

    // Soft-warning gate for single-stock equity/derivative cards (2026-08-20).
    // An out-of-range quote is advisory, not a block: the customer is told the
    // current price sits outside the manager's advised range and may still
    // choose to continue. Mirrors the basket entry-gate behaviour.
    const confirmOutOfRangePlacement = () => {
      if (advisedRangeCondition) return true;
      return new Promise(resolve => {
        Alert.alert(
          'Price outside advised range',
          'The current price is outside the manager\'s advised range. You may still place this trade, but the execution price can differ from the recommendation.',
          [
            {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
            {text: 'Continue', onPress: () => resolve(true)},
          ],
          {cancelable: true, onDismiss: () => resolve(false)},
        );
      });
    };

    const handleTradePressWithRangeCheck = (...args) => {
      if (!confirmOutOfRangePlacement()) return;
      handleTradePress(...args);
    };

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(animatedHeight, {
        toValue: isExpanded ? 170 : 170,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }, [animatedHeight, isExpanded]);

    const ltpRef = useRef(null);

    // Compute display symbol
    const formattedSymbol = formatSymbol(symbol);
    const parts = formattedSymbol.split(' | ');
    const displaySymbol = parts.join(' | ');

    // Check DDPI help visibility for rejection
    const showDdpiHelp = type === 'OSrejected' && rejectionMessage &&
      isSellAuthRejection(rejectionMessage, rejectionClassification) &&
      getBrokerDdpiHelp(rejectionBroker);

    // ---------- presentation delegation ----------
    const StockCardPresentation = useComponent('composites.StockCard');

    const viewModel = {
      symbol,
      id,
      tradeId,
      index,
      displaySymbol,
      formattedPlanName,
      positionStatus,
      action,
      type,
      date,
      price,
      entryPrice,
      ltp,
      pnl,
      changePercent,
      pnlIsActive,
      hasRecommendedRange,
      advisedPrice,
      advisedPriceByAdvisor,
      advisedRangeLower,
      advisedRangeHigher,
      advisedRangeCondition,
      OrderType,
      OptionType,
      segment,
      strike,
      searchSymbol,
      Exchange,
      Price,
      cmp,
      quantity,
      stopLoss,
      profitTarget,
      closurestatus,
      isSelected,
      isExpanded,
      planList,
      cancel,
      edit,
      tradePlaceStatus,
      isOpenPosition,
      tradedQty,
      tradedPrice,
      positionBroker,
      rejectionMessage,
      rejectionClassification,
      rejectionBroker: showDdpiHelp ? rejectionBroker : null,
      animatedHeight,
      translateY,
      themeColor,
      loadingcart,
      fileUrls,
      showAttachmentModal,
      stockRecoNotExecuted,
    };

    const actions = {
      onToggleExpand: onToggleExpand,
      onSelectStock: handleSelectStock,
      onDecreaseQty: handleDecreaseStockQty,
      onIncreaseQty: handleIncreaseStockQty,
      onTradePress: handleTradePressWithRangeCheck,
      onRevertTrades: handleRevertTrades,
      onIgnoreTradePress: handleIgnoreTradePress,
      onLimitOrderInputChange: handleLimitOrderInputChange,
      onQuantityInputChange: handleQuantityInputChange,
      onAddToCart: handleAddToCart,
      onNavigateModelPortfolio: () => navigation.navigate('Model Portfolio'),
      onOpenAttachmentModal: () => setShowAttachmentModal(true),
      onCloseAttachmentModal: () => setShowAttachmentModal(false),
      onOpenDdpiHelp: (broker) =>
        useModalStore.getState().openModal('DdpiHelp', {broker}),
      onOpenManualPlacement: () => setShowManualPlacement(true),
    };

    return <>
      <StockCardPresentation
        viewModel={viewModel}
        actions={actions}
        slots={{BlurredComponent, PriceTextAdvice}}
      />
      <StandaloneManualPlacementModal
        visible={showManualPlacement}
        trade={{id, symbol, action, quantity}}
        broker={broker}
        configData={config}
        onClose={() => setShowManualPlacement(false)}
        onSuccess={getAllTrades}
      />
    </>;
  },
);

export default StockCard;
