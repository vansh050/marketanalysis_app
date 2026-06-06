/**
 * ModelPFCard — design-system composite presentation (Phase I, 2026-05-02)
 *
 * Pure presentation for a subscribed Model Portfolio card in the Portfolio tab.
 * Container owns useTrade, useNavigation, axios (strategy + subscription data),
 * useWebSocketCurrentPrice, portfolioEvents listener, order-status filtering.
 *
 * Contract:
 *   viewModel = {
 *     modelName,           // string — display name
 *     imageUri,            // string | null — resolved image URL
 *     fallbackImage,       // ImageSource — local fallback
 *     repair,              // boolean — show repair badge
 *     totalInvested,       // number — computed invested value
 *     net_portfolio_updated, // object | null — latest portfolio snapshot (for PortfolioPercentage)
 *   }
 *   actions = {
 *     onCardPress,         // () => void — navigate to AfterSubscriptionScreen
 *   }
 *   slots = {
 *     PortfolioPercentageSlot, // ReactElement — <PortfolioPercentage> pre-built by container
 *   }
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { ChevronRightIcon } from 'lucide-react-native';
import formatCurrency from '../../../src/utils/formatCurrency';

const ModelPFCard = ({ viewModel, actions, slots }) => {
  const {
    modelName = '',
    imageUri = null,
    fallbackImage,
    repair = false,
    totalInvested = 0,
  } = viewModel || {};
  const { onCardPress = () => {} } = actions || {};
  const { PortfolioPercentageSlot = null } = slots || {};

  return (
    <View style={styles.cardContainer}>
      <View style={styles.mobileView} onTouchEnd={onCardPress}>
        <View style={styles.mobileInfoContainer}>
          <Image
            source={imageUri ? { uri: imageUri } : fallbackImage}
            style={styles.mobileImage}
          />
          <View style={[styles.mobileTextContainer, { flex: 1 }]}>
            <Text style={styles.mobileModelName} numberOfLines={2}>{modelName}</Text>
            {repair && (
              <View style={styles.repairBadge}>
                <Text style={styles.repairText}>Repair</Text>
                <ChevronRightIcon style={styles.icon} />
              </View>
            )}
          </View>
        </View>
        <View style={styles.valueContainer}>
          <Text style={styles.mobileValueText}>
            {'₹'}{formatCurrency(totalInvested.toFixed(2))}/-
          </Text>
          {PortfolioPercentageSlot}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#fff',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 15,
  },
  mobileView: {
    flexDirection: 'row',
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    paddingBottom: 5,
    borderBottomColor: '#CCCCCC',
  },
  mobileInfoContainer: {
    flexDirection: 'row',
    alignContent: 'flex-start',
    alignItems: 'flex-start',
    flex: 1,
  },
  mobileImage: {
    width: 40,
    height: 38,
    marginRight: 5,
  },
  mobileTextContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingLeft: 10,
  },
  mobileModelName: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
  },
  repairBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DE8846',
    borderRadius: 3,
    padding: 4,
    alignSelf: 'flex-start',
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
  valueContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 90,
  },
  mobileValueText: {
    color: '#000',
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
  },
});

export default ModelPFCard;
