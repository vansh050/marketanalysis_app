import React, {useState, useEffect, useCallback} from 'react';
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
import {getAuth} from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';

import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';
import formatCurrency from '../../utils/formatCurrency';

const TradePnLScreen = () => {
  const {configData} = useTrade();
  const config = useConfig();
  const gradient1 = config?.gradient1 || '#002651';
  const gradient2 = config?.gradient2 || '#0056B7';
  const mainColor = config?.mainColor || '#0056B7';

  const navigation = useNavigation();
  const auth = getAuth();
  const userEmail = auth.currentUser?.email;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [expandedModel, setExpandedModel] = useState(null);

  const fetchPnL = async () => {
    if (!userEmail) return;
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/model-portfolio/trade-pnl/${encodeURIComponent(userEmail)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
          },
        },
      );
      if (response.data?.success) setData(response.data.data);
    } catch (err) {
      console.log('Trade P&L fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnL();
  }, [userEmail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPnL();
    setRefreshing(false);
  }, [userEmail]);

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
            <Text style={[styles.tradePnl, {color: pos ? '#16A34A' : '#DC2626'}]}>
              {pos ? '+' : ''}₹{formatCurrency(Math.abs(item.pnl))}
            </Text>
            <Text style={[styles.tradePnlPct, {color: pos ? '#16A34A' : '#DC2626'}]}>
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
          onPress={() => setExpandedModel(isExpanded ? null : model.modelName)}
          activeOpacity={0.7}
          style={styles.modelHeader}>
          <View style={{flex: 1}}>
            <Text style={styles.modelName}>{model.modelName}</Text>
            <Text style={styles.modelMeta}>
              {model.tradeCount} stocks · {model.holdingDays != null ? `${model.holdingDays}d` : '-'} held
            </Text>
          </View>
          <View style={{alignItems: 'flex-end'}}>
            <Text style={[styles.modelPnl, {color: pos ? '#16A34A' : '#DC2626'}]}>
              {pos ? '+' : ''}₹{formatCurrency(Math.abs(model.pnl))}
            </Text>
            <Text style={[styles.modelPnlPct, {color: pos ? '#16A34A' : '#DC2626'}]}>
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trade P&L Report</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={mainColor} />
        </View>
      ) : !data || !summary ? (
        <View style={styles.emptyContainer}>
          <BarChart3 size={48} color="#9CA3AF" />
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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={mainColor} />
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
                    <Text style={[styles.summaryPnl, {color: isPositive ? '#4ADE80' : '#F87171'}]}>
                      {isPositive ? '+' : ''}₹{formatCurrency(Math.abs(summary.totalPnl))}
                    </Text>
                    <Text style={[styles.summaryPnlPct, {color: isPositive ? '#4ADE80' : '#F87171'}]}>
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
  container: {flex: 1, backgroundColor: '#F5F5F5'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 12,
  },
  headerTitle: {fontSize: 17, fontFamily: 'Poppins-SemiBold', color: '#fff'},
  loaderContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40},
  emptyTitle: {fontSize: 16, fontFamily: 'Poppins-SemiBold', color: '#333', marginTop: 16},
  emptySubtitle: {fontSize: 13, fontFamily: 'Poppins-Regular', color: '#888', textAlign: 'center', marginTop: 6},

  // Summary
  summaryCard: {borderRadius: 12, padding: 16, marginBottom: 20},
  summaryRow: {flexDirection: 'row', alignItems: 'flex-start'},
  summaryLabel: {color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'Poppins-Regular'},
  summaryValue: {color: '#fff', fontSize: 16, fontFamily: 'Poppins-SemiBold', marginTop: 2},
  summaryPnl: {fontSize: 16, fontFamily: 'Poppins-Bold', marginTop: 2},
  summaryPnlPct: {fontSize: 11, fontFamily: 'Poppins-Medium'},
  summaryMeta: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)'},
  summaryMetaText: {color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'Poppins-Regular'},

  sectionTitle: {fontSize: 15, fontFamily: 'Poppins-SemiBold', color: '#1F2937', marginBottom: 10},

  // Model card
  modelCard: {backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden'},
  modelHeader: {flexDirection: 'row', alignItems: 'center', padding: 14},
  modelName: {fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#1F2937'},
  modelMeta: {fontSize: 11, fontFamily: 'Poppins-Regular', color: '#6B7280', marginTop: 2},
  modelPnl: {fontSize: 15, fontFamily: 'Poppins-Bold'},
  modelPnlPct: {fontSize: 11, fontFamily: 'Poppins-Medium', marginTop: 1},

  // Trades
  tradesContainer: {borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingHorizontal: 14, paddingBottom: 10},
  tradeHeaderRow: {flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'},
  tradeHeaderText: {fontSize: 10, fontFamily: 'Poppins-Medium', color: '#9CA3AF', textTransform: 'uppercase'},
  tradeRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB'},
  tradeSymbol: {fontSize: 13, fontFamily: 'Poppins-SemiBold', color: '#1F2937'},
  tradeDetail: {fontSize: 10, fontFamily: 'Poppins-Regular', color: '#9CA3AF', marginTop: 1},
  tradeCurrent: {fontSize: 12, fontFamily: 'Poppins-Medium', color: '#374151'},
  tradePnl: {fontSize: 12, fontFamily: 'Poppins-SemiBold'},
  tradePnlPct: {fontSize: 10, fontFamily: 'Poppins-Regular', marginLeft: 3},
  staleHint: {fontSize: 8, fontFamily: 'Poppins-Regular', color: '#D1D5DB', marginTop: 1},

  modelSummaryRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingTop: 6},
  modelSummaryLabel: {fontSize: 11, fontFamily: 'Poppins-Regular', color: '#6B7280'},
  modelSummaryValue: {fontSize: 11, fontFamily: 'Poppins-SemiBold', color: '#374151'},
});

export default TradePnLScreen;
