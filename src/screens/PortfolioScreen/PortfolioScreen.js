import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  PanResponder,
  Animated,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import {InfoIcon} from 'lucide-react-native';
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
import {useIsFocused, useNavigation} from '@react-navigation/native';
import useWebSocketCurrentPrice from '../../FunctionCall/useWebSocketCurrentPrice';
import {fetchFunds} from '../../FunctionCall/fetchFunds';
import portfolioEvents, {PORTFOLIO_EVENTS} from '../../utils/portfolioEvents';
import {isOrderRejected, isOrderSuccess, isOrderPending} from '../../utils/orderStatusUtils';
import {useComponent} from '../../design/useDesign';
import useHomeMarketSummary from '../Home/hooks/useHomeMarketSummary';
import styles from './PortfolioScreen.styles';
import {getAccountEmail, useAccountEmail, getAccountDisplayName} from '../../utils/accountEmail';
import {
  buildPriceInstruments,
  calculateCompleteHoldingsSummary,
  getBrokerHoldingRows,
} from '../../utils/portfolioSummary';
import {calculateCompletePositionsSummary} from '../../utils/positionPnl';
import PortfolioCard from './PortFolioCard';
import RenderEmptyMessage from './EmptyMessageCard';
import HoldingScoreModal from './HoldingScoreModal';
import PortfolioSummaryCard from '../../components/designContainers/PortfolioSummaryCardContainer';
import {
  baseSymbol,
  corporateActionMessage,
  getRecentCorporateActionNotices,
} from '../../utils/corporateActionNotice';

import { designColor, designFont } from '../../design/literalTokens';

