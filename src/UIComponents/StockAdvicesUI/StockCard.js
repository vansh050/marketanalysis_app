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
import {Animated} from 'react-native';
import useLTPStore from '../../components/AdviceScreenComponents/DynamicText/useLtpStore';
import {useNavigation} from '@react-navigation/native';
import {useConfig} from '../../context/ConfigContext';
import {isSellAuthRejection} from '../../utils/sellAuthMessage';
import {getBrokerDdpiHelp} from '../../config/brokerDdpiHelp';
import useModalStore from '../../GlobalUIModals/modalStore';
import {useComponent} from '../../design/useDesign';

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
    const price = useLTPStore(state => state.ltps[symbol]);

    // P&L and Change% calculation (matching web app logic)
    const entryPrice = parseFloat(advisedPrice) || 0;
    const ltp = parseFloat(price) || 0;
    const pnl = ltp && entryPrice ? ltp - entryPrice : null;
    const changePercent = ltp && entryPrice ? ((ltp - entryPrice) / entryPrice) * 100 : null;
    const formattedPlanName = planName
      ? planName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      : null;

    // Calculate advisedRangeCondition using the price from context
    const advisedRangeCondition = React.useMemo(() => {
      if (price === null) return true;

      return (
        (advisedRangeHigher === 0 && advisedRangeLower === 0) ||
        (advisedRangeHigher === null && advisedRangeLower === null) ||
        (advisedRangeHigher > 0 &&
          advisedRangeLower > 0 &&
          Number.parseFloat(advisedRangeHigher) >= Number.parseFloat(price) &&
          Number.parseFloat(price) >= Number.parseFloat(advisedRangeLower)) ||
        (advisedRangeHigher > 0 &&
          advisedRangeLower === 0 &&
          advisedRangeLower === null &&
          Number.parseFloat(advisedRangeHigher) >= Number.parseFloat(price)) ||
        (advisedRangeLower > 0 &&
          advisedRangeHigher === 0 &&
          advisedRangeHigher === null &&
          Number.parseFloat(advisedRangeLower) <= Number.parseFloat(price))
      );
    }, [price, advisedRangeHigher, advisedRangeLower]);

    // Get dynamic config from API
    const config = useConfig();
    const themeColor = config?.themeColor || '#0056B7';
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
      handleSelectStock(sym, tid, act);
    };

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(animatedHeight, {
        toValue: isExpanded ? 170 : 170,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }, [isExpanded]);

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
      onTradePress: handleTradePress,
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
    };

    return <StockCardPresentation viewModel={viewModel} actions={actions} />;
  },
);

export default StockCard;
