/**
 * OrderScreen — design-system screen presentation (Phase E.1, 2026-05-01)
 *
 * Pure presentation. Receives data + actions from the container at
 * src/screens/Home/OrderScreen.js and renders the search row + FlatList +
 * empty state. Uses the OrderRow composite for each row; basket-grouped
 * orders use a small inline `BasketRow` helper.
 *
 * Contract:
 *   viewModel = {
 *     orders: array,             // already sorted by date desc
 *     isLoading: boolean,
 *     gradient: { start, end },  // for the empty state hero — passes through advisor branding
 *   }
 *   actions = {
 *     openDdpiHelp: ({ broker }) => void,
 *   }
 *
 * Search and price-range filters are LOCAL UI state in this presentation —
 * filter math is pure (useMemo over the orders array). Lifting these into
 * the container would make filter state survive screen unmount, which is
 * not the legacy behaviour.
 */

import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { View, FlatList, TextInput, ActivityIndicator, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ShoppingBasket, ChevronUp, ChevronDown, SearchIcon } from 'lucide-react-native';
import useTokens from '../../../src/theme/useTokens';
import { getStatusColors } from '../../../src/utils/orderUtils';
import Text from '../primitives/Text';
import Icon from '../primitives/Icon';
import OrderRow from '../composites/OrderRow';

const BasketRow = ({ item, onDdpiHelpPress }) => {
    const tokens = useTokens();
    const [isExpanded, setIsExpanded] = useState(false);
    if (!item.basket_advice || item.basket_advice.length === 0) return null;

    return (
        <View
            style={{
                backgroundColor: '#F0F8FF',
                marginVertical: 6,
                borderRadius: tokens.radii.md + 2,
                elevation: 2,
                borderColor: tokens.colors.border.strong,
                ...tokens.shadows.card,
            }}
        >
            <TouchableOpacity
                onPress={() => setIsExpanded((prev) => !prev)}
                activeOpacity={0.7}
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: 15,
                    paddingVertical: 12,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon Component={ShoppingBasket} size={20} style={{ marginRight: 10 }} color={tokens.colors.text.primary} />
                    <View>
                        <Text variant="title" style={{ fontSize: 15, fontWeight: '600' }}>{item.basketName}</Text>
                        <Text variant="caption" style={{ fontSize: 13, color: tokens.colors.text.muted, marginTop: 2 }}>
                            {item.basket_advice.length} Orders
                        </Text>
                    </View>
                </View>
                <Icon Component={isExpanded ? ChevronUp : ChevronDown} size={28} color={tokens.colors.text.secondary} />
            </TouchableOpacity>

            {isExpanded && (
                <View
                    style={{
                        paddingBottom: 5,
                        borderTopWidth: 1,
                        borderTopColor: tokens.colors.border.subtle,
                        backgroundColor: '#FAFAFA',
                    }}
                >
                    {item.basket_advice.map((subItem) => {
                        const { color1, color2 } = getStatusColors(subItem.trade_place_status);
                        return (
                            <OrderRow
                                key={subItem._id}
                                item={subItem}
                                color1={color1}
                                color2={color2}
                                onDdpiHelpPress={onDdpiHelpPress}
                            />
                        );
                    })}
                </View>
            )}
        </View>
    );
};