const PortfolioScreen = () => {
  const navigation = useNavigation();
  const isScreenFocused = useIsFocused();
  const {
    userDetails,
    getUserDeatils,
    BrokerHoldingsData,
    getAllBrokerSpecificHoldings,
    lastBrokerHoldingsRefresh,
    allHoldingsData,
    getAllHoldings,
    configData,
    modelPortfolioRepairTrades,
    modelPortfolioStrategyfinal,
    modelPortfolioEntitlementsLoaded,
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
  const userName = getAccountDisplayName(userDetails?.name, user?.displayName);
  const { tickers } = useHomeMarketSummary();

  const [brokerStatus, setBrokerStatus] = useState(
    userDetails ? userDetails.connect_broker_status : null,
  );

  const collapseThreshold = 100;
  const [HoldingsData, setHoldingsData] = useState([]);
  const [PositionsData, setpositionsData] = useState([]);

  useEffect(() => {
    const wsManager = WebSocketManager.getInstance();
    wsManager.subscribeToAllSymbols(PositionsData);
  }, [PositionsData]);

  const [modelPortfolioStrategy, setModelPortfolioStrategy] = useState([]);
  const getModelPortfolioStrategyDetails = () => {
    setModelPortfolioStrategy([]);
  };

  // modelPortfolioRepairTrades now comes from TradeContext (auto-fetched
  // alongside getModelPortfolioStrategyDetails). Local fetch removed
  // 2026-05-11 — see docs/MODEL_PORTFOLIO_ARCHITECTURE.md § 6g.
  const modelNames = modelPortfolioStrategy.map(item => item.model_name);

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
      makeRequest(`${server.ccxtServer.baseUrl}groww/position`, {
        accessToken: jwtToken,
      });
    } else if (broker === 'DefinEdge Securities' && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}definedge/positions`, {
        apiSessionKey: jwtToken,
        accessToken: jwtToken,
        actid: clientCode,
      });
    } else if (broker === 'Motilal Oswal' && jwtToken) {
      makeRequest(`${server.ccxtServer.baseUrl}motilal-oswal/positions`, {
        apiKey: checkValidApiAnSecret(apiKey),
        clientCode,
        accessToken: stripBearer(jwtToken),
      });
    }
  };

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
    try {
      const bytesKey = CryptoJS.AES.decrypt(data, 'ApiKeySecret');
      const Key = bytesKey.toString(CryptoJS.enc.Utf8);
      return Key || data;
    } catch (error) {
      // Decrypt-or-passthrough: plaintext credentials (e.g. Zerodha's API
      // key) must be sent as-is (2026-08-13).
      return data;
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
  const [showDisconnectedHoldingsWarning, setShowDisconnectedHoldingsWarning] =
    useState(false);
  const [staleHoldingsAcknowledged, setStaleHoldingsAcknowledged] =
    useState(false);

  const brokerConnectionResolved = Boolean(
    userDetails &&
      (userDetails._id ||
        userDetails.email ||
        userDetails.user_email ||
        userDetails.connect_broker_status != null),
  );
  const normalizedConnectionStatus = String(
    userDetails?.connect_broker_status || brokerStatus || '',
  )
    .trim()
    .toLowerCase();
  const primaryBrokerEntry = Array.isArray(userDetails?.connected_brokers)
    ? userDetails.connected_brokers.find(
        entry =>
          String(entry?.broker || '').trim().toLowerCase() ===
          String(broker || '').trim().toLowerCase(),
      )
    : null;
  const normalizedEntryStatus = String(primaryBrokerEntry?.status || '')
    .trim()
    .toLowerCase();
  const tokenExpiry = primaryBrokerEntry?.token_expire
    ? new Date(primaryBrokerEntry.token_expire).getTime()
    : NaN;
  const disconnectedStatuses = new Set([
    'disconnected',
    'expired',
    'error',
    'failure',
    'failed',
    'inactive',
    'not connected',
    'not_connected',
  ]);
  const brokerSessionUsable =
    Boolean(broker) &&
    !disconnectedStatuses.has(normalizedConnectionStatus) &&
    !disconnectedStatuses.has(normalizedEntryStatus) &&
    (!Number.isFinite(tokenExpiry) || tokenExpiry > Date.now());
  const staleHoldingsAsOf = lastBrokerHoldingsRefresh
    ? new Date(lastBrokerHoldingsRefresh).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'last successful refresh unavailable';

  useEffect(() => {
    if (
      brokerConnectionResolved &&
      isScreenFocused &&
      selectedInnerTab === 0 &&
      !brokerSessionUsable
    ) {
      setShowDisconnectedHoldingsWarning(true);
    } else if (
      !isScreenFocused ||
      brokerSessionUsable ||
      selectedInnerTab !== 0
    ) {
      setShowDisconnectedHoldingsWarning(false);
      setStaleHoldingsAcknowledged(false);
    }
  }, [
    brokerConnectionResolved,
    brokerSessionUsable,
    isScreenFocused,
    selectedInnerTab,
  ]);

  // Client-side MP P&L aggregation (matching web app behavior)
  const [mpHoldings, setMpHoldings] = useState([]);
  const [mpHoldingsLoaded, setMpHoldingsLoaded] = useState(false);

  useEffect(() => {
    if (!modelPortfolioEntitlementsLoaded) {
      setModelPortfolioStrategy([]);
      setMpHoldings([]);
      setMpHoldingsLoaded(false);
      return;
    }
    const publishedPortfolios = (modelPortfolioStrategyfinal || []).filter(
      portfolio => !portfolio.draft,
    );
    setModelPortfolioStrategy(publishedPortfolios);
    if (publishedPortfolios.length === 0) {
      setMpHoldings([]);
      setMpHoldingsLoaded(true);
    }
  }, [modelPortfolioEntitlementsLoaded, modelPortfolioStrategyfinal]);

  const brokerHoldingRows = React.useMemo(
    () => getBrokerHoldingRows(BrokerHoldingsData),
    [BrokerHoldingsData],
  );
  const priceInstruments = React.useMemo(
    () => buildPriceInstruments(mpHoldings, brokerHoldingRows, PositionsData),
    [mpHoldings, brokerHoldingRows, PositionsData],
  );
  const {getLTPForSymbol} = useWebSocketCurrentPrice(
    priceInstruments,
  );

  const fetchAllMPHoldings = React.useCallback(async () => {
    if (!modelPortfolioEntitlementsLoaded || !userEmail || !modelPortfolioStrategy?.length) {
      setMpHoldings([]);
      setMpHoldingsLoaded(modelPortfolioEntitlementsLoaded);
      return;
    }
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
              corp_action_action_id: order.corp_action_action_id,
              corp_action_orig_qty: order.corp_action_orig_qty,
              corp_action_applied_at: order.corp_action_applied_at,
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
  }, [broker, configData, modelPortfolioEntitlementsLoaded, modelPortfolioStrategy, userEmail]);

  useEffect(() => {
    if (userEmail && configData && modelPortfolioStrategy?.length > 0) {
      fetchAllMPHoldings();
    }
  }, [fetchAllMPHoldings, userEmail, configData, modelPortfolioStrategy]);

  // Re-fetch on HOLDINGS_REFRESH event (after execution)
  useEffect(() => {
    const unsub = portfolioEvents.on(PORTFOLIO_EVENTS.HOLDINGS_REFRESH, () => {
      setMpHoldingsLoaded(false);
      fetchAllMPHoldings();
    });
    return unsub;
  }, [fetchAllMPHoldings, userEmail, configData, modelPortfolioStrategy]);

  // Compute MP P&L client-side from holdings + LTP (matching web BrokerHoldingsCards.js)
  const mpSummary = React.useMemo(() => {
    if (!mpHoldingsLoaded || mpHoldings.length === 0) return null;
    return calculateCompleteHoldingsSummary(mpHoldings, getLTPForSymbol);
  }, [mpHoldings, mpHoldingsLoaded, getLTPForSymbol]);

  const corporateActionNotices = React.useMemo(
    () => getRecentCorporateActionNotices(mpHoldings),
    [mpHoldings],
  );
  const pendingNoticeForHolding = React.useCallback(item => {
    const notice = corporateActionNotices.find(
      candidate => candidate.symbol === baseSymbol(item?.symbol),
    );
    if (!notice) return null;
    const brokerQuantity = Number(item?.quantity);
    return Number.isFinite(brokerQuantity) && brokerQuantity >= notice.adjustedQuantity
      ? null
      : notice;
  }, [corporateActionNotices]);

  // Switch between broker data, plan data, and MP data based on tab/plan state
  const isMP = selectedInnerTab === 1;
  const isPositionsTab = selectedInnerTab === 0 && tabIndex === 1;
  // All Holdings is broker-scoped. Model-specific summaries and requests
  // belong exclusively to the Model Portfolios tab.
  const positionSummary = React.useMemo(
    () =>
      calculateCompletePositionsSummary(PositionsData, getLTPForSymbol),
    [PositionsData, getLTPForSymbol],
  );
  // The broker summary endpoint can return a zero P&L while the individual
  // holdings (and their live LTPs) are valid. Derive a fallback from those
  // same holdings so the hero card cannot contradict the rows below it.
  const liveBrokerSummary = React.useMemo(() => {
    return calculateCompleteHoldingsSummary(
      BrokerHoldingsData,
      getLTPForSymbol,
    );
  }, [BrokerHoldingsData, getLTPForSymbol]);
  const apiPnl = Number(allHoldingsData?.totalprofitandloss);
  const useLiveBrokerSummary =
    !isMP &&
    !isPositionsTab &&
    !!liveBrokerSummary;
  const profitAndLoss = (
    isPositionsTab
      ? positionSummary?.totalReturns ?? 0
      : isMP
        ? mpSummary?.totalReturns ?? 0
        : useLiveBrokerSummary
            ? liveBrokerSummary.totalReturns
            : Number.isFinite(apiPnl)
              ? apiPnl
              : 0
  ).toFixed(2);
  const pnlPercentage = (
    isPositionsTab
      ? positionSummary?.returnsPercentage ?? 0
      : isMP
        ? mpSummary?.returnsPercentage ?? 0
        : useLiveBrokerSummary
            ? liveBrokerSummary.returnsPercentage
            : Number(allHoldingsData?.totalpnlpercentage) || 0
  ).toFixed(2);
  // Override allHoldingsData for PortfolioCard to match the list below it
  const effectiveHoldingsData = isPositionsTab
    ? positionSummary
      ? {
          totalinvvalue: positionSummary.totalInvested,
          totalholdingvalue: positionSummary.totalCurrent,
          totalprofitandloss: positionSummary.totalReturns,
          totalpnlpercentage: positionSummary.returnsPercentage,
        }
      : null
    : isMP && mpSummary
    ? {
        totalinvvalue: mpSummary.totalInvested,
        totalholdingvalue: mpSummary.totalCurrent,
        totalprofitandloss: mpSummary.totalReturns,
        totalpnlpercentage: mpSummary.returnsPercentage,
      }
    : useLiveBrokerSummary
    ? {
        ...allHoldingsData,
        totalinvvalue: liveBrokerSummary.totalInvested,
        totalholdingvalue: liveBrokerSummary.totalCurrent,
        totalprofitandloss: liveBrokerSummary.totalReturns,
        totalpnlpercentage: liveBrokerSummary.returnsPercentage,
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
      getAllHoldings();
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
    // Re-register on account changes. onRefresh is render-local and
    // including its identity would resubscribe after every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetails, configData, broker]);

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
    // This is keyed to the connected account identifiers. The request helpers
    // are render-local functions and adding their identities would retrigger
    // the full portfolio bootstrap after every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, broker, jwtToken, clientCode]);

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
    // Re-register only when the connected account/config changes; the local
    // request helper identities change on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetails, configData]);

  useEffect(() => {
    getAllFunds();
    getAllHoldingsData();
    getAllBrokerSpecificHoldings();
    getAllPositionsData();
    getAllHoldings();
    // Refresh this group when broker user details change. Including each
    // render-local helper would create a request loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    (<View style={styles.flatListContainerHolding}>
      <View style={styles.listItem}>
        <View>
          <View style={{flexDirection: 'colum'}}>
            <View style={styles.row1}>
              <View style={{flexDirection: 'row'}}>
                <Text
                  style={{
                    fontSize: 12,
                    color: designColor('a0a0a0'),
                    fontFamily: designFont('Satoshi-Regular'),
                  }}>
                  Qty.{' '}
                </Text>
                <Text style={styles.qtyAvg2}>{item?.quantity}</Text>
                <Text
                  style={{
                    marginLeft: 5,
                    color: 'black',
                    fontFamily: designFont('Satoshi-Bold'),
                  }}>
                  •
                </Text>
                <Text
                  style={{
                    marginHorizontal: 5,
                    fontFamily: designFont('Satoshi-Regular'),
                    fontSize: 12,
                    color: designColor('a0a0a0'),
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
    </View>)
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
    const corporateActionNotice = pendingNoticeForHolding(item);
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
                      color: designColor('a0a0a0'),
                      fontFamily: designFont('Satoshi-Regular'),
                    }}>
                    Qty.{' '}
                  </Text>
                  <Text style={styles.qtyAvg2}>{item?.quantity}</Text>
                  <Text
                    style={{
                      marginLeft: 5,
                      color: 'black',
                      fontFamily: designFont('Satoshi-Bold'),
                    }}>
                    •
                  </Text>
                  <Text
                    style={{
                      marginHorizontal: 5,
                      fontFamily: designFont('Satoshi-Regular'),
                      fontSize: 12,
                      color: designColor('a0a0a0'),
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
                  {corporateActionNotice && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${corporateActionNotice.symbol} corporate action information`}
                      onPress={() => Alert.alert(
                        corporateActionNotice.type === 'BONUS' ? 'Bonus shares pending' : 'Stock split adjustment',
                        corporateActionMessage(corporateActionNotice, item?.quantity),
                      )}
                      style={{marginLeft: 8, padding: 4}}>
                      <InfoIcon size={16} color={designColor('b45309')} />
                    </TouchableOpacity>
                  )}
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
                    liveLtp={getLTPForSymbol(item.symbol)}
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
                    liveLtp={getLTPForSymbol(item.symbol)}
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
    const netQuantity = Number(item.netQuantity);
    const buyQuantity = parseFloat(item.buyQuantity) || 0;
    const sellQuantity = parseFloat(item.sellQuantity) || 0;

    // Updated isClosed logic: trade is closed if buyQuantity equals sellQuantity
    const isClosed = buyQuantity === sellQuantity;

    const quantity = Number.isFinite(netQuantity)
      ? netQuantity
      : buyQuantity - sellQuantity;
    const iniprice = Number.parseFloat(
      quantity < 0 ? item.sellAvgPrice ?? 0 : item.buyAvgPrice ?? 0,
    );
    const exe = item.exchange;

    return (
      <View
        style={[
          styles.flatListContainerpos,
          isClosed && {backgroundColor: designColor('ffe5e5'), opacity: 0.6},
        ]}>
        <View
          style={[styles.listItem, isClosed && {backgroundColor: designColor('ffe5e5')}]}>
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
                      color: designColor('a0a0a0'),
                      fontFamily: designFont('Satoshi-Regular'),
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
                      fontFamily: designFont('Satoshi-Bold'),
                    }}>
                    |
                  </Text>
                  <Text
                    style={{
                      marginHorizontal: 5,
                      fontFamily: designFont('Satoshi-Regular'),
                      fontSize: 12,
                      color: designColor('a0a0a0'),
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
                        fontFamily: designFont('Satoshi-Bold'),
                        fontSize: 12,
                      }}>
                      CLOSED
                    </Text>
                  ) : (
                    <PortfolioPositionText
                      advisedRangeCondition={0}
                      symbol={item.symbol}
                      exchange={item.exchange}
                      liveLtp={getLTPForSymbol(item.symbol)}
                      stockDetails={PositionsData}
                      advisedPrice={0}
                      type="positionpnlPercent"
                      data={item}
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
                    liveLtp={getLTPForSymbol(item.symbol)}
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
                    liveLtp={getLTPForSymbol(item.symbol)}
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
    isPositionsTab,

    // P&L hero
    Loading,
    effectiveHoldingsData,
    profitAndLoss,
    pnlPercentage,
    pnlposneg,
    availableCash:
      funds?.availablecash !== undefined && funds?.availablecash !== null
        ? Number(funds.availablecash)
        : null,

    // Lists
    modelPortfolioStrategy,
    processedData,
    BrokerHoldingsData,
    PositionsData,
    broker,
    brokerSessionUsable,
    staleHoldingsAcknowledged,
    staleHoldingsAsOf,

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
    slots: {
      PortfolioCard,
      RenderEmptyMessage,
      HoldingScoreModal,
      PortfolioSummaryCard,
    },
  };

  return (
    <>
      <Presentation portfolio={portfolio} />
      <Modal
        visible={showDisconnectedHoldingsWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisconnectedHoldingsWarning(false)}>
        <View style={brokerWarningStyles.backdrop}>
          <View style={brokerWarningStyles.card}>
            <Text style={brokerWarningStyles.title}>Broker not connected</Text>
            <Text style={brokerWarningStyles.message}>
              These holdings may be stale because your broker is not connected.
              Connect your broker to refresh and verify the latest holdings.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Connect broker"
              activeOpacity={0.85}
              style={[brokerWarningStyles.primaryButton, {backgroundColor: mainColor}]}
              onPress={() => {
                setShowDisconnectedHoldingsWarning(false);
                navigation.navigate('Broker Setting');
              }}>
              <Text style={brokerWarningStyles.primaryButtonText}>
                Connect Broker
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Ignore broker warning and view stale holdings"
              activeOpacity={0.8}
              style={brokerWarningStyles.secondaryButton}
              onPress={() => {
                setStaleHoldingsAcknowledged(true);
                setShowDisconnectedHoldingsWarning(false);
              }}>
              <Text style={brokerWarningStyles.secondaryButtonText}>
                Ignore
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const brokerWarningStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: designColor('ffffff'),
    padding: 20,
  },
  title: {
    color: designColor('1f2937'),
    fontFamily: designFont('Satoshi-Bold'),
    fontSize: 18,
    marginBottom: 8,
  },
  message: {
    color: designColor('4b5563'),
    fontFamily: designFont('Satoshi-Regular'),
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 9,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: designColor('ffffff'),
    fontFamily: designFont('Satoshi-Bold'),
    fontSize: 14,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingTop: 13,
  },
  secondaryButtonText: {
    color: designColor('4b5563'),
    fontFamily: designFont('Satoshi-Medium'),
    fontSize: 13,
  },
});


export default PortfolioScreen;
