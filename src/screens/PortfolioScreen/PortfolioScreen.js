import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  PanResponder,
  Animated,
  RefreshControl,
  SafeAreaView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import PortfolioCard from './PortFolioCard';
import eventEmitter from '../../components/EventEmitter';
import {getAuth} from '@react-native-firebase/auth';
import axios from 'axios';
import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';
import ModelPFCard from './ModelPFCard';
import formatCurrency from '../../utils/formatCurrency';
import Config from 'react-native-config';
import HoldingScoreModal from './HoldingScoreModal';
import {useTrade} from '../TradeContext';
import {generateToken} from '../../utils/SecurityTokenManager';
import WebSocketManager from '../../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import PortfolioPositionText from '../../components/AdviceScreenComponents/DynamicText/PortfolioPositionText';
import HoldingDynamicText from '../../components/AdviceScreenComponents/DynamicText/HoldingDynamicText';
import RenderEmptyMessage from './EmptyMessageCard';
import {useConfig} from '../../context/ConfigContext';
import {useNavigation} from '@react-navigation/native';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';
import {isOrderRejected, isOrderSuccess, isOrderPending} from '../../utils/orderStatusUtils';

const PortfolioScreen = () => {
  const navigation = useNavigation();
  const {
    userDetails,
    getUserDeatils,
    BrokerHoldingsData,
    getAllBrokerSpecificHoldings,
    allHoldingsData,
    getAllHoldings,
    configData,
  } = useTrade();

  // Get dynamic colors from config
  const config = useConfig();
  const mainColor = config?.mainColor || '#1264D4';

  const [tabIndex, setTabIndex] = useState(2);
  const tabIndexRef = useRef(tabIndex);

  useEffect(() => {
    tabIndexRef.current = tabIndex;
  }, [tabIndex]);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = user?.email;

  const [brokerStatus, setBrokerStatus] = useState(
    userDetails ? userDetails.connect_broker_status : null,
  );

  const collapseThreshold = 100;

  const subscribeToSymbols = async () => {
    const wsManager = WebSocketManager.getInstance();
    await wsManager.subscribeToAllSymbols(PositionsData);
  };

  useEffect(() => {
    subscribeToSymbols();
  }, []);

  const [modelPortfolioStrategy, setModelPortfolioStrategy] = useState([]);
  const getModelPortfolioStrategyDetails = () => {
    if (userEmail) {
      axios
        .get(
          `${server.server.baseUrl}api/model-portfolio/subscribed-strategies/${userEmail}`,
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
          const portfolios = res?.data?.subscribedPortfolios || [];
          const publishedPortfolios = portfolios.filter(
            portfolio => !portfolio.draft,
          );
          setModelPortfolioStrategy(publishedPortfolios);
        })
        .catch(err => console.log(err));
    }
  };

  const modelNames = modelPortfolioStrategy.map(item => item.model_name);
  const [modelPortfolioRepairTrades, setModelPortfolioRepairTrades] = useState(
    [],
  );

  const getRebalanceRepair = () => {
    const repairData = JSON.stringify({
      modelName: modelNames,
      advisor: modelPortfolioStrategy[0]['advisor'],
      userEmail: userEmail,
    });
    const config2 = {
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
      .catch(error => {});
  };

  const [HoldingsData, setHoldingsData] = useState([]);
  const [PositionsData, setpositionsData] = useState([]);

  const isToday = date => {
    const today = new Date();
    const inputDate = new Date(date);
    return today.toDateString() === inputDate.toDateString();
  };

  const stripBearer = token => {
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      return token.replace('Bearer ', '');
    }
    return token;
  };

  const getAllPositionsData = () => {
    const headers = {
      'Content-Type': 'application/json',
      'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
      'aq-encrypted-key': generateToken(
        Config.REACT_APP_AQ_KEYS,
        Config.REACT_APP_AQ_SECRET,
      ),
    };

    const sortPositions = positions => {
      return positions.sort((a, b) => {
        // Check if positions are closed (buyQuantity == sellQuantity)
        const aIsClosed =
          parseFloat(a.buyQuantity || 0) === parseFloat(a.sellQuantity || 0);
        const bIsClosed =
          parseFloat(b.buyQuantity || 0) === parseFloat(b.sellQuantity || 0);

        // First priority: Open positions (not closed) come first
        if (aIsClosed !== bIsClosed) {
          return aIsClosed ? 1 : -1; // Open positions first, closed positions last
        }

        // Second priority: For open positions, sort by net quantity (higher quantity first)
        if (!aIsClosed && !bIsClosed) {
          const aNetQty = Math.abs(parseFloat(a.netQuantity || 0));
          const bNetQty = Math.abs(parseFloat(b.netQuantity || 0));
          return bNetQty - aNetQty; // Higher net quantity first
        }

        // Third priority: For closed positions, you can sort alphabetically or keep original order
        if (aIsClosed && bIsClosed) {
          return a.symbol.localeCompare(b.symbol); // Alphabetical order for closed positions
        }

        return 0;
      });
    };

    const makeRequest = async (url, data) => {
      try {
        const response = await axios.post(url, data, {headers});
        const sortedData = sortPositions(response.data.position || []);
        // console.log('positions data-----respo', response.data);
        setpositionsData(sortedData);
      } catch (error) {
        console.log('Error fetching positions:', error.response);
        setpositionsData([]);
      }
    };

    if (broker === 'IIFL Securities' && clientCode) {
      makeRequest(`${server.ccxtServer.baseUrl}iifl/positions`, {
        clientCode,
      });
    } else if (broker === 'ICICI Direct' && apiKey && jwtToken && secretKey) {
      makeRequest(`${server.ccxtServer.baseUrl}icici/positions`, {
        apiKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
        secretKey: checkValidApiAnSecret(secretKey),
      });
    } else if (broker === 'Upstox' && apiKey && jwtToken && secretKey) {
      makeRequest(`${server.ccxtServer.baseUrl}upstox/positions`, {
        apiKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
        apiSecret: checkValidApiAnSecret(secretKey),
      });
    } else if (broker === 'Angel One' && apiKey && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}angelone/positions`, {
        apiKey: angelApi,
        accessToken: jwtToken,
      });
    } else if (broker === 'Zerodha' && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}zerodha/positions`, {
        apiKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
      });
    } else if (broker === 'Kotak' && jwtToken) {
      // Kotak NEO UUID flow (2026-04-22) — no consumer secret.
      makeRequest(`${server.ccxtServer.baseUrl}kotak/positions`, {
        consumerKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
        viewToken,
        sid,
        serverId,
      });
    } else if (broker === 'Hdfc Securities' && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}hdfc/positions`, {
        apiKey: checkValidApiAnSecret(apiKey),
        accessToken: jwtToken,
      });
    } else if (broker === 'Dhan' && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}dhan/positions`, {
        clientId: clientCode,
        accessToken: jwtToken,
      });
    } else if (broker === 'AliceBlue' && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}aliceblue/positions`, {
        clientId: clientCode,
        accessToken: jwtToken,
      });
    } else if (broker === 'Fyers' && jwtToken && clientCode) {
      makeRequest(`${server.ccxtServer.baseUrl}fyers/positions`, {
        clientId: clientCode,
        accessToken: jwtToken,
      });
    } else if (broker === 'Groww' && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}groww/positions`, {
        accessToken: jwtToken,
      });
    } else if (broker === 'Motilal Oswal' && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}motilal-oswal/positions`, {
        apiKey: checkValidApiAnSecret(apiKey),
        clientCode,
        accessToken: stripBearer(jwtToken),
      });
    }
  };

  useEffect(() => {
    eventEmitter.on('OrderPlacedReferesh', getAllPositionsData);
    return () => {
      eventEmitter.off('OrderPlacedReferesh', getAllPositionsData);
    };
  }, []);

  const angelApi = configData?.config?.REACT_APP_ANGEL_ONE_API_KEY;

  const pnlposneg = 1;
  const clientCode = userDetails && userDetails.clientCode;
  const apiKey = userDetails && userDetails?.apiKey;
  const broker = userDetails && userDetails.user_broker;
  const jwtToken = userDetails && userDetails.jwtToken;
  const my2pin = userDetails && userDetails.my2Pin;
  const secretKey = userDetails && userDetails.secretKey;
  const viewToken = userDetails && userDetails?.viewToken;
  const sid = userDetails && userDetails?.sid;
  const serverId = userDetails && userDetails?.serverId;

  const checkValidApiAnSecret = data => {
    if (!data) return null;
    const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
    const Key = bytesKey.toString(CryptoJS.enc.Utf8);
    if (Key) {
      return Key;
    }
  };

  const [Loading, setLoading] = useState(false);

  const [funds, setFunds] = useState('');

  const getAllFunds = () => {
    if (broker === 'IIFL Securities') {
      if (clientCode) {
        const data = JSON.stringify({
          clientCode: clientCode,
        });
        const config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}iifl/margin`,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          data: data,
        };
        axios
          .request(config)
          .then(response => {
            setFunds(response.data.data);
          })
          .catch(error => {});
      }
    } else if (broker === 'ICICI Direct') {
      if (apiKey && jwtToken && secretKey) {
        const data = JSON.stringify({
          apiKey: checkValidApiAnSecret(apiKey),
          sessionToken: jwtToken,
          secretKey: secretKey,
        });
        const config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}icici/funds`,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          data: data,
        };
        axios
          .request(config)
          .then(response => {
            setFunds(response.data.data);
          })
          .catch(error => {});
      }
    } else if (broker === 'Upstox') {
      if (apiKey && jwtToken && secretKey) {
        const data = JSON.stringify({
          apiKey: checkValidApiAnSecret(apiKey),
          accessToken: jwtToken,
          apiSecret: secretKey,
        });
        const config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}upstox/funds`,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          data: data,
        };
        axios
          .request(config)
          .then(response => {
            setFunds(response.data.data);
          })
          .catch(error => {});
      }
    } else if (broker === 'Zerodha') {
      if (jwtToken) {
        const data = JSON.stringify({
          apiKey: 'b0g1r806oitsamoe',
          accessToken: jwtToken,
        });
        const config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}zerodha/funds`,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          data: data,
        };
        axios
          .request(config)
          .then(response => {
            setFunds(response.data.data);
          })
          .catch(error => {});
      }
    } else if (broker === 'Kotak') {
      if (jwtToken) {
        // Kotak NEO UUID flow (2026-04-22) — no consumer secret.
        const data = JSON.stringify({
          consumerKey: checkValidApiAnSecret(apiKey),
          accessToken: jwtToken,
          viewToken: viewToken,
          exchange: 'NSE',
          segment: 'CASH',
          product: 'ALL',
          sid: sid,
          serverId: serverId,
        });
        const config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}kotak/funds`,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          data: data,
        };
        axios
          .request(config)
          .then(response => {
            setFunds(response.data.data);
          })
          .catch(error => {});
      }
    } else {
      if (apiKey && jwtToken) {
        const data = JSON.stringify({
          apiKey: apiKey,
          jwtToken: jwtToken,
        });
        const config = {
          method: 'post',
          url: `${server.ccxtServer.baseUrl}funds`,
          headers: {
            'Content-Type': 'application/json',
            'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
            'aq-encrypted-key': generateToken(
              Config.REACT_APP_AQ_KEYS,
              Config.REACT_APP_AQ_SECRET,
            ),
          },
          data: data,
        };
        axios
          .request(config)
          .then(response => {
            setFunds(response.data.data);
          })
          .catch(error => {});
      }
    }
  };

  const getAllHoldingsData = () => {
    const config = {
      method: 'get',
      url: `${server.server.baseUrl}api/portfolio/specific-user?email=${userEmail}`,
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
        setHoldingsData(
          response?.data?.data?.holdings?.length > 0
            ? response?.data?.data?.holdings
            : [],
        );
      })
      .catch(error => {
        console.log(error);
      });
  };

  const [selectedInnerTab, setSelectedInnerTab] = useState(0);

  // Client-side MP P&L aggregation (matching web app behavior)
  const [mpHoldings, setMpHoldings] = useState([]);
  const [mpHoldingsLoaded, setMpHoldingsLoaded] = useState(false);

  const {getLTPForSymbol} = useWebSocketCurrentPrice(
    mpHoldings.map(h => ({symbol: h.symbol, exchange: h.exchange || 'NSE'})),
  );

  const fetchAllMPHoldings = async () => {
    if (!userEmail || !modelPortfolioStrategy?.length) return;
    try {
      const allHoldings = [];
      for (const portfolio of modelPortfolioStrategy) {
        const modelName = portfolio?.model_name;
        if (!modelName) continue;
        try {
          const response = await axios.get(
            `${server.server.baseUrl}api/model-portfolio-db-update/subscription-raw-amount?email=${encodeURIComponent(userEmail)}&modelName=${encodeURIComponent(modelName)}&user_broker=${encodeURIComponent(broker || '')}`,
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
                'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
              },
            },
          );
          const data = response.data?.data;
          const latestExec = [...(data?.user_net_pf_model || [])].sort(
            (a, b) => new Date(b.execDate) - new Date(a.execDate),
          )[0];
          const orderResults = latestExec?.order_results || [];
          const validOrders = orderResults.filter(order => {
            if (isOrderSuccess(order.orderStatus) || isOrderPending(order.orderStatus)) {
              return Number(order.quantity || 0) > 0;
            }
            return !isOrderRejected(order.orderStatus) &&
              (order.orderStatus || '').toLowerCase() !== 'unplaced' &&
              Number(order.quantity || 0) > 0;
          });
          validOrders.forEach(order => {
            allHoldings.push({
              symbol: order.symbol || order.tradingSymbol,
              exchange: order.exchange || 'NSE',
              quantity: Number(order.quantity || 0),
              avgPrice: Number(order.averagePrice || 0),
            });
          });
        } catch (err) {
          console.log(`Holdings fetch error for ${modelName}:`, err.message);
        }
      }
      setMpHoldings(allHoldings);
      setMpHoldingsLoaded(true);
    } catch (err) {
      console.log('MP holdings aggregation error:', err.message);
    }
  };

  useEffect(() => {
    if (userEmail && configData && modelPortfolioStrategy?.length > 0) {
      fetchAllMPHoldings();
    }
  }, [userEmail, configData, modelPortfolioStrategy]);

  // Re-fetch on HOLDINGS_REFRESH event (after execution)
  useEffect(() => {
    const unsub = portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, () => {
      setMpHoldingsLoaded(false);
      fetchAllMPHoldings();
    });
    return unsub;
  }, [userEmail, configData, modelPortfolioStrategy]);

  // Compute MP P&L client-side from holdings + LTP (matching web BrokerHoldingsCards.js)
  const mpSummary = React.useMemo(() => {
    if (!mpHoldingsLoaded || mpHoldings.length === 0) return null;
    const validHoldings = mpHoldings.filter(h => {
      const ltp = getLTPForSymbol(h.symbol);
      return ltp !== null && ltp !== 0;
    });
    if (validHoldings.length === 0) return null;

    const totalInvested = validHoldings.reduce(
      (sum, h) => sum + h.avgPrice * h.quantity, 0,
    );
    const totalCurrent = validHoldings.reduce((sum, h) => {
      const ltp = getLTPForSymbol(h.symbol);
      const price = (ltp !== null && ltp !== 0) ? Number(ltp) : h.avgPrice;
      return sum + price * h.quantity;
    }, 0);
    const totalReturns = totalCurrent - totalInvested;
    const returnsPercentage = totalInvested > 0
      ? (totalReturns / totalInvested) * 100
      : 0;

    return {totalInvested, totalCurrent, totalReturns, returnsPercentage};
  }, [mpHoldings, mpHoldingsLoaded, getLTPForSymbol]);

  // Plan holdings for All Holdings tab (matching web app behavior)
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planHoldings, setPlanHoldings] = useState([]);
  const [planHoldingsLoading, setPlanHoldingsLoading] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  const fetchPlanHoldings = async (planName, brokerName) => {
    if (!planName || !userEmail) return;
    setPlanHoldingsLoading(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(Config.REACT_APP_AQ_KEYS, Config.REACT_APP_AQ_SECRET),
      };

      // Fetch from both endpoints in parallel (matching web app & AfterSubscriptionScreen)
      // 1. CCXT server — has the correct, up-to-date user_net_pf_model
      // 2. Backend — has subscription metadata
      const [portfolioResponse, subscriptionResponse] = await Promise.allSettled([
        axios.get(
          `${server.ccxtServer.baseUrl}rebalance/user-portfolio/latest/${encodeURIComponent(userEmail)}/${encodeURIComponent(planName)}`,
          {headers},
        ),
        axios.get(
          `${server.server.baseUrl}api/model-portfolio-db-update/subscription-raw-amount?email=${encodeURIComponent(userEmail)}&modelName=${encodeURIComponent(planName)}&user_broker=${encodeURIComponent(brokerName || '')}`,
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

      // Merge: CCXT's user_net_pf_model takes priority (matching web & AfterSubscriptionScreen)
      const data = {
        ...subscriptionData,
        user_net_pf_model: portfolioData?.user_net_pf_model || subscriptionData?.user_net_pf_model || [],
      };

      let sourceEntries = null;
      if (data?.user_net_pf_model?.length > 0) {
        sourceEntries = [...data.user_net_pf_model].sort(
          (a, b) => new Date(b.execDate) - new Date(a.execDate),
        );
      } else if (data?.user_net_pf_updated?.length > 0) {
        sourceEntries = [...data.user_net_pf_updated].sort(
          (a, b) => new Date(b.execDate) - new Date(a.execDate),
        );
      }
      if (sourceEntries) {
        const latestEntry = sourceEntries[0];
        if (latestEntry?.order_results?.length > 0) {
          const rejectedStatuses = ['rejected', 'failure', 'cancelled', 'failed', 'unplaced'];
          const holdings = latestEntry.order_results
            .filter(order => {
              const status = (order.orderStatus || '').toLowerCase();
              if (rejectedStatuses.includes(status)) return false;
              return Number(order.quantity || 0) > 0;
            })
            .map(order => ({
              symbol: order.symbol || order.tradingsymbol || '',
              exchange: order.exchange || 'NSE',
              quantity: Number(order.quantity || 0),
              avgPrice: Number(order.averagePrice || order.avgPrice || 0),
              broker: order.user_broker || latestEntry.user_broker || data.user_broker || brokerName || '',
              modelName: planName,
            }));
          setPlanHoldings(holdings);
        } else {
          setPlanHoldings([]);
        }
      } else {
        setPlanHoldings([]);
      }
    } catch (error) {
      console.error('Error fetching plan holdings:', error);
      setPlanHoldings([]);
    } finally {
      setPlanHoldingsLoading(false);
    }
  };

  // Auto-select first plan when strategies load
  useEffect(() => {
    if (modelPortfolioStrategy?.length > 0 && !selectedPlan) {
      setSelectedPlan(modelPortfolioStrategy[0].model_name);
    }
  }, [modelPortfolioStrategy]);

  // Fetch plan holdings when plan or broker changes
  useEffect(() => {
    if (selectedPlan && selectedInnerTab === 0) {
      fetchPlanHoldings(selectedPlan, broker);
    }
  }, [selectedPlan, broker]);

  // Client-side plan summary — mirrors mpSummary but scoped to the selected
  // plan so the top card matches the plan-filtered Holdings list below it.
  // planHoldings' symbols are a subset of mpHoldings (both sourced from MP
  // strategies), so the existing WebSocket LTP subscription covers them.
  const planSummary = React.useMemo(() => {
    if (!planHoldings || planHoldings.length === 0) return null;
    const validHoldings = planHoldings.filter(h => {
      const ltp = getLTPForSymbol(h.symbol);
      return ltp !== null && ltp !== 0;
    });
    if (validHoldings.length === 0) return null;

    const totalInvested = validHoldings.reduce(
      (sum, h) => sum + h.avgPrice * h.quantity, 0,
    );
    const totalCurrent = validHoldings.reduce((sum, h) => {
      const ltp = getLTPForSymbol(h.symbol);
      const price = (ltp !== null && ltp !== 0) ? Number(ltp) : h.avgPrice;
      return sum + price * h.quantity;
    }, 0);
    const totalReturns = totalCurrent - totalInvested;
    const returnsPercentage = totalInvested > 0
      ? (totalReturns / totalInvested) * 100
      : 0;

    return {totalInvested, totalCurrent, totalReturns, returnsPercentage};
  }, [planHoldings, getLTPForSymbol]);

  // Switch between broker data, plan data, and MP data based on tab/plan state
  const isMP = selectedInnerTab === 1;
  const usePlanSummary = !isMP && selectedPlan && planSummary;
  const profitAndLoss = isMP
    ? (mpSummary?.totalReturns ?? 0).toFixed(2)
    : usePlanSummary
      ? planSummary.totalReturns.toFixed(2)
      : Number.parseFloat(allHoldingsData?.totalprofitandloss || 0).toFixed(2);
  const pnlPercentage = isMP
    ? (mpSummary?.returnsPercentage ?? 0).toFixed(2)
    : usePlanSummary
      ? planSummary.returnsPercentage.toFixed(2)
      : Number.parseFloat(allHoldingsData?.totalpnlpercentage || 0).toFixed(2);
  // Override allHoldingsData for PortfolioCard to match the list below it
  const effectiveHoldingsData = isMP && mpSummary
    ? {
        totalinvvalue: mpSummary.totalInvested,
        totalholdingvalue: mpSummary.totalCurrent,
        totalprofitandloss: mpSummary.totalReturns,
        totalpnlpercentage: mpSummary.returnsPercentage,
      }
    : usePlanSummary
    ? {
        totalinvvalue: planSummary.totalInvested,
        totalholdingvalue: planSummary.totalCurrent,
        totalprofitandloss: planSummary.totalReturns,
        totalpnlpercentage: planSummary.returnsPercentage,
      }
    : allHoldingsData;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const processedData =
    modelPortfolioStrategy?.length !== 0 &&
    modelPortfolioStrategy
      .map((ele, i) => {
        const allRebalances = ele?.model?.rebalanceHistory || [];
        const sortedRebalances = [...allRebalances].sort(
          (a, b) => new Date(b.rebalanceDate) - new Date(a.rebalanceDate),
        );
        const latest = sortedRebalances[0] || null;

        const matchingFailedTrades = latest
          ? modelPortfolioRepairTrades?.find(
              trade =>
                trade.modelId === latest?.model_Id &&
                trade.failedTrades.length !== 0,
            )
          : null;

        return {
          key: i,
          modelName: ele?.model_name,
          latest: latest,
          repair: matchingFailedTrades ? 'repair' : null,
        };
      })
      .filter(Boolean);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      getAllPositionsData();
      getAllBrokerSpecificHoldings();
      getAllHoldingsData();
      if (selectedPlan) {
        fetchPlanHoldings(selectedPlan, broker);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const handlePortfolioUpdate = async () => {
      onRefresh();
    };
    eventEmitter.on('cartUpdated', handlePortfolioUpdate);
    return () => {
      eventEmitter.off('cartUpdated', handlePortfolioUpdate);
    };
  }, []);

  let holdingfinal = [];
  let positionfinal = [];
  if (HoldingsData?.length > 0) {
    holdingfinal = HoldingsData.filter(
      item =>
        item &&
        item.user_broker &&
        item.user_broker === userDetails?.user_broker,
    );
  }

  if (PositionsData?.length > 0) {
    positionfinal = PositionsData.filter(
      item =>
        item &&
        item.user_broker &&
        item.user_broker === userDetails?.user_broker,
    );
  }

  const advisorTag = Config.REACT_APP_ADVISOR_SPECIFIC_TAG;
  const [allStrategy, setAllStrategy] = useState([]);

  const getAllStrategy = async () => {
    setRefreshing(true);
    const config = {
      method: 'get',
      url: `${server.server.baseUrl}api/admin/plan/${advisorTag}/model portfolio/${userEmail}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Advisor-Subdomain': configData?.config?.REACT_APP_HEADER_NAME,
        'aq-encrypted-key': generateToken(
          Config.REACT_APP_AQ_KEYS,
          Config.REACT_APP_AQ_SECRET,
        ),
      },
    };

    try {
      const response = await axios.request(config);
      setAllStrategy(response.data.data);
    } catch (error) {
      console.log(error);
    } finally {
      setRefreshing(false);
    }
  };

  const calculateTotals = data => {
    const totals = data.reduce(
      (acc, item) => {
        const {avgPrice, ltp, quantity} = item.bespoke_holding;
        const investedValue = quantity * avgPrice;
        const currentValue = quantity * ltp;
        const netReturns = currentValue - investedValue;

        acc.totalInvested += investedValue;
        acc.totalCurrent += currentValue;
        acc.totalNetReturns += netReturns;
        return acc;
      },
      {totalInvested: 0, totalCurrent: 0, totalNetReturns: 0},
    );

    totals.netReturnsPercentage =
      totals.totalInvested > 0
        ? (totals.totalNetReturns / totals.totalInvested) * 100
        : 0;

    return {
      totalInvested: totals.totalInvested.toFixed(2),
      totalCurrent: totals.totalCurrent.toFixed(2),
      totalNetReturns: totals.totalNetReturns.toFixed(2),
      netReturnsPercentage: totals.netReturnsPercentage.toFixed(2),
    };
  };

  const result = calculateTotals(holdingfinal);

  useEffect(() => {
    if (userDetails && userDetails.user_broker !== undefined) {
      setBrokerStatus(userDetails && userDetails.connect_broker_status);
    }
  }, [userDetails, brokerStatus]);

  useEffect(() => {
    if (modelPortfolioStrategy.length !== 0) {
      getRebalanceRepair();
    }
  }, [modelPortfolioStrategy]);

  useEffect(() => {
    getUserDeatils();
    getModelPortfolioStrategyDetails();
    getAllHoldingsData();
    getAllBrokerSpecificHoldings();
    getAllPositionsData();
    getAllHoldings();
    getAllStrategy();
  }, [userEmail]);

  useEffect(() => {
    const refreshPortfolioData = () => {
      getAllHoldingsData();
      getAllBrokerSpecificHoldings();
      getAllPositionsData();
      getAllHoldings();
    };

    eventEmitter.on('OrderPlacedReferesh', refreshPortfolioData);
    return () => {
      eventEmitter.removeListener('OrderPlacedReferesh', refreshPortfolioData);
    };
  }, []);

  useEffect(() => {
    getAllFunds();
    getAllHoldingsData();
    getAllBrokerSpecificHoldings();
    getAllPositionsData();
    getAllHoldings();
  }, [userDetails]);

  const pan = useRef(new Animated.Value(0)).current;
  const [isGestureActive, setIsGestureActive] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        return (
          selectedInnerTab === 0 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
        );
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (selectedInnerTab !== 0) return false;
        const {dx, dy} = gestureState;
        return Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > 20;
      },
      onPanResponderGrant: () => {
        setIsGestureActive(true);
        pan.setOffset(pan._value);
        console.log('Gesture started');
      },

      onPanResponderRelease: (evt, gestureState) => {
        setIsGestureActive(false);
        pan.flattenOffset();

        const {dx, vx} = gestureState;
        const swipeThreshold = 60;
        const velocityThreshold = 0.3;

        console.log(
          `Gesture released: dx=${dx}, vx=${vx}, current tab from ref: ${tabIndexRef.current}`,
        );

        const isSignificantSwipe =
          Math.abs(dx) > swipeThreshold || Math.abs(vx) > velocityThreshold;

        if (isSignificantSwipe) {
          if (dx < 0) {
            console.log('Left swipe detected - moving to next tab');
            handleTabChange('next');
          } else {
            console.log('Right swipe detected - moving to previous tab');
            handleTabChange('previous');
          }
        } else {
          console.log('Swipe not significant enough');
        }

        Animated.spring(pan, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderTerminate: () => {
        setIsGestureActive(false);
        pan.flattenOffset();
        console.log('Gesture terminated');
        Animated.spring(pan, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  const handleTabChange = direction => {
    if (selectedInnerTab !== 0) return;

    const currentTab = tabIndexRef.current;
    const tabFlow = [0, 2, 1];
    const currentIndex = tabFlow.indexOf(currentTab);

    if (currentIndex === -1) {
      console.warn(`Current tab (${currentTab}) not found in flow`);
      return;
    }

    let nextTabIndex;
    if (direction === 'next') {
      nextTabIndex = (currentIndex + 1) % tabFlow.length;
    } else if (direction === 'previous') {
      nextTabIndex = (currentIndex - 1 + tabFlow.length) % tabFlow.length;
    } else {
      console.error(`Invalid direction: ${direction}`);
      return;
    }

    const nextTab = tabFlow[nextTabIndex];
    console.log(
      `Switching from tab ${currentTab} to tab ${nextTab} (${direction})`,
    );

    setTabIndex(nextTab);
    tabIndexRef.current = nextTab;
  };

  const renderHoldings = ({item}) => (
    // console.log('item i get Here All broker:', item),
    <View style={styles.flatListContainerHolding}>
      <View style={styles.listItem}>
        <View>
          <View style={{flexDirection: 'colum'}}>
            <View style={styles.row1}>
              <View style={{flexDirection: 'row'}}>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#A0A0A0',
                    fontFamily: 'Satoshi-Regular',
                  }}>
                  Qty.{' '}
                </Text>
                <Text style={styles.qtyAvg2}>{item?.quantity}</Text>
                <Text
                  style={{
                    marginLeft: 5,
                    color: 'black',
                    fontFamily: 'Satoshi-Bold',
                  }}>
                  •
                </Text>
                <Text
                  style={{
                    marginHorizontal: 5,
                    fontFamily: 'Satoshi-Regular',
                    fontSize: 12,
                    color: '#A0A0A0',
                  }}>
                  Avg
                </Text>
                <Text style={styles.qtyAvg2}>{item?.avgPrice}</Text>
              </View>
              <PortfolioPositionText
                advisedRangeCondition={0}
                symbol={`${item.symbol}`}
                exchange={item.exchange}
                stockDetails={HoldingsData}
                advisedPrice={0}
                data={item}
                type={'arfsHoldingCalculationPnl'}
              />
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginVertical: 5,
              }}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Text style={styles.stockName}>{item?.symbol}</Text>
              </View>
              <PortfolioPositionText
                advisedRangeCondition={0}
                symbol={`${item.symbol}`}
                exchange={item.exchange}
                stockDetails={HoldingsData}
                advisedPrice={0}
                data={item}
                type={'arfsHoldingCalculationRupee'}
              />
            </View>

            <View
              style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <View style={{flexDirection: 'row', marginLeft: 10}}>
                <Text style={styles.invested}>Invested: </Text>
                <Text style={styles.invested1}>
                  ₹
                  {item?.avgPrice * item?.quantity
                    ? (item?.avgPrice * item?.quantity).toFixed(2)
                    : '-'}
                </Text>
              </View>

              <View style={{flexDirection: 'row'}}>
                <Text style={styles.ltp}>LTP </Text>
                <Text style={styles.ltp1}>
                  {/* ₹{item.holding.ltp ? item.holding.ltp.toFixed(2) : '-'} */}
                  <PortfolioPositionText
                    advisedRangeCondition={0}
                    symbol={`${item.symbol}`}
                    exchange={item.exchange}
                    stockDetails={HoldingsData}
                    advisedPrice={0}
                    data={item}
                  />
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [loadingscore, setLoadingscore] = useState(false);
  const [stockData, setStockData] = useState(null);
  const [error, setError] = useState(null);

  const fetchStockScore = async stockSymbol => {
    setLoadingscore(true);
    setError(null);

    const cleanedSymbol = stockSymbol.replace(/-.*$/, '') + '.NS';

    try {
      const response = await axios.post(
        `${server.ccxtServer.baseUrl}misc/calculate-stocks-scores-runtime`,
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
        {
          stocks: [cleanedSymbol],
          date: new Date().toISOString().split('T')[0],
        },
      );
      console.log('cleanded symbol', cleanedSymbol);
      const {success, cached} = response.data;
      const scoreData =
        success.length > 0 ? success[0] : cached.length > 0 ? cached[0] : null;
      console.log('reddsss:', response.data);
      setStockData(scoreData);
      setLoadingscore(false);
    } catch (err) {
      setError('Failed to fetch stock scores. Try again.');
      setLoadingscore(false);
    } finally {
      setLoadingscore(false);
    }
  };

  const [scoreSymbol, setScoreSymbol] = useState();
  const OpenScoreModel = async item => {
    setScoreSymbol(item?.symbol);
    setModalVisible(true);
  };

  const renderAllHoldings = ({item}) => {
    const investedAmount = item?.avgPrice * item?.quantity;
    return (
      <View style={styles.flatListContainerHolding}>
        <View style={styles.listItem}>
          <View>
            <View style={{flexDirection: 'column'}}>
              <View style={styles.row1}>
                <View style={{flexDirection: 'row'}}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#A0A0A0',
                      fontFamily: 'Satoshi-Regular',
                    }}>
                    Qty.{' '}
                  </Text>
                  <Text style={styles.qtyAvg2}>{item?.quantity}</Text>
                  <Text
                    style={{
                      marginLeft: 5,
                      color: 'black',
                      fontFamily: 'Satoshi-Bold',
                    }}>
                    •
                  </Text>
                  <Text
                    style={{
                      marginHorizontal: 5,
                      fontFamily: 'Satoshi-Regular',
                      fontSize: 12,
                      color: '#A0A0A0',
                    }}>
                    Avg.
                  </Text>
                  <Text style={styles.qtyAvg2}>
                    {item?.avgPrice != null
                      ? parseFloat(item?.avgPrice).toFixed(2)
                      : '-'}
                  </Text>
                </View>

                <HoldingDynamicText
                  symbol={item.symbol}
                  exchange={item.exchange}
                  investedAmount={investedAmount}
                  quantity={item.quantity}
                  type="pnlRupee"
                />
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginVertical: 5,
                }}>
                <View style={{flexDirection: 'row', alignItems: 'center'}}>
                  <Text style={styles.stockName}>{item?.symbol}</Text>
                  {/* <TouchableOpacity
                    onPress={() => OpenScoreModel(item)}
                    style={{marginLeft: 8}}>
                    <InfoIcon size={14} color={'grey'} />
                  </TouchableOpacity> */}
                </View>
                <View>
                  <HoldingDynamicText
                    symbol={item.symbol}
                    exchange={item.exchange}
                    investedAmount={investedAmount}
                    quantity={item?.quantity}
                    type="pnlPercent"
                  />
                </View>
              </View>
              <View
                style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <View style={{flexDirection: 'row', marginLeft: 10}}>
                  <Text style={styles.invested}>Invested: </Text>
                  <Text style={styles.invested1}>
                    ₹
                    {item?.avgPrice * item?.quantity
                      ? (item?.avgPrice * item?.quantity).toFixed(2)
                      : '-'}
                  </Text>
                </View>

                <View style={{flexDirection: 'row'}}>
                  <Text style={styles.ltp}>LTP </Text>
                  <PortfolioPositionText
                    advisedRangeCondition={0}
                    symbol={item.symbol}
                    exchange={item.exchange}
                    stockDetails={BrokerHoldingsData}
                    advisedPrice={0}
                    type="ltpprice"
                    data={item}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPositions = ({item}) => {
    console.log('items:', item);
    const symbol = item.symbol;
    const netQuantity = Number(item.netQuantity);
    const buyQuantity = parseFloat(item.buyQuantity) || 0;
    const sellQuantity = parseFloat(item.sellQuantity) || 0;

    // Updated isClosed logic: trade is closed if buyQuantity equals sellQuantity
    const isClosed = buyQuantity === sellQuantity;

    const iniprice = Number.parseFloat(item.buyAvgPrice ?? 0);
    const quantity = Number.parseFloat(buyQuantity - sellQuantity ?? 0);
    const ltp = Number.parseFloat(item?.ltp ?? 0);
    const exe = item.exchange;

    const pnl = (ltp - iniprice) * quantity;
    const profitPercent =
      iniprice !== 0 ? ((ltp - iniprice) / iniprice) * 100 : 0;
    const pnlColor = pnl > 0 ? 'green' : pnl < 0 ? 'red' : 'grey';

    return (
      <View
        style={[
          styles.flatListContainerpos,
          isClosed && {backgroundColor: '#FFE5E5', opacity: 0.6},
        ]}>
        <View
          style={[styles.listItem, isClosed && {backgroundColor: '#FFE5E5'}]}>
          {/* Your existing JSX - keep it exactly as is */}
          <View>
            <View style={{flexDirection: 'column'}}>
              <View style={styles.row}>
                <View
                  style={{
                    flexDirection: 'row',
                    marginLeft: 10,
                    alignItems: 'center',
                  }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#A0A0A0',
                      fontFamily: 'Satoshi-Regular',
                    }}>
                    Qty.
                  </Text>
                  <Text style={[styles.qtyAvgblue]}>
                    {isClosed ? 0 : quantity}
                  </Text>
                  <Text
                    style={{
                      marginLeft: 5,
                      color: 'black',
                      fontFamily: 'Satoshi-Bold',
                    }}>
                    |
                  </Text>
                  <Text
                    style={{
                      marginHorizontal: 5,
                      fontFamily: 'Satoshi-Regular',
                      fontSize: 12,
                      color: '#A0A0A0',
                    }}>
                    Avg.
                  </Text>
                  <Text style={styles.qtyAvg2}>
                    {isClosed ? 0 : iniprice.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.actionContainer}>
                  {isClosed ? (
                    <Text
                      style={{
                        color: 'red',
                        fontFamily: 'Satoshi-Bold',
                        fontSize: 12,
                      }}>
                      CLOSED
                    </Text>
                  ) : (
                    <PortfolioPositionText
                      advisedRangeCondition={0}
                      symbol={item.symbol}
                      exchange={item.exchange}
                      stockDetails={PositionsData}
                      advisedPrice={0}
                      type="positionpnlPercent"
                      data={item}
                      isClosed={isClosed}
                    />
                  )}
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginVertical: 5,
                }}>
                <Text style={styles.stockName}>{item.symbol}</Text>
                <View>
                  <PortfolioPositionText
                    advisedRangeCondition={0}
                    symbol={item.symbol}
                    exchange={item.exchange}
                    stockDetails={PositionsData}
                    advisedPrice={0}
                    type="positionpnlRupee"
                    data={item}
                  />
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginLeft: 10,
                  marginRight: 0,
                }}>
                <Text style={styles.invested}>{exe}</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignContent: 'center',
                    alignItems: 'center',
                    alignSelf: 'center',
                  }}>
                  <Text style={styles.ltp}>LTP: </Text>
                  <PortfolioPositionText
                    advisedRangeCondition={0}
                    symbol={item.symbol}
                    exchange={item.exchange}
                    stockDetails={PositionsData}
                    advisedPrice={0}
                    type="ltpprice"
                    data={item}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderModalPFCard = ({item, index}) => (
    <ModelPFCard
      price={160000}
      percentage={20}
      userEmail={userEmail}
      strategy={processedData}
      specificPlan={item.latest}
      modelName={item.modelName}
      repair={item.repair ? 'repair' : null}
    />
  );

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <View {...panResponder.panHandlers} style={{flex: 1}}>
        <View style={{backgroundColor: '#EFF0EE', flex: 1}}>
          <View style={styles.headerContainer}>
            <View>
              <PortfolioCard
                Loading={Loading}
                allHoldingsData={effectiveHoldingsData}
                formatCurrency={formatCurrency}
                profitAndLoss={profitAndLoss}
                pnlPercentage={pnlPercentage}
                pnlposneg={pnlposneg}
                setSelectedInnerTab={setSelectedInnerTab}
              />
              <View style={{marginHorizontal: 0}}>
                <View style={styles.toggleBtnContainer}>
                  {config?.modelPortfolioEnabled === true ? (
                    <TouchableOpacity
                      style={[
                        styles.toggleBtnButton,
                        selectedInnerTab === 1
                          ? [styles.toggleBtnSelectedButton, { backgroundColor: mainColor }]
                          : styles.toggleBtnUnselectedButton,
                      ]}
                      onPress={() => setSelectedInnerTab(1)}
                      activeOpacity={0.8}>
                      <Text
                        style={[
                          styles.toggleBtnText,
                          selectedInnerTab === 1
                            ? styles.toggleBtnSelectedText
                            : styles.toggleBtnUnselectedText,
                        ]}>
                        Model Portfolios
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[
                      styles.toggleBtnButton,
                      selectedInnerTab === 0
                        ? [styles.toggleBtnSelectedButton, { backgroundColor: mainColor }]
                        : styles.toggleBtnUnselectedButton,
                    ]}
                    onPress={() => setSelectedInnerTab(0)}
                    activeOpacity={0.8}>
                    <Text
                      style={[
                        styles.toggleBtnText,
                        selectedInnerTab === 0
                          ? styles.toggleBtnSelectedText
                          : styles.toggleBtnUnselectedText,
                      ]}>
                      All Holdings
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

{selectedInnerTab === 1 && (
  <TouchableOpacity
    onPress={() => navigation.navigate('TradePnLScreen')}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 16,
      marginTop: 8,
      paddingVertical: 8,
      backgroundColor: mainColor,
      borderRadius: 8,
    }}>
    <Text style={{color: '#fff', fontSize: 12, fontFamily: 'Poppins-Medium'}}>📊 View Trade P&L Report</Text>
  </TouchableOpacity>
)}

{selectedInnerTab === 0 && (
<>
{/* Plan & Broker Selector */}
{modelPortfolioStrategy?.length > 0 && (
  <View style={styles.planSelectorRow}>
    <TouchableOpacity
      style={styles.planDropdown}
      onPress={() => setShowPlanPicker(true)}
      activeOpacity={0.7}
    >
      <Text style={styles.planDropdownLabel}>Plan</Text>
      <Text style={styles.planDropdownValue} numberOfLines={1}>
        {selectedPlan || 'Select Plan'}
      </Text>
      <Text style={styles.planDropdownArrow}>&#9660;</Text>
    </TouchableOpacity>
    <View style={styles.brokerBadge}>
      <Text style={styles.planDropdownLabel}>Broker</Text>
      <Text style={styles.brokerBadgeValue} numberOfLines={1}>
        {broker || 'Not Connected'}
      </Text>
    </View>
  </View>
)}

{/* Plan Picker Modal */}
<Modal
  visible={showPlanPicker}
  transparent
  animationType="fade"
  onRequestClose={() => setShowPlanPicker(false)}
>
  <TouchableOpacity
    style={styles.pickerOverlay}
    activeOpacity={1}
    onPress={() => setShowPlanPicker(false)}
  >
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerTitle}>Select Plan</Text>
      {modelPortfolioStrategy.map((item, index) => (
        <TouchableOpacity
          key={item.model_name || index}
          style={[
            styles.pickerItem,
            selectedPlan === item.model_name && [styles.pickerItemSelected, {backgroundColor: mainColor}],
          ]}
          onPress={() => {
            setSelectedPlan(item.model_name);
            setShowPlanPicker(false);
          }}
        >
          <Text style={[
            styles.pickerItemText,
            selectedPlan === item.model_name && styles.pickerItemTextSelected,
          ]}>
            {item.model_name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </TouchableOpacity>
</Modal>

<View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tabButton, tabIndex === 2 && styles.activeTab]}
                    onPress={() => setTabIndex(2)}
                  >
                    <View style={{ flexDirection: "row" }}>
                      <Text style={[styles.tabText, tabIndex === 2 && styles.activeTabText]}>Holdings</Text>
                      {(selectedPlan ? planHoldings : BrokerHoldingsData?.holding)?.length > 0 && (
                        <View
                          style={{
                            backgroundColor: tabIndex === 2 ? "#C84444" : "grey",
                            borderRadius: 15,
                            width: 20,
                            height: 20,
                            justifyContent: "center",
                            alignItems: "center",
                            marginLeft: 5,
                          }}
                        >
                          <Text style={styles.badgeText}>
                            {selectedPlan ? planHoldings.length : BrokerHoldingsData?.holding?.length}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabButton, tabIndex === 1 && styles.activeTab]}
                    onPress={() => setTabIndex(1)}
                  >
                    <View style={{ flexDirection: "row" }}>
                      <Text style={[styles.tabText, tabIndex === 1 && styles.activeTabText]}>Positions</Text>
                      {PositionsData?.length > 0 && (
                        <View
                          style={{
                            backgroundColor: tabIndex === 1 ? "red" : "grey",
                            borderRadius: 15,
                            width: 20,
                            height: 20,
                            justifyContent: "center",
                            alignItems: "center",
                            marginLeft: 5,
                          }}
                        >
                          <Text style={styles.badgeText}>{PositionsData?.length}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
</>
)}
              {selectedInnerTab === 1 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    padding: 15,
                  }}>
                  <View
                    style={{
                      flexDirection: 'column',
                      alignContent: 'flex-start',
                      alignItems: 'flex-start',
                      alignSelf: 'flex-start',
                    }}>
                    <Text
                      style={{
                        color: 'grey',
                        fontFamily: 'Satoshi-Regular',
                        fontSize: 12,
                        width: '100%',
                        borderColor: 'black',
                      }}>
                      {modelPortfolioStrategy.length} Model Portfolio
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: 'column',
                      alignContent: 'flex-end',
                      alignItems: 'flex-end',
                      alignSelf: 'flex-end',
                    }}>
                    <Text
                      style={{
                        color: 'grey',
                        fontFamily: 'Satoshi-Regular',
                        fontSize: 12,
                        width: '100%',
                        borderColor: 'black',
                      }}>
                      Current Value
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
          <View style={{flex: 1, backgroundColor: '#fff', marginTop: 0}}>
            {selectedInnerTab === 0 ? (
              tabIndex === 1 ? (
                <SafeAreaView style={styles.containerfi}>
                  <FlatList
                    data={PositionsData}
                    style={styles.list}
                    horizontal={false}
                    scrollEnabled={true}
                    renderItem={renderPositions}
                    ListEmptyComponent={
                      <RenderEmptyMessage value="positions" />
                    }
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="black"
                      />
                    }
                    keyExtractor={(item, index) =>
                      `${item?.symbol || index}_${index}`
                    }
                    scrollEventThrottle={16}
                  />
                </SafeAreaView>
              ) : (
                <SafeAreaView style={styles.containerfi}>
                  {planHoldingsLoading && selectedPlan ? (
                    <View style={{padding: 40, alignItems: 'center'}}>
                      <ActivityIndicator size="large" color={mainColor} />
                      <Text style={{marginTop: 12, color: '#666', fontFamily: 'Satoshi-Regular'}}>Loading holdings...</Text>
                    </View>
                  ) : (
                  <FlatList
                    style={styles.list}
                    data={selectedPlan ? planHoldings : BrokerHoldingsData?.holding}
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="black"
                      />
                    }
                    scrollEnabled={true}
                    ListEmptyComponent={<RenderEmptyMessage value="holdings" />}
                    renderItem={renderAllHoldings}
                    keyExtractor={(item, index) =>
                      `${item?.symbol || index}_${index}`
                    }
                    scrollEventThrottle={16}
                  />
                  )}
                </SafeAreaView>
              )
            ) : (
              <SafeAreaView>
                <FlatList
                  data={processedData}
                  style={styles.list}
                  renderItem={renderModalPFCard}
                  keyExtractor={(item, index) =>
                    `${item?.modelName || index}_${index}`
                  }
                  ListEmptyComponent={
                    <RenderEmptyMessage value="modelPortfolio" />
                  }
                  scrollEventThrottle={16}
                />
              </SafeAreaView>
            )}
          </View>
        </View>
        {modalVisible && (
          <HoldingScoreModal
            scoreSymbol={scoreSymbol}
            setModalVisible={setModalVisible}
            modalVisible={modalVisible}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    marginBottom: 10,
  },
  scoreContainer: {
    marginVertical: 10,
  },
  scoreText: {
    fontSize: 16,
    color: '#333',
    marginVertical: 3,
  },
  totalScore: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontFamily: 'Satoshi-Medium',
  },
  button: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderWidth: 1,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 10,
  },
  buttonText: {
    color: '#000',
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
  },
  closeButton: {
    marginTop: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginBottom: 10,
  },
  containerfi: {
    flex: 1,
    backgroundColor: 'white',
  },
  list: {
    flexGrow: 1,
    backgroundColor: 'white',
  },
  container1: {
    flex: 1,
  },
  tabIndicator: {
    backgroundColor: '#FF5733',
  },
  tabBar: {
    backgroundColor: '#FFF',
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  activeTabText: {
    color: '#000',
    fontFamily: 'Satoshi-Medium',
  },
  inactiveTabText: {
    color: '#fff',
  },
  actionContainer: {
    alignSelf: 'flex-end',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#33D37C',
  },
  symbolCard: {},
  buyAction: {
    backgroundColor: '#fff',
  },
  sellAction: {
    backgroundColor: '#Fff',
  },
  buyActiontext: {
    color: '#33D37C',
    fontFamily: 'Satoshi-Medium',
    fontSize: 12,
  },
  innerTab: {
    borderRadius: 20,
    borderWidth: 2,
    marginHorizontal: 10,
    marginBottom: 5,
    borderColor: '#E4E4E4',
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },
  activeInnerTab: {
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: '#E4E8ED',
    borderWidth: 1.5,
    borderColor: '#7188A4',
  },
  sellActiontext: {
    padding: 5,
    color: '#cf3a49',
    fontFamily: 'Satoshi-Regular',
    fontSize: 14,
    marginBottom: 1,
  },
  actionText: {
    fontSize: 20,
    padding: 0,
    fontWeight: 'bold',
    color: '#010001',
  },
  holdingStatusContainer: {
    backgroundColor: '#E7EEFE',
    padding: 3,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  holdingStatusText: {
    color: '#6181C6',
  },
  soldHoldingContainer: {
    backgroundColor: '#F7F7F9',
  },
  soldHoldingText: {
    color: '#A6A6A8',
  },
  StockTitle: {
    fontSize: 22,
    fontFamily: 'Satoshi-Bold',
    color: 'black',
    paddingHorizontal: 15,
  },
  badgeContainer: {
    backgroundColor: 'red',
    borderRadius: 15,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stickyCard: {
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 10,
    backgroundColor: '#C84444',
    marginTop: 10,
    elevation: 5,
  },
  flatListContainerHolding: {
    flex: 1,
  },
  flatListContainerpos: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  card: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  positionamountText: {
    fontSize: 16,
    color: 'white',
    alignSelf: 'center',
    textAlign: 'center',
  },
  amountValue: {
    fontSize: 17,
    fontFamily: 'Satoshi-SemiBold',
    color: 'black',
  },
  belowpositionamountValue: {
    fontSize: 20,
    fontFamily: 'Satoshi-Regular',
    color: 'red',
    alignSelf: 'center',
  },
  pnlContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pnlText: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Satoshi-Regular',
    marginTop: 0,
  },
  pnlText2: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Satoshi-Regular',
  },
  pnlBorder: {
    paddingHorizontal: 15,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: 'white',
    borderWidth: 1.5,
    marginRight: 10,
    borderRadius: 20,
  },
  netReturnsText: {
    color: '#000000',
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
  },
  subText: {
    fontFamily: 'Satoshi-Medium',
    fontSize: 14,
    marginLeft: 10,
  },
  positiveSubText: {
    color: '#16A085',
  },
  negativeSubText: {
    color: '#E43D3D',
  },
  zeroSubText: {
    color: '#000000',
  },
  pnlValue: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    color: '#73BE4A',
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlValuepos: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    color: '#73BE4A',
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlValueneg: {
    fontSize: 18,
    fontFamily: 'Satoshi-Medium',
    color: '#cf3a49',
    alignSelf: 'center',
    textAlignVertical: 'bottom',
    textAlign: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  pnlPercentage: {
    fontSize: 14,
    color: '#73BE4A',
    paddingTop: 2,
    textAlignVertical: 'center',
    fontFamily: 'Satoshi-Medium',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
  },
  rowModel: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    color: 'white',
  },
  row1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 10,
  },
  index: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  stockName: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: '#333',
    marginLeft: 10,
  },
  change: {
    fontSize: 1,
    color: 'green',
  },
  qtyAvg: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  qtyAvg2: {
    fontSize: 12,
    color: 'black',
    fontFamily: 'Satoshi-Medium',
  },
  qtyAvgblue: {
    fontSize: 14,
    color: '#6791EA',
    fontFamily: 'Satoshi-Medium',
  },
  invested: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  invested1: {
    fontSize: 14,
    color: 'black',
    fontFamily: 'Satoshi-Medium',
  },
  ltp: {
    fontSize: 14,
    color: '#A0A0A0',
    fontFamily: 'Satoshi-Medium',
  },
  ltp1: {
    fontSize: 14,
    color: 'black',
    fontFamily: 'Satoshi-Medium',
  },
  changeValue: {
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    color: 'green',
  },
  poschangeValue: {
    fontSize: 14,
    color: '#16A085',
    fontFamily: 'Satoshi-Medium',
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  negchangeValue: {
    fontSize: 14,
    color: '#E6626F',
    fontFamily: 'Satoshi-Medium',
    justifyContent: 'flex-end',
    alignContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  status: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  holding: {
    color: 'green',
  },
  soldHolding: {
    color: 'red',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: 16,
  },
  headerSubText: {
    fontSize: 15,
    color: 'grey',
    fontFamily: 'Satoshi-Regular',
  },
  separator: {
    width: '100%',
    height: 1,
    backgroundColor: '#EAEAEA',
    marginVertical: 10,
  },
  pnlPercentageContainerpos: {
    backgroundColor: '#F0FFE8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pnlPercentagepos: {
    fontSize: 14,
    color: '#73BE4A',
    fontFamily: 'Satoshi-Medium',
  },
  pnlPercentageContainerneg: {
    backgroundColor: '#FDEAEC',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  pnlPercentageneg: {
    fontSize: 14,
    color: '#cf3a49',
    fontFamily: 'Satoshi-Medium',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  activeTab: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 14,
    color: 'grey',
    fontFamily: 'Satoshi-Regular',
  },
  tabTextup: {
    fontSize: 15,
    color: '#7F7F7F',
    fontFamily: 'Satoshi-Regular',
  },
  activeTabTextup: {
    fontSize: 15,
    color: '#002A5C',
    fontFamily: 'Satoshi-Medium',
  },
  listItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  amountText: {
    fontSize: 16,
    color: 'white',
    fontFamily: 'Satoshi-Regular',
  },
  circularProgressValue: {
    fontSize: 14,
    color: 'black',
  },
  shadowView: {
    backgroundColor: '#ffffff', // Always add solid background for shadows
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toggleBtnContainer: {
    flexDirection: 'row',
    gap: 16,
    margin: 20,
    justifyContent: 'center',
  },
  toggleBtnButton: {
    flex: 1,
    height: 35,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnSelectedButton: {
    backgroundColor: '#1264D4',
  },
  toggleBtnUnselectedButton: {
    backgroundColor: '#F4F4F4',
  },
  toggleBtnText: {
    fontSize: 12,
    alignContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    fontFamily: 'Poppins-Medium',
  },
  toggleBtnSelectedText: {
    color: '#fff',
    fontWeight: '600',
  },
  toggleBtnUnselectedText: {
    color: '#232323',
    fontWeight: '500',
  },
  planSelectorRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#fff',
  },
  planDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F8FE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBE7FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  planDropdownLabel: {
    fontSize: 11,
    color: '#8899AA',
    fontFamily: 'Satoshi-Medium',
    marginRight: 6,
  },
  planDropdownValue: {
    flex: 1,
    fontSize: 13,
    color: '#1F2B38',
    fontFamily: 'Satoshi-Bold',
  },
  planDropdownArrow: {
    fontSize: 10,
    color: '#8899AA',
    marginLeft: 4,
  },
  brokerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F8FE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DBE7FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brokerBadgeValue: {
    fontSize: 13,
    color: '#1F2B38',
    fontFamily: 'Satoshi-Bold',
    maxWidth: 100,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '80%',
    maxHeight: '60%',
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#1F2B38',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemSelected: {
    backgroundColor: '#1264D4',
  },
  pickerItemText: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    color: '#333',
  },
  pickerItemTextSelected: {
    color: '#fff',
  },
});

export default PortfolioScreen;
