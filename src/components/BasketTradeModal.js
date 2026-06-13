/**
 * BasketTradeModal — container (Phase H, 2026-05-02)
 *
 * Owns all business logic: quantity management (individual + multiplier),
 * closure basket handling, AsyncStorage cart operations, WebSocket price
 * integration, event emitter coordination, fix-size calculation.
 * Delegates rendering to the design-system presentation resolved as
 * `composites.BasketTradeModal`.
 *
 * Legacy prop signature preserved:
 *   { visible, onClose, stockDetails, setStockDetails, placeOrder,
 *     funds, loading, cartCount, setCartCount, getCartAllStocks,
 *     handleSelectStock, broker }
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLastKnownPrice } from './AdviceScreenComponents/DynamicText/websocketPrice';
import ReviewTradeText from './AdviceScreenComponents/ReviewTradeText';
import { useTotalAmount } from './AdviceScreenComponents/DynamicText/websocketPrice';
import eventEmitter from './EventEmitter';
import { useTrade } from '../screens/TradeContext';
import { getAdvisorSubdomain } from '../utils/variantHelper';
import SliderButton from './SliderButton';
import { useComponent } from '../design/useDesign';

const BasketTradeModal = ({
    visible,
    onClose,
    stockDetails,
    setStockDetails,
    placeOrder,
    funds,
    loading,
    cartCount,
    setCartCount,
    getCartAllStocks,
    handleSelectStock,
    broker,
}) => {
    const Presentation = useComponent('composites.BasketTradeModal');
    const { configData } = useTrade();
    const [isBasket, setisBasket] = useState(false);
    const isBasketp = stockDetails.some((item) => item.source === 'BasketStock');

    // Detect if this is a closure basket
    const isClosureBasket = useMemo(() => {
        return stockDetails.some((item) => item.isClosure === true);
    }, [stockDetails]);

    // Individual quantities for closure baskets
    const [closureQuantities, setClosureQuantities] = useState({});

    // Initialize closure quantities when stockDetails changes
    useEffect(() => {
        if (isClosureBasket) {
            const initialQuantities = {};
            stockDetails.forEach((stock) => {
                if (stock.isClosure) {
                    const qtyToClose = Math.abs(stock.toTradeQty || stock.quantity || 1);
                    initialQuantities[stock.tradeId] = qtyToClose;
                }
            });
            setClosureQuantities(initialQuantities);
        }
    }, [stockDetails, isClosureBasket]);

    useEffect(() => {
        if (isBasketp) {
            setisBasket(true);
        }
    }, [isBasketp]);

    // Closure quantity handlers
    const handleClosureQtyIncrease = (tradeId, maxQty) => {
        setClosureQuantities((prev) => ({
            ...prev,
            [tradeId]: Math.min((prev[tradeId] || 0) + 1, maxQty),
        }));
    };

    const handleClosureQtyDecrease = (tradeId) => {
        setClosureQuantities((prev) => ({
            ...prev,
            [tradeId]: Math.max((prev[tradeId] || 0) - 1, 1),
        }));
    };

    const handleClosureQtyChange = (tradeId, value, maxQty) => {
        const newQty = parseInt(value) || 0;
        setClosureQuantities((prev) => ({
            ...prev,
            [tradeId]: Math.min(Math.max(newQty, 0), maxQty),
        }));
    };

    // Strip 'source' field from BasketStock items
    const updatedStockDetails = stockDetails.map((item) => {
        if (item.source === 'BasketStock') {
            const { source, ...rest } = item;
            return rest;
        }
        return item;
    });
    const isStockDetailsChanged =
        JSON.stringify(updatedStockDetails) !== JSON.stringify(stockDetails);
    if (isStockDetailsChanged) {
        setStockDetails(updatedStockDetails);
    }

    const [multiplier, setMultiplier] = useState('1');
    const [totalQuantity, setTotalQuantity] = useState(1);
    const baseQuantitiesRef = useRef({});

    // Initialize base quantities and check ImpliedMultiplier
    useEffect(() => {
        if (
            !isClosureBasket &&
            stockDetails?.length > 0 &&
            Object.keys(baseQuantitiesRef.current).length === 0
        ) {
            const baseQtys = {};
            stockDetails.forEach((item) => {
                baseQtys[item.tradeId] = item.quantity || 1;
            });
            baseQuantitiesRef.current = baseQtys;

            // B-24 (2026-05-19 mobile migration): clamp ImpliedMultiplier
            // to >= 1 before pushing into state. A partial-fill leg written
            // pre-B-9 (or any leg the broker filled with ImpliedMultiplier=0
            // because tradedQty was sub-Quantity) used to leak "0" into
            // the multiplier input. From "0" the + button took two clicks
            // to reach "2" (0→1→2). Reading anything < 1 falls back to the
            // existing "1" default.
            const tradeWithImpliedMultiplier = stockDetails.find((item) => {
                const v = item?.ImpliedMultiplier;
                if (v === undefined || v === null || v === '') return false;
                const n = parseInt(v, 10);
                return !isNaN(n) && n >= 1;
            });
            if (tradeWithImpliedMultiplier && multiplier === '1') {
                const v = parseInt(tradeWithImpliedMultiplier.ImpliedMultiplier, 10);
                setMultiplier(String(Math.max(1, v)));
            }
        }
    }, [stockDetails, isClosureBasket]);

    useEffect(() => {
        eventEmitter.emit('MODAL_STATE', visible);
        if (!visible) {
            baseQuantitiesRef.current = {};
            setTotalQuantity(1);
        }
    }, [visible]);

    // Individual quantity handlers
    const handleIncreaseStockQty = (symbol, tradeId) => {
        const newData = stockDetails.map((stock) =>
            stock.tradingSymbol === symbol && stock.tradeId === tradeId
                ? { ...stock, quantity: stock.quantity + 1 }
                : stock,
        );
        setStockDetails(newData);
    };

    const handleDecreaseStockQty = (symbol, tradeId) => {
        const newData = stockDetails.map((stock) =>
            stock.tradingSymbol === symbol && stock.tradeId === tradeId
                ? { ...stock, quantity: Math.max(stock.quantity - 1, 0) }
                : stock,
        );
        setStockDetails(newData);
    };

    const handleQuantityInputChange = (symbol, value, tradeId) => {
        const newQuantity = parseInt(value) || 0;
        const newData = stockDetails.map((stock) =>
            stock.tradingSymbol === symbol && stock.tradeId === tradeId
                ? { ...stock, quantity: newQuantity }
                : stock,
        );
        setStockDetails(newData);
    };

    // Multiplier handlers
    const applyMultiplierToStockDetails = (newMultiplier) => {
        const newData = stockDetails.map((stock) => {
            const baseQty =
                baseQuantitiesRef.current[stock.tradeId] || stock.quantity || 1;
            return { ...stock, quantity: baseQty * newMultiplier };
        });
        setStockDetails(newData);
    };

    const handleIncreaseAllStockQty = () => {
        const newMultiplier = totalQuantity + 1;
        setTotalQuantity(newMultiplier);
        applyMultiplierToStockDetails(newMultiplier);
    };

    const handleDecreaseAllStockQty = () => {
        if (totalQuantity > 1) {
            const newMultiplier = totalQuantity - 1;
            setTotalQuantity(newMultiplier);
            applyMultiplierToStockDetails(newMultiplier);
        }
    };

    const handleQuantityInputChangeAll = (value) => {
        // B-24: clamp to floor of 1. parseInt(value) returns NaN for '' and
        // 0 for '0' — both should fall back to 1, not 0. Math.max guards
        // against any negative input too.
        const parsed = parseInt(value, 10);
        const newMultiplier = isNaN(parsed) ? 1 : Math.max(1, parsed);
        setTotalQuantity(newMultiplier);
        applyMultiplierToStockDetails(newMultiplier);
    };

    const totalAmount = useTotalAmount(stockDetails);

    const handleRemoveStock = async (symbol, tradeId) => {
        const cartItemsKey = 'cartItems';
        try {
            const cartData = await AsyncStorage.getItem(cartItemsKey);
            let cartItems = cartData ? JSON.parse(cartData) : [];
            const updatedSD = stockDetails.filter(
                (s) => !(s.tradingSymbol === symbol && s.tradeId === tradeId),
            );
            const updatedCartItems = cartItems.filter(
                (s) => !(s.tradingSymbol === symbol && s.tradeId === tradeId),
            );
            setStockDetails(updatedSD);
            await AsyncStorage.setItem(cartItemsKey, JSON.stringify(updatedCartItems));
            eventEmitter.emit('stockRemoved', { symbol, tradeId });
        } catch (error) {
            console.error('Error removing stock:', error);
        }
    };

    const [selectedOption, setSelectedOption] = useState('');
    const [inputFixSizeValue, setInputFixValue] = useState('');

    const handleFixSize = () => {
        if (selectedOption === 'fix' && inputFixSizeValue) {
            const fixedSize = parseFloat(inputFixSizeValue);
            const updatedSD = stockDetails.map((stock) => {
                const currentPrice = getLastKnownPrice(stock.tradingSymbol);
                if (currentPrice && currentPrice > 0) {
                    const newQuantity = Math.floor(fixedSize / currentPrice);
                    return { ...stock, quantity: newQuantity };
                }
                return stock;
            });
            setStockDetails(updatedSD);
        }
    };

    const handleReset = () => {
        setSelectedOption('');
        setInputFixValue('');
    };

    const hasZeroQuantity = stockDetails.some((stock) => stock.quantity === 0);

    const hasInvalidClosureQty =
        isClosureBasket &&
        stockDetails.some((stock) => {
            if (!stock.isClosure) return false;
            const qty = closureQuantities[stock.tradeId] || 0;
            const maxQty =
                stock.currentHolding || Math.abs(stock.toTradeQty || 1);
            return qty <= 0 || qty > maxQty;
        });

    const getProcessedStockDetails = () => {
        if (!isClosureBasket) return stockDetails;
        return stockDetails.map((stock) => {
            if (stock.isClosure) {
                return {
                    ...stock,
                    quantity: closureQuantities[stock.tradeId] || stock.quantity,
                    closurestatus: 'fullClose',
                };
            }
            return stock;
        });
    };

    // Determine mode
    let mode = 'bespoke';
    if (isBasket && isClosureBasket) mode = 'closure';
    else if (isBasket) mode = 'basket';

    const basketName = (
        configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG ||
        getAdvisorSubdomain()
    ).toUpperCase() + ' BASKET';

    // Render helpers passed as actions so presentation stays pure
    const renderReviewTradeText = (item) => (
        <ReviewTradeText
            symbol={item.tradingSymbol || ''}
            orderType={item.orderType}
            exchange={item.exchange}
            advisedPrice={0}
            stockDetails={stockDetails}
        />
    );

    const renderSliderButton = (opts) => (
        <GestureHandlerRootView style={{ flex: 0 }}>
            <View
                style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderTopColor: '#e4e4e4',
                    borderTopWidth: 0.5,
                    elevation: 1,
                    backgroundColor: '#fff',
                }}
            >
                <SliderButton
                    loading={loading}
                    text={opts.text}
                    onSlideComplete={
                        mode === 'closure'
                            ? () => placeOrder(getProcessedStockDetails())
                            : placeOrder
                    }
                    disabled={opts.disabled}
                    backgroundColor={opts.backgroundColor}
                />
            </View>
        </GestureHandlerRootView>
    );

    // Enrich stockDetails with closureQuantity for presentation
    const enrichedStockDetails = stockDetails.map((s) => ({
        ...s,
        closureQuantity: closureQuantities[s.tradeId],
    }));

    const viewModel = {
        visible,
        mode,
        basketName,
        totalAmount: totalAmount || '0.00',
        hasZeroQuantity,
        hasInvalidClosureQty,
        loading,
        totalQuantity,
        stockDetails: enrichedStockDetails,
        selectedOption,
        inputFixSizeValue,
    };

    const actions = {
        onClose,
        onPlaceOrder: placeOrder,
        onIncreaseQty: handleIncreaseStockQty,
        onDecreaseQty: handleDecreaseStockQty,
        onChangeQty: handleQuantityInputChange,
        onIncreaseAllQty: handleIncreaseAllStockQty,
        onDecreaseAllQty: handleDecreaseAllStockQty,
        onChangeAllQty: handleQuantityInputChangeAll,
        onRemoveStock: handleRemoveStock,
        onClosureQtyIncrease: handleClosureQtyIncrease,
        onClosureQtyDecrease: handleClosureQtyDecrease,
        onClosureQtyChange: handleClosureQtyChange,
        onSetSelectedOption: setSelectedOption,
        onSetInputFixValue: setInputFixValue,
        onFixSize: handleFixSize,
        onResetFixSize: handleReset,
        renderReviewTradeText,
        renderSliderButton,
    };

    return <Presentation viewModel={viewModel} actions={actions} />;
};

export default BasketTradeModal;
