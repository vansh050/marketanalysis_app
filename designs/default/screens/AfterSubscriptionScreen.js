import React from 'react';
import {SafeAreaView, ScrollView, StatusBar, StyleSheet, View, Text, TouchableOpacity, Dimensions, ActivityIndicator} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronLeft} from 'lucide-react-native';
import {TabView} from 'react-native-tab-view';
import {SafeAreaView as SafeAreaBoundary} from 'react-native-safe-area-context';
import moment from 'moment';

import {designColor, designFont} from '../../../src/design/literalTokens';

const screenWidth = Dimensions.get('window').width;
const InfoPill = ({title, value, accent}) => (
  <View style={[styles.infoPill, accent && styles.infoPillAccent]}>
    <Text style={styles.infoPillTitle}>{title}</Text>
    <Text style={[styles.infoPillValue, accent && styles.infoPillValueAccent]}>{value}</Text>
  </View>
);
const isMetricMissing = value => value === null || value === undefined || value === '' || Number.isNaN(Number(value));
const formatMetric = (value, isPercent) => isMetricMissing(value) ? 'NA' : isPercent ? `${Number(value).toFixed(2)}%` : Number(value).toFixed(2);
const MetricTile = ({label, value, color}) => (
  <View style={styles.metricTile}><Text style={styles.metricTileLabel}>{label}</Text><Text style={[styles.metricTileValue, color ? {color} : null]}>{value}</Text></View>
);
const MethodologyCard = ({title, content}) => {
  if (!content) return null;
  const contentStr = String(content).replace(/\/n/g, '\n');
  const lines = contentStr.split('\n').map(line => line.trim()).filter(Boolean);
  return <View style={styles.methodCard}><View style={styles.methodTitleRow}><View style={styles.methodTitleBar} /><Text style={styles.methodTitle}>{title}</Text></View>{lines.length > 1 ? lines.map((line, index) => <Text key={index} style={styles.methodBody}>{line}</Text>) : <Text style={styles.methodBody}>{contentStr}</Text>}</View>;
};

