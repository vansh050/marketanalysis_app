import React, {useState} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';

import { designColor } from '../design/literalTokens';

/** Backend-authoritative funding disclosure for a fitted rebalance basket. */
const inr = n =>
  Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const LowFundsRebalanceWarning = ({
  availableCash,
  pricesReady = true,
  formatCurrency,
  additionalFundsRequired = 0,
  fundingGapToday = 0,
  deferredSellProceeds = 0,
  t1RiskCost = 0,
  t1RiskLegCount = 0,
  fundingAdjusted = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const availableNum = parseFloat(availableCash);
  const fundsFetched = availableCash != null && !isNaN(availableNum);
  const addFunds = Math.max(0, parseFloat(additionalFundsRequired) || 0);
  const todayGap = Math.max(0, parseFloat(fundingGapToday) || 0);
  const deferred = Math.max(0, parseFloat(deferredSellProceeds) || 0);
  const t1Risk = Math.max(0, parseFloat(t1RiskCost) || 0);
  const show =
    pricesReady &&
    (addFunds > 1 || todayGap > 1 || t1Risk > 1 || fundingAdjusted);
  if (!show) return null;

  const fmt = n =>
    typeof formatCurrency === 'function'
      ? formatCurrency(Number(n).toFixed(2))
      : inr(n);

  const B = ({children}) => <Text style={styles.bold}>{children}</Text>;

  let body;
  if (addFunds > 1) {
    body = (
      <Text style={styles.text}>
        <B>You can continue with the orders shown.</B> The orders shown have
        already been limited to verified buying power
        {fundsFetched ? ` of ₹${fmt(availableNum)}` : ''}. The remaining quantity needs about ₹{fmt(addFunds)} more buying power;
        it does not block these orders. Review the remainder when funds are available.
      </Text>
    );
  } else if (todayGap > 1 && deferred > 0 && t1Risk <= 1) {
    body = (
      <Text style={styles.text}>
        <B>₹{fmt(todayGap)} is waiting on T1 holdings.</B> Only ₹{fmt(deferred)}
        from the T1 portion is deferred. Today's quantities fit available
        funds; use <B>Repair after settlement</B> for the frozen remainder.
        No extra deposit or fresh allocation is required.
      </Text>
    );
  } else if (t1Risk > 1) {
    body = (
      <Text style={styles.text}>
        <B>Settlement-dependent buys are still included.</B>
      </Text>
    );
  } else {
    body = (
      <Text style={styles.text}>
        <B>Basket adjusted to available funds.</B> The displayed quantities fit
        broker-verified buying power. Continue with the orders shown and review the remaining quantity when funds are available.
      </Text>
    );
  }

  const t1Continuation = t1Risk > 1 ? (
    <Text style={styles.text}>
      {'\n'}
      <B>
        ₹{fmt(t1Risk)} across {t1RiskLegCount || 1} displayed buy
        {(t1RiskLegCount || 1) === 1 ? '' : 's'} depends on T1 sale proceeds.
      </B>{' '}
      These quantities remain in the basket. Check refreshed broker funds
      before continuing; if the broker still rejects them, use Repair after
      settlement. No additional deposit is required for this T1-only portion.
    </Text>
  ) : null;

  const summary = addFunds > 1
    ? 'Orders fitted to available funds'
    : t1Risk > 1
      ? 'Some buys depend on sell proceeds'
      : todayGap > 1
        ? 'Some orders continue after settlement'
        : 'Order quantities adjusted to available funds';

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⚠️</Text>
      <View style={styles.body}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Toggle funding details"
          onPress={() => setExpanded(value => !value)}
          style={styles.summaryButton}>
          <Text numberOfLines={1} style={styles.summary}>{summary}</Text>
          <Text style={styles.toggle}>{expanded ? 'Hide details' : 'View details'}</Text>
        </TouchableOpacity>
        {expanded ? (
          <View style={styles.details}>
            {body}
            {t1Continuation}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: designColor('fffbeb'),
    borderTopWidth: 1,
    borderColor: designColor('fde68a'),
    borderRadius: 8,
  },
  icon: {fontSize: 13, marginTop: 1},
  body: {flex: 1},
  summaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summary: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: designColor('92400e'),
  },
  toggle: {
    fontSize: 10,
    fontWeight: '700',
    color: designColor('92400e'),
  },
  details: {marginTop: 6},
  text: {fontSize: 11, lineHeight: 16, color: designColor('92400e')},
  bold: {fontWeight: '700', color: designColor('92400e')},
});

export default LowFundsRebalanceWarning;
