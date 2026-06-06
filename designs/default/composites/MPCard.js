/**
 * MPCard — design-system composite presentation (Phase I, 2026-05-02)
 *
 * Pure presentation for a Model Portfolio plan card on the subscription screen.
 * Container owns useConfig, useGstConfig, useNavigation, Animated.Value,
 * subscription status computation, pricing option computation, consent state.
 *
 * Contract:
 *   viewModel = {
 *     // identity
 *     modelName,           // string
 *     imageUri,            // string | null — resolved image URL
 *     fallbackImage,       // ImageSource — local fallback
 *     description,         // string | null
 *     // theme
 *     gradient1, gradient2, mainColor,
 *     stepCompletedColor,  // string — for Save tag gradient
 *     // pricing
 *     currentPrice,        // number
 *     originalPrice,       // number
 *     discount,            // number (percentage)
 *     pricingOptions,      // [{ period, label, value }]
 *     selectedPricing,     // string — currently selected period key
 *     gstText,             // string | null — e.g. 'including GST' or '+ GST'
 *     // stats
 *     minInvestment,       // number | null
 *     volatility,          // number | string | null
 *     volatilityColorStyle, // style object — computed color for volatility text
 *     cagrDisplay,         // string — 'View' / 'Loading...' / '12.34%' / 'New Portfolio'
 *     cagrClickable,       // boolean — true when consent not yet given
 *     globalConsent,       // boolean — controls blur on volatility
 *     // subscription
 *     status,              // 'active' | 'renew' | 'expired' | 'none'
 *     buttonLabel,         // string — 'Subscribed' / 'Renew Now' / 'Resubscribe' / 'Subscribe'
 *     buttonBgColor,       // string
 *     buttonTextColor,     // string
 *     // expansion
 *     isExpanded,          // boolean
 *   }
 *   actions = {
 *     onSelectPricing,     // (period: string) => void
 *     onViewMore,          // () => void — handleCardClick
 *     onSubscribe,         // () => void — handleSubscribe / InvestNow
 *     onConsentOpen,       // () => void — opens consent popup
 *   }
 *   slots = {
 *     ConsentPopupSlot,    // ReactElement | null — <ConsentPopup> pre-built by container
 *   }
 */

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Gauge, TrendingUp } from 'lucide-react-native';

const { width: screenWidth } = Dimensions.get('window');

