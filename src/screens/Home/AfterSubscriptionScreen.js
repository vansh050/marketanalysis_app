import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {ChevronLeft, Bookmark} from 'lucide-react-native';
import {getAuth} from '@react-native-firebase/auth';
import {TabView, SceneMap, TabBar} from 'react-native-tab-view';
import {useNavigation} from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';
import moment from 'moment';

import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';

import PriceText from '../../components/AdviceScreenComponents/DynamicText/PriceText';
import PortfolioPercentage from '../../components/AdviceScreenComponents/DynamicText/PortfolioPercentage';
import ReviewTradeText from '../../components/AdviceScreenComponents/ReviewTradeText';

import RebalanceTimeLineModal from '../../components/ModelPortfolioComponents/RebalanceTimelineModal';
import ModifyInvestment from './ModifyInvestment1';
import TerminateStrategyModal from './TerminateStrategyModal';
import defaultImage from '../../assets/default.png';
import CustomTabBarMPPerformance from '../Drawer/CustomTabbarMPPerformance';
import EmptyStateInfoMP from '../Drawer/EmptyStateMP';
import PerformanceChart from '../../components/ModelPortfolioComponents/PerformanceChart';
import DistributionGrid from '../Drawer/DistributionRowGrid';
import {useTrade} from '../TradeContext';
import {useConfig} from '../../context/ConfigContext';

const screenWidth = Dimensions.get('window').width;
const ScreenHeight = Dimensions.get('window').height;
const InfoPill = ({title, value, accent}) => (
  <View style={[styles.infoPill, accent && styles.infoPillAccent]}>
    <Text style={styles.infoPillTitle}>{title}</Text>
    <Text style={[styles.infoPillValue, accent && styles.infoPillValueAccent]}>
      {value}
    </Text>
  </View>
);

const DistributionRow = ({label, percent}) => (
  <View style={styles.distRow}>
    <Text style={styles.distLabel}>{label}</Text>
    <Text style={styles.distPercent}>{percent}%</Text>
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, {width: `${percent}%`}]} />
    </View>
  </View>
);

