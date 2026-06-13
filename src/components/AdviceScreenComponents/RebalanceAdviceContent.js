import React, {useRef, useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  FlatList,
  useWindowDimensions,
  ScrollView,
  RefreshControl,
} from 'react-native';

import {ExpandingDot} from 'react-native-animated-pagination-dots';
import {useNavigation} from '@react-navigation/native';
import {FadeLoading} from 'react-native-fade-loading';

import axios from 'axios';
import server from '../../utils/serverConfig';
import LottieView from 'lottie-react-native';
import RebalanceCard from '../../UIComponents/RebalanceAdvicesUI/RebalanceCard'; // Assuming you have this component
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import StockCardLoading from './StockCardLoading';
import IIFLReviewTradeModal from '../IIFLReviewTradeModal';
import RecommendationSuccessModal from '../ModelPortfolioComponents/RecommendationSuccessModal';
import eventEmitter from '../EventEmitter';
import {useTrade} from '../../screens/TradeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {DhanTpinModal} from '../DdpiModal';
import DdpiModal from '../DdpiModal';
import {ActivateNowModel} from '../DdpiModal';
import {AngleOneTpinModal} from '../DdpiModal';
import {FyersTpinModal} from '../DdpiModal';
import Config from 'react-native-config';
import {OtherBrokerModel} from '../DdpiModal';
import {generateToken} from '../../utils/SecurityTokenManager';
const RebalanceAdviceContent = React.memo(
  ({
    type,
    setOpenTokenExpireModel,
    getAllTrades,
    userEmail,
    stockRecoNotExecuted,
    setBrokerModel,
    brokerModel,
    calculatedPortfolioData,
    setCalculatedPortfolioData,
    openRebalanceModal,
    setOpenRebalanceModal,
    modelPortfolioStrategy,
    setModelPortfolioStrategy,
    modelPortfolioModelId,
    setmatchfailed,
    setModelPortfolioModelId,
    modelPortfolioRepairTrades,
    setModelPortfolioRepairTrades,
    storeModalName,
    setStoreModalName,
    getRebalanceRepair,
    isReturningFromOtherBrokerModal,
    setIsReturningFromOtherBrokerModal,
    OrderPlacementResponse,
    setOrderPlacementResponse,
    showFyersTpinModal,
    setShowFyersTpinModal,
    openSuccessModal,
    setOpenSucessModal,
    showDdpiModal,
    setShowDdpiModal,
    showActivateNowModel,
    setActivateNowModel,
    showAngleOneTpinModel,
    setShowAngleOneTpinModel,
    showDhanTpinModel,
    setShowDhanTpinModel,
    showOtherBrokerModel,
    setShowOtherBrokerModel,
    tradeType,
    setTradeType,
    edisStatus,
    setEdisStatus,
    dhanEdisStatus,
    setDhanEdisStatus,
    selectNonBroker,
    setSelectNonBroker,
    showstatusModal,
    setShowstatusModal,
    stockDataForModal,
    setStockDataForModal,
    setLatestRebalanceData,
    setuserExecution,
    setmatchingFailedTrades,
    setRepairmessageModal,
    selectedOption,
    setSelectedOption
  }) => {
    const {
      modelPortfolioStrategyfinal,
      isDatafetching,
      getModelPortfolioStrategyDetails,
      isDatafetchinMP,
      userDetails,
      broker,
      brokerStatus,
      getUserDeatils,
      funds,
      getAllFunds,
      configData,
    } = useTrade();
    const zerodhaApiKey = Config.REACT_APP_ZERODHA_API_KEY;
    //console.log('isdata:',isDatafetching);
    const scrollX = useRef(new Animated.Value(0)).current;
    const navigation = useNavigation();
    const [h1, seth1] = useState();
    const animationRef = useRef(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTab, setSelectedTab] = useState('Bespoke');
    const [isSwitchOn, setIsSwitchOn] = useState(false);
    // Grouping the data in pairs of two
    const {width: screenWidth} = useWindowDimensions();
    const groupedData = [];
    const [stockDetails, setStockDetails] = useState([]);

    const [openReviewTrade, setOpenReviewTrade] = useState(false);

    const [singleStockTypeAndSymbol, setSingleStockTypeAndSymbol] =
      useState(null);

    const defaultRationale =
      "This recommendation is based on a comprehensive analysis of the company's growth potential and value metrics. This recommendation also accounts for potential future risks, ensuring a balanced approach to maximizing returns while mitigating uncertainties. Please contact your advisor for any queries.";

    const [storedTradeType, setStoredTradeType] = useState({
      allSell: false,
      allBuy: false,
      isMixed: false,
    });

    useEffect(() => {
      const loadTradeType = async () => {
        try {
          const savedTradeType = await AsyncStorage.getItem('storedTradeType');
          if (savedTradeType) {
            setStoredTradeType(JSON.parse(savedTradeType));
          }
        } catch (error) {
          console.error('Failed to load trade type from storage', error);
        }
      };

      loadTradeType();
    }, []);

    const updateTradeType = newTradeType => {
      setTradeType(newTradeType);
      setStoredTradeType(newTradeType);
      AsyncStorage.setItem('storedTradeType', JSON.stringify(newTradeType));
    };
    const openReviewModal = () => {
      setOpenReviewTrade(true);
    };

    const [types, setTypes] = useState([]);
    const [storeDDpiStatus, setStoreDDpiStatus] = useState('');
    useEffect(() => {
      if (types.length > 0) {
        const hasSell = types.some(type => type === 'SELL');
        const hasBuy = types.some(type => type === 'BUY');
        const allSell = hasSell && !hasBuy;
        const allBuy = hasBuy && !hasSell;
        const isMixed = hasSell && hasBuy;

        const newTradeType = {
          allSell: allSell,
          allBuy: allBuy,
          isMixed: isMixed,
        };

        updateTradeType(newTradeType);
      } else {
        updateTradeType(storedTradeType);
      }
    }, [types]);

    const onRefresh = () => {
      setRefreshing(true);
      getModelPortfolioStrategyDetails();
      setRefreshing(false);
    };

    const handleCloseDdpiModal = () => {
      setShowDdpiModal(false);
    };

    const handleProceedWithTpin = () => {
      setShowDdpiModal(false);

      setOpenZerodhaModel(true);
    };

    const handleActivateDDPI = () => {
      setActivateNowModel(false);
    };

    const clientCode = userDetails && userDetails.clientCode;
    const apiKey = userDetails && userDetails.apiKey;
    const jwtToken = userDetails && userDetails.jwtToken;
    const my2pin = userDetails && userDetails.my2Pin;
    const secretKey = userDetails && userDetails.secretKey;
    const viewToken = userDetails && userDetails?.viewToken;
    const sid = userDetails && userDetails?.sid;
    const serverId = userDetails && userDetails?.serverId;
    const mobileNumber = userDetails && userDetails?.phone_number;
    const panNumber = userDetails && userDetails?.panNumber;

    useEffect(() => {
      // Function to handle refresh
      const handleRefresh = data => {
        getModelPortfolioStrategyDetails();
        console.log('RebalanceAdvices Refresh Triggered', data);
        // Perform actions like fetching data or resetting state
      };

      // Subscribe to the refresh event
      eventEmitter.on('refreshEvent', handleRefresh);

      // Cleanup subscription on unmount
      return () => {
        eventEmitter.removeListener('refreshEvent', handleRefresh);
      };
    }, []);

    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
      if (stockRecoNotExecuted && stockRecoNotExecuted.length > 2) {
        seth1(screenWidth * 0.86);
      } else {
        seth1(screenWidth * 0.86);
      }
      // Simulating a delay to show loading
      const timeout = setTimeout(() => {
        setIsLoading(false);
      }, 2000); // Adjust the time as needed

      return () => clearTimeout(timeout);
    }, []);

    const filteredAndSortedStrategies = modelPortfolioStrategy
      ?.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
      ?.map(ele => {
        const allRebalances = ele?.model?.rebalanceHistory || [];
        const sortedRebalances = allRebalances?.sort(
          (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
        );
        const latest = sortedRebalances[0];
        //  console.log('sorted',sortedRebalances[0]);
        if (!latest) return null;

        const userExecutionsFiltered =
          latest?.subscriberExecutions?.filter(
            execution => execution?.user_email === userEmail,
          ) || [];

        let userExecution =
          userExecutionsFiltered.find(
            ex => broker && ex?.user_broker === broker,
          ) ||
          userExecutionsFiltered.find(
            ex => ex?.user_broker === 'DummyBroker',
          );
        if (!userExecution && userExecutionsFiltered.length > 0) {
          const anyMatch = userExecutionsFiltered[0];
          const otherStatus = (anyMatch?.status || '').toLowerCase();
          userExecution = otherStatus === 'executed'
            ? {...anyMatch, status: 'toExecute', user_broker: broker}
            : anyMatch;
        }
        const matchingFailedTrades = modelPortfolioRepairTrades?.find(
          trade =>
            trade.modelId === latest?.model_Id &&
            trade.failedTrades.length !== 0,
        );

        //  console.log('mathcignL',modelPortfolioRepairTrades);
        return {
          ...ele,
          latestRebalance: latest,
          hasFailedTrades: matchingFailedTrades,
          matchingFailedTrades,
        };
      })
      ?.filter(ele => ele !== null);

    const [stockTypeAndSymbol, setStockTypeAndSymbol] = useState([]);

    // Group the filtered and sorted strategies in pairs
    //console.log('final-',filteredAndSortedStrategies);
    const groupedPortfolioData = [];
    for (let i = 0; i < filteredAndSortedStrategies.length; i += 1) {
      groupedPortfolioData.push([
        filteredAndSortedStrategies[i],
        filteredAndSortedStrategies[i + 1],
      ]);
    }

    const [zerodhaDdpiStatus, setZerodhaDdpiStatus] = useState(null);
    const angelOneApiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;

    useEffect(() => {
      if (userDetails && userDetails.user_broker === 'Angel One') {
        const verifyEdis = async () => {
          try {
            const response = await axios.post(
              `${server.ccxtServer.baseUrl}angelone/verify-edis`,
              {
                apiKey: angelOneApiKey,
                jwtToken: userDetails.jwtToken,
                userEmail: userDetails?.email,
              },
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
            setEdisStatus(response.data);
            console.log('AngleOne response', response.data);
          } catch (error) {
            // console.error("Error verifying eDIS status:", error);
          }
        };

        verifyEdis();
      }
    }, [userDetails]);

    // console.log("EdisStatus",edisStatus?.edis)

    //fetching edis status for Dhan

    useEffect(() => {
      if (userDetails && userDetails.user_broker === 'Dhan') {
        const verifyDhanEdis = async () => {
          try {
            const response = await axios.post(
              `${server.ccxtServer.baseUrl}dhan/edis-status`,
              {
                clientId: clientCode,
                accessToken: userDetails.jwtToken,
              },
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
            console.log('Dhan Reponse', response.data);

            setDhanEdisStatus(response.data);
          } catch (error) {
            // console.error("Error verifying eDIS status:", error);
          }
        };

        verifyDhanEdis();
      }
    }, [userDetails]);

    // console.log("edis status",dhanEdisStatus)

    useEffect(() => {
      if (userDetails && userDetails.user_broker === 'Zerodha') {
        const verifyZerodhaDdpi = async () => {
          try {
            const response = await axios.post(
              `${server.ccxtServer.baseUrl}zerodha/save-ddpi-status`,
              {
                apiKey: zerodhaApiKey,
                accessToken: userDetails.jwtToken,
                userEmail: userDetails.email,
              },
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
            setZerodhaDdpiStatus(response.data);
          } catch (error) {
            console.error('Error verifying eDIS status:', error);
          }
        };

        verifyZerodhaDdpi();
      }
    }, [userDetails]);

    useEffect(() => {
      if (userDetails && userDetails.user_broker === 'Zerodha') {
        const verifyZerodhaEdis = async () => {
          try {
            const response = await axios.post(
              `${server.ccxtServer.baseUrl}zerodha/save-edis-status`,
              {
                userEmail: userDetails.email,
                edis: userDetails.edis,
              },
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

            setZerodhaDdpiStatus(response.data);
          } catch (error) {
            console.error('Error verifying eDIS status:', error);
          }
        };

        verifyZerodhaEdis();
      }
    }, [userDetails]);

    const renderPortfolioVerticalList = ({item}) => {
      // console.log('Rebalance--',item.model);
      const allRebalances = item?.model?.rebalanceHistory || [];
      const notes = item.notes;
      const sortedRebalances = allRebalances?.sort(
        (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
      );
      const latest = sortedRebalances[0];
      if (!latest) return null;
      const matchingFailedTrades = modelPortfolioRepairTrades?.find(
        trade =>
          trade.modelId === latest?.model_Id && trade.failedTrades.length !== 0,
      );

        const _execFiltered = (latest?.subscriberExecutions || []).filter(
          e => e?.user_email === userEmail,
        );
        let userExecution =
          _execFiltered.find(ex => broker && ex?.user_broker === broker) ||
          _execFiltered.find(ex => ex?.user_broker === 'DummyBroker');
        if (!userExecution && _execFiltered.length > 0) {
          const anyMatch = _execFiltered[0];
          const otherStatus = (anyMatch?.status || '').toLowerCase();
          userExecution = otherStatus === 'executed'
            ? {...anyMatch, status: 'toExecute', user_broker: broker}
            : anyMatch;
        }

      return (
        <View
          style={[
            styles.cardContainerReb,
            {width: screenWidth * 0.94, marginVertical: type === 'All' ? 5 : 0},
          ]}>
          {item && (
            <RebalanceCard
              key={item._id}
              data={item.model?.rebalanceHistory[0]} // Pass the first non-executed strategy directly
              allRebalances={item?.model?.rebalanceHistory || []}
              sortedRebalances={
                item?.model?.rebalanceHistory.sort(
                  (a, b) =>
                    new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
                ) || []
              }
              frequency={item.frequency}
              modelPortfolioRepairTrades={modelPortfolioRepairTrades}
              setOpenRebalanceModal={setOpenRebalanceModal}
              modelName={item?.model_name}
              overView={item.overView}
              imageUrl={item.image}
              userEmail={userEmail}
              setmatchfailed={setmatchfailed}
              mininvestvalue={item?.latestRebalance?.totalInvestmentvalue}
              apiKey={apiKey}
              jwtToken={jwtToken}
              secretKey={secretKey}
              clientCode={clientCode}
              matchingFailedTrades={matchingFailedTrades}
              broker={broker}
              rebalanceDetails={item}
              advisorName={item.advisor}
              setCalculatedPortfolioData={setCalculatedPortfolioData}
              repair={item.hasFailedTrades ? 'repair' : null}
              setBrokerModel={setBrokerModel}
              funds={funds}
              setOpenTokenExpireModel={setOpenTokenExpireModel}
              setModelPortfolioModelId={setModelPortfolioModelId}
              setStoreModalName={setStoreModalName}
              userExecution={(() => {
                const execFiltered =
                  item?.latestRebalance?.subscriberExecutions?.filter(
                    execution => execution?.user_email === userEmail,
                  ) || [];
                let _ue =
                  execFiltered.find(ex => broker && ex?.user_broker === broker) ||
                  execFiltered.find(ex => ex?.user_broker === 'DummyBroker');
                if (!_ue && execFiltered.length > 0) {
                  const am = execFiltered[0];
                  _ue = (am?.status || '').toLowerCase() === 'executed'
                    ? {...am, status: 'toExecute', user_broker: broker}
                    : am;
                }
                return _ue;
              })()}
              brokerStatus={userDetails?.connect_broker_status}
              showstatusModal={showstatusModal}
              setShowstatusModal={setShowstatusModal}
              stockDataForModal={stockDataForModal}
              setStockDataForModal={setStockDataForModal}
              setLatestRebalanceData={setLatestRebalanceData}
              setRepairmessageModal={setRepairmessageModal}
              setuserExecution={setuserExecution}
              setmatchingFailedTrades={setmatchingFailedTrades}
              userExecutionFinal={userExecution}
              selectedOption={selectedOption}
              setSelectedOption={setSelectedOption}
            />
          )}
        </View>
      );
    };
    return (
      <View style={styles.container}>
        {false ? (
          <FadeLoading
            style={{
              width: screenWidth * 0.4,
              height: 15,
              marginVertical: 10,
              marginLeft: 30,
            }} // Adjust width for price loading
            primaryColor="#f0f0f0"
            secondaryColor="#e0e0e0"
            duration={500}
          />
        ) : (
          <View style={styles.tabContainer}></View>
        )}

        <View style={styles.carouselContainer}>
          <FlatList
            data={filteredAndSortedStrategies}
            renderItem={renderPortfolioVerticalList}
            keyExtractor={(item, index) => index.toString()}
            horizontal={type === 'home'}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal: 0}}
            initialNumToRender={10} // Render only 10 items initially
            maxToRenderPerBatch={10} // Render 10 more in subsequent batches
            windowSize={5} // Number of screens worth of data to render
            removeClippedSubviews={true}
            ListEmptyComponent={
              isDatafetchinMP ? ( // Show loading animation if still loading
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: screenWidth,
                    padding: 20,
                  }}>
                  <StockCardLoading />
                </View>
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: screenWidth,
                    padding: 20,
                  }}>
                  <LottieView
                    ref={animationRef}
                    source={require('../../assets/EmptyAnimation.json')}
                    autoPlay
                    loop
                    style={styles.lottie}
                  />
                  <Text
                    style={{
                      fontFamily: 'Satoshi-Medium',
                      color: 'grey',
                      alignSelf: 'center',
                    }}>
                    No Rebalance Found!
                  </Text>
                </View>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                style={{alignSelf: 'center'}}
              />
            }
          />
        </View>


        {openSuccessModal && (
          <RecommendationSuccessModal
            openSuccessModal={openSuccessModal}
            setOpenSucessModal={setOpenSucessModal}
            orderPlacementResponse={OrderPlacementResponse}
            currentBroker={broker}
            // 2026-05-07: MP context for the per-row "Mark as Placed"
            // inline editor on FAILURE rows.
            userEmail={userEmail}
            modelId={modelPortfolioModelId}
            modelName={storeModalName}
            uniqueId={calculatedPortfolioData?.uniqueId}
          />
        )}

        {showDdpiModal && (
          <DdpiModal
            isOpen={showDdpiModal}
            setIsOpen={handleCloseDdpiModal}
            proceedWithTpin={handleProceedWithTpin}
            userDetails={userDetails && userDetails}
            setOpenReviewTrade={setOpenReviewTrade}
            reopenRebalanceModal={() => setOpenRebalanceModal(true)}
            getUserDetails={getUserDeatils}
          />
        )}

        {false && (
          <ActivateNowModel
            isOpen={false}
            setIsOpen={setActivateNowModel}
            onActivate={handleActivateDDPI}
            userDetails={userDetails}
          />
        )}

        {showAngleOneTpinModel && (
          <AngleOneTpinModal
            isOpen={showAngleOneTpinModel}
            setIsOpen={setShowAngleOneTpinModel}
            userDetails={userDetails}
            edisStatus={edisStatus}
            tradingSymbol={stockDetails.map(stock => stock.tradingSymbol)}
            reopenRebalanceModal={() => setOpenRebalanceModal(true)}
            getUserDetails={getUserDeatils}
          />
        )}

        {showFyersTpinModal && (
          <FyersTpinModal
            isOpen={showFyersTpinModal}
            setIsOpen={setShowFyersTpinModal}
            userDetails={userDetails}
            reopenRebalanceModal={() => setOpenRebalanceModal(true)}
            getUserDetails={getUserDeatils}
          />
        )}

        {showDhanTpinModel && (
          <DhanTpinModal
            isOpen={showDhanTpinModel}
            setIsOpen={setShowDhanTpinModel}
            userDetails={userDetails}
            dhanEdisStatus={dhanEdisStatus}
            stockTypeAndSymbol={stockTypeAndSymbol}
            singleStockTypeAndSymbol={singleStockTypeAndSymbol}
            reopenRebalanceModal={() => setOpenRebalanceModal(true)}
            getUserDetails={getUserDeatils}
          />
        )}

        {showOtherBrokerModel && (
          <OtherBrokerModel
            userDetails={userDetails}
            onContinue={() => {
              setIsReturningFromOtherBrokerModal(true);
              setShowOtherBrokerModel(false);
            }}
            setShowOtherBrokerModel={setShowOtherBrokerModel}
            showActivateNowModel={showActivateNowModel}
            openReviewModal={openReviewModal}
            setActivateNowModel={setActivateNowModel}
            setOpenReviewTrade={setOpenReviewTrade}
            setOpenRebalanceModal={setOpenRebalanceModal}
            userEmail={userEmail}
            apiKey={apiKey}
            jwtToken={jwtToken}
            secretKey={secretKey}
            clientCode={clientCode}
            broker={broker}
            sid={sid}
            viewToken={viewToken}
            serverId={serverId}
            visible={showOtherBrokerModel}
            setCaluculatedPortfolioData={setCalculatedPortfolioData}
            setModelPortfolioModelId={setModelPortfolioModelId}
            modelPortfolioModelId={modelPortfolioModelId}
            setStoreModalName={setStoreModalName}
            storeModalName={storeModalName}
            funds={funds}
            reopenRebalanceModal={() => setOpenRebalanceModal(true)}
            getUserDetails={getUserDeatils}
          />
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardContainer: {
    flexDirection: 'column',
    marginBottom: 30,
  },
  cardContainerReb: {
    flexDirection: 'column',
    alignContent: 'center',
    paddingVertical: 10,
    alignSelf: 'center',
  },
  StockTitle: {
    fontSize: 20,
    marginHorizontal: 5,
    fontFamily: 'HelveticaNeueBold',
    color: 'black',
  },
  filterButton: {
    backgroundColor: 'white',
    borderColor: '#E6E6E6',
    borderRadius: 20,
    marginLeft: 10,
    padding: 5,
    borderWidth: 1,
    paddingHorizontal: 20,
  },
  filterButtonText: {
    fontSize: 13,
    fontFamily: 'Satoshi-Regular',
    color: 'black',
  },
  lottie: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    alignContent: 'center',
    alignItems: 'center',
  },
  filterButtonfade: {
    backgroundColor: '#EEEEEE',
    borderColor: '#E6E6E6',
    borderRadius: 20,
    marginLeft: 10,
    padding: 5,
    borderWidth: 1,
    paddingHorizontal: 25,
  },

  filterButtonTextfade: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: 'grey',
  },

  seeAllText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#4B8CEE',
    marginRight: 10,
  },
  carouselContainer: {},
  paginationContainer: {
    alignSelf: 'center',
    marginHorizontal: 100,
  },
  tabContainer: {
    flexDirection: 'row',
  },
  activeTabButton: {
    backgroundColor: '#fff',
  },
  inactiveTabButton: {
    backgroundColor: '#F4F4F4',
  },
  activeTabButtonText: {
    color: 'black',
  },
  inactiveTabButtonText: {
    color: '#ABABAB',
  },
});

export default RebalanceAdviceContent;
