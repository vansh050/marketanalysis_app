/**
 * PortfolioScreen — design-system screen presentation (default variant, 2026-05-05)
 *
 * Pure presentation extracted from src/screens/PortfolioScreen/PortfolioScreen.js
 * during the design-system migration. The container in
 * `src/screens/PortfolioScreen/PortfolioScreen.js` keeps every data hook,
 * useEffect chain, broker-specific holdings/positions fetcher, panResponder,
 * gesture handler, and the three list-row renderers (`renderAllHoldings`,
 * `renderPositions`, `renderModalPFCard`); they're handed to this presentation
 * verbatim through the `portfolio` prop bag so closures keep resolving against
 * the container's scope.
 *
 * The visual tree is identical to the pre-extraction render — same
 * StyleSheet (now in `src/screens/PortfolioScreen/PortfolioScreen.styles.js`),
 * same `<PortfolioCard>` / `<RenderEmptyMessage>` collaborators. The
 * alphanomy variant ships its own JSX in
 * `designs/alphanomy/screens/PortfolioScreen.js`.
 *
 * Contract — `portfolio` prop bag (~25 keys):
 *   - selectedInnerTab, setSelectedInnerTab    (Holdings vs Model Portfolios)
 *   - tabIndex, setTabIndex                    (Holdings vs Positions inside MP-off lane)
 *   - processedData                            (MP catalog)
 *   - broker, BrokerHoldingsData, PositionsData
 *   - profitAndLoss, pnlPercentage, pnlposneg, effectiveHoldingsData, Loading
 *   - refreshing, onRefresh, panResponder
 *   - renderAllHoldings, renderPositions, renderModalPFCard (closures over container scope)
 *   - mainColor, modelPortfolioEnabled
 *   - HoldingScoreModal mount: modalVisible, scoreSymbol, setModalVisible
 */

import React from 'react';
import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    StyleSheet,
} from 'react-native';

import formatCurrency from '../../../src/utils/formatCurrency';
import styles from '../../../src/screens/PortfolioScreen/PortfolioScreen.styles';