const OrderScreen = ({ viewModel, actions }) => {
    const tokens = useTokens();
    const { orders = [], isLoading = false, gradient = {} } = viewModel || {};
    const { openDdpiHelp = () => {} } = actions || {};

    const [searchText, setSearchText] = useState('');
    const [selectedBroker, setSelectedBroker] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    // lowPrice / highPrice filter state preserved from legacy (not currently
    // surfaced in UI, but the math is in place).
    const [lowPrice] = useState('');
    const [highPrice] = useState('');

    // useDeferredValue (React 19) — decouples the TextInput from the
    // FlatList filter recompute. The input updates `searchText` synchronously
    // for visual responsiveness; the filter consumes `deferredSearchText`
    // which lags behind during fast typing and catches up when the user
    // pauses. Without this, every keystroke triggers a full filter +
    // FlatList diff, which is visibly laggy on lists of 30+ orders.
    const deferredSearchText = useDeferredValue(searchText);

    const getOrderBroker = order =>
        order?.user_broker || order?.basket_advice?.find(item => item?.user_broker)?.user_broker || null;
    const getOrderType = order => {
        if (Array.isArray(order?.basket_advice) && order.basket_advice.length > 0) return 'basket';
        if (order?.model_id) return 'model_portfolio';
        return ['NFO', 'BFO'].includes(String(order?.Exchange || '').toUpperCase()) ? 'fno' : 'equity';
    };
    const getOrderStatus = order => {
        const status = String(order?.trade_place_status || '').toLowerCase();
        // Legacy rows without a recorded status are not pending orders. Treating
        // the empty value as pending was what produced a large “Pending” count
        // while each card itself could only say “Unknown”.
        if (!status) return 'unavailable';
        if (['rejected', 'failure', 'failed', 'cancelled'].includes(status)) return 'rejected';
        if (['complete', 'completed', 'executed', 'placed', 'manually_placed'].includes(status)) return 'completed';
        if (['pending', 'trigger pending', 'trigger_pending', 'requested', 'am', 'after market', 'open', 'transit', 'ordered'].includes(status)) return 'pending';
        return 'unavailable';
    };

    const brokerOptions = useMemo(
        () => [...new Set(orders.map(getOrderBroker).filter(Boolean))].sort(),
        [orders],
    );

    // Filter chips are a cascade, not static catalogue counts: choosing a
    // broker constrains Type; choosing broker + type constrains Status. Keep
    // the active search/price criteria in those scopes too, so every number
    // predicts the result the customer will get after the next tap.
    const filterCounts = useMemo(() => {
        const low = parseFloat(lowPrice);
        const high = parseFloat(highPrice);
        const text = deferredSearchText.toLowerCase();
        const matchesSearchAndPrice = order => {
            const matchSymbol = String(order?.Symbol || order?.basketName || '').toLowerCase().includes(text);
            const orderAvgPrice = parseFloat(order?.AvgPrice);
            return matchSymbol &&
                (!isNaN(low) ? orderAvgPrice >= low : true) &&
                (!isNaN(high) ? orderAvgPrice <= high : true);
        };
        const brokerScope = orders.filter(order =>
            matchesSearchAndPrice(order) &&
            (selectedBroker === 'all' || getOrderBroker(order) === selectedBroker),
        );
        const typeScope = brokerScope.filter(order =>
            selectedType === 'all' || getOrderType(order) === selectedType,
        );
        const type = {all: brokerScope.length, model_portfolio: 0, basket: 0, fno: 0, equity: 0};
        const status = {all: typeScope.length, completed: 0, pending: 0, rejected: 0, unavailable: 0};
        brokerScope.forEach(order => {
            type[getOrderType(order)] += 1;
        });
        typeScope.forEach(order => {
            status[getOrderStatus(order)] += 1;
        });
        return {type, status};
    }, [deferredSearchText, highPrice, lowPrice, orders, selectedBroker, selectedType]);

    const filteredOrders = useMemo(() => {
        const low = parseFloat(lowPrice);
        const high = parseFloat(highPrice);
        const text = deferredSearchText.toLowerCase();
        return orders.filter((order) => {
            const matchSymbol = String(order?.Symbol || order?.basketName || '').toLowerCase().includes(text);
            const orderAvgPrice = parseFloat(order?.AvgPrice);
            const passesLow = !isNaN(low) ? orderAvgPrice >= low : true;
            const passesHigh = !isNaN(high) ? orderAvgPrice <= high : true;
            const matchesBroker = selectedBroker === 'all' || getOrderBroker(order) === selectedBroker;
            const matchesType = selectedType === 'all' || getOrderType(order) === selectedType;
            const matchesStatus = selectedStatus === 'all' || getOrderStatus(order) === selectedStatus;
            return matchSymbol && passesLow && passesHigh && matchesBroker && matchesType && matchesStatus;
        });
    }, [deferredSearchText, lowPrice, highPrice, orders, selectedBroker, selectedType, selectedStatus]);

    const dataToShow =
        filteredOrders.length > 0 || lowPrice || highPrice || deferredSearchText ||
        selectedBroker !== 'all' || selectedType !== 'all' || selectedStatus !== 'all'
            ? filteredOrders
            : orders;

    const hasActiveFilters = selectedBroker !== 'all' || selectedType !== 'all' || selectedStatus !== 'all';
    const hasFilterQuery = hasActiveFilters || Boolean(deferredSearchText || lowPrice || highPrice);
    const clearFilters = () => {
        setSelectedBroker('all');
        setSelectedType('all');
        setSelectedStatus('all');
    };

    // useCallback so FlatList sees a stable renderItem reference across
    // keystrokes in the search box. Without this, every keystroke would
    // create a new renderItem and force every visible row to re-render —
    // which (combined with legacy non-memoized OrderItem) was the slow
    // search/delete behaviour observed during Phase E.1 QA. Stable
    // dependencies: only `openDdpiHelp` changes when the action callback
    // reference changes (it's already memoized in the container).
    const renderItem = useCallback(
        ({ item }) => {
            const isBasket = Array.isArray(item.basket_advice) && item.basket_advice.length > 0;
            if (isBasket) {
                return <BasketRow item={item} onDdpiHelpPress={openDdpiHelp} />;
            }
            const { color1, color2 } = getStatusColors(item.trade_place_status);
            return <OrderRow item={item} color1={color1} color2={color2} onDdpiHelpPress={openDdpiHelp} />;
        },
        [openDdpiHelp]
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F6F8FB', overflow: 'hidden' }}>
            <View style={{ flex: 1 }}>
                <View style={{paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4}}>
                    <Text variant="title" style={{fontSize: 19, lineHeight: 26, color: tokens.colors.text.primary}}>
                        Orders
                    </Text>
                    <Text variant="caption" style={{fontSize: 12, color: tokens.colors.text.muted, marginTop: 1}}>
                        Latest order status from your broker
                    </Text>
                </View>
                <FlatList
                    data={dataToShow}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={{paddingBottom: 20}}
                    // Keep only the compact screen title fixed. Search and filters
                    // belong to the list, so they scroll away with the first cards
                    // instead of taking most of a short phone viewport.
                    ListHeaderComponent={
                        <View style={{paddingBottom: 8}}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, marginHorizontal: 16 }}>
                                <View
                                    style={{
                                        flex: 1,
                                        minHeight: 44,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: tokens.colors.surface.card,
                                        paddingHorizontal: 12,
                                        borderRadius: 12,
                                        borderColor: tokens.colors.border.subtle,
                                        borderWidth: 1,
                                        ...tokens.shadows.card,
                                        shadowOpacity: 0.04,
                                    }}
                                >
                                    <Icon Component={SearchIcon} size={18} color="#9FA5B5" style={{ marginRight: 5 }} />
                                    <TextInput
                                        style={{
                                            flex: 1,
                                            fontSize: 14,
                                            color: tokens.colors.text.primary,
                                            backgroundColor: 'transparent',
                                        }}
                                        placeholder="Search for Orders"
                                        placeholderTextColor="#9FA5B5"
                                        value={searchText}
                                        onChangeText={setSearchText}
                                    />
                                </View>
                            </View>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6}}>
                                <Text variant="caption" style={{fontSize: 12, color: tokens.colors.text.muted}}>
                                    {dataToShow.length} of {orders.length} orders
                                </Text>
                                {hasActiveFilters ? (
                                    <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                                        <Text variant="caption" style={{fontSize: 12, color: tokens.colors.brand.primary, fontFamily: 'Poppins-Medium'}}>
                                            Clear filters
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            {brokerOptions.length > 1 ? (
                                <FilterChipRow
                                    label="Broker"
                                    options={[{key: 'all', label: `All (${orders.length})`}, ...brokerOptions.map(broker => ({key: broker, label: broker}))]}
                                    selectedKey={selectedBroker}
                                    onSelect={setSelectedBroker}
                                    accentColor={tokens.colors.brand.primary}
                                />
                            ) : null}
                            <FilterChipRow
                                label="Type"
                                options={[
                                    {key: 'all', label: `All (${filterCounts.type.all})`},
                                    {key: 'model_portfolio', label: `Model Portfolio (${filterCounts.type.model_portfolio})`},
                                    {key: 'basket', label: `Basket (${filterCounts.type.basket})`},
                                    {key: 'fno', label: `F&O (${filterCounts.type.fno})`},
                                    {key: 'equity', label: `Equity (${filterCounts.type.equity})`},
                                ]}
                                selectedKey={selectedType}
                                onSelect={setSelectedType}
                                accentColor={tokens.colors.brand.primary}
                            />
                            <FilterChipRow
                                label="Status"
                                options={[
                                    {key: 'all', label: `All (${filterCounts.status.all})`},
                                    {key: 'completed', label: `Completed (${filterCounts.status.completed})`},
                                    {key: 'pending', label: `Pending (${filterCounts.status.pending})`},
                                    {key: 'rejected', label: `Rejected (${filterCounts.status.rejected})`},
                                ]}
                                selectedKey={selectedStatus}
                                onSelect={setSelectedStatus}
                                accentColor={tokens.colors.brand.primary}
                            />
                        </View>
                    }
                    ListEmptyComponent={
                        isLoading ? (
                            <View
                                style={{
                                    borderRadius: 16,
                                    marginHorizontal: 20,
                                    marginVertical: 40,
                                    paddingVertical: 40,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <ActivityIndicator size="large" color={tokens.colors.text.primary} />
                                <Text
                                    variant="bodyEmphasis"
                                    style={{ marginTop: 10, fontSize: 14, color: tokens.colors.text.muted }}
                                >
                                    Loading your orders...
                                </Text>
                            </View>
                        ) : (
                            <LinearGradient
                                colors={[gradient.start || tokens.colors.brand.gradientStart, gradient.end || tokens.colors.brand.gradientEnd]}
                                style={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 24,
                                    marginVertical: 20,
                                    marginHorizontal: 20,
                                    borderRadius: 20,
                                    overflow: 'hidden',
                                    width: '90%',
                                    alignSelf: 'center',
                                }}
                            >
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]} />
                                <View
                                    style={{
                                        width: 90,
                                        height: 90,
                                        borderRadius: 45,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginBottom: 20,
                                        backgroundColor: 'rgba(255,255,255,0.18)',
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 50,
                                            height: 50,
                                            borderRadius: 25,
                                            backgroundColor: 'rgba(255,255,255,0.85)',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text style={{ fontSize: 28 }}>🛒</Text>
                                    </View>
                                </View>
                                <Text
                                    variant="title"
                                    style={{
                                        fontFamily: 'Satoshi-SemiBold',
                                        color: tokens.colors.text.inverse,
                                        textAlign: 'center',
                                        marginBottom: 12,
                                    }}
                                >
                                    {hasFilterQuery ? 'No matching orders' : 'No orders yet'}
                                </Text>
                                <Text
                                    variant="body"
                                    style={{
                                        fontFamily: 'Satoshi-Medium',
                                        fontSize: 14,
                                        color: 'rgba(255,255,255,0.85)',
                                        textAlign: 'center',
                                        maxWidth: '85%',
                                        lineHeight: 20,
                                        marginBottom: 12,
                                    }}
                                >
                                    {hasFilterQuery
                                        ? 'Try changing or clearing the filters to see other orders.'
                                        : 'Orders you place will appear here. Pending orders are shown only for today, except active GTT orders.'}
                                </Text>
                            </LinearGradient>
                        )
                    }
                />
            </View>
        </View>
    );
};

export default OrderScreen;

const FilterChipRow = ({label, options, selectedKey, onSelect, accentColor}) => (
    <View style={{marginBottom: 7}}>
        <Text variant="caption" style={{fontSize: 11, color: '#64748B', fontFamily: 'Poppins-Medium', marginLeft: 16, marginBottom: 4}}>
            {label}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 16}}>
            {options.map(option => {
                const selected = selectedKey === option.key;
                return (
                    <TouchableOpacity
                        key={option.key}
                        onPress={() => onSelect(option.key)}
                        style={{
                            minHeight: 32,
                            justifyContent: 'center',
                            paddingHorizontal: 11,
                            marginRight: 7,
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: selected ? accentColor : '#D9E0EA',
                            backgroundColor: selected ? accentColor : '#fff',
                        }}>
                        <Text variant="caption" style={{fontSize: 11, color: selected ? '#fff' : '#475569', fontFamily: 'Poppins-Medium'}}>
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    </View>
);
