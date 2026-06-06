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
import { View, FlatList, TextInput, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
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

    const filteredOrders = useMemo(() => {
        const low = parseFloat(lowPrice);
        const high = parseFloat(highPrice);
        const text = deferredSearchText.toLowerCase();
        return orders.filter((order) => {
            const matchSymbol = order?.Symbol?.toLowerCase().includes(text);
            const orderAvgPrice = parseFloat(order?.AvgPrice);
            const passesLow = !isNaN(low) ? orderAvgPrice >= low : true;
            const passesHigh = !isNaN(high) ? orderAvgPrice <= high : true;
            return matchSymbol && passesLow && passesHigh;
        });
    }, [deferredSearchText, lowPrice, highPrice, orders]);

    const dataToShow =
        filteredOrders.length > 0 || lowPrice || highPrice || deferredSearchText
            ? filteredOrders
            : orders;

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
        <View style={{ flex: 1, backgroundColor: '#EFF0EE', overflow: 'hidden' }}>
            <View style={{ flex: 1 }}>
                {/* Search row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, marginHorizontal: 15 }}>
                    <View
                        style={{
                            flex: 1,
                            height: 40,
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: tokens.colors.surface.card,
                            paddingHorizontal: 12,
                            borderRadius: tokens.radii.md - 2,
                            borderColor: '#ecf1f8',
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

                <FlatList
                    data={dataToShow}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
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
                                    No Orders Data
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
                                    Orders that are placed will appear here.
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
