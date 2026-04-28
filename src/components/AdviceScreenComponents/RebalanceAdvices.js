import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, ActivityIndicator, Alert} from 'react-native';
import axios from 'axios';
import server from '../../utils/serverConfig';

import RebalanceAdviceContent from '../AdviceScreenComponents/RebalanceAdviceContent';

import {getAuth} from '@react-native-firebase/auth';
import {useNavigation} from '@react-navigation/native';

import IIFLReviewTradeModal from '../IIFLReviewTradeModal';

import moment from 'moment';
import Config from 'react-native-config';
import {generateToken} from '../../utils/SecurityTokenManager';

import eventEmitter from '../EventEmitter';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';
import {
  buildBrokerPayloadFields,
  defaultDecrypt,
  isFundsErrorOrMissing,
  isRebalanceErrorResponse,
  isBrokerAuthError,
  isSubscriptionAmountError,
  isLowAllowedBalanceError,
  checkPortfolioShortfall,
} from '../../utils/rebalanceHelpers';
import {useRefreshBrokerStatus} from '../../hooks/useRefreshBrokerStatus';
import {classifyFundsResponse} from '../../utils/brokerSessionValidator';
import Toast from 'react-native-toast-message';
import BrokerSelectionModal from '../BrokerSelectionModal';

import ICICIUPModal from '../BrokerConnectionModal/icicimodal';
import UpstoxModal from '../BrokerConnectionModal/upstoxModal';
import AngleOneBookingModal from '../BrokerConnectionModal/AngleoneBookingModal';
import ZerodhaConnectModal from '../BrokerConnectionModal/ZerodhaConnectModal';
import HDFCconnectModal from '../BrokerConnectionModal/HDFCconnectModal';
import DhanConnectModal from '../BrokerConnectionModal/DhanConnectModal';
import KotakModal from '../BrokerConnectionModal/KotakModal';
import IIFLModal from '../iiflmodal';
import AliceBlueConnect from '../BrokerConnectionModal/AliceBlueConnect';
import FyersConnect from '../BrokerConnectionModal/FyersConnect';
import {useTrade} from '../../screens/TradeContext';
import RebalanceModal from './RebalanceModal';
import RecommendationSuccessModal from '../ModelPortfolioComponents/RecommendationSuccessModal';
import MPStatusModal from './MPStatusModal';
import {getAdvisorSubdomain} from '../../utils/variantHelper';
import CommonInformationModal from './RepairConfimationModal';

