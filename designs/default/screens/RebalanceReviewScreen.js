import React from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {designColor} from '../../../src/design/literalTokens';

const OrderRow = ({order, side}) => (
  <View style={styles.orderRow}>
    <View style={[styles.badge, side === 'BUY' ? styles.badgeBuy : styles.badgeSell]}>
      <Text style={styles.badgeText}>{side}</Text>
    </View>
    <Text style={styles.orderSymbol} numberOfLines={1}>{order.symbol || order.tradingSymbol}</Text>
    <Text style={styles.orderQty}>Qty: {order.quantity}</Text>
    <Text style={styles.orderPrice}>₹{Number(order.price || 0).toFixed(1)}</Text>
  </View>
);

const RebalanceReviewScreen = ({viewModel, actions, slots}) => {
  const {
    loading,
    errorMsg,
    alreadyAligned,
    buyOrders,
    sellOrders,
    funding,
    fundingConsent,
    reducingFunding,
    termsAccepted,
    isDummyBroker,
  } = viewModel;
  const {LowFundsWarning} = slots;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={designColor('1a237e')} />
        <Text style={styles.loadingText}>Calculating rebalance...</Text>
      </View>
    );
  }
  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Calculation Failed</Text>
        <Text style={styles.errorDesc}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={actions.onRetry}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.goBackBtn} onPress={actions.onBack}>
          <Text style={styles.goBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (alreadyAligned) {
    return (
      <View style={styles.center}>
        <Text style={styles.alignedIcon}>✓</Text>
        <Text style={styles.alignedTitle}>Already Aligned</Text>
        <Text style={styles.alignedDesc}>Your portfolio matches the model allocation. No trades needed.</Text>
        <TouchableOpacity style={styles.continueBtn} onPress={actions.onConfirmAligned}>
          <Text style={styles.continueBtnText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalOrders = buyOrders.length + sellOrders.length;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={actions.onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Rebalance</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryText}>{buyOrders.length} BUY + {sellOrders.length} SELL = {totalOrders} orders</Text>
          {Number(funding?.activeBudget) > 0 && (
            <Text style={styles.summaryText}>
              Model capital ₹{Number(funding?.verifiedPortfolioCapital || 0).toLocaleString('en-IN')} · Broker cash ₹{Number(funding?.liveBrokerCashTotal ?? funding?.liveAvailableCash ?? 0).toLocaleString('en-IN')} · Order budget ₹{Number(funding?.activeBudget || 0).toLocaleString('en-IN')}
            </Text>
          )}
        </View>
        {fundingConsent?.show && (
          <View style={styles.fundingConsentContainer}>
            <Text style={styles.fundingConsentTitle}>
              Investment target: ₹{Number(fundingConsent.desiredAmount || 0).toLocaleString('en-IN')}. This calculation: ₹{Number(fundingConsent.fundedAmount || 0).toLocaleString('en-IN')}. Remaining funding: ₹{Number(fundingConsent.shortfall || 0).toLocaleString('en-IN')}.
            </Text>
            <Text style={styles.fundingConsentText}>
              Add ₹{Number(fundingConsent.shortfall || 0).toLocaleString('en-IN')}{fundingConsent.canContinueWithAvailableFunds ? ' to include everything, or continue with available funds for this calculation' : fundingConsent.canAttemptWithInsufficientFunds ? ', or review the target stocks and attempt the buy. Your broker may reject the orders' : ' to your broker, then calculate again'}. Your investment target stays unchanged. Going back makes no change.
            </Text>
            {fundingConsent.canContinueWithAvailableFunds && (
              <TouchableOpacity disabled={reducingFunding} onPress={actions.onContinueAvailableFunds} style={styles.fundingPrimaryButton}>
                <Text style={styles.fundingPrimaryButtonText}>{reducingFunding ? 'Recalculating…' : 'Continue with available funds'}</Text>
              </TouchableOpacity>
            )}
            {fundingConsent.canAttemptWithInsufficientFunds && (
              <TouchableOpacity disabled={reducingFunding} onPress={actions.onAttemptInsufficientFunds} style={styles.fundingPrimaryButton}>
                <Text style={styles.fundingPrimaryButtonText}>{reducingFunding ? 'Preparing orders…' : 'Review stocks and attempt buy'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity disabled={reducingFunding} onPress={actions.onShowAddFunds} style={styles.fundingSecondaryButton}>
              <Text style={styles.fundingSecondaryButtonText}>
                {fundingConsent.canContinueWithAvailableFunds || fundingConsent.canAttemptWithInsufficientFunds ? 'Add funds instead' : 'How to add funds'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {buyOrders.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>BUY Orders</Text>
            {buyOrders.map((order, index) => <OrderRow key={`buy-${index}`} order={order} side="BUY" />)}
          </>
        )}
        {sellOrders.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>SELL Orders</Text>
            {sellOrders.map((order, index) => <OrderRow key={`sell-${index}`} order={order} side="SELL" />)}
          </>
        )}
        <LowFundsWarning
          availableCash={funding?.marginProjection?.estBuyingPowerToday ?? funding?.marginProjection?.estBuyingPowerAfterSettlement ?? funding?.calculationCashAvailable ?? funding?.verifiedModelCash}
          additionalFundsRequired={funding?.additionalFundsRequired}
          fundingGapToday={funding?.fundingGapToday}
          deferredSellProceeds={funding?.marginProjection?.deferredSellProceeds}
          t1RiskCost={funding?.t1RiskCost ?? funding?.marginProjection?.t1RiskCost}
          t1RiskLegCount={(funding?.t1RiskBuys ?? funding?.marginProjection?.t1RiskBuys ?? []).length}
          fundingAdjusted={!!funding?.fundingAdjusted}
          pricesReady={!loading && buyOrders.length > 0}
        />
        {!fundingConsent?.required && (
          <TouchableOpacity style={styles.checkboxRow} onPress={actions.onToggleTerms}>
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>I understand the risks and confirm these orders should be placed.</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <View style={styles.bottomSection}>
        {!fundingConsent?.required && (
          <TouchableOpacity
            style={[styles.executeBtn, !termsAccepted && styles.executeBtnDisabled]}
            onPress={actions.onExecute}
            disabled={!termsAccepted || loading || reducingFunding}>
            <Text style={styles.executeBtnText}>{isDummyBroker ? 'Confirm Manual Execution' : 'Accept & Execute Rebalance'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: designColor('f8f9fc')},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24},
  loadingText: {marginTop: 12, color: designColor('666'), fontSize: 14},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, backgroundColor: designColor('1a237e')},
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backBtnText: {color: designColor('fff'), fontSize: 22, fontWeight: '600'},
  headerTitle: {color: designColor('fff'), fontSize: 17, fontWeight: '700'},
  headerSpacer: {width: 40},
  errorIcon: {width: 56, height: 56, borderRadius: 28, backgroundColor: designColor('ef5350'), color: designColor('fff'), fontSize: 28, fontWeight: '700', textAlign: 'center', lineHeight: 56, marginBottom: 16},
  errorTitle: {fontSize: 20, fontWeight: '700', color: designColor('333'), marginBottom: 8},
  errorDesc: {fontSize: 14, color: designColor('666'), textAlign: 'center', marginBottom: 24, lineHeight: 20},
  retryBtn: {backgroundColor: designColor('1a237e'), paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, marginBottom: 12},
  retryBtnText: {color: designColor('fff'), fontSize: 15, fontWeight: '700'},
  goBackBtn: {paddingVertical: 10, paddingHorizontal: 24},
  goBackBtnText: {color: designColor('1a237e'), fontSize: 14, fontWeight: '600'},
  alignedIcon: {width: 56, height: 56, borderRadius: 28, backgroundColor: designColor('4caf50'), color: designColor('fff'), fontSize: 28, fontWeight: '700', textAlign: 'center', lineHeight: 56, marginBottom: 16},
  alignedTitle: {fontSize: 20, fontWeight: '700', color: designColor('333'), marginBottom: 8},
  alignedDesc: {fontSize: 14, color: designColor('666'), textAlign: 'center', marginBottom: 24},
  continueBtn: {backgroundColor: designColor('4caf50'), paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12},
  continueBtnText: {color: designColor('fff'), fontSize: 15, fontWeight: '700'},
  scrollContent: {padding: 16, paddingBottom: 100},
  summaryBox: {padding: 14, backgroundColor: designColor('e8eaf6'), borderRadius: 12, marginBottom: 16, alignItems: 'center'},
  summaryText: {fontSize: 14, fontWeight: '600', color: designColor('1a237e')},
  fundingConsentContainer: {padding: 14, backgroundColor: designColor('f8fafc'), borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: designColor('cbd5e1')},
  fundingConsentTitle: {fontSize: 13, fontWeight: '700', color: designColor('0f172a'), lineHeight: 20},
  fundingConsentText: {fontSize: 12, color: designColor('475569'), lineHeight: 18, marginTop: 6, marginBottom: 12},
  fundingPrimaryButton: {backgroundColor: designColor('0f172a'), paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center'},
  fundingPrimaryButtonText: {color: designColor('fff'), fontSize: 12, fontWeight: '700', textAlign: 'center'},
  fundingSecondaryButton: {backgroundColor: designColor('fff'), paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: designColor('cbd5e1'), marginTop: 8},
  fundingSecondaryButtonText: {color: designColor('334155'), fontSize: 12, fontWeight: '700'},
  sectionTitle: {fontSize: 14, fontWeight: '700', color: designColor('333'), marginTop: 12, marginBottom: 8},
  orderRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10, backgroundColor: designColor('fff'), borderBottomWidth: 1, borderBottomColor: designColor('f0f0f0')},
  badge: {paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 10},
  badgeBuy: {backgroundColor: designColor('e8f5e9')},
  badgeSell: {backgroundColor: designColor('ffebee')},
  badgeText: {fontSize: 10, fontWeight: '700'},
  orderSymbol: {flex: 1, fontSize: 13, fontWeight: '600', color: designColor('333')},
  orderQty: {fontSize: 12, color: designColor('666'), marginRight: 12},
  orderPrice: {fontSize: 12, fontWeight: '500', color: designColor('555')},
  checkboxRow: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, paddingHorizontal: 4},
  checkbox: {width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: designColor('ccc'), justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 1},
  checkboxChecked: {backgroundColor: designColor('1a237e'), borderColor: designColor('1a237e')},
  checkmark: {color: designColor('fff'), fontSize: 14, fontWeight: '700'},
  checkboxLabel: {flex: 1, fontSize: 13, color: designColor('555'), lineHeight: 20},
  bottomSection: {position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: designColor('f8f9fc'), borderTopWidth: 1, borderTopColor: designColor('e0e0e0')},
  executeBtn: {backgroundColor: designColor('1a237e'), paddingVertical: 15, borderRadius: 14, alignItems: 'center'},
  executeBtnDisabled: {opacity: 0.4},
  executeBtnText: {color: designColor('fff'), fontSize: 16, fontWeight: '700'},
});

export default RebalanceReviewScreen;
