import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Modal,
  ScrollView,
} from 'react-native';
import axios from 'axios';
import uuid from 'react-native-uuid';
import MPInvestNowModal from '../../components/ModelPortfolioComponents/MPInvestNowModal';
import PaymentSuccessModal from '../../components/ModelPortfolioComponents/PaymentSuccessModal';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import MPCard from '../../components/ModelPortfolioComponents/MPCard';
import {getAuth} from '@react-native-firebase/auth';
import server from '../../utils/serverConfig';
import {ChevronLeft, GitForkIcon} from 'lucide-react-native';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';
import {TabView} from 'react-native-tab-view';
import MPCardBespoke from '../../components/ModelPortfolioComponents/MPCardBespoke';
import RecommendationSuccessModal from '../../components/ModelPortfolioComponents/RecommendationSuccessModal';
import {useTrade} from '../TradeContext';
import CustomTabBar from './CustomTabbar';
import RenderHTML from 'react-native-render-html';
import LinearGradient from 'react-native-linear-gradient';
import {useConfig} from '../../context/ConfigContext';

const {width, width: ScreenWidth} = Dimensions.get('window');

const ModelPortfolioScreen = ({type = '', onDataLoaded}) => {
  const {userDetails, broker, getUserDeatils, configData} = useTrade();

  // Get dynamic colors from config
  const config = useConfig();
  const gradient1 = config?.gradient1 || 'rgba(0, 86, 183, 1)';
  const gradient2 = config?.gradient2 || 'rgba(0, 38, 81, 1)';
  const mainColor = config?.mainColor || '#2563EB';
  const [allStrategy, setAllStrategy] = useState([]);
  const [allBespoke, setAllBespoke] = useState([]);
  const auth = getAuth();
  const [showPaymentFail, setShowPaymentFail] = useState(false);
  const navigation = useNavigation();
  const user = auth.currentUser;
  const userEmail = user?.email;
  const [loading, setLoading] = useState();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [OpenSubscribeModel, setOpenSubscribeModel] = useState(false);
  // Batch modal related states into one for fewer re-renders
  const [modalContext, setModalContext] = useState({
    specificPlan: null,
    specificPlanDetails: null,
    singleStrategyDetails: null,
    fileName: '',
  });
  const [strategyDetails, setStrategyDetails] = useState();
  //console.log("this opens----Hereeee",type);
  const [latestRebalance, setLatestRebalance] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);

  // Separate refreshing states for each list
  const [refreshingMP, setRefreshingMP] = useState(false);
  const [refreshingBespoke, setRefreshingBespoke] = useState(false);

  const [index, setIndex] = useState(0);

  // Dynamic routes based on feature flags. Each tab's scene renders its own
  // empty state when the underlying list is empty, so tab visibility is
  // driven purely by the advisor's enabled features (matches web behavior).
  const routes = React.useMemo(() => {
    const availableRoutes = [];

    if (config?.bespokePlansEnabled !== false) {
      availableRoutes.push({key: 'bespoke', title: 'Bespoke Plan'});
    }

    if (config?.modelPortfolioEnabled !== false) {
      availableRoutes.push({key: 'modelportfolio', title: 'Model Portfolio'});
    }

    return availableRoutes;
  }, [config]);
 // console.log("routesss-----",routes);

  const [selectedPlanType, setSelectedPlanType] = useState(null);
  const advisorTag = configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG;
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
  // console.log('Advisor tag----', advisorTag);

  // Memoized fetchers
  const getAllBespoke = useCallback(async () => {
    setRefreshingBespoke(true);
    try {
      const response = await axios.get(
        `${server.server.baseUrl}api/admin/plan/${advisorTag}/bespoke/${userEmail}`,
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
      );
      setAllBespoke(response.data.data);
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
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
        },
      );
      setAllStrategy(response.data.data);
    } catch (error) {
      console.error('Error fetching strategy:', error);
    } finally {
      setRefreshingMP(false);
    }
  }, [advisorTag, userEmail]);

  const getSingleStrategyDetails = useCallback(async fileName => {
    // console.log('File name----', fileName);
    if (!fileName) return;
    try {
      const res = await axios.get(
        `${server.server.baseUrl}api/model-portfolio/portfolios/strategy/${fileName}`,
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
              'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
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

  // Effects for fetching data and detail updates
  // Must wait for both userEmail AND advisorTag (from configData) to be available
  useEffect(() => {
    if (userEmail && advisorTag) {
      getUserDeatils();
      getAllBespoke();
      getAllStrategy();
    }
  }, [userEmail, advisorTag]);

  // Notify parent about data availability
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

  // Reset index if it's out of bounds when routes change
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
    // console.log('Model name data here----', modelName);
    setModalContext({
      specificPlan: modelName,
      specificPlanDetails: modelName,
      fileName: modelName?.name,
      singleStrategyDetails: modalContext.singleStrategyDetails, // preserve existing plans if any
    });
    setPaymentModal(true);
  };

  const handleCardClickSelect = item => setSelectedCard(item);

  const handleCardClick = modelName => {
    // console.log('model Name:---', modelName);
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
    // console.log('model Name:---Bepsokeeeee', modelName);
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
    let config = {
      method: 'get',
      url: `${server.server.baseUrl}api/all-clients/user/${userEmail}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    };

    axios
      .request(config)
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

  const renderItem = ({item}) => (
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
    />
  );

  // Sort model portfolios: subscribed first, then unsubscribed
  const sortedStrategy = [...(allStrategy || [])].sort((a, b) => {
    const aSubscribed = a?.subscription != null ? 1 : 0;
    const bSubscribed = b?.subscription != null ? 1 : 0;
    return bSubscribed - aSubscribed;
  });

  const renderMPList = () => (
    <FlatList
      data={sortedStrategy}
      renderItem={renderItem}
      keyExtractor={(item, index) =>
        item._id || item.id || item.model_name?.toString() || index.toString()
      }
      horizontal={type === 'mphorizontal'}
      refreshControl={
        <RefreshControl refreshing={refreshingMP} onRefresh={getAllStrategy} />
      }
      contentContainerStyle={{padding: 5}}
      style={{margin: 0}}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <View style={styles.iconWrapper}>
            <GitForkIcon size={60} color="#6B7280" />
          </View>
          <View style={styles.textWrapper}>
            <Text style={styles.emptyTitle}>No Model Portfolio Available</Text>
            <Text style={styles.emptySubtitle}>
              When your advisor creates a strategy, it will appear here.
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
      keyExtractor={(item, index) => item._id || item.id || index.toString()}
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
          <View style={styles.emptyContainer}>
            <View style={styles.iconWrapper}>
              <GitForkIcon size={60} color="#6B7280" />
            </View>
            <View style={styles.textWrapper}>
              <Text style={styles.emptyTitle}>
                No Bespoke Plan Is Available Now
              </Text>
              <Text style={styles.emptySubtitle}>
                When your advisor creates any strategy, it will appear here
              </Text>
            </View>
          </View>
        )
      }
    />
  );

  const renderScene = ({route}) => {
    if (
      (type === 'mpvertical' || type === 'mphorizontal') &&
      route.key === 'modelportfolio'
    )
      return renderMPList();
    if (
      (type === 'bespokevertical' || type === 'bespokehorizontal') &&
      route.key === 'bespoke'
    )
      return renderBespokeList();
    if (route.key === 'modelportfolio') return renderMPList();
    if (route.key === 'bespoke') return renderBespokeList();
    return null;
  };

  const singleListTypes = [
    'mphorizontal',
    'mpvertical',
    'bespokehorizontal',
    'bespokevertical',
  ];

  if (singleListTypes.includes(type)) {
    const isMP = type.includes('mp');
    const isHorizontal = type.includes('horizontal');

    // For horizontal types (used in HomeScreen), return null if no data
    if (isHorizontal) {
      if (isMP && (!allStrategy || allStrategy.length === 0)) {
        return null;
      }
      if (!isMP && (!allBespoke || allBespoke.length === 0)) {
        return null;
      }
    }

    return (
      <SafeAreaView style={{flex: 1, backgroundColor: 'transparent'}}>
        {isMP ? renderMPList() : renderBespokeList()}
        {paymentModal && (
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
        )}
        {openSuccessModal && (
          <RecommendationSuccessModal
            openSuccessModal={openSuccessModal}
            setOpenSucessModal={setOpenSucessModal}
            orderPlacementResponse={orderPlacementResponse}
          />
        )}
        {paymentSuccess && (
          <PaymentSuccessModal
            specificPlan={modalContext.specificPlan}
            specificPlanDetails={modalContext.specificPlanDetails}
            setPaymentSuccess={setPaymentSuccess}
            setPaymentModal={setPaymentModal}
            setSelectedCard={setSelectedCard}
            setOpenSubscribeModel={setOpenSubscribeModel}
          />
        )}
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedPlan?.name}</Text>
                <View
                  style={[
                    styles.planTag,
                    {
                      backgroundColor:
                        selectedPlan?.type === 'bespoke'
                          ? '#F59E0B'
                          : '#10B981',
                    },
                  ]}>
                  <Text style={styles.planTagText}>
                    {selectedPlan?.type === 'bespoke' ? 'Bespoke' : 'MP'}
                  </Text>
                </View>
              </View>

              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}>
                {/* Advisor */}
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Advisor</Text>
                  <Text style={styles.infoValue}>{selectedPlan?.advisor}</Text>
                </View>

                {/* Invested / Minimum Investment */}
                {selectedPlan?.subscription?.amount ||
                selectedPlan?.minInvestment ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Invested / Minimum</Text>
                    <Text style={styles.infoValue}>
                      {selectedPlan?.subscription?.amount
                        ? `₹ ${selectedPlan.subscription.amount}`
                        : selectedPlan?.minInvestment
                        ? `₹ ${selectedPlan.minInvestment}`
                        : '-'}
                    </Text>
                  </View>
                ) : null}

                {/* Validity / Duration */}
                {selectedPlan?.subscription?.end_date ||
                selectedPlan?.duration ? (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Validity / Duration</Text>
                    <Text style={styles.infoValue}>
                      {selectedPlan?.subscription?.end_date
                        ? new Date(
                            selectedPlan.subscription.end_date,
                          ).toLocaleDateString()
                        : selectedPlan?.duration
                        ? `${selectedPlan.duration} days`
                        : '-'}
                    </Text>
                  </View>
                ) : null}

                {/* Description */}
                {selectedPlan?.description && (
                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>Description</Text>
                    <RenderHTML
                      contentWidth={width - 64} // adjust for modal padding
                      source={{html: selectedPlan.description}}
                      baseStyle={styles.infoValue}
                    />
                  </View>
                )}

                {/* Onetime Options */}
                {selectedPlan?.onetimeOptions?.length > 0 && (
                  <View style={styles.infoCard}>
                    <Text style={[styles.infoLabel, {marginBottom: 8}]}>
                      Onetime Options
                    </Text>
                    {selectedPlan.onetimeOptions.map((opt, index) => (
                      <View key={index} style={styles.optionRow}>
                        <Text style={styles.optionLabel}>
                          {opt.label || `${opt.duration} Days`}
                        </Text>
                        <Text style={styles.optionValue}>₹ {opt.amount}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Recurring / Frequency Options */}
                {selectedPlan?.frequency?.length > 0 && (
                  <View style={styles.infoCard}>
                    <Text style={[styles.infoLabel, {marginBottom: 8}]}>
                      Recurring Options
                    </Text>
                    {selectedPlan.frequency.map((freq, index) => {
                      const price = selectedPlan.pricing?.[freq];
                      return (
                        <View key={index} style={styles.optionRow}>
                          <Text style={styles.optionLabel}>
                            {freq.charAt(0).toUpperCase() + freq.slice(1)}
                          </Text>
                          <Text style={styles.optionValue}>
                            {price && Number(price) > 0 ? `₹ ${price}` : 'N/A'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalCloseButton, { backgroundColor: mainColor }]}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#FBFBFB'}}>
      {!(type === 'tab') && (
        <LinearGradient
          colors={[gradient1, gradient2]}
          start={{x: 0, y: 0}}
          end={{x: 0, y: 1}}
          style={{
            paddingHorizontal: 15,
            paddingVertical: 10,
            borderBottomLeftRadius: 15,
            borderBottomRightRadius: 15,
          }}>
          <View
            style={{flexDirection: 'row', alignItems: 'center', marginTop: 10}}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}>
              <ChevronLeft size={24} color="#000" />
            </TouchableOpacity>
            <View style={{justifyContent: 'center'}}>
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: 'Poppins-Medium',
                  color: '#fff',
                }}>
                Plans
              </Text>
            </View>
          </View>
          <View style={{marginLeft: 45, marginTop: 2}}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: 'Poppins-Regular',
                color: '#f0f0f0',
              }}>
              You can subscribe to 1 or more Plans
            </Text>
          </View>
        </LinearGradient>
      )}

      {routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.iconWrapper}>
            <GitForkIcon size={60} color="#6B7280" />
          </View>
          <View style={styles.textWrapper}>
            <Text style={styles.emptyTitle}>No Plans Available</Text>
            <Text style={styles.emptySubtitle}>
              When your advisor creates a plan, it will appear here.
            </Text>
          </View>
        </View>
      ) : (
        <TabView
          navigationState={{index, routes}}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{width}}
          renderTabBar={props => <CustomTabBar {...props} />}
        />
      )}

      {paymentModal && (
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
      )}
      {openSuccessModal && (
        <RecommendationSuccessModal
          openSuccessModal={openSuccessModal}
          setOpenSucessModal={setOpenSucessModal}
          orderPlacementResponse={orderPlacementResponse}
        />
      )}
      {paymentSuccess && (
        <PaymentSuccessModal
          specificPlan={modalContext.specificPlan}
          specificPlanDetails={modalContext.specificPlanDetails}
          setPaymentSuccess={setPaymentSuccess}
          setPaymentModal={setPaymentModal}
          setSelectedCard={setSelectedCard}
          setOpenSubscribeModel={setOpenSubscribeModel}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedPlan?.name}</Text>
              <View
                style={[
                  styles.planTag,
                  {
                    backgroundColor:
                      selectedPlan?.type === 'bespoke' ? '#F59E0B' : '#10B981',
                  },
                ]}>
                <Text style={styles.planTagText}>
                  {selectedPlan?.type === 'bespoke' ? 'Bespoke' : 'MP'}
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}>
              {/* Advisor */}
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Advisor</Text>
                <Text style={styles.infoValue}>{selectedPlan?.advisor}</Text>
              </View>

              {/* Invested / Minimum Investment */}
              {selectedPlan?.subscription?.amount ||
              selectedPlan?.minInvestment ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Invested / Minimum</Text>
                  <Text style={styles.infoValue}>
                    {selectedPlan?.subscription?.amount
                      ? `₹ ${selectedPlan.subscription.amount}`
                      : selectedPlan?.minInvestment
                      ? `₹ ${selectedPlan.minInvestment}`
                      : '-'}
                  </Text>
                </View>
              ) : null}

              {/* Validity / Duration */}
              {selectedPlan?.subscription?.end_date ||
              selectedPlan?.duration ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Validity / Duration</Text>
                  <Text style={styles.infoValue}>
                    {selectedPlan?.subscription?.end_date
                      ? new Date(
                          selectedPlan.subscription.end_date,
                        ).toLocaleDateString()
                      : selectedPlan?.duration
                      ? `${selectedPlan.duration} days`
                      : '-'}
                  </Text>
                </View>
              ) : null}

              {/* Description */}
              {selectedPlan?.description && (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <RenderHTML
                    contentWidth={width - 64} // adjust for modal padding
                    source={{html: selectedPlan.description}}
                    baseStyle={styles.infoValue}
                  />
                </View>
              )}

              {/* Onetime Options */}
              {selectedPlan?.onetimeOptions?.length > 0 && (
                <View style={styles.infoCard}>
                  <Text style={[styles.infoLabel, {marginBottom: 8}]}>
                    Onetime Options
                  </Text>
                  {selectedPlan.onetimeOptions.map((opt, index) => (
                    <View key={index} style={styles.optionRow}>
                      <Text style={styles.optionLabel}>
                        {opt.label || `${opt.duration} Days`}
                      </Text>
                      <Text style={styles.optionValue}>₹ {opt.amount}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Recurring / Frequency Options */}
              {selectedPlan?.frequency?.length > 0 && (
                <View style={styles.infoCard}>
                  <Text style={[styles.infoLabel, {marginBottom: 8}]}>
                    Recurring Options
                  </Text>
                  {selectedPlan.frequency.map((freq, index) => {
                    const price = selectedPlan.pricing?.[freq];
                    return (
                      <View key={index} style={styles.optionRow}>
                        <Text style={styles.optionLabel}>
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </Text>
                        <Text style={styles.optionValue}>
                          {price && Number(price) > 0 ? `₹ ${price}` : 'N/A'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={[styles.modalCloseButton, { backgroundColor: mainColor }]}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    width: '100%',
    marginTop: 20,
    height: '100%',
  },
  backButton: {
    padding: 4,
    borderRadius: 5,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 60,
    backgroundColor: 'rgba(128, 128, 128, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {width: 60, height: 60},
  textContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    width: width > 800 ? 800 : '90%',
  },
  title: {
    fontSize: width > 800 ? 28 : 20,
    textAlign: 'center',
    fontWeight: '600',
    color: '#000',
    marginTop: 10,
  },
  description: {
    fontSize: width > 800 ? 18 : 14,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.6)',
    marginTop: 10,
    lineHeight: width > 800 ? 30 : 20,
    paddingHorizontal: width > 800 ? 60 : 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
    flexWrap: 'wrap',
  },
  planTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planTagText: {color: '#fff', fontSize: 12, fontWeight: '600'},
  modalContent: {marginTop: 8},
  infoCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {fontSize: 14, fontWeight: '600', color: '#111827'},
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E7EB',
  },
  optionLabel: {fontSize: 14, color: '#374151', fontWeight: '500'},
  optionValue: {fontSize: 14, color: '#111827', fontWeight: '600'},
  modalCloseButton: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {color: '#FFF', fontWeight: '700', fontSize: 14},
  //////
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginHorizontal: 20,
    width: ScreenWidth - 40,
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
