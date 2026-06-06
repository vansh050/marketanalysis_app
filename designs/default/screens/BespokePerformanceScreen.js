/**
 * BespokePerformanceScreen — design-system screen presentation (Phase G batch 2, 2026-05-02)
 *
 * Pure presentation. Container owns ALL data fetching (user details, strategy,
 * single strategy, plans, subscriptions, funds, rebalance calculation),
 * state management, and business logic. This renders the bespoke plan card,
 * TabView with key features/overview, invest button, and all modals.
 *
 * Contract:
 *   viewModel = {
 *     modelName, strategyDetails, singleStrategyDetails, latestRebalance,
 *     planDetails, specificPlan, userEmail, broker, userDetails,
 *     funds, subscribed, subscriptionStatus, isActive,
 *     pricingOptions, selectedPricing, currentPrice, originalPrice, discount,
 *     index, routes, tabHeights, screenWidth, screenHeight,
 *     chartData, chartConfig, colorMap,
 *     confirmOrder, calculatedPortfolioData, calculatedLoading,
 *     dataArray, stockDetails, fileName,
 *     paymentModal, paymentSuccess, openStrategy, openSuccessModal,
 *     OpenSubscribeModel, orderPlacementResponse, lastSubmittedTrades,
 *     selectedCard, isConsentPopupOpen, showPaymentFail,
 *     clientCode, apiKey, secretKey, jwtToken,
 *     BrokerModel, OpenTokenExpireModel,
 *     selectedPlanType, oneTimeAmount, oneTimeDurationPlan,
 *     configGst, configGstWithText,
 *     serverBaseUrl,
 *   }
 *   actions = {
 *     onGoBack, onTabIndexChange, onSelectedPricingChange,
 *     onInvestNow, onCloseInvestNowModal, onCloseReviewTrade,
 *     onConsentAccept, onConsentOpen,
 *     onSetConfirmOrder, onSetPaymentSuccess, onSetPaymentModal,
 *     onSetSelectedCard, onSetOpenSubscribeModel, onSetOpenSucessModal,
 *     onSetOrderPlacementResponse, onSetLastSubmittedTrades,
 *     onSetOpenTokenExpireModel, onSetBrokerModel,
 *     onSetSelectedPlanType, onSetOneTimeAmount, onSetOneTimeDurationPlan,
 *     onSetIsConsentPopupOpen, onSetShowPaymentFail,
 *     onCalculateRebalance,
 *     getStrategyDetails, getAllStrategy, getSingleStrategyDetails,
 *     onHandleTabLayout,
 *   }
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    Dimensions,
    FlatList,
    SafeAreaView,
} from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import {
    ChevronLeft,
    CheckCircle,
    Star,
} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import PieChart from 'react-native-pie-chart';
import EmptyMP from '../../../src/assets/emptyModelPortfolio.svg';
import PaymentSuccessModal from '../../../src/components/ModelPortfolioComponents/PaymentSuccessModal';
import UserStrategySubscribeModal from '../../../src/components/ModelPortfolioComponents/UserStrategySubscribeModal';
import MPInvestNowModal from '../../../src/components/ModelPortfolioComponents/MPInvestNowModal';
import MPReviewTradeModal from '../../../src/components/ModelPortfolioComponents/MPReviewTradeModal';
import RecommendationSuccessModal from '../../../src/components/ModelPortfolioComponents/RecommendationSuccessModal';
import RebalanceTimeLineModal from '../../../src/components/ModelPortfolioComponents/RebalanceTimelineModal';
import CustomTabBarMPPerformance from '../../../src/screens/Drawer/CustomTabbarMPPerformance';
import ConsentPopup from '../../../src/components/ModelPortfolioComponents/ConsentPopUp';
import { withGst, gstLabel } from '../../../src/utils/gstHelpers';

const Alpha100 = require('../../../src/assets/alpha-100.png');

const defaultScreenWidth = Dimensions.get('window').width;
const defaultScreenHeight = Dimensions.get('window').height;

/* ---------- Distribution sub-component (purely visual + local modal state) ---------- */
const Distribution = ({
    latestRebalance,
    colorMap,
    chartData,
    strategyDetails,
}) => {
    const [showRebalanceTimelineModal, setShowRebalanceTimelineModal] = useState(false);

    const seriesData = chartData.map(entry => Number(entry.value));

    if (seriesData.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <EmptyMP />
                <Text style={styles.noDataText}>No Data Found</Text>
                <Text style={styles.noDataSubtitle}>
                    Explore our curated Model Portfolios and start investing today!
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, paddingHorizontal: 10 }}>
            <View style={{ marginTop: 20, marginHorizontal: 10 }}>
                <Text style={{ color: 'grey', fontFamily: 'Satoshi-Regular' }}>
                    Click to view the{' '}
                    <Text
                        onPress={() => setShowRebalanceTimelineModal(true)}
                        style={{ color: '#3B82F6' }}>
                        latest rebalance updates{' '}
                    </Text>
                    and history.
                </Text>
            </View>

            <View style={{ marginTop: 30, marginHorizontal: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'black', fontFamily: 'Satoshi-Regular', fontSize: 14 }}>
                        Equity
                    </Text>
                    <Text style={{ color: 'black', fontFamily: 'Satoshi-Regular', fontSize: 14 }}>
                        Weightage (%)
                    </Text>
                </View>

                <FlatList
                    data={latestRebalance?.adviceEntries}
                    renderItem={({ item }) => (
                        <View style={[styles.equityItem, { borderLeftColor: colorMap[item.symbol] }]}>
                            <Text style={{ color: 'black', fontFamily: 'Satoshi-Regular', fontSize: 16, marginLeft: 10 }}>
                                {item.symbol}
                            </Text>
                            <Text style={{ color: 'black', fontFamily: 'Satoshi-Regular', marginRight: 10 }}>
                                {(item.value * 100).toFixed(2)}
                            </Text>
                        </View>
                    )}
                    keyExtractor={(item, index) => index.toString()}
                />
            </View>

            <View style={{ alignSelf: 'center', justifyContent: 'center', marginVertical: 10 }}>
                <PieChart
                    widthAndHeight={250}
                    series={seriesData}
                    sliceColor={chartData.map(entry => entry.fill)}
                    coverRadius={0.01}
                    coverFill={'#FFF'}
                />
            </View>
            {showRebalanceTimelineModal && (
                <RebalanceTimeLineModal
                    closeRebalanceTimelineModal={() => setShowRebalanceTimelineModal(false)}
                    strategyDetails={strategyDetails}
                />
            )}
        </View>
    );
};

