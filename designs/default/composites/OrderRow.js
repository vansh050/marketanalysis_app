/**
 * OrderRow — design-system composite (Phase E.1, 2026-05-01)
 *
 * Extracted from `src/screens/Home/OrderScreen.js`'s nested `OrderItem`
 * subcomponent. Pure presentation: receives the order item + status colours +
 * a callback for the DDPI help link, owns its own `showReason` UI state.
 *
 * Contract:
 *   {
 *     item: orderObject,           // see OrderScreen viewModel.orders[i]
 *     color1: string,              // status bg colour (legacy hex from getStatusColors)
 *     color2: string,              // status fg colour
 *     onDdpiHelpPress: ({ broker }) => void,
 *   }
 *
 * Primitive usage:
 *   - <Pill> for BUY/SELL badges (variant=profit / loss)
 *   - <Icon> for status icons (lucide Check / X / Pause)
 *   - <Text> for symbol / details / timestamp / status / reason / link
 *   - useTokens() for colours (text, surface, border, status) where mapping
 *     to a token is unambiguous; legacy hex retained where the visual is
 *     status-pill-specific (color1/color2 from getStatusColors).
 */

import React, { useState, memo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Check, X, Pause } from 'lucide-react-native';
import {
    isOrderSuccess,
    isOrderRejected,
    isOrderPending,
    getOrderStatusDisplay,
} from '../../../src/utils/orderStatusUtils';
import { isSellAuthRejection } from '../../../src/utils/sellAuthMessage';
import { getBrokerDdpiHelp } from '../../../src/config/brokerDdpiHelp';
import { formatOrderDate } from '../../../src/utils/orderUtils';
import useTokens from '../../../src/theme/useTokens';
import Text from '../primitives/Text';
import Pill from '../primitives/Pill';
import Icon from '../primitives/Icon';

