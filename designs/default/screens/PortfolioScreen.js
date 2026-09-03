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
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import PortfolioCard from '../../../src/screens/PortfolioScreen/PortFolioCard';
import RenderEmptyMessage from '../../../src/screens/PortfolioScreen/EmptyMessageCard';
import HoldingScoreModal from '../../../src/screens/PortfolioScreen/HoldingScoreModal';
import PortfolioSummaryCard from '../composites/PortfolioSummaryCard';
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

        // Lists
        processedData,
        BrokerHoldingsData,
        PositionsData,
        broker,

        // Refresh + gestures
        refreshing,
        onRefresh,
        panResponder,

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
    } = portfolio;

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
            selectedPlan={null}
        />
    );

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View {...panResponder.panHandlers} style={{ flex: 1 }}>
                    <View style={{ backgroundColor: '#EFF0EE', flex: 1 }}>
                    <View style={styles.headerContainer}>
                        <View>
                            <View style={{ marginHorizontal: 0 }}>
                                <View style={styles.toggleBtnContainer}>
                                    {modelPortfolioEnabled === true ? (
                                        <TouchableOpacity
                                            style={[
                                                styles.toggleBtnButton,
                                                selectedInnerTab === 1
                                                    ? [styles.toggleBtnSelectedButton, { backgroundColor: mainColor }]
                                                    : styles.toggleBtnUnselectedButton,
                                            ]}
                                            onPress={() => setSelectedInnerTab(1)}
                                            activeOpacity={0.8}>
                                            <Text
                                                style={[
                                                    styles.toggleBtnText,
                                                    selectedInnerTab === 1
                                                        ? styles.toggleBtnSelectedText
                                                        : styles.toggleBtnUnselectedText,
                                                ]}>
                                                Model Portfolios
                                            </Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    <TouchableOpacity
                                        style={[
                                            styles.toggleBtnButton,
                                            selectedInnerTab === 0
                                                ? [styles.toggleBtnSelectedButton, { backgroundColor: mainColor }]
                                                : styles.toggleBtnUnselectedButton,
                                        ]}
                                        onPress={() => setSelectedInnerTab(0)}
                                        activeOpacity={0.8}>
                                        <Text
                                            style={[
                                                styles.toggleBtnText,
                                                selectedInnerTab === 0
                                                    ? styles.toggleBtnSelectedText
                                                    : styles.toggleBtnUnselectedText,
                                            ]}>
                                            All Holdings
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {selectedInnerTab === 0 && (
                                <>
                                    <View style={styles.tabContainer}>
                                        <TouchableOpacity
                                            style={[styles.tabButton, tabIndex === 2 && styles.activeTab]}
                                            onPress={() => setTabIndex(2)}>
                                            <View style={{ flexDirection: 'row' }}>
                                                <Text style={[styles.tabText, tabIndex === 2 && styles.activeTabText]}>Holdings</Text>
                                                {BrokerHoldingsData?.holding?.length > 0 && (
                                                    <View
                                                        style={{
                                                            backgroundColor: tabIndex === 2 ? '#C84444' : 'grey',
                                                            borderRadius: 15,
                                                            width: 20,
                                                            height: 20,
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            marginLeft: 5,
                                                        }}>
                                                        <Text style={styles.badgeText}>
                                                            {BrokerHoldingsData?.holding?.length}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.tabButton, tabIndex === 1 && styles.activeTab]}
                                            onPress={() => setTabIndex(1)}>
                                            <View style={{ flexDirection: 'row' }}>
                                                <Text style={[styles.tabText, tabIndex === 1 && styles.activeTabText]}>Positions</Text>
                                                {PositionsData?.length > 0 && (
                                                    <View
                                                        style={{
                                                            backgroundColor: tabIndex === 1 ? 'red' : 'grey',
                                                            borderRadius: 15,
                                                            width: 20,
                                                            height: 20,
                                                            justifyContent: 'center',
                                                            alignItems: 'center',
                                                            marginLeft: 5,
                                                        }}>
                                                        <Text style={styles.badgeText}>{PositionsData?.length}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
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
                            <SafeAreaView>
                                <FlatList
                                    data={processedData}
                                    style={styles.list}
                                    renderItem={renderModalPFCard}
                                    keyExtractor={(item, index) => `${item?.modelName || index}_${index}`}
                                    ListHeaderComponent={<PortfolioSummaryCard />}
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
        </GestureHandlerRootView>
    );
};

export default PortfolioScreenPresentation;
