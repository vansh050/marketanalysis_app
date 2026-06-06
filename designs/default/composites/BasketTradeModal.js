/**
 * BasketTradeModal — design-system composite (Phase H, 2026-05-02)
 *
 * Pure presentation for the basket trade review modal. Supports three
 * modes: closure basket, regular basket, and bespoke (individual trades).
 * Uses ModalShell (bottomSheet variant) for the modal wrapper.
 *
 * Contract:
 *   viewModel = {
 *     visible, mode: 'closure' | 'basket' | 'bespoke',
 *     basketName, totalAmount, hasZeroQuantity, hasInvalidClosureQty,
 *     loading, totalQuantity,
 *     stockDetails: [{
 *       tradeId, tradingSymbol, exchange, Type/transactionType,
 *       quantity, orderType, isClosure?, currentHolding?,
 *       closureQuantity?
 *     }],
 *     selectedOption, inputFixSizeValue,
 *   }
 *   actions = {
 *     onClose, onPlaceOrder,
 *     onIncreaseQty(symbol, tradeId), onDecreaseQty(symbol, tradeId),
 *     onChangeQty(symbol, value, tradeId),
 *     onIncreaseAllQty, onDecreaseAllQty, onChangeAllQty(value),
 *     onRemoveStock(symbol, tradeId),
 *     onClosureQtyIncrease(tradeId, maxQty), onClosureQtyDecrease(tradeId),
 *     onClosureQtyChange(tradeId, value, maxQty),
 *     onSetSelectedOption(opt), onSetInputFixValue(val),
 *     onFixSize, onResetFixSize,
 *     renderReviewTradeText(item),
 *     renderSliderButton(opts),
 *   }
 */

import React from 'react';
import {
    View,
    FlatList,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
} from 'react-native';
import {
    XIcon,
    Trash2Icon,
    CandlestickChartIcon,
    Minus,
    Plus,
    ShoppingBag,
    AlertTriangle,
    Package,
} from 'lucide-react-native';
import Icon1 from 'react-native-vector-icons/Feather';
import { RadioButton } from 'react-native-paper';
import useTokens from '../../../src/theme/useTokens';
import ModalShell from '../primitives/ModalShell';
import Text from '../primitives/Text';

const { height: screenHeight } = Dimensions.get('window');