const MPCard = ({ viewModel, actions, slots }) => {
  const {
    modelName = '',
    imageUri = null,
    fallbackImage,
    description = '',
    gradient1 = '#002651',
    gradient2 = '#0076fb',
    mainColor = 'rgba(0, 86, 183, 1)',
    stepCompletedColor = '#58a100',
    currentPrice = 0,
    originalPrice = 0,
    discount = 0,
    pricingOptions = [],
    selectedPricing = null,
    gstText = null,
    minInvestment = null,
    volatility = null,
    volatilityColorStyle = {},
    cagrDisplay = 'View',
    cagrClickable = true,
    globalConsent = false,
    isExpanded = false,
    buttonLabel = 'Subscribe',
    buttonBgColor = '#fff',
    buttonTextColor = '#0056B7',
  } = viewModel || {};

  const {
    onSelectPricing = () => {},
    onViewMore = () => {},
    onSubscribe = () => {},
    onConsentOpen = () => {},
  } = actions || {};

  const { ConsentPopupSlot = null } = slots || {};

  return (
    <View style={styles.container}>
      <View activeOpacity={0.9}>
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.cardContainer,
            {
              borderBottomLeftRadius: isExpanded ? 0 : 8,
              borderBottomRightRadius: isExpanded ? 0 : 8,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Image
                source={imageUri ? { uri: imageUri } : fallbackImage}
                style={styles.logo}
              />
            </View>
            <Text style={styles.portfolioTitle}>{modelName || 'ZC Leaders Portfolio'}</Text>
          </View>

          {/* Price Section */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0 }}>
            <View style={styles.priceSection}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.currentPrice}>
                  {'₹'} {currentPrice ? currentPrice.toFixed(2) : 0}
                </Text>
                {discount > 0 && (
                  <Text style={styles.originalPrice}>{'₹'} {originalPrice?.toFixed(2)}</Text>
                )}
              </View>
              {gstText && (
                <Text style={styles.gstLabel}>{gstText}</Text>
              )}
            </View>
            {discount > 0 && (
              <LinearGradient
                colors={[stepCompletedColor, stepCompletedColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveTag}
              >
                <Text style={styles.saveTagText}>Save {discount}%</Text>
              </LinearGradient>
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {pricingOptions.map(option => {
              const isSelected = option.period === selectedPricing;
              return (
                <TouchableOpacity
                  key={option.period}
                  onPress={() => onSelectPricing(option.period)}
                  style={{
                    paddingVertical: 2,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
                    borderWidth: isSelected ? 0 : 1,
                    borderColor: isSelected ? 'transparent' : 'rgba(255, 255, 255, 0.6)',
                    marginRight: 8,
                    marginBottom: 8,
                    shadowColor: isSelected ? '#000' : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isSelected ? 0.2 : 0,
                    shadowRadius: isSelected ? 2 : 0,
                    elevation: isSelected ? 2 : 0,
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 10,
                      marginTop: 2,
                      fontFamily: 'Poppins-Medium',
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Min. Investment</Text>
                <View style={styles.statIconContainer}>
                  <Text style={styles.statIcon}>{'₹'}</Text>
                </View>
              </View>
              <Text style={styles.statValue}>
                {minInvestment != null ? `₹ ${minInvestment.toFixed(2)}` : '-'}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Volatility</Text>
                <View style={styles.statIconContainer}>
                  <Gauge style={{ alignSelf: 'center' }} size={11} color={mainColor} />
                </View>
              </View>
              <Text
                style={[
                  styles.volatilityText,
                  !globalConsent && styles.blurText,
                  volatilityColorStyle,
                ]}
              >
                {volatility ?? '--'}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>CAGR</Text>
                <View style={styles.statIconContainer}>
                  <TrendingUp size={11} color="rgba(41, 164, 0, 1)" />
                </View>
              </View>
              <TouchableOpacity
                onPress={onConsentOpen}
                disabled={!cagrClickable}
              >
                <Text style={[styles.cagrValue, { color: mainColor }]}>
                  {cagrDisplay}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity onPress={onViewMore} style={styles.viewMoreButton}>
              <Text style={styles.viewMoreText}>View More</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSubscribe}
              style={[styles.subscribeButton, { backgroundColor: buttonBgColor }]}
            >
              <Text style={[styles.subscribeText, { color: buttonTextColor }]}>
                {buttonLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Expanded Section */}
      {isExpanded && (
        <Animated.View style={styles.animatedSection}>
          <View style={styles.expandedContent}>
            <Text style={[styles.descriptionText, { color: mainColor }]}>
              <Text style={[styles.overviewLabel, { color: mainColor }]}>{'•'} Overview : </Text>
              {description || '-'}
            </Text>
          </View>
        </Animated.View>
      )}
      {ConsentPopupSlot}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: 8, marginVertical: 8, elevation: 8 },
  cardContainer: {
    borderTopRightRadius: 8,
    borderTopLeftRadius: 8,
    width: screenWidth - 30,
    maxWidth: screenWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 0,
  },
  saveTag: {
    position: 'absolute',
    right: -10,
    top: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  saveTagText: { color: '#fff', fontSize: 8, fontFamily: 'Poppins-SemiBold', alignSelf: 'center' },
  headerSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  logoContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 0,
    marginRight: 12,
  },
  logo: { width: 32, height: 32, borderRadius: 8 },
  portfolioTitle: { color: '#fff', fontSize: 18, fontFamily: 'Poppins-SemiBold', flex: 1 },
  priceSection: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  currentPrice: { color: '#fff', fontSize: 14, fontFamily: 'Poppins-Bold' },
  originalPrice: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Poppins-Regular', textDecorationLine: 'line-through' },
  gstLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Poppins-Regular',
    marginTop: -2,
  },
  statsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 0, marginBottom: 20, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'flex-start', paddingVertical: 5, paddingHorizontal: 5, marginRight: 5 },
  statRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 12 },
  statIconContainer: { width: 14, height: 14, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statIcon: { color: '#000000ff', fontSize: 9, fontFamily: 'Poppins-Bold' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: 'Poppins-Medium', textAlign: 'center', marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 12, fontFamily: 'Poppins-SemiBold', alignSelf: 'flex-start' },
  volatilityText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  blurText: { opacity: 0.5 },
  cagrValue: { fontSize: 12, fontFamily: 'Poppins-SemiBold', alignSelf: 'flex-start' },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  actionContainer: { flexDirection: 'row', gap: 12 },
  viewMoreButton: { flex: 1, backgroundColor: 'rgba(232, 232, 232, 0.58)', borderRadius: 3, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  viewMoreText: { color: '#fff', fontSize: 12, fontFamily: 'Poppins-Medium' },
  subscribeButton: { flex: 1, backgroundColor: '#fff', borderRadius: 3, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  subscribeText: { fontSize: 12, fontFamily: 'Poppins-SemiBold' },
  animatedSection: { backgroundColor: '#ECF3FE', elevation: 4, paddingHorizontal: 20, paddingVertical: 20, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginHorizontal: 16, borderWidth: 1, borderTopWidth: 0, borderColor: '#F3F4F6' },
  expandedContent: { alignItems: 'flex-start', justifyContent: 'flex-start' },
  descriptionText: { fontFamily: 'Poppins-Regular', fontSize: 13, lineHeight: 18, textAlign: 'left' },
  overviewLabel: { fontFamily: 'Poppins-SemiBold', fontSize: 13 },
});

export default MPCard;
