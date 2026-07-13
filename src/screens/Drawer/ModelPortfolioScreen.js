/**
 * ModelPortfolioScreen — container (Phase I, 2026-05-02)
 *
 * Owns: useTrade, useConfig, useNavigation, Firebase getAuth,
 * axios (getAllBespoke, getAllStrategy, getSingleStrategyDetails,
 * getSpecificPlan, getAllSubscriptionData), TabView state,
 * modal state (payment, success, recommendation), RefreshControl.
 *
 * Resolves presentation from `screens.ModelPortfolioScreen`.
 * FlatLists for MP and Bespoke are passed as render-function slots.
 */

import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import axios from 'axios';
import MPInvestNowModal from '../../components/ModelPortfolioComponents/MPInvestNowModal';
import PaymentSuccessModal from '../../components/ModelPortfolioComponents/PaymentSuccessModal';
import {useNavigation, useRoute} from '@react-navigation/native';
import MPCard from '../../components/ModelPortfolioComponents/MPCard';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import {GitForkIcon} from 'lucide-react-native';
import Config from 'react-native-config';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import {generateToken} from '../../utils/SecurityTokenManager';
import MPCardBespoke from '../../components/ModelPortfolioComponents/MPCardBespoke';
import RecommendationSuccessModal from '../../components/ModelPortfolioComponents/RecommendationSuccessModal';
import {useTrade} from '../TradeContext';
import CustomTabBar from './CustomTabbar';
import {useConfig} from '../../context/ConfigContext';
import useTokens from '../../theme/useTokens';
import { useComponent } from '../../design/useDesign';
import useHomeMarketSummary from '../Home/hooks/useHomeMarketSummary';
import { shapeMpPlan, shapeBespokePlan } from '../../utils/alphanomyPlanShape';

const {width, width: ScreenWidth} = Dimensions.get('window');

