/**
 * DistributionRowGrid — design-system screen presentation (Phase G batch 2, 2026-05-02)
 *
 * Pure presentation. Container owns market price fetching via axios +
 * SecurityTokenManager. Presentation renders distribution cards and holdings table.
 *
 * Contract:
 *   viewModel = {
 *     activeTab,              // 'distribution' | 'holdings'
 *     adviceEntries,          // array of { symbol, value }
 *     holdings,               // array of { symbol, quantity, averageEntryPrice, averagePrice }
 *     marketPrices,           // { [symbol]: ltp }
 *     totalCurrent,           // number — total current portfolio value
 *     isLoadingPrices,        // boolean
 *     portfolioLoading,       // boolean
 *     type,                   // 'normal' | 'MPPerformanceScreen'
 *     screenWidth,            // number
 *   }
 *   actions = {
 *     onTabChange(tab),
 *   }
 */

import React from 'react';
import {
    View,
    Text,
    ScrollView,
    FlatList,
    ActivityIndicator,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

const { width: DefaultScreenWidth } = Dimensions.get('window');

const DistributionRowGrid = ({ viewModel, actions }) => {
    const {
        activeTab = 'distribution',
        adviceEntries = [],
        holdings = [],
        marketPrices = {},
        totalCurrent = 0,
        isLoadingPrices = false,
        portfolioLoading = false,
        type = 'normal',
        screenWidth = DefaultScreenWidth,
    } = viewModel || {};
    const {
        onTabChange = () => {},
    } = actions || {};

    const renderDistribution = () => {
        if (!adviceEntries || adviceEntries.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <AlertTriangle size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyTitle}>No Distribution Data</Text>
                    <Text style={styles.emptySubtitle}>
                        No rebalance data available for this portfolio.
                    </Text>
                </View>
            );
        }

        return (
            <View style={{ flex: 1 }}>
                <FlatList
                    data={adviceEntries}
                    keyExtractor={(_, index) => index.toString()}
                    showsVerticalScrollIndicator
                    contentContainerStyle={{ paddingBottom: 80 }}
                    scrollEnabled={true}
                    nestedScrollEnabled={true}
                    style={{ flex: 1, width: '100%' }}
                    renderItem={({ item }) => {
                        const percentage = (item.value * 100).toFixed(2);
                        return (
                            <View style={[styles.card, { width: screenWidth - 30 }]}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.symbol}>{item.symbol}</Text>
                                    <Text style={styles.percent}>{percentage}%</Text>
                                </View>
                                <View style={styles.progressTrack}>
                                    <View
                                        style={[styles.progressFill, { width: `${percentage}%` }]}
                                    />
                                </View>
                            </View>
                        );
                    }}
                />
            </View>
        );
    };

    const renderHoldings = () => {
        if (portfolioLoading || isLoadingPrices) {
            return (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color="#2563EB" />
                    <Text style={styles.emptySubtitle}>Loading...</Text>
                </View>
            );
        }

        if (!holdings || holdings.length === 0) {
            return (
                <View style={styles.emptyContainer}>
                    <AlertTriangle size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
                    <Text style={styles.emptyTitle}>No Data Available</Text>
                    <Text style={styles.emptySubtitle}>
                        There are currently no holdings in this portfolio.
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                    {/* Table Header */}
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, styles.leftAlign, { width: 100 }]}>
                            Stock
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.rightAlign, { width: 90 }]}>
                            Current Price
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.rightAlign, { width: 90 }]}>
                            Avg. Buy
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.rightAlign, { width: 70 }]}>
                            Returns
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.rightAlign, { width: 60 }]}>
                            Weight
                        </Text>
                        <Text style={[styles.tableHeaderCell, styles.rightAlign, { width: 60 }]}>
                            Shares
                        </Text>
                    </View>

                    {/* Table Rows */}
                    {holdings.map((stock, index) => {
                        const ltpRaw = marketPrices[stock.symbol] ?? 0;
                        const avgPrice = stock.averageEntryPrice ?? stock.averagePrice ?? 0;
                        const pnlPercent = avgPrice
                            ? ((ltpRaw - avgPrice) / avgPrice) * 100
                            : 0;
                        const weightPercent = totalCurrent
                            ? ((ltpRaw * stock.quantity) / totalCurrent) * 100
                            : 0;

                        return (
                            <View key={index} style={styles.tableRow}>
                                <Text style={[styles.tableCell, styles.leftAlign, { width: 100 }]}>
                                    {stock.symbol}
                                </Text>
                                <Text style={[styles.tableCell, styles.rightAlign, { width: 90 }]}>
                                    {'₹'}{parseFloat(ltpRaw)?.toFixed(2)}
                                </Text>
                                <Text style={[styles.tableCell, styles.rightAlign, { width: 90 }]}>
                                    {'₹'}{parseFloat(avgPrice)?.toFixed(2)}
                                </Text>
                                <Text
                                    style={[
                                        styles.tableCell,
                                        styles.rightAlign,
                                        { width: 70 },
                                        pnlPercent > 0
                                            ? styles.greenText
                                            : pnlPercent < 0
                                            ? styles.redText
                                            : styles.neutralText,
                                    ]}>
                                    {pnlPercent > 0 ? '+' : ''}
                                    {parseFloat(pnlPercent).toFixed(2)}%
                                </Text>
                                <Text style={[styles.tableCell, styles.rightAlign, { width: 60 }]}>
                                    {parseFloat(weightPercent).toFixed(2)}%
                                </Text>
                                <Text style={[styles.tableCell, styles.rightAlign, { width: 60 }]}>
                                    {stock.quantity}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        );
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Tabs: show only if type !== 'MPPerformanceScreen' */}
            {type !== 'MPPerformanceScreen' && (
                <View style={styles.tabsRow}>
                    <TouchableOpacity
                        style={[
                            styles.tabBtn,
                            activeTab === 'distribution' && styles.tabBtnActive,
                        ]}
                        onPress={() => onTabChange('distribution')}>
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'distribution' && styles.tabTextActive,
                            ]}>
                            Portfolio Distribution
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.tabBtn,
                            activeTab === 'holdings' && styles.tabBtnActive,
                        ]}
                        onPress={() => onTabChange('holdings')}>
                        <Text
                            style={[
                                styles.tabText,
                                activeTab === 'holdings' && styles.tabTextActive,
                            ]}>
                            Portfolio Holdings
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Tab Content */}
            <View style={{ flex: 1, marginTop: 12 }}>
                {activeTab === 'distribution' || type === 'MPPerformanceScreen'
                    ? renderDistribution()
                    : renderHoldings()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    tabsRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabBtnActive: {
        borderBottomColor: '#0E66FF',
    },
    leftAlign: { textAlign: 'left' },
    rightAlign: { textAlign: 'right' },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    tabTextActive: {
        color: '#0E66FF',
    },
    card: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        marginBottom: 10,
        borderColor: '#E5E7EB',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    symbol: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    percent: {
        fontSize: 14,
        fontWeight: '500',
        color: '#2563EB',
    },
    progressTrack: {
        width: '100%',
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: 8,
        backgroundColor: '#2563EB',
        borderRadius: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    tableHeaderCell: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        textAlign: 'right',
        marginHorizontal: 6,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    tableCell: {
        flex: 1,
        fontSize: 12,
        color: '#111827',
        textAlign: 'right',
        marginHorizontal: 6,
    },
    greenText: { color: '#059669', fontWeight: '600' },
    redText: { color: '#DC2626', fontWeight: '600' },
    neutralText: { color: '#111827', fontWeight: '600' },
});

export default DistributionRowGrid;
