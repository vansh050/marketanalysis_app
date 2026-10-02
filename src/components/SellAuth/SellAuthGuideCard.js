/**
 * SellAuthGuideCard — the ONE sell-authorization explanation every broker's
 * sheet renders (plan items 2+3, 2026-10-01). Content comes from the server
 * guide (useSellAuthGuide); the sheet keeps its own action buttons.
 *
 * variant="inApp"  — we open the CDSL page: rule + what to approve + what
 *                    happens on the CDSL page.
 * variant="portal" — customer does it in the broker app: rule + what to
 *                    approve + broker steps + "Open <broker>".
 * Never claims a DDPI state we cannot read.
 */
import React from 'react';
import {View, Text, TouchableOpacity, Linking, StyleSheet} from 'react-native';
import useSellAuthGuide from '../../hooks/useSellAuthGuide';
import {designColor, designFont} from '../../design/literalTokens';

const sellLabel = order =>
  String(order?.tradingSymbol || order?.symbol || order?.Symbol || '').trim();
const sellQty = order =>
  order?.remainingQuantity ?? order?.quantity ?? order?.qty ?? order?.Quantity ?? null;

export default function SellAuthGuideCard({
  broker,
  configData,
  variant = 'portal',
  sellOrders = [],
  showSteps = true,
  testID = 'sell-auth-guide',
}) {
  const {rule, cdslSteps, guide} = useSellAuthGuide(broker, configData);
  const sells = (Array.isArray(sellOrders) ? sellOrders : [])
    .filter(o => String(o?.transactionType || o?.TransactionType || 'SELL').toUpperCase() === 'SELL')
    .filter(o => sellLabel(o));
  const steps = variant === 'inApp' ? cdslSteps || [] : guide?.steps || [];

  return (
    <View testID={testID}>
      <Text style={styles.title}>{rule?.title}</Text>
      <Text style={styles.summary}>{rule?.summary}</Text>

      {sells.length > 0 && (
        <View style={styles.box} testID="sell-auth-guide-sells">
          <Text style={styles.boxTitle}>Approve these on CDSL</Text>
          {sells.slice(0, 12).map((o, i) => (
            <Text key={`${sellLabel(o)}-${i}`} style={styles.sellRow}>
              {sellLabel(o)}
              {sellQty(o) != null ? `  ·  qty ${sellQty(o)}` : ''}
            </Text>
          ))}
          {sells.length > 12 && (
            <Text style={styles.sellRow}>+{sells.length - 12} more</Text>
          )}
        </View>
      )}

      {showSteps && steps.length > 0 && (
        <View style={styles.steps}>
          {variant === 'inApp' && (
            <Text style={styles.boxTitle}>On the next page</Text>
          )}
          {steps.map((step, i) => (
            <Text key={i} style={styles.step}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      )}

      {variant !== 'inApp' && !!guide?.openUrl && (
        <TouchableOpacity
          testID="sell-auth-guide-open-broker"
          onPress={() => Linking.openURL(guide.openUrl).catch(() => {})}
          style={styles.openBtn}>
          <Text style={styles.openBtnText}>Open {guide.broker}</Text>
        </TouchableOpacity>
      )}

      {!!guide?.note && <Text style={styles.note}>{guide.note}</Text>}

      <Text style={styles.note}>
        {rule?.ddpiTip}
        {guide?.ddpiUrl ? ' ' : ''}
        {guide?.ddpiUrl ? (
          <Text
            style={styles.link}
            onPress={() => Linking.openURL(guide.ddpiUrl).catch(() => {})}>
            How to activate DDPI
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    color: designColor('111827'),
    fontFamily: designFont('Poppins-SemiBold'),
    marginBottom: 4,
  },
  summary: {
    fontSize: 12,
    lineHeight: 18,
    color: designColor('374151'),
    fontFamily: designFont('Poppins-Regular'),
  },
  box: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: designColor('f9fafb'),
    borderWidth: 1,
    borderColor: designColor('e5e7eb'),
  },
  boxTitle: {
    fontSize: 12,
    color: designColor('111827'),
    fontFamily: designFont('Poppins-SemiBold'),
    marginBottom: 4,
  },
  sellRow: {
    fontSize: 12,
    color: designColor('374151'),
    fontFamily: designFont('Poppins-Regular'),
  },
  steps: {marginTop: 10},
  step: {
    fontSize: 12,
    lineHeight: 18,
    color: designColor('374151'),
    fontFamily: designFont('Poppins-Regular'),
    marginBottom: 2,
  },
  openBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: designColor('2563eb'),
  },
  openBtnText: {
    fontSize: 13,
    color: designColor('2563eb'),
    fontFamily: designFont('Poppins-SemiBold'),
  },
  note: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    color: designColor('6b7280'),
    fontFamily: designFont('Poppins-Regular'),
  },
  link: {
    color: designColor('2563eb'),
    textDecorationLine: 'underline',
  },
});