const ModelPortfolioScreen = ({type = '', onDataLoaded}) => {
  const {userDetails, broker, getUserDeatils, configData} = useTrade();

  const config = useConfig();
  const tokens = useTokens();
  const gradient1 = tokens.colors.brand.gradientStart;
  const gradient2 = tokens.colors.brand.gradientEnd;
  const mainColor = tokens.colors.brand.primary;

  const Presentation = useComponent('screens.ModelPortfolioScreen');

  // Variant-facing live tickers — must run unconditionally at top of the
  // component (rules-of-hooks). Default presentation ignores `tickers`.
  const { tickers } = useHomeMarketSummary();

  const [allStrategy, setAllStrategy] = useState([]);
  const [allBespoke, setAllBespoke] = useState([]);
  const auth = getAuth();
  const [showPaymentFail, setShowPaymentFail] = useState(false);
  const navigation = useNavigation();
  const user = auth.currentUser;
  const userEmail = user?.email;

  // Variant-facing user name for the alphanomy `_AppHeader` greeting.
  // Declared AFTER `user` so we don't TDZ-read an undeclared binding.
  const userName = userDetails?.name || user?.displayName || '';

  // Variant-facing alphanomy plan rows — derived from the same catalog
  // state the legacy MP card list reads (`allStrategy`, `allBespoke`).
  // Default presentation ignores `alphanomyPlans`.
  const alphanomyPlans = React.useMemo(
      () => ({
          mp: (allStrategy || []).map((p) => shapeMpPlan(p)).filter(Boolean),
          bespoke: (allBespoke || []).map((p) => shapeBespokePlan(p)).filter(Boolean),
      }),
      [allStrategy, allBespoke],
  );
  const [loading, setLoading] = useState();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [OpenSubscribeModel, setOpenSubscribeModel] = useState(false);
  const [modalContext, setModalContext] = useState({
    specificPlan: null,
    specificPlanDetails: null,
    singleStrategyDetails: null,
    fileName: '',
  });
  const [strategyDetails, setStrategyDetails] = useState();
  const [latestRebalance, setLatestRebalance] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  const [refreshingMP, setRefreshingMP] = useState(false);
  const [refreshingBespoke, setRefreshingBespoke] = useState(false);

  const [index, setIndex] = useState(0);

  // Time-cycle plans are model-portfolio plans flagged `timeCyclePlan: true`
  // (Plan.js). They ride in `allStrategy`; we split them into their own tab.
  const timeCyclePlans = React.useMemo(
    () => (allStrategy || []).filter(p => p?.timeCyclePlan === true),
    [allStrategy],
  );
  const hasTimeCycle =
    config?.enableTimeCyclePlan !== false && timeCyclePlans.length > 0;

  const routes = React.useMemo(() => {
    const availableRoutes = [];
    // Model Portfolio FIRST so the screen lands here by default (index 0),
    // not on Bespoke.
    if (config?.modelPortfolioEnabled !== false) {
      availableRoutes.push({key: 'modelportfolio', title: 'Model Portfolio'});
    }
    // Time Cycle tab: only when the catalog actually has active time-cycle
    // plans (and not admin-disabled). No time-cycle plans → no dead tab.
    if (hasTimeCycle) {
      availableRoutes.push({
        key: 'timecycle',
        title: config?.timeCyclePlanLabel || 'Time Cycle',
      });
    }
    // Bespoke tab: shown only when the admin flag allows it AND the catalog
    // has at least one REAL bespoke plan. `priorRecommendationPlan` is a
    // backend-injected system offering (not an advisor-created bespoke plan),
    // so it must NOT, on its own, light up a "Bespoke Plan" tab — that's why
    // tenants with zero real bespoke plans were still seeing the tab.
    const realBespokeCount = (allBespoke || []).filter(
      p => p?.name !== 'priorRecommendationPlan',
    ).length;
    if (config?.bespokePlansEnabled !== false && realBespokeCount > 0) {
      availableRoutes.push({
        key: 'bespoke',
        title: config?.bespokePlanLabel || 'Bespoke Plan',
      });
    }
    return availableRoutes;
  }, [config, allBespoke, hasTimeCycle]);

  // Keep the selected tab index valid when `routes` shrinks (e.g. the bespoke
  // tab drops out because its catalog came back empty) — a stale index past
  // the end of `routes` crashes react-native-tab-view.
  React.useEffect(() => {
    if (index > routes.length - 1) {
      setIndex(Math.max(0, routes.length - 1));
    }
  }, [routes.length, index]);

  const [selectedPlanType, setSelectedPlanType] = useState(null);
  const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG || Config.REACT_APP_ADVISOR_SPECIFIC_TAG || getAdvisorSubdomain();
  const [openSuccessModal, setOpenSucessModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [planDetails, setPlanDetails] = useState(null);
  const [openTokenExpireModel, setOpenTokenExpireModel] = useState(null);
  const [oneTimeAmount, setOneTimeAmount] = useState(null);
  const [oneTimeDurationPlan, setOneTimeDurationPlan] = useState(null);

  const openModal = plan => {
    setSelectedPlan(plan);
    setModalVisible(true);
  };

  // Memoized fetchers
  const getAllBespoke = useCallback(async () => {
    setRefreshingBespoke(true);
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/admin/plan/${advisorTag}/bespoke/${userEmail}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Hide draft (unpublished) plans — matches web parity.
      const published = (response.data.data || []).filter(plan => !plan?.draft);
      setAllBespoke(published);
    } catch (error) {
      console.error('Error fetching bespoke:', error);
    } finally {
      setRefreshingBespoke(false);
    }
  }, [advisorTag, userEmail]);

  const getAllStrategy = useCallback(async () => {
    setRefreshingMP(true);
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/admin/plan/${advisorTag}/model portfolio/${userEmail}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      // Hide draft (unpublished) plans — matches web parity.
      const published = (response.data.data || []).filter(plan => !plan?.draft);
      setAllStrategy(published);
    } catch (error) {
      console.error('Error fetching strategy:', error);
    } finally {
      setRefreshingMP(false);
    }
  }, [advisorTag, userEmail]);

  const getSingleStrategyDetails = useCallback(async fileName => {
    if (!fileName) return;
    try {
      const res = await axios.get(
        `${server.server.baseUrl}api/model-portfolio/portfolios/strategy/${fileName}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      const portfolioData = res.data[0].originalData;
      setModalContext(prev => ({
        ...prev,
        singleStrategyDetails: portfolioData,
      }));
      if (portfolioData?.model?.rebalanceHistory?.length) {
        const latest = [...portfolioData.model.rebalanceHistory].sort(
          (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
        )[0];
        setLatestRebalance(latest);
      }
    } catch (error) {
      console.error('Error fetching single strategy:', error.response);
    }
  }, []);

  const getSpecificPlan = useCallback(
    async specificPlanId => {
      if (!specificPlanId) return;
      try {
        const res = await axios.get(
          `${server.server.baseUrl}api/admin/plan/detail/specific/${specificPlanId}/${userEmail}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        setStrategyDetails(res.data.data);
      } catch (error) {
        console.error('Error fetching specific plan:', error);
      }
    },
    [userEmail],
  );

  useEffect(() => {
    if (userEmail && advisorTag) {
      getUserDeatils();
      getAllBespoke();
      getAllStrategy();
    }
  }, [userEmail, advisorTag]);

  useEffect(() => {
    if (onDataLoaded) {
      const isMP = type.includes('mp');
      if (isMP) {
        onDataLoaded(allStrategy?.length > 0);
      } else {
        onDataLoaded(allBespoke?.length > 0);
      }
    }
  }, [allStrategy, allBespoke, type, onDataLoaded]);

  useEffect(() => {
    getSingleStrategyDetails(modalContext.fileName);
  }, [modalContext.fileName, getSingleStrategyDetails]);

  useEffect(() => {
    getSpecificPlan(modalContext.specificPlan?._id);
  }, [modalContext.specificPlan, getSpecificPlan]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (index >= routes.length && routes.length > 0) {
      setIndex(0);
    }
  }, [routes, index]);

  // Handlers
  const closeInvestNowModal = () => {
    setLoading(false);
    setSelectedCard(null);
    setPaymentModal(false);
  };

  const handlePricingCardClick = modelName => {
    setModalContext({
      specificPlan: modelName,
      specificPlanDetails: modelName,
      fileName: modelName?.name,
      singleStrategyDetails: modalContext.singleStrategyDetails,
    });
    setPaymentModal(true);
  };

  // Auto-open the payment modal when arriving from the alphanomy HomeScreen's
  // Subscribe button. Home navigates with route params:
  //   { kind: 'mp' | 'bespoke', subscribe: true, planName: <string> }
  // We wait for the matching catalog list to load (allStrategy / allBespoke),
  // switch to the correct tab via the routes array (order varies based on
  // `config.bespokePlansEnabled` / `config.modelPortfolioEnabled`), find the
  // plan by name, fire handlePricingCardClick, then clear the params so the
  // effect doesn't refire on rerenders.
  const route = useRoute();
  useEffect(() => {
    const params = route?.params;
    if (!params || !params.kind) return;

    // 1. Tab switching (always happens if kind is present)
    const tabKey =
      params.kind === 'bespoke' ? 'bespoke' : 'modelportfolio';
    const tabIdx = routes.findIndex(r => r.key === tabKey);
    if (tabIdx >= 0 && tabIdx !== index) setIndex(tabIdx);

    // 2. Action processing (subscribe / viewMore)
    const wantsSubscribe = params.subscribe === true;
    const wantsViewMore = params.viewMore === true;
    if (!wantsSubscribe && !wantsViewMore) {
      // If it's just 'View All', we clear the params after switching tabs
      if (typeof navigation?.setParams === 'function') {
        navigation.setParams({
          kind: undefined,
          subscribe: undefined,
          viewMore: undefined,
          planName: undefined,
        });
      }
      return;
    }

    const list = params.kind === 'bespoke' ? allBespoke : allStrategy;
    if (!Array.isArray(list) || list.length === 0) return;
    const target =
      (params.planName &&
        list.find(p => p?.name === params.planName)) ||
      list[0];
    if (!target) return;

    if (wantsSubscribe) {
      handlePricingCardClick(target);
    } else {
      // View More — same path the legacy MPCard's onViewMore takes:
      //   MP → MPPerformanceScreen, Bespoke → BespokePerformanceScreen.
      if (params.kind === 'bespoke') handleCardClickBespoke(target);
      else handleCardClick(target);
    }
    if (typeof navigation?.setParams === 'function') {
      navigation.setParams({
        kind: undefined,
        subscribe: undefined,
        viewMore: undefined,
        planName: undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params, allStrategy, allBespoke, routes]);

  const handleCardClickSelect = item => setSelectedCard(item);

  const handleCardClick = modelName => {
    setModalContext(prev => ({
      ...prev,
      specificPlan: modelName,
      specificPlanDetails: modelName,
      fileName: modelName?.name,
    }));
    navigation.navigate('MPPerformanceScreen', {
      modelName: modelName.name,
      specificPlan: modelName,
    });
  };

  const handleCardClickBespoke = modelName => {
    setModalContext(prev => ({
      ...prev,
      specificPlan: modelName,
      specificPlanDetails: modelName,
      fileName: modelName?.name,
    }));
    navigation.navigate('BespokePerformanceScreen', {
      modelName: modelName.name,
      specificPlan: modelName,
    });
  };

  const [subscriptionData, setSubscriptionData] = useState(null);
  const getAllSubscriptionData = () => {
    let reqConfig = {
      method: 'get',
      url: `${server.server.baseUrl}api/all-clients/user/${userEmail}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME || configData?.subdomain || getAdvisorSubdomain(),
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    };

    axios
      .request(reqConfig)
      .then(response => {
        setSubscriptionData(response.data.data);
      })
      .catch(error => {
        console.log(error);
      });
  };
  useEffect(() => {
    if (userEmail) {
      getAllSubscriptionData();
    }
  }, [userEmail]);

  // List renders
  const renderItembespoke = ({item}) => (
    <MPCardBespoke
      modelName={item?.name}
      image={item?.image ? `${server.server.baseUrl}${item?.image}` : ''}
      overview={item.overView}
      minInvestment={item.minInvestment}
      retentionRate={item.retentionRate}
      capital={item.capital}
      validity={item.validity}
      data={item}
      setSelectedCard={setSelectedCard}
      details={item.details}
      isSubscribed={item?.subscription}
      subscriptionData={subscriptionData}
      tradeRecoTypes={item.tradeRecoTypes}
      researchMethod={item.researchMethod}
      star={item.star}
      price={item.price}
      openModal={openModal}
      handleCardClick={() => handleCardClickBespoke(item)}
      handleSubscribe={() => handlePricingCardClick(item)}
      description={item.description}
    />
  );

  const renderItem = ({item, index}) => (
    <MPCard
      modelName={item.name}
      image={item?.image ? `${server.server.baseUrl}${item?.image}` : ''}
      overview={item.description}
      setSelectedCard={setSelectedCard}
      minInvestment={item.minInvestment}
      isSubscribed={item?.subscription}
      data={item}
      subscriptionData={subscriptionData}
      openModal={openModal}
      handleCardClick={() => handleCardClick(item)}
      handleSubscribe={() => handlePricingCardClick(item)}
      description={item.description}
      index={index}
    />
  );

  const sortedStrategy = [...(allStrategy || [])].sort((a, b) => {
    const aSubscribed = a?.subscription != null ? 1 : 0;
    const bSubscribed = b?.subscription != null ? 1 : 0;
    return bSubscribed - aSubscribed;
  });

  // In the tabbed Plans view, time-cycle plans get their own tab, so split
  // them out of the Model Portfolio list. Horizontal/home lists keep showing
  // the full set (default arg below).
  const mpTabStrategy = sortedStrategy.filter(p => !p?.timeCyclePlan);
  const tcTabStrategy = sortedStrategy.filter(p => p?.timeCyclePlan === true);

  const renderMPList = (data = sortedStrategy) => (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(item, idx) =>
        item._id || item.id || item.model_name?.toString() || idx.toString()
      }
      horizontal={type === 'mphorizontal'}
      refreshControl={
        <RefreshControl refreshing={refreshingMP} onRefresh={getAllStrategy} />
      }
      contentContainerStyle={{padding: 5}}
      style={{margin: 0}}
      ListEmptyComponent={
        <View style={localStyles.emptyContainer}>
          <View style={localStyles.iconWrapper}>
            <GitForkIcon size={60} color="#6B7280" />
          </View>
          <View style={localStyles.textWrapper}>
            <Text style={localStyles.emptyTitle}>No Model Portfolio Available</Text>
            <Text style={localStyles.emptySubtitle}>
              When your manager creates a strategy, it will appear here.
            </Text>
          </View>
        </View>
      }
    />
  );

  const renderBespokeList = () => (
    <FlatList
      data={allBespoke
        ?.filter(
          plan =>
            !(
              plan?.name === 'priorRecommendationPlan' &&
              userDetails?.previous_stocks_advice_purchased
            ),
        )
        .sort((p1, p2) => {
          if (p1.name === 'priorRecommendationPlan') return 1;
          if (p2.name === 'priorRecommendationPlan') return -1;
          return (p1?.subscription == null) - (p2?.subscription == null);
        })}
      renderItem={renderItembespoke}
      style={{
        marginLeft:
          allBespoke
            ?.filter(
              plan =>
                !(
                  plan?.name === 'priorRecommendationPlan' &&
                  userDetails?.previous_stocks_advice_purchased
                ),
            )
            .sort((p1, p2) => {
              if (p1.name === 'priorRecommendationPlan') return 1;
              if (p2.name === 'priorRecommendationPlan') return -1;
              return (p1?.subscription == null) - (p2?.subscription == null);
            }).length > 0
            ? 10
            : 0,
      }}
      keyExtractor={(item, idx) => item._id || item.id || idx.toString()}
      horizontal={type === 'bespokehorizontal'}
      contentContainerStyle={{padding: 5}}
      refreshControl={
        <RefreshControl
          refreshing={refreshingBespoke}
          onRefresh={getAllBespoke}
        />
      }
      ListEmptyComponent={
        refreshingBespoke ? null : (
          <View style={localStyles.emptyContainer}>
            <View style={localStyles.iconWrapper}>
              <GitForkIcon size={60} color="#6B7280" />
            </View>
            <View style={localStyles.textWrapper}>
              <Text style={localStyles.emptyTitle}>
                No {config?.bespokePlanLabel || 'Bespoke Plan'} Is Available Now
              </Text>
              <Text style={localStyles.emptySubtitle}>
                When your manager creates any strategy, it will appear here
              </Text>
            </View>
          </View>
        )
      }
    />
  );

  const singleListTypes = [
    'mphorizontal',
    'mpvertical',
    'bespokehorizontal',
    'bespokevertical',
  ];
  const isSingleListType = singleListTypes.includes(type);
  const isMP = type.includes('mp');
  const isHorizontal = type.includes('horizontal');

  // For horizontal types (used in HomeScreen), return null if no data
  if (isSingleListType && isHorizontal) {
    if (isMP && (!allStrategy || allStrategy.length === 0)) {
      return null;
    }
    if (!isMP && (!allBespoke || allBespoke.length === 0)) {
      return null;
    }
  }

  // Build modal slots
  const InvestNowModalSlot = paymentModal ? (
    <MPInvestNowModal
      visible={paymentModal}
      onClose={closeInvestNowModal}
      userEmail={userEmail}
      broker={broker}
      plans={planDetails}
      setShowPaymentFail={setShowPaymentFail}
      latestRebalance={latestRebalance}
      strategyDetails={modalContext.singleStrategyDetails}
      plandata={modalContext.specificPlanDetails}
      handleCardClick={handleCardClickSelect}
      selectedCard={selectedCard}
      getStrategyDetails={() =>
        getSingleStrategyDetails(modalContext.fileName)
      }
      setPaymentSuccess={setPaymentSuccess}
      getAllStrategy={getAllStrategy}
      specificPlan={modalContext.specificPlan}
      specificPlanDetails={modalContext.specificPlanDetails}
      setPaymentModal={setPaymentModal}
      userDetails={userDetails}
      fileName={modalContext?.fileName}
      isSubscribed={planDetails?.subscription}
      setOpenTokenExpireModel={setOpenTokenExpireModel}
      selectedPlanType={selectedPlanType}
      setSelectedPlanType={setSelectedPlanType}
      onetimeamount={oneTimeAmount}
      setOneTimeAmount={setOneTimeAmount}
      oneTimeDurationPlan={oneTimeDurationPlan}
      setOneTimeDurationPlan={setOneTimeDurationPlan}
      getAllBespoke={getAllBespoke}
    />
  ) : null;

  const RecommendationSuccessSlot = openSuccessModal ? (
    <RecommendationSuccessModal
      openSuccessModal={openSuccessModal}
      setOpenSucessModal={setOpenSucessModal}
      orderPlacementResponse={undefined}
    />
  ) : null;

  const PaymentSuccessSlot = paymentSuccess ? (
    <PaymentSuccessModal
      specificPlan={modalContext.specificPlan}
      specificPlanDetails={modalContext.specificPlanDetails}
      setPaymentSuccess={setPaymentSuccess}
      setPaymentModal={setPaymentModal}
      setSelectedCard={setSelectedCard}
      setOpenSubscribeModel={setOpenSubscribeModel}
    />
  ) : null;

  return (
    <Presentation
      viewModel={{
        gradient1,
        gradient2,
        mainColor,
        tabIndex: index,
        routes,
        isSingleListType,
        modalVisible,
        selectedPlan,
        showHeader: !(type === 'tab'),
        width,
        // Additive — default presentation ignores these.
        tickers,
        userEmail,
        userName,
        config,
        alphanomyPlans,
      }}
      actions={{
        onGoBack: () => navigation.goBack(),
        onTabIndexChange: setIndex,
        onCloseModal: () => setModalVisible(false),
        // Alphanomy variant: tapping Subscribe Now on a shaped plan card
        // resolves the raw plan from allStrategy/allBespoke by id and fires
        // the existing handlePricingCardClick → MPInvestNowModal opens.
        onSubscribe: (planId, kind) => {
          const list = kind === 'bespoke' ? allBespoke : allStrategy;
          if (!Array.isArray(list) || !planId) return;
          const raw = list.find(
            (p) => (p?._id || p?.id || p?.model_name) === planId,
          );
          if (raw) handlePricingCardClick(raw);
        },
        // Alphanomy variant: tapping View More resolves the raw plan and
        // routes to the same legacy detail screen alphaquark navigates to:
        //   MP plan → handleCardClick → MPPerformanceScreen
        //   Bespoke → handleCardClickBespoke → BespokePerformanceScreen
        // Identical path to MPCard's `onViewMore: handleCardClick` on default.
        onViewMore: (planId, kind) => {
          const list = kind === 'bespoke' ? allBespoke : allStrategy;
          if (!Array.isArray(list) || !planId) return;
          const raw = list.find(
            (p) => (p?._id || p?.id || p?.model_name) === planId,
          );
          if (!raw) return;
          if (kind === 'bespoke') handleCardClickBespoke(raw);
          else handleCardClick(raw);
        },
      }}
      slots={{
        TabBarSlot: (props) => <CustomTabBar {...props} />,
        MPListSlot: isSingleListType
          ? (isMP ? renderMPList : null)
          // Only carve time-cycle plans out of MP when the Time Cycle tab is
          // actually shown — otherwise they'd vanish with nowhere to appear.
          : () => renderMPList(hasTimeCycle ? mpTabStrategy : sortedStrategy),
        TimeCycleListSlot: isSingleListType
          ? null
          : () => renderMPList(tcTabStrategy),
        BespokeListSlot: isSingleListType
          ? (!isMP ? renderBespokeList : null)
          : renderBespokeList,
        InvestNowModalSlot,
        PaymentSuccessSlot,
        RecommendationSuccessSlot,
      }}
    />
  );
};

const localStyles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginHorizontal: 20,
    width: Dimensions.get('window').width - 40,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrapper: {
    marginBottom: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 50,
    padding: 10,
  },
  textWrapper: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ModelPortfolioScreen;
