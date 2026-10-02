import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {basketOrderIdentity} from '../../utils/basketOrderState';

import { designColor } from '../../design/literalTokens';

const PendingBasketOrdersPanel = ({
  trades = [], basketId, broker, cancellingOrderIds = {}, onCancel,
}) => {
  if (!trades.length) return null;
  return (
    <View style={styles.container} testID="pending-basket-orders-panel">
      <Text style={styles.title}>Broker confirmation pending</Text>
      <Text style={styles.help}>
        Wait for confirmation, or cancel the live broker order. Retry stays locked until cancellation is confirmed.
      </Text>
      {trades.map(trade => {
        const identity = basketOrderIdentity(trade, basketId, broker);
        const symbol = trade?.Symbol || trade?.symbol || trade?.tradingSymbol || 'Basket leg';
        const isCancelling = Boolean(identity.orderId && cancellingOrderIds[identity.orderId]);
        return (
          <View key={identity.tradeId || identity.orderId || symbol} style={styles.row}>
            <View style={styles.labelWrap}>
              <Text style={styles.symbol}>{symbol}</Text>
              <Text style={styles.status}>
                {String(trade?.trade_place_status || 'pending') + ' · ' +
                  (identity.orderId || 'order ID unavailable')}
              </Text>
            </View>
            <TouchableOpacity
              testID={`cancel-pending-order-${identity.tradeId || 'unavailable'}`}
              accessibilityRole="button"
              accessibilityLabel={`Cancel pending order for ${symbol}`}
              style={[
                styles.cancelButton,
                (!identity.canCancel || isCancelling) && styles.disabled,
              ]}
              disabled={!identity.canCancel || isCancelling}
              onPress={() => onCancel(trade, identity)}>
              <Text style={styles.cancelText}>
                {isCancelling ? 'Cancelling…' : 'Cancel order'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: designColor('fff7ed'), borderWidth: 1, borderColor: designColor('fdba74')},
  title: {fontSize: 13, fontWeight: '700', color: designColor('9a3412')},
  help: {fontSize: 11, lineHeight: 16, color: designColor('7c2d12'), marginTop: 3, marginBottom: 8},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: designColor('fdba74')},
  labelWrap: {flex: 1},
  symbol: {fontSize: 12, fontWeight: '700', color: designColor('431407')},
  status: {fontSize: 10, color: designColor('9a3412'), marginTop: 2},
  cancelButton: {paddingHorizontal: 10, paddingVertical: 7, borderRadius: 6, backgroundColor: designColor('c2410c')},
  cancelText: {fontSize: 11, fontWeight: '700', color: designColor('ffffff')},
  disabled: {opacity: 0.45},
});

export default PendingBasketOrdersPanel;
