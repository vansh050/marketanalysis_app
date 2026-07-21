/**
 * MPPerformanceScreen — design-system screen presentation (Phase I, 2026-05-02)
 *
 * Pure presentation. Container owns: useTrade, useConfig, useGstConfig,
 * useNavigation, Firebase getAuth, axios (5+ endpoints), CryptoJS decryption,
 * moment, fetchFunds, IsMarketHours, calculateRebalance, EDIS state (7 booleans),
 * subscription status, pricing options, consent state, chart data (useMemo).
 *
 * Contract:
 *   viewModel = {
 *     // identity
 *     modelName,
 *     // theme
 *     gradient1, gradient2, mainColor,
 *     stepCompletedColor,
 *     // header card
 *     imageUri,              // string | null
 *     fallbackImage,         // ImageSource
 *     currentPrice,          // number (display value, GST-adjusted)
 *     originalPrice,         // number
 *     discount,              // number
 *     gstLabel,              // string — e.g. ' (incl. GST)' or ''
 *     pricingOptions,        // [{ period, label, value }]
 *     selectedPricing,       // string
 *     minInvestment,         // number | null
 *     volatility,            // number | string | null
 *     frequency,             // string | null
 *     nextRebalanceDate,     // string — formatted
 *     // subscription
 *     isSubscribed,          // boolean — legacy subscribed flag
 *     subscriptionStatus,    // 'active' | 'renew' | 'expired' | 'none'
 *     investButtonLabel,     // string
 *     // tab
 *     tabIndex,              // number
 *     routes,                // [{ key, title }]
 *     isActive,              // boolean — subscription active (for tab lock)
 *     // research webview modal
 *     researchWebViewUrl,    // string | null
 *   }
 *   actions = {
 *     onGoBack,
 *     onSelectPricing,
 *     onConsentOpen,
 *     onTabIndexChange,
 *     onInvestNow,
 *     onCloseResearchWebView,
 *   }
 *   slots = {
 *     ConsentPopupSlot,              // ReactElement
 *     PortfolioTabSlot,              // () => ReactElement
 *     OverviewTabSlot,               // () => ReactElement
 *     ResearchTabSlot,               // () => ReactElement
 *     TabBarSlot,                    // (props) => ReactElement
 *     InvestNowModalSlot,            // ReactElement | null
 *     PaymentSuccessSlot,            // ReactElement | null
 *     ReviewTradeModalSlot,          // ReactElement | null
 *     RecommendationSuccessSlot,     // ReactElement | null
 *     SubscribeModalSlot,            // ReactElement | null
 *     DdpiModalSlot,                 // ReactElement | null
 *     AngelOneTpinSlot,              // ReactElement | null
 *     DhanTpinSlot,                  // ReactElement | null
 *     FyersTpinSlot,                 // ReactElement | null
 *     OtherBrokerSlot,               // ReactElement | null
 *   }
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Modal,
} from 'react-native';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabView } from 'react-native-tab-view';
import {
  ChevronLeft,
  X,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const screenWidth = Dimensions.get('window').width;

const MPPerformanceScreen = ({ viewModel, actions, slots }) => {
  const {
    modelName = '',
    gradient1 = '#002651',
    gradient2 = '#0076fb',
    mainColor = '#0056B7',
    stepCompletedColor = '#58a100',
    imageUri = null,
    fallbackImage,
    currentPrice = 0,
    originalPrice = 0,
    discount = 0,
    gstLabel = '',
    pricingOptions = [],
    selectedPricing = null,
    minInvestment = null,
    volatility = null,
    frequency = null,
    nextRebalanceDate = '',
    isSubscribed = false,
    subscriptionStatus = 'none',
    investButtonLabel = 'Invest now',
    isEntitlementLoading = false,
    tabIndex = 0,
    routes = [],
    isActive = false,
    researchWebViewUrl = null,
  } = viewModel || {};

  const {
    onGoBack = () => {},
    onSelectPricing = () => {},
    onConsentOpen = () => {},
    onTabIndexChange = () => {},
    onInvestNow = () => {},
    onCloseResearchWebView = () => {},
  } = actions || {};

  const {
    ConsentPopupSlot = null,
    PortfolioTabSlot,
    OverviewTabSlot,
    ResearchTabSlot,
    TabBarSlot,
    InvestNowModalSlot = null,
    PaymentSuccessSlot = null,
    ReviewTradeModalSlot = null,
    RecommendationSuccessSlot = null,
    SubscribeModalSlot = null,
    DdpiModalSlot = null,
    AngelOneTpinSlot = null,
    DhanTpinSlot = null,
    FyersTpinSlot = null,
    OtherBrokerSlot = null,
  } = slots || {};

  const insets = useSafeAreaInsets();

  // Deliberately keep performance out of the headline metric strip. A model's
  // historical return needs context and the existing consent-gated Performance
  // section provides that context; a floating CAGR figure does not.
  const HeaderSummary = () => (
    <LinearGradient
      colors={[gradient1, gradient2]}
      start={{x: 0, y: 1}}
      end={{x: 1, y: 1}}
      style={styles.summaryCard}>
      <View style={styles.identityRow}>
        <View style={styles.logoContainer}>
          <Image
            source={imageUri ? {uri: imageUri} : fallbackImage}
            style={styles.icon}
          />
        </View>
        <Text style={styles.portfolioTitle} numberOfLines={2}>
          {modelName}
        </Text>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceSection}>
          <Text style={styles.currentPrice}>
            ₹ {currentPrice ? currentPrice.toFixed(2) : '0.00'}{gstLabel}
          </Text>
          {discount > 0 ? (
            <Text style={styles.originalPrice}>₹ {originalPrice?.toFixed(2)}</Text>
          ) : null}
        </View>
        {discount > 0 ? (
          <View style={[styles.saveTag, {backgroundColor: stepCompletedColor}]}>
            <Text style={styles.saveTagText}>Save {discount}%</Text>
          </View>
        ) : null}
      </View>

      {pricingOptions.length > 1 ? (
        <View style={styles.pricingOptions}>
          {pricingOptions.map(option => {
            const isSelected = option.period === selectedPricing;
            return (
              <TouchableOpacity
                key={option.period}
                onPress={() => onSelectPricing(option.period)}
                style={[styles.pricingOption, isSelected && styles.pricingOptionSelected]}>
                <Text style={styles.pricingOptionText}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Minimum investment</Text>
          <Text style={styles.metricValue}>
            {minInvestment != null ? `₹ ${Number(minInvestment).toFixed(2)}` : '—'}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Risk profile</Text>
          <Text style={styles.metricValue}>{volatility || 'Not specified'}</Text>
          <Text style={styles.metricHint}>Manager-selected volatility</Text>
        </View>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="View historical performance and disclosures"
        onPress={onConsentOpen}
        style={styles.performanceLink}>
        <View style={styles.performanceCopy}>
          <Text style={styles.performanceLabel}>Historical performance</Text>
          <Text style={styles.performanceHint}>
            View methodology, historical returns and disclosures
          </Text>
        </View>
        <Text style={[styles.performanceAction, {color: mainColor}]}>View</Text>
      </TouchableOpacity>
      <Text style={styles.performanceDisclosure}>
        Past performance is not indicative of future returns.
      </Text>

      <View style={styles.rebalanceRow}>
        <View style={styles.rebalanceDetails}>
          <Text style={styles.rebalanceLabel}>Rebalance</Text>
          <Text style={styles.rebalanceValue}>{frequency || 'As per strategy'}</Text>
        </View>
        <View style={styles.rebalanceDetails}>
          <Text style={styles.rebalanceLabel}>Next rebalance</Text>
          <Text style={styles.rebalanceValue}>{nextRebalanceDate || 'To be announced'}</Text>
        </View>
      </View>
    </LinearGradient>
  );

  const renderScene = ({route}) => {
    const Slot = route.key === 'portfolio'
      ? PortfolioTabSlot
      : route.key === 'overview'
        ? OverviewTabSlot
        : route.key === 'research'
          ? ResearchTabSlot
          : null;
    if (!Slot) return null;
    return React.createElement(Slot, {
      HeaderSlot: route.key === 'overview' ? HeaderSummary : null,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navigationBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onGoBack}
          style={styles.backButton}>
          <ChevronLeft size={22} color="#16324F" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>Model Portfolios</Text>
      </View>
      {ConsentPopupSlot}
      <View style={styles.tabViewContainer}>
        <TabView
          navigationState={{index: tabIndex, routes}}
          renderScene={renderScene}
          onIndexChange={onTabIndexChange}
          initialLayout={{width: screenWidth}}
          renderTabBar={TabBarSlot ? props => TabBarSlot(props) : undefined}
        />
      </View>

      <View style={[styles.bottomBar, {paddingBottom: Math.max(insets.bottom, 8)}]}>
        {isSubscribed ? (
          <TouchableOpacity disabled style={styles.investButtonDisable}>
            <Text style={styles.investButtonTextDisable}>Subscribed</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.bottomBarInner}>
            <TouchableOpacity
              onPress={onInvestNow}
              disabled={isEntitlementLoading}
              style={[styles.investButton, { backgroundColor: mainColor }]}
            >
              <Text style={styles.investButtonText}>{investButtonLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {InvestNowModalSlot}
      {PaymentSuccessSlot}
      {ReviewTradeModalSlot}
      {RecommendationSuccessSlot}
      {DdpiModalSlot}
      {AngelOneTpinSlot}
      {DhanTpinSlot}
      {FyersTpinSlot}
      {OtherBrokerSlot}
      {SubscribeModalSlot}

      {/* Research Report WebView Modal */}
      <Modal
        visible={!!researchWebViewUrl}
        animationType="slide"
        onRequestClose={onCloseResearchWebView}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.webViewHeader}>
            <TouchableOpacity onPress={onCloseResearchWebView} style={{ padding: 4 }}>
              <X size={22} color="#374151" />
            </TouchableOpacity>
            <Text style={styles.webViewTitle} numberOfLines={1}>Research Report</Text>
          </View>
          <WebView
            source={{ uri: researchWebViewUrl || '' }}
            style={{ flex: 1 }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webViewLoading}>
                <ActivityIndicator size="large" color={mainColor} />
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    flex: 1,
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6FA',
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Poppins-SemiBold',
    color: '#16324F',
  },
  summaryCard: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#16324F',
    shadowOffset: {width: 0, height: 5},
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    marginRight: 12,
    overflow: 'hidden',
  },
  icon: {width: 48, height: 48, resizeMode: 'contain'},
  portfolioTitle: {flex: 1, color: '#fff', fontSize: 17, lineHeight: 23, fontFamily: 'Poppins-SemiBold'},
  priceRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10},
  priceSection: {flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', flex: 1},
  currentPrice: {color: '#fff', fontSize: 16, lineHeight: 22, fontFamily: 'Poppins-Bold'},
  originalPrice: {color: 'rgba(255,255,255,0.72)', fontSize: 12, fontFamily: 'Poppins-Regular', textDecorationLine: 'line-through', marginLeft: 8},
  saveTag: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginLeft: 8},
  saveTagText: {color: '#fff', fontSize: 10, lineHeight: 14, fontFamily: 'Poppins-SemiBold'},
  pricingOptions: {flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12},
  pricingOption: {paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', marginRight: 8, marginBottom: 4},
  pricingOptionSelected: {backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.9)'},
  pricingOptionText: {color: '#fff', fontSize: 11, lineHeight: 15, fontFamily: 'Poppins-Medium'},
  metricsRow: {flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, alignItems: 'stretch'},
  metricItem: {flex: 1},
  metricDivider: {width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.32)', marginHorizontal: 12},
  metricLabel: {color: 'rgba(255,255,255,0.75)', fontSize: 10, lineHeight: 14, fontFamily: 'Poppins-Regular', marginBottom: 3},
  metricValue: {color: '#fff', fontSize: 13, lineHeight: 19, fontFamily: 'Poppins-SemiBold'},
  metricHint: {color: 'rgba(255,255,255,0.72)', fontSize: 9, lineHeight: 13, fontFamily: 'Poppins-Regular', marginTop: 2},
  performanceLink: {marginTop: 12, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center'},
  performanceCopy: {flex: 1, paddingRight: 8},
  performanceLabel: {color: '#16324F', fontSize: 12, lineHeight: 17, fontFamily: 'Poppins-SemiBold'},
  performanceHint: {color: '#64748B', fontSize: 10, lineHeight: 14, fontFamily: 'Poppins-Regular', marginTop: 1},
  performanceAction: {fontSize: 12, lineHeight: 17, fontFamily: 'Poppins-SemiBold'},
  performanceDisclosure: {color: 'rgba(255,255,255,0.8)', fontSize: 9, lineHeight: 13, fontFamily: 'Poppins-Regular', marginTop: 6},
  rebalanceRow: {flexDirection: 'row', marginTop: 12},
  rebalanceDetails: {flex: 1, padding: 11, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)'},
  rebalanceLabel: {fontSize: 10, lineHeight: 14, fontFamily: 'Poppins-Regular', color: 'rgba(255,255,255,0.74)', marginBottom: 2},
  rebalanceValue: {fontSize: 12, lineHeight: 17, color: '#fff', fontFamily: 'Poppins-SemiBold'},
  tabViewContainer: {flex: 1, width: screenWidth},
  bottomBar: {width: '100%', backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', elevation: 12, shadowColor: '#64748B', shadowOffset: {width: 0, height: -2}, shadowOpacity: 0.12, shadowRadius: 7},
  bottomBarInner: {width: '100%'},
  investButton: {marginHorizontal: 16, marginTop: 10, borderRadius: 10, minHeight: 48, justifyContent: 'center'},
  investButtonText: {color: '#fff', fontSize: 14, lineHeight: 20, fontFamily: 'Poppins-SemiBold', textAlign: 'center'},
  investButtonDisable: {backgroundColor: '#64748B', marginHorizontal: 16, marginTop: 10, borderRadius: 10, minHeight: 48, justifyContent: 'center'},
  investButtonTextDisable: {color: '#fff', fontSize: 14, lineHeight: 20, fontFamily: 'Poppins-SemiBold', textAlign: 'center'},
  webViewHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  webViewTitle: { fontSize: 15, fontFamily: 'Poppins-Medium', color: '#1F2937', marginLeft: 12, flex: 1 },
  webViewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
});

export default MPPerformanceScreen;
