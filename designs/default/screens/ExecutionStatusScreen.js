import React from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {designColor} from '../../../src/design/literalTokens';

const ExecutionStatusScreen = ({viewModel, actions}) => {
  const {
    state,
    executing,
    results,
    orders,
    errorMsg,
    requiresGuardedPublisher,
    needsRecompute,
    marketGateOpen,
    successCount,
    failedCount,
  } = viewModel;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={actions.onBack} style={styles.backBtn} disabled={executing}>
          <Text style={[styles.backBtnText, executing && styles.disabledBack]}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trade Details</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {state === 'confirm' && (
          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>Review & Confirm Orders</Text>
            <Text style={styles.statusDesc}>{orders?.length || 0} orders ready. Tap &quot;Place Order&quot; below to execute.</Text>
          </View>
        )}
        {executing && (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color={designColor('1a237e')} />
            <Text style={[styles.statusTitle, styles.executingTitle]}>Placing orders...</Text>
          </View>
        )}
        {state === 'done' && (
          <View style={[styles.statusBox, failedCount === 0 ? styles.statusSuccess : styles.statusPartial]}>
            <Text style={styles.statusTitle}>
              {failedCount === 0 ? 'All Orders Placed' : `${successCount} Placed, ${failedCount} Failed`}
            </Text>
          </View>
        )}
        {state === 'error' && (
          <View style={[styles.statusBox, styles.statusError]}>
            <Text style={styles.statusTitle}>Execution Failed</Text>
            <Text style={styles.statusDesc}>{errorMsg}</Text>
          </View>
        )}
        {state === 'confirm' && orders?.map((order, index) => (
          <View key={`order-${index}`} style={styles.orderRow}>
            <View style={[styles.badge, (order.transactionType || '').toUpperCase() === 'BUY' ? styles.badgeBuy : styles.badgeSell]}>
              <Text style={styles.badgeText}>{(order.transactionType || 'BUY').toUpperCase()}</Text>
            </View>
            <Text style={styles.orderSymbol} numberOfLines={1}>{order.symbol || order.tradingSymbol}</Text>
            <Text style={styles.orderQty}>Qty: {order.quantity}</Text>
            <Text style={styles.orderPrice}>₹{Number(order.price || 0).toFixed(1)}</Text>
          </View>
        ))}
        {state === 'done' && results.map((result, index) => (
          <View key={`result-${index}`} style={styles.orderRow}>
            <View style={[styles.badge, result.status === 'success' ? styles.badgeBuy : result.status === 'failed' ? styles.badgeSell : styles.badgePending]}>
              <Text style={styles.badgeText}>{result.status === 'success' ? '✓' : result.status === 'failed' ? '✗' : '...'}</Text>
            </View>
            <View style={styles.resultBody}>
              <Text style={styles.orderSymbol}>{result.symbol}</Text>
              {result.message ? <Text style={styles.errorMsg}>{result.message}</Text> : null}
            </View>
            <Text style={styles.orderQty}>Qty: {result.quantity}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.bottomSection}>
        {state === 'confirm' && (
          <>
            <TouchableOpacity
              style={[styles.placeOrderBtn, !marketGateOpen && styles.placeOrderBtnDisabled]}
              onPress={actions.onPlaceOrder}
              disabled={!marketGateOpen}>
              <Text style={styles.placeOrderBtnText}>{marketGateOpen ? 'Place Order' : 'Market Closed'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.goBackBtn} onPress={actions.onBack}>
              <Text style={styles.goBackBtnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        )}
        {state === 'done' && (
          <TouchableOpacity style={styles.doneBtn} onPress={actions.onDone}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        )}
        {state === 'error' && (requiresGuardedPublisher ? (
          <TouchableOpacity style={styles.goBackBtn} onPress={actions.onBack}>
            <Text style={styles.goBackBtnText}>Go Back to Rebalance</Text>
          </TouchableOpacity>
        ) : needsRecompute ? (
          <TouchableOpacity style={styles.retryBtn} onPress={actions.onRecompute}>
            <Text style={styles.retryBtnText}>Recalculate</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.retryBtn} onPress={actions.onRetry}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.goBackBtn} onPress={actions.onBack}>
              <Text style={styles.goBackBtnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: designColor('f8f9fc')},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: designColor('1a237e')},
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backBtnText: {color: designColor('fff'), fontSize: 22, fontWeight: '600'},
  disabledBack: {opacity: 0.3},
  headerTitle: {color: designColor('fff'), fontSize: 17, fontWeight: '700'},
  headerSpacer: {width: 40},
  scrollContent: {padding: 16, paddingBottom: 140},
  statusBox: {padding: 18, backgroundColor: designColor('e8eaf6'), borderRadius: 14, marginBottom: 16, alignItems: 'center'},
  statusSuccess: {backgroundColor: designColor('e8f5e9')},
  statusPartial: {backgroundColor: designColor('fff8e1')},
  statusError: {backgroundColor: designColor('ffebee')},
  statusTitle: {fontSize: 16, fontWeight: '700', color: designColor('333')},
  executingTitle: {marginTop: 8},
  statusDesc: {fontSize: 13, color: designColor('666'), marginTop: 6, textAlign: 'center', lineHeight: 20},
  orderRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, backgroundColor: designColor('fff'), borderBottomWidth: 1, borderBottomColor: designColor('f0f0f0')},
  badge: {paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10},
  badgeBuy: {backgroundColor: designColor('e8f5e9')},
  badgeSell: {backgroundColor: designColor('ffebee')},
  badgePending: {backgroundColor: designColor('fff8e1')},
  badgeText: {fontSize: 10, fontWeight: '700'},
  resultBody: {flex: 1},
  orderSymbol: {flex: 1, fontSize: 13, fontWeight: '600', color: designColor('333')},
  orderQty: {fontSize: 12, color: designColor('666'), marginRight: 12},
  orderPrice: {fontSize: 12, fontWeight: '500', color: designColor('555')},
  errorMsg: {fontSize: 11, color: designColor('ef5350'), marginTop: 2},
  bottomSection: {position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: designColor('f8f9fc'), borderTopWidth: 1, borderTopColor: designColor('e0e0e0')},
  placeOrderBtn: {backgroundColor: designColor('2e7d32'), paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginBottom: 8},
  placeOrderBtnDisabled: {backgroundColor: designColor('999')},
  placeOrderBtnText: {color: designColor('fff'), fontSize: 16, fontWeight: '700'},
  goBackBtn: {paddingVertical: 12, alignItems: 'center'},
  goBackBtnText: {color: designColor('1a237e'), fontSize: 14, fontWeight: '600'},
  doneBtn: {backgroundColor: designColor('1a237e'), paddingVertical: 15, borderRadius: 14, alignItems: 'center'},
  doneBtnText: {color: designColor('fff'), fontSize: 16, fontWeight: '700'},
  retryBtn: {backgroundColor: designColor('ff9800'), paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginBottom: 8},
  retryBtnText: {color: designColor('fff'), fontSize: 16, fontWeight: '700'},
});

export default ExecutionStatusScreen;
