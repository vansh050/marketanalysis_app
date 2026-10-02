import React, {useState, useEffect, useRef, useCallback} from 'react';
import {getAuth} from '@react-native-firebase/auth';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import axios from 'axios';
import Config from 'react-native-config';
import moment from 'moment';

import server from '../../utils/serverConfig';
import {generateToken} from '../../utils/SecurityTokenManager';
import {latestHeldExec} from '../../utils/rebalanceHelpers';
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
import useTokens from '../../theme/useTokens';
import {getAccountEmail} from '../../utils/accountEmail';
import {normalizeInvestmentBroker} from '../../utils/investmentUpdate';
import {resolveModelPortfolioHoldings} from '../../utils/modelPortfolioHoldings';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';

import {useComponent} from '../../design/useDesign';

const ScreenHeight = require('react-native').Dimensions.get('window').height;
const MIN_TAB_VIEW_HEIGHT = 320;
// --- Methodology / performance-metrics helpers (web parity) ---------------
// The ccxt performance_2/cagr calculator writes camelCase field names
// (totalReturnCumulative / oneYear / volatilityAnnual / ulcerIndex /
// drawdowns.maxDrawDown / timings.winRate); the read sites below expect the
// snake/short aliases. Add read-side aliases non-destructively so the metric
// tiles populate. Mirrors web src/utils/methodologyHelpers.js mapPerformanceData.
const normalizePerformanceData = portfolioData => {
  if (!portfolioData || typeof portfolioData !== 'object') return portfolioData;
  const pd = portfolioData.performance_data;
  if (!pd || typeof pd !== 'object') return portfolioData;
  const out = {...pd};
  if (pd.returns && typeof pd.returns === 'object') {
    out.returns = {...pd.returns};
    if (out.returns.total == null) out.returns.total = pd.returns.totalReturnCumulative;
    if (out.returns['1y'] == null) out.returns['1y'] = pd.returns.oneYear;
  }
  if (pd.risk && typeof pd.risk === 'object') {
    out.risk = {...pd.risk};
    if (out.risk.ulcer_index == null) out.risk.ulcer_index = pd.risk.ulcerIndex;
    if (out.risk.volatility == null) out.risk.volatility = pd.risk.volatilityAnnual;
  }
  const dd = pd.drawdowns || pd.drawdown;
  if (dd && typeof dd === 'object') {
    out.drawdown = {
      ...(pd.drawdown || {}),
      max_drawdown: (pd.drawdown && pd.drawdown.max_drawdown) ?? dd.maxDrawDown,
      avg_drawdown: (pd.drawdown && pd.drawdown.avg_drawdown) ?? dd.avgDrawDown,
      longest_dd_days: (pd.drawdown && pd.drawdown.longest_dd_days) ?? dd.longestDrawDownPeriod,
    };
  }
  const tm = pd.timings || pd.timing;
  if (tm && typeof tm === 'object') {
    out.timing = {
      ...(pd.timing || {}),
      win_rate: (pd.timing && pd.timing.win_rate) ?? tm.winRate,
      best_day: (pd.timing && pd.timing.best_day) ?? tm.bestDay,
      worst_day: (pd.timing && pd.timing.worst_day) ?? tm.worstDay,
    };
  }
  return {...portfolioData, performance_data: out};
};