/* ---------- Main Presentation ---------- */
const BespokePerformanceScreen = ({ viewModel, actions }) => {
    const vm = viewModel || {};
    const act = actions || {};

    const {
        modelName = '',
        strategyDetails = { pieData: [] },
        latestRebalance = null,
        planDetails = null,
        specificPlan = null,
        userEmail = '',
        broker = '',
        userDetails = null,
        subscribed = false,
        subscriptionStatus = 'none',
        pricingOptions = [],
        selectedPricing = null,
        currentPrice = 0,
        originalPrice = 0,
        discount = 0,
        index: tabIndex = 0,
        routes = [],
        screenWidth = defaultScreenWidth,
        screenHeight = defaultScreenHeight,
        chartData = [],
        colorMap = {},
        confirmOrder = false,
        calculatedPortfolioData = [],
        calculatedLoading = false,
        dataArray = [],
        paymentModal = false,
        paymentSuccess = false,
        openStrategy = false,
        openSuccessModal = false,
        OpenSubscribeModel = false,
        orderPlacementResponse = null,
        lastSubmittedTrades = null,
        selectedCard = null,
        isConsentPopupOpen = false,
        clientCode = null,
        apiKey = null,
        secretKey = null,
        jwtToken = null,
        configGst = false,
        configGstWithText = false,
        serverBaseUrl = '',
    } = vm;

    const {
        onGoBack = () => {},
        onTabIndexChange = () => {},
        onSelectedPricingChange = () => {},
        onInvestNow = () => {},
        onCloseInvestNowModal = () => {},
        onCloseReviewTrade = () => {},
        onConsentAccept = () => {},
        onSetConfirmOrder = () => {},
        onSetPaymentSuccess = () => {},
        onSetPaymentModal = () => {},
        onSetSelectedCard = () => {},
        onSetOpenSubscribeModel = () => {},
        onSetOpenSucessModal = () => {},
        onSetOrderPlacementResponse = () => {},
        onSetLastSubmittedTrades = () => {},
        onSetOpenTokenExpireModel = () => {},
        onSetBrokerModel = () => {},
        onSetSelectedPlanType = () => {},
        onSetOneTimeAmount = () => {},
        onSetOneTimeDurationPlan = () => {},
        onSetIsConsentPopupOpen = () => {},
        onSetShowPaymentFail = () => {},
        onCalculateRebalance = () => {},
        getAllStrategy = () => {},
        getSingleStrategyDetails = () => {},
        onHandleTabLayout = () => () => {},
    } = act;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={{ lex: 1 }}>
                <View style={{ flexDirection: 'column' }}>
                    <View>
                        <View>
                            <View style={styles.container}>
                                <TouchableOpacity activeOpacity={1}>
                                    <LinearGradient
                                        colors={['#002651', '#0076fb']}
                                        start={{ x: 0, y: 1 }}
                                        end={{ x: 1, y: 1 }}
                                        style={[styles.cardContainer, { width: screenWidth, maxWidth: screenWidth }]}>
                                        <View style={{ flexDirection: 'row', alignContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                            <TouchableOpacity style={styles.backButton}>
                                                <ChevronLeft size={24} color="#000" onPress={onGoBack} />
                                            </TouchableOpacity>
                                            <View style={styles.header}>
                                                <Text style={styles.title}>Bespoke Plans</Text>
                                            </View>
                                        </View>
                                        {/* Header */}
                                        <View style={styles.headerSection}>
                                            <View style={styles.logoContainer}>
                                                <Image
                                                    source={
                                                        strategyDetails?.image
                                                            ? { uri: `${serverBaseUrl}${strategyDetails?.image}` }
                                                            : Alpha100
                                                    }
                                                    style={styles.icon}
                                                />
                                            </View>
                                            <Text style={styles.portfolioTitle}>
                                                {modelName || 'ZC Leaders Portfolio'}
                                            </Text>
                                        </View>

                                        {/* Price Section */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0 }}>
                                            <View style={styles.priceSection}>
                                                <Text style={styles.currentPrice}>
                                                    {'₹ '}{currentPrice ? (configGst && configGstWithText ? withGst(currentPrice)?.toFixed(2) : currentPrice?.toFixed(2)) : 0}{gstLabel(configGst, configGstWithText)}
                                                </Text>
                                                {discount > 0 && (
                                                    <Text style={styles.originalPrice}>
                                                        {'₹ '}{originalPrice?.toFixed(2)}
                                                    </Text>
                                                )}
                                            </View>
                                            {discount > 0 && (
                                                <LinearGradient
                                                    colors={['#58a100', '#1f7d00']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                    style={styles.saveTag}>
                                                    <Text style={styles.saveTagText}>
                                                        Save {discount}%
                                                    </Text>
                                                </LinearGradient>
                                            )}
                                        </View>

                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                            {pricingOptions.map(option => {
                                                const isSelected = option.period === selectedPricing;
                                                return (
                                                    <TouchableOpacity
                                                        key={option.period}
                                                        onPress={() => onSelectedPricingChange(option.period)}
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
                                                        }}>
                                                        <Text style={{ color: '#fff', fontSize: 10, marginTop: 2, fontFamily: 'Poppins-Medium' }}>
                                                            {option.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                    <ConsentPopup
                        isConsentPopupOpen={isConsentPopupOpen}
                        setIsConsentPopupOpen={onSetIsConsentPopupOpen}
                        handleConsentAccept={onConsentAccept}
                    />

                    <View style={[styles.tabViewContainer, { height: screenHeight, width: screenWidth }]}>
                        <TabView
                            navigationState={{ index: tabIndex, routes }}
                            renderScene={SceneMap({
                                keyfeatures: () => (
                                    <ScrollView
                                        nestedScrollEnabled
                                        showsVerticalScrollIndicator={false}
                                        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                                        <Text style={{ fontSize: 20, fontWeight: '700', color: '#002651', marginBottom: 12 }}>
                                            Key Features
                                        </Text>

                                        {strategyDetails?.keyFeature?.length > 0 ? (
                                            strategyDetails.keyFeature.map((feature, idx) => (
                                                <View
                                                    key={idx}
                                                    style={{
                                                        backgroundColor: '#FFFFFF',
                                                        borderRadius: 14,
                                                        padding: 16,
                                                        marginBottom: 12,
                                                        borderWidth: 1,
                                                        borderColor: '#E2E8F0',
                                                        shadowColor: '#000',
                                                        shadowOpacity: 0.05,
                                                        shadowRadius: 4,
                                                        shadowOffset: { width: 0, height: 2 },
                                                        elevation: 2,
                                                        flexDirection: 'row',
                                                        alignItems: 'flex-start',
                                                    }}>
                                                    <View style={{ backgroundColor: '#E8F0FF', borderRadius: 50, padding: 8, marginRight: 10 }}>
                                                        <Star size={18} color="#0076FB" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#002651', marginBottom: 4 }}>
                                                            {feature.label}
                                                        </Text>
                                                        <Text style={{ fontSize: 14, color: '#475569', lineHeight: 20 }}>
                                                            {feature.description}
                                                        </Text>
                                                    </View>
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 8, fontSize: 14 }}>
                                                No key features available.
                                            </Text>
                                        )}

                                        <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 }} />

                                        <Text style={{ fontSize: 20, fontWeight: '700', color: '#002651', marginBottom: 12 }}>
                                            Key Benefits
                                        </Text>

                                        {strategyDetails?.keyBenefit ? (
                                            strategyDetails.keyBenefit
                                                .split('\n')
                                                .filter(line => line.trim() !== '')
                                                .map((benefit, idx) => (
                                                    <View
                                                        key={idx}
                                                        style={{
                                                            flexDirection: 'row',
                                                            alignItems: 'flex-start',
                                                            marginBottom: 10,
                                                            backgroundColor: '#F8FAFC',
                                                            padding: 10,
                                                            borderRadius: 10,
                                                            borderWidth: 1,
                                                            borderColor: '#E2E8F0',
                                                        }}>
                                                        <CheckCircle size={18} color="#0076FB" style={{ marginRight: 10, marginTop: 2 }} />
                                                        <Text style={{ fontSize: 14, color: '#334155', flex: 1, lineHeight: 20 }}>
                                                            {benefit}
                                                        </Text>
                                                    </View>
                                                ))
                                        ) : (
                                            <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 8, fontSize: 14 }}>
                                                No key benefits available.
                                            </Text>
                                        )}
                                    </ScrollView>
                                ),

                                overview: () => (
                                    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                                        <ScrollView
                                            nestedScrollEnabled
                                            showsVerticalScrollIndicator={false}
                                            contentContainerStyle={{ alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 0, paddingBottom: 0 }}>
                                            <View style={{ backgroundColor: '#EEF4FF', borderRadius: 16, borderWidth: 1, borderColor: '#C7D2FE', padding: 20, marginTop: 20 }}>
                                                <Text style={{ fontSize: 18, fontWeight: '600', color: '#1E293B', marginBottom: 8 }}>
                                                    Subscribe & Get Expert Research Guidance
                                                </Text>
                                                <Text style={{ fontSize: 14, color: '#475569', marginBottom: 16, lineHeight: 20 }}>
                                                    Start by subscribing to our{' '}
                                                    <Text style={{ fontWeight: '600', color: '#1F54DB' }}>Research Investment Plan</Text>
                                                    . Once subscribed, you'll receive personalized{' '}
                                                    <Text style={{ fontWeight: '600' }}>buy/sell recommendations</Text>{' '}
                                                    directly from our certified RA/RIA professionals —
                                                    tailored to your goals and market opportunities. Our
                                                    experts will work with you to build and refine a
                                                    portfolio that aligns perfectly with your financial
                                                    objectives and risk profile.
                                                </Text>
                                            </View>
                                        </ScrollView>
                                    </SafeAreaView>
                                ),
                            })}
                            onIndexChange={onTabIndexChange}
                            initialLayout={{ width: screenWidth }}
                            onLayout={onHandleTabLayout(2)}
                            renderTabBar={props => (
                                <CustomTabBarMPPerformance isSubscriptionActive={false} {...props} />
                            )}
                        />
                    </View>
                </View>
            </ScrollView>

            <View style={{ alignContent: 'center', alignItems: 'center', alignSelf: 'center', elevation: 20, shadowColor: 'grey' }}>
                {subscribed === true ? (
                    <TouchableOpacity disabled={subscribed} style={[styles.investButtondisable, { width: screenWidth * 0.9 }]}>
                        <Text style={styles.investButtonTextdisable}>Subscribed</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ flexDirection: 'row', alignContent: 'center', alignItems: 'center', alignSelf: 'center' }}>
                        <TouchableOpacity onPress={onInvestNow} style={styles.investButton}>
                            <Text style={styles.investButtonText}>
                                {subscriptionStatus === 'active'
                                    ? 'Subscribed'
                                    : subscriptionStatus === 'renew'
                                    ? 'Renew now'
                                    : subscriptionStatus === 'expired'
                                    ? 'Resubscribe'
                                    : 'Invest now'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {paymentModal && (
                <MPInvestNowModal
                    visible={paymentModal}
                    onClose={onCloseInvestNowModal}
                    userEmail={userEmail}
                    broker={broker}
                    plans={planDetails}
                    setShowPaymentFail={onSetShowPaymentFail}
                    latestRebalance={latestRebalance}
                    strategyDetails={planDetails}
                    plandata={planDetails}
                    handleCardClick={act.onHandleCardClickSelect}
                    selectedCard={selectedCard}
                    getStrategyDetails={() => getSingleStrategyDetails(modelName)}
                    setPaymentSuccess={onSetPaymentSuccess}
                    getAllStrategy={getAllStrategy}
                    specificPlan={planDetails}
                    specificPlanDetails={planDetails}
                    setPaymentModal={onSetPaymentModal}
                    userDetails={userDetails}
                    fileName={modelName}
                    isSubscribed={planDetails?.subscription}
                    setOpenTokenExpireModel={onSetOpenTokenExpireModel}
                    selectedPlanType={vm.selectedPlanType}
                    setSelectedPlanType={onSetSelectedPlanType}
                    onetimeamount={vm.oneTimeAmount}
                    setOneTimeAmount={onSetOneTimeAmount}
                    oneTimeDurationPlan={vm.oneTimeDurationPlan}
                    setOneTimeDurationPlan={onSetOneTimeDurationPlan}
                />
            )}

            {paymentSuccess === true ? (
                <PaymentSuccessModal
                    specificPlan={specificPlan}
                    specificPlanDetails={specificPlan}
                    setPaymentSuccess={onSetPaymentSuccess}
                    setPaymentModal={onSetPaymentModal}
                    setSelectedCard={onSetSelectedCard}
                    setOpenSubscribeModel={onSetOpenSubscribeModel}
                />
            ) : null}

            {openStrategy && (
                <MPReviewTradeModal
                    visible={openStrategy}
                    onCloseReviewTrade={onCloseReviewTrade}
                    confirmOrder={confirmOrder}
                    userEmail={userEmail}
                    strategyDetails={strategyDetails}
                    setconfirmOrder={onSetConfirmOrder}
                    userDetails={userDetails}
                    dataArray={latestRebalance?.adviceEntries}
                    totalArray={dataArray}
                    latestRebalance={latestRebalance}
                    fileName={strategyDetails?.model_name}
                    broker={broker}
                    setOrderPlacementResponse={onSetOrderPlacementResponse}
                    setLastSubmittedTrades={onSetLastSubmittedTrades}
                    setOpenSubscribeModel={onSetOpenSubscribeModel}
                    setOpenSucessModal={onSetOpenSucessModal}
                    openSuccessModal={openSuccessModal}
                    calculatedLoading={calculatedLoading}
                    calculatedPortfolioData={calculatedPortfolioData}
                    calculateRebalance={onCalculateRebalance}
                />
            )}

            {openSuccessModal && (
                <RecommendationSuccessModal
                    openSuccessModal={openSuccessModal}
                    setOpenSucessModal={onSetOpenSucessModal}
                    orderPlacementResponse={orderPlacementResponse}
                    originalStockDetails={lastSubmittedTrades}
                />
            )}

            {OpenSubscribeModel === true && latestRebalance !== null ? (
                <UserStrategySubscribeModal
                    visible={OpenSubscribeModel}
                    onClose={() => onSetOpenSubscribeModel(false)}
                    setOpenSubscribeModel={onSetOpenSubscribeModel}
                    userEmail={userEmail}
                    getStrategyDetails={getAllStrategy}
                    strategyDetails={strategyDetails}
                    fileName={vm.fileName}
                    latestRebalance={latestRebalance}
                    userDetails={userDetails}
                    setOpenSucessModal={onSetOpenSucessModal}
                    setOrderPlacementResponse={onSetOrderPlacementResponse}
                    setBrokerModel={onSetBrokerModel}
                    BrokerModel={vm.BrokerModel}
                    clientCode={clientCode}
                    apiKey={apiKey}
                    secretKey={secretKey}
                    jwtToken={jwtToken}
                    broker={broker}
                    setOpenTokenExpireModel={onSetOpenTokenExpireModel}
                />
            ) : null}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        flex: 1,
        alignItems: 'flex-start',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingVertical: 20,
    },
    backButton: {
        padding: 4,
        borderRadius: 5,
        backgroundColor: '#fff',
        marginRight: 10,
    },
    noDataText: {
        fontSize: 18,
        marginTop: 40,
        fontFamily: 'Satoshi-Bold',
        color: '#000000',
    },
    noDataSubtitle: {
        fontSize: 14,
        color: '#8E8E93',
        fontFamily: 'Satoshi-Medium',
        textAlign: 'center',
        marginVertical: 8,
    },
    tabViewContainer: {
        flex: 1,
        paddingHorizontal: 0,
        marginTop: 10,
    },
    header: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    icon: {
        width: 50,
        height: 50,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 20,
        fontFamily: 'Poppins-Medium',
        color: 'white',
        textAlignVertical: 'center',
    },
    equityItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#e8e8e8',
        borderLeftWidth: 5,
        paddingVertical: 10,
    },
    cardContainer: {
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
        paddingVertical: 10,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    saveTag: {
        position: 'absolute',
        right: -20,
        top: 0,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20,
    },
    saveTagText: {
        color: '#fff',
        fontSize: 8,
        fontFamily: 'Poppins-SemiBold',
        alignContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
    },
    headerSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    logoContainer: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 6,
        padding: 0,
        marginRight: 12,
    },
    portfolioTitle: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'Poppins-SemiBold',
        flex: 1,
    },
    priceSection: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    currentPrice: { color: '#fff', fontSize: 14, fontFamily: 'Poppins-Bold' },
    originalPrice: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        textDecorationLine: 'line-through',
    },
    investButton: {
        backgroundColor: '#0056B7',
        margin: 10,
        borderRadius: 5,
        flex: 1,
        height: 45,
        justifyContent: 'center',
        alignSelf: 'center',
    },
    investButtonText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'Poppins-Medium',
        textAlign: 'center',
    },
    investButtondisable: {
        backgroundColor: '#000',
        margin: 10,
        borderRadius: 5,
        height: 50,
        justifyContent: 'center',
        alignSelf: 'center',
    },
    investButtonTextdisable: {
        color: '#fff',
        fontSize: 18,
        fontFamily: 'Satoshi-Medium',
        textAlign: 'center',
    },
});

export default BespokePerformanceScreen;