const AfterSubscriptionScreen = ({viewModel, actions, slots}) => {
  const {
    gradientStart, gradientEnd, fileName, portfolioLoading, totalInvested,
    totalCurrent, nextRebalanceLabel, strategyDetails, tabViewHeight,
    index, routes, isStalebrokerData, userDetails, tableData, themeColor,
    latestRebalance, validOrderResults,
  } = viewModel;
  const {handleTabLayout, setIndex, setTabBarHeight, getLTPForSymbol, setTerminateModal, setModifyInvestmentModal} = actions;
  const {CustomTabBar, EmptyState, PerformanceChart: PerformanceChartSlot, DistributionGrid: DistributionGridSlot} = slots;
  return (
    <LinearGradient
      colors={[gradientStart, gradientEnd]}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={gradientStart} />

        <ScrollView
          contentContainerStyle={styles.content}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled">
          {/* Header Card */}
          <LinearGradient
            colors={[gradientEnd, gradientStart]}
            style={styles.headerCard}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={actions.onBack}>
                <ChevronLeft size={24} color={designColor('000')} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{fileName}</Text>
            </View>

            <View style={styles.zcInfraSection}>
              <View style={styles.circlesWrap} pointerEvents="none">
                <View style={styles.circle1} />
                <View style={styles.circle2} />
                <View style={styles.circle3} />
              </View>
              {/* One value hierarchy: funded amount, current value, then current P&L. */}
              <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10}}>
                <View style={{flex: 1, alignItems: 'flex-start'}}>
                  <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: designFont('Poppins-Regular')}}>INVESTED</Text>
                  <Text style={{color: designColor('ffffff'), fontSize: 18, fontFamily: designFont('Poppins-SemiBold'), marginTop: 2}}>
                    {portfolioLoading
                      ? '—'
                      : `₹${totalInvested?.toLocaleString('en-IN', {maximumFractionDigits: 0}) || '0'}`}
                  </Text>
                </View>
                <View style={{width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8}} />
                <View style={{flex: 1, alignItems: 'center'}}>
                  <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: designFont('Poppins-Regular')}}>CURRENT VALUE</Text>
                  <Text style={{color: designColor('ffffff'), fontSize: 18, fontFamily: designFont('Poppins-SemiBold'), marginTop: 2}}>
                    {portfolioLoading
                      ? '—'
                      : `₹${totalCurrent?.toLocaleString('en-IN', {maximumFractionDigits: 0}) || '0'}`}
                  </Text>
                </View>
                <View style={{width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8}} />
                <View style={{flex: 1, alignItems: 'flex-end'}}>
                  <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: designFont('Poppins-Regular')}}>CURRENT P&L</Text>
                  <Text style={{
                    color: (totalCurrent - totalInvested) >= 0 ? designColor('4ade80') : designColor('f87171'),
                    fontSize: 14,
                    fontFamily: designFont('Poppins-SemiBold'),
                    marginTop: 2,
                  }}>
                    {portfolioLoading
                      ? '—'
                      : `${(totalCurrent - totalInvested) >= 0 ? '+' : '-'}₹${Math.abs(totalCurrent - totalInvested).toLocaleString('en-IN', {maximumFractionDigits: 0})}`}
                  </Text>
                  <Text style={{
                    color: (totalCurrent - totalInvested) >= 0 ? designColor('4ade80') : designColor('f87171'),
                    fontSize: 11,
                    fontFamily: designFont('Poppins-Medium'),
                  }}>
                    {portfolioLoading
                      ? 'Loading'
                      : totalInvested > 0
                        ? `${((totalCurrent - totalInvested) / totalInvested * 100).toFixed(2)}%`
                        : '0.00%'}
                  </Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  Values use the latest available prices and may be delayed.
                </Text>
              </View>
            </View>

            <View style={styles.pillsRow}>
              <InfoPill
                title="Upcoming rebalance"
                value={nextRebalanceLabel}
                accent
              />
              <InfoPill
                title="Previous rebalance"
                value={
                  strategyDetails?.last_updated
                    ? moment(strategyDetails.last_updated).format('DD MMM, YYYY')
                    : 'N/A'
                }
              />
              <InfoPill title="Rebalance basis" value={strategyDetails?.frequency || 'As per strategy'} />
            </View>
          </LinearGradient>

          {/* Holdings Distribution */}
          <View style={{}}>
            <View style={[styles.tabViewContainer, {height: tabViewHeight}]}>
              <TabView
                navigationState={{index, routes}}
                renderScene={({route}) => {
                  switch (route.key) {
                  case 'holdings': return (
                    <ScrollView style={{flex: 1, backgroundColor: designColor('fff')}} contentContainerStyle={{paddingBottom: 24}} nestedScrollEnabled>
                      <View onLayout={handleTabLayout(0)}>
                       {isStalebrokerData && (
                         <View style={{
                           marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, paddingVertical: 8,
                           backgroundColor: designColor('fef3c7'), borderRadius: 8, borderLeftWidth: 3, borderLeftColor: designColor('f59e0b'),
                           flexDirection: 'row', alignItems: 'flex-start',
                         }}>
                           <Text style={{fontSize: 12, fontFamily: designFont('Poppins-Regular'), color: designColor('92400e'), flex: 1}}>
                             ⚠️ Holdings shown are from a previous broker. To rebalance with {userDetails?.user_broker || 'your current broker'}, please update your holdings in the rebalance flow.
                           </Text>
                         </View>
                       )}
                       {portfolioLoading ? (
                         <View style={styles.holdingsLoadingState}>
                           <ActivityIndicator size="large" color={themeColor} />
                           <Text style={styles.holdingsLoadingTitle}>
                             Loading your holdings…
                           </Text>
                           <Text style={styles.holdingsLoadingText}>
                             Confirming the latest completed rebalance with your broker.
                           </Text>
                         </View>
                       ) : tableData?.length > 0 ? (
                         // Plain mapped Views, NOT a FlatList: this scene lives
                         // inside the screen's outer ScrollView, where a nested
                         // VirtualizedList loses windowing anyway and RN logs
                         // "VirtualizedLists should never be nested". Holdings
                         // lists are small, so mapping is the correct scroller.
                         (<View style={{paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16, gap: 10}}>
                           <View style={styles.tabIntro}>
                             <Text style={styles.tabIntroTitle}>Your current holdings</Text>
                             <Text style={styles.tabIntroBody}>
                               Stocks currently recorded in this model portfolio. These can differ from the target mix until the latest rebalance is completed.
                             </Text>
                           </View>
                           {tableData.map((item, idx) => {
                             const hasPrice = item.currentPrice !== 'N/A';
                             const hasReturns = item.returns !== 'N/A';
                             // Web parity (TerminateStrategyModal.js:230 +
                             // useStrategyDetailsWithPortfolioData.js:660):
                             // item.weights is now a string ("5.88") OR "-".
                             // The renderer treats "-" as the no-weight sentinel
                             // and renders "—"; everything else gets the "%" suffix.
                             const hasWeight = item.weights && item.weights !== '-';
                             const isPositive = hasReturns && item.returns >= 0;
                             const displaySymbol = item.symbol.replace(/-EQ$|-BE$|-N$/, '');
                             return (
                               <View key={item.symbol + idx} style={{
                                 backgroundColor: designColor('fff'),
                                 borderRadius: 12,
                                 borderLeftWidth: 3,
                                 borderLeftColor: themeColor,
                                 paddingHorizontal: 14,
                                 paddingVertical: 12,
                                 elevation: 2,
                                 shadowColor: designColor('000'),
                                 shadowOffset: {width: 0, height: 1},
                                 shadowOpacity: 0.08,
                                 shadowRadius: 3,
                               }}>
                                 {/* Card header: symbol + returns badge */}
                                 <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10}}>
                                   <View style={{flex: 1, marginRight: 8}}>
                                     <Text style={{fontSize: 14, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937')}}>{displaySymbol}</Text>
                                     {item.isPhantom && (
                                       <Text style={{
                                         fontSize: 9, fontFamily: designFont('Poppins-SemiBold'),
                                         color: designColor('92400e'), backgroundColor: designColor('fef3c7'),
                                         borderWidth: 1, borderColor: designColor('fde68a'),
                                         paddingHorizontal: 5, paddingVertical: 1,
                                         borderRadius: 3, alignSelf: 'flex-start', marginTop: 2,
                                       }}>
                                         Broker qty: {item.actualQty}
                                       </Text>
                                     )}
                                   </View>
                                   <View style={{
                                     backgroundColor: isPositive ? designColor('dcfce7') : (hasReturns ? designColor('fee2e2') : designColor('f3f4f6')),
                                     borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
                                   }}>
                                     <Text style={{
                                       fontSize: 13, fontFamily: designFont('Poppins-SemiBold'),
                                       color: isPositive ? designColor('16a34a') : (hasReturns ? designColor('dc2626') : designColor('9ca3af')),
                                     }}>
                                       {hasReturns ? `${isPositive ? '+' : ''}${item.returns.toFixed(2)}%` : 'N/A'}
                                     </Text>
                                   </View>
                                 </View>
                                 {/* Data grid: 2 × 2 */}
                                 <View style={{flexDirection: 'row', gap: 8}}>
                                   <View style={{flex: 1, backgroundColor: designColor('f8faff'), borderRadius: 8, padding: 8}}>
                                     <Text style={{fontSize: 10, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280'), marginBottom: 2}}>Current Price</Text>
                                     <Text style={{fontSize: 13, fontFamily: designFont('Poppins-Medium'), color: designColor('1f2937')}}>
                                       {hasPrice ? `₹${parseFloat(item.currentPrice).toFixed(2)}` : 'N/A'}
                                     </Text>
                                   </View>
                                   <View style={{flex: 1, backgroundColor: designColor('f8faff'), borderRadius: 8, padding: 8}}>
                                     <Text style={{fontSize: 10, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280'), marginBottom: 2}}>Avg. Buy</Text>
                                     <Text style={{fontSize: 13, fontFamily: designFont('Poppins-Medium'), color: designColor('1f2937')}}>
                                       ₹{parseFloat(item.avgBuyPrice).toFixed(2)}
                                     </Text>
                                   </View>
                                 </View>
                                 <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
                                   <View style={{flex: 1, backgroundColor: designColor('f8faff'), borderRadius: 8, padding: 8}}>
                                     <Text style={{fontSize: 10, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280'), marginBottom: 2}}>Shares</Text>
                                     <Text style={{fontSize: 13, fontFamily: designFont('Poppins-Medium'), color: designColor('1f2937')}}>{item.shares}</Text>
                                   </View>
                                   <View style={{flex: 1, backgroundColor: designColor('f8faff'), borderRadius: 8, padding: 8}}>
                                     <Text style={{fontSize: 10, fontFamily: designFont('Poppins-Regular'), color: designColor('6b7280'), marginBottom: 2}}>Weight</Text>
                                     <Text style={{fontSize: 13, fontFamily: designFont('Poppins-Medium'), color: designColor('1f2937')}}>
                                       {hasWeight ? `${item.weights}%` : '—'}
                                     </Text>
                                   </View>
                                 </View>
                               </View>
                             );
                           })}
                           <Text style={{fontSize: 9, fontFamily: designFont('Poppins-Regular'), color: designColor('9ca3af'), marginTop: 4, textAlign: 'center'}}>
                             Prices may be delayed.
                           </Text>
                         </View>)
                       ) : (
                         <EmptyState
                           title="No Holdings Yet"
                           subtitle="Accept and execute your first rebalance to start building your portfolio."
                         />
                       )}
                      </View>
                    </ScrollView>
                  );

                  case 'portfolio': return (
                    <ScrollView style={{flex: 1, width: '100%'}} contentContainerStyle={{paddingHorizontal: 16, paddingBottom: 24}} nestedScrollEnabled>
                     <View onLayout={handleTabLayout(1)}>
                      <View style={styles.tabIntro}>
                        <Text style={styles.tabIntroTitle}>Target allocation</Text>
                        <Text style={styles.tabIntroBody}>
                          The manager’s intended stock mix at the latest rebalance. Compare this with Holdings to see what you own today.
                        </Text>
                      </View>
                      {latestRebalance?.adviceEntries?.length ? (
                        <DistributionGridSlot
                          adviceEntries={latestRebalance.adviceEntries}
                          holdings={validOrderResults}
                          getLTPForSymbol={getLTPForSymbol}
                          totalCurrent={totalCurrent}
                          type="MPPerformanceScreen"
                        />
                      ) : (
                        <EmptyState
                          title="Target Allocation Not Available"
                          subtitle="This portfolio does not have a published target allocation yet. It is not a premium-access restriction."
                        />
                      )}
                     </View>
                    </ScrollView>
                  );

                  case 'methodology': {
                    const pd = strategyDetails?.performance_data;
                    const hasMethodology =
                      strategyDetails?.overView ||
                      strategyDetails?.definingUniverse ||
                      strategyDetails?.researchOverView ||
                      strategyDetails?.constituentScreening ||
                      strategyDetails?.rebalanceMethodologyText ||
                      pd;
                    return (
                      <ScrollView
                        style={{flex: 1, backgroundColor: designColor('fff')}}
                        contentContainerStyle={{padding: 16, paddingBottom: 24}}
                        nestedScrollEnabled={true}>
                        <View style={styles.tabIntro}>
                          <Text style={styles.tabIntroTitle}>Strategy & performance</Text>
                          <Text style={styles.tabIntroBody}>
                            Learn how this portfolio is managed and review its historical performance with the relevant disclosures.
                          </Text>
                        </View>
                        {/* Performance vs index chart */}
                        <Text style={styles.methodSectionHeading}>
                          Performance vs Index
                        </Text>
                        <PerformanceChartSlot modelName={strategyDetails?.model_name} />
                        {/* Overview */}
                        {strategyDetails?.overView ? (
                          <View style={styles.methodCard}>
                            <View style={styles.methodTitleRow}>
                              <View style={[styles.methodTitleBar, { backgroundColor: themeColor }]} />
                              <Text style={[styles.methodTitle, { color: themeColor }]}>Overview</Text>
                            </View>
                            <Text style={styles.methodBody}>
                              {strategyDetails.overView}
                            </Text>
                          </View>
                        ) : null}
                        {/* Methodology sections */}
                        <MethodologyCard
                          title="Defining the universe"
                          content={strategyDetails?.definingUniverse}
                        />
                        <MethodologyCard
                          title="Research"
                          content={strategyDetails?.researchOverView}
                        />
                        <MethodologyCard
                          title="Constituent Screening"
                          content={strategyDetails?.constituentScreening}
                        />
                        <MethodologyCard
                          title="Weighting"
                          content={
                            strategyDetails?.weighting &&
                            !isNaN(Number.parseFloat(strategyDetails.weighting))
                              ? Number.parseFloat(strategyDetails.weighting).toFixed(2)
                              : strategyDetails?.weighting
                          }
                        />
                        <MethodologyCard
                          title="Rebalance"
                          content={strategyDetails?.rebalanceMethodologyText}
                        />
                        <MethodologyCard
                          title="Asset Allocation"
                          content={strategyDetails?.assetAllocationText}
                        />
                        {/* Performance metrics */}
                        {pd ? (
                          <View style={{marginTop: 4}}>
                            <Text style={styles.methodSectionHeading}>
                              Performance Metrics
                            </Text>

                            <Text style={styles.metricGroupTitle}>Returns</Text>
                            <View style={styles.metricGrid}>
                              <MetricTile label="CAGR" value={formatMetric(pd.returns?.cagr, true)} />
                              <MetricTile label="Total" value={formatMetric(pd.returns?.total, true)} />
                              <MetricTile label="YTD" value={formatMetric(pd.returns?.ytd, true)} />
                              <MetricTile label="1Y" value={formatMetric(pd.returns?.['1y'], true)} />
                            </View>

                            <Text style={styles.metricGroupTitle}>Risk</Text>
                            <View style={styles.metricGrid}>
                              <MetricTile label="Volatility" value={formatMetric(pd.risk?.volatility, true)} />
                              <MetricTile label="VaR" value={formatMetric(pd.risk?.var, true)} />
                              <MetricTile label="CVaR" value={formatMetric(pd.risk?.cvar, true)} />
                              <MetricTile label="Ulcer Index" value={formatMetric(pd.risk?.ulcer_index, false)} />
                            </View>

                            <Text style={styles.metricGroupTitle}>Drawdown</Text>
                            <View style={styles.metricGrid}>
                              <MetricTile
                                label="Max Drawdown"
                                value={`${Number(pd.drawdown?.max_drawdown || 0).toFixed(2)}%`}
                                color={designColor('dc2626')}
                              />
                              <MetricTile
                                label="Avg Drawdown"
                                value={`${Number(pd.drawdown?.avg_drawdown || 0).toFixed(2)}%`}
                                color={designColor('dc2626')}
                              />
                              <MetricTile
                                label="Longest DD (Days)"
                                value={pd.drawdown?.longest_dd_days || '-'}
                              />
                            </View>

                            <Text style={styles.metricGroupTitle}>Ratios</Text>
                            <View style={styles.metricGrid}>
                              <MetricTile label="Sharpe" value={Number(pd.ratios?.sharpe || 0).toFixed(2)} />
                              <MetricTile label="Sortino" value={Number(pd.ratios?.sortino || 0).toFixed(2)} />
                              <MetricTile label="Profit Factor" value={Number(pd.ratios?.profit_factor || 0).toFixed(2)} />
                              <MetricTile label="Gain to Pain" value={Number(pd.ratios?.gain_to_pain || 0).toFixed(2)} />
                            </View>

                            <Text style={styles.metricGroupTitle}>Timing &amp; General</Text>
                            <View style={styles.metricGrid}>
                              <MetricTile
                                label="Win Rate"
                                value={`${Number(pd.timing?.win_rate || 0).toFixed(2)}%`}
                              />
                              <MetricTile
                                label="Best Day"
                                value={`${Number(pd.timing?.best_day || 0).toFixed(2)}%`}
                                color={designColor('16a34a')}
                              />
                              <MetricTile
                                label="Worst Day"
                                value={`${Number(pd.timing?.worst_day || 0).toFixed(2)}%`}
                                color={designColor('dc2626')}
                              />
                              <MetricTile
                                label="Time in Market"
                                value={`${Number(pd.general?.time_in_market || 0).toFixed(2)}%`}
                              />
                            </View>
                          </View>
                        ) : null}
                        {!hasMethodology ? (
                          <EmptyState
                            title="No Methodology Details"
                            subtitle="Methodology and performance details aren't available for this portfolio yet."
                          />
                        ) : null}
                      </ScrollView>
                    );
                  }
                  default:
                    return null;
                  }
                }}
                onIndexChange={setIndex}
                initialLayout={{width: screenWidth}}
                renderTabBar={props => (
                  <View
                    onLayout={event => {
                      const {height} = event.nativeEvent.layout;
                      setTabBarHeight(prev =>
                        Math.abs(prev - height) < 1 ? prev : height,
                      );
                    }}>
                    <CustomTabBar
                      isSubscriptionActive={false}
                      {...props}
                    />
                  </View>
                )}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <SafeAreaBoundary edges={['bottom']} style={styles.bottomSafeArea}>
        <View style={styles.bottomActions}>
          <TouchableOpacity
            onPress={() => setTerminateModal(true)}
            style={styles.exitBtn}>
            <Text style={styles.exitBtnText}>Exit Model Portfolio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setModifyInvestmentModal(true)}
            disabled={portfolioLoading || !userDetails?.user_broker}
            style={[
              styles.investBtn,
              (portfolioLoading || !userDetails?.user_broker) && {opacity: 0.55},
            ]}>
            <Text style={styles.investBtnText}>Update Investment Amount</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaBoundary>
      {/* Exit & Modify */}
      {slots.Modals}
    </LinearGradient>
  );
};
const styles = StyleSheet.create({
  container: {flex: 1},
  safeArea: {flex: 1},
  content: {paddingBottom: 32, backgroundColor: designColor('f6f8fb')},
  bottomSafeArea: {backgroundColor: designColor('fff')},
  bottomActions: {
    flexDirection: screenWidth < 360 ? 'column' : 'row',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: designColor('fff'),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: designColor('cbd5e1'),
    shadowColor: designColor('0f172a'),
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 8,
  },
  tabIntro: {paddingTop: 12, paddingBottom: 10},
  tabIntroTitle: {fontSize: 14, lineHeight: 20, fontFamily: designFont('Poppins-SemiBold'), color: designColor('1f2937')},
  tabIntroBody: {fontSize: 11, lineHeight: 17, fontFamily: designFont('Poppins-Regular'), color: designColor('64748b'), marginTop: 2},

  // Methodology tab
  methodSectionHeading: {
    fontSize: 15,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('1f2937'),
    marginBottom: 10,
    marginTop: 6,
  },
  methodCard: {
    backgroundColor: designColor('fff'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designColor('eef1f6'),
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: designColor('000'),
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  methodTitleRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 8},
  methodTitleBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: designColor('2563eb'),
    marginRight: 8,
  },
  methodTitle: {
    fontSize: 14,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('2563eb'),
  },
  methodBody: {
    fontSize: 13,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('374151'),
    lineHeight: 20,
    marginBottom: 4,
  },
  metricGroupTitle: {
    fontSize: 13,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('4b5563'),
    marginTop: 12,
    marginBottom: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTile: {
    width: (screenWidth - 32 - 8) / 2,
    backgroundColor: designColor('f8faff'),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: designColor('eef1f6'),
    padding: 10,
  },
  metricTileLabel: {
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    color: designColor('6b7280'),
    marginBottom: 3,
  },
  metricTileValue: {
    fontSize: 14,
    fontFamily: designFont('Poppins-SemiBold'),
    color: designColor('1f2937'),
  },

  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 0,
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: -16,
  },
  tabViewContainer: {
    flex: 1,
    // height is set per-render from the measured scene — see `tabViewHeight`.
    width: screenWidth,
    paddingHorizontal: 0,
    // Make TabView container flexible
    marginTop: 10, // Added margin for spacing
  },
  headerOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
    backgroundColor: designColor('fff'),
    color: designColor('000'),
    borderRadius: 5,
  },
  headerTitle: {
    color: designColor('ffffff'),
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginLeft: 16,
  },
  headerRight: {flexDirection: 'row', alignItems: 'center', gap: 8},
  iconButton: {padding: 4},
  avatar: {width: 28, height: 28, borderRadius: 14},

  zcInfraSection: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    padding: 16,
    marginTop: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  subHeaderRow: {flexDirection: 'row', alignItems: 'center'},
  portfolioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginRight: 8,
  },
  portfolioBadgeText: {color: designColor('ffffff'), fontSize: 12, fontWeight: '700'},
  activeBadge: {
    marginLeft: 'auto',
    backgroundColor: designColor('2ecc71'),
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeBadgeText: {color: designColor('ffffff'), fontSize: 12, fontWeight: '700'},

  balanceRow: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 16},
  caption: {color: 'rgba(255,255,255,0.9)', fontSize: 11},
  amount: {color: designColor('ffffff'), fontSize: 32, fontWeight: '800', marginTop: 4},
  plSection: {alignItems: 'center', justifyContent: 'center', marginLeft: 16},

  statItem: {alignItems: 'flex-end'},
  statLabel: {color: 'rgba(255,255,255,0.8)', fontSize: 11},
  statValue: {color: designColor('ffffff'), fontSize: 13, fontWeight: '700'},

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaText: {color: 'rgba(255,255,255,0.85)', fontSize: 11},
  methodTextHead: {
    color: 'rgba(0, 0, 0, 0.85)',
    fontSize: 11,
    fontFamily: designFont('Poppins-Bold'),
    marginTop: 20,
  },
  methodText: {color: 'rgba(0, 0, 0, 1)', fontSize: 11},
  pillsRow: {flexDirection: 'row', gap: 8, marginTop: 12},
  infoPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius: 2,
    padding: 8,
  },
  infoPillAccent: {backgroundColor: 'rgba(255,255,255,0.30)'},
  infoPillTitle: {color: designColor('fff'), fontSize: 10},
  infoPillValue: {color: designColor('ffffff'), fontSize: 12, marginTop: 4},
  infoPillValueAccent: {color: designColor('85f500'), fontSize: 12, marginTop: 4},

  holdingsLoadingState: {
    minHeight: 260,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdingsLoadingTitle: {
    marginTop: 16,
    color: designColor('1f2937'),
    fontSize: 15,
    fontFamily: designFont('Poppins-SemiBold'),
    textAlign: 'center',
  },
  holdingsLoadingText: {
    marginTop: 6,
    color: designColor('64748b'),
    fontSize: 11,
    fontFamily: designFont('Poppins-Regular'),
    lineHeight: 17,
    textAlign: 'center',
  },

  tabsRow: {flexDirection: 'row', marginTop: 12, gap: 8},
  tabBtn: {
    flex: 1,
    backgroundColor: designColor('e6eef9'),
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabBtnActive: {backgroundColor: designColor('29a400')},
  tabText: {color: designColor('0e2746'), fontSize: 12, fontWeight: '600'},
  tabTextActive: {color: designColor('ffffff')},

  plPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  plPillText: {color: designColor('ffffff'), fontSize: 12, fontWeight: '700'},
  totalReturnsLabel: {color: 'rgba(255,255,255,0.9)', fontSize: 11},
  totalReturnsValue: {
    color: designColor('2ecc71'),
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },

  circlesWrap: {
    position: 'absolute',
    right: -40,
    top: -10,
    width: 180,
    height: 180,
  },
  circle1: {
    position: 'absolute',
    right: 0,
    top: 30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  circle2: {
    position: 'absolute',
    right: 20,
    top: 60,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: designColor('e6eef9'),
    paddingBottom: 12,
  },
  splitTab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 8,
  },
  splitTabActive: {
    color: designColor('0e66ff'),
    fontSize: 14,
  },
  splitTabInactive: {
    color: designColor('0e2746'),
    fontSize: 14,
  },
  activeUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: designColor('0e66ff'),
    borderRadius: 1.5,
  },
  cardContainer: {
    backgroundColor: designColor('ffffff'),
    opacity: 0.1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: designColor('e2e8f3'),
    padding: 12,
    shadowColor: designColor('000000'),
    shadowOpacity: 0.0,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
    zIndex: 0,
  },
  card: {
    backgroundColor: designColor('ffffff'),
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: designColor('e6eef9'),
  },
  distRow: {marginBottom: 0},
  distLabel: {color: designColor('0e2746'), fontSize: 12, fontWeight: '600'},
  distPercent: {
    color: designColor('0e66ff'),
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
  progressTrack: {
    height: 12,
    backgroundColor: designColor('e6eef9'),
    borderRadius: 6,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {height: 12, backgroundColor: designColor('2d7dfd'), borderRadius: 6},

  investBtn: {
    backgroundColor: designColor('0e66ff'),
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  investBtnText: {color: designColor('ffffff'), fontSize: 13, fontFamily: designFont('Poppins-SemiBold'), textAlign: 'center'},

  exitBtn: {
    backgroundColor: designColor('e89a69ff'),
    borderRadius: 10,
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  exitBtnText: {color: designColor('ffffff'), fontSize: 13, fontFamily: designFont('Poppins-SemiBold'), textAlign: 'center'},

  handleWrap: {alignItems: 'center', marginTop: 14},
  handle: {width: 120, height: 4, borderRadius: 2, backgroundColor: designColor('0e2746')},
});

export default AfterSubscriptionScreen;