const PortfolioScreenPresentation = ({ portfolio }) => {
    const {
        // Tabs
        selectedInnerTab,
        setSelectedInnerTab,
        tabIndex,
        setTabIndex,

        // P&L hero
        Loading,
        effectiveHoldingsData,
        profitAndLoss,
        pnlPercentage,
        pnlposneg,
        availableCash,

        // Lists
        processedData,
        BrokerHoldingsData,
        PositionsData,
        broker,
        brokerSessionUsable,
        staleHoldingsAcknowledged,
        staleHoldingsAsOf,

        // Refresh (the container's swipe panResponder is deliberately not
        // attached: sideways swipes while scrolling switched tabs by accident)
        refreshing,
        onRefresh,

        // Renderers
        renderAllHoldings,
        renderPositions,
        renderModalPFCard,

        // Theme
        mainColor,
        modelPortfolioEnabled,

        // Modal
        modalVisible,
        scoreSymbol,
        setModalVisible,
        slots = {},
    } = portfolio;

    const {
        PortfolioCard,
        RenderEmptyMessage,
        HoldingScoreModal,
        PortfolioSummaryCard,
    } = slots;

    // The P&L summary deliberately belongs to each scrolling holdings list,
    // rather than the fixed screen chrome. This keeps the source visible at
    // the top while leaving room for the actual holdings on short devices.
    const renderBrokerSummary = () => (
        <PortfolioCard
            Loading={Loading}
            allHoldingsData={effectiveHoldingsData}
            formatCurrency={formatCurrency}
            profitAndLoss={profitAndLoss}
            pnlPercentage={pnlPercentage}
            pnlposneg={pnlposneg}
            broker={broker}
            availableCash={availableCash}
        />
    );

    return (
        <>
            <View style={{ flex: 1 }}>
                    <View style={{ backgroundColor: '#FFFFFF', flex: 1 }}>
                    {/* One row of tabs (2026-11-22). The old screen stacked a
                        Model Portfolios / All Holdings toggle above a second
                        Holdings / Positions row, with red count badges. */}
                    <View style={localStyles.tabBar} accessibilityRole="tablist">
                        {[
                            {
                                key: 'holdings',
                                label: 'Holdings',
                                count: BrokerHoldingsData?.holding?.length || 0,
                                active: selectedInnerTab === 0 && tabIndex !== 1,
                                onPress: () => { setSelectedInnerTab(0); setTabIndex(2); },
                            },
                            {
                                key: 'positions',
                                label: 'Positions',
                                count: PositionsData?.length || 0,
                                active: selectedInnerTab === 0 && tabIndex === 1,
                                onPress: () => { setSelectedInnerTab(0); setTabIndex(1); },
                            },
                            ...(modelPortfolioEnabled === true
                                ? [{
                                    key: 'models',
                                    label: 'Model portfolios',
                                    count: processedData?.length || 0,
                                    active: selectedInnerTab === 1,
                                    onPress: () => setSelectedInnerTab(1),
                                }]
                                : []),
                        ].map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: tab.active }}
                                onPress={tab.onPress}
                                activeOpacity={0.8}
                                style={[
                                    localStyles.tab,
                                    tab.active && [localStyles.tabActive, { borderBottomColor: mainColor }],
                                ]}>
                                <Text
                                    numberOfLines={1}
                                    maxFontSizeMultiplier={1.3}
                                    style={[localStyles.tabText, tab.active && [localStyles.tabTextActive, { color: mainColor }]]}>
                                    {tab.label}
                                </Text>
                                {tab.count > 0 ? (
                                    <View style={[localStyles.badge, tab.active && { backgroundColor: mainColor }]}>
                                        <Text style={localStyles.badgeText} maxFontSizeMultiplier={1.2}>{tab.count}</Text>
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        ))}
                    </View>
                    {selectedInnerTab === 0 && !brokerSessionUsable && staleHoldingsAcknowledged ? (
                        <View style={styles.staleHoldingsBanner}>
                            <Text style={styles.staleHoldingsTitle}>Data is stale</Text>
                            <Text style={styles.staleHoldingsText}>
                                Showing broker holdings as of {staleHoldingsAsOf}.
                            </Text>
                        </View>
                    ) : null}
                    <View style={{ flex: 1, backgroundColor: '#fff', marginTop: 0 }}>
                        {selectedInnerTab === 0 ? (
                            tabIndex === 1 ? (
                                <SafeAreaView style={styles.containerfi}>
                                    <FlatList
                                        data={PositionsData}
                                        style={styles.list}
                                        horizontal={false}
                                        scrollEnabled={true}
                                        renderItem={renderPositions}
                                        ListHeaderComponent={renderBrokerSummary}
                                        ListEmptyComponent={<RenderEmptyMessage value="positions" />}
                                        refreshControl={
                                            <RefreshControl
                                                refreshing={refreshing}
                                                onRefresh={onRefresh}
                                                tintColor="black"
                                            />
                                        }
                                        keyExtractor={(item, index) => `${item?.symbol || index}_${index}`}
                                        scrollEventThrottle={16}
                                    />
                                </SafeAreaView>
                            ) : (
                                <SafeAreaView style={styles.containerfi}>
                                    <FlatList
                                            style={styles.list}
                                            data={BrokerHoldingsData?.holding}
                                            contentContainerStyle={{ paddingBottom: 96 }}
                                            nestedScrollEnabled={true}
                                            showsVerticalScrollIndicator={true}
                                            ListHeaderComponent={renderBrokerSummary}
                                            refreshControl={
                                                <RefreshControl
                                                    refreshing={refreshing}
                                                    onRefresh={onRefresh}
                                                    tintColor="black"
                                                />
                                            }
                                            scrollEnabled={true}
                                            ListEmptyComponent={<RenderEmptyMessage value="holdings" />}
                                            renderItem={renderAllHoldings}
                                            keyExtractor={(item, index) => `${item?.symbol || index}_${index}`}
                                            scrollEventThrottle={16}
                                        />
                                </SafeAreaView>
                            )
                        ) : (
                            <SafeAreaView style={{ flex: 1 }}>
                                <FlatList
                                    data={processedData}
                                    style={styles.list}
                                    contentContainerStyle={{ paddingBottom: 96 }}
                                    refreshControl={
                                        <RefreshControl
                                            refreshing={refreshing}
                                            onRefresh={onRefresh}
                                            tintColor="black"
                                        />
                                    }
                                    renderItem={renderModalPFCard}
                                    keyExtractor={(item, index) => `${item?.modelName || index}_${index}`}
                                    ListHeaderComponent={
                                        <PortfolioSummaryCard
                                            onViewHoldings={() => {
                                                setTabIndex(2);
                                                setSelectedInnerTab(0);
                                            }}
                                        />
                                    }
                                    ListEmptyComponent={null}
                                    scrollEventThrottle={16}
                                />
                            </SafeAreaView>
                        )}
                    </View>
                </View>
                {modalVisible && (
                    <HoldingScoreModal
                        scoreSymbol={scoreSymbol}
                        setModalVisible={setModalVisible}
                        modalVisible={modalVisible}
                    />
                )}
            </View>
        </>
    );
};

const localStyles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#D9DDE3',
        backgroundColor: '#FFFFFF',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabActive: {},
    tabText: { fontSize: 14, fontFamily: 'Satoshi-Medium', color: '#5B6472', flexShrink: 1 },
    tabTextActive: { fontFamily: 'Satoshi-Bold' },
    badge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: 5,
        marginLeft: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8A93A3',
    },
    badgeText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#FFFFFF' },
});

export default PortfolioScreenPresentation;
