import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

/**
 * Non-blocking low-funds / T+1-settlement pre-execution warning for a
 * model-portfolio rebalance. RN port of web
 * prod-alphaquark-github/src/components/LowFundsRebalanceWarning.jsx
 * (Phase C, C4-3 + C4-5).
 *
 * A model portfolio sizes its first-investment basket off the SUBSCRIBED
 * amount (the model minimum), NOT the customer's actual broker balance.
 * When the account holds less, placement runs sequentially and tail-end
 * buys are rejected for insufficient funds — a silent partial fill. This
 * warns BEFORE placement and NEVER blocks (sells may release funds T+1,
 * or the customer can add cash), so the Place Order button stays enabled.
 *
 * When the rebalance's SELL legs (pendingSellProceeds) cover the shortfall,
 * the gap is a settlement-TIMING gap (CNC equity sells settle T+1), so the
 * copy reframes from "add funds" to "some buys settle tomorrow — use
 * Repair, no extra funds needed".
 *
 * @param {number|string} availableCash broker available cash
 * @param {number|string} requiredFund  net buy value the rebalance needs
 * @param {boolean} pricesReady         render only once prices settled
 * @param {(n:number)=>string} formatCurrency optional grouping formatter
 * @param {number|string} pendingSellProceeds optional Σ sell qty×price
 */
const inr = n =>
  Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const LowFundsRebalanceWarning = ({
  availableCash,
  requiredFund,
  pricesReady = true,
  formatCurrency,
  pendingSellProceeds,
}) => {
  const availableNum = parseFloat(availableCash);
  const requiredNum = parseFloat(requiredFund) || 0;
  const fundsFetched = availableCash != null && !isNaN(availableNum);
  const shortfall = requiredNum - availableNum;
  const show =
    fundsFetched &&
    pricesReady &&
    requiredNum > 0 &&
    availableNum >= 0 &&
    shortfall > 1;
  if (!show) return null;

  const fmt = n =>
    typeof formatCurrency === 'function'
      ? formatCurrency(Number(n).toFixed(2))
      : inr(n);

  const proceedsNum = parseFloat(pendingSellProceeds) || 0;
  const sellsCoverShortfall = proceedsNum > 0 && proceedsNum >= shortfall;
  const residualAfterSells = Math.max(0, shortfall - proceedsNum);

  const B = ({children}) => <Text style={styles.bold}>{children}</Text>;

  let body;
  if (sellsCoverShortfall) {
    body = (
      <Text style={styles.text}>
        <B>Some buys may complete tomorrow, not today.</B> This rebalance needs
        ₹{fmt(requiredNum)} and about ₹{fmt(proceedsNum)} of that comes from
        today's sells — cash from selling usually settles the{' '}
        <B>next trading day (T+1)</B>, so a few buys may stay pending today.
        That's expected, not an error. Place the order to fill what settles
        today, then come back tomorrow and tap <B>Repair</B> to place the rest —
        no extra funds needed.
      </Text>
    );
  } else if (proceedsNum > 0) {
    body = (
      <Text style={styles.text}>
        <B>Some buys may wait for settlement.</B> This rebalance needs ₹
        {fmt(requiredNum)} vs ₹{fmt(availableNum)} available. About ₹
        {fmt(proceedsNum)} comes from today's sells (settles the next trading
        day, T+1), so some buys may stay pending today and can be placed
        tomorrow with <B>Repair</B>. You'll likely also need to add about ₹
        {fmt(residualAfterSells)} to complete the full portfolio.
      </Text>
    );
  } else {
    body = (
      <Text style={styles.text}>
        <B>Low funds:</B> this rebalance needs ₹{fmt(requiredNum)} but only ₹
        {fmt(availableNum)} is available (short by ₹{fmt(shortfall)}). You can
        still place the order, but some buys may be rejected for insufficient
        funds — add funds to execute the full portfolio.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⚠️</Text>
      <View style={styles.body}>{body}</View>
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
    backgroundColor: '#FFFBEB',
    borderTopWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
  },
  icon: {fontSize: 13, marginTop: 1},
  body: {flex: 1},
  text: {fontSize: 11, lineHeight: 16, color: '#92400E'},
  bold: {fontWeight: '700', color: '#92400E'},
});

export default LowFundsRebalanceWarning;
