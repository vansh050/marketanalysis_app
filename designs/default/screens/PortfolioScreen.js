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
 *   - modelPortfolioStrategy, processedData    (MP catalogs)
 *   - showPlanPicker, setShowPlanPicker, selectedPlan, setSelectedPlan
 *   - broker, BrokerHoldingsData, PositionsData, planHoldings, planHoldingsLoading
 *   - profitAndLoss, pnlPercentage, pnlposneg, effectiveHoldingsData, Loading
 *   - refreshing, onRefresh, panResponder
 *   - renderAllHoldings, renderPositions, renderModalPFCard (closures over container scope)
 *   - mainColor, navigation, modelPortfolioEnabled
 *   - HoldingScoreModal mount: modalVisible, scoreSymbol, setModalVisible
 */

import React from 'react';
import {
    View,
    Text,
    SafeAreaView,
    FlatList,
    Modal,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import PortfolioCard from '../../../src/screens/PortfolioScreen/PortFolioCard';
import RenderEmptyMessage from '../../../src/screens/PortfolioScreen/EmptyMessageCard';
import HoldingScoreModal from '../../../src/screens/PortfolioScreen/HoldingScoreModal';
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
        modelPortfolioStrategy,
        processedData,
        BrokerHoldingsData,
        PositionsData,
        planHoldings,
        planHoldingsLoading,

        // Plan picker
        showPlanPicker,
        setShowPlanPicker,
        selectedPlan,
        setSelectedPlan,
        broker,

        // Refresh + gestures
        refreshing,
        onRefresh,
        panResponder,

        // Renderers
        renderAllHoldings,
        renderPositions,
        renderModalPFCard,

        // Theme + navigation
        mainColor,
        navigation,
        modelPortfolioEnabled,

        // Modal
        modalVisible,
        scoreSymbol,
        setModalVisible,
    } = portfolio;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View {...panResponder.panHandlers} style={{ flex: 1 }}>
                <View style={{ backgroundColor: '#EFF0EE', flex: 1 }}>
                    <View style={styles.headerContainer}>
                        <View>
                            <PortfolioCard
                                Loading={Loading}
                                allHoldingsData={effectiveHoldingsData}
                                formatCurrency={formatCurrency}
                                profitAndLoss={profitAndLoss}
                                pnlPercentage={pnlPercentage}
                                pnlposneg={pnlposneg}
                                setSelectedInnerTab={setSelectedInnerTab}
                            />
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

                            {selectedInnerTab === 1 && (
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('TradePnLScreen')}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginHorizontal: 16,
                                        marginTop: 8,
                                        paddingVertical: 8,
                                        backgroundColor: mainColor,
                                        borderRadius: 8,
                                    }}>
                                    <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'Poppins-Medium' }}>📊 View Trade P&L Report</Text>
                                </TouchableOpacity>
                            )}

                            {selectedInnerTab === 0 && (
                                <>
                                    {modelPortfolioStrategy?.length > 0 && (
                                        <View style={styles.planSelectorRow}>
                                            <TouchableOpacity
                                                style={styles.planDropdown}
                                                onPress={() => setShowPlanPicker(true)}
                                                activeOpacity={0.7}>
                                                <Text style={styles.planDropdownLabel}>Plan</Text>
                                                <Text style={styles.planDropdownValue} numberOfLines={1}>
                                                    {selectedPlan || 'Select Plan'}
                                                </Text>
                                                <Text style={styles.planDropdownArrow}>&#9660;</Text>
                                            </TouchableOpacity>
                                            <View style={styles.brokerBadge}>
                                                <Text style={styles.planDropdownLabel}>Broker</Text>
                                                <Text style={styles.brokerBadgeValue} numberOfLines={1}>
                                                    {broker || 'Not Connected'}
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    <Modal
                                        visible={showPlanPicker}
                                        transparent
                                        animationType="fade"
                                        onRequestClose={() => setShowPlanPicker(false)}>
                                        <TouchableOpacity
                                            style={styles.pickerOverlay}
                                            activeOpacity={1}
                                            onPress={() => setShowPlanPicker(false)}>
                                            <View style={styles.pickerContainer}>
                                                <Text style={styles.pickerTitle}>Select Plan</Text>
                                                {modelPortfolioStrategy.map((item, index) => (
                                                    <TouchableOpacity
                                                        key={item.model_name || index}
                                                        style={[
                                                            styles.pickerItem,
                                                            selectedPlan === item.model_name && [
                                                                styles.pickerItemSelected,
                                                                { backgroundColor: mainColor },
                                                            ],
                                                        ]}
                                                        onPress={() => {
                                                            setSelectedPlan(item.model_name);
                                                            setShowPlanPicker(false);
                                                        }}>
                                                        <Text
                                                            style={[
                                                                styles.pickerItemText,
                                                                selectedPlan === item.model_name &&
                                                                    styles.pickerItemTextSelected,
                                                            ]}>
                                                            {item.model_name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </TouchableOpacity>
                                    </Modal>

                                    <View style={styles.tabContainer}>
                                        <TouchableOpacity
                                            style={[styles.tabButton, tabIndex === 2 && styles.activeTab]}
                                            onPress={() => setTabIndex(2)}>
                                            <View style={{ flexDirection: 'row' }}>
                                                <Text style={[styles.tabText, tabIndex === 2 && styles.activeTabText]}>Holdings</Text>
                                                {(selectedPlan ? planHoldings : BrokerHoldingsData?.holding)?.length > 0 && (
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
                                                            {selectedPlan ? planHoldings.length : BrokerHoldingsData?.holding?.length}
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
                            {selectedInnerTab === 1 ? (
                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        padding: 15,
                                    }}>
                                    <View
                                        style={{
                                            flexDirection: 'column',
                                            alignContent: 'flex-start',
                                            alignItems: 'flex-start',
                                            alignSelf: 'flex-start',
                                        }}>
                                        <Text
                                            style={{
                                                color: 'grey',
                                                fontFamily: 'Satoshi-Regular',
                                                fontSize: 12,
                                                width: '100%',
                                                borderColor: 'black',
                                            }}>
                                            {modelPortfolioStrategy.length} Model Portfolio
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: 'column',
                                            alignContent: 'flex-end',
                                            alignItems: 'flex-end',
                                            alignSelf: 'flex-end',
                                        }}>
                                        <Text
                                            style={{
                                                color: 'grey',
                                                fontFamily: 'Satoshi-Regular',
                                                fontSize: 12,
                                                width: '100%',
                                                borderColor: 'black',
                                            }}>
                                            Current Value
                                        </Text>
                                    </View>
                                </View>
                            ) : null}
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
                                    {planHoldingsLoading && selectedPlan ? (
                                        <View style={{ padding: 40, alignItems: 'center' }}>
                                            <ActivityIndicator size="large" color={mainColor} />
                                            <Text style={{ marginTop: 12, color: '#666', fontFamily: 'Satoshi-Regular' }}>
                                                Loading holdings...
                                            </Text>
                                        </View>
                                    ) : (
                                        <FlatList
                                            style={styles.list}
                                            data={selectedPlan ? planHoldings : BrokerHoldingsData?.holding}
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
                                    )}
                                </SafeAreaView>
                            )
                        ) : (
                            <SafeAreaView>
                                <FlatList
                                    data={processedData}
                                    style={styles.list}
                                    renderItem={renderModalPFCard}
                                    keyExtractor={(item, index) => `${item?.modelName || index}_${index}`}
                                    ListEmptyComponent={<RenderEmptyMessage value="modelPortfolio" />}
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
