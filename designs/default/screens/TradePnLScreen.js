import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronLeft, TrendingUp, TrendingDown, Clock, BarChart3} from 'lucide-react-native';
import formatCurrency from '../../../src/utils/formatCurrency';

import {designColor, designFont} from '../../../src/design/literalTokens';

const TradePnLScreen = ({viewModel, actions}) => {
  const {gradient1, gradient2, mainColor, loading, refreshing, data, expandedModel} = viewModel;

  const summary = data?.summary;
  const isPositive = (summary?.totalPnl || 0) >= 0;

  const renderTradeRow = ({item}) => {
    const pos = item.pnl >= 0;
    return (
      <View style={styles.tradeRow}>
        <View style={{flex: 1}}>
          <Text style={styles.tradeSymbol}>{item.symbol}</Text>
          <Text style={styles.tradeDetail}>
            {item.quantity} shares @ ₹{item.entryPrice}
          </Text>
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <Text style={styles.tradeCurrent}>₹{formatCurrency(item.currentPrice)}</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={[styles.tradePnl, {color: pos ? designColor('16a34a') : designColor('dc2626')}]}>
              {pos ? '+' : ''}₹{formatCurrency(Math.abs(item.pnl))}
            </Text>
            <Text style={[styles.tradePnlPct, {color: pos ? designColor('16a34a') : designColor('dc2626')}]}>
              ({pos ? '+' : ''}{item.pnlPercentage}%)
            </Text>
          </View>
          {!item.isLtpLive && (
            <Text style={styles.staleHint}>est.</Text>
          )}
        </View>
      </View>
    );
  };

  const renderModelSection = ({item: model}) => {
    const pos = model.pnl >= 0;
    const isExpanded = expandedModel === model.modelName;

    return (
      <View style={styles.modelCard}>
        <TouchableOpacity
          onPress={() => actions.onToggleModel(model.modelName)}
          activeOpacity={0.7}
          style={styles.modelHeader}>
          <View style={{flex: 1}}>
            <Text style={styles.modelName}>{model.modelName}</Text>
            <Text style={styles.modelMeta}>
              {model.tradeCount} stocks · {model.holdingDays != null ? `${model.holdingDays}d` : '-'} held
            </Text>
            {model.subscriptionActive === false && (
              <View style={styles.expiredRow}>
                <View style={styles.expiredBadge}>
                  <Text style={styles.expiredBadgeText}>Subscription expired</Text>
                </View>
                <TouchableOpacity
                  onPress={actions.onOpenPlans}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Text style={styles.renewLink}>Renew</Text>
                </TouchableOpacity>
              </View>
            )}
            {model.trades?.length > 0 && !model.trades.every((t) => t.isLtpLive) && (
              <Text style={styles.asOfHint}>
                {model.asOf
                  ? `Prices as of ${new Date(model.asOf).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}`
                  : 'Prices pending — showing cost basis'}
              </Text>
            )}
          </View>
          <View style={{alignItems: 'flex-end'}}>
            <Text style={[styles.modelPnl, {color: pos ? designColor('16a34a') : designColor('dc2626')}]}>
              {pos ? '+' : ''}₹{formatCurrency(Math.abs(model.pnl))}
            </Text>
            <Text style={[styles.modelPnlPct, {color: pos ? designColor('16a34a') : designColor('dc2626')}]}>
              {pos ? '+' : ''}{model.pnlPercentage}%
            </Text>
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.tradesContainer}>
            <View style={styles.tradeHeaderRow}>
              <Text style={[styles.tradeHeaderText, {flex: 1}]}>Stock</Text>
              <Text style={[styles.tradeHeaderText, {textAlign: 'right'}]}>Current / P&L</Text>
            </View>
            {model.trades.map((trade, idx) => (
              <View key={trade.symbol + idx}>
                {renderTradeRow({item: trade})}
              </View>
            ))}
            <View style={styles.modelSummaryRow}>
              <Text style={styles.modelSummaryLabel}>Invested</Text>
              <Text style={styles.modelSummaryValue}>₹{formatCurrency(model.invested)}</Text>
            </View>
            <View style={styles.modelSummaryRow}>
              <Text style={styles.modelSummaryLabel}>Current</Text>
              <Text style={styles.modelSummaryValue}>₹{formatCurrency(model.current)}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[gradient1, gradient2]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={actions.onBack}>
          <ChevronLeft size={22} color={designColor('000')} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trade P&L Report</Text>
      </LinearGradient>
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={mainColor} />
        </View>
      ) : !data || !summary ? (
        <View style={styles.emptyContainer}>
          <BarChart3 size={48} color={designColor('9ca3af')} />
          <Text style={styles.emptyTitle}>No Trade Data</Text>
          <Text style={styles.emptySubtitle}>
            Trade P&L will appear here after you execute trades in your model portfolios.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data.byModel}
          keyExtractor={(item) => item.modelName}
          renderItem={renderModelSection}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={actions.onRefresh} tintColor={mainColor} />
          }
          ListHeaderComponent={
            <View>
              {/* Summary Card */}
              <LinearGradient
                colors={[gradient1, gradient2]}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.summaryLabel}>TOTAL INVESTED</Text>
                    <Text style={styles.summaryValue}>₹{formatCurrency(summary.totalInvested)}</Text>
                  </View>
                  <View style={{width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12}} />
                  <View style={{flex: 1, alignItems: 'center'}}>
                    <Text style={styles.summaryLabel}>TOTAL CURRENT</Text>
                    <Text style={styles.summaryValue}>₹{formatCurrency(summary.totalCurrent)}</Text>
                  </View>
                  <View style={{width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12}} />
                  <View style={{flex: 1, alignItems: 'flex-end'}}>
                    <Text style={styles.summaryLabel}>P&L</Text>
                    <Text style={[styles.summaryPnl, {color: isPositive ? designColor('4ade80') : designColor('f87171')}]}>
                      {isPositive ? '+' : ''}₹{formatCurrency(Math.abs(summary.totalPnl))}
                    </Text>
                    <Text style={[styles.summaryPnlPct, {color: isPositive ? designColor('4ade80') : designColor('f87171')}]}>
                      {isPositive ? '+' : ''}{summary.pnlPercentage}%
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryMeta}>
                  <Text style={styles.summaryMetaText}>
                    {summary.portfolioCount} portfolios · {summary.totalTrades} trades
                  </Text>
                  <Text style={styles.summaryMetaText}>Prices may be delayed</Text>
                </View>
              </LinearGradient>

              <Text style={styles.sectionTitle}>By Portfolio</Text>
            </View>
          }
          contentContainerStyle={{padding: 16, paddingBottom: 40}}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  expiredRow: {flexDirection: 'row', alignItems: 'center', marginTop: 4},
  expiredBadge: {
    backgroundColor: designColor('fffaeb'),
    borderColor: designColor('fedf89'),
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  expiredBadgeText: {fontSize: 10, fontWeight: '700', color: designColor('b54708')},
  renewLink: {fontSize: 11, fontWeight: '700', color: designColor('0056b7')},
  asOfHint: {fontSize: 10, color: designColor('9ca3af'), marginTop: 3},
  container: {flex: 1, backgroundColor: designColor('f5f5f5')},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: designColor('fff'),
    marginRight: 12,
  },
  headerTitle: {fontSize: 17, fontFamily: designFont('Poppins-SemiBold'), color: designColor('fff')},
  loaderContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40},
  emptyTitle: {fontSize: 16, fontFamily: designFont('Poppins-SemiBold'), color: designColor('333'), marginTop: 16},
  emptySubtitle: {fontSize: 13, fontFamily: designFont('Poppins-Regular'), color: designColor('888'), textAlign: 'center', marginTop: 6},

  // Summary
  summaryCard: {borderRadius: 12, padding: 16, marginBottom: 20},
  summaryRow: {flexDirection: 'row', alignItems: 'flex-start'},
  summaryLabel: {color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: designFont('Poppins-Regular')},
  summaryValue: {color: designColor('fff'), fontSize: 16, fontFamily: designFont('Poppins-SemiBold'), marginTop: 2},
  summaryPnl: {fontSize: 16, fontFamily: designFont('Poppins-Bold'), marginTop: 2},
  summaryPnlPct: {fontSize: 11, fontFamily: designFont('Poppins-Medium')},
  summaryMeta: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)'},
  summaryMetaText: {color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: designFont('Poppins-Regular')},

  sectionTitle: {fontSize: 15, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937'), marginBottom: 10},

  // Model card
  modelCard: {backgroundColor: designColor('fff'), borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: designColor('e5e7eb'), overflow: 'hidden'},
  modelHeader: {flexDirection: 'row', alignItems: 'center', padding: 14},
  modelName: {fontSize: 14, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937')},
  modelMeta: {fontSize: 11, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280'), marginTop: 2},
  modelPnl: {fontSize: 15, fontFamily: designFont('Poppins-Bold')},
  modelPnlPct: {fontSize: 11, fontFamily: designFont('Poppins-Medium'), marginTop: 1},

  // Trades
  tradesContainer: {borderTopWidth: 1, borderTopColor: designColor('f3f4f6'), paddingHorizontal: 14, paddingBottom: 10},
  tradeHeaderRow: {flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: designColor('f3f4f6')},
  tradeHeaderText: {fontSize: 10, fontFamily: designFont('Poppins-Medium'), color: designColor('9ca3af'), textTransform: 'uppercase'},
  tradeRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: designColor('f9fafb')},
  tradeSymbol: {fontSize: 13, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937')},
  tradeDetail: {fontSize: 10, fontFamily: designFont('Poppins-Regular'), color: designColor('9ca3af'), marginTop: 1},
  tradeCurrent: {fontSize: 12, fontFamily: designFont('Poppins-Medium'), color: designColor('374151')},
  tradePnl: {fontSize: 12, fontFamily: designFont('Poppins-SemiBold')},
  tradePnlPct: {fontSize: 10, fontFamily: designFont('Poppins-Regular'), marginLeft: 3},
  staleHint: {fontSize: 8, fontFamily: designFont('Poppins-Regular'), color: designColor('d1d5db'), marginTop: 1},

  modelSummaryRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingTop: 6},
  modelSummaryLabel: {fontSize: 11, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280')},
  modelSummaryValue: {fontSize: 11, fontFamily: designFont('Poppins-SemiBold'), color: designColor('374151')},
});

export default TradePnLScreen;