const BasketTradeModal = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const {
        visible = false,
        mode = 'bespoke',
        basketName = '',
        totalAmount = '0.00',
        hasZeroQuantity = false,
        hasInvalidClosureQty = false,
        loading = false,
        totalQuantity = 1,
        stockDetails = [],
        selectedOption = '',
        inputFixSizeValue = '',
    } = viewModel || {};
    const {
        onClose = () => {},
        onPlaceOrder = () => {},
        onIncreaseQty = () => {},
        onDecreaseQty = () => {},
        onChangeQty = () => {},
        onIncreaseAllQty = () => {},
        onDecreaseAllQty = () => {},
        onChangeAllQty = () => {},
        onRemoveStock = () => {},
        onClosureQtyIncrease = () => {},
        onClosureQtyDecrease = () => {},
        onClosureQtyChange = () => {},
        onSetSelectedOption = () => {},
        onSetInputFixValue = () => {},
        onFixSize = () => {},
        onResetFixSize = () => {},
        renderReviewTradeText = () => null,
        renderSliderButton = () => null,
    } = actions || {};

    const emptyComponent = (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
                <CandlestickChartIcon size={40} color={tokens.colors.text.primary} />
            </View>
            <Text
                variant="title"
                style={{
                    fontFamily: 'Satoshi-SemiBold',
                    color: tokens.colors.text.primary,
                    fontSize: 18,
                    marginVertical: 10,
                }}
            >
                No Orders to Place
            </Text>
            <Text
                variant="body"
                style={{ fontFamily: 'Satoshi-Medium', color: tokens.colors.text.muted }}
            >
                Add item to cart to place order.
            </Text>
        </View>
    );

    // --- CLOSURE BASKET ---
    if (mode === 'closure') {
        const renderClosureRow = ({ item, index }) => {
            const currentHolding = item.currentHolding || Math.abs(item.toTradeQty || item.quantity || 1);
            const qtyToClose = item.closureQuantity || 1;
            return (
                <View style={styles.tableRow} key={index}>
                    <View style={[styles.tableCell, { flex: 1.5 }]}>
                        <Text style={styles.symbol} numberOfLines={1}>{item.tradingSymbol}</Text>
                        <Text style={[styles.tradeType, styles.sell]}>SELL (Close)</Text>
                    </View>
                    <View style={styles.tableCell}>
                        {renderReviewTradeText(item)}
                    </View>
                    <View style={styles.tableCell}>
                        <Text style={styles.holdingText}>{currentHolding}</Text>
                        <Text style={styles.holdingLabel}>lots</Text>
                    </View>
                    <View style={[styles.tableCell, { flex: 1.2 }]}>
                        <View style={styles.closureQtyControl}>
                            <TouchableOpacity
                                style={styles.closureQtyBtn}
                                onPress={() => onClosureQtyDecrease(item.tradeId)}
                            >
                                <Minus size={12} color={tokens.colors.text.primary} />
                            </TouchableOpacity>
                            <TextInput
                                style={[styles.closureQtyInput, { color: tokens.colors.text.primary }]}
                                value={String(qtyToClose)}
                                keyboardType="numeric"
                                onChangeText={(val) =>
                                    onClosureQtyChange(item.tradeId, val, currentHolding)
                                }
                            />
                            <TouchableOpacity
                                style={styles.closureQtyBtn}
                                onPress={() => onClosureQtyIncrease(item.tradeId, currentHolding)}
                            >
                                <Plus size={12} color={tokens.colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        {qtyToClose > currentHolding && (
                            <Text style={styles.qtyError}>Max: {currentHolding}</Text>
                        )}
                    </View>
                </View>
            );
        };

        return (
            <ModalShell visible={visible} onClose={onClose} variant="bottomSheet" style={{ padding: 0 }}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <XIcon size={24} color={tokens.colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.horizontal} />
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: '#DC3545' }]}>
                        <Package size={24} color="white" />
                    </View>
                    <View>
                        <Text style={styles.basketNameText}>CLOSE POSITIONS</Text>
                        <Text style={styles.closureSubtitle}>Exit your current holdings</Text>
                    </View>
                </View>

                <View style={styles.closureWarning}>
                    <AlertTriangle size={16} color="#856404" />
                    <Text style={styles.closureWarningText}>
                        You are about to close your positions. Adjust quantities below.
                    </Text>
                </View>

                <View style={{ borderWidth: 1, borderColor: tokens.colors.border.default, marginTop: 5 }} />

                <View style={styles.tableContainer}>
                    <View style={[styles.tableHeader, { backgroundColor: '#FFF3CD' }]}>
                        <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Stocks</Text>
                        <Text style={styles.tableHeaderText}>Price (₹)</Text>
                        <Text style={styles.tableHeaderText}>Holding</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Qty to Close</Text>
                    </View>
                    <FlatList
                        data={stockDetails.filter((s) => s.isClosure)}
                        renderItem={renderClosureRow}
                        keyExtractor={(item) => item.tradeId.toString()}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={{ fontFamily: 'Satoshi-Medium', color: tokens.colors.text.muted }}>
                                    No positions to close
                                </Text>
                            </View>
                        }
                        contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
                    />
                </View>

                <View style={styles.closureNoteContainer}>
                    <Text style={styles.closureNote}>
                        Note: You can adjust the quantity to close for each position individually.
                        Cannot close more than your current holding.
                    </Text>
                </View>

                {stockDetails.filter((s) => s.isClosure).length > 0 &&
                    renderSliderButton({
                        text: `Slide to Close Positions || ₹${totalAmount}`,
                        disabled: hasInvalidClosureQty,
                        backgroundColor: '#DC3545',
                    })}
            </ModalShell>
        );
    }

    // --- REGULAR BASKET ---
    if (mode === 'basket') {
        // B-15 + B-37 (2026-05-19 mobile migration): per-leg status pills
        // so the customer sees what's already happened with each leg:
        //   • Partial fill (⚡ N/M filled): broker filled some, remaining
        //     in-flight or needs retry. Place Order will re-attempt with
        //     B-10 backend retry-sizing trimmed to remainingQty.
        //   • Rejected (⚠ Rejected — will retry): leg was rejected by
        //     broker on a prior placement (margin block / surveillance /
        //     throttle / transient API). Customer addresses the root
        //     cause then re-clicks Place Order → leg goes fresh.
        //   • Already executed (✓ Done): leg already filled, will NOT be
        //     re-placed (B-36 ensures it stays visible for the count, but
        //     not actionable).
        const renderStatusPill = (item) => {
            const status = String(item?.trade_place_status || '').toLowerCase();
            if (item?.partial_fill && status === 'partial') {
                const filled = item.filledQty ?? item.tradedQty ?? 0;
                const target = item.Quantity ?? item.quantity ?? 0;
                return (
                    <View style={statusPillStyles.partialPill}>
                        <Text style={statusPillStyles.partialPillText}>{`⚡ ${filled}/${target} filled`}</Text>
                    </View>
                );
            }
            if (status === 'rejected' || status === 'failure') {
                return (
                    <View style={statusPillStyles.rejectedPill}>
                        <Text style={statusPillStyles.rejectedPillText}>{'⚠ Rejected — will retry'}</Text>
                    </View>
                );
            }
            if (['complete', 'executed', 'success', 'filled'].includes(status) && !item?.partial_fill) {
                return (
                    <View style={statusPillStyles.completedPill}>
                        <Text style={statusPillStyles.completedPillText}>{'✓ Done'}</Text>
                    </View>
                );
            }
            return null;
        };

        const renderTradeRow = ({ item, index }) => (
            <View style={styles.tableRow} key={index}>
                <View style={styles.tableCell}>
                    <Text style={styles.symbol}>{item.tradingSymbol}</Text>
                    <Text style={[styles.tradeType, item.Type === 'SELL' ? styles.sell : styles.buy]}>
                        {item.Type === 'SELL' ? 'SELL' : 'BUY'}
                    </Text>
                    {renderStatusPill(item)}
                </View>
                <View style={styles.tableCell}>
                    {renderReviewTradeText(item)}
                </View>
                <View style={styles.tableCell}>
                    <Text style={styles.quantity}>{item.quantity}</Text>
                </View>
            </View>
        );

        return (
            <ModalShell visible={visible} onClose={onClose} variant="bottomSheet" style={{ padding: 0 }}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <XIcon size={24} color={tokens.colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.horizontal} />
                <View style={styles.header}>
                    <View style={styles.iconContainer}>
                        <ShoppingBag size={24} color="white" />
                    </View>
                    <Text style={styles.basketNameText}>{basketName}</Text>
                </View>
                <View style={{ borderWidth: 1, borderColor: tokens.colors.border.default, marginTop: 5 }} />

                <View style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.tableHeaderText}>Stocks</Text>
                        <Text style={styles.tableHeaderText}>Current Price (₹)</Text>
                        <Text style={styles.tableHeaderText}>Quantity</Text>
                    </View>
                    <FlatList
                        data={stockDetails}
                        renderItem={renderTradeRow}
                        keyExtractor={(item) => item.tradeId.toString()}
                        ListEmptyComponent={emptyComponent}
                        contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
                    />
                </View>

                <View style={styles.multiplierContainer}>
                    <Text style={styles.label}>Quantity Multiplier:</Text>
                    <View style={styles.multiplierControl}>
                        <TouchableOpacity onPress={onDecreaseAllQty} style={styles.button}>
                            <Minus size={16} />
                        </TouchableOpacity>
                        <TextInput
                            value={totalQuantity.toString()}
                            style={[styles.qtyInput, { color: tokens.colors.text.primary }]}
                            keyboardType="numeric"
                            onChangeText={onChangeAllQty}
                        />
                        <TouchableOpacity onPress={onIncreaseAllQty} style={styles.button}>
                            <Plus size={16} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.noteText}>
                        Note: The multiplier adjusts all stock quantities proportionally. A value of 2 doubles
                        all quantities, 3 triples them, and so on.
                    </Text>
                </View>

                {stockDetails.length > 0 &&
                    renderSliderButton({
                        text: `Slide to Place Order || ₹${totalAmount}`,
                        disabled: hasZeroQuantity,
                    })}
            </ModalShell>
        );
    }

    // --- BESPOKE (individual trades) ---
    const renderItem = ({ item }) => {
        const symbol = item.tradingSymbol;
        return (
            <View style={styles.rowContainer}>
                <View style={styles.leftContainer}>
                    <Text style={styles.symbol}>
                        {symbol.length > 18 ? `${symbol.substring(0, 18)}...` : symbol}
                    </Text>
                    <Text
                        style={[
                            styles.cellText,
                            item.transactionType === 'BUY' ? styles.buyOrder : styles.sellOrder,
                        ]}
                    >
                        {item.transactionType}
                    </Text>
                </View>

                <View style={styles.quantityContainer}>
                    <TouchableOpacity
                        style={{ justifyContent: 'center', padding: 5, paddingRight: 0 }}
                        onPress={() => onDecreaseQty(item.tradingSymbol, item.tradeId)}
                    >
                        <Icon1 name="minus" size={14} color={tokens.colors.text.primary} />
                    </TouchableOpacity>
                    <TextInput
                        value={item.quantity.toString()}
                        style={[styles.qtyInput, { color: tokens.colors.text.primary }]}
                        keyboardType="numeric"
                        onChangeText={(value) => onChangeQty(item.tradingSymbol, value, item.tradeId)}
                    />
                    <TouchableOpacity
                        style={{ justifyContent: 'center', padding: 5, paddingLeft: 0 }}
                        onPress={() => onIncreaseQty(item.tradingSymbol, item.tradeId)}
                    >
                        <Icon1 name="plus" size={14} color={tokens.colors.text.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.rightContainer}>
                    {renderReviewTradeText(item)}
                </View>
                <TouchableOpacity
                    style={{ marginRight: 10, padding: 5, paddingRight: 0 }}
                    onPress={() => onRemoveStock(item.tradingSymbol, item.tradeId)}
                >
                    <Trash2Icon size={20} color={tokens.colors.text.primary} />
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <ModalShell visible={visible} onClose={onClose} variant="bottomSheet" style={{ padding: 0 }}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <XIcon size={24} color={tokens.colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.horizontal} />
            <Text style={styles.modalHeader1}>Review Trade Details</Text>
            <View style={{ borderWidth: 1, borderColor: tokens.colors.border.default, marginTop: 5 }} />

            <FlatList
                data={stockDetails}
                renderItem={renderItem}
                keyExtractor={(item) => item.tradeId.toString()}
                ListEmptyComponent={emptyComponent}
                contentContainerStyle={{ paddingHorizontal: 10, marginBottom: 10 }}
            />

            {stockDetails.length > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 20 }}>
                    <View>
                        <Text style={styles.cellText}>Scale Quantity By</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 0 }}>
                            <RadioButton
                                value="fix"
                                status={selectedOption === 'fix' ? 'checked' : 'unchecked'}
                                onPress={() => onSetSelectedOption('fix')}
                                color={tokens.colors.text.primary}
                            />
                            <Text style={{ color: tokens.colors.text.muted, marginRight: 10 }}>Fix Size</Text>
                        </View>
                    </View>

                    {selectedOption === 'fix' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                            <TextInput
                                value={inputFixSizeValue}
                                onChangeText={onSetInputFixValue}
                                placeholder="Enter value"
                                keyboardType="numeric"
                                style={{
                                    color: tokens.colors.text.primary,
                                    width: 80,
                                    paddingLeft: 5,
                                    fontSize: 12,
                                    padding: 0,
                                    fontFamily: 'Satoshi-Medium',
                                    borderWidth: 1,
                                    borderColor: tokens.colors.border.default,
                                    borderRadius: 5,
                                    marginRight: 8,
                                }}
                            />
                            <TouchableOpacity
                                onPress={onFixSize}
                                style={[
                                    {
                                        paddingVertical: 6,
                                        paddingHorizontal: 12,
                                        backgroundColor: inputFixSizeValue
                                            ? tokens.colors.text.primary
                                            : tokens.colors.text.muted,
                                        borderRadius: 5,
                                        marginRight: 8,
                                    },
                                    !inputFixSizeValue && { opacity: 0.6 },
                                ]}
                                disabled={!inputFixSizeValue}
                            >
                                <Text style={{ color: tokens.colors.text.inverse, fontSize: 12 }}>
                                    Update
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onResetFixSize} style={{ padding: 8 }}>
                                <Text style={{ fontSize: 20, color: tokens.colors.text.muted }}>
                                    ⟳
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {stockDetails.length > 0 &&
                renderSliderButton({
                    text: `Slide to Place Order || ₹${totalAmount}`,
                    disabled: hasZeroQuantity,
                })}
        </ModalShell>
    );
};