const AfterSubscriptionScreen = ({route}) => {
  const {configData} = useTrade();
  const config = useConfig();
  const tokens = useTokens();
  const gradientStart = tokens.colors.brand.gradientStart;
  const gradientEnd = tokens.colors.brand.gradientEnd;
  const themeColor = tokens.colors.brand.accent;
  const {fileName, openModifyInvestment} = route.params || {};
  // One-shot intent: the rebalance flow alerts "update subscription amount" and
  // navigates here with openModifyInvestment:true. Auto-open the Update
  // Investment modal once the strategy and real broker identity have loaded —
  // before this, the user
  // landed on this screen after the alert with no obvious next step and the
  // bottom button was easily missed / misread as non-clickable (RA 2026-08-11
  // markup). Waiting for userBroker also prevents a slower profile fetch from
  // reading or saving the amount against a placeholder broker record. The ref
  // guard makes it fire exactly once per navigation.
  const openModifyInvestmentRef = useRef(openModifyInvestment === true);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();
  const navigation = useNavigation();
  const [index, setIndex] = useState(0);
  const [userDetails, setUserDetails] = useState();
  const userBroker = normalizeInvestmentBroker(userDetails?.user_broker);
  const [strategyDetails, setStrategyDetails] = useState(null);
  const [latestRebalance, setLatestRebalance] = useState(null);
  const [subscriptionAmount, setSubscrptionAmount] = useState();
  const [showRebalanceTimelineModal, setShowRebalanceTimelineModal] =
    useState(false);
  const [terminateModal, setTerminateModal] = useState(false);
  const [modifyInvestmentModal, setModifyInvestmentModal] = useState(false);
  const [tabHeights, setTabHeights] = useState([0, 0, 0]);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [routes] = useState([
    {key: 'holdings', title: 'Holdings'},
    {key: 'portfolio', title: 'Target mix'},
    {key: 'methodology', title: 'Strategy'},
  ]);
  // The TabView lives inside the screen's outer ScrollView, so it cannot take
  // its height from a flex parent — it needs an explicit one. It used to be a
  // hard `ScreenHeight`, which silently CLIPPED any scene taller than one
  // screen: with four or more holdings the last card lost its Shares/Weight
  // row and the disclaimer never rendered (user-reported 2026-09-02). Measure
  // the scene instead and size the container to it.
  const handleTabLayout = index => event => {
    const {height} = event.nativeEvent.layout;
    setTabHeights(prev => {
      // Bail on no-op measurements: `handleTabLayout` runs on every layout
      // pass, and returning a fresh array each time would re-render forever.
      if (Math.abs((prev[index] || 0) - height) < 1) {
        return prev;
      }
      const newHeights = [...prev];
      newHeights[index] = height;

      return newHeights;
    });
  };
  // Strategy (index 2) keeps the fixed height: it scrolls internally, so its
  // wrapper always measures as the container and cannot drive it.
  const measuredSceneHeight = tabHeights[index] || 0;
  const tabViewHeight =
    index === 2 || measuredSceneHeight <= 0
      ? ScreenHeight
      : Math.max(measuredSceneHeight + tabBarHeight, MIN_TAB_VIEW_HEIGHT);
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
          // Normalize performance_data field-name drift so the Methodology
          // tab's metric tiles populate (web parity — methodologyHelpers).
          setStrategyDetails(normalizePerformanceData(portfolioData));
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

  // Auto-open Update Investment when this screen is reached from the rebalance
  // "subscription amount not set" alert (openModifyInvestment:true). Fires once,
  // only after strategy data and the real broker have loaded. Rebalance history
  // is optional because the save path can resolve model_id from strategy data.
  useEffect(() => {
    if (
      openModifyInvestmentRef.current &&
      strategyDetails &&
      userBroker
    ) {
      openModifyInvestmentRef.current = false;
      setModifyInvestmentModal(true);
    }
  }, [strategyDetails, userBroker]);

  // Subscription Amount
  // Start in loading state so the first paint never claims the customer has
  // ₹0 / no holdings while user, strategy and broker identity are hydrating.
  const [portfolioLoading, setPortfolioLoading] = useState(true);
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
          )}/${encodeURIComponent(strategyDetails?.model_name)}?broker=${encodeURIComponent(
            userBroker || userDetails?.user_broker || 'DummyBroker',
          )}`,
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

      const resolvedHoldings = resolveModelPortfolioHoldings(
        portfolioData,
        subscriptionData,
        userDetails?.user_broker,
      );
      setIsStalebrokerData(resolvedHoldings.isStaleBrokerData);

      // Merge: a populated current-broker CCXT execution is authoritative;
      // an empty CCXT response may fall back to the post-execution Node mirror.
      const mergedData = {
        ...subscriptionData,
        user_net_pf_model: resolvedHoldings.executions,
      };

      setSubscrptionAmount(mergedData);
      setPortfolioLoading(false);
    } catch (error) {
      setPortfolioLoading(false);
      console.error('Error fetching subscription data:', error);
    }
  };
  useFocusEffect(
    useCallback(() => {
      if (strategyDetails && userDetails) {
        getSubscriptionData();
      }
      // getSubscriptionData intentionally remains render-local because it
      // mints fresh short-lived headers for every focus-driven request.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strategyDetails, userDetails, userEmail]),
  );

  useEffect(() => {
    const unsubscribe = portfolioEvents.on(
      PORTFOLIO_EVENTS.HOLDINGS_REFRESH,
      () => {
        if (strategyDetails && userDetails) {
          getSubscriptionData();
        }
      },
    );
    return unsubscribe;
    // The event listener is rebound when its account/model inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyDetails, userDetails, userEmail]);

  const sortedRebalances = [...(subscriptionAmount?.subscription_amount_raw || [])].sort(
    (a, b) => new Date(b.dateTime) - new Date(a.dateTime),
  );

  // Use user_net_pf_model as source of truth; fallback to user_net_pf_updated (matching web)
  const net_portfolio_updated = (() => {
    const latest = latestHeldExec(subscriptionAmount?.user_net_pf_model);
    if (latest) return latest;
    // Fallback to user_net_pf_updated with updated_qty mapping (matching web)
    const updatedLatest = latestHeldExec(subscriptionAmount?.user_net_pf_updated);
    if (updatedLatest) {
      return {
        ...updatedLatest,
        order_results: updatedLatest.order_results.map(item => ({
          ...item,
          quantity: item.updated_qty || 0,
        })),
      };
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
    const latest = latestHeldExec(subscriptionAmount?.user_net_pf_updated);
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

  const nextRebalanceMoment = moment(strategyDetails?.nextRebalanceDate);
  const nextRebalanceLabel = nextRebalanceMoment.isValid() &&
    nextRebalanceMoment.endOf('day').isSameOrAfter(moment())
    ? nextRebalanceMoment.format('DD MMM, YYYY')
    : 'Schedule to be announced';

  const Presentation = useComponent('screens.AfterSubscriptionScreen');
  const modalSlot = (
    <>
      {modifyInvestmentModal && (
        <ModifyInvestment
          modifyInvestmentModal={modifyInvestmentModal}
          setModifyInvestmentModal={setModifyInvestmentModal}
          userEmail={userEmail}
          strategyDetails={strategyDetails}
          getStrategyDetails={getStrategyDetails}
          amount={sortedRebalances[0]?.amount || 0}
          latestRebalance={latestRebalance}
          userBroker={userBroker}
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

    </>
  );
  return (
    <Presentation
      viewModel={{
        gradientStart, gradientEnd, fileName, portfolioLoading, totalInvested,
        totalCurrent, nextRebalanceLabel, strategyDetails, tabViewHeight,
        index, routes, isStalebrokerData, userDetails, tableData, themeColor,
        latestRebalance, validOrderResults,
      }}
      actions={{
        onBack: () => navigation.goBack(),
        handleTabLayout, setIndex, setTabBarHeight, getLTPForSymbol,
        setTerminateModal, setModifyInvestmentModal,
      }}
      slots={{
        CustomTabBar: CustomTabBarMPPerformance,
        EmptyState: EmptyStateInfoMP,
        PerformanceChart,
        DistributionGrid,
        Modals: modalSlot,
      }}
    />
  );
};

export default AfterSubscriptionScreen;
