import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  PanResponder,
  Animated,
} from 'react-native';
import eventEmitter from '../../components/EventEmitter';
import {getAuth} from '@react-native-firebase/auth';
import axios from 'axios';
import server from '../../utils/serverConfig';
import CryptoJS from 'react-native-crypto-js';
import ModelPFCard from './ModelPFCard';
import formatCurrency from '../../utils/formatCurrency';
import Config from 'react-native-config';
import {useTrade} from '../TradeContext';
import {generateToken} from '../../utils/SecurityTokenManager';
import WebSocketManager from '../../components/AdviceScreenComponents/DynamicText/WebSocketManager';
import PortfolioPositionText from '../../components/AdviceScreenComponents/DynamicText/PortfolioPositionText';
import HoldingDynamicText from '../../components/AdviceScreenComponents/DynamicText/HoldingDynamicText';
import {useConfig} from '../../context/ConfigContext';
import useTokens from '../../theme/useTokens';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';
import {isOrderRejected, isOrderSuccess, isOrderPending} from '../../utils/orderStatusUtils';
import {useComponent} from '../../design/useDesign';
import useHomeMarketSummary from '../Home/hooks/useHomeMarketSummary';
import styles from './PortfolioScreen.styles';
import {getAccountEmail} from '../../utils/accountEmail';

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
    modelPortfolioRepairTrades,
  } = useTrade();

  const config = useConfig();
  const mainColor = useTokens().colors.brand.primary;

  const [tabIndex, setTabIndex] = useState(2);
  const tabIndexRef = useRef(tabIndex);

  useEffect(() => {
    tabIndexRef.current = tabIndex;
  }, [tabIndex]);
  const auth = getAuth();
  const user = auth.currentUser;
  const userEmail = getAccountEmail();
  // Variant-facing user name + tickers for the alphanomy `_AppHeader`.
  const userName = userDetails?.name || user?.displayName || '';
  const { tickers } = useHomeMarketSummary();

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

  // modelPortfolioRepairTrades now comes from TradeContext (auto-fetched
  // alongside getModelPortfolioStrategyDetails). Local fetch removed
  // 2026-05-11 — see docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g.
  const modelNames = modelPortfolioStrategy.map(item => item.model_name);

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
      // Catch-all for brokers without a dedicated branch above
      // (Angel One, HDFC, Dhan, AliceBlue, Fyers, Groww, Motilal Oswal,
      // Axis Securities). Previously this hit `${baseUrl}funds` (no broker
      // prefix) and 404'd silently for every one of them — caught and
      // swallowed by `.catch(error => {})`. Route through the canonical
      // `fetchFunds` helper which already maps each broker to the correct
      // per-broker route and request shape.
      fetchFunds(
        broker,
        clientCode,
        apiKey,
        jwtToken,
        secretKey,
        sid,
        serverId,
        userEmail,
      )
        .then(response => {
          if (response?.data) setFunds(response.data);
        })
        .catch(() => {});
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
  // "As of" timestamp for the last holdings fetch — drives the
  // refresh-on-focus staleness check below (web parity: ModalPFList
  // holdingsAsOf + focus/visibilitychange refetch, C4-1).
  const holdingsAsOfRef = useRef(0);

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
      holdingsAsOfRef.current = Date.now();
    } catch (err) {
      console.log('MP holdings aggregation error:', err.message);
    }
  };

  // Refresh holdings on screen focus when the snapshot is stale (>60s) —
  // RN analog of web's focus/visibilitychange staleness refetch. Prevents
  // showing an old holdings snapshot when the user returns to this tab
  // after executing a rebalance / trade elsewhere (web parity C4-1).
  useFocusEffect(
    React.useCallback(() => {
      if (
        userEmail &&
        configData &&
        modelPortfolioStrategy?.length > 0 &&
        holdingsAsOfRef.current &&
        Date.now() - holdingsAsOfRef.current > 60000
      ) {
        fetchAllMPHoldings();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userEmail, configData, modelPortfolioStrategy]),
  );

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

  // Repair fetch now lives in TradeContext (fires automatically on
  // getModelPortfolioStrategyDetails). Removed local trigger on 2026-05-11.

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
      userEmail={userEmail}
      strategy={processedData}
      specificPlan={item.latest}
      modelName={item.modelName}
      repair={item.repair ? 'repair' : null}
      index={index}
    />
  );

  // Phase J (2026-05-05): JSX render extracted to
  // designs/default/screens/PortfolioScreen.js (legacy chrome) and
  // designs/alphanomy/screens/PortfolioScreen.js (alphanomy chrome).
  // Container hands its data, render closures, and modal state over as a
  // single `portfolio` prop bag — the registered presentation picks the
  // visual shape.
  const Presentation = useComponent('screens.PortfolioScreen');

  // Live ticker strip for variants that render their own header (alphanomy).
  // Default presentation ignores this. Mirrors the `home` bag pattern in
  // src/screens/Home/HomeScreen.js so additive variant fields stay opt-in.
  const portfolio = {
    // Tabs
    selectedInnerTab, setSelectedInnerTab,
    tabIndex, setTabIndex,

    // P&L hero
    Loading,
    effectiveHoldingsData,
    profitAndLoss,
    pnlPercentage,
    pnlposneg,

    // Lists
    modelPortfolioStrategy,
    processedData,
    BrokerHoldingsData,
    PositionsData,
    planHoldings,
    planHoldingsLoading,

    // Plan picker
    showPlanPicker, setShowPlanPicker,
    selectedPlan, setSelectedPlan,
    broker,

    // Refresh + gestures
    refreshing, onRefresh,
    panResponder,

    // Renderers (closures over container scope)
    renderAllHoldings,
    renderPositions,
    renderModalPFCard,

    // Theme + navigation
    mainColor,
    navigation,
    modelPortfolioEnabled: config?.modelPortfolioEnabled === true,

    // Variant-facing additions (alphanomy reads these; default ignores them).
    userEmail,
    userName,
    config,
    tickers,

    // Modal
    modalVisible, scoreSymbol, setModalVisible,
  };

  return <Presentation portfolio={portfolio} />;
};


export default PortfolioScreen;