// B-15 + B-37 per-leg status pills (2026-05-19 mobile migration).
const statusPillStyles = StyleSheet.create({
    partialPill: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        borderWidth: 1,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    partialPillText: { fontSize: 10, color: '#92400E', fontWeight: '600' },
    rejectedPill: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#FEE2E2',
        borderColor: '#DC2626',
        borderWidth: 1,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    rejectedPillText: { fontSize: 10, color: '#991B1B', fontWeight: '600' },
    completedPill: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: '#D1FAE5',
        borderColor: '#10B981',
        borderWidth: 1,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    completedPillText: { fontSize: 10, color: '#065F46', fontWeight: '600' },
});

const styles = StyleSheet.create({
    closeButton: { position: 'absolute', top: 10, right: 10, zIndex: 1 },
    horizontal: {
        width: 110, height: 6, marginBottom: 20, borderRadius: 250,
        alignSelf: 'center', backgroundColor: '#f1f4f8',
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    iconContainer: {
        backgroundColor: '#4A7AAF', padding: 10, marginLeft: 10,
        borderRadius: 50, marginRight: 10,
    },
    basketNameText: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: 'black' },
    modalHeader1: {
        fontSize: 18, fontFamily: 'Satoshi-Bold', alignSelf: 'flex-start',
        marginHorizontal: 25, color: 'black', marginBottom: 10,
    },
    tableContainer: { marginBottom: 20 },
    tableHeader: {
        flexDirection: 'row', backgroundColor: '#f5f5f5',
        paddingVertical: 5, paddingHorizontal: 5, marginBottom: 5,
    },
    tableHeaderText: {
        fontSize: 13, color: '#000', fontFamily: 'Satoshi-Bold',
        flex: 1, textAlign: 'center',
    },
    tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#ddd' },
    tableCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    symbol: { alignSelf: 'flex-start', color: 'black', fontFamily: 'Satoshi-SemiBold' },
    tradeType: { marginTop: 5, fontSize: 12 },
    sell: { fontFamily: 'Satoshi-Bold', color: '#EA2D3F' },
    buy: { fontFamily: 'Satoshi-Bold', color: '#16A085' },
    quantity: { fontSize: 15, color: '#000' },
    rowContainer: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: 10,
        justifyContent: 'space-between', paddingVertical: 10,
        borderBottomWidth: 1, borderColor: '#E8E8E8',
    },
    leftContainer: { flex: 1, justifyContent: 'flex-start', marginRight: 5, alignItems: 'flex-start' },
    rightContainer: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end' },
    quantityContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'transparent', marginLeft: 0, flex: 1,
    },
    qtyInput: {
        width: 50, height: 30, padding: 2, marginHorizontal: 4,
        fontSize: 12, textAlign: 'center', borderWidth: 1,
        borderColor: '#e9e8e8', borderRadius: 7,
    },
    cellText: { alignSelf: 'flex-start', color: 'black', fontSize: 12, fontFamily: 'Satoshi-Medium' },
    buyOrder: { color: '#16A085', fontFamily: 'Satoshi-SemiBold', alignSelf: 'flex-start' },
    sellOrder: { color: 'red' },
    multiplierContainer: { marginVertical: 5, marginHorizontal: 10 },
    label: { fontSize: 14, color: '#000' },
    multiplierControl: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    button: {
        width: 30, height: 30, backgroundColor: '#e9e9e9',
        borderRadius: 5, justifyContent: 'center', alignItems: 'center',
    },
    noteText: { fontSize: 12, color: '#888', marginTop: 10 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    emptyIconWrap: { borderRadius: 50, backgroundColor: '#EBECEF', padding: 20 },
    // Closure-specific
    closureSubtitle: { fontSize: 12, color: '#666', fontFamily: 'Satoshi-Regular' },
    closureWarning: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3CD',
        paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 10,
        marginTop: 10, borderRadius: 6, gap: 8,
    },
    closureWarningText: { flex: 1, fontSize: 12, color: '#856404', fontFamily: 'Satoshi-Medium' },
    closureNoteContainer: { paddingHorizontal: 15, paddingVertical: 10 },
    closureNote: { fontSize: 11, color: '#666', fontFamily: 'Satoshi-Regular', lineHeight: 16 },
    closureQtyControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    closureQtyBtn: {
        width: 24, height: 24, backgroundColor: '#f0f0f0',
        borderRadius: 4, justifyContent: 'center', alignItems: 'center',
    },
    closureQtyInput: {
        width: 40, height: 28, textAlign: 'center', fontSize: 13,
        fontFamily: 'Satoshi-Bold', borderWidth: 1, borderColor: '#ddd',
        borderRadius: 4, marginHorizontal: 4, padding: 0,
    },
    holdingText: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#000', textAlign: 'center' },
    holdingLabel: { fontSize: 10, fontFamily: 'Satoshi-Regular', color: '#666', textAlign: 'center' },
    qtyError: { fontSize: 9, color: '#DC3545', textAlign: 'center', marginTop: 2 },
});

export default BasketTradeModal;
