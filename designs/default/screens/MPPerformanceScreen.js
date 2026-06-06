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
 *     volatilityColorStyle,  // style object
 *     cagrDisplay,           // string
 *     cagrClickable,         // boolean
 *     globalConsent,         // boolean
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
import { TabView, SceneMap } from 'react-native-tab-view';
import {
  ChevronLeft,
  TrendingUp,
  Gauge,
  X,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';

const screenWidth = Dimensions.get('window').width;
const ScreenHeight = Dimensions.get('window').height;

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
    volatilityColorStyle = {},
    cagrDisplay = 'View',
    cagrClickable = true,
    globalConsent = false,
    frequency = null,
    nextRebalanceDate = '',
    isSubscribed = false,
    subscriptionStatus = 'none',
    investButtonLabel = 'Invest now',
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'column' }}>
          <View>
            <View>
              <View style={styles.container}>
                <TouchableOpacity activeOpacity={1}>
                  <LinearGradient
                    colors={[gradient1, gradient2]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardContainer}
                  >
                    <View style={styles.headerRow}>
                      <TouchableOpacity style={styles.backButton}>
                        <ChevronLeft
                          size={24}
                          color="#000"
                          onPress={onGoBack}
                        />
                      </TouchableOpacity>
                      <View style={styles.header}>
                        <Text style={styles.title}>Model Portfolios</Text>
                      </View>
                    </View>

                    {/* Header */}
                    <View style={styles.headerSection}>
                      <View style={styles.logoContainer}>
                        <Image
                          source={imageUri ? { uri: imageUri } : fallbackImage}
                          style={styles.icon}
                        />
                      </View>
                      <Text style={styles.portfolioTitle}>{modelName}</Text>
                    </View>

                    {/* Price Section */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0 }}>
                      <View style={styles.priceSection}>
                        <Text style={styles.currentPrice}>
                          {'₹'} {currentPrice ? currentPrice.toFixed(2) : 0}{gstLabel}
                        </Text>
                        {discount > 0 && (
                          <Text style={styles.originalPrice}>
                            {'₹'} {originalPrice?.toFixed(2)}
                          </Text>
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
                        <View style={[styles.statRow, { flex: 1 }]}>
                          <Text style={styles.statLabel}>Volatility</Text>
                          <View style={styles.statIconContainer}>
                            <Gauge style={{ alignSelf: 'center' }} size={14} color={'rgba(0, 86, 183, 1)'} />
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
                            <TrendingUp size={14} color="rgba(41, 164, 0, 1)" />
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

                    <View style={styles.rebalanceRow}>
                      <View style={styles.rebalanceDetails}>
                        <Text style={styles.rebalanceLabel}>Rebalance</Text>
                        <Text style={styles.rebalanceFrequency}>{frequency}</Text>
                      </View>
                      <View style={styles.rebalanceDetails}>
                        <Text style={styles.rebalanceLabel}>Next Rebalance</Text>
                        <Text style={styles.rebalanceDate}>{nextRebalanceDate}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {ConsentPopupSlot}

          <View style={styles.tabViewContainer}>
            <TabView
              navigationState={{ index: tabIndex, routes }}
              renderScene={SceneMap({
                portfolio: PortfolioTabSlot || (() => null),
                overview: OverviewTabSlot || (() => null),
                research: ResearchTabSlot || (() => null),
              })}
              onIndexChange={onTabIndexChange}
              initialLayout={{ width: screenWidth }}
              renderTabBar={TabBarSlot ? (props) => TabBarSlot(props) : undefined}
            />
          </View>
        </View>
      </View>

      <View style={styles.bottomBar}>
        {isSubscribed ? (
          <TouchableOpacity disabled style={styles.investButtonDisable}>
            <Text style={styles.investButtonTextDisable}>Subscribed</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.bottomBarInner}>
            <TouchableOpacity
              onPress={onInvestNow}
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
    alignItems: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Poppins-Medium',
    color: 'white',
    textAlignVertical: 'center',
  },
  cardContainer: {
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    width: screenWidth,
    maxWidth: screenWidth,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  logoContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    padding: 0,
    marginRight: 12,
  },
  icon: { width: 50, height: 50, resizeMode: 'contain' },
  portfolioTitle: { color: '#fff', fontSize: 18, fontFamily: 'Poppins-SemiBold', flex: 1 },
  priceSection: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  currentPrice: { color: '#fff', fontSize: 14, fontFamily: 'Poppins-Bold' },
  originalPrice: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Poppins-Regular', textDecorationLine: 'line-through' },
  saveTag: { position: 'absolute', right: -20, top: 0, paddingHorizontal: 12, paddingVertical: 6, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  saveTagText: { color: '#fff', fontSize: 8, fontFamily: 'Poppins-SemiBold', alignSelf: 'center' },
  statsContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, padding: 8, marginBottom: 20, alignItems: 'center', paddingHorizontal: 10 },
  statItem: { flex: 1, justifyContent: 'space-between' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'center' },
  statIconContainer: { width: 20, height: 20, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, alignSelf: 'center' },
  statIcon: { color: '#000000ff', fontSize: 11, fontFamily: 'Poppins-Bold', marginTop: 2 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontFamily: 'Poppins-Regular', textAlign: 'center', marginBottom: 4, marginRight: 10 },
  statValue: { color: '#fff', fontSize: 12, fontFamily: 'Poppins-SemiBold', alignSelf: 'flex-start' },
  volatilityText: { fontSize: 12, fontFamily: 'Poppins-Medium', alignSelf: 'flex-start' },
  blurText: { opacity: 0.5 },
  cagrValue: { fontSize: 12, fontFamily: 'Poppins-SemiBold', alignSelf: 'flex-start' },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8 },
  rebalanceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, elevation: 10, paddingBottom: 10 },
  rebalanceDetails: { paddingVertical: 10, flex: 1, borderRadius: 3, paddingHorizontal: 15, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'flex-start' },
  rebalanceLabel: { fontSize: 12, fontFamily: 'Poppins-Regular', color: '#FFFFFF' },
  rebalanceDate: { fontSize: 12, color: '#fff', fontFamily: 'Poppins-Regular' },
  rebalanceFrequency: { fontSize: 12, color: '#fff', fontFamily: 'Poppins-Regular' },
  tabViewContainer: { flex: 1, height: ScreenHeight, width: screenWidth, paddingHorizontal: 0, marginTop: 10 },
  bottomBar: { alignContent: 'center', alignItems: 'center', alignSelf: 'center', elevation: 20, shadowColor: 'grey' },
  bottomBarInner: { flexDirection: 'row', alignContent: 'center', alignItems: 'center', alignSelf: 'center' },
  investButton: { margin: 10, borderRadius: 5, flex: 1, height: 45, justifyContent: 'center', alignSelf: 'center' },
  investButtonText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins-Medium', textAlign: 'center' },
  investButtonDisable: { backgroundColor: '#000', margin: 10, borderRadius: 5, width: screenWidth * 0.9, height: 50, justifyContent: 'center', alignSelf: 'center' },
  investButtonTextDisable: { color: '#fff', fontSize: 18, fontFamily: 'Satoshi-Medium', textAlign: 'center' },
  webViewHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  webViewTitle: { fontSize: 15, fontFamily: 'Poppins-Medium', color: '#1F2937', marginLeft: 12, flex: 1 },
  webViewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
});

export default MPPerformanceScreen;
