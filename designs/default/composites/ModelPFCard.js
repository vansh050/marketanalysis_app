/**
 * ModelPFCard — design-system composite presentation (Phase I, 2026-05-02;
 * invested-view upgrade 2026-07-19)
 *
 * Pure presentation for a subscribed Model Portfolio card in the Portfolio tab.
 * Container owns useTrade, useNavigation, axios (strategy + subscription data),
 * useWebSocketCurrentPrice, portfolioEvents listener, order-status filtering.
 *
 * 2026-07-19 upgrade (user-requested): the invested state used to render a
 * bare "name — ₹X/-" row, far poorer than the pre-invest marketing card.
 * Now a proper card: header (image, name, chevron affordance), a metrics row
 * (Invested / Holdings / Last rebalance), the live returns slot, and an
 * explicit "investment pending" state when the user is subscribed but no
 * executed orders exist yet (totalInvested === 0) — which previously showed
 * a confusing "₹0/-" with no explanation. Fleet colour rule respected: the
 * returns slot owns profit/loss colouring; this card introduces no red.
 *
 * Contract:
 *   viewModel = {
 *     modelName,             // string — display name
 *     imageUri,              // string | null — resolved image URL
 *     fallbackImage,         // ImageSource — local fallback
 *     repair,                // boolean — show repair badge
 *     totalInvested,         // number — computed invested value
 *     net_portfolio_updated, // object | null — latest snapshot (for PortfolioPercentage)
 *     cardColor,             // string | null — optional per-index accent color
 *                             //   (moneyman_app variant cycles 3 colors by row index;
 *                             //   default variant leaves this null → no visual change)
 *     holdingsCount,         // number — executed holdings in latest snapshot (NEW 2026-07-19)
 *     lastRebalanceDate,     // string | Date | null — latest rebalance date (NEW 2026-07-19)
 *   }
 *   actions = {
 *     onCardPress,           // () => void — navigate to AfterSubscriptionScreen
 *     onInvestPress,         // () => void — pending-state Invest CTA: route to the
 *                             //   Home tab + trigger Accept Rebalance (falls back
 *                             //   to onCardPress when absent)
 *   }
 *   slots = {
 *     PortfolioPercentageSlot, // ReactElement — <PortfolioPercentage> pre-built by container
 *   }
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRightIcon } from 'lucide-react-native';
import formatCurrency from '../../../src/utils/formatCurrency';

const formatRebalanceDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const ModelPFCard = ({ viewModel, actions, slots }) => {
  const {
    modelName = '',
    imageUri = null,
    fallbackImage,
    repair = false,
    totalInvested = 0,
    cardColor = null,
    holdingsCount = 0,
    lastRebalanceDate = null,
  } = viewModel || {};
  const { onCardPress = () => {}, onInvestPress } = actions || {};
  const { PortfolioPercentageSlot = null } = slots || {};

  const invested = Number(totalInvested) > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onCardPress}
      style={[
        styles.cardContainer,
        cardColor && { borderLeftWidth: 4, borderLeftColor: cardColor },
      ]}
    >
      {/* Header: image + name + repair badge + details chevron */}
      <View style={styles.headerRow}>
        <Image
          source={imageUri ? { uri: imageUri } : fallbackImage}
          style={styles.mobileImage}
        />
        <View style={styles.headerTextWrap}>
          <Text
            style={[styles.mobileModelName, cardColor && { color: cardColor }]}
            numberOfLines={2}
          >
            {modelName}
          </Text>
          {repair && (
            <View style={styles.repairBadge}>
              <Text style={styles.repairText}>Repair</Text>
              <ChevronRightIcon style={styles.icon} />
            </View>
          )}
        </View>
        <ChevronRightIcon style={styles.chevron} />
      </View>

      {invested ? (
        <>
          {/* Metrics row: Invested / Holdings / Last rebalance */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCell}>
              <Text style={styles.metricLabel}>Invested</Text>
              <Text style={styles.metricValue}>
                {'₹'}{formatCurrency(Number(totalInvested).toFixed(2))}
              </Text>
            </View>
            <View style={[styles.metricCell, styles.metricCellMid]}>
              <Text style={styles.metricLabel}>Holdings</Text>
              <Text style={styles.metricValue}>{holdingsCount}</Text>
            </View>
            <View style={[styles.metricCell, styles.metricCellEnd]}>
              <Text style={styles.metricLabel}>Last rebalance</Text>
              <Text style={styles.metricValue}>
                {formatRebalanceDate(lastRebalanceDate)}
              </Text>
            </View>
          </View>

          {/* Returns line — the slot owns live LTP maths + p/l colouring */}
          <View style={styles.returnsRow}>
            <Text style={styles.metricLabel}>Returns</Text>
            <View style={styles.returnsSlotWrap}>{PortfolioPercentageSlot}</View>
          </View>
        </>
      ) : (
        /* Subscribed but nothing executed yet — explain instead of "₹0/-" */
        <View style={styles.pendingRow}>
          <View style={styles.pendingTextWrap}>
            <Text style={styles.pendingTitle}>Investment pending</Text>
            <Text style={styles.pendingBody} numberOfLines={3}>
              You're subscribed
              {lastRebalanceDate
                ? ` — a rebalance from ${formatRebalanceDate(lastRebalanceDate)} is waiting`
                : ''}
              . Complete your first investment to start tracking returns here.
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onInvestPress || onCardPress}
            style={styles.pendingCta}
          >
            <Text style={styles.pendingCtaText}>Invest</Text>
            <ChevronRightIcon style={styles.pendingCtaIcon} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
    paddingLeft: 10,
  },
  mobileImage: {
    width: 40,
    height: 38,
    borderRadius: 6,
  },
  mobileModelName: {
    color: '#111827',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  chevron: {
    color: '#9CA3AF',
    width: 18,
    height: 18,
  },
  repairBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DE8846',
    borderRadius: 3,
    padding: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  repairText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  icon: {
    color: '#FFFFFF',
    width: 12,
    height: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metricCell: {
    flex: 1,
  },
  metricCellMid: {
    alignItems: 'center',
  },
  metricCellEnd: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: '#6B7280',
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    color: '#111827',
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    marginTop: 2,
  },
  returnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  returnsSlotWrap: {
    alignItems: 'flex-end',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pendingTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  pendingTitle: {
    color: '#92400E',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  pendingBody: {
    color: '#6B7280',
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    marginTop: 2,
  },
  pendingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pendingCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  pendingCtaIcon: {
    color: '#FFFFFF',
    width: 14,
    height: 14,
  },
});

export default ModelPFCard;