const RebalanceAdvices = React.memo(({userEmail, orderscreen, type}) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [isDatafetching, setisDatafetching] = useState(true);
  const [showIIFLModal, setShowIIFLModal] = useState(false);
  const [showICICIUPModal, setShowICICIUPModal] = useState(false);
  const [showupstoxModal, setShowupstoxModal] = useState(false);
  const [showangleoneModal, setShowangleoneModal] = useState(false);
  const [showzerodhamodal, setShowzerodhaModal] = useState(false);
  const [showhdfcModal, setShowhdfcModal] = useState(false);
  const [showDhanModal, setShowDhanModal] = useState(false);
  const [showKotakModal, setShowKotakModal] = useState(false);

  const [showFyersModal, setShowFyersModal] = useState(false);
  const [showAliceblueModal, setShowAliceblueModal] = useState(false);
  const {
    modelPortfolioStrategyfinal,
    getModelPortfolioStrategyDetails,
    isDatafetchinMP,
    funds,
    getAllFunds,
    broker,
    brokerStatus,
    userDetails,
    getUserDeatils,
    configData,
  } = useTrade();

  const clientCode = userDetails && userDetails.clientCode;
  const apiKey = userDetails && userDetails.apiKey;
  const jwtToken = userDetails && userDetails.jwtToken;
  const secretKey = userDetails && userDetails.secretKey;
  const viewToken = userDetails && userDetails?.viewToken;
  const sid = userDetails && userDetails?.sid;
  const serverId = userDetails && userDetails?.serverId;

  // Shared helper: inline-fresh {brokerStatus, broker, funds}. Closure-bound
  // context values lag one render cycle after a reconnect; this avoids the
  // "Login to {broker}" modal re-popping right after a successful OAuth.
  // See `docs/REBALANCING.md § Closure-bound funds`.
  const refreshBrokerStatus = useRefreshBrokerStatus(userEmail);

  const [showDdpiModal, setShowDdpiModal] = useState(false);
  const [showActivateNowModel, setActivateNowModel] = useState(false);
  const [showAngleOneTpinModel, setShowAngleOneTpinModel] = useState(false);

  const [edisStatus, setEdisStatus] = useState(null);
  const [dhanEdisStatus, setDhanEdisStatus] = useState(null);

  const [showDhanTpinModel, setShowDhanTpinModel] = useState(false);
  const [showOtherBrokerModel, setShowOtherBrokerModel] = useState(false);

  const [showFyersTpinModal, setShowFyersTpinModal] = useState(false);
  const [OpenTokenExpireModel, setOpenTokenExpireModel] = useState(false);
  const [modelPortfolioStrategy, setModelPortfolioStrategy] = useState([]);
  const [openSuccessModal, setOpenSucessModal] = useState(null);
  const [repairMessageModal, setRepairmessageModal] = useState(false);
  const [selectNonBroker, setSelectNonBroker] = useState(false);
  useEffect(() => {
    if (modelPortfolioStrategyfinal) {
      setModelPortfolioStrategy(modelPortfolioStrategyfinal);
    }
  }, [modelPortfolioStrategyfinal]);

  useEffect(() => {
    // Function to handle refresh
    const handleRefresh = data => {
      getModelPortfolioStrategyDetails();
    };

    // Subscribe to the refresh event (legacy)
    eventEmitter.on('refreshEvent', handleRefresh);

    // Subscribe to structured portfolio events (matching prod)
    const unsubHoldings = portfolioEvents.on(
      PORTFOLIO_EVENTS.HOLDINGS_REFRESH,
      () => getModelPortfolioStrategyDetails(),
    );
    const unsubRebalance = portfolioEvents.on(
      PORTFOLIO_EVENTS.REBALANCE_EXECUTED,
      () => getModelPortfolioStrategyDetails(),
    );

    // Cleanup subscriptions on unmount
    return () => {
      eventEmitter.removeListener('refreshEvent', handleRefresh);
      unsubHoldings();
      unsubRebalance();
    };
  }, []);

  const [isReturningFromOtherBrokerModal, setIsReturningFromOtherBrokerModal] =
    useState(false);
  const [calculatedPortfolioData, setCalculatedPortfolioData] = useState([]);
  const [openRebalanceModal, setOpenRebalanceModal] = useState(false);
  const [modelPortfolioModelId, setModelPortfolioModelId] = useState();
  const [storeModalName, setStoreModalName] = useState();
  const modelNames = modelPortfolioStrategy?.map(item => item?.model_name);

  const [OrderPlacementResponse, setOrderPlacementResponse] = useState(null);

  const [tradeType, setTradeType] = useState({
    allSell: false,
    allBuy: false,
    isMixed: false,
  });

  const [modelPortfolioRepairTrades, setModelPortfolioRepairTrades] = useState(
    [],
  );
  const getRebalanceRepair = () => {
    let repairData = JSON.stringify({
      modelName: modelNames,
      advisor: modelPortfolioStrategy[0]['advisor'],
      userEmail: userEmail,
      userBroker: broker,
    });
    let config2 = {
      method: 'post',
      url: `${server.ccxtServer.baseUrl}rebalance/get-repair`,

      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },

      data: repairData,
    };
    axios
      .request(config2)
      .then(response => {
        setModelPortfolioRepairTrades(response.data.models);
      })
      .catch(error => {
        console.log(error);
      });
  };
  // console.log("Broker value being sent:", broker);
  useEffect(() => {
    if (modelPortfolioStrategy.length !== 0) {
      getRebalanceRepair();
    }
  }, [modelPortfolioStrategy]);

  const zerodhaApiKey = configData?.config?.REACT_APP_ZERODHA_API_KEY;
  // zerodha start
  const fetchBrokerStatusModal = async () => {
    if (userEmail) {
      try {
        const response = await axios.get(
          `${server.server.baseUrl}api/user/getUser/${userEmail}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Advisor-Subdomain': getAdvisorSubdomain(),
              'aq-encrypted-key': generateToken(
                Config.REACT_APP_AQ_KEYS,
                Config.REACT_APP_AQ_SECRET,
              ),
            },
          },
        );
        const userData = response.data.User;
        getUserDeatils();
        eventEmitter.emit('triggerGetAllFunds');
      } catch (error) {
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    getModelPortfolioStrategyDetails();
  }, []);
  const [modalVisible, setModalVisible1] = useState(false);
  const [isRebalModalVisible, setRebalModalVisible] = useState(false);
  const [brokerModel, setBrokerModel] = useState(null);

  const openRebalModal = () => {
    setRebalModalVisible(true);
  };

  // Add this function inside your component
  // Modified getUserExecution function
  const getUserExecution = (portfolioArray, userEmail, modalName) => {
    // Find the specific portfolio item that matches the modal name
    const matchingPortfolioItem = portfolioArray?.find(
      item => item?.model_name === modalName,
    );

    if (!matchingPortfolioItem) {
      return null;
    }

    const allRebalances = matchingPortfolioItem?.model?.rebalanceHistory || [];

    const sortedRebalances = [...allRebalances].sort(
      (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
    );
    const latest = sortedRebalances[0];

    if (!latest) return null;

    // Find execution for this user AND current broker
    const userExecution = latest?.subscriberExecutions?.find(
      execution =>
        execution?.user_email === userEmail &&
        (!broker || execution?.user_broker === broker),
    );

    return {userExecution, latest, matchingPortfolioItem};
  };
  const [matchfailed, setmatchfailed] = useState(null);
  const [showstatusModal, setShowstatusModal] = useState(false);
  const [stockDataForModal, setStockDataForModal] = useState([]);

  // Track if broker modal was opened during rebalance flow — when broker connects
  // after auth modal, auto-continue to Step 2 (matching web ConnectBroker behavior).
  // Why timestamp (not boolean): storeModalName is not cleared when the user cancels
  // the rebalance flow. A sticky boolean intent + a later brokerStatus='connected'
  // transition from an unrelated entry point (e.g., Zerodha connected from Settings
  // → broker screen) would wrongly fire the auto-continue and open a rebalance the
  // user never asked for. The TTL bounds the intent to the actual auth window.
  const REBALANCE_BROKER_INTENT_TTL_MS = 2 * 60 * 1000;
  const rebalanceBrokerModalOpenedAt = useRef(0);
  useEffect(() => {
    if (brokerModel && storeModalName) {
      rebalanceBrokerModalOpenedAt.current = Date.now();
    }
  }, [brokerModel, storeModalName]);

  useEffect(() => {
    const openedAt = rebalanceBrokerModalOpenedAt.current;
    const intentFresh =
      openedAt > 0 && Date.now() - openedAt < REBALANCE_BROKER_INTENT_TTL_MS;
    if (
      intentFresh &&
      !brokerModel &&
      brokerStatus === 'connected' &&
      !showstatusModal &&
      !openRebalanceModal &&
      storeModalName
    ) {
      // Broker was just connected after being opened from rebalance flow
      rebalanceBrokerModalOpenedAt.current = 0;
      // Auto-continue: refresh user, fetch holdings, show Step 2
      (async () => {
        try {
          await getUserDeatils();
          await getAllFunds();
          await fetchHoldingsAndShowStatus();
        } catch (err) {
          console.error('Auto-continue after broker connect error:', err);
        }
      })();
    }
  }, [brokerModel, brokerStatus, showstatusModal, openRebalanceModal]);

  // "Continue without connecting broker" — matching web RebalanceCard.js handleAcceptRebalanceWithoutBroker:
  // Save preference, fetch holdings, show MPStatusModal (Step 2). Do NOT call rebalance/calculate yet.
  // MPStatusModal's "Continue" will call handleAcceptRebalance → rebalance/calculate → Step 3.
  const handleAcceptRebalanceWithoutBroker = async () => {
    console.log('Continue without broker - saving preference, then showing holdings (Step 2)');
    setStoreModalName(storeModalName);

    try {
      // Step 1: Save no-broker preference (matching web connectBroker.js)
      await axios.put(
        `${server.ccxtServer.baseUrl}comms/no-broker-required/save`,
        {
          userEmail: userEmail,
          noBrokerRequired: true,
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

      // Step 2: Close broker modal, set non-broker flag
      setBrokerModel(false);
      setSelectNonBroker(true);

      // Step 3: Refresh user details so broker becomes DummyBroker
      await getUserDeatils();

      // Step 4: Fetch current holdings and show MPStatusModal (matching web)
      await fetchHoldingsAndShowStatus();
    } catch (error) {
      console.error('Continue without broker error:', error.message);
      if (error.response) {
        console.error('Response:', error.response.status, error.response.data);
      }
      setBrokerModel(false);
    }
  };

  // "Broker Connected - Continue" — called when user connects a broker via the modal
  // Refresh user details, fetch holdings, show MPStatusModal (Step 2).
  const handleBrokerConnectedContinue = async () => {
    console.log('Broker connected - refreshing user, then showing holdings (Step 2)');
    setStoreModalName(storeModalName);

    try {
      setBrokerModel(false);

      // Refresh user details to pick up the newly connected broker
      await getUserDeatils();
      await getAllFunds();

      // Fetch holdings and show MPStatusModal
      await fetchHoldingsAndShowStatus();
    } catch (error) {
      console.error('Broker connected continue error:', error.message);
      setBrokerModel(false);
    }
  };

  // Shared helper: fetch holdings from rebalance/user-portfolio/latest → show MPStatusModal (Step 2)
  // Matches web RebalanceCard.js handleAcceptRebalanceWithoutBroker lines 835-873
  const fetchHoldingsAndShowStatus = async () => {
    try {
      const effectiveModelName = storeModalName;
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(effectiveModelName)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          timeout: 15000,
        },
      );

      const userNetPfModel = response.data?.data?.user_net_pf_model;
      let orderResults = [];
      if (Array.isArray(userNetPfModel) && userNetPfModel.length > 0) {
        const latestPortfolio = [...userNetPfModel].sort(
          (a, b) => new Date(b.execDate) - new Date(a.execDate),
        )[0];
        orderResults = latestPortfolio?.order_results || [];
      } else if (userNetPfModel?.order_results) {
        orderResults = userNetPfModel.order_results;
      }

      setApiResponseData(response.data);
      const nonZeroHoldings = orderResults.filter(
        h => Number(h.quantity || 0) > 0,
      );
      setStockDataForModal(nonZeroHoldings);
    } catch (error) {
      console.warn('Error fetching holdings for MPStatusModal:', error?.message);
    }

    // Show MPStatusModal (Step 2)
    setCurrentStep(2);
    setShowstatusModal(true);
  };

  const handleCheckStatus = async () => {
    try {
      const response = await axios.get(
        `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${userEmail}/${modelName}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          timeout: 15000,
        },
      );
      // Handle user_net_pf_model as array (matching prod) — sort by date, take latest
      const userNetPfModel = response.data?.data?.user_net_pf_model;
      let orderResults = [];
      if (Array.isArray(userNetPfModel) && userNetPfModel.length > 0) {
        const latestPortfolio = [...userNetPfModel].sort(
          (a, b) => new Date(b.execDate) - new Date(a.execDate),
        )[0];
        orderResults = latestPortfolio?.order_results || [];
      } else if (userNetPfModel?.order_results) {
        orderResults = userNetPfModel.order_results;
      }
      setApiResponseData(response.data);
      setStockDataForModal(orderResults);
    } catch (error) {
      console.warn('Error fetching stock data:', error?.message);
    }
    setShowstatusModal(true);
  };

  const handleSendUpdatedResponse = () => {
    if (latestUpdatedResponse) {
      sendUpdatedOrderResultsToAPI(latestUpdatedResponse);
    } else {
      console.warn('No updated response data available to send.');
    }
  };

  const sendUpdatedOrderResultsToAPI = async data => {
    try {
      const response = await axios.put(
        `${server.ccxtServer.baseUrl}rebalance/update/user-portfolio/latest`,
        data,
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
      handleAcceptRebalance();
    } catch (error) {
      console.error(
        'API update failed:',
        error.response?.data || error.message,
      );
    }
  };

  const [apiResponseData, setApiResponseData] = useState(null);
  const [latestUpdatedResponse, setLatestUpdatedResponse] = useState(null);

  const handleStockListUpdate = updatedOrderResultsList => {
    setApiResponseData(currentApiResponse => {
      if (!currentApiResponse?.data?.user_net_pf_model) {
        return currentApiResponse;
      }
      const updatedResponse = JSON.parse(JSON.stringify(currentApiResponse));
      updatedResponse.data.user_net_pf_model.order_results =
        updatedOrderResultsList;
      updatedResponse.data.user_email = userEmail;
      setLatestUpdatedResponse(updatedResponse);
      return updatedResponse;
    });
  };

    const [userExecution, setuserExecution] = useState();
    const [matchingFailedTrades, setmatchingFailedTrades] = useState();
  const [RebalanceExecutionStatus,setRebalanceExecutionStatus]=useState();
  const [latestRebalanceData, setLatestRebalanceData] = useState();
  const [StockTypeAndSymbol,setStockTypeAndSymbol]=useState();
  const [modelObjectId,setModelObjectId]=useState();
const angelOneApiKey = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;

  const handleAcceptRebalance = async () => {
    setStoreModalName(storeModalName);
    setRebalanceExecutionStatus(userExecution?.status);
    setLoading(true);

    // If we're coming from step 2 (MPStatusModal), skip broker validations and proceed to step 3
    // The user has already gone through broker checks in step 1
    if (currentStep === 2) {
      // Proceed directly to calculation for step 3
      const effectiveBroker = broker ? broker : "DummyBroker";
      const credentials = {jwtToken, apiKey, secretKey, clientCode, viewToken, sid, serverId};
      const brokerFields = effectiveBroker !== "DummyBroker"
        ? buildBrokerPayloadFields(effectiveBroker, credentials, defaultDecrypt, angelOneApiKey)
        : {};

      let payload = {
        userEmail: userEmail,
        userBroker: effectiveBroker,
        modelName: storeModalName?.trim(),
        advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
        model_id: modelPortfolioModelId,
        userFund: funds?.data?.availablecash ? funds?.data?.availablecash : "0",
        flag: effectiveBroker === "DummyBroker" ? 0 : (selectedOption === "option1" ? 1 : 0),
        ...brokerFields,
      };

      let config = {
        method: "post",
        url: `${server.ccxtServer.baseUrl}rebalance/calculate`,
        data: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
          "aq-encrypted-key": generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET
          ),
        },
      };

      try {
        const response = await axios.request(config);

        // Primary auth signal: ccxt-india /rebalance/calculate now
        // returns sessionExpired:true when the underlying broker
        // holdings fetch failed with an auth-shape error
        // (production 2026-04-26 — same flag shape /process-trade
        // already used). Surfaces re-auth at calculate-step.
        if (response?.data?.sessionExpired === true) {
          setOpenTokenExpireModel(true);
          setLoading(false);
          return;
        }

        // Error handling matching prod (RebalanceCard.js)
        if (isRebalanceErrorResponse(response.data)) {
          const errorMsg = response.data?.message || 'Rebalance calculation failed';
          if (isBrokerAuthError(errorMsg)) {
            setOpenTokenExpireModel(true);
            setLoading(false);
            return;
          }
          if (isSubscriptionAmountError(errorMsg)) {
            Alert.alert(
              'Update Investment',
              'Your subscription amount is not set or may have been cleared. Would you like to update it now?',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Update',
                  onPress: () => {
                    navigation.navigate('AfterSubscriptionScreen', {
                      fileName: storeModalName,
                      openModifyInvestment: true,
                    });
                  },
                },
              ],
            );
            setLoading(false);
            return;
          }
          if (isLowAllowedBalanceError(errorMsg)) {
            Alert.alert('Insufficient Funds', errorMsg, [{text: 'OK'}]);
            setLoading(false);
            return;
          }
        }

        const { buy, sell } = response.data;

        // Portfolio shortfall is INFORMATIONAL ONLY — never a blocker.
        // Backend `check_total_value` (rebalancing.py:1826) is a post-hoc
        // advisory; trades come from `calculate_subsequent_buy_sell`
        // independently. 0 trades alongside this means the share counts
        // already match the model — the market value just dropped.
        const shortfall = checkPortfolioShortfall(response.data);
        if (shortfall.isShortfall) {
          Alert.alert(
            'Market Value Below Locked Investment',
            `Your portfolio is worth ₹${shortfall.currentValue?.toLocaleString?.() || shortfall.currentValue}, below the ₹${shortfall.requiredAmount?.toLocaleString?.() || shortfall.requiredAmount} you locked in for this model. This is informational only — your share counts still match the model and rebalance can proceed.`,
            [{text: 'OK'}]
          );
          // Fall through — do not block.
        }

        const updatedStockTypeAndSymbol = [
          ...(buy || []).map((item) => ({
            Symbol: item.symbol,
            Type: "BUY",
            Exchange: item.exchange,
            Quantity: item.quantity,
          })),
          ...(sell || []).map((item) => ({
            Symbol: item.symbol,
            Type: "SELL",
            Exchange: item.exchange,
            Quantity: item.quantity,
          })),
        ];

        setStockTypeAndSymbol(updatedStockTypeAndSymbol);
        setLoading(false);
        // Tag with model name to prevent cross-portfolio contamination (matching prod)
        const normalizedData = {...response.data, _rebalanceModelName: storeModalName, _rebalanceModelId: modelPortfolioModelId};
        setCalculatedPortfolioData(normalizedData);
        setOpenRebalanceModal(true);
        setStoreModalName(storeModalName);
        setModelObjectId(modelPortfolioModelId);
        return;
      } catch (error) {
        console.log("Error in step 2 to step 3 transition:", error);
        setLoading(false);
        throw error;
      }
    }

    // If user already chose to continue without broker, skip broker validation
    // This prevents infinite loop when MPStatusModal calls handleAcceptRebalance on close
    if (selectNonBroker) {
      // User already chose "Continue without broker" - proceed with DummyBroker flow
      // Use selectedOption to match prod behavior
      let payload = {
        userEmail: userEmail,
        userBroker: "DummyBroker",
        modelName: storeModalName,
        advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
        model_id: modelPortfolioModelId,
        userFund: "0",
        flag: selectedOption === "option1" ? 1 : 0,
      };

      let config = {
        method: "post",
        url: `${server.ccxtServer.baseUrl}rebalance/calculate`,
        data: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
          "aq-encrypted-key": generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET,
          ),
        },
      };

      try {
        const response = await axios.request(config);
        console.log("Rebalance Calculate API Response (DummyBroker):", JSON.stringify(response.data));

        setCalculatedPortfolioData(response.data);
        setOpenRebalanceModal(true);
        setStoreModalName(storeModalName);
        setModelObjectId(modelPortfolioModelId);
        setLoading(false);
      } catch (error) {
        console.log(error);
        setLoading(false);
        throw error; // Re-throw to let caller know it failed
      }
      return;
    }

    // Check funds using fresh state (closure-bound `funds`/`brokerStatus`
    // lag after a reconnect and would re-pop TokenExpire immediately after
    // a successful Upstox/Zerodha login).
    const freshStatus = await refreshBrokerStatus({forceNetwork: true});
    const currentFunds = freshStatus?.funds ?? funds;
    const currentBrokerStatus = freshStatus?.brokerStatus || brokerStatus;
    const _fundsPreflight = classifyFundsResponse(currentFunds, currentBrokerStatus, freshStatus?.broker || broker);
    if (_fundsPreflight.reason === 'TRANSIENT') {
      Toast.show({
        type: 'info',
        text1: `${freshStatus?.broker || broker || 'Broker'} temporarily unavailable`,
        text2: _fundsPreflight.message,
        visibilityTime: 4500,
        position: 'bottom',
      });
      setLoading(false);
      return;
    }
    if (!_fundsPreflight.ok) {
      setOpenTokenExpireModel(true);
      setLoading(false);
    } else if ((matchingFailedTrades ? "repair" : null) && userExecution?.status !== "toExecute") {
      if (matchingFailedTrades !== undefined) {
        const { failedTrades } = matchingFailedTrades;
        const updatedStockTypeAndSymbol = failedTrades?.map((trade) => ({
          Symbol: trade.advSymbol,
          Type: trade.transactionType, // Already either 'BUY' or 'SELL'
          Exchange: trade.advExchange,
          Quantity: trade.advQTY,
        }));

        // Update the state
        setStockTypeAndSymbol(updatedStockTypeAndSymbol);
      }

      setOpenRebalanceModal(true);
      setStoreModalName(storeModalName);
      setModelObjectId(modelPortfolioModelId);
      setLoading(false);
    } else {

      const effectiveBroker = broker ? broker : "DummyBroker";
      const credentials = {jwtToken, apiKey, secretKey, clientCode, viewToken, sid, serverId};
      const brokerFields = effectiveBroker !== "DummyBroker"
        ? buildBrokerPayloadFields(effectiveBroker, credentials, defaultDecrypt, angelOneApiKey)
        : {};

      let payload = {
        userEmail: userEmail,
        userBroker: effectiveBroker,
        modelName: storeModalName?.trim(),
        advisor: configData?.config?.REACT_APP_ADVISOR_SPECIFIC_TAG,
        model_id: modelPortfolioModelId,
        userFund: funds?.data?.availablecash ? funds?.data?.availablecash : "0",
        flag: effectiveBroker === "DummyBroker" ? 0 : (selectedOption === "option1" ? 1 : 0),
        ...brokerFields,
      };
      let config = {
        method: "post",
        url: `${server.ccxtServer.baseUrl}rebalance/calculate`,
        data: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "X-Advisor-Subdomain": configData?.config?.REACT_APP_HEADER_NAME,
          "aq-encrypted-key": generateToken(
            Config.REACT_APP_AQ_KEYS,
            Config.REACT_APP_AQ_SECRET
          ),
        },
      };

      try {
        const response = await axios.request(config);

        // Primary auth signal: ccxt-india /rebalance/calculate now
        // returns sessionExpired:true when the underlying broker
        // holdings fetch failed with an auth-shape error
        // (production 2026-04-26 — same flag shape /process-trade
        // already used). Surfaces re-auth at calculate-step.
        if (response?.data?.sessionExpired === true) {
          setOpenTokenExpireModel(true);
          setLoading(false);
          return;
        }

        // Error handling matching prod (RebalanceCard.js)
        if (isRebalanceErrorResponse(response.data)) {
          const errorMsg = response.data?.message || 'Rebalance calculation failed';
          if (isBrokerAuthError(errorMsg)) {
            setOpenTokenExpireModel(true);
            setLoading(false);
            return;
          }
          if (isSubscriptionAmountError(errorMsg)) {
            Alert.alert(
              'Update Investment',
              'Your subscription amount is not set or may have been cleared. Would you like to update it now?',
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Update',
                  onPress: () => {
                    navigation.navigate('AfterSubscriptionScreen', {
                      fileName: storeModalName,
                      openModifyInvestment: true,
                    });
                  },
                },
              ],
            );
            setLoading(false);
            return;
          }
          if (isLowAllowedBalanceError(errorMsg)) {
            Alert.alert('Insufficient Funds', errorMsg, [{text: 'OK'}]);
            setLoading(false);
            return;
          }
        }

        const { buy, sell } = response.data;

        // Portfolio shortfall is INFORMATIONAL ONLY — never a blocker.
        // See sibling handler above for full rationale.
        const shortfall = checkPortfolioShortfall(response.data);
        if (shortfall.isShortfall) {
          Alert.alert(
            'Market Value Below Locked Investment',
            `Your portfolio is worth ₹${shortfall.currentValue?.toLocaleString?.() || shortfall.currentValue}, below the ₹${shortfall.requiredAmount?.toLocaleString?.() || shortfall.requiredAmount} you locked in for this model. This is informational only — your share counts still match the model and rebalance can proceed.`,
            [{text: 'OK'}]
          );
          // Fall through — do not block.
        }

        // Empty trades: still open modal so it can show "Portfolio Already Aligned" UI
        if ((!buy || buy.length === 0) && (!sell || sell.length === 0)) {
          setCalculatedPortfolioData(response.data);
          setLoading(false);
          setOpenRebalanceModal(true);
          setStoreModalName(storeModalName);
          setModelObjectId(modelPortfolioModelId);
          return;
        }

        const updatedStockTypeAndSymbol = [
          ...(buy || []).map((item) => ({
            Symbol: item.symbol,
            Type: "BUY",
            Exchange: item.exchange,
            Quantity: item.quantity,
          })),
          ...(sell || []).map((item) => ({
            Symbol: item.symbol,
            Type: "SELL",
            Exchange: item.exchange,
            Quantity: item.quantity,
          })),
        ];

        setStockTypeAndSymbol(updatedStockTypeAndSymbol);
        setLoading(false);
        // Tag with model name to prevent cross-portfolio contamination (matching prod)
        const normalizedData = {...response.data, _rebalanceModelName: storeModalName, _rebalanceModelId: modelPortfolioModelId};
        setCalculatedPortfolioData(normalizedData);
        setOpenRebalanceModal(true);
        setStoreModalName(storeModalName);
        setModelObjectId(modelPortfolioModelId);
      } catch (error) {
        console.log(error);
        setLoading(false);
        throw error;
      }
    }
  };

  const stepsData = [
    {label: 'Rebalance Preference'},
    {label: 'Current holdings'},
    {label: 'Final Rebalance'},
  ];
  const [selectedOption, setSelectedOption] = useState('option1');
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <View style={styles.container}>
      <RebalanceAdviceContent
        type={type}
        isDatafetching={isDatafetching}
        onOpenRebalModal={openRebalModal}
        orderscreen={orderscreen}
        loading={loading}
        userEmail={userEmail}
        setmatchfailed={setmatchfailed}
        setBrokerModel={setBrokerModel}
        brokerModel={brokerModel}
        setOpenTokenExpireModel={setOpenTokenExpireModel}
        calculatedPortfolioData={calculatedPortfolioData}
        setCalculatedPortfolioData={setCalculatedPortfolioData}
        openRebalanceModal={openRebalanceModal}
        setOpenRebalanceModal={setOpenRebalanceModal}
        modelPortfolioStrategy={modelPortfolioStrategy}
        setModelPortfolioStrategy={setModelPortfolioStrategy}
        modelPortfolioModelId={modelPortfolioModelId}
        setModelPortfolioModelId={setModelPortfolioModelId}
        modelPortfolioRepairTrades={modelPortfolioRepairTrades}
        setModelPortfolioRepairTrades={setModelPortfolioRepairTrades}
        storeModalName={storeModalName}
        setStoreModalName={setStoreModalName}
        getRebalanceRepair={getRebalanceRepair}
        isReturningFromOtherBrokerModal={isReturningFromOtherBrokerModal}
        setIsReturningFromOtherBrokerModal={setIsReturningFromOtherBrokerModal}
        OrderPlacementResponse={OrderPlacementResponse}
        setOrderPlacementResponse={setOrderPlacementResponse}
        showFyersTpinModal={showFyersTpinModal}
        setShowFyersTpinModal={setShowFyersTpinModal}
        openSuccessModal={openSuccessModal}
        setOpenSucessModal={setOpenSucessModal}
        showDdpiModal={showDdpiModal}
        setShowDdpiModal={setShowDdpiModal}
        showActivateNowModel={showActivateNowModel}
        setActivateNowModel={setActivateNowModel}
        showAngleOneTpinModel={showAngleOneTpinModel}
        setShowAngleOneTpinModel={setShowAngleOneTpinModel}
        showDhanTpinModel={showDhanTpinModel}
        setShowDhanTpinModel={setShowDhanTpinModel}
        showOtherBrokerModel={showOtherBrokerModel}
        setShowOtherBrokerModel={setShowOtherBrokerModel}
        tradeType={tradeType}
        setTradeType={setTradeType}
        edisStatus={edisStatus}
        setEdisStatus={setEdisStatus}
        dhanEdisStatus={dhanEdisStatus}
        setDhanEdisStatus={setDhanEdisStatus}
        selectNonBroker={selectNonBroker}
        setSelectNonBroker={setSelectNonBroker}
        showstatusModal={showstatusModal}
        setShowstatusModal={setShowstatusModal}
        stockDataForModal={stockDataForModal}
        setStockDataForModal={setStockDataForModal}
        setLatestRebalanceData={setLatestRebalanceData}
        setuserExecution={setuserExecution}
        setmatchingFailedTrades={setmatchingFailedTrades}
        setRepairmessageModal={setRepairmessageModal}
        selectedOption={selectedOption}
        setSelectedOption={setSelectedOption}
      />

      {(brokerModel || OpenTokenExpireModel) && (
        <BrokerSelectionModal
          showBrokerModal={brokerModel}
          OpenTokenExpireModel={OpenTokenExpireModel}
          setShowBrokerModal={setBrokerModel}
          setOpenTokenExpireModel={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
          withoutBroker={false}
          handleAcceptRebalanceWithoutBroker={handleAcceptRebalanceWithoutBroker}
          handleBrokerConnectedContinue={handleBrokerConnectedContinue}
        />
      )}

      {openRebalanceModal ? (
        //   console.log('kokkk'),
        <RebalanceModal
          userEmail={userEmail}
          visible={openRebalanceModal}
          setOpenRebalanceModal={setOpenRebalanceModal}
          data={modelPortfolioStrategy}
          calculatedPortfolioData={calculatedPortfolioData}
          broker={broker}
          apiKey={apiKey}
          userDetails={userDetails}
          jwtToken={jwtToken}
          secretKey={secretKey}
          clientCode={clientCode}
          sid={sid}
          setShowFyersTpinModal={setShowFyersTpinModal}
          viewToken={viewToken}
          serverId={serverId}
          setBrokerModel={setBrokerModel}
          setOpenSucessModal={setOpenSucessModal}
          setOrderPlacementResponse={setOrderPlacementResponse}
          modelPortfolioModelId={modelPortfolioModelId}
          setOpenTokenExpireModel={setOpenTokenExpireModel}
          modelPortfolioRepairTrades={modelPortfolioRepairTrades}
          getRebalanceRepair={getRebalanceRepair}
          storeModalName={storeModalName}
          setIsReturningFromOtherBrokerModal={
            setIsReturningFromOtherBrokerModal
          }
          isReturningFromOtherBrokerModal={isReturningFromOtherBrokerModal}
          funds={funds}
          getModelPortfolioStrategyDetails={getModelPortfolioStrategyDetails}
          setShowOtherBrokerModel={setShowOtherBrokerModel}
          setShowDhanTpinModel={setShowDhanTpinModel}
          setShowAngleOneTpinModel={setShowAngleOneTpinModel}
          tradeType={tradeType}
          edisStatus={edisStatus}
          dhanEdisStatus={dhanEdisStatus}
          selectNonBroker={selectNonBroker}
          setShowDdpiModal={setShowDdpiModal}
          rebalanceExecutionStatus={RebalanceExecutionStatus}
          setModelPortfolioModelId={setModelPortfolioModelId}
        />
      ) : null}

      {openSuccessModal && (
        <RecommendationSuccessModal
          openSuccessModal={openSuccessModal}
          setOpenSucessModal={setOpenSucessModal}
          orderPlacementResponse={OrderPlacementResponse}
          currentBroker={broker}
        />
      )}

      {showIIFLModal && (
        <IIFLModal
          isVisible={showIIFLModal}
          onClose={() => setShowIIFLModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showICICIUPModal && (
        <ICICIUPModal
          isVisible={showICICIUPModal}
          showICICIUPModal={showICICIUPModal}
          setShowICICIUPModal={setShowICICIUPModal}
          onClose={() => setShowICICIUPModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showupstoxModal && (
        <UpstoxModal
          isVisible={showupstoxModal}
          onClose={() => setShowupstoxModal(false)}
          setShowupstoxModal={setShowupstoxModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showangleoneModal && (
        <AngleOneBookingModal
          isVisible={showangleoneModal}
          onClose={() => setShowangleoneModal(false)}
          setShowangleoneModal={setShowangleoneModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showzerodhamodal && (
        <ZerodhaConnectModal
          isVisible={showzerodhamodal}
          onClose={() => setShowzerodhaModal(false)}
          setShowzerodhaModal={setShowzerodhaModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showhdfcModal && (
        <HDFCconnectModal
          isVisible={showhdfcModal}
          onClose={() => setShowhdfcModal(false)}
          setShowhdfcModal={setShowhdfcModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showDhanModal && (
        <DhanConnectModal
          isVisible={showDhanModal}
          onClose={() => setShowDhanModal(false)}
          setShowDhanModal={setShowDhanModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showAliceblueModal && (
        <AliceBlueConnect
          isVisible={showAliceblueModal}
          showAliceblueModal={showAliceblueModal}
          setShowAliceblueModal={setShowAliceblueModal}
          onClose={() => setShowAliceblueModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showFyersModal && (
        <FyersConnect
          isVisible={showFyersModal}
          showFyersModal={showFyersModal}
          setShowFyersModal={setShowFyersModal}
          onClose={() => setShowFyersModal(false)}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showKotakModal && (
        <KotakModal
          isVisible={showKotakModal}
          onClose={() => setShowKotakModal(false)}
          setShowKotakModal={setShowKotakModal}
          setShowBrokerModal={setOpenTokenExpireModel}
          fetchBrokerStatusModal={fetchBrokerStatusModal}
        />
      )}

      {showstatusModal ? (
        <MPStatusModal
          isOpen={showstatusModal}
          onClose={() => setShowstatusModal(false)}
          stockData={stockDataForModal}
          onModeSelect={handleCheckStatus}
          onUpdateStockList={handleStockListUpdate}
          handleSendUpdatedResponse={handleSendUpdatedResponse}
          userbroker={broker}
          handleAcceptRebalance={handleAcceptRebalance}
          userEmail={userEmail}
          modelName={storeModalName}
          currentStep={currentStep}
          stepsData={stepsData}
          setCurrentStep={setCurrentStep}
          brokerStatus={brokerStatus}
          isRetryRebalance={!!matchfailed || userExecution?.status === 'partial'}
        />
      ) : null}


         <CommonInformationModal
        openModal={repairMessageModal}
        setCloseModal={setRepairmessageModal}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  StockTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: 'black',
  },
  lottie: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    marginTop: 20,
  },
});

export default RebalanceAdvices;
