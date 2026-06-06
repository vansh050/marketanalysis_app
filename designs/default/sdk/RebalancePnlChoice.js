/**
 * designs/default/sdk/RebalancePnlChoice.js
 *
 * Default: "Rebalance based on" toggle shown before executeRebalance.
 * Props: { investedAmount, currentValue, netPnl, onChoose(includePnl: boolean) }
 *
 * Shows two options:
 * 1. Invested amount only (₹50,000)
 * 2. Invested + P&L (₹55,000 — includes growth)
 * User taps one → onChoose fires with includePnl true/false.
 */
import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

export default function RebalancePnlChoice({investedAmount, currentValue, netPnl, onChoose}) {
  const pnlPositive = (netPnl || 0) >= 0;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rebalance based on</Text>

      <TouchableOpacity style={styles.option} onPress={() => onChoose(false)}>
        <Text style={styles.optionTitle}>Original Investment</Text>
        <Text style={styles.optionValue}>₹{(investedAmount || 0).toLocaleString('en-IN')}</Text>
        <Text style={styles.optionDesc}>Ignore portfolio growth/decline</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.option, styles.optionRecommended]} onPress={() => onChoose(true)}>
        <View style={styles.badge}><Text style={styles.badgeText}>RECOMMENDED</Text></View>
        <Text style={styles.optionTitle}>Investment + P&L</Text>
        <Text style={[styles.optionValue, {color: pnlPositive ? '#16a34a' : '#ef4444'}]}>
          ₹{(currentValue || 0).toLocaleString('en-IN')}
        </Text>
        <Text style={styles.optionDesc}>
          {pnlPositive ? '+' : ''}₹{Math.abs(netPnl || 0).toLocaleString('en-IN')} P&L (net of costs)
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 20},
  title: {fontSize: 18, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 16},
  option: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  optionRecommended: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  badge: {backgroundColor: '#16a34a', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8},
  badgeText: {color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5},
  optionTitle: {fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 4},
  optionValue: {fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 4},
  optionDesc: {fontSize: 13, color: '#6b7280'},
});