const AfterSubscriptionScreen = ({route}) => {
  const {configData} = useTrade();
  const config = useConfig();
  const gradientStart = config?.gradient1 || '#002651';
  const gradientEnd = config?.gradient2 || '#0056B7';
  const themeColor = config?.themeColor || '#0056B7';
  const {fileName} = route.params;
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user && user.email;
  const navigation = useNavigation();
  const [index, setIndex] = useState(0);
  const [userDetails, setUserDetails] = useState();
  const [strategyDetails, setStrategyDetails] = useState(null);
  const [latestRebalance, setLatestRebalance] = useState(null);
  const [subscriptionAmount, setSubscrptionAmount] = useState();
  const [showRebalanceTimelineModal, setShowRebalanceTimelineModal] =
    useState(false);
  const [terminateModal, setTerminateModal] = useState(false);
  const [modifyInvestmentModal, setModifyInvestmentModal] = useState(false);
  const [tabHeights, setTabHeights] = useState([0, 0, 0]);
  const [routes] = useState([
    {key: 'holdings', title: 'Portfolio Holdings'},
    {key: 'portfolio', title: 'Portfolio Distribution'},
  ]);
  const handleTabLayout = index => event => {
    const {height} = event.nativeEvent.layout;
    setTabHeights(prev => {
      const newHeights = [...prev];
      newHeights[index] = height;

      return newHeights;
    });
  };
  // Fetch User. Auth header is built per-call (not memoized) so the short-lived
  // aq-encrypted-key JWT is freshly minted, avoiding stale-token 401s on a
  // device whose clock drifted. Retries once on 401 with a fresh token before
  // surfacing the error. Ported from web parity commit 5660392c.
  const buildAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
    'aq-encrypted-key': generateToken(
      Config.REACT_APP_AQ_KEYS,
      Config.REACT_APP_AQ_SECRET,
    ),
  });

  const getUserDeatils = (retry = true) => {
    axios
      .get(`${server.server.baseUrl}api/user/getUser/${userEmail}`, {
        headers: buildAuthHeaders(),
      })
      .then(res => setUserDetails(res.data.User))
      .catch(err => {
        if (retry && err?.response?.status === 401) {
          getUserDeatils(false);
          return;
        }
        console.log(err);
      });
  };
  useEffect(() => {
    getUserDeatils();
  }, [userEmail]);

  // Fetch Strategy
  const getStrategyDetails = () => {
    if (fileName) {
      axios
        .get(
          `${
            server.server.baseUrl
          }api/model-portfolio/portfolios/strategy/${fileName?.replaceAll(
            /_/g,
            ' ',
          )}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        )
        .then(res => {
          const portfolioData = res.data[0].originalData;
          setStrategyDetails(portfolioData);
          if (portfolioData?.model?.rebalanceHistory?.length > 0) {
            const latest = [...portfolioData.model.rebalanceHistory].sort(
              (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
            )[0];
            setLatestRebalance(latest);
          }
        })
        .catch(err => console.log(err));
    }
  };
  useEffect(() => {
    getStrategyDetails();
  }, [fileName]);

  // Subscription Amount
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [isStalebrokerData, setIsStalebrokerData] = useState(false);
  const getSubscriptionData = async () => {
    if (!userEmail || !strategyDetails) return;

    try {
      setPortfolioLoading(true);
      const headers = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      };

      // Fetch from both endpoints in parallel (matching web app)
      // 1. CCXT server — has the correct, up-to-date user_net_pf_model
      // 2. Backend — has subscription metadata (amounts, raw data)
      const [portfolioResponse, subscriptionResponse] = await Promise.allSettled([
        axios.get(
          `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(
            userEmail,
          )}/${encodeURIComponent(strategyDetails?.model_name)}`,
          {headers},
        ),
        axios.get(
          `${server.server.baseUrl}api/model-portfolio-db-update/subscription-raw-amount?email=${encodeURIComponent(
            userEmail,
          )}&modelName=${encodeURIComponent(
            strategyDetails?.model_name,
          )}&user_broker=${encodeURIComponent(
            userDetails?.user_broker || "",
          )}`,
          {headers},
        ),
      ]);

      const portfolioData = portfolioResponse.status === 'fulfilled'
        ? portfolioResponse.value?.data?.data
        : null;
      const subscriptionData = subscriptionResponse.status === 'fulfilled'
        ? subscriptionResponse.value?.data?.data
        : null;

      // Normalize user_net_pf_model to always be an array (matching web)
      if (portfolioData?.user_net_pf_model && !Array.isArray(portfolioData.user_net_pf_model)) {
        portfolioData.user_net_pf_model = [portfolioData.user_net_pf_model];
      }

      // Detect stale cross-broker data: CCXT returned empty for current broker
      // but subscription endpoint has holdings from a different broker.
      const ccxtHasHoldings = Array.isArray(portfolioData?.user_net_pf_model)
        ? portfolioData.user_net_pf_model.some(e => e?.order_results?.some(o => Number(o.quantity) > 0))
        : portfolioData?.user_net_pf_model?.order_results?.some(o => Number(o.quantity) > 0);
      const subHasHoldings = subscriptionData?.user_net_pf_model?.length > 0 ||
        (Array.isArray(subscriptionData?.user_net_pf_model) &&
          subscriptionData.user_net_pf_model.some(e => e?.order_results?.length > 0));
      setIsStalebrokerData(!ccxtHasHoldings && subHasHoldings);

      // Merge: CCXT's user_net_pf_model takes priority (matching web)
      const mergedData = {
        ...subscriptionData,
        user_net_pf_model: portfolioData?.user_net_pf_model || subscriptionData?.user_net_pf_model || [],
      };

      setSubscrptionAmount(mergedData);
      setPortfolioLoading(false);
    } catch (error) {
      setPortfolioLoading(false);
      console.error('Error fetching subscription data:', error);
    }
  };
  useEffect(() => {
    if (strategyDetails && userDetails) {
      getSubscriptionData();
    }
  }, [strategyDetails, userDetails]);

  const sortedRebalances = [...(subscriptionAmount?.subscription_amount_raw || [])].sort(
    (a, b) => new Date(b.dateTime) - new Date(a.dateTime),
  );

  // Use user_net_pf_model as source of truth; fallback to user_net_pf_updated (matching web)
  const net_portfolio_updated = (() => {
    const modelArr = subscriptionAmount?.user_net_pf_model;
    if (Array.isArray(modelArr) && modelArr.length > 0) {
      const latest = [...modelArr].sort(
        (a, b) => new Date(b.execDate) - new Date(a.execDate),
      )[0];
      if (latest?.order_results) return latest;
    }
    // Fallback to user_net_pf_updated with updated_qty mapping (matching web)
    const updatedArr = subscriptionAmount?.user_net_pf_updated;
    if (Array.isArray(updatedArr) && updatedArr.length > 0) {
      const latest = [...updatedArr].sort(
        (a, b) => new Date(b.execDate) - new Date(a.execDate),
      )[0];
      if (latest?.order_results) {
        return {
          ...latest,
          order_results: latest.order_results.map(item => ({
            ...item,
            quantity: item.updated_qty || 0,
          })),
        };
      }
    }
    return null;
  })();

  // Holdings list — match web's useStrategyDetailsWithPortfolioData.js
  // (no orderStatus filter). The previous filter dropped 'unplaced' and
  // 'rejected' rows, which broke parity with the Portfolio Distribution
  // tab: TVVISION (target weight 13%) appeared in Distribution but
  // disappeared from Holdings whenever its order was still 'unplaced'
  // (i.e. the user hadn't executed the latest rebalance yet). User
  // report 2026-06-09: "the holdings showing are 2 different" — same MP,
  // 4 stocks on Holdings, 6 entries on Distribution. Matching web closes
  // the gap; rejected rows now also show, which is web's behaviour too
  // (the rebalance modal already labels them — Holdings just needs to
  // reflect the same source-of-truth).
  // Keep only the qty > 0 guard so zero-quantity placeholders don't
  // clutter the list (mirrors the implicit web behaviour: tableData maps
  // every row but a qty=0 row renders as "Shares: 0" / "Weight: 0%").
  const validOrderResults = net_portfolio_updated?.order_results?.filter((order) => {
    return Number(order.quantity || 0) > 0;
  });

  // Per-symbol actual broker quantity from latest user_net_pf_updated.
  // Used to detect "phantom" holdings — rows where user_net_pf_model claims
  // qty=N but the broker reconciliation says qty<N (typical when an old model
  // snapshot lingers but the broker holds nothing, e.g. test accounts, broker
  // switch, fund withdrawal). The rebalance engine clamps to broker reality
  // via min(net, broker) in resultant_of_net_and_holding (rebalancing.py:2160),
  // so these rows produce BUYs not SELLs even though the user thinks they hold
  // them. Surfaced inline next to the symbol in the holdings table.
  const actualQtyBySymbol = (() => {
    const arr = subscriptionAmount?.user_net_pf_updated;
    if (!Array.isArray(arr) || arr.length === 0) return {};
    const latest = [...arr].sort(
      (a, b) => new Date(b.execDate) - new Date(a.execDate),
    )[0];
    const map = {};
    (latest?.order_results || []).forEach(o => {
      map[o.symbol] = Number(o.updated_qty ?? o.quantity ?? 0) || 0;
    });
    return map;
  })();

  const {getLTPForSymbol} = useWebSocketCurrentPrice(
    validOrderResults,
  );

  const totalUpdatedQty =
    validOrderResults?.reduce(
      (total, ele) => total + (ele?.quantity || 0),
      0,
    ) || 0;

  // Total Invested uses all order_results (matching web — no rejected filter)
  const totalInvested =
    net_portfolio_updated?.order_results?.reduce(
      (total, stock) => total + parseFloat(stock.averagePrice) * stock.quantity,
      0,
    ) || 0;

  // Saved LTP snapshot from DB (persisted when user last viewed this portfolio)
  const savedLtpSnapshot = subscriptionAmount?.ltp_snapshot?.prices || {};

  // Fetch LTP from ccxt cache when no saved snapshot and no WebSocket data
  const [fetchedLtps, setFetchedLtps] = useState({});
  useEffect(() => {
    if (!validOrderResults?.length || Object.keys(savedLtpSnapshot).length > 0) return;
    // Check if WebSocket has any data
    const hasLiveData = validOrderResults.some(s => getLTPForSymbol(s.symbol) > 0);
    if (hasLiveData) return;

    const fetchLtpsFromCache = async () => {
      const ltpMap = {};
      for (const stock of validOrderResults) {
        try {
          const exchange = stock.exchange || 'NSE';
          const response = await axios.get(
            `${server.ccxtServer.baseUrl}websocket/cache/ltp/${exchange}/${stock.symbol}`,
            {
              headers: {
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
              },
            },
          );
          if (response.data?.ltp) {
            ltpMap[stock.symbol] = parseFloat(response.data.ltp);
          }
        } catch (e) {
          // Symbol not in cache — skip
        }
      }
      if (Object.keys(ltpMap).length > 0) {
        setFetchedLtps(ltpMap);
        // Also save to DB for next time
        axios.put(
          `${server.server.baseUrl}api/model-portfolio/ltp-snapshot`,
          {email: userEmail, modelName: fileName, ltpMap},
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
            },
          },
        ).catch(() => {});
      }
    };
    fetchLtpsFromCache();
  }, [validOrderResults, savedLtpSnapshot]);

  // Total Current uses LTP — matching web behavior (skip if no LTP, with mobile fallbacks)
  const totalCurrent =
    net_portfolio_updated?.order_results?.reduce((total, stock) => {
      const liveLtp = getLTPForSymbol(stock.symbol);
      const savedLtp = parseFloat(savedLtpSnapshot[stock.symbol]);
      const cachedLtp = parseFloat(fetchedLtps[stock.symbol]);
      // Fallback chain: live WebSocket → saved DB snapshot → ccxt cache
      const ltp = (liveLtp > 0) ? liveLtp
        : (!isNaN(savedLtp) && savedLtp > 0) ? savedLtp
        : (!isNaN(cachedLtp) && cachedLtp > 0) ? cachedLtp
        : null;
      // Skip stock if no LTP available (matching web)
      if (ltp === null || isNaN(ltp)) return total;
      return total + ltp * stock.quantity;
    }, 0) || 0;

  // Save LTP snapshot to DB when prices arrive (for portfolio-summary endpoint)
  useEffect(() => {
    if (!validOrderResults?.length || !fileName || !userEmail) return;

    const ltpMap = {};
    let hasAnyLTP = false;
    validOrderResults.forEach(stock => {
      const ltp = parseFloat(getLTPForSymbol(stock.symbol));
      if (!isNaN(ltp) && ltp > 0) {
        ltpMap[stock.symbol] = ltp;
        hasAnyLTP = true;
      }
    });

    if (!hasAnyLTP) return;

    // Debounce: save after 5 seconds of stable prices
    const timer = setTimeout(() => {
      axios.put(
        `${server.server.baseUrl}api/model-portfolio/ltp-snapshot`,
        { email: userEmail, modelName: fileName, ltpMap },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
          },
        }
      ).catch(err => console.log('LTP snapshot save failed:', err.message));
    }, 5000);

    return () => clearTimeout(timer);
  }, [validOrderResults, fileName, userEmail, getLTPForSymbol]);

  // Matches web (prod-alphaquark-github StrategyDetailsWithPortfolioData.js:614-632):
  // when no LTP is available, show "N/A" for currentPrice / returns instead of
  // silently falling back to averagePrice — keeps the row consistent with the
  // top-card totalCurrent, which also skips no-LTP stocks. Mobile-only snapshot
  // and ccxt-cache fallbacks are kept (they're legitimate offline sources),
  // but avg is no longer used as a last-resort for "current".
  const tableData =
    validOrderResults?.map(stock => {
      const liveLtp = getLTPForSymbol(stock?.symbol);
      const savedLtp = parseFloat(savedLtpSnapshot[stock?.symbol]);
      const cachedLtp = parseFloat(fetchedLtps[stock?.symbol]);
      const avg = parseFloat(stock?.averagePrice);
      const resolvedLtp = (liveLtp > 0) ? liveLtp
        : (!isNaN(savedLtp) && savedLtp > 0) ? savedLtp
        : (!isNaN(cachedLtp) && cachedLtp > 0) ? cachedLtp
        : null;
      const hasValidPrice =
        resolvedLtp !== null && !isNaN(resolvedLtp) && resolvedLtp !== 0 &&
        !isNaN(avg) && avg !== 0;
      const modelQty = Number(stock?.quantity) || 0;
      const actualQty = actualQtyBySymbol?.[stock?.symbol];
      const isPhantom = actualQty !== undefined && actualQty < modelQty;
      return {
        symbol: stock.symbol,
        currentPrice: hasValidPrice ? resolvedLtp : 'N/A',
        avgBuyPrice: stock?.averagePrice,
        returns: hasValidPrice ? ((resolvedLtp - avg) / avg) * 100 : 'N/A',
        // Web parity (useStrategyDetailsWithPortfolioData.js:660-662):
        // share-count weight, formatted to 2 decimals as a string; "-"
        // sentinel when no shares to weight against. This is NOT a
        // value-based weight — both web AND mobile use share count
        // here, which is why a single high-share-count row (often a
        // phantom from broker reconciliation drift) can drown the
        // others to 0.00%. A value-based weight would be a divergence
        // from web; flagged separately.
        weights: totalUpdatedQty > 0
          ? ((stock?.quantity / totalUpdatedQty) * 100).toFixed(2)
          : '-',
        shares: stock?.quantity,
        isPhantom,
        actualQty,
      };
    }) || [];

  const [singleStrategyDetails, setSingleStrategyDetails] = useState();
  const getSingleStrategyDetails = () => {
    if (fileName !== null) {
      axios
        .get(
          `${
            server.server.baseUrl
          }api/model-portfolio/portfolios/strategy/${fileName?.replaceAll(
            /_/g,
            ' ',
          )}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        )
        .then(res => {
          const portfolioData = res.data[0].originalData;
          console.log('Inside :', portfolioData);
          setSingleStrategyDetails(portfolioData);
          if (
            portfolioData &&
            portfolioData.model &&
            portfolioData.model.rebalanceHistory.length > 0
          ) {
            const latest = [...portfolioData.model.rebalanceHistory].sort(
              (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
            )[0];
            setLatestRebalance(latest);
          }
        })
        .catch(err => console.log(err));
    }
  };

  useEffect(() => {
    getSingleStrategyDetails();
  }, [fileName]);

  return (
    <LinearGradient
      colors={[gradientStart, gradientEnd]}
      start={{x: 0, y: 0}}
      end={{x: 0, y: 1}}
      style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={gradientStart} />

        <ScrollView contentContainerStyle={styles.content}>
          {/* Header Card */}
          <LinearGradient
            colors={[gradientEnd, gradientStart]}
            style={styles.headerCard}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}>
                <ChevronLeft size={24} color="#000" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{fileName}</Text>
            </View>

            <View style={styles.zcInfraSection}>
              <View style={styles.circlesWrap} pointerEvents="none">
                <View style={styles.circle1} />
                <View style={styles.circle2} />
                <View style={styles.circle3} />
              </View>
              {/* 3-card layout: Invested | Current | Returns — all from same data source */}
              <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10}}>
                <View style={{flex: 1, alignItems: 'flex-start'}}>
                  <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'Poppins-Regular'}}>TOTAL INVESTED</Text>
                  <Text style={{color: '#FFFFFF', fontSize: 18, fontFamily: 'Poppins-SemiBold', marginTop: 2}}>
                    ₹{totalInvested?.toLocaleString('en-IN', {maximumFractionDigits: 0}) || '0'}
                  </Text>
                </View>
                <View style={{width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8}} />
                <View style={{flex: 1, alignItems: 'center'}}>
                  <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'Poppins-Regular'}}>TOTAL CURRENT</Text>
                  <Text style={{color: '#FFFFFF', fontSize: 18, fontFamily: 'Poppins-SemiBold', marginTop: 2}}>
                    ₹{totalCurrent?.toLocaleString('en-IN', {maximumFractionDigits: 0}) || '0'}
                  </Text>
                </View>
                <View style={{width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 8}} />
                <View style={{flex: 1, alignItems: 'flex-end'}}>
                  <Text style={{color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: 'Poppins-Regular'}}>CURRENT RETURNS</Text>
                  <Text style={{
                    color: (totalCurrent - totalInvested) >= 0 ? '#4ADE80' : '#F87171',
                    fontSize: 14,
                    fontFamily: 'Poppins-SemiBold',
                    marginTop: 2,
                  }}>
                    {(totalCurrent - totalInvested) >= 0 ? '+' : '-'}₹{Math.abs(totalCurrent - totalInvested).toLocaleString('en-IN', {maximumFractionDigits: 0})}
                  </Text>
                  <Text style={{
                    color: (totalCurrent - totalInvested) >= 0 ? '#4ADE80' : '#F87171',
                    fontSize: 11,
                    fontFamily: 'Poppins-Medium',
                  }}>
                    {totalInvested > 0 ? `${((totalCurrent - totalInvested) / totalInvested * 100).toFixed(2)}%` : '0.00%'}
                  </Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  Exp. Date{' '}
                  {moment(strategyDetails?.nextRebalanceDate).format(
                    'DD MMM YYYY',
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.pillsRow}>
              <InfoPill
                title="Next Rebalance"
                value={
                  strategyDetails?.nextRebalanceDate && moment(strategyDetails.nextRebalanceDate).isBefore(moment())
                    ? 'Rebalance due'
                    : moment(strategyDetails?.nextRebalanceDate).format('DD MMM, YYYY')
                }
                accent
              />
              <InfoPill
                title="Last Rebalance"
                value={
                  strategyDetails?.last_updated
                    ? moment(strategyDetails.last_updated).format('DD MMM, YYYY')
                    : 'N/A'
                }
              />
              <InfoPill title="Rebalance" value={strategyDetails?.frequency} />
            </View>
          </LinearGradient>

          {/* Holdings Distribution */}
          <View style={{}}>
            <View style={styles.tabViewContainer}>
              <TabView
                navigationState={{index, routes}}
                renderScene={SceneMap({
                  holdings: () => (
                    <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
                      {isStalebrokerData && (
                        <View style={{
                          marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, paddingVertical: 8,
                          backgroundColor: '#FEF3C7', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#F59E0B',
                          flexDirection: 'row', alignItems: 'flex-start',
                        }}>
                          <Text style={{fontSize: 12, fontFamily: 'Poppins-Regular', color: '#92400E', flex: 1}}>
                            ⚠️ Holdings shown are from a previous broker. To rebalance with {userDetails?.user_broker || 'your current broker'}, please update your holdings in the rebalance flow.
                          </Text>
                        </View>
                      )}
                      {tableData?.length > 0 ? (
                        <FlatList
                          data={tableData}
                          keyExtractor={(item, idx) => item.symbol + idx}
                          scrollEnabled={true}
                          nestedScrollEnabled={true}
                          contentContainerStyle={{paddingHorizontal: 12, paddingTop: 10, paddingBottom: 16, gap: 10}}
                          ListFooterComponent={
                            <Text style={{fontSize: 9, fontFamily: 'Poppins-Regular', color: '#9CA3AF', marginTop: 4, textAlign: 'center'}}>
                              Prices may be delayed.
                            </Text>
                          }
                          renderItem={({item}) => {
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
                              <View style={{
                                backgroundColor: '#fff',
                                borderRadius: 12,
                                borderLeftWidth: 3,
                                borderLeftColor: themeColor,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                elevation: 2,
                                shadowColor: '#000',
                                shadowOffset: {width: 0, height: 1},
                                shadowOpacity: 0.08,
                                shadowRadius: 3,
                              }}>
                                {/* Card header: symbol + returns badge */}
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10}}>
                                  <View style={{flex: 1, marginRight: 8}}>
                                    <Text style={{fontSize: 14, fontFamily: 'Poppins-SemiBold', color: '#1F2937'}}>{displaySymbol}</Text>
                                    {item.isPhantom && (
                                      <Text style={{
                                        fontSize: 9, fontFamily: 'Poppins-SemiBold',
                                        color: '#92400E', backgroundColor: '#FEF3C7',
                                        borderWidth: 1, borderColor: '#FDE68A',
                                        paddingHorizontal: 5, paddingVertical: 1,
                                        borderRadius: 3, alignSelf: 'flex-start', marginTop: 2,
                                      }}>
                                        Broker qty: {item.actualQty}
                                      </Text>
                                    )}
                                  </View>
                                  <View style={{
                                    backgroundColor: isPositive ? '#DCFCE7' : (hasReturns ? '#FEE2E2' : '#F3F4F6'),
                                    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
                                  }}>
                                    <Text style={{
                                      fontSize: 13, fontFamily: 'Poppins-SemiBold',
                                      color: isPositive ? '#16A34A' : (hasReturns ? '#DC2626' : '#9CA3AF'),
                                    }}>
                                      {hasReturns ? `${isPositive ? '+' : ''}${item.returns.toFixed(2)}%` : 'N/A'}
                                    </Text>
                                  </View>
                                </View>
                                {/* Data grid: 2 × 2 */}
                                <View style={{flexDirection: 'row', gap: 8}}>
                                  <View style={{flex: 1, backgroundColor: '#F8FAFF', borderRadius: 8, padding: 8}}>
                                    <Text style={{fontSize: 10, fontFamily: 'Poppins-Regular', color: '#6B7280', marginBottom: 2}}>Current Price</Text>
                                    <Text style={{fontSize: 13, fontFamily: 'Poppins-Medium', color: '#1F2937'}}>
                                      {hasPrice ? `₹${parseFloat(item.currentPrice).toFixed(2)}` : 'N/A'}
                                    </Text>
                                  </View>
                                  <View style={{flex: 1, backgroundColor: '#F8FAFF', borderRadius: 8, padding: 8}}>
                                    <Text style={{fontSize: 10, fontFamily: 'Poppins-Regular', color: '#6B7280', marginBottom: 2}}>Avg. Buy</Text>
                                    <Text style={{fontSize: 13, fontFamily: 'Poppins-Medium', color: '#1F2937'}}>
                                      ₹{parseFloat(item.avgBuyPrice).toFixed(2)}
                                    </Text>
                                  </View>
                                </View>
                                <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
                                  <View style={{flex: 1, backgroundColor: '#F8FAFF', borderRadius: 8, padding: 8}}>
                                    <Text style={{fontSize: 10, fontFamily: 'Poppins-Regular', color: '#6B7280', marginBottom: 2}}>Shares</Text>
                                    <Text style={{fontSize: 13, fontFamily: 'Poppins-Medium', color: '#1F2937'}}>{item.shares}</Text>
                                  </View>
                                  <View style={{flex: 1, backgroundColor: '#F8FAFF', borderRadius: 8, padding: 8}}>
                                    <Text style={{fontSize: 10, fontFamily: 'Poppins-Regular', color: '#6B7280', marginBottom: 2}}>Weight</Text>
                                    <Text style={{fontSize: 13, fontFamily: 'Poppins-Medium', color: '#1F2937'}}>
                                      {hasWeight ? `${item.weights}%` : '—'}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            );
                          }}
                        />
                      ) : (
                        <EmptyStateInfoMP
                          title="No Holdings Yet"
                          subtitle="Accept and execute your first rebalance to start building your portfolio."
                        />
                      )}
                    </SafeAreaView>
                  ),

                  portfolio: () => (
                    <View
                      style={{flex: 1, width: '100%', paddingHorizontal: 16}}>
                      {latestRebalance?.adviceEntries?.length ? (
                        <DistributionGrid
                          adviceEntries={latestRebalance.adviceEntries}
                          holdings={validOrderResults}
                          getLTPForSymbol={getLTPForSymbol}
                          totalCurrent={totalCurrent}
                          type="MPPerformanceScreen"
                        />
                      ) : (
                        <EmptyStateInfoMP />
                      )}
                    </View>
                  ),
                })}
                onIndexChange={setIndex}
                initialLayout={{width: screenWidth}}
                renderTabBar={props => (
                  <CustomTabBarMPPerformance
                    isSubscriptionActive={false}
                    {...props}
                  />
                )}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 10,
          gap: 10,
          backgroundColor: '#fff',
          paddingBottom: 10,
          borderWidth: 0.3,
          borderColor: '#c8c8c8',
          // Shadow / Elevation
          shadowColor: '#000', // iOS
          shadowOffset: {width: 0, height: 2}, // iOS
          shadowOpacity: 0.15, // iOS
          shadowRadius: 4, // iOS
          elevation: 4,
        }}>
        <TouchableOpacity
          onPress={() => setTerminateModal(true)}
          style={styles.exitBtn}>
          <Text style={styles.exitBtnText}>Exit Model Portfolio</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setModifyInvestmentModal(true)}
          style={styles.investBtn}>
          <Text style={styles.investBtnText}>Modify Investment</Text>
        </TouchableOpacity>
      </View>
      {/* Exit & Modify */}

      {modifyInvestmentModal && (
        <ModifyInvestment
          modifyInvestmentModal={modifyInvestmentModal}
          setModifyInvestmentModal={setModifyInvestmentModal}
          userEmail={userEmail}
          strategyDetails={strategyDetails}
          getStrategyDetails={getStrategyDetails}
          amount={sortedRebalances[0]?.amount || 0}
          latestRebalance={latestRebalance}
          userBroker={userDetails?.user_broker}
        />
      )}

      {terminateModal && (
        <TerminateStrategyModal
          setTerminateModal={setTerminateModal}
          terminateModal={terminateModal}
          userEmail={userEmail}
          strategyDetails={strategyDetails}
          userDetails={userDetails}
          getStrategyDetails={getStrategyDetails}
          tableData={tableData}
          totalInvested={totalInvested}
          totalCurrent={totalCurrent}
        />
      )}

      {showRebalanceTimelineModal && (
        <RebalanceTimeLineModal
          closeRebalanceTimelineModal={() =>
            setShowRebalanceTimelineModal(false)
          }
          strategyDetails={strategyDetails}
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  safeArea: {flex: 1},
  content: {paddingBottom: 32, backgroundColor: '#F6F8FB'},

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
    height: ScreenHeight,
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
    backgroundColor: '#FFF',
    color: '#000',
    borderRadius: 5,
  },
  headerTitle: {
    color: '#FFFFFF',
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
  portfolioBadgeText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  activeBadge: {
    marginLeft: 'auto',
    backgroundColor: '#2ECC71',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeBadgeText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},

  balanceRow: {flexDirection: 'row', alignItems: 'flex-start', marginTop: 16},
  caption: {color: 'rgba(255,255,255,0.9)', fontSize: 11},
  amount: {color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 4},
  plSection: {alignItems: 'center', justifyContent: 'center', marginLeft: 16},

  statItem: {alignItems: 'flex-end'},
  statLabel: {color: 'rgba(255,255,255,0.8)', fontSize: 11},
  statValue: {color: '#FFFFFF', fontSize: 13, fontWeight: '700'},

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  metaText: {color: 'rgba(255,255,255,0.85)', fontSize: 11},
  methodTextHead: {
    color: 'rgba(0, 0, 0, 0.85)',
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
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
  infoPillTitle: {color: '#fff', fontSize: 10},
  infoPillValue: {color: '#FFFFFF', fontSize: 12, marginTop: 4},
  infoPillValueAccent: {color: '#85F500', fontSize: 12, marginTop: 4},

  tabsRow: {flexDirection: 'row', marginTop: 12, gap: 8},
  tabBtn: {
    flex: 1,
    backgroundColor: '#E6EEF9',
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabBtnActive: {backgroundColor: '#29A400'},
  tabText: {color: '#0E2746', fontSize: 12, fontWeight: '600'},
  tabTextActive: {color: '#FFFFFF'},

  plPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  plPillText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  totalReturnsLabel: {color: 'rgba(255,255,255,0.9)', fontSize: 11},
  totalReturnsValue: {
    color: '#2ECC71',
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
    borderBottomColor: '#E6EEF9',
    paddingBottom: 12,
  },
  splitTab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 8,
  },
  splitTabActive: {
    color: '#0E66FF',
    fontSize: 14,
  },
  splitTabInactive: {
    color: '#0E2746',
    fontSize: 14,
  },
  activeUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#0E66FF',
    borderRadius: 1.5,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    opacity: 0.1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F3',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.0,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
    zIndex: 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E6EEF9',
  },
  distRow: {marginBottom: 0},
  distLabel: {color: '#0E2746', fontSize: 12, fontWeight: '600'},
  distPercent: {
    color: '#0E66FF',
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
  progressTrack: {
    height: 12,
    backgroundColor: '#E6EEF9',
    borderRadius: 6,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {height: 12, backgroundColor: '#2D7DFD', borderRadius: 6},

  investBtn: {
    backgroundColor: '#0E66FF',
    flex: 1,
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  investBtnText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},

  exitBtn: {
    backgroundColor: '#e89a69ff',
    borderRadius: 4,
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  exitBtnText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},

  handleWrap: {alignItems: 'center', marginTop: 14},
  handle: {width: 120, height: 4, borderRadius: 2, backgroundColor: '#0E2746'},
});

export default AfterSubscriptionScreen;