const OrderRow = ({ item, color1, color2, onDdpiHelpPress }) => {
    const tokens = useTokens();
    const [showReason, setShowReason] = useState(false);
    const isRejected = isOrderRejected(item.trade_place_status);
    const rejectionReason = item.orderStatusMessage || item.message_aq || '';
    const totalQty = item.Lots || item.Quantity || '';
    const avgPrice = item.AvgPrice || item.tradedPrice || '';
    const isBuy = item.Type === 'BUY';

    const StatusIconComponent = isOrderSuccess(item.trade_place_status)
        ? Check
        : isOrderPending(item.trade_place_status)
          ? Pause
          : X;

    const symbolText =
        (item?.Exchange === 'NFO' || item?.Exchange === 'BFO') && item?.OptionType !== 'FUT'
            ? `${item.searchSymbol}${item.Exchange === 'NFO' || item.Exchange === 'BFO' ? ` | ${item.Strike} | ${item.OptionType}` : ''}`
            : item.Symbol;

    return (
        <TouchableOpacity
            activeOpacity={isRejected ? 0.7 : 1}
            onPress={() => {
                if (isRejected) setShowReason((prev) => !prev);
            }}
            style={{
                backgroundColor: 'transparent',
                paddingVertical: tokens.spacing.md,
                paddingHorizontal: tokens.spacing.md,
                borderRadius: tokens.radii.md - 1,
                borderColor: tokens.colors.border.subtle,
                borderWidth: 1,
                ...tokens.shadows.card,
                shadowOpacity: 0.04,
            }}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text
                        variant="bodyEmphasis"
                        style={{ fontSize: 14, color: tokens.colors.text.primary }}
                    >
                        {symbolText}
                    </Text>
                    {item?.model_id ? (
                        <View
                            style={{
                                marginLeft: tokens.spacing.xs + 2,
                                paddingHorizontal: 5,
                                paddingVertical: 1,
                                backgroundColor: '#EEF2FF',
                                borderRadius: tokens.radii.sm - 1,
                                borderWidth: 1,
                                borderColor: '#C7D2FE',
                            }}
                        >
                            <Text variant="caption" style={{ fontSize: 10, color: '#4F46E5' }}>MP</Text>
                        </View>
                    ) : null}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                        variant="caption"
                        style={{ fontSize: 11, color: tokens.colors.text.muted, marginRight: tokens.spacing.sm }}
                    >
                        {item?.user_broker || '-'}
                    </Text>
                    <Pill
                        variant={isBuy ? 'profit' : 'loss'}
                        label={isBuy ? 'Buy' : 'Sell'}
                        style={{ paddingHorizontal: 14 }}
                        labelStyle={{ fontSize: 10, color: '#fff', fontFamily: 'Poppins-Medium' }}
                    />
                </View>
            </View>

            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <View style={{ flexDirection: 'row', marginTop: 2 }}>
                    <Text
                        variant="caption"
                        style={{ color: tokens.colors.text.muted, fontSize: 12, letterSpacing: 0.2 }}
                    >
                        Qty. {item.tradedQty || 0}/{totalQty || '-'}{'  '}|{'  '}Avg. {avgPrice || '-'}{'  '}|{'  '}{item.Exchange}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
                    <Text
                        variant="caption"
                        style={{ color: tokens.colors.text.muted, fontSize: 11 }}
                    >
                        {formatOrderDate(
                            isBuy
                                ? item.purchaseDate || item.date
                                : item.exitDate || item.purchaseDate || item.date
                        )}
                    </Text>
                </View>
            </View>

            <View
                style={{
                    flexDirection: 'row',
                    paddingHorizontal: 10,
                    borderRadius: 3,
                    backgroundColor: color1,
                    alignItems: 'flex-end',
                    alignSelf: 'flex-end',
                    marginTop: 10,
                }}
            >
                <Icon Component={StatusIconComponent} size={13} color={color2} />
                <Text
                    variant="caption"
                    style={{
                        fontSize: 13,
                        color: color2,
                        marginLeft: 3,
                        fontFamily: 'Satoshi-Medium',
                    }}
                >
                    {getOrderStatusDisplay(item.trade_place_status)}{' '}
                </Text>
            </View>

            {showReason && rejectionReason ? (
                <View
                    style={{
                        marginTop: 8,
                        backgroundColor: '#FFF5F5',
                        borderRadius: tokens.radii.sm,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderLeftWidth: 3,
                        borderLeftColor: tokens.colors.status.danger,
                    }}
                >
                    <Text variant="caption" style={{ color: '#555', fontSize: 11 }}>
                        Reason: {rejectionReason}
                    </Text>
                    {isSellAuthRejection(rejectionReason, item.classification) &&
                    getBrokerDdpiHelp(item?.user_broker) ? (
                        <TouchableOpacity
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                onDdpiHelpPress?.({ broker: item.user_broker });
                            }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={{ marginTop: 4, alignSelf: 'flex-start' }}
                        >
                            <Text
                                variant="caption"
                                style={{
                                    color: '#1E7E34',
                                    fontSize: 11,
                                    fontFamily: 'Satoshi-Bold',
                                    textDecorationLine: 'underline',
                                }}
                            >
                                What is DDPI / EDIS? How to enable →
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            ) : null}
        </TouchableOpacity>
    );
};

/**
 * memo() comparator: rows re-render only when their item-shape OR status
 * colours change. Without this, a parent re-render (e.g. on every keystroke
 * in OrderScreen's search box) re-renders every visible row — measurably
 * slow on lists of 30+ orders. The legacy OrderScreen had the same issue;
 * this fix lands as part of the Phase E.1 follow-up.
 */
const arePropsEqual = (prev, next) =>
    prev.item === next.item &&
    prev.color1 === next.color1 &&
    prev.color2 === next.color2 &&
    prev.onDdpiHelpPress === next.onDdpiHelpPress;

export default memo(OrderRow, arePropsEqual);
